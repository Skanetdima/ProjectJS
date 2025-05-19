// src/UI/UIManager.js
import { GameState } from '../utils/constants.js'; // Используется для логики таймера

export class UIManager {
  // Свойства для элементов игрового UI
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

  // Элементы для экрана Game Over
  static gameOverScreenElement = null;
  static gameOverTitleElement = null;
  static creatorNamesListElement = null;
  static classInfoElement = null;
  static returnToMenuButtonElement = null;
  static leaderboardBody = null; // tbody таблицы лидеров

  static gameplayManagerInstance = null;
  static flashMessageTimeouts = {};

  static timerElement = null;
  static gameStartTime = 0;
  static leaderboardData = []; // Данные таблицы лидеров

  // AudioManager здесь не нужен, т.к. UIManager не управляет громкостью напрямую.
  // Menu.js и AudioManager.js занимаются этим.

  static setGameplayManager(manager) {
    if (!manager) {
      console.error('[UIManager] Attempted to set GameplayManager instance to null or undefined!');
      return;
    }
    this.gameplayManagerInstance = manager;
    console.log('[UIManager] GameplayManager instance registered successfully.');
  }

  // Инициализирует ТОЛЬКО внутриигровые элементы UI
  static initializeUI(inputManager) {
    console.log('[UIManager] Initializing in-game UI elements...');

    // Проверка inputManager, так как он используется для контролов
    if (!inputManager) {
      console.warn(
        '[UIManager] InputManager not provided to initializeUI. On-screen controls might not function.'
      );
    }

    // Создание и настройка элементов, используемых во время игры
    this.createControls(inputManager); // Экранные кнопки управления
    this.createQuestionUI(); // Панель с вопросами
    this.createFloorSelectionUI(); // Панель выбора этажа
    this.ensureFlashMessageContainer(); // Контейнер для flash-сообщений
    this.getLoadingOverlay(); // Получаем/создаем оверлей загрузки (но не показываем)
    this.createGameOverScreen(); // Экран завершения игры (включая таблицу лидеров)
    this.initializeTimer(); // Элемент таймера игры

    // Проверка, что GameplayManager был установлен (важно для интерактивных UI панелей)
    if (!this.gameplayManagerInstance) {
      console.warn(
        '[UIManager] WARNING: GameplayManager instance is NOT SET at the end of initializeUI. ' +
          'Interactive UI elements (questions, floors) might not work correctly.'
      );
    }
    console.log('[UIManager] In-game UI element initialization complete.');
  }

  // Методы createControls, createQuestionUI, createFloorSelectionUI, ensureFlashMessageContainer,
  // getLoadingOverlay, createGameOverScreen, showGameOverScreen, hideGameOverScreen,
  // showQuestion, hideQuestion, showFloorSelectionUI, hideFloorSelectionUI, updateScore,
  // showGameUI, hideGameUI, initializeTimer, startTimer, updateTimer, stopTimer, updateLeaderboard
  // ОСТАЮТСЯ ТАКИМИ ЖЕ, КАК В ПОЛНОЙ ВЕРСИИ UIManager.js из твоего предыдущего запроса,
  // так как они уже были сфокусированы на внутриигровом UI.
  // Я не буду их здесь дублировать для краткости, но ты должен скопировать их из своего
  // кода UIManager.js, который я тебе ранее присылал (тот, где еще БЫЛА логика главного меню,
  // но сами эти методы уже были правильными для ингейм UI).
  // Важно: showGameUI() и hideGameUI() не должны пытаться управлять главным меню.

  // Пример одного из методов, чтобы показать, что они остаются:
  static createControls(inputManager) {
    this.controlsContainer = document.getElementById('controls-container');
    if (!this.controlsContainer) {
      this.controlsContainer = document.createElement('div');
      this.controlsContainer.id = 'controls-container';
      this.controlsContainer.classList.add('controls-container');
      // Важно: Append к правильному родительскому элементу, если это не body
      // Например, к специальному #game-ui-layer если он есть
      document.body.appendChild(this.controlsContainer);
    }
    this.controlsContainer.innerHTML = ''; // Очистка для переинициализации

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
        // Только если inputManager передан
        const startPress = (e) => {
          inputManager.setKey(direction, true);
          btn.classList.add('active');
          e.preventDefault();
        };
        const endPress = (e) => {
          // Проверяем, что ключ все еще удерживается этим инстансом InputManager
          // Это полезно, если может быть несколько источников событий
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
        btn.addEventListener('mouseleave', endPress); // Если мышь ушла с кнопки, отпускаем
      }
      this.controlsContainer.appendChild(btn);
    });

    // Инициализация отображения очков
    const scoreDisplayContainer = document.getElementById('score-display');
    if (!scoreDisplayContainer) {
      const scoreDiv = document.createElement('div');
      scoreDiv.id = 'score-display';
      scoreDiv.classList.add('score-display');
      scoreDiv.innerHTML = `Books: <span id="score-value">0</span> / <span id="score-target">?</span>`;
      document.body.appendChild(scoreDiv); // Аналогично, лучше в специальный контейнер
      this.scoreElement = scoreDiv.querySelector('#score-value');
      this.targetElement = scoreDiv.querySelector('#score-target');
    } else {
      this.scoreElement = scoreDisplayContainer.querySelector('#score-value');
      this.targetElement = scoreDisplayContainer.querySelector('#score-target');
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
      }, 500); // Запасной таймаут
    };
    this.flashMessageTimeouts[messageId] = setTimeout(removeElement, duration);
  }

  static getLoadingOverlay() {
    if (!this.loadingOverlayElement) {
      this.loadingOverlayElement = document.getElementById('loading-overlay');
      if (!this.loadingOverlayElement) {
        this.loadingOverlayElement = document.createElement('div');
        this.loadingOverlayElement.id = 'loading-overlay';
        this.loadingOverlayElement.className = 'loading-overlay'; // CSS должен скрывать по умолчанию
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
    this.leaderboardBody = this.gameOverScreenElement.querySelector('#leaderboard-body');

    if (
      !this.gameOverTitleElement ||
      !this.creatorNamesListElement ||
      !this.classInfoElement ||
      !this.returnToMenuButtonElement ||
      !this.leaderboardBody
    ) {
      console.error(
        '[UIManager] Failed to find one or more child elements of the game over screen (or leaderboard body)!'
      );
      return; // Прерываем, если важные элементы отсутствуют
    }

    this.returnToMenuButtonElement.addEventListener('click', () => {
      // Перезагрузка страницы для возврата в главное меню (управляется Menu.js)
      window.location.reload();
    });
    this.updateLeaderboard(); // Инициализируем/очищаем таблицу лидеров при создании экрана
    console.log('[UIManager] Game Over screen elements initialized.');
  }

  static showGameOverScreen(isWin, creators = [], classInfoText = '') {
    if (!this.gameOverScreenElement) {
      console.error('[UIManager] Game Over Screen not initialized, attempting to create.');
      this.createGameOverScreen(); // Попытка создать, если его нет
      if (!this.gameOverScreenElement) {
        console.error('[UIManager] Still unable to show Game Over screen.');
        return; // Если не удалось создать, выходим
      }
    }

    if (this.gameOverTitleElement) {
      this.gameOverTitleElement.textContent = isWin ? 'Congratulations! You Escaped!' : 'Game Over';
      this.gameOverTitleElement.className = isWin ? 'win-title' : 'lose-title'; // Для стилизации
    }

    if (this.creatorNamesListElement) {
      this.creatorNamesListElement.innerHTML = ''; // Очищаем предыдущие
      creators.forEach((name) => {
        const li = document.createElement('li');
        li.textContent = name;
        this.creatorNamesListElement.appendChild(li);
      });
    }

    if (this.classInfoElement) {
      this.classInfoElement.textContent = classInfoText;
    }

    this.updateLeaderboard(); // Обновляем данные таблицы лидеров

    this.gameOverScreenElement.classList.add('visible'); // Показываем экран
    this.hideGameUI(); // Скрываем основной игровой UI (канвас, контролы, очки, таймер)
    this.hideQuestion(); // Скрываем панель вопросов
    this.hideFloorSelectionUI(); // Скрываем панель выбора этажей
    // Главное меню уже должно быть скрыто Menu.js
  }

  static hideGameOverScreen() {
    if (this.gameOverScreenElement) {
      this.gameOverScreenElement.classList.remove('visible');
    }
  }

  static showQuestion(questionData) {
    // ... (Этот метод остается как в предыдущем полном UIManager.js)
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
      button.dataset.index = index.toString();
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
    // ... (Этот метод остается как в предыдущем полном UIManager.js)
    if (this.questionOverlay) {
      this.questionOverlay.classList.remove('visible');
      if (this.questionTextElement) this.questionTextElement.textContent = '';
      if (this.answerButtonsContainer) this.answerButtonsContainer.innerHTML = '';
    }
  }

  static showFloorSelectionUI(minFloor, maxFloor, currentFloor) {
    // ... (Этот метод остается как в предыдущем полном UIManager.js)
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
      button.dataset.floor = floor.toString();
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
    // ... (Этот метод остается как в предыдущем полном UIManager.js)
    if (this.floorSelectionPanel) {
      this.floorSelectionPanel.classList.remove('visible');
    }
  }

  static updateScore(score, target) {
    // ... (Этот метод остается как в предыдущем полном UIManager.js)
    if (!this.scoreElement) this.scoreElement = document.getElementById('score-value');
    if (!this.targetElement) this.targetElement = document.getElementById('score-target');
    if (this.scoreElement) this.scoreElement.textContent = score.toString();
    if (this.targetElement) this.targetElement.textContent = target.toString();
  }

  static showGameUI() {
    // Показывает элементы, необходимые во время игры
    console.log('[UIManager] Showing Game UI...');
    // Главное меню должно быть уже скрыто Menu.js

    const canvas = document.getElementById('game-canvas');
    const scoreDisplay = document.getElementById('score-display');

    if (canvas) canvas.style.display = 'block'; // Убедимся, что канвас видим
    else console.warn('[UIManager] Canvas element (#game-canvas) not found to show.');

    if (this.controlsContainer) this.controlsContainer.classList.add('visible');
    else console.warn('[UIManager] Controls container not found to show.');

    if (scoreDisplay) {
      scoreDisplay.style.display = 'flex'; // или 'block'
      scoreDisplay.classList.add('visible');
    } else {
      console.warn('[UIManager] Score display not found to show.');
    }

    if (this.timerElement) {
      this.timerElement.style.display = 'block'; // или 'flex'
    }

    // Убедимся, что панели вопросов, этажей и Game Over скрыты при показе основного игрового UI
    this.hideQuestion();
    this.hideFloorSelectionUI();
    this.hideGameOverScreen();
  }

  static hideGameUI() {
    // Скрывает элементы активной игры (например, при показе Game Over или возврате в меню)
    console.log('[UIManager] Hiding Game UI...');
    const canvas = document.getElementById('game-canvas');
    const scoreDisplay = document.getElementById('score-display');

    if (canvas) canvas.style.display = 'none';
    if (this.controlsContainer) this.controlsContainer.classList.remove('visible');
    if (scoreDisplay) {
      scoreDisplay.style.display = 'none';
      scoreDisplay.classList.remove('visible');
    }
    if (this.timerElement) {
      this.timerElement.style.display = 'none';
    }
  }

  static initializeTimer() {
    // ... (Этот метод остается как в предыдущем полном UIManager.js)
    if (!this.timerElement) {
      this.timerElement = document.getElementById('game-timer');
      if (!this.timerElement) {
        this.timerElement = document.createElement('div');
        this.timerElement.id = 'game-timer';
        this.timerElement.classList.add('game-timer');
        const gameContainer = document.body; // Или более специфичный контейнер
        gameContainer.appendChild(this.timerElement);
      }
    }
    this.timerElement.textContent = 'Time: 0:00';
    this.timerElement.style.display = 'none'; // Скрыт по умолчанию, покажется с showGameUI

    const savedData = localStorage.getItem('gameLeaderboard');
    this.leaderboardData = savedData ? JSON.parse(savedData) : [];
    this.updateLeaderboard(); // Обновляем таблицу лидеров (если она уже есть в DOM)
  }

  static startTimer() {
    // ... (Этот метод остается как в предыдущем полном UIManager.js)
    // Проверка, что игра в состоянии PLAYING, чтобы таймер не запускался преждевременно
    if (this.gameplayManagerInstance?.game?.gameState === GameState.PLAYING) {
      this.gameStartTime = Date.now();
      this.updateTimer(); // Запускаем цикл обновления
      console.log('[UIManager] Game timer started.');
    } else {
      console.warn('[UIManager] Timer start requested, but game is not in PLAYING state.');
    }
  }

  static updateTimer() {
    // ... (Этот метод остается как в предыдущем полном UIManager.js)
    const game = this.gameplayManagerInstance?.game;
    if (
      !this.timerElement ||
      !this.gameStartTime ||
      !game ||
      (game.gameState !== GameState.PLAYING &&
        game.gameState !== GameState.QUESTION &&
        game.gameState !== GameState.TRANSITIONING)
    ) {
      return; // Останавливаем цикл, если игра неактивна
    }
    const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    this.timerElement.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    requestAnimationFrame(() => this.updateTimer());
  }

  static stopTimer(wasWin) {
    // ... (Этот метод остается как в предыдущем полном UIManager.js)
    if (!this.gameStartTime) return; // Таймер не был запущен
    const endTime = Date.now();
    const totalTime = (endTime - this.gameStartTime) / 1000; // Время в секундах
    console.log(
      `[UIManager] Game timer stopped. Total time: ${totalTime.toFixed(3)}s. Win: ${wasWin}`
    );
    if (wasWin) {
      const runName = `Run ${this.leaderboardData.length + 1}`;
      this.leaderboardData.push({
        name: runName,
        time: totalTime,
        date: new Date().toLocaleDateString(),
      });
      this.leaderboardData.sort((a, b) => a.time - b.time);
      try {
        localStorage.setItem('gameLeaderboard', JSON.stringify(this.leaderboardData.slice(0, 10)));
      } catch (e) {
        console.error('[UIManager] Failed to save leaderboard to localStorage:', e);
      }
    }
    this.gameStartTime = 0; // Сбрасываем время старта
    this.updateLeaderboard(); // Обновляем отображение таблицы лидеров
  }

  static updateLeaderboard() {
    // ... (Этот метод остается как в предыдущем полном UIManager.js)
    // this.leaderboardBody получается в createGameOverScreen
    if (!this.leaderboardBody) {
      // console.warn('[UIManager] Leaderboard table body not found for update.');
      return;
    }
    this.leaderboardBody.innerHTML = '';
    const topScores = this.leaderboardData.slice(0, 10);
    if (topScores.length === 0) {
      const row = this.leaderboardBody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 3;
      cell.textContent = 'No records yet. Be the first!';
      cell.style.textAlign = 'center';
    } else {
      topScores.forEach((run) => {
        const minutes = Math.floor(run.time / 60);
        const seconds = Math.floor(run.time % 60);
        const milliseconds = Math.floor((run.time * 1000) % 1000);
        const row = this.leaderboardBody.insertRow();
        row.insertCell().textContent = run.name;
        row.insertCell().textContent = `${minutes}:${seconds
          .toString()
          .padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
        row.insertCell().textContent = run.date;
      });
    }
  }
}
