export class Character {
  constructor(ctx, spriteUrl, options = {}) {
    this.ctx = ctx;
    this.sprite = new Image();
    this.sprite.src = spriteUrl;

    this.frameSize = options.frameSize || 32;
    this.scale = options.scale || 3;
    this.renderSize = this.frameSize * this.scale;
    this.speed = options.speed || 3;
    this.animationSpeed = options.animationSpeed || 150;

    // Мировые координаты персонажа
    this.x = ctx.canvas.width / 2;
    this.y = ctx.canvas.height / 2;

    this.currentDirection = 0; // 0: вниз, 1: вправо, 2: вверх, 3: влево
    this.currentFrame = 0;
    this.isMoving = false;
    this.lastFrameTime = Date.now();
  }

  draw() {
    if (!this.sprite.complete) return;
    const now = Date.now();
    if (this.isMoving && now - this.lastFrameTime > this.animationSpeed) {
      this.currentFrame = (this.currentFrame + 1) % 4;
      this.lastFrameTime = now;
    } else if (!this.isMoving) {
      this.currentFrame = 0;
    }
    const frameX = this.currentFrame * this.frameSize;
    const frameY = this.currentDirection * this.frameSize;
    const screenX = this.ctx.canvas.width / 2 - this.renderSize / 2;
    const screenY = this.ctx.canvas.height / 2 - this.renderSize / 2;
    this.ctx.drawImage(
      this.sprite,
      frameX,
      frameY,
      this.frameSize,
      this.frameSize,
      screenX,
      screenY,
      this.renderSize,
      this.renderSize
    );
  }
}
