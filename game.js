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

// Gruplar
let wallsGroup, doorsGroup, portalsGroup, hazardsGroup, monstersGroup;
let dynamicObjects = [];

// Net Referanslar
let activeBtn1 = null, activeBtn2 = null;
let activeDoor1 = null, activeDoor2 = null;

const myId = Math.random().toString(36).substring(7);
let myRole = 'p1';
let targetRemoteX = 200, targetRemoteY = 450;
let lastSendTime = 0;
let isLevelTransitioning = false;

// Zamanlayıcılar
let doorTimerEvent = null;
let remainingDoorTime = 0;
let levelTimerEvent = null;
let levelRemainingSeconds = 0;

const levelData = {
  1: { name: 'İlk Adım', desc: '1. Butona bas -> Partnerin geçsin -> 2. Butona bassın!', timeLimit: 0 },
  2: { name: 'Karşılıklı Destek', desc: 'Kaktüslere dikkat! Üst buton alt kapıyı, alt buton üst kapıyı açar.', timeLimit: 0 },
  3: { name: 'Refleks Koşusu', desc: 'İki butona AYNI ANDA basın! Kapı 4 saniye açık kalacak!', timeLimit: 0 },
  4: { name: 'Kertenkele Devriyesi', desc: '🦎 Kertenkeleye yakalanmadan butona basıp geçin!', timeLimit: 0 },
  5: { name: '12 Saniye Baskısı', desc: '⏱️ Süre akıyor! 12 saniye dolmadan kaktüsleri aşıp portala ulaşın!', timeLimit: 12 },
  6: { name: 'Çift Kilitli Geçit', desc: 'Sırayla 1. ve 2. kapıları açarak birbirinize yol verin.', timeLimit: 0 },
  7: { name: 'Çifte Kertenkele', desc: '🦎 2 Kertenkele devriye geziyor! Aralarından süzülüp butona basın.', timeLimit: 0 },
  8: { name: 'Tehlikeli Yarış', desc: '🦎 Kertenkele peşinizde ve sadece 12 SANİYENİZ var!', timeLimit: 12 },
  9: { name: 'Dikenli Labirent', desc: '🌵 Kaktüs dolu labirentte dikkatle ilerleyip butonları bulun.', timeLimit: 0 },
  10: { name: 'Kritik Eşzamanlama', desc: '🦎 Kertenkeleden kaçarken butonlara aynı anda basıp hızlıca geçin!', timeLimit: 0 },
  11: { name: 'Çapraz Avcılar', desc: '🦎 Çapraz gezen 2 kertenkeleye ve kaktüslere dikkat edin!', timeLimit: 0 },
  12: { name: 'Son 10 Saniye', desc: '⏱️ 10 Saniyelik hız testi! Kaktüslere çarpmadan koşun!', timeLimit: 10 },
  13: { name: 'Büyük Zindan', desc: '3 Sıralı kapı, kaktüsler ve kertenkele! Kusursuz işbirliği gerekir.', timeLimit: 0 },
  14: { name: 'Şampiyonlar Odası', desc: '2 Kertenkele + Kaktüsler + 12 Saniye! Büyük finale son adım!', timeLimit: 12 },
  15: { name: 'Büyük Final', desc: '👑 FİNAL: 2 Kertenkele, kaktüs tuzakları ve senkronize kapı!', timeLimit: 0 }
};

const winMessages = {
  1: '👑 HARİKASINIZ! 👑\nİlk engeli tereyağından kıl çeker gibi aştınız. ❤️',
  2: '✨ MÜKEMMEL BİR UYUM! ✨\nBirbirinize yol açtığınız sürece aşamayacağınız duvar yok! 💖',
  3: '⚡ REFLEKSLER HARİKA! ⚡\nKapı kapanmadan el ele geçtiniz! ❤️',
  4: '🦎 KERTENKELEYİ ATLATTIK! 🦎\nKorkusuz ikili iş başında! 💖',
  5: '💣 ZAMANA KARŞI ZAFER! 💣\nZaman akarken bile sakin kalıp başardınız! ❤️',
  6: '🧩 ZİNCİRLEME BAŞARI! 🧩\nAdım adım, sabırla çözdünüz. Harikasınız sevgilim! 💖',
  7: '🔥 İKİLİ TEHLİKE AŞILDI! 🔥\nİki kertenkelenin arasından süzülmek ustalık ister! ❤️',
  8: '⏳ HIZLI VE DİKKATLİ! ⏳\nHem süre hem kertenkele varken hiç paniklemediniz! 💖',
  9: '🌀 LABİRENTİ FETHETTİNİZ! 🌀\nKalpleriniz birbirini labirentte bile buluyor! ❤️',
  10: '💎 KRİTİK GÖREV TAMAM! 💎\nSenkronize kapıyı tam zamanında yakaladınız! 💖',
  11: '🦎 ÇILGIN KOVALAMACA BİTTİ! 🦎\nKertenkeleleri atlattınız, yolunuza devam ettiniz! ❤️',
  12: '⚡ NEFES KESEN HIZ! ⚡\nSüreyi tereyağı gibi erittiniz! 💖',
  13: '⚔️ ZİNDANIN KALBİ FETHEDİLDİ! ⚔️\nHer köşesi tuzak dolu odayı geçtiniz. Çok az kaldı! ❤️',
  14: '🛡️ ŞAMPİYONLAR ODASI GEÇİLDİ! 🛡️\nTüm mekanikleri ustaca yönettiniz. Finale hazırız! 💖',
  15: '👑 BÜYÜK FİNAL TAMAMLANDI! 👑\n\n🎉 15 BÖLÜMÜN HEPSİNİ BİTİRDİNİZ! 🎉\n\nSiz ikiniz birlikte dünyadaki en güçlü takımsınız!\nSonsuza dek el ele... ❤️✨'
};

function preload() {
  this.load.image('fotoBen', 'ben.png');
  this.load.image('fotoO', 'o.png');
}

function create() {
  const bgG = this.make.graphics({ x: 0, y: 0, add: false });
  bgG.fillStyle(0x2d0c4e, 1);
  bgG.fillRect(0, 0, 800, 600);
  bgG.generateTexture('texBg', 800, 600);
  this.add.image(400, 300, 'texBg').setDepth(0);

  for (let i = 0; i < 35; i++) {
    const rx = Phaser.Math.Between(20, 780);
    const ry = Phaser.Math.Between(20, 580);
    this.add.text(rx, ry, '💜', { fontSize: `${Phaser.Math.Between(14, 22)}px`, color: '#5a189a' })
      .setOrigin(0.5).setAlpha(0.25).setDepth(1);
  }

  statusText = this.add.text(15, 12, 'Odaya bağlanılıyor...', { fontSize: '12px', fill: '#f1c40f' }).setDepth(20);
  missionText = this.add.text(400, 20, '', { 
    fontSize: '13px', fill: '#ffffff', backgroundColor: '#5c1d8c', padding: { x: 10, y: 4 } 
  }).setOrigin(0.5).setDepth(20);

  timerText = this.add.text(400, 48, '', {
    fontSize: '14px', fill: '#ffbe0b', backgroundColor: '#d63031', padding: { x: 8, y: 3 }, fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(20).setVisible(false);

  levelCountdownText = this.add.text(715, 20, '', {
    fontSize: '13px', fill: '#ffffff', backgroundColor: '#c0392b', padding: { x: 8, y: 3 }, fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(20).setVisible(false);

  levelIntroBanner = this.add.text(400, 300, '', {
    fontSize: '26px', fill: '#ffbe0b', backgroundColor: '#3a0ca3', padding: { x: 20, y: 12 }, align: 'center', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(80).setVisible(false);

  buildTextures(this);

  wallsGroup = this.physics.add.staticGroup();
  doorsGroup = this.physics.add.staticGroup();
  portalsGroup = this.physics.add.staticGroup();
  hazardsGroup = this.physics.add.staticGroup();
  monstersGroup = this.physics.add.group();

  myPlayer = this.physics.add.sprite(100, 450, 'fotoBen').setDisplaySize(42, 42).setDepth(10);
  myPlayer.setCollideWorldBounds(true);

  remotePlayer = this.physics.add.sprite(200, 450, 'fotoO').setDisplaySize(42, 42).setDepth(10);
  remotePlayer.setCollideWorldBounds(true);

  this.physics.add.collider(myPlayer, wallsGroup);
  this.physics.add.collider(remotePlayer, wallsGroup);
  this.physics.add.collider(myPlayer, doorsGroup);
  this.physics.add.collider(remotePlayer, doorsGroup);
  this.physics.add.collider(monstersGroup, wallsGroup);
  this.physics.add.collider(monstersGroup, doorsGroup);

  this.physics.add.overlap(myPlayer, hazardsGroup, () => restartCurrentLevel(this));
  this.physics.add.overlap(remotePlayer, hazardsGroup, () => restartCurrentLevel(this));
  this.physics.add.overlap(myPlayer, monstersGroup, () => restartCurrentLevel(this));
  this.physics.add.overlap(remotePlayer, monstersGroup, () => restartCurrentLevel(this));

  myLabel = this.add.text(myPlayer.x, myPlayer.y - 28, 'Sen', { 
    fontSize: '11px', fill: '#ffffff', backgroundColor: '#7209b7', padding: { x: 4, y: 2 } 
  }).setOrigin(0.5).setDepth(11);

  remoteLabel = this.add.text(remotePlayer.x, remotePlayer.y - 28, 'Sevgilin', { 
    fontSize: '11px', fill: '#ffffff', backgroundColor: '#f72585', padding: { x: 4, y: 2 } 
  }).setOrigin(0.5).setDepth(11);

  winOverlay = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.8).setDepth(90).setVisible(false);
  winBanner = this.add.text(400, 300, '', {
    fontSize: '20px', fill: '#ffbe0b', backgroundColor: '#3a0ca3', padding: { x: 25, y: 15 }, align: 'center', fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(100).setVisible(false);

  winEmitter = this.add.particles(400, 180, 'texParticle', {
    speed: { min: 100, max: 300 }, angle: { min: 0, max: 360 }, scale: { start: 1, end: 0 },
    blendMode: 'ADD', lifespan: 1200, gravityY: 150, emitting: false
  }).setDepth(95);

  cursors = this.input.keyboard.createCursorKeys();
  this.input.on('pointerdown', (p) => { touchPointer = p; });
  this.input.on('pointermove', (p) => { if (p.isDown) touchPointer = p; });
  this.input.on('pointerup', () => { touchPointer = null; });

  loadLevel(this, 1);
  connectWebSocket(this);
}

function buildTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Standart Dikey Duvar
  g.fillStyle(0x3c096c, 1); g.fillRect(0, 0, 30, 200);
  g.lineStyle(2, 0x7b2cbf, 0.8); g.strokeRect(0, 0, 30, 200);
  g.generateTexture('texWallV', 30, 200);

  // Ekranı Boydan Boya Bölen Kesintisiz Yatay Duvar (Hileleri engeller)
  g.clear(); g.fillStyle(0x3c096c, 1); g.fillRect(0, 0, 800, 30);
  g.lineStyle(2, 0x7b2cbf, 0.8); g.strokeRect(0, 0, 800, 30);
  g.generateTexture('texWallFullH', 800, 30);

  // Dikey Kapılar (Ekran boşluklarını kapatacak boyutta)
  g.clear(); g.fillStyle(0xff0054, 0.95); g.fillRect(0, 0, 30, 200);
  g.lineStyle(3, 0xff5400, 1); g.strokeRect(0, 0, 30, 200);
  g.generateTexture('texDoorV', 30, 200);

  g.clear(); g.fillStyle(0xff0054, 0.95); g.fillRect(0, 0, 30, 120);
  g.lineStyle(2, 0xff5400, 1); g.strokeRect(0, 0, 30, 120);
  g.generateTexture('texDoorShortV', 30, 120);

  // 2. Bölüm için Tam Kapatan Koridor Kapıları (Genişlik: 30, Yükseklik: 285)
  g.clear(); g.fillStyle(0x4cc9f0, 0.95); g.fillRect(0, 0, 30, 285);
  g.lineStyle(3, 0xffffff, 1); g.strokeRect(0, 0, 30, 285);
  g.generateTexture('texDoorBlockTop', 30, 285);

  g.clear(); g.fillStyle(0xf72585, 0.95); g.fillRect(0, 0, 30, 285);
  g.lineStyle(3, 0xffffff, 1); g.strokeRect(0, 0, 30, 285);
  g.generateTexture('texDoorBlockBottom', 30, 285);

  // Buton Tabanı
  g.clear(); g.fillStyle(0x3a0ca3, 1); g.fillRoundedRect(0, 0, 52, 52, 10);
  g.lineStyle(3, 0xffbe0b, 1); g.strokeRoundedRect(0, 0, 52, 52, 10);
  g.generateTexture('texBtnBase', 52, 52);

  // Çıkış Portalı
  g.clear(); g.fillStyle(0x06d6a0, 0.85); g.fillCircle(28, 28, 28);
  g.lineStyle(3, 0xffffff, 1); g.strokeCircle(28, 28, 28);
  g.generateTexture('texExit', 56, 56);

  // Kaktüs Hitbox
  g.clear(); g.fillStyle(0x000000, 0.01); g.fillRect(0, 0, 32, 32);
  g.generateTexture('texHazardHitbox', 32, 32);

  // Kertenkele Hitbox
  g.clear(); g.fillStyle(0x000000, 0.01); g.fillCircle(18, 18, 18);
  g.generateTexture('texMonsterHitbox', 36, 36);

  // Konfeti
  g.clear(); g.fillStyle(0xffbe0b, 1); g.fillCircle(5, 5, 5);
  g.generateTexture('texParticle', 10, 10);
}

function clearCurrentLevel() {
  wallsGroup.clear(true, true);
  doorsGroup.clear(true, true);
  portalsGroup.clear(true, true);
  hazardsGroup.clear(true, true);
  monstersGroup.clear(true, true);

  activeBtn1 = null;
  activeBtn2 = null;
  activeDoor1 = null;
  activeDoor2 = null;

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

// Oyuncunun butona basıp basmadığını hatasız ölçen mesafe fonksiyonu
function isPlayerOnBtn(player, btn) {
  if (!player || !btn) return false;
  return Phaser.Math.Distance.Between(player.x, player.y, btn.x, btn.y) < 45;
}

function loadLevel(scene, lvl) {
  clearCurrentLevel();
  currentLevel = lvl;

  const info = levelData[lvl] || { name: `Bölüm ${lvl}`, desc: '', timeLimit: 0 };
  missionText.setText(`Bölüm ${lvl}: ${info.desc}`);

  levelIntroBanner.setText(`BÖLÜM ${lvl}\n${info.name}`).setVisible(true);
  scene.time.delayedCall(1800, () => levelIntroBanner.setVisible(false));

  if (info.timeLimit > 0) {
    startLevelCountdown(scene, info.timeLimit);
  }

  let startX1 = 100, startY1 = 450, startX2 = 200, startY2 = 450;

  if (lvl === 1) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(400, 300, 'texDoorV');
    doorsGroup.add(activeDoor1);

    activeBtn1 = scene.physics.add.staticSprite(120, 150, 'texBtnBase');
    const b1T = scene.add.text(120, 150, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(680, 450, 'texBtnBase');
    const b2T = scene.add.text(680, 450, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(680, 150, 'texExit');
    const exitT = scene.add.text(680, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }
  else if (lvl === 2) {
    // Ekranı tam ortadan (y:300) boydan boya ayıran yatay duvar (Kaçış imkansız)
    wallsGroup.create(400, 300, 'texWallFullH');

    // Üst koridoru tam kapatan kapı (y: 142.5) ve Alt koridoru tam kapatan kapı (y: 457.5)
    activeDoor1 = scene.physics.add.staticSprite(520, 142, 'texDoorBlockTop').setName('doorTop');
    activeDoor2 = scene.physics.add.staticSprite(520, 458, 'texDoorBlockBottom').setName('doorBottom');
    doorsGroup.add(activeDoor1);
    doorsGroup.add(activeDoor2);

    addCactus(scene, 350, 150);
    addCactus(scene, 350, 450);

    activeBtn1 = scene.physics.add.staticSprite(200, 150, 'texBtnBase');
    const b1T = scene.add.text(200, 150, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(200, 450, 'texBtnBase');
    const b2T = scene.add.text(200, 450, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    const exitTop = scene.physics.add.staticSprite(720, 150, 'texExit');
    const exitTopT = scene.add.text(720, 150, '💖', { fontSize: '24px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exitTop);
    dynamicObjects.push(b1T, b2T, exitTopT);
    startX1 = 80; startY1 = 150; startX2 = 80; startY2 = 450;
  }
  else if (lvl === 3) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(400, 300, 'texDoorV');
    doorsGroup.add(activeDoor1);

    addCactus(scene, 250, 300);

    activeBtn1 = scene.physics.add.staticSprite(120, 140, 'texBtnBase');
    const b1T = scene.add.text(120, 140, '⏱️', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(120, 460, 'texBtnBase');
    const b2T = scene.add.text(120, 460, '⏱️', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
    startX1 = 100; startY1 = 250; startX2 = 100; startY2 = 350;
  }
  else if (lvl === 4) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(400, 300, 'texDoorV');
    doorsGroup.add(activeDoor1);

    createLizard(scene, 250, 300, 85);

    activeBtn1 = scene.physics.add.staticSprite(120, 120, 'texBtnBase');
    const b1T = scene.add.text(120, 120, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(680, 480, 'texBtnBase');
    const b2T = scene.add.text(680, 480, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(700, 150, 'texExit');
    const exitT = scene.add.text(700, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }
  else if (lvl === 5) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(400, 300, 'texDoorV');
    doorsGroup.add(activeDoor1);

    addCactus(scene, 220, 200);
    addCactus(scene, 220, 400);
    addCactus(scene, 580, 300);

    activeBtn1 = scene.physics.add.staticSprite(100, 150, 'texBtnBase');
    const b1T = scene.add.text(100, 150, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(680, 450, 'texBtnBase');
    const b2T = scene.add.text(680, 450, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(680, 150, 'texExit');
    const exitT = scene.add.text(680, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }
  else if (lvl === 6) {
    wallsGroup.create(280, 100, 'texWallV');
    wallsGroup.create(280, 500, 'texWallV');
    wallsGroup.create(520, 100, 'texWallV');
    wallsGroup.create(520, 500, 'texWallV');

    activeDoor1 = scene.physics.add.staticSprite(280, 300, 'texDoorV');
    activeDoor2 = scene.physics.add.staticSprite(520, 300, 'texDoorV');
    doorsGroup.add(activeDoor1);
    doorsGroup.add(activeDoor2);

    addCactus(scene, 400, 200);
    addCactus(scene, 400, 400);

    activeBtn1 = scene.physics.add.staticSprite(100, 150, 'texBtnBase');
    const b1T = scene.add.text(100, 150, '1️⃣', { fontSize: '20px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(400, 450, 'texBtnBase');
    const b2T = scene.add.text(400, 450, '2️⃣', { fontSize: '20px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }
  else if (lvl === 7) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(400, 300, 'texDoorV');
    doorsGroup.add(activeDoor1);

    createLizard(scene, 180, 200, 85);
    createLizard(scene, 620, 400, 85);

    activeBtn1 = scene.physics.add.staticSprite(100, 480, 'texBtnBase');
    const b1T = scene.add.text(100, 480, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(700, 120, 'texBtnBase');
    const b2T = scene.add.text(700, 120, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(700, 480, 'texExit');
    const exitT = scene.add.text(700, 480, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }
  else if (lvl === 8) {
    wallsGroup.create(400, 300, 'texWallFullH');
    activeDoor1 = scene.physics.add.staticSprite(520, 142, 'texDoorBlockTop');
    activeDoor2 = scene.physics.add.staticSprite(520, 458, 'texDoorBlockBottom');
    doorsGroup.add(activeDoor1);
    doorsGroup.add(activeDoor2);

    createLizard(scene, 350, 150, 90);
    addCactus(scene, 350, 450);

    activeBtn1 = scene.physics.add.staticSprite(180, 150, 'texBtnBase');
    const b1T = scene.add.text(180, 150, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(180, 450, 'texBtnBase');
    const b2T = scene.add.text(180, 450, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    const exitTop = scene.physics.add.staticSprite(720, 150, 'texExit');
    const exitTopT = scene.add.text(720, 150, '💖', { fontSize: '24px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exitTop);
    dynamicObjects.push(b1T, b2T, exitTopT);
    startX1 = 80; startY1 = 150; startX2 = 80; startY2 = 450;
  }
  else if (lvl === 9) {
    wallsGroup.create(250, 200, 'texWallV');
    wallsGroup.create(550, 400, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(400, 300, 'texDoorShortV');
    doorsGroup.add(activeDoor1);

    addCactus(scene, 100, 300);
    addCactus(scene, 400, 450);
    addCactus(scene, 680, 250);

    activeBtn1 = scene.physics.add.staticSprite(100, 100, 'texBtnBase');
    const b1T = scene.add.text(100, 100, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(700, 500, 'texBtnBase');
    const b2T = scene.add.text(700, 500, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(400, 120, 'texExit');
    const exitT = scene.add.text(400, 120, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }
  else if (lvl === 10) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(400, 300, 'texDoorV');
    doorsGroup.add(activeDoor1);

    createLizard(scene, 250, 300, 95);
    addCactus(scene, 550, 300);

    activeBtn1 = scene.physics.add.staticSprite(120, 140, 'texBtnBase');
    const b1T = scene.add.text(120, 140, '⏱️', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(120, 460, 'texBtnBase');
    const b2T = scene.add.text(120, 460, '⏱️', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }
  else if (lvl === 11) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(400, 300, 'texDoorV');
    doorsGroup.add(activeDoor1);

    createLizard(scene, 180, 200, 100);
    createLizard(scene, 620, 400, 100);
    addCactus(scene, 300, 450);
    addCactus(scene, 500, 150);

    activeBtn1 = scene.physics.add.staticSprite(100, 450, 'texBtnBase');
    const b1T = scene.add.text(100, 450, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(700, 150, 'texBtnBase');
    const b2T = scene.add.text(700, 150, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(700, 450, 'texExit');
    const exitT = scene.add.text(700, 450, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }
  else if (lvl === 12) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(400, 300, 'texDoorV');
    doorsGroup.add(activeDoor1);

    addCactus(scene, 250, 200);
    addCactus(scene, 250, 400);
    addCactus(scene, 550, 250);

    activeBtn1 = scene.physics.add.staticSprite(100, 150, 'texBtnBase');
    const b1T = scene.add.text(100, 150, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(680, 450, 'texBtnBase');
    const b2T = scene.add.text(680, 450, '🔘', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(680, 150, 'texExit');
    const exitT = scene.add.text(680, 150, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }
  else if (lvl === 13) {
    wallsGroup.create(260, 150, 'texWallV');
    wallsGroup.create(540, 450, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(260, 450, 'texDoorShortV');
    activeDoor2 = scene.physics.add.staticSprite(540, 150, 'texDoorShortV');
    doorsGroup.add(activeDoor1);
    doorsGroup.add(activeDoor2);

    createLizard(scene, 400, 300, 95);
    addCactus(scene, 400, 150);

    activeBtn1 = scene.physics.add.staticSprite(100, 150, 'texBtnBase');
    const b1T = scene.add.text(100, 150, '1️⃣', { fontSize: '20px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(400, 500, 'texBtnBase');
    const b2T = scene.add.text(400, 500, '2️⃣', { fontSize: '20px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }
  else if (lvl === 14) {
    wallsGroup.create(400, 300, 'texWallFullH');
    activeDoor1 = scene.physics.add.staticSprite(520, 142, 'texDoorBlockTop');
    activeDoor2 = scene.physics.add.staticSprite(520, 458, 'texDoorBlockBottom');
    doorsGroup.add(activeDoor1);
    doorsGroup.add(activeDoor2);

    createLizard(scene, 300, 150, 100);
    createLizard(scene, 400, 450, 100);
    addCactus(scene, 220, 150);
    addCactus(scene, 220, 450);

    activeBtn1 = scene.physics.add.staticSprite(120, 150, 'texBtnBase');
    const b1T = scene.add.text(120, 150, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(120, 450, 'texBtnBase');
    const b2T = scene.add.text(120, 450, '🔘', { fontSize: '22px' }).setOrigin(0.5).setDepth(2);

    const exitTop = scene.physics.add.staticSprite(720, 150, 'texExit');
    const exitTopT = scene.add.text(720, 150, '💖', { fontSize: '24px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exitTop);
    dynamicObjects.push(b1T, b2T, exitTopT);
    startX1 = 60; startY1 = 150; startX2 = 60; startY2 = 450;
  }
  else if (lvl === 15) {
    wallsGroup.create(400, 100, 'texWallV');
    wallsGroup.create(400, 500, 'texWallV');
    activeDoor1 = scene.physics.add.staticSprite(400, 300, 'texDoorV');
    doorsGroup.add(activeDoor1);

    createLizard(scene, 200, 300, 105);
    createLizard(scene, 600, 300, 105);
    addCactus(scene, 250, 150);
    addCactus(scene, 250, 450);

    activeBtn1 = scene.physics.add.staticSprite(120, 140, 'texBtnBase');
    const b1T = scene.add.text(120, 140, '⏱️', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
    activeBtn2 = scene.physics.add.staticSprite(120, 460, 'texBtnBase');
    const b2T = scene.add.text(120, 460, '⏱️', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);

    const exit = scene.physics.add.staticSprite(700, 300, 'texExit');
    const exitT = scene.add.text(700, 300, '💖', { fontSize: '26px' }).setOrigin(0.5).setDepth(3);
    portalsGroup.add(exit);
    dynamicObjects.push(b1T, b2T, exitT);
  }

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
  if (!activeDoor1) return;

  activeDoor1.disableBody(true, true);
  remainingDoorTime = 4.0; // 4 Tam Saniye Açık Kalır
  timerText.setText(`⏳ KAPI AÇIK: ${remainingDoorTime.toFixed(1)}s`).setVisible(true);

  if (doorTimerEvent) doorTimerEvent.remove();

  doorTimerEvent = scene.time.addEvent({
    delay: 500,
    repeat: 7,
    callback: () => {
      remainingDoorTime -= 0.5;
      if (remainingDoorTime > 0) {
        timerText.setText(`⏳ KAPI AÇIK: ${remainingDoorTime.toFixed(1)}s`);
      } else {
        timerText.setVisible(false);
        if (activeDoor1) activeDoor1.enableBody(false, activeDoor1.x, activeDoor1.y, true, true);
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

  monstersGroup.getChildren().forEach(monster => {
    const dMy = Phaser.Math.Distance.Between(monster.x, monster.y, myPlayer.x, myPlayer.y);
    const dRemote = Phaser.Math.Distance.Between(monster.x, monster.y, remotePlayer.x, remotePlayer.y);
    const target = dMy < dRemote ? myPlayer : remotePlayer;

    const mSpeed = monster.getData('speed') || 80;
    this.physics.moveToObject(monster, target, mSpeed);

    const icon = monster.getData('iconRef');
    if (icon) icon.setPosition(monster.x, monster.y);
  });

  // --- MATEMATİKSEL MESAFE İLE GARANTİLİ BUTON KONTROLLERİ ---
  if ([1, 4, 5, 7, 9, 11, 12].includes(currentLevel)) {
    if (activeBtn1 && activeBtn2 && activeDoor1) {
      const onB1 = isPlayerOnBtn(myPlayer, activeBtn1) || isPlayerOnBtn(remotePlayer, activeBtn1);
      const onB2 = isPlayerOnBtn(myPlayer, activeBtn2) || isPlayerOnBtn(remotePlayer, activeBtn2);

      if (onB1 || onB2) activeDoor1.disableBody(true, true);
      else activeDoor1.enableBody(false, activeDoor1.x, activeDoor1.y, true, true);
    }
    checkExit(this, currentLevel + 1);
  }
  else if ([2, 8, 14].includes(currentLevel)) {
    if (activeBtn1 && activeBtn2 && activeDoor1 && activeDoor2) {
      const onBtnTop = isPlayerOnBtn(myPlayer, activeBtn1) || isPlayerOnBtn(remotePlayer, activeBtn1);
      const onBtnBottom = isPlayerOnBtn(myPlayer, activeBtn2) || isPlayerOnBtn(remotePlayer, activeBtn2);

      // Üst buton alt kapıyı açar
      if (onBtnTop) activeDoor2.disableBody(true, true);
      else activeDoor2.enableBody(false, activeDoor2.x, activeDoor2.y, true, true);

      // Alt buton üst kapıyı açar
      if (onBtnBottom) activeDoor1.disableBody(true, true);
      else activeDoor1.enableBody(false, activeDoor1.x, activeDoor1.y, true, true);
    }
    checkExit(this, currentLevel + 1);
  }
  else if ([3, 10, 15].includes(currentLevel)) {
    if (activeBtn1 && activeBtn2 && activeDoor1) {
      const p1OnB1 = isPlayerOnBtn(myPlayer, activeBtn1);
      const p2OnB2 = isPlayerOnBtn(remotePlayer, activeBtn2);
      const p1OnB2 = isPlayerOnBtn(myPlayer, activeBtn2);
      const p2OnB1 = isPlayerOnBtn(remotePlayer, activeBtn1);

      const isSynchronized = (p1OnB1 && p2OnB2) || (p1OnB2 && p2OnB1);

      // İkiniz de butonlara bastığınız anda tetiklenir
      if (isSynchronized && !doorTimerEvent && activeDoor1.active) {
        startDoorTimer(this);
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'trigger_timer_door' }));
        }
      }
    }
    checkExit(this, currentLevel === 15 ? 1 : currentLevel + 1);
  }
  else if ([6, 13].includes(currentLevel)) {
    if (activeBtn1 && activeBtn2 && activeDoor1 && activeDoor2) {
      const onB1 = isPlayerOnBtn(myPlayer, activeBtn1) || isPlayerOnBtn(remotePlayer, activeBtn1);
      const onB2 = isPlayerOnBtn(myPlayer, activeBtn2) || isPlayerOnBtn(remotePlayer, activeBtn2);

      if (onB1) activeDoor1.disableBody(true, true);
      else activeDoor1.enableBody(false, activeDoor1.x, activeDoor1.y, true, true);

      if (onB2) activeDoor2.disableBody(true, true);
      else activeDoor2.enableBody(false, activeDoor2.x, activeDoor2.y, true, true);
    }
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

  const myOnExit = Phaser.Math.Distance.Between(myPlayer.x, myPlayer.y, exit.x, exit.y) < 40;
  const remoteOnExit = Phaser.Math.Distance.Between(remotePlayer.x, remotePlayer.y, exit.x, exit.y) < 40;

  if (myOnExit && remoteOnExit && !isLevelTransitioning) {
    triggerWin(scene, nextLevelId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'level_win', nextLevel: nextLevelId }));
    }
  }
}
