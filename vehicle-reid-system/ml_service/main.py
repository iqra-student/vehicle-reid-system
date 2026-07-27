from fastapi import FastAPI, File, UploadFile, HTTPException
from ultralytics import YOLO
import cv2
import numpy as np
import io
from PIL import Image

app = FastAPI(title="Vehicle Re-ID ML Service")

# Load YOLOv8 model (yolov8n.pt will auto-download on first run)
model = YOLO("yolov8n.pt")

# COCO Dataset Class IDs for Vehicles (car: 2, motorcycle: 3, bus: 5, truck: 7)
VEHICLE_CLASS_IDS = [2, 3, 5, 7]

@app.get("/")
def root():
    return {"status": "ML service running"}

@app.post("/detect")
async def detect_vehicles(file: UploadFile = File(...)):
    try:
        # Read uploaded image file
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        img_np = np.array(image)

        # Run inference using YOLOv8
        results = model(img_np)
        
        detections = []
        for result in results:
            for box in result.boxes:
                class_id = int(box.cls[0])
                
                # Filter only vehicle classes
                if class_id in VEHICLE_CLASS_IDS:
                    coords = box.xyxy[0].tolist()  # [xmin, ymin, xmax, ymax]
                    confidence = float(box.conf[0])
                    class_name = model.names[class_id]

                    detections.append({
                        "class_name": class_name,
                        "confidence": round(confidence, 3),
                        "bbox": [round(c, 2) for c in coords]
                    })

        return {
            "filename": file.filename,
            "vehicle_count": len(detections),
            "detections": detections
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")