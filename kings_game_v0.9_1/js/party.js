window.KINGS = window.KINGS || {};

class Party {
  constructor(x, y, name) {
    this.x = x;
    this.y = y;
    this.name = name || 'Oyuncu Ordusu';
    this.facing = 1; // 1 = right, -1 = left (sprite flip)
    this.moving = false;

    this.path = null;        // array of {x,y} waypoints, or null
    this.pathIndex = 0;
    this.enterOnArrive = null; // settlement id to auto-open once we arrive there

    this.attackTargetId = null;  // bandit NPC id we're pursuing to attack
    this.attackRepathTimer = 0;

    const C = KINGS.CONFIG;
    this.gold = C.START_GOLD;
    this.army = { infantry: C.START_TROOPS, archer: 0, cavalry: 0 };
    this.inventory = {};
    for (const g of [...C.GOODS, ...C.LOOT_GOODS]) this.inventory[g.id] = 0;

    this.captive = false;
    this.captiveTimer = 0;
  }

  get troops() {
    return this.army.infantry + this.army.archer + this.army.cavalry;
  }

  currentTerrain(world) {
    const tx = Math.max(0, Math.min(world.w - 1, Math.floor(this.x)));
    const ty = Math.max(0, Math.min(world.h - 1, Math.floor(this.y)));
    return world.tiles[ty][tx];
  }

  // Paths to (x,y) using A*; falls back to a direct-line "best effort" walk
  // if no path is found (e.g. an unreachable island) so the party doesn't
  // just do nothing.
  goTo(world, x, y, enterSettlementId) {
    const path = KINGS.findPath(world, this.x, this.y, x, y);
    this.path = path && path.length ? path : [{ x, y }];
    this.pathIndex = 0;
    this.enterOnArrive = enterSettlementId || null;
  }

  clearDestination() {
    this.path = null;
    this.pathIndex = 0;
    this.enterOnArrive = null;
  }

  hasDestination() {
    return !!(this.path && this.pathIndex < this.path.length);
  }

  // Tries to move by (dx, dy) tiles this frame; blocks per-axis on
  // impassable terrain so the party slides along coastlines/mountains
  // instead of getting fully stuck (feels much better to control).
  tryMove(world, dx, dy) {
    const C = KINGS.CONFIG;
    const speedAt = (x, y) => {
      const tx = Math.max(0, Math.min(world.w - 1, Math.floor(x)));
      const ty = Math.max(0, Math.min(world.h - 1, Math.floor(y)));
      const terrain = world.tiles[ty][tx];
      return C.TERRAIN_SPEED_MULT[terrain] ?? 1;
    };
    const margin = 0.28; // keep party center off tile edges so it reads as "inside" a tile
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (dx !== 0) {
      const mult = speedAt(nx, this.y);
      if (mult > 0 && nx > margin && nx < world.w - margin) this.x = nx;
    }
    if (dy !== 0) {
      const mult = speedAt(this.x, ny);
      if (mult > 0 && ny > margin && ny < world.h - margin) this.y = ny;
    }
  }
}

KINGS.Party = Party;
