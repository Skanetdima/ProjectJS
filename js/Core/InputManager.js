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
    return {
      x: (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0),
      y: (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0),
    };
  }
}
