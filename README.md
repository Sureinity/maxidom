# MaxiDOM: Behavioral Biometric Detection System

> A domain-agnostic system for detecting browser profile impersonation using behavioral biometrics, powered by a Chrome Extension and a FastAPI backend with Scikit-learn.

---

## 📖 Overview

**MaxiDOM** analyzes user behavior—mouse movements, keyboard dynamics, and scrolling patterns—to create a unique biometric profile for a browser session. It operates continuously in the background, using a personalized **Isolation Forest** machine learning model to detect anomalies that may indicate an unauthorized user or impersonator.

> 🟢 **Domain-Agnostic Profiling**: The system captures user behavior across all browser activity, creating a robust profile that is not tied to any specific website.

## ✨ Core Features

-   **Continuous Authentication**: Passively monitors user activity without interrupting workflow.
-   **Multi-Modal Biometrics**: Analyzes mouse, keyboard, scroll, and window interaction data.
-   **Personalized Anomaly Detection**: Trains a unique `Isolation Forest` model for each browser profile.
-   **Client-Server Architecture**: Lightweight Chrome Extension for data collection and a powerful Python backend for ML processing.
-   **Dynamic Model Lifecycle**: Includes a cold-start profiling phase, an active detection phase, and a retraining feedback loop.

## 🛠️ Technology Stack

-   **Frontend (Chrome Extension)**: JavaScript, HTML/CSS, DOM APIs
-   **Backend (API & ML)**: Python, FastAPI, Scikit-learn, Uvicorn
-   **Architecture**: RESTful API, Client-Server

## 🧠 System Architecture

MaxiDOM follows a client-server model:

1.  **Chrome Extension (Client)**: Acts as a sensor, capturing and aggregating raw behavioral data every 30 seconds.
2.  **FastAPI Backend (Server)**: Manages user UUIDs, receives aggregated data, performs feature extraction, and handles the training and scoring lifecycle for each user's dedicated Isolation Forest model.

For a detailed visual representation, see the [System Architecture Documentation](docs/03_SYSTEM_ARCHITECTURE.md).

## 🚀 Getting Started

To set up the development environment and run the project locally, please follow the **[Quick Start Guide](docs/02_QUICK_START_GUIDE.md)**.

## 📚 Documentation

All project documentation is located in the `/docs` directory. For a complete understanding of the system, start with the [Project Overview](docs/01_PROJECT_OVERVIEW.md).
