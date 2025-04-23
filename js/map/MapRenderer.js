// src/map/mapRenderer.js

import { TILE_WALL, TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT } from '../utils/constants.js';
import { randomGray, randomCorridorGray, adjustColorBrightness, simpleHash } from '../utils/map.js'; // Załóżmy, że istnieje simpleHash

export class MapRenderer {
  constructor(tileSize) {
    this.tileSize = tileSize;
    this.tileColors = {}; // Cache dla spójnych kolorów kafelków na instancję mapy
    this.baseWallColor = '#4a4a4a'; // Podstawowy kolor ścian
    this.baseCorridorColor = '#a0a0a0'; // Podstawowy kolor korytarzy
    this.baseRoomFloorColor = '#c0c0c0'; // Podstawowy kolor podłogi pokoju
  }

  // Zresetuj cache kolorów, gdy rysowana jest nowa mapa (wywoływane przez ProceduralMap)
  resetColorCache() {
    this.tileColors = {};
  }

  /** Pobierz lub wygeneruj kolor dla określonego kafelka */
  getTileColor(r, c, tileValue, rooms) {
    const key = `${r},${c}`;
    if (this.tileColors[key]) {
      return this.tileColors[key];
    }

    let color;
    let brightnessFactor = 1.0;
    // Używamy prostego hasha z koordynatów dla deterministycznej wariacji
    const hash = simpleHash(r * 1000 + c); // Prosta funkcja hashująca oparta na koordynatach
    const variation = ((hash % 21) - 10) / 100; // Wariacja od -0.1 do +0.1

    switch (tileValue) {
      case TILE_WALL:
        // Kolor bazowy + deterministyczna wariacja
        brightnessFactor = 0.9 + variation * 0.5; // Mniejsza wariacja dla ścian
        color = adjustColorBrightness(this.baseWallColor, brightnessFactor);
        break;
      case TILE_CORRIDOR:
        // Kolor bazowy + deterministyczna wariacja
        brightnessFactor = 0.95 + variation;
        color = adjustColorBrightness(this.baseCorridorColor, brightnessFactor);
        break;
      case TILE_ROOM_FLOOR:
        // Kolor bazowy podłogi pokoju (zostanie nadpisany w drawRoomDetails)
        color = this.baseRoomFloorColor;
        break;
      case TILE_LIFT:
        // Kolor windy - można zrobić ciekawszy
        color = '#707080'; // Trochę jaśniejszy
        break;
      default:
        color = '#ff00ff'; // Kolor błędu
        break;
    }
    this.tileColors[key] = color;
    return color;
  }

  /** Główna funkcja rysująca */
  draw(ctx, mapData, bookImage = null) {
    const { map, rooms, books, liftPosition, offsetX, offsetY, cols, rows } = mapData;

    // Zaokrąglij przesunięcia dla ostrości
    const currentOffsetX = Math.floor(offsetX);
    const currentOffsetY = Math.floor(offsetY);

    // Określ widoczne kafelki z małym zapasem
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

    ctx.save(); // Zapisz stan kontekstu
    // Wyłącz wygładzanie dla pixel-artu (jeśli potrzebne)
    // ctx.imageSmoothingEnabled = false; // Już w GameRenderer

    // 1. Narysuj podstawowe kafelki (ściany, korytarze, domyślna podłoga, baza windy)
    this.drawBaseTiles(
      ctx,
      map,
      rooms, // Przekazujemy rooms do getTileColor, jeśli będzie potrzebne
      currentOffsetX,
      currentOffsetY,
      cols,
      rows,
      startRow,
      endRow,
      startCol,
      endCol
    );

    // 2. Narysuj specyficzne podłogi i dekoracje pokoi
    this.drawRoomDetails(
      ctx,
      map,
      rooms,
      liftPosition, // Przekazujemy pozycję windy do sprawdzenia
      currentOffsetX,
      currentOffsetY,
      cols,
      rows,
      startRow,
      endRow,
      startCol,
      endCol
    );

    // 3. Narysuj detale windy (nad podłogami pokoi, jeśli konieczne)
    this.drawLiftDetails(ctx, liftPosition, currentOffsetX, currentOffsetY);

    // 4. Narysuj książki
    this.drawBooks(ctx, books, currentOffsetX, currentOffsetY, bookImage);

    ctx.restore(); // Przywróć stan kontekstu
  }

  /** Narysuj podstawowe kafelki */
  drawBaseTiles(ctx, map, rooms, offsetX, offsetY, cols, rows, startRow, endRow, startCol, endCol) {
    ctx.save();
    // Usunąłem domyślny cień, będziemy dodawać tam, gdzie trzeba
    ctx.shadowColor = 'transparent';

    const wallEdgeColorDark = '#383838'; // Ciemniejszy dla cienia/dołu
    const wallEdgeColorLight = '#606060'; // Jaśniejszy dla góry/oświetlenia
    const wallTopEdgeColor = '#757575'; // Najjaśniejszy góra

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tileValue = map[r]?.[c];
        if (tileValue === undefined) continue;

        // Zaokrąglij współrzędne rysowania do liczb całkowitych!
        const screenX = Math.floor(c * this.tileSize + offsetX);
        const screenY = Math.floor(r * this.tileSize + offsetY);
        const color = this.getTileColor(r, c, tileValue, rooms);

        ctx.fillStyle = color;
        ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);

        // --- Ulepszone rysowanie ścian i krawędzi ---
        if (tileValue === TILE_WALL) {
          // Prosta tekstura szumu dla ściany
          ctx.fillStyle = 'rgba(0,0,0,0.06)'; // Półprzezroczysty czarny
          for (let i = 0; i < 5; i++) {
            // Kilka punktów szumu
            ctx.fillRect(
              screenX + Math.random() * this.tileSize,
              screenY + Math.random() * this.tileSize,
              1,
              1
            );
          }

          // Rysujemy krawędzie tylko jeśli sąsiad NIE jest ścianą
          const edgeSize = 2; // Grubość krawędzi

          // Górna krawędź (najjaśniejsza)
          if (r > 0 && map[r - 1]?.[c] !== TILE_WALL) {
            ctx.fillStyle = wallTopEdgeColor;
            ctx.fillRect(screenX, screenY, this.tileSize, edgeSize);
          }
          // Dolna krawędź (ciemna)
          if (r < rows - 1 && map[r + 1]?.[c] !== TILE_WALL) {
            ctx.fillStyle = wallEdgeColorDark;
            ctx.fillRect(screenX, screenY + this.tileSize - edgeSize, this.tileSize, edgeSize);
          }
          // Lewa krawędź (jasna)
          if (c > 0 && map[r]?.[c - 1] !== TILE_WALL) {
            ctx.fillStyle = wallEdgeColorLight;
            ctx.fillRect(screenX, screenY + edgeSize, edgeSize, this.tileSize - edgeSize); // Zaczynamy poniżej górnej krawędzi
          }
          // Prawa krawędź (ciemna)
          if (c < cols - 1 && map[r]?.[c + 1] !== TILE_WALL) {
            ctx.fillStyle = wallEdgeColorDark;
            ctx.fillRect(
              screenX + this.tileSize - edgeSize,
              screenY + edgeSize,
              edgeSize,
              this.tileSize - edgeSize
            ); // Zaczynamy poniżej górnej krawędzi
          }

          // Narożniki (opcjonalnie, dla wygładzenia)
          // Wewnętrzny górny lewy róg
          if (
            r > 0 &&
            c > 0 &&
            map[r - 1]?.[c] !== TILE_WALL &&
            map[r]?.[c - 1] !== TILE_WALL &&
            map[r - 1]?.[c - 1] !== TILE_WALL
          ) {
            ctx.fillStyle = wallEdgeColorLight; // Kompromisowy kolor
            ctx.fillRect(screenX, screenY, edgeSize, edgeSize);
          }
          // Wewnętrzny górny prawy róg
          if (
            r > 0 &&
            c < cols - 1 &&
            map[r - 1]?.[c] !== TILE_WALL &&
            map[r]?.[c + 1] !== TILE_WALL &&
            map[r - 1]?.[c + 1] !== TILE_WALL
          ) {
            ctx.fillStyle = wallTopEdgeColor; // Jasny bo z góry
            ctx.fillRect(screenX + this.tileSize - edgeSize, screenY, edgeSize, edgeSize);
          }
          // itd. dla dolnych rogów...
        } else if (tileValue === TILE_CORRIDOR) {
          // Bardzo lekka tekstura dla korytarza
          ctx.fillStyle = 'rgba(255,255,255,0.03)'; // Ledwo widoczny biały szum
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

  /** Narysuj specyficzne podłogi i dekoracje pokoi */
  drawRoomDetails(
    ctx,
    map,
    rooms,
    liftPosition, // Dodaliśmy liftPosition
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
    ctx.shadowColor = 'transparent'; // Brak cieni dla detali pokoju

    for (const room of rooms) {
      // Podstawowe sprawdzenie widoczności dla ramki pokoju
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

      // --- Określenie Koloru Podłogi ---
      // Użyjemy spójnego, ale zróżnicowanego koloru bazowego dla typu
      let floorColor = this.baseRoomFloorColor; // Domyślny szary
      let roomSeed = room.id + this.floorNumber * 100; // Prosty seed oparty na ID pokoju i piętrze

      switch (room.type) {
        case 'classroom':
          floorColor = adjustColorBrightness('#a0c8e0', 0.9 + (simpleHash(roomSeed) % 11) / 100);
          break; // Niebieskawy
        case 'office':
          floorColor = adjustColorBrightness('#f0e8c0', 0.9 + (simpleHash(roomSeed) % 11) / 100);
          break; // Beżowy
        case 'library':
          floorColor = adjustColorBrightness('#d8c0a8', 0.9 + (simpleHash(roomSeed) % 11) / 100);
          break; // Drewniany
        case 'gym':
          floorColor = adjustColorBrightness('#b0d0b0', 0.9 + (simpleHash(roomSeed) % 11) / 100);
          break; // Zielonkawy
        case 'lab':
          floorColor = adjustColorBrightness('#e0e0ff', 0.9 + (simpleHash(roomSeed) % 11) / 100);
          break; // Jasny niebiesko-fioletowy
        case 'storage':
          floorColor = adjustColorBrightness('#b0a090', 0.9 + (simpleHash(roomSeed) % 11) / 100);
          break; // Szaro-brązowy
        case 'utility':
          floorColor = adjustColorBrightness('#b0b0b0', 0.9 + (simpleHash(roomSeed) % 11) / 100);
          break; // Szary beton
      }

      // --- Rysowanie Podłogi Pokoju (kafelek po kafelku w widocznym obszarze) ---
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
          // --- FIX WINDY i MIGOTANIA ---
          // Rysujemy podłogę TYLKO jeśli to TILE_ROOM_FLOOR
          // (nie rysujemy na ścianach, korytarzach I WINDZIE)
          if (tileValue === TILE_ROOM_FLOOR) {
            const screenX = Math.floor(c * this.tileSize + offsetX);
            const screenY = Math.floor(r * this.tileSize + offsetY);

            // Deterministyczna wariacja jasności dla każdego kafelka podłogi
            const tileHash = simpleHash(r * 5000 + c * 3 + room.id); // Hash z uwzględnieniem pokoju
            const variation = ((tileHash % 11) - 5) / 100; // Wariacja -0.05 do +0.05
            const brightnessFactor = 0.98 + variation;
            ctx.fillStyle = adjustColorBrightness(floorColor, brightnessFactor);

            ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);

            // Opcjonalna dodatkowa tekstura podłogi (np. linie, wzór)
            // if (room.type === 'gym' && (r + c) % 2 === 0) { // Prosty wzór szachownicy dla siłowni
            //   ctx.fillStyle = 'rgba(0,0,0,0.05)';
            //   ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);
            // }
            if (room.type === 'lab') {
              // Linie siatki dla laboratorium
              ctx.strokeStyle = 'rgba(0,0,0,0.08)';
              ctx.lineWidth = 1;
              ctx.strokeRect(screenX + 0.5, screenY + 0.5, this.tileSize - 1, this.tileSize - 1);
            }
          }
        }
      }

      // --- Rysowanie Dekoracji (używając współrzędnych ekranu) ---
      // Przekazujemy screenX, screenY, W, H pokoju
      this.drawRoomDecorations(ctx, room, roomScreenX, roomScreenY, roomScreenW, roomScreenH);
    }
    ctx.restore();
  }

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
      const isCollected = book.isCollected || book.collected; // Obsłuż obie potencjalne właściwości
      if (!isCollected) {
        const bookSize = book.size || defaultBookSize;
        // Zaokrąglij współrzędne rysowania
        const screenX = Math.floor(book.x + offsetX - bookSize / 2);
        const screenY = Math.floor(book.y + offsetY - bookSize / 2);

        // Podstawowe sprawdzenie widoczności
        if (
          screenX + bookSize > 0 &&
          screenX < ctx.canvas.width &&
          screenY + bookSize > 0 &&
          screenY < ctx.canvas.height
        ) {
          // Preferuj własną metodę rysowania książki, jeśli dostępna
          if (typeof book.draw === 'function') {
            // Przekazujemy zaokrąglone współrzędne i rozmiar
            book.draw(ctx, offsetX, offsetY, bookImage); // book.draw sama powinna zaokrąglać
          } else {
            // Rysowanie zapasowe
            if (bookImage) {
              // Rysujemy z zaokrąglonymi współrzędnymi
              ctx.drawImage(bookImage, screenX, screenY, bookSize, bookSize);
            } else {
              ctx.fillStyle = '#8d6e63'; // Brązowy kolor książki
              ctx.fillRect(screenX, screenY, bookSize, bookSize);
              ctx.strokeStyle = '#5d4037'; // Ciemniejszy kontur
              ctx.lineWidth = 1;
              ctx.strokeRect(screenX + 0.5, screenY + 0.5, bookSize - 1, bookSize - 1); // Rysujemy ramkę wyraźniej
            }
          }
        }
      }
    }
  }
} // Koniec klasy MapRenderer
