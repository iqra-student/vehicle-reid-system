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




# """
# Module 4 - Congestion Detection Engine
# ======================================

# CONGESTION DEFINITION
# ---------------------
# All speeds are measured in "box-heights per second" (bh/s): a vehicle's pixel
# displacement is divided by its own bounding-box height. This removes the
# perspective effect, so a near (large) and a far (small) vehicle moving at the
# same real speed get roughly the same value.

#   1. Vehicle speed      v_i = |d(centre)| / (h_i * dt)           over a ~1 s window
#   2. Road speed         V   = median(v_i)                          vehicles inside ROI
#   3. Speed ratio        R   = min(1, V / V_free)                   1 = free flow, 0 = standstill
#   4. Density            D   = area(vehicle boxes ∩ ROI) / area(ROI)
#                         Dn  = min(1, D / D_jam)                    normalised by jam density
#   5. Congestion index   CI  = w_s * (1 - R) + w_d * Dn             in [0, 1]

#   V_free (free-flow speed) = max(default, 85th percentile of observed speeds),
#   the 85th-percentile speed being the standard traffic-engineering estimate.

#   States:
#     Blocked    : R < R_block  and Dn >= Dn_min, sustained for blocked_hold_sec
#     Congested  : CI >= CI_congested and Dn >= Dn_min
#     Slow Moving: CI >= CI_slow
#     Free Flow  : otherwise

#   Crawling traffic (vehicles moving, but slowly, on a full road) has a low R and
#   a high Dn, so it produces a high CI and is classified as Congested even
#   though few vehicles are completely stopped.

# AUTOMATIC ROAD REGION (ROI)
# ---------------------------
# The road is wherever vehicles are detected. During calibration (a pre-pass for
# uploaded videos, the first few seconds for live feeds):

#   1. Perspective model  h(y) = a*y + b     least-squares fit of box height vs
#                                             box bottom y (one outlier-rejection pass)
#   2. Top boundary       y_top = (h_min - b) / a
#                         above y_top vehicles are smaller than h_min and cannot be
#                         detected / measured reliably, so they are excluded
#   3. Side boundaries    centre line c(y) fitted through vehicle centres; each
#                         vehicle's sideways offset is divided by h(y), and the
#                         97th percentile gives k_L, k_R:
#                             x_L(y) = c(y) - k_L*h(y),   x_R(y) = c(y) + k_R*h(y)
#                         (road edges shrink toward the horizon like the vehicles do)
#   4. Polygon            trapezoid (left-bottom, left-top, right-top, right-bottom)

#   Falls back to a conservative default region if too few vehicles are seen.
# """

# import os
# import math
# import time
# import threading
# from collections import deque

# import cv2
# import numpy as np
# import requests
# from ultralytics import YOLO


# # ---------------------------------------------------------------------- #
# # Congestion states
# # ---------------------------------------------------------------------- #
# FREE_FLOW = "Free Flow"
# SLOW = "Slow Moving"
# CONGESTED = "Congested"
# BLOCKED = "Blocked"
# CALIBRATING = "Calibrating"

# SEVERITY = {CALIBRATING: -1, FREE_FLOW: 0, SLOW: 1, CONGESTED: 2, BLOCKED: 3}

# STATE_COLORS = {  # BGR
#     FREE_FLOW: (80, 220, 80),
#     SLOW: (0, 215, 255),
#     CONGESTED: (0, 130, 255),
#     BLOCKED: (0, 0, 255),
#     CALIBRATING: (200, 200, 200),
# }

# MASK_SCALE = 4  # density masks are computed at 1/4 resolution for speed


# class CongestionEngine:
#     def __init__(
#         self,
#         model_path="yolov8n.pt",
#         node_backend_url="http://localhost:5000/api/congestion/log",
#         hold_time_sec=2.0,             # congestion must persist this long before an alert
#         grace_period_sec=3.0,          # traffic must stay clear this long before the episode ends
#         alert_cooldown_sec=30.0,       # minimum gap between alerts for the same engine
#         frame_skip=2,                  # run YOLO every Nth frame, reuse results in between
#         infer_imgsz=640,
#         stream_fps=30.0,               # nominal fps for the live feed's virtual clock
#         output_dir=None,
#         # ---- congestion formula ----
#         free_flow_speed=1.0,           # default V_free in box-heights/s (lower bound)
#         speed_window_sec=1.0,          # window over which each vehicle's speed is measured
#         min_speed_dt_sec=0.4,          # a track needs this much history before its speed counts
#         max_valid_speed=8.0,           # faster than this = tracking glitch, ignored
#         jam_density=0.5,               # D at which the road counts as completely full
#         weight_speed=0.6,              # w_s
#         weight_density=0.4,            # w_d
#         ci_congested=0.6,              # CI threshold for Congested
#         ci_slow=0.4,                   # CI threshold for Slow Moving
#         block_speed_ratio=0.1,         # R below this = standstill
#         crawl_speed_ratio=0.4,         # per-vehicle: below this fraction of V_free = crawling
#         min_density_norm=0.3,          # Dn needed for Congested / Blocked (ignores a lone parked car)
#         blocked_hold_sec=5.0,          # standstill must last this long to be called Blocked
#         min_speed_samples=3,           # vehicles with a valid speed needed to compute V
#         smoothing_tau_sec=1.0,         # time constant of the exponential smoothing of R and Dn
#         # ---- automatic ROI ----
#         auto_roi=True,
#         live_calib_sec=3.0,            # live feed: seconds of detections used to learn the ROI
#         batch_calib_window_sec=10.0,   # uploaded video: calibration frames sampled from this window
#         batch_calib_frames=30,
#         min_box_height_ratio=0.05,     # h_min = this fraction of frame height
#         min_calib_samples=15,
#     ):
#         self.model = YOLO(model_path)
#         self.model_path = model_path
#         self._calib_model = None
#         self.backend_url = node_backend_url
#         self.vehicle_classes = [2, 3, 5, 7]  # car, motorcycle, bus, truck

#         self.hold_time_sec = hold_time_sec
#         self.grace_period_sec = grace_period_sec
#         self.alert_cooldown_sec = alert_cooldown_sec
#         self.frame_skip = max(1, int(frame_skip))
#         self.infer_imgsz = infer_imgsz
#         self.fps = stream_fps

#         self.free_flow_default = free_flow_speed
#         self.speed_window_sec = speed_window_sec
#         self.min_speed_dt_sec = min_speed_dt_sec
#         self.max_valid_speed = max_valid_speed
#         self.jam_density = jam_density
#         self.w_s = weight_speed
#         self.w_d = weight_density
#         self.ci_congested = ci_congested
#         self.ci_slow = ci_slow
#         self.block_speed_ratio = block_speed_ratio
#         self.crawl_speed_ratio = crawl_speed_ratio
#         self.min_density_norm = min_density_norm
#         self.blocked_hold_sec = blocked_hold_sec
#         self.min_speed_samples = min_speed_samples
#         self.smoothing_tau_sec = smoothing_tau_sec

#         self.auto_roi = auto_roi
#         self.live_calib_sec = live_calib_sec
#         self.batch_calib_window_sec = batch_calib_window_sec
#         self.batch_calib_frames = batch_calib_frames
#         self.min_box_height_ratio = min_box_height_ratio
#         self.min_calib_samples = min_calib_samples

#         if output_dir is None:
#             output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "annotated")
#         self.output_dir = output_dir

#         self._reset_state()

#     # ------------------------------------------------------------------ #
#     # State
#     # ------------------------------------------------------------------ #
#     def _reset_state(self):
#         self.frame_idx = 0

#         # Tracking: track_id -> deque of (t, cx, cy, h)
#         self.tracks = {}
#         self.track_last_seen = {}
#         self.observed_speeds = deque(maxlen=3000)
#         self.v_free = self.free_flow_default

#         # Smoothed metrics
#         self.ema_R = 1.0
#         self.ema_Dn = 0.0
#         self.last_metric_t = None
#         self.metrics = self._empty_metrics()
#         self.state = CALIBRATING

#         # Alert / episode state
#         self.congestion_start_time = None
#         self.last_congested_time = None
#         self.blocked_start_time = None
#         self.alert_dispatched = False
#         self.blocked_alert_dispatched = False
#         self.last_alert_sent_time = -float("inf")

#         # ROI
#         self.roi_poly = None
#         self.roi_mask_small = None
#         self.roi_area_small = 0
#         self.roi_source = None
#         self.roi_info = {}
#         self.calib_samples = []
#         self.calib_start_t = None

#         self._cached_boxes = []

#     def _empty_metrics(self):
#         return {
#             "vehicles": 0, "speed_samples": 0, "V": None,
#             "R": 1.0, "D": 0.0, "Dn": 0.0, "CI": 0.0,
#             "stopped": 0, "crawling": 0,
#         }

#     # ------------------------------------------------------------------ #
#     # Networking
#     # ------------------------------------------------------------------ #
#     def _send_to_node_server(self, payload):
#         try:
#             res = requests.post(self.backend_url, json=payload, timeout=3.0)
#             print(f"[Module 4] Alert dispatched to Node: HTTP {res.status_code}")
#         except Exception as err:
#             print(f"[Module 4 Error] Failed to reach Node backend: {err}")

#     def _dispatch_alert_async(self, payload):
#         threading.Thread(target=self._send_to_node_server, args=(payload,), daemon=True).start()

#     # ------------------------------------------------------------------ #
#     # Detection
#     # ------------------------------------------------------------------ #
#     def _run_tracker(self, frame):
#         return self.model.track(
#             source=frame,
#             persist=True,
#             tracker="bytetrack.yaml",
#             classes=self.vehicle_classes,
#             conf=0.25,
#             imgsz=self.infer_imgsz,
#             verbose=False,
#         )[0]

#     def _get_calib_model(self):
#         # Separate instance so calibration never disturbs the tracker's state
#         if self._calib_model is None:
#             self._calib_model = YOLO(self.model_path)
#         return self._calib_model

#     @staticmethod
#     def _extract(results):
#         """Returns (xyxy ndarray Nx4, ids ndarray N or None, cls ndarray N)."""
#         boxes = results.boxes
#         if boxes is None or len(boxes) == 0:
#             return np.zeros((0, 4)), None, np.zeros((0,))
#         xyxy = boxes.xyxy.cpu().numpy()
#         cls = boxes.cls.cpu().numpy() if boxes.cls is not None else np.full(len(xyxy), 2)
#         ids = boxes.id.int().cpu().numpy() if boxes.id is not None else None
#         return xyxy, ids, cls

#     # ------------------------------------------------------------------ #
#     # Automatic road region
#     # ------------------------------------------------------------------ #
#     @staticmethod
#     def _default_roi(width, height):
#         """Conservative fallback: lower part of the frame, where vehicles are large."""
#         return np.array([
#             [int(width * 0.05), height - 1],
#             [int(width * 0.25), int(height * 0.45)],
#             [int(width * 0.75), int(height * 0.45)],
#             [int(width * 0.95), height - 1],
#         ], dtype=np.int32)

#     def _add_calib_samples(self, xyxy, cls):
#         if len(self.calib_samples) > 20000:
#             return
#         for (x1, y1, x2, y2), c in zip(xyxy, cls):
#             self.calib_samples.append((float(x1), float(y1), float(x2), float(y2), float(c)))

#     def _build_auto_roi(self, W, H):
#         """Builds the road polygon from collected detections. Returns (poly, source)."""
#         if len(self.calib_samples) < self.min_calib_samples:
#             self.roi_info = {"reason": f"only {len(self.calib_samples)} vehicles seen during calibration"}
#             return self._default_roi(W, H), "default"

#         s = np.asarray(self.calib_samples, dtype=np.float64)
#         x1, y1, x2, y2, cls = s.T
#         h = y2 - y1

#         # --- 1. Perspective model h(y) = a*y + b (unclipped boxes, cars preferred) ---
#         usable = y2 < H - 3
#         cars = usable & (cls == 2)
#         fit = cars if cars.sum() >= 8 else usable
#         if fit.sum() < 8:
#             fit = np.ones(len(s), dtype=bool)
#         yf, hf = y2[fit], h[fit]
#         a, b = np.polyfit(yf, hf, 1)
#         resid = hf - (a * yf + b)
#         keep = np.abs(resid) <= 2 * resid.std() + 1e-6
#         if keep.sum() >= 8:
#             a, b = np.polyfit(yf[keep], hf[keep], 1)

#         # --- 2. Top boundary y_top = (h_min - b) / a ---
#         h_min = max(20.0, self.min_box_height_ratio * H)
#         if a > 1e-3:
#             y_top = (h_min - b) / a
#         else:  # no measurable perspective (e.g. top-down camera)
#             y_top = np.percentile(y2, 5)
#         y_top = float(np.clip(y_top, np.percentile(y2, 2), 0.8 * H))

#         # --- 3. Side boundaries, using the same perspective model ---
#         # Road edges shrink toward the horizon exactly like vehicles do, so a
#         # vehicle's sideways offset from the road centre line, measured in its
#         # own box heights, is roughly the same everywhere on the road.
#         #   centre line  c(y) = p*y + q          (least squares on box centres)
#         #   edges        x_L(y) = c(y) - k_L*h(y),  x_R(y) = c(y) + k_R*h(y)
#         #   k_L, k_R     = 97th percentile of the normalised left / right offsets
#         sel = y2 >= y_top
#         if sel.sum() < 5:
#             self.roi_info = {"reason": "too few vehicles below the reliable-size line"}
#             return self._default_roi(W, H), "default"
#         bx1, bx2, by = x1[sel], x2[sel], y2[sel]

#         persp = a > 1e-3
#         h_const = float(np.median(h[sel]))

#         def h_of(y):
#             return np.maximum(a * y + b, 1.0) if persp else np.full_like(np.asarray(y, float), h_const)

#         cxs = (bx1 + bx2) / 2.0
#         if np.ptp(by) > 1:
#             p, q = np.polyfit(by, cxs, 1)
#         else:
#             p, q = 0.0, float(np.median(cxs))
#         hb = h_of(by)
#         centre = p * by + q
#         k_left = float(np.percentile((centre - bx1) / hb, 97))
#         k_right = float(np.percentile((bx2 - centre) / hb, 97))
#         k_left, k_right = max(k_left, 0.3), max(k_right, 0.3)

#         def edges_at(y):
#             c, hh = p * y + q, float(h_of(np.array([y]))[0])
#             return c - k_left * hh, c + k_right * hh

#         xl_t, xr_t = edges_at(y_top)
#         xl_b, xr_b = edges_at(float(H))

#         xl_t, xl_b = np.clip([xl_t, xl_b], 0, W - 1)
#         xr_t, xr_b = np.clip([xr_t, xr_b], 0, W - 1)

#         if min(xr_t - xl_t, xr_b - xl_b) < 0.1 * W:
#             self.roi_info = {"reason": "estimated road too narrow"}
#             return self._default_roi(W, H), "default"

#         # --- 4. Polygon ---
#         poly = np.array([
#             [xl_b, H - 1], [xl_t, y_top], [xr_t, y_top], [xr_b, H - 1],
#         ]).astype(np.int32)

#         self.roi_info = {
#             "perspective_a": round(float(a), 4),
#             "perspective_b": round(float(b), 2),
#             "h_min_px": round(h_min, 1),
#             "y_top_px": int(y_top),
#             "k_left": round(k_left, 2),
#             "k_right": round(k_right, 2),
#             "calibration_samples": int(len(s)),
#         }
#         return poly, "auto"

#     def _set_roi(self, poly, W, H, source):
#         self.roi_poly = np.asarray(poly, dtype=np.int32)
#         self.roi_source = source
#         small = np.zeros((max(1, H // MASK_SCALE), max(1, W // MASK_SCALE)), dtype=np.uint8)
#         cv2.fillPoly(small, [self.roi_poly // MASK_SCALE], 255)
#         self.roi_mask_small = small
#         self.roi_area_small = int(cv2.countNonZero(small))

#     def _calibrate_from_video(self, video_path, fps):
#         """Pre-pass for uploaded videos: sample frames and collect detections."""
#         model = self._get_calib_model()
#         cap = cv2.VideoCapture(video_path)
#         total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
#         window = int(fps * self.batch_calib_window_sec)
#         if total > 0:
#             window = min(window, total)
#         step = max(1, window // self.batch_calib_frames)

#         idx, used = 0, 0
#         while used < self.batch_calib_frames:
#             ret, frame = cap.read()
#             if not ret:
#                 break
#             if idx % step == 0:
#                 r = model.predict(frame, classes=self.vehicle_classes, conf=0.25,
#                                   imgsz=self.infer_imgsz, verbose=False)[0]
#                 xyxy, _, cls = self._extract(r)
#                 self._add_calib_samples(xyxy, cls)
#                 used += 1
#             idx += 1
#         cap.release()

#     # ------------------------------------------------------------------ #
#     # Tracking + per-vehicle speed
#     # ------------------------------------------------------------------ #
#     def _update_tracks(self, xyxy, ids, t, W, H):
#         boxes = []
#         if ids is not None:
#             for (fx1, fy1, fx2, fy2), tid in zip(xyxy, ids):
#                 x1, y1, x2, y2 = int(fx1), int(fy1), int(fx2), int(fy2)
#                 tid = int(tid)
#                 cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
#                 h = max(8.0, float(y2 - y1))

#                 hist = self.tracks.get(tid)
#                 if hist is None:
#                     hist = deque()
#                     self.tracks[tid] = hist
#                 elif hist:
#                     lt, lx, ly, lh = hist[-1]
#                     # Sudden jump = ID switch in the tracker, start this track over
#                     if t - lt < 0.5 and math.hypot(cx - lx, cy - ly) > 1.5 * max(h, lh):
#                         hist.clear()
#                 hist.append((t, cx, cy, h))
#                 while len(hist) > 2 and t - hist[1][0] >= self.speed_window_sec:
#                     hist.popleft()
#                 self.track_last_seen[tid] = t

#                 # Boxes cut by the frame border change size as the vehicle leaves,
#                 # which fakes motion, so they don't contribute a speed.
#                 clipped = x1 <= 2 or y1 <= 2 or x2 >= W - 3 or y2 >= H - 3

#                 v = None
#                 dt = t - hist[0][0]
#                 if not clipped and dt >= self.min_speed_dt_sec:
#                     h_med = float(np.median([p[3] for p in hist]))
#                     disp = math.hypot(cx - hist[0][1], cy - hist[0][2])
#                     v_i = disp / (h_med * dt)
#                     if v_i <= self.max_valid_speed:
#                         v = v_i

#                 in_roi = (
#                     self.roi_poly is not None and
#                     cv2.pointPolygonTest(self.roi_poly, (float(cx), float(y2)), False) >= 0
#                 )
#                 boxes.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2,
#                               "id": tid, "v": v, "in_roi": in_roi})

#         # Forget tracks not seen for a while
#         stale = [k for k, ts in self.track_last_seen.items() if t - ts > 2.0]
#         for k in stale:
#             self.tracks.pop(k, None)
#             self.track_last_seen.pop(k, None)

#         return boxes

#     # ------------------------------------------------------------------ #
#     # Congestion formula
#     # ------------------------------------------------------------------ #
#     def _density(self, roi_boxes):
#         if self.roi_area_small <= 0:
#             return 0.0
#         m = np.zeros_like(self.roi_mask_small)
#         for bx in roi_boxes:
#             cv2.rectangle(m, (bx["x1"] // MASK_SCALE, bx["y1"] // MASK_SCALE),
#                           (bx["x2"] // MASK_SCALE, bx["y2"] // MASK_SCALE), 255, -1)
#         inter = cv2.countNonZero(cv2.bitwise_and(m, self.roi_mask_small))
#         return inter / self.roi_area_small

#     def _update_metrics(self, boxes, t):
#         roi_boxes = [b for b in boxes if b["in_roi"]]
#         speeds = [b["v"] for b in roi_boxes if b["v"] is not None]
#         self.observed_speeds.extend(speeds)

#         # V_free = max(default, 85th percentile of everything observed so far)
#         if len(self.observed_speeds) >= 50:
#             p85 = float(np.percentile(self.observed_speeds, 85))
#             self.v_free = max(self.free_flow_default, p85)

#         V = None
#         if len(speeds) >= self.min_speed_samples:
#             V = float(np.median(speeds))
#             R_raw = min(1.0, V / self.v_free)
#         elif not roi_boxes:
#             R_raw = 1.0          # empty road = free flow
#         else:
#             R_raw = None         # vehicles present but no reliable speeds yet: keep last R

#         D = self._density(roi_boxes)
#         Dn_raw = min(1.0, D / self.jam_density)

#         # Exponential smoothing on the virtual clock
#         dt = (t - self.last_metric_t) if self.last_metric_t is not None else float("inf")
#         alpha = 1.0 - math.exp(-dt / self.smoothing_tau_sec) if dt != float("inf") else 1.0
#         if R_raw is not None:
#             self.ema_R += alpha * (R_raw - self.ema_R)
#         self.ema_Dn += alpha * (Dn_raw - self.ema_Dn)
#         self.last_metric_t = t

#         R, Dn = self.ema_R, self.ema_Dn
#         CI = self.w_s * (1.0 - R) + self.w_d * Dn

#         stopped = sum(1 for v in speeds if v < self.block_speed_ratio * self.v_free)
#         crawling = sum(1 for v in speeds
#                        if self.block_speed_ratio * self.v_free <= v < self.crawl_speed_ratio * self.v_free)

#         self.metrics = {
#             "vehicles": len(roi_boxes), "speed_samples": len(speeds), "V": V,
#             "R": R, "D": D, "Dn": Dn, "CI": CI,
#             "stopped": stopped, "crawling": crawling,
#         }

#     def _classify(self, t):
#         R, Dn, CI = self.metrics["R"], self.metrics["Dn"], self.metrics["CI"]

#         standstill = R < self.block_speed_ratio and Dn >= self.min_density_norm
#         if standstill:
#             if self.blocked_start_time is None:
#                 self.blocked_start_time = t
#         else:
#             self.blocked_start_time = None

#         if standstill and t - self.blocked_start_time >= self.blocked_hold_sec:
#             return BLOCKED
#         if standstill or (CI >= self.ci_congested and Dn >= self.min_density_norm):
#             return CONGESTED
#         if CI >= self.ci_slow:
#             return SLOW
#         return FREE_FLOW

#     def _reason(self):
#         m = self.metrics
#         return (f"{self.state}: speed at {int(m['R'] * 100)}% of free flow, "
#                 f"road {int(m['Dn'] * 100)}% full (CI {m['CI']:.2f})")

#     # ------------------------------------------------------------------ #
#     # Alerts
#     # ------------------------------------------------------------------ #
#     def _build_payload(self, t, camera_id, duration):
#         m = self.metrics
#         n_speed = max(1, m["speed_samples"])
#         return {
#             "cameraId": camera_id,
#             "eventType": "GRIDLOCK_CONGESTION",
#             "congestionState": self.state,
#             "vehicleCount": int(m["vehicles"]),
#             "stationaryRatio": round(m["stopped"] / n_speed, 2),
#             "occupancyPercentage": round(m["D"] * 100, 1),
#             "congestionIndex": round(m["CI"], 3),
#             "speedRatio": round(m["R"], 3),
#             "densityRatio": round(m["Dn"], 3),
#             "freeFlowSpeed": round(self.v_free, 3),
#             "reasoning": self._reason(),
#             "durationSec": round(float(duration), 2),
#             "timestamp": round(t, 2),
#         }

#     def _update_alert_state(self, t, camera_id):
#         fired = None
#         if self.state in (CONGESTED, BLOCKED):
#             self.last_congested_time = t
#             if self.congestion_start_time is None:
#                 self.congestion_start_time = t
#             duration = t - self.congestion_start_time
#             cooldown_ok = (t - self.last_alert_sent_time) >= self.alert_cooldown_sec

#             if not self.alert_dispatched and duration >= self.hold_time_sec and cooldown_ok:
#                 fired = self._build_payload(t, camera_id, duration)
#                 self.alert_dispatched = True
#                 self.blocked_alert_dispatched = self.state == BLOCKED
#             elif self.alert_dispatched and self.state == BLOCKED and not self.blocked_alert_dispatched:
#                 # Escalation within the same episode: Congested -> Blocked
#                 fired = self._build_payload(t, camera_id, duration)
#                 self.blocked_alert_dispatched = True

#             if fired is not None:
#                 self.last_alert_sent_time = t
#                 self._dispatch_alert_async(fired)
#         elif (self.last_congested_time is not None and
#               t - self.last_congested_time > self.grace_period_sec):
#             self.congestion_start_time = None
#             self.alert_dispatched = False
#             self.blocked_alert_dispatched = False
#         return fired

#     # ------------------------------------------------------------------ #
#     # Drawing
#     # ------------------------------------------------------------------ #
#     def _speed_color(self, v):
#         if v is None:
#             return (170, 170, 170)                        # speed not measured yet
#         ratio = v / self.v_free
#         if ratio < self.block_speed_ratio:
#             return (0, 0, 255)                            # stopped
#         if ratio < self.crawl_speed_ratio:
#             return (0, 165, 255)                          # crawling
#         return (0, 220, 0)                                # moving

#     def _draw(self, frame, camera_id, t):
#         H, W = frame.shape[:2]
#         s = max(0.5, min(W, H) / 720.0)
#         thick = max(1, int(round(2 * s)))

#         if self.roi_poly is not None:
#             overlay = frame.copy()
#             cv2.fillPoly(overlay, [self.roi_poly], (255, 200, 0))
#             cv2.addWeighted(overlay, 0.12, frame, 0.88, 0, frame)
#             cv2.polylines(frame, [self.roi_poly], True, (255, 200, 0), thick)
#             tl = self.roi_poly[1]
#             cv2.putText(frame, f"ROI ({self.roi_source})", (int(tl[0]), max(15, int(tl[1] - 8 * s))),
#                         cv2.FONT_HERSHEY_SIMPLEX, 0.5 * s, (255, 200, 0), thick, cv2.LINE_AA)

#         for b in self._cached_boxes:
#             if self.roi_poly is not None and not b["in_roi"]:
#                 continue
#             color = self._speed_color(b["v"]) if self.roi_poly is not None else (170, 170, 170)
#             cv2.rectangle(frame, (b["x1"], b["y1"]), (b["x2"], b["y2"]), color, thick)
#             spd = "--" if b["v"] is None else f"{int(min(b['v'] / self.v_free, 9.99) * 100)}%"
#             cv2.putText(frame, f"{b['id']} {spd}", (b["x1"], max(15, b["y1"] - 5)),
#                         cv2.FONT_HERSHEY_SIMPLEX, 0.4 * s, color, max(1, thick // 2), cv2.LINE_AA)

#         m = self.metrics
#         if self.state == CALIBRATING:
#             remaining = max(0.0, self.live_calib_sec - (t - (self.calib_start_t or t)))
#             lines = [f"Learning road region from vehicles... {remaining:.1f}s"]
#         else:
#             jam = (t - self.congestion_start_time) if self.congestion_start_time else 0.0
#             v_txt = "--" if m["V"] is None else f"{m['V']:.2f}"
#             lines = [
#                 f"Congestion Index CI = {m['CI']:.2f}",
#                 f"Speed ratio R = {m['R']:.2f}  (V {v_txt} / Vfree {self.v_free:.2f} bh/s)",
#                 f"Density Dn = {m['Dn']:.2f}  (occupancy {m['D'] * 100:.0f}%)",
#                 f"Vehicles {m['vehicles']} | Stopped {m['stopped']} | Crawling {m['crawling']}",
#                 f"Jam timer {jam:.1f}s / {self.hold_time_sec}s",
#             ]
#         self._render_hud(frame, f"{camera_id} | {self.state}", lines, s)

#     def _render_hud(self, frame, title, lines, s):
#         font = cv2.FONT_HERSHEY_SIMPLEX
#         title_scale, line_scale = 0.6 * s, 0.45 * s
#         pad, gap = int(12 * s), int(8 * s)
#         sizes = [cv2.getTextSize(title, font, title_scale, 2)[0]] + \
#                 [cv2.getTextSize(l, font, line_scale, 1)[0] for l in lines]
#         card_w = max(w for w, _ in sizes) + 2 * pad
#         card_h = sum(h for _, h in sizes) + gap * len(sizes) + 2 * pad
#         x0, y0 = int(15 * s), int(15 * s)

#         cv2.rectangle(frame, (x0, y0), (x0 + card_w, y0 + card_h), (42, 23, 15), -1)
#         cv2.rectangle(frame, (x0, y0), (x0 + card_w, y0 + card_h), (85, 65, 51), 1)

#         y = y0 + pad + sizes[0][1]
#         cv2.putText(frame, title, (x0 + pad, y), font, title_scale,
#                     STATE_COLORS.get(self.state, (255, 255, 255)), 2, cv2.LINE_AA)
#         for line, (_, h) in zip(lines, sizes[1:]):
#             y += gap + h
#             cv2.putText(frame, line, (x0 + pad, y), font, line_scale, (241, 245, 249), 1, cv2.LINE_AA)

#     # ------------------------------------------------------------------ #
#     # One frame
#     # ------------------------------------------------------------------ #
#     def _step(self, frame, camera_id):
#         H, W = frame.shape[:2]
#         self.frame_idx += 1
#         t = self.frame_idx / self.fps

#         if self.roi_poly is None and not self.auto_roi:
#             self._set_roi(self._default_roi(W, H), W, H, "default")

#         run_inference = self.frame_idx == 1 or self.frame_idx % self.frame_skip == 0
#         if run_inference:
#             xyxy, ids, cls = self._extract(self._run_tracker(frame))

#             if self.roi_poly is None:  # live calibration phase
#                 if self.calib_start_t is None:
#                     self.calib_start_t = t
#                 self._add_calib_samples(xyxy, cls)
#                 if t - self.calib_start_t >= self.live_calib_sec:
#                     poly, src = self._build_auto_roi(W, H)
#                     self._set_roi(poly, W, H, src)
#                     print(f"[Module 4] Road ROI ({src}): {poly.tolist()} {self.roi_info}")

#             self._cached_boxes = self._update_tracks(xyxy, ids, t, W, H)

#             if self.roi_poly is not None:
#                 self._update_metrics(self._cached_boxes, t)
#                 self.state = self._classify(t)

#         fired = None
#         if self.roi_poly is not None:
#             fired = self._update_alert_state(t, camera_id)
#         else:
#             self.state = CALIBRATING

#         self._draw(frame, camera_id, t)
#         return frame, fired, t

#     # ------------------------------------------------------------------ #
#     # Live streaming entry point
#     # ------------------------------------------------------------------ #
#     def process_frame(self, frame: np.ndarray, camera_id: str = "CAM_01",
#                       roi_poly: np.ndarray = None) -> np.ndarray:
#         """
#         Processes one live frame. If roi_poly is given it is used as a manual
#         region; otherwise the road region is learned automatically from the
#         first `live_calib_sec` seconds of detections.
#         """
#         if roi_poly is not None and self.roi_source != "manual":
#             H, W = frame.shape[:2]
#             self._set_roi(roi_poly, W, H, "manual")
#         frame, _, _ = self._step(frame, camera_id)
#         return frame

#     # ------------------------------------------------------------------ #
#     # Batch analysis entry point
#     # ------------------------------------------------------------------ #
#     def analyze_video(self, video_path: str, camera_id: str = "CAM_01",
#                       road_polygon: list = None, save_annotated=True):
#         self._reset_state()

#         cap = cv2.VideoCapture(video_path)
#         if not cap.isOpened():
#             raise ValueError(f"Could not open video: {video_path}")
#         fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
#         if fps <= 1 or fps > 240:
#             fps = 30.0
#         W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
#         H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
#         cap.release()
#         self.fps = fps

#         # Road region: manual > automatic > default
#         if road_polygon is not None:
#             self._set_roi(np.array(road_polygon, dtype=np.int32), W, H, "manual")
#         elif self.auto_roi:
#             self._calibrate_from_video(video_path, fps)
#             poly, src = self._build_auto_roi(W, H)
#             self._set_roi(poly, W, H, src)
#         else:
#             self._set_roi(self._default_roi(W, H), W, H, "default")
#         print(f"[Module 4] Road ROI ({self.roi_source}): {self.roi_poly.tolist()} {self.roi_info}")

#         out_video, annotated_filename = None, None
#         if save_annotated:
#             os.makedirs(self.output_dir, exist_ok=True)
#             annotated_filename = f"annotated_{camera_id}_{int(time.time())}.mp4"
#             annotated_path = os.path.join(self.output_dir, annotated_filename)
#             for codec in ("avc1", "H264", "mp4v"):
#                 out_video = cv2.VideoWriter(annotated_path, cv2.VideoWriter_fourcc(*codec), fps, (W, H))
#                 if out_video.isOpened():
#                     break

#         events_log, timeline = [], []
#         state_seconds = {FREE_FLOW: 0.0, SLOW: 0.0, CONGESTED: 0.0, BLOCKED: 0.0}
#         peak_ci, next_sample_t, t = 0.0, 0.0, 0.0

#         cap = cv2.VideoCapture(video_path)
#         while cap.isOpened():
#             ret, frame = cap.read()
#             if not ret:
#                 break

#             frame, fired, t = self._step(frame, camera_id)
#             if fired is not None:
#                 events_log.append(fired)

#             if self.state in state_seconds:
#                 state_seconds[self.state] += 1.0 / fps
#             peak_ci = max(peak_ci, self.metrics["CI"])

#             if t >= next_sample_t:  # one timeline point per second of video
#                 m = self.metrics
#                 timeline.append({
#                     "t": round(t, 2), "state": self.state,
#                     "congestion_index": round(m["CI"], 3),
#                     "speed_ratio": round(m["R"], 3),
#                     "density_ratio": round(m["Dn"], 3),
#                     "vehicles": m["vehicles"],
#                 })
#                 next_sample_t += 1.0

#             if out_video is not None:
#                 out_video.write(frame)

#         cap.release()
#         if out_video is not None:
#             out_video.release()

#         dominant = max(state_seconds, key=state_seconds.get) if self.frame_idx else FREE_FLOW
#         worst = max((st for st, sec in state_seconds.items() if sec > 0),
#                     key=lambda st: SEVERITY[st], default=FREE_FLOW)

#         return {
#             "status": "completed",
#             "camera_id": camera_id,
#             "processed_frames": self.frame_idx,
#             "total_video_duration_sec": round(t, 2) if self.frame_idx > 0 else 0,
#             "dominant_state": dominant,
#             "worst_state": worst,
#             "state_durations_sec": {k: round(v, 2) for k, v in state_seconds.items()},
#             "peak_congestion_index": round(peak_ci, 3),
#             "free_flow_speed": round(self.v_free, 3),
#             "roi_source": self.roi_source,
#             "roi_polygon": self.roi_poly.tolist(),
#             "roi_info": self.roi_info,
#             "timeline": timeline,
#             "congestion_events_triggered": events_log,
#             "annotated_video_url": (
#                 f"http://localhost:8000/video-stream/{annotated_filename}" if annotated_filename else None
#             ),
#         }