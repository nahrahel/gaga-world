#!/usr/bin/env node
// build-body.mjs (builder A). Sculpts the Gaga World soloist as a signed distance field of anatomical primitives,
// polygonizes it with sparse surface nets, projects every vertex onto the exact field, decimates with quadric error
// metrics, takes normals from the analytic field, computes chain-restricted skin weights (4 influences, extra helper
// bones for shoulder/elbow/forearm-twist/hip/knee), flesh and cavity attributes, and packs src/assets/body-data.js.
// Node >= 20, no npm deps.  Usage: node tools/build-body.mjs [--h=0.002] [--target=100000] [--out=path]
// Debug: --slice=cx,cy,cz,ux,uy,uz,vx,vy,vz,halfSize prints an ASCII cross-section of the field and exits.
import { BONES, BONE_BY_NAME } from '../src/skeleton.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARGS = Object.fromEntries(process.argv.slice(2).map(a => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? '1'] : [a, '1']; }));
const H = +(ARGS.h ?? 0.002);
const TARGET = +(ARGS.target ?? 100000);
const OUT = resolve(ROOT, ARGS.out ?? 'src/assets/body-data.js');
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s]`, ...a);

// ---------------------------------------------------------------- math
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function combo(o, ...vs) { const r = [o[0], o[1], o[2]]; for (let i = 0; i < vs.length; i += 2) { r[0] += vs[i][0] * vs[i + 1]; r[1] += vs[i][1] * vs[i + 1]; r[2] += vs[i][2] * vs[i + 1]; } return r; }
function frameU(u, ref) { u = norm(u); let v = sub(ref, mul(u, dot(ref, u))); if (len(v) < 1e-6) v = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], v = sub(v, mul(u, dot(v, u))); v = norm(v); return [u, v, cross(u, v)]; }
function rotAbout(v, axis, deg) { const k = norm(axis), a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), kd = dot(k, v); return [v[0] * c + kv[0] * s + k[0] * kd * (1 - c), v[1] * c + kv[1] * s + k[1] * kd * (1 - c), v[2] * c + kv[2] * s + k[2] * kd * (1 - c)]; }
function rotFrame(F, axis, deg) { return F.map(v => rotAbout(v, axis, deg)); }
function distSeg(p, a, b) { const ab = sub(b, a), t = clamp(dot(sub(p, a), ab) / dot(ab, ab), 0, 1); return dist(p, combo(a, ab, t)); }
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function smax(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; }
const WORLD = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// ---------------------------------------------------------------- skeleton access
const BN = n => BONE_BY_NAME[n];
const HD = n => BN(n).head, TLp = n => BN(n).tail, DR = n => BN(n).dir, LN = n => BN(n).length;
const SIDES = [[1, '_L'], [-1, '_R']];

// ---------------------------------------------------------------- primitives
class Cone { // round cone a->b with radii ra, rb; cross-section scaled by sv (frame v from ref) and sw
  constructor(a, b, ra, rb, sv = 1, sw = 1, ref = [0, 1, 0]) {
    const ab = sub(b, a), L = len(ab), F = frameU(ab, ref);
    this.a = a; this.L = L; [this.u, this.v, this.w] = F; this.ra = ra; this.rb = rb; this.isv = 1 / sv; this.isw = 1 / sw;
    this.sc = Math.min(1, sv, sw); const l2 = L * L, rr = ra - rb; this.l2 = l2; this.rr = rr; this.a2 = l2 - rr * rr; this.il2 = 1 / l2;
    const ext = Math.max(ra, rb) * Math.max(1, sv, sw);
    this.bb = [Math.min(a[0], b[0]) - ext, Math.min(a[1], b[1]) - ext, Math.min(a[2], b[2]) - ext, Math.max(a[0], b[0]) + ext, Math.max(a[1], b[1]) + ext, Math.max(a[2], b[2]) + ext];
  }
  ev(x, y, z) {
    const px = x - this.a[0], py = y - this.a[1], pz = z - this.a[2], u = this.u, v = this.v, w = this.w;
    const lu = px * u[0] + py * u[1] + pz * u[2], lv = (px * v[0] + py * v[1] + pz * v[2]) * this.isv, lw = (px * w[0] + py * w[1] + pz * w[2]) * this.isw;
    const L = this.L, l2 = this.l2, rr = this.rr, a2 = this.a2, il2 = this.il2;
    const yy = lu * L, zz = yy - l2, x2 = (lv * lv + lw * lw) * l2 * l2, y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    let d;
    if (Math.sign(zz) * a2 * z2 > k) d = Math.sqrt(x2 + z2) * il2 - this.rb;
    else if (Math.sign(yy) * a2 * y2 < k) d = Math.sqrt(x2 + y2) * il2 - this.ra;
    else d = (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - this.ra;
    return d * this.sc;
  }
}
class Ell { // ellipsoid, axes = 3 orthonormal vectors, r = radii along them
  constructor(c, r, axes = WORLD) {
    this.c = c; this.r = r; this.ax = axes; this.mr = Math.min(...r); const e = Math.max(...r);
    this.bb = [c[0] - e, c[1] - e, c[2] - e, c[0] + e, c[1] + e, c[2] + e];
  }
  ev(x, y, z) {
    const px = x - this.c[0], py = y - this.c[1], pz = z - this.c[2], A = this.ax, r = this.r;
    const a = (px * A[0][0] + py * A[0][1] + pz * A[0][2]) / r[0], b = (px * A[1][0] + py * A[1][1] + pz * A[1][2]) / r[1], c = (px * A[2][0] + py * A[2][1] + pz * A[2][2]) / r[2];
    const k0 = Math.sqrt(a * a + b * b + c * c), k1 = Math.sqrt((a / r[0]) ** 2 + (b / r[1]) ** 2 + (c / r[2]) ** 2);
    if (k1 < 1e-12) return -this.mr;
    return k0 * (k0 - 1) / k1;
  }
}
class Box { // rounded box, half = outer half extents along axes, rnd = rounding radius
  constructor(c, half, rnd, axes = WORLD) {
    this.c = c; this.h = half; this.rnd = rnd; this.ax = axes; const e = len(half);
    this.bb = [c[0] - e, c[1] - e, c[2] - e, c[0] + e, c[1] + e, c[2] + e];
  }
  ev(x, y, z) {
    const px = x - this.c[0], py = y - this.c[1], pz = z - this.c[2], A = this.ax, h = this.h, r = this.rnd;
    const qx = Math.abs(px * A[0][0] + py * A[0][1] + pz * A[0][2]) - h[0] + r, qy = Math.abs(px * A[1][0] + py * A[1][1] + pz * A[1][2]) - h[1] + r, qz = Math.abs(px * A[2][0] + py * A[2][1] + pz * A[2][2]) - h[2] + r;
    const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
    return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, qy, qz), 0) - r;
  }
}

const PRIMS = [], PARTS = [], PART = {};
function partIdx(name) { if (!(name in PART)) { PART[name] = PARTS.length; PARTS.push({ name, prims: [], adj: [] }); } return PART[name]; }
function put(part, pr, k = 0.02, sub_ = false, name = '') { pr.part = partIdx(part); pr.k = k; pr.op = sub_ === 'isect' ? 2 : sub_ ? 1 : 0; pr.name = name; pr.id = PRIMS.length; PRIMS.push(pr); PARTS[pr.part].prims.push(pr); return pr; }
const E = (part, name, c, r, axes, k = 0.02, o = {}) => put(part, new Ell(c, r, axes || WORLD), k, o.isect ? 'isect' : o.sub, name);
const C = (part, name, a, b, ra, rb, k = 0.02, o = {}) => put(part, new Cone(a, b, ra, rb, o.sv ?? 1, o.sw ?? 1, o.ref ?? [0, 1, 0]), k, o.isect ? 'isect' : o.sub, name);
const S = (part, name, c, r, k = 0.02, o = {}) => put(part, new Ell(c, [r, r, r]), k, o.sub, name);
const BX = (part, name, c, half, rnd, axes, k = 0.02, o = {}) => put(part, new Box(c, half, rnd, axes || WORLD), k, o.isect ? 'isect' : o.sub, name);

const PAIRS = [];
function pair(a, b, kbase, terms = [], kmin = 0.01) {
  const q = { a: partIdx(a), b: partIdx(b), kbase, terms, kmin, kmax: kbase + terms.reduce((s, t) => s + t.k, 0) };
  if (kbase > 0) q.bb = null; else { q.bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const t of terms) for (let i = 0; i < 3; i++) { q.bb[i] = Math.min(q.bb[i], t.c[i] - t.r1); q.bb[i + 3] = Math.max(q.bb[i + 3], t.c[i] + t.r1); } }
  PAIRS.push(q); PARTS[q.a].adj.push(q.b); PARTS[q.b].adj.push(q.a); return q;
}
function pairK(q, x, y, z) {
  let k = q.kbase;
  for (const t of q.terms) { const d = Math.hypot(x - t.c[0], y - t.c[1], z - t.c[2]); if (d < t.r1) k += t.k * (1 - sstep(t.r0, t.r1, d)); }
  return k;
}

// =============================================================== SCULPT
// Coordinates: meters, Y up, figure faces +Z, figure's left = +X. Rest pose = skeleton.js A-pose.
const CA = Math.cos(50 * Math.PI / 180), SA = Math.sin(50 * Math.PI / 180);
const AF = {}; // arm frames per side
for (const [s, sfx] of SIDES) {
  const d = DR('upperarm' + sfx), n = [-s * SA, -CA, 0], f = [0, 0, 1];
  AF[s] = { s, sfx, SH: HD('upperarm' + sfx), EL: HD('forearm' + sfx), WR: HD('hand' + sfx), SC: HD('clavicle' + sfx), d, n, f, axes: [d, f, n] };
}
const LF = {}; // leg landmarks per side
for (const [s, sfx] of SIDES) LF[s] = { s, sfx, HIP: HD('thigh' + sfx), KNEE: HD('shin' + sfx), ANK: HD('foot' + sfx), BALL: HD('toes' + sfx) };

// ---------- trunk (one smooth complex: pelvis, abdomen, ribcage, girdle, neck)
function sculptTrunk() {
  const T = 'trunk';
  E(T, 'ribcage', [0, 1.29, -0.008], [0.13, 0.158, 0.104], null, 0);
  E(T, 'upperchest', [0, 1.372, -0.014], [0.146, 0.074, 0.094], null, 0.045);
  E(T, 'abdomen', [0, 1.115, 0.0], [0.121, 0.11, 0.086], null, 0.06);
  E(T, 'lowbelly', [0, 1.0, 0.01], [0.124, 0.092, 0.083], null, 0.05);
  E(T, 'pelvis', [0, 0.935, -0.016], [0.145, 0.085, 0.096], null, 0.05);
  for (const s of [1, -1]) {
    E(T, 'glute', [s * 0.062, 0.884, -0.05], [0.066, 0.08, 0.07], rotFrame(WORLD, [0, 1, 0], s * 8), 0.03);
    E(T, 'hipside', [s * 0.12, 0.912, -0.012], [0.032, 0.06, 0.056], null, 0.04);
    E(T, 'shouldertop', [s * 0.095, 1.442, -0.004], [0.062, 0.024, 0.042], null, 0.03);
    E(T, 'pec', [s * 0.064, 1.336, 0.06], [0.072, 0.05, 0.026], rotFrame(rotFrame(WORLD, [0, 0, 1], s * 14), [0, 1, 0], s * 14), 0.03);
    E(T, 'deltopec', [s * 0.142, 1.39, 0.022], [0.034, 0.03, 0.022], rotFrame(WORLD, [0, 0, 1], s * 30), 0.035);
    E(T, 'teres', [s * 0.14, 1.355, -0.055], [0.04, 0.04, 0.032], rotFrame(WORLD, [0, 0, 1], s * 30), 0.03);
    E(T, 'lat', [s * 0.094, 1.27, -0.058], [0.052, 0.12, 0.058], rotFrame(WORLD, [0, 0, 1], -s * 12), 0.04);
    E(T, 'scapula', [s * 0.082, 1.356, -0.088], [0.058, 0.072, 0.025], rotFrame(rotFrame(WORLD, [0, 0, 1], s * 10), [0, 1, 0], -s * 18), 0.035);
    C(T, 'erector', [s * 0.028, 0.975, -0.083], [s * 0.03, 1.30, -0.094], 0.027, 0.022, 0.03);
    C(T, 'trapezius', [s * 0.028, 1.505, -0.032], [s * 0.152, 1.446, -0.024], 0.034, 0.02, 0.035);
    C(T, 'scm', [s * 0.042, 1.56, -0.018], [s * 0.013, 1.446, 0.05], 0.0095, 0.0105, 0.018);
    C(T, 'clavicle', [s * 0.022, 1.436, 0.05], [s * 0.145, 1.45, 0.0], 0.0075, 0.0085, 0.035);
    E(T, 'rectus', [s * 0.032, 1.13, 0.066], [0.036, 0.12, 0.025], null, 0.03);
  }
  E(T, 'midtrap', [0, 1.425, -0.068], [0.085, 0.06, 0.036], null, 0.045);
  C(T, 'neck', [0, 1.42, -0.024], [0, 1.575, -0.012], 0.054, 0.045, 0.035);
  E(T, 'mons', [0, 0.878, 0.038], [0.06, 0.05, 0.042], null, 0.03);
}
// subtractive details placed on the surface found by marching the part field
function sculptTrunkDetails() {
  const T = 'trunk', f = partFieldAll(PART[T]);
  const front = (x, y) => surf(f, [x, y, 0.3], [0, 0, -1]);
  const back = (x, y) => surf(f, [x, y, -0.3], [0, 0, 1]);
  const nv = front(0, 1.06); E(T, 'navel', add(nv, [0, 0, 0.002]), [0.0048, 0.0068, 0.007], null, 0.005, { sub: true });
  C(T, 'linea', add(front(0, 1.075), [0, 0, 0.0138]), add(front(0, 1.23), [0, 0, 0.0138]), 0.012, 0.012, 0.008, { sub: true });
  C(T, 'spinefurrow', add(back(0, 0.99), [0, 0, -0.0165]), add(back(0, 1.17), [0, 0, -0.0165]), 0.014, 0.014, 0.012, { sub: true });
  C(T, 'spinefurrow2', add(back(0, 1.17), [0, 0, -0.0175]), add(back(0, 1.40), [0, 0, -0.0175]), 0.014, 0.014, 0.01, { sub: true });
  C(T, 'cleft', add(back(0, 0.835), [0, -0.012, 0.004]), add(back(0, 0.965), [0, 0, -0.004]), 0.0055, 0.004, 0.012, { sub: true });
}

// ---------- head (egg cranium, jaw, ear masses, no facial features)
function sculptHead() {
  const P = 'head';
  E(P, 'cranium', [0, 1.64, -0.014], [0.072, 0.08, 0.092], null, 0);
  E(P, 'parietal', [0, 1.655, -0.03], [0.0735, 0.06, 0.07], null, 0.03);
  E(P, 'face', [0, 1.592, 0.004], [0.064, 0.082, 0.076], null, 0.05);     // broad front plane, wraps to the sides
  E(P, 'lowerface', [0, 1.54, 0.008], [0.053, 0.046, 0.062], null, 0.045); // rounded, slightly receding mouth/jaw zone
  E(P, 'brow', [0, 1.652, 0.048], [0.044, 0.018, 0.024], null, 0.06);
  E(P, 'occiput', [0, 1.605, -0.07], [0.052, 0.042, 0.03], null, 0.035);
  for (const s of [1, -1]) {
    C(P, 'jaw', [s * 0.054, 1.552, -0.02], [s * 0.018, 1.508, 0.04], 0.0105, 0.0115, 0.04);
    E(P, 'cheek', [s * 0.047, 1.6, 0.03], [0.02, 0.016, 0.022], null, 0.05);
    E(P, 'ear', [s * 0.069, 1.608, -0.016], [0.0068, 0.024, 0.0145], rotFrame(WORLD, [1, 0, 0], -14), 0.01);
  }
}

// ---------- arm (deltoid to wrist), local A(a, b, c) = SH + d*a + f*b + n*c  (n = medial/palm side, -n = lateral)
function sculptArm(s) {
  const F = AF[s], P = 'arm' + F.sfx, A = (a, b, c) => combo(F.SH, F.d, a, F.f, b, F.n, c), ax = F.axes;
  const Lu = 0.29, Lf = 0.25;
  E(P, 'deltoid', A(0.028, 0, -0.012), [0.07, 0.051, 0.046], ax, 0);
  C(P, 'deltins', A(0.02, 0, -0.012), A(0.135, 0, -0.024), 0.04, 0.017, 0.03, { ref: F.n });
  C(P, 'humerus', A(0.05, 0, 0), A(Lu - 0.02, 0, 0), 0.038, 0.034, 0.03, { ref: F.n });
  E(P, 'biceps', A(0.155, 0.013, 0.002), [0.085, 0.031, 0.029], ax, 0.025);
  E(P, 'triceps', A(0.13, -0.016, -0.004), [0.095, 0.032, 0.032], ax, 0.025);
  S(P, 'epimed', A(Lu, -0.002, 0.023), 0.0125, 0.016);
  S(P, 'epilat', A(Lu, 0.0, -0.021), 0.0115, 0.016);
  S(P, 'olecranon', A(Lu - 0.004, -0.023, 0), 0.0135, 0.016);
  E(P, 'forearmbelly', A(Lu + 0.075, 0.004, -0.001), [0.08, 0.037, 0.035], ax, 0.03);
  E(P, 'brachiorad', A(Lu + 0.05, 0.016, -0.014), [0.06, 0.021, 0.021], ax, 0.02);
  C(P, 'forearm', A(Lu + 0.01, 0, 0), A(Lu + Lf - 0.01, 0, 0), 0.032, 0.0235, 0.03, { ref: F.n, sv: 0.78, sw: 1.16 });
  E(P, 'wrist', A(Lu + Lf - 0.002, 0, 0), [0.016, 0.0275, 0.0185], ax, 0.012);
  S(P, 'ulnahead', A(Lu + Lf - 0.012, -0.021, -0.004), 0.0075, 0.008);
}

// ---------- hand. H(a, b, c) = WR + d*a + f*b + n*c. Fingers and thumb are separate parts (hard min between them).
const FING = ['index', 'middle', 'ring', 'pinky'];
const FRAD = { index: 0.0088, middle: 0.0091, ring: 0.0085, pinky: 0.0075 };
function sculptHand(s) {
  const F = AF[s], sfx = F.sfx, P = 'hand' + sfx, Hh = (a, b, c) => combo(F.WR, F.d, a, F.f, b, F.n, c), ax = F.axes;
  const MCP = FING.map(fn => HD(fn + '01' + sfx)), FD = FING.map(fn => DR(fn + '01' + sfx));
  E(P, 'carpus', Hh(0.016, -0.002, 0.001), [0.019, 0.027, 0.0155], ax, 0);
  const base = [0.011, 0.002, -0.008, -0.017];
  for (let i = 0; i < 4; i++) C(P, 'meta' + i, Hh(0.014, base[i], -0.002), add(MCP[i], mul(F.n, -0.001)), 0.0072, 0.0086, 0.012, { ref: F.n, sv: 0.8 });
  BX(P, 'palmplate', Hh(0.047, -0.004, 0.0015), [0.034, 0.03, 0.0092], 0.0075, ax, 0.01);
  // lunas: fleshy pads under the knuckles (palm side), one per finger, plus thenar and hypothenar masses
  for (let i = 0; i < 4; i++) E(P, 'luna' + i, combo(MCP[i], FD[i], -0.001, F.n, 0.0072), [0.0125, 0.0096, 0.0068], [FD[i], norm(cross(F.n, FD[i])), F.n], 0.009);
  E(P, 'hypothenar', Hh(0.043, -0.03, 0.0055), [0.036, 0.0125, 0.0118], ax, 0.012);
  const T1h = HD('thumb01' + sfx), T1t = TLp('thumb01' + sfx), td = DR('thumb01' + sfx);
  const tn = norm(sub(F.n, mul(td, dot(F.n, td))));
  E(P, 'thenar', combo(T1h, td, 0.02, tn, -0.003, F.f, -0.004), [0.03, 0.018, 0.0125], [td, norm(cross(tn, td)), tn], 0.016);
  // first web space (adductor pollicis): a soft membrane between the thumb and index metacarpals
  const T2h = HD('thumb02' + sfx), wBase = Hh(0.024, 0.016, 0.004), wTip = combo(T2h, td, 0.006);
  const wu = norm(sub(MCP[0], wTip)), wn0 = norm(cross(sub(wTip, wBase), sub(MCP[0], wBase))), wv = norm(cross(wn0, wu));
  E(P, 'web1', combo(mul(add(add(mul(wTip, 0.4), mul(MCP[0], 0.4)), mul(wBase, 0.2)), 1), F.n, 0.001), [0.021, 0.015, 0.0072], [wu, wv, wn0], 0.014);
  C(P, 'web1edge', wTip, combo(MCP[0], FD[0], -0.004), 0.0068, 0.0062, 0.012, { ref: wn0, sv: 0.8 });
  { const a = combo(T1h, td, 0.024, F.n, 0.004), b = combo(MCP[0], FD[0], -0.006, F.n, 0.0065), u = norm(sub(b, a));
    E(P, 'adductorpad', combo(lerp(a, b, 0.5), F.n, 0.001), [dist(a, b) * 0.55, 0.011, 0.0075], [u, norm(cross(F.n, u)), norm(sub(F.n, mul(u, dot(F.n, u))))], 0.016); }
  // subtle webs between fingers (palm side)
  for (let i = 0; i < 3; i++) {
    const a = combo(MCP[i], FD[i], 0.009, F.n, 0.003), b = combo(MCP[i + 1], FD[i + 1], 0.009, F.n, 0.003);
    C(P, 'web' + (i + 2), a, b, 0.0048, 0.0048, 0.006, { ref: F.n, sv: 0.75 });
  }
  for (let i = 0; i < 4; i++) S(P, 'knuckle' + i, add(MCP[i], mul(F.n, -0.0028)), FRAD[FING[i]] * 1.02, 0.008);
  // fingers: tapered, slightly flattened phalanges; flat back (slab intersection), soft palmar pads,
  // small dorsal knuckle bumps, palmar flexion creases (the flat distal back reads as the nail plane)
  const dorsalSlab = (Pp, base, tip, e0, e1, nrm, along, k) => {
    const A = combo(base, along, -0.01, nrm, -e0), B = combo(tip, nrm, -e1);
    const du = norm(sub(B, A)), dn = norm(sub(nrm, mul(du, dot(nrm, du))));
    BX(Pp, 'dorsalcut', combo(lerp(A, B, 0.5), dn, 0.03), [dist(A, B) / 2 + 0.02, 0.03, 0.03], 0, [du, norm(cross(dn, du)), dn], k, { isect: true });
    return p => { const f = combo(A, du, dot(sub(p, A), du)); return -dot(sub(f, p), nrm); }; // dorsal face height above axis point p
  };
  FING.forEach((fn) => {
    const Pp = fn + sfx, rb = FRAD[fn];
    const p0 = HD(fn + '01' + sfx), p1 = HD(fn + '02' + sfx), p2 = HD(fn + '03' + sfx), p3 = TLp(fn + '03' + sfx), dir = DR(fn + '01' + sfx);
    const side = norm(cross(F.n, dir)), fax = [dir, side, F.n];
    const L1 = dist(p0, p1), L2 = dist(p1, p2), L3 = dist(p2, p3);
    const SV = 0.8, o = { ref: F.n, sv: SV, sw: 0.94 }, sh = 0.0006;
    const r = [rb, rb * 0.9, rb * 0.885, rb * 0.82, rb * 0.81, rb * 0.735];
    const q = p => combo(p, F.n, sh);
    C(Pp, 'prox', q(p0), q(p1), r[0], r[1], 0, o);
    C(Pp, 'mid', q(p1), q(p2), r[2], r[3], 0, o);
    C(Pp, 'dist', q(p2), combo(p3, dir, -r[5] * 0.8, F.n, sh), r[4], r[5], 0, o);
    E(Pp, 'pad1', combo(p0, dir, L1 * 0.56, F.n, sh + r[0] * SV - r[0] * 0.36 + 0.0004), [L1 * 0.33, r[0] * 0.7, r[0] * 0.36], fax, 0.003);
    E(Pp, 'pad2', combo(p1, dir, L2 * 0.5, F.n, sh + r[2] * SV - r[2] * 0.34 + 0.0003), [L2 * 0.32, r[2] * 0.68, r[2] * 0.34], fax, 0.003);
    E(Pp, 'pulp', combo(p2, dir, L3 * 0.58, F.n, sh + r[4] * SV - r[4] * 0.42 + 0.0009), [L3 * 0.42, r[4] * 0.8, r[4] * 0.42], fax, 0.004);
    const eAt = dorsalSlab(Pp, p0, p3, r[0] * SV * 0.84 - sh, r[5] * SV * 0.84 - sh, F.n, dir, 0.0032);
    E(Pp, 'pipK', combo(p1, F.n, -(eAt(p1) - 0.0013)), [0.0058, r[1] * 0.56, 0.0025], fax, 0.0024);
    E(Pp, 'dipK', combo(p2, F.n, -(eAt(p2) - 0.001)), [0.0048, r[3] * 0.5, 0.002], fax, 0.002);
    for (const [c, rr] of [[combo(p0, dir, 0.016), r[0]], [p1, r[1]], [p2, r[3]]]) {
      const o2 = combo(c, F.n, sh + rr * SV + 0.0002);
      C(Pp, 'crease', combo(o2, side, -rr * 0.7), combo(o2, side, rr * 0.7), 0.0013, 0.0013, 0.003, { sub: true });
    }
  });
  // thumb (metacarpal partly buried in the thenar), same treatment as the fingers
  const Pt = 'thumb' + sfx, T2t = TLp('thumb02' + sfx), T3h = HD('thumb03' + sfx), T3t = TLp('thumb03' + sfx);
  const tflex = norm([F.n[0], F.n[1], F.n[2] - 0.6]), tside = norm(cross(tflex, td)), tax = [td, tside, tflex];
  const TSV = 0.84, to = { ref: tflex, sv: TSV, sw: 1.0 }, tsh = 0.0005, Lt3 = dist(T3h, T3t);
  C(Pt, 'meta', combo(T1h, td, 0.008, tn, -0.004), combo(T1t, tn, -0.0015), 0.0092, 0.0104, 0, to);
  C(Pt, 'prox', combo(T2h, tflex, tsh), combo(T2t, tflex, tsh), 0.0104, 0.0094, 0, to);
  C(Pt, 'dist', combo(T3h, tflex, tsh), combo(T3t, td, -0.0066, tflex, tsh), 0.0093, 0.0081, 0, to);
  E(Pt, 'pulp', combo(T3h, td, Lt3 * 0.58, tflex, tsh + 0.0081 * TSV - 0.0034 + 0.0009), [Lt3 * 0.42, 0.0068, 0.0034], tax, 0.004);
  const tAt = dorsalSlab(Pt, T2h, T3t, 0.0104 * TSV * 0.86 - tsh, 0.0081 * TSV * 0.86 - tsh, tflex, td, 0.0035);
  E(Pt, 'mcpK', combo(T2h, tflex, -(tAt(T2h) - 0.0016)), [0.0068, 0.0062, 0.003], tax, 0.003);
  E(Pt, 'ipK', combo(T3h, tflex, -(tAt(T3h) - 0.0011)), [0.0055, 0.0052, 0.0022], tax, 0.0022);
  const tcr = combo(T3h, tflex, tsh + 0.0093 * TSV + 0.0002);
  C(Pt, 'crease', combo(tcr, tside, -0.0065), combo(tcr, tside, 0.0065), 0.0013, 0.0013, 0.003, { sub: true });
}

// ---------- leg (thigh, knee, shin, ankle)
function sculptLeg(s) {
  const P = 'leg' + LF[s].sfx, X = x => s * x;
  E(P, 'upperthigh', [X(0.094), 0.80, 0.0], [0.075, 0.12, 0.08], null, 0);
  C(P, 'thighcore', [X(0.095), 0.82, 0.0], [X(0.10), 0.535, 0.01], 0.072, 0.049, 0.06);
  E(P, 'quads', [X(0.10), 0.68, 0.033], [0.054, 0.16, 0.047], null, 0.04);
  E(P, 'vlateralis', [X(0.122), 0.685, 0.0], [0.038, 0.16, 0.048], null, 0.04);
  E(P, 'vmedialis', [X(0.073), 0.565, 0.03], [0.034, 0.058, 0.034], null, 0.03);
  E(P, 'hamstrings', [X(0.098), 0.685, -0.043], [0.054, 0.15, 0.044], null, 0.04);
  E(P, 'adductors', [X(0.062), 0.79, -0.004], [0.044, 0.09, 0.058], null, 0.04);
  E(P, 'condyles', [X(0.10), 0.495, 0.008], [0.047, 0.04, 0.046], null, 0.03);
  E(P, 'patella', [X(0.10), 0.502, 0.05], [0.024, 0.027, 0.014], null, 0.012);
  E(P, 'tibialplateau', [X(0.10), 0.455, 0.008], [0.045, 0.03, 0.042], null, 0.02);
  C(P, 'pattendon', [X(0.10), 0.478, 0.045], [X(0.10), 0.425, 0.039], 0.0095, 0.0095, 0.012);
  C(P, 'tibia', [X(0.10), 0.44, 0.008], [X(0.105), 0.11, -0.012], 0.039, 0.024, 0.03);
  C(P, 'tibiaridge', [X(0.097), 0.43, 0.029], [X(0.103), 0.13, 0.008], 0.0125, 0.0105, 0.02);
  E(P, 'gastromed', [X(0.083), 0.355, -0.03], [0.032, 0.085, 0.04], null, 0.03);
  E(P, 'gastrolat', [X(0.121), 0.375, -0.026], [0.028, 0.07, 0.036], null, 0.03);
  E(P, 'soleus', [X(0.10), 0.26, -0.027], [0.042, 0.10, 0.034], null, 0.04);
  C(P, 'achilles', [X(0.105), 0.20, -0.041], [X(0.105), 0.055, -0.051], 0.0125, 0.0105, 0.02, { ref: [0, 0, 1], sw: 0.85 });
  C(P, 'ankle', [X(0.105), 0.13, -0.014], [X(0.105), 0.075, -0.012], 0.026, 0.027, 0.025, { ref: [0, 0, 1], sw: 1.12 });
  S(P, 'malmed', [X(0.084), 0.079, -0.006], 0.0148, 0.012);
  S(P, 'mallat', [X(0.127), 0.067, -0.019], 0.0142, 0.012);
}

// ---------- foot (heel pad, arch, ball pad) + toes (one mass with grooves)
function sculptFoot(s) {
  const P = 'foot' + LF[s].sfx, Pt = 'toes' + LF[s].sfx, X = x => s * x;
  E(P, 'heel', [X(0.105), 0.034, -0.038], [0.028, 0.034, 0.036], null, 0);
  E(P, 'heelpad', [X(0.105), 0.019, -0.03], [0.026, 0.019, 0.033], null, 0.015);
  C(P, 'midfoot', [X(0.104), 0.04, -0.018], [X(0.111), 0.024, 0.114], 0.026, 0.021, 0.03, { ref: [0, 1, 0], sv: 0.86, sw: 1.18 });
  E(P, 'ball', [X(0.113), 0.02, 0.12], [0.046, 0.02, 0.024], rotFrame(WORLD, [0, 1, 0], s * 22), 0.02);
  E(P, 'ballpad', [X(0.097), 0.013, 0.123], [0.03, 0.013, 0.021], rotFrame(WORLD, [0, 1, 0], s * 22), 0.014);
  E(P, 'dorsum', [X(0.1), 0.04, 0.045], [0.03, 0.026, 0.065], rotFrame(WORLD, [1, 0, 0], 12), 0.035);
  C(P, 'lateralborder', [X(0.124), 0.019, -0.015], [X(0.147), 0.015, 0.098], 0.016, 0.0125, 0.02);
  E(P, 'arch', [X(0.074), -0.004, 0.04], [0.032, 0.026, 0.056], null, 0.015, { sub: true });
  const toes = [ // base, tip, rb, rt
    [[0.084, 0.022, 0.136], [0.086, 0.017, 0.186], 0.0128, 0.0112],
    [[0.105, 0.019, 0.132], [0.109, 0.0135, 0.176], 0.0088, 0.0074],
    [[0.121, 0.0185, 0.124], [0.125, 0.0128, 0.165], 0.0085, 0.0071],
    [[0.135, 0.0178, 0.114], [0.139, 0.0122, 0.153], 0.0081, 0.0068],
    [[0.148, 0.017, 0.101], [0.152, 0.0118, 0.137], 0.0077, 0.0066],
  ];
  toes.forEach(([a, b, ra, rb], i) => C(Pt, 'toe' + i, [X(a[0]), a[1], a[2]], [X(b[0]), b[1], b[2]], ra, rb, i ? 0.0055 : 0, { ref: [0, 1, 0], sv: 0.8, sw: 1.08 }));
}

// ---------- blends between parts (k varies in space so A-pose arms never fuse to the torso)
function definePairs() {
  pair('trunk', 'head', 0.008, [{ c: [0, 1.565, -0.05], r0: 0.03, r1: 0.075, k: 0.03 }], 0.02);
  for (const [s, sfx] of SIDES) {
    const F = AF[s];
    const A = (x, y, z) => combo(F.SH, F.d, x, F.f, y, F.n, z);
    pair('trunk', 'arm' + sfx, 0, [{ c: add(F.SH, [0, 0.012, 0]), r0: 0.035, r1: 0.088, k: 0.045 }], 0.015);
    pair('arm' + sfx, 'hand' + sfx, 0.012, [{ c: F.WR, r0: 0.02, r1: 0.05, k: 0.006 }], 0.012);
    for (const fn of FING) pair('hand' + sfx, fn + sfx, 0, [{ c: HD(fn + '01' + sfx), r0: 0.012, r1: 0.026, k: 0.009 }], 0.004);
    pair('hand' + sfx, 'thumb' + sfx, 0, [{ c: combo(HD('thumb01' + sfx), DR('thumb01' + sfx), 0.03), r0: 0.035, r1: 0.06, k: 0.02 }], 0.006);
    pair('trunk', 'leg' + sfx, 0.013, [{ c: [s * 0.145, 0.90, -0.01], r0: 0.05, r1: 0.13, k: 0.035 }], 0.02);
    pair('leg' + sfx, 'foot' + sfx, 0.013, [{ c: combo(LF[s].ANK, [0, 0, 1], 0.03), r0: 0.03, r1: 0.07, k: 0.01 }], 0.015);
    pair('foot' + sfx, 'toes' + sfx, 0.007, [], 0.006);
  }
}

// =============================================================== FIELD EVALUATION
function partFieldList(prims, x, y, z) {
  let d = Infinity;
  for (let i = 0; i < prims.length; i++) {
    const pr = prims[i], b = pr.bb;
    const dx = Math.max(b[0] - x, 0, x - b[3]), dy = Math.max(b[1] - y, 0, y - b[4]), dz = Math.max(b[2] - z, 0, z - b[5]);
    const ad = Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.7;
    if (pr.op === 0) {
      if (ad > d + pr.k) continue;
      const v = pr.ev(x, y, z);
      d = pr.k > 0 ? smin(d, v, pr.k) : Math.min(d, v);
    } else if (pr.op === 1) {
      if (ad > pr.k + Math.max(0, -d)) continue;
      d = smax(d, -pr.ev(x, y, z), pr.k);
    } else d = smax(d, pr.ev(x, y, z), pr.k);
  }
  return d;
}
function partFieldAll(pi) { const prims = PARTS[pi].prims.slice(); return (x, y, z) => partFieldList(prims, x, y, z); }
function surf(f, o, dir) { // march from o along dir until the field crosses zero, then bisect
  let t = 0, prev = f(...o);
  for (let i = 0; i < 400; i++) {
    const step = Math.max(Math.abs(prev) * 0.5, 0.0005); const t2 = t + step; const p = combo(o, dir, t2); const v = f(...p);
    if (v < 0) { let a = t, b = t2; for (let j = 0; j < 30; j++) { const m = (a + b) / 2; if (f(...combo(o, dir, m)) < 0) b = m; else a = m; } return combo(o, dir, (a + b) / 2); }
    t = t2; prev = v;
  }
  throw new Error('surf: no hit from ' + o);
}

const NP = () => PARTS.length;
function makeCand(x0, y0, z0, x1, y1, z1, margin) {
  const parts = [];
  for (let pi = 0; pi < PARTS.length; pi++) {
    const list = [];
    for (const pr of PARTS[pi].prims) {
      const m = margin + pr.k, b = pr.bb;
      if (b[0] - m <= x1 && b[3] + m >= x0 && b[1] - m <= y1 && b[4] + m >= y0 && b[2] - m <= z1 && b[5] + m >= z0) list.push(pr);
    }
    if (list.some(p => p.op === 0)) parts.push({ pi, prims: list });
  }
  const present = new Uint8Array(PARTS.length); for (const cp of parts) present[cp.pi] = 1;
  const pairs = PAIRS.filter(q => present[q.a] && present[q.b] && (!q.bb || (q.bb[0] - margin <= x1 && q.bb[3] + margin >= x0 && q.bb[1] - margin <= y1 && q.bb[4] + margin >= y0 && q.bb[2] - margin <= z1 && q.bb[5] + margin >= z0)));
  return { parts, pairs, present };
}
let PD = null;
function field(c, x, y, z, pd = PD, mask = null) {
  let best = Infinity;
  for (const cp of c.parts) {
    if (mask && !mask[cp.pi]) { pd[cp.pi] = Infinity; continue; }
    const d = partFieldList(cp.prims, x, y, z); pd[cp.pi] = d; if (d < best) best = d;
  }
  for (const q of c.pairs) {
    const da = pd[q.a], db = pd[q.b];
    if (da === Infinity || db === Infinity || Math.abs(da - db) >= q.kmax) continue;
    const k = pairK(q, x, y, z);
    if (k > 1e-6) { const s = smin(da, db, k); if (s < best) best = s; }
  }
  return best;
}

// =============================================================== POLYGONIZE (sparse surface nets)
const BS = 8, MARGIN = 0.06;
let GRID = null;
function setupGrid(h) {
  const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of PRIMS) if (p.op === 0) for (let i = 0; i < 3; i++) { bb[i] = Math.min(bb[i], p.bb[i]); bb[i + 3] = Math.max(bb[i + 3], p.bb[i + 3]); }
  const o = [bb[0] - 4 * h, bb[1] - 4 * h, bb[2] - 4 * h];
  const nc = [0, 1, 2].map(i => Math.ceil((bb[i + 3] + 4 * h - o[i]) / h));
  const nb = nc.map(n => Math.ceil(n / BS));
  GRID = { h, o, nb, candCache: new Map() };
}
function blockCand(bi, bj, bk) {
  const key = bi + GRID.nb[0] * (bj + GRID.nb[1] * bk);
  let c = GRID.candCache.get(key);
  if (!c) {
    const { h, o } = GRID, s = BS * h;
    const x0 = o[0] + bi * s, y0 = o[1] + bj * s, z0 = o[2] + bk * s;
    c = makeCand(x0, y0, z0, x0 + s, y0 + s, z0 + s, MARGIN);
    GRID.candCache.set(key, c);
  }
  return c;
}
function candAt(x, y, z) {
  const { h, o, nb } = GRID, s = BS * h;
  const bi = clamp(Math.floor((x - o[0]) / s), 0, nb[0] - 1), bj = clamp(Math.floor((y - o[1]) / s), 0, nb[1] - 1), bk = clamp(Math.floor((z - o[2]) / s), 0, nb[2] - 1);
  return blockCand(bi, bj, bk);
}
const fieldAt = (x, y, z, pd = PD, mask = null) => field(candAt(x, y, z), x, y, z, pd, mask);

function polygonize() {
  const { h, o, nb } = GRID, s = BS * h, P1 = BS + 1;
  const half = Math.sqrt(3) * s / 2;
  const blocks = new Map();
  let tested = 0;
  for (let bk = 0; bk < nb[2]; bk++) for (let bj = 0; bj < nb[1]; bj++) for (let bi = 0; bi < nb[0]; bi++) {
    const x0 = o[0] + bi * s, y0 = o[1] + bj * s, z0 = o[2] + bk * s;
    const c = blockCand(bi, bj, bk);
    if (!c.parts.length) { GRID.candCache.delete(bi + nb[0] * (bj + nb[1] * bk)); continue; }
    tested++;
    const dc = field(c, x0 + s / 2, y0 + s / 2, z0 + s / 2);
    if (Math.abs(dc) > half * 1.3 + 2 * h) continue;
    const vals = new Float32Array(P1 * P1 * P1);
    let neg = 0;
    for (let k = 0; k <= BS; k++) for (let j = 0; j <= BS; j++) for (let i = 0; i <= BS; i++) {
      const v = field(c, x0 + i * h, y0 + j * h, z0 + k * h); vals[i + P1 * (j + P1 * k)] = v; if (v < 0) neg++;
    }
    if (neg === 0 || neg === vals.length) continue;
    blocks.set(bi + nb[0] * (bj + nb[1] * bk), { bi, bj, bk, vals, vid: new Int32Array(BS * BS * BS).fill(-1) });
  }
  log(`blocks tested ${tested}, active ${blocks.size}`);
  // vertices
  const pos = [];
  const E12 = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float64Array(8);
  for (const B of blocks.values()) {
    const x0 = o[0] + B.bi * s, y0 = o[1] + B.bj * s, z0 = o[2] + B.bk * s, V = B.vals;
    for (let k = 0; k < BS; k++) for (let j = 0; j < BS; j++) for (let i = 0; i < BS; i++) {
      let m = 0;
      for (let c = 0; c < 8; c++) { const v = V[(i + (c & 1)) + P1 * ((j + ((c >> 1) & 1)) + P1 * (k + (c >> 2)))]; cv[c] = v; if (v < 0) m |= 1 << c; }
      if (m === 0 || m === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of E12) {
        if (((m >> a) & 1) === ((m >> b) & 1)) continue;
        const t = cv[a] / (cv[a] - cv[b]);
        const ax = a & 1, ay = (a >> 1) & 1, az = a >> 2, bx = b & 1, by = (b >> 1) & 1, bz = b >> 2;
        sx += ax + (bx - ax) * t; sy += ay + (by - ay) * t; sz += az + (bz - az) * t; n++;
      }
      B.vid[i + BS * (j + BS * k)] = pos.length / 3;
      pos.push(x0 + (i + sx / n) * h, y0 + (j + sy / n) * h, z0 + (k + sz / n) * h);
    }
  }
  const getV = (ci, cj, ck) => {
    const bi = Math.floor(ci / BS), bj = Math.floor(cj / BS), bk = Math.floor(ck / BS);
    const B = blocks.get(bi + nb[0] * (bj + nb[1] * bk)); if (!B) return -1;
    return B.vid[(ci - bi * BS) + BS * ((cj - bj * BS) + BS * (ck - bk * BS))];
  };
  const tris = [];
  const P = pos;
  const d2 = (a, b) => (P[3 * a] - P[3 * b]) ** 2 + (P[3 * a + 1] - P[3 * b + 1]) ** 2 + (P[3 * a + 2] - P[3 * b + 2]) ** 2;
  let missing = 0;
  for (const B of blocks.values()) {
    const V = B.vals;
    for (let k = 0; k < BS; k++) for (let j = 0; j < BS; j++) for (let i = 0; i < BS; i++) {
      const v0 = V[i + P1 * (j + P1 * k)];
      const g = [B.bi * BS + i, B.bj * BS + j, B.bk * BS + k];
      for (let a = 0; a < 3; a++) {
        const v1 = a === 0 ? V[i + 1 + P1 * (j + P1 * k)] : a === 1 ? V[i + P1 * (j + 1 + P1 * k)] : V[i + P1 * (j + P1 * (k + 1))];
        if ((v0 < 0) === (v1 < 0)) continue;
        const u = (a + 1) % 3, w = (a + 2) % 3;
        const cell = (du, dw) => { const c = g.slice(); c[u] += du; c[w] += dw; return getV(c[0], c[1], c[2]); };
        const q = [cell(-1, -1), cell(0, -1), cell(0, 0), cell(-1, 0)];
        if (q.some(x => x < 0)) { missing++; continue; }
        if (!(v0 < 0)) q.reverse();
        if (d2(q[0], q[2]) < d2(q[1], q[3])) tris.push(q[0], q[1], q[2], q[0], q[2], q[3]);
        else tris.push(q[0], q[1], q[3], q[1], q[2], q[3]);
      }
    }
  }
  if (missing) log('surface nets: quads skipped (missing cells):', missing);
  return { pos: new Float64Array(pos), tris: new Int32Array(tris) };
}

function gradAt(x, y, z, e = 0.0003) {
  const gx = fieldAt(x + e, y, z) - fieldAt(x - e, y, z), gy = fieldAt(x, y + e, z) - fieldAt(x, y - e, z), gz = fieldAt(x, y, z + e) - fieldAt(x, y, z - e);
  return [gx / (2 * e), gy / (2 * e), gz / (2 * e)];
}
function project(pos, iters, maxStep) {
  const n = pos.length / 3;
  for (let i = 0; i < n; i++) {
    let x = pos[3 * i], y = pos[3 * i + 1], z = pos[3 * i + 2];
    for (let it = 0; it < iters; it++) {
      const d = fieldAt(x, y, z); if (Math.abs(d) < 1e-6) break;
      const g = gradAt(x, y, z), g2 = g[0] * g[0] + g[1] * g[1] + g[2] * g[2]; if (g2 < 1e-8) break;
      let sx = -d * g[0] / g2, sy = -d * g[1] / g2, sz = -d * g[2] / g2; const sl = Math.hypot(sx, sy, sz);
      if (sl > maxStep) { sx *= maxStep / sl; sy *= maxStep / sl; sz *= maxStep / sl; }
      x += sx; y += sy; z += sz;
    }
    pos[3 * i] = x; pos[3 * i + 1] = y; pos[3 * i + 2] = z;
  }
}
function ownerPart(x, y, z) { fieldAt(x, y, z); const c = candAt(x, y, z); let best = Infinity, bi = 0; for (const cp of c.parts) { const d = PD[cp.pi]; if (d < best) { best = d; bi = cp.pi; } } return bi; }

// =============================================================== QEM DECIMATION
class Heap {
  constructor(cap = 1 << 20) { this.cost = new Float64Array(cap); this.a = new Int32Array(cap); this.b = new Int32Array(cap); this.va = new Int32Array(cap); this.vb = new Int32Array(cap); this.p = new Float64Array(cap * 3); this.heap = new Int32Array(cap); this.n = 0; this.free = []; this.top = 0; }
  grow() { const cap = this.cost.length * 2; const g = (A, m = 1) => { const B = new A.constructor(cap * m); B.set(A); return B; }; this.cost = g(this.cost); this.a = g(this.a); this.b = g(this.b); this.va = g(this.va); this.vb = g(this.vb); this.p = g(this.p, 3); this.heap = g(this.heap); }
  push(cost, a, b, va, vb, px, py, pz) {
    let id; if (this.free.length) id = this.free.pop(); else { if (this.top >= this.cost.length) this.grow(); id = this.top++; }
    this.cost[id] = cost; this.a[id] = a; this.b[id] = b; this.va[id] = va; this.vb[id] = vb; this.p[3 * id] = px; this.p[3 * id + 1] = py; this.p[3 * id + 2] = pz;
    if (this.n >= this.heap.length) this.grow();
    let i = this.n++; const H = this.heap, C = this.cost;
    while (i > 0) { const pa = (i - 1) >> 1; if (C[H[pa]] <= cost) break; H[i] = H[pa]; i = pa; }
    H[i] = id;
  }
  pop() {
    const H = this.heap, C = this.cost, top = H[0], last = H[--this.n]; let i = 0; const c = C[last];
    for (;;) { let l = 2 * i + 1; if (l >= this.n) break; if (l + 1 < this.n && C[H[l + 1]] < C[H[l]]) l++; if (C[H[l]] >= c) break; H[i] = H[l]; i = l; }
    H[i] = last; this.free.push(top); return top;
  }
}
function decimate(pos, tris, target, impFn, lmaxFn) {
  const nV = pos.length / 3, nF = tris.length / 3;
  const P = pos, F = tris, fAlive = new Uint8Array(nF).fill(1), vAlive = new Uint8Array(nV).fill(1), ver = new Int32Array(nV);
  const vf = Array.from({ length: nV }, () => []);
  for (let f = 0; f < nF; f++) for (let c = 0; c < 3; c++) vf[F[3 * f + c]].push(f);
  const Q = new Float64Array(nV * 10);
  for (let f = 0; f < nF; f++) {
    const a = F[3 * f], b = F[3 * f + 1], c = F[3 * f + 2];
    const ux = P[3 * b] - P[3 * a], uy = P[3 * b + 1] - P[3 * a + 1], uz = P[3 * b + 2] - P[3 * a + 2], wx = P[3 * c] - P[3 * a], wy = P[3 * c + 1] - P[3 * a + 1], wz = P[3 * c + 2] - P[3 * a + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz); if (l < 1e-20) continue;
    const area = l / 2; nx /= l; ny /= l; nz /= l; const d = -(nx * P[3 * a] + ny * P[3 * a + 1] + nz * P[3 * a + 2]);
    const q = [nx * nx, nx * ny, nx * nz, nx * d, ny * ny, ny * nz, ny * d, nz * nz, nz * d, d * d];
    for (const v of [a, b, c]) for (let i = 0; i < 10; i++) Q[10 * v + i] += q[i] * area;
  }
  const imp = new Float64Array(nV), lmax = new Float64Array(nV);
  for (let v = 0; v < nV; v++) { imp[v] = impFn(v); lmax[v] = lmaxFn(v); }
  const heap = new Heap(1 << 21);
  const qe = (q, x, y, z) => q[0] * x * x + 2 * q[1] * x * y + 2 * q[2] * x * z + 2 * q[3] * x + q[4] * y * y + 2 * q[5] * y * z + 2 * q[6] * y + q[7] * z * z + 2 * q[8] * z + q[9];
  const qq = new Float64Array(10);
  function evalEdge(a, b) {
    for (let i = 0; i < 10; i++) qq[i] = Q[10 * a + i] + Q[10 * b + i];
    const ax = P[3 * a], ay = P[3 * a + 1], az = P[3 * a + 2], bx = P[3 * b], by = P[3 * b + 1], bz = P[3 * b + 2];
    const L = Math.hypot(ax - bx, ay - by, az - bz);
    let best = Infinity, px = 0, py = 0, pz = 0;
    const A = qq, det = A[0] * (A[4] * A[7] - A[5] * A[5]) - A[1] * (A[1] * A[7] - A[5] * A[2]) + A[2] * (A[1] * A[5] - A[4] * A[2]);
    if (Math.abs(det) > 1e-18) {
      const b0 = -A[3], b1 = -A[6], b2 = -A[8];
      const x = (b0 * (A[4] * A[7] - A[5] * A[5]) - A[1] * (b1 * A[7] - A[5] * b2) + A[2] * (b1 * A[5] - A[4] * b2)) / det;
      const y = (A[0] * (b1 * A[7] - b2 * A[5]) - b0 * (A[1] * A[7] - A[5] * A[2]) + A[2] * (A[1] * b2 - b1 * A[2])) / det;
      const z = (A[0] * (A[4] * b2 - A[5] * b1) - A[1] * (A[1] * b2 - b1 * A[2]) + b0 * (A[1] * A[5] - A[4] * A[2])) / det;
      const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
      if (Math.hypot(x - mx, y - my, z - mz) < L) { best = qe(qq, x, y, z); px = x; py = y; pz = z; }
    }
    for (const t of [0, 0.5, 1]) { const x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = az + (bz - az) * t, e = qe(qq, x, y, z); if (e < best - 1e-22) { best = e; px = x; py = y; pz = z; } }
    const im = Math.max(imp[a], imp[b]);
    const cost = (Math.max(best, 0) + 2e-3 * L ** 4) * im;
    heap.push(cost, a, b, ver[a], ver[b], px, py, pz);
  }
  const mark = new Int32Array(nV); let stamp = 0;
  for (let f = 0; f < nF; f++) for (let c = 0; c < 3; c++) { const a = F[3 * f + c], b = F[3 * f + (c + 1) % 3]; if (a < b) evalEdge(a, b); }
  let faces = nF;
  function neighbors(v, out) { out.length = 0; stamp++; for (const f of vf[v]) { if (!fAlive[f]) continue; for (let c = 0; c < 3; c++) { const u = F[3 * f + c]; if (u !== v && mark[u] !== stamp) { mark[u] = stamp; out.push(u); } } } return out; }
  const na = [], nb2 = [];
  let collapses = 0, rejects = 0;
  while (faces > target && heap.n > 0) {
    const id = heap.pop(); const a = heap.a[id], b = heap.b[id];
    if (!vAlive[a] || !vAlive[b] || ver[a] !== heap.va[id] || ver[b] !== heap.vb[id]) continue;
    const px = heap.p[3 * id], py = heap.p[3 * id + 1], pz = heap.p[3 * id + 2];
    // link condition
    neighbors(a, na); neighbors(b, nb2);
    let common = 0; stamp++; for (const u of na) mark[u] = stamp; for (const u of nb2) if (mark[u] === stamp) common++;
    let shared = 0; for (const f of vf[a]) if (fAlive[f] && (F[3 * f] === b || F[3 * f + 1] === b || F[3 * f + 2] === b)) shared++;
    if (shared !== 2 || common !== 2) { rejects++; continue; }
    // geometric checks
    const lm = Math.min(lmax[a], lmax[b]);
    let ok = true;
    for (const v of [a, b]) {
      for (const f of vf[v]) {
        if (!fAlive[f]) continue;
        const i0 = F[3 * f], i1 = F[3 * f + 1], i2 = F[3 * f + 2];
        if ((i0 === a || i1 === a || i2 === a) && (i0 === b || i1 === b || i2 === b)) continue;
        const pts = [i0, i1, i2].map(i => (i === v ? [px, py, pz] : [P[3 * i], P[3 * i + 1], P[3 * i + 2]]));
        const old = [i0, i1, i2].map(i => [P[3 * i], P[3 * i + 1], P[3 * i + 2]]);
        const n1 = cross(sub(old[1], old[0]), sub(old[2], old[0])), n2 = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
        const l1 = len(n1), l2 = len(n2);
        if (l2 < 1e-14 || dot(n1, n2) < 0.25 * l1 * l2) { ok = false; break; }
        const e0 = dist(pts[0], pts[1]), e1 = dist(pts[1], pts[2]), e2 = dist(pts[2], pts[0]);
        if (Math.max(e0, e1, e2) > lm) { ok = false; break; }
        const qn = 6.928 * (l2 / 2) / (e0 * e0 + e1 * e1 + e2 * e2);
        if (qn < 0.12) { const o0 = dist(old[0], old[1]), o1 = dist(old[1], old[2]), o2 = dist(old[2], old[0]); const qo = 6.928 * (l1 / 2) / (o0 * o0 + o1 * o1 + o2 * o2); if (qn < qo) { ok = false; break; } }
      }
      if (!ok) break;
    }
    if (!ok) { rejects++; continue; }
    // collapse b into a
    P[3 * a] = px; P[3 * a + 1] = py; P[3 * a + 2] = pz;
    for (const f of vf[b]) {
      if (!fAlive[f]) continue;
      if (F[3 * f] === a || F[3 * f + 1] === a || F[3 * f + 2] === a) { fAlive[f] = 0; faces--; continue; }
      for (let c = 0; c < 3; c++) if (F[3 * f + c] === b) F[3 * f + c] = a;
      vf[a].push(f);
    }
    vf[a] = vf[a].filter(f => fAlive[f]); vf[b] = [];
    vAlive[b] = 0; for (let i = 0; i < 10; i++) Q[10 * a + i] += Q[10 * b + i];
    imp[a] = Math.max(imp[a], imp[b]); lmax[a] = Math.min(lmax[a], lmax[b]);
    ver[a]++; collapses++;
    for (const u of neighbors(a, na)) { vf[u] = vf[u].filter(f => fAlive[f]); evalEdge(a, u); }
  }
  log(`QEM: ${collapses} collapses, ${rejects} rejects, faces ${faces}`);
  const remap = new Int32Array(nV).fill(-1); const np = [];
  for (let v = 0; v < nV; v++) if (vAlive[v] && vf[v].length) { remap[v] = np.length / 3; np.push(P[3 * v], P[3 * v + 1], P[3 * v + 2]); }
  const nt = []; for (let f = 0; f < nF; f++) if (fAlive[f]) nt.push(remap[F[3 * f]], remap[F[3 * f + 1]], remap[F[3 * f + 2]]);
  return { pos: new Float64Array(np), tris: new Int32Array(nt) };
}

// =============================================================== SKIN WEIGHTS
// Helper bones (driven in figure.js from the skeleton each frame): fractional rotations that keep volume at
// shoulders, elbows, hips and knees, and spread forearm twist along the forearm.
const HELPERS = [];
for (const [, sfx] of SIDES) {
  HELPERS.push({ name: 'S_half' + sfx, parent: 'clavicle' + sfx, source: 'upperarm' + sfx, mode: 'slerp', s: 0.5, t: 0.5 });
  HELPERS.push({ name: 'E_half' + sfx, parent: 'upperarm' + sfx, source: 'forearm' + sfx, mode: 'swingtwist', s: 0.5, t: 0 });
  HELPERS.push({ name: 'E_0' + sfx, parent: 'upperarm' + sfx, source: 'forearm' + sfx, mode: 'swingtwist', s: 1, t: 0 });
  HELPERS.push({ name: 'F_mid' + sfx, parent: 'upperarm' + sfx, source: 'forearm' + sfx, mode: 'swingtwist', s: 1, t: 0.5 });
  HELPERS.push({ name: 'H_half' + sfx, parent: 'pelvis', source: 'thigh' + sfx, mode: 'slerp', s: 0.5, t: 0.5 });
  HELPERS.push({ name: 'K_half' + sfx, parent: 'thigh' + sfx, source: 'shin' + sfx, mode: 'slerp', s: 0.5, t: 0.5 });
  HELPERS.push({ name: 'G_half' + sfx, parent: 'pelvis', source: 'thigh' + sfx, mode: 'glute', s: 0.4, fz: 0.42, fy: 0.14 });
}
const FLESH_BONES = BONES.length + HELPERS.length; // finger helpers below carry no flesh offsets
for (const [, sfx] of SIDES) for (const fn of ['thumb', ...FING]) for (let k = 1; k <= 3; k++)
  HELPERS.push({ name: `${fn}_h${k}${sfx}`, parent: k === 1 ? 'hand' + sfx : `${fn}0${k - 1}${sfx}`, source: `${fn}0${k}${sfx}`, mode: 'slerp', s: 0.5, t: 0.5 });
const ALLB = BONES.map(b => b.name).concat(HELPERS.map(h => h.name));
const BIX = Object.fromEntries(ALLB.map((n, i) => [n, i]));

function chainW(W, names, c, m) {
  const n = names.length - 1; c = clamp(c, 0, n); const i = Math.min(Math.floor(c), n - 1), f = c - i;
  if (1 - f > 1e-6) W[names[i]] = (W[names[i]] || 0) + (1 - f) * m;
  if (f > 1e-6) W[names[i + 1]] = (W[names[i + 1]] || 0) + f * m;
}
const SPINE_KNOTS = [['pelvis', 0.985], ['spine01', 1.065], ['spine02', 1.14], ['spine03', 1.22], ['spine04', 1.30], ['spine05', 1.375], ['spine06', 1.44], ['neck01', 1.50], ['neck02', 1.555], ['head', 1.60]];
// fraction of the hip rotation a vertex follows: crease in front, long stretch over the glute, midline stays pelvic
function hipFollow(p, s, trunk) {
  const L = LF[s], u = L.HIP[1] - p[1], post = sstep(-0.01, -0.07, p[2] - L.HIP[2]);
  const front = sstep(-0.03, 0.08, u), back = sstep(-0.045, 0.15, u);
  const med = s * p[0], top = 1 - sstep(0.06, 0.16, u);
  const medF = trunk ? sstep(0.0, 0.065, med) : 0.5 + 0.5 * sstep(0.02, 0.07, med);
  return (front + (back - front) * post) * (1 - (1 - medF) * top);
}
function glutePost(p, s) { return sstep(-0.01, -0.07, p[2] - LF[s].HIP[2]) * sstep(0.17, 0.05, LF[s].HIP[1] - p[1]); }
function splitGlute(W, p) { // posterior hip region rides the flattening glute corrective instead of the plain half-hip
  for (const [s, sfx] of SIDES) { const w = W['H_half' + sfx]; if (!w) continue; const g = glutePost(p, s); if (g <= 0) continue; W['H_half' + sfx] = w * (1 - g); W['G_half' + sfx] = (W['G_half' + sfx] || 0) + w * g; }
}
function wTrunk(W, p, m) {
  const [x, y] = p;
  let cl = 0; const cw = {};
  for (const [s, sfx] of SIDES) { const F = AF[s]; const dc = distSeg(p, F.SC, F.SH); cw[s] = 0.85 * (1 - sstep(0.03, 0.10, dc)) * sstep(0.025, 0.09, s * x); cl += cw[s]; }
  for (const [s, sfx] of SIDES) if (cw[s] > 0) W['clavicle' + sfx] = (W['clavicle' + sfx] || 0) + cw[s] * m;
  const rest = m * (1 - cl);
  if (y < SPINE_KNOTS[0][1]) {
    for (const [s, sfx] of SIDES) {
      const side = s > 0 ? sstep(-0.025, 0.025, x) : 1 - sstep(-0.025, 0.025, x); if (side <= 0) continue;
      chainW(W, ['pelvis', 'H_half' + sfx, 'thigh' + sfx], 2 * hipFollow(p, s, true), rest * side);
    }
    return;
  }
  let i = 0; while (i < SPINE_KNOTS.length - 1 && y > SPINE_KNOTS[i + 1][1]) i++;
  if (i >= SPINE_KNOTS.length - 1) { W.head = (W.head || 0) + rest; return; }
  const [n0, y0] = SPINE_KNOTS[i], [n1, y1] = SPINE_KNOTS[i + 1], f = clamp((y - y0) / (y1 - y0), 0, 1);
  W[n0] = (W[n0] || 0) + rest * (1 - f); W[n1] = (W[n1] || 0) + rest * f;
}
function wArm(W, p, m, s) {
  const F = AF[s], sfx = F.sfx, u = dot(sub(p, F.SH), F.d), Lu = 0.29, Lf = 0.25;
  const as = sstep(-0.025, 0.075, u), ae = sstep(Lu - 0.035, Lu + 0.035, u), tw = sstep(Lu + 0.03, Lu + 0.2, u), aw = sstep(Lu + Lf - 0.018, Lu + Lf + 0.018, u);
  chainW(W, ['clavicle', 'S_half', 'upperarm', 'E_half', 'E_0', 'F_mid', 'forearm', 'hand'].map(n => n + sfx), 2 * as + 2 * ae + 2 * tw + aw, m);
}
function wHand(W, p, m, s) {
  const F = AF[s], sfx = F.sfx;
  const aw = sstep(-0.018, 0.018, dot(sub(p, F.WR), F.d));
  const T1h = HD('thumb01' + sfx), T1t = TLp('thumb01' + sfx), td = DR('thumb01' + sfx);
  let t = 0.75 * (1 - sstep(0.010, 0.028, distSeg(p, T1h, T1t))) * sstep(-0.004, 0.02, dot(sub(p, T1h), td));
  const gh = [], gf = []; let G = 0;
  for (const fn of FING) {
    const P0 = HD(fn + '01' + sfx), dir = DR(fn + '01' + sfx), side = norm(cross(F.n, dir));
    const a0 = sstep(-0.014, 0.003, dot(sub(p, P0), dir)), lat = 1 - sstep(0.0065, 0.0125, Math.abs(dot(sub(p, P0), side)));
    const h = lat * (a0 <= 0.5 ? 2 * a0 : 2 - 2 * a0), f = lat * Math.max(0, 2 * a0 - 1);
    gh.push(h); gf.push(f); G += h + f;
  }
  if (t + G > 1) { const sc = 1 / (t + G); t *= sc; G = 1; for (let i = 0; i < 4; i++) { gh[i] *= sc; gf[i] *= sc; } }
  const base = m * (1 - t - G);
  W['forearm' + sfx] = (W['forearm' + sfx] || 0) + base * (1 - aw);
  W['hand' + sfx] = (W['hand' + sfx] || 0) + base * aw;
  if (t > 0) W['thumb_h1' + sfx] = (W['thumb_h1' + sfx] || 0) + t * m;
  FING.forEach((fn, i) => { if (gh[i] > 0) W[fn + '_h1' + sfx] = (W[fn + '_h1' + sfx] || 0) + gh[i] * m; if (gf[i] > 0) W[fn + '01' + sfx] = (W[fn + '01' + sfx] || 0) + gf[i] * m; });
}
function wFinger(W, p, m, s, fn) {
  const sfx = AF[s].sfx, P0 = HD(fn + '01' + sfx), dir = DR(fn + '01' + sfx), L1 = LN(fn + '01' + sfx), L2 = LN(fn + '02' + sfx);
  const u = dot(sub(p, P0), dir);
  const c = sstep(-0.014, 0.003, u) + sstep(L1 - 0.005, L1 + 0.005, u) + sstep(L1 + L2 - 0.0045, L1 + L2 + 0.0045, u);
  chainW(W, ['hand', fn + '_h1', fn + '01', fn + '_h2', fn + '02', fn + '_h3', fn + '03'].map(n => n + sfx), 2 * c, m);
}
function wThumb(W, p, m, s) {
  const sfx = AF[s].sfx, T = HD('thumb01' + sfx), td = DR('thumb01' + sfx), L1 = LN('thumb01' + sfx), L2 = LN('thumb02' + sfx);
  const u = dot(sub(p, T), td);
  const c = 0.75 * sstep(-0.004, 0.02, u) + 0.25 * sstep(0.02, 0.035, u) + sstep(L1 - 0.008, L1 + 0.008, u) + sstep(L1 + L2 - 0.006, L1 + L2 + 0.006, u);
  chainW(W, ['hand', 'thumb_h1', 'thumb01', 'thumb_h2', 'thumb02', 'thumb_h3', 'thumb03'].map(n => n + sfx), 2 * c, m);
}
function mtpFrac(p, s) { // 0 behind the oblique MTP line, 1 on the toes
  const X = x => s * x, a = [X(0.083), 0.022, 0.134], b = [X(0.149), 0.017, 0.099], mid = lerp(a, b, 0.5);
  const lineD = norm([b[0] - a[0], 0, b[2] - a[2]]);
  const nT = norm([-lineD[2], 0, lineD[0]]); const nn = nT[2] > 0 ? nT : mul(nT, -1);
  return sstep(-0.012, 0.008, dot(sub(p, mid), nn));
}
function wLeg(W, p, m, s) {
  const L = LF[s], sfx = L.sfx, u = L.HIP[1] - p[1];
  const hf = hipFollow(p, s, false), ak = sstep(0.42 - 0.05, 0.42 + 0.05, u), aa = sstep(L.ANK[1] + 0.03, L.ANK[1] - 0.02, p[1]);
  chainW(W, ['pelvis', 'H_half', 'thigh', 'K_half', 'shin', 'foot'].map(n => n === 'pelvis' ? n : n + sfx), 2 * hf + 2 * ak + aa, m);
}
function wFoot(W, p, m, s) {
  const L = LF[s], sfx = L.sfx;
  const aa = sstep(L.ANK[1] + 0.03, L.ANK[1] - 0.02, p[1]);
  chainW(W, ['shin', 'foot', 'toes'].map(n => n + sfx), aa + mtpFrac(p, s), m);
}
function partWeights(W, pi, p, m) {
  const name = PARTS[pi].name, s = name.endsWith('_R') ? -1 : 1;
  if (name === 'trunk') { wTrunk(W, p, m); return splitGlute(W, p); }
  if (name === 'head') { W.head = (W.head || 0) + m; return; }
  if (name.startsWith('arm')) return wArm(W, p, m, s);
  if (name.startsWith('hand')) return wHand(W, p, m, s);
  if (name.startsWith('thumb')) return wThumb(W, p, m, s);
  if (name.startsWith('leg')) { wLeg(W, p, m, s); return splitGlute(W, p); }
  if (name.startsWith('foot') || name.startsWith('toes')) return wFoot(W, p, m, s);
  for (const fn of FING) if (name.startsWith(fn)) return wFinger(W, p, m, s, fn);
  throw new Error('no weights for part ' + name);
}
function vertexWeights(p) {
  fieldAt(p[0], p[1], p[2]);
  const c = candAt(p[0], p[1], p[2]);
  let own = -1, best = Infinity; for (const cp of c.parts) if (PD[cp.pi] < best) { best = PD[cp.pi]; own = cp.pi; }
  const mem = [[own, 1]]; let tot = 0;
  for (const q of c.pairs) {
    if (q.a !== own && q.b !== own) continue; const o = q.a === own ? q.b : q.a;
    const delta = PD[o] - PD[own], km = Math.max(pairK(q, p[0], p[1], p[2]), q.kmin);
    if (delta < km) { const mm = 0.5 * (1 - delta / km); mem.push([o, mm]); tot += mm; }
  }
  if (tot > 1) for (let i = 1; i < mem.length; i++) mem[i][1] /= tot, tot = 1;
  mem[0][1] = Math.max(0, 1 - tot);
  const W = {};
  for (const [pi, m] of mem) if (m > 1e-4) partWeights(W, pi, p, m);
  let list = Object.entries(W).filter(([, w]) => w > 0.004).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = list.reduce((s, [, w]) => s + w, 0); list = list.map(([n, w]) => [BIX[n], w / sum]);
  for (const [i] of list) if (i === undefined) throw new Error('unknown bone in weights ' + JSON.stringify(W));
  return { own, list };
}

// =============================================================== FLESH, CAVITY, HEAD MASK
function fleshAt(p, ownName) {
  const blobs = [];
  for (const s of [1, -1]) {
    const X = x => s * x, F = AF[s];
    blobs.push([[X(0.066), 0.872, -0.085], 0.085, 1.0], [[X(0.06), 0.77, 0.0], 0.075, 0.75], [[X(0.11), 0.70, 0.0], 0.11, 0.5],
      [[X(0.13), 1.03, -0.03], 0.06, 0.45], [combo(F.SH, F.d, 0.14, F.f, -0.02), 0.065, 0.65], [combo(F.SH, F.d, 0.15, F.f, 0.015), 0.06, 0.35],
      [[X(0.065), 1.32, 0.08], 0.06, 0.45], [[X(0.1), 0.33, -0.04], 0.07, 0.4], [[X(0.1), 1.25, -0.06], 0.08, 0.2], [combo(F.SH, F.d, 0.37), 0.06, 0.18]);
  }
  blobs.push([[0, 1.02, 0.07], 0.085, 0.75], [[0, 1.12, 0.07], 0.07, 0.45]);
  let f = 0; for (const [c, r, v] of blobs) { const d = dist(p, c) / r; f = Math.max(f, v * Math.exp(-d * d * 1.4)); }
  for (const s of [1, -1]) { f *= sstep(0.025, 0.075, dist(p, AF[s].EL)); f *= sstep(0.03, 0.09, dist(p, LF[s].KNEE)); }
  if (/^(hand|thumb|index|middle|ring|pinky)/.test(ownName)) f *= 0.05;
  else if (/^(foot|toes)/.test(ownName)) f *= 0.08;
  else if (ownName === 'head') f = 0;
  return clamp(f, 0, 1);
}
function cavityAt(p, n, own) {
  const mask = new Uint8Array(PARTS.length); mask[own] = 1; for (const o of PARTS[own].adj) mask[o] = 1;
  const pd = new Float64Array(PARTS.length);
  const hs = [0.003, 0.007, 0.012, 0.019, 0.028], ws = [0.3, 0.25, 0.2, 0.15, 0.1];
  let occ = 0;
  for (let i = 0; i < hs.length; i++) { const q = combo(p, n, hs[i]); const d = fieldAt(q[0], q[1], q[2], pd, mask); occ += ws[i] * clamp((hs[i] - d) / hs[i], 0, 1); }
  return clamp(1 - occ * 1.3, 0, 1);
}
// dancewear zones, rest pose: loose shorts (waist to mid-thigh) and a tank top (scoop neck, armholes clear of the
// shoulders). Signed functions are positive inside the fabric. figure.js evaluates the same functions per fragment.
const GARMENT = {
  shorts: { waistFront: 1.003, waistBack: 1.026, hem: 0.70, hemRise: 0.016 },
  top: { hem: 0.985, neckFront: [1.362, 29.0], neckBack: [1.405, 19.0], armTop: 1.43, armBottom: 1.245, armX: 0.098, armXBack: 0.118, armFlare: 0.075 },
};
function shortsS(p) { const G = GARMENT.shorts; const waist = G.waistBack + (G.waistFront - G.waistBack) * sstep(-0.03, 0.03, p[2]); const hem = G.hem + G.hemRise * sstep(0.08, 0.17, Math.abs(p[0])); return Math.min(waist - p[1], p[1] - hem); }
function topS(p) {
  const G = GARMENT.top, ax = Math.abs(p[0]), fr = sstep(-0.03, 0.03, p[2]);
  const yb = G.neckBack[0] + (G.neckFront[0] - G.neckBack[0]) * fr, c = G.neckBack[1] + (G.neckFront[1] - G.neckBack[1]) * fr;
  const t = clamp((p[1] - G.armBottom) / (G.armTop - G.armBottom), 0, 1);
  const armX = G.armXBack + (G.armX - G.armXBack) * fr;
  return Math.min(yb + c * ax * ax - p[1], armX + G.armFlare * (1 - Math.sqrt(t)) - ax, p[1] - G.hem);
}
const clothable = name => name === 'trunk' || name.startsWith('leg');
function headCut(p) { return p[1] > 1.505 + (p[2] < 0 ? -p[2] * 0.4 : 0); }

// =============================================================== MAIN
sculptTrunk(); sculptHead(); for (const [s] of SIDES) { sculptArm(s); sculptHand(s); sculptLeg(s); sculptFoot(s); }
definePairs();
PD = new Float64Array(PARTS.length);
sculptTrunkDetails();
log(`sculpt: ${PRIMS.length} primitives, ${PARTS.length} parts, ${PAIRS.length} blends`);
setupGrid(H);
if (ARGS.slice) { // --slice=cx,cy,cz,ux,uy,uz,vx,vy,vz,halfSize : ASCII map of the field ('#' inside, '.' outside, letter = owner part)
  const a = ARGS.slice.split(',').map(Number), c = a.slice(0, 3), u = norm(a.slice(3, 6)), v = norm(a.slice(6, 9)), hs = a[9], N = 60;
  const letters = 'TAHabcdeKLMNOPQRSUVWXYZ';
  for (let j = N; j >= -N; j -= 2) { let row = ''; for (let i = -N; i <= N; i++) { const p = combo(c, u, hs * i / N, v, hs * j / N); const d = fieldAt(...p); row += d < 0 ? ({ hand_L: 'H', thumb_L: 'T', index_L: 'I', middle_L: 'M', trunk: 'B' }[PARTS[ownerPart(...p)].name] || '#') : d < 0.0015 ? ':' : '.'; } console.log(row); }
  console.log(PARTS.map(p => p.name).join(' ')); process.exit(0);
}
let mesh = polygonize();
log(`surface nets: ${mesh.pos.length / 3} verts, ${mesh.tris.length / 3} tris`);
project(mesh.pos, 1, H);
log('projected');
const nv0 = mesh.pos.length / 3;
const vpart = new Uint8Array(nv0);
for (let i = 0; i < nv0; i++) vpart[i] = ownerPart(mesh.pos[3 * i], mesh.pos[3 * i + 1], mesh.pos[3 * i + 2]);
const IMP = {}, LMAX = {};
for (const p of PARTS) {
  const n = p.name;
  IMP[p.name] = /^(index|middle|ring|pinky|thumb)/.test(n) ? 5 : /^hand/.test(n) ? 3.5 : /^toes/.test(n) ? 3 : /^foot/.test(n) ? 2 : n === 'head' ? 1.6 : 1;
  LMAX[p.name] = /^(index|middle|ring|pinky)/.test(n) ? 0.0042 : /^thumb/.test(n) ? 0.0048 : /^hand/.test(n) ? 0.0065 : /^toes/.test(n) ? 0.005 : /^foot/.test(n) ? 0.009 : n === 'head' ? 0.011 : /^arm/.test(n) ? 0.013 : /^leg/.test(n) ? 0.015 : 0.017;
}
const hemZone = (p, pi) => clothable(PARTS[pi].name) ? 1 - sstep(0.004, 0.016, Math.min(Math.abs(shortsS(p)), Math.abs(topS(p)))) : 0;
const jointZone = p => { let z = 0; for (const s of [1, -1]) { z = Math.max(z, 1 - sstep(0.03, 0.07, dist(p, AF[s].EL)), 1 - sstep(0.04, 0.08, dist(p, LF[s].KNEE)), 1 - sstep(0.03, 0.06, dist(p, AF[s].WR)), 1 - sstep(0.04, 0.08, dist(p, AF[s].SH)), 1 - sstep(0.04, 0.08, dist(p, LF[s].HIP))); } return z; };
if (TARGET > 0 && mesh.tris.length / 3 > TARGET) {
  const P = mesh.pos;
  mesh = decimate(P, mesh.tris, TARGET,
    v => { const p = [P[3 * v], P[3 * v + 1], P[3 * v + 2]]; return IMP[PARTS[vpart[v]].name] * (1 + 0.6 * jointZone(p) + 0.8 * hemZone(p, vpart[v])); },
    v => { const p = [P[3 * v], P[3 * v + 1], P[3 * v + 2]]; const l = LMAX[PARTS[vpart[v]].name]; return Math.min(l, 0.0105 + (1 - jointZone(p)) * 0.02, 0.0075 + (1 - hemZone(p, vpart[v])) * 0.03); });
}
project(mesh.pos, 3, 0.004);
{ // repair folded triangles: relax their vertices toward the 1-ring centroid, reproject, repeat
  const P = mesh.pos, T = mesh.tris, n = P.length / 3, ring = Array.from({ length: n }, () => new Set());
  for (let f = 0; f < T.length / 3; f++) for (let k = 0; k < 3; k++) { const a = T[3 * f + k], b = T[3 * f + (k + 1) % 3]; ring[a].add(b); ring[b].add(a); }
  for (let pass = 0; pass < 8; pass++) {
    const bad = new Set();
    for (let f = 0; f < T.length / 3; f++) {
      const ia = T[3 * f], ib = T[3 * f + 1], ic = T[3 * f + 2], A = [P[3 * ia], P[3 * ia + 1], P[3 * ia + 2]];
      const fnn = norm(cross(sub([P[3 * ib], P[3 * ib + 1], P[3 * ib + 2]], A), sub([P[3 * ic], P[3 * ic + 1], P[3 * ic + 2]], A)));
      const c = [0, 1, 2].reduce((acc, k) => add(acc, [P[3 * T[3 * f + k]], P[3 * T[3 * f + k] + 1], P[3 * T[3 * f + k] + 2]]), [0, 0, 0]).map(x => x / 3);
      const g = norm(gradAt(c[0], c[1], c[2], 0.0004));
      if (dot(fnn, g) < 0.3) for (let k = 0; k < 3; k++) bad.add(T[3 * f + k]);
    }
    if (!bad.size) break;
    const sub3 = new Float64Array(bad.size * 3); let j = 0;
    for (const v of bad) { let x = 0, y = 0, z = 0; for (const u of ring[v]) { x += P[3 * u]; y += P[3 * u + 1]; z += P[3 * u + 2]; } const m = ring[v].size || 1; P[3 * v] = x / m; P[3 * v + 1] = y / m; P[3 * v + 2] = z / m; sub3[j++] = v; }
    const tmp = new Float64Array(bad.size * 3); j = 0; for (const v of bad) { tmp[3 * j] = P[3 * v]; tmp[3 * j + 1] = P[3 * v + 1]; tmp[3 * j + 2] = P[3 * v + 2]; j++; }
    project(tmp, 3, 0.003); j = 0; for (const v of bad) { P[3 * v] = tmp[3 * j]; P[3 * v + 1] = tmp[3 * j + 1]; P[3 * v + 2] = tmp[3 * j + 2]; j++; }
    log(`fold repair pass ${pass}: ${bad.size} vertices relaxed`);
  }
  let flipped = 0; // leftovers are tiny slivers lying on the surface but wound inward: turn them to face out
  for (let f = 0; f < T.length / 3; f++) {
    const ia = T[3 * f], ib = T[3 * f + 1], ic = T[3 * f + 2], A = [P[3 * ia], P[3 * ia + 1], P[3 * ia + 2]];
    const fnn = norm(cross(sub([P[3 * ib], P[3 * ib + 1], P[3 * ib + 2]], A), sub([P[3 * ic], P[3 * ic + 1], P[3 * ic + 2]], A)));
    const c = [0, 1, 2].reduce((acc, k) => add(acc, [P[3 * T[3 * f + k]], P[3 * T[3 * f + k] + 1], P[3 * T[3 * f + k] + 2]]), [0, 0, 0]).map(x => x / 3);
    if (dot(fnn, norm(gradAt(c[0], c[1], c[2], 0.0004))) < -0.3) { T[3 * f + 1] = ic; T[3 * f + 2] = ib; flipped++; }
  }
  log(`fold repair: ${flipped} inward slivers re-wound`);
}
const pos = mesh.pos, tris = mesh.tris, nV = pos.length / 3, nT = tris.length / 3;
log(`final mesh: ${nV} verts, ${nT} tris; computing attributes`);
// mesh normals for fallback
const mn = new Float64Array(nV * 3);
for (let f = 0; f < nT; f++) {
  const [a, b, c] = [tris[3 * f], tris[3 * f + 1], tris[3 * f + 2]].map(i => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]]);
  const n = cross(sub(b, a), sub(c, a)); for (const i of [tris[3 * f], tris[3 * f + 1], tris[3 * f + 2]]) { mn[3 * i] += n[0]; mn[3 * i + 1] += n[1]; mn[3 * i + 2] += n[2]; }
}
const nrm = new Float32Array(nV * 3), skI = new Uint8Array(nV * 4), skW = new Uint8Array(nV * 4), flesh = new Uint8Array(nV), cav = new Uint8Array(nV), vown = new Uint8Array(nV);
let fallbackN = 0;
for (let i = 0; i < nV; i++) {
  const p = [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
  const m = norm([mn[3 * i], mn[3 * i + 1], mn[3 * i + 2]]);
  let g = gradAt(p[0], p[1], p[2], 0.0004); const gl = len(g);
  let n = gl > 0.2 ? mul(g, 1 / gl) : m;
  if (dot(n, m) < 0.5) { n = m; fallbackN++; if (ARGS.verbose) console.log("normal fallback at", p.map(x => x.toFixed(3)).join(","), "grad", gl.toFixed(2), "dot", dot(mul(g, 1 / (gl || 1)), m).toFixed(2)); }
  nrm[3 * i] = n[0]; nrm[3 * i + 1] = n[1]; nrm[3 * i + 2] = n[2];
  const { own, list } = vertexWeights(p); vown[i] = own;
  // quantize weights to bytes summing to 255
  const q = list.map(([, w]) => Math.round(w * 255)); let diff = 255 - q.reduce((a, b) => a + b, 0); q[0] += diff;
  for (let k = 0; k < 4; k++) { skI[4 * i + k] = k < list.length ? list[k][0] : 0; skW[4 * i + k] = k < list.length ? q[k] : 0; }
  flesh[i] = Math.round(fleshAt(p, PARTS[own].name) * 255);
  cav[i] = Math.round(cavityAt(p, n, own) * 255);
}
log(`attributes done (normal fallbacks ${fallbackN})`);
{ // folded-triangle check: face normal against the field normals of its corners
  let folds = 0;
  for (let f = 0; f < nT; f++) {
    const [a, b, c] = [tris[3 * f], tris[3 * f + 1], tris[3 * f + 2]], P3 = i => [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]];
    const fn = norm(cross(sub(P3(b), P3(a)), sub(P3(c), P3(a))));
    const vn = norm([0, 1, 2].reduce((acc, k) => add(acc, [nrm[3 * tris[3 * f + k]], nrm[3 * tris[3 * f + k] + 1], nrm[3 * tris[3 * f + k] + 2]]), [0, 0, 0]));
    if (dot(fn, vn) < 0.3) { folds++; if (ARGS.verbose && folds < 20) console.log('fold at', P3(a).map(x => x.toFixed(3)).join(','), 'dot', dot(fn, vn).toFixed(2)); }
  }
  log('folded triangles:', folds);
  let off = 0; for (let i = 0; i < nV; i++) { const d = fieldAt(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]); if (Math.abs(d) > 0.0004) { off++; if (ARGS.verbose && off < 12) console.log('off-surface', [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]].map(x => x.toFixed(3)).join(','), d.toFixed(4)); } }
  log('vertices off surface > 0.4 mm:', off);
}
// cloth: mask (trunk + legs) and heavily smoothed normals, so fabric does not follow small anatomy (navel, abs)
const clothMask = new Uint8Array(nV); for (let i = 0; i < nV; i++) clothMask[i] = clothable(PARTS[vown[i]].name) ? 255 : 0;
const adj = Array.from({ length: nV }, () => new Set());
for (let f = 0; f < nT; f++) for (let k = 0; k < 3; k++) { const a = tris[3 * f + k], b = tris[3 * f + (k + 1) % 3]; adj[a].add(b); adj[b].add(a); }
let cn = Float32Array.from(nrm);
for (let it = 0; it < 16; it++) {
  const nx = new Float32Array(nV * 3);
  for (let i = 0; i < nV; i++) { let x = cn[3 * i], y = cn[3 * i + 1], z = cn[3 * i + 2]; for (const j of adj[i]) { x += cn[3 * j]; y += cn[3 * j + 1]; z += cn[3 * j + 2]; } const l = Math.hypot(x, y, z) || 1; nx[3 * i] = x / l; nx[3 * i + 1] = y / l; nx[3 * i + 2] = z / l; }
  cn = nx;
}
// head group: triangles above the neck cut
const bodyT = [], headT = [];
for (let f = 0; f < nT; f++) {
  const c = [0, 1, 2].reduce((acc, k) => add(acc, [pos[3 * tris[3 * f + k]], pos[3 * tris[3 * f + k] + 1], pos[3 * tris[3 * f + k] + 2]]), [0, 0, 0]).map(x => x / 3);
  (headCut(c) ? headT : bodyT).push(tris[3 * f], tris[3 * f + 1], tris[3 * f + 2]);
}
// ---------------------------------------------------------------- pack
const bbMin = [Infinity, Infinity, Infinity], bbMax = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < nV; i++) for (let k = 0; k < 3; k++) { bbMin[k] = Math.min(bbMin[k], pos[3 * i + k]); bbMax[k] = Math.max(bbMax[k], pos[3 * i + k]); }
const center = [0, 1, 2].map(k => (bbMin[k] + bbMax[k]) / 2), halfR = [0, 1, 2].map(k => (bbMax[k] - bbMin[k]) / 2 * 1.0001);
const idx32 = nV > 65535;
const sections = [];
const qpos = new Int16Array(nV * 3); for (let i = 0; i < nV * 3; i++) { const k = i % 3; qpos[i] = Math.round((pos[i] - center[k]) / halfR[k] * 32767); }
const onrm = new Int8Array(nV * 2);
for (let i = 0; i < nV; i++) {
  let [x, y, z] = [nrm[3 * i], nrm[3 * i + 1], nrm[3 * i + 2]]; const l1 = Math.abs(x) + Math.abs(y) + Math.abs(z); x /= l1; y /= l1;
  if (z < 0) { const ox = x; x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1); y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1); }
  onrm[2 * i] = Math.round(clamp(x, -1, 1) * 127); onrm[2 * i + 1] = Math.round(clamp(y, -1, 1) * 127);
}
const ocn = new Int8Array(nV * 2);
for (let i = 0; i < nV; i++) {
  let [x, y, z] = [cn[3 * i], cn[3 * i + 1], cn[3 * i + 2]]; const l1 = Math.abs(x) + Math.abs(y) + Math.abs(z); x /= l1; y /= l1;
  if (z < 0) { const ox = x; x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1); y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1); }
  ocn[2 * i] = Math.round(clamp(x, -1, 1) * 127); ocn[2 * i + 1] = Math.round(clamp(y, -1, 1) * 127);
}
const idx = idx32 ? new Uint32Array(bodyT.length + headT.length) : new Uint16Array(bodyT.length + headT.length); idx.set(bodyT, 0); idx.set(headT, bodyT.length);
const parts = [['pos', qpos], ['nrm', onrm], ['skinIndex', skI], ['skinWeight', skW], ['flesh', flesh], ['cavity', cav], ['clothMask', clothMask], ['clothNrm', ocn], ['index', idx]];
let off = 0; const layout = {};
for (const [name, arr] of parts) { off = (off + 3) & ~3; layout[name] = [off, arr.byteLength]; off += arr.byteLength; }
const buf = Buffer.alloc(off);
for (const [name, arr] of parts) Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength).copy(buf, layout[name][0]);
const meta = {
  generated: new Date().toISOString(), vertexCount: nV, triangleCount: nT, indexType: idx32 ? 'uint32' : 'uint16', center, halfRange: halfR, layout,
  groups: [{ start: 0, count: bodyT.length, materialIndex: 0 }, { start: bodyT.length, count: headT.length, materialIndex: 1 }],
  bones: ALLB, helpers: HELPERS, fleshBones: FLESH_BONES, garment: GARMENT, gridH: H,
};
const b64 = buf.toString('base64');
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `// Generated by tools/build-body.mjs. Do not edit by hand. Sculpted SDF body, quantized and skinned.\n// ${nV} vertices, ${nT} triangles.\nexport const BODY_META = ${JSON.stringify(meta)};\nexport const BODY_B64 = '${b64}';\n`);
log(`wrote ${OUT} (${(b64.length / 1024 / 1024).toFixed(2)} MB base64, raw ${(off / 1024).toFixed(0)} KB)`);
