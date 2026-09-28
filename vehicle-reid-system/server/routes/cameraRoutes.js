// const express = require('express');
// const router = express.Router();
// const Camera = require('../models/Camera');
// const authMiddleware = require('../middleware/authMiddleware');
// const roleMiddleware = require('../middleware/roleMiddleware');

// // Protect ALL camera routes in this file with authMiddleware
// router.use(authMiddleware);

// // POST /api/cameras — operators submit (pending), admins submit (approved)
// router.post('/', roleMiddleware('operator', 'admin'), async (req, res) => {
//   try {
//     const camera = await Camera.create({
//       ...req.body,
//       submittedBy: req.user.id,
//       status: req.user.role === 'admin' ? 'approved' : 'pending',
//       reviewedBy: req.user.role === 'admin' ? req.user.id : undefined
//     });
//     res.status(201).json(camera);
//   } catch (err) {
//     res.status(500).json({ message: 'Error submitting camera', error: err.message });
//   }
// });

// // GET /api/cameras — Get live feeds based on user role
// router.get('/', async (req, res) => {
//   try {
//     if (req.user.role === 'admin') {
//       // Admins see ALL approved cameras
//       const cameras = await Camera.find({ status: 'approved' }).populate('submittedBy', 'name email role');
//       return res.json(cameras);
//     }

//     // Operators see ONLY approved cameras submitted by operators
//     const cameras = await Camera.find({ status: 'approved' })
//       .populate('submittedBy', 'name email role');

//     // Filter to ensure operators don't see admin-registered cameras
//     const operatorVisibleCameras = cameras.filter(cam => cam.submittedBy?.role !== 'admin');

//     res.json(operatorVisibleCameras);
//   } catch (err) {
//     res.status(500).json({ message: "Server error loading cameras", error: err.message });
//   }
// });

// // GET /api/cameras/pending — admin only, view queue
// router.get('/pending', roleMiddleware('admin'), async (req, res) => {
//   try {
//     const cameras = await Camera.find({ status: 'pending' }).populate('submittedBy', 'name email');
//     res.json(cameras);
//   } catch (err) {
//     res.status(500).json({ message: 'Error fetching pending cameras', error: err.message });
//   }
// });

// // PUT /api/cameras/:id/approve — admin only
// router.put('/:id/approve', roleMiddleware('admin'), async (req, res) => {
//   try {
//     const camera = await Camera.findByIdAndUpdate(
//       req.params.id,
//       { status: 'approved', reviewedBy: req.user.id },
//       { new: true }
//     );
//     if (!camera) return res.status(404).json({ message: 'Camera not found' });
//     res.json(camera);
//   } catch (err) {
//     res.status(500).json({ message: 'Error approving camera', error: err.message });
//   }
// });

// // PUT /api/cameras/:id/reject — admin only
// router.put('/:id/reject', roleMiddleware('admin'), async (req, res) => {
//   try {
//     const camera = await Camera.findByIdAndUpdate(
//       req.params.id,
//       { status: 'rejected', reviewedBy: req.user.id, rejectionReason: req.body.reason || '' },
//       { new: true }
//     );
//     if (!camera) return res.status(404).json({ message: 'Camera not found' });
//     res.json(camera);
//   } catch (err) {
//     res.status(500).json({ message: 'Error rejecting camera', error: err.message });
//   }
// });

// // DELETE /api/cameras/:id — admin only
// router.delete('/:id', roleMiddleware('admin'), async (req, res) => {
//   try {
//     const camera = await Camera.findByIdAndDelete(req.params.id);
//     if (!camera) return res.status(404).json({ message: 'Camera not found' });
//     res.json({ message: 'Camera deleted' });
//   } catch (err) {
//     res.status(500).json({ message: 'Error deleting camera', error: err.message });
//   }
// });

// module.exports = router;



const express = require('express');
const router = express.Router();
const Camera = require('../models/Camera');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// POST /api/cameras
router.post('/', roleMiddleware('operator', 'admin'), async (req, res) => {
  try {
    const created = await Camera.create({
      ...req.body,
      submittedBy: req.user.id,
      status: req.user.role === 'admin' ? 'approved' : 'pending',
      reviewedBy: req.user.role === 'admin' ? req.user.id : undefined
    });

    const camera = await Camera.findById(created._id).populate('submittedBy', 'name email role');

    const io = req.app.get('io');
    io.to(`user:${req.user.id}`).emit('camera_update', camera);
    if (camera.status === 'pending') io.to('admins').emit('camera_submitted', camera);

    res.status(201).json(camera);
  } catch (err) {
    res.status(500).json({ message: 'Error submitting camera', error: err.message });
  }
});

// GET /api/cameras/my-requests — the logged-in user's own submissions
router.get('/my-requests', roleMiddleware('operator', 'admin'), async (req, res) => {
  try {
    const cameras = await Camera.find({ submittedBy: req.user.id }).sort({ createdAt: -1 });
    res.json(cameras);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching your requests', error: err.message });
  }
});

// GET /api/cameras — live feeds
router.get('/', async (req, res) => {
  try {
    const cameras = await Camera.find({ status: 'approved' }).populate('submittedBy', 'name email role');
    if (req.user.role === 'admin') return res.json(cameras);
    res.json(cameras.filter((cam) => cam.submittedBy?.role !== 'admin'));
  } catch (err) {
    res.status(500).json({ message: 'Server error loading cameras', error: err.message });
  }
});

// GET /api/cameras/pending — admin only
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
      { status: 'approved', reviewedBy: req.user.id, rejectionReason: '' },
      { new: true }
    );
    if (!camera) return res.status(404).json({ message: 'Camera not found' });

    const io = req.app.get('io');
    io.to(`user:${camera.submittedBy}`).emit('camera_update', camera);
    io.to('admins').emit('camera_reviewed', camera._id);

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

    const io = req.app.get('io');
    io.to(`user:${camera.submittedBy}`).emit('camera_update', camera);
    io.to('admins').emit('camera_reviewed', camera._id);

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

    const io = req.app.get('io');
    io.to(`user:${camera.submittedBy}`).emit('camera_deleted', camera._id);
    io.to('admins').emit('camera_reviewed', camera._id);

    res.json({ message: 'Camera deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting camera', error: err.message });
  }
});

module.exports = router;