const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Config ─────────────────────────────────────────────────────────────────
const MAP_W = 3000;
const MAP_H = 3000;
const TICK_RATE = 50; // ms
const ANIMAL_COUNT = 60;
const ITEM_SPAWN_COUNT = 40;

// ─── XP & Levels ────────────────────────────────────────────────────────────
const XP_TABLE = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5800, 8000];
// Index = level, value = XP needed to reach next level
const MAX_LEVEL = 10; // unlock next island at max level

function xpForLevel(level) {
  return XP_TABLE[Math.min(level, MAX_LEVEL)] || 99999;
}

// ─── Item Definitions ────────────────────────────────────────────────────────
const ITEMS = {
  // Weapons
  stick:       { id: 'stick',       name: 'Stick',       type: 'weapon', damage: 8,  speed: 1.0, icon: '🪵', rarity: 'common',   desc: 'A simple stick.'         },
  stone_axe:   { id: 'stone_axe',   name: 'Stone Axe',   type: 'weapon', damage: 18, speed: 0.9, icon: '🪓', rarity: 'common',   desc: 'Crude but effective.'     },
  iron_sword:  { id: 'iron_sword',  name: 'Iron Sword',  type: 'weapon', damage: 32, speed: 1.1, icon: '⚔️', rarity: 'uncommon', desc: 'A balanced blade.'        },
  magic_staff:  { id: 'magic_staff', name: 'Magic Staff', type: 'weapon', damage: 45, speed: 0.8, icon: '🪄', rarity: 'rare',     desc: 'Hums with energy.'       },
  // Armor
  leather_helm:{ id: 'leather_helm',name: 'Leather Helm',type: 'armor',  defense: 5, slot: 'head',  icon: '🪖', rarity: 'common',   desc: 'Basic head protection.'  },
  chain_vest:  { id: 'chain_vest',  name: 'Chain Vest',  type: 'armor',  defense: 12, slot: 'body', icon: '🛡️', rarity: 'uncommon', desc: 'Linked steel rings.'     },
  // Consumables
  apple:       { id: 'apple',       name: 'Apple',       type: 'food',   heal: 20,   icon: '🍎', rarity: 'common',   desc: 'Restores 20 HP.'         },
  meat:        { id: 'meat',        name: 'Raw Meat',    type: 'food',   heal: 40,   icon: '🥩', rarity: 'common',   desc: 'Restores 40 HP.'         },
  elixir:      { id: 'elixir',      name: 'Elixir',      type: 'food',   heal: 100,  icon: '🧪', rarity: 'rare',     desc: 'Fully restores HP.'      },
  // Resources
  wood:        { id: 'wood',        name: 'Wood',        type: 'resource', icon: '🪵', rarity: 'common', desc: 'Crafting material.'       },
  stone:       { id: 'stone',       name: 'Stone',       type: 'resource', icon: '🪨', rarity: 'common', desc: 'Crafting material.'       },
};

// ─── Animal Definitions ──────────────────────────────────────────────────────
const ANIMAL_TYPES = [
  { type: 'rabbit',  name: 'Rabbit',  hp: 30,  maxHp: 30,  damage: 3,  xp: 15,  speed: 1.8, size: 14, color: '#c8a86b', aggro: false, icon: '🐇', loot: ['meat', 'wood']         },
  { type: 'wolf',    name: 'Wolf',    hp: 80,  maxHp: 80,  damage: 14, xp: 40,  speed: 1.5, size: 20, color: '#888',    aggro: true,  icon: '🐺', loot: ['meat', 'leather_helm'] },
  { type: 'bear',    name: 'Bear',    hp: 200, maxHp: 200, damage: 28, xp: 90,  speed: 1.0, size: 28, color: '#6b4c2a', aggro: true,  icon: '🐻', loot: ['meat', 'chain_vest']   },
  { type: 'boar',    name: 'Boar',    hp: 60,  maxHp: 60,  damage: 10, xp: 30,  speed: 1.3, size: 18, color: '#7a5c4e', aggro: false, icon: '🐗', loot: ['meat', 'stone']        },
  { type: 'spider',  name: 'Spider',  hp: 40,  maxHp: 40,  damage: 8,  xp: 20,  speed: 1.6, size: 15, color: '#333',    aggro: true,  icon: '🕷️', loot: ['apple', 'stick']       },
];

// ─── Game State ──────────────────────────────────────────────────────────────
let players = {};
let animals = {};
let groundItems = {};
let trees = [];
let rocks = [];

// ─── Utility ─────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function spawnGroundItem(x, y, itemId) {
  const id = uuidv4();
  groundItems[id] = { id, itemId, x, y };
  return id;
}

// ─── Map Objects ─────────────────────────────────────────────────────────────
function generateMap() {
  trees = [];
  rocks = [];
  for (let i = 0; i < 80; i++) {
    trees.push({ id: uuidv4(), x: rand(100, MAP_W - 100), y: rand(100, MAP_H - 100), r: rand(20, 35) });
  }
  for (let i = 0; i < 50; i++) {
    rocks.push({ id: uuidv4(), x: rand(100, MAP_W - 100), y: rand(100, MAP_H - 100), r: rand(15, 28) });
  }
}

// ─── Animal Spawning ─────────────────────────────────────────────────────────
function spawnAnimal() {
  const template = ANIMAL_TYPES[Math.floor(Math.random() * ANIMAL_TYPES.length)];
  const id = uuidv4();
  animals[id] = {
    ...JSON.parse(JSON.stringify(template)),
    id,
    x: rand(100, MAP_W - 100),
    y: rand(100, MAP_H - 100),
    vx: 0, vy: 0,
    target: null,
    wanderTimer: 0,
    wanderX: 0, wanderY: 0,
    attackCooldown: 0,
    dead: false,
  };
}

function initAnimals() {
  animals = {};
  for (let i = 0; i < ANIMAL_COUNT; i++) spawnAnimal();
}

// ─── Ground Items ─────────────────────────────────────────────────────────────
function initGroundItems() {
  groundItems = {};
  const itemIds = Object.keys(ITEMS);
  for (let i = 0; i < ITEM_SPAWN_COUNT; i++) {
    const itemId = itemIds[Math.floor(Math.random() * itemIds.length)];
    spawnGroundItem(rand(100, MAP_W - 100), rand(100, MAP_H - 100), itemId);
  }
}

// ─── Player Factory ───────────────────────────────────────────────────────────
function createPlayer(socketId, name) {
  return {
    id: socketId,
    name: name || 'Unknown',
    x: rand(300, MAP_W - 300),
    y: rand(300, MAP_H - 300),
    vx: 0, vy: 0,
    hp: 100, maxHp: 100,
    xp: 0, level: 1,
    inventory: [],        // array of { id, itemId }
    equipped: { weapon: null, head: null, body: null },
    attackCooldown: 0,
    dead: false,
    deathTimer: 0,
    kills: 0,
    playerKills: 0,
  };
}

// ─── XP / Level Up ───────────────────────────────────────────────────────────
function addXP(player, amount) {
  player.xp += amount;
  let leveled = false;
  while (player.level < MAX_LEVEL && player.xp >= xpForLevel(player.level)) {
    player.xp -= xpForLevel(player.level);
    player.level++;
    player.maxHp = 100 + (player.level - 1) * 20;
    player.hp = player.maxHp; // full heal on level up
    leveled = true;
  }
  return leveled;
}

// ─── Inventory ───────────────────────────────────────────────────────────────
const INV_SIZE = 10;

function giveItem(player, itemId) {
  if (player.inventory.length >= INV_SIZE) return false;
  player.inventory.push({ id: uuidv4(), itemId });
  return true;
}

function useItem(player, invId) {
  const idx = player.inventory.findIndex(i => i.id === invId);
  if (idx === -1) return;
  const { itemId } = player.inventory[idx];
  const def = ITEMS[itemId];
  if (!def) return;

  if (def.type === 'food') {
    player.hp = Math.min(player.maxHp, player.hp + def.heal);
    player.inventory.splice(idx, 1);
    io.to(player.id).emit('itemUsed', { itemId, heal: def.heal });
  } else if (def.type === 'weapon') {
    player.equipped.weapon = itemId;
    io.to(player.id).emit('equipped', { slot: 'weapon', itemId });
  } else if (def.type === 'armor') {
    player.equipped[def.slot] = itemId;
    io.to(player.id).emit('equipped', { slot: def.slot, itemId });
  }
}

function dropItem(player, invId) {
  const idx = player.inventory.findIndex(i => i.id === invId);
  if (idx === -1) return;
  const { itemId } = player.inventory[idx];
  player.inventory.splice(idx, 1);
  spawnGroundItem(player.x + rand(-30, 30), player.y + rand(-30, 30), itemId);
}

// ─── Combat ──────────────────────────────────────────────────────────────────
function getPlayerDamage(player) {
  const w = player.equipped.weapon ? ITEMS[player.equipped.weapon] : null;
  return w ? w.damage : 5; // fists = 5
}

function getPlayerDefense(player) {
  let def = 0;
  if (player.equipped.head && ITEMS[player.equipped.head]) def += ITEMS[player.equipped.head].defense || 0;
  if (player.equipped.body && ITEMS[player.equipped.body]) def += ITEMS[player.equipped.body].defense || 0;
  return def;
}

function attackAnimal(player, animalId) {
  if (player.attackCooldown > 0 || player.dead) return;
  const animal = animals[animalId];
  if (!animal || animal.dead) return;
  if (dist(player, animal) > 80) return;

  const dmg = Math.max(1, getPlayerDamage(player) - 2);
  animal.hp -= dmg;
  player.attackCooldown = 600;

  io.emit('hitEffect', { x: animal.x, y: animal.y, dmg });

  if (animal.aggro) animal.target = player.id;

  if (animal.hp <= 0) killAnimal(player, animalId);
}

function killAnimal(killer, animalId) {
  const animal = animals[animalId];
  if (!animal || animal.dead) return;
  animal.dead = true;
  killer.kills++;

  const leveled = addXP(killer, animal.xp);
  io.to(killer.id).emit('xpGain', { amount: animal.xp, leveled, level: killer.level, xp: killer.xp, nextXp: xpForLevel(killer.level) });
  if (leveled) io.to(killer.id).emit('levelUp', { level: killer.level });

  // drop loot
  const lootTable = animal.loot || [];
  lootTable.forEach(itemId => {
    if (Math.random() < 0.65) spawnGroundItem(animal.x + rand(-20, 20), animal.y + rand(-20, 20), itemId);
  });

  delete animals[animalId];
  io.emit('animalDied', animalId);

  // respawn after delay
  setTimeout(spawnAnimal, 8000);
}

function attackPlayer(attackerId, targetId) {
  const attacker = players[attackerId];
  const target = players[targetId];
  if (!attacker || !target || attacker.dead || target.dead) return;
  if (attacker.attackCooldown > 0) return;
  if (dist(attacker, target) > 80) return;

  const dmg = Math.max(1, getPlayerDamage(attacker) - getPlayerDefense(target));
  target.hp -= dmg;
  attacker.attackCooldown = 600;

  io.emit('hitEffect', { x: target.x, y: target.y, dmg });

  if (target.hp <= 0) killPlayer(attackerId, targetId);
}

function killPlayer(killerId, deadId) {
  const killer = players[killerId];
  const dead = players[deadId];
  if (!dead) return;

  dead.dead = true;
  dead.deathTimer = 5000;

  if (killer) {
    killer.kills++;
    killer.playerKills++;
    const leveled = addXP(killer, 200); // player kills = 200 XP
    io.to(killer.id).emit('xpGain', { amount: 200, leveled, level: killer.level, xp: killer.xp, nextXp: xpForLevel(killer.level) });
    if (leveled) io.to(killer.id).emit('levelUp', { level: killer.level });
    io.to(killer.id).emit('playerKill', { name: dead.name });
  }

  // drop their inventory on death
  dead.inventory.forEach(inv => {
    spawnGroundItem(dead.x + rand(-40, 40), dead.y + rand(-40, 40), inv.itemId);
  });
  dead.inventory = [];
  dead.equipped = { weapon: null, head: null, body: null };

  io.to(deadId).emit('youDied', { killerName: killer ? killer.name : 'the void' });
}

// ─── Animal AI ───────────────────────────────────────────────────────────────
function tickAnimals(dt) {
  const now = Date.now();
  Object.values(animals).forEach(animal => {
    if (animal.dead) return;
    if (animal.attackCooldown > 0) animal.attackCooldown -= dt;

    let targetPlayer = null;
    if (animal.aggro && animal.target && players[animal.target] && !players[animal.target].dead) {
      targetPlayer = players[animal.target];
    }

    // Aggro detection
    if (animal.aggro && !animal.target) {
      Object.values(players).forEach(p => {
        if (!p.dead && dist(animal, p) < 200) {
          animal.target = p.id;
        }
      });
    }

    if (targetPlayer) {
      // Chase player
      const d = dist(animal, targetPlayer);
      if (d > 3000) { animal.target = null; return; }
      const angle = Math.atan2(targetPlayer.y - animal.y, targetPlayer.x - animal.x);
      animal.vx = Math.cos(angle) * animal.speed * 1.5;
      animal.vy = Math.sin(angle) * animal.speed * 1.5;

      // Attack
      if (d < 40 && animal.attackCooldown <= 0) {
        const def = getPlayerDefense(targetPlayer);
        const dmg = Math.max(1, animal.damage - def);
        targetPlayer.hp -= dmg;
        animal.attackCooldown = 1000;
        io.emit('hitEffect', { x: targetPlayer.x, y: targetPlayer.y, dmg });
        io.to(targetPlayer.id).emit('playerHurt', { hp: targetPlayer.hp, maxHp: targetPlayer.maxHp });

        if (targetPlayer.hp <= 0) killPlayer(null, targetPlayer.id);
      }
    } else {
      // Wander
      animal.wanderTimer -= dt;
      if (animal.wanderTimer <= 0) {
        animal.wanderTimer = rand(2000, 5000);
        animal.wanderX = rand(50, MAP_W - 50);
        animal.wanderY = rand(50, MAP_H - 50);
      }
      const angle = Math.atan2(animal.wanderY - animal.y, animal.wanderX - animal.x);
      const d = dist(animal, { x: animal.wanderX, y: animal.wanderY });
      if (d > 10) {
        animal.vx = Math.cos(angle) * animal.speed * 0.6;
        animal.vy = Math.sin(angle) * animal.speed * 0.6;
      } else {
        animal.vx = 0; animal.vy = 0;
      }
    }

    animal.x = clamp(animal.x + animal.vx, 20, MAP_W - 20);
    animal.y = clamp(animal.y + animal.vy, 20, MAP_H - 20);
  });
}

function tickPlayers(dt) {
  Object.values(players).forEach(p => {
    if (p.attackCooldown > 0) p.attackCooldown -= dt;

    if (p.dead) {
      p.deathTimer -= dt;
      if (p.deathTimer <= 0) respawnPlayer(p);
      return;
    }

    // Move
    p.x = clamp(p.x + p.vx, 20, MAP_W - 20);
    p.y = clamp(p.y + p.vy, 20, MAP_H - 20);

    // Ground item pickup proximity
    Object.values(groundItems).forEach(gi => {
      if (dist(p, gi) < 30) {
        if (giveItem(p, gi.itemId)) {
          delete groundItems[gi.id];
          io.to(p.id).emit('pickedUp', { itemId: gi.itemId, inventory: p.inventory, equipped: p.equipped });
          io.emit('groundItemRemoved', gi.id);
        }
      }
    });
  });
}

function respawnPlayer(player) {
  player.dead = false;
  player.hp = player.maxHp;
  player.x = rand(300, MAP_W - 300);
  player.y = rand(300, MAP_H - 300);
  player.vx = 0; player.vy = 0;
  player.inventory = [];
  player.equipped = { weapon: null, head: null, body: null };
  io.to(player.id).emit('respawned', getPlayerState(player));
}

function getPlayerState(p) {
  return {
    id: p.id, name: p.name, x: p.x, y: p.y,
    hp: p.hp, maxHp: p.maxHp,
    xp: p.xp, level: p.level, nextXp: xpForLevel(p.level),
    inventory: p.inventory, equipped: p.equipped,
    kills: p.kills, playerKills: p.playerKills,
    dead: p.dead,
  };
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = now - lastTick;
  lastTick = now;

  tickAnimals(dt);
  tickPlayers(dt);

  // Broadcast world state
  io.emit('worldState', {
    players: Object.values(players).filter(p => !p.dead).map(p => ({
      id: p.id, name: p.name, x: p.x, y: p.y,
      hp: p.hp, maxHp: p.maxHp, level: p.level, dead: p.dead,
      equipped: p.equipped,
    })),
    animals: Object.values(animals).map(a => ({
      id: a.id, type: a.type, name: a.name, x: a.x, y: a.y,
      hp: a.hp, maxHp: a.maxHp, size: a.size, color: a.color, icon: a.icon,
    })),
    groundItems: Object.values(groundItems),
  });
}, TICK_RATE);

// ─── Socket Events ────────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[+] Player connected: ${socket.id}`);

  socket.on('join', ({ name }) => {
    players[socket.id] = createPlayer(socket.id, name || 'Wanderer');
    socket.emit('init', {
      player: getPlayerState(players[socket.id]),
      map: { width: MAP_W, height: MAP_H, trees, rocks },
      items: ITEMS,
    });
    console.log(`[+] ${name} joined`);
  });

  socket.on('move', ({ vx, vy }) => {
    const p = players[socket.id];
    if (!p || p.dead) return;
    const spd = 3.5 + (p.level - 1) * 0.1;
    p.vx = clamp(vx, -1, 1) * spd;
    p.vy = clamp(vy, -1, 1) * spd;
  });

  socket.on('attackAnimal', ({ animalId }) => {
    const p = players[socket.id];
    if (!p) return;
    attackAnimal(p, animalId);
  });

  socket.on('attackPlayer', ({ targetId }) => {
    attackPlayer(socket.id, targetId);
  });

  socket.on('useItem', ({ invId }) => {
    const p = players[socket.id];
    if (!p) return;
    useItem(p, invId);
    socket.emit('inventoryUpdate', { inventory: p.inventory, equipped: p.equipped, hp: p.hp });
  });

  socket.on('dropItem', ({ invId }) => {
    const p = players[socket.id];
    if (!p) return;
    dropItem(p, invId);
    socket.emit('inventoryUpdate', { inventory: p.inventory, equipped: p.equipped, hp: p.hp });
    io.emit('groundItemSpawned', Object.values(groundItems).slice(-1)[0]);
  });

  socket.on('respawn', () => {
    const p = players[socket.id];
    if (p && p.dead) respawnPlayer(p);
  });

  socket.on('disconnect', () => {
    const p = players[socket.id];
    if (p) {
      p.inventory.forEach(inv => spawnGroundItem(p.x + rand(-40, 40), p.y + rand(-40, 40), inv.itemId));
      console.log(`[-] ${p.name} disconnected`);
    }
    delete players[socket.id];
  });
});

// ─── Init & Start ─────────────────────────────────────────────────────────────
generateMap();
initAnimals();
initGroundItems();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 LykoIO server running → http://localhost:${PORT}\n`);
});
