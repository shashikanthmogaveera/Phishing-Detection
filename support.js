/* support.js — CyberShield AI Support & Threat Reporting Center */


// ── State ─────────────────────────────────────────────────────────────────────
let allTickets = [];
let attachedFiles = [];
let currentTicketId = null;
let recentDetection = null;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const session = JSON.parse(localStorage.getItem('cs_session') || 'null');
  const adminSession = JSON.parse(localStorage.getItem('cs_admin_session') || 'null');

  if (!session && !adminSession) {
    sessionStorage.setItem('cs_redirect', 'support.html');
    window.location.href = 'login.html';
    return;
  }

  updateNavbar(session || adminSession);

  // Navbar scroll effect
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', window.scrollY > 10));

  // Load recent detection from localStorage
  loadRecentDetection();

  // Load tickets and stats
  loadTickets();
  loadStats();
});

// ── Navbar ────────────────────────────────────────────────────────────────────
function updateNavbar(session) {
  const li = document.querySelector('.nav-login');
  const si = document.querySelector('.nav-signup');
  const um = document.querySelector('.nav-user');
  if (session) {
    if (li) li.style.display = 'none';
    if (si) si.style.display = 'none';
    if (um) {
      um.style.display = 'flex';
      const n = um.querySelector('.nav-username');
      if (n) n.textContent = session.username || session.name || session.email || 'User';
    }
  }
}

function logout() {
  localStorage.removeItem('cs_session');
  localStorage.removeItem('cs_token');
  window.location.href = 'index.html';
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('cs_token') || '';
}

function getSession() {
  return JSON.parse(localStorage.getItem('cs_session') || 'null') ||
         JSON.parse(localStorage.getItem('cs_admin_session') || 'null');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + getToken()
  };
}

// ── Recent Detection ──────────────────────────────────────────────────────────
function loadRecentDetection() {
  try {
    const raw = localStorage.getItem('cs_recent_detection');
    if (!raw) return;
    recentDetection = JSON.parse(raw);
    const detAttach = document.getElementById('detectionAttach');
    if (detAttach && recentDetection) {
      detAttach.style.display = '';
      const preview = document.getElementById('detAttachPreview');
      if (preview) {
        preview.textContent = 'Verdict: ' + (recentDetection.verdict || '?') +
          ' | Score: ' + (recentDetection.score || 0) +
          ' | Category: ' + (recentDetection.category || '?') +
          ' | Type: ' + (recentDetection.type || '?');
      }
    }
  } catch (e) {
    recentDetection = null;
  }
}

function toggleDetectionAttach(checked) {
  const preview = document.getElementById('detAttachPreview');
  if (preview) preview.style.display = checked ? '' : 'none';
}

// ── Category Selection ────────────────────────────────────────────────────────
function selectCategory(cat) {
  // Highlight card
  document.querySelectorAll('.category-card').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === cat);
  });

  // Set dropdown
  const sel = document.getElementById('ticketCategory');
  if (sel) sel.value = cat;

  // Show AI suggestions
  showAiSuggestions(cat);

  // Scroll to form
  const formSection = document.getElementById('ticketFormSection');
  if (formSection) {
    setTimeout(() => formSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }
}

function onCategoryChange(cat) {
  document.querySelectorAll('.category-card').forEach(c => {
    c.classList.toggle('active', c.dataset.cat === cat);
  });
  showAiSuggestions(cat);
}

// ── AI Suggestions ────────────────────────────────────────────────────────────
const AI_SUGGESTIONS = {
  'Report Phishing': [
    'Include the full message text or URL you received — even partial content helps our team analyze the threat.',
    'Mention the sender\'s phone number, email address, or domain if visible.',
    'Note the platform where you received it (SMS, WhatsApp, Email, etc.).'
  ],
  'Wrong Prediction': [
    'Paste the exact content that was analyzed so we can reproduce the result.',
    'Tell us what verdict the AI gave and what you believe the correct verdict should be.',
    'Include the threat score if you remember it — this helps our model improvement team.'
  ],
  'Suspicious URL': [
    'Paste the full URL including http:// or https:// prefix.',
    'Describe where you found this URL (message, website, QR code, etc.).',
    'Do NOT click the URL — just copy and paste it here safely.'
  ],
  'Account Issue': [
    'Describe the exact error message or behavior you are experiencing.',
    'Include the browser and device you are using.',
    'Mention when the issue started and if anything changed recently.'
  ],
  'General Support': [
    'Be as specific as possible about what you need help with.',
    'Include any error messages or screenshots if relevant.',
    'Mention which feature or page you are having trouble with.'
  ],
  'AI Feedback': [
    'Provide the original content that was analyzed and the AI\'s verdict.',
    'Explain why you think the detection was correct or incorrect.',
    'Your feedback directly improves our detection model — thank you!'
  ],
  'Cyber Incident': [
    'Report the incident as soon as possible — time is critical for cyber incidents.',
    'Include dates, times, and any financial or personal data that may have been compromised.',
    'You can also report to cybercrime.gov.in or call the national helpline 1930.'
  ]
};

function showAiSuggestions(cat) {
  const panel = document.getElementById('aiSuggestions');
  const list = document.getElementById('aiSuggList');
  if (!panel || !list) return;

  const suggestions = AI_SUGGESTIONS[cat] || AI_SUGGESTIONS['General Support'];
  list.innerHTML = suggestions.map(s =>
    '<div class="ai-sugg-card">' + escHtml(s) + '</div>'
  ).join('');
  panel.style.display = '';
}

// ── Auto-priority Detection ───────────────────────────────────────────────────
function detectPriority(text) {
  const t = text.toLowerCase();
  const critical = ['phishing', 'bank', 'otp', 'fraud', 'critical', 'hacked', 'stolen', 'breach', 'ransomware', 'identity theft'];
  const high = ['urgent', 'malware', 'virus', 'attack', 'suspicious url', 'scam', 'cybercrime'];
  const medium = ['wrong', 'incorrect', 'prediction', 'false positive', 'false negative', 'inaccurate', 'mistake'];
  if (critical.some(w => t.includes(w))) return 'Critical';
  if (high.some(w => t.includes(w))) return 'High';
  if (medium.some(w => t.includes(w))) return 'Medium';
  return 'Low';
}

function onSubjectInput(val) {
  const badge = document.getElementById('aiPriorityBadge');
  const badgeText = document.getElementById('aiPriorityText');
  if (!badge || !badgeText) return;

  if (!val.trim()) { badge.style.display = 'none'; return; }

  const desc = (document.getElementById('ticketDescription') || {}).value || '';
  const priority = detectPriority(val + ' ' + desc);

  badge.style.display = '';
  badge.className = 'ai-priority-badge p-' + priority.toLowerCase();
  badgeText.textContent = 'AI: ' + priority;

  // Auto-select priority button
  setPriority(priority);
}

function onDescInput(val) {
  const counter = document.getElementById('descCharCount');
  if (counter) counter.textContent = val.length;

  const subject = (document.getElementById('ticketSubject') || {}).value || '';
  if (subject.trim()) onSubjectInput(subject);
}

// ── Priority Selection ────────────────────────────────────────────────────────
function setPriority(p) {
  document.querySelectorAll('.priority-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.p === p);
  });
  const hidden = document.getElementById('ticketPriority');
  if (hidden) hidden.value = p;
}

// ── File Upload ───────────────────────────────────────────────────────────────
function uploadDragOver(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.add('drag-over');
}

function uploadDragLeave(e) {
  document.getElementById('uploadZone').classList.remove('drag-over');
}

function uploadDrop(e) {
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag-over');
  handleFileAttach(e.dataTransfer.files);
}

function handleFileAttach(files) {
  if (!files || !files.length) return;
  const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf', 'text/plain'];
  Array.from(files).forEach(file => {
    if (!allowed.includes(file.type) && !file.name.match(/\.(png|jpg|jpeg|pdf|txt)$/i)) {
      showToast('Unsupported file: ' + file.name, 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(file.name + ' exceeds 5MB limit', 'error');
      return;
    }
    if (attachedFiles.find(f => f.name === file.name)) return;
    attachedFiles.push(file);
  });
  renderAttachedFiles();
}

function renderAttachedFiles() {
  const container = document.getElementById('attachedFiles');
  if (!container) return;
  container.innerHTML = attachedFiles.map((f, i) =>
    '<div class="attached-file">' +
    '<span>📎 ' + escHtml(f.name) + '</span>' +
    '<button class="attached-file-remove" onclick="removeFile(' + i + ')" title="Remove">✕</button>' +
    '</div>'
  ).join('');
}

function removeFile(idx) {
  attachedFiles.splice(idx, 1);
  renderAttachedFiles();
}


// ── Form Submit ───────────────────────────────────────────────────────────────
async function submitTicket(e) {
  e.preventDefault();

  const subject = document.getElementById('ticketSubject').value.trim();
  const category = document.getElementById('ticketCategory').value;
  const priority = document.getElementById('ticketPriority').value;
  const description = document.getElementById('ticketDescription').value.trim();

  if (!subject) { showToast('Subject is required', 'error'); return; }
  if (!description) { showToast('Description is required', 'error'); return; }

  // Build detection_data if attached
  let detection_data = null;
  const attachToggle = document.getElementById('attachDetection');
  if (attachToggle && attachToggle.checked && recentDetection) {
    detection_data = recentDetection;
  }

  const btn = document.getElementById('submitBtn');
  const btnText = document.getElementById('submitBtnText');
  btn.disabled = true;
  btnText.textContent = 'Submitting...';

  try {
    const token = getToken();
    let ticket_id;

    if (token) {
      const res = await fetch('http://localhost:3001/api/support/tickets', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ subject, category, priority, description, detection_data })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit ticket');
      ticket_id = data.ticket_id;

      // Refresh tickets list
      await loadTickets();
      await loadStats();
    } else {
      // Offline fallback — save to localStorage
      ticket_id = 'CYB-' + Math.floor(1000 + Math.random() * 9000);
      const offlineTicket = {
        id: Date.now(),
        ticket_id,
        subject,
        category,
        priority,
        description,
        status: 'open',
        created_at: new Date().toISOString(),
        message_count: 1
      };
      const existing = JSON.parse(localStorage.getItem('cs_support_tickets') || '[]');
      existing.unshift(offlineTicket);
      localStorage.setItem('cs_support_tickets', JSON.stringify(existing));
      allTickets = existing;
      renderTickets(allTickets);
    }

    // Show success
    document.getElementById('ticketFormCard').style.display = 'none';
    const successCard = document.getElementById('successCard');
    successCard.style.display = '';
    document.getElementById('successTicketId').textContent = ticket_id;

    // Reset form
    document.getElementById('ticketForm').reset();
    attachedFiles = [];
    renderAttachedFiles();
    document.getElementById('aiSuggestions').style.display = 'none';
    document.getElementById('aiPriorityBadge').style.display = 'none';
    document.getElementById('descCharCount').textContent = '0';
    setPriority('Low');
    document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));

    showToast('Ticket ' + ticket_id + ' submitted!', 'success');

  } catch (err) {
    showToast(err.message || 'Failed to submit ticket', 'error');
    btn.disabled = false;
    btnText.textContent = 'Submit Support Ticket';
  }
}

function showNewTicketForm() {
  document.getElementById('ticketFormCard').style.display = '';
  document.getElementById('successCard').style.display = 'none';
  const btn = document.getElementById('submitBtn');
  const btnText = document.getElementById('submitBtnText');
  if (btn) btn.disabled = false;
  if (btnText) btnText.textContent = 'Submit Support Ticket';
}

function scrollToTickets() {
  const sec = document.getElementById('myTicketsSection');
  if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Load Stats ────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const token = getToken();
    if (!token) {
      const offline = JSON.parse(localStorage.getItem('cs_support_tickets') || '[]');
      updateStatsDisplay({
        total: offline.length,
        open: offline.filter(t => t.status === 'open').length,
        resolved: offline.filter(t => t.status === 'resolved').length
      });
      return;
    }

    const res = await fetch('http://localhost:3001/api/support/stats', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) return;
    const data = await res.json();
    updateStatsDisplay(data);
  } catch (e) {
    // silent
  }
}

function updateStatsDisplay(stats) {
  animateStatVal('stat-total', stats.total || 0);
  animateStatVal('stat-open', stats.open || 0);
  animateStatVal('stat-resolved', stats.resolved || 0);
}

function animateStatVal(id, target) {
  const el = document.getElementById(id);
  if (!el || isNaN(target)) return;
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();
  function step(now) {
    const p = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}


// ── Load Tickets ──────────────────────────────────────────────────────────────
async function loadTickets() {
  const loading = document.getElementById('ticketsLoading');
  const empty = document.getElementById('ticketsEmpty');
  const list = document.getElementById('ticketsList');

  if (loading) loading.style.display = 'flex';
  if (empty) empty.style.display = 'none';

  try {
    const token = getToken();
    if (!token) {
      // Offline fallback
      allTickets = JSON.parse(localStorage.getItem('cs_support_tickets') || '[]');
    } else {
      const res = await fetch('http://localhost:3001/api/support/tickets', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) throw new Error('Failed to load tickets');
      const data = await res.json();
      allTickets = data.tickets || [];

      // Merge with any offline tickets not yet synced
      const offline = JSON.parse(localStorage.getItem('cs_support_tickets') || '[]');
      offline.forEach(ot => {
        if (!allTickets.find(t => t.ticket_id === ot.ticket_id)) {
          allTickets.unshift(ot);
        }
      });
    }
  } catch (e) {
    allTickets = JSON.parse(localStorage.getItem('cs_support_tickets') || '[]');
  }

  if (loading) loading.style.display = 'none';
  renderTickets(allTickets);
}

function filterTickets() {
  const search = (document.getElementById('ticketSearch').value || '').toLowerCase();
  const status = document.getElementById('statusFilter').value;
  const category = document.getElementById('categoryFilter').value;

  const filtered = allTickets.filter(t => {
    const matchSearch = !search ||
      (t.subject || '').toLowerCase().includes(search) ||
      (t.ticket_id || '').toLowerCase().includes(search) ||
      (t.description || '').toLowerCase().includes(search);
    const matchStatus = !status || t.status === status;
    const matchCat = !category || t.category === category;
    return matchSearch && matchStatus && matchCat;
  });

  renderTickets(filtered);
}

function renderTickets(tickets) {
  const list = document.getElementById('ticketsList');
  const empty = document.getElementById('ticketsEmpty');
  if (!list) return;

  // Remove existing ticket cards (keep loading/empty divs)
  Array.from(list.querySelectorAll('.ticket-card')).forEach(el => el.remove());

  if (!tickets || tickets.length === 0) {
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  tickets.forEach(ticket => {
    const card = renderTicketCard(ticket);
    list.appendChild(card);
  });
}

function renderTicketCard(ticket) {
  const div = document.createElement('div');
  div.className = 'ticket-card';
  div.onclick = () => openTicket(ticket.id);

  const statusClass  = 'status-' + (ticket.status || 'open');
  const statusLabel  = (ticket.status || 'open').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const priorityClass = 'priority-badge-' + (ticket.priority || 'low').toLowerCase();
  const msgCount = ticket.message_count || 0;
  const iso = ticket.created_at || '';

  div.innerHTML =
    '<div class="ticket-card-left">' +
      '<div class="ticket-card-id">' + escHtml(ticket.ticket_id || '') + '</div>' +
      '<div class="ticket-card-subject">' + escHtml(ticket.subject || '') + '</div>' +
      '<div class="ticket-card-meta">' +
        '<span class="ticket-card-cat">' + escHtml(ticket.category || '') + '</span>' +
        '<span class="ticket-card-date" data-iso="' + iso + '">· ' + formatTime(iso) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="ticket-card-right">' +
      '<span class="ticket-msg-count">💬 ' + msgCount + '</span>' +
      '<span class="priority-badge ' + priorityClass + '">' + escHtml(ticket.priority || 'Low') + '</span>' +
      '<span class="status-badge ' + statusClass + '">' + statusLabel + '</span>' +
    '</div>';

  return div;
}

// ── Ticket Detail Modal ───────────────────────────────────────────────────────
async function openTicket(id) {
  if (!id) return;
  currentTicketId = id;

  const modal = document.getElementById('ticketModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Reset modal
  document.getElementById('conversationThread').innerHTML =
    '<div class="conv-loading"><div class="loading-spinner"></div></div>';
  document.getElementById('modalSubject').textContent = 'Loading...';
  document.getElementById('modalTicketId').textContent = '';
  document.getElementById('modalMeta').textContent = '';
  document.getElementById('modalStatusBadge').textContent = '';

  try {
    const token = getToken();
    if (!token) {
      // Offline: show basic info
      const ticket = allTickets.find(t => t.id === id);
      if (ticket) renderModalTicket(ticket, []);
      return;
    }

    const res = await fetch('http://localhost:3001/api/support/tickets/' + id, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Failed to load ticket');
    const data = await res.json();
    renderModalTicket(data.ticket, data.messages || []);
  } catch (err) {
    document.getElementById('conversationThread').innerHTML =
      '<div style="text-align:center;padding:32px;color:#fc8181">Failed to load ticket</div>';
    showToast('Failed to load ticket', 'error');
  }
}

function renderModalTicket(ticket, messages) {
  document.getElementById('modalTicketId').textContent = ticket.ticket_id || '';
  document.getElementById('modalSubject').textContent = ticket.subject || '';

  const meta = document.getElementById('modalMeta');
  const iso  = ticket.created_at || '';
  meta.innerHTML =
    '<span>' + escHtml(ticket.category || '') + '</span>' +
    '<span>·</span>' +
    '<span class="priority-badge ' + 'priority-badge-' + (ticket.priority || 'low').toLowerCase() + '">' + escHtml(ticket.priority || '') + '</span>' +
    '<span>·</span>' +
    '<span class="msg-time" data-iso="' + iso + '">' + formatTime(iso) + '</span>';

  const statusBadge = document.getElementById('modalStatusBadge');
  const statusLabel = (ticket.status || 'open').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  statusBadge.className = 'modal-status-badge status-badge status-' + (ticket.status || 'open');
  statusBadge.textContent = statusLabel;

  // Render messages
  const thread = document.getElementById('conversationThread');
  if (!messages || messages.length === 0) {
    thread.innerHTML = '<div style="text-align:center;padding:24px;color:#718096;font-size:.83rem">No messages yet</div>';
  } else {
    thread.innerHTML = messages.map(msg => renderMessage(msg)).join('');
    // Scroll to bottom
    setTimeout(() => { thread.scrollTop = thread.scrollHeight; }, 100);
  }

  // Show/hide reply area based on status
  const replyArea = document.getElementById('replyArea');
  const closedNotice = document.getElementById('closedNotice');
  const closeBtn = document.getElementById('closeTicketBtn');

  if (ticket.status === 'closed') {
    if (replyArea) replyArea.style.display = 'none';
    if (closedNotice) closedNotice.style.display = '';
  } else {
    if (replyArea) replyArea.style.display = '';
    if (closedNotice) closedNotice.style.display = 'none';
    if (closeBtn) closeBtn.style.display = ticket.status !== 'closed' ? '' : 'none';
  }
}

function renderMessage(msg) {
  const isUser    = msg.sender_role === 'user';
  const roleClass = isUser ? 'user' : 'admin';
  const avatarClass = isUser ? 'user-av' : 'admin-av';
  const avatarText  = isUser ? 'U' : 'A';
  const name = escHtml(msg.sender_name || (isUser ? 'You' : 'Support'));
  const iso  = msg.created_at || '';

  return '<div class="msg-bubble ' + roleClass + '">' +
    '<div class="msg-header">' +
      (isUser ? '' : '<div class="msg-avatar ' + avatarClass + '">' + avatarText + '</div>') +
      '<span>' + name + '</span>' +
      '<span class="msg-time" data-iso="' + iso + '">' + formatTime(iso) + '</span>' +
      (isUser ? '<div class="msg-avatar ' + avatarClass + '">' + avatarText + '</div>' : '') +
    '</div>' +
    '<div class="msg-content">' + escHtml(msg.content || '') + '</div>' +
  '</div>';
}


// ── Modal Actions ─────────────────────────────────────────────────────────────
function closeModal() {
  const modal = document.getElementById('ticketModal');
  modal.classList.remove('open');
  document.body.style.overflow = '';
  currentTicketId = null;
  const replyInput = document.getElementById('replyInput');
  if (replyInput) replyInput.value = '';
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('ticketModal')) closeModal();
}

async function sendReply() {
  if (!currentTicketId) return;
  const input = document.getElementById('replyInput');
  const content = (input ? input.value : '').trim();
  if (!content) { showToast('Please enter a message', 'error'); return; }

  const btn = document.querySelector('.btn-send-reply');
  if (btn) btn.disabled = true;

  try {
    const token = getToken();
    if (!token) {
      showToast('Please log in to reply', 'error');
      return;
    }

    const res = await fetch('http://localhost:3001/api/support/tickets/' + currentTicketId + '/messages', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to send reply');

    // Append message to thread
    const thread = document.getElementById('conversationThread');
    if (thread && data.message) {
      thread.insertAdjacentHTML('beforeend', renderMessage(data.message));
      thread.scrollTop = thread.scrollHeight;
    }

    if (input) input.value = '';
    showToast('Reply sent', 'success');

    // Refresh ticket list
    loadTickets();
  } catch (err) {
    showToast(err.message || 'Failed to send reply', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function closeTicketAction() {
  if (!currentTicketId) return;
  if (!confirm('Close this ticket? You can reopen it later.')) return;

  try {
    const token = getToken();
    if (!token) {
      // Offline
      const idx = allTickets.findIndex(t => t.id === currentTicketId);
      if (idx !== -1) {
        allTickets[idx].status = 'closed';
        localStorage.setItem('cs_support_tickets', JSON.stringify(allTickets));
        renderTickets(allTickets);
      }
      closeModal();
      showToast('Ticket closed', 'info');
      return;
    }

    const res = await fetch('http://localhost:3001/api/support/tickets/' + currentTicketId + '/status', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'closed' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to close ticket');

    closeModal();
    showToast('Ticket closed', 'info');
    loadTickets();
    loadStats();
  } catch (err) {
    showToast(err.message || 'Failed to close ticket', 'error');
  }
}

async function reopenTicket() {
  if (!currentTicketId) return;

  try {
    const token = getToken();
    if (!token) {
      const idx = allTickets.findIndex(t => t.id === currentTicketId);
      if (idx !== -1) {
        allTickets[idx].status = 'open';
        localStorage.setItem('cs_support_tickets', JSON.stringify(allTickets));
      }
      closeModal();
      showToast('Ticket reopened', 'success');
      return;
    }

    const res = await fetch('http://localhost:3001/api/support/tickets/' + currentTicketId + '/status', {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'open' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reopen ticket');

    closeModal();
    showToast('Ticket reopened', 'success');
    loadTickets();
    loadStats();
  } catch (err) {
    showToast(err.message || 'Failed to reopen ticket', 'error');
  }
}

async function deleteTicketAction() {
  if (!currentTicketId) return;
  if (!confirm('Permanently delete this ticket? This cannot be undone.')) return;

  try {
    const token = getToken();
    if (!token) {
      allTickets = allTickets.filter(t => t.id !== currentTicketId);
      localStorage.setItem('cs_support_tickets', JSON.stringify(allTickets));
      renderTickets(allTickets);
      closeModal();
      showToast('Ticket deleted', 'info');
      return;
    }

    const res = await fetch('http://localhost:3001/api/support/tickets/' + currentTicketId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete ticket');

    closeModal();
    showToast('Ticket deleted', 'info');
    loadTickets();
    loadStats();
  } catch (err) {
    showToast(err.message || 'Failed to delete ticket', 'error');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Format a timestamp for display.
 * - Within 60 s  : "just now"
 * - Within 60 min: "5 min ago"
 * - Within 24 h  : "3 hr ago · HH:MM"
 * - Older        : "11 Jun · HH:MM"
 * Always shows exact time so users know the real timestamp.
 */
function formatTime(iso) {
  if (!iso) return '';
  try {
    const d    = new Date(iso);
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000); // seconds

    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (diff < 60)   return 'just now · ' + timeStr;
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago · ' + timeStr;
    if (diff < 86400) return Math.floor(diff / 3600) + ' hr ago · ' + timeStr;

    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    return dateStr + ' · ' + timeStr;
  } catch { return iso; }
}

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(msg, type) {
  type = type || 'info';
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.innerHTML = '<span>' + icons[type] + '</span><span>' + escHtml(msg) + '</span>';
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Live timestamp ticker — updates all data-iso spans every 60 s ────────────
setInterval(() => {
  document.querySelectorAll('[data-iso]').forEach(el => {
    const iso = el.dataset.iso;
    if (!iso) return;
    // All timestamps in support.js use formatTime — not socFmtTime
    el.textContent = formatTime(iso);
    // Restore the leading "· " prefix for ticket card dates
    if (el.classList.contains('ticket-card-date')) {
      el.textContent = '· ' + formatTime(iso);
    }
  });
}, 60000);

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && e.ctrlKey) {
    const modal = document.getElementById('ticketModal');
    if (modal && modal.classList.contains('open')) sendReply();
  }
});

