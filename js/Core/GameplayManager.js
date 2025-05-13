// src/core/GameplayManager.js
import {
  GameState,
  LIFT_COOLDOWN_MS,
  TILE_WALL,
  TILE_CORRIDOR,
  TILE_ROOM_FLOOR,
  TILE_LIFT,
  questions,
} from '../utils/constants.js';
import { UIManager } from '../UI/UIManager.js';
import { Character } from './Character.js'; // Убедитесь, что Character импортирован

const DEBUG_FLOOR_GM = 3; // Для логов GameplayManager

export class GameplayManager {
  constructor(game) {
    this.game = game;
    this.handleAnswer = this.handleAnswer.bind(this);
    this.handleFloorSelection = this.handleFloorSelection.bind(this);
  }

  update(timestamp) {
    if (this.game.gameState === GameState.PLAYING) {
      this.updatePlayingState(timestamp);
    }
  }

  updatePlayingState(timestamp) {
    const char = this.game.character;
    if (!this.game.level?.currentMap || !char || !this.game.inputManager) return;

    const { moved } = this.handleMovement();

    if (char && typeof char.updateAnimation === 'function') {
      char.updateAnimation(timestamp);
    }

    if (!moved && this.game.gameState === GameState.PLAYING) {
      this.handleInteractions();
    }
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
      const canMoveX = dx !== 0 && !this.checkCollision(char.x + dx, char.y);
      const canMoveY = dy !== 0 && !this.checkCollision(char.x, char.y + dy);

      if (canMoveX) actualMoveX = dx;
      if (canMoveY) actualMoveY = dy;

      // Улучшенная обработка диагональной коллизии (скольжение)
      if (dx !== 0 && dy !== 0) {
        // Если пытались двигаться по диагонали
        if (this.checkCollision(char.x + dx, char.y + dy)) {
          // И диагональ заблокирована
          if (canMoveX && !canMoveY) {
            // Можем по X, но не по Y (если бы двигались только по Y)
            actualMoveY = 0; // Двигаемся только по X
          } else if (canMoveY && !canMoveX) {
            // Можем по Y, но не по X
            actualMoveX = 0; // Двигаемся только по Y
          } else if (!canMoveX && !canMoveY) {
            // Не можем ни по X, ни по Y по отдельности
            actualMoveX = 0;
            actualMoveY = 0;
          }
          // Если можем и по X и по Y отдельно, но не по диагонали, то actualMoveX и actualMoveY уже установлены правильно
        }
      }

      if (actualMoveX !== 0 || actualMoveY !== 0) {
        char.x += actualMoveX;
        char.y += actualMoveY;
        moved = true;

        if (Math.abs(actualMoveX) >= Math.abs(actualMoveY)) {
          if (actualMoveX !== 0)
            char.currentDirection =
              actualMoveX > 0 ? Character.Direction.RIGHT : Character.Direction.LEFT;
        } else {
          if (actualMoveY !== 0)
            char.currentDirection =
              actualMoveY > 0 ? Character.Direction.DOWN : Character.Direction.UP;
        }
      }
    }
    char.isMoving = moved;
    return { moved };
  }

  checkCollision(targetX, targetY) {
    const map = this.game.level?.currentMap;
    const char = this.game.character;
    if (!map || !char) return true;

    const collisionBox = char.getCollisionBox(targetX, targetY);
    // Ключевые точки коллайдера для проверки
    const pointsToCheck = [
      { x: collisionBox.left, y: collisionBox.top }, // Левый верхний
      { x: collisionBox.right, y: collisionBox.top }, // Правый верхний
      { x: collisionBox.left, y: collisionBox.bottom }, // Левый нижний
      { x: collisionBox.right, y: collisionBox.bottom }, // Правый нижний
      // Дополнительные точки для более точной проверки, особенно для узких проходов
      { x: targetX, y: collisionBox.top }, // Центр верхний
      { x: targetX, y: collisionBox.bottom }, // Центр нижний
      { x: collisionBox.left, y: targetY + char.renderSize * char.collisionBoxFeetOffsetRatio }, // Середина левой стороны (на уровне ног)
      { x: collisionBox.right, y: targetY + char.renderSize * char.collisionBoxFeetOffsetRatio }, // Середина правой стороны (на уровне ног)
    ];

    for (const point of pointsToCheck) {
      if (!map.isWalkable(point.x, point.y)) {
        // console.log(`Collision at world (${point.x.toFixed(1)}, ${point.y.toFixed(1)}) -> tile not walkable.`);
        return true;
      }
    }
    return false;
  }

  handleInteractions() {
    const map = this.game.level?.currentMap;
    const char = this.game.character;
    if (!map || !char || this.game.gameState !== GameState.PLAYING) return;

    const nearbyBook = map.findNearbyUnansweredBook(char.x, char.y);
    if (nearbyBook) {
      this.initiateQuestion(nearbyBook);
      return;
    }

    if (!this.game.liftCooldownActive) {
      const nearbyLift = map.findNearbyLift(char.x, char.y);
      if (nearbyLift) {
        this.initiateFloorSelection();
      }
    }
  }

  initiateQuestion(book) {
    if (this.game.gameState !== GameState.PLAYING) return;

    this.game.setGameState(GameState.ASKING_QUESTION);
    if (this.game.character) this.game.character.isMoving = false;
    this.game.currentBookTarget = book;

    if (this.game.availableQuestions.length === 0) {
      this.game.availableQuestions = [...questions];
      if (this.game.availableQuestions.length === 0) {
        UIManager.flashMessage('Błąd: Brak dostępnych pytań!', 'error');
        this.game.setGameState(GameState.PLAYING);
        this.game.currentBookTarget = null;
        return;
      }
    }

    const qIndex = Math.floor(Math.random() * this.game.availableQuestions.length);
    this.game.currentQuestionData = this.game.availableQuestions.splice(qIndex, 1)[0];
    UIManager.showQuestion(this.game.currentQuestionData);
  }

  handleAnswer(selectedOptionIndex) {
    const { gameState, currentQuestionData, currentBookTarget, level } = this.game;

    if (gameState !== GameState.ASKING_QUESTION || !currentQuestionData || !currentBookTarget) {
      UIManager.hideQuestion();
      this.game.currentBookTarget = null;
      this.game.currentQuestionData = null;
      if (this.game.gameState !== GameState.GAME_OVER) this.game.setGameState(GameState.PLAYING);
      return;
    }

    const isCorrect = selectedOptionIndex === currentQuestionData.correctAnswer;
    if (isCorrect) {
      UIManager.flashMessage('Prawidłowo!', 'success', 1500);
      const collected = level?.currentMap?.markBookAsCollected(currentBookTarget);
      if (collected) {
        this.game.totalBooksCollectedGlobally++;
        UIManager.updateScore(this.game.totalBooksCollectedGlobally, this.game.targetBooksToWin);
        if (this.game.totalBooksCollectedGlobally >= this.game.targetBooksToWin) {
          UIManager.hideQuestion();
          this.game._setGameOver(true);
          return;
        }
      } else {
        UIManager.flashMessage('Błąd zbierania książki!', 'error');
      }
    } else {
      UIManager.flashMessage('Nieprawidłowa odpowiedź!', 'error');
      this.game.availableQuestions.push(currentQuestionData);
    }

    UIManager.hideQuestion();
    this.game.currentBookTarget = null;
    this.game.currentQuestionData = null;
    if (this.game.gameState !== GameState.GAME_OVER) this.game.setGameState(GameState.PLAYING);
  }

  initiateFloorSelection() {
    if (this.game.gameState !== GameState.PLAYING || this.game.liftCooldownActive) return;
    this.game.setGameState(GameState.SELECTING_FLOOR);
    if (this.game.character) this.game.character.isMoving = false;
    UIManager.showFloorSelectionUI(
      this.game.level.minFloor,
      this.game.level.maxFloor,
      this.game.level.currentFloor
    );
  }

  handleFloorSelection(selectedFloor) {
    if (this.game.gameState !== GameState.SELECTING_FLOOR) {
      UIManager.hideFloorSelectionUI();
      return;
    }
    UIManager.hideFloorSelectionUI();
    if (
      selectedFloor === this.game.level.currentFloor ||
      selectedFloor < this.game.level.minFloor ||
      selectedFloor > this.game.level.maxFloor
    ) {
      this.game.setGameState(GameState.PLAYING);
      return;
    }
    this.handleLiftTransition(selectedFloor).catch((err) => {
      this.game._handleFatalError(`Błąd przejścia na piętro: ${err.message}`);
    });
  }

  async handleLiftTransition(targetFloor) {
    const game = this.game;
    const isDebug = game.level?.currentFloor === DEBUG_FLOOR_GM || targetFloor === DEBUG_FLOOR_GM;

    if (isDebug)
      console.log(
        `[GameplayManager F${targetFloor} handleLiftTransition] Starting transition. Cooldown: ${game.liftCooldownActive}`
      );
    if (game.gameState !== GameState.SELECTING_FLOOR || game.liftCooldownActive) return;

    game.setGameState(GameState.TRANSITIONING);
    if (game.character) game.character.isMoving = false;
    UIManager.hideQuestion();
    UIManager.hideFloorSelectionUI();
    game.liftCooldownActive = true;
    UIManager.flashMessage(`Przejście na piętro ${targetFloor}...`, 'info', LIFT_COOLDOWN_MS - 200);

    try {
      await game.level.loadFloor(targetFloor, game.canvas.width, game.canvas.height);
      const newMap = game.level.currentMap;
      if (!newMap) throw new Error(`Map object is null for floor ${targetFloor}.`);

      const liftPosData = newMap.getLiftPosition();
      if (!liftPosData) throw new Error(`No lift position data on loaded floor ${targetFloor}!`);
      if (isDebug)
        console.log(
          `  [GM F${targetFloor} LiftTransition] Lift tile: (${liftPosData.tileX},${
            liftPosData.tileY
          }), World:(${liftPosData.x.toFixed(1)},${liftPosData.y.toFixed(1)})`
        );

      let finalSpawnPos = null;

      finalSpawnPos = newMap.getSpawnPointInRoomOfLift(liftPosData.tileX, liftPosData.tileY, 2);
      if (isDebug)
        console.log(
          `  [GM F${targetFloor} LiftTransition] From getSpawnPointInRoomOfLift:`,
          finalSpawnPos ? { x: finalSpawnPos.x.toFixed(1), y: finalSpawnPos.y.toFixed(1) } : null
        );

      if (!finalSpawnPos) {
        if (isDebug)
          console.warn(
            `  [GM F${targetFloor} LiftTransition] getSpawnPointInRoomOfLift failed. Using findNearestWalkableTile...`
          );
        finalSpawnPos = newMap.findNearestWalkableTile(liftPosData.x, liftPosData.y, 5, true, true);
        if (isDebug)
          console.log(
            `  [GM F${targetFloor} LiftTransition] From findNearestWalkableTile:`,
            finalSpawnPos ? { x: finalSpawnPos.x.toFixed(1), y: finalSpawnPos.y.toFixed(1) } : null
          );
      }

      if (!finalSpawnPos) {
        if (isDebug)
          console.error(
            `  [GM F${targetFloor} LiftTransition] All spawn methods failed. Using random spawn...`
          );
        const emergencySpawn = newMap.findRandomInitialSpawnPosition();
        if (!emergencySpawn) throw new Error(`EMERGENCY SPAWN FAILED on floor ${targetFloor}!`);
        finalSpawnPos = emergencySpawn;
        if (isDebug)
          console.log(
            `  [GM F${targetFloor} LiftTransition] From emergencySpawn:`,
            finalSpawnPos ? { x: finalSpawnPos.x.toFixed(1), y: finalSpawnPos.y.toFixed(1) } : null
          );
      }

      game.character.x = finalSpawnPos.x;
      game.character.y = finalSpawnPos.y;
      if (isDebug)
        console.log(
          `  [GM F${targetFloor} LiftTransition] Final landing: (${game.character.x.toFixed(
            1
          )}, ${game.character.y.toFixed(1)})`
        );

      game.character.currentDirection = Character.Direction.DOWN;
      game.character.isMoving = false;
      game.renderer?.centerCameraOnCharacter();
      this.ensureCharacterIsOnWalkableTile(false); // <--- ДОБАВЛЕНО: Проверка после телепортации
      game.startLiftCooldownTimer();
    } catch (error) {
      console.error(`[GM F${targetFloor} LiftTransition] Error during transition:`, error);
      game.liftCooldownActive = false;
      if (game.gameState !== GameState.GAME_OVER) game.setGameState(GameState.PLAYING);
      game._handleFatalError(`Transition error to floor ${targetFloor}: ${error.message || error}`);
    }
  }

  ensureCharacterIsOnWalkableTile(allowStandingOnLift = false) {
    const char = this.game.character;
    const map = this.game.level?.currentMap;
    if (!char || !map) return;

    const currentTileX = Math.floor(char.x / map.tileSize);
    const currentTileY = Math.floor(char.y / map.tileSize);
    const currentTileValue =
      currentTileX >= 0 && currentTileX < map.cols && currentTileY >= 0 && currentTileY < map.rows
        ? map.map[currentTileY]?.[currentTileX]
        : TILE_WALL;

    const isCenterTileWalkableByMap = map.isWalkable(char.x, char.y);
    const isLift = currentTileValue === TILE_LIFT;
    const isSafeToStandHere = isCenterTileWalkableByMap && (!isLift || allowStandingOnLift);
    const isCollidingWithWall = this.checkCollision(char.x, char.y); // Проверяем текущую позицию
    const needsNudge = isCollidingWithWall || !isSafeToStandHere;

    if (needsNudge) {
      const isDebug = this.game.level?.currentFloor === DEBUG_FLOOR_GM;
      if (isDebug)
        console.warn(
          `[GameplayManager F${this.game.level.currentFloor} AntiStuck] Char at (${char.x.toFixed(
            1
          )},${char.y.toFixed(
            1
          )}) -> tile (${currentTileX},${currentTileY}) needs nudge. Colliding:${isCollidingWithWall}, SafeStand:${isSafeToStandHere}`
        );

      const safeSpot = map.findNearestWalkableTile(char.x, char.y, 8, true, true); // excludeLift=true, avoidNarrow=true

      if (safeSpot) {
        if (isDebug)
          console.log(
            `  [AntiStuck] Nudging to safe spot: (${safeSpot.x.toFixed(1)},${safeSpot.y.toFixed(
              1
            )})`
          );
        char.x = safeSpot.x;
        char.y = safeSpot.y;
        this.game.renderer?.centerCameraOnCharacter();
      } else {
        if (isDebug)
          console.error(
            `  [AntiStuck] CRITICAL: Could not find any safe spot to nudge. Trying random.`
          );
        const emergencySpot = map.findRandomInitialSpawnPosition();
        if (emergencySpot) {
          if (isDebug)
            console.warn(
              `  [AntiStuck] Emergency nudge to random: (${emergencySpot.x.toFixed(
                1
              )},${emergencySpot.y.toFixed(1)})`
            );
          char.x = emergencySpot.x;
          char.y = emergencySpot.y;
          this.game.renderer?.centerCameraOnCharacter();
        } else {
          if (isDebug)
            console.error('  [AntiStuck] EVEN RANDOM SPAWN FAILED! Game might be broken.');
          this.game._handleFatalError('Anti-Stuck system failed critically.');
        }
      }
    }
  }
}
