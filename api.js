// api.js — CyberShield AI frontend API client
// All pages include this before their own scripts.

const API_BASE = 'http://localhost:3001/api';

// ── Token helpers ─────────────────────────────────────────────────────────────
const Api = {
  getToken()  { return localStorage.getItem('cs_token') || null; },
  setToken(t) { localStorage.setItem('cs_token', t); },
  clearToken(){ localStorage.removeItem('cs_token'); },

  getSession()      { return JSON.parse(localStorage.getItem('cs_session')       || 'null'); },
  getAdminSession() { return JSON.parse(localStorage.getItem('cs_admin_session') || 'null'); },
  setSession(data)  { localStorage.setItem('cs_session',       JSON.stringify(data)); },
  setAdminSession(d){ localStorage.setItem('cs_admin_session', JSON.stringify(d)); },
  clearSessions()   {
    localStorage.removeItem('cs_session');
    localStorage.removeItem('cs_admin_session');
    localStorage.removeItem('cs_token');
  },

  // ── Core fetch wrapper ──────────────────────────────────────────────────────
  async request(method, path, body = null, auth = false) {
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (auth) {
      const token = this.getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
    }
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(API_BASE + path, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
      return data;
    } catch (err) {
      // If server is unreachable, fall back to localStorage mode
      if (err.message.includes('fetch') || err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        console.warn('[API] Server unreachable — using localStorage fallback');
        throw { offline: true, message: err.message };
      }
      throw err;
    }
  },

  get(path, auth = false)         { return this.request('GET',    path, null, auth); },
  post(path, body, auth = false)  { return this.request('POST',   path, body, auth); },

  // ── Auth ────────────────────────────────────────────────────────────────────
  async signup(payload) {
    const data = await this.post('/auth/signup', payload);
    this.setToken(data.token);
    if (data.role === 'admin') this.setAdminSession({ name: data.name, email: data.email });
    else                       this.setSession({ username: data.username, email: data.email });
    return data;
  },

  async login(payload) {
    const data = await this.post('/auth/login', payload);
    this.setToken(data.token);
    if (data.role === 'admin') this.setAdminSession({ name: data.name, email: data.email });
    else                       this.setSession({ username: data.username, email: data.email });
    return data;
  },

  // ── Detections ──────────────────────────────────────────────────────────────
  async saveDetection(payload) {
    return this.post('/detections', payload, true);
  },

  async getDetections(limit = 50, offset = 0) {
    return this.get(`/detections?limit=${limit}&offset=${offset}`, true);
  },

  async getDetectionStats() {
    return this.get('/detections/stats', true);
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  async getAdminUsers()        { return this.get('/admin/users',         true); },
  async getAdminStats()        { return this.get('/admin/stats',         true); },
  async getAdminStatsToday()   { return this.get('/admin/stats/today',   true); },
  async getAdminStatsMonthly() { return this.get('/admin/stats/monthly', true); },
  async getAdminDetections()   { return this.get('/admin/detections',    true); },
  
  // ── Phase 1: Detection Intelligence ────────────────────────────────────────
  async getAdminIntelligenceDetections(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.append(k, v); });
    return this.get('/admin/intelligence/detections' + (q ? '?' + q : ''), true);
  },
  async getAdminIntelligenceDetection(id) {
    return this.get(`/admin/intelligence/detections/${id}`, true);
  },

  // ── Phase2: Review Queue ───────────────────────────────────────────────────
  async getAdminReviewQueue(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) q.append(k, v); });
    return this.get('/admin/review-queue' + (q ? '?' + q : ''), true);
  },
  async getAdminReview(id) {
    return this.get(`/admin/review-queue/${id}`, true);
  },
  async patchAdminReview(id, data) {
    return this.patch(`/admin/review-queue/${id}`, data, true);
  },
  async getAdminReviewHistory() {
    return this.get('/admin/review-history', true);
  },

  // ── Phase3: AI Learning Center ────────────────────────────────────────────
  async getAdminLearningStats() {
    return this.get('/admin/learning/stats', true);
  },
  async getAdminLearningTrends() {
    return this.get('/admin/learning/trends', true);
  },
  async getAdminLearningMisclassifications() {
    return this.get('/admin/learning/misclassifications', true);
  },
  // New Learning Center APIs
  async getAdminLearningPerformanceOverview() {
    return this.get('/admin/learning/performance-overview', true);
  },
  async getAdminLearningAccuracyByCategory() {
    return this.get('/admin/learning/accuracy-by-category', true);
  },
  async getAdminLearningAccuracyTrends(days =7) {
    return this.get(`/admin/learning/accuracy-trends?days=${days}`, true);
  },
  async getAdminLearningMisclassificationDetails() {
    return this.get('/admin/learning/misclassification-details', true);
  },
  async getAdminLearningCommonErrorPatterns() {
    return this.get('/admin/learning/common-error-patterns', true);
  },
  async getAdminLearningInsights() {
    return this.get('/admin/learning/insights', true);
  },
  async getAdminLearningRecommendations() {
    return this.get('/admin/learning/recommendations', true);
  },
  async getAdminLearningPendingQueue() {
    return this.get('/admin/learning/pending-queue', true);
  },

  // ── Phase4: THREAT INTELLIGENCE ───────────────────────────────────────────────
  async getAdminThreatOverview() {
    return this.get('/admin/threat-intelligence/overview', true);
  },
  async getAdminThreatDomains() {
    return this.get('/admin/threat-intelligence/domains', true);
  },
  async getAdminThreatSenders() {
    return this.get('/admin/threat-intelligence/senders', true);
  },
  async getAdminThreatKeywords() {
    return this.get('/admin/threat-intelligence/keywords', true);
  },
  async getAdminThreatEmerging() {
    return this.get('/admin/threat-intelligence/emerging', true);
  },
  async getAdminThreatRelationships() {
    return this.get('/admin/threat-intelligence/relationships', true);
  },
  async getAdminThreatCampaigns() {
    return this.get('/admin/threat-intelligence/campaigns', true);
  },

  // ── Admin Support Center ─────────────────────────────────────────────────
  async getAdminSupportStats()           { return this.get('/admin/support/stats',                   true); },
  async getAdminSupportTickets(q='')     { return this.get('/admin/support/tickets' + (q?'?'+q:''),  true); },
  async getAdminSupportTicket(id)        { return this.get('/admin/support/tickets/'+id,             true); },
  async adminReplyTicket(id, content)    { return this.post('/admin/support/tickets/'+id+'/reply',   {content}, true); },
  async adminUpdateTicket(id, payload)   { return this.request('PATCH','/admin/support/tickets/'+id+'/status', payload, true); },
  async adminAddBlacklist(payload)       { return this.post('/admin/support/blacklist',              payload, true); },
  async getAdminSupportIntelligence()    { return this.get('/admin/support/intelligence',            true); },

  // ── Connected Intelligence Layer ─────────────────────────────────────────
  async getIntelligenceTimeline(detectionId='')  {
    const q = detectionId ? '?detection_id=' + detectionId + '&limit=100' : '?limit=100';
    return this.get('/admin/intelligence/timeline' + q, true);
  },
  async getRelatedIntelligence(detectionId) { return this.get('/admin/intelligence/related/'+detectionId, true); },
  async getThreatIntelFromCorrections()     { return this.get('/admin/threat-intelligence/from-corrections', true); },
  async promoteThreatToBlacklist(payload)   { return this.post('/admin/threat-intelligence/promote', payload, true); },
  async getAdminBlacklist(type='')          { return this.get('/admin/blacklist' + (type ? '?type='+type : ''), true); },
  async deleteAdminBlacklist(id)            { return this.request('DELETE', '/admin/blacklist/'+id, null, true); },
  async getIntelligenceDashboard()          { return this.get('/admin/intelligence/dashboard', true); },

  // ── Contact ─────────────────────────────────────────────────────────────────
  async sendContact(payload) { return this.post('/contact', payload); },

  // ── Health check ────────────────────────────────────────────────────────────
  async isOnline() {
    try { await this.get('/health'); return true; } catch { return false; }
  }
};

window.Api = Api;
