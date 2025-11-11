import styles from "../css/PopupPage.module.css";
import { IoArrowBackOutline } from "react-icons/io5";

interface ResetPromptProps {
  onNavigate: (page: string) => void;
}

const ResetPrompt = ({ onNavigate }: ResetPromptProps) => {
  return (
    <>
      <div id={styles.container} className="p-4">
        <button
          className="btn btn-ghost btn-sm mb-4 p-0 text-gray-500"
          onClick={() => onNavigate("manageProfile")}
        >
          <IoArrowBackOutline size={12}/> Back
        </button>

        <p className="text-[14px] mb-1 text-center">Reset Biometric Profile</p>
        <p className="text-gray-400 mb-8 text-center">
          Resetting your biometric profile will clear all behavioral data. This action
          cannot be undone.
        </p>

        <button className="btn btn-warning btn-sm w-full" onClick={() => onNavigate("resetProfile")}>Proceed</button>
      </div>
    </>
  );
};

export default ResetPrompt;
