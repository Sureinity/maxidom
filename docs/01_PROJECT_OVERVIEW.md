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

The system builds a unique biometric "signature" for a user and flags any significant deviation from this signature as a potential anomaly. When an anomaly is detected, the system issues an **active challenge**—a password prompt overlay—to confirm the user's identity and provide real-time defense against impersonation.

### 3. Core Principles

The system is built on three core design principles:

#### 3.1. Domain-Agnostic Profiling

MaxiDOM intentionally ignores the *content* of web pages (`what` the user is doing) and focuses exclusively on the *mechanics* of their interaction (`how` they are doing it).

-   **Benefit**: This creates a generalized, robust behavioral profile that is consistent across different websites (e.g., Wikipedia vs. YouTube). It also enhances privacy by not tracking browsing history or specific site interactions.
-   **Implementation**: Data is collected from all tabs and windows, making the profile a holistic representation of the user's overall browser usage style.

#### 3.2. "Dissect and Score" Specialist Architecture

Unlike traditional systems that average all behavior into a single score, MaxiDOM uses a **Multi-Modal Specialist Approach**.

-   **Mouse Specialist**: Analyzes motor control, speed, acceleration, and curvature.
-   **Typing Specialist**: Analyzes rhythm, flight time between keys, and dwell time.
-   **The Logic**: A session is analyzed by "dissecting" it into mouse and keyboard components. Each component is scored by its respective specialist model. If **either** model detects an anomaly (e.g., the user types correctly but uses the mouse with the wrong hand), the session is flagged. This "Weakest Link" security policy significantly reduces False Acceptance rates.

#### 3.3. Static Security Integrity

To prevent **"Model Poisoning"** (where an attacker slowly trains the system to accept their behavior), MaxiDOM enforces a **Static Model Lifecycle**.

-   **Pristine Enrollment**: Models are trained *once* on a verified, high-integrity dataset collected during a locked-down enrollment phase.
-   **Deterministic Rules**: The system does not "learn" from unverified sessions. This guarantees that the security baseline never drifts or degrades over time, ensuring a reproducible and defensible security posture.

### 4. System Workflow

MaxiDOM operates in a clear, three-phase lifecycle:

1.  **Enrollment & Lockdown**: When first installed, the user sets a verification password. The browser enters a "Lockdown" state where profiling data is only collected if the user authenticates at the start of the session.
2.  **Profiling (Training)**: The backend collects a specific quota of behavioral data (300 valid samples). Once diversity requirements are met, it trains two `Isolation Forest` specialist models (Mouse and Typing).
3.  **Detection & Protection**: The system switches to "Active Mode." All new behavior is scored against the static baseline.
    *   **Normal Behavior**: User continues uninterrupted.
    *   **Anomaly Detected**: The system immediately locks the interface and demands the verification password.
