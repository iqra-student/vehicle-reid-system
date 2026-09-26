import os
import re
import shutil
from collections import defaultdict

# ---------- CONFIG ----------
SOURCE_DIR = r"C:\Users\tayya\Documents\FYP\archive (1)\VeRi\image_test"
OUTPUT_DIR = r"C:\Users\tayya\Documents\FYP\reid_test_feeds"

VEHICLE_IDS = [2, 5, 9, 27, 38, 42, 63, 65, 74, 86, 96]
VEHICLE_IDS = [f"{v:04d}" for v in VEHICLE_IDS]  # zero-pad to match VeRi naming, e.g. 0002

FEED1_DIR = os.path.join(OUTPUT_DIR, "feed1")
FEED2_DIR = os.path.join(OUTPUT_DIR, "feed2")

# VeRi filename pattern: 0002_c003_00012345_0.jpg
FILENAME_PATTERN = re.compile(r"^(\d{4})_c(\d{3})_(\d+)_\d+\.jpg$", re.IGNORECASE)

# ---------- SETUP ----------
os.makedirs(FEED1_DIR, exist_ok=True)
os.makedirs(FEED2_DIR, exist_ok=True)

for vid in VEHICLE_IDS:
    os.makedirs(os.path.join(FEED1_DIR, vid), exist_ok=True)
    os.makedirs(os.path.join(FEED2_DIR, vid), exist_ok=True)

# ---------- SCAN SOURCE FOLDER ----------
# vehicle_id -> { camera_id -> [filenames] }
vehicle_camera_map = defaultdict(lambda: defaultdict(list))

for filename in os.listdir(SOURCE_DIR):
    match = FILENAME_PATTERN.match(filename)
    if not match:
        continue

    vehicle_id, camera_id, frame = match.groups()

    if vehicle_id in VEHICLE_IDS:
        vehicle_camera_map[vehicle_id][camera_id].append(filename)

# ---------- COPY FILES ----------
summary = []

for vid in VEHICLE_IDS:
    cameras = vehicle_camera_map.get(vid)

    if not cameras:
        summary.append(f"[MISSING] Vehicle {vid}: no images found at all.")
        continue

    # sort camera ids so results are consistent between runs
    camera_ids = sorted(cameras.keys())

    if len(camera_ids) < 2:
        summary.append(
            f"[WARN] Vehicle {vid}: only found on camera {camera_ids[0]} — "
            f"putting same camera in both feeds."
        )
        cam_feed1 = camera_ids[0]
        cam_feed2 = camera_ids[0]
    else:
        cam_feed1 = camera_ids[0]
        cam_feed2 = camera_ids[1]
        summary.append(
            f"[OK] Vehicle {vid}: feed1 -> camera {cam_feed1}, feed2 -> camera {cam_feed2}"
        )

    # copy feed1 images
    for fname in cameras[cam_feed1]:
        src = os.path.join(SOURCE_DIR, fname)
        dst = os.path.join(FEED1_DIR, vid, fname)
        shutil.copy2(src, dst)

    # copy feed2 images
    for fname in cameras[cam_feed2]:
        src = os.path.join(SOURCE_DIR, fname)
        dst = os.path.join(FEED2_DIR, vid, fname)
        shutil.copy2(src, dst)

# ---------- REPORT ----------
print("\n".join(summary))
print(f"\nDone. Output saved to:\n  {FEED1_DIR}\n  {FEED2_DIR}")