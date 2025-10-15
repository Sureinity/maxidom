import { IoSettingsSharp } from "react-icons/io5";
import { TbLogs } from "react-icons/tb";
import logo from "../assets/MaxiDOM-logo.png";

const Navbar = () => {
  return (
    <>
        <div className="flex justify-between items-center p-4">
          <div>
            <img src={logo} alt="MaxiDOM Logo" className="h-4 w-26 z-1" />
          </div>

          <div className="flex gap-2">
            <div className="tooltip tooltip-bottom" data-tip="Settings">
            <button className="btn btn-neutral btn-sm p-2">
              <IoSettingsSharp
                size={16}
              />
            </button>
          </div>

          <div className="tooltip tooltip-bottom" data-tip="Logs">
            <button className="btn btn-neutral btn-sm p-2">
              <TbLogs
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
