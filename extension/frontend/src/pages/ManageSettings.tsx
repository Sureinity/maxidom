import styles from "../css/PopupPage.module.css";
import { IoArrowBackOutline } from "react-icons/io5";
import { PiPasswordBold } from "react-icons/pi";
import { FaUserGear } from "react-icons/fa6";

interface ManageProfileProps {
  onNavigate: (page: string) => void;
}

const ManageProfile = ({ onNavigate }: ManageProfileProps) => {
  return (
    <>
      <div id={styles.container} className="p-4">
        <button
          className="btn btn-ghost btn-sm mb-4 p-0 text-gray-500"
          onClick={() => onNavigate("popup")}
        >
          <IoArrowBackOutline size={12} /> Back
        </button>

        <p className="text-[14px] mb-4 text-center">Settings</p>
        <div className="flex flex-col gap-2">
          <button className="btn btn-neutral btn-sm" onClick={() => onNavigate("changePassword")}>
            <PiPasswordBold size={14}/>
            Change password</button>
          <button className="btn btn-neutral btn-sm" onClick={() => onNavigate("resetPrompt")}>
            <FaUserGear size={14}/>
            Reset biometric profile</button>
        </div>
      </div>
    </>
  );
};

export default ManageProfile;
