#!/usr/bin/env python3
"""Patch mockups-v2.html with missing features."""

import re

FILE = 'design/mockups-v2.html'

with open(FILE, 'r') as f:
    content = f.read()

# ============ 1. CSS additions ============
new_css = """
/* AutomationHeader */
.automation-header{padding:16px;border-bottom:1px solid var(--border-soft);background:var(--bg-1)}
.ah-top{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
.ah-avatar{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:20px;flex-shrink:0;border:1px solid rgba(255,255,255,.08)}
.ah-info{flex:1;min-width:0}
.ah-info .ah-name{font-size:15px;font-weight:600;display:flex;align-items:center;gap:7px}
.ah-info .ah-name .status-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
.ah-info .ah-name .status-dot.live{background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 2s ease-in-out infinite}
.ah-info .ah-name .status-dot.stopped{background:var(--text-dim)}
.ah-info .ah-role{font-size:12px;color:var(--text-dim);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ah-actions{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
.ah-actions .ah-btn{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:7px;font-size:11px;font-weight:500;border:1px solid var(--border);background:var(--bg-2);color:var(--text-mute);cursor:pointer;transition:.12s}
.ah-actions .ah-btn:hover{background:var(--bg-3);color:var(--text);border-color:var(--border-strong)}
.ah-actions .ah-btn.primary{background:var(--grad-primary);border:0;color:#fff;box-shadow:0 2px 8px rgba(59,130,246,.3)}
.ah-actions .ah-btn.primary:hover{box-shadow:0 4px 14px rgba(59,130,246,.4);transform:scale(1.02)}
.ah-actions .ah-btn.pause{background:rgba(251,191,36,.12);border-color:rgba(251,191,36,.2);color:var(--amber)}
.ah-actions .ah-btn.pause:hover{background:rgba(251,191,36,.18)}
.ah-actions .ah-btn svg{width:13px;height:13px}
.ah-stats{display:flex;gap:8px;margin-top:12px}
.ah-stat{flex:1;background:var(--bg-2);border:1px solid var(--border);border-radius:9px;padding:8px 10px;text-align:center}
.ah-stat .v{font-size:16px;font-weight:600;font-family:'JetBrains Mono',monospace}
.ah-stat .v.green{color:var(--green)}
.ah-stat .v.amber{color:var(--amber)}
.ah-stat .l{font-size:10px;color:var(--text-dim);margin-top:2px;text-transform:uppercase;letter-spacing:.05em}

/* Breadcrumb */
.breadcrumb{display:flex;align-items:center;gap:6px;padding:8px 16px;font-size:12px;color:var(--text-dim);border-bottom:1px solid var(--border-soft);background:var(--bg-0)}
.breadcrumb span{cursor:pointer;transition:.12s;white-space:nowrap}
.breadcrumb span:hover{color:var(--cyan)}
.breadcrumb .sep{color:var(--text-dim);cursor:default;pointer-events:none}

/* Login notice bar */
.login-notice{display:flex;align-items:center;gap:10px;padding:8px 16px;font-size:12px;background:rgba(251,191,36,.08);border-bottom:1px solid rgba(251,191,36,.15);color:var(--amber)}
.login-notice svg{width:14px;height:14px;flex-shrink:0}
.login-notice span{flex:1}
.login-notice button{font-size:11px;padding:3px 10px;border-radius:5px;border:1px solid rgba(251,191,36,.3);background:rgba(251,191,36,.1);color:var(--amber);cursor:pointer;transition:.12s;white-space:nowrap}
.login-notice button:hover{background:rgba(251,191,36,.2)}
.login-notice .dismiss{background:transparent;border:0;padding:2px;color:var(--text-dim);cursor:pointer}
.login-notice .dismiss:hover{color:var(--text)}

/* Apps page */
.apps-layout{display:flex;height:100%;width:100%}
.apps-sidebar{width:220px;background:var(--bg-1);border-right:1px solid var(--border-soft);display:flex;flex-direction:column;flex-shrink:0}
.apps-sidebar .as-title{padding:18px 16px 12px;font-size:14px;font-weight:600;display:flex;align-items:center;gap:10px}
.apps-sidebar .as-title svg{width:16px;height:16px;color:var(--text-dim)}
.apps-tabs{display:flex;padding:0 10px 10px;gap:4px;flex-wrap:wrap}
.apps-tab{padding:6px 10px;border-radius:7px;font-size:12px;font-weight:500;border:1px solid var(--border);background:transparent;color:var(--text-mute);cursor:pointer;transition:.12s}
.apps-tab:hover{background:var(--bg-2);color:var(--text)}
.apps-tab.active{background:var(--bg-3);border-color:var(--border-strong);color:var(--text)}
.apps-list{flex:1;overflow-y:auto;padding:6px 10px}
.apps-group{font-size:11px;color:var(--text-dim);font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:10px 6px 5px}
.apps-item{display:flex;align-items:center;gap:10px;padding:10px;border-radius:9px;cursor:pointer;transition:.12s;border:1px solid transparent;font-size:13px}
.apps-item:hover{background:var(--bg-2)}
.apps-item.active{background:var(--bg-3);border-color:var(--border)}
.apps-item .ai-icon{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;font-size:14px;flex-shrink:0}
.apps-item .ai-body{flex:1;min-width:0}
.apps-item .ai-name{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.apps-item .ai-sub{font-size:11px;color:var(--text-dim);margin-top:1px}
.apps-main{flex:1;display:flex;flex-direction:column;min-width:0;background:var(--bg-1)}
.apps-detail{padding:24px 32px;overflow-y:auto}
.apps-detail-head{display:flex;gap:16px;align-items:flex-start;margin-bottom:24px}
.apps-detail-icon{width:56px;height:56px;border-radius:14px;display:grid;place-items:center;font-size:26px;flex-shrink:0;border:1px solid rgba(255,255,255,.08)}
.apps-detail-info{flex:1}
.apps-detail-info h2{font-size:20px;font-weight:600;letter-spacing:-.02em}
.apps-detail-info .ver{font-size:12px;color:var(--text-dim);font-family:'JetBrains Mono',monospace;margin-top:2px}
.apps-detail-info .author{font-size:13px;color:var(--text-mute);margin-top:4px}
.apps-detail-desc{font-size:14px;color:var(--text);line-height:1.7;margin-bottom:24px;max-width:720px}
.apps-detail-section{margin-bottom:28px}
.apps-detail-section h3{font-size:13px;font-weight:600;color:var(--text-mute);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px}
.apps-perm{display:flex;flex-direction:column;gap:8px}
.apps-perm-row{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;font-size:13px}
.apps-perm-row .perm-icon{width:20px;text-align:center;color:var(--text-dim)}
.apps-actions{display:flex;gap:10px;margin-top:8px}
.btn.sm{padding:6px 12px;border-radius:8px;font-size:12px;font-weight:500;cursor:pointer;border:1px solid var(--border);background:var(--bg-2);color:var(--text);transition:.15s;display:flex;align-items:center;gap:6px}
.btn.sm:hover{background:var(--bg-3)}
.btn.sm.primary{background:var(--grad-primary);border:0;color:#fff;box-shadow:0 4px 16px rgba(59,130,246,.3)}
.btn.sm.primary:hover{box-shadow:0 6px 20px rgba(59,130,246,.4)}
.btn.sm.danger{border-color:rgba(251,113,133,.3);color:var(--rose);background:rgba(251,113,133,.08)}
.btn.sm.danger:hover{background:rgba(251,113,133,.15)}
.btn.sm svg{width:14px;height:14px}

/* Store detail */
.store-detail{padding:32px;overflow-y:auto}
.store-detail-head{display:flex;gap:18px;align-items:flex-start;margin-bottom:28px}
.store-detail-icon{width:64px;height:64px;border-radius:16px;display:grid;place-items:center;font-size:32px;flex-shrink:0;border:1px solid rgba(255,255,255,.08)}
"""

anchor = '.act-list{flex:1;overflow-y:auto;padding:8px}'
if anchor in content:
    content = content.replace(anchor, new_css + '\n' + anchor, 1)
    print('CSS inserted before .act-list')
else:
    print('ERROR: CSS anchor not found')

# ============ 2. Replace d-dh-chat .ah block ============
old_ah = '''          <div class="ah">
            <div class="name"><div class="av dha-1">📈</div> Market Watcher</div>
            <div class="role">Stock board screener · running</div>
            <div class="stat"><div class="s"><div class="v green">12</div><div class="l">runs today</div></div><div class="s"><div class="v">3</div><div class="l">alerts</div></div><div class="s"><div class="v">98%</div><div class="l">success</div></div></div>
          </div>'''

new_ah = '''          <div class="automation-header">
            <div class="ah-top">
              <div class="ah-avatar dha-1">📈</div>
              <div class="ah-info">
                <div class="ah-name"><span class="status-dot live"></span>Market Watcher<span style="font-size:11px;color:var(--text-dim);font-weight:400;margin-left:4px">by Meco Team</span></div>
                <div class="ah-role">Stock board screener · running</div>
                <div class="ah-actions">
                  <button class="ah-btn primary" onclick="toast('Triggered (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="6,3 20,12 6,21" stroke-linejoin="round"/></svg>Trigger</button>
                  <button class="ah-btn pause" onclick="toast('Paused (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>Pause</button>
                  <button class="ah-btn" onclick="toast('Retrying (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-2-6.3M21 3v6h-6" stroke-linecap="round" stroke-linejoin="round"/></svg>Retry</button>
                  <button class="ah-btn" onclick="toast('Open browser (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" stroke-linecap="round"/></svg>Browser</button>
                  <button class="ah-btn" onclick="toast('Open workspace (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Workspace</button>
                </div>
              </div>
            </div>
            <div class="ah-stats">
              <div class="ah-stat"><div class="v green">12</div><div class="l">runs today</div></div>
              <div class="ah-stat"><div class="v amber">3</div><div class="l">alerts</div></div>
              <div class="ah-stat"><div class="v">98%</div><div class="l">success</div></div>
            </div>
          </div>'''

if old_ah in content:
    content = content.replace(old_ah, new_ah, 1)
    print('.ah block replaced in d-dh-chat')
else:
    print('ERROR: old .ah block not found')

# ============ 3. Insert breadcrumb + LoginNoticeBar ============
old_insert_point = '''        <!-- Center -->
        <div class="dh-center">
          <div class="dh-tabs">'''

new_insert = '''        <!-- Breadcrumb -->
        <div class="breadcrumb"><span onclick="go('humans')">Digital Humans</span><span class="sep">/</span><span>Market Watcher</span></div>
        <!-- Login notice -->
        <div class="login-notice" id="dhLoginNotice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke-linejoin="round"/></svg>
          <span>Browser session expired — log in again to continue browser actions.</span>
          <button onclick="toast('Login flow (demo)')">Log in</button>
          <button class="dismiss" onclick="this.parentElement.style.display='none'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg></button>
        </div>
        <!-- Center -->
        <div class="dh-center">
          <div class="dh-tabs">'''

if old_insert_point in content:
    content = content.replace(old_insert_point, new_insert, 1)
    print('breadcrumb + login notice inserted')
else:
    print('ERROR: insert point not found')

# ============ 4. Update DH Chat InputArea toolbar ============
old_input = '''              <div class="input-bar"><button class="ib-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg></button><button class="ib-btn active" onclick="toggleBtn(this)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 00-7 7c0 3 2 5 2 7h10c0-2 2-4 2-7a7 7 0 00-7-7z" stroke-linejoin="round"/></svg><span>Thinking</span></button><button class="send-btn" onclick="sendDh('d')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>'''

new_input = '''              <div class="input-bar">
                <button class="ib-btn" onclick="toast('Attach (demo)')" title="Attach"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg></button>
                <button class="ib-btn" id="dWebCtrl" onclick="toggleBtn(this);toggleStop(this)" title="Web Control"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" stroke-linecap="round"/></svg><span>Web</span></button>
                <button class="ib-btn active" id="dDeepThink" onclick="toggleBtn(this);toggleStop(this)" title="Deep Thinking"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 00-7 7c0 3 2 5 2 7h10c0-2 2-4 2-7a7 7 0 00-7-7z" stroke-linejoin="round"/><path d="M9 21h6" stroke-linecap="round"/></svg><span>Think</span></button>
                <button class="ib-btn" id="dDhStop" onclick="toast('Stopped (demo)')" title="Stop" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="5" width="12" height="14" rx="2"/></svg></button>
                <button class="ib-btn" onclick="toast('Voice input (demo)')" title="Microphone"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="19" x2="12" y2="23" stroke-linecap="round"/><line x1="8" y1="23" x2="16" y2="23" stroke-linecap="round"/></svg></button>
                <button class="send-btn" onclick="sendDh('d')" title="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              </div>'''

if old_input in content:
    content = content.replace(old_input, new_input, 1)
    print('DH Chat input toolbar updated')
else:
    print('ERROR: old input bar not found')

# ============ 5. Add Apps page screen after d-store ============
apps_html = '''
    <!-- ===== DESKTOP APPS PAGE ===== -->
    <div class="screen" id="d-apps">
      <div class="apps-layout">
        <div class="apps-sidebar">
          <div class="as-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Apps</div>
          <div class="apps-tabs">
            <button class="apps-tab active" onclick="pickAppsTab(this,'my-humans')">My Digital Humans</button>
            <button class="apps-tab" onclick="pickAppsTab(this,'my-skills')">My Skills</button>
            <button class="apps-tab" onclick="pickAppsTab(this,'my-mcp')">My MCP</button>
            <button class="apps-tab" onclick="pickAppsTab(this,'marketplace')">Marketplace</button>
          </div>
          <div class="apps-list" id="appsList">
            <!-- My Humans -->
            <div class="apps-group" data-tab="my-humans">Running</div>
            <div class="apps-item active" data-tab="my-humans" onclick="showAppDetail(this,'market-watcher')"><div class="ai-icon" style="background:linear-gradient(135deg,#3b82f6,#1e40af);color:#fff">📈</div><div class="ai-body"><div class="ai-name">Market Watcher</div><div class="ai-sub">12 runs today · WeCom</div></div></div>
            <div class="apps-item" data-tab="my-humans" onclick="showAppDetail(this,'news-digest')"><div class="ai-icon" style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff">📰</div><div class="ai-body"><div class="ai-name">News Digest</div><div class="ai-sub">Running · Email</div></div></div>
            <div class="apps-item" data-tab="my-humans" onclick="showAppDetail(this,'support-triage')"><div class="ai-icon" style="background:linear-gradient(135deg,#10b981,#22d3ee);color:#fff">🤖</div><div class="ai-body"><div class="ai-name">Support Triage</div><div class="ai-sub">Scheduled · Tickets</div></div></div>
            <div class="apps-group" data-tab="my-humans">Installed</div>
            <div class="apps-item" data-tab="my-humans" onclick="showAppDetail(this,'research-scout')"><div class="ai-icon" style="background:linear-gradient(135deg,#22d3ee,#0e7490);color:#fff">🔍</div><div class="ai-body"><div class="ai-name">Research Scout</div><div class="ai-sub">v1.4.2 · weekly report</div></div></div>
            <!-- My Skills -->
            <div class="apps-item" data-tab="my-skills" onclick="showAppDetail(this,'doc-writer')"><div class="ai-icon" style="background:linear-gradient(135deg,#a78bfa,#6d28d9);color:#fff">📝</div><div class="ai-body"><div class="ai-name">Doc Writer</div><div class="ai-sub">Markdown docs from code</div></div></div>
            <div class="apps-item" data-tab="my-skills" onclick="showAppDetail(this,'data-viz')"><div class="ai-icon" style="background:linear-gradient(135deg,#10b981,#22d3ee);color:#fff">📊</div><div class="ai-body"><div class="ai-name">Data Viz</div><div class="ai-sub">CSV/JSON charts</div></div></div>
            <!-- My MCP -->
            <div class="apps-item" data-tab="my-mcp" onclick="showAppDetail(this,'web-scraper')"><div class="ai-icon" style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff">🌐</div><div class="ai-body"><div class="ai-name">Web Scraper</div><div class="ai-sub">Browser automation MCP</div></div></div>
            <!-- Marketplace -->
            <div class="apps-item" data-tab="marketplace" onclick="showAppDetail(this,'code-reviewer')"><div class="ai-icon" style="background:linear-gradient(135deg,#22d3ee,#3b82f6);color:#fff">🔎</div><div class="ai-body"><div class="ai-name">Code Reviewer</div><div class="ai-sub">Automated PR reviews</div></div></div>
            <div class="apps-item" data-tab="marketplace" onclick="showAppDetail(this,'translation')"><div class="ai-icon" style="background:linear-gradient(135deg,#86efac,#059669);color:#fff">🌍</div><div class="ai-body"><div class="ai-name">Translation Pack</div><div class="ai-sub">50+ locales</div></div></div>
          </div>
        </div>
        <div class="apps-main">
          <div class="apps-detail" id="appsDetail">
            <div class="apps-detail-head">
              <div class="apps-detail-icon" style="background:linear-gradient(135deg,#3b82f6,#1e40af);color:#fff">📈</div>
              <div class="apps-detail-info">
                <h2>Market Watcher</h2>
                <div class="ver">v2.1.0 · by Meco Team</div>
                <div class="author">Automation · Finance · WeCom integration</div>
              </div>
            </div>
            <div class="apps-detail-desc">Scans A-share limit-up candidates every 30 minutes during market hours. Automatically pushes high-confidence picks to your WeCom group with context and charts.</div>
            <div class="apps-detail-section">
              <h3>Permissions</h3>
              <div class="apps-perm">
                <div class="apps-perm-row"><span class="perm-icon">🌐</span> Browser automation — read exchange pages</div>
                <div class="apps-perm-row"><span class="perm-icon">💬</span> WeCom push — send alerts to group</div>
                <div class="apps-perm-row"><span class="perm-icon">📊</span> File read — access local watchlists</div>
                <div class="apps-perm-row"><span class="perm-icon">🧠</span> Memory — store scan history</div>
              </div>
            </div>
            <div class="apps-detail-section">
              <h3>Schedule</h3>
              <div class="apps-perm">
                <div class="apps-perm-row"><span class="perm-icon">⏰</span> Frequency: every 30m</div>
                <div class="apps-perm-row"><span class="perm-icon">🏙️</span> Timezone: Asia/Shanghai</div>
                <div class="apps-perm-row"><span class="perm-icon">📈</span> Next run: 14:30 today</div>
              </div>
            </div>
            <div class="apps-actions">
              <button class="sm primary" onclick="go('dh-chat')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linejoin="round"/></svg>Open Chat</button>
              <button class="sm" onclick="toast('Configure (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M4.5 4.5l4 4M15.5 15.5l4 4M1 12h6M17 12h6" stroke-linecap="round"/></svg>Configure</button>
              <button class="sm danger" onclick="toast('Uninstall (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg>Uninstall</button>
            </div>
          </div>
        </div>
      </div>
    </div>
'''

# Insert after d-store closing tag
store_end = '''    </div>
  </div>
</div>

<!-- ============ MOBILE STAGE ============ -->'''
if store_end in content:
    content = content.replace(store_end, '    </div>\n  </div>\n</div>\n' + apps_html + '\n<!-- ============ MOBILE STAGE ============ -->', 1)
    print('Apps page inserted after d-store')
else:
    print('ERROR: store_end anchor not found')

# ============ 6. Update JS go() and urlMap ============
old_urlmap = "const urlMap={home:'app.meco.dev / home', 'space-chat':'app.meco.dev / space / meco-core', 'dh-chat':'app.meco.dev / apps / market-watcher', 'settings':'app.meco.dev / settings', 'store':'app.meco.dev / store'};"
new_urlmap = "const urlMap={home:'app.meco.dev / home', spaces:'app.meco.dev / spaces', humans:'app.meco.dev / humans / digital-humans', 'space-chat':'app.meco.dev / space / meco-core', 'dh-chat':'app.meco.dev / apps / market-watcher', settings:'app.meco.dev / settings', store:'app.meco.dev / store', apps:'app.meco.dev / apps'};"
if old_urlmap in content:
    content = content.replace(old_urlmap, new_urlmap, 1)
    print('urlMap updated')
else:
    print('ERROR: urlMap not found')

old_go_switch = '''  if(curDevice!=='mobile'){
    const base = curDevice==='web' ? 'https://remote.meco.dev / ' : 'app.meco.dev / ';
    const screen=curScreen;
    document.getElementById('desktopUrl').textContent = base + (screen==='home'?'home':screen==='spaces'?'spaces':screen==='humans'?'humans':screen==='space-chat'?'space / meco-core':screen==='dh-chat'?'humans / market-watcher':screen==='settings'?'settings':screen==='store'?'store':'unknown');'''
new_go_switch = '''  if(curDevice!=='mobile'){
    const base = curDevice==='web' ? 'https://remote.meco.dev / ' : 'app.meco.dev / ';
    const screen=curScreen;
    document.getElementById('desktopUrl').textContent = base + (screen==='home'?'home':screen==='spaces'?'spaces':screen==='humans'?'humans / digital-humans':screen==='space-chat'?'space / meco-core':screen==='dh-chat'?'apps / market-watcher':screen==='settings'?'settings':screen==='store'?'store':screen==='apps'?'apps':'unknown');'''
if old_go_switch in content:
    content = content.replace(old_go_switch, new_go_switch, 1)
    print('go() switch updated')
else:
    print('ERROR: go() switch not found')

# ============ 7. Add apps helper JS functions ============
old_pick_store_cat = "function pickStoreCat(el){"
new_js = """function pickAppsTab(el,tab){ el.parentNode.querySelectorAll('.apps-tab').forEach(b=>b.classList.remove('active')); el.classList.add('active'); document.querySelectorAll('#appsList .apps-item').forEach(i=>i.style.display=(i.dataset.tab===tab||(!i.dataset.tab&&tab==='marketplace'))?'flex':'none'); document.querySelectorAll('#appsList .apps-group').forEach(g=>g.style.display=g.dataset.tab===tab?'block':'none'); }
function showAppDetail(el,app){ document.querySelectorAll('#appsList .apps-item').forEach(i=>i.classList.remove('active')); el.classList.add('active'); toast('App: '+el.querySelector('.ai-name').textContent+' (demo)'); }
function pickStoreCat(el){"""
if old_pick_store_cat in content:
    content = content.replace(old_pick_store_cat, new_js, 1)
    print('apps JS helpers added')
else:
    print('ERROR: pickStoreCat anchor not found')

# ============ 8. Update mobile DH Chat header ============
old_mobile_dh_head = '''        <div class="m-chat-head">
          <button class="back" onclick="go('humans')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div class="title"><div class="t">📈 Market Watcher</div><div class="s"><span class="pulse-dot green" style="width:5px;height:5px"></span> running · next 14:30</div></div>
          <button class="icon" onclick="togglePanel('sessPanel')" title="Conversations"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linejoin="round"/></svg></button>
          <button class="icon" onclick="toast('Pause (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button>
        </div>'''

new_mobile_dh_head = '''        <div class="m-chat-head">
          <button class="back" onclick="go('humans')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div style="flex:1;min-width:0"><div class="t" style="font-size:14px;font-weight:600">📈 Market Watcher</div><div class="s" style="font-size:10px"><span class="pulse-dot green" style="width:4px;height:4px"></span> Running · 12 runs · WeCom</div></div>
          <button class="icon" onclick="togglePanel('sessPanel')" title="Conversations"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke-linejoin="round"/></svg></button>
          <button class="icon" onclick="toast('Pause (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button>
        </div>
        <div class="breadcrumb" style="font-size:11px"><span onclick="go('humans')">Digital Humans</span><span class="sep">/</span><span>Market Watcher</span></div>
        <div class="login-notice" style="font-size:11px;padding:6px 12px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" stroke-linejoin="round"/></svg>
          <span>Browser session expired — log in again.</span>
          <button style="font-size:10px;padding:2px 8px" onclick="toast('Login flow (demo)')">Log in</button>
          <button class="dismiss" onclick="this.parentElement.style.display='none'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/></svg></button>
        </div>'''

if old_mobile_dh_head in content:
    content = content.replace(old_mobile_dh_head, new_mobile_dh_head, 1)
    print('Mobile DH chat header updated')
else:
    print('ERROR: mobile DH head not found')

# ============ 9. Update mobile DH input toolbar ============
old_mobile_input = '''              <div class="m-input-bar"><button class="ib"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg></button><button class="send" onclick="sendDh('m')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>'''

new_mobile_input = '''              <div class="m-input-bar">
                <button class="ib" onclick="toast('Attach (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg></button>
                <button class="ib" style="color:var(--cyan)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 00-7 7c0 3 2 5 2 7h10c0-2 2-4 2-7a7 7 0 00-7-7z" stroke-linejoin="round"/></svg></button>
                <button class="ib"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18" stroke-linecap="round"/></svg></button>
                <button class="send" onclick="sendDh('m')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              </div>'''

if old_mobile_input in content:
    content = content.replace(old_mobile_input, new_mobile_input, 1)
    print('Mobile DH input toolbar updated')
else:
    print('ERROR: mobile DH input not found')

# ============ 10. Update Space Chat header ============
old_space_header = '''          <div class="chat-header">
            <button class="icon-btn" onclick="go('spaces')" title="Back"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <div class="space-tag"><div class="si si-1">🚀</div><span>Meco Core</span></div>
            <span class="crumb">/ Refactor config service</span>
            <div class="actions">
              <div class="model-pill" onclick="toast('Model selector (demo)')"><span class="dot"></span><span>Claude Sonnet 4.5</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
              <button class="icon-btn" onclick="toast('Search in conversation (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg></button>
              <button class="icon-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
            </div>
          </div>'''

new_space_header = '''          <div class="chat-header">
            <button class="icon-btn" onclick="go('spaces')" title="Back to list"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            <div class="space-tag" style="cursor:pointer" onclick="toast('Space selector (demo)')"><div class="si si-1">🚀</div><span>Meco Core</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            <span class="crumb">/ Refactor config service</span>
            <div class="actions">
              <button class="icon-btn" onclick="toast('New conversation (demo)')" title="New chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg></button>
              <div class="model-pill" onclick="toast('Model selector (demo)')"><span class="dot"></span><span>Claude Sonnet 4.5</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
              <button class="icon-btn" onclick="toast('Search in conversation (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" stroke-linecap="round"/></svg></button>
              <button class="icon-btn" onclick="toast('Conversation settings (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M4.5 4.5l4 4M15.5 15.5l4 4M1 12h6M17 12h6" stroke-linecap="round"/></svg></button>
            </div>
          </div>'''

if old_space_header in content:
    content = content.replace(old_space_header, new_space_header, 1)
    print('Space chat header updated')
else:
    print('ERROR: space chat header not found')

# ============ 11. Update mobile space chat header ============
old_mobile_space = '''        <div class="m-chat-head">
          <button class="back" onclick="go('spaces')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div class="title"><div class="t">Refactor config service</div><div class="s"><span class="pulse-dot green" style="width:5px;height:5px"></span> Meco Core · Sonnet 4.5</div></div>
          <button class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 109-9 9 9 0 00-9 9z M12 7v5l3 2" stroke-linecap="round"/></svg></button>
          <button class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
        </div>'''

new_mobile_space = '''        <div class="m-chat-head">
          <button class="back" onclick="go('spaces')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div style="flex:1;min-width:0"><div class="title" style="margin-bottom:2px"><div class="t" style="font-size:14px;font-weight:600">Refactor config service</div></div><div class="s" style="font-size:10px"><span class="pulse-dot green" style="width:4px;height:4px"></span> Meco Core · Sonnet 4.5</div></div>
          <button class="icon" onclick="toast('New chat (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg></button>
          <button class="icon" onclick="toast('Model selector (demo)')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>'''

if old_mobile_space in content:
    content = content.replace(old_mobile_space, new_mobile_space, 1)
    print('Mobile space chat header updated')
else:
    print('ERROR: mobile space chat header not found')

with open(FILE, 'w') as f:
    f.write(content)
print('Done — file written successfully')
