# 07. Backend: FastAPI & Scikit-learn

---

### 1. Role and Design Philosophy

The backend is the **centralized brain** of the MaxiDOM system. It is designed to handle all complex computations, data processing, and machine learning operations, allowing the frontend client to remain lightweight and efficient.

-   **Stateless API**: Each API request is treated as an independent transaction. All necessary state (like the `profile_id`) is provided by the client in the request itself.
-   **Intelligent Server**: It contains all the logic for the model lifecycle, from feature extraction to training, scoring, and periodic retraining.
-   **High Performance**: Built with FastAPI and Uvicorn, it leverages asynchronous capabilities to handle requests efficiently.

### 2. Core Components

The backend codebase is structured into logical modules, each with a distinct responsibility.

| Component / Module | Role | Key Technologies |
| :--- | :--- | :--- |
| **API Layer (`main.py`)** | Defines all RESTful API endpoints (`/train`, `/score`). Manages HTTP requests and responses. Uses Pydantic models for automatic request body validation. | FastAPI, Pydantic |
| **Feature Extractor** | A dedicated module responsible for transforming the aggregated raw JSON payload into a fixed-size, numerical feature vector that can be fed into the ML model. | NumPy, Pandas |
| **Model Manager** | An abstraction layer that handles all interactions with the machine learning models. It manages loading, saving, training, and predicting. | Scikit-learn (`IsolationForest`) |
| **Persistence** | The mechanism for storing and retrieving trained models from the file system. Each model is serialized and named after its corresponding `profile_id`. | `joblib` |

### 3. Core Workflows

The backend processes data according to the endpoint that was called.

#### 3.1. Enrollment Workflow (`POST /enroll/{profile_id}`) 
This one-time flow securely sets up a new user profile. 
1. **Request Validation**: An incoming request is received. The `profile_id` and password are extracted. 
2. **Hashing**: The plain-text password is passed to the **Auth Manager**, which uses a strong, one-way hashing algorithm (bcrypt) to generate a secure password hash. 
3. **Secure Storage**: The `profile_id` and its corresponding `password_hash` are saved to the credential store (e.g., a `users` table in an SQLite database). **Plain-text passwords are never stored.**
#### 3.1. Training Workflow (`POST /train/{profile_id}`)

This flow is executed during the initial profiling phase for a new user. The system follows an **"Extract, Store, Train"** model to distribute the computational load and optimize storage.

1.  **Request Validation**: An incoming request to `/train` is received. FastAPI uses Pydantic to automatically validate the JSON body against the predefined schema.
2.  **Immediate Feature Extraction**: The valid JSON payload is immediately passed to the **Feature Extractor**, which calculates all statistical features and returns a single numerical feature vector.
3.  **Efficient Storage**: This compact feature vector is appended as a new row to a lightweight data store (e.g., a user-specific CSV file).
4. **Model Training Trigger**: After a predefined number of vectors are collected, the **Model Manager** is triggered as a background task to train and save the initial `IsolationForest` model.

> **Design Choice: Why Extract Features Immediately?**
>
> An alternative approach would be to store the raw JSON payloads first and then perform feature extraction on the entire batch just before training. We deliberately chose to extract features on-the-fly for two key reasons:
>
> -   **Distributed Workload**: The computational cost of feature extraction is spread across hundreds of small, fast API calls instead of creating one massive performance spike during the training job. This keeps the server responsive.
> -   **Storage Efficiency**: A numerical feature vector is significantly smaller than its raw JSON source. This approach minimizes disk space usage in the training data pool.
>
> The trade-off is reduced flexibility during development (you cannot "re-extract" features from stored data), but the gains in performance and efficiency are critical for a production-ready system.

#### 3.3. Scoring & Retraining Workflow (`POST /score/{profile_id}`)

This is the standard operational flow for an active user.

### 1. Scoring (`POST /score/{profile_id}`)

- The backend receives the behavioral data, validates it, and checks if a model exists for the `profile_id`.
- Features are extracted, and the user's model is loaded to score the vector.
- The response (`{"is_anomaly": true/false, ...}`) is returned to the client.
- If the behavior is **not anomalous**, the feature vector is added to the `retraining_pool` as part of the feedback loop.

### 2. Verification (`POST /verify_password/{profile_id}`)

- This endpoint is called by the client **only after** an anomaly has been detected.
- The backend receives the plain-text password attempt.
- The **Auth & Password Manager** retrieves the user's stored `password_hash` from persistence.
- It uses a secure, time-constant comparison function (`passlib.verify`) to check if the provided password matches the hash.
- The verification result (`{"verified": true/false}`) is returned to the client.

---

### 3. Visualization

The following diagram illustrates the internal data flow for the main operational endpoints:

```mermaid
graph TD
    A[Client Request] --> B{API Layer (FastAPI)};
    
    subgraph "Backend Logic"
        B -- "/enroll, /verify" --> C[Auth & Password Manager];
        B -- "/train, /score" --> D[Feature Extraction Engine];
        
        D -- "Numerical Vector" --> E[Model Manager];
        
        subgraph "Persistence"
            direction LR
            F[(User Credentials<br>Hashed Passwords)]
            G[(Trained Models<br>./models/)]
        end

        C -- "Saves/Loads Hash" --> F;
        E -- "Saves/Loads Model" --> G;
    end
    
    C --> H[API Response];
    E --> H;

    style A fill:#d6eaff,stroke:#333
