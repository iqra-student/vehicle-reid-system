const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  vehicleId: { 
    type: String, 
    required: true, 
    unique: true // e.g. "VEHICLE_101"
  },
  className: { 
    type: String, 
    required: true // e.g. "car", "bus", "truck"
  },
  embedding: { 
    type: [Number], 
    required: true // 512 floats from OSNet model
  },
  cropImagePath: { 
    type: String 
  },
  cameraLocation: { 
    type: String, 
    default: "Camera_1" 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Vehicle', vehicleSchema);