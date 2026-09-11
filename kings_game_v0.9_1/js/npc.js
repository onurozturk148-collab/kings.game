// Wandering NPC parties: merchant caravans that hop between settlements
// trading, lords with their own small armies patrolling their kingdom's
// territory, and bandits that roam and chase down traders and the player.
window.KINGS = window.KINGS || {};

const TRADER_TITLES = ['Tüccar', 'Kervancı', 'Sırt Çantalı Satıcı'];
const LORD_TITLES = ['Bey', 'Sipahi', 'Şövalye'];
const BANDIT_TITLES = ['Kaçakçı', 'Haydut', 'Yol Kesici'];

class NPCParty {
  constructor(x, y, type, name, kingdom) {
    this.id = null; // assigned by generateNPCs / spawnCaravan — stable across the NPC's lifetime
    this.x = x; this.y = y;
    this.type = type; // 'trader' | 'lord' | 'bandit' | 'caravan'
    this.name = name;
    this.kingdom = kingdom || null;
    this.owner = null; // 'player' for caravans the player bought
    this.destSettlement = null;
    this.state = 'traveling'; // 'traveling' | 'paused' | 'roaming' | 'chasing'
    this.pauseTimer = 0;
    this.facing = 1;
    this.moving = false;
    this.troops = 0;
    this.path = null;
    this.pathIndex = 0;
    this.homeX = x; this.homeY = y;
    this.repathTimer = 0;
    this.contactCooldown = 0; // bandits only: brief grace period after hitting the player
    this.alive = true;
  }
}

function pickDestination(rand, settlements, excludeId, kingdom) {
  let pool = settlements;
  if (kingdom) {
    const owned = settlements.filter(s => s.kingdom && s.kingdom.id === kingdom.id);
    if (owned.length > 1) pool = owned;
  }
  let choice = pool[Math.floor(rand() * pool.length)];
  let tries = 0;
  while (choice && choice.id === excludeId && tries < 10) {
    choice = pool[Math.floor(rand() * pool.length)];
    tries++;
  }
  return choice;
}

function randomLandPointNear(world, rand, cx, cy, radius) {
  for (let tries = 0; tries < 20; tries++) {
    const ang = rand() * Math.PI * 2;
    const dist = rand() * radius;
    const x = Math.round(cx + Math.cos(ang) * dist);
    const y = Math.round(cy + Math.sin(ang) * dist);
    if (KINGS.isLand(world, x, y)) return { x: x + 0.5, y: y + 0.5 };
  }
  return { x: cx, y: cy };
}

function generateNPCs(world, settlements, seed) {
  const rand = KINGS.mulberry32(seed + 31337);
  const C = KINGS.CONFIG;
  const names = KINGS.NPC_FIRST_NAMES;
  const npcs = [];
  let nextId = 0;

  for (let i = 0; i < C.NPC.TRADER_COUNT; i++) {
    const home = settlements[Math.floor(rand() * settlements.length)];
    const dest = pickDestination(rand, settlements, home.id, null);
    const name = `${names[Math.floor(rand() * names.length)]} (${TRADER_TITLES[Math.floor(rand() * TRADER_TITLES.length)]})`;
    const n = new NPCParty(home.x + 0.5, home.y + 0.5, 'trader', name, null);
    n.id = nextId++;
    n.destSettlement = dest;
    npcs.push(n);
  }

  for (let i = 0; i < C.NPC.LORD_COUNT; i++) {
    const kingdom = C.KINGDOMS[i % C.KINGDOMS.length];
    const owned = settlements.filter(s => s.kingdom && s.kingdom.id === kingdom.id);
    const home = (owned.length ? owned : settlements)[Math.floor(rand() * (owned.length ? owned.length : settlements.length))];
    const dest = pickDestination(rand, settlements, home.id, kingdom);
    const name = `${names[Math.floor(rand() * names.length)]} ${LORD_TITLES[Math.floor(rand() * LORD_TITLES.length)]}`;
    const n = new NPCParty(home.x + 0.5, home.y + 0.5, 'lord', name, kingdom);
    n.id = nextId++;
    n.destSettlement = dest;
    n.troops = C.NPC.LORD_MIN_TROOPS + Math.floor(rand() * (C.NPC.LORD_MAX_TROOPS - C.NPC.LORD_MIN_TROOPS));
    npcs.push(n);
  }

  for (let i = 0; i < C.NPC.BANDIT_COUNT; i++) {
    const home = settlements[Math.floor(rand() * settlements.length)];
    // spawn a little away from the settlement itself, not right on top of it
    const spot = randomLandPointNear(world, rand, home.x, home.y, C.NPC.BANDIT_ROAM_RADIUS);
    const name = `${names[Math.floor(rand() * names.length)]} ${BANDIT_TITLES[Math.floor(rand() * BANDIT_TITLES.length)]}`;
    const n = new NPCParty(spot.x, spot.y, 'bandit', name, null);
    n.id = nextId++;
    n.homeX = spot.x; n.homeY = spot.y;
    n.state = 'roaming';
    n.troops = C.NPC.BANDIT_MIN_TROOPS + Math.floor(rand() * (C.NPC.BANDIT_MAX_TROOPS - C.NPC.BANDIT_MIN_TROOPS));
    npcs.push(n);
  }

  return npcs;
}

// Advances `entity` (anything with x/y/path/pathIndex/facing/moving) along
// its current path by up to `step` tiles this frame. Returns true once the
// path is fully consumed (arrived).
function advanceAlongPath(entity, world, step) {
  if (!entity.path || entity.pathIndex >= entity.path.length) { entity.moving = false; return true; }
  entity.moving = true;
  let remaining = step;
  while (remaining > 0 && entity.pathIndex < entity.path.length) {
    const wp = entity.path[entity.pathIndex];
    const ddx = wp.x - entity.x, ddy = wp.y - entity.y;
    const dist = Math.hypot(ddx, ddy);
    if (dist < 1e-4) { entity.pathIndex++; continue; }
    if (dist <= remaining) {
      entity.x = wp.x; entity.y = wp.y;
      remaining -= dist;
      entity.pathIndex++;
    } else {
      const dirx = ddx / dist, diry = ddy / dist;
      if (dirx !== 0) entity.facing = dirx > 0 ? 1 : -1;
      entity.x += dirx * remaining;
      entity.y += diry * remaining;
      remaining = 0;
    }
  }
  const arrived = entity.pathIndex >= entity.path.length;
  if (arrived) entity.moving = false;
  return arrived;
}

function terrainSpeedAt(world, x, y) {
  const tx = Math.max(0, Math.min(world.w - 1, Math.floor(x)));
  const ty = Math.max(0, Math.min(world.h - 1, Math.floor(y)));
  return Math.max(KINGS.CONFIG.TERRAIN_SPEED_MULT[world.tiles[ty][tx]] ?? 1, 0.2);
}

// Updates one NPC. `player` is KINGS.game.party. Returns a small signal
// object — {attackPlayer:true} when a bandit has just made contact with
// the player — or null.
function updateNPC(npc, world, settlements, player, npcs, simDt, rand) {
  const C = KINGS.CONFIG;
  if (!npc.alive) return null;

  if (npc.type === 'bandit') return updateBandit(npc, world, player, npcs, simDt, rand);

  if (npc.state === 'paused') {
    npc.moving = false;
    npc.pauseTimer -= simDt;
    if (npc.pauseTimer <= 0) {
      const next = pickDestination(rand, settlements, npc.destSettlement ? npc.destSettlement.id : null, npc.kingdom);
      npc.destSettlement = next;
      npc.path = KINGS.findPath(world, npc.x, npc.y, next.x + 0.5, next.y + 0.5) || [{ x: next.x + 0.5, y: next.y + 0.5 }];
      npc.pathIndex = 0;
      npc.state = 'traveling';
    }
    return null;
  }

  if (!npc.path) {
    const target = npc.destSettlement;
    if (!target) { npc.state = 'paused'; npc.pauseTimer = 2; return null; }
    npc.path = KINGS.findPath(world, npc.x, npc.y, target.x + 0.5, target.y + 0.5) || [{ x: target.x + 0.5, y: target.y + 0.5 }];
    npc.pathIndex = 0;
  }

  const speed = (npc.type === 'trader' ? C.NPC.TRADER_SPEED : npc.type === 'caravan' ? C.NPC.CARAVAN_SPEED : C.NPC.LORD_SPEED) * terrainSpeedAt(world, npc.x, npc.y);
  const arrived = advanceAlongPath(npc, world, speed * simDt);
  if (arrived) {
    npc.path = null;
    npc.state = 'paused';
    const [lo, hi] = C.NPC.PAUSE_AT_STOP;
    npc.pauseTimer = lo + rand() * (hi - lo);
    if (npc.owner === 'player') {
      // a player-owned caravan just "traded" at a stop — pay out a little
      // passive gold, scaled to how many troops (how much was invested)
      const [plo, phi] = C.CARAVAN.PROFIT_PER_TROOP;
      const profit = Math.round(npc.troops * (plo + rand() * (phi - plo)));
      return { caravanProfit: profit };
    }
  }
  return null;
}

function updateBandit(npc, world, player, npcs, simDt, rand) {
  const C = KINGS.CONFIG;

  // A short cooldown after making contact with the player — without it, a
  // bandit that just fought you (or is standing right next to you the
  // instant you escape captivity) would re-detect you and re-trigger a
  // battle on literally the very next frame, since it's still adjacent.
  npc.contactCooldown = Math.max(0, (npc.contactCooldown || 0) - simDt);

  // look for something to chase: the player, or the nearest trader
  if (npc.state !== 'chasing') {
    let target = null, bestD = C.NPC.BANDIT_AGGRO_RADIUS;
    const pd = Math.hypot(player.x - npc.x, player.y - npc.y);
    if (!player.captive && npc.contactCooldown <= 0 && pd < bestD) { target = player; bestD = pd; }
    for (const other of npcs) {
      if ((other.type !== 'trader' && other.type !== 'caravan') || !other.alive) continue;
      const d = Math.hypot(other.x - npc.x, other.y - npc.y);
      if (d < bestD) { target = other; bestD = d; }
    }
    if (target) {
      npc.state = 'chasing';
      npc.chaseTarget = target;
      npc.path = null;
      npc.repathTimer = 0;
    }
  }

  if (npc.state === 'chasing') {
    const target = npc.chaseTarget;
    const stillValid = target === player ? !player.captive : target.alive;
    const d = target ? Math.hypot(target.x - npc.x, target.y - npc.y) : Infinity;
    if (!target || !stillValid || d > C.NPC.BANDIT_AGGRO_RADIUS * 1.6) {
      npc.state = 'roaming'; npc.path = null; npc.chaseTarget = null;
    } else if (d < C.NPC.BANDIT_CONTACT_DIST) {
      npc.moving = false;
      if (target === player) {
        // whatever the fight's outcome turns out to be, this bandit backs
        // off for a while afterward instead of instantly re-engaging
        npc.state = 'roaming'; npc.path = null; npc.chaseTarget = null;
        npc.contactCooldown = 6 + rand() * 6;
        return { attackPlayer: true, bandit: npc };
      }
      // caught a trader: a quick, silent "robbery" — the trader stops to
      // recover for a while instead of a full battle UI the player never
      // sees, then carries on with its route
      target.state = 'paused';
      target.path = null;
      target.pauseTimer = 6 + rand() * 6;
      npc.state = 'roaming'; npc.path = null; npc.chaseTarget = null;
    } else {
      npc.repathTimer -= simDt;
      if (npc.repathTimer <= 0 || !npc.path) {
        npc.path = KINGS.findPath(world, npc.x, npc.y, target.x, target.y) || null;
        npc.pathIndex = 0;
        npc.repathTimer = 1.2;
      }
      if (npc.path) {
        const speed = C.NPC.BANDIT_SPEED * terrainSpeedAt(world, npc.x, npc.y);
        advanceAlongPath(npc, world, speed * simDt);
      } else {
        npc.moving = false;
      }
    }
    return null;
  }

  // roaming / paused
  if (npc.state === 'paused') {
    npc.moving = false;
    npc.pauseTimer -= simDt;
    if (npc.pauseTimer <= 0) npc.state = 'roaming';
    return null;
  }

  if (!npc.path) {
    const spot = randomLandPointNear(world, rand, npc.homeX, npc.homeY, C.NPC.BANDIT_ROAM_RADIUS);
    npc.path = KINGS.findPath(world, npc.x, npc.y, spot.x, spot.y) || [{ x: spot.x, y: spot.y }];
    npc.pathIndex = 0;
  }
  const speed = C.NPC.BANDIT_SPEED * 0.6 * terrainSpeedAt(world, npc.x, npc.y); // wander slower than a chase
  const arrived = advanceAlongPath(npc, world, speed * simDt);
  if (arrived) {
    npc.path = null;
    npc.state = 'paused';
    npc.pauseTimer = 2 + rand() * 4;
  }
  return null;
}

KINGS.NPCParty = NPCParty;
KINGS.generateNPCs = generateNPCs;
KINGS.updateNPC = updateNPC;
KINGS.advanceAlongPath = advanceAlongPath;
KINGS.terrainSpeedAt = terrainSpeedAt;
KINGS.pickDestination = pickDestination;
