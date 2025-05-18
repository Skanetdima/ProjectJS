// src/UI/UIManager.js
import { GameState } from '../utils/constants.js'; // Раскомментируйте, если нужно для логики внутри UIManager

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
  static loadingOverlayElement = null; // Для кэширования элемента

  // Элементы для экрана Game Over
  static gameOverScreenElement = null;
  static gameOverTitleElement = null;
  static creatorNamesListElement = null;
  static classInfoElement = null;
  static returnToMenuButtonElement = null;

  static gameplayManagerInstance = null; // Ссылка на GameplayManager
  static flashMessageTimeouts = {};

  // New static fields
  static timerElement = null;
  static leaderboardElement = null;
  static gameStartTime = 0;
  static leaderboardData = [];

  /**
   * Вызывается из Game.js для регистрации экземпляра GameplayManager.
   */
  static setGameplayManager(manager) {
    if (!manager) {
      console.error('[UIManager] Attempted to set GameplayManager instance to null or undefined!');
      return;
    }
    this.gameplayManagerInstance = manager;
    console.log('[UIManager] GameplayManager instance registered successfully with UIManager.');
  }

  /**
   * Инициализирует базовые элементы UI.
   * Game.js должен вызвать setGameplayManager ПЕРЕД этим методом.
   */
  static initializeUI(inputManager) {
    console.log('[UIManager] Initializing base UI elements (controls, panels)...');
    if (!inputManager) {
      console.error('[UIManager] InputManager is required for initializeUI to create controls.');
    }
    this.createControls(inputManager);
    this.createQuestionUI();
    this.createFloorSelectionUI();
    this.ensureFlashMessageContainer();
    this.createGameOverScreen(); // Инициализация экрана Game Over
    this.initializeTimer(); // Initialize timer
    this.updateLeaderboard(); // Add this line

    if (!this.gameplayManagerInstance) {
      console.warn(
        '[UIManager] WARNING: GameplayManager instance is NOT SET at the end of initializeUI. ' +
          'Ensure Game.js calls UIManager.setGameplayManager() *before* UIManager.initializeUI().'
      );
    }
    console.log('[UIManager] Base UI element initialization complete.');
  }

  static createControls(inputManager) {
    this.controlsContainer = document.getElementById('controls-container');
    if (!this.controlsContainer) {
      this.controlsContainer = document.createElement('div');
      this.controlsContainer.id = 'controls-container';
      this.controlsContainer.classList.add('controls-container');
      document.body.appendChild(this.controlsContainer);
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
        const startPress = (e) => {
          inputManager.setKey(direction, true);
          btn.classList.add('active');
          e.preventDefault();
        };
        const endPress = (e) => {
          if (inputManager.keys[direction]) {
            inputManager.setKey(direction, false);
          }
          btn.classList.remove('active');
          e.preventDefault();
        };
        btn.addEventListener('touchstart', startPress, { passive: false });
        btn.addEventListener('touchend', endPress, { passive: false });
        btn.addEventListener('touchcancel', endPress, { passive: false });
        btn.addEventListener('mousedown', startPress);
        btn.addEventListener('mouseup', endPress);
        btn.addEventListener('mouseleave', endPress);
      }
      this.controlsContainer.appendChild(btn);
    });

    const scoreDisplayContainer = document.getElementById('score-display');
    if (!scoreDisplayContainer) {
      const scoreDiv = document.createElement('div');
      scoreDiv.id = 'score-display';
      scoreDiv.classList.add('score-display');
      scoreDiv.innerHTML = `Books: <span id="score-value">0</span> / <span id="score-target">?</span>`;
      document.body.appendChild(scoreDiv);
      this.scoreElement = scoreDiv.querySelector('#score-value');
      this.targetElement = scoreDiv.querySelector('#score-target');
    } else {
      this.scoreElement = scoreDisplayContainer.querySelector('#score-value');
      this.targetElement = scoreDisplayContainer.querySelector('#score-target');
      if (this.scoreElement) this.scoreElement.textContent = '0';
      if (this.targetElement) this.targetElement.textContent = '?';
    }
  }

  static createQuestionUI() {
    this.questionOverlay = document.getElementById('question-overlay');
    if (!this.questionOverlay) {
      this.questionOverlay = document.createElement('div');
      this.questionOverlay.id = 'question-overlay';
      this.questionOverlay.classList.add('ui-panel');
      this.questionOverlay.innerHTML = `
        <div id="blackboard-content">
          <h2>Question</h2>
          <div id="question-box">
            <p id="question-text"></p>
            <div id="answer-buttons"></div>
          </div>
        </div>`;
      document.body.appendChild(this.questionOverlay);
    }
    this.questionTextElement = this.questionOverlay.querySelector('#question-text');
    this.answerButtonsContainer = this.questionOverlay.querySelector('#answer-buttons');
    if (!this.questionTextElement || !this.answerButtonsContainer) {
      console.error('[UIManager] Failed to find/create child elements of question UI!');
    }
  }

  static createFloorSelectionUI() {
    this.floorSelectionPanel = document.getElementById('floor-selection-ui');
    if (!this.floorSelectionPanel) {
      this.floorSelectionPanel = document.createElement('div');
      this.floorSelectionPanel.id = 'floor-selection-ui';
      this.floorSelectionPanel.classList.add('ui-panel');
      this.floorSelectionPanel.innerHTML = `
        <h2>Select Floor</h2>
        <div id="floor-buttons-container"></div>`;
      document.body.appendChild(this.floorSelectionPanel);
    }
    this.floorButtonsContainer = this.floorSelectionPanel.querySelector('#floor-buttons-container');
    if (!this.floorButtonsContainer) {
      console.error('[UIManager] Failed to find/create floor buttons container!');
    }
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
      console.error('[UIManager] Flash message container not found or creatable.');
      return;
    }
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.className = 'flash-message';
    messageElement.classList.add(`flash-${type}`);
    const messageId = `flash-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    messageElement.id = messageId;
    container.appendChild(messageElement);
    requestAnimationFrame(() => {
      messageElement.classList.add('visible');
    });
    clearTimeout(this.flashMessageTimeouts[messageId]);
    const removeElement = () => {
      messageElement.classList.remove('visible');
      const handleTransitionEnd = (event) => {
        if (event.propertyName === 'opacity' || event.propertyName === 'transform') {
          if (messageElement.parentNode) messageElement.parentNode.removeChild(messageElement);
          delete this.flashMessageTimeouts[messageId];
        }
      };
      messageElement.addEventListener('transitionend', handleTransitionEnd, { once: true });
      setTimeout(() => {
        if (messageElement.parentNode) {
          messageElement.removeEventListener('transitionend', handleTransitionEnd);
          messageElement.parentNode.removeChild(messageElement);
        }
        delete this.flashMessageTimeouts[messageId];
      }, 500);
    };
    this.flashMessageTimeouts[messageId] = setTimeout(removeElement, duration);
  }

  static getLoadingOverlay() {
    if (!this.loadingOverlayElement) {
      this.loadingOverlayElement = document.getElementById('loading-overlay');
      if (!this.loadingOverlayElement) {
        this.loadingOverlayElement = document.createElement('div');
        this.loadingOverlayElement.id = 'loading-overlay';
        this.loadingOverlayElement.className = 'loading-overlay';
        const loadingText = document.createElement('p');
        loadingText.textContent = 'Loading...';
        this.loadingOverlayElement.appendChild(loadingText);
        document.body.appendChild(this.loadingOverlayElement);
        console.log('[UIManager] Loading overlay created and appended to body.');
      }
    }
    return this.loadingOverlayElement;
  }

  static createGameOverScreen() {
    this.gameOverScreenElement = document.getElementById('game-over-screen');
    if (!this.gameOverScreenElement) {
      console.error('[UIManager] CRITICAL: #game-over-screen element not found in HTML!');
      return;
    }
    this.gameOverTitleElement = this.gameOverScreenElement.querySelector('#game-over-title');
    this.creatorNamesListElement = this.gameOverScreenElement.querySelector('#creator-names');
    this.classInfoElement = this.gameOverScreenElement.querySelector('#class-info');
    this.returnToMenuButtonElement =
      this.gameOverScreenElement.querySelector('#return-to-menu-button');

    if (
      !this.gameOverTitleElement ||
      !this.creatorNamesListElement ||
      !this.classInfoElement ||
      !this.returnToMenuButtonElement
    ) {
      console.error(
        '[UIManager] Failed to find one or more child elements of the game over screen!'
      );
      return;
    }

    this.returnToMenuButtonElement.addEventListener('click', () => {
      window.location.reload();
    });
    console.log('[UIManager] Game Over screen elements initialized.');
  }

  static showGameOverScreen(isWin, creators = [], classInfoText = '') {
    if (!this.gameOverScreenElement) {
      console.error('[UIManager] Game Over Screen not initialized');
      this.createGameOverScreen();
      if (!this.gameOverScreenElement) return;
    }

    if (isWin) {
      this.gameOverTitleElement.textContent = 'Congratulations! You Escaped!';
      this.gameOverTitleElement.className = 'win-title';
    } else {
      this.gameOverTitleElement.textContent = 'Game Over';
      this.gameOverTitleElement.className = 'lose-title';
    }

    this.creatorNamesListElement.innerHTML = '';
    creators.forEach((name) => {
      const li = document.createElement('li');
      li.textContent = name;
      this.creatorNamesListElement.appendChild(li);
    });

    this.classInfoElement.textContent = classInfoText;

    // Update and show leaderboard
    this.updateLeaderboard();
    
    this.gameOverScreenElement.classList.add('visible');
    this.hideGameUI();
    this.hideQuestion();
    this.hideFloorSelectionUI();
  }

  static hideGameOverScreen() {
    if (this.gameOverScreenElement) {
      this.gameOverScreenElement.classList.remove('visible');
    }
  }

  static showQuestion(questionData) {
    if (!this.questionOverlay || !this.questionTextElement || !this.answerButtonsContainer) {
      console.error('[UIManager] Question UI not ready.');
      this.createQuestionUI();
      if (!this.questionOverlay || !this.questionTextElement || !this.answerButtonsContainer)
        return;
    }
    if (!questionData) {
      console.error('[UIManager] Cannot show question - no questionData provided.');
      return;
    }
    if (
      !this.gameplayManagerInstance ||
      typeof this.gameplayManagerInstance.handleAnswer !== 'function'
    ) {
      console.error(
        '[UIManager] CRITICAL: GameplayManager or its handleAnswer method is not set or invalid!'
      );
      this.flashMessage('Error: Game interaction system failed (Q).', 'error', 5000);
      this.hideQuestion();
      return;
    }

    this.questionTextElement.textContent = questionData.question;
    this.answerButtonsContainer.innerHTML = '';

    questionData.options.forEach((optionText, index) => {
      const button = document.createElement('button');
      button.textContent = optionText;
      button.dataset.index = index;
      button.classList.add('answer-button');
      button.addEventListener('click', (e) => {
        const selectedIndex = parseInt(e.target.dataset.index, 10);
        this.gameplayManagerInstance.handleAnswer(selectedIndex);
      });
      this.answerButtonsContainer.appendChild(button);
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
      console.error('[UIManager] Floor selection UI not ready.');
      this.createFloorSelectionUI();
      if (!this.floorSelectionPanel || !this.floorButtonsContainer) return;
    }
    if (
      !this.gameplayManagerInstance ||
      typeof this.gameplayManagerInstance.handleFloorSelection !== 'function'
    ) {
      console.error(
        '[UIManager] CRITICAL: GameplayManager or its handleFloorSelection method is not set or invalid!'
      );
      this.flashMessage('Error: Game interaction system failed (F).', 'error', 5000);
      this.hideFloorSelectionUI();
      return;
    }

    this.floorButtonsContainer.innerHTML = '';
    for (let floor = minFloor; floor <= maxFloor; floor++) {
      const button = document.createElement('button');
      button.textContent = `Floor ${floor}`;
      button.classList.add('floor-button');
      button.dataset.floor = floor;
      if (floor === currentFloor) {
        button.disabled = true;
        button.classList.add('current');
      } else {
        button.addEventListener('click', () => {
          this.gameplayManagerInstance.handleFloorSelection(floor);
        });
      }
      this.floorButtonsContainer.appendChild(button);
    }
    this.floorSelectionPanel.classList.add('visible');
  }

  static hideFloorSelectionUI() {
    if (this.floorSelectionPanel) {
      this.floorSelectionPanel.classList.remove('visible');
    }
  }

  static updateScore(score, target) {
    if (!this.scoreElement) this.scoreElement = document.getElementById('score-value');
    if (!this.targetElement) this.targetElement = document.getElementById('score-target');
    if (this.scoreElement) this.scoreElement.textContent = score;
    if (this.targetElement) this.targetElement.textContent = target;
  }

  static showGameUI() {
    const canvas = document.getElementById('game-canvas') || document.getElementById('gameCanvas');
    const menuContainer = document.getElementById('menu-container');
    const scoreDisplay = document.getElementById('score-display');

    if (canvas) canvas.style.display = 'block';
    else console.warn('[UIManager] Canvas element not found to show.');

    if (
      menuContainer &&
      !menuContainer.classList.contains('hidden') &&
      menuContainer.style.display !== 'none'
    ) {
      console.warn('[UIManager] Menu container was not hidden. Hiding it now via style.display.');
      menuContainer.style.display = 'none'; // Более надежный способ скрыть
    }

    if (this.controlsContainer) this.controlsContainer.classList.add('visible');
    else console.warn('[UIManager] Controls container not found to show.');

    if (scoreDisplay) scoreDisplay.classList.add('visible');
    else console.warn('[UIManager] Score display not found to show.');

    if (this.timerElement) {
      this.timerElement.style.display = 'block';
    }

    this.hideQuestion();
    this.hideFloorSelectionUI();
    this.hideGameOverScreen(); // Убедимся, что экран Game Over скрыт
  }

  static hideGameUI() {
    const canvas = document.getElementById('game-canvas') || document.getElementById('gameCanvas');
    const scoreDisplay = document.getElementById('score-display');

    if (canvas) canvas.style.display = 'none';
    if (this.controlsContainer) this.controlsContainer.classList.remove('visible');
    if (scoreDisplay) scoreDisplay.classList.remove('visible');

    if (this.timerElement) {
      this.timerElement.style.display = 'none';
    }

    // Не скрываем оверлеи вопросов/этажей/Game Over отсюда,
    // т.к. они могут быть показаны *после* скрытия основного игрового UI.
    // Их скрытие должно управляться конкретными состояниями игры.
  }

  // New methods
  static initializeTimer() {
    if (!this.timerElement) {
      this.timerElement = document.createElement('div');
      this.timerElement.id = 'game-timer';
      this.timerElement.classList.add('game-timer');
      document.body.appendChild(this.timerElement);
    }
    
    // Load leaderboard data from localStorage
    const savedData = localStorage.getItem('gameLeaderboard');
    this.leaderboardData = savedData ? JSON.parse(savedData) : [];
    
    // Create leaderboard element if needed
    this.updateLeaderboard();
  }

  static startTimer() {
    this.gameStartTime = Date.now();
    this.updateTimer();
  }

  static updateTimer() {
    if (!this.timerElement || !this.gameStartTime) return;
    
    const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    this.timerElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    if (this.gameStartTime) {
      requestAnimationFrame(() => this.updateTimer());
    }
  }

  static stopTimer(wasWin) {
    if (!this.gameStartTime) return;
    
    const endTime = Date.now();
    const totalTime = (endTime - this.gameStartTime) / 1000;
    
    if (wasWin) {
      const runNumber = this.leaderboardData.length + 1;
      this.leaderboardData.push({
        name: `Run ${runNumber}`,
        time: totalTime,
        date: new Date().toLocaleDateString()
      });
      
      // Sort by time ascending
      this.leaderboardData.sort((a, b) => a.time - b.time);
      
      // Save to localStorage
      localStorage.setItem('gameLeaderboard', JSON.stringify(this.leaderboardData));
    }
    
    this.gameStartTime = 0;
    this.updateLeaderboard();
  }

  static updateLeaderboard() {
    const leaderboardBody = document.getElementById('leaderboard-body');
    if (!leaderboardBody) return;

    // Clear existing entries
    leaderboardBody.innerHTML = '';
    
    // Add top 10 times
    this.leaderboardData.slice(0, 10).forEach(run => {
      const minutes = Math.floor(run.time / 60);
      const seconds = Math.floor(run.time % 60);
      
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${run.name}</td>
        <td>${minutes}:${seconds.toString().padStart(2, '0')}</td>
        <td>${run.date}</td>
      `;
      leaderboardBody.appendChild(row);
    });
  }
}
