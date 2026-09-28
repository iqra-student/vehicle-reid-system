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

// Folder that holds results_plates/<PLATE>/<image>.jpg
const RESULTS_ROOT = path.join(__dirname, "..", "ml_service");
const PLATE_ROOT = path.join(RESULTS_ROOT, "results_plates");

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

// True only if the image file really exists on disk
const fileExists = (webPath) =>
  !!webPath && fs.existsSync(path.join(RESULTS_ROOT, String(webPath).replace(/^\/+/, "")));

// Convert sightings to API trail, skipping sightings whose image is missing
const mapTrail = (sightings) =>
  (sightings || [])
    .filter((s) => fileExists(s.imageFilename))
    .map((s) => ({
      cameraId: s.cameraId,
      timestamp: s.timestamp,
      confidence: s.confidence,
      source: s.source,
      imageFilename: s.imageFilename,
      imageUrl: s.imageFilename,
    }));

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
  // Don't pollute the trail — just report it.
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
// MODULE 3.1 - 3.2 (IMAGE) — LICENSE PLATE DETECTION & TRACKING
// ============================================================
router.post("/plate-detect", upload.single("file"), async (req, res) => {
  let uploadedImagePath = null;

  try {
    const image = req.file;
    if (!image) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    uploadedImagePath = image.path;

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

    // Save the uploaded image into results_plates/<plate>/ so it is
    // served the same way as the video-tracking images.
    let trailResult = null;
    if (cleanPlate) {
      let savedWebPath = null;
      let savedPath = null;
      try {
        const plateDir = path.join(PLATE_ROOT, cleanPlate);
        fs.mkdirSync(plateDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 15);
        const safeCam = String(cameraId || "camera").replace(/[^A-Za-z0-9_\-]/g, "_");
        const savedName = `${ts}_${safeCam}.jpg`;
        savedPath = path.join(plateDir, savedName);
        fs.copyFileSync(image.path, savedPath);
        savedWebPath = `/results_plates/${cleanPlate}/${savedName}`;
      } catch (fsErr) {
        console.warn("Could not copy plate image:", fsErr.message);
      }

      trailResult = await recordPlateSighting({
        plateNumber: cleanPlate,
        cameraId,
        confidence,
        imageFilename: savedWebPath,
        detectionId: savedRecord._id,
      });
      console.log("Trail status:", trailResult.status);

      // Repeat on the same camera: nothing was added to the trail,
      // so remove the orphan image we just copied.
      if (trailResult.status === "SAME_CAMERA" && savedPath && fs.existsSync(savedPath)) {
        try {
          fs.unlinkSync(savedPath);
        } catch (e) {
          console.warn("Could not remove duplicate image:", e.message);
        }
      }
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
      trail: trailResult ? mapTrail(trailResult.trail) : [],
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

        // Only sightings whose image really exists
        const trail = mapTrail(sightings);

        return {
          plateNumber: v.plateNumber,
          firstSeen: trail[0]?.timestamp || null,
          lastSeen: trail[trail.length - 1]?.timestamp || null,
          totalSightings: trail.length,
          totalCameras: new Set(trail.map((s) => s.cameraId)).size,
          trail,
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

// ----------------------------------------------------------------
// Python ML service → write one sighting into Mongo
// ----------------------------------------------------------------
router.post("/plate/sighting", async (req, res) => {
  try {
    const {
      plateNumber, cameraId, timestamp, confidence,
      source, imageFilename, folder,
    } = req.body || {};

    if (!plateNumber) {
      return res.status(400).json({ error: "plateNumber required" });
    }

    const clean = String(imageFilename || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");
    const webPath = clean ? "/" + clean : null;

    await PlateVehicle.updateOne(
      { plateNumber },
      {
        $setOnInsert: { plateNumber, createdAt: new Date() },
        $set: { updatedAt: new Date() },
        $push: {
          sightings: {
            cameraId,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            confidence,
            source,
            imageFilename: webPath,
            folder,
          },
        },
      },
      { upsert: true }
    );

    res.json({ ok: true, imageFilename: webPath });
  } catch (err) {
    console.error("plate sighting save error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------
// Read one plate's trail
// ----------------------------------------------------------------
router.get("/plate/sighting/:plate", async (req, res) => {
  try {
    const plate = String(req.params.plate || "").toUpperCase();
    const cam = req.query.cameraId;

    const doc = await PlateVehicle.findOne({ plateNumber: plate });
    if (!doc) return res.status(404).json({ error: "not found" });

    let sightings = Array.isArray(doc.sightings) ? doc.sightings.slice() : [];
    if (cam) sightings = sightings.filter((s) => s.cameraId === cam);

    sightings.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const trail = mapTrail(sightings);

    const cams = new Set(trail.map((t) => t.cameraId));
    res.json({
      plateNumber: plate,
      totalSightings: trail.length,
      totalCameras: cams.size,
      firstSeen: trail[0]?.timestamp || null,
      lastSeen: trail[trail.length - 1]?.timestamp || null,
      trail,
    });
  } catch (err) {
    console.error("plate trail read error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------
// TEMPORARY: clears all plate history (DB + saved images)
// Open once in the browser, then DELETE THIS ROUTE.
// ----------------------------------------------------------------
router.get("/clear-history", async (req, res) => {
  try {
    await PlateVehicle.deleteMany({});
    await Detection.deleteMany({});

    if (fs.existsSync(PLATE_ROOT)) {
      for (const entry of fs.readdirSync(PLATE_ROOT)) {
        fs.rmSync(path.join(PLATE_ROOT, entry), { recursive: true, force: true });
      }
    }

    res.json({ ok: true, message: "All plate history and images deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;