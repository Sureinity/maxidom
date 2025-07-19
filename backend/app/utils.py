import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import csv
from datetime import datetime
from pathlib import Path
import joblib

USER_DATA_DIR  = Path(__file__).resolve().parent.parent / "user_data"
ISOLATION_FOREST_PARAMS = {
    'n_estimators': 100,
    'max_samples': 'auto',
    'contamination': 'auto',
    'random_state': 42
}

class UserModelManager:
    """
    Manages the lifecycle of user behavior models:
    - Initial training
    - Saving and loading models
    - Scoring new data
    - Retraining with feedback
    """

    def __init__(self, feature_names, user_data_dir: Path = USER_DATA_DIR):
        """
        Initialize the model manager.
        
        Args:
            user_data_dir: Directory where user data and models are stored
            feature_names: List of feature names used in the feature vector
        """
        self.user_data_dir = user_data_dir
        self.feature_names = feature_names

        # Parameters for the Isolation Forest model
        self.model_params = ISOLATION_FOREST_PARAMS.copy()
  
        # Thresholds for training and retraining
        self.min_samples_for_training = 300
        self.retraining_threshold = 500
 
    def _get_user_dir(self, profile_id) -> Path:
        """Get the directory path for a specific user."""
        user_dir = self.user_data_dir / profile_id
        user_dir.mkdir(exist_ok=True, parents=True)
        return user_dir
    
    def save_features(self, profile_id, feature_vector, is_retraining_sample=False):
        """
        Save a feature vector to a user's feature file or retraining pool.
        
        Args:
            profile_id: User identifier
            feature_vector: Numpy array of features
            is_retraining_sample: If True, save to retraining pool
            
        Returns:
            Count of samples in the file that was updated
        """
        user_dir = self._get_user_dir(profile_id)

        # Determine which file to use
        if is_retraining_sample:
            features_file = user_dir / "retraining_pool.csv"
        else:
            features_file = user_dir / "features.csv"

        # Prepare data for CSV
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        row_data = [timestamp] + feature_vector.tolist()
        headers = ["timestamp"] + self.feature_names

        # Check if file exists
        file_exists = features_file.exists()

        with open(features_file, mode='a', newline='') as file:
            writer = csv.writer(file)
            if not file_exists:
                # Write headers if file is new
                writer.writerow(headers)
            # Write the feature data
            writer.writerow(row_data)

        # Count samples in the updated file
        sample_count = self._count_samples(features_file)

        # For initial training, check if we should train a model
        if not is_retraining_sample:
            if sample_count >= self.min_samples_for_training:
                model_path = user_dir / "model.joblib"
                if not model_path.exists():
                    print(f"Training initial model for user {profile_id} with {sample_count} samples")
                    self.train_initial_model(profile_id)
        else:
            # For retraining samples, check if we need to retrain
            if sample_count >= self.retraining_threshold:
                print(f"Retraining threshold reached for user {profile_id}. Triggering retraining.")
                self.retrain_model(profile_id)

        return sample_count

    def _count_samples(self, file_path: Path):
        """Count the number of samples in a CSV file."""
        if not file_path.is_file():
            return 0
        
        # Count lines in CSV (subtract 1 for header)
        with open(file_path, 'r') as f:
            return sum(1 for _ in f) - 1

    def count_user_samples(self, profile_id):
        """Count the number of training samples for a user."""
        features_file = self._get_user_dir(profile_id) / "features.csv"
        return self._count_samples(features_file)

    def count_retraining_samples(self, profile_id):
        """Count the number of samples in the retraining pool for a user."""
        retraining_file = self._get_user_dir(profile_id) / "retraining_pool.csv"
        return self._count_samples(retraining_file)

    def train_initial_model(self, profile_id):
        """
        Train the initial model for a user.
        
        Returns:
            True if training was successful, False otherwise
        """
        user_dir = self._get_user_dir(profile_id)
        features_file = user_dir / "features.csv"
        model_path = user_dir / "model.joblib"

        # Check if we have enough data
        sample_count = self.count_user_samples(profile_id)
        if sample_count < self.min_samples_for_training:
            print(f"Not enough samples ({sample_count}) for user {profile_id}")
            return False

        try:
            # Load features from CSV (skip timestamp column)
            df = pd.read_csv(features_file)
            features = df.drop('timestamp', axis=1)
            
            # Train the model
            print(f"Training Isolation Forest model for user {profile_id} using {len(features)} samples")
            model = IsolationForest(**self.model_params)
            model.fit(features)
            
            # Save the model
            joblib.dump(model, model_path)
            print(f"Model saved to {model_path}")
            
            # Save metadata
            metadata = {
                "trained_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "samples_used": len(features),
                "model_version": "1.0"
            }
            
            with open(user_dir / "model_metadata.txt", "w") as f:
                for key, value in metadata.items():
                    f.write(f"{key}: {value}\n")
            
            return True
        except Exception as e:
            print(f"Error training model for user {profile_id}: {e}")
            return False
        
    def retrain_model(self, profile_id):
        """
        Retrain a user's model using both original and new data.
        
        Returns:
            True if retraining was successful, False otherwise
        """
        user_dir = self._get_user_dir(profile_id)
        features_file = user_dir / "features.csv"
        retraining_file = user_dir / "retraining_pool.csv"
        model_path = user_dir / "model.joblib"
        
        # Check if both data sources exist
        if not features_file.is_file():
            print(f"Original training data not found for user {profile_id}")
            return False
        
        if not retraining_file.is_file():
            print(f"No retraining data available for user {profile_id}")
            return False
        
        try:
            # Load original training features
            original_df = pd.read_csv(features_file)
            original_features = original_df.drop('timestamp', axis=1)
            
            # Load retraining features
            retraining_df = pd.read_csv(retraining_file)
            retraining_features = retraining_df.drop('timestamp', axis=1)
            
            # Combine datasets
            combined_features = pd.concat([original_features, retraining_features])
            
            # Train new model
            print(f"Retraining model for user {profile_id} using {len(combined_features)} samples " +
                        f"({len(original_features)} original + {len(retraining_features)} new)")
            
            model = IsolationForest(**self.model_params)
            model.fit(combined_features)
            
            # Backup old model
            if model_path.exists():
                backup_path = user_dir / f"model_backup_{datetime.now().strftime('%Y%m%d%H%M%S')}.joblib"
                model_path.rename(backup_path)
                print(f"Previous model backed up to {backup_path}")
            
            # Save new model
            joblib.dump(model, model_path)
            print(f"Retrained model saved to {model_path}")
            
            # Update metadata
            metadata = {
                "trained_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "samples_used": len(combined_features),
                "original_samples": len(original_features),
                "retraining_samples": len(retraining_features),
                "model_version": "2.0"  # Increment version for retrained models
            }
            
            with open(user_dir / "model_metadata.txt", "w") as f:
                for key, value in metadata.items():
                    f.write(f"{key}: {value}\n")
            
            # Clear retraining pool
            with open(retraining_file, "w", newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["timestamp"] + self.feature_names)
            
            print(f"Retraining pool cleared for user {profile_id}")
            
            return True
        except Exception as e:
            print(f"Error retraining model for user {profile_id}: {e}")
            return False

    def load_model(self, profile_id):
        """
        Load the trained model for a user.
        
        Returns:
            The loaded model or None if no model exists
        """
        model_path = self._get_user_dir(profile_id) / "model.joblib"
        if not model_path.exists():
            return None
        
        try:
            model = joblib.load(model_path)
            print(f"Loaded model for user {profile_id}")
            return model
        except Exception as e:
            print(f"Error loading model for user {profile_id}: {e}")
            return None

    def score(self, profile_id, feature_vector):
        """
        Score a feature vector using the user's model.
        
        Args:
            profile_id: User identifier
            feature_vector: Numpy array of features
            
        Returns:
            Dictionary with anomaly score and boolean flag
            
        Raises:
            ValueError if model not found
        """
        model = self.load_model(profile_id)
        if model is None:
            raise ValueError(f"No model exists for user {profile_id}")
        
        # Get raw decision score
        score = model.decision_function([feature_vector])[0]
        
        # Negative scores indicate anomalies
        is_anomaly = score < 0
        
        return {
            "is_anomaly": bool(is_anomaly),
            "score": float(score)
        }
    
    def _get_model_metadata(self, profile_id):
        """Get metadata about a user's model."""
        metadata_file = self._get_user_dir(profile_id) / "model_metadata.txt"
        metadata = {}
        
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                for line in f:
                    if ':' in line:
                        key, value = line.strip().split(':', 1)
                        metadata[key.strip()] = value.strip()
        
        return metadata
        
    def get_retraining_status(self, profile_id):
        """Get status of the retraining process for a user."""
        retraining_count = self.count_retraining_samples(profile_id)
        metadata = self._get_model_metadata(profile_id)

        return {
            "profile_id": profile_id,
            "retraining_samples": retraining_count,
            "retraining_threshold": self.retraining_threshold,
            "progress_percentage": (retraining_count / self.retraining_threshold) * 100 if self.retraining_threshold > 0 else 0,
            "model_metadata": metadata
        }
