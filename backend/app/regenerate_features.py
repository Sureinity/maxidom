# A command-line utility to process raw session data and generate a NEW feature file
# in the 'raw_data' directory for manual inspection and use.
# This script does NOT overwrite the live 'features.csv' or 'retraining_pool.csv'.

import argparse
import json
import logging
import sys
import csv
from pathlib import Path
from tqdm import tqdm  # For a nice progress bar
from datetime import datetime

# Import our existing project modules
from feature_extraction import FeatureExtractor
from utils import UserModelManager # We still use this for path helpers

#  Logging Setup 
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

def main(profile_id: str, raw_filename: str, output_filename: str):
    """
    Main function to process a raw data file and generate a new feature CSV.

    Args:
        profile_id: The UUID of the user profile to process.
        raw_filename: The name of the raw data file (e.g., 'profiling_raw.jsonl').
        output_filename: The name of the new CSV file to create (e.g., 'manual_features.csv').
    """
    logger.info(f"Starting feature regeneration for profile: {profile_id}")
    logger.info(f"Processing raw data from: {raw_filename}")

    #  Initialization 
    feature_extractor = FeatureExtractor()
    feature_names = feature_extractor.get_feature_names()
    
    # We use UserModelManager just to easily get the user directory path
    user_data_dir = Path(__file__).resolve().parent / "user_data"
    model_manager = UserModelManager(feature_names, user_data_dir)

    #  File Path Validation and Setup 
    user_dir = model_manager._get_user_dir(profile_id)
    raw_data_dir = user_dir / "raw_data"
    raw_data_path = raw_data_dir / raw_filename
    
    if not raw_data_path.exists():
        logger.error(f"Error: Raw data file not found at {raw_data_path}")
        sys.exit(1)

    # The output file will be saved inside the 'raw_data' directory.
    output_csv_path = raw_data_dir / output_filename
    
    # Check if output file already exists to prevent accidental overwrites without warning.
    if output_csv_path.exists():
        logger.warning(f"Output file '{output_filename}' already exists in the raw_data directory. It will be overwritten.")
    
    #  Processing Loop 
    try:
        # Get total number of lines for the progress bar
        with open(raw_data_path, 'r') as f:
            num_lines = sum(1 for line in f)

        # Open the output CSV file for writing
        with open(output_csv_path, 'w', newline='') as csvfile:
            writer = csv.writer(csvfile)
            # Write the header row
            writer.writerow(["timestamp"] + feature_names)

            with open(raw_data_path, 'r') as f:
                logger.info(f"Processing {num_lines} sessions...")
                # Use tqdm for a visual progress bar
                for line in tqdm(f, total=num_lines, unit=" sessions"):
                    payload_dict = json.loads(line)
                    
                    # Extract features from the payload
                    feature_vector = feature_extractor.extract_features(payload_dict)
                    
                    # Write the new feature vector to the output CSV
                    writer.writerow([datetime.now().strftime("%Y-%m-%d %H:%M:%S")] + feature_vector.tolist())

        logger.info("=" * 50)
        logger.info(f"✅ Successfully generated features into '{output_filename}'")
        logger.info(f"   The new file is located at: {output_csv_path}")
        logger.info("=" * 50)

    except Exception as e:
        logger.error(f"An error occurred during processing: {e}", exc_info=True)
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Regenerate feature CSV files from raw .jsonl data."
    )
    parser.add_argument(
        "profile_id",
        type=str,
        help="The UUID of the user profile."
    )
    parser.add_argument(
        "raw_filename",
        type=str,
        choices=['profiling_raw.jsonl', 'retraining_raw.jsonl'],
        help="The name of the raw data file to process."
    )
    parser.add_argument(
        "--output",
        type=str,
        default="manual_features.csv",
        help="The name for the output CSV file (default: manual_features.csv)."
    )
    args = parser.parse_args()
    main(args.profile_id, args.raw_filename, args.output)
