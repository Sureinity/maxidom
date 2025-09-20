// Get DOM elements
const statusIndicator = document.getElementById("status-indicator");
const statusMessage = document.getElementById("status-message");

// Immediately request the system status from the service worker when the popup opens.
chrome.runtime.sendMessage({ type: "REQUEST_PROFILING_STATUS" }, (response) => {
  if (chrome.runtime.lastError) {
    // Handle cases where the service worker might not be active
    statusMessage.textContent = "Error connecting to service.";
    console.error(chrome.runtime.lastError);
    return;
  }

  // Update the UI based on the response
  updatePopupUI(response.system_state, response.profiling_progress);

  // The critical logic: if enrollment is needed, open the onboarding tab.
  if (response.system_state === "enrollment") {
    // Check if the onboarding tab is already open to avoid creating duplicates.
    chrome.tabs.query(
      { url: chrome.runtime.getURL("onboarding.html") },
      (tabs) => {
        if (tabs.length === 0) {
          chrome.tabs.create({ url: "onboarding.html" });
        } else {
          // If it's already open, just focus it.
          chrome.tabs.update(tabs[0].id, { active: true });
          chrome.windows.update(tabs[0].windowId, { focused: true });
        }
      },
    );
  }
});

function updatePopupUI(state, progress) {
  statusIndicator.className = "status-indicator"; // Reset classes

  switch (state) {
    case "enrollment":
      statusIndicator.classList.add("status-enrollment");
      statusMessage.textContent = "Setup required.";
      break;
    case "profiling":
      statusIndicator.classList.add("status-profiling");
      const total = progress?.total_samples?.required || 300;
      const current = progress?.total_samples?.current || 0;
      const percent = total > 0 ? Math.round((current / total) * 100) : 0;
      statusMessage.textContent = `Profiling... (${percent}%)`;
      break;
    case "detection":
      statusIndicator.classList.add("status-active");
      statusMessage.textContent = "Active & Protecting";
      break;
    case "awaiting_verification":
      statusIndicator.classList.add("status-enrollment");
      statusMessage.textContent = "Verification Required";
      break;
    default:
      statusMessage.textContent = "Unknown State";
  }
}
