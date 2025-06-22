// --- STATE MANAGEMENT ---
// This object holds the structured data for the current session window.
// It will be sent to the backend and then reset.
let sessionData = {};
// A timeout to detect when a mouse path has ended (i.e., the user paused).
let mouseMoveTimeout = null;
// A map to temporarily store keydown times to calculate dwell time later.
let keyDownMap = new Map();
// A variable to store mousedown event data to link with mouseup.
let mousedownEvent = null;

// The interval (in ms) for sending data to the backend.
const SEND_INTERVAL_MS = 5000;
// The duration (in ms) of a mouse pause that signifies the end of a path.
const MOUSE_PAUSE_THRESHOLD_MS = 200;

// Function to reset the session data after it has been sent.
function resetSessionData() {
  sessionData = {
    startTimestamp: null,
    endTimestamp: null,
    windowSize: { width: window.innerWidth, height: window.innerHeight },
    keyEvents: [],
    mousePaths: [],
    clicks: [],
    scrollEvents: [],
    focusChanges: [],
  };
  // Also clear temporary state holders
  keyDownMap.clear();
  mousedownEvent = null;
}
resetSessionData(); // Initialize for the first time

// Helper to set start timestamp on the very first event of a session.
function checkAndSetStartTimestamp(timestamp) {
  if (!sessionData.startTimestamp) {
    sessionData.startTimestamp = timestamp;
  }
}

// --- EVENT LISTENERS ---

// 1. Mouse Movement: Group continuous moves into "paths".
document.addEventListener(
  "mousemove",
  (event) => {
    checkAndSetStartTimestamp(event.timeStamp);

    // A new mouse path is starting.
    if (!sessionData.currentMousePath) {
      sessionData.currentMousePath = [];
    }

    sessionData.currentMousePath.push({
      t: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
    });

    // If the mouse stops moving for a moment, we'll consider the path finished.
    clearTimeout(mouseMoveTimeout);
    mouseMoveTimeout = setTimeout(() => {
      if (
        sessionData.currentMousePath &&
        sessionData.currentMousePath.length > 0
      ) {
        sessionData.mousePaths.push(sessionData.currentMousePath);
        delete sessionData.currentMousePath; // Remove the temporary path
      }
    }, MOUSE_PAUSE_THRESHOLD_MS);
  },
  true,
);

// 2. Keyboard Input: Combine keydown and keyup into a single event.
document.addEventListener(
  "keydown",
  (event) => {
    // Ignore repeated events from holding a key down.
    if (event.repeat) return;
    checkAndSetStartTimestamp(event.timeStamp);
    keyDownMap.set(event.code, event.timeStamp);
  },
  true,
);

document.addEventListener(
  "keyup",
  (event) => {
    checkAndSetStartTimestamp(event.timeStamp);
    const downTime = keyDownMap.get(event.code);

    if (downTime) {
      sessionData.keyEvents.push({
        code: event.code,
        downTime: downTime,
        upTime: event.timeStamp,
      });
      keyDownMap.delete(event.code); // Clean up the map
    }
  },
  true,
);

// 3. Mouse Clicks: Combine mousedown and mouseup into a single event with duration.
document.addEventListener(
  "mousedown",
  (event) => {
    checkAndSetStartTimestamp(event.timeStamp);
    mousedownEvent = {
      t: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
      button: event.button,
    };
  },
  true,
);

document.addEventListener(
  "mouseup",
  (event) => {
    checkAndSetStartTimestamp(event.timeStamp);
    if (mousedownEvent) {
      sessionData.clicks.push({
        t: mousedownEvent.t,
        x: mousedownEvent.x,
        y: mousedownEvent.y,
        button: mousedownEvent.button,
        duration: event.timeStamp - mousedownEvent.t,
      });
      mousedownEvent = null; // Reset for the next click
    }
  },
  true,
);

// 4. Scroll Behavior
document.addEventListener(
  "wheel",
  (event) => {
    checkAndSetStartTimestamp(event.timeStamp);
    sessionData.scrollEvents.push({
      t: event.timeStamp,
      dy: event.deltaY,
    });
  },
  { passive: true, capture: true },
);

// 5. Window Focus/Blur
window.addEventListener("focus", () => {
  checkAndSetStartTimestamp(performance.now()); // event.timeStamp is not available here
  sessionData.focusChanges.push({ type: "focus", t: performance.now() });
});
window.addEventListener("blur", () => {
  checkAndSetStartTimestamp(performance.now());
  sessionData.focusChanges.push({ type: "blur", t: performance.now() });
});

// 6. Window Resize
window.addEventListener("resize", () => {
  // We only need the latest window size for context, so we just update it.
  sessionData.windowSize = {
    width: window.innerWidth,
    height: window.innerHeight,
  };
});

// --- PERIODIC DATA SEND ---
setInterval(() => {
  // Only send data if there was any activity in this interval.
  if (sessionData.startTimestamp) {
    // Set the end timestamp for this session window
    sessionData.endTimestamp = performance.now();

    // Ensure any final mouse path is captured before sending
    if (
      sessionData.currentMousePath &&
      sessionData.currentMousePath.length > 0
    ) {
      sessionData.mousePaths.push(sessionData.currentMousePath);
      delete sessionData.currentMousePath;
    }

    console.log("Sending aggregated data:", sessionData);

    // Send the structured data to the background script
    chrome.runtime.sendMessage({
      type: "AGGREGATED_USER_EVENTS",
      payload: sessionData,
    });

    // Reset the data object for the next interval
    resetSessionData();
  }
}, SEND_INTERVAL_MS);
