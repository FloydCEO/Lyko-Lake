const config = {
    type: Phaser.AUTO,
    width: 1000,
    height: 700,
    backgroundColor: '#101018',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: {
        preload,
        create,
        update
    }
};

let player;
let cursors;
let border;
let gridGraphics;

function preload() {}

function create() {
    const worldSize = 2000;
    this.physics.world.setBounds(0, 0, worldSize, worldSize);

    // Draw grid
    gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x222222, 0.6);
    for (let x = 0; x < worldSize; x += 50) gridGraphics.lineBetween(x, 0, x, worldSize);
    for (let y = 0; y < worldSize; y += 50) gridGraphics.lineBetween(0, y, worldSize, y);

    // Border outline
    border = this.add.graphics();
    border.lineStyle(10, 0xffffff, 1);
    border.strokeRect(0, 0, worldSize, worldSize);

    // Player circle
    player = this.add.circle(500, 500, 20, 0x00ccff);
    this.physics.add.existing(player);
    player.body.setCollideWorldBounds(true);

    // Camera follows player
    this.cameras.main.setBounds(0, 0, worldSize, worldSize);
    this.cameras.main.startFollow(player);

    cursors = this.input.keyboard.createCursorKeys();
}

function update() {
    const speed = 200;
    player.body.setVelocity(0);

    if (cursors.left.isDown) player.body.setVelocityX(-speed);
    if (cursors.right.isDown) player.body.setVelocityX(speed);
    if (cursors.up.isDown) player.body.setVelocityY(-speed);
    if (cursors.down.isDown) player.body.setVelocityY(speed);
}

new Phaser.Game(config);
