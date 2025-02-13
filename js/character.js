export class Character {
  constructor(ctx, color) {
    this.ctx = ctx;
    this.color = color;
    this.x = ctx.canvas.width / 2;
    this.y = ctx.canvas.height / 2;
    this.radius = 30;
    this.speed = 5;
  }

  move(direction) {
    this.x += direction.x * this.speed;
    this.y += direction.y * this.speed;

    // Keep within canvas bounds
    this.x = Math.max(this.radius, Math.min(this.ctx.canvas.width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(this.ctx.canvas.height - this.radius, this.y));
  }

  draw() {
    this.ctx.beginPath();
    this.ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = this.color;
    this.ctx.fill();
    this.ctx.closePath();
  }
}
