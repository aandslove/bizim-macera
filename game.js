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

function preload() {}

function create() {
  this.cameras.main.setBackgroundColor('#1e272e');

  // Bilgilendirme Yazıları
  statusText = this.add.text(20, 15, 'Odaya bağlanılıyor...', { fontSize: '13px', fill: '#f1c40f' });
  missionText = this.add.text(400, 25, '1. Butona bas -> Partnerin geçsin -> 2. Butona bassın -> Sen geç!', { 
    fontSize: '14px', fill: '#ffffff', backgroundColor: '#34495e', padding: { x: 8, y: 4 } 
  }).setOrigin(0.5);

  winText = this.add.text(400, 300, 'HARİKA İŞBİRLİĞİ! ❤️\n1. ODA GEÇİLDİ', { 
    fontSize: '26px', fill: '#2ecc71', backgroundColor: '#000000', align: 'center', padding: { x: 20, y: 12 } 
  }).setOrigin(0.5).setVisible(false);

  // Görsel Çizimleri
  const g = this.make.graphics({ x: 0, y: 0, add: false });

  // Mavi Karakter
  g.fillStyle(0x0984e3, 1); g.fillRoundedRect(0, 0, 38, 38, 8);
  g.generateTexture('texMavi', 38, 38);

  // Pembe Karakter
  g.clear(); g.fillStyle(0xfd79a8, 1); g.fillRoundedRect(0, 0, 38, 38, 8);
  g.generateTexture('texPembe', 38, 38);

  // Basınç Butonları (Sarı ve Turuncu)
  g.clear(); g.fillStyle(0xf1c40f, 1); g.fillRoundedRect(0, 0, 45, 45, 6);
  g.generateTexture('texButton1', 45, 45);

  g.clear(); g.fillStyle(0xe67e22, 1); g.fillRoundedRect(0, 0, 45, 45, 6);
  g.generateTexture('texButton2', 45, 45);

  // Geçilmez Gri Duvar Parçası
  g.clear(); g.fillStyle(0x7f8c8d, 1); g.fillRect(0, 0, 30, 200);
  g.generateTexture('texWall', 30, 200);

  // Kırmızı Lazer Kapı (Ortadaki Geçit)
  g.clear(); g.fillStyle(0xe74c3c, 1); g.fillRect(0, 0, 30, 200);
  g.generateTexture('texDoor', 30, 200);

  // Yeşil Çıkış Portalı
  g.clear(); g.fillStyle(0x2ecc71, 1); g.fillCircle(28, 28, 28);
  g.generateTexture('texExit', 56, 56);

  // 1. DÜNYAYI İKİYE BÖLEN DUVARLAR (Geçilmez)
  walls = this.physics.add.staticGroup();
  walls.create(400, 100, 'texWall'); // Üst duvar (0 - 200 px arası)
  walls.create(400, 500, 'texWall'); // Alt duvar (400 - 600 px arası)

  // 2. KAPI, BUTONLAR VE PORTAL
  // Kırmızı kapı tam ortada (200 - 400 px arası) yer alır
  laserDoor = this.physics.add.staticSprite(400, 300, 'texDoor');

  button1 = this.physics.add.staticSprite(120, 150, 'texButton1'); // Sol odadaki buton
  button2 = this.physics.add.staticSprite(680, 450, 'texButton2'); // Sağ odadaki buton
  exitPortal = this.physics.add.staticSprite(680, 150, 'texExit');  // Sağ odadaki çıkış

  // Buton İsimleri
  this.add.text(120, 150, '1. Buton', { fontSize: '11px', fill: '#000' }).setOrigin(0.5);
  this.add.text(680, 450, '2. Buton', { fontSize: '11px', fill: '#fff' }).setOrigin(0.5);

  // 3. KARAKTERLER
  myPlayer = this.physics.add.sprite(100, 450, 'texMavi');
  myPlayer.setCollideWorldBounds(true);

  remotePlayer = this.physics.add.sprite(200, 450, 'texPembe');
  remotePlayer.setCollideWorldBounds(true);

  // Fizik Çarpışmaları (Karakterler duvardan ve kapalı kapıdan ASLA geçemez)
  this.physics.add.collider(myPlayer, walls);
  this.physics.add.collider(remotePlayer, walls);
  this.physics.add.collider(myPlayer, laserDoor);
  this.physics.add.collider(remotePlayer, laserDoor);

  // İsim Etiketleri
  myLabel = this.add.text(myPlayer.x, myPlayer.y - 28, 'Sen', { fontSize: '12px', fill: '#fff' }).setOrigin(0.5);
  remoteLabel = this.add.text(remotePlayer.x, remotePlayer.y - 28, 'Partnerin', { fontSize: '12px', fill: '#fff' }).setOrigin(0.5);

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
    statusText.setText('Bağlandı! Oda Aktif').setStyle({ fill: '#00b894' });
    socket.send(JSON.stringify({ type: 'join', id: myId }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'join' && data.id !== myId) {
      socket.send(JSON.stringify({ type: 'assign_role', targetId: data.id, role: 'p2', x: myPlayer.x, y: myPlayer.y }));
    }

    if (data.type === 'assign_role' && data.targetId === myId) {
      myRole = 'p2';
      myPlayer.setTexture('texPembe');
      remotePlayer.setTexture('texMavi');
    }

    if (data.type === 'move' && data.id !== myId) {
      targetRemoteX = data.x;
      targetRemoteY = data.y;
    }

    if (data.type === 'door_state') {
      setDoorOpen(scene, data.isOpen);
    }
  };

  socket.onerror = () => { statusText.setText('Bağlantı Bekleniyor...').setStyle({ fill: '#d63031' }); };
  socket.onclose = () => { setTimeout(() => connectWebSocket(scene), 3000); };
}

function setDoorOpen(scene, open) {
  isDoorOpen = open;
  if (open) {
    laserDoor.disableBody(true, true); // Kapıyı aç
  } else {
    laserDoor.enableBody(false, 400, 300, true, true); // Kapıyı kilitle
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

  myLabel.setPosition(myPlayer.x, myPlayer.y - 28);
  remoteLabel.setPosition(remotePlayer.x, remotePlayer.y - 28);

  remotePlayer.x = Phaser.Math.Linear(remotePlayer.x, targetRemoteX, 0.35);
  remotePlayer.y = Phaser.Math.Linear(remotePlayer.y, targetRemoteY, 0.35);

  // Buton Kontrolleri: 1. Butona VEYA 2. Butona herhangi biri basıyor mu?
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

  // Bölüm Bitirme: İki karakter de sağ odadaki yeşil portalda mı?
  const myOnExit = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), exitPortal.getBounds());
  const remoteOnExit = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), exitPortal.getBounds());

  if (myOnExit && remoteOnExit) {
    winText.setVisible(true);
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
