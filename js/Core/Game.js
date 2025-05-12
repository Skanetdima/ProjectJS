// src/core/Game.js
import { InputManager } from './InputManager.js';
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';
import { Level } from './Level.js';
import {
  GameState,
  questions,
  TARGET_BOOKS_TO_WIN,
  LIFT_COOLDOWN_MS,
  TILE_WALL,
} from '../utils/constants.js';
import { GameRenderer } from './GameRenderer.js';
import { GameplayManager } from './GameplayManager.js';

// Импорты ресурсов
import redSprite from '../../images/character_red.png';
import blueSprite from '../../images/character_blue.png';
import yellowSprite from '../../images/character_yellow.png';
import greenSprite from '../../images/character_green.png';
import bookSprite from '../../images/book.png';

export class Game {
  constructor(characterColor) {
    console.log(`[Game] Initializing with character: ${characterColor}`);
    this.characterColor = characterColor;
    this._gameState = GameState.LOADING; // Начальное состояние
    this.isRunning = false;

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
    this.gameplayManager = null; // Будет инициализирован в конструкторе

    this.sprites = { red: redSprite, blue: blueSprite, yellow: yellowSprite, green: greenSprite };
    this.bookImage = null;

    this.gameLoop = this.gameLoop.bind(this);
    this._handleFatalError = this._handleFatalError.bind(this);
    this._boundKeyDownHandler = null; // Для удаления слушателей
    this._boundKeyUpHandler = null;

    // --- Последовательность инициализации ---
    try {
      // 1. Основные компоненты (синхронно)
      this._initializeCoreComponents(); // InputManager, Level

      // 2. GameplayManager (синхронно, до UI)
      this.gameplayManager = new GameplayManager(this);
      console.log('[Game] GameplayManager created.');

      // 3. Рендерер и Canvas (синхронно)
      this.renderer = new GameRenderer(this);
      const { canvas, ctx } = this.renderer.initializeCanvas();
      this.canvas = canvas;
      this.ctx = ctx;
      console.log('[Game] Renderer and Canvas initialized.');

      // 4. Инициализация UI (синхронно, GameplayManager уже доступен)
      this._initializeUIManager();
      console.log('[Game] UIManager setup initiated.');

      // 5. Глобальные слушатели (синхронно)
      this._addEventListeners();

      // 6. Асинхронная загрузка ресурсов и запуск основной логики игры
      //    Обработка ошибок этой асинхронной операции происходит внутри неё
      //    или через .catch(), если _loadAssetsAndStart возвращает Promise.
      this._loadAssetsAndThenStartLogic()
        .then(() => {
          console.log('[Game] Async loading and game logic start sequence completed.');
        })
        .catch((error) => {
          // Эта ошибка должна быть уже обработана в _loadAssetsAndThenStartLogic
          // или _handleFatalError, но для безопасности логируем еще раз.
          console.error(
            '[Game] Unhandled error from _loadAssetsAndThenStartLogic in constructor:',
            error
          );
          // Убедимся, что игра не в состоянии зависания загрузки
          const loadingOverlay = document.querySelector('.loading-overlay');
          if (loadingOverlay) loadingOverlay.classList.remove('visible');
        });
    } catch (error) {
      // Ловим ошибки синхронной части конструктора
      console.error('[Game] Synchronous core initialization failed:', error);
      // Показываем alert, т.к. UIManager.flashMessage может быть еще не готов
      alert(`Critical initialization error: ${error.message}. Game cannot start.`);
      this._handleFatalError(`Initialization error: ${error.message}`, false); // false, т.к. alert уже был
    }
  }

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
    this.level = new Level(1, 3); // Пример: этажи от 1 до 3
  }

  _initializeUIManager() {
    if (!this.gameplayManager) {
      throw new Error('[Game] GameplayManager is NOT defined when _initializeUIManager is called!');
    }
    if (!this.inputManager) {
      throw new Error('[Game] InputManager is NOT defined when _initializeUIManager is called!');
    }
    // Сначала передаем GameplayManager в UIManager
    UIManager.setGameplayManager(this.gameplayManager);
    // Затем инициализируем остальные элементы UI, которые могут зависеть от InputManager
    UIManager.initializeUI(this.inputManager); // Этот метод создаст контролы, UI вопросов и т.д.
  }

  _addEventListeners() {
    window.addEventListener('resize', () => this.renderer?.resizeCanvas());
  }

  async _loadAssetsAndThenStartLogic() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    try {
      this.setGameState(GameState.LOADING); // Убедимся, что состояние LOADING перед загрузкой
      // Оверлей загрузки уже должен быть показан из Menu.js

      await this._loadAssets(); // Загрузка спрайтов, книги и т.д.

      // После загрузки ресурсов запускаем основную логику игры
      await this._startGameLogic();

      // Скрываем оверлей загрузки после успешного старта всей логики
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
    } catch (error) {
      console.error('[Game] Asset loading or game logic start failed:', error);
      if (loadingOverlay) loadingOverlay.classList.remove('visible'); // Убрать оверлей при ошибке
      this._handleFatalError(`Asset/Start Logic Error: ${error.message}`);
      // Важно перебросить ошибку, если этот метод вызывается так, что ожидается Promise
      throw error;
    }
  }

  async _loadAssets() {
    console.log('[Game] Loading assets...');
    const promises = [];
    const spritePath = this.sprites[this.characterColor] || this.sprites.red; // Выбор спрайта

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
          reject(new Error(`Failed to load character sprite: ${spritePath}. Details: ${err}`));
      })
    );

    if (bookSprite) {
      this.bookImage = new Image();
      this.bookImage.src = bookSprite;
      promises.push(
        new Promise((resolve) => {
          // Ошибку загрузки книги не считаем фатальной
          this.bookImage.onload = () => {
            console.log(`  [Assets] Book image loaded: ${bookSprite}`);
            resolve();
          };
          this.bookImage.onerror = () => {
            console.warn(
              ` [Assets] Failed to load book image: ${bookSprite}. Using fallback rendering.`
            );
            this.bookImage = null; // Сбрасываем, чтобы использовать fallback
            resolve(); // Все равно resolve, т.к. это некритично
          };
        })
      );
    } else {
      console.warn('[Assets] No book sprite path provided. Book will use fallback rendering.');
      this.bookImage = null;
    }

    await Promise.all(promises);
    console.log('[Game] All assets loaded successfully.');
  }

  async _startGameLogic() {
    console.log('[Game] Starting core game logic...');
    if (!this.level || !this.character || !this.canvas || !this.renderer || !this.gameplayManager) {
      throw new Error('Cannot start game - essential components are missing.');
    }

    // Состояние LOADING_LEVEL или PREPARING_LEVEL
    this.setGameState(GameState.LOADING_LEVEL);
    // UIManager.hideGameUI(); // Уже должно быть скрыто из Menu.js или при ошибке
    // UIManager.hideQuestion();
    // UIManager.hideFloorSelectionUI();

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

      // Убедимся, что персонаж не заспавнился в стене
      this.gameplayManager.ensureCharacterIsOnWalkableTile(false);

      this.totalBooksCollectedGlobally = 0;
      this.availableQuestions = [...questions]; // Свежая копия вопросов
      this.liftCooldownActive = false;
      clearTimeout(this.liftCooldownTimer);
      this.liftCooldownTimer = null;
      this.currentBookTarget = null;
      this.currentQuestionData = null;

      this.renderer.centerCameraOnCharacter();

      UIManager.updateScore(this.totalBooksCollectedGlobally, this.targetBooksToWin);
      UIManager.showGameUI(); // Показываем canvas, счет, контролы

      // Добавляем слушатели клавиатуры
      this._boundKeyDownHandler = this.handleKeyDown.bind(this);
      this._boundKeyUpHandler = this.handleKeyUp.bind(this);
      window.addEventListener('keydown', this._boundKeyDownHandler);
      window.addEventListener('keyup', this._boundKeyUpHandler);

      this.setGameState(GameState.PLAYING);
      if (!this.isRunning) {
        this.isRunning = true;
        requestAnimationFrame(this.gameLoop);
        console.log('[Game] Game logic started. Loop is running.');
      }
    } catch (error) {
      console.error('[Game] Error during _startGameLogic:', error);
      this._handleFatalError(`Level start process error: ${error.message}`);
      // this.isRunning = false; // _handleFatalError это сделает
      throw error; // Перебросить ошибку для обработки в _loadAssetsAndThenStartLogic
    }
  }

  _setGameOver(win = true) {
    if (this.gameState === GameState.GAME_OVER) return;

    this.setGameState(GameState.GAME_OVER);
    this.isRunning = false;
    if (this.character) this.character.isMoving = false;
    clearTimeout(this.liftCooldownTimer);

    if (this._boundKeyDownHandler) window.removeEventListener('keydown', this._boundKeyDownHandler);
    if (this._boundKeyUpHandler) window.removeEventListener('keyup', this._boundKeyUpHandler);
    this._boundKeyDownHandler = null;
    this._boundKeyUpHandler = null;

    UIManager.hideGameUI();
    UIManager.hideQuestion();
    UIManager.hideFloorSelectionUI();

    if (win) {
      requestAnimationFrame(() => this.renderer?.drawWinScreen());
    } else {
      // При проигрыше/ошибке, Menu.js должен быть снова виден.
      // Это можно сделать, удалив класс 'hidden' или установив display
      const menuContainer = document.getElementById('menu-container');
      if (menuContainer) {
        menuContainer.classList.remove('hidden'); // Предполагаем, что Menu.js добавил 'hidden'
        // menuContainer.style.display = 'flex'; // Или так, если класс не используется
      }
    }
    console.log(`[Game] Game Over. Win: ${win}`);
  }

  stopGame() {
    console.log('[Game] Explicit stopGame requested.');
    this._setGameOver(false); // Завершаем игру как проигрыш/остановку

    // window.removeEventListener('resize', () => this.renderer?.resizeCanvas()); // Слушатель остается, если игра может перезапуститься

    // Очистка ресурсов не обязательна, если экземпляр Game будет удален
    // this.character = null; ...
    console.log('[Game] Game stopped.');
  }

  _handleFatalError(message, showAlert = true) {
    console.error('[Game] FATAL ERROR:', message);
    if (showAlert && this.gameState !== GameState.GAME_OVER) {
      // Используем UIManager.flashMessage если он доступен, иначе alert
      if (UIManager.flashMessageContainer && UIManager.flashMessage) {
        UIManager.flashMessage(`FATAL ERROR: ${message}`, 'error', 15000);
      } else {
        alert(`FATAL ERROR: ${message}`);
      }
    }
    this._setGameOver(false); // Завершаем игру
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
