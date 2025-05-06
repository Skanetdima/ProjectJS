// src/core/GameRenderer.js
// (No changes needed from previous provided version, assuming it was correct)
import { Character } from './Character.js'; // Optional for type checks

export class GameRenderer {
  constructor(game) {
    this.game = game;
    this.canvas = null;
    this.ctx = null;
  }

  initializeCanvas() {
    this.canvas = document.getElementById('game-canvas');
    if (!this.canvas) throw new Error("[Renderer] Canvas 'game-canvas' not found!");
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) throw new Error('[Renderer] Failed to get 2D context.');
    this.ctx.imageSmoothingEnabled = false;
    this.resizeCanvas();
    console.log('[Renderer] Canvas initialized.');
    return { canvas: this.canvas, ctx: this.ctx };
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    if (this.game.character && this.game.level?.currentMap) {
      this.centerCameraOnCharacter();
    }
    console.log(`[Renderer] Canvas resized to ${this.canvas.width}x${this.canvas.height}`);
  }

  centerCameraOnCharacter() {
    const { character, level, canvas } = this.game;
    if (character && level?.currentMap && canvas) {
      level.currentMap.offsetX = Math.floor(canvas.width / 2 - character.x);
      level.currentMap.offsetY = Math.floor(canvas.height / 2 - character.y);
    }
  }

  drawFrame() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const map = this.game.level?.currentMap;
    const char = this.game.character;
    if (map) {
      map.draw(this.ctx, this.game.bookImage);
    }
    if (char && map) {
      char.draw(map.offsetX, map.offsetY);
    }
    // this.drawDebugInfo(); // Optional
  }

  drawWinScreen() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = 'lime';
    // Consider using a font available on most systems or include one via CSS @font-face
    this.ctx.font = 'clamp(32px, 8vw, 48px) "Press Start 2P", cursive, Arial, sans-serif';
    this.ctx.fillText('ZWYCIĘSTWO!', this.canvas.width / 2, this.canvas.height / 2 - 80); // Translated
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'clamp(24px, 5vw, 32px) Arial, sans-serif';
    this.ctx.fillText(
      `Zebrano wszystkie ${this.game.targetBooksToWin} książki!`, // Translated
      this.canvas.width / 2,
      this.canvas.height / 2
    );
    this.ctx.font = 'clamp(18px, 4vw, 24px) Arial, sans-serif';
    this.ctx.fillText('Uniwersytet uratowany!', this.canvas.width / 2, this.canvas.height / 2 + 60); // Translated
    this.ctx.font = 'clamp(14px, 3vw, 18px) Arial, sans-serif';
    this.ctx.fillStyle = '#ccc';
    this.ctx.fillText(
      '(Odśwież stronę, aby zagrać ponownie)', // Translated
      this.canvas.width / 2,
      this.canvas.height - 50
    );
  }
  // drawDebugInfo() { ... } // Optional debug drawing
}
