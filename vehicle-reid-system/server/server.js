const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const jwt = require('jsonwebtoken');

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');                                    // ---- NEW
require('dotenv').config({ path: __dirname + '/.env' });
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // invalid token: stays anonymous
    }
  }
  next();
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  if (socket.user) {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'admin') socket.join('admins');
  }

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});
app.use(cors());

const ML_SERVICE_URL = 'http://127.0.0.1:8000';

app.use(
  [
    '/api/plate-track-sample',
    '/api/plate-track-status',
    '/api/plate-track-result',
    '/api/plate-track',
  ],
  createProxyMiddleware({
    target: ML_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (_path, req) => req.originalUrl,
    proxyTimeout: 20 * 60 * 1000,
    timeout: 20 * 60 * 1000,
    on: {
      error: (err, req, res) => {
        console.error('PROXY ERROR:', err.message);

        if (!res || typeof res.writeHead !== 'function') {
          return;
        }

        if (!res.headersSent) {
          res.writeHead(502, {
            'Content-Type': 'application/json',
          });
        }

        res.end(
          JSON.stringify({
            error: 'ML service unreachable',
            detail:
              err.code === 'ECONNREFUSED'
                ? `Nothing is listening at ${ML_SERVICE_URL}. Start ml_service/main.py on that port.`
                : err.message,
          })
        );
      },
    },
  })
);

app.use(express.json());

// ---- UPDATED: serve plate images ----
// Image-mode uploads are saved by detectionRoutes.js into
//   <backend>/ml_service/results_plates
// Video-tracking images written by the Python service may live in
//   <backend>/../ml_service/results_plates
// Both folders are served under /results_plates; Express checks the first,
// and falls through to the second if the file is not found.
app.use(
  '/results_plates',
  express.static(path.join(__dirname, 'ml_service', 'results_plates'))
);
app.use(
  '/results_plates',
  express.static(path.join(__dirname, '..', 'ml_service', 'results_plates'))
);

// ==========================================
// Route Imports & Mounting
// ==========================================
const authRoutes = require('./routes/authRoutes');
const cameraRoutes = require('./routes/cameraRoutes');
const detectionRoutes = require('./routes/detectionRoutes');
const adminUserRoutes = require("./routes/adminUsers");
const adminPlateRoutes = require("./routes/adminPlates");
const auditRoutes = require("./routes/auditRoutes"); 

// Module 4 - Congestion Detection
const congestionRoutes = require('./routes/congestionRoutes')(io);

app.use('/api/auth', authRoutes);
app.use('/api/cameras', cameraRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin", adminPlateRoutes);
app.use("/api/audit", auditRoutes); 

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