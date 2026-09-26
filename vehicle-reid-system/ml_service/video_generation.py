import cv2
import numpy as np
import os
import glob

# ================== CONFIG ==================
BACKGROUND_VIDEO = r"C:\Users\tayya\Documents\FYP\test_data\cctv_feed.mp4"

FEEDS_ROOT = r"C:\Users\tayya\Documents\FYP\reid_test_feeds"
VEHICLE_IDS = ["0002", "0005", "0009", "0027", "0038", "0042",
               "0063", "0065", "0074", "0086", "0096"]

OUTPUT_DIR = r"C:\Users\tayya\Documents\FYP\reid_test_feeds\rendered"
os.makedirs(OUTPUT_DIR, exist_ok=True)

FEATHER = 15              # px, soft edge blending on the car patch
SECONDS_PER_VEHICLE = 4   # how long each car's segment runs in the final video

# Different lane paths per feed so it doesn't look identical
FEED_PATHS = {
    "feed1": {"start_pos": (0.42, 0.30), "end_pos": (0.30, 0.88),
              "start_scale": 0.10, "end_scale": 0.34},
    "feed2": {"start_pos": (0.55, 0.28), "end_pos": (0.68, 0.85),
              "start_scale": 0.10, "end_scale": 0.34},
}
# ==============================================


def load_car_frames(folder):
    files = sorted(glob.glob(os.path.join(folder, "*.jpg")))
    frames = [cv2.imread(f) for f in files]
    return [f for f in frames if f is not None]


def feathered_mask(h, w, feather):
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.rectangle(mask, (0, 0), (w - 1, h - 1), 255, -1)
    if feather > 0:
        mask = cv2.GaussianBlur(mask, (0, 0), feather)
    return mask.astype(np.float32) / 255.0


def composite(bg_frame, car_img, center_xy, target_w, feather):
    h_bg, w_bg = bg_frame.shape[:2]
    h_car, w_car = car_img.shape[:2]
    scale = target_w / w_car
    new_w, new_h = max(1, int(w_car * scale)), max(1, int(h_car * scale))
    car_resized = cv2.resize(car_img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    cx, cy = center_xy
    x0, y0 = int(cx - new_w / 2), int(cy - new_h / 2)
    x1, y1 = x0 + new_w, y0 + new_h

    bx0, by0 = max(0, x0), max(0, y0)
    bx1, by1 = min(w_bg, x1), min(h_bg, y1)
    if bx1 <= bx0 or by1 <= by0:
        return bg_frame

    cx0, cy0 = bx0 - x0, by0 - y0
    cx1, cy1 = cx0 + (bx1 - bx0), cy0 + (by1 - by0)

    car_crop = car_resized[cy0:cy1, cx0:cx1]
    mask = feathered_mask(new_h, new_w, feather)[cy0:cy1, cx0:cx1][..., None]

    roi = bg_frame[by0:by1, bx0:bx1].astype(np.float32)
    blended = roi * (1 - mask) + car_crop.astype(np.float32) * mask
    bg_frame[by0:by1, bx0:bx1] = blended.astype(np.uint8)
    return bg_frame


def render_feed(feed_name, feed_images_root, background_video, output_path):
    path_cfg = FEED_PATHS[feed_name]

    probe = cv2.VideoCapture(background_video)
    fps = probe.get(cv2.CAP_PROP_FPS) or 30
    w = int(probe.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(probe.get(cv2.CAP_PROP_FRAME_HEIGHT))
    probe.release()

    frames_per_vehicle = int(fps * SECONDS_PER_VEHICLE)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (w, h))

    for vid in VEHICLE_IDS:
        car_dir = os.path.join(feed_images_root, vid)
        car_frames = load_car_frames(car_dir)
        if not car_frames:
            print(f"[skip] no images for vehicle {vid} in {car_dir}")
            continue

        cap = cv2.VideoCapture(background_video)  # restart bg for each vehicle's segment
        n_car = len(car_frames)

        for i in range(frames_per_vehicle):
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # loop bg if segment longer than clip
                ret, frame = cap.read()
                if not ret:
                    break

            t = i / max(1, frames_per_vehicle - 1)
            sx, sy = path_cfg["start_pos"]
            ex, ey = path_cfg["end_pos"]
            cx = (sx + (ex - sx) * t) * w
            cy = (sy + (ey - sy) * t) * h
            target_w = (path_cfg["start_scale"] + (path_cfg["end_scale"] - path_cfg["start_scale"]) * t) * w

            car_img = car_frames[i % n_car]
            frame = composite(frame, car_img, (cx, cy), target_w, FEATHER)
            out.write(frame)

        cap.release()
        print(f"[{feed_name}] rendered vehicle {vid}")

    out.release()
    print(f"Done -> {output_path}")


if __name__ == "__main__":
    render_feed(
        "feed1",
        os.path.join(FEEDS_ROOT, "feed1"),
        BACKGROUND_VIDEO,
        os.path.join(OUTPUT_DIR, "feed1.mp4"),
    )
    render_feed(
        "feed2",
        os.path.join(FEEDS_ROOT, "feed2"),
        BACKGROUND_VIDEO,
        os.path.join(OUTPUT_DIR, "feed2.mp4"),
    )