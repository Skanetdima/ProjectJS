import { InputManager } from './InputManager.js';
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';

export class Game {
  constructor(characterColor) {
    this.characterColor = characterColor;
    this.isRunning = false;

    this.initCanvas();
    this.inputManager = new InputManager();
    this.initUI();
    this.startGame();
  }

  initCanvas() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const [width, height] = [window.innerWidth, window.innerHeight];
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.character) {
      this.character.x = Math.max(
        this.character.renderSize / 2,
        Math.min(width - this.character.renderSize / 2, this.character.x)
      );
      this.character.y = Math.max(
        this.character.renderSize / 2,
        Math.min(height - this.character.renderSize / 2, this.character.y)
      );
    }
  }

  initUI() {
    UIManager.createControls(this.inputManager);
    document.getElementById('joystick-container').style.display = 'block';
    this.canvas.style.display = 'block';
  }

  async startGame() {
    if (this.isRunning) return;

    try {
      await this.initCharacter();
      this.isRunning = true;
      this.gameLoop();
    } catch (error) {
      console.error('Game initialization failed:', error);
    }
  }

  async initCharacter() {
    const spritePath = `../images/character_${this.characterColor}.png`;
    this.character = new Character(this.ctx, spritePath, {
      speed: 3,
      frameSize: 32,
      scale: 3,
      animationSpeed: 150,
    });

    await new Promise((resolve, reject) => {
      this.character.sprite.onload = resolve;
      this.character.sprite.onerror = () => {
        reject(new Error(`Failed to load sprite: ${spritePath}`));
      };
    });
  }

  gameLoop() {
    if (!this.isRunning) return;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const direction = this.inputManager.getInputDirection();
    this.character.move(direction);
    this.character.draw();

    requestAnimationFrame(() => this.gameLoop());
  }
}
