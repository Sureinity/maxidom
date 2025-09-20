function injectLockOverlay() {
  // Avoid injecting multiple times
  if (document.getElementById("extension-profile-lock-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "extension-profile-lock-overlay";

  // Style the overlay container
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    zIndex: "999999",
    fontFamily: "Arial, sans-serif",
    fontSize: "20px",
  });

  // Message element
  const message = document.createElement("div");
  message.textContent =
    "This profile is locked. Please click the button to continue.";
  message.style.marginBottom = "20px";
  message.style.textAlign = "center";

  // Button element
  const button = document.createElement("button");
  button.textContent = "Continue";
  Object.assign(button.style, {
    padding: "10px 20px",
    fontSize: "16px",
    borderRadius: "4px",
    border: "none",
    backgroundColor: "#4CAF50",
    color: "#fff",
    cursor: "pointer",
  });

  button.addEventListener("click", () => {
    overlay.remove();
    // Optional: trigger an action or event here
  });

  // Add elements to overlay
  overlay.appendChild(message);
  overlay.appendChild(button);

  // Inject into DOM
  document.body.appendChild(overlay);
}
