# 01. Project Overview

## MaxiDOM: Behavioral Biometric Detection System

---

### 1. The Problem: Static Authentication Gaps

Traditional authentication methods (passwords, 2FA) are effective at the point of entry, but they create a significant security gap afterward.

-   **One-Time Verification**: Once a user is authenticated, their access is typically unrestricted for the entire session.
-   **Vulnerability to Impersonation**: If a machine is left unattended or a session is hijacked, these methods offer no protection against an unauthorized user operating within an already authenticated environment.
-   **Lack of Context**: Static authentication cannot tell the difference between the legitimate user and an impersonator.

MaxiDOM is designed to close this gap by continuously verifying the user's identity based on their behavior.

### 2. The Solution: Continuous and Passive Authentication

MaxiDOM introduces a layer of security that works passively in the background. It verifies identity not by asking for credentials, but by observing the subconscious patterns of user interaction with the browser.

The system builds a unique biometric "signature" for a user and flags any significant deviation from this signature as a potential anomaly, providing real-time defense against impersonation.

### 3. Core Principles

The system is built on three core design principles:

#### 3.1. Domain-Agnostic Profiling

MaxiDOM intentionally ignores the *content* of web pages (`what` the user is doing) and focuses exclusively on the *mechanics* of their interaction (`how` they are doing it).

-   **Benefit**: This creates a generalized, robust behavioral profile that is consistent across different websites. It also enhances privacy by not tracking browsing history or specific site interactions.
-   **Implementation**: Data is collected from all tabs and windows, making the profile a holistic representation of the user's overall browser usage style.

#### 3.2. Multi-Modal Biometrics

A user's signature is composed of several distinct behavioral patterns, captured via standard DOM APIs:

-   **Mouse Dynamics**: Speed, acceleration, path curvature, click duration, and drag-and-drop behavior.
-   **Keystroke Dynamics**: Typing rhythm, including key press duration (dwell time) and time between presses (flight time).
-   **Scrolling Dynamics**: The speed, frequency, and rhythm of scrolling actions.
-   **Window/Tab Interaction**: Patterns of switching between tabs and resizing the browser window.

#### 3.3. Personalized Anomaly Detection

Each browser profile is protected by its own dedicated machine learning model.

-   **Algorithm**: The system uses the **Isolation Forest** algorithm, which is highly effective for anomaly detection. It excels at identifying "different" data points without needing examples of impersonator behavior during training.
-   **Model Scope**: A model trained on one user's data will only be used to score that same user's subsequent activity, ensuring a truly personalized security baseline.

### 4. System Workflow

MaxiDOM operates in a continuous lifecycle:

1.  **Profiling (Cold Start)**: When first installed, the extension enters a data collection phase to gather enough baseline data to build an initial, reliable profile.
2.  **Training**: The backend uses the collected data to train the initial `Isolation Forest` model for that user's UUID.
3.  **Detection**: Once a model is active, all new behavioral data is scored against it in near real-time. If the data is flagged as an anomaly, the system can trigger a response.
4.  **Feedback Loop (Retraining)**: To adapt to natural, gradual changes in a user's behavior over time, the model is periodically retrained with new, verified data.