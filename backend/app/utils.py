import numpy as np
import csv
from pathlib import Path

USER_DATA_DIR  = Path(__file__).resolve().parent.parent / "user_data"

def save_features_to_csv(userId: str,  feature_vector: np.ndarray):
    """
    Save extracted feature vector to a CSV file for the user.
    Each row represents one sample with timestamp and feature values.
    """
    user_dir = Path(USER_DATA_DIR) / userId
    user_dir.mkdir(exist_ok=True, parents=True)

