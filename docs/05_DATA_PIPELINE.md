# 05. Data Schema & Feature Specification

This document details the complete data pipeline for the MaxiDOM system. The pipeline transforms raw, noisy browser events into a precise, hardened biometric signature used for anomaly detection.

The data progresses through three distinct stages:
1.  **Raw Events**: Granular interaction data captured by the content script.
2.  **Aggregated Payload**: A structured JSON object sent to the API (defined in `models.py`).
3.  **Extracted Features**: The final 15-dimensional vector used by the Specialist Models.

---

### 1. Raw DOM Events (Client-Side Capture)

This is the raw data collected by `content.js`. We intentionally stripped high-variance inputs (scrolling, window resizing) to focus on subconscious motor skills.

| DOM Event | Properties Captured | Purpose |
| :--- | :--- | :--- |
| **`mousemove`** | `timeStamp`, `clientX`, `clientY` | Tracks the path and velocity of pointer movement. |
| **`mousedown`** | `timeStamp`, `clientX`, `clientY`, `button` | Marks the start of a click interaction. |
| **`mouseup`** | `timeStamp`, `clientX`, `clientY`, `button` | Marks the end of a click interaction (used for Duration). |
| **`keydown`** | `timeStamp`, `code` | Marks the start of a key press. We capture `code` (physical key location) not `key` (character) for privacy and consistency. |
| **`keyup`** | `timeStamp`, `code` | Marks the release of a key (used for Dwell Time). |

---

### 2. Aggregated Data Payload (API Input)

The `service-worker.js` aggregates raw events into "sessions" based on inactivity (5s timeout).

```json
{
  "startTimestamp": 1715000000.0,
  "endTimestamp": 1715000015.0,

  // Paired key-down and key-up events
  "keyEvents": [
    { "code": "KeyH", "downTime": 1715000005.100, "upTime": 1715000005.185 },
    { "code": "KeyE", "downTime": 1715000005.250, "upTime": 1715000005.340 }
  ],

  // A list of continuous mouse movements (strokes)
  "mousePaths": [
    [
      { "t": 1715000010.500, "x": 850, "y": 420 },
      { "t": 1715000010.520, "x": 855, "y": 425 }
    ]
  ],

  // Processed clicks
  "clicks": [
    { "t": 1715000015.300, "x": 1500, "y": 250, "button": 0, "duration": 125.0 }
  ]
}
```

> **The Time Travel Fix:** Due to Chrome Service Worker sleep cycles, `performance.now()` may drift or reset, causing `endTimestamp` to be less than `startTimestamp`. The Backend automatically detects this and calculates a **Derived Duration** (`max(events) - min(events)`) to ensure accurate speed calculations.

---

### 3. Feature Engineering (The "Hardened 15")

The backend extracts exactly 15 features. These features were selected based on the **Subconscious Origin Principle**: they measure *how* a user moves, which is harder to spoof than *what* they do.

These features are split between the two **Specialist Models**.

#### 3.1. Mouse Specialist Features (11 Dimensions)

These features analyze fine motor control and hand-eye coordination.

| Feature Name | Description |
| :--- | :--- |
| `avg_mouse_speed` | The average velocity of the cursor. |
| `std_mouse_speed` | Consistency of speed. Distinguishes "jerky" vs. "smooth" movers. |
| `avg_mouse_acceleration` | Rate of speed change. Measures initiation/termination of movement. |
| `std_mouse_acceleration` | Variation in acceleration (Jerk). High signal for motor control. |
| `path_straightness` | Ratio of direct distance to actual path distance. Captures curvature/efficiency. |
| `avg_click_duration` | Time between `mousedown` and `mouseup`. Highly subconscious. |
| `avg_pause_duration` | Average time the mouse is stationary between movements. |
| `pause_frequency` | How often the user stops moving the mouse per second. |
| `avg_turn_angle` | The average angle of direction changes within a movement path. |
| `avg_stroke_velocity` | Speed calculated over an entire stroke (start to stop). |
| `mouse_after_typing_latency` | **(Transitional)** Time taken to move the mouse immediately after typing. Measures the "Context Switch" reflex. |

#### 3.2. Typing Specialist Features (4 Dimensions)

These features analyze neuromuscular rhythm and typing gait.

| Feature Name | Description |
| :--- | :--- |
| `avg_dwell_time_alpha` | Average time a key is held down. **Filtered to A-Z keys only** to remove outlier behavior from special keys (Shift, Ctrl). |
| `avg_flight_time_digraph` | Time between releasing one key and pressing the next. **Filtered to common English digraphs** (e.g., 'th', 'he', 'an') to ensure high-frequency, subconscious data. |
| `std_flight_time_digraph` | The consistency (rhythm) of the flight time. |
| `typing_speed_kps` | Keys per second. A basic but effective baseline metric. |

---

### 4. Significance Gating

To prevent False Positives from sparse data (e.g., user presses 1 key), the extraction pipeline includes **Data Density Counters**.

-   **Mouse Count**: Total number of coordinate points in `mousePaths`.
-   **Key Count**: Total number of objects in `keyEvents`.

The Scoring Engine uses these counts to decide whether to activate a Specialist Model or force it to "Abstain" (return a neutral score).
