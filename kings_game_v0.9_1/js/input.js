window.KINGS = window.KINGS || {};

class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set(); // survives a same-frame keydown+keyup so quick taps aren't missed
    this.joystick = { active: false, baseX: 0, baseY: 0, curX: 0, curY: 0, pointerId: null };
    this.joyRadius = 54;
    this.taps = []; // {x,y} queue of quick taps (pointerdown+up with little movement)
    this.suppressJoystick = false; // true on title/modal screens: taps only, no stick
    this.pointers = new Map(); // active pointerId -> {x,y}, used for pinch-to-zoom
    this._pinchPrevDist = null;
    this._pinchAccum = 0;
    this._wheelAccum = 0;
    this._mouseDown = null;
    this._mouseDragging = false;
    this._panAccum = { x: 0, y: 0 };
    this.dragThreshold = 6; // px before a mouse click becomes a camera pan
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      this.keys.add(k);
      this.justPressed.add(k);
      if (e.key === ' ') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    const cv = this.canvas;

    const posOf = (e) => {
      const rect = cv.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const pinchDist = () => {
      const pts = [...this.pointers.values()];
      if (pts.length < 2) return null;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };
    const startJoystick = (id, x, y) => {
      this.joystick = { active: true, baseX: x, baseY: y, curX: x, curY: y, pointerId: id, moved: false };
    };

    // Mouse: a plain click (down+up near the same spot) is a "tap" — used
    // both for UI buttons and for "walk to this point on the map". No
    // drag-joystick for mouse; that's a touch-only control.
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return; // ignore right/middle click
        const { x, y } = posOf(e);
        this._mouseDown = { x, y };
        this._mouseLast = { x, y };
        this._mouseDragging = false;
        return;
      }
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* not a real active pointer (e.g. synthetic event) */ }
      const { x, y } = posOf(e);
      this.pointers.set(e.pointerId, { x, y });
      if (this.pointers.size === 1) {
        startJoystick(e.pointerId, x, y);
      } else if (this.pointers.size === 2) {
        // second finger down: switch from move-stick to pinch-zoom
        this.joystick.active = false;
        this._pinchPrevDist = pinchDist();
      }
    });

    cv.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        if (!this._mouseDown) return;
        const { x, y } = posOf(e);
        if (!this._mouseDragging) {
          const total = Math.hypot(x - this._mouseDown.x, y - this._mouseDown.y);
          if (total > this.dragThreshold) this._mouseDragging = true;
        }
        if (this._mouseDragging) {
          this._panAccum.x += x - this._mouseLast.x;
          this._panAccum.y += y - this._mouseLast.y;
        }
        this._mouseLast = { x, y };
        return;
      }
      if (!this.pointers.has(e.pointerId)) return;
      const { x, y } = posOf(e);
      this.pointers.set(e.pointerId, { x, y });

      if (this.pointers.size >= 2) {
        const d = pinchDist();
        if (this._pinchPrevDist != null && d != null) {
          this._pinchAccum += (d - this._pinchPrevDist);
        }
        this._pinchPrevDist = d;
        return;
      }

      if (!this.joystick.active || e.pointerId !== this.joystick.pointerId) return;
      const dx = x - this.joystick.baseX, dy = y - this.joystick.baseY;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) this.joystick.moved = true;
      let cx = x, cy = y;
      if (dist > this.joyRadius) {
        const s = this.joyRadius / dist;
        cx = this.joystick.baseX + dx * s;
        cy = this.joystick.baseY + dy * s;
      }
      this.joystick.curX = cx;
      this.joystick.curY = cy;
    });

    const end = (e) => {
      if (e.pointerType === 'mouse') {
        if (e.button !== 0 && e.type !== 'pointercancel') return;
        if (this._mouseDown && !this._mouseDragging) {
          this.taps.push({ x: this._mouseDown.x, y: this._mouseDown.y });
        }
        this._mouseDown = null;
        this._mouseDragging = false;
        return;
      }
      const wasTracked = this.pointers.has(e.pointerId);
      this.pointers.delete(e.pointerId);

      if (this.joystick.pointerId === e.pointerId) {
        if (!this.joystick.moved && wasTracked) {
          this.taps.push({ x: this.joystick.baseX, y: this.joystick.baseY });
        }
        this.joystick.active = false;
        this.joystick.pointerId = null;
      }

      if (this.pointers.size < 2) this._pinchPrevDist = null;
      if (this.pointers.size === 1) {
        // one finger remains after a pinch: resume the move-stick from here
        const [[id, p]] = this.pointers;
        startJoystick(id, p.x, p.y);
      }
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._wheelAccum += -e.deltaY;
    }, { passive: false });
  }

  // Call once per frame; returns and clears accumulated zoom deltas.
  consumeZoomDelta() {
    const C = KINGS.CONFIG;
    let delta = 0;
    if (this._wheelAccum) {
      delta += this._wheelAccum * C.WHEEL_ZOOM_SENSITIVITY;
      this._wheelAccum = 0;
    }
    if (this._pinchAccum) {
      delta += this._pinchAccum * C.PINCH_ZOOM_SENSITIVITY;
      this._pinchAccum = 0;
    }
    return delta;
  }

  // Call once per frame; returns and clears the accumulated mouse-drag pan
  // delta (screen px). {x:0,y:0} when nothing was dragged this frame.
  consumePanDelta() {
    const d = this._panAccum;
    this._panAccum = { x: 0, y: 0 };
    return d;
  }

  getMoveVector() {
    let x = 0, y = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (x !== 0 || y !== 0) {
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    }
    if (this.joystick.active) {
      const dx = this.joystick.curX - this.joystick.baseX;
      const dy = this.joystick.curY - this.joystick.baseY;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        const mag = Math.min(1, dist / this.joyRadius);
        return { x: (dx / dist) * mag, y: (dy / dist) * mag };
      }
    }
    return { x: 0, y: 0 };
  }

  consumeKeyPress(key) {
    if (this.justPressed.has(key)) { this.justPressed.delete(key); return true; }
    return false;
  }
}

KINGS.Input = Input;
