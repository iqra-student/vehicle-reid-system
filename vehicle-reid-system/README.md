# 🚗 Vehicle Re-Identification (Re-ID) & Surveillance System

A full-stack, AI-powered Intelligent Traffic Surveillance System designed to perform **Object Detection** (YOLOv8) and **Cross-Camera Vehicle Re-Identification** (OSNet). The system extracts 512-dimensional feature embeddings to match vehicle identities across different camera angles and reject distinct vehicles based on Cosine Similarity.

---

## 🏗️ System Architecture

```text
[ React Frontend ] ──(Port 3000/5173)──> [ Express Backend Proxy ] ──(Port 5000)──> [ MongoDB Database ]
                                                   │
                                            (Multipart Form Proxy)
                                                   │
                                                   ▼
                                       [ FastAPI ML Service ] ──(Port 8000)──> [ PyTorch / Torchreid (OSNet) ]
```

---

## 🧠 Machine Learning Engine Specifications

- **Backbone Architecture:** `osnet_x1_0` (Omni-Scale Network for Person/Vehicle Re-ID)
- **Dataset Trained On:** VeRi-776
- **Exported Weights:** `weights/model.pth` (10 Epochs, ~99% accuracy)
- **Feature Vector Output:** 512-dimensional dense embedding (1 × 512)
- **Distance Metric:** Cosine Similarity via PyTorch (`F.cosine_similarity`)
- **Identity Decision Rule:**

```text
If Similarity >= Threshold (e.g., 0.75)
    → Same Vehicle (Match)

Else
    → Different Vehicle (Rejected)
```

---

## 🗂️ Detailed File Changes & Directory Log

### 1. 🐍 Machine Learning Service (`/ml_service`)

| File Name | Change Type | Description / Responsibility |
|------------|-------------|------------------------------|
| `main.py` | **Updated** | Added Torchreid search path integration, CORS middleware, loaded OSNet weights, maintained `/extract-feature`, and added the **`POST /compare`** endpoint utilizing PyTorch Cosine Similarity. |
| `weights/model.pth` | **Added** | Trained OSNet model weights trained on VeRi-776 for 512-D feature vector extraction. |
| `deep-person-reid/` | **Added** | Official Torchreid repository integrated locally into the Python search path. |

### 2. 🟢 Express Backend (`/backend`)

| File Name | Change Type | Description / Responsibility |
|------------|-------------|------------------------------|
| `routes/detection.js` | **Updated** | Configured `multer` memory storage. Retained `/detect` (YOLO proxy) and added **`POST /compare`** proxy route using `upload.fields()` and `form-data` buffer streaming to FastAPI. |
| `server.js` | **Updated** | Registered DNS servers, configured CORS/JSON parsers, mounted `detection.js` under the `/api` route prefix, and initialized MongoDB database connection. |
| `models/Detection.js` | **Added/Updated** | Mongoose schema logging vehicle count, confidence scores, bounding boxes, and optional feature vectors. |
| `models/Vehicle.js` | **Added** | Mongoose schema storing unique vehicle profiles (`vehicleId`, 512-float `embedding`, camera location, timestamp). |

### 3. ⚛️ React Frontend (`/frontend`)

| File Name | Change Type | Description / Responsibility |
|------------|-------------|------------------------------|
| `src/Components/VehicleCompare.jsx` | **Added** | Cyber-themed dual upload UI featuring real-time image previews, an **interactive threshold slider (50%–95%)**, parameter inspection cards, and result metrics (Similarity, Confidence, Decision Margin). |
| `src/App.jsx` | **Updated** | Configured routing tree, protected operator routes, and mounted `VehicleCompare` under `/operator/reid-review` and `/operator/compare`. |

---

## 📡 API Reference Summary

### Express Backend Proxy (`http://localhost:5000`)

### 1. Compare Two Vehicle Images (Re-ID)

- **Endpoint:** `POST /api/compare`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `file1` → Image A
  - `file2` → Image B

**Response Sample**

```json
{
  "message": "Vehicle comparison completed successfully",
  "result": {
    "status": "success",
    "similarity": 0.7981,
    "similarityPercentage": "79.81%",
    "sameVehicle": true,
    "threshold": 0.75
  }
}
```

### 2. Process YOLO Vehicle Detection

- **Endpoint:** `POST /api/detect`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `file` → Image

---

## 🚀 How to Run the Project Locally

### 1. Start FastAPI ML Service

```bash
cd ml_service
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```

### 2. Start Express Backend

```bash
cd backend
npm install
npm run dev
```

### 3. Start React Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Verification Matrix

| Scenario | Tested Images | Similarity Score | Threshold | Output Decision |
|----------|---------------|-----------------|-----------|-----------------|
| **Same Vehicle** | Yellow Hatchback (Side) vs. Yellow Hatchback (Rear) | **79.81%** | 75% | ✅ `sameVehicle: true` |
| **Different Vehicles** | Yellow Hatchback vs. Black Pickup Truck | **33.18%** | 75% | ❌ `sameVehicle: false` |