# 05. Data Schema & Feature Specification

This document details the complete data pipeline for the MaxiDOM system, from the raw browser events captured by the client to the final numerical feature vector used by the machine learning model on the backend.

The data progresses through three distinct stages:
1.  **Raw Events**: Granular interaction data captured in real-time.
2.  **Aggregated Payload**: A structured JSON object sent from the client to the server.
3.  **Extracted Features**: The final numerical representation used for model training and scoring.

---

### 1. Raw DOM Events (Client-Side Capture)

This is the raw data collected by the `content.js` script, listening directly to the browser's DOM.

| DOM Event | Properties Captured | Purpose |
| :--- | :--- | :--- |
| **`mousemove`** | `timeStamp`, `clientX`, `clientY` | Tracks the path and timing of all mouse movements. |
| **`mousedown`** | `timeStamp`, `clientX`, `clientY`, `button` | Marks the start of a click or drag operation. |
| **`mouseup`** | `timeStamp`, `clientX`, `clientY`, `button` | Marks the end of a click or drag operation. |
| **`keydown`** | `timeStamp`, `code` | Marks the moment a physical key is pressed down. |
| **`keyup`** | `timeStamp`, `code` | Marks the moment a physical key is released. |
| **`wheel`** | `timeStamp`, `deltaY` | Captures vertical scroll actions and their magnitude. |
| **`window.focus`** | `timeStamp` | Records when the user switches back to the tab. |
| **`window.blur`** | `timeStamp` | Records when the user switches away from the tab. |

> **Privacy Note**: We capture `event.code` (e.g., `KeyA`, `ShiftLeft`) instead of `event.key` (`a`, `A`). This provides the necessary data for rhythm analysis without recording the actual sensitive characters being typed.

---

### 2. Aggregated Data Payload (API Contract)

The `background.js` script aggregates the raw events into a structured, efficient JSON payload before sending it to the backend. This is the data format defined by the API contract.

```json
{
  "startTimestamp": 1678890000000,
  "endTimestamp": 1678890120000,
  "windowSize": { "width": 1920, "height": 1080 },

  // Paired key-down and key-up events
  "keyEvents": [
    { "code": "KeyH", "downTime": 1678890005100, "upTime": 1678890005185 },
    { "code": "KeyE", "downTime": 1678890005250, "upTime": 1678890005340 }
  ],

  // A list of continuous mouse movements between two pauses
  "mousePaths": [
    [
      { "t": 1678890010500, "x": 850, "y": 420 },
      { "t": 1678890010520, "x": 855, "y": 425 }
    ]
  ],

  // Processed click events with pre-calculated duration
  "clicks": [
    { "t": 1678890015300, "x": 1500, "y": 250, "button": 0, "duration": 125 }
  ],

  // A simple list of scroll actions
  "scrollEvents": [
    { "t": 1678890020100, "dy": 100 },
    { "t": 1678890020150, "dy": 120 }
  ],

  // A record of focus changes
  "focusChanges": [
    { "type": "blur", "t": 1678890030000 },
    { "type": "focus", "t": 1678890035000 }
  ]
}
```

### 3. Final Extracted Features (ML Model Input)

The backend's Feature Extraction Engine processes the aggregated payload and produces the following fixed-size numerical vector. This vector is the direct input for the `IsolationForest` model.

| Feature name                          | Description & Purpose                                                                                                                                                       | Derived From (Aggregated Data)                                                                |
| :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| **🖱️ Mouse Dynamics**                |                                                                                                                                                                             |                                                                                               |
| `avg_mouse_speed`                     | The average speed of the mouse pointer when in motion. A fundamental indicator of a user's general pace and motor control.                                                  | Each array within `mousePaths`.                                                               |
| `std_mouse_speed`                     | The standard deviation of mouse speed. Measures the consistency of the user's movement speed, distinguishing smooth operators from erratic ones.                            | Each array within `mousePaths`.                                                               |
| `avg_mouse_acceleration`              | The average rate of change of mouse speed. A key biometric indicating how smoothly a user initiates and terminates movements.                                               | Calculated from speed changes within each path in `mousePaths`.                               |
| `std_mouse_acceleration`              | The standard deviation of acceleration, often called "jerk." Measures the smoothness or jerkiness of movement, which is very hard to impersonate.                           | Calculated from speed changes within each path in `mousePaths`.                               |
| `path_straightness`                   | The ratio of the straight-line distance to the actual distance traveled. Captures the unique curvature of a user's hand movements.                                          | Each array within `mousePaths`.                                                               |
| `avg_click_duration`                  | The average time a mouse button is held down (`mousedown` to `mouseup`). A pure and powerful neuromuscular signature.                                                       | The `duration` property in the `clicks` array.                                                |
| `double_click_rate`                   | The frequency of double-clicks (two clicks in rapid succession). Captures a specific, ingrained user habit.                                                                 | The `t` property in the `clicks` array.                                                       |
| **⌨️ Keystroke Dynamics**             |                                                                                                                                                                             |                                                                                               |
| `avg_dwell_time`                      | The average duration a key is physically held down (`keydown` to `keyup`). A core feature of keystroke dynamics that is highly user-specific.                               | The `downTime` and `upTime` properties in the `keyEvents` array.                              |
| `std_dwell_time`                      | The standard deviation of dwell time. Measures the consistency of a user's key presses.                                                                                     | The `downTime` and `upTime` properties in the `keyEvents` array.                              |
| `avg_flight_time_digraph`             | The average time between key presses for common letter pairs (e.g., 'th', 'er', 'in'). More stable and descriptive than a general "any-key" flight time.                    | `downTime` of consecutive items in the `keyEvents` array, filtered for specific `code` pairs. |
| `std_flight_time_digraph`             | The standard deviation of digraph flight times. Measures the consistency of a user's typing rhythm for common words and letter combinations.                                | `downTime` of consecutive items in the `keyEvents` array, filtered for specific `code` pairs. |
| **📜 Scrolling Dynamics**             |                                                                                                                                                                             |                                                                                               |
| `avg_scroll_magnitude`                | The average vertical distance (`deltaY`) of a single scroll action. Differentiates users who make large "flicks" from those who make small, precise scrolls.                | The `dy` property in the `scrollEvents` array.                                                |
| `scroll_burstiness`                   | The standard deviation of the time between consecutive scroll events. Captures the user's scrolling rhythm (continuous and smooth vs. discrete and bursty).                 | The `t` property in the `scrollEvents` array.                                                 |
| `avg_time_between_scrolls`            | The average time between two consecutive scroll events. Complements burstiness by measuring the user's typical pause/cadence during scrolling.                              | The `t` property in the `scrollEvents` array.                                                 |
| `scroll_direction_ratio`              | The ratio of downward scrolls (positive `deltaY`) to the total number of scroll events. A simple but effective feature for capturing dominant scrolling habits.             | The sign of the `dy` property in the `scrollEvents` array.                                    |
| **🖥️ Session & Habitual Dynamics**   |                                                                                                                                                                             |                                                                                               |
| `window_focus_blur_rate`              | The number of times the user switches tabs or applications per minute. Measures a user's tendency for multitasking or distraction.                                          | The `focusChanges` array, normalized by session duration.                                     |
| `mouse_movement_to_interaction_ratio` | The ratio of total mouse path distance to the number of clicks and keystrokes. A novel feature to capture users who "think with their mouse" vs. those who are more direct. | `mousePaths`, `clicks`, and `keyEvents` arrays.                                               |
