window.KINGS = window.KINGS || {};

const TERRAIN_NAMES = {
  grass: 'Çayır', plains: 'Ova', forest: 'Orman', water: 'Su',
  mountain: 'Dağ', hills: 'Tepe', road: 'Yol',
};
const SETTLEMENT_TYPE_NAMES = { village: 'Köy', town: 'Kasaba', castle: 'Kale' };
const RECRUIT_TYPE_NAMES = { village: 'Köylü Asker', town: 'Piyade', castle: 'Atlı Asker' };

const PANEL_BG = '#231a10';
const PANEL_BORDER = 'rgba(255, 226, 122, 0.5)';
const GOLD = '#ffe27a';
const INK = '#f2ead8';
const DIM = '#c9c0a8';

// Relative (x,y) offsets (as fractions of a squad's "spread" radius) for
// clustering up to 6 individual soldier icons into one loose formation
// blob per squad on the battlefield — capped at 6 so a 20-troop squad
// doesn't turn into an unreadable pile of dots.
const CLUSTER_OFFSETS = {
  1: [[0, 0]],
  2: [[-0.4, 0], [0.4, 0]],
  3: [[-0.4, -0.25], [0.4, -0.25], [0, 0.3]],
  4: [[-0.4, -0.3], [0.4, -0.3], [-0.4, 0.3], [0.4, 0.3]],
  5: [[-0.5, -0.3], [0.5, -0.3], [0, 0], [-0.5, 0.35], [0.5, 0.35]],
  6: [[-0.5, -0.35], [0, -0.35], [0.5, -0.35], [-0.5, 0.35], [0, 0.35], [0.5, 0.35]],
};

function nightAmount(cal) {
  const h = cal.totalHours % 24;
  // smooth ease around dusk (18-21) and dawn (4-7)
  const ease = (a, b, x) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  if (h >= 18 && h < 22) return ease(18, 21, h);
  if (h >= 22 || h < 4) return 1;
  if (h >= 4 && h < 7) return 1 - ease(4, 6.5, h);
  return 0;
}

class Renderer {
  constructor(canvas, assets, world, camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets;
    this.world = world;
    this.camera = camera;
    this.animT = 0;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  get cssW() { return this.canvas.clientWidth; }
  get cssH() { return this.canvas.clientHeight; }

  _drawFlag(sx, fy0, poleH, color, fw, fh) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, fy0); ctx.lineTo(sx, fy0 - poleH); ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(sx, fy0 - poleH, fw, fh);
  }

  _drawSettlementCrowd(s, sx, sy, size, ts) {
    const ctx = this.ctx;
    const C = KINGS.CONFIG;
    const n = C.SETTLEMENT_CROWD[s.type] || 0;
    if (n <= 0) return;
    const seed = simpleHash(String(s.id != null ? s.id : s.name || 'x'));
    for (let i = 0; i < n; i++) {
      const r1 = ((seed * (i * 13 + 7)) % 977) / 977;
      const r2 = ((seed * (i * 29 + 3)) % 991) / 991;
      const ang = r1 * Math.PI * 2;
      const rad = (0.32 + r2 * 0.58) * size * 0.5;
      const wobble = Math.sin(this.animT * 1.6 + r1 * 10) * 2;
      const px = sx + Math.cos(ang) * rad + wobble;
      const py = sy - size * 0.1 + Math.sin(ang) * rad * 0.42;
      const hue = 18 + Math.floor(r2 * 5) * 40;
      ctx.fillStyle = `hsla(${hue}, 38%, 42%, 0.85)`;
      ctx.beginPath(); ctx.arc(px, py, Math.max(2, ts * 0.045), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(230, 210, 180, 0.9)';
      ctx.beginPath(); ctx.arc(px, py - ts * 0.05, Math.max(1.3, ts * 0.026), 0, Math.PI * 2); ctx.fill();
    }
  }

  drawWorld(party, settlements, npcs, nearSettlement, dt) {
    this.animT += dt;
    const ctx = this.ctx;
    const w = this.cssW, h = this.cssH;
    // fallback colour beyond the generated region (visible when zoomed far
    // out near a map edge) — reads as "edge of the known world" rather than
    // a rendering glitch.
    ctx.fillStyle = '#0a1626';
    ctx.fillRect(0, 0, w, h);

    const cam = this.camera;
    const ts = cam.tileSize;
    const { x0, y0, x1, y1 } = cam.visibleTileRange(w, h);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const terrain = this.world.tiles[y][x];
        const img = this.assets[terrain];
        const [sx, sy] = cam.worldToScreen(x, y, w, h);
        ctx.drawImage(img, sx, sy, ts + 1, ts + 1);
      }
    }

    // settlements (draw back-to-front by y for a light depth feel)
    const visible = settlements.filter(s => s.x >= x0 - 1 && s.x <= x1 + 1 && s.y >= y0 - 1 && s.y <= y1 + 1);
    visible.sort((a, b) => a.y - b.y);
    for (const s of visible) {
      const img = this.assets[s.type];
      const vis = KINGS.CONFIG.SETTLEMENT_VISUAL[s.type];
      const size = ts * vis.scale;
      const [sx, sy] = cam.worldToScreen(s.x + 0.5, s.y + 0.5, w, h);

      // towns get a soft glow behind them so they read as the biggest,
      // most important places on the map even from a distance
      if (s.type === 'town') {
        const glowR = size * 0.62;
        const grad = ctx.createRadialGradient(sx, sy - size * 0.5, glowR * 0.15, sx, sy - size * 0.5, glowR);
        grad.addColorStop(0, 'rgba(255, 226, 122, 0.35)');
        grad.addColorStop(1, 'rgba(255, 226, 122, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(sx, sy - size * 0.5, glowR, 0, Math.PI * 2); ctx.fill();
      }

      ctx.drawImage(img, sx - size / 2, sy - size * 0.9, size, size);

      // a little ambient crowd of townsfolk dots — purely decorative, makes
      // settlements (especially towns) feel busy and alive rather than
      // just an empty icon on the map
      if (ts > 16) {
        this._drawSettlementCrowd(s, sx, sy, size, ts);
      }

      // kingdom banner: a small coloured pennant above the icon
      if (s.kingdom && ts > 14) {
        const poleH = Math.max(6, size * 0.28);
        this._drawFlag(sx + size * 0.30, sy - size * 0.98, poleH, s.kingdom.color, Math.max(5, size * 0.22), Math.max(4, size * 0.14));
      }

      ctx.font = `700 ${Math.max(13, ts * vis.font)}px 'Trebuchet MS', sans-serif`;
      ctx.textAlign = 'center';
      const label = s.name;
      const ly = sy - size * 0.92 - 4;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(label, sx, ly);
      // the label itself is coloured by the owning kingdom, so ownership
      // reads at a glance; the "near" highlight still overrides to gold
      // since that's an interaction affordance, not ownership information.
      ctx.fillStyle = s === nearSettlement ? GOLD : (s.kingdom ? s.kingdom.color : INK);
      ctx.fillText(label, sx, ly);
    }

    // wandering NPCs (traders + lords) — culled to the visible area, drawn
    // smaller and dimmer than the player so they read as background life
    if (npcs && ts > 8) {
      const visNpcs = npcs.filter(n => n.x >= x0 - 1 && n.x <= x1 + 1 && n.y >= y0 - 1 && n.y <= y1 + 1);
      visNpcs.sort((a, b) => a.y - b.y);
      for (const n of visNpcs) {
        const img = this.assets[n.type === 'lord' ? 'lord' : (n.type === 'bandit' ? 'bandit' : 'trader')];
        const nsize = ts * (n.type === 'lord' ? 0.85 : (n.type === 'bandit' ? 0.75 : 0.7));
        const [nx, ny] = cam.worldToScreen(n.x, n.y, w, h);
        ctx.save();
        if (n.facing < 0) { ctx.translate(nx, 0); ctx.scale(-1, 1); ctx.translate(-nx, 0); }
        ctx.globalAlpha = 0.92;
        ctx.drawImage(img, nx - nsize / 2, ny - nsize * 0.8, nsize, nsize);
        ctx.globalAlpha = 1;
        ctx.restore();

        // highlight the bandit the player has targeted for attack
        if (n.type === 'bandit' && party.attackTargetId === n.id) {
          const pulse = 0.5 + 0.5 * Math.sin(this.animT * 8);
          ctx.strokeStyle = `rgba(224, 70, 70, ${0.6 + 0.3 * pulse})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(nx, ny - nsize * 0.4, nsize * 0.62 + pulse, 0, Math.PI * 2); ctx.stroke();
        }

        if (n.type === 'lord' && n.kingdom && ts > 20) {
          this._drawFlag(nx + nsize * 0.32, ny - nsize * 0.85, Math.max(5, nsize * 0.3), n.kingdom.color, Math.max(4, nsize * 0.2), Math.max(3, nsize * 0.12));
        }
        if (ts > 26) {
          ctx.font = `${Math.max(9, ts * 0.16)}px 'Trebuchet MS', sans-serif`;
          ctx.textAlign = 'center';
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = 'rgba(0,0,0,0.7)';
          const ly = ny - nsize * 0.85 - 3;
          ctx.strokeText(n.name, nx, ly);
          ctx.fillStyle = n.type === 'lord' && n.kingdom ? n.kingdom.color : DIM;
          ctx.fillText(n.name, nx, ly);
        }
      }
    }

    // destination marker (click/tap-to-move target) — the final waypoint of
    // the current path, so it stays visible while the party threads its
    // way around obstacles instead of walking there in a straight line
    if (party.path && party.pathIndex < party.path.length) {
      const dest = party.path[party.path.length - 1];
      const [dxs, dys] = cam.worldToScreen(dest.x, dest.y, w, h);
      const pulse = 0.5 + 0.5 * Math.sin(this.animT * 6);
      ctx.strokeStyle = `rgba(255, 226, 122, ${0.5 + 0.4 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(dxs, dys, 8 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255, 226, 122, 0.9)';
      ctx.beginPath(); ctx.arc(dxs, dys, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // party sprite with a subtle bob while moving
    const bob = party.moving ? Math.sin(this.animT * 10) * 2 : 0;
    const psize = ts * 1.15;
    const [px, py] = cam.worldToScreen(party.x, party.y, w, h);
    ctx.save();
    if (party.facing < 0) {
      ctx.translate(px, 0);
      ctx.scale(-1, 1);
      ctx.translate(-px, 0);
    }
    ctx.drawImage(this.assets.party, px - psize / 2, py - psize * 0.85 + bob, psize, psize);
    ctx.restore();

    // day/night tint
    const night = nightAmount(KINGS.game.calendar);
    if (night > 0.01) {
      ctx.fillStyle = `rgba(10, 18, 46, ${0.45 * night})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawHUD(calendar, party, nearSettlement, paused, gameSpeed) {
    const ctx = this.ctx;
    const w = this.cssW, h = this.cssH;
    const rects = {};

    // top bar (two rows so it stays legible on narrow phone screens)
    const barH = 60;
    ctx.fillStyle = 'rgba(20, 16, 10, 0.78)';
    ctx.fillRect(0, 0, w, barH);

    ctx.fillStyle = INK;
    ctx.font = '600 15px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(calendar.label(), 12, 20);

    const terrain = TERRAIN_NAMES[party.currentTerrain(this.world)] || '';
    ctx.textAlign = 'right';
    ctx.font = '500 13px "Trebuchet MS", sans-serif';
    ctx.fillStyle = DIM;
    ctx.fillText(terrain, w - 12, 20);

    ctx.textAlign = 'left';
    ctx.font = '600 14px "Trebuchet MS", sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText(`${party.gold} altın`, 12, 44);
    ctx.fillStyle = DIM;
    ctx.fillText(`·  ${party.troops} asker`, 12 + ctx.measureText(`${party.gold} altın`).width + 8, 44);

    // speed segmented control + pause, right-aligned on row 2
    const speeds = KINGS.CONFIG.GAME_SPEEDS;
    const segW = 28, segH = 24, gap = 3;
    let sx = w - 12 - 32 - 8 - speeds.length * (segW + gap) + gap;
    rects.speed = [];
    for (const sp of speeds) {
      const active = sp === gameSpeed;
      ctx.fillStyle = active ? 'rgba(255, 226, 122, 0.85)' : 'rgba(255,255,255,0.12)';
      roundRect(ctx, sx, 32, segW, segH, 5); ctx.fill();
      ctx.strokeStyle = active ? 'rgba(255,226,122,0.9)' : 'rgba(255,255,255,0.3)';
      roundRect(ctx, sx, 32, segW, segH, 5); ctx.stroke();
      ctx.fillStyle = active ? '#3a2a10' : INK;
      ctx.font = '700 12px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sp + 'x', sx + segW / 2, 32 + segH / 2 + 4);
      rects.speed.push({ x: sx, y: 32, w: segW, h: segH, value: sp });
      sx += segW + gap;
    }

    const pw = 32, ph = 24, px = w - 12 - pw;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(ctx, px, 32, pw, ph, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    roundRect(ctx, px, 32, pw, ph, 5); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(paused ? '►' : '❚❚', px + pw / 2, 32 + ph / 2 + 5);
    rects.pause = { x: px, y: 32, w: pw, h: ph };

    // near-settlement prompt
    rects.prompt = null;
    if (nearSettlement) {
      const label = `${nearSettlement.name} — ${SETTLEMENT_TYPE_NAMES[nearSettlement.type]}  ·  dokun / E`;
      ctx.font = '600 15px "Trebuchet MS", sans-serif';
      const tw = ctx.measureText(label).width;
      const bx = w / 2 - tw / 2 - 16, by = h - 74, bw = tw + 32, bh = 36;
      ctx.fillStyle = 'rgba(20, 16, 10, 0.78)';
      roundRect(ctx, bx, by, bw, bh, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 226, 122, 0.6)';
      roundRect(ctx, bx, by, bw, bh, 8);
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.textAlign = 'center';
      ctx.fillText(label, w / 2, by + bh / 2 + 5);
      rects.prompt = { x: bx, y: by, w: bw, h: bh };
    }

    return rects;
  }

  drawJoystick(input) {
    if (!input.joystick.active) return;
    const ctx = this.ctx;
    const { baseX, baseY, curX, curY } = input.joystick;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#1a140c';
    ctx.strokeStyle = 'rgba(242,234,216,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(baseX, baseY, input.joyRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(curX, curY, 20, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---- settlement screens -------------------------------------------

  _panelFrame(title, subtitle, ch, subColor) {
    const ctx = this.ctx;
    const w = this.cssW, h = this.cssH;
    ctx.fillStyle = 'rgba(8, 6, 4, 0.62)';
    ctx.fillRect(0, 0, w, h);
    const cw = Math.min(360, w - 40);
    // left-aligned rather than centered, per request — menus open on the
    // left side of the screen instead of covering the middle of the map
    const cx = 20, cy = Math.max(68, h / 2 - ch / 2);
    ctx.fillStyle = PANEL_BG;
    roundRect(ctx, cx, cy, cw, ch, 12); ctx.fill();
    ctx.strokeStyle = PANEL_BORDER; ctx.lineWidth = 2;
    roundRect(ctx, cx, cy, cw, ch, 12); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = '700 19px "Trebuchet MS", sans-serif';
    ctx.fillText(title, cx + cw / 2, cy + 32);
    if (subtitle) {
      ctx.fillStyle = subColor || DIM;
      ctx.font = '500 13px "Trebuchet MS", sans-serif';
      wrapText(ctx, subtitle, cx + cw / 2, cy + 50, cw - 40, 16);
    }
    return { cx, cy, cw, ch };
  }

  _button(x, y, w, h, label, opts = {}) {
    const ctx = this.ctx;
    const disabled = !!opts.disabled;
    const accent = !!opts.accent;
    ctx.globalAlpha = disabled ? 0.45 : 1;
    ctx.fillStyle = accent ? 'rgba(255, 226, 122, 0.18)' : 'rgba(255,255,255,0.10)';
    roundRect(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = accent ? 'rgba(255,226,122,0.55)' : 'rgba(255,255,255,0.3)';
    roundRect(ctx, x, y, w, h, 8); ctx.stroke();
    ctx.fillStyle = accent ? GOLD : INK;
    ctx.font = '600 14px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 5);
    ctx.globalAlpha = 1;
    return { x, y, w, h, disabled };
  }

  drawSettlementMenu(settlement) {
    const ch = 356;
    const { cx, cy, cw } = this._panelFrame(
      settlement.name,
      `${SETTLEMENT_TYPE_NAMES[settlement.type]} · ${settlement.kingdom ? settlement.kingdom.name : ''}`,
      ch, settlement.kingdom ? settlement.kingdom.color : DIM
    );
    const bw = cw - 48, bh = 44, bx = cx + 24;
    let by = cy + 76;
    const rects = {};
    rects.trade = this._button(bx, by, bw, bh, 'Ticaret', { accent: true }); by += bh + 12;
    rects.recruit = this._button(bx, by, bw, bh, 'Ordu Topla', { accent: true }); by += bh + 12;
    rects.caravan = this._button(bx, by, bw, bh, 'Kervan Oluştur', { accent: true }); by += bh + 12;
    rects.talk = this._button(bx, by, bw, bh, 'Köylülerle Konuş', { accent: true }); by += bh + 24;
    rects.leave = this._button(bx, by, bw, 38, 'Ayrıl', {});
    return rects;
  }

  drawTradeScreen(settlement, party, calendar) {
    const goods = [...KINGS.CONFIG.GOODS, ...KINGS.CONFIG.LOOT_GOODS];
    const rowH = 46;
    const ch = 110 + goods.length * rowH + 60;
    const { cx, cy, cw } = this._panelFrame(`Pazar — ${settlement.name}`, `Altın: ${party.gold}`, ch);
    const rects = { rows: [] };
    let ry = cy + 74;
    const rx = cx + 20, rw = cw - 40;
    for (const g of goods) {
      const have = party.inventory[g.id] || 0;
      const buy = KINGS.buyPrice(settlement, g, calendar);
      const sell = KINGS.sellPrice(settlement, g, calendar);
      const ctx = this.ctx;
      ctx.textAlign = 'left';
      ctx.fillStyle = INK;
      ctx.font = '600 14px "Trebuchet MS", sans-serif';
      ctx.fillText(g.name, rx, ry + 15);
      ctx.fillStyle = DIM;
      ctx.font = '500 12px "Trebuchet MS", sans-serif';
      ctx.fillText(`al: ${buy}  ·  sat: ${sell}  ·  elinde: ${have}`, rx, ry + 32);

      const bw = 38, bh = 30;
      const sellBtn = this._button(rx + rw - bw * 2 - 8, ry + 2, bw, bh, '−', { disabled: have <= 0 });
      const buyBtn = this._button(rx + rw - bw, ry + 2, bw, bh, '+', { disabled: party.gold < buy });
      rects.rows.push({ id: g.id, buy: buyBtn, sell: sellBtn });
      ry += rowH;
    }
    rects.back = this._button(cx + cw / 2 - 70, cy + ch - 50, 140, 38, 'Kapat', {});
    return rects;
  }

  drawCaravanScreen(settlement, party) {
    const C = KINGS.CONFIG;
    const ch = 340;
    const { cx, cy, cw } = this._panelFrame(`Kervan Oluştur — ${settlement.name}`, `Altın: ${party.gold}`, ch);
    const ctx = this.ctx;
    ctx.textAlign = 'left';
    ctx.fillStyle = DIM;
    ctx.font = '400 12px "Trebuchet MS", sans-serif';
    wrapText(ctx, 'Kervan kendi başına şehirler/köyler arası ticaret yapar ve her durakta sana altın kazandırır.', cx + 20, cy + 78, cw - 40, 15);

    const rects = {};
    let ry = cy + 116;
    const rx = cx + 20, rw = cw - 40;

    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = '600 14px "Trebuchet MS", sans-serif';
    ctx.fillText(`Ucuz Kervan — ${C.CARAVAN.CHEAP_TROOPS} birlik`, rx, ry + 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = '600 12px "Trebuchet MS", sans-serif';
    ctx.fillText(`${C.CARAVAN.CHEAP_COST} altın`, rx + rw, ry + 14);
    rects.cheap = this._button(rx, ry + 24, rw, 40, 'Kur', { accent: true, disabled: party.gold < C.CARAVAN.CHEAP_COST });
    ry += 82;

    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = '600 14px "Trebuchet MS", sans-serif';
    ctx.fillText(`Büyük Kervan — ${C.CARAVAN.EXPENSIVE_TROOPS} birlik`, rx, ry + 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = '600 12px "Trebuchet MS", sans-serif';
    ctx.fillText(`${C.CARAVAN.EXPENSIVE_COST} altın`, rx + rw, ry + 14);
    rects.expensive = this._button(rx, ry + 24, rw, 40, 'Kur', { accent: true, disabled: party.gold < C.CARAVAN.EXPENSIVE_COST });

    rects.back = this._button(cx + cw / 2 - 70, cy + ch - 46, 140, 38, 'Kapat', {});
    return rects;
  }

  drawRecruitScreen(settlement, party) {
    const C = KINGS.CONFIG;
    const units = C.UNIT_TYPES.filter(u => u.at.includes(settlement.type));
    const rowH = 80;
    const ch = 100 + units.length * rowH + 56;
    const { cx, cy, cw } = this._panelFrame(`Ordu Topla — ${settlement.name}`, `Altın: ${party.gold}  ·  Mevcut ordu: ${party.troops}`, ch);
    const ctx = this.ctx;
    const rects = { rows: [] };
    let ry = cy + 86;
    const rx = cx + 20, rw = cw - 40;
    for (const unit of units) {
      const have = party.army[unit.id] || 0;
      ctx.textAlign = 'left';
      ctx.fillStyle = INK;
      ctx.font = '600 14px "Trebuchet MS", sans-serif';
      ctx.fillText(`${unit.name}  (${have})`, rx, ry + 14);
      ctx.textAlign = 'right';
      ctx.fillStyle = GOLD;
      ctx.font = '600 12px "Trebuchet MS", sans-serif';
      ctx.fillText(`${unit.cost} altın`, rx + rw, ry + 14);
      ctx.textAlign = 'left';
      ctx.fillStyle = DIM;
      ctx.font = '400 11px "Trebuchet MS", sans-serif';
      wrapText(ctx, unit.desc, rx, ry + 32, rw - 66, 14);
      const btn = this._button(rx + rw - 52, ry + 42, 52, 30, '+1', { disabled: party.gold < unit.cost });
      rects.rows.push({ id: unit.id, btn });
      ry += rowH;
    }
    rects.back = this._button(cx + cw / 2 - 70, cy + ch - 46, 140, 38, 'Kapat', {});
    return rects;
  }

  drawTalkScreen(settlement, npc) {
    const ch = 220;
    const { cx, cy, cw } = this._panelFrame('Köylülerle Konuş', settlement.name, ch);
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = '600 14px "Trebuchet MS", sans-serif';
    ctx.fillText(npc.name, cx + cw / 2, cy + 88);
    ctx.fillStyle = INK;
    ctx.font = '400 13px "Trebuchet MS", sans-serif';
    wrapText(ctx, `"${npc.line}"`, cx + cw / 2, cy + 112, cw - 56, 18);

    const rects = {};
    rects.back = this._button(cx + cw / 2 - 70, cy + ch - 50, 140, 38, 'Ayrıl', {});
    return rects;
  }

  // ---- battle screens --------------------------------------------------
  //
  // A real open battlefield — not a grid, a small rectangular field (see
  // config BATTLE.FIELD_W/H) with a free-form zone for you at the bottom
  // and the enemy at the top. Troops are grouped into small squads (see
  // buildSquadsForArmy in main.js) so a big army stays tappable: you pick
  // one from the tray and tap anywhere in your zone to drop it there —
  // wherever you want, not a discrete cell. Once the fight starts, every
  // squad is a live agent on this same field: it walks toward the nearest
  // enemy, archers hold range and shoot, melee grinds down whoever they're
  // engaged with, all rendered as little clusters of individual soldiers.

  _squadVisual(unitId) {
    const colors = { infantry: '#8fa6c9', archer: '#8fce6a', cavalry: '#e0a850', bandit: '#c0564f' };
    const glyphs = { infantry: 'P', archer: 'O', cavalry: 'S', bandit: 'H' };
    return { color: colors[unitId] || '#c9c0a8', glyph: glyphs[unitId] || '?' };
  }

  // Field-space <-> screen-space transform for the battlefield panel, plus
  // the player/enemy zone bounds (both in field units and in screen px).
  _battleFieldGeom(y0, y1) {
    const C = KINGS.CONFIG.BATTLE;
    const w = this.cssW;
    const availW = w - 32;
    const availH = Math.max(80, y1 - y0);
    const scale = Math.min(availW / C.FIELD_W, availH / C.FIELD_H);
    const fw = C.FIELD_W * scale, fh = C.FIELD_H * scale;
    const fx0 = (w - fw) / 2;
    const fy0 = y0 + Math.max(0, (availH - fh) / 2);
    const [pz0f, pz1f] = C.PLAYER_ZONE_Y_FRAC;
    const [ez0f, ez1f] = C.ENEMY_ZONE_Y_FRAC;
    const geom = {
      scale, fx0, fy0, fw, fh,
      playerZone: { y0f: pz0f * C.FIELD_H, y1f: pz1f * C.FIELD_H, y0: fy0 + pz0f * fh, y1: fy0 + pz1f * fh },
      enemyZone: { y0f: ez0f * C.FIELD_H, y1f: ez1f * C.FIELD_H, y0: fy0 + ez0f * fh, y1: fy0 + ez1f * fh },
    };
    geom.toScreen = (fx, fy) => [fx0 + fx * scale, fy0 + fy * scale];
    geom.toField = (sx, sy) => [(sx - fx0) / scale, (sy - fy0) / scale];
    return geom;
  }

  _drawBattleFieldBg(geom) {
    const ctx = this.ctx;
    const pad = 10;
    ctx.fillStyle = 'rgba(30, 46, 20, 0.55)';
    roundRect(ctx, geom.fx0 - pad, geom.fy0 - pad, geom.fw + pad * 2, geom.fh + pad * 2, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 226, 122, 0.35)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, geom.fx0 - pad, geom.fy0 - pad, geom.fw + pad * 2, geom.fh + pad * 2, 10); ctx.stroke();

    const grad = ctx.createLinearGradient(0, geom.fy0, 0, geom.fy0 + geom.fh);
    grad.addColorStop(0, 'rgba(110, 140, 82, 0.25)');
    grad.addColorStop(1, 'rgba(84, 122, 64, 0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(geom.fx0, geom.fy0, geom.fw, geom.fh);

    ctx.fillStyle = 'rgba(192, 86, 79, 0.10)';
    ctx.fillRect(geom.fx0, geom.enemyZone.y0, geom.fw, geom.enemyZone.y1 - geom.enemyZone.y0);
    ctx.fillStyle = 'rgba(143, 206, 106, 0.12)';
    ctx.fillRect(geom.fx0, geom.playerZone.y0, geom.fw, geom.playerZone.y1 - geom.playerZone.y0);

    const lineY = (geom.enemyZone.y1 + geom.playerZone.y0) / 2;
    ctx.strokeStyle = 'rgba(255, 226, 122, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(geom.fx0, lineY); ctx.lineTo(geom.fx0 + geom.fw, lineY); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(geom.fx0, geom.fy0, geom.fw, geom.fh);
  }

  _drawMiniSoldier(x, y, r, unitId, phase) {
    const ctx = this.ctx;
    const { color } = this._squadVisual(unitId);
    const bob = Math.sin(this.animT * 6 + phase) * r * 0.12;
    if (unitId === 'cavalry') {
      ctx.fillStyle = '#6b4a2a';
      ctx.beginPath(); ctx.ellipse(x, y + bob, r * 1.15, r * 0.58, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x - r * 0.15, y + bob - r * 0.5, r * 0.48, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y + bob, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e7dfc9';
      ctx.beginPath(); ctx.arc(x, y + bob - r * 0.6, r * 0.32, 0, Math.PI * 2); ctx.fill();
      if (unitId === 'archer') {
        ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, r * 0.12);
        ctx.beginPath(); ctx.arc(x + r * 0.55, y + bob, r * 0.42, -1.1, 1.1); ctx.stroke();
      } else {
        ctx.strokeStyle = '#cfcabb'; ctx.lineWidth = Math.max(1, r * 0.14);
        ctx.beginPath(); ctx.moveTo(x - r * 0.5, y + bob + r * 0.15); ctx.lineTo(x + r * 0.6, y + bob - r * 0.35); ctx.stroke();
      }
    }
  }

  // Draws one squad as a small cluster of individual soldiers (capped at 6
  // so a big squad doesn't turn into a blob of dots) at its live field
  // position, rotated to face wherever it's currently fighting/heading.
  // Fogged enemy squads render as generic dark silhouettes so their exact
  // count never leaks through the visual before the fight starts.
  _drawSquadCluster(sx, sy, scale, sq, opts = {}) {
    const ctx = this.ctx;
    const n = opts.hide ? 3 : Math.max(1, Math.min(6, sq.count));
    const offsets = CLUSTER_OFFSETS[n] || CLUSTER_OFFSETS[1];
    const spread = scale * 0.5;
    const miniR = Math.max(5, scale * 0.3);
    const angle = (sq.angle ?? (sq.side === 'player' ? -Math.PI / 2 : Math.PI / 2)) + Math.PI / 2;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    for (const [ox, oy] of offsets) {
      const x = ox * spread, y = oy * spread;
      if (opts.hide) {
        ctx.fillStyle = 'rgba(90, 40, 40, 0.65)';
        ctx.beginPath(); ctx.arc(x, y, miniR * 0.55, 0, Math.PI * 2); ctx.fill();
      } else {
        this._drawMiniSoldier(x, y, miniR, sq.unitId, ox * 3 + oy * 5 + sx * 0.01);
      }
    }
    ctx.restore();

    const badgeY = sy + spread * 0.95;
    ctx.fillStyle = 'rgba(10,8,5,0.78)';
    ctx.beginPath(); ctx.arc(sx, badgeY, Math.max(9, scale * 0.2), 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.max(10, scale * 0.24)}px "Trebuchet MS", sans-serif`;
    ctx.fillStyle = opts.hide ? DIM : INK;
    ctx.fillText(opts.hide ? '?' : String(sq.count), sx, badgeY + 4);
  }

  _drawBattleUnits(geom, battle, fogEnemy) {
    const ctx = this.ctx;
    const squads = battle.squads.filter(s => s.fx != null && s.count > 0).slice().sort((a, b) => a.fy - b.fy);
    for (const sq of squads) {
      const [sx, sy] = geom.toScreen(sq.fx, sq.fy);
      this._drawSquadCluster(sx, sy, geom.scale, sq, { hide: fogEnemy && sq.side === 'enemy' });
    }

    for (const p of battle.particles || []) {
      const target = battle.squads.find(s => s.id === p.targetId);
      const toPos = target ? { x: target.fx, y: target.fy } : p.fromPos;
      const t = Math.max(0, Math.min(1, p.t));
      const fx = p.fromPos.x + (toPos.x - p.fromPos.x) * t;
      const fy = p.fromPos.y + (toPos.y - p.fromPos.y) * t;
      const [sx, sy] = geom.toScreen(fx, fy);
      const arc = -Math.sin(t * Math.PI) * geom.scale * 1.1;
      ctx.save();
      ctx.translate(sx, sy + arc);
      const dxs = (toPos.x - p.fromPos.x), dys = (toPos.y - p.fromPos.y);
      ctx.rotate(Math.atan2(dys, dxs) - Math.sin(t * Math.PI) * 0.6);
      if (p.kind === 'arrow') {
        ctx.strokeStyle = '#e7dfc9'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = '#e7dfc9';
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(3, -2.5); ctx.lineTo(3, 2.5); ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = '#c0564f';
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    for (const s of battle.sparks || []) {
      const [sx, sy] = geom.toScreen(s.x, s.y);
      const alpha = Math.max(0, 1 - s.t);
      ctx.fillStyle = `rgba(255, 210, 120, ${alpha})`;
      ctx.beginPath(); ctx.arc(sx, sy, 4 + s.t * 7, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawBattleDeployScreen(battle) {
    const ctx = this.ctx;
    const w = this.cssW, h = this.cssH;
    const bandit = battle.bandit;

    ctx.fillStyle = 'rgba(10, 14, 8, 0.90)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e07850';
    ctx.font = '700 18px "Trebuchet MS", sans-serif';
    ctx.fillText('Pusu! — ' + bandit.name, w / 2, 24);
    ctx.fillStyle = DIM;
    ctx.font = '500 12px "Trebuchet MS", sans-serif';
    ctx.fillText('Askerini seç, kendi bölgende istediğin yere dokunup bırak', w / 2, 42);

    const unplaced = battle.squads.filter(s => s.side === 'player' && s.fx == null);
    const tokenSize = 40, gap = 6;
    const perRow = Math.max(1, Math.floor((w - 32 + gap) / (tokenSize + gap)));
    const trayRows = unplaced.length ? Math.max(1, Math.ceil(unplaced.length / perRow)) : 1;
    const trayAreaH = unplaced.length ? trayRows * (tokenSize + gap) : 20;
    const buttonRowH = 42;
    const bottomChromeH = 22 + trayAreaH + 10 + buttonRowH + 16;

    const geom = this._battleFieldGeom(52, h - bottomChromeH);
    this._drawBattleFieldBg(geom);
    this._drawBattleUnits(geom, battle, true);

    const trayY0 = geom.fy0 + geom.fh + 26;
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = '600 12px "Trebuchet MS", sans-serif';
    ctx.fillText(unplaced.length ? `Diz: ${unplaced.length} birlik bekliyor (açık alana istediğin gibi yerleştir)` : 'Tüm birlikler dizildi — hazır olunca başlat.', 16, trayY0 - 6);

    const rects = { fieldGeom: geom, tray: [] };
    let tx = 16, ty = trayY0, col = 0;
    for (const sq of unplaced) {
      const selected = battle.selectedSquadId === sq.id;
      this._traySquadToken(tx, ty, tokenSize, sq, selected);
      rects.tray.push({ x: tx, y: ty, w: tokenSize, h: tokenSize, squadId: sq.id });
      col++;
      if (col >= perRow) { col = 0; tx = 16; ty += tokenSize + gap; }
      else tx += tokenSize + gap;
    }

    const btnY = h - buttonRowH - 12;
    rects.autoFill = this._button(16, btnY, w - 32 - 156, buttonRowH, 'Otomatik Diz', {});
    rects.start = this._button(w - 16 - 140, btnY, 140, buttonRowH, 'Savaşı Başlat', { accent: true });
    return rects;
  }

  _traySquadToken(x, y, size, sq, selected) {
    const ctx = this.ctx;
    const { color, glyph } = this._squadVisual(sq.unitId);
    ctx.fillStyle = selected ? 'rgba(255, 226, 122, 0.30)' : color + '30';
    roundRect(ctx, x, y, size, size, 6); ctx.fill();
    ctx.strokeStyle = selected ? 'rgba(255,226,122,0.9)' : color;
    ctx.lineWidth = selected ? 2.5 : 1.4;
    roundRect(ctx, x, y, size, size, 6); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = `700 ${Math.max(11, size * 0.36)}px "Trebuchet MS", sans-serif`;
    ctx.fillText(glyph, x + size / 2, y + size * 0.5);
    ctx.fillStyle = INK;
    ctx.font = `600 ${Math.max(9, size * 0.22)}px "Trebuchet MS", sans-serif`;
    ctx.fillText(String(sq.count), x + size / 2, y + size * 0.82);
  }

  drawBattleResolvingScreen(battle) {
    const ctx = this.ctx;
    const w = this.cssW, h = this.cssH;
    const bandit = battle.bandit;

    ctx.fillStyle = 'rgba(10, 14, 8, 0.90)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = '700 18px "Trebuchet MS", sans-serif';
    ctx.fillText('Çarpışma!', w / 2, 24);
    ctx.fillStyle = DIM;
    ctx.font = '500 12px "Trebuchet MS", sans-serif';
    ctx.fillText(bandit.name + ' birlikleriyle çarpışıyorsun…', w / 2, 42);

    const feedLines = 2;
    const feedH = 22 + feedLines * 17;
    const geom = this._battleFieldGeom(52, h - feedH - 14);
    this._drawBattleFieldBg(geom);
    this._drawBattleUnits(geom, battle, false);

    const events = battle.events || [];
    const shown = events.slice(-feedLines);
    const by = h - feedH - 8;
    ctx.fillStyle = 'rgba(20, 16, 10, 0.78)';
    roundRect(ctx, 16, by, w - 32, feedH, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 226, 122, 0.35)';
    roundRect(ctx, 16, by, w - 32, feedH, 8); ctx.stroke();
    ctx.textAlign = 'center';
    shown.forEach((text, i) => {
      const isLast = i === shown.length - 1;
      ctx.fillStyle = isLast ? GOLD : DIM;
      ctx.font = `${isLast ? '600' : '500'} 13px "Trebuchet MS", sans-serif`;
      ctx.fillText(text, w / 2, by + 20 + i * 17);
    });

    return {};
  }

  drawBattleResultScreen(result, party) {
    const C = KINGS.CONFIG;
    const ch = 240;
    const title = result.won ? 'Zafer!' : 'Yenilgi';
    const sub = result.won ? 'Kaçakçıları dağıttın.' : 'Ordun dağıldı…';
    const { cx, cy, cw } = this._panelFrame(title, sub, ch, result.won ? '#8fce6a' : '#e07850');
    const ctx = this.ctx;
    let ry = cy + 94;
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = '500 13px "Trebuchet MS", sans-serif';
    if (result.casualtyCount > 0) {
      const parts = Object.entries(result.casualties).map(([id, n]) => {
        const u = C.UNIT_TYPES.find(x => x.id === id);
        return `${u ? u.name : id}: -${n}`;
      });
      wrapText(ctx, `Kayıplar: ${parts.join(', ')}`, cx + cw / 2, ry, cw - 48, 18);
    } else {
      ctx.fillText('Kayıp yok.', cx + cw / 2, ry);
    }
    ry += 40;
    if (result.won) {
      ctx.fillStyle = GOLD;
      ctx.font = '500 13px "Trebuchet MS", sans-serif';
      wrapText(ctx, 'Yendiğin kaçakçılardan ganimet aldın — devam edip tek tek incele.', cx + cw / 2, ry, cw - 48, 18);
    } else {
      ctx.fillStyle = '#e07850';
      ctx.font = '500 13px "Trebuchet MS", sans-serif';
      wrapText(ctx, 'Tutsak alındın…', cx + cw / 2, ry, cw - 48, 18);
    }
    const rects = {};
    const label = result.won ? 'Ganimete Bak' : 'Devam Et';
    rects.continue = this._button(cx + cw / 2 - 90, cy + ch - 56, 180, 44, label, { accent: true });
    return rects;
  }

  drawBattleLootScreen(lootItems, party) {
    const rowH = 40;
    const ch = 240 + lootItems.length * rowH;
    const { cx, cy, cw } = this._panelFrame('Ganimet', 'Almak istediklerini tek tek seç.', ch, '#8fce6a');
    const ctx = this.ctx;
    const rects = { rows: [] };
    let ry = cy + 78;
    const rx = cx + 20, rw = cw - 40;
    lootItems.forEach((item, i) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = item.taken ? DIM : INK;
      ctx.font = '600 14px "Trebuchet MS", sans-serif';
      ctx.fillText(item.name, rx, ry + 15);
      ctx.fillStyle = DIM;
      ctx.font = '500 12px "Trebuchet MS", sans-serif';
      ctx.fillText(`~${item.price} altın değerinde`, rx, ry + 32);
      const btn = this._button(rx + rw - 74, ry + 2, 74, 30, item.taken ? 'Alındı' : 'Al', { disabled: item.taken });
      rects.rows.push({ index: i, take: btn });
      ry += rowH;
    });
    rects.takeAll = this._button(rx, ry + 8, rw, 36, 'Tümünü Al', {});
    ry += 60;
    rects.finish = this._button(cx + cw / 2 - 80, ry, 160, 42, 'Bitir', { accent: true });
    return rects;
  }

  drawCaptivityScreen(party) {
    const ch = 180;
    const { cx, cy, cw } = this._panelFrame('Tutsaksın', 'Bir fırsatını kollayıp kaçmaya çalışıyorsun…', ch);
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = '600 15px "Trebuchet MS", sans-serif';
    const secs = Math.max(0, Math.ceil(party.captiveTimer));
    ctx.fillText(`${secs} sn…`, cx + cw / 2, cy + ch / 2 + 10);
    return {};
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word + ' ';
    } else line = test;
  }
  lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l.trim(), cx, y + i * lineH));
}

function hitTest(rect, x, y) {
  return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

// Small deterministic string hash (FNV-1a) — used to seed the purely
// decorative per-settlement crowd dots so they're stable frame to frame
// without needing any extra state stored on the settlement itself.
function simpleHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

KINGS.Renderer = Renderer;
KINGS.nightAmount = nightAmount;
KINGS.hitTest = hitTest;
