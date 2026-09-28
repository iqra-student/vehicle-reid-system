const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Congestion = require('../models/Congestion');

// Numbers from the Python engine; anything missing or not a number becomes null
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Optional: who is calling (used to record who dismissed an alert). Never blocks the request.
function optionalUserId(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return '';
  try {
    return String(jwt.verify(h.split(' ')[1], process.env.JWT_SECRET).id || '');
  } catch {
    return '';
  }
}

module.exports = (io) => {
  // POST /api/congestion/log (Called by Python CongestionEngine)
  router.post('/log', async (req, res) => {
    try {
      const b = req.body || {};

      const newLog = new Congestion({
        cameraId: b.cameraId,
        eventType: b.eventType,
        vehicleCount: b.vehicleCount,
        stationaryRatio: b.stationaryRatio,
        durationSec: b.durationSec,
        timestamp: b.timestamp,
        // New engine fields (previously dropped)
        congestionState: typeof b.congestionState === 'string' ? b.congestionState : '',
        congestionIndex: num(b.congestionIndex),
        speedRatio: num(b.speedRatio),
        densityRatio: num(b.densityRatio),
        occupancyPercentage: num(b.occupancyPercentage),
        freeFlowSpeed: num(b.freeFlowSpeed),
        reasoning: typeof b.reasoning === 'string' ? b.reasoning.slice(0, 500) : '',
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
  //   data        -> the latest alerts (default 20, ?limit= up to 200) for the lists/charts
  //   activeCount -> TRUE number of undismissed alerts in the database (not capped)
  router.get('/active', async (req, res) => {
    try {
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const [activeLogs, activeCount, totalCount] = await Promise.all([
        Congestion.find().sort({ createdAt: -1 }).limit(limit),
        Congestion.countDocuments({ resolved: false }),
        Congestion.countDocuments({}),
      ]);
      return res.status(200).json({ status: 'success', data: activeLogs, activeCount, totalCount });
    } catch (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // PATCH /api/congestion/resolve/:id (Dismiss button) — this route was missing
  router.patch('/resolve/:id', async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({ status: 'error', message: 'Invalid alert id' });
      }

      const updated = await Congestion.findByIdAndUpdate(
        req.params.id,
        { resolved: true, resolvedAt: new Date(), resolvedBy: optionalUserId(req) },
        { new: true }
      );

      if (!updated) {
        return res.status(404).json({ status: 'error', message: 'Alert not found' });
      }

      io.emit('congestion_resolved', { _id: updated._id });
      return res.status(200).json({ status: 'success', data: updated });
    } catch (err) {
      console.error('[Congestion Resolve Error]:', err);
      return res.status(500).json({ status: 'error', message: err.message });
    }
  });

  return router;
};