// src/UI/Menu.js
import { Game } from '../Core/Game.js';
import { UIManager } from './UIManager.js';

let currentGameInstance = null;

export class Menu {
  constructor(characterImageSources, kopernikImgSrc) {
    // Added kopernikImgSrc parameter
    this.characterImageSources = characterImageSources;
    this.kopernikImgSrc = kopernikImgSrc; // Store the imported image path
    this.selectedCharacter = null;
    this.userInteracted = false;
    this.overlay = null;
    this.audioManagerInstance = null;

    console.log('[Menu] Constructor called. Initializing elements...');
    this.initializeElements();

    if (this.characterPanel && this.characterGrid) {
      this.setupCharacterImages();
    } else {
      console.error(
        '[Menu Constructor] CRITICAL: characterPanel or characterGrid is null AFTER initializeElements. Cannot setup images.'
      );
    }

    console.log('[Menu] Adding event listeners...');
    this.addEventListeners();
    this.show();
    console.log('[Menu] Instance created and displayed.');
  }

  // Method for getting AudioManager from Game.js
  setAudioManager(audioManager) {
    this.audioManagerInstance = audioManager;
    console.log('[Menu] AudioManager instance received in Menu.');
    if (this.musicVolume && this.audioManagerInstance) {
      this.musicVolume.value = this.audioManagerInstance.getMusicVolume() * 100;
    } else if (this.musicVolume) {
      // If AudioManager is not yet available, but the slider exists, set value from localStorage
      const savedVolume = localStorage.getItem('musicVolume');
      if (savedVolume !== null) {
        this.musicVolume.value = parseFloat(savedVolume) * 100;
      } else {
        this.musicVolume.value = 50; // Default
      }
    }
  }

  initializeElements() {
    this.menuContainer = document.querySelector('.menu-container');
    if (!this.menuContainer) {
      console.error('[Menu Init] CRITICAL: .menu-container not found!');
      return;
    }

    this.settingsButton = this.menuContainer.querySelector('.settings-button');
    this.playButton = this.menuContainer.querySelector('.play-button');
    this.characterButton = this.menuContainer.querySelector('.character-button');

    if (!this.playButton) console.warn('[Menu Init] .play-button not found.');
    else this.playButton.disabled = true;

    if (!this.characterButton) console.warn('[Menu Init] .character-button not found.');
    if (!this.settingsButton) console.warn('[Menu Init] .settings-button not found.');

    // Panels should ideally be searched across the entire document if they are not nested within .menu-container
    this.settingsPanel = document.querySelector('.settings-panel');
    if (this.settingsPanel) {
      // If the panel is not in the body, move it there for correct fixed positioning
      if (
        this.settingsPanel.parentNode !== document.body &&
        this.settingsPanel.parentNode !== this.menuContainer /* allow if nested */
      ) {
        document.body.appendChild(this.settingsPanel.parentNode.removeChild(this.settingsPanel));
      }
      this.musicVolume = this.settingsPanel.querySelector('#music-volume');
      this.sfxVolume = this.settingsPanel.querySelector('#sfx-volume'); // Keep if needed
      this.closeSettingsButton = this.settingsPanel.querySelector('.panel-close-button');
      if (!this.musicVolume)
        console.warn('[Menu Init] #music-volume slider not found in settings panel.');
      if (!this.closeSettingsButton)
        console.warn('[Menu Init] .panel-close-button not found in settings panel.');
    } else {
      console.warn('[Menu Init] .settings-panel not found.');
    }

    this.characterPanel = document.querySelector('.character-panel');
    if (this.characterPanel) {
      if (
        this.characterPanel.parentNode !== document.body &&
        this.characterPanel.parentNode !== this.menuContainer
      ) {
        document.body.appendChild(this.characterPanel.parentNode.removeChild(this.characterPanel));
      }
      this.characterGrid = this.characterPanel.querySelector('.character-grid');
      this.closeCharacterPanelButton = this.characterPanel.querySelector('.panel-close-button');
      if (!this.characterGrid)
        console.error('[Menu Init] CRITICAL: .character-grid not found in character panel!');
      if (!this.closeCharacterPanelButton)
        console.warn('[Menu Init] .panel-close-button not found in character panel.');
    } else {
      console.error('[Menu Init] CRITICAL: .character-panel not found!');
    }

    // Create or find the element for displaying the selected character
    let displayContainer = this.menuContainer.querySelector('.main-menu-buttons');
    this.selectedCharacterDisplay = displayContainer
      ? displayContainer.querySelector('.selected-character-display')
      : null;

    if (!this.selectedCharacterDisplay) {
      this.selectedCharacterDisplay = document.createElement('div');
      this.selectedCharacterDisplay.className = 'selected-character-display';
      if (this.playButton && this.playButton.parentNode) {
        this.playButton.parentNode.insertBefore(this.selectedCharacterDisplay, this.playButton);
      } else if (displayContainer) {
        // Insert before the second button (assuming it's Play) or at the end
        displayContainer.insertBefore(
          this.selectedCharacterDisplay,
          displayContainer.children[1] || null
        );
      } else {
        this.menuContainer.appendChild(this.selectedCharacterDisplay); // fallback
      }
    }

    // Find the Kopernik image and set its source
    this.kopernikImageElement = document.getElementById('mikolaj-kopernik');
    if (this.kopernikImageElement) {
      if (this.kopernikImgSrc) {
        this.kopernikImageElement.src = this.kopernikImgSrc;
        console.log('[Menu Init] Kopernik image source set.');
      } else {
        console.warn('[Menu Init] Kopernik image element found, but no source provided to Menu.');
      }
    } else {
      console.warn('[Menu Init] #mikolaj-kopernik image element not found.');
    }

    this.updateSelectedCharacterDisplay(); // Update default text
  }

  setupCharacterImages() {
    if (!this.characterPanel || !this.characterGrid) {
      console.warn('[Menu setupCharacterImages] Character panel or grid not found.');
      return;
    }
    if (!this.characterImageSources || Object.keys(this.characterImageSources).length === 0) {
      console.warn('[Menu setupCharacterImages] No character image sources provided.');
      return;
    }

    const characterCards = this.characterGrid.querySelectorAll('.character-card');
    if (characterCards.length === 0) {
      console.warn('[Menu setupCharacterImages] No character cards found in the grid.');
      return;
    }

    characterCards.forEach((card) => {
      const characterKey = card.dataset.character;
      const imgElement = card.querySelector('.character-preview img');

      if (imgElement && this.characterImageSources[characterKey]) {
        imgElement.src = this.characterImageSources[characterKey];
      } else if (imgElement) {
        console.warn(
          `[Menu setupCharacterImages] Image element found, but no source for character: ${characterKey}`
        );
        imgElement.alt = `${characterKey} preview not available`;
      } else {
        // console.warn(`[Menu setupCharacterImages] No img tag found in card for character: ${characterKey}`);
      }
    });
  }

  // Handle first interaction for autoplay policy
  handleFirstInteraction() {
    if (!this.userInteracted) {
      this.userInteracted = true;
      console.log('[Menu] First user interaction recorded.');
      // AudioManager will be created in Game, but this interaction is important for the browser
    }
  }

  addEventListeners() {
    const addInteractiveListener = (element, eventType, handlerFn) => {
      if (element) {
        element.addEventListener(eventType, (event) => {
          this.handleFirstInteraction(); // Register interaction
          handlerFn.call(this, event); // Call handler
        });
      } else {
        // console.warn(`[Menu addEventListeners] Element not found for listener: ${element}`);
      }
    };

    addInteractiveListener(this.settingsButton, 'click', this.toggleSettings);
    addInteractiveListener(this.playButton, 'click', this.startGame);
    addInteractiveListener(this.characterButton, 'click', this.openCharacterModal);

    if (this.closeSettingsButton) {
      this.closeSettingsButton.addEventListener('click', () => this.closeSettings());
    } else if (this.settingsPanel) {
      console.warn('[Menu addEventListeners] Close button for settings panel not found.');
    }

    if (this.closeCharacterPanelButton) {
      this.closeCharacterPanelButton.addEventListener('click', () => this.closeCharacterModal());
    } else if (this.characterPanel) {
      console.warn('[Menu addEventListeners] Close button for character panel not found.');
    }

    if (this.musicVolume) {
      // Set initial value from localStorage if AudioManager is not yet available
      if (!this.audioManagerInstance) {
        const savedVolume = localStorage.getItem('musicVolume');
        if (savedVolume !== null) {
          this.musicVolume.value = parseFloat(savedVolume) * 100;
        } else {
          this.musicVolume.value = 50; // Default volume
        }
      }

      this.musicVolume.addEventListener('input', (e) => {
        this.handleFirstInteraction(); // Volume change is also an interaction
        const newVolume = parseFloat(e.target.value) / 100;
        if (this.audioManagerInstance) {
          this.audioManagerInstance.setMusicVolume(newVolume);
          console.log(`[Menu] Music volume changed via slider to: ${newVolume}`);
        } else {
          // If AudioManager is not here yet, save to localStorage, Game->AudioManager will pick it up
          localStorage.setItem('musicVolume', newVolume.toString());
          console.warn(
            '[Menu] Music volume slider changed, AudioManager not available. Saved to localStorage.'
          );
        }
      });
    }

    if (this.sfxVolume) {
      /* ... handler for SFX ... */
    }

    if (this.characterGrid) {
      this.characterGrid.addEventListener('click', (event) => {
        const clickedCard = event.target.closest('.character-card');
        if (
          clickedCard &&
          this.characterPanel &&
          this.characterPanel.classList.contains('visible')
        ) {
          this.handleFirstInteraction();
          this.selectCharacter(clickedCard);
        }
      });
    }
  }

  openCharacterModal() {
    if (!this.characterPanel) {
      console.error('Character panel not found.');
      return;
    }
    this.characterPanel.classList.add('visible');
    if (this.settingsPanel?.classList.contains('visible')) this.closeSettings();
    this._ensureOverlay().classList.add('visible');
  }

  closeCharacterModal() {
    this.characterPanel?.classList.remove('visible');
    this.overlay?.classList.remove('visible');
  }

  selectCharacter(cardElement) {
    if (!this.characterGrid || !cardElement?.dataset?.character) return;
    this.selectedCharacter = cardElement.dataset.character;

    this.characterGrid
      .querySelectorAll('.character-card')
      .forEach((c) => c.classList.remove('selected'));
    cardElement.classList.add('selected');

    if (this.playButton) this.playButton.disabled = false;

    this.updateSelectedCharacterDisplay();
    this.closeCharacterModal();
    UIManager.flashMessage(
      `Character ${
        this.selectedCharacter.charAt(0).toUpperCase() + this.selectedCharacter.slice(1)
      } selected!`,
      'success',
      2000
    );
  }

  updateSelectedCharacterDisplay() {
    if (!this.selectedCharacterDisplay) return;
    if (
      this.selectedCharacter &&
      this.characterImageSources &&
      this.characterImageSources[this.selectedCharacter]
    ) {
      const characterKey = this.selectedCharacter;
      const imgSrc = this.characterImageSources[characterKey];
      let displayedName = characterKey.charAt(0).toUpperCase() + characterKey.slice(1);

      // Try to get a fuller name from the card
      if (this.characterGrid) {
        const selectedCardH3 = this.characterGrid.querySelector(
          `.character-card[data-character="${characterKey}"] h3`
        );
        if (selectedCardH3) displayedName = selectedCardH3.textContent;
      }
      this.selectedCharacterDisplay.innerHTML = `<img src="${imgSrc}" alt="${displayedName}" class="selected-char-preview-img"> <span class="selected-char-name char-name-${characterKey}">${displayedName}</span>`;
    } else {
      this.selectedCharacterDisplay.innerHTML =
        '<span style="color:#aaa;">No character selected</span>';
    }
  }

  toggleSettings() {
    if (!this.settingsPanel) return;
    const isVisible = this.settingsPanel.classList.contains('visible');
    isVisible ? this.closeSettings() : this.openSettings();
  }

  openSettings() {
    if (!this.settingsPanel) {
      console.error('Settings panel not found.');
      return;
    }
    this.settingsPanel.classList.add('visible');
    if (this.characterPanel?.classList.contains('visible')) this.closeCharacterModal();
    this._ensureOverlay().classList.add('visible'); // Show overlay also for settings

    if (this.musicVolume && this.audioManagerInstance) {
      this.musicVolume.value = this.audioManagerInstance.getMusicVolume() * 100;
    } else if (this.musicVolume) {
      const savedVolume = localStorage.getItem('musicVolume');
      this.musicVolume.value = savedVolume ? parseFloat(savedVolume) * 100 : 50;
    }
  }

  closeSettings() {
    this.settingsPanel?.classList.remove('visible');
    this.overlay?.classList.remove('visible'); // Hide overlay
  }

  _ensureOverlay() {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'ui-modal-overlay'; // Common class for overlay
      this.overlay.addEventListener('click', (e) => {
        // Close active modal on overlay click
        if (e.target === this.overlay) {
          if (this.characterPanel?.classList.contains('visible')) this.closeCharacterModal();
          if (this.settingsPanel?.classList.contains('visible')) this.closeSettings();
        }
      });
      document.body.appendChild(this.overlay);
    }
    return this.overlay;
  }

  async startGame() {
    if (!this.userInteracted) {
      UIManager.flashMessage(
        'Please interact with the menu first (e.g., click a button or choose a character).',
        'warning',
        3000
      );
      return;
    }
    if (!this.selectedCharacter) {
      UIManager.flashMessage('Please select a character first!', 'warning', 2500);
      return;
    }

    const loadingOverlay = UIManager.getLoadingOverlay(); // UIManager manages it
    if (loadingOverlay) loadingOverlay.classList.add('visible');

    this.hide(); // Hide menu

    const gameCanvas = document.getElementById('game-canvas');
    if (gameCanvas) {
      gameCanvas.style.display = 'block'; // Show canvas
    } else {
      console.error('[Menu] CRITICAL: #game-canvas not found!');
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      this.show(); // Show menu back if canvas is missing
      return;
    }

    try {
      // If there's an old game, stop it (though reload on Game Over is better)
      if (currentGameInstance && typeof currentGameInstance.stopGame === 'function') {
        console.log('[Menu] Stopping previous game instance.');
        currentGameInstance.stopGame(); // This will show the Game Over screen of the old game
        currentGameInstance = null; // Clear reference
        // A slight delay might be needed for the old game's DOM to clear,
        // but typically reload() on Game Over solves this better.
      }

      console.log(`[Menu] Creating new Game instance with character: ${this.selectedCharacter}`);
      currentGameInstance = new Game(this.selectedCharacter); // Pass color

      // In the Game constructor, AudioManager is created. Game should pass it back to Menu.
      // For this, Game.js needs to call menuInstance.setAudioManager(this.audioManager);
      // This requires Game to know about menuInstance. It's simpler if Game itself manages UI volume
      // via UIManager, or if Menu directly uses localStorage for initial volume setting,
      // and AudioManager reads from localStorage on startup.

      // IMPORTANT: Game.js should call its triggerGameStart() after its initialization.
      // Menu.js just creates a Game instance.
      // If Game does not automatically start triggerGameStart() from its constructor (which is the case now),
      // then Menu must call it:
      if (currentGameInstance && typeof currentGameInstance.triggerGameStart === 'function') {
        await currentGameInstance.triggerGameStart(); // Start the game loading and start process
      } else {
        throw new Error('Game instance created, but triggerGameStart is not available.');
      }

      // After successful currentGameInstance.triggerGameStart()
      // loadingOverlay will be hidden within Game.js logic
    } catch (error) {
      console.error('[Menu] Error during game initialization or start:', error);
      UIManager.flashMessage(`Game Start Failed: ${error.message}`, 'error', 10000);
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      this.show(); // Show menu back
      if (gameCanvas) gameCanvas.style.display = 'none'; // Hide canvas
      currentGameInstance = null;
    }
  }

  show() {
    if (this.menuContainer) this.menuContainer.style.display = 'flex'; // or 'block'
    // Ensure game elements are hidden when showing menu
    const gameCanvas = document.getElementById('game-canvas');
    if (gameCanvas) gameCanvas.style.display = 'none';
    UIManager.hideGameUI(); // Hides controls, score, timer
    UIManager.hideGameOverScreen();
    // Loading overlay should also be hidden if we are in the menu
    const loadingOverlay = UIManager.getLoadingOverlay();
    if (loadingOverlay) loadingOverlay.classList.remove('visible');
  }

  hide() {
    if (this.menuContainer) this.menuContainer.style.display = 'none';
  }
}

// Export Menu and currentGameInstance (if needed elsewhere, though avoiding global references is better)
export { currentGameInstance };
