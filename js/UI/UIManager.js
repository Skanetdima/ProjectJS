export class UIManager {
  static createControls(inputManager) {
    const container = document.createElement('div');
    container.className = 'controls-container';

    const arrows = [
      { direction: 'up', icon: '↑' },
      { direction: 'left', icon: '←' },
      { direction: 'right', icon: '→' },
      { direction: 'down', icon: '↓' },
    ];

    arrows.forEach((arrow) => {
      const btn = document.createElement('button');
      btn.className = `control-btn ${arrow.direction}`;
      btn.textContent = arrow.icon;

      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        inputManager.setKey(arrow.direction, true);
      });

      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        inputManager.setKey(arrow.direction, false);
      });

      btn.addEventListener('mousedown', () => inputManager.setKey(arrow.direction, true));
      btn.addEventListener('mouseup', () => inputManager.setKey(arrow.direction, false));
      btn.addEventListener('mouseleave', () => inputManager.setKey(arrow.direction, false));

      container.appendChild(btn);
    });

    document.body.appendChild(container);
  }
}
