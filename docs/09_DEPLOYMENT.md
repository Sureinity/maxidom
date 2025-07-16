# 09. Deployment

This guide outlines the steps required to deploy the MaxiDOM system into a production or production-like environment. It covers packaging the frontend extension and running the backend with a production-grade server.

---

### 1. Frontend Deployment: Packaging the Chrome Extension

In a production scenario, you distribute the extension as a single, installable `.crx` file, not as an unpacked folder.

#### 1.1. Creating the Package

1.  Open Google Chrome and navigate to the Extensions page: `chrome://extensions`.
2.  Ensure **Developer mode** is enabled.
3.  Click the **Pack extension** button.
4.  In the "Extension root directory" field, browse and select the `frontend/` folder of the project.
5.  Leave the "Private key file" field blank for the first time you pack it.
6.  Click **Pack extension**.

Chrome will generate two files in the directory *above* your `frontend` folder:
-   `frontend.crx`: The packaged extension file that you can distribute.
-   `frontend.pem`: **This is your private key.** Keep it safe! You will need this key to pack future updates to your extension. If you lose it, you cannot update the extension with the same ID.

#### 1.2. Installation for End-Users

To install the packaged extension, a user can simply **drag and drop the `frontend.crx` file** onto their Chrome Extensions page (`chrome://extensions`).

### 2. Backend Deployment: Running the FastAPI Server

The development server (`uvicorn main:app --reload`) is not suitable for production. You must use a production-grade ASGI process manager like Gunicorn to handle concurrent requests robustly.

#### 2.1. Running with Gunicorn

Gunicorn acts as a process manager for Uvicorn workers, enabling you to run multiple concurrent processes to handle traffic.

1.  **Install Gunicorn**:
    ```bash
    # Ensure your virtual environment is activated
    uv pip install gunicorn
    ```

2.  **Run the Server**:
    -   Use the following command to start the application.

    ```bash
    gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app
    ```

    -   **`-w 4`**: Specifies the number of worker processes. A good starting point is `2 * (number of CPU cores) + 1`. `4` is a reasonable default.
    -   **`-k uvicorn.workers.UvicornWorker`**: Tells Gunicorn to use Uvicorn's worker class, which is necessary for running an ASGI application like FastAPI.
    -   **`main:app`**: Points to the `app` instance inside the `main.py` file.

#### 2.2. Containerizing with Docker (Recommended)

For consistency and portability, the recommended deployment method is to containerize the backend using Docker.

1.  **Create a `Dockerfile`** in the `backend/` directory:

    ```Dockerfile
    # Use an official Python runtime as a parent image
    FROM python:3.11-slim

    # Set the working directory in the container
    WORKDIR /app

    # Install uv package manager
    RUN pip install uv

    # Copy the dependencies file to the container
    COPY requirements.txt .

    # Install dependencies using uv
    RUN uv pip install --no-cache-dir --system -r requirements.txt

    # Copy the rest of the application source code
    COPY . .

    # Expose the port the app runs on
    EXPOSE 8000

    # Define the command to run the application
    # This will be run when the container starts
    CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:8000", "main:app"]
    ```

2.  **Build the Docker Image**:
    ```bash
    # From the backend/ directory
    docker build -t maxidom-backend .
    ```

3.  **Run the Docker Container**:
    ```bash
    # This command maps port 8000 on the host to port 8000 in the container
    docker run -d -p 8000:8000 --name maxidom-api maxidom-backend
    ```
    The backend is now running inside a detached container.

### 3. Production Configuration

-   **API URL**: The URL in the Chrome Extension's `background.js` must be updated from `http://127.0.0.1:8000` to the public domain or IP address of your deployed backend server.
-   **HTTPS**: In a true production environment, the backend server should be placed behind a reverse proxy (like Nginx) to handle HTTPS (SSL/TLS) termination, load balancing, and serving static files.