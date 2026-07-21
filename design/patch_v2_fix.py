#!/usr/bin/env python3
"""Fix remaining patch failures."""

FILE = 'design/mockups-v2.html'

with open(FILE, 'r') as f:
    content = f.read()

# ============ Fix 1: Insert apps page ============
apps_html = '''    <!-- ===== DESKTOP APPS PAGE ===== -->
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
            <div class="apps-group" data-tab="my-humans">Running</div>
            <div class="apps-item active" data-tab="my-humans" onclick="showAppDetail(this,'market-watcher')"><div class="ai-icon" style="background:linear-gradient(135deg,#3b82f6,#1e40af);color:#fff">📈</div><div class="ai-body"><div class="ai-name">Market Watcher</div><div class="ai-sub">12 runs today · WeCom</div></div></div>
            <div class="apps-item" data-tab="my-humans" onclick="showAppDetail(this,'news-digest')"><div class="ai-icon" style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff">📰</div><div class="ai-body"><div class="ai-name">News Digest</div><div class="ai-sub">Running · Email</div></div></div>
            <div class="apps-item" data-tab="my-humans" onclick="showAppDetail(this,'support-triage')"><div class="ai-icon" style="background:linear-gradient(135deg,#10b981,#22d3ee);color:#fff">🤖</div><div class="ai-body"><div class="ai-name">Support Triage</div><div class="ai-sub">Scheduled · Tickets</div></div></div>
            <div class="apps-group" data-tab="my-humans">Installed</div>
            <div class="apps-item" data-tab="my-humans" onclick="showAppDetail(this,'research-scout')"><div class="ai-icon" style="background:linear-gradient(135deg,#22d3ee,#0e7490);color:#fff">🔍</div><div class="ai-body"><div class="ai-name">Research Scout</div><div class="ai-sub">v1.4.2 · weekly report</div></div></div>
            <div class="apps-item" data-tab="my-skills" onclick="showAppDetail(this,'doc-writer')"><div class="ai-icon" style="background:linear-gradient(135deg,#a78bfa,#6d28d9);color:#fff">📝</div><div class="ai-body"><div class="ai-name">Doc Writer</div><div class="ai-sub">Markdown docs from code</div></div></div>
            <div class="apps-item" data-tab="my-skills" onclick="showAppDetail(this,'data-viz')"><div class="ai-icon" style="background:linear-gradient(135deg,#10b981,#22d3ee);color:#fff">📊</div><div class="ai-body"><div class="ai-name">Data Viz</div><div class="ai-sub">CSV/JSON charts</div></div></div>
            <div class="apps-item" data-tab="my-mcp" onclick="showAppDetail(this,'web-scraper')"><div class="ai-icon" style="background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff">🌐</div><div class="ai-body"><div class="ai-name">Web Scraper</div><div class="ai-sub">Browser automation MCP</div></div></div>
            <div class="apps-group" data-tab="marketplace">Discover</div>
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

# Anchor: the transition from desktop store to mobile stage
anchor = '''    </div>

  </div>
</div>
</div>

<!-- ============ MOBILE STAGE ============ -->'''
if anchor in content:
    content = content.replace(anchor, '    </div>\n\n  </div>\n</div>\n</div>\n\n' + apps_html + '\n<!-- ============ MOBILE STAGE ============ -->', 1)
    print('Apps page inserted')
else:
    print('ERROR: store->mobile anchor not found')

# ============ Fix 2: Mobile DH input toolbar ============
# The actual bar has only attach + send (2 buttons)
old_mobile_input = '''              <div class="m-input-bar"><button class="ib"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg></button><button class="send" onclick="sendDh(\'m\')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>'''

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

with open(FILE, 'w') as f:
    f.write(content)
print('Done')
