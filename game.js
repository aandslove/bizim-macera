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

let myPlayer, remotePlayer, myLabel, remoteLabel;
let cursors, touchPointer, socket, statusText, missionText;
let winBanner, winOverlay, winEmitter;
let button1, button2, laserDoor, exitPortal, walls;
let isDoorOpen = false;
let gameFinished = false;

const myId = Math.random().toString(36).substring(7);
let myRole = 'p1';
let targetRemoteX = 200;
let targetRemoteY = 450;
let lastSendTime = 0;

function preload() {
  this.load.image('fotoBen', 'ben.png');
  this.load.image('fotoO', 'o.png');
}

function create() {
  // 1. Mor & Kalp Desenli Dinamik Arka Plan
  const bgG = this.make.graphics({ x: 0, y: 0, add: false });
  bgG.fillStyle(0x2d0c4e, 1);
  bgG.fillRect(0, 0, 800, 600);
  bgG.generateTexture('texBg', 800, 600);
  this.add.image(400, 300, 'texBg').setDepth(0);

  // Arka plana serpiştirilmiş tatlı mor-pembe kalpler
  const heartColors = ['#5a189a', '#7b2cbf', '#9d4edd', '#4a0e4e'];
  for (let i = 0; i < 45; i++) {
    const rx = Phaser.Math.Between(20, 780);
    const ry = Phaser.Math.Between(20, 580);
    const rColor = heartColors[Phaser.Math.Between(0, heartColors.length - 1)];
    const rSize = Phaser.Math.Between(14, 26);
    this.add.text(rx, ry, '💜', { fontSize: `${rSize}px`, color: rColor })
      .setOrigin(0.5)
      .setAlpha(0.35)
      .setDepth(1);
  }

  // 2. Arayüz Panelleri
  statusText = this.add.text(20, 15, 'Odaya bağlanılıyor...', { fontSize: '13px', fill: '#f1c40f' }).setDepth(10);
  missionText = this.add.text(400, 25, '✨ Görev: Birlikte engelleri aşıp portala ulaşın! ✨', { 
    fontSize: '15px', fill: '#ffffff', backgroundColor: '#5c1d8c', padding: { x: 12, y: 6 } 
  }).setOrigin(0.5).setDepth(10);

  // 3. Oyun İçi Nesne Dokuları
  const g = this.make.graphics({ x: 0, y: 0, add: false });

  // Düğme Zeminleri (Neon Kenarlı)
  g.fillStyle(0x3a0ca3, 1); g.fillRoundedRect(0, 0, 56, 56, 12);
  g.lineStyle(3, 0xf72585, 1); g.strokeRoundedRect(0, 0, 56, 56, 12);
  g.generateTexture('texBtnBase1', 56, 56);

  g.clear();
  g.fillStyle(0x3a0ca3, 1); g.fillRoundedRect(0, 0, 56, 56, 12);
  g.lineStyle(3, 0x4cc9f0, 1); g.strokeRoundedRect(0, 0, 56, 56, 12);
  g.generateTexture('texBtnBase2', 56, 56);

  // Duvarlar (Koyu Kristal Taş)
  g.clear();
  g.fillStyle(0x3c096c, 1); g.fillRect(0, 0, 32, 200);
  g.lineStyle(2, 0x7b2cbf, 0.8); g.strokeRect(0, 0, 32, 200);
  g.generateTexture('texWall', 32, 200);

  // Lazer Kapı (Kırmızı/Pembe Neon Geçit)
  g.clear();
  g.fillStyle(0xff0054, 0.9); g.fillRect(0, 0, 32, 200);
  g.lineStyle(3, 0xff5400, 1); g.strokeRect(0, 0, 32, 200);
  g.generateTexture('texDoor', 32, 200);

  // Çıkış Portalı
  g.clear();
  g.fillStyle(0x06d6a0, 0.8); g.fillCircle(32, 32, 32);
  g.lineStyle(4, 0xffffff, 1); g.strokeCircle(32, 32, 32);
  g.generateTexture('texExit', 64, 64);

  // Parçacık Yıldız/Kalp Dokusu (Kutlama için)
  g.clear();
  g.fillStyle(0xffbe0b, 1); g.fillCircle(6, 6, 6);
  g.generateTexture('texParticle', 12, 12);

  // 4. Harita Elemanlarını Yerleştirme
  walls = this.physics.add.staticGroup();
  walls.create(400, 100, 'texWall').setDepth(3);
  walls.create(400, 500, 'texWall').setDepth(3);

  laserDoor = this.physics.add.staticSprite(400, 300, 'texDoor').setDepth(4);

  button1 = this.physics.add.staticSprite(120, 150, 'texBtnBase1').setDepth(2);
  this.add.text(120, 150, '🔘', { fontSize: '26px' }).setOrigin(0.5).setDepth(2);

  button2 = this.physics.add.staticSprite(680, 450, 'texBtnBase2').setDepth(2);
  this.add.text(680, 450, '🔘', { fontSize: '26px' }).setOrigin(0.5).setDepth(2);

  exitPortal = this.physics.add.staticSprite(680, 150, 'texExit').setDepth(2);
  this.add.text(680, 150, '💖', { fontSize: '28px' }).setOrigin(0.5).setDepth(3);

  // 5. Karakterler
  myPlayer = this.physics.add.sprite(100, 450, 'fotoBen').setDisplaySize(48, 48).setDepth(5);
  myPlayer.setCollideWorldBounds(true);

  remotePlayer = this.physics.add.sprite(200, 450, 'fotoO').setDisplaySize(48, 48).setDepth(5);
  remotePlayer.setCollideWorldBounds(true);

  // Fizik Çarpışmaları
  this.physics.add.collider(myPlayer, walls);
  this.physics.add.collider(remotePlayer, walls);
  this.physics.add.collider(myPlayer, laserDoor);
  this.physics.add.collider(remotePlayer, laserDoor);

  // İsim Etiketleri
  myLabel = this.add.text(myPlayer.x, myPlayer.y - 32, 'Sen', { 
    fontSize: '12px', fill: '#ffffff', backgroundColor: '#7209b7', padding: { x: 5, y: 2 } 
  }).setOrigin(0.5).setDepth(6);

  remoteLabel = this.add.text(remotePlayer.x, remotePlayer.y - 32, 'Sevgilin', { 
    fontSize: '12px', fill: '#ffffff', backgroundColor: '#f72585', padding: { x: 5, y: 2 } 
  }).setOrigin(0.5).setDepth(6);

  // 6. Şatafatlı Tebrik Ekranı (En Üst Katman - Depth: 100)
  winOverlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.75).setDepth(90).setVisible(false);

  winBanner = this.add.text(400, 300, '👑 HARİKASINIZ! 👑\n\nBölüm Başarıyla Geçildi ❤️\n\n✨ Birlikte Her Şeyi Başarabilirsiniz ✨', {
    fontSize: '24px',
    fill: '#ffbe0b',
    backgroundColor: '#3a0ca3',
    padding: { x: 30, y: 20 },
    align: 'center',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(100).setVisible(false);

  // Konfeti Efekti
  winEmitter = this.add.particles(400, 150, 'texParticle', {
    speed: { min: 100, max: 300 },
    angle: { min: 0, max: 360 },
    scale: { start: 1, end: 0 },
    blendMode: 'ADD',
    lifespan: 1500,
    gravityY: 150,
    emitting: false
  }).setDepth(95);

  // Kontroller
  cursors = this.input.keyboard.createCursorKeys();
  this.input.on('pointerdown', (pointer) => { touchPointer = pointer; });
  this.input.on('pointermove', (pointer) => { if (pointer.isDown) touchPointer = pointer; });
  this.input.on('pointerup', () => { touchPointer = null; });

  connectWebSocket(this);
}

function connectWebSocket(scene) {
  socket = new WebSocket(SERVER_URL);

  socket.onopen = () => {
    statusText.setText('Bağlandı! Oda Aktif').setStyle({ fill: '#06d6a0' });
    socket.send(JSON.stringify({ type: 'join', id: myId }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'join' && data.id !== myId) {
      socket.send(JSON.stringify({ type: 'assign_role', targetId: data.id, role: 'p2', x: myPlayer.x, y: myPlayer.y }));
    }

    if (data.type === 'assign_role' && data.targetId === myId) {
      myRole = 'p2';
      myPlayer.setTexture('fotoO').setDisplaySize(48, 48);
      remotePlayer.setTexture('fotoBen').setDisplaySize(48, 48);
      myLabel.setStyle({ backgroundColor: '#f72585' });
      remoteLabel.setStyle({ backgroundColor: '#7209b7' });
    }

    if (data.type === 'move' && data.id !== myId) {
      targetRemoteX = data.x;
      targetRemoteY = data.y;
    }

    if (data.type === 'door_state') {
      setDoorOpen(scene, data.isOpen);
    }

    if (data.type === 'game_win') {
      triggerWinScreen();
    }
  };

  socket.onerror = () => { statusText.setText('Bağlantı Bekleniyor...').setStyle({ fill: '#ff0054' }); };
  socket.onclose = () => { setTimeout(() => connectWebSocket(scene), 3000); };
}

function setDoorOpen(scene, open) {
  isDoorOpen = open;
  if (open) {
    laserDoor.disableBody(true, true);
  } else {
    laserDoor.enableBody(false, 400, 300, true, true);
  }
}

function triggerWinScreen() {
  if (gameFinished) return;
  gameFinished = true;
  winOverlay.setVisible(true);
  winBanner.setVisible(true);
  winEmitter.start();
}

function update(time) {
  const speed = 250;
  myPlayer.setVelocity(0);

  if (cursors.left.isDown) myPlayer.setVelocityX(-speed);
  else if (cursors.right.isDown) myPlayer.setVelocityX(speed);

  if (cursors.up.isDown) myPlayer.setVelocityY(-speed);
  else if (cursors.down.isDown) myPlayer.setVelocityY(speed);

  if (touchPointer && touchPointer.isDown) {
    const dist = Phaser.Math.Distance.Between(myPlayer.x, myPlayer.y, touchPointer.worldX, touchPointer.worldY);
    if (dist > 15) {
      this.physics.moveTo(myPlayer, touchPointer.worldX, touchPointer.worldY, speed);
    }
  }

  myLabel.setPosition(myPlayer.x, myPlayer.y - 32);
  remoteLabel.setPosition(remotePlayer.x, remotePlayer.y - 32);

  remotePlayer.x = Phaser.Math.Linear(remotePlayer.x, targetRemoteX, 0.35);
  remotePlayer.y = Phaser.Math.Linear(remotePlayer.y, targetRemoteY, 0.35);

  // Buton Kontrolü
  const onBtn1 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), button1.getBounds()) ||
                 Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), button1.getBounds());

  const onBtn2 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), button2.getBounds()) ||
                 Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), button2.getBounds());

  const shouldDoorBeOpen = onBtn1 || onBtn2;

  if (shouldDoorBeOpen !== isDoorOpen) {
    setDoorOpen(this, shouldDoorBeOpen);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'door_state', isOpen: shouldDoorBeOpen }));
    }
  }

  // Birlikte Çıkış Kontrolü
  const myOnExit = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), exitPortal.getBounds());
  const remoteOnExit = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), exitPortal.getBounds());

  if (myOnExit && remoteOnExit && !gameFinished) {
    triggerWinScreen();
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'game_win' }));
    }
  }

  // Konum Yayınlama
  if (socket && socket.readyState === WebSocket.OPEN && time > lastSendTime + 50) {
    if (myPlayer.body.velocity.x !== 0 || myPlayer.body.velocity.y !== 0) {
      socket.send(JSON.stringify({
        type: 'move', id: myId,
        x: Math.round(myPlayer.x), y: Math.round(myPlayer.y)
      }));
      lastSendTime = time;
    }
  }
}
