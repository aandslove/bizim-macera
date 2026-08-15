const config = {
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 600
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 0 }, debug: false }
  },
  scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);
let player;       // Bizim karakterimiz (Mavi)
let otherPlayer;  // Kız arkadaşının karakteri (Pembe)
let cursors;
let touchPointer;
let socket;
let lastX = 0;
let lastY = 0;

function preload() {}

function create() {
  const self = this;
  this.cameras.main.setBackgroundColor('#2c3e50');

  // 1. Bizim Karakterimiz (Mavi Kutu)
  const g1 = this.make.graphics({ x: 0, y: 0, add: false });
  g1.fillStyle(0x3498db, 1);
  g1.fillRoundedRect(0, 0, 40, 40, 10);
  g1.generateTexture('playerTexture', 40, 40);

  player = this.physics.add.sprite(200, 300, 'playerTexture');
  player.setCollideWorldBounds(true);

  // 2. İkinci Karakter (Pembe Kutu)
  const g2 = this.make.graphics({ x: 0, y: 0, add: false });
  g2.fillStyle(0xe84393, 1);
  g2.fillRoundedRect(0, 0, 40, 40, 10);
  g2.generateTexture('otherPlayerTexture', 40, 40);

  otherPlayer = this.physics.add.sprite(600, 300, 'otherPlayerTexture');
  otherPlayer.setCollideWorldBounds(true);

  // 3. WebSocket Sunucusuna Bağlantı
  socket = new WebSocket('wss://bizim-sunucu.onrender.com/ws');

  socket.onmessage = function (event) {
    const data = JSON.parse(event.data);
    // Diğer telefondan gelen konumu pembe karaktere yansıt
    if (data.x !== undefined && data.y !== undefined) {
      otherPlayer.setPosition(data.x, data.y);
    }
  };

  // Kontroller
  cursors = this.input.keyboard.createCursorKeys();

  this.input.on('pointerdown', (pointer) => { touchPointer = pointer; });
  this.input.on('pointermove', (pointer) => { if (pointer.isDown) touchPointer = pointer; });
  this.input.on('pointerup', () => { touchPointer = null; });
}

function update() {
  const speed = 250;
  player.setVelocity(0);

  // Klavye Kontrolü
  if (cursors.left.isDown) player.setVelocityX(-speed);
  else if (cursors.right.isDown) player.setVelocityX(speed);

  if (cursors.up.isDown) player.setVelocityY(-speed);
  else if (cursors.down.isDown) player.setVelocityY(speed);

  // Dokunmatik Kontrol
  if (touchPointer && touchPointer.isDown) {
    const distance = Phaser.Math.Distance.Between(player.x, player.y, touchPointer.worldX, touchPointer.worldY);
    if (distance > 15) {
      this.physics.moveTo(player, touchPointer.worldX, touchPointer.worldY, speed);
    }
  }

  // Konum değiştiğinde sunucu üzerinden diğer telefona gönder
  if (socket && socket.readyState === WebSocket.OPEN) {
    const xDiff = Math.abs(player.x - lastX);
    const yDiff = Math.abs(player.y - lastY);
    if (xDiff > 1 || yDiff > 1) {
      socket.send(JSON.stringify({ x: player.x, y: player.y }));
      lastX = player.x;
      lastY = player.y;
    }
  }
}
