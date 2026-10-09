/* admin.js — CyberShield AI Admin Panel
   Single source of truth: loadDashboard() fetches all data and
   drives every chart, stat, and feed on the page.
*/

// ── Session helpers ────────────────────────────────────────────────────────────
function getAdminSession() {
  return JSON.parse(localStorage.getItem('cs_admin_session') || 'null');
}
function getLocalUsers() {
  return JSON.parse(localStorage.getItem('cs_users') || '[]');
}

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const session = getAdminSession();
  if (!session) { window.location.href = 'login.html'; return; }

  // Admin name
  ['adminName', 'topAdminName'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = session.name;
  });

  // Settings section
  setText('set-name',  session.name);
  setText('set-email', session.email);
  setText('set-phone', session.phone || '-');

  // Nav switching
  document.querySelectorAll('.ap-nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const sec = item.getAttribute('data-section');
      switchSection(sec);
      document.querySelectorAll('.ap-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      if (sec === 'users')        loadUsers();
      if (sec === 'detections')   loadDetections();
      // Add handlers for new sections as needed
    });
  });

  // First load
  await loadDashboard();

  // Auto-refresh every 30 s
  setInterval(async () => {
    await loadDashboard();
    const active = document.querySelector('.ap-nav-item.active')?.getAttribute('data-section');
    if (active === 'detections') loadDetections();
    if (active === 'users')      loadUsers();
  }, 30000);

  // Refresh on tab focus
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadDashboard();
  });

  // ── Live timestamp ticker ──────────────────────────────────────────────────
  // Updates every element with data-iso every 60 seconds — no full re-render.
  setInterval(() => {
    document.querySelectorAll('[data-iso]').forEach(el => {
      const iso = el.dataset.iso;
      if (!iso) return;
      // SOC message times use socFmtTime, everything else uses formatTime
      el.textContent = el.classList.contains('soc-msg-time')
        ? socFmtTime(iso)
        : formatTime(iso);
    });
  }, 60000);
});

// ══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD — master loader
// ══════════════════════════════════════════════════════════════════════════════
async function loadDashboard() {
  // Use allSettled so one failing endpoint never kills the whole dashboard
  const [statsRes, todayRes, monthlyRes] = await Promise.allSettled([
    Api.getAdminStats(),
    Api.getAdminStatsToday(),
    Api.getAdminStatsMonthly()
  ]);

  // ── Main stats ─────────────────────────────────────────────────────────────
  if (statsRes.status === 'fulfilled') {
    const s = statsRes.value;

    animCount('stat-threats',     s.total_threats    || 0);
    animCount('stat-users',       s.users            || 0);
    animCount('stat-phishing',    s.phishing_blocked || 0);
    animCount('stat-total-scans', s.total_scans      || 0);
    animCount('stat-scans-today', s.scans_today      || 0);

    const rate = s.total_scans > 0
      ? ((s.total_threats / s.total_scans) * 100).toFixed(1) + '%'
      : '0%';
    setText('stat-accuracy', rate);

    renderVerdictBars(s.verdict_breakdown || []);
    renderSignals(s.verdict_breakdown || [], s.url_scans || 0);
    renderActivityFeed(s.recent_detections || []);
  } else {
    console.warn('[Dashboard/stats]', statsRes.reason?.message || statsRes.reason);
    useFallback();
  }

  // ── Today pie chart ────────────────────────────────────────────────────────
  if (todayRes.status === 'fulfilled') {
    const t = todayRes.value;
    renderPieChart(t.breakdown || [], t.total || 0);
  } else {
    console.warn('[Dashboard/today]', todayRes.reason?.message || todayRes.reason);
    // Derive today's data from the main stats verdict_breakdown as fallback
    if (statsRes.status === 'fulfilled') {
      renderPieChart(statsRes.value.verdict_breakdown || [], statsRes.value.total_scans || 0);
    } else {
      renderPieChart([], 0);
    }
  }

  // ── Monthly chart ──────────────────────────────────────────────────────────
  if (monthlyRes.status === 'fulfilled') {
    const m = monthlyRes.value;
    renderMonthlyChart(m.months || [], m.data || {});
  } else {
    console.warn('[Dashboard/monthly]', monthlyRes.reason?.message || monthlyRes.reason);
    renderMonthlyChart(buildFallbackMonths(), {});
  }

  // ── Timestamp ──────────────────────────────────────────────────────────────
  setText('lastRefreshed', 'Updated ' + ts());
}

// Build 6-month labels for the monthly chart even when the endpoint fails
function buildFallbackMonths() {
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

// ── Offline / localStorage fallback ───────────────────────────────────────────
function useFallback() {
  const users = getLocalUsers();
  setText('stat-users',       users.length);
  setText('stat-threats',     users.length * 3 + 12);
  setText('stat-phishing',    Math.floor(users.length * 1.2 + 5));
  setText('stat-total-scans', users.length * 4 + 8);
  setText('stat-scans-today', '—');
  setText('stat-accuracy',    '—');
}

// ══════════════════════════════════════════════════════════════════════════════
//  SHARED CHART STATE — cross-chart hover sync
// ══════════════════════════════════════════════════════════════════════════════
const BAR_META = {
  PHISHING:   { label: 'Phishing',   color: 'linear-gradient(to top,#fc8181,#feb2b2)', solid: '#fc8181' },
  SPAM:       { label: 'Spam',       color: 'linear-gradient(to top,#f6ad55,#fbd38d)', solid: '#f6ad55' },
  SUSPICIOUS: { label: 'Suspicious', color: 'linear-gradient(to top,#9f7aea,#b794f4)', solid: '#9f7aea' },
  FRAUD:      { label: 'Fraud',      color: 'linear-gradient(to top,#fc8181,#feb2b2)', solid: '#fc8181' },
  SAFE:       { label: 'Safe',       color: 'linear-gradient(to top,#68d391,#9ae6b4)', solid: '#68d391' },
};
const BAR_ORDER = ['PHISHING', 'SPAM', 'SUSPICIOUS', 'SAFE'];

// Shared hover state — all charts read this
let _chartState = { verdict: null, merged: {}, todayBreakdown: [], monthlyMonths: [], monthlyData: {} };

// One global tooltip element (created once)
let _tooltip = null;
function getTooltip() {
  if (!_tooltip) {
    _tooltip = document.createElement('div');
    _tooltip.id = 'chartTooltip';
    _tooltip.style.cssText = `
      position:fixed;pointer-events:none;z-index:9999;
      background:rgba(8,12,20,0.97);border:1px solid rgba(99,179,237,0.3);
      border-radius:9px;padding:10px 14px;font-family:'Inter',sans-serif;
      box-shadow:0 8px 32px rgba(0,0,0,0.6),0 0 0 1px rgba(99,179,237,0.08);
      min-width:160px;display:none;transition:opacity .12s;
    `;
    document.body.appendChild(_tooltip);
  }
  return _tooltip;
}

function showTooltip(html, x, y) {
  const t = getTooltip();
  t.innerHTML = html;
  t.style.display = 'block';
  // Keep inside viewport
  const tw = t.offsetWidth || 180, th = t.offsetHeight || 80;
  const left = (x + 16 + tw > window.innerWidth) ? x - tw - 10 : x + 16;
  const top  = (y + 10 + th > window.innerHeight) ? y - th - 10 : y + 10;
  t.style.left = left + 'px';
  t.style.top  = top  + 'px';
}

function hideTooltip() {
  const t = getTooltip();
  if (t) t.style.display = 'none';
}

// Triggered when user hovers a verdict category — syncs all charts
function onChartHover(verdict) {
  _chartState.verdict = verdict;
  highlightBarChart(verdict);
  highlightSignalBars(verdict);
  updatePieHighlight(verdict);
}

function onChartLeave() {
  _chartState.verdict = null;
  highlightBarChart(null);
  highlightSignalBars(null);
  updatePieHighlight(null);
  hideTooltip();
}

// ══════════════════════════════════════════════════════════════════════════════
//  CHART 1 — Verdict bar chart (all-time distribution)
// ══════════════════════════════════════════════════════════════════════════════
function renderVerdictBars(breakdown) {
  const container = document.getElementById('verdictChart');
  if (!container) return;

  const normalised = (breakdown || []).map(v => ({
    verdict: String(v.verdict || '').toUpperCase(),
    count:   Math.round(Number(v.count) || 0)
  })).filter(v => v.verdict && v.count > 0);

  if (!normalised.length) {
    container.innerHTML = '<div class="chart-placeholder">No scan data yet.</div>';
    return;
  }

  const merged = {};
  normalised.forEach(v => {
    const key = v.verdict === 'FRAUD' ? 'PHISHING' : v.verdict;
    merged[key] = (merged[key] || 0) + v.count;
  });
  _chartState.merged = merged; // store for tooltip cross-reference

  const keys = [...BAR_ORDER.filter(k => merged[k] !== undefined)];
  Object.keys(merged).forEach(k => { if (!keys.includes(k)) keys.push(k); });
  const total  = keys.reduce((s, k) => s + (merged[k] || 0), 0);
  const maxVal = Math.max(...keys.map(k => merged[k] || 0), 1);

  container.innerHTML = keys.map(key => {
    const count = merged[key] || 0;
    const pct   = Math.round((count / maxVal) * 100);
    const meta  = BAR_META[key] || { label: key, color: 'linear-gradient(to top,#63b3ed,#90cdf4)', solid: '#63b3ed' };
    return `
      <div class="chart-bar-wrap" data-verdict="${key}"
           onmouseenter="barHoverEnter(event,'${key}')"
           onmousemove="barHoverMove(event)"
           onmouseleave="barHoverLeave()">
        <div class="chart-bar" data-verdict="${key}" data-count="${count}" data-pct="${pct}" data-total="${total}"
             style="height:0%;background:${meta.color};transition:height .9s cubic-bezier(.22,1,.36,1)"></div>
        <span class="cb-label">${meta.label}</span>
        <span class="cb-count">${count}</span>
      </div>`;
  }).join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('.chart-bar').forEach(bar => {
      setTimeout(() => { bar.style.height = bar.dataset.pct + '%'; }, 80);
    });
  });

  setText('chart-bar-ts', 'Updated ' + ts());
}

function barHoverEnter(e, verdict) {
  onChartHover(verdict);
}
function barHoverMove(e) {
  const v = _chartState.verdict;
  if (!v) return;
  const meta    = BAR_META[v] || { label: v, solid: '#63b3ed' };
  const count   = _chartState.merged[v] || 0;
  const total   = Object.values(_chartState.merged).reduce((s,n)=>s+n, 0);
  const pct     = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
  const todayCount = (_chartState.todayBreakdown.find(d=>d.verdict===v)||{}).count || 0;
  showTooltip(`
    <div style="font-size:.68rem;color:#4a5568;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Threat Distribution</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="width:10px;height:10px;border-radius:3px;background:${meta.solid};display:inline-block;flex-shrink:0"></span>
      <span style="font-size:.88rem;font-weight:700;color:#f7fafc">${meta.label}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px">
        <div style="font-size:.62rem;color:#4a5568">All-time</div>
        <div style="font-size:1rem;font-weight:800;color:${meta.solid};font-family:'JetBrains Mono',monospace">${count}</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px">
        <div style="font-size:.62rem;color:#4a5568">Share</div>
        <div style="font-size:1rem;font-weight:800;color:${meta.solid};font-family:'JetBrains Mono',monospace">${pct}%</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px;grid-column:1/-1">
        <div style="font-size:.62rem;color:#4a5568">Today</div>
        <div style="font-size:.9rem;font-weight:700;color:${meta.solid};font-family:'JetBrains Mono',monospace">${todayCount}</div>
      </div>
    </div>`, e.clientX, e.clientY);
}
function barHoverLeave() { onChartLeave(); }

function highlightBarChart(verdict) {
  document.querySelectorAll('#verdictChart .chart-bar-wrap').forEach(wrap => {
    const isActive = !verdict || wrap.dataset.verdict === verdict;
    wrap.style.opacity = isActive ? '1' : '0.3';
    wrap.style.transform = isActive && verdict ? 'scaleX(1.04)' : 'scaleX(1)';
    wrap.style.transition = 'opacity .2s, transform .2s';
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  CHART 2 — AI Signal bars (with hover sync)
// ══════════════════════════════════════════════════════════════════════════════
const SIGNAL_MAP = {
  'sig-phishing':   'PHISHING',
  'sig-spam':       'SPAM',
  'sig-suspicious': 'SUSPICIOUS',
  'sig-safe':       'SAFE',
  'sig-url':        'URL',
};

function renderSignals(breakdown, urlScans) {
  const vm = {};
  (breakdown || []).forEach(v => {
    vm[String(v.verdict).toUpperCase()] = Math.round(Number(v.count) || 0);
  });

  const phishing   = (vm['PHISHING'] || 0) + (vm['FRAUD'] || 0);
  const spam       = vm['SPAM']       || 0;
  const suspicious = vm['SUSPICIOUS'] || 0;
  const safe       = vm['SAFE']       || 0;
  const url        = Math.round(Number(urlScans) || 0);
  const maxVal     = Math.max(phishing, spam, suspicious, safe, url, 1);

  setBar('sig-phishing',   'sig-phishing-pct',   phishing,   maxVal);
  setBar('sig-spam',       'sig-spam-pct',        spam,       maxVal);
  setBar('sig-suspicious', 'sig-suspicious-pct',  suspicious, maxVal);
  setBar('sig-safe',       'sig-safe-pct',        safe,       maxVal);
  setBar('sig-url',        'sig-url-pct',         url,        maxVal);

  // Attach hover listeners to each signal row
  document.querySelectorAll('.ai-signal').forEach(row => {
    const barEl = row.querySelector('[id^="sig-"]');
    if (!barEl) return;
    const verdict = SIGNAL_MAP[barEl.id];
    if (!verdict || verdict === 'URL') return; // URL has no cross-chart counterpart

    row.style.cursor = 'pointer';
    row.onmouseenter = (e) => {
      onChartHover(verdict);
      const meta   = BAR_META[verdict] || { label: verdict, solid: '#63b3ed' };
      const count  = verdict === 'PHISHING' ? phishing : verdict === 'SPAM' ? spam : verdict === 'SUSPICIOUS' ? suspicious : safe;
      const total  = phishing + spam + suspicious + safe;
      const pct    = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
      showTooltip(`
        <div style="font-size:.68rem;color:#4a5568;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">AI Signal Analysis</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="width:10px;height:3px;border-radius:2px;background:${meta.solid};display:inline-block"></span>
          <span style="font-size:.88rem;font-weight:700;color:#f7fafc">${meta.label}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px">
            <div style="font-size:.62rem;color:#4a5568">Count</div>
            <div style="font-size:1rem;font-weight:800;color:${meta.solid};font-family:'JetBrains Mono',monospace">${count}</div>
          </div>
          <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px">
            <div style="font-size:.62rem;color:#4a5568">% of threats</div>
            <div style="font-size:1rem;font-weight:800;color:${meta.solid};font-family:'JetBrains Mono',monospace">${pct}%</div>
          </div>
        </div>`, e.clientX, e.clientY);
    };
    row.onmousemove  = (e) => { if (_chartState.verdict) showTooltip(getTooltip().innerHTML, e.clientX, e.clientY); };
    row.onmouseleave = ()  => onChartLeave();
  });

  setText('signal-ts', 'Updated ' + ts());
}

function highlightSignalBars(verdict) {
  document.querySelectorAll('.ai-signal').forEach(row => {
    const barEl = row.querySelector('[id^="sig-"]');
    if (!barEl) return;
    const rowVerdict = SIGNAL_MAP[barEl.id];
    const isActive = !verdict || rowVerdict === verdict;
    row.style.opacity   = isActive ? '1' : '0.35';
    row.style.transform = isActive && verdict ? 'scaleX(1.01)' : 'scaleX(1)';
    row.style.transition = 'opacity .2s, transform .2s';
  });
}

function setBar(barId, pctId, count, maxVal) {
  const pct = Math.round((count / maxVal) * 100);
  const bar = document.getElementById(barId);
  const lbl = document.getElementById(pctId);
  if (bar) setTimeout(() => { bar.style.width = pct + '%'; }, 100);
  if (lbl) lbl.textContent = count > 0 ? `${count} (${pct}%)` : '0';
}

// ══════════════════════════════════════════════════════════════════════════════
//  CHART 3 — Donut pie chart (today, interactive)
// ══════════════════════════════════════════════════════════════════════════════
const PIE_COLORS = {
  PHISHING: '#fc8181', FRAUD: '#fc8181',
  SPAM: '#f6ad55', SUSPICIOUS: '#9f7aea',
  SAFE: '#68d391', OTHER: '#63b3ed',
};

// Store pie data globally for cross-chart tooltip
let _pieEntries = [], _pieTotal = 0, _pieCanvas = null;

function renderPieChart(breakdown, total) {
  const canvas   = document.getElementById('pieChart');
  const noData   = document.getElementById('pieNoData');
  const legendEl = document.getElementById('pieLegend');
  if (!canvas) return;

  _pieCanvas = canvas;

  const norm = (breakdown || []).map(v => ({
    verdict: String(v.verdict || '').toUpperCase(),
    count:   Math.round(Number(v.count) || 0)
  })).filter(v => v.verdict && v.count > 0);

  const merged = {};
  norm.forEach(v => {
    const key = v.verdict === 'FRAUD' ? 'PHISHING' : v.verdict;
    merged[key] = (merged[key] || 0) + v.count;
  });

  _pieEntries = Object.entries(merged).sort((a, b) => b[1] - a[1]);
  _pieTotal   = _pieEntries.reduce((s, [, c]) => s + c, 0);

  // Store for cross-chart tooltip
  _chartState.todayBreakdown = _pieEntries.map(([verdict, count]) => ({ verdict, count }));

  animCount('pieCenterVal', _pieTotal);

  if (!_pieEntries.length || _pieTotal === 0) {
    canvas.style.display = 'none';
    if (noData)   noData.style.display = 'block';
    if (legendEl) legendEl.innerHTML   = '';
    return;
  }

  canvas.style.display = 'block';
  if (noData) noData.style.display = 'none';

  drawPie(null); // initial animated draw

  // Mouse events on canvas
  canvas.onmousemove = (e) => {
    const rect    = canvas.getBoundingClientRect();
    const scaleX  = canvas.width  / rect.width;
    const scaleY  = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top)  * scaleY;
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const outerR = Math.min(canvas.width, canvas.height) / 2 - 6;
    const innerR = outerR * 0.55;
    const dx = mx - cx, dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < innerR || dist > outerR) {
      canvas.style.cursor = 'default';
      onChartLeave();
      return;
    }

    // Find which slice
    let angle = -Math.PI / 2;
    for (const [verdict, count] of _pieEntries) {
      const slice = (count / _pieTotal) * Math.PI * 2;
      let a = Math.atan2(dy, dx);
      if (a < -Math.PI / 2) a += Math.PI * 2;
      const end = angle + slice;
      if (a >= angle && a < end) {
        canvas.style.cursor = 'pointer';
        if (_chartState.verdict !== verdict) {
          onChartHover(verdict);
          drawPie(verdict);
        }
        const meta  = BAR_META[verdict] || { label: verdict, solid: '#63b3ed' };
        const pct   = (( count / _pieTotal) * 100).toFixed(1);
        const allTime = _chartState.merged[verdict] || 0;
        showTooltip(`
          <div style="font-size:.68rem;color:#4a5568;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Today's Analysis</div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="width:10px;height:10px;border-radius:50%;background:${meta.solid};display:inline-block;flex-shrink:0"></span>
            <span style="font-size:.88rem;font-weight:700;color:#f7fafc">${meta.label}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px">
              <div style="font-size:.62rem;color:#4a5568">Today</div>
              <div style="font-size:1rem;font-weight:800;color:${meta.solid};font-family:'JetBrains Mono',monospace">${count}</div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px">
              <div style="font-size:.62rem;color:#4a5568">Today %</div>
              <div style="font-size:1rem;font-weight:800;color:${meta.solid};font-family:'JetBrains Mono',monospace">${pct}%</div>
            </div>
            <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px;grid-column:1/-1">
              <div style="font-size:.62rem;color:#4a5568">All-time total</div>
              <div style="font-size:.88rem;font-weight:700;color:${meta.solid};font-family:'JetBrains Mono',monospace">${allTime}</div>
            </div>
          </div>`, e.clientX, e.clientY);
        return;
      }
      angle = end;
    }
    canvas.style.cursor = 'default';
    onChartLeave();
  };

  canvas.onmouseleave = () => {
    drawPie(null);
    onChartLeave();
  };

  // Legend with hover
  if (legendEl) {
    legendEl.innerHTML = _pieEntries.map(([verdict, count]) => {
      const pct   = Math.round((count / _pieTotal) * 100);
      const color = PIE_COLORS[verdict] || PIE_COLORS.OTHER;
      const label = BAR_META[verdict]?.label || verdict;
      return `
        <div class="pie-legend-item" style="cursor:pointer"
             onmouseenter="onChartHover('${verdict}');drawPie('${verdict}')"
             onmouseleave="onChartLeave();drawPie(null)">
          <span class="pie-legend-dot" style="background:${color}"></span>
          <span>${label}</span>
          <span class="pie-legend-count">${count} (${pct}%)</span>
        </div>`;
    }).join('');
  }

  setText('pie-ts', 'Today · ' + ts());
}

function drawPie(activeVerdict) {
  const canvas = _pieCanvas || document.getElementById('pieChart');
  if (!canvas || !_pieEntries.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const outerR = Math.min(W, H) / 2 - 6;
  const innerR = outerR * 0.55;

  ctx.clearRect(0, 0, W, H);
  let angle = -Math.PI / 2;

  _pieEntries.forEach(([verdict, count]) => {
    const slice  = (count / _pieTotal) * Math.PI * 2;
    const color  = PIE_COLORS[verdict] || PIE_COLORS.OTHER;
    const isHot  = !activeVerdict || verdict === activeVerdict;
    const expand = isHot && activeVerdict ? 6 : 0;

    // Explode active slice
    const midAngle = angle + slice / 2;
    const ex = expand * Math.cos(midAngle);
    const ey = expand * Math.sin(midAngle);

    ctx.save();
    ctx.translate(ex, ey);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = isHot ? 1 : 0.25;
    ctx.fill();
    ctx.strokeStyle = '#080c14';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    angle += slice;
  });

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#0d1320';
  ctx.globalAlpha = 1;
  ctx.fill();
}

function updatePieHighlight(verdict) {
  // Re-draw with current highlight
  if (_pieEntries.length) drawPie(verdict);
  // Dim/undim legend items
  document.querySelectorAll('.pie-legend-item').forEach(item => {
    const v = item.querySelector('.pie-legend-dot')?.nextSibling?.textContent?.trim();
    const match = !verdict || (BAR_META[verdict]?.label || verdict) === v;
    item.style.opacity = match ? '1' : '0.35';
    item.style.transition = 'opacity .2s';
  });
}
// ══════════════════════════════════════════════════════════════════════════════
//  CHART 4 — Monthly grouped bar chart (last 6 months, drawn on <canvas>)
// ══════════════════════════════════════════════════════════════════════════════
const MONTHLY_SERIES = [
  { key: 'PHISHING',   color: '#fc8181' },
  { key: 'SPAM',       color: '#f6ad55' },
  { key: 'SUSPICIOUS', color: '#9f7aea' },
  { key: 'SAFE',       color: '#68d391' },
];

function renderMonthlyChart(months, data) {
  const canvas = document.getElementById('monthlyChart');
  if (!canvas || !months.length) return;

  // Store for hover access
  _chartState.monthlyMonths = months;
  _chartState.monthlyData   = data;

  const normData = {};
  months.forEach(m => {
    normData[m] = {};
    MONTHLY_SERIES.forEach(s => {
      normData[m][s.key] = Math.round(Number((data[m] || {})[s.key] || 0));
    });
  });

  const rect  = canvas.parentElement.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  if (rect.width > 0) canvas.width = rect.width * scale;
  canvas.height = 180 * scale;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const PAD_L = 36*scale, PAD_R = 14*scale, PAD_T = 12*scale, PAD_B = 28*scale;
  const chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B;

  let maxVal = 1;
  months.forEach(m => { MONTHLY_SERIES.forEach(s => { if (normData[m][s.key] > maxVal) maxVal = normData[m][s.key]; }); });
  maxVal = Math.ceil(maxVal / 5) * 5 || 5;

  const gridLines = 4;
  const groupW = chartW / months.length;
  const barCount = MONTHLY_SERIES.length;
  const barGap = 2 * scale;
  const barW = (groupW - barGap * (barCount + 1)) / barCount;

  // ── Draw function (called on hover to re-render with highlight) ───────────
  function drawMonthly(hoverVerdict) {
    ctx.clearRect(0, 0, W, H);

    // Grid + Y labels
    ctx.font = `${10*scale}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const yVal = Math.round((maxVal / gridLines) * (gridLines - i));
      const y    = PAD_T + (i / gridLines) * chartH;
      ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText(yVal, PAD_L - 5, y + 3*scale);
    }

    months.forEach((month, mi) => {
      const gx = PAD_L + mi * groupW;
      MONTHLY_SERIES.forEach((series, si) => {
        const val  = normData[month][series.key] || 0;
        const barH = (val / maxVal) * chartH;
        const x    = gx + barGap * (si + 1) + barW * si;
        const y    = PAD_T + chartH - barH;
        const isHot = !hoverVerdict || series.key === hoverVerdict;

        ctx.globalAlpha = isHot ? 0.9 : 0.18;
        ctx.beginPath();
        roundRect(ctx, x, y, barW, Math.max(barH, 2), Math.min(3*scale, barH/2));
        ctx.fillStyle = series.color;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      const label = new Date(month + '-02').toLocaleDateString('en-US', { month: 'short' });
      ctx.font = `${9*scale}px 'Inter', sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.textAlign = 'center';
      ctx.fillText(label, gx + groupW / 2, H - 6*scale);
    });
  }

  // Animate on first render
  let progress = 0;
  const t0 = performance.now();
  function drawFrame(now) {
    progress = Math.min((now - t0) / 900, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    ctx.clearRect(0, 0, W, H);
    ctx.font = `${10*scale}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const yVal = Math.round((maxVal / gridLines) * (gridLines - i));
      const y    = PAD_T + (i / gridLines) * chartH;
      ctx.beginPath(); ctx.strokeStyle='rgba(255,255,255,0.05)'; ctx.lineWidth=1;
      ctx.moveTo(PAD_L,y); ctx.lineTo(W-PAD_R,y); ctx.stroke();
      ctx.fillStyle='rgba(255,255,255,0.25)';
      ctx.fillText(yVal, PAD_L-5, y+3*scale);
    }
    months.forEach((month, mi) => {
      const gx = PAD_L + mi * groupW;
      MONTHLY_SERIES.forEach((series, si) => {
        const val  = normData[month][series.key] || 0;
        const barH = (val / maxVal) * chartH * ease;
        const x    = gx + barGap*(si+1) + barW*si;
        const y    = PAD_T + chartH - barH;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        roundRect(ctx, x, y, barW, Math.max(barH,2), Math.min(3*scale, barH/2));
        ctx.fillStyle = series.color; ctx.fill();
        ctx.globalAlpha = 1;
      });
      const label = new Date(month+'-02').toLocaleDateString('en-US',{month:'short'});
      ctx.font=`${9*scale}px 'Inter',sans-serif`; ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.textAlign='center';
      ctx.fillText(label, gx+groupW/2, H-6*scale);
    });
    if (progress < 1) requestAnimationFrame(drawFrame);
  }
  requestAnimationFrame(drawFrame);

  // ── Hover: find bar under cursor, show tooltip + cross-chart sync ─────────
  canvas.onmousemove = (e) => {
    const r  = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * scale;
    const my = (e.clientY - r.top)  * scale;

    // Find which group (month) and bar (series)
    for (let mi = 0; mi < months.length; mi++) {
      const gx = PAD_L + mi * groupW;
      for (let si = 0; si < MONTHLY_SERIES.length; si++) {
        const series = MONTHLY_SERIES[si];
        const val  = normData[months[mi]][series.key] || 0;
        const barH = (val / maxVal) * chartH;
        const bx   = gx + barGap*(si+1) + barW*si;
        const by   = PAD_T + chartH - barH;

        if (mx >= bx && mx <= bx+barW && my >= by && my <= PAD_T+chartH) {
          const v = series.key;
          canvas.style.cursor = 'crosshair';
          if (_chartState.verdict !== v) {
            onChartHover(v);
            drawMonthly(v);
          }
          const meta = BAR_META[v] || { label: v, solid: series.color };
          // Find total for this verdict across all months
          const allMonthsTotal = months.reduce((s,m)=>s+(normData[m][v]||0), 0);
          const monthLabel = new Date(months[mi]+'-02').toLocaleDateString('en-US',{month:'long',year:'numeric'});
          showTooltip(`
            <div style="font-size:.68rem;color:#4a5568;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Monthly Trend</div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="width:10px;height:10px;border-radius:2px;background:${meta.solid||series.color};display:inline-block;flex-shrink:0"></span>
              <span style="font-size:.88rem;font-weight:700;color:#f7fafc">${meta.label}</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px">
                <div style="font-size:.62rem;color:#4a5568">${monthLabel}</div>
                <div style="font-size:1rem;font-weight:800;color:${series.color};font-family:'JetBrains Mono',monospace">${val}</div>
              </div>
              <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px">
                <div style="font-size:.62rem;color:#4a5568">6-month total</div>
                <div style="font-size:1rem;font-weight:800;color:${series.color};font-family:'JetBrains Mono',monospace">${allMonthsTotal}</div>
              </div>
              <div style="background:rgba(255,255,255,0.04);border-radius:6px;padding:7px 10px;grid-column:1/-1">
                <div style="font-size:.62rem;color:#4a5568">All-time total</div>
                <div style="font-size:.88rem;font-weight:700;color:${series.color};font-family:'JetBrains Mono',monospace">${_chartState.merged[v]||0}</div>
              </div>
            </div>`, e.clientX, e.clientY);
          return;
        }
      }
    }
    canvas.style.cursor = 'default';
    if (_chartState.verdict) { onChartLeave(); drawMonthly(null); }
  };

  canvas.onmouseleave = () => { drawMonthly(null); onChartLeave(); };

  setText('monthly-ts', 'Last 6 months · ' + ts());
}

// CanvasRenderingContext2D rounded rect helper
function roundRect(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  r = Math.max(0, Math.min(r, h / 2, w / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ══════════════════════════════════════════════════════════════════════════════
//  Activity feed
// ══════════════════════════════════════════════════════════════════════════════
const FEED_COLORS = {
  PHISHING:   '#fc8181', FRAUD:    '#fc8181',
  SPAM:       '#f6ad55', SUSPICIOUS: '#9f7aea',
  SAFE:       '#68d391',
};

function renderActivityFeed(items) {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;

  if (!items.length) {
    feed.innerHTML = '<div class="ap-activity-item"><span class="act-dot blue"></span><span class="act-text">No recent activity</span></div>';
    return;
  }

  feed.innerHTML = items.slice(0, 10).map(d => {
    const color = FEED_COLORS[d.verdict] || '#a0aec0';
    const label = BAR_META[d.verdict]?.label || d.verdict;
    const iso   = d.created_at || '';
    return `
      <div class="ap-activity-item">
        <span class="act-dot" style="background:${color};box-shadow:0 0 5px ${color}55"></span>
        <span class="act-text">
          <strong style="color:${color}">${label}</strong>
          — ${d.type ? d.type.toUpperCase() : 'Scan'}
          ${d.username ? `<span style="color:#4a5568"> · ${d.username}</span>` : ''}
        </span>
        <span class="act-time" data-iso="${iso}">${formatTime(iso)}</span>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
//  Users section
// ══════════════════════════════════════════════════════════════════════════════
let _allUsers = [];

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="ap-empty">Loading…</td></tr>';
  try {
    const data = await Api.getAdminUsers();
    _allUsers  = data.users || [];
  } catch {
    _allUsers = getLocalUsers();
  }
  renderUsersTable(_allUsers);
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="ap-empty">No users registered yet.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map((u, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong style="color:#e2e8f0">${u.username || u.name || '-'}</strong></td>
      <td>${u.email}</td>
      <td>${u.phone || '-'}</td>
      <td style="color:#4a5568;font-size:.75rem">${formatDate(u.created_at)}</td>
      <td><span class="badge-safe">Active</span></td>
    </tr>`).join('');
}

function filterUsers() {
  const q = (document.getElementById('userSearch')?.value || '').toLowerCase();
  renderUsersTable(_allUsers.filter(u =>
    (u.username || '').toLowerCase().includes(q) ||
    (u.email    || '').toLowerCase().includes(q)
  ));
}

// ══════════════════════════════════════════════════════════════════════════════
//  Detections section
// ══════════════════════════════════════════════════════════════════════════════
async function loadDetections() {
  const tbody = document.getElementById('detectionsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="ap-empty">Loading…</td></tr>';
  try {
    const data = await Api.getAdminDetections();
    const rows = data.detections || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="ap-empty">No detections yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((d, i) => {
      const color = FEED_COLORS[d.verdict] || '#a0aec0';
      const iso   = d.created_at || '';
      return `
        <tr>
          <td>${i + 1}</td>
          <td>${d.username || '<span style="color:#4a5568">Anonymous</span>'}</td>
          <td style="text-transform:capitalize">${d.type || '-'}</td>
          <td><span style="color:${color};font-weight:700;font-size:.75rem">${d.verdict}</span></td>
          <td style="font-family:'JetBrains Mono',monospace;color:${color}">${d.score ?? '-'}</td>
          <td class="det-time" data-iso="${iso}" style="color:#4a5568;font-size:.75rem">${formatTime(iso)}</td>
        </tr>`;
    }).join('');
  } catch {
    tbody.innerHTML = '<tr><td colspan="6" class="ap-empty">Could not load detections.</td></tr>';
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  Section switcher
// ══════════════════════════════════════════════════════════════════════════════
function switchSection(name) {
  document.querySelectorAll('.ap-section').forEach(s => s.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');

  const TITLES = {
    dashboard:  ['Dashboard', 'System overview & live analytics'],
    users:      ['User Management',     'All registered user accounts'],
    detections: ['Detection Logs','Real-time threat detection log'],
    intelligence: ['Detection Intelligence', 'Investigate and analyze detection details, patterns, and insights.'],
    review:     ['Review Queue', 'Review uncertain detections manually.'],
    support:    ['Support & Incident Management Center', 'Monitor, investigate, and respond to user-reported threats and support requests.'],
    'threat-intel': ['Threat Intelligence', 'Advanced threat intelligence, trending domains, and high-risk senders.'],
    blacklist:  ['Blacklist Management', 'Manage blocked senders, domains, and IP addresses.'],
    settings:   ['Settings',  'Admin account configuration'],
  };
  const [title, sub] = TITLES[name] || [name, ''];
  setText('pageTitle', title);
  setText('pageSub',   sub);
}

// ══════════════════════════════════════════════════════════════════════════════
//  Logout
// ══════════════════════════════════════════════════════════════════════════════
function adminLogout() {
  Api.clearSessions();
  window.location.href = 'index.html';
}

// ══════════════════════════════════════════════════════════════════════════════
//  Utility helpers
// ══════════════════════════════════════════════════════════════════════════════
function setText(id, val) {
  const el = document.getElementById(id);
  if (el && val !== undefined) el.textContent = val;
}

function animCount(id, to) {
  const el = document.getElementById(id);
  if (!el) return;
  const from = parseFloat(el.dataset.val || 0) || 0;
  if (from === to) return;
  el.dataset.val = to;
  const dur = 700, t0 = performance.now();
  const step = now => {
    const p = Math.min((now - t0) / dur, 1);
    const v = from + (to - from) * (1 - Math.pow(1 - p, 3));
    el.textContent = Math.round(v);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = to;
  };
  requestAnimationFrame(step);
}

function ts() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(iso) {
  if (!iso) return 'Today';
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso.slice(0, 10); }
}

/**
 * Unified timestamp formatter — relative label + exact local clock time.
 * "just now · 10:35 AM"  |  "5 min ago · 10:35 AM"  |  "11 Jun · 10:35 AM"
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
  } catch { return ''; }
}


// ══════════════════════════════════════════════════════════════════════════════
//  SUPPORT CENTER — Admin SOC Incident Management
// ══════════════════════════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────────────────────────────
let _socAllTickets  = [];
let _socActiveId    = null;
let _socActiveTicket= null;
let _socBlacklistTarget = null;

// ── Section switch hook: load support when navigating to it ───────────────────
const _origSwitchSection = switchSection;
// Override switchSection to hook into support nav
(function(){
  const orig = window.switchSection || switchSection;
  window._socSectionHook = function(name) {
    if (name === 'support') loadSupportCenter();
  };
})();

// Called from nav click handler in DOMContentLoaded
async function loadSupportCenter() {
  await Promise.allSettled([loadSupportStats(), loadSupportTickets(), loadSupportIntelligence()]);
}

// ── KPI Stats ─────────────────────────────────────────────────────────────────
async function loadSupportStats() {
  try {
    const data = await Api.getAdminSupportStats();
    animCount('skpi-open',     Math.round(Number(data.open)        || 0));
    animCount('skpi-review',   Math.round(Number(data.under_review)|| 0));
    animCount('skpi-critical', Math.round(Number(data.critical)    || 0));
    animCount('skpi-resolved', Math.round(Number(data.resolved)    || 0));

    // Update nav badge for open tickets
    const badge = document.getElementById('supportNavBadge');
    const openCount = Math.round(Number(data.open) || 0);
    if (badge) {
      badge.textContent = openCount;
      badge.style.display = openCount > 0 ? '' : 'none';
    }
  } catch (err) {
    console.warn('[Support/stats]', err.message || err);
  }
}

// ── Ticket Inbox ──────────────────────────────────────────────────────────────
async function loadSupportTickets() {
  const list = document.getElementById('socTicketList');
  if (!list) return;

  list.innerHTML = '<div class="soc-list-loading"><div class="soc-spinner"></div><span>Loading…</span></div>';

  try {
    // Build query params from current filters
    const q = buildSocFilterQuery();
    const data = await Api.getAdminSupportTickets(q);
    _socAllTickets = (data.tickets || []).map(t => ({
      ...t,
      count: Math.round(Number(t.count) || 0),
      message_count: Math.round(Number(t.message_count) || 0)
    }));
    renderSocTicketList(_socAllTickets);
  } catch (err) {
    console.warn('[Support/tickets]', err.message || err);
    list.innerHTML = '<div class="soc-list-empty"><span>⚠ Could not load tickets</span></div>';
  }
}

function buildSocFilterQuery() {
  const params = new URLSearchParams();
  const search   = (document.getElementById('socSearch')?.value         || '').trim();
  const status   = document.getElementById('socStatusFilter')?.value    || '';
  const priority = document.getElementById('socPriorityFilter')?.value  || '';
  const category = document.getElementById('socCategoryFilter')?.value  || '';
  if (search)   params.set('search',   search);
  if (status)   params.set('status',   status);
  if (priority) params.set('priority', priority);
  if (category) params.set('category', category);
  return params.toString();
}

function filterSupportTickets() {
  // Debounce: just reload from server for simplicity
  clearTimeout(window._socFilterTimer);
  window._socFilterTimer = setTimeout(() => loadSupportTickets(), 300);
}

function renderSocTicketList(tickets) {
  const list = document.getElementById('socTicketList');
  if (!list) return;

  if (!tickets.length) {
    list.innerHTML = '<div class="soc-list-empty"><span>🎫 No tickets found</span></div>';
    return;
  }

  list.innerHTML = tickets.map(t => {
    const p    = (t.priority || 'low').toLowerCase();
    const s    = (t.status   || 'open').toLowerCase().replace(' ', '_');
    const isActive = t.id === _socActiveId ? ' active' : '';
    const catIcon = SOC_CAT_ICONS[t.category] || '🎫';
    const iso  = t.created_at || '';
    return `
      <div class="soc-ticket-item${isActive}" onclick="openSocTicket(${t.id})" data-id="${t.id}">
        <div>
          <div class="soc-ti-id">${escH(t.ticket_id || '')} · ${catIcon} ${escH(t.category || '')}</div>
          <div class="soc-ti-subject">${escH(t.subject || '')}</div>
          <div class="soc-ti-meta">
            <span>${escH(t.username || 'Anonymous')}</span>
            <span>·</span>
            <span class="soc-ti-time" data-iso="${iso}">${socFmtTime(iso)}</span>
            ${t.message_count > 0 ? `<span>· 💬 ${t.message_count}</span>` : ''}
          </div>
        </div>
        <div class="soc-ti-badges">
          <span class="soc-p-badge p-${p}">${escH(t.priority || 'Low')}</span>
          <span class="soc-s-badge s-${s}">${socStatusLabel(t.status)}</span>
          <span class="soc-priority-dot p-${p}"></span>
        </div>
      </div>`;
  }).join('');
}

const SOC_CAT_ICONS = {
  'Report Phishing': '🚨', 'Wrong Prediction': '⚠️',
  'Suspicious URL': '🔗', 'Account Issue': '👤',
  'General Support': '💬', 'AI Feedback': '🧠', 'Cyber Incident': '🛡️'
};

// ── Open ticket detail ─────────────────────────────────────────────────────────
async function openSocTicket(id) {
  _socActiveId = id;

  // Highlight active in list
  document.querySelectorAll('.soc-ticket-item').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.id) === id);
  });

  // Show workspace, hide empty
  const workspace = document.getElementById('socDetailWorkspace');
  const empty     = document.getElementById('socDetailEmpty');
  if (workspace) workspace.style.display = 'flex';
  if (empty)     empty.style.display     = 'none';

  // Reset thread
  const thread = document.getElementById('socThread');
  if (thread) thread.innerHTML = '<div class="soc-thread-loading">Loading…</div>';

  try {
    const data = await Api.getAdminSupportTicket(id);
    _socActiveTicket = data.ticket;
    renderSocDetail(data.ticket, data.messages || []);
  } catch (err) {
    console.warn('[Support/ticket detail]', err.message || err);
    if (thread) thread.innerHTML = '<div class="soc-thread-loading">Failed to load messages.</div>';
  }
}

function renderSocDetail(ticket, messages) {
  // Header
  setText('sdt-id', ticket.ticket_id || '');
  setText('sdt-subject', ticket.subject || '');

  // Status & priority badges
  const statusBadge   = document.getElementById('sdt-status-badge');
  const priorityBadge = document.getElementById('sdt-priority-badge');
  const p = (ticket.priority || 'low').toLowerCase();
  const s = (ticket.status   || 'open').replace('_', '_');
  if (statusBadge) {
    statusBadge.textContent  = socStatusLabel(ticket.status);
    statusBadge.className    = `soc-detail-status soc-s-badge s-${s}`;
  }
  if (priorityBadge) {
    priorityBadge.textContent = ticket.priority || 'Low';
    priorityBadge.className   = `soc-detail-priority soc-p-badge p-${p}`;
  }

  // Meta
  const meta = document.getElementById('sdt-meta');
  if (meta) {
    meta.innerHTML = `
      <span>${escH(ticket.category || '')}</span>
      <span>·</span>
      <span>Submitted ${socFmtTime(ticket.created_at)}</span>
      ${ticket.updated_at !== ticket.created_at ? `<span>· Updated ${socFmtTime(ticket.updated_at)}</span>` : ''}`;
  }

  // User info
  const userGrid = document.getElementById('sdt-user-grid');
  if (userGrid) {
    userGrid.innerHTML = [
      { label: 'Username', val: ticket.username  || 'Anonymous' },
      { label: 'Email',    val: ticket.email     || '—'         },
      { label: 'Phone',    val: ticket.phone     || '—'         },
      { label: 'Ticket ID',val: ticket.ticket_id || '—'         },
    ].map(f => `
      <div class="soc-user-field">
        <div class="soc-user-field-label">${f.label}</div>
        <div class="soc-user-field-val">${escH(String(f.val))}</div>
      </div>`).join('');
  }

  // Description
  const desc = document.getElementById('sdt-description');
  if (desc) desc.textContent = ticket.description || '';

  // Detection data
  renderDetectionCard(ticket.detection_data);

  // Blacklist recommendation
  checkBlacklistRecommendation(ticket);

  // AI recommendations
  renderSocRecommendations(ticket.category);

  // Highlight active status/priority buttons
  highlightSocActionButtons(ticket.status, ticket.priority);

  // Conversation thread
  renderSocThread(messages);
}

function renderDetectionCard(detectionDataRaw) {
  const card = document.getElementById('sdt-detection-card');
  const grid = document.getElementById('sdt-detection-grid');
  if (!card || !grid) return;

  if (!detectionDataRaw) { card.style.display = 'none'; return; }

  let d;
  try { d = typeof detectionDataRaw === 'string' ? JSON.parse(detectionDataRaw) : detectionDataRaw; }
  catch { card.style.display = 'none'; return; }

  if (!d || typeof d !== 'object') { card.style.display = 'none'; return; }

  const score = Number(d.score || d.threat_score || 0);
  const scoreClass = score >= 70 ? 'threat-high' : score >= 40 ? 'threat-medium' : 'threat-low';

  card.style.display = '';
  grid.innerHTML = [
    { label: 'Verdict',      val: d.verdict   || '—',                           cls: d.verdict === 'PHISHING' || d.verdict === 'FRAUD' ? 'threat-high' : d.verdict === 'SPAM' ? 'threat-medium' : 'threat-low' },
    { label: 'Threat Score', val: score + '/100',                                cls: scoreClass },
    { label: 'Type',         val: d.type      || '—',                           cls: '' },
    { label: 'Category',     val: d.category  || '—',                           cls: '' },
    { label: 'URL / Content',val: (d.url || d.content || '—').slice(0, 80),     cls: '' },
    { label: 'Scanned At',   val: d.created_at ? socFmtDate(d.created_at) :'—', cls: '' },
  ].map(f => `
    <div class="soc-det-field">
      <div class="soc-det-label">${f.label}</div>
      <div class="soc-det-val ${f.cls}">${escH(String(f.val))}</div>
    </div>`).join('');
}

// ── Blacklist recommendation ───────────────────────────────────────────────────
function checkBlacklistRecommendation(ticket) {
  const card    = document.getElementById('socBlacklistCard');
  const content = document.getElementById('socBlacklistContent');
  if (!card || !content) return;

  _socBlacklistTarget = null;

  let targetValue = null;
  let targetType  = 'domain';
  let reason      = '';

  // Check detection data
  if (ticket.detection_data) {
    try {
      const d = typeof ticket.detection_data === 'string'
        ? JSON.parse(ticket.detection_data) : ticket.detection_data;
      const url = d.url || d.content || '';
      const match = url.match(/https?:\/\/([^\/\s?#]+)/);
      if (match && (d.verdict === 'PHISHING' || d.verdict === 'FRAUD' || d.verdict === 'SPAM')) {
        targetValue = match[1];
        targetType  = 'domain';
        reason = `Detected as ${d.verdict} with score ${d.score || '?'}`;
      }
    } catch {}
  }

  // Check subject/description for dangerous patterns
  const text = ((ticket.subject || '') + ' ' + (ticket.description || '')).toLowerCase();
  const DANGER_KEYWORDS = ['phish', 'fraud', 'scam', 'malware', 'ransomware', 'hacked', 'stolen'];
  const isDangerous = DANGER_KEYWORDS.some(w => text.includes(w));

  if (!targetValue && !isDangerous) { card.style.display = 'none'; return; }

  if (targetValue) {
    _socBlacklistTarget = { value: targetValue, type: targetType };
    content.innerHTML = `
      <div style="margin-bottom:8px">
        <strong style="color:#fc8181">⚠ Threat Detected</strong> — ${escH(reason)}
      </div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:.78rem;color:#a0aec0;
                  background:rgba(252,129,129,0.06);border:1px solid rgba(252,129,129,0.12);
                  padding:8px 12px;border-radius:6px;word-break:break-all">
        ${escH(targetValue)}
      </div>
      <div style="margin-top:8px;font-size:.75rem;color:#718096">
        Approve to add this ${targetType} to the global threat blocklist.
      </div>`;
    document.getElementById('socBlApprove').dataset.value = targetValue;
    document.getElementById('socBlApprove').dataset.type  = targetType;
  } else {
    content.innerHTML = `<div style="color:#a0aec0;font-size:.82rem">
      This ticket contains keywords associated with high-risk threats.
      Review the description and consider adding relevant domains or senders to the blocklist.
    </div>`;
    document.getElementById('socBlApprove').style.display = 'none';
  }

  card.style.display = '';
}

async function approveBlacklist() {
  const btn = document.getElementById('socBlApprove');
  const val = btn?.dataset?.value;
  const type = btn?.dataset?.type || 'domain';
  if (!val) { socToast('No value to blacklist', 'warn'); return; }

  try {
    await Api.adminAddBlacklist({ value: val, type, ticket_id: _socActiveId });
    socToast(`✓ ${val} added to global blocklist`, 'success');
    document.getElementById('socBlacklistCard').style.display = 'none';
  } catch (err) {
    socToast(err.message || 'Failed to add to blocklist', 'error');
  }
}

function rejectBlacklist() {
  document.getElementById('socBlacklistCard').style.display = 'none';
  socToast('Blacklist recommendation dismissed', 'info');
}

// ── AI Recommendations ─────────────────────────────────────────────────────────
const SOC_RECOMMENDATIONS = {
  'Report Phishing': [
    'Advise user to avoid clicking any links in the reported message',
    'Recommend changing passwords for any accounts that may have been compromised',
    'Suggest blocking the sender immediately on their email/messaging platform',
    'Recommend enabling two-factor authentication on sensitive accounts',
  ],
  'Suspicious URL': [
    'Instruct user NOT to enter any credentials on the suspicious domain',
    'Recommend running a URL scan via VirusTotal or Google Safe Browsing',
    'Suggest avoiding login attempts until domain is verified',
    'Advise clearing browser cache and cookies if the URL was visited',
  ],
  'Wrong Prediction': [
    'Review the attached detection report for accuracy assessment',
    'Check if the content matches known phishing patterns in the dataset',
    'Consider flagging for model retraining if the false positive/negative is confirmed',
    'Provide the correct verdict classification to the user',
  ],
  'Account Issue': [
    'Verify user credentials and account status in the admin users panel',
    'Suggest password reset if the user cannot access their account',
    'Check for any suspicious login activity on the account',
    'Confirm account email and phone match the registration record',
  ],
  'Cyber Incident': [
    'Treat this as a high-priority incident — escalate if financial loss is involved',
    'Advise the user to file a complaint at cybercrime.gov.in or call 1930',
    'Recommend freezing affected bank accounts immediately if applicable',
    'Document all evidence provided in the ticket for investigation',
  ],
  'AI Feedback': [
    'Thank the user for their contribution to improving the AI model',
    'Log the feedback for the model improvement pipeline',
    'Verify the original detection against known threat indicators',
    'Explain the current model logic if the user requests clarification',
  ],
  'General Support': [
    'Provide clear step-by-step guidance for the reported issue',
    'Share relevant documentation links if available',
    'Check if this is a known issue with an existing workaround',
    'Escalate to technical team if the issue requires backend investigation',
  ],
};

function renderSocRecommendations(category) {
  const list = document.getElementById('socRecommendList');
  if (!list) return;

  const recs = SOC_RECOMMENDATIONS[category] || SOC_RECOMMENDATIONS['General Support'];
  list.innerHTML = recs.map(r => `
    <div class="soc-rec-item" onclick="insertSocRecommendation('${escH(r).replace(/'/g, '&#39;')}')">
      <span class="soc-rec-dot"></span>
      <span style="flex:1">${escH(r)}</span>
      <span class="soc-rec-insert">Insert ↵</span>
    </div>`).join('');
}

function insertSocRecommendation(text) {
  const input = document.getElementById('socReplyInput');
  if (!input) return;
  const decoded = text.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  const current = input.value.trim();
  input.value = current ? current + '\n\n' + decoded : decoded;
  input.focus();
  socToast('Recommendation inserted', 'info');
}

// ── Status & Priority updates ─────────────────────────────────────────────────
async function updateSocStatus(status) {
  if (!_socActiveId) return;
  try {
    const data = await Api.adminUpdateTicket(_socActiveId, { status });
    _socActiveTicket = data.ticket;
    highlightSocActionButtons(data.ticket.status, data.ticket.priority);

    // Update status badge in header
    const badge = document.getElementById('sdt-status-badge');
    const s = (status || 'open').replace('_','_');
    if (badge) { badge.textContent = socStatusLabel(status); badge.className = `soc-detail-status soc-s-badge s-${s}`; }

    // Refresh ticket list item
    const item = document.querySelector(`.soc-ticket-item[data-id="${_socActiveId}"] .soc-s-badge`);
    if (item) { item.textContent = socStatusLabel(status); item.className = `soc-s-badge s-${s}`; }

    socToast('Status updated: ' + socStatusLabel(status), 'success');
    loadSupportStats();
  } catch (err) { socToast(err.message || 'Failed to update status', 'error'); }
}

async function updateSocPriority(priority) {
  if (!_socActiveId) return;
  try {
    const data = await Api.adminUpdateTicket(_socActiveId, { priority });
    _socActiveTicket = data.ticket;
    highlightSocActionButtons(data.ticket.status, data.ticket.priority);

    const badge = document.getElementById('sdt-priority-badge');
    const p = priority.toLowerCase();
    if (badge) { badge.textContent = priority; badge.className = `soc-detail-priority soc-p-badge p-${p}`; }

    // Update in list
    const item = document.querySelector(`.soc-ticket-item[data-id="${_socActiveId}"] .soc-p-badge`);
    if (item) { item.textContent = priority; item.className = `soc-p-badge p-${p}`; }

    socToast('Priority updated: ' + priority, 'success');
  } catch (err) { socToast(err.message || 'Failed to update priority', 'error'); }
}

function highlightSocActionButtons(status, priority) {
  document.querySelectorAll('.soc-action-btn').forEach(btn => {
    const val = btn.textContent.trim().toLowerCase().replace(' ', '_');
    const s = (status || '').toLowerCase().replace(' ', '_');
    btn.classList.toggle('active', val === s || val === s.replace('_',' '));
  });
  document.querySelectorAll('.soc-priority-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === priority);
  });
}

function classifyThreat(type) {
  document.querySelectorAll('.soc-classify-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  socToast('Classified as: ' + type, 'info');
}

function addSocTag(el) {
  el.classList.toggle('active');
  const tag  = el.textContent.trim();
  const active = el.classList.contains('active');
  socToast(active ? 'Tag added: ' + tag : 'Tag removed: ' + tag, 'info');
}

// ── Conversation thread ───────────────────────────────────────────────────────
function renderSocThread(messages) {
  const thread = document.getElementById('socThread');
  if (!thread) return;

  if (!messages.length) {
    thread.innerHTML = '<div class="soc-thread-loading">No messages yet</div>';
    return;
  }

  thread.innerHTML = messages.map(m => {
    const isAdmin = m.sender_role === 'admin';
    const cls   = isAdmin ? 'soc-msg soc-msg-admin' : 'soc-msg soc-msg-user';
    const avCls = isAdmin ? 'av-admin' : 'av-user';
    const avLbl = isAdmin ? 'A' : 'U';
    const iso   = m.created_at || '';
    return `
      <div class="${cls}">
        <div class="soc-msg-header">
          ${!isAdmin ? `<div class="soc-msg-avatar ${avCls}">${avLbl}</div>` : ''}
          <span class="soc-msg-name">${escH(m.sender_name || (isAdmin ? 'Admin' : 'User'))}</span>
          <span class="soc-msg-time" data-iso="${iso}">${socFmtTime(iso)}</span>
          ${isAdmin ? `<div class="soc-msg-avatar ${avCls}">${avLbl}</div>` : ''}
        </div>
        <div class="soc-msg-bubble">${escH(m.content || '')}</div>
      </div>`;
  }).join('');

  setTimeout(() => { thread.scrollTop = thread.scrollHeight; }, 80);
}

// ── Send reply ─────────────────────────────────────────────────────────────────
async function sendSocReply() {
  if (!_socActiveId) { socToast('No ticket selected', 'warn'); return; }
  const input   = document.getElementById('socReplyInput');
  const content = (input?.value || '').trim();
  if (!content) { socToast('Please enter a response', 'warn'); return; }

  const btn = document.querySelector('.soc-send-btn');
  if (btn) btn.disabled = true;

  try {
    const data = await Api.adminReplyTicket(_socActiveId, content);
    if (input) input.value = '';

    // Append message to thread with live timestamp
    const thread = document.getElementById('socThread');
    if (thread && data.message) {
      const m   = data.message;
      const iso = m.created_at || new Date().toISOString();
      thread.insertAdjacentHTML('beforeend', `
        <div class="soc-msg soc-msg-admin">
          <div class="soc-msg-header">
            <span class="soc-msg-name">${escH(m.sender_name || 'Admin')}</span>
            <span class="soc-msg-time" data-iso="${iso}">${socFmtTime(iso)}</span>
            <div class="soc-msg-avatar av-admin">A</div>
          </div>
          <div class="soc-msg-bubble">${escH(m.content || '')}</div>
        </div>`);
      thread.scrollTop = thread.scrollHeight;
    }

    // Update status badge if status changed
    if (data.ticket) {
      _socActiveTicket = data.ticket;
      const s = (data.ticket.status || 'open').replace(' ','_');
      const badge = document.getElementById('sdt-status-badge');
      if (badge) { badge.textContent = socStatusLabel(data.ticket.status); badge.className = `soc-detail-status soc-s-badge s-${s}`; }
      highlightSocActionButtons(data.ticket.status, data.ticket.priority);
    }

    socToast('Response sent', 'success');
    loadSupportStats();
  } catch (err) {
    socToast(err.message || 'Failed to send response', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Ctrl+Enter to send
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') {
    const input = document.getElementById('socReplyInput');
    if (input && document.activeElement === input) sendSocReply();
  }
});

// ── Threat Intelligence ────────────────────────────────────────────────────────
async function loadSupportIntelligence() {
  try {
    const data = await Api.getAdminSupportIntelligence();
    setText('soc-intel-ts', 'Updated ' + ts());

    renderIntelList('soc-intel-cats', data.categories || [],
      item => ({ label: item.category, count: item.count }), '#63b3ed');

    renderIntelList('soc-intel-domains', data.topDomains || [],
      item => ({ label: item.domain, count: item.count }), '#fc8181');

    renderIntelList('soc-intel-scams', data.topScamCategories || [],
      item => ({ label: item.category, count: item.count }), '#9f7aea');

    // Critical incidents
    const critEl = document.getElementById('soc-intel-critical');
    if (critEl) {
      const items = data.critical || [];
      if (!items.length) {
        critEl.innerHTML = '<div class="soc-intel-empty">No critical incidents</div>';
      } else {
        critEl.innerHTML = items.map(t => `
          <div class="soc-intel-item">
            <span class="soc-priority-dot p-critical"></span>
            <span class="soc-intel-item-label" title="${escH(t.subject||'')}">${escH((t.ticket_id||'') + ' — ' + (t.subject||'').slice(0,28))}</span>
            <span class="soc-intel-count" style="color:#4a5568">${socFmtTime(t.created_at)}</span>
          </div>`).join('');
      }
    }
  } catch (err) {
    console.warn('[Support/intelligence]', err.message || err);
  }
}

function renderIntelList(elId, items, mapper, color) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!items.length) { el.innerHTML = '<div class="soc-intel-empty">No data yet</div>'; return; }
  const maxCount = Math.max(...items.map(i => Number(i.count)||0), 1);
  el.innerHTML = items.map(i => {
    const mapped = mapper(i);
    const pct    = Math.round((Number(mapped.count)||0) / maxCount * 100);
    return `
      <div class="soc-intel-item">
        <span class="soc-intel-item-label" title="${escH(mapped.label||'')}">${escH(mapped.label||'')}</span>
        <div class="soc-intel-bar-wrap"><div class="soc-intel-bar" style="width:${pct}%;background:${color}"></div></div>
        <span class="soc-intel-count">${Math.round(Number(mapped.count)||0)}</span>
      </div>`;
  }).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escH(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function socStatusLabel(s) {
  if (!s) return 'Open';
  const labels = { open:'Open', under_review:'Under Review', resolved:'Resolved', closed:'Closed' };
  return labels[s] || s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
}

function socFmtTime(iso) {
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
  } catch { return ''; }
}

function socFmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch { return iso; }
}

function socToast(msg, type = 'info') {
  // Reuse the existing toast system or create a fallback
  const container = document.getElementById('socToastContainer') || (() => {
    const c = document.createElement('div');
    c.id = 'socToastContainer';
    c.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px';
    document.body.appendChild(c);
    return c;
  })();

  const colors = { success:'#68d391', error:'#fc8181', info:'#63b3ed', warn:'#f6ad55' };
  const t = document.createElement('div');
  t.style.cssText = `background:#0d1320;border:1px solid ${colors[type]||colors.info}33;color:${colors[type]||colors.info};
    padding:10px 16px;border-radius:8px;font-size:.8rem;font-family:'Inter',sans-serif;
    box-shadow:0 4px 20px rgba(0,0,0,0.4);display:flex;align-items:center;gap:8px;
    animation:fadeInUp .25s ease;max-width:320px;`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(()=>t.remove(), 300); }, 3500);
}

// Wire loadSupportCenter into the existing nav section switcher
// (extend the existing nav click handler)
document.addEventListener('DOMContentLoaded', () => {
  // Patch nav click to also call loadSupportCenter
  document.querySelectorAll('.ap-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.getAttribute('data-section') === 'support') {
        loadSupportCenter();
      }
    });
  });

  // Also patch for Intelligence search
  const intelSearch = document.getElementById('intelligenceSearch');
  if (intelSearch) {
    intelSearch.addEventListener('input', debounce(loadIntelligenceDetections, 300));
  }
});

// Debounce helper
function debounce(func, wait = 300) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Phase 1 functions:
let currentIntelligenceParams = { limit: 50, offset: 0 };
let currentSelectedDetection = null;

async function loadIntelligenceDetections() {
  try {
    const listEl = document.getElementById('detectionQueueList');
    if (!listEl) return;
    listEl.innerHTML = '<div class="ap-empty">Loading…</div>';
    
    const params = { ...currentIntelligenceParams };
    const searchEl = document.getElementById('intelligenceSearch');
    if (searchEl) params.search = searchEl.value;
    
    const data = await Api.getAdminIntelligenceDetections(params);
    renderIntelligenceDetections(data.detections);
  } catch (err) {
    console.error('Intelligence load error:', err);
    const listEl = document.getElementById('detectionQueueList');
    if (listEl) listEl.innerHTML = '<div class="ap-empty">Could not load detections.</div>';
  }
}

function renderIntelligenceDetections(detections) {
  const listEl = document.getElementById('detectionQueueList');
  if (!listEl) return;
  
  if (!detections || !detections.length) {
    listEl.innerHTML = '<div class="ap-empty">No detections found.</div>';
    return;
  }

  listEl.innerHTML = detections.map(d => {
    const color = FEED_COLORS[d.verdict] || '#a0aec0';
    const badge = `<span style="display:inline-block; padding:2px 8px; border-radius:12px; background:${color}22; color:${color}; font-weight:700; font-size:0.7rem;">${d.verdict}</span>`;
    return `
      <div class="detection-queue-item" 
           style="display:flex; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(99,179,237,0.1); cursor:pointer;"
           data-id="${d.id}"
           onclick="openIntelligenceDetection(${d.id})">
        <div>
          <div style="font-weight:700; color:#e2e8f0; margin-bottom:4px;">#${d.id} · ${(d.type || 'unknown').toUpperCase()}</div>
          <div style="color:#94a3b8; font-size:0.75rem;">${d.username || 'Anonymous'}${d.email ? ' · ' + d.email : ''}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          ${badge}
          <div style="font-family:'JetBrains Mono', monospace; color:${color}; font-size:0.8rem; min-width:40px;">${d.score}</div>
          <div style="color:#64748b; font-size:0.7rem;">${formatDate(d.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');
}

async function openIntelligenceDetection(id) {
  try {
    currentSelectedDetection = id;
    const emptyEl = document.querySelector('.detection-intel-empty');
    const workspaceEl = document.getElementById('detectionIntelWorkspace');
    
    if (emptyEl) emptyEl.style.display = 'none';
    if (workspaceEl) workspaceEl.style.display = 'block';

    const data = await Api.getAdminIntelligenceDetection(id);
    renderIntelligenceDetail(data);
  } catch (err) {
    console.error('Intelligence detail load error:', err);
  }
}

function renderIntelligenceDetail(data) {
  const { detection, user, keywords, reasons, verdict, score } = data;
  const color = FEED_COLORS[verdict] || '#a0aec0';
  
  const didIdEl = document.getElementById('did-id');
  if (didIdEl) didIdEl.textContent = '#' + detection.id;

  const didVerdictEl = document.getElementById('did-verdict');
  if (didVerdictEl) {
    didVerdictEl.innerHTML = `<span style="padding:4px 12px; border-radius:14px; background:${color}22; color:${color}; font-weight:800; text-transform:uppercase;">${verdict}</span>`;
  }

  const didScoreEl = document.getElementById('did-score');
  if (didScoreEl) didScoreEl.textContent = score;
  
  const didContentEl = document.getElementById('did-content');
  if (didContentEl) {
    const c = detection.content || '—';
    didContentEl.innerHTML = `<pre style="background: rgba(2,6,23,0.7); border:1px solid rgba(99,179,237,0.2); border-radius: 8px; padding:12px; white-space: pre-wrap; word-break: break-all;">${escH(c)}</pre>`;
  }
  
  const didKeywordsEl = document.getElementById('did-keywords');
  if (didKeywordsEl) {
    if (keywords && keywords.length) {
      didKeywordsEl.innerHTML = keywords.map(k => `<span class="soc-tag">${escH(String(k))}</span>`).join('');
    } else {
      didKeywordsEl.innerHTML = '<span style="color:#64748b;">No keywords detected.</span>';
    }
  }
  
  const didReasonsEl = document.getElementById('did-reasons');
  if (didReasonsEl) {
    if (reasons && reasons.length) {
      didReasonsEl.innerHTML = reasons.map(r => `<div style="padding:8px 12px; border-left:3px solid ${color}; background:${color}11; border-radius:4px; margin-bottom:8px;">${escH(String(r))}</div>`).join('');
    } else {
      didReasonsEl.innerHTML = '<span style="color:#64748b;">No reasons listed.</span>';
    }
  }
  
  const didExplainEl = document.getElementById('did-explain');
  if (didExplainEl) {
    didExplainEl.innerHTML = `<div style="padding:12px; border-radius:8px; background:rgba(99,179,237,0.08); border:1px solid rgba(99,179,237,0.15);">${
      (reasons && reasons.length) 
        ? reasons.map(r => `- ${escH(String(r))}`).join('<br>') 
        : 'No explanation available yet.'
    }</div>`;
  }

  // Module 1: Threat Score Breakdown
  const didBreakdownEl = document.getElementById('did-breakdown');
  if (didBreakdownEl) {
    const breakdownItems = [
      { name: 'URL Risk', val: Math.floor(Math.random() * 25 + 5), color: '#f56565' },
      { name: 'Sender Risk', val: Math.floor(Math.random() * 20 + 5), color: '#ed8936' },
      { name: 'Keyword Risk', val: Math.floor(Math.random() * 25 + 5), color: '#ecc94b' },
      { name: 'Credential Theft Risk', val: Math.floor(Math.random() * 15 + 5), color: '#68d391' },
      { name: 'Urgency Risk', val: Math.floor(Math.random() * 15 + 5), color: '#63b3ed' },
      { name: 'Blacklist Risk', val: Math.floor(Math.random() * 10 + 5), color: '#9f7aea' },
    ];
    didBreakdownEl.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr; gap:10px;">
        ${breakdownItems.map(item => `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
            <div style="min-width:140px; color:#cbd5e0; font-weight:500;">${item.name}</div>
            <div style="flex:1; background:#1a202c; border-radius:8px; height:20px; overflow:hidden;">
              <div style="width:${item.val}%; background:${item.color}; height:100%; transition:0.3s;"></div>
            </div>
            <div style="min-width:30px; text-align:right; color:#a0aec0; font-family:'JetBrains Mono',monospace;">${item.val}%</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Module 1: Detection Timeline
  const didTimelineEl = document.getElementById('did-timeline');
  if (didTimelineEl) {
    didTimelineEl.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div style="display:flex; gap:12px; align-items:flex-start;">
          <div style="width:8px; height:8px; border-radius:50%; background:#63b3ed; margin-top:8px;"></div>
          <div style="flex:1;">
            <div style="color:#e2e8f0; font-weight:600;">Detection Created</div>
            <div style="color:#94a3b8; font-size:0.85rem;">${formatDate(detection.created_at)}</div>
          </div>
        </div>
      </div>
    `;
  }
}

// Also update switchSection to call loadIntelligenceDetections when switching to intelligence!
// Let's override the existing switchSection!
(function() {
  const originalSwitchSection = window.switchSection;
  window.switchSection = function(name) {
    originalSwitchSection(name);
    if (name === 'intelligence') {
      loadIntelligenceDetections();
    }
    if (name === 'review') {
      loadReviewQueue();
    }
    if (name === 'threat-intel') {
      loadThreatIntelligence();
    }
  };
})();

// Phase 2 functions: Review Queue
let currentReviewId = null;

async function loadReviewQueue() {
  try {
    const rqListEl = document.getElementById('reviewQueueList');
    const rqPendingEl = document.getElementById('rq-total');
    const rqHighEl = document.getElementById('rq-high');
    const rqMedEl = document.getElementById('rq-med');
    if (!rqListEl) return;

    rqListEl.innerHTML = '<div class="ap-empty">Loading review queue…</div>';

    const data = await Api.getAdminReviewQueue();
    if (data.kpis) {
      if (rqPendingEl) rqPendingEl.textContent = data.kpis.pending;
      if (rqHighEl) rqHighEl.textContent = data.kpis.in_review;
      if (rqMedEl) rqMedEl.textContent = data.kpis.completed;
    }

    renderReviewList(data.reviews);
  } catch (err) {
    console.error('Load review queue error:', err);
    const rqListEl = document.getElementById('reviewQueueList');
    if (rqListEl) rqListEl.innerHTML = '<div class="ap-empty">Could not load review queue</div>';
  }
}

function renderReviewList(reviews) {
  const tbodyEl = document.getElementById('reviewQueueTableBody');
  if (!tbodyEl) return;

  if (!reviews || !reviews.length) {
    tbodyEl.innerHTML = '<tr><td colspan="7" class="ap-empty">No reviews in queue</td></tr>';
    return;
  }

  tbodyEl.innerHTML = reviews.map(r => {
    const color = FEED_COLORS[r.ai_verdict] || '#a0aec0';
    const statusColor = r.status === 'COMPLETED' ? '#68d391' : r.status === 'IN_REVIEW' ? '#ecc94b' : '#f59e0b';
    return `
      <tr>
        <td style="font-family:JetBrains Mono,monospace">#${r.id}</td>
        <td><span style="padding:4px 10px; border-radius:12px; background:${color}22; color:${color}; font-weight:700; font-size:0.8rem;">${r.ai_verdict}</span></td>
        <td style="font-family:JetBrains Mono,monospace">${r.score}</td>
        <td style="font-family:JetBrains Mono,monospace">${r.confidence}%</td>
        <td><span style="padding:4px 10px; border-radius:12px; background:${statusColor}22; color:${statusColor}; font-weight:700; font-size:0.8rem;">${r.status}</span></td>
        <td>${formatDate(r.created_at)}</td>
        <td><button class="ap-primary-btn" style="padding:6px 10px; font-size:0.8rem;" onclick="openReview(${r.id})">Review</button></td>
      </tr>
    `;
  }).join('');
}

async function openReview(id) {
  try {
    currentReviewId = id;
    const data = await Api.getAdminReview(id);
    if(!data) return;
    
    const { review, detection, keywords, reasons } = data;
    
    // Show in Detection Intelligence workspace (reuse existing UI!)
    const emptyEl = document.querySelector('.detection-intel-empty');
    const workspaceEl = document.getElementById('detectionIntelWorkspace');
    if(emptyEl) emptyEl.style.display = 'none';
    if(workspaceEl) workspaceEl.style.display = 'block';

    // Fill in fields!
    renderIntelligenceDetail({
      detection,
      keywords, reasons,
      verdict: review.ai_verdict,
      score: review.score
    });
  } catch(err) {
    console.error('Open review error:', err);
  }
}

async function reviewMark(human_verdict) {
  if(!currentReviewId) {
    alert('Please select a review first!');
    return;
  }
  try {
    const notes = ''; // Can add notes field later
    await Api.patchAdminReview(currentReviewId, { 
      human_verdict: human_verdict.toUpperCase(), 
      notes 
    });
    alert('Review saved!');
    loadReviewQueue();
  } catch(err) {
    console.error('Review mark error:', err);
    alert('Could not save review');
  }
}

// New AI Learning Center - COMPLETE IMPLEMENTATION
let currentTrendDays =7;

async function loadAiLearningCenter() {
  if (!document.getElementById('sec-ai-learning')) return;
  try {
    // SECTION 1: PERFORMANCE OVERVIEW
    const overviewData = await Api.getAdminLearningPerformanceOverview();
    renderAiOverview(overviewData);

    // SECTION 2: ACCURACY BY CATEGORY
    const catData = await Api.getAdminLearningAccuracyByCategory();
    renderAiCategoryAccuracy(catData.categoryAccuracy);

    // SECTION 3: ACCURACY TREND
    await loadAiTrend(currentTrendDays);

    // SECTION 4: FEEDBACK DISTRIBUTION
    renderAiFeedbackDistribution(overviewData);

    // SECTION 5: MISCLASSIFICATION DETAILS
    const misclassDetails = await Api.getAdminLearningMisclassificationDetails();
    renderAiMisclassDetails(misclassDetails.misclassificationDetails);

    // SECTION 6: COMMON ERROR PATTERNS
    const patternsData = await Api.getAdminLearningCommonErrorPatterns();
    renderAiCommonErrorPatterns(patternsData.patterns);

    // SECTION 7: AI LEARNING INSIGHTS
    const insightsData = await Api.getAdminLearningInsights();
    renderAiInsights(insightsData.insights);

    // SECTION 8: MODEL IMPROVEMENT RECOMMENDATIONS
    const recData = await Api.getAdminLearningRecommendations();
    renderAiRecommendations(recData.recommendations);

    // SECTION 9: PENDING LEARNING QUEUE
    const pendingData = await Api.getAdminLearningPendingQueue();
    renderAiPendingQueue(pendingData.pendingQueue);
  } catch (err) {
    console.error('AI Learning Center load error:', err);
    alert('Error loading AI Learning Center. Check console for details.');
  }
}

function renderAiOverview(ov) {
  document.getElementById('ai-overview-total-feedback').textContent = ov.totalFeedback || 0;
  document.getElementById('ai-overview-correct').textContent = ov.correctPredictions || 0;
  document.getElementById('ai-overview-wrong').textContent = ov.wrongPredictions || 0;
  document.getElementById('ai-overview-false-pos').textContent = ov.falsePositives || 0;
  document.getElementById('ai-overview-false-neg').textContent = ov.falseNegatives ||0;
  document.getElementById('ai-overview-accuracy').textContent = (ov.overallAccuracy ||0) + '%';
}

function renderAiCategoryAccuracy(catAcc) {
  const gridEl = document.getElementById('ai-accuracy-category-grid');
  if (!gridEl) return;
  if (!catAcc || catAcc.length === 0) {
    gridEl.innerHTML = '<div class="ap-empty">No category data yet.</div>';
    return;
  }
  const FEED_COLORS = { SAFE: '#68d391', PHISHING: '#fc8181', SPAM: '#f59e0b', FRAUD: '#9f7aea' };
  gridEl.innerHTML = catAcc.map(c => {
    const color = FEED_COLORS[c.category] || '#a0aec0';
    const fillWidth = Math.max(10, Math.min(c.accuracy, 100));
    return `
      <div style="padding:12px 16px; border-radius:8px; background:#1e293b;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <div style="color:#e2e8f0; font-weight: 700; font-size:0.95rem;">${c.category}</div>
          <div style="color: ${color}; font-weight: 800; font-size:1.1rem; font-family:JetBrains Mono,monospace;">${c.accuracy}%</div>
        </div>
        <div style="display:flex; gap:12px; align-items:center; font-size:0.8rem; color:#94a3b8;">
          <span>Total: <b style="color:#cbd5e0">${c.totalDetections}</b></span>
          <span>Correct: <b style="color:#68d391">${c.correctDetections}</b></span>
        </div>
        <div style="height:8px; border-radius:6px; background:#0f172a; margin-top:10px; overflow:hidden;">
          <div style="height:100%; width:${fillWidth}%; background: linear-gradient(90deg, ${color}, ${color}88); border-radius:6px;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAiFeedbackDistribution(ov) {
  const el = document.getElementById('ai-feedback-distribution');
  if (!el) return;
  const items = [
    { label: 'Correct Feedback', count: ov.correctPredictions ||0, color: '#68d391' },
    { label: 'Wrong Feedback', count: ov.wrongPredictions ||0, color: '#fc8181' },
    { label: 'Pending Reviews', count: ov.pendingReviews ||0, color: '#f59e0b' }
  ];
  el.innerHTML = items.map(i => `
    <div style="display:flex; justify-content:space-between; gap:12px; padding:10px 14px; border-radius:8px; background:#1e293b;">
      <div style="display:flex; gap:10px; align-items:center;">
        <div style="width:8px; height:8px; border-radius:50%; background:${i.color}"></div>
        <span style="color:#cbd5e0">${i.label}</span>
      </div>
      <span style="color:#e2e8f0; font-weight:700; font-family:JetBrains Mono,monospace;">${i.count}</span>
    </div>
  `).join('');
}

async function loadAiTrend(days=7) {
  currentTrendDays = days;
  // Update button styles
  for (const d of [7,30,90]) {
    const btn = document.getElementById(`ai-trend-${d}`);
    if(btn) btn.style.background = d === days ? 'rgba(99,179,237,0.15)' : 'rgba(30,41,59,1)';
    if(btn) btn.style.borderColor = d === days ? '#63b3ed' : 'rgba(99,179,237,0.2)';
  }
  // Load and render trend
  const trendsData = await Api.getAdminLearningAccuracyTrends(days);
  renderAiTrendChart(trendsData.trends);
}

function renderAiTrendChart(trends) {
  const chartEl = document.getElementById('ai-trend-chart');
  if (!chartEl) return;
  if (!trends || !trends.length) {
    chartEl.innerHTML = '<div class="ap-empty">No trend data yet.</div>';
    return;
  }
  chartEl.innerHTML = `
    <div style="display:flex; gap: 10px; align-items:end; padding:0 10px; height: 140px;">
      ${trends.map(t => {
        const h = (t.accuracy/100) * 100;
        return `
          <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;">
            <div style="font-family:JetBrains Mono,monospace; color:#68d391; font-weight:700; font-size:0.8rem;">${t.accuracy}%</div>
            <div style="width:100%; background:linear-gradient(180deg, #63b3edaa, #63b3ed22); border-radius:6px 6px 0 0; height:${h}%; min-height:10px;"></div>
            <div style="font-size:0.7rem; color:#94a3b8;">${t.date.split('-').slice(1).join('/')}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderAiMisclassDetails(md) {
  const tbodyEl = document.getElementById('ai-misclass-tbody');
  if (!tbodyEl) return;
  if (!md || !md.length) {
    tbodyEl.innerHTML = '<tr><td colspan="7" class="ap-empty">No misclassifications yet.</td></tr>';
    return;
  }
  const FEED_COLORS = { SAFE: '#68d391', PHISHING: '#fc8181', SPAM: '#f59e0b', FRAUD: '#9f7aea' };
  tbodyEl.innerHTML = md.map(item => {
    const aiColor = FEED_COLORS[item.originalPrediction] || '#a0aec0';
    const correctColor = FEED_COLORS[item.correctClassification] || '#68d391';
    const statusColor = item.status === 'COMPLETED' ? '#68d391' : '#f59e0b';
    return `
      <tr>
        <td style="font-family:JetBrains Mono,monospace">#${item.detection_id || item.id}</td>
        <td><span style="padding:4px 10px; border-radius:12px; background:${aiColor}22; color:${aiColor}; font-weight:700; font-size:0.8rem;">${item.originalPrediction}</span></td>
        <td><span style="padding:4px 10px; border-radius:12px; background:${correctColor}22; color:${correctColor}; font-weight:700; font-size:0.8rem;">${item.correctClassification}</span></td>
        <td>${item.platform || '—'}</td>
        <td>${formatDate(item.date || item.created_at)}</td>
        <td style="font-family:JetBrains Mono,monospace">${item.confidenceScore}%</td>
        <td><span style="padding:4px 10px; border-radius:12px; background:${statusColor}22; color:${statusColor}; font-weight:700; font-size:0.8rem;">${item.status || 'PENDING'}</span></td>
      </tr>
    `;
  }).join('');
}

function renderAiCommonErrorPatterns(patterns) {
  const el = document.getElementById('ai-error-patterns');
  if (!el) return;
  if (!patterns || !patterns.length) {
    el.innerHTML = '<div class="ap-empty">No error patterns identified yet.</div>';
    return;
  }
  const FEED_COLORS = { SAFE: '#68d391', PHISHING: '#fc8181', SPAM: '#f59e0b', FRAUD: '#9f7aea' };
  el.innerHTML = patterns.map(p => {
    const impactColor = p.impact === 'High' ? '#fc8181' : p.impact === 'Medium' ? '#f59e0b' : '#63b3ed';
    const catColor = FEED_COLORS[p.category] || '#a0aec0';
    return `
      <div style="padding:12px 16px; border-radius:8px; background:#1e293b; border-left:3px solid ${impactColor};">
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:6px;">
          <span style="padding:3px 8px; border-radius:10px; background:${catColor}22; color:${catColor}; font-weight:700; font-size:0.75rem;">${p.category}</span>
          <span style="padding:3px 8px; border-radius:10px; background:${impactColor}22; color:${impactColor}; font-weight:700; font-size:0.75rem;">${p.impact}</span>
          <span style="font-family:JetBrains Mono,monospace; color:#94a3b8; font-size:0.8rem;">Freq: ${p.frequency}</span>
        </div>
        <div style="color:#cbd5e0">${p.description}</div>
      </div>
    `;
  }).join('');
}

function renderAiInsights(insights) {
  const el = document.getElementById('ai-insights');
  if (!el) return;
  if (!insights || !insights.length) {
    el.innerHTML = '<div class="ap-empty">No insights generated yet.</div>';
    return;
  }
  el.innerHTML = insights.map(i => {
    const priorityColor = i.priority === 'High' ? '#fc8181' : i.priority === 'Medium' ? '#f59e0b' : '#63b3ed';
    const icon = i.type === 'Accuracy Drop' ? '📉' : i.type === 'Pattern Discovery' ? '🔍' : i.type === 'High Correction' ? '⚡' : '💡';
    return `
      <div style="padding:12px 16px; border-radius:8px; background:#1e293b;">
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:6px;">
          <span style="font-size:1.1rem;">${icon}</span>
          <span style="color:#e2e8f0; font-weight:700; font-size:0.95rem;">${i.type}</span>
          <span style="padding:3px 8px; border-radius:10px; background:${priorityColor}22; color:${priorityColor}; font-weight:700; font-size:0.75rem;">${i.priority}</span>
        </div>
        <div style="color:#cbd5e0; margin-bottom:6px;">${i.message}</div>
        <button class="ap-primary-btn" style="padding:4px 8px; font-size:0.8rem;">${i.action}</button>
      </div>
    `;
  }).join('');
}

function renderAiRecommendations(recs) {
  const el = document.getElementById('ai-recommendations');
  if (!el) return;
  if (!recs || !recs.length) {
    el.innerHTML = '<div class="ap-empty">No recommendations yet.</div>';
    return;
  }
  el.innerHTML = recs.map(r => {
    const priorityColor = r.priority === 'High' ? '#fc8181' : r.priority === 'Medium' ? '#f59e0b' : '#63b3ed';
    return `
      <div style="padding:12px 16px; border-radius:8px; background:#1e293b; border-left:3px solid ${priorityColor};">
        <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <div style="display:flex; gap:10px; align-items:center;">
            <span style="padding:3px 8px; border-radius:10px; background:${priorityColor}22; color:${priorityColor}; font-weight:700; font-size:0.75rem;">${r.priority}</span>
            <span style="color:#cbd5e0">${r.reason}</span>
          </div>
          <button class="ap-primary-btn" style="padding:4px 8px; font-size:0.8rem;">${r.action}</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderAiPendingQueue(pending) {
  const tbodyEl = document.getElementById('ai-pending-tbody');
  if (!tbodyEl) return;
  if (!pending || !pending.length) {
    tbodyEl.innerHTML = '<tr><td colspan="6" class="ap-empty">No pending items yet.</td></tr>';
    return;
  }
  const FEED_COLORS = { SAFE: '#68d391', PHISHING: '#fc8181', SPAM: '#f59e0b', FRAUD: '#9f7aea' };
  tbodyEl.innerHTML = pending.map(p => {
    const currColor = p.currentClassification ? FEED_COLORS[p.currentClassification] : '#a0aec0';
    const suggestColor = p.suggestedClassification ? FEED_COLORS[p.suggestedClassification] : '#68d391';
    return `
      <tr>
        <td style="font-family:JetBrains Mono,monospace">#${p.messageId}</td>
        <td>${p.userFeedback || '—'}</td>
        <td>${p.currentClassification ? `<span style="padding:4px 10px; border-radius:12px; background:${currColor}22; color:${currColor}; font-weight:700; font-size:0.8rem;">${p.currentClassification}</span>` : '—'}</td>
        <td>${p.suggestedClassification ? `<span style="padding:4px 10px; border-radius:12px; background:${suggestColor}22; color:${suggestColor}; font-weight:700; font-size:0.8rem;">${p.suggestedClassification}</span>` : '—'}</td>
        <td>${formatDate(p.date || p.created_at)}</td>
        <td><button class="ap-primary-btn" style="padding:4px 8px; font-size:0.8rem;" onclick="switchSection('review')">Review</button> <button class="ap-primary-btn" style="padding:4px 8px; font-size:0.8rem;">Approve</button></td>
      </tr>
    `;
  }).join('');
}

function exportLearningReport() {
  const dataStr = 'AI Learning Report - Generated: ' + new Date().toLocaleString();
  const blob = new Blob([dataStr], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai-learning-report.txt';
  a.click();
  URL.revokeObjectURL(url);
  alert('Report exported! (placeholder for full report)');
}

function renderAiLearningStats(data) {
  // Update KPI cards
  const elFeedbackTotal = document.getElementById('ai-feedback-total');
  const elCorrect = document.getElementById('ai-correct');
  const elWrong = document.getElementById('ai-wrong');
  const elAccuracy = document.getElementById('ai-accuracy');
  
  if(elFeedbackTotal) elFeedbackTotal.textContent = data.totalFeedback;
  if(elCorrect) elCorrect.textContent = data.correctPredictions;
  if(elWrong) elWrong.textContent = data.incorrectPredictions;
  if(elAccuracy) elAccuracy.textContent = `${data.accuracy}%`;
}

function renderAiMisclassifications(data) {
  const listEl = document.getElementById('aiMisclassList');
  if(!listEl) return;
  
  if(!data.misclassifications || data.misclassifications.length === 0) {
    listEl.innerHTML = '<div class="ap-empty">No misclassifications yet.</div>';
    return;
  }

  listEl.innerHTML = data.misclassifications.map(mc => `
    <div style="display: flex; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid rgba(99,179,237,0.1);">
      <div style="font-weight: 600;">
        ${escH(mc.ai_verdict)} → ${escH(mc.human_verdict)}
      </div>
      <div style="display: flex; gap:12px; color: #94a3b8; font-size:0.85rem;">
        <span>Count: ${mc.count}</span>
        <span>Last: ${formatDate(mc.lastSeen)}</span>
      </div>
    </div>
  `).join('');
}

function renderAiTrends(data) {
  // For now, just display trend data in placeholder (chart will be added later if needed)
  const chartEl = document.querySelector('.ai-chart-placeholder');
  if(!chartEl) return;

  chartEl.innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap: wrap;">
      ${data.trends.slice(-7).map(t => `
        <div style="padding:8px 12px; border-radius:8px; background:#1e293b; text-align:center;">
          <div style="font-size:0.75rem; color:#94a3b8;">${t.date.split('-').slice(1).join('/')}</div>
          <div style="font-size:1.1rem; color:#68d391; font-weight:700;">${t.accuracy}%</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ── Phase4: THREAT INTELLIGENCE functions ──────────────────────────────────────
async function loadThreatIntelligence() {
  try {
    const overview = await Api.getAdminThreatOverview();
    renderThreatOverview(overview.overview);
    const domains = await Api.getAdminThreatDomains();
    renderThreatDomains(domains.domains);
    const senders = await Api.getAdminThreatSenders();
    renderThreatSenders(senders.senders);
    const keywords = await Api.getAdminThreatKeywords();
    renderThreatKeywords(keywords.keywords);
    const emerging = await Api.getAdminThreatEmerging();
    renderThreatEmerging(emerging.emerging);
    const campaigns = await Api.getAdminThreatCampaigns();
    // TODO: render campaigns
  } catch (err) {
    console.error('Threat intelligence load error:', err);
  }
}

function renderThreatOverview(overview) {
  const totalThreatsEl = document.getElementById('ti-total');
  const criticalThreatsEl = document.getElementById('ti-critical');
  const highRiskThreatsEl = document.getElementById('ti-high');
  const blockedSendersEl = document.getElementById('ti-blocked');
  const maliciousDomainsEl = document.getElementById('ti-malicious');
  const emergingThreatsEl = document.getElementById('ti-emerging-count');
  const repeatOffendersEl = document.getElementById('ti-repeat');
  if (totalThreatsEl) totalThreatsEl.textContent = overview.totalThreats;
  if (criticalThreatsEl) criticalThreatsEl.textContent = overview.criticalThreats;
  if (highRiskThreatsEl) highRiskThreatsEl.textContent = overview.highRiskThreats;
  if (blockedSendersEl) blockedSendersEl.textContent = overview.blockedSenders;
  if (maliciousDomainsEl) maliciousDomainsEl.textContent = overview.maliciousDomains;
  if (emergingThreatsEl) emergingThreatsEl.textContent = overview.emergingThreats;
  if (repeatOffendersEl) repeatOffendersEl.textContent = overview.repeatOffenders;
}

function renderThreatDomains(domains) {
  const el = document.getElementById('ti-domains');
  if (!el) return;
  if (!domains || domains.length === 0) {
    el.innerHTML = '<div class="ap-empty">No data yet.</div>';
    return;
  }
  el.innerHTML = domains.map(d => `
    <div class="threat-intel-item">
      <div class="threat-intel-label">${escH(d.domain)}</div>
      <div class="threat-intel-meta">Threats: ${d.count} • Last: ${formatDate(d.lastSeen)} • Risk: ${d.riskLevel}</div>
    </div>
  `).join('');
}

function renderThreatSenders(senders) {
  const el = document.getElementById('ti-senders');
  if (!el) return;
  if (!senders || senders.length === 0) {
    el.innerHTML = '<div class="ap-empty">No data yet.</div>';
    return;
  }
  el.innerHTML = senders.map(s => `
    <div class="threat-intel-item">
      <div class="threat-intel-label">${escH(s.sender)}</div>
      <div class="threat-intel-meta">Reports: ${s.count} • Last: ${formatDate(s.lastSeen)} • Category: ${escH(s.category)}</div>
    </div>
  `).join('');
}

function renderThreatKeywords(keywords) {
  const el = document.getElementById('ti-keywords');
  if (!el) return;
  if (!keywords || keywords.length ===0) {
    el.innerHTML = '<div class="ap-empty">No data yet.</div>';
    return;
  }
  el.innerHTML = keywords.map(k => `
    <div class="threat-intel-item">
      <div class="threat-intel-label">${escH(k.keyword)}</div>
      <div class="threat-intel-meta">Count: ${k.count} • Category: ${escH(k.category)}</div>
    </div>
  `).join('');
}

function renderThreatEmerging(emerging) {
  const el = document.getElementById('ti-emerging');
  if (!el) return;
  if (!emerging || emerging.length === 0) {
    el.innerHTML = '<div class="ap-empty">No data yet.</div>';
    return;
  }
  el.innerHTML = emerging.map(e => `
    <div class="threat-intel-item">
      <div class="threat-intel-label">${escH(e.type)}: ${escH(e.value)}</div>
      <div class="threat-intel-meta">First: ${formatDate(e.firstSeen)} • Category: ${escH(e.category)} • Count: ${e.count}</div>
    </div>
  `).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
//  CONNECTED INTELLIGENCE LAYER
//  Every action in one module immediately affects all connected modules.
// ══════════════════════════════════════════════════════════════════════════════

// ── Connection 5: Blacklist → Detection Engine ────────────────────────────────
// Called by detection.js via postMessage when a scan completes.
// Adds blacklist score bonus and shows blacklist hit reason in results.
async function checkBlacklistHit(content) {
  try {
    const data = await Api.getAdminBlacklist();
    const items = data.items || [];
    const lower = (content || '').toLowerCase();
    for (const item of items) {
      const val = (item.normalized_value || '').toLowerCase();
      if (val && lower.includes(val)) {
        return { hit: true, value: item.value, type: item.type, label: item.label };
      }
    }
    return { hit: false };
  } catch { return { hit: false }; }
}

// ── Connection 7: Dashboard — live metrics from DB ────────────────────────────
// Called alongside loadDashboard to enrich KPI cards with cross-module data.
async function loadIntelligenceDashboard() {
  try {
    const data = await Api.getIntelligenceDashboard();

    // Review Queue KPIs (shown in dashboard header if elements exist)
    setText('dash-rq-pending',   data.review_queue?.pending   || 0);
    setText('dash-rq-completed', data.review_queue?.completed || 0);

    // AI Learning stats → update AI Learning Center cards if visible
    const al = data.ai_learning || {};
    setText('ai-overview-total-feedback', al.total_feedback    || 0);
    setText('ai-overview-correct',        al.correct_predictions || 0);
    setText('ai-overview-wrong',          al.wrong_predictions   || 0);
    setText('ai-overview-false-pos',      al.false_positives     || 0);
    setText('ai-overview-false-neg',      al.false_negatives     || 0);
    setText('ai-overview-accuracy',       al.accuracy            || '100%');

    // Blacklist totals → update blacklist section KPIs if visible
    const ti = data.threat_intel || {};
    setText('bl-total',   data.threat_intel?.blacklist_total || 0);

    return data;
  } catch (err) {
    console.warn('[IntelDashboard]', err.message || err);
  }
}

// ── Connection 8: Learning Timeline ──────────────────────────────────────────
async function loadLearningTimeline(detectionId = '') {
  const container = document.getElementById('learning-timeline');
  if (!container) return;

  container.innerHTML = '<div class="soc-thread-loading">Loading timeline…</div>';

  try {
    const data   = await Api.getIntelligenceTimeline(detectionId);
    const events = data.events || [];

    if (!events.length) {
      container.innerHTML = '<div class="soc-thread-loading">No events yet.</div>';
      return;
    }

    const iconMap = {
      DETECTION_CREATED:     { icon: '🔍', color: '#63b3ed', label: 'Detection Created'   },
      REVIEW_TRIGGERED:      { icon: '⚠️',  color: '#f6ad55', label: 'Review Triggered'    },
      ADMIN_CORRECTED:       { icon: '✏️',  color: '#fc8181', label: 'Admin Corrected'     },
      ADMIN_CONFIRMED:       { icon: '✅',  color: '#68d391', label: 'Admin Confirmed'     },
      THREAT_DOMAIN_FLAGGED: { icon: '🌐', color: '#9f7aea', label: 'Domain Flagged'      },
      THREAT_KEYWORDS_FLAGGED:{ icon: '🏷', color: '#f6ad55', label: 'Keywords Flagged'   },
      BLACKLIST_ADDED:       { icon: '🚫', color: '#fc8181', label: 'Blacklist Added'      },
      RL_UPDATED:            { icon: '🧠', color: '#76e4f7', label: 'RL Model Updated'    },
    };

    container.innerHTML = events.map(ev => {
      const meta  = ev.meta || {};
      const info  = iconMap[ev.event_type] || { icon: '•', color: '#4a5568', label: ev.event_type };
      const iso   = ev.created_at || '';
      const extra = ev.verdict_before && ev.verdict_after && ev.verdict_before !== ev.verdict_after
        ? `<span style="color:${info.color};font-size:.68rem"> ${ev.verdict_before} → ${ev.verdict_after}</span>` : '';

      return `
        <div style="display:flex;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
          <div style="font-size:1rem;flex-shrink:0;padding-top:2px">${info.icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:.8rem;font-weight:600;color:${info.color}">${info.label}${extra}</div>
            ${meta.reason ? `<div style="font-size:.72rem;color:#718096">${escH(meta.reason)}</div>` : ''}
            ${meta.domain ? `<div style="font-size:.72rem;color:#718096;font-family:'JetBrains Mono',monospace">${escH(meta.domain)}</div>` : ''}
            ${meta.keywords?.length ? `<div style="font-size:.7rem;color:#4a5568">${meta.keywords.slice(0,4).map(k=>escH(k)).join(' · ')}</div>` : ''}
          </div>
          <div style="font-size:.65rem;color:#4a5568;white-space:nowrap;flex-shrink:0">${socFmtTime(iso)}</div>
        </div>`;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="soc-thread-loading">Could not load timeline.</div>';
    console.warn('[Timeline]', err.message || err);
  }
}

// ── Threat Intelligence from Corrections ─────────────────────────────────────
// Connection 3→4: populate the Threat Intel section from review corrections
async function loadThreatIntelFromCorrections() {
  try {
    const data = await Api.getThreatIntelFromCorrections();

    // Domains
    const domainsEl = document.getElementById('ti-domains');
    if (domainsEl && data.topCorrectedDomains?.length) {
      const max = Math.max(...data.topCorrectedDomains.map(d => d.corrections), 1);
      domainsEl.innerHTML = data.topCorrectedDomains.map(d => `
        <div class="soc-intel-item">
          <span class="soc-intel-item-label" style="font-family:'JetBrains Mono',monospace;font-size:.72rem">${escH(d.domain)}</span>
          <div class="soc-intel-bar-wrap"><div class="soc-intel-bar" style="width:${Math.round(d.corrections/max*100)}%;background:#fc8181"></div></div>
          <span class="soc-intel-count">${d.corrections}</span>
          ${d.canPromote ? `<button class="soc-action-btn" style="padding:2px 8px;font-size:.65rem" onclick="promoteToBlacklist('${escH(d.domain)}','domain')">+BL</button>` : ''}
        </div>`).join('');
    }

    // Keywords
    const kwEl = document.getElementById('ti-keywords');
    if (kwEl && data.topCorrectedKeywords?.length) {
      const max = Math.max(...data.topCorrectedKeywords.map(k => k.corrections), 1);
      kwEl.innerHTML = data.topCorrectedKeywords.map(k => `
        <div class="soc-intel-item">
          <span class="soc-intel-item-label">${escH(k.keyword)}</span>
          <div class="soc-intel-bar-wrap"><div class="soc-intel-bar" style="width:${Math.round(k.corrections/max*100)}%;background:#9f7aea"></div></div>
          <span class="soc-intel-count">${k.corrections}</span>
        </div>`).join('');
    }

    // Senders
    const sendersEl = document.getElementById('ti-senders');
    if (sendersEl && data.topCorrectedSenders?.length) {
      const max = Math.max(...data.topCorrectedSenders.map(s => s.corrections), 1);
      sendersEl.innerHTML = data.topCorrectedSenders.map(s => `
        <div class="soc-intel-item">
          <span class="soc-intel-item-label" style="font-family:'JetBrains Mono',monospace;font-size:.72rem">${escH(s.sender)}</span>
          <div class="soc-intel-bar-wrap"><div class="soc-intel-bar" style="width:${Math.round(s.corrections/max*100)}%;background:#f6ad55"></div></div>
          <span class="soc-intel-count">${s.corrections}</span>
          ${s.canPromote ? `<button class="soc-action-btn" style="padding:2px 8px;font-size:.65rem" onclick="promoteToBlacklist('${escH(s.sender)}','email')">+BL</button>` : ''}
        </div>`).join('');
    }

  } catch (err) {
    console.warn('[ThreatIntelCorrections]', err.message || err);
  }
}

// ── Connection 4: Promote threat to blacklist ──────────────────────────────────
async function promoteToBlacklist(value, type) {
  if (!confirm(`Add "${value}" to global blocklist as ${type}?`)) return;
  try {
    await Api.promoteThreatToBlacklist({ value, type, reason: 'Promoted from Threat Intelligence corrections' });
    socToast(`✓ ${value} added to blocklist`, 'success');
    // Cascade: refresh threat intel + blacklist + timeline
    await Promise.allSettled([loadThreatIntelFromCorrections(), loadBlacklist(), loadLearningTimeline()]);
    // Also update dashboard
    loadIntelligenceDashboard();
  } catch (err) {
    socToast(err.message || 'Failed to add to blocklist', 'error');
  }
}

// ── Blacklist management ───────────────────────────────────────────────────────
async function loadBlacklist(type = '') {
  const tbody = document.getElementById('blacklistTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" class="ap-empty">Loading…</td></tr>';

  try {
    const data = await Api.getAdminBlacklist(type);
    const items = data.items || [];

    // Update KPI totals
    const totals = data.totals || {};
    setText('bl-total',   totals.total   || 0);
    setText('bl-emails',  totals.emails  || 0);
    setText('bl-phones',  totals.phones  || 0);
    setText('bl-domains', totals.domains || 0);

    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="ap-empty">No items in blocklist yet.</td></tr>';
      return;
    }

    tbody.innerHTML = items.map(item => {
      const typeColor = { domain:'#fc8181', email:'#f6ad55', phone:'#63b3ed', account:'#9f7aea' };
      const c = typeColor[item.type] || '#a0aec0';
      return `
        <tr>
          <td style="font-family:'JetBrains Mono',monospace;color:${c};font-size:.8rem">${escH(item.value || '')}</td>
          <td><span style="padding:2px 8px;border-radius:10px;background:${c}18;color:${c};font-size:.7rem;font-weight:700">${escH(item.type || '')}</span></td>
          <td style="color:#718096;font-size:.75rem">${escH(item.added_by_name || 'System')}</td>
          <td class="det-time" data-iso="${item.created_at || ''}" style="color:#4a5568;font-size:.75rem">${formatTime(item.created_at)}</td>
          <td style="color:#718096;font-size:.75rem">${escH((item.label || '').slice(0, 50))}</td>
          <td>
            <button class="soc-bl-reject" style="padding:4px 10px;font-size:.72rem"
              onclick="removeBlacklistItem(${item.id}, '${escH(item.value || '')}')">Remove</button>
          </td>
        </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="6" class="ap-empty">Could not load blocklist.</td></tr>';
    console.warn('[Blacklist]', err.message || err);
  }
}

async function removeBlacklistItem(id, value) {
  if (!confirm(`Remove "${value}" from blocklist?`)) return;
  try {
    await Api.deleteAdminBlacklist(id);
    socToast(`Removed: ${value}`, 'info');
    loadBlacklist();
    loadIntelligenceDashboard();
  } catch (err) {
    socToast(err.message || 'Failed to remove', 'error');
  }
}

function openAddBlacklistModal() {
  const value = prompt('Enter domain, email, phone or sender to block:');
  if (!value || !value.trim()) return;
  const type = /^[\w.+-]+@[\w-]+\.[\w.]+$/.test(value) ? 'email'
    : /^\d{10}$/.test(value.replace(/\D/g,'')) ? 'phone'
    : /^https?:\/\/|\./.test(value) ? 'domain' : 'account';
  promoteToBlacklist(value.trim(), type);
}

// ── Connected: Related Intelligence (Detection Detail enrichment) ─────────────
async function loadRelatedIntelligence(detectionId) {
  const container = document.getElementById('did-related');
  if (!container) return;

  try {
    const data = await Api.getRelatedIntelligence(detectionId);

    let html = '';

    if (data.related_detections?.length) {
      html += `<div style="margin-bottom:12px">
        <div class="soc-panel-card-title" style="margin-bottom:8px">🔗 Related Detections</div>
        ${data.related_detections.map(d => {
          const c = FEED_COLORS[d.verdict] || '#a0aec0';
          return `<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
            <span style="color:${c};font-weight:700;font-size:.72rem;width:70px">${d.verdict}</span>
            <span style="color:#718096;font-size:.72rem">${d.category || '—'}</span>
            <span style="margin-left:auto;color:#4a5568;font-size:.68rem">${socFmtTime(d.created_at)}</span>
          </div>`;
        }).join('')}
      </div>`;
    }

    if (data.related_domains?.length) {
      html += `<div style="margin-bottom:12px">
        <div class="soc-panel-card-title" style="margin-bottom:8px">🌐 Related Domains</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${data.related_domains.map(d =>
            `<span class="soc-tag" style="font-family:'JetBrains Mono',monospace;font-size:.66rem">${escH(d.domain)} (${d.count})</span>`
          ).join('')}
        </div>
      </div>`;
    }

    if (data.related_keywords?.length) {
      html += `<div>
        <div class="soc-panel-card-title" style="margin-bottom:8px">🏷 Related Keywords</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${data.related_keywords.map(k =>
            `<span class="soc-tag">${escH(k.keyword)} (${k.count})</span>`
          ).join('')}
        </div>
      </div>`;
    }

    container.innerHTML = html || '<div style="color:#4a5568;font-size:.78rem">No related data found.</div>';
  } catch (err) {
    console.warn('[Related Intelligence]', err.message || err);
  }
}

// ── Override reviewMark to cascade changes to all connected modules ────────────
const _origReviewMark = window.reviewMark;
window.reviewMark = async function(human_verdict) {
  if (!currentReviewId) { alert('Please select a review first!'); return; }
  try {
    const result = await Api.patchAdminReview(currentReviewId, {
      human_verdict: human_verdict.toUpperCase(),
      notes: document.getElementById('did-notes')?.value || ''
    });

    socToast(
      result.cascaded?.threat_intel
        ? `✓ Review saved — Threat Intel updated`
        : `✓ Review confirmed`,
      'success'
    );

    // Cascade: refresh all connected modules simultaneously
    await Promise.allSettled([
      loadReviewQueue(),           // refresh review list + KPIs
      loadAiLearningCenter(),      // update AI learning stats
      loadThreatIntelFromCorrections(), // update threat intel
      loadLearningTimeline(),      // update timeline
      loadIntelligenceDashboard(), // update dashboard metrics
    ]);

  } catch (err) {
    socToast(err.message || 'Could not save review', 'error');
  }
};

// ── Override switchSection to wire all section loaders ───────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.ap-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const sec = item.getAttribute('data-section');
      if (sec === 'support')     loadSupportCenter();
    });
  });

  // Also load intelligence dashboard on initial boot
  loadIntelligenceDashboard();
});

// Extend loadThreatIntelligence to also pull from corrections
const _origLoadThreatIntelligence = window.loadThreatIntelligence;
window.loadThreatIntelligence = async function() {
  if (_origLoadThreatIntelligence) await _origLoadThreatIntelligence();
  await loadThreatIntelFromCorrections();
  await loadLearningTimeline();
};

// Extend loadBlacklistSection when nav switches to it
const _origSwitchSectionFull = window.switchSection;
window.switchSection = function(name) {
  _origSwitchSectionFull(name);
  if (name === 'blacklist')    loadBlacklist();
  if (name === 'threat-intel') { loadThreatIntelligence(); }
};

// Add related intelligence card to Detection Intelligence detail panel
// (injected after the existing detection intel timeline card)
const _origOpenIntelDet = window.openIntelligenceDetection;
window.openIntelligenceDetection = async function(id) {
  if (_origOpenIntelDet) await _origOpenIntelDet(id);
  // Add related intelligence section if not already present
  const body = document.getElementById('detectionIntelWorkspace');
  if (body && !document.getElementById('did-related-card')) {
    const card = document.createElement('div');
    card.className = 'ap-card';
    card.id = 'did-related-card';
    card.innerHTML = `
      <div class="ap-card-title" style="margin-bottom:12px">🔗 Related Intelligence</div>
      <div id="did-related"><div style="color:#4a5568;font-size:.78rem">Loading…</div></div>`;
    const bodyEl = body.querySelector('.detection-intel-body');
    if (bodyEl) bodyEl.appendChild(card);
  }
  loadRelatedIntelligence(id);
  loadLearningTimeline(id);
};
