const mongoose = require('mongoose');

const detectionSchema = new mongoose.Schema({
  filename: String,
  vehicleCount: Number,
  detections: [
    {
      className: String,
      confidence: Number,
      bbox: [Number] // [xmin, ymin, xmax, ymax]
    }
  ],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Detection', detectionSchema);