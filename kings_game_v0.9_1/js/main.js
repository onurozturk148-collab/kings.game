window.KINGS = window.KINGS || {};

const STATE = {
  LOADING: 'loading', TITLE: 'title', PLAYING: 'playing',
  SETTLEMENT_MENU: 'settlement_menu', TRADE: 'trade', RECRUIT: 'recruit', TALK: 'talk',
  CARAVAN: 'caravan',
  BATTLE_DEPLOY: 'battle_deploy', BATTLE_RESOLVING: 'battle_resolving',
  BATTLE_RESULT: 'battle_result', BATTLE_LOOT: 'battle_loot', CAPTIVE: 'captive',
};

// Where each unit type is *most* effective, as a depth fraction within your
// own deployment zone (0 = right at the front line, 1 = as far back as
// possible): infantry wants the front, archers want the back, cavalry sits
// in the middle. Placement is completely free-form now (an open field, not
// a grid), so this is scored continuously rather than in three bands.
const IDEAL_DEPTH = { infantry: 0.15, archer: 0.85, cavalry: 0.5 };

function idHash(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) >>> 0;
  return h;
}

async function boot() {
  const canvas = document.getElementById('game-canvas');
  const loadingEl = document.getElementById('loading');
  const loadingBar = document.getElementById('loading-bar');

  const assets = await KINGS.loadAllAssets((done, total) => {
    if (loadingBar) loadingBar.style.width = Math.round((done / total) * 100) + '%';
  });

  const seed = 20260911;
  const world = KINGS.generateWorld(seed);
  const settlements = KINGS.placeSettlements(world, seed);
  KINGS.assignKingdoms(world, settlements, seed);
  const npcs = KINGS.generateNPCs(world, settlements, seed);
  const npcRand = KINGS.mulberry32(seed + 555);
  const start = KINGS.findStart(world, settlements);
  const party = new KINGS.Party(start.x, start.y, 'Kahraman Ordusu');
  const camera = new KINGS.Camera(world);
  camera.follow(party.x, party.y);
  const renderer = new KINGS.Renderer(canvas, assets, world, camera);
  const calendar = new KINGS.Calendar(KINGS.CONFIG.START_DATE);
  const input = new KINGS.Input(canvas);

  const game = {
    canvas, assets, world, settlements, npcs, npcRand, party, camera, renderer, calendar, input,
    state: STATE.TITLE,
    activeSettlement: null,
    nearSettlement: null,
    hasSave: false,
    speed: 1,
    talkNpc: null,
    battle: null,
    nextNpcId: 1000000, // player-created NPCs (caravans) get ids above the generated pool
    __hud: {},
    __screen: {},
  };
  KINGS.game = game;

  game.hasSave = !!loadSave();

  function resize() { renderer.resize(); }
  window.addEventListener('resize', resize);
  resize();

  if (loadingEl) loadingEl.style.display = 'none';
  canvas.style.visibility = 'visible';

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(game, dt);
    draw(game, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function loadSave() {
  try {
    const raw = localStorage.getItem(KINGS.CONFIG.SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function writeSave(game) {
  try {
    const data = {
      x: game.party.x, y: game.party.y,
      hours: game.calendar.totalHours,
      gold: game.party.gold,
      army: game.party.army,
      inventory: game.party.inventory,
      v: 3,
    };
    localStorage.setItem(KINGS.CONFIG.SAVE_KEY, JSON.stringify(data));
  } catch (e) { /* private mode / storage unavailable: ignore */ }
}

function findSettlementNear(game, radius = 0.8) {
  const p = game.party;
  let best = null, bestD = Infinity;
  for (const s of game.settlements) {
    const cx = s.x + 0.5, cy = s.y + 0.5;
    const d = Math.hypot(cx - p.x, cy - p.y);
    if (d < radius && d < bestD) { bestD = d; best = s; }
  }
  return best;
}

// Finds a settlement whose icon was tapped/clicked, so the party can be
// sent straight there and walk in on arrival — the click radius scales
// with each settlement's on-screen icon size (towns are easier to hit
// than villages, matching how much bigger they are drawn).
function findSettlementAtPoint(game, wx, wy) {
  let best = null, bestD = Infinity;
  for (const s of game.settlements) {
    const vis = KINGS.CONFIG.SETTLEMENT_VISUAL[s.type];
    const radius = 0.5 * (vis ? vis.scale : 1) + 0.15;
    const cx = s.x + 0.5, cy = s.y + 0.5;
    const d = Math.hypot(cx - wx, cy - wy);
    if (d < radius && d < bestD) { bestD = d; best = s; }
  }
  return best;
}

// Finds a live bandit whose icon was tapped/clicked, so the player can
// initiate an attack instead of only ever being the one getting jumped.
function findBanditAtPoint(game, wx, wy, radius = 0.5) {
  let best = null, bestD = Infinity;
  for (const n of game.npcs) {
    if (n.type !== 'bandit' || !n.alive) continue;
    const d = Math.hypot(n.x - wx, n.y - wy);
    if (d < radius && d < bestD) { bestD = d; best = n; }
  }
  return best;
}

let saveTimer = 0;
const hit = (r, t) => KINGS.hitTest(r, t.x, t.y);

// Steps every NPC forward by simDt and applies whatever signal comes back
// (a bandit catching the player starts a battle; a player-owned caravan
// arriving at a stop pays out gold). Shared between normal play and
// captivity, since bandits/traders/caravans keep living their lives while
// the player is a prisoner — only the player themselves can't act.
// Returns true if a battle was started this call (caller should stop).
function advanceNpcs(game, simDt) {
  const { world, party } = game;
  for (const npc of game.npcs) {
    const signal = KINGS.updateNPC(npc, world, game.settlements, party, game.npcs, simDt, game.npcRand);
    if (signal) {
      if (signal.attackPlayer) { startBattle(game, signal.bandit); return true; }
      if (signal.caravanProfit) { party.gold += signal.caravanProfit; }
    }
  }
  return false;
}

function update(game, dt) {
  const { state, input } = game;
  if (state === STATE.TITLE) { for (const t of drainTaps(input)) handleTitleTap(game); return; }
  if (state === STATE.SETTLEMENT_MENU) return updateSettlementMenu(game);
  if (state === STATE.TRADE) return updateTrade(game);
  if (state === STATE.RECRUIT) return updateRecruit(game);
  if (state === STATE.CARAVAN) return updateCaravan(game);
  if (state === STATE.TALK) return updateTalk(game);
  if (state === STATE.BATTLE_DEPLOY) return updateBattleDeploy(game);
  if (state === STATE.BATTLE_RESOLVING) return updateBattleResolving(game, dt);
  if (state === STATE.BATTLE_RESULT) return updateBattleResult(game);
  if (state === STATE.BATTLE_LOOT) return updateBattleLoot(game);
  if (state === STATE.CAPTIVE) return updateCaptive(game, dt);
  return updatePlaying(game, dt);
}

function updatePlaying(game, dt) {
  const { input, party, world, calendar, camera } = game;
  const C = KINGS.CONFIG;

  const zoomDelta = input.consumeZoomDelta();
  if (zoomDelta) camera.zoom(zoomDelta);

  const mv = input.getMoveVector();
  const simDt = dt * game.speed;

  // Pausing genuinely stops the world: no NPC updates, no player movement,
  // no calendar advance while calendar.paused is true.
  if (!calendar.paused) {
    if (advanceNpcs(game, simDt)) return;

    if (mv.x !== 0 || mv.y !== 0) {
      party.clearDestination();
      party.attackTargetId = null; // manual steering cancels any pursuit
      party.moving = true;
      if (mv.x !== 0) party.facing = mv.x > 0 ? 1 : -1;
      const terrain = party.currentTerrain(world);
      const mult = C.TERRAIN_SPEED_MULT[terrain] ?? 1;
      const speed = C.MOVE_SPEED_TILES_PER_SEC * Math.max(mult, 0.25);
      party.tryMove(world, mv.x * speed * simDt, mv.y * speed * simDt);
    } else if (party.hasDestination()) {
      party.moving = true;
      const speed = C.MOVE_SPEED_TILES_PER_SEC * KINGS.terrainSpeedAt(world, party.x, party.y);
      const arrived = KINGS.advanceAlongPath(party, world, speed * simDt);
      if (arrived) {
        const enterId = party.enterOnArrive;
        party.clearDestination();
        party.moving = false;
        if (enterId) {
          const s = game.settlements.find(s => s.id === enterId);
          if (s) { openSettlementMenu(game, s); return; }
        }
      }
    } else {
      party.moving = false;
    }

    // Player-initiated attack on a bandit: keep re-pathing toward it (it's
    // moving too) and trigger the same battle flow once we catch it.
    if (party.attackTargetId != null) {
      const target = game.npcs.find(n => n.id === party.attackTargetId);
      if (!target || !target.alive || target.type !== 'bandit') {
        party.attackTargetId = null;
      } else {
        const d = Math.hypot(target.x - party.x, target.y - party.y);
        if (d < C.NPC.BANDIT_CONTACT_DIST + 0.2) {
          party.attackTargetId = null;
          party.clearDestination();
          startBattle(game, target);
          return;
        }
        party.attackRepathTimer -= simDt;
        if (party.attackRepathTimer <= 0 || !party.hasDestination()) {
          party.goTo(world, target.x, target.y, null);
          party.attackRepathTimer = 0.6;
        }
      }
    }

    calendar.advance(C.HOURS_PER_REAL_SECOND * simDt * (party.moving ? 1.6 : 1));
  }

  // Camera look-around still works while paused, so the player can survey
  // the map without the world coming alive.
  const pan = input.consumePanDelta();
  if (pan.x || pan.y) camera.pan(pan.x, pan.y);
  if (party.moving) { camera.freeLook = false; }
  if (!camera.freeLook) camera.follow(party.x, party.y);

  game.nearSettlement = findSettlementNear(game);

  if (input.consumeKeyPress('e') && game.nearSettlement) { openSettlementMenu(game, game.nearSettlement); return; }
  if (input.consumeKeyPress(' ')) calendar.paused = !calendar.paused;
  for (const k of ['1', '2', '3']) {
    if (input.consumeKeyPress(k)) game.speed = Number(k);
  }

  const hud = game.__hud || {};
  for (const tap of drainTaps(input)) {
    if (hit(hud.pause, tap)) { calendar.paused = !calendar.paused; continue; }
    let matchedSpeed = false;
    if (hud.speed) {
      for (const r of hud.speed) { if (hit(r, tap)) { game.speed = r.value; matchedSpeed = true; break; } }
    }
    if (matchedSpeed) continue;
    if (hud.prompt && hit(hud.prompt, tap) && game.nearSettlement) { openSettlementMenu(game, game.nearSettlement); continue; }

    // Anywhere else: tapping a bandit attacks it; tapping a settlement's
    // icon (even from far away) walks there and enters automatically;
    // tapping open ground just walks there.
    const world_pt = camera.screenToWorld(tap.x, tap.y, game.renderer.cssW, game.renderer.cssH);
    const clickedBandit = findBanditAtPoint(game, world_pt.x, world_pt.y);
    if (clickedBandit) {
      party.attackTargetId = clickedBandit.id;
      party.attackRepathTimer = 0;
      continue;
    }
    const clickedSettlement = findSettlementAtPoint(game, world_pt.x, world_pt.y);
    if (clickedSettlement) {
      party.attackTargetId = null;
      party.goTo(world, clickedSettlement.x + 0.5, clickedSettlement.y + 0.5, clickedSettlement.id);
      continue;
    }
    party.attackTargetId = null;
    party.goTo(
      world,
      Math.max(0.3, Math.min(world.w - 0.3, world_pt.x)),
      Math.max(0.3, Math.min(world.h - 0.3, world_pt.y)),
      null
    );
  }

  saveTimer += dt;
  if (saveTimer > 3) { saveTimer = 0; writeSave(game); }
}

function drainTaps(input) {
  const t = input.taps;
  input.taps = [];
  return t;
}

function openSettlementMenu(game, settlement) {
  game.state = STATE.SETTLEMENT_MENU;
  game.activeSettlement = settlement;
  game.party.clearDestination();
  game.party.attackTargetId = null;
  game.party.moving = false;
  game.calendar.paused = true;
}

function closeSettlement(game) {
  game.state = STATE.PLAYING;
  game.activeSettlement = null;
  game.calendar.paused = false;
}

function updateSettlementMenu(game) {
  const r = game.__screen || {};
  for (const tap of drainTaps(game.input)) {
    if (hit(r.trade, tap)) { game.state = STATE.TRADE; return; }
    if (hit(r.recruit, tap)) { game.state = STATE.RECRUIT; return; }
    if (hit(r.caravan, tap)) { game.state = STATE.CARAVAN; return; }
    if (hit(r.talk, tap)) {
      const names = KINGS.NPC_FIRST_NAMES, lines = KINGS.NPC_LINES;
      game.talkNpc = {
        name: names[Math.floor(Math.random() * names.length)],
        line: lines[Math.floor(Math.random() * lines.length)],
      };
      game.state = STATE.TALK;
      return;
    }
    if (hit(r.leave, tap)) { closeSettlement(game); return; }
  }
}

function updateTrade(game) {
  const r = game.__screen || {};
  const party = game.party;
  const settlement = game.activeSettlement;
  const calendar = game.calendar;
  const allGoods = [...KINGS.CONFIG.GOODS, ...KINGS.CONFIG.LOOT_GOODS];
  for (const tap of drainTaps(game.input)) {
    if (r.rows) {
      for (const row of r.rows) {
        const g = allGoods.find(x => x.id === row.id);
        const buy = KINGS.buyPrice(settlement, g, calendar);
        const sell = KINGS.sellPrice(settlement, g, calendar);
        if (hit(row.buy, tap) && !row.buy.disabled) { if (party.gold >= buy) { party.gold -= buy; party.inventory[g.id]++; } continue; }
        if (hit(row.sell, tap) && !row.sell.disabled) { if (party.inventory[g.id] > 0) { party.gold += sell; party.inventory[g.id]--; } continue; }
      }
    }
    if (hit(r.back, tap)) { game.state = STATE.SETTLEMENT_MENU; return; }
  }
}

function updateRecruit(game) {
  const r = game.__screen || {};
  const party = game.party;
  const settlement = game.activeSettlement;
  const units = KINGS.CONFIG.UNIT_TYPES.filter(u => u.at.includes(settlement.type));
  for (const tap of drainTaps(game.input)) {
    if (r.rows) {
      for (const row of r.rows) {
        if (hit(row.btn, tap) && !row.btn.disabled) {
          const unit = units.find(u => u.id === row.id);
          if (unit && party.gold >= unit.cost) {
            party.gold -= unit.cost;
            party.army[unit.id] = (party.army[unit.id] || 0) + 1;
          }
          continue;
        }
      }
    }
    if (hit(r.back, tap)) { game.state = STATE.SETTLEMENT_MENU; return; }
  }
}

function updateCaravan(game) {
  const r = game.__screen || {};
  const party = game.party;
  const C = KINGS.CONFIG;
  for (const tap of drainTaps(game.input)) {
    if (hit(r.cheap, tap) && !r.cheap.disabled) {
      party.gold -= C.CARAVAN.CHEAP_COST;
      spawnCaravan(game, game.activeSettlement, C.CARAVAN.CHEAP_TROOPS);
      continue;
    }
    if (hit(r.expensive, tap) && !r.expensive.disabled) {
      party.gold -= C.CARAVAN.EXPENSIVE_COST;
      spawnCaravan(game, game.activeSettlement, C.CARAVAN.EXPENSIVE_TROOPS);
      continue;
    }
    if (hit(r.back, tap)) { game.state = STATE.SETTLEMENT_MENU; return; }
  }
}

function spawnCaravan(game, settlement, troops) {
  const dest = KINGS.pickDestination(game.npcRand, game.settlements, settlement.id, null);
  const n = new KINGS.NPCParty(settlement.x + 0.5, settlement.y + 0.5, 'caravan', `Kervanımız (${troops} birlik)`, null);
  n.id = game.nextNpcId++;
  n.owner = 'player';
  n.troops = troops;
  n.destSettlement = dest;
  n.path = KINGS.findPath(game.world, n.x, n.y, dest.x + 0.5, dest.y + 0.5) || [{ x: dest.x + 0.5, y: dest.y + 0.5 }];
  n.pathIndex = 0;
  game.npcs.push(n);
}

function updateTalk(game) {
  const r = game.__screen || {};
  for (const tap of drainTaps(game.input)) {
    if (hit(r.back, tap)) { game.state = STATE.SETTLEMENT_MENU; return; }
  }
}

// ---- battles -----------------------------------------------------------
//
// The battle screen is a real open battlefield, not a grid: your troops
// are grouped into small "squads" (so a 60-troop army stays tappable
// instead of 60 individual icons) that you select one at a time from the
// tray at the bottom and drop anywhere in your own zone by tapping — a
// real "place them wherever you want" deployment, like a shrunken piece
// of the campaign map. Once you hit "Savaşı Başlat" every squad becomes a
// living agent: it walks toward the nearest enemy squad on its own,
// archers hold their range and loose arrows, melee chips away at whoever
// they're engaged with — the fight plays out for real and ends the moment
// one side is wiped (or a safety-net time limit is hit).

// Splits an army into placeable squads, sized so a big army still fits on
// the field (MAX_*_SQUADS caps how many tokens you ever have to juggle).
function buildSquadsForArmy(army, side) {
  const C = KINGS.CONFIG;
  const totalTroops = C.UNIT_TYPES.reduce((sum, u) => sum + (army[u.id] || 0), 0);
  const squadSize = Math.max(2, Math.ceil(totalTroops / C.BATTLE.MAX_PLAYER_SQUADS)) || 2;
  const squads = [];
  let sid = 0;
  for (const unit of C.UNIT_TYPES) {
    let count = army[unit.id] || 0;
    while (count > 0) {
      const take = Math.min(squadSize, count);
      squads.push({ id: `p${sid++}`, unitId: unit.id, side, count: take, startCount: take, fx: null, fy: null });
      count -= take;
    }
  }
  return squads;
}

function buildEnemySquads(bandit) {
  const C = KINGS.CONFIG;
  const total = Math.max(1, bandit.troops);
  const squadSize = Math.max(2, Math.ceil(total / C.BATTLE.MAX_ENEMY_SQUADS));
  const squads = [];
  let sid = 0, count = total;
  while (count > 0) {
    const take = Math.min(squadSize, count);
    squads.push({ id: `e${sid++}`, unitId: 'bandit', side: 'enemy', count: take, startCount: take, fx: null, fy: null });
    count -= take;
  }
  return squads;
}

// Drops an unplaced squad somewhere sensible in its side's open zone,
// biased toward the depth that's ideal for its unit type, spread out
// along a lane so squads don't spawn on top of each other. Used for the
// enemy's starting layout and for "Otomatik Diz" (auto-filling whatever
// the player never got around to placing themselves).
function autoPlaceSquadFree(battle, squad, side) {
  const C = KINGS.CONFIG.BATTLE;
  const zoneFrac = side === 'player' ? C.PLAYER_ZONE_Y_FRAC : C.ENEMY_ZONE_Y_FRAC;
  const y0 = zoneFrac[0] * C.FIELD_H, y1 = zoneFrac[1] * C.FIELD_H;
  const idealFrac = side === 'player' ? (IDEAL_DEPTH[squad.unitId] ?? 0.5) : 0.35;
  const targetY = y0 + idealFrac * (y1 - y0);

  const siblings = battle.squads.filter(s => s.side === side && s.fx == null);
  const laneIndex = Math.max(0, siblings.indexOf(squad));
  const laneCount = Math.max(1, siblings.length);
  const laneW = C.FIELD_W / laneCount;
  const h = idHash(squad.id);
  const jx = ((h % 61) / 61 - 0.5) * laneW * 0.6;
  const jy = (((Math.floor(h / 61)) % 47) / 47 - 0.5) * (y1 - y0) * 0.3;

  squad.fx = Math.max(0.5, Math.min(C.FIELD_W - 0.5, laneIndex * laneW + laneW / 2 + jx));
  squad.fy = Math.max(y0 + 0.2, Math.min(y1 - 0.2, targetY + jy));
}

function startBattle(game, bandit) {
  const playerSquads = buildSquadsForArmy(game.party.army, 'player');
  const enemySquads = buildEnemySquads(bandit);
  const battle = {
    bandit, result: null, lootItems: null,
    squads: [...playerSquads, ...enemySquads],
    selectedSquadId: null,
    particles: [], sparks: [], events: [],
    simTime: 0,
  };
  // the enemy shows up already spread across their side of the field —
  // only your own deployment is something you control
  for (const sq of battle.squads) if (sq.side === 'enemy') autoPlaceSquadFree(battle, sq, 'enemy');
  game.state = STATE.BATTLE_DEPLOY;
  game.battle = battle;
  game.party.clearDestination();
  game.party.attackTargetId = null;
  game.party.moving = false;
  game.calendar.paused = true;
}

function updateBattleDeploy(game) {
  const r = game.__screen || {};
  const battle = game.battle;
  const PICKUP_RADIUS = 1.0; // field-units
  for (const tap of drainTaps(game.input)) {
    let handled = false;
    if (r.tray) {
      for (const t of r.tray) {
        if (hit(t, tap)) {
          battle.selectedSquadId = (battle.selectedSquadId === t.squadId) ? null : t.squadId;
          handled = true; break;
        }
      }
    }
    if (!handled && r.fieldGeom) {
      const geom = r.fieldGeom;
      const withinField = tap.x >= geom.fx0 && tap.x <= geom.fx0 + geom.fw && tap.y >= geom.fy0 && tap.y <= geom.fy0 + geom.fh;
      if (withinField) {
        const [fx, fy] = geom.toField(tap.x, tap.y);
        let nearest = null, nearestD = PICKUP_RADIUS;
        for (const sq of battle.squads) {
          if (sq.side !== 'player' || sq.fx == null) continue;
          const d = Math.hypot(sq.fx - fx, sq.fy - fy);
          if (d < nearestD) { nearestD = d; nearest = sq; }
        }
        if (nearest) {
          // tapping a placed squad picks it back up so it can be moved
          nearest.fx = null; nearest.fy = null;
          battle.selectedSquadId = nearest.id;
          handled = true;
        } else if (battle.selectedSquadId != null && fy >= geom.playerZone.y0f && fy <= geom.playerZone.y1f) {
          const sq = battle.squads.find(s => s.id === battle.selectedSquadId);
          if (sq) {
            sq.fx = Math.max(0.4, Math.min(KINGS.CONFIG.BATTLE.FIELD_W - 0.4, fx));
            sq.fy = fy;
            battle.selectedSquadId = null;
          }
          handled = true;
        }
      }
    }
    if (handled) continue;
    if (r.autoFill && hit(r.autoFill, tap)) {
      for (const sq of battle.squads) if (sq.side === 'player' && sq.fx == null) autoPlaceSquadFree(battle, sq, 'player');
      battle.selectedSquadId = null;
      continue;
    }
    if (r.start && hit(r.start, tap)) {
      beginResolving(game);
      return;
    }
  }
}

// Kicks off the live simulation: whatever the player never placed is
// auto-slotted in, every squad gets its starting combat power (formation
// bonus scored continuously from how close to its ideal depth it actually
// landed), and squads start advancing on their own.
function beginResolving(game) {
  const battle = game.battle;
  const C = KINGS.CONFIG;
  for (const sq of battle.squads) if (sq.side === 'player' && sq.fx == null) autoPlaceSquadFree(battle, sq, 'player');

  const [py0f, py1f] = C.BATTLE.PLAYER_ZONE_Y_FRAC;
  const zoneY0 = py0f * C.BATTLE.FIELD_H, zoneY1 = py1f * C.BATTLE.FIELD_H;

  for (const sq of battle.squads) {
    if (sq.side === 'player') {
      const unit = C.UNIT_TYPES.find(u => u.id === sq.unitId);
      const idealFrac = IDEAL_DEPTH[sq.unitId] ?? 0.5;
      const depthFrac = Math.max(0, Math.min(1, (sq.fy - zoneY0) / Math.max(0.001, zoneY1 - zoneY0)));
      const dist = Math.abs(depthFrac - idealFrac);
      const formationMult = 1 + 0.18 * (1 - 2 * dist); // ideal:+18%, average:0%, opposite:-18%
      sq.startPower = sq.startCount * (unit ? unit.power : 1) * formationMult;
    } else {
      sq.startPower = sq.startCount * C.BATTLE.BASE_BANDIT_POWER;
    }
    sq.power = sq.startPower;
    sq.count = sq.startCount;
    sq.targetId = null;
    sq.state = 'advancing';
    sq.angle = sq.side === 'player' ? -Math.PI / 2 : Math.PI / 2;
    const [lo, hi] = C.BATTLE.ARCHER_SHOT_INTERVAL;
    sq.shotTimer = lo + Math.random() * (hi - lo);
    sq.meleeSparkTimer = 0;
  }

  battle.simTime = 0;
  battle.particles = [];
  battle.sparks = [];
  battle.events = ['Çarpışma başlıyor!'];
  battle.selectedSquadId = null;
  game.state = STATE.BATTLE_RESOLVING;
}

// Finds the nearest living enemy squad to `sq` — the only targeting rule:
// units commit to a target and only look for a new one once it's dead, so
// there's no flickering/oscillating between choices mid-fight.
function findNearestEnemy(battle, sq) {
  let best = null, bestD = Infinity;
  for (const other of battle.squads) {
    if (other.side === sq.side || other.count <= 0 || other.fx == null) continue;
    const d = Math.hypot(other.fx - sq.fx, other.fy - sq.fy);
    if (d < bestD) { bestD = d; best = other; }
  }
  return best ? best.id : null;
}

function pushDeathEvent(battle, sq) {
  const C = KINGS.CONFIG;
  let text;
  if (sq.side === 'player') {
    const unit = C.UNIT_TYPES.find(u => u.id === sq.unitId);
    text = `${unit ? unit.name : 'Birlik'} takımımız dağıldı.`;
  } else {
    text = 'Bir kaçakçı takımı dağıldı!';
  }
  battle.events.push(text);
  if (battle.events.length > 30) battle.events.shift();
}

function applyDamage(battle, sq, dmg) {
  if (sq.count <= 0 || dmg <= 0) return;
  const wasAlive = sq.power > 0;
  sq.power = Math.max(0, sq.power - dmg);
  sq.count = sq.power <= 0.001 ? 0 : Math.max(1, Math.round(sq.startCount * (sq.power / sq.startPower)));
  if (sq.power <= 0.001 && wasAlive) pushDeathEvent(battle, sq);
}

function spawnArrow(battle, from, to) {
  const C = KINGS.CONFIG.BATTLE;
  battle.particles.push({
    kind: from.side === 'player' ? 'arrow' : 'bolt',
    fromPos: { x: from.fx, y: from.fy },
    targetId: to.id,
    t: 0, dur: 0.5 + Math.random() * 0.15,
    dmg: from.power * C.ARCHER_SHOT_DAMAGE_FRAC * (0.85 + Math.random() * 0.3),
    applied: false,
  });
}

function maybeSpawnMeleeSpark(battle, sq, target, dt) {
  sq.meleeSparkTimer -= dt;
  if (sq.meleeSparkTimer <= 0) {
    sq.meleeSparkTimer = 0.3 + Math.random() * 0.3;
    battle.sparks.push({
      x: (sq.fx + target.fx) / 2 + (Math.random() - 0.5) * 0.3,
      y: (sq.fy + target.fy) / 2 + (Math.random() - 0.5) * 0.3,
      t: 0, dur: 0.3 + Math.random() * 0.15,
    });
  }
}

// The live simulation tick: every squad picks a target, walks toward it
// (archers stop at shooting range and loose arrows instead of closing all
// the way in), and deals damage once in range. Runs every frame while
// BATTLE_RESOLVING is active; ends the fight the instant one side is wiped.
function updateBattleResolving(game, dt) {
  drainTaps(game.input); // no interaction while the fight plays out
  const battle = game.battle;
  const C = KINGS.CONFIG.BATTLE;
  battle.simTime += dt;

  for (const sq of battle.squads) {
    if (sq.count <= 0) { sq.state = 'dead'; continue; }

    const currentTarget = battle.squads.find(s => s.id === sq.targetId);
    if (!currentTarget || currentTarget.count <= 0) sq.targetId = findNearestEnemy(battle, sq);
    const target = battle.squads.find(s => s.id === sq.targetId);
    if (!target || target.count <= 0) { sq.state = 'idle'; continue; }

    const dx = target.fx - sq.fx, dy = target.fy - sq.fy;
    const d = Math.hypot(dx, dy) || 0.001;
    sq.angle = Math.atan2(dy, dx);
    const isArcher = sq.unitId === 'archer';

    if (isArcher && d <= C.ARCHER_SHOOT_RANGE && d > C.MELEE_RANGE) {
      sq.state = 'shooting';
      sq.shotTimer -= dt;
      if (sq.shotTimer <= 0) {
        const [lo, hi] = C.ARCHER_SHOT_INTERVAL;
        sq.shotTimer = lo + Math.random() * (hi - lo);
        spawnArrow(battle, sq, target);
      }
    } else if (d <= C.MELEE_RANGE) {
      sq.state = 'engaged';
      const dmg = sq.power * C.MELEE_ATTACK_RATE * dt * (0.75 + Math.random() * 0.5);
      applyDamage(battle, target, dmg);
      maybeSpawnMeleeSpark(battle, sq, target, dt);
    } else {
      sq.state = 'advancing';
      const speed = C.SQUAD_SPEED * (sq.unitId === 'cavalry' ? C.CAVALRY_SPEED_MULT : 1);
      const stopAt = isArcher ? C.ARCHER_SHOOT_RANGE * 0.9 : C.MELEE_RANGE * 0.85;
      let moveDist = speed * dt;
      if (d - moveDist < stopAt) moveDist = Math.max(0, d - stopAt);
      sq.fx += (dx / d) * moveDist;
      sq.fy += (dy / d) * moveDist;
    }
  }

  for (const p of battle.particles) {
    p.t += dt / p.dur;
    if (p.t >= 1 && !p.applied) {
      p.applied = true;
      const target = battle.squads.find(s => s.id === p.targetId);
      if (target && target.count > 0) applyDamage(battle, target, p.dmg);
    }
  }
  battle.particles = battle.particles.filter(p => p.t < 1.1);
  battle.sparks = battle.sparks.filter(s => { s.t += dt / s.dur; return s.t < 1; });

  const playerAlive = battle.squads.some(s => s.side === 'player' && s.count > 0);
  const enemyAlive = battle.squads.some(s => s.side === 'enemy' && s.count > 0);
  const timedOut = battle.simTime >= C.MAX_BATTLE_SECONDS;
  if (!playerAlive || !enemyAlive || timedOut) finishLiveBattle(game);
}

// Called the instant the live sim ends (one side wiped, or the safety-net
// time limit). The outcome is whatever actually happened on the field —
// no separate dice roll — so casualties are just each squad's final
// headcount summed back into party.army.
function finishLiveBattle(game) {
  const C = KINGS.CONFIG;
  const party = game.party;
  const battle = game.battle;
  const bandit = battle.bandit;

  const playerAlive = battle.squads.some(s => s.side === 'player' && s.count > 0);
  const enemyAlive = battle.squads.some(s => s.side === 'enemy' && s.count > 0);
  let won;
  if (playerAlive && !enemyAlive) won = true;
  else if (!playerAlive && enemyAlive) won = false;
  else if (!playerAlive && !enemyAlive) won = true; // mutual wipe: give the benefit of the doubt
  else {
    // time limit hit with both sides still standing: whoever has more
    // fighting power left holds the field
    const pPow = battle.squads.filter(s => s.side === 'player').reduce((a, s) => a + s.power, 0);
    const ePow = battle.squads.filter(s => s.side === 'enemy').reduce((a, s) => a + s.power, 0);
    won = pPow >= ePow;
  }

  const casualties = {};
  let casualtyCount = 0;
  for (const unit of C.UNIT_TYPES) {
    const before = party.army[unit.id] || 0;
    const finalCount = battle.squads.filter(s => s.side === 'player' && s.unitId === unit.id).reduce((a, s) => a + s.count, 0);
    const lost = Math.max(0, before - finalCount);
    if (lost > 0) { casualties[unit.id] = lost; casualtyCount += lost; }
    party.army[unit.id] = finalCount;
  }

  let lootItems = null;
  if (won) {
    // a pile of individual items rather than a pre-summed bag — the player
    // picks through it themselves on the loot screen, Bannerlord-style
    lootItems = [];
    const lootRolls = Math.max(2, Math.round(bandit.troops / 4));
    for (let i = 0; i < lootRolls; i++) {
      const g = C.LOOT_GOODS[Math.floor(Math.random() * C.LOOT_GOODS.length)];
      lootItems.push({ id: g.id, name: g.name, price: g.price, taken: false });
    }
    bandit.alive = false;
    const idx = game.npcs.indexOf(bandit);
    if (idx >= 0) game.npcs.splice(idx, 1);
  } else {
    party.captive = true;
    const [lo, hi] = C.BATTLE.CAPTIVE_SECONDS;
    party.captiveTimer = lo + Math.random() * (hi - lo);
  }

  battle.result = { won, casualties, casualtyCount, banditTroops: bandit.troops };
  battle.lootItems = lootItems;
  game.state = STATE.BATTLE_RESULT;
}

function updateBattleResult(game) {
  const r = game.__screen || {};
  for (const tap of drainTaps(game.input)) {
    if (hit(r.continue, tap)) {
      const won = !!(game.battle && game.battle.result && game.battle.result.won);
      if (won) { game.state = STATE.BATTLE_LOOT; }
      else {
        game.battle = null;
        game.state = STATE.CAPTIVE;
        // Unlike every other sub-screen, captivity does NOT stop the
        // world: the clock keeps ticking and bandits/traders/caravans
        // keep moving around while you're waiting to escape — only the
        // player is stuck (can't act) until the timer runs out.
        game.calendar.paused = false;
      }
      return;
    }
  }
}

function updateBattleLoot(game) {
  const r = game.__screen || {};
  const party = game.party;
  for (const tap of drainTaps(game.input)) {
    if (r.rows) {
      for (const row of r.rows) {
        if (hit(row.take, tap) && !row.take.disabled) {
          const item = game.battle.lootItems[row.index];
          if (item && !item.taken) {
            item.taken = true;
            party.inventory[item.id] = (party.inventory[item.id] || 0) + 1;
          }
          continue;
        }
      }
    }
    if (hit(r.takeAll, tap)) {
      for (const item of game.battle.lootItems) {
        if (!item.taken) { item.taken = true; party.inventory[item.id] = (party.inventory[item.id] || 0) + 1; }
      }
      continue;
    }
    if (hit(r.finish, tap)) {
      game.battle = null;
      game.state = STATE.PLAYING;
      game.calendar.paused = false;
      return;
    }
  }
}

function updateCaptive(game, dt) {
  drainTaps(game.input);
  const C = KINGS.CONFIG;
  const party = game.party;
  const simDt = dt * game.speed;

  // The world keeps living while we're captive — NPCs (including any
  // bandit that might catch a different trader) keep moving and the
  // calendar keeps advancing. `player.captive` already keeps bandits from
  // targeting us again, so advanceNpcs won't start a new battle here.
  advanceNpcs(game, simDt);
  game.calendar.advance(C.HOURS_PER_REAL_SECOND * simDt);

  party.captiveTimer -= dt;
  if (party.captiveTimer <= 0) {
    party.captive = false;
    party.captiveTimer = 0;
    game.state = STATE.PLAYING;
  }
}

function handleTitleTap(game) {
  if (game.hasSave) {
    const save = loadSave();
    if (save && typeof save.x === 'number') {
      game.party.x = save.x;
      game.party.y = save.y;
      game.calendar.totalHours = save.hours;
      if (typeof save.gold === 'number') game.party.gold = save.gold;
      if (save.army && typeof save.army === 'object') {
        Object.assign(game.party.army, save.army);
      } else if (typeof save.troops === 'number') {
        // pre-v0.5 saves only had a flat troop count — bring it back as
        // plain infantry rather than losing it.
        game.party.army.infantry = save.troops;
      }
      if (save.inventory) Object.assign(game.party.inventory, save.inventory);
      game.camera.follow(game.party.x, game.party.y);
    }
  }
  game.state = STATE.PLAYING;
}

function draw(game, dt) {
  const { renderer, party, settlements, npcs, calendar, input, state } = game;
  renderer.drawWorld(party, settlements, npcs, state === STATE.PLAYING ? game.nearSettlement : null, dt);

  if (state === STATE.PLAYING) {
    game.__hud = renderer.drawHUD(calendar, party, game.nearSettlement, calendar.paused, game.speed);
    renderer.drawJoystick(input);
  } else if (state === STATE.TITLE) {
    drawTitle(game);
  } else {
    // the live battlefield screens are full-screen in their own right, so
    // they skip the HUD bar and draw their own header instead
    const isBattlefield = state === STATE.BATTLE_DEPLOY || state === STATE.BATTLE_RESOLVING;
    if (!isBattlefield) renderer.drawHUD(calendar, party, null, true, game.speed);
    if (state === STATE.SETTLEMENT_MENU) game.__screen = renderer.drawSettlementMenu(game.activeSettlement);
    else if (state === STATE.TRADE) game.__screen = renderer.drawTradeScreen(game.activeSettlement, party, calendar);
    else if (state === STATE.RECRUIT) game.__screen = renderer.drawRecruitScreen(game.activeSettlement, party);
    else if (state === STATE.CARAVAN) game.__screen = renderer.drawCaravanScreen(game.activeSettlement, party);
    else if (state === STATE.TALK) game.__screen = renderer.drawTalkScreen(game.activeSettlement, game.talkNpc);
    else if (state === STATE.BATTLE_DEPLOY) game.__screen = renderer.drawBattleDeployScreen(game.battle);
    else if (state === STATE.BATTLE_RESOLVING) game.__screen = renderer.drawBattleResolvingScreen(game.battle);
    else if (state === STATE.BATTLE_RESULT) game.__screen = renderer.drawBattleResultScreen(game.battle.result, party);
    else if (state === STATE.BATTLE_LOOT) game.__screen = renderer.drawBattleLootScreen(game.battle.lootItems, party);
    else if (state === STATE.CAPTIVE) game.__screen = renderer.drawCaptivityScreen(party);
  }
}

function drawTitle(game) {
  const ctx = game.renderer.ctx;
  const w = game.renderer.cssW, h = game.renderer.cssH;
  ctx.fillStyle = 'rgba(10, 8, 5, 0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe27a';
  ctx.font = '700 44px "Trebuchet MS", sans-serif';
  ctx.fillText('KINGS', w / 2, h / 2 - 34);
  ctx.fillStyle = '#e7dfc9';
  ctx.font = '500 13px "Trebuchet MS", sans-serif';
  ctx.fillText('1257 — Orta Çağ. Taht için yedi krallık birbirine girmiş durumda.', w / 2, h / 2 - 4);
  ctx.fillStyle = '#f2ead8';
  ctx.font = '500 16px "Trebuchet MS", sans-serif';
  const hint = game.hasSave ? 'Dokun ya da tıkla — devam et' : 'Dokun ya da tıkla — başla';
  ctx.fillText(hint, w / 2, h / 2 + 28);
}

window.addEventListener('DOMContentLoaded', boot);
