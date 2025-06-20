# 02. Quick Start Guide

This guide provides the essential steps to set up the MaxiDOM development environment and run the system locally.

### 1. Prerequisites

Ensure the following software is installed on your system before you begin:

- **Git**: For cloning the repository.
- **Python**: Version 3.9 or newer.
- **uv**: The Python package manager used for this project.  You can install it via pip (recommended), or follow platform-specific instructions below:
#### Install via `pip` (all platforms):

```bash
pip install uv
```

#### macOS (using Homebrew):

```bash
brew install uv
```

#### Linux (using shell script from the official repo):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

> **Note**: Make sure `~/.cargo/bin` is in your `PATH` after installation.

#### Windows (using PowerShell):

```powershell
irm https://astral.sh/uv/install.ps1 | iex
```

> **Note**: If using Windows Terminal, you may need to restart it or add `C:\Users\<YourName>\.cargo\bin` to your PATH manually.

- **Google Chrome**: Required to load and test the frontend extension.

### 2. Repository Setup

Clone the project repository to your local machine.

```bash
git clone <your-repository-url>
cd maxidom-project
```

### 3. Backend Setup (FastAPI)

The backend server manages all data processing and machine learning tasks.

1.  **Navigate to the Backend Directory**:
    ```bash
    cd backend
    ```

2.  **Create and Activate a Virtual Environment**: `uv` will create and manage the environment in a `.venv` folder.

    ```bash
    # Create the virtual environment
    uv venv

    # Activate it
    # On macOS / Linux:
    source .venv/bin/activate
    # On Windows (Command Prompt):
    .venv\Scripts\activate
    ```

3.  **Install Dependencies**: `uv` will install all required Python packages from `requirements.txt`.
    ```bash
    uv pip install -r requirements.txt
    ```

### 4. Frontend Setup (Chrome Extension)

The frontend is loaded directly into Google Chrome as an unpacked extension.

1.  Open Google Chrome and navigate to `chrome://extensions`.

2.  Enable **Developer mode** using the toggle switch in the top-right corner.

3.  Click the **Load unpacked** button that appears on the top-left.

4.  In the file selection dialog, navigate to this project's root directory and select the `frontend` folder.

5.  The **MaxiDOM** extension card will appear in your list of extensions. Ensure it is enabled.

### 5. Running the System

The system requires two components running simultaneously: the backend server and the frontend extension.

1.  **Start the Backend Server**:
    -   Open a terminal and ensure you are in the `backend` directory with the virtual environment activated.
    -   Run the application using Uvicorn. The `--reload` flag will automatically restart the server when you make code changes.

    ```bash
    uvicorn main:app --reload
    ```
    -   You should see output indicating the server is running, typically on `http://127.0.0.1:8000`.

2.  **Activate the Frontend**:
    -   The extension is already active in Chrome. Simply start browsing the web.
    -   Open any website and begin interacting (moving your mouse, typing, scrolling) to generate behavioral data.

### 6. Verification

To confirm the system is working correctly:

-   ✅ **Backend Terminal**: You should see incoming `POST` requests to your API endpoints (e.g., `/score` or `/train`) logged in the terminal running Uvicorn every 30 seconds of activity.
-   ✅ **Extension Console**: You can open the developer tools for the extension's background script (from `chrome://extensions`, click "service worker") to see `console.log` outputs confirming data aggregation and sending.