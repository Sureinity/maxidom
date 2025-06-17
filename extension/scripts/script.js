let eventBuffer = [];
let hasMoved = false;
const timer = 5000;

// Mouse movement
document.addEventListener("mousemove", (event) => {
  const { clientX: x, clientY: y } = event;
  const timestamp = Date.now();

  eventBuffer.push({ x, y, timestamp });
  hasMoved = true;
});

setInterval(() => {
  if (hasMoved && eventBuffer.length > 0) {
    chrome.runtime.sendMessage({
      type: "MOUSE_DATA",
      payload: eventBuffer,
    });
  }

  eventBuffer = []; // clear buffer after sending
  hasMoved = false;
}, timer);
