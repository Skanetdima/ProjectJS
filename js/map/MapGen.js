// src/map/mapGenerator.js

import {
  TILE_WALL,
  TILE_CORRIDOR,
  TILE_ROOM_FLOOR,
  TILE_LIFT,
  GYM_CHANCE_ON_FIRST_FLOOR, // Upewnij się, że to jest zdefiniowane w constants.js jako np. 0.2
} from '../utils/constants.js';
import { randomInt, performBFS } from '../utils/map.js';

let consistentLiftCoords = null;

const DEFAULT_GEN_PARAMS = {
  minRoomSize: 5,
  maxRoomSize: 10,
  corridorThickness: 1,
  numRooms: 12,
  maxRoomAttempts: 200,
  roomTypeWeights: {
    classroom: 50,
    office: 25,
    library: 15,
    gym: 0,
    utility: 10,
    lab: 10,
    storage: 5,
  },
};

export function generateLevelData(config) {
  const { cols, rows, floorNumber, minFloor, tileSize, generationParams: userParams } = config;
  const genParams = { ...DEFAULT_GEN_PARAMS, ...userParams };
  genParams.floorNumber = floorNumber; // Dodajemy numer piętra do genParams

  genParams.roomTypeWeights.gym =
    floorNumber === minFloor ? (GYM_CHANCE_ON_FIRST_FLOOR || 0) * 100 : 0;

  if (floorNumber === minFloor) {
    consistentLiftCoords = null;
    console.log(`[MapGen Floor ${floorNumber}] Reset consistent lift coords for the first floor.`);
  }

  console.log(`[MapGen Floor ${floorNumber}] Starting map generation (${cols}x${rows})...`);
  const map = Array.from({ length: rows }, () => Array(cols).fill(TILE_WALL));
  const rooms = [];
  let liftPosition = null;

  _placeRooms(map, rooms, cols, rows, genParams);

  if (rooms.length < 1) {
    const errorMsg = `[MapGen Floor ${floorNumber}] CRITICAL: No rooms generated. Cannot place lift.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  } else if (rooms.length >= 2) {
    _connectRoomsBetter(map, rooms, cols, rows);
  } else {
    console.warn(
      `[MapGen Floor ${floorNumber}] Only 1 room generated. No corridors needed between rooms.`
    );
  }

  try {
    const placedLiftData = _placeLift(
      map,
      cols,
      rows,
      floorNumber,
      minFloor,
      tileSize,
      consistentLiftCoords,
      rooms
    );
    liftPosition = placedLiftData.position;
    if (placedLiftData.coords) {
      consistentLiftCoords = placedLiftData.coords;
    }
  } catch (error) {
    console.error(`[MapGen Floor ${floorNumber}] CRITICAL: Lift placement failed:`, error);
    throw new Error(`Lift placement failed on floor ${floorNumber}: ${error.message}`);
  }

  _ensureMapBorders(map, cols, rows);

  if (liftPosition && !_isLiftReachable(map, liftPosition, cols, rows)) {
    console.warn(
      `[MapValidation Floor ${floorNumber}] Lift at tile(${liftPosition.tileX}, ${liftPosition.tileY}) initially unreachable. Attempting final force connection.`
    );
    const connected = _forceConnectionToPoint(
      map,
      liftPosition.tileX,
      liftPosition.tileY,
      cols,
      rows
    );
    if (!connected || !_isLiftReachable(map, liftPosition, cols, rows)) {
      const errorMsg = `CRITICAL: Placed lift at tile(${liftPosition.tileX}, ${liftPosition.tileY}) is UNREACHABLE even after force connect! Generation failed.`;
      console.error(`[MapGen Floor ${floorNumber}] ${errorMsg}`);
      logMapGridForDebug(map, cols, rows);
      throw new Error(`Lift is unreachable on floor ${floorNumber}. Cannot proceed.`);
    } else {
      console.log(
        `[MapValidation Floor ${floorNumber}] Lift connection successful after second attempt.`
      );
    }
  } else if (liftPosition) {
    console.log(
      `[MapValidation Floor ${floorNumber}] Lift at tile(${liftPosition.tileX}, ${liftPosition.tileY}) is reachable.`
    );
  } else {
    throw new Error(`Map generated without a valid lift position on floor ${floorNumber}.`);
  }

  console.log(`[MapGen Floor ${floorNumber}] Map generation completed successfully.`);
  return { map, rooms, liftPosition };
}

function _placeRooms(map, rooms, cols, rows, genParams) {
  const { minRoomSize, maxRoomSize, numRooms, maxRoomAttempts, roomTypeWeights } = genParams;
  let roomAttempts = 0;
  const weightedTypes = [];

  for (const type in roomTypeWeights) {
    const weight = roomTypeWeights[type];
    if (weight > 0) {
      for (let i = 0; i < weight; i++) weightedTypes.push(type);
    }
  }
  if (weightedTypes.length === 0) {
    weightedTypes.push('utility');
    console.warn("[MapGen Rooms] No room types. Defaulting to 'utility'.");
  }

  while (rooms.length < numRooms && roomAttempts < maxRoomAttempts) {
    roomAttempts++;
    const roomWidth = randomInt(minRoomSize, maxRoomSize);
    const roomHeight = randomInt(minRoomSize, maxRoomSize);
    const roomCol = randomInt(1, cols - roomWidth - 2); // -2 to leave border
    const roomRow = randomInt(1, rows - roomHeight - 2); // -2 to leave border

    const roomType = weightedTypes[randomInt(0, weightedTypes.length - 1)];
    const newRoom = {
      col: roomCol,
      row: roomRow,
      width: roomWidth,
      height: roomHeight,
      type: roomType,
      id: `room_f${genParams.floorNumber}_${rooms.length + 1}`,
      centerTileX: Math.floor(roomCol + roomWidth / 2),
      centerTileY: Math.floor(roomRow + roomHeight / 2),
      connected: false,
      x: roomCol,
      y: roomRow,
    };

    let overlaps = false;
    const buffer = 2;
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
      for (let r = newRoom.row; r < newRoom.row + newRoom.height; r++) {
        for (let c = newRoom.col; c < newRoom.col + newRoom.width; c++) {
          if (r >= 0 && r < rows && c >= 0 && c < cols) map[r][c] = TILE_ROOM_FLOOR;
        }
      }
    }
  }
  if (rooms.length < numRooms)
    console.warn(`[MapGen Rooms] Placed ${rooms.length}/${numRooms} rooms.`);
  else console.log(`[MapGen Rooms] Placed ${rooms.length} rooms.`);
}

function _connectRoomsBetter(map, rooms, cols, rows) {
  if (rooms.length < 2) return;
  console.log(`[MapGen Connect] Connecting ${rooms.length} rooms...`);
  const connectedSet = new Set([rooms[0].id]);
  let unconnectedRooms = rooms.slice(1);

  while (unconnectedRooms.length > 0) {
    let bestDistSq = Infinity,
      bestUncRoom = null,
      bestConRoomId = null,
      bestUncIdx = -1;
    for (let i = 0; i < unconnectedRooms.length; i++) {
      const roomU = unconnectedRooms[i];
      for (const roomC of rooms) {
        if (connectedSet.has(roomC.id)) {
          const dx = roomU.centerTileX - roomC.centerTileX;
          const dy = roomU.centerTileY - roomC.centerTileY;
          const distSq = dx * dx + dy * dy;
          if (distSq < bestDistSq) {
            bestDistSq = distSq;
            bestUncRoom = roomU;
            bestConRoomId = roomC.id;
            bestUncIdx = i;
          }
        }
      }
    }
    if (bestUncRoom && bestConRoomId !== null) {
      const bestConRoom = rooms.find((r) => r.id === bestConRoomId);
      if (!bestConRoom) {
        console.error(`[MapGen Connect] Error finding connected room ${bestConRoomId}.`);
        unconnectedRooms.splice(bestUncIdx, 1);
        continue;
      }
      _carveCorridorBetween(map, bestConRoom, bestUncRoom, cols, rows);
      connectedSet.add(bestUncRoom.id);
      unconnectedRooms.splice(bestUncIdx, 1);
    } else {
      console.error(
        '[MapGen Connect] Could not find next pair. Remaining:',
        unconnectedRooms.map((r) => r.id)
      );
      break;
    }
  }
  console.log(`[MapGen Connect] Finished. Connected: ${connectedSet.size}`);
}

function _carveCorridorBetween(map, roomA, roomB, cols, rows) {
  const { centerTileX: ax, centerTileY: ay } = roomA;
  const { centerTileX: bx, centerTileY: by } = roomB;
  if (Math.random() < 0.5) {
    _carveHorizontalCorridor(map, ay, ax, bx, cols, rows);
    _carveVerticalCorridor(map, bx, ay, by, cols, rows);
  } else {
    _carveVerticalCorridor(map, ax, ay, by, cols, rows);
    _carveHorizontalCorridor(map, by, ax, bx, cols, rows);
  }
}

function _carveHorizontalCorridor(map, r, c1, c2, cols, rows) {
  if (r < 0 || r >= rows) return;
  const startC = Math.max(0, Math.min(c1, c2)),
    endC = Math.min(cols - 1, Math.max(c1, c2));
  for (let c = startC; c <= endC; c++) if (map[r]?.[c] === TILE_WALL) map[r][c] = TILE_CORRIDOR;
}
function _carveVerticalCorridor(map, c, r1, r2, cols, rows) {
  if (c < 0 || c >= cols) return;
  const startR = Math.max(0, Math.min(r1, r2)),
    endR = Math.min(rows - 1, Math.max(r1, r2));
  for (let r = startR; r <= endR; r++) if (map[r]?.[c] === TILE_WALL) map[r][c] = TILE_CORRIDOR;
}

function _getTileOpennessDetails(tileX, tileY, map, cols, rows) {
  const isWalkable = (x, y) => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) return false;
    const val = map[y]?.[x];
    return val === TILE_CORRIDOR || val === TILE_ROOM_FLOOR || val === TILE_LIFT;
  };
  let openSides = 0;
  const deltas = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  let flags = [false, false, false, false]; // N,S,W,E
  for (let i = 0; i < deltas.length; i++) {
    if (isWalkable(tileX + deltas[i].dx, tileY + deltas[i].dy)) {
      openSides++;
      flags[i] = true;
    }
  }
  let isChokepoint =
    openSides === 2 &&
    ((flags[0] && flags[1] && !flags[2] && !flags[3]) ||
      (flags[2] && flags[3] && !flags[0] && !flags[1]));
  return { openSides, isChokepoint };
}

function _findLiftPlacementLocation(map, cols, rows, roomsList) {
  console.log(`  [MapGen FindLift V6] Searching for lift spot INSIDE a room...`);
  if (!roomsList || roomsList.length === 0) {
    console.warn(`  [MapGen FindLift V6] No rooms. Placement will fail.`);
    return null;
  }
  const candidates = [];
  for (const room of roomsList) {
    const startIC = room.col + 1,
      endIC = room.col + room.width - 2;
    const startIR = room.row + 1,
      endIR = room.row + room.height - 2;
    if (startIC <= endIC && startIR <= endIR) {
      for (let r = startIR; r <= endIR; r++) {
        for (let c = startIC; c <= endIC; c++) {
          if (map[r]?.[c] === TILE_ROOM_FLOOR) {
            const d = _getTileOpennessDetails(c, r, map, cols, rows);
            if (!d.isChokepoint && d.openSides >= 2) candidates.push({ tileX: c, tileY: r, room });
          }
        }
      }
    } else {
      const c = room.centerTileX,
        r = room.centerTileY;
      if (
        c >= room.col &&
        c < room.col + room.width &&
        r >= room.row &&
        r < room.row + room.height &&
        map[r]?.[c] === TILE_ROOM_FLOOR
      ) {
        const d = _getTileOpennessDetails(c, r, map, cols, rows);
        if (!d.isChokepoint && d.openSides >= 1) candidates.push({ tileX: c, tileY: r, room });
      }
    }
  }
  if (candidates.length > 0) {
    const cX = Math.floor(cols / 2),
      cY = Math.floor(rows / 2);
    candidates.sort(
      (a, b) =>
        (a.tileX - cX) ** 2 + (a.tileY - cY) ** 2 - ((b.tileX - cX) ** 2 + (b.tileY - cY) ** 2)
    );
    const best = candidates[0];
    console.log(
      `  [MapGen FindLift V6] Selected IN ROOM (${best.room.id}) @(${best.tileX},${best.tileY}).`
    );
    return { tileX: best.tileX, tileY: best.tileY };
  }
  console.warn('[MapGen FindLift V6] No suitable IN-ROOM location. Will fail.');
  return null;
}

function _placeLift(
  map,
  cols,
  rows,
  floorNumber,
  minFloor,
  tileSize,
  currentConsistentCoords,
  roomsList
) {
  let coordsToUse = currentConsistentCoords,
    newlyFoundCoords = null;

  if (floorNumber === minFloor) {
    console.log(`[MapGen F${floorNumber}] Finding initial IN-ROOM lift loc...`);
    coordsToUse = _findLiftPlacementLocation(map, cols, rows, roomsList);
    if (!coordsToUse)
      throw new Error(`[MapGen F${floorNumber}] CRIT: No valid IN-ROOM lift loc on minFloor.`);
    console.log(
      `[MapGen F${floorNumber}] Established consistent IN-ROOM lift @(${coordsToUse.tileX},${coordsToUse.tileY})`
    );
    newlyFoundCoords = coordsToUse;
  } else if (!coordsToUse) {
    throw new Error(`[MapGen Lift] CRIT: Missing consistent lift coords for F${floorNumber}.`);
  }

  const { tileX, tileY } = coordsToUse;
  if (tileY < 0 || tileY >= rows || tileX < 0 || tileX >= cols)
    throw new Error(`[MapGen Lift] Coords (${tileX},${tileY}) out of bounds F${floorNumber}.`);

  const tileValueBeforeLift = map[tileY]?.[tileX];

  if (map[tileY][tileX] === TILE_WALL) {
    console.warn(
      `[MapGen F${floorNumber}] Lift loc (${tileX},${tileY}) is WALL. Forcing connection...`
    );
    const connected = _forceConnectionToPoint(map, tileX, tileY, cols, rows);
    if (!connected && map[tileY][tileX] === TILE_WALL)
      console.error(
        `[MapGen LiftConnect] FAILED to connect wall @(${tileX},${tileY}) & it REMAINED WALL.`
      );
  }

  map[tileY][tileX] = TILE_LIFT; // Place lift tile FIRST
  let liftRoomObject = null;

  for (const room of roomsList) {
    if (
      tileX >= room.col &&
      tileX < room.col + room.width &&
      tileY >= room.row &&
      tileY < room.row + room.height
    ) {
      // Check if the tile *before* placing the lift was part of this room's floor
      if (tileValueBeforeLift === TILE_ROOM_FLOOR) {
        liftRoomObject = room;
        console.log(
          `  [MapGen Lift F${floorNumber}] Lift @(${tileX},${tileY}) is on TILE_ROOM_FLOOR within existing room ${room.id}.`
        );
        break;
      }
    }
  }

  if (!liftRoomObject) {
    // This block will execute if:
    // 1. On minFloor: _findLiftPlacementLocation picked a tile that wasn't TILE_ROOM_FLOOR (bad, should error earlier)
    // 2. On N > minFloor: The consistentLiftCoords landed on something other than an existing room's floor (e.g., corridor, or newly carved wall if map structure changed a lot)
    const messageReason = !liftRoomObject
      ? 'Not in existing room region'
      : `Original tile was ${tileValueBeforeLift}, not TILE_ROOM_FLOOR.`;

    console.warn(
      `[MapGen F${floorNumber}] Lift @(${tileX},${tileY}) will use carved alcove. Reason: ${messageReason}`
    );

    if (floorNumber === minFloor && tileValueBeforeLift !== TILE_ROOM_FLOOR) {
      console.error(
        `[MapGen F${floorNumber}] CRITICAL MISMATCH on minFloor! _findLiftPlacementLocation selected (${tileX},${tileY}) which was type ${tileValueBeforeLift}, not TILE_ROOM_FLOOR. This indicates a flaw in _findLiftPlacementLocation.`
      );
      // Forcing alcove creation, but this is a symptom of a deeper issue for minFloor.
    }

    const alcoveSize = 3;
    const alcoveCol = Math.max(1, tileX - Math.floor(alcoveSize / 2)); // Ensure alcove doesn't start at col 0
    const alcoveRow = Math.max(1, tileY - Math.floor(alcoveSize / 2)); // Ensure alcove doesn't start at row 0
    // Ensure alcove does not go out of bounds and respects map borders
    const alcoveWidth = Math.min(alcoveSize, cols - 1 - alcoveCol);
    const alcoveHeight = Math.min(alcoveSize, rows - 1 - alcoveRow);

    const newLiftRoomData = {
      col: alcoveCol,
      row: alcoveRow,
      width: alcoveWidth,
      height: alcoveHeight,
      type: 'lift_alcove',
      id: `room_f${floorNumber}_liftalcove_${tileX}_${tileY}`,
      centerTileX: tileX,
      centerTileY: tileY,
      connected: true,
      x: alcoveCol,
      y: alcoveRow,
    };

    for (let r = newLiftRoomData.row; r < newLiftRoomData.row + newLiftRoomData.height; r++) {
      for (let c = newLiftRoomData.col; c < newLiftRoomData.col + newLiftRoomData.width; c++) {
        if (map[r]?.[c] !== TILE_LIFT) {
          // Don't overwrite the lift itself
          if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) map[r][c] = TILE_ROOM_FLOOR; // Carve, avoid map edges
        }
      }
    }
    roomsList.push(newLiftRoomData);
    liftRoomObject = newLiftRoomData;
  }

  if (!liftRoomObject) {
    const errorMsg = `[MapGen Lift F${floorNumber}] CRIT: Could NOT associate lift @(${tileX},${tileY}) with any room object even after alcove attempt.`;
    console.error(errorMsg);
    logMapGridForDebug(map, cols, rows);
    throw new Error(errorMsg);
  }

  const liftWorldPos = {
    x: (tileX + 0.5) * tileSize,
    y: (tileY + 0.5) * tileSize,
    tileX,
    tileY,
    roomId: liftRoomObject.id,
  };
  console.log(
    `[MapGen F${floorNumber}] Placed lift @(${tileX},${tileY}) in room ${
      liftRoomObject.id
    }. World:(${liftWorldPos.x.toFixed(1)},${liftWorldPos.y.toFixed(1)})`
  );
  return { position: liftWorldPos, coords: newlyFoundCoords || coordsToUse };
}

function _forceConnectionToPoint(map, targetX, targetY, cols, rows) {
  console.log(`  [MapGen Connect] Forcing connection to (${targetX},${targetY})...`);
  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  for (const [dx, dy] of dirs) {
    const nt = map[targetY + dy]?.[targetX + dx];
    if (nt === TILE_CORRIDOR || nt === TILE_ROOM_FLOOR || nt === TILE_LIFT) {
      if (map[targetY][targetX] === TILE_WALL) map[targetY][targetX] = TILE_CORRIDOR;
      return true;
    }
  }
  const q = [[targetX, targetY, 0]],
    visited = new Set([`${targetX},${targetY}`]);
  const pathable = [TILE_WALL, TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT],
    targets = [TILE_CORRIDOR, TILE_ROOM_FLOOR];
  let closest = null,
    minDist = Infinity;
  while (q.length > 0) {
    const [cX, cY, d] = q.shift();
    if (d >= minDist && closest) continue;
    for (const [dx, dy] of dirs) {
      const nX = cX + dx,
        nY = cY + dy,
        key = `${nX},${nY}`;
      if (nX >= 0 && nX < cols && nY >= 0 && nY < rows && !visited.has(key)) {
        const val = map[nY]?.[nX];
        visited.add(key);
        if (targets.includes(val)) {
          if (d + 1 <= minDist) {
            minDist = d + 1;
            closest = { x: nX, y: nY, dist: minDist };
          }
        } else if (pathable.includes(val)) {
          if (d + 1 < minDist || !closest) q.push([nX, nY, d + 1]);
        }
      }
    }
  }
  if (closest) {
    console.log(
      `  [MapGen Connect] Closest walkable @(${closest.x},${closest.y}), dist ${closest.dist}. Carving...`
    );
    _carveHorizontalCorridor(map, targetY, targetX, closest.x, cols, rows);
    _carveVerticalCorridor(map, closest.x, targetY, closest.y, cols, rows);
    if (map[targetY][targetX] === TILE_CORRIDOR || map[targetY][targetX] === TILE_ROOM_FLOOR)
      return true;
    console.warn(
      `  [MapGen Connect] Carved, but target (${targetX},${targetY}) not Corridor/Floor (is ${map[targetY][targetX]}).`
    );
    return map[targetY][targetX] !== TILE_WALL;
  }
  console.error(`  [MapGen Connect] FAILED to find ANY walkable from (${targetX},${targetY}).`);
  return false;
}

function _isLiftReachable(map, liftPos, cols, rows) {
  if (!liftPos) return false;
  const { tileX, tileY } = liftPos;
  if (
    tileY < 0 ||
    tileY >= rows ||
    tileX < 0 ||
    tileX >= cols ||
    map[tileY]?.[tileX] !== TILE_LIFT
  ) {
    console.error(`[MapVal Reach] Invalid lift @(${tileX},${tileY}) or not LIFT.`);
    return false;
  }
  const walkable = [TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT],
    targets = [TILE_CORRIDOR, TILE_ROOM_FLOOR];
  const { reachable } = performBFS(
    map,
    tileX,
    tileY,
    cols,
    rows,
    walkable,
    targets,
    (tx, ty) => map[ty]?.[tx]
  );
  if (!reachable) console.error(`[MapVal Reach] FAILED. Lift @(${tileX},${tileY}) isolated.`);
  return reachable;
}

function _ensureMapBorders(map, cols, rows) {
  for (let c = 0; c < cols; c++) {
    map[0][c] = TILE_WALL;
    map[rows - 1][c] = TILE_WALL;
  }
  for (let r = 0; r < rows; r++) {
    map[r][0] = TILE_WALL;
    map[r][cols - 1] = TILE_WALL;
  }
}

function logMapGridForDebug(map, cols, rows) {
  if (!map) {
    console.log('[DEBUG MAP] null map.');
    return;
  }
  console.log('--- DEBUG MAP GRID ---');
  let h = '   ';
  for (let c = 0; c < cols; c++) h += c % 10 === 0 ? Math.floor(c / 10) : ' ';
  console.log(h);
  h = '   ';
  for (let c = 0; c < cols; c++) h += c % 10;
  console.log(h);
  for (let y = 0; y < rows; y++) {
    if (!map[y]) {
      console.log(`${y.toString().padStart(2, ' ')} [ROW UNDEF]`);
      continue;
    }
    const rS = map[y]
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
    console.log(`${y.toString().padStart(2, ' ')} ${rS}`);
  }
  console.log('--- END DEBUG MAP GRID ---');
}
