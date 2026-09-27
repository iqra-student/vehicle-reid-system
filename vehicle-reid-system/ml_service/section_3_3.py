# """3.3 Plate-based vehicle tracking """
# import base64
# import os
# import shutil
# import string
# import subprocess
# import threading
# import uuid
# from collections import OrderedDict

# import cv2
# import easyocr
# import numpy as np
# import torch
# from ultralytics import YOLO

# ROOT = os.path.dirname(os.path.abspath(__file__))
# RESULTS_DIR = os.path.join(ROOT, "results_3_3")
# os.makedirs(RESULTS_DIR, exist_ok=True)
# IOU_KEEP = 0.25
# VEHICLE_CLASSES = {2, 3, 5, 7}
# MAX_UPLOAD_BYTES = 40 * 1024 * 1024
# MIN_OCR_CONFIDENCE = 0.35

# # Plates now accepted range from 5 to 10 characters so that Dutch, American,
# # and Pakistani plate formats (which differ in length from the old rigid
# # 7-char EU-style layout) all pass validation.
# PLATE_MIN_LEN = 5
# PLATE_MAX_LEN = 10

# # Determine CUDA availability
# DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# plate_model = None
# coco_model = None
# ocr_reader = None
# jobs = {}
# jobs_lock = threading.Lock()

# CHAR_TO_INT = {"O": "0", "I": "1", "J": "3", "A": "4", "G": "6", "S": "5"}
# INT_TO_CHAR = {"0": "O", "1": "I", "3": "J", "4": "A", "6": "G", "5": "S"}


# def plate_model_path():
#     for path in (
#         os.path.join(ROOT, "license_plate_detector.pt"),
#         os.path.join(ROOT, "models", "license_plate_detector.pt"),
#     ):
#         if os.path.isfile(path):
#             return path
#     raise FileNotFoundError(
#         "Put license_plate_detector.pt next to section_3_3.py or in a models folder."
#     )


# def load_models():
#     global plate_model, coco_model, ocr_reader

#     use_gpu = False

#     if plate_model is None:
#         plate_model = YOLO(plate_model_path())
#         plate_model.to(DEVICE)

#     if coco_model is None:
#         coco_model = YOLO("yolov8n.pt")
#         coco_model.to(DEVICE)

#     if ocr_reader is None:
#         # Enabled GPU for EasyOCR
#         ocr_reader = easyocr.Reader(["en"], gpu=use_gpu)


# def license_complies_format(text):
#     """Loosened validator: accepts Dutch, American, and Pakistani plate
#     formats, which vary between roughly 5 and 10 alphanumeric characters,
#     instead of forcing the old rigid 7-character EU-style layout.
#     """
#     if not (PLATE_MIN_LEN <= len(text) <= PLATE_MAX_LEN):
#         return False
#     if not text.isalnum():
#         return False
#     has_letter = any(c in string.ascii_uppercase for c in text)
#     has_digit = any(c.isdigit() for c in text)
#     return has_letter and has_digit


# def format_license(text):
#     """Best-effort cleanup only. The previous version assumed a fixed
#     7-character EU layout and force-corrected characters by position
#     (letter/digit swaps). That breaks once Dutch/American/Pakistani plates
#     of different lengths are allowed through, so we no longer remap by
#     position — just pass the cleaned text through unchanged.
#     """
#     return text


# def _plate_preprocess_variants(crop):
#     gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
#     h, w = gray.shape[:2]
#     if max(h, w) < 300:
#         gray = cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)

#     variants = [gray]
#     _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
#     variants.append(otsu)
#     _, fixed = cv2.threshold(gray, 64, 255, cv2.THRESH_BINARY_INV)
#     variants.append(fixed)
#     adaptive = cv2.adaptiveThreshold(
#         gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 15
#     )
#     variants.append(adaptive)
#     return variants


# def read_license_plate(crop):
#     if crop is None or crop.size == 0:
#         return None, None

#     best_text, best_score = None, 0.0
#     for variant in _plate_preprocess_variants(crop):
#         try:
#             readings = ocr_reader.readtext(variant)
#         except Exception:
#             continue
#         for _bbox, text, score in readings:
#             # Strip spaces AND dashes - Dutch ("12-ABC-3") and Pakistani
#             # ("LEA-1234") plates commonly use hyphens.
#             text = text.upper().replace(" ", "").replace("-", "")
#             if not license_complies_format(text):
#                 continue
#             if score > best_score:
#                 best_text, best_score = format_license(text), score

#     if best_text is not None and best_score >= MIN_OCR_CONFIDENCE:
#         return best_text, best_score
#     return None, None


# def get_car(license_plate, vehicle_track_ids):
#     x1, y1, x2, y2, _score, _cls = license_plate
#     plate_center_x = (x1 + x2) / 2.0
#     plate_center_y = (y1 + y2) / 2.0

#     # 1. First check if center of license plate is inside vehicle box
#     for row in vehicle_track_ids:
#         xcar1, ycar1, xcar2, ycar2, car_id = row
#         if xcar1 <= plate_center_x <= xcar2 and ycar1 <= plate_center_y <= ycar2:
#             return xcar1, ycar1, xcar2, ycar2, car_id

#     # 2. Fallback: Find vehicle bounding box with highest overlap
#     best_iou, best_car = 0.0, (-1, -1, -1, -1, -1)
#     for row in vehicle_track_ids:
#         xcar1, ycar1, xcar2, ycar2, car_id = row
#         overlap_score = iou([x1, y1, x2, y2], [xcar1, ycar1, xcar2, ycar2])
#         if overlap_score > best_iou:
#             best_iou = overlap_score
#             best_car = (xcar1, ycar1, xcar2, ycar2, car_id)

#     return best_car


# def iou(a, b):
#     x1, y1 = max(a[0], b[0]), max(a[1], b[1])
#     x2, y2 = min(a[2], b[2]), min(a[3], b[3])
#     inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
#     area_a = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
#     area_b = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
#     return inter / (area_a + area_b - inter + 1e-6)


# def edit_distance(a, b):
#     if a == b:
#         return 0
#     la, lb = len(a), len(b)
#     if abs(la - lb) > 2:
#         return 99
#     prev = list(range(lb + 1))
#     for i, ca in enumerate(a, 1):
#         cur = [i]
#         for j, cb in enumerate(b, 1):
#             cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
#         prev = cur
#     return prev[-1]


# def draw_border(img, top_left, bottom_right, color=(0, 255, 0), thickness=6, line_length_x=50, line_length_y=50):
#     x1, y1 = top_left
#     x2, y2 = bottom_right
#     cv2.line(img, (x1, y1), (x1, y1 + line_length_y), color, thickness)
#     cv2.line(img, (x1, y1), (x1 + line_length_x, y1), color, thickness)
#     cv2.line(img, (x1, y2), (x1, y2 - line_length_y), color, thickness)
#     cv2.line(img, (x1, y2), (x1 + line_length_x, y2), color, thickness)
#     cv2.line(img, (x2, y1), (x2 - line_length_x, y1), color, thickness)
#     cv2.line(img, (x2, y1), (x2, y2 + line_length_y), color, thickness)
#     cv2.line(img, (x2, y2), (x2, y2 - line_length_y), color, thickness)
#     cv2.line(img, (x2, y2), (x2 - line_length_x, y2), color, thickness)
#     return img


# def cleanup_old_outputs(keep_paths=None):
#     keep = {os.path.abspath(p) for p in (keep_paths or []) if p}
#     if not os.path.isdir(RESULTS_DIR):
#         return
#     for name in os.listdir(RESULTS_DIR):
#         path = os.path.join(RESULTS_DIR, name)
#         if not os.path.isfile(path) or os.path.abspath(path) in keep:
#             continue
#         if name.lower().endswith((".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v")):
#             try:
#                 os.unlink(path)
#             except OSError:
#                 pass


# def set_job(job_id, **kwargs):
#     with jobs_lock:
#         jobs[job_id].update(kwargs)


# class PlateTracker:
#     def __init__(self):
#         self.next_id = 1
#         self.plate_to_id = OrderedDict()
#         self.tracks = {}
#         self.best_car_crops = {}
#         self.id_best_plate = {}

#     def _id_for_plate(self, plate):
#         if plate in self.plate_to_id:
#             return self.plate_to_id[plate]
#         for known, tid in self.plate_to_id.items():
#             if max(len(known), len(plate)) >= 5 and edit_distance(known, plate) <= 1:
#                 return tid
#         tid = self.next_id
#         self.next_id += 1
#         self.plate_to_id[plate] = tid
#         return tid

#     def update(self, detections, frame_nmr):
#         assigned, results = set(), []
#         for det in detections:
#             text, bbox = det["plate_text"], det["plate_bbox"]
#             tid = None

#             if text:
#                 tid = self._id_for_plate(text)
#             else:
#                 best_iou, best_id = IOU_KEEP, None
#                 for existing_id, tr in self.tracks.items():
#                     if existing_id in assigned:
#                         continue
#                     score = iou(bbox, tr["plate_bbox"])
#                     if score > best_iou:
#                         best_iou, best_id = score, existing_id
#                 tid = best_id

#             if tid is None:
#                 tid = self.next_id
#                 self.next_id += 1

#             assigned.add(tid)
#             prev = self.tracks.get(tid, {})
#             text_score = det.get("text_score") or 0

#             if text and text_score >= (prev.get("text_score") or 0):
#                 plate, crop, kept_score = text, det.get("plate_crop"), text_score
#             else:
#                 plate = prev.get("plate_text") or text or "READING..."
#                 crop = prev.get("plate_crop") if prev.get("plate_crop") is not None else det.get("plate_crop")
#                 kept_score = prev.get("text_score") or 0

#             if text:
#                 self.plate_to_id[text] = tid
#                 cur_best = self.id_best_plate.get(tid)
#                 if cur_best is None or text_score > cur_best["score"]:
#                     self.id_best_plate[tid] = {"text": text, "score": text_score}

#             # Retain the largest valid car image crop
#             car_crop = det.get("car_crop")
#             if car_crop is not None and getattr(car_crop, "size", 0) > 0:
#                 prev_crop = self.best_car_crops.get(tid)
#                 if prev_crop is None or car_crop.size > prev_crop.size:
#                     self.best_car_crops[tid] = car_crop
#             elif tid not in self.best_car_crops and prev.get("car_crop") is not None:
#                 self.best_car_crops[tid] = prev.get("car_crop")

#             track = {
#                 "id": tid,
#                 "plate_text": plate,
#                 "text_score": kept_score,
#                 "plate_bbox": bbox,
#                 "car_bbox": det.get("car_bbox") or prev.get("car_bbox"),
#                 "plate_crop": crop,
#                 "car_crop": self.best_car_crops.get(tid),
#                 "last_frame": frame_nmr,
#             }
#             self.tracks[tid] = track
#             results.append(track)

#         for tid in [tid for tid, tr in self.tracks.items() if frame_nmr - tr["last_frame"] > 45]:
#             self.tracks.pop(tid, None)

#         return results


# def annotate(frame, tracks):
#     h, w = frame.shape[:2]
#     s = w / 3840.0
#     bthick, llen = max(3, int(25 * s)), max(18, int(200 * s))
#     pthick, gap = max(2, int(12 * s)), max(6, int(100 * s))
#     banner_h = max(28, int(300 * s))
#     fscale, fthick = max(0.7, 4.3 * s), max(2, int(17 * s))
#     for tr in tracks:
#         px1, py1, px2, py2 = [int(v) for v in tr["plate_bbox"]]
#         cv2.rectangle(frame, (px1, py1), (px2, py2), (0, 0, 255), pthick)
#         car = tr.get("car_bbox")
#         if car:
#             cx1, cy1, cx2, cy2 = [int(v) for v in car]
#             draw_border(frame, (cx1, cy1), (cx2, cy2), (0, 255, 0), bthick, llen, llen)
#             ax1, ay1, ax2 = cx1, cy1, cx2
#         else:
#             ax1, ay1, ax2 = px1, py1, px2

#         # Show the car/plate crop image whenever we HAVE a crop, even if the
#         # plate text hasn't been read yet ("READING...") or was never
#         # recognized. Only skip when there's genuinely no crop to show.
#         crop = tr.get("plate_crop")
#         label = tr.get("plate_text") or "UNREAD"
#         if crop is None or not getattr(crop, "size", 0):
#             continue
#         try:
#             ch, cw = crop.shape[:2]
#             x1 = int((ax1 + ax2 - cw) / 2)
#             y_crop2 = int(ay1 - gap)
#             y_crop1 = y_crop2 - ch
#             y_ban1 = y_crop1 - banner_h
#             if x1 < 0 or y_ban1 < 0 or x1 + cw > w or y_crop2 > h:
#                 continue
#             frame[y_crop1:y_crop2, x1:x1 + cw] = crop
#             frame[y_ban1:y_crop1, x1:x1 + cw] = (255, 255, 255)
#             (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, fscale, fthick)
#             cv2.putText(
#                 frame, label,
#                 (int(x1 + (cw - tw) / 2), int(y_ban1 + (banner_h + th) / 2)),
#                 cv2.FONT_HERSHEY_SIMPLEX, fscale, (0, 0, 0), fthick,
#             )
#         except Exception:
#             pass
#     return frame


# def ffmpeg_exe():
#     found = shutil.which("ffmpeg")
#     if found:
#         return found
#     try:
#         import imageio_ffmpeg
#         return imageio_ffmpeg.get_ffmpeg_exe()
#     except Exception:
#         return None


# def _run_ffmpeg(cmd):
#     kwargs = {"check": True, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
#     if os.name == "nt":
#         kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
#     subprocess.run(cmd, **kwargs)


# def open_video(input_path, job_id):
#     input_path = os.path.abspath(input_path)
#     if not os.path.isfile(input_path) or os.path.getsize(input_path) < 100:
#         raise RuntimeError("Uploaded video is missing or empty. Try uploading again.")
#     cap = cv2.VideoCapture(input_path)
#     if cap.isOpened():
#         ok, _ = cap.read()
#         cap.release()
#         if ok:
#             return cv2.VideoCapture(input_path), None
#     ffmpeg = ffmpeg_exe()
#     if not ffmpeg:
#         raise RuntimeError("Could not open this video. Convert it to MP4 (H.264) and upload again.")
#     set_job(job_id, message="Converting video so it can be read...")
#     converted = os.path.join(RESULTS_DIR, f"{uuid.uuid4().hex}_cv.mp4")
#     try:
#         _run_ffmpeg([
#             ffmpeg, "-y", "-i", input_path,
#             "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
#             "-pix_fmt", "yuv420p", "-an", converted,
#         ])
#     except subprocess.CalledProcessError:
#         raise RuntimeError("Could not convert this video. Use an MP4 file and try again.") from None
#     cap = cv2.VideoCapture(converted)
#     if not cap.isOpened():
#         raise RuntimeError("Could not open uploaded video after conversion.")
#     return cap, converted


# def make_browser_mp4(src, dst, job_id):
#     ffmpeg = ffmpeg_exe()
#     if not ffmpeg:
#         if os.path.abspath(src) != os.path.abspath(dst):
#             os.replace(src, dst)
#         return dst
#     set_job(job_id, message="Encoding a smaller video for the browser...")
#     _run_ffmpeg([
#         ffmpeg, "-y", "-i", src,
#         "-c:v", "libx264", "-preset", "ultrafast", "-crf", "32",
#         "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", dst,
#     ])
#     try:
#         os.unlink(src)
#     except OSError:
#         pass
#     if not os.path.exists(dst) or os.path.getsize(dst) < 1000:
#         raise RuntimeError("Could not encode browser video")
#     return dst


# def process_video(input_path, output_path, job_id):
#     load_models()
#     cap, converted = open_video(input_path, job_id)
#     fps = cap.get(cv2.CAP_PROP_FPS) or 25
#     width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
#     height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
#     total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
#     scale = min(1.0, 1280 / max(width, 1))
#     out_w = max(2, int(width * scale) // 2 * 2)
#     out_h = max(2, int(height * scale) // 2 * 2)
#     detect_every = max(3, int(round(fps / 5)) or 3)
#     writer = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (out_w, out_h))
#     crop_h = max(50, int(400 * (out_w / 3840.0)))
#     tracker, last_tracks, frame_nmr = PlateTracker(), [], -1
#     set_job(job_id, total=total, frame=0, message="Reading video...")
#     try:
#         while True:
#             ok, frame = cap.read()
#             if not ok:
#                 break
#             frame_nmr += 1
#             if scale < 1:
#                 frame = cv2.resize(frame, (out_w, out_h))
#             if frame_nmr % detect_every == 0:
#                 # Optimized inference on target GPU device
#                 vehicles = coco_model(frame, imgsz=640, device=DEVICE, verbose=False)[0]
#                 vehicle_boxes = []
#                 for vx1, vy1, vx2, vy2, vscore, vcls in vehicles.boxes.data.tolist():
#                     if int(vcls) in VEHICLE_CLASSES and vscore > 0.3:
#                         vehicle_boxes.append([vx1, vy1, vx2, vy2, len(vehicle_boxes)])
#                 car_tracks = np.array(vehicle_boxes) if vehicle_boxes else np.empty((0, 5))

#                 # Optimized inference on target GPU device
#                 plates = plate_model(frame, imgsz=640, device=DEVICE, verbose=False)[0]
#                 detections = []
#                 for x1, y1, x2, y2, score, class_id in plates.boxes.data.tolist():
#                     if score < 0.25:
#                         continue
#                     x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
#                     crop = frame[max(0, y1):max(0, y2), max(0, x1):max(0, x2)]
#                     if crop.size == 0:
#                         continue
#                     text, text_score = read_license_plate(crop)
#                     car_bbox = None
#                     car_crop = None

#                     if len(car_tracks):
#                         xcar1, ycar1, xcar2, ycar2, car_id = get_car(
#                             [x1, y1, x2, y2, score, class_id], car_tracks
#                         )
#                         if car_id != -1:
#                             cx1, cy1, cx2, cy2 = map(int, [xcar1, ycar1, xcar2, ycar2])
#                             car_bbox = [cx1, cy1, cx2, cy2]
#                             car_crop = frame[max(0, cy1):min(out_h, cy2), max(0, cx1):min(out_w, cx2)].copy()

#                     # Fallback padding crop if no car bounding box was matched
#                     if car_crop is None or car_crop.size == 0:
#                         pad_x = max(40, (x2 - x1) * 2)
#                         pad_y = max(60, (y2 - y1) * 3)
#                         cx1 = max(0, x1 - pad_x)
#                         cy1 = max(0, y1 - pad_y)
#                         cx2 = min(out_w, x2 + pad_x)
#                         cy2 = min(out_h, y2 + pad_y)
#                         car_crop = frame[cy1:cy2, cx1:cx2].copy()
#                         car_bbox = [cx1, cy1, cx2, cy2]

#                     ph, pw = crop.shape[:2]
#                     crop_show = cv2.resize(crop, (max(40, int(pw * crop_h / max(ph, 1))), crop_h)) if ph else crop
#                     detections.append({
#                         "plate_bbox": [x1, y1, x2, y2],
#                         "plate_text": text,
#                         "text_score": text_score or 0,
#                         "car_bbox": car_bbox,
#                         "plate_crop": crop_show,
#                         "car_crop": car_crop,
#                     })
#                 last_tracks = tracker.update(detections, frame_nmr)
#             annotated = frame.copy()
#             annotate(annotated, last_tracks)
#             writer.write(annotated)
#             if frame_nmr % 2 == 0:
#                 set_job(job_id, frame=frame_nmr + 1, total=total,
#                         message=f"Tracking frame {frame_nmr + 1} / {total or '?'}")
#     finally:
#         cap.release()
#         writer.release()
#         if converted and os.path.exists(converted):
#             try:
#                 os.unlink(converted)
#             except OSError:
#                 pass
#     if not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
#         raise RuntimeError("Could not write result video")

#     # Construct the out_plates list with Base64 encoded images
#     out_plates = []

#     # Check both tracker.id_best_plate and tracker.plate_to_id
#     tracked_ids = set(tracker.id_best_plate.keys()) | set(tracker.plate_to_id.values())

#     for tid in sorted(tracked_ids):
#         info = tracker.id_best_plate.get(tid, {})
#         plate = info.get("text")

#         # Fallback to plate_to_id map if id_best_plate was missed
#         if not plate:
#             for p_text, p_id in tracker.plate_to_id.items():
#                 if p_id == tid:
#                     plate = p_text
#                     break

#         # Even if OCR never produced valid text, still surface the vehicle
#         # with a placeholder label instead of dropping it from the results.
#         if not plate:
#             plate = f"Vehicle #{tid} (Unread)"

#         crop = tracker.best_car_crops.get(tid)
#         if crop is None or getattr(crop, "size", 0) == 0:
#             continue

#         th, tw = crop.shape[:2]
#         max_side = 320
#         if max(th, tw) > max_side:
#             scale_ratio = max_side / max(th, tw)
#             crop = cv2.resize(crop, (int(tw * scale_ratio), int(th * scale_ratio)))

#         ok, buf = cv2.imencode(".jpg", crop, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
#         if not ok:
#             continue

#         car_img_b64 = f"data:image/jpeg;base64,{base64.b64encode(buf).decode('utf-8')}"

#         out_plates.append({
#             "id": tid,
#             "plate": plate,
#             "image": car_img_b64,
#             "car_image": car_img_b64,
#             "car_crop": car_img_b64,
#             "crop": car_img_b64,
#             "car_image_b64": car_img_b64,
#             "car_img": car_img_b64,
#             "vehicle_image": car_img_b64,
#             "src": car_img_b64,
#         })

#     return out_plates


# def disk_error(exc):
#     if isinstance(exc, OSError) and getattr(exc, "errno", None) == 28:
#         return "Disk is full. Free space, then upload a smaller video."
#     text = str(exc)
#     if "No space left" in text or "Errno 28" in text:
#         return "Disk is full. Free space, then upload a smaller video."
#     return text


# def worker(job_id, in_path, raw_path, final_path, delete_input=True):
#     try:
#         plates = process_video(in_path, raw_path, job_id)
#         make_browser_mp4(raw_path, final_path, job_id)
#         set_job(
#             job_id, status="done", plates=plates, output=final_path,
#             video_url=f"/api/plate-track-result/{job_id}", message="Done",
#         )
#     except Exception as exc:
#         msg = disk_error(exc)
#         set_job(job_id, status="error", error=msg, message=msg)
#         for path in (raw_path, final_path):
#             if os.path.exists(path):
#                 try:
#                     os.unlink(path)
#                 except OSError:
#                     pass
#     finally:
#         if delete_input and os.path.exists(in_path):
#             os.unlink(in_path)


# def launch_job(in_path, delete_input=True):
#     """Kick off a background tracking job. Called by main.py's
#     /api/plate-track and /api/plate-track-sample handlers.
#     """
#     cleanup_old_outputs(keep_paths=[in_path])
#     job_id = uuid.uuid4().hex
#     raw_path = os.path.join(RESULTS_DIR, f"{job_id}_raw.mp4")
#     final_path = os.path.join(RESULTS_DIR, f"{job_id}.mp4")
#     with jobs_lock:
#         jobs[job_id] = {
#             "status": "running", "frame": 0, "total": 0, "message": "Starting models...",
#             "output": final_path, "plates": [], "error": None, "video_url": None,
#         }
#     threading.Thread(target=worker, args=(job_id, in_path, raw_path, final_path, delete_input), daemon=True).start()
#     return job_id
