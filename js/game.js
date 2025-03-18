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

    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.5 // Adjust this value to change the zoom level
    };
    this.backgroundImage.onload = () => {
      this.backgroundLoaded = true;
      this.resizeCanvas();
      this.character = new Character(this.ctx, characterColor);
      this.joystick = new Joystick(this.handleJoystickMove.bind(this));
      window.addEventListener('resize', this.resizeCanvas.bind(this));
    };

    this.backgroundImage.onerror = () => console.error('Failed to load background image.');

    // Start game loop
    this.gameLoop();
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  handleJoystickMove(direction) {
    if (this.character) {
      this.character.move(direction);
      this.updateCamera();
    }
  }

  updateCamera() {
    // Calculate the position where the camera should be centered
    const targetX = this.character.x - this.canvas.width / (2 * this.camera.zoom);
    const targetY = this.character.y - this.canvas.height / (2 * this.camera.zoom);

    // Smoothly move the camera towards the target position
    this.camera.x += (targetX - this.camera.x) * 0.1;
    this.camera.y += (targetY - this.camera.y) * 0.1;
  }
  drawBackground() {
    if (this.backgroundLoaded) {
      // Save the current context state
      this.ctx.save();

      // Scale and translate the context based on the camera
      this.ctx.scale(this.camera.zoom, this.camera.zoom);
      this.ctx.translate(-this.camera.x, -this.camera.y);

      // Calculate the position to center the background
      const rightOffset = 310; // Adjust this value to move the image more or less to the right
      const centerX = (this.canvas.width / this.camera.zoom - this.backgroundImage.width) / 2 + rightOffset;
      const centerY = (this.canvas.height / this.camera.zoom - this.backgroundImage.height) / 2;

      // Draw the background image
      this.ctx.drawImage(
        this.backgroundImage,
        centerX,
        centerY,
        this.backgroundImage.width,
        this.backgroundImage.height
      );

      // Restore the context state
      this.ctx.restore();
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
      this.updateCamera();

      // Save the current context state
      this.ctx.save();

      // Apply camera transformations
      this.ctx.scale(this.camera.zoom, this.camera.zoom);
      this.ctx.translate(-this.camera.x, -this.camera.y);

      // Draw the character
      this.character.draw();

      // Restore the context state
      this.ctx.restore();
    }

    requestAnimationFrame(() => this.gameLoop());
  }
}
