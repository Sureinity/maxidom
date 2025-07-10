import numpy as np
import csv
from datetime import datetime
from pathlib import Path

USER_DATA_DIR  = Path(__file__).resolve().parent.parent / "user_data"

def save_features_to_csv(userId: str,  feature_vector: np.ndarray):
    """
    Save extracted feature vector to a CSV file for the user.
    Each row represents one sample with timestamp and feature values.
    """
    user_dir = Path(USER_DATA_DIR) / userId
    user_dir.mkdir(exist_ok=True, parents=True)

    features_file = user_dir / "feautures.csv"

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    row_data = [timestamp] + feature_vector.tolist()
    headers = ["timestamp"] + FEATURE_NAMES

    # Check if file exists to determine if we need to write headers
    file_exists = features_file.exist()

    # Write to CSV
    with open(features_file, "a", newline='') as file:
        writer = csv.writer(file)
        if not file_exists:
            writer.writerow(headers)
        writer.writerow(row_data)
    
    sample_count = count_user_samples(userId)
    return sample_count
    
def count_user_samples(userId: str) -> int:
    """
    Count the number of samples stored for a specific user.
    """
    features_file = Path(USER_DATA_DIR) / userId / "features.csv"
    if not features_file.exists():
        return 0
    
    # Count lines in CSV file (subtract 1 for header)
    with open(features_file, "r") as file:
        return sum(1 for _ in file) - 1