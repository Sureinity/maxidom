/**
 * MaxiDOM Content Script
 *
 * This script is responsible for two main tasks:
 * 1. Forwarding raw user events to the service worker.
 * 2. Injecting and managing the UI overlay when an anomaly is detected.
 */

//  Unique ID for the overlay to prevent multiple injections
const MAXIDOM_OVERLAY_ID = "maxidom-verification-overlay";

//  Function to create and inject the verification overlay
function showVerificationOverlay() {
  // If the overlay already exists, do nothing.
  if (document.getElementById(MAXIDOM_OVERLAY_ID)) {
    return;
  }

  // Create the overlay elements
  const overlay = document.createElement("div");
  overlay.id = MAXIDOM_OVERLAY_ID;
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
  overlay.style.zIndex = "2147483647"; // Max z-index
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.color = "white";
  overlay.style.fontFamily = "sans-serif";

  const modal = document.createElement("div");
  modal.style.textAlign = "center";
  modal.style.padding = "40px";
  modal.style.background = "#282c34";
  modal.style.borderRadius = "8px";
  modal.style.boxShadow = "0 5px 15px rgba(0,0,0,0.5)";

  const title = document.createElement("h2");
  title.textContent = "Unusual Activity Detected";
  title.style.margin = "0 0 15px 0";
  title.style.color = "#ff6b6b"; // A warning color

  const message = document.createElement("p");
  message.textContent =
    "For your security, please verify your identity to continue.";
  message.style.margin = "0 0 25px 0";
  message.style.maxWidth = "300px";

  const verifyButton = document.createElement("button");
  verifyButton.textContent = "Verify Identity";
  verifyButton.style.padding = "12px 24px";
  verifyButton.style.fontSize = "16px";
  verifyButton.style.cursor = "pointer";
  verifyButton.style.border = "none";
  verifyButton.style.borderRadius = "4px";
  verifyButton.style.background = "#61afef"; // A friendly blue
  verifyButton.style.color = "white";
  verifyButton.onclick = () => {
    // When clicked, send a message to the service worker to handle the next step.
    chrome.runtime.sendMessage({ type: "VERIFY_BUTTON_CLICKED" });
  };

  modal.appendChild(title);
  modal.appendChild(message);
  modal.appendChild(verifyButton);
  overlay.appendChild(modal);

  // Append the overlay to the page body
  document.body.appendChild(overlay);
}

//  Function to remove the overlay
function hideVerificationOverlay() {
  const overlay = document.getElementById(MAXIDOM_OVERLAY_ID);
  if (overlay) {
    overlay.remove();
  }
}

//  Listener for commands from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SHOW_OVERLAY") {
    showVerificationOverlay();
  } else if (message.action === "HIDE_OVERLAY") {
    hideVerificationOverlay();
  }
});

// Mouse Movement
document.addEventListener(
  "mousemove",
  (event) => {
    chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
        eventType: "mousemove",
        t: performance.now(),
        x: event.clientX,
        y: event.clientY,
      },
    });
  },
  true,
);

// Keyboard Input
document.addEventListener(
  "keydown",
  (event) => {
    if (event.repeat) return; // Ignore key-hold repeats
    chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
        eventType: "keydown",
        t: performance.now(),
        code: event.code,
      },
    });
  },
  true,
);

document.addEventListener(
  "keyup",
  (event) => {
    chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
        eventType: "keyup",
        t: performance.now(),
        code: event.code,
      },
    });
  },
  true,
);

// Mouse Clicks
document.addEventListener(
  "mousedown",
  (event) => {
    chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
        eventType: "mousedown",
        t: performance.now(),
        x: event.clientX,
        y: event.clientY,
        button: event.button,
      },
    });
  },
  true,
);

document.addEventListener(
  "mouseup",
  (event) => {
    chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
        eventType: "mouseup",
        t: performance.now(),
        x: event.clientX,
        y: event.clientY,
        button: event.button,
      },
    });
  },
  true,
);

// Window Focus/Blur
window.addEventListener("focus", () => {
  chrome.runtime.sendMessage({
    type: "RAW_EVENT",
    payload: { eventType: "focus", t: performance.now() },
  });
});
window.addEventListener("blur", () => {
  chrome.runtime.sendMessage({
    type: "RAW_EVENT",
    payload: { eventType: "blur", t: performance.now() },
  });
});

// Window Resize
window.addEventListener("resize", () => {
  chrome.runtime.sendMessage({
    type: "RAW_EVENT",
    payload: {
      eventType: "resize",
      t: performance.now(),
      width: window.innerWidth,
      height: window.innerHeight,
    },
  });
});

// Heartbeat Listener for Activity Detection
// This listener's ONLY purpose is to tell the service worker that the user
// is active (e.g., reading an article and scrolling). It sends no scroll data.
document.addEventListener(
  "wheel",
  () => {
    chrome.runtime.sendMessage({ type: "HEARTBEAT" });
  },
  { passive: true, capture: true },
);
