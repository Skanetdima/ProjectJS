import { ProceduralMap } from './ProceduralMap.js';

export class Level {
  constructor(levelsConfig) {
    this.levels = levelsConfig;
    this.currentFloor = 2; // Начинаем со 2-го этажа
    this.currentMap = null;
    this.transitionZones = [];
  }

  async load(width, height) {
    await this.loadFloor(this.currentFloor, width, height);
  }

  async loadFloor(floorNumber, width, height) {
    const floorConfig = this.levels.find(f => f.floor === floorNumber);
    if (!floorConfig) throw new Error(`Floor ${floorNumber} config not found`);
    // Генерируем карту для данного этажа
    this.currentMap = new ProceduralMap(width, height);
    this.transitionZones = floorConfig.transitionZones || [];
    this.currentFloor = floorNumber;
  }

  getCurrentTransitionZone(x, y) {
    return this.transitionZones.find(zone =>
      x >= zone.x && x <= zone.x + zone.width &&
      y >= zone.y && y <= zone.y + zone.height
    );
  }
}
