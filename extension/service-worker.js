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
  // Check the message type to ensure we're handling the right request.
  if (message.type === "AGGREGATED_USER_EVENTS") {
    console.log("Message received in service_worker from content script.");
    console.log("---------------------------------------------------------");

    try {
      // Step 1: Log the raw message payload as it arrives.
      console.log("Raw payload from content script:", message.payload);

      // Step 2: Retrieve the profile's unique ID from storage.
      console.log("Attempting to retrieve profile UUID from storage...");
      const uuid = await getProfileUUID();

      if (!uuid) {
        console.error(
          "CRITICAL ERROR: Profile UUID not found in storage. Cannot proceed.",
        );
        return; // Stop execution if there's no ID.
      }
      console.log("Successfully retrieved UUID:", uuid);

      // Step 3: Prepare the final payload for the backend.
      // We take the payload from the content script and inject the correct userId.
      const finalPayload = {
        userId: uuid, // Overwrite/set the userId field.
        ...message.payload, // Spread all fields from the content script (startTimestamp, keyEvents, etc.)
      };

      console.log("Final payload constructed and ready to be sent:");
      // Using JSON.stringify with formatting for easy reading in the console.
      console.log(JSON.stringify(finalPayload, null, 2));

      // --- FETCH LOGIC (Temporarily Commented Out for Debugging) ---

      console.log("Simulating sending data to backend...");

      const response = await fetch(`http://127.0.0.1:8000/api/train/${uuid}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(finalPayload),
      });

      if (!response.ok) {
        // Handle HTTP errors (e.g., 400, 500).
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log("FastAPI response:", data);

      sendResponse({ status: "success", received: data });

      // --- END OF COMMENTED FETCH LOGIC ---

      console.log("---------------------------------------------------------");
    } catch (error) {
      console.error("Error during payload processing:", error);
      console.log("---------------------------------------------------------");
      sendResponse({ status: "error", message: error.message });
    }

    // Return true to indicate that we might send a response asynchronously in the future.
    return true;
  }
});
