window.KINGS = window.KINGS || {};

class Camera {
  constructor(world) {
    this.world = world;
    this.x = 0; // tile-space center
    this.y = 0;
    this.tileSize = KINGS.CONFIG.DRAW_TILE;
    this.freeLook = false; // true once the player has manually panned; the
                            // camera then stops auto-following the party
                            // until it moves again (see main.js)
  }
  follow(px, py) {
    this.x = px;
    this.y = py;
  }
  // Manual drag-to-pan (mouse). dxScreen/dyScreen are the pointer's screen
  // movement this frame; the world slides with the drag, like a map app.
  pan(dxScreen, dyScreen) {
    this.x -= dxScreen / this.tileSize;
    this.y -= dyScreen / this.tileSize;
    this.x = Math.max(0, Math.min(this.world.w, this.x));
    this.y = Math.max(0, Math.min(this.world.h, this.y));
    this.freeLook = true;
  }
  zoom(delta) {
    const C = KINGS.CONFIG;
    this.tileSize = Math.max(C.MIN_DRAW_TILE, Math.min(C.MAX_DRAW_TILE, this.tileSize + delta));
  }
  worldToScreen(wx, wy, canvasW, canvasH) {
    const sx = (wx - this.x) * this.tileSize + canvasW / 2;
    const sy = (wy - this.y) * this.tileSize + canvasH / 2;
    return [sx, sy];
  }
  screenToWorld(sx, sy, canvasW, canvasH) {
    const wx = (sx - canvasW / 2) / this.tileSize + this.x;
    const wy = (sy - canvasH / 2) / this.tileSize + this.y;
    return { x: wx, y: wy };
  }
  visibleTileRange(canvasW, canvasH) {
    const tilesX = canvasW / this.tileSize;
    const tilesY = canvasH / this.tileSize;
    const x0 = Math.max(0, Math.floor(this.x - tilesX / 2) - 1);
    const y0 = Math.max(0, Math.floor(this.y - tilesY / 2) - 1);
    const x1 = Math.min(this.world.w - 1, Math.ceil(this.x + tilesX / 2) + 1);
    const y1 = Math.min(this.world.h - 1, Math.ceil(this.y + tilesY / 2) + 1);
    return { x0, y0, x1, y1 };
  }
}

KINGS.Camera = Camera;
