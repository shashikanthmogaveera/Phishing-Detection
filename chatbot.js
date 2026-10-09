/* chatbot.js - CyberShield AI Chatbot with ChatGPT-style session history */

const CHAT_API   = 'http://localhost:3001/api/chat';
const SESSION_API = 'http://localhost:3001/api/chat/sessions';

let chatHistory    = [];   // current conversation context
let currentSession = null; // { id, title }
let isTyping       = false;
let ttsEnabled     = false;
let currentUtter   = null;
let sidebarOpen    = true;

// ── Speech Recognition ────────────────────────────────────────────────────────
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-IN';

  recognition.onstart = () => {
    isRecording = true;
    document.getElementById('voiceBar').style.display = 'flex';
    document.getElementById('micBtn').classList.add('recording');
    document.getElementById('voiceInterim').textContent = '';
  };
  recognition.onresult = (e) => {
    let interim = '', final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t; else interim += t;
    }
    document.getElementById('voiceInterim').textContent = interim || final;
    if (final) { const inp = document.getElementById('chatInput'); inp.value = final.trim(); autoResize(inp); }
  };
  recognition.onerror = (e) => {
    stopVoice();
    const msgs = { 'not-allowed': 'Microphone access denied.', 'no-speech': 'No speech detected.', 'network': 'Network error.' };
    if (msgs[e.error]) showToast(msgs[e.error], 'error');
  };
  recognition.onend = () => {
    stopVoice();
    const val = document.getElementById('chatInput').value.trim();
    if (val) setTimeout(() => sendMessage(), 300);
  };
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const session      = JSON.parse(localStorage.getItem('cs_session')       || 'null');
  const adminSession = JSON.parse(localStorage.getItem('cs_admin_session') || 'null');

  if (!session && !adminSession) { window.location.href = 'login.html'; return; }

  const name = session ? session.username : adminSession.name;
  const li = document.querySelector('.nav-login');
  const si = document.querySelector('.nav-signup');
  const um = document.querySelector('.nav-user');
  if (li) li.style.display = 'none';
  if (si) si.style.display = 'none';
  if (um) { um.style.display = 'flex'; const n = um.querySelector('.nav-username'); if (n) n.textContent = name; }

  if (!SpeechRecognition) {
    const mb = document.getElementById('micBtn');
    if (mb) { mb.style.opacity = '0.4'; mb.style.cursor = 'not-allowed'; mb.onclick = () => showToast('Voice input requires Chrome or Edge.', 'warn'); }
  }

  checkAIStatus();
  await loadSessionList();
  document.getElementById('chatInput').focus();
});

function logout() {
  localStorage.removeItem('cs_session');
  localStorage.removeItem('cs_admin_session');
  localStorage.removeItem('cs_token');
  window.location.href = 'index.html';
}

function getToken() { return localStorage.getItem('cs_token') || ''; }

// ── AI Status ─────────────────────────────────────────────────────────────────
async function checkAIStatus() {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  const mdl = document.getElementById('statusModel');
  dot.className = 'status-dot checking';
  txt.textContent = 'Checking...';
  mdl.textContent = '';
  try {
    const res = await fetch(CHAT_API + '/status');
    const data = await res.json();
    if (data.type === 'none') {
      dot.className = 'status-dot offline'; txt.textContent = 'AI Offline';
      mdl.textContent = 'Start LM Studio or Ollama';
      document.getElementById('setupBanner').style.display = 'flex';
    } else {
      dot.className = 'status-dot online'; txt.textContent = 'AI Online';
      mdl.textContent = (data.chatModel || data.models?.[0] || 'Mistral');
      document.getElementById('setupBanner').style.display = 'none';
    }
  } catch {
    dot.className = 'status-dot offline'; txt.textContent = 'Server Offline';
    mdl.textContent = 'node server/index.js';
  }
}

// ── Session List ──────────────────────────────────────────────────────────────
async function loadSessionList() {
  try {
    const res = await fetch(SESSION_API, { headers: { 'Authorization': 'Bearer ' + getToken() } });
    if (!res.ok) return;
    const data = await res.json();
    renderSessionList(data.sessions || []);
  } catch {}
}

function renderSessionList(sessions) {
  const list  = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  if (!sessions.length) { empty.style.display = ''; list.innerHTML = ''; list.appendChild(empty); return; }
  empty.style.display = 'none';
  list.innerHTML = sessions.map(s => `
    <div class="history-item ${currentSession && currentSession.id === s.id ? 'active' : ''}" data-id="${s.id}" onclick="loadSession(${s.id}, ${JSON.stringify(s.title).replace(/"/g, '&quot;')})">
      <div class="history-item-icon">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2h10v8H8l-2 2-2-2H2V2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
      </div>
      <div class="history-item-body">
        <div class="history-item-title">${escHtml(s.title)}</div>
        <div class="history-item-time">${formatRelTime(s.updated_at)}</div>
      </div>
      <div class="history-item-actions">
        <button class="hist-action-btn" onclick="event.stopPropagation(); renameSession(${s.id}, ${JSON.stringify(s.title).replace(/"/g, '&quot;')})" title="Rename">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M8 1.5l2.5 2.5-6 6H2V7.5l6-6z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
        </button>
        <button class="hist-action-btn hist-del-btn" onclick="event.stopPropagation(); deleteSession(${s.id})" title="Delete">
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4 3v6a.75.75 0 00.75.75h2.5A.75.75 0 008 9V3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>`).join('');
}

// ── Load a session ────────────────────────────────────────────────────────────
async function loadSession(id, title) {
  currentSession = { id, title };
  chatHistory = [];
  document.getElementById('chatTitle').textContent = title;

  // Clear messages, hide welcome
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  document.getElementById('welcomeScreen') && (document.getElementById('welcomeScreen').style.display = 'none');

  // Highlight in sidebar
  document.querySelectorAll('.history-item').forEach(el => el.classList.toggle('active', +el.dataset.id === id));

  try {
    const res = await fetch(`${SESSION_API}/${id}/messages`, {
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (!res.ok) return;
    const data = await res.json();
    const msgs = data.messages || [];
    msgs.forEach(m => {
      const role = m.role === 'assistant' ? 'ai' : 'user';
      renderMessage(role, m.content, m.created_at, false);
      chatHistory.push({ role: m.role, content: m.content });
    });
    scrollToBottom();
  } catch {}
}

// ── Start new chat ────────────────────────────────────────────────────────────
function startNewChat() {
  currentSession = null;
  chatHistory = [];
  stopTTS();
  document.getElementById('chatTitle').textContent = 'CyberShield AI Assistant';
  const container = document.getElementById('chatMessages');
  container.innerHTML = '';
  // Show welcome screen
  const ws = document.createElement('div');
  ws.id = 'welcomeScreen';
  ws.className = 'welcome-screen';
  ws.innerHTML = `
    <div class="welcome-icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 4L8 12v14c0 11 8.7 21.3 16 23.5C31.3 47.3 40 37 40 26V12L24 4z" fill="rgba(99,179,237,0.1)" stroke="#63b3ed" stroke-width="1.5"/><path d="M18 24l5 5 7-8" stroke="#63b3ed" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <h2 class="welcome-title">CyberShield AI Assistant</h2>
    <p class="welcome-sub">Ask me anything about phishing, scams, cybersecurity, and digital safety.</p>
    <div class="welcome-chips">
      <button class="chip" onclick="askSuggestion(this)">🎣 What is phishing?</button>
      <button class="chip" onclick="askSuggestion(this)">💳 How does UPI fraud work?</button>
      <button class="chip" onclick="askSuggestion(this)">🔗 How to check if a URL is safe?</button>
      <button class="chip" onclick="askSuggestion(this)">📱 Signs of a WhatsApp scam?</button>
    </div>`;
  container.appendChild(ws);
  document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
  document.getElementById('chatInput').focus();
}

// ── Send message ──────────────────────────────────────────────────────────────
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg   = input.value.trim();
  if (!msg || isTyping) return;

  stopTTS();
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('charCounter').textContent = '';

  // Hide welcome screen on first message
  const ws = document.getElementById('welcomeScreen');
  if (ws) ws.style.display = 'none';

  renderMessage('user', msg, null, true);
  chatHistory.push({ role: 'user', content: msg });

  const typingId = showTyping();
  isTyping = true;
  document.getElementById('sendBtn').disabled = true;
  const mb = document.getElementById('micBtn'); if (mb) mb.disabled = true;

  try {
    const res = await fetch(CHAT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ message: msg, history: chatHistory.slice(-10), session_id: currentSession?.id || null })
    });

    removeTyping(typingId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.setup) { document.getElementById('setupBanner').style.display = 'flex'; checkAIStatus(); }
      renderMessage('ai', '❌ ' + (err.error || 'Request failed.'), null, true);
      return;
    }

    const data  = await res.json();
    const reply = data.reply || 'No response.';
    chatHistory.push({ role: 'assistant', content: reply });

    // Update current session from response
    if (data.session_id && !currentSession) {
      currentSession = { id: data.session_id, title: msg.slice(0, 50) };
      document.getElementById('chatTitle').textContent = currentSession.title;
      await loadSessionList(); // refresh sidebar
    }

    const msgEl = renderMessage('ai', reply, null, true);
    if (ttsEnabled && msgEl) speakText(reply, msgEl.querySelector('.speak-btn'));

  } catch (err) {
    removeTyping(typingId);
    renderMessage('ai', '❌ Cannot reach server. Run: `node server/index.js`', null, true);
  } finally {
    isTyping = false;
    document.getElementById('sendBtn').disabled = false;
    const mb2 = document.getElementById('micBtn'); if (mb2) mb2.disabled = false;
    document.getElementById('chatInput').focus();
  }
}

// ── Render a message ──────────────────────────────────────────────────────────
function renderMessage(role, text, timestamp, animate) {
  const container = document.getElementById('chatMessages');
  const isAI = role === 'ai';
  const row = document.createElement('div');
  row.className = `msg-row msg-${isAI ? 'ai' : 'user'}${animate ? '' : ' no-anim'}`;

  const avatarSvg = isAI
    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v7c0 5.5 4.3 10.7 8 12 3.7-1.3 8-6.5 8-12V6L12 2z" fill="rgba(99,179,237,0.2)" stroke="#63b3ed" stroke-width="1.5"/><path d="M9 12l2.5 2.5L15 9" stroke="#63b3ed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="#9f7aea" stroke-width="1.3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="#9f7aea" stroke-width="1.3" stroke-linecap="round"/></svg>`;

  const timeStr = timestamp
    ? new Date(timestamp).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
    : new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

  const speakBtn = isAI ? `<button class="speak-btn" onclick="speakThisMessage(this)" title="Read aloud"><svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M3 6H1v4h2l4 3V3L3 6z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M11 5a3 3 0 010 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>` : '';

  row.innerHTML = `
    <div class="msg-avatar">${avatarSvg}</div>
    <div class="msg-content">
      <div class="msg-bubble">${formatMessage(text)}</div>
      <div class="msg-time">${isAI ? 'CyberShield AI' : 'You'} · ${timeStr} ${speakBtn}</div>
    </div>`;

  if (isAI) row.dataset.rawText = text;
  container.appendChild(row);
  scrollToBottom();
  return row;
}

// ── Session management ────────────────────────────────────────────────────────
async function renameSession(id, currentTitle) {
  const newTitle = prompt('Rename chat:', currentTitle);
  if (!newTitle || newTitle.trim() === currentTitle) return;
  try {
    await fetch(`${SESSION_API}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ title: newTitle.trim() })
    });
    if (currentSession?.id === id) {
      currentSession.title = newTitle.trim();
      document.getElementById('chatTitle').textContent = newTitle.trim();
    }
    await loadSessionList();
  } catch { showToast('Rename failed.', 'error'); }
}

async function deleteSession(id) {
  if (!confirm('Delete this chat?')) return;
  try {
    await fetch(`${SESSION_API}/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + getToken() }
    });
    if (currentSession?.id === id) startNewChat();
    await loadSessionList();
    showToast('Chat deleted.', 'success');
  } catch { showToast('Delete failed.', 'error'); }
}

function renameCurrentChat() {
  if (!currentSession) return showToast('Start a conversation first.', 'warn');
  renameSession(currentSession.id, currentSession.title);
}

function deleteCurrentChat() {
  if (!currentSession) return showToast('No active chat to delete.', 'warn');
  deleteSession(currentSession.id);
}

// ── Sidebar toggle ────────────────────────────────────────────────────────────
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  document.getElementById('chatSidebar').classList.toggle('collapsed', !sidebarOpen);
}

// ── Voice Input ───────────────────────────────────────────────────────────────
function toggleVoice() { if (!SpeechRecognition) return; isRecording ? stopVoice() : startVoice(); }
function startVoice()  { if (!recognition || isRecording) return; stopTTS(); try { recognition.start(); } catch {} }
function stopVoice()   {
  isRecording = false;
  document.getElementById('voiceBar').style.display = 'none';
  document.getElementById('micBtn').classList.remove('recording');
  try { recognition && recognition.stop(); } catch {}
}

// ── TTS ───────────────────────────────────────────────────────────────────────
function toggleTTS() {
  ttsEnabled = !ttsEnabled;
  const btn = document.getElementById('ttsToggle');
  btn.classList.toggle('active', ttsEnabled);
  btn.title = ttsEnabled ? 'Voice ON — click to turn off' : 'Voice OFF — click to turn on';
  showToast(ttsEnabled ? '🔊 Voice response enabled' : '🔇 Voice response disabled', 'info');
  if (!ttsEnabled) stopTTS();
}

function speakText(text, btnEl) {
  if (!window.speechSynthesis) return;
  stopTTS();
  const clean = text.replace(/\*\*(.+?)\*\*/g,'$1').replace(/`(.+?)`/g,'$1').replace(/```[\s\S]*?```/g,'').replace(/#{1,3} /g,'').replace(/\n+/g,'. ').trim();
  currentUtter = new SpeechSynthesisUtterance(clean);
  currentUtter.lang = 'en-IN'; currentUtter.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))) || voices.find(v => v.lang.startsWith('en'));
  if (v) currentUtter.voice = v;
  const ttsBtn = document.getElementById('ttsToggle');
  currentUtter.onstart = () => { if (ttsBtn) ttsBtn.classList.add('speaking'); if (btnEl) btnEl.classList.add('speaking'); };
  currentUtter.onend = currentUtter.onerror = () => { if (ttsBtn) ttsBtn.classList.remove('speaking'); if (btnEl) btnEl.classList.remove('speaking'); currentUtter = null; };
  window.speechSynthesis.speak(currentUtter);
}

function stopTTS() { if (window.speechSynthesis) window.speechSynthesis.cancel(); const b = document.getElementById('ttsToggle'); if (b) b.classList.remove('speaking'); currentUtter = null; }

function speakThisMessage(btn) {
  const row = btn.closest('.msg-row');
  const text = row?.dataset.rawText || '';
  if (!text) return;
  if (window.speechSynthesis?.speaking) { stopTTS(); btn.classList.remove('speaking'); return; }
  speakText(text, btn);
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function showTyping() {
  const id = 'typing-' + Date.now();
  const row = document.createElement('div');
  row.className = 'msg-row msg-ai'; row.id = id;
  row.innerHTML = `<div class="msg-avatar"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v7c0 5.5 4.3 10.7 8 12 3.7-1.3 8-6.5 8-12V6L12 2z" fill="rgba(99,179,237,0.2)" stroke="#63b3ed" stroke-width="1.5"/></svg></div><div class="msg-content"><div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div></div>`;
  document.getElementById('chatMessages').appendChild(row);
  scrollToBottom();
  return id;
}
function removeTyping(id) { const el = document.getElementById(id); if (el) el.remove(); }

// ── Format message ────────────────────────────────────────────────────────────
function formatMessage(text) {
  if (!text) return '';
  let html = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<div class="md-h3">$1</div>');
  html = html.replace(/^## (.+)$/gm,  '<div class="md-h2">$1</div>');
  html = html.replace(/^# (.+)$/gm,   '<div class="md-h1">$1</div>');
  const lines = html.split('\n');
  const out = []; let inList = false;
  for (const line of lines) {
    if (/^[-*] (.+)$/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = 'ul'; }
      out.push('<li>' + line.replace(/^[-*] /, '') + '</li>');
    } else if (/^\d+\. (.+)$/.test(line)) {
      if (!inList) { out.push('<ol>'); inList = 'ol'; }
      out.push('<li>' + line.replace(/^\d+\. /, '') + '</li>');
    } else {
      if (inList) { out.push('</' + inList + '>'); inList = false; }
      out.push(line.trim() === '' ? '<br>' : (line.startsWith('<div class="md-') || line.startsWith('<pre>') ? line : '<p>' + line + '</p>'));
    }
  }
  if (inList) out.push('</' + inList + '>');
  return out.join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function scrollToBottom() { const c = document.getElementById('chatMessages'); c.scrollTop = c.scrollHeight; }
function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; const l = el.value.length; document.getElementById('charCounter').textContent = l > 0 ? l + ' chars' : ''; }
function askSuggestion(btn) { const inp = document.getElementById('chatInput'); inp.value = btn.textContent.replace(/^[^\w]+/, '').trim(); autoResize(inp); inp.focus(); sendMessage(); }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatRelTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso), now = new Date(), diff = Math.floor((now - d) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return diff + 'm ago';
    if (diff < 1440) return Math.floor(diff/60) + 'h ago';
    if (diff < 10080) return Math.floor(diff/1440) + 'd ago';
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
  } catch { return ''; }
}

function showToast(msg, type) {
  let t = document.getElementById('cbToast');
  if (!t) {
    t = document.createElement('div'); t.id = 'cbToast';
    t.style.cssText = 'position:fixed;bottom:90px;right:24px;z-index:9999;padding:10px 16px;border-radius:10px;font-size:.8rem;font-weight:500;backdrop-filter:blur(16px);box-shadow:0 8px 32px rgba(0,0,0,0.4);transform:translateY(20px);opacity:0;transition:all .3s;display:flex;align-items:center;gap:8px;font-family:Inter,sans-serif;';
    document.body.appendChild(t);
  }
  const colors = { success:'background:rgba(13,17,23,.95);border:1px solid rgba(104,211,145,.3);color:#68d391', error:'background:rgba(13,17,23,.95);border:1px solid rgba(252,129,129,.3);color:#fc8181', warn:'background:rgba(13,17,23,.95);border:1px solid rgba(246,173,85,.3);color:#f6ad55', info:'background:rgba(13,17,23,.95);border:1px solid rgba(99,179,237,.3);color:#63b3ed' };
  t.style.cssText += ';' + (colors[type] || colors.info);
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.transform = 'translateY(0)'; t.style.opacity = '1'; });
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.transform = 'translateY(20px)'; t.style.opacity = '0'; }, 3000);
}