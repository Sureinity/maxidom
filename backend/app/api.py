from models import Payload
from utils import save_features_to_csv
from feature_extraction import FeatureExtractor
from fastapi import FastAPI
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

