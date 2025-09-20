// Get DOM elements
const form = document.getElementById("enrollment-form");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirm-password");
const submitButton = document.getElementById("submit-button");
const messageArea = document.getElementById("message-area");

// Listen for form submission
form.addEventListener("submit", (event) => {
  event.preventDefault(); // Prevent page reload

  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  messageArea.textContent = "";
  messageArea.className = "message";

  if (password.length < 8) {
    messageArea.textContent = "Password must be at least 8 characters long.";
    messageArea.classList.add("error");
    return;
  }

  if (password !== confirmPassword) {
    messageArea.textContent = "Passwords do not match.";
    messageArea.classList.add("error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Activating...";

  // Use a callback to handle the asynchronous response from the service worker.
  chrome.runtime.sendMessage(
    {
      type: "ENROLL_PASSWORD",
      password: password,
    },
    (response) => {
      // This callback function will execute ONLY when the service worker sends a response.
      if (chrome.runtime.lastError) {
        // Handle cases where the service worker might be inactive or an error occurred
        messageArea.textContent = `Error: ${chrome.runtime.lastError.message}`;
        messageArea.classList.add("error");
        submitButton.disabled = false;
        submitButton.textContent = "Set Password & Activate";
        return;
      }

      if (response && response.success) {
        messageArea.textContent =
          "Enrollment successful! MaxiDOM is now active.";
        messageArea.classList.add("success");
        // Close the tab after a short delay
        setTimeout(() => {
          chrome.tabs.getCurrent((tab) => {
            if (tab) chrome.tabs.remove(tab.id);
          });
        }, 2000);
      } else {
        messageArea.textContent = `Error: ${response?.error || "An unknown error occurred."}`;
        messageArea.classList.add("error");
        submitButton.disabled = false;
        submitButton.textContent = "Set Password & Activate";
      }
    },
  );
});
