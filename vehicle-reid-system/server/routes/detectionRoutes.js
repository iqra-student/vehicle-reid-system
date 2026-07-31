const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const Detection = require('../models/Detection');

// Memory storage for temporary upload buffers
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// 1. EXISTING ROUTE: Object Detection (YOLO)
// ==========================================
router.post('/detect', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Prepare form data for FastAPI
    const formData = new FormData();
    formData.append('file', req.file.buffer, req.file.originalname);

    // Call FastAPI YOLO endpoint
    const mlResponse = await axios.post('http://localhost:8000/detect', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    const mlData = mlResponse.data;

    // Save detection record into MongoDB
    const newDetection = new Detection({
      filename: mlData.filename,
      vehicleCount: mlData.vehicle_count,
      detections: mlData.detections.map(d => ({
        className: d.class_name,
        confidence: d.confidence,
        bbox: d.bbox
      }))
    });

    await newDetection.save();

    // Return result to React client
    res.status(200).json({
      message: 'Detection processed and saved successfully',
      savedRecord: newDetection
    });

  } catch (error) {
    console.error('Error in detection pipeline:', error.message);
    res.status(500).json({ message: 'Detection service failed', error: error.message });
  }
});

// ==========================================
// 2. NEW ROUTE: Vehicle Re-ID Comparison (OSNet)
// ==========================================
router.post('/compare', upload.fields([{ name: 'file1', maxCount: 1 }, { name: 'file2', maxCount: 1 }]), async (req, res) => {
  try {
    // Validate that both files were uploaded
    if (!req.files || !req.files.file1 || !req.files.file2) {
      return res.status(400).json({ message: 'Please upload both file1 and file2 images.' });
    }

    const file1 = req.files.file1[0];
    const file2 = req.files.file2[0];

    // Prepare multipart form-data with buffers
    const formData = new FormData();
    formData.append('file1', file1.buffer, file1.originalname);
    formData.append('file2', file2.buffer, file2.originalname);

    // Proxy request to FastAPI /compare endpoint
    const mlResponse = await axios.post('http://localhost:8000/compare', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    // Return FastAPI comparison response (similarity score & sameVehicle flag) directly to React
    res.status(200).json({
      message: 'Vehicle comparison completed successfully',
      result: mlResponse.data
    });

  } catch (error) {
    console.error('Error in vehicle comparison route:', error.message);
    res.status(500).json({ message: 'Vehicle comparison service failed', error: error.message });
  }
});

module.exports = router;