import styles from "../css/DetectionPhase.module.css";
import BPurple from "../assets/Browser-purple.png";
import Check from "../assets/Check.png";
import { IoIosArrowForward } from "react-icons/io";

const DetectionPhase = () => {
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
            <img src={BPurple} alt="Blue Browser" className="size-20 m-auto" />
          </div>
        </div>
        <div
          id={styles.placeholder}
          className="absolute bottom-0 rounded-t-xl p-4 pt-18"
        >
          <div>
            <div className="flex justify-center gap-2 m-2">
              <p className="text-[14px]">Status:</p>
              <div
                className="badge text-white"
                style={{ backgroundColor: "#77912B" }}
              >
                Detection Phase
              </div>
            </div>
            <div className="flex justify-center">
              <p className="text-[14px]">Your browser session is protected.</p>
            </div>

            <div className="card card-border bg-base-100  w-auto shadow-md my-4">
              <div className="card-body p-4">
                <div className="flex justify-between">
                  <div className="flex flex-col">
                    <p className="text-left">No issues found.</p>
                    <p className="text-left text-[10px]">
                      Last checked: 12/01/2025 10:12 PM
                    </p>
                  </div>
                  <img src={Check} alt="Check" className="size-10" />
                </div>
              </div>
            </div>
          </div>
          <button className="btn btn-neutral w-full font-normal rounded-xl">
            View recent log
            <IoIosArrowForward />
          </button>
        </div>
      </div>
    </>
  );
};

export default DetectionPhase;
