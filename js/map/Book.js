// src/map/Book.js
export class Book {
  constructor(x, y, id, tileSize) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.tileSize = tileSize;
    this.size = tileSize * 0.6;
    this.collected = false;
    this.isCollected = false;
  }
  draw(ctx, offsetX, offsetY, bookImage) {
    const screenX = Math.floor(this.x + offsetX - this.size / 2);
    const screenY = Math.floor(this.y + offsetY - this.size / 2);
    if (bookImage) {
      ctx.drawImage(bookImage, screenX, screenY, this.size, this.size);
    } else {
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(screenX, screenY, this.size, this.size);
      ctx.strokeStyle = '#5d4037';
      ctx.strokeRect(screenX, screenY, this.size, this.size);
      ctx.fillStyle = '#eee';
      ctx.font = `${this.size * 0.6}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', screenX + this.size / 2, screenY + this.size / 2 + 2);
    }
  }
}
