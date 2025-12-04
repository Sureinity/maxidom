# 04. API Contract

This document defines the RESTful API for the MaxiDOM backend. It specifies the endpoints, request payloads, and response formats that govern communication between the Chrome Extension (client) and the FastAPI server.

---

### 1. General Information

-   **Base URL**: `http://127.0.0.1:8000`
-   **Data Format**: All request and response bodies are in `application/json` format.
-   **Identification**: The client identifies a specific browser profile by including a `profile_id` (UUID) as a URL path parameter.

### 2. Authentication & Management Endpoints

#### 2.1. `POST /api/enroll/{profile_id}`
**Purpose**: Registers a new profile by hashing and storing the initial verification password.
-   **Request Body**:
    ```json
    { "password": "user-secret-password" }
    ```
-   **Success (200)**: `{"status": "enrollment successful", "profile_id": "..."}`
-   **Error (409)**: Profile already enrolled.

#### 2.2. `POST /api/verify_password/{profile_id}`
**Purpose**: Verifies a password attempt. Used during "Lockdown" (startup) and "Anomaly Response".
-   **Request Body**:
    ```json
    { "password": "attempted-password" }
    ```
-   **Success (200)**:
    ```json
    { "verified": true } // or false
    ```

#### 2.3. `PUT /api/profile/{profile_id}/password`
**Purpose**: Allows an authenticated user to change their password.
-   **Request Body**:
    ```json
    {
      "old_password": "current-password",
      "new_password": "new-password"
    }
    ```
-   **Success (200)**: `{"status": "password changed successfully"}`
-   **Error (403)**: Incorrect old password.

#### 2.4. `DELETE /api/reset_profile/{profile_id}`
**Purpose**: **Destructive Action.** Deletes all trained models, logs, and feature data for the profile to restart the training process. Does *not* delete the password hash.
-   **Success (204)**: No Content.

---

### 3. Biometric Processing Endpoints

#### 3.1. `POST /api/train/{profile_id}`
**Purpose**: Receives data during the **Profiling Phase**.
-   **Request Body**: See **Data Payload Schema** below.
-   **Success (200)**:
    ```json
    {
      "status": "profiling_in_progress",
      "profile_id": "...",
      "progress": {
        "total_samples": { "current": 150, "required": 300 },
        "keyboard_samples": { "current": 20, "required": 50 },
        "mouse_samples": { "current": 130, "required": 150 },
        "is_ready": false
      }
    }
    ```

#### 3.2. `POST /api/score/{profile_id}`
**Purpose**: Receives data during the **Detection Phase**. Returns the anomaly status based on the "Dissect and Score" logic.
-   **Request Body**: See **Data Payload Schema** below.
-   **Success (200)**:
    ```json
    {
      "is_anomaly": true,
      "score": 0.033,           // The lowest score among active specialists
      "mouse_score": 0.208,     // Debug: Score from Mouse Model
      "typing_score": 0.033,    // Debug: Score from Typing Model
      "mouse_threshold": 0.115, // Debug: Current Threshold (15th percentile)
      "typing_threshold": 0.127
    }
    ```
-   **Error (404)**: Model not found (Client should revert to Profiling state).

---

### 4. Data Payload Schema (`Payload`)

This is the standard JSON structure sent by the extension to both `/train` and `/score`.

```json
{
  "startTimestamp": 1715000000.0,
  "endTimestamp": 1715000030.0,
  
  "keyEvents": [
    {
      "code": "KeyA",
      "downTime": 1715000005.100,
      "upTime": 1715000005.200
    }
    // ... more keys
  ],
  
  "mousePaths": [
    [
      { "t": 1715000010.0, "x": 100, "y": 200 },
      { "t": 1715000010.1, "x": 105, "y": 205 }
    ]
    // ... more paths
  ],
  
  "clicks": [
    {
      "t": 1715000015.0,
      "x": 500,
      "y": 500,
      "button": 0,
      "duration": 95.0
    }
  ]
}
