// Onboarding component for user password enrollment
import { useState, useEffect, type FormEvent } from "react";
import maxidom_icon from "../assets/MaxiDOM-icon.png";
import styles from "../css/Onboarding.module.css";

const Onboarding = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    type: "error" | "success" | "";
  }>({ text: "", type: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (message.text && (!password.trim() || !confirmPassword.trim())) {
      setMessage({ text: "", type: "" });
    }
  }, [password, confirmPassword, message.text]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage({ text: "", type: "" });

    if (!password.trim()) {
      setMessage({ text: "Password cannot be empty.", type: "error" });
      return;
    }
    if (password.trim().length < 8) {
      setMessage({ text: "Password must be at least 8 characters long.", type: "error" });
      return;
    }
    if (password.trim() !== confirmPassword.trim()) {
      setMessage({ text: "Passwords do not match.", type: "error" });
      return;
    }

    setLoading(true);
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage(
        { type: "ENROLL_PASSWORD", password: password },
        (response) => {
          setLoading(false);
          if (chrome.runtime.lastError) {
            console.error("Enrollment error:", chrome.runtime.lastError);
            setMessage({ text: "Failed to connect to service worker.", type: "error" });
          } else if (response && response.success) {
            setMessage({ text: "Enrollment successful! MaxiDOM is now active.", type: "success" });
            // Close the tab after a short delay
            setTimeout(() => {
              chrome.tabs.getCurrent((tab) => {
                if (tab && tab.id) chrome.tabs.remove(tab.id);
              });
            }, 2000);
          } else {
            setMessage({ text: response?.error || "An unknown error occurred.", type: "error" });
          }
        },
      );
    } else {
      setLoading(false);
      setMessage({ text: "Chrome runtime not available.", type: "error" });
    }
  };

  return (
    <>
      <div className="h-screen w-screen flex flex-col justify-center items-center">
        <div className="card bg-base-300 shadow-xl w-110">
          <div className="card-body">
            <div className="flex justify-center">
              <img src={maxidom_icon} alt="MaxiDOM Icon" className="h-6 w-8" />
            </div>

            <p className="text-[16px] text-center">
              <b>Welcome to MaxiDOM!</b>
            </p>
            <p className="text-[12px] text-gray-500 text-center mb-4">
              To secure your profile, please create a verification password.
              This will be used to confirm your identity if unusual behavior is
              detected.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="flex gap-2 flex-col">
                <fieldset className="fieldset">
                  <legend className="fieldset-legend">Password</legend>
                  <input
                    type="password"
                    className="input w-full"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </fieldset>
                <fieldset className="fieldset">
                  <legend className="fieldset-legend">Confirm Password</legend>
                  <input
                    type="password"
                    className="input w-full"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </fieldset>
              </div>

              <button
                className="btn btn-success mt-6 w-full"
                type="submit"
                disabled={loading || !password || !confirmPassword}
              >
                {loading ? "Activating..." : "Set Password & Activate"}
              </button>
            </form>
          </div>
        </div>

        {message.text && message.type && (
          <div className={`absolute bottom-16 z-10 ${styles['alert-enter']}`}>
            <div className={`alert ${message.type === "error" ? "alert-error" : "alert-success"} shadow-lg w-110`}>
              <div>
                <span>{message.text}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Onboarding;
