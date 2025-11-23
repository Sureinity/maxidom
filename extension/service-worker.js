import {
  ENDPOINTS,
  getProfileUUID,
  getSystemState,
  setSystemState,
  setProfilingProgress,
  clearProfilingProgress,
} from "./utils/helpers.js";

// Hybrid Model Constants
// A session is a burst of user activity.
const INACTIVITY_TIMEOUT_MS = 5000; // Primary trigger: End session after 5s of no activity.
const MAX_SESSION_DURATION_MS = 90000; // Safety Net 1: Force end session after 90s.
const MAX_EVENT_COUNT = 2000; // Safety Net 2: Force end session after 2000 events.
const MINIMUM_EVENTS_THRESHOLD = 20; // Noise Reduction: Discard sessions with too few meaningful events.
const PASSIVE_SESSION_HEARTBEAT_THRESHOLD = 10; // Threshold to identify passive (scrolling) sessions.

// Global State
let sessionData = {};
let inactivityTimeout = null;
let mouseMoveTimeout = null;
let keyDownMap = new Map();
let mousedownEvent = null;

// New state lock to prevent race conditions during session finalization.
let isFinalizing = false;
// New state variable to manage the profiling lockdown.
let isProfilingUnlocked = false;

// State to track if overlay should be shown
let overlayState = { showOverlay: false, context: null };

// Core Session Management Functions
function resetSessionData() {
  clearTimeout(inactivityTimeout);
  inactivityTimeout = null;

  sessionData = {
    startTimestamp: null,
    endTimestamp: null,
    keyEvents: [],
    mousePaths: [],
    clicks: [],
    heartbeatCount: 0,
  };

  keyDownMap.clear();
  mousedownEvent = null;
  if (sessionData.currentMousePath) {
    delete sessionData.currentMousePath;
  }
}
// Initialize state on script start
resetSessionData();

function checkAndSetStartTimestamp(timestamp) {
  if (!sessionData.startTimestamp) {
    sessionData.startTimestamp = timestamp;
  }
}

async function finalizeAndSendSession() {
  // Check the lock and ensure there's data to send.
  if (isFinalizing || !sessionData.startTimestamp) {
    return;
  }
  clearTimeout(inactivityTimeout);
  inactivityTimeout = null;

  // Upon finalization, any pending timers must be cleared to prevent potential issues caused by stale timers.
  clearTimeout(inactivityTimeout);
  inactivityTimeout = null;

  // Set the lock to prevent new events from being processed.
  isFinalizing = true;

  sessionData.endTimestamp = performance.now();

  // Finalize any pending mouse path before sending.
  if (sessionData.currentMousePath && sessionData.currentMousePath.length > 0) {
    sessionData.mousePaths.push([...sessionData.currentMousePath]);
    delete sessionData.currentMousePath;
  }

  // Sophisticated session validation logic.
  const totalMeaningfulEvents =
    sessionData.keyEvents.length +
    sessionData.clicks.length +
    sessionData.mousePaths.length;
  const totalHeartbeats = sessionData.heartbeatCount;

  // Path 1: Session has enough active biometric data.
  if (totalMeaningfulEvents >= MINIMUM_EVENTS_THRESHOLD) {
    const dataToSend = JSON.parse(JSON.stringify(sessionData));
    resetSessionData(); // Reset state before the async network call.
    isFinalizing = false; // Release lock early for this path.

    console.log(
      "Active session finalized. Preparing to send aggregated data:",
      dataToSend,
    );
    try {
      await handleDataPayload(dataToSend);
    } catch (error) {
      console.error("Failed to handle active data payload:", error);
    }
    return;
  }

  // Path 2: Session has low active events but high passive (scroll) activity.
  else if (totalHeartbeats >= PASSIVE_SESSION_HEARTBEAT_THRESHOLD) {
    console.log(
      `Passive reading session detected (${totalHeartbeats} scrolls) and ignored.`,
    );
  }

  // Path 3: Session has low active events and low passive activity.
  else {
    console.log(
      `Session with only ${totalMeaningfulEvents} events discarded as noise.`,
    );
  }

  // For paths 2 and 3, we simply discard the data and reset.
  resetSessionData();
  isFinalizing = false;
}

// A function to dynamically set the popup based on the system state.
async function updateActionPopup() {
  const state = await getSystemState();
  if (state === "enrollment") {
    await chrome.action.setPopup({
      popup: "frontend/dist/index.html?page=onboarding",
    });
  } else {
    await chrome.action.setPopup({ popup: "frontend/dist/index.html" });
  }
}

// Chrome Listeners
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const newUUID = crypto.randomUUID();
    await chrome.storage.local.set({ profile_uuid: newUUID });
    await setSystemState("enrollment");
    console.log(
      "New profile UUID created. System state set to enrollment.",
      newUUID,
    );
    await updateActionPopup();
    chrome.tabs.create({ url: "frontend/dist/index.html?page=onboarding" });
  } else if (details.reason === "update") {
    await updateActionPopup();
  }
});

// Listener for when the browser starts up. This is our primary LOCK trigger.
chrome.runtime.onStartup.addListener(async () => {
  isProfilingUnlocked = false;
  console.log("Browser startup: Profiling session is locked by default.");
  const state = await getSystemState();
  if (state === "profiling") {
    await broadcastToTabs({
      action: "SHOW_OVERLAY",
      context: "profiling_lock",
    });
  }
  await updateActionPopup();
});

// Listener for new windows to enforce lockdown.
chrome.windows.onCreated.addListener(async (window) => {
  const state = await getSystemState();
  if (state === "profiling" && !isProfilingUnlocked) {
    const tabs = await chrome.tabs.query({ active: true, windowId: window.id });
    if (tabs[0]) {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "SHOW_OVERLAY",
          context: "profiling_lock",
        });
        // Update overlay state
        overlayState = { showOverlay: true, context: "profiling_lock" };
      }, 500);
    }
  }
});

// Central Message Listener: The router for all incoming data from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ENROLL_PASSWORD") {
    handleEnrollment(message.password.trim(), sendResponse);
    return true;
  }
  if (message.type === "REQUEST_PROFILING_STATUS") {
    handleProfilingStatusRequest(sendResponse);
    return true;
  }
  if (message.type === "RESET_PROFILE") {
    handleProfileReset();
    return; // This is a fire-and-forget message
  }
  if (message.type === "VERIFY_PASSWORD_FOR_RESET") {
    (async () => {
      const uuid = await getProfileUUID();
      if (!uuid) {
        sendResponse({ verified: false });
        return;
      }
      try {
        const response = await fetch(ENDPOINTS.VERIFY_PASSWORD(uuid), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: message.password.trim() }),
        });
        if (!response.ok) throw new Error("Verification request failed.");
        const result = await response.json();
        sendResponse(result); // Sends back {"verified": true/false}
      } catch (error) {
        console.error("Verification for reset error:", error);
        sendResponse({ verified: false });
      }
    })();
    return true; // Keep the message channel open for the async response.
  }
  if (message.type === "CHANGE_PASSWORD") {
    (async () => {
      const uuid = await getProfileUUID();
      if (!uuid) {
        sendResponse({ success: false, error: "Profile ID not found." });
        return;
      }
      try {
        const response = await fetch(ENDPOINTS.CHANGE_PASSWORD(uuid), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            old_password: message.oldPassword.trim(),
            new_password: message.newPassword.trim(),
          }),
        });
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            try {
              const errorData = await response.json();
              errorMessage = errorData.detail || errorMessage;
            } catch (jsonError) {
              // If JSON parsing fails, keep the default error message
            }
          } else {
            // If not JSON, try to get text response
            try {
              const text = await response.text();
              if (text.startsWith("<!DOCTYPE")) {
                errorMessage = `Server error: ${response.status} ${response.statusText}`;
              } else {
                errorMessage = text;
              }
            } catch (textError) {
              // Keep the default error message
            }
          }
          throw new Error(errorMessage);
        }
        const result = await response.json();
        sendResponse({ success: true });
      } catch (error) {
        console.error("Change password error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep the message channel open for the async response.
  }
  if (message.type === "GET_OVERLAY_STATE") {
    sendResponse(overlayState);
    return true;
  }

  (async () => {
    const currentState = await getSystemState();

    if (
      (currentState === "profiling" && !isProfilingUnlocked) ||
      currentState === "awaiting_verification"
    ) {
      if (message.type === "PASSWORD_SUBMITTED") {
        const context =
          currentState === "profiling"
            ? "profiling_unlock"
            : "anomaly_response";
        handlePasswordVerification(message.password, context);
      } else if (message.type === "CONTENT_SCRIPT_READY") {
        await handleContentScriptReady(sender);
      }
      return;
    }

    if (isFinalizing) {
      return;
    }

    if (message.type === "RAW_EVENT") {
      handleRawEvent(message.payload);
    } else if (message.type === "HEARTBEAT") {
      handleHeartbeat();
    } else if (message.type === "BLUR_EVENT") {
      if (keyDownMap.size > 0) {
        console.log(
          "Window blurred. Clearing dangling keydown events to prevent corruption.",
        );
        keyDownMap.clear();
      }
    }
  })();

  return true;
});

// Event Handlers
async function broadcastToTabs(message) {
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      if (!error.message.includes("Receiving end does not exist")) {
        console.warn(
          `Could not send message to tab ${tab.id}: ${error.message}`,
        );
      }
    }
  }
  // Update overlay state if showing or hiding overlay
  if (message.action === "SHOW_OVERLAY") {
    overlayState = { showOverlay: true, context: message.context };
  } else if (message.action === "HIDE_OVERLAY") {
    overlayState = { showOverlay: false, context: null };
  }
}

// This function now sends the correct context based on the global state.
async function handleContentScriptReady(sender) {
  const currentState = await getSystemState();
  let context = null;
  if (currentState === "awaiting_verification") {
    context = "anomaly";
  } else if (currentState === "profiling" && !isProfilingUnlocked) {
    context = "profiling_lock";
  }
  if (context) {
    console.log(
      `New tab opened during lockdown (ID: ${sender.tab.id}). Injecting overlay with context: ${context}.`,
    );
    try {
      // Send the context along with the action
      await chrome.tabs.sendMessage(sender.tab.id, {
        action: "SHOW_OVERLAY",
        context: context,
      });
      // Update overlay state
      overlayState = { showOverlay: true, context: context };
    } catch (error) {
      console.warn(
        `Failed to send initial overlay command to tab ${sender.tab.id}: ${error.message}`,
      );
    }
  }
}

function handleHeartbeat() {
  checkAndSetStartTimestamp(performance.now());

  // Increment the heartbeat count for the current session.
  if (!sessionData.heartbeatCount) {
    sessionData.heartbeatCount = 0;
  }
  sessionData.heartbeatCount++;

  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(finalizeAndSendSession, INACTIVITY_TIMEOUT_MS);
}

async function handleProfilingStatusRequest(sendResponse) {
  const profile_uuid = await getProfileUUID();
  const system_state = await getSystemState();
  const profiling_progress_data =
    await chrome.storage.local.get("profiling_progress");
  const profiling_progress = profiling_progress_data.profiling_progress || {};

  sendResponse({
    profile_uuid,
    system_state,
    profiling_progress,
  });
}

// Main Event Aggregation Logic
function handleRawEvent(event) {
  checkAndSetStartTimestamp(event.t);
  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(finalizeAndSendSession, INACTIVITY_TIMEOUT_MS);
  const sessionDuration = event.t - (sessionData.startTimestamp || event.t);
  const roughEventCount =
    (sessionData.keyEvents?.length || 0) +
    (sessionData.clicks?.length || 0) +
    (sessionData.mousePaths?.length || 0);
  if (
    sessionDuration > MAX_SESSION_DURATION_MS ||
    roughEventCount > MAX_EVENT_COUNT
  ) {
    console.log(
      "Safety net triggered (max duration or event count). Finalizing session.",
    );
    finalizeAndSendSession();
    return;
  }
  switch (event.eventType) {
    case "mousemove":
      if (!sessionData.currentMousePath) sessionData.currentMousePath = [];
      sessionData.currentMousePath.push({ t: event.t, x: event.x, y: event.y });
      clearTimeout(mouseMoveTimeout);
      mouseMoveTimeout = setTimeout(() => {
        if (sessionData.currentMousePath?.length > 0) {
          sessionData.mousePaths.push([...sessionData.currentMousePath]);
          delete sessionData.currentMousePath;
        }
      }, 200);
      break;
    case "keydown":
      if (!keyDownMap.has(event.code)) {
        keyDownMap.set(event.code, event.t);
      }
      break;
    case "keyup":
      const downTime = keyDownMap.get(event.code);
      if (downTime) {
        sessionData.keyEvents.push({
          code: event.code,
          downTime,
          upTime: event.t,
        });
        keyDownMap.delete(event.code);
      }
      break;
    case "mousedown":
      mousedownEvent = {
        t: event.t,
        x: event.x,
        y: event.y,
        button: event.button,
      };
      break;
    case "mouseup":
      if (mousedownEvent) {
        sessionData.clicks.push({
          ...mousedownEvent,
          duration: event.t - mousedownEvent.t,
        });
        mousedownEvent = null;
      }
      break;
  }
}

// API Logic
async function handleDataPayload(payload) {
  const uuid = await getProfileUUID();
  if (!uuid) throw new Error("Profile UUID not found.");
  const { userId, ...payloadToSend } = payload;
  const state = await getSystemState();
  if (state === "profiling") {
    await handleProfiling(ENDPOINTS.TRAIN(uuid), payloadToSend);
  } else if (state === "detection") {
    await handleDetection(ENDPOINTS.SCORE(uuid), payloadToSend, uuid);
  }
}

async function handleProfiling(endpoint, payload) {
  console.log("State: PROFILING. Sending data to /train endpoint.");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    await setProfilingProgress(data.progress);
    console.log("Profiling progress updated:", data.progress);
    if (data.progress.is_ready) {
      console.log(
        "Profile readiness conditions met. Transitioning to DETECTION state.",
      );
      await setSystemState("detection");
    }
  } catch (error) {
    console.error("Error during profiling data submission:", error);
  }
}

async function handleDetection(endpoint, payload, uuid) {
  console.log("State: DETECTION. Sending data to /score endpoint.");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.status === 404) {
      console.warn("Model not found (404). Resetting to PROFILING state.");
      await setSystemState("profiling");
      await handleProfiling(ENDPOINTS.TRAIN(uuid), payload);
      return;
    }
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    if (data.is_anomaly) {
      console.warn("⚠️ ANOMALY DETECTED! Initiating lockdown.", data);
      clearTimeout(inactivityTimeout);
      await setSystemState("awaiting_verification");
      await broadcastToTabs({ action: "SHOW_OVERLAY", context: "anomaly" });
    } else {
      console.log("Normal behavior detected.", data);
    }
  } catch (error) {
    console.error("Error during detection data submission:", error);
  }
}

// Authentication Flow Handlers
async function handleEnrollment(password, sendResponse) {
  const uuid = await getProfileUUID();
  if (!uuid) {
    sendResponse({ success: false, error: "Profile ID not found." });
    return;
  }
  try {
    const response = await fetch(ENDPOINTS.ENROLL(uuid), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password }),
    });
    if (response.ok) {
      await setSystemState("profiling");
      isProfilingUnlocked = true;
      await updateActionPopup();
      sendResponse({ success: true });
    } else {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch (jsonError) {
          // If JSON parsing fails, keep the default error message
        }
      } else {
        // If not JSON, try to get text response
        try {
          const text = await response.text();
          if (text.startsWith("<!DOCTYPE")) {
            errorMessage = `Server error: ${response.status} ${response.statusText}`;
          } else {
            errorMessage = text;
          }
        } catch (textError) {
          // Keep the default error message
        }
      }
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error("Enrollment error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handlePasswordVerification(password, context) {
  const uuid = await getProfileUUID();
  if (!uuid) return;
  try {
    const response = await fetch(ENDPOINTS.VERIFY_PASSWORD(uuid), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: password.trim() }),
    });
    if (!response.ok) throw new Error("Verification request failed.");
    const result = await response.json();
    if (result.verified) {
      console.log("Password verification successful.");
      if (context === "profiling_unlock") {
        isProfilingUnlocked = true;
        console.log("Profiling unlocked for this browser session.");
      } else {
        await setSystemState("detection");
        console.log("Resuming normal operation.");
      }
      await broadcastToTabs({ action: "HIDE_OVERLAY" });
    } else {
      console.warn("Password verification failed.");
      await broadcastToTabs({
        action: "SHOW_VERIFICATION_ERROR",
        error: "Incorrect password. Please try again.",
      });
    }
  } catch (error) {
    console.error("Verification error:", error);
    await broadcastToTabs({
      action: "SHOW_VERIFICATION_ERROR",
      error: "An error occurred. Please try again.",
    });
  }
}

// Handler for the Profile Reset Logic
async function handleProfileReset() {
  const uuid = await getProfileUUID();
  if (!uuid) {
    console.error("Cannot reset profile: No UUID found.");
    return;
  }

  console.log(`Initiating profile reset for ${uuid}...`);

  try {
    // Call the backend to delete all biometric data (models, csv files, etc.)
    const response = await fetch(ENDPOINTS.RESET_PROFILE(uuid), {
      method: "DELETE",
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Backend reset failed with status: ${response.status}`);
    }

    console.log(
      "Backend data successfully deleted. Resetting local extension state.",
    );

    // Set the state to 'profiling'.
    await setSystemState("profiling");

    // Clear any old profiling progress data.
    await clearProfilingProgress();

    // Ensure the lockdown is active for the new profiling session.
    isProfilingUnlocked = false;

    // Update the popup to the normal UI (it will show profiling progress).
    await updateActionPopup();

    // 5. DO NOT open onboarding.html. Instead, broadcast the lockdown command
    // to all open tabs, forcing the user to re-authenticate to begin profiling.
    await broadcastToTabs({
      action: "SHOW_OVERLAY",
      context: "profiling_lock",
    });
  } catch (error) {
    console.error("An error occurred during profile reset:", error);
    // Notify the user that the reset failed.
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "MaxiDOM Error",
      message:
        "Failed to reset your profile. Please check the console for details.",
    });
  }
}
// Initial check when the service worker starts
updateActionPopup();
