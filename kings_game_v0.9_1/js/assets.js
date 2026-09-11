window.KINGS = window.KINGS || {};

const ASSET_LIST = {
  grass: 'assets/tiles/grass.png',
  plains: 'assets/tiles/plains.png',
  forest: 'assets/tiles/forest.png',
  water: 'assets/tiles/water.png',
  mountain: 'assets/tiles/mountain.png',
  hills: 'assets/tiles/hills.png',
  road: 'assets/tiles/road.png',
  party: 'assets/sprites/party.png',
  village: 'assets/sprites/village.png',
  town: 'assets/sprites/town.png',
  castle: 'assets/sprites/castle.png',
  trader: 'assets/sprites/trader.png',
  lord: 'assets/sprites/lord.png',
  bandit: 'assets/sprites/bandit.png',
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load ' + src));
    img.src = src;
  });
}

async function loadAllAssets(onProgress) {
  const entries = Object.entries(ASSET_LIST);
  const out = {};
  let done = 0;
  for (const [key, src] of entries) {
    out[key] = await loadImage(src);
    done++;
    if (onProgress) onProgress(done, entries.length);
  }
  return out;
}

KINGS.loadAllAssets = loadAllAssets;
