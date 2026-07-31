import os
import sys
import shutil
import torch
import torch.nn.functional as F
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Add the official Torchreid repository to Python's search path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "deep-person-reid"))

from torchreid.utils import FeatureExtractor

app = FastAPI()

# Enable CORS so your React app can hit these endpoints from localhost:3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your trained OSNet model
extractor = FeatureExtractor(
    model_name="osnet_x1_0",
    model_path="weights/model.pth",   # Path to your saved weights
    device="cpu"                      # Change to "cuda" if using GPU
)


@app.post("/extract-feature")
async def extract_feature(file: UploadFile = File(...)):
    temp_path = f"temp_{file.filename}"

    # Save uploaded image
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Extract feature vector
        features = extractor(temp_path)

        # Convert tensor to JSON-serializable list
        embedding = features.cpu().numpy().flatten().tolist()

        return {
            "status": "success",
            "embedding": embedding
        }

    finally:
        # Remove temporary file
        if os.path.exists(temp_path):
            os.remove(temp_path)


@app.post("/compare")
async def compare_vehicles(file1: UploadFile = File(...), file2: UploadFile = File(...)):
    path1 = f"temp_1_{file1.filename}"
    path2 = f"temp_2_{file2.filename}"

    # Save both uploaded images temporarily
    with open(path1, "wb") as buffer1:
        shutil.copyfileobj(file1.file, buffer1)
    with open(path2, "wb") as buffer2:
        shutil.copyfileobj(file2.file, buffer2)

    try:
        # Extract feature vectors (PyTorch Tensors)
        features1 = extractor(path1)  # Tensor of shape [1, 512]
        features2 = extractor(path2)  # Tensor of shape [1, 512]

        # Calculate Cosine Similarity via PyTorch
        similarity_tensor = F.cosine_similarity(features1, features2)
        similarity_score = float(similarity_tensor.item())

        # Ensure no negative lower bound for UI output display
        similarity_score = max(0.0, similarity_score)

        # Similarity Threshold for Re-ID matching
        THRESHOLD = 0.75
        is_same_vehicle = similarity_score >= THRESHOLD

        return {
            "status": "success",
            "similarity": round(similarity_score, 4),
            "similarityPercentage": f"{round(similarity_score * 100, 2)}%",
            "sameVehicle": is_same_vehicle,
            "threshold": THRESHOLD
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        # Clean up temporary files
        for temp_file in [path1, path2]:
            if os.path.exists(temp_file):
                os.remove(temp_file)