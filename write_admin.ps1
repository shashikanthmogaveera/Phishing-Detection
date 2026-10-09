$base = "C:\Users\amash\Desktop\PROJECT_6\AI-Powered Spam & Phishing Detection System"

# ── admin.html ───────────────────────────────────────────────
$admin = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Admin Panel - CyberShield AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="admin.css"/>
</head>
<body>
<div class="ap-layout">

  <!-- SIDEBAR -->
  <aside class="ap-sidebar">
    <div class="ap-logo">
      <div class="logo-icon"><svg width="24" height="24" viewBox="0 0 28 28" fill="none"><path d="M14 2L4 7v7c0 5.5 4.3 10.7 10 12 5.7-1.3 10-6.5 10-12V7L14 2z" fill="url(#sg)" stroke="rgba(99,179,237,0.4)" stroke-width="0.5"/><path d="M10 14l3 3 5-5" stroke="#63b3ed" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="sg" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#1a365d"/><stop offset="100%" stop-color="#2d3748"/></linearGradient></defs></svg></div>
      <div><span class="logo-text">CyberShield <span class="logo-ai">AI</span></span><span class="logo-sub">Admin Panel</span></div>
    </div>
    <nav class="ap-nav">
      <a href="#" class="ap-nav-item active" data-section="dashboard"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.3"/><rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.3"/><rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.3"/></svg> Dashboard</a>
      <a href="#" class="ap-nav-item" data-section="users"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M1 16c0-3.3 2.7-6 6-6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="13" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 16c0-2.2 1.3-4 3-4s3 1.8 3 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Users</a>
      <a href="#" class="ap-nav-item" data-section="detections"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 2L2 5.5v5c0 3.8 3 7.3 7 8.2 4-0.9 7-4.4 7-8.2v-5L9 2z" stroke="currentColor" stroke-width="1.3"/><path d="M6 9l2.5 2.5L12 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Detections</a>
      <a href="#" class="ap-nav-item" data-section="analytics"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 14l4-5 3 2 3-6 4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Analytics</a>
      <a href="#" class="ap-nav-item" data-section="settings"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.2 3.2l1.4 1.4M13.4 13.4l1.4 1.4M3.2 14.8l1.4-1.4M13.4 4.6l1.4-1.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Settings</a>
    </nav>
    <div class="ap-sidebar-footer">
      <div class="ap-admin-info">
        <div class="ap-avatar"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v4c0 3.3 2.6 6.4 6 7.2 3.4-.8 6-3.9 6-7.2V4L8 1z" stroke="#f6ad55" stroke-width="1.3"/></svg></div>
        <div><div class="ap-admin-name" id="adminName">Admin</div><div class="ap-admin-role">Administrator</div></div>
      </div>
      <button class="ap-logout" onclick="adminLogout()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
  </aside>

  <!-- MAIN -->
  <main class="ap-main">
    <div class="ap-topbar">
      <div>
        <h1 class="ap-page-title" id="pageTitle">Dashboard</h1>
        <p class="ap-page-sub" id="pageSub">System overview and key metrics</p>
      </div>
      <div class="ap-topbar-right">
        <div class="ap-status"><span class="pulse-dot"></span> All systems operational</div>
        <div class="ap-admin-chip"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v4c0 3.3 2.6 6.4 6 7.2 3.4-.8 6-3.9 6-7.2V4L8 1z" stroke="#f6ad55" stroke-width="1.3"/></svg><span id="topAdminName">Admin</span></div>
      </div>
    </div>

    <!-- DASHBOARD SECTION -->
    <div class="ap-section active" id="sec-dashboard">
      <div class="ap-stats-grid">
        <div class="ap-stat-card"><div class="ap-stat-icon" style="--c:#fc8181"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 6v5c0 4.1 3.1 7.9 7 9 3.9-1.1 7-4.9 7-9V6L10 2z" stroke="#fc8181" stroke-width="1.4"/></svg></div><div class="ap-stat-info"><div class="ap-stat-val" id="stat-threats">0</div><div class="ap-stat-label">Total Threats</div></div></div>
        <div class="ap-stat-card"><div class="ap-stat-icon" style="--c:#63b3ed"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7" r="4" stroke="#63b3ed" stroke-width="1.4"/><path d="M3 18c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="#63b3ed" stroke-width="1.4" stroke-linecap="round"/></svg></div><div class="ap-stat-info"><div class="ap-stat-val" id="stat-users">0</div><div class="ap-stat-label">Registered Users</div></div></div>
        <div class="ap-stat-card"><div class="ap-stat-icon" style="--c:#f6ad55"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5l7 5 7-5M3 5v10h14V5" stroke="#f6ad55" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="ap-stat-info"><div class="ap-stat-val" id="stat-phishing">0</div><div class="ap-stat-label">Phishing Detected</div></div></div>
        <div class="ap-stat-card"><div class="ap-stat-icon" style="--c:#68d391"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10l5 5 7-7" stroke="#68d391" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="ap-stat-info"><div class="ap-stat-val" id="stat-accuracy">98.4%</div><div class="ap-stat-label">AI Accuracy</div></div></div>
      </div>
      <div class="ap-row-2">
        <div class="ap-card">
          <div class="ap-card-title">Threat Distribution</div>
          <div class="chart-bars">
            <div class="chart-bar-wrap"><div class="chart-bar" style="height:75%;background:linear-gradient(to top,#fc8181,#feb2b2)"></div><span>Phishing</span></div>
            <div class="chart-bar-wrap"><div class="chart-bar" style="height:55%;background:linear-gradient(to top,#f6ad55,#fbd38d)"></div><span>Spam</span></div>
            <div class="chart-bar-wrap"><div class="chart-bar" style="height:40%;background:linear-gradient(to top,#9f7aea,#b794f4)"></div><span>Scam</span></div>
            <div class="chart-bar-wrap"><div class="chart-bar" style="height:30%;background:linear-gradient(to top,#63b3ed,#90cdf4)"></div><span>Malware</span></div>
            <div class="chart-bar-wrap"><div class="chart-bar" style="height:20%;background:linear-gradient(to top,#68d391,#9ae6b4)"></div><span>Safe</span></div>
          </div>
        </div>
        <div class="ap-card">
          <div class="ap-card-title">Recent Activity</div>
          <div class="ap-activity" id="recentActivity">
            <div class="ap-activity-item"><span class="act-dot green"></span><span class="act-text">System initialized</span><span class="act-time">Just now</span></div>
            <div class="ap-activity-item"><span class="act-dot blue"></span><span class="act-text">Admin logged in</span><span class="act-time">Just now</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- USERS SECTION -->
    <div class="ap-section" id="sec-users">
      <div class="ap-card">
        <div class="ap-card-header"><div class="ap-card-title">Registered Users</div><div class="ap-search-wrap"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" stroke-width="1.2"/><path d="M9.5 9.5l2.5 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg><input type="text" id="userSearch" placeholder="Search users..." oninput="filterUsers()"/></div></div>
        <div class="ap-table-wrap">
          <table class="ap-table">
            <thead><tr><th>#</th><th>Username</th><th>Email</th><th>Phone</th><th>Joined</th><th>Status</th></tr></thead>
            <tbody id="usersTableBody"><tr><td colspan="6" class="ap-empty">No users registered yet.</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- DETECTIONS SECTION -->
    <div class="ap-section" id="sec-detections">
      <div class="ap-card">
        <div class="ap-card-header"><div class="ap-card-title">Detection Log</div><span class="ap-badge">Live</span></div>
        <div class="ap-table-wrap">
          <table class="ap-table">
            <thead><tr><th>#</th><th>Type</th><th>Source</th><th>Threat Score</th><th>Status</th><th>Time</th></tr></thead>
            <tbody id="detectionsBody">
              <tr><td>1</td><td><span class="badge-danger">PHISH</span></td><td>support@paypa1-verify.com</td><td><span style="color:#fc8181;font-family:monospace">94</span></td><td><span class="badge-blocked">Blocked</span></td><td>2 min ago</td></tr>
              <tr><td>2</td><td><span class="badge-warn">SPAM</span></td><td>SMS +91-XXXXX</td><td><span style="color:#f6ad55;font-family:monospace">78</span></td><td><span class="badge-blocked">Blocked</span></td><td>5 min ago</td></tr>
              <tr><td>3</td><td><span class="badge-danger">SCAM</span></td><td>WhatsApp KYC Alert</td><td><span style="color:#fc8181;font-family:monospace">89</span></td><td><span class="badge-blocked">Blocked</span></td><td>11 min ago</td></tr>
              <tr><td>4</td><td><span class="badge-safe">SAFE</span></td><td>https://github.com</td><td><span style="color:#68d391;font-family:monospace">4</span></td><td><span class="badge-safe-s">Passed</span></td><td>14 min ago</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ANALYTICS SECTION -->
    <div class="ap-section" id="sec-analytics">
      <div class="ap-stats-grid">
        <div class="ap-stat-card"><div class="ap-stat-icon" style="--c:#9f7aea"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 14l4-5 3 2 3-6 4 4" stroke="#9f7aea" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="ap-stat-info"><div class="ap-stat-val">5,921</div><div class="ap-stat-label">URLs Analyzed</div></div></div>
        <div class="ap-stat-card"><div class="ap-stat-icon" style="--c:#76e4f7"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="10" rx="2" stroke="#76e4f7" stroke-width="1.4"/><path d="M7 17h6M10 13v4" stroke="#76e4f7" stroke-width="1.4" stroke-linecap="round"/></svg></div><div class="ap-stat-info"><div class="ap-stat-val">1,284</div><div class="ap-stat-label">Scans Today</div></div></div>
        <div class="ap-stat-card"><div class="ap-stat-icon" style="--c:#fbb6ce"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 14.4l-4.8 2.5.9-5.4L2.2 7.7l5.4-.8L10 2z" stroke="#fbb6ce" stroke-width="1.4" stroke-linejoin="round"/></svg></div><div class="ap-stat-info"><div class="ap-stat-val">98.4%</div><div class="ap-stat-label">Detection Rate</div></div></div>
        <div class="ap-stat-card"><div class="ap-stat-icon" style="--c:#b794f4"><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="#b794f4" stroke-width="1.4"/><path d="M10 7v4l2.5 2.5" stroke="#b794f4" stroke-width="1.4" stroke-linecap="round"/></svg></div><div class="ap-stat-info"><div class="ap-stat-val">24/7</div><div class="ap-stat-label">Uptime</div></div></div>
      </div>
      <div class="ap-card" style="margin-top:20px">
        <div class="ap-card-title">AI Signal Analysis</div>
        <div class="ai-signals">
          <div class="ai-signal"><span class="signal-label">Urgency Language Detection</span><div class="signal-bar"><div style="width:91%;background:#fc8181"></div></div><span class="signal-pct">91%</span></div>
          <div class="ai-signal"><span class="signal-label">Domain Spoofing Patterns</span><div class="signal-bar"><div style="width:87%;background:#f6ad55"></div></div><span class="signal-pct">87%</span></div>
          <div class="ai-signal"><span class="signal-label">Credential Harvesting Signals</span><div class="signal-bar"><div style="width:95%;background:#fc8181"></div></div><span class="signal-pct">95%</span></div>
          <div class="ai-signal"><span class="signal-label">Suspicious URL Patterns</span><div class="signal-bar"><div style="width:78%;background:#9f7aea"></div></div><span class="signal-pct">78%</span></div>
          <div class="ai-signal"><span class="signal-label">OTP/UPI Fraud Indicators</span><div class="signal-bar"><div style="width:83%;background:#f6ad55"></div></div><span class="signal-pct">83%</span></div>
        </div>
      </div>
    </div>

    <!-- SETTINGS SECTION -->
    <div class="ap-section" id="sec-settings">
      <div class="ap-card">
        <div class="ap-card-title">Admin Account Settings</div>
        <div class="settings-grid">
          <div class="setting-item"><div class="setting-label">Admin Name</div><div class="setting-val" id="set-name">-</div></div>
          <div class="setting-item"><div class="setting-label">Email</div><div class="setting-val" id="set-email">-</div></div>
          <div class="setting-item"><div class="setting-label">Phone</div><div class="setting-val" id="set-phone">-</div></div>
          <div class="setting-item"><div class="setting-label">Role</div><div class="setting-val"><span class="role-badge">Administrator</span></div></div>
          <div class="setting-item"><div class="setting-label">Secret Code</div><div class="setting-val"><span class="secret-mask">••••••••</span></div></div>
          <div class="setting-item"><div class="setting-label">Session</div><div class="setting-val" id="set-session">Active</div></div>
        </div>
        <button class="ap-logout-btn" onclick="adminLogout()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3-3-3M14 8H6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Sign Out</button>
      </div>
    </div>

  </main>
</div>
<script src="auth.js"></script>
<script src="admin.js"></script>
</body>
</html>'
[System.IO.File]::WriteAllText("$base\admin.html", $admin)
Write-Host "admin.html OK:" (Get-Item "$base\admin.html").Length
