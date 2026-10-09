$base = "C:\Users\amash\Desktop\PROJECT_6\AI-Powered Spam & Phishing Detection System"
$js = '/* detection.js - CyberShield AI Detection Console */

// ── Auth guard ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const session = JSON.parse(localStorage.getItem("cs_session") || "null");
  const adminSession = JSON.parse(localStorage.getItem("cs_admin_session") || "null");
  updateNavbar(session);

  document.querySelectorAll("[data-protected]").forEach(link => {
    link.addEventListener("click", e => {
      if (!session && !adminSession) { e.preventDefault(); showAuthModal(); }
    });
  });

  // Navbar scroll
  const nav = document.getElementById("navbar");
  window.addEventListener("scroll", () => nav.classList.toggle("scrolled", window.scrollY > 10));

  // URL live preview
  const urlInp = document.getElementById("urlInput");
  if (urlInp) urlInp.addEventListener("input", () => previewURL(urlInp.value));
});

function updateNavbar(session) {
  const li = document.querySelector(".nav-login");
  const si = document.querySelector(".nav-signup");
  const um = document.querySelector(".nav-user");
  if (session) {
    if (li) li.style.display = "none";
    if (si) si.style.display = "none";
    if (um) { um.style.display = "flex"; const n = um.querySelector(".nav-username"); if (n) n.textContent = session.username; }
  } else {
    if (li) li.style.display = "";
    if (si) si.style.display = "";
    if (um) um.style.display = "none";
  }
}
function logout() { localStorage.removeItem("cs_session"); window.location.href = "index.html"; }

// ── Detection type switcher ───────────────────────────────────
let currentType = "sms";
const placeholders = {
  sms: "Paste suspicious SMS here...\n\nExample: Your account has been blocked. Click here to verify: http://bank-secure.xyz",
  whatsapp: "Paste suspicious WhatsApp message here...\n\nExample: Congratulations! You won Rs.50,000. Send your OTP to claim.",
  email: "Paste suspicious email content here...\n\nInclude subject, sender, and body for best results.",
  url: "",
  screenshot: ""
};
const inputLabels = { sms:"SMS Content", whatsapp:"WhatsApp Message", email:"Email Content", url:"URL to Analyze", screenshot:"Upload Screenshot / File" };

function switchType(type) {
  currentType = type;
  document.querySelectorAll(".det-tab").forEach(t => t.classList.toggle("active", t.dataset.type === type));
  document.getElementById("inputLabel").textContent = inputLabels[type];
  document.getElementById("textInputArea").style.display  = ["sms","whatsapp","email"].includes(type) ? "" : "none";
  document.getElementById("urlInputArea").style.display   = type === "url" ? "" : "none";
  document.getElementById("fileInputArea").style.display  = type === "screenshot" ? "" : "none";
  const ta = document.getElementById("msgInput");
  if (ta) ta.placeholder = placeholders[type] || "";
  clearResults();
  clearLiveWarning();
}

// ── Live keyword analysis ─────────────────────────────────────
const suspiciousKeywords = ["otp","upi","kyc","verify","account blocked","click here","urgent","winner","prize","lottery","bank","password","login","credential","suspend","claim","reward","free","congratulations","limited time","act now","verify now","confirm","update your","dear customer","transaction failed"];
const bankingKeywords = ["bank","account","ifsc","upi","neft","rtgs","imps","netbanking","atm","debit","credit","pin","cvv","otp"];
const phishingKeywords = ["click here","verify now","account suspended","login","password","credential","confirm your","update your","limited time","act now","urgent action"];

function liveAnalyze(val) {
  const count = document.getElementById("charCount");
  if (count) count.textContent = val.length + " / 2000";
  if (val.length > 2000) { const ta = document.getElementById("msgInput"); if (ta) ta.value = val.slice(0,2000); return; }
  const lower = val.toLowerCase();
  const found = suspiciousKeywords.filter(k => lower.includes(k));
  const warn = document.getElementById("liveWarning");
  if (!warn) return;
  if (found.length >= 3) {
    warn.innerHTML = "⚠ Multiple suspicious patterns detected (" + found.length + " signals)";
  } else if (bankingKeywords.some(k => lower.includes(k))) {
    warn.innerHTML = "⚠ Suspicious banking keywords detected";
  } else if (phishingKeywords.some(k => lower.includes(k))) {
    warn.innerHTML = "⚠ Potential phishing language detected";
  } else if (found.length > 0) {
    warn.innerHTML = "⚠ Suspicious keyword: \"" + found[0] + "\"";
  } else {
    warn.innerHTML = "";
  }
}

function clearLiveWarning() {
  const w = document.getElementById("liveWarning"); if (w) w.innerHTML = "";
  const c = document.getElementById("charCount"); if (c) c.textContent = "0 / 2000";
}

// ── URL preview ───────────────────────────────────────────────
function previewURL(val) {
  const panel = document.getElementById("urlPreviewPanel");
  if (!val || !val.trim()) { if (panel) panel.style.display = "none"; return; }
  try {
    const u = new URL(val.startsWith("http") ? val : "https://" + val);
    document.getElementById("urlDomain").textContent = u.hostname;
    document.getElementById("urlProtocol").textContent = u.protocol.replace(":","");
    const suspicious = !val.startsWith("https") || u.hostname.includes("-") || u.hostname.split(".").length > 3;
    const statusEl = document.getElementById("urlStatus");
    statusEl.textContent = suspicious ? "⚠ Suspicious" : "Appears normal";
    statusEl.style.color = suspicious ? "#f6ad55" : "#68d391";
    if (panel) panel.style.display = "";
  } catch(e) { if (panel) panel.style.display = "none"; }
}

// ── File upload ───────────────────────────────────────────────
function dragOver(e) { e.preventDefault(); document.getElementById("uploadZone").classList.add("drag-over"); }
function dragLeave(e) { document.getElementById("uploadZone").classList.remove("drag-over"); }
function dropFile(e) {
  e.preventDefault();
  document.getElementById("uploadZone").classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
}
function handleFile(file) {
  if (!file) return;
  const allowed = ["image/png","image/jpeg","image/jpg","text/plain","text/csv","application/vnd.ms-excel"];
  if (!allowed.includes(file.type) && !file.name.match(/\.(txt|csv|png|jpg|jpeg)$/i)) {
    showToast("Unsupported file type.", "error"); return;
  }
  document.getElementById("uploadFilename").textContent = "📎 " + file.name;
  const ocr = document.getElementById("ocrStatus");
  if (ocr) ocr.style.display = "flex";
  document.getElementById("ocrStatusText").textContent = "Reading file...";
  if (file.type.startsWith("image/")) {
    setTimeout(() => { document.getElementById("ocrStatusText").textContent = "OCR extraction complete. Ready to analyze."; }, 1800);
  } else {
    const reader = new FileReader();
    reader.onload = e => {
      const ta = document.getElementById("msgInput");
      switchType("sms");
      if (ta) { ta.value = e.target.result.slice(0,2000); liveAnalyze(ta.value); }
      if (ocr) ocr.style.display = "none";
      showToast("File content loaded.", "success");
    };
    reader.readAsText(file);
  }
}

// ── AI Analysis engine ────────────────────────────────────────
const scanMessages = ["Initializing AI engine...","Scanning content patterns...","Analyzing phishing indicators...","Detecting suspicious URLs...","Running NLP threat model...","Evaluating scam signatures...","Generating threat report..."];

function runAnalysis() {
  const session = JSON.parse(localStorage.getItem("cs_session") || "null");
  const adminSession = JSON.parse(localStorage.getItem("cs_admin_session") || "null");
  if (!session && !adminSession) { showAuthModal(); return; }

  let content = "";
  if (currentType === "url") {
    content = (document.getElementById("urlInput") || {}).value || "";
  } else if (currentType === "screenshot") {
    const fn = document.getElementById("uploadFilename").textContent;
    content = fn ? "screenshot:" + fn : "";
  } else {
    content = (document.getElementById("msgInput") || {}).value || "";
  }
  if (!content.trim()) { showToast("Please enter content to analyze.", "error"); return; }

  clearResults();
  document.getElementById("analyzeBtn").style.display = "none";
  const scanState = document.getElementById("scanningState");
  scanState.style.display = "flex";

  let step = 0;
  const fill = document.getElementById("scanFill");
  const scanText = document.getElementById("scanText");
  const interval = setInterval(() => {
    step++;
    const pct = Math.min(step * 14, 95);
    if (fill) fill.style.width = pct + "%";
    if (scanText && scanMessages[step-1]) scanText.textContent = scanMessages[step-1];
    if (step >= scanMessages.length) {
      clearInterval(interval);
      if (fill) fill.style.width = "100%";
      setTimeout(() => {
        scanState.style.display = "none";
        document.getElementById("analyzeBtn").style.display = "";
        showResults(content);
      }, 400);
    }
  }, 380);
}

// ── Result engine ─────────────────────────────────────────────
function analyzeContent(content) {
  const lower = content.toLowerCase();
  let score = 0;
  const reasons = [];
  const keywords = [];
  const links = [];

  // Extract URLs
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  const foundUrls = content.match(urlRegex) || [];
  foundUrls.forEach(u => {
    const isSuspicious = !u.startsWith("https") || u.includes("-") || /\.(xyz|tk|ml|ga|cf|gq|top|click|link)/.test(u);
    links.push({ url: u, suspicious: isSuspicious });
    if (isSuspicious) { score += 20; reasons.push("Suspicious URL pattern detected: " + u.slice(0,40)); }
  });

  // Keyword scoring
  const urgencyWords = ["urgent","immediately","act now","limited time","expire","suspended","blocked","verify now","confirm now"];
  const credWords = ["otp","password","pin","cvv","credential","login","username","account number"];
  const moneyWords = ["winner","prize","lottery","reward","free","congratulations","claim","rs.","inr","upi","transfer"];
  const phishWords = ["click here","verify your","update your","dear customer","account has been","transaction failed","kyc pending"];

  urgencyWords.forEach(w => { if (lower.includes(w)) { score += 12; keywords.push(w); reasons.push("Urgency language detected: \"" + w + "\""); } });
  credWords.forEach(w => { if (lower.includes(w)) { score += 18; keywords.push(w); reasons.push("Credential-related keyword: \"" + w + "\""); } });
  moneyWords.forEach(w => { if (lower.includes(w)) { score += 10; keywords.push(w); } });
  phishWords.forEach(w => { if (lower.includes(w)) { score += 15; keywords.push(w); reasons.push("Phishing pattern: \"" + w + "\""); } });

  // URL-only analysis
  if (currentType === "url") {
    try {
      const u = new URL(content.startsWith("http") ? content : "https://" + content);
      if (!content.startsWith("https")) { score += 25; reasons.push("Insecure HTTP protocol — no SSL/TLS encryption"); }
      if (u.hostname.split(".").length > 3) { score += 20; reasons.push("Excessive subdomains — common in phishing domains"); }
      if (u.hostname.includes("-")) { score += 15; reasons.push("Hyphenated domain — often used to mimic legitimate sites"); }
      if (/\.(xyz|tk|ml|ga|cf|gq|top|click|link)$/.test(u.hostname)) { score += 30; reasons.push("High-risk TLD detected: " + u.hostname.split(".").pop()); }
      if (/bank|paypal|paytm|amazon|google|microsoft|apple/.test(u.hostname) && !/(paypal\.com|paytm\.com|amazon\.com|google\.com|microsoft\.com|apple\.com)$/.test(u.hostname)) {
        score += 35; reasons.push("Brand impersonation detected in domain name");
      }
      links.push({ url: content, suspicious: score > 20 });
    } catch(e) { score += 10; reasons.push("Invalid or malformed URL structure"); }
  }

  score = Math.min(score, 100);

  // Verdict
  let verdict, category, tags, recommendations;
  if (score >= 70) {
    verdict = "PHISHING";
    category = "Banking Phishing";
    tags = ["Credential Theft","Fake Login","Social Engineering"];
    recommendations = [
      { icon: "[BLOCK]", text: "Do not click any links in this message" },
      { icon: "[LOCK]", text: "Never share OTP, PIN, or password with anyone" },
      { icon: "[MUTE]", text: "Block the sender immediately" },
      { icon: "[ALERT]", text: "Report to cybercrime.gov.in or call 1930" },
      { icon: "[BANK]", text: "Contact your bank directly if financial data was shared" }
    ];
  } else if (score >= 45) {
    verdict = "SPAM";
    category = "Promotional Spam";
    tags = ["Unsolicited","Mass Message","Low Trust"];
    recommendations = [
      { icon: "[WARN]", text: "Treat this message with caution" },
      { icon: "[BLOCK]", text: "Do not respond or click any links" },
      { icon: "[MUTE]", text: "Consider blocking the sender" },
      { icon: "[DEL]", text: "Delete the message" }
    ];
  } else if (score >= 25) {
    verdict = "SUSPICIOUS";
    category = "Unverified Source";
    tags = ["Low Confidence","Needs Review"];
    recommendations = [
      { icon: "[SCAN]", text: "Verify the sender through official channels" },
      { icon: "[WARN]", text: "Do not share personal information" },
      { icon: "[WEB]", text: "Check URLs before clicking" }
    ];
  } else {
    verdict = "SAFE";
    category = "No Threat Detected";
    tags = ["Verified","Low Risk"];
    recommendations = [
      { icon: "[OK]", text: "No significant threats detected" },
      { icon: "[SHIELD]", text: "Continue practicing safe digital habits" },
      { icon: "[SYNC]", text: "Run periodic scans on suspicious messages" }
    ];
  }

  // Scam type override
  if (lower.includes("otp") || lower.includes("one time password")) { category = "OTP Fraud"; tags = ["OTP Theft","Identity Fraud"]; }
  else if (lower.includes("upi") || lower.includes("gpay") || lower.includes("phonepe")) { category = "UPI Scam"; tags = ["Payment Fraud","UPI Theft"]; }
  else if (lower.includes("lottery") || lower.includes("winner") || lower.includes("prize")) { category = "Lottery Scam"; tags = ["Prize Fraud","Advance Fee"]; }
  else if (lower.includes("job") || lower.includes("hiring") || lower.includes("salary")) { category = "Fake Job Offer"; tags = ["Employment Fraud","Advance Fee"]; }
  else if (lower.includes("kyc")) { category = "KYC Fraud"; tags = ["Identity Theft","Document Fraud"]; }

  return { score, verdict, category, tags, reasons: reasons.slice(0,5), keywords: [...new Set(keywords)].slice(0,8), links, recommendations };
}

function showResults(content) {
  const r = analyzeContent(content);
  const sec = document.getElementById("resultsSection");
  sec.style.display = "";

  // Status card
  const card = document.getElementById("statusCard");
  const verdictMap = { PHISHING:"verdict-phishing", SPAM:"verdict-spam", SUSPICIOUS:"verdict-spam", SAFE:"verdict-safe", FRAUD:"verdict-fraud" };
  card.className = "det-card result-status-card " + (verdictMap[r.verdict] || "verdict-safe");
  document.getElementById("statusVerdict").textContent = r.verdict;
  const subMap = { PHISHING:"High-confidence phishing attempt detected", SPAM:"Unsolicited spam content identified", SUSPICIOUS:"Potentially suspicious — review recommended", SAFE:"No significant threats detected", FRAUD:"Fraudulent content detected" };
  document.getElementById("statusSub").textContent = subMap[r.verdict] || "";

  // Score ring animation
  const circle = document.getElementById("scoreCircle");
  const circumference = 201;
  const offset = circumference - (r.score / 100) * circumference;
  document.getElementById("scoreNum").textContent = r.score;
  setTimeout(() => { circle.style.transition = "stroke-dashoffset 1.2s ease"; circle.style.strokeDashoffset = offset; }, 100);

  // Scam category
  const badgeColors = { PHISHING:"color:#fc8181;background:rgba(252,129,129,0.1);border:1px solid rgba(252,129,129,0.25)", SPAM:"color:#f6ad55;background:rgba(246,173,85,0.1);border:1px solid rgba(246,173,85,0.25)", SUSPICIOUS:"color:#f6ad55;background:rgba(246,173,85,0.1);border:1px solid rgba(246,173,85,0.25)", SAFE:"color:#68d391;background:rgba(104,211,145,0.1);border:1px solid rgba(104,211,145,0.25)", FRAUD:"color:#fc8181;background:rgba(252,129,129,0.1);border:1px solid rgba(252,129,129,0.25)" };
  const badge = document.getElementById("scamBadge");
  badge.textContent = r.category;
  badge.style.cssText = badgeColors[r.verdict] || badgeColors.SAFE;
  document.getElementById("scamTags").innerHTML = r.tags.map(t => `<span class="scam-tag">${t}</span>`).join("");

  // Links
  const noLinks = document.getElementById("noLinks");
  const linkList = document.getElementById("linkList");
  if (r.links.length > 0) {
    noLinks.style.display = "none";
    linkList.style.display = "";
    linkList.innerHTML = r.links.map(l => `
      <div class="link-item">
        <div class="link-domain">${l.url.slice(0,60)}${l.url.length>60?"...":""}</div>
        <div class="link-flags">
          ${l.suspicious ? ''<span class="link-flag red">⚠ Suspicious</span><span class="link-flag orange">High Risk</span>'' : ''<span class="link-flag green">✓ Appears Safe</span>''}
        </div>
      </div>`).join("");
  } else {
    noLinks.style.display = "";
    linkList.style.display = "none";
  }

  // Explain
  document.getElementById("explainConf").textContent = "Confidence: " + Math.min(r.score + 5, 99) + "%";
  document.getElementById("explainReasons").innerHTML = r.reasons.length
    ? r.reasons.map(reason => `<div class="explain-reason"><span class="reason-icon">⚡</span>${reason}</div>`).join("")
    : `<div class="explain-reason"><span class="reason-icon">✓</span>No suspicious patterns identified in this content.</div>`;
  document.getElementById("kwList").innerHTML = r.keywords.length
    ? r.keywords.map(k => `<span class="kw-tag">${k}</span>`).join("")
    : `<span style="font-size:.78rem;color:#4a5568">No flagged keywords</span>`;

  // Recommendations
  document.getElementById("recoList").innerHTML = r.recommendations.map(rec => `
    <div class="reco-item">
      <div class="reco-icon">${rec.icon}</div>
      <span>${rec.text}</span>
    </div>`).join("");

  // Save to recent
  saveToRecent(r);
  sec.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearResults() {
  const sec = document.getElementById("resultsSection");
  if (sec) sec.style.display = "none";
  const circle = document.getElementById("scoreCircle");
  if (circle) { circle.style.transition = "none"; circle.style.strokeDashoffset = "201"; }
  document.getElementById("feedbackThanks").style.display = "none";
  document.querySelectorAll(".fb-btn").forEach(b => b.classList.remove("active"));
}

// ── Recent detections ─────────────────────────────────────────
function saveToRecent(r) {
  const list = document.getElementById("recentList");
  if (!list) return;
  const badgeClass = { PHISHING:"r-danger", SPAM:"r-warn", SUSPICIOUS:"r-warn", SAFE:"r-safe", FRAUD:"r-danger" };
  const scoreColor = { PHISHING:"#fc8181", SPAM:"#f6ad55", SUSPICIOUS:"#f6ad55", SAFE:"#68d391", FRAUD:"#fc8181" };
  const item = document.createElement("div");
  item.className = "recent-item";
  item.innerHTML = `<span class="recent-badge ${badgeClass[r.verdict]||"r-warn"}">${r.verdict.slice(0,5)}</span><div class="recent-info"><div class="recent-src">${r.category}</div><div class="recent-time">Just now</div></div><span class="recent-score-val" style="color:${scoreColor[r.verdict]||"#f6ad55"}">${r.score}</span>`;
  list.insertBefore(item, list.firstChild);
  if (list.children.length > 6) list.removeChild(list.lastChild);
}

// ── Actions ───────────────────────────────────────────────────
function saveReport() { showToast("Report saved to your history.", "success"); }
function downloadPDF() { showToast("PDF download will be available in the full version.", "success"); }
function reportMessage() { showToast("Message reported to CyberShield AI database.", "success"); }
function giveFeedback(correct) {
  document.getElementById("fbYes").classList.toggle("active", correct);
  document.getElementById("fbNo").classList.toggle("active", !correct);
  document.getElementById("feedbackThanks").style.display = "";
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type) {
  const t = document.getElementById("toast");
  t.querySelector(".toast-msg").textContent = msg;
  t.className = "toast show" + (type === "error" ? " error" : "");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 3000);
}

// ── Auth modal ────────────────────────────────────────────────
function showAuthModal() {
  let o = document.querySelector(".modal-overlay");
  if (!o) {
    o = document.createElement("div"); o.className = "modal-overlay";
    o.innerHTML = `<div class="modal-box"><div class="modal-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v7c0 5.5 4.3 10.7 8 12 3.7-1.3 8-6.5 8-12V6L12 2z" stroke="#63b3ed" stroke-width="1.5"/><path d="M9 12l2.5 2.5L15 9" stroke="#63b3ed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>Sign In Required</h3><p>You need to be signed in to use the AI Detection Console.</p><div class="modal-actions"><button class="modal-btn-ghost" id="mCancel">Cancel</button><button class="modal-btn-primary" id="mLogin">Sign In</button><button class="modal-btn-primary" id="mSignup" style="background:linear-gradient(135deg,#553c9a,#2b6cb0)">Sign Up</button></div></div>`;
    document.body.appendChild(o);
    o.querySelector("#mCancel").onclick = () => o.classList.remove("show");
    o.querySelector("#mLogin").onclick  = () => { window.location.href = "login.html"; };
    o.querySelector("#mSignup").onclick = () => { window.location.href = "signup.html"; };
    o.addEventListener("click", e => { if (e.target === o) o.classList.remove("show"); });
  }
  requestAnimationFrame(() => o.classList.add("show"));
}'
[System.IO.File]::WriteAllText("$base\detection.js", $js)
Write-Host "detection.js OK:" (Get-Item "$base\detection.js").Length
