const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// ==========================================
// Route Imports & Mounting
// ==========================================
const authRoutes = require('./routes/authRoutes');
const cameraRoutes = require('./routes/cameraRoutes');
// Import detection and comparison routes
// (Make sure the path matches your filename: './routes/detection' or './routes/detectionRoutes')
const detectionRoutes = require('./routes/detectionRoutes'); 

app.use('/api/auth', authRoutes);
app.use('/api/cameras', cameraRoutes);

// Mount detection & compare routes under /api
// This enables both:
//   - POST http://localhost:5000/api/detect
//   - POST http://localhost:5000/api/compare
app.use('/api', detectionRoutes);

// ==========================================
// Connect DB & Start Server
// ==========================================
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));