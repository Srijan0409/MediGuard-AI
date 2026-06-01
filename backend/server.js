const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const uploadRoutes = require('./routes/uploadRoutes');

// MongoDB Connection with SQLite fallback setup
const mongoURI = 'mongodb://127.0.0.1:27017/mediguard';
mongoose.connect(mongoURI)
    .then(() => {
        console.log("🍃 MongoDB connected successfully");
    })
    .catch(err => {
        console.warn("⚠️ MongoDB connection failed. Database operations will fall back to SQLite. Error:", err.message);
    });


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', uploadRoutes);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
