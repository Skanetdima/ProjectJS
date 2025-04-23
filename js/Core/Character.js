// src/core/Character.js

export class Character {
  /** Static object for direction constants */
  static Direction = {
    DOWN: 0,
    RIGHT: 1,
    UP: 2,
    LEFT: 3,
  };

  /**
   * Creates a new Character instance.
   * @param {CanvasRenderingContext2D} ctx - The rendering context.
   * @param {string} spriteUrl - URL of the character's sprite sheet.
   * @param {object} options - Configuration options.
   * @param {number} [options.frameSize=32] - Size of one frame in the sprite sheet (pixels).
   * @param {number} [options.frameCount=4] - Number of frames per animation cycle (per direction).
   * @param {number} [options.scale=2] - Scaling factor for rendering.
   * @param {number} [options.speed=3] - Movement speed in pixels per update.
   * @param {number} [options.animationSpeed=150] - Milliseconds per animation frame.
   * @param {number} [options.collisionBoxWidthRatio=0.4] - Width of collision box relative to renderSize.
   * @param {number} [options.collisionBoxHeightRatio=0.2] - Height of collision box relative to renderSize.
   * @param {number} [options.collisionBoxFeetOffsetRatio=0.4] - Vertical offset of collision box center from character center (towards feet), relative to renderSize.
   */
  constructor(ctx, spriteUrl, options = {}) {
    this.ctx = ctx;
    this.sprite = new Image();

    // Configuration with defaults
    this.frameSize = options.frameSize || 32;
    this.frameCount = options.frameCount || 4; // Number of frames per direction
    this.scale = options.scale || 2;
    this.renderSize = this.frameSize * this.scale;
    this.speed = options.speed || 3;
    this.animationSpeed = options.animationSpeed || 150; // ms per frame

    // Collision Box Configuration
    this.collisionBoxWidthRatio = options.collisionBoxWidthRatio || 0.4;
    this.collisionBoxHeightRatio = options.collisionBoxHeightRatio || 0.2;
    this.collisionBoxFeetOffsetRatio = options.collisionBoxFeetOffsetRatio || 0.4;

    // State
    this.x = 0; // World X coordinate
    this.y = 0; // World Y coordinate
    this.currentDirection = Character.Direction.DOWN; // Start facing down
    this.currentFrame = 0; // Current animation frame index
    this.isMoving = false; // Is the character currently moving?
    this.lastFrameTime = 0; // Timestamp of the last frame update

    // Load sprite and add handlers
    this.sprite.onload = () => {
      console.log(`[Character] Sprite loaded successfully: ${spriteUrl}`);
    };
    this.sprite.onerror = () => {
      console.error(`[Character] Failed to load sprite: ${spriteUrl}`);
    };
    this.sprite.src = spriteUrl; // Start loading
  }

  /**
   * Updates the character's animation frame based on movement state and time.
   * Should be called in the game's update loop.
   * @param {number} timestamp - The current high-resolution timestamp (e.g., from requestAnimationFrame).
   */
  updateAnimation(timestamp) {
    if (!this.isMoving) {
      this.currentFrame = 0;
      this.lastFrameTime = timestamp;
      return;
    }
    if (!this.lastFrameTime) {
      this.lastFrameTime = timestamp;
    }
    const elapsed = timestamp - this.lastFrameTime;
    if (elapsed > this.animationSpeed) {
      this.currentFrame = (this.currentFrame + 1) % this.frameCount;
      this.lastFrameTime = timestamp;
    }
  }

  /**
   * Calculates the collision bounding box based on a potential position.
   * @param {number} posX - The potential X coordinate for the collision check.
   * @param {number} posY - The potential Y coordinate for the collision check.
   * @returns {{top: number, bottom: number, left: number, right: number, width: number, height: number}} The collision box properties.
   */
  getCollisionBox(posX, posY) {
    const width = this.renderSize * this.collisionBoxWidthRatio;
    const height = this.renderSize * this.collisionBoxHeightRatio;
    const halfWidth = width / 2;
    const feetOffsetY = this.renderSize * this.collisionBoxFeetOffsetRatio;
    const top = posY + feetOffsetY - height / 2;
    const bottom = posY + feetOffsetY + height / 2;
    const left = posX - halfWidth;
    const right = posX + halfWidth;
    return { top, bottom, left, right, width, height };
  }

  /**
   * Draws the character onto the canvas at its current position,
   * considering the camera offset.
   * @param {number} offsetX - The camera's X offset.
   * @param {number} offsetY - The camera's Y offset.
   */
  draw(offsetX, offsetY) {
    if (!this.sprite.complete || this.sprite.naturalHeight === 0) {
      return; // Don't draw if sprite isn't ready
    }
    const frameX = this.currentFrame * this.frameSize;
    const frameY = this.currentDirection * this.frameSize;
    const screenX = Math.floor(this.x - this.renderSize / 2 + offsetX);
    const screenY = Math.floor(this.y - this.renderSize / 2 + offsetY);

    try {
      this.ctx.drawImage(
        this.sprite,
        frameX,
        frameY,
        this.frameSize,
        this.frameSize, // Source rect
        screenX,
        screenY,
        this.renderSize,
        this.renderSize // Dest rect
      );
    } catch (e) {
      console.error('[Character] Error drawing sprite:', e);
    }
  }
}
