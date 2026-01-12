const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(__dirname));

// Game state
const players = new Map();

// Send full state updates periodically
setInterval(() => {
    if (players.size > 0) {
        const allPlayers = Array.from(players.values());
        console.log(`Broadcasting game state to ${players.size} players`);
        io.emit('gameState', allPlayers);
    }
}, 1000);

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`\n[CONNECTION] New player connected: ${socket.id}`);
    console.log(`[INFO] Total connections: ${io.engine.clientsCount}`);

    // Handle new player
    socket.on('playerJoin', (playerData) => {
        console.log(`[JOIN] Player joining:`, playerData);
        
        players.set(socket.id, {
            id: socket.id,
            name: playerData.name,
            color: playerData.color,
            x: playerData.x,
            y: playerData.y,
            lastUpdate: Date.now()
        });

        console.log(`[JOIN] Player ${playerData.name} added to game`);
        console.log(`[INFO] Total players in game: ${players.size}`);

        // Send current players to new player
        const currentPlayers = Array.from(players.values());
        console.log(`[SYNC] Sending ${currentPlayers.length} players to new player`);
        socket.emit('currentPlayers', currentPlayers);

        // Notify all other players about new player
        console.log(`[BROADCAST] Notifying other players about ${playerData.name}`);
        socket.broadcast.emit('newPlayer', players.get(socket.id));
    });

    // Handle player movement
    socket.on('playerMove', (movement) => {
        if (players.has(socket.id)) {
            const player = players.get(socket.id);
            player.x = movement.x;
            player.y = movement.y;
            player.lastUpdate = Date.now();

            // Broadcast to all other players
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: movement.x,
                y: movement.y
            });
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        if (players.has(socket.id)) {
            const player = players.get(socket.id);
            console.log(`\n[DISCONNECT] Player left: ${player.name}`);
            players.delete(socket.id);
            console.log(`[INFO] Remaining players: ${players.size}`);
            
            // Notify all players
            io.emit('playerDisconnected', socket.id);
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🎮 Lyko Lake Server running`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`📡 Network: http://YOUR_IP:${PORT}`);
    console.log(`========================================\n`);
});
