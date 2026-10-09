// routes/detections.js — save and retrieve scan results
const express = require('express');
const { getDb, run, all, get, insert } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/detections — save a scan result ─────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  try {
    const { type, content, verdict, score, category, reasons, keywords, confidence = 100 } = req.body;
    if (!verdict || score === undefined) return res.status(400).json({ error: 'verdict and score are required.' });

    const db  = await getDb();
    const now = new Date().toISOString();
    const numScore = Number(score) || 0;

    // Insert detection
    run(db,
      `INSERT INTO detections (user_id, user_type, type, content, verdict, score, category, reasons, keywords, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, req.user.role, type || 'unknown',
       (content || '').slice(0, 500), verdict, numScore,
       category || '', JSON.stringify(reasons || []), JSON.stringify(keywords || []), now]
    );
    const detectionId = get(db, 'SELECT last_insert_rowid() as id')?.id || null;

    // Log DETECTION_CREATED to intelligence timeline
    if (detectionId) {
      insert(db,
        `INSERT INTO intelligence_events
         (event_type, entity_type, entity_id, detection_id, verdict_after, actor, meta, created_at)
         VALUES ('DETECTION_CREATED','detection',?,?,?,?,?,?)`,
        [detectionId, detectionId, verdict, req.user.role,
         JSON.stringify({ type: type || 'unknown', score: numScore, category: category || '' }), now]
      );
    }

    // ── Connection 1: Detection → Review Queue ───────────────────────────────
    // Auto-queue uncertain detections: score 40–60 OR confidence < 75
    const shouldReview = (numScore >= 40 && numScore <= 60) || (Number(confidence) < 75);
    if (shouldReview && detectionId) {
      const confVal = Number(confidence) < 75 ? Number(confidence) : Math.round(100 - (numScore - 40) * 1.4);
      insert(db,
        `INSERT INTO review_queue (detection_id, user_id, ai_verdict, score, confidence, status, created_at)
         VALUES (?,?,?,?,?,'PENDING',?)`,
        [detectionId, req.user.id, verdict, numScore, confVal, now]
      );

      // Log REVIEW_TRIGGERED
      insert(db,
        `INSERT INTO intelligence_events
         (event_type, entity_type, entity_id, detection_id, verdict_before, actor, meta, created_at)
         VALUES ('REVIEW_TRIGGERED','review_queue',?,?,?,'system',?,?)`,
        [detectionId, detectionId, verdict,
         JSON.stringify({ reason: numScore >= 40 && numScore <= 60 ? 'uncertain_score' : 'low_confidence', score: numScore, confidence: confVal }),
         now]
      );
    }

    res.json({ success: true, detection_id: detectionId, queued_for_review: shouldReview });
  } catch (err) {
    console.error('Save detection error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/detections — get current user's full scan history ────────────────
// History is PERMANENT — it is never deleted per account.
router.get('/', requireAuth, async (req, res) => {
  try {
    const db     = await getDb();
    const limit  = Math.min(parseInt(req.query.limit)  || 200, 500);
    const offset = parseInt(req.query.offset) || 0;

    const rows = all(db,
      `SELECT id, type, content, verdict, score, category, reasons, keywords, created_at
       FROM detections
       WHERE user_id = ? AND user_type = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [req.user.id, req.user.role, limit, offset]
    );

    // Count total for pagination
    const totalRow = get(db,
      'SELECT COUNT(*) as n FROM detections WHERE user_id = ? AND user_type = ?',
      [req.user.id, req.user.role]
    );

    const parsed = rows.map(r => ({
      ...r,
      reasons:  JSON.parse(r.reasons  || '[]'),
      keywords: JSON.parse(r.keywords || '[]')
    }));

    res.json({ detections: parsed, total: Math.round(Number(totalRow?.n) || 0) });
  } catch (err) {
    console.error('Get detections error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/detections/stats — today's stats for current user ────────────────
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db    = await getDb();
    const today = new Date().toISOString().slice(0, 10);

    const todayRow = get(db,
      `SELECT COUNT(*) as scans,
              SUM(CASE WHEN verdict != 'SAFE' THEN 1 ELSE 0 END) as threats
       FROM detections
       WHERE user_id = ? AND user_type = ? AND substr(created_at,1,10) = ?`,
      [req.user.id, req.user.role, today]
    );

    const allTime = get(db,
      `SELECT COUNT(*) as total_scans,
              SUM(CASE WHEN verdict != 'SAFE' THEN 1 ELSE 0 END) as total_threats
       FROM detections WHERE user_id = ? AND user_type = ?`,
      [req.user.id, req.user.role]
    );

    res.json({
      scans_today:   Math.round(Number(todayRow?.scans)         || 0),
      threats_today: Math.round(Number(todayRow?.threats)        || 0),
      total_scans:   Math.round(Number(allTime?.total_scans)     || 0),
      total_threats: Math.round(Number(allTime?.total_threats)   || 0)
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── DELETE /api/detections/clear — DISABLED ───────────────────────────────────
// History is permanent per account. This endpoint is intentionally blocked.
router.delete('/clear', requireAuth, (req, res) => {
  res.status(403).json({ error: 'Detection history is permanent and cannot be deleted.' });
});

module.exports = router;
