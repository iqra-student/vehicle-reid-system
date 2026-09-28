
import os
import re
import base64
import datetime as _dt
import threading

import cv2
import requests

try:
    from pymongo import MongoClient
    _PYMONGO_OK = True
except Exception:
    MongoClient = None
    _PYMONGO_OK = False

ROOT = os.path.dirname(os.path.abspath(__file__))
PLATES_DIR = os.path.join(ROOT, "results_plates")
os.makedirs(PLATES_DIR, exist_ok=True)

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB  = os.environ.get("MONGO_DB", "vehicle_tracking")
MONGO_COLL = os.environ.get("MONGO_COLL", "platevehicles")

# --- Node fallback URLs (change the port if Node isn't on 5000) -----------
NODE_BASE = os.environ.get("NODE_BASE", "http://localhost:5000")
NODE_SAVE_URL = f"{NODE_BASE}/api/plate/sighting"
NODE_GET_URL  = f"{NODE_BASE}/api/plate/sighting"

_mongo_client = None
_mongo_lock = threading.Lock()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _safe_plate(p):
    return re.sub(r"[^A-Z0-9]", "", (p or "").upper()) or "UNKNOWN"


def _safe_cam(c):
    return re.sub(r"[^A-Za-z0-9_\-]", "_", (c or "camera"))


def _get_coll():
    """Return a Mongo collection, or None if unreachable."""
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


def _encode_b64(path):
    full = os.path.join(ROOT, path)
    if not os.path.isfile(full):
        return None
    try:
        with open(full, "rb") as f:
            return "data:image/jpeg;base64," + base64.b64encode(f.read()).decode("ascii")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# WRITE
# ---------------------------------------------------------------------------
def save_sighting(plate_number, camera_id, confidence,
                  source="image", car_image_bgr=None):
    """Save the car image to disk and record the sighting.

    Tries direct Mongo first, then falls back to POST to Node.
    Returns the sighting dict, or None on failure.
    """
    print(f"[plate_store] save_sighting CALLED plate={plate_number} cam={camera_id} src={source} img={'yes' if car_image_bgr is not None else 'no'}")

    plate = _safe_plate(plate_number)
    if plate == "UNKNOWN":
        print(f"[plate_store] aborting: plate resolved to UNKNOWN (input was {plate_number!r})")
        return None

    folder = os.path.join(PLATES_DIR, plate)
    os.makedirs(folder, exist_ok=True)

    ts = _dt.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    cam = _safe_cam(camera_id)
    filename = f"{ts}_{cam}.jpg"
    filepath = os.path.join(folder, filename)

    wrote_file = False
    if car_image_bgr is not None and getattr(car_image_bgr, "size", 0) > 0:
        try:
            ok = cv2.imwrite(filepath, car_image_bgr,
                             [int(cv2.IMWRITE_JPEG_QUALITY), 90])
            wrote_file = bool(ok)
            print(f"[plate_store] wrote file {filepath} -> {wrote_file}")
        except Exception as e:
            print(f"[plate_store] cv2.imwrite failed: {e}")
            return None
    else:
        print(f"[plate_store] no image passed (car_image_bgr is None or empty)")

    rel_path = os.path.relpath(filepath, ROOT).replace("\\", "/")

    sighting = {
        "cameraId": camera_id or "unknown",
        "timestamp": _dt.datetime.utcnow(),
        "confidence": float(confidence or 0.0),
        "source": source,
        "imageFilename": rel_path,
        "folder": plate,
    }

    # --- 1. try direct Mongo ---
    wrote_mongo = False
    coll = _get_coll()
    if coll is not None:
        try:
            now = _dt.datetime.utcnow()
            coll.update_one(
                {"plateNumber": plate},
                {
                    "$setOnInsert": {"plateNumber": plate, "createdAt": now},
                    "$set": {"updatedAt": now},
                    "$push": {"sightings": sighting},
                },
                upsert=True,
            )
            wrote_mongo = True
            print(f"[plate_store] wrote to Mongo directly for {plate}")
        except Exception as e:
            print(f"[plate_store] Mongo write failed: {e}")

    # --- 2. Node fallback (Mongo unreachable or write failed) ---
    if not wrote_mongo:
        try:
            resp = requests.post(
                NODE_SAVE_URL,
                json={
                    "plateNumber": plate,
                    "cameraId": sighting["cameraId"],
                    "timestamp": sighting["timestamp"].isoformat(),
                    "confidence": sighting["confidence"],
                    "source": source,
                    "imageFilename": rel_path,
                    "folder": plate,
                },
                timeout=4,
            )
            print(f"[plate_store] POST {NODE_SAVE_URL} -> {resp.status_code} {resp.text[:200]}")
        except Exception as e:
            print(f"[plate_store] node save failed: {e}")

    return {
        "plateNumber": plate,
        "cameraId": sighting["cameraId"],
        "timestamp": sighting["timestamp"].isoformat(),
        "confidence": sighting["confidence"],
        "source": source,
        "imageFilename": rel_path,
        "folder": plate,
    }


# ---------------------------------------------------------------------------
# READ
# ---------------------------------------------------------------------------
def get_plate_trail(plate_number, camera_id=None):
    """Read one plate's trail. Tries Mongo first, then Node."""
    plate = _safe_plate(plate_number)

    # --- 1. try direct Mongo ---
    coll = _get_coll()
    if coll is not None:
        try:
            doc = coll.find_one({"plateNumber": plate})
        except Exception:
            doc = None
        if doc:
            return _build_trail_from_doc(doc, plate, camera_id)

    # --- 2. Node fallback ---
    try:
        params = {"cameraId": camera_id} if camera_id else {}
        r = requests.get(f"{NODE_GET_URL}/{plate}", params=params, timeout=6)
        if r.status_code == 200:
            data = r.json()
            if not isinstance(data, dict) or "trail" not in data:
                return None
            for item in data["trail"]:
                fn = item.get("imageFilename") or ""
                if fn and not item.get("imageUrl"):
                    item["imageUrl"] = "/" + fn.lstrip("/")
                if not item.get("image"):
                    item["image"] = _encode_b64(fn)
                    item["car_image_b64"] = item["image"]
            return data
        if r.status_code == 404:
            return None
    except Exception as e:
        print(f"[plate_store] node read failed: {e}")

    return None


def _build_trail_from_doc(doc, plate, camera_id=None):
    """Build the trail dict from a Mongo doc."""
    sightings = doc.get("sightings", [])
    if camera_id:
        sightings = [s for s in sightings if s.get("cameraId") == camera_id]
    if not sightings:
        return None

    sightings_sorted = sorted(
        sightings,
        key=lambda s: s.get("timestamp") or _dt.datetime.min,
    )

    trail = []
    for s in sightings_sorted:
        fn = s.get("imageFilename") or ""
        img_b64 = _encode_b64(fn)
        ts = s.get("timestamp")
        ts_str = ts.isoformat() if hasattr(ts, "isoformat") else (str(ts) if ts else None)
        web = ("/" + fn.lstrip("/")) if fn else None

        trail.append({
            "cameraId": s.get("cameraId"),
            "timestamp": ts_str,
            "confidence": s.get("confidence"),
            "source": s.get("source", "image"),
            "imageFilename": fn,
            "imageUrl": web,              # web path (preferred)
            "image": img_b64,             # base64 fallback
            "car_image_b64": img_b64,     # alias
        })

    cams = {t["cameraId"] for t in trail if t["cameraId"]}
    first = trail[0]["timestamp"] if trail else None
    last = trail[-1]["timestamp"] if trail else None

    return {
        "plateNumber": plate,
        "totalSightings": len(trail),
        "totalCameras": len(cams),
        "firstSeen": first,
        "lastSeen": last,
        "trail": trail,
    }