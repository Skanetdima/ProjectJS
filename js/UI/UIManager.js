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
  // static gameUIContainer = null; // REMOVED - Not used consistently

  // --- Static Properties for State/Callbacks ---
  static gameplayManagerInstance = null; // Reference to GameplayManager
  static flashMessageTimeouts = {}; // Use an object to track multiple timeouts by message element

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
      { direction: 'up', icon: '↑', gridArea: 'up', dataDirection: 'up' }, // Use consistent naming (e.g., data-direction)
      { direction: 'left', icon: '←', gridArea: 'left', dataDirection: 'left' },
      { direction: 'right', icon: '→', gridArea: 'right', dataDirection: 'right' },
      { direction: 'down', icon: '↓', gridArea: 'down', dataDirection: 'down' },
    ];

    arrows.forEach(({ direction, icon, gridArea, dataDirection }) => {
      const btn = document.createElement('button');
      btn.className = `control-btn ${direction}`; // Class for styling grid area
      btn.dataset.direction = dataDirection; // Data attribute for potential use
      btn.textContent = icon;
      btn.style.gridArea = gridArea; // Apply grid area style

      const startPress = (e) => {
        if (inputManager?.keys.hasOwnProperty(direction)) {
          inputManager.setKey(direction, true);
          btn.classList.add('active');
        }
        e.preventDefault();
      };
      const endPress = (e) => {
        if (inputManager?.keys.hasOwnProperty(direction)) {
          // Only release if it was actually pressed according to the manager
          if (inputManager.keys[direction]) {
            inputManager.setKey(direction, false);
          }
          // Always remove active class on release/leave/cancel
          btn.classList.remove('active');
        }
        e.preventDefault();
      };
      // Use { passive: false } because we call preventDefault()
      btn.addEventListener('touchstart', startPress, { passive: false });
      btn.addEventListener('touchend', endPress, { passive: false });
      btn.addEventListener('touchcancel', endPress, { passive: false });
      btn.addEventListener('mousedown', startPress);
      btn.addEventListener('mouseup', endPress);
      btn.addEventListener('mouseleave', endPress); // Ensure button deactivates if mouse leaves while pressed
      this.controlsContainer.appendChild(btn);
    });
    // Initial state managed by CSS or show/hide methods, no need for inline style here

    // --- Score Element ---
    const scoreDisplayContainer = document.getElementById('score-display');
    if (!scoreDisplayContainer) {
      const scoreDiv = document.createElement('div');
      scoreDiv.id = 'score-display';
      scoreDiv.classList.add('score-display');
      scoreDiv.innerHTML = `Książki: <span id="score-value">0</span> / <span id="score-target">?</span>`;
      document.body.appendChild(scoreDiv);
      this.scoreElement = scoreDiv.querySelector('#score-value'); // More specific query
      this.targetElement = scoreDiv.querySelector('#score-target'); // More specific query
    } else {
      this.scoreElement = scoreDisplayContainer.querySelector('#score-value');
      this.targetElement = scoreDisplayContainer.querySelector('#score-target');
      if (this.scoreElement) this.scoreElement.textContent = '0';
      if (this.targetElement) this.targetElement.textContent = '?';
    }
    // Initial state managed by CSS or show/hide methods
  }

  /** Tworzy lub znajduje elementy nakładki pytania */
  static createQuestionUI() {
    this.questionOverlay = document.getElementById('question-overlay');
    if (!this.questionOverlay) {
      this.questionOverlay = document.createElement('div');
      this.questionOverlay.id = 'question-overlay';
      this.questionOverlay.classList.add('ui-panel'); // Add base class for styling/transitions

      // Use innerHTML for structure to easily match HTML file
      this.questionOverlay.innerHTML = `
        <div id="blackboard-content">
          <h2>Pytanie</h2>
          <div id="question-box">
            <p id="question-text"></p>
            <div id="answer-buttons"></div>
          </div>
        </div>
      `;
      document.body.appendChild(this.questionOverlay);
    }
    // Find elements within the created/found overlay
    this.questionTextElement = this.questionOverlay.querySelector('#question-text');
    this.answerButtonsContainer = this.questionOverlay.querySelector('#answer-buttons');

    if (!this.questionTextElement || !this.answerButtonsContainer) {
      console.error('[UIManager] Nie udało się znaleźć/utworzyć potomnych elementów UI pytania!');
    }
    // Initial state managed by CSS (.ui-panel rules)
  }

  /** Tworzy lub znajduje nakładkę wyboru piętra */
  static createFloorSelectionUI() {
    this.floorSelectionPanel = document.getElementById('floor-selection-ui');
    if (!this.floorSelectionPanel) {
      this.floorSelectionPanel = document.createElement('div');
      this.floorSelectionPanel.id = 'floor-selection-ui';
      this.floorSelectionPanel.classList.add('ui-panel'); // Add base class

      // Use innerHTML for structure
      this.floorSelectionPanel.innerHTML = `
        <h2>Wybór piętra</h2>
        <div id="floor-buttons-container"></div>
      `;
      document.body.appendChild(this.floorSelectionPanel);
    }
    // Find elements within the panel
    this.floorButtonsContainer = this.floorSelectionPanel.querySelector('#floor-buttons-container');

    if (!this.floorButtonsContainer) {
      console.error('[UIManager] Nie udało się znaleźć/utworzyć kontenera przycisków pięter!');
    }
    // Initial state managed by CSS (.ui-panel rules)
  }

  /** Zapewnia istnienie kontenera komunikatów flash */
  static ensureFlashMessageContainer() {
    if (!this.flashMessageContainer) {
      this.flashMessageContainer = document.getElementById('flash-message-container');
      if (!this.flashMessageContainer) {
        console.log('[UIManager] Tworzenie dynamicznego kontenera komunikatów flash...');
        this.flashMessageContainer = document.createElement('div');
        this.flashMessageContainer.id = 'flash-message-container';
        document.body.appendChild(this.flashMessageContainer);
      }
    }
    return this.flashMessageContainer;
  }

  /** Pokazuje tymczasowy komunikat flash (Using the first, better implementation) */
  static flashMessage(message, type = 'info', duration = 3000) {
    const container = this.ensureFlashMessageContainer();
    if (!container) {
      console.error('[UIManager] Flash message container not found or creatable.');
      return;
    }

    // --- Improved Flash Message Creation ---
    // 1. Create the actual message element
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.className = 'flash-message'; // Base class
    messageElement.classList.add(`flash-${type}`); // Type-specific class
    // Assign a unique ID for tracking its timeout
    const messageId = `flash-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    messageElement.id = messageId;

    // 2. Append to container
    container.appendChild(messageElement);

    // 3. Trigger transition (slight delay to ensure CSS applies)
    requestAnimationFrame(() => {
      messageElement.classList.add('visible'); // Add class that sets opacity: 1 and transform
    });

    // 4. Clear any existing timeout for this specific message (shouldn't happen with unique IDs, but safe)
    clearTimeout(this.flashMessageTimeouts[messageId]);

    // 5. Function to remove the element
    const removeElement = () => {
      messageElement.classList.remove('visible'); // Start fade-out transition

      // Listener for transition end to remove from DOM
      const handleTransitionEnd = (event) => {
        // Ensure the transition is for opacity or transform to avoid conflicts
        if (event.propertyName === 'opacity' || event.propertyName === 'transform') {
          if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
          }
          delete this.flashMessageTimeouts[messageId]; // Clean up timeout reference
        }
      };
      messageElement.addEventListener('transitionend', handleTransitionEnd, { once: true });

      // Fallback removal in case transitionend doesn't fire (e.g., element hidden quickly)
      // The timeout should be slightly longer than the CSS transition duration (0.4s in the CSS)
      setTimeout(() => {
        if (messageElement.parentNode) {
          console.warn(`[UIManager] Fallback removal for flash message: ${messageId}`);
          messageElement.removeEventListener('transitionend', handleTransitionEnd); // Remove listener if fallback triggers
          messageElement.parentNode.removeChild(messageElement);
        }
        delete this.flashMessageTimeouts[messageId]; // Clean up timeout reference
      }, 500); // 500ms > 400ms transition
    };

    // 6. Set timeout to start the removal process
    this.flashMessageTimeouts[messageId] = setTimeout(removeElement, duration);
  }

  // --- REMOVED the duplicate, simpler flashMessage function ---

  /**
   * Pokazuje UI pytania. Wywołuje GameplayManager.handleAnswer przy wyborze.
   * @param {object} questionData - Obiekt pytania { question: string, options: string[], correctAnswer: number }
   */
  static showQuestion(questionData) {
    if (!this.questionOverlay || !this.questionTextElement || !this.answerButtonsContainer) {
      console.error(
        '[UIManager] Próba pokazania pytania, ale UI nie jest gotowe. Wywołaj createQuestionUI().'
      );
      this.createQuestionUI(); // Try to create it if missing
      if (!this.questionOverlay || !this.questionTextElement || !this.answerButtonsContainer) {
        console.error('[UIManager] Nie można pokazać pytania - brakuje UI.');
        return;
      }
    }
    if (!questionData) {
      console.error('[UIManager] Nie można pokazać pytania - brak danych (questionData).');
      return;
    }
    if (!this.gameplayManagerInstance?.handleAnswer) {
      // Optional chaining for check
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
      button.classList.add('answer-button'); // Use class from CSS
      button.addEventListener('click', (e) => {
        const selectedIndex = parseInt(e.target.dataset.index, 10);
        // Directly call the GameplayManager handler
        // No need for setTimeout here unless specific UI feedback requires it *before* handling
        this.gameplayManagerInstance.handleAnswer(selectedIndex);
        // GameplayManager should be responsible for hiding the question UI after answer
      });
      this.answerButtonsContainer.appendChild(button);
    });

    // *** FIX: Use classList.add('visible') instead of style.display ***
    this.questionOverlay.classList.add('visible');
    console.log('[UIManager] Added "visible" class to questionOverlay'); // Log for debugging
  }

  /** Ukrywa nakładkę pytania */
  static hideQuestion() {
    if (this.questionOverlay) {
      // *** FIX: Use classList.remove('visible') instead of style.display ***
      this.questionOverlay.classList.remove('visible');
      console.log('[UIManager] Removed "visible" class from questionOverlay');

      // Clear content after hiding starts (or immediately)
      if (this.questionTextElement) this.questionTextElement.textContent = '';
      if (this.answerButtonsContainer) this.answerButtonsContainer.innerHTML = '';
    }
  }

  /**
   * Pokazuje UI wyboru piętra. Wywołuje GameplayManager.handleFloorSelection przy kliknięciu.
   * @param {number} minFloor
   * @param {number} maxFloor
   * @param {number} currentFloor
   */
  static showFloorSelectionUI(minFloor, maxFloor, currentFloor) {
    if (!this.floorSelectionPanel || !this.floorButtonsContainer) {
      console.error(
        '[UIManager] Próba pokazania wyboru piętra, ale UI nie jest gotowe. Wywołaj createFloorSelectionUI().'
      );
      this.createFloorSelectionUI(); // Try to create if missing
      if (!this.floorSelectionPanel || !this.floorButtonsContainer) {
        console.error('[UIManager] Nie można pokazać wyboru piętra - brak elementów UI.');
        return;
      }
    }
    if (!this.gameplayManagerInstance?.handleFloorSelection) {
      // Optional chaining
      console.error(
        '[UIManager] Nie można pokazać wyboru piętra - GameplayManager lub metoda handleFloorSelection nie są ustawione!'
      );
      return;
    }

    this.floorButtonsContainer.innerHTML = ''; // Wyczyść poprzednie przyciski
    for (let floor = minFloor; floor <= maxFloor; floor++) {
      const button = document.createElement('button');
      button.textContent = `Piętro ${floor}`;
      button.classList.add('floor-button'); // Use class from CSS
      button.dataset.floor = floor;
      if (floor === currentFloor) {
        button.disabled = true;
        button.classList.add('current'); // Add class for styling current floor
      } else {
        button.addEventListener('click', () => {
          // Directly call the GameplayManager handler
          this.gameplayManagerInstance.handleFloorSelection(floor);
          // GameplayManager should be responsible for hiding this UI
        });
      }
      this.floorButtonsContainer.appendChild(button);
    }

    // *** FIX: Use classList.add('visible') instead of style.display ***
    this.floorSelectionPanel.classList.add('visible');
  }

  /** Ukrywa nakładkę wyboru piętra */
  static hideFloorSelectionUI() {
    if (this.floorSelectionPanel) {
      // *** FIX: Use classList.remove('visible') instead of style.display ***
      this.floorSelectionPanel.classList.remove('visible');
    }
  }

  /** Aktualizuje wyświetlanie wyniku */
  static updateScore(score, target) {
    // Ensure elements are selected if not already
    if (!this.scoreElement) this.scoreElement = document.getElementById('score-value');
    if (!this.targetElement) this.targetElement = document.getElementById('score-target');

    if (this.scoreElement) this.scoreElement.textContent = score;
    else console.warn("[UIManager] Score element ('score-value') not found for updating.");

    if (this.targetElement) this.targetElement.textContent = target;
    else console.warn("[UIManager] Target element ('score-target') not found for updating.");
  }

  /** Pokazuje główne elementy UI gry */
  static showGameUI() {
    const canvas = document.getElementById('game-canvas');
    const menuContainer = document.getElementById('menu-container');
    const scoreDisplay = document.getElementById('score-display');

    if (canvas) canvas.style.display = 'block'; // Or 'flex', 'grid' depending on layout needs
    else console.warn('[UIManager] Canvas element not found to show.');

    if (menuContainer) {
      menuContainer.classList.add('hidden'); // Use CSS class for potentially smoother transition
      // menuContainer.style.display = 'none'; // Or direct style if no transition needed
    } else console.warn('[UIManager] Menu container not found to hide.');

    if (this.controlsContainer) {
      this.controlsContainer.classList.add('visible'); // Use CSS class
      // this.controlsContainer.style.display = 'grid'; // Or direct style
    } else console.warn('[UIManager] Controls container not found to show.');

    if (scoreDisplay) {
      scoreDisplay.classList.add('visible'); // Use CSS class
      // scoreDisplay.style.display = 'block'; // Or direct style
    } else console.warn('[UIManager] Score display not found to show.');

    // Ensure overlays are hidden when game UI shows
    this.hideQuestion();
    this.hideFloorSelectionUI();
  }

  /** Ukrywa główne elementy UI gry */
  static hideGameUI() {
    const canvas = document.getElementById('game-canvas');
    const scoreDisplay = document.getElementById('score-display');
    const menuContainer = document.getElementById('menu-container'); // Added menu for potentially showing it

    if (canvas) canvas.style.display = 'none';
    else console.warn('[UIManager] Canvas element not found to hide.');

    if (this.controlsContainer) {
      this.controlsContainer.classList.remove('visible');
      // this.controlsContainer.style.display = 'none';
    } else console.warn('[UIManager] Controls container not found to hide.');

    if (scoreDisplay) {
      scoreDisplay.classList.remove('visible');
      // scoreDisplay.style.display = 'none';
    } else console.warn('[UIManager] Score display not found to hide.');

    // Ensure overlays are hidden when game UI hides
    this.hideQuestion();
    this.hideFloorSelectionUI();

    // Optionally show the menu when hiding the game UI
    if (menuContainer) {
      menuContainer.classList.remove('hidden');
      // menuContainer.style.display = 'flex'; // Or whatever its default display is
    }
  }

  /** Initializes all UI elements by finding or creating them */
  static initializeUI(inputManager) {
    console.log('[UIManager] Initializing UI elements...');
    this.createControls(inputManager);
    this.createQuestionUI();
    this.createFloorSelectionUI();
    this.ensureFlashMessageContainer();
    console.log('[UIManager] UI Initialization complete.');
  }
}
