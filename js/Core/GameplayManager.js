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
import { Character } from './Character.js';

const DEBUG_GM_FLOOR = null; // Ustaw na numer piętra dla bardziej szczegółowych logów

export class GameplayManager {
  constructor(game) {
    this.game = game;
    this.handleAnswer = this.handleAnswer.bind(this);
    this.handleFloorSelection = this.handleFloorSelection.bind(this);
  }

  update(timestamp) {
    if (this.game.gameState === GameState.PLAYING) this.updatePlayingState(timestamp);
  }

  updatePlayingState(timestamp) {
    const char = this.game.character;
    if (!this.game.level?.currentMap || !char || !this.game.inputManager) return;
    const { moved } = this.handleMovement();
    if (char?.updateAnimation) char.updateAnimation(timestamp);
    if (!moved && this.game.gameState === GameState.PLAYING) this.handleInteractions();
  }

  handleMovement() {
    const char = this.game.character,
      map = this.game.level.currentMap,
      input = this.game.inputManager;
    if (!char || !map || !input) return { moved: false };
    const dir = input.getInputDirection();
    let dx = dir.x * char.speed,
      dy = dir.y * char.speed;
    let actualX = 0,
      actualY = 0,
      moved = false;

    if (dx !== 0 || dy !== 0) {
      const canMoveX = dx !== 0 && !this.checkCollision(char.x + dx, char.y);
      const canMoveY = dy !== 0 && !this.checkCollision(char.x, char.y + dy);
      if (canMoveX) actualX = dx;
      if (canMoveY) actualY = dy;

      if (dx !== 0 && dy !== 0 && this.checkCollision(char.x + dx, char.y + dy)) {
        // Diagonal blocked
        if (canMoveX && !canMoveY) actualY = 0; // Slide X
        else if (canMoveY && !canMoveX) actualX = 0; // Slide Y
        else if (!canMoveX && !canMoveY) {
          actualX = 0;
          actualY = 0;
        }
      }
      if (actualX !== 0 || actualY !== 0) {
        char.x += actualX;
        char.y += actualY;
        moved = true;
        if (Math.abs(actualX) >= Math.abs(actualY)) {
          if (actualX !== 0)
            char.currentDirection =
              actualX > 0 ? Character.Direction.RIGHT : Character.Direction.LEFT;
        } else {
          if (actualY !== 0)
            char.currentDirection = actualY > 0 ? Character.Direction.DOWN : Character.Direction.UP;
        }
      }
    }
    char.isMoving = moved;
    return { moved };
  }

  checkCollision(targetX, targetY) {
    const map = this.game.level?.currentMap,
      char = this.game.character;
    if (!map || !char) return true;
    const box = char.getCollisionBox(targetX, targetY);
    const points = [
      { x: box.left, y: box.top },
      { x: box.right, y: box.top },
      { x: box.left, y: box.bottom },
      { x: box.right, y: box.bottom },
      { x: targetX, y: box.top },
      { x: targetX, y: box.bottom },
      { x: box.left, y: targetY + char.renderSize * char.collisionBoxFeetOffsetRatio },
      { x: box.right, y: targetY + char.renderSize * char.collisionBoxFeetOffsetRatio },
    ];
    for (const p of points) if (!map.isWalkable(p.x, p.y)) return true;
    return false;
  }

  handleInteractions() {
    const map = this.game.level?.currentMap,
      char = this.game.character;
    if (!map || !char || this.game.gameState !== GameState.PLAYING) return;
    const book = map.findNearbyUnansweredBook(char.x, char.y);
    if (book) {
      this.initiateQuestion(book);
      return;
    }
    if (!this.game.liftCooldownActive) {
      const lift = map.findNearbyLift(char.x, char.y);
      if (lift) this.initiateFloorSelection();
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
        UIManager.flashMessage('Brak pytań!', 'error');
        this.game.setGameState(GameState.PLAYING);
        this.game.currentBookTarget = null;
        return;
      }
    }
    const qIdx = Math.floor(Math.random() * this.game.availableQuestions.length);
    this.game.currentQuestionData = this.game.availableQuestions.splice(qIdx, 1)[0];
    UIManager.showQuestion(this.game.currentQuestionData);
  }

  handleAnswer(selOptIdx) {
    const { gameState, currentQuestionData, currentBookTarget, level } = this.game;
    if (gameState !== GameState.ASKING_QUESTION || !currentQuestionData || !currentBookTarget) {
      UIManager.hideQuestion();
      this.game.currentBookTarget = null;
      this.game.currentQuestionData = null;
      if (this.game.gameState !== GameState.GAME_OVER) this.game.setGameState(GameState.PLAYING);
      return;
    }
    const correct = selOptIdx === currentQuestionData.correctAnswer;
    if (correct) {
      UIManager.flashMessage('Prawidłowo!', 'success', 1500);
      if (level?.currentMap?.markBookAsCollected(currentBookTarget)) {
        this.game.totalBooksCollectedGlobally++;
        UIManager.updateScore(this.game.totalBooksCollectedGlobally, this.game.targetBooksToWin);
        if (this.game.totalBooksCollectedGlobally >= this.game.targetBooksToWin) {
          UIManager.hideQuestion();
          this.game._setGameOver(true);
          return;
        }
      } else UIManager.flashMessage('Błąd zbierania!', 'error');
    } else {
      UIManager.flashMessage('Nieprawidłowa!', 'error');
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

  handleFloorSelection(selFloor) {
    if (this.game.gameState !== GameState.SELECTING_FLOOR) {
      UIManager.hideFloorSelectionUI();
      return;
    }
    UIManager.hideFloorSelectionUI();
    if (
      selFloor === this.game.level.currentFloor ||
      selFloor < this.game.level.minFloor ||
      selFloor > this.game.level.maxFloor
    ) {
      this.game.setGameState(GameState.PLAYING);
      return;
    }
    this.handleLiftTransition(selFloor).catch((err) => {
      this.game._handleFatalError(`Błąd przejścia: ${err.message}`);
    });
  }

  async handleLiftTransition(targetFloor) {
    const game = this.game;
    const isDebug =
      this.game.level?.currentFloor === DEBUG_GM_FLOOR || targetFloor === DEBUG_GM_FLOOR;

    if (isDebug)
      console.log(`[GM F${targetFloor} LiftTrans] Start. Cooldown:${game.liftCooldownActive}`);
    if (game.liftCooldownActive && game.gameState !== GameState.SELECTING_FLOOR) {
      if (isDebug)
        console.warn(
          `[GM F${targetFloor} LiftTrans] Aborted: Cooldown or invalid state (${game.gameState})`
        );
      return;
    }
    if (game.gameState === GameState.SELECTING_FLOOR) game.setGameState(GameState.TRANSITIONING);
    else if (game.gameState !== GameState.TRANSITIONING) {
      console.warn(
        `[GM F${targetFloor} LiftTrans] Unexpected state ${game.gameState}. Forcing TRANSITIONING.`
      );
      game.setGameState(GameState.TRANSITIONING);
    }

    if (game.character) game.character.isMoving = false;
    UIManager.hideQuestion();
    UIManager.hideFloorSelectionUI();
    game.liftCooldownActive = true;
    UIManager.flashMessage(`Przejście na piętro ${targetFloor}...`, 'info', LIFT_COOLDOWN_MS - 200);

    try {
      await game.level.loadFloor(targetFloor, game.canvas.width, game.canvas.height);
      const mapInst = game.level.currentMap;
      if (!mapInst) throw new Error(`Map instance null for F${targetFloor}.`);
      const liftData = mapInst.getLiftPosition();
      if (!liftData) throw new Error(`No lift pos data on F${targetFloor}!`);
      if (isDebug)
        console.log(`  [GM F${targetFloor} LiftTrans] Lift @(${liftData.tileX},${liftData.tileY})`);

      let finalSpawn = null;
      const liftRoom = mapInst.getRoomContainingTile(liftData.tileX, liftData.tileY);

      if (liftRoom) {
        if (isDebug)
          console.log(
            `  [GM F${targetFloor} LiftTrans] Lift in room ${
              liftRoom.id || 'N/A'
            }. Spawning center.`
          );
        finalSpawn = mapInst.getRoomCenter(liftRoom);
        if (!finalSpawn) {
          console.error(
            `  [GM F${targetFloor} LiftTrans] CRIT: getRoomCenter null for room ${
              liftRoom.id || 'N/A'
            }. Fallback.`
          );
          finalSpawn = mapInst.getSpawnPointInRoomOfLift(liftData.tileX, liftData.tileY, 1);
        }
      } else {
        console.error(
          `  [GM F${targetFloor} LiftTrans] CRIT: Lift @(${liftData.tileX},${liftData.tileY}) NOT in any room! Fallback near lift.`
        );
        finalSpawn =
          mapInst.getSpawnPointInRoomOfLift(liftData.tileX, liftData.tileY, 1) ||
          mapInst.findNearestWalkableTile(liftData.x, liftData.y, 3, true, false);
      }
      if (!finalSpawn) finalSpawn = { x: liftData.x, y: liftData.y }; // Last resort: lift tile itself
      if (!finalSpawn) throw new Error(`PANIC: No spawn pos for F${targetFloor}.`);

      game.character.x = finalSpawn.x;
      game.character.y = finalSpawn.y;
      if (isDebug)
        console.log(
          `  [GM F${targetFloor} LiftTrans] Initial land (pre-nudge):(${game.character.x.toFixed(
            1
          )},${game.character.y.toFixed(1)})`
        );
      game.character.currentDirection = Character.Direction.DOWN;
      game.character.isMoving = false;

      this.ensureCharacterIsOnWalkableTile(false); // allowStandingOnLift=false
      if (isDebug)
        console.log(
          `  [GM F${targetFloor} LiftTrans] Final pos (post-nudge):(${game.character.x.toFixed(
            1
          )},${game.character.y.toFixed(1)})`
        );

      game.renderer?.centerCameraOnCharacter();
      game.startLiftCooldownTimer();
    } catch (error) {
      console.error(`[GM F${targetFloor} LiftTrans] Error:`, error);
      game.liftCooldownActive = false;
      if (
        game.gameState === GameState.TRANSITIONING ||
        game.gameState === GameState.SELECTING_FLOOR
      )
        game.setGameState(GameState.PLAYING);
      this.game._handleFatalError(`Transition error to F${targetFloor}: ${error.message || error}`);
    }
  }

  ensureCharacterIsOnWalkableTile(allowStandingOnLift = false) {
    const char = this.game.character,
      map = this.game.level?.currentMap;
    if (!char || !map) return;
    const cTX = Math.floor(char.x / map.tileSize),
      cTY = Math.floor(char.y / map.tileSize);
    const cTV =
      cTX >= 0 && cTX < map.cols && cTY >= 0 && cTY < map.rows ? map.map[cTY]?.[cTX] : TILE_WALL;
    const centerWalkable = map.isWalkable(char.x, char.y),
      isLift = cTV === TILE_LIFT;
    const safeStand = centerWalkable && (!isLift || allowStandingOnLift);
    const collidingWall = this.checkCollision(char.x, char.y);
    const needsNudge = collidingWall || !safeStand;
    const isDebug = this.game.level?.currentFloor === DEBUG_GM_FLOOR;

    if (needsNudge) {
      if (isDebug)
        console.warn(
          `[GM F${this.game.level.currentFloor} AntiStuck] Char@(${char.x.toFixed(
            1
          )},${char.y.toFixed(
            1
          )}) tile ${cTV}(${cTX},${cTY}) needs nudge. Collide:${collidingWall},SafeStand:${safeStand}(allowLift:${allowStandingOnLift})`
        );
      let safeSpot = map.findNearestWalkableTile(char.x, char.y, 8, true, true);
      if (!safeSpot) {
        if (isDebug)
          console.warn(`  [AntiStuck] Initial (avoidNarrow) failed. Retrying allowNarrow...`);
        safeSpot = map.findNearestWalkableTile(char.x, char.y, 8, true, false);
      }
      if (!safeSpot && isLift && !allowStandingOnLift) {
        if (isDebug)
          console.warn(`  [AntiStuck] AllowNarrow failed. Trying any spot incl. lift...`);
        safeSpot = map.findNearestWalkableTile(char.x, char.y, 3, false, false);
      }
      if (safeSpot) {
        if (isDebug)
          console.log(
            `  [AntiStuck] Nudging to safe:(${safeSpot.x.toFixed(1)},${safeSpot.y.toFixed(1)})`
          );
        char.x = safeSpot.x;
        char.y = safeSpot.y;
        this.game.renderer?.centerCameraOnCharacter();
      } else {
        if (isDebug) console.error(`  [AntiStuck] CRIT: No safe nudge spot. Random map spawn...`);
        const emergency = map.findRandomInitialSpawnPosition();
        if (emergency) {
          if (isDebug)
            console.warn(
              `  [AntiStuck] Emergency random:(${emergency.x.toFixed(1)},${emergency.y.toFixed(1)})`
            );
          char.x = emergency.x;
          char.y = emergency.y;
          this.game.renderer?.centerCameraOnCharacter();
        } else {
          if (isDebug) console.error('  [AntiStuck] EVEN RANDOM SPAWN FAILED! Unrecoverable.');
          this.game._handleFatalError('Anti-Stuck system failed: No spawnable tiles found.');
        }
      }
    }
  }
}
