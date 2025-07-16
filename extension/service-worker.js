import {
  getProfileUUID,
  getSystemState,
  getSampleCount,
  getModelStatus,
  updateSampleCount,
  updateModelStatus,
} from "./utils/helpers.js";

// 1. ON INSTALL: Generate and store a unique identifier for this browser profile.
// This runs only once when the extension is installed or updated.
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("--- Extension Installation/Update ---");
  // Check if a UUID already exists.
  const existingUUID = await getProfileUUID();
  if (!existingUUID) {
    // If not, generate a new one and store it.
    const newUUID = crypto.randomUUID();
    await chrome.storage.local.set({ profile_uuid: newUUID });
    console.log("New profile UUID created and stored:", newUUID);
  } else {
    console.log("Existing profile UUID confirmed:", existingUUID);
  }
  console.log("-------------------------------------");
});

// 2. ON MESSAGE: Listen for aggregated data from the content script.
// This is an async function to allow for `await`.
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "AGGREGATED_USER_EVENTS") {
    try {
      const uuid = await getProfileUUID();
      const state = await getSystemState();
      let endpoint = "";
      let response = null;

      const payload = {
        profile_id: uuid,
        ...message.payload,
      };

      if (state === "profiling") {
        endpoint = `http://127.0.0.1:8000/api/train/${uuid}`;
        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          console.log(response);
        }
      }
    } catch (error) {
      console.error("Error during payload processing:", error);
      console.log("---------------------------------------------------------");
      sendResponse({ status: "error", message: error.message });
    }
  }
});
