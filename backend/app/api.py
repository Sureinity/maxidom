from models import Payload
from feature_extraction import FeatureExtractor
from utils import UserModelManager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("app.log")
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI()
feature_extractor = FeatureExtractor()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

USER_DATA_DIR  = Path(__file__).resolve().parent.parent / "user_data"
USER_DATA_DIR.mkdir(exist_ok=True)

# Feature names to be used as CSV headers
FEATURE_NAMES = [
    # Mouse Dynamics
    "avg_mouse_speed",
    "std_mouse_speed",
    "avg_mouse_acceleration",
    "std_mouse_acceleration",
    "path_straightness",
    
    # Click Features
    "avg_click_duration",
    "double_click_rate",
    
    # Keystroke Dynamics
    "avg_dwell_time",
    "std_dwell_time",
    "avg_flight_time_digraph",
    "std_flight_time_digraph",
    
    # Scrolling Dynamics
    "avg_scroll_magnitude",
    "scroll_burstiness",
    "avg_time_between_scrolls",
    "scroll_direction_ratio",
    
    # Session & Habitual Dynamics
    "window_focus_blur_rate",
    "mouse_movement_to_interaction_ratio"
]

model_manager = UserModelManager(FEATURE_NAMES, USER_DATA_DIR)

@app.post("/api/train/{profile_id}")
def user_data(profile_id:str, payload: Payload):
    """
    Endpoint for receiving user data during the profiling phase.
    Extracts features and stores them in user-specific CSV file.
    """
    # Convert Pydantic model to dict for feature extraction
    payload_dict = payload.dict()

    feature_vector = feature_extractor.extract_features(payload_dict)
    sample_count = model_manager.save_features(profile_id, feature_vector)
    
    logger.info(f"Training data received for profile {profile_id}, total samples: {sample_count}")
    
    # Return status information including sample count
    return {
        "status": "training data received",
        "profile_id": profile_id,
        "samples_collected": sample_count,
        "features": feature_vector.tolist()  # Convert numpy array to list for JSON serialization
    }

@app.post("/api/score/{profile_id}")
def score_user_data(profile_id: str, payload: Payload):
    """
    Endpoint for scoring user data against a trained model.
    Returns an anomaly score and detection result.
    """
    # Check if user directory exists
    user_dir = USER_DATA_DIR / profile_id
    if not user_dir.exists():
        logger.warning(f"User {profile_id} not found")
        raise HTTPException(status_code=404, detail=f"User {profile_id} not found")
 
    # Extract features from the payload
    payload_dict = payload.dict()
    feature_vector = feature_extractor.extract_features(payload_dict)
    
    try:
        # Try to score the features
        result = model_manager.score(profile_id, feature_vector)
        
        # If this was normal behavior (not an anomaly), save it for potential retraining
        if not result["is_anomaly"]:
            # Save to retraining pool
            retraining_samples_count = model_manager.save_features(profile_id, feature_vector, is_retraining_sample=True)
            logger.info(f"Normal behavior sample saved to retraining pool for user {profile_id}. " +
                        f"Current pool size: {retraining_samples_count}")
            
            # Add retraining pool info to the result
            result["retraining_pool_size"] = retraining_samples_count
            result["retraining_threshold"] = model_manager.retraining_threshold
        else:
            logger.warning(f"Anomaly detected for user {profile_id} with score {result['score']}")
        
        return result
    except ValueError:
        # No model exists yet, check if we have enough data to train one
        sample_count = model_manager.count_user_samples(profile_id)
        logger.info(f"No model exists for user {profile_id}. Current sample count: {sample_count}")
        
        if sample_count >= model_manager.min_samples_for_training:
            # Try to train the model now
            logger.info(f"Attempting to train model for user {profile_id} with {sample_count} samples")
            if model_manager.train_initial_model(profile_id):
                # Try scoring again with the new model
                try:
                    logger.info(f"Model successfully trained for user {profile_id}, attempting to score")
                    return model_manager.score(profile_id, feature_vector)
                except ValueError:
                    logger.error(f"Failed to use newly trained model for user {profile_id}")
                    raise HTTPException(status_code=500, detail="Failed to use newly trained model")
            else:
                logger.error(f"Failed to train model for user {profile_id}")
                raise HTTPException(status_code=500, detail="Failed to train model")
        else:
            logger.warning(f"Not enough training data for user {profile_id}. " +
                          f"Need {model_manager.min_samples_for_training}, have {sample_count}")
            raise HTTPException(status_code=404, detail="Model not found or not enough training data")
