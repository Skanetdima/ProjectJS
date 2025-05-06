// src/map/mapRenderer.js

import { TILE_WALL, TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT } from '../utils/constants.js';
// Removed unused randomGray, randomCorridorGray imports
import { adjustColorBrightness, simpleHash } from '../utils/map.js';

export class MapRenderer {
  constructor(tileSize) {
    this.tileSize = tileSize;
    // Cache is less critical now for base tiles but still useful for room floors/other elements
    this.tileColors = {};
    this.baseWallColor = '#1c1e22'; // Single, consistent wall color
    this.baseCorridorColor = '#a0a0a0'; // Single, consistent corridor color
    this.baseRoomFloorColor = '#c0c0c0'; // Default room floor (overwritten by drawRoomDetails)
    this.liftColor = '#707080'; // Consistent lift color
    this.errorColor = '#ff00ff'; // Error color
  }

  // Reset color cache when a new map is drawn (called by ProceduralMap)
  resetColorCache() {
    this.tileColors = {};
  }

  /** Get or generate the color for a specific tile */
  getTileColor(r, c, tileValue, rooms) {
    // NOTE: We still use the cache key, mainly useful if rooms need specific
    // tile colors not handled by drawRoomDetails later, or if we add more complex logic.
    // For the base tiles modified below, it's less essential.
    const key = `${r},${c}`;
    if (this.tileColors[key]) {
      return this.tileColors[key];
    }

    let color;

    // --- REMOVED per-tile hash/variation for base types ---
    // const hash = simpleHash(r * 1000 + c);
    // const variation = ((hash % 21) - 10) / 100;

    switch (tileValue) {
      case TILE_WALL:
        // Use the single, consistent base color directly
        color = this.baseWallColor;
        break;
      case TILE_CORRIDOR:
        // Use the single, consistent base color directly
        color = this.baseCorridorColor;
        break;
      case TILE_ROOM_FLOOR:
        // Use the consistent base room floor color.
        // This will be overwritten by drawRoomDetails for actual room tiles.
        // It serves as the color if a TILE_ROOM_FLOOR somehow exists outside a defined room.
        color = this.baseRoomFloorColor;
        break;
      case TILE_LIFT:
        // Use the consistent lift color
        color = this.liftColor;
        break;
      default:
        color = this.errorColor; // Error color
        break;
    }

    // Still cache the result
    this.tileColors[key] = color;
    return color;
  }

  /** Main drawing function */
  draw(ctx, mapData, bookImage = null) {
    const { map, rooms, books, liftPosition, offsetX, offsetY, cols, rows } = mapData;

    // Round offsets for sharpness
    const currentOffsetX = Math.floor(offsetX);
    const currentOffsetY = Math.floor(offsetY);

    // Determine visible tiles with a small buffer
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

    // 1. Draw base tiles (walls, corridors, default floor, lift base)
    //    These will now use the consistent colors from getTileColor.
    this.drawBaseTiles(
      ctx,
      map,
      rooms,
      currentOffsetX,
      currentOffsetY,
      cols,
      rows,
      startRow,
      endRow,
      startCol,
      endCol
    );

    // 2. Draw specific room floors and decorations
    //    This function WILL apply specific colors based on room type,
    //    and subtle per-tile variations WITHIN the room floor.
    this.drawRoomDetails(
      ctx,
      map,
      rooms,
      liftPosition,
      currentOffsetX,
      currentOffsetY,
      cols,
      rows,
      startRow,
      endRow,
      startCol,
      endCol
    );

    // 3. Draw lift details (overlaying room floors if needed)
    this.drawLiftDetails(ctx, liftPosition, currentOffsetX, currentOffsetY);

    // 4. Draw books
    this.drawBooks(ctx, books, currentOffsetX, currentOffsetY, bookImage);

    ctx.restore(); // Restore context state
  }

  /** Draw base tiles */
  drawBaseTiles(ctx, map, rooms, offsetX, offsetY, cols, rows, startRow, endRow, startCol, endCol) {
    ctx.save();
    ctx.shadowColor = 'transparent';

    const wallEdgeColorDark = '#383838';
    const wallEdgeColorLight = '#606060';
    const wallTopEdgeColor = '#757575';

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tileValue = map[r]?.[c];
        if (tileValue === undefined) continue;

        const screenX = Math.floor(c * this.tileSize + offsetX);
        const screenY = Math.floor(r * this.tileSize + offsetY);
        // Get the color - now consistent for walls/corridors/default floor/lift
        const color = this.getTileColor(r, c, tileValue, rooms);

        ctx.fillStyle = color;
        ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);

        // --- Wall Edges and Noise (Still Applied for Detail) ---
        if (tileValue === TILE_WALL) {
          // Noise texture (applied ON TOP of the consistent base color)
          ctx.fillStyle = 'rgba(0,0,0,0.06)';
          for (let i = 0; i < 5; i++) {
            ctx.fillRect(
              screenX + Math.random() * this.tileSize,
              screenY + Math.random() * this.tileSize,
              1,
              1
            );
          }

          // Edge rendering (applied ON TOP)
          const edgeSize = 2;
          if (r > 0 && map[r - 1]?.[c] !== TILE_WALL) {
            ctx.fillStyle = wallTopEdgeColor;
            ctx.fillRect(screenX, screenY, this.tileSize, edgeSize);
          }
          if (r < rows - 1 && map[r + 1]?.[c] !== TILE_WALL) {
            ctx.fillStyle = wallEdgeColorDark;
            ctx.fillRect(screenX, screenY + this.tileSize - edgeSize, this.tileSize, edgeSize);
          }
          if (c > 0 && map[r]?.[c - 1] !== TILE_WALL) {
            ctx.fillStyle = wallEdgeColorLight;
            ctx.fillRect(screenX, screenY + edgeSize, edgeSize, this.tileSize - edgeSize);
          }
          if (c < cols - 1 && map[r]?.[c + 1] !== TILE_WALL) {
            ctx.fillStyle = wallEdgeColorDark;
            ctx.fillRect(
              screenX + this.tileSize - edgeSize,
              screenY + edgeSize,
              edgeSize,
              this.tileSize - edgeSize
            );
          }
          // Corner logic (remains the same)
          if (
            r > 0 &&
            c > 0 &&
            map[r - 1]?.[c] !== TILE_WALL &&
            map[r]?.[c - 1] !== TILE_WALL &&
            map[r - 1]?.[c - 1] !== TILE_WALL
          ) {
            ctx.fillStyle = wallEdgeColorLight;
            ctx.fillRect(screenX, screenY, edgeSize, edgeSize);
          }
          if (
            r > 0 &&
            c < cols - 1 &&
            map[r - 1]?.[c] !== TILE_WALL &&
            map[r]?.[c + 1] !== TILE_WALL &&
            map[r - 1]?.[c + 1] !== TILE_WALL
          ) {
            ctx.fillStyle = wallTopEdgeColor;
            ctx.fillRect(screenX + this.tileSize - edgeSize, screenY, edgeSize, edgeSize);
          }
          // ... potentially other corners
        } else if (tileValue === TILE_CORRIDOR) {
          // Corridor Noise (applied ON TOP of the consistent base color)
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(
              screenX + Math.random() * this.tileSize,
              screenY + Math.random() * this.tileSize,
              1,
              1
            );
          }
        }
        // NOTE: No special drawing needed here for TILE_ROOM_FLOOR or TILE_LIFT
        // as drawRoomDetails and drawLiftDetails handle their specifics.
      }
    }
    ctx.restore();
  }

  /** Draw specific room floors and decorations */
  drawRoomDetails(
    ctx,
    map,
    rooms,
    liftPosition,
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
    ctx.shadowColor = 'transparent';

    for (const room of rooms) {
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

      // --- Determine Floor Color Based on Room Type (This logic remains) ---
      let floorColor = this.baseRoomFloorColor; // Start with default
      // Use a seed that changes per room but is consistent for that room
      // Added floorNumber dependency if available in `this`, otherwise use room.id
      const floorNum = typeof this.floorNumber === 'number' ? this.floorNumber : 0;
      let roomSeed = simpleHash(room.id) + floorNum * 100; // Use hash of ID for more variation

      switch (room.type) {
        case 'classroom':
          floorColor = adjustColorBrightness('#a0c8e0', 0.9 + (simpleHash(roomSeed) % 11) / 100);
          break; // Bluish
        case 'office':
          floorColor = adjustColorBrightness(
            '#f0e8c0',
            0.9 + (simpleHash(roomSeed + 1) % 11) / 100
          );
          break; // Beige
        case 'library':
          floorColor = adjustColorBrightness(
            '#d8c0a8',
            0.9 + (simpleHash(roomSeed + 2) % 11) / 100
          );
          break; // Wooden
        case 'gym':
          floorColor = adjustColorBrightness(
            '#b0d0b0',
            0.9 + (simpleHash(roomSeed + 3) % 11) / 100
          );
          break; // Greenish
        case 'lab':
          floorColor = adjustColorBrightness(
            '#e0e0ff',
            0.9 + (simpleHash(roomSeed + 4) % 11) / 100
          );
          break; // Light blue-purple
        case 'storage':
          floorColor = adjustColorBrightness(
            '#b0a090',
            0.9 + (simpleHash(roomSeed + 5) % 11) / 100
          );
          break; // Gray-brown
        case 'utility':
          floorColor = adjustColorBrightness(
            '#b0b0b0',
            0.9 + (simpleHash(roomSeed + 6) % 11) / 100
          );
          break; // Gray concrete
      }

      // --- Draw Room Floor (Tile by Tile within Visible Area) ---
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
          // Only draw if it's actually a TILE_ROOM_FLOOR
          if (tileValue === TILE_ROOM_FLOOR) {
            const screenX = Math.floor(c * this.tileSize + offsetX);
            const screenY = Math.floor(r * this.tileSize + offsetY);

            // --- Subtle Per-Tile Variation WITHIN Room Floor (Kept for texture) ---
            const tileHash = simpleHash(r * 5000 + c * 3 + roomSeed); // Include roomSeed
            const variation = ((tileHash % 11) - 5) / 100; // Variation -0.05 to +0.05
            const brightnessFactor = 0.98 + variation;
            ctx.fillStyle = adjustColorBrightness(floorColor, brightnessFactor);
            // --- End Per-Tile Variation ---

            ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);

            // Optional floor texture (remains the same)
            if (room.type === 'lab') {
              ctx.strokeStyle = 'rgba(0,0,0,0.08)';
              ctx.lineWidth = 1;
              ctx.strokeRect(screenX + 0.5, screenY + 0.5, this.tileSize - 1, this.tileSize - 1);
            }
          }
        }
      }

      // --- Draw Decorations (remains the same) ---
      this.drawRoomDecorations(ctx, room, roomScreenX, roomScreenY, roomScreenW, roomScreenH);
    }
    ctx.restore();
  }

  // --- drawLiftDetails, drawRoomDecorations, drawBooks remain unchanged ---
  // ... (keep the existing code for these methods) ...
  /** Narysuj detale windy (przycisk, kontur) */
  drawLiftDetails(ctx, liftPosition, offsetX, offsetY) {
    if (!liftPosition) return;

    const screenX = Math.floor(liftPosition.tileX * this.tileSize + offsetX);
    const screenY = Math.floor(liftPosition.tileY * this.tileSize + offsetY);

    // Sprawdź, czy winda jest widoczna przed rysowaniem detali
    if (
      screenX + this.tileSize < 0 ||
      screenX > ctx.canvas.width ||
      screenY + this.tileSize < 0 ||
      screenY > ctx.canvas.height
    ) {
      return;
    }

    ctx.save();
    ctx.shadowColor = 'transparent'; // Brak cienia dla detali windy

    // Wyraźniejsza ramka windy
    ctx.strokeStyle = '#d0d0d0'; // Jasna ramka
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX + 0.5, screenY + 0.5, this.tileSize - 1, this.tileSize - 1);
    ctx.strokeStyle = '#404040'; // Ciemny wewnętrzny cień
    ctx.strokeRect(screenX + 1.5, screenY + 1.5, this.tileSize - 3, this.tileSize - 3);

    // Ulepszony przycisk
    const buttonRadius = this.tileSize * 0.15; // Trochę większy
    const buttonX = screenX + this.tileSize * 0.8;
    const buttonY = screenY + this.tileSize * 0.5;

    // Podstawa przycisku (ciemniejsza)
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(buttonX, buttonY, buttonRadius, 0, Math.PI * 2);
    ctx.fill();

    // Sam przycisk (czerwony)
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(buttonX, buttonY, buttonRadius * 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Odblask na przycisku
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

  /** Narysuj dekoracje dla konkretnego pokoju */
  drawRoomDecorations(ctx, room, x, y, w, h) {
    // x, y to lewy górny róg pokoju na ekranie
    // w, h to szerokość i wysokość pokoju na ekranie
    const ts = this.tileSize;
    const margin = ts * 0.2; // Mniejszy margines
    const objMargin = ts * 0.1; // Odstęp między obiektami
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#444'; // Ciemniejsza domyślna obwódka

    // === FUNKCJE POMOCNICZE DO RYSOWANIA ===
    const drawRect = (rx, ry, rw, rh, color, outline = true) => {
      ctx.fillStyle = color;
      const screenX = Math.floor(x + rx);
      const screenY = Math.floor(y + ry);
      const screenW = Math.floor(rw);
      const screenH = Math.floor(rh);
      ctx.fillRect(screenX, screenY, screenW, screenH);
      if (outline) {
        ctx.strokeRect(screenX + 0.5, screenY + 0.5, screenW - 1, screenH - 1);
      }
    };
    const drawCircle = (cx, cy, radius, color, outline = true) => {
      ctx.fillStyle = color;
      const screenX = Math.floor(x + cx);
      const screenY = Math.floor(y + cy);
      ctx.beginPath();
      ctx.arc(screenX, screenY, Math.floor(radius), 0, Math.PI * 2);
      ctx.fill();
      if (outline) {
        ctx.stroke();
      }
    };
    // =======================================

    switch (room.type) {
      case 'classroom': // Sala lekcyjna
        ctx.strokeStyle = '#5d4037'; // Brązowa obwódka dla mebli
        const deskW = ts * 0.6,
          deskH = ts * 0.4,
          chairH = ts * 0.25;
        const spaceX = ts * 1.0,
          spaceY = ts * 0.9;
        // Tablica na górnej ścianie
        drawRect(w * 0.25, margin, w * 0.5, ts * 0.2, '#333', true);
        drawRect(w * 0.25 + 2, margin + 2, w * 0.5 - 4, ts * 0.2 - 4, '#4CAF50', false); // Zielona powierzchnia

        // Ławki i krzesła w rzędach
        for (let r = 0; ; r++) {
          const rowY = margin + ts * 0.5 + r * spaceY;
          if (rowY + deskH + chairH > h - margin) break; // Sprawdzenie czy zmieści się rząd
          for (let c = 0; ; c++) {
            const colX = margin + c * spaceX;
            if (colX + deskW > w - margin) break; // Sprawdzenie czy zmieści się kolumna
            // Ławka
            drawRect(colX, rowY, deskW, deskH, '#8B4513');
            // Krzesło poniżej
            drawRect(colX + deskW * 0.1, rowY + deskH + objMargin, deskW * 0.8, chairH, '#6a4a3a');
          }
        }
        break;

      case 'office': // Biuro
        ctx.strokeStyle = '#5d4037';
        // Biurko
        const tableW = Math.min(w * 0.6, ts * 2.5);
        const tableH = Math.min(h * 0.4, ts * 1.2);
        drawRect(margin, margin, tableW, tableH, '#a0522d');
        // Krzesło biurowe
        drawRect(margin + tableW + objMargin, margin + tableH * 0.1, ts * 0.6, ts * 0.6, '#444');
        // Szafa na akta
        const cabinetW = ts * 0.8;
        drawRect(w - margin - cabinetW, margin, cabinetW, h - margin * 2, '#6B4F41');
        // Komputer na biurku (symbolicznie)
        drawRect(margin + objMargin, margin + objMargin, ts * 0.5, ts * 0.4, '#333'); // Monitor
        drawRect(
          margin + objMargin + ts * 0.1,
          margin + objMargin + ts * 0.4 + 2,
          ts * 0.3,
          ts * 0.1,
          '#555'
        ); // Klawiatura
        break;

      case 'library': // Biblioteka
        ctx.strokeStyle = '#402a10'; // Ciemniejsza obwódka dla regałów
        const shelfW = ts * 0.6;
        const shelfSpacing = ts * 1.5;
        // Regały w pionie
        for (let sx = margin; sx < w - margin - shelfW; sx += shelfSpacing) {
          drawRect(sx, margin, shelfW, h - margin * 2, '#654321');
          // Linie półek
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          for (let shelfY = margin + ts * 0.5; shelfY < h - margin; shelfY += ts * 0.7) {
            ctx.beginPath();
            ctx.moveTo(x + sx, y + shelfY);
            ctx.lineTo(x + sx + shelfW, y + shelfY);
            ctx.stroke();
          }
          ctx.strokeStyle = '#402a10'; // Przywróć główny kolor obwódki
        }
        // Stół do czytania (jeśli jest miejsce)
        if (w > shelfSpacing * 1.5) {
          const tableLibX = shelfW + margin + (w - shelfW * 2 - margin * 2 - ts * 1.5) / 2; // Wyśrodkuj stół między regałami
          if (tableLibX > shelfW + margin) {
            // Upewnij się, że jest miejsce
            drawRect(tableLibX, h * 0.3, ts * 1.5, h * 0.4, '#966F33');
            // Krzesła przy stole
            drawRect(tableLibX + ts * 0.2, h * 0.3 - ts * 0.3, ts * 0.5, ts * 0.25, '#6a4a3a');
            drawRect(
              tableLibX + ts * 0.2,
              h * 0.3 + h * 0.4 + objMargin,
              ts * 0.5,
              ts * 0.25,
              '#6a4a3a'
            );
          }
        }
        break;

      case 'gym': // Siłownia
        ctx.strokeStyle = '#555';
        // Maty do ćwiczeń
        drawRect(margin, margin, w * 0.4, h * 0.3, '#778899');
        drawRect(w - margin - w * 0.3, h - margin - h * 0.4, w * 0.3, h * 0.4, '#778899');
        // Bieżnia (symbolicznie)
        drawRect(w * 0.6, margin, ts * 0.8, ts * 1.8, '#333');
        drawRect(w * 0.6 + ts * 0.1, margin + ts * 0.1, ts * 0.6, ts * 1.6, '#555', false);
        // Ławeczka
        drawRect(margin, h * 0.5, ts * 1.5, ts * 0.4, '#8B4513');
        // Stojak z ciężarkami
        drawRect(w - margin - ts * 0.5, margin, ts * 0.5, ts * 1.5, '#444');
        drawCircle(w - margin - ts * 0.25, margin + ts * 0.3, ts * 0.15, '#666');
        drawCircle(w - margin - ts * 0.25, margin + ts * 0.7, ts * 0.15, '#666');
        drawCircle(w - margin - ts * 0.25, margin + ts * 1.1, ts * 0.15, '#666');
        break;

      case 'lab': // Laboratorium
        ctx.strokeStyle = '#668';
        // Stoły laboratoryjne (długie)
        const labTableH = ts * 0.8;
        drawRect(margin, margin, w - margin * 2, labTableH, '#d0d0d8'); // Jasnoszary stół
        drawRect(margin, h - margin - labTableH, w - margin * 2, labTableH, '#d0d0d8');
        // Sprzęt na stołach
        drawRect(margin + ts * 0.2, margin + ts * 0.1, ts * 0.5, ts * 0.5, '#4a90e2'); // Coś niebieskiego
        drawRect(margin + ts * 1.0, margin + ts * 0.1, ts * 0.3, ts * 0.6, '#f5a623'); // Coś pomarańczowego
        drawCircle(w - margin * 2 - ts * 0.4, margin + labTableH * 0.5, ts * 0.2, '#e04040', true); // Coś czerwonego okrągłego
        // Szafka z odczynnikami
        drawRect(
          w * 0.4,
          margin + labTableH + objMargin,
          ts,
          h - margin * 2 - labTableH * 2 - objMargin * 2,
          '#a0a0b0'
        );
        break;

      case 'storage': // Magazyn
        ctx.strokeStyle = '#4d4030';
        // Półki/regały metalowe
        const metalShelfW = w - margin * 2;
        const metalShelfH = ts * 0.5;
        drawRect(margin, margin, metalShelfW, metalShelfH, '#9e9e9e');
        drawRect(margin, h - margin - metalShelfH, metalShelfW, metalShelfH, '#9e9e9e');
        // Pudła
        const boxSize = ts * 0.6;
        drawRect(margin + ts * 0.2, margin + metalShelfH + objMargin, boxSize, boxSize, '#bf8f6f');
        drawRect(margin + ts * 1.0, margin + metalShelfH + objMargin, boxSize, boxSize, '#bf8f6f');
        drawRect(
          w - margin - boxSize * 1.5,
          margin + metalShelfH + objMargin * 3,
          boxSize * 1.2,
          boxSize * 0.8,
          '#bf8f6f'
        );
        // Stare biurko w rogu
        drawRect(w - margin - ts, h - margin - ts, ts * 0.8, ts * 0.8, '#6a4a3a');
        break;

      case 'utility': // Pomieszczenie gospodarcze
      default: // Domyślne, jeśli typ nieznany
        ctx.strokeStyle = '#5d4037';
        // Skrzynki/urządzenia
        drawRect(w * 0.1, h * 0.15, w * 0.3, h * 0.25, '#A0522D');
        drawRect(w * 0.6, h * 0.5, w * 0.3, h * 0.4, '#A0522D');
        // Szafa metalowa
        drawRect(w - margin - ts * 0.5, margin, ts * 0.5, h - margin * 2, '#777');
        // Rury/kable (symbolicznie)
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + margin, y + h * 0.8);
        ctx.lineTo(x + w - margin, y + h * 0.8);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + w * 0.7, y + margin);
        ctx.lineTo(x + w * 0.7, y + h - margin);
        ctx.stroke();
        ctx.lineWidth = 1; // Przywróć grubość linii
        break;
    }
  }

  /** Narysuj książki */
  drawBooks(ctx, books, offsetX, offsetY, bookImage) {
    if (!books || books.length === 0) return;
    const defaultBookSize = this.tileSize * 0.6;

    for (const book of books) {
      const isCollected = book.isCollected || book.collected; // Handle both potential properties
      if (!isCollected) {
        const bookSize = book.size || defaultBookSize;
        // Round drawing coordinates
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
            // Pass rounded coordinates and size
            book.draw(ctx, offsetX, offsetY, bookImage); // book.draw should handle its own rounding if needed internally
          } else {
            // Fallback drawing
            if (bookImage) {
              // Draw with rounded coordinates
              ctx.drawImage(bookImage, screenX, screenY, bookSize, bookSize);
            } else {
              ctx.fillStyle = '#8d6e63'; // Brown book color
              ctx.fillRect(screenX, screenY, bookSize, bookSize);
              ctx.strokeStyle = '#5d4037'; // Darker outline
              ctx.lineWidth = 1;
              ctx.strokeRect(screenX + 0.5, screenY + 0.5, bookSize - 1, bookSize - 1); // Draw border more clearly
            }
          }
        }
      }
    }
  }
} // End class MapRenderer
