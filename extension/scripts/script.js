/**
 * MaxiDOM Content Script
 *
 * This script is responsible for two main tasks:
 * 1. Forwarding raw user events to the service worker.
 * 2. Injecting and managing the UI overlay, including suppressing all
 *    keyboard and scroll interaction with the underlying page during a lockdown.
 */

//  Unique ID for the overlay to prevent multiple injections
const MAXIDOM_OVERLAY_ID = "maxidom-verification-overlay";

let wheelListener = null;
let keydownListener = null;

//  Function to create and inject the verification overlay with contextual messages
function showVerificationOverlay(context) {
  if (document.getElementById(MAXIDOM_OVERLAY_ID)) {
    return;
  }

  // Define messages based on the context provided by the service worker
  const messages = {
    anomaly: {
      title: "Unusual Activity Detected",
      message: "For your security, please verify your identity to continue.",
    },
    profiling_lock: {
      title: "Session Locked",
      message:
        "Please enter your password to begin or resume your secure profiling session.",
    },
  };

  // Default to the 'anomaly' message if context is unknown
  const displayMessages = messages[context] || messages["anomaly"];

  // Create overlay elements
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
  overlay.style.backdropFilter = "blur(8px)";
  overlay.style.webkitBackdropFilter = "blur(8px)";

  const modal = document.createElement("div");
  modal.style.textAlign = "center";
  modal.style.padding = "40px";
  modal.style.background = "#282c34";
  modal.style.borderRadius = "8px";
  modal.style.boxShadow = "0 5px 15px rgba(0,0,0,0.5)";

  const title = document.createElement("h2");
  title.textContent = displayMessages.title;
  title.style.margin = "0 0 15px 0";
  title.style.color = "#ff6b6b";

  const message = document.createElement("p");
  message.textContent = displayMessages.message;
  message.style.margin = "0 0 25px 0";
  message.style.maxWidth = "300px";

  // Create the form for password input
  const form = document.createElement("form");
  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.id = "maxidom-password-input";
  passwordInput.placeholder = "Enter your password";
  passwordInput.style.width = "100%";
  passwordInput.style.padding = "10px";
  passwordInput.style.fontSize = "16px";
  passwordInput.style.borderRadius = "4px";
  passwordInput.style.border = "1px solid #3b4048";
  passwordInput.style.backgroundColor = "#282c34";
  passwordInput.style.color = "#abb2bf";
  passwordInput.style.boxSizing = "border-box";
  passwordInput.style.marginBottom = "15px";

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "Verify";
  submitButton.style.width = "100%";
  submitButton.style.padding = "12px 24px";
  submitButton.style.fontSize = "16px";
  submitButton.style.cursor = "pointer";
  submitButton.style.border = "none";
  submitButton.style.borderRadius = "4px";
  submitButton.style.background = "#61afef";
  submitButton.style.color = "white";

  const errorArea = document.createElement("div");
  errorArea.style.color = "#e06c75";
  errorArea.style.marginTop = "10px";
  errorArea.style.height = "20px";
  errorArea.style.fontSize = "14px";

  form.appendChild(passwordInput);
  form.appendChild(submitButton);

  form.onsubmit = (event) => {
    event.preventDefault();
    const password = passwordInput.value;
    if (password) {
      submitButton.disabled = true;
      submitButton.textContent = "Verifying...";
      chrome.runtime.sendMessage({
        type: "PASSWORD_SUBMITTED",
        password: password,
      });
    }
  };

  modal.appendChild(title);
  modal.appendChild(message);
  modal.appendChild(form);
  modal.appendChild(errorArea);
  overlay.appendChild(modal);

  document.body.appendChild(overlay);
  passwordInput.focus();

  keydownListener = (event) => {
    if (event.target.id === "maxidom-password-input") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  window.addEventListener("keydown", keydownListener, { capture: true });

  wheelListener = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  };
  window.addEventListener("wheel", wheelListener, {
    capture: true,
    passive: false,
  });
}

//  Function to remove the overlay and the keyboard listener
function hideVerificationOverlay() {
  const overlay = document.getElementById(MAXIDOM_OVERLAY_ID);
  if (overlay) {
    overlay.remove();
  }
  if (keydownListener) {
    window.removeEventListener("keydown", keydownListener, { capture: true });
    keydownListener = null;
  }
  if (wheelListener) {
    window.removeEventListener("wheel", wheelListener, { capture: true });
    wheelListener = null;
  }
}

//  Function to show an error message within the overlay
function showVerificationError(errorMessage) {
  const overlay = document.getElementById(MAXIDOM_OVERLAY_ID);
  if (overlay) {
    const errorArea = overlay.querySelector('div[style*="color: #e06c75"]');
    const submitButton = overlay.querySelector('button[type="submit"]');
    if (errorArea) {
      errorArea.textContent = errorMessage;
    }
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Verify";
    }
  }
}

//  Listener for commands from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "SHOW_OVERLAY") {
    showVerificationOverlay(message.context);
  } else if (message.action === "HIDE_OVERLAY") {
    hideVerificationOverlay();
  } else if (message.action === "SHOW_VERIFICATION_ERROR") {
    showVerificationError(message.error);
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
      payload: { eventType: "keydown", t: performance.now(), code: event.code },
    });
  },
  true,
);

document.addEventListener(
  "keyup",
  (event) => {
    chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: { eventType: "keyup", t: performance.now(), code: event.code },
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

// This listener sends a specific event when the window loses focus.
window.addEventListener("blur", () => {
  chrome.runtime.sendMessage({
    type: "BLUR_EVENT",
  });
});

document.addEventListener(
  "wheel",
  () => {
    chrome.runtime.sendMessage({ type: "HEARTBEAT" });
  },
  { passive: true, capture: true },
);
