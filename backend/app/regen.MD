## Regenerating Features from Raw Data

To regenerate features for a specific user:

```bash
# Step into your backend project directory
cd /path/to/your/backend/project

# Ensure the raw data file exists
# File path: user_data/4453cc10-0374-4021-bad5-c9b3086e18d5/raw_data/profiling_raw.jsonl

# Run the regeneration script
python regenerate_features.py 4453cc10-0374-4021-bad5-c9b3086e18d5 profiling_raw.jsonl

