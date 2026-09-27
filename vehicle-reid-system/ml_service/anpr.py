# import re
# import cv2
# import easyocr
# import numpy as np
# from statistics import mean
# from fast_alpr import ALPR

# # Initialize models once at startup
# reader = easyocr.Reader(['en'], gpu=False)
# alpr = ALPR(
#     detector_model="yolo-v9-t-384-license-plate-end2end",
#     ocr_model="cct-xs-v2-global-model"
# )

# def clean_text(text):
#     return re.sub(r'[^A-Za-z0-9]', '', str(text)).upper()

# def get_confidence(conf):
#     if isinstance(conf, list):
#         values = [float(x) for x in conf]
#         return mean(values) if values else 0.0
#     return float(conf)

# def smart_easyocr(plate_crop):
#     detections = reader.readtext(
#         plate_crop,
#         allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"
#     )
#     if not detections:
#         return "", 0.0, 1

#     detections = sorted(detections, key=lambda d: (d[0][0][1] + d[0][2][1]) / 2)
#     heights = [abs(d[0][2][1] - d[0][0][1]) for d in detections]
#     median_height = sorted(heights)[len(heights) // 2]
#     row_gap = max(median_height * 0.8, plate_crop.shape[0] * 0.12)

#     rows = []
#     for d in detections:
#         cy = (d[0][0][1] + d[0][2][1]) / 2
#         placed = False
#         for row in rows:
#             row_center = mean([(item[0][0][1] + item[0][2][1]) / 2 for item in row])
#             if abs(cy - row_center) <= row_gap:
#                 row.append(d)
#                 placed = True
#                 break
#         if not placed:
#             rows.append([d])

#     rows = sorted(rows, key=lambda r: mean([(item[0][0][1] + item[0][2][1]) / 2 for item in r]))

#     final_lines, confidences = [], []
#     for row in rows:
#         row = sorted(row, key=lambda d: d[0][0][0])
#         line = "".join([clean_text(d[1]) for d in row])
#         confidences.extend([float(d[2]) for d in row])
#         if line:
#             final_lines.append(line)

#     return "".join(final_lines), (mean(confidences) if confidences else 0.0), len(rows)

# def process_anpr_frame(frame):
#     """Processes an OpenCV image frame and returns detection results."""
#     results = alpr.predict(frame)
#     if not results:
#         return {"detected": False, "message": "No plate detected"}

#     detections_output = []
#     h, w = frame.shape[:2]

#     for r in results:
#         if r.detection is None:
#             continue

#         x1, y1, x2, y2 = map(int, r.detection.bounding_box)
#         x1, y1 = max(0, min(x1, w - 1)), max(0, min(y1, h - 1))
#         x2, y2 = max(0, min(x2, w - 1)), max(0, min(y2, h - 1))

#         pad = 8
#         plate_crop = frame[max(y1 - pad, 0):min(y2 + pad, h), max(x1 - pad, 0):min(x2 + pad, w)]
#         if plate_crop.size == 0:
#             continue
#         plate_crop = cv2.resize(plate_crop, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)

#         alpr_text = clean_text(r.ocr.text) if r.ocr else ""
#         alpr_conf = get_confidence(r.ocr.confidence) if r.ocr else 0.0

#         easy_text, easy_conf, row_count = smart_easyocr(plate_crop)
#         plate_type = "Two-row" if row_count >= 2 else "One-row"

#         if alpr_text and easy_text:
#             if alpr_conf >= easy_conf:
#                 final_text, final_conf, selected_model = alpr_text, alpr_conf, "Fast-ALPR"
#             else:
#                 final_text, final_conf, selected_model = easy_text, easy_conf, "EasyOCR Spatial"
#         elif alpr_text:
#             final_text, final_conf, selected_model = alpr_text, alpr_conf, "Fast-ALPR"
#         elif easy_text:
#             final_text, final_conf, selected_model = easy_text, easy_conf, "EasyOCR Spatial"
#         else:
#             final_text, final_conf, selected_model = "UNKNOWN", 0.0, "None"

#         # NOTE: a redundant second YOLO pass (detect_car) used to run here to
#         # locate the parent vehicle's box for every plate. It was removed --
#         # main.py already runs vehicle detection/tracking itself and passes
#         # in an already-cropped vehicle image, so the extra pass never had
#         # a consumer downstream. Removing it cuts one full YOLO inference
#         # per plate, per frame.

#         detections_output.append({
#             "plate_text": final_text,
#             "confidence": round(final_conf, 2),
#             "selected_model": selected_model,
#             "plate_type": plate_type,
#             "plate_box": [x1, y1, x2, y2],
#             "plate_crop": plate_crop,
#         })

#     return {"detected": True, "results": detections_output}


# def read_plate(frame):
#     """
#     Wrapper around process_anpr_frame() that returns a single flat
#     detection dict, matching the shape main.py expects.
#     Returns {} if no plate was detected.
#     """
#     result = process_anpr_frame(frame)

#     if not result.get("detected") or not result.get("results"):
#         return {}

#     best = max(result["results"], key=lambda r: r["confidence"])

#     return {
#         "plate_text": best["plate_text"] if best["plate_text"] != "UNKNOWN" else None,
#         "confidence": best["confidence"],
#         "plate_box": best["plate_box"],
#         "plate_type": best["plate_type"],
#         "selected_model": best["selected_model"],
#         "plate_crop": best["plate_crop"],
#     }


