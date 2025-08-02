import { useEffect, useState } from "react";
import styles from "../css/TrainingPhase.module.css";
import BBlue from "../assets/Browser-blue.png";

const REQUIRED_SAMPLES = 300;

const TrainingPhase = () => {
  const [currentSamples, setCurrentSamples] = useState(0);
  const [requiredSamples, setRequiredSamples] = useState(REQUIRED_SAMPLES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to fetch profiling status
  const fetchProfilingStatus = () => {
    try {
      chrome.runtime.sendMessage(
        { type: "REQUEST_PROFILING_STATUS" },
        (response) => {
          console.log("Profiling progress response:", response);
          if (
            response?.profiling_progress?.total_samples &&
            typeof response.profiling_progress.total_samples.current === "number"
          ) {
            setCurrentSamples(response.profiling_progress.total_samples.current);
            setRequiredSamples(
              response.profiling_progress.total_samples.required || REQUIRED_SAMPLES
            );
            setError(null);
          } else {
            setError("Profiling progress data not available.");
          } 
          setLoading(false);
        }
      );
    } catch (err: any) {
      setError("Failed to communicate with service worker.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfilingStatus();
    const interval = setInterval(fetchProfilingStatus, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <div id={styles.container}>
        <div className="flex justify-center">
          <div id={styles.circlePulse} style={{ animationDelay: "0s" }}></div>
          <div id={styles.circlePulse} style={{ animationDelay: "1s" }}></div>
          <div id={styles.circlePulse} style={{ animationDelay: "2s" }}></div>
          <div id={styles.circlePulse} style={{ animationDelay: "3s" }}></div>
        </div>

        <div className="flex justify-center">
          <div
            id={styles.browserIcon}
            className="absolute top-22 bottom-22 z-2 flex justify-center shadow-md"
          >
            <img src={BBlue} alt="Blue Browser" className="size-20 m-auto" />
          </div>
        </div>
        <div
          id={styles.placeholder}
          className="absolute bottom-0 rounded-t-xl p-4 pt-18"
        >
          <div>
            <div className="flex justify-center gap-2 m-2">
              <p className="text-[14px]">Status:</p>
              <div className="badge text-white" style={{ backgroundColor: '#b37621ff' }}>Training Phase</div>
            </div>
            <div className="flex justify-center">
              <p className={`text-[14px] ${error ? "text-red-500" : "text-gray-600"}`}>
                {error ? error : "Collecting behavioral data..."}
              </p>
            </div>

            <div className="card card-border bg-base-100  w-auto shadow-md my-4">
              <div className="card-body p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex justify-between">
                    <p className="text-left">Collected Samples:</p>
                    <p className="text-right">
                      {loading ? "Loading..." : `${currentSamples}/${requiredSamples}`}
                    </p>
                  </div>

                  <progress
                    className="progress progress-primary"
                    value={currentSamples}
                    max={requiredSamples}
                  ></progress>
                </div>
              </div>
            </div>

            <div className="flex justify-center my-4">
              <p className="text-center text-[10px] text-gray-500">
                MaxiDOM is currently in the cold-start phase. This phase will
                automatically complete after {requiredSamples} samples are collected.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TrainingPhase;