// src/core/GameplayManager.js
import {
  GameState,
  LIFT_COOLDOWN_MS,
  questions,
  TILE_LIFT,
  TILE_WALL,
  TILE_CORRIDOR,
  TILE_ROOM_FLOOR,
} from '../utils/constants.js';
// Używamy poprawnej wielkości liter w nazwie folderu/pliku: UI/UIManager.js
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';

export class GameplayManager {
  constructor(game) {
    this.game = game;
    // Powiąż metody, które będą używane jako callbacki
    this.handleAnswer = this.handleAnswer.bind(this);
    this.handleFloorSelection = this.handleFloorSelection.bind(this);
  }

  // Wywoływane przez pętlę gry (Game's gameLoop)
  update(timestamp) {
    // Aktualizuj tylko, jeśli gra jest w stanie PLAYING
    if (this.game.gameState === GameState.PLAYING) {
      this.updatePlayingState(timestamp);
    }
  }

  updatePlayingState(timestamp) {
    const char = this.game.character;
    // Sprawdzenie obecności wymaganych komponentów
    if (!this.game.level?.currentMap || !char || !this.game.inputManager) return;

    // Obsługa ruchu
    const { moved } = this.handleMovement();

    // Aktualizacja animacji postaci
    if (char && typeof char.updateAnimation === 'function') {
      char.updateAnimation(timestamp);
    }

    // Obsługa interakcji, tylko jeśli postać nie poruszyła się w tej klatce
    // i gra jest w stanie PLAYING
    if (!moved && this.game.gameState === GameState.PLAYING) {
      this.handleInteractions();
    }

    // ! WAŻNE: Sprawdzenie utknięcia po KAŻDEJ klatce, jeśli się nie ruszał
    // Może to być nadmierne, ale może pomóc, jeśli postać powoli "wciska się" w ścianę
    // Jednak główne sprawdzenie odbywa się po teleportacji w handleLiftTransition
    // if (!moved && this.game.gameState === GameState.PLAYING) {
    //    this.ensureCharacterIsOnWalkableTile(false); // Sprawdzamy, czy nie utknął
    // }
  }

  handleMovement() {
    const char = this.game.character;
    const map = this.game.level.currentMap;
    const input = this.game.inputManager;
    if (!char || !map || !input) return { moved: false };

    const direction = input.getInputDirection();
    let dx = direction.x * char.speed;
    let dy = direction.y * char.speed;

    const intendedMove = dx !== 0 || dy !== 0;
    let actualMoveX = 0;
    let actualMoveY = 0;
    let moved = false;

    if (intendedMove) {
      // Sprawdzamy możliwość ruchu osobno dla X i Y
      const canMoveX = dx !== 0 && !this.checkCollision(char.x + dx, char.y);
      const canMoveY = dy !== 0 && !this.checkCollision(char.x, char.y + dy);

      // Ustawiamy faktyczne przesunięcie
      if (canMoveX) actualMoveX = dx;
      if (canMoveY) actualMoveY = dy;

      // Obsługa kolizji diagonalnej: jeśli nie możemy ruszyć się po przekątnej,
      // ale możemy osobno po X i Y, priorytet ma ruch poziomy.
      // Ulepszona logika: próbujemy ślizgać się wzdłuż ściany
      if (dx !== 0 && dy !== 0) {
        // Tylko jeśli próbowaliśmy ruszyć się po przekątnej
        if (this.checkCollision(char.x + dx, char.y + dy)) {
          // Jeśli przekątna jest zablokowana
          if (canMoveX) {
            // Jeśli możemy po X, ale nie po przekątnej
            actualMoveY = 0; // Ruszamy się tylko po X
          } else if (canMoveY) {
            // Jeśli możemy po Y, ale nie po przekątnej
            actualMoveX = 0; // Ruszamy się tylko po Y
          } else {
            // Jeśli nie możemy ani po X, ani po Y z pozycji diagonalnej
            actualMoveX = 0;
            actualMoveY = 0;
          }
        }
      }

      // Stosujemy faktyczne przesunięcie i aktualizujemy stan
      if (actualMoveX !== 0 || actualMoveY !== 0) {
        char.x += actualMoveX;
        char.y += actualMoveY;
        moved = true;

        // Aktualizujemy kierunek sprite'a postaci
        if (Math.abs(actualMoveX) >= Math.abs(actualMoveY)) {
          if (actualMoveX !== 0)
            char.currentDirection =
              actualMoveX > 0 ? Character.Direction.RIGHT : Character.Direction.LEFT;
        } else {
          if (actualMoveY !== 0)
            char.currentDirection =
              actualMoveY > 0 ? Character.Direction.DOWN : Character.Direction.UP;
        }

        // ! Dodatkowe sprawdzenie PO ruchu, aby wypchnąć, jeśli lekko weszliśmy w ścianę
        // this.ensureCharacterIsOnWalkableTile(false);
      }
    }

    // Ustawiamy flagę ruchu dla animacji
    char.isMoving = moved;
    return { moved };
  }

  checkCollision(targetX, targetY) {
    const map = this.game.level?.currentMap;
    const char = this.game.character;
    if (!map || !char) return true; // Uznajemy za kolizję, jeśli brakuje mapy lub postaci

    const collisionBox = char.getCollisionBox(targetX, targetY);

    // Kluczowe punkty kolidera do sprawdzenia
    const pointsToCheck = [
      { x: collisionBox.left, y: collisionBox.top }, // Lewy górny
      { x: collisionBox.right, y: collisionBox.top }, // Prawy górny
      { x: collisionBox.left, y: collisionBox.bottom }, // Lewy dolny
      { x: collisionBox.right, y: collisionBox.bottom }, // Prawy dolny
      { x: targetX, y: collisionBox.bottom }, // Środek dolny (ważne dla wąskich przejść)
      { x: targetX, y: collisionBox.top }, // Środek górny
      { x: collisionBox.left, y: targetY + char.renderSize * char.collisionBoxFeetOffsetRatio }, // Środek lewy (na poziomie stóp)
      { x: collisionBox.right, y: targetY + char.renderSize * char.collisionBoxFeetOffsetRatio }, // Środek prawy (na poziomie stóp)
    ];

    // Sprawdzamy każdy punkt
    for (const point of pointsToCheck) {
      // Używamy metody mapy isWalkable do sprawdzenia przechodności punktu
      if (!map.isWalkable(point.x, point.y)) {
        // console.log(`Wykryto kolizję w świecie (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        return true; // Znaleziono kolizję
      }
    }

    return false; // Kolizji nie znaleziono
  }

  handleInteractions() {
    const map = this.game.level?.currentMap;
    const char = this.game.character;
    if (!map || !char || this.game.gameState !== GameState.PLAYING) return;

    // 1. Sprawdzenie książek
    const nearbyBook = map.findNearbyUnansweredBook(char.x, char.y);
    if (nearbyBook) {
      this.initiateQuestion(nearbyBook);
      return; // Wychodzimy, ponieważ interakcja z książką się rozpoczęła
    }

    // 2. Sprawdzenie windy (tylko jeśli cooldown nie jest aktywny)
    if (!this.game.liftCooldownActive) {
      const nearbyLift = map.findNearbyLift(char.x, char.y);
      if (nearbyLift) {
        this.initiateFloorSelection();
        // Nie potrzeba return, ponieważ initiateFloorSelection tylko pokazuje UI
      }
    }
  }

  initiateQuestion(book) {
    if (this.game.gameState !== GameState.PLAYING) return;

    this.game.setGameState(GameState.ASKING_QUESTION);
    if (this.game.character) this.game.character.isMoving = false; // Zatrzymujemy postać
    this.game.currentBookTarget = book; // Zapamiętujemy książkę

    // Aktualizujemy listę dostępnych pytań, jeśli jest pusta
    if (this.game.availableQuestions.length === 0) {
      this.game.availableQuestions = [...questions]; // Kopiujemy pierwotny array
      if (this.game.availableQuestions.length === 0) {
        // Skrajny przypadek: pytania się skończyły również w pierwotnym arrayu
        UIManager.flashMessage('Błąd: Brak dostępnych pytań!', 'error');
        this.game.setGameState(GameState.PLAYING);
        this.game.currentBookTarget = null;
        return;
      }
    }

    // Wybieramy losowe pytanie spośród dostępnych
    const qIndex = Math.floor(Math.random() * this.game.availableQuestions.length);
    this.game.currentQuestionData = this.game.availableQuestions.splice(qIndex, 1)[0]; // Wyciągamy pytanie

    // Pokazujemy UI pytania (UIManager wywoła handleAnswer tego managera)
    UIManager.showQuestion(this.game.currentQuestionData);
  }

  handleAnswer(selectedOptionIndex) {
    const { gameState, currentQuestionData, currentBookTarget, level } = this.game;

    // Sprawdzenie, czy jesteśmy w odpowiednim stanie i czy są dane pytania/książki
    if (gameState !== GameState.ASKING_QUESTION || !currentQuestionData || !currentBookTarget) {
      UIManager.hideQuestion(); // Na wszelki wypadek ukrywamy UI
      this.game.currentBookTarget = null;
      this.game.currentQuestionData = null;
      // Wracamy do gry, tylko jeśli gra nie jest zakończona
      if (this.game.gameState !== GameState.GAME_OVER) this.game.setGameState(GameState.PLAYING);
      return;
    }

    const isCorrect = selectedOptionIndex === currentQuestionData.correctAnswer;

    if (isCorrect) {
      UIManager.flashMessage('Prawidłowo!', 'success', 1500);
      // Oznaczamy książkę jako zebraną na mapie
      const collected = level?.currentMap?.markBookAsCollected(currentBookTarget);
      if (collected) {
        this.game.totalBooksCollectedGlobally++;
        UIManager.updateScore(this.game.totalBooksCollectedGlobally, this.game.targetBooksToWin);
        // Sprawdzenie warunku zwycięstwa
        if (this.game.totalBooksCollectedGlobally >= this.game.targetBooksToWin) {
          UIManager.hideQuestion(); // Ukryj UI przed ekranem zwycięstwa
          this.game._setGameOver(true); // Wywołujemy zakończenie gry zwycięstwem
          return; // Wyjście, ponieważ gra zakończona
        }
      } else {
        UIManager.flashMessage('Błąd zbierania książki!', 'error');
      }
    } else {
      UIManager.flashMessage('Nieprawidłowa odpowiedź!', 'error');
      // Zwracamy pytanie, na które odpowiedziano nieprawidłowo, z powrotem do puli
      this.game.availableQuestions.push(currentQuestionData);
    }

    // Ukrywamy UI pytania i resetujemy stan
    UIManager.hideQuestion();
    this.game.currentBookTarget = null;
    this.game.currentQuestionData = null;
    // Wracamy do gry, tylko jeśli gra nie jest zakończona
    if (this.game.gameState !== GameState.GAME_OVER) {
      this.game.setGameState(GameState.PLAYING);
    }
  }

  initiateFloorSelection() {
    // Nie można wywołać windy podczas pytania, przejścia lub jeśli cooldown jest aktywny
    if (this.game.gameState !== GameState.PLAYING || this.game.liftCooldownActive) return;

    this.game.setGameState(GameState.SELECTING_FLOOR);
    if (this.game.character) this.game.character.isMoving = false; // Zatrzymujemy postać

    // Pokazujemy UI wyboru piętra (UIManager wywoła handleFloorSelection)
    UIManager.showFloorSelectionUI(
      this.game.level.minFloor,
      this.game.level.maxFloor,
      this.game.level.currentFloor
    );
  }

  handleFloorSelection(selectedFloor) {
    // Sprawdzenie, czy jesteśmy w stanie wyboru piętra
    if (this.game.gameState !== GameState.SELECTING_FLOOR) {
      UIManager.hideFloorSelectionUI(); // Ukrywamy UI na wszelki wypadek
      return;
    }

    UIManager.hideFloorSelectionUI(); // Ukrywamy UI wyboru

    // Sprawdzenie, czy wybrano inne, prawidłowe piętro
    if (
      selectedFloor === this.game.level.currentFloor ||
      selectedFloor < this.game.level.minFloor ||
      selectedFloor > this.game.level.maxFloor
    ) {
      // Jeśli wybrano bieżące lub nieprawidłowe piętro, po prostu wracamy do gry
      this.game.setGameState(GameState.PLAYING);
      return;
    }

    // Uruchamiamy asynchroniczny proces przejścia na inne piętro
    this.handleLiftTransition(selectedFloor).catch((err) => {
      // Łapiemy błędy przejścia i traktujemy jako krytyczne
      this.game._handleFatalError(`Błąd przejścia na piętro: ${err.message}`);
    });
  }

  async handleLiftTransition(targetFloor) {
    const game = this.game; // Skrót dla wygody

    // Dodatkowe sprawdzenie stanu i cooldownu
    if (game.gameState !== GameState.SELECTING_FLOOR || game.liftCooldownActive) {
      // Jeśli stan już nie jest SELECTING_FLOOR (np. już TRANSITIONING lub PLAYING), wychodzimy
      // Wracamy do PLAYING tylko jeśli gra nie jest zakończona i nie jest w trakcie przejścia
      if (
        game.gameState !== GameState.GAME_OVER &&
        game.gameState !== GameState.PLAYING &&
        game.gameState !== GameState.TRANSITIONING
      ) {
        game.setGameState(GameState.PLAYING);
      }
      return;
    }

    // --- Początek przejścia ---
    game.setGameState(GameState.TRANSITIONING);
    if (game.character) game.character.isMoving = false; // Zatrzymujemy postać
    UIManager.hideQuestion(); // Ukrywamy UI pytania, jeśli było otwarte
    UIManager.hideFloorSelectionUI(); // Upewniamy się jeszcze raz, że UI wyboru piętra jest ukryty
    game.liftCooldownActive = true; // Aktywujemy cooldown
    UIManager.flashMessage(`Przejście na piętro ${targetFloor}...`, 'info', LIFT_COOLDOWN_MS - 200); // Komunikat o przejściu

    try {
      // 1. Asynchronicznie ładujemy mapę nowego piętra
      await game.level.loadFloor(targetFloor, game.canvas.width, game.canvas.height);
      const newMap = game.level.currentMap;
      if (!newMap) {
        throw new Error(
          `Nie udało się załadować mapy dla piętra ${targetFloor}. Obiekt mapy jest null.`
        );
      }

      // 2. Pobieramy pozycję windy na nowej mapie
      const liftPos = newMap.getLiftPosition();
      if (!liftPos) {
        throw new Error(`Brak pozycji windy na załadowanym piętrze ${targetFloor}!`);
      }

      // 3. --- ZMIANA: Znajdź bezpieczne miejsce obok windy ---
      // Szukamy najbliższej bezpiecznej (korytarz/pokój) kratki wokół windy
      const safeSpawnTile = newMap.findNearestWalkableTile(
        liftPos.x,
        liftPos.y,
        3, // Mały promień początkowy
        true // EXCLUDE_LIFT - Nie chcemy lądować na samej windzie
      );

      if (!safeSpawnTile) {
        // Jeśli nie znaleziono blisko, szukamy gdziekolwiek (ale nie windy)
        console.warn(
          `[LiftTransition] Nie znaleziono bezpiecznego miejsca obok windy na (${liftPos.tileX}, ${liftPos.tileY}). Szukam losowego...`
        );
        const emergencySpawn = newMap.findRandomInitialSpawnPosition(); // Ta funkcja już wyklucza windę
        if (!emergencySpawn) {
          throw new Error(
            `Nie można znaleźć ŻADNEGO bezpiecznego miejsca do lądowania na piętrze ${targetFloor}!`
          );
        }
        game.character.x = emergencySpawn.x;
        game.character.y = emergencySpawn.y;
        console.log(
          `[LiftTransition] Awaryjne lądowanie w losowym miejscu: (${game.character.x.toFixed(
            1
          )}, ${game.character.y.toFixed(1)})`
        );
      } else {
        game.character.x = safeSpawnTile.x; // Użyj znalezionego bezpiecznego miejsca
        game.character.y = safeSpawnTile.y;
        console.log(
          `[LiftTransition] Lądowanie obok windy w: (${game.character.x.toFixed(
            1
          )}, ${game.character.y.toFixed(1)})`
        );
      }

      game.character.currentDirection = Character.Direction.DOWN; // Obracamy w dół
      game.character.isMoving = false; // Upewniamy się, że nie ma animacji chodzenia

      // 4. ! NATYCHMIAST centrujemy kamerę na postaci PO ustawieniu pozycji!
      game.renderer?.centerCameraOnCharacter();

      // 5. ! OPCJONALNIE: Dodatkowe sprawdzenie ensureCharacterIsOnWalkableTile, jeśli nadal są problemy
      // this.ensureCharacterIsOnWalkableTile(false); // false, bo nie chcemy stać na windzie

      // 6. Uruchamiamy timer cooldownu (on przywróci stan do PLAYING po zakończeniu)
      game.startLiftCooldownTimer();
    } catch (error) {
      // --- Obsługa błędów przejścia ---
      console.error(`[LiftTransition] Błąd podczas przejścia na piętro ${targetFloor}:`, error);
      game.liftCooldownActive = false; // Resetujemy cooldown przy błędzie

      // Wracamy do stanu gry, jeśli gra nie zakończyła się błędem krytycznym
      if (game.gameState !== GameState.GAME_OVER) {
        game.setGameState(GameState.PLAYING);
      }
      // Traktujemy błąd jako krytyczny (wywoła _setGameOver(false))
      game._handleFatalError(
        `Krytyczny błąd podczas przejścia na piętro ${targetFloor}: ${error.message || error}`
      );
    }
  }

  /**
   * Sprawdza, czy postać znajduje się na przechodniej kratce (lub obok niej).
   * Jeśli postać utknęła (kolider przecina ścianę lub środek na nieprzechodniej kratce),
   * próbuje znaleźć najbliższą BEZPIECZNĄ (nie windę, nie ścianę) przechodnią kratkę
   * i przenieść tam postać.
   * @param {boolean} [allowStandingOnLift=false] - Jeśli true, pozycja NA płytce windy
   * jest uważana za prawidłową dla początkowego sprawdzenia (używane tuż po teleportacji).
   * Zazwyczaj powinno być false, aby wypchnąć postać Z windy.
   */
  ensureCharacterIsOnWalkableTile(allowStandingOnLift = false) {
    const char = this.game.character;
    const map = this.game.level?.currentMap;
    if (!char || !map) return; // Wyjście, jeśli brak postaci lub mapy

    const currentTileX = Math.floor(char.x / map.tileSize);
    const currentTileY = Math.floor(char.y / map.tileSize);

    // Pobieramy typ kafelka pod środkiem postaci (jeśli współrzędne są prawidłowe)
    const currentTileValue =
      currentTileX >= 0 && currentTileX < map.cols && currentTileY >= 0 && currentTileY < map.rows
        ? map.map[currentTileY]?.[currentTileX] // Bezpieczny dostęp
        : TILE_WALL; // Uznajemy za ścianę, jeśli poza mapą

    // Sprawdzenie 1: Czy kratka pod środkiem postaci jest przechodnia?
    // Używamy isWalkable, która obejmuje windę jako przechodnią.
    let isCenterTileWalkableByMap = map.isWalkable(char.x, char.y);
    const isLift = currentTileValue === TILE_LIFT;

    // Określamy, czy bieżąca pozycja jest uważana za "bezpieczną" do stania
    // Bezpiecznie, jeśli:
    // 1. Kratka jest przechodnia według mapy ORAZ nie jest windą (chyba że pozwolono)
    let isSafeToStandHere = isCenterTileWalkableByMap && (!isLift || allowStandingOnLift);

    // Sprawdzenie 2: Czy kolider postaci przecina jakiekolwiek nieprzechodnie kratki?
    const isCollidingWithWall = this.checkCollision(char.x, char.y);

    // Warunek "wypchnięcia":
    // 1. Kolider postaci przecina ścianę (isCollidingWithWall)
    // LUB
    // 2. Pozycja, na której stoi, nie jest uważana za "bezpieczną" (isSafeToStandHere === false)
    const needsNudge = isCollidingWithWall || !isSafeToStandHere;

    if (needsNudge) {
      console.warn(
        `[AntiStuck] Postać w świecie(${char.x.toFixed(1)}, ${char.y.toFixed(
          1
        )}) / kratce(${currentTileX}, ${currentTileY}) utknęła (kolizja: ${isCollidingWithWall}, isSafeToStand: ${isSafeToStandHere}, tileValue: ${currentTileValue}, allowLift: ${allowStandingOnLift}). Próba wypchnięcia.`
      );

      // Szukamy najbliższej BEZPIECZNEJ przechodniej kratki (korytarz lub podłoga pokoju, NIE WINDA)
      // Używamy współrzędnych ŚWIATA do wyszukiwania
      const safeSpot = map.findNearestWalkableTile(
        char.x,
        char.y,
        8, // Maksymalny promień wyszukiwania
        true // EXCLUDE_LIFT = true - szukamy tylko korytarza/pokoju
      );

      if (safeSpot) {
        // Jeśli znaleźliśmy bezpieczne miejsce, przenosimy tam postać
        console.log(
          `[AntiStuck] Wypychamy postać do bezpiecznego miejsca: świat(${safeSpot.x.toFixed(
            1
          )}, ${safeSpot.y.toFixed(1)})`
        );
        char.x = safeSpot.x;
        char.y = safeSpot.y;
        // WAŻNE: Ponownie centrujemy kamerę PO wypchnięciu
        this.game.renderer?.centerCameraOnCharacter();
      } else {
        // Jeśli nie znaleziono bezpiecznego miejsca (bardzo rzadki i zły przypadek)
        console.error(
          `[AntiStuck] BŁĄD KRYTYCZNY: Nie udało się znaleźć bezpiecznego przechodniego miejsca (korytarz/pokój) w pobliżu kratki (${currentTileX}, ${currentTileY})! Postać może pozostać w teksturze.`
        );
        // Wariant awaryjny: Spróbujmy znaleźć JAKIEKOLWIEK przechodnie miejsce (w tym windę) jako ostatnią deskę ratunku
        // Używamy findRandomInitialSpawnPosition jako wyszukiwania losowej NIE-ŚCIANY
        const emergencySpot = map.findRandomInitialSpawnPosition(); // Szuka korytarza lub podłogi (już wyklucza windę)
        if (emergencySpot) {
          console.warn(
            `[AntiStuck] Wyjście awaryjne: Przenosimy na LOSOWĄ bezpieczną kratkę świat(${emergencySpot.x.toFixed(
              1
            )}, ${emergencySpot.y.toFixed(1)})`
          );
          char.x = emergencySpot.x;
          char.y = emergencySpot.y;
          this.game.renderer?.centerCameraOnCharacter();
        } else {
          // Jeśli nawet losowej nie udało się znaleźć - całkowita katastrofa
          console.error(
            '[AntiStuck] W ogóle nie znaleziono bezpiecznych kratek! Gra może być zepsuta.'
          );
          this.game._handleFatalError(
            'Błąd krytyczny: Nie można znaleźć bezpiecznego miejsca dla postaci!'
          );
        }
      }
    }
  }
} // Koniec klasy GameplayManager
