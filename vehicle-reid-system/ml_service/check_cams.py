import os
import re
from collections import defaultdict

GALLERY_DIR = r"C:\Users\tayya\Documents\FYP\archive (1)\VeRi\image_test"  # adjust for wherever you're running this

def parse_filename(fname):
    m = re.match(r"^(\d+)_c(\d+)_(\d+)_\d+\.(jpg|jpeg|png)$", fname, re.IGNORECASE)
    if not m:
        return None
    return {
        "vehicle_id": m.group(1),
        "camera": int(m.group(2)),
        "frame": int(m.group(3)),
        "filename": fname,
    }

def vehicle_camera_appearances(vehicle_id, gallery_dir=GALLERY_DIR):
    vehicle_id = str(vehicle_id).zfill(4)  # VeRi-776 IDs are zero-padded, e.g. "0002"
    by_camera = defaultdict(list)

    for fname in os.listdir(gallery_dir):
        parsed = parse_filename(fname)
        if not parsed or parsed["vehicle_id"] != vehicle_id:
            continue
        by_camera[parsed["camera"]].append(parsed)

    for cam in by_camera:
        by_camera[cam].sort(key=lambda p: p["frame"])

    return dict(sorted(by_camera.items()))

def print_appearances(vehicle_id, gallery_dir=GALLERY_DIR):
    appearances = vehicle_camera_appearances(vehicle_id, gallery_dir)
    if not appearances:
        print(f"Vehicle {vehicle_id}: no images found in {gallery_dir}")
        return

    total = sum(len(v) for v in appearances.values())
    print(f"Vehicle {vehicle_id}: appears in {len(appearances)} camera(s), {total} image(s) total")
    for cam, imgs in appearances.items():
        frames = ", ".join(str(i["frame"]) for i in imgs)
        print(f"  Camera {cam}: {len(imgs)} image(s) — frames: {frames}")
        for i in imgs:
            print(f"    {i['filename']}")

def compare_two_vehicles(vehicle_a, vehicle_b, gallery_dir=GALLERY_DIR):
    a = vehicle_camera_appearances(vehicle_a, gallery_dir)
    b = vehicle_camera_appearances(vehicle_b, gallery_dir)
    shared = set(a.keys()) & set(b.keys())

    print(f"Vehicle {vehicle_a}: cameras {sorted(a.keys())}")
    print(f"Vehicle {vehicle_b}: cameras {sorted(b.keys())}")
    print(f"Shared cameras: {sorted(shared) if shared else 'none'}")


if __name__ == "__main__":
    print_appearances("0009")
    # When a hard negative shows up wrong, drop both IDs in here:
    # compare_two_vehicles("0002", "0007")