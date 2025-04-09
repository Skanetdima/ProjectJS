// src/Core/Character.js
export class Character {
  constructor(ctx, spriteUrl, options = {}) {
    this.ctx = ctx;
    this.sprite = new Image();
    this.sprite.src = spriteUrl;

    this.frameSize = options.frameSize || 32; // Размер одного кадра в спрайте
    this.scale = options.scale || 2; // Масштаб отрисовки персонажа
    this.renderSize = this.frameSize * this.scale; // Финальный размер на экране
    this.speed = options.speed || 3; // Скорость движения (пикселей за кадр обновления)
    this.animationSpeed = options.animationSpeed || 150; // мс между кадрами анимации

    // Мировые координаты персонажа (инициализируются в Game)
    this.x = 0;
    this.y = 0;

    this.currentDirection = 0; // 0: вниз, 1: вправо, 2: вверх, 3: влево
    this.currentFrame = 0; // Текущий кадр анимации (0-3)
    this.isMoving = false; // Двигается ли персонаж сейчас?
    this.lastFrameTime = Date.now(); // Время последнего обновления кадра анимации
  }

  draw() {
    // Не рисовать, если спрайт еще не загружен
    if (!this.sprite.complete || this.sprite.naturalHeight === 0) {
      console.warn('Sprite not ready for drawing or failed to load:', this.sprite.src);
      return;
    }

    const now = Date.now();

    // Обновляем кадр анимации, только если персонаж двигается
    if (this.isMoving && now - this.lastFrameTime > this.animationSpeed) {
      this.currentFrame = (this.currentFrame + 1) % 4; // Цикл по 4 кадрам (0, 1, 2, 3)
      this.lastFrameTime = now;
    } else if (!this.isMoving) {
      // Если не двигается, остановить анимацию на первом кадре (0)
      this.currentFrame = 0;
    }

    // Определяем координаты нужного кадра в спрайте
    const frameX = this.currentFrame * this.frameSize;
    // В спрайте строки соответствуют направлениям: 0-вниз, 1-вправо, 2-вверх, 3-влево
    const frameY = this.currentDirection * this.frameSize;

    // Персонаж всегда рисуется в центре экрана,
    // так как камера (смещение карты) следует за ним
    const screenX = this.ctx.canvas.width / 2 - this.renderSize / 2;
    const screenY = this.ctx.canvas.height / 2 - this.renderSize / 2;

    // Рисуем текущий кадр персонажа на канвас
    this.ctx.drawImage(
      this.sprite, // Исходное изображение (спрайт)
      frameX, // X координата кадра в спрайте
      frameY, // Y координата кадра в спрайте
      this.frameSize, // Ширина кадра в спрайте
      this.frameSize, // Высота кадра в спрайте
      screenX, // X координата на канвасе (центр)
      screenY, // Y координата на канвасе (центр)
      this.renderSize, // Ширина отрисовки на канвасе
      this.renderSize // Высота отрисовки на канвасе
    );
  }
}
