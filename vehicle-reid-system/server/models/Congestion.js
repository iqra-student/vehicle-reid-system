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

  // ---- Sent by the congestion engine (all optional, so older alerts stay valid) ----
  congestionState: { type: String, default: '' },     // "Congested" | "Blocked"
  congestionIndex: { type: Number, default: null },    // CI, 0–1
  speedRatio: { type: Number, default: null },         // R, 0–1
  densityRatio: { type: Number, default: null },       // Dn, 0–1
  occupancyPercentage: { type: Number, default: null },
  freeFlowSpeed: { type: Number, default: null },
  reasoning: { type: String, default: '' },

  resolved: {
    type: Boolean,
    default: false,
    index: true,
  },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: String, default: '' },           // user id of whoever dismissed it

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Congestion', CongestionSchema);