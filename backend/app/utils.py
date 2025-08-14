import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import csv
from datetime import datetime
from pathlib import Path
import joblib
import logging
import json
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Parameters for the Isolation Forest model (tuned from our last test)
ISOLATION_FOREST_PARAMS = {
    'n_estimators': 100,
    'max_samples': 'auto',
    'contamination': 0.01, # Start with a low contamination assumption for clean data
    'random_state': 42
}

class UserModelManager:
    """
    Manages the lifecycle of user behavior models using a "Specialist Models" approach.
    - One model for typing-only behavior.
    - One model for mouse-only behavior.
    - One model for mixed-activity behavior.
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
        
        # Define which features belong to which specialist model
        self.mouse_features = [
            "avg_mouse_speed", "std_mouse_speed", "avg_mouse_acceleration",
            "std_mouse_acceleration", "path_straightness", "avg_click_duration",
            "avg_pause_duration", "pause_frequency"
        ]
        self.typing_features = [
            "avg_dwell_time_alpha", "avg_flight_time_digraph", "typing_speed_kps"
        ]
        
        self.model_params = ISOLATION_FOREST_PARAMS.copy()
  
        # Diversity thresholds for the entire dataset before training begins
        self.min_samples_for_training = 300
        self.min_keyboard_samples = 50 
        self.min_mouse_samples = 150 
        self.retraining_threshold = 500
 
    def _get_user_dir(self, profile_id) -> Path:
        """Get the directory path for a specific user, creating it if necessary."""
        user_dir = self.user_data_dir / profile_id
        user_dir.mkdir(exist_ok=True, parents=True)
        return user_dir
    
    def save_raw_payload(self, profile_id: str, payload_dict: dict, is_retraining_sample: bool = False):
        """Saves the raw JSON payload to a .jsonl file for archival."""
        user_dir = self._get_user_dir(profile_id)
        raw_data_dir = user_dir / "raw_data"
        raw_data_dir.mkdir(exist_ok=True)
        
        target_file = raw_data_dir / "retraining_raw.jsonl" if is_retraining_sample else raw_data_dir / "profiling_raw.jsonl"
        
        try:
            with open(target_file, 'a') as f:
                f.write(json.dumps(payload_dict) + '\n')
        except Exception as e:
            logger.error(f"Failed to save raw payload for {profile_id}: {e}")

    def save_features(self, profile_id: str, feature_vector: np.ndarray, is_retraining_sample: bool = False) -> int:
        """Saves a feature vector to the appropriate CSV file."""
        user_dir = self._get_user_dir(profile_id)
        
        features_file = user_dir / "retraining_pool.csv" if is_retraining_sample else user_dir / "features.csv"

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
                "is_ready": False
            }

        df = pd.read_csv(features_file)
        
        keyboard_activity_col = "typing_speed_kps" 
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

    def train_initial_model(self, profile_id: str):
        """Loads the full feature set, segments it, and trains three specialist models."""
        user_dir = self._get_user_dir(profile_id)
        features_file = user_dir / "features.csv"
        if not features_file.is_file():
            logger.error(f"Cannot train model: features.csv not found for {profile_id}")
            return False

        try:
            df = pd.read_csv(features_file)
            
            # Segment the data based on activity type
            is_mouse_active = df["avg_mouse_speed"] > 0
            is_typing_active = df["typing_speed_kps"] > 0
            
            df_mouse_only = df[is_mouse_active & ~is_typing_active]
            df_typing_only = df[~is_mouse_active & is_typing_active]
            df_mixed = df[is_mouse_active & is_typing_active]

            logger.info(f"Segmenting data for {profile_id}: "
                        f"{len(df_mouse_only)} mouse-only, "
                        f"{len(df_typing_only)} typing-only, "
                        f"{len(df_mixed)} mixed sessions.")

            # Train and save each specialist model
            self._train_and_save_specialist(df_mouse_only, self.mouse_features, "mouse", profile_id)
            self._train_and_save_specialist(df_typing_only, self.typing_features, "typing", profile_id)
            self._train_and_save_specialist(df_mixed, self.all_feature_names, "mixed", profile_id)

            return True
        except Exception as e:
            logger.error(f"Error during specialist model training for {profile_id}: {e}", exc_info=True)
            return False

    def _train_and_save_specialist(self, df: pd.DataFrame, feature_subset: List[str], model_type: str, profile_id: str):
        """Helper function to train and save a single specialist model."""
        if len(df) < 20: 
            logger.warning(f"Skipping {model_type} model for {profile_id}: only {len(df)} samples, which is below the minimum of 20.")
            return

        user_dir = self._get_user_dir(profile_id)
        model_path = user_dir / f"model_{model_type}.joblib"
        
        features = df[feature_subset]
        
        logger.info(f"Training {model_type} model for {profile_id} with {len(features)} samples.")
        model = IsolationForest(**self.model_params)
        model.fit(features)
        
        temp_model_path = model_path.with_suffix(".joblib.tmp")
        joblib.dump(model, temp_model_path)
        temp_model_path.rename(model_path)
        logger.info(f"Saved {model_type} model to {model_path}")

    def load_model(self, profile_id: str, model_type: str):
        """Loads a specific specialist model."""
        model_path = self._get_user_dir(profile_id) / f"model_{model_type}.joblib"
        if not model_path.exists():
            return None
        return joblib.load(model_path)

    def score(self, profile_id, feature_vector: np.ndarray) -> Dict[str, Any]:
        """Scores new data by routing it to the appropriate specialist model."""
        features_df = pd.DataFrame([feature_vector], columns=self.all_feature_names)
        
        # --- The Router Logic ---
        is_mouse_active = features_df.iloc[0]["avg_mouse_speed"] > 0
        is_typing_active = features_df.iloc[0]["typing_speed_kps"] > 0
        
        model_type = "mixed"
        feature_subset = self.all_feature_names
        if is_mouse_active and not is_typing_active:
            model_type = "mouse"
            feature_subset = self.mouse_features
        elif not is_mouse_active and is_typing_active:
            model_type = "typing"
            feature_subset = self.typing_features
        
        logger.info(f"Routing to '{model_type}' model for scoring.")
        
        model = self.load_model(profile_id, model_type)
        if model is None:
            logger.warning(f"Specialist model '{model_type}' not found for {profile_id}. Falling back to 'mixed' model.")
            model = self.load_model(profile_id, "mixed")
            model_type = "mixed" # Explicitly set model type for the response
            feature_subset = self.all_feature_names
            if model is None:
                raise ValueError(f"No suitable models (specialist or mixed) found for user {profile_id}")

        score_features = features_df[feature_subset]
        score = model.decision_function(score_features)[0]
        is_anomaly = score < 0
        
        return {"is_anomaly": bool(is_anomaly), "score": float(score), "model_used": model_type}

    def retrain_model(self, profile_id):
        """
        Retrains all specialist models using data from the original and retraining pools.
        This would be triggered when the retraining_pool.csv hits its threshold.
        """
        user_dir = self._get_user_dir(profile_id)
        features_file = user_dir / "features.csv"
        retraining_file = user_dir / "retraining_pool.csv"
        
        if not features_file.is_file() or not retraining_file.is_file():
            logger.warning("Missing data for retraining, aborting.")
            return False

        try:
            original_df = pd.read_csv(features_file)
            retraining_df = pd.read_csv(retraining_file)
            
            combined_df = pd.concat([original_df, retraining_df], ignore_index=True)
            
            # Re-run the same segmentation and training logic as the initial training
            is_mouse_active = combined_df["avg_mouse_speed"] > 0
            is_typing_active = combined_df["typing_speed_kps"] > 0
            
            df_mouse_only = combined_df[is_mouse_active & ~is_typing_active]
            df_typing_only = combined_df[~is_mouse_active & is_typing_active]
            df_mixed = combined_df[is_mouse_active & is_typing_active]
            
            logger.info(f"Retraining specialist models for user {profile_id} with {len(combined_df)} total samples.")
            
            self._train_and_save_specialist(df_mouse_only, self.mouse_features, "mouse", profile_id)
            self._train_and_save_specialist(df_typing_only, self.typing_features, "typing", profile_id)
            self._train_and_save_specialist(df_mixed, self.all_feature_names, "mixed", profile_id)
            
            # Clear retraining pool after successful retraining of all models
            retraining_file.write_text(f"timestamp,{','.join(self.all_feature_names)}\n")
            logger.info(f"Retraining pool cleared for user {profile_id}")
            
            return True
        except Exception as e:
            logger.error(f"Error retraining model for user {profile_id}: {e}", exc_info=True)
            return False
