# LykoIO 🎮

A browser-based multiplayer roguelike .io game. Start with nothing, loot the island, kill animals and players, level up, and dominate.

## Quick Start

### Windows
Double-click `START_GAME.bat`

### Mac / Linux
```bash
chmod +x start_game.sh
./start_game.sh
```

### Manual
```bash
npm install
node server.js
```

Then open **http://localhost:3000** in your browser.

---

## Multiplayer
To play with friends on the same network:
1. Start the server on your machine
2. Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find your local IP
3. Friends connect to `http://YOUR_IP:3000`

---

## Game Features

### 🗺️ The Island
- 3000×3000 world map with trees, rocks, and scattered loot
- 60 animals roaming the map (rabbits, wolves, bears, boars, spiders)
- 40 items spawned across the map at start
- Minimap showing players and animals

### ⚔️ Combat
- Click an enemy to attack (within range)
- Attack cooldown prevents spam
- Animals have aggro ranges — agressive ones will chase you
- Player kills drop their entire inventory

### 🎒 Inventory (10 slots)
- Auto-pickup when walking over items
- Click item → Use / Equip
- Right-click item → Drop
- Items: Stick, Stone Axe, Iron Sword, Magic Staff, Leather Helm, Chain Vest, Apple, Raw Meat, Elixir, Wood, Stone

### 📈 XP & Leveling
| Source      | XP     |
|-------------|--------|
| Rabbit      | 15     |
| Spider      | 20     |
| Boar        | 30     |
| Wolf        | 40     |
| Bear        | 90     |
| Player kill | **200** |

Level up = full HP restore + higher max HP + faster movement

### 💀 Death & Respawn
- On death: drop all inventory, respawn with nothing
- True roguelike loop — every run starts fresh

---

## Planned: Island 2
Once you hit **Level 10**, the second island will be unlocked (coming soon).

---

## Tech Stack
- **Server**: Node.js + Express + Socket.io
- **Client**: Vanilla HTML5 Canvas + Socket.io client
- No database needed — sessions are ephemeral (roguelike!)
