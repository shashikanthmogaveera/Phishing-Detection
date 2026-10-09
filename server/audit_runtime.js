// Runtime audit script — queries actual DB and prints real data
const initSqlJs = require('sql.js');
const fs   = require('fs');
const path = require('path');

async function audit() {
  const SQL    = await initSqlJs();
  const dbPath = path.join(__dirname, 'cybershield.db');

  if (!fs.existsSync(dbPath)) {
    console.log('DB_NOT_FOUND: cybershield.db does not exist');
    return;
  }

  const db = new SQL.Database(fs.readFileSync(dbPath));

  function q(sql, params) {
    const stmt = db.prepare(sql);
    if (params) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }
  function q1(sql, params) { return q(sql, params)[0] || null; }

  // ── DETECTIONS ──────────────────────────────────────────────────────────────
  console.log('\n=== DETECTIONS ===');
  const detCount = q1('SELECT COUNT(*) as n FROM detections');
  console.log('total_detections:', JSON.stringify(detCount));
  const verdictBreakdown = q('SELECT verdict, COUNT(*) as n FROM detections GROUP BY verdict ORDER BY n DESC');
  console.log('verdict_breakdown:', JSON.stringify(verdictBreakdown));
  const recentDets = q('SELECT id, verdict, score, type, substr(content,1,60) as preview, created_at FROM detections ORDER BY created_at DESC LIMIT 5');
  console.log('recent_5:', JSON.stringify(recentDets));

  // ── REVIEW QUEUE ────────────────────────────────────────────────────────────
  console.log('\n=== REVIEW_QUEUE ===');
  const rqCount = q1('SELECT COUNT(*) as n FROM review_queue');
  console.log('total_in_queue:', JSON.stringify(rqCount));
  const rqByStatus = q('SELECT status, COUNT(*) as n FROM review_queue GROUP BY status');
  console.log('by_status:', JSON.stringify(rqByStatus));
  const rqSample = q('SELECT id, detection_id, ai_verdict, human_verdict, score, confidence, status, created_at FROM review_queue ORDER BY created_at DESC LIMIT 5');
  console.log('latest_5:', JSON.stringify(rqSample));

  // Explain why queue may be empty
  const scoreRange = q('SELECT COUNT(*) as n FROM detections WHERE score >= 40 AND score <= 60');
  console.log('detections_score_40_60:', JSON.stringify(scoreRange));

  // ── REVIEW HISTORY ──────────────────────────────────────────────────────────
  console.log('\n=== REVIEW_HISTORY ===');
  const rhCount = q1('SELECT COUNT(*) as n FROM review_history');
  console.log('total_history:', JSON.stringify(rhCount));
  const rhSample = q('SELECT ai_verdict, human_verdict, date FROM review_history ORDER BY date DESC LIMIT 5');
  console.log('latest_5:', JSON.stringify(rhSample));

  // ── AI LEARNING CALCULATION ─────────────────────────────────────────────────
  console.log('\n=== AI_LEARNING_FROM_DB ===');
  const completed = q("SELECT ai_verdict, human_verdict FROM review_queue WHERE status = 'COMPLETED' AND human_verdict IS NOT NULL");
  const correct = completed.filter(c => c.ai_verdict === c.human_verdict).length;
  const wrong   = completed.filter(c => c.ai_verdict !== c.human_verdict).length;
  const fp      = completed.filter(c => c.ai_verdict !== 'SAFE' && c.human_verdict === 'SAFE').length;
  const fn      = completed.filter(c => c.ai_verdict === 'SAFE'  && c.human_verdict !== 'SAFE').length;
  const acc     = (correct + wrong) > 0 ? ((correct / (correct + wrong)) * 100).toFixed(1) + '%' : 'NO_COMPLETED_REVIEWS';
  console.log(JSON.stringify({ total_completed: completed.length, correct, wrong, false_positives: fp, false_negatives: fn, accuracy: acc }));

  // ── INTELLIGENCE EVENTS (TIMELINE) ─────────────────────────────────────────
  console.log('\n=== INTELLIGENCE_EVENTS ===');
  try {
    const evCount = q1('SELECT COUNT(*) as n FROM intelligence_events');
    console.log('total_events:', JSON.stringify(evCount));
    const evSample = q('SELECT event_type, entity_type, detection_id, verdict_before, verdict_after, actor, meta, created_at FROM intelligence_events ORDER BY created_at DESC LIMIT 10');
    console.log('latest_10:', JSON.stringify(evSample));
  } catch (e) {
    console.log('TABLE_MISSING OR ERROR:', e.message);
  }

  // ── THREAT INTELLIGENCE FROM DETECTIONS ─────────────────────────────────────
  console.log('\n=== THREAT_INTEL_FROM_DETECTIONS ===');
  const threatDets = q("SELECT content, keywords, verdict FROM detections WHERE verdict != 'SAFE' AND content IS NOT NULL LIMIT 200");
  const domainMap = {};
  threatDets.forEach(d => {
    const matches = (d.content || '').match(/https?:\/\/([^\/\s?#]{3,50})/g) || [];
    matches.forEach(u => {
      const dom = u.replace(/https?:\/\//, '').split('/')[0].toLowerCase();
      if (dom) domainMap[dom] = (domainMap[dom] || 0) + 1;
    });
  });
  const topDomains = Object.entries(domainMap).sort((a,b) => b[1]-a[1]).slice(0,5);
  console.log('top_domains_from_detections:', JSON.stringify(topDomains));

  const kwMap = {};
  threatDets.forEach(d => {
    let kws = [];
    try { kws = JSON.parse(d.keywords || '[]'); } catch {}
    kws.forEach(k => { kwMap[k] = (kwMap[k] || 0) + 1; });
  });
  const topKw = Object.entries(kwMap).sort((a,b) => b[1]-a[1]).slice(0,8);
  console.log('top_keywords_from_detections:', JSON.stringify(topKw));

  // ── THREAT INTEL FROM CORRECTIONS ─────────────────────────────────────────
  console.log('\n=== THREAT_INTEL_FROM_CORRECTIONS (review-based) ===');
  try {
    const domainEvents = q("SELECT meta FROM intelligence_events WHERE event_type = 'THREAT_DOMAIN_FLAGGED'");
    console.log('domain_flagged_events:', domainEvents.length);
    const kwEvents = q("SELECT meta FROM intelligence_events WHERE event_type = 'THREAT_KEYWORDS_FLAGGED'");
    console.log('keyword_flagged_events:', kwEvents.length);
  } catch(e) { console.log('No correction events yet:', e.message); }

  // ── BLOCKED SENDERS ─────────────────────────────────────────────────────────
  console.log('\n=== BLOCKED_SENDERS ===');
  const blCount = q1('SELECT COUNT(*) as n FROM blocked_senders');
  console.log('total:', JSON.stringify(blCount));
  const blByType = q('SELECT type, user_type, COUNT(*) as n FROM blocked_senders GROUP BY type, user_type');
  console.log('by_type:', JSON.stringify(blByType));
  const blSample = q('SELECT value, type, user_type, label, created_at FROM blocked_senders LIMIT 10');
  console.log('sample:', JSON.stringify(blSample));

  // ── RELATED INTELLIGENCE (for Detection Intelligence) ─────────────────────
  console.log('\n=== RELATED_INTELLIGENCE_TEST ===');
  const firstDet = q1('SELECT id, verdict FROM detections WHERE verdict != "SAFE" LIMIT 1');
  if (firstDet) {
    console.log('testing_with_detection:', JSON.stringify(firstDet));
    const related = q('SELECT id, verdict, score, category FROM detections WHERE verdict = ? AND id != ? AND created_at >= date("now","-30 days") ORDER BY score DESC LIMIT 5', [firstDet.verdict, firstDet.id]);
    console.log('related_detections_found:', JSON.stringify(related));
  } else {
    console.log('no_threat_detections_to_test');
  }

  console.log('\n=== AUDIT COMPLETE ===');
  db.close();
}

audit().catch(e => {
  console.error('AUDIT_ERROR:', e.message);
  console.error(e.stack);
});
