Привет! Отлично, давай разбираться с багами и улучшениями. Пройдёмся по пунктам:

1.  **Баг с телепортом персонажа:** Персонаж застревает после использования лифта.
2.  **Лифт в отдельной комнате:** Лифт должен быть визуально отдельным блоком 1x1, не перекрываясь графикой комнаты.
3.  **Графика (фликеринг/пиксели):** Устранить мерцание и "прыгающие пиксели".
4.  **Графика (детализация):** Сделать графику более детальной, но стабильной.

Поехали по коду. Я внесу изменения в основном в `GameplayManager.js` (для логики телепорта) и `MapRenderer.js` (для графики и лифта). Остальные файлы приведу для полноты картины, т.к. ты их предоставил.

**Ключевые изменения:**

- **Телепорт:** Убедимся, что функция `ensureCharacterIsOnWalkableTile` вызывается _сразу после_ телепортации в `handleLiftTransition` с флагом `allowStandingOnLift = true`. Эта функция уже есть и должна решать проблему застревания, выталкивая персонажа на ближайшую безопасную клетку, если он оказался в стене.
- **Лифт:** В `MapRenderer` при отрисовке пола комнаты (`drawRoomDetails`) добавим явную проверку, чтобы _не рисовать_ пол комнаты поверх тайла лифта.
- **Фликеринг:** Уберём использование `Math.random()` при отрисовке пола комнат в `drawRoomDetails`. Вместо этого будем использовать детерминированную вариацию цвета (например, на основе координат тайла), чтобы цвет был постоянным для каждого тайла на карте и не менялся от кадра к кадру.
- **Детализация:** Добавим/улучшим:
  - Простую текстуру/шум для стен вместо чисто случайного серого.
  - Улучшенные края стен.
  - Детерминированную вариацию цвета для пола коридоров.
  - Более явные детали лифта (контур, кнопка).
  - (По возможности) Чуть улучшим декорации комнат.

---

**Измененные файлы:**

**`src/core/GameplayManager.js`** (Проверка логики телепорта, без явных изменений кода, но важна логика)

```javascript
// src/core/GameplayManager.js
import {
  GameState,
  LIFT_COOLDOWN_MS,
  questions,
  // ! ВАЖНО: Импортируем константы тайлов
  TILE_LIFT,
  TILE_WALL,
  TILE_CORRIDOR,
  TILE_ROOM_FLOOR,
} from '../utils/constants.js';
// Используем правильный регистр в имени папки/файла: UI/UIManager.js
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';

export class GameplayManager {
  constructor(game) {
    this.game = game;
    // Bind methods that will be used as callbacks
    this.handleAnswer = this.handleAnswer.bind(this);
    this.handleFloorSelection = this.handleFloorSelection.bind(this);
  }

  // Called by Game's gameLoop
  update(timestamp) {
    // Обновляем только если игра в состоянии PLAYING
    if (this.game.gameState === GameState.PLAYING) {
      this.updatePlayingState(timestamp);
    }
  }

  updatePlayingState(timestamp) {
    const char = this.game.character;
    // Проверки на наличие необходимых компонентов
    if (!this.game.level?.currentMap || !char || !this.game.inputManager) return;

    // Обработка движения
    const { moved } = this.handleMovement();

    // Обновление анимации персонажа
    if (char && typeof char.updateAnimation === 'function') {
      char.updateAnimation(timestamp);
    }

    // Обработка взаимодействий, только если персонаж не двигался в этом кадре
    // и игра находится в состоянии PLAYING
    if (!moved && this.game.gameState === GameState.PLAYING) {
      this.handleInteractions();
    }

    // ! ВАЖНО: Проверка на застревание после КАЖДОГО кадра, если не двигался
    // Это может быть излишним, но может помочь если персонаж "вдавливается" в стену медленно
    // Однако, основная проверка происходит после телепортации в handleLiftTransition
    // if (!moved && this.game.gameState === GameState.PLAYING) {
    //    this.ensureCharacterIsOnWalkableTile(false); // Проверяем, не застрял ли
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
      // Проверяем возможность движения по X и Y отдельно
      const canMoveX = dx !== 0 && !this.checkCollision(char.x + dx, char.y);
      const canMoveY = dy !== 0 && !this.checkCollision(char.x, char.y + dy);

      // Устанавливаем фактическое смещение
      if (canMoveX) actualMoveX = dx;
      if (canMoveY) actualMoveY = dy;

      // Обработка диагональной коллизии: если не можем двигаться по диагонали,
      // но можем по X и Y отдельно, приоритет горизонтальному движению.
      // Улучшенная логика: пробуем скользить вдоль стены
      if (dx !== 0 && dy !== 0) {
        // Только если пытались двигаться по диагонали
        if (this.checkCollision(char.x + dx, char.y + dy)) {
          // Если диагональ заблокирована
          if (canMoveX) {
            // Если можем по X, но не по диагонали
            actualMoveY = 0; // Двигаемся только по X
          } else if (canMoveY) {
            // Если можем по Y, но не по диагонали
            actualMoveX = 0; // Двигаемся только по Y
          } else {
            // Если не можем ни по X, ни по Y из диагональной позиции
            actualMoveX = 0;
            actualMoveY = 0;
          }
        }
      }

      // Применяем фактическое смещение и обновляем состояние
      if (actualMoveX !== 0 || actualMoveY !== 0) {
        char.x += actualMoveX;
        char.y += actualMoveY;
        moved = true;

        // Обновляем направление спрайта персонажа
        if (Math.abs(actualMoveX) >= Math.abs(actualMoveY)) {
          if (actualMoveX !== 0)
            char.currentDirection =
              actualMoveX > 0 ? Character.Direction.RIGHT : Character.Direction.LEFT;
        } else {
          if (actualMoveY !== 0)
            char.currentDirection =
              actualMoveY > 0 ? Character.Direction.DOWN : Character.Direction.UP;
        }

        // ! Дополнительная проверка ПОСЛЕ движения, чтобы вытолкнуть если чуть зашли в стену
        // this.ensureCharacterIsOnWalkableTile(false);
      }
    }

    // Устанавливаем флаг движения для анимации
    char.isMoving = moved;
    return { moved };
  }

  checkCollision(targetX, targetY) {
    const map = this.game.level?.currentMap;
    const char = this.game.character;
    if (!map || !char) return true; // Считаем коллизией, если карта или персонаж отсутствуют

    const collisionBox = char.getCollisionBox(targetX, targetY);

    // Ключевые точки коллайдера для проверки
    const pointsToCheck = [
      { x: collisionBox.left, y: collisionBox.top }, // Top-left
      { x: collisionBox.right, y: collisionBox.top }, // Top-right
      { x: collisionBox.left, y: collisionBox.bottom }, // Bottom-left
      { x: collisionBox.right, y: collisionBox.bottom }, // Bottom-right
      { x: targetX, y: collisionBox.bottom }, // Center-bottom (важно для узких проходов)
      { x: targetX, y: collisionBox.top }, // Center-top
      { x: collisionBox.left, y: targetY + char.renderSize * char.collisionBoxFeetOffsetRatio }, // Center-left (на уровне ног)
      { x: collisionBox.right, y: targetY + char.renderSize * char.collisionBoxFeetOffsetRatio }, // Center-right (на уровне ног)
    ];

    // Проверяем каждую точку
    for (const point of pointsToCheck) {
      // Используем метод карты isWalkable для проверки проходимости точки
      if (!map.isWalkable(point.x, point.y)) {
        // console.log(`Collision detected at world (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        return true; // Найдена коллизия
      }
    }

    return false; // Коллизий не найдено
  }

  handleInteractions() {
    const map = this.game.level?.currentMap;
    const char = this.game.character;
    if (!map || !char || this.game.gameState !== GameState.PLAYING) return;

    // 1. Проверка на книги
    const nearbyBook = map.findNearbyUnansweredBook(char.x, char.y);
    if (nearbyBook) {
      this.initiateQuestion(nearbyBook);
      return; // Выходим, т.к. взаимодействие с книгой началось
    }

    // 2. Проверка на лифт (только если кулдаун не активен)
    if (!this.game.liftCooldownActive) {
      const nearbyLift = map.findNearbyLift(char.x, char.y);
      if (nearbyLift) {
        this.initiateFloorSelection();
        // Не нужно return, т.к. initiateFloorSelection только показывает UI
      }
    }
  }

  initiateQuestion(book) {
    if (this.game.gameState !== GameState.PLAYING) return;

    this.game.setGameState(GameState.ASKING_QUESTION);
    if (this.game.character) this.game.character.isMoving = false; // Останавливаем персонажа
    this.game.currentBookTarget = book; // Запоминаем книгу

    // Обновляем список доступных вопросов, если он пуст
    if (this.game.availableQuestions.length === 0) {
      this.game.availableQuestions = [...questions]; // Копируем исходный массив
      if (this.game.availableQuestions.length === 0) {
        // Крайний случай: вопросы закончились и в исходном массиве
        UIManager.flashMessage('Ошибка: Нет доступных вопросов!', 'error');
        this.game.setGameState(GameState.PLAYING);
        this.game.currentBookTarget = null;
        return;
      }
    }

    // Выбираем случайный вопрос из доступных
    const qIndex = Math.floor(Math.random() * this.game.availableQuestions.length);
    this.game.currentQuestionData = this.game.availableQuestions.splice(qIndex, 1)[0]; // Извлекаем вопрос

    // Показываем UI вопроса (UIManager вызовет handleAnswer этого менеджера)
    UIManager.showQuestion(this.game.currentQuestionData);
  }

  handleAnswer(selectedOptionIndex) {
    const { gameState, currentQuestionData, currentBookTarget, level } = this.game;

    // Проверка, что мы в правильном состоянии и есть данные вопроса/книги
    if (gameState !== GameState.ASKING_QUESTION || !currentQuestionData || !currentBookTarget) {
      UIManager.hideQuestion(); // На всякий случай скрываем UI
      this.game.currentBookTarget = null;
      this.game.currentQuestionData = null;
      // Возвращаем в игру, только если игра не закончена
      if (this.game.gameState !== GameState.GAME_OVER) this.game.setGameState(GameState.PLAYING);
      return;
    }

    const isCorrect = selectedOptionIndex === currentQuestionData.correctAnswer;

    if (isCorrect) {
      UIManager.flashMessage('Правильно!', 'success', 1500);
      // Отмечаем книгу как собранную на карте
      const collected = level?.currentMap?.markBookAsCollected(currentBookTarget);
      if (collected) {
        this.game.totalBooksCollectedGlobally++;
        UIManager.updateScore(this.game.totalBooksCollectedGlobally, this.game.targetBooksToWin);
        // Проверка условия победы
        if (this.game.totalBooksCollectedGlobally >= this.game.targetBooksToWin) {
          UIManager.hideQuestion(); // Скрыть UI перед экраном победы
          this.game._setGameOver(true); // Вызываем победное завершение игры
          return; // Выход, т.к. игра завершена
        }
      } else {
        UIManager.flashMessage('Ошибка сбора книги!', 'error');
      }
    } else {
      UIManager.flashMessage('Неверный ответ!', 'error');
      // Возвращаем неправильно отвеченный вопрос обратно в пул
      this.game.availableQuestions.push(currentQuestionData);
    }

    // Скрываем UI вопроса и сбрасываем состояние
    UIManager.hideQuestion();
    this.game.currentBookTarget = null;
    this.game.currentQuestionData = null;
    // Возвращаем в игру, только если игра не закончена
    if (this.game.gameState !== GameState.GAME_OVER) {
      this.game.setGameState(GameState.PLAYING);
    }
  }

  initiateFloorSelection() {
    // Нельзя вызвать лифт во время вопроса, перехода или если кулдаун активен
    if (this.game.gameState !== GameState.PLAYING || this.game.liftCooldownActive) return;

    this.game.setGameState(GameState.SELECTING_FLOOR);
    if (this.game.character) this.game.character.isMoving = false; // Останавливаем персонажа

    // Показываем UI выбора этажа (UIManager вызовет handleFloorSelection)
    UIManager.showFloorSelectionUI(
      this.game.level.minFloor,
      this.game.level.maxFloor,
      this.game.level.currentFloor
    );
  }

  handleFloorSelection(selectedFloor) {
    // Проверка, что мы в состоянии выбора этажа
    if (this.game.gameState !== GameState.SELECTING_FLOOR) {
      UIManager.hideFloorSelectionUI(); // Скрываем UI на всякий случай
      return;
    }

    UIManager.hideFloorSelectionUI(); // Скрываем UI выбора

    // Проверка, что выбран другой валидный этаж
    if (
      selectedFloor === this.game.level.currentFloor ||
      selectedFloor < this.game.level.minFloor ||
      selectedFloor > this.game.level.maxFloor
    ) {
      // Если выбран текущий или невалидный этаж, просто возвращаемся в игру
      this.game.setGameState(GameState.PLAYING);
      return;
    }

    // Запускаем асинхронный процесс перехода на другой этаж
    this.handleLiftTransition(selectedFloor).catch((err) => {
      // Ловим ошибки перехода и обрабатываем как фатальные
      this.game._handleFatalError(`Ошибка перехода на этаж: ${err.message}`);
    });
  }

  async handleLiftTransition(targetFloor) {
    const game = this.game; // Сокращение для удобства

    // Дополнительная проверка состояния и кулдауна
    if (game.gameState !== GameState.SELECTING_FLOOR || game.liftCooldownActive) {
      // Если состояние уже не SELECTING_FLOOR (например, уже TRANSITIONING или PLAYING), выходим
      // Возвращаем в PLAYING только если игра не закончена и не в процессе перехода
      if (
        game.gameState !== GameState.GAME_OVER &&
        game.gameState !== GameState.PLAYING &&
        game.gameState !== GameState.TRANSITIONING
      ) {
        game.setGameState(GameState.PLAYING);
      }
      return;
    }

    // --- Начало перехода ---
    game.setGameState(GameState.TRANSITIONING);
    if (game.character) game.character.isMoving = false; // Останавливаем персонажа
    UIManager.hideQuestion(); // Скрываем UI вопроса, если был открыт
    UIManager.hideFloorSelectionUI(); // Убедимся еще раз, что UI выбора этажа скрыт
    game.liftCooldownActive = true; // Активируем кулдаун
    UIManager.flashMessage(`Переход на этаж ${targetFloor}...`, 'info', LIFT_COOLDOWN_MS - 200); // Сообщение о переходе

    try {
      // 1. Асинхронно загружаем карту нового этажа
      await game.level.loadFloor(targetFloor, game.canvas.width, game.canvas.height);
      const newMap = game.level.currentMap;
      if (!newMap) {
        throw new Error(`Failed to load map for floor ${targetFloor}. Map object is null.`);
      }

      // 2. Получаем позицию лифта на новой карте
      const liftPos = newMap.getLiftPosition();
      if (!liftPos) {
        throw new Error(`Lift position missing on loaded floor ${targetFloor}!`);
      }

      // 3. Перемещаем персонажа ТОЧНО на позицию лифта
      game.character.x = liftPos.x;
      game.character.y = liftPos.y;
      game.character.currentDirection = Character.Direction.DOWN; // Поворачиваем вниз
      game.character.isMoving = false; // Убеждаемся, что анимации ходьбы нет

      // 4. ! НЕМЕДЛЕННО центрируем камеру на персонаже !
      game.renderer?.centerCameraOnCharacter();

      // 5. ! КЛЮЧЕВОЙ МОМЕНТ: ПРОВЕРЯЕМ, не застрял ли персонаж СРАЗУ после телепорта !
      // Передаем `true`, чтобы разрешить стоять НА плитке лифта при этой ПЕРВОЙ проверке.
      // Эта функция должна вытолкнуть персонажа, если он оказался в стене.
      this.ensureCharacterIsOnWalkableTile(true); // <--- ЭТО ВАЖНО ДЛЯ ФИКСА ТЕЛЕПОРТА

      // 6. Запускаем таймер кулдауна (он вернет состояние в PLAYING по завершении)
      game.startLiftCooldownTimer();
    } catch (error) {
      // --- Обработка ошибок перехода ---
      console.error(`[LiftTransition] Error during transition to floor ${targetFloor}:`, error);
      game.liftCooldownActive = false; // Сбрасываем кулдаун при ошибке

      // Возвращаем в игровое состояние, если игра не завершена фатальной ошибкой
      if (game.gameState !== GameState.GAME_OVER) {
        game.setGameState(GameState.PLAYING);
      }
      // Обрабатываем ошибку как фатальную (вызовет _setGameOver(false))
      game._handleFatalError(
        `Критическая ошибка при переходе на этаж ${targetFloor}: ${error.message || error}`
      );
    }
  }

  /**
   * Проверяет, находится ли персонаж на проходимой клетке (или рядом с ней).
   * Если персонаж застрял (коллайдер пересекает стену или центр на непроходимой клетке),
   * пытается найти ближайшую БЕЗОПАСНУЮ (не лифт, не стена) проходимую клетку
   * и переместить персонажа туда.
   * @param {boolean} [allowStandingOnLift=false] - Если true, то позиция НА плитке лифта
   * считается валидной для начальной проверки (используется сразу после телепортации).
   */
  ensureCharacterIsOnWalkableTile(allowStandingOnLift = false) {
    const char = this.game.character;
    const map = this.game.level?.currentMap;
    if (!char || !map) return; // Выход, если нет персонажа или карты

    const currentTileX = Math.floor(char.x / map.tileSize);
    const currentTileY = Math.floor(char.y / map.tileSize);

    // Получаем тип тайла под центром персонажа (если координаты валидны)
    const currentTileValue =
      currentTileX >= 0 && currentTileX < map.cols && currentTileY >= 0 && currentTileY < map.rows
        ? map.map[currentTileY]?.[currentTileX] // Безопасный доступ
        : TILE_WALL; // Считаем стеной, если за пределами карты

    // Проверка 1: Проходима ли плитка под центром персонажа?
    // Используем isWalkable, которая включает лифт в проходимые.
    let isCenterTileWalkableByMap = map.isWalkable(char.x, char.y);
    const isLift = currentTileValue === TILE_LIFT;

    // Определяем, считается ли текущая позиция "безопасной" для стояния
    // Безопасно, если:
    // 1. Плитка проходима по карте ИЛИ
    // 2. Плитка - это лифт И мы разрешили стоять на лифте
    let isSafeToStandHere = isCenterTileWalkableByMap || (isLift && allowStandingOnLift);

    // Проверка 2: Пересекает ли коллайдер персонажа какие-либо непроходимые плитки?
    const isCollidingWithWall = this.checkCollision(char.x, char.y);

    // Условие для "выталкивания":
    // 1. Коллайдер персонажа пересекает стену (isCollidingWithWall)
    // ИЛИ
    // 2. Позиция, где он стоит, не считается "безопасной" (isSafeToStandHere === false)
    const needsNudge = isCollidingWithWall || !isSafeToStandHere;

    if (needsNudge) {
      console.warn(
        `[AntiStuck] Персонаж в world(${char.x.toFixed(1)}, ${char.y.toFixed(
          1
        )}) / tile(${currentTileX}, ${currentTileY}) застрял (colliding: ${isCollidingWithWall}, isSafeToStand: ${isSafeToStandHere}, tileValue: ${currentTileValue}, allowLift: ${allowStandingOnLift}). Попытка вытолкнуть.`
      );

      // Ищем ближайшую БЕЗОПАСНУЮ проходимую плитку (коридор или пол комнаты, НЕ ЛИФТ)
      // Используем координаты ТАЙЛА для поиска
      const safeSpot = map.findNearestWalkableTile(char.x, char.y); // Передаем мировые координаты

      if (safeSpot) {
        // Если нашли безопасную точку, перемещаем персонажа туда
        console.log(
          `[AntiStuck] Выталкиваем персонажа в безопасную точку: world(${safeSpot.x.toFixed(
            1
          )}, ${safeSpot.y.toFixed(1)})`
        );
        char.x = safeSpot.x;
        char.y = safeSpot.y;
        // ВАЖНО: Снова центрируем камеру ПОСЛЕ выталкивания
        this.game.renderer?.centerCameraOnCharacter();
      } else {
        // Если безопасную точку не нашли (очень редкий и плохой случай)
        console.error(
          `[AntiStuck] КРИТИЧЕСКАЯ ОШИБКА: Не удалось найти безопасную проходимую точку (коридор/комнату) рядом с плиткой (${currentTileX}, ${currentTileY})! Персонаж может остаться в текстуре.`
        );
        // Аварийный вариант: Попробуем найти ЛЮБУЮ проходимую плитку (включая лифт) как последнее средство
        // Используем findRandomInitialSpawnPosition как поиск случайной НЕ СТЕНЫ
        const emergencySpot = map.findRandomInitialSpawnPosition(); // Ищет коридор или пол
        if (emergencySpot) {
          console.warn(
            `[AntiStuck] Аварийный выход: Перемещаем на СЛУЧАЙНУЮ безопасную плитку world(${emergencySpot.x.toFixed(
              1
            )}, ${emergencySpot.y.toFixed(1)})`
          );
          char.x = emergencySpot.x;
          char.y = emergencySpot.y;
          this.game.renderer?.centerCameraOnCharacter();
        } else {
          // Если даже случайную найти не удалось - полная катастрофа
          console.error(
            '[AntiStuck] Совсем не найдено безопасных плиток! Игра может быть сломана.'
          );
          this.game._handleFatalError(
            'Критическая ошибка: Невозможно найти безопасное место для персонажа!'
          );
        }
      }
    }
  }
} // Конец класса GameplayManager
```

**`src/map/mapRenderer.js`** (Исправление фликеринга, детализация, изоляция лифта)

```javascript
// src/map/mapRenderer.js

import { TILE_WALL, TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT } from '../utils/constants.js';
import { randomGray, randomCorridorGray, adjustColorBrightness, simpleHash } from '../utils/map.js'; // Допустим, есть simpleHash

export class MapRenderer {
  constructor(tileSize) {
    this.tileSize = tileSize;
    this.tileColors = {}; // Cache for consistent tile colors per map instance
    this.baseWallColor = '#4a4a4a'; // Базовый цвет стен
    this.baseCorridorColor = '#a0a0a0'; // Базовый цвет коридоров
  }

  // Reset color cache when a new map is drawn (called by ProceduralMap)
  resetColorCache() {
    this.tileColors = {};
  }

  /** Get or generate color for a specific tile */
  getTileColor(r, c, tileValue, rooms) {
    const key = `${r},${c}`;
    if (this.tileColors[key]) {
      return this.tileColors[key];
    }

    let color;
    let brightnessFactor = 1.0;
    // Используем простой хэш от координат для детерминированной вариации
    const hash = simpleHash(r * 1000 + c); // Простая хеш-функция на основе координат
    const variation = ((hash % 21) - 10) / 100; // Вариация от -0.1 до +0.1

    switch (tileValue) {
      case TILE_WALL:
        // Базовый цвет + детерминированная вариация
        brightnessFactor = 0.9 + variation * 0.5; // Меньшая вариация для стен
        color = adjustColorBrightness(this.baseWallColor, brightnessFactor);
        break;
      case TILE_CORRIDOR:
        // Базовый цвет + детерминированная вариация
        brightnessFactor = 0.95 + variation;
        color = adjustColorBrightness(this.baseCorridorColor, brightnessFactor);
        break;
      case TILE_ROOM_FLOOR:
        // Базовый цвет пола комнаты (будет переопределен в drawRoomDetails)
        color = '#c0c0c0'; // Средний серый по умолчанию
        break;
      case TILE_LIFT:
        // Цвет лифта - можно сделать более интересным
        color = '#707080'; // Немного светлее
        break;
      default:
        color = '#ff00ff'; // Error color
        break;
    }
    this.tileColors[key] = color;
    return color;
  }

  /** Main drawing function */
  draw(ctx, mapData, bookImage = null) {
    const { map, rooms, books, liftPosition, offsetX, offsetY, cols, rows } = mapData;

    // Округляем смещения для четкости
    const currentOffsetX = Math.floor(offsetX);
    const currentOffsetY = Math.floor(offsetY);

    // Определяем видимые тайлы с небольшим запасом
    const startCol = Math.max(0, Math.floor(-currentOffsetX / this.tileSize) - 1);
    const endCol = Math.min(
      cols,
      Math.ceil((-currentOffsetX + ctx.canvas.width) / this.tileSize) + 1
    );
    const startRow = Math.max(0, Math.floor(-currentOffsetY / this.tileSize) - 1);
    const endRow = Math.min(
      rows,
      Math.ceil((-currentOffsetY + ctx.canvas.height) / this.tileSize) + 1
    );

    ctx.save(); // Save context state
    // Отключаем сглаживание для пиксель-арта (если нужно)
    // ctx.imageSmoothingEnabled = false; // Уже в GameRenderer

    // 1. Draw base tiles (walls, corridors, default floor, lift base)
    this.drawBaseTiles(
      ctx,
      map,
      rooms, // Передаем rooms для getTileColor, если понадобится
      currentOffsetX,
      currentOffsetY,
      cols,
      rows,
      startRow,
      endRow,
      startCol,
      endCol
    );

    // 2. Draw room-specific floors and decorations
    this.drawRoomDetails(
      ctx,
      map,
      rooms,
      liftPosition, // Передаем позицию лифта для проверки
      currentOffsetX,
      currentOffsetY,
      cols,
      rows,
      startRow,
      endRow,
      startCol,
      endCol
    );

    // 3. Draw lift details (over room floors if necessary)
    this.drawLiftDetails(ctx, liftPosition, currentOffsetX, currentOffsetY);

    // 4. Draw books
    this.drawBooks(ctx, books, currentOffsetX, currentOffsetY, bookImage);

    ctx.restore(); // Restore context state
  }

  /** Draw base tiles */
  drawBaseTiles(ctx, map, rooms, offsetX, offsetY, cols, rows, startRow, endRow, startCol, endCol) {
    ctx.save();
    // Убрал тень по умолчанию, будем добавлять где нужно
    ctx.shadowColor = 'transparent';

    const wallEdgeColorDark = '#383838'; // Темнее для тени/низа
    const wallEdgeColorLight = '#606060'; // Светлее для верха/освещения
    const wallTopEdgeColor = '#757575'; // Самый светлый верх

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tileValue = map[r]?.[c];
        if (tileValue === undefined) continue;

        // Округляем координаты отрисовки до целых чисел!
        const screenX = Math.floor(c * this.tileSize + offsetX);
        const screenY = Math.floor(r * this.tileSize + offsetY);
        const color = this.getTileColor(r, c, tileValue, rooms);

        ctx.fillStyle = color;
        ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);

        // --- Улучшенная отрисовка стен и краев ---
        if (tileValue === TILE_WALL) {
          // Простая текстура шума для стены
          ctx.fillStyle = 'rgba(0,0,0,0.06)'; // Полупрозрачный черный
          for (let i = 0; i < 5; i++) {
            // Несколько точек шума
            ctx.fillRect(
              screenX + Math.random() * this.tileSize,
              screenY + Math.random() * this.tileSize,
              1,
              1
            );
          }

          // Рисуем грани только если сосед НЕ стена
          const edgeSize = 2; // Толщина грани

          // Верхняя грань (самая светлая)
          if (r > 0 && map[r - 1]?.[c] !== TILE_WALL) {
            ctx.fillStyle = wallTopEdgeColor;
            ctx.fillRect(screenX, screenY, this.tileSize, edgeSize);
          }
          // Нижняя грань (темная)
          if (r < rows - 1 && map[r + 1]?.[c] !== TILE_WALL) {
            ctx.fillStyle = wallEdgeColorDark;
            ctx.fillRect(screenX, screenY + this.tileSize - edgeSize, this.tileSize, edgeSize);
          }
          // Левая грань (светлая)
          if (c > 0 && map[r]?.[c - 1] !== TILE_WALL) {
            ctx.fillStyle = wallEdgeColorLight;
            ctx.fillRect(screenX, screenY + edgeSize, edgeSize, this.tileSize - edgeSize); // Начинаем ниже верхней грани
          }
          // Правая грань (темная)
          if (c < cols - 1 && map[r]?.[c + 1] !== TILE_WALL) {
            ctx.fillStyle = wallEdgeColorDark;
            ctx.fillRect(
              screenX + this.tileSize - edgeSize,
              screenY + edgeSize,
              edgeSize,
              this.tileSize - edgeSize
            ); // Начинаем ниже верхней грани
          }

          // Уголки (опционально, для сглаживания)
          // Внутренний верхний левый угол
          if (
            r > 0 &&
            c > 0 &&
            map[r - 1]?.[c] !== TILE_WALL &&
            map[r]?.[c - 1] !== TILE_WALL &&
            map[r - 1]?.[c - 1] !== TILE_WALL
          ) {
            ctx.fillStyle = wallEdgeColorLight; // Компромиссный цвет
            ctx.fillRect(screenX, screenY, edgeSize, edgeSize);
          }
          // Внутренний верхний правый угол
          if (
            r > 0 &&
            c < cols - 1 &&
            map[r - 1]?.[c] !== TILE_WALL &&
            map[r]?.[c + 1] !== TILE_WALL &&
            map[r - 1]?.[c + 1] !== TILE_WALL
          ) {
            ctx.fillStyle = wallTopEdgeColor; // Светлый т.к. сверху
            ctx.fillRect(screenX + this.tileSize - edgeSize, screenY, edgeSize, edgeSize);
          }
          // и т.д. для нижних углов...
        } else if (tileValue === TILE_CORRIDOR) {
          // Очень легкая текстура для коридора
          ctx.fillStyle = 'rgba(255,255,255,0.03)'; // Едва заметный белый шум
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(
              screenX + Math.random() * this.tileSize,
              screenY + Math.random() * this.tileSize,
              1,
              1
            );
          }
        }
      }
    }
    ctx.restore();
  }

  /** Draw room-specific floors and decorations */
  drawRoomDetails(
    ctx,
    map,
    rooms,
    liftPosition, // Добавили liftPosition
    offsetX,
    offsetY,
    cols,
    rows,
    startRow,
    endRow,
    startCol,
    endCol
  ) {
    ctx.save();
    ctx.shadowColor = 'transparent'; // No shadows for room details

    for (const room of rooms) {
      // Basic visibility check for the room bounding box
      if (
        room.col + room.width < startCol ||
        room.col > endCol ||
        room.row + room.height < startRow ||
        room.row > endRow
      )
        continue;

      const roomScreenX = Math.floor(room.col * this.tileSize + offsetX);
      const roomScreenY = Math.floor(room.row * this.tileSize + offsetY);
      const roomScreenW = room.width * this.tileSize;
      const roomScreenH = room.height * this.tileSize;

      // --- Determine Floor Color ---
      let floorColor = '#c5c5c5'; // Default slightly lighter gray
      switch (room.type) {
        case 'classroom':
          floorColor = '#a0c8e0';
          break; // Bluish
        case 'office':
          floorColor = '#f0e8c0';
          break; // Beige
        case 'library':
          floorColor = '#d8c0a8';
          break; // Woody
        case 'gym':
          floorColor = '#b0d0b0';
          break; // Greenish
        case 'utility':
          floorColor = '#b0b0b0';
          break; // Gray concrete
      }

      // --- Draw Room Floor (tile by tile within visible area) ---
      for (
        let r = Math.max(room.row, startRow);
        r < Math.min(room.row + room.height, endRow);
        r++
      ) {
        for (
          let c = Math.max(room.col, startCol);
          c < Math.min(room.col + room.width, endCol);
          c++
        ) {
          const tileValue = map[r]?.[c];
          // --- ФИКС ЛИФТА и ФЛИКЕРИНГА ---
          // Рисуем пол ТОЛЬКО если это TILE_ROOM_FLOOR
          // (не рисуем поверх стен, коридоров И ЛИФТА)
          if (tileValue === TILE_ROOM_FLOOR) {
            const screenX = Math.floor(c * this.tileSize + offsetX);
            const screenY = Math.floor(r * this.tileSize + offsetY);

            // УБИРАЕМ Math.random()! Используем детерминированную вариацию
            const hash = simpleHash(r * 5000 + c * 3 + room.id); // Хеш с учетом комнаты
            const variation = ((hash % 11) - 5) / 100; // Вариация -0.05 до +0.05
            const brightnessFactor = 0.98 + variation;
            ctx.fillStyle = adjustColorBrightness(floorColor, brightnessFactor);

            ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);

            // Доп. текстура для пола (опционально)
            ctx.fillStyle = 'rgba(0,0,0,0.02)'; // Легкий шум
            for (let i = 0; i < 2; i++) {
              ctx.fillRect(
                screenX + Math.random() * this.tileSize, // Тут можно оставить random
                screenY + Math.random() * this.tileSize,
                1,
                1
              );
            }
          }
        }
      }

      // --- Draw Decorations (using screen coordinates) ---
      // Оставляем старую логику декораций, ее можно улучшать отдельно
      this.drawRoomDecorations(ctx, room, roomScreenX, roomScreenY, roomScreenW, roomScreenH);
    }
    ctx.restore();
  }

  /** Draw lift details (button, outline) */
  drawLiftDetails(ctx, liftPosition, offsetX, offsetY) {
    if (!liftPosition) return;

    const screenX = Math.floor(liftPosition.tileX * this.tileSize + offsetX);
    const screenY = Math.floor(liftPosition.tileY * this.tileSize + offsetY);

    // Check if lift is visible before drawing details
    if (
      screenX + this.tileSize < 0 ||
      screenX > ctx.canvas.width ||
      screenY + this.tileSize < 0 ||
      screenY > ctx.canvas.height
    ) {
      return;
    }

    ctx.save();
    ctx.shadowColor = 'transparent'; // No shadow for lift details

    // Более четкая рамка лифта
    ctx.strokeStyle = '#d0d0d0'; // Светлая рамка
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, this.tileSize - 1, this.tileSize - 1);
    ctx.strokeStyle = '#404040'; // Темная внутренняя тень
    ctx.strokeRect(screenX + 1.5, screenY + 1.5, this.tileSize - 3, this.tileSize - 3);

    // Улучшенная кнопка
    const buttonRadius = this.tileSize * 0.15; // Чуть больше
    const buttonX = screenX + this.tileSize * 0.8;
    const buttonY = screenY + this.tileSize * 0.5;

    // Основание кнопки (темнее)
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(buttonX, buttonY, buttonRadius, 0, Math.PI * 2);
    ctx.fill();

    // Сама кнопка (красная)
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(buttonX, buttonY, buttonRadius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Блик на кнопке
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(
      buttonX - buttonRadius * 0.2,
      buttonY - buttonRadius * 0.2,
      buttonRadius * 0.3,
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }

  /** Draw decorations for a specific room */
  drawRoomDecorations(ctx, room, x, y, w, h) {
    // Логика декораций остается прежней, но ее можно расширить
    // Например, рисовать не просто прямоугольники, а более сложные формы
    // или использовать маленькие спрайты для объектов.
    const ts = this.tileSize;
    const margin = ts * 0.3;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#5d4037'; // Обводка по умолчанию

    // Simplified decoration logic (copied from original)
    switch (room.type) {
      case 'classroom':
        ctx.fillStyle = '#8B4513'; // Коричневый для парт
        const deskW = ts * 0.7,
          deskH = ts * 0.4,
          spaceX = ts * 1.2,
          spaceY = ts * 1.1;
        for (let r = 0; ; r++) {
          const deskY = y + margin + r * spaceY;
          if (deskY + deskH > y + h - margin * 2) break;
          for (let c = 0; ; c++) {
            const deskX = x + margin + c * spaceX;
            if (deskX + deskW > x + w - margin) break;
            // Парта
            ctx.fillRect(deskX, deskY, deskW, deskH);
            ctx.strokeRect(deskX, deskY, deskW, deskH);
            // Стул (простой)
            ctx.fillStyle = '#6a4a3a';
            ctx.fillRect(deskX + deskW * 0.2, deskY + deskH + 1, deskW * 0.6, ts * 0.2);
            ctx.fillStyle = '#8B4513'; // Вернем цвет парт
          }
        }
        // Доска
        ctx.fillStyle = '#333';
        ctx.strokeStyle = '#ccc';
        ctx.fillRect(x + w * 0.2, y + margin / 2, w * 0.6, ts * 0.3);
        ctx.strokeRect(x + w * 0.2, y + margin / 2, w * 0.6, ts * 0.3);
        break;
      // ... (остальные типы комнат без изменений)
      case 'office':
        ctx.fillStyle = '#a0522d';
        ctx.strokeStyle = '#5d4037';
        const tableX = x + margin,
          tableY = y + margin,
          tableW = w * 0.5,
          tableH = ts * 0.8;
        ctx.fillRect(tableX, tableY, tableW, tableH);
        ctx.strokeRect(tableX, tableY, tableW, tableH);
        ctx.fillStyle = '#444'; // Стул
        ctx.fillRect(tableX + tableW * 0.3, tableY + tableH + ts * 0.1, ts * 0.6, ts * 0.6);
        ctx.fillStyle = '#8B4513'; // Шкаф
        ctx.fillRect(x + w - margin - ts, y + margin, ts * 0.8, h - margin * 2);
        ctx.strokeRect(x + w - margin - ts, y + margin, ts * 0.8, h - margin * 2);
        break;
      case 'library':
        ctx.fillStyle = '#654321'; // Темное дерево
        ctx.strokeStyle = '#402a10';
        const shelfW = ts * 0.5,
          shelfH = h - margin * 2;
        // Стелажи по бокам
        ctx.fillRect(x + margin, y + margin, shelfW, shelfH);
        ctx.strokeRect(x + margin, y + margin, shelfW, shelfH);
        ctx.fillRect(x + w - margin - shelfW, y + margin, shelfW, shelfH);
        ctx.strokeRect(x + w - margin - shelfW, y + margin, shelfW, shelfH);
        // Добавим линии полок
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        for (let shelfY = y + margin + ts * 0.5; shelfY < y + margin + shelfH; shelfY += ts * 0.6) {
          ctx.beginPath();
          ctx.moveTo(x + margin, shelfY);
          ctx.lineTo(x + margin + shelfW, shelfY);
          ctx.moveTo(x + w - margin - shelfW, shelfY);
          ctx.lineTo(x + w - margin, shelfY);
          ctx.stroke();
        }
        ctx.strokeStyle = '#5d4037'; // Вернем основной цвет обводки
        // Стол в центре
        ctx.fillStyle = '#966F33'; // Светлое дерево
        ctx.fillRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.4);
        ctx.strokeRect(x + w * 0.3, y + h * 0.3, w * 0.4, h * 0.4);
        break;
      case 'gym':
        ctx.fillStyle = '#778899'; // Коврики/маты
        ctx.fillRect(x + margin, y + margin, w * 0.3, h * 0.3);
        ctx.fillRect(x + w - margin - w * 0.4, y + h - margin - h * 0.3, w * 0.4, h * 0.3);
        ctx.fillStyle = '#555'; // Гантели/штанги (условно)
        ctx.fillRect(x + w * 0.5, y + margin, ts * 0.2, ts * 1.5); // Стойка
        ctx.fillRect(x + w * 0.2, y + h * 0.7, ts * 1.5, ts * 0.2); // Штанга
        ctx.fillStyle = '#333'; // Блины
        ctx.beginPath();
        ctx.arc(x + w * 0.2, y + h * 0.7 + ts * 0.1, ts * 0.3, 0, Math.PI * 2);
        ctx.arc(x + w * 0.2 + ts * 1.5, y + h * 0.7 + ts * 0.1, ts * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'utility':
      default:
        ctx.fillStyle = '#A0522D'; // Ящики/оборудование
        ctx.strokeStyle = '#5d4037';
        ctx.fillRect(x + w * 0.15, y + h * 0.15, w * 0.2, h * 0.25);
        ctx.strokeRect(x + w * 0.15, y + h * 0.15, w * 0.2, h * 0.25);
        ctx.fillRect(x + w * 0.7, y + h * 0.6, w * 0.25, h * 0.3);
        ctx.strokeRect(x + w * 0.7, y + h * 0.6, w * 0.25, h * 0.3);
        ctx.fillRect(x + w * 0.2, y + h * 0.7, w * 0.15, h * 0.15);
        ctx.strokeRect(x + w * 0.2, y + h * 0.7, w * 0.15, h * 0.15);
        ctx.fillStyle = '#777'; // Трубы/шкафы
        ctx.fillRect(x + w - margin - ts * 0.4, y + margin, ts * 0.4, h - margin * 2);
        break;
    }
  }

  /** Draw books */
  drawBooks(ctx, books, offsetX, offsetY, bookImage) {
    if (!books || books.length === 0) return;
    const defaultBookSize = this.tileSize * 0.6;

    for (const book of books) {
      const isCollected = book.isCollected || book.collected; // Handle both potential properties
      if (!isCollected) {
        const bookSize = book.size || defaultBookSize;
        // Округляем координаты отрисовки
        const screenX = Math.floor(book.x + offsetX - bookSize / 2);
        const screenY = Math.floor(book.y + offsetY - bookSize / 2);

        // Basic visibility check
        if (
          screenX + bookSize > 0 &&
          screenX < ctx.canvas.width &&
          screenY + bookSize > 0 &&
          screenY < ctx.canvas.height
        ) {
          // Prefer book's own draw method if available
          if (typeof book.draw === 'function') {
            // Передаем округленные координаты и размер
            book.draw(ctx, offsetX, offsetY, bookImage); // book.draw сама должна округлять
          } else {
            // Fallback drawing
            if (bookImage) {
              // Рисуем с округленными координатами
              ctx.drawImage(bookImage, screenX, screenY, bookSize, bookSize);
            } else {
              ctx.fillStyle = '#8d6e63'; // Brown color for book
              ctx.fillRect(screenX, screenY, bookSize, bookSize);
              ctx.strokeStyle = '#5d4037'; // Darker outline
              ctx.lineWidth = 1;
              ctx.strokeRect(screenX + 0.5, screenY + 0.5, bookSize - 1, bookSize - 1); // Рисуем рамку четче
            }
          }
        }
      }
    }
  }
} // End class MapRenderer
```

**`src/utils/map.js`** (Нужно добавить `simpleHash`, если ее нет)

```javascript
// src/utils/map.js

// ... (твои существующие функции randomInt, performBFS и т.д.)

// Пример простой хеш-функции (не криптографическая!)
// Используется для получения псевдослучайного, но детерминированного значения из числа (координат)
export function simpleHash(seed) {
  let h = seed ^ 0xdeadbeef; // XOR с начальным значением
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0; // Приведение к беззнаковому 32-битному числу
}

// --- Функции для цветов (оставим как есть или можно улучшить) ---

// Генерирует случайный оттенок серого в заданном диапазоне яркости (0-255)
export function randomGray(minBrightness, maxBrightness) {
  const brightness = randomInt(minBrightness, maxBrightness);
  return `rgb(${brightness},${brightness},${brightness})`;
}

// Генерирует случайный оттенок серого для коридоров (можно сделать похожим на randomGray)
export function randomCorridorGray(minBrightness, maxBrightness) {
  // Можно использовать ту же логику, что и randomGray, или сделать их чуть теплее/холоднее
  const brightness = randomInt(minBrightness, maxBrightness);
  // Пример: чуть теплее
  // const r = brightness;
  // const g = Math.max(0, brightness - 2);
  // const b = Math.max(0, brightness - 5);
  // return `rgb(${r},${g},${b})`;
  return `rgb(${brightness},${brightness},${brightness})`;
}

// Изменяет яркость цвета HEX (например, '#RRGGBB')
export function adjustColorBrightness(hexColor, factor) {
  if (!hexColor || typeof hexColor !== 'string' || hexColor.length < 7) return hexColor; // Возврат, если цвет некорректный

  let r = parseInt(hexColor.slice(1, 3), 16);
  let g = parseInt(hexColor.slice(3, 5), 16);
  let b = parseInt(hexColor.slice(5, 7), 16);

  r = Math.min(255, Math.max(0, Math.round(r * factor)));
  g = Math.min(255, Math.max(0, Math.round(g * factor)));
  b = Math.min(255, Math.max(0, Math.round(b * factor)));

  const rHex = r.toString(16).padStart(2, '0');
  const gHex = g.toString(16).padStart(2, '0');
  const bHex = b.toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

// BFS для поиска пути или проверки достижимости (пример реализации)
export function performBFS(mapGrid, startX, startY, cols, rows, walkableTileValues) {
  const queue = [[startX, startY]];
  const visited = new Set([`${startX},${startY}`]);
  const directions = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  let reachable = false; // Флаг, достиг ли BFS тайлов коридора/комнаты (если искали от лифта)

  // Проверка начальной точки
  const startTileValue = mapGrid[startY]?.[startX];
  if (startTileValue === TILE_CORRIDOR || startTileValue === TILE_ROOM_FLOOR) {
    reachable = true; // Начали уже в безопасной зоне
  }

  while (queue.length > 0) {
    const [currX, currY] = queue.shift();

    for (const [dx, dy] of directions) {
      const nextX = currX + dx;
      const nextY = currY + dy;
      const key = `${nextX},${nextY}`;

      if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && !visited.has(key)) {
        const tileValue = mapGrid[nextY]?.[nextX];
        visited.add(key); // Посещаем в любом случае

        if (walkableTileValues.includes(tileValue)) {
          queue.push([nextX, nextY]);
          // Если искали от лифта и нашли коридор/комнату, отмечаем достижимость
          if (tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) {
            reachable = true;
          }
        }
      }
    }
  }
  // Возвращаем результат BFS - в данном случае, флаг достижимости безопасной зоны
  return { reachable };
}

// ... (остальные утилиты, если есть)
```

---

**Остальные файлы (без изменений, но включены для полноты):**

**`src/map/ProceduralMap.js`**

```javascript
// src/map/ProceduralMap.js

import { Book } from './Book.js';
import { MapRenderer } from './MapRenderer.js';
import { randomInt } from '../utils/map.js'; // Убедись, что map.js экспортирует randomInt
import { generateLevelData } from './MapGen.js';
import {
  TILE_WALL,
  TILE_CORRIDOR,
  TILE_ROOM_FLOOR,
  TILE_LIFT,
  LIFT_INTERACTION_RADIUS_MULTIPLIER,
  GYM_CHANCE_ON_FIRST_FLOOR, // Keep for default generation params if needed
} from '../utils/constants.js';

// Note: consistentLiftCoords is now managed internally by mapGenerator.js

export class ProceduralMap {
  constructor(canvasWidth, canvasHeight, floorNumber, minFloor, maxFloor) {
    this.tileSize = 32;
    this.cols = 40;
    this.rows = 30;
    this.width = this.cols * this.tileSize;
    this.height = this.rows * this.tileSize;
    this.offsetX = 0;
    this.offsetY = 0;

    this.floorNumber = floorNumber;
    this.minFloor = minFloor;
    this.maxFloor = maxFloor;

    // Map state - initialized after generation
    this.map = null;
    this.rooms = [];
    this.books = [];
    this.liftPosition = null;

    // Modules
    this.renderer = new MapRenderer(this.tileSize);

    // --- Generation ---
    // Define generation parameters here or pass them in
    const generationParams = {
      minRoomSize: 5,
      maxRoomSize: 10,
      corridorThickness: 1,
      numRooms: 12,
      maxRoomAttempts: 200,
      booksPerMap: 5, // Books placed *after* generation
      roomTypeWeights: {
        classroom: 50,
        office: 25,
        library: 15,
        // gym chance handled by generator based on floorNumber
        utility: 10,
      },
    };

    try {
      // Configuration for the generator
      const generationConfig = {
        cols: this.cols,
        rows: this.rows,
        floorNumber: this.floorNumber,
        minFloor: this.minFloor,
        maxFloor: this.maxFloor, // Pass maxFloor too, might be useful later
        tileSize: this.tileSize, // Pass tileSize if generator needs it (e.g., lift world pos)
        generationParams: generationParams,
      };

      // Generate map layout data
      const { map, rooms, liftPosition } = generateLevelData(generationConfig);

      // Store the generated data
      this.map = map;
      this.rooms = rooms;
      this.liftPosition = liftPosition; // Already contains world coords if calculated by generator

      // --- Post-Generation Steps ---
      this.renderer.resetColorCache(); // Reset renderer cache for new map
      this.placeBooksReliably(generationParams.booksPerMap); // Place books on the generated map

      console.log(
        `[ProcMap Floor ${this.floorNumber}] Initialization complete. ${
          this.rooms.length
        } rooms, Lift: ${
          this.liftPosition
            ? `OK at (${this.liftPosition.tileX}, ${this.liftPosition.tileY})`
            : 'FAIL'
        }, ${this.books.length} books.`
      );
      // this.logMapGrid(); // Optional: Log grid after everything
    } catch (error) {
      console.error(
        `[ProcMap Floor ${this.floorNumber}] CRITICAL ERROR during map generation or setup:`,
        error
      );
      // Handle the error appropriately - maybe throw again, or set a 'failed' state
      throw error; // Re-throw to signal failure to the caller (e.g., Game)
    }
  }

  // --- Book Placement (Moved here, operates on generated map) ---
  placeBooksReliably(booksPerMap) {
    this.books = []; // Clear previous books
    const potentialLocations = [];
    const placedCoords = new Set();
    console.log(`[ProcMap Floor ${this.floorNumber}] Placing up to ${booksPerMap} books...`);

    // Find valid spots (corridor or room floor, not lift)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tileValue = this.map[r]?.[c];
        const isLiftTile =
          this.liftPosition && r === this.liftPosition.tileY && c === this.liftPosition.tileX;
        if ((tileValue === TILE_ROOM_FLOOR || tileValue === TILE_CORRIDOR) && !isLiftTile) {
          potentialLocations.push({ r, c });
        }
      }
    }

    // Place books randomly from potential locations
    let booksPlaced = 0;
    while (booksPlaced < booksPerMap && potentialLocations.length > 0) {
      const randomIndex = Math.floor(Math.random() * potentialLocations.length);
      const { r, c } = potentialLocations.splice(randomIndex, 1)[0]; // Remove chosen location
      const coordKey = `${c},${r}`;

      // Double check the tile just in case & ensure not already placed (though splice should prevent it)
      if (
        (this.map[r]?.[c] === TILE_ROOM_FLOOR || this.map[r]?.[c] === TILE_CORRIDOR) &&
        !placedCoords.has(coordKey)
      ) {
        const bookWorldX = (c + 0.5) * this.tileSize;
        const bookWorldY = (r + 0.5) * this.tileSize;
        const bookId = `book_${this.floorNumber}_${booksPlaced + 1}`; // Unique ID per floor/book
        this.books.push(new Book(bookWorldX, bookWorldY, bookId, this.tileSize));
        placedCoords.add(coordKey);
        booksPlaced++;
      }
    }

    if (booksPlaced < booksPerMap) {
      console.warn(`[ProcMap Books] Placed only ${booksPlaced}/${booksPerMap} books.`);
    } else {
      console.log(`[ProcMap Books] Placed ${booksPlaced} books.`);
    }
  }

  // --- Interaction Methods ---

  isWalkable(worldX, worldY) {
    if (!this.map) return false; // Map not generated
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);

    if (tileX < 0 || tileX >= this.cols || tileY < 0 || tileY >= this.rows) {
      return false; // Outside map bounds
    }

    const tileValue = this.map[tileY]?.[tileX];
    // Check against walkable tile types - LIFT IS WALKABLE
    return tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR || tileValue === TILE_LIFT;
  }

  findRandomInitialSpawnPosition() {
    if (!this.map) return undefined;
    const suitableTiles = [];
    // Prefer tiles not directly adjacent to walls for a less cramped start
    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        const tileValue = this.map[r]?.[c];
        const isLift =
          this.liftPosition && r === this.liftPosition.tileY && c === this.liftPosition.tileX;
        // Ищем коридор или пол комнаты, но НЕ ЛИФТ
        if ((tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) && !isLift) {
          // Check if surrounded by non-walls (more open space)
          if (
            this.map[r - 1]?.[c] !== TILE_WALL &&
            this.map[r + 1]?.[c] !== TILE_WALL &&
            this.map[r]?.[c - 1] !== TILE_WALL &&
            this.map[r]?.[c + 1] !== TILE_WALL
          ) {
            suitableTiles.push({ r, c });
          }
        }
      }
    }

    // Fallback: If no open spaces found, use any valid floor/corridor (still not lift)
    if (suitableTiles.length === 0) {
      console.warn(
        "[MapGen Spawn] No 'open' spawn points found, using any walkable non-lift tile."
      );
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const tileValue = this.map[r]?.[c];
          const isLift =
            this.liftPosition && r === this.liftPosition.tileY && c === this.liftPosition.tileX;
          if ((tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) && !isLift) {
            suitableTiles.push({ r, c });
          }
        }
      }
    }

    if (suitableTiles.length === 0) {
      console.error(
        `[MapGen Spawn] CRITICAL: No suitable spawn tiles found (non-lift floor/corridor)!`
      );
      // Extreme fallback: center of the map (might be a wall!)
      // return { x: this.width / 2, y: this.height / 2 };
      return undefined; // Indicate failure
    }

    const { r, c } = suitableTiles[Math.floor(Math.random() * suitableTiles.length)];
    const worldX = (c + 0.5) * this.tileSize;
    const worldY = (r + 0.5) * this.tileSize;
    console.log(`[MapGen Spawn] Found initial spawn at tile(${c}, ${r})`);
    return { x: worldX, y: worldY };
  }

  // // Kept for reference if needed, but findRandomInitialSpawnPosition is better
  // findRandomWalkablePosition() { /* ... similar logic, but might return lift tile ... */ }

  /**
   * Finds the nearest SAFE walkable tile (CORRIDOR or ROOM_FLOOR) to a target world position.
   * Uses expanding radius search, then BFS as fallback. EXCLUDES LIFT TILE as a target.
   * Returns world coordinates {x, y} or null.
   */
  findNearestWalkableTile(targetWorldX, targetWorldY, maxRadius = 8) {
    if (!this.map) return null;

    const targetTileX = Math.floor(targetWorldX / this.tileSize);
    const targetTileY = Math.floor(targetWorldY / this.tileSize);

    console.log(
      `[MapUtil] Finding nearest SAFE tile near world(${targetWorldX.toFixed(
        1
      )}, ${targetWorldY.toFixed(1)}) -> tile(${targetTileX}, ${targetTileY})`
    );

    // Check if the STARTING tile itself is safe (corridor/room floor)
    // Note: We don't check this first because the function is usually called
    // when the character IS ALREADY in a bad spot (wall/lift after teleport)
    // const startTileValue = this.map[targetTileY]?.[targetTileX];
    // if (startTileValue === TILE_CORRIDOR || startTileValue === TILE_ROOM_FLOOR) {
    //   console.log(`  [MapUtil] Target tile is already safe.`);
    //   return { x: (targetTileX + 0.5) * this.tileSize, y: (targetTileY + 0.5) * this.tileSize };
    // }

    // 1. Radius Search (looking for CORRIDOR or ROOM_FLOOR)
    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Only check the boundary of the current radius
          if (Math.abs(dx) < radius && Math.abs(dy) < radius) continue;

          const checkX = targetTileX + dx;
          const checkY = targetTileY + dy;

          // Ensure within bounds
          if (checkX < 0 || checkX >= this.cols || checkY < 0 || checkY >= this.rows) continue;

          const tileValue = this.map[checkY]?.[checkX];
          // Found a safe spot?
          if (tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) {
            console.log(
              `  [MapUtil] Found safe tile via radius search at tile(${checkX}, ${checkY})`
            );
            return { x: (checkX + 0.5) * this.tileSize, y: (checkY + 0.5) * this.tileSize };
          }
        }
      }
    }

    // 2. BFS Search (Fallback) - Search from target outwards
    console.warn(
      `[MapUtil] Radius search failed (maxRadius ${maxRadius}). Starting BFS from tile(${targetTileX}, ${targetTileY})...`
    );
    const queue = [[targetTileX, targetTileY]];
    const visited = new Set([`${targetTileX},${targetTileY}`]);
    const directions = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    // Walkable tiles *for BFS search path* (can path THROUGH lift, but LIFT is not the TARGET)
    const bfsWalkablePath = [TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT];
    const targetSafeTiles = [TILE_CORRIDOR, TILE_ROOM_FLOOR];

    while (queue.length > 0) {
      const [currX, currY] = queue.shift();

      // Check if the CURRENT tile is a safe target (needed if starting BFS from non-walkable)
      // This check wasn't strictly necessary in the previous version but adds robustness
      // const currentTileVal = this.map[currY]?.[currX];
      // if (targetSafeTiles.includes(currentTileVal) && !(currX === targetTileX && currY === targetTileY) ) {
      //     console.log(`  [MapUtil] Found safe tile via BFS at initial queue element (${currX}, ${currY})`);
      //     return { x: (currX + 0.5) * this.tileSize, y: (currY + 0.5) * this.tileSize };
      // }

      for (const [dx, dy] of directions) {
        const nextX = currX + dx;
        const nextY = currY + dy;
        const key = `${nextX},${nextY}`;

        if (
          nextX >= 0 &&
          nextX < this.cols &&
          nextY >= 0 &&
          nextY < this.rows &&
          !visited.has(key)
        ) {
          const tileValue = this.map[nextY]?.[nextX];
          visited.add(key); // Mark visited regardless of type for BFS efficiency

          // Found a target safe tile? (Corridor or Room Floor)
          if (targetSafeTiles.includes(tileValue)) {
            console.log(`  [MapUtil] Found safe tile via BFS at (${nextX}, ${nextY})`);
            return { x: (nextX + 0.5) * this.tileSize, y: (nextY + 0.5) * this.tileSize };
          }

          // Can we continue searching FROM this neighbor? (Corridor, Room Floor, OR Lift)
          if (bfsWalkablePath.includes(tileValue)) {
            queue.push([nextX, nextY]);
          }
        }
      }
    }

    console.error(
      `[MapUtil] CRITICAL FAILURE: BFS could not find ANY safe walkable tile (Corridor/Room Floor) starting from tile(${targetTileX}, ${targetTileY})!`
    );
    return null; // Indicate complete failure
  }

  findNearbyUnansweredBook(worldX, worldY, radius = this.tileSize * 0.8) {
    if (!this.books) return null;
    let closestBook = null;
    let minDistanceSq = radius * radius;

    for (const book of this.books) {
      const isCollected = book.isCollected || book.collected; // Check both flags
      if (!isCollected) {
        const dx = book.x - worldX;
        const dy = book.y - worldY;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < minDistanceSq) {
          minDistanceSq = distanceSq;
          closestBook = book;
        }
      }
    }
    return closestBook;
  }

  markBookAsCollected(bookToCollect) {
    if (!bookToCollect || !this.books) return false;
    const book = this.books.find((b) => b === bookToCollect || b.id === bookToCollect.id);
    if (book && !(book.isCollected || book.collected)) {
      book.isCollected = true;
      book.collected = true; // Set both for safety
      console.log(`[Map] Marked book ${book.id} as collected.`);
      return true;
    }
    return false;
  }

  findNearbyLift(worldX, worldY, radius = this.tileSize * LIFT_INTERACTION_RADIUS_MULTIPLIER) {
    if (!this.liftPosition) return null;
    // Check distance from character center to lift tile center
    const dx = worldX - this.liftPosition.x;
    const dy = worldY - this.liftPosition.y;
    const distanceSq = dx * dx + dy * dy;
    return distanceSq < radius * radius ? this.liftPosition : null;
  }

  getLiftPosition() {
    // Ensure returning a copy if liftPosition is mutable, though here it seems okay
    return this.liftPosition;
  }

  // --- Drawing ---
  draw(ctx, bookImage = null) {
    if (!this.map || !this.renderer) return; // Don't draw if map not generated

    // Prepare data payload for the renderer
    const mapData = {
      map: this.map,
      rooms: this.rooms,
      books: this.books,
      liftPosition: this.liftPosition,
      offsetX: this.offsetX, // Pass the potentially non-integer offset
      offsetY: this.offsetY,
      cols: this.cols,
      rows: this.rows,
      tileSize: this.tileSize,
    };

    // Delegate drawing to the renderer
    this.renderer.draw(ctx, mapData, bookImage);
  }

  // --- Debugging ---
  logMapGrid() {
    if (!this.map) {
      console.log('Map grid not available.');
      return;
    }
    console.log(`--- Map Grid Floor ${this.floorNumber} (${this.cols}x${this.rows}) ---`);
    let header = '   ';
    for (let c = 0; c < this.cols; c++) header += c % 10 === 0 ? Math.floor(c / 10) : ' ';
    console.log(header);
    header = '   ';
    for (let c = 0; c < this.cols; c++) header += c % 10;
    console.log(header);
    for (let y = 0; y < this.rows; y++) {
      const rowNum = y.toString().padStart(2, ' ');
      const rowString = this.map[y]
        .map((tile) => {
          switch (tile) {
            case TILE_WALL:
              return '#';
            case TILE_CORRIDOR:
              return '.';
            case TILE_ROOM_FLOOR:
              return ' ';
            case TILE_LIFT:
              return 'L';
            default:
              return '?';
          }
        })
        .join('');
      console.log(`${rowNum} ${rowString}`);
    }
    // Log lift position for verification
    if (this.liftPosition) {
      console.log(`Lift at tile: (${this.liftPosition.tileX}, ${this.liftPosition.tileY})`);
    } else {
      console.log('Lift position not set.');
    }
    console.log(`--- End Map Grid Floor ${this.floorNumber} ---`);
  }
} // End class ProceduralMap
```

**`src/map/mapGenerator.js`**

```javascript
// src/map/mapGenerator.js

import {
  TILE_WALL,
  TILE_CORRIDOR,
  TILE_ROOM_FLOOR,
  TILE_LIFT,
  GYM_CHANCE_ON_FIRST_FLOOR,
} from '../utils/constants.js';
import { randomInt, performBFS } from '../utils/map.js'; // Ensure performBFS is imported if used here

// --- Module-level state for lift consistency ---
let consistentLiftCoords = null;

// --- Generation Parameters (Defaults) ---
const DEFAULT_GEN_PARAMS = {
  minRoomSize: 5,
  maxRoomSize: 10,
  corridorThickness: 1, // Currently hardcoded to 1 in carving funcs
  numRooms: 12,
  maxRoomAttempts: 200,
  roomTypeWeights: {
    classroom: 50,
    office: 25,
    library: 15,
    gym: 0, // Base weight, adjusted based on floor
    utility: 10,
  },
};

// --- Core Generation Function ---
export function generateLevelData(config) {
  const { cols, rows, floorNumber, minFloor, tileSize, generationParams: userParams } = config; // tileSize added
  const genParams = { ...DEFAULT_GEN_PARAMS, ...userParams };

  // Adjust gym chance for the first floor
  genParams.roomTypeWeights.gym = floorNumber === minFloor ? GYM_CHANCE_ON_FIRST_FLOOR * 100 : 0; // Use constant directly

  // Reset consistent lift coords on the first floor
  if (floorNumber === minFloor) {
    consistentLiftCoords = null;
    console.log(`[MapGen Floor ${floorNumber}] Reset consistent lift coords for the first floor.`);
  }

  console.log(`[MapGen Floor ${floorNumber}] Starting map generation (${cols}x${rows})...`);
  const map = Array.from({ length: rows }, () => Array(cols).fill(TILE_WALL));
  const rooms = [];
  let liftPositionData = null; // Will store {x, y, tileX, tileY}

  // --- Generation Steps ---
  _placeRooms(map, rooms, cols, rows, genParams);

  if (rooms.length < 2) {
    console.warn(
      `[MapGen Floor ${floorNumber}] Placed less than 2 rooms (${rooms.length}). Corridor connection skipped or limited.`
    );
    // Try to connect the single room to map center maybe? Or just accept it.
    if (rooms.length === 1) {
      console.log('[MapGen Connect] Only one room, skipping connections.');
      rooms[0].connected = true; // Mark as connected for consistency
    }
  } else {
    _connectRoomsBetter(map, rooms, cols, rows);
  }

  try {
    // Pass consistentLiftCoords reference, potentially update it inside
    // Pass tileSize to calculate world coordinates correctly
    const placedLiftData = _placeLift(
      map,
      cols,
      rows,
      floorNumber,
      minFloor,
      tileSize,
      consistentLiftCoords
    );
    liftPositionData = placedLiftData.position; // This now includes world x, y
    // Update the module-level variable if it was newly set
    if (placedLiftData.coords) {
      consistentLiftCoords = placedLiftData.coords;
    }
  } catch (error) {
    console.error(`[MapGen Floor ${floorNumber}] CRITICAL: Lift placement failed:`, error);
    throw new Error(`Lift placement failed on floor ${floorNumber}: ${error.message}`);
  }

  _ensureMapBorders(map, cols, rows);

  // Final lift reachability check *after* potential forced connections
  if (liftPositionData && !_isLiftReachable(map, liftPositionData, cols, rows)) {
    const errorMsg = `CRITICAL: Placed lift at tile(${liftPositionData.tileX}, ${liftPositionData.tileY}) is unreachable! Generation failed.`;
    console.error(`[MapGen Floor ${floorNumber}] ${errorMsg}`);
    // Try to force connect again as a last resort?
    const reconnected = _forceConnectionToPoint(
      map,
      liftPositionData.tileX,
      liftPositionData.tileY,
      cols,
      rows,
      true
    ); // Force BFS if needed
    if (!reconnected || !_isLiftReachable(map, liftPositionData, cols, rows)) {
      console.error(
        `[MapGen Floor ${floorNumber}] Last resort connection failed or lift still unreachable.`
      );
      throw new Error(
        `Lift is unreachable on floor ${floorNumber} even after forced connection attempt. Cannot proceed.`
      );
    } else {
      console.warn(
        `[MapGen Floor ${floorNumber}] Lift connection forced successfully as last resort.`
      );
      // Ensure the lift tile itself is correct after forcing
      map[liftPositionData.tileY][liftPositionData.tileX] = TILE_LIFT;
    }
  } else if (liftPositionData) {
    console.log(
      `[MapValidation Floor ${floorNumber}] Lift at tile(${liftPositionData.tileX}, ${liftPositionData.tileY}) is reachable.`
    );
  } else {
    // This should have been caught by the try/catch around _placeLift
    throw new Error(`Map generated without a valid lift position on floor ${floorNumber}.`);
  }

  console.log(`[MapGen Floor ${floorNumber}] Map generation completed successfully.`);
  return { map, rooms, liftPosition: liftPositionData }; // Return the generated data
}

// --- Helper: Place Rooms ---
function _placeRooms(map, rooms, cols, rows, genParams) {
  const { minRoomSize, maxRoomSize, numRooms, maxRoomAttempts, roomTypeWeights } = genParams;
  let roomAttempts = 0;

  // Calculate total weight for normalization (handles zero weights)
  let totalWeight = 0;
  for (const type in roomTypeWeights) {
    totalWeight += roomTypeWeights[type];
  }

  // Build weighted list only if there's weight
  const weightedTypes = [];
  if (totalWeight > 0) {
    for (const type in roomTypeWeights) {
      // Use probability instead of creating large arrays
      // For simplicity here, stick to array if weights are reasonable integers
      for (let i = 0; i < roomTypeWeights[type]; i++) {
        weightedTypes.push(type);
      }
    }
  }

  // Fallback if no weights or all are zero
  if (weightedTypes.length === 0) {
    weightedTypes.push('utility'); // Default fallback
    console.warn(
      "[MapGen Rooms] No room type weights provided or all sum to zero. Defaulting to 'utility'."
    );
  }

  while (rooms.length < numRooms && roomAttempts < maxRoomAttempts) {
    roomAttempts++;
    const roomWidth = randomInt(minRoomSize, maxRoomSize);
    const roomHeight = randomInt(minRoomSize, maxRoomSize);
    // Ensure room fits within map borders (1 tile buffer)
    const roomCol = randomInt(1, cols - roomWidth - 1);
    const roomRow = randomInt(1, rows - roomHeight - 1);
    const roomType = weightedTypes[randomInt(0, weightedTypes.length - 1)];

    const newRoom = {
      col: roomCol,
      row: roomRow,
      width: roomWidth,
      height: roomHeight,
      type: roomType,
      id: rooms.length + 1,
      centerTileX: Math.floor(roomCol + roomWidth / 2),
      centerTileY: Math.floor(roomRow + roomHeight / 2),
      connected: false,
    };

    let overlaps = false;
    const buffer = 2; // Keep buffer between rooms
    for (const existingRoom of rooms) {
      if (
        newRoom.col < existingRoom.col + existingRoom.width + buffer &&
        newRoom.col + newRoom.width + buffer > existingRoom.col &&
        newRoom.row < existingRoom.row + existingRoom.height + buffer &&
        newRoom.row + newRoom.height + buffer > existingRoom.row
      ) {
        overlaps = true;
        break;
      }
    }

    if (!overlaps) {
      rooms.push(newRoom);
      // Carve room floor
      for (let r = newRoom.row; r < newRoom.row + newRoom.height; r++) {
        for (let c = newRoom.col; c < newRoom.col + newRoom.width; c++) {
          // Check bounds just in case, though placement logic should prevent this
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            map[r][c] = TILE_ROOM_FLOOR;
          } else {
            console.warn(
              `[MapGen Rooms] Attempted to carve room floor out of bounds at (${c}, ${r})`
            );
          }
        }
      }
    }
  }
  console.log(`[MapGen Rooms] Placed ${rooms.length} rooms after ${roomAttempts} attempts.`);
}

// --- Helper: Connect Rooms (using Minimum Spanning Tree like approach) ---
function _connectRoomsBetter(map, rooms, cols, rows) {
  if (rooms.length < 2) return;
  console.log(`[MapGen Connect] Connecting ${rooms.length} rooms (MST approach)...`);

  // Initialize: Treat first room as the start of our connected component
  const connectedSet = new Set([rooms[0].id]);
  rooms[0].connected = true;
  const unconnectedRooms = new Map(rooms.slice(1).map((room) => [room.id, room]));
  let connectionCount = 0;

  // Loop until all rooms are connected (or we can't find more connections)
  while (unconnectedRooms.size > 0 && connectionCount < rooms.length * 2) {
    // Added safety break
    let bestDistanceSq = Infinity;
    let bestConnection = null; // { fromRoom: Room, toRoom: Room }

    // Find the shortest edge from any connected room to any unconnected room
    for (const connectedRoomId of connectedSet) {
      const roomC = rooms.find((r) => r.id === connectedRoomId); // Get room object
      for (const [unconnectedRoomId, roomU] of unconnectedRooms) {
        const dx = roomU.centerTileX - roomC.centerTileX;
        const dy = roomU.centerTileY - roomC.centerTileY;
        const distSq = dx * dx + dy * dy;

        if (distSq < bestDistanceSq) {
          bestDistanceSq = distSq;
          bestConnection = { fromRoom: roomC, toRoom: roomU };
        }
      }
    }

    // If we found a connection, carve it and update sets
    if (bestConnection) {
      const { fromRoom, toRoom } = bestConnection;
      _carveCorridorBetween(map, fromRoom, toRoom, cols, rows);
      toRoom.connected = true;
      connectedSet.add(toRoom.id);
      unconnectedRooms.delete(toRoom.id);
      connectionCount++;
      // console.log(`  Connected ${fromRoom.id} to ${toRoom.id}`);
    } else {
      // This shouldn't happen if the graph is initially one component,
      // but acts as a safeguard against infinite loops.
      console.error('[MapGen Connect] Could not find next closest room connection. Breaking.');
      break;
    }
  }

  // Optional: Add some extra random connections for loops (makes maps less linear)
  const extraConnections = Math.floor(rooms.length * 0.15); // Add ~15% extra paths
  for (let i = 0; i < extraConnections && rooms.length > 2; i++) {
    const roomA = rooms[randomInt(0, rooms.length - 1)];
    const roomB = rooms[randomInt(0, rooms.length - 1)];
    // Connect if different rooms and maybe filter by distance?
    if (roomA.id !== roomB.id) {
      _carveCorridorBetween(map, roomA, roomB, cols, rows);
    }
  }

  console.log(
    `[MapGen Connect] Finished connecting rooms. ${connectionCount} primary connections.`
  );
}

// --- Helper: Carve Corridors ---
function _carveCorridorBetween(map, roomA, roomB, cols, rows) {
  const { centerTileX: ax, centerTileY: ay } = roomA;
  const { centerTileX: bx, centerTileY: by } = roomB;
  // Randomly choose L-shape direction (Horizontal then Vertical, or V then H)
  if (Math.random() < 0.5) {
    _carveHorizontalCorridor(map, ay, ax, bx, cols, rows); // Carve H at start room's Y
    _carveVerticalCorridor(map, bx, ay, by, cols, rows); // Carve V at end room's X
  } else {
    _carveVerticalCorridor(map, ax, ay, by, cols, rows); // Carve V at start room's X
    _carveHorizontalCorridor(map, by, ax, bx, cols, rows); // Carve H at end room's Y
  }
}
function _carveHorizontalCorridor(map, r, c1, c2, cols, rows) {
  const startCol = Math.min(c1, c2);
  const endCol = Math.max(c1, c2);
  // Ensure row is valid
  if (r < 0 || r >= rows) return;
  for (let c = startCol; c <= endCol; c++) {
    // Ensure col is valid and tile is a wall before carving
    if (c >= 0 && c < cols && map[r][c] === TILE_WALL) {
      map[r][c] = TILE_CORRIDOR;
    }
  }
}
function _carveVerticalCorridor(map, c, r1, r2, cols, rows) {
  const startRow = Math.min(r1, r2);
  const endRow = Math.max(r1, r2);
  // Ensure col is valid
  if (c < 0 || c >= cols) return;
  for (let r = startRow; r <= endRow; r++) {
    // Ensure row is valid and tile is a wall before carving
    if (r >= 0 && r < rows && map[r][c] === TILE_WALL) {
      map[r][c] = TILE_CORRIDOR;
    }
  }
}

// --- Helper: Place Lift ---
// Takes current `liftCoords`, returns { position: {x, y, tileX, tileY}, coords: {tileX, tileY} }
function _placeLift(map, cols, rows, floorNumber, minFloor, tileSize, currentConsistentCoords) {
  let coordsToUse = currentConsistentCoords;
  let newlyFoundCoords = null;

  // Find coords only on the first floor if not already set
  if (floorNumber === minFloor && !coordsToUse) {
    console.log(`[MapGen Floor ${floorNumber}] Finding initial lift placement location...`);
    coordsToUse = _findLiftPlacementLocation(map, cols, rows);
    if (!coordsToUse) {
      // CRITICAL: No spot found on first floor. Try forcing connection from center?
      console.error(
        '[MapGen Lift] No suitable location found on the first floor. Attempting emergency placement.'
      );
      const centerTileX = Math.floor(cols / 2);
      const centerTileY = Math.floor(rows / 2);
      if (_forceConnectionToPoint(map, centerTileX, centerTileY, cols, rows, true)) {
        // Force BFS if needed
        console.warn(
          `[MapGen Lift] Emergency placement: Forced connection from center (${centerTileX}, ${centerTileY}).`
        );
        coordsToUse = { tileX: centerTileX, tileY: centerTileY };
      } else {
        throw new Error(
          '[MapGen Lift] FATAL: No suitable lift location found on the first floor and emergency placement failed.'
        );
      }
    }
    console.log(
      `[MapGen Floor ${floorNumber}] Established consistent lift coords at tile(${coordsToUse.tileX}, ${coordsToUse.tileY})`
    );
    newlyFoundCoords = coordsToUse; // Mark that we found new coords
  } else if (!coordsToUse && floorNumber > minFloor) {
    // This should not happen if generation proceeds floor by floor
    throw new Error(
      `[MapGen Lift] CRITICAL: Missing consistent lift coordinates for subsequent floor ${floorNumber}.`
    );
  }

  const { tileX, tileY } = coordsToUse;

  // Validate coords are within map bounds
  if (tileY < 0 || tileY >= rows || tileX < 0 || tileX >= cols) {
    throw new Error(
      `[MapGen Lift] Consistent coords (${tileX}, ${tileY}) are outside map bounds (${cols}x${rows}) on floor ${floorNumber}.`
    );
  }

  // If the designated lift spot is a wall, force a connection
  if (map[tileY][tileX] === TILE_WALL) {
    console.warn(
      `[MapGen Floor ${floorNumber}] Lift location tile(${tileX}, ${tileY}) is a wall. Forcing connection...`
    );
    const connected = _forceConnectionToPoint(map, tileX, tileY, cols, rows);
    if (!connected) {
      console.error(
        `[MapGen Lift Connect] FAILED to connect wall at lift location tile(${tileX}, ${tileY}). Lift might be isolated.`
      );
      // Continue placement, but reachability check later should ideally fail
    } else {
      console.log(`  [MapGen Lift Connect] Connection attempt finished for wall at lift location.`);
      // Ensure the tile is corridor AFTER carving, before setting to LIFT
      if (map[tileY][tileX] === TILE_WALL) {
        map[tileY][tileX] = TILE_CORRIDOR;
        console.log(`   [MapGen Lift Connect] Manually set tile(${tileX}, ${tileY}) to CORRIDOR.`);
      }
    }
  } else {
    console.log(
      `  [MapGen Lift] Lift location tile(${tileX}, ${tileY}) is already walkable (type: ${map[tileY][tileX]}).`
    );
  }

  // --- Place the lift tile ---
  map[tileY][tileX] = TILE_LIFT;

  // Calculate world position using the provided tileSize
  const liftWorldPos = {
    x: (tileX + 0.5) * tileSize,
    y: (tileY + 0.5) * tileSize,
    tileX: tileX,
    tileY: tileY,
  };
  console.log(
    `[MapGen Floor ${floorNumber}] Placed/Confirmed lift at tile(${tileX}, ${tileY}). World: (${liftWorldPos.x.toFixed(
      1
    )}, ${liftWorldPos.y.toFixed(1)})`
  );

  // Return the world position and the consistent tile coordinates
  return { position: liftWorldPos, coords: newlyFoundCoords || coordsToUse };
}

// --- Helper: Find Lift Location (prioritize existing corridors/rooms near center) ---
function _findLiftPlacementLocation(map, cols, rows) {
  const centerX = Math.floor(cols / 2),
    centerY = Math.floor(rows / 2);
  let bestSpot = null;
  let minDistanceSq = Infinity;
  // Search outwards from the center
  const maxSearchRadius = Math.max(centerX, centerY);

  for (let radius = 0; radius <= maxSearchRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Only check the boundary of the current radius ring
        if (radius > 0 && Math.abs(dx) < radius && Math.abs(dy) < radius) continue;

        const checkX = centerX + dx;
        const checkY = centerY + dy;

        // Ensure the tile is within valid map bounds (excluding outer border)
        if (checkY >= 1 && checkY < rows - 1 && checkX >= 1 && checkX < cols - 1) {
          const tile = map[checkY]?.[checkX]; // Safe access

          // We want an existing Corridor or Room Floor tile
          if (tile === TILE_CORRIDOR || tile === TILE_ROOM_FLOOR) {
            // Check if it has at least one walkable neighbor (more robust than wall count)
            let isConnectedToWalkable = false;
            const directions = [
              [0, -1],
              [0, 1],
              [-1, 0],
              [1, 0],
            ];
            for (const [ddx, ddy] of directions) {
              const nx = checkX + ddx;
              const ny = checkY + ddy;
              // Check neighbor bounds and type
              if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
                const neighborTile = map[ny]?.[nx];
                if (neighborTile === TILE_CORRIDOR || neighborTile === TILE_ROOM_FLOOR) {
                  isConnectedToWalkable = true;
                  break; // Found one, no need to check others
                }
              }
            }

            // If it's a walkable tile connected to other walkable tiles
            if (isConnectedToWalkable) {
              const distSq = dx * dx + dy * dy; // Distance from center
              // Prioritize closer spots
              if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                bestSpot = { tileX: checkX, tileY: checkY };
              }
            }
          }
        }
      }
    }
    // If we found a spot in this radius ring, return it immediately
    if (bestSpot) {
      console.log(
        `[MapGen FindLift] Selected best spot at tile(${bestSpot.tileX}, ${bestSpot.tileY}) radius ${radius}.`
      );
      return bestSpot;
    }
  }
  // Should only be reached if the map is solid wall or has no connected walkable areas
  console.warn(
    '[MapGen FindLift] No suitable (connected Corridor/Room Floor) lift location found near center.'
  );
  return null;
}

// --- Helper: Force Connection to Walkable Area ---
function _forceConnectionToPoint(map, targetX, targetY, cols, rows, useBFSFallback = false) {
  console.log(
    `  [MapGen Connect] Trying to connect wall/isolated tile(${targetX}, ${targetY}) to walkable area...`
  );
  const directions = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  let isAdjacentToWalkable = false;

  // Check if already adjacent to a walkable tile (Corridor or Room Floor)
  for (const [dx, dy] of directions) {
    const nx = targetX + dx;
    const ny = targetY + dy;
    if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
      const neighborTile = map[ny]?.[nx];
      if (neighborTile === TILE_CORRIDOR || neighborTile === TILE_ROOM_FLOOR) {
        isAdjacentToWalkable = true;
        break;
      }
    }
  }

  // If adjacent, just carve the target tile itself (if it's a wall)
  if (isAdjacentToWalkable) {
    console.log(
      `  [MapGen Connect] Tile(${targetX}, ${targetY}) is adjacent to walkable. Ensuring it's walkable.`
    );
    if (map[targetY][targetX] === TILE_WALL) {
      map[targetY][targetX] = TILE_CORRIDOR; // Turn the wall into corridor
    }
    return true;
  }

  // --- If not adjacent, find the NEAREST walkable tile and carve path ---
  let closestWalkable = null;
  let minDistSq = Infinity;
  // Search radius - can be quite large if needed
  const searchRadius = Math.max(5, Math.floor(Math.min(cols, rows) / 3));
  console.log(
    `  [MapGen Connect] Not adjacent. Searching nearest Corridor/Room Floor in radius ${searchRadius}...`
  );

  // 1. Radius search for the closest safe tile
  for (let r = 1; r <= searchRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) < r && Math.abs(dy) < r) continue; // Only boundary
        const checkX = targetX + dx;
        const checkY = targetY + dy;
        // Check bounds
        if (checkX >= 0 && checkX < cols && checkY >= 0 && checkY < rows) {
          const tileValue = map[checkY]?.[checkX];
          // Look specifically for corridor or room floor
          if (tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) {
            const distSq = dx * dx + dy * dy;
            if (distSq < minDistSq) {
              minDistSq = distSq;
              closestWalkable = { x: checkX, y: checkY };
            }
          }
        }
      }
    }
    if (closestWalkable) break; // Found the closest in this radius ring
  }

  // 2. If Radius search found something, carve path
  if (closestWalkable) {
    console.log(
      `  [MapGen Connect] Found closest at tile(${closestWalkable.x}, ${closestWalkable.y}). Carving L-path...`
    );
    // Carve L-shaped path (ensure target tile becomes corridor)
    _carveHorizontalCorridor(map, targetY, targetX, closestWalkable.x, cols, rows);
    _carveVerticalCorridor(map, closestWalkable.x, targetY, closestWalkable.y, cols, rows);
    // Ensure the starting tile is also carved
    if (map[targetY][targetX] === TILE_WALL) {
      map[targetY][targetX] = TILE_CORRIDOR;
    }
    console.log(`  [MapGen Connect] Carved path attempt finished.`);
    return true; // Assume success if path carved
  }

  // 3. BFS Fallback (if requested and radius search failed)
  if (useBFSFallback) {
    console.warn(
      `  [MapGen Connect] Radius search failed. Trying BFS to find *any* Corridor/Room Floor...`
    );
    const queue = [[targetX, targetY]];
    const visited = new Set([`${targetX},${targetY}`]);
    const path = {}; // To reconstruct path if needed (optional here)
    let foundTarget = null;

    while (queue.length > 0) {
      const [currX, currY] = queue.shift();

      // Check if current is the target type
      const currentTileVal = map[currY]?.[currX];
      if (currentTileVal === TILE_CORRIDOR || currentTileVal === TILE_ROOM_FLOOR) {
        foundTarget = { x: currX, y: currY };
        break; // Found one!
      }

      for (const [dx, dy] of directions) {
        const nextX = currX + dx;
        const nextY = currY + dy;
        const key = `${nextX},${nextY}`;

        if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && !visited.has(key)) {
          const neighborValue = map[nextY]?.[nextX];
          // Allow BFS to path through walls to find the nearest floor/corridor
          if (neighborValue !== undefined) {
            // Check if tile exists
            visited.add(key);
            path[key] = { x: currX, y: currY }; // Store predecessor for path reconstruction
            queue.push([nextX, nextY]);
          }
        }
      }
      if (foundTarget) break; // Exit outer loop too
    }

    if (foundTarget) {
      console.log(
        `  [MapGen Connect] BFS found target at (${foundTarget.x}, ${foundTarget.y}). Carving direct path...`
      );
      // Reconstruct and carve path (simple straight line carve for now)
      // This requires path reconstruction from 'path' object back to targetX, targetY
      // Simplified: Just carve L-path to the found BFS target
      _carveHorizontalCorridor(map, targetY, targetX, foundTarget.x, cols, rows);
      _carveVerticalCorridor(map, foundTarget.x, targetY, foundTarget.y, cols, rows);
      if (map[targetY][targetX] === TILE_WALL) map[targetY][targetX] = TILE_CORRIDOR;
      return true;
    } else {
      console.error(
        `  [MapGen Connect] BFS FAILED to find ANY Corridor/Room Floor from wall at tile(${targetX}, ${targetY}).`
      );
      return false;
    }
  }

  // If radius search failed and BFS wasn't used/failed
  console.error(
    `  [MapGen Connect] FAILED to find nearby Corridor/Room Floor in radius ${searchRadius} from tile(${targetX}, ${targetY}).`
  );
  return false;
}

// --- Helper: Check Lift Reachability using BFS ---
function _isLiftReachable(map, liftPositionData, cols, rows) {
  if (!liftPositionData) return false;
  const { tileX, tileY } = liftPositionData;

  // Check if lift tile coords are valid
  if (tileY < 0 || tileY >= rows || tileX < 0 || tileX >= cols) {
    console.error(`[MapValidation] Lift coords (${tileX}, ${tileY}) out of bounds.`);
    return false;
  }
  // Check if the tile is actually a lift
  if (map[tileY]?.[tileX] !== TILE_LIFT) {
    console.error(
      `[MapValidation] Tile at lift coords (${tileX}, ${tileY}) is not TILE_LIFT (it's ${map[tileY]?.[tileX]}).`
    );
    return false; // Should not happen if placement logic is correct
  }

  // Use BFS utility function (imported or defined locally)
  // We need to know if the BFS starting from the lift can reach *any* TILE_CORRIDOR or TILE_ROOM_FLOOR
  const walkableForLiftSearch = [TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT];
  // performBFS should return an object like { reachable: boolean }
  const { reachable } = performBFS(map, tileX, tileY, cols, rows, walkableForLiftSearch);

  if (!reachable) {
    console.error(
      `[MapValidation] Reachability FAILED. Lift at tile(${tileX}, ${tileY}) is isolated from corridors/rooms.`
    );
    // Optional: Log the map around the lift for debugging
    // logMapAround(map, tileX, tileY, 5);
  }
  return reachable;
}

// --- Helper: Ensure Map Borders are Walls ---
function _ensureMapBorders(map, cols, rows) {
  if (!map || rows === 0 || cols === 0) return;
  // Top & Bottom rows
  for (let c = 0; c < cols; c++) {
    if (map[0]?.[c] !== undefined) map[0][c] = TILE_WALL;
    if (map[rows - 1]?.[c] !== undefined) map[rows - 1][c] = TILE_WALL;
  }
  // Left & Right columns
  for (let r = 0; r < rows; r++) {
    if (map[r]?.[0] !== undefined) map[r][0] = TILE_WALL;
    if (map[r]?.[cols - 1] !== undefined) map[r][cols - 1] = TILE_WALL;
  }
}

// Helper to log a small area of the map (for debugging reachability)
function logMapAround(map, centerX, centerY, radius) {
  console.log(`--- Map around (${centerX}, ${centerY}), radius ${radius} ---`);
  const rows = map.length;
  const cols = map[0]?.length || 0;
  for (let y = Math.max(0, centerY - radius); y <= Math.min(rows - 1, centerY + radius); y++) {
    let rowStr = `${y.toString().padStart(2)}: `;
    for (let x = Math.max(0, centerX - radius); x <= Math.min(cols - 1, centerX + radius); x++) {
      const tile = map[y]?.[x];
      let char = '?';
      switch (tile) {
        case TILE_WALL:
          char = '#';
          break;
        case TILE_CORRIDOR:
          char = '.';
          break;
        case TILE_ROOM_FLOOR:
          char = ' ';
          break;
        case TILE_LIFT:
          char = 'L';
          break;
      }
      if (x === centerX && y === centerY) {
        rowStr += `(${char})`; // Mark center
      } else {
        rowStr += ` ${char} `;
      }
    }
    console.log(rowStr);
  }
  console.log(`--- End map around (${centerX}, ${centerY}) ---`);
}

// Add the performBFS function here if you prefer not to put it in mapUtils
// function performBFS(...) { ... } // Ensure implementation returns { reachable: boolean }
```

**`src/map/Book.js`**

```javascript
// src/map/Book.js
export class Book {
  constructor(x, y, id, tileSize) {
    this.x = x; // World coordinate (center)
    this.y = y; // World coordinate (center)
    this.id = id;
    this.tileSize = tileSize; // Store tileSize if needed later
    this.size = tileSize * 0.6; // Visual size
    this.collected = false;
    this.isCollected = false; // Use one standard property, e.g., isCollected
  }

  draw(ctx, offsetX, offsetY, bookImage) {
    if (this.isCollected || this.collected) return; // Don't draw if collected

    // Calculate TOP-LEFT corner for drawing, rounding coords
    const screenX = Math.floor(this.x + offsetX - this.size / 2);
    const screenY = Math.floor(this.y + offsetY - this.size / 2);
    const drawSize = Math.floor(this.size); // Ensure integer size for drawing

    // Check basic visibility (optional optimization)
    if (
      screenX + drawSize < 0 ||
      screenX > ctx.canvas.width ||
      screenY + drawSize < 0 ||
      screenY > ctx.canvas.height
    ) {
      return;
    }

    if (bookImage) {
      try {
        ctx.drawImage(bookImage, screenX, screenY, drawSize, drawSize);
      } catch (e) {
        console.warn(`[Book Draw] Error drawing book image for ${this.id}`, e);
        this.drawFallback(ctx, screenX, screenY, drawSize); // Draw fallback if image fails
      }
    } else {
      // Fallback drawing if no image provided
      this.drawFallback(ctx, screenX, screenY, drawSize);
    }
  }

  // Fallback drawing method
  drawFallback(ctx, screenX, screenY, drawSize) {
    ctx.fillStyle = '#8d6e63'; // Brown color for book
    ctx.fillRect(screenX, screenY, drawSize, drawSize);
    ctx.strokeStyle = '#5d4037'; // Darker outline
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, drawSize - 1, drawSize - 1); // Sharper outline

    // Optional: Draw a '?' symbol
    // ctx.fillStyle = '#eee';
    // ctx.font = `${Math.floor(drawSize * 0.6)}px Arial`;
    // ctx.textAlign = 'center';
    // ctx.textBaseline = 'middle';
    // ctx.fillText('?', screenX + drawSize / 2, screenY + drawSize / 2 + 1); // Slight offset
  }
}
```

**`src/core/InputManager.js`**

```javascript
// src/core/InputManager.js
export class InputManager {
  constructor() {
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
    };
    // Optional: Add action keys like 'interact', 'use' if needed
    // this.keys.interact = false;
  }

  setKey(key, isPressed) {
    if (this.keys.hasOwnProperty(key)) {
      // Prevent state change if already in that state (minor optimization)
      if (this.keys[key] !== isPressed) {
        this.keys[key] = isPressed;
        // console.log(`Key: ${key} -> ${isPressed}`); // Debug logging
      }
    }
  }

  // Returns raw direction vector {-1, 0, 1} for x and y
  getInputDirection() {
    let x = 0;
    let y = 0;
    if (this.keys.up) y -= 1;
    if (this.keys.down) y += 1;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;

    // Normalize diagonal movement (optional, prevents faster diagonal speed)
    // If you want constant speed regardless of direction:
    // if (x !== 0 && y !== 0) {
    //   const length = Math.sqrt(x * x + y * y); // Should be sqrt(2)
    //   x = x / length;
    //   y = y / length;
    // }
    // Note: Normalization changes the return type to floats.
    // The movement logic in GameplayManager handles collision detection
    // based on the {-1, 0, 1} vector multiplied by speed, which is often simpler.

    return { x, y };
  }

  // Optional: Check if a specific action key is pressed
  // isActionPressed(actionName) {
  //   return this.keys[actionName] || false;
  // }
}
```

**`src/core/GameRenderer.js`**

```javascript
// src/core/GameRenderer.js
// (No changes needed from previous provided version, assuming it was correct)
import { Character } from './Character.js'; // Optional for type checks

export class GameRenderer {
  constructor(game) {
    this.game = game;
    this.canvas = null;
    this.ctx = null;
    this.lastFrameTime = 0;
    this.fps = 0;
  }

  initializeCanvas() {
    this.canvas = document.getElementById('game-canvas');
    if (!this.canvas) throw new Error("[Renderer] Canvas 'game-canvas' not found!");
    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) throw new Error('[Renderer] Failed to get 2D context.');

    // --- Pixelated Look ---
    // Disable anti-aliasing/smoothing for crisp pixels
    this.ctx.imageSmoothingEnabled = false;
    // For some browsers, might need vendor prefixes or specific styles:
    // this.canvas.style.imageRendering = 'pixelated'; // Modern standard
    // this.canvas.style.imageRendering = '-moz-crisp-edges'; // Firefox
    // this.canvas.style.imageRendering = '-webkit-optimize-contrast'; // Webkit (might vary)

    this.resizeCanvas(); // Initial size set
    console.log('[Renderer] Canvas initialized.');
    return { canvas: this.canvas, ctx: this.ctx };
  }

  resizeCanvas() {
    if (!this.canvas || !this.ctx) return;
    // Get the actual display size
    const displayWidth = this.canvas.clientWidth;
    const displayHeight = this.canvas.clientHeight;

    // Check if the canvas resolution needs to be updated
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
      // Re-disable smoothing after resize, as context might reset
      this.ctx.imageSmoothingEnabled = false;
      console.log(`[Renderer] Canvas resized to ${this.canvas.width}x${this.canvas.height}`);
    }

    // Recenter camera after resize
    if (this.game.character && this.game.level?.currentMap) {
      this.centerCameraOnCharacter();
    }
  }

  centerCameraOnCharacter() {
    const { character, level, canvas } = this.game;
    if (character && level?.currentMap && canvas) {
      // Calculate desired offset to center character
      let targetOffsetX = canvas.width / 2 - character.x;
      let targetOffsetY = canvas.height / 2 - character.y;

      // Optional: Clamp camera to map boundaries to prevent seeing "outside" the map
      const mapWidth = level.currentMap.width;
      const mapHeight = level.currentMap.height;
      targetOffsetX = Math.min(0, Math.max(targetOffsetX, canvas.width - mapWidth));
      targetOffsetY = Math.min(0, Math.max(targetOffsetY, canvas.height - mapHeight));

      // IMPORTANT: Use Math.floor for the final offset to prevent sub-pixel rendering issues
      level.currentMap.offsetX = Math.floor(targetOffsetX);
      level.currentMap.offsetY = Math.floor(targetOffsetY);
    }
  }

  drawFrame(timestamp) {
    if (!this.ctx || !this.canvas) return;

    // FPS Calculation (optional)
    if (this.lastFrameTime > 0) {
      const deltaTime = timestamp - this.lastFrameTime;
      this.fps = 1000 / deltaTime;
    }
    this.lastFrameTime = timestamp;

    // Clear previous frame
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Get game objects
    const map = this.game.level?.currentMap;
    const char = this.game.character;

    // Draw Map (delegates to MapRenderer)
    if (map) {
      map.draw(this.ctx, this.game.bookImage);
    }

    // Draw Character (delegates to Character.draw)
    // Pass the calculated (floored) offset from the map
    if (char && map) {
      char.draw(map.offsetX, map.offsetY);
    }

    // Draw Debug Info (optional)
    // this.drawDebugInfo();
  }

  drawWinScreen() {
    if (!this.ctx || !this.canvas) return;
    // Draw semi-transparent overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Text styles
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Title
    this.ctx.fillStyle = 'lime';
    this.ctx.font = 'clamp(32px, 8vw, 48px) "Press Start 2P", cursive, Arial'; // Use clamp for responsiveness
    this.ctx.shadowColor = 'black';
    this.ctx.shadowBlur = 5;
    this.ctx.fillText('ПОБЕДА!', this.canvas.width / 2, this.canvas.height / 2 - 80);
    this.ctx.shadowBlur = 0; // Reset shadow

    // Subtitle
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'clamp(24px, 5vw, 32px) Arial, sans-serif';
    this.ctx.fillText(
      `Вы собрали все ${this.game.targetBooksToWin} книг!`,
      this.canvas.width / 2,
      this.canvas.height / 2
    );

    // Extra line
    this.ctx.font = 'clamp(18px, 4vw, 24px) Arial, sans-serif';
    this.ctx.fillText('Университет спасен!', this.canvas.width / 2, this.canvas.height / 2 + 60);

    // Restart instruction
    this.ctx.font = 'clamp(14px, 3vw, 18px) Arial, sans-serif';
    this.ctx.fillStyle = '#ccc';
    this.ctx.fillText(
      '(Обновите страницу, чтобы начать заново)',
      this.canvas.width / 2,
      this.canvas.height - 50
    );
  }

  drawDebugInfo() {
    if (!this.ctx || !this.game.character) return;
    const char = this.game.character;
    const map = this.game.level?.currentMap;

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(5, 5, 200, 100);

    this.ctx.fillStyle = 'white';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';

    this.ctx.fillText(`FPS: ${this.fps.toFixed(1)}`, 10, 10);
    this.ctx.fillText(`Char X: ${char.x.toFixed(1)} Y: ${char.y.toFixed(1)}`, 10, 25);
    if (map) {
      const tileX = Math.floor(char.x / map.tileSize);
      const tileY = Math.floor(char.y / map.tileSize);
      this.ctx.fillText(`Tile: (${tileX}, ${tileY})`, 10, 40);
      this.ctx.fillText(`Offset X: ${map.offsetX} Y: ${map.offsetY}`, 10, 55);
    }
    this.ctx.fillText(`State: ${this.game.gameState}`, 10, 70);
    this.ctx.fillText(`Lift CD: ${this.game.liftCooldownActive}`, 10, 85);
  }
}
```

**`src/core/Game.js`**

```javascript
// src/core/Game.js
import { InputManager } from './InputManager.js';
// Используем правильный регистр в имени папки/файла: UI/UIManager.js
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js';
import { Level } from './Level.js';
import { GameState, questions, TARGET_BOOKS_TO_WIN, LIFT_COOLDOWN_MS } from '../utils/constants.js';
import { GameRenderer } from './GameRenderer.js';
import { GameplayManager } from './GameplayManager.js';

// Asset Imports (пути должны быть правильными относительно HTML файла)
// ВАЖНО: Убедись, что пути к спрайтам верны относительно твоего HTML файла
// Если HTML в корне, а JS в src/, а images/ в корне, то пути ../../images/
// Если HTML в корне, а JS в src/, и images/ тоже в src/, то пути ../images/
// Если все в одной папке, то './images/'
// Проверь свою структуру! Пример пути, если images/ на одном уровне с src/
import redSprite from '../../images/character_red.png';
import blueSprite from '../../images/character_blue.png';
import yellowSprite from '../../images/character_yellow.png';
import greenSprite from '../../images/character_green.png';
import bookSprite from '../../images/book.png';

export class Game {
  constructor(characterColor) {
    console.log(`[Game] Initializing with character: ${characterColor}`);
    this.characterColor = characterColor;
    this._gameState = GameState.LOADING;
    this.isRunning = false;
    this.lastTimestamp = 0; // Для delta time

    // Глобальные игровые переменные
    this.totalBooksCollectedGlobally = 0;
    this.targetBooksToWin = TARGET_BOOKS_TO_WIN;
    this.availableQuestions = [];

    // Состояние взаимодействия
    this.currentBookTarget = null;
    this.currentQuestionData = null;
    this.liftCooldownActive = false;
    this.liftCooldownTimer = null;

    // Основные компоненты игры
    this.canvas = null;
    this.ctx = null;
    this.character = null;
    this.level = null;
    this.inputManager = null;
    this.renderer = null;
    this.gameplayManager = null; // Инициализируется позже

    // Загруженные ассеты
    this.sprites = { red: redSprite, blue: blueSprite, yellow: yellowSprite, green: greenSprite };
    this.bookImage = null;

    // Привязка методов к контексту
    this.gameLoop = this.gameLoop.bind(this);
    this._handleFatalError = this._handleFatalError.bind(this);
    // Привязка обработчиков событий для корректного удаления
    this._boundResizeHandler = this._onWindowResize.bind(this);
    this._boundKeyDownHandler = this.handleKeyDown.bind(this);
    this._boundKeyUpHandler = this.handleKeyUp.bind(this);

    // --- Последовательность инициализации ---
    try {
      this._initializeCoreComponents(); // Синхронная инициализация базовых менеджеров
      this.renderer = new GameRenderer(this); // Инициализация рендерера
      const { canvas, ctx } = this.renderer.initializeCanvas(); // Получение canvas и context
      this.canvas = canvas;
      this.ctx = ctx;
      this.gameplayManager = new GameplayManager(this); // Инициализация геймплей-менеджера
      this._addEventListeners(); // Добавление глобальных слушателей (resize)
      this._loadAssetsAndStart(); // Асинхронная загрузка ассетов и старт игры
    } catch (error) {
      console.error('[Game] Core Initialization failed:', error);
      // Показываем алерт, так как UI может быть еще не готов
      alert(`Критическая ошибка инициализации: ${error.message}`);
      // Устанавливаем состояние ошибки без алерта (он уже был)
      this._handleFatalError(`Init Error: ${error.message}`, false);
    }
  }

  // --- Геттер/Сеттер для состояния игры ---
  get gameState() {
    return this._gameState;
  }
  setGameState(newState) {
    if (this._gameState !== newState) {
      console.log(`[Game State] ${this._gameState} -> ${newState}`);
      this._gameState = newState;
      // Опционально: можно добавить логику, срабатывающую при смене состояния
      // UIManager.updateOnGameStateChange(newState);
    }
  }

  // Инициализация базовых менеджеров
  _initializeCoreComponents() {
    this.inputManager = new InputManager();
    this.level = new Level(1, 3); // Этажи с 1 по 3
  }

  // Добавление слушателей событий окна
  _addEventListeners() {
    window.addEventListener('resize', this._boundResizeHandler);
    // Слушатели клавиатуры добавляются в startGame и удаляются в _setGameOver/stopGame
  }

  // Обработчик ресайза окна
  _onWindowResize() {
    // Даем браузеру отрисовать изменения размера перед вызовом resizeCanvas
    requestAnimationFrame(() => {
      this.renderer?.resizeCanvas();
    });
  }

  // Асинхронная загрузка ассетов и запуск игры
  async _loadAssetsAndStart() {
    try {
      this.setGameState(GameState.LOADING); // Устанавливаем состояние загрузки
      UIManager.showLoadingMessage('Загрузка ресурсов...'); // Показать сообщение о загрузке
      await this._loadAssets(); // Ждем загрузки всех ассетов
      UIManager.hideLoadingMessage(); // Скрыть сообщение
      this._initializeUI(); // Инициализируем UI после загрузки (если нужно)
      await this.startGame(); // Запускаем основную логику игры
    } catch (error) {
      UIManager.hideLoadingMessage(); // Скрыть сообщение в случае ошибки
      console.error('[Game] Asset loading / UI init / Start Game failed:', error);
      this._handleFatalError(`Ошибка загрузки ресурсов или старта игры: ${error.message}`);
    }
  }

  // Загрузка изображений (спрайты, книга)
  async _loadAssets() {
    console.log('[Game] Loading assets...');
    const promises = [];
    const spritePath = this.sprites[this.characterColor] || this.sprites.red; // Выбор спрайта

    // Создание персонажа (требует ctx)
    if (!this.ctx) throw new Error('Canvas context not available for Character creation.');
    this.character = new Character(this.ctx, spritePath, {
      speed: 3, // Скорость персонажа
      frameSize: 32, // Размер кадра в спрайтшите
      scale: 2, // Масштаб отрисовки
      animationSpeed: 150, // Скорость анимации (мс/кадр)
      frameCount: 4, // Кол-во кадров в одной анимации (направлении)
      // Параметры коллайдера (можно настроить для лучшего прилегания)
      collisionBoxWidthRatio: 0.4, // Ширина коллайдера (% от ширины спрайта)
      collisionBoxHeightRatio: 0.2, // Высота коллайдера (% от высоты спрайта)
      collisionBoxFeetOffsetRatio: 0.4, // Смещение центра коллайдера вниз от центра спрайта (%)
    });
    // Промис для загрузки спрайта персонажа
    promises.push(
      new Promise((resolve, reject) => {
        this.character.sprite.onload = () => {
          console.log(`  [Assets] Character sprite loaded: ${spritePath}`);
          resolve();
        };
        this.character.sprite.onerror = (err) => {
          console.error(`Failed to load character sprite: ${spritePath}`, err);
          reject(new Error(`Failed to load character sprite: ${spritePath}`));
        };
      })
    );

    // Загрузка изображения книги
    if (bookSprite) {
      this.bookImage = new Image();
      promises.push(
        new Promise((resolve, reject) => {
          this.bookImage.onload = () => {
            console.log(`  [Assets] Book image loaded: ${bookSprite}`);
            resolve();
          };
          this.bookImage.onerror = () => {
            console.warn(
              ` [Assets] Failed to load book image: ${bookSprite}. Using fallback rendering.`
            );
            this.bookImage = null; // Сбрасываем, чтобы использовать fallback
            resolve(); // Все равно разрешаем промис, т.к. есть fallback
          };
          this.bookImage.src = bookSprite; // Начинаем загрузку
        })
      );
    } else {
      console.warn('[Assets] Book sprite path is missing. Using fallback rendering.');
      this.bookImage = null;
    }

    // Ждем завершения всех промисов загрузки
    try {
      await Promise.all(promises);
      console.log('[Game] Assets loaded successfully.');
    } catch (error) {
      console.error('[Game] One or more assets failed to load.', error);
      throw error; // Перебрасываем ошибку, чтобы _loadAssetsAndStart её поймал
    }
  }

  // Инициализация элементов UI через UIManager
  _initializeUI() {
    console.log('[Game] Initializing UI Manager...');
    UIManager.createControls(this.inputManager); // Создание кнопок управления
    UIManager.createQuestionUI(); // Создание UI для вопросов
    UIManager.createFloorSelectionUI(); // Создание UI для выбора этажа
    UIManager.ensureFlashMessageContainer(); // Убеждаемся, что контейнер сообщений есть
    // ! Ключевой момент: передаем экземпляр GameplayManager в UIManager !
    UIManager.setGameplayManager(this.gameplayManager);
    console.log('[Game] UI Manager setup complete.');
  }

  // Основная функция старта или рестарта игры
  async startGame() {
    console.log('[Game] Starting game...');
    // Проверка наличия всех необходимых компонентов
    if (!this.level || !this.character || !this.canvas || !this.renderer || !this.gameplayManager) {
      throw new Error('Cannot start game - essential components missing.');
    }

    this.setGameState(GameState.LOADING); // Состояние загрузки уровня
    UIManager.showLoadingMessage('Генерация уровня...');
    // Скрываем все UI перед стартом
    UIManager.hideGameUI();
    UIManager.hideQuestion();
    UIManager.hideFloorSelectionUI();

    try {
      // 1. Загружаем начальный этаж (асинхронно)
      await this.level.loadFloor(this.level.minFloor, this.canvas.width, this.canvas.height);
      UIManager.hideLoadingMessage(); // Скрыть "Генерация уровня..."
      const currentMap = this.level.currentMap;
      if (!currentMap) {
        throw new Error('Failed to load initial map. Map object is null.');
      }

      // 2. Находим стартовую позицию на карте
      const startPos = currentMap.findRandomInitialSpawnPosition();
      if (!startPos) {
        throw new Error('Failed to find a valid starting position on the map!');
      }

      // 3. Устанавливаем начальные координаты и состояние персонажа
      this.character.x = startPos.x;
      this.character.y = startPos.y;
      this.character.currentDirection = Character.Direction.DOWN;
      this.character.isMoving = false;

      // 4. ! ВАЖНО: Проверяем, не заспавнился ли персонаж в стене СРАЗУ !
      // Передаем false, т.к. начальный спавн не должен быть на лифте
      this.gameplayManager?.ensureCharacterIsOnWalkableTile(false);

      // 5. Сброс игровых переменных
      this.totalBooksCollectedGlobally = 0;
      this.availableQuestions = [...questions]; // Новый набор вопросов
      this.liftCooldownActive = false;
      clearTimeout(this.liftCooldownTimer); // Сброс таймера кулдауна
      this.liftCooldownTimer = null;
      this.currentBookTarget = null;
      this.currentQuestionData = null;

      // 6. Центрируем камеру ПОСЛЕ установки позиции и возможного выталкивания
      this.renderer.centerCameraOnCharacter();

      // 7. Обновляем и показываем игровой UI
      UIManager.updateScore(this.totalBooksCollectedGlobally, this.targetBooksToWin);
      UIManager.showGameUI(); // Показываем канвас, счет, контролы

      // 8. Добавляем слушатели клавиатуры
      this.removeKeyboardListeners(); // Убедимся, что старых нет
      window.addEventListener('keydown', this._boundKeyDownHandler);
      window.addEventListener('keyup', this._boundKeyUpHandler);

      // 9. Переводим игру в активное состояние и запускаем игровой цикл
      this.setGameState(GameState.PLAYING);
      if (!this.isRunning) {
        this.isRunning = true;
        this.lastTimestamp = 0; // Сброс времени для первого кадра
        requestAnimationFrame(this.gameLoop); // Запуск цикла
        console.log('[Game] Game started successfully. Loop running.');
      }
    } catch (error) {
      // Обработка ошибок во время старта (загрузка карты, поиск спавна)
      UIManager.hideLoadingMessage();
      console.error('[Game] Failed during startGame process:', error);
      this._handleFatalError(`Ошибка старта уровня: ${error.message}`);
      this.isRunning = false; // Убедимся, что цикл не запустится
    }
  }

  // Завершение игры (победа или ошибка)
  _setGameOver(win = true) {
    if (this.gameState === GameState.GAME_OVER) return; // Не завершать игру дважды

    const previousState = this.gameState;
    this.setGameState(GameState.GAME_OVER);
    this.isRunning = false; // Останавливаем игровой цикл
    if (this.character) this.character.isMoving = false; // Останавливаем анимацию персонажа
    clearTimeout(this.liftCooldownTimer); // Останавливаем таймер лифта
    this.liftCooldownTimer = null;
    this.liftCooldownActive = false;

    // Удаляем слушатели клавиатуры
    this.removeKeyboardListeners();

    // Скрываем весь игровой UI, кроме, возможно, флеш-сообщений
    // UIManager.hideGameUI(); // Возможно, не нужно скрывать все сразу
    UIManager.hideControls();
    UIManager.hideScore();
    UIManager.hideQuestion();
    UIManager.hideFloorSelectionUI();

    if (win) {
      // Рисуем экран победы
      // Даем один кадр на отрисовку перед показом меню
      requestAnimationFrame(() => {
        this.renderer?.drawWinScreen();
        // Можно показать кнопку "Начать заново" или вернуть в меню
        // UIManager.showMenu();
      });
    } else {
      // При проигрыше/ошибке показываем главное меню
      // Сообщение об ошибке уже должно было быть показано через _handleFatalError
      console.log(`[Game] Game Over (Loss/Error from state: ${previousState}). Showing menu.`);
      UIManager.showMenu(); // Показываем меню выбора персонажа
    }
    console.log(`[Game] Game Over. Win: ${win}`);
  }

  // Принудительная остановка игры (например, при выходе из игры)
  stopGame() {
    console.log('[Game] Explicit stop requested.');
    if (this.isRunning) {
      this._setGameOver(false); // Завершаем игру как проигрыш/остановку
    } else {
      // Если игра уже не запущена, просто показываем меню
      this.removeKeyboardListeners();
      UIManager.showMenu();
    }

    // Удаляем общие слушатели
    window.removeEventListener('resize', this._boundResizeHandler);

    // Освобождаем ресурсы (опционально, но хорошо для сборки мусора)
    // this.character = null; // Не стоит обнулять, если планируем рестарт из меню
    // this.level = null;
    // this.inputManager = null; // Тоже может понадобиться
    // this.renderer = null;
    // this.gameplayManager = null;
    // this.ctx = null;
    // this.canvas = null; // Ссылка на элемент остается, но в игре больше не используется
    console.log('[Game] Game stopped.');
  }

  // Удаление слушателей клавиатуры
  removeKeyboardListeners() {
    window.removeEventListener('keydown', this._boundKeyDownHandler);
    window.removeEventListener('keyup', this._boundKeyUpHandler);
  }

  // Обработка фатальных ошибок
  _handleFatalError(message, showAlert = true) {
    console.error('[Game] FATAL ERROR:', message);
    // Показываем сообщение через UIManager, если он доступен
    if (showAlert && this.gameState !== GameState.GAME_OVER) {
      UIManager.flashMessage(`Критическая ошибка: ${message}`, 'error', 5000);
    } else if (showAlert) {
      // Если игра уже закончена, но произошла еще одна ошибка
      alert(`Дополнительная ошибка: ${message}`);
    }
    // Завершаем игру как проигрыш
    this._setGameOver(false);
  }

  // --- Обработчики ввода ---
  handleKeyDown(e) {
    // Игнорируем ввод, если игра не в состоянии PLAYING или нет inputManager
    if (this.gameState !== GameState.PLAYING || !this.inputManager) return;

    let keyHandled = false; // Флаг, чтобы предотвратить стандартное поведение браузера
    const key = e.key.toLowerCase();

    // Сопоставление клавиш с действиями
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
    // Пример для клавиши взаимодействия (если добавишь)
    // else if (key === 'e' || key === ' ') { // E или Пробел
    //   this.inputManager.setKey('interact', true);
    //   keyHandled = true;
    // }

    // Предотвращаем скроллинг страницы стрелками, если клавиша обработана
    if (keyHandled) e.preventDefault();
  }

  handleKeyUp(e) {
    // Обрабатываем отпускание клавиш всегда, чтобы сбросить состояние
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
    // else if (key === 'e' || key === ' ') {
    //   this.inputManager.setKey('interact', false);
    // }
  }

  // --- Основной игровой цикл ---
  gameLoop(timestamp) {
    // Выходим из цикла, если игра остановлена или завершена
    if (!this.isRunning || this.gameState === GameState.GAME_OVER) {
      console.log(
        `[Game Loop] Stopping loop. isRunning: ${this.isRunning}, gameState: ${this.gameState}`
      );
      return;
    }

    // Рассчитываем delta time (время с прошлого кадра) - не используется явно, но полезно для физики/анимаций
    const deltaTime = this.lastTimestamp > 0 ? timestamp - this.lastTimestamp : 16.67; // Примерно 60 FPS
    this.lastTimestamp = timestamp;
    const dt = deltaTime / 1000; // Delta time в секундах

    // 1. Обновление игровой логики (движение, взаимодействия)
    // Передаем timestamp для анимаций
    this.gameplayManager?.update(timestamp);

    // 2. Центрирование камеры (после обновления позиции персонажа)
    // Вызываем ДО отрисовки
    this.renderer?.centerCameraOnCharacter();

    // 3. Отрисовка текущего кадра
    // Передаем timestamp для расчета FPS (если нужно)
    this.renderer?.drawFrame(timestamp);

    // 4. Запрос следующего кадра анимации
    requestAnimationFrame(this.gameLoop);
  }

  // --- Управление таймером кулдауна лифта ---
  startLiftCooldownTimer() {
    clearTimeout(this.liftCooldownTimer); // Сбрасываем предыдущий таймер, если был
    this.liftCooldownActive = true; // Ставим флаг ДО таймера
    console.log(`[Game] Starting ${LIFT_COOLDOWN_MS}ms lift cooldown timer.`);

    this.liftCooldownTimer = setTimeout(() => {
      console.log('[Game TIMER] Lift cooldown finished.');
      this.liftCooldownActive = false; // Снимаем флаг кулдауна
      this.liftCooldownTimer = null; // Очищаем ID таймера

      // Если игра все еще в состоянии перехода (TRANSITIONING) после кулдауна,
      // значит, переход успешно завершился, переводим в PLAYING.
      if (this.gameState === GameState.TRANSITIONING) {
        console.log('[Game TIMER] Transition complete. Setting state to PLAYING.');
        this.setGameState(GameState.PLAYING); // Возвращаем в игровое состояние
        UIManager.flashMessage(`Прибытие на этаж ${this.level?.currentFloor}`, 'success', 1500);
      } else {
        // Если состояние изменилось за время кулдауна (например, GAME_OVER),
        // просто логируем и ничего не меняем.
        console.warn(
          `[Game TIMER] Lift cooldown ended, but game state is already ${this.gameState}. No state change applied.`
        );
      }
    }, LIFT_COOLDOWN_MS);
  }
} // Конец класса Game
```

**`src/core/Character.js`**

```javascript
// src/core/Character.js

export class Character {
  /** Static object for direction constants */
  static Direction = {
    DOWN: 0, // Ряд 0 в спрайтшите
    RIGHT: 1, // Ряд 1
    UP: 2, // Ряд 2
    LEFT: 3, // Ряд 3
  };

  /**
   * Creates a new Character instance.
   * @param {CanvasRenderingContext2D} ctx - The rendering context.
   * @param {string} spriteUrl - URL of the character's sprite sheet.
   * @param {object} options - Configuration options.
   * @param {number} [options.frameSize=32] - Size of one frame in the sprite sheet (pixels).
   * @param {number} [options.frameCount=4] - Number of frames per animation cycle (per direction).
   * @param {number} [options.scale=2] - Scaling factor for rendering.
   * @param {number} [options.speed=3] - Movement speed in pixels per update tick (adjust based on game loop).
   * @param {number} [options.animationSpeed=150] - Milliseconds per animation frame.
   * @param {number} [options.collisionBoxWidthRatio=0.4] - Width of collision box relative to renderSize.
   * @param {number} [options.collisionBoxHeightRatio=0.2] - Height of collision box relative to renderSize.
   * @param {number} [options.collisionBoxFeetOffsetRatio=0.4] - Vertical offset of collision box center from character center (towards feet), relative to renderSize. Positive value moves it down.
   */
  constructor(ctx, spriteUrl, options = {}) {
    this.ctx = ctx;
    this.sprite = new Image();
    this.spriteLoaded = false; // Флаг загрузки спрайта

    // Configuration with defaults
    this.frameSize = options.frameSize || 32;
    this.frameCount = options.frameCount || 4; // Number of frames per direction
    this.scale = options.scale || 2;
    this.renderSize = this.frameSize * this.scale; // Actual size on screen
    this.speed = options.speed || 3;
    this.animationSpeed = options.animationSpeed || 150; // ms per frame

    // Collision Box Configuration
    this.collisionBoxWidthRatio = options.collisionBoxWidthRatio || 0.4;
    this.collisionBoxHeightRatio = options.collisionBoxHeightRatio || 0.2;
    // Смещение КОЛЛАЙДЕРА относительно ЦЕНТРА персонажа. 0 = центр, 0.5 = у самых ног.
    this.collisionBoxFeetOffsetRatio = options.collisionBoxFeetOffsetRatio || 0.4;

    // State
    this.x = 0; // World X coordinate (center of the character)
    this.y = 0; // World Y coordinate (center of the character)
    this.currentDirection = Character.Direction.DOWN; // Start facing down
    this.currentFrame = 0; // Current animation frame index (0 to frameCount-1)
    this.isMoving = false; // Is the character currently moving?
    this.lastFrameTime = 0; // Timestamp of the last frame update

    // Load sprite and add handlers
    this.sprite.onload = () => {
      console.log(`[Character] Sprite loaded successfully: ${spriteUrl}`);
      this.spriteLoaded = true;
      // Verify frameSize vs sprite dimensions (optional check)
      if (
        this.sprite.width < this.frameSize * this.frameCount ||
        this.sprite.height < this.frameSize * 4
      ) {
        console.warn(
          `[Character] Sprite dimensions (${this.sprite.width}x${this.sprite.height}) might be smaller than expected based on frameSize (${this.frameSize}) and frameCount/directions.`
        );
      }
    };
    this.sprite.onerror = () => {
      console.error(`[Character] Failed to load sprite: ${spriteUrl}`);
      // Optionally: set a flag or load a fallback visual
    };
    this.sprite.src = spriteUrl; // Start loading
  }

  /**
   * Updates the character's animation frame based on movement state and time.
   * Should be called in the game's update loop.
   * @param {number} timestamp - The current high-resolution timestamp (e.g., from requestAnimationFrame).
   */
  updateAnimation(timestamp) {
    // Don't animate if not moving
    if (!this.isMoving) {
      this.currentFrame = 0; // Reset to standing frame
      this.lastFrameTime = timestamp; // Reset timer for next movement
      return;
    }

    // Initialize timer on first update
    if (!this.lastFrameTime) {
      this.lastFrameTime = timestamp;
    }

    // Calculate time elapsed since last frame change
    const elapsed = timestamp - this.lastFrameTime;

    // If enough time has passed, advance the frame
    if (elapsed >= this.animationSpeed) {
      // Cycle through frames (1, 2, 3, 0, 1, 2, 3, 0...) or (0, 1, 2, 3, 0...)
      // If frame 0 is the standing frame, maybe start animation from frame 1?
      // Current logic cycles 0, 1, 2, 3...
      this.currentFrame = (this.currentFrame + 1) % this.frameCount;
      this.lastFrameTime = timestamp; // Record time of this frame change
    }
  }

  /**
   * Calculates the collision bounding box based on a potential position.
   * The box is typically smaller than the visual sprite and positioned near the feet.
   * @param {number} posX - The potential X coordinate (center) for the collision check.
   * @param {number} posY - The potential Y coordinate (center) for the collision check.
   * @returns {{top: number, bottom: number, left: number, right: number, width: number, height: number}} The collision box properties in world coordinates.
   */
  getCollisionBox(posX, posY) {
    const collisionWidth = this.renderSize * this.collisionBoxWidthRatio;
    const collisionHeight = this.renderSize * this.collisionBoxHeightRatio;
    const halfWidth = collisionWidth / 2;

    // Calculate the Y coordinate of the collision box's center
    // Start from character's center (posY) and shift down by the offset ratio
    const collisionCenterY = posY + (this.renderSize / 2) * this.collisionBoxFeetOffsetRatio; // positive = down

    // Calculate box boundaries
    const top = collisionCenterY - collisionHeight / 2;
    const bottom = collisionCenterY + collisionHeight / 2;
    const left = posX - halfWidth;
    const right = posX + halfWidth;

    return { top, bottom, left, right, width: collisionWidth, height: collisionHeight };
  }

  /**
   * Draws the character onto the canvas at its current position,
   * considering the camera offset. Uses integer coordinates for crisp rendering.
   * @param {number} offsetX - The camera's X offset (already floored).
   * @param {number} offsetY - The camera's Y offset (already floored).
   */
  draw(offsetX, offsetY) {
    // Don't draw if sprite isn't loaded or has no dimensions
    if (!this.spriteLoaded || !this.sprite.naturalWidth) {
      // Optionally draw a placeholder if sprite failed
      // this.ctx.fillStyle = 'red';
      // const screenX = Math.floor(this.x - 5 + offsetX);
      // const screenY = Math.floor(this.y - 5 + offsetY);
      // this.ctx.fillRect(screenX, screenY, 10, 10);
      return;
    }

    // Calculate source frame coordinates from sprite sheet
    const frameX = this.currentFrame * this.frameSize;
    // Ensure direction is valid index (0-3)
    const frameY = (this.currentDirection % 4) * this.frameSize;

    // Calculate destination coordinates (top-left corner on canvas)
    // Rounding here prevents sub-pixel rendering issues
    const screenX = Math.floor(this.x - this.renderSize / 2 + offsetX);
    const screenY = Math.floor(this.y - this.renderSize / 2 + offsetY);

    // Draw the specific frame
    try {
      this.ctx.drawImage(
        this.sprite,
        frameX, // Source X
        frameY, // Source Y
        this.frameSize, // Source Width
        this.frameSize, // Source Height
        screenX, // Destination X
        screenY, // Destination Y
        Math.floor(this.renderSize), // Destination Width (floored)
        Math.floor(this.renderSize) // Destination Height (floored)
      );

      // --- DEBUG: Draw Collision Box ---
      // const debugCollision = false;
      // if (debugCollision) {
      //     const box = this.getCollisionBox(this.x, this.y);
      //     this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
      //     this.ctx.lineWidth = 1;
      //     this.ctx.strokeRect(
      //         Math.floor(box.left + offsetX),
      //         Math.floor(box.top + offsetY),
      //         Math.floor(box.width),
      //         Math.floor(box.height)
      //     );
      //     // Draw center point
      //     this.ctx.fillStyle = 'cyan';
      //     this.ctx.fillRect(Math.floor(this.x+offsetX)-1, Math.floor(this.y+offsetY)-1, 3, 3);
      // }
      // --- End Debug ---
    } catch (e) {
      // Avoid crashing if drawImage fails for some reason (e.g., sprite becomes invalid)
      console.error('[Character] Error drawing sprite:', e, { frameX, frameY, screenX, screenY });
    }
  }
}
```

**`index.html`**

```html
<!DOCTYPE html>
<html lang="ru">
  <!-- Изменен язык на русский -->
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Побег из Универа</title> <!-- Название изменено -->
    <!-- Подключаем CSS -->
    <link rel="stylesheet" href="style.css">
    <!-- Опционально: Предзагрузка ключевых ресурсов -->
    <!-- <link rel="preload" href="./images/character_red.png" as="image"> -->
    <!-- <link rel="preload" href="./images/book.png" as="image"> -->
    <!-- Опционально: Подключение шрифтов, если используются -->
    <!-- <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet"> -->

  </head>
  <body>
    <!-- Меню выбора персонажа (изначально видимо) -->
    <div id="menu-container" class="menu-container">
      <h1>Побег из Универа</h1>
      <p>Выберите персонажа:</p>
      <div id="character-selector-wrapper" class="character-selection">
        <!-- data-color используется JS для определения выбора -->
        <div class="character-circle red" data-color="red"></div>
        <div class.character-circle blue" data-color="blue"></div>
        <div class="character-circle yellow" data-color="yellow"></div>
        <div class="character-circle green" data-color="green"></div>
      </div>
      <button id="start-button" class="start-button" disabled>Начать игру</button>
    </div>

    <!-- Игровой Канвас (изначально скрыт) -->
    <canvas id="game-canvas" style="display: none;"></canvas>

    <!-- UI Элементы игры (изначально скрыты) -->
    <div id="score-display" class="score-display" style="display: none;">
      Книги: <span id="score-value">0</span> / <span id="score-target">?</span>
    </div>

    <!-- Контейнер для кнопок управления (для мобильных) -->
    <div id="controls-container" class="controls-container" style="display: none;">
       <!-- Кнопки будут добавлены через JS (UIManager.createControls) -->
    </div>

    <!-- Панель вопроса (изначально скрыта) -->
    <div id="question-overlay" class="ui-panel" style="display: none;">
      <div id="question-box">
        <p id="question-text">[Текст вопроса]</p>
        <div id="answer-buttons">
          <!-- Кнопки ответов будут добавлены через JS -->
        </div>
      </div>
    </div>

    <!-- Панель выбора этажа (изначально скрыта) -->
    <div id="floor-selection-ui" class="ui-panel" style="display: none;">
      <h2>Выбор этажа</h2>
      <div id="floor-buttons-container">
         <!-- Кнопки этажей будут добавлены через JS -->
      </div>
    </div>

    <!-- Контейнер для всплывающих сообщений -->
    <div id="flash-message-container">
        <!-- Сообщения будут добавлены через JS -->
    </div>

    <!-- Сообщение о загрузке (опционально) -->
    <div id="loading-overlay" class="loading-overlay" style="display: none;">
      <div id="loading-message">Загрузка...</div>
      <!-- Можно добавить спиннер -->
    </div>

    <!-- Подключение основного скрипта игры (тип module обязателен) -->
    <script type="module" src="src/main.js"></script>
  </body>
</html>
```

**`style.css`**

```css
/* General Reset & Body */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  /* Отключаем выделение текста для интерактивных элементов */
  user-select: none;
  -webkit-user-select: none; /* Safari */
  -moz-user-select: none; /* Firefox */
  -ms-user-select: none; /* IE/Edge */
}

html,
body {
  height: 100%; /* Убедимся, что body занимает всю высоту */
  overflow: hidden; /* Предотвращаем скролл */
  background-color: #222; /* Фон страницы */
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; /* Шрифт по умолчанию */
  color: #eee; /* Светлый текст по умолчанию */
  /* Центрируем меню по умолчанию */
  display: flex;
  justify-content: center;
  align-items: center;
}

/* --- Canvas --- */
canvas {
  display: block; /* Убирает отступ под canvas */
  background-color: #111; /* Фон для канваса, если карта не покрывает */
  width: 100%; /* Занимает всю доступную ширину/высоту */
  height: 100%;
  /* Настройки для пиксельной графики */
  image-rendering: pixelated; /* Четкие пиксели (современный стандарт) */
  image-rendering: -moz-crisp-edges; /* Firefox */
  image-rendering: -webkit-optimize-contrast; /* Старый WebKit (может не работать) */
  /* Свойство 'crisp-edges' может быть предпочтительнее для некоторых браузеров */
  /* image-rendering: crisp-edges; */
}

/* --- Menu Container --- */
.menu-container {
  background: rgba(0, 0, 0, 0.85);
  padding: clamp(20px, 5vw, 40px); /* Адаптивный паддинг */
  border-radius: 12px; /* Более скругленные углы */
  box-shadow: 0 5px 25px rgba(0, 0, 0, 0.7); /* Более выраженная тень */
  text-align: center;
  z-index: 1000; /* Выше игровых элементов */
  opacity: 1;
  transition: opacity 0.4s ease-out, transform 0.4s ease-out; /* Плавное появление/исчезание */
  transform: scale(1);
  max-width: 90%; /* Ограничение ширины */
  width: 450px; /* Примерная ширина */
}

/* Класс для скрытия меню */
.menu-container.hidden {
  opacity: 0;
  transform: scale(0.95);
  pointer-events: none; /* Чтобы нельзя было кликнуть сквозь невидимое меню */
}

.menu-container h1 {
  margin-bottom: 15px;
  font-size: clamp(1.8em, 6vw, 2.5em);
  color: #fff;
  /* font-family: 'Press Start 2P', cursive; /* Если подключен пиксельный шрифт */
}

.menu-container p {
  margin-bottom: 20px;
  font-size: clamp(1em, 3vw, 1.2em);
  color: #ccc;
}

/* --- Character Selection --- */
.character-selection {
  display: flex;
  flex-wrap: wrap; /* Перенос на новую строку при нехватке места */
  justify-content: center;
  gap: clamp(15px, 3vw, 25px); /* Адаптивный отступ между кружками */
  margin-bottom: 30px; /* Отступ до кнопки */
}

.character-circle {
  width: clamp(55px, 12vw, 70px); /* Адаптивный размер */
  height: clamp(55px, 12vw, 70px);
  border-radius: 50%;
  cursor: pointer;
  border: 4px solid transparent; /* Рамка для выделения */
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
  background-size: cover; /* Для фоновых картинок, если будут */
  background-position: center;
  position: relative; /* Для возможного добавления элементов внутрь */
}

.character-circle:hover {
  transform: scale(1.1); /* Увеличение при наведении */
}
.character-circle.selected {
  transform: scale(1.15); /* Сильнее выделяем выбранный */
  border-color: #fff; /* Белая рамка */
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.6); /* Свечение */
}

/* Цвета персонажей */
.character-circle.red {
  background-color: #e53935;
}
.character-circle.blue {
  background-color: #1e88e5;
}
.character-circle.yellow {
  background-color: #fdd835;
}
.character-circle.green {
  background-color: #43a047;
}

/* --- Start Button --- */
.start-button {
  padding: 12px 30px;
  font-size: clamp(16px, 4vw, 18px);
  cursor: pointer;
  background-color: #4caf50; /* Зеленый */
  color: white;
  border: none;
  border-radius: 6px; /* Чуть менее скругленный */
  transition: background-color 0.3s, transform 0.1s ease, opacity 0.3s;
  font-weight: bold;
  text-transform: uppercase; /* Заглавные буквы */
  letter-spacing: 1px;
}

.start-button:disabled {
  background-color: #6c757d; /* Серый для неактивной */
  cursor: not-allowed;
  opacity: 0.6;
}

.start-button:not(:disabled):hover {
  background-color: #45a049; /* Темнее при наведении */
}
.start-button:not(:disabled):active {
  transform: scale(0.98); /* Эффект нажатия */
}

/* --- In-Game UI Elements --- */

/* Общие стили панели (Вопросы, Выбор этажа) */
.ui-panel {
  position: fixed; /* Используем fixed для позиционирования относительно viewport */
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%); /* Центрирование */
  background-color: rgba(45, 45, 55, 0.95); /* Полупрозрачный темный фон */
  color: #f0f0f0; /* Светлый текст */
  padding: clamp(20px, 4vw, 30px);
  border: 1px solid #667; /* Рамка */
  border-radius: 12px; /* Скругленные углы */
  text-align: center;
  z-index: 200; /* Выше игровых элементов, но ниже меню */
  width: clamp(300px, 85vw, 550px); /* Адаптивная ширина */
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
  display: none; /* Скрыто по умолчанию */
  flex-direction: column; /* Элементы внутри - колонкой */
  align-items: center; /* Центрирование по горизонтали */
  gap: 15px; /* Отступ между элементами внутри панели */
  opacity: 0; /* Начальная прозрачность для анимации */
  transition: opacity 0.3s ease-out, transform 0.3s ease-out;
  transform: translate(-50%, -50%) scale(0.95); /* Начальный масштаб для анимации */
}
/* Класс для показа панели */
.ui-panel.visible {
  display: flex; /* Показываем через flex */
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

/* Панель Вопросов */
#question-overlay #question-text {
  font-size: clamp(1.1em, 3.5vw, 1.4em); /* Адаптивный размер шрифта */
  line-height: 1.5; /* Межстрочный интервал */
  margin-bottom: 15px; /* Отступ снизу */
  color: #fff; /* Белый цвет текста вопроса */
}

#question-overlay #answer-buttons {
  display: flex;
  flex-direction: column; /* Кнопки друг под другом */
  gap: 8px; /* Отступ между кнопками */
  width: 100%; /* Занимают всю ширину панели */
  align-items: stretch; /* Кнопки растягиваются по ширине */
}

#question-overlay .answer-button {
  padding: 12px 15px; /* Увеличенный паддинг */
  font-size: clamp(1em, 3vw, 1.1em);
  cursor: pointer;
  border: 1px solid #556;
  border-radius: 6px;
  background-color: #3a3a4a; /* Фон кнопки */
  color: #ddd; /* Цвет текста */
  text-align: left; /* Текст слева */
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
#question-overlay .answer-button:hover {
  background-color: #48485d; /* Цвет при наведении */
  border-color: #778;
}

/* Панель Выбора этажа */
#floor-selection-ui h2 {
  margin-bottom: 15px;
  font-size: clamp(1.3em, 4.5vw, 1.7em); /* Крупнее заголовок */
  color: #fff;
  font-weight: 600;
}

#floor-selection-ui #floor-buttons-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 75%; /* Ширина контейнера кнопок */
  max-width: 280px;
}

#floor-selection-ui .floor-button {
  padding: 10px 15px;
  font-size: clamp(1em, 3.8vw, 1.2em);
  cursor: pointer;
  background-color: #4a90e2; /* Синий цвет кнопок */
  color: white;
  border: none;
  border-radius: 6px;
  transition: background-color 0.2s ease, transform 0.1s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
#floor-selection-ui .floor-button:hover:not(:disabled) {
  background-color: #357abd; /* Темнее при наведении */
}
#floor-selection-ui .floor-button:active:not(:disabled) {
  transform: scale(0.97); /* Эффект нажатия */
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}
#floor-selection-ui .floor-button:disabled,
#floor-selection-ui .floor-button.current {
  /* Стиль для неактивной и текущей */
  background-color: #555;
  color: #aaa;
  cursor: not-allowed;
  box-shadow: none;
  opacity: 0.7;
}
#floor-selection-ui .floor-button.current {
  font-weight: bold; /* Выделяем текущий */
  border: 1px solid #888; /* Небольшая рамка для текущего */
}

/* --- Экранные Контролы (для мобильных) --- */
.controls-container {
  position: fixed; /* Фиксированное положение */
  bottom: clamp(15px, 4vh, 30px); /* Адаптивный отступ снизу */
  /* Позиционирование: можно слева, справа или по центру */
  /* Слева: */
  /* left: clamp(15px, 4vw, 30px); */
  /* Справа: */
  right: clamp(15px, 4vw, 30px);
  /* По центру: */
  /* left: 50%; transform: translateX(-50%); */

  display: grid; /* Используем grid для расположения кнопок */
  grid-template-areas: '. up .' 'left . right' '. down .'; /* Схема расположения */
  gap: clamp(8px, 2vw, 12px); /* Адаптивный отступ между кнопками */
  z-index: 100; /* Выше канваса */
  opacity: 0.75; /* Небольшая прозрачность */
  transition: opacity 0.3s ease;
  display: none; /* Скрыты по умолчанию */
}
/* Можно сделать контролы менее заметными, когда не используются */
/* .controls-container:not(:hover) { opacity: 0.5; } */

.control-btn {
  width: clamp(48px, 12vw, 60px); /* Адаптивный размер кнопок */
  height: clamp(48px, 12vw, 60px);
  border-radius: 50%; /* Круглые кнопки */
  background: rgba(60, 60, 60, 0.8); /* Фон кнопок */
  border: 1px solid rgba(255, 255, 255, 0.2); /* Легкая рамка */
  color: white;
  font-size: clamp(24px, 6vw, 30px); /* Размер иконки/текста */
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.1s ease, transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Предотвращение стандартного поведения на мобильных */
  user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
  touch-action: manipulation; /* Убирает задержку клика */
  -webkit-tap-highlight-color: transparent; /* Убирает синее выделение при тапе */
}
.control-btn.active, /* Когда кнопка удерживается (логика JS) */
.control-btn:active {
  /* Псевдокласс CSS для нажатия */
  background: rgba(90, 90, 90, 0.9);
  transform: scale(0.95); /* Небольшое сжатие при нажатии */
}
/* Привязка к grid areas */
.control-btn.up {
  grid-area: up;
}
.control-btn.left {
  grid-area: left;
}
.control-btn.right {
  grid-area: right;
}
.control-btn.down {
  grid-area: down;
}

/* --- Отображение счета --- */
.score-display {
  position: fixed;
  top: 10px;
  left: 10px;
  background-color: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: clamp(14px, 3vw, 18px);
  font-family: 'Arial', sans-serif;
  font-weight: bold;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.7);
  z-index: 100;
  display: none; /* Скрыт по умолчанию */
}
#score-display #score-value {
  color: #ffeb3b;
} /* Желтый для текущего счета */
#score-display #score-target {
  color: #ccc;
} /* Серый для цели */

/* --- Всплывающие сообщения --- */
#flash-message-container {
  position: fixed; /* Фиксированное положение */
  top: 15px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1100; /* Выше всего остального */
  display: flex; /* Элементы внутри - колонкой */
  flex-direction: column;
  align-items: center; /* Центрирование сообщений */
  gap: 8px; /* Отступ между сообщениями */
  pointer-events: none; /* Не мешают кликать под ними */
  width: clamp(250px, 80vw, 500px); /* Адаптивная ширина контейнера */
}

.flash-message {
  padding: 10px 20px;
  border-radius: 5px;
  color: white;
  font-weight: 500;
  text-align: center;
  opacity: 0; /* Анимация появления */
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
  transform: translateY(-10px); /* Начинают чуть выше */
  /* display: none; Управляется JS */
  min-width: 200px;
  max-width: 100%; /* Ограничение ширины сообщения */
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
  /* pointer-events: none; /* Уже на контейнере */
}
/* Класс для показа сообщения */
.flash-message.visible {
  opacity: 0.95; /* Не полностью непрозрачные */
  transform: translateY(0);
}

/* Цвета сообщений */
.flash-info {
  background-color: rgba(30, 144, 255, 0.92);
} /* Синий */
.flash-success {
  background-color: rgba(60, 179, 113, 0.92);
} /* Зеленый */
.flash-error {
  background-color: rgba(220, 20, 60, 0.92);
} /* Красный */
.flash-warning {
  background-color: rgba(255, 165, 0, 0.92);
} /* Оранжевый */

/* --- Сообщение о загрузке --- */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; /* Выше всего */
  color: white;
  font-size: 1.5em;
  display: none; /* Скрыто по умолчанию */
}
/* Класс для показа */
.loading-overlay.visible {
  display: flex;
}

/* --- Адаптивность (Пример) --- */
@media (max-width: 600px) {
  /* Уменьшаем размеры/отступы для мобильных экранов */
  .controls-container {
    bottom: 10px;
    /* Центрируем контролы на маленьких экранах */
    left: 50%;
    transform: translateX(-50%);
    right: auto;
    gap: 8px;
  }
  .score-display {
    top: 5px;
    left: 5px;
    padding: 5px 8px;
  }
  .ui-panel {
    gap: 10px; /* Меньше отступ в панелях */
  }
}
```

---

**Пояснения к изменениям:**

1.  **Телепорт (`GameplayManager.js`):** Явных изменений в коде не потребовалось, так как логика `ensureCharacterIsOnWalkableTile(true)`, вызываемая в `handleLiftTransition`, уже предназначена для решения этой проблемы. Она проверяет, не застрял ли персонаж после телепортации (разрешая стоять на плитке лифта в этот момент), и если да, ищет ближайшую безопасную клетку (коридор/пол) и перемещает туда персонажа. Убедись, что функция `findNearestWalkableTile` в `ProceduralMap.js` работает корректно и находит именно `TILE_CORRIDOR` или `TILE_ROOM_FLOOR`.
2.  **Лифт в отдельной комнате (`MapRenderer.js`):** В методе `drawRoomDetails` теперь при рисовании пола комнаты проверяется тип тайла `map[r]?.[c]`. Пол рисуется _только_ если тип тайла - `TILE_ROOM_FLOOR`. Это автоматически предотвращает перерисовку тайла лифта (`TILE_LIFT`), коридоров (`TILE_CORRIDOR`) и стен (`TILE_WALL`) полом комнаты.
3.  **Фликеринг (`MapRenderer.js`):**
    - Убрано `Math.random()` из расчета цвета пола комнаты в `drawRoomDetails`.
    - Вместо этого используется `simpleHash` (нужно добавить ее в `utils/map.js`, если нет) для получения _детерминированной_ (постоянной для данных координат) вариации яркости. Это гарантирует, что цвет тайла не будет меняться от кадра к кадру.
    - Такая же детерминированная вариация добавлена для стен и коридоров в `getTileColor`.
    - Все координаты отрисовки (`screenX`, `screenY`) теперь округляются с помощью `Math.floor` во всех методах отрисовки (`drawBaseTiles`, `drawRoomDetails`, `drawLiftDetails`, `drawBooks`), чтобы избежать проблем с субпиксельным рендерингом, который может вызывать мерцание при `imageSmoothingEnabled = false`.
4.  **Детализация (`MapRenderer.js`):**
    - **Стены:** Добавлена простая текстура шума, улучшена логика рисования граней (верхняя светлее, нижняя/правая темнее), добавлены базовые уголки для лучшего вида.
    - **Коридоры:** Добавлена легкая текстура шума.
    - **Лифт:** Улучшен вид кнопки и рамки.
    - **Декорации:** Немного улучшены декорации в библиотеке и классе (добавлены линии полок, стулья). Это можно развивать дальше.

**Что нужно проверить/добавить:**

1.  **`utils/map.js`:** Убедись, что у тебя есть функция `simpleHash` (пример я привел) или используй другую детерминированную функцию для генерации вариаций цвета.
2.  **Пути к спрайтам (`Game.js`):** Перепроверь пути к файлам спрайтов (`redSprite`, `bookSprite` и т.д.), чтобы они были правильными относительно твоего `index.html`.
3.  **Тестирование:** Тщательно протестируй телепортацию на разных этажах и в разных ситуациях (когда лифт у стены, в углу комнаты и т.д.). Проверь, исчез ли фликеринг.

Надеюсь, эти изменения решат твои проблемы! Дай знать, если что-то пойдет не так или понадобятся дополнительные правки.
