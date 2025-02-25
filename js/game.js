import { Joystick } from './joystick.js';
import { Character } from './character.js';

export class Game {
  constructor(characterColor) {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.style.display = 'block'; // Ensure canvas is visible

    this.backgroundImage = new Image();
    this.backgroundImage.src = 'img/parter.svg'; // Adjust path as needed
    this.backgroundLoaded = false;

    this.backgroundImage.onload = () => {
      this.backgroundLoaded = true;
      this.resizeCanvas();
      this.character = new Character(this.ctx, characterColor);
      this.joystick = new Joystick(this.handleJoystickMove.bind(this));
      window.addEventListener('resize', this.resizeCanvas.bind(this));
    };

    this.backgroundImage.onerror = () => console.error('Failed to load background image.');

    // Start game loop immediately
    this.gameLoop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.drawBackground(); // Redraw background after resize
  }

  handleJoystickMove(direction) {
    if (this.character) {
      this.character.move(direction);
    }
  }

  drawBackground() {
    if (this.backgroundLoaded) {
      this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      // Draw loading screen or placeholder
      this.ctx.fillStyle = 'black';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.fillStyle = 'white';
      this.ctx.font = '20px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Loading...', this.canvas.width / 2, this.canvas.height / 2);
    }
  }

  gameLoop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackground();
    if (this.character) {
      this.character.draw();
    }
    requestAnimationFrame(() => this.gameLoop());
  }
}
