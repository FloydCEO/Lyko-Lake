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
        io.emit('gameState', allPlayers);
    }
}, 1000); // Every second, send full game state

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`New player connected: ${socket.id}`);

    // Handle new player
    socket.on('playerJoin', (playerData) => {
        players.set(socket.id, {
            id: socket.id,
            name: playerData.name,
            color: playerData.color,
            x: playerData.x,
            y: playerData.y
        });

        // Send current players to new player
        socket.emit('currentPlayers', Array.from(players.values()));

        // Notify all other players about new player
        socket.broadcast.emit('newPlayer', players.get(socket.id));

        console.log(`Player joined: ${playerData.name} (Total: ${players.size})`);
    });

    // Handle player movement
    socket.on('playerMove', (movement) => {
        if (players.has(socket.id)) {
            const player = players.get(socket.id);
            player.x = movement.x;
            player.y = movement.y;
            player.lastUpdate = Date.now();

            // Broadcast to all other players immediately
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
            console.log(`Player disconnected: ${player.name} (Remaining: ${players.size - 1})`);
            players.delete(socket.id);
            
            // Notify all players
            io.emit('playerDisconnected', socket.id);
        }
    });
});

server.listen(PORT, () => {
    console.log(`🎮 Lyko Lake Server running on port ${PORT}`);
    console.log(`🌐 Visit http://localhost:${PORT} to play`);
});
