const mongoose = require('mongoose');

const CongestionSchema = new mongoose.Schema({
  cameraId: {
    type: String,
    required: true,
    index: true,
  },
  eventType: {
    type: String,
    default: 'GRIDLOCK_CONGESTION',
  },
  vehicleCount: {
    type: Number,
    required: true,
  },
  stationaryRatio: {
    type: Number,
    required: true,
  },
  durationSec: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Number,
    required: true,
  },
  resolved: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Congestion', CongestionSchema);