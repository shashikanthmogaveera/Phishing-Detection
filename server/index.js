// server/index.js — CyberShield AI Backend
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const authRoutes       = require('./routes/auth');
const detectionRoutes  = require('./routes/detections');
const adminRoutes      = require('./routes/admin');
const contactRoutes    = require('./routes/contact');
const chatRoutes       = require('./routes/chat');
const blocklistRoutes  = require('./routes/blocklist');
const supportRoutes    = require('./routes/support');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000',
           'http://localhost:5500', 'http://127.0.0.1:5500',
           'http://localhost:5501', 'http://127.0.0.1:5501',
           'null'],   // file:// origin
  credentials: true
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Serve frontend static files ───────────────────────────────────────────────
const FRONTEND = path.join(__dirname, '..');
app.use(express.static(FRONTEND));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/detections', detectionRoutes);
app.use('/api/admin',      adminRoutes);
app.use('/api/contact',    contactRoutes);
app.use('/api/chat',       chatRoutes);
app.use('/api/blocklist',  blocklistRoutes);
app.use('/api/support',    supportRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ── Catch-all: serve index.html for any non-API route ────────────────────────
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(FRONTEND, 'index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found.' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  CyberShield AI Server running at http://localhost:${PORT}`);
  console.log(`  Frontend served at  http://localhost:${PORT}/index.html`);
  console.log(`  API base:           http://localhost:${PORT}/api\n`);
});
