import { Game } from './game.js';

export function initializeMenu() {
  const menuContainer = document.getElementById('menu-container');
  const canvas = document.getElementById('game-canvas');
  const joystickContainer = document.getElementById('joystick-container');
  const circles = document.querySelectorAll('.character-circle');

  circles.forEach((circle) => {
    circle.addEventListener('click', () => {
      const color = circle.dataset.color;

      menuContainer.style.display = 'none';
      canvas.style.display = 'block';
      joystickContainer.style.display = 'block';

      // Wait a frame to ensure canvas is visible before creating the game
      requestAnimationFrame(() => new Game(color));
    });
  });
}
