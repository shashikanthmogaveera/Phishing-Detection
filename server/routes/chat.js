// routes/chat.js — Mistral chatbot with per-user session history
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getDb, run, all, get, insert } = require('../db');
const router = express.Router();

const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234';
const OLLAMA_URL    = process.env.OLLAMA_URL    || 'http://localhost:11434';

const SYSTEM_PROMPT = `You are CyberShield AI Assistant — an expert cybersecurity analyst specializing in:
- Phishing attack detection and prevention
- SMS, email, and WhatsApp scam identification
- UPI fraud, OTP theft, and banking scams
- Malicious URL and domain analysis
- Social engineering tactics
- Cybercrime reporting in India (cybercrime.gov.in, helpline 1930)
- Digital safety best practices

RULES:
1. Only answer questions related to cybersecurity, phishing, spam, scams, fraud, digital safety, and related topics.
2. If asked about unrelated topics, politely redirect to cybersecurity topics.
3. Be concise, clear, and actionable. Use bullet points for lists.
4. For Indian users: mention relevant Indian cybercrime resources when appropriate.
5. Never provide information that could help someone commit fraud or phishing.
6. Format responses with clear structure. Use **bold** for important terms.`;

// ── Detect AI backend ─────────────────────────────────────────────────────────
async function detectBackend() {
  try {
    const res = await fetch(`${LM_STUDIO_URL}/v1/models`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const models = (data.data || []).map(m => m.id).filter(Boolean);
      const chatModel = models.find(m => !m.toLowerCase().includes('embed') && !m.toLowerCase().includes('nomic')) || models[0];
      return { type: 'lmstudio', models, chatModel };
    }
  } catch {}
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const models = (data.models || []).map(m => m.name).filter(Boolean);
      return { type: 'ollama', models, chatModel: models[0] };
    }
  } catch {}
  return { type: 'none', models: [], chatModel: null };
}

// ── Generate a short title from the first user message ────────────────────────
function makeTitle(message) {
  const clean = message.replace(/[^\w\s]/g, '').trim();
  const words = clean.split(/\s+/).slice(0, 6).join(' ');
  return words.length > 3 ? words : 'New Chat';
}

// ── GET /api/chat/sessions — list all sessions for this user ──────────────────
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const sessions = all(db,
      `SELECT s.id, s.title, s.created_at, s.updated_at,
              (SELECT content FROM chat_messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_msg
       FROM chat_sessions s
       WHERE s.user_id = ? AND s.user_type = ?
       ORDER BY s.updated_at DESC`,
      [req.user.id, req.user.role]
    );
    res.json({ sessions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/chat/sessions — create a new session ───────────────────────────
router.post('/sessions', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const title = (req.body.title || 'New Chat').slice(0, 80);
    const id = insert(db,
      'INSERT INTO chat_sessions (user_id, user_type, title) VALUES (?,?,?)',
      [req.user.id, req.user.role, title]
    );
    res.json({ id, title });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/chat/sessions/:id — rename a session ──────────────────────────
router.patch('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    run(db,
      'UPDATE chat_sessions SET title=?, updated_at=datetime("now") WHERE id=? AND user_id=? AND user_type=?',
      [title.slice(0, 80), req.params.id, req.user.id, req.user.role]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/chat/sessions/:id — delete a session + its messages ───────────
router.delete('/sessions/:id', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    run(db, 'DELETE FROM chat_messages WHERE session_id=? AND user_id=? AND user_type=?',
      [req.params.id, req.user.id, req.user.role]);
    run(db, 'DELETE FROM chat_sessions WHERE id=? AND user_id=? AND user_type=?',
      [req.params.id, req.user.id, req.user.role]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/chat/sessions/:id/messages — load messages for a session ─────────
router.get('/sessions/:id/messages', requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const msgs = all(db,
      'SELECT role, content, created_at FROM chat_messages WHERE session_id=? AND user_id=? AND user_type=? ORDER BY created_at ASC',
      [req.params.id, req.user.id, req.user.role]
    );
    res.json({ messages: msgs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/chat — send a message ──────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { message, history = [], session_id } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required.' });

  const backend = await detectBackend();
  if (backend.type === 'none' || !backend.chatModel) {
    return res.status(503).json({ error: 'AI model not running', setup: true });
  }

  // Resolve or create session
  let sid = session_id;
  try {
    const db = await getDb();
    if (!sid) {
      const title = makeTitle(message);
      sid = insert(db,
        'INSERT INTO chat_sessions (user_id, user_type, title) VALUES (?,?,?)',
        [req.user.id, req.user.role, title]
      );
    } else {
      // Update updated_at
      run(db, 'UPDATE chat_sessions SET updated_at=datetime("now") WHERE id=? AND user_id=?',
        [sid, req.user.id]);
    }
  } catch {}

  // Build messages for LM Studio (no system role)
  const systemPrefix = `[CONTEXT: ${SYSTEM_PROMPT}]\n\nUser question: `;
  const historyMsgs  = history.slice(-10).map(h => ({ role: h.role, content: h.content }));
  let messages;
  if (historyMsgs.length === 0) {
    messages = [{ role: 'user', content: systemPrefix + message.trim() }];
  } else {
    messages = [
      { role: 'user', content: systemPrefix + historyMsgs[0].content },
      ...historyMsgs.slice(1),
      { role: 'user', content: message.trim() }
    ];
  }

  console.log(`[Chat] session=${sid} model=${backend.chatModel}`);

  try {
    let reply = '';

    if (backend.type === 'lmstudio') {
      const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: backend.chatModel, messages, temperature: 0.7, max_tokens: 1024, stream: false }),
        signal: AbortSignal.timeout(120000)
      });
      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error(`LM Studio ${response.status}:`, errBody.slice(0, 200));
        throw new Error(`LM Studio returned ${response.status}`);
      }
      const data = await response.json();
      reply = data.choices?.[0]?.message?.content?.trim() || 'No response from model.';
    } else {
      const ollamaMsgs = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-10).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: message.trim() }
      ];
      const response = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: backend.chatModel, messages: ollamaMsgs, stream: false, options: { temperature: 0.7, num_predict: 1024 } }),
        signal: AbortSignal.timeout(120000)
      });
      if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
      const data = await response.json();
      reply = data.message?.content?.trim() || 'No response from model.';
    }

    // Save both turns to DB
    try {
      const db = await getDb();
      run(db, 'INSERT INTO chat_messages (session_id,user_id,user_type,role,content) VALUES (?,?,?,?,?)',
        [sid, req.user.id, req.user.role, 'user', message.trim()]);
      run(db, 'INSERT INTO chat_messages (session_id,user_id,user_type,role,content) VALUES (?,?,?,?,?)',
        [sid, req.user.id, req.user.role, 'assistant', reply]);
    } catch (dbErr) { console.warn('[Chat] DB save failed:', dbErr.message); }

    res.json({ reply, model: backend.chatModel, session_id: sid });

  } catch (err) {
    console.error('[Chat error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/chat/status ──────────────────────────────────────────────────────
router.get('/status', async (req, res) => {
  const backend = await detectBackend();
  res.json(backend);
});

module.exports = router;
