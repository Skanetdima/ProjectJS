// src/Core/InputManager.js
export class InputManager {
  constructor() {
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
    };
    // Дополнительно можно добавить флаги для событий, которые должны срабатывать один раз
    // Например, this.actionPressed = false;
  }

  setKey(key, isPressed) {
    if (this.keys.hasOwnProperty(key)) {
      this.keys[key] = isPressed;
      // console.log(`Key ${key} set to ${isPressed}`); // Для отладки
    }
  }

  // Возвращает вектор направления на основе нажатых клавиш
  // (-1, 0, 1 для x и y)
  getInputDirection() {
    let x = 0;
    let y = 0;

    if (this.keys.up) y -= 1;
    if (this.keys.down) y += 1;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;

    // Нормализация диагонального движения (опционально, чтобы скорость была одинаковой)
    // if (x !== 0 && y !== 0) {
    //   const length = Math.sqrt(x * x + y * y);
    //   x = x / length;
    //   y = y / length;
    // }

    return { x, y };
  }

  // Пример для однократного действия
  // isActionPressed() {
  //   return this.keys.action; // Предположим, есть ключ 'action'
  // }
}
