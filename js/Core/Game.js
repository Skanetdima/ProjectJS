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
    console.log(`[Game] Initializing with character: ${characterColor}`);
    if (!characterColor) {
      const errorMsg = '[Game] CRITICAL: Game initialized without a characterColor!';
      console.error(errorMsg);
      alert('Game cannot start: no character was selected.');
      throw new Error(errorMsg);
    }
    this.characterColor = characterColor;
    this._gameState = GameState.IDLE;
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
    this.gameplayManager = null;
    this.audioManager = null;
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
      this._initializeCoreComponents();

      this.audioManager = new AudioManager();
      console.log('[Game] AudioManager created.');

      this.gameplayManager = new GameplayManager(this);
      console.log('[Game] GameplayManager created.');

      this.renderer = new GameRenderer(this);
      const { canvas, ctx } = this.renderer.initializeCanvas();
      this.canvas = canvas;
      this.ctx = ctx;
      console.log('[Game] Renderer and Canvas initialized.');

      UIManager.setGameplayManager(this.gameplayManager);
      UIManager.initializeUI(this.inputManager); // Timer is initialized here, but not started
      console.log('[Game] UIManager for in-game UI initialized.');

      this._addEventListeners();

      console.log('[Game] Core components initialized. Waiting for triggerGameStart() from Menu.');
    } catch (error) {
      console.error('[Game] Synchronous core initialization failed:', error);
      alert(`Critical initialization error: ${error.message}. Game cannot start.`);
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
    this.level = new Level(1, 3); // minFloor, maxFloor
  }

  _addEventListeners() {
    window.addEventListener('resize', () => this.renderer?.resizeCanvas());
  }

  async triggerGameStart() {
    if (this.gameState !== GameState.IDLE) {
      console.warn(`[Game] triggerGameStart called but game state is ${this.gameState}. Aborting.`);
      return;
    }
    console.log(
      `[Game] triggerGameStart received for character: ${this.characterColor}. Starting asset loading...`
    );

    const loadingOverlay = UIManager.getLoadingOverlay();
    if (loadingOverlay) loadingOverlay.classList.add('visible');

    try {
      await this._loadAssetsAndThenStartLogic();
      console.log('[Game] Game start sequence completed successfully.');
    } catch (error) {
      console.error(
        '[Game] Error during _loadAssetsAndThenStartLogic (from triggerGameStart):',
        error
      );
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      if (this.gameState !== GameState.GAME_OVER) {
        // Avoid double error handling if already handled
        this._handleFatalError(`Game start process failed: ${error.message}`);
      }
    }
  }

  async _loadAssetsAndThenStartLogic() {
    const loadingOverlay = UIManager.getLoadingOverlay();
    try {
      this.setGameState(GameState.LOADING);
      if (loadingOverlay && !loadingOverlay.classList.contains('visible')) {
        loadingOverlay.classList.add('visible');
      }

      await this._loadAssets();
      await this._startGameLogic();

      if (loadingOverlay) loadingOverlay.classList.remove('visible');
    } catch (error) {
      console.error('[Game] _loadAssetsAndThenStartLogic failed:', error);
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      this._handleFatalError(`Asset loading or game logic start error: ${error.message}`);
      throw error;
    }
  }

  async _loadAssets() {
    console.log('[Game] Loading assets...');
    const promises = [];
    const spritePathKey = this.characterColor || 'red';
    const spritePath = this.sprites[spritePathKey];

    if (!spritePath) {
      throw new Error(`Sprite path for character color "${spritePathKey}" is undefined.`);
    }
    console.log(`[Game] Using sprite: ${spritePath} for character ${spritePathKey}`);

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
      console.warn('[Assets] No book sprite. Fallback rendering will be used.');
      this.bookImage = null;
    }
    await Promise.all(promises);
    console.log('[Game] All visual assets loaded successfully.');
  }

  async _startGameLogic() {
    console.log('[Game] Starting core game logic...');
    if (
      !this.level ||
      !this.character ||
      !this.canvas ||
      !this.renderer ||
      !this.gameplayManager ||
      !this.audioManager
    ) {
      throw new Error('Cannot start game - essential components missing.');
    }
    this.setGameState(GameState.LOADING_LEVEL);

    try {
      await this.level.loadFloor(this.level.minFloor, this.canvas.width, this.canvas.height);
      const currentMap = this.level.currentMap;
      if (!currentMap) throw new Error('Failed to load initial map.');

      const startPos = currentMap.findRandomInitialSpawnPosition(this.character);
      if (!startPos) throw new Error('Failed to find a valid starting position on the map!');
      this.character.x = startPos.x;
      this.character.y = startPos.y;
      this.character.currentDirection = Character.Direction.DOWN;
      this.character.isMoving = false;

      this.gameplayManager.ensureCharacterIsOnWalkableTile(false);

      this.totalBooksCollectedGlobally = 0;
      this.availableQuestions = [...questions];
      this.liftCooldownActive = false;
      clearTimeout(this.liftCooldownTimer);
      this.liftCooldownTimer = null;
      this.currentBookTarget = null;
      this.currentQuestionData = null;

      this.renderer.centerCameraOnCharacter();
      UIManager.updateScore(this.totalBooksCollectedGlobally, this.targetBooksToWin);
      UIManager.showGameUI();

      this._boundKeyDownHandler = this.handleKeyDown.bind(this);
      this._boundKeyUpHandler = this.handleKeyUp.bind(this);
      window.addEventListener('keydown', this._boundKeyDownHandler);
      window.addEventListener('keyup', this._boundKeyUpHandler);

      this.audioManager.startInitialMusic(this.level.currentFloor);
      console.log(`[Game] Initial music started for floor ${this.level.currentFloor}`);

      this.setGameState(GameState.PLAYING); // Set state BEFORE starting timer
      UIManager.startTimer(); // UIManager controls the timer logic

      if (!this.isRunning) {
        this.isRunning = true;
        requestAnimationFrame(this.gameLoop);
        console.log('[Game] Game logic started. Game loop is running.');
      }
    } catch (error) {
      console.error('[Game] Error during _startGameLogic:', error);
      this._handleFatalError(`Level start process error: ${error.message}`);
      throw error;
    }
  }

  _setGameOver(win = true) {
    if (this.gameState === GameState.GAME_OVER) return;
    console.log(`[Game] Game Over. Win: ${win}`); // Log before changing state
    this.setGameState(GameState.GAME_OVER);
    this.isRunning = false;
    if (this.character) this.character.isMoving = false;
    clearTimeout(this.liftCooldownTimer);
    if (this.audioManager) this.audioManager.stopMusic();

    if (this._boundKeyDownHandler) window.removeEventListener('keydown', this._boundKeyDownHandler);
    if (this._boundKeyUpHandler) window.removeEventListener('keyup', this._boundKeyUpHandler);
    this._boundKeyDownHandler = null;
    this._boundKeyUpHandler = null;

    UIManager.stopTimer(win); // Stop timer ONCE
    UIManager.showGameOverScreen(win, Game.CREATOR_NAMES, Game.CLASS_ATTENDING_INFO);
  }

  stopGame() {
    console.log('[Game] Explicit stopGame requested.');
    if (this.gameState !== GameState.GAME_OVER) {
      this._setGameOver(false);
    } else {
      console.log('[Game] stopGame called, but game is already over.');
    }
  }

  _handleFatalError(message, showAlert = true) {
    console.error('[Game] FATAL ERROR:', message);
    if (showAlert && this.gameState !== GameState.GAME_OVER) {
      UIManager.flashMessage(`FATAL ERROR: ${message}`, 'error', 15000);
    }
    if (this.gameState !== GameState.GAME_OVER) {
      this._setGameOver(false);
    }
  }

  handleKeyDown(e) {
    if (this.gameState !== GameState.PLAYING || !this.inputManager) return;
    let handled = false;
    const key = e.key.toLowerCase();
    if (['arrowup', 'w'].includes(key)) {
      this.inputManager.setKey('up', true);
      handled = true;
    } else if (['arrowdown', 's'].includes(key)) {
      this.inputManager.setKey('down', true);
      handled = true;
    } else if (['arrowleft', 'a'].includes(key)) {
      this.inputManager.setKey('left', true);
      handled = true;
    } else if (['arrowright', 'd'].includes(key)) {
      this.inputManager.setKey('right', true);
      handled = true;
    }
    if (handled) e.preventDefault();
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
    console.log(`[Game] Starting lift cooldown: ${LIFT_COOLDOWN_MS}ms.`);
    this.liftCooldownTimer = setTimeout(() => {
      this.liftCooldownActive = false;
      this.liftCooldownTimer = null;
      if (this.gameState === GameState.TRANSITIONING) {
        this.setGameState(GameState.PLAYING); // Back to playing after transition
        UIManager.flashMessage(`Arrived at floor ${this.level?.currentFloor}`, 'success', 1500);
        // Timer should continue running if it was already running in TRANSITIONING state
      } else {
        console.warn(
          `[GameTimer] Lift cooldown ended, but state is ${this.gameState}. No state change.`
        );
      }
    }, LIFT_COOLDOWN_MS);
  }
}
