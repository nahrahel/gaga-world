// noise.js: deterministic randomness for the motion engine. OWNER: builder C.
// Everything here is allocation free after construction and depends only on seeds and inputs.

// Seeded PRNG (mulberry32). Returns a function producing floats in [0, 1).
export function makeRng(seed) {
  let a = (seed | 0) ^ 0x9e3779b9;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer hash -> [-1, 1)
function hash(i, seed) {
  let h = Math.imul((i | 0) ^ Math.imul(seed | 0, 0x2c1b3c6d), 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h & 0xffff) / 32768 - 1;
}

// Smooth 1D value noise with Catmull-Rom interpolation: C1 continuous, no forced zero crossings
// at lattice points (gradient noise has those, which reads as a hidden beat). Output roughly [-1, 1],
// RMS about 0.45.
export function n1(x, seed) {
  const i = Math.floor(x), f = x - i;
  const p0 = hash(i - 1, seed), p1 = hash(i, seed), p2 = hash(i + 1, seed), p3 = hash(i + 2, seed);
  const f2 = f * f, f3 = f2 * f;
  return 0.5 * ((2 * p1) + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f2 + (-p0 + 3 * p1 - 3 * p2 + p3) * f3);
}

// Two octaves at an irrational ratio: aperiodic, centered, RMS about 0.42.
export function n2(x, seed) {
  return 0.72 * n1(x, seed) + 0.36 * n1(x * 2.137 + 17.31, seed + 101);
}

// Three octaves, rougher (used for quake / boil textures).
export function n3(x, seed) {
  return 0.6 * n1(x, seed) + 0.35 * n1(x * 2.371 + 5.7, seed + 7) + 0.22 * n1(x * 5.113 + 9.1, seed + 13);
}

// Signed power shaping: keeps sign, sharpens (p > 1) or softens (p < 1) peaks.
export function spow(x, p) { return x < 0 ? -Math.pow(-x, p) : Math.pow(x, p); }

export function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
export function smoothstep(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
export function smoother(t) { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); }
export function lerp(a, b, t) { return a + (b - a) * t; }

// Pulse that rises fast and decays softly: used by accents. u = time since onset (s).
// rise: seconds to peak, decay: seconds to ~5%. Small overshoot is built in by the caller if wanted.
export function burst(u, rise, decay) {
  if (u <= 0) return 0;
  if (u < rise) { const x = u / rise; return Math.sin(x * Math.PI * 0.5); }
  const x = (u - rise) / decay;
  if (x >= 1.6) return 0;
  return Math.exp(-3 * x) * (1 - x / 1.6 * 0.05);
}

// Soft bump in [0,1] for |x| < 1 (raised cosine). Used for traveling pulses (balls).
export function bump(x) { return x <= -1 || x >= 1 ? 0 : 0.5 + 0.5 * Math.cos(x * Math.PI); }
