// Deterministic PRNG + smooth value-noise, pure vanilla JS (no deps) so the
// same seed always regenerates the same map — needed for save/continue.
window.KINGS = window.KINGS || {};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class ValueNoise2D {
  constructor(seed, cell = 6) {
    this.rand = mulberry32(seed);
    this.cell = cell;
    this.cache = new Map();
  }
  _lattice(ix, iy) {
    const key = ix + ',' + iy;
    let v = this.cache.get(key);
    if (v === undefined) {
      // hash-based per-point pseudo random, independent of call order
      const s = Math.sin(ix * 127.1 + iy * 311.7 + this._seedOffset()) * 43758.5453;
      v = s - Math.floor(s);
      this.cache.set(key, v);
    }
    return v;
  }
  _seedOffset() {
    if (this.__off === undefined) this.__off = this.rand() * 1000;
    return this.__off;
  }
  static smooth(t) { return t * t * (3 - 2 * t); }
  sample(x, y) {
    const c = this.cell;
    const x0 = Math.floor(x / c), y0 = Math.floor(y / c);
    const tx = ValueNoise2D.smooth((x / c) - x0);
    const ty = ValueNoise2D.smooth((y / c) - y0);
    const v00 = this._lattice(x0, y0);
    const v10 = this._lattice(x0 + 1, y0);
    const v01 = this._lattice(x0, y0 + 1);
    const v11 = this._lattice(x0 + 1, y0 + 1);
    const a = v00 + (v10 - v00) * tx;
    const b = v01 + (v11 - v01) * tx;
    return a + (b - a) * ty;
  }
  fbm(x, y, octaves = 4, lac = 2.0, gain = 0.5) {
    let amp = 0.5, freq = 1.0, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.sample(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lac;
    }
    return sum / norm;
  }
}

KINGS.mulberry32 = mulberry32;
KINGS.ValueNoise2D = ValueNoise2D;
