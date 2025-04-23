// src/core/InputManager.js
export class InputManager {
  constructor() {
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false,
    };
  }

  setKey(key, isPressed) {
    if (this.keys.hasOwnProperty(key)) {
      this.keys[key] = isPressed;
    }
  }

  getInputDirection() {
    let x = 0;
    let y = 0;
    if (this.keys.up) y -= 1;
    if (this.keys.down) y += 1;
    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;
    return { x, y };
  }
}
