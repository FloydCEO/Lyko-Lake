# LYKO'S CASINO — Full-Stack Setup Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (Static Files — any host: Cloudflare Pages, etc.)  │
│                                                             │
│  casino.html          ← main lobby                         │
│  casino/lyko.js       ← SHARED client library              │
│  casino/crash.html    ← wired to real API                  │
│  casino/hilo.html     ← wire similarly (see below)         │
│  casino/limbo.html    ← wire similarly                     │
│  casino/[...].html    ← wire similarly                     │
└──────────────────┬──────────────────────────────────────────┘
                   │ fetch() + WebSocket
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Worker  (worker/index.js)                       │
│                                                             │
│  POST /api/auth/register                                    │
│  POST /api/auth/login                                       │
│  GET  /api/me          ← refresh user session              │
│  PUT  /api/me          ← update username / wallet          │
│  POST /api/bet         ← record any bet outcome            │
│  GET  /api/stats/:id   ← stats + transaction history       │
│  GET  /api/leaderboard                                      │
│  WS   /ws              ← real-time feed (Durable Object)   │
└──────────────────┬──────────────────────────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
   Cloudflare KV       Durable Object
   (user accounts,     (LiveFeed — holds
    balances, stats,    all WS connections,
    transactions)       broadcasts bets)
```

---

## Step 1 — Deploy the Worker

### Prerequisites
- Node.js 18+
- A free Cloudflare account

### Install Wrangler
```bash
npm install -g wrangler
wrangler login
```

### Create KV Namespace
```bash
cd worker
npm install
wrangler kv:namespace create "LYKO_KV"
# Copy the id and preview_id into wrangler.toml
```

Edit `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "KV"
id = "PASTE_YOUR_ID_HERE"
preview_id = "PASTE_YOUR_PREVIEW_ID_HERE"
```

### Set JWT Secret
```bash
wrangler secret put JWT_SECRET
# Enter a long random string, e.g.: openssl rand -base64 32
```

### Deploy
```bash
wrangler deploy
```

You'll get a URL like: `https://lyko-casino.YOUR-SUBDOMAIN.workers.dev`

---

## Step 2 — Configure the Frontend

Open `casino/lyko.js` and update line 7:
```js
const API = 'https://lyko-casino.YOUR-SUBDOMAIN.workers.dev';
```

For local development:
```js
const API = 'http://localhost:8787';
wrangler dev  # in the worker/ directory
```

---

## Step 3 — Wire Remaining Games

All game pages (hilo, limbo, plinko, mines, chicken, keno, pump) need just 3 changes:

### 1. Add the script tag (before your `</body>`)
```html
<script src="../casino/lyko.js"></script>
```

### 2. Replace `loadAcc()` / `refreshDisplays()` calls

**Old pattern (every game):**
```js
const acc = loadAcc();
acc.balances[cur] -= bet;
saveAcc(acc);
refreshDisplays();
```

**New pattern:**
```js
// At top of bet resolution:
const result = await Lyko.placeBet({
  game: 'Limbo',           // game name
  bet: betAmount,          // amount wagered
  payout: payoutAmount,    // 0 if lost, betAmount * mult if won
  profit: payoutAmount - betAmount,
  currency: Lyko.getActiveCurrency(),
  multiplier: mult         // final multiplier
});
Lyko.refreshDisplays(result.user);
```

### 3. Replace the DOMContentLoaded init

**Old:**
```js
window.addEventListener('DOMContentLoaded', () => {
  const acc = loadAcc();
  if (!acc) { window.location.href = '../casino.html'; return; }
  refreshDisplays();
  // ... game init
});
```

**New:**
```js
window.addEventListener('DOMContentLoaded', async () => {
  let user = Lyko.getUser();
  if (!user || !Lyko.getToken()) {
    Lyko.showAuthModal(u => { Lyko.refreshDisplays(u); initGame(); });
    return;
  }
  const fresh = await Lyko.refreshMe();
  if (!fresh) { Lyko.showAuthModal(u => { Lyko.refreshDisplays(u); initGame(); }); return; }
  Lyko.refreshDisplays(fresh);
  initGame(); // your existing game start function
});
```

### 4. Replace `getBalance()` and `getActiveCurrency()`
```js
// Old:
function getBalance() { const acc = loadAcc(); ... }
function getActiveCurrency() { ... }

// New — just use:
Lyko.getBalance()          // balance of active currency
Lyko.getActiveCurrency()   // 'lyko' | 'gold' | 'cyber'
```

---

## Step 4 — Host Frontend Files

### Option A: Cloudflare Pages (recommended — free, fast)
1. Push your `frontend/` folder to a GitHub repo
2. Go to Cloudflare Pages → Create project → Connect GitHub
3. Build command: (none — static)
4. Output directory: `/`

### Option B: Any static host
Just serve the `frontend/` folder. Works with:
- GitHub Pages
- Netlify
- Any web server

---

## Real-Time Live Feed

The `Lyko.onFeedEvent(callback)` function fires every time ANY player places a bet across ANY game. The feed is powered by a Cloudflare Durable Object holding all WebSocket connections.

Every call to `POST /api/bet` automatically broadcasts to all connected clients via the Durable Object. The `casino.html` lobby and any page that calls `Lyko.initLiveFeed('liveFeed')` will receive these events in real time.

To add the live feed to a game page:
```js
// After DOMContentLoaded:
Lyko.initLiveFeed('your-feed-container-id');

// Or handle events manually:
Lyko.onFeedEvent(msg => {
  if (msg.type === 'bet') {
    console.log(msg.username, 'bet', msg.bet, 'on', msg.game);
  }
});
```

---

## Account & Stats Modal

Available on any page — just call:
```js
Lyko.openAccount();
```

The modal includes:
- **Overview** — stats grid + win/loss ratio chart (Canvas-drawn)
- **History** — last 50 transactions table
- **Settings** — change username
- **Withdraw** — withdraw coins

---

## Security Notes

- Passwords are SHA-256 hashed with the user's ID as salt
- JWTs expire after 30 days
- All balance changes happen server-side — client cannot manipulate balances
- CORS is configured to allow all origins (tighten in production to your domain)

For production, update the CORS origin in `worker/index.js`:
```js
function cors(res, origin = 'https://your-casino-domain.com') {
```

---

## File Structure

```
lyko-casino/
├── worker/
│   ├── index.js          ← Cloudflare Worker (all API logic)
│   ├── wrangler.toml     ← Worker config (update KV IDs!)
│   └── package.json
└── frontend/
    ├── casino.html       ← Main lobby (updated)
    └── casino/
        ├── lyko.js       ← Shared client library ⭐ UPDATE API URL
        ├── crash.html    ← Updated with real API
        ├── hilo.html     ← Wire up (see guide above)
        ├── limbo.html    ← Wire up
        ├── plinko.html   ← Wire up
        ├── mines.html    ← Wire up
        ├── chicken.html  ← Wire up
        ├── keno.html     ← Wire up
        └── pump.html     ← Wire up
```
