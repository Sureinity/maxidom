from models import Payload
from feature_extraction import FeatureExtractor
from utils import (
    USER_DATA_DIR,
    MIN_SAMPLES_FOR_TRAINING,
    save_features_to_csv,
    train_model,
    load_model,
    score_features
)
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
feature_extractor = FeatureExtractor()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/train/{userId}")
def user_data(userId:str, payload: Payload):
    """
    Endpoint for receiving user data during the profiling phase.
    Extracts features and stores them in user-specific CSV file.
    """
    # Convert Pydantic model to dict for feature extraction
    payload_dict = payload.dict()

    feature_vector = feature_extractor.extract_features(payload_dict)
    sample_count = save_features_to_csv(userId, feature_vector)
    
    # Return status information including sample count
    return {
        "status": "training data received",
        "profile_id": userId,
        "samples_collected": sample_count,
        "features": feature_vector.tolist()  # Convert numpy array to list for JSON serialization
    }

@app.post("/api/score/{userId}")
def score_user_data(userId: str, payload: Payload):
    """
    Endpoint for scoring user data against a trained model.
    Returns an anomaly score and detection result.
    """

    # Check if user directory exists
    user_dir = USER_DATA_DIR / userId
    if not user_dir.exists():
        raise HTTPException(status_code=404, detail=f"User {userId} not found")
    
    # Check and load model
    model = load_model(userId)
    if not model:
        # Check if we have enough data to train a model
        sample_count = count_user_samples(userId)
        if sample_count >= MIN_SAMPLES_FOR_TRAINING:
            # Try to train the model now
            if train_model(userId):
                model = load_model(userId)
            else:
                raise HTTPException(status_code=500, detail="Failed to train model")
        
        if model is None:  # Still no model
            raise HTTPException(status_code=404, detail="Model not found or not enough training data")
        
    payload_dict = payload.dict()
    feature_vector = feature_extractor.extract_features()

    result = score_features(model, feature_vector)

    # If this was normal behavior (not an anomaly), save it for potential retraining
    if not result["is_anomaly"]:
        # Save to retraining pool
        save_features_to_csv(userId, feature_vector)
        print(f"Normal behavior sample saved for user {userId}")
    
    return result