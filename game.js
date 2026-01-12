// Multiplayer game using Socket.io
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 800;
const PLAYER_SIZE = 30;
const PLAYER_SPEED = 200;
const GRID_SIZE = 50;

let game;
let socket;
let playerId;
let playerName;
let playerColor;

const colors = [
    0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24,
    0x6c5ce7, 0xa29bfe, 0xfd79a8, 0xe17055,
    0x00b894, 0xfdcb6e, 0x74b9ff, 0x55efc4
];

// Menu functionality
document.getElementById('playButton').addEventListener('click', startGame);
document.getElementById('username').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') startGame();
});

function startGame() {
    const usernameInput = document.getElementById('username');
    const name = usernameInput.value.trim();
    
    if (!name) {
        alert('Please enter your name!');
        return;
    }

    playerName = name;
    playerColor = colors[Math.floor(Math.random() * colors.length)];

    document.getElementById('menu').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';

    initGame();
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
    }

    preload() {
        // No assets needed
    }

    create() {
        console.log('Game scene created');
        
        // Create background grid
        this.createGrid();
        
        // Create boundaries
        this.createBoundaries();

        // Setup keyboard controls
        this.cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Add player count display
        this.playerCountText = this.add.text(10, 10, 'Connecting...', {
            fontSize: '18px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        });

        // Setup multiplayer
        this.setupSocket();
    }

    createGrid() {
        const graphics = this.add.graphics();
        graphics.lineStyle(1, 0x444444, 0.3);

        for (let x = 0; x <= GAME_WIDTH; x += GRID_SIZE) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, GAME_HEIGHT);
        }

        for (let y = 0; y <= GAME_HEIGHT; y += GRID_SIZE) {
            graphics.moveTo(0, y);
            graphics.lineTo(GAME_WIDTH, y);
        }

        graphics.strokePath();
    }

    createBoundaries() {
        const thickness = 20;
        const walls = [
            { x: GAME_WIDTH / 2, y: -thickness / 2, w: GAME_WIDTH, h: thickness },
            { x: GAME_WIDTH / 2, y: GAME_HEIGHT + thickness / 2, w: GAME_WIDTH, h: thickness },
            { x: -thickness / 2, y: GAME_HEIGHT / 2, w: thickness, h: GAME_HEIGHT },
            { x: GAME_WIDTH + thickness / 2, y: GAME_HEIGHT / 2, w: thickness, h: GAME_HEIGHT }
        ];

        this.wallGroup = this.physics.add.staticGroup();

        walls.forEach(wall => {
            const wallSprite = this.add.rectangle(wall.x, wall.y, wall.w, wall.h, 0x333333);
            this.physics.add.existing(wallSprite, true);
            this.wallGroup.add(wallSprite);
        });
    }

    setupSocket() {
        // Connect to server
        socket = io();

        socket.on('connect', () => {
            playerId = socket.id;
            console.log('Connected! Player ID:', playerId);
            
            // Create local player at random position
            const startX = Phaser.Math.Between(100, GAME_WIDTH - 100);
            const startY = Phaser.Math.Between(100, GAME_HEIGHT - 100);

            console.log('Sending playerJoin event:', { name: playerName, color: playerColor, x: startX, y: startY });

            // Send join event
            socket.emit('playerJoin', {
                name: playerName,
                color: playerColor,
                x: startX,
                y: startY
            });

            // Create local player
            this.createPlayer(playerId, playerName, playerColor, startX, startY, true);
        });

        // Receive current players
        socket.on('currentPlayers', (players) => {
            console.log('Received current players:', players);
            players.forEach(playerData => {
                if (playerData.id !== playerId) {
                    console.log('Creating remote player:', playerData);
                    this.createPlayer(
                        playerData.id,
                        playerData.name,
                        playerData.color,
                        playerData.x,
                        playerData.y,
                        false
                    );
                }
            });
            this.updatePlayerCount();
        });

        // New player joined
        socket.on('newPlayer', (playerData) => {
            console.log('New player joined:', playerData);
            this.createPlayer(
                playerData.id,
                playerData.name,
                playerData.color,
                playerData.x,
                playerData.y,
                false
            );
            this.updatePlayerCount();
        });

        // Player moved
        socket.on('playerMoved', (movement) => {
            console.log('Player moved:', movement);
            if (this.players.has(movement.id)) {
                const player = this.players.get(movement.id);
                player.circle.x = movement.x;
                player.circle.y = movement.y;
                console.log(`Updated player ${movement.id} to position:`, movement.x, movement.y);
            } else {
                console.warn('Received movement for unknown player:', movement.id);
            }
        });

        // Player disconnected
        socket.on('playerDisconnected', (disconnectedPlayerId) => {
            console.log('Player disconnected:', disconnectedPlayerId);
            if (this.players.has(disconnectedPlayerId)) {
                const player = this.players.get(disconnectedPlayerId);
                player.circle.destroy();
                player.nameText.destroy();
                this.players.delete(disconnectedPlayerId);
                this.updatePlayerCount();
            }
        });

        // Periodic game state sync
        socket.on('gameState', (allPlayers) => {
            console.log('Received game state:', allPlayers);
            allPlayers.forEach(playerData => {
                if (playerData.id !== playerId) {
                    if (this.players.has(playerData.id)) {
                        const player = this.players.get(playerData.id);
                        player.circle.x = playerData.x;
                        player.circle.y = playerData.y;
                    }
                }
            });
        });
    }

    createPlayer(id, name, color, x, y, isLocal) {
        console.log(`Creating player: ${name} (${id}) at ${x},${y} - Local: ${isLocal}`);
        
        const circle = this.add.circle(x, y, PLAYER_SIZE, color);
        const nameText = this.add.text(0, 0, name, {
            fontSize: '14px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        if (isLocal) {
            this.physics.add.existing(circle);
            circle.body.setCollideWorldBounds(true);
            this.physics.add.collider(circle, this.wallGroup);
        }

        this.players.set(id, {
            circle: circle,
            nameText: nameText,
            isLocal: isLocal
        });

        console.log('Total players now:', this.players.size);
    }

    updatePlayerCount() {
        this.playerCountText.setText(`Players: ${this.players.size}`);
    }

    update() {
        const localPlayer = this.players.get(playerId);
        if (!localPlayer || !localPlayer.isLocal) return;

        // Handle WASD movement
        const speed = PLAYER_SPEED;
        const oldX = localPlayer.circle.x;
        const oldY = localPlayer.circle.y;
        
        localPlayer.circle.body.setVelocity(0);

        if (this.cursors.left.isDown) {
            localPlayer.circle.body.setVelocityX(-speed);
        } else if (this.cursors.right.isDown) {
            localPlayer.circle.body.setVelocityX(speed);
        }

        if (this.cursors.up.isDown) {
            localPlayer.circle.body.setVelocityY(-speed);
        } else if (this.cursors.down.isDown) {
            localPlayer.circle.body.setVelocityY(speed);
        }

        // Send position updates every frame if moving
        const newX = Math.round(localPlayer.circle.x);
        const newY = Math.round(localPlayer.circle.y);
        
        if (Math.abs(oldX - newX) > 0.5 || Math.abs(oldY - newY) > 0.5) {
            socket.emit('playerMove', {
                x: newX,
                y: newY
            });
        }

        // Update all player name positions
        this.players.forEach(player => {
            player.nameText.x = player.circle.x;
            player.nameText.y = player.circle.y - PLAYER_SIZE - 10;
        });
    }
}

function initGame() {
    const config = {
        type: Phaser.AUTO,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        parent: 'game-container',
        backgroundColor: '#2d3561',
        physics: {
            default: 'arcade',
            arcade: {
                gravity: { y: 0 },
                debug: false
            }
        },
        scene: GameScene
    };

    game = new Phaser.Game(config);
}
