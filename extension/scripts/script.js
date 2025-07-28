/**
 * This content script's ONLY responsibility is to capture raw user events
 * and forward them immediately to the service worker. It holds no state,
 * performs no aggregation, and has no timers.
 */

// Event Forwarders

// Mouse Movement
document.addEventListener("mousemove", (event) => {
  chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
          eventType: "mousemove",
          t: event.timeStamp,
          x: event.clientX,
          y: event.clientY,
      },
  });
}, true);

// Keyboard Input
document.addEventListener("keydown", (event) => {
  if (event.repeat) return; // Ignore key-hold repeats
  chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
          eventType: "keydown",
          t: event.timeStamp,
          code: event.code,
      },
  });
}, true);

document.addEventListener("keyup", (event) => {
  chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
          eventType: "keyup",
          t: event.timeStamp,
          code: event.code,
      },
  });
}, true);

// Mouse Clicks
document.addEventListener("mousedown", (event) => {
  chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
          eventType: "mousedown",
          t: event.timeStamp,
          x: event.clientX,
          y: event.clientY,
          button: event.button,
      },
  });
}, true);

document.addEventListener("mouseup", (event) => {
  chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
          eventType: "mouseup",
          t: event.timeStamp,
          x: event.clientX,
          y: event.clientY,
          button: event.button,
      },
  });
}, true);

// Scroll Behavior
document.addEventListener("wheel", (event) => {
  chrome.runtime.sendMessage({
      type: "RAW_EVENT",
      payload: {
          eventType: "wheel",
          t: event.timeStamp,
          dy: event.deltaY,
      },
  });
}, { passive: true, capture: true });

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