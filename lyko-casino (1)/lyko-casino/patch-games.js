#!/usr/bin/env node
/**
 * Auto-patches remaining game HTML files to use lyko.js backend.
 * Run from the project root: node patch-games.js
 *
 * What it does per file:
 * 1. Injects <script src="../casino/lyko.js"></script> before </body>
 * 2. Replaces cookie-based getCookie/loadAcc/saveAcc with Lyko API shims
 * 3. Wraps recordBet() to call Lyko.placeBet()
 * 4. Updates DOMContentLoaded to use Lyko.refreshMe() auth check
 */

const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, 'frontend/casino');
const GAMES = ['hilo.html', 'limbo.html', 'plinko.html', 'mines.html', 'chicken.html', 'keno.html', 'pump.html'];

// Shim to inject just before the closing </script> of each game's script block
// (or inject as a new <script> block before </body>)
const LYKO_SHIM = `
// ── LYKO API SHIM (auto-injected) ────────────────────────────────────────────
// Replaces cookie-based account storage with real backend calls
function loadAcc() { return Lyko.getUser(); }
function saveAcc(acc) { /* no-op: backend is source of truth */ }
function refreshDisplays(acc) { Lyko.refreshDisplays(acc || Lyko.getUser()); }
function getBalance() { return Lyko.getBalance(); }
function getActiveCurrency() { return Lyko.getActiveCurrency(); }
function setCurrency(c) { Lyko.setCurrency(c); }
function openAccount(e) { if (e) e.preventDefault(); Lyko.openAccount(); }

// Wraps the original recordBet to also call the real API
const _origRecordBet = typeof recordBet !== 'undefined' ? recordBet : null;
async function recordBet(game, bet, currency, payout, mult) {
  try {
    const result = await Lyko.placeBet({ game, bet, payout, profit: payout - bet, currency, multiplier: mult || 0 });
    Lyko.refreshDisplays(result.user);
  } catch (e) {
    console.error('[Lyko] recordBet failed:', e.message);
    // Fallback: refresh from local cache
    Lyko.refreshDisplays();
  }
}
// ─────────────────────────────────────────────────────────────────────────────
`;

const SCRIPT_TAG = `<script src="../casino/lyko.js"></script>\n`;

// DOMContentLoaded replacement
function patchDOMReady(html, gameName) {
  // Find the DOMContentLoaded handler and wrap it
  const oldInit = `window.addEventListener('DOMContentLoaded',()=>{
  const acc=loadAcc();
  if(!acc){window.location.href='../casino.html';return;}
  refreshDisplays();`;

  const oldInit2 = `window.addEventListener('DOMContentLoaded', () => {
  const acc = loadAcc();
  if (!acc) { window.location.href = '../casino.html'; return; }
  refreshDisplays();`;

  const newInit = `window.addEventListener('DOMContentLoaded', async () => {
  let user = Lyko.getUser();
  if (!user || !Lyko.getToken()) {
    Lyko.showAuthModal(u => { Lyko.refreshDisplays(u); _afterAuthInit(); });
    return;
  }
  const fresh = await Lyko.refreshMe();
  if (!fresh) { Lyko.showAuthModal(u => { Lyko.refreshDisplays(u); _afterAuthInit(); }); return; }
  Lyko.refreshDisplays(fresh);
  _afterAuthInit();
  function _afterAuthInit() {
    const acc = Lyko.getUser(); if (!acc) return;
    Lyko.refreshDisplays(acc);`;

  if (html.includes(oldInit)) {
    html = html.replace(oldInit, newInit);
  } else if (html.includes(oldInit2)) {
    html = html.replace(oldInit2, newInit);
  }
  return html;
}

let patched = 0;
for (const game of GAMES) {
  const filePath = path.join(GAMES_DIR, game);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${game} not found, skipping`);
    continue;
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Skip if already patched
  if (html.includes('lyko.js')) {
    console.log(`✓  ${game} already patched`);
    continue;
  }

  // 2. Inject lyko.js script tag before </body>
  html = html.replace('</body>', SCRIPT_TAG + '</body>');

  // 3. Inject the shim just before the final </script> in the page's inline script
  // Find the last </script> tag
  const lastScript = html.lastIndexOf('</script>');
  if (lastScript !== -1) {
    html = html.slice(0, lastScript) + LYKO_SHIM + html.slice(lastScript);
  }

  // 4. Patch DOMContentLoaded
  html = patchDOMReady(html, game);

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✅  ${game} patched`);
  patched++;
}

console.log(`\n${patched} files patched.`);
console.log('\nNext steps:');
console.log('1. Update casino/lyko.js → const API = "https://your-worker.workers.dev"');
console.log('2. Deploy worker: cd worker && wrangler deploy');
console.log('3. Serve frontend/ on any static host');
