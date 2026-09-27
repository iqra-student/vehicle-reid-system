import os
import time
import threading
import cv2
import numpy as np
import requests
from ultralytics import YOLO


class CongestionEngine:
    def __init__(
        self,
        model_path="yolov8n.pt",
        node_backend_url="http://localhost:5000/api/congestion/log",
        normalized_speed_threshold=0.08,  # Moves < 8% of its own bounding box height per (simulated) second
        stationary_ratio_thresh=0.35,     # 35% of vehicles on road are stopped/crawling
        road_capacity=15,                 # Expected max vehicles in ROI for 100% occupancy calculation
        hold_time_sec=2.0,
        grace_period_sec=3.0,
        alert_cooldown_sec=30.0,          # Minimum gap between dispatched alerts for the same camera
        frame_skip=2,                     # Run YOLO tracking every Nth frame; reuse detections in between
        infer_imgsz=640,                  # Inference input size passed to model.track()
        stream_fps=30.0,                  # Nominal fps used to build simulated time for live process_frame() calls
        output_dir=None                   # Where annotated videos are written; defaults to ./static/annotated
                                           # relative to this file (NOT the server's CWD) if left as None
    ):
        self.model = YOLO(model_path)
        self.backend_url = node_backend_url
        self.vehicle_classes = [2, 3, 5, 7]  # Car, Motorcycle, Bus, Truck

        # Dynamic normalized settings (No fixed pixel thresholds)
        self.norm_speed_thresh = normalized_speed_threshold
        self.stationary_ratio_thresh = stationary_ratio_thresh
        self.road_capacity = road_capacity
        self.hold_time_sec = hold_time_sec
        self.grace_period_sec = grace_period_sec
        self.alert_cooldown_sec = alert_cooldown_sec
        self.frame_skip = max(1, int(frame_skip))
        self.infer_imgsz = infer_imgsz

        # Anchor the output directory to this file's location, not the process's
        # working directory, so annotated videos land in the same place no matter
        # where/how the server was launched from.
        if output_dir is None:
            output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "annotated")
        self.output_dir = output_dir

        # Virtual stream clock: speed/congestion timing is always derived from
        # frame_idx / fps, never from wall-clock time.time(). This keeps results
        # stable regardless of how fast (or slow) inference actually runs.
        self.fps = stream_fps
        self.frame_idx = 0

        # State tracking
        self.track_history = {}
        self.congestion_start_time = None
        self.last_gridlock_detected_time = None
        self.alert_dispatched = False
        self.last_alert_sent_time = 0.0

        # Cache of the last computed detection/metrics, reused on skipped frames
        self._cached_detected_boxes_info = []
        self._cached_road_vehicles = 0
        self._cached_stationary_vehicles = 0
        self._cached_stationary_ratio = 0.0
        self._cached_occupancy_pct = 0.0
        self._cached_is_congested = False
        self._cached_reason = "Normal Flow"

    # ------------------------------------------------------------------ #
    # Networking
    # ------------------------------------------------------------------ #
    def _send_to_node_server(self, payload):
        """Blocking POST to the Node.js backend. Always call via a background thread."""
        try:
            res = requests.post(self.backend_url, json=payload, timeout=3.0)
            print(f"[Module 4] Alert dispatched to Node: HTTP {res.status_code}")
        except Exception as err:
            print(f"[Module 4 Error] Failed to reach Node backend: {err}")

    def _dispatch_alert_async(self, payload):
        """Fires the webhook on a daemon thread so it never blocks the frame loop."""
        thread = threading.Thread(target=self._send_to_node_server, args=(payload,), daemon=True)
        thread.start()

    # ------------------------------------------------------------------ #
    # HUD rendering
    # ------------------------------------------------------------------ #
    def _render_hud(self, frame, camera_id, reason, road_vehicles, stationary_vehicles,
                    stationary_ratio, occupancy_pct, hold_sec, is_congested):
        """Renders standard CityTrace HUD telemetry card on any frame."""
        status_color = (0, 0, 255) if is_congested else (0, 220, 0)
        cv2.rectangle(frame, (20, 20), (520, 130), (15, 23, 42), -1)
        cv2.rectangle(frame, (20, 20), (520, 130), (51, 65, 85), 1)

        cv2.putText(frame, f"{camera_id} | {reason}", (35, 48),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.50, status_color, 2, cv2.LINE_AA)
        cv2.putText(frame, f"Road Vehicles: {road_vehicles} | Stopped: {stationary_vehicles} ({int(stationary_ratio*100)}%)",
                    (35, 75), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (241, 245, 249), 1, cv2.LINE_AA)
        cv2.putText(frame, f"Occupancy: {occupancy_pct}% | Capacity Limit: {self.road_capacity} veh",
                    (35, 98), cv2.FONT_HERSHEY_SIMPLEX, 0.43, (148, 163, 184), 1, cv2.LINE_AA)

        cv2.putText(frame, f"Hold Timer: {hold_sec}s / {self.hold_time_sec}s",
                    (35, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (148, 163, 184), 1, cv2.LINE_AA)

    def _draw_overlays(self, frame, roi_poly, detected_boxes_info, camera_id, congestion_reason,
                        road_vehicles, stationary_vehicles, stationary_ratio, occupancy_pct,
                        jam_sec, is_congested_frame):
        # Draw Road Boundary Polygon
        overlay = frame.copy()
        cv2.polylines(frame, [roi_poly], True, (255, 200, 0), 2)
        cv2.fillPoly(overlay, [roi_poly], (255, 200, 0))
        cv2.addWeighted(overlay, 0.08, frame, 0.92, 0, frame)

        # Draw Vehicle Bounding Boxes
        for (x1, y1, x2, y2, track_id, is_stat, n_spd) in detected_boxes_info:
            box_color = (0, 0, 255) if is_stat else (0, 255, 120)
            cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, 2)
            label = f"ID:{track_id} {'[STOP]' if is_stat else f'{int(n_spd*100)}%/s'}"
            cv2.putText(
                frame, label, (x1, max(20, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, box_color, 1, cv2.LINE_AA
            )

        self._render_hud(frame, camera_id, congestion_reason, road_vehicles, stationary_vehicles,
                         stationary_ratio, occupancy_pct, jam_sec, is_congested_frame)

    # ------------------------------------------------------------------ #
    # Shared geometry helper
    # ------------------------------------------------------------------ #
    @staticmethod
    def _default_roi(width, height):
        return np.array([
            [int(width * 0.05), height],
            [int(width * 0.20), int(height * 0.15)],
            [int(width * 0.80), int(height * 0.15)],
            [int(width * 0.95), height]
        ], dtype=np.int32)

    # ------------------------------------------------------------------ #
    # Detection + speed normalization (virtual-clock based)
    # ------------------------------------------------------------------ #
    def _run_tracker(self, frame):
        return self.model.track(
            source=frame,
            persist=True,
            tracker="bytetrack.yaml",
            classes=self.vehicle_classes,
            conf=0.25,
            imgsz=self.infer_imgsz,
            verbose=False
        )[0]

    def _process_detections(self, results, roi_poly, simulated_time):
        """
        Runs ROI filtering + normalized speed calculation for a freshly-inferred
        frame. All timing is based on the virtual stream clock (simulated_time =
        frame_idx / fps), never wall-clock time, so results stay stable no matter
        how slow inference actually runs.
        """
        road_vehicles = 0
        stationary_vehicles = 0
        detected_boxes_info = []

        if results.boxes is not None and results.boxes.id is not None:
            boxes = results.boxes.xyxy.cpu().numpy()
            track_ids = results.boxes.id.int().cpu().numpy()

            for box, track_id in zip(boxes, track_ids):
                x1, y1, x2, y2 = map(int, box)
                c_x, c_y = (x1 + x2) / 2.0, (y1 + y2) / 2.0
                box_h = max(10, y2 - y1)

                # Road Boundary Region Filtering
                if cv2.pointPolygonTest(roi_poly, (c_x, c_y), False) < 0:
                    continue

                road_vehicles += 1
                is_stationary = False
                norm_speed = 0.0

                # Percentage Speed Calculation: Normalized by Bounding Box Height & Simulated Time
                if track_id in self.track_history:
                    prev_x, prev_y, prev_t, last_speed, last_stat = self.track_history[track_id]
                    delta_t = simulated_time - prev_t

                    if delta_t >= 0.15:
                        dist = np.hypot(c_x - prev_x, c_y - prev_y)
                        speed_px_s = dist / delta_t
                        norm_speed = speed_px_s / box_h
                        is_stationary = norm_speed < self.norm_speed_thresh
                        self.track_history[track_id] = (c_x, c_y, simulated_time, norm_speed, is_stationary)
                    else:
                        norm_speed = last_speed
                        is_stationary = last_stat

                    if is_stationary:
                        stationary_vehicles += 1
                else:
                    self.track_history[track_id] = (c_x, c_y, simulated_time, 0.0, True)
                    stationary_vehicles += 1
                    is_stationary = True

                detected_boxes_info.append((x1, y1, x2, y2, track_id, is_stationary, norm_speed))

        return road_vehicles, stationary_vehicles, detected_boxes_info

    def _compute_congestion_metrics(self, road_vehicles, stationary_vehicles):
        stationary_ratio = (stationary_vehicles / road_vehicles) if road_vehicles > 0 else 0.0
        occupancy_pct = min(100.0, round((road_vehicles / self.road_capacity) * 100, 1))

        is_congested_frame = (
            road_vehicles >= 2 and
            stationary_ratio >= self.stationary_ratio_thresh
        )

        congestion_reason = "Normal Flow"
        if is_congested_frame:
            if occupancy_pct >= 75.0 and stationary_ratio >= 0.50:
                congestion_reason = "Critical Gridlock: High Volume & Lane Standstill"
            elif stationary_ratio >= 0.60:
                congestion_reason = "Bottleneck: Localized Obstruction / Delay"
            else:
                congestion_reason = "Slow Flow: High Occupancy Crawl"

        return stationary_ratio, occupancy_pct, is_congested_frame, congestion_reason

    def _update_alert_state(self, simulated_time, camera_id, road_vehicles, stationary_ratio,
                             occupancy_pct, congestion_reason, is_congested_frame):
        """
        Persistence, debounce and cooldown logic. An alert is only fired once
        congestion has held continuously for >= hold_time_sec AND the cooldown
        window since the last dispatched alert has elapsed. Traffic must clear
        continuously for grace_period_sec before the timer resets, which absorbs
        single-frame jitter instead of flapping the state every frame.
        """
        if is_congested_frame:
            self.last_gridlock_detected_time = simulated_time
            if self.congestion_start_time is None:
                self.congestion_start_time = simulated_time

            duration = simulated_time - self.congestion_start_time
            cooldown_elapsed = (simulated_time - self.last_alert_sent_time) > self.alert_cooldown_sec

            if duration >= self.hold_time_sec and not self.alert_dispatched and cooldown_elapsed:
                payload = {
                    "cameraId": camera_id,
                    "eventType": "GRIDLOCK_CONGESTION",
                    "vehicleCount": int(road_vehicles),
                    "stationaryRatio": round(float(stationary_ratio), 2),
                    "occupancyPercentage": occupancy_pct,
                    "reasoning": congestion_reason,
                    "durationSec": round(float(duration), 2),
                    "timestamp": round(simulated_time, 2)
                }
                self._dispatch_alert_async(payload)
                self.alert_dispatched = True
                self.last_alert_sent_time = simulated_time
                return payload
        else:
            if (
                self.last_gridlock_detected_time is not None and
                (simulated_time - self.last_gridlock_detected_time) > self.grace_period_sec
            ):
                self.congestion_start_time = None
                self.alert_dispatched = False

        return None

    def _reset_state(self):
        self.track_history = {}
        self.congestion_start_time = None
        self.last_gridlock_detected_time = None
        self.alert_dispatched = False
        self.last_alert_sent_time = 0.0
        self.frame_idx = 0
        self._cached_detected_boxes_info = []
        self._cached_road_vehicles = 0
        self._cached_stationary_vehicles = 0
        self._cached_stationary_ratio = 0.0
        self._cached_occupancy_pct = 0.0
        self._cached_is_congested = False
        self._cached_reason = "Normal Flow"

    # ------------------------------------------------------------------ #
    # Live streaming entry point
    # ------------------------------------------------------------------ #
    def process_frame(self, frame: np.ndarray, camera_id: str = "CAM_01", roi_poly: np.ndarray = None) -> np.ndarray:
        """
        Processes a single live frame continuously (for live MJPEG streaming),
        performing tracking, road polygon filtering, speed normalization, and alert logic.
        Uses a virtual stream clock (frame_idx / fps) so speed/congestion math stays
        stable even though real inference throughput fluctuates.
        """
        height, width = frame.shape[:2]

        if roi_poly is None:
            roi_poly = self._default_roi(width, height)

        self.frame_idx += 1
        simulated_time = round(self.frame_idx / self.fps, 2)

        run_inference = (self.frame_idx == 1) or (self.frame_idx % self.frame_skip == 0)

        if run_inference:
            results = self._run_tracker(frame)
            road_vehicles, stationary_vehicles, detected_boxes_info = self._process_detections(
                results, roi_poly, simulated_time
            )
            stationary_ratio, occupancy_pct, is_congested_frame, congestion_reason = \
                self._compute_congestion_metrics(road_vehicles, stationary_vehicles)

            self._cached_detected_boxes_info = detected_boxes_info
            self._cached_road_vehicles = road_vehicles
            self._cached_stationary_vehicles = stationary_vehicles
            self._cached_stationary_ratio = stationary_ratio
            self._cached_occupancy_pct = occupancy_pct
            self._cached_is_congested = is_congested_frame
            self._cached_reason = congestion_reason
        else:
            # Reuse the last computed detections/metrics on skipped frames
            road_vehicles = self._cached_road_vehicles
            stationary_vehicles = self._cached_stationary_vehicles
            detected_boxes_info = self._cached_detected_boxes_info
            stationary_ratio = self._cached_stationary_ratio
            occupancy_pct = self._cached_occupancy_pct
            is_congested_frame = self._cached_is_congested
            congestion_reason = self._cached_reason

        # Alert persistence/dispatch logic runs every frame on the virtual clock
        self._update_alert_state(
            simulated_time, camera_id, road_vehicles, stationary_ratio,
            occupancy_pct, congestion_reason, is_congested_frame
        )

        jam_sec = round(simulated_time - self.congestion_start_time, 1) if self.congestion_start_time else 0.0
        self._draw_overlays(
            frame, roi_poly, detected_boxes_info, camera_id, congestion_reason,
            road_vehicles, stationary_vehicles, stationary_ratio, occupancy_pct,
            jam_sec, is_congested_frame
        )

        return frame

    # ------------------------------------------------------------------ #
    # Batch analysis entry point
    # ------------------------------------------------------------------ #
    def analyze_video(
        self,
        video_path: str,
        camera_id: str = "CAM_01",
        road_polygon: list = None,
        save_annotated=True
    ):
        # Explicit state reset per execution
        self._reset_state()

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        self.fps = fps  # Drive the virtual clock off the video's real fps
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        # Default Road Boundary Region
        if road_polygon is None:
            roi_poly = self._default_roi(width, height)
        else:
            roi_poly = np.array(road_polygon, dtype=np.int32)

        out_video = None
        annotated_path = None
        annotated_filename = None
        if save_annotated:
            os.makedirs(self.output_dir, exist_ok=True)
            annotated_filename = f"annotated_{camera_id}_{int(time.time())}.mp4"
            annotated_path = os.path.join(self.output_dir, annotated_filename)
            fourcc = cv2.VideoWriter_fourcc(*'avc1')
            out_video = cv2.VideoWriter(annotated_path, fourcc, fps, (width, height))

            if not out_video.isOpened():
                fourcc = cv2.VideoWriter_fourcc(*'H264')
                out_video = cv2.VideoWriter(annotated_path, fourcc, fps, (width, height))
            if not out_video.isOpened():
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                out_video = cv2.VideoWriter(annotated_path, fourcc, fps, (width, height))

        events_log = []
        simulated_time = 0.0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            self.frame_idx += 1
            simulated_time = round(self.frame_idx / self.fps, 2)

            run_inference = (self.frame_idx == 1) or (self.frame_idx % self.frame_skip == 0)

            if run_inference:
                results = self._run_tracker(frame)
                road_vehicles, stationary_vehicles, detected_boxes_info = self._process_detections(
                    results, roi_poly, simulated_time
                )
                stationary_ratio, occupancy_pct, is_congested_frame, congestion_reason = \
                    self._compute_congestion_metrics(road_vehicles, stationary_vehicles)

                self._cached_detected_boxes_info = detected_boxes_info
                self._cached_road_vehicles = road_vehicles
                self._cached_stationary_vehicles = stationary_vehicles
                self._cached_stationary_ratio = stationary_ratio
                self._cached_occupancy_pct = occupancy_pct
                self._cached_is_congested = is_congested_frame
                self._cached_reason = congestion_reason
            else:
                # Reuse the last computed detections/metrics on skipped frames
                road_vehicles = self._cached_road_vehicles
                stationary_vehicles = self._cached_stationary_vehicles
                detected_boxes_info = self._cached_detected_boxes_info
                stationary_ratio = self._cached_stationary_ratio
                occupancy_pct = self._cached_occupancy_pct
                is_congested_frame = self._cached_is_congested
                congestion_reason = self._cached_reason

            fired_payload = self._update_alert_state(
                simulated_time, camera_id, road_vehicles, stationary_ratio,
                occupancy_pct, congestion_reason, is_congested_frame
            )
            if fired_payload is not None:
                events_log.append(fired_payload)

            jam_sec = round(simulated_time - self.congestion_start_time, 1) if self.congestion_start_time else 0.0
            self._draw_overlays(
                frame, roi_poly, detected_boxes_info, camera_id, congestion_reason,
                road_vehicles, stationary_vehicles, stationary_ratio, occupancy_pct,
                jam_sec, is_congested_frame
            )

            if out_video is not None:
                out_video.write(frame)

        cap.release()
        if out_video is not None:
            out_video.release()

        return {
            "status": "completed",
            "camera_id": camera_id,
            "processed_frames": self.frame_idx,
            "total_video_duration_sec": simulated_time if self.frame_idx > 0 else 0,
            "congestion_events_triggered": events_log,
            "annotated_video_url": f"http://localhost:8000/video-stream/{annotated_filename}" if annotated_path else None
        }