import { Joystick } from './joystick.js';
import { Character } from './character.js';

export class Game {
  constructor(characterColor) {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    this.character = new Character(this.ctx, characterColor);
    this.joystick = new Joystick(this.handleJoystickMove.bind(this));

    window.addEventListener('resize', this.resizeCanvas.bind(this));
    this.gameLoop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  handleJoystickMove(direction) {
    this.character.move(direction);
  }

  gameLoop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.character.draw();
    requestAnimationFrame(this.gameLoop.bind(this));
  }
}
