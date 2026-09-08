const express = require('express');
const router = express.Router();
const Congestion = require('../models/Congestion');

module.exports = (io) => {
  // POST /api/congestion/log (Called by Python CongestionEngine)
  router.post('/log', async (req, res) => {
    try {
      const { cameraId, eventType, vehicleCount, stationaryRatio, durationSec, timestamp } = req.body;

      const newLog = new Congestion({
        cameraId,
        eventType,
        vehicleCount,
        stationaryRatio,
        durationSec,
        timestamp,
      });

      const savedLog = await newLog.save();

      // Real-time broadcast to connected React clients
      io.emit('congestion_alert', savedLog);

      return res.status(201).json({ status: 'success', data: savedLog });
    } catch (err) {
      console.error('[Congestion Route Error]:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // GET /api/congestion/active (Fetched by React dashboard on load)
  router.get('/active', async (req, res) => {
    try {
      const activeLogs = await Congestion.find().sort({ createdAt: -1 }).limit(20);
      return res.status(200).json({ status: 'success', data: activeLogs });
    } catch (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

  return router;
};