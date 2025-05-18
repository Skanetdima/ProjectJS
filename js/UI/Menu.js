// src/UI/Menu.js
import { Game } from '../Core/Game.js';
import { UIManager } from './UIManager.js';

let currentGameInstance = null;

class Menu {
  constructor(characterImageSources) {
    this.characterImageSources = characterImageSources;
    this.selectedCharacter = null;
    this.userInteracted = false;
    this.overlay = null;
    this.audioManagerInstance = null; // To store AudioManager

    console.log('[Menu] Constructor called. Initializing elements...');
    this.initializeElements();

    if (this.characterPanel) {
      this.setupCharacterImages();
    } else {
      console.error(
        '[Menu Constructor] CRITICAL: this.characterPanel is null AFTER initializeElements. Cannot setup images.'
      );
    }

    console.log('[Menu] Adding event listeners...');
    this.addEventListeners();
    console.log('[Menu] Instance created.');
  }

  // Method to be called from Game.js to pass AudioManager
  setAudioManager(audioManager) {
    this.audioManagerInstance = audioManager;
    console.log('[Menu] AudioManager instance received.');
    // Initialize volume slider value if AudioManager is now available
    if (this.musicVolume && this.audioManagerInstance) {
      // Volume from AudioManager is 0-1, slider is 0-100
      this.musicVolume.value = this.audioManagerInstance.getMusicVolume() * 100;
    }
  }

  initializeElements() {
    this.menuContainer = document.querySelector('.menu-container');
    if (!this.menuContainer) console.error('[Menu Init] CRITICAL: .menu-container not found!');

    this.settingsButton = document.querySelector('.settings-button');
    this.playButton = document.querySelector('.play-button');
    this.characterButton = document.querySelector('.character-button');

    if (!this.playButton) console.warn('[Menu Init] .play-button not found.');
    else this.playButton.disabled = true;

    if (!this.characterButton) console.warn('[Menu Init] .character-button not found.');

    this.settingsPanel = document.querySelector('.settings-panel');
    if (this.settingsPanel) {
      if (this.settingsPanel.parentNode !== document.body) {
        document.body.appendChild(this.settingsPanel);
      }
      this.musicVolume = this.settingsPanel.querySelector('#music-volume'); // This is the slider
      this.sfxVolume = this.settingsPanel.querySelector('#sfx-volume');
      this.closeSettingsButton = this.settingsPanel.querySelector('.panel-close-button');

      // Initialize slider value if audioManagerInstance is already somehow set
      // (though typically it won't be at this exact point)
      if (this.musicVolume && this.audioManagerInstance) {
        this.musicVolume.value = this.audioManagerInstance.getMusicVolume() * 100;
      }
    } else {
      console.warn('[Menu Init] .settings-panel not found.');
    }

    this.characterPanel = document.querySelector('.character-panel');
    if (this.characterPanel) {
      if (this.characterPanel.parentNode !== document.body) {
        document.body.appendChild(this.characterPanel);
      }
      this.characterGrid = this.characterPanel.querySelector('.character-grid');
      this.closeCharacterPanelButton = this.characterPanel.querySelector('.panel-close-button');
    } else {
      console.error('[Menu Init] CRITICAL: .character-panel not found during initialization!');
    }

    this.selectedCharacterDisplay = document.createElement('div');
    this.selectedCharacterDisplay.className = 'selected-character-display';

    const mainMenuButtonsContainer = this.menuContainer
      ? this.menuContainer.querySelector('.main-menu-buttons')
      : null;

    if (this.playButton && this.playButton.parentNode) {
      this.playButton.parentNode.insertBefore(this.selectedCharacterDisplay, this.playButton);
    } else if (mainMenuButtonsContainer) {
      mainMenuButtonsContainer.insertBefore(
        this.selectedCharacterDisplay,
        mainMenuButtonsContainer.children[1] || null
      );
    } else if (this.menuContainer) {
      this.menuContainer.appendChild(this.selectedCharacterDisplay);
    } else {
      console.error(
        '[Menu Init] Cannot append selectedCharacterDisplay: no suitable parent found.'
      );
    }
    this.updateSelectedCharacterDisplay();
  }

  setupCharacterImages() {
    if (!this.characterPanel) {
      return;
    }
    if (!this.characterImageSources) {
      return;
    }

    const characterCards = this.characterPanel.querySelectorAll('.character-card');
    if (characterCards.length === 0) {
      return;
    }

    characterCards.forEach((card) => {
      const characterKey = card.dataset.character;
      const imgElement = card.querySelector('.character-preview img');

      if (imgElement && this.characterImageSources[characterKey]) {
        imgElement.src = this.characterImageSources[characterKey];
      }
    });
  }

  handleFirstInteraction() {
    if (!this.userInteracted) {
      this.userInteracted = true;
      console.log('[Menu] First user interaction detected.');
      // No need to explicitly init AudioManager here, Game.js will handle it
      // when startGame is called.
    }
  }

  addEventListeners() {
    const addInteractiveListener = (element, eventType, handlerFn) => {
      if (element) {
        element.addEventListener(eventType, (event) => {
          this.handleFirstInteraction();
          handlerFn.call(this, event);
        });
      }
    };

    addInteractiveListener(this.settingsButton, 'click', this.toggleSettings);
    addInteractiveListener(this.playButton, 'click', this.startGame);
    addInteractiveListener(this.characterButton, 'click', this.openCharacterModal);

    if (this.closeSettingsButton) {
      this.closeSettingsButton.addEventListener('click', () => this.closeSettings());
    }
    if (this.closeCharacterPanelButton) {
      this.closeCharacterPanelButton.addEventListener('click', () => this.closeCharacterModal());
    }

    if (this.musicVolume) {
      this.musicVolume.addEventListener('input', (e) => {
        if (this.audioManagerInstance) {
          // Slider value is 0-100, AudioManager expects 0-1
          const newVolume = parseFloat(e.target.value) / 100;
          this.audioManagerInstance.setMusicVolume(newVolume);
          console.log(`[Menu] Music volume changed via slider to: ${newVolume}`);
        } else {
          console.warn('[Menu] Music volume slider changed, but AudioManager not available.');
        }
      });
    }
    if (this.sfxVolume) {
      // SFX volume listener (if you implement SFX later)
      // this.sfxVolume.addEventListener('input', (e) => {
      //   if (this.audioManagerInstance && typeof this.audioManagerInstance.setSfxVolume === 'function') {
      //     this.audioManagerInstance.setSfxVolume(parseFloat(e.target.value) / 100);
      //   }
      // });
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
    if (!this.characterPanel || !this.characterGrid) {
      return;
    }
    this.characterPanel.classList.add('visible');

    if (this.settingsPanel?.classList.contains('visible')) {
      this.closeSettings();
    }

    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'character-modal-overlay';
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.closeCharacterModal();
        }
      });
      document.body.appendChild(this.overlay);
    }
    this.overlay.classList.add('visible');
  }

  closeCharacterModal() {
    if (this.characterPanel) {
      this.characterPanel.classList.remove('visible');
    }
    if (this.overlay) {
      this.overlay.classList.remove('visible');
    }
  }

  selectCharacter(cardElement) {
    if (!this.characterGrid || !cardElement?.dataset?.character) {
      return;
    }
    const selectedCharKey = cardElement.dataset.character;

    this.characterGrid
      .querySelectorAll('.character-card')
      .forEach((c) => c.classList.remove('selected'));
    cardElement.classList.add('selected');
    this.selectedCharacter = selectedCharKey;

    if (this.playButton) {
      this.playButton.disabled = false;
    }

    this.updateSelectedCharacterDisplay();
    this.closeCharacterModal();
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
      let displayedName = characterKey.charAt(0).toUpperCase() + characterKey.slice(1) + ' Student';

      if (this.characterGrid) {
        const selectedCardElementH3 = this.characterGrid.querySelector(
          `.character-card[data-character="${characterKey}"] h3`
        );
        if (selectedCardElementH3) {
          displayedName = selectedCardElementH3.textContent;
        }
      }
      this.selectedCharacterDisplay.innerHTML = `<img src="${imgSrc}" alt="${displayedName}" style="width:32px;height:32px;vertical-align:middle;margin-right:8px; border-radius:50%; object-fit:cover; background-color: #444;"> <span style="font-weight:bold;">${displayedName}</span>`;
    } else {
      this.selectedCharacterDisplay.innerHTML =
        '<span style="color:#aaa;">No character selected</span>';
    }
  }

  toggleSettings() {
    if (!this.settingsPanel) return;
    const isVisible = this.settingsPanel.classList.contains('visible');
    if (isVisible) {
      this.closeSettings();
    } else {
      this.openSettings();
    }
  }

  openSettings() {
    if (this.settingsPanel) {
      this.settingsPanel.classList.add('visible');
      if (this.characterPanel?.classList.contains('visible')) {
        this.closeCharacterModal();
      }
      // Ensure slider reflects current volume when panel opens
      if (this.musicVolume && this.audioManagerInstance) {
        this.musicVolume.value = this.audioManagerInstance.getMusicVolume() * 100;
      }
    }
  }

  closeSettings() {
    if (this.settingsPanel && this.settingsPanel.classList.contains('visible')) {
      this.settingsPanel.classList.remove('visible');
    }
  }

  async startGame() {
    if (!this.selectedCharacter) {
      UIManager.flashMessage('Please select a character first!', 'warning', 2500);
      return;
    }

    const loadingOverlay = UIManager.getLoadingOverlay();
    if (loadingOverlay) loadingOverlay.classList.add('visible');

    if (this.menuContainer) {
      this.menuContainer.style.display = 'none';
    } else {
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      return;
    }

    const gameCanvas = document.getElementById('game-canvas');
    if (gameCanvas) {
      gameCanvas.style.display = 'block';
    } else {
      console.error('[Menu] CRITICAL: #game-canvas not found!');
      if (this.menuContainer) this.menuContainer.style.display = 'flex';
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      return;
    }

    try {
      if (currentGameInstance && typeof currentGameInstance.stopGame === 'function') {
        currentGameInstance.stopGame();
      }
      // Game constructor will create AudioManager
      currentGameInstance = new Game(this.selectedCharacter);

      // Pass the AudioManager from the new game instance to this Menu instance
      if (currentGameInstance && currentGameInstance.audioManager) {
        this.setAudioManager(currentGameInstance.audioManager);
      } else {
        console.warn(
          '[Menu startGame] Failed to get AudioManager from new Game instance to set it in Menu.'
        );
      }
    } catch (error) {
      console.error('[Menu] Critical error during game initialization:', error);
      UIManager.flashMessage(`Game Start Failed: ${error.message}`, 'error', 10000);
      if (this.menuContainer) this.menuContainer.style.display = 'flex';
      if (gameCanvas) gameCanvas.style.display = 'none';
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      currentGameInstance = null;
    }
  }
}
export { Menu, currentGameInstance }; // Export currentGameInstance if needed externally
