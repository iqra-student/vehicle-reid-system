const express = require("express");
const axios = require("axios");
const multer = require("multer");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const Detection = require("../models/Detection");
const PlateVehicle = require("../models/PlateVehicle");
const Camera = require("../models/Camera");

const router = express.Router();

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: "uploads/" });

// How long (seconds) a repeated detection on the SAME camera is treated
// as the same continuous observation rather than a brand-new sighting.
const SAME_CAMERA_WINDOW_SECONDS = 120;

// ------------------------------------------------------------------
// Core trail logic (Module 3.3): one plate -> many sightings
// ------------------------------------------------------------------
async function recordPlateSighting({ plateNumber, cameraId, confidence, imageFilename, detectionId, sightingTime }) {
  let vehicle = await PlateVehicle.findOne({ plateNumber });
  const now = sightingTime || new Date();

  // First time this plate has ever been seen
  if (!vehicle) {
    vehicle = await PlateVehicle.create({
      plateNumber,
      sightings: [{ cameraId, confidence, imageFilename, detectionId, timestamp: now }],
    });
    return { status: "NEW", vehicle, trail: vehicle.sightings };
  }

  const lastSighting = vehicle.sightings[vehicle.sightings.length - 1];
  const secondsSinceLast = lastSighting
    ? (now - new Date(lastSighting.timestamp)) / 1000
    : Infinity;

  const isSameCamera = lastSighting && lastSighting.cameraId === cameraId;
  const withinWindow = secondsSinceLast <= SAME_CAMERA_WINDOW_SECONDS;

  // Repeated frame on the same camera, still within the observation window.
  // Don't pollute the trail G�� just report it.
  if (isSameCamera && withinWindow) {
    return {
      status: "SAME_CAMERA",
      vehicle,
      trail: vehicle.sightings,
      lastSighting,
    };
  }

  // Genuinely new sighting: different camera, OR same camera after a long gap
  // (vehicle left and came back)
  vehicle.sightings.push({ cameraId, confidence, imageFilename, detectionId, timestamp: now });
  await vehicle.save();

  return {
    status: isSameCamera ? "RETURN_SAME_CAMERA" : "NEW_CAMERA_SIGHTING",
    vehicle,
    trail: vehicle.sightings,
    previousSighting: lastSighting,
  };
}

// ============================================================
// MODULE 3.1 - 3.2 (IMAGE) G�� LICENSE PLATE DETECTION & TRACKING
//
// Route renamed from "/plate-detect-image" to "/plate-detect" to match
// what the frontend (PlateSearchPage.jsx) actually calls via
// axiosInstance.post(`/plate-detect`, ...). It was previously unreachable
// because server.js proxied "/api/plate-detect" straight to the ML
// service, bypassing this file entirely.
//
// multer field renamed from "image" to "file" G�� the frontend's FormData
// appends the upload under the key "file" (formData.append("file", ...)),
// so upload.single("image") was always leaving req.file undefined.
// ============================================================
router.post("/plate-detect", upload.single("file"), async (req, res) => {
  let uploadedImagePath = null;

  try {
    const image = req.file;
    if (!image) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    uploadedImagePath = image.path;

    // Frontend sends this field as "camera_id" (matches FastAPI's Form
    // field name), not "cameraId" G�� check both so neither naming silently
    // falls through to "unknown".
    const cameraId = req.body.camera_id?.trim() || req.body.cameraId?.trim() || "unknown";

    let cameraRegistered = null;
    try {
      const cam = await Camera.findOne({ name: cameraId, status: "approved" });
      cameraRegistered = !!cam;
    } catch (camErr) {
      console.warn("Camera lookup failed:", camErr.message);
    }

    console.log("========================================");
    console.log("MODULE 3 DETECTION REQUEST");
    console.log("Image Original Name:", image.originalname);
    console.log("Camera Location ID:", cameraId, "| Registered:", cameraRegistered);
    console.log("========================================");

    const formData = new FormData();
    formData.append("file", fs.createReadStream(image.path), {
      filename: image.originalname,
      contentType: image.mimetype,
    });
    formData.append("camera_id", cameraId);


    const response = await axios.post(
      "http://127.0.0.1:8000/api/plate-detect",
      formData,
      {
        headers: { ...formData.getHeaders() },
        timeout: 120000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const mlData = response.data || {};
    const firstDetection =
      Array.isArray(mlData.results) && mlData.results.length > 0
        ? mlData.results[0]
        : mlData;

    const rawPlateText = firstDetection.plate_text || mlData.plate_text || null;
    const confidence = firstDetection.confidence ?? mlData.confidence ?? 0;
    const bbox = firstDetection.plate_box || firstDetection.bbox || mlData.bbox || null;
    const plateType = firstDetection.plate_type || mlData.plate_type || null;
    const selectedModel = firstDetection.selected_model || mlData.selected_model || null;

    const cleanPlate =
      rawPlateText && rawPlateText !== "UNKNOWN"
        ? String(rawPlateText).toUpperCase().replace(/[^A-Z0-9]/g, "")
        : null;

    console.log("Normalized Plate Text:", cleanPlate, "| Confidence:", confidence);

    const savedRecord = await Detection.create({
      filename: image.originalname,
      cameraId: cameraId,
      vehicleCount: 1,
      plates: cleanPlate
        ? [
            {
              trackId: "single_image",
              plateText: cleanPlate,
              plateConfidence: confidence,
              plateType: plateType,
              selectedModel: selectedModel,
              timestampSec: Math.floor(Date.now() / 1000),
            },
          ]
        : [],
    });

    let trailResult = null;
    if (cleanPlate) {
      trailResult = await recordPlateSighting({
        plateNumber: cleanPlate,
        cameraId,
        confidence,
        imageFilename: image.originalname,
        detectionId: savedRecord._id,
      });
      console.log("Trail status:", trailResult.status);
    }

    return res.json({
      status: "success",
      plate_text: cleanPlate,
      confidence: confidence,
      bbox: bbox,
      plate_type: plateType,
      selected_model: selectedModel,
      cameraRegistered,
      matchStatus: trailResult ? trailResult.status : "NEW",
      previousSighting: trailResult?.previousSighting || trailResult?.lastSighting || null,
      trail: trailResult
        ? trailResult.trail.map((s) => ({
            cameraId: s.cameraId,
            timestamp: s.timestamp,
            confidence: s.confidence,
          }))
        : [],
      savedRecordId: savedRecord._id,
    });
  } catch (error) {
    console.error("MODULE 3 DETECTION ERROR:", error.message);
    if (error.response) {
      console.error("FastAPI Status:", error.response.status, error.response.data);
    } else if (error.request) {
      console.error("FastAPI Server Unreachable at http://127.0.0.1:8000");
    }

    return res.status(500).json({
      error:
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        "Failed to process license plate detection",
      mlStatus: error.response?.status || null,
    });
  } finally {
    if (uploadedImagePath && fs.existsSync(uploadedImagePath)) {
      try {
        fs.unlinkSync(uploadedImagePath);
      } catch (cleanupErr) {
        console.error("Failed to delete temp file:", cleanupErr.message);
      }
    }
  }
});

// ============================================================
// MODULE 3.4 - VEHICLE SEARCH BY LICENSE PLATE & CAMERA
// ============================================================
router.get("/search", async (req, res) => {
  try {
    const { plate, cameraId } = req.query;

    if (!plate) {
      return res.status(400).json({ error: "plate query parameter is required" });
    }

    const cleanPlate = String(plate).toUpperCase().replace(/[^A-Z0-9]/g, "");

    const vehicles = await PlateVehicle.find({
      plateNumber: { $regex: cleanPlate, $options: "i" },
    }).sort({ updatedAt: -1 });

    const cameraFilter = cameraId && cameraId.trim() !== "" ? cameraId.trim().toLowerCase() : null;

    const results = vehicles
      .map((v) => {
        let sightings = [...v.sightings].sort(
          (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
        );

        if (cameraFilter) {
          sightings = sightings.filter((s) => s.cameraId.toLowerCase().includes(cameraFilter));
        }

        return {
          plateNumber: v.plateNumber,
          firstSeen: sightings[0]?.timestamp || null,
          lastSeen: sightings[sightings.length - 1]?.timestamp || null,
          totalSightings: sightings.length,
          totalCameras: new Set(sightings.map((s) => s.cameraId)).size,
          trail: sightings.map((s) => ({
            cameraId: s.cameraId,
            timestamp: s.timestamp,
            confidence: s.confidence,
          })),
        };
      })
      .filter((r) => r.trail.length > 0);

    return res.json({
      status: "success",
      query: cleanPlate,
      matchCount: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in plate search route:", error.message);
    return res.status(500).json({ error: "Failed to search plates: " + error.message });
  }
});


module.exports = router;
