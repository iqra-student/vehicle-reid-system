import os
import time
import cv2
import numpy as np
import requests
from ultralytics import YOLO


class CongestionEngine:
    def __init__(
        self,
        model_path="yolov8n.pt",
        node_backend_url="http://localhost:5000/api/congestion/log",
        speed_threshold_px=15.0,        # < 15 px/s counts as congested/crawling
        stationary_ratio_thresh=0.35,  # 35% of detected vehicles bottlenecked
        density_threshold=3,           # Minimum 3 vehicles in frame
        hold_time_sec=2.0,             # Sustained for 2.0 seconds
        grace_period_sec=5.0
    ):
        self.model = YOLO(model_path)
        self.backend_url = node_backend_url
        self.vehicle_classes = [2, 3, 5, 7]  # Car, Motorcycle, Bus, Truck

        # Calibrated Thresholds
        self.speed_threshold_px = speed_threshold_px
        self.stationary_ratio_thresh = stationary_ratio_thresh
        self.density_threshold = density_threshold
        self.hold_time_sec = hold_time_sec
        self.grace_period_sec = grace_period_sec

        # State tracking
        self.track_history = {}
        self.congestion_start_time = None
        self.last_gridlock_detected_time = None
        self.alert_dispatched = False

    def _send_to_node_server(self, payload):
        """Dispatches real-time congestion alert to Node.js backend."""
        try:
            res = requests.post(self.backend_url, json=payload, timeout=3.0)
            print(f"[Module 4] Alert dispatched to Node: HTTP {res.status_code}")
        except Exception as err:
            print(f"[Module 4 Error] Failed to reach Node backend: {err}")

    def analyze_video(
        self,
        video_path: str,
        camera_id: str = "CAM_01",
        save_annotated=True
    ):
        # Reset internal tracking state for every execution
        self.track_history = {}
        self.congestion_start_time = None
        self.last_gridlock_detected_time = None
        self.alert_dispatched = False

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Video writer for clean annotated output
        out_video = None
        annotated_path = None
        if save_annotated:
            os.makedirs("static/annotated", exist_ok=True)
            annotated_filename = f"annotated_{camera_id}_{int(time.time())}.mp4"
            annotated_path = f"static/annotated/{annotated_filename}"
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out_video = cv2.VideoWriter(annotated_path, fourcc, fps, (width, height))

        events_log = []
        frame_idx = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_idx += 1
            current_time_sec = round(frame_idx / fps, 2)

            # Ultralytics ByteTrack tracking
            results = self.model.track(
                source=frame,
                persist=True,
                tracker="bytetrack.yaml",
                classes=self.vehicle_classes,
                conf=0.25,
                verbose=False
            )[0]

            total_vehicles = 0
            stationary_vehicles = 0
            detected_boxes_info = []

            if results.boxes is not None and results.boxes.id is not None:
                boxes = results.boxes.xyxy.cpu().numpy()
                track_ids = results.boxes.id.int().cpu().numpy()

                for box, track_id in zip(boxes, track_ids):
                    x1, y1, x2, y2 = map(int, box)
                    c_x, c_y = (x1 + x2) / 2.0, (y1 + y2) / 2.0

                    total_vehicles += 1
                    is_stationary = False
                    speed_px_s = 0.0

                    # Speed Calculation: v = Δdistance / Δt
                    if track_id in self.track_history:
                        prev_x, prev_y, prev_t = self.track_history[track_id]
                        delta_t = current_time_sec - prev_t
                        if delta_t > 0:
                            dist = np.hypot(c_x - prev_x, c_y - prev_y)
                            speed_px_s = dist / delta_t

                            if speed_px_s < self.speed_threshold_px:
                                stationary_vehicles += 1
                                is_stationary = True

                    self.track_history[track_id] = (c_x, c_y, current_time_sec)
                    detected_boxes_info.append((x1, y1, x2, y2, track_id, is_stationary, speed_px_s))

            # Ratio of stopped vehicles
            stationary_ratio = (stationary_vehicles / total_vehicles) if total_vehicles > 0 else 0.0
            is_gridlock_frame = (
                total_vehicles >= self.density_threshold and
                stationary_ratio >= self.stationary_ratio_thresh
            )

            # Congestion Timer Logic
            if is_gridlock_frame:
                self.last_gridlock_detected_time = current_time_sec
                if self.congestion_start_time is None:
                    self.congestion_start_time = current_time_sec

                duration = current_time_sec - self.congestion_start_time
                if duration >= self.hold_time_sec and not self.alert_dispatched:
                    payload = {
                        "cameraId": camera_id,
                        "eventType": "GRIDLOCK_CONGESTION",
                        "vehicleCount": int(total_vehicles),
                        "stationaryRatio": round(float(stationary_ratio), 2),
                        "durationSec": round(float(duration), 2),
                        "timestamp": current_time_sec
                    }
                    self._send_to_node_server(payload)
                    events_log.append(payload)
                    self.alert_dispatched = True
            else:
                if (
                    self.last_gridlock_detected_time is not None and
                    (current_time_sec - self.last_gridlock_detected_time) > self.grace_period_sec
                ):
                    self.congestion_start_time = None
                    self.alert_dispatched = False

            # Visual Annotations
            for (x1, y1, x2, y2, track_id, is_stat, spd) in detected_boxes_info:
                box_color = (0, 0, 255) if is_stat else (0, 255, 120)
                cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
                label = f"ID:{track_id} {'[STOPPED]' if is_stat else f'{spd:.1f}px/s'}"
                cv2.putText(
                    frame, label, (x1, max(20, y1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, box_color, 1, cv2.LINE_AA
                )

            # HUD Display
            status_text = "ALERT: GRIDLOCK" if is_gridlock_frame else "FLOW: NORMAL / SLOW"
            status_color = (0, 0, 255) if is_gridlock_frame else (0, 220, 0)

            cv2.rectangle(frame, (20, 20), (460, 110), (15, 23, 42), -1)
            cv2.rectangle(frame, (20, 20), (460, 110), (51, 65, 85), 1)

            cv2.putText(frame, f"{camera_id} | {status_text}", (35, 52),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.65, status_color, 2, cv2.LINE_AA)
            cv2.putText(frame, f"Vehicles: {total_vehicles} | Stopped: {stationary_vehicles} ({int(stationary_ratio*100)}%)",
                        (35, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.50, (241, 245, 249), 1, cv2.LINE_AA)
            
            jam_sec = round(current_time_sec - self.congestion_start_time, 1) if self.congestion_start_time else 0.0
            cv2.putText(frame, f"Jam Timer: {jam_sec}s / {self.hold_time_sec}s",
                        (35, 102), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (148, 163, 184), 1, cv2.LINE_AA)

            if out_video is not None:
                out_video.write(frame)

        cap.release()
        if out_video is not None:
            out_video.release()

        return {
            "status": "completed",
            "camera_id": camera_id,
            "processed_frames": frame_idx,
            "total_video_duration_sec": current_time_sec if frame_idx > 0 else 0,
            "congestion_events_triggered": events_log,
            "annotated_video_url": f"http://127.0.0.1:8000/{annotated_path}" if annotated_path else None
        }