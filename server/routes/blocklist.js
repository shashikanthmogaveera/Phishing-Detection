// routes/blocklist.js — User Blocking System (platform-level blacklist)
const express = require('express');
const { getDb, run, all, get, insert } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// ── Input type detection ──────────────────────────────────────────────────────
function detectInputType(value) {
  const v = value.trim();
  if (/^[\+]?[\d\s\-\(\)]{7,15}$/.test(v))                    return 'phone';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))                   return 'email';
  if (/^https?:\/\//.test(v) || /^[\w\-]+\.[a-z]{2,}/.test(v)) return 'domain';
  return 'account';
}

// ── Normalize value for consistent storage ────────────────────────────────────
function normalize(value, type) {
  const v = value.trim();
  if (type === 'phone') {
    let p = v.replace(/[\s\-\(\)]/g, '');
    if (p.startsWith('+91')) p = p.slice(3);
    else if (p.startsWith('91') && p.length === 12) p = p.slice(2);
    return p;
  }
  if (type === 'email')  return v.toLowerCase();
  if (type === 'domain') return v.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return v.toLowerCase();
}

// ── POST /api/blocklist — block a sender ──────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { value, label } = req.body;
    if (!value || !value.trim()) return res.status(400).json({ error: 'Sender value is required.' });

    const type       = detectInputType(value);
    const normalized = normalize(value, type);
    const db         = await getDb();

    // Check duplicate
    const existing = get(db,
      'SELECT id FROM blocked_senders WHERE user_id=? AND user_type=? AND normalized_value=?',
      [req.user.id, req.user.role, normalized]
    );
    if (existing) {
      return res.status(409).json({ error: 'This sender is already in your blacklist.', already_blocked: true });
    }

    const id = insert(db,
      'INSERT INTO blocked_senders (user_id, user_type, value, normalized_value, type, label) VALUES (?,?,?,?,?,?)',
      [req.user.id, req.user.role, value.trim(), normalized, type, (label || '').slice(0, 100)]
    );

    res.json({ success: true, id, type, normalized_value: normalized });
  } catch (err) {
    console.error('Block sender error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/blocklist — get user's full blacklist ────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const rows = all(db,
      'SELECT id, value, normalized_value, type, label, created_at FROM blocked_senders WHERE user_id=? AND user_type=? ORDER BY created_at DESC',
      [req.user.id, req.user.role]
    );
    res.json({ blocked: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── POST /api/blocklist/check — check if a value is blocked ──────────────────
// Connection 5: Checks BOTH user blacklist AND admin global blacklist
router.post('/check', requireAuth, async (req, res) => {
  try {
    const { value } = req.body;
    if (!value) return res.json({ blocked: false });

    const type       = detectInputType(value);
    const normalized = normalize(value, type);
    const db         = await getDb();

    // Check user's personal blacklist
    const userRow = get(db,
      'SELECT id, value, type, label, created_at FROM blocked_senders WHERE user_id=? AND user_type=? AND normalized_value=?',
      [req.user.id, req.user.role, normalized]
    );
    if (userRow) return res.json({ blocked: true, entry: userRow, source: 'user' });

    // Connection 5: Also check admin-promoted global blacklist entries
    const adminRow = get(db,
      "SELECT id, value, type, label, created_at FROM blocked_senders WHERE user_type='admin' AND normalized_value=?",
      [normalized]
    );
    if (adminRow) {
      // Increment hit counter in intelligence_events
      const { insert: ins } = require('../db');
      try {
        ins(db,
          `INSERT INTO intelligence_events (event_type, entity_type, entity_id, verdict_after, actor, meta, created_at)
           VALUES ('BLACKLIST_HIT','blocked_sender',?,?,'system',?,?)`,
          [adminRow.id, 'BLOCKED',
           JSON.stringify({ value: adminRow.value, matched_by: req.user.id }),
           new Date().toISOString()]
        );
      } catch {}
      return res.json({ blocked: true, entry: adminRow, source: 'global', is_global: true });
    }

    res.json({ blocked: false });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── DELETE /api/blocklist/:id — unblock a sender ─────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    run(db,
      'DELETE FROM blocked_senders WHERE id=? AND user_id=? AND user_type=?',
      [req.params.id, req.user.id, req.user.role]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── DELETE /api/blocklist — clear entire blacklist ────────────────────────────
router.delete('/', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    run(db,
      'DELETE FROM blocked_senders WHERE user_id=? AND user_type=?',
      [req.user.id, req.user.role]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
