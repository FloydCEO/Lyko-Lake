/**
 * LYKO'S CASINO — Cloudflare Worker Backend
 * 
 * Routes:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/me               (JWT)
 *   PUT  /api/me               (JWT) — update username/wallet
 *   POST /api/bet              (JWT) — record a bet
 *   GET  /api/stats/:userId    (JWT)
 *   GET  /api/leaderboard
 *   WS   /ws                   — real-time feed (Durable Object)
 */

import { Router } from 'itty-router';
import { sign, verify } from '@tsndr/cloudflare-worker-jwt';

const router = Router();
const JWT_SECRET = 'CHANGE_ME_IN_WRANGLER_ENV'; // override via env.JWT_SECRET

// ── CORS helper ──────────────────────────────────────────────────────────────
function cors(res, origin = '*') {
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  return res;
}
function json(data, status = 200) {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  }));
}
function err(msg, status = 400) { return json({ error: msg }, status); }

// ── Auth middleware ───────────────────────────────────────────────────────────
async function requireAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return null;
  try {
    const ok = await verify(token, env.JWT_SECRET || JWT_SECRET);
    if (!ok) return null;
    const { payload } = decodeToken(token);
    return payload;
  } catch { return null; }
}
function decodeToken(token) {
  const [, payload] = token.split('.');
  return { payload: JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/'))) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function hash(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}
function uid() { return crypto.randomUUID().replace(/-/g,'').slice(0,16); }

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER  POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/auth/register', async (req, env) => {
  const { username, password, promoCode } = await req.json().catch(() => ({}));
  if (!username || !password) return err('Username and password required');
  if (username.length < 3 || username.length > 20) return err('Username 3–20 chars');
  if (password.length < 6) return err('Password min 6 chars');

  const existingId = await env.KV.get(`user:name:${username.toLowerCase()}`);
  if (existingId) return err('Username taken', 409);
  const id = uid();
  const pwHash = await hash(password + id); // salt with id

  // Promo code: LYKO → triple starting balance
  const promoApplied = (promoCode || '').trim().toUpperCase() === 'LYKO';
  const user = {
    id, username,
    pwHash,
    createdAt: Date.now(),
    promoUsed: promoApplied ? 'LYKO' : null,
    balances: promoApplied
      ? { lyko: 3000, gold: 1500, cyber: 750 }
      : { lyko: 1000, gold: 500, cyber: 250 },
    stats: {
      totalBets: 0, totalWagered: 0, totalWon: 0,
      maxWager: 0, maxWin: 0, maxMultiplier: 0,
      wins: 0, losses: 0
    },
    transactions: [],
    withdrawalAddress: ''
  };

  await env.KV.put(`user:id:${id}`, JSON.stringify(user));
  await env.KV.put(`user:name:${username.toLowerCase()}`, id);

  const token = await sign({ sub: id, username }, env.JWT_SECRET || JWT_SECRET, { expiresIn: '30d' });
  return json({ token, user: sanitize(user), promoApplied });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN  POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/auth/login', async (req, env) => {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) return err('Username and password required');

  const id = await env.KV.get(`user:name:${username.toLowerCase()}`);
  if (!id) return err('Invalid credentials', 401);

  const raw = await env.KV.get(`user:id:${id}`);
  if (!raw) return err('Account not found', 404);
  const user = JSON.parse(raw);

  const pwHash = await hash(password + id);
  if (pwHash !== user.pwHash) return err('Invalid credentials', 401);

  const token = await sign({ sub: id, username: user.username }, env.JWT_SECRET || JWT_SECRET, { expiresIn: '30d' });
  return json({ token, user: sanitize(user) });
});

// ─────────────────────────────────────────────────────────────────────────────
// ME  GET /api/me
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/me', async (req, env) => {
  const payload = await requireAuth(req, env);
  if (!payload) return err('Unauthorized', 401);

  const raw = await env.KV.get(`user:id:${payload.sub}`);
  if (!raw) return err('Not found', 404);
  return json({ user: sanitize(JSON.parse(raw)) });
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE ME  PUT /api/me
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/me', async (req, env) => {
  const payload = await requireAuth(req, env);
  if (!payload) return err('Unauthorized', 401);

  const raw = await env.KV.get(`user:id:${payload.sub}`);
  if (!raw) return err('Not found', 404);
  const user = JSON.parse(raw);

  const body = await req.json().catch(() => ({}));
  if (body.username && body.username !== user.username) {
    if (body.username.length < 3 || body.username.length > 20) return err('Username 3–20 chars');
    const existing = await env.KV.get(`user:name:${body.username.toLowerCase()}`);
    if (existing && existing !== payload.sub) return err('Username taken', 409);
    await env.KV.delete(`user:name:${user.username.toLowerCase()}`);
    await env.KV.put(`user:name:${body.username.toLowerCase()}`, payload.sub);
    user.username = body.username;
  }
  if (typeof body.withdrawalAddress === 'string') user.withdrawalAddress = body.withdrawalAddress;

  await env.KV.put(`user:id:${payload.sub}`, JSON.stringify(user));
  return json({ user: sanitize(user) });
});

// ─────────────────────────────────────────────────────────────────────────────
// BET  POST /api/bet
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/bet', async (req, env) => {
  const payload = await requireAuth(req, env);
  if (!payload) return err('Unauthorized', 401);

  const body = await req.json().catch(() => ({}));
  const { game, bet, payout, profit, currency, multiplier } = body;

  if (!game || typeof bet !== 'number' || bet <= 0) return err('Invalid bet');
  if (!['lyko','gold','cyber'].includes(currency)) return err('Invalid currency');

  const raw = await env.KV.get(`user:id:${payload.sub}`);
  if (!raw) return err('Not found', 404);
  const user = JSON.parse(raw);

  if ((user.balances[currency] || 0) < bet) return err('Insufficient balance', 402);

  // Apply
  user.balances[currency] = Math.max(0, (user.balances[currency] || 0) - bet + (payout || 0));

  // Stats
  const s = user.stats;
  s.totalBets++;
  s.totalWagered += bet;
  s.totalWon += (payout || 0);
  if (bet > s.maxWager) s.maxWager = bet;
  if ((payout || 0) > s.maxWin) s.maxWin = payout;
  if ((multiplier || 0) > s.maxMultiplier) s.maxMultiplier = multiplier;
  if (profit > 0) s.wins++; else s.losses++;

  // Transaction history (last 100)
  const tx = { id: uid(), type: 'bet', game, bet, payout: payout || 0, profit: profit || 0, currency, multiplier: multiplier || 0, ts: Date.now() };
  user.transactions = [tx, ...(user.transactions || [])].slice(0, 100);

  await env.KV.put(`user:id:${payload.sub}`, JSON.stringify(user));

  // Update leaderboard (top 20 by totalWon stored in a single KV key)
  try {
    const lbRaw = await env.KV.get('leaderboard') || '[]';
    let lb = JSON.parse(lbRaw);
    const entry = {
      id: payload.sub,
      username: user.username,
      totalWon: s.totalWon,
      totalWagered: s.totalWagered,
      totalBets: s.totalBets,
      wins: s.wins,
      losses: s.losses,
      maxWin: s.maxWin,
      maxMultiplier: s.maxMultiplier,
      updatedAt: Date.now()
    };
    lb = lb.filter(e => e.id !== payload.sub);
    lb.push(entry);
    lb.sort((a, b) => b.totalWon - a.totalWon);
    lb = lb.slice(0, 20);
    await env.KV.put('leaderboard', JSON.stringify(lb));
  } catch (e) { /* non-fatal */ }

  // Broadcast to live feed via Durable Object
  try {
    const doId = env.FEED.idFromName('global-feed');
    const stub = env.FEED.get(doId);
    await stub.fetch('https://internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user.username, game, bet, payout: payout || 0, profit: profit || 0, currency, multiplier: multiplier || 0, ts: Date.now() })
    });
  } catch (e) { /* non-fatal */ }

  return json({ user: sanitize(user), tx });
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS  GET /api/stats/:userId
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/stats/:userId', async (req, env) => {
  const payload = await requireAuth(req, env);
  if (!payload) return err('Unauthorized', 401);
  const { userId } = req.params;
  if (userId !== payload.sub) return err('Forbidden', 403);

  const raw = await env.KV.get(`user:id:${userId}`);
  if (!raw) return err('Not found', 404);
  const user = JSON.parse(raw);
  return json({ stats: user.stats, transactions: (user.transactions || []).slice(0, 50) });
});

// ─────────────────────────────────────────────────────────────────────────────
// LEADERBOARD  GET /api/leaderboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/leaderboard', async (req, env) => {
  // Public endpoint — top 20 stored in KV, updated on each bet
  const raw = await env.KV.get('leaderboard') || '[]';
  const lb = JSON.parse(raw);
  return json({ leaderboard: lb.slice(0, 20) });
});

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket upgrade — delegate to Durable Object
// ─────────────────────────────────────────────────────────────────────────────
router.get('/ws', async (req, env) => {
  const doId = env.FEED.idFromName('global-feed');
  const stub = env.FEED.get(doId);
  return stub.fetch(req);
});

// OPTIONS preflight
router.options('*', () => cors(new Response(null, { status: 204 })));
router.all('*', () => err('Not found', 404));

// ── Helper ────────────────────────────────────────────────────────────────────
function sanitize(u) {
  const { pwHash, ...safe } = u;
  return safe;
}

// ── Export ────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx).catch(e => err(e.message, 500));
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DURABLE OBJECT — LiveFeed
// Manages WebSocket connections and broadcasts bet events in real time
// ─────────────────────────────────────────────────────────────────────────────
export class LiveFeed {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.history = []; // last 50 events
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/broadcast') {
      const event = await request.json();
      this.history = [event, ...this.history].slice(0, 50);
      const msg = JSON.stringify({ type: 'bet', ...event });
      for (const ws of this.sessions) {
        try { ws.send(msg); } catch { this.sessions.delete(ws); }
      }
      return new Response('ok');
    }

    // WebSocket upgrade
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    server.accept();
    this.sessions.add(server);

    // Send history on connect
    server.send(JSON.stringify({ type: 'history', events: this.history }));

    server.addEventListener('close', () => this.sessions.delete(server));
    server.addEventListener('error', () => this.sessions.delete(server));

    return new Response(null, { status: 101, webSocket: client });
  }
}
