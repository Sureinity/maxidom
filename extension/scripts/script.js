/**
 * MaxiDOM Content Script (Hardened)
 *
 * This script handles:
 * 1. Forwarding raw user events to the service worker.
 * 2. Injecting a tamper-resistant verification overlay.
 * 3. Aggressively blocking ALL interaction with the underlying page during lockdown.
 */

const MAXIDOM_OVERLAY_ID = "maxidom-verification-overlay";

// State tracking
let isSessionLocked = false;
let currentLockContext = "anomaly"; // Default context
let overlayObserver = null;
let restoreBodyOverflow = ""; // To store original body style

/**
 * This function intercepts all user events during a lock.
 * It runs on the 'window' object in the capture phase.
 * Even if the overlay HTML is deleted, this function KEEPS RUNNING.
 */
function interactionEnforcer(event) {
  if (!isSessionLocked) return;

  // ALLOW interaction only if it originates from INSIDE our overlay
  const target = event.target;
  // We check if the target is part of our overlay structure
  const isInternal =
    target && target.closest && target.closest(`#${MAXIDOM_OVERLAY_ID}`);

  if (isInternal) {
    // Allow the event to pass through to our password input/button
    return;
  }

  // BLOCK everything else
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

/**
 * Monitors the DOM. If the user tries to delete the overlay via DevTools
 * while the session is locked, this immediately puts it back.
 */
function startTamperProtection() {
  if (overlayObserver) return; // Already watching

  overlayObserver = new MutationObserver((mutations) => {
    if (!isSessionLocked) return;

    const overlay = document.getElementById(MAXIDOM_OVERLAY_ID);
    if (!overlay) {
      console.warn("MaxiDOM: Overlay tampering detected. Respawning...");
      showVerificationOverlay(currentLockContext);
    }
  });

  overlayObserver.observe(document.body, { childList: true, subtree: false });
}

function stopTamperProtection() {
  if (overlayObserver) {
    overlayObserver.disconnect();
    overlayObserver = null;
  }
}

/**
 * Displays the verification overlay and engages lock.
 */
function showVerificationOverlay(context) {
  isSessionLocked = true;
  currentLockContext = context;

  // 1. Engage The Enforcer (Aggressive Input Blocking)
  // We listen to every possible interaction event in the capture phase (true)
  const eventsToBlock = [
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "contextmenu",
    "keydown",
    "keyup",
    "keypress",
    "wheel",
    "touchmove",
    "touchstart",
    "touchend",
  ];

  eventsToBlock.forEach((evt) => {
    window.addEventListener(evt, interactionEnforcer, {
      capture: true,
      passive: false,
    });
  });

  // 2. Visual Lockdown (Remove Scrollbars)
  if (document.body.style.overflow !== "hidden") {
    restoreBodyOverflow = document.body.style.overflow;
    document.body.style.setProperty("overflow", "hidden", "important");
  }

  // 3. Render the UI (If it doesn't exist)
  if (document.getElementById(MAXIDOM_OVERLAY_ID)) return;

  // CSS Injection
  const styleId = MAXIDOM_OVERLAY_ID + "-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
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
        z-index: 2147483647 !important; /* Max Z-Index */
        background-color: rgba(15, 15, 20, 0.85) !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        cursor: default !important;
      }
      #${MAXIDOM_OVERLAY_ID} .card {
        width: 420px !important;
        background-color: #0b0f18 !important;
        border-radius: 14px !important;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6) !important;
        border: 1px solid #1f2937 !important;
        overflow: hidden !important;
        animation: fadeIn 0.2s ease-out !important;
      }
      #${MAXIDOM_OVERLAY_ID} .card-body {
        padding: 32px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 12px !important;
      }
      #${MAXIDOM_OVERLAY_ID} p.title {
        font-size: 20px !important;
        font-weight: 700 !important;
        color: #f87171 !important;
        text-align: center !important;
        margin-bottom: 4px !important;
      }
      #${MAXIDOM_OVERLAY_ID} p.message {
        font-size: 14px !important;
        color: #9ca3af !important;
        text-align: center !important;
        margin-bottom: 24px !important;
        line-height: 1.5 !important;
      }
      #${MAXIDOM_OVERLAY_ID} input {
        width: 100% !important;
        padding: 12px 14px !important;
        border-radius: 8px !important;
        border: 1px solid #374151 !important;
        background: #111827 !important;
        color: #fff !important;
        font-size: 15px !important;
        outline: none !important;
        transition: border-color 0.2s !important;
      }
      #${MAXIDOM_OVERLAY_ID} input:focus {
        border-color: #3b82f6 !important;
      }
      #${MAXIDOM_OVERLAY_ID} button {
        background: #2563eb !important;
        color: white !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 12px !important;
        font-size: 15px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        margin-top: 12px !important;
        text-align: center !important;
        transition: background 0.2s !important;
      }
      #${MAXIDOM_OVERLAY_ID} button:hover {
        background: #1d4ed8 !important;
      }
      #${MAXIDOM_OVERLAY_ID} button:disabled {
        background: #1e3a8a !important;
        color: #60a5fa !important;
        cursor: not-allowed !important;
      }
      #${MAXIDOM_OVERLAY_ID} .error {
        font-size: 13px !important;
        color: #ef4444 !important;
        text-align: center !important;
        min-height: 20px !important;
        margin-top: 8px !important;
        font-weight: 500 !important;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  // Messages
  const messages = {
    anomaly: {
      title: "Security Alert",
      message:
        "Unusual behavior detected. For your security, interaction with this page is suspended until you verify your identity.",
    },
    profiling_lock: {
      title: "Session Locked",
      message:
        "Secure Profiling Mode is active. Please enter your password to unlock the browser session.",
    },
  };
  const display = messages[context] || messages.anomaly;

  // DOM Construction
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
  input.autocomplete = "off"; // Prevent browser autocomplete interference
  input.required = true;

  const btn = document.createElement("button");
  btn.textContent = "Unlock Session";

  const error = document.createElement("div");
  error.className = "error";
  error.id = "maxidom-error-area";

  // Password prompt logic
  const submitPassword = () => {
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

  btn.onclick = (e) => {
    e.preventDefault();
    submitPassword();
  };

  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitPassword();
    }
    // Important: Don't let backspace/etc bubble up to the blocker
    e.stopPropagation();
  };

  body.append(title, message, input, btn, error);
  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Force focus to input
  setTimeout(() => input.focus(), 50);

  // 4. Start Tamper Protection (The Zombie Logic)
  startTamperProtection();
}

/** Removes the overlay and re-enables interactions. */
function hideVerificationOverlay() {
  isSessionLocked = false;
  currentLockContext = null;

  // 1. Remove The Enforcer
  const eventsToBlock = [
    "mousedown",
    "mouseup",
    "click",
    "dblclick",
    "contextmenu",
    "keydown",
    "keyup",
    "keypress",
    "wheel",
    "touchmove",
    "touchstart",
    "touchend",
  ];
  eventsToBlock.forEach((evt) => {
    window.removeEventListener(evt, interactionEnforcer, {
      capture: true,
      passive: false,
    });
  });

  // 2. Stop Tamper Protection
  stopTamperProtection();

  // 3. Restore Scrollbars
  document.body.style.overflow = restoreBodyOverflow;

  // 4. Remove UI
  const overlay = document.getElementById(MAXIDOM_OVERLAY_ID);
  if (overlay) overlay.remove();
}

/** Displays an error message in the overlay. */
function showVerificationError(errorMessage) {
  const overlay = document.getElementById(MAXIDOM_OVERLAY_ID);
  if (overlay) {
    const errorArea = overlay.querySelector("#maxidom-error-area");
    const submitButton = overlay.querySelector("button");
    const input = overlay.querySelector("input");

    if (errorArea) {
      errorArea.textContent = errorMessage;
      // Visual shake effect for feedback
      errorArea.style.animation = "none";
      errorArea.offsetHeight; /* trigger reflow */
      errorArea.style.animation = "fadeIn 0.2s";
    }

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Unlock Session";
    }
    if (input) {
      input.value = "";
      input.focus();
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

// --- DATA COLLECTION (Only runs when NOT locked) ---

function isSafeToCollect() {
  return !isSessionLocked;
}

document.addEventListener(
  "mousemove",
  (event) => {
    if (!isSafeToCollect()) return;
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
    if (!isSafeToCollect()) return;
    if (event.target && event.target.type === "password") return;

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
    if (!isSafeToCollect()) return;
    if (event.target && event.target.type === "password") return;

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
    if (!isSafeToCollect()) return;
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
    if (!isSafeToCollect()) return;
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

// Blur and heartbeat tracking
window.addEventListener("blur", () => {
  if (!isSafeToCollect()) return;
  chrome.runtime.sendMessage({
    type: "BLUR_EVENT",
    payload: { t: performance.now() },
  });
});

document.addEventListener(
  "wheel",
  () => {
    if (!isSafeToCollect()) return;
    chrome.runtime.sendMessage({ type: "HEARTBEAT" });
  },
  { passive: true, capture: true },
);
