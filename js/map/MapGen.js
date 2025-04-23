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
export function generateLevelData(config) {
  const { cols, rows, floorNumber, minFloor, tileSize, generationParams: userParams } = config; // Added tileSize
  const genParams = { ...DEFAULT_GEN_PARAMS, ...userParams };

  // Adjust gym chance for the first floor
  genParams.roomTypeWeights.gym = floorNumber === minFloor ? GYM_CHANCE_ON_FIRST_FLOOR * 100 : 0;

  // Reset consistent lift coords on the first floor
  if (floorNumber === minFloor) {
    consistentLiftCoords = null;
    console.log(`[MapGen Floor ${floorNumber}] Reset consistent lift coords for the first floor.`);
  }

  console.log(`[MapGen Floor ${floorNumber}] Starting map generation (${cols}x${rows})...`);
  const map = Array.from({ length: rows }, () => Array(cols).fill(TILE_WALL));
  const rooms = [];
  let liftPosition = null;

  // --- Generation Steps ---
  _placeRooms(map, rooms, cols, rows, genParams);

  if (rooms.length < 2 && floorNumber !== minFloor) {
    // Allow single room on first floor maybe? Or handle differently
    console.warn(
      `[MapGen Floor ${floorNumber}] Placed only ${rooms.length} rooms. Expect limited connectivity.`
    );
    // Consider adding a fallback: maybe connect the single room to the map edge or a random point?
  } else if (rooms.length >= 2) {
    _connectRoomsBetter(map, rooms, cols, rows);
  }

  try {
    // Pass consistentLiftCoords reference, potentially update it inside
    const placedLiftData = _placeLift(
      map,
      cols,
      rows,
      floorNumber,
      minFloor,
      tileSize,
      consistentLiftCoords
    ); // Pass tileSize
    liftPosition = placedLiftData.position;
    // Update the module-level variable if it was newly set
    if (placedLiftData.coords) {
      consistentLiftCoords = placedLiftData.coords;
    }
  } catch (error) {
    console.error(`[MapGen Floor ${floorNumber}] CRITICAL: Lift placement failed:`, error);
    throw new Error(`Lift placement failed on floor ${floorNumber}: ${error.message}`);
  }

  // Ensure borders are walls AFTER placing lift and connections
  _ensureMapBorders(map, cols, rows);

  // Final lift reachability check *after* potential forced connections
  if (liftPosition && !_isLiftReachable(map, liftPosition, cols, rows)) {
    // Attempt to force connection one last time if unreachable
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
      // Optional: Log map grid here for debugging the unreachable state
      // logMapGridForDebug(map, cols, rows);
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
    // This case should have been caught earlier, but double-check
    throw new Error(`Map generated without a valid lift position on floor ${floorNumber}.`);
  }

  console.log(`[MapGen Floor ${floorNumber}] Map generation completed successfully.`);
  return { map, rooms, liftPosition }; // Return the generated data
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

// --- Helper: Place Lift ---
// Takes current `liftCoords` and returns the used/found coords and position
function _placeLift(map, cols, rows, floorNumber, minFloor, tileSize, currentConsistentCoords) {
  let coordsToUse = currentConsistentCoords;
  let newlyFoundCoords = null;

  // Find coords only on the first floor if not already set
  if (floorNumber === minFloor && !coordsToUse) {
    console.log(`[MapGen Floor ${floorNumber}] Finding initial lift placement location...`);
    coordsToUse = _findLiftPlacementLocation(map, cols, rows);
    if (!coordsToUse) {
      // CRITICAL FALLBACK: If no suitable spot found, try placing near map center (even wall) and force connect
      console.warn(
        `[MapGen Floor ${floorNumber}] No ideal lift location found. Forcing placement near center.`
      );
      coordsToUse = { tileX: Math.floor(cols / 2), tileY: Math.floor(rows / 2) };
    }
    console.log(
      `[MapGen Floor ${floorNumber}] Established consistent lift coords at tile(${coordsToUse.tileX}, ${coordsToUse.tileY})`
    );
    newlyFoundCoords = coordsToUse; // Mark that we found new coords
  } else if (!coordsToUse && floorNumber > minFloor) {
    // This should ideally not happen if generation proceeds floor by floor
    throw new Error(`[MapGen Lift] Missing consistent coordinates for floor ${floorNumber}.`);
  }

  const { tileX, tileY } = coordsToUse;

  // Basic bounds check for safety
  if (tileY < 0 || tileY >= rows || tileX < 0 || tileX >= cols) {
    throw new Error(
      `[MapGen Lift] Coords (${tileX}, ${tileY}) are outside map bounds on floor ${floorNumber}.`
    );
  }

  // Check if the chosen spot is a wall; if so, attempt connection
  if (map[tileY][tileX] === TILE_WALL) {
    console.warn(
      `[MapGen Floor ${floorNumber}] Lift location tile(${tileX}, ${tileY}) is a wall. Forcing connection...`
    );
    const connected = _forceConnectionToPoint(map, tileX, tileY, cols, rows);
    if (!connected) {
      console.error(
        `[MapGen Lift Connect] FAILED to connect wall at lift location tile(${tileX}, ${tileY}). Lift might be isolated.`
      );
      // We still place the lift, but the reachability check later should fail.
    } else {
      console.log(`  [MapGen Lift Connect] Connection attempt finished for wall at lift location.`);
      // Ensure the tile itself is marked as corridor *before* setting to LIFT
      if (map[tileY][tileX] === TILE_WALL) {
        console.warn(
          `  [MapGen Lift Connect] Force connection completed, but target tile (${tileX},${tileY}) remained WALL. Setting to CORRIDOR.`
        );
        map[tileY][tileX] = TILE_CORRIDOR; // Manually ensure it's walkable before becoming lift
      }
    }
  } else {
    console.log(
      `  [MapGen Lift] Lift location tile(${tileX}, ${tileY}) is already walkable (Type: ${map[tileY][tileX]}).`
    );
  }

  // Place the lift tile
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

  return { position: liftWorldPos, coords: newlyFoundCoords || coordsToUse }; // Return position and the definitive coords used/found
}

// --- Helper: Find Lift Location (For First Floor) ---
function _findLiftPlacementLocation(map, cols, rows) {
  const centerX = Math.floor(cols / 2),
    centerY = Math.floor(rows / 2);
  let bestSpot = null;
  let minDistanceSq = Infinity;
  const maxSearchRadius = Math.max(centerX, centerY); // Search outwards from center

  console.log(`  [MapGen FindLift] Searching for lift spot, max radius ${maxSearchRadius}...`);

  for (let radius = 0; radius <= maxSearchRadius; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        // Only check the boundary of the current radius ring
        if (radius > 0 && Math.abs(dx) < radius && Math.abs(dy) < radius) continue;

        const checkX = centerX + dx;
        const checkY = centerY + dy;

        // Check if inside map bounds (excluding outer border)
        if (checkY >= 1 && checkY < rows - 1 && checkX >= 1 && checkX < cols - 1) {
          const tile = map[checkY][checkX];

          // Prefer placing on existing Corridor or Room Floor tiles
          if (tile === TILE_CORRIDOR || tile === TILE_ROOM_FLOOR) {
            // Check for at least one walkable (non-wall) neighbor to ensure it's not isolated
            let isConnected = false;
            const directions = [
              [0, -1],
              [0, 1],
              [-1, 0],
              [1, 0],
            ];
            for (const [ddx, ddy] of directions) {
              const nx = checkX + ddx;
              const ny = checkY + ddy;
              // Check neighbor bounds and type (Corridor, Floor, or *existing* Lift if somehow present)
              const neighborTile = map[ny]?.[nx];
              if (
                neighborTile === TILE_CORRIDOR ||
                neighborTile === TILE_ROOM_FLOOR ||
                neighborTile === TILE_LIFT
              ) {
                isConnected = true;
                break;
              }
            }

            if (isConnected) {
              const distSq = dx * dx + dy * dy; // Distance from center
              // Found a suitable spot, check if it's closer than previous best
              if (distSq < minDistanceSq) {
                minDistanceSq = distSq;
                bestSpot = { tileX: checkX, tileY: checkY };
              }
            }
          }
        }
      } // end dx loop
    } // end dy loop

    // If we found a best spot in this radius ring, use it and stop searching
    if (bestSpot) {
      console.log(
        `  [MapGen FindLift] Selected best spot at tile(${bestSpot.tileX}, ${bestSpot.tileY}) radius ${radius}.`
      );
      return bestSpot;
    }
  } // end radius loop

  console.warn('[MapGen FindLift] No suitable CORRIDOR or ROOM_FLOOR location found near center.');
  // If no ideal spot, return null (the caller might force placement)
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
