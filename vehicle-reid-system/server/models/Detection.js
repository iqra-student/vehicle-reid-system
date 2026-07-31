const mongoose = require('mongoose');

const detectionSchema = new mongoose.Schema({
  filename: String,
  vehicleCount: Number,
  detections: [
    {
      className: String,
      confidence: Number,
      bbox: [Number], // [xmin, ymin, xmax, ymax]
      embedding: [Number], // 512-d OSNet feature vector (Optional for Re-ID)
      assignedVehicleId: String // e.g. "VEHICLE_101" after comparison
    }
  ],
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Detection', detectionSchema);