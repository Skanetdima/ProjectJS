// src/UI/Menu.js
import { Game } from '../Core/Game.js'; // Убедись, что путь к Game.js верный
import { UIManager } from './UIManager.js'; // UIManager для flash-сообщений и загрузочного оверлея

let currentGameInstance = null; // Переменная для хранения текущего экземпляра игры

export class Menu {
  constructor(characterImageSources) {
    this.characterImageSources = characterImageSources;
    this.selectedCharacter = null;
    this.userInteracted = false; // Для отслеживания первого взаимодействия
    this.overlay = null; // Оверлей для модальных окон
    this.audioManagerInstance = null; // Для хранения экземпляра AudioManager

    console.log('[Menu] Constructor called. Initializing elements...');
    this.initializeElements();

    if (this.characterPanel && this.characterGrid) {
      // Проверка characterGrid важна
      this.setupCharacterImages();
    } else {
      console.error(
        '[Menu Constructor] CRITICAL: characterPanel or characterGrid is null AFTER initializeElements. Cannot setup images.'
      );
    }

    console.log('[Menu] Adding event listeners...');
    this.addEventListeners();
    this.show(); // Показываем меню при инициализации
    console.log('[Menu] Instance created and displayed.');
  }

  // Метод для получения AudioManager из Game.js
  setAudioManager(audioManager) {
    this.audioManagerInstance = audioManager;
    console.log('[Menu] AudioManager instance received in Menu.');
    if (this.musicVolume && this.audioManagerInstance) {
      this.musicVolume.value = this.audioManagerInstance.getMusicVolume() * 100;
    } else if (this.musicVolume) {
      // Если AudioManager еще не пришел, но слайдер есть, установим значение из localStorage
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
      return; // Прерываем, если нет основного контейнера
    }

    this.settingsButton = this.menuContainer.querySelector('.settings-button');
    this.playButton = this.menuContainer.querySelector('.play-button');
    this.characterButton = this.menuContainer.querySelector('.character-button');

    if (!this.playButton) console.warn('[Menu Init] .play-button not found.');
    else this.playButton.disabled = true;

    if (!this.characterButton) console.warn('[Menu Init] .character-button not found.');
    if (!this.settingsButton) console.warn('[Menu Init] .settings-button not found.');

    // Панели лучше искать по всему документу, если они не вложены в .menu-container
    this.settingsPanel = document.querySelector('.settings-panel');
    if (this.settingsPanel) {
      // Если панель не в body, перемещаем ее туда для корректного позиционирования fixed
      if (
        this.settingsPanel.parentNode !== document.body &&
        this.settingsPanel.parentNode !== this.menuContainer /* allow if nested */
      ) {
        document.body.appendChild(this.settingsPanel.parentNode.removeChild(this.settingsPanel));
      }
      this.musicVolume = this.settingsPanel.querySelector('#music-volume');
      this.sfxVolume = this.settingsPanel.querySelector('#sfx-volume'); // Оставим, если понадобится
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

    // Создаем или находим элемент для отображения выбранного персонажа
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
        // Вставляем перед второй кнопкой (предполагая, что это Play) или в конец
        displayContainer.insertBefore(
          this.selectedCharacterDisplay,
          displayContainer.children[1] || null
        );
      } else {
        this.menuContainer.appendChild(this.selectedCharacterDisplay); // крайний случай
      }
    }
    this.updateSelectedCharacterDisplay(); // Обновляем текст по умолчанию
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

  // Обработка первого взаимодействия для политики автовоспроизведения
  handleFirstInteraction() {
    if (!this.userInteracted) {
      this.userInteracted = true;
      console.log('[Menu] First user interaction recorded.');
      // AudioManager будет создан в Game, но это взаимодействие важно для браузера
    }
  }

  addEventListeners() {
    const addInteractiveListener = (element, eventType, handlerFn) => {
      if (element) {
        element.addEventListener(eventType, (event) => {
          this.handleFirstInteraction(); // Регистрируем взаимодействие
          handlerFn.call(this, event); // Вызываем обработчик
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
      // Устанавливаем начальное значение из localStorage, если AudioManager еще не пришел
      if (!this.audioManagerInstance) {
        const savedVolume = localStorage.getItem('musicVolume');
        if (savedVolume !== null) {
          this.musicVolume.value = parseFloat(savedVolume) * 100;
        } else {
          this.musicVolume.value = 50; // Дефолтное значение громкости
        }
      }

      this.musicVolume.addEventListener('input', (e) => {
        this.handleFirstInteraction(); // Громкость тоже взаимодействие
        const newVolume = parseFloat(e.target.value) / 100;
        if (this.audioManagerInstance) {
          this.audioManagerInstance.setMusicVolume(newVolume);
          console.log(`[Menu] Music volume changed via slider to: ${newVolume}`);
        } else {
          // Если AudioManager еще не здесь, сохраняем в localStorage, Game->AudioManager подхватит
          localStorage.setItem('musicVolume', newVolume.toString());
          console.warn(
            '[Menu] Music volume slider changed, AudioManager not available. Saved to localStorage.'
          );
        }
      });
    }

    if (this.sfxVolume) {
      /* ... обработчик для SFX ... */
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

      // Пытаемся получить более полное имя из карточки
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
    this._ensureOverlay().classList.add('visible'); // Показываем оверлей и для настроек

    if (this.musicVolume && this.audioManagerInstance) {
      this.musicVolume.value = this.audioManagerInstance.getMusicVolume() * 100;
    } else if (this.musicVolume) {
      const savedVolume = localStorage.getItem('musicVolume');
      this.musicVolume.value = savedVolume ? parseFloat(savedVolume) * 100 : 50;
    }
  }

  closeSettings() {
    this.settingsPanel?.classList.remove('visible');
    this.overlay?.classList.remove('visible'); // Скрываем оверлей
  }

  _ensureOverlay() {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.className = 'ui-modal-overlay'; // Общий класс для оверлея
      this.overlay.addEventListener('click', (e) => {
        // Закрываем активную модалку при клике на оверлей
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

    const loadingOverlay = UIManager.getLoadingOverlay(); // UIManager управляет им
    if (loadingOverlay) loadingOverlay.classList.add('visible');

    this.hide(); // Скрываем меню

    const gameCanvas = document.getElementById('game-canvas');
    if (gameCanvas) {
      gameCanvas.style.display = 'block'; // Показываем канвас
    } else {
      console.error('[Menu] CRITICAL: #game-canvas not found!');
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      this.show(); // Показываем меню обратно, если канваса нет
      return;
    }

    try {
      // Если есть старая игра, останавливаем её (хотя reload на Game Over лучше)
      if (currentGameInstance && typeof currentGameInstance.stopGame === 'function') {
        console.log('[Menu] Stopping previous game instance.');
        currentGameInstance.stopGame(); // Это покажет Game Over экран старой игры
        currentGameInstance = null; // Очищаем ссылку
        // Может потребоваться небольшая задержка, чтобы DOM старой игры успел очиститься,
        // но обычно reload() на Game Over решает эту проблему лучше.
      }

      console.log(`[Menu] Creating new Game instance with character: ${this.selectedCharacter}`);
      currentGameInstance = new Game(this.selectedCharacter); // Передаем цвет

      // В конструкторе Game создается AudioManager. Game должен передать его обратно в Menu.
      // Для этого в Game.js должен быть вызов menuInstance.setAudioManager(this.audioManager);
      // Это требует, чтобы Game знал о menuInstance. Проще, если Game сам управляет UI громкости
      // через UIManager, или если Menu напрямую использует localStorage для начальной установки громкости,
      // а AudioManager при старте читает из localStorage.

      // ВАЖНО: Game.js должен сам вызвать свой triggerGameStart() после своей инициализации.
      // Menu.js просто создает экземпляр Game.
      // Если Game не запускает triggerGameStart() автоматически из конструктора (что сейчас так),
      // то Menu должен его вызвать:
      if (currentGameInstance && typeof currentGameInstance.triggerGameStart === 'function') {
        await currentGameInstance.triggerGameStart(); // Запускаем процесс загрузки и старта игры
      } else {
        throw new Error('Game instance created, but triggerGameStart is not available.');
      }

      // После успешного currentGameInstance.triggerGameStart()
      // loadingOverlay будет скрыт внутри логики Game.js
    } catch (error) {
      console.error('[Menu] Error during game initialization or start:', error);
      UIManager.flashMessage(`Game Start Failed: ${error.message}`, 'error', 10000);
      if (loadingOverlay) loadingOverlay.classList.remove('visible');
      this.show(); // Показываем меню обратно
      if (gameCanvas) gameCanvas.style.display = 'none'; // Скрываем канвас
      currentGameInstance = null;
    }
  }

  show() {
    if (this.menuContainer) this.menuContainer.style.display = 'flex'; // или 'block'
    // Убедимся, что игровые элементы скрыты, если показываем меню
    const gameCanvas = document.getElementById('game-canvas');
    if (gameCanvas) gameCanvas.style.display = 'none';
    UIManager.hideGameUI(); // Скрывает контролы, очки, таймер
    UIManager.hideGameOverScreen();
    // Загрузочный оверлей тоже лучше скрыть, если мы в меню
    const loadingOverlay = UIManager.getLoadingOverlay();
    if (loadingOverlay) loadingOverlay.classList.remove('visible');
  }

  hide() {
    if (this.menuContainer) this.menuContainer.style.display = 'none';
  }
}

// Экспортируем Menu и currentGameInstance (если он нужен где-то еще, хотя лучше избегать глобальных ссылок)
export { currentGameInstance };
