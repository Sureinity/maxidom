// Get DOM elements for status
const statusIndicator = document.getElementById("status-indicator");
const statusMessage = document.getElementById("status-message");
const progressZone = document.getElementById("progress-zone");

// Get DOM elements for profile management
const resetButton = document.getElementById("reset-button");
const changePasswordButton = document.getElementById("change-password-button");

// Get DOM elements for the reset form
const resetConfirmForm = document.getElementById("reset-confirm-form");
const resetPasswordInput = document.getElementById("reset-password-input");
const resetConfirmButton = document.getElementById("reset-confirm-button");
const resetErrorMessage = document.getElementById("reset-error-message");

// Get DOM elements for the change password form
const changePasswordForm = document.getElementById("change-password-form");
const currentPasswordInput = document.getElementById("current-password-input");
const newPasswordInput = document.getElementById("new-password-input");
const confirmNewPasswordInput = document.getElementById(
  "confirm-new-password-input",
);
const changePasswordSubmit = document.getElementById("change-password-submit");
const changePasswordMessage = document.getElementById(
  "change-password-message",
);

// Immediately request system status when the popup opens
chrome.runtime.sendMessage({ type: "REQUEST_PROFILING_STATUS" }, (response) => {
  if (chrome.runtime.lastError) {
    statusMessage.textContent = "Error connecting to service.";
    console.error(chrome.runtime.lastError);
    return;
  }
  updatePopupUI(response.system_state, response.profiling_progress);
  if (response.system_state === "enrollment") {
    setTimeout(() => window.close(), 200);
  }
});

// Show the Change Password form
changePasswordButton.addEventListener("click", () => {
  resetConfirmForm.style.display = "none"; // Hide other forms
  changePasswordForm.style.display = "block";
  changePasswordButton.style.display = "none";
  resetButton.style.display = "none";
  currentPasswordInput.focus();
});

// Show the Reset Profile confirmation form
resetButton.addEventListener("click", () => {
  changePasswordForm.style.display = "none"; // Hide other forms
  resetConfirmForm.style.display = "block";
  changePasswordButton.style.display = "none";
  resetButton.style.display = "none";
  resetPasswordInput.focus();
});

// Handle the Change Password form submission
changePasswordForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const oldPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmNewPasswordInput.value;

  changePasswordMessage.className = "message-area";
  changePasswordMessage.textContent = "";

  if (!oldPassword || !newPassword || !confirmPassword) {
    changePasswordMessage.textContent = "All fields are required.";
    changePasswordMessage.classList.add("error-message");
    return;
  }
  if (newPassword.length < 8) {
    changePasswordMessage.textContent =
      "New password must be at least 8 characters.";
    changePasswordMessage.classList.add("error-message");
    return;
  }
  if (newPassword !== confirmPassword) {
    changePasswordMessage.textContent = "New passwords do not match.";
    changePasswordMessage.classList.add("error-message");
    return;
  }

  changePasswordSubmit.disabled = true;
  changePasswordSubmit.textContent = "Saving...";

  chrome.runtime.sendMessage(
    { type: "CHANGE_PASSWORD", oldPassword, newPassword },
    (response) => {
      if (chrome.runtime.lastError || !response) {
        changePasswordMessage.textContent = `Error: ${chrome.runtime.lastError?.message || "No response."}`;
        changePasswordMessage.classList.add("error-message");
      } else if (response.success) {
        changePasswordMessage.textContent = "Password changed successfully!";
        changePasswordMessage.classList.add("success-message");
        setTimeout(() => window.close(), 1500);
      } else {
        changePasswordMessage.textContent = `Error: ${response.error}`;
        changePasswordMessage.classList.add("error-message");
      }
      changePasswordSubmit.disabled = false;
      changePasswordSubmit.textContent = "Save New Password";
    },
  );
});

// Handle the Reset Profile form submission
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

  chrome.runtime.sendMessage(
    { type: "VERIFY_PASSWORD_FOR_RESET", password: password },
    (response) => {
      if (chrome.runtime.lastError || !response) {
        resetErrorMessage.textContent = `Error: ${chrome.runtime.lastError?.message || "No response."}`;
        resetConfirmButton.disabled = false;
        resetConfirmButton.textContent = "Confirm & Delete Profile";
      } else if (response.verified) {
        resetConfirmButton.textContent = "Deleting Profile...";
        chrome.runtime.sendMessage({ type: "RESET_PROFILE" });
        setTimeout(() => window.close(), 500);
      } else {
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
