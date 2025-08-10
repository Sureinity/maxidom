/**
 * MaxiDOM Content Script
 *
 * This script is responsible for two main tasks:
 * 1. Forwarding raw user events to the service worker.
 * 2. Injecting and managing the UI overlay based on commands from the service worker.
 *
 * CHANGE: On initialization, this script now immediately sends a "CONTENT_SCRIPT_READY"
 * message to the service worker to check if it should display the overlay,
 * ensuring persistence across new tabs and navigations during a lockdown.
 */

//  Unique ID for the overlay to prevent multiple injections
const MAXIDOM_OVERLAY_ID = "maxidom-verification-overlay";

//  Function to create and inject the verification overlay
function showVerificationOverlay() {
  if (document.getElementById(MAXIDOM_OVERLAY_ID)) {
    return;
  }

  const overlay = document.createElement("div");
  overlay.id = MAXIDOM_OVERLAY_ID;
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.75)";
  overlay.style.zIndex = "2147483647";
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
  title.style.color = "#ff6b6b";

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
  verifyButton.style.background = "#61afef";
  verifyButton.style.color = "white";
  verifyButton.onclick = () => {
    chrome.runtime.sendMessage({ type: "VERIFY_BUTTON_CLICKED" });
  };

  modal.appendChild(title);
  modal.appendChild(message);
  modal.appendChild(verifyButton);
  overlay.appendChild(modal);

  document.body.appendChild(overlay);
}

//  Function to remove the overlay
function hideVerificationOverlay() {
  const overlay = document.getElementById(MAXIDOM_OVERLAY_ID);
  if (overlay) {
    overlay.remove();
  }
}

//  Listener for LIVE commands from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SHOW_OVERLAY") {
    showVerificationOverlay();
  } else if (message.action === "HIDE_OVERLAY") {
    hideVerificationOverlay();
  }
});

// Announce readiness to the service worker on script load to ensure persistence on new tabs
chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" });

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

document.addEventListener(
  "keydown",
  (event) => {
    if (event.repeat) return;
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

document.addEventListener(
  "wheel",
  () => {
    chrome.runtime.sendMessage({ type: "HEARTBEAT" });
  },
  { passive: true, capture: true },
);
