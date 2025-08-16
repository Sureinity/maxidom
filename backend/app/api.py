from models import Payload
from feature_extraction import FeatureExtractor
from utils import UserModelManager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import logging
import sys
import numpy as np

# Logging Setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("app.log")
    ]
)
logger = logging.getLogger(__name__)

# App Initialization
app = FastAPI(
    title="MaxiDOM Behavioral Biometrics API",
    description="API for training and scoring user behavioral profiles.",
    version="2.1.0"
)

# CORS Middleware for browser extension communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Configurations & Instantiation
USER_DATA_DIR = Path(__file__).resolve().parent / "user_data"
USER_DATA_DIR.mkdir(exist_ok=True)

feature_extractor = FeatureExtractor()
FEATURE_NAMES = feature_extractor.get_feature_names()
model_manager = UserModelManager(FEATURE_NAMES, USER_DATA_DIR)

# API Endpoints
@app.post("/api/train/{profile_id}")
def train_user_data(profile_id: str, payload: Payload, background_tasks: BackgroundTasks):
    """
    Receives behavioral data during the profiling phase.
    Stores features and checks if the profile is ready for initial training.
    """
    try:
        payload_dict = payload.dict()
        model_manager.save_raw_payload(profile_id, payload_dict)
        feature_vector = feature_extractor.extract_features(payload_dict)
        model_manager.save_features(profile_id, feature_vector)
        
        diversity_status = model_manager.check_diversity(profile_id)
        
        user_dir = USER_DATA_DIR / profile_id
        model_exists = (user_dir / "model_mouse.joblib").exists() or \
                       (user_dir / "model_typing.joblib").exists() or \
                       (user_dir / "model_mixed.joblib").exists()

        if diversity_status.get("is_ready") and not model_exists:
            logger.info(f"Diversity threshold met for {profile_id}. Scheduling initial training.")
            background_tasks.add_task(model_manager.train_initial_model, profile_id)
        
        logger.info(f"Training data received for profile {profile_id}. Progress: {diversity_status}")
        
        return {
            "status": "profiling_in_progress",
            "profile_id": profile_id,
            "progress": diversity_status
        }
    except Exception as e:
        logger.error(f"Error in /train endpoint for {profile_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred during data processing.")


@app.post("/api/score/{profile_id}")
def score_user_data(profile_id: str, payload: Payload, background_tasks: BackgroundTasks):
    """
    Receives behavioral data during the detection phase.
    Routes to the appropriate specialist model for scoring.
    """
    try:
        payload_dict = payload.dict()
        feature_vector = feature_extractor.extract_features(payload_dict)
        
        result = model_manager.score(profile_id, feature_vector)
        
        if not result["is_anomaly"]:
            pool_size = model_manager.save_features(profile_id, feature_vector, is_retraining_sample=True)
            model_manager.save_raw_payload(profile_id, payload_dict, is_retraining_sample=True)
            
            logger.info(f"Normal sample saved for {profile_id}. Retraining pool size: {pool_size}")
            
            if pool_size >= model_manager.retraining_threshold:
                logger.info(f"Retraining threshold met for {profile_id}. Scheduling retraining.")
                background_tasks.add_task(model_manager.retrain_model, profile_id)
        else:
            logger.warning(f"Anomaly detected for user {profile_id} -> "
                           f"score={result['score']:.4f}, "
                           f"threshold={result['threshold']:.4f}, "
                           f"model='{result['model_used']}'")
        
        return result
        
    except ValueError as e:
        logger.warning(f"Scoring failed for {profile_id}: {e}")
        raise HTTPException(
            status_code=404, 
            detail="Model not found. The system is likely still in the profiling phase."
        )
    except Exception as e:
        logger.error(f"Error in /score endpoint for {profile_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred during scoring.")


@app.post("/api/test_score_row/{profile_id}")
def test_score_row(profile_id: str, feature_row: dict):
    """
    A temporary testing endpoint to score a single, pre-calculated 
    feature vector from a CSV row. This should be disabled or removed in production.
    """
    logger.info(f"Received test score request for profile {profile_id}")
    try:
        feature_vector = np.array([feature_row[name] for name in FEATURE_NAMES])
    except KeyError as e:
        logger.error(f"Missing feature in test data for test_score_row: {e}")
        raise HTTPException(status_code=422, detail=f"Missing feature in test data: {e}")

    try:
        result = model_manager.score(profile_id, feature_vector)
        log_prefix = "🚨 TEST ANOMALY:" if result['is_anomaly'] else "✅ TEST NORMAL:"
        logger.info(f"{log_prefix} score={result['score']:.4f}, threshold={result['threshold']:.4f}, model='{result['model_used']}'")
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=f"Model not found for user {profile_id}. Have you trained it yet?")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An internal error during test scoring.")
