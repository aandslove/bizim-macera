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

let myPlayer;
let remotePlayer;
let myLabel;
let remoteLabel;
let cursors;
let touchPointer;
let socket;
let statusText;

const myId = Math.random().toString(36).substring(7);
let myRole = 'p1'; // Varsayılan rol (p1: Mavi, p2: Pembe)
let targetRemoteX = 600;
let targetRemoteY = 300;

function preload() {}

function create() {
  this.cameras.main.setBackgroundColor('#1e272e');

  statusText = this.add.text(20, 20, 'Odaya baglaniliyor...', { 
    fontSize: '16px', 
    fill: '#f1c40f',
    fontFamily: 'sans-serif'
  });

  // Dokular: Mavi ve Pembe Karakterler
  const gMavi = this.make.graphics({ x: 0, y: 0, add: false });
  gMavi.fillStyle(0x0984e3, 1);
  gMavi.fillRoundedRect(0, 0, 44, 44, 10);
  gMavi.generateTexture('texMavi', 44, 44);

  const gPembe = this.make.graphics({ x: 0, y: 0, add: false });
  gPembe.fillStyle(0xfd79a8, 1);
  gPembe.fillRoundedRect(0, 0, 44, 44, 10);
  gPembe.generateTexture('texPembe', 44, 44);

  // Kendi Karakterimiz (Varsayılan Mavi olarak başlar)
  myPlayer = this.physics.add.sprite(200, 300, 'texMavi');
  myPlayer.setCollideWorldBounds(true);

  // Karşıdaki Oyuncu (Varsayılan Pembe)
  remotePlayer = this.physics.add.sprite(600, 300, 'texPembe');
  remotePlayer.setCollideWorldBounds(true);

  // Karakter Üstü İsim Etiketleri
  myLabel = this.add.text(myPlayer.x, myPlayer.y - 30, 'Sen', {
    fontSize: '14px', fill: '#ffffff', backgroundColor: '#2d3436', padding: { x: 4, y: 2 }
  }).setOrigin(0.5);

  remoteLabel = this.add.text(remotePlayer.x, remotePlayer.y - 30, 'Partnerin', {
    fontSize: '14px', fill: '#ffffff', backgroundColor: '#2d3436', padding: { x: 4, y: 2 }
  }).setOrigin(0.5);

  // Dokunmatik Kontroller & Klavye
  cursors = this.input.keyboard.createCursorKeys();
  this.input.on('pointerdown', (pointer) => { touchPointer = pointer; });
  this.input.on('pointermove', (pointer) => { if (pointer.isDown) touchPointer = pointer; });
  this.input.on('pointerup', () => { touchPointer = null; });

  connectWebSocket();
}

function connectWebSocket() {
  socket = new WebSocket(SERVER_URL);

  socket.onopen = () => {
    statusText.setText('Bağlandı! Oda Aktif').setStyle({ fill: '#00b894' });
    // Odaya katıldığımızı ve kimliğimizi sunucuya bildir
    socket.send(JSON.stringify({ type: 'join', id: myId }));
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    // Diğer oyuncunun odaya katıldığını haber veren sinyal
    if (data.type === 'join' && data.id !== myId) {
      // Biz ilk girmişiz (Mavi kalıyoruz), odaya yeni gelene "Sen Pembe (p2) ol" diyoruz
      socket.send(JSON.stringify({ type: 'assign_role', targetId: data.id, role: 'p2', x: myPlayer.x, y: myPlayer.y }));
    }

    // Bize 2. oyuncu rolü verildiyse karakterlerimizin rengini değiştir
    if (data.type === 'assign_role' && data.targetId === myId) {
      myRole = 'p2';
      myPlayer.setTexture('texPembe');
      myPlayer.setPosition(600, 300);
      remotePlayer.setTexture('texMavi');
      remotePlayer.setPosition(data.x, data.y);
      targetRemoteX = data.x;
      targetRemoteY = data.y;
    }

    // Karşı oyuncunun hareket verisi
    if (data.type === 'move' && data.id !== myId) {
      targetRemoteX = data.x;
      targetRemoteY = data.y;
    }
  };

  socket.onerror = () => {
    statusText.setText('Bağlantı Bekleniyor...').setStyle({ fill: '#d63031' });
  };

  socket.onclose = () => {
    statusText.setText('Bağlantı kesildi, tekrar deneniyor...').setStyle({ fill: '#e17055' });
    setTimeout(connectWebSocket, 3000);
  };
}

function update() {
  const speed = 260;
  myPlayer.setVelocity(0);

  // 1. Kontroller
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

  // 2. Etiketleri karakterlerin üstünde tut
  myLabel.setPosition(myPlayer.x, myPlayer.y - 30);
  remoteLabel.setPosition(remotePlayer.x, remotePlayer.y - 30);

  // 3. Yumuşak Geçiş (Lerp) - Gecikmeyi ve takılmayı sıfırlar
  remotePlayer.x = Phaser.Math.Linear(remotePlayer.x, targetRemoteX, 0.25);
  remotePlayer.y = Phaser.Math.Linear(remotePlayer.y, targetRemoteY, 0.25);

  // 4. Konum Yayınlama (WebSocket)
  if (socket && socket.readyState === WebSocket.OPEN) {
    if (myPlayer.body.velocity.x !== 0 || myPlayer.body.velocity.y !== 0) {
      socket.send(JSON.stringify({
        type: 'move',
        id: myId,
        x: Math.round(myPlayer.x),
        y: Math.round(myPlayer.y)
      }));
    }
  }
}
