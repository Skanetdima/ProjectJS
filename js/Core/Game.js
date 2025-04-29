// src/core/Game.js
import { InputManager } from './InputManager.js';
// Używamy poprawnej wielkości liter w nazwie folderu/pliku: UI/UIManager.js
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';
import { Level } from './Level.js';
import { GameState, questions, TARGET_BOOKS_TO_WIN, LIFT_COOLDOWN_MS } from '../utils/constants.js';
import { GameRenderer } from './GameRenderer.js';
import { GameplayManager } from './GameplayManager.js';

// Importy zasobów (assets) (ścieżki muszą być poprawne względem pliku HTML)
import redSprite from '../../images/character_red.png';
import blueSprite from '../../images/character_blue.png';
import yellowSprite from '../../images/character_yellow.png';
import greenSprite from '../../images/character_green.png';
import bookSprite from '../../images/book.png';

export class Game {
  constructor(characterColor) {
    console.log(`[Game] Inicjalizacja z postacią: ${characterColor}`);
    this.characterColor = characterColor;
    this._gameState = GameState.LOADING;
    this.isRunning = false;

    // Globalne zmienne gry
    this.totalBooksCollectedGlobally = 0;
    this.targetBooksToWin = TARGET_BOOKS_TO_WIN;
    this.availableQuestions = [];

    // Stan interakcji
    this.currentBookTarget = null;
    this.currentQuestionData = null;
    this.liftCooldownActive = false;
    this.liftCooldownTimer = null;

    // Główne komponenty gry
    this.canvas = null;
    this.ctx = null;
    this.character = null;
    this.level = null;
    this.inputManager = null;
    this.renderer = null;
    this.gameplayManager = null; // Inicjalizowany później

    // Załadowane zasoby (assets)
    this.sprites = { red: redSprite, blue: blueSprite, yellow: yellowSprite, green: greenSprite };
    this.bookImage = null;

    // Powiązanie metod z kontekstem
    this.gameLoop = this.gameLoop.bind(this);
    this._handleFatalError = this._handleFatalError.bind(this);

    // --- Sekwencja inicjalizacji ---
    try {
      this._initializeCoreComponents(); // Synchroniczna inicjalizacja podstawowych menedżerów
      this.renderer = new GameRenderer(this); // Inicjalizacja renderera
      const { canvas, ctx } = this.renderer.initializeCanvas(); // Pobranie canvas i context
      this.canvas = canvas;
      this.ctx = ctx;
      this.gameplayManager = new GameplayManager(this); // Inicjalizacja menedżera rozgrywki (GameplayManager)
      this._addEventListeners(); // Dodanie globalnych nasłuchiwaczy (resize)
      this._loadAssetsAndStart(); // Asynchroniczne ładowanie zasobów i start gry
    } catch (error) {
      console.error('[Game] Inicjalizacja rdzenia nie powiodła się:', error);
      // Pokazujemy alert, ponieważ UI może jeszcze nie być gotowe
      alert(`Krytyczny błąd inicjalizacji: ${error.message}`);
      // Ustawiamy stan błędu bez alertu (już został wyświetlony)
      this._handleFatalError(`Błąd inicjalizacji: ${error.message}`, false);
    }
  }

  // --- Getter/Setter dla stanu gry ---
  get gameState() {
    return this._gameState;
  }
  setGameState(newState) {
    if (this._gameState !== newState) {
      console.log(`[Stan Gry] ${this._gameState} -> ${newState}`);
      this._gameState = newState;
    }
  }

  // Inicjalizacja podstawowych menedżerów
  _initializeCoreComponents() {
    this.inputManager = new InputManager();
    this.level = new Level(1, 3); // Piętra od 1 do 3
  }

  // Dodawanie nasłuchiwaczy zdarzeń okna
  _addEventListeners() {
    // Zmiana rozmiaru canvas jest obsługiwana przez renderer
    window.addEventListener('resize', () => this.renderer?.resizeCanvas());
    // Nasłuchiwacze klawiatury są dodawane w startGame
  }

  // Asynchroniczne ładowanie zasobów i uruchomienie gry
  async _loadAssetsAndStart() {
    try {
      this.setGameState(GameState.LOADING); // Ustawiamy stan ładowania
      await this._loadAssets(); // Oczekujemy na załadowanie wszystkich zasobów
      this._initializeUI(); // Inicjalizujemy UI po załadowaniu (jeśli potrzebne)
      await this.startGame(); // Uruchamiamy główną logikę gry
    } catch (error) {
      console.error(
        '[Game] Ładowanie zasobów / inicjalizacja UI / start gry nie powiodły się:',
        error
      );
      this._handleFatalError(`Błąd ładowania zasobów lub startu gry: ${error.message}`);
    }
  }

  // Ładowanie obrazów (sprite'y, książka)
  async _loadAssets() {
    console.log('[Game] Ładowanie zasobów...');
    const promises = [];
    const spritePath = this.sprites[this.characterColor] || this.sprites.red; // Wybór sprite'a

    // Tworzenie postaci (wymaga ctx)
    if (!this.ctx) throw new Error('Kontekst Canvas niedostępny do utworzenia Postaci.');
    this.character = new Character(this.ctx, spritePath, {
      speed: 3,
      frameSize: 32,
      scale: 2,
      animationSpeed: 150,
      frameCount: 4,
    });
    // Promise do załadowania sprite'a postaci
    promises.push(
      new Promise((resolve, reject) => {
        // Pomyślne załadowanie
        this.character.sprite.onload = () => {
          console.log(`  [Zasoby] Sprite postaci załadowany: ${spritePath}`);
          resolve();
        };
        // Błąd ładowania
        this.character.sprite.onerror = (err) =>
          reject(new Error(`Nie udało się załadować sprite'a postaci: ${spritePath}. ${err}`));
      })
    );

    // Ładowanie obrazu książki
    if (bookSprite) {
      this.bookImage = new Image();
      this.bookImage.src = bookSprite;
      // Promise do załadowania książki
      promises.push(
        new Promise((resolve, reject) => {
          // Pomyślne załadowanie
          this.bookImage.onload = () => {
            console.log(`  [Zasoby] Obraz książki załadowany: ${bookSprite}`);
            resolve();
          };
          // Błąd ładowania (niekrytyczny, istnieje renderowanie zapasowe - fallback)
          this.bookImage.onerror = () => {
            console.warn(
              ` [Zasoby] Nie udało się załadować obrazu książki: ${bookSprite}. Używanie renderowania zapasowego (fallback).`
            );
            this.bookImage = null; // Resetujemy, aby użyć fallback
            resolve(); // Mimo wszystko rozwiązujemy (resolve) promise
          };
        })
      );
    } else {
      console.warn(
        "[Zasoby] Brak ścieżki do sprite'a książki. Używanie renderowania zapasowego (fallback)."
      );
      this.bookImage = null;
    }

    // Oczekujemy na zakończenie wszystkich promisów ładowania
    await Promise.all(promises);
    console.log('[Game] Zasoby załadowane pomyślnie.');
  }

  // Inicjalizacja elementów UI przez UIManager
  _initializeUI() {
    console.log('[Game] Inicjalizacja Menedżera UI...');
    UIManager.createControls(this.inputManager); // Tworzenie przycisków sterowania
    UIManager.createQuestionUI(); // Tworzenie UI dla pytań
    UIManager.createFloorSelectionUI(); // Tworzenie UI do wyboru piętra
    UIManager.ensureFlashMessageContainer(); // Upewniamy się, że kontener wiadomości istnieje
    // ! Kluczowy moment: przekazujemy instancję GameplayManager do UIManager !
    UIManager.setGameplayManager(this.gameplayManager);
    console.log('[Game] Konfiguracja Menedżera UI zakończona.');
  }

  // Główna funkcja startu lub restartu gry
  async startGame() {
    console.log('[Game] Rozpoczynanie gry...');
    // Sprawdzenie obecności wszystkich niezbędnych komponentów
    if (!this.level || !this.character || !this.canvas || !this.renderer || !this.gameplayManager) {
      throw new Error('Nie można rozpocząć gry - brak niezbędnych komponentów.');
    }

    this.setGameState(GameState.LOADING); // Stan ładowania poziomu
    // Ukrywamy cały interfejs użytkownika przed startem
    UIManager.hideGameUI();
    UIManager.hideQuestion();
    UIManager.hideFloorSelectionUI();

    try {
      // 1. Ładujemy początkowe piętro (asynchronicznie)
      await this.level.loadFloor(this.level.minFloor, this.canvas.width, this.canvas.height);
      const currentMap = this.level.currentMap;
      if (!currentMap) {
        throw new Error('Nie udało się załadować początkowej mapy. Obiekt mapy jest null.');
      }

      // 2. Znajdujemy pozycję startową na mapie
      const startPos = currentMap.findRandomInitialSpawnPosition();
      if (!startPos) {
        throw new Error('Nie udało się znaleźć prawidłowej pozycji startowej na mapie!');
      }

      // 3. Ustawiamy początkowe współrzędne i stan postaci
      this.character.x = startPos.x;
      this.character.y = startPos.y;
      this.character.currentDirection = Character.Direction.DOWN;
      this.character.isMoving = false;

      // 4. ! WAŻNE: Sprawdzamy, czy postać nie zespawnowała się od razu w ścianie !
      // Przekazujemy false (lub nie przekazujemy), ponieważ początkowy spawn nie powinien być na windzie
      this.gameplayManager?.ensureCharacterIsOnWalkableTile(false);

      // 5. Resetowanie zmiennych gry
      this.totalBooksCollectedGlobally = 0;
      this.availableQuestions = [...questions]; // Nowy zestaw pytań
      this.liftCooldownActive = false;
      clearTimeout(this.liftCooldownTimer); // Resetowanie timera cooldownu
      this.liftCooldownTimer = null;
      this.currentBookTarget = null;
      this.currentQuestionData = null;

      // 6. Centrujemy kamerę PO ustawieniu pozycji i ewentualnym wypchnięciu
      this.renderer.centerCameraOnCharacter();

      // 7. Aktualizujemy i pokazujemy interfejs gry
      UIManager.updateScore(this.totalBooksCollectedGlobally, this.targetBooksToWin);
      UIManager.showGameUI(); // Pokazujemy canvas, wynik, kontrolki

      // 8. Dodajemy nasłuchiwacze klawiatury
      // Powiązujemy 'this', aby wewnątrz handlerów był dostęp do instancji Game
      this._boundKeyDownHandler = this.handleKeyDown.bind(this);
      this._boundKeyUpHandler = this.handleKeyUp.bind(this);
      window.addEventListener('keydown', this._boundKeyDownHandler);
      window.addEventListener('keyup', this._boundKeyUpHandler);

      // 9. Przełączamy grę w stan aktywny i uruchamiamy pętlę gry
      this.setGameState(GameState.PLAYING);
      if (!this.isRunning) {
        this.isRunning = true;
        requestAnimationFrame(this.gameLoop); // Uruchomienie pętli
        console.log('[Game] Gra rozpoczęta pomyślnie. Pętla działa.');
      }
    } catch (error) {
      // Obsługa błędów podczas startu (ładowanie mapy, szukanie spawnu)
      console.error('[Game] Błąd podczas procesu startGame:', error);
      this._handleFatalError(`Błąd startu poziomu: ${error.message}`);
      this.isRunning = false; // Upewniamy się, że pętla się nie uruchomi
    }
  }

  // Zakończenie gry (wygrana lub błąd)
  _setGameOver(win = true) {
    if (this.gameState === GameState.GAME_OVER) return; // Nie kończymy gry dwukrotnie

    this.setGameState(GameState.GAME_OVER);
    this.isRunning = false; // Zatrzymujemy pętlę gry
    if (this.character) this.character.isMoving = false; // Zatrzymujemy animację postaci
    clearTimeout(this.liftCooldownTimer); // Zatrzymujemy timer windy

    // Usuwamy nasłuchiwacze klawiatury dodane w startGame
    if (this._boundKeyDownHandler) window.removeEventListener('keydown', this._boundKeyDownHandler);
    if (this._boundKeyUpHandler) window.removeEventListener('keyup', this._boundKeyUpHandler);
    this._boundKeyDownHandler = null; // Czyścimy referencje
    this._boundKeyUpHandler = null;

    // Ukrywamy cały interfejs gry
    UIManager.hideGameUI();
    UIManager.hideQuestion();
    UIManager.hideFloorSelectionUI();

    if (win) {
      // Rysujemy ekran zwycięstwa
      requestAnimationFrame(() => this.renderer?.drawWinScreen());
    } else {
      // W przypadku przegranej/błędu pokazujemy menu główne
      // Komunikat o błędzie powinien już zostać pokazany przez _handleFatalError
      const menuContainer = document.getElementById('menu-container');
      if (menuContainer) menuContainer.style.display = 'flex'; // Używamy flex do centrowania
    }
    console.log(`[Game] Koniec Gry. Wygrana: ${win}`);
  }

  // Wymuszone zatrzymanie gry (np. przy wyjściu z gry)
  stopGame() {
    console.log('[Game] Zażądano jawnego zatrzymania.');
    this._setGameOver(false); // Kończymy grę jako przegraną/zatrzymanie

    // Usuwamy ogólne nasłuchiwacze (jeśli nie zostały dodane w startGame)
    window.removeEventListener('resize', () => this.renderer?.resizeCanvas());

    // Zwalniamy zasoby (opcjonalne, ale dobre dla garbage collectora)
    this.character = null;
    this.level = null;
    this.inputManager = null;
    this.renderer = null;
    this.gameplayManager = null;
    this.ctx = null;
    this.canvas = null; // Referencja do elementu pozostaje, ale nie jest już używana w grze
    console.log('[Game] Gra zatrzymana, komponenty potencjalnie wyczyszczone.');
  }

  // Obsługa błędów krytycznych (fatal error)
  _handleFatalError(message, showAlert = true) {
    console.error('[Game] BŁĄD KRYTYCZNY:', message);
    // Pokazujemy alert tylko jeśli zażądano i gra jeszcze się nie zakończyła
    if (showAlert && this.gameState !== GameState.GAME_OVER) {
      alert(message);
    }
    // Kończymy grę jako przegraną
    this._setGameOver(false);
  }

  // --- Handlery (obsługa) wejścia ---
  handleKeyDown(e) {
    // Ignorujemy wejście, jeśli gra nie jest w stanie PLAYING lub brakuje inputManager
    if (this.gameState !== GameState.PLAYING || !this.inputManager) return;

    let keyHandled = false; // Flaga zapobiegająca domyślnemu zachowaniu przeglądarki
    const key = e.key.toLowerCase();

    // Mapowanie klawiszy na akcje
    if (key === 'arrowup' || key === 'w') {
      this.inputManager.setKey('up', true);
      keyHandled = true;
    } else if (key === 'arrowdown' || key === 's') {
      this.inputManager.setKey('down', true);
      keyHandled = true;
    } else if (key === 'arrowleft' || key === 'a') {
      this.inputManager.setKey('left', true);
      keyHandled = true;
    } else if (key === 'arrowright' || key === 'd') {
      this.inputManager.setKey('right', true);
      keyHandled = true;
    }

    // Zapobiegamy przewijaniu strony strzałkami, jeśli klawisz został obsłużony
    if (keyHandled) e.preventDefault();
  }

  handleKeyUp(e) {
    // Zawsze obsługujemy puszczenie klawiszy, aby zresetować stan
    if (!this.inputManager) return;
    const key = e.key.toLowerCase();

    if (key === 'arrowup' || key === 'w') {
      this.inputManager.setKey('up', false);
    } else if (key === 'arrowdown' || key === 's') {
      this.inputManager.setKey('down', false);
    } else if (key === 'arrowleft' || key === 'a') {
      this.inputManager.setKey('left', false);
    } else if (key === 'arrowright' || key === 'd') {
      this.inputManager.setKey('right', false);
    }
  }

  // --- Główna pętla gry ---
  gameLoop(timestamp) {
    // Wychodzimy z pętli, jeśli gra jest zatrzymana lub zakończona
    if (!this.isRunning || this.gameState === GameState.GAME_OVER) {
      return;
    }

    // 1. Aktualizacja logiki gry (ruch, interakcje)
    this.gameplayManager?.update(timestamp);

    // 2. Centrowanie kamery (po aktualizacji pozycji postaci)
    this.renderer?.centerCameraOnCharacter();

    // 3. Rysowanie bieżącej klatki
    this.renderer?.drawFrame();

    // 4. Żądanie następnej klatki animacji
    requestAnimationFrame(this.gameLoop);
  }

  // --- Zarządzanie timerem cooldownu windy ---
  startLiftCooldownTimer() {
    clearTimeout(this.liftCooldownTimer); // Resetujemy poprzedni timer, jeśli istniał
    console.log(`[Game] Uruchamianie timera cooldownu windy ${LIFT_COOLDOWN_MS}ms.`);
    this.liftCooldownTimer = setTimeout(() => {
      this.liftCooldownActive = false; // Zdejmujemy flagę cooldownu
      this.liftCooldownTimer = null; // Czyścimy ID timera
      // Jeśli gra jest nadal w stanie przejścia (TRANSITIONING), oznacza to, że przejście zostało zakończone
      if (this.gameState === GameState.TRANSITIONING) {
        this.setGameState(GameState.PLAYING); // Przywracamy stan gry (PLAYING)
        UIManager.flashMessage(`Przybycie na piętro ${this.level?.currentFloor}`, 'success', 1500);
      } else {
        // Jeśli stan się zmienił (np. GAME_OVER), po prostu logujemy
        console.warn(
          `[Game TIMER] Cooldown windy zakończony, ale stan gry to ${this.gameState}. Nie zastosowano zmiany stanu.`
        );
      }
    }, LIFT_COOLDOWN_MS);
  }
} // Koniec klasy Game
