// db.js — SQLite database setup using sql.js (pure JS, no native build needed)
const path = require('path');
const fs   = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'cybershield.db');
let _db = null;

function persist(db) {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function startAutosave(db) {
  setInterval(() => persist(db), 10_000);
}

async function getDb() {
  if (_db) return _db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    _db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    _db = new SQL.Database();
  }

  _db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS detections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_type TEXT DEFAULT 'user',
    type TEXT NOT NULL,
    content TEXT,
    verdict TEXT NOT NULL,
    score INTEGER NOT NULL,
    category TEXT,
    reasons TEXT,
    keywords TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  _db.run(`CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Chat sessions — one row per conversation
  _db.run(`CREATE TABLE IF NOT EXISTS chat_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_type TEXT NOT NULL DEFAULT 'user',
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // Chat messages — linked to a session
  _db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_type TEXT NOT NULL DEFAULT 'user',
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // User blacklist — platform-level blocked senders
  _db.run(`CREATE TABLE IF NOT EXISTS blocked_senders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_type TEXT NOT NULL DEFAULT 'user',
    value TEXT NOT NULL,
    normalized_value TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'account',
    label TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Support tickets
  _db.run(`CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    user_type TEXT NOT NULL DEFAULT 'user',
    ticket_id TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General Support',
    priority TEXT NOT NULL DEFAULT 'Medium',
    description TEXT NOT NULL,
    detection_data TEXT DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // Support messages — linked to a ticket
  _db.run(`CREATE TABLE IF NOT EXISTS support_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    sender_role TEXT NOT NULL DEFAULT 'user',
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Phase 2: Review Queue
  _db.run(`CREATE TABLE IF NOT EXISTS review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    detection_id INTEGER NOT NULL,
    user_id INTEGER,
    ai_verdict TEXT NOT NULL,
    human_verdict TEXT,
    score INTEGER NOT NULL,
    confidence REAL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    reviewed_by INTEGER,
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  
  // Indexes for review_queue
  try {
    _db.run(`CREATE INDEX IF NOT EXISTS idx_review_detection ON review_queue(detection_id)`);
    _db.run(`CREATE INDEX IF NOT EXISTS idx_review_status ON review_queue(status)`);
    _db.run(`CREATE INDEX IF NOT EXISTS idx_review_created ON review_queue(created_at)`);
  } catch(e) {}

  // Phase 2H: Review History
  _db.run(`CREATE TABLE IF NOT EXISTS review_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    detection_id INTEGER NOT NULL,
    ai_verdict TEXT NOT NULL,
    human_verdict TEXT,
    reviewer INTEGER,
    date TEXT DEFAULT (datetime('now')),
    notes TEXT
  )`);

  // Intelligence event log — cross-module timeline
  _db.run(`CREATE TABLE IF NOT EXISTS intelligence_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    detection_id INTEGER,
    verdict_before TEXT,
    verdict_after TEXT,
    actor TEXT DEFAULT 'system',
    meta TEXT,
    created_at TEXT NOT NULL
  )`);
  try { _db.run(`CREATE INDEX IF NOT EXISTS idx_iev_created ON intelligence_events(created_at DESC)`); } catch(e) {}
  try { _db.run(`CREATE INDEX IF NOT EXISTS idx_iev_type ON intelligence_events(event_type)`); } catch(e) {}
  try { _db.run(`CREATE INDEX IF NOT EXISTS idx_iev_detection ON intelligence_events(detection_id)`); } catch(e) {}

  persist(_db);
  startAutosave(_db);
  return _db;
}

function run(db, sql, params = []) {
  db.run(sql, params);
  persist(db);
}

function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(db, sql, params = []) {
  return all(db, sql, params)[0] || null;
}

// Insert and return the new row's id
function insert(db, sql, params = []) {
  db.run(sql, params);
  const row = get(db, 'SELECT last_insert_rowid() as id');
  persist(db);
  return row ? row.id : null;
}

module.exports = { getDb, run, all, get, insert, persist };
