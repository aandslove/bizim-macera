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

let currentLevel = 0; // 0: Lobi, 1: Bölüm 1, 2: Bölüm 2, 3: Bölüm 3
let myPlayer, remotePlayer, myLabel, remoteLabel;
let cursors, touchPointer, socket, statusText, missionText;
let winBanner, winOverlay, winEmitter;
let levelMenuContainer;

// Dinamik Bölüm Nesneleri
let wallsGroup, doorsGroup, buttonsGroup, portalsGroup;
let dynamicObjects = [];

const myId = Math.random().toString(36).substring(7);
let myRole = 'p1'; // p1: Sen (Mavi), p2: Sevgilin (Pembe)
let targetRemoteX = 450;
let targetRemoteY = 400;
let lastSendTime = 0;
let gameFinished = false;

function preload() {
  this.load.image('fotoBen', 'ben.png');
  this.load.image('fotoO', 'o.png');
}

function create() {
  // Arka Plan Çizimi
  const bgG = this.make.graphics({ x: 0, y: 0, add: false });
  bgG.fillStyle(0x2d0c4e, 1);
  bgG.fillRect(0, 0, 800, 600);
  bgG.generateTexture('texBg', 800, 600);
  this.add.image(400, 300, 'texBg').setDepth(0);

  // Kalp Desenleri
  for (let i = 0; i < 40; i++) {
    const rx = Phaser.Math.Between(20, 780);
    const ry = Phaser.Math.Between(20, 580);
    this.add.text(rx, ry, '💜', { fontSize: `${Phaser.Math.Between(14, 24)}px`, color: '#5a189a' })
      .setOrigin(0.5).setAlpha(0.3).setDepth(1);
  }

  // Arayüz
  statusText = this.add.text(20, 15, 'Odaya bağlanılıyor...', { fontSize: '13px', fill: '#f1c40f' }).setDepth(20);
  missionText = this.add.text(400, 25, '', { 
    fontSize: '14px', fill: '#ffffff', backgroundColor: '#5c1d8c', padding: { x: 10, y: 5 } 
  }).setOrigin(0.5).setDepth(20);

  // Doku Üretimi
  buildTextures(this);

  // Fizik Grupları
  wallsGroup = this.physics.add.staticGroup();
  doorsGroup = this.physics.add.staticGroup();
  buttonsGroup = this.physics.add.staticGroup();
  portalsGroup = this.physics.add.staticGroup();

  // Karakterler
  myPlayer = this.physics.add.sprite(350, 450, 'fotoBen').setDisplaySize(46, 46).setDepth(10);
  myPlayer.setCollideWorldBounds(true);

  remotePlayer = this.physics.add.sprite(450, 450, 'fotoO').setDisplaySize(46, 46).setDepth(10);
  remotePlayer.setCollideWorldBounds(true);

  this.physics.add.collider(myPlayer, wallsGroup);
  this.physics.add.collider(remotePlayer, wallsGroup);
  this.physics.add.collider(myPlayer, doorsGroup);
  this.physics.add.collider(remotePlayer, doorsGroup);

  // İsim Etiketleri
  myLabel = this.add.text(myPlayer.x, myPlayer.y - 30, 'Sen', { 
    fontSize: '12px', fill: '#ffffff', backgroundColor: '#7209b7', padding: { x: 4, y: 2 } 
  }).setOrigin(0.5).setDepth(11);

  remoteLabel = this.add.text(remotePlayer.x, remotePlayer.y - 30, 'Sevgilin', { 
    fontSize: '12px', fill: '#ffffff', backgroundColor: '#f72585', padding: { x: 4, y: 2 } 
  }).setOrigin(0.5).setDepth(11);

  // Tebrik & Menü Katmanları
  winOverlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.75).setDepth(90).setVisible(false);
  winBanner = this.add.text(400, 260, '👑 BÖLÜM GEÇİLDİ! 👑', {
    fontSize: '24px', fill: '#ffbe0b', backgroundColor: '#3a0ca3', padding: { x: 25, y: 15 }, align: 'center'
  }).setOrigin(0.5).setDepth(100).setVisible(false);

  winEmitter = this.add.particles(400, 200, 'texParticle', {
    speed: { min: 100, max: 300 }, angle: { min: 0, max: 360 }, scale: { start: 1, end: 0 },
    blendMode: 'ADD', lifespan: 1200, gravityY: 150, emitting: false
  }).setDepth(95);

  createMenuUI(this);

  // Kontroller
  cursors = this.input.keyboard.createCursorKeys();
  this.input.on('pointerdown', (pointer) => { touchPointer = pointer; });
  this.input.on('pointermove', (pointer) => { if (pointer.isDown) touchPointer = pointer; });
  this.input.on('pointerup', () => { touchPointer = null; });

  loadLevel(this, 0); // Lobi ile başla
  connectWebSocket(this);
}

function buildTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Duvar Dokuları
  g.fillStyle(0x3c096c, 1); g.fillRect(0, 0, 32, 200);
  g.lineStyle(2, 0x7b2cbf, 0.8); g.strokeRect(0, 0, 32, 200);
  g.generateTexture('texWallV', 32, 200);

  g.clear(); g.fillStyle(0x3c096c, 1); g.fillRect(0, 0, 200, 32);
  g.lineStyle(2, 0x7b2cbf, 0.8); g.strokeRect(0, 0, 200, 32);
  g.generateTexture('texWallH', 200, 32);

  // Kırmızı Lazer Kapı
  g.clear(); g.fillStyle(0xff0054, 0.9); g.fillRect(0, 0, 32, 200);
  g.lineStyle(3, 0xff5400, 1); g.strokeRect(0, 0, 32, 200);
  g.generateTexture('texDoorV', 32, 200);

  // Mavi & Pembe Lazer Kapılar
  g.clear(); g.fillStyle(0x4cc9f0, 0.9); g.fillRect(0, 0, 32, 140);
  g.generateTexture('texDoorBlue', 32, 140);

  g.clear(); g.fillStyle(0xf72585, 0.9); g.fillRect(0, 0, 32, 140);
  g.generateTexture('texDoorPink', 32, 140);

  // Buton Tabanı
  g.clear(); g.fillStyle(0x3a0ca3, 1); g.fillRoundedRect(0, 0, 52, 52, 10);
  g.lineStyle(3, 0xffbe0b, 1); g.strokeRoundedRect(0, 0, 52, 52, 10);
  g.generateTexture('texBtnBase', 52, 52);

  // Mavi & Pembe Buton Tabanı
  g.clear(); g.fillStyle(0x3a0ca3, 1); g.fillRoundedRect(0, 0, 52, 52, 10);
  g.lineStyle(3, 0x4cc9f0, 1); g.strokeRoundedRect(0, 0, 52, 52, 10);
  g.generateTexture('texBtnBlue', 52, 52);

  g.clear(); g.fillStyle(0x3a0ca3, 1); g.fillRoundedRect(0, 0, 52, 52, 10);
  g.lineStyle(3, 0xf72585, 1); g.strokeRoundedRect(0, 0, 52, 52, 10);
  g.generateTexture('texBtnPink', 52, 52);

  // Çıkış Portalı
  g.clear(); g.fillStyle(0x06d6a0, 0.8); g.fillCircle(30, 30, 30);
  g.lineStyle(3, 0xffffff, 1); g.strokeCircle(30, 30, 30);
  g.generateTexture('texExit', 60, 60);

  // Konfeti Partikülü
  g.clear(); g.fillStyle(0xffbe0b, 1); g.fillCircle(5, 5, 5);
  g.generateTexture('texParticle', 10, 10);
}

function clearCurrentLevel() {
  wallsGroup.clear(true, true);
  doorsGroup.clear(true, true);
  buttonsGroup.clear(true, true);
  portalsGroup.clear(true, true);
  dynamicObjects.forEach(obj => obj.destroy());
  dynamicObjects = [];
  gameFinished = false;
  winOverlay.setVisible(false);
  winBanner.setVisible(false);
}

function loadLevel(scene, lvl) {
  clearCurrentLevel();
  currentLevel = lvl;

  if (lvl === 0) {
    // --- LOBİ ALANI ---
    missionText.setText('🏰 Lobi: Harita masasında buluşup bölüm seçin veya kapıdan girin!');
    
    // Harita Masası (Menü Tetikleyici)
    const table = scene.physics.add.staticSprite(400, 250, 'texBtnBase');
    const tableTxt = scene.add.text(400, 250, '📜\nMenü', { fontSize: '13px', align: 'center' }).setOrigin(0.5).setDepth(3);
    dynamicObjects.push(table, tableTxt);

    // 1. Bölüme Doğrudan Geçiş Portalı
    const lobbyPortal = scene.physics.add.staticSprite(400, 100, 'texExit');
    const portalTxt = scene.add.text(400, 100, 'Bölüm 1\nBaşlat', { fontSize: '11px', align: 'center', fill: '#fff' }).setOrigin(0.5).setDepth(3);
    dynamicObjects.push(lobbyPortal, portalTxt);

    myPlayer.setPosition(350, 480);
    remotePlayer.setPosition(450, 480);
  } 
  else if (lvl === 1) {
    // --- BÖLÜM 1: ÇİFT BUTONLU GEÇİT ---
    missionText.setText('Bölüm 1: 1. Butonu tut -> Partnerin geçip 2. butona bassın!');
    
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    const door = scene.physics.add.staticSprite(400, 300, 'texDoorV');
    door.setName('door1');
    doorsGroup.add(door);

    const b1 = scene.physics.add.staticSprite(120, 150, 'texBtnBase');
    const b1T = scene.add.text(120, 150, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    b1.setName('btn1_1');

    const b2 = scene.physics.add.staticSprite(680, 450, 'texBtnBase');
    const b2T = scene.add.text(680, 450, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    b2.setName('btn1_2');

    const exit = scene.physics.add.staticSprite(680, 150, 'texExit');
    const exitT = scene.add.text(680, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);

    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
    myPlayer.setPosition(100, 450);
    remotePlayer.setPosition(200, 450);
  }
  else if (lvl === 2) {
    // --- BÖLÜM 2: RENK EŞLEŞMESİ (Mavi & Pembe Kapılar) ---
    missionText.setText('Bölüm 2: Mavi Buton Maviye, Pembe Buton Pembeye kapı açar!');

    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    // Üstte Mavi Kapı, Altta Pembe Kapı
    const doorBlue = scene.physics.add.staticSprite(400, 240, 'texDoorBlue').setName('doorBlue');
    const doorPink = scene.physics.add.staticSprite(400, 360, 'texDoorPink').setName('doorPink');
    doorsGroup.add(doorBlue);
    doorsGroup.add(doorPink);

    // Sol Odada Mavi Buton (Sadece p1 basabilir)
    const btnBlue = scene.physics.add.staticSprite(120, 150, 'texBtnBlue').setName('btnBlue');
    const btnBlueT = scene.add.text(120, 150, '💙', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    // Sağ Odada Pembe Buton (Sadece p2 basabilir)
    const btnPink = scene.physics.add.staticSprite(680, 450, 'texBtnPink').setName('btnPink');
    const btnPinkT = scene.add.text(680, 450, '💗', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(680, 150, 'texExit');
    const exitT = scene.add.text(680, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);

    dynamicObjects.push(btnBlue, btnBlueT, btnPink, btnPinkT, exitT);
    myPlayer.setPosition(100, 450);
    remotePlayer.setPosition(200, 450);
  }
  else if (lvl === 3) {
    // --- BÖLÜM 3: EŞZAMANLI BASINÇ (Aynı Anda Basma) ---
    missionText.setText('Bölüm 3: İkiniz de AYNI ANDA köşelerdeki butonlara basmalısınız!');

    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    const centerDoor = scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door3');
    doorsGroup.add(centerDoor);

    const btnSync1 = scene.physics.add.staticSprite(100, 120, 'texBtnBase').setName('btnSync1');
    const btnSync1T = scene.add.text(100, 120, '⏱️', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    const btnSync2 = scene.physics.add.staticSprite(100, 480, 'texBtnBase').setName('btnSync2');
    const btnSync2T = scene.add.text(100, 480, '⏱️', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);

    dynamicObjects.push(btnSync1, btnSync1T, btnSync2, btnSync2T, exitT);
    myPlayer.setPosition(100, 300);
    remotePlayer.setPosition(200, 300);
  }
}

function createMenuUI(scene) {
  levelMenuContainer = scene.add.container(400, 300).setDepth(110).setVisible(false);

  const menuBg = scene.add.rectangle(0, 0, 360, 320, 0x1e0836, 0.95);
  menuBg.setStrokeStyle(3, 0xffbe0b, 1);

  const title = scene.add.text(0, -120, '🗺️ BÖLÜM SEÇİMİ', { 
    fontSize: '20px', fill: '#ffbe0b', fontStyle: 'bold' 
  }).setOrigin(0.5);

  levelMenuContainer.add([menuBg, title]);

  const levels = [
    { name: '🏰 Lobi / Dinlenme', id: 0 },
    { name: '1️⃣ Bölüm 1: İlk İşbirliği', id: 1 },
    { name: '2️⃣ Bölüm 2: Renk Bağı', id: 2 },
    { name: '3️⃣ Bölüm 3: Eşzamanlı Kalp', id: 3 }
  ];

  levels.forEach((lvl, idx) => {
    const btnY = -60 + (idx * 50);
    const btnBox = scene.add.rectangle(0, btnY, 300, 40, 0x4a0e4e, 1).setInteractive({ useHandCursor: true });
    btnBox.setStrokeStyle(2, 0x9d4edd, 1);

    const btnText = scene.add.text(0, btnY, lvl.name, { fontSize: '14px', fill: '#ffffff' }).setOrigin(0.5);

    btnBox.on('pointerdown', () => {
      levelMenuContainer.setVisible(false);
      loadLevel(scene, lvl.id);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'change_level', level: lvl.id }));
      }
    });

    levelMenuContainer.add([btnBox, btnText]);
  });
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
      socket.send(JSON.stringify({ type: 'assign_role', targetId: data.id, role: 'p2', level: currentLevel }));
    }

    if (data.type === 'assign_role' && data.targetId === myId) {
      myRole = 'p2';
      myPlayer.setTexture('fotoO').setDisplaySize(46, 46);
      remotePlayer.setTexture('fotoBen').setDisplaySize(46, 46);
      myLabel.setStyle({ backgroundColor: '#f72585' });
      remoteLabel.setStyle({ backgroundColor: '#7209b7' });
      if (data.level !== undefined && data.level !== currentLevel) {
        loadLevel(scene, data.level);
      }
    }

    if (data.type === 'move' && data.id !== myId) {
      targetRemoteX = data.x;
      targetRemoteY = data.y;
    }

    if (data.type === 'change_level') {
      loadLevel(scene, data.level);
    }

    if (data.type === 'level_win') {
      triggerWin(scene, data.nextLevel);
    }
  };

  socket.onerror = () => { statusText.setText('Bağlantı Bekleniyor...').setStyle({ fill: '#ff0054' }); };
  socket.onclose = () => { setTimeout(() => connectWebSocket(scene), 3000); };
}

function triggerWin(scene, nextLvl) {
  if (gameFinished) return;
  gameFinished = true;
  winOverlay.setVisible(true);
  winBanner.setText(currentLevel === 3 ? '🎉 TÜM BÖLÜMLERİ BİTİRDİNİZ! 🎉\n\nMuhteşem Bir İkilisiniz ❤️' : '👑 BÖLÜM GEÇİLDİ! 👑\n\nSıradaki Odaya Geçiliyor...').setVisible(true);
  winEmitter.start();

  scene.time.delayedCall(2500, () => {
    winEmitter.stop();
    loadLevel(scene, nextLvl);
  });
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

  myLabel.setPosition(myPlayer.x, myPlayer.y - 30);
  remoteLabel.setPosition(remotePlayer.x, remotePlayer.y - 30);

  remotePlayer.x = Phaser.Math.Linear(remotePlayer.x, targetRemoteX, 0.35);
  remotePlayer.y = Phaser.Math.Linear(remotePlayer.y, targetRemoteY, 0.35);

  // --- BÖLÜM ÖZELİNDE ETKİLEŞİMLER ---
  if (currentLevel === 0) {
    // Lobide Harita Masasında Menüyü Aç
    const onTableMy = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), dynamicObjects[0].getBounds());
    const onTableRemote = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), dynamicObjects[0].getBounds());

    if (onTableMy && onTableRemote) {
      levelMenuContainer.setVisible(true);
    }

    // Doğrudan Çıkış Portalıyla Bölüm 1'e Başlama
    const onLobbyExitMy = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), dynamicObjects[2].getBounds());
    const onLobbyExitRemote = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), dynamicObjects[2].getBounds());
    if (onLobbyExitMy && onLobbyExitRemote && !gameFinished) {
      triggerWin(this, 1);
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'level_win', nextLevel: 1 }));
    }
  }
  else if (currentLevel === 1) {
    const b1 = dynamicObjects[0];
    const b2 = dynamicObjects[2];
    const door = doorsGroup.getFirstAlive();

    const onB1 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), b1.getBounds()) || Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), b1.getBounds());
    const onB2 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), b2.getBounds()) || Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), b2.getBounds());

    if (door) {
      if (onB1 || onB2) door.disableBody(true, true);
      else door.enableBody(false, 400, 300, true, true);
    }

    checkExit(this, 2);
  }
  else if (currentLevel === 2) {
    const btnBlue = dynamicObjects[0];
    const btnPink = dynamicObjects[2];
    
    // Mavi Butona sadece Sen (p1), Pembe Butona sadece Sevgilin (p2) basabilir
    const p1Player = myRole === 'p1' ? myPlayer : remotePlayer;
    const p2Player = myRole === 'p2' ? myPlayer : remotePlayer;

    const onBtnBlue = Phaser.Geom.Intersects.RectangleToRectangle(p1Player.getBounds(), btnBlue.getBounds());
    const onBtnPink = Phaser.Geom.Intersects.RectangleToRectangle(p2Player.getBounds(), btnPink.getBounds());

    doorsGroup.getChildren().forEach(door => {
      if (door.name === 'doorBlue') {
        if (onBtnBlue) door.disableBody(true, true);
        else door.enableBody(false, 400, 240, true, true);
      }
      if (door.name === 'doorPink') {
        if (onBtnPink) door.disableBody(true, true);
        else door.enableBody(false, 400, 360, true, true);
      }
    });

    checkExit(this, 3);
  }
  else if (currentLevel === 3) {
    const btnSync1 = dynamicObjects[0];
    const btnSync2 = dynamicObjects[2];
    const door = doorsGroup.getFirstAlive();

    const p1OnB1 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), btnSync1.getBounds());
    const p2OnB2 = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), btnSync2.getBounds());
    const p1OnB2 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), btnSync2.getBounds());
    const p2OnB1 = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), btnSync1.getBounds());

    const isSynchronized = (p1OnB1 && p2OnB2) || (p1OnB2 && p2OnB1);

    if (door) {
      if (isSynchronized) door.disableBody(true, true);
      else door.enableBody(false, 400, 300, true, true);
    }

    checkExit(this, 0); // 3. bölüm bitince tekrar lobiye dön
  }

  // Konum Yayını
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

function checkExit(scene, nextLevelId) {
  const exit = portalsGroup.getFirstAlive();
  if (!exit) return;

  const myOnExit = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), exit.getBounds());
  const remoteOnExit = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), exit.getBounds());

  if (myOnExit && remoteOnExit && !gameFinished) {
    triggerWin(scene, nextLevelId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'level_win', nextLevel: nextLevelId }));
    }
  }
}
