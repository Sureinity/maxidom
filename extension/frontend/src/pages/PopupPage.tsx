import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import styles from "../css/PopupPage.module.css";

type SystemState = "enrollment" | "profiling" | "detection" | "awaiting_verification";

interface Status {
  system_state: SystemState;
  profiling_progress: {
    is_ready: boolean;
    total_samples: {
      current: number;
      required: number;
    };
    keyboard_samples: {
      current: number;
      required: number;
    };
    mouse_samples: {
      current: number;
      required: number;
    };
    digraph_samples: {
      current: number;
      required: number;
    };
  };
}

const PopupPage = () => {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "REQUEST_PROFILING_STATUS" }, (response) => {
        if (chrome.runtime.lastError) {
          setError("Could not connect to the service worker.");
          console.error(chrome.runtime.lastError);
        } else if (response) {
          setStatus(response);
        } else {
          setError("Received an empty response from the service worker.");
        }
      });
    } else {
      setError("Chrome runtime not available.");
    }
  }, []);

  const renderStatus = () => {
    if (error) {
      return <p className="text-error">{error}</p>;
    }
    if (!status) {
      return <p>Loading status...</p>;
    }

    const stateMap: Record<SystemState, { text: string; className: string; indicator: string }> = {
      enrollment: { text: "Enrollment Required", className: "badge-error", indicator: "status-error" },
      profiling: { text: "Profiling", className: "badge-warning", indicator: "status-warning" },
      detection: { text: "Active", className: "badge-success", indicator: "status-success" },
      awaiting_verification: { text: "Verification Required", className: "badge-error", indicator: "status-error" },
    };

    const current = stateMap[status.system_state] || { text: "Unknown", className: "badge-ghost", indicator: "bg-gray-500" };

    return (
      <>
        <div className="flex justify-between m-2">
          <p className="text-[14px]">Current State:</p>
          <div className={`badge badge-sm ${current.className}`}>{current.text}</div>
        </div>
        <div className="flex justify-between gap-2 m-2">
          <p className="text-[14px]">Status:</p>
          <div className="flex items-center gap-2">
            <div className="inline-grid *:[grid-area:1/1]">
              <div className={`status ${current.indicator} animate-ping`}></div>
              <div className={`status ${current.indicator}`}></div>
            </div>
            <p className="text-[14px]">
              {status.system_state === "profiling" ? `In progress (${Math.min(100, Math.floor(((status.profiling_progress?.total_samples?.current || 0) / (status.profiling_progress?.total_samples?.required || 300)) * 100))}%)` : "Active"}
            </p>
          </div>
        </div>
      </>
    );
  };

  return (
    <div id={styles.container}>
      <Navbar />
      <div className="p-4">{renderStatus()}</div>

      <div className="card bg-base-300 shadow-xl rounded-none absolute bottom-0">
        <div className="card-body p-4">
          <p className="text-[10px] text-gray-500 text-center">
            Your behavior is being learned and used to protect your browsing
            session in real time. <u>Learn more.</u>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PopupPage;
