# 02. Quick Start Guide

This guide provides the essential steps to set up the MaxiDOM development environment and run the system locally for testing and defense demonstration.

### 1. Prerequisites

Ensure the following software is installed on your system before you begin:

- **Git**: For cloning the repository.
- **Python**: Version 3.10 or newer (required for the specific type hinting used in the backend).
- **Google Chrome**: Required to host the frontend extension.
- **uv** (Optional but Recommended): A fast Python package manager. If you prefer standard `pip`, you can use that instead.

### 2. Backend Setup (FastAPI)

The backend server is the "Brain" of the system. It handles the database, feature extraction, and ML scoring.

1.  **Navigate to the Backend Directory**:
    ```bash
    cd backend
    ```

2.  **Create and Activate a Virtual Environment**:
    
    *Using standard python/pip:*
    ```bash
    # Create
    python -m venv .venv
    
    # Activate (Windows)
    .venv\Scripts\activate
    
    # Activate (macOS/Linux)
    source .venv/bin/activate
    ```

3.  **Install Dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Initialize the Database**:
    The system uses an SQLite database (`maxidom.db`). This is automatically created and initialized when the server starts for the first time.

### 3. Frontend Setup (Chrome Extension)

The frontend is loaded directly into Google Chrome as an unpacked extension for development and testing.

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer mode** using the toggle switch in the top-right corner.
3.  Click the **Load unpacked** button (top-left).
4.  Select the **`frontend`** folder from the project root.
5.  **Important**: Note the Extension ID generated (e.g., `abcdef...`).

### 4. Running the System

The system requires the backend to be running *before* the browser generates data.

1.  **Start the Backend Server**:
    Ensure you are in the `backend` directory with your virtual environment activated.
    
    ```bash
    # Run using Uvicorn (Development Mode with Reloading)
    uvicorn api:app --reload --host 127.0.0.1 --port 8000
    ```
    
    *   **Check**: Open `http://127.0.0.1:8000/docs` in your browser. You should see the Swagger UI.

2.  **Activate the Frontend**:
    *   Restart Chrome (or just the extension) to ensure it connects to the running backend.
    *   **The Lockdown Test**: On startup, the extension should immediately enforce a **"Session Locked"** overlay.
    *   Enter your enrollment password (or create one if this is a fresh install) to unlock the session.

### 5. Verification Checklist

To confirm the system is fully operational:

1.  **Enrollment**: On a fresh install, the Onboarding page opens. Setting a password creates a hash in `maxidom.db`.
2.  **Lockdown**: Closing and reopening Chrome triggers the black overlay.
3.  **Data Transmission**:
    *   Interact with a webpage (type keys, move mouse) for > 20 events.
    *   Wait 5 seconds (inactivity trigger).
    *   **Check Backend Console**: You should see a log entry: 
        `INFO: ... POST /api/train/{uuid} 200 OK` (during Profiling) OR 
        `INFO: ... POST /api/score/{uuid} 200 OK` (during Detection).
