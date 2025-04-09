export class ProceduralMap {
  constructor(canvasWidth, canvasHeight) {
    // Размеры карты не привязаны строго к канвасу, могут быть больше
    this.tileSize = 32; // Размер тайла в пикселях
    this.cols = 40; // Ширина карты в тайлах
    this.rows = 30; // Высота карты в тайлах
    this.width = this.cols * this.tileSize; // Полная ширина карты в пикселях
    this.height = this.rows * this.tileSize; // Полная высота карты в пикселях

    this.offsetX = 0; // Смещение камеры по X
    this.offsetY = 0; // Смещение камеры по Y

    this.rooms = []; // Массив для хранения информации о комнатах
    this.books = []; // Массив для хранения объектов книг
    this.stairs = { up: null, down: null }; // Хранение координат и типа лестниц

    // Генерация структуры карты (стены, полы, лестницы) и размещение книг
    const generationResult = this.generateSchoolLayout(this.rows, this.cols);
    this.map = generationResult.map; // Двумерный массив тайлов карты
    this.stairs = generationResult.stairs; // Сохраняем найденные лестницы
  }

  // Основной метод генерации карты этажа
  generateSchoolLayout(rows, cols) {
    // --- Параметры генерации ---
    const minRoomSize = 4; // Минимальный размер комнаты (в тайлах)
    const maxRoomSize = 8; // Максимальный размер комнаты
    const corridorThickness = 1; // Толщина коридора (1 тайл)
    const numRooms = 15; // Желаемое количество комнат
    const maxRoomAttempts = 100; // Попыток разместить комнаты
    const booksPerMap = 5; // Количество книг для размещения на этаже

    // --- Инициализация ---
    // Заполняем карту стенами (1)
    // 0 = коридор, 2 = пол комнаты, 3 = лестница вниз, 4 = лестница вверх
    const map = Array.from({ length: rows }, () => Array(cols).fill(1));
    this.rooms = []; // Очищаем комнаты перед новой генерацией
    this.books = []; // Очищаем книги перед новой генерацией
    let placedStairs = { up: null, down: null }; // Временное хранилище для найденных лестниц

    // --- 1. Размещение комнат ---
    let roomAttempts = 0;
    while (this.rooms.length < numRooms && roomAttempts < maxRoomAttempts) {
      roomAttempts++;
      const roomWidth = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
      const roomHeight = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
      // Случайная позиция (оставляем зазор от краев карты)
      const roomCol = Math.floor(Math.random() * (cols - roomWidth - 2)) + 1;
      const roomRow = Math.floor(Math.random() * (rows - roomHeight - 2)) + 1;

      const newRoom = {
        col: roomCol,
        row: roomRow,
        width: roomWidth,
        height: roomHeight,
        // Случайный тип комнаты
        type: Math.random() < 0.6 ? 'classroom' : Math.random() < 0.5 ? 'office' : 'utility',
        id: this.rooms.length + 2, // Уникальный ID для тайлов (если понадобится)
      };

      // Проверка на пересечение с существующими комнатами (с зазором)
      let overlaps = false;
      const buffer = corridorThickness + 1; // Зазор между комнатами = толщина коридора + 1
      for (const existingRoom of this.rooms) {
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

      // Если не пересекается, добавляем комнату и "вырезаем" ее на карте
      if (!overlaps) {
        this.rooms.push(newRoom);
        for (let r = newRoom.row; r < newRoom.row + newRoom.height; r++) {
          for (let c = newRoom.col; c < newRoom.col + newRoom.width; c++) {
            // Дополнительная проверка границ на всякий случай
            if (r >= 0 && r < rows && c >= 0 && c < cols) {
              map[r][c] = 2; // Пол комнаты
            }
          }
        }
      }
    }

    // --- 2. Прокладка коридоров ---
    // Соединяем центры последовательных комнат L-образными коридорами
    for (let i = 0; i < this.rooms.length - 1; i++) {
      const roomA = this.rooms[i];
      const roomB = this.rooms[i + 1];
      const centerA_col = Math.floor(roomA.col + roomA.width / 2);
      const centerA_row = Math.floor(roomA.row + roomA.height / 2);
      const centerB_col = Math.floor(roomB.col + roomB.width / 2);
      const centerB_row = Math.floor(roomB.row + roomB.height / 2);

      // Случайный порядок: сначала горизонтальный или вертикальный сегмент
      if (Math.random() > 0.5) {
        this.carveHorizontalCorridor(map, centerA_row, centerA_col, centerB_col, corridorThickness);
        this.carveVerticalCorridor(map, centerB_col, centerA_row, centerB_row, corridorThickness);
      } else {
        this.carveVerticalCorridor(map, centerA_col, centerA_row, centerB_row, corridorThickness);
        this.carveHorizontalCorridor(map, centerB_row, centerA_col, centerB_col, corridorThickness);
      }
    }

    // --- 3. Размещение Лестниц ---
    // Ищем подходящее место (пол), примыкающее к стене
    let stairsPlacedCount = 0;
    let placeAttempts = 0;
    const maxStairsAttempts = 200; // Больше попыток для лестниц
    while (stairsPlacedCount < 2 && placeAttempts < maxStairsAttempts) {
      placeAttempts++;
      // Случайные координаты, не у самых краев
      const r = Math.floor(Math.random() * (rows - 2)) + 1;
      const c = Math.floor(Math.random() * (cols - 2)) + 1;

      // Условие: это пол (0 или 2) и хотя бы один сосед - стена (1)
      if (
        (map[r][c] === 0 || map[r][c] === 2) &&
        (map[r - 1]?.[c] === 1 ||
          map[r + 1]?.[c] === 1 ||
          map[r]?.[c - 1] === 1 ||
          map[r]?.[c + 1] === 1)
      ) {
        // Рассчитываем мировые координаты центра тайла лестницы
        const worldX = (c + 0.5) * this.tileSize;
        const worldY = (r + 0.5) * this.tileSize;

        // Пытаемся разместить лестницу вниз, если еще не размещена
        if (!placedStairs.down) {
          map[r][c] = 3; // Код тайла лестницы вниз
          placedStairs.down = { x: worldX, y: worldY, tileX: c, tileY: r, type: 'stairs_down' };
          stairsPlacedCount++;
        }
        // Пытаемся разместить лестницу вверх, если еще не размещена и место другое
        else if (
          !placedStairs.up &&
          (r !== placedStairs.down.tileY || c !== placedStairs.down.tileX)
        ) {
          map[r][c] = 4; // Код тайла лестницы вверх
          placedStairs.up = { x: worldX, y: worldY, tileX: c, tileY: r, type: 'stairs_up' };
          stairsPlacedCount++;
        }
      }
      // Если обе лестницы размещены, выходим из цикла
      if (placedStairs.up && placedStairs.down) break;
    }
    // Предупреждения, если не удалось разместить лестницы
    if (!placedStairs.down)
      console.warn("ProceduralMap: Could not place 'stairs down'. Transition might fail.");
    if (!placedStairs.up)
      console.warn("ProceduralMap: Could not place 'stairs up'. Transition might fail.");

    // --- 4. Размещение книг ---
    let booksPlaced = 0;
    let bookAttempts = 0;
    const maxBookAttempts = 300; // Больше попыток для книг
    while (booksPlaced < booksPerMap && bookAttempts < maxBookAttempts) {
      bookAttempts++;
      // Если нет комнат, выйти (маловероятно, но возможно)
      if (this.rooms.length === 0) break;

      // Выбираем случайную комнату
      const roomIndex = Math.floor(Math.random() * this.rooms.length);
      const room = this.rooms[roomIndex];

      // Исключаем комнаты размером 1x1 или меньше
      if (room.width <= 1 || room.height <= 1) continue;

      // Выбираем случайный тайл внутри комнаты (не у стен)
      const c = room.col + Math.floor(Math.random() * (room.width - 2)) + 1;
      const r = room.row + Math.floor(Math.random() * (room.height - 2)) + 1;

      // Проверяем, что тайл существует и это пол (2), и там еще нет книги/лестницы
      if (
        map[r]?.[c] === 2 &&
        !this.books.some(
          (b) => Math.floor(b.x / this.tileSize) === c && Math.floor(b.y / this.tileSize) === r
        )
      ) {
        const bookX = (c + 0.5) * this.tileSize; // Центр тайла
        const bookY = (r + 0.5) * this.tileSize;
        this.books.push(new Book(bookX, bookY, this.tileSize));
        booksPlaced++;
      }
    }
    if (booksPlaced < booksPerMap)
      console.warn(`ProceduralMap: Placed only ${booksPlaced}/${booksPerMap} books.`);

    // --- 5. Установка границ карты ---
    // Убедимся, что внешний периметр - это стены
    for (let r = 0; r < rows; r++) {
      map[r][0] = 1;
      map[r][cols - 1] = 1;
    }
    for (let c = 0; c < cols; c++) {
      map[0][c] = 1;
      map[rows - 1][c] = 1;
    }

    // Возвращаем сгенерированную карту и информацию о лестницах
    return { map: map, stairs: placedStairs };
  }

  // Вспомогательная функция: рисует горизонтальный коридор
  carveHorizontalCorridor(map, r, c1, c2, thickness) {
    const cols = map[0].length;
    const startCol = Math.min(c1, c2);
    const endCol = Math.max(c1, c2);
    for (let c = startCol; c <= endCol; c++) {
      // Центрируем толщину коридора относительно r
      for (let t = -Math.floor((thickness - 1) / 2); t <= Math.ceil((thickness - 1) / 2); t++) {
        const row = r + t;
        // Рисуем коридор (0), только если там была стена (1)
        if (row >= 0 && row < map.length && c >= 0 && c < cols && map[row][c] === 1) {
          map[row][c] = 0;
        }
      }
    }
  }

  // Вспомогательная функция: рисует вертикальный коридор
  carveVerticalCorridor(map, c, r1, r2, thickness) {
    const rows = map.length;
    const startRow = Math.min(r1, r2);
    const endRow = Math.max(r1, r2);
    for (let r = startRow; r <= endRow; r++) {
      // Центрируем толщину коридора относительно c
      for (let t = -Math.floor((thickness - 1) / 2); t <= Math.ceil((thickness - 1) / 2); t++) {
        const col = c + t;
        // Рисуем коридор (0), только если там была стена (1)
        if (r >= 0 && r < rows && col >= 0 && col < map[0].length && map[r][col] === 1) {
          map[r][col] = 0;
        }
      }
    }
  }

  // Проверка, является ли тайл по мировым координатам проходимым
  isWalkable(x, y) {
    const col = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);

    // Проверка выхода за границы карты
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      // console.log(`isWalkable: Coords (${x.toFixed(1)}, ${y.toFixed(1)}) -> Tile (${col}, ${row}) - OUT OF BOUNDS -> false`);
      return false;
    }

    const tileType = this.map[row][col];
    const walkable = tileType === 0 || tileType === 2; // Проходимы коридоры (0) и полы комнат (2)

    // Логируем только если проверяется непроходимый тайл (чтобы не спамить)
    // if (!walkable) {
    //    console.log(`isWalkable: Coords (${x.toFixed(1)}, ${y.toFixed(1)}) -> Tile (${col}, ${row}) - Type ${tileType} -> ${walkable}`);
    // }

    return walkable;
  }

  // --- Находим ближайшую НЕ СОБРАННУЮ И НЕ ОТВЕЧЕННУЮ книгу ---
  // Возвращает объект книги или null
  findNearbyUnansweredBook(worldX, worldY) {
    const checkRadiusSq = (this.tileSize * 0.8) ** 2; // Чуть больше радиус для "активации"
    let closestBook = null;
    let minDistanceSq = checkRadiusSq; // Ищем книгу в пределах радиуса

    for (const book of this.books) {
      // Ищем только те книги, на которые еще не ответили правильно
      if (!book.answeredCorrectly) {
        const dx = worldX - book.x;
        const dy = worldY - book.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < minDistanceSq) {
          minDistanceSq = distanceSq;
          closestBook = book;
        }
      }
    }
    // Если нашли книгу достаточно близко
    if (closestBook) {
      // console.log(`Nearby unanswered book found at (${closestBook.x.toFixed(1)}, ${closestBook.y.toFixed(1)})`);
    }
    return closestBook;
  }

  // --- Помечаем книгу как собранную (вызывается ПОСЛЕ правильного ответа) ---
  markBookAsCollected(bookToCollect) {
    const book = this.books.find((b) => b === bookToCollect); // Находим по ссылке
    if (book && !book.answeredCorrectly) {
      book.answeredCorrectly = true; // Используем флаг answeredCorrectly
      book.collected = true; // Можно оставить и этот флаг для визуала
      console.log('Book marked as collected (answered correctly):', book.x, book.y);
      return true;
    }
    console.warn(
      "Attempted to mark a book as collected, but it wasn't found or already answered.",
      bookToCollect
    );
    return false;
  }

  // Найти случайную проходимую точку (центр тайла) для старта персонажа
  findRandomWalkablePosition() {
    let attempts = 0;
    const maxAttempts = this.rows * this.cols * 2; // Больше попыток на всякий случай
    while (attempts < maxAttempts) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);
      // Ищем только пол комнаты (2) или коридор (0) - НЕ лестницу
      if (this.map[r]?.[c] === 0 || this.map[r]?.[c] === 2) {
        // Возвращаем мировые координаты центра найденного тайла
        return {
          x: (c + 0.5) * this.tileSize,
          y: (r + 0.5) * this.tileSize,
        };
      }
      attempts++;
    }
    // Если не нашли за много попыток, возвращаем центр карты (может быть стеной!)
    console.warn('ProceduralMap: Could not find walkable start position! Placing at map center.');
    return { x: this.width / 2, y: this.height / 2 };
  }

  // Проверка и сбор книги в указанной мировой позиции
  collectBook(worldX, worldY) {
    // Используем квадрат радиуса для оптимизации (избегаем sqrt)
    const collectRadiusSq = (this.tileSize * 0.7) ** 2;

    for (const book of this.books) {
      if (!book.collected) {
        const dx = worldX - book.x;
        const dy = worldY - book.y;
        // Если расстояние от центра персонажа до центра книги меньше радиуса сбора
        if (dx * dx + dy * dy < collectRadiusSq) {
          book.collected = true; // Помечаем книгу как собранную
          console.log('Book collected at world coordinates:', book.x, book.y);
          return true; // Возвращаем true, т.к. книга успешно собрана
        }
      }
    }
    return false; // Книга не найдена в радиусе или уже собрана
  }

  // Метод отрисовки всей карты (с учетом видимой области и смещения)
  draw(ctx, bookImage = null) {
    // Принимаем изображение книги для отрисовки
    // Определяем видимую область карты в тайлах
    const startCol = Math.max(0, Math.floor(-this.offsetX / this.tileSize));
    const endCol = Math.min(this.cols, startCol + Math.ceil(ctx.canvas.width / this.tileSize) + 1);
    const startRow = Math.max(0, Math.floor(-this.offsetY / this.tileSize));
    const endRow = Math.min(this.rows, startRow + Math.ceil(ctx.canvas.height / this.tileSize) + 1);

    // --- 1. Рисуем базовые тайлы (стены, коридоры, лестницы) ---
    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const cell = this.map[r][c];
        // Рассчитываем экранные координаты тайла
        const x = c * this.tileSize + this.offsetX;
        const y = r * this.tileSize + this.offsetY;

        // Определяем цвет заливки в зависимости от типа тайла
        let fill = '#222'; // Стена (по умолчанию)
        if (cell === 0) fill = '#aaa'; // Коридор
        else if (cell === 2) fill = '#eee'; // Пол комнаты (общий, будет перекрыт)
        else if (cell === 3) fill = '#634747'; // Лестница вниз (темно-коричневый)
        else if (cell === 4) fill = '#8B7355'; // Лестница вверх (светло-коричневый)

        ctx.fillStyle = fill;
        ctx.fillRect(x, y, this.tileSize, this.tileSize);

        // Дополнительная отрисовка для лестниц (placeholder текстуры)
        if (cell === 3 || cell === 4) {
          // Обводка для лучшей видимости
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 3, y + 3, this.tileSize - 6, this.tileSize - 6);
          // Линии, имитирующие ступеньки
          ctx.strokeStyle = cell === 3 ? '#4a3535' : '#6b5745'; // Темнее для спуска
          ctx.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            const lineY = y + (this.tileSize / 4) * (i + 0.5);
            ctx.beginPath();
            ctx.moveTo(x + 4, lineY);
            ctx.lineTo(x + this.tileSize - 4, lineY);
            ctx.stroke();
          }
          // TODO: Заменить это на ctx.drawImage(stairsTexture, ...) когда будет текстура
        }
        // Отладочная сетка (раскомментировать при необходимости)
        // ctx.strokeStyle = '#ddd';
        // ctx.strokeRect(x, y, this.tileSize, this.tileSize);
      }
      for (const book of this.books) {
        // Рисуем книгу, если на нее еще не ответили правильно
        if (!book.answeredCorrectly) {
          const bookScreenX = book.x + this.offsetX;
          const bookScreenY = book.y + this.offsetY;
          if (
            bookScreenX + book.size > 0 &&
            bookScreenX - book.size < ctx.canvas.width &&
            bookScreenY + book.size > 0 &&
            bookScreenY - book.size < ctx.canvas.height
          ) {
            book.draw(ctx, this.offsetX, this.offsetY, bookImage);
          }
        }
      }
    }

    // --- 2. Рисуем специфичные полы и декорации комнат ---
    // Проходим по всем комнатам
    for (const room of this.rooms) {
      // Проверяем, видна ли комната хотя бы частично на экране
      const roomScreenX = room.col * this.tileSize + this.offsetX;
      const roomScreenY = room.row * this.tileSize + this.offsetY;
      const roomScreenW = room.width * this.tileSize;
      const roomScreenH = room.height * this.tileSize;

      if (
        roomScreenX < ctx.canvas.width &&
        roomScreenX + roomScreenW > 0 &&
        roomScreenY < ctx.canvas.height &&
        roomScreenY + roomScreenH > 0
      ) {
        // Получаем экранные координаты и размеры комнаты
        const x = roomScreenX;
        const y = roomScreenY;
        const w = roomScreenW;
        const h = roomScreenH;

        // Рисуем пол комнаты цветом, зависящим от типа
        if (room.type === 'classroom') ctx.fillStyle = 'lightblue';
        else if (room.type === 'office') ctx.fillStyle = 'lightyellow';
        else ctx.fillStyle = '#ddd'; // utility
        ctx.fillRect(x, y, w, h); // Перекрываем базовый пол

        // Рисуем декорации внутри комнаты (примеры)
        if (room.type === 'classroom') {
          ctx.fillStyle = '#8B4513'; // Коричневый (парты)
          const deskWidth = this.tileSize * 0.6;
          const deskHeight = this.tileSize * 0.4;
          const spacingX = this.tileSize * 1.2;
          const spacingY = this.tileSize * 1.0;
          const margin = this.tileSize * 0.5; // Отступы от стен
          for (let rDesk = 0; rDesk * spacingY + deskHeight + margin * 2 < h; rDesk++) {
            for (let cDesk = 0; cDesk * spacingX + deskWidth + margin * 2 < w; cDesk++) {
              ctx.fillRect(
                x + margin + cDesk * spacingX,
                y + margin + rDesk * spacingY,
                deskWidth,
                deskHeight
              );
            }
          }
        } else if (room.type === 'office') {
          ctx.fillStyle = '#654321'; // Стол
          ctx.fillRect(x + w * 0.2, y + h * 0.3, w * 0.5, h * 0.3);
          ctx.fillStyle = '#333'; // Стул
          ctx.fillRect(x + w * 0.3, y + h * 0.65, w * 0.2, h * 0.2);
        } else {
          // utility
          ctx.fillStyle = '#A0522D'; // Коробки (Sienna)
          ctx.fillRect(x + w * 0.1, y + h * 0.1, w * 0.2, h * 0.2);
          ctx.fillRect(x + w * 0.7, y + h * 0.6, w * 0.2, h * 0.3);
        }
        // Отладочный текст типа комнаты (раскомментировать при необходимости)
        // ctx.fillStyle = 'black';
        // ctx.font = '10px sans-serif';
        // ctx.fillText(`${room.type}`, x + 5, y + 15);
      }
    }

    // --- 3. Рисуем книги поверх всего (кроме персонажа) ---
    for (const book of this.books) {
      // Проверяем, попадает ли книга в видимую область
      const bookScreenX = book.x + this.offsetX;
      const bookScreenY = book.y + this.offsetY;
      if (
        bookScreenX + book.size > 0 &&
        bookScreenX - book.size < ctx.canvas.width &&
        bookScreenY + book.size > 0 &&
        bookScreenY - book.size < ctx.canvas.height
      ) {
        // Вызываем метод отрисовки самой книги
        book.draw(ctx, this.offsetX, this.offsetY, bookImage);
      }
    }
  }
}

class Book {
  constructor(x, y, tileSize) {
    this.x = x;
    this.y = y;
    this.size = tileSize * 0.6;
    this.collected = false; // Можно оставить для промежуточного состояния или убрать
    this.answeredCorrectly = false; // <-- Новый флаг!
  }
  // draw метод остается как был
  draw(ctx, offsetX, offsetY, bookImage = null) {
    // Рисуем только если answeredCorrectly == false (управляется в map.draw)
    const screenX = this.x + offsetX - this.size / 2;
    const screenY = this.y + offsetY - this.size / 2;
    // ... остальная логика отрисовки ...
    if (bookImage && bookImage.complete && bookImage.naturalHeight !== 0) {
      ctx.drawImage(bookImage, screenX, screenY, this.size, this.size);
    } else {
      ctx.fillStyle = 'saddlebrown';
      ctx.fillRect(screenX, screenY, this.size, this.size);
      ctx.fillStyle = 'gold';
      ctx.fillRect(screenX + this.size * 0.2, screenY, this.size * 0.1, this.size);
    }
  }
}
