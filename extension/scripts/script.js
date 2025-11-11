/**
 * MaxiDOM Content Script (Revised)
 *
 * This script handles:
 * 1. Forwarding raw user events to the service worker.
 * 2. Injecting and managing a consistent, isolated verification overlay.
 */

//  Unique ID for the overlay to prevent multiple injections
const MAXIDOM_OVERLAY_ID = "maxidom-verification-overlay";

let wheelListener = null;
let keydownListener = null;

/**
 * Displays a verification overlay with pixel-perfect styling
 * and consistent rendering across all sites.
 */
function showVerificationOverlay(context) {
  if (document.getElementById(MAXIDOM_OVERLAY_ID)) return;

  // Inject Tailwind & DaisyUI only once for theme support
  if (!document.querySelector('link[href*="tailwindcss"]')) {
    const tailwindLink = document.createElement("link");
    tailwindLink.rel = "stylesheet";
    tailwindLink.href =
      "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css";
    document.head.appendChild(tailwindLink);
  }

  if (!document.querySelector('link[href*="daisyui"]')) {
    const daisyLink = document.createElement("link");
    daisyLink.rel = "stylesheet";
    daisyLink.href =
      "https://cdn.jsdelivr.net/npm/daisyui@4.12.10/dist/full.min.css";
    document.head.appendChild(daisyLink);
  }

  document.documentElement.setAttribute("data-theme", "dark");
  
  const style = document.createElement("style");
  style.textContent = `
    #${MAXIDOM_OVERLAY_ID}, 
    #${MAXIDOM_OVERLAY_ID} * {
      all: unset !important;
      box-sizing: border-box !important;
      font-family: 'Inter', 'Plus Jakarta Sans', sans-serif !important;
    }

    #${MAXIDOM_OVERLAY_ID} {
      position: fixed !important;
      inset: 0 !important;
      display: flex !important;
      justify-content: center !important;
      align-items: center !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 999999999 !important;
      background-color: rgba(15, 15, 20, 0.75) !important;
      backdrop-filter: blur(20px) !important;
      -webkit-backdrop-filter: blur(20px) !important;
    }

    #${MAXIDOM_OVERLAY_ID} .card {
      width: 420px !important;
      background-color: #0b0f18 !important;
      border-radius: 14px !important;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4) !important;
      overflow: hidden !important;
    }

    #${MAXIDOM_OVERLAY_ID} .card-body {
      padding: 28px !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 8px !important;
    }

    #${MAXIDOM_OVERLAY_ID} p.title {
      font-size: 18px !important;
      font-weight: 700 !important;
      color: #ef4444 !important;
      text-align: center !important;
      margin-bottom: 8px !important;
    }

    #${MAXIDOM_OVERLAY_ID} p.message {
      font-size: 14px !important;
      color: #9ca3af !important;
      text-align: center !important;
      margin-bottom: 24px !important;
    }

    #${MAXIDOM_OVERLAY_ID} input {
      width: 100% !important;
      padding: 10px 10px !important;
      border-radius: 10px !important;
      border: 1px solid #475162ff !important;
      background: #111827 !important;
      color: #fff !important;
      font-size: 14px !important;
    }

    #${MAXIDOM_OVERLAY_ID} button {
      background: #2563eb !important;
      color: white !important;
      border: none !important;
      border-radius: 10px !important;
      padding: 10px !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      margin-top: 16px !important;
      text-align: center !important;
    }

    #${MAXIDOM_OVERLAY_ID} button:hover {
      background: #1d4ed8 !important;
    }

    #${MAXIDOM_OVERLAY_ID} .error {
      font-size: 13px !important;
      color: #dc2626 !important;
      text-align: center !important;
      min-height: 16px !important;
      margin-top: 6px !important;
    }
  `;
  document.head.appendChild(style);

  // Context messages
  const messages = {
    anomaly: {
      title: "Unusual Activity Detected",
      message: "For your security, please verify your identity to continue.",
    },
    profiling_lock: {
      title: "Session Locked",
      message:
        "Please enter your password to begin or resume your secure session.",
    },
  };
  const display = messages[context] || messages.anomaly;

  // Build overlay
  const overlay = document.createElement("div");
  overlay.id = MAXIDOM_OVERLAY_ID;

  const modal = document.createElement("div");
  modal.className = "card";

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("p");
  title.textContent = display.title;
  title.className = "title";

  const message = document.createElement("p");
  message.textContent = display.message;
  message.className = "message";

  const input = document.createElement("input");
  input.type = "password";
  input.placeholder = "Enter your password";
  input.id = "maxidom-password-input";
  input.required = true;

  const btn = document.createElement("button");
  btn.textContent = "Verify";

  const error = document.createElement("div");
  error.className = "error";
  error.id = "maxidom-error-area";

  // Form behavior
  btn.onclick = (event) => {
    event.preventDefault();
    const password = input.value.trim();
    if (password) {
      btn.disabled = true;
      btn.textContent = "Verifying...";
      chrome.runtime.sendMessage({
        type: "PASSWORD_SUBMITTED",
        password: password,
      });
    }
  };

  body.append(title, message, input, btn, error);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  input.focus();

  // Disable page interactions
  keydownListener = (event) => {
    if (event.target.id === "maxidom-password-input") return;
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
  window.addEventListener("wheel", wheelListener, { capture: true, passive: false });
}

/** Removes the overlay and re-enables interactions. */
function hideVerificationOverlay() {
  const overlay = document.getElementById(MAXIDOM_OVERLAY_ID);
  if (overlay) overlay.remove();

  if (keydownListener) {
    window.removeEventListener("keydown", keydownListener, { capture: true });
    keydownListener = null;
  }
  if (wheelListener) {
    window.removeEventListener("wheel", wheelListener, { capture: true });
    wheelListener = null;
  }
}

/** Displays an error message in the overlay. */
function showVerificationError(errorMessage) {
  const overlay = document.getElementById(MAXIDOM_OVERLAY_ID);
  if (overlay) {
    const errorArea = overlay.querySelector("#maxidom-error-area");
    const submitButton = overlay.querySelector("button");
    if (errorArea) errorArea.textContent = errorMessage;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Verify";
    }
  }
}

/** Handle messages from the service worker. */
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "SHOW_OVERLAY") {
    showVerificationOverlay(message.context);
  } else if (message.action === "HIDE_OVERLAY") {
    hideVerificationOverlay();
  } else if (message.action === "SHOW_VERIFICATION_ERROR") {
    showVerificationError(message.error);
  }
});

// Announce readiness
chrome.runtime.sendMessage({ type: "CONTENT_SCRIPT_READY" });

// Capture user input events
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
  true
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
  true
);

document.addEventListener(
  "keyup",
  (event) => {
    chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: { eventType: "keyup", t: performance.now(), code: event.code },
    });
  },
  true
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
  true
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
  true
);

// Blur and heartbeat tracking
window.addEventListener("blur", () => {
  chrome.runtime.sendMessage({
    type: "BLUR_EVENT",
    payload: { t: performance.now() },
  });
});

document.addEventListener(
  "wheel",
  () => {
    chrome.runtime.sendMessage({ type: "HEARTBEAT" });
  },
  { passive: true, capture: true }
);
