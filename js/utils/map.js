// src/utils/map.js
import { TILE_CORRIDOR, TILE_ROOM_FLOOR, TILE_LIFT } from './constants.js'; // Potrzebne do BFS

/**
 * Generuje losową liczbę całkowitą z przedziału [min, max] (włącznie).
 * @param {number} min Dolna granica.
 * @param {number} max Górna granica.
 * @returns {number} Losowa liczba całkowita.
 */
export function randomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Prosta (niekryptograficzna) funkcja hashująca.
 * Używana do uzyskania pseudolosowej, ale deterministycznej wartości z liczby (koordynatów).
 * @param {number} seed Ziarno (np. skombinowane koordynaty).
 * @returns {number} Bezznakowa 32-bitowa liczba całkowita.
 */
export function simpleHash(seed) {
  let h = seed ^ 0xdeadbeef; // XOR z wartością początkową
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0; // Konwersja do liczby bez znaku 32-bitowej
}

// --- Funkcje kolorów ---

/**
 * Generuje losowy odcień szarości w zadanym zakresie jasności (0-255).
 * @param {number} minBrightness Minimalna jasność.
 * @param {number} maxBrightness Maksymalna jasność.
 * @returns {string} Kolor w formacie rgb().
 */
export function randomGray(minBrightness, maxBrightness) {
  const brightness = randomInt(minBrightness, maxBrightness);
  return `rgb(${brightness},${brightness},${brightness})`;
}

/**
 * Generuje losowy odcień szarości dla korytarzy.
 * @param {number} minBrightness Minimalna jasność.
 * @param {number} maxBrightness Maksymalna jasność.
 * @returns {string} Kolor w formacie rgb().
 */
export function randomCorridorGray(minBrightness, maxBrightness) {
  // Można użyć tej samej logiki co randomGray lub uczynić je nieco cieplejszymi/chłodniejszymi
  const brightness = randomInt(minBrightness, maxBrightness);
  return `rgb(${brightness},${brightness},${brightness})`;
}

/**
 * Dostosowuje jasność koloru HEX (np. '#RRGGBB').
 * @param {string} hexColor Kolor w formacie HEX.
 * @param {number} factor Współczynnik jasności (1.0 = bez zmian, <1 ciemniej, >1 jaśniej).
 * @returns {string} Nowy kolor w formacie HEX.
 */
export function adjustColorBrightness(hexColor, factor) {
  if (!hexColor || typeof hexColor !== 'string' || hexColor.length < 7) return hexColor; // Zwróć, jeśli kolor jest nieprawidłowy

  let r = parseInt(hexColor.slice(1, 3), 16);
  let g = parseInt(hexColor.slice(3, 5), 16);
  let b = parseInt(hexColor.slice(5, 7), 16);

  r = Math.min(255, Math.max(0, Math.round(r * factor)));
  g = Math.min(255, Math.max(0, Math.round(g * factor)));
  b = Math.min(255, Math.max(0, Math.round(b * factor)));

  const rHex = r.toString(16).padStart(2, '0');
  const gHex = g.toString(16).padStart(2, '0');
  const bHex = b.toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
}

/**
 * Wykonuje algorytm przeszukiwania wszerz (BFS) na siatce mapy.
 * Może być używany do znajdowania ścieżki lub sprawdzania osiągalności.
 * @param {number[][]} mapGrid Siatka mapy (2D array z wartościami kafelków).
 * @param {number} startX Początkowa współrzędna X kafelka.
 * @param {number} startY Początkowa współrzędna Y kafelka.
 * @param {number} cols Liczba kolumn w mapGrid.
 * @param {number} rows Liczba rzędów w mapGrid.
 * @param {number[]} walkableTileValues Tablica wartości kafelków uważanych za przechodnie dla tego BFS.
 * @returns {{reachable: boolean}} Obiekt wskazujący, czy BFS osiągnął określony cel (w tym przypadku, czy z punktu startowego można dojść do korytarza/pokoju).
 */
export function performBFS(mapGrid, startX, startY, cols, rows, walkableTileValues) {
  const queue = [[startX, startY]];
  const visited = new Set([`${startX},${startY}`]);
  const directions = [
    [0, -1], // Góra
    [0, 1], // Dół
    [-1, 0], // Lewo
    [1, 0], // Prawo
  ];
  let reachable = false; // Flaga, czy BFS dotarł do kafelków korytarza/pokoju (jeśli szukano od windy)

  // Sprawdzenie punktu startowego (jeśli szukamy osiągalności z windy)
  const startTileValue = mapGrid[startY]?.[startX];
  // Czy punkt startowy (np. winda) jest już na bezpiecznym terenie (dla celu sprawdzenia osiągalności)?
  // W tym konkretnym użyciu (sprawdzenie windy) interesuje nas, czy z windy można dotrzeć do KORYTARZA/POKOJU.
  // Samo stanie na windzie nie oznacza osiągalności bezpiecznej strefy.
  // Sprawdzimy sąsiadów windy.

  while (queue.length > 0) {
    const [currX, currY] = queue.shift();

    for (const [dx, dy] of directions) {
      const nextX = currX + dx;
      const nextY = currY + dy;
      const key = `${nextX},${nextY}`;

      // Sprawdzenie granic i czy już odwiedzone
      if (nextX >= 0 && nextX < cols && nextY >= 0 && nextY < rows && !visited.has(key)) {
        const tileValue = mapGrid[nextY]?.[nextX];
        visited.add(key); // Odwiedzamy niezależnie od typu

        // Czy ten kafelek jest przechodni DLA TEGO BFS?
        if (walkableTileValues.includes(tileValue)) {
          queue.push([nextX, nextY]);

          // Czy ten kafelek jest KORYTARZEM lub PODŁOGĄ POKOJU?
          // Jeśli tak, to znaleźliśmy bezpieczną strefę osiągalną z punktu startowego.
          if (tileValue === TILE_CORRIDOR || tileValue === TILE_ROOM_FLOOR) {
            reachable = true;
            // Można by tu zakończyć pętlę, jeśli interesuje nas tylko CZY jest osiągalne
            // return { reachable: true };
          }
        }
      }
    }
  }
  // Zwróć wynik BFS - w tym przypadku, flagę osiągalności bezpiecznej strefy
  return { reachable };
}

// ... (inne narzędzia mapy, jeśli istnieją)
