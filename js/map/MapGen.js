// src/map/mapGenerator.js

import {
  TILE_WALL,
  TILE_CORRIDOR,
  TILE_ROOM_FLOOR,
  TILE_LIFT,
  GYM_CHANCE_ON_FIRST_FLOOR,
} from '../utils/constants.js';
import { randomInt, performBFS } from '../utils/map.js'; // Assuming performBFS is in map.js

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
// In generateLevelData, make sure to pass `rooms` to `_placeLift`
export function generateLevelData(config) {
  const { cols, rows, floorNumber, minFloor, tileSize, generationParams: userParams } = config;
  const genParams = { ...DEFAULT_GEN_PARAMS, ...userParams };

  genParams.roomTypeWeights.gym = floorNumber === minFloor ? GYM_CHANCE_ON_FIRST_FLOOR * 100 : 0;

  if (floorNumber === minFloor) {
    consistentLiftCoords = null;
    console.log(`[MapGen Floor ${floorNumber}] Reset consistent lift coords for the first floor.`);
  }

  console.log(`[MapGen Floor ${floorNumber}] Starting map generation (${cols}x${rows})...`);
  const map = Array.from({ length: rows }, () => Array(cols).fill(TILE_WALL));
  const rooms = []; // This is the `roomsList`
  let liftPosition = null;

  _placeRooms(map, rooms, cols, rows, genParams); // rooms is populated here

  if (rooms.length < 2 && floorNumber !== minFloor) {
    console.warn(
      `[MapGen Floor ${floorNumber}] Placed only ${rooms.length} rooms. Expect limited connectivity.`
    );
  } else if (rooms.length >= 2) {
    _connectRoomsBetter(map, rooms, cols, rows);
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
      rooms // PASS THE GENERATED ROOMS LIST HERE
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

// --- Helper: Place Rooms ---
function _placeRooms(map, rooms, cols, rows, genParams) {
  const { minRoomSize, maxRoomSize, numRooms, maxRoomAttempts, roomTypeWeights } = genParams;
  let roomAttempts = 0;

  const weightedTypes = [];
  let totalWeight = 0;
  for (const type in roomTypeWeights) {
    const weight = roomTypeWeights[type];
    if (weight > 0) {
      totalWeight += weight;
      for (let i = 0; i < weight; i++) {
        weightedTypes.push(type);
      }
    }
  }
  // Ensure weightedTypes is not empty if all weights are 0 (edge case)
  if (weightedTypes.length === 0) {
    weightedTypes.push('utility'); // Default fallback
    console.warn(
      "[MapGen Rooms] No room type weights provided or all are zero. Defaulting to 'utility'."
    );
  }

  while (rooms.length < numRooms && roomAttempts < maxRoomAttempts) {
    roomAttempts++;
    const roomWidth = randomInt(minRoomSize, maxRoomSize);
    const roomHeight = randomInt(minRoomSize, maxRoomSize);
    // Ensure room fits within map boundaries (leaving 1-tile border)
    const roomCol = randomInt(1, cols - roomWidth - 1);
    const roomRow = randomInt(1, rows - roomHeight - 1);

    const roomType = weightedTypes[randomInt(0, weightedTypes.length - 1)];

    const newRoom = {
      col: roomCol,
      row: roomRow,
      width: roomWidth,
      height: roomHeight,
      type: roomType,
      id: `room_${rooms.length + 1}`,
      centerTileX: Math.floor(roomCol + roomWidth / 2),
      centerTileY: Math.floor(roomRow + roomHeight / 2),
      connected: false,
    };

    let overlaps = false;
    const buffer = 2; // Keep a buffer between rooms
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
          // Double check bounds just in case calculation was off
          if (r >= 0 && r < rows && c >= 0 && c < cols) {
            map[r][c] = TILE_ROOM_FLOOR;
          }
        }
      }
    }
  }
  if (rooms.length < numRooms) {
    console.warn(
      `[MapGen Rooms] Placed only ${rooms.length}/${numRooms} rooms after ${roomAttempts} attempts.`
    );
  } else {
    console.log(`[MapGen Rooms] Placed ${rooms.length} rooms after ${roomAttempts} attempts.`);
  }
}

// --- Helper: Connect Rooms ---
function _connectRoomsBetter(map, rooms, cols, rows) {
  if (rooms.length < 2) return;
  console.log(`[MapGen Connect] Connecting ${rooms.length} rooms (improved)...`);

  // Use a Set for faster checking of connected status
  const connectedSet = new Set([rooms[0].id]);
  let unconnectedRooms = rooms.slice(1); // Start with all but the first

  while (unconnectedRooms.length > 0) {
    let bestDistanceSq = Infinity;
    let bestUnconnectedRoom = null;
    let bestConnectedRoomId = null; // Store ID of the connected room
    let bestUnconnectedIndex = -1;

    // Find the unconnected room closest to ANY connected room
    for (let i = 0; i < unconnectedRooms.length; i++) {
      const roomU = unconnectedRooms[i];
      for (const roomC of rooms) {
        // Iterate through ALL rooms
        if (connectedSet.has(roomC.id)) {
          // Check if roomC is connected
          const dx = roomU.centerTileX - roomC.centerTileX;
          const dy = roomU.centerTileY - roomC.centerTileY;
          const distSq = dx * dx + dy * dy;
          if (distSq < bestDistanceSq) {
            bestDistanceSq = distSq;
            bestUnconnectedRoom = roomU;
            bestConnectedRoomId = roomC.id;
            bestUnconnectedIndex = i;
          }
        }
      }
    }

    if (bestUnconnectedRoom && bestConnectedRoomId !== null) {
      // Find the actual connected room object using the ID
      const bestConnectedRoom = rooms.find((r) => r.id === bestConnectedRoomId);
      if (!bestConnectedRoom) {
        console.error(
          `[MapGen Connect] Error: Could not find connected room with ID ${bestConnectedRoomId}. Skipping connection.`
        );
        // Remove the problematic unconnected room to avoid infinite loop
        unconnectedRooms.splice(bestUnconnectedIndex, 1);
        continue;
      }

      _carveCorridorBetween(map, bestConnectedRoom, bestUnconnectedRoom, cols, rows);
      connectedSet.add(bestUnconnectedRoom.id); // Add the newly connected room ID to the set
      unconnectedRooms.splice(bestUnconnectedIndex, 1); // Remove from unconnected list
    } else {
      console.error(
        '[MapGen Connect] Could not find next pair of rooms to connect. Breaking loop. Remaining unconnected:',
        unconnectedRooms.map((r) => r.id)
      );
      break; // Avoid infinite loop if something went wrong
    }
  }
  console.log(`[MapGen Connect] Finished connecting rooms. Connected count: ${connectedSet.size}`);
}

// --- Helper: Carve Corridors ---
function _carveCorridorBetween(map, roomA, roomB, cols, rows) {
  const { centerTileX: ax, centerTileY: ay } = roomA;
  const { centerTileX: bx, centerTileY: by } = roomB;
  // Randomly choose L-shape direction (Horizontal then Vertical, or Vertical then Horizontal)
  if (Math.random() < 0.5) {
    // H then V
    _carveHorizontalCorridor(map, ay, ax, bx, cols, rows);
    _carveVerticalCorridor(map, bx, ay, by, cols, rows);
  } else {
    // V then H
    _carveVerticalCorridor(map, ax, ay, by, cols, rows);
    _carveHorizontalCorridor(map, by, ax, bx, cols, rows);
  }
}
function _carveHorizontalCorridor(map, r, c1, c2, cols, rows) {
  // Ensure row is valid
  if (r < 0 || r >= rows) return;
  const startCol = Math.max(0, Math.min(c1, c2)); // Clamp to map bounds
  const endCol = Math.min(cols - 1, Math.max(c1, c2)); // Clamp to map bounds
  for (let c = startCol; c <= endCol; c++) {
    // Only carve if it's currently a wall
    if (map[r]?.[c] === TILE_WALL) {
      map[r][c] = TILE_CORRIDOR;
    }
    // Optional: Also carve adjacent vertical tiles for thickness > 1
    // if (thickness > 1 && r+1 < rows && map[r+1]?.[c] === TILE_WALL) map[r+1][c] = TILE_CORRIDOR;
  }
}
function _carveVerticalCorridor(map, c, r1, r2, cols, rows) {
  // Ensure col is valid
  if (c < 0 || c >= cols) return;
  const startRow = Math.max(0, Math.min(r1, r2)); // Clamp to map bounds
  const endRow = Math.min(rows - 1, Math.max(r1, r2)); // Clamp to map bounds
  for (let r = startRow; r <= endRow; r++) {
    // Only carve if it's currently a wall
    if (map[r]?.[c] === TILE_WALL) {
      map[r][c] = TILE_CORRIDOR;
    }
    // Optional: Also carve adjacent horizontal tiles for thickness > 1
    // if (thickness > 1 && c+1 < cols && map[r]?.[c+1] === TILE_WALL) map[r][c+1] = TILE_CORRIDOR;
  }
}

// --- NEW HELPER: Get Tile Openness Details ---
function _getTileOpennessDetails(tileX, tileY, map, cols, rows) {
  // Local walkable definition for this helper
  const isTileWalkable = (x, y, currentMap, mapCols, mapRows) => {
    if (x < 0 || x >= mapCols || y < 0 || y >= mapRows) return false;
    const tileVal = currentMap[y]?.[x];
    return tileVal === TILE_CORRIDOR || tileVal === TILE_ROOM_FLOOR || tileVal === TILE_LIFT;
  };

  let openSides = 0;
  // Order: N, S, W, E
  const neighborDeltas = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  let walkableNeighborFlags = [false, false, false, false]; // N, S, W, E

  for (let i = 0; i < neighborDeltas.length; i++) {
    const nx = tileX + neighborDeltas[i].dx;
    const ny = tileY + neighborDeltas[i].dy;
    if (isTileWalkable(nx, ny, map, cols, rows)) {
      openSides++;
      walkableNeighborFlags[i] = true;
    }
  }

  let isChokepoint = false;
  if (openSides === 2) {
    const [N, S, W, E] = walkableNeighborFlags;
    // Vertical chokepoint (N&S open, W&E closed) OR Horizontal chokepoint (W&E open, N&S closed)
    if ((N && S && !W && !E) || (W && E && !N && !S)) {
      isChokepoint = true;
    }
  }
  return { openSides, isChokepoint };
}

// --- Helper: Place Lift ---
// Takes current `liftCoords` and returns the used/found coords and position
// Modify _placeLift to pass the rooms list to _findLiftPlacementLocation
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
  // Added roomsList
  let coordsToUse = currentConsistentCoords;
  let newlyFoundCoords = null;

  // Find coords only on the first floor if not already set
  if (floorNumber === minFloor && !coordsToUse) {
    console.log(`[MapGen Floor ${floorNumber}] Finding initial lift placement location...`);
    coordsToUse = _findLiftPlacementLocation(map, cols, rows, roomsList); // PASS roomsList
    if (!coordsToUse) {
      // Fallback: if no good room spot, try the previous general find logic (which includes corridors)
      // For simplicity here, we'll just go to the center. A more robust fallback could be to call
      // a version of _findLiftPlacementLocation that *does* consider corridors.
      console.warn(
        `[MapGen Floor ${floorNumber}] No ideal IN-ROOM lift location found. Forcing placement near center.`
      );
      coordsToUse = { tileX: Math.floor(cols / 2), tileY: Math.floor(rows / 2) };
    }
    console.log(
      `[MapGen Floor ${floorNumber}] Established consistent lift coords at tile(${coordsToUse.tileX}, ${coordsToUse.tileY})`
    );
    newlyFoundCoords = coordsToUse;
  } else if (!coordsToUse && floorNumber > minFloor) {
    throw new Error(`[MapGen Lift] Missing consistent coordinates for floor ${floorNumber}.`);
  }

  const { tileX, tileY } = coordsToUse;

  // Basic bounds check for safety
  if (tileY < 0 || tileY >= rows || tileX < 0 || tileX >= cols) {
    // This might happen if the fallback coords are bad on a very small map
    const safeFallbackX = Math.max(1, Math.min(cols - 2, tileX));
    const safeFallbackY = Math.max(1, Math.min(rows - 2, tileY));
    console.error(
      `[MapGen Lift] Coords (${tileX}, ${tileY}) are outside map bounds on floor ${floorNumber}. Adjusted to (${safeFallbackX},${safeFallbackY})`
    );
    coordsToUse = { tileX: safeFallbackX, tileY: safeFallbackY };
    // Re-assign tileX, tileY for the rest of the function
    // This is a bit hacky; ideally, the primary find logic or its fallback should always return valid coords.
    // However, if `consistentLiftCoords` were somehow invalid from a previous floor, this could be an issue.
    // For now, we'll assume `_findLiftPlacementLocation` or its direct fallback is robust enough.
    // The original error throw is better if we expect `coordsToUse` to always be valid from generation.
    throw new Error(
      `[MapGen Lift] Coords (${coordsToUse.tileX}, ${coordsToUse.tileY}) are outside map bounds on floor ${floorNumber}.`
    );
  }

  // Check if the chosen spot is a wall; if so, attempt connection
  // This is crucial if the fallback (center of map) was used.
  if (map[tileY][tileX] === TILE_WALL) {
    console.warn(
      `[MapGen Floor ${floorNumber}] Lift location tile(${tileX}, ${tileY}) is a wall (likely fallback). Forcing connection...`
    );
    const connected = _forceConnectionToPoint(map, tileX, tileY, cols, rows);
    if (!connected) {
      console.error(
        `[MapGen Lift Connect] FAILED to connect wall at lift location tile(${tileX}, ${tileY}). Lift might be isolated.`
      );
    } else {
      console.log(`  [MapGen Lift Connect] Connection attempt finished for wall at lift location.`);
      if (map[tileY][tileX] === TILE_WALL) {
        // Double check after connection
        console.warn(
          `  [MapGen Lift Connect] Force connection completed, but target tile (${tileX},${tileY}) remained WALL. Setting to CORRIDOR.`
        );
        map[tileY][tileX] = TILE_CORRIDOR;
      }
    }
  } else {
    console.log(
      `  [MapGen Lift] Lift location tile(${tileX}, ${tileY}) is already walkable (Type: ${map[tileY][tileX]}).`
    );
  }

  // Place the lift tile
  map[tileY][tileX] = TILE_LIFT;

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

  return { position: liftWorldPos, coords: newlyFoundCoords || coordsToUse };
}

// --- MODIFIED Helper: Find Lift Location (For First Floor) ---
function _findLiftPlacementLocation(map, cols, rows, roomsList) {
  // Added roomsList parameter
  const centerX = Math.floor(cols / 2);
  const centerY = Math.floor(rows / 2);

  let bestSpotCandidate = null;

  console.log(`  [MapGen FindLift V3] Searching for optimal lift spot INSIDE a room...`);

  if (!roomsList || roomsList.length === 0) {
    console.warn(
      `  [MapGen FindLift V3] No rooms available to place a lift in. Fallback will be used by caller.`
    );
    return null;
  }

  for (const room of roomsList) {
    // Iterate "internal" floor tiles of the room.
    // Internal tiles are at least 1 tile away from the room's bounding walls.
    // Requires room to be at least 3x3 in size to have any internal tiles.
    // (minRoomSize is 5, so a 5x5 room has a 3x3 internal area)
    const startInternalCol = room.col + 1;
    const endInternalCol = room.col + room.width - 2;
    const startInternalRow = room.row + 1;
    const endInternalRow = room.row + room.height - 2;

    if (startInternalCol > endInternalCol || startInternalRow > endInternalRow) {
      // Room is too small (e.g., 2xN or Nx2) to have "internal" tiles by this definition.
      // We could iterate all room.col to room.col + room.width -1 etc. if we want to include edges.
      // For now, sticking to "internal" for better placement.
      // console.log(`    [FindLift V3] Room ${room.id} (${room.width}x${room.height}) too small for internal tiles. Skipping.`);
      continue;
    }

    for (let r = startInternalRow; r <= endInternalRow; r++) {
      for (let c = startInternalCol; c <= endInternalCol; c++) {
        // By definition, map[r][c] should be TILE_ROOM_FLOOR here.

        let currentScore = 0;
        const distSq = (c - centerX) * (c - centerX) + (r - centerY) * (r - centerY);
        currentScore -= distSq / 30; // Proximity bonus

        const detailsSelf = _getTileOpennessDetails(c, r, map, cols, rows);

        if (detailsSelf.openSides < 1) {
          // Should have at least 1 connection if it's a valid internal room tile.
          continue;
        }

        if (detailsSelf.isChokepoint) {
          currentScore -= 700; // Penalize if lift tile itself would form a chokepoint
        }
        currentScore += detailsSelf.openSides * 120; // More open sides for the lift tile are good.

        let worstAccessPenaltyFromNeighbors = 0;
        let numActualAccessPoints = 0;
        const neighborDeltas = [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
        ];

        for (const delta of neighborDeltas) {
          const ncAccess = c + delta.dx;
          const nrAccess = r + delta.dy;

          if (nrAccess >= 0 && nrAccess < rows && ncAccess >= 0 && ncAccess < cols) {
            const accessTileType = map[nrAccess]?.[ncAccess];
            if (accessTileType === TILE_CORRIDOR || accessTileType === TILE_ROOM_FLOOR) {
              numActualAccessPoints++;
              const detailsAccessTile = _getTileOpennessDetails(
                ncAccess,
                nrAccess,
                map,
                cols,
                rows
              );

              if (detailsAccessTile.openSides === 1) {
                // Access tile only leads to our candidate (it's a stub)
                worstAccessPenaltyFromNeighbors = Math.max(worstAccessPenaltyFromNeighbors, 30000); // Massive penalty
              }

              if (detailsAccessTile.isChokepoint) {
                worstAccessPenaltyFromNeighbors = Math.max(worstAccessPenaltyFromNeighbors, 500);
              }
            }
          }
        }

        // If the lift candidate is in the middle of a room, numActualAccessPoints might be low
        // if it's surrounded by other TILE_ROOM_FLOOR of the *same* room.
        // detailsSelf.openSides is a better measure of its "embeddness" in this case.
        // The critical part is that `worstAccessPenaltyFromNeighbors` catches bad *external* access.
        if (numActualAccessPoints === 0 && detailsSelf.openSides < 2) {
          // If it has no direct corridor/other room access AND is also very closed off itself
          continue;
        }

        currentScore -= worstAccessPenaltyFromNeighbors;

        if (bestSpotCandidate === null || currentScore > bestSpotCandidate.score) {
          bestSpotCandidate = {
            tileX: c,
            tileY: r,
            score: currentScore,
            debug_room: room.id,
            // Add other debug fields from previous version if needed
          };
        }
      }
    }
  }

  if (bestSpotCandidate) {
    console.log(
      `  [MapGen FindLift V3] Selected best spot IN ROOM (${bestSpotCandidate.debug_room}) at tile(${bestSpotCandidate.tileX}, ${bestSpotCandidate.tileY}). ` +
        `Score: ${bestSpotCandidate.score.toFixed(0)}.`
    );
    return { tileX: bestSpotCandidate.tileX, tileY: bestSpotCandidate.tileY };
  }

  console.warn(
    '[MapGen FindLift V3] No suitable IN-ROOM location found with internal tiles. Fallback will be used by caller.'
  );
  return null;
}

// --- Helper: Force Connection ---
function _forceConnectionToPoint(map, targetX, targetY, cols, rows) {
  console.log(
    `  [MapGen Connect] Trying to connect wall at tile(${targetX}, ${targetY}) to walkable area...`
  );
  const directions = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  let isAdjacentToWalkable = false;
  let adjacentWalkableCoord = null;

  // 1. Check if already adjacent to a walkable tile
  for (const [dx, dy] of directions) {
    const nx = targetX + dx;
    const ny = targetY + dy;
    const neighborTile = map[ny]?.[nx];
    if (
      neighborTile === TILE_CORRIDOR ||
      neighborTile === TILE_ROOM_FLOOR ||
      neighborTile === TILE_LIFT
    ) {
      isAdjacentToWalkable = true;
      adjacentWalkableCoord = { x: nx, y: ny };
      break;
    }
  }

  if (isAdjacentToWalkable) {
    console.log(
      `  [MapGen Connect] Target(${targetX}, ${targetY}) is adjacent to walkable at (${adjacentWalkableCoord.x}, ${adjacentWalkableCoord.y}). Setting target to Corridor.`
    );
    // Make the target tile itself walkable (Corridor is a safe bet)
    map[targetY][targetX] = TILE_CORRIDOR;
    return true; // Connection is trivial
  }

  // 2. If not adjacent, find the nearest walkable tile (Corridor or Floor) using BFS
  console.log(
    `  [MapGen Connect] Target not adjacent. Searching nearest walkable (Corridor/Floor) via BFS...`
  );
  const queue = [[targetX, targetY, 0]]; // x, y, distance
  const visited = new Set([`${targetX},${targetY}`]);
  const bfsPathable = [TILE_WALL, TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT]; // Can path through anything
  const targetWalkable = [TILE_CORRIDOR, TILE_ROOM_FLOOR];
  let closestWalkable = null;
  let minFoundDist = Infinity;

  while (queue.length > 0) {
    const [currX, currY, dist] = queue.shift();

    // If we already found *a* walkable tile, don't explore paths longer than that
    if (dist >= minFoundDist) continue;

    for (const [dx, dy] of directions) {
      const nextX = currX + dx;
      const nextY = currY + dy;
      const key = `${nextX},${nextY}`;

      if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && !visited.has(key)) {
        const tileValue = map[nextY]?.[nextX];
        visited.add(key);

        // Found a target walkable tile?
        if (targetWalkable.includes(tileValue)) {
          if (dist + 1 < minFoundDist) {
            // Found a closer one
            minFoundDist = dist + 1;
            closestWalkable = { x: nextX, y: nextY, dist: minFoundDist };
            console.log(
              `    [BFS] Found potential target at (${nextX}, ${nextY}), dist ${minFoundDist}`
            );
          }
          // Don't push this target onto queue, we stop searching from here
        } else if (bfsPathable.includes(tileValue)) {
          // Can continue searching from this neighbor if it's pathable and closer than current best
          if (dist + 1 < minFoundDist) {
            queue.push([nextX, nextY, dist + 1]);
          }
        }
      }
    }
  }

  // 3. Carve path if a walkable tile was found
  if (closestWalkable) {
    console.log(
      `  [MapGen Connect] Found closest walkable at tile(${closestWalkable.x}, ${closestWalkable.y}) distance ${closestWalkable.dist}. Carving path...`
    );
    // Simple L-shaped carving from target to closest walkable
    _carveHorizontalCorridor(map, targetY, targetX, closestWalkable.x, cols, rows);
    _carveVerticalCorridor(map, closestWalkable.x, targetY, closestWalkable.y, cols, rows);
    console.log(`  [MapGen Connect] Carved path attempt finished.`);

    // Verify the target tile itself became walkable (should be corridor now)
    if (map[targetY][targetX] === TILE_CORRIDOR || map[targetY][targetX] === TILE_ROOM_FLOOR) {
      console.log(
        `    [Verify] Target tile (${targetX},${targetY}) is now walkable (Type: ${map[targetY][targetX]})`
      );
      return true;
    } else {
      console.warn(
        `  [MapGen Connect] Carving done, but target tile(${targetX}, ${targetY}) is still WALL (Value: ${map[targetY][targetX]}). Setting manually.`
      );
      // Force it just in case carving logic had an edge case
      map[targetY][targetX] = TILE_CORRIDOR;
      return true; // Assume success if we found a path and forced the tile
    }
  } else {
    console.error(
      `  [MapGen Connect] FAILED to find ANY nearby walkable (Corridor/Floor) via BFS from wall at tile(${targetX}, ${targetY}). Cannot connect.`
    );
    return false; // Connection failed
  }
}

// --- Helper: Check Lift Reachability ---
function _isLiftReachable(map, liftPosition, cols, rows) {
  if (!liftPosition) return false;
  const { tileX, tileY } = liftPosition;
  if (
    tileY < 0 ||
    tileY >= rows ||
    tileX < 0 ||
    tileX >= cols ||
    map[tileY]?.[tileX] !== TILE_LIFT
  ) {
    console.error(
      `[MapValidation Reachability] Invalid lift position provided: (${tileX}, ${tileY})`
    );
    return false;
  }

  // Use BFS utility function to check reachability from the lift tile
  // We need to know if the lift can reach *any* TILE_CORRIDOR or TILE_ROOM_FLOOR
  const walkableForLiftSearch = [TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT]; // BFS can traverse these
  const targetTiles = [TILE_CORRIDOR, TILE_ROOM_FLOOR]; // Success if BFS finds one of these

  const { reachable } = performBFS(
    map,
    tileX,
    tileY,
    cols,
    rows,
    walkableForLiftSearch,
    targetTiles
  );

  if (!reachable) {
    console.error(
      `[MapValidation Reachability] FAILED. Lift at tile(${tileX}, ${tileY}) is isolated from corridors/rooms.`
    );
  }
  return reachable;
}

// --- Helper: Ensure Borders ---
function _ensureMapBorders(map, cols, rows) {
  console.log('  [MapGen] Ensuring map borders are walls.');
  // Top and Bottom borders
  for (let c = 0; c < cols; c++) {
    if (map[0]?.[c] !== undefined) map[0][c] = TILE_WALL;
    if (map[rows - 1]?.[c] !== undefined) map[rows - 1][c] = TILE_WALL;
  }
  // Left and Right borders
  for (let r = 0; r < rows; r++) {
    if (map[r]?.[0] !== undefined) map[r][0] = TILE_WALL;
    if (map[r]?.[cols - 1] !== undefined) map[r][cols - 1] = TILE_WALL;
  }
}

// --- Debug Helper ---
// (Optional, uncomment the call in generateLevelData to use when debugging reachability)
function logMapGridForDebug(map, cols, rows) {
  console.log('--- DEBUG MAP GRID ---');
  for (let y = 0; y < rows; y++) {
    const rowString = map[y]
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
    console.log(rowString);
  }
  console.log('--- END DEBUG MAP GRID ---');
}
