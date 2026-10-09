/* history.js - CyberShield AI Detection History */

const HIST_API = 'http://localhost:3001/api/detections';
let allDetections = [];
let displayedCount = 0;
const PAGE_SIZE = 20;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const session      = JSON.parse(localStorage.getItem('cs_session')       || 'null');
  const adminSession = JSON.parse(localStorage.getItem('cs_admin_session') || 'null');

  if (!session && !adminSession) {
    sessionStorage.setItem('cs_redirect', 'history.html');
    window.location.href = 'login.html';
    return;
  }

  // Update navbar
  const li = document.querySelector('.nav-login');
  const si = document.querySelector('.nav-signup');
  const um = document.querySelector('.nav-user');
  if (li) li.style.display = 'none';
  if (si) si.style.display = 'none';
  if (um) {
    um.style.display = 'flex';
    const n = um.querySelector('.nav-username');
    if (n) n.textContent = session ? session.username : adminSession.name;
  }

  await loadHistory();
});

function logout() {
  localStorage.removeItem('cs_session');
  localStorage.removeItem('cs_admin_session');
  localStorage.removeItem('cs_token');
  window.location.href = 'index.html';
}

function getToken() { return localStorage.getItem('cs_token') || ''; }

// ── Load history from backend ─────────────────────────────────────────────────
async function loadHistory() {
  showState('loading');

  const token = getToken();

  if (token) {
    try {
      const res = await fetch(`${HIST_API}?limit=500`, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (res.ok) {
        const data = await res.json();
        allDetections = data.detections || [];
      } else {
        allDetections = getLocalHistory();
      }
    } catch {
      allDetections = getLocalHistory();
    }
  } else {
    // Not logged in — redirect
    sessionStorage.setItem('cs_redirect', 'history.html');
    window.location.href = 'login.html';
    return;
  }

  if (allDetections.length === 0) {
    showState('empty');
    return;
  }

  updateSummary();
  displayedCount = 0;
  renderList(getFiltered());
}

// localStorage fallback
function getLocalHistory() {
  const session      = JSON.parse(localStorage.getItem('cs_session')       || 'null');
  const adminSession = JSON.parse(localStorage.getItem('cs_admin_session') || 'null');
  const key = session ? 'cs_hist_u_' + (session.username || session.email)
                      : (adminSession ? 'cs_hist_a_' + adminSession.name : null);
  if (!key) return [];
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}

// ── Summary stats ─────────────────────────────────────────────────────────────
function updateSummary() {
  const total   = allDetections.length;
  const threats = allDetections.filter(d => d.verdict !== 'SAFE').length;
  const safe    = allDetections.filter(d => d.verdict === 'SAFE').length;
  const today   = new Date().toISOString().slice(0, 10);
  const todayCount = allDetections.filter(d => (d.created_at || '').slice(0, 10) === today).length;

  animNum('sumTotal',   total);
  animNum('sumThreats', threats);
  animNum('sumSafe',    safe);
  animNum('sumToday',   todayCount);
}

function animNum(id, to) {
  const el = document.getElementById(id);
  if (!el) return;
  let from = 0, start = null;
  const step = (ts) => {
    if (!start) start = ts;
    const p = Math.min((ts - start) / 600, 1);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = to;
  };
  requestAnimationFrame(step);
}

// ── Filter & sort ─────────────────────────────────────────────────────────────
function getFiltered() {
  const q       = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const verdict = document.getElementById('verdictFilter')?.value || '';
  const type    = document.getElementById('typeFilter')?.value    || '';
  const sort    = document.getElementById('sortFilter')?.value    || 'newest';

  let list = allDetections.filter(d => {
    if (verdict && d.verdict !== verdict) return false;
    if (type    && d.type    !== type)    return false;
    if (q) {
      const hay = [d.verdict, d.category, d.type, d.content,
        ...safeParseArray(d.keywords),
        ...safeParseArray(d.reasons)
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  list.sort((a, b) => {
    if (sort === 'newest')     return new Date(b.created_at) - new Date(a.created_at);
    if (sort === 'oldest')     return new Date(a.created_at) - new Date(b.created_at);
    if (sort === 'score-high') return (b.score || 0) - (a.score || 0);
    if (sort === 'score-low')  return (a.score || 0) - (b.score || 0);
    return 0;
  });

  return list;
}

function filterHistory() {
  displayedCount = 0;
  renderList(getFiltered());
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderList(list) {
  const container = document.getElementById('histList');
  const loadWrap  = document.getElementById('loadMoreWrap');

  if (list.length === 0) {
    container.innerHTML = '';
    showState(allDetections.length === 0 ? 'empty' : 'noresults');
    loadWrap.style.display = 'none';
    return;
  }

  showState('list');
  const slice = list.slice(0, displayedCount + PAGE_SIZE);
  displayedCount = slice.length;

  container.innerHTML = slice.map((d, i) => buildCard(d, i)).join('');
  loadWrap.style.display = displayedCount < list.length ? '' : 'none';
}

function loadMore() {
  const list = getFiltered();
  const slice = list.slice(0, displayedCount + PAGE_SIZE);
  displayedCount = slice.length;
  document.getElementById('histList').innerHTML = slice.map((d, i) => buildCard(d, i)).join('');
  document.getElementById('loadMoreWrap').style.display = displayedCount < list.length ? '' : 'none';
}

// ── Safe JSON parse helper (handles both string and already-parsed array) ─────
function safeParseArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

function buildCard(d, idx) {
  const verdictClass = { PHISHING:'vb-phishing', SPAM:'vb-spam', SUSPICIOUS:'vb-suspicious', FRAUD:'vb-fraud', SAFE:'vb-safe' };
  const scoreColor   = { PHISHING:'#fc8181', SPAM:'#f6ad55', SUSPICIOUS:'#f6ad55', FRAUD:'#fc8181', SAFE:'#68d391' };
  const vc  = verdictClass[d.verdict] || 'vb-spam';
  const sc  = scoreColor[d.verdict]   || '#a0aec0';
  const score = d.score || 0;
  const circ  = 2 * Math.PI * 14;
  const offset = circ - (score / 100) * circ;

  const keywords = safeParseArray(d.keywords).slice(0, 4);
  const content  = (d.content || '').slice(0, 120);
  const timeStr  = formatTime(d.created_at);
  const delay    = Math.min(idx * 30, 300);

  return `<div class="det-card" style="animation-delay:${delay}ms" onclick="openDetail(${idx})">
    <div class="card-top">
      <div class="card-verdict">
        <span class="verdict-badge ${vc}">${d.verdict}</span>
        <span class="type-badge">${d.type || 'unknown'}</span>
      </div>
      <div class="card-score">
        <div class="score-ring-sm">
          <svg width="44" height="44" viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="14" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>
            <circle cx="22" cy="22" r="14" fill="none" stroke="${sc}" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
              transform="rotate(-90 22 22)"/>
          </svg>
          <div class="score-num-sm" style="color:${sc}">${score}</div>
        </div>
      </div>
    </div>
    <div class="card-category">${escHtml(d.category || 'Unknown')}</div>
    ${content ? `<div class="card-content">${escHtml(content)}</div>` : ''}
    ${keywords.length ? `<div class="card-keywords">${keywords.map(k => `<span class="kw-chip ${d.verdict === 'SAFE' ? 'safe' : ''}">${escHtml(k)}</span>`).join('')}</div>` : ''}
    <div class="card-footer">
      <span class="card-time">${timeStr}</span>
      <button class="card-view-btn">View Details →</button>
    </div>
  </div>`;
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function openDetail(idx) {
  const filtered = getFiltered();
  const d = filtered[idx];
  if (!d) return;

  const scoreColor = { PHISHING:'#fc8181', SPAM:'#f6ad55', SUSPICIOUS:'#f6ad55', FRAUD:'#fc8181', SAFE:'#68d391' };
  const sc = scoreColor[d.verdict] || '#a0aec0';
  const reasons  = safeParseArray(d.reasons);
  const keywords = safeParseArray(d.keywords);

  document.getElementById('modalTitle').textContent = `${d.verdict} — ${d.category || 'Detection Detail'}`;

  document.getElementById('modalBody').innerHTML = `
    <div class="detail-section">
      <div class="detail-section-label">Overview</div>
      <div class="detail-row"><span class="detail-row-label">Verdict</span><span class="detail-row-val" style="color:${sc};font-weight:700">${d.verdict}</span></div>
      <div class="detail-row"><span class="detail-row-label">Score</span><span class="detail-row-val" style="color:${sc};font-weight:700;font-family:'JetBrains Mono',monospace">${d.score}/100</span></div>
      <div class="detail-row"><span class="detail-row-label">Category</span><span class="detail-row-val">${escHtml(d.category || '—')}</span></div>
      <div class="detail-row"><span class="detail-row-label">Type</span><span class="detail-row-val" style="text-transform:capitalize">${d.type || '—'}</span></div>
      <div class="detail-row"><span class="detail-row-label">Scanned</span><span class="detail-row-val" style="font-family:'JetBrains Mono',monospace;font-size:.72rem">${formatTimeFull(d.created_at)}</span></div>
    </div>
    ${d.content ? `
    <div class="detail-section">
      <div class="detail-section-label">Analyzed Content</div>
      <div class="detail-content-box">${escHtml(d.content)}</div>
    </div>` : ''}
    ${reasons.length ? `
    <div class="detail-section">
      <div class="detail-section-label">AI Reasons</div>
      <div class="detail-reasons">${reasons.map(r => `<div class="detail-reason"><span style="color:#f6ad55;flex-shrink:0">⚡</span>${escHtml(r)}</div>`).join('')}</div>
    </div>` : ''}
    ${keywords.length ? `
    <div class="detail-section">
      <div class="detail-section-label">Flagged Keywords</div>
      <div class="detail-kws">${keywords.map(k => `<span class="kw-chip">${escHtml(k)}</span>`).join('')}</div>
    </div>` : ''}`;

  const modal = document.getElementById('detailModal');
  requestAnimationFrame(() => modal.classList.add('show'));
}

function closeModal() {
  document.getElementById('detailModal').classList.remove('show');
}

document.getElementById('detailModal').addEventListener('click', e => {
  if (e.target === document.getElementById('detailModal')) closeModal();
});

// ── Clear history — DISABLED: history is permanent per account ────────────────
// History is tied permanently to each user account and cannot be deleted.
// The Clear All button has been removed from the UI.

// ── State helpers ─────────────────────────────────────────────────────────────
function showState(state) {
  document.getElementById('histLoading').style.display   = state === 'loading'   ? 'flex' : 'none';
  document.getElementById('histEmpty').style.display     = state === 'empty'     ? 'flex' : 'none';
  document.getElementById('histNoResults').style.display = state === 'noresults' ? 'flex' : 'none';
  document.getElementById('histList').style.display      = state === 'list'      ? ''     : 'none';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * Relative + exact time for card display.
 * e.g. "5 min ago · 10:35 AM"  or  "11 Jun · 10:35 AM"
 */
function formatTime(iso) {
  if (!iso) return '';
  try {
    const d    = new Date(iso);
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000);
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (diff < 60)    return 'just now · ' + timeStr;
    if (diff < 3600)  return Math.floor(diff / 60) + ' min ago · ' + timeStr;
    if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago · ' + timeStr;

    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    return dateStr + ' · ' + timeStr;
  } catch { return iso.slice(0, 10); }
}

/** Full datetime for the detail modal. */
function formatTimeFull(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  } catch { return iso; }
}

// ── Live ticker: refresh card timestamps every 60 s ───────────────────────────
setInterval(() => {
  if (allDetections.length) {
    displayedCount = 0;
    renderList(getFiltered());
  }
}, 60000);
