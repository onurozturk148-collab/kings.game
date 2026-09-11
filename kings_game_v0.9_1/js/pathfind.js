// Grid A* pathfinding over the world's terrain, so click-to-move (and NPC
// chase AI) route around water/mountains instead of walking straight into
// them and getting stuck.
window.KINGS = window.KINGS || {};

// Cheap binary min-heap keyed by a numeric field, used for the A* open set.
class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item, key) {
    this.a.push([key, item]);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p][0] <= this.a[i][0]) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = i * 2 + 2;
        let smallest = i;
        if (l < this.a.length && this.a[l][0] < this.a[smallest][0]) smallest = l;
        if (r < this.a.length && this.a[r][0] < this.a[smallest][0]) smallest = r;
        if (smallest === i) break;
        [this.a[smallest], this.a[i]] = [this.a[i], this.a[smallest]];
        i = smallest;
      }
    }
    return top[1];
  }
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];
const MIN_STEP_COST = 1 / 1.4; // fastest terrain (road) — keeps the heuristic admissible

function terrainCost(world, x, y) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return Infinity;
  const mult = KINGS.CONFIG.TERRAIN_SPEED_MULT[world.tiles[y][x]] ?? 1;
  if (mult <= 0) return Infinity;
  return 1 / mult;
}

// Returns an array of {x,y} tile-center waypoints from (sx,sy) to (tx,ty)
// (world/tile coordinates, fractional ok — only the integer tile matters),
// or null if no path exists / the search budget ran out.
function findPath(world, sx, sy, tx, ty, maxNodes = 25000) {
  const sxi = Math.floor(sx), syi = Math.floor(sy);
  const txi = Math.max(0, Math.min(world.w - 1, Math.floor(tx)));
  const tyi = Math.max(0, Math.min(world.h - 1, Math.floor(ty)));
  if (sxi === txi && syi === tyi) return [{ x: txi + 0.5, y: tyi + 0.5 }];
  if (terrainCost(world, txi, tyi) === Infinity) {
    // goal itself is impassable (e.g. clicked on water) — path to the
    // closest reachable neighbour instead of failing outright
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (terrainCost(world, txi + dx, tyi + dy) !== Infinity) { return findPath(world, sx, sy, txi + dx + 0.5, tyi + dy + 0.5, maxNodes); }
    }
    return null;
  }

  const w = world.w;
  const idx = (x, y) => y * w + x;
  const gScore = new Float32Array(w * world.h).fill(Infinity);
  const came = new Int32Array(w * world.h).fill(-1);
  const closed = new Uint8Array(w * world.h);

  const startI = idx(sxi, syi);
  gScore[startI] = 0;
  const open = new MinHeap();
  const heuristic = (x, y) => Math.hypot(x - txi, y - tyi) * MIN_STEP_COST;
  open.push(startI, heuristic(sxi, syi));

  let expanded = 0;
  let found = false;
  while (open.size && expanded < maxNodes) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    expanded++;
    const cx = cur % w, cy = (cur / w) | 0;
    if (cx === txi && cy === tyi) { found = true; break; }

    for (const [dx, dy, base] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= world.h) continue;
      const stepCost = terrainCost(world, nx, ny);
      if (stepCost === Infinity) continue;
      // block cutting diagonally between two impassable corners
      if (dx !== 0 && dy !== 0) {
        if (terrainCost(world, cx + dx, cy) === Infinity && terrainCost(world, cx, cy + dy) === Infinity) continue;
      }
      const ni = idx(nx, ny);
      if (closed[ni]) continue;
      const ng = gScore[cur] + base * stepCost;
      if (ng < gScore[ni]) {
        gScore[ni] = ng;
        came[ni] = cur;
        open.push(ni, ng + heuristic(nx, ny));
      }
    }
  }

  if (!found) return null;

  // reconstruct
  const tilesPath = [];
  let cur = idx(txi, tyi);
  while (cur !== -1) {
    tilesPath.push(cur);
    if (cur === startI) break;
    cur = came[cur];
  }
  tilesPath.reverse();

  const pts = tilesPath.map(i => ({ x: (i % w) + 0.5, y: ((i / w) | 0) + 0.5 }));
  return simplifyPath(world, pts);
}

// Greedy line-of-sight simplification: drop intermediate waypoints that a
// straight line could skip over without crossing impassable terrain — cuts
// the zig-zaggy raw grid path down to a handful of smooth segments.
function simplifyPath(world, pts) {
  if (pts.length <= 2) return pts;
  const out = [pts[0]];
  let anchor = 0;
  for (let i = 2; i < pts.length; i++) {
    if (!lineIsClear(world, pts[anchor], pts[i])) {
      out.push(pts[i - 1]);
      anchor = i - 1;
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function lineIsClear(world, a, b) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.ceil(dist * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(a.x + (b.x - a.x) * t);
    const y = Math.floor(a.y + (b.y - a.y) * t);
    if (terrainCost(world, x, y) === Infinity) return false;
  }
  return true;
}

KINGS.findPath = findPath;
