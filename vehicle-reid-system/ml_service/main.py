import os
import sys
import cv2
import numpy as np
import torch
import torch.nn.functional as F
import traceback
import tempfile
from scipy.optimize import linear_sum_assignment
from fastapi import FastAPI, APIRouter, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool
from ultralytics import YOLO

# Import plate reader module
from anpr import read_plate

# Import torchreid from deep-person-reid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "deep-person-reid"))
from torchreid.utils import FeatureExtractor

app = FastAPI(title="Vehicle Re-ID & ANPR Engine - Memory Only")

# All routes live under /api to match the frontend's axiosInstance baseURL
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

device_type = "cuda" if torch.cuda.is_available() else "cpu"

# NOTE: this extractor (ResNet50 ReID backbone) is used by Module 2
# (/compare, /compare-video-streams) for cross-camera similarity matching.
extractor = FeatureExtractor(
    model_name="resnet50",
    model_path="weights/model_final.pth",
    device=device_type
)

yolo_model = YOLO("yolov8n.pt")
VEHICLE_CLASSES = [2, 3, 5, 7]  # Car, Motorcycle, Bus, Truck

# ---- Candidate filtering knobs ----
MAX_TIME_GAP_SEC = 180.0
MIN_TIME_GAP_SEC = -180.0
COLOR_ADVISORY_MAX = 0.60
SIMILARITY_HIGH_CONFIDENCE = 0.75
SIMILARITY_LOW_CONFIDENCE = 0.60
IOU_MATCH_THRESHOLD = 0.15
CENTROID_MATCH_RATIO = 1.5
MAX_MISSED_FRAMES = 8
MIN_TRACK_HITS = 2
MIN_SHARPNESS = 8.0
MIN_BOX_AREA = 4000

# Used when pad_crop=True is explicitly passed into process_video_bytes.
# Callers that never pass it get byte-for-byte identical crops as before.
#
# YOLO vehicle boxes are often tight against the car body and don't
# reliably extend to the very edge of the bumper — which is usually
# exactly where the plate sits. A small margin around the crop gives ANPR
# a real shot at plates that would otherwise be clipped.
CROP_PADDING_RATIO = 0.08

# Detection is run on a downscaled copy of the frame. Boxes are mapped
# back to full-res coordinates before cropping, so crop quality (for
# OCR / ReID) is untouched — only the YOLO forward pass itself runs on a
# smaller image.
DETECTION_INPUT_MAX_DIM = 640


def enhance_image(crop_img):
    if crop_img is None or crop_img.size == 0:
        return crop_img
    return cv2.GaussianBlur(crop_img, (3, 3), 0)


def sharpness_score(crop_img):
    if crop_img is None or crop_img.size == 0:
        return 0.0
    gray = cv2.cvtColor(crop_img, cv2.COLOR_BGR2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def color_histogram(crop_img):
    if crop_img is None or crop_img.size == 0:
        return None

    h, w = crop_img.shape[:2]
    y0, y1 = int(h * 0.15), int(h * 0.85)
    x0, x1 = int(w * 0.15), int(w * 0.85)
    center_crop = crop_img[y0:y1, x0:x1]
    if center_crop.size == 0:
        center_crop = crop_img

    hsv = cv2.cvtColor(center_crop, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [30, 32], [0, 180, 0, 256])
    cv2.normalize(hist, hist, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
    return hist


def color_distance(hist1, hist2):
    if hist1 is None or hist2 is None:
        return 1.0
    return float(cv2.compareHist(hist1, hist2, cv2.HISTCMP_BHATTACHARYYA))


def iou(box_a, box_b):
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_w = max(0, inter_x2 - inter_x1)
    inter_h = max(0, inter_y2 - inter_y1)
    inter_area = inter_w * inter_h

    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter_area

    if union <= 0:
        return 0.0
    return inter_area / union


def centroid(bbox):
    x1, y1, x2, y2 = bbox
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def bbox_diagonal(bbox):
    x1, y1, x2, y2 = bbox
    return float(np.hypot(x2 - x1, y2 - y1))


def track_match_score(box_a, box_b):
    iou_score = iou(box_a, box_b)
    if iou_score >= IOU_MATCH_THRESHOLD:
        return iou_score

    ca, cb = centroid(box_a), centroid(box_b)
    dist = float(np.hypot(ca[0] - cb[0], ca[1] - cb[1]))
    avg_diag = (bbox_diagonal(box_a) + bbox_diagonal(box_b)) / 2.0
    if avg_diag <= 0:
        return 0.0

    max_allowed_dist = CENTROID_MATCH_RATIO * avg_diag
    if dist <= max_allowed_dist:
        return 1.0 - (dist / max_allowed_dist)

    return 0.0


class VehicleTrack:
    _next_id = 0

    def __init__(self, bbox, frame_idx, timestamp_sec, confidence, crop, frame_shape, other_boxes):
        self.track_id = VehicleTrack._next_id
        VehicleTrack._next_id += 1

        self.last_bbox = bbox
        self.missed_frames = 0
        self.active = True
        self.hit_count = 1

        self.best_score = self._frame_score(bbox, crop, frame_shape, other_boxes)
        self.best_raw_sharpness = sharpness_score(crop)
        self.best_bbox = bbox
        self.best_frame_idx = frame_idx
        self.best_timestamp_sec = timestamp_sec
        self.best_confidence = confidence
        self.best_crop = crop

    @staticmethod
    def _frame_score(bbox, crop, frame_shape, other_boxes):
        x1, y1, x2, y2 = bbox
        area = max(1, (x2 - x1) * (y2 - y1))
        score = sharpness_score(crop) * (area ** 0.5)

        frame_h, frame_w = frame_shape[:2]
        edge_margin = 3
        is_clipped = (
            x1 <= edge_margin or y1 <= edge_margin or
            x2 >= frame_w - edge_margin or y2 >= frame_h - edge_margin
        )
        if is_clipped:
            score *= 0.15

        max_overlap = 0.0
        for other in other_boxes:
            if other is bbox:
                continue
            max_overlap = max(max_overlap, iou(bbox, other))
        if max_overlap > 0.1:
            score *= max(0.1, 1.0 - max_overlap)

        return score

    def update(self, bbox, frame_idx, timestamp_sec, confidence, crop, frame_shape, other_boxes):
        self.last_bbox = bbox
        self.missed_frames = 0
        self.hit_count += 1

        score = self._frame_score(bbox, crop, frame_shape, other_boxes)
        if score > self.best_score:
            self.best_score = score
            self.best_raw_sharpness = sharpness_score(crop)
            self.best_bbox = bbox
            self.best_frame_idx = frame_idx
            self.best_timestamp_sec = timestamp_sec
            self.best_confidence = confidence
            self.best_crop = crop


def process_video_bytes(
    video_bytes: bytes,
    camera_id: str,
    sample_rate: int = 4,
    extract_features: bool = True,
    pad_crop: bool = False,
):
    """Processes video frames via a temporary file for OpenCV VideoCapture compatibility.

    extract_features: when False, skips the ResNet50 ReID embedding and
    color-histogram computation entirely.

    pad_crop: when True, crops each vehicle with a small margin around the
    tight YOLO box, since a plate right at the bumper edge otherwise gets
    clipped. Defaults to False, so callers that never pass it get
    byte-for-byte the same crops as before.
    """

    temp_fd, temp_path = tempfile.mkstemp(suffix=".mp4")
    try:
        with os.fdopen(temp_fd, "wb") as temp_video:
            temp_video.write(video_bytes)
        # file handle is now fully closed — safe for cv2 to open on Windows

        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            raise ValueError("OpenCV failed to decode the provided video stream.")

        frame_count = 0
        active_tracks = []
        finished_tracks = []

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_count += 1
            if frame_count % sample_rate != 0:
                continue

            # Run YOLO on a downscaled copy — full 4K frames make the CPU
            # forward pass dramatically slower for no detection-quality
            # benefit at this box size. Boxes are mapped back to full-res
            # coordinates immediately after.
            frame_h, frame_w = frame.shape[:2]
            scale = DETECTION_INPUT_MAX_DIM / max(frame_h, frame_w)
            detect_frame = cv2.resize(frame, None, fx=scale, fy=scale) if scale < 1.0 else frame

            results = yolo_model(detect_frame, verbose=False)[0]
            timestamp = round(cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0, 2)

            detections = []
            for box in results.boxes:
                cls_id = int(box.cls[0].item())
                confidence = float(box.conf[0].item())

                if cls_id in VEHICLE_CLASSES and confidence > 0.45:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                    if scale < 1.0:
                        x1, y1, x2, y2 = [int(v / scale) for v in (x1, y1, x2, y2)]

                    box_area = (x2 - x1) * (y2 - y1)
                    if box_area < MIN_BOX_AREA:
                        continue

                    if pad_crop:
                        pad_x = int((x2 - x1) * CROP_PADDING_RATIO)
                        pad_y = int((y2 - y1) * CROP_PADDING_RATIO)
                        cx1 = max(0, x1 - pad_x)
                        cy1 = max(0, y1 - pad_y)
                        cx2 = min(frame_w, x2 + pad_x)
                        cy2 = min(frame_h, y2 + pad_y)
                    else:
                        cx1, cy1, cx2, cy2 = x1, y1, x2, y2

                    crop = frame[cy1:cy2, cx1:cx2]
                    enhanced_crop = enhance_image(crop)
                    detections.append({
                        "bbox": [x1, y1, x2, y2],
                        "confidence": confidence,
                        "crop": enhanced_crop,
                    })

            unmatched_dets = list(range(len(detections)))
            unmatched_tracks = list(range(len(active_tracks)))
            pairs = []

            for ti in unmatched_tracks:
                for di in unmatched_dets:
                    score = track_match_score(active_tracks[ti].last_bbox, detections[di]["bbox"])
                    if score > 0.0:
                        pairs.append((score, ti, di))
            pairs.sort(key=lambda p: p[0], reverse=True)

            all_boxes_this_frame = [tuple(d["bbox"]) for d in detections]

            matched_t, matched_d = set(), set()
            for score, ti, di in pairs:
                if ti in matched_t or di in matched_d:
                    continue
                matched_t.add(ti)
                matched_d.add(di)
                det = detections[di]
                other_boxes = [b for b in all_boxes_this_frame if b != tuple(det["bbox"])]
                active_tracks[ti].update(
                    det["bbox"], frame_count, timestamp, det["confidence"], det["crop"],
                    frame.shape, other_boxes
                )

            still_active = []
            for ti, track in enumerate(active_tracks):
                if ti in matched_t:
                    still_active.append(track)
                    continue
                track.missed_frames += 1
                if track.missed_frames > MAX_MISSED_FRAMES:
                    track.active = False
                    finished_tracks.append(track)
                else:
                    still_active.append(track)
            active_tracks = still_active

            for di, det in enumerate(detections):
                if di in matched_d:
                    continue
                other_boxes = [b for b in all_boxes_this_frame if b != tuple(det["bbox"])]
                active_tracks.append(
                    VehicleTrack(
                        det["bbox"], frame_count, timestamp, det["confidence"], det["crop"],
                        frame.shape, other_boxes
                    )
                )

        cap.release()

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    finished_tracks.extend(active_tracks)

    valid_tracks = [
        t for t in finished_tracks
        if t.hit_count >= MIN_TRACK_HITS and t.best_raw_sharpness >= MIN_SHARPNESS
    ]

    extracted_records = []
    for track in valid_tracks:
        record = {
            "track_id": f"{camera_id}_veh_{track.track_id}",
            "camera_id": camera_id,
            "frame_idx": track.best_frame_idx,
            "timestamp_sec": track.best_timestamp_sec,
            "bbox": track.best_bbox,
            "confidence": round(track.best_confidence, 2),
            "crop": track.best_crop,
        }

        # Module 2 only: ResNet50 embedding + color histogram, used by
        # hungarian_match() for cross-camera similarity.
        if extract_features:
            record["feature"] = extractor(track.best_crop)
            record["color_hist"] = color_histogram(track.best_crop)

        extracted_records.append(record)

    return extracted_records


def build_candidate_mask(cam1_detections, cam2_detections):
    n, m = len(cam1_detections), len(cam2_detections)
    mask = np.ones((n, m), dtype=bool)

    for i, v1 in enumerate(cam1_detections):
        for j, v2 in enumerate(cam2_detections):
            time_gap = v2["timestamp_sec"] - v1["timestamp_sec"]
            if time_gap < MIN_TIME_GAP_SEC or time_gap > MAX_TIME_GAP_SEC:
                mask[i, j] = False

    return mask


def confidence_tier(similarity: float) -> str:
    if similarity >= SIMILARITY_HIGH_CONFIDENCE:
        return "high"
    if similarity >= SIMILARITY_LOW_CONFIDENCE:
        return "possible"
    return "unlikely"


def hungarian_match(cam1_detections, cam2_detections):
    n, m = len(cam1_detections), len(cam2_detections)
    if n == 0 or m == 0:
        return []

    candidate_mask = build_candidate_mask(cam1_detections, cam2_detections)

    similarity = np.zeros((n, m), dtype=np.float64)
    for i, v1 in enumerate(cam1_detections):
        for j, v2 in enumerate(cam2_detections):
            if not candidate_mask[i, j]:
                continue
            sim = F.cosine_similarity(v1["feature"], v2["feature"])
            similarity[i, j] = max(0.0, float(sim.item()))

    cost = np.where(candidate_mask, 1.0 - similarity, 10.0)

    row_idx, col_idx = linear_sum_assignment(cost)

    matches = []
    for i, j in zip(row_idx, col_idx):
        if not candidate_mask[i, j]:
            continue
        sim = similarity[i, j]
        if sim >= SIMILARITY_LOW_CONFIDENCE:
            v1, v2 = cam1_detections[i], cam2_detections[j]
            c_dist = color_distance(v1["color_hist"], v2["color_hist"])
            matches.append({
                "i": i,
                "j": j,
                "similarity": sim,
                "confidence_tier": confidence_tier(sim),
                "color_distance": round(c_dist, 4),
                "color_consistent": c_dist <= COLOR_ADVISORY_MAX,
            })

    return matches


# ============================================================
# API ENDPOINTS  (all mounted under /api via api_router)
# ============================================================

@api_router.post("/plate-detect")
async def plate_detect(
    file: UploadFile = File(...),
    camera_id: str = Form("Camera_1")
):
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="OpenCV could not read the uploaded image.")

    try:
        raw_result = read_plate(frame) or {}

        plate_text = raw_result.get("plate_text", None)
        confidence = raw_result.get("confidence", 0.0)
        plate_box = raw_result.get("plate_box") or raw_result.get("bbox") or None
        plate_type = raw_result.get("plate_type", "Standard")
        selected_model = raw_result.get("selected_model", "YOLOv8 + EasyOCR")

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
            ] if plate_text else []
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail={"message": "Plate detection failed", "error": str(e)}
        )


@api_router.post("/compare")
async def compare_vehicles(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    invalid_exts = ('.mp4', '.avi', '.mov', '.mkv')
    if file1.filename.endswith(invalid_exts) or file2.filename.endswith(invalid_exts):
        raise HTTPException(
            status_code=400,
            detail="The /compare endpoint only accepts image files."
        )

    b1 = await file1.read()
    b2 = await file2.read()

    img1 = cv2.imdecode(np.frombuffer(b1, np.uint8), cv2.IMREAD_COLOR)
    img2 = cv2.imdecode(np.frombuffer(b2, np.uint8), cv2.IMREAD_COLOR)

    try:
        f1 = extractor(img1)
        f2 = extractor(img2)
        score = max(0.0, float(F.cosine_similarity(f1, f2).item()))
        tier = confidence_tier(score)
        return {
            "status": "success",
            "similarity": round(score, 4),
            "similarityPercentage": f"{round(score * 100, 2)}%",
            "confidence_tier": tier,
            "sameVehicle": tier == "high"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/compare-video-streams")
async def compare_video_streams(
    video1: UploadFile = File(...),
    video2: UploadFile = File(...),
):
    b1 = await video1.read()
    b2 = await video2.read()

    try:
        cam1_detections = process_video_bytes(b1, camera_id="Cam_1", sample_rate=4, extract_features=True)
        cam2_detections = process_video_bytes(b2, camera_id="Cam_2", sample_rate=4, extract_features=True)

        assignment = hungarian_match(cam1_detections, cam2_detections)

        matches = []
        for m in assignment:
            idx, jdx = m["i"], m["j"]
            v1 = cam1_detections[idx]
            v2 = cam2_detections[jdx]

            matches.append({
                "match_id": f"{v1['track_id']}-{v2['track_id']}",
                "cam1_details": {
                    "camera_id": v1["camera_id"],
                    "track_id": v1["track_id"],
                    "frame": v1["frame_idx"],
                    "timestamp": f"{v1['timestamp_sec']}s",
                    "bbox": v1["bbox"],
                    "confidence": v1["confidence"],
                },
                "cam2_details": {
                    "camera_id": v2["camera_id"],
                    "track_id": v2["track_id"],
                    "frame": v2["frame_idx"],
                    "timestamp": f"{v2['timestamp_sec']}s",
                    "bbox": v2["bbox"],
                    "confidence": v2["confidence"],
                },
                "similarity_score": round(m["similarity"], 4),
                "similarity_percentage": f"{round(m['similarity'] * 100, 2)}%",
                "confidence_tier": m["confidence_tier"],
                "color_distance": m["color_distance"],
                "color_consistent": m["color_consistent"],
                "status": "AUTO_MATCHED" if m["confidence_tier"] == "high" else "PENDING_OPERATOR_REVIEW"
            })

        return {
            "status": "success",
            "module": "Module 2 - Vehicle Re-Identification",
            "cam1_vehicles_found": len(cam1_detections),
            "cam2_vehicles_found": len(cam2_detections),
            "total_reid_matches": len(matches),
            "high_confidence_matches": sum(1 for m in matches if m["confidence_tier"] == "high"),
            "possible_matches": sum(1 for m in matches if m["confidence_tier"] == "possible"),
            "matches": matches
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)