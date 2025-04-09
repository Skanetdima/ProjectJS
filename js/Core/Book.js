export class Book {
  constructor(x, y, tileSize) {
    this.x = x; // Мировые координаты центра книги
    this.y = y;
    this.size = tileSize * 0.6; // Размер для отрисовки и проверки сбора
    this.collected = false; // Собрана ли книга?
    // Можно добавить ID, тип, очки и т.д. в будущем
  }

  // Метод для отрисовки книги
  draw(ctx, offsetX, offsetY, bookImage = null) {
    if (this.collected) return; // Не рисовать собранные книги

    // Рассчитываем экранные координаты с учетом смещения камеры
    const screenX = this.x + offsetX - this.size / 2;
    const screenY = this.y + offsetY - this.size / 2;

    // Если есть загруженное изображение книги, используем его
    if (bookImage && bookImage.complete && bookImage.naturalHeight !== 0) {
      ctx.drawImage(bookImage, screenX, screenY, this.size, this.size);
    } else {
      // Placeholder: рисуем простой коричневый прямоугольник, если нет текстуры
      ctx.fillStyle = 'saddlebrown';
      ctx.fillRect(screenX, screenY, this.size, this.size);
      // Добавим золотую деталь для имитации переплета
      ctx.fillStyle = 'gold';
      ctx.fillRect(screenX + this.size * 0.2, screenY, this.size * 0.1, this.size);
    }
  }
}
