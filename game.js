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
let cursors;
let touchPointer;

function preload() {
  // Geçici karakter görseli (Sevimli mavi bir kare oluşturuyoruz)
}

function create() {
  // Arka plan rengi
  this.cameras.main.setBackgroundColor('#2c3e50');

  // Karakterimizi çiziyoruz (Mavi kutu)
  const graphics = this.make.graphics({ x: 0, y: 0, add: false });
  graphics.fillStyle(0x3498db, 1);
  graphics.fillRoundedRect(0, 0, 40, 40, 10);
  graphics.generateTexture('playerTexture', 40, 40);

  player = this.physics.add.sprite(400, 300, 'playerTexture');
  player.setCollideWorldBounds(true);

  // Klavye ok tuşları
  cursors = this.input.keyboard.createCursorKeys();

  // Mobil Dokunmatik Kontrol: Ekrana nereye dokunursan karakter oraya yürür
  this.input.on('pointerdown', (pointer) => { touchPointer = pointer; });
  this.input.on('pointermove', (pointer) => { if (pointer.isDown) touchPointer = pointer; });
  this.input.on('pointerup', () => { touchPointer = null; });
}

function update() {
  const speed = 250;
  player.setVelocity(0);

  // 1. Bilgisayardan klavye ile kontrol
  if (cursors.left.isDown) player.setVelocityX(-speed);
  else if (cursors.right.isDown) player.setVelocityX(speed);

  if (cursors.up.isDown) player.setVelocityY(-speed);
  else if (cursors.down.isDown) player.setVelocityY(speed);

  // 2. Telefondan dokunarak kontrol (Parmağın olduğu yere doğru koşar)
  if (touchPointer && touchPointer.isDown) {
    const distance = Phaser.Math.Distance.Between(player.x, player.y, touchPointer.worldX, touchPointer.worldY);
    if (distance > 15) {
      this.physics.moveTo(player, touchPointer.worldX, touchPointer.worldY, speed);
    }
  }
}