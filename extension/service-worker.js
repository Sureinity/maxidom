// This section ensures that browser profile has unique identity.
// The UUID is stored once and used to associate behavior profiling from the backend.
import { generateUUID } from "./utils/uuid.js";

const uuid = generateUUID();

chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get("profile_uuid", (result) => {
    if (!result.profile_uuid) {
      chrome.storage.local.set({ profile_uuid: uuid });
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const payload = JSON.stringify({
    UUID: uuid,
    data: message.payload,
  });

  console.log(
    "📬 Mouse data received from content script:",
    JSON.stringify({ data: payload }),
  );

  // Send to API
  fetch("http://127.0.0.1:8000/track-mouse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  })
    .then((response) => response.json())
    .then((data) => console.log("✅ FastAPI response:", data))
    .catch((error) => console.error("❌ Error sending mouse data:", error));
});
