from models import Payload
from feature_extraction import FeatureExtractor
from utils import UserModelManager
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import logging
import sys

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
app = FastAPI()
feature_extractor = FeatureExtractor()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Configurations
USER_DATA_DIR  = Path(__file__).resolve().parent / "user_data"
USER_DATA_DIR.mkdir(exist_ok=True)

FEATURE_NAMES = feature_extractor.get_feature_names()
model_manager = UserModelManager(FEATURE_NAMES, USER_DATA_DIR)

# API Endpoints
@app.post("/api/train/{profile_id}")
def user_data(profile_id: str, payload: Payload, background_tasks: BackgroundTasks):
    payload_dict = payload.dict()
    
    # TEST: Save the raw payload first for profiling
    model_manager.save_raw_payload(profile_id, payload_dict, is_retraining_sample=False)
    
    feature_vector = feature_extractor.extract_features(payload_dict)
    
    model_manager.save_features(profile_id, feature_vector)
    diversity_status = model_manager.check_diversity(profile_id)
    
    if diversity_status.get("is_ready") and not model_manager.load_model(profile_id):
        logger.info(f"Diversity threshold met for {profile_id}. Scheduling initial training.")
        background_tasks.add_task(model_manager.train_initial_model, profile_id)
    
    logger.info(f"Training data received for profile {profile_id}. Progress: {diversity_status}")
    
    return {
        "status": "profiling_in_progress",
        "profile_id": profile_id,
        "progress": diversity_status
    }

@app.post("/api/score/{profile_id}")
def score_user_data(profile_id: str, payload: Payload, background_tasks: BackgroundTasks):
    payload_dict = payload.dict()
    feature_vector = feature_extractor.extract_features(payload_dict)
    
    try:
        result = model_manager.score(profile_id, feature_vector)
        
        if not result["is_anomaly"]:
                # TEST: If behavior is normal, save both the raw payload and features for potential retraining
            model_manager.save_raw_payload(profile_id, payload_dict, is_retraining_sample=True)
            pool_size = model_manager.save_features(profile_id, feature_vector, is_retraining_sample=True)
            logger.info(f"Normal sample saved for {profile_id}. Retraining pool size: {pool_size}")
            
            if pool_size >= model_manager.retraining_threshold:
                logger.info(f"Retraining threshold met for {profile_id}. Scheduling retraining.")
                background_tasks.add_task(model_manager.retrain_model, profile_id)
        else:
            logger.warning(f"Anomaly detected for user {profile_id} with score {result['score']}")
        
        return result
    except ValueError as e:
        logger.warning(f"Scoring failed for {profile_id}: {e}")
        raise HTTPException(
            status_code=404, 
            detail="Model not found. The system is likely still in the profiling phase."
        )
