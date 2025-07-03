import numpy as np
from typing import Dict, List, Any, Tuple
import math

class FeatureExtractor:
    """
    Feature Extraction Engine that processes aggregated browser event data and produces
    numerical feature vectors for machine learning models (IsolationForest).
    
    This class implements all features defined in the MaxiDOM data pipeline specification.
    """
    
    def __init__(self):
        # Common digraphs in English for keystroke analysis
        self.common_digraphs = [
            ("KeyT", "KeyH"), ("KeyH", "KeyE"), ("KeyI", "KeyN"), 
            ("KeyE", "KeyR"), ("KeyA", "KeyN"), ("KeyO", "KeyN"),
            ("KeyT", "KeyO"), ("KeyI", "KeyT"), ("KeyA", "KeyT"),
            ("KeyE", "KeyN"), ("KeyO", "KeyR")
        ]
    
    def extract_features(self, payload: Dict[str, Any]) -> np.ndarray:
        """
        Extract a fixed-size numerical feature vector from the aggregated payload.
        
        Args:
            payload: The JSON payload containing aggregated browser event data
            
        Returns:
            A numpy array containing all extracted features
        """
        # Initialize feature dict
        features = {}
        
        # Extract session metadata
        session_duration_ms = payload["endTimestamp"] - payload["startTimestamp"]
        session_duration_min = session_duration_ms / 60000  # Convert to minutes
        
        # 1. Mouse Dynamics Features
        mouse_features = self._extract_mouse_features(payload["mousePaths"])
        features.update(mouse_features)
        
        # 2. Click Features
        click_features = self._extract_click_features(payload["clicks"])
        features.update(click_features)
        
        # 3. Keystroke Dynamics Features
        key_features = self._extract_keystroke_features(payload["keyEvents"])
        features.update(key_features)
        
        # 4. Scrolling Dynamics Features
        scroll_features = self._extract_scroll_features(payload["scrollEvents"])
        features.update(scroll_features)
        
        # 5. Session & Habitual Dynamics Features
        session_features = self._extract_session_features(
            payload["focusChanges"],
            payload["mousePaths"],
            payload["clicks"],
            payload["keyEvents"],
            session_duration_min
        )
        features.update(session_features)
        
        # Convert feature dict to numpy array in a fixed order
        feature_vector = np.array([
            # Mouse Dynamics
            features.get("avg_mouse_speed", 0.0),
            features.get("std_mouse_speed", 0.0),
            features.get("avg_mouse_acceleration", 0.0),
            features.get("std_mouse_acceleration", 0.0),
            features.get("path_straightness", 0.0),
            
            # Click Features
            features.get("avg_click_duration", 0.0),
            features.get("double_click_rate", 0.0),
            
            # Keystroke Dynamics
            features.get("avg_dwell_time", 0.0),
            features.get("std_dwell_time", 0.0),
            features.get("avg_flight_time_digraph", 0.0),
            features.get("std_flight_time_digraph", 0.0),
            
            # Scrolling Dynamics
            features.get("avg_scroll_magnitude", 0.0),
            features.get("scroll_burstiness", 0.0),
            features.get("avg_time_between_scrolls", 0.0),
            features.get("scroll_direction_ratio", 0.0),
            
            # Session & Habitual Dynamics
            features.get("window_focus_blur_rate", 0.0),
            features.get("mouse_movement_to_interaction_ratio", 0.0)
        ])
        
        return feature_vector
    
    def _extract_mouse_features(self, mouse_paths: List[List[Dict[str, Any]]]) -> Dict[str, float]:
        """Extract features related to mouse movements"""
        if not mouse_paths or len(mouse_paths) == 0:
            return {
                "avg_mouse_speed": 0.0,
                "std_mouse_speed": 0.0,
                "avg_mouse_acceleration": 0.0,
                "std_mouse_acceleration": 0.0,
                "path_straightness": 0.0
            }
        
        speeds = []
        accelerations = []
        path_straightness_values = []
        
        for path in mouse_paths:
            if len(path) < 2:
                continue
                
            # Calculate speeds for each segment in the path
            path_speeds = []
            for i in range(1, len(path)):
                prev_point = path[i-1]
                curr_point = path[i]
                
                # Calculate distance
                dx = curr_point["x"] - prev_point["x"]
                dy = curr_point["y"] - prev_point["y"]
                distance = math.sqrt(dx*dx + dy*dy)
                
                # Calculate time delta in seconds
                dt = (curr_point["t"] - prev_point["t"]) / 1000
                
                # Avoid division by zero
                if dt > 0:
                    speed = distance / dt
                    path_speeds.append(speed)
            
            # Calculate accelerations
            path_accelerations = []
            for i in range(1, len(path_speeds)):
                speed_delta = path_speeds[i] - path_speeds[i-1]
                time_delta = (path[i+1]["t"] - path[i]["t"]) / 1000
                if time_delta > 0:
                    acceleration = speed_delta / time_delta
                    path_accelerations.append(acceleration)
            
            # Calculate path straightness
            if len(path) > 1:
                # Direct distance (start to end)
                dx_total = path[-1]["x"] - path[0]["x"]
                dy_total = path[-1]["y"] - path[0]["y"]
                direct_distance = math.sqrt(dx_total*dx_total + dy_total*dy_total)
                
                # Total distance traveled along path
                total_distance = 0
                for i in range(1, len(path)):
                    dx = path[i]["x"] - path[i-1]["x"]
                    dy = path[i]["y"] - path[i-1]["y"]
                    segment_distance = math.sqrt(dx*dx + dy*dy)
                    total_distance += segment_distance
                
                # Path straightness (ratio of direct to total distance)
                if total_distance > 0:
                    straightness = direct_distance / total_distance
                    path_straightness_values.append(straightness)
            
            # Add path data to overall collection
            speeds.extend(path_speeds)
            accelerations.extend(path_accelerations)
        
        # Calculate aggregate statistics
        avg_speed = np.mean(speeds) if speeds else 0.0
        std_speed = np.std(speeds) if speeds else 0.0
        avg_acceleration = np.mean(accelerations) if accelerations else 0.0
        std_acceleration = np.std(accelerations) if accelerations else 0.0
        avg_path_straightness = np.mean(path_straightness_values) if path_straightness_values else 0.0
        
        return {
            "avg_mouse_speed": avg_speed,
            "std_mouse_speed": std_speed,
            "avg_mouse_acceleration": avg_acceleration,
            "std_mouse_acceleration": std_acceleration,
            "path_straightness": avg_path_straightness
        }
    
    def _extract_click_features(self, clicks: List[Dict[str, Any]]) -> Dict[str, float]:
        """Extract features related to mouse clicks"""
        if not clicks or len(clicks) == 0:
            return {
                "avg_click_duration": 0.0,
                "double_click_rate": 0.0
            }
        
        # Calculate average click duration
        durations = [click["duration"] for click in clicks if "duration" in click]
        avg_click_duration = np.mean(durations) if durations else 0.0
        
        # Calculate double-click rate
        double_clicks = 0
        if len(clicks) > 1:
            for i in range(1, len(clicks)):
                prev_click = clicks[i-1]
                curr_click = clicks[i]
                
                # Check if clicks are close in time (e.g., within 500ms) and same button
                time_diff = curr_click["t"] - prev_click["t"]
                if (time_diff < 500 and  # 500ms is a common double-click threshold
                   curr_click.get("button") == prev_click.get("button")):
                    double_clicks += 1
        
        double_click_rate = double_clicks / len(clicks) if clicks else 0.0
        
        return {
            "avg_click_duration": avg_click_duration,
            "double_click_rate": double_click_rate
        }
    
    def _extract_keystroke_features(self, key_events: List[Dict[str, Any]]) -> Dict[str, float]:
        """Extract features related to keystroke dynamics"""
        if not key_events or len(key_events) == 0:
            return {
                "avg_dwell_time": 0.0,
                "std_dwell_time": 0.0,
                "avg_flight_time_digraph": 0.0,
                "std_flight_time_digraph": 0.0
            }
        
        # Calculate dwell times (how long each key is held)
        dwell_times = [
            event["upTime"] - event["downTime"] 
            for event in key_events 
            if "upTime" in event and "downTime" in event
        ]
        
        avg_dwell_time = np.mean(dwell_times) if dwell_times else 0.0
        std_dwell_time = np.std(dwell_times) if dwell_times and len(dwell_times) > 1 else 0.0
        
        # Calculate flight times for common digraphs
        digraph_flight_times = []
        
        # Create a map of key events by their code for easier lookup
        key_event_map = {}
        for event in key_events:
            if "code" in event:
                if event["code"] not in key_event_map:
                    key_event_map[event["code"]] = []
                key_event_map[event["code"]].append(event)
        
        # Analyze common digraphs
        for first_key, second_key in self.common_digraphs:
            if first_key in key_event_map and second_key in key_event_map:
                for first_event in key_event_map[first_key]:
                    for second_event in key_event_map[second_key]:
                        # Check if second key was pressed after first key
                        if second_event["downTime"] > first_event["downTime"]:
                            flight_time = second_event["downTime"] - first_event["downTime"]
                            # Only consider reasonable flight times (e.g., < 1000ms)
                            if flight_time < 1000:
                                digraph_flight_times.append(flight_time)
        
        avg_flight_time_digraph = np.mean(digraph_flight_times) if digraph_flight_times else 0.0
        std_flight_time_digraph = np.std(digraph_flight_times) if digraph_flight_times and len(digraph_flight_times) > 1 else 0.0
        
        return {
            "avg_dwell_time": avg_dwell_time,
            "std_dwell_time": std_dwell_time,
            "avg_flight_time_digraph": avg_flight_time_digraph,
            "std_flight_time_digraph": std_flight_time_digraph
        }
    
    def _extract_scroll_features(self, scroll_events: List[Dict[str, Any]]) -> Dict[str, float]:
        """Extract features related to scrolling behavior"""
        if not scroll_events or len(scroll_events) == 0:
            return {
                "avg_scroll_magnitude": 0.0,
                "scroll_burstiness": 0.0,
                "avg_time_between_scrolls": 0.0,
                "scroll_direction_ratio": 0.0
            }
        
        # Calculate scroll magnitudes
        scroll_magnitudes = [abs(event["dy"]) for event in scroll_events if "dy" in event]
        avg_scroll_magnitude = np.mean(scroll_magnitudes) if scroll_magnitudes else 0.0
        
        # Calculate time between scrolls
        times_between_scrolls = []
        for i in range(1, len(scroll_events)):
            time_diff = scroll_events[i]["t"] - scroll_events[i-1]["t"]
            if time_diff > 0:  # Avoid erroneous timestamps
                times_between_scrolls.append(time_diff)
        
        avg_time_between_scrolls = np.mean(times_between_scrolls) if times_between_scrolls else 0.0
        scroll_burstiness = np.std(times_between_scrolls) if times_between_scrolls and len(times_between_scrolls) > 1 else 0.0
        
        # Calculate scroll direction ratio (downward scrolls / total scrolls)
        downward_scrolls = sum(1 for event in scroll_events if "dy" in event and event["dy"] > 0)
        scroll_direction_ratio = downward_scrolls / len(scroll_events) if scroll_events else 0.0
        
        return {
            "avg_scroll_magnitude": avg_scroll_magnitude,
            "scroll_burstiness": scroll_burstiness,
            "avg_time_between_scrolls": avg_time_between_scrolls,
            "scroll_direction_ratio": scroll_direction_ratio
        }
    
    def _extract_session_features(
        self, 
        focus_changes: List[Dict[str, Any]],
        mouse_paths: List[List[Dict[str, Any]]],
        clicks: List[Dict[str, Any]],
        key_events: List[Dict[str, Any]],
        session_duration_min: float
    ) -> Dict[str, float]:
        """Extract features related to session and habitual dynamics"""
        # Calculate window focus/blur rate
        focus_blur_count = len(focus_changes) if focus_changes else 0
        window_focus_blur_rate = focus_blur_count / session_duration_min if session_duration_min > 0 else 0.0
        
        # Calculate mouse movement to interaction ratio
        total_mouse_distance = 0.0
        for path in mouse_paths:
            if len(path) > 1:
                for i in range(1, len(path)):
                    dx = path[i]["x"] - path[i-1]["x"]
                    dy = path[i]["y"] - path[i-1]["y"]
                    segment_distance = math.sqrt(dx*dx + dy*dy)
                    total_mouse_distance += segment_distance
        
        total_interactions = len(clicks) + len(key_events)
        mouse_movement_to_interaction_ratio = (
            total_mouse_distance / total_interactions if total_interactions > 0 else 0.0
        )
        
        return {
            "window_focus_blur_rate": window_focus_blur_rate,
            "mouse_movement_to_interaction_ratio": mouse_movement_to_interaction_ratio
        }
