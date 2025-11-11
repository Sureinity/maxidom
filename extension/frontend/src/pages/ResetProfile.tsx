import { useState, useEffect } from "react";
import styles from "../css/PasswordMngmt.module.css";
import { IoArrowBackOutline } from "react-icons/io5";

interface ResetProfileProps {
  onNavigate: (page: string) => void;
}

const ResetProfile = ({ onNavigate }: ResetProfileProps) => {
  const [password, setPassword] = useState("");
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

    if (!password.trim()) {
      setMessage("Password is required.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    chrome.runtime.sendMessage(
      { type: "VERIFY_PASSWORD_FOR_RESET", password },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          setMessage(
            `Error: ${chrome.runtime.lastError?.message || "No response."}`
          );
          setIsLoading(false);
        } else if (response.verified) {
          setMessage("Deleting Profile...");
          chrome.runtime.sendMessage({ type: "RESET_PROFILE" });
          setTimeout(() => onNavigate("popup"), 500);
        } else {
          setMessage("Incorrect password. Profile not reset.");
          setIsLoading(false);
          setPassword("");
        }
      }
    );
  };

  return (
    <>
      <div id={styles.container} className="p-4">
        <button
          className="btn btn-ghost btn-sm mb-4 p-0 text-gray-500"
          onClick={() => onNavigate("popup")}
        >
          <IoArrowBackOutline size={12} /> Back to home
        </button>

        <fieldset>
          <p className="text-gray-300 mb-2 text-center">
            Enter your password to reset your profile.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              className="input input-sm mb-6"
              placeholder="Enter password to confirm reset"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                handleInputChange();
              }}
              required
            />

            <button
              className="btn btn-error btn-sm w-full"
              type="submit"
              disabled={isLoading}
            >
              {isLoading
                ? message === "Deleting Profile..."
                  ? "Deleting Profile..."
                  : "Verifying..."
                : "Confirm & Delete Profile"}
            </button>
          </form>

          {showAlert && (
            <div role="alert" className={`alert absolute bottom-0 mb-2 z-10 ${styles['alert-enter']}`}>
              <div
                className={`message-area ${
                  message.includes("Error") ||
                  message.includes("Incorrect") ||
                  message.includes("required")
                    ? "error-message"
                    : "success-message"
                } text-center`}
              >
                {message}
              </div>
            </div>
          )}
        </fieldset>
      </div>
    </>
  );
};

export default ResetProfile;
