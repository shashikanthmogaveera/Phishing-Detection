$base = "C:\Users\amash\Desktop\PROJECT_6\AI-Powered Spam & Phishing Detection System"

# ── admin.css ────────────────────────────────────────────────
$css = '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:''Inter'',sans-serif;background:#080c14;color:#e2e8f0;overflow:hidden}
a{text-decoration:none;color:inherit}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0d1117}::-webkit-scrollbar-thumb{background:#2d3748;border-radius:3px}

.ap-layout{display:flex;height:100vh;overflow:hidden}

/* SIDEBAR */
.ap-sidebar{width:220px;flex-shrink:0;background:rgba(0,0,0,0.5);border-right:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;padding:0}
.ap-logo{display:flex;align-items:center;gap:10px;padding:20px 16px;border-bottom:1px solid rgba(255,255,255,0.06)}
.logo-icon{width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(99,179,237,0.08);border:1px solid rgba(99,179,237,0.2);border-radius:8px;flex-shrink:0}
.logo-text{font-size:.95rem;font-weight:700;color:#e2e8f0;letter-spacing:-.02em;display:block}
.logo-ai{color:#63b3ed}
.logo-sub{font-size:.65rem;color:#4a5568;font-weight:500;letter-spacing:.06em;text-transform:uppercase;display:block}
.ap-nav{display:flex;flex-direction:column;gap:2px;padding:16px 10px;flex:1}
.ap-nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;font-size:.83rem;font-weight:500;color:#4a5568;border-radius:8px;transition:all .2s;cursor:pointer}
.ap-nav-item:hover{color:#a0aec0;background:rgba(255,255,255,0.04)}
.ap-nav-item.active{color:#63b3ed;background:rgba(99,179,237,0.08);border:1px solid rgba(99,179,237,0.12)}
.ap-sidebar-footer{padding:12px 10px;border-top:1px solid rgba(255,255,255,0.06)}
.ap-admin-info{display:flex;align-items:center;gap:10px;padding:8px}
.ap-avatar{width:32px;height:32px;background:rgba(246,173,85,0.1);border:1px solid rgba(246,173,85,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ap-admin-name{font-size:.82rem;font-weight:600;color:#e2e8f0}
.ap-admin-role{font-size:.68rem;color:#f6ad55;font-weight:500}
.ap-logout{background:none;border:none;cursor:pointer;color:#4a5568;padding:6px;border-radius:6px;transition:color .2s;margin-left:auto}
.ap-logout:hover{color:#fc8181}

/* MAIN */
.ap-main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.ap-topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.2);flex-shrink:0}
.ap-page-title{font-size:1.3rem;font-weight:800;color:#f7fafc;letter-spacing:-.02em}
.ap-page-sub{font-size:.78rem;color:#4a5568;margin-top:2px}
.ap-topbar-right{display:flex;align-items:center;gap:14px}
.ap-status{display:flex;align-items:center;gap:6px;font-size:.75rem;color:#68d391;font-weight:500}
.pulse-dot{width:6px;height:6px;background:#68d391;border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.3)}}
.ap-admin-chip{display:flex;align-items:center;gap:6px;padding:5px 12px;background:rgba(246,173,85,0.08);border:1px solid rgba(246,173,85,0.2);border-radius:20px;font-size:.78rem;font-weight:600;color:#f6ad55}

/* SECTIONS */
.ap-section{display:none;flex:1;overflow-y:auto;padding:24px 28px}
.ap-section.active{display:block}

/* STAT CARDS */
.ap-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:20px}
.ap-stat-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px;display:flex;align-items:center;gap:14px;transition:all .2s}
.ap-stat-card:hover{border-color:rgba(99,179,237,0.15);transform:translateY(-2px)}
.ap-stat-icon{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);flex-shrink:0}
.ap-stat-val{font-size:1.5rem;font-weight:800;color:#f7fafc;font-family:''JetBrains Mono'',monospace;line-height:1}
.ap-stat-label{font-size:.72rem;color:#4a5568;margin-top:4px}

/* CARDS */
.ap-row-2{display:grid;grid-template-columns:1fr 1.4fr;gap:16px}
.ap-card{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px}
.ap-card-title{font-size:.82rem;font-weight:600;color:#718096;margin-bottom:16px;text-transform:uppercase;letter-spacing:.06em}
.ap-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.ap-badge{font-size:.65rem;font-weight:700;color:#68d391;background:rgba(104,211,145,0.1);border:1px solid rgba(104,211,145,0.2);padding:3px 8px;border-radius:20px;letter-spacing:.05em}

/* CHART */
.chart-bars{display:flex;align-items:flex-end;gap:10px;height:120px}
.chart-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end}
.chart-bar{width:100%;border-radius:4px 4px 0 0;min-height:8px}
.chart-bar-wrap span{font-size:.62rem;color:#4a5568}

/* ACTIVITY */
.ap-activity{display:flex;flex-direction:column;gap:10px}
.ap-activity-item{display:flex;align-items:center;gap:10px;font-size:.8rem}
.act-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.act-dot.green{background:#68d391}.act-dot.blue{background:#63b3ed}.act-dot.red{background:#fc8181}.act-dot.orange{background:#f6ad55}
.act-text{flex:1;color:#a0aec0}
.act-time{font-size:.7rem;color:#4a5568;white-space:nowrap}

/* TABLE */
.ap-search-wrap{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:7px;padding:6px 12px}
.ap-search-wrap input{background:none;border:none;outline:none;font-size:.82rem;color:#e2e8f0;font-family:''Inter'',sans-serif;width:180px}
.ap-search-wrap input::placeholder{color:#4a5568}
.ap-search-wrap svg{color:#4a5568;flex-shrink:0}
.ap-table-wrap{overflow-x:auto}
.ap-table{width:100%;border-collapse:collapse;font-size:.82rem}
.ap-table th{text-align:left;padding:10px 12px;font-size:.7rem;font-weight:700;color:#4a5568;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid rgba(255,255,255,0.06)}
.ap-table td{padding:11px 12px;color:#a0aec0;border-bottom:1px solid rgba(255,255,255,0.04)}
.ap-table tr:last-child td{border-bottom:none}
.ap-table tr:hover td{background:rgba(255,255,255,0.02)}
.ap-empty{text-align:center;color:#4a5568;padding:32px!important}
.badge-danger{font-size:.65rem;font-weight:700;color:#fc8181;background:rgba(252,129,129,0.1);border:1px solid rgba(252,129,129,0.2);padding:2px 7px;border-radius:4px}
.badge-warn{font-size:.65rem;font-weight:700;color:#f6ad55;background:rgba(246,173,85,0.1);border:1px solid rgba(246,173,85,0.2);padding:2px 7px;border-radius:4px}
.badge-safe{font-size:.65rem;font-weight:700;color:#68d391;background:rgba(104,211,145,0.1);border:1px solid rgba(104,211,145,0.2);padding:2px 7px;border-radius:4px}
.badge-blocked{font-size:.65rem;font-weight:600;color:#fc8181;background:rgba(252,129,129,0.08);padding:2px 7px;border-radius:4px}
.badge-safe-s{font-size:.65rem;font-weight:600;color:#68d391;background:rgba(104,211,145,0.08);padding:2px 7px;border-radius:4px}

/* AI SIGNALS */
.ai-signals{display:flex;flex-direction:column;gap:12px}
.ai-signal{display:flex;align-items:center;gap:12px}
.signal-label{font-size:.78rem;color:#718096;width:220px;flex-shrink:0}
.signal-bar{flex:1;height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden}
.signal-bar div{height:100%;border-radius:3px}
.signal-pct{font-size:.72rem;font-weight:600;color:#a0aec0;font-family:''JetBrains Mono'',monospace;width:36px;text-align:right;flex-shrink:0}

/* SETTINGS */
.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.setting-item{background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px}
.setting-label{font-size:.7rem;color:#4a5568;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.setting-val{font-size:.88rem;color:#a0aec0;font-weight:500}
.role-badge{font-size:.72rem;font-weight:700;color:#f6ad55;background:rgba(246,173,85,0.1);border:1px solid rgba(246,173,85,0.2);padding:3px 10px;border-radius:20px}
.secret-mask{font-family:''JetBrains Mono'',monospace;letter-spacing:.1em;color:#4a5568}
.ap-logout-btn{display:flex;align-items:center;gap:8px;padding:10px 20px;background:rgba(252,129,129,0.08);border:1px solid rgba(252,129,129,0.2);color:#fc8181;border-radius:8px;font-size:.85rem;font-weight:600;cursor:pointer;font-family:''Inter'',sans-serif;transition:all .2s}
.ap-logout-btn:hover{background:rgba(252,129,129,0.15)}

@media(max-width:900px){.ap-stats-grid{grid-template-columns:1fr 1fr}.ap-row-2{grid-template-columns:1fr}.settings-grid{grid-template-columns:1fr}}
@media(max-width:600px){.ap-sidebar{display:none}.ap-section{padding:16px}}'
[System.IO.File]::WriteAllText("$base\admin.css", $css)
Write-Host "admin.css OK:" (Get-Item "$base\admin.css").Length
