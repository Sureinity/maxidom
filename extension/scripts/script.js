let eventBuffer = [];
const timer = 5000;

// Mouse movement
document.addEventListener("mousemove", (event) => {
  const { clientX: x, clientY: y } = event;
  eventBuffer.push({
    type: "mouse",
    x,
    y,
    timestamp: Date.now(),
  });
});

//  Keyboard input
document.addEventListener("keydown", (event) => {
  eventBuffer.push({
    type: "keyboard",
    key: event.key,
    code: event.code,
    timestamp: Date.now(),
  });
});

//  Scroll
document.addEventListener("scroll", () => {
  eventBuffer.push({
    type: "scroll",
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    timestamp: Date.now(),
  });
});

//  Window resize
window.addEventListener("resize", () => {
  eventBuffer.push({
    type: "resize",
    width: window.innerWidth,
    height: window.innerHeight,
    timestamp: Date.now(),
  });
});

//  Periodic sending
setInterval(() => {
  if (eventBuffer.length > 0) {
    chrome.runtime.sendMessage({
      type: "USER_EVENTS",
      payload: eventBuffer,
    });

    eventBuffer = []; // Clear buffer after sending
  }
}, timer);
