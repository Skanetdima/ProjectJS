// src/Core/Game.js
import { InputManager } from './InputManager.js';
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';
import { Level } from './Level.js';

// --- Импорты изображений ---
import redSprite from '../../images/character_red.png';
import blueSprite from '../../images/character_blue.png';
import yellowSprite from '../../images/character_yellow.png';
import greenSprite from '../../images/character_green.png';
import bookSprite from '../../images/book.png'; // Раскомментируй, если есть текстура

// === МАССИВ ВОПРОСОВ ===
// Замени этот массив своими вопросами и ответами!
const questions = [
  {
    question: 'Какой метод Canvas API используется для рисования прямоугольника?',
    options: ['fillRect()', 'drawRect()', 'rect()', 'box()'],
    correctAnswer: 0, // Индекс правильного ответа (fillRect())
  },
  {
    question: 'Как получить случайное число от 0 (вкл) до 1 (искл) в JavaScript?',
    options: ['Math.random()', 'random()', 'Math.rnd()', 'rand(0,1)'],
    correctAnswer: 0, // Math.random()
  },
  {
    question: 'Столица Франции?',
    options: ['Берлин', 'Париж', 'Рим', 'Мадрид'],
    correctAnswer: 1, // Париж
  },
  {
    question: '2 + 2 * 2 = ?',
    options: ['8', '4', '6', 'Не знаю'],
    correctAnswer: 2, // 6
  },
  {
    question: 'Какой тег используется для создания основной текстовой ссылки в HTML?',
    options: ['<link>', '<a>', '<href>', '<ref>'],
    correctAnswer: 1, // <a>
  },
  {
    question: 'Что выведет `console.log(typeof null)`?',
    options: ['null', 'undefined', 'object', 'string'],
    correctAnswer: 2, // object (историческая особенность JS)
  },
  {
    question: 'Как называется основной цикл событий в JavaScript?',
    options: ['Game Loop', 'Event Loop', 'Update Cycle', 'Render Loop'],
    correctAnswer: 1, // Event Loop
  },
  // ... Добавь сюда больше вопросов ...
];
// ============================

// Перечисление возможных состояний игры для лучшей читаемости кода
const GameState = {
  LOADING: 'LOADING', // Игра загружается
  PLAYING: 'PLAYING', // Игрок управляет персонажем
  ASKING_QUESTION: 'ASKING_QUESTION', // Показан вопрос
  TRANSITIONING: 'TRANSITIONING', // Происходит переход между этажами
  GAME_OVER: 'GAME_OVER', // Игра завершена (победа)
};

export class Game {
  constructor(characterColor) {
    console.log(`Initializing game with character color: ${characterColor}`);
    this.characterColor = characterColor;
    this.gameState = GameState.LOADING; // Начинаем с загрузки
    this.isRunning = false; // Флаг активности игрового цикла (для requestAnimationFrame)

    this.totalBooksCollectedGlobally = 0; // Счетчик правильно собранных книг
    this.targetBooksToWin = 5; // <--- ЦЕЛЬ: Сколько книг собрать для победы (можно изменить)
    this.bookImage = null; // Здесь будет загруженное изображение книги

    // Словарь для доступа к спрайтам персонажей
    this.sprites = {
      red: redSprite,
      blue: blueSprite,
      yellow: yellowSprite,
      green: greenSprite,
    };

    // Данные для текущего вопроса
    this.currentBookTarget = null; // Ссылка на объект книги, к которой подошли
    this.currentQuestionData = null; // Данные текущего вопроса (текст, опции, ответ)
    // Копия массива вопросов, из которого будем выбирать случайные
    this.availableQuestions = [...questions];
    if (questions.length < this.targetBooksToWin) {
      console.warn(
        `Target books to win (${this.targetBooksToWin}) is greater than the number of available questions (${questions.length}). Winning might be impossible.`
      );
    }

    // Привязываем методы к контексту `this`
    this.initCanvas = this.initCanvas.bind(this);
    this.resizeCanvas = this.resizeCanvas.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.gameLoop = this.gameLoop.bind(this);
    this.handleAnswer = this.handleAnswer.bind(this); // Обработчик ответа на вопрос

    // --- Инициализация ---
    this.initCanvas(); // Канвас
    this.inputManager = new InputManager(); // Ввод
    this.addEventListeners(); // Слушатели событий

    this.level = new Level(1, 3); // Уровни (этажи 1-3)

    // Загружаем ассеты и стартуем игру
    this.loadAssets()
      .then(() => {
        console.log('Assets loaded. Creating UI...');
        UIManager.createControls(this.inputManager); // Кнопки управления и счет
        UIManager.createQuestionUI(); // UI для вопросов
        this.startGame(); // Начинаем игровой процесс
      })
      .catch((error) => {
        console.error('Fatal error during asset loading:', error);
        alert('Не удалось загрузить ресурсы игры. Попробуйте перезагрузить страницу.');
        this.gameState = GameState.GAME_OVER; // Ставим в конечное состояние при ошибке загрузки
      });
  }

  // Инициализация канваса
  initCanvas() {
    this.canvas = document.getElementById('game-canvas');
    if (!this.canvas) throw new Error("Canvas element with id 'game-canvas' not found!");
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false; // Для пиксель-арта
    this.resizeCanvas();
  }

  // Изменение размера канваса
  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.centerCameraOnCharacter(); // Центрируем камеру после ресайза
  }

  // Центрирование камеры на персонаже
  centerCameraOnCharacter() {
    if (this.character && this.level?.currentMap) {
      this.level.currentMap.offsetX = this.canvas.width / 2 - this.character.x;
      this.level.currentMap.offsetY = this.canvas.height / 2 - this.character.y;
    }
  }

  // Добавление слушателей событий
  addEventListeners() {
    window.addEventListener('resize', this.resizeCanvas);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  // Обработка нажатия клавиш (блокируем движение во время вопроса/перехода)
  handleKeyDown(e) {
    // Игнорируем ввод для движения, если игра не в состоянии PLAYING
    if (this.gameState !== GameState.PLAYING) {
      return;
    }
    // Обрабатываем только клавиши движения
    let keyHandled = false;
    switch (e.key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        this.inputManager.setKey('up', true);
        keyHandled = true;
        break;
      case 'arrowdown':
      case 's':
        this.inputManager.setKey('down', true);
        keyHandled = true;
        break;
      case 'arrowleft':
      case 'a':
        this.inputManager.setKey('left', true);
        keyHandled = true;
        break;
      case 'arrowright':
      case 'd':
        this.inputManager.setKey('right', true);
        keyHandled = true;
        break;
    }
    // Предотвращаем скролл страницы, если нажата игровая клавиша
    if (keyHandled) {
      e.preventDefault();
    }
  }

  // Обработка отпускания клавиш
  handleKeyUp(e) {
    // Отпускаем клавиши независимо от состояния игры, чтобы избежать "залипания"
    switch (e.key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        this.inputManager.setKey('up', false);
        break;
      case 'arrowdown':
      case 's':
        this.inputManager.setKey('down', false);
        break;
      case 'arrowleft':
      case 'a':
        this.inputManager.setKey('left', false);
        break;
      case 'arrowright':
      case 'd':
        this.inputManager.setKey('right', false);
        break;
    }
  }

  // Асинхронная загрузка ассетов
  async loadAssets() {
    console.log('Loading assets...');
    const promises = [];
    // 1. Загрузка спрайта персонажа
    const spritePath = this.sprites[this.characterColor] || this.sprites.red;
    this.character = new Character(this.ctx, spritePath, {
      speed: 3,
      frameSize: 32,
      scale: 2,
      animationSpeed: 150,
    });
    promises.push(
      new Promise((resolve, reject) => {
        this.character.sprite.onload = () => {
          console.log('Character sprite loaded:', spritePath);
          resolve();
        };
        this.character.sprite.onerror = (err) => {
          console.error('Failed to load character sprite:', spritePath, err);
          reject(new Error(`Failed to load sprite: ${spritePath}`));
        };
      })
    );

    // 2. Загрузка изображения книги (если путь указан)
    const bookImagePath = bookSprite;
    if (bookImagePath) {
      this.bookImage = new Image();
      this.bookImage.src = bookImagePath;
      promises.push(
        new Promise((resolve) => {
          // Не прерываем игру из-за книги
          this.bookImage.onload = () => {
            console.log('Book image loaded:', bookImagePath);
            resolve();
          };
          this.bookImage.onerror = () => {
            console.warn('Failed to load book image:', bookImagePath);
            resolve();
          }; // Просто продолжаем без картинки
        })
      );
    }

    await Promise.all(promises);
    console.log('All assets finished loading.');
  }

  // Старт игры (после загрузки ассетов и создания UI)
  async startGame() {
    console.log('Starting game...');
    this.gameState = GameState.LOADING; // Показываем, что идет загрузка уровня
    try {
      // Загружаем первый этаж
      await this.level.loadFloor(this.level.currentFloor, this.canvas.width, this.canvas.height);

      // Ставим персонажа на стартовую позицию
      const startPos = this.level.currentMap.findRandomWalkablePosition();
      this.character.x = startPos.x;
      this.character.y = startPos.y;
      console.log(
        `Character starting at world (${this.character.x.toFixed(1)}, ${this.character.y.toFixed(
          1
        )}) on floor ${this.level.currentFloor}`
      );

      this.totalBooksCollectedGlobally = 0; // Сброс счетчика
      this.availableQuestions = [...questions]; // Сброс пула вопросов
      this.gameState = GameState.PLAYING; // Переходим в игровое состояние
      UIManager.updateScore(this.totalBooksCollectedGlobally, this.targetBooksToWin); // Обновляем UI
      UIManager.showGameUI(); // Показываем игровой интерфейс

      // Запускаем игровой цикл, если он еще не запущен
      if (!this.isRunning) {
        this.isRunning = true;
        requestAnimationFrame(this.gameLoop);
        console.log('Game loop started.');
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      alert(`Ошибка при запуске игры: ${error.message}`);
      this.gameState = GameState.GAME_OVER; // Ставим в конечное состояние при ошибке
      UIManager.hideGameUI();
    }
  }

  // --- Проверка столкновений ---
  checkCollision(targetX, targetY) {
    const map = this.level.currentMap;
    if (!map) return true; // Считаем столкновением, если карты нет

    const char = this.character;
    // Коллизионный бокс (можно подбирать значения)
    const collisionWidth = char.renderSize * 0.4; // Уменьшил ширину
    const collisionHeight = char.renderSize * 0.2; // Уменьшил высоту
    const halfWidth = collisionWidth / 2;
    const offsetY = char.renderSize * 0.35; // Сместил чуть ниже центра

    const bottomY = targetY + offsetY;
    const topY = bottomY - collisionHeight;
    const leftX = targetX - halfWidth;
    const rightX = targetX + halfWidth;

    // Проверяем 4 угла и центр нижней грани
    if (
      !map.isWalkable(leftX, topY) ||
      !map.isWalkable(rightX, topY) ||
      !map.isWalkable(leftX, bottomY) ||
      !map.isWalkable(rightX, bottomY) ||
      !map.isWalkable(targetX, bottomY)
    ) {
      // Центр низа
      return true; // Столкновение
    }
    return false; // Нет столкновения
  }

  // --- Обработка перехода между этажами ---
  handleTransition(zone) {
    if (this.gameState === GameState.TRANSITIONING) return; // Игнорировать, если уже переходим

    console.log(`Entering transition zone ${zone.type} to floor ${zone.targetFloor}`);
    this.gameState = GameState.TRANSITIONING; // Меняем состояние
    this.character.isMoving = false; // Останавливаем анимацию движения

    // Скрываем UI вопроса на всякий случай
    this.currentBookTarget = null;
    this.currentQuestionData = null;
    UIManager.hideQuestion();

    this.level
      .loadFloor(zone.targetFloor, this.canvas.width, this.canvas.height)
      .then(() => {
        console.log(`Successfully loaded floor ${this.level.currentFloor}`);
        // --- Логика поиска парной лестницы ---
        let entryStair = null;
        const newMapStairs = this.level.currentMap?.stairs;
        if (zone.type === 'stairs_down') entryStair = newMapStairs?.up;
        else if (zone.type === 'stairs_up') entryStair = newMapStairs?.down;
        // --- Позиционирование персонажа ---
        if (entryStair) {
          this.character.x = entryStair.x;
          this.character.y = entryStair.y;
        } else {
          // Если парной лестницы нет
          console.warn(
            `Could not find corresponding entry stair on floor ${this.level.currentFloor}. Placing at random spot.`
          );
          const startPos = this.level.currentMap.findRandomWalkablePosition();
          this.character.x = startPos.x;
          this.character.y = startPos.y;
        }
        console.log(
          `Placed character at world (${this.character.x.toFixed(1)}, ${this.character.y.toFixed(
            1
          )})`
        );
        this.centerCameraOnCharacter(); // Центрируем камеру

        // Возврат в игровое состояние после короткой паузы
        setTimeout(() => {
          this.gameState = GameState.PLAYING;
          console.log('Transition complete. GameState set to PLAYING.');
        }, 100); // Уменьшил задержку
      })
      .catch((error) => {
        console.error('Error during floor transition:', error);
        alert(`Ошибка при переходе на этаж ${zone.targetFloor}: ${error.message}`);
        this.gameState = GameState.PLAYING; // Возвращаем в игру при ошибке
      });
  }

  // --- Попытка инициировать вопрос при приближении к книге ---
  tryInitiateQuestion() {
    if (this.gameState !== GameState.PLAYING) return; // Только в состоянии игры
    if (!this.level.currentMap || !this.character) return;

    // Ищем ближайшую неотвеченную книгу
    const nearbyBook = this.level.currentMap.findNearbyUnansweredBook(
      this.character.x,
      this.character.y
    );

    if (nearbyBook) {
      console.log('Nearby unanswered book found, initiating question...');
      this.character.isMoving = false; // Останавливаем персонажа
      this.gameState = GameState.ASKING_QUESTION; // Меняем состояние
      this.currentBookTarget = nearbyBook; // Запоминаем книгу

      // --- Выбор вопроса ---
      if (this.availableQuestions.length === 0) {
        // Если вопросы кончились
        console.warn('No more unique questions available! Resetting question pool.');
        this.availableQuestions = [...questions];
        if (this.availableQuestions.length === 0) {
          // Если и в оригинале нет
          console.error("CRITICAL: No questions defined in the 'questions' array!");
          alert('Ошибка: вопросы для книг не найдены!');
          this.gameState = GameState.PLAYING; // Возвращаемся, делать нечего
          return;
        }
      }
      // Выбираем случайный вопрос из оставшихся
      const questionIndex = Math.floor(Math.random() * this.availableQuestions.length);
      // Выбираем вопрос и УДАЛЯЕМ его из пула доступных на эту игру
      this.currentQuestionData = this.availableQuestions.splice(questionIndex, 1)[0];

      console.log(`Showing question: "${this.currentQuestionData.question}"`);
      // Показываем UI вопроса через UIManager, передавая колбэк для ответа
      UIManager.showQuestion(this.currentQuestionData, this.handleAnswer);
    }
  }

  // --- Обработка ответа на вопрос (вызывается из UIManager при клике на кнопку) ---
  handleAnswer(selectedOptionIndex) {
    // Дополнительная проверка состояния и данных
    if (
      this.gameState !== GameState.ASKING_QUESTION ||
      !this.currentQuestionData ||
      !this.currentBookTarget
    ) {
      console.error(
        'handleAnswer called in invalid state or with missing data. Current state:',
        this.gameState
      );
      UIManager.hideQuestion(); // Скрываем UI на всякий случай
      this.gameState = GameState.PLAYING; // Возвращаемся в игру
      return;
    }

    const correctAnswerIndex = this.currentQuestionData.correctAnswer;
    const isCorrect = selectedOptionIndex === correctAnswerIndex;

    if (isCorrect) {
      console.log('Answer is CORRECT!');
      // Помечаем книгу как собранную на карте (она исчезнет при след. отрисовке)
      this.level.currentMap.markBookAsCollected(this.currentBookTarget);
      this.totalBooksCollectedGlobally++; // Увеличиваем глобальный счетчик
      console.log(
        `Total books collected: ${this.totalBooksCollectedGlobally}/${this.targetBooksToWin}`
      );
      UIManager.updateScore(this.totalBooksCollectedGlobally, this.targetBooksToWin);
      // TODO: Добавить звук успеха

      // --- Проверка условия победы ---
      if (this.totalBooksCollectedGlobally >= this.targetBooksToWin) {
        this.setGameOver(); // Переходим в состояние победы
        return; // Выходим, обработка завершена
      }
    } else {
      console.log('Answer is INCORRECT.');
      // Возвращаем вопрос обратно в пул доступных (может попасться снова)
      this.availableQuestions.push(this.currentQuestionData);
      // TODO: Добавить звук неудачи, возможно, короткую блокировку этой книги
      alert('Неверный ответ!'); // Простое уведомление
    }

    // В любом случае (кроме победы) скрываем UI вопроса и возвращаемся в игру
    UIManager.hideQuestion();
    this.currentBookTarget = null;
    this.currentQuestionData = null;
    this.gameState = GameState.PLAYING;
  }

  // --- Перевод игры в состояние Game Over (Победа) ---
  setGameOver() {
    console.log('GAME OVER! Target books collected.');
    this.gameState = GameState.GAME_OVER;
    this.character.isMoving = false; // Остановить анимацию
    this.isRunning = false; // Останавливаем основной цикл обновлений
    UIManager.hideGameUI(); // Скрыть обычный игровой UI
    // Финальная отрисовка экрана победы будет сделана последним вызовом gameLoop
    // Можно явно вызвать отрисовку еще раз, если нужно
    requestAnimationFrame(() => this.drawWinScreen());
  }

  // --- Отрисовка экрана победы ---
  drawWinScreen() {
    // Очищаем экран черным цветом
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Настройки текста
    this.ctx.fillStyle = 'white';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle'; // Выравнивание по вертикали

    // Рисуем текст победы
    this.ctx.font = 'clamp(32px, 8vw, 48px) Arial'; // Адаптивный шрифт
    this.ctx.fillText('Поздравляем!', this.canvas.width / 2, this.canvas.height / 2 - 80);

    this.ctx.font = 'clamp(24px, 5vw, 32px) Arial';
    this.ctx.fillText(
      `Вы собрали все ${this.targetBooksToWin} книг!`,
      this.canvas.width / 2,
      this.canvas.height / 2
    );

    this.ctx.font = 'clamp(18px, 4vw, 24px) Arial';
    this.ctx.fillText('Игра пройдена!', this.canvas.width / 2, this.canvas.height / 2 + 60);

    // Опционально: Можно добавить кнопку "Начать заново", которая перезагружает страницу
    // или вызывает метод для сброса игры и возврата в меню.
  }

  // --- Главный игровой цикл ---
  gameLoop(timestamp) {
    // Если флаг isRunning снят (например, в setGameOver), прекращаем цикл
    if (!this.isRunning) {
      // Если это состояние победы, убедимся что экран отрисован
      if (this.gameState === GameState.GAME_OVER) {
        this.drawWinScreen();
      }
      console.log('Game loop stopped.');
      return;
    }

    // Логика обновления в зависимости от состояния игры
    switch (this.gameState) {
      case GameState.PLAYING:
        this.updatePlaying(timestamp); // Обновляем движение, коллизии, проверку книг/переходов
        break;
      // В других состояниях (LOADING, ASKING_QUESTION, TRANSITIONING)
      // логика обновления персонажа и мира не выполняется
      case GameState.LOADING:
      case GameState.ASKING_QUESTION:
      case GameState.TRANSITIONING:
        // Можно добавить здесь какую-то анимацию ожидания, если нужно
        break;
      // Состояние GAME_OVER обрабатывается досрочным выходом или остановкой isRunning
    }

    // --- Отрисовка кадра (происходит для всех активных состояний) ---
    this.drawFrame();

    // Запрашиваем следующий кадр анимации, продолжая цикл
    requestAnimationFrame(this.gameLoop);
  }

  // --- Логика обновления для состояния PLAYING ---
  updatePlaying(timestamp) {
    const map = this.level.currentMap;
    const char = this.character;
    if (!map || !char) return; // Безопасность

    // Обновляем смещение карты (камера)
    this.centerCameraOnCharacter();

    // --- Обработка движения ---
    let dx = 0,
      dy = 0,
      intendedMove = false;
    const direction = this.inputManager.getInputDirection();
    dx = direction.x * char.speed;
    dy = direction.y * char.speed;
    intendedMove = dx !== 0 || dy !== 0;

    let actualMoveX = 0,
      actualMoveY = 0;

    if (intendedMove) {
      // --- Логика проверки коллизий и скольжения ---
      if (dx !== 0 && !this.checkCollision(char.x + dx, char.y)) {
        actualMoveX = dx;
      }
      if (dy !== 0 && !this.checkCollision(char.x + actualMoveX, char.y + dy)) {
        actualMoveY = dy;
      }
      // Повторные проверки для лучшего скольжения по углам
      if (
        dx !== 0 &&
        actualMoveX === 0 &&
        actualMoveY !== 0 &&
        !this.checkCollision(char.x + dx, char.y + actualMoveY)
      ) {
        actualMoveX = dx;
      }
      if (
        dy !== 0 &&
        actualMoveY === 0 &&
        actualMoveX !== 0 &&
        !this.checkCollision(char.x + actualMoveX, char.y + dy)
      ) {
        actualMoveY = dy;
      }
      // --- Конец логики коллизий ---

      // Обновляем позицию персонажа
      char.x += actualMoveX;
      char.y += actualMoveY;

      char.isMoving = actualMoveX !== 0 || actualMoveY !== 0;

      // Обновление направления спрайта (упрощенный вариант)
      if (char.isMoving) {
        if (actualMoveX > 0) char.currentDirection = 1; // Право
        else if (actualMoveX < 0) char.currentDirection = 3; // Лево
        // Вертикальное направление обновляем, только если нет горизонтального движения
        // (дает приоритет горизонтальной анимации при диагональном движении)
        else if (actualMoveY > 0) char.currentDirection = 0; // Низ
        else if (actualMoveY < 0) char.currentDirection = 2; // Верх
      }
    } else {
      // Если нет намерения двигаться, останавливаем анимацию
      char.isMoving = false;
    }
    // Если уперлись в стену (intendedMove=true, isMoving=false), поворот не делаем,
    // персонаж останется смотреть в последнем успешном направлении.

    // --- Проверка активации книги ---
    // Вызываем только если персонаж не двигался в этом кадре,
    // чтобы избежать случайной активации при проходе мимо
    if (!char.isMoving) {
      this.tryInitiateQuestion();
    }

    // --- Проверка зон перехода (лестниц) ---
    // Вызываем только если не двигался, чтобы избежать входа/выхода за 1 кадр
    if (!char.isMoving && this.level.transitionZones.length > 0) {
      const zone = this.level.getCurrentTransitionZone(char.x, char.y);
      if (zone) {
        this.handleTransition(zone);
      }
    }
  }

  // --- Отрисовка одного кадра ---
  drawFrame() {
    // Очищаем канвас
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const map = this.level.currentMap;
    const char = this.character;

    // Рисуем карту (тайлы, комнаты, книги)
    if (map) {
      map.draw(this.ctx, this.bookImage);
    }

    // Рисуем персонажа
    if (char) {
      char.draw();
    }

    // UI для вопроса рисуется поверх всего остального через UIManager,
    // нам здесь его рисовать не нужно.
  }

  // --- Метод для полной остановки игры и очистки ---
  stopGame() {
    console.log('Stopping game...');
    this.isRunning = false; // Останавливаем цикл requestAnimationFrame
    this.gameState = GameState.GAME_OVER; // Устанавливаем финальное состояние

    // Убираем слушатели событий окна
    window.removeEventListener('resize', this.resizeCanvas);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);

    // Скрываем весь игровой интерфейс
    UIManager.hideGameUI();
    UIManager.hideQuestion();

    // Можно добавить здесь дополнительную очистку, если нужно
    // (например, обнулить ссылки на объекты)
    this.character = null;
    this.level = null;
    this.inputManager = null;

    console.log('Game stopped and cleaned up.');
  }
}
