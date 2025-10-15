import { useState, useEffect } from "react";
import PopupPage from "./pages/PopupPage";
import Onboarding from "./pages/Onboarding";

function App() {
  const [systemState, setSystemState] = useState<string | null>(null);

  useEffect(() => {
    // Check if we are in an onboarding context (e.g., opened in a full tab)
    // The popup is too small for the full onboarding flow.
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('page') === 'onboarding') {
      setSystemState("enrollment");
      return;
    }

    // Otherwise, we are in the popup, so fetch the real status.
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "REQUEST_PROFILING_STATUS" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error fetching profiling status:", chrome.runtime.lastError);
          setSystemState("error");
        } else if (response && response.system_state) {
          setSystemState(response.system_state);
        } else {
          setSystemState("error");
        }
      });
    } else {
      console.error("Chrome runtime not available.");
      setSystemState("error");
    }
  }, []);

  if (systemState === "enrollment") return <Onboarding />;
  if (systemState === "loading" || systemState === null) return <div>Loading...</div>;
  if (systemState === "error") return <div>Error loading app. Please check the extension.</div>;

  return (
    <PopupPage />
  );
}

export default App;
