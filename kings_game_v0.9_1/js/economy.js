// Per-settlement, time-drifting prices — so the market actually matters:
// the same good costs a different amount in every town/castle/village, and
// keeps drifting as the calendar advances, the way Bannerlord's markets do
// (buy low somewhere, carry it, sell high somewhere else).
window.KINGS = window.KINGS || {};

function hashInt(a, b) {
  let h = (a * 374761393 + b * 668265263) ^ (a >> 13);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 131 + s.charCodeAt(i)) >>> 0;
  return h;
}

// A fixed "this settlement is naturally cheap/expensive for this good"
// character (e.g. a farming village always undercuts everyone on wheat).
function baseMultiplier(settlement, goodId) {
  const seed = hashInt((settlement.x * 2654435761) >>> 0, (settlement.y * 40503 + strHash(goodId)) >>> 0);
  const r = (seed % 10000) / 10000; // 0..1, stable per settlement+good
  return 0.6 + r * 0.9; // 0.6 .. 1.5
}

// A slow sine drift on top of the base multiplier, keyed off the in-game
// day, so prices keep genuinely changing the longer you play (and are
// different again if you come back to the same market later).
function driftMultiplier(settlement, goodId, dayIndex) {
  const seed = hashInt((settlement.x * 92821 + settlement.y * 6151) >>> 0, strHash(goodId + '_drift'));
  const phase = (seed % 10000) / 10000 * Math.PI * 2;
  const speed = 0.12 + ((seed >>> 8) % 100) / 100 * 0.18; // radians per in-game day
  return 1 + 0.25 * Math.sin(dayIndex * speed + phase);
}

function currentPrice(settlement, good, calendar) {
  const dayIndex = calendar ? calendar.dayIndex : 0;
  const mult = baseMultiplier(settlement, good.id) * driftMultiplier(settlement, good.id, dayIndex);
  return Math.max(1, Math.round(good.price * mult));
}

// A buy/sell spread (you always pay a bit more than you'd get selling back)
// is what makes actual trade routes — not just flipping goods in place —
// the profitable move.
function buyPrice(settlement, good, calendar) {
  return Math.max(1, Math.round(currentPrice(settlement, good, calendar) * 1.15));
}
function sellPrice(settlement, good, calendar) {
  return Math.max(1, Math.round(currentPrice(settlement, good, calendar) * 0.85));
}

KINGS.currentPrice = currentPrice;
KINGS.buyPrice = buyPrice;
KINGS.sellPrice = sellPrice;
