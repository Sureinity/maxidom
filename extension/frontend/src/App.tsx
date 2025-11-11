import { useState, useEffect } from "react";
import PopupPage from "./pages/PopupPage";
import Onboarding from "./pages/Onboarding";
import ResetPrompt from "./pages/ResetPrompt";
import ResetProfile from "./pages/ResetProfile";
import ManageProfile from "./pages/ManageSettings";
import ChangePassword from "./pages/ChangePassword";

function App() {
  const [systemState, setSystemState] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<string>("popup");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("page") === "onboarding") {
      setSystemState("enrollment");
      return;
    }

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage(
        { type: "REQUEST_PROFILING_STATUS" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Error fetching profiling status:",
              chrome.runtime.lastError
            );
            setSystemState("error");
          } else if (response && response.system_state) {
            setSystemState(response.system_state);
          } else {
            setSystemState("error");
          }
        }
      );
    } else {
      console.error("Chrome runtime not available.");
      setSystemState("error");
    }
  }, []);

  if (systemState === "enrollment") return <Onboarding />;
  if (systemState === "loading" || systemState === null)
    return <div>Loading...</div>;
  if (systemState === "error")
    return <div>Error loading app. Please check the extension.</div>;

  if (currentPage === "manageProfile") {
    return <ManageProfile onNavigate={setCurrentPage} />;
  }

  if (currentPage === "resetPrompt") {
    return <ResetPrompt onNavigate={setCurrentPage} />;
  }

  if (currentPage === "resetProfile") {
    return <ResetProfile onNavigate={setCurrentPage} />;
  }

   if (currentPage === "changePassword") {
    return <ChangePassword onNavigate={setCurrentPage} />;
  }

  return <PopupPage onNavigate={setCurrentPage} />;
}

export default App;
