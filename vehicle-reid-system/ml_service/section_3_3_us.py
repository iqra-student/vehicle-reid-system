"""3.3 Plate-based vehicle tracking — ML service module.
"""
import base64
import os
import shutil
import string
import subprocess
import threading
import uuid
from collections import OrderedDict

import cv2
import easyocr
import numpy as np
from ultralytics import YOLO

try:
    from pymongo import MongoClient
    _PYMONGO_OK = True
except Exception:
    MongoClient = None
    _PYMONGO_OK = False

ROOT = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(ROOT, "results_3_3")
MOD3_DIR = os.path.join(ROOT, "results_3_3_mod3")
os.makedirs(RESULTS_DIR, exist_ok=True)
os.makedirs(MOD3_DIR, exist_ok=True)

# ---- NEW: region constants (needed by dispatcher / launch_job) ----
DEFAULT_REGION = "US"
VALID_REGIONS = {"US", "NL"}

IOU_KEEP = 0.25
VEHICLE_CLASSES = {2, 3, 5, 7}
MAX_UPLOAD_BYTES = 40 * 1024 * 1024
MIN_OCR_CONFIDENCE = 0.35

# Save every Nth sighting of a car, up to MAX_FRAMES_PER_CAR images
SAVE_EVERY_N = 6
MAX_FRAMES_PER_CAR = 3

# --- MongoDB config (change if needed, or set env var MONGO_URI) -----------
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.environ.get("MONGO_DB", "vehicle_tracking")
MONGO_COLL = os.environ.get("MONGO_COLL", "platevehicles")

plate_model = None
coco_model = None
ocr_reader = None
jobs = {}
jobs_lock = threading.Lock()

_mongo_client = None
_mongo_lock = threading.Lock()

CHAR_TO_INT = {"O": "0", "I": "1", "J": "3", "A": "4", "G": "6", "S": "5"}
INT_TO_CHAR = {"0": "O", "1": "I", "3": "J", "4": "A", "6": "G", "5": "S"}


# ---------------------------------------------------------------------------
# MongoDB helpers
# ---------------------------------------------------------------------------
def _get_mongo_collection():
    """Lazy, best-effort Mongo connection. Returns collection or None."""
    global _mongo_client
    if not _PYMONGO_OK:
        return None
    with _mongo_lock:
        if _mongo_client is None:
            try:
                _mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=1500)
                _mongo_client.admin.command("ping")
            except Exception:
                _mongo_client = None
                return None
    try:
        return _mongo_client[MONGO_DB][MONGO_COLL]
    except Exception:
        return None


def _save_car_to_mongo(car_id, filenames):
    """Upsert one PlateVehicle doc keyed by plateNumber == str(car_id)."""
    coll = _get_mongo_collection()
    if coll is None or not filenames:
        return
    plate_key = str(car_id)
    sightings = [
        {
            "cameraId": "cam_3_3",
            "confidence": 1.0,
            "imageFilename": fn,
        }
        for fn in filenames
    ]
    try:
        coll.update_one(
            {"plateNumber": plate_key},
            {
                "$setOnInsert": {"plateNumber": plate_key, "createdAt": __import__("datetime").datetime.utcnow()},
                "$set": {"updatedAt": __import__("datetime").datetime.utcnow()},
                "$push": {"sightings": {"$each": sightings}},
            },
            upsert=True,
        )
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Disk helper: save one car frame as img<id>.<n>.jpg under results_3_3_mod3/<id>/
# ---------------------------------------------------------------------------
def _save_mod3_frame(car_id, index, frame_img):
    """Returns the filename (relative) on success, else None."""
    if frame_img is None or getattr(frame_img, "size", 0) == 0:
        return None
    folder = os.path.join(MOD3_DIR, str(car_id))
    try:
        os.makedirs(folder, exist_ok=True)
    except OSError:
        return None
    filename = f"img{car_id}.{index}.jpg"
    path = os.path.join(folder, filename)
    try:
        ok = cv2.imwrite(path, frame_img, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    except Exception:
        ok = False
    if not ok:
        return None
    return filename


# ---------------------------------------------------------------------------
# Model loading
# ---------------------------------------------------------------------------
def plate_model_path():
    for path in (
        os.path.join(ROOT, "license_plate_detector.pt"),
        os.path.join(ROOT, "models", "license_plate_detector.pt"),
    ):
        if os.path.isfile(path):
            return path
    raise FileNotFoundError(
        "Put license_plate_detector.pt next to section_3_3.py or in a models folder."
    )


def load_models():
    global plate_model, coco_model, ocr_reader
    if plate_model is None:
        plate_model = YOLO(plate_model_path())
    if coco_model is None:
        coco_model = YOLO("yolov8n.pt")
    if ocr_reader is None:
        ocr_reader = easyocr.Reader(["en"], gpu=False)


# ---------------------------------------------------------------------------
# Plate OCR helpers
# ---------------------------------------------------------------------------
def license_complies_format(text):
    if len(text) != 7:
        return False
    letters = string.ascii_uppercase
    return (
        (text[0] in letters or text[0] in INT_TO_CHAR)
        and (text[1] in letters or text[1] in INT_TO_CHAR)
        and (text[2].isdigit() or text[2] in CHAR_TO_INT)
        and (text[3].isdigit() or text[3] in CHAR_TO_INT)
        and (text[4] in letters or text[4] in INT_TO_CHAR)
        and (text[5] in letters or text[5] in INT_TO_CHAR)
        and (text[6] in letters or text[6] in INT_TO_CHAR)
    )


def format_license(text):
    mapping = {0: INT_TO_CHAR, 1: INT_TO_CHAR, 2: CHAR_TO_INT, 3: CHAR_TO_INT,
               4: INT_TO_CHAR, 5: INT_TO_CHAR, 6: INT_TO_CHAR}
    return "".join(mapping[i].get(text[i], text[i]) for i in range(7))


def _plate_preprocess_variants(crop):
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]
    if max(h, w) < 300:
        gray = cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)

    variants = [gray]
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    variants.append(otsu)
    _, fixed = cv2.threshold(gray, 64, 255, cv2.THRESH_BINARY_INV)
    variants.append(fixed)
    adaptive = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 31, 15
    )
    variants.append(adaptive)
    return variants


def read_license_plate(crop):
    if crop is None or crop.size == 0:
        return None, None

    best_text, best_score = None, 0.0
    for variant in _plate_preprocess_variants(crop):
        try:
            readings = ocr_reader.readtext(variant)
        except Exception:
            continue
        for _bbox, text, score in readings:
            text = text.upper().replace(" ", "")
            if not license_complies_format(text):
                continue
            if score > best_score:
                best_text, best_score = format_license(text), score

    if best_text is not None and best_score >= MIN_OCR_CONFIDENCE:
        return best_text, best_score
    return None, None


def get_car(license_plate, vehicle_track_ids):
    x1, y1, x2, y2, _score, _cls = license_plate
    for row in vehicle_track_ids:
        xcar1, ycar1, xcar2, ycar2, car_id = row
        if x1 > xcar1 and y1 > ycar1 and x2 < xcar2 and y2 < ycar2:
            return xcar1, ycar1, xcar2, ycar2, car_id
    return -1, -1, -1, -1, -1


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area_a = max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])
    area_b = max(0.0, b[2] - b[0]) * max(0.0, b[3] - b[1])
    return inter / (area_a + area_b - inter + 1e-6)


def edit_distance(a, b):
    if a == b:
        return 0
    la, lb = len(a), len(b)
    if abs(la - lb) > 2:
        return 99
    prev = list(range(lb + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def draw_border(img, top_left, bottom_right, color=(0, 255, 0), thickness=6,
                line_length_x=50, line_length_y=50):
    x1, y1 = top_left
    x2, y2 = bottom_right
    cv2.line(img, (x1, y1), (x1, y1 + line_length_y), color, thickness)
    cv2.line(img, (x1, y1), (x1 + line_length_x, y1), color, thickness)
    cv2.line(img, (x1, y2), (x1, y2 - line_length_y), color, thickness)
    cv2.line(img, (x1, y2), (x1 + line_length_x, y2), color, thickness)
    cv2.line(img, (x2, y1), (x2 - line_length_x, y1), color, thickness)
    cv2.line(img, (x2, y1), (x2, y1 + line_length_y), color, thickness)
    cv2.line(img, (x2, y2), (x2, y2 - line_length_y), color, thickness)
    cv2.line(img, (x2, y2), (x2 - line_length_x, y2), color, thickness)
    return img


def cleanup_old_outputs(keep_paths=None):
    keep = {os.path.abspath(p) for p in (keep_paths or []) if p}
    if not os.path.isdir(RESULTS_DIR):
        return
    for name in os.listdir(RESULTS_DIR):
        path = os.path.join(RESULTS_DIR, name)
        if not os.path.isfile(path) or os.path.abspath(path) in keep:
            continue
        if name.lower().endswith((".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v")):
            try:
                os.unlink(path)
            except OSError:
                pass


def set_job(job_id, **kwargs):
    with jobs_lock:
        jobs[job_id].update(kwargs)


# ---------------------------------------------------------------------------
# Tracker
# ---------------------------------------------------------------------------
class PlateTracker:
    def __init__(self):
        self.next_id = 1
        self.plate_to_id = OrderedDict()
        self.tracks = {}
        # per car: how many sightings we've seen, and how many frames saved
        self.sight_count = {}
        self.saved_frames = {}   # {car_id: [filename, ...]}

    def _id_for_plate(self, plate):
        if plate in self.plate_to_id:
            return self.plate_to_id[plate]
        for known, tid in self.plate_to_id.items():
            if max(len(known), len(plate)) >= 5 and edit_distance(known, plate) <= 1:
                return tid
        tid = self.next_id
        self.next_id += 1
        self.plate_to_id[plate] = tid
        return tid

    def update(self, detections, frame_nmr):
        assigned, results = set(), []
        for det in detections:
            text, bbox = det["plate_text"], det["plate_bbox"]
            tid = None

            if text:
                tid = self._id_for_plate(text)
            else:
                best_iou, best_id = IOU_KEEP, None
                for existing_id, tr in self.tracks.items():
                    if existing_id in assigned:
                        continue
                    score = iou(bbox, tr["plate_bbox"])
                    if score > best_iou:
                        best_iou, best_id = score, existing_id
                tid = best_id

            if tid is None:
                tid = self.next_id
                self.next_id += 1

            assigned.add(tid)
            prev = self.tracks.get(tid, {})
            text_score = det.get("text_score") or 0

            if text and text_score >= (prev.get("text_score") or 0):
                plate, crop, kept_score = text, det.get("plate_crop"), text_score
            else:
                plate = prev.get("plate_text") or text or "READING..."
                crop = prev.get("plate_crop") if prev.get("plate_crop") is not None else det.get("plate_crop")
                kept_score = prev.get("text_score") or 0

            if text:
                self.plate_to_id[text] = tid

            track = {
                "id": tid,
                "plate_text": plate,
                "text_score": kept_score,
                "plate_bbox": bbox,
                "car_bbox": det.get("car_bbox") or prev.get("car_bbox"),
                "plate_crop": crop,
                "car_crop": det.get("car_crop") if det.get("car_crop") is not None else prev.get("car_crop"),
                "last_frame": frame_nmr,
            }
            self.tracks[tid] = track
            results.append(track)

        for tid in [tid for tid, tr in self.tracks.items() if frame_nmr - tr["last_frame"] > 45]:
            self.tracks.pop(tid, None)

        return results


# ---------------------------------------------------------------------------
# Annotation
# ---------------------------------------------------------------------------
def annotate(frame, tracks):
    h, w = frame.shape[:2]
    s = w / 3840.0
    bthick, llen = max(3, int(25 * s)), max(18, int(200 * s))
    pthick, gap = max(2, int(12 * s)), max(6, int(100 * s))
    banner_h = max(28, int(300 * s))
    fscale, fthick = max(0.7, 4.3 * s), max(2, int(17 * s))
    for tr in tracks:
        px1, py1, px2, py2 = [int(v) for v in tr["plate_bbox"]]
        cv2.rectangle(frame, (px1, py1), (px2, py2), (0, 0, 255), pthick)
        car = tr.get("car_bbox")
        if car:
            cx1, cy1, cx2, cy2 = [int(v) for v in car]
            draw_border(frame, (cx1, cy1), (cx2, cy2), (0, 255, 0), bthick, llen, llen)
            ax1, ay1, ax2 = cx1, cy1, cx2
        else:
            ax1, ay1, ax2 = px1, py1, px2
        crop, label = tr.get("plate_crop"), tr.get("plate_text") or ""
        if crop is None or not getattr(crop, "size", 0) or label in ("", "READING..."):
            continue
        try:
            ch, cw = crop.shape[:2]
            x1 = int((ax1 + ax2 - cw) / 2)
            y_crop2 = int(ay1 - gap)
            y_crop1 = y_crop2 - ch
            y_ban1 = y_crop1 - banner_h
            if x1 < 0 or y_ban1 < 0 or x1 + cw > w or y_crop2 > h:
                continue
            frame[y_crop1:y_crop2, x1:x1 + cw] = crop
            frame[y_ban1:y_crop1, x1:x1 + cw] = (255, 255, 255)
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, fscale, fthick)
            cv2.putText(
                frame, label,
                (int(x1 + (cw - tw) / 2), int(y_ban1 + (banner_h + th) / 2)),
                cv2.FONT_HERSHEY_SIMPLEX, fscale, (0, 0, 0), fthick,
            )
        except Exception:
            pass
    return frame


# ---------------------------------------------------------------------------
# ffmpeg helpers
# ---------------------------------------------------------------------------
def ffmpeg_exe():
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _run_ffmpeg(cmd):
    kwargs = {"check": True, "stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL}
    if os.name == "nt":
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    subprocess.run(cmd, **kwargs)


def open_video(input_path, job_id):
    input_path = os.path.abspath(input_path)
    if not os.path.isfile(input_path) or os.path.getsize(input_path) < 100:
        raise RuntimeError("Uploaded video is missing or empty. Try uploading again.")
    cap = cv2.VideoCapture(input_path)
    if cap.isOpened():
        ok, _ = cap.read()
        cap.release()
        if ok:
            return cv2.VideoCapture(input_path), None
    ffmpeg = ffmpeg_exe()
    if not ffmpeg:
        raise RuntimeError("Could not open this video. Convert it to MP4 (H.264) and upload again.")
    set_job(job_id, message="Converting video so it can be read...")
    converted = os.path.join(RESULTS_DIR, f"{uuid.uuid4().hex}_cv.mp4")
    try:
        _run_ffmpeg([
            ffmpeg, "-y", "-i", input_path,
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
            "-pix_fmt", "yuv420p", "-an", converted,
        ])
    except subprocess.CalledProcessError:
        raise RuntimeError("Could not convert this video. Use an MP4 file and try again.") from None
    cap = cv2.VideoCapture(converted)
    if not cap.isOpened():
        raise RuntimeError("Could not open uploaded video after conversion.")
    return cap, converted


def make_browser_mp4(src, dst, job_id):
    ffmpeg = ffmpeg_exe()
    if not ffmpeg:
        if os.path.abspath(src) != os.path.abspath(dst):
            os.replace(src, dst)
        return dst
    set_job(job_id, message="Encoding a smaller video for the browser...")
    _run_ffmpeg([
        ffmpeg, "-y", "-i", src,
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "32",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", dst,
    ])
    try:
        os.unlink(src)
    except OSError:
        pass
    if not os.path.exists(dst) or os.path.getsize(dst) < 1000:
        raise RuntimeError("Could not encode browser video")
    return dst


# ---------------------------------------------------------------------------
# Encode helpers
# ---------------------------------------------------------------------------
def _encode_jpeg_b64(img, max_side=320, quality=85):
    if img is None or getattr(img, "size", 0) == 0:
        return None
    th, tw = img.shape[:2]
    if max(th, tw) > max_side:
        r = max_side / float(max(th, tw))
        img = cv2.resize(img, (max(1, int(tw * r)), max(1, int(th * r))),
                         interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    if not ok:
        return None
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode("ascii")


# ---------------------------------------------------------------------------
# Main processing
# ---------------------------------------------------------------------------
# ---- NEW: region + camera_id parameters ----
def process_video(input_path, output_path, job_id, region="US", camera_id=None):
    load_models()
    cap, converted = open_video(input_path, job_id)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    scale = min(1.0, 1280 / max(width, 1))
    out_w = max(2, int(width * scale) // 2 * 2)
    out_h = max(2, int(height * scale) // 2 * 2)
    detect_every = max(3, int(round(fps / 5)) or 3)
    writer = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (out_w, out_h))
    crop_h = max(50, int(400 * (out_w / 3840.0)))
    tracker, last_tracks, frame_nmr = PlateTracker(), [], -1
    best_car_crop = {}     # {tid: (area, crop_img)}  -> for result cards
    set_job(job_id, total=total, frame=0, message="Reading video...")
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            frame_nmr += 1
            if scale < 1:
                frame = cv2.resize(frame, (out_w, out_h))
            if frame_nmr % detect_every == 0:
                vehicles = coco_model(frame, imgsz=640, verbose=False)[0]
                vehicle_boxes = []
                for vx1, vy1, vx2, vy2, vscore, vcls in vehicles.boxes.data.tolist():
                    if int(vcls) in VEHICLE_CLASSES and vscore > 0.3:
                        vehicle_boxes.append([vx1, vy1, vx2, vy2, len(vehicle_boxes)])
                car_tracks = np.array(vehicle_boxes) if vehicle_boxes else np.empty((0, 5))
                plates = plate_model(frame, imgsz=640, verbose=False)[0]
                detections = []
                for x1, y1, x2, y2, score, class_id in plates.boxes.data.tolist():
                    if score < 0.25:
                        continue
                    x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)
                    if x2 - x1 < 5 or y2 - y1 < 3:
                        continue
                    crop = frame[y1:y2, x1:x2]
                    if crop.size == 0:
                        continue
                    text, text_score = read_license_plate(crop)
                    car_bbox = None
                    car_crop = None
                    if len(car_tracks):
                        xcar1, ycar1, xcar2, ycar2, car_id = get_car(
                            [x1, y1, x2, y2, score, class_id], car_tracks
                        )
                        if car_id != -1:
                            cx1, cy1 = max(0, int(xcar1)), max(0, int(ycar1))
                            cx2, cy2 = min(frame.shape[1], int(xcar2)), min(frame.shape[0], int(ycar2))
                            if cx2 - cx1 > 4 and cy2 - cy1 > 4:
                                car_bbox = [cx1, cy1, cx2, cy2]
                                car_crop = frame[cy1:cy2, cx1:cx2].copy()
                    if car_crop is None:
                        pad_x = max(40, (x2 - x1) * 2)
                        pad_y = max(60, (y2 - y1) * 3)
                        cx1, cy1 = max(0, x1 - pad_x), max(0, y1 - pad_y)
                        cx2, cy2 = min(frame.shape[1], x2 + pad_x), min(frame.shape[0], y2 + pad_y)
                        if cx2 - cx1 > 4 and cy2 - cy1 > 4:
                            car_bbox = [cx1, cy1, cx2, cy2]
                            car_crop = frame[cy1:cy2, cx1:cx2].copy()
                    ph, pw = crop.shape[:2]
                    crop_show = cv2.resize(crop, (max(40, int(pw * crop_h / max(ph, 1))), crop_h)) if ph else crop
                    detections.append({
                        "plate_bbox": [x1, y1, x2, y2],
                        "plate_text": text,
                        "text_score": text_score or 0,
                        "car_bbox": car_bbox,
                        "car_crop": car_crop,
                        "plate_crop": crop_show,
                        "frame_img": frame.copy(),   # full annotated source frame (for mod3 disk images)
                    })
                last_tracks = tracker.update(detections, frame_nmr)

                # ---- best crop per track (for the cards below the video) ----
                for tr in last_tracks:
                    cc = tr.get("car_crop")
                    if cc is None or getattr(cc, "size", 0) == 0:
                        continue
                    area = cc.shape[0] * cc.shape[1]
                    prev = best_car_crop.get(tr["id"])
                    if prev is None or area > prev[0]:
                        best_car_crop[tr["id"]] = (area, cc.copy())

                # ---- save every SAVE_EVERY_Nth sighting, max MAX_FRAMES_PER_CAR ----
                # Use the detections list to find which det belonged to which track id
                det_by_bbox = {tuple(d["plate_bbox"]): d for d in detections}
                for tr in last_tracks:
                    tid = tr["id"]
                    tr["sight_count"] = tracker.sight_count.get(tid, 0) + 1
                    tracker.sight_count[tid] = tr["sight_count"]

                    saved = tracker.saved_frames.setdefault(tid, [])
                    if len(saved) >= MAX_FRAMES_PER_CAR:
                        continue
                    if tr["sight_count"] % SAVE_EVERY_N != 0:
                        continue

                    # what to write: prefer the cropped car, else the full frame
                    crop_img = tr.get("car_crop")
                    if crop_img is None or getattr(crop_img, "size", 0) == 0:
                        # fall back to the detection's full frame
                        det = det_by_bbox.get(tuple(tr["plate_bbox"]))
                        crop_img = det.get("frame_img") if det else None
                    if crop_img is None:
                        continue

                    idx = len(saved) + 1
                    fn = _save_mod3_frame(tid, idx, crop_img)
                    if fn:
                        saved.append(fn)

                        # ---- NEW: also save the same frame to Mongo + results_plates/ ----
                        try:
                            from plate_store import save_sighting
                            plate_now = tr.get("plate_text")
                            if plate_now and plate_now not in ("", "READING..."):
                                save_sighting(
                                    plate_number=plate_now,
                                    camera_id=camera_id or "unknown",
                                    confidence=tr.get("text_score") or 0.0,
                                    source="video",
                                    car_image_bgr=crop_img,
                                )
                        except Exception as e:
                            print(f"[3.3] plate_store save failed: {e}")

            annotated = frame.copy()
            annotate(annotated, last_tracks)
            writer.write(annotated)
            if frame_nmr % 2 == 0:
                set_job(job_id, frame=frame_nmr + 1, total=total,
                        message=f"Tracking frame {frame_nmr + 1} / {total or '?'}")
    finally:
        cap.release()
        writer.release()
        if converted and os.path.exists(converted):
            try:
                os.unlink(converted)
            except OSError:
                pass
    if not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
        raise RuntimeError("Could not write result video")

    # ---- push saved frames into MongoDB (one doc per car id) ----
    for tid, fns in tracker.saved_frames.items():
        if fns:
            _save_car_to_mongo(tid, fns)

    # ---- result cards: 1 per unique plate/track, with id + plate + image ----
    out_plates = []
    seen_ids = set()
    for plate, tid in tracker.plate_to_id.items():
        if tid in seen_ids:
            continue
        seen_ids.add(tid)
        crop_entry = best_car_crop.get(tid)
        car_img = _encode_jpeg_b64(crop_entry[1] if crop_entry else None)
        out_plates.append({
            "id": tid,
            "plate": plate,
            "image": car_img,
            "car_image": car_img,
            "car_crop": car_img,
            "crop": car_img,
            "car_image_b64": car_img,
            "car_img": car_img,
            "vehicle_image": car_img,
            "src": car_img,
            "saved_frames": tracker.saved_frames.get(tid, []),
            "folder": str(tid),
        })
    return out_plates


def disk_error(exc):
    if isinstance(exc, OSError) and getattr(exc, "errno", None) == 28:
        return "Disk is full. Free space, then upload a smaller video."
    text = str(exc)
    if "No space left" in text or "Errno 28" in text:
        return "Disk is full. Free space, then upload a smaller video."
    return text


# ---- NEW: worker accepts region + camera_id ----
def worker(job_id, in_path, raw_path, final_path, region="US", delete_input=True, camera_id=None):
    try:
        plates = process_video(in_path, raw_path, job_id, region=region, camera_id=camera_id)
        make_browser_mp4(raw_path, final_path, job_id)
        set_job(
            job_id, status="done", plates=plates, output=final_path,
            video_url=f"/api/plate-track-result/{job_id}", message="Done",
            region=region, camera_id=camera_id,
        )
    except Exception as exc:
        msg = disk_error(exc)
        set_job(job_id, status="error", error=msg, message=msg)
        for path in (raw_path, final_path):
            if os.path.exists(path):
                try:
                    os.unlink(path)
                except OSError:
                    pass
    finally:
        if delete_input and os.path.exists(in_path):
            os.unlink(in_path)


# ---- NEW: launch_job accepts region + camera_id ----
def launch_job(in_path, delete_input=True, region=None, camera_id=None):
    """Kick off a background tracking job. Called by main.py's
    /api/plate-track and /api/plate-track-sample handlers.
    """
    region = (region or DEFAULT_REGION or "US").upper()
    if region not in VALID_REGIONS:
        region = "US"

    cleanup_old_outputs(keep_paths=[in_path])
    job_id = uuid.uuid4().hex
    raw_path = os.path.join(RESULTS_DIR, f"{job_id}_raw.mp4")
    final_path = os.path.join(RESULTS_DIR, f"{job_id}.mp4")
    with jobs_lock:
        jobs[job_id] = {
            "status": "running", "frame": 0, "total": 0,
            "message": f"Starting models (region={region})...",
            "output": final_path, "plates": [], "error": None,
            "video_url": None, "region": region, "camera_id": camera_id,
        }
    threading.Thread(
        target=worker,
        args=(job_id, in_path, raw_path, final_path, region, delete_input, camera_id),
        daemon=True,
    ).start()
    return job_id