// src/map/ProceduralMap.js
import { Book } from './Book.js';
import { MapRenderer } from './MapRenderer.js';
import { randomInt } from '../utils/map.js';
import { generateLevelData } from './MapGen.js'; // Używamy poprawnej nazwy
import {
  TILE_WALL,
  TILE_CORRIDOR,
  TILE_ROOM_FLOOR,
  TILE_LIFT,
  LIFT_INTERACTION_RADIUS_MULTIPLIER,
} from '../utils/constants.js';

const DEBUG_PROC_MAP_FLOOR = null; // Zmień na numer piętra do debugowania

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

    this.map = null;
    this.rooms = [];
    this.books = [];
    this.liftPosition = null;

    this.renderer = new MapRenderer(this.tileSize);
    this.renderer.floorNumber = this.floorNumber; // Dla MapRenderer, jeśli potrzebuje

    const generationParams = {
      // Te parametry są używane przez generateLevelData
      minRoomSize: 5,
      maxRoomSize: 10,
      corridorThickness: 1,
      numRooms: 12,
      maxRoomAttempts: 200,
      booksPerMap: 5,
      roomTypeWeights: {
        classroom: 50,
        office: 25,
        library: 15,
        lab: 10,
        storage: 5,
        utility: 10,
        gym: 0, // gym jest modyfikowane w mapGenerator
      },
    };

    try {
      const generationConfig = {
        cols: this.cols,
        rows: this.rows,
        floorNumber: this.floorNumber,
        minFloor: this.minFloor,
        maxFloor: this.maxFloor,
        tileSize: this.tileSize,
        generationParams: generationParams,
      };

      const { map, rooms, liftPosition } = generateLevelData(generationConfig);

      this.map = map;
      this.rooms = rooms; // rooms to lista obiektów z mapGenerator
      this.liftPosition = liftPosition;

      this.renderer.resetColorCache();
      this.placeBooksReliably(generationParams.booksPerMap);

      if (this.floorNumber === DEBUG_PROC_MAP_FLOOR) {
        console.log(
          `[ProcMap F${this.floorNumber}] Init complete. Lift@(${liftPosition?.tileX},${liftPosition?.tileY}). Rooms: ${this.rooms.length}`
        );
        this.logMapGrid();
      }
    } catch (error) {
      console.error(`[ProcMap F${this.floorNumber}] CRIT ERR during map gen/setup:`, error);
      throw error;
    }
  }

  placeBooksReliably(booksPerMap) {
    this.books = [];
    const potentialLocs = [];
    const placedCoords = new Set();
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tileVal = this.map[r]?.[c];
        const isLift =
          this.liftPosition && r === this.liftPosition.tileY && c === this.liftPosition.tileX;
        if ((tileVal === TILE_CORRIDOR || tileVal === TILE_ROOM_FLOOR) && !isLift) {
          potentialLocs.push({ r, c });
        }
      }
    }
    let placed = 0;
    while (placed < booksPerMap && potentialLocs.length > 0) {
      const randIdx = Math.floor(Math.random() * potentialLocs.length);
      const { r, c } = potentialLocs.splice(randIdx, 1)[0];
      const key = `${c},${r}`;
      if (
        (this.map[r]?.[c] === TILE_CORRIDOR || this.map[r]?.[c] === TILE_ROOM_FLOOR) &&
        !placedCoords.has(key)
      ) {
        const bookId = `book_f${this.floorNumber}_${placed + 1}`;
        this.books.push(
          new Book((c + 0.5) * this.tileSize, (r + 0.5) * this.tileSize, bookId, this.tileSize)
        );
        placedCoords.add(key);
        placed++;
      }
    }
  }

  isWalkable(worldX, worldY) {
    if (!this.map) return false;
    const tileX = Math.floor(worldX / this.tileSize),
      tileY = Math.floor(worldY / this.tileSize);
    if (tileX < 0 || tileX >= this.cols || tileY < 0 || tileY >= this.rows) return false;
    const tileVal = this.map[tileY]?.[tileX];
    return tileVal === TILE_CORRIDOR || tileVal === TILE_ROOM_FLOOR || tileVal === TILE_LIFT;
  }

  findRandomInitialSpawnPosition(characterForCollisionCheck = null) {
    // Dodajemy opcjonalny argument
    if (!this.map) return undefined;
    const suitableTiles = [];
    const tempCharCollisionBox = characterForCollisionCheck
      ? {
          width: characterForCollisionCheck.collisionBoxWidth,
          height: characterForCollisionCheck.collisionBoxHeight,
        }
      : { width: this.tileSize * 0.6, height: this.tileSize * 0.8 }; // Domyślny przybliżony rozmiar

    const checkCandidate = (c, r) => {
      const worldX = (c + 0.5) * this.tileSize;
      const worldY = (r + 0.5) * this.tileSize;

      // Sprawdzenie 1: Czy sam kafelek jest odpowiedni (nie winda, podłoga/korytarz)
      const tileValue = this.map[r]?.[c];
      const isLift =
        this.liftPosition && r === this.liftPosition.tileY && c === this.liftPosition.tileX;
      if (!((tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) && !isLift)) {
        return false;
      }

      // Sprawdzenie 2: Czy jest wystarczająco otwarty (opcjonalne, ale dobre dla jakości)
      // if (!this.isTileOpenEnough(c, r, 2, true)) { // Wymagajmy przynajmniej 2 otwartych stron, unikaj wąskich
      //     return false;
      // }

      // Sprawdzenie 3: Symulacja kolizji postaci na tym kafelku
      // Musimy sprawdzić, czy prostokąt kolizyjny postaci nie zachodzi na ściany
      const halfCharWidth = tempCharCollisionBox.width / 2;
      const halfCharHeight = tempCharCollisionBox.height / 2; // Lub użyj collisionBoxFeetOffsetRatio dla Y

      const pointsToVerify = [
        { x: worldX - halfCharWidth, y: worldY - halfCharHeight }, // Lewy-górny narożnik postaci
        { x: worldX + halfCharWidth, y: worldY - halfCharHeight }, // Prawy-górny
        { x: worldX - halfCharWidth, y: worldY + halfCharHeight }, // Lewy-dolny
        { x: worldX + halfCharWidth, y: worldY + halfCharHeight }, // Prawy-dolny
        // Można dodać środki krawędzi, jeśli konieczne
        { x: worldX, y: worldY - halfCharHeight }, // Środek-góra
        { x: worldX, y: worldY + halfCharHeight }, // Środek-dół
        { x: worldX - halfCharWidth, y: worldY }, // Środek-lewo
        { x: worldX + halfCharWidth, y: worldY }, // Środek-prawo
      ];

      for (const point of pointsToVerify) {
        if (!this.isWalkable(point.x, point.y)) {
          // isWalkable sprawdza typ kafelka
          // console.log(`  [Spawn Candidate Fail] Tile (${c},${r}) -> point ${JSON.stringify(point)} is not walkable.`);
          return false; // Jeden z punktów kolizyjnych jest na nieprzechodnim kafelku
        }
      }
      return true; // Wszystkie punkty są na "walkable"
    };

    // Preferuj miejsca dalej od krawędzi
    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        if (checkCandidate(c, r)) {
          if (this.isTileOpenEnough(c, r, 2, true))
            // Dodatkowe kryterium jakości
            suitableTiles.push({ r, c });
        }
      }
    }

    // Jeśli nie ma idealnych, szukaj wszędzie
    if (suitableTiles.length === 0) {
      console.warn(
        `[ProcMap F${this.floorNumber} Spawn] No ideal open spots found, checking all valid tiles.`
      );
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (checkCandidate(c, r)) {
            suitableTiles.push({ r, c });
          }
        }
      }
    }

    if (suitableTiles.length === 0) {
      console.error(
        `[ProcMap F${this.floorNumber} Spawn] CRITICAL: No suitable spawn tiles found after thorough check!`
      );
      // Ostateczny fallback: środek pierwszej znalezionej podłogi pokoju (bardzo awaryjne)
      for (const room of this.rooms) {
        for (let rOffset = 0; rOffset < room.height; rOffset++) {
          for (let cOffset = 0; cOffset < room.width; cOffset++) {
            const rTest = room.y + rOffset;
            const cTest = room.x + cOffset;
            if (this.map[rTest]?.[cTest] === TILE_ROOM_FLOOR) {
              console.warn(
                `[ProcMap F${this.floorNumber} Spawn] EMERGENCY FALLBACK to first room floor tile: (${cTest},${rTest})`
              );
              return { x: (cTest + 0.5) * this.tileSize, y: (rTest + 0.5) * this.tileSize };
            }
          }
        }
      }
      return undefined; // Naprawdę nie ma gdzie
    }

    const { r, c } = suitableTiles[Math.floor(Math.random() * suitableTiles.length)];
    console.log(`[ProcMap F${this.floorNumber} Spawn] Selected spawn tile: (${c},${r})`);
    return { x: (c + 0.5) * this.tileSize, y: (r + 0.5) * this.tileSize };
  }

  isTileOpenEnough(tileX, tileY, minOpenSides = 2, avoidNarrow = false) {
    if (!this.map) return false;
    let openCount = 0;
    const dirs = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]; // N,S,W,E
    const isOpen = [false, false, false, false];
    for (let i = 0; i < dirs.length; i++) {
      const nX = tileX + dirs[i][0],
        nY = tileY + dirs[i][1];
      if (nX >= 0 && nX < this.cols && nY >= 0 && nY < this.rows) {
        const val = this.map[nY]?.[nX];
        if (val === TILE_CORRIDOR || val === TILE_ROOM_FLOOR || val === TILE_LIFT) {
          openCount++;
          isOpen[i] = true;
        }
      }
    }
    if (openCount < minOpenSides) return false;
    if (avoidNarrow && openCount === 2) {
      // Check for 1-tile wide passage
      if (
        (isOpen[0] && isOpen[1] && !isOpen[2] && !isOpen[3]) ||
        (isOpen[2] && isOpen[3] && !isOpen[0] && !isOpen[1])
      )
        return false;
    }
    return true;
  }

  findNearestWalkableTile(worldX, worldY, maxR = 8, excludeLift = false, avoidNarrow = false) {
    if (!this.map) return null;
    const tX = Math.floor(worldX / this.tileSize),
      tY = Math.floor(worldY / this.tileSize);
    const targets = [TILE_CORRIDOR, TILE_ROOM_FLOOR];

    if (tX >= 0 && tX < this.cols && tY >= 0 && tY < this.rows) {
      const val = this.map[tY][tX];
      if (
        targets.includes(val) &&
        (!excludeLift || val !== TILE_LIFT) &&
        this.isTileOpenEnough(tX, tY, 2, avoidNarrow)
      ) {
        return { x: (tX + 0.5) * this.tileSize, y: (tY + 0.5) * this.tileSize };
      }
    }
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) < r && Math.abs(dy) < r) continue; // Only outer ring
          const cX = tX + dx,
            cY = tY + dy;
          if (cX < 0 || cX >= this.cols || cY < 0 || cY >= this.rows) continue;
          const val = this.map[cY]?.[cX];
          if (
            targets.includes(val) &&
            (!excludeLift || val !== TILE_LIFT) &&
            this.isTileOpenEnough(cX, cY, 2, avoidNarrow)
          ) {
            return { x: (cX + 0.5) * this.tileSize, y: (cY + 0.5) * this.tileSize };
          }
        }
      }
    }
    // BFS fallback (simplified, could be more robust)
    const q = [[tX, tY]],
      visited = new Set([`${tX},${tY}`]);
    const pathableBFS = [TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT];
    while (q.length > 0) {
      const [cX, cY] = q.shift();
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        const nX = cX + dx,
          nY = cY + dy,
          key = `${nX},${nY}`;
        if (nX >= 0 && nX < this.cols && nY >= 0 && nY < this.rows && !visited.has(key)) {
          const val = this.map[nY]?.[nX];
          visited.add(key);
          if (
            targets.includes(val) &&
            (!excludeLift || val !== TILE_LIFT) &&
            this.isTileOpenEnough(nX, nY, 2, avoidNarrow)
          ) {
            return { x: (nX + 0.5) * this.tileSize, y: (nY + 0.5) * this.tileSize };
          }
          if (pathableBFS.includes(val)) q.push([nX, nY]);
        }
      }
    }
    return null;
  }

  getRoomContainingTile(tileX, tileY) {
    if (!this.rooms || this.rooms.length === 0) return null;
    for (const room of this.rooms) {
      if (
        tileX >= room.col &&
        tileX < room.col + room.width &&
        tileY >= room.row &&
        tileY < room.row + room.height
      ) {
        const actualTile = this.map[tileY]?.[tileX];
        // Lift is considered "in" a room if it's at the room's coords and is TILE_LIFT,
        // or if the tile is TILE_ROOM_FLOOR (for checking general room tiles).
        // For lift specifically, we check if it's within the room's rectangular bounds.
        // The `mapGenerator` ensures the `lift_alcove` type room is created correctly.
        if (
          actualTile === TILE_LIFT ||
          (actualTile === TILE_ROOM_FLOOR && room.type !== 'lift_alcove')
        ) {
          return room;
        } else if (room.type === 'lift_alcove' && actualTile === TILE_LIFT) {
          // Explicitly for lift_alcove
          return room;
        }
      }
    }
    // console.warn(`[ProcMap F${this.floorNumber}] Tile (${tileX},${tileY}) not in any room or not room floor/lift.`);
    return null;
  }

  getRoomCenter(room) {
    if (!room) return null;
    return {
      x: (room.col + room.width / 2) * this.tileSize,
      y: (room.row + room.height / 2) * this.tileSize,
    };
  }

  getSpawnPointInRoomOfLift(liftTileX, liftTileY, preferredDistance = 1) {
    // This function can be simplified or used as a more fine-grained spawn adjuster
    // if getRoomCenter + ensureCharacterIsOnWalkableTile isn't perfect.
    // For now, find a tile adjacent to the lift that is room floor.
    const room = this.getRoomContainingTile(liftTileX, liftTileY);
    if (!room) return null;

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ]; // N, S, W, E
    const candidates = [];

    for (const dir of dirs) {
      const checkX = liftTileX + dir.dx;
      const checkY = liftTileY + dir.dy;
      // Check if adjacent tile is within the same room and is a floor tile
      if (
        checkX >= room.col &&
        checkX < room.col + room.width &&
        checkY >= room.row &&
        checkY < room.row + room.height &&
        this.map[checkY]?.[checkX] === TILE_ROOM_FLOOR
      ) {
        if (this.isTileOpenEnough(checkX, checkY, 2, true)) {
          // Prefer open spots
          candidates.push({ x: (checkX + 0.5) * this.tileSize, y: (checkY + 0.5) * this.tileSize });
        }
      }
    }
    if (candidates.length > 0) return candidates[0]; // Return first good candidate

    // Fallback: if no "good" adjacent spot, just use room center (which might be the lift itself)
    // GameplayManager's ensureCharacterIsOnWalkableTile will handle nudging off the lift.
    // console.warn(`[ProcMap F${this.floorNumber}] getSpawnPointInRoomOfLift: No ideal adjacent spot, using room center for lift in ${room.id}`);
    return this.getRoomCenter(room);
  }

  findNearbyUnansweredBook(worldX, worldY, radius = this.tileSize * 0.8) {
    if (!this.books || this.books.length === 0) return null;
    let closestBook = null,
      minDistSq = radius * radius;
    for (const book of this.books) {
      if (!book.isCollected) {
        const dX = book.x - worldX,
          dY = book.y - worldY,
          distSq = dX * dX + dY * dY;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closestBook = book;
        }
      }
    }
    return closestBook;
  }

  markBookAsCollected(bookToCollect) {
    if (!bookToCollect || !this.books) return false;
    const book = this.books.find((b) => b.id === bookToCollect.id);
    if (book && !book.isCollected) {
      book.isCollected = true;
      return true;
    }
    return false;
  }

  findNearbyLift(worldX, worldY, radius = this.tileSize * LIFT_INTERACTION_RADIUS_MULTIPLIER) {
    if (!this.liftPosition) return null;
    const dX = worldX - this.liftPosition.x,
      dY = worldY - this.liftPosition.y;
    return dX * dX + dY * dY < radius * radius ? this.liftPosition : null;
  }

  getLiftPosition() {
    return this.liftPosition;
  }

  draw(ctx, bookImage = null) {
    if (!this.map || !this.renderer) return;
    this.renderer.draw(
      ctx,
      {
        map: this.map,
        rooms: this.rooms,
        books: this.books,
        liftPosition: this.liftPosition,
        offsetX: this.offsetX,
        offsetY: this.offsetY,
        cols: this.cols,
        rows: this.rows,
        tileSize: this.tileSize,
      },
      bookImage
    );
  }

  logMapGrid() {
    if (!this.map) {
      console.log(`[ProcMap F${this.floorNumber}] Map grid N/A.`);
      return;
    }
    console.log(`--- Map Grid F${this.floorNumber} (${this.cols}x${this.rows}) ---`);
    let h = '   ';
    for (let c = 0; c < this.cols; c++) h += c % 10 === 0 ? Math.floor(c / 10) : ' ';
    console.log(h);
    h = '   ';
    for (let c = 0; c < this.cols; c++) h += c % 10;
    console.log(h);
    for (let y = 0; y < this.rows; y++) {
      const rN = y.toString().padStart(2, ' ');
      const rS = this.map[y]
        .map((t) => {
          switch (t) {
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
      console.log(`${rN} ${rS}`);
    }
    if (this.liftPosition)
      console.log(
        `Lift tile map[${this.liftPosition.tileY}][${this.liftPosition.tileX}]: ${
          this.map[this.liftPosition.tileY]?.[this.liftPosition.tileX]
        }. Reported @(${this.liftPosition.tileX},${this.liftPosition.tileY})`
      );
    else console.log('Lift N/A.');
    console.log(`--- End Map Grid F${this.floorNumber} ---`);
  }
}
