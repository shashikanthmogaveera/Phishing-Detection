$base = "C:\Users\amash\Desktop\PROJECT_6\AI-Powered Spam & Phishing Detection System"
$html = '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>AI Threat Detection Console - CyberShield AI</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<link rel="stylesheet" href="detection.css"/>
</head>
<body>

<!-- BG -->
<div class="page-bg">
  <div class="grid-overlay"></div>
  <div class="orb orb-1"></div><div class="orb orb-2"></div><div class="orb orb-3"></div>
</div>

<!-- NAVBAR -->
<nav class="navbar" id="navbar">
  <div class="nav-inner">
    <a href="index.html" class="nav-logo">
      <div class="logo-icon"><svg width="22" height="22" viewBox="0 0 28 28" fill="none"><path d="M14 2L4 7v7c0 5.5 4.3 10.7 10 12 5.7-1.3 10-6.5 10-12V7L14 2z" fill="url(#ng)" stroke="rgba(99,179,237,0.4)" stroke-width="0.5"/><path d="M10 14l3 3 5-5" stroke="#63b3ed" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><defs><linearGradient id="ng" x1="4" y1="2" x2="24" y2="26" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#1a365d"/><stop offset="100%" stop-color="#2d3748"/></linearGradient></defs></svg></div>
      <span>CyberShield <span class="logo-ai">AI</span></span>
    </a>
    <div class="nav-center">
      <a href="index.html">Home</a>
      <a href="detection.html" class="active">Detection</a>
      <a href="#" data-protected="true">History</a>
      <a href="index.html#contact">Support</a>
    </div>
    <div class="nav-right" id="navRight">
      <a href="login.html" class="btn-ghost nav-login">Login</a>
      <a href="signup.html" class="btn-primary-sm nav-signup">Sign Up</a>
      <div class="nav-user" style="display:none">
        <div class="nav-avatar"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#63b3ed" stroke-width="1.3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#63b3ed" stroke-width="1.3" stroke-linecap="round"/></svg></div>
        <span class="nav-username"></span>
        <button class="nav-logout-btn" onclick="logout()">Sign Out</button>
      </div>
    </div>
  </div>
</nav>

<!-- PAGE HEADER -->
<header class="det-header">
  <div class="det-header-inner">
    <div class="det-header-icon">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M20 3L5 10v11c0 8.3 6.5 16 15 18 8.5-2 15-9.7 15-18V10L20 3z" fill="url(#hg)" stroke="rgba(99,179,237,0.3)" stroke-width="0.8"/><path d="M14 20l4.5 4.5L26 16" stroke="#63b3ed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="20" r="6" stroke="rgba(99,179,237,0.2)" stroke-width="1" stroke-dasharray="3 3"/><defs><linearGradient id="hg" x1="5" y1="3" x2="35" y2="38" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#1a365d"/><stop offset="100%" stop-color="#2d3748"/></linearGradient></defs></svg>
      <div class="header-icon-ring"></div>
    </div>
    <div class="det-header-text">
      <div class="det-header-tag"><span class="pulse-dot"></span> AI Engine Active</div>
      <h1>AI Threat Detection Console</h1>
      <p>Analyze suspicious SMS, WhatsApp messages, Emails, URLs, and screenshots using AI-powered cyber threat analysis.</p>
    </div>
    <div class="det-header-stats">
      <div class="hstat"><div class="hstat-val">98.4%</div><div class="hstat-label">Accuracy</div></div>
      <div class="hstat-div"></div>
      <div class="hstat"><div class="hstat-val">5.9K</div><div class="hstat-label">Scans Today</div></div>
      <div class="hstat-div"></div>
      <div class="hstat"><div class="hstat-val">1.2K</div><div class="hstat-label">Threats Blocked</div></div>
    </div>
  </div>
</header>

<!-- MAIN WORKSPACE -->
<div class="workspace">
  <div class="workspace-left">

    <!-- DETECTION TYPE SELECTOR -->
    <div class="det-card selector-card">
      <div class="card-label">Detection Type</div>
      <div class="det-tabs" id="detTabs">
        <button class="det-tab active" data-type="sms" onclick="switchType(''sms'')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M5 7h8M5 10h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          SMS
        </button>
        <button class="det-tab" data-type="whatsapp" onclick="switchType(''whatsapp'')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.3"/><path d="M6 9.5c.5 1.5 2.5 2.5 4 1.5l1.5.5-.5-1.5C12 8 11 6 9 6c-2 0-3.5 1.5-3 3.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          WhatsApp
        </button>
        <button class="det-tab" data-type="email" onclick="switchType(''email'')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M2 6l7 5 7-5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Email
        </button>
        <button class="det-tab" data-type="url" onclick="switchType(''url'')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 11l-2 2a3 3 0 004.2 0l4-4a3 3 0 00-4.2-4.2L7.5 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11 7l2-2a3 3 0 00-4.2 0L4.8 9a3 3 0 004.2 4.2L10.5 12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          URL Analysis
        </button>
        <button class="det-tab" data-type="screenshot" onclick="switchType(''screenshot'')">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.3"/><circle cx="9" cy="8.5" r="2.5" stroke="currentColor" stroke-width="1.2"/><path d="M5 15l2-2h4l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Screenshot OCR
        </button>
      </div>
    </div>

    <!-- INPUT WORKSPACE -->
    <div class="det-card input-card">
      <div class="input-card-header">
        <div class="card-label" id="inputLabel">Message Content</div>
        <div class="lang-wrap">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#718096" stroke-width="1.1"/><path d="M1 7h12M7 1c-2 2-2 8 0 12M7 1c2 2 2 8 0 12" stroke="#718096" stroke-width="1.1"/></svg>
          <select id="langSelect" class="lang-select">
            <option value="auto">Auto Detect</option>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="kn">Kannada</option>
          </select>
        </div>
      </div>

      <!-- TEXT INPUT (SMS / WhatsApp / Email) -->
      <div id="textInputArea">
        <div class="textarea-wrap">
          <textarea id="msgInput" class="msg-textarea" placeholder="Paste suspicious SMS here..." spellcheck="false" oninput="liveAnalyze(this.value)"></textarea>
          <div class="textarea-overlay" id="highlightOverlay"></div>
          <div class="live-warning" id="liveWarning"></div>
          <div class="char-count" id="charCount">0 / 2000</div>
        </div>
      </div>

      <!-- URL INPUT -->
      <div id="urlInputArea" style="display:none">
        <div class="url-input-wrap">
          <svg class="url-icon" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 10l-2 2a2.83 2.83 0 004 0l4-4a2.83 2.83 0 00-4-4L6.5 6" stroke="#63b3ed" stroke-width="1.3" fill="none" stroke-linecap="round"/><path d="M10 6l2-2a2.83 2.83 0 00-4 0L4 8a2.83 2.83 0 004 4L9.5 10" stroke="#63b3ed" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>
          <input type="url" id="urlInput" class="url-input" placeholder="https://suspicious-domain.xyz/login" autocomplete="off"/>
        </div>
        <div class="url-preview-panel" id="urlPreviewPanel" style="display:none">
          <div class="url-preview-row"><span class="url-preview-label">Domain</span><span class="url-preview-val" id="urlDomain">-</span></div>
          <div class="url-preview-row"><span class="url-preview-label">Protocol</span><span class="url-preview-val" id="urlProtocol">-</span></div>
          <div class="url-preview-row"><span class="url-preview-label">Status</span><span class="url-preview-val" id="urlStatus">-</span></div>
        </div>
      </div>

      <!-- FILE UPLOAD -->
      <div id="fileInputArea" style="display:none">
        <div class="upload-zone" id="uploadZone" ondragover="dragOver(event)" ondragleave="dragLeave(event)" ondrop="dropFile(event)" onclick="document.getElementById(''fileInput'').click()">
          <input type="file" id="fileInput" accept=".png,.jpg,.jpeg,.txt,.csv" style="display:none" onchange="handleFile(this.files[0])"/>
          <div class="upload-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect x="4" y="4" width="24" height="24" rx="4" stroke="rgba(99,179,237,0.3)" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M16 20v-8M12 16l4-4 4 4" stroke="#63b3ed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div class="upload-text">Drag & drop file here or <span>browse</span></div>
          <div class="upload-hint">PNG, JPG, JPEG, TXT, CSV supported</div>
          <div class="upload-filename" id="uploadFilename"></div>
        </div>
        <div class="ocr-status" id="ocrStatus" style="display:none">
          <span class="ocr-dot"></span>
          <span id="ocrStatusText">Extracting text via OCR...</span>
        </div>
      </div>

      <!-- ANALYZE BUTTON -->
      <button class="analyze-btn" id="analyzeBtn" onclick="runAnalysis()">
        <div class="analyze-btn-inner">
          <svg class="analyze-icon" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2L3 6v5c0 4.1 3.1 7.9 7 9 3.9-1.1 7-4.9 7-9V6L10 2z" stroke="currentColor" stroke-width="1.5"/><path d="M7 10l2.5 2.5L13 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span id="analyzeBtnText">Analyze Threat</span>
        </div>
        <div class="analyze-pulse"></div>
      </button>

      <!-- SCANNING STATE -->
      <div class="scanning-state" id="scanningState" style="display:none">
        <div class="scan-ring"><div class="scan-ring-inner"></div></div>
        <div class="scan-texts">
          <div class="scan-text active" id="scanText">Initializing AI engine...</div>
          <div class="scan-progress-bar"><div class="scan-progress-fill" id="scanFill"></div></div>
        </div>
      </div>
    </div>

    <!-- RESULTS SECTION -->
    <div class="results-section" id="resultsSection" style="display:none">

      <!-- THREAT STATUS -->
      <div class="det-card result-status-card" id="statusCard">
        <div class="status-left">
          <div class="status-icon-wrap" id="statusIconWrap">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" id="statusIcon"><path d="M14 3L5 8v7c0 5 3.8 9.7 9 11 5.2-1.3 9-6 9-11V8L14 3z" stroke="currentColor" stroke-width="1.5"/><path d="M10 14l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <div>
            <div class="status-verdict" id="statusVerdict">ANALYZING...</div>
            <div class="status-sub" id="statusSub">Processing threat data</div>
          </div>
        </div>
        <div class="status-right">
          <div class="threat-score-wrap">
            <svg class="score-ring" width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>
              <circle cx="40" cy="40" r="32" fill="none" stroke="#63b3ed" stroke-width="6" stroke-linecap="round" stroke-dasharray="201" stroke-dashoffset="201" id="scoreCircle" transform="rotate(-90 40 40)"/>
            </svg>
            <div class="score-center">
              <div class="score-num" id="scoreNum">0</div>
              <div class="score-label">Score</div>
            </div>
          </div>
        </div>
      </div>

      <!-- DETAILS ROW -->
      <div class="results-row">
        <!-- SCAM CATEGORY -->
        <div class="det-card result-mini-card">
          <div class="mini-card-label">Scam Category</div>
          <div class="scam-category" id="scamCategory">
            <span class="scam-badge" id="scamBadge">-</span>
          </div>
          <div class="scam-tags" id="scamTags"></div>
        </div>
        <!-- LINK ANALYSIS -->
        <div class="det-card result-mini-card" id="linkCard">
          <div class="mini-card-label">Link Analysis</div>
          <div class="link-analysis" id="linkAnalysis">
            <div class="no-links" id="noLinks">No URLs detected</div>
            <div class="link-list" id="linkList" style="display:none"></div>
          </div>
        </div>
      </div>

      <!-- EXPLAINABLE AI -->
      <div class="det-card explain-card">
        <div class="explain-header">
          <div class="explain-title"><span class="ai-dot"></span> Explainable AI — Why flagged?</div>
          <div class="explain-confidence" id="explainConf"></div>
        </div>
        <div class="explain-reasons" id="explainReasons"></div>
        <div class="explain-keywords">
          <div class="explain-kw-label">Flagged Keywords</div>
          <div class="explain-kw-list" id="kwList"></div>
        </div>
      </div>

      <!-- RECOMMENDATIONS -->
      <div class="det-card reco-card">
        <div class="mini-card-label">Security Recommendations</div>
        <div class="reco-list" id="recoList"></div>
      </div>

      <!-- ACTION BUTTONS -->
      <div class="action-row">
        <button class="action-btn" onclick="saveReport()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13h10M8 3v7M5 7l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Save Report
        </button>
        <button class="action-btn" onclick="downloadPDF()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 6h6M5 9h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Download PDF
        </button>
        <button class="action-btn action-btn-danger" onclick="reportMessage()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2C4.7 2 2 4.7 2 8s2.7 6 6 6 6-2.7 6-6-2.7-6-6-6z" stroke="currentColor" stroke-width="1.3"/><path d="M8 5v4M8 11v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Report Suspicious
        </button>
      </div>

      <!-- FEEDBACK -->
      <div class="det-card feedback-card">
        <div class="feedback-label">Was this prediction correct?</div>
        <div class="feedback-btns">
          <button class="fb-btn fb-yes" id="fbYes" onclick="giveFeedback(true)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Correct
          </button>
          <button class="fb-btn fb-no" id="fbNo" onclick="giveFeedback(false)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Wrong Prediction
          </button>
        </div>
        <div class="feedback-thanks" id="feedbackThanks" style="display:none">Thank you for your feedback. This helps improve our AI model.</div>
      </div>

    </div>
  </div>

  <!-- SIDE PANEL -->
  <aside class="workspace-right">
    <div class="det-card side-card">
      <div class="side-card-title">Recent Detections</div>
      <div class="recent-list" id="recentList">
        <div class="recent-item"><span class="recent-badge r-danger">PHISH</span><div class="recent-info"><div class="recent-src">Email phishing attempt</div><div class="recent-time">2 min ago</div></div><span class="recent-score-val" style="color:#fc8181">94</span></div>
        <div class="recent-item"><span class="recent-badge r-warn">SPAM</span><div class="recent-info"><div class="recent-src">SMS lottery scam</div><div class="recent-time">8 min ago</div></div><span class="recent-score-val" style="color:#f6ad55">78</span></div>
        <div class="recent-item"><span class="recent-badge r-danger">SCAM</span><div class="recent-info"><div class="recent-src">WhatsApp KYC fraud</div><div class="recent-time">15 min ago</div></div><span class="recent-score-val" style="color:#fc8181">89</span></div>
        <div class="recent-item"><span class="recent-badge r-safe">SAFE</span><div class="recent-info"><div class="recent-src">URL github.com</div><div class="recent-time">22 min ago</div></div><span class="recent-score-val" style="color:#68d391">4</span></div>
        <div class="recent-item"><span class="recent-badge r-warn">SPAM</span><div class="recent-info"><div class="recent-src">OTP fraud SMS</div><div class="recent-time">31 min ago</div></div><span class="recent-score-val" style="color:#f6ad55">82</span></div>
      </div>
    </div>
    <div class="det-card side-card">
      <div class="side-card-title">Latest Threat Types</div>
      <div class="threat-type-list">
        <div class="threat-type-item"><div class="tt-bar-wrap"><div class="tt-label">Banking Phishing</div><div class="tt-bar"><div style="width:78%;background:#fc8181"></div></div></div><span class="tt-pct">78%</span></div>
        <div class="threat-type-item"><div class="tt-bar-wrap"><div class="tt-label">OTP Fraud</div><div class="tt-bar"><div style="width:65%;background:#f6ad55"></div></div></div><span class="tt-pct">65%</span></div>
        <div class="threat-type-item"><div class="tt-bar-wrap"><div class="tt-label">UPI Scam</div><div class="tt-bar"><div style="width:54%;background:#9f7aea"></div></div></div><span class="tt-pct">54%</span></div>
        <div class="threat-type-item"><div class="tt-bar-wrap"><div class="tt-label">Fake Job Offer</div><div class="tt-bar"><div style="width:41%;background:#63b3ed"></div></div></div><span class="tt-pct">41%</span></div>
        <div class="threat-type-item"><div class="tt-bar-wrap"><div class="tt-label">Lottery Scam</div><div class="tt-bar"><div style="width:33%;background:#68d391"></div></div></div><span class="tt-pct">33%</span></div>
      </div>
    </div>
    <div class="det-card side-card ai-status-card">
      <div class="side-card-title">AI Engine Status</div>
      <div class="ai-status-list">
        <div class="ai-status-item"><span class="ai-status-dot green"></span><span>NLP Model v3.2</span><span class="ai-status-val">Active</span></div>
        <div class="ai-status-item"><span class="ai-status-dot green"></span><span>URL Scanner</span><span class="ai-status-val">Active</span></div>
        <div class="ai-status-item"><span class="ai-status-dot green"></span><span>OCR Engine</span><span class="ai-status-val">Active</span></div>
        <div class="ai-status-item"><span class="ai-status-dot blue"></span><span>Threat DB</span><span class="ai-status-val">Synced</span></div>
      </div>
    </div>
  </aside>
</div>

<div class="toast" id="toast"><span class="toast-dot"></span><span class="toast-msg"></span></div>

<script src="auth.js"></script>
<script src="detection.js"></script>
</body>
</html>'
[System.IO.File]::WriteAllText("$base\detection.html", $html)
Write-Host "detection.html OK:" (Get-Item "$base\detection.html").Length
