import Navbar from "../components/Navbar"
import TrainingPhase from "./TrainingPhase"
// import DetectionPhase from "./DetectionPhase";
import styles from "../css/MainPage.module.css";


const MainPage = () => {
  return (
    <>
    <div id={styles.maincontainer} className="relative">
     <div className="absolute top-0 w-full">
     <Navbar />
     </div>
     
     <TrainingPhase />
     {/* <DetectionPhase/> */}
    </div>
    </>
  )
}

export default MainPage