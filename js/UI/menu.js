// src/UI/Menu.js
import { Game } from '../Core/Game.js';
// import { AudioManager } from './AudioManager.js'; // ЗАКОММЕНТИРОВАНО
import { UIManager } from './UIManager.js';

let currentGameInstance = null;

class Menu {
  constructor() {
    this.selectedCharacter = null;
    this.userInteracted = false;

    console.log('[Menu] Constructor called. Initializing elements...');
    this.initializeElements();
    console.log('[Menu] Adding event listeners...');
    this.addEventListeners();
    console.log('[Menu] Instance created.');
  }

  initializeElements() {
    this.menuContainer = document.querySelector('.menu-container');
    if (!this.menuContainer) console.error('[Menu] CRITICAL: .menu-container not found!');

    this.settingsButton = document.querySelector('.settings-button');
    this.playButton = document.querySelector('.play-button');
    this.characterButton = document.querySelector('.character-button');

    if (!this.playButton) console.warn('[Menu] .play-button not found.');
    if (!this.characterButton) console.warn('[Menu] .character-button not found.');

    this.settingsPanel = document.querySelector('.settings-panel');
    if (this.settingsPanel) {
      // ***************************************************************
      // *** Move panel to body to ensure correct stacking context ***
      if (this.settingsPanel.parentNode !== document.body) {
        document.body.appendChild(this.settingsPanel);
        console.log('[Menu Debug] Moved .settings-panel to document.body');
      }
      // ***************************************************************
      this.musicVolume = this.settingsPanel.querySelector('#music-volume');
      this.sfxVolume = this.settingsPanel.querySelector('#sfx-volume');
      this.closeSettingsButton = this.settingsPanel.querySelector('.panel-close-button');
      if (!this.musicVolume) console.warn('[Menu] #music-volume not found in .settings-panel');
      if (!this.sfxVolume) console.warn('[Menu] #sfx-volume not found in .settings-panel');
      if (!this.closeSettingsButton)
        console.warn('[Menu] .panel-close-button not found in .settings-panel');
    } else {
      console.warn('[Menu] .settings-panel not found.');
    }

    this.characterPanel = document.querySelector('.character-panel');
    if (this.characterPanel) {
      // ***************************************************************
      // *** Move panel to body to ensure correct stacking context ***
      if (this.characterPanel.parentNode !== document.body) {
        document.body.appendChild(this.characterPanel);
        console.log('[Menu Debug] Moved .character-panel to document.body');
      }
      // ***************************************************************
      this.characterGrid = this.characterPanel.querySelector('.character-grid');
      if (!this.characterGrid) {
        console.warn('[Menu] .character-grid not found in .character-panel');
      } else {
        this.characterGrid.addEventListener('click', (event) => {
          console.log('[Menu Debug] Character grid clicked. Target:', event.target);
          const clickedCard = event.target.closest('.character-card');
          console.log('[Menu Debug] Clicked card element:', clickedCard);

          if (this.characterPanel) {
            console.log(
              '[Menu Debug] Character panel current classList:',
              this.characterPanel.classList.value
            );
            console.log(
              '[Menu Debug] Character panel .visible class present?:',
              this.characterPanel.classList.contains('visible')
            );
          } else {
            console.error(
              '[Menu Debug] CRITICAL: this.characterPanel is null/undefined inside characterGrid click listener.'
            );
          }

          if (
            clickedCard &&
            this.characterPanel &&
            this.characterPanel.classList.contains('visible')
          ) {
            console.log(
              '[Menu Debug] Conditions for selectCharacter met. Calling selectCharacter...'
            );
            this.handleFirstInteraction();
            this.selectCharacter(clickedCard);
          } else {
            console.warn('[Menu Debug] Conditions for selectCharacter NOT met.');
            if (!clickedCard)
              console.log(
                '[Menu Debug] Reason: No .character-card found at or above the click target.'
              );
            if (!this.characterPanel)
              console.log('[Menu Debug] Reason: this.characterPanel is null/undefined.');
            if (this.characterPanel && !this.characterPanel.classList.contains('visible')) {
              console.log('[Menu Debug] Reason: Character panel does not have "visible" class.');
            }
          }
        });
      }
      this.closeCharacterPanelButton = this.characterPanel.querySelector('.panel-close-button');
      if (!this.closeCharacterPanelButton)
        console.warn('[Menu] .panel-close-button not found in .character-panel');
    } else {
      console.error('[Menu] CRITICAL: .character-panel not found during initialization!');
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
      console.warn(
        '[Menu] .main-menu-buttons container not found. Appended selectedCharacterDisplay to .menu-container.'
      );
    } else {
      console.error('[Menu] Cannot append selectedCharacterDisplay: no suitable parent found.');
    }
    this.updateSelectedCharacterDisplay();
  }

  handleFirstInteraction() {
    if (!this.userInteracted) {
      this.userInteracted = true;
      console.log('[Menu] First user interaction detected.');
    }
  }

  addEventListeners() {
    const addInteractiveListener = (element, eventType, handlerFn) => {
      if (element) {
        element.addEventListener(eventType, (event) => {
          this.handleFirstInteraction();
          handlerFn(event);
        });
      }
    };

    addInteractiveListener(this.settingsButton, 'click', () => this.toggleSettings());
    addInteractiveListener(this.playButton, 'click', () => this.startGame());
    addInteractiveListener(this.characterButton, 'click', () => this.openCharacterModal());

    if (this.closeSettingsButton) {
      this.closeSettingsButton.addEventListener('click', () => this.closeSettings());
    }
    if (this.closeCharacterPanelButton) {
      this.closeCharacterPanelButton.addEventListener('click', () => this.closeCharacterModal());
    }

    if (this.musicVolume) {
      this.musicVolume.addEventListener('input', (e) => {
        console.log('Music volume changed (audio disabled)');
      });
    }
    if (this.sfxVolume) {
      this.sfxVolume.addEventListener('input', (e) => {
        console.log('SFX volume changed (audio disabled)');
      });
    }
  }

  openCharacterModal() {
    console.log('[Menu Debug] openCharacterModal() called.');
    if (!this.characterPanel || !this.characterGrid) {
      console.warn(
        '[Menu] Character panel or grid not found, cannot open modal. Check initialization logs.'
      );
      return;
    }

    console.log('[Menu] Opening character modal.');
    this.characterPanel.classList.add('visible');
    console.log(
      '[Menu Debug] "visible" class ADDED to characterPanel. Current classes:',
      this.characterPanel.classList.value
    );

    if (this.settingsPanel?.classList.contains('visible')) {
      this.closeSettings();
    }

    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'character-modal-overlay';
      this.overlay.addEventListener('click', (e) => {
        // Only close if the overlay itself (not its children like the panel) is clicked
        if (e.target === this.overlay) {
          console.log('[Menu Debug] Overlay clicked, closing character modal.');
          this.closeCharacterModal();
        } else {
          console.log(
            '[Menu Debug] Click was on something other than overlay itself. Target:',
            e.target
          );
        }
      });
      document.body.appendChild(this.overlay);
      console.log('[Menu Debug] Overlay created and appended to body.');
    }
    this.overlay.classList.add('visible');
    console.log(
      '[Menu Debug] "visible" class ADDED to overlay. Current classes:',
      this.overlay.classList.value
    );
  }

  closeCharacterModal() {
    console.log('[Menu Debug] closeCharacterModal() called.');
    if (this.characterPanel) {
      this.characterPanel.classList.remove('visible');
      console.log(
        '[Menu Debug] "visible" class REMOVED from characterPanel. Current classes:',
        this.characterPanel.classList.value
      );
    }
    if (this.overlay) {
      this.overlay.classList.remove('visible');
      console.log(
        '[Menu Debug] "visible" class REMOVED from overlay. Current classes:',
        this.overlay.classList.value
      );
    }
    console.log('[Menu] Character modal closed.');
  }

  selectCharacter(cardElement) {
    console.log('[Menu Debug] selectCharacter() called with card:', cardElement);
    if (!this.characterGrid || !cardElement?.dataset?.character) {
      console.warn(
        '[Menu] Cannot select character: invalid card or missing data attribute. Grid:',
        this.characterGrid,
        'Card:',
        cardElement
      );
      return;
    }

    console.log(`[Menu] Character selected: ${cardElement.dataset.character}`);

    this.characterGrid
      .querySelectorAll('.character-card')
      .forEach((c) => c.classList.remove('selected'));

    cardElement.classList.add('selected');
    this.selectedCharacter = cardElement.dataset.character;

    if (this.playButton) {
      this.playButton.disabled = false;
      console.log('[Menu] Play button enabled.');
    } else {
      console.warn('[Menu] Play button not found to enable.');
    }

    this.updateSelectedCharacterDisplay();
    this.closeCharacterModal();
  }

  updateSelectedCharacterDisplay() {
    if (!this.selectedCharacterDisplay) {
      console.warn(
        '[Menu Debug] updateSelectedCharacterDisplay: selectedCharacterDisplay element not found.'
      );
      return;
    }
    console.log(
      '[Menu Debug] updateSelectedCharacterDisplay() called. Selected character:',
      this.selectedCharacter
    );

    if (this.selectedCharacter && this.characterGrid) {
      const selectedCardElement = this.characterGrid.querySelector(
        `.character-card[data-character="${this.selectedCharacter}"]`
      );
      if (selectedCardElement) {
        const imgElement = selectedCardElement.querySelector('img');
        const nameElement = selectedCardElement.querySelector('h3');
        const imgSrc = imgElement ? imgElement.src : '';
        const name = nameElement ? nameElement.textContent : 'Character';

        this.selectedCharacterDisplay.innerHTML = `<img src="${imgSrc}" alt="${name}" style="width:40px;height:40px;vertical-align:middle;margin-right:0.75rem; border-radius:50%; object-fit:cover; background-color: #333;"> <span>${name}</span>`;
        console.log(`[Menu] Updated display for: ${name}`);
      } else {
        this.selectedCharacterDisplay.innerHTML = `<span style="color:#aaa;">Selected character data not found in grid.</span>`;
        console.warn(
          `[Menu] Could not find .character-card[data-character="${this.selectedCharacter}"] in characterGrid for display update.`
        );
      }
    } else {
      this.selectedCharacterDisplay.innerHTML =
        '<span style="color:#aaa;">No character selected</span>';
      if (!this.characterGrid)
        console.warn('[Menu Debug] updateSelectedCharacterDisplay: characterGrid not found.');
    }
  }

  toggleSettings() {
    if (!this.settingsPanel) {
      console.warn('[Menu Debug] toggleSettings: settingsPanel not found.');
      return;
    }
    console.log('[Menu] Toggling settings panel.');
    const isVisible = this.settingsPanel.classList.contains('visible');
    if (isVisible) {
      this.closeSettings();
    } else {
      this.openSettings();
    }
  }

  openSettings() {
    if (this.settingsPanel) {
      console.log('[Menu] Opening settings panel.');
      this.settingsPanel.classList.add('visible');
      if (this.characterPanel?.classList.contains('visible')) {
        this.closeCharacterModal();
      }
    } else {
      console.warn('[Menu Debug] openSettings: settingsPanel not found.');
    }
  }

  closeSettings() {
    if (this.settingsPanel && this.settingsPanel.classList.contains('visible')) {
      console.log('[Menu] Closing settings panel.');
      this.settingsPanel.classList.remove('visible');
    }
  }

  async startGame() {
    if (!this.selectedCharacter) {
      UIManager.flashMessage('Please select a character first!', 'warning', 2500);
      console.warn('[Menu] startGame: No character selected.');
      return;
    }
    console.log('[Menu] Preparing to start game.');

    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) loadingOverlay.classList.add('visible');

    if (this.menuContainer) {
      this.menuContainer.classList.add('hidden');
    } else {
      console.error('[Menu] CRITICAL: .menu-container not found for hiding!');
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      return;
    }

    console.log(`[Menu] Attempting to start game with character: ${this.selectedCharacter}`);
    try {
      if (currentGameInstance?.stopGame) {
        currentGameInstance.stopGame();
      }
      currentGameInstance = new Game(this.selectedCharacter);
    } catch (error) {
      console.error('[Menu] Critical error during game initialization:', error);
      UIManager.flashMessage(`Game Start Failed: ${error.message}`, 'error', 10000);
      if (this.menuContainer) this.menuContainer.classList.remove('hidden'); // Should be remove hidden on fail
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      currentGameInstance = null;
    }
  }
}
export { Menu };
