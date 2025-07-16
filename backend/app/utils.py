import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import csv
from datetime import datetime
from pathlib import Path
import joblib


USER_DATA_DIR  = Path(__file__).resolve().parent.parent / "user_data"
MIN_SAMPLES_FOR_TRAINING = 300
ISOLATION_FOREST_PARAMS = {
    'n_estimators': 100,
    'max_samples': 'auto',
    'contamination': 'auto',
    'random_state': 42
}

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

def save_features_to_csv(profile_id: str,  feature_vector: np.ndarray):
    """
    Save extracted feature vector to a CSV file for the user.
    Each row represents one sample with timestamp and feature values.
    """
    user_dir = Path(USER_DATA_DIR) / profile_id
    user_dir.mkdir(exist_ok=True, parents=True)

    features_file = user_dir / "features.csv"

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    row_data = [timestamp] + feature_vector.tolist()
    headers = ["timestamp"] + FEATURE_NAMES

    # Check if file exists to determine if we need to write headers
    file_exists = features_file.exists()

    # Write to CSV
    with open(features_file, "a", newline='') as file:
        writer = csv.writer(file)
        if not file_exists:
            writer.writerow(headers)
        writer.writerow(row_data)
    
    sample_count = count_user_samples(profile_id)
    
    if sample_count >= MIN_SAMPLES_FOR_TRAINING:
        model_path = user_dir / "model.joblib"
        if not model_path.exists():
            train_model(profile_id)

    return sample_count
    
def count_user_samples(profile_id: str) -> int:
    """
    Count the number of samples stored for a specific user.
    """
    features_file = Path(USER_DATA_DIR) / profile_id / "features.csv"
    if not features_file.exists():
        return 0
    
    # Count lines in CSV file (subtract 1 for header)
    with open(features_file, "r") as file:
        return sum(1 for _ in file) - 1
    
def train_model(profile_id: str):
    """
    Train an Isolation Forest model on the user's feature data.
    Returns True if training was successful, False otherwise.
    """
    user_dir = Path(USER_DATA_DIR) / profile_id
    features_file = user_dir / "features.csv"
    model_path = user_dir / "model.joblib"

    sample_count = count_user_samples(profile_id)

    if sample_count < MIN_SAMPLES_FOR_TRAINING:
        print(f"Not enough samples ({sample_count}) to train model for user {profile_id}")
        return False
    
    try:
        df = pd.read_csv(features_file)
        features = df.drop('timestamp', axis=1)

        # Train Isolation Forest Model
        model = IsolationForest(**ISOLATION_FOREST_PARAMS)
        model.fit(features)

        # Save trained model
        joblib.dump(model, model_path)
        return True
    except Exception as e:
        print(f"Error training model for user {profile_id}: {e}")
        return False
