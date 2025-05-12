// src/UI/UIManager.js
// import { GameState } from '../utils/constants.js'; // Если нужно для логики внутри UIManager

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

  static gameplayManagerInstance = null; // Ссылка на GameplayManager
  static flashMessageTimeouts = {};

  /**
   * Вызывается из Game.js для регистрации экземпляра GameplayManager.
   * Это должно произойти ДО вызова UIManager.initializeUI() или любых методов,
   * которые используют gameplayManagerInstance (showQuestion, showFloorSelectionUI).
   * @param {GameplayManager} manager - Экземпляр GameplayManager.
   */
  static setGameplayManager(manager) {
    if (!manager) {
      console.error('[UIManager] Attempted to set GameplayManager instance to null or undefined!');
      // throw new Error("GameplayManager instance cannot be null/undefined for UIManager."); // Можно сделать ошибку фатальной
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
      // throw new Error("InputManager is required for UIManager.initializeUI");
    }
    this.createControls(inputManager); // Зависит от inputManager
    this.createQuestionUI(); // Не зависит напрямую от gameplayManager для создания, но для показа - да
    this.createFloorSelectionUI(); // Аналогично
    this.ensureFlashMessageContainer();

    // Проверка, был ли gameplayManagerInstance установлен ранее через setGameplayManager
    if (!this.gameplayManagerInstance) {
      console.warn(
        '[UIManager] WARNING: GameplayManager instance is NOT SET at the end of initializeUI. ' +
          'Ensure Game.js calls UIManager.setGameplayManager() *before* UIManager.initializeUI() or related show methods.'
      );
    }
    console.log('[UIManager] Base UI element initialization complete.');
  }

  static createControls(inputManager) {
    this.controlsContainer = document.getElementById('controls-container');
    if (!this.controlsContainer) {
      this.controlsContainer = document.createElement('div');
      this.controlsContainer.id = 'controls-container';
      this.controlsContainer.classList.add('controls-container'); // Из вашего CSS
      document.body.appendChild(this.controlsContainer);
    }
    this.controlsContainer.innerHTML = ''; // Очистить предыдущие

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
      btn.dataset.direction = direction; // Для возможного использования

      if (inputManager) {
        // Только если inputManager передан
        const startPress = (e) => {
          inputManager.setKey(direction, true);
          btn.classList.add('active');
          e.preventDefault();
        };
        const endPress = (e) => {
          if (inputManager.keys[direction]) {
            // Только если была активна
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
      scoreDiv.classList.add('score-display'); // Из вашего CSS
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
      this.questionOverlay.classList.add('ui-panel'); // Базовый класс для скрытия/показа и стилей
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
      this.floorSelectionPanel.classList.add('ui-panel'); // Базовый класс
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
      // Стили для flash-message-container должны быть в CSS
      document.body.appendChild(this.flashMessageContainer);
    }
    return this.flashMessageContainer;
  }

  static flashMessage(message, type = 'info', duration = 3000) {
    // ... (ваш улучшенный код flashMessage остается без изменений) ...
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
      }, 500); // Slightly longer than CSS transition
    };
    this.flashMessageTimeouts[messageId] = setTimeout(removeElement, duration);
  }

  static showQuestion(questionData) {
    if (!this.questionOverlay || !this.questionTextElement || !this.answerButtonsContainer) {
      console.error(
        '[UIManager] Question UI not ready. Call createQuestionUI() or initializeUI().'
      );
      this.createQuestionUI(); // Попытка создать, если отсутствует
      if (!this.questionOverlay || !this.questionTextElement || !this.answerButtonsContainer)
        return; // Выход, если все еще нет
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
        '[UIManager] CRITICAL: GameplayManager or its handleAnswer method is not set or invalid! Cannot show question.'
      );
      this.flashMessage(
        'Error: Game interaction system failed (Q). Cannot display question.',
        'error',
        5000
      );
      this.hideQuestion(); // Скрыть UI, чтобы не было зависания
      return;
    }

    this.questionTextElement.textContent = questionData.question;
    this.answerButtonsContainer.innerHTML = '';

    questionData.options.forEach((optionText, index) => {
      const button = document.createElement('button');
      button.textContent = optionText;
      button.dataset.index = index;
      button.classList.add('answer-button'); // Класс из CSS
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
      // Очистка после скрытия (или немедленно)
      if (this.questionTextElement) this.questionTextElement.textContent = '';
      if (this.answerButtonsContainer) this.answerButtonsContainer.innerHTML = '';
    }
  }

  static showFloorSelectionUI(minFloor, maxFloor, currentFloor) {
    if (!this.floorSelectionPanel || !this.floorButtonsContainer) {
      console.error(
        '[UIManager] Floor selection UI not ready. Call createFloorSelectionUI() or initializeUI().'
      );
      this.createFloorSelectionUI(); // Попытка создать
      if (!this.floorSelectionPanel || !this.floorButtonsContainer) return;
    }
    if (
      !this.gameplayManagerInstance ||
      typeof this.gameplayManagerInstance.handleFloorSelection !== 'function'
    ) {
      console.error(
        '[UIManager] CRITICAL: GameplayManager or its handleFloorSelection method is not set or invalid! Cannot show floor selection.'
      );
      this.flashMessage(
        'Error: Game interaction system failed (F). Cannot display floor selection.',
        'error',
        5000
      );
      this.hideFloorSelectionUI();
      return;
    }

    this.floorButtonsContainer.innerHTML = '';
    for (let floor = minFloor; floor <= maxFloor; floor++) {
      const button = document.createElement('button');
      button.textContent = `Floor ${floor}`;
      button.classList.add('floor-button'); // Класс из CSS
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
    const canvas = document.getElementById('game-canvas') || document.getElementById('gameCanvas'); // Поддержка обоих ID
    const menuContainer = document.getElementById('menu-container');
    const scoreDisplay = document.getElementById('score-display');

    if (canvas) canvas.style.display = 'block'; // Или 'flex', 'grid'
    else console.warn('[UIManager] Canvas element not found to show.');

    // Меню должно быть уже скрыто из Menu.js
    if (menuContainer && !menuContainer.classList.contains('hidden')) {
      console.warn(
        '[UIManager] Menu container was not hidden before showing game UI. Hiding it now.'
      );
      menuContainer.classList.add('hidden');
    }

    if (this.controlsContainer) this.controlsContainer.classList.add('visible');
    else console.warn('[UIManager] Controls container not found to show.');

    if (scoreDisplay) scoreDisplay.classList.add('visible');
    else console.warn('[UIManager] Score display not found to show.');

    this.hideQuestion(); // Убедимся, что оверлеи скрыты
    this.hideFloorSelectionUI();
  }

  static hideGameUI() {
    const canvas = document.getElementById('game-canvas') || document.getElementById('gameCanvas');
    const scoreDisplay = document.getElementById('score-display');
    // const menuContainer = document.getElementById('menu-container'); // Не показываем меню отсюда автоматически

    if (canvas) canvas.style.display = 'none';
    if (this.controlsContainer) this.controlsContainer.classList.remove('visible');
    if (scoreDisplay) scoreDisplay.classList.remove('visible');

    this.hideQuestion();
    this.hideFloorSelectionUI();

    // Показ меню должен управляться логикой игры (например, в Game._setGameOver или из Menu.js)
  }
}
