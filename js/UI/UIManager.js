// src/UI/UIManager.js <-- UPEWNIJ SIĘ, ŻE ŚCIEŻKA I WIELKOŚĆ LITER SĄ POPRAWNE

// *** WAŻNE: IMPORTY STAŁYCH ITP. POWINNY BYĆ TUTAJ, JEŚLI SĄ POTRZEBNE ***
// import { GameState, ... } from '../utils/constants.js'; // Przykład

export class UIManager {
  // --- Static Properties for Element References ---
  static scoreElement = null;
  static targetElement = null;
  static controlsContainer = null;
  static questionOverlay = null;
  static questionTextElement = null;
  static answerButtonsContainer = null;
  static floorSelectionPanel = null;
  static floorButtonsContainer = null;
  static flashMessageContainer = null;
  static gameUIContainer = null;

  // --- Static Properties for State/Callbacks ---
  // static currentAnswerCallback = null; // REMOVED - Use gameplayManagerInstance
  // static floorSelectionCallback = null; // REMOVED - Use gameplayManagerInstance
  static gameplayManagerInstance = null; // NEW: Reference to GameplayManager
  static flashMessageTimeout = null;

  /**
   * ! WAŻNE: Wywołaj tę metodę z Game.js po utworzeniu GameplayManager !
   * Rejestruje instancję GameplayManager do obsługi callbacków UI.
   * @param {GameplayManager} manager - Instancja GameplayManager.
   */
  static setGameplayManager(manager) {
    if (!manager) {
      console.error('[UIManager] Próbowano ustawić instancję GameplayManager jako null!');
      return;
    }
    this.gameplayManagerInstance = manager;
    console.log('[UIManager] Instancja GameplayManager zarejestrowana pomyślnie.');
  }

  /** Tworzy lub znajduje kontrolki i wyświetlanie wyniku */
  static createControls(inputManager) {
    // --- Controls Container ---
    this.controlsContainer = document.getElementById('controls-container');
    if (!this.controlsContainer) {
      this.controlsContainer = document.createElement('div');
      this.controlsContainer.id = 'controls-container';
      this.controlsContainer.classList.add('controls-container');
      document.body.appendChild(this.controlsContainer);
    }
    this.controlsContainer.innerHTML = ''; // Wyczyść poprzednie

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
      const startPress = (e) => {
        if (inputManager?.keys.hasOwnProperty(direction)) {
          inputManager.setKey(direction, true);
          btn.classList.add('active');
        }
        e.preventDefault();
      };
      const endPress = (e) => {
        if (inputManager?.keys.hasOwnProperty(direction)) {
          if (inputManager.keys[direction]) inputManager.setKey(direction, false); // Zwolnij tylko, jeśli naciśnięty przez manager
          btn.classList.remove('active');
        }
        e.preventDefault();
      };
      btn.addEventListener('touchstart', startPress, { passive: false });
      btn.addEventListener('touchend', endPress, { passive: false });
      btn.addEventListener('touchcancel', endPress, { passive: false });
      btn.addEventListener('mousedown', startPress);
      btn.addEventListener('mouseup', endPress);
      btn.addEventListener('mouseleave', endPress);
      this.controlsContainer.appendChild(btn);
    });
    this.controlsContainer.style.display = 'none'; // Ukryj początkowo

    // --- Score Element ---
    // (Logika wyszukiwania/tworzenia elementów wyniku pozostała bez zmian)
    this.scoreElement = document.getElementById('score-value');
    this.targetElement = document.getElementById('score-target');
    const scoreDisplayContainer = document.getElementById('score-display');
    if (!scoreDisplayContainer) {
      const scoreDiv = document.createElement('div');
      scoreDiv.id = 'score-display';
      scoreDiv.classList.add('score-display');
      scoreDiv.innerHTML = `Książki: <span id="score-value">0</span> / <span id="score-target">?</span>`; // Zmieniono "Книги" na "Książki"
      document.body.appendChild(scoreDiv);
      this.scoreElement = document.getElementById('score-value');
      this.targetElement = document.getElementById('score-target');
    } else {
      if (this.scoreElement) this.scoreElement.textContent = '0';
      if (this.targetElement) this.targetElement.textContent = '?';
    }
    if (scoreDisplayContainer) scoreDisplayContainer.style.display = 'none';
  }

  /** Tworzy lub znajduje elementy nakładki pytania */
  static createQuestionUI() {
    this.questionOverlay = document.getElementById('question-overlay');
    if (!this.questionOverlay) {
      this.questionOverlay = document.createElement('div');
      this.questionOverlay.id = 'question-overlay';
      this.questionOverlay.classList.add('ui-panel');
      const questionBox = document.createElement('div');
      questionBox.id = 'question-box';
      this.questionTextElement = document.createElement('p');
      this.questionTextElement.id = 'question-text';
      this.answerButtonsContainer = document.createElement('div');
      this.answerButtonsContainer.id = 'answer-buttons';
      questionBox.appendChild(this.questionTextElement);
      questionBox.appendChild(this.answerButtonsContainer);
      this.questionOverlay.appendChild(questionBox);
      document.body.appendChild(this.questionOverlay);
    } else {
      this.questionTextElement = document.getElementById('question-text');
      this.answerButtonsContainer = document.getElementById('answer-buttons');
    }
    if (!this.questionTextElement || !this.answerButtonsContainer)
      console.error('[UIManager] Nie udało się znaleźć/utworzyć potomnych elementów UI pytania!');
    this.questionOverlay.style.display = 'none';
  }

  /** Tworzy lub znajduje nakładkę wyboru piętra */
  static createFloorSelectionUI() {
    this.floorSelectionPanel = document.getElementById('floor-selection-ui');
    if (!this.floorSelectionPanel) {
      this.floorSelectionPanel = document.createElement('div');
      this.floorSelectionPanel.id = 'floor-selection-ui';
      this.floorSelectionPanel.classList.add('ui-panel');
      const title = document.createElement('h2');
      title.textContent = 'Wybór piętra'; // Zmieniono "Выбор этажа" na "Wybór piętra"
      this.floorButtonsContainer = document.createElement('div');
      this.floorButtonsContainer.id = 'floor-buttons-container';
      this.floorSelectionPanel.appendChild(title);
      this.floorSelectionPanel.appendChild(this.floorButtonsContainer);
      document.body.appendChild(this.floorSelectionPanel);
    } else {
      this.floorButtonsContainer = document.getElementById('floor-buttons-container');
    }
    if (!this.floorButtonsContainer)
      console.error('[UIManager] Nie udało się znaleźć/utworzyć kontenera przycisków pięter!');
    this.floorSelectionPanel.style.display = 'none';
  }

  /** Zapewnia istnienie kontenera komunikatów flash */
  static ensureFlashMessageContainer() {
    if (!this.flashMessageContainer) {
      this.flashMessageContainer = document.getElementById('flash-message-container');
      if (!this.flashMessageContainer) {
        this.flashMessageContainer = document.createElement('div');
        this.flashMessageContainer.id = 'flash-message-container';
        this.flashMessageContainer.classList.add('flash-message');
        this.flashMessageContainer.style.display = 'none';
        document.body.appendChild(this.flashMessageContainer);
      }
    }
    return this.flashMessageContainer;
  }

  /**
   * Pokazuje UI pytania. Wywołuje GameplayManager.handleAnswer przy wyborze.
   * @param {object} questionData - Obiekt pytania { question: string, options: string[], correctAnswer: number }
   */
  static showQuestion(questionData) {
    if (
      !this.questionOverlay ||
      !this.questionTextElement ||
      !this.answerButtonsContainer ||
      !questionData
    ) {
      console.error('[UIManager] Nie można pokazać pytania - brakuje UI/Danych.');
      return;
    }
    if (
      !this.gameplayManagerInstance ||
      typeof this.gameplayManagerInstance.handleAnswer !== 'function'
    ) {
      console.error(
        '[UIManager] Nie można pokazać pytania - GameplayManager lub metoda handleAnswer nie są ustawione!'
      );
      return;
    }

    this.questionTextElement.textContent = questionData.question;
    this.answerButtonsContainer.innerHTML = ''; // Wyczyść poprzednie przyciski

    questionData.options.forEach((optionText, index) => {
      const button = document.createElement('button');
      button.textContent = optionText;
      button.dataset.index = index;
      button.classList.add('answer-button');
      button.addEventListener('click', (e) => {
        const selectedIndex = parseInt(e.target.dataset.index, 10);
        // Bezpośrednio wywołaj handler GameplayManagera
        setTimeout(() => this.gameplayManagerInstance.handleAnswer(selectedIndex), 50); // Lekkie opóźnienie dla reakcji UI
      });
      this.answerButtonsContainer.appendChild(button);
    });
    this.questionOverlay.style.display = 'flex';
  }

  /** Ukrywa nakładkę pytania */
  static hideQuestion() {
    if (this.questionOverlay) this.questionOverlay.style.display = 'none';
    // Wyczyść zawartość, aby zapobiec krótkotrwałemu wyświetlaniu starego pytania przy ponownym pokazaniu
    if (this.questionTextElement) this.questionTextElement.textContent = '';
    if (this.answerButtonsContainer) this.answerButtonsContainer.innerHTML = '';
  }

  /**
   * Pokazuje UI wyboru piętra. Wywołuje GameplayManager.handleFloorSelection przy kliknięciu.
   * @param {number} minFloor
   * @param {number} maxFloor
   * @param {number} currentFloor
   */
  static showFloorSelectionUI(minFloor, maxFloor, currentFloor) {
    if (!this.floorSelectionPanel || !this.floorButtonsContainer) {
      console.error('[UIManager] Nie można pokazać wyboru piętra - brak elementów UI.');
      this.createFloorSelectionUI(); // Spróbuj utworzyć, jeśli brakuje
      if (!this.floorSelectionPanel || !this.floorButtonsContainer) return;
    }
    if (
      !this.gameplayManagerInstance ||
      typeof this.gameplayManagerInstance.handleFloorSelection !== 'function'
    ) {
      console.error(
        '[UIManager] Nie można pokazać wyboru piętra - GameplayManager lub metoda handleFloorSelection nie są ustawione!'
      );
      return;
    }

    this.floorButtonsContainer.innerHTML = ''; // Wyczyść poprzednie przyciski
    for (let floor = minFloor; floor <= maxFloor; floor++) {
      const button = document.createElement('button');
      button.textContent = `Piętro ${floor}`; // Zmieniono "Этаж" na "Piętro"
      button.classList.add('floor-button');
      button.dataset.floor = floor;
      if (floor === currentFloor) {
        button.disabled = true;
        button.classList.add('current');
      } else {
        button.addEventListener('click', () => {
          // Bezpośrednio wywołaj handler GameplayManagera
          this.gameplayManagerInstance.handleFloorSelection(floor);
          // GameplayManager jest teraz odpowiedzialny za ukrycie tego UI
        });
      }
      this.floorButtonsContainer.appendChild(button);
    }
    this.floorSelectionPanel.style.display = 'flex';
  }

  /** Ukrywa nakładkę wyboru piętra */
  static hideFloorSelectionUI() {
    if (this.floorSelectionPanel) this.floorSelectionPanel.style.display = 'none';
  }

  /** Aktualizuje wyświetlanie wyniku */
  static updateScore(score, target) {
    if (!this.scoreElement) this.scoreElement = document.getElementById('score-value');
    if (!this.targetElement) this.targetElement = document.getElementById('score-target');
    if (this.scoreElement) this.scoreElement.textContent = score;
    if (this.targetElement) this.targetElement.textContent = target;
  }

  /** Pokazuje tymczasowy komunikat flash */
  static flashMessage(message, type = 'info', duration = 3000) {
    const container = this.ensureFlashMessageContainer();
    if (!container) return;
    container.textContent = message;
    container.className = 'flash-message'; // Zresetuj klasy
    container.classList.add(`flash-${type}`);
    container.style.display = 'block';
    void container.offsetWidth; // Reflow
    container.style.opacity = 1;
    clearTimeout(this.flashMessageTimeout);
    this.flashMessageTimeout = setTimeout(() => {
      container.style.opacity = 0;
      const hide = () => {
        container.style.display = 'none';
        container.removeEventListener('transitionend', hide);
      };
      container.addEventListener('transitionend', hide);
      setTimeout(hide, 600); // Fallback
    }, duration);
  }

  /** Pokazuje główne elementy UI gry */
  static showGameUI() {
    const canvas = document.getElementById('game-canvas');
    const menuContainer = document.getElementById('menu-container');
    const scoreDisplay = document.getElementById('score-display');
    if (canvas) canvas.style.display = 'block';
    if (menuContainer) menuContainer.style.display = 'none';
    if (this.controlsContainer) this.controlsContainer.style.display = 'grid';
    if (scoreDisplay) scoreDisplay.style.display = 'block';
    this.hideQuestion();
    this.hideFloorSelectionUI(); // Upewnij się, że popupy są ukryte
  }

  /** Ukrywa główne elementy UI gry */
  static hideGameUI() {
    const canvas = document.getElementById('game-canvas');
    const scoreDisplay = document.getElementById('score-display');
    if (canvas) canvas.style.display = 'none';
    if (this.controlsContainer) this.controlsContainer.style.display = 'none';
    if (scoreDisplay) scoreDisplay.style.display = 'none';
    this.hideQuestion();
    this.hideFloorSelectionUI(); // Upewnij się, że popupy są ukryte
  }
}
