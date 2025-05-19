// src/core/Game.js
import { InputManager } from './InputManager.js';
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';
import { Level } from './Level.js';
import { GameState, questions, TARGET_BOOKS_TO_WIN, LIFT_COOLDOWN_MS } from '../utils/constants.js';
import { GameRenderer } from './GameRenderer.js';
import { GameplayManager } from './GameplayManager.js';
import { AudioManager } from '../audio/AudioManager.js';

// Импорты спрайтов (убедись, что пути корректны)
import redSpritePath from '../../assets/images/character_red.png';
import blueSpritePath from '../../assets/images/character_blue.png';
import yellowSpritePath from '../../assets/images/character_yellow.png';
import greenSpritePath from '../../assets/images/character_green.png';
import bookSpriteImage from '../../assets/images/book.png';

export class Game {
  static CREATOR_NAMES = ['Rafał', 'Dima', 'Venia', 'Kacper'];
  static CLASS_ATTENDING_INFO = 'Klasa 2P2T / Projektowanie stron internetowych';

  constructor(characterColor) {
    // characterColor передается из Menu.js
    console.log(`[Game] Initializing with character: ${characterColor}`);
    if (!characterColor) {
      const errorMsg = '[Game] CRITICAL: Game initialized without a characterColor!';
      console.error(errorMsg);
      alert('Game cannot start: no character was selected.'); // Basic fallback
      throw new Error(errorMsg);
    }
    this.characterColor = characterColor;
    this._gameState = GameState.IDLE; // Начальное состояние, игра еще не запущена
    this.isRunning = false;

    // ... (остальные свойства инициализируются как раньше)
    this.totalBooksCollectedGlobally = 0;
    this.targetBooksToWin = TARGET_BOOKS_TO_WIN;
    this.availableQuestions = [];
    this.currentBookTarget = null;
    this.currentQuestionData = null;
    this.liftCooldownActive = false;
    this.liftCooldownTimer = null;
    this.canvas = null;
    this.ctx = null;
    this.character = null;
    this.level = null;
    this.inputManager = null;
    this.renderer = null;
    this.gameplayManager = null;
    this.audioManager = null; // Будет создан ниже
    this.sprites = {
      red: redSpritePath,
      blue: blueSpritePath,
      yellow: yellowSpritePath,
      green: greenSpritePath,
    };
    this.bookImage = null;
    this.gameLoop = this.gameLoop.bind(this);
    this._handleFatalError = this._handleFatalError.bind(this);
    this._boundKeyDownHandler = null;
    this._boundKeyUpHandler = null;

    try {
      this._initializeCoreComponents(); // inputManager, level

      this.audioManager = new AudioManager(); // AudioManager создается здесь
      console.log('[Game] AudioManager created.');
      // Menu.js нуждается в AudioManager для слайдера громкости.
      // Это можно сделать, если Menu - синглтон или если есть ссылка на экземпляр Menu.
      // Поскольку Menu.js экспортирует currentGameInstance, который является экземпляром Game,
      // а Menu создает Game, это создает цикл.
      // Проще всего, чтобы Menu устанавливал громкость через localStorage, а AudioManager читал ее.
      // Либо, если экземпляр Menu передается в Game, или используется глобальная ссылка на Menu.
      // Пока что оставим так: AudioManager читает из localStorage. Menu.js уже пишет в localStorage.

      this.gameplayManager = new GameplayManager(this);
      console.log('[Game] GameplayManager created.');

      this.renderer = new GameRenderer(this);
      const { canvas, ctx } = this.renderer.initializeCanvas();
      this.canvas = canvas;
      this.ctx = ctx;
      console.log('[Game] Renderer and Canvas initialized.');

      // UIManager используется для внутриигрового UI. Menu.js управляет главным меню.
      UIManager.setGameplayManager(this.gameplayManager);
      // UIManager.setAudioManager(this.audioManager); // UIManager не управляет громкостью напрямую
      UIManager.initializeUI(this.inputManager); // Настраивает контролы, панели вопросов и т.д.
      console.log('[Game] UIManager for in-game UI initialized.');

      this._addEventListeners();

      // Игра ждет вызова triggerGameStart() из Menu.js
      // Menu.js вызовет его после создания этого экземпляра Game.
      console.log('[Game] Core components initialized. Waiting for triggerGameStart() from Menu.');
    } catch (error) {
      console.error('[Game] Synchronous core initialization failed:', error);
      // UIManager может быть еще не готов для flashMessage
      alert(`Critical initialization error: ${error.message}. Game cannot start.`);
      // Не вызываем _handleFatalError здесь, так как игра может не быть в состоянии его обработать
    }
  }

  // Методы get gameState, setGameState, _initializeCoreComponents, _addEventListeners
  // остаются такими же, как в предыдущем ответе.
  get gameState() {
    return this._gameState;
  }
  setGameState(newState) {
    if (this._gameState !== newState) {
      console.log(`[Game State] ${this._gameState} -> ${newState}`);
      this._gameState = newState;
    }
  }
  _initializeCoreComponents() {
    this.inputManager = new InputManager();
    this.level = new Level(1, 3);
  }
  _addEventListeners() {
    window.addEventListener('resize', () => this.renderer?.resizeCanvas());
  }

  async triggerGameStart() {
    // Эта функция вызывается из Menu.js после создания экземпляра Game
    if (this.gameState !== GameState.IDLE) {
      console.warn(
        `[Game] triggerGameStart called but game state is ${this.gameState}. Current character: ${this.characterColor}. Aborting.`
      );
      // Если игра уже запущена или загружается, не делаем ничего
      return;
    }
    console.log(
      `[Game] triggerGameStart received for character: ${this.characterColor}. Starting asset loading...`
    );

    const loadingOverlay = UIManager.getLoadingOverlay();
    if (loadingOverlay) loadingOverlay.classList.add('visible');

    try {
      // _loadAssetsAndThenStartLogic уже устанавливает GameState.LOADING
      await this._loadAssetsAndThenStartLogic();
      console.log('[Game] Game start sequence (assets and logic) completed successfully.');
      // loadingOverlay будет скрыт внутри _loadAssetsAndThenStartLogic или _startGameLogic
    } catch (error) {
      console.error(
        '[Game] Error during _loadAssetsAndThenStartLogic (called from triggerGameStart):',
        error
      );
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      // _handleFatalError будет вызван из _loadAssetsAndThenStartLogic, если ошибка там.
      // Если _handleFatalError не был вызван, а ошибка произошла, делаем это здесь.
      if (this.gameState !== GameState.GAME_OVER) {
        this._handleFatalError(`Game start process failed: ${error.message}`);
      }
    }
  }

  async _loadAssetsAndThenStartLogic() {
    // Этот метод остается почти таким же
    const loadingOverlay = UIManager.getLoadingOverlay(); // Получаем еще раз, если нужно
    try {
      this.setGameState(GameState.LOADING);
      if (loadingOverlay && !loadingOverlay.classList.contains('visible')) {
        loadingOverlay.classList.add('visible');
      }

      await this._loadAssets(); // Загрузка спрайтов, изображений
      await this._startGameLogic(); // Запуск игровой логики, включая музыку

      // Успешное завершение, скрываем оверлей загрузки (если еще видим)
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
    } catch (error) {
      console.error('[Game] _loadAssetsAndThenStartLogic failed:', error);
      if (loadingOverlay) loadingOverlay.classList.remove('visible'); // Убираем оверлей при ошибке
      this._handleFatalError(`Asset loading or game logic start error: ${error.message}`);
      throw error; // Перебрасываем ошибку дальше, чтобы triggerGameStart мог её поймать
    }
  }

  async _loadAssets() {
    // Этот метод остается почти таким же, использует this.characterColor
    console.log('[Game] Loading assets...');
    const promises = [];
    const spritePathKey = this.characterColor || 'red'; // Используем выбранный цвет или красный по умолчанию
    const spritePath = this.sprites[spritePathKey];

    if (!spritePath) {
      throw new Error(`Sprite path for character color "${spritePathKey}" is undefined.`);
    }
    console.log(`[Game] Using sprite path: ${spritePath} for character ${spritePathKey}`);

    if (!this.ctx) throw new Error('Canvas context not available for Character creation.');
    this.character = new Character(this.ctx, spritePath, {
      speed: 3,
      frameSize: 32,
      scale: 2,
      animationSpeed: 150,
      frameCount: 4,
    });
    promises.push(
      new Promise((resolve, reject) => {
        this.character.sprite.onload = () => {
          console.log(`  [Assets] Character sprite loaded: ${spritePath}`);
          resolve();
        };
        this.character.sprite.onerror = (err) =>
          reject(
            new Error(
              `Failed to load character sprite: ${spritePath}. Details: ${err.message || err}`
            )
          );
      })
    );

    if (bookSpriteImage) {
      this.bookImage = new Image();
      this.bookImage.src = bookSpriteImage;
      promises.push(
        new Promise((resolve) => {
          // Не используем reject, чтобы игра могла продолжиться без книги
          this.bookImage.onload = () => {
            console.log(`  [Assets] Book image loaded: ${bookSpriteImage}`);
            resolve();
          };
          this.bookImage.onerror = () => {
            console.warn(
              ` [Assets] Failed to load book image: ${bookSpriteImage}. Using fallback.`
            );
            this.bookImage = null;
            resolve();
          };
        })
      );
    } else {
      console.warn('[Assets] No book sprite path provided. Book will use fallback rendering.');
      this.bookImage = null;
    }

    await Promise.all(promises);
    console.log('[Game] All visual assets loaded successfully.');
  }

  async _startGameLogic() {
    // Этот метод остается почти таким же
    console.log('[Game] Starting core game logic...');
    if (
      !this.level ||
      !this.character ||
      !this.canvas ||
      !this.renderer ||
      !this.gameplayManager ||
      !this.audioManager
    ) {
      throw new Error('Cannot start game - essential components are missing.');
    }

    this.setGameState(GameState.LOADING_LEVEL);

    try {
      await this.level.loadFloor(this.level.minFloor, this.canvas.width, this.canvas.height);
      const currentMap = this.level.currentMap;
      if (!currentMap) throw new Error('Failed to load initial map. Map object is null.');

      const startPos = currentMap.findRandomInitialSpawnPosition();
      if (!startPos) throw new Error('Failed to find a valid starting position on the map!');
      this.character.x = startPos.x;
      this.character.y = startPos.y;
      this.character.currentDirection = Character.Direction.DOWN;
      this.character.isMoving = false;

      this.gameplayManager.ensureCharacterIsOnWalkableTile(false);

      // Сброс состояния игры
      this.totalBooksCollectedGlobally = 0;
      this.availableQuestions = [...questions];
      this.liftCooldownActive = false;
      clearTimeout(this.liftCooldownTimer);
      this.liftCooldownTimer = null;
      this.currentBookTarget = null;
      this.currentQuestionData = null;

      this.renderer.centerCameraOnCharacter();

      UIManager.updateScore(this.totalBooksCollectedGlobally, this.targetBooksToWin);
      UIManager.showGameUI(); // Показывает игровой UI (канвас, очки, контролы и т.д.)

      // Добавляем обработчики клавиатуры
      this._boundKeyDownHandler = this.handleKeyDown.bind(this);
      this._boundKeyUpHandler = this.handleKeyUp.bind(this);
      window.addEventListener('keydown', this._boundKeyDownHandler);
      window.addEventListener('keyup', this._boundKeyUpHandler);

      // ЗАПУСК МУЗЫКИ - происходит здесь, ПОСЛЕ взаимодействия пользователя (клик "Play" в Menu.js)
      this.audioManager.startInitialMusic(this.level.currentFloor);
      console.log(
        `[Game] Initial music started (or attempted) for floor ${this.level.currentFloor}`
      );

      // Устанавливаем состояние игры в PLAYING и запускаем таймер
      this.setGameState(GameState.PLAYING);
      UIManager.startTimer(); // UIManager управляет таймером

      // Запускаем игровой цикл
      if (!this.isRunning) {
        this.isRunning = true;
        requestAnimationFrame(this.gameLoop);
        console.log('[Game] Game logic started. Game loop is running.');
      }
    } catch (error) {
      console.error('[Game] Error during _startGameLogic:', error);
      this._handleFatalError(`Level start process error: ${error.message}`); // Показываем ошибку и Game Over
      throw error; // Перебрасываем ошибку, чтобы _loadAssetsAndThenStartLogic её увидел
    }
  }

  // Методы _setGameOver, stopGame, _handleFatalError, handleKeyDown, handleKeyUp, gameLoop, startLiftCooldownTimer
  // остаются такими же, как в предыдущей полной версии Game.js.
  _setGameOver(win = true) {
    if (this.gameState === GameState.GAME_OVER) return;
    console.log(`[Game] Setting game over. Win: ${win}`);
    this.setGameState(GameState.GAME_OVER);
    this.isRunning = false;
    if (this.character) this.character.isMoving = false;
    clearTimeout(this.liftCooldownTimer);
    if (this.audioManager) this.audioManager.stopMusic();
    if (this._boundKeyDownHandler) window.removeEventListener('keydown', this._boundKeyDownHandler);
    if (this._boundKeyUpHandler) window.removeEventListener('keyup', this._boundKeyUpHandler);
    this._boundKeyDownHandler = null;
    this._boundKeyUpHandler = null;
    UIManager.stopTimer(win);
    UIManager.showGameOverScreen(win, Game.CREATOR_NAMES, Game.CLASS_ATTENDING_INFO);
  }

  stopGame() {
    console.log('[Game] Explicit stopGame requested.');
    // Если игра уже закончена, не делаем ничего, чтобы не перезаписать состояние
    if (this.gameState !== GameState.GAME_OVER) {
      this._setGameOver(false); // Предполагаем, что явный стоп - это не победа
    } else {
      console.log('[Game] stopGame called, but game is already over.');
    }
  }

  _handleFatalError(message, showAlert = true) {
    console.error('[Game] FATAL ERROR:', message);
    // Показываем сообщение только если игра не в состоянии GAME_OVER, чтобы избежать дублирования
    if (showAlert && this.gameState !== GameState.GAME_OVER) {
      UIManager.flashMessage(`FATAL ERROR: ${message}`, 'error', 15000);
    }
    // Важно всегда переводить игру в состояние GAME_OVER при фатальной ошибке
    if (this.gameState !== GameState.GAME_OVER) {
      this._setGameOver(false); // Показываем экран Game Over
    }
  }

  handleKeyDown(e) {
    if (this.gameState !== GameState.PLAYING || !this.inputManager) return;
    let keyHandled = false;
    const key = e.key.toLowerCase();
    if (['arrowup', 'w'].includes(key)) {
      this.inputManager.setKey('up', true);
      keyHandled = true;
    } else if (['arrowdown', 's'].includes(key)) {
      this.inputManager.setKey('down', true);
      keyHandled = true;
    } else if (['arrowleft', 'a'].includes(key)) {
      this.inputManager.setKey('left', true);
      keyHandled = true;
    } else if (['arrowright', 'd'].includes(key)) {
      this.inputManager.setKey('right', true);
      keyHandled = true;
    }
    if (keyHandled) e.preventDefault();
  }

  handleKeyUp(e) {
    if (!this.inputManager) return;
    const key = e.key.toLowerCase();
    if (['arrowup', 'w'].includes(key)) this.inputManager.setKey('up', false);
    else if (['arrowdown', 's'].includes(key)) this.inputManager.setKey('down', false);
    else if (['arrowleft', 'a'].includes(key)) this.inputManager.setKey('left', false);
    else if (['arrowright', 'd'].includes(key)) this.inputManager.setKey('right', false);
  }

  gameLoop(timestamp) {
    if (!this.isRunning || this.gameState === GameState.GAME_OVER) return;
    this.gameplayManager?.update(timestamp);
    this.renderer?.centerCameraOnCharacter();
    this.renderer?.drawFrame();
    requestAnimationFrame(this.gameLoop);
  }

  startLiftCooldownTimer() {
    clearTimeout(this.liftCooldownTimer);
    console.log(`[Game] Starting lift cooldown timer: ${LIFT_COOLDOWN_MS}ms.`);
    this.liftCooldownTimer = setTimeout(() => {
      this.liftCooldownActive = false;
      this.liftCooldownTimer = null;
      if (this.gameState === GameState.TRANSITIONING) {
        this.setGameState(GameState.PLAYING);
        UIManager.flashMessage(`Arrived at floor ${this.level?.currentFloor}`, 'success', 1500);
      } else {
        console.warn(
          `[GameTimer] Lift cooldown ended, but game state is ${this.gameState}. No state change applied.`
        );
      }
    }, LIFT_COOLDOWN_MS);
  }
}
