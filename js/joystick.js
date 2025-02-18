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
      transform: 'translate(-50%, -50%)', // Center the base perfectly
    });

    Object.assign(this.joystickHandle.style, {
      width: '60px',
      height: '60px',
      borderRadius: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)', // Center the handle initially
    });

    this.joystickBase.appendChild(this.joystickHandle);
    this.container.appendChild(this.joystickBase);
  }

  setupEventListeners() {
    const handleStart = (e) => {
      e.preventDefault();
      this.isActive = true;
      this.joystickBase.style.display = 'block';
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      // Position joystick base at touch point
      this.joystickBase.style.left = `${clientX}px`;
      this.joystickBase.style.top = `${clientY}px`;

      // Store center position (same as base position due to transform)
      this.baseX = clientX;
      this.baseY = clientY;

      this.moveHandle(e);
    };

    const handleMove = (e) => {
      if (!this.isActive) return;
      e.preventDefault();
      this.moveHandle(e);
    };

    const handleEnd = () => {
      this.isActive = false;
      this.joystickBase.style.display = 'none';
      this.joystickHandle.style.transform = 'translate(-50%, -50%)';
      this.onMove({ x: 0, y: 0 });
    };

    // Mouse events
    this.container.addEventListener('mousedown', handleStart);
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);

    // Touch events
    this.container.addEventListener('touchstart', handleStart, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  }

  moveHandle(e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - this.baseX;
    const y = clientY - this.baseY;
    const distance = Math.sqrt(x * x + y * y);
    const maxDistance = 60; // Matches the joystick base radius

    const angle = Math.atan2(y, x);
    const limitedDistance = Math.min(distance, maxDistance);

    const moveX = limitedDistance * Math.cos(angle);
    const moveY = limitedDistance * Math.sin(angle);

    this.joystickHandle.style.transform = `translate(${moveX}px, ${moveY}px) translate(-50%, -50%)`;

    const normalizedX = moveX / maxDistance;
    const normalizedY = moveY / maxDistance;
    this.onMove({ x: normalizedX, y: normalizedY });
  }
}