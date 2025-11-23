import pandas as pd
import requests
import json
import time
import sys

# --- Configuration ---
# Allows passing the CSV file as a command-line argument for flexibility.
# Example usage:
# python run_test.py normal.csv
# python run_test.py attacker.csv

if len(sys.argv) > 1:
    # Use the first command-line argument as the path to the CSV.
    CSV_PATH = sys.argv[1]
else:
    # Default to a file named 'attacker.csv' if no argument is given.
    print("Usage: python run_test.py <path_to_csv_file>")
    print("Defaulting to 'attacker.csv'.")
    CSV_PATH = 'attacker.csv'

# IMPORTANT: Update this with the profile_id you are testing against.
PROFILE_ID = 'a6c60b0c-63ca-49eb-aad2-2d9fdca710c9' 
API_ENDPOINT = f"http://127.0.0.1:8000/api/test_score_row/{PROFILE_ID}"

# --- Script Logic ---
print(f"--- Starting Simulation for profile {PROFILE_ID} ---")
print(f"--- Using data from: {CSV_PATH} ---")

try:
    df = pd.read_csv(CSV_PATH)
except FileNotFoundError:
    print(f"\nERROR: File not found at '{CSV_PATH}'. Please check the path.")
    sys.exit(1)

anomaly_count = 0
normal_count = 0

# Store counts for each model type to see which one is working.
model_usage_counts = {
    "mouse": {"anomalies": 0, "total": 0},
    "typing": {"anomalies": 0, "total": 0},
    "mixed": {"anomalies": 0, "total": 0},
}

for index, row in df.iterrows():
    # Convert the row to a dictionary, ensuring no NaN values are sent.
    feature_dict = row.where(pd.notna(row), None).to_dict()
    
    try:
        response = requests.post(API_ENDPOINT, json=feature_dict)
        response.raise_for_status() # Raise an exception for bad status codes (4xx or 5xx).
        
        result = response.json()
        score = result.get('score', 0)
        is_anomaly = result.get('is_anomaly', False)
        model_used = result.get('model_used', 'unknown')

        # Update model usage stats.
        if model_used in model_usage_counts:
            model_usage_counts[model_used]["total"] += 1
            if is_anomaly:
                model_usage_counts[model_used]["anomalies"] += 1

        if is_anomaly:
            anomaly_count += 1
            print(f"Row {index+1}: 🚨 ANOMALY DETECTED! Score: {score:.4f} (Model: {model_used})")
        else:
            normal_count += 1
            print(f"Row {index+1}: ✅ Normal. Score: {score:.4f} (Model: {model_used})")

    except requests.exceptions.RequestException as e:
        print(f"Error on row {index+1}: {e}")
        break
    
    time.sleep(0.05) # Small delay to not overwhelm the server.

print("\n" + "="*30)
print("--- Simulation Complete ---")
print("="*30)

total = anomaly_count + normal_count
if total > 0:
    detection_rate = (anomaly_count / total) * 100
    print(f"\nOverall Results:")
    print(f"  Total Samples Tested: {total}")
    print(f"  Anomalies Detected:   {anomaly_count}")
    print(f"  Normal classifications: {normal_count}")
    print(f"  Overall Detection Rate: {detection_rate:.2f}%")
    
    print("\nBreakdown by Model Type:")
    for model_type, counts in model_usage_counts.items():
        if counts["total"] > 0:
            rate = (counts["anomalies"] / counts["total"]) * 100
            print(f"  - {model_type.capitalize()} Model:")
            print(f"    - Used {counts['total']} times.")
            print(f"    - Detected {counts['anomalies']} anomalies ({rate:.2f}% detection rate).")

else:
    print("No samples were tested.")
