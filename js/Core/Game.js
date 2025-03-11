import { InputManager } from './InputManager.js';
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';
import { Level } from './Level.js';

// Импорты изображений через Webpack
import redSprite from '../../images/character_red.png';
import blueSprite from '../../images/character_blue.png';
import yellowSprite from '../../images/character_yellow.png';
import greenSprite from '../../images/character_green.png';

export class Game {
  constructor(characterColor) {
    this.characterColor = characterColor;
    this.isRunning = false;
    this.inTransition = false; // Флаг перехода между этажами

    // Соответствие цвета спрайту
    this.sprites = {
      red: redSprite,
      blue: blueSprite,
      yellow: yellowSprite,
      green: greenSprite,
    };

    // Привязка методов
    this.initCanvas = this.initCanvas.bind(this);
    this.resizeCanvas = this.resizeCanvas.bind(this);

    // Инициализируем Canvas
    this.initCanvas();

    // Создаем менеджер ввода и подключаем обработчики клавиатуры
    this.inputManager = new InputManager();
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Инициализируем UI
    this.initUI();

    // Конфигурация этажей: можно задавать transitionZones для перехода между этажами
    this.level = new Level([
      {
        floor: 2,
        transitionZones: [
          { x: 50, y: 50, width: 50, height: 50, type: 'stairs', targetFloor: 3 }
        ]
      },
      {
        floor: 3,
        transitionZones: [
          { x: 700, y: 500, width: 50, height: 50, type: 'stairs', targetFloor: 2 }
        ]
      }
    ]);

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
  }

  initUI() {
    UIManager.createControls(this.inputManager);
    const joystickContainer = document.getElementById('joystick-container');
    if (joystickContainer) {
      joystickContainer.style.display = 'block';
    }
    this.canvas.style.display = 'block';
  }

  handleKeyDown(e) {
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
        this.inputManager.setKey('up', true);
        break;
      case 'ArrowDown':
      case 's':
        this.inputManager.setKey('down', true);
        break;
      case 'ArrowLeft':
      case 'a':
        this.inputManager.setKey('left', true);
        break;
      case 'ArrowRight':
      case 'd':
        this.inputManager.setKey('right', true);
        break;
      default:
        break;
    }
  }

  handleKeyUp(e) {
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
        this.inputManager.setKey('up', false);
        break;
      case 'ArrowDown':
      case 's':
        this.inputManager.setKey('down', false);
        break;
      case 'ArrowLeft':
      case 'a':
        this.inputManager.setKey('left', false);
        break;
      case 'ArrowRight':
      case 'd':
        this.inputManager.setKey('right', false);
        break;
      default:
        break;
    }
  }

  async initCharacter() {
    const spritePath = this.sprites[this.characterColor] || redSprite;
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

  startGame() {
    // Передаем размеры окна, чтобы карта заполняла весь экран
    this.initCharacter()
      .then(() => this.level.load(window.innerWidth, window.innerHeight))
      .then(() => {
        this.isRunning = true;
        this.gameLoop();
      })
      .catch(error => {
        console.error('Game initialization failed:', error);
      });
  }

  gameLoop() {
    if (!this.isRunning) return;

    // Обновляем смещение карты, чтобы персонаж всегда был в центре канваса
    this.level.currentMap.offsetX = this.canvas.width / 2 - this.character.x;
    this.level.currentMap.offsetY = this.canvas.height / 2 - this.character.y;

    // Очищаем канвас с эффектом прозрачного шлейфа
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Отрисовываем карту
    if (this.level.currentMap) {
      this.level.currentMap.draw(this.ctx);
    }

    // Обработка ввода: вычисляем направление движения
    const direction = this.inputManager.getInputDirection();
    if (direction.x !== 0 || direction.y !== 0) {
      const candidateX = this.character.x + direction.x * this.character.speed;
      const candidateY = this.character.y + direction.y * this.character.speed;
      if (this.level.currentMap.isWalkable(candidateX, candidateY)) {
        if (direction.y > 0) {
          this.character.currentDirection = 0; // вниз
        } else if (direction.y < 0) {
          this.character.currentDirection = 2; // вверх
        } else if (direction.x > 0) {
          this.character.currentDirection = 1; // вправо
        } else if (direction.x < 0) {
          this.character.currentDirection = 3; // влево
        }
        this.character.x = candidateX;
        this.character.y = candidateY;
        this.character.isMoving = true;
      } else {
        this.character.isMoving = false;
      }
    } else {
      this.character.isMoving = false;
    }

    // Проверка перехода между этажами
    const transitionZone = this.level.getCurrentTransitionZone(this.character.x, this.character.y);
    if (transitionZone && !this.inTransition) {
      this.inTransition = true;
      this.level.loadFloor(transitionZone.targetFloor, window.innerWidth, window.innerHeight)
        .then(() => {
          // Перемещаем персонажа в центр нового этажа
          this.character.x = window.innerWidth / 2;
          this.character.y = window.innerHeight / 2;
          // Немного задержки для предотвращения повторного срабатывания
          setTimeout(() => { this.inTransition = false; }, 500);
        });
    }

    // Отрисовываем персонажа (он всегда отрисовывается по центру)
    this.character.draw();

    requestAnimationFrame(() => this.gameLoop());
  }
}
