// routes/support.js — Support & Threat Reporting Center
const express = require('express');
const { getDb, run, all, get, insert } = require('../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateTicketId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return 'CYB-' + num;
}

// Store timestamps as ISO 8601 with local offset so grouping works correctly
function nowISO() {
  return new Date().toISOString();
}

function detectPriority(subject, description) {
  const text = ((subject || '') + ' ' + (description || '')).toLowerCase();
  const criticalWords = ['phishing', 'bank', 'otp', 'fraud', 'critical', 'hacked', 'stolen', 'breach', 'ransomware'];
  const highWords = ['urgent', 'malware', 'virus', 'attack', 'suspicious url', 'scam', 'identity'];
  const mediumWords = ['wrong', 'incorrect', 'prediction', 'false positive', 'false negative', 'inaccurate'];
  if (criticalWords.some(w => text.includes(w))) return 'Critical';
  if (highWords.some(w => text.includes(w))) return 'High';
  if (mediumWords.some(w => text.includes(w))) return 'Medium';
  return 'Low';
}

// ── POST /api/support/tickets — create ticket ─────────────────────────────────
router.post('/tickets', requireAuth, async (req, res) => {
  try {
    const { subject, category, priority, description, detection_data } = req.body;

    if (!subject || !subject.trim()) return res.status(400).json({ error: 'Subject is required.' });
    if (!description || !description.trim()) return res.status(400).json({ error: 'Description is required.' });

    const db = await getDb();

    // Generate unique ticket_id
    let ticket_id;
    let attempts = 0;
    do {
      ticket_id = generateTicketId();
      const existing = get(db, 'SELECT id FROM support_tickets WHERE ticket_id=?', [ticket_id]);
      if (!existing) break;
      attempts++;
    } while (attempts < 20);

    const autoPriority = priority || detectPriority(subject, description);
    const finalCategory = category || 'General Support';

    let detectionDataStr = null;
    if (detection_data) {
      try {
        detectionDataStr = typeof detection_data === 'string' ? detection_data : JSON.stringify(detection_data);
      } catch (e) {
        detectionDataStr = null;
      }
    }

    const id = insert(db,
      `INSERT INTO support_tickets (user_id, user_type, ticket_id, subject, category, priority, description, detection_data, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      [req.user.id, req.user.role || 'user', ticket_id,
       subject.trim().slice(0, 200),
       finalCategory.slice(0, 100),
       autoPriority,
       description.trim().slice(0, 5000),
       detectionDataStr,
       nowISO(), nowISO()]
    );

    // Auto-add system message with explicit timestamp
    const senderName = req.user.username || req.user.name || req.user.email || 'User';
    insert(db,
      `INSERT INTO support_messages (ticket_id, sender_role, sender_name, content, created_at) VALUES (?, 'user', ?, ?, ?)`,
      [id, senderName, description.trim().slice(0, 5000), nowISO()]
    );

    const ticket = get(db, 'SELECT * FROM support_tickets WHERE id=?', [id]);
    res.status(201).json({ success: true, ticket, ticket_id });
  } catch (err) {
    console.error('Create ticket error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/support/tickets — get user's tickets ────────────────────────────
router.get('/tickets', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const tickets = all(db,
      `SELECT t.*,
        (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) as message_count
       FROM support_tickets t
       WHERE t.user_id=? AND t.user_type=?
       ORDER BY t.created_at DESC`,
      [req.user.id, req.user.role || 'user']
    );
    res.json({ tickets, count: tickets.length });
  } catch (err) {
    console.error('Get tickets error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/support/tickets/:id — get single ticket with messages ────────────
router.get('/tickets/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const ticket = get(db,
      'SELECT * FROM support_tickets WHERE id=? AND user_id=? AND user_type=?',
      [req.params.id, req.user.id, req.user.role || 'user']
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    const messages = all(db,
      'SELECT * FROM support_messages WHERE ticket_id=? ORDER BY created_at ASC',
      [ticket.id]
    );

    res.json({ ticket, messages });
  } catch (err) {
    console.error('Get ticket error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── POST /api/support/tickets/:id/messages — add message ─────────────────────
router.post('/tickets/:id/messages', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Message content is required.' });

    const db = await getDb();
    const ticket = get(db,
      'SELECT * FROM support_tickets WHERE id=? AND user_id=? AND user_type=?',
      [req.params.id, req.user.id, req.user.role || 'user']
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    if (ticket.status === 'closed') return res.status(400).json({ error: 'Cannot reply to a closed ticket.' });

    const senderName = req.user.username || req.user.name || req.user.email || 'User';
    const msgId = insert(db,
      `INSERT INTO support_messages (ticket_id, sender_role, sender_name, content, created_at) VALUES (?, 'user', ?, ?, ?)`,
      [ticket.id, senderName, content.trim().slice(0, 5000), nowISO()]
    );

    // Update ticket updated_at with explicit timestamp
    run(db,
      `UPDATE support_tickets SET updated_at=?, status=CASE WHEN status='resolved' THEN 'open' ELSE status END WHERE id=?`,
      [nowISO(), ticket.id]
    );

    const message = get(db, 'SELECT * FROM support_messages WHERE id=?', [msgId]);
    res.json({ success: true, message });
  } catch (err) {
    console.error('Add message error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── PATCH /api/support/tickets/:id/status — update status ────────────────────
router.patch('/tickets/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['open', 'under_review', 'resolved', 'closed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: open, under_review, resolved, closed' });
    }

    const db = await getDb();
    const ticket = get(db,
      'SELECT * FROM support_tickets WHERE id=? AND user_id=? AND user_type=?',
      [req.params.id, req.user.id, req.user.role || 'user']
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    // Users can only close their own tickets (admins can set any status)
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && status !== 'closed') {
      return res.status(403).json({ error: 'Users can only close tickets.' });
    }

    run(db,
      `UPDATE support_tickets SET status=?, updated_at=? WHERE id=?`,
      [status, nowISO(), ticket.id]
    );

    const updated = get(db, 'SELECT * FROM support_tickets WHERE id=?', [ticket.id]);
    res.json({ success: true, ticket: updated });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── DELETE /api/support/tickets/:id — delete ticket ──────────────────────────
router.delete('/tickets/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const ticket = get(db,
      'SELECT * FROM support_tickets WHERE id=? AND user_id=? AND user_type=?',
      [req.params.id, req.user.id, req.user.role || 'user']
    );
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    // Delete messages first
    run(db, 'DELETE FROM support_messages WHERE ticket_id=?', [ticket.id]);
    run(db, 'DELETE FROM support_tickets WHERE id=?', [ticket.id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete ticket error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/support/stats — ticket stats for current user ───────────────────
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const rows = all(db,
      `SELECT status, COUNT(*) as count FROM support_tickets WHERE user_id=? AND user_type=? GROUP BY status`,
      [req.user.id, req.user.role || 'user']
    );

    const stats = { total: 0, open: 0, under_review: 0, resolved: 0, closed: 0 };
    rows.forEach(r => {
      stats[r.status] = r.count;
      stats.total += r.count;
    });

    res.json(stats);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
