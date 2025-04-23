// src/map/ProceduralMap.js

import { Book } from './Book.js';
import { MapRenderer } from './MapRenderer.js';
import { randomInt } from '../utils/map.js'; // Upewnij się, że map.js eksportuje randomInt
import { generateLevelData } from './MapGen.js';
import {
  TILE_WALL,
  TILE_CORRIDOR,
  TILE_ROOM_FLOOR,
  TILE_LIFT,
  LIFT_INTERACTION_RADIUS_MULTIPLIER,
  GYM_CHANCE_ON_FIRST_FLOOR, // Zachowaj dla domyślnych parametrów generowania, jeśli potrzebne
} from '../utils/constants.js';

// Uwaga: consistentLiftCoords jest teraz zarządzane wewnętrznie przez mapGenerator.js

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

    // Stan mapy - inicjalizowany po wygenerowaniu
    this.map = null;
    this.rooms = [];
    this.books = [];
    this.liftPosition = null; // Pozycja windy {x, y, tileX, tileY}

    // Moduły
    this.renderer = new MapRenderer(this.tileSize);

    // --- Generowanie ---
    // Zdefiniuj parametry generowania tutaj lub przekaż je
    const generationParams = {
      minRoomSize: 5,
      maxRoomSize: 10,
      corridorThickness: 1,
      numRooms: 12,
      maxRoomAttempts: 200,
      booksPerMap: 5, // Książki umieszczane *po* wygenerowaniu
      roomTypeWeights: {
        // Wagi typów pomieszczeń
        classroom: 50,
        office: 25,
        library: 15,
        lab: 10, // ! NOWY TYP: Laboratorium
        storage: 5, // ! NOWY TYP: Magazyn
        // szansa na siłownię (gym) jest obsługiwana przez generator na podstawie floorNumber
        utility: 10, // Pomieszczenie gospodarcze
      },
    };

    try {
      // Konfiguracja dla generatora
      const generationConfig = {
        cols: this.cols,
        rows: this.rows,
        floorNumber: this.floorNumber,
        minFloor: this.minFloor,
        maxFloor: this.maxFloor, // Przekaż też maxFloor, może być przydatne później
        tileSize: this.tileSize, // Przekaż tileSize, jeśli generator go potrzebuje (np. do pozycji windy w świecie)
        generationParams: generationParams,
      };

      // Generuj dane układu mapy
      const { map, rooms, liftPosition } = generateLevelData(generationConfig);

      // Zapisz wygenerowane dane
      this.map = map;
      this.rooms = rooms;
      this.liftPosition = liftPosition; // Zawiera już współrzędne świata, jeśli obliczone przez generator

      // --- Kroki po generacji ---
      this.renderer.resetColorCache(); // Zresetuj cache renderera dla nowej mapy
      this.placeBooksReliably(generationParams.booksPerMap); // Umieść książki na wygenerowanej mapie

      console.log(
        `[ProcMap Piętro ${this.floorNumber}] Inicjalizacja zakończona. ${
          this.rooms.length
        } pokoi, Winda: ${
          this.liftPosition
            ? `OK w (${this.liftPosition.tileX}, ${this.liftPosition.tileY})`
            : 'BŁĄD'
        }, ${this.books.length} książek.`
      );
      // this.logMapGrid(); // Opcjonalnie: Zaloguj siatkę po wszystkim
    } catch (error) {
      console.error(
        `[ProcMap Piętro ${this.floorNumber}] BŁĄD KRYTYCZNY podczas generowania mapy lub konfiguracji:`,
        error
      );
      // Obsłuż błąd odpowiednio - może rzuć go dalej lub ustaw stan 'failed'
      throw error; // Rzuć ponownie, aby zasygnalizować błąd wywołującemu (np. Game)
    }
  }

  // --- Umieszczanie książek (Przeniesione tutaj, działa na wygenerowanej mapie) ---
  placeBooksReliably(booksPerMap) {
    this.books = []; // Wyczyść poprzednie książki
    const potentialLocations = [];
    const placedCoords = new Set();
    console.log(`[ProcMap Piętro ${this.floorNumber}] Umieszczanie do ${booksPerMap} książek...`);

    // Znajdź prawidłowe miejsca (korytarz lub podłoga pokoju, nie winda)
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const tileValue = this.map[r]?.[c];
        const isLiftTile =
          this.liftPosition && r === this.liftPosition.tileY && c === this.liftPosition.tileX;
        // Sprawdzamy CZY JEST to korytarz LUB podłoga pokoju ORAZ CZY NIE JEST to winda
        if ((tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) && !isLiftTile) {
          potentialLocations.push({ r, c });
        }
      }
    }

    // Umieść książki losowo z potencjalnych lokalizacji
    let booksPlaced = 0;
    while (booksPlaced < booksPerMap && potentialLocations.length > 0) {
      const randomIndex = Math.floor(Math.random() * potentialLocations.length);
      const { r, c } = potentialLocations.splice(randomIndex, 1)[0]; // Usuń wybraną lokalizację
      const coordKey = `${c},${r}`;

      // Podwójnie sprawdź kafelek na wszelki wypadek i upewnij się, że nie został już umieszczony (choć splice powinien temu zapobiec)
      if (
        (this.map[r]?.[c] === TILE_CORRIDOR || this.map[r]?.[c] === TILE_ROOM_FLOOR) &&
        !placedCoords.has(coordKey)
      ) {
        const bookWorldX = (c + 0.5) * this.tileSize;
        const bookWorldY = (r + 0.5) * this.tileSize;
        const bookId = `book_${this.floorNumber}_${booksPlaced + 1}`; // Unikalne ID na piętro/książkę
        this.books.push(new Book(bookWorldX, bookWorldY, bookId, this.tileSize));
        placedCoords.add(coordKey);
        booksPlaced++;
      }
    }

    if (booksPlaced < booksPerMap) {
      console.warn(`[ProcMap Książki] Umieszczono tylko ${booksPlaced}/${booksPerMap} książek.`);
    } else {
      console.log(`[ProcMap Książki] Umieszczono ${booksPlaced} książek.`);
    }
  }

  // --- Metody interakcji ---

  isWalkable(worldX, worldY) {
    if (!this.map) return false; // Mapa nie wygenerowana
    const tileX = Math.floor(worldX / this.tileSize);
    const tileY = Math.floor(worldY / this.tileSize);

    if (tileX < 0 || tileX >= this.cols || tileY < 0 || tileY >= this.rows) {
      return false; // Poza granicami mapy
    }

    const tileValue = this.map[tileY]?.[tileX];
    // Sprawdź typy przechodnich kafelków - WINDA JEST PRZECHODNIA (dla kolizji, niekoniecznie do stania)
    return tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR || tileValue === TILE_LIFT;
  }

  findRandomInitialSpawnPosition() {
    if (!this.map) return undefined;
    const suitableTiles = [];
    // Preferuj kafelki nie sąsiadujące bezpośrednio ze ścianami dla mniej ciasnego startu
    for (let r = 1; r < this.rows - 1; r++) {
      for (let c = 1; c < this.cols - 1; c++) {
        const tileValue = this.map[r]?.[c];
        const isLift =
          this.liftPosition && r === this.liftPosition.tileY && c === this.liftPosition.tileX;
        // Szukamy korytarza lub podłogi pokoju, ALE NIE WINDY
        if ((tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) && !isLift) {
          // Sprawdź, czy jest otoczony przez nie-ściany (więcej otwartej przestrzeni)
          if (
            this.map[r - 1]?.[c] !== TILE_WALL &&
            this.map[r + 1]?.[c] !== TILE_WALL &&
            this.map[r]?.[c - 1] !== TILE_WALL &&
            this.map[r]?.[c + 1] !== TILE_WALL
          ) {
            suitableTiles.push({ r, c });
          }
        }
      }
    }

    // Wycofanie: Jeśli nie znaleziono otwartych przestrzeni, użyj dowolnego prawidłowego kafelka podłogi/korytarza (nadal nie windy)
    if (suitableTiles.length === 0) {
      console.warn(
        "[MapGen Spawn] Nie znaleziono 'otwartych' punktów startowych, używam dowolnego przechodniego kafelka nie będącego windą."
      );
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
        `[MapGen Spawn] KRYTYCZNY: Nie znaleziono odpowiednich kafelków startowych (podłoga/korytarz niebędący windą)!`
      );
      return undefined; // Zasygnalizuj błąd
    }

    const { r, c } = suitableTiles[Math.floor(Math.random() * suitableTiles.length)];
    const worldX = (c + 0.5) * this.tileSize;
    const worldY = (r + 0.5) * this.tileSize;
    console.log(`[MapGen Spawn] Znaleziono początkowy spawn na kratce(${c}, ${r})`);
    return { x: worldX, y: worldY };
  }

  /**
   * Znajduje najbliższą BEZPIECZNĄ przechodnią kratkę (KORYTARZ lub PODŁOGA_POKOJU)
   * do docelowej pozycji w świecie.
   * Używa wyszukiwania w rozszerzającym się promieniu, a jako fallback BFS.
   * @param {number} targetWorldX Docelowa współrzędna X w świecie.
   * @param {number} targetWorldY Docelowa współrzędna Y w świecie.
   * @param {number} [maxRadius=8] Maksymalny promień początkowego wyszukiwania.
   * @param {boolean} [excludeLift=false] Jeśli true, WYNIK nie może być kratką windy.
   * @returns {{x: number, y: number} | null} Współrzędne środka znalezionej kratki w świecie lub null.
   */
  findNearestWalkableTile(targetWorldX, targetWorldY, maxRadius = 8, excludeLift = false) {
    if (!this.map) return null;

    const targetTileX = Math.floor(targetWorldX / this.tileSize);
    const targetTileY = Math.floor(targetWorldY / this.tileSize);

    console.log(
      `[MapUtil] Szukanie najbliższej BEZPIECZNEJ kratki (excludeLift=${excludeLift}) blisko świata(${targetWorldX.toFixed(
        1
      )}, ${targetWorldY.toFixed(1)}) -> kratka(${targetTileX}, ${targetTileY})`
    );

    const targetSafeTiles = [TILE_CORRIDOR, TILE_ROOM_FLOOR]; // Cel: Korytarz lub podłoga pokoju
    if (!excludeLift) {
      // Jeśli nie wykluczamy windy, to ona też jest potencjalnym celem
      // targetSafeTiles.push(TILE_LIFT); // --> Zdecydowaliśmy, że ZAWSZE szukamy korytarza/pokoju
    }

    // 1. Sprawdzenie SAMEJ kratki docelowej (jeśli jest bezpieczna)
    const startTileValue = this.map[targetTileY]?.[targetTileX];
    if (targetSafeTiles.includes(startTileValue)) {
      // Sprawdź tylko, czy to nie jest winda, jeśli excludeLift=true
      if (!excludeLift || startTileValue !== TILE_LIFT) {
        console.log(
          `  [MapUtil] Kratka docelowa (${targetTileX}, ${targetTileY}) jest już bezpieczna.`
        );
        return { x: (targetTileX + 0.5) * this.tileSize, y: (targetTileY + 0.5) * this.tileSize };
      }
    }

    // 2. Wyszukiwanie Promieniowe (szukamy KORYTARZA lub PODŁOGI POKOJU)
    for (let radius = 1; radius <= maxRadius; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          // Sprawdzamy tylko granicę obecnego promienia
          if (Math.abs(dx) < radius && Math.abs(dy) < radius) continue;

          const checkX = targetTileX + dx;
          const checkY = targetTileY + dy;

          // Upewnij się, że w granicach
          if (checkX < 0 || checkX >= this.cols || checkY < 0 || checkY >= this.rows) continue;

          const tileValue = this.map[checkY]?.[checkX];
          // Znaleziono bezpieczne miejsce (korytarz lub podłoga pokoju)?
          if (tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) {
            console.log(
              `  [MapUtil] Znaleziono bezpieczną kratkę przez wyszukiwanie promieniowe na kratce(${checkX}, ${checkY})`
            );
            return { x: (checkX + 0.5) * this.tileSize, y: (checkY + 0.5) * this.tileSize };
          }
        }
      }
    }

    // 3. Wyszukiwanie BFS (Fallback) - Szukaj od celu na zewnątrz
    console.warn(
      `[MapUtil] Wyszukiwanie promieniowe nie powiodło się (maxPromień ${maxRadius}). Rozpoczynam BFS od kratki(${targetTileX}, ${targetTileY})...`
    );
    const queue = [[targetTileX, targetTileY]];
    const visited = new Set([`${targetTileX},${targetTileY}`]);
    const directions = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    // Przechodnie kratki *dla ścieżki wyszukiwania BFS* (można przejść PRZEZ windę, ale WINDA nie jest CELEM, jeśli excludeLift=true)
    const bfsWalkablePath = [TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT];

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
          visited.add(key); // Oznacz jako odwiedzone niezależnie od typu dla efektywności BFS

          // Znaleziono docelową bezpieczną kratkę? (Korytarz lub Podłoga Pokoju)
          if (targetSafeTiles.includes(tileValue)) {
            // Dodatkowe sprawdzenie, jeśli wykluczamy windę
            if (!excludeLift || tileValue !== TILE_LIFT) {
              console.log(
                `  [MapUtil] Znaleziono bezpieczną kratkę przez BFS na (${nextX}, ${nextY})`
              );
              return { x: (nextX + 0.5) * this.tileSize, y: (nextY + 0.5) * this.tileSize };
            }
          }

          // Czy możemy kontynuować wyszukiwanie Z tego sąsiada? (Korytarz, Podłoga Pokoju LUB Winda)
          if (bfsWalkablePath.includes(tileValue)) {
            queue.push([nextX, nextY]);
          }
        }
      }
    }

    console.error(
      `[MapUtil] KRYTYCZNA PORAŻKA: BFS nie mógł znaleźć ŻADNEJ bezpiecznej przechodniej kratki (Korytarz/Podłoga Pokoju, excludeLift=${excludeLift}) zaczynając od kratki(${targetTileX}, ${targetTileY})!`
    );
    return null; // Zasygnalizuj całkowitą porażkę
  }

  findNearbyUnansweredBook(worldX, worldY, radius = this.tileSize * 0.8) {
    if (!this.books) return null;
    let closestBook = null;
    let minDistanceSq = radius * radius;

    for (const book of this.books) {
      const isCollected = book.isCollected || book.collected; // Sprawdź obie flagi
      if (!isCollected) {
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
    const book = this.books.find((b) => b === bookToCollect || b.id === bookToCollect.id);
    if (book && !(book.isCollected || book.collected)) {
      book.isCollected = true;
      book.collected = true; // Ustaw obie dla bezpieczeństwa
      console.log(`[Map] Oznaczono książkę ${book.id} jako zebraną.`);
      return true;
    }
    return false;
  }

  findNearbyLift(worldX, worldY, radius = this.tileSize * LIFT_INTERACTION_RADIUS_MULTIPLIER) {
    if (!this.liftPosition) return null;
    // Sprawdź odległość od środka postaci do środka kafelka windy
    const dx = worldX - this.liftPosition.x;
    const dy = worldY - this.liftPosition.y;
    const distanceSq = dx * dx + dy * dy;
    return distanceSq < radius * radius ? this.liftPosition : null;
  }

  getLiftPosition() {
    // Upewnij się, że zwracasz kopię, jeśli liftPosition jest modyfikowalne, chociaż tutaj wydaje się ok
    return this.liftPosition;
  }

  // --- Rysowanie ---
  draw(ctx, bookImage = null) {
    if (!this.map || !this.renderer) return; // Nie rysuj, jeśli mapa nie została wygenerowana

    // Przygotuj payload danych dla renderera
    const mapData = {
      map: this.map,
      rooms: this.rooms,
      books: this.books,
      liftPosition: this.liftPosition,
      offsetX: this.offsetX, // Przekaż potencjalnie niecałkowity offset
      offsetY: this.offsetY,
      cols: this.cols,
      rows: this.rows,
      tileSize: this.tileSize,
    };

    // Deleguj rysowanie do renderera
    this.renderer.draw(ctx, mapData, bookImage);
  }

  // --- Debugowanie ---
  logMapGrid() {
    if (!this.map) {
      console.log('Siatka mapy niedostępna.');
      return;
    }
    console.log(`--- Siatka Mapy Piętro ${this.floorNumber} (${this.cols}x${this.rows}) ---`);
    let header = '   ';
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
              return '#'; // Ściana
            case TILE_CORRIDOR:
              return '.'; // Korytarz
            case TILE_ROOM_FLOOR:
              return ' '; // Podłoga pokoju
            case TILE_LIFT:
              return 'L'; // Winda
            default:
              return '?'; // Nieznany
          }
        })
        .join('');
      console.log(`${rowNum} ${rowString}`);
    }
    // Zaloguj pozycję windy dla weryfikacji
    if (this.liftPosition) {
      console.log(`Winda na kratce: (${this.liftPosition.tileX}, ${this.liftPosition.tileY})`);
    } else {
      console.log('Pozycja windy nie ustawiona.');
    }
    console.log(`--- Koniec Siatki Mapy Piętro ${this.floorNumber} ---`);
  }
} // Koniec klasy ProceduralMap
