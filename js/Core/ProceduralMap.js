export class ProceduralMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.tileSize = 32;
    this.offsetX = 0;
    this.offsetY = 0;
    this.offices = []; // Для хранения информации об офисных зонах
    this.cols = Math.floor(this.width / this.tileSize);
    this.rows = Math.floor(this.height / this.tileSize);
    // Генерируем план с офисами и коридорами
    this.map = this.generateMultiOfficePlan(this.rows, this.cols);
  }

  generateMultiOfficePlan(rows, cols) {
    // Параметры сетки офисов
    const corridorThickness = 2;
    const numOfficeRows = 3;
    const numOfficeCols = 4;
    const totalHorizontalCorridors = numOfficeRows + 1;
    const totalVerticalCorridors = numOfficeCols + 1;
    const officeRegionHeight = Math.floor((rows - totalHorizontalCorridors * corridorThickness) / numOfficeRows);
    const officeRegionWidth = Math.floor((cols - totalVerticalCorridors * corridorThickness) / numOfficeCols);

    // Изначально заполняем всю карту стенами (1)
    const map = Array.from({ length: rows }, () => Array(cols).fill(1));

    // Заполняем горизонтальные коридоры
    let currentRow = 0;
    for (let rOffice = 0; rOffice <= numOfficeRows; rOffice++) {
      for (let r = currentRow; r < currentRow + corridorThickness && r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          map[r][c] = 0; // коридор
        }
      }
      currentRow += corridorThickness;
      if (rOffice < numOfficeRows) {
        currentRow += officeRegionHeight;
      }
    }

    // Заполняем вертикальные коридоры
    let currentCol = 0;
    for (let cOffice = 0; cOffice <= numOfficeCols; cOffice++) {
      for (let c = currentCol; c < currentCol + corridorThickness && c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          map[r][c] = 0; // коридор
        }
      }
      currentCol += corridorThickness;
      if (cOffice < numOfficeCols) {
        currentCol += officeRegionWidth;
      }
    }

    // Заполняем офисные зоны уникальными кодами (начиная с 2)
    this.offices = []; // сбрасываем массив офисов
    let officeType = 2;
    currentRow = corridorThickness;
    for (let rOffice = 0; rOffice < numOfficeRows; rOffice++) {
      currentCol = corridorThickness;
      for (let cOffice = 0; cOffice < numOfficeCols; cOffice++) {
        // Сохраняем границы офисной зоны (в клетках)
        const officeRegion = {
          type: officeType,
          row: currentRow,
          col: currentCol,
          height: officeRegionHeight,
          width: officeRegionWidth
        };
        this.offices.push(officeRegion);

        // Заполняем регион офисным типом
        for (let r = currentRow; r < currentRow + officeRegionHeight && r < rows; r++) {
          for (let c = currentCol; c < currentCol + officeRegionWidth && c < cols; c++) {
            map[r][c] = officeType;
          }
        }
        officeType++;
        currentCol += officeRegionWidth + corridorThickness;
      }
      currentRow += officeRegionHeight + corridorThickness;
    }

    return map;
  }

  // Проверка проходимости: проходимы ячейки, не равные стене (1)
  isWalkable(x, y) {
    const col = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return false;
    return this.map[row][col] !== 1;
  }

  draw(ctx) {
    // Рисуем базовую карту
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.map[r][c];
        if (cell === 0) {
          ctx.fillStyle = '#aaa'; // коридор
        } else if (cell === 1) {
          ctx.fillStyle = '#222'; // стена
        } else {
          // Офис: общий фон для офисов
          ctx.fillStyle = '#ccc';
        }
        ctx.fillRect(
          c * this.tileSize + this.offsetX,
          r * this.tileSize + this.offsetY,
          this.tileSize,
          this.tileSize
        );
      }
    }

    // Рисуем простейшую мебель (например, стол и компьютер) для каждого офиса
    for (const office of this.offices) {
      // Вычисляем положение центра офисной области в пикселях
      const x = office.col * this.tileSize + this.offsetX;
      const y = office.row * this.tileSize + this.offsetY;
      const w = office.width * this.tileSize;
      const h = office.height * this.tileSize;
      // Рисуем стол (прямоугольник посередине офиса)
      ctx.fillStyle = '#555';
      ctx.fillRect(x + w * 0.2, y + h * 0.2, w * 0.6, h * 0.3);
      // Рисуем компьютер (маленький прямоугольник справа от стола)
      ctx.fillStyle = '#0f0';
      ctx.fillRect(x + w * 0.8, y + h * 0.2, w * 0.15, h * 0.15);
    }
  }
}
