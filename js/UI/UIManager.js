// src/UI/UIManager.js
import { GameState } from '../utils/constants.js';

export class UIManager {
  static scoreElement = null;
  static targetElement = null;
  static controlsContainer = null;
  static questionOverlay = null;
  static questionTextElement = null;
  static answerButtonsContainer = null;
  static floorSelectionPanel = null;
  static floorButtonsContainer = null;
  static flashMessageContainer = null;
  static loadingOverlayElement = null;

  static gameOverScreenElement = null;
  static gameOverTitleElement = null;
  static creatorNamesListElement = null;
  static classInfoElement = null;
  static returnToMenuButtonElement = null;
  static leaderboardBody = null;

  static gameplayManagerInstance = null;
  static flashMessageTimeouts = {};

  static timerElement = null;
  static gameStartTime = 0; // Timestamp of when the game (timer) actually started
  static timerIntervalId = null; // To store requestAnimationFrame ID
  static leaderboardData = [];

  static setGameplayManager(manager) {
    if (!manager) {
      console.error('[UIManager] Attempted to set GameplayManager to null/undefined!');
      return;
    }
    this.gameplayManagerInstance = manager;
    console.log('[UIManager] GameplayManager instance registered.');
  }

  static initializeUI(inputManager) {
    console.log('[UIManager] Initializing in-game UI elements...');
    if (!inputManager)
      console.warn('[UIManager] InputManager not provided. On-screen controls may not function.');

    this.createControls(inputManager);
    this.createQuestionUI();
    this.createFloorSelectionUI();
    this.ensureFlashMessageContainer();
    this.getLoadingOverlay(); // Ensures it exists but doesn't show it
    this.createGameOverScreen(); // Initializes Game Over screen elements
    this.initializeTimer(); // Initializes timer element and loads leaderboard

    if (!this.gameplayManagerInstance) {
      console.warn(
        '[UIManager] WARNING: GameplayManager not set by end of initializeUI. Interactive UI may fail.'
      );
    }
    console.log('[UIManager] In-game UI initialization complete.');
  }

  static createControls(inputManager) {
    this.controlsContainer = document.getElementById('controls-container');
    if (!this.controlsContainer) {
      this.controlsContainer = document.createElement('div');
      this.controlsContainer.id = 'controls-container';
      this.controlsContainer.classList.add('controls-container');
      document.body.appendChild(this.controlsContainer); // Consider appending to a game-specific UI layer
    }
    this.controlsContainer.innerHTML = '';

    const arrows = [
      { direction: 'up', icon: '↑', gridArea: 'up' },
      { direction: 'left', icon: '←', gridArea: 'left' },
      { direction: 'right', icon: '→', gridArea: 'right' },
      { direction: 'down', icon: '↓', gridArea: 'down' },
    ];
    arrows.forEach(({ direction, icon, gridArea }) => {
      const btn = document.createElement('button');
      btn.className = `control-btn ${direction}`;
      btn.textContent = icon;
      btn.style.gridArea = gridArea;
      btn.dataset.direction = direction;
      if (inputManager) {
        const start = (e) => {
          inputManager.setKey(direction, true);
          btn.classList.add('active');
          e.preventDefault();
        };
        const end = (e) => {
          if (inputManager.keys[direction]) inputManager.setKey(direction, false);
          btn.classList.remove('active');
          e.preventDefault();
        };
        btn.addEventListener('touchstart', start, { passive: false });
        btn.addEventListener('touchend', end, { passive: false });
        btn.addEventListener('touchcancel', end, { passive: false });
        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
      }
      this.controlsContainer.appendChild(btn);
    });

    const scoreDisp = document.getElementById('score-display');
    if (!scoreDisp) {
      const div = document.createElement('div');
      div.id = 'score-display';
      div.classList.add('score-display');
      div.innerHTML = `Książki: <span id="score-value">0</span> / <span id="score-target">?</span>`;
      document.body.appendChild(div); // Consider game-specific UI layer
      this.scoreElement = div.querySelector('#score-value');
      this.targetElement = div.querySelector('#score-target');
    } else {
      this.scoreElement = scoreDisp.querySelector('#score-value');
      this.targetElement = scoreDisp.querySelector('#score-target');
    }
    if (this.scoreElement) this.scoreElement.textContent = '0';
    if (this.targetElement) this.targetElement.textContent = '?';
  }

  static createQuestionUI() {
    this.questionOverlay = document.getElementById('question-overlay');
    if (!this.questionOverlay) {
      this.questionOverlay = document.createElement('div');
      this.questionOverlay.id = 'question-overlay';
      this.questionOverlay.classList.add('ui-panel');
      this.questionOverlay.innerHTML = `<div id="blackboard-content"><h2>Question</h2><div id="question-box"><p id="question-text"></p><div id="answer-buttons"></div></div></div>`;
      document.body.appendChild(this.questionOverlay);
    }
    this.questionTextElement = this.questionOverlay.querySelector('#question-text');
    this.answerButtonsContainer = this.questionOverlay.querySelector('#answer-buttons');
    if (!this.questionTextElement || !this.answerButtonsContainer)
      console.error('[UIManager] Failed to find/create question UI children.');
  }

  static createFloorSelectionUI() {
    this.floorSelectionPanel = document.getElementById('floor-selection-ui');
    if (!this.floorSelectionPanel) {
      this.floorSelectionPanel = document.createElement('div');
      this.floorSelectionPanel.id = 'floor-selection-ui';
      this.floorSelectionPanel.classList.add('ui-panel');
      this.floorSelectionPanel.innerHTML = `<h2>Select Floor</h2><div id="floor-buttons-container"></div>`;
      document.body.appendChild(this.floorSelectionPanel);
    }
    this.floorButtonsContainer = this.floorSelectionPanel.querySelector('#floor-buttons-container');
    if (!this.floorButtonsContainer)
      console.error('[UIManager] Failed to find/create floor buttons container.');
  }

  static ensureFlashMessageContainer() {
    this.flashMessageContainer = document.getElementById('flash-message-container');
    if (!this.flashMessageContainer) {
      this.flashMessageContainer = document.createElement('div');
      this.flashMessageContainer.id = 'flash-message-container';
      document.body.appendChild(this.flashMessageContainer);
    }
    return this.flashMessageContainer;
  }

  static flashMessage(message, type = 'info', duration = 3000) {
    const container = this.ensureFlashMessageContainer();
    if (!container) {
      console.error('[UIManager] Flash msg container not found.');
      return;
    }
    const msgEl = document.createElement('div');
    msgEl.textContent = message;
    msgEl.className = 'flash-message';
    msgEl.classList.add(`flash-${type}`);
    const msgId = `flash-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    msgEl.id = msgId;
    container.appendChild(msgEl);
    requestAnimationFrame(() => msgEl.classList.add('visible'));
    clearTimeout(this.flashMessageTimeouts[msgId]);
    const remove = () => {
      msgEl.classList.remove('visible');
      const endHandler = (e) => {
        if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
          if (msgEl.parentNode) msgEl.parentNode.removeChild(msgEl);
          delete this.flashMessageTimeouts[msgId];
        }
      };
      msgEl.addEventListener('transitionend', endHandler, { once: true });
      setTimeout(() => {
        // Fallback removal
        if (msgEl.parentNode) {
          msgEl.removeEventListener('transitionend', endHandler);
          msgEl.parentNode.removeChild(msgEl);
        }
        delete this.flashMessageTimeouts[msgId];
      }, 500);
    };
    this.flashMessageTimeouts[msgId] = setTimeout(remove, duration);
  }

  static getLoadingOverlay() {
    if (!this.loadingOverlayElement) {
      this.loadingOverlayElement = document.getElementById('loading-overlay');
      if (!this.loadingOverlayElement) {
        this.loadingOverlayElement = document.createElement('div');
        this.loadingOverlayElement.id = 'loading-overlay';
        this.loadingOverlayElement.className = 'loading-overlay';
        const text = document.createElement('p');
        text.textContent = 'Loading...';
        this.loadingOverlayElement.appendChild(text);
        document.body.appendChild(this.loadingOverlayElement);
        console.log('[UIManager] Loading overlay created.');
      }
    }
    return this.loadingOverlayElement;
  }

  static createGameOverScreen() {
    this.gameOverScreenElement = document.getElementById('game-over-screen');
    if (!this.gameOverScreenElement) {
      console.error('[UIManager] CRIT: #game-over-screen not in HTML!');
      return;
    }
    this.gameOverTitleElement = this.gameOverScreenElement.querySelector('#game-over-title');
    this.creatorNamesListElement = this.gameOverScreenElement.querySelector('#creator-names');
    this.classInfoElement = this.gameOverScreenElement.querySelector('#class-info');
    this.returnToMenuButtonElement =
      this.gameOverScreenElement.querySelector('#return-to-menu-button');
    this.leaderboardBody = this.gameOverScreenElement.querySelector('#leaderboard-body');

    if (
      !this.gameOverTitleElement ||
      !this.creatorNamesListElement ||
      !this.classInfoElement ||
      !this.returnToMenuButtonElement ||
      !this.leaderboardBody
    ) {
      console.error('[UIManager] Failed to find Game Over screen children or leaderboard body.');
      return;
    }
    this.returnToMenuButtonElement.addEventListener('click', () => window.location.reload());
    // updateLeaderboard will be called by stopTimer or showGameOverScreen
    console.log('[UIManager] Game Over screen elements initialized.');
  }

  static showGameOverScreen(isWin, creators = [], classInfoText = '') {
    if (!this.gameOverScreenElement) {
      console.error('[UIManager] Game Over Screen not init, creating.');
      this.createGameOverScreen();
      if (!this.gameOverScreenElement) {
        console.error('[UIManager] Still unable to show Game Over screen.');
        return;
      }
    }
    if (this.gameOverTitleElement) {
      this.gameOverTitleElement.textContent = isWin ? 'Brawo uciekłeś!' : 'Koniec gry';
      this.gameOverTitleElement.className = isWin ? 'win-title' : 'lose-title';
    }
    if (this.creatorNamesListElement) {
      this.creatorNamesListElement.innerHTML = '';
      creators.forEach((name) => {
        const li = document.createElement('li');
        li.textContent = name;
        this.creatorNamesListElement.appendChild(li);
      });
    }
    if (this.classInfoElement) this.classInfoElement.textContent = classInfoText;
    this.updateLeaderboard(); // Load and display leaderboard data
    this.gameOverScreenElement.classList.add('visible');
    this.hideGameUI();
    this.hideQuestion();
    this.hideFloorSelectionUI();
  }

  static hideGameOverScreen() {
    if (this.gameOverScreenElement) this.gameOverScreenElement.classList.remove('visible');
  }

  static showQuestion(questionData) {
    if (!this.questionOverlay || !this.questionTextElement || !this.answerButtonsContainer) {
      console.error('[UIManager] Question UI not ready, creating.');
      this.createQuestionUI();
      if (!this.questionOverlay || !this.questionTextElement || !this.answerButtonsContainer)
        return;
    }
    if (!questionData) {
      console.error('[UIManager] No questionData to show.');
      return;
    }
    if (!this.gameplayManagerInstance?.handleAnswer) {
      console.error('[UIManager] CRIT: GameplayManager/handleAnswer not set/invalid!');
      this.flashMessage('Error: Game interaction (Q) failed.', 'error', 5000);
      this.hideQuestion();
      return;
    }
    this.questionTextElement.textContent = questionData.question;
    this.answerButtonsContainer.innerHTML = '';
    questionData.options.forEach((optionText, index) => {
      const btn = document.createElement('button');
      btn.textContent = optionText;
      btn.dataset.index = index.toString();
      btn.classList.add('answer-button');
      btn.addEventListener('click', (e) =>
        this.gameplayManagerInstance.handleAnswer(parseInt(e.target.dataset.index, 10))
      );
      this.answerButtonsContainer.appendChild(btn);
    });
    this.questionOverlay.classList.add('visible');
  }

  static hideQuestion() {
    if (this.questionOverlay) {
      this.questionOverlay.classList.remove('visible');
      if (this.questionTextElement) this.questionTextElement.textContent = '';
      if (this.answerButtonsContainer) this.answerButtonsContainer.innerHTML = '';
    }
  }

  static showFloorSelectionUI(minFloor, maxFloor, currentFloor) {
    if (!this.floorSelectionPanel || !this.floorButtonsContainer) {
      console.error('[UIManager] Floor selection UI not ready, creating.');
      this.createFloorSelectionUI();
      if (!this.floorSelectionPanel || !this.floorButtonsContainer) return;
    }
    if (!this.gameplayManagerInstance?.handleFloorSelection) {
      console.error('[UIManager] CRIT: GameplayManager/handleFloorSelection not set/invalid!');
      this.flashMessage('Error: Game interaction (F) failed.', 'error', 5000);
      this.hideFloorSelectionUI();
      return;
    }
    this.floorButtonsContainer.innerHTML = '';
    for (let floor = minFloor; floor <= maxFloor; floor++) {
      const btn = document.createElement('button');
      btn.textContent = `Floor ${floor}`;
      btn.classList.add('floor-button');
      btn.dataset.floor = floor.toString();
      if (floor === currentFloor) {
        btn.disabled = true;
        btn.classList.add('current');
      } else
        btn.addEventListener('click', () =>
          this.gameplayManagerInstance.handleFloorSelection(floor)
        );
      this.floorButtonsContainer.appendChild(btn);
    }
    this.floorSelectionPanel.classList.add('visible');
  }

  static hideFloorSelectionUI() {
    if (this.floorSelectionPanel) this.floorSelectionPanel.classList.remove('visible');
  }

  static updateScore(score, target) {
    if (!this.scoreElement) this.scoreElement = document.getElementById('score-value');
    if (!this.targetElement) this.targetElement = document.getElementById('score-target');
    if (this.scoreElement) this.scoreElement.textContent = score.toString();
    if (this.targetElement) this.targetElement.textContent = target.toString();
  }

  static showGameUI() {
    console.log('[UIManager] Showing Game UI...');
    const canvas = document.getElementById('game-canvas');
    const scoreDisplay = document.getElementById('score-display');
    if (canvas) canvas.style.display = 'block';
    else console.warn('[UIManager] #game-canvas not found.');
    if (this.controlsContainer) this.controlsContainer.classList.add('visible');
    else console.warn('[UIManager] Controls container not found.');
    if (scoreDisplay) {
      scoreDisplay.style.display = 'flex';
      scoreDisplay.classList.add('visible');
    } else console.warn('[UIManager] Score display not found.');
    if (this.timerElement) this.timerElement.style.display = 'block';

    this.hideQuestion();
    this.hideFloorSelectionUI();
    this.hideGameOverScreen();
  }

  static hideGameUI() {
    console.log('[UIManager] Hiding Game UI...');
    const canvas = document.getElementById('game-canvas');
    const scoreDisplay = document.getElementById('score-display');
    if (canvas) canvas.style.display = 'none';
    if (this.controlsContainer) this.controlsContainer.classList.remove('visible');
    if (scoreDisplay) {
      scoreDisplay.style.display = 'none';
      scoreDisplay.classList.remove('visible');
    }
    if (this.timerElement) this.timerElement.style.display = 'none';
  }

  static initializeTimer() {
    if (!this.timerElement) {
      this.timerElement = document.getElementById('game-timer');
      if (!this.timerElement) {
        this.timerElement = document.createElement('div');
        this.timerElement.id = 'game-timer';
        this.timerElement.classList.add('game-timer');
        const gameUiContainer = document.getElementById('game-container') || document.body;
        gameUiContainer.appendChild(this.timerElement);
        console.log('[UIManager] Timer element dynamically created.');
      }
    }
    this.timerElement.textContent = 'Czas: 0:00';
    this.timerElement.style.display = 'none'; // Hidden by default

    const savedData = localStorage.getItem('gameLeaderboard');
    try {
      this.leaderboardData = savedData ? JSON.parse(savedData) : [];
    } catch (e) {
      console.error('[UIManager] Error parsing leaderboard from localStorage:', e);
      this.leaderboardData = [];
      localStorage.removeItem('gameLeaderboard');
    }
    // updateLeaderboard() is usually called when GameOver screen is shown
    console.log('[UIManager] Timer and leaderboard data initialized.');
  }

  static startTimer() {
    if (this.timerIntervalId) {
      // Clear previous interval if any
      cancelAnimationFrame(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    const game = this.gameplayManagerInstance?.game;
    if (game && game.gameState === GameState.PLAYING) {
      this.gameStartTime = Date.now();
      console.log(
        `[UIManager] Game timer starting. Start time: ${this.gameStartTime}. State: ${game.gameState}`
      );
      this.updateTimer();
    } else {
      console.warn(
        `[UIManager] Timer start denied. Game: ${!!game}, State: ${
          game?.gameState
        }. Expected PLAYING.`
      );
    }
  }

  static updateTimer() {
    const game = this.gameplayManagerInstance?.game;
    if (
      !this.gameStartTime ||
      !game ||
      (game.gameState !== GameState.PLAYING &&
        game.gameState !== GameState.ASKING_QUESTION &&
        game.gameState !== GameState.SELECTING_FLOOR &&
        game.gameState !== GameState.TRANSITIONING)
    ) {
      if (this.timerIntervalId) {
        cancelAnimationFrame(this.timerIntervalId);
        this.timerIntervalId = null;
      }
      return;
    }
    const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    if (this.timerElement)
      this.timerElement.textContent = `Czas: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    this.timerIntervalId = requestAnimationFrame(() => this.updateTimer());
  }

  static stopTimer(wasWin) {
    if (!this.gameStartTime) return; // Timer wasn't running
    if (this.timerIntervalId) {
      cancelAnimationFrame(this.timerIntervalId);
      this.timerIntervalId = null;
    }
    const endTime = Date.now();
    const totalTime = (endTime - this.gameStartTime) / 1000;
    console.log(`[UIManager] Czas zatrzymany. Czas: ${totalTime.toFixed(3)}s. Wygrana: ${wasWin}`);
    if (wasWin) {
      this.leaderboardData.push({
        name: `Podejście ${this.leaderboardData.length + 1}`,
        time: totalTime,
        date: new Date().toLocaleDateString(),
      });
      this.leaderboardData.sort((a, b) => a.time - b.time);
      try {
        localStorage.setItem('gameLeaderboard', JSON.stringify(this.leaderboardData.slice(0, 10)));
      } catch (e) {
        console.error('[UIManager] Failed to save leaderboard:', e);
      }
    }
    this.gameStartTime = 0; // Reset, effectively stopping updateTimer loop
    // updateLeaderboard() will be called by showGameOverScreen
  }

  static updateLeaderboard() {
    if (!this.leaderboardBody) {
      const goScreen = document.getElementById('game-over-screen');
      if (goScreen) this.leaderboardBody = goScreen.querySelector('#leaderboard-body');
      if (!this.leaderboardBody) {
        /* console.warn('[UIManager] Leaderboard body not found for update.'); */ return;
      }
    }
    this.leaderboardBody.innerHTML = '';
    const topScores = this.leaderboardData.slice(0, 10);
    if (topScores.length === 0) {
      const row = this.leaderboardBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 3;
      cell.textContent = 'No records yet.';
      cell.style.textAlign = 'center';
    } else {
      topScores.forEach((run) => {
        const mins = Math.floor(run.time / 60);
        const secs = Math.floor(run.time % 60);
        const mills = Math.floor((run.time * 1000) % 1000);
        const row = this.leaderboardBody.insertRow();
        row.insertCell().textContent = run.name;
        row.insertCell().textContent = `${mins}:${secs.toString().padStart(2, '0')}.${mills
          .toString()
          .padStart(3, '0')}`;
        row.insertCell().textContent = run.date;
      });
    }
  }
}
