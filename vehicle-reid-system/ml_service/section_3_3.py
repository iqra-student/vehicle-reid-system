"""3.3 Plate-based vehicle tracking — ML service module.

Used by FastAPI in main.py. Needs license_plate_detector.pt next to this
file or in models/. yolov8n.pt downloads on first run.
"""
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
    from flask import Flask, jsonify, render_template_string, request, send_file
except ImportError:
    Flask = None

ROOT = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(ROOT, "results_3_3")
os.makedirs(RESULTS_DIR, exist_ok=True)
IOU_KEEP = 0.25
VEHICLE_CLASSES = {2, 3, 5, 7}
MAX_UPLOAD_BYTES = 40 * 1024 * 1024
MIN_OCR_CONFIDENCE = 0.35

app = Flask(__name__) if Flask is not None else None
if app is not None:
    app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

plate_model = None
coco_model = None
ocr_reader = None
jobs = {}
jobs_lock = threading.Lock()

CHAR_TO_INT = {"O": "0", "I": "1", "J": "3", "A": "4", "G": "6", "S": "5"}
INT_TO_CHAR = {"0": "O", "1": "I", "3": "J", "4": "A", "6": "G", "5": "S"}

INDEX_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>3.3 Plate-Based Vehicle Tracking</title>
  <style>
    :root { --bg:#0b1220; --card:#121a2b; --line:#243049; --text:#e8eefc; --muted:#93a0bb; --accent:#3ddc97; --accent-2:#5b8cff; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:Segoe UI,sans-serif; background:radial-gradient(1200px 600px at 10% -10%, #173056 0%, var(--bg) 45%); color:var(--text); }
    .wrap { max-width:1100px; margin:0 auto; padding:32px 20px 48px; }
    h1 { margin:0 0 8px; font-size:28px; }
    p.sub { margin:0 0 24px; color:var(--muted); }
    .card { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:20px; }
    .row { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
    input[type="file"] { color:var(--muted); }
    button { background:linear-gradient(90deg, var(--accent), #2bbf7a); color:#062016; border:0; border-radius:10px; padding:10px 18px; font-weight:700; cursor:pointer; }
    button:disabled { opacity:.5; cursor:wait; }
    .status { margin-top:12px; color:var(--muted); min-height:20px; }
    .bar { margin-top:12px; height:10px; background:#0e1626; border-radius:99px; overflow:hidden; border:1px solid var(--line); }
    .bar > span { display:block; height:100%; width:0; background:var(--accent); transition:width .2s; }
    .screen { margin-top:16px; background:#000; border-radius:12px; min-height:280px; display:flex; align-items:center; justify-content:center; color:var(--muted); }
    video { width:100%; border-radius:12px; display:none; background:#000; }
    .plates { margin-top:16px; display:flex; flex-wrap:wrap; gap:8px; }
    .chip { border:1px solid var(--line); background:#0e1626; border-radius:999px; padding:6px 12px; font-size:13px; color:var(--accent-2); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>3.3 Plate-Based Vehicle Tracking</h1>
    <p class="sub">Green car corners, red plate box, plate crop + text. Same plate number keeps the same vehicle ID.</p>
    <div class="card">
      <form id="form" class="row">
        <input id="video" name="video" type="file" accept="video/*" />
        <button id="go" type="submit">Upload and track</button>
        <button id="sample" type="button">Use sample.mp4</button>
      </form>
      <div class="status" id="status">Upload a camera video, or click Use sample.mp4.</div>
      <div class="bar"><span id="fill"></span></div>
      <div class="screen" id="screen">Output video will appear here</div>
      <video id="player" controls playsinline></video>
      <p><a id="download" href="#" download="plate_tracking.mp4" style="display:none;color:#5b8cff">Download output video</a></p>
      <div class="plates" id="plates"></div>
    </div>
  </div>
  <script>
    const form = document.getElementById("form");
    const videoInput = document.getElementById("video");
    const go = document.getElementById("go");
    const status = document.getElementById("status");
    const fill = document.getElementById("fill");
    const player = document.getElementById("player");
    const screen = document.getElementById("screen");
    const plates = document.getElementById("plates");
    const download = document.getElementById("download");
    const sampleBtn = document.getElementById("sample");
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function readJson(res) {
      const text = await res.text();
      try { return JSON.parse(text); }
      catch (_) { throw new Error("Server error. Check the Python window, then try again."); }
    }

    async function runJob(startPromise) {
      go.disabled = true;
      sampleBtn.disabled = true;
      plates.innerHTML = "";
      player.style.display = "none";
      player.removeAttribute("src");
      screen.style.display = "flex";
      fill.style.width = "2%";
      download.style.display = "none";
      try {
        const start = await startPromise;
        const started = await readJson(start);
        if (!start.ok) throw new Error(started.error || "Upload failed");
        status.textContent = "Tracking plates. Keep this tab open.";
        screen.textContent = "Processing...";
        let job;
        while (true) {
          const res = await fetch("/status/" + started.job_id);
          job = await readJson(res);
          if (!res.ok) throw new Error(job.error || "Status failed");
          status.textContent = job.message || "Working...";
          screen.textContent = job.message || "Working...";
          if (job.total) fill.style.width = Math.min(100, Math.round((job.frame / job.total) * 100)) + "%";
          if (job.status === "done") break;
          if (job.status === "error") throw new Error(job.error || "Tracking failed");
          await sleep(1500);
        }
        const url = job.video_url || ("/result/" + started.job_id);
        screen.style.display = "none";
        player.style.display = "block";
        player.src = url;
        player.load();
        const tryPlay = player.play();
        if (tryPlay && tryPlay.catch) tryPlay.catch(() => {});
        download.href = url;
        download.style.display = "inline";
        fill.style.width = "100%";
        (job.plates || []).forEach((item) => {
          const chip = document.createElement("div");
          chip.className = "chip";
          chip.textContent = "ID " + item.id + ": " + item.plate;
          plates.appendChild(chip);
        });
        status.textContent = "Output is on this screen. Press play if needed.";
      } catch (err) {
        screen.style.display = "flex";
        screen.textContent = err.message;
        status.textContent = err.message;
      } finally {
        go.disabled = false;
        sampleBtn.disabled = false;
      }
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!videoInput.files.length) {
        status.textContent = "Choose a file, or click Use sample.mp4.";
        return;
      }
      const data = new FormData();
      data.append("video", videoInput.files[0]);
      screen.textContent = "Uploading your video...";
      await runJob(fetch("/track", { method: "POST", body: data }));
    });
    sampleBtn.addEventListener("click", async () => {
      screen.textContent = "Using sample.mp4...";
      await runJob(fetch("/track-sample", { method: "POST" }));
    });
  </script>
</body>
</html>
"""


def plate_model_path():
    path = os.path.join(ROOT, "weights", "license_plate_detector.pt")

    if os.path.isfile(path):
        return path

    raise FileNotFoundError(
        f"License plate detector not found at: {path}"
    )

def load_models():
    global plate_model, coco_model, ocr_reader
    if plate_model is None:
        plate_model = YOLO(plate_model_path())
    if coco_model is None:
        coco_model = YOLO("yolov8n.pt")
    if ocr_reader is None:
        ocr_reader = easyocr.Reader(["en"], gpu=False)


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
    mapping = {0: INT_TO_CHAR, 1: INT_TO_CHAR, 2: CHAR_TO_INT, 3: CHAR_TO_INT, 4: INT_TO_CHAR, 5: INT_TO_CHAR, 6: INT_TO_CHAR}
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


def draw_border(img, top_left, bottom_right, color=(0, 255, 0), thickness=6, line_length_x=50, line_length_y=50):
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


class PlateTracker:
    def __init__(self):
        self.next_id = 1
        self.plate_to_id = OrderedDict()
        self.tracks = {}

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
                "last_frame": frame_nmr,
            }
            self.tracks[tid] = track
            results.append(track)

        for tid in [tid for tid, tr in self.tracks.items() if frame_nmr - tr["last_frame"] > 45]:
            self.tracks.pop(tid, None)

        return results


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


def process_video(input_path, output_path, job_id):
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
                    crop = frame[max(0, y1):max(0, y2), max(0, x1):max(0, x2)]
                    if crop.size == 0:
                        continue
                    text, text_score = read_license_plate(crop)
                    car_bbox = None
                    if len(car_tracks):
                        xcar1, ycar1, xcar2, ycar2, car_id = get_car(
                            [x1, y1, x2, y2, score, class_id], car_tracks
                        )
                        if car_id != -1:
                            car_bbox = [int(xcar1), int(ycar1), int(xcar2), int(ycar2)]
                    ph, pw = crop.shape[:2]
                    crop_show = cv2.resize(crop, (max(40, int(pw * crop_h / max(ph, 1))), crop_h)) if ph else crop
                    detections.append({
                        "plate_bbox": [x1, y1, x2, y2],
                        "plate_text": text,
                        "text_score": text_score or 0,
                        "car_bbox": car_bbox,
                        "plate_crop": crop_show,
                    })
                last_tracks = tracker.update(detections, frame_nmr)
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
    return [{"id": tid, "plate": plate} for plate, tid in tracker.plate_to_id.items()]


def disk_error(exc):
    if isinstance(exc, OSError) and getattr(exc, "errno", None) == 28:
        return "Disk is full. Free space, then upload a smaller video."
    text = str(exc)
    if "No space left" in text or "Errno 28" in text:
        return "Disk is full. Free space, then upload a smaller video."
    return text


def worker(job_id, in_path, raw_path, final_path, delete_input=True):
    try:
        plates = process_video(in_path, raw_path, job_id)
        make_browser_mp4(raw_path, final_path, job_id)
        set_job(
            job_id, status="done", plates=plates, output=final_path,
            video_url=f"/result/{job_id}", message="Done",
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


def launch_job(in_path, delete_input=True):
    cleanup_old_outputs(keep_paths=[in_path])
    job_id = uuid.uuid4().hex
    raw_path = os.path.join(RESULTS_DIR, f"{job_id}_raw.mp4")
    final_path = os.path.join(RESULTS_DIR, f"{job_id}.mp4")
    with jobs_lock:
        jobs[job_id] = {
            "status": "running", "frame": 0, "total": 0, "message": "Starting models...",
            "output": final_path, "plates": [], "error": None, "video_url": None,
        }
    threading.Thread(target=worker, args=(job_id, in_path, raw_path, final_path, delete_input), daemon=True).start()
    return job_id


if app is not None:
    @app.route("/")
    def index():
        return render_template_string(INDEX_HTML)

    @app.route("/favicon.ico")
    def favicon():
        return ("", 204)

    @app.errorhandler(413)
    def too_large(_err):
        return jsonify({"error": "Video is too large. Use a file under 40 MB."}), 413

    @app.route("/track", methods=["POST"])
    def track():
        if "video" not in request.files or not request.files["video"].filename:
            return jsonify({"error": "Upload a camera video first"}), 400
        upload = request.files["video"]
        suffix = os.path.splitext(upload.filename)[1] or ".mp4"
        in_path = os.path.join(RESULTS_DIR, f"{uuid.uuid4().hex}_in{suffix}")
        try:
            upload.save(in_path)
        except OSError as exc:
            return jsonify({"error": disk_error(exc)}), 500
        return jsonify({"job_id": launch_job(in_path, delete_input=True)})

    @app.route("/track-sample", methods=["POST"])
    def track_sample():
        sample = os.path.join(ROOT, "sample.mp4")
        if not os.path.exists(sample):
            return jsonify({"error": "sample.mp4 is missing next to section_3_3.py"}), 404
        return jsonify({"job_id": launch_job(sample, delete_input=False)})

    @app.route("/status/<job_id>")
    def status(job_id):
        with jobs_lock:
            job = jobs.get(job_id)
            if not job:
                return jsonify({"error": "Unknown job"}), 404
            return jsonify({
                "status": job["status"], "frame": job["frame"], "total": job["total"],
                "message": job["message"], "plates": job.get("plates") or [],
                "error": job.get("error"), "video_url": job.get("video_url"),
            })

    @app.route("/result/<job_id>")
    def result(job_id):
        with jobs_lock:
            job = jobs.get(job_id)
            if not job:
                return jsonify({"error": "Unknown job"}), 404
            if job["status"] != "done":
                return jsonify({"error": "Still processing"}), 400
            out_path = job["output"]
        if not os.path.exists(out_path):
            return jsonify({"error": "Result video missing"}), 404
        return send_file(out_path, mimetype="video/mp4", as_attachment=False, download_name="plate_tracking.mp4", conditional=True)


def main():
    if app is None:
        raise RuntimeError("Flask is not installed. Use FastAPI via main.py instead.")
    cleanup_old_outputs()
    load_models()
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)


if __name__ == "__main__":
    main()