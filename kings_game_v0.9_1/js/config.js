// Global tunables for the campaign-map prototype. Kept in one place so the
// next increments (battles, towns, AI lords...) can read/override them
// without hunting through the codebase.
window.KINGS = window.KINGS || {};

KINGS.CONFIG = {
  WORLD_W: 210,           // world size in tiles
  WORLD_H: 210,
  TILE_SRC: 64,           // source pixel-art tile resolution
  DRAW_TILE: 40,          // on-screen tile size in CSS px (camera zoom baseline)
  MIN_DRAW_TILE: 10,      // zoomed all the way out
  MAX_DRAW_TILE: 76,      // zoomed all the way in
  WHEEL_ZOOM_SENSITIVITY: 0.045,
  PINCH_ZOOM_SENSITIVITY: 0.6,

  MOVE_SPEED_TILES_PER_SEC: 1.3, // base speed at 1x game speed, normal terrain
  ARRIVE_DIST: 0.12,             // how close to a click-destination counts as "arrived"
  TERRAIN_SPEED_MULT: {
    water: 0,             // impassable for now (no boats yet)
    mountain: 0.35,
    forest: 0.7,
    hills: 0.8,
    plains: 1.1,
    grass: 1.0,
    road: 1.4,
  },

  GAME_SPEEDS: [1, 2, 3],
  HOURS_PER_REAL_SECOND: 0.9, // campaign clock speed at 1x, unpaused
  START_DATE: { year: 1257, day: 1, hour: 8 }, // High Middle Ages-ish setting

  SETTLEMENT_COUNT: { castle: 13, town: 20, village: 48 },
  SETTLEMENT_MIN_DIST: 6, // tiles

  // Icon draw-scale and label size per settlement type — towns are the
  // biggest/grandest, castles mid-sized forts, villages the smallest, so
  // the hierarchy reads at a glance even before you can make out the art.
  // Sized generously so names/icons stay legible while zoomed out.
  SETTLEMENT_VISUAL: {
    town: { scale: 4.2, font: 0.62 },
    castle: { scale: 3.3, font: 0.52 },
    village: { scale: 2.2, font: 0.40 },
  },
  // ambient, purely-decorative crowd of little townsfolk dots drawn around
  // each settlement (more at towns, since those should feel like the
  // biggest, busiest, most alive places on the map)
  SETTLEMENT_CROWD: { town: 10, castle: 6, village: 3 },

  KINGDOMS: [
    { id: 'k1', name: 'Kızılkartal Krallığı', color: '#c0392b' },
    { id: 'k2', name: 'Gökyele Krallığı', color: '#2471a3' },
    { id: 'k3', name: 'Yeşilorman Beyliği', color: '#17a589' },
    { id: 'k4', name: 'Morkale Krallığı', color: '#7d3c98' },
    { id: 'k5', name: 'Demirtaç Krallığı', color: '#d35400' },
    { id: 'k6', name: 'Kumkale Sultanlığı', color: '#b7950b' },
    { id: 'k7', name: 'Sisçelik Krallığı', color: '#c2185b' },
  ],

  NPC: {
    TRADER_COUNT: 30,
    LORD_COUNT: 13,
    BANDIT_COUNT: 16,
    TRADER_SPEED: 1.6,   // tiles/sec at 1x, before terrain mult
    LORD_SPEED: 1.4,
    BANDIT_SPEED: 1.7,
    ARRIVE_DIST: 0.15,
    PAUSE_AT_STOP: [3, 8], // seconds range, "trading"/"resting" at a settlement
    LORD_MIN_TROOPS: 15,
    LORD_MAX_TROOPS: 60,
    BANDIT_MIN_TROOPS: 5,
    BANDIT_MAX_TROOPS: 40,
    BANDIT_ROAM_RADIUS: 14,   // tiles, how far a bandit wanders from its last stop when idle
    BANDIT_AGGRO_RADIUS: 9,   // tiles, how far a bandit notices a target and gives chase
    BANDIT_CONTACT_DIST: 0.6, // tiles, how close counts as "caught" -> battle
    CARAVAN_SPEED: 1.5,       // tiles/sec at 1x, before terrain mult — player-owned trade caravans
  },

  // Player-owned trade caravans, bought from a settlement's "Kervan Oluştur"
  // screen. They wander and "trade" just like NPC traders (same movement/
  // stop AI) and pay the player a bit of gold every time they complete a
  // stop, scaled to how many troops (i.e. how much was invested) they have.
  CARAVAN: {
    CHEAP_COST: 1300, CHEAP_TROOPS: 20,
    EXPENSIVE_COST: 2000, EXPENSIVE_TROOPS: 40,
    PROFIT_PER_TROOP: [3, 7], // gold per troop, per completed trade stop
  },

  // `price` here is a *base* price — actual buy/sell prices differ per
  // settlement and drift over time (see js/economy.js), so real trading
  // (buy cheap here, sell high there) is worthwhile, like Bannerlord.
  GOODS: [
    { id: 'bugday', name: 'Buğday', price: 4 },
    { id: 'demir', name: 'Demir', price: 11 },
    { id: 'kumas', name: 'Kumaş', price: 8 },
    { id: 'sarap', name: 'Şarap', price: 13 },
    { id: 'baharat', name: 'Baharat', price: 26 },
  ],
  // Battle loot — sold at any settlement's market exactly like trade
  // goods, just usually acquired by winning a fight rather than buying.
  LOOT_GOODS: [
    { id: 'kalkan', name: 'Kalkan', price: 9 },
    { id: 'mizrak', name: 'Mızrak', price: 12 },
    { id: 'kilic', name: 'Kılıç', price: 17 },
    { id: 'zirh', name: 'Zırh', price: 28 },
  ],

  // Recruitable troop types. `at` says which settlement types offer them —
  // villages only give cheap militia, castles field the full roster.
  UNIT_TYPES: [
    {
      id: 'infantry', name: 'Piyade', cost: 20, power: 1.0,
      desc: 'Ucuz ve dengeli. Her arazide işe yarar, savunmada güçlüdür.',
      at: ['village', 'town', 'castle'],
    },
    {
      id: 'archer', name: 'Okçu', cost: 35, power: 1.25,
      desc: 'Çarpışmadan önce uzaktan vurur. Süvariye karşı savunmasızdır.',
      at: ['town', 'castle'],
    },
    {
      id: 'cavalry', name: 'Süvari', cost: 60, power: 1.6,
      desc: 'Hızlı ve yıkıcı bir hücum gücü. Dar/engebeli arazide zayıflar.',
      at: ['castle'],
    },
  ],
  RECRUIT_COST: 25, // fallback, unused now that UNIT_TYPES carries its own costs
  START_GOLD: 200,
  START_TROOPS: 4,

  BATTLE: {
    CAPTIVE_SECONDS: [18, 32],
    BASE_BANDIT_POWER: 0.85,     // per-bandit-troop power, vs. our per-unit `power`
    MAX_PLAYER_SQUADS: 16,       // troops are grouped into placeable "squads" so a big army stays tappable
    MAX_ENEMY_SQUADS: 15,

    // The battlefield is a real open field (not a grid of cells) — a small
    // rectangle in its own "field units", place squads anywhere within your
    // zone. PLAYER/ENEMY_ZONE_Y_FRAC are fractions of FIELD_H marking each
    // side's placement band; the gap between them is no-man's-land.
    FIELD_W: 22,
    FIELD_H: 15,
    PLAYER_ZONE_Y_FRAC: [0.56, 0.95],
    ENEMY_ZONE_Y_FRAC: [0.05, 0.40],

    // Live combat tuning — squads are autonomous agents once the fight
    // starts: they walk to the nearest enemy, archers hold range and loose
    // arrows, melee chips away at whoever they're engaged with. The fight
    // ends the moment one side is wiped (or MAX_BATTLE_SECONDS, as a safety
    // net so a battle can never hang).
    SQUAD_SPEED: 2.6,            // field-units/sec
    CAVALRY_SPEED_MULT: 1.55,
    MELEE_RANGE: 0.85,
    ARCHER_SHOOT_RANGE: 5.5,
    ARCHER_SHOT_INTERVAL: [0.65, 1.05],
    ARCHER_SHOT_DAMAGE_FRAC: 0.16, // fraction of the archer squad's current power per landed shot
    MELEE_ATTACK_RATE: 0.5,        // fraction of attacker power dealt per second while engaged
    MAX_BATTLE_SECONDS: 26,
  },

  SAVE_KEY: 'kings_save_v3',
};
