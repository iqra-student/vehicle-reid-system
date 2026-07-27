const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const Detection = require('../models/Detection');

// Memory storage for temporary upload buffer
const upload = multer({ storage: multer.memoryStorage() });

router.post('/detect', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // 1. Prepare form data to send to FastAPI
    const formData = new FormData();
    formData.append('file', req.file.buffer, req.file.originalname);

    // 2. Call FastAPI ML service on port 8000
    const mlResponse = await axios.post('http://localhost:8000/detect', formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    const mlData = mlResponse.data;

    // 3. Save detection record into MongoDB
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

    // 4. Return result to React client
    res.status(200).json({
      message: 'Detection processed and saved successfully',
      savedRecord: newDetection
    });

  } catch (error) {
    console.error('Error in detection pipeline:', error.message);
    res.status(500).json({ message: 'Detection service failed', error: error.message });
  }
});

module.exports = router;