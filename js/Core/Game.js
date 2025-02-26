import { InputManager } from './InputManager.js';
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';

// Импорты изображений через Webpack
import redSprite from '../../images/character_red.png';
import blueSprite from '../../images/character_blue.png';
import yellowSprite from '../../images/character_yellow.png';
import greenSprite from '../../images/character_green.png';

export class Game {
  constructor(characterColor) {
    this.characterColor = characterColor;
    this.isRunning = false;

    this.sprites = {
      red: redSprite,
      blue: blueSprite,
      yellow: yellowSprite,
      green: greenSprite,
    };

    // Привязка контекста к методам
    this.initCanvas = this.initCanvas.bind(this);
    this.resizeCanvas = this.resizeCanvas.bind(this);

    this.initCanvas();
    this.inputManager = new InputManager();
    this.initUI();  // Вызов метода, который теперь определён ниже
    this.startGame();
  }

  initCanvas() {
    console.log('initCanvas called');
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    window.addEventListener('resize', this.resizeCanvas);
  }

  resizeCanvas() {
    console.log('resizeCanvas called');
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
    // Создаём элементы управления через UIManager
    UIManager.createControls(this.inputManager);
    // Показываем нужные контейнеры
    document.getElementById('joystick-container').style.display = 'block';
    this.canvas.style.display = 'block';
  }

  async initCharacter() {
    const spritePath = this.sprites[this.characterColor];
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

  // Возможно, здесь должен быть метод startGame, если он используется
  startGame() {
    // Пример вызова инициализации персонажа и запуска игрового цикла
    this.initCharacter().then(() => {
      this.isRunning = true;
      this.gameLoop();
    }).catch(error => {
      console.error('Game initialization failed:', error);
    });
  }

  gameLoop() {
    if (!this.isRunning) return;
    // Игровой цикл: обновление и отрисовка персонажа
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const direction = this.inputManager.getInputDirection();
    this.character.move(direction);
    this.character.draw();

    requestAnimationFrame(() => this.gameLoop());
  }
}
