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

let currentLevel = 0; // 0: Lobi, 1..15: Bölümler
let myPlayer, remotePlayer, myLabel, remoteLabel;
let cursors, touchPointer, socket, statusText, missionText, timerText, levelCountdownText;
let winBanner, winOverlay, winEmitter;
let levelMenuContainer;

// Dinamik Gruplar ve Nesneler
let wallsGroup, doorsGroup, buttonsGroup, portalsGroup, monstersGroup;
let dynamicObjects = [];

const myId = Math.random().toString(36).substring(7);
let myRole = 'p1';
let targetRemoteX = 450;
let targetRemoteY = 400;
let lastSendTime = 0;
let gameFinished = false;

// Zamanlayıcılar
let doorTimerEvent = null;
let remainingDoorTime = 0;
let levelTimerEvent = null;
let levelRemainingSeconds = 0;

// 15 Bölüme Özel Sevgi Dolu Tebrik Mesajları
const winMessages = {
  1: '👑 HARİKASINIZ! 👑\n\nİlk engeli tereyağından kıl çeker gibi aştınız.\nBirlikte her şey çok kolay! ❤️',
  2: '✨ MÜKEMMEL BİR UYUM! ✨\n\nBirbirinize yol açtığınız sürece\naşamayacağınız hiçbir duvar yok! 💖',
  3: '⚡ REFLEKSLER HARİKA! ⚡\n\n2 saniyelik o daracık kapıdan bile\nel ele geçtiniz! ❤️',
  4: '👾 CANAVARDAN KAÇIŞ! 👾\n\nKorkusuz ikili iş başında!\nHiçbir canavar sizi durduramaz. 💖',
  5: '💣 ZAMANA KARŞI ZAFER! 💣\n\nSaniyeler akarken sakin kalıp başardınız.\nİşte gerçek takım ruhu! ❤️',
  6: '🧩 ÇİFT KİLİTLİ ODA! 🧩\n\nAdım adım, sabırla çözdünüz.\nHarikasınız sevgilim! 💖',
  7: '🔥 İKİLİ TEHLİKE! 🔥\n\nİki canavarın arasından sıyrılmak ustalık ister!\nÇok iyiydiniz! ❤️',
  8: '⏳ HIZLI VE DİKKATLİ! ⏳\n\nHem süre hem canavar varken bile\nhiç paniklemediniz! 💖',
  9: '🌀 KARIŞIK LABİRENT! 🌀\n\nDoğru yolları bulup birleştiniz.\nKalpleriniz birbirini buluyor! ❤️',
  10: '💎 ZİNCİRLEME BULMACA! 💎\n\n3 kapıyı sırayla açmak büyük uyum gerektirir.\nMuhteşemsiniz! 💖',
  11: '👾 ÇILGIN KOVALAMACA! 👾\n\nCanavarları atlattınız, yolunuza devam ettiniz!\nHarika bir çiftsiniz! ❤️',
  12: '⚡ SON 10 SANİYE! ⚡\n\nNefes kesen bir bölümdü!\nBirlikte her zorluğu yenersiniz! 💖',
  13: '⚔️ ZİNDANIN KALBİ! ⚔️\n\nHer köşesi tuzak dolu odayı fethettiniz.\nÇok az kaldı! ❤️',
  14: '🛡️ ŞAMPİYONLAR ODASI! 🛡️\n\nTüm mekanikleri ustaca yönettiniz.\nFinale sadece 1 adım! 💖',
  15: '👑 VE BÜYÜK FİNAL! 👑\n\n🎉 15 BÖLÜMÜN HEPSİNİ BİTİRDİNİZ! 🎉\n\nSiz ikiniz birlikte dünyadaki en güçlü takımsınız!\nSonsuza dek el ele... ❤️✨'
};

function preload() {
  this.load.image('fotoBen', 'ben.png');
  this.load.image('fotoO', 'o.png');
}

function create() {
  // Arka Plan
  const bgG = this.make.graphics({ x: 0, y: 0, add: false });
  bgG.fillStyle(0x2d0c4e, 1);
  bgG.fillRect(0, 0, 800, 600);
  bgG.generateTexture('texBg', 800, 600);
  this.add.image(400, 300, 'texBg').setDepth(0);

  // Arka Plan Kalpleri
  for (let i = 0; i < 40; i++) {
    const rx = Phaser.Math.Between(20, 780);
    const ry = Phaser.Math.Between(20, 580);
    this.add.text(rx, ry, '💜', { fontSize: `${Phaser.Math.Between(14, 24)}px`, color: '#5a189a' })
      .setOrigin(0.5).setAlpha(0.3).setDepth(1);
  }

  // Arayüz
  statusText = this.add.text(20, 15, 'Odaya bağlanılıyor...', { fontSize: '13px', fill: '#f1c40f' }).setDepth(20);
  missionText = this.add.text(400, 22, '', { 
    fontSize: '13px', fill: '#ffffff', backgroundColor: '#5c1d8c', padding: { x: 10, y: 4 } 
  }).setOrigin(0.5).setDepth(20);

  timerText = this.add.text(400, 52, '', {
    fontSize: '14px', fill: '#ffbe0b', backgroundColor: '#d63031', padding: { x: 8, y: 3 }, fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(20).setVisible(false);

  levelCountdownText = this.add.text(710, 22, '', {
    fontSize: '14px', fill: '#ffffff', backgroundColor: '#c0392b', padding: { x: 8, y: 4 }, fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(20).setVisible(false);

  buildTextures(this);

  // Gruplar
  wallsGroup = this.physics.add.staticGroup();
  doorsGroup = this.physics.add.staticGroup();
  buttonsGroup = this.physics.add.staticGroup();
  portalsGroup = this.physics.add.staticGroup();
  monstersGroup = this.physics.add.group();

  // Karakterler
  myPlayer = this.physics.add.sprite(350, 450, 'fotoBen').setDisplaySize(44, 44).setDepth(10);
  myPlayer.setCollideWorldBounds(true);

  remotePlayer = this.physics.add.sprite(450, 450, 'fotoO').setDisplaySize(44, 44).setDepth(10);
  remotePlayer.setCollideWorldBounds(true);

  // Çarpışmalar
  this.physics.add.collider(myPlayer, wallsGroup);
  this.physics.add.collider(remotePlayer, wallsGroup);
  this.physics.add.collider(myPlayer, doorsGroup);
  this.physics.add.collider(remotePlayer, doorsGroup);
  this.physics.add.collider(monstersGroup, wallsGroup);
  this.physics.add.collider(monstersGroup, doorsGroup);

  // Canavar Çarpışması
  this.physics.add.overlap(myPlayer, monstersGroup, () => handleMonsterHit(this));
  this.physics.add.overlap(remotePlayer, monstersGroup, () => handleMonsterHit(this));

  // İsim Etiketleri
  myLabel = this.add.text(myPlayer.x, myPlayer.y - 28, 'Sen', { 
    fontSize: '11px', fill: '#ffffff', backgroundColor: '#7209b7', padding: { x: 4, y: 2 } 
  }).setOrigin(0.5).setDepth(11);

  remoteLabel = this.add.text(remotePlayer.x, remotePlayer.y - 28, 'Sevgilin', { 
    fontSize: '11px', fill: '#ffffff', backgroundColor: '#f72585', padding: { x: 4, y: 2 } 
  }).setOrigin(0.5).setDepth(11);

  // Tebrik Katmanı
  winOverlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8).setDepth(90).setVisible(false);
  winBanner = this.add.text(400, 300, '', {
    fontSize: '20px', fill: '#ffbe0b', backgroundColor: '#3a0ca3', padding: { x: 25, y: 15 }, align: 'center', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(100).setVisible(false);

  winEmitter = this.add.particles(400, 180, 'texParticle', {
    speed: { min: 100, max: 300 }, angle: { min: 0, max: 360 }, scale: { start: 1, end: 0 },
    blendMode: 'ADD', lifespan: 1200, gravityY: 150, emitting: false
  }).setDepth(95);

  createMenuUI(this);

  // Kontroller
  cursors = this.input.keyboard.createCursorKeys();
  this.input.on('pointerdown', (pointer) => { touchPointer = pointer; });
  this.input.on('pointermove', (pointer) => { if (pointer.isDown) touchPointer = pointer; });
  this.input.on('pointerup', () => { touchPointer = null; });

  loadLevel(this, 0);
  connectWebSocket(this);
}

function buildTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Duvarlar
  g.fillStyle(0x3c096c, 1); g.fillRect(0, 0, 30, 200);
  g.lineStyle(2, 0x7b2cbf, 0.8); g.strokeRect(0, 0, 30, 200);
  g.generateTexture('texWallV', 30, 200);

  g.clear(); g.fillStyle(0x3c096c, 1); g.fillRect(0, 0, 380, 24);
  g.lineStyle(2, 0x7b2cbf, 0.8); g.strokeRect(0, 0, 380, 24);
  g.generateTexture('texWallLongH', 380, 24);

  g.clear(); g.fillStyle(0x3c096c, 1); g.fillRect(0, 0, 180, 24);
  g.lineStyle(2, 0x7b2cbf, 0.8); g.strokeRect(0, 0, 180, 24);
  g.generateTexture('texWallShortH', 180, 24);

  // Kapılar
  g.clear(); g.fillStyle(0xff0054, 0.9); g.fillRect(0, 0, 30, 200);
  g.lineStyle(3, 0xff5400, 1); g.strokeRect(0, 0, 30, 200);
  g.generateTexture('texDoorV', 30, 200);

  g.clear(); g.fillStyle(0xff0054, 0.9); g.fillRect(0, 0, 30, 120);
  g.lineStyle(2, 0xff5400, 1); g.strokeRect(0, 0, 30, 120);
  g.generateTexture('texDoorShortV', 30, 120);

  g.clear(); g.fillStyle(0x4cc9f0, 0.9); g.fillRect(0, 0, 24, 160);
  g.generateTexture('texDoorSmallBlue', 24, 160);

  g.clear(); g.fillStyle(0xf72585, 0.9); g.fillRect(0, 0, 24, 160);
  g.generateTexture('texDoorSmallPink', 24, 160);

  // Butonlar
  g.clear(); g.fillStyle(0x3a0ca3, 1); g.fillRoundedRect(0, 0, 48, 48, 10);
  g.lineStyle(3, 0xffbe0b, 1); g.strokeRoundedRect(0, 0, 48, 48, 10);
  g.generateTexture('texBtnBase', 48, 48);

  g.clear(); g.fillStyle(0x3a0ca3, 1); g.fillRoundedRect(0, 0, 48, 48, 10);
  g.lineStyle(3, 0x4cc9f0, 1); g.strokeRoundedRect(0, 0, 48, 48, 10);
  g.generateTexture('texBtnBlue', 48, 48);

  g.clear(); g.fillStyle(0x3a0ca3, 1); g.fillRoundedRect(0, 0, 48, 48, 10);
  g.lineStyle(3, 0xf72585, 1); g.strokeRoundedRect(0, 0, 48, 48, 10);
  g.generateTexture('texBtnPink', 48, 48);

  // Çıkış Portalı
  g.clear(); g.fillStyle(0x06d6a0, 0.8); g.fillCircle(28, 28, 28);
  g.lineStyle(3, 0xffffff, 1); g.strokeCircle(28, 28, 28);
  g.generateTexture('texExit', 56, 56);

  // Canavar Dokusu (Kırmızı Parlayan Küre)
  g.clear(); g.fillStyle(0xe74c3c, 1); g.fillCircle(20, 20, 20);
  g.lineStyle(2, 0xff7675, 1); g.strokeCircle(20, 20, 20);
  g.generateTexture('texMonster', 40, 40);

  // Konfeti
  g.clear(); g.fillStyle(0xffbe0b, 1); g.fillCircle(5, 5, 5);
  g.generateTexture('texParticle', 10, 10);
}

function clearCurrentLevel() {
  wallsGroup.clear(true, true);
  doorsGroup.clear(true, true);
  buttonsGroup.clear(true, true);
  portalsGroup.clear(true, true);
  monstersGroup.clear(true, true);
  dynamicObjects.forEach(obj => obj.destroy());
  dynamicObjects = [];
  gameFinished = false;
  winOverlay.setVisible(false);
  winBanner.setVisible(false);
  timerText.setVisible(false);
  levelCountdownText.setVisible(false);

  if (doorTimerEvent) { doorTimerEvent.remove(); doorTimerEvent = null; }
  if (levelTimerEvent) { levelTimerEvent.remove(); levelTimerEvent = null; }
}

function startLevelCountdown(scene, seconds) {
  levelRemainingSeconds = seconds;
  levelCountdownText.setText(`⏱️ ${levelRemainingSeconds}s`).setVisible(true);

  if (levelTimerEvent) levelTimerEvent.remove();

  levelTimerEvent = scene.time.addEvent({
    delay: 1000,
    repeat: seconds - 1,
    callback: () => {
      levelRemainingSeconds--;
      if (levelRemainingSeconds > 0) {
        levelCountdownText.setText(`⏱️ ${levelRemainingSeconds}s`);
      } else {
        levelCountdownText.setText('💥 SÜRE BİTTİ!');
        scene.time.delayedCall(800, () => loadLevel(scene, currentLevel));
      }
    }
  });
}

function createMonster(scene, x, y, vx, vy, isChaser = false) {
  const monster = monstersGroup.create(x, y, 'texMonster');
  monster.setDisplaySize(38, 38).setDepth(8);
  monster.setCollideWorldBounds(true);
  monster.setBounce(1, 1);
  monster.setVelocity(vx, vy);
  monster.setData('isChaser', isChaser);
  
  const mIcon = scene.add.text(x, y, '👾', { fontSize: '20px' }).setOrigin(0.5).setDepth(9);
  dynamicObjects.push(mIcon);
  monster.setData('iconRef', mIcon);
  return monster;
}

function handleMonsterHit(scene) {
  if (gameFinished) return;
  // Canavara çarpınca odayı baştan başlat
  loadLevel(scene, currentLevel);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'change_level', level: currentLevel }));
  }
}

function loadLevel(scene, lvl) {
  clearCurrentLevel();
  currentLevel = lvl;

  // Varsayılan Başlangıç Konumları
  let startX1 = 100, startY1 = 450, startX2 = 200, startY2 = 450;

  if (lvl === 0) {
    // --- LOBİ ---
    missionText.setText('🏰 Lobi: Harita masasında menüyü açın veya kapıdan başlayın!');
    const table = scene.physics.add.staticSprite(400, 250, 'texBtnBase');
    const tableTxt = scene.add.text(400, 250, '📜\nMenü', { fontSize: '13px', align: 'center' }).setOrigin(0.5).setDepth(3);
    dynamicObjects.push(table, tableTxt);

    const lobbyPortal = scene.physics.add.staticSprite(400, 100, 'texExit');
    const portalTxt = scene.add.text(400, 100, 'Bölüm 1\nBaşlat', { fontSize: '11px', align: 'center', fill: '#fff' }).setOrigin(0.5).setDepth(3);
    dynamicObjects.push(lobbyPortal, portalTxt);
    startX1 = 350; startY1 = 480; startX2 = 450; startY2 = 480;
  }
  else if (lvl === 1) {
    // --- BÖLÜM 1: İLK İŞBİRLİĞİ ---
    missionText.setText('Bölüm 1: 1. Butona bas -> Partnerin geçsin -> 2. Butona bassın!');
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    const door = scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1');
    doorsGroup.add(door);

    const b1 = scene.physics.add.staticSprite(120, 150, 'texBtnBase').setName('btn1_1');
    const b1T = scene.add.text(120, 150, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const b2 = scene.physics.add.staticSprite(680, 450, 'texBtnBase').setName('btn1_2');
    const b2T = scene.add.text(680, 450, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(680, 150, 'texExit');
    const exitT = scene.add.text(680, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
  }
  else if (lvl === 2) {
    // --- BÖLÜM 2: KARŞILIKLI DESTEK ---
    missionText.setText('Bölüm 2: Üst buton alt kapıyı, alt buton üst kapıyı açar!');
    wallsGroup.create(400, 300, 'texWallLongH');

    const doorTop = scene.physics.add.staticSprite(550, 170, 'texDoorSmallBlue').setName('doorTop');
    const doorBottom = scene.physics.add.staticSprite(550, 430, 'texDoorSmallPink').setName('doorBottom');
    doorsGroup.add(doorTop); doorsGroup.add(doorBottom);

    const btnTop = scene.physics.add.staticSprite(280, 170, 'texBtnBlue').setName('btnTop');
    const btnTopT = scene.add.text(280, 170, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const btnBottom = scene.physics.add.staticSprite(280, 430, 'texBtnPink').setName('btnBottom');
    const btnBottomT = scene.add.text(280, 430, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const exitTop = scene.physics.add.staticSprite(720, 170, 'texExit');
    const exitTopT = scene.add.text(720, 170, '💖', { fontSize: '24px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exitTop);
    dynamicObjects.push(btnTop, btnTopT, btnBottom, btnBottomT, exitTopT);

    startX1 = 100; startY1 = 170; startX2 = 100; startY2 = 430;
  }
  else if (lvl === 3) {
    // --- BÖLÜM 3: 2 SANİYE MÜCADELESİ ---
    missionText.setText('Bölüm 3: İki butona AYNI ANDA basın! Kapı sadece 2 SANİYE açık kalır!');
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
    startX1 = 100; startY1 = 260; startX2 = 100; startY2 = 340;
  }
  else if (lvl === 4) {
    // --- BÖLÜM 4: CANAVARLI DEVRİYE ---
    missionText.setText('Bölüm 4: Dikkat! Ortada dolaşan canavara çarpmadan butona basıp geçin!');
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    const door = scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1');
    doorsGroup.add(door);

    createMonster(scene, 250, 300, 0, 180); // Dikey devriye gezen canavar

    const b1 = scene.physics.add.staticSprite(120, 120, 'texBtnBase').setName('btn1_1');
    const b1T = scene.add.text(120, 120, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const b2 = scene.physics.add.staticSprite(680, 480, 'texBtnBase').setName('btn1_2');
    const b2T = scene.add.text(680, 480, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(700, 150, 'texExit');
    const exitT = scene.add.text(700, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
  }
  else if (lvl === 5) {
    // --- BÖLÜM 5: 20 SANİYE ZAMANLI BULMACA ---
    missionText.setText('Bölüm 5: Zaman akıyor! 20 saniye dolmadan bulmacayı tamamlayın!');
    startLevelCountdown(scene, 20);

    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    const door = scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1');
    doorsGroup.add(door);

    const b1 = scene.physics.add.staticSprite(100, 150, 'texBtnBase').setName('btn1_1');
    const b1T = scene.add.text(100, 150, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const b2 = scene.physics.add.staticSprite(680, 450, 'texBtnBase').setName('btn1_2');
    const b2T = scene.add.text(680, 450, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(680, 150, 'texExit');
    const exitT = scene.add.text(680, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
  }
  else if (lvl === 6) {
    // --- BÖLÜM 6: ÇİFT KİLİTLİ ODA ---
    missionText.setText('Bölüm 6: İki kapı var! Sırayla birbirinize kapıları açmalısınız.');
    wallsGroup.create(280, 100, 'texWallV');
    wallsGroup.create(280, 500, 'texWallV');
    wallsGroup.create(520, 100, 'texWallV');
    wallsGroup.create(520, 500, 'texWallV');

    const d1 = scene.physics.add.staticSprite(280, 300, 'texDoorV').setName('doorA');
    const d2 = scene.physics.add.staticSprite(520, 300, 'texDoorV').setName('doorB');
    doorsGroup.add(d1); doorsGroup.add(d2);

    const b1 = scene.physics.add.staticSprite(100, 150, 'texBtnBase').setName('btn6_1');
    const b1T = scene.add.text(100, 150, '1️⃣', { fontSize: '20px' }).setOrigin(0.5).setDepth(2);
    const b2 = scene.physics.add.staticSprite(400, 450, 'texBtnBase').setName('btn6_2');
    const b2T = scene.add.text(400, 450, '2️⃣', { fontSize: '20px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
  }
  else if (lvl === 7) {
    // --- BÖLÜM 7: İKİ CANAVARLI KORİDOR ---
    missionText.setText('Bölüm 7: İki canavar devriye geziyor! Aralarından süzülüp butona basın.');
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    const door = scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1');
    doorsGroup.add(door);

    createMonster(scene, 180, 200, 0, 170);
    createMonster(scene, 620, 400, 0, -170);

    const b1 = scene.physics.add.staticSprite(100, 480, 'texBtnBase').setName('btn1_1');
    const b1T = scene.add.text(100, 480, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const b2 = scene.physics.add.staticSprite(700, 120, 'texBtnBase').setName('btn1_2');
    const b2T = scene.add.text(700, 120, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(700, 480, 'texExit');
    const exitT = scene.add.text(700, 480, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
  }
  else if (lvl === 8) {
    // --- BÖLÜM 8: CANAVAR + 18 SANİYE ---
    missionText.setText('Bölüm 8: Hem canavar var hem de 18 saniyeniz! Hızlı olun!');
    startLevelCountdown(scene, 18);

    wallsGroup.create(400, 300, 'texWallLongH');

    const doorTop = scene.physics.add.staticSprite(550, 170, 'texDoorSmallBlue').setName('doorTop');
    const doorBottom = scene.physics.add.staticSprite(550, 430, 'texDoorSmallPink').setName('doorBottom');
    doorsGroup.add(doorTop); doorsGroup.add(doorBottom);

    createMonster(scene, 350, 170, 160, 0);

    const btnTop = scene.physics.add.staticSprite(200, 170, 'texBtnBlue').setName('btnTop');
    const btnTopT = scene.add.text(200, 170, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const btnBottom = scene.physics.add.staticSprite(200, 430, 'texBtnPink').setName('btnBottom');
    const btnBottomT = scene.add.text(200, 430, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const exitTop = scene.physics.add.staticSprite(720, 170, 'texExit');
    const exitTopT = scene.add.text(720, 170, '💖', { fontSize: '24px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exitTop);
    dynamicObjects.push(btnTop, btnTopT, btnBottom, btnBottomT, exitTopT);
    startX1 = 80; startY1 = 170; startX2 = 80; startY2 = 430;
  }
  else if (lvl === 9) {
    // --- BÖLÜM 9: KARIŞIK LABİRENT ---
    missionText.setText('Bölüm 9: Labirent duvarları! Butonları bulup portala gidin.');
    wallsGroup.create(250, 200, 'texWallV');
    wallsGroup.create(550, 400, 'texWallV');

    const door = scene.physics.add.staticSprite(400, 300, 'texDoorShortV').setName('door1');
    doorsGroup.add(door);

    const b1 = scene.physics.add.staticSprite(100, 100, 'texBtnBase').setName('btn1_1');
    const b1T = scene.add.text(100, 100, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const b2 = scene.physics.add.staticSprite(700, 500, 'texBtnBase').setName('btn1_2');
    const b2T = scene.add.text(700, 500, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(400, 120, 'texExit');
    const exitT = scene.add.text(400, 120, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
  }
  else if (lvl === 10) {
    // --- BÖLÜM 10: 2 SANİYE + CANAVAR ---
    missionText.setText('Bölüm 10: Canavardan kaçarken iki butona aynı anda basın (2s kapı)!');
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    const centerDoor = scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door3');
    doorsGroup.add(centerDoor);

    createMonster(scene, 250, 300, 0, 190);

    const btnSync1 = scene.physics.add.staticSprite(100, 120, 'texBtnBase').setName('btnSync1');
    const btnSync1T = scene.add.text(100, 120, '⏱️', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const btnSync2 = scene.physics.add.staticSprite(100, 480, 'texBtnBase').setName('btnSync2');
    const btnSync2T = scene.add.text(100, 480, '⏱️', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(btnSync1, btnSync1T, btnSync2, btnSync2T, exitT);
  }
  else if (lvl === 11) {
    // --- BÖLÜM 11: ÇAPRAZ CANAVARLAR ---
    missionText.setText('Bölüm 11: Çapraz dolaşan 2 hızlı canavara dikkat edin!');
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    const door = scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1');
    doorsGroup.add(door);

    createMonster(scene, 180, 200, 150, 150);
    createMonster(scene, 620, 400, -150, -150);

    const b1 = scene.physics.add.staticSprite(100, 450, 'texBtnBase').setName('btn1_1');
    const b1T = scene.add.text(100, 450, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const b2 = scene.physics.add.staticSprite(700, 150, 'texBtnBase').setName('btn1_2');
    const b2T = scene.add.text(700, 150, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(700, 450, 'texExit');
    const exitT = scene.add.text(700, 450, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
  }
  else if (lvl === 12) {
    // --- BÖLÜM 12: 15 SANİYE ULTRA HIZ ---
    missionText.setText('Bölüm 12: Sadece 15 saniyeniz var! Kusursuz bir koşu yapın.');
    startLevelCountdown(scene, 15);

    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    const door = scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1');
    doorsGroup.add(door);

    const b1 = scene.physics.add.staticSprite(120, 150, 'texBtnBase').setName('btn1_1');
    const b1T = scene.add.text(120, 150, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const b2 = scene.physics.add.staticSprite(680, 450, 'texBtnBase').setName('btn1_2');
    const b2T = scene.add.text(680, 450, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(680, 150, 'texExit');
    const exitT = scene.add.text(680, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
  }
  else if (lvl === 13) {
    // --- BÖLÜM 13: 3 KADEMELİ KAPILAR ---
    missionText.setText('Bölüm 13: 3 Bölmeli zindan! Sırayla butonlara basarak ilerleyin.');
    wallsGroup.create(260, 150, 'texWallV');
    wallsGroup.create(540, 450, 'texWallV');

    const d1 = scene.physics.add.staticSprite(260, 450, 'texDoorShortV').setName('doorA');
    const d2 = scene.physics.add.staticSprite(540, 150, 'texDoorShortV').setName('doorB');
    doorsGroup.add(d1); doorsGroup.add(d2);

    createMonster(scene, 400, 300, 0, 160);

    const b1 = scene.physics.add.staticSprite(100, 150, 'texBtnBase').setName('btn6_1');
    const b1T = scene.add.text(100, 150, '1️⃣', { fontSize: '20px' }).setOrigin(0.5).setDepth(2);
    const b2 = scene.physics.add.staticSprite(400, 500, 'texBtnBase').setName('btn6_2');
    const b2T = scene.add.text(400, 500, '2️⃣', { fontSize: '20px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
  }
  else if (lvl === 14) {
    // --- BÖLÜM 14: ŞAMPİYONLAR MÜCADELESİ ---
    missionText.setText('Bölüm 14: 2 Canavar + 20 Saniye Süre! Büyük finale son adım!');
    startLevelCountdown(scene, 20);

    wallsGroup.create(400, 300, 'texWallLongH');

    const doorTop = scene.physics.add.staticSprite(550, 170, 'texDoorSmallBlue').setName('doorTop');
    const doorBottom = scene.physics.add.staticSprite(550, 430, 'texDoorSmallPink').setName('doorBottom');
    doorsGroup.add(doorTop); doorsGroup.add(doorBottom);

    createMonster(scene, 300, 170, 150, 0);
    createMonster(scene, 400, 430, -150, 0);

    const btnTop = scene.physics.add.staticSprite(180, 170, 'texBtnBlue').setName('btnTop');
    const btnTopT = scene.add.text(180, 170, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const btnBottom = scene.physics.add.staticSprite(180, 430, 'texBtnPink').setName('btnBottom');
    const btnBottomT = scene.add.text(180, 430, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const exitTop = scene.physics.add.staticSprite(720, 170, 'texExit');
    const exitTopT = scene.add.text(720, 170, '💖', { fontSize: '24px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exitTop);
    dynamicObjects.push(btnTop, btnTopT, btnBottom, btnBottomT, exitTopT);
    startX1 = 80; startY1 = 170; startX2 = 80; startY2 = 430;
  }
  else if (lvl === 15) {
    // --- BÖLÜM 15: BÜYÜK FİNAL ---
    missionText.setText('👑 BÖLÜM 15 (FİNAL): 2 Canavar + 2 Saniye Senkron Kapı + Kalp Portalı!');
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');

    const centerDoor = scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door3');
    doorsGroup.add(centerDoor);

    createMonster(scene, 200, 300, 140, 140);
    createMonster(scene, 600, 300, -140, 140);

    const btnSync1 = scene.physics.add.staticSprite(100, 120, 'texBtnBase').setName('btnSync1');
    const btnSync1T = scene.add.text(100, 120, '⏱️', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const btnSync2 = scene.physics.add.staticSprite(100, 480, 'texBtnBase').setName('btnSync2');
    const btnSync2T = scene.add.text(100, 480, '⏱️', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(btnSync1, btnSync1T, btnSync2, btnSync2T, exitT);
  }

  // Karakter Başlangıç Pozisyonları
  if (myRole === 'p1') {
    myPlayer.setPosition(startX1, startY1);
    remotePlayer.setPosition(startX2, startY2);
  } else {
    myPlayer.setPosition(startX2, startY2);
    remotePlayer.setPosition(startX1, startY1);
  }
}

function createMenuUI(scene) {
  levelMenuContainer = scene.add.container(400, 300).setDepth(110).setVisible(false);

  const menuBg = scene.add.rectangle(0, 0, 440, 500, 0x1e0836, 0.95);
  menuBg.setStrokeStyle(3, 0xffbe0b, 1);

  const title = scene.add.text(0, -220, '🗺️ BÖLÜM SEÇİMİ (1 - 15)', { 
    fontSize: '18px', fill: '#ffbe0b', fontStyle: 'bold' 
  }).setOrigin(0.5);

  const closeBtn = scene.add.text(190, -220, '✖', { fontSize: '18px', fill: '#fff' })
    .setOrigin(0.5).setInteractive({ useHandCursor: true });
  closeBtn.on('pointerdown', () => levelMenuContainer.setVisible(false));

  levelMenuContainer.add([menuBg, title, closeBtn]);

  // 15 Bölümü 2 Sütun Halinde Diziyoruz
  for (let i = 0; i <= 15; i++) {
    const isLeft = i <= 7;
    const colX = isLeft ? -105 : 105;
    const rowIdx = isLeft ? i : i - 8;
    const btnY = -170 + (rowIdx * 48);

    const btnTitle = i === 0 ? '🏰 Lobi' : `Bölüm ${i}`;
    const btnBox = scene.add.rectangle(colX, btnY, 190, 36, 0x4a0e4e, 1).setInteractive({ useHandCursor: true });
    btnBox.setStrokeStyle(2, 0x9d4edd, 1);

    const btnText = scene.add.text(colX, btnY, btnTitle, { fontSize: '13px', fill: '#ffffff' }).setOrigin(0.5);

    btnBox.on('pointerdown', () => {
      levelMenuContainer.setVisible(false);
      loadLevel(scene, i);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'change_level', level: i }));
      }
    });

    levelMenuContainer.add([btnBox, btnText]);
  }
}

function connectWebSocket(scene) {
  socket = new WebSocket(SERVER_URL);

  socket.onopen = () => {
    statusText.setText('Bağlandı!').setStyle({ fill: '#06d6a0' });
    socket.send(JSON.stringify({ type: 'join', id: myId }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'join' && data.id !== myId) {
      socket.send(JSON.stringify({ type: 'assign_role', targetId: data.id, role: 'p2', level: currentLevel }));
    }

    if (data.type === 'assign_role' && data.targetId === myId) {
      myRole = 'p2';
      myPlayer.setTexture('fotoO').setDisplaySize(44, 44);
      remotePlayer.setTexture('fotoBen').setDisplaySize(44, 44);
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

    if (data.type === 'trigger_timer_door') {
      startDoorTimer(scene);
    }
  };

  socket.onerror = () => { statusText.setText('Bağlantı Bekleniyor...').setStyle({ fill: '#ff0054' }); };
  socket.onclose = () => { setTimeout(() => connectWebSocket(scene), 3000); };
}

function startDoorTimer(scene) {
  const door = doorsGroup.getFirstAlive();
  if (!door) return;

  door.disableBody(true, true);
  remainingDoorTime = 2; // 2 Saniye Kuralı
  timerText.setText(`⏳ KAPI AÇIK: ${remainingDoorTime}s`).setVisible(true);

  if (doorTimerEvent) doorTimerEvent.remove();

  doorTimerEvent = scene.time.addEvent({
    delay: 1000,
    repeat: 1,
    callback: () => {
      remainingDoorTime--;
      if (remainingDoorTime > 0) {
        timerText.setText(`⏳ KAPI AÇIK: ${remainingDoorTime}s`);
      } else {
        timerText.setVisible(false);
        door.enableBody(false, 400, 300, true, true);
        doorTimerEvent = null;
      }
    }
  });
}

function triggerWin(scene, nextLvl) {
  if (gameFinished) return;
  gameFinished = true;
  winOverlay.setVisible(true);

  const message = winMessages[currentLevel] || '👑 BÖLÜM GEÇİLDİ! 👑\n\nSıradaki Odaya Geçiliyor... ❤️';
  winBanner.setText(message).setVisible(true);
  winEmitter.start();

  scene.time.delayedCall(3000, () => {
    winEmitter.stop();
    loadLevel(scene, nextLvl > 15 ? 0 : nextLvl);
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

  myLabel.setPosition(myPlayer.x, myPlayer.y - 28);
  remoteLabel.setPosition(remotePlayer.x, remotePlayer.y - 28);

  remotePlayer.x = Phaser.Math.Linear(remotePlayer.x, targetRemoteX, 0.35);
  remotePlayer.y = Phaser.Math.Linear(remotePlayer.y, targetRemoteY, 0.35);

  // Canavar İkonlarını Güncelle
  monstersGroup.getChildren().forEach(monster => {
    const icon = monster.getData('iconRef');
    if (icon) icon.setPosition(monster.x, monster.y);
  });

  // --- BÖLÜM MEKANİKLERİ ---
  if (currentLevel === 0) {
    const onTableMy = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), dynamicObjects[0].getBounds());
    const onTableRemote = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), dynamicObjects[0].getBounds());

    if (onTableMy && onTableRemote) {
      levelMenuContainer.setVisible(true);
    }

    const onLobbyExitMy = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), dynamicObjects[2].getBounds());
    const onLobbyExitRemote = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), dynamicObjects[2].getBounds());
    if (onLobbyExitMy && onLobbyExitRemote && !gameFinished) {
      triggerWin(this, 1);
      if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'level_win', nextLevel: 1 }));
    }
  }
  else if ([1, 4, 5, 7, 9, 11, 12].includes(currentLevel)) {
    // Standart Çift Buton Odaları
    const b1 = dynamicObjects[0];
    const b2 = dynamicObjects[2];
    const door = doorsGroup.getFirstAlive();

    const onB1 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), b1.getBounds()) || Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), b1.getBounds());
    const onB2 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), b2.getBounds()) || Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), b2.getBounds());

    if (door) {
      if (onB1 || onB2) door.disableBody(true, true);
      else door.enableBody(false, door.x, door.y, true, true);
    }

    checkExit(this, currentLevel + 1);
  }
  else if ([2, 8, 14].includes(currentLevel)) {
    // Çift Koridor / Karşılıklı Buton Odaları
    const btnTop = dynamicObjects[0];
    const btnBottom = dynamicObjects[2];

    const onBtnTop = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), btnTop.getBounds()) || Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), btnTop.getBounds());
    const onBtnBottom = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), btnBottom.getBounds()) || Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), btnBottom.getBounds());

    doorsGroup.getChildren().forEach(door => {
      if (door.name === 'doorBottom') {
        if (onBtnTop) door.disableBody(true, true);
        else door.enableBody(false, 550, 430, true, true);
      }
      if (door.name === 'doorTop') {
        if (onBtnBottom) door.disableBody(true, true);
        else door.enableBody(false, 550, 170, true, true);
      }
    });

    checkExit(this, currentLevel + 1);
  }
  else if ([3, 10, 15].includes(currentLevel)) {
    // 2 Saniyelik Eşzamanlı Buton Odaları
    const btnSync1 = dynamicObjects[0];
    const btnSync2 = dynamicObjects[2];
    const door = doorsGroup.getFirstAlive();

    const p1OnB1 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), btnSync1.getBounds());
    const p2OnB2 = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), btnSync2.getBounds());
    const p1OnB2 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), btnSync2.getBounds());
    const p2OnB1 = Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), btnSync1.getBounds());

    const isSynchronized = (p1OnB1 && p2OnB2) || (p1OnB2 && p2OnB1);

    if (isSynchronized && !doorTimerEvent && door && door.active) {
      startDoorTimer(this);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'trigger_timer_door' }));
      }
    }

    checkExit(this, currentLevel === 15 ? 0 : currentLevel + 1);
  }
  else if ([6, 13].includes(currentLevel)) {
    // Çok Kademeli Sıralı Kapılar
    const b1 = dynamicObjects[0];
    const b2 = dynamicObjects[2];

    const onB1 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), b1.getBounds()) || Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), b1.getBounds());
    const onB2 = Phaser.Geom.Intersects.RectangleToRectangle(myPlayer.getBounds(), b2.getBounds()) || Phaser.Geom.Intersects.RectangleToRectangle(remotePlayer.getBounds(), b2.getBounds());

    doorsGroup.getChildren().forEach(door => {
      if (door.name === 'doorA') {
        if (onB1) door.disableBody(true, true);
        else door.enableBody(false, door.x, door.y, true, true);
      }
      if (door.name === 'doorB') {
        if (onB2) door.disableBody(true, true);
        else door.enableBody(false, door.x, door.y, true, true);
      }
    });

    checkExit(this, currentLevel + 1);
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
