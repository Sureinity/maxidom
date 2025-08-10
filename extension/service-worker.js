import {
  ENDPOINTS,
  getProfileUUID,
  getSystemState,
  setSystemState,
  setProfilingProgress,
} from "./utils/helpers.js";

// Hybrid Model Constants
// A session is a burst of user activity.
const INACTIVITY_TIMEOUT_MS = 5000; // Primary trigger: End session after 5s of no activity.
const MAX_SESSION_DURATION_MS = 90000; // Safety Net 1: Force end session after 90s.
const MAX_EVENT_COUNT = 2000; // Safety Net 2: Force end session after 2000 events.
const MINIMUM_EVENTS_THRESHOLD = 20; // Noise Reduction: Discard sessions with too few meaningful events.

// Global State
let sessionData = {};
let inactivityTimeout = null;
let mouseMoveTimeout = null;
let keyDownMap = new Map();
let mousedownEvent = null;

// New state lock to prevent race conditions during session finalization.
let isFinalizing = false;

// Core Session Management Functions
function resetSessionData() {
  clearTimeout(inactivityTimeout);
  inactivityTimeout = null;

  sessionData = {
    startTimestamp: null,
    endTimestamp: null,
    windowSize: { width: 0, height: 0 },
    keyEvents: [],
    mousePaths: [],
    clicks: [],
    focusChanges: [],
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

  // Set the lock to prevent new events from being processed.
  isFinalizing = true;

  if (inactivityTimeout) clearTimeout(inactivityTimeout);
  inactivityTimeout = null;

  sessionData.endTimestamp = performance.now();

  // Finalize any pending mouse path before sending.
  if (sessionData.currentMousePath && sessionData.currentMousePath.length > 0) {
    sessionData.mousePaths.push([...sessionData.currentMousePath]);
    delete sessionData.currentMousePath;
  }

  // Noise reduction: Ensure the session has meaningful biometric data.
  const totalMeaningfulEvents =
    sessionData.keyEvents.length +
    sessionData.clicks.length +
    sessionData.mousePaths.length;
  if (totalMeaningfulEvents < MINIMUM_EVENTS_THRESHOLD) {
    console.log(
      `Session ended with only ${totalMeaningfulEvents} meaningful events. Discarding as noise.`,
    );
    resetSessionData();
    // Release the lock before returning.
    isFinalizing = false;
    return;
  }

  const dataToSend = JSON.parse(JSON.stringify(sessionData));

  // Reset the global session immediately.
  resetSessionData();

  console.log(
    "Session finalized. Preparing to send aggregated data:",
    dataToSend,
  );

  try {
    await handleDataPayload(dataToSend);
  } catch (error) {
    console.error("Failed to handle data payload:", error);
  } finally {
    // IMPORTANT: Release the lock after the entire process is complete.
    isFinalizing = false;
  }
}

// Chrome Listeners
chrome.runtime.onInstalled.addListener(async () => {
  const existingUUID = await getProfileUUID();
  if (!existingUUID) {
    const newUUID = crypto.randomUUID();
    await chrome.storage.local.set({ profile_uuid: newUUID });
    await setSystemState("profiling");
    console.log(
      "New profile UUID created. System state set to profiling.",
      newUUID,
    );
  } else {
    console.log("Existing profile UUID confirmed:", existingUUID);
  }
});

// Central Message Listener: The router for all incoming data from content scripts
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  const currentState = await getSystemState();

  // If the system is in lockdown, it has a separate, focused set of listeners.
  if (currentState === "awaiting_verification") {
    if (message.type === "VERIFY_BUTTON_CLICKED") {
      console.log("Verification process initiated by user.");
      await setSystemState("detection");
      await broadcastToTabs({ action: "HIDE_OVERLAY" });
    }
    // New tabs will announce their readiness. Check if they need an overlay.
    if (message.type === "CONTENT_SCRIPT_READY") {
      await handleContentScriptReady(sender);
    }
    return; // Ignore all other messages during lockdown.
  }

  // If a session is currently being finalized, drop incoming events to prevent state corruption.
  if (isFinalizing) {
    return;
  }

  if (message.type === "RAW_EVENT") {
    handleRawEvent(message.payload);
  } else if (message.type === "HEARTBEAT") {
    handleHeartbeat();
  } else if (message.type === "REQUEST_PROFILING_STATUS") {
    handleProfilingStatusRequest(sendResponse);
    return true; // Indicates an asynchronous response will be sent
  } else if (message.type === "CONTENT_SCRIPT_READY") {
    // This handles the case where a tab loads when not in lockdown.
    await handleContentScriptReady(sender);
  }
});

// Event Handlers
async function broadcastToTabs(message) {
  // Query for all tabs across all normal windows.
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (error) {
      // This error is expected for tabs that don't have the content script injected (e.g., chrome:// pages).
      if (!error.message.includes("Receiving end does not exist")) {
        console.warn(
          `Could not send message to tab ${tab.id}: ${error.message}`,
        );
      }
    }
  }
}

// This function ensures new tabs respect the current global state (e.g., lockdown).
async function handleContentScriptReady(sender) {
  const currentState = await getSystemState();
  if (currentState === "awaiting_verification") {
    console.log(
      `New tab opened during lockdown (ID: ${sender.tab.id}). Injecting overlay.`,
    );
    // Command this newly loaded script to show the overlay immediately.
    try {
      await chrome.tabs.sendMessage(sender.tab.id, { action: "SHOW_OVERLAY" });
    } catch (error) {
      console.warn(
        `Failed to send initial overlay command to tab ${sender.tab.id}: ${error.message}`,
      );
    }
  }
}

function handleHeartbeat() {
  checkAndSetStartTimestamp(performance.now());
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
    case "focus":
    case "blur":
      sessionData.focusChanges.push({ type: event.eventType, t: event.t });
      break;
    case "resize":
      sessionData.windowSize = { width: event.width, height: event.height };
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
  } else {
    // Handle 'awaiting_verification' here to ensure no data is sent during lockdown
    if (state === "detection") {
      await handleDetection(ENDPOINTS.SCORE(uuid), payloadToSend, uuid);
    }
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
      await broadcastToTabs({ action: "SHOW_OVERLAY" });
    } else {
      console.log("Normal behavior detected.", data);
    }
  } catch (error) {
    console.error("Error during detection data submission:", error);
  }
}
