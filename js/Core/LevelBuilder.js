export class LevelBuilder {
  constructor() {
    this.walls = [];
    this.decorations = [];
  }

  addPolygon(points, isWall = true) {
    const shape = {
      type: 'polygon',
      points: points.map(p => ({ x: p[0], y: p[1] })),
      isWall
    };
    if (isWall) {
      this.walls.push(shape);
    } else {
      this.decorations.push(shape);
    }
    return this;
  }

  addRectangle(x, y, width, height, isWall = true) {
    const points = [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height]
    ];
    return this.addPolygon(points, isWall);
  }

  build() {
    return {
      walls: this.walls,
      decorations: this.decorations,
      collisionMap: this.generateCollisionMap()
    };
  }

  generateCollisionMap() {
    return this.walls.map(wall => ({
      type: 'polygon',
      points: wall.points
    }));
  }
}