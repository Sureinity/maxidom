// Get DOM elements
const statusIndicator = document.getElementById("status-indicator");
const statusMessage = document.getElementById("status-message");
const resetButton = document.getElementById("reset-button");
const progressZone = document.getElementById("progress-zone");
const totalProgress = document.getElementById("total-progress");
const mouseProgress = document.getElementById("mouse-progress");
const keyboardProgress = document.getElementById("keyboard-progress");

// Elements for the confirmation form
const resetConfirmForm = document.getElementById("reset-confirm-form");
const resetPasswordInput = document.getElementById("reset-password-input");
const resetConfirmButton = document.getElementById("reset-confirm-button");
const resetErrorMessage = document.getElementById("reset-error-message");

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

  // If enrollment is needed, this popup will automatically close because
  // the service worker will have already opened the full onboarding tab.
  if (response.system_state === "enrollment") {
    // The service worker handles opening the onboarding tab on install.
    // This just ensures the popup closes if opened manually.
    setTimeout(() => window.close(), 200);
  }
});

// Step 1: User clicks the initial reset button
resetButton.addEventListener("click", () => {
  // Hide the initial button and show the confirmation form
  resetButton.style.display = "none";
  resetConfirmForm.style.display = "block";
  resetPasswordInput.focus();
});

// Step 2: User submits the password confirmation form
resetConfirmForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const password = resetPasswordInput.value;

  if (!password) {
    resetErrorMessage.textContent = "Password is required.";
    return;
  }

  resetConfirmButton.disabled = true;
  resetConfirmButton.textContent = "Verifying...";
  resetErrorMessage.textContent = "";

  // Step 2a: Send password to the service worker for verification
  chrome.runtime.sendMessage(
    { type: "VERIFY_PASSWORD_FOR_RESET", password: password },
    (response) => {
      if (chrome.runtime.lastError) {
        resetErrorMessage.textContent = `Error: ${chrome.runtime.lastError.message}`;
        resetConfirmButton.disabled = false;
        resetConfirmButton.textContent = "Confirm & Delete Profile";
        return;
      }

      if (response && response.verified) {
        // Step 2b: If verification is successful, send the final reset command
        resetConfirmButton.textContent = "Deleting Profile...";
        chrome.runtime.sendMessage({ type: "RESET_PROFILE" });
        setTimeout(() => window.close(), 500);
      } else {
        // If verification fails, show an error and re-enable the form
        resetErrorMessage.textContent =
          "Incorrect password. Profile not reset.";
        resetConfirmButton.disabled = false;
        resetConfirmButton.textContent = "Confirm & Delete Profile";
        resetPasswordInput.value = "";
        resetPasswordInput.focus();
      }
    },
  );
});

function updatePopupUI(state, progress) {
  statusIndicator.className = "status-indicator"; // Reset classes
  progressZone.style.display = "none"; // Hide progress by default

  switch (state) {
    case "enrollment":
      statusIndicator.classList.add("status-enrollment");
      statusMessage.textContent = "Setup Required";
      resetButton.disabled = true; // Cannot reset if not enrolled
      break;
    case "profiling":
      statusIndicator.classList.add("status-profiling");
      progressZone.style.display = "block"; // Show the progress bars

      // Update Total Samples Progress
      const total = progress?.total_samples?.required || 300;
      const currentTotal = progress?.total_samples?.current || 0;
      const percentTotal =
        total > 0 ? Math.round((currentTotal / total) * 100) : 0;
      statusMessage.textContent = `Profiling... (${percentTotal}%)`;
      totalProgress.style.width = `${percentTotal}%`;

      // Update Mouse Progress
      const mouseTotal = progress?.mouse_samples?.required || 150;
      const mouseCurrent = progress?.mouse_samples?.current || 0;
      const mousePercent =
        mouseTotal > 0 ? Math.round((mouseCurrent / mouseTotal) * 100) : 0;
      mouseProgress.style.width = `${mousePercent}%`;

      // Update Keyboard Progress
      const kbdTotal = progress?.keyboard_samples?.required || 50;
      const kbdCurrent = progress?.keyboard_samples?.current || 0;
      const kbdPercent =
        kbdTotal > 0 ? Math.round((kbdCurrent / kbdTotal) * 100) : 0;
      keyboardProgress.style.width = `${kbdPercent}%`;

      break;
    case "detection":
      statusIndicator.classList.add("status-active");
      statusMessage.textContent = "Active & Protecting";
      break;
    case "awaiting_verification":
      statusIndicator.classList.add("status-enrollment"); // Use red to indicate a problem state
      statusMessage.textContent = "Verification Required";
      break;
    default:
      statusMessage.textContent = "Unknown State";
  }
}
