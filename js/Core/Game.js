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
  // TILE_WALL, // Not used directly here, can be removed if there are no other uses
} from '../utils/constants.js';
import { GameRenderer } from './GameRenderer.js';
import { GameplayManager } from './GameplayManager.js';
import { AudioManager } from '../audio/AudioManager.js';

// Importy zasobów
import redSprite from '../../assets/images/character_red.png';
import blueSprite from '../../assets/images/character_blue.png';
import yellowSprite from '../../assets/images/character_yellow.png';
import greenSprite from '../../assets/images/character_green.png';
import bookSprite from '../../assets/images/book.png';

export class Game {
  // Static properties for Game Over screen information

  static CREATOR_NAMES = ['Rafał', 'Dima', 'Venia', 'Kacper'];
  static CLASS_ATTENDING_INFO = 'Klasa 2P2T / Projektowanie stron internetowych';

  constructor(characterColor) {
    console.log(`[Game] Initializing with character: ${characterColor}`);
    this.characterColor = characterColor;
    this._gameState = GameState.LOADING;
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

    this.sprites = { red: redSprite, blue: blueSprite, yellow: yellowSprite, green: greenSprite };
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

      this._initializeUIManager();
      console.log('[Game] UIManager setup initiated.');

      this._addEventListeners();

      this._loadAssetsAndThenStartLogic()
        .then(() => {
          console.log('[Game] Async loading and game logic start sequence completed.');
        })
        .catch((error) => {
          console.error(
            '[Game] Unhandled error from _loadAssetsAndThenStartLogic in constructor:',
            error
          );
          const loadingOverlay = UIManager.getLoadingOverlay(); // Używamy UIManagera
          if (loadingOverlay) loadingOverlay.classList.remove('visible');
        });
    } catch (error) {
      console.error('[Game] Synchronous core initialization failed:', error);
      alert(`Critical initialization error: ${error.message}. Game cannot start.`);
      this._handleFatalError(`Initialization error: ${error.message}`, false);
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
    this.level = new Level(1, 3); // Przykład: piętra od 1 do 3
  }

  _initializeUIManager() {
    if (!this.gameplayManager) {
      throw new Error('[Game] GameplayManager is NOT defined when _initializeUIManager is called!');
    }
    if (!this.inputManager) {
      throw new Error('[Game] InputManager is NOT defined when _initializeUIManager is called!');
    }
    UIManager.setGameplayManager(this.gameplayManager);
    UIManager.initializeUI(this.inputManager);
  }

  _addEventListeners() {
    window.addEventListener('resize', () => this.renderer?.resizeCanvas());
  }

  async _loadAssetsAndThenStartLogic() {
    const loadingOverlay = UIManager.getLoadingOverlay();
    try {
      this.setGameState(GameState.LOADING);

      await this._loadAssets();
      await this._startGameLogic();

      if (loadingOverlay) loadingOverlay.classList.remove('visible');
    } catch (error) {
      console.error('[Game] Asset loading or game logic start failed:', error);
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      this._handleFatalError(`Asset/Start Logic Error: ${error.message}`);
      throw error;
    }
  }

  async _loadAssets() {
    console.log('[Game] Loading assets...');
    const promises = [];
    const spritePath = this.sprites[this.characterColor] || this.sprites.red;

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
          this.bookImage.onload = () => {
            console.log(`  [Assets] Book image loaded: ${bookSprite}`);
            resolve();
          };
          this.bookImage.onerror = () => {
            console.warn(
              ` [Assets] Failed to load book image: ${bookSprite}. Using fallback rendering.`
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
    console.log('[Game] All assets loaded successfully.');
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

      this.setGameState(GameState.PLAYING);
      if (!this.isRunning) {
        this.isRunning = true;
        requestAnimationFrame(this.gameLoop);
        console.log('[Game] Game logic started. Loop is running.');
      }
    } catch (error) {
      console.error('[Game] Error during _startGameLogic:', error);
      this._handleFatalError(`Level start process error: ${error.message}`);
      throw error;
    }
  }

  _setGameOver(win = true) {
    if (this.gameState === GameState.GAME_OVER) return;

    this.setGameState(GameState.GAME_OVER);
    this.isRunning = false;
    if (this.character) this.character.isMoving = false;
    clearTimeout(this.liftCooldownTimer);

    if (this.audioManager) {
      this.audioManager.stopMusic();
    }

    if (this._boundKeyDownHandler) window.removeEventListener('keydown', this._boundKeyDownHandler);
    if (this._boundKeyUpHandler) window.removeEventListener('keyup', this._boundKeyUpHandler);
    this._boundKeyDownHandler = null;
    this._boundKeyUpHandler = null;

    // Wywoływane wewnątrz showGameOverScreen
    // Wywoływane wewnątrz showGameOverScreen
    // Wywoływane wewnątrz showGameOverScreen

    UIManager.showGameOverScreen(win, Game.CREATOR_NAMES, Game.CLASS_ATTENDING_INFO);

    console.log(`[Game] Game Over. Win: ${win}`);
  }

  stopGame() {
    console.log('[Game] Explicit stopGame requested.');
    this._setGameOver(false);
    console.log('[Game] Game stopped.');
  }

  _handleFatalError(message, showAlert = true) {
    console.error('[Game] FATAL ERROR:', message);
    if (showAlert && this.gameState !== GameState.GAME_OVER) {
      if (UIManager.flashMessageContainer && UIManager.flashMessage) {
        UIManager.flashMessage(`FATAL ERROR: ${message}`, 'error', 15000);
      } else {
        alert(`FATAL ERROR: ${message}`);
      }
    }
    // Upewnijmy się, że gra przechodzi w stan GAME_OVER i pokazuje odpowiedni ekran.
    if (this.gameState !== GameState.GAME_OVER) {
      this._setGameOver(false);
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
