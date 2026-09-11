// Procedural campaign-map generation: terrain grid + settlement placement.
window.KINGS = window.KINGS || {};

const VILLAGE_NAMES = [
  'Akkaya', 'Karlıova', 'Demirtaş', 'Gölyazı', 'Kumluca', 'Yeşilköy',
  'Taşoluk', 'Bozdağ', 'Kayaçayır', 'Çamlıbel', 'Sazköy', 'Incirli',
  'Kurtbeli', 'Alıçlı', 'Söğütözü', 'Karakuyu', 'Yenimahalle', 'Pınarbaşı',
  'Çayırönü', 'Dağdibi', 'Yolboyu', 'Kirazlık', 'Ardıçlı', 'Bulakdere',
  'Güvenevler', 'Tuzköy', 'Meşelik', 'Karabayır', 'Ağaçören', 'Değirmenli',
  'Yaylacık', 'Kaleardı', 'Suvermez', 'Boğazören', 'Kestanelik', 'Aktaş',
  'Karagöl', 'Elmalık', 'Çobanoba', 'Kayabükü', 'Tavşanlı', 'Üçpınar',
  'Bademözü', 'Saraycık', 'Kirazören', 'Yurtbaşı', 'Karlıdere', 'Cevizli',
  'Otluk', 'Dutluca', 'Fındıklı', 'Sarıçam', 'Gökçeyurt', 'Balpınar',
];
const TOWN_NAMES = [
  'Aksu', 'Kayseri', 'Sivrihan', 'Boğazkale', 'Yenişehir', 'Akhisar',
  'Karahan', 'Gümüşkent', 'Demirsu', 'Altınova', 'Kartepe', 'Bereketli',
  'Ulukışla', 'Taşkale', 'Karacabey', 'Güneyabat', 'Aktepe', 'Sarıkale',
  'Kızılırmak', 'Yalıboyu', 'Ağızkara', 'Bozüyük',
];
const CASTLE_NAMES = [
  'Karataş Kalesi', 'Demirkapı Kalesi', 'Kartalyuva Kalesi', 'Akçakale',
  'Yılankaya Kalesi', 'Boratepe Kalesi', 'Karanfil Kalesi', 'Ejderkaya Kalesi',
  'Sancakburnu Kalesi', 'Kurtboğazı Kalesi', 'Gökkule Kalesi',
  'Alacahan Kalesi', 'Demirtepe Kalesi', 'Kızılsur Kalesi', 'Ateşkaya Kalesi',
];

function classify(elev, moist) {
  if (elev < 0.30) return 'water';
  if (elev > 0.74) return 'mountain';
  if (elev > 0.60) return 'hills';
  if (moist > 0.58) return 'forest';
  if (moist < 0.34) return 'plains';
  return 'grass';
}

function generateWorld(seed) {
  const C = KINGS.CONFIG;
  const w = C.WORLD_W, h = C.WORLD_H;
  const elevNoise = new KINGS.ValueNoise2D(seed, 9);
  const moistNoise = new KINGS.ValueNoise2D(seed + 7919, 6);
  const tiles = new Array(h);
  for (let y = 0; y < h; y++) {
    tiles[y] = new Array(w);
    for (let x = 0; x < w; x++) {
      // push elevation down near the border so the playable region reads as
      // an island/region rather than cutting off abruptly
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y) / (Math.min(w, h) * 0.28);
      const edgeFalloff = Math.min(1, edge);
      let e = elevNoise.fbm(x, y, 5, 2.0, 0.5);
      e = e * (0.55 + 0.45 * edgeFalloff);
      const m = moistNoise.fbm(x + 500, y + 500, 4, 2.0, 0.55);
      tiles[y][x] = classify(e, m);
    }
  }
  return { w, h, tiles };
}

function isLand(world, x, y) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return false;
  const t = world.tiles[y][x];
  return t !== 'water' && t !== 'mountain';
}

function placeSettlements(world, seed) {
  const rand = KINGS.mulberry32(seed + 42);
  const C = KINGS.CONFIG;
  const placed = [];

  function farEnough(x, y) {
    for (const s of placed) {
      const dx = s.x - x, dy = s.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < C.SETTLEMENT_MIN_DIST) return false;
    }
    return true;
  }

  function place(type, name) {
    for (let tries = 0; tries < 400; tries++) {
      const x = 3 + Math.floor(rand() * (world.w - 6));
      const y = 3 + Math.floor(rand() * (world.h - 6));
      if (isLand(world, x, y) && farEnough(x, y)) {
        placed.push({ x, y, type, name, id: 's' + placed.length });
        return true;
      }
    }
    return false;
  }

  let vi = 0, ti = 0, ci = 0;
  for (let i = 0; i < C.SETTLEMENT_COUNT.castle; i++) place('castle', CASTLE_NAMES[ci++ % CASTLE_NAMES.length]);
  for (let i = 0; i < C.SETTLEMENT_COUNT.town; i++) place('town', TOWN_NAMES[ti++ % TOWN_NAMES.length]);
  for (let i = 0; i < C.SETTLEMENT_COUNT.village; i++) place('village', VILLAGE_NAMES[vi++ % VILLAGE_NAMES.length]);

  return placed;
}

// Scatters one "capital seed" per kingdom across the land, then assigns
// every settlement to its nearest seed (a simple Voronoi partition) so each
// kingdom's territory reads as one contiguous region on the map rather than
// a random scatter of colours.
function assignKingdoms(world, settlements, seed) {
  const rand = KINGS.mulberry32(seed + 909);
  const kingdoms = KINGS.CONFIG.KINGDOMS;
  const seeds = [];

  function farEnough(x, y, minDist) {
    for (const s of seeds) {
      if (Math.hypot(s.x - x, s.y - y) < minDist) return false;
    }
    return true;
  }

  const minDist = Math.min(world.w, world.h) * 0.28;
  for (let i = 0; i < kingdoms.length; i++) {
    let placedPt = null;
    for (let tries = 0; tries < 500 && !placedPt; tries++) {
      const x = Math.floor(rand() * world.w);
      const y = Math.floor(rand() * world.h);
      if (isLand(world, x, y) && farEnough(x, y, minDist)) placedPt = { x, y };
    }
    if (!placedPt) {
      // fallback: just drop it anywhere on land, distance constraint be damned
      for (let tries = 0; tries < 500 && !placedPt; tries++) {
        const x = Math.floor(rand() * world.w);
        const y = Math.floor(rand() * world.h);
        if (isLand(world, x, y)) placedPt = { x, y };
      }
    }
    seeds.push(placedPt || { x: world.w / 2, y: world.h / 2 });
  }

  for (const s of settlements) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < seeds.length; i++) {
      const d = Math.hypot(seeds[i].x - s.x, seeds[i].y - s.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    s.kingdom = kingdoms[best];
  }
  return seeds;
}

const NPC_FIRST_NAMES = [
  'Ahmet', 'Fatma', 'Yusuf', 'Elif', 'Hasan', 'Ayşe', 'Mehmet', 'Zehra',
  'Kerim', 'Sultan', 'Osman', 'Hatun', 'İbrahim', 'Meryem', 'Bekir',
];
const NPC_LINES = [
  'Bu yıl hasat iyi geçti, umarım vergiciler böyle bilmez.',
  'Dağın ardındaki yollarda eşkıya var derler, dikkatli git.',
  'Krallığımızın bayrağı bu topraklarda dalgalanalı çok oldu.',
  'Komşu köyden bir tüccar geçti, fiyatları yükseltip gitti.',
  'Çocuklarım seni sordu, "şövalye mi" diye. Ben de bilmiyorum dedim.',
  'Bu kışı da atlattık, tanrılara şükür.',
  'Kaledeki lord bu ay yine asker topluyormuş.',
  'Sınırın ötesinde başka bir krallığın süvarileri görülmüş.',
  'Pazar günleri bu meydan tıklım tıklım dolar.',
  'Uzak diyarlardan geldiğini duydum, hoş geldin yabancı.',
];

function findStart(world, settlements) {
  // Start the party just beside the first town (or castle if no town).
  const home = settlements.find(s => s.type === 'town') || settlements[0];
  for (let r = 1; r < 6; r++) {
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) {
      const x = home.x + dx, y = home.y + dy;
      if (isLand(world, x, y)) return { x: x + 0.5, y: y + 0.5, home };
    }
  }
  return { x: home.x + 1.5, y: home.y + 0.5, home };
}

KINGS.generateWorld = generateWorld;
KINGS.placeSettlements = placeSettlements;
KINGS.assignKingdoms = assignKingdoms;
KINGS.isLand = isLand;
KINGS.findStart = findStart;
KINGS.NPC_FIRST_NAMES = NPC_FIRST_NAMES;
KINGS.NPC_LINES = NPC_LINES;
