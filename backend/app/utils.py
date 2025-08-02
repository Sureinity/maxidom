import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import csv
from datetime import datetime
from pathlib import Path
import joblib
import logging
import json

logger = logging.getLogger(__name__)

# Parameters for the Isolation Forest model
ISOLATION_FOREST_PARAMS = {
    'n_estimators': 100,
    'max_samples': 'auto',
    'contamination': 'auto',
    'random_state': 42
}

class UserModelManager:
    """
    Manages the lifecycle of user behavior models:
    - Storing raw payloads and feature data
    - Training, saving, and loading models
    - Scoring new data
    """

    def __init__(self, feature_names, user_data_dir: Path):
        """
        Initialize the model manager.
        
        Args:
            feature_names: List of feature names used in the feature vector
            user_data_dir: Directory where user data and models are stored
        """
        self.user_data_dir = user_data_dir
        self.feature_names = feature_names
        self.model_params = ISOLATION_FOREST_PARAMS.copy()
  
        # Diversity thresholds
        self.min_samples_for_training = 300
        self.min_keyboard_samples = 50 
        self.min_mouse_samples = 150 
        self.retraining_threshold = 500
 
    def _get_user_dir(self, profile_id) -> Path:
        """Get the directory path for a specific user."""
        user_dir = self.user_data_dir / profile_id
        user_dir.mkdir(exist_ok=True, parents=True)
        return user_dir
    
    def save_raw_payload(self, profile_id: str, payload_dict: dict, is_retraining_sample: bool = False):
        """
        Saves the complete raw JSON payload to a .jsonl file for archival and debugging.
        """
        user_dir = self._get_user_dir(profile_id)
        raw_data_dir = user_dir / "raw_data"
        raw_data_dir.mkdir(exist_ok=True)
        
        target_file = raw_data_dir / "retraining_raw.jsonl" if is_retraining_sample else raw_data_dir / "profiling_raw.jsonl"
        
        try:
            with open(target_file, 'a') as f:
                f.write(json.dumps(payload_dict) + '\n')
            logger.info(f"Raw payload saved to {target_file}")
        except Exception as e:
            logger.error(f"Failed to save raw payload for {profile_id}: {e}")

    def save_features(self, profile_id: str, feature_vector: np.ndarray, is_retraining_sample: bool = False) -> int:
        """
        Save a feature vector to a user's feature file or retraining pool.
        """
        user_dir = self._get_user_dir(profile_id)
        
        features_file = user_dir / "retraining_pool.csv" if is_retraining_sample else user_dir / "features.csv"

        file_exists = features_file.exists()
        with open(features_file, mode='a', newline='') as file:
            writer = csv.writer(file)
            if not file_exists:
                writer.writerow(["timestamp"] + self.feature_names)
            writer.writerow([datetime.now().strftime("%Y-%m-%d %H:%M:%S")] + feature_vector.tolist())

        return self._count_samples(features_file)

    def _count_samples(self, file_path: Path):
        """Count the number of samples in a CSV file, ignoring the header."""
        if not file_path.is_file():
            return 0
        with open(file_path, 'r') as f:
            return max(0, sum(1 for _ in f) - 1)

    def check_diversity(self, profile_id: str) -> dict:
        """
        Checks the diversity of the collected training data against thresholds.
        """
        features_file = self._get_user_dir(profile_id) / "features.csv"
        if not features_file.exists():
            return {
                "total_samples": {"current": 0, "required": self.min_samples_for_training},
                "keyboard_samples": {"current": 0, "required": self.min_keyboard_samples},
                "mouse_samples": {"current": 0, "required": self.min_mouse_samples},
                "is_ready": False
            }

        df = pd.read_csv(features_file)
        
        keyboard_activity_col = "avg_dwell_time_alpha" 
        mouse_activity_col = "avg_mouse_speed"

        total = len(df)
        keyboard = len(df[df[keyboard_activity_col] > 0])
        mouse = len(df[df[mouse_activity_col] > 0])

        is_ready = (
            total >= self.min_samples_for_training and
            keyboard >= self.min_keyboard_samples and
            mouse >= self.min_mouse_samples
        )

        return {
            "total_samples": {"current": total, "required": self.min_samples_for_training},
            "keyboard_samples": {"current": keyboard, "required": self.min_keyboard_samples},
            "mouse_samples": {"current": mouse, "required": self.min_mouse_samples},
            "is_ready": is_ready
        }

    def train_initial_model(self, profile_id):
        """Train the initial model for a user as a background task."""
        user_dir = self._get_user_dir(profile_id)
        features_file = user_dir / "features.csv"
        model_path = user_dir / "model.joblib"

        try:
            df = pd.read_csv(features_file)
            features = df[self.feature_names]
            
            logger.info(f"Training Isolation Forest model for user {profile_id} using {len(features)} samples")
            model = IsolationForest(**self.model_params)
            model.fit(features)
            
            temp_model_path = model_path.with_suffix(".joblib.tmp")
            joblib.dump(model, temp_model_path)
            temp_model_path.rename(model_path)

            logger.info(f"Model saved to {model_path}")
            return True
        except Exception as e:
            logger.error(f"Error training model for user {profile_id}: {e}", exc_info=True)
            return False
        
    def retrain_model(self, profile_id):
        """Retrain a user's model as a background task."""
        user_dir = self._get_user_dir(profile_id)
        features_file = user_dir / "features.csv"
        retraining_file = user_dir / "retraining_pool.csv"
        model_path = user_dir / "model.joblib"

        if not features_file.is_file() or not retraining_file.is_file():
            logger.warning("Missing data for retraining, aborting.")
            return False

        try:
            original_df = pd.read_csv(features_file)
            retraining_df = pd.read_csv(retraining_file)
            
            combined_features = pd.concat([original_df[self.feature_names], retraining_df[self.feature_names]])
            
            logger.info(f"Retraining model for user {profile_id} using {len(combined_features)} samples.")
            model = IsolationForest(**self.model_params)
            model.fit(combined_features)
            
            temp_model_path = model_path.with_suffix(".joblib.tmp")
            joblib.dump(model, temp_model_path)
            temp_model_path.rename(model_path)
            logger.info(f"Retrained model saved to {model_path}")
            
            retraining_file.write_text(f"timestamp,{','.join(self.feature_names)}\n")
            logger.info(f"Retraining pool cleared for user {profile_id}")
            
            return True
        except Exception as e:
            logger.error(f"Error retraining model for user {profile_id}: {e}", exc_info=True)
            return False

    def load_model(self, profile_id):
        """Load a user's model."""
        model_path = self._get_user_dir(profile_id) / "model.joblib"
        if not model_path.exists():
            return None
        return joblib.load(model_path)

    def score(self, profile_id, feature_vector):
        """Score new data for a user."""
        model = self.load_model(profile_id)
        if model is None:
            raise ValueError(f"No model exists for user {profile_id}")
        
        features_df = pd.DataFrame([feature_vector], columns=self.feature_names)
        
        score = model.decision_function(features_df)[0]
        is_anomaly = score < 0
        
        return {"is_anomaly": bool(is_anomaly), "score": float(score)}
