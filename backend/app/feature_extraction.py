import numpy as np
from typing import Dict, List, Any
import math

class FeatureExtractor:
    """
    A hardened feature extractor for domain-agnostic behavioral biometrics.
    This version focuses on a lean set of high-signal, resilient features
    and purges noisy, easily spoofable ones.
    """
    def __init__(self):
        # A curated list of high-frequency English digraphs for flight time analysis.
        # Maps JavaScript event.code to the character for easier lookup.
        self.DIGRAPH_MAP = {
            "KeyT": "t", "KeyH": "h", "KeyE": "e", "KeyI": "i", "KeyN": "n",
            "KeyR": "r", "KeyO": "o", "KeyA": "a", "KeyS": "s", "KeyD": "d",
            "KeyL": "l", "KeyC": "c", "KeyU": "u", "KeyM": "m", "KeyF": "f",
            "KeyG": "g", "KeyP": "p"
        }
        self.COMMON_DIGRAPHS = {"th", "he", "in", "er", "an", "re", "on", "at"}

        # Define a hard cap for inter-event timings to prevent extreme outliers
        # from corrupting statistics (e.g., user pauses for 5 minutes). 2000ms = 2s.
        self.MAX_TIMING_MS = 2000

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

            # Keystroke Core Biometrics
            "avg_dwell_time_alpha",
            "avg_flight_time_digraph",
            "typing_speed_kps",
        ]

    def extract_features(self, payload: Dict[str, Any]) -> np.ndarray:
        """
        Main entry point for feature extraction. Orchestrates the process.
        """
        features = {}
        session_duration_ms = payload["endTimestamp"] - payload["startTimestamp"]
        session_duration_sec = max(session_duration_ms / 1000, 1)  # Avoid division by zero

        mouse_paths = payload.get("mousePaths", [])
        key_events = payload.get("keyEvents", [])
        
        features.update(self._extract_mouse_movement_features(mouse_paths))
        features.update(self._extract_click_features(payload.get("clicks", [])))
        features.update(self._extract_mouse_pause_features(mouse_paths, session_duration_sec))
        features.update(self._extract_keystroke_features(key_events, session_duration_sec))
        
        # Convert dict to a numpy array in a fixed, reliable order
        feature_vector = np.array([features.get(name, 0.0) for name in self.get_feature_names()])
        
        # Final safety net: replace any lingering NaN or infinity values with 0
        return np.nan_to_num(feature_vector, nan=0.0, posinf=0.0, neginf=0.0)

    def _extract_mouse_movement_features(self, mouse_paths: List[List[Dict[str, Any]]]) -> Dict[str, float]:
        if not mouse_paths:
            return {}
        
        all_speeds, all_accelerations, all_straightness = [], [], []
        
        for path in mouse_paths:
            if len(path) < 2:
                continue
            
            # Speeds
            path_speeds = []
            for i in range(1, len(path)):
                p1, p2 = path[i - 1], path[i]
                dist = math.hypot(p2["x"] - p1["x"], p2["y"] - p1["y"])
                dt_ms = p2["t"] - p1["t"]
                # Capping dt_ms to avoid extreme values from lag
                if dt_ms > 0 and dt_ms < self.MAX_TIMING_MS:
                    path_speeds.append(dist / (dt_ms / 1000))
            
            all_speeds.extend(path_speeds)

            # Accelerations
            if len(path_speeds) > 1:
                for i in range(1, len(path_speeds)):
                    dv = path_speeds[i] - path_speeds[i - 1]
                    # Use the timestamp from the original path points for accuracy
                    dt_ms = path[i + 1]["t"] - path[i]["t"]
                    if dt_ms > 0 and dt_ms < self.MAX_TIMING_MS:
                        all_accelerations.append(dv / (dt_ms / 1000))
            
            # Straightness
            p_start, p_end = path[0], path[-1]
            direct_dist = math.hypot(p_end["x"] - p_start["x"], p_end["y"] - p_start["y"])
            path_dist = sum(math.hypot(path[i]["x"] - path[i - 1]["x"], path[i]["y"] - path[i - 1]["y"]) for i in range(1, len(path)))
            
            if path_dist > 0:
                all_straightness.append(direct_dist / path_dist)

        return {
            "avg_mouse_speed": np.mean(all_speeds) if all_speeds else 0.0,
            "std_mouse_speed": np.std(all_speeds) if len(all_speeds) > 1 else 0.0,
            "avg_mouse_acceleration": np.mean(all_accelerations) if all_accelerations else 0.0,
            "std_mouse_acceleration": np.std(all_accelerations) if len(all_accelerations) > 1 else 0.0,
            "path_straightness": np.mean(all_straightness) if all_straightness else 0.0,
        }

    def _extract_click_features(self, clicks: List[Dict[str, Any]]) -> Dict[str, float]:
        if not clicks:
            return {}
        
        # Filter for valid, realistic click durations (e.g., < 1 second)
        durations = [c["duration"] for c in clicks if 0 < c["duration"] < 1000]
        return {"avg_click_duration": np.mean(durations) if durations else 0.0}

    def _extract_mouse_pause_features(self, mouse_paths: List[List[Dict[str, Any]]], duration_sec: float) -> Dict[str, float]:
        if len(mouse_paths) < 2:
            return {}
        
        pause_durations = []
        for i in range(1, len(mouse_paths)):
            # Time between the end of one path and the start of the next
            pause_end = mouse_paths[i][0]["t"]
            pause_start = mouse_paths[i-1][-1]["t"]
            duration = pause_end - pause_start
            if 0 < duration < self.MAX_TIMING_MS * 5: # Allow longer pauses
                pause_durations.append(duration)
        
        num_pauses = len(pause_durations)
        return {
            "avg_pause_duration": np.mean(pause_durations) if num_pauses > 0 else 0.0,
            "pause_frequency": num_pauses / duration_sec if duration_sec > 0 else 0.0,
        }

    def _extract_keystroke_features(self, key_events: List[Dict[str, Any]], duration_sec: float) -> Dict[str, float]:
        if not key_events:
            return {}

        # Sort events by downTime to ensure correct temporal order
        sorted_events = sorted(key_events, key=lambda x: x['downTime'])

        # Dwell Time (Alphanumeric Only)
        alpha_dwell_times = []
        for e in sorted_events:
            if e["code"].startswith("Key"): # Simple filter for A-Z keys
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

                if prev_char and curr_char:
                    digraph = prev_char + curr_char
                    if digraph in self.COMMON_DIGRAPHS:
                        flight_time = curr_event["downTime"] - prev_event["downTime"]
                        # Apply the cap to prevent extreme pauses from polluting the data
                        if 0 < flight_time < self.MAX_TIMING_MS:
                            digraph_flight_times.append(flight_time)

        # Typing Speed
        typing_speed_kps = len(sorted_events) / duration_sec if duration_sec > 0 else 0.0

        return {
            "avg_dwell_time_alpha": np.mean(alpha_dwell_times) if alpha_dwell_times else 0.0,
            "avg_flight_time_digraph": np.mean(digraph_flight_times) if digraph_flight_times else 0.0,
            "typing_speed_kps": typing_speed_kps,
        }
