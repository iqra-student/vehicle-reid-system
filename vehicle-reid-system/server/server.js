// const dns = require('dns');
// dns.setServers(['8.8.8.8', '1.1.1.1']);

// const express = require('express');
// const mongoose = require('mongoose');
// const cors = require('cors');
// require('dotenv').config();

// const app = express();

// // Middleware
// app.use(express.json());
// app.use(cors());

// // ==========================================
// // Route Imports & Mounting
// // ==========================================
// const authRoutes = require('./routes/authRoutes');
// const cameraRoutes = require('./routes/cameraRoutes');
// // Import detection and comparison routes
// // (Make sure the path matches your filename: './routes/detection' or './routes/detectionRoutes')
// const detectionRoutes = require('./routes/detectionRoutes');

// app.use('/api/auth', authRoutes);
// app.use('/api/cameras', cameraRoutes);

// // Mount detection & compare routes under /api
// // This enables both:
// //   - POST http://localhost:5000/api/detect
// //   - POST http://localhost:5000/api/compare
// app.use('/api', detectionRoutes);

// // ==========================================
// // Connect DB & Start Server
// // ==========================================
// const PORT = process.env.PORT || 5000;

// mongoose.connect(process.env.MONGO_URI)
//   .then(() => {
//     console.log('Connected to MongoDB successfully');
//     app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
//   })
//   .catch(err => console.error('MongoDB connection error:', err));

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ path: __dirname + '/.env' });
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
app.use(cors());

const ML_SERVICE_URL = 'http://127.0.0.1:8001';

// ==========================================
// Raw proxy to FastAPI — ONLY for routes that
// have no Node-side logic of their own (no Mongo
// save, no trail tracking). Everything that needs
// DB persistence or extra business logic lives in
// detectionRoutes.js instead, and must NOT be listed
// here, or this proxy will shadow it.
//
// NOTE: /api/plate-detect and /api/compare-videos
// are deliberately NOT in this list — they're handled
// by detectionRoutes.js (mounted below) so the Mongo
// save / recordPlateSighting trail logic actually runs.
// ==========================================
app.use(
  ['/api/compare', '/api/compare-video-streams'],
  createProxyMiddleware({
    target: ML_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path, req) => req.originalUrl,
    proxyTimeout: 20 * 60 * 1000,
    timeout: 20 * 60 * 1000,
    onError: (err, req, res) => {
      console.error('PROXY ERROR:', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: 'Proxy error', detail: err.message }));
    },
  })
);

app.use(express.json());

// ==========================================
// Route Imports & Mounting
// ==========================================
const authRoutes = require('./routes/authRoutes');
const cameraRoutes = require('./routes/cameraRoutes');
const detectionRoutes = require('./routes/detectionRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/cameras', cameraRoutes);

// Mounted AFTER the raw proxy — handles /api/plate-detect (with Mongo save
// + trail tracking), /api/search, and /api/compare-videos (video Re-ID
// with cleanup). None of these paths collide with the proxy list above.
app.use('/api', detectionRoutes);

// ==========================================
// Connect DB & Start Server
// ==========================================
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
    const server = app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    server.timeout = 20 * 60 * 1000;
    server.headersTimeout = 20 * 60 * 1000 + 1000;
    server.keepAliveTimeout = 20 * 60 * 1000;
  })
  .catch(err => console.error('MongoDB connection error:', err));
