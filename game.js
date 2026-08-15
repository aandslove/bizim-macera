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
let buttonPlate, laserDoor, exitPortal;
let isDoorOpen = false;

const myId = Math.random().toString(36).substring(7);
let myRole = 'p1';
let targetRemoteX = 600;
let targetRemoteY = 500;
let lastSendTime = 0;

function preload() {}

function create() {
  this.cameras.main.setBackgroundColor('#1e272e');

  // Bilgi Metinleri
  statusText = this.add.text(20, 20, 'Odaya bağlanılıyor...', { fontSize: '14px', fill: '#f1c40f' });
  missionText = this.add.text(400, 30, 'Görev: Biriniz butona bassın, diğeri kapıdan geçsin!', { 
    fontSize: '16px', fill: '#ffffff', backgroundColor: '#34495e', padding: { x: 8, y: 4 } 
  }).setOrigin(0.5);

  winText = this.add.text(400, 300, 'TEBRİKLER! BÖLÜM GEÇİLDİ ❤️', { 
    fontSize: '28px', fill: '#2ecc71', backgroundColor: '#000000', padding: { x: 15, y: 10 } 
  }).setOrigin(0.5).setVisible(false);

  // Görseller / Dokular
  const g = this.make.graphics({ x: 0, y: 0, add: false });

  // Mavi Karakter
  g.fillStyle(0x0984e3, 1); g.fillRoundedRect(0, 0, 40, 40, 8);
  g.generateTexture('texMavi', 40, 40);

  // Pembe Karakter
  g.clear(); g.fillStyle(0xfd79a8, 1); g.fillRoundedRect(0, 0, 40, 40, 8);
  g.generateTexture('texPembe', 40, 40);

  // Sarı Basınç Butonu
  g.clear(); g.fillStyle(0xf1c40f, 1); g.fillRoundedRect(0, 0, 50, 50, 6);
  g.generateTexture('texButton', 50, 50);

  // Kırmızı Kilitli Kapı / Lazer
  g.clear(); g.fillStyle(0xe74c3c, 1); g.fillRect(0, 0, 30, 200);
  g.generateTexture('texDoor', 30, 200);

  // Yeşil Çıkış Portalı
  g.clear(); g.fillStyle(0x2ecc71, 1); g.fillCircle(30, 30, 30);
  g.generateTexture('texExit', 60, 60);

  // Oyun Nesneleri
  buttonPlate = this.physics.add.staticSprite(200, 150, 'texButton');
  laserDoor = this.physics.add.staticSprite(400, 300, 'texDoor');
  exitPortal = this.physics.add.staticSprite(700, 150, 'texExit');

  // Karakterler
  myPlayer = this.physics.add.sprite(150, 500, 'texMavi');
  myPlayer.setCollideWorldBounds(true);

  remotePlayer = this.physics.add.sprite(250, 500, 'texPembe');
  remotePlayer.setCollideWorldBounds(true);

  // Çarpışmalar (Kapı kapalıyken karakterler geçemez)
  this.physics.add.collider(myPlayer, laserDoor);
  this.physics.add.collider(remotePlayer, laserDoor);

  // İsim Etiketleri
  myLabel = this.add.text(myPlayer.x, myPlayer.y - 30, 'Sen', { fontSize: '13px', fill: '#fff' }).setOrigin(0.5);
  remoteLabel = this.add.text(remotePlayer.x, remotePlayer.y - 30, 'Partnerin', { fontSize: '13px', fill: '#fff' }).setOrigin(0.5);

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
    statusText.setText('Bağlandı!').setStyle({ fill: '#00b894' });
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

    // Buton ve Kapı Durumunun Senkronizasyonu
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
    laserDoor.disableBody(true, true); // Kapıyı görünmez yap ve çarpışmayı kapat
  } else {
    laserDoor.enableBody(false, 400, 300, true, true); // Kapıyı tekrar aktif et
  }
}

function update(time) {
  const speed = 260;
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

  myLabel.setPosition(myPlayer.x, myPlayer.y - 30);
  remoteLabel.setPosition(remotePlayer.x, remotePlayer.y - 30);

  remotePlayer.x = Phaser.Math.Linear(remotePlayer.x, targetRemoteX, 0.35);
  remotePlayer.y = Phaser.Math.Linear(remotePlayer.y, targetRemoteY, 0.35);

  // Butona basılıyor mu kontrolü (Kendi karakterimiz veya partnerimiz butonun üstünde mi?)
  const myOnButton = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), buttonPlate.getBounds());
  const remoteOnButton = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), buttonPlate.getBounds());
  const someoneOnButton = myOnButton || remoteOnButton;

  if (someoneOnButton !== isDoorOpen) {
    setDoorOpen(this, someoneOnButton);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'door_state', isOpen: someoneOnButton }));
    }
  }

  // Bölüm Tamamlama: İkiniz de çıkış portalına ulaştınız mı?
  const myOnExit = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), exitPortal.getBounds());
  const remoteOnExit = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), exitPortal.getBounds());

  if (myOnExit && remoteOnExit) {
    winText.setVisible(true);
  }

  // Konum Gönderimi
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
