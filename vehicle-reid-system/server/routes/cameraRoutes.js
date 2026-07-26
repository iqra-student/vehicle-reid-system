const express = require('express');
const router = express.Router();
const Camera = require('../models/Camera');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// POST /api/cameras — operators submit, status defaults to 'pending'
router.post('/', roleMiddleware('operator', 'admin'), async (req, res) => {
  try {
    const camera = await Camera.create({
      ...req.body,
      submittedBy: req.user.id,
      status: req.user.role === 'admin' ? 'approved' : 'pending',
      reviewedBy: req.user.role === 'admin' ? req.user.id : undefined
    });
    res.status(201).json(camera);
  } catch (err) {
    res.status(500).json({ message: 'Error submitting camera', error: err.message });
  }
});

// GET /api/cameras — everyone sees approved cameras only
router.get('/', async (req, res) => {
  try {
    const cameras = await Camera.find({ status: 'approved' });
    res.json(cameras);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cameras', error: err.message });
  }
});

// GET /api/cameras/pending — admin only, view queue
router.get('/pending', roleMiddleware('admin'), async (req, res) => {
  try {
    const cameras = await Camera.find({ status: 'pending' }).populate('submittedBy', 'name email');
    res.json(cameras);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching pending cameras', error: err.message });
  }
});

// PUT /api/cameras/:id/approve — admin only
router.put('/:id/approve', roleMiddleware('admin'), async (req, res) => {
  try {
    const camera = await Camera.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', reviewedBy: req.user.id },
      { new: true }
    );
    if (!camera) return res.status(404).json({ message: 'Camera not found' });
    res.json(camera);
  } catch (err) {
    res.status(500).json({ message: 'Error approving camera', error: err.message });
  }
});

// PUT /api/cameras/:id/reject — admin only
router.put('/:id/reject', roleMiddleware('admin'), async (req, res) => {
  try {
    const camera = await Camera.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', reviewedBy: req.user.id, rejectionReason: req.body.reason || '' },
      { new: true }
    );
    if (!camera) return res.status(404).json({ message: 'Camera not found' });
    res.json(camera);
  } catch (err) {
    res.status(500).json({ message: 'Error rejecting camera', error: err.message });
  }
});

// DELETE /api/cameras/:id — admin only
router.delete('/:id', roleMiddleware('admin'), async (req, res) => {
  try {
    const camera = await Camera.findByIdAndDelete(req.params.id);
    if (!camera) return res.status(404).json({ message: 'Camera not found' });
    res.json({ message: 'Camera deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting camera', error: err.message });
  }
});

module.exports = router;