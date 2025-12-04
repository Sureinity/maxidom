# MaxiDOM: Behavioral Biometric Detection System

> **A domain-agnostic security layer that detects browser profile impersonation using subconscious motor behavior.**

---

## 📖 Overview

**MaxiDOM** closes the security gap left by traditional authentication. While passwords verify identity at the point of entry, MaxiDOM continuously verifies identity *during* the session.

It utilizes a **Client-Server Architecture** to capture high-fidelity mouse and keystroke dynamics. By analyzing these subconscious motor skills against a personalized **Dual-Specialist Machine Learning Model**, MaxiDOM detects anomalies in real-time and actively locks the browser if an impersonator is detected.

## ✨ Core Capabilities

-   **🛡️ "Dissect and Score" Architecture**: Instead of a generic average, the system splits behavior into **Mouse** and **Typing** components. If an impostor fails *either* check, they are detected.
-   **🔒 Static Security Integrity**: Enforces a "Train Once, Protect Forever" lifecycle. We deliberately removed automated retraining to prevent **Adversarial Model Poisoning**.
-   **⏱️ Hybrid Event Collection**: Replaces simple timers with an intelligent collector that batches data based on user inactivity, preserving context and reducing server load.
-   **🚫 Active Response**: Upon detecting an anomaly, the system physically blocks interaction with the DOM via a secure overlay, forcing a **Step-Up Authentication** (password) challenge.
-   **📉 Significance Gating**: Prevents false positives by strictly refusing to score sessions with sparse data (e.g., a single keystroke).

## 🛠️ Technology Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | **Chrome Extension (MV3)** | Intelligent Sensor, Overlay Injection, State Persistence |
| **Backend** | **Python (FastAPI)** | REST API, Data Validation, Async Task Management |
| **ML Engine** | **Scikit-learn** | `IsolationForest` Algorithm, Feature Extraction |
| **Data** | **Pandas / NumPy** | Vectorization and Statistical Analysis |
| **Security** | **Bcrypt** | Secure Password Hashing |

## 🧠 System Architecture

MaxiDOM operates on a decoupled architecture designed for security and performance:

1.  **The Sensor (Client)**: A Manifest V3 Chrome Extension captures raw DOM events. It uses `chrome.storage.local` to persist security states across browser restarts and mitigates Service Worker sleep cycles with a custom "Time Travel" fix.
2.  **The Decision Engine (Server)**: A Python backend receives aggregated payloads. It extracts **15 Hardened Features** (e.g., Digraph Flight Time, Mouse Jerk) and routes them to user-specific Specialist Models.

For a deep dive into the engineering, see the [System Architecture Documentation](docs/03_SYSTEM_ARCHITECTURE.md).

## 🚀 Getting Started

To set up the development environment and run the project locally, please follow the **[Quick Start Guide](docs/02_QUICK_START_GUIDE.md)**.

## 📚 Engineering Documentation

The `/docs` directory contains the complete technical specifications for the project:

-   [**01. Project Overview**](docs/01_PROJECT_OVERVIEW.md) - The problem statement and core principles.
-   [**03. System Architecture**](docs/03_SYSTEM_ARCHITECTURE.md) - Component diagrams and data flow.
-   [**04. API Contract**](docs/04_API_CONTRACT.md) - REST endpoints and JSON schemas.
-   [**05. Data Pipeline**](docs/05_DATA_PIPELINE.md) - From raw DOM events to 15-dim feature vectors.
-   [**06. Frontend Logic**](docs/06_FRONTEND_CHROME_EXTENSION.md) - Service Worker lifecycle and UI injection.
-   [**07. Backend Logic**](docs/07_BACKEND_FASTAPI.md) - FastAPI structure and Feature Extraction.
-   [**08. ML Model Lifecycle**](docs/08_ML_MODEL_LIFECYCLE.md) - Isolation Forest training, calibration, and the "No-Retraining" policy.
-   [**09. Deployment Strategy**](docs/09_DEPLOYMENT.md) - Production setup and Enterprise Policy (HKLM) enforcement.
