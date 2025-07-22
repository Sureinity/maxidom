/***********************************************************************
  SERVICE WORKER - CORE MESSAGE WORKFLOW OVERVIEW

  Handles incoming messages from content scripts, manages profiling vs.
  detection logic, interacts with local storage, and communicates with
  the backend server.

  Step 1: Log the raw message payload as it arrives.
  Step 2: Retrieve the profile's unique ID from storage.
  Step 3: Get the current system state.
  Step 4: Prepare the final payload for the backend.
  Step 5: Determine which API endpoint to use based on system state.
  Step 6: Process the response based on system state (profiling or detection).
***********************************************************************/

import {
  ENDPOINTS,
  PROFILING_SAMPLE_THRESHOLD,
  checkPhaseTransition,
  getProfileUUID,
  getSystemState,
  getSampleCount,
  getModelStatus,
  updateSampleCount,
  updateModelStatus,
} from "./utils/helpers.js";

// ON INSTALL: Generate and store a unique identifier for this browser profile.
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

// ON MESSAGE: Listen for aggregated data from the content script.
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "AGGREGATED_USER_EVENTS") {
    try {
      const uuid = await getProfileUUID();
      const state = await getSystemState();
      let response = null;
      let endpoint = null;

      const payload = {
        profile_id: uuid,
        ...message.payload,
      };

      if (state === "profiling") {
        // Profiling phase
        endpoint = ENDPOINTS.TRAIN(uuid);

        try {
          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            const data = await response.json();
            await updateSampleCount(data.samples_collected);
            console.log(
              `Total samples collected: ${data.samples_collected}/${PROFILING_SAMPLE_THRESHOLD}`,
            );

            if (data.samples_collected >= PROFILING_SAMPLE_THRESHOLD) {
              endpoint = ENDPOINTS.SCORE(uuid);

              try {
                const modelCheckResponse = await fetch(endpoint, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(payload),
                });

                if (modelCheckResponse.ok) {
                  // Model exists and is ready
                  console.log("Model is trained and ready!");
                  await updateModelStatus(true);

                  // Evaluate condition for entering detection phase
                  const newState = await checkPhaseTransition(
                    data.samples_collected,
                    true,
                  );
                  if (newState !== state) {
                    console.log(
                      `System state changed: ${state} -> ${newState}`,
                    );
                  }
                } else {
                  // Model not ready yet, stay in profiling
                  console.log("Model is not ready yet, continuing profiling");
                  await updateModelStatus(false); // Defensive programming
                }
              } catch (error) {
                console.error("Error checking model status:", error);
              }
            }
          }
        } catch (error) {
          console.error("Error sending data to training endpoint:", error);
        }
      } else {
        // Detection phase: Logical side
        endpoint = ENDPOINTS.SCORE(uuid);

        try {
          console.log(`Sending data to detection endpoint: ${endpoint}`);
          response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          // Handle 404 error (model not found) by switching back to profiling
          if (response.status === 404) {
            console.warn(
              "Model not found for this user. Switching back to profiling mode.",
            );
            await chrome.storage.local.set({
              system_state: "profiling",
              sample_count: 0, // Reset sample count
              model_trained: false, // Reset model status
            });

            // Try again with training endpoint
            endpoint = ENDPOINTS.TRAIN(uuid);
            console.log("Retrying with training endpoint");
            response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
            });

            if (response.ok) {
              const data = await response.json();
              if (data.samples_collected !== undefined) {
                await updateSampleCount(data.samples_collected);
              }
            }
          }
        } catch (error) {
          console.error("Error in detection phase:", error);
          // Try with training endpoint as a fallback
          console.log("Falling back to training endpoint");
          response = await fetch(`http://127.0.0.1:8000/api/train/${uuid}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
        }
      }

      // HTTP Errors handling
      if (!response || !response.ok) {
        throw new Error(
          `HTTP error! Status: ${response ? response.status : "No response"}`,
        );
      }

      // General API response processing
      const data = await response.json();
      console.log(data.status);
      console.log(`Backend response: ${data}`);

      if (state === "detection" && data.is_anomaly !== undefined) {
        if (data.is_anomaly) {
          // In detection mode, check for anomalies
          console.warn(
            "⚠️ ANOMALY DETECTED! This may not be the profile owner.",
          );
        } else {
          console.log("Normal behavior detected. Continuing sessions.");
        }
      } else if (state === "profiling") {
        // In profiling mode, just log the progress
        const count = data.samples_collected || (await getSampleCount());
        console.log(
          `Profiling in progress: ${count}/${PROFILING_SAMPLE_THRESHOLD} samples collected`,
        );
      }

      sendResponse({ status: "success", received: data });
      console.log("---------------------------------------------------------");
    } catch (error) {
      console.error("Error during payload processing:", error);
      console.log("---------------------------------------------------------");
      sendResponse({ status: "error", message: error.message });
    }
    return true;
  }
});
