import os
import sys
import cv2
import re
import shutil
import tempfile
import traceback
import numpy as np
import torch
import time
from datetime import datetime
import json
import xml.etree.ElementTree as ET
from threading import Lock

from fastapi import (
    FastAPI,
    APIRouter,
    UploadFile,
    File,
    Form,
    HTTPException,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from ultralytics import YOLO
from torchvision import transforms
from PIL import Image

# ============================================================
# BASE DIRECTORY
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GALLERY_DIR = r"C:\Users\tayya\Documents\FYP\archive (1)\VeRi\image_test"
# ============================================================
# VERI LABEL MAPS (color/type codes -> real names)
# ============================================================

COLOR_MAP = {
    1: "Yellow", 2: "Orange", 3: "Green", 4: "Gray", 5: "Red",
    6: "Blue", 7: "White", 8: "Golden", 9: "Brown", 10: "Black",
}

TYPE_MAP = {
    1: "Sedan", 2: "SUV", 3: "Van", 4: "Hatchback", 5: "MPV",
    6: "Pickup", 7: "Bus", 8: "Truck", 9: "Estate",
}

def load_veri_labels(xml_path):
    """Parses test_label.xml into {filename: {vehicle_id, camera_id, color, type}}"""
    with open(xml_path, "r", encoding="utf-8") as f:
        xml_data = f.read()

    tree = ET.ElementTree(ET.fromstring(xml_data))
    root = tree.getroot()

    labels = {}

    for item in root.iter("Item"):
        image_name = item.get("imageName")
        vehicle_id = item.get("vehicleID")
        camera_id = item.get("cameraID")
        color_id = item.get("colorID")
        type_id = item.get("typeID")

        labels[image_name] = {
            "vehicle_id": vehicle_id,
            "camera_id": camera_id,
            "color": COLOR_MAP.get(int(color_id), "Unknown") if color_id else "Unknown",
            "type": TYPE_MAP.get(int(type_id), "Unknown") if type_id else "Unknown",
        }

    return labels

# Load labels once at startup
VERI_LABEL_PATH = os.path.join(GALLERY_DIR, "test_label.xml")
# Note: GALLERY_DIR points to image_test folder; test_label.xml sits one level up
# alongside it. Adjust path if needed:
VERI_LABEL_PATH = os.path.join(os.path.dirname(GALLERY_DIR), "test_label.xml")

VERI_LABELS = {}

if os.path.exists(VERI_LABEL_PATH):
    print(f"Loading VeRi labels from: {VERI_LABEL_PATH}")
    VERI_LABELS = load_veri_labels(VERI_LABEL_PATH)
    print(f"Loaded {len(VERI_LABELS)} vehicle labels.")
else:
    print(f"WARNING: test_label.xml not found at {VERI_LABEL_PATH}")

# ============================================================
# MATCH LOG (for dashboard stats)
# ============================================================

MATCH_LOG_PATH = os.path.join(BASE_DIR, "match_log.json")
match_log_lock = Lock()

def append_match_log(query_filename, query_camera, matches):
    """Appends one /find-match result to match_log.json"""
    entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "query_filename": query_filename,
        "query_camera": query_camera,
        "matches": matches,  # list of {camera, matched_filename, confidence, confidencePercentage}
    }

    with match_log_lock:
        logs = []
        if os.path.exists(MATCH_LOG_PATH):
            try:
                with open(MATCH_LOG_PATH, "r") as f:
                    logs = json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                logs = []

        logs.append(entry)

        # Keep only the last 500 entries so the file doesn't grow forever
        logs = logs[-500:]

        with open(MATCH_LOG_PATH, "w") as f:
            json.dump(logs, f, indent=2)

def read_match_log():
    """Reads all logged match results"""
    if not os.path.exists(MATCH_LOG_PATH):
        return []
    with match_log_lock:
        try:
            with open(MATCH_LOG_PATH, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

# ============================================================
# ANPR
# ============================================================

sys.path.insert(0, BASE_DIR)

try:
    from anpr import read_plate
    import section_3_3 as plate_track
except ImportError as e:
    # Missing anpr.py / section_3_3.py must NOT take down the whole service
    # (congestion detection, ReID, etc. don't depend on ANPR at all).
    print(f"[Warning] ANPR module import skipped: {e}")
    read_plate = None
    plate_track = None

# ============================================================
# CONGESTION DETECTION
# ============================================================

from congestion_engine import CongestionEngine

# ============================================================
# CLIP-ReID
# ============================================================

CLIP_REID_DIR = os.path.join(BASE_DIR, "clip_reid")

if CLIP_REID_DIR not in sys.path:
    sys.path.insert(0, CLIP_REID_DIR)

from model.make_model import make_model
from config import cfg_base as cfg
from pair_classifier import PairClassifier

# ============================================================
# DEVICE
# ============================================================

device_type = "cuda" if torch.cuda.is_available() else "cpu"
clip_device = device_type

print(f"Using device: {clip_device}")

# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="Smart City Surveillance - CLIP-ReID, ANPR & Congestion Engine"
)

api_router = APIRouter(prefix="/api")

# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# STATIC DIRECTORIES
# ============================================================

STATIC_DIR = os.path.join(BASE_DIR, "static")
MATCHES_DIR = os.path.join(STATIC_DIR, "matches")
DEBUG_DIR = os.path.join(STATIC_DIR, "debug")
ANNOTATED_DIR = os.path.join(STATIC_DIR, "annotated")  # <-- congestion module writes here

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(MATCHES_DIR, exist_ok=True)
os.makedirs(DEBUG_DIR, exist_ok=True)
os.makedirs(ANNOTATED_DIR, exist_ok=True)

app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static",
)

# ============================================================
# VEHICLE GALLERY
# ============================================================

GALLERY_DIR = (
    r"C:\Users\tayya\Documents\FYP\archive (1)\VeRi\image_test"
)

if os.path.exists(GALLERY_DIR):
    app.mount(
        "/gallery",
        StaticFiles(directory=GALLERY_DIR),
        name="gallery",
    )
else:
    print(f"WARNING: Gallery directory not found: {GALLERY_DIR}")

# ============================================================
# LOAD CLIP-ReID MODEL (optional — congestion detection doesn't need this)
# ============================================================

clip_model = None
classifier = None

clip_config_path = os.path.join(
    CLIP_REID_DIR,
    "configs",
    "veri",
    "vit_base.yml",
)

clip_weights_path = os.path.join(
    BASE_DIR,
    "weights",
    "ViT-B-16_60.pth",
)

classifier_weights_path = os.path.join(
    BASE_DIR,
    "weights",
    "pair_classifier_best.pth",
)

try:
    if not os.path.exists(clip_config_path):
        raise FileNotFoundError(f"CLIP-ReID config not found: {clip_config_path}")
    if not os.path.exists(clip_weights_path):
        raise FileNotFoundError(f"CLIP-ReID weights not found: {clip_weights_path}")
    if not os.path.exists(classifier_weights_path):
        raise FileNotFoundError(f"Pair classifier weights not found: {classifier_weights_path}")

    cfg.merge_from_file(clip_config_path)
    cfg.freeze()

    clip_model = make_model(
        cfg,
        num_class=576,
        camera_num=20,
        view_num=8,
    )

    print("Loading CLIP-ReID weights...")
    clip_model.load_state_dict(
        torch.load(clip_weights_path, map_location=clip_device)
    )
    clip_model.to(clip_device)
    clip_model.eval()
    print("CLIP-ReID model loaded successfully.")

    classifier = PairClassifier(input_dim=1280)

    print("Loading pair classifier...")
    classifier.load_state_dict(
        torch.load(classifier_weights_path, map_location=clip_device)
    )
    classifier.to(clip_device)
    classifier.eval()
    print("Pair classifier loaded successfully.")

except Exception as e:
    # Missing weight files must NOT take down the whole service — congestion
    # detection, ANPR, etc. don't depend on CLIP-ReID / the pair classifier.
    print(f"[Warning] CLIP-ReID / pair classifier not loaded, /find-match will be unavailable: {e}")
    clip_model = None
    classifier = None

# ============================================================
# CLIP IMAGE PREPROCESSING
# ============================================================

clip_transform = transforms.Compose(
    [
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.5, 0.5, 0.5],
            std=[0.5, 0.5, 0.5],
        ),
    ]
)

# ============================================================
# CLIP EMBEDDING EXTRACTION
# ============================================================

def extract_clip_embedding(img_path):

    img = Image.open(img_path).convert("RGB")

    img_t = (
        clip_transform(img)
        .unsqueeze(0)
        .to(clip_device)
    )

    with torch.no_grad():
        feat = clip_model(img_t)

    return feat.cpu().numpy()[0]

def extract_clip_embeddings_batch(img_paths, batch_size=32):
    all_embeddings = []

    for start in range(0, len(img_paths), batch_size):
        batch_paths = img_paths[start:start + batch_size]
        batch_tensors = [
            clip_transform(Image.open(p).convert("RGB"))
            for p in batch_paths
        ]
        batch_t = torch.stack(batch_tensors).to(clip_device)

        with torch.no_grad():
            feats = clip_model(batch_t)

        all_embeddings.append(feats.cpu().numpy())

    return np.concatenate(all_embeddings, axis=0)

# ============================================================
# YOLO VEHICLE DETECTOR
# ============================================================

yolo_weights_path = os.path.join(
    BASE_DIR,
    "yolov8n.pt",
)

if not os.path.exists(yolo_weights_path):
    raise FileNotFoundError(
        f"YOLO weights not found: {yolo_weights_path}"
    )

yolo_model = YOLO(yolo_weights_path)

VEHICLE_CLASSES = [2, 3, 5, 7]

# ============================================================
# ANPR SETTINGS
# ============================================================

CROP_PADDING_RATIO = 0.08
DETECTION_INPUT_MAX_DIM = 640

# ============================================================
# MODULE 3.1 - ANPR IMAGE PLATE DETECTION
# ============================================================

@api_router.post("/plate-detect")
async def plate_detect(
    file: UploadFile = File(...),
    camera_id: str = Form("Camera_1"),
):

    if read_plate is None:
        raise HTTPException(status_code=500, detail="ANPR module not loaded.")

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="Uploaded image is empty.",
        )

    nparr = np.frombuffer(
        contents,
        np.uint8,
    )

    frame = cv2.imdecode(
        nparr,
        cv2.IMREAD_COLOR,
    )

    if frame is None:
        raise HTTPException(
            status_code=400,
            detail="OpenCV could not read the uploaded image.",
        )

    try:

        raw_result = read_plate(frame, camera_id=camera_id, save=True) or {}

        plate_text = raw_result.get(
            "plate_text",
            None,
        )

        confidence = raw_result.get(
            "confidence",
            0.0,
        )

        plate_box = (
            raw_result.get("plate_box")
            or raw_result.get("bbox")
            or None
        )

        plate_type = raw_result.get(
            "plate_type",
            "Standard",
        )

        selected_model = raw_result.get(
            "selected_model",
            "YOLOv8 + EasyOCR",
        )

        return {
            "status": "success",
            "camera_id": camera_id,
            "plate_text": plate_text,
            "confidence": confidence,
            "plate_box": plate_box,
            "bbox": plate_box,
            "plate_type": plate_type,
            "selected_model": selected_model,
            "results": [
                {
                    "plate_text": plate_text,
                    "confidence": confidence,
                    "plate_box": plate_box,
                    "plate_type": plate_type,
                    "selected_model": selected_model,
                }
            ]
            if plate_text
            else [],
        }

    except Exception as e:

        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail={
                "message": "Plate detection failed",
                "error": str(e),
            },
        )

# ============================================================
# MODULE 3.3 - PLATE-BASED VIDEO TRACKING
# ============================================================

@api_router.post("/plate-track")
async def plate_track_upload(
    video: UploadFile = File(...),
    camera_id: str = Form("Camera_1"),
    region: str = Form("US"),
):
    if plate_track is None:
        raise HTTPException(status_code=500, detail="ANPR tracking module not loaded.")

    if not video.filename:
        raise HTTPException(status_code=400, detail="Upload a camera video first")

    suffix = os.path.splitext(video.filename)[1] or ".mp4"
    in_path = os.path.join(
        plate_track.RESULTS_DIR,
        f"{os.urandom(8).hex()}_in{suffix}",
    )

    try:
        contents = await video.read()
        if len(contents) > plate_track.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Video is too large. Use a file under 40 MB.")
        with open(in_path, "wb") as handle:
            handle.write(contents)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=plate_track.disk_error(exc)) from exc

    return {
        "job_id": plate_track.launch_job(
            in_path,
            delete_input=True,
            region=region,
            camera_id=camera_id,        # <-- ONLY CHANGE
        )
    }

# ============================================================
# MODULE 3.3 - SAMPLE VIDEO
# ============================================================

@api_router.post("/plate-track-sample")
async def plate_track_sample(
    camera_id: str = Form("Camera_1"),
    region: str = Form("US"),
):
    if plate_track is None:
        raise HTTPException(status_code=500, detail="ANPR tracking module not loaded.")

    sample = os.path.join(plate_track.ROOT, "sample.mp4")
    if not os.path.exists(sample):
        raise HTTPException(status_code=404, detail="sample.mp4 is missing next to section_3_3.py")

    return {
        "job_id": plate_track.launch_job(
            sample,
            delete_input=False,
            region=region,
            camera_id=camera_id, 
        )
    }

# ============================================================
# MODULE 3.3 - TRACKING STATUS
# ============================================================
# ============================================================
# MODULE 3.3 - TRACKING STATUS
# ============================================================

def _resolve_backend(job_id: str):
    """Returns (region, backend_module) for a job, or raises HTTPException."""
    region = plate_track.get_region_for_job(job_id)
    if region == "NL":
        import section_3_3_nl as backend
        return region, backend
    if region == "US":
        import section_3_3_us as backend
        return region, backend
    raise HTTPException(status_code=404, detail="Unknown job")


@api_router.get("/plate-track-status/{job_id}")
async def plate_track_status(job_id: str):
    if plate_track is None:
        raise HTTPException(status_code=500, detail="ANPR tracking module not loaded.")

    region, backend = _resolve_backend(job_id)

    with backend.jobs_lock:
        job = backend.jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Unknown job")
        done = job["status"] == "done"
        return {
            "status": job["status"],
            "frame": job["frame"],
            "total": job["total"],
            "message": job["message"],
            "plates": job.get("plates") or [],
            "error": job.get("error"),
            "video_url": f"/api/plate-track-result/{job_id}" if done else None,
            "region": region,
        }
# ============================================================
# MODULE 3.3 - TRACKING RESULT
# ============================================================
@api_router.get("/plate-track-result/{job_id}")
async def plate_track_result(job_id: str):
    if plate_track is None:
        raise HTTPException(status_code=500, detail="ANPR tracking module not loaded.")

    region, backend = _resolve_backend(job_id)

    with backend.jobs_lock:
        job = backend.jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Unknown job")
        if job["status"] != "done":
            raise HTTPException(status_code=400, detail="Still processing")
        out_path = job["output"]

    if not os.path.exists(out_path):
        raise HTTPException(status_code=404, detail="Result video missing")

    return FileResponse(out_path, media_type="video/mp4", filename="plate_tracking.mp4")

# ============================================================
# MODULE 3.3 - TRACKING SNAPSHOT IMAGES (car / plate crops)
# ============================================================
@api_router.get("/plate-track-image/{job_id}/{track_id}/{kind}")
async def plate_track_image(job_id: str, track_id: int, kind: str):
    if plate_track is None:
        raise HTTPException(status_code=500, detail="ANPR tracking module not loaded.")
    if kind not in ("car", "plate"):
        raise HTTPException(status_code=400, detail="Invalid image kind")

    region, backend = _resolve_backend(job_id)

    with backend.jobs_lock:
        job = backend.jobs.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Unknown job")
        if job["status"] != "done":
            raise HTTPException(status_code=400, detail="Still processing")

    if not hasattr(backend, "snapshot_image_path"):
        raise HTTPException(status_code=404, detail="Not supported for this region")

    path = backend.snapshot_image_path(job_id, track_id, kind)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Image missing")

    return FileResponse(path, media_type="image/jpeg")

# ============================================================
# MODULE 4 - CONGESTION DETECTION
# ============================================================

@app.post("/detect-congestion")
async def detect_congestion_endpoint(
    video: UploadFile = File(...),
    camera_id: str = Form("CAM_01"),
    hold_time_sec: float = Form(2.0),
):

    filename = (
        video.filename
        or "congestion_video.mp4"
    )

    temp_video_path = os.path.join(
        BASE_DIR,
        f"temp_congestion_{filename}",
    )

    try:

        with open(
            temp_video_path,
            "wb",
        ) as buffer:

            shutil.copyfileobj(
                video.file,
                buffer,
            )

        engine = CongestionEngine(
            model_path=yolo_weights_path,
            node_backend_url=(
                "http://localhost:5000/api/congestion/log"
            ),
            hold_time_sec=hold_time_sec,
            output_dir=ANNOTATED_DIR,  # <-- write annotated video where /video-stream can find it
        )

        result = engine.analyze_video(
            video_path=temp_video_path,
            camera_id=camera_id,
        )

        return {
            "status": "success",
            "result": result,
        }

    except Exception as e:

        traceback.print_exc()

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

    finally:

        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)

# ============================================================
# MODULE 4 - SERVE ANNOTATED CONGESTION VIDEO
# ============================================================

@app.get("/video-stream/{filename}")
async def get_video_stream(filename: str):
    """
    Serves the annotated .mp4 produced by CongestionEngine.analyze_video().
    /detect-congestion returns this URL in its response
    (annotated_video_url: http://localhost:8000/video-stream/{filename}),
    so this route must exist for the congestion module's playback to work.
    """
    # Guard against path traversal via the filename (e.g. "../../etc/passwd")
    safe_name = os.path.basename(filename)
    file_path = os.path.join(ANNOTATED_DIR, safe_name)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Annotated video not found")

    return FileResponse(file_path, media_type="video/mp4")

# ============================================================
# MODULE 4 - LIVE CCTV MJPEG FEED (continuous stream)
# ============================================================

@app.get("/live-traffic-feed/{camera_id}")
async def live_traffic_feed(camera_id: str):
    """
    Continuously loops a source video through CongestionEngine.process_frame()
    and streams it out as MJPEG, for the frontend's "Live CCTV" panel.
    Looks for sample_traffic.mp4 in ml_service/, falling back to the first
    .mp4 found there (skipping temp_ files) if it's missing.
    """
    target_video = os.path.join(BASE_DIR, "sample_traffic.mp4")

    if not os.path.isfile(target_video):
        mp4_files = [
            os.path.join(BASE_DIR, f) for f in os.listdir(BASE_DIR)
            if f.lower().endswith(".mp4") and os.path.isfile(os.path.join(BASE_DIR, f)) and not f.startswith("temp_")
        ]
        if mp4_files:
            target_video = mp4_files[0]
        else:
            raise HTTPException(status_code=404, detail="No source video found for live feed.")

    def generate_frames():
        engine = CongestionEngine(
            model_path=yolo_weights_path,
            node_backend_url="http://localhost:5000/api/congestion/log",
            hold_time_sec=2.0,
        )

        while True:
            cap = cv2.VideoCapture(target_video)
            if not cap.isOpened():
                time.sleep(1.0)
                continue

            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720

            # Road ROI Boundary Polygon
            roi_poly = np.array([
                [int(width * 0.05), height],
                [int(width * 0.20), int(height * 0.15)],
                [int(width * 0.80), int(height * 0.15)],
                [int(width * 0.95), height]
            ], dtype=np.int32)

            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break

                # Let the engine calculate normalized speed, stopped status, and colors
                annotated_frame = engine.process_frame(frame, camera_id=camera_id, roi_poly=roi_poly)

                _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                frame_bytes = buffer.tobytes()

                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

                time.sleep(0.03)

            cap.release()

    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

# ============================================================
# CLIP-ReID - CAMERA ID PARSING
# ============================================================

def parse_camera_id(filename):

    match = re.search(
        r"_c(\d+)_",
        filename,
    )

    return (
        match.group(1)
        if match
        else None
    )
def parse_vehicle_id(filename):
    match = re.match(r"^(\d+)_c\d+_", filename)
    return match.group(1) if match else None

# ============================================================
# CLIP-ReID - FIND MATCH
# ============================================================

@app.post("/find-match")
async def find_match(
    file: UploadFile = File(...),
    exclude_same_camera: bool = Form(True),
):

    if clip_model is None or classifier is None:
        raise HTTPException(
            status_code=503,
            detail="CLIP-ReID model or pair classifier not loaded (missing weight files).",
        )

    filename = file.filename or "query_image.jpg"
    start_time = time.time()
    start_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[MATCH START] {start_dt} — query: {filename}")
    suffix = os.path.splitext(filename)[1] or ".jpg"
    temp_fd, path = tempfile.mkstemp(suffix=suffix)

    try:
        with os.fdopen(temp_fd, "wb") as b:
            shutil.copyfileobj(file.file, b)

        if not os.path.exists(GALLERY_DIR):
            raise HTTPException(status_code=503, detail="Test image folder not found.")

        test_filenames = [
            f for f in os.listdir(GALLERY_DIR)
            if f.lower().endswith((".jpg", ".jpeg", ".png"))
        ]

        if not test_filenames:
            raise HTTPException(status_code=404, detail="No images found in test folder.")

        query_emb = extract_clip_embedding(path)
        HALF = len(query_emb) // 2
        query_cam = parse_camera_id(filename)

        seen_vehicle_cam = set()
        selected_filenames = []
        cams = []

        for name in sorted(test_filenames):
            gal_cam = parse_camera_id(name)

            if gal_cam is None:
                continue

            if (
                exclude_same_camera
                and query_cam is not None
                and gal_cam == query_cam
            ):
                continue

            vehicle_id = parse_vehicle_id(name)
            dedup_key = (vehicle_id, gal_cam)

            if dedup_key in seen_vehicle_cam:
                continue  # skip repeat frames of the same vehicle from the same camera

            seen_vehicle_cam.add(dedup_key)

            selected_filenames.append(name)
            cams.append(int(gal_cam))
        if not selected_filenames:
            raise HTTPException(status_code=404, detail="No test images to search.")

        test_paths = [os.path.join(GALLERY_DIR, n) for n in selected_filenames]
        test_embeddings = extract_clip_embeddings_batch(test_paths, batch_size=32)

        q_half = np.tile(query_emb[:HALF], (len(selected_filenames), 1))
        g_half = test_embeddings[:, HALF:]

        diff = np.abs(q_half - g_half)
        prod = q_half * g_half

        combined = np.concatenate(
            [q_half, g_half, diff, prod],
            axis=1,
        ).astype(np.float32)
        
        probs = []

        with torch.no_grad():
            for start in range(0, len(combined), 1024):
                batch = torch.from_numpy(combined[start:start + 1024]).to(clip_device)
                p = torch.sigmoid(classifier(batch)).view(-1)
                probs.append(p.cpu().numpy())

        probs = np.concatenate(probs)

        best = {}

        for name, cam, prob in zip(selected_filenames, cams, probs):
            prob = float(prob)
            if cam not in best or prob > best[cam][0]:
                best[cam] = (prob, name)

        matches = [
            {
                "camera": cam,
                "matched_filename": fname,
                "confidence": round(score, 4),
                "confidencePercentage": f"{round(score * 100, 2)}%",
            }
            for cam, (score, fname) in best.items()
        ]

        matches.sort(key=lambda m: m["confidence"], reverse=True)
        
        end_time = time.time()
        end_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        elapsed = round(end_time - start_time, 2)
        print(f"[MATCH END]   {end_dt} — query: {filename} — took {elapsed}s — {len(matches)} matches")

        # Log this match result for the dashboard
        append_match_log(
            query_filename=filename,
            query_camera=int(query_cam) if query_cam else None,
            matches=matches,
        )
        
        return {
            "status": "success",
            "query_camera": int(query_cam) if query_cam else None,
            "matches": matches,
        }

    finally:
        if os.path.exists(path):
            os.remove(path)

# ============================================================
# DASHBOARD LOG ENDPOINT
# ============================================================
@app.post("/dashboard-log")
async def dashboard_log(payload: dict):
    try:
        query_filename = payload.get("query_filename", "unknown.jpg")
        query_camera = payload.get("query_camera")
        matches = payload.get("matches", [])

        append_match_log(
            query_filename=query_filename,
            query_camera=query_camera,
            matches=matches,
        )

        return {
            "status": "success",
            "message": "Dashboard log updated",
        }

    except Exception as e:
        print("Dashboard logging error:", e)

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )
    
# ============================================================
# DASHBOARD STATS ENDPOINT
# ============================================================

@app.get("/dashboard-stats")
async def dashboard_stats():
    logs = read_match_log()

    # ========================================================
    # RUNTIME ACTIVE CAMERAS
    # ========================================================
    # Do NOT assume VeRi has 20 active cameras.
    # Count only cameras that actually appear in runtime logs.

    active_camera_ids = set()

    # ========================================================
    # TOTAL VEHICLES DETECTED
    # ========================================================
    # One dashboard-log entry represents one runtime vehicle
    # detection / Re-ID request.

    vehicles_detected = len(logs)

    # ========================================================
    # RE-ID CONFIDENCE COUNTS
    # ========================================================

    high_conf = 0
    possible_conf = 0
    unlikely_conf = 0

    # ========================================================
    # PER-CAMERA DETECTION COUNTS
    # ========================================================

    camera_counts = {}

    # ========================================================
    # RECENT VEHICLE SIGHTINGS
    # ========================================================

    recent_sightings = []

    # ========================================================
    # PROCESS LOGS
    # ========================================================

    for entry in reversed(logs):

        # ----------------------------------------------------
        # QUERY CAMERA
        # ----------------------------------------------------

        query_cam = entry.get("query_camera")

        if query_cam is not None:
            camera_key = str(query_cam)

            active_camera_ids.add(camera_key)

            camera_counts[camera_key] = (
                camera_counts.get(camera_key, 0) + 1
            )

        # ----------------------------------------------------
        # TOP RE-ID MATCH
        # ----------------------------------------------------

        matches = entry.get("matches", [])

        top_match = matches[0] if matches else None

        if not top_match:
            continue

        # ----------------------------------------------------
        # MATCH CAMERA
        # ----------------------------------------------------

        match_camera = top_match.get("camera")

        if match_camera is not None:
            active_camera_ids.add(str(match_camera))

        # ----------------------------------------------------
        # CONFIDENCE
        # ----------------------------------------------------

        conf = top_match.get("confidence", 0)

        try:
            conf = float(conf)
        except (TypeError, ValueError):
            conf = 0.0

        if conf >= 0.85:
            high_conf += 1

        elif conf >= 0.50:
            possible_conf += 1

        else:
            unlikely_conf += 1

        # ----------------------------------------------------
        # VEHICLE METADATA
        # ----------------------------------------------------

        matched_filename = top_match.get(
            "matched_filename",
            ""
        )

        label_info = VERI_LABELS.get(
            matched_filename,
            {}
        )

        vehicle_id = label_info.get(
            "vehicle_id",
            "Unknown"
        )

        vehicle_type = label_info.get(
            "type",
            "Unknown"
        )

        vehicle_color = label_info.get(
            "color",
            "Unknown"
        )

        # ----------------------------------------------------
        # RECENT SIGHTINGS
        # ----------------------------------------------------

        if len(recent_sightings) < 10:

            recent_sightings.append({
                "vehicle_id": vehicle_id,

                "camera": (
                    f"CAM-{match_camera}"
                    if match_camera is not None
                    else "Unknown"
                ),

                "type": vehicle_type,

                "color": vehicle_color,

                "plate": "Pending ANPR",

                "timestamp": entry.get(
                    "timestamp",
                    ""
                ),

                "confidence": top_match.get(
                    "confidencePercentage",
                    f"{round(conf * 100, 1)}%"
                ),

                "confidence_raw": conf,

                "matched_filename": matched_filename,
            })

    # ========================================================
    # TOTAL RE-ID RESULTS
    # ========================================================

    total_reid = (
        high_conf
        + possible_conf
        + unlikely_conf
    )

    # ========================================================
    # CONFIDENCE PERCENTAGE
    # ========================================================

    def pct(count):

        if total_reid == 0:
            return 0

        return round(
            (count / total_reid) * 100,
            1
        )

    # ========================================================
    # SORT CAMERAS NUMERICALLY
    # ========================================================

    detections_per_camera = dict(
        sorted(
            camera_counts.items(),
            key=lambda item: int(item[0])
            if item[0].isdigit()
            else item[0]
        )
    )

    # ========================================================
    # RESPONSE
    # ========================================================

    return {

        "status": "success",

        "stats": {

            # Runtime value.
            "active_cameras": len(
                active_camera_ids
            ),

            "vehicles_detected": (
                vehicles_detected
            ),

            "vehicles_reid": (
                total_reid
            ),

            # Alerts are not implemented yet.
            "active_alerts": 0,
        },

        # ====================================================
        # RE-ID CONFIDENCE DISTRIBUTION
        # ====================================================

        "reid_confidence": [

            {
                "name": "High Confidence",
                "value": pct(high_conf),
                "count": high_conf,
                "color": "#0c4d9e",
            },

            {
                "name": "Possible Match",
                "value": pct(possible_conf),
                "count": possible_conf,
                "color": "#4d83be",
            },

            {
                "name": "Unlikely",
                "value": pct(unlikely_conf),
                "count": unlikely_conf,
                "color": "#3a7698",
            },
        ],

        # ====================================================
        # VEHICLE DETECTIONS PER CAMERA
        # ====================================================

        "detections_per_camera": (
            detections_per_camera
        ),

        # ====================================================
        # RECENT VEHICLE SIGHTINGS
        # ====================================================

        "recent_sightings": (
            recent_sightings
        ),
    }
# ============================================================
# INCLUDE API ROUTER
# ============================================================

app.include_router(api_router)

# ============================================================
# START SERVER
# ============================================================

if __name__ == "__main__":

    import uvicorn

    port = int(
        os.environ.get(
            "ML_PORT",
            "8000",
        )
    )

    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
    )



# import os
# import sys
# import cv2
# import re
# import shutil
# import tempfile
# import traceback
# import numpy as np
# import torch
# import time
# from datetime import datetime
# import json
# import xml.etree.ElementTree as ET
# from threading import Lock

# from fastapi import (
#     FastAPI,
#     APIRouter,
#     UploadFile,
#     File,
#     Form,
#     HTTPException,
# )
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import FileResponse, StreamingResponse
# from fastapi.staticfiles import StaticFiles

# from ultralytics import YOLO
# from torchvision import transforms
# from PIL import Image


# # ============================================================
# # BASE DIRECTORY
# # ============================================================

# BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# GALLERY_DIR = r"C:\Users\tayya\Documents\FYP\archive (1)\VeRi\image_test"
# # ============================================================
# # VERI LABEL MAPS (color/type codes -> real names)
# # ============================================================

# COLOR_MAP = {
#     1: "Yellow", 2: "Orange", 3: "Green", 4: "Gray", 5: "Red",
#     6: "Blue", 7: "White", 8: "Golden", 9: "Brown", 10: "Black",
# }

# TYPE_MAP = {
#     1: "Sedan", 2: "SUV", 3: "Van", 4: "Hatchback", 5: "MPV",
#     6: "Pickup", 7: "Bus", 8: "Truck", 9: "Estate",
# }


# def load_veri_labels(xml_path):
#     """Parses test_label.xml into {filename: {vehicle_id, camera_id, color, type}}"""
#     with open(xml_path, "r", encoding="utf-8") as f:
#         xml_data = f.read()

#     tree = ET.ElementTree(ET.fromstring(xml_data))
#     root = tree.getroot()

#     labels = {}

#     for item in root.iter("Item"):
#         image_name = item.get("imageName")
#         vehicle_id = item.get("vehicleID")
#         camera_id = item.get("cameraID")
#         color_id = item.get("colorID")
#         type_id = item.get("typeID")

#         labels[image_name] = {
#             "vehicle_id": vehicle_id,
#             "camera_id": camera_id,
#             "color": COLOR_MAP.get(int(color_id), "Unknown") if color_id else "Unknown",
#             "type": TYPE_MAP.get(int(type_id), "Unknown") if type_id else "Unknown",
#         }

#     return labels


# # Load labels once at startup
# VERI_LABEL_PATH = os.path.join(GALLERY_DIR, "test_label.xml")
# # Note: GALLERY_DIR points to image_test folder; test_label.xml sits one level up
# # alongside it. Adjust path if needed:
# VERI_LABEL_PATH = os.path.join(os.path.dirname(GALLERY_DIR), "test_label.xml")

# VERI_LABELS = {}

# if os.path.exists(VERI_LABEL_PATH):
#     print(f"Loading VeRi labels from: {VERI_LABEL_PATH}")
#     VERI_LABELS = load_veri_labels(VERI_LABEL_PATH)
#     print(f"Loaded {len(VERI_LABELS)} vehicle labels.")
# else:
#     print(f"WARNING: test_label.xml not found at {VERI_LABEL_PATH}")

# # ============================================================
# # MATCH LOG (for dashboard stats)
# # ============================================================

# MATCH_LOG_PATH = os.path.join(BASE_DIR, "match_log.json")
# match_log_lock = Lock()


# def append_match_log(query_filename, query_camera, matches):
#     """Appends one /find-match result to match_log.json"""
#     entry = {
#         "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
#         "query_filename": query_filename,
#         "query_camera": query_camera,
#         "matches": matches,  # list of {camera, matched_filename, confidence, confidencePercentage}
#     }

#     with match_log_lock:
#         logs = []
#         if os.path.exists(MATCH_LOG_PATH):
#             try:
#                 with open(MATCH_LOG_PATH, "r") as f:
#                     logs = json.load(f)
#             except (json.JSONDecodeError, FileNotFoundError):
#                 logs = []

#         logs.append(entry)

#         # Keep only the last 500 entries so the file doesn't grow forever
#         logs = logs[-500:]

#         with open(MATCH_LOG_PATH, "w") as f:
#             json.dump(logs, f, indent=2)


# def read_match_log():
#     """Reads all logged match results"""
#     if not os.path.exists(MATCH_LOG_PATH):
#         return []
#     with match_log_lock:
#         try:
#             with open(MATCH_LOG_PATH, "r") as f:
#                 return json.load(f)
#         except (json.JSONDecodeError, FileNotFoundError):
#             return []

# # ============================================================
# # ANPR
# # ============================================================

# sys.path.insert(0, BASE_DIR)

# try:
#     from anpr import read_plate
#     import section_3_3 as plate_track
# except ImportError as e:
#     # Missing anpr.py / section_3_3.py must NOT take down the whole service
#     # (congestion detection, ReID, etc. don't depend on ANPR at all).
#     print(f"[Warning] ANPR module import skipped: {e}")
#     read_plate = None
#     plate_track = None


# # ============================================================
# # CONGESTION DETECTION
# # ============================================================

# from congestion_engine import CongestionEngine


# # ============================================================
# # CLIP-ReID
# # ============================================================

# CLIP_REID_DIR = os.path.join(BASE_DIR, "clip_reid")

# if CLIP_REID_DIR not in sys.path:
#     sys.path.insert(0, CLIP_REID_DIR)

# from model.make_model import make_model
# from config import cfg_base as cfg
# from pair_classifier import PairClassifier


# # ============================================================
# # DEVICE
# # ============================================================

# device_type = "cuda" if torch.cuda.is_available() else "cpu"
# clip_device = device_type

# print(f"Using device: {clip_device}")


# # ============================================================
# # FASTAPI
# # ============================================================

# app = FastAPI(
#     title="Smart City Surveillance - CLIP-ReID, ANPR & Congestion Engine"
# )

# api_router = APIRouter(prefix="/api")


# # ============================================================
# # CORS
# # ============================================================

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )


# # ============================================================
# # STATIC DIRECTORIES
# # ============================================================

# STATIC_DIR = os.path.join(BASE_DIR, "static")
# MATCHES_DIR = os.path.join(STATIC_DIR, "matches")
# DEBUG_DIR = os.path.join(STATIC_DIR, "debug")
# ANNOTATED_DIR = os.path.join(STATIC_DIR, "annotated")  # <-- congestion module writes here

# os.makedirs(STATIC_DIR, exist_ok=True)
# os.makedirs(MATCHES_DIR, exist_ok=True)
# os.makedirs(DEBUG_DIR, exist_ok=True)
# os.makedirs(ANNOTATED_DIR, exist_ok=True)

# app.mount(
#     "/static",
#     StaticFiles(directory=STATIC_DIR),
#     name="static",
# )


# # ============================================================
# # VEHICLE GALLERY
# # ============================================================

# GALLERY_DIR = (
#     r"C:\Users\tayya\Documents\FYP\archive (1)\VeRi\image_test"
# )

# if os.path.exists(GALLERY_DIR):
#     app.mount(
#         "/gallery",
#         StaticFiles(directory=GALLERY_DIR),
#         name="gallery",
#     )
# else:
#     print(f"WARNING: Gallery directory not found: {GALLERY_DIR}")


# # ============================================================
# # LOAD CLIP-ReID MODEL (optional — congestion detection doesn't need this)
# # ============================================================

# clip_model = None
# classifier = None

# clip_config_path = os.path.join(
#     CLIP_REID_DIR,
#     "configs",
#     "veri",
#     "vit_base.yml",
# )

# clip_weights_path = os.path.join(
#     BASE_DIR,
#     "weights",
#     "ViT-B-16_60.pth",
# )

# classifier_weights_path = os.path.join(
#     BASE_DIR,
#     "weights",
#     "pair_classifier_full.pth",
# )

# try:
#     if not os.path.exists(clip_config_path):
#         raise FileNotFoundError(f"CLIP-ReID config not found: {clip_config_path}")
#     if not os.path.exists(clip_weights_path):
#         raise FileNotFoundError(f"CLIP-ReID weights not found: {clip_weights_path}")
#     if not os.path.exists(classifier_weights_path):
#         raise FileNotFoundError(f"Pair classifier weights not found: {classifier_weights_path}")

#     cfg.merge_from_file(clip_config_path)
#     cfg.freeze()

#     clip_model = make_model(
#         cfg,
#         num_class=576,
#         camera_num=20,
#         view_num=8,
#     )

#     print("Loading CLIP-ReID weights...")
#     clip_model.load_state_dict(
#         torch.load(clip_weights_path, map_location=clip_device)
#     )
#     clip_model.to(clip_device)
#     clip_model.eval()
#     print("CLIP-ReID model loaded successfully.")

#     classifier = PairClassifier(input_dim=1280)

#     print("Loading pair classifier...")
#     classifier.load_state_dict(
#         torch.load(classifier_weights_path, map_location=clip_device)
#     )
#     classifier.to(clip_device)
#     classifier.eval()
#     print("Pair classifier loaded successfully.")

# except Exception as e:
#     # Missing weight files must NOT take down the whole service — congestion
#     # detection, ANPR, etc. don't depend on CLIP-ReID / the pair classifier.
#     print(f"[Warning] CLIP-ReID / pair classifier not loaded, /find-match will be unavailable: {e}")
#     clip_model = None
#     classifier = None


# # ============================================================
# # CLIP IMAGE PREPROCESSING
# # ============================================================

# clip_transform = transforms.Compose(
#     [
#         transforms.Resize((256, 256)),
#         transforms.ToTensor(),
#         transforms.Normalize(
#             mean=[0.5, 0.5, 0.5],
#             std=[0.5, 0.5, 0.5],
#         ),
#     ]
# )


# # ============================================================
# # CLIP EMBEDDING EXTRACTION
# # ============================================================

# def extract_clip_embedding(img_path):

#     img = Image.open(img_path).convert("RGB")

#     img_t = (
#         clip_transform(img)
#         .unsqueeze(0)
#         .to(clip_device)
#     )

#     with torch.no_grad():
#         feat = clip_model(img_t)

#     return feat.cpu().numpy()[0]

# def extract_clip_embeddings_batch(img_paths, batch_size=32):
#     all_embeddings = []

#     for start in range(0, len(img_paths), batch_size):
#         batch_paths = img_paths[start:start + batch_size]
#         batch_tensors = [
#             clip_transform(Image.open(p).convert("RGB"))
#             for p in batch_paths
#         ]
#         batch_t = torch.stack(batch_tensors).to(clip_device)

#         with torch.no_grad():
#             feats = clip_model(batch_t)

#         all_embeddings.append(feats.cpu().numpy())

#     return np.concatenate(all_embeddings, axis=0)

# # ============================================================
# # YOLO VEHICLE DETECTOR
# # ============================================================

# yolo_weights_path = os.path.join(
#     BASE_DIR,
#     "yolov8n.pt",
# )

# if not os.path.exists(yolo_weights_path):
#     raise FileNotFoundError(
#         f"YOLO weights not found: {yolo_weights_path}"
#     )

# yolo_model = YOLO(yolo_weights_path)

# VEHICLE_CLASSES = [2, 3, 5, 7]


# # ============================================================
# # ANPR SETTINGS
# # ============================================================

# CROP_PADDING_RATIO = 0.08
# DETECTION_INPUT_MAX_DIM = 640


# # ============================================================
# # MODULE 3.1 - ANPR IMAGE PLATE DETECTION
# # ============================================================

# @api_router.post("/plate-detect")
# async def plate_detect(
#     file: UploadFile = File(...),
#     camera_id: str = Form("Camera_1"),
# ):

#     if read_plate is None:
#         raise HTTPException(status_code=500, detail="ANPR module not loaded.")

#     contents = await file.read()

#     if not contents:
#         raise HTTPException(
#             status_code=400,
#             detail="Uploaded image is empty.",
#         )

#     nparr = np.frombuffer(
#         contents,
#         np.uint8,
#     )

#     frame = cv2.imdecode(
#         nparr,
#         cv2.IMREAD_COLOR,
#     )

#     if frame is None:
#         raise HTTPException(
#             status_code=400,
#             detail="OpenCV could not read the uploaded image.",
#         )

#     try:

#         raw_result = read_plate(frame) or {}

#         plate_text = raw_result.get(
#             "plate_text",
#             None,
#         )

#         confidence = raw_result.get(
#             "confidence",
#             0.0,
#         )

#         plate_box = (
#             raw_result.get("plate_box")
#             or raw_result.get("bbox")
#             or None
#         )

#         plate_type = raw_result.get(
#             "plate_type",
#             "Standard",
#         )

#         selected_model = raw_result.get(
#             "selected_model",
#             "YOLOv8 + EasyOCR",
#         )

#         return {
#             "status": "success",
#             "camera_id": camera_id,
#             "plate_text": plate_text,
#             "confidence": confidence,
#             "plate_box": plate_box,
#             "bbox": plate_box,
#             "plate_type": plate_type,
#             "selected_model": selected_model,
#             "results": [
#                 {
#                     "plate_text": plate_text,
#                     "confidence": confidence,
#                     "plate_box": plate_box,
#                     "plate_type": plate_type,
#                     "selected_model": selected_model,
#                 }
#             ]
#             if plate_text
#             else [],
#         }

#     except Exception as e:

#         traceback.print_exc()

#         raise HTTPException(
#             status_code=500,
#             detail={
#                 "message": "Plate detection failed",
#                 "error": str(e),
#             },
#         )


# # ============================================================
# # MODULE 3.3 - PLATE-BASED VIDEO TRACKING
# # ============================================================

# @api_router.post("/plate-track")
# async def plate_track_upload(
#     video: UploadFile = File(...),
# ):

#     if plate_track is None:
#         raise HTTPException(status_code=500, detail="ANPR tracking module not loaded.")

#     if not video.filename:
#         raise HTTPException(
#             status_code=400,
#             detail="Upload a camera video first",
#         )

#     suffix = (
#         os.path.splitext(video.filename)[1]
#         or ".mp4"
#     )

#     in_path = os.path.join(
#         plate_track.RESULTS_DIR,
#         f"{os.urandom(8).hex()}_in{suffix}",
#     )

#     try:

#         contents = await video.read()

#         if len(contents) > plate_track.MAX_UPLOAD_BYTES:

#             raise HTTPException(
#                 status_code=413,
#                 detail="Video is too large. Use a file under 40 MB.",
#             )

#         with open(in_path, "wb") as handle:
#             handle.write(contents)

#     except OSError as exc:

#         raise HTTPException(
#             status_code=500,
#             detail=plate_track.disk_error(exc),
#         ) from exc

#     return {
#         "job_id": plate_track.launch_job(
#             in_path,
#             delete_input=True,
#         )
#     }


# # ============================================================
# # MODULE 3.3 - SAMPLE VIDEO
# # ============================================================

# @api_router.post("/plate-track-sample")
# async def plate_track_sample():

#     if plate_track is None:
#         raise HTTPException(status_code=500, detail="ANPR tracking module not loaded.")

#     sample = os.path.join(
#         plate_track.ROOT,
#         "sample.mp4",
#     )

#     if not os.path.exists(sample):

#         raise HTTPException(
#             status_code=404,
#             detail="sample.mp4 is missing next to section_3_3.py",
#         )

#     return {
#         "job_id": plate_track.launch_job(
#             sample,
#             delete_input=False,
#         )
#     }


# # ============================================================
# # MODULE 3.3 - TRACKING STATUS
# # ============================================================

# @api_router.get("/plate-track-status/{job_id}")
# async def plate_track_status(
#     job_id: str,
# ):

#     if plate_track is None:
#         raise HTTPException(status_code=500, detail="ANPR tracking module not loaded.")

#     with plate_track.jobs_lock:

#         job = plate_track.jobs.get(job_id)

#         if not job:
#             raise HTTPException(
#                 status_code=404,
#                 detail="Unknown job",
#             )

#         done = job["status"] == "done"

#         return {
#             "status": job["status"],
#             "frame": job["frame"],
#             "total": job["total"],
#             "message": job["message"],
#             "plates": job.get("plates") or [],
#             "error": job.get("error"),
#             "video_url": (
#                 f"/api/plate-track-result/{job_id}"
#                 if done
#                 else None
#             ),
#         }


# # ============================================================
# # MODULE 3.3 - TRACKING RESULT
# # ============================================================

# @api_router.get("/plate-track-result/{job_id}")
# async def plate_track_result(
#     job_id: str,
# ):

#     if plate_track is None:
#         raise HTTPException(status_code=500, detail="ANPR tracking module not loaded.")

#     with plate_track.jobs_lock:

#         job = plate_track.jobs.get(job_id)

#         if not job:
#             raise HTTPException(
#                 status_code=404,
#                 detail="Unknown job",
#             )

#         if job["status"] != "done":
#             raise HTTPException(
#                 status_code=400,
#                 detail="Still processing",
#             )

#         out_path = job["output"]

#     if not os.path.exists(out_path):

#         raise HTTPException(
#             status_code=404,
#             detail="Result video missing",
#         )

#     return FileResponse(
#         out_path,
#         media_type="video/mp4",
#         filename="plate_tracking.mp4",
#     )


# # ============================================================
# # MODULE 3.3 - TRACKING SNAPSHOT IMAGES (car / plate crops)
# # ============================================================

# @api_router.get("/plate-track-image/{job_id}/{track_id}/{kind}")
# async def plate_track_image(job_id: str, track_id: int, kind: str):

#     if plate_track is None:
#         raise HTTPException(status_code=500, detail="ANPR tracking module not loaded.")

#     if kind not in ("car", "plate"):
#         raise HTTPException(status_code=400, detail="Invalid image kind")

#     with plate_track.jobs_lock:
#         job = plate_track.jobs.get(job_id)
#         if not job:
#             raise HTTPException(status_code=404, detail="Unknown job")
#         if job["status"] != "done":
#             raise HTTPException(status_code=400, detail="Still processing")

#     path = plate_track.snapshot_image_path(job_id, track_id, kind)

#     if not os.path.isfile(path):
#         raise HTTPException(status_code=404, detail="Image missing")

#     return FileResponse(path, media_type="image/jpeg")


# # ============================================================
# # MODULE 4 - CONGESTION DETECTION
# # ============================================================

# @app.post("/detect-congestion")
# def detect_congestion_endpoint(
#     # Plain "def" (not async): FastAPI runs it in a worker thread, so a long
#     # video analysis no longer freezes the whole server (dashboard, ReID, ...).
#     video: UploadFile = File(...),
#     camera_id: str = Form("CAM_01"),
#     hold_time_sec: float = Form(2.0),
# ):

#     filename = (
#         video.filename
#         or "congestion_video.mp4"
#     )

#     temp_video_path = os.path.join(
#         BASE_DIR,
#         f"temp_congestion_{filename}",
#     )

#     try:

#         with open(
#             temp_video_path,
#             "wb",
#         ) as buffer:

#             shutil.copyfileobj(
#                 video.file,
#                 buffer,
#             )

#         engine = CongestionEngine(
#             model_path=yolo_weights_path,
#             node_backend_url=(
#                 "http://localhost:5000/api/congestion/log"
#             ),
#             hold_time_sec=hold_time_sec,
#             output_dir=ANNOTATED_DIR,  # <-- write annotated video where /video-stream can find it
#         )

#         result = engine.analyze_video(
#             video_path=temp_video_path,
#             camera_id=camera_id,
#         )

#         return {
#             "status": "success",
#             "result": result,
#         }

#     except Exception as e:

#         traceback.print_exc()

#         raise HTTPException(
#             status_code=500,
#             detail=str(e),
#         )

#     finally:

#         if os.path.exists(temp_video_path):
#             os.remove(temp_video_path)


# # ============================================================
# # MODULE 4 - SERVE ANNOTATED CONGESTION VIDEO
# # ============================================================

# @app.get("/video-stream/{filename}")
# async def get_video_stream(filename: str):
#     """
#     Serves the annotated .mp4 produced by CongestionEngine.analyze_video().
#     /detect-congestion returns this URL in its response
#     (annotated_video_url: http://localhost:8000/video-stream/{filename}),
#     so this route must exist for the congestion module's playback to work.
#     """
#     # Guard against path traversal via the filename (e.g. "../../etc/passwd")
#     safe_name = os.path.basename(filename)
#     file_path = os.path.join(ANNOTATED_DIR, safe_name)

#     if not os.path.exists(file_path):
#         raise HTTPException(status_code=404, detail="Annotated video not found")

#     return FileResponse(file_path, media_type="video/mp4")


# # ============================================================
# # MODULE 4 - LIVE CCTV MJPEG FEED (continuous stream)
# # ============================================================

# @app.get("/live-traffic-feed/{camera_id}")
# async def live_traffic_feed(camera_id: str):
#     """
#     Continuously loops a source video through CongestionEngine.process_frame()
#     and streams it out as MJPEG, for the frontend's "Live CCTV" panel.
#     Looks for sample_traffic.mp4 in ml_service/, falling back to the first
#     .mp4 found there (skipping temp_ files) if it's missing.
#     """
#     target_video = os.path.join(BASE_DIR, "sample_traffic.mp4")

#     if not os.path.isfile(target_video):
#         mp4_files = [
#             os.path.join(BASE_DIR, f) for f in os.listdir(BASE_DIR)
#             if f.lower().endswith(".mp4") and os.path.isfile(os.path.join(BASE_DIR, f)) and not f.startswith("temp_")
#         ]
#         if mp4_files:
#             target_video = mp4_files[0]
#         else:
#             raise HTTPException(status_code=404, detail="No source video found for live feed.")

#     def generate_frames():
#         engine = CongestionEngine(
#             model_path=yolo_weights_path,
#             node_backend_url="http://localhost:5000/api/congestion/log",
#             hold_time_sec=2.0,
#         )

#         while True:
#             cap = cv2.VideoCapture(target_video)
#             if not cap.isOpened():
#                 time.sleep(1.0)
#                 continue

#             while cap.isOpened():
#                 ret, frame = cap.read()
#                 if not ret:
#                     break

#                 # No roi_poly passed: the engine learns the road region automatically
#                 # from the first few seconds of vehicle detections, then keeps it.
#                 annotated_frame = engine.process_frame(frame, camera_id=camera_id)

#                 _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
#                 frame_bytes = buffer.tobytes()

#                 yield (b'--frame\r\n'
#                        b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

#                 time.sleep(0.03)

#             cap.release()

#     return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")


# # ============================================================
# # CLIP-ReID - CAMERA ID PARSING
# # ============================================================

# def parse_camera_id(filename):

#     match = re.search(
#         r"_c(\d+)_",
#         filename,
#     )

#     return (
#         match.group(1)
#         if match
#         else None
#     )
# def parse_vehicle_id(filename):
#     match = re.match(r"^(\d+)_c\d+_", filename)
#     return match.group(1) if match else None

# # ============================================================
# # CLIP-ReID - FIND MATCH
# # ============================================================

# @app.post("/find-match")
# async def find_match(
#     file: UploadFile = File(...),
#     exclude_same_camera: bool = Form(True),
# ):

#     if clip_model is None or classifier is None:
#         raise HTTPException(
#             status_code=503,
#             detail="CLIP-ReID model or pair classifier not loaded (missing weight files).",
#         )

#     filename = file.filename or "query_image.jpg"
#     start_time = time.time()
#     start_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
#     print(f"[MATCH START] {start_dt} — query: {filename}")
#     suffix = os.path.splitext(filename)[1] or ".jpg"
#     temp_fd, path = tempfile.mkstemp(suffix=suffix)

#     try:
#         with os.fdopen(temp_fd, "wb") as b:
#             shutil.copyfileobj(file.file, b)

#         if not os.path.exists(GALLERY_DIR):
#             raise HTTPException(status_code=503, detail="Test image folder not found.")

#         test_filenames = [
#             f for f in os.listdir(GALLERY_DIR)
#             if f.lower().endswith((".jpg", ".jpeg", ".png"))
#         ]

#         if not test_filenames:
#             raise HTTPException(status_code=404, detail="No images found in test folder.")

#         query_emb = extract_clip_embedding(path)
#         HALF = len(query_emb) // 2
#         query_cam = parse_camera_id(filename)

#         seen_vehicle_cam = set()
#         selected_filenames = []
#         cams = []

#         for name in sorted(test_filenames):
#             gal_cam = parse_camera_id(name)

#             if gal_cam is None:
#                 continue

#             if (
#                 exclude_same_camera
#                 and query_cam is not None
#                 and gal_cam == query_cam
#             ):
#                 continue

#             vehicle_id = parse_vehicle_id(name)
#             dedup_key = (vehicle_id, gal_cam)

#             if dedup_key in seen_vehicle_cam:
#                 continue  # skip repeat frames of the same vehicle from the same camera

#             seen_vehicle_cam.add(dedup_key)

#             selected_filenames.append(name)
#             cams.append(int(gal_cam))
#         if not selected_filenames:
#             raise HTTPException(status_code=404, detail="No test images to search.")

#         test_paths = [os.path.join(GALLERY_DIR, n) for n in selected_filenames]
#         test_embeddings = extract_clip_embeddings_batch(test_paths, batch_size=32)

#         q_half = np.tile(query_emb[:HALF], (len(selected_filenames), 1))

#         combined = np.concatenate(
#             [q_half, test_embeddings[:, HALF:]],
#             axis=1,
#         ).astype(np.float32)

#         probs = []

#         with torch.no_grad():
#             for start in range(0, len(combined), 1024):
#                 batch = torch.from_numpy(combined[start:start + 1024]).to(clip_device)
#                 p = torch.sigmoid(classifier(batch)).view(-1)
#                 probs.append(p.cpu().numpy())

#         probs = np.concatenate(probs)

#         best = {}

#         for name, cam, prob in zip(selected_filenames, cams, probs):
#             prob = float(prob)
#             if cam not in best or prob > best[cam][0]:
#                 best[cam] = (prob, name)

#         matches = [
#             {
#                 "camera": cam,
#                 "matched_filename": fname,
#                 "confidence": round(score, 4),
#                 "confidencePercentage": f"{round(score * 100, 2)}%",
#             }
#             for cam, (score, fname) in best.items()
#         ]

#         matches.sort(key=lambda m: m["confidence"], reverse=True)
        
#         end_time = time.time()
#         end_dt = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
#         elapsed = round(end_time - start_time, 2)
#         print(f"[MATCH END]   {end_dt} — query: {filename} — took {elapsed}s — {len(matches)} matches")

#         # Log this match result for the dashboard
#         append_match_log(
#             query_filename=filename,
#             query_camera=int(query_cam) if query_cam else None,
#             matches=matches,
#         )
        
#         return {
#             "status": "success",
#             "query_camera": int(query_cam) if query_cam else None,
#             "matches": matches,
#         }

#     finally:
#         if os.path.exists(path):
#             os.remove(path)

# # ============================================================
# # DASHBOARD LOG ENDPOINT
# # ============================================================
# @app.post("/dashboard-log")
# async def dashboard_log(payload: dict):
#     try:
#         query_filename = payload.get("query_filename", "unknown.jpg")
#         query_camera = payload.get("query_camera")
#         matches = payload.get("matches", [])

#         append_match_log(
#             query_filename=query_filename,
#             query_camera=query_camera,
#             matches=matches,
#         )

#         return {
#             "status": "success",
#             "message": "Dashboard log updated",
#         }

#     except Exception as e:
#         print("Dashboard logging error:", e)

#         raise HTTPException(
#             status_code=500,
#             detail=str(e),
#         )
    
# # ============================================================
# # DASHBOARD STATS ENDPOINT
# # ============================================================

# @app.get("/dashboard-stats")
# async def dashboard_stats():
#     logs = read_match_log()

#     # ========================================================
#     # RUNTIME ACTIVE CAMERAS
#     # ========================================================
#     # Do NOT assume VeRi has 20 active cameras.
#     # Count only cameras that actually appear in runtime logs.

#     active_camera_ids = set()

#     # ========================================================
#     # TOTAL VEHICLES DETECTED
#     # ========================================================
#     # One dashboard-log entry represents one runtime vehicle
#     # detection / Re-ID request.

#     vehicles_detected = len(logs)

#     # ========================================================
#     # RE-ID CONFIDENCE COUNTS
#     # ========================================================

#     high_conf = 0
#     possible_conf = 0
#     unlikely_conf = 0

#     # ========================================================
#     # PER-CAMERA DETECTION COUNTS
#     # ========================================================

#     camera_counts = {}

#     # ========================================================
#     # RECENT VEHICLE SIGHTINGS
#     # ========================================================

#     recent_sightings = []

#     # ========================================================
#     # PROCESS LOGS
#     # ========================================================

#     for entry in reversed(logs):

#         # ----------------------------------------------------
#         # QUERY CAMERA
#         # ----------------------------------------------------

#         query_cam = entry.get("query_camera")

#         if query_cam is not None:
#             camera_key = str(query_cam)

#             active_camera_ids.add(camera_key)

#             camera_counts[camera_key] = (
#                 camera_counts.get(camera_key, 0) + 1
#             )

#         # ----------------------------------------------------
#         # TOP RE-ID MATCH
#         # ----------------------------------------------------

#         matches = entry.get("matches", [])

#         top_match = matches[0] if matches else None

#         if not top_match:
#             continue

#         # ----------------------------------------------------
#         # MATCH CAMERA
#         # ----------------------------------------------------

#         match_camera = top_match.get("camera")

#         if match_camera is not None:
#             active_camera_ids.add(str(match_camera))

#         # ----------------------------------------------------
#         # CONFIDENCE
#         # ----------------------------------------------------

#         conf = top_match.get("confidence", 0)

#         try:
#             conf = float(conf)
#         except (TypeError, ValueError):
#             conf = 0.0

#         if conf >= 0.85:
#             high_conf += 1

#         elif conf >= 0.50:
#             possible_conf += 1

#         else:
#             unlikely_conf += 1

#         # ----------------------------------------------------
#         # VEHICLE METADATA
#         # ----------------------------------------------------

#         matched_filename = top_match.get(
#             "matched_filename",
#             ""
#         )

#         label_info = VERI_LABELS.get(
#             matched_filename,
#             {}
#         )

#         vehicle_id = label_info.get(
#             "vehicle_id",
#             "Unknown"
#         )

#         vehicle_type = label_info.get(
#             "type",
#             "Unknown"
#         )

#         vehicle_color = label_info.get(
#             "color",
#             "Unknown"
#         )

#         # ----------------------------------------------------
#         # RECENT SIGHTINGS
#         # ----------------------------------------------------

#         if len(recent_sightings) < 10:

#             recent_sightings.append({
#                 "vehicle_id": vehicle_id,

#                 "camera": (
#                     f"CAM-{match_camera}"
#                     if match_camera is not None
#                     else "Unknown"
#                 ),

#                 "type": vehicle_type,

#                 "color": vehicle_color,

#                 "plate": "Pending ANPR",

#                 "timestamp": entry.get(
#                     "timestamp",
#                     ""
#                 ),

#                 "confidence": top_match.get(
#                     "confidencePercentage",
#                     f"{round(conf * 100, 1)}%"
#                 ),

#                 "confidence_raw": conf,

#                 "matched_filename": matched_filename,
#             })

#     # ========================================================
#     # TOTAL RE-ID RESULTS
#     # ========================================================

#     total_reid = (
#         high_conf
#         + possible_conf
#         + unlikely_conf
#     )

#     # ========================================================
#     # CONFIDENCE PERCENTAGE
#     # ========================================================

#     def pct(count):

#         if total_reid == 0:
#             return 0

#         return round(
#             (count / total_reid) * 100,
#             1
#         )

#     # ========================================================
#     # SORT CAMERAS NUMERICALLY
#     # ========================================================

#     detections_per_camera = dict(
#         sorted(
#             camera_counts.items(),
#             key=lambda item: int(item[0])
#             if item[0].isdigit()
#             else item[0]
#         )
#     )

#     # ========================================================
#     # RESPONSE
#     # ========================================================

#     return {

#         "status": "success",

#         "stats": {

#             # Runtime value.
#             "active_cameras": len(
#                 active_camera_ids
#             ),

#             "vehicles_detected": (
#                 vehicles_detected
#             ),

#             "vehicles_reid": (
#                 total_reid
#             ),

#             # Alerts are not implemented yet.
#             "active_alerts": 0,
#         },

#         # ====================================================
#         # RE-ID CONFIDENCE DISTRIBUTION
#         # ====================================================

#         "reid_confidence": [

#             {
#                 "name": "High Confidence",
#                 "value": pct(high_conf),
#                 "count": high_conf,
#                 "color": "#0c4d9e",
#             },

#             {
#                 "name": "Possible Match",
#                 "value": pct(possible_conf),
#                 "count": possible_conf,
#                 "color": "#4d83be",
#             },

#             {
#                 "name": "Unlikely",
#                 "value": pct(unlikely_conf),
#                 "count": unlikely_conf,
#                 "color": "#3a7698",
#             },
#         ],

#         # ====================================================
#         # VEHICLE DETECTIONS PER CAMERA
#         # ====================================================

#         "detections_per_camera": (
#             detections_per_camera
#         ),

#         # ====================================================
#         # RECENT VEHICLE SIGHTINGS
#         # ====================================================

#         "recent_sightings": (
#             recent_sightings
#         ),
#     }
# # ============================================================
# # INCLUDE API ROUTER
# # ============================================================

# app.include_router(api_router)


# # ============================================================
# # START SERVER
# # ============================================================

# if __name__ == "__main__":

#     import uvicorn

#     port = int(
#         os.environ.get(
#             "ML_PORT",
#             "8000",
#         )
#     )

#     uvicorn.run(
#         app,
#         host="127.0.0.1",
#         port=port,
#     )