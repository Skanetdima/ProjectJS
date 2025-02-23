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

    this.x = ctx.canvas.width / 2;
    this.y = ctx.canvas.height / 2;
    this.currentDirection = 0;
    this.currentFrame = 0;
    this.isMoving = false;
    this.lastFrameTime = Date.now();
  }

  move(direction) {
    if (direction.x !== 0 && direction.y !== 0) {
      direction.x *= Math.SQRT1_2;
      direction.y *= Math.SQRT1_2;
    }

    this.x += direction.x * this.speed;
    this.y += direction.y * this.speed;

    this.x = Math.max(
      this.renderSize / 2,
      Math.min(this.ctx.canvas.width - this.renderSize / 2, this.x)
    );
    this.y = Math.max(
      this.renderSize / 2,
      Math.min(this.ctx.canvas.height - this.renderSize / 2, this.y)
    );

    // Устанавливаем флаг движения
    this.isMoving = direction.x !== 0 || direction.y !== 0;

    // Определение направления (0-вниз, 1-влево, 2-вправо, 3-вверх)
    if (direction.y > 0) this.currentDirection = 0;
    else if (direction.y < 0) this.currentDirection = 2;
    else if (direction.x > 0) this.currentDirection = 1;
    else if (direction.x < 0) this.currentDirection = 3;
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

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.drawImage(
      this.sprite,
      frameX,
      frameY,
      this.frameSize,
      this.frameSize,
      this.x - this.renderSize / 2,
      this.y - this.renderSize / 2,
      this.renderSize,
      this.renderSize
    );
  }
}
