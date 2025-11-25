import numpy as np
from typing import Dict, List, Any
import math

class FeatureExtractor:
    """
    A feature extractor for domain-agnostic behavioral biometrics.
    This version focuses on a lean set of high-signal, resilient features,
    including "micro-behavioral" (gait) and "transitional" metrics.
    """
    def __init__(self):
        # A curated list of high-frequency English digraphs for flight time analysis.
        self.DIGRAPH_MAP = {
            "KeyT": "t", "KeyH": "h", "KeyE": "e", "KeyI": "i", "KeyN": "n",
            "KeyR": "r", "KeyO": "o", "KeyA": "a", "KeyS": "s", "KeyD": "d",
            "KeyL": "l", "KeyC": "c", "KeyU": "u", "KeyM": "m", "KeyF": "f",
            "KeyG": "g", "KeyP": "p"
        }
        self.COMMON_DIGRAPHS = {"th", "he", "in", "er", "an", "re", "on", "at"}

        # Define a hard cap for inter-event timings to prevent extreme outliers.
        self.MAX_TIMING_MS = 2000  # 2 seconds

    def get_feature_names(self) -> List[str]:
        """Returns the final, hardened list of feature names in the exact order."""
        return [
            # Mouse Core Biometrics
            "avg_mouse_speed",
            "std_mouse_speed",
            "avg_mouse_acceleration",
            "std_mouse_acceleration",
            "path_straightness",
            "avg_click_duration",
            # Mouse Pause Biometrics
            "avg_pause_duration",
            "pause_frequency",
            # Mouse "Gait" Biometrics
            "avg_turn_angle",
            "avg_stroke_velocity",
            # Keystroke Core Biometrics
            "avg_dwell_time_alpha",
            "avg_flight_time_digraph",
            "std_flight_time_digraph",
            "typing_speed_kps",
            # Transitional Biometric
            "mouse_after_typing_latency",
        ]

    def extract_features(self, payload: Dict[str, Any]) -> np.ndarray:
        """Main entry point for feature extraction."""
        features = {}

        # --- Dynamic Duration Calculation ---
        # Service Workers can experience clock drift or resets, leading to 
        # endTimestamp < startTimestamp. This will validate causality.
        p_start = payload.get("startTimestamp", 0)
        p_end = payload.get("endTimestamp", 0)
        payload_duration = p_end - p_start

        # Gather all event timestamps to find the TRUE time range if payload is suspect
        all_timestamps = []
        if payload.get("keyEvents"):
            all_timestamps.extend([k["downTime"] for k in payload["keyEvents"]])
            all_timestamps.extend([k["upTime"] for k in payload["keyEvents"]])
        if payload.get("mousePaths"):
            for path in payload["mousePaths"]:
                all_timestamps.extend([p["t"] for p in path])
        if payload.get("clicks"):
            all_timestamps.extend([c["t"] for c in payload["clicks"]])
            
        # Calculate derived duration from actual events
        if all_timestamps:
            derived_duration = max(all_timestamps) - min(all_timestamps)
        else:
            derived_duration = 0

        # Logic: Trust payload if valid positive duration, otherwise fallback to derived.
        if payload_duration > 0:
            final_duration_ms = payload_duration
        else:
            final_duration_ms = derived_duration

        # Safety clamp: Minimum 1 second to prevent division by zero (infinite speed)
        session_duration_sec = max(final_duration_ms / 1000, 1)

        mouse_paths = payload.get("mousePaths", [])
        key_events = payload.get("keyEvents", [])
        clicks = payload.get("clicks", [])
        
        # Sort key events once for efficiency in transitional feature calculation
        sorted_key_events = sorted(key_events, key=lambda x: x['downTime'])
        
        features.update(self._extract_mouse_movement_features(mouse_paths))
        features.update(self._extract_click_features(clicks))
        features.update(self._extract_mouse_pause_features(mouse_paths, session_duration_sec))
        features.update(self._extract_keystroke_features(sorted_key_events, session_duration_sec))
        features.update(self._extract_transitional_features(mouse_paths, sorted_key_events))
        
        feature_vector = np.array([features.get(name, 0.0) for name in self.get_feature_names()])
        return np.nan_to_num(feature_vector, nan=0.0, posinf=0.0, neginf=0.0)

    def _calculate_angle(self, p1, p2, p3):
        """Helper to calculate the angle between three points (p2 is the vertex)."""
        v1 = (p1['x'] - p2['x'], p1['y'] - p2['y'])
        v2 = (p3['x'] - p2['x'], p3['y'] - p2['y'])
        dot_product = v1[0] * v2[0] + v1[1] * v2[1]
        mag1 = math.hypot(v1[0], v1[1])
        mag2 = math.hypot(v2[0], v2[1])
        if mag1 * mag2 == 0:
            return 0.0
        # Clip to handle floating point inaccuracies
        cos_angle = np.clip(dot_product / (mag1 * mag2), -1.0, 1.0)
        angle = math.acos(cos_angle)
        return math.degrees(angle)

    def _extract_mouse_movement_features(self, mouse_paths: List[List[Dict[str, Any]]]) -> Dict[str, float]:
        if not mouse_paths: return {}
        
        all_speeds, all_accelerations, all_straightness = [], [], []
        all_turn_angles, all_stroke_velocities = [], []
        
        for path in mouse_paths:
            if len(path) < 2: continue
            
            path_speeds = []
            for i in range(1, len(path)):
                p1, p2 = path[i - 1], path[i]
                dist = math.hypot(p2["x"] - p1["x"], p2["y"] - p1["y"])
                dt_ms = p2["t"] - p1["t"]
                if 0 < dt_ms < self.MAX_TIMING_MS:
                    path_speeds.append(dist / (dt_ms / 1000))
            
            if len(path_speeds) > 1:
                for i in range(1, len(path_speeds)):
                    dv = path_speeds[i] - path_speeds[i - 1]
                    dt_ms = path[i + 1]["t"] - path[i]["t"]
                    if 0 < dt_ms < self.MAX_TIMING_MS:
                        all_accelerations.append(dv / (dt_ms / 1000))

            path_dist = sum(math.hypot(path[i]["x"] - path[i - 1]["x"], path[i]["y"] - path[i - 1]["y"]) for i in range(1, len(path)))
            if path_dist > 0:
                p_start, p_end = path[0], path[-1]
                direct_dist = math.hypot(p_end["x"] - p_start["x"], p_end["y"] - p_start["y"])
                all_straightness.append(direct_dist / path_dist)
                
                total_time_s = (p_end["t"] - p_start["t"]) / 1000
                if total_time_s > 0:
                    all_stroke_velocities.append(path_dist / total_time_s)

            if len(path) > 2:
                for i in range(1, len(path) - 1):
                    all_turn_angles.append(self._calculate_angle(path[i-1], path[i], path[i+1]))
            
            all_speeds.extend(path_speeds)

        return {
            "avg_mouse_speed": np.mean(all_speeds) if all_speeds else 0.0,
            "std_mouse_speed": np.std(all_speeds) if len(all_speeds) > 1 else 0.0,
            "avg_mouse_acceleration": np.mean(all_accelerations) if all_accelerations else 0.0,
            "std_mouse_acceleration": np.std(all_accelerations) if len(all_accelerations) > 1 else 0.0,
            "path_straightness": np.mean(all_straightness) if all_straightness else 0.0,
            "avg_turn_angle": np.mean(all_turn_angles) if all_turn_angles else 0.0,
            "avg_stroke_velocity": np.mean(all_stroke_velocities) if all_stroke_velocities else 0.0,
        }

    def _extract_click_features(self, clicks: List[Dict[str, Any]]) -> Dict[str, float]:
        if not clicks: return {}
        # Filter for valid, realistic click durations
        durations = [c["duration"] for c in clicks if 0 < c["duration"] < 1000]
        return {"avg_click_duration": np.mean(durations) if durations else 0.0}

    def _extract_mouse_pause_features(self, mouse_paths: List[List[Dict[str, Any]]], duration_sec: float) -> Dict[str, float]:
        if len(mouse_paths) < 2: return {}
        
        pause_durations = [mouse_paths[i][0]["t"] - mouse_paths[i-1][-1]["t"] for i in range(1, len(mouse_paths))]
        # Filter for realistic pause durations
        valid_pauses = [d for d in pause_durations if 0 < d < self.MAX_TIMING_MS * 5] # Allow up to 10s pauses
        
        return {
            "avg_pause_duration": np.mean(valid_pauses) if valid_pauses else 0.0,
            "pause_frequency": len(valid_pauses) / duration_sec if duration_sec > 0 else 0.0,
        }

    def _extract_keystroke_features(self, sorted_events: List[Dict[str, Any]], duration_sec: float) -> Dict[str, float]:
        if not sorted_events: return {}

        # Dwell Time (Alphanumeric Only)
        alpha_dwell_times = []
        for e in sorted_events:
            if e["code"].startswith("Key"): # Simple and effective filter for A-Z keys
                duration = e["upTime"] - e["downTime"]
                if 0 < duration < 1000: # Filter out erroneous long presses
                    alpha_dwell_times.append(duration)

        # Digraph Flight Time
        digraph_flight_times = []
        if len(sorted_events) > 1:
            for i in range(1, len(sorted_events)):
                prev_event, curr_event = sorted_events[i-1], sorted_events[i]
                
                prev_char = self.DIGRAPH_MAP.get(prev_event["code"])
                curr_char = self.DIGRAPH_MAP.get(curr_event["code"])
                
                if prev_char and curr_char and (prev_char + curr_char in self.COMMON_DIGRAPHS):
                    flight_time = curr_event["downTime"] - prev_event["downTime"]
                    if 0 < flight_time < self.MAX_TIMING_MS:
                        digraph_flight_times.append(flight_time)
        
        return {
            "avg_dwell_time_alpha": np.mean(alpha_dwell_times) if alpha_dwell_times else 0.0,
            "avg_flight_time_digraph": np.mean(digraph_flight_times) if digraph_flight_times else 0.0,
            "std_flight_time_digraph": np.std(digraph_flight_times) if len(digraph_flight_times) > 1 else 0.0,
            "typing_speed_kps": len(sorted_events) / duration_sec if duration_sec > 0 else 0.0,
        }

    def _extract_transitional_features(self, mouse_paths: List[List[Dict[str, Any]]], sorted_key_events: List[Dict[str, Any]]) -> Dict[str, float]:
        if not mouse_paths or not sorted_key_events: return {}

        latencies = []
        key_event_index = 0
        for path in mouse_paths:
            if not path: continue
            path_start_time = path[0]["t"]
            
            last_key_before_path = None
            while key_event_index < len(sorted_key_events) and sorted_key_events[key_event_index]["upTime"] < path_start_time:
                last_key_before_path = sorted_key_events[key_event_index]
                key_event_index += 1
            
            if last_key_before_path:
                latency = path_start_time - last_key_before_path["upTime"]
                if 0 < latency < self.MAX_TIMING_MS * 2.5: # Allow up to 5s transition time
                    latencies.append(latency)
        
        return {"mouse_after_typing_latency": np.mean(latencies) if latencies else 0.0}
