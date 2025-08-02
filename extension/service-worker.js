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
  if (!sessionData.startTimestamp) {
    return; // Nothing to send
  }

  // Prevent multiple overlapping triggers
  if (inactivityTimeout) clearTimeout(inactivityTimeout);
  inactivityTimeout = null;

  sessionData.endTimestamp = performance.now();

  // Finalize any pending mouse path before sending
  if (sessionData.currentMousePath && sessionData.currentMousePath.length > 0) {
    sessionData.mousePaths.push([...sessionData.currentMousePath]);
    delete sessionData.currentMousePath;
  }

  // Noise reduction: Ensure the session has meaningful biometric data
  const totalMeaningfulEvents =
    sessionData.keyEvents.length +
    sessionData.clicks.length +
    sessionData.mousePaths.length;
  if (totalMeaningfulEvents < MINIMUM_EVENTS_THRESHOLD) {
    console.log(
      `Session ended with only ${totalMeaningfulEvents} meaningful events. Discarding as noise.`,
    );
    resetSessionData();
    return;
  }

  console.log(
    "Session finalized. Preparing to send aggregated data:",
    sessionData,
  );

  try {
    await handleDataPayload(sessionData);
  } catch (error) {
    console.error("Failed to handle data payload:", error);
  } finally {
    // IMPORTANT: Reset for the next session regardless of success or failure
    resetSessionData();
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "RAW_EVENT") {
    handleRawEvent(message.payload);
  } else if (message.type === "HEARTBEAT") {
    handleHeartbeat();
  } else if (message.type === "REQUEST_PROFILING_STATUS") {
    handleProfilingStatusRequest(sendResponse);
    return true; // Indicates an asynchronous response will be sent
  }
});

// Event Handlers
function handleHeartbeat() {
  // A heartbeat signifies user activity (like scrolling).
  // Start the session timer if it hasn't started yet.
  checkAndSetStartTimestamp(performance.now());

  // Reset the inactivity timer to keep the session alive.
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

  // For every event, reset the inactivity timer. This is the core of the session model.
  clearTimeout(inactivityTimeout);
  inactivityTimeout = setTimeout(finalizeAndSendSession, INACTIVITY_TIMEOUT_MS);

  // Check safety nets
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
    finalizeAndSendSession().then(() => {
      // After finalizing, re-process the current event for the *new* session
      handleRawEvent(event);
    });
    return; // Stop processing in the current (now finalized) session
  }

  switch (event.eventType) {
    case "mousemove":
      if (!sessionData.currentMousePath) sessionData.currentMousePath = [];
      sessionData.currentMousePath.push({ t: event.t, x: event.x, y: event.y });
      // Debounce mouse path finalization
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
        // Prevent overwriting if keyup is missed
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
    // NOTE: 'wheel' is handled by the HEARTBEAT and has no data to aggregate here.
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
      console.warn("⚠️ ANOMALY DETECTED!", data);
      // TODO: Initiate the password prompt flow here
    } else {
      console.log("Normal behavior detected.", data);
    }
  } catch (error) {
    console.error("Error during detection data submission:", error);
  }
}

