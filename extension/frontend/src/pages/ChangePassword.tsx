import { useState, useEffect } from "react";
import styles from "../css/PasswordMngmt.module.css";
import { IoArrowBackOutline } from "react-icons/io5";

interface ChangePasswordProps {
  onNavigate: (page: string) => void;
}

const ChangePassword = ({ onNavigate }: ChangePasswordProps) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (message) {
      setShowAlert(true);
    } else {
      setShowAlert(false);
    }
  }, [message]);

  const handleInputChange = () => {
    if (message) {
      setMessage("");
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    setMessage("");

    if (
      !currentPassword.trim() ||
      !newPassword.trim() ||
      !confirmPassword.trim()
    ) {
      setMessage("All fields are required.");
      return;
    }
    if (newPassword.trim().length < 8) {
      setMessage("New password must be at least 8 characters.");
      return;
    }
    if (newPassword.trim() === currentPassword.trim()) {
      setMessage("New password cannot be the same as current password.");
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      setMessage("New passwords do not match.");
      return;
    }

    setIsLoading(true);

    chrome.runtime.sendMessage(
      { type: "CHANGE_PASSWORD", oldPassword: currentPassword, newPassword },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          setMessage(
            `Error: ${chrome.runtime.lastError?.message || "No response."}`
          );
        } else if (response.success) {
          setMessage("Password changed successfully!");
          setTimeout(() => onNavigate("popup"), 1500);
        } else {
          setMessage(`Error: ${response.error}`);
        }
        setIsLoading(false);
      }
    );
  };

  return (
    <>
      <div id={styles.container} className="p-4">
        <button
          className="btn btn-ghost btn-sm mb-2 p-0 text-gray-500"
          onClick={() => onNavigate("popup")}
        >
          <IoArrowBackOutline size={12} /> Back to home
        </button>

        <fieldset>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2 mb-5">
              <input
                type="password"
                className="input input-sm"
                placeholder="Current Password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  handleInputChange();
                }}
                required
              />
              <input
                type="password"
                className="input input-sm"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  handleInputChange();
                }}
                required
              />
              <input
                type="password"
                className="input input-sm"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  handleInputChange();
                }}
                required
              />
            </div>

            <button
              className="btn btn-success btn-sm w-full"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save New Password"}
            </button>
          </form>

          {showAlert && (
            <div className="flex justify-center">
              <div
                role="alert"
                className={`alert alert-soft absolute bottom-0 mb-2 z-10 ${styles['alert-enter']}`}
              >
                <div
                  className={`message-area ${
                    message.includes("Error") ||
                    message.includes("required") ||
                    message.includes("match")
                      ? "error-message"
                      : "success-message"
                  } text-center`}
                >
                  {message}
                </div>
              </div>
            </div>
          )}
          
        </fieldset>
      </div>
    </>
  );
};

export default ChangePassword;
