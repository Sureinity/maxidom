from fastapi import FastAPI, HTTPException, BackgroundTasks, Body, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import numpy as np
import logging
import sys

from database import init_db, save_user_hash, get_user_hash, update_user_hash
from security import get_password_hash, verify_password
from models import Payload
from feature_extraction import FeatureExtractor
from utils import UserModelManager

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
    version="2.4.0-changepw"
)

# Call the database initializer on application startup
@app.on_event("startup")
def on_startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Configurations & Instantiation
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(exist_ok=True)

USER_DATA_DIR = Path(__file__).resolve().parent / "user_data"
USER_DATA_DIR.mkdir(exist_ok=True)

feature_extractor = FeatureExtractor()
FEATURE_NAMES = feature_extractor.get_feature_names()
model_manager = UserModelManager(FEATURE_NAMES, USER_DATA_DIR)


# Authentication & Enrollment Endpoints
@app.post("/api/enroll/{profile_id}")
def enroll_user(profile_id: str, data: dict = Body(...)):
    """
    Enrolls a new user by hashing and storing their password.
    This endpoint is decoupled from the client's state machine.
    """
    password = data.get("password")
    if not password:
        raise HTTPException(status_code=422, detail="Password not provided.")
    
    password_hash = get_password_hash(password)
    success = save_user_hash(profile_id, password_hash)
    
    if not success:
        logger.warning(f"Enrollment attempt for existing profile: {profile_id}")
        raise HTTPException(status_code=409, detail="Profile already enrolled.")
        
    logger.info(f"Successfully enrolled new profile: {profile_id}")
    # The backend's only job is to confirm success. The client is responsible
    # for changing its own state from 'enrollment' to 'profiling'.
    return {"status": "enrollment successful", "profile_id": profile_id}


@app.post("/api/verify_password/{profile_id}")
def verify_user_password(profile_id: str, data: dict = Body(...)):
    """
    Verifies a password attempt against the stored hash for a given user.
    """
    password_attempt = data.get("password")
    if not password_attempt:
        raise HTTPException(status_code=422, detail="Password not provided.")

    stored_hash = get_user_hash(profile_id)
    if not stored_hash:
        raise HTTPException(status_code=404, detail="User profile not found or not enrolled.")
    
    is_verified = verify_password(password_attempt, stored_hash)
    
    if is_verified:
        logger.info(f"Password verification successful for profile: {profile_id}")
    else:
        logger.warning(f"Password verification FAILED for profile: {profile_id}")
        
    return {"verified": is_verified}


@app.put("/api/profile/{profile_id}/password")
def change_password(profile_id: str, data: dict = Body(...)):
    """
    Allows an authenticated user to change their password.
    Requires the user's current password for authorization.
    """
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        raise HTTPException(status_code=422, detail="Both 'old_password' and 'new_password' are required.")
    
    # Verify the user's identity by checking their old password
    stored_hash = get_user_hash(profile_id)
    if not stored_hash:
        raise HTTPException(status_code=404, detail="User profile not found or not enrolled.")
    
    if not verify_password(old_password, stored_hash):
        logger.warning(f"FAILED password change attempt for profile: {profile_id} (Incorrect old password)")
        raise HTTPException(status_code=403, detail="Incorrect current password.")
    
    # If verification succeeds, hash and update the new password
    new_hash = get_password_hash(new_password)
    success = update_user_hash(profile_id, new_hash)

    if not success:
        logger.error(f"Failed to update password in database for profile: {profile_id}")
        raise HTTPException(status_code=500, detail="Failed to update password.")

    logger.info(f"Successfully changed password for profile: {profile_id}")
    return {"status": "password changed successfully"}


@app.delete("/api/reset_profile/{profile_id}")
def reset_biometric_profile(profile_id: str, response: Response):
    """
    Resets a user's biometric profile by deleting all learned behavioral data.
    This action does NOT delete the user's account or password.
    """
    logger.warning(f"Received request to RESET BIOMETRIC PROFILE for: {profile_id}")
    
    # This DOES NOT delete the user's credentials from the database.
    # The user's account and password remain intact.

    # It ONLY delete the entire user data directory from the file system.
    # This includes models, feature CSVs, and raw data archives.
    data_deleted = model_manager.delete_user_data(profile_id)

    if not data_deleted:
        # This can happen if the directory didn't exist in the first place, which is fine,
        # or if there was a file system error.
        logger.warning(f"No biometric data directory found for profile {profile_id} to reset, or an error occurred.")
        # Even if no files were deleted, we can return success as the state is now clean.
    
    logger.info(f"Biometric profile for {profile_id} has been successfully reset.")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


# Biometric Processing Endpoints
@app.post("/api/train/{profile_id}")
def train_user_data(profile_id: str, payload: Payload, background_tasks: BackgroundTasks):
    """
    Receives behavioral data during the profiling phase.
    """
    try:
        payload_dict = payload.dict()
        model_manager.save_raw_payload(profile_id, payload_dict)
        feature_vector = feature_extractor.extract_features(payload_dict)
        model_manager.save_features(profile_id, feature_vector)
        
        diversity_status = model_manager.check_diversity(profile_id)
        
        user_dir = USER_DATA_DIR / profile_id
        model_exists = (user_dir / "model_mouse.joblib").exists()
        if diversity_status.get("is_ready") and not model_exists:
            logger.info(f"Diversity threshold met for {profile_id}. Scheduling initial training.")
            background_tasks.add_task(model_manager.train_initial_model, profile_id)
        
        logger.info(f"Training data received for profile {profile_id}. Progress: {diversity_status}")
        
        return {"status": "profiling_in_progress", "profile_id": profile_id, "progress": diversity_status}
    except Exception as e:
        logger.error(f"Error in /train for {profile_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error during data processing.")


@app.post("/api/score/{profile_id}")
def score_user_data(profile_id: str, payload: Payload):
    """
    Receives behavioral data, dissects it, and scores it with specialist models.
    """
    try:
        payload_dict = payload.dict()
        feature_vector = feature_extractor.extract_features(payload_dict)
        
        # --- COUNT RAW EVENTS ---
        # We calculate density here to pass to the scoring engine
        key_count = len(payload_dict.get("keyEvents", []))
        
        # Count total mouse points across all paths
        mouse_count = sum(len(path) for path in payload_dict.get("mousePaths", []))
        
        # Pass counts to the score method for Significance Gating
        result = model_manager.score(profile_id, feature_vector, key_count=key_count, mouse_count=mouse_count)
        
        if result["is_anomaly"]:
            logger.warning(f"Anomaly detected for user {profile_id} -> "
                           f"final_score={result['score']:.4f} "
                           f"(mouse: {result['mouse_score']:.4f}, typing: {result['typing_score']:.4f})")
        
        return result
        
    except ValueError as e:
        logger.warning(f"Scoring failed for {profile_id}: {e}")
        raise HTTPException(status_code=404, detail="Model not found.")
    except Exception as e:
        logger.error(f"Error in /score endpoint for {profile_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred during scoring.")

@app.post("/api/test_score_row/{profile_id}")
def test_score_row(profile_id: str, feature_row: dict):
    """
    A temporary testing endpoint.
    """
    try:
        feature_vector = np.array([feature_row[name] for name in FEATURE_NAMES])
    except KeyError as e:
        raise HTTPException(status_code=422, detail=f"Missing feature in test data: {e}")

    try:
        result = model_manager.score(profile_id, feature_vector)
        log_prefix = "🚨 TEST ANOMALY:" if result['is_anomaly'] else "✅ TEST NORMAL:"
        
        # Updated logging for the new score result format
        logger.info(f"{log_prefix} final_score={result['score']:.4f} "
                    f"(mouse: {result['mouse_score']:.4f}, typing: {result['typing_score']:.4f})")
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=f"Model not found for user {profile_id}.")
    except Exception as e:
        raise HTTPException(status_code=500, detail="An internal error during test scoring.")


# Serving Extension auto-update files
@app.get("/static/extension.crx")
def serve_crx():
    path = STATIC_DIR / "extension.crx"
    if not path.exists():
        return HTTPException(status_code=404, detail="File not found.")

    return FileResponse(path, media_type="application/x-chrome-extension")

@app.get("/static/update.xml")
def serve_xml():
    path = STATIC_DIR / "update.xml"
    if not path.exists():
        return HTTPException(status_code=404, detail="File not found.")

    return FileResponse(path, media_type="application/xml")
