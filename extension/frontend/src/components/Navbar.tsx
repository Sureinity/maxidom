import { IoSettingsSharp } from "react-icons/io5";
import logo from "../assets/MaxiDOM-logo.png";

interface NavbarProps {
  onNavigate?: (page: string) => void;
}

const Navbar = ({ onNavigate }: NavbarProps) => {
  return (
    <>
        <div className="flex justify-between items-center p-4">
          <div>
            <img src={logo} alt="MaxiDOM Logo" className="h-4 w-26 z-1" />
          </div>

          <div className="flex gap-2">
            <div className="tooltip tooltip-left" data-tip="Settings">
            <button className="btn btn-neutral btn-sm p-2" onClick={() => onNavigate && onNavigate("manageProfile")}>
              <IoSettingsSharp
                size={16}
              />
            </button>
          </div>
          </div>
        </div>
    </>
  );
};

export default Navbar;
