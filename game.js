// Render'daki gerçek bağlantı adresin:
const SERVER_URL = 'wss://bizim-sunucu.onrender.com/ws';

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
let player;
let otherPlayer;
let cursors;
let touchPointer;
let socket;
let statusText;
const myId = Math.random().toString(36).substring(7); // Bize özel rastgele ID
let lastX = 0;
let lastY = 0;

function preload() {}

function create() {
  this.cameras.main.setBackgroundColor('#2c3e50');

  // Ekranda bağlantı durumunu gösteren yazı
  statusText = this.add.text(20, 20, 'Sunucuya baglaniliyor...', { fontSize: '18px', fill: '#f1c40f' });

  // 1. Bizim Karakterimiz (Mavi)
  const g1 = this.make.graphics({ x: 0, y: 0, add: false });
  g1.fillStyle(0x3498db, 1);
  g1.fillRoundedRect(0, 0, 40, 40, 10);
  g1.generateTexture('playerTexture', 40, 40);

  player = this.physics.add.sprite(200, 300, 'playerTexture');
  player.setCollideWorldBounds(true);

  // 2. İkinci Karakter (Pembe)
  const g2 = this.make.graphics({ x: 0, y: 0, add: false });
  g2.fillStyle(0xe84393, 1);
  g2.fillRoundedRect(0, 0, 40, 40, 10);
  g2.generateTexture('otherPlayerTexture', 40, 40);

  otherPlayer = this.physics.add.sprite(600, 300, 'otherPlayerTexture');
  otherPlayer.setCollideWorldBounds(true);

  // 3. WebSocket Bağlantısı
  connectWebSocket();

  // Kontroller
  cursors = this.input.keyboard.createCursorKeys();
  this.input.on('pointerdown', (pointer) => { touchPointer = pointer; });
  this.input.on('pointermove', (pointer) => { if (pointer.isDown) touchPointer = pointer; });
  this.input.on('pointerup', () => { touchPointer = null; });
}

function connectWebSocket() {
  socket = new WebSocket(SERVER_URL);

  socket.onopen = () => {
    statusText.setText('Baglandi! (Oyuncu Hazir)').setStyle({ fill: '#2ecc71' });
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Veri bizden değilse diğer karakterin konumunu güncelle
    if (data.id !== myId && data.x !== undefined && data.y !== undefined) {
      otherPlayer.setPosition(data.x, data.y);
    }
  };

  socket.onerror = (err) => {
    statusText.setText('Baglanti Hatasi! Sunucu uyaniyor olabilir...').setStyle({ fill: '#e74c3c' });
  };

  socket.onclose = () => {
    statusText.setText('Baglanti koptu. Yeniden deneniyor...').setStyle({ fill: '#e67e22' });
    setTimeout(connectWebSocket, 3000); // Koptuğunda otomatik tekrar dene
  };
}

function update() {
  const speed = 250;
  player.setVelocity(0);

  if (cursors.left.isDown) player.setVelocityX(-speed);
  else if (cursors.right.isDown) player.setVelocityX(speed);

  if (cursors.up.isDown) player.setVelocityY(-speed);
  else if (cursors.down.isDown) player.setVelocityY(speed);

  if (touchPointer && touchPointer.isDown) {
    const distance = Phaser.Math.Distance.Between(player.x, player.y, touchPointer.worldX, touchPointer.worldY);
    if (distance > 15) {
      this.physics.moveTo(player, touchPointer.worldX, touchPointer.worldY, speed);
    }
  }

  // Konum değiştiğinde sunucuya ilet
  if (socket && socket.readyState === WebSocket.OPEN) {
    const xDiff = Math.abs(player.x - lastX);
    const yDiff = Math.abs(player.y - lastY);
    if (xDiff > 1 || yDiff > 1) {
      socket.send(JSON.stringify({ id: myId, x: player.x, y: player.y }));
      lastX = player.x;
      lastY = player.y;
    }
  }
}
