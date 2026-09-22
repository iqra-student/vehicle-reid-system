import os
import sys
import cv2
import re
import shutil
import tempfile
import traceback
import numpy as np
import torch

from fastapi import (
    FastAPI,
    APIRouter,
    UploadFile,
    File,
    Form,
    HTTPException,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from ultralytics import YOLO
from torchvision import transforms
from PIL import Image


# ============================================================
# BASE DIRECTORY
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ============================================================
# ANPR
# ============================================================

sys.path.insert(0, BASE_DIR)

from anpr import read_plate
import section_3_3 as plate_track


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

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(MATCHES_DIR, exist_ok=True)
os.makedirs(DEBUG_DIR, exist_ok=True)

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
# LOAD CLIP-ReID MODEL
# ============================================================

clip_config_path = os.path.join(
    CLIP_REID_DIR,
    "configs",
    "veri",
    "vit_base.yml",
)

if not os.path.exists(clip_config_path):
    raise FileNotFoundError(
        f"CLIP-ReID config not found: {clip_config_path}"
    )

cfg.merge_from_file(clip_config_path)
cfg.freeze()

clip_model = make_model(
    cfg,
    num_class=576,
    camera_num=20,
    view_num=8,
)


# ============================================================
# CLIP-ReID WEIGHTS
# ============================================================

clip_weights_path = os.path.join(
    BASE_DIR,
    "weights",
    "ViT-B-16_60.pth",
)

if not os.path.exists(clip_weights_path):
    raise FileNotFoundError(
        f"CLIP-ReID weights not found: {clip_weights_path}"
    )

print("Loading CLIP-ReID weights...")

clip_model.load_state_dict(
    torch.load(
        clip_weights_path,
        map_location=clip_device,
    )
)

clip_model.to(clip_device)
clip_model.eval()

print("CLIP-ReID model loaded successfully.")


# ============================================================
# LOAD GALLERY EMBEDDINGS
# ============================================================

gallery_embeddings = np.empty(
    (0, 1280),
    dtype=np.float32,
)

gallery_filenames = np.array([])

gallery_embeddings_path = os.path.join(
    BASE_DIR,
    "gallery_embeddings.npz",
)

if os.path.exists(gallery_embeddings_path):

    gallery_data = np.load(gallery_embeddings_path)

    gallery_embeddings = gallery_data["embeddings"]
    gallery_filenames = gallery_data["filenames"]

    print(
        f"Loaded {len(gallery_embeddings)} gallery embeddings."
    )

else:

    print(
        "WARNING: gallery_embeddings.npz not found."
    )


# ============================================================
# LOAD PAIR CLASSIFIER
# ============================================================

classifier = PairClassifier(
    input_dim=1280
)

classifier_weights_path = os.path.join(
    BASE_DIR,
    "weights",
    "pair_classifier_full.pth",
)

if not os.path.exists(classifier_weights_path):
    raise FileNotFoundError(
        f"Pair classifier weights not found: "
        f"{classifier_weights_path}"
    )

print("Loading pair classifier...")

classifier.load_state_dict(
    torch.load(
        classifier_weights_path,
        map_location=clip_device,
    )
)

classifier.to(clip_device)
classifier.eval()

print("Pair classifier loaded successfully.")


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

        raw_result = read_plate(frame) or {}

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
):

    if not video.filename:
        raise HTTPException(
            status_code=400,
            detail="Upload a camera video first",
        )

    suffix = (
        os.path.splitext(video.filename)[1]
        or ".mp4"
    )

    in_path = os.path.join(
        plate_track.RESULTS_DIR,
        f"{os.urandom(8).hex()}_in{suffix}",
    )

    try:

        contents = await video.read()

        if len(contents) > plate_track.MAX_UPLOAD_BYTES:

            raise HTTPException(
                status_code=413,
                detail="Video is too large. Use a file under 40 MB.",
            )

        with open(in_path, "wb") as handle:
            handle.write(contents)

    except OSError as exc:

        raise HTTPException(
            status_code=500,
            detail=plate_track.disk_error(exc),
        ) from exc

    return {
        "job_id": plate_track.launch_job(
            in_path,
            delete_input=True,
        )
    }


# ============================================================
# MODULE 3.3 - SAMPLE VIDEO
# ============================================================

@api_router.post("/plate-track-sample")
async def plate_track_sample():

    sample = os.path.join(
        plate_track.ROOT,
        "sample.mp4",
    )

    if not os.path.exists(sample):

        raise HTTPException(
            status_code=404,
            detail="sample.mp4 is missing next to section_3_3.py",
        )

    return {
        "job_id": plate_track.launch_job(
            sample,
            delete_input=False,
        )
    }


# ============================================================
# MODULE 3.3 - TRACKING STATUS
# ============================================================

@api_router.get("/plate-track-status/{job_id}")
async def plate_track_status(
    job_id: str,
):

    with plate_track.jobs_lock:

        job = plate_track.jobs.get(job_id)

        if not job:
            raise HTTPException(
                status_code=404,
                detail="Unknown job",
            )

        done = job["status"] == "done"

        return {
            "status": job["status"],
            "frame": job["frame"],
            "total": job["total"],
            "message": job["message"],
            "plates": job.get("plates") or [],
            "error": job.get("error"),
            "video_url": (
                f"/api/plate-track-result/{job_id}"
                if done
                else None
            ),
        }


# ============================================================
# MODULE 3.3 - TRACKING RESULT
# ============================================================

@api_router.get("/plate-track-result/{job_id}")
async def plate_track_result(
    job_id: str,
):

    with plate_track.jobs_lock:

        job = plate_track.jobs.get(job_id)

        if not job:
            raise HTTPException(
                status_code=404,
                detail="Unknown job",
            )

        if job["status"] != "done":
            raise HTTPException(
                status_code=400,
                detail="Still processing",
            )

        out_path = job["output"]

    if not os.path.exists(out_path):

        raise HTTPException(
            status_code=404,
            detail="Result video missing",
        )

    return FileResponse(
        out_path,
        media_type="video/mp4",
        filename="plate_tracking.mp4",
    )


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


# ============================================================
# CLIP-ReID - FIND MATCH
# ============================================================

@app.post("/find-match")
async def find_match(
    file: UploadFile = File(...),
    exclude_same_camera: bool = Form(True),
):

    filename = (
        file.filename
        or "query_image.jpg"
    )

    suffix = (
        os.path.splitext(filename)[1]
        or ".jpg"
    )

    temp_fd, path = tempfile.mkstemp(
        suffix=suffix,
    )

    try:

        # ----------------------------------------------------
        # Save uploaded query image
        # ----------------------------------------------------

        with os.fdopen(
            temp_fd,
            "wb",
        ) as b:

            shutil.copyfileobj(
                file.file,
                b,
            )

        # ----------------------------------------------------
        # Check gallery
        # ----------------------------------------------------

        if len(gallery_embeddings) == 0:

            raise HTTPException(
                status_code=503,
                detail="Gallery embeddings are not available.",
            )

        # ----------------------------------------------------
        # Extract query CLIP embedding
        # ----------------------------------------------------

        query_emb = extract_clip_embedding(path)

        HALF = len(query_emb) // 2

        query_cam = parse_camera_id(filename)

        # ----------------------------------------------------
        # Select gallery images
        # ----------------------------------------------------

        indices = []
        cams = []

        for i, name in enumerate(gallery_filenames):

            gal_cam = parse_camera_id(
                str(name)
            )

            if gal_cam is None:
                continue

            if (
                exclude_same_camera
                and query_cam is not None
                and gal_cam == query_cam
            ):
                continue

            indices.append(i)
            cams.append(int(gal_cam))

        if not indices:

            raise HTTPException(
                status_code=404,
                detail="No gallery images to search.",
            )

        # ----------------------------------------------------
        # Prepare classifier input
        # ----------------------------------------------------

        gal = gallery_embeddings[indices]

        q_half = np.tile(
            query_emb[:HALF],
            (len(indices), 1),
        )

        combined = np.concatenate(
            [
                q_half,
                gal[:, HALF:],
            ],
            axis=1,
        ).astype(np.float32)

        # ----------------------------------------------------
        # Run pair classifier in batches
        # ----------------------------------------------------

        probs = []

        with torch.no_grad():

            for start in range(
                0,
                len(combined),
                1024,
            ):

                batch = (
                    torch.from_numpy(
                        combined[
                            start:start + 1024
                        ]
                    )
                    .to(clip_device)
                )

                p = torch.sigmoid(
                    classifier(batch)
                ).view(-1)

                probs.append(
                    p.cpu().numpy()
                )

        probs = np.concatenate(probs)

        # ----------------------------------------------------
        # Keep best image for each camera
        # ----------------------------------------------------

        best = {}

        for idx, cam, prob in zip(
            indices,
            cams,
            probs,
        ):

            prob = float(prob)

            if (
                cam not in best
                or prob > best[cam][0]
            ):

                best[cam] = (
                    prob,
                    str(
                        gallery_filenames[idx]
                    ),
                )

        # ----------------------------------------------------
        # Format results
        # ----------------------------------------------------

        matches = [

            {
                "camera": cam,
                "matched_filename": fname,
                "confidence": round(
                    score,
                    4,
                ),
                "confidencePercentage": (
                    f"{round(score * 100, 2)}%"
                ),
            }

            for cam, (
                score,
                fname,
            ) in best.items()

        ]

        matches.sort(
            key=lambda m: m["confidence"],
            reverse=True,
        )

        return {
            "status": "success",
            "query_camera": (
                int(query_cam)
                if query_cam
                else None
            ),
            "matches": matches,
        }

    finally:

        if os.path.exists(path):
            os.remove(path)


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