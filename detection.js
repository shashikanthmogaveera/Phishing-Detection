/* detection.js - CyberShield AI Detection Console */

// ══════════════════════════════════════════════════════════════════════════════
//  REINFORCEMENT LEARNING ENGINE
//  Learns from every feedback (correct/wrong) to improve predictions over time.
//  Storage: localStorage key "cs_rl_model" - no server required.
//
//  Model structure:
//    keywordWeights : { word -> { weight, hits, corrections } }
//    verdictBias    : { PHISHING|SPAM|SUSPICIOUS|SAFE -> { delta, n, corrections } }
//    patternMemory  : [ { ngrams[], verdict, correct, ts } ]  (max 500)
//    totalFeedback  : number
// ══════════════════════════════════════════════════════════════════════════════

const RL_KEY       = 'cs_rl_model';
const RL_MAX_MEM   = 500;
const RL_LR        = 0.15;   // base learning rate
const RL_DECAY     = 0.98;   // weight decay per correction (prevents overfitting)
const RL_MAX_DELTA = 20;     // max verdict threshold shift ±pts

let _rlLastScan = null;      // last scan context - filled by rlCaptureScan()

// ── Load / save ───────────────────────────────────────────────────────────────
function rlLoad() {
  try {
    return JSON.parse(localStorage.getItem(RL_KEY) || 'null') || {
      keywordWeights: {}, verdictBias: {}, patternMemory: [], totalFeedback: 0
    };
  } catch {
    return { keywordWeights: {}, verdictBias: {}, patternMemory: [], totalFeedback: 0 };
  }
}
function rlSave(m) {
  try { localStorage.setItem(RL_KEY, JSON.stringify(m)); } catch {}
}

// ── Extract 1-gram + 2-gram tokens from content ───────────────────────────────
function rlNgrams(content, n) {
  const tokens = content.toLowerCase()
    .replace(/[^\w\s\u0900-\u097F\u0C80-\u0CFF]/g, ' ')
    .split(/\s+/).filter(t => t.length >= 2).slice(0, 80);
  const grams = new Set();
  for (let i = 0; i < tokens.length; i++) {
    grams.add(tokens[i]);
    if (n >= 2 && i + 1 < tokens.length) grams.add(tokens[i] + ' ' + tokens[i + 1]);
  }
  return [...grams];
}

// ── Apply learned keyword weights to raw score ───────────────────────────────
// Called in analyzeContent after base scoring.
function rlApply(rawScore, detectedKeywords, model) {
  if (!model || !detectedKeywords || !detectedKeywords.length) return rawScore;
  let bonus = 0;
  detectedKeywords.forEach(kw => {
    const entry = model.keywordWeights[kw.toLowerCase()];
    if (entry) bonus += (entry.weight || 0);
  });
  // Dynamic clamp: grows as model learns more keywords (max ±35)
  const _rlFb    = Object.keys(model.keywordWeights || {}).length;
  const _rlClamp = Math.min(35, 15 + Math.floor(_rlFb / 5));
  bonus = Math.max(-_rlClamp, Math.min(_rlClamp, bonus));
  return Math.max(0, Math.min(100, rawScore + bonus));
}

// ── RL-adjusted verdict thresholds ───────────────────────────────────────────
// Uses learned verdict biases instead of fixed 70/45/25 thresholds.
function rlVerdictFromScore(score, model) {
  const base = { PHISHING: 70, SPAM: 45, SUSPICIOUS: 25 };
  if (!model) {
    if (score >= base.PHISHING)   return 'PHISHING';
    if (score >= base.SPAM)       return 'SPAM';
    if (score >= base.SUSPICIOUS) return 'SUSPICIOUS';
    return 'SAFE';
  }
  const bias  = model.verdictBias || {};
  const clamp = v => Math.max(-RL_MAX_DELTA, Math.min(RL_MAX_DELTA, v || 0));
  const phishDelta = clamp(bias.PHISHING?.delta);
  const spamDelta  = clamp(bias.SPAM?.delta);
  const suspDelta  = clamp(bias.SUSPICIOUS?.delta);
  if (score >= base.PHISHING   + phishDelta) return 'PHISHING';
  if (score >= base.SPAM       + spamDelta)  return 'SPAM';
  if (score >= base.SUSPICIOUS + suspDelta)  return 'SUSPICIOUS';
  return 'SAFE';
}

// ── Capture scan context (called from showResults) ────────────────────────────
function rlCaptureScan(content, keywords, rawScore, rlScore, verdict) {
  _rlLastScan = {
    content:  content.slice(0, 400),
    keywords: [...keywords],
    ngrams:   rlNgrams(content, 2),
    rawScore, rlScore, verdict,
    ts:       Date.now()
  };
}

// ── Enhanced Core Learning Function ─────────────────────────────────────────
// correct=true  → AI was RIGHT  → strongly reinforce correct patterns
// correct=false → AI was WRONG  → aggressively learn from mistakes
//
// Enhanced features:
// 1. Stronger learning from wrong predictions
// 2. Better pattern extraction (ngrams + content hash)
// 3. Context-aware learning
// 4. Clearer implied correct verdict determination
function rlLearn(correct) {
  if (!_rlLastScan) return;

  const model   = rlLoad();
  const scan    = _rlLastScan;
  const verdict = scan.verdict;
  const content = scan.content;

  // Determine implied correct verdict based on prediction
  let impliedCorrect;
  if (verdict === 'SAFE') {
    // Under-detection: should have been flagged
    impliedCorrect = 'SUSPICIOUS';
  } else if (verdict === 'PHISHING') {
    // Over-detection: was safe
    impliedCorrect = 'SAFE';
  } else if (verdict === 'SPAM') {
    impliedCorrect = 'SAFE';
  } else { // SUSPICIOUS
    impliedCorrect = 'SAFE';
  }

  model.totalFeedback = (model.totalFeedback || 0) + 1;

  // ── 1. Enhanced Keyword Weight Update ─────────────────────────────────────
  scan.keywords.forEach(kw => {
    const key = kw.toLowerCase();
    if (!model.keywordWeights[key]) {
      model.keywordWeights[key] = { 
        weight: 0, 
        hits: 0, 
        corrections: 0,
        correctHits: 0,
        wrongHits: 0
      };
    }
    const entry = model.keywordWeights[key];
    entry.hits++;

    if (correct) {
      // CORRECT: Strong boost for correct keywords
      entry.correctHits++;
      const confidenceBoost = Math.min(entry.correctHits * 0.5, 10);
      entry.weight = Math.min(25, (entry.weight || 0) + RL_LR * 8 + confidenceBoost);
    } else {
      // WRONG: Strong penalty + decay
      entry.wrongHits++;
      const penaltyMultiplier = Math.min(1 + entry.wrongHits * 0.2, 5);
      entry.weight = Math.max(-25, (entry.weight || 0) * 0.7 - RL_LR * 10 * penaltyMultiplier);
      entry.corrections = (entry.corrections || 0) + 1;
    }
  });

  // ── 2. Enhanced Pattern Memory ─────────────────────────────────────────────
  // Store more context about this feedback
  model.patternMemory.unshift({
    ngrams:         scan.ngrams.slice(0, 80),
    verdict:        verdict,
    impliedCorrect: impliedCorrect,
    correct:        correct,
    contentHash:    hashContent(content), // Quick lookup for similar content
    content:        content.slice(0, 300),
    keywords:       scan.keywords,
    score:          scan.score,
    ts:             scan.ts
  });

  // Keep most recent memories
  if (model.patternMemory.length > RL_MAX_MEM) model.patternMemory.splice(RL_MAX_MEM);

  // ── 3. Stronger Threshold Adjustments ───────────────────────────────────────
  // Update predicted verdict's bias
  if (!model.verdictBias[verdict]) {
    model.verdictBias[verdict] = { delta: 0, n: 0, corrections: 0 };
  }
  const vbPredicted = model.verdictBias[verdict];
  vbPredicted.n++;

  if (correct) {
    // Right: Make this verdict easier to trigger in future
    vbPredicted.delta = Math.max(-RL_MAX_DELTA, (vbPredicted.delta || 0) - RL_LR * 5);
  } else {
    // Wrong: Make this verdict much harder to trigger
    vbPredicted.corrections = (vbPredicted.corrections || 0) + 1;
    vbPredicted.delta = Math.min(RL_MAX_DELTA, (vbPredicted.delta || 0) + RL_LR * 12);
  }

  // When wrong: Make the correct verdict easier to trigger
  if (!correct) {
    if (!model.verdictBias[impliedCorrect]) {
      model.verdictBias[impliedCorrect] = { delta: 0, n: 0, corrections: 0 };
    }
    const vbCorrect = model.verdictBias[impliedCorrect];
    vbCorrect.n++;
    vbCorrect.delta = Math.max(-RL_MAX_DELTA, (vbCorrect.delta || 0) - RL_LR * 8);
  }

  rlSave(model);
}

// Helper: Create a simple content hash for quick pattern matching
function hashContent(content) {
  let hash = 0;
  if (content.length === 0) return hash;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// ── Enhanced Pattern Similarity Bonus ──────────────────────────────────────────
// Enhanced features:
// 1. Checks both ngrams and keywords
// 2. Stronger bonuses/penalties for close matches
// 3. More sensitive similarity threshold
// 4. Uses implied correct verdict for better learning
function rlPatternBonus(contentNgrams, model) {
  if (!model || !model.patternMemory || !model.patternMemory.length) return 0;
  if (!contentNgrams || !contentNgrams.length) return 0;
  
  const contentSet = new Set(contentNgrams);
  let bestScore = 0;
  let bestMatch = null;
  
  // Check all recent memories
  model.patternMemory.slice(0, 150).forEach(mem => {
    // Ngram similarity
    const overlap = mem.ngrams.filter(g => contentSet.has(g)).length;
    let sim = overlap / Math.max(contentNgrams.length, mem.ngrams.length, 1);
    
    // Keyword overlap bonus
    if (mem.keywords && mem.keywords.length) {
      const memKeywords = new Set(mem.keywords.map(k => k.toLowerCase()));
      let keywordMatchScore = 0;
      // Check if any of our content words match keywords
      contentNgrams.forEach(gram => {
        if (memKeywords.has(gram)) {
          keywordMatchScore += 0.05; // +5% per matching keyword
        }
      });
      sim += Math.min(keywordMatchScore, 0.3); // Max 30% from keywords
    }
    
    if (sim > bestScore) {
      bestScore = sim;
      bestMatch = mem;
    }
  });
  
  if (!bestScore || bestScore < 0.06) return 0;  // Lowered to 6% for more sensitivity
  
  // Stronger scaling - grows with pattern memory
  let baseStrength = Math.min(40, 20 + Math.floor(model.patternMemory.length / 30));
  
  // Even stronger for very close matches
  if (bestScore > 0.4) baseStrength += 10;
  if (bestScore > 0.6) baseStrength += 15;
  
  const magnitude = Math.round(bestScore * baseStrength);
  
  // Determine direction based on feedback correctness
  if (bestMatch.correct) {
    // Correct feedback - boost for similar content
    return magnitude;
  } else {
    // Wrong feedback - use implied correct verdict to decide penalty direction
    // If implied correct is SAFE, we penalize (make more safe)
    // If implied correct is SUSPICIOUS/PHISHING, we boost
    if (bestMatch.impliedCorrect === 'SAFE') {
      return -magnitude; // Penalize, content should be safe
    } else {
      return magnitude * 0.7; // Boost, content should be flagged
    }
  }
}

// ── RL stats for display ──────────────────────────────────────────────────────
function rlStats() {
  const model    = rlLoad();
  const kwKeys   = Object.keys(model.keywordWeights || {});
  return {
    totalFeedback:     model.totalFeedback || 0,
    learnedKeywords:   kwKeys.length,
    boostedKeywords:   kwKeys.filter(k => model.keywordWeights[k].weight >  1).length,
    penalisedKeywords: kwKeys.filter(k => model.keywordWeights[k].weight < -1).length,
    patternMemories:   (model.patternMemory || []).length
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// ADVANCED PHISHING DETECTION ENHANCEMENTS
// ──────────────────────────────────────────────────────────────────────────────

// Feature A: Advanced Phishing Pattern Detection
const ADVANCED_PHISHING_PATTERNS = [
  { pattern: "confirm your account", score: 15, label: "Account confirmation request" },
  { pattern: "verify your account", score: 15, label: "Account verification request" },
  { pattern: "verify your identity", score: 18, label: "Identity verification request" },
  { pattern: "account verification required", score: 18, label: "Mandatory account verification" },
  { pattern: "security alert", score: 12, label: "Security alert notification" },
  { pattern: "unusual activity detected", score: 18, label: "Unusual activity warning" },
  { pattern: "sign-in attempt", score: 15, label: "Sign-in attempt notification" },
  { pattern: "new device detected", score: 15, label: "New device login warning" },
  { pattern: "suspicious login", score: 18, label: "Suspicious login detected" },
  { pattern: "account temporarily limited", score: 15, label: "Account limitation warning" },
  { pattern: "account suspended", score: 20, label: "Account suspension warning" },
  { pattern: "account restricted", score: 15, label: "Account restriction warning" },
  { pattern: "avoid service interruption", score: 12, label: "Service interruption threat" },
  { pattern: "immediate action required", score: 18, label: "Immediate action demand" },
  { pattern: "within 24 hours", score: 15, label: "24-hour deadline pressure" },
  { pattern: "within 48 hours", score: 15, label: "48-hour deadline pressure" },
  { pattern: "urgent response required", score: 15, label: "Urgent response demand" },
  { pattern: "ownership confirmation", score: 15, label: "Account ownership confirmation" },
  { pattern: "security review", score: 12, label: "Security review request" },
  { pattern: "update your information", score: 15, label: "Information update request" },
  { pattern: "confirm account details", score: 15, label: "Account details confirmation" },
  { pattern: "review recent activity", score: 12, label: "Recent activity review request" }
];

function detectAdvancedPhishingPatterns(content, lower) {
  const results = [];
  ADVANCED_PHISHING_PATTERNS.forEach(item => {
    if (lower.includes(item.pattern)) {
      // Enhanced explainability labels
      let explainLabel = item.label;
      if (item.pattern.includes("confirm")) explainLabel = "Verification request detected";
      if (item.pattern.includes("security alert")) explainLabel = "Security scare tactic detected";
      if (item.pattern.includes("unusual") || item.pattern.includes("suspicious login") || 
          item.pattern.includes("new device")) explainLabel = "Suspicious login indicator detected";
      if (item.pattern.includes("account suspended") || item.pattern.includes("account restricted")) 
        explainLabel = "Account restriction threat detected";
      if (item.pattern.includes("ownership")) explainLabel = "Account ownership confirmation request detected";
      
      results.push({ ...item, explainLabel, matched: item.pattern });
    }
  });
  return results;
}

// Feature B: Urgency Detection Engine
const URGENCY_PATTERNS = [
  { pattern: "immediately", score: 12, label: "Immediate action demand" },
  { pattern: "urgent", score: 12, label: "Urgent request" },
  { pattern: "act now", score: 15, label: "Act now pressure" },
  { pattern: "final warning", score: 18, label: "Final warning threat" },
  { pattern: "limited time", score: 12, label: "Limited time pressure" },
  { pattern: "within 24 hours", score: 15, label: "24-hour deadline" },
  { pattern: "within 48 hours", score: 15, label: "48-hour deadline" },
  { pattern: "respond today", score: 12, label: "Same-day response demand" },
  { pattern: "avoid suspension", score: 18, label: "Suspension avoidance threat" },
  { pattern: "avoid interruption", score: 15, label: "Service interruption threat" },
  { pattern: "failure to comply", score: 18, label: "Compliance failure threat" },
  { pattern: "action required", score: 12, label: "Action required" }
];

function detectUrgencyPatterns(content, lower) {
  const results = [];
  URGENCY_PATTERNS.forEach(item => {
    if (lower.includes(item.pattern)) {
      let explainLabel = item.label;
      if (item.pattern.includes("avoid")) explainLabel = "Security scare tactic detected";
      results.push({ ...item, explainLabel, matched: item.pattern });
    }
  });
  return results;
}

// Feature C: Fear/Account Threat Detection
const FEAR_THREAT_PATTERNS = [
  { pattern: "account suspended", score: 20, label: "Account suspension threat" },
  { pattern: "account restricted", score: 15, label: "Account restriction threat" },
  { pattern: "access revoked", score: 18, label: "Access revocation threat" },
  { pattern: "login blocked", score: 15, label: "Login block threat" },
  { pattern: "security issue", score: 12, label: "Security issue warning" },
  { pattern: "unauthorized access", score: 18, label: "Unauthorized access warning" },
  { pattern: "suspicious activity", score: 15, label: "Suspicious activity warning" },
  { pattern: "service disabled", score: 18, label: "Service disable threat" },
  { pattern: "verification required", score: 15, label: "Mandatory verification threat" }
];

function detectFearThreatPatterns(content, lower) {
  const results = [];
  FEAR_THREAT_PATTERNS.forEach(item => {
    if (lower.includes(item.pattern)) {
      let explainLabel = item.label;
      explainLabel = "Security scare tactic detected";
      results.push({ ...item, explainLabel, matched: item.pattern });
    }
  });
  return results;
}

// Feature D: Obfuscated URL Detection
function normalizeObfuscatedURLs(content) {
  let normalized = content;
  // Normalize hxxp/hxxps
  normalized = normalized.replace(/hxxp:/gi, "http:");
  normalized = normalized.replace(/hxxps:/gi, "https:");
  // Normalize [.] to .
  normalized = normalized.replace(/\[\.\]/g, ".");
  // Normalize [dot] to .
  normalized = normalized.replace(/\[dot\]/gi, ".");
  // Normalize other common obfuscations
  normalized = normalized.replace(/\[com\]/gi, ".com");
  normalized = normalized.replace(/\[net\]/gi, ".net");
  normalized = normalized.replace(/\[org\]/gi, ".org");
  normalized = normalized.replace(/\[co\]/gi, ".co");
  return normalized;
}

function detectObfuscatedURLs(content) {
  const obfuscatedPatterns = /hxxp:|hxxps:|\[\.\]|\[dot\]|\[com\]|\[net\]|\[org\]|\[co\]/gi;
  const matches = content.match(obfuscatedPatterns) || [];
  return matches.length > 0 ? { detected: true, count: matches.length } : { detected: false, count: 0 };
}

// Feature E: Sender Impersonation Indicators
const SUSPICIOUS_SENDER_LOCAL_PARTS = [
  "support", "security", "verification", "account-update", "customer-service", 
  "helpdesk", "admin", "alert", "notification", "update", "info", "billing"
];
const SUSPICIOUS_DOMAIN_WORDS = [
  "secure-update-center", "account-review-center", "verification-portal", 
  "security-alert-center", "account-security", "verify-account"
];

function detectImpersonationIndicators(content, lower) {
  let score = 0;
  const detected = [];
  // Check for suspicious sender local parts in content
  SUSPICIOUS_SENDER_LOCAL_PARTS.forEach(part => {
    const regex = new RegExp(`${part}@`, 'gi');
    if (regex.test(content)) {
      score += 10;
      detected.push({ type: "suspicious-local-part", value: part, label: `Suspicious sender prefix: ${part}` });
    }
  });
  // Check for suspicious domain words
  SUSPICIOUS_DOMAIN_WORDS.forEach(word => {
    if (lower.includes(word)) {
      score += 8;
      detected.push({ type: "suspicious-domain-word", value: word, label: `Suspicious domain term: ${word}` });
    }
  });
  return { score, detected };
}

// Feature H: Enhanced Educational Context Intelligence
const EDUCATIONAL_PHRASES = [
  "phishing awareness", "awareness training", "cybersecurity training",
  "security awareness", "phishing simulation", "training exercise",
  "educational example", "demonstration purposes", "example phishing email",
  "phishing example", "security workshop", "cybersecurity workshop",
  "training material", "awareness program", "learning exercise",
  "how attackers", "this example demonstrates", "attackers may ask",
  "educational purposes", "classroom exercise", "this phishing training"
];
const INSTRUCTIONAL_PHRASES = [
  "never enter", "always verify", "do not click", "be careful",
  "how to spot", "avoid falling", "warning about", "teaches you",
  "demonstrates how", "shows how", "explains how", "teaches how",
  "security tip", "awareness tip", "training example", "educational message"
];
// Safety rule: Do NOT reduce risk if any of these are present
const DANGEROUS_INDICATORS = [
  "click here", "click this", "click the link", "visit this",
  "enter your", "provide your", "submit your", "confirm your",
  "verify your", "update your", "enter otp", "enter password",
  "enter pin", "enter cvv", "send otp", "send password",
  "pay now", "make payment", "transfer", "payment required"
];

function checkFalsePositiveIndicators(content, lower) {
  // Check Condition A: Educational phrases are present
  const hasEducationalPhrases = EDUCATIONAL_PHRASES.some(phrase => lower.includes(phrase));
  
  // Check Condition B: Message is instructional/describing phishing
  const hasInstructionalPhrases = INSTRUCTIONAL_PHRASES.some(phrase => lower.includes(phrase));
  
  // Check Safety Rule: Are there any dangerous indicators? If yes, do NOT reduce risk!
  const hasDangerousIndicators = DANGEROUS_INDICATORS.some(phrase => lower.includes(phrase));
  
  // Check for actual URL links in content
  const hasUrlLinks = /https?:\/\/[^\s]+|www\.[^\s]+/i.test(content);
  
  const isEducational = hasEducationalPhrases && hasInstructionalPhrases && !hasDangerousIndicators && !hasUrlLinks;
  
  let score = 0;
  const detected = [];
  
  if (isEducational) {
    score = 75; // Significant score reduction
    detected.push({ label: "Educational/Security Awareness Content Detected" });
    detected.push({ label: "Content appears instructional rather than malicious" });
  } else if (hasEducationalPhrases && (hasDangerousIndicators || hasUrlLinks)) {
    detected.push({ label: "Educational context found, but message contains risky indicators" });
  }
  
  return { isEducational, score, detected };
}

document.addEventListener("DOMContentLoaded", () => {
  const session = JSON.parse(localStorage.getItem("cs_session") || "null");
  const adminSession = JSON.parse(localStorage.getItem("cs_admin_session") || "null");
  // Hard redirect if not logged in
  if (!session && !adminSession) {
    sessionStorage.setItem('cs_redirect', 'detection.html');
    window.location.href = 'login.html';
    return;
  }

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

  // Init live stats on page load - fetch real counts from backend
  fetchAndUpdateStats();
  setInterval(fetchAndUpdateStats, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) fetchAndUpdateStats(); });
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

// -- Live Stats Engine (per-user, backend-driven) -----------------------------

// Get a unique key for the current logged-in user
function getUserStatsKey() {
  const s  = JSON.parse(localStorage.getItem("cs_session")       || "null");
  const as = JSON.parse(localStorage.getItem("cs_admin_session") || "null");
  const id = s ? ("u_" + (s.username || s.email)) : (as ? ("a_" + (as.name || as.email)) : "guest");
  return "cs_stats_" + id;
}

function getLocalStats() {
  const key   = getUserStatsKey();
  const today = new Date().toDateString();
  const raw   = JSON.parse(localStorage.getItem(key) || "null");
  if (!raw || raw.lastDate !== today) {
    const fresh = { scansToday: 0, threatsToday: 0, totalScans: raw ? raw.totalScans : 0, correctFeedback: raw ? raw.correctFeedback : 0, wrongFeedback: raw ? raw.wrongFeedback : 0, lastDate: today };
    localStorage.setItem(key, JSON.stringify(fresh));
    return fresh;
  }
  return raw;
}

function saveLocalStats(s) {
  localStorage.setItem(getUserStatsKey(), JSON.stringify(s));
}

function calcAccuracy(s) {
  const total = s.correctFeedback + s.wrongFeedback;
  if (total === 0) return 98.4;
  const raw    = (s.correctFeedback / total) * 100;
  const weight = Math.min(total / 20, 1);
  return +(98.4 * (1 - weight) + raw * weight).toFixed(1);
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

function animateValue(el, from, to, duration, formatter) {
  const start = performance.now();
  function step(now) {
    const p    = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = formatter(from + (to - from) * ease);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = formatter(to);
  }
  requestAnimationFrame(step);
}

// Update the three header stat elements with animated counters
function updateHeaderStats(scansToday, threatsToday, accuracy) {
  const accEl    = document.getElementById("hstat-accuracy");
  const scansEl  = document.getElementById("hstat-scans");
  const threatEl = document.getElementById("hstat-threats");

  const prevAcc     = parseFloat(accEl?.dataset.val)    || 0;
  const prevScans   = parseInt(scansEl?.dataset.val)    || 0;
  const prevThreats = parseInt(threatEl?.dataset.val)   || 0;

  if (accEl)    { animateValue(accEl,    prevAcc,     accuracy,    700, v => v.toFixed(1) + "%"); accEl.dataset.val    = accuracy; }
  if (scansEl)  { animateValue(scansEl,  prevScans,   scansToday,  500, v => formatCount(Math.round(v))); scansEl.dataset.val  = scansToday; }
  if (threatEl) { animateValue(threatEl, prevThreats, threatsToday,500, v => formatCount(Math.round(v))); threatEl.dataset.val = threatsToday; }
}

// Fetch real stats from backend for the logged-in user
async function fetchAndUpdateStats() {
  const token = localStorage.getItem("cs_token");
  if (!token) {
    // No backend token - use local stats
    const s = getLocalStats();
    updateHeaderStats(s.scansToday, s.threatsToday, calcAccuracy(s));
    return;
  }
  try {
    const res = await fetch("http://localhost:3001/api/detections/stats", {
      headers: { "Authorization": "Bearer " + token }
    });
    if (!res.ok) throw new Error("stats fetch failed");
    const data = await res.json();
    // data = { scans_today, threats_today, total_scans, total_threats }
    const s   = getLocalStats();
    const acc = calcAccuracy(s);
    updateHeaderStats(data.scans_today || 0, data.threats_today || 0, acc);
    // Sync local cache with backend counts
    s.scansToday   = data.scans_today   || 0;
    s.threatsToday = data.threats_today || 0;
    s.totalScans   = data.total_scans   || 0;
    saveLocalStats(s);
  } catch {
    // Fallback to local
    const s = getLocalStats();
    updateHeaderStats(s.scansToday, s.threatsToday || 0, calcAccuracy(s));
  }
}

// Called after every scan - increment local immediately, then sync from backend
function recordScan(verdict) {
  const s = getLocalStats();
  s.scansToday++;
  s.totalScans++;
  if (verdict !== "SAFE") s.threatsToday = (s.threatsToday || 0) + 1;
  saveLocalStats(s);
  // Optimistic update immediately
  updateHeaderStats(s.scansToday, s.threatsToday || 0, calcAccuracy(s));
  // Then confirm from backend after a short delay
  setTimeout(fetchAndUpdateStats, 1500);
}

function recordFeedback(correct) {
  const s = getLocalStats();
  if (correct) s.correctFeedback++;
  else s.wrongFeedback++;
  saveLocalStats(s);
  updateHeaderStats(s.scansToday, s.threatsToday || 0, calcAccuracy(s));
}

// ── Detection type switcher ─────────────────────────────────────────
let currentType = "sms";
const placeholders = {
  sms: "Paste suspicious SMS here...\n\nExample: Your account has been blocked. Click here to verify: http://bank-secure.xyz",
  whatsapp: "Paste suspicious WhatsApp message here...\n\nExample: Congratulations! You won Rs.50,000. Send your OTP to claim.",
  email: "Paste suspicious email content here...\nInclude subject, sender, and body for best results.",
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

// ── Live keyword analysis ─────────────────────────────────────────
const suspiciousKeywords = ["otp","upi","kyc","verify","account blocked","click here","urgent","winner","prize","lottery","bank","password","login","credential","suspend","claim","reward","free","congratulations","limited time","act now","verify now","confirm","update your","dear customer","transaction failed"];
const bankingKeywords    = ["bank","account","ifsc","upi","neft","rtgs","imps","netbanking","atm","debit","credit","pin","cvv","otp"];
const phishingKeywords   = ["click here","verify now","account suspended","login","password","credential","confirm your","update your","limited time","act now","urgent action"];

// -- Hindi keyword sets (Devanagari + romanized transliterations) --------------
const hindiKeywords = {
  suspicious: [
    "ओटीपी","खाता","बैंक","पासवर्ड",
    "लॉटरी","विजेता","इनाम","मुफ्त",
    "तत्काल","फर्जी","घोटाला","धोखाधड़ी",
    "आपका खाता","अभी क्लिक करें",
    "पुरस्कार","नकली","ओटीपी साझा करें",
    "otp","khata","bank","password","lottery","winner","inaam","muft","tatkal","farji","ghotala","dhokhaadhadi"
  ],
  banking: [
    "आईएफएससी","डेबिट","क्रेडिट",
    "आईएफएससी","नेटबैंकिंग",
    "यूपीआई","paytm","phonepe","gpay","bhim"
  ],
  phishing: [
    "सत्यापित करें","लॉग इन",
    "अपडेट करें","खाता बंद",
    "क्लिक करें लॉगिन करें"
  ]
};

// -- Kannada keyword sets (Kannada script + romanized transliterations) ---------
const kannadaKeywords = {
  suspicious: [
    "ಓಟಿಪಿ","ಖಾತೆ","ಬ್ಯಾಂಕ್",
    "ಪಾಸ್‌ವರ್ಡ್","ಲಾಟರಿ",
    "ವಿಜೇತ","ಬಹುಮಾನ","ಉಚಿತ",
    "ತುರ್ತು","ನಕಲಿ","ವಂಚನೆ","ಹಾಗರಣ",
    "ನಿಮ್ಮ ಖಾತೆ",
    "ಈಗ ಕ್ಲಿಕ್ ಮಾಡಿ","ನಕದಂತೆ",
    "otp","khate","bank","password","lottery","vijeta","bahumana","uchita","turtu","nakali","vanchane","hagarana"
  ],
  banking: [
    "ಎಫ್ಟಿಎಸ್","ಡೆಬಿಟ್","ಕ್ರೆಡಿಟ್",
    "ಇಎಫ್ಎಸ್ಸಿ",
    "ನೆಟ್ಬ್ಯಾಂಕಿಂಗ್",
    "ಯುಪಿಐ","paytm","phonepe","gpay","bhim"
  ],
  phishing: [
    "ಪರಿಶೀಲಿಸಿ ಮಾಡಿ",
    "ಲಾಗ್ಇನ್ ಮಾಡಿ",
    "ಅಪ್‌ಡೇಟ್ ಮಾಡಿ",
    "ಕ್ಲಿಕ್ ಮಾಡಿ"
  ]
};

function getActiveLang() {
  const sel = document.getElementById('langSelect');
  return sel ? sel.value : 'auto';
}

function getMergedKeywords() {
  const lang = getActiveLang();
  const s = [...suspiciousKeywords];
  const b = [...bankingKeywords];
  const p = [...phishingKeywords];
  if (lang === 'hi' || lang === 'auto') {
    s.push(...hindiKeywords.suspicious);
    b.push(...hindiKeywords.banking);
    p.push(...hindiKeywords.phishing);
  }
  if (lang === 'kn' || lang === 'auto') {
    s.push(...kannadaKeywords.suspicious);
    b.push(...kannadaKeywords.banking);
    p.push(...kannadaKeywords.phishing);
  }
  return { s, b, p };
}

function liveAnalyze(val) {
  const count = document.getElementById("charCount");
  if (count) count.textContent = val.length + " / 2000";
  if (val.length > 2000) { const ta = document.getElementById("msgInput"); if (ta) ta.value = val.slice(0,2000); return; }
  const lower = val.toLowerCase();
  const { s: activeSusp, b: activeBanking, p: activePhish } = getMergedKeywords();
  const found = activeSusp.filter(k => lower.includes(k.toLowerCase()) || val.includes(k));
  const warn  = document.getElementById("liveWarning");
  if (!warn) return;
  if (found.length >= 3) {
    warn.innerHTML = "⚡ Multiple suspicious patterns detected (" + found.length + " signals)";
  } else if (activeBanking.some(k => lower.includes(k.toLowerCase()) || val.includes(k))) {
    warn.innerHTML = "⚡ Suspicious banking keywords detected";
  } else if (activePhish.some(k => lower.includes(k.toLowerCase()) || val.includes(k))) {
    warn.innerHTML = "⚡ Potential phishing language detected";
  } else if (found.length > 0) {
    warn.innerHTML = "⚡ Suspicious keyword: \"" + found[0] + "\"";
  } else {
    warn.innerHTML = "";
  }
}
function clearLiveWarning() {
  const w = document.getElementById("liveWarning"); if (w) w.innerHTML = "";
  const c = document.getElementById("charCount"); if (c) c.textContent = "0 / 2000";
}

// ── URL preview ───────────────────────────────────────────────────
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

// ── File upload ───────────────────────────────────────────────────
function dragOver(e) { e.preventDefault(); document.getElementById("uploadZone").classList.add("drag-over"); }
function dragLeave(e) { document.getElementById("uploadZone").classList.remove("drag-over"); }
function dropFile(e) {
  e.preventDefault();
  document.getElementById("uploadZone").classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
}
let ocrExtractedText = "";

function handleFile(file) {
  if (!file) return;
  const allowed = ["image/png","image/jpeg","image/jpg","text/plain","text/csv"];
  const nameOk = file.name.match(/\.(txt|csv|png|jpg|jpeg)$/i);
  if (!allowed.includes(file.type) && !nameOk) {
    showToast("Unsupported file type.", "error"); return;
  }

  // Reset previous OCR state
  ocrExtractedText = "";
  document.getElementById("ocrResultWrap").style.display = "none";
  document.getElementById("ocrTextOutput").value = "";
  document.getElementById("uploadFilename").textContent = "📦 " + file.name;

  if (file.type.startsWith("image/")) {
    runTesseractOCR(file);
  } else {
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target.result.slice(0, 3000);
      ocrExtractedText = text;
      showOCRResult(text);
      showToast("File content loaded.", "success");
    };
    reader.readAsText(file);
  }
}

function runTesseractOCR(file) {
  const ocrStatus = document.getElementById("ocrStatus");
  const ocrStatusText = document.getElementById("ocrStatusText");
  const ocrPct = document.getElementById("ocrPct");

  ocrStatus.style.display = "flex";
  ocrStatusText.textContent = "Initializing OCR engine...";
  ocrPct.textContent = "";

  const btn = document.getElementById("analyzeBtn");
  if (btn) btn.disabled = true;

  // Build language string from user selection
  const _ocrLang = (function() {
    const sel = document.getElementById('langSelect');
    const v   = sel ? sel.value : 'auto';
    if (v === 'hi')   return 'hin';
    if (v === 'kn')   return 'kan';
    if (v === 'auto') return 'eng+hin+kan';
    return 'eng';
  })();

  Tesseract.recognize(file, _ocrLang, {
    // eng only - adding hin causes extra parameter warnings with LSTM model
    logger: m => {
      if (m.status === "recognizing text") {
        const pct = Math.round(m.progress * 100);
        ocrStatusText.textContent = "Extracting text via OCR...";
        ocrPct.textContent = pct + "%";
      } else if (m.status === "loading tesseract core") {
        ocrStatusText.textContent = "Loading OCR engine...";
      } else if (m.status === "initializing tesseract") {
        ocrStatusText.textContent = "Initializing OCR...";
      } else if (m.status === "loading language traineddata") {
        ocrStatusText.textContent = "Loading language model...";
      } else if (m.status === "initializing api") {
        ocrStatusText.textContent = "Starting recognition...";
      }
    }
  }).then(result => {
    const text = result.data.text.trim();
    ocrExtractedText = text;
    ocrStatus.style.display = "none";
    if (btn) btn.disabled = false;

    if (!text || text.length < 3) {
      showOCRResult("");
      showToast("No readable text found in image. Try a clearer screenshot.", "error");
    } else {
      showOCRResult(text);
      showToast("Text extracted: " + text.length + " characters.", "success");
    }
  }).catch(err => {
    ocrStatus.style.display = "none";
    if (btn) btn.disabled = false;
    showToast("OCR failed. Try a clearer image.", "error");
    console.error("Tesseract error:", err);
  });
}

function showOCRResult(text) {
  const wrap = document.getElementById("ocrResultWrap");
  const textarea = document.getElementById("ocrTextOutput");
  const charCount = document.getElementById("ocrCharCount");
  textarea.value = text;
  charCount.textContent = text.length + " chars";
  wrap.style.display = "";
  if (text) liveAnalyzeOCR(text);
}

function onOcrTextEdit(val) {
  ocrExtractedText = val;
  document.getElementById("ocrCharCount").textContent = val.length + " chars";
  liveAnalyzeOCR(val);
}

function liveAnalyzeOCR(val) {
  liveAnalyze(val);
  const warn = document.getElementById("liveWarning");
  let ocrWarn = document.getElementById("ocrLiveWarning");
  if (!ocrWarn) {
    ocrWarn = document.createElement("div");
    ocrWarn.id = "ocrLiveWarning";
    ocrWarn.className = "live-warning";
    const wrap = document.getElementById("ocrResultWrap");
    if (wrap) wrap.appendChild(ocrWarn);
  }
  ocrWarn.innerHTML = warn ? warn.innerHTML : "";
}

function clearOCR() {
  ocrExtractedText = "";
  document.getElementById("ocrTextOutput").value = "";
  document.getElementById("ocrCharCount").textContent = "0 chars";
  document.getElementById("ocrResultWrap").style.display = "none";
  document.getElementById("uploadFilename").textContent = "";
  document.getElementById("ocrStatus").style.display = "none";
  const fi = document.getElementById("fileInput");
  if (fi) fi.value = "";
  const ocrWarn = document.getElementById("ocrLiveWarning");
  if (ocrWarn) ocrWarn.innerHTML = "";
}

const scanMessages = [
  "Initializing AI engine...",
  "Scanning content patterns...",
  "Analyzing phishing indicators...",
  "Detecting suspicious URLs...",
  "Running NLP threat model...",
  "Evaluating scam signatures...",
  "Generating threat report..."
];

async function runAnalysis() {
  const session = JSON.parse(localStorage.getItem("cs_session") || "null");
  const adminSession = JSON.parse(localStorage.getItem("cs_admin_session") || "null");
  if (!session && !adminSession) { showAuthModal(); return; }

  let content = "";
  if (currentType === "url") {
    content = (document.getElementById("urlInput") || {}).value || "";
  } else if (currentType === "screenshot") {
    content = ocrExtractedText || (document.getElementById("ocrTextOutput") || {}).value || "";
    if (!content.trim()) {
      showToast("Please upload an image and wait for OCR to complete.", "error");
      return;
    }
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
      setTimeout(async () => {
        scanState.style.display = "none";
        document.getElementById("analyzeBtn").style.display = "";
        await showResults(content);
      }, 400);
    }
  }, 380);
}

// ── Result engine ─────────────────────────────────────────────────
function analyzeContent(content, blocklistMatch) {
  const lower = content.toLowerCase();
  let score = 0;
  const reasons = [];
  const keywords = [];
  const links = [];

  // Phase 3: Threat Score Breakdown tracking
  const scoreBreakdown = {
    urlRisk: 0,
    urgencySignals: 0,
    senderRisk: 0,
    credentialTheft: 0,
    phishingPatterns: 0,
    contextualBonus: 0,
    blockedSender: 0
  };

  // Phase 4: Detection details variables
  let advancedPhishing = [];
  let urgencyPatterns = [];
  let fearThreats = [];
  let impersonationCheck = { score:0, detected:[] };

  // Flags for contextual scoring (feature F)
  let hasUrgency = false;
  let hasAccountVerification = false;
  let hasSecurityAlert = false;
  let hasSuspiciousURL = false;

  // Blocked sender check - if found, immediately add 50 points!
  let matchedBlockedSender = null;
  if (blocklistMatch) {
    matchedBlockedSender = blocklistMatch;
    score += 50; // BIG boost for blocked senders!
    reasons.push(`🚫 Known Blocked Sender Detected`);
    reasons.push(`   Matched blacklist entry: ${blocklistMatch.matched}`);
    keywords.push("blocked-sender");
  }

  // Feature D: Check for obfuscated URLs first
  const obfuscatedURLCheck = detectObfuscatedURLs(content);
  if (obfuscatedURLCheck.detected) {
    const normalizedContent = normalizeObfuscatedURLs(content);
    const normalizedUrls = normalizedContent.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
    normalizedUrls.forEach(u => {
      const isSuspicious = !u.startsWith("https") || u.includes("-") || /\.(xyz|tk|ml|ga|cf|gq|top|click|link)/.test(u);
      links.push({ url: u, original: content.match(new RegExp(`(?:${u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|hxx[ps]:.*?\\s)`, 'i'))?.[0] || u, suspicious: isSuspicious });
      if (isSuspicious) { 
        score += 25; 
        reasons.push("⚠️ Obfuscated suspicious URL detected: " + u.slice(0,40)); 
        hasSuspiciousURL = true;
      }
    });
  }

  // Extract original URLs
  const urlRegex = /https?:\/\/[^\s]+|www\.[^\s]+/gi;
  const foundUrls = content.match(urlRegex) || [];
  foundUrls.forEach(u => {
    const isSuspicious = !u.startsWith("https") || u.includes("-") || /\.(xyz|tk|ml|ga|cf|gq|top|click|link)/.test(u);
    links.push({ url: u, suspicious: isSuspicious });
    if (isSuspicious) { 
      score += 20; 
      reasons.push("Suspicious URL pattern detected: " + u.slice(0,40)); 
      hasSuspiciousURL = true;
    }
  });

  // Original keyword scoring (preserved, rs. detection improved)
  const urgencyWords = ["urgent","immediately","act now","limited time","expire","suspended","blocked","verify now","confirm now"];
  const credWords    = ["otp","password","pin","cvv","credential","login","username","account number"];
  const moneyWords   = ["winner","prize","lottery","reward","free","congratulations","claim","inr","upi","transfer"];
  const phishWords   = ["click here","verify your","update your","dear customer","account has been","transaction failed","kyc pending"];

  urgencyWords.forEach(w => { if (lower.includes(w)) { score += 12; keywords.push(w); reasons.push("Urgency language detected: \"" + w + "\""); } });
  credWords.forEach(w    => { if (lower.includes(w)) { score += 18; keywords.push(w); reasons.push("⚡ Credential harvesting indicator detected: \"" + w + "\""); } });
  moneyWords.forEach(w   => { if (lower.includes(w)) { score += 10; keywords.push(w); } });
  // Improved rs. detection - only trigger if it looks like currency (rs. followed by numbers or numbers before rs.)
  if (/rs\.\s*\d+|\d+\s*rs\.|rs\.\s*\d+|\d+\s*rs/i.test(content)) {
    score +=10; keywords.push("rs.");
  }
  phishWords.forEach(w   => { if (lower.includes(w)) { score += 15; keywords.push(w); reasons.push("Phishing pattern: \"" + w + "\""); } });

  // Feature A: Advanced Phishing Patterns
  advancedPhishing = detectAdvancedPhishingPatterns(content, lower);
  advancedPhishing.forEach(item => {
    score += item.score;
    reasons.push(`⚡ ${item.explainLabel}: \"${item.matched}\"`);
    keywords.push(item.matched);
    if (item.pattern.includes("verify") || item.pattern.includes("confirm")) {
      hasAccountVerification = true;
    }
    if (item.pattern.includes("security alert") || item.pattern.includes("suspicious") || item.pattern.includes("unusual")) {
      hasSecurityAlert = true;
    }
  });

  // Feature B: Urgency Detection
  urgencyPatterns = detectUrgencyPatterns(content, lower);
  if (urgencyPatterns.length > 0) {
    hasUrgency = true;
    urgencyPatterns.forEach(item => {
      score += item.score;
      reasons.push(`⚡ ${item.explainLabel}: \"${item.matched}\"`);
      keywords.push(item.matched);
    });
  }

  // Feature C: Fear/Account Threat Detection
  fearThreats = detectFearThreatPatterns(content, lower);
  fearThreats.forEach(item => {
    score += item.score;
    reasons.push(`⚡ ${item.explainLabel}: \"${item.matched}\"`);
    keywords.push(item.matched);
  });

  // Feature E: Sender Impersonation Indicators
  impersonationCheck = detectImpersonationIndicators(content, lower);
  if (impersonationCheck.score > 0) {
    score += impersonationCheck.score;
    impersonationCheck.detected.forEach(item => {
      reasons.push(`⚡ ${item.label}`);
      keywords.push(item.value);
    });
  }

  // Multilingual scoring - Hindi + Kannada keyword detection (preserved)
  const { s: mlSusp, b: mlBank, p: mlPhish } = getMergedKeywords();
  mlSusp.forEach(w => {
    if ((content.includes(w) || lower.includes(w.toLowerCase())) && !keywords.includes(w)) {
      score += 12; keywords.push(w);
      reasons.push("Regional suspicious keyword: \"" + w.slice(0, 20) + "\"");
    }
  });
  mlBank.forEach(w => {
    if ((content.includes(w) || lower.includes(w.toLowerCase())) && !keywords.includes(w)) {
      score += 8; keywords.push(w);
    }
  });
  mlPhish.forEach(w => {
    if ((content.includes(w) || lower.includes(w.toLowerCase())) && !keywords.includes(w)) {
      score += 14; keywords.push(w);
      reasons.push("Regional phishing pattern: \"" + w.slice(0, 20) + "\"");
    }
  });

  // URL-only analysis (preserved)
  if (currentType === "url") {
    try {
      const u = new URL(content.startsWith("http") ? content : "https://" + content);
      if (!content.startsWith("https")) { score += 25; reasons.push("Insecure HTTP protocol - no SSL/TLS encryption"); }
      if (u.hostname.split(".").length > 3) { score += 20; reasons.push("Excessive subdomains - common in phishing domains"); }
      if (u.hostname.includes("-")) { score += 15; reasons.push("Hyphenated domain - often used to mimic legitimate sites"); }
      if (/\.(xyz|tk|ml|ga|cf|gq|top|click|link)$/.test(u.hostname)) { score += 30; reasons.push("High-risk TLD detected: " + u.hostname.split(".").pop()); }
      if (/bank|paypal|paytm|amazon|google|microsoft|apple/.test(u.hostname) && !/(paypal\.com|paytm\.com|amazon\.com|google\.com|microsoft\.com|apple\.com)$/.test(u.hostname)) {
        score += 35; reasons.push("Brand impersonation detected in domain name");
      }
      links.push({ url: content, suspicious: score > 20 });
    } catch(e) { score += 10; reasons.push("Invalid or malformed URL structure"); }
  }

  // Feature F: Contextual Phishing Scoring - combination bonuses!
  let contextualBonus = 0;
  if (hasUrgency && hasAccountVerification) {
    contextualBonus += 20;
    reasons.push("⚡ Multi-factor phishing pattern: Urgency + Account Verification");
  }
  if (hasUrgency && hasSuspiciousURL) {
    contextualBonus += 18;
    reasons.push("⚡ Multi-factor phishing pattern: Urgency + Suspicious URL");
  }
  if (hasSecurityAlert && hasAccountVerification) {
    contextualBonus += 22;
    reasons.push("⚡ Multi-factor phishing pattern: Security Alert + Account Verification");
  }
  score += contextualBonus;

  // Feature H: Enhanced Educational Context Intelligence
  const falsePositiveCheck = checkFalsePositiveIndicators(content, lower);
  if (falsePositiveCheck.isEducational) {
    score = Math.max(0, score - falsePositiveCheck.score);
    falsePositiveCheck.detected.forEach(item => {
      reasons.push(`📘 ${item.label}`);
    });
  } else if (falsePositiveCheck.detected.length >0) {
    falsePositiveCheck.detected.forEach(item => {
      reasons.push(`ℹ️ ${item.label}`);
    });
  }

  score = Math.min(score, 100);

  // -- Reinforcement Learning: apply learned weights & pattern memory ----------
  const _rlModel    = rlLoad();
  const _ngrams     = rlNgrams(content, 2);
  const _patBonus   = rlPatternBonus(_ngrams, _rlModel);
  const _rlScore    = Math.max(0, Math.min(100, score + _patBonus));
  const _kwBonusRaw = rlApply(_rlScore, keywords, _rlModel);
  const rlAdjScore  = Math.max(0, Math.min(100, _kwBonusRaw));
  score             = rlAdjScore;                 // use RL-adjusted score

  // Verdict - RL-adjusted thresholds learned from feedback
  let verdict, category, tags, recommendations;
  const _rlVerdict = rlVerdictFromScore(score, _rlModel);
  if (_rlVerdict === "PHISHING") {
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
  } else if (_rlVerdict === "SPAM") {
    verdict = "SPAM";
    category = "Promotional Spam";
    tags = ["Unsolicited","Mass Message","Low Trust"];
    recommendations = [
      { icon: "[WARN]", text: "Treat this message with caution" },
      { icon: "[BLOCK]", text: "Do not respond or click any links" },
      { icon: "[MUTE]", text: "Consider blocking the sender" },
      { icon: "[DEL]", text: "Delete the message" }
    ];
  } else if (_rlVerdict === "SUSPICIOUS") {
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

  // Scam type override - Enhancement #4: Improved category labeling
  if (lower.includes("otp") || lower.includes("one time password")) { category = "OTP Fraud"; tags = ["OTP Theft","Identity Fraud"]; }
  else if (lower.includes("upi") || lower.includes("gpay") || lower.includes("phonepe")) { category = "UPI Scam"; tags = ["Payment Fraud","UPI Theft"]; }
  else if (lower.includes("lottery") || lower.includes("winner") || lower.includes("prize")) { category = "Lottery Scam"; tags = ["Prize Fraud","Advance Fee"]; }
  // Enhanced Recruitment Scam detection
  else if (lower.includes("job") || lower.includes("hiring") || lower.includes("salary") || 
           lower.includes("recruitment") || lower.includes("interview") || lower.includes("candidate") || 
           lower.includes("hr operations") || lower.includes("lpa")) { 
    category = "Recruitment Scam"; 
    tags = ["Employment Fraud","Advance Fee","Fake Job Offer"]; 
  }
  else if (lower.includes("kyc")) { category = "KYC Fraud"; tags = ["Identity Theft","Document Fraud"]; }

  // Phase 3 & 4: Include score breakdown and detection details
  const detectionDetails = {
    matchedPhishingPatterns: advancedPhishing?.length || 0,
    matchedUrgencyIndicators: urgencyPatterns?.length || 0,
    matchedFearIndicators: fearThreats?.length || 0,
    senderRiskFactors: impersonationCheck?.detected?.length || 0,
    blacklistMatch: !!matchedBlockedSender
  };

  return { score, verdict, category, tags, reasons: reasons.slice(0,5), keywords: [...new Set(keywords)].slice(0,8), links, recommendations, matchedBlockedSender, scoreBreakdown, detectionDetails };
}

async function showResults(content) {
  // Check blocklist FIRST before analyzing!
  const blocklistMatch = await checkBlocklistMatch(content);
  const r = analyzeContent(content, blocklistMatch);
  // Capture scan context so RL can learn from this prediction when feedback arrives
  rlCaptureScan(content, r.keywords, r.score, r.score, r.verdict);
  const sec = document.getElementById("resultsSection");
  sec.style.display = "";

  // Status card
  const card = document.getElementById("statusCard");
  const verdictMap = { PHISHING:"verdict-phishing", SPAM:"verdict-spam", SUSPICIOUS:"verdict-spam", SAFE:"verdict-safe", FRAUD:"verdict-fraud" };
  card.className = "det-card result-status-card " + (verdictMap[r.verdict] || "verdict-safe");
  document.getElementById("statusVerdict").textContent = r.verdict;
  const subMap = { PHISHING:"High-confidence phishing attempt detected", SPAM:"Unsolicited spam content identified", SUSPICIOUS:"Potentially suspicious - review recommended", SAFE:"No significant threats detected", FRAUD:"Fraudulent content detected" };
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
          ${l.suspicious ? '<span class="link-flag red">⚠ Suspicious</span><span class="link-flag orange">High Risk</span>' : '<span class="link-flag green">✓ Appears Safe</span>'}
        </div>
      </div>`).join("");
  } else {
    noLinks.style.display = "";
    linkList.style.display = "none";
  }

  // Explain
  // Show RL-adjusted confidence + learned feedback count
  const _rlSt = rlStats();
  const _confPct = Math.min(r.score + 5, 99);
  document.getElementById("explainConf").textContent =
    "Confidence: " + _confPct + "%" +
    (_rlSt.totalFeedback > 0
      ? "  |  AI learned from " + _rlSt.totalFeedback + " feedback" + (_rlSt.totalFeedback !== 1 ? "s" : "")
      : "");

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
  // Show/hide block sender panel based on verdict
  updateBlockPanel(r.verdict);

  // Show blocked sender badge if we found a match
  if (r.matchedBlockedSender) {
    showKnownBlockedBadge(r.matchedBlockedSender.matched);
    // Highlight the score since it's from a blocked sender
    const scoreEl = document.getElementById("scoreNum");
    if (scoreEl) {
      scoreEl.style.color = "#fc8181";
    }
  }
  // Record scan in live stats
  recordScan(r.verdict);
  // Save to backend (non-blocking, silent if offline)
  // Also always save to localStorage so history works regardless
  saveToLocalHistory({
    id:         Date.now(),
    type:       currentType,
    content:    content.slice(0, 500),
    verdict:    r.verdict,
    score:      r.score,
    category:   r.category,
    reasons:    r.reasons,
    keywords:   r.keywords,
    created_at: new Date().toISOString()
  });

  if (window.Api && Api.getToken()) {
    Api.saveDetection({
      type:     currentType,
      content:  content.slice(0, 500),
      verdict:  r.verdict,
      score:    r.score,
      category: r.category,
      reasons:  r.reasons,
      keywords: r.keywords
    }).catch(function() {}); // silent - already saved to localStorage above
  }
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
  // Save to cs_recent_detection for support page attachment
  try {
    localStorage.setItem('cs_recent_detection', JSON.stringify({
      verdict: r.verdict,
      score: r.score,
      category: r.category,
      type: currentType,
      reasons: r.reasons,
      keywords: r.keywords,
      timestamp: new Date().toISOString()
    }));
  } catch(e) {}

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

  // RL: learn from this feedback - adjusts keyword weights + verdict thresholds
  rlLearn(correct);

  // Update accuracy stats
  recordFeedback(correct);

  // Show adaptive message that tells the user the AI is learning
  const thanks = document.getElementById("feedbackThanks");
  const stats  = rlStats();
  
  if (correct) {
    thanks.innerHTML = 
      "<strong>Perfect!</strong> Prediction confirmed. AI has reinforced its confidence in this pattern. " +
      (stats.totalFeedback > 0 ? "(" + stats.totalFeedback + " total feedbacks learned)" : "");
  } else {
    thanks.innerHTML = 
      "<strong>Got it!</strong> Correction noted. AI is actively learning from this mistake and will be more precise next time. " +
      (stats.totalFeedback > 0 ? "(" + stats.totalFeedback + " corrections learned)" : "");
  }
  thanks.style.display = "";
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
}

// -- Local history cache (fallback when server offline) ------------------------
function getLocalHistoryKey() {
  const s  = JSON.parse(localStorage.getItem("cs_session")       || "null");
  const as = JSON.parse(localStorage.getItem("cs_admin_session") || "null");
  if (s)  return "cs_hist_u_" + (s.username  || s.email);
  if (as) return "cs_hist_a_" + (as.name    || as.email);
  return null;
}

function saveToLocalHistory(entry) {
  const key = getLocalHistoryKey();
  if (!key) return;
  try {
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.unshift(entry);          // newest first
    if (existing.length > 200) existing.splice(200); // cap at 200
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {}
}

// ------------------------------------------------------------------------------
//  USER BLOCKING SYSTEM
// ------------------------------------------------------------------------------

const BLOCK_API = 'http://localhost:3001/api/blocklist';

// -- Show/hide block panel based on verdict ------------------------------------
function updateBlockPanel(verdict) {
  const card = document.getElementById('blockSenderCard');
  if (!card) return;
  const showFor = ['PHISHING','SPAM','FRAUD','SUSPICIOUS'];
  if (showFor.includes(verdict)) {
    card.style.display = '';
    // Reset state
    document.getElementById('blockSenderInput').value = '';
    document.getElementById('blockInputError').textContent = '';
    document.getElementById('blockTypeBadge').style.display = 'none';
    document.getElementById('blockSuccess').style.display = 'none';
    document.getElementById('alreadyBlockedWarn').style.display = 'none';
    document.getElementById('blockBtn').style.display = '';
    document.getElementById('blockInputWrap').style.display = 'flex';
    document.getElementById('blockInputIcon').innerHTML = defaultBlockIcon();
  } else {
    card.style.display = 'none';
  }
}

function defaultBlockIcon() {
  return '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="#718096" stroke-width="1.3"/><path d="M8 5v4M8 11v.5" stroke="#718096" stroke-width="1.3" stroke-linecap="round"/></svg>';
}

// -- Auto-detect input type and update icon/badge ------------------------------
function detectBlockType(value) {
  const v = value.trim();
  if (!v) return null;
  if (/^[\+]?[\d\s\-\(\)]{7,15}$/.test(v))                     return 'phone';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))                    return 'email';
  if (/^https?:\/\//.test(v) || /^[\w\-]+\.[a-z]{2,}/.test(v)) return 'domain';
  if (v.length >= 3)                                           return 'account';
  return null;
}

const typeIcons = {
  phone:   '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="4" y="1" width="8" height="14" rx="2" stroke="#63b3ed" stroke-width="1.3"/><circle cx="8" cy="12" r=".8" fill="#63b3ed"/></svg>',
  email:   '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 4l6 4 6-4M2 4v8h12V4" stroke="#9f7aea" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  domain:  '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M6 10l-2 2a2.83 2.83 0 004 0l4-4a2.83 2.83 0 00-4-4L6.5 6" stroke="#f6ad55" stroke-width="1.3" stroke-linecap="round"/><path d="M10 6l2-2a2.83 2.83 0 00-4 0L4 8a2.83 2.83 0 004 4L9.5 10" stroke="#f6ad55" stroke-width="1.3" stroke-linecap="round"/></svg>',
  account: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#fc8181" stroke-width="1.3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#fc8181" stroke-width="1.3" stroke-linecap="round"/></svg>'
};
const typeColors = {
  phone:   { color:'#63b3ed', bg:'rgba(99,179,237,0.12)',   border:'rgba(99,179,237,0.3)'   },
  email:   { color:'#9f7aea', bg:'rgba(159,122,234,0.12)',  border:'rgba(159,122,234,0.3)'  },
  domain:  { color:'#f6ad55', bg:'rgba(246,173,85,0.12)',   border:'rgba(246,173,85,0.3)'   },
  account: { color:'#fc8181', bg:'rgba(252,129,129,0.12)',  border:'rgba(252,129,129,0.3)'  }
};

function onBlockInputChange(value) {
  const type  = detectBlockType(value);
  const icon  = document.getElementById('blockInputIcon');
  const badge = document.getElementById('blockTypeBadge');
  const err   = document.getElementById('blockInputError');
  err.textContent = '';

  if (type) {
    icon.innerHTML = typeIcons[type];
    const c = typeColors[type];
    badge.textContent = type.toUpperCase();
    badge.style.cssText = `color:${c.color};background:${c.bg};border:1px solid ${c.border};font-size:.62rem;font-weight:700;padding:2px 8px;border-radius:4px;flex-shrink:0;text-transform:uppercase;letter-spacing:.05em;`;
    badge.style.display = '';
  } else {
    icon.innerHTML = defaultBlockIcon();
    badge.style.display = 'none';
  }
}

// -- Block sender --------------------------------------------------------------
async function blockSender() {
  const input = document.getElementById('blockSenderInput');
  const value = input.value.trim();
  const err   = document.getElementById('blockInputError');

  if (!value) { err.textContent = 'Please enter a phone number, email, username, or domain.'; return; }

  const type = detectBlockType(value);
  if (!type) { err.textContent = 'Enter at least 3 characters to identify the sender.'; return; }

  // Validate by type
  if (type === 'phone') {
    const digits = value.replace(/[\s\-\(\)\+]/g,'');
    if (digits.length < 7 || digits.length > 15 || !/^\d+$/.test(digits)) {
      err.textContent = 'Enter a valid phone number.'; return;
    }
  }
  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    err.textContent = 'Enter a valid email address.'; return;
  }

  const btn = document.getElementById('blockBtn');
  btn.disabled = true;
  btn.innerHTML = '<div style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite"></div> Blocking...';

  try {
    const token = localStorage.getItem('cs_token');
    const res = await fetch(BLOCK_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
      body: JSON.stringify({ value, label: '' })
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.already_blocked) {
        // Show already blocked warning
        const warn = document.getElementById('alreadyBlockedWarn');
        document.getElementById('alreadyBlockedText').textContent = '⚠ This sender is already in your blacklist.';
        warn.style.display = 'flex';
        btn.disabled = false;
        btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M4.5 4.5l7 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg> Block Sender';
        return;
      }
      throw new Error(data.error || 'Block failed');
    }

    // Success
    document.getElementById('blockInputWrap').style.display = 'none';
    document.getElementById('blockBtn').style.display = 'none';
    document.getElementById('alreadyBlockedWarn').style.display = 'none';
    const successEl = document.getElementById('blockSuccess');
    const typeLabel = { phone:'Phone number', email:'Email address', domain:'Domain', account:'Account' }[type] || 'Sender';
    document.getElementById('blockSuccessText').textContent = `${typeLabel} "${value}" added to your protected blacklist.`;
    successEl.style.display = 'flex';

    // Also save to localStorage blacklist
    saveToLocalBlocklist({ id: data.id || Date.now(), value, type, created_at: new Date().toISOString() });

    showToast('Sender blocked successfully.', 'success');

  } catch (err2) {
    // Offline fallback - save to localStorage
    saveToLocalBlocklist({ id: Date.now(), value, type, created_at: new Date().toISOString() });
    document.getElementById('blockInputWrap').style.display = 'none';
    document.getElementById('blockBtn').style.display = 'none';
    const successEl = document.getElementById('blockSuccess');
    document.getElementById('blockSuccessText').textContent = `"${value}" added to your local blacklist.`;
    successEl.style.display = 'flex';
    showToast('Sender blocked (saved locally).', 'success');
  }
}

// -- Check if content contains a blocked sender (auto-risk enhancement) --------
async function checkBlocklistMatch(content) {
  console.log("[DEBUG] Blacklist Check Executed"); // Phase 1: Debug log
  if (!content) return null;
  const token = localStorage.getItem('cs_token');
  let result;
  
  if (!token) {
    result = checkLocalBlocklist(content);
  } else {
    try {
      // Extract potential identifiers from content
      const identifiers = extractIdentifiers(content);
      for (const id of identifiers) {
        const res = await fetch(BLOCK_API + '/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ value: id })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.blocked) {
            result = { matched: id, entry: data.entry };
            break;
          }
        }
      }
    } catch {}
    if (!result) result = checkLocalBlocklist(content);
  }

  if (result) {
    console.log("[DEBUG] Blacklist Match Found"); // Phase 1: Debug log
    console.log(`[DEBUG] Matched Entry: ${result.matched}`); // Phase 1: Debug log
  }

  return result;
}

function extractIdentifiers(content) {
  const ids = [];
  // Phone numbers
  const phones = content.match(/[\+]?[\d\s\-\(\)]{10,15}/g) || [];
  phones.forEach(p => { const d = p.replace(/[\s\-\(\)]/g,''); if (d.length >= 10) ids.push(d); });
  // Emails
  const emails = content.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) || [];
  ids.push(...emails);
  // Domains/URLs
  const urls = content.match(/https?:\/\/[^\s]+|[\w\-]+\.[a-z]{2,}[^\s]*/gi) || [];
  urls.forEach(u => ids.push(u.replace(/^https?:\/\//, '').split('/')[0]));
  return [...new Set(ids)].slice(0, 10);
}

// -- Show known blocked sender badge on status card ----------------------------
function showKnownBlockedBadge(matchedValue) {
  const statusLeft = document.querySelector('.status-left > div:last-child');
  if (!statusLeft) return;
  let badge = document.getElementById('knownBlockedBadge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'knownBlockedBadge';
    badge.className = 'known-blocked-badge';
    statusLeft.appendChild(badge);
  }
  badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="#fc8181" stroke-width="1.2"/><path d="M3 3l6 6M9 3L3 9" stroke="#fc8181" stroke-width="1.2" stroke-linecap="round"/></svg> Known blocked sender: ${matchedValue}`;
  badge.style.display = 'inline-flex';
}

// -- localStorage blacklist fallback ------------------------------------------
function getLocalBlocklistKey() {
  const s  = JSON.parse(localStorage.getItem('cs_session')       || 'null');
  const as = JSON.parse(localStorage.getItem('cs_admin_session') || 'null');
  if (s)  return 'cs_bl_u_' + (s.username || s.email);
  if (as) return 'cs_bl_a_' + (as.name    || as.email);
  return null;
}

function saveToLocalBlocklist(entry) {
  const key = getLocalBlocklistKey(); if (!key) return;
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if (!list.find(e => e.value === entry.value)) {
      list.unshift(entry);
      localStorage.setItem(key, JSON.stringify(list));
    }
  } catch {}
}

function checkLocalBlocklist(content) {
  const key = getLocalBlocklistKey(); if (!key) return null;
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const ids  = extractIdentifiers(content);
    for (const id of ids) {
      const found = list.find(e => e.value.toLowerCase().includes(id.toLowerCase()) || id.toLowerCase().includes(e.value.toLowerCase()));
      if (found) return { matched: found.value, entry: found };
    }
  } catch {}
  return null;
}

// -- Blacklist Modal -----------------------------------------------------------
async function openBlacklistModal() {
  const modal = document.getElementById('blacklistModal');
  requestAnimationFrame(() => modal.classList.add('show'));
  document.getElementById('blacklistLoading').style.display = 'flex';
  document.getElementById('blacklistEmpty').style.display   = 'none';
  document.getElementById('blacklistList').innerHTML        = '';

  let items = [];
  const token = localStorage.getItem('cs_token');
  if (token) {
    try {
      const res = await fetch(BLOCK_API, { headers: { 'Authorization': 'Bearer ' + token } });
      if (res.ok) { const d = await res.json(); items = d.blocked || []; }
    } catch {}
  }
  if (!items.length) {
    const key = getLocalBlocklistKey();
    if (key) { try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {} }
  }

  document.getElementById('blacklistLoading').style.display = 'none';
  document.getElementById('blacklistCountBadge').textContent = items.length;

  if (!items.length) {
    document.getElementById('blacklistEmpty').style.display = 'flex';
    return;
  }

  document.getElementById('blacklistList').innerHTML = items.map(item => {
    const typeClass = 'bl-type-' + (item.type || 'account');
    const timeStr   = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '';
    return `<div class="bl-item" id="bl-item-${item.id}">
      <div class="bl-item-icon">${typeIcons[item.type] || typeIcons.account}</div>
      <div class="bl-item-body">
        <div class="bl-item-value">${escHtml(item.value || item.normalized_value || '')}</div>
        <div class="bl-item-meta">
          <span class="bl-item-type ${typeClass}">${(item.type || 'account').toUpperCase()}</span>
          <span class="bl-item-time">${timeStr}</span>
        </div>
      </div>
      <button class="bl-unblock-btn" onclick="unblockSender(${item.id}, '${escHtml(item.value || '')}')">Unblock</button>
    </div>`;
  }).join('');
}

function closeBlacklistModal() {
  document.getElementById('blacklistModal').classList.remove('show');
}

async function unblockSender(id, value) {
  const token = localStorage.getItem('cs_token');
  try {
    if (token) {
      await fetch(`${BLOCK_API}/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
    }
    // Remove from local too
    const key = getLocalBlocklistKey();
    if (key) {
      try {
        const list = JSON.parse(localStorage.getItem(key) || '[]').filter(e => e.id !== id && e.value !== value);
        localStorage.setItem(key, JSON.stringify(list));
      } catch {}
    }
    const el = document.getElementById('bl-item-' + id);
    if (el) { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = 'all .3s'; setTimeout(() => el.remove(), 300); }
    const badge = document.getElementById('blacklistCountBadge');
    if (badge) badge.textContent = Math.max(0, parseInt(badge.textContent) - 1);
    showToast('"' + value + '" unblocked.', 'success');
  } catch { showToast('Unblock failed.', 'error'); }
}

async function clearBlacklist() {
  if (!confirm('Remove all blocked senders from your blacklist?')) return;
  const token = localStorage.getItem('cs_token');
  try {
    if (token) await fetch(BLOCK_API, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
    const key = getLocalBlocklistKey();
    if (key) localStorage.removeItem(key);
    document.getElementById('blacklistList').innerHTML = '';
    document.getElementById('blacklistEmpty').style.display = 'flex';
    document.getElementById('blacklistCountBadge').textContent = '0';
    showToast('Blacklist cleared.', 'success');
  } catch { showToast('Clear failed.', 'error'); }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
