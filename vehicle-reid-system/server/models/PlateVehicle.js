const mongoose = require('mongoose');

const sightingSchema = new mongoose.Schema({
  cameraId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  confidence: { type: Number, default: 0 },
  imageFilename: String,
  detectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Detection' }
}, { _id: false });

const plateVehicleSchema = new mongoose.Schema({
  plateNumber: { type: String, required: true, unique: true, index: true },
  sightings: { type: [sightingSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('PlateVehicle', plateVehicleSchema);
