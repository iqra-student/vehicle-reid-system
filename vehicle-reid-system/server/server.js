const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config({ path: __dirname + '/.env' });
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();

// ==========================================
// HTTP Server & Socket.io Setup
// ==========================================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(express.json());
app.use(cors());

const ML_SERVICE_URL = 'http://127.0.0.1:8001';

// ==========================================
// Raw proxy to FastAPI
// ==========================================
// ONLY for routes that have no Node-side logic
// of their own.
//
// /api/plate-detect and /api/compare-videos are
// deliberately NOT in this list because they are
// handled by detectionRoutes.js.
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
        res.writeHead(502, {
          'Content-Type': 'application/json',
        });
      }

      res.end(
        JSON.stringify({
          error: 'Proxy error',
          detail: err.message,
        })
      );
    },
  })
);

// ==========================================
// Route Imports & Mounting
// ==========================================
const authRoutes = require('./routes/authRoutes');
const cameraRoutes = require('./routes/cameraRoutes');
const detectionRoutes = require('./routes/detectionRoutes');

// Module 4 - Congestion Detection
const congestionRoutes = require('./routes/congestionRoutes')(io);

app.use('/api/auth', authRoutes);
app.use('/api/cameras', cameraRoutes);

// Module 3 / vehicle detection / comparison routes
app.use('/api', detectionRoutes);

// Module 4 congestion routes
app.use('/api/congestion', congestionRoutes);

// ==========================================
// Connect DB & Start Server
// ==========================================
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    server.timeout = 20 * 60 * 1000;
    server.headersTimeout = 20 * 60 * 1000 + 1000;
    server.keepAliveTimeout = 20 * 60 * 1000;
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });