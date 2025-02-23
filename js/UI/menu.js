import { Game } from '../Core/Game.js';

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
      new Game(color);
    });
  });
}
