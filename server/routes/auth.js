// routes/auth.js — signup & login for users and admins
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { getDb, run, get } = require('../db');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cybershield_secret_2025';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'CYBER@ADMIN2025';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// ── Validation helpers ────────────────────────────────────────────────────────
function validatePhone(raw) {
  let p = raw.replace(/[\s\-\(\)]/g, '');
  if (p.startsWith('+91')) p = p.slice(3);
  else if (p.startsWith('91') && p.length === 12) p = p.slice(2);
  if (!/^\d{10}$/.test(p)) return null;
  if (!/^[6-9]/.test(p)) return null;
  return p;
}

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { role = 'user', username, phone, email, password, name, secret } = req.body;
    const db = await getDb();

    if (role === 'admin') {
      // Admin signup
      if (!name || !email || !phone || !password || !secret)
        return res.status(400).json({ error: 'All fields are required.' });
      if (secret !== ADMIN_SECRET)
        return res.status(400).json({ error: 'Invalid secret code.' });
      if (get(db, 'SELECT id FROM admins WHERE email = ?', [email]))
        return res.status(409).json({ error: 'An admin account with this email already exists.' });

      const cleanPhone = validatePhone(phone);
      if (!cleanPhone) return res.status(400).json({ error: 'Invalid phone number.' });

      const hash = await bcrypt.hash(password, 10);
      run(db, 'INSERT INTO admins (name, email, phone, password) VALUES (?, ?, ?, ?)',
        [name.trim(), email.trim().toLowerCase(), cleanPhone, hash]);

      const admin = get(db, 'SELECT id, name, email, phone FROM admins WHERE email = ?', [email.trim().toLowerCase()]);
      const token = makeToken({ id: admin.id, name: admin.name, email: admin.email, role: 'admin' });
      return res.json({ token, role: 'admin', name: admin.name, email: admin.email });

    } else {
      // User signup
      if (!username || !phone || !email || !password)
        return res.status(400).json({ error: 'All fields are required.' });
      if (get(db, 'SELECT id FROM users WHERE username = ?', [username]))
        return res.status(409).json({ error: 'Username already taken.' });
      if (get(db, 'SELECT id FROM users WHERE email = ?', [email]))
        return res.status(409).json({ error: 'An account with this email already exists.' });

      const cleanPhone = validatePhone(phone);
      if (!cleanPhone) return res.status(400).json({ error: 'Invalid phone number.' });

      const hash = await bcrypt.hash(password, 10);
      run(db, 'INSERT INTO users (username, phone, email, password) VALUES (?, ?, ?, ?)',
        [username.trim(), cleanPhone, email.trim().toLowerCase(), hash]);

      const user = get(db, 'SELECT id, username, email FROM users WHERE email = ?', [email.trim().toLowerCase()]);
      const token = makeToken({ id: user.id, username: user.username, email: user.email, role: 'user' });
      return res.json({ token, role: 'user', username: user.username, email: user.email });
    }
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { role = 'user', username, email, password, name, secret } = req.body;
    const db = await getDb();

    if (role === 'admin') {
      if (!name || !email || !password || !secret)
        return res.status(400).json({ error: 'All fields are required.' });
      if (secret !== ADMIN_SECRET)
        return res.status(400).json({ error: 'Invalid secret code.' });

      const admin = get(db, 'SELECT * FROM admins WHERE email = ?', [email.trim().toLowerCase()]);
      if (!admin) return res.status(401).json({ error: 'Invalid admin credentials.' });
      if (admin.name.toLowerCase() !== name.trim().toLowerCase())
        return res.status(401).json({ error: 'Invalid admin credentials.' });

      const match = await bcrypt.compare(password, admin.password);
      if (!match) return res.status(401).json({ error: 'Invalid admin credentials.' });

      const token = makeToken({ id: admin.id, name: admin.name, email: admin.email, role: 'admin' });
      return res.json({ token, role: 'admin', name: admin.name, email: admin.email });

    } else {
      if (!username || !email || !password)
        return res.status(400).json({ error: 'All fields are required.' });

      const user = get(db, 'SELECT * FROM users WHERE username = ? AND email = ?',
        [username.trim(), email.trim().toLowerCase()]);
      if (!user) return res.status(401).json({ error: 'Invalid credentials. Please check your details.' });

      const match = await bcrypt.compare(password, user.password);
      if (!match) return res.status(401).json({ error: 'Invalid credentials. Please check your details.' });

      const token = makeToken({ id: user.id, username: user.username, email: user.email, role: 'user' });
      return res.json({ token, role: 'user', username: user.username, email: user.email });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
