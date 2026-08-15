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
let cursors, touchPointer, socket, statusText, missionText, winText;
let button1, button2, laserDoor, exitPortal, walls;
let isDoorOpen = false;

const myId = Math.random().toString(36).substring(7);
let myRole = 'p1';
let targetRemoteX = 200;
let targetRemoteY = 450;
let lastSendTime = 0;

function preload() {
  // Yüklediğin fotoğrafları içeri aktarıyoruz (Eğer uzantın .jpg ise burayı .jpg yap)
  this.load.image('fotoBen', 'ben.png');
  this.load.image('fotoO', 'o.png');
}

function create() {
  // Arka plan: Koyu zindan mavisi/mor
  this.cameras.main.setBackgroundColor('#130f40');

  // Bilgi Paneli
  statusText = this.add.text(20, 15, 'Odaya bağlanılıyor...', { fontSize: '13px', fill: '#f1c40f' });
  missionText = this.add.text(400, 25, '❤️ Birlikte Zindandan Kaçış ❤️', { 
    fontSize: '15px', fill: '#ffffff', backgroundColor: '#30336b', padding: { x: 12, y: 6 } 
  }).setOrigin(0.5);

  winText = this.add.text(400, 300, '🎉 HARİKASINIZ! BÖLÜM GEÇİLDİ 🎉', { 
    fontSize: '26px', fill: '#6ab04c', backgroundColor: '#130f40', padding: { x: 20, y: 15 } 
  }).setOrigin(0.5).setVisible(false);

  // Görsel Çizimleri (Dekoratif Nesneler)
  const g = this.make.graphics({ x: 0, y: 0, add: false });

  // 1. Basınç Butonları (Neon Sarı ve Mor/Pembe)
  g.fillStyle(0xf9ca24, 1); g.fillRoundedRect(0, 0, 50, 50, 8);
  g.generateTexture('texButton1', 50, 50);

  g.clear(); g.fillStyle(0xe056fd, 1); g.fillRoundedRect(0, 0, 50, 50, 8);
  g.generateTexture('texButton2', 50, 50);

  // 2. Taş Duvarlar (Koyu Gri Zindan Duvarı)
  g.clear(); g.fillStyle(0x535c68, 1); g.fillRect(0, 0, 30, 200);
  g.generateTexture('texWall', 30, 200);

  // 3. Parlak Lazer Kapı (Kırmızı/Turuncu Işıma)
  g.clear(); g.fillStyle(0xff3838, 1); g.fillRect(0, 0, 30, 200);
  g.generateTexture('texDoor', 30, 200);

  // 4. Çıkış Portalı (Aşk Kalbi / Yeşil Portal)
  g.clear(); g.fillStyle(0x6ab04c, 1); g.fillCircle(30, 30, 30);
  g.generateTexture('texExit', 60, 60);

  // Duvarları Oluşturma
  walls = this.physics.add.staticGroup();
  walls.create(400, 100, 'texWall');
  walls.create(400, 500, 'texWall');

  // Kapı, Butonlar ve Çıkış
  laserDoor = this.physics.add.staticSprite(400, 300, 'texDoor');
  button1 = this.physics.add.staticSprite(120, 150, 'texButton1');
  button2 = this.physics.add.staticSprite(680, 450, 'texButton2');
  exitPortal = this.physics.add.staticSprite(680, 150, 'texExit');

  this.add.text(120, 150, '1. Buton', { fontSize: '11px', fill: '#000' }).setOrigin(0.5);
  this.add.text(680, 450, '2. Buton', { fontSize: '11px', fill: '#fff' }).setOrigin(0.5);
  this.add.text(680, 150, 'ÇIKIŞ', { fontSize: '12px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

  // Karakterleri Fotoğraflarla Oluşturma (45x45 boyutuna ölçekliyoruz)
  myPlayer = this.physics.add.sprite(100, 450, 'fotoBen').setDisplaySize(48, 48);
  myPlayer.setCollideWorldBounds(true);

  remotePlayer = this.physics.add.sprite(200, 450, 'fotoO').setDisplaySize(48, 48);
  remotePlayer.setCollideWorldBounds(true);

  // Çarpışmalar
  this.physics.add.collider(myPlayer, walls);
  this.physics.add.collider(remotePlayer, walls);
  this.physics.add.collider(myPlayer, laserDoor);
  this.physics.add.collider(remotePlayer, laserDoor);

  // İsim Etiketleri
  myLabel = this.add.text(myPlayer.x, myPlayer.y - 32, 'Sen', { 
    fontSize: '12px', fill: '#ffffff', backgroundColor: '#22a6b3', padding: { x: 4, y: 2 } 
  }).setOrigin(0.5);

  remoteLabel = this.add.text(remotePlayer.x, remotePlayer.y - 32, 'Sevgilin', { 
    fontSize: '12px', fill: '#ffffff', backgroundColor: '#be2edd', padding: { x: 4, y: 2 } 
  }).setOrigin(0.5);

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
    statusText.setText('Bağlandı! Oda Aktif').setStyle({ fill: '#6ab04c' });
    socket.send(JSON.stringify({ type: 'join', id: myId }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'join' && data.id !== myId) {
      socket.send(JSON.stringify({ type: 'assign_role', targetId: data.id, role: 'p2', x: myPlayer.x, y: myPlayer.y }));
    }

    if (data.type === 'assign_role' && data.targetId === myId) {
      myRole = 'p2';
      // Rol dağılımı: 2. oyuncunun ekranında kendi karakteri 'fotoO', partneri 'fotoBen' olur
      myPlayer.setTexture('fotoO').setDisplaySize(48, 48);
      remotePlayer.setTexture('fotoBen').setDisplaySize(48, 48);
      myLabel.setStyle({ backgroundColor: '#be2edd' });
      remoteLabel.setStyle({ backgroundColor: '#22a6b3' });
    }

    if (data.type === 'move' && data.id !== myId) {
      targetRemoteX = data.x;
      targetRemoteY = data.y;
    }

    if (data.type === 'door_state') {
      setDoorOpen(scene, data.isOpen);
    }
  };

  socket.onerror = () => { statusText.setText('Bağlantı Bekleniyor...').setStyle({ fill: '#eb4d4b' }); };
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

  const myOnExit = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), exitPortal.getBounds());
  const remoteOnExit = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), exitPortal.getBounds());

  if (myOnExit && remoteOnExit) {
    winText.setVisible(true);
  }

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
