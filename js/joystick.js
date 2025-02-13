export class Joystick {
  constructor(onMoveCallback) {
    this.onMove = onMoveCallback;
    this.container = document.getElementById('joystick-container');
    this.createJoystick();
    this.setupEventListeners();
    this.isActive = false;
  }

  createJoystick() {
    this.joystickBase = document.createElement('div');
    this.joystickBase.className = 'joystick-base';
    this.joystickHandle = document.createElement('div');
    this.joystickHandle.className = 'joystick-handle';

    Object.assign(this.joystickBase.style, {
      width: '120px',
      height: '120px',
      borderRadius: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      position: 'absolute',
      display: 'none',
    });

    Object.assign(this.joystickHandle.style, {
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      position: 'absolute',
      left: '30px',
      top: '30px',
    });

    this.joystickBase.appendChild(this.joystickHandle);
    this.container.appendChild(this.joystickBase);
  }

  setupEventListeners() {
    const handleStart = (e) => {
      this.isActive = true;
      this.joystickBase.style.display = 'block';
      const rect = this.container.getBoundingClientRect();
      this.baseX = rect.left + 60;
      this.baseY = rect.top + 60;

      this.moveHandle(e);
    };

    const handleMove = (e) => {
      if (!this.isActive) return;
      this.moveHandle(e);
    };

    const handleEnd = () => {
      this.isActive = false;
      this.joystickBase.style.display = 'none';
      this.joystickHandle.style.transform = 'translate(30px, 30px)';
      this.onMove({ x: 0, y: 0 });
    };

    // Mouse events
    this.container.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);

    // Touch events
    this.container.addEventListener('touchstart', (e) => handleStart(e.touches[0]));
    document.addEventListener('touchmove', (e) => handleMove(e.touches[0]));
    document.addEventListener('touchend', handleEnd);
  }

  moveHandle(e) {
    const x = e.clientX - this.baseX;
    const y = e.clientY - this.baseY;
    const distance = Math.sqrt(x * x + y * y);
    const maxDistance = 30; // Увеличиваем радиус движения джойстика

    const angle = Math.atan2(y, x);
    const limitedDistance = Math.min(distance, maxDistance);

    const moveX = limitedDistance * Math.cos(angle);
    const moveY = limitedDistance * Math.sin(angle);

    this.joystickHandle.style.transform = `translate(${moveX + 30}px, ${moveY + 30}px)`;

    const normalizedX = moveX / maxDistance;
    const normalizedY = moveY / maxDistance;
    this.onMove({ x: normalizedX, y: normalizedY });
  }
}
