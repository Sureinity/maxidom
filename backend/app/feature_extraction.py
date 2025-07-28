# --- feature_extraction.py ---

import numpy as np
from typing import Dict, List, Any
import math

class FeatureExtractor:
    def get_feature_names(self):
        """Returns the list of feature names in the exact order they are generated."""
        return [
            "avg_mouse_speed", "std_mouse_speed", "avg_mouse_acceleration", "std_mouse_acceleration",
            "path_straightness", "avg_click_duration", "double_click_rate", "avg_dwell_time",
            "std_dwell_time", "avg_flight_time_all", "std_flight_time_all",
            "avg_scroll_magnitude", "scroll_burstiness", "avg_time_between_scrolls",
            "scroll_direction_ratio", "window_focus_blur_rate", "mouse_movement_to_interaction_ratio"
        ]

    def extract_features(self, payload: Dict[str, Any]) -> np.ndarray:
        features = {}
        session_duration_ms = payload["endTimestamp"] - payload["startTimestamp"]
        session_duration_sec = max(session_duration_ms / 1000, 1) # Avoid division by zero

        features.update(self._extract_mouse_features(payload.get("mousePaths", [])))
        features.update(self._extract_click_features(payload.get("clicks", [])))
        features.update(self._extract_keystroke_features(payload.get("keyEvents", [])))
        features.update(self._extract_scroll_features(payload.get("scrollEvents", [])))
        features.update(self._extract_session_features(
            payload.get("focusChanges", []),
            payload.get("mousePaths", []),
            payload.get("clicks", []),
            payload.get("keyEvents", []),
            session_duration_sec
        ))
        
        # Convert dict to numpy array in a fixed order
        feature_vector = np.array([features.get(name, 0.0) for name in self.get_feature_names()])
        return np.nan_to_num(feature_vector) # Replace NaN with 0 for robustness

    def _extract_mouse_features(self, mouse_paths: List[List[Dict[str, Any]]]) -> Dict[str, float]:
        if not mouse_paths: return {}
        
        speeds, accelerations, path_straightness_values = [], [], []
        
        for path in mouse_paths:
            if len(path) < 2: continue
            
            path_speeds = []
            for i in range(1, len(path)):
                p1, p2 = path[i-1], path[i]
                dist = math.hypot(p2["x"] - p1["x"], p2["y"] - p1["y"])
                dt_ms = p2["t"] - p1["t"]
                if dt_ms > 0:
                    path_speeds.append(dist / (dt_ms / 1000))
            
            if len(path_speeds) > 1:
                for i in range(1, len(path_speeds)):
                    dv = path_speeds[i] - path_speeds[i-1]
                    dt_ms = path[i+1]["t"] - path[i]["t"]
                    if dt_ms > 0:
                        accelerations.append(dv / (dt_ms / 1000))
            
            p_start, p_end = path[0], path[-1]
            direct_dist = math.hypot(p_end["x"] - p_start["x"], p_end["y"] - p_start["y"])
            total_dist = sum(math.hypot(path[i]["x"] - path[i-1]["x"], path[i]["y"] - path[i-1]["y"]) for i in range(1, len(path)))
            
            if total_dist > 0:
                path_straightness_values.append(direct_dist / total_dist)
            
            speeds.extend(path_speeds)

        return {
            "avg_mouse_speed": np.mean(speeds) if speeds else 0.0,
            "std_mouse_speed": np.std(speeds) if len(speeds) > 1 else 0.0,
            "avg_mouse_acceleration": np.mean(accelerations) if accelerations else 0.0,
            "std_mouse_acceleration": np.std(accelerations) if len(accelerations) > 1 else 0.0,
            "path_straightness": np.mean(path_straightness_values) if path_straightness_values else 0.0
        }

    def _extract_click_features(self, clicks: List[Dict[str, Any]]) -> Dict[str, float]:
        if not clicks: return {}
        
        durations = [c["duration"] for c in clicks]
        avg_click_duration = np.mean(durations) if durations else 0.0
        
        double_clicks = 0
        if len(clicks) > 1:
            for i in range(1, len(clicks)):
                if (clicks[i]["t"] - clicks[i-1]["t"]) < 500 and clicks[i]["button"] == clicks[i-1]["button"]:
                    double_clicks += 1
        double_click_rate = double_clicks / len(clicks) if clicks else 0.0

        return {"avg_click_duration": avg_click_duration, "double_click_rate": double_click_rate}

    def _extract_keystroke_features(self, key_events: List[Dict[str, Any]]) -> Dict[str, float]:
        if not key_events: return {}
        
        # Dwell Time
        dwell_times = [e["upTime"] - e["downTime"] for e in key_events]
        avg_dwell_time = np.mean(dwell_times) if dwell_times else 0.0
        std_dwell_time = np.std(dwell_times) if len(dwell_times) > 1 else 0.0

        # Flight Time (Language-Agnostic)
        flight_times = []
        # Sort events by downTime to ensure correct sequencing
        sorted_events = sorted(key_events, key=lambda x: x['downTime'])
        if len(sorted_events) > 1:
            for i in range(1, len(sorted_events)):
                flight_time = sorted_events[i]["downTime"] - sorted_events[i-1]["downTime"]
                flight_times.append(flight_time)
        
        avg_flight_time_all = np.mean(flight_times) if flight_times else 0.0
        std_flight_time_all = np.std(flight_times) if len(flight_times) > 1 else 0.0
        
        return {
            "avg_dwell_time": avg_dwell_time,
            "std_dwell_time": std_dwell_time,
            "avg_flight_time_all": avg_flight_time_all,
            "std_flight_time_all": std_flight_time_all,
        }

    def _extract_scroll_features(self, scroll_events: List[Dict[str, Any]]) -> Dict[str, float]:
        if not scroll_events: return {}

        magnitudes = [abs(e["dy"]) for e in scroll_events]
        times_between = [(scroll_events[i]["t"] - scroll_events[i-1]["t"]) for i in range(1, len(scroll_events))]
        downward_scrolls = sum(1 for e in scroll_events if e["dy"] > 0)

        return {
            "avg_scroll_magnitude": np.mean(magnitudes) if magnitudes else 0.0,
            "scroll_burstiness": np.std(times_between) if len(times_between) > 1 else 0.0,
            "avg_time_between_scrolls": np.mean(times_between) if times_between else 0.0,
            "scroll_direction_ratio": downward_scrolls / len(scroll_events) if scroll_events else 0.0
        }
    
    def _extract_session_features(self, focus_changes, mouse_paths, clicks, key_events, duration_sec) -> Dict[str, float]:
        focus_blur_rate = len(focus_changes) / duration_sec if duration_sec > 0 else 0.0
        
        total_mouse_dist = sum(sum(math.hypot(p[i]["x"] - p[i-1]["x"], p[i]["y"] - p[i-1]["y"]) for i in range(1, len(p))) for p in mouse_paths if len(p) > 1)
        total_interactions = len(clicks) + len(key_events)
        
        mouse_to_interaction_ratio = total_mouse_dist / total_interactions if total_interactions > 0 else 0.0
        
        return {
            "window_focus_blur_rate": focus_blur_rate,
            "mouse_movement_to_interaction_ratio": mouse_to_interaction_ratio
        }