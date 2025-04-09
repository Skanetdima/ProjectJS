// src/Core/Level.js
import { ProceduralMap } from './ProceduralMap.js';

export class Level {
  constructor(minFloor = 1, maxFloor = 3) {
    // Задаем диапазон этажей
    this.minFloor = minFloor;
    this.maxFloor = maxFloor;
    this.currentFloor = minFloor; // Начинаем с первого этажа
    this.currentMap = null; // Текущая загруженная карта (ProceduralMap)
    this.transitionZones = []; // Массив активных зон перехода на текущем этаже
  }

  // Асинхронно загружает (генерирует) карту для указанного этажа
  async loadFloor(floorNumber, canvasWidth, canvasHeight) {
    // Проверяем, входит ли запрашиваемый этаж в допустимый диапазон
    if (floorNumber < this.minFloor || floorNumber > this.maxFloor) {
      console.error(
        `Attempted to load invalid floor: ${floorNumber}. Allowed range: [${this.minFloor}-${this.maxFloor}]`
      );
      throw new Error(`Invalid floor number: ${floorNumber}`);
    }

    console.log(`Loading floor ${floorNumber}...`);
    this.currentFloor = floorNumber; // Устанавливаем текущий этаж

    // Создаем новый экземпляр ProceduralMap для этого этажа
    // Генерация происходит внутри конструктора ProceduralMap
    this.currentMap = new ProceduralMap(canvasWidth, canvasHeight);

    // Очищаем старые зоны перехода
    this.transitionZones = [];

    // Получаем информацию о лестницах со сгенерированной карты
    const stairs = this.currentMap.stairs;
    const tileSize = this.currentMap.tileSize;

    // Создаем зону перехода ВНИЗ, если лестница вниз существует И это не самый нижний этаж
    if (stairs.down && floorNumber > this.minFloor) {
      this.transitionZones.push({
        x: stairs.down.x - tileSize / 2, // Левый верхний угол тайла
        y: stairs.down.y - tileSize / 2,
        width: tileSize,
        height: tileSize,
        type: 'stairs_down', // Тип зоны (соответствует типу лестницы)
        targetFloor: floorNumber - 1, // Куда ведет эта зона
      });
      console.log(
        `  Added transition zone: DOWN to floor ${floorNumber - 1} at world coords (${
          stairs.down.x
        }, ${stairs.down.y})`
      );
    }

    // Создаем зону перехода ВВЕРХ, если лестница вверх существует И это не самый верхний этаж
    if (stairs.up && floorNumber < this.maxFloor) {
      this.transitionZones.push({
        x: stairs.up.x - tileSize / 2, // Левый верхний угол тайла
        y: stairs.up.y - tileSize / 2,
        width: tileSize,
        height: tileSize,
        type: 'stairs_up', // Тип зоны
        targetFloor: floorNumber + 1, // Куда ведет эта зона
      });
      console.log(
        `  Added transition zone: UP to floor ${floorNumber + 1} at world coords (${stairs.up.x}, ${
          stairs.up.y
        })`
      );
    }

    console.log(
      `Floor ${floorNumber} loaded. ${this.transitionZones.length} transition zones active.`
    );
    // Дожидаться загрузки ресурсов карты не нужно, т.к. генерация синхронна
    // и текстуры (если будут) грузятся отдельно.
    return Promise.resolve(); // Возвращаем промис для совместимости с async/await
  }

  // Находит зону перехода, в которой находятся указанные мировые координаты
  getCurrentTransitionZone(x, y) {
    // Проверяем попадание точки (x, y) в прямоугольник каждой зоны
    return this.transitionZones.find(
      (zone) =>
        x >= zone.x &&
        x < zone.x + zone.width && // Используем < для width/height
        y >= zone.y &&
        y < zone.y + zone.height
    );
  }

  // Метод для получения всех книг с текущей карты
  getCurrentBooks() {
    return this.currentMap ? this.currentMap.books : [];
  }
}
