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

let currentLevel = 1;
let myPlayer, remotePlayer, myLabel, remoteLabel;
let cursors, touchPointer, socket;
let statusText, missionText, timerText, levelCountdownText, levelIntroBanner;
let winBanner, winOverlay, winEmitter;

// Gruplar ve Dinamik Nesneler
let wallsGroup, doorsGroup, portalsGroup, hazardsGroup, monstersGroup;
let dynamicObjects = [];

const myId = Math.random().toString(36).substring(7);
let myRole = 'p1'; // p1: Sen, p2: Sevgilin
let targetRemoteX = 200, targetRemoteY = 450;
let lastSendTime = 0;
let isLevelTransitioning = false;

// Zamanlayıcılar
let doorTimerEvent = null;
let remainingDoorTime = 0;
let levelTimerEvent = null;
let levelRemainingSeconds = 0;

// 15 Bölüm Bilgileri
const levelData = {
  1: { name: 'İlk Adım', desc: '1. Butona bas -> Partnerin geçsin -> 2. Butona bassın!', timeLimit: 0 },
  2: { name: 'Karşılıklı Destek', desc: 'Kaktüslere dikkat! Üst buton alt kapıyı, alt buton üst kapıyı açar.', timeLimit: 0 },
  3: { name: '2 Saniye Koşusu', desc: 'İki butona AYNI ANDA basın! Kapı sadece 2 SANİYE açık kalır!', timeLimit: 0 },
  4: { name: 'Kertenkele Devriyesi', desc: '🦎 Kertenkeleye yakalanmadan butona basıp geçin!', timeLimit: 0 },
  5: { name: '10 Saniye Baskısı', desc: '⏱️ Süre akıyor! 10 saniye dolmadan kaktüsleri aşıp portala ulaşın!', timeLimit: 10 },
  6: { name: 'Çift Kilitli Geçit', desc: 'Sırayla 1. ve 2. kapıları açarak birbirinize yol verin.', timeLimit: 0 },
  7: { name: 'Çifte Kertenkele', desc: '🦎 2 Kertenkele devriye geziyor! Aralarından süzülüp butona basın.', timeLimit: 0 },
  8: { name: 'Tehlikeli Yarış', desc: '🦎 Kertenkele peşinizde ve sadece 10 SANİYENİZ var!', timeLimit: 10 },
  9: { name: 'Dikenli Labirent', desc: '🌵 Kaktüs dolu labirentte dikkatle ilerleyip butonları bulun.', timeLimit: 0 },
  10: { name: 'Kritik 2 Saniye', desc: '🦎 Kertenkeleden kaçarken butonlara aynı anda basıp 2 saniyede geçin!', timeLimit: 0 },
  11: { name: 'Çapraz Avcılar', desc: '🦎 Çapraz gezen 2 kertenkeleye ve kaktüslere dikkat edin!', timeLimit: 0 },
  12: { name: 'Son 10 Saniye', desc: '⏱️ 10 Saniyelik refleks testi! Kaktüslere çarpmadan koşun!', timeLimit: 10 },
  13: { name: 'Büyük Zindan', desc: '3 Sıralı kapı, kaktüsler ve kertenkele! Kusursuz işbirliği gerekir.', timeLimit: 0 },
  14: { name: 'Şampiyonlar Odası', desc: '2 Kertenkele + Kaktüsler + 10 Saniye! Büyük finale son adım!', timeLimit: 10 },
  15: { name: 'Büyük Final', desc: '👑 FİNAL: 2 Kertenkele, kaktüs tuzakları ve 2 saniyelik senkron kapı!', timeLimit: 0 }
};

// Sevgi Dolu Bölüm Sonu Mesajları
const winMessages = {
  1: '👑 HARİKASINIZ! 👑\nİlk engeli tereyağından kıl çeker gibi aştınız. ❤️',
  2: '✨ MÜKEMMEL BİR UYUM! ✨\nBirbirinize yol açtığınız sürece aşamayacağınız duvar yok! 💖',
  3: '⚡ REFLEKSLER HARİKA! ⚡\nO daracık 2 saniyelik kapıdan bile el ele geçtiniz! ❤️',
  4: '🦎 KERTENKELEYİ ATLATTIK! 🦎\nKorkusuz ikili iş başında! 💖',
  5: '💣 ZAMANA KARŞI ZAFER! 💣\n10 saniyede bile sakin kalıp başardınız! ❤️',
  6: '🧩 ZİNCİRLEME BAŞARI! 🧩\nAdım adım, sabırla çözdünüz. Harikasınız sevgilim! 💖',
  7: '🔥 İKİLİ TEHLİKE AŞILDI! 🔥\nİki kertenkelenin arasından süzülmek ustalık ister! ❤️',
  8: '⏳ HIZLI VE DİKKATLİ! ⏳\nHem süre hem kertenkele varken hiç paniklemediniz! 💖',
  9: '🌀 LABİRENTİ FETHETTİNİZ! 🌀\nKalpleriniz birbirini labirentte bile buluyor! ❤️',
  10: '💎 KRİTİK GÖREV TAMAM! 💎\n2 saniyelik kapıyı tam zamanında yakaladınız! 💖',
  11: '🦎 ÇILGIN KOVALAMACA BİTTİ! 🦎\nKertenkeleleri atlattınız, yolunuza devam ettiniz! ❤️',
  12: '⚡ NEFES KESEN HIZ! ⚡\n10 saniyeyi tereyağı gibi erittiniz! 💖',
  13: '⚔️ ZİNDANIN KALBİ FETHEDİLDİ! ⚔️\nHer köşesi tuzak dolu odayı geçtiniz. Çok az kaldı! ❤️',
  14: '🛡️ ŞAMPİYONLAR ODASI GEÇİLDİ! 🛡️\nTüm mekanikleri ustaca yönettiniz. Finale hazırız! 💖',
  15: '👑 BÜYÜK FİNAL TAMAMLANDI! 👑\n\n🎉 15 BÖLÜMÜN HEPSİNİ BİTİRDİNİZ! 🎉\n\nSiz ikiniz birlikte dünyadaki en güçlü takımsınız!\nSonsuza dek el ele... ❤️✨'
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
  for (let i = 0; i < 35; i++) {
    const rx = Phaser.Math.Between(20, 780);
    const ry = Phaser.Math.Between(20, 580);
    this.add.text(rx, ry, '💜', { fontSize: `${Phaser.Math.Between(14, 22)}px`, color: '#5a189a' })
      .setOrigin(0.5).setAlpha(0.25).setDepth(1);
  }

  // Arayüz
  statusText = this.add.text(15, 12, 'Odaya bağlanılıyor...', { fontSize: '12px', fill: '#f1c40f' }).setDepth(20);
  missionText = this.add.text(400, 20, '', { 
    fontSize: '13px', fill: '#ffffff', backgroundColor: '#5c1d8c', padding: { x: 10, y: 4 } 
  }).setOrigin(0.5).setDepth(20);

  timerText = this.add.text(400, 48, '', {
    fontSize: '13px', fill: '#ffbe0b', backgroundColor: '#d63031', padding: { x: 6, y: 2 }, fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(20).setVisible(false);

  levelCountdownText = this.add.text(715, 20, '', {
    fontSize: '13px', fill: '#ffffff', backgroundColor: '#c0392b', padding: { x: 8, y: 3 }, fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(20).setVisible(false);

  levelIntroBanner = this.add.text(400, 300, '', {
    fontSize: '26px', fill: '#ffbe0b', backgroundColor: '#3a0ca3', padding: { x: 20, y: 12 }, align: 'center', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(80).setVisible(false);

  buildTextures(this);

  // Gruplar
  wallsGroup = this.physics.add.staticGroup();
  doorsGroup = this.physics.add.staticGroup();
  portalsGroup = this.physics.add.staticGroup();
  hazardsGroup = this.physics.add.staticGroup();
  monstersGroup = this.physics.add.group();

  // Karakterler
  myPlayer = this.physics.add.sprite(100, 450, 'fotoBen').setDisplaySize(42, 42).setDepth(10);
  myPlayer.setCollideWorldBounds(true);

  remotePlayer = this.physics.add.sprite(200, 450, 'fotoO').setDisplaySize(42, 42).setDepth(10);
  remotePlayer.setCollideWorldBounds(true);

  // Çarpışmalar
  this.physics.add.collider(myPlayer, wallsGroup);
  this.physics.add.collider(remotePlayer, wallsGroup);
  this.physics.add.collider(myPlayer, doorsGroup);
  this.physics.add.collider(remotePlayer, doorsGroup);
  this.physics.add.collider(monstersGroup, wallsGroup);
  this.physics.add.collider(monstersGroup, doorsGroup);

  // Tuzak / Kertenkele Çarpışmaları (Sadece mevcut odayı sıfırlar)
  this.physics.add.overlap(myPlayer, hazardsGroup, () => restartCurrentLevel(this));
  this.physics.add.overlap(remotePlayer, hazardsGroup, () => restartCurrentLevel(this));
  this.physics.add.overlap(myPlayer, monstersGroup, () => restartCurrentLevel(this));
  this.physics.add.overlap(remotePlayer, monstersGroup, () => restartCurrentLevel(this));

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

  // Kontroller
  cursors = this.input.keyboard.createCursorKeys();
  this.input.on('pointerdown', (p) => { touchPointer = p; });
  this.input.on('pointermove', (p) => { if (p.isDown) touchPointer = p; });
  this.input.on('pointerup', () => { touchPointer = null; });

  loadLevel(this, 1);
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

  g.clear(); g.fillStyle(0x3c096c, 1); g.fillRect(0, 0, 220, 24);
  g.lineStyle(2, 0x7b2cbf, 0.8); g.strokeRect(0, 0, 220, 24);
  g.generateTexture('texWallShortH', 220, 24);

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

  // Buton Tabanı
  g.clear(); g.fillStyle(0x3a0ca3, 1); g.fillRoundedRect(0, 0, 48, 48, 10);
  g.lineStyle(3, 0xffbe0b, 1); g.strokeRoundedRect(0, 0, 48, 48, 10);
  g.generateTexture('texBtnBase', 48, 48);

  // Çıkış Portalı
  g.clear(); g.fillStyle(0x06d6a0, 0.8); g.fillCircle(28, 28, 28);
  g.lineStyle(3, 0xffffff, 1); g.strokeCircle(28, 28, 28);
  g.generateTexture('texExit', 56, 56);

  // Kaktüs Hitbox
  g.clear(); g.fillStyle(0x000000, 0.01); g.fillRect(0, 0, 32, 32);
  g.generateTexture('texHazardHitbox', 32, 32);

  // Kertenkele Hitbox
  g.clear(); g.fillStyle(0x000000, 0.01); g.fillCircle(18, 18, 18);
  g.generateTexture('texMonsterHitbox', 36, 36);

  // Konfeti Partikülü
  g.clear(); g.fillStyle(0xffbe0b, 1); g.fillCircle(5, 5, 5);
  g.generateTexture('texParticle', 10, 10);
}

function clearCurrentLevel() {
  wallsGroup.clear(true, true);
  doorsGroup.clear(true, true);
  portalsGroup.clear(true, true);
  hazardsGroup.clear(true, true);
  monstersGroup.clear(true, true);

  dynamicObjects.forEach(obj => {
    if (obj && obj.destroy) obj.destroy();
  });
  dynamicObjects = [];

  isLevelTransitioning = false;
  winOverlay.setVisible(false);
  winBanner.setVisible(false);
  timerText.setVisible(false);
  levelCountdownText.setVisible(false);

  if (doorTimerEvent) { doorTimerEvent.remove(); doorTimerEvent = null; }
  if (levelTimerEvent) { levelTimerEvent.remove(); levelTimerEvent = null; }
}

function addCactus(scene, x, y) {
  hazardsGroup.create(x, y, 'texHazardHitbox');
  const txt = scene.add.text(x, y, '🌵', { fontSize: '24px' }).setOrigin(0.5).setDepth(4);
  dynamicObjects.push(txt);
}

function createLizard(scene, x, y, speed = 80) {
  const m = monstersGroup.create(x, y, 'texMonsterHitbox');
  m.setCollideWorldBounds(true);
  m.setBounce(1, 1);
  m.setData('speed', speed);

  const icon = scene.add.text(x, y, '🦎', { fontSize: '26px' }).setOrigin(0.5).setDepth(8);
  dynamicObjects.push(icon);
  m.setData('iconRef', icon);
  return m;
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
        scene.time.delayedCall(500, () => restartCurrentLevel(scene));
      }
    }
  });
}

function restartCurrentLevel(scene) {
  if (isLevelTransitioning) return;
  loadLevel(scene, currentLevel);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'restart_level', level: currentLevel }));
  }
}

function loadLevel(scene, lvl) {
  clearCurrentLevel();
  currentLevel = lvl;

  const info = levelData[lvl] || { name: `Bölüm ${lvl}`, desc: '', timeLimit: 0 };
  missionText.setText(`Bölüm ${lvl}: ${info.desc}`);

  // Bölüm Başlığı
  levelIntroBanner.setText(`BÖLÜM ${lvl}\n${info.name}`).setVisible(true);
  scene.time.delayedCall(1800, () => levelIntroBanner.setVisible(false));

  if (info.timeLimit > 0) {
    startLevelCountdown(scene, info.timeLimit);
  }

  let startX1 = 100, startY1 = 450, startX2 = 200, startY2 = 450;

  // --- 15 BÖLÜM HARİTA KODLARI ---

  if (lvl === 1) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1'));

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
    wallsGroup.create(400, 300, 'texWallLongH');
    doorsGroup.add(scene.physics.add.staticSprite(550, 170, 'texDoorSmallBlue').setName('doorTop'));
    doorsGroup.add(scene.physics.add.staticSprite(550, 430, 'texDoorSmallPink').setName('doorBottom'));

    addCactus(scene, 380, 170);
    addCactus(scene, 380, 430);

    const btnTop = scene.physics.add.staticSprite(220, 170, 'texBtnBase').setName('btnTop');
    const btnTopT = scene.add.text(220, 170, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const btnBottom = scene.physics.add.staticSprite(220, 430, 'texBtnBase').setName('btnBottom');
    const btnBottomT = scene.add.text(220, 430, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    const exitTop = scene.physics.add.staticSprite(720, 170, 'texExit');
    const exitTopT = scene.add.text(720, 170, '💖', { fontSize: '24px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exitTop);
    dynamicObjects.push(btnTop, btnTopT, btnBottom, btnBottomT, exitTopT);

    startX1 = 90; startY1 = 170; startX2 = 90; startY2 = 430;
  }
  else if (lvl === 3) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door3'));

    addCactus(scene, 250, 300);

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
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1'));

    createLizard(scene, 250, 300, 85);

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
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1'));

    addCactus(scene, 220, 200);
    addCactus(scene, 220, 400);
    addCactus(scene, 580, 300);

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
    wallsGroup.create(280, 100, 'texWallV');
    wallsGroup.create(280, 500, 'texWallV');
    wallsGroup.create(520, 100, 'texWallV');
    wallsGroup.create(520, 500, 'texWallV');

    doorsGroup.add(scene.physics.add.staticSprite(280, 300, 'texDoorV').setName('doorA'));
    doorsGroup.add(scene.physics.add.staticSprite(520, 300, 'texDoorV').setName('doorB'));

    addCactus(scene, 400, 200);
    addCactus(scene, 400, 400);

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
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1'));

    createLizard(scene, 180, 200, 85);
    createLizard(scene, 620, 400, 85);

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
    wallsGroup.create(400, 300, 'texWallLongH');
    doorsGroup.add(scene.physics.add.staticSprite(550, 170, 'texDoorSmallBlue').setName('doorTop'));
    doorsGroup.add(scene.physics.add.staticSprite(550, 430, 'texDoorSmallPink').setName('doorBottom'));

    createLizard(scene, 350, 170, 90);
    addCactus(scene, 350, 430);

    const btnTop = scene.physics.add.staticSprite(180, 170, 'texBtnBase').setName('btnTop');
    const btnTopT = scene.add.text(180, 170, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const btnBottom = scene.physics.add.staticSprite(180, 430, 'texBtnBase').setName('btnBottom');
    const btnBottomT = scene.add.text(180, 430, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    const exitTop = scene.physics.add.staticSprite(720, 170, 'texExit');
    const exitTopT = scene.add.text(720, 170, '💖', { fontSize: '24px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exitTop);
    dynamicObjects.push(btnTop, btnTopT, btnBottom, btnBottomT, exitTopT);
    startX1 = 80; startY1 = 170; startX2 = 80; startY2 = 430;
  }
  else if (lvl === 9) {
    wallsGroup.create(250, 200, 'texWallV');
    wallsGroup.create(550, 400, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(400, 300, 'texDoorShortV').setName('door1'));

    addCactus(scene, 100, 300);
    addCactus(scene, 400, 450);
    addCactus(scene, 680, 250);

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
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door3'));

    createLizard(scene, 250, 300, 95);
    addCactus(scene, 550, 300);

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
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1'));

    createLizard(scene, 180, 200, 100);
    createLizard(scene, 620, 400, 100);
    addCactus(scene, 300, 450);
    addCactus(scene, 500, 150);

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
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door1'));

    addCactus(scene, 250, 200);
    addCactus(scene, 250, 400);
    addCactus(scene, 550, 250);

    const b1 = scene.physics.add.staticSprite(100, 150, 'texBtnBase').setName('btn1_1');
    const b1T = scene.add.text(100, 150, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    const b2 = scene.physics.add.staticSprite(680, 450, 'texBtnBase').setName('btn1_2');
    const b2T = scene.add.text(680, 450, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(680, 150, 'texExit');
    const exitT = scene.add.text(680, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1, b1T, b2, b2T, exitT);
  }
  else if (lvl === 13) {
    wallsGroup.create(260, 150, 'texWallV');
    wallsGroup.create(540, 450, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(260, 450, 'texDoorShortV').setName('doorA'));
    doorsGroup.add(scene.physics.add.staticSprite(540, 150, 'texDoorShortV').setName('doorB'));

    createLizard(scene, 400, 300, 95);
    addCactus(scene, 400, 150);

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
    wallsGroup.create(400, 300, 'texWallLongH');
    doorsGroup.add(scene.physics.add.staticSprite(550, 170, 'texDoorSmallBlue').setName('doorTop'));
    doorsGroup.add(scene.physics.add.staticSprite(550, 430, 'texDoorSmallPink').setName('doorBottom'));

    createLizard(scene, 300, 170, 100);
    createLizard(scene, 400, 430, 100);
    addCactus(scene, 220, 170);
    addCactus(scene, 220, 430);

    const btnTop = scene.physics.add.staticSprite(120, 170, 'texBtnBase').setName('btnTop');
    const btnTopT = scene.add.text(120, 170, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const btnBottom = scene.physics.add.staticSprite(120, 430, 'texBtnBase').setName('btnBottom');
    const btnBottomT = scene.add.text(120, 430, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    const exitTop = scene.physics.add.staticSprite(720, 170, 'texExit');
    const exitTopT = scene.add.text(720, 170, '💖', { fontSize: '24px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exitTop);
    dynamicObjects.push(btnTop, btnTopT, btnBottom, btnBottomT, exitTopT);
    startX1 = 60; startY1 = 170; startX2 = 60; startY2 = 430;
  }
  else if (lvl === 15) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    doorsGroup.add(scene.physics.add.staticSprite(400, 300, 'texDoorV').setName('door3'));

    createLizard(scene, 200, 300, 105);
    createLizard(scene, 600, 300, 105);
    addCactus(scene, 250, 150);
    addCactus(scene, 250, 450);

    const btnSync1 = scene.physics.add.staticSprite(100, 120, 'texBtnBase').setName('btnSync1');
    const btnSync1T = scene.add.text(100, 120, '⏱️', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    const btnSync2 = scene.physics.add.staticSprite(100, 480, 'texBtnBase').setName('btnSync2');
    const btnSync2T = scene.add.text(100, 480, '⏱️', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(btnSync1, btnSync1T, btnSync2, btnSync2T, exitT);
  }

  // Karakter Başlangıç Noktaları
  if (myRole === 'p1') {
    myPlayer.setPosition(startX1, startY1);
    remotePlayer.setPosition(startX2, startY2);
  } else {
    myPlayer.setPosition(startX2, startY2);
    remotePlayer.setPosition(startX1, startY1);
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
      myPlayer.setTexture('fotoO').setDisplaySize(42, 42);
      remotePlayer.setTexture('fotoBen').setDisplaySize(42, 42);
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

    if (data.type === 'restart_level') {
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
  if (isLevelTransitioning) return;
  isLevelTransitioning = true;
  winOverlay.setVisible(true);

  const message = winMessages[currentLevel] || '👑 BÖLÜM GEÇİLDİ! 👑\n\nSıradaki Odaya Geçiliyor... ❤️';
  winBanner.setText(message).setVisible(true);
  winEmitter.start();

  scene.time.delayedCall(3000, () => {
    winEmitter.stop();
    loadLevel(scene, nextLvl > 15 ? 1 : nextLvl);
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

  // Kertenkele Takip AI
  monstersGroup.getChildren().forEach(monster => {
    const dMy = Phaser.Math.Distance.Between(monster.x, monster.y, myPlayer.x, myPlayer.y);
    const dRemote = Phaser.Math.Distance.Between(monster.x, monster.y, remotePlayer.x, remotePlayer.y);
    const target = dMy < dRemote ? myPlayer : remotePlayer;

    const mSpeed = monster.getData('speed') || 80;
    this.physics.moveToObject(monster, target, mSpeed);

    const icon = monster.getData('iconRef');
    if (icon) icon.setPosition(monster.x, monster.y);
  });

  // Buton ve Kapı Kontrolleri
  if ([1, 4, 5, 7, 9, 11, 12].includes(currentLevel)) {
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

    checkExit(this, currentLevel === 15 ? 1 : currentLevel + 1);
  }
  else if ([6, 13].includes(currentLevel)) {
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

  // Konum Yayını (50ms Throttling)
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

  if (myOnExit && remoteOnExit && !isLevelTransitioning) {
    triggerWin(scene, nextLevelId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'level_win', nextLevel: nextLevelId }));
    }
  }
}
