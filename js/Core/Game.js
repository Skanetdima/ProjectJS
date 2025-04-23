// src/core/Game.js
import { InputManager } from './InputManager.js';
// Используем правильный регистр в имени папки/файла: UI/UIManager.js
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';
import { Level } from './Level.js';
import { GameState, questions, TARGET_BOOKS_TO_WIN, LIFT_COOLDOWN_MS } from '../utils/constants.js';
import { GameRenderer } from './GameRenderer.js';
import { GameplayManager } from './GameplayManager.js';

// Asset Imports (пути должны быть правильными относительно HTML файла)
import redSprite from '../../images/character_red.png';
import blueSprite from '../../images/character_blue.png';
import yellowSprite from '../../images/character_yellow.png';
import greenSprite from '../../images/character_green.png';
import bookSprite from '../../images/book.png';

export class Game {
  constructor(characterColor) {
    console.log(`[Game] Initializing with character: ${characterColor}`);
    this.characterColor = characterColor;
    this._gameState = GameState.LOADING;
    this.isRunning = false;

    // Глобальные игровые переменные
    this.totalBooksCollectedGlobally = 0;
    this.targetBooksToWin = TARGET_BOOKS_TO_WIN;
    this.availableQuestions = [];

    // Состояние взаимодействия
    this.currentBookTarget = null;
    this.currentQuestionData = null;
    this.liftCooldownActive = false;
    this.liftCooldownTimer = null;

    // Основные компоненты игры
    this.canvas = null;
    this.ctx = null;
    this.character = null;
    this.level = null;
    this.inputManager = null;
    this.renderer = null;
    this.gameplayManager = null; // Инициализируется позже

    // Загруженные ассеты
    this.sprites = { red: redSprite, blue: blueSprite, yellow: yellowSprite, green: greenSprite };
    this.bookImage = null;

    // Привязка методов к контексту
    this.gameLoop = this.gameLoop.bind(this);
    this._handleFatalError = this._handleFatalError.bind(this);

    // --- Последовательность инициализации ---
    try {
      this._initializeCoreComponents(); // Синхронная инициализация базовых менеджеров
      this.renderer = new GameRenderer(this); // Инициализация рендерера
      const { canvas, ctx } = this.renderer.initializeCanvas(); // Получение canvas и context
      this.canvas = canvas;
      this.ctx = ctx;
      this.gameplayManager = new GameplayManager(this); // Инициализация геймплей-менеджера
      this._addEventListeners(); // Добавление глобальных слушателей (resize)
      this._loadAssetsAndStart(); // Асинхронная загрузка ассетов и старт игры
    } catch (error) {
      console.error('[Game] Core Initialization failed:', error);
      // Показываем алерт, так как UI может быть еще не готов
      alert(`Критическая ошибка инициализации: ${error.message}`);
      // Устанавливаем состояние ошибки без алерта (он уже был)
      this._handleFatalError(`Init Error: ${error.message}`, false);
    }
  }

  // --- Геттер/Сеттер для состояния игры ---
  get gameState() {
    return this._gameState;
  }
  setGameState(newState) {
    if (this._gameState !== newState) {
      console.log(`[Game State] ${this._gameState} -> ${newState}`);
      this._gameState = newState;
    }
  }

  // Инициализация базовых менеджеров
  _initializeCoreComponents() {
    this.inputManager = new InputManager();
    this.level = new Level(1, 3); // Этажи с 1 по 3
  }

  // Добавление слушателей событий окна
  _addEventListeners() {
    // Ресайз канваса обрабатывается рендерером
    window.addEventListener('resize', () => this.renderer?.resizeCanvas());
    // Слушатели клавиатуры добавляются в startGame
  }

  // Асинхронная загрузка ассетов и запуск игры
  async _loadAssetsAndStart() {
    try {
      this.setGameState(GameState.LOADING); // Устанавливаем состояние загрузки
      await this._loadAssets(); // Ждем загрузки всех ассетов
      this._initializeUI(); // Инициализируем UI после загрузки (если нужно)
      await this.startGame(); // Запускаем основную логику игры
    } catch (error) {
      console.error('[Game] Asset loading / UI init / Start Game failed:', error);
      this._handleFatalError(`Ошибка загрузки ресурсов или старта игры: ${error.message}`);
    }
  }

  // Загрузка изображений (спрайты, книга)
  async _loadAssets() {
    console.log('[Game] Loading assets...');
    const promises = [];
    const spritePath = this.sprites[this.characterColor] || this.sprites.red; // Выбор спрайта

    // Создание персонажа (требует ctx)
    if (!this.ctx) throw new Error('Canvas context not available for Character creation.');
    this.character = new Character(this.ctx, spritePath, {
      speed: 3,
      frameSize: 32,
      scale: 2,
      animationSpeed: 150,
      frameCount: 4,
    });
    // Промис для загрузки спрайта персонажа
    promises.push(
      new Promise((resolve, reject) => {
        // Успешная загрузка
        this.character.sprite.onload = () => {
          console.log(`  [Assets] Character sprite loaded: ${spritePath}`);
          resolve();
        };
        // Ошибка загрузки
        this.character.sprite.onerror = (err) =>
          reject(new Error(`Failed to load character sprite: ${spritePath}. ${err}`));
      })
    );

    // Загрузка изображения книги
    if (bookSprite) {
      this.bookImage = new Image();
      this.bookImage.src = bookSprite;
      // Промис для загрузки книги
      promises.push(
        new Promise((resolve, reject) => {
          // Успешная загрузка
          this.bookImage.onload = () => {
            console.log(`  [Assets] Book image loaded: ${bookSprite}`);
            resolve();
          };
          // Ошибка загрузки (не критично, есть fallback рендеринг)
          this.bookImage.onerror = () => {
            console.warn(
              ` [Assets] Failed to load book image: ${bookSprite}. Using fallback rendering.`
            );
            this.bookImage = null; // Сбрасываем, чтобы использовать fallback
            resolve(); // Все равно разрешаем промис
          };
        })
      );
    } else {
      console.warn('[Assets] Book sprite path is missing. Using fallback rendering.');
      this.bookImage = null;
    }

    // Ждем завершения всех промисов загрузки
    await Promise.all(promises);
    console.log('[Game] Assets loaded successfully.');
  }

  // Инициализация элементов UI через UIManager
  _initializeUI() {
    console.log('[Game] Initializing UI Manager...');
    UIManager.createControls(this.inputManager); // Создание кнопок управления
    UIManager.createQuestionUI(); // Создание UI для вопросов
    UIManager.createFloorSelectionUI(); // Создание UI для выбора этажа
    UIManager.ensureFlashMessageContainer(); // Убеждаемся, что контейнер сообщений есть
    // ! Ключевой момент: передаем экземпляр GameplayManager в UIManager !
    UIManager.setGameplayManager(this.gameplayManager);
    console.log('[Game] UI Manager setup complete.');
  }

  // Основная функция старта или рестарта игры
  async startGame() {
    console.log('[Game] Starting game...');
    // Проверка наличия всех необходимых компонентов
    if (!this.level || !this.character || !this.canvas || !this.renderer || !this.gameplayManager) {
      throw new Error('Cannot start game - essential components missing.');
    }

    this.setGameState(GameState.LOADING); // Состояние загрузки уровня
    // Скрываем все UI перед стартом
    UIManager.hideGameUI();
    UIManager.hideQuestion();
    UIManager.hideFloorSelectionUI();

    try {
      // 1. Загружаем начальный этаж (асинхронно)
      await this.level.loadFloor(this.level.minFloor, this.canvas.width, this.canvas.height);
      const currentMap = this.level.currentMap;
      if (!currentMap) {
        throw new Error('Failed to load initial map. Map object is null.');
      }

      // 2. Находим стартовую позицию на карте
      const startPos = currentMap.findRandomInitialSpawnPosition();
      if (!startPos) {
        throw new Error('Failed to find a valid starting position on the map!');
      }

      // 3. Устанавливаем начальные координаты и состояние персонажа
      this.character.x = startPos.x;
      this.character.y = startPos.y;
      this.character.currentDirection = Character.Direction.DOWN;
      this.character.isMoving = false;

      // 4. ! ВАЖНО: Проверяем, не заспавнился ли персонаж в стене СРАЗУ !
      // Передаем false (или не передаем), т.к. начальный спавн не должен быть на лифте
      this.gameplayManager?.ensureCharacterIsOnWalkableTile(false);

      // 5. Сброс игровых переменных
      this.totalBooksCollectedGlobally = 0;
      this.availableQuestions = [...questions]; // Новый набор вопросов
      this.liftCooldownActive = false;
      clearTimeout(this.liftCooldownTimer); // Сброс таймера кулдауна
      this.liftCooldownTimer = null;
      this.currentBookTarget = null;
      this.currentQuestionData = null;

      // 6. Центрируем камеру ПОСЛЕ установки позиции и возможного выталкивания
      this.renderer.centerCameraOnCharacter();

      // 7. Обновляем и показываем игровой UI
      UIManager.updateScore(this.totalBooksCollectedGlobally, this.targetBooksToWin);
      UIManager.showGameUI(); // Показываем канвас, счет, контролы

      // 8. Добавляем слушатели клавиатуры
      // Привязываем 'this' чтобы внутри обработчиков был доступ к экземпляру Game
      this._boundKeyDownHandler = this.handleKeyDown.bind(this);
      this._boundKeyUpHandler = this.handleKeyUp.bind(this);
      window.addEventListener('keydown', this._boundKeyDownHandler);
      window.addEventListener('keyup', this._boundKeyUpHandler);

      // 9. Переводим игру в активное состояние и запускаем игровой цикл
      this.setGameState(GameState.PLAYING);
      if (!this.isRunning) {
        this.isRunning = true;
        requestAnimationFrame(this.gameLoop); // Запуск цикла
        console.log('[Game] Game started successfully. Loop running.');
      }
    } catch (error) {
      // Обработка ошибок во время старта (загрузка карты, поиск спавна)
      console.error('[Game] Failed during startGame process:', error);
      this._handleFatalError(`Ошибка старта уровня: ${error.message}`);
      this.isRunning = false; // Убедимся, что цикл не запустится
    }
  }

  // Завершение игры (победа или ошибка)
  _setGameOver(win = true) {
    if (this.gameState === GameState.GAME_OVER) return; // Не завершать игру дважды

    this.setGameState(GameState.GAME_OVER);
    this.isRunning = false; // Останавливаем игровой цикл
    if (this.character) this.character.isMoving = false; // Останавливаем анимацию персонажа
    clearTimeout(this.liftCooldownTimer); // Останавливаем таймер лифта

    // Удаляем слушатели клавиатуры, добавленные в startGame
    if (this._boundKeyDownHandler) window.removeEventListener('keydown', this._boundKeyDownHandler);
    if (this._boundKeyUpHandler) window.removeEventListener('keyup', this._boundKeyUpHandler);
    this._boundKeyDownHandler = null; // Очищаем ссылки
    this._boundKeyUpHandler = null;

    // Скрываем весь игровой UI
    UIManager.hideGameUI();
    UIManager.hideQuestion();
    UIManager.hideFloorSelectionUI();

    if (win) {
      // Рисуем экран победы
      requestAnimationFrame(() => this.renderer?.drawWinScreen());
    } else {
      // При проигрыше/ошибке показываем главное меню
      // Сообщение об ошибке уже должно было быть показано через _handleFatalError
      const menuContainer = document.getElementById('menu-container');
      if (menuContainer) menuContainer.style.display = 'flex'; // Используем flex для центрирования
    }
    console.log(`[Game] Game Over. Win: ${win}`);
  }

  // Принудительная остановка игры (например, при выходе из игры)
  stopGame() {
    console.log('[Game] Explicit stop requested.');
    this._setGameOver(false); // Завершаем игру как проигрыш/остановку

    // Удаляем общие слушатели (если были добавлены не в startGame)
    window.removeEventListener('resize', () => this.renderer?.resizeCanvas());

    // Освобождаем ресурсы (опционально, но хорошо для сборки мусора)
    this.character = null;
    this.level = null;
    this.inputManager = null;
    this.renderer = null;
    this.gameplayManager = null;
    this.ctx = null;
    this.canvas = null; // Ссылка на элемент остается, но в игре больше не используется
    console.log('[Game] Game stopped and components potentially cleaned.');
  }

  // Обработка фатальных ошибок
  _handleFatalError(message, showAlert = true) {
    console.error('[Game] FATAL ERROR:', message);
    // Показываем alert только если запрошено и игра еще не закончена
    if (showAlert && this.gameState !== GameState.GAME_OVER) {
      alert(message);
    }
    // Завершаем игру как проигрыш
    this._setGameOver(false);
  }

  // --- Обработчики ввода ---
  handleKeyDown(e) {
    // Игнорируем ввод, если игра не в состоянии PLAYING или нет inputManager
    if (this.gameState !== GameState.PLAYING || !this.inputManager) return;

    let keyHandled = false; // Флаг, чтобы предотвратить стандартное поведение браузера
    const key = e.key.toLowerCase();

    // Сопоставление клавиш с действиями
    if (key === 'arrowup' || key === 'w') {
      this.inputManager.setKey('up', true);
      keyHandled = true;
    } else if (key === 'arrowdown' || key === 's') {
      this.inputManager.setKey('down', true);
      keyHandled = true;
    } else if (key === 'arrowleft' || key === 'a') {
      this.inputManager.setKey('left', true);
      keyHandled = true;
    } else if (key === 'arrowright' || key === 'd') {
      this.inputManager.setKey('right', true);
      keyHandled = true;
    }

    // Предотвращаем скроллинг страницы стрелками, если клавиша обработана
    if (keyHandled) e.preventDefault();
  }

  handleKeyUp(e) {
    // Обрабатываем отпускание клавиш всегда, чтобы сбросить состояние
    if (!this.inputManager) return;
    const key = e.key.toLowerCase();

    if (key === 'arrowup' || key === 'w') {
      this.inputManager.setKey('up', false);
    } else if (key === 'arrowdown' || key === 's') {
      this.inputManager.setKey('down', false);
    } else if (key === 'arrowleft' || key === 'a') {
      this.inputManager.setKey('left', false);
    } else if (key === 'arrowright' || key === 'd') {
      this.inputManager.setKey('right', false);
    }
  }

  // --- Основной игровой цикл ---
  gameLoop(timestamp) {
    // Выходим из цикла, если игра остановлена или завершена
    if (!this.isRunning || this.gameState === GameState.GAME_OVER) {
      return;
    }

    // 1. Обновление игровой логики (движение, взаимодействия)
    this.gameplayManager?.update(timestamp);

    // 2. Центрирование камеры (после обновления позиции персонажа)
    this.renderer?.centerCameraOnCharacter();

    // 3. Отрисовка текущего кадра
    this.renderer?.drawFrame();

    // 4. Запрос следующего кадра анимации
    requestAnimationFrame(this.gameLoop);
  }

  // --- Управление таймером кулдауна лифта ---
  startLiftCooldownTimer() {
    clearTimeout(this.liftCooldownTimer); // Сбрасываем предыдущий таймер, если был
    console.log(`[Game] Starting ${LIFT_COOLDOWN_MS}ms lift cooldown timer.`);
    this.liftCooldownTimer = setTimeout(() => {
      this.liftCooldownActive = false; // Снимаем флаг кулдауна
      this.liftCooldownTimer = null; // Очищаем ID таймера
      // Если игра все еще в состоянии перехода, значит, переход завершен
      if (this.gameState === GameState.TRANSITIONING) {
        this.setGameState(GameState.PLAYING); // Возвращаем в игровое состояние
        UIManager.flashMessage(`Прибытие на этаж ${this.level?.currentFloor}`, 'success', 1500);
      } else {
        // Если состояние изменилось (например, GAME_OVER), просто логируем
        console.warn(
          `[Game TIMER] Lift cooldown ended, but game state is ${this.gameState}. No state change applied.`
        );
      }
    }, LIFT_COOLDOWN_MS);
  }
} // Конец класса Game
