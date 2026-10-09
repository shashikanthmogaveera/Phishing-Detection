// routes/contact.js — save contact messages to DB
const express = require('express');
const { getDb, run } = require('../db');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message)
      return res.status(400).json({ error: 'All fields are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Invalid email address.' });

    const db = await getDb();
    run(db, 'INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), message.trim()]);

    res.json({ success: true, message: 'Message received. We\'ll respond within 24 hours.' });
  } catch (err) {
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
