import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import csv
from datetime import datetime
from pathlib import Path
import joblib
import logging
import json
import shutil
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

# Parameters for the Isolation Forest model
ISOLATION_FOREST_PARAMS = {
    'n_estimators': 100,
    'max_samples': 'auto',
    'contamination': 0.01,
    'random_state': 42
}

# Define the percentile for the dynamic threshold.
THRESHOLD_PERCENTILE = 5

class UserModelManager:
    """
    Manages the lifecycle of user behavior models using a "Dissect and Score"
    specialist approach with Dynamic Anomaly Thresholding.
    """

    def __init__(self, feature_names, user_data_dir: Path):
        """
        Initialize the model manager.
        
        Args:
            feature_names: The complete list of feature names from the extractor.
            user_data_dir: Directory where user data and models are stored.
        """
        self.user_data_dir = user_data_dir
        self.all_feature_names = feature_names
        
        self.mouse_features = [
            "avg_mouse_speed", "std_mouse_speed", "avg_mouse_acceleration",
            "std_mouse_acceleration", "path_straightness", "avg_click_duration",
            "avg_pause_duration", "pause_frequency", "avg_turn_angle",
            "avg_stroke_velocity"
        ]
        self.typing_features = [
            "avg_dwell_time_alpha", "avg_flight_time_digraph",
            "std_flight_time_digraph", "typing_speed_kps"
        ]
        
        self.model_params = ISOLATION_FOREST_PARAMS.copy()
  
        # Diversity thresholds for the entire dataset before training begins
        self.min_samples_for_training = 300
        self.min_keyboard_samples = 50 
        self.min_mouse_samples = 150 
        # Retraining parameters are removed as the model is now static.
 
    def _get_user_dir(self, profile_id) -> Path:
        """Get the directory path for a specific user, creating it if necessary."""
        user_dir = self.user_data_dir / profile_id
        user_dir.mkdir(exist_ok=True, parents=True)
        return user_dir
    
    def save_raw_payload(self, profile_id: str, payload_dict: dict):
        """Saves the raw JSON payload to a .jsonl file for archival."""
        user_dir = self._get_user_dir(profile_id)
        raw_data_dir = user_dir / "raw_data"
        raw_data_dir.mkdir(exist_ok=True)
        
        target_file = raw_data_dir / "profiling_raw.jsonl"
        
        try:
            with open(target_file, 'a') as f:
                f.write(json.dumps(payload_dict) + '\\n')
        except Exception as e:
            logger.error(f"Failed to save raw payload for {profile_id}: {e}")

    def save_features(self, profile_id: str, feature_vector: np.ndarray) -> int:
        """Saves a feature vector to the foundational features.csv file."""
        user_dir = self._get_user_dir(profile_id)
        
        features_file = user_dir / "features.csv"

        file_exists = features_file.exists()
        with open(features_file, mode='a', newline='') as file:
            writer = csv.writer(file)
            if not file_exists:
                writer.writerow(["timestamp"] + self.all_feature_names)
            writer.writerow([datetime.now().strftime("%Y-%m-%d %H:%M:%S")] + feature_vector.tolist())

        return self._count_samples(features_file)

    def _count_samples(self, file_path: Path):
        """Counts the number of data rows in a CSV file."""
        if not file_path.is_file():
            return 0
        with open(file_path, 'r') as f:
            return max(0, sum(1 for _ in f) - 1)

    def check_diversity(self, profile_id: str) -> dict:
        """Checks if the collected training data meets the minimum diversity criteria."""
        features_file = self._get_user_dir(profile_id) / "features.csv"
        if not features_file.exists():
            return {
                "total_samples": {"current": 0, "required": self.min_samples_for_training},
                "keyboard_samples": {"current": 0, "required": self.min_keyboard_samples},
                "mouse_samples": {"current": 0, "required": self.min_mouse_samples},
                "digraph_samples": {"current": 0, "required": 30},
                "is_ready": False
            }

        df = pd.read_csv(features_file)
        
        keyboard_activity_col = "typing_speed_kps" 
        mouse_activity_col = "avg_mouse_speed"
        digraph_activity_col = "avg_flight_time_digraph"

        total = len(df)
        keyboard = len(df[df[keyboard_activity_col] > 0])
        mouse = len(df[df[mouse_activity_col] > 0])
        digraphs = len(df[df[digraph_activity_col] > 0])

        is_ready = (
            total >= self.min_samples_for_training and
            keyboard >= self.min_keyboard_samples and
            mouse >= self.min_mouse_samples and
            digraphs >= 30
        )

        return {
            "total_samples": {"current": total, "required": self.min_samples_for_training},
            "keyboard_samples": {"current": keyboard, "required": self.min_keyboard_samples},
            "mouse_samples": {"current": mouse, "required": self.min_mouse_samples},
            "digraph_samples": {"current": digraphs, "required": 30},
            "is_ready": is_ready
        }

    def train_initial_model(self, profile_id: str):
        """
        Loads the full feature set and trains two pure specialist models:
        one for all mouse activity and one for all typing activity.
        """
        user_dir = self._get_user_dir(profile_id)
        features_file = user_dir / "features.csv"
        if not features_file.is_file():
            logger.error(f"Cannot train model: features.csv not found for {profile_id}")
            return False

        try:
            df = pd.read_csv(features_file)
            
            # Select all sessions where mouse activity occurred for the mouse model.
            df_mouse_all = df[df["avg_mouse_speed"] > 0]
            
            # Select all sessions where typing activity occurred for the typing model.
            df_typing_all = df[df["typing_speed_kps"] > 0]

            logger.info(f"Segmenting data for {profile_id}: "
                        f"{len(df_mouse_all)} samples for mouse model, "
                        f"{len(df_typing_all)} samples for typing model.")

            # Train and save the two specialist models. The mixed model is removed.
            self._train_and_save_specialist(df_mouse_all, self.mouse_features, "mouse", profile_id)
            self._train_and_save_specialist(df_typing_all, self.typing_features, "typing", profile_id)
            return True
        except Exception as e:
            logger.error(f"Error during specialist model training for {profile_id}: {e}", exc_info=True)
            return False

    def _train_and_save_specialist(self, df: pd.DataFrame, feature_subset: List[str], model_type: str, profile_id: str):
        """Helper function to train, calibrate, and save a single specialist model package."""
        if len(df) < 20: 
            logger.warning(f"Skipping {model_type} model for {profile_id}: only {len(df)} samples.")
            return

        user_dir = self._get_user_dir(profile_id)
        model_path = user_dir / f"model_{model_type}.joblib"
        features = df[feature_subset]
        
        logger.info(f"Training {model_type} model for {profile_id} with {len(features)} samples.")
        model = IsolationForest(**self.model_params)
        model.fit(features)
        
        scores = model.decision_function(features)
        threshold = np.percentile(scores, THRESHOLD_PERCENTILE)
        logger.info(f"Calibrated dynamic threshold for '{model_type}' model: {threshold:.4f}")
        
        model_package = {'model': model, 'threshold': threshold}

        temp_model_path = model_path.with_suffix(".joblib.tmp")
        joblib.dump(model_package, temp_model_path)
        temp_model_path.rename(model_path)
        logger.info(f"Saved {model_type} model package to {model_path}")

    def load_model_package(self, profile_id: str, model_type: str):
        """Loads a model package containing the model and its threshold."""
        model_path = self._get_user_dir(profile_id) / f"model_{model_type}.joblib"
        if not model_path.exists():
            return None
        return joblib.load(model_path)

    def score(self, profile_id, feature_vector: np.ndarray) -> Dict[str, Any]:
        """
        Scores new data by dissecting the session and scoring mouse and
        typing components with their respective specialist models.
        """
        features_df = pd.DataFrame([feature_vector], columns=self.all_feature_names)
        
        is_mouse_active = features_df.iloc[0]["avg_mouse_speed"] > 0
        is_typing_active = features_df.iloc[0]["typing_speed_kps"] > 0
        
        mouse_score, typing_score = 0.1, 0.1  # Default to a high "normal" score
        mouse_threshold, typing_threshold = 0.0, 0.0
        
        # --- The Dissect and Score Logic ---
        
        # If there is mouse activity, score it with the mouse model.
        if is_mouse_active:
            mouse_package = self.load_model_package(profile_id, "mouse")
            if mouse_package:
                mouse_model = mouse_package['model']
                mouse_threshold = mouse_package['threshold']
                mouse_features = features_df[self.mouse_features]
                mouse_score = mouse_model.decision_function(mouse_features)[0]
        
        # If there is typing activity, score it with the typing model.
        if is_typing_active:
            typing_package = self.load_model_package(profile_id, "typing")
            if typing_package:
                typing_model = typing_package['model']
                typing_threshold = typing_package['threshold']
                typing_features = features_df[self.typing_features]
                typing_score = typing_model.decision_function(typing_features)[0]

        # Final Decision Rule: If EITHER specialist detects an anomaly, the session is anomalous.
        is_anomaly = (mouse_score < mouse_threshold) or (typing_score < typing_threshold)
        
        # For logging, return the score that is more anomalous (the lower one).
        final_score = min(mouse_score, typing_score)
        
        return {
            "is_anomaly": bool(is_anomaly), 
            "score": float(final_score),
            "typing_threshold": float(typing_threshold),
            "mouse_threshold": float(mouse_threshold),
            "mouse_score": float(mouse_score),
            "typing_score": float(typing_score)
        }
        
    def delete_user_data(self, profile_id: str) -> bool:
        """
        Permanently deletes all data associated with a profile ID.
        """
        user_dir = self._get_user_dir(profile_id)
        if not user_dir.exists():
            logger.info(f"No data directory to delete for profile: {profile_id}")
            return True
        
        try:
            shutil.rmtree(user_dir)
            logger.info(f"Successfully deleted all data for profile: {profile_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete data directory for profile {profile_id}: {e}", exc_info=True)
            return False
