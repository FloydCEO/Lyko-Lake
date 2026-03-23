/**
 * LYKO CASINO — Shared Client
 * Include this <script src="/casino/lyko.js"></script> in every page.
 *
 * Exposes:  window.Lyko  — API + auth + real-time
 */
(function () {
  // ── CONFIG ──────────────────────────────────────────────────────────────────
  // Change this to your deployed worker URL after: wrangler deploy
  const API = 'https://lyko-casino.lillykobusiness69.workers.dev';

  // ── EXCHANGE RATES (relative to LYKO = 1.0) ──────────────────────────────────
  // LYKO is the base. GOLD is worth 2x LYKO. CYBER is worth 4x LYKO.
  // Example: 1 GOLD = 2 LYKO, 1 CYBER = 4 LYKO
  const RATES = { lyko: 1, gold: 2, cyber: 4 };

  // ── GAMBLE SWITCH STATE ───────────────────────────────────────────────────────
  // When active, the player sees bets in switchCurrency but payouts go to baseCurrency
  let _switchActive = false;
  let _switchBase = 'lyko';       // the real currency bets are deducted/paid in
  let _switchView = 'lyko';       // the display currency the player chose
  // For local dev use: const API = 'http://localhost:8787';

  // ── STORAGE ─────────────────────────────────────────────────────────────────
  function getToken() { return localStorage.getItem('lyko_token'); }
  function setToken(t) { localStorage.setItem('lyko_token', t); }
  function clearToken() { localStorage.removeItem('lyko_token'); }
  function getUser() {
    try { return JSON.parse(localStorage.getItem('lyko_user') || 'null'); } catch { return null; }
  }
  function setUser(u) { localStorage.setItem('lyko_user', JSON.stringify(u)); }
  function clearUser() { localStorage.removeItem('lyko_user'); }

  // ── HTTP ─────────────────────────────────────────────────────────────────────
  async function request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const tok = getToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    const res = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // ── AUTH ──────────────────────────────────────────────────────────────────────
  async function register(username, password, promoCode) {
    const data = await request('POST', '/api/auth/register', { username, password, promoCode: promoCode || '' });
    setToken(data.token);
    setUser(data.user);
    // Attach flag so caller can show the promo banner
    data.user._promoApplied = data.promoApplied;
    return data.user;
  }

  async function login(username, password) {
    const data = await request('POST', '/api/auth/login', { username, password });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearToken();
    clearUser();
    location.reload();
  }

  async function refreshMe() {
    try {
      const data = await request('GET', '/api/me');
      // Also fetch wallet balances so cold storage shows correctly on casino page
      try {
        const wdata = await request('GET', '/api/wallet');
        data.user.walletBalances = wdata.walletBalances || { lyko: 0, gold: 0, cyber: 0 };
      } catch {}
      setUser(data.user);
      return data.user;
    } catch { return null; }
  }

  async function updateMe(fields) {
    const data = await request('PUT', '/api/me', fields);
    setUser(data.user);
    return data.user;
  }

  // ── BETTING ───────────────────────────────────────────────────────────────────
  async function placeBet({ game, bet, payout, profit, currency, multiplier }) {
    const data = await request('POST', '/api/bet', { game, bet, payout, profit, currency, multiplier });
    setUser(data.user);
    return data;
  }

  async function getStats() {
    const u = getUser();
    if (!u) throw new Error('Not logged in');
    return request('GET', `/api/stats/${u.id}`);
  }

  // ── LEADERBOARD ──────────────────────────────────────────────────────────────
  async function getLeaderboard() {
    // Public endpoint — no auth required
    const res = await fetch(API + '/api/leaderboard');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // ── CURRENCY HELPERS ─────────────────────────────────────────────────────────
  function getActiveCurrency() {
    return localStorage.getItem('lyko_currency') || 'lyko';
  }
  function setActiveCurrency(c) {
    localStorage.setItem('lyko_currency', c);
  }
  function getBalance(currency) {
    const u = getUser();
    if (!u) return 0;
    return (u.balances || {})[currency || getActiveCurrency()] || 0;
  }

  // ── LIVE FEED (polling — free plan, no WebSockets needed) ──────────────────
  const feedCallbacks = [];
  let lastSeenTs = 0;

  function connectFeed() {
    // Initial load
    fetch(API + '/api/feed').then(r => r.json()).then(data => {
      const events = data.events || [];
      if (events.length > 0) {
        lastSeenTs = events[0].ts;
        feedCallbacks.forEach(cb => { try { cb({ type: 'history', events }); } catch {} });
      }
    }).catch(() => {});
    // Poll every 3 seconds for new bets
    setInterval(async () => {
      try {
        const res = await fetch(API + '/api/feed');
        const data = await res.json();
        const newEvents = (data.events || []).filter(e => e.ts > lastSeenTs);
        if (newEvents.length > 0) {
          lastSeenTs = newEvents[0].ts;
          newEvents.forEach(e => {
            feedCallbacks.forEach(cb => { try { cb({ type: 'bet', ...e }); } catch {} });
          });
        }
      } catch {}
    }, 3000);
  }

  function onFeedEvent(cb) { feedCallbacks.push(cb); }

  // ── UI HELPERS ────────────────────────────────────────────────────────────────
  /**
   * Refresh all balance displays across sidebar & topbar.
   * Call after any bet or balance update.
   */
  function refreshDisplays(user) {
    if (!user) user = getUser();
    if (!user) return;
    const b = user.balances || {};
    // Update wallet balance displays if they exist on the page
    const wb = user.walletBalances || {};
    ['lyko','gold','cyber'].forEach(c => {
      const el = document.getElementById('wbal-' + c);
      if (el) el.textContent = (wb[c] || 0).toFixed(2);
    });
    ['lyko','gold','cyber'].forEach(c => {
      const el = document.getElementById('bal-' + c);
      if (el) el.textContent = (b[c] || 0).toFixed(2);
    });
    const cur = getActiveCurrency();
    const topBal = document.getElementById('activeCoinBal');
    if (topBal) topBal.textContent = (b[cur] || 0).toFixed(2);
    const topName = document.getElementById('activeCoinName');
    if (topName) topName.textContent = cur.toUpperCase();
    const topIcon = document.getElementById('topCoinIcon');
    if (topIcon) {
      const colors = { lyko: '#00e676', gold: '#f5a623', cyber: '#00e5ff' };
      topIcon.style.background = colors[cur] || '#00e676';
      topIcon.textContent = cur[0].toUpperCase();
    }
    // username
    ['heroName','usernameNav','topbarUser'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = user.username;
    });
    // active currency highlight
    document.querySelectorAll('.wallet-row').forEach(row => {
      row.classList.toggle('active-currency', row.dataset.currency === cur);
    });
  }

  function setCurrency(c) {
    setActiveCurrency(c);
    refreshDisplays();
  }

  // ── GAMBLE SWITCH HELPERS ──────────────────────────────────────────────────────
  // Convert an amount from one currency to another using RATES
  function convertAmount(amount, fromCur, toCur) {
    if (fromCur === toCur) return amount;
    const inLyko = amount * RATES[fromCur];
    return parseFloat((inLyko / RATES[toCur]).toFixed(4));
  }

  // Start a gamble-switch session: player will see bets in viewCur but pays in baseCur
  function startGambleSwitch(baseCur, viewCur) {
    _switchActive = true;
    _switchBase = baseCur;
    _switchView = viewCur;
    localStorage.setItem('lyko_switch', JSON.stringify({ active: true, base: baseCur, view: viewCur }));
    refreshDisplays();
  }

  function stopGambleSwitch() {
    _switchActive = false;
    _switchBase = getActiveCurrency();
    _switchView = getActiveCurrency();
    localStorage.removeItem('lyko_switch');
    refreshDisplays();
  }

  function getGambleSwitch() {
    // Restore from storage on reload
    if (!_switchActive) {
      try {
        const s = JSON.parse(localStorage.getItem('lyko_switch') || 'null');
        if (s && s.active) { _switchActive = true; _switchBase = s.base; _switchView = s.view; }
      } catch {}
    }
    return { active: _switchActive, base: _switchBase, view: _switchView };
  }

  // Get the displayed bet amount in view currency (for UI input)
  function toViewAmount(realAmount) {
    const sw = getGambleSwitch();
    if (!sw.active || sw.base === sw.view) return realAmount;
    return convertAmount(realAmount, sw.base, sw.view);
  }

  // Convert a displayed (view) amount back to real (base) currency for placing bet
  function toBaseAmount(viewAmount) {
    const sw = getGambleSwitch();
    if (!sw.active || sw.base === sw.view) return viewAmount;
    return convertAmount(viewAmount, sw.view, sw.base);
  }

  // ── ACCOUNT MODAL ─────────────────────────────────────────────────────────────
  async function openAccount() {
    const user = getUser();
    if (!user) return;

    let statsData = { stats: user.stats || {}, transactions: [] };
    try { statsData = await getStats(); } catch {}

    const overlay = document.createElement('div');
    overlay.className = 'm-overlay';
    const s = statsData.stats || {};
    const txs = statsData.transactions || [];
    const wl = s.wins + s.losses > 0 ? ((s.wins / (s.wins + s.losses)) * 100).toFixed(1) : '—';

    // Build W/L chart data
    const chartPoints = buildWLChart(txs);

    overlay.innerHTML = `
<div class="m-box">
  <div class="m-header">
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:42px;height:42px;background:var(--lyko);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Orbitron',sans-serif;font-weight:900;font-size:20px;color:#000">${(user.username||'?')[0].toUpperCase()}</div>
      <div>
        <div id="modalName" style="font-family:'Orbitron',sans-serif;font-size:16px;font-weight:900;color:#fff">${user.username}</div>
        <div style="font-size:9px;letter-spacing:2px;color:var(--dim)">ID: ${user.id}</div>
      </div>
    </div>
    <button class="m-close" onclick="this.closest('.m-overlay').remove()">✕</button>
  </div>
  <div class="m-tabs">
    <button class="m-tab on" id="tab-ov" onclick="switchMTab('ov')">Overview</button>
    <button class="m-tab" id="tab-tx" onclick="switchMTab('tx')">History</button>
    <button class="m-tab" id="tab-st" onclick="switchMTab('st')">Settings</button>
    <button class="m-tab" id="tab-cv" onclick="switchMTab('cv')">Convert</button>
    <button class="m-tab" id="tab-wd" onclick="switchMTab('wd')">Withdraw</button>
  </div>
  <div class="m-body">

    <!-- OVERVIEW -->
    <div id="mpanel-ov">
      <div class="m-stat-grid">
        <div class="m-stat"><div class="m-stat-label">Total Bets</div><div class="m-stat-val" style="color:var(--cyan)">${s.totalBets||0}</div></div>
        <div class="m-stat"><div class="m-stat-label">Total Wagered</div><div class="m-stat-val">${(s.totalWagered||0).toFixed(2)}</div></div>
        <div class="m-stat"><div class="m-stat-label">Max Wager</div><div class="m-stat-val" style="color:var(--gold)">${(s.maxWager||0).toFixed(2)}</div></div>
        <div class="m-stat"><div class="m-stat-label">Max Win</div><div class="m-stat-val" style="color:var(--lyko)">${(s.maxWin||0).toFixed(2)}</div></div>
        <div class="m-stat"><div class="m-stat-label">Best Multi</div><div class="m-stat-val" style="color:var(--lyko)">${(s.maxMultiplier||0).toFixed(2)}×</div></div>
        <div class="m-stat"><div class="m-stat-label">Win Rate</div><div class="m-stat-val" style="color:${parseFloat(wl)>50?'var(--lyko)':'var(--accent)'}">${wl}%</div></div>
      </div>
      <div style="margin-bottom:14px">
        <div class="m-section-label">Win / Loss Ratio Over Time</div>
        <canvas id="wlChart" style="width:100%;height:140px;background:var(--surface);border:1px solid var(--border);border-radius:2px"></canvas>
      </div>
      <div style="margin-bottom:14px">
        <div class="m-section-label">Casino Balances (For Gambling)</div>
        ${['lyko','gold','cyber'].map(c => `
          <div class="m-row">
            <span style="font-size:11px">${c.toUpperCase()}</span>
            <span style="font-family:'Orbitron',sans-serif;font-weight:700">${(user.balances[c]||0).toFixed(2)}</span>
          </div>`).join('')}
      </div>
      <div style="margin-bottom:14px">
        <div class="m-section-label">Wallet Balances (Cold Storage)</div>
        ${['lyko','gold','cyber'].map(c => `
          <div class="m-row">
            <span style="font-size:11px;color:var(--cyan)">${c.toUpperCase()}</span>
            <span style="font-family:'Orbitron',sans-serif;font-weight:700;color:var(--cyan)">${((user.walletBalances||{})[c]||0).toFixed(2)}</span>
          </div>`).join('')}
      </div>
      <button class="m-btn" style="background:var(--accent);color:#fff;font-size:10px;letter-spacing:2px;padding:8px 16px" onclick="Lyko.logout()">SIGN OUT</button>
    </div>

    <!-- HISTORY -->
    <div id="mpanel-tx" style="display:none">
      ${txs.length === 0 ? '<div style="color:var(--dim);font-size:11px">No bets yet.</div>' : `
      <table class="tx-table">
        <thead><tr><th>Game</th><th>Bet</th><th>Payout</th><th>Mult</th><th>P/L</th><th>Cur</th></tr></thead>
        <tbody>
        ${txs.slice(0,50).map(tx => `
          <tr>
            <td>${tx.game}</td>
            <td>${tx.bet.toFixed(2)}</td>
            <td>${(tx.payout||0).toFixed(2)}</td>
            <td>${(tx.multiplier||0).toFixed(2)}×</td>
            <td style="color:${tx.profit>=0?'#00e676':'#e94560'};font-weight:700">${tx.profit>=0?'+':''}${(tx.profit||0).toFixed(2)}</td>
            <td style="color:var(--dim)">${(tx.currency||'').toUpperCase()}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}
    </div>

    <!-- SETTINGS -->
    <div id="mpanel-st" style="display:none">
      <div style="display:flex;flex-direction:column;gap:14px;max-width:400px">
        <div>
          <div class="m-section-label">Display Name</div>
          <div style="display:flex;gap:8px">
            <input id="mNameInput" class="m-input" value="${user.username}" maxlength="20" placeholder="Username">
            <button class="m-btn" onclick="mSaveName()">SAVE</button>
          </div>
          <div id="mSettingOk" style="display:none;margin-top:8px;font-size:10px;color:var(--lyko);letter-spacing:2px">✓ SAVED</div>
        </div>
      </div>
    </div>

    <!-- CONVERT -->
    <div id="mpanel-cv" style="display:none">
      <div style="max-width:440px;display:flex;flex-direction:column;gap:16px;">

        <!-- Exchange rates info -->
        <div style="padding:12px 14px;background:rgba(0,230,118,.05);border:1px solid rgba(0,230,118,.2);font-size:10px;color:var(--dim);line-height:1.8;">
          Exchange Rates &nbsp;·&nbsp;
          <span style="color:#00e676">1 LYKO</span> = 
          <span style="color:#f5a623">0.5 GOLD</span> = 
          <span style="color:#00e5ff">0.25 CYBER</span>
        </div>

        <!-- Convert form -->
        <div>
          <div class="m-section-label">From</div>
          <div style="display:flex;gap:8px;">
            <select id="cvFrom" class="m-input" onchange="mUpdateConvert()" style="flex:1">
              <option value="lyko">LYKO (bal: ${(user.balances.lyko||0).toFixed(2)})</option>
              <option value="gold">GOLD (bal: ${(user.balances.gold||0).toFixed(2)})</option>
              <option value="cyber">CYBER (bal: ${(user.balances.cyber||0).toFixed(2)})</option>
            </select>
            <input id="cvAmt" type="number" min="0.01" step="0.01" placeholder="Amount" class="m-input" style="flex:1" oninput="mUpdateConvert()">
          </div>
        </div>
        <div style="text-align:center;font-size:20px;color:var(--dim)">⇅</div>
        <div>
          <div class="m-section-label">To</div>
          <div style="display:flex;gap:8px;">
            <select id="cvTo" class="m-input" onchange="mUpdateConvert()" style="flex:1">
              <option value="gold">GOLD</option>
              <option value="cyber">CYBER</option>
              <option value="lyko">LYKO</option>
            </select>
            <div id="cvResult" class="m-input" style="flex:1;background:var(--void);display:flex;align-items:center;color:var(--lyko);font-weight:700;font-family:'Orbitron',sans-serif;">—</div>
          </div>
        </div>

        <button class="m-btn m-btn-full" onclick="mDoConvert()" style="background:var(--cyan);color:#000;">CONVERT</button>
        <div id="cvMsg" style="display:none;font-size:11px;letter-spacing:1px;padding:10px 12px;border:1px solid"></div>

        <!-- Gamble Switch -->
        <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:16px;">
          <div class="m-section-label">Gamble Switch</div>
          <div style="font-size:10px;color:var(--dim);line-height:1.8;margin-bottom:12px;">
            Bet using a different currency view. Your real balance stays in your base coin — 
            winnings are converted back and paid in your base currency automatically.
          </div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <select id="swBase" class="m-input" style="flex:1">
              <option value="lyko">Base: LYKO</option>
              <option value="gold">Base: GOLD</option>
              <option value="cyber">Base: CYBER</option>
            </select>
            <select id="swView" class="m-input" style="flex:1">
              <option value="gold">View as: GOLD</option>
              <option value="cyber">View as: CYBER</option>
              <option value="lyko">View as: LYKO</option>
            </select>
          </div>
          <div id="swStatus" style="font-size:10px;letter-spacing:2px;color:var(--dim);margin-bottom:10px;min-height:16px;"></div>
          <div style="display:flex;gap:8px;">
            <button class="m-btn" style="flex:1" onclick="mStartSwitch()">ENABLE SWITCH</button>
            <button class="m-btn" style="flex:1;background:var(--accent);color:#fff;" onclick="mStopSwitch()">DISABLE</button>
          </div>
        </div>
      </div>
    </div>

    <!-- WITHDRAW -->
    <div id="mpanel-wd" style="display:none">
      <div style="max-width:400px;display:flex;flex-direction:column;gap:14px">
        <div style="padding:14px;background:rgba(0,230,118,.06);border:1px solid rgba(0,230,118,.2);font-size:11px;color:#00e676;line-height:1.7">Withdraw your coins. Minimum 1 coin. 1 LYKO = $2.00 USD.</div>
        <div>
          <div class="m-section-label">Currency</div>
          <select id="wdCur" class="m-input">
            <option value="lyko">LYKO (bal: ${(user.balances.lyko||0).toFixed(2)})</option>
            <option value="gold">GOLD (bal: ${(user.balances.gold||0).toFixed(2)})</option>
            <option value="cyber">CYBER (bal: ${(user.balances.cyber||0).toFixed(2)})</option>
          </select>
        </div>
        <div>
          <div class="m-section-label">Amount</div>
          <input id="wdAmt" type="number" min="1" step="0.01" placeholder="0.00" class="m-input">
        </div>
        <div>
          <div class="m-section-label">Destination</div>
          <input id="wdAddr" class="m-input" value="${user.withdrawalAddress||''}" placeholder="Wallet address or username">
        </div>
        <button class="m-btn m-btn-full" onclick="mDoWithdraw()">CONFIRM WITHDRAWAL</button>
        <div id="wdMsg" style="display:none;font-size:11px;letter-spacing:1px;padding:10px 12px;border:1px solid"></div>
      </div>
    </div>
  </div>
</div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    // Draw W/L chart
    requestAnimationFrame(() => drawWLChart('wlChart', chartPoints));
  }

  function buildWLChart(txs) {
    if (!txs.length) return [];
    const pts = [];
    let wins = 0, total = 0;
    [...txs].reverse().forEach(tx => {
      total++;
      if (tx.profit > 0) wins++;
      pts.push(total > 0 ? (wins / total) * 100 : 50);
    });
    return pts;
  }

  function drawWLChart(canvasId, points) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !points.length) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth || 600;
    const h = canvas.offsetHeight || 140;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const pad = { t: 16, r: 16, b: 24, l: 36 };
    const cw = w - pad.l - pad.r;
    const ch = h - pad.t - pad.b;

    ctx.fillStyle = '#121428';
    ctx.fillRect(0, 0, w, h);

    // 50% line
    ctx.strokeStyle = 'rgba(90,106,144,.4)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const y50 = pad.t + ch * (1 - 0.5);
    ctx.moveTo(pad.l, y50);
    ctx.lineTo(pad.l + cw, y50);
    ctx.stroke();
    ctx.setLineDash([]);

    if (points.length < 2) return;

    const xStep = cw / (points.length - 1);
    const toX = i => pad.l + i * xStep;
    const toY = v => pad.t + ch * (1 - v / 100);

    // Fill
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ch);
    grad.addColorStop(0, 'rgba(0,230,118,.25)');
    grad.addColorStop(1, 'rgba(0,230,118,.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(points[0]));
    points.forEach((p, i) => i > 0 && ctx.lineTo(toX(i), toY(p)));
    ctx.lineTo(toX(points.length - 1), pad.t + ch);
    ctx.lineTo(toX(0), pad.t + ch);
    ctx.closePath();
    ctx.fill();

    // Line
    ctx.strokeStyle = '#00e676';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(toX(i), toY(p)) : ctx.lineTo(toX(i), toY(p)));
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#5a6a90';
    ctx.font = '9px DM Mono, monospace';
    ctx.fillText('100%', 2, pad.t + 4);
    ctx.fillText('50%', 4, y50 + 4);
    ctx.fillText('0%', 6, pad.t + ch + 4);
  }

  // ── Modal helpers (global so inline onclick works) ─────────────────────────
  window.switchMTab = function(t) {
    if (t === 'cv' && typeof window.mRefreshConvertLabels === 'function') window.mRefreshConvertLabels();
    ['ov','tx','st','cv','wd'].forEach(x => {
      const b = document.getElementById('tab-'+x);
      const p = document.getElementById('mpanel-'+x);
      if (!b || !p) return;
      b.classList.toggle('on', x === t);
      p.style.display = x === t ? 'block' : 'none';
    });
  };

  window.mSaveName = async function() {
    const val = document.getElementById('mNameInput')?.value?.trim();
    if (!val) return;
    try {
      const user = await Lyko.updateMe({ username: val });
      document.getElementById('modalName').textContent = user.username;
      Lyko.refreshDisplays(user);
      const ok = document.getElementById('mSettingOk');
      if (ok) { ok.style.display = 'block'; setTimeout(() => ok.style.display = 'none', 2000); }
    } catch(e) { alert(e.message); }
  };

  window.mDoWithdraw = async function() {
    const cur = document.getElementById('wdCur')?.value;
    const amt = parseFloat(document.getElementById('wdAmt')?.value);
    const addr = document.getElementById('wdAddr')?.value?.trim();
    const msgEl = document.getElementById('wdMsg');
    function showMsg(ok, msg) {
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.borderColor = ok ? '#00e676' : '#e94560';
        msgEl.style.color = ok ? '#00e676' : '#e94560';
        msgEl.textContent = msg;
      }
    }
    if (!cur || !amt || amt < 1 || !addr) { showMsg(false, 'Fill all fields — minimum 1 coin.'); return; }
    try {
      const result = await Lyko.placeBet({
        game: 'Withdrawal', bet: amt, payout: 0, profit: -amt, currency: cur, multiplier: 0
      });
      await Lyko.updateMe({ withdrawalAddress: addr });
      Lyko.refreshDisplays(result.user);
      showMsg(true, `✓ Withdrawn ${amt.toFixed(2)} ${cur.toUpperCase()} → ${addr}`);
    } catch(e) { showMsg(false, e.message); }
  };

  window.mUpdateConvert = function() {
    const from = document.getElementById('cvFrom')?.value;
    const to   = document.getElementById('cvTo')?.value;
    const amt  = parseFloat(document.getElementById('cvAmt')?.value);
    const res  = document.getElementById('cvResult');
    if (!res) return;
    if (!from || !to || !amt || isNaN(amt) || amt <= 0) { res.textContent = '—'; return; }
    if (from === to) { res.textContent = amt.toFixed(2); return; }
    const converted = Lyko.convertAmount(amt, from, to);
    res.textContent = converted.toFixed(4) + ' ' + to.toUpperCase();
    // Update the balance hints in dropdowns from live user data
    mRefreshConvertLabels();
  };

  window.mRefreshConvertLabels = function() {
    const u = Lyko.getUser();
    if (!u) return;
    const b = u.balances || {};
    const labels = { lyko: 'LYKO', gold: 'GOLD', cyber: 'CYBER' };
    ['cvFrom', 'cvTo'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      Array.from(sel.options).forEach(opt => {
        if (labels[opt.value]) {
          opt.text = id === 'cvFrom'
            ? labels[opt.value] + ' (bal: ' + (b[opt.value]||0).toFixed(2) + ')'
            : labels[opt.value];
        }
      });
    });
  };

  window.mDoConvert = async function() {
    const from  = document.getElementById('cvFrom')?.value;
    const to    = document.getElementById('cvTo')?.value;
    const amt   = parseFloat(document.getElementById('cvAmt')?.value);
    const msgEl = document.getElementById('cvMsg');
    const btn   = document.querySelector('[onclick="mDoConvert()"]');
    function showMsg(ok, msg) {
      if (msgEl) { msgEl.style.display='block'; msgEl.style.borderColor=ok?'#00e676':'#e94560'; msgEl.style.color=ok?'#00e676':'#e94560'; msgEl.textContent=msg; }
    }
    if (!from || !to || !amt || isNaN(amt) || amt < 0.01) { showMsg(false,'Enter a valid amount.'); return; }
    if (from === to) { showMsg(false,'Pick two different currencies.'); return; }
    const user = Lyko.getUser();
    if (!user) return;
    if ((user.balances[from]||0) < amt) { showMsg(false,'Insufficient ' + from.toUpperCase() + ' balance.'); return; }

    // Disable button while request is in flight
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    try {
      // Hit the server — this is the real conversion, not just localStorage
      const res = await fetch(Lyko.API + '/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Lyko.getToken() },
        body: JSON.stringify({ from, to, amount: amt })
      });
      const data = await res.json();
      if (!res.ok) { showMsg(false, data.error || 'Conversion failed.'); return; }

      // Update local state from server response
      localStorage.setItem('lyko_user', JSON.stringify(data.user));
      Lyko.refreshDisplays(data.user);
      // Refresh the dropdown balance labels so they show updated amounts
      if (typeof mRefreshConvertLabels === 'function') mRefreshConvertLabels();
      showMsg(true, `✓ Converted ${data.spent.toFixed(2)} ${from.toUpperCase()} → ${data.received.toFixed(4)} ${to.toUpperCase()}`);
      document.getElementById('cvAmt').value = '';
    } catch(e) {
      showMsg(false, 'Network error — try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'CONVERT'; }
    }
  };

  window.mStartSwitch = function() {
    const base = document.getElementById('swBase')?.value;
    const view = document.getElementById('swView')?.value;
    if (base === view) { const el=document.getElementById('swStatus'); if(el) el.textContent='Base and view must differ.'; return; }
    Lyko.startGambleSwitch(base, view);
    const el = document.getElementById('swStatus');
    if (el) el.style.color='#00e676', el.textContent=`✓ Switch ON — betting in ${base.toUpperCase()}, showing ${view.toUpperCase()}`;
  };

  window.mStopSwitch = function() {
    Lyko.stopGambleSwitch();
    const el = document.getElementById('swStatus');
    if (el) el.style.color='var(--dim)', el.textContent='Switch disabled.';
  };

  // ── LIVE FEED UI ──────────────────────────────────────────────────────────────
  function initLiveFeed(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    function addRow(evt) {
      if (evt.type === 'history') {
        (evt.events || []).slice(0, 8).forEach(e => addRow({ type: 'bet', ...e }));
        return;
      }
      const { username, game, bet, profit, multiplier, currency } = evt;
      const win = profit > 0;
      const row = document.createElement('div');
      row.className = 'live-row';
      row.style.animation = 'fadeDown .3s ease both';
      row.innerHTML = `
        <span style="color:#00e5ff">${username}</span>
        <span style="color:#5a6a90">${game}</span>
        <span>${(bet||0).toFixed(2)} ${(currency||'LYKO').toUpperCase()}</span>
        <span style="color:${win?'#00e676':'#e94560'};font-weight:700">${(multiplier||0).toFixed(2)}×</span>`;
      el.prepend(row);
      while (el.children.length > 12) el.removeChild(el.lastChild);
    }

    Lyko.onFeedEvent(addRow);
  }


  // ── CURSOR ────────────────────────────────────────────────────────────────────
  function initCursor() {
    const cursor = document.getElementById('cursor');
    if (!cursor) return;
    cursor.style.opacity = '0';
    document.addEventListener('mousemove', e => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top  = e.clientY + 'px';
    });
    document.addEventListener('mousemove', function show() {
      cursor.style.opacity = '1';
      document.removeEventListener('mousemove', show);
    });
    // Use event delegation so dynamically added modals/elements work too
    document.addEventListener('mouseover', e => {
      if (e.target.closest('a,button,.wallet-row,.game-card,.mine-tile,.play-btn,.cashout-btn,.half-btn,.double-btn,.back-btn,.sidebar-item,.ob-btn,.m-btn,.m-tab,.m-close'))
        cursor.classList.add('big');
    });
    document.addEventListener('mouseout', e => {
      if (e.target.closest('a,button,.wallet-row,.game-card,.mine-tile,.play-btn,.cashout-btn,.half-btn,.double-btn,.back-btn,.sidebar-item,.ob-btn,.m-btn,.m-tab,.m-close'))
        cursor.classList.remove('big');
    });
  }

  // ── AUTH GATE ─────────────────────────────────────────────────────────────────
  /**
   * Show the auth modal (login/register) and resolve with the user.
   * Call on DOMContentLoaded if no user is present.
   */
  function showAuthModal(onSuccess) {
    const overlay = document.createElement('div');
    overlay.id = 'ob';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.96);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;';

    overlay.innerHTML = `
<div class="ob-box">
  <div class="ob-logo">L</div>
  <div class="ob-title">LYKO'S CASINO</div>
  <div class="ob-sub">Digital Originals · Real-Time</div>
  <div id="authError" style="display:none;color:#e94560;font-size:10px;letter-spacing:1px;margin-bottom:12px;padding:8px 12px;border:1px solid #e94560;"></div>
  <div style="display:flex;gap:0;margin-bottom:16px">
    <button id="authTabLogin" onclick="authTab('login')" style="flex:1;padding:10px;background:#00e676;border:none;color:#000;font-family:'Orbitron',sans-serif;font-size:10px;font-weight:900;letter-spacing:2px;cursor:pointer">SIGN IN</button>
    <button id="authTabRegister" onclick="authTab('register')" style="flex:1;padding:10px;background:#121428;border:1px solid #1e2240;color:#5a6a90;font-family:'Orbitron',sans-serif;font-size:10px;font-weight:900;letter-spacing:2px;cursor:pointer">REGISTER</button>
  </div>
  <input class="ob-input" id="obUser" type="text" maxlength="50" placeholder="Username or email" autocomplete="off">
  <input class="ob-input" id="obPass" type="password" maxlength="60" placeholder="Password" autocomplete="off" style="margin-top:8px">
  <div id="obConfirmWrap" style="display:none;margin-top:8px">
    <input class="ob-input" id="obConf" type="password" maxlength="60" placeholder="Confirm Password" autocomplete="off">
  </div>
  <div id="obPromoWrap" style="display:none;margin-top:8px">
    <input class="ob-input" id="obPromo" type="text" maxlength="20" placeholder="Promo code (optional)" autocomplete="off" style="text-transform:uppercase;letter-spacing:4px">
  </div>
  <button class="ob-btn" id="authSubmitBtn" onclick="authSubmit()" style="margin-top:16px">SIGN IN</button>
  <div id="obRegisterNote" style="display:none;margin-top:12px" class="ob-starting">Starting with <b>1,000 LYKO</b> · <b>500 GOLD</b> · <b>250 CYBER</b><br>Use code <b>LYKO</b> for <b>3× starting balance</b></div>
</div>`;

    document.body.appendChild(overlay);

    window._authOnSuccess = onSuccess;
    window.authTab = function(tab) {
      const isReg = tab === 'register';
      document.getElementById('authTabLogin').style.background = isReg ? '#121428' : '#00e676';
      document.getElementById('authTabLogin').style.color = isReg ? '#5a6a90' : '#000';
      document.getElementById('authTabRegister').style.background = isReg ? '#00e676' : '#121428';
      document.getElementById('authTabRegister').style.color = isReg ? '#000' : '#5a6a90';
      document.getElementById('obConfirmWrap').style.display = isReg ? 'block' : 'none';
      document.getElementById('obPromoWrap').style.display = isReg ? 'block' : 'none';
      document.getElementById('obRegisterNote').style.display = isReg ? 'block' : 'none';
      document.getElementById('authSubmitBtn').textContent = isReg ? 'CREATE ACCOUNT' : 'SIGN IN';
      document.getElementById('authSubmitBtn').dataset.tab = tab;
    };
    window.authTab('login');

    window.authSubmit = async function() {
      const btn = document.getElementById('authSubmitBtn');
      const tab = btn.dataset.tab || 'login';
      const username = document.getElementById('obUser').value.trim();
      const password = document.getElementById('obPass').value;
      const errEl = document.getElementById('authError');
      errEl.style.display = 'none';
      btn.textContent = '...';
      try {
        let user;
        if (tab === 'register') {
          const conf = document.getElementById('obConf').value;
          if (password !== conf) throw new Error('Passwords do not match');
          const promoCode = (document.getElementById('obPromo')?.value || '').trim();
          const data = await Lyko.register(username, password, promoCode);
          user = data;
          // Show promo success banner before closing
          if (data._promoApplied) {
            errEl.style.display = 'block';
            errEl.style.borderColor = '#00e676';
            errEl.style.color = '#00e676';
            errEl.textContent = '🎉 Code LYKO applied — you start with $3,000!';
            await new Promise(r => setTimeout(r, 2000));
          }
        } else {
          user = await Lyko.login(username, password);
        }
        overlay.remove();
        if (window._authOnSuccess) window._authOnSuccess(user);
      } catch(e) {
        errEl.style.display = 'block';
        errEl.textContent = e.message;
        btn.textContent = tab === 'register' ? 'CREATE ACCOUNT' : 'SIGN IN';
      }
    };

    // Enter key
    overlay.addEventListener('keydown', e => { if (e.key === 'Enter') window.authSubmit(); });
  }

  // ── INIT ──────────────────────────────────────────────────────────────────────
  connectFeed();

  // ── PUBLIC API ────────────────────────────────────────────────────────────────
  window.Lyko = {
    // Auth
    register,
    login,
    logout,
    refreshMe,
    updateMe,
    getUser,
    getToken,
    showAuthModal,
    // Betting
    placeBet,
    getStats,
    getLeaderboard,
    // Currency
    getActiveCurrency,
    setActiveCurrency,
    getBalance,
    setCurrency: (c) => { setActiveCurrency(c); refreshDisplays(); },
    // UI
    refreshDisplays,
    openAccount,
    initLiveFeed,
    initCursor,
    onFeedEvent,
    // Config
    API,
    // Currency conversion
    convertAmount,
    startGambleSwitch,
    stopGambleSwitch,
    getGambleSwitch,
    toViewAmount,
    toBaseAmount,
    RATES
  };

  // Make openAccount globally accessible (used by inline onclicks)
  window.openAccount = (e) => { if (e) e.preventDefault(); openAccount(); };
  window.setCurrency = (c) => Lyko.setCurrency(c);

})();