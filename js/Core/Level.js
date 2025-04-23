// src/core/Level.js
import { ProceduralMap } from '../map/ProceduralMap.js';
// Removed TRANSITION_ZONE_RADIUS_MULTIPLIER import

/**
 * Класс Level управляет текущим этажом и загрузкой карт.
 * Логика зон перехода (transition zones) удалена, т.к. лифт работает иначе.
 */
export class Level {
  /**
   * Создает экземпляр Level.
   * @param {number} [minFloor=1] - Номер самого нижнего этажа.
   * @param {number} [maxFloor=3] - Номер самого верхнего этажа.
   */
  constructor(minFloor = 1, maxFloor = 3) {
    if (minFloor >= maxFloor) {
      console.warn(
        `Level constructor: minFloor (${minFloor}) must be less than maxFloor (${maxFloor}). Using defaults 1 and 3.`
      );
      this.minFloor = 1;
      this.maxFloor = 3;
    } else {
      this.minFloor = minFloor;
      this.maxFloor = maxFloor;
    }

    this.currentFloor = this.minFloor;
    this.currentMap = null; // Instance of ProceduralMap
    // this.transitionZones = []; // REMOVED - No longer needed for lifts
    this.tileSize = 32; // Default, will be updated from map
  }

  /**
   * Асинхронно загружает (генерирует) карту для указанного этажа.
   * Assumes ProceduralMap constructor handles generation, lift placement,
   * and throws on critical failure (e.g., unreachable lift).
   * @param {number} floorNumber - Номер этажа для загрузки.
   * @param {number} canvasWidth - Ширина канваса.
   * @param {number} canvasHeight - Высота канваса.
   * @returns {Promise<void>} Промис, который разрешается после загрузки этажа.
   * @throws {Error} If ProceduralMap generation or validation fails.
   */
  async loadFloor(floorNumber, canvasWidth, canvasHeight) {
    if (floorNumber < this.minFloor || floorNumber > this.maxFloor) {
      const errorMsg = `Attempted to load invalid floor: ${floorNumber}. Allowed range: [${this.minFloor}-${this.maxFloor}]`;
      console.error(`[Level] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`[Level] Loading floor ${floorNumber}...`);
    this.currentFloor = floorNumber;

    try {
      // ProceduralMap constructor now handles generation AND validation (like lift reachability).
      // It will throw an error if generation fails critically.
      this.currentMap = new ProceduralMap(
        canvasWidth,
        canvasHeight,
        this.currentFloor,
        this.minFloor,
        this.maxFloor
      );

      // Basic validation after creation (ensure map object looks reasonable)
      if (
        !this.currentMap.tileSize ||
        !this.currentMap.map ||
        !this.currentMap.books || // books should exist (even if empty)
        !this.currentMap.getLiftPosition() // Lift position MUST exist after successful generation
      ) {
        throw new Error(
          '[Level] ProceduralMap instance is missing essential properties after creation (tileSize, map, books, or liftPosition).'
        );
      }

      this.tileSize = this.currentMap.tileSize;
      const liftPos = this.currentMap.getLiftPosition();
      console.log(
        `  [Level] Map generated for floor ${this.currentFloor}. TileSize: ${this.tileSize}. Lift at tile(${liftPos.tileX}, ${liftPos.tileY}).`
      );

      // REMOVED: createTransitionZones() call is no longer needed.

      console.log(
        `[Level] Floor ${floorNumber} loaded successfully. Map size: ${this.currentMap.cols}x${this.currentMap.rows}. ${this.currentMap.books.length} books placed.`
      );
    } catch (error) {
      console.error(
        `[Level] CRITICAL FAILURE loading floor ${floorNumber}: Failed to create or validate ProceduralMap:`,
        error
      );
      this.currentMap = null; // Ensure state is clean on failure
      // Rethrow the error for Game.js to handle (likely show error message and stop)
      throw new Error(
        `Map generation/validation failed for floor ${floorNumber}. ${error.message || error}`
      );
    }

    // Return a resolved promise (generation itself is synchronous within the constructor)
    return Promise.resolve();
  }

  // REMOVED: createTransitionZones() method is obsolete.

  // REMOVED: getCurrentTransitionZone() method is obsolete. Lift interaction checked differently.

  /**
   * Возвращает массив объектов книг на текущей карте.
   * @returns {Array<object>} Массив объектов книг.
   */
  getCurrentBooks() {
    return this.currentMap ? this.currentMap.books : [];
  }
}
