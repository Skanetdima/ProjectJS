// src/map/ProceduralMap.js
import { Book } from './Book.js';
import { MapRenderer } from './MapRenderer.js';
import { randomInt } from '../utils/map.js'; // Убедитесь, что этот файл и функция существуют
import { generateLevelData } from './MapGen.js';
import {
  TILE_WALL,
  TILE_CORRIDOR,
  TILE_ROOM_FLOOR,
  TILE_LIFT,
  LIFT_INTERACTION_RADIUS_MULTIPLIER,
  // GYM_CHANCE_ON_FIRST_FLOOR, // Если используется в MapGen.js
} from '../utils/constants.js';

const DEBUG_FLOOR = 3; // Установите на номер этажа для отладки или null/0 для отключения

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
    this.liftPosition = null; // {x, y, tileX, tileY}

    this.renderer = new MapRenderer(this.tileSize);

    const generationParams = {
      minRoomSize: 5,
      maxRoomSize: 10,
      corridorThickness: 1,
      numRooms: 12,
      maxRoomAttempts: 200,
      booksPerMap: 5, // Количество книг на карту
      roomTypeWeights: {
        // Веса для типов комнат
        classroom: 50,
        office: 25,
        library: 15,
        lab: 10,
        storage: 5,
        utility: 10,
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
      this.rooms = rooms;
      this.liftPosition = liftPosition; // Содержит {x, y, tileX, tileY}

      this.renderer.resetColorCache();
      this.placeBooksReliably(generationParams.booksPerMap);

      if (this.floorNumber === DEBUG_FLOOR) {
        console.log(
          `[ProcMap F${this.floorNumber}] Init complete. Lift at tile (${liftPosition?.tileX}, ${liftPosition?.tileY}).`
        );
        // this.logMapGrid(); // Можно раскомментировать для вывода сетки сразу после генерации
      }
    } catch (error) {
      console.error(
        `[ProcMap F${this.floorNumber}] CRITICAL ERROR during map generation or setup:`,
        error
      );
      throw error; // Перебрасываем ошибку, чтобы Game.js мог ее обработать
    }
  }

  placeBooksReliably(booksPerMap) {
    this.books = []; // Очищаем предыдущие книги
    const potentialLocations = [];
    const placedCoords = new Set();
    // console.log(`[ProcMap F${this.floorNumber}] Placing up to ${booksPerMap} books...`);

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tileValue = this.map[r]?.[c];
        const isLiftTile =
          this.liftPosition && r === this.liftPosition.tileY && c === this.liftPosition.tileX;
        // Книги можно размещать в коридорах или на полу комнат, но не на клетке лифта
        if ((tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) && !isLiftTile) {
          potentialLocations.push({ r, c });
        }
      }
    }

    let booksPlaced = 0;
    while (booksPlaced < booksPerMap && potentialLocations.length > 0) {
      const randomIndex = Math.floor(Math.random() * potentialLocations.length);
      const { r, c } = potentialLocations.splice(randomIndex, 1)[0]; // Удаляем выбранную локацию
      const coordKey = `${c},${r}`;

      if (
        (this.map[r]?.[c] === TILE_CORRIDOR || this.map[r]?.[c] === TILE_ROOM_FLOOR) &&
        !placedCoords.has(coordKey)
      ) {
        const bookWorldX = (c + 0.5) * this.tileSize;
        const bookWorldY = (r + 0.5) * this.tileSize;
        const bookId = `book_f${this.floorNumber}_${booksPlaced + 1}`; // Уникальный ID
        this.books.push(new Book(bookWorldX, bookWorldY, bookId, this.tileSize));
        placedCoords.add(coordKey);
        booksPlaced++;
      }
    }
    // if (booksPlaced < booksPerMap) console.warn(`[ProcMap F${this.floorNumber}] Placed only ${booksPlaced}/${booksPerMap} books.`);
  }

  isWalkable(worldX, worldY) {
    if (!this.map) return false;
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);

    if (tileX < 0 || tileX >= this.cols || tileY < 0 || tileY >= this.rows) {
      return false; // За пределами карты
    }

    const tileValue = this.map[tileY]?.[tileX];
    // Лифт считается проходимым для проверки столкновений (персонаж может на него зайти)
    return tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR || tileValue === TILE_LIFT;
  }

  findRandomInitialSpawnPosition() {
    if (!this.map) return undefined;
    const suitableTiles = [];
    // Сначала ищем более "открытые" места
    for (let r = 1; r < this.rows - 1; r++) {
      // Избегаем краев для первой попытки
      for (let c = 1; c < this.cols - 1; c++) {
        const tileValue = this.map[r]?.[c];
        const isLift =
          this.liftPosition && r === this.liftPosition.tileY && c === this.liftPosition.tileX;
        if ((tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) && !isLift) {
          if (this.isTileOpenEnough(c, r, 3, true)) {
            // Требуем 3 открытых стороны, избегаем узких проходов
            suitableTiles.push({ r, c });
          }
        }
      }
    }
    // Если не нашли идеальных, ищем с 2 открытыми сторонами
    if (suitableTiles.length === 0) {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const tileValue = this.map[r]?.[c];
          const isLift =
            this.liftPosition && r === this.liftPosition.tileY && c === this.liftPosition.tileX;
          if ((tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) && !isLift) {
            if (this.isTileOpenEnough(c, r, 2, true)) {
              // 2 открытых стороны, избегаем узких проходов
              suitableTiles.push({ r, c });
            }
          }
        }
      }
    }
    // Крайний случай: любая проходимая не лифтовая клетка
    if (suitableTiles.length === 0) {
      // console.warn(`[ProcMap F${this.floorNumber} RandomSpawn] No ideal spots. Using any valid non-lift floor/corridor.`);
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
        `[ProcMap F${this.floorNumber} RandomSpawn] CRITICAL: No suitable spawn tiles found!`
      );
      return undefined;
    }

    const { r, c } = suitableTiles[Math.floor(Math.random() * suitableTiles.length)];
    return { x: (c + 0.5) * this.tileSize, y: (r + 0.5) * this.tileSize };
  }

  isTileOpenEnough(tileX, tileY, minOpenSides = 2, avoidOneTileWidePassages = false) {
    const isDebugCurrentCall = this.floorNumber === DEBUG_FLOOR; // Логируем только для отладочного этажа
    // if (isDebugCurrentCall) console.log(`[ProcMap F${this.floorNumber} isTileOpenEnough] Checking (${tileX},${tileY}) with minOpenSides=${minOpenSides}, avoidNarrow=${avoidOneTileWidePassages}`);

    if (!this.map) return false;
    let openSidesCount = 0;
    // dx, dy, label
    const directions = [
      [0, -1, 'N'],
      [0, 1, 'S'],
      [-1, 0, 'W'],
      [1, 0, 'E'],
    ];
    const isOpenSide = [false, false, false, false]; // N, S, W, E
    // let neighborDebug = {}; // Раскомментируйте для детального лога соседей

    for (let i = 0; i < directions.length; i++) {
      const [dx, dy, dirLabel] = directions[i];
      const neighborX = tileX + dx;
      const neighborY = tileY + dy;
      let neighborTileValue = TILE_WALL; // По умолчанию стена, если за пределами

      if (neighborX >= 0 && neighborX < this.cols && neighborY >= 0 && neighborY < this.rows) {
        neighborTileValue = this.map[neighborY]?.[neighborX];
        if (
          neighborTileValue === TILE_CORRIDOR ||
          neighborTileValue === TILE_ROOM_FLOOR ||
          neighborTileValue === TILE_LIFT
        ) {
          openSidesCount++;
          isOpenSide[i] = true;
        }
      }
      // if (isDebugCurrentCall) neighborDebug[dirLabel] = `(${neighborX},${neighborY}) Type:${neighborTileValue} (Open:${isOpenSide[i]})`;
    }

    // if (isDebugCurrentCall) console.log(`  [isTileOpenEnough] Neighbors for (${tileX},${tileY}): ${JSON.stringify(neighborDebug)} -> openSidesCount: ${openSidesCount}`);

    if (openSidesCount < minOpenSides) {
      // if (isDebugCurrentCall) console.log(`  [isTileOpenEnough] RESULT for (${tileX},${tileY}): false (openSidesCount ${openSidesCount} < minOpenSides ${minOpenSides})`);
      return false;
    }

    if (avoidOneTileWidePassages && openSidesCount === 2) {
      // Проверка на проход шириной в 1 клетку (открыты только противоположные стороны)
      if (isOpenSide[0] && isOpenSide[1] && !isOpenSide[2] && !isOpenSide[3]) {
        // Север и Юг открыты, Запад и Восток закрыты
        // if (isDebugCurrentCall) console.log(`  [isTileOpenEnough] RESULT for (${tileX},${tileY}): false (vertical 1-tile passage)`);
        return false;
      }
      if (isOpenSide[2] && isOpenSide[3] && !isOpenSide[0] && !isOpenSide[1]) {
        // Запад и Восток открыты, Север и Юг закрыты
        // if (isDebugCurrentCall) console.log(`  [isTileOpenEnough] RESULT for (${tileX},${tileY}): false (horizontal 1-tile passage)`);
        return false;
      }
    }
    // if (isDebugCurrentCall) console.log(`  [isTileOpenEnough] RESULT for (${tileX},${tileY}): true`);
    return true;
  }

  findNearestWalkableTile(
    targetWorldX,
    targetWorldY,
    maxRadius = 8,
    excludeLift = false,
    avoidOneTileWidePassages = false
  ) {
    const isDebugCurrentCall = this.floorNumber === DEBUG_FLOOR;
    // if (isDebugCurrentCall) console.log(`[ProcMap F${this.floorNumber} findNearestWalkableTile] TargetWorld:(${targetWorldX.toFixed(1)},${targetWorldY.toFixed(1)}), maxR:${maxRadius}, excludeLift:${excludeLift}, avoidNarrow:${avoidOneTileWidePassages}`);

    if (!this.map) return null;
    const targetTileX = Math.floor(targetWorldX / this.tileSize);
    const targetTileY = Math.floor(targetWorldY / this.tileSize);
    // if (isDebugCurrentCall) console.log(`  [findNearest] TargetTile: (${targetTileX},${targetTileY})`);

    const targetSafeTiles = [TILE_CORRIDOR, TILE_ROOM_FLOOR]; // Куда хотим попасть

    // 1. Проверяем саму целевую клетку
    if (
      targetTileX >= 0 &&
      targetTileX < this.cols &&
      targetTileY >= 0 &&
      targetTileY < this.rows
    ) {
      const startTileValue = this.map[targetTileY][targetTileX];
      if (
        targetSafeTiles.includes(startTileValue) &&
        (!excludeLift || startTileValue !== TILE_LIFT)
      ) {
        // Если цель - лифт и мы его не исключаем, то требования к "открытости" могут быть ниже, т.к. это для pathfinding, а не спавна
        const minSidesForInitial = 2;
        if (
          this.isTileOpenEnough(
            targetTileX,
            targetTileY,
            minSidesForInitial,
            avoidOneTileWidePassages
          )
        ) {
          // if (isDebugCurrentCall) console.log(`  [findNearest] SUCCESS: Target tile (${targetTileX},${targetTileY}) is suitable.`);
          return { x: (targetTileX + 0.5) * this.tileSize, y: (targetTileY + 0.5) * this.tileSize };
        }
      }
    }

    // 2. Радиальный поиск
    for (let radius = 1; radius <= maxRadius; radius++) {
      // Если избегаем узких проходов, для ближайших соседей (radius=1) требуем больше открытых сторон
      const currentRadiusMinOpenSides = 2;
      // if (isDebugCurrentCall && radius === 1) console.log(`  [findNearest] Radial search (radius 1), minOpenSides for check: ${currentRadiusMinOpenSides}`);

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) < radius && Math.abs(dy) < radius) continue; // Только граница текущего радиуса
          const checkX = targetTileX + dx;
          const checkY = targetTileY + dy;

          if (checkX < 0 || checkX >= this.cols || checkY < 0 || checkY >= this.rows) continue; // В пределах карты

          const tileValue = this.map[checkY]?.[checkX];
          if (targetSafeTiles.includes(tileValue) && (!excludeLift || tileValue !== TILE_LIFT)) {
            // Подходит ли тип тайла
            if (
              this.isTileOpenEnough(
                checkX,
                checkY,
                currentRadiusMinOpenSides,
                avoidOneTileWidePassages
              )
            ) {
              // if (isDebugCurrentCall) console.log(`  [findNearest] SUCCESS: Radial found (${checkX},${checkY}) at radius ${radius}.`);
              return { x: (checkX + 0.5) * this.tileSize, y: (checkY + 0.5) * this.tileSize };
            }
          }
        }
      }
    }

    // 3. Поиск BFS (запасной вариант)
    // if (isDebugCurrentCall) console.warn(`  [findNearest] Radial search failed for target (${targetTileX},${targetTileY}). Starting BFS...`);
    const bfsMinOpenSides = 2; // Для BFS стандартные 2 стороны, но с проверкой avoidOneTileWidePassages
    const queue = [[targetTileX, targetTileY]];
    const visited = new Set([`${targetTileX},${targetTileY}`]);
    const directions = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]; // N, S, W, E
    // Для пути BFS можно проходить через лифт, даже если excludeLift=true (мы не хотим на нем ОСТАНОВИТЬСЯ)
    const bfsWalkablePathTiles = [TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT];

    while (queue.length > 0) {
      const [currX, currY] = queue.shift();
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
          visited.add(key);

          if (targetSafeTiles.includes(tileValue) && (!excludeLift || tileValue !== TILE_LIFT)) {
            // Нашли подходящий тип тайла
            if (this.isTileOpenEnough(nextX, nextY, bfsMinOpenSides, avoidOneTileWidePassages)) {
              // И он достаточно открыт
              // if (isDebugCurrentCall) console.log(`  [findNearest] SUCCESS: BFS found (${nextX},${nextY}).`);
              return { x: (nextX + 0.5) * this.tileSize, y: (nextY + 0.5) * this.tileSize };
            }
          }
          // Если тайл проходим для BFS, добавляем в очередь
          if (bfsWalkablePathTiles.includes(tileValue)) {
            queue.push([nextX, nextY]);
          }
        }
      }
    }

    // if (isDebugCurrentCall) console.error(`  [findNearest] FAILURE: No suitable tile found for target (${targetTileX},${targetTileY}) after all searches.`);
    return null;
  }

  getSpawnPointInRoomOfLift(liftTileX, liftTileY, preferredDistance = 2) {
    const isDebugCurrentCall = this.floorNumber === DEBUG_FLOOR;
    // if (isDebugCurrentCall) console.log(`[ProcMap F${this.floorNumber} getSpawnPointInRoomOfLift] Called for lift at (${liftTileX}, ${liftTileY}), preferredDist: ${preferredDistance}`);

    let associatedRoom = null;
    let entryPointToRoom = null; // {x, y} - клетка пола комнаты, примыкающая к лифту/коридору лифта
    let directionFromSourceToEntryPoint = null; // {dx, dy} - направление от источника (лифт или коридор у лифта) к entryPointToRoom

    const checkNeighbors = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ]; // N, S, W, E

    // Этап 1: Лифт напрямую примыкает к комнате?
    // Клетка лифта liftTileX, liftTileY МОЖЕТ быть TILE_CORRIDOR в this.map, если путь был проложен к ней.
    for (const n of checkNeighbors) {
      const adjX = liftTileX + n.dx; // Сосед клетки лифта
      const adjY = liftTileY + n.dy;
      if (
        adjX >= 0 &&
        adjX < this.cols &&
        adjY >= 0 &&
        adjY < this.rows &&
        this.map[adjY]?.[adjX] === TILE_ROOM_FLOOR
      ) {
        for (const room of this.rooms) {
          if (
            adjX >= room.x &&
            adjX < room.x + room.width &&
            adjY >= room.y &&
            adjY < room.y + room.height
          ) {
            associatedRoom = room;
            entryPointToRoom = { x: adjX, y: adjY }; // Это и есть точка входа в комнату
            directionFromSourceToEntryPoint = { dx: n.dx, dy: n.dy }; // Направление от лифта к этой точке
            // if (isDebugCurrentCall) console.log(`  [getSpawnPointInRoomOfLift] Lift (${liftTileX},${liftTileY}) directly adjacent to room floor at (${adjX},${adjY}). Room ID: ${room.id || 'N/A'}`);
            break;
          }
        }
      }
      if (associatedRoom) break;
    }

    // Этап 2: Если не напрямую, то через одну клетку коридора?
    if (!associatedRoom) {
      // if (isDebugCurrentCall) console.log(`  [getSpawnPointInRoomOfLift] Lift not directly adjacent. Checking neighbors of neighbors (via 1 corridor tile)...`);
      for (const nOuter of checkNeighbors) {
        // nOuter - направление к возможной клетке коридора рядом с лифтом
        const corridorX = liftTileX + nOuter.dx;
        const corridorY = liftTileY + nOuter.dy;

        // Проверяем, что эта промежуточная клетка - коридор
        if (
          corridorX < 0 ||
          corridorX >= this.cols ||
          corridorY < 0 ||
          corridorY >= this.rows ||
          this.map[corridorY]?.[corridorX] !== TILE_CORRIDOR
        ) {
          continue;
        }

        for (const nInner of checkNeighbors) {
          // nInner - направление от клетки коридора к возможной комнате
          // Не смотрим обратно на исходную клетку лифта
          if (nInner.dx === -nOuter.dx && nInner.dy === -nOuter.dy) continue;

          const potentialRoomX = corridorX + nInner.dx;
          const potentialRoomY = corridorY + nInner.dy;

          if (
            potentialRoomX >= 0 &&
            potentialRoomX < this.cols &&
            potentialRoomY >= 0 &&
            potentialRoomY < this.rows &&
            this.map[potentialRoomY]?.[potentialRoomX] === TILE_ROOM_FLOOR
          ) {
            for (const room of this.rooms) {
              if (
                potentialRoomX >= room.x &&
                potentialRoomX < room.x + room.width &&
                potentialRoomY >= room.y &&
                potentialRoomY < room.y + room.height
              ) {
                associatedRoom = room;
                entryPointToRoom = { x: potentialRoomX, y: potentialRoomY }; // Это точка входа в комнату
                directionFromSourceToEntryPoint = { dx: nInner.dx, dy: nInner.dy }; // Направление от коридора к этой точке
                // if (isDebugCurrentCall) console.log(`  [getSpawnPointInRoomOfLift] Lift near room via corridor (${corridorX},${corridorY}). Entry to room at (${potentialRoomX},${potentialRoomY}). Room ID: ${room.id || 'N/A'}`);
                break;
              }
            }
          }
          if (associatedRoom) break; // Нашли комнату через nInner
        }
        if (associatedRoom) break; // Нашли комнату через nOuter
      }
    }

    if (!associatedRoom || !entryPointToRoom || !directionFromSourceToEntryPoint) {
      //   if (isDebugCurrentCall) console.warn(`  [getSpawnPointInRoomOfLift] Could not find an associated room or entry point for lift at (${liftTileX},${liftTileY}).`);
      return null;
    }

    // Теперь directionFromSourceToEntryPoint - это направление от "двери" (entryPointToRoom) ВГЛУБЬ комнаты.
    const inwardDx = directionFromSourceToEntryPoint.dx;
    const inwardDy = directionFromSourceToEntryPoint.dy;

    // Ищем точку на (preferredDistance - 1) шагов вглубь от entryPointToRoom
    // preferredDistance = 2 -> dist = 1 (1 шаг от входа), dist = 0 (сам вход)
    // preferredDistance = 1 -> dist = 0 (сам вход)
    for (let distOffset = preferredDistance - 1; distOffset >= 0; distOffset--) {
      const spawnCandidateTileX = entryPointToRoom.x + inwardDx * distOffset;
      const spawnCandidateTileY = entryPointToRoom.y + inwardDy * distOffset;
      // if (isDebugCurrentCall) console.log(`  [getSpawnPointInRoomOfLift] Trying candidate (${spawnCandidateTileX},${spawnCandidateTileY}) at distOffset ${distOffset} from entry ${JSON.stringify(entryPointToRoom)}`);

      if (
        spawnCandidateTileX >= associatedRoom.x &&
        spawnCandidateTileX < associatedRoom.x + associatedRoom.width &&
        spawnCandidateTileY >= associatedRoom.y &&
        spawnCandidateTileY < associatedRoom.y + associatedRoom.height &&
        this.map[spawnCandidateTileY]?.[spawnCandidateTileX] === TILE_ROOM_FLOOR
      ) {
        // Проверка: есть ли еще одна клетка пола комнаты ЗА этой кандидатской точкой (в том же направлении inward)
        // Это гарантирует, что мы не спавнимся вплотную к "дальней" стене комнаты, если комната узкая.
        const furtherInX = spawnCandidateTileX + inwardDx;
        const furtherInY = spawnCandidateTileY + inwardDy;
        const hasSpaceBehind =
          furtherInX >= associatedRoom.x &&
          furtherInX < associatedRoom.x + associatedRoom.width &&
          furtherInY >= associatedRoom.y &&
          furtherInY < associatedRoom.y + associatedRoom.height &&
          this.map[furtherInY]?.[furtherInX] === TILE_ROOM_FLOOR;

        if (
          this.isTileOpenEnough(spawnCandidateTileX, spawnCandidateTileY, 2, true) &&
          hasSpaceBehind
        ) {
          //   if (isDebugCurrentCall) console.log(`  [getSpawnPointInRoomOfLift] SUCCESS: Found suitable spawn point in room: Tile (${spawnCandidateTileX},${spawnCandidateTileY}). Has space behind: ${hasSpaceBehind}`);
          return {
            x: (spawnCandidateTileX + 0.5) * this.tileSize,
            y: (spawnCandidateTileY + 0.5) * this.tileSize,
          };
        } else {
          // if (isDebugCurrentCall) console.log(`  [getSpawnPointInRoomOfLift] Candidate (${spawnCandidateTileX},${spawnCandidateTileY}) not suitable. OpenEnough: ${this.isTileOpenEnough(spawnCandidateTileX, spawnCandidateTileY, 2, true)}, HasSpaceBehind: ${hasSpaceBehind}`);
        }
      } else {
        // if (isDebugCurrentCall) console.log(`  [getSpawnPointInRoomOfLift] Candidate (${spawnCandidateTileX},${spawnCandidateTileY}) is not valid room floor or out of room bounds.`);
      }
    }

    // Если не нашли идеальную точку с пространством за спиной, пробуем сам entryPointToRoom (если он подходит)
    if (this.isTileOpenEnough(entryPointToRoom.x, entryPointToRoom.y, 2, true)) {
      // if (isDebugCurrentCall) console.log(`  [getSpawnPointInRoomOfLift] Fallback: Using entry point to room (${entryPointToRoom.x},${entryPointToRoom.y}) as it's open enough.`);
      return {
        x: (entryPointToRoom.x + 0.5) * this.tileSize,
        y: (entryPointToRoom.y + 0.5) * this.tileSize,
      };
    }

    // if (isDebugCurrentCall) console.warn(`  [getSpawnPointInRoomOfLift] FAILURE: Could not find any suitable spawn point inside room for lift at (${liftTileX},${liftTileY}).`);
    return null;
  }

  findNearbyUnansweredBook(worldX, worldY, radius = this.tileSize * 0.8) {
    if (!this.books || this.books.length === 0) return null;
    let closestBook = null;
    let minDistanceSq = radius * radius;

    for (const book of this.books) {
      if (!book.isCollected) {
        // Предполагаем, что у Book есть свойство isCollected
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
    const book = this.books.find((b) => b.id === bookToCollect.id); // Ищем по ID
    if (book && !book.isCollected) {
      book.isCollected = true;
      // console.log(`[ProcMap F${this.floorNumber}] Book ${book.id} marked as collected.`);
      return true;
    }
    return false;
  }

  findNearbyLift(worldX, worldY, radius = this.tileSize * LIFT_INTERACTION_RADIUS_MULTIPLIER) {
    if (!this.liftPosition) return null;
    // Расстояние от центра персонажа до центра клетки лифта
    const dx = worldX - this.liftPosition.x; // liftPosition.x - мировые координаты
    const dy = worldY - this.liftPosition.y;
    const distanceSq = dx * dx + dy * dy;
    return distanceSq < radius * radius ? this.liftPosition : null;
  }

  getLiftPosition() {
    return this.liftPosition; // Возвращает {x, y, tileX, tileY}
  }

  draw(ctx, bookImage = null) {
    if (!this.map || !this.renderer) return;

    const mapData = {
      map: this.map,
      rooms: this.rooms,
      books: this.books, // Передаем актуальный массив книг
      liftPosition: this.liftPosition, // Передаем tileX, tileY и мировые x,y лифта
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      cols: this.cols,
      rows: this.rows,
      tileSize: this.tileSize,
    };
    this.renderer.draw(ctx, mapData, bookImage); // bookImage - это спрайт для книг
  }

  logMapGrid() {
    if (!this.map) {
      console.log(`[ProcMap F${this.floorNumber}] Map grid not available.`);
      return;
    }
    console.log(`--- Map Grid Floor ${this.floorNumber} (${this.cols}x${this.rows}) ---`);
    let header = '   '; // Для номеров столбцов
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
              return '#'; // Стена
            case TILE_CORRIDOR:
              return '.'; // Коридор
            case TILE_ROOM_FLOOR:
              return ' '; // Пол комнаты
            case TILE_LIFT:
              return 'L'; // Лифт (хотя он может быть перезаписан коридором в this.map)
            default:
              return '?'; // Неизвестный тайл
          }
        })
        .join('');
      console.log(`${rowNum} ${rowString}`);
    }
    if (this.liftPosition) {
      console.log(
        `Lift actual tile type in map[${this.liftPosition.tileY}][${this.liftPosition.tileX}]: ${
          this.map[this.liftPosition.tileY]?.[this.liftPosition.tileX]
        }`
      );
      console.log(
        `Lift reported at tile: (${this.liftPosition.tileX}, ${this.liftPosition.tileY})`
      );
    } else {
      console.log('Lift position not set.');
    }
    console.log(`--- End Map Grid Floor ${this.floorNumber} ---`);
  }
}
