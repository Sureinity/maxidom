import { TbUserFilled } from "react-icons/tb";
import logo from "../assets/MaxiDOM-logo.png";

const Navbar = () => {
  return (
    <>
        <div className="flex justify-between items-center p-4">
          <div>
            <img src={logo} alt="MaxiDOM Logo" className="h-4 w-26 z-1" />
          </div>
          <div className="tooltip tooltip-left z-1" data-tip="My Profile">
            <button className="btn btn-outline btn-sm border-white hover:bg-white p-1 rounded-xl group">
              <TbUserFilled
                size={20}
                className="text-white group-hover:text-gray-600 transition-colors duration-200"
              />
            </button>
          </div>
        </div>
    </>
  );
};

export default Navbar;
