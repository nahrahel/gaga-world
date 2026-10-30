// shapes.js: the slow carrier postures ("big shape changes every 8 to 12 s, blended over 1.5 to 3 s, with small
// gestures always alive inside"). OWNER: builder C.
// Each shape is written for a lead side (left); instances mirror at random, and each arm gets its own variation
// so the arms almost never mirror each other.
import { NCH, BASE, TR, PX, PY, PZ, A, L, ac, lc, STW, FYAW, REL, GW, NTR, ARMN } from './rig.js';
import { clamp, smoother } from './noise.js';

// critically damped follower on an array (exact integration, any dt, dt = 0 leaves it untouched). Two of these in
// series give a C2 transition: position, velocity and acceleration stay continuous when the target jumps.
export function dampArr(x, v, tgt, w, dt, n) {
  if (!(dt > 0)) return;
  const e = Math.exp(-w * dt);
  for (let i = 0; i < n; i++) { const d = x[i] - tgt[i], c = v[i] + w * d, t = c * dt; x[i] = tgt[i] + (d + t) * e; v[i] = (v[i] - w * t) * e; }
}
const sstep = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

// spine capacity (positive / negative) per segment for distributing totals over spine01..06
const FLEX_POS = [14, 14, 12, 10, 9, 9], FLEX_NEG = [10, 10, 8, 6, 6, 6], ABD = [7, 7, 7, 6, 6, 6], TWI = [4, 5, 7, 8, 8, 7];
const sum = a => a.reduce((x, y) => x + y, 0);
export function spreadSpine(out, base, flex, abd, twist, scale = 1) {
  const fp = flex >= 0 ? FLEX_POS : FLEX_NEG, sf = sum(fp), sa = sum(ABD), st = sum(TWI);
  for (let i = 0; i < 6; i++) {
    const o = base + TR + 3 * (i + 1);
    out[o] += scale * flex * fp[i] / sf; out[o + 1] += scale * abd * ABD[i] / sa; out[o + 2] += scale * twist * TWI[i] / st;
  }
}

// ---- library. Arm fields: el (elevation), az (plane), tw (twist), ef (elbow), ftw (forearm twist), wf, wa (wrist),
// hang (0..1 gravity hang), curl, spr (0..1), clf, cla (clavicle). Body fields: pel [f,a,t], spine [f,a,t] totals,
// neck [f,a,t] split over neck01/02, head [f,a,t], px, py, pz, stw, fyaw, rel, gw, knee (both, deg out), foffL, foffR.
const LIB = {
  ready:      { arms: { el: 12, ef: 22 } },
  readyLow:   { py: -0.02, spine: [5, 0, 0], knee: 4 },
  vUp:        { py: 0.002, spine: [-7, 0, 0], neck: [-6, 0, 0], head: [-4, 0, 0], gw: 0.9,
                L: { el: 152, az: 14, tw: 40, ef: 26, wf: -14, curl: 0.03, spr: 1 }, R: { el: 134, az: 30, tw: 30, ef: 44, wf: 6, curl: 0.12, spr: 0.8 } },
  armsOut:    { py: -0.015, stw: 0.165, spine: [0, 0, 8], L: { el: 84, az: 8, tw: 12, ef: 42, wf: -10, curl: 0.06, spr: 0.95 }, R: { el: 66, az: 28, tw: -5, ef: 58, wf: 12, curl: 0.12, spr: 0.8 } },
  armsMid:    { spine: [0, 3, -6], L: { el: 74, az: 60, ef: 46, wf: 24, ftw: 10, spr: 0.6, curl: 0.18 }, R: { el: 34, az: 38, ef: 45, wf: 18, spr: 0.5 } },
  fold:       { pel: [36, 0, 0], spine: [62, 0, 0], neck: [20, 0, 0], head: [10, 0, 0], py: -0.2, pz: -0.11, gw: 0, knee: 6,
                arms: { hang: 1, el: 20, ef: 12, wf: 10, curl: 0.38, spr: 0.2 } },
  halfFold:   { pel: [22, 0, 0], spine: [32, 0, 0], neck: [8, 0, 0], py: -0.11, pz: -0.06, gw: 0.35,
                arms: { hang: 0.8, ef: 28, wf: 8, curl: 0.3 } },
  sideBend:   { pel: [0, -8, 0], spine: [2, -34, 0], neck: [0, -10, 0], px: 0.035, py: -0.02,
                L: { el: 166, az: 12, tw: 35, ef: 12, curl: 0.05, spr: 0.9 }, R: { el: 20, az: 12, ef: 26, hang: 0.5 } },
  plie:       { stw: 0.2, fyaw: 24, knee: 12, py: -0.13, pz: -0.01, spine: [-3, 0, 0],
                L: { el: 48, az: 40, ef: 50, tw: 10, wf: 12, curl: 0.25, spr: 0.4 }, R: { el: 30, az: 20, ef: 35, wf: 8, curl: 0.3 } },
  twist:      { pel: [0, 0, 14], spine: [2, 0, 34], neck: [0, 0, 16], py: -0.045,
                L: { el: 55, az: -32, ef: 72, wf: 10 }, R: { el: 74, az: 122, ef: 56, wf: 12 } },
  oneArmUp:   { spine: [0, -6, 0], neck: [0, 6, 0], py: -0.02,
                L: { el: 160, az: 24, tw: 30, ef: 14, curl: 0.04, spr: 1 }, R: { el: 24, az: 30, ef: 42, wf: 14, curl: 0.3 } },
  crouch:     { stw: 0.19, fyaw: 18, knee: 10, py: -0.34, pz: -0.13, pel: [30, 0, 0], spine: [28, 0, 0], neck: [-12, 0, 0],
                arms: { el: 58, az: 84, ef: 24, wf: 16, hang: 0.25, spr: 0.5 } },
  archBack:   { spine: [-30, 0, 0], pel: [-10, 0, 0], neck: [-14, 0, 0], head: [-6, 0, 0], pz: 0.045, py: -0.06, gw: 0.35,
                arms: { el: 118, az: -14, ef: 18, spr: 0.8, curl: 0.08 } },
  compact:    { spine: [9, 0, 0], neck: [6, 0, 0], py: -0.04,
                arms: { el: 24, az: 46, ef: 108, ftw: -25, wf: 14, curl: 0.92, spr: 0, clf: 6, cla: 3 } },
  reachDiag:  { spine: [6, 0, -16], pel: [0, 0, -6], pz: 0.03, py: -0.06, foffL: 0.12, foffR: -0.05,
                L: { el: 122, az: 64, ef: 8, wf: -8, spr: 0.9, curl: 0.05 }, R: { el: 30, az: 10, ef: 40 } },
  lunge:      { foffL: 0.26, foffR: -0.12, stw: 0.13, py: -0.16, pz: 0.03, spine: [6, 0, 0],
                L: { el: 95, az: 80, ef: 15, spr: 0.8, curl: 0.05 }, R: { el: 70, az: -20, ef: 20 } },
  handsFront: { py: -0.03, L: { el: 34, az: 70, ef: 70, ftw: -50, wf: 4, curl: 0.25, spr: 0.5 }, R: { el: 22, az: 50, ef: 50, ftw: -30, wf: 8, curl: 0.3, spr: 0.4 } },
  patFront:   { py: -0.04, knee: 4, arms: { el: 28, az: 62, ef: 100, ftw: -30, curl: 0.5 } },
  toesArmUp:  { rel: 0.65, L: { el: 166, az: 14, ef: 10, spr: 0.9, curl: 0.05 }, R: { el: 25, ef: 30 } },
  grooveV:    { rel: 0.18, arms: { el: 138, az: 22, ef: 40, tw: 20, curl: 0.45, spr: 0.3 } },
  brush:      { stw: 0.2, py: -0.04, foffL: 0.1, spine: [0, 0, 22], L: { el: 92, az: -6, spr: 1, curl: 0, ef: 30 }, R: { el: 74, az: 26, spr: 1, curl: 0, ef: 44 } },
};
// how big each posture is (0 quiet .. 1 large): shapes are chosen to match the current drive instead of being
// scaled down (half a shape reads as a mannequin A-pose)
const SIZE = { ready: 0, readyLow: 0.15, handsFront: 0.3, patFront: 0.35, compact: 0.45, armsMid: 0.5, plie: 0.6, halfFold: 0.6,
  twist: 0.6, grooveV: 0.7, brush: 0.7, armsOut: 0.7, reachDiag: 0.75, sideBend: 0.8, oneArmUp: 0.8, lunge: 0.8, vUp: 0.85,
  toesArmUp: 0.85, fold: 0.9, crouch: 0.95, archBack: 0.95 };
// shapes that own the arms (folds hang them, V up, side bend...). Every other shape leaves the arms to the
// per-arm scheduler, so each arm keeps its own posture and phase.
const OWN = { fold: 1, halfFold: 1, crouch: 1, vUp: 1, sideBend: 1, toesArmUp: 1, compact: 1, grooveV: 1, twist: 1, archBack: 1, patFront: 1, oneArmUp: 1 };
export const SHAPE_NAMES = Object.keys(LIB);
const HIGH_SHAPES = ['vUp', 'oneArmUp', 'toesArmUp', 'sideBend', 'archBack', 'reachDiag'];
export const SHAPE_INDEX = Object.fromEntries(SHAPE_NAMES.map((n, i) => [n, i]));

// Shape families for posture bias
const FAMILY = {
  low: ['fold', 'halfFold', 'crouch', 'compact', 'plie', 'readyLow'],
  high: ['vUp', 'oneArmUp', 'toesArmUp', 'archBack', 'grooveV', 'reachDiag'],
  open: ['armsOut', 'armsMid', 'brush', 'ready', 'sideBend'],
};

// Build a delta vector (shape minus base) for a shape, mirrored or not, with per-arm variation.
function writeArm(out, s, a, rnd, var_) {
  if (!a) return;
  const set = (k, v) => { if (v !== undefined) out[ac(s, k)] = v - BASE[ac(s, k)]; };
  const j = (amt) => (rnd() * 2 - 1) * amt * var_;
  set(A.UEL, a.el !== undefined ? clamp(a.el + j(14), 0, 175) : undefined);
  set(A.UAZ, a.az !== undefined ? a.az + j(18) : undefined);
  set(A.UTW, a.tw !== undefined ? a.tw + j(15) : undefined);
  set(A.EF, a.ef !== undefined ? clamp(a.ef + j(14), 0, 140) : undefined);
  set(A.FTW, a.ftw); set(A.WF, a.wf !== undefined ? a.wf + j(10) : undefined); set(A.WA, a.wa);
  set(A.CLF, a.clf); set(A.CLA, a.cla);
  if (a.hang !== undefined) out[ac(s, A.HANG)] = a.hang;
  if (a.curl !== undefined) for (let f = 0; f < 5; f++) out[ac(s, A.CURL + f)] = clamp(a.curl + j(0.12) + f * 0.03, -0.1, 1) - BASE[ac(s, A.CURL + f)];
  if (a.spr !== undefined) for (let f = 0; f < 5; f++) out[ac(s, A.SPR + f)] = clamp(a.spr + j(0.15), 0, 1) - BASE[ac(s, A.SPR + f)];
}

export function buildShape(out, name, mirror, rnd, variation) {
  out.fill(0);
  const S = LIB[name];
  const m = mirror ? -1 : 1;
  if (S.pel) { out[TR] += S.pel[0]; out[TR + 1] += m * S.pel[1]; out[TR + 2] += m * S.pel[2]; }
  if (S.spine) spreadSpine(out, 0, S.spine[0], m * S.spine[1], m * S.spine[2]);
  if (S.neck) for (let i = 7; i <= 8; i++) { out[TR + 3 * i] += S.neck[0] / 2; out[TR + 3 * i + 1] += m * S.neck[1] / 2; out[TR + 3 * i + 2] += m * S.neck[2] / 2; }
  if (S.head) { const o = TR + 27; out[o] += S.head[0]; out[o + 1] += m * S.head[1]; out[o + 2] += m * S.head[2]; }
  if (S.px) out[PX] = m * S.px;
  if (S.py) out[PY] = S.py;
  if (S.pz) out[PZ] = S.pz;
  if (S.stw) out[STW] = S.stw - BASE[STW];
  if (S.fyaw) out[FYAW] = S.fyaw - BASE[FYAW];
  if (S.rel) out[REL] = S.rel;
  if (S.gw !== undefined) out[GW] = S.gw - BASE[GW];
  if (S.knee) { out[lc(0, L.KNEE)] = S.knee; out[lc(1, L.KNEE)] = S.knee; }
  const lead = mirror ? 1 : 0, other = 1 - lead;
  if (S.foffL) out[lc(lead, L.FOFF)] = S.foffL;
  if (S.foffR) out[lc(other, L.FOFF)] = S.foffR;
  if (OWN[name]) {
    if (S.arms) { writeArm(out, 0, S.arms, rnd, variation); writeArm(out, 1, S.arms, rnd, variation); }
    if (S.L) writeArm(out, lead, S.L, rnd, variation);
    if (S.R) writeArm(out, other, S.R, rnd, variation);
  }
  // the scale of the posture varies a little per instance
  const k = 0.82 + rnd() * 0.3;
  for (let i = 0; i < NCH; i++) out[i] *= k;
  return out;
}

// ---- scheduler state per performer
export function createShapeState(rng) {
  return {
    from: new Float32Array(NCH), to: new Float32Array(NCH), cur: new Float32Array(NCH), m: new Float32Array(NCH), mv: new Float32Array(NCH), v: new Float32Array(NCH), own1: 0, ownV1: 0, ownV: 0,
    name: 'ready', prev: 'ready', blend: 1, blendDur: 2, hold: 3 + rng() * 4, t: 0, pendingIn: -1, amount: 0.3, ownFrom: 0, ownTo: 0, own: 0,
    weights: new Float32Array(SHAPE_NAMES.length),
  };
}

// choose the next shape from quality preferences (prefs: { qualityId: { shape: weight } })
export function pickShape(P, prefs) {
  const W = P.shape.weights; W.fill(0);
  W[SHAPE_INDEX.ready] = 1; W[SHAPE_INDEX.readyLow] = 0.4; W[SHAPE_INDEX.handsFront] = 0.2;
  let totalV = 0;
  for (const id in prefs) {
    const v = P.lv[id] || 0; if (v < 0.05) continue;
    const pr = prefs[id]; totalV += v;
    for (const n in pr) W[SHAPE_INDEX[n]] += v * pr[n] * 2.2;
  }
  if (P.shapeBoost) for (const n in P.shapeBoost) W[SHAPE_INDEX[n]] += P.shapeBoost[n];
  // performer posture bias
  const fam = FAMILY[P.bias];
  if (fam) for (const n of fam) W[SHAPE_INDEX[n]] *= 1.6;
  // biba removes the downward bias; float keeps things lifted
  const down = Math.max(P.lv.biba || 0, 0.6 * (P.lv.float || 0));
  for (const n of ['fold', 'halfFold', 'crouch']) W[SHAPE_INDEX[n]] *= 1 - 0.75 * down;
  // match the size of the posture to the drive of the active words
  const dr = P.shapeDrive || 0;
  for (let i = 0; i < W.length; i++) { const d = (SIZE[SHAPE_NAMES[i]] - dr) / 0.32; W[i] *= 0.05 + Math.exp(-d * d); }
  // shapes that send an arm overhead need an intensity near full
  const hi = 0.04 + 0.96 * sstep((dr - 0.5) / 0.35);
  for (const n of HIGH_SHAPES) W[SHAPE_INDEX[n]] *= hi;
  // no immediate repeat
  W[SHAPE_INDEX[P.shape.name]] *= 0.15;
  let sumW = 0; for (let i = 0; i < W.length; i++) sumW += W[i];
  let r = P.rng() * sumW;
  for (let i = 0; i < W.length; i++) { r -= W[i]; if (r <= 0) return SHAPE_NAMES[i]; }
  return 'ready';
}

// advance the shape scheduler (dts: slow-clock seconds) and return the current delta in P.shape.cur
export function updateShapes(P, dts, prefs, force) {
  const S = P.shape;
  S.t += dts;
  if (S.pendingIn >= 0) { S.pendingIn -= dts; if (S.pendingIn < 0) { force = true; S.pendingIn = -1; } }
  if (force || (S.blend >= 1 && S.t > S.hold)) {
    S.from.set(S.cur);
    S.prev = S.name;
    S.name = pickShape(P, prefs);
    S.ownFrom = S.own; S.ownTo = OWN[S.name] ? 1 : 0;
    buildShape(S.to, S.name, P.rng() < 0.5, P.rng, 0.5 + P.variation);
    S.blend = 0; S.blendDur = 1.6 + P.rng() * 1.4; S.t = 0; S.hold = 8 + P.rng() * 4;
  }
  if (S.blend < 1) S.blend = Math.min(1, S.blend + dts / S.blendDur);
  // the posture follows its target through two critically damped stages: a re-pick in the middle of a blend keeps
  // the velocity and acceleration the body already has (no restart from rest)
  const w = 8 / S.blendDur;
  dampArr(S.m, S.mv, S.to, w, dts, NCH);
  dampArr(S.cur, S.v, S.m, w, dts, NCH);
  if (dts > 0) {
    const e = Math.exp(-w * dts);
    let d = S.own1 - S.ownTo, c = S.ownV1 + w * d, t = c * dts; S.own1 = S.ownTo + (d + t) * e; S.ownV1 = (S.ownV1 - w * t) * e;
    d = S.own - S.own1; c = S.ownV + w * d; t = c * dts; S.own = S.own1 + (d + t) * e; S.ownV = (S.ownV - w * t) * e;
  }
  return S.cur;
}

// ---------------------------------------------------------------- per-arm postures
// Each arm picks its own posture on its own clock (holds 4..9 s, blends 1.2..2.5 s). The two arms never share a
// posture, and never both sit forward of the chest at mid height (the "sleepwalker" look). Arms live beside and
// around the body, drop into hangs, float out to the side with the forearm dangling, and rise overhead sometimes.
export const ARM_POSES = {
  hang:       { el: 6, az: 10, ef: 8, wf: 8, curl: 0.3, spr: 0.15, size: 0, low: 1 },
  hangBack:   { el: 14, az: -24, ef: 10, ftw: -10, wf: 12, curl: 0.35, size: 0.05, low: 1 },
  brushThigh: { el: 9, az: -4, ef: 8, ftw: 30, wf: -8, curl: 0.1, spr: 0.6, size: 0.1, low: 1 },
  curveLow:   { el: 26, az: 40, ef: 62, ftw: 20, wf: 18, curl: 0.25, spr: 0.4, size: 0.3, low: 1 },
  backLow:    { el: 34, az: -36, ef: 38, ftw: -20, wf: 12, curl: 0.3, size: 0.3, low: 1 },
  floatLow:   { el: 48, az: 16, ef: 44, droop: 0.7, wf: 16, curl: 0.2, spr: 0.5, size: 0.4 },
  chestCurve: { el: 48, az: 70, ef: 80, ftw: 15, wf: 20, curl: 0.25, spr: 0.3, size: 0.45, fwd: 1 },
  floatSide:  { el: 80, az: 6, ef: 50, droop: 0.9, wf: 22, curl: 0.15, spr: 0.7, size: 0.6 },
  floatFwd:   { el: 70, az: 45, ef: 55, droop: 0.8, wf: 22, curl: 0.15, spr: 0.6, size: 0.55, fwd: 1 },
  upOut:      { el: 124, az: 14, ef: 32, tw: 10, wf: -4, curl: 0.08, spr: 0.9, size: 0.8, high: 1 },
  reachDiag:  { el: 108, az: 48, ef: 26, wf: -8, curl: 0.05, spr: 0.9, size: 0.75, high: 1, fwd: 1 },
  overhead:   { el: 150, az: 14, ef: 16, tw: 20, wf: -10, curl: 0.03, spr: 1, size: 0.9, high: 1 },
};
export const ARM_NAMES = Object.keys(ARM_POSES);
const ARM_BASEW = { hang: 1, brushThigh: 0.5, curveLow: 0.6, hangBack: 0.35, floatLow: 0.3 };

function writeArmPose(out, s, p, rnd, var_) {
  out.fill(0);
  const set = (k, v) => { if (v !== undefined) out[k] = v - BASE[ac(s, k)]; };
  const j = (amt) => (rnd() * 2 - 1) * amt * var_;
  set(A.UEL, clamp(p.el + j(12), 0, 165)); set(A.UAZ, p.az + j(14)); set(A.UTW, (p.tw || 0) + j(12));
  set(A.EF, clamp(p.ef + j(p.low && p.size < 0.15 ? 4 : 12), 4, 85)); set(A.FTW, (p.ftw || 0) + j(20)); set(A.WF, (p.wf || 0) + j(8));
  out[A.DROOP] = p.droop ? clamp(p.droop + j(0.15), 0, 1) : 0;
  const curl = p.curl !== undefined ? p.curl : 0.3, spr = p.spr !== undefined ? p.spr : 0.2;
  for (let f = 0; f < 5; f++) { out[A.CURL + f] = clamp(curl + j(0.1) + f * 0.035, -0.1, 1) - BASE[ac(s, A.CURL + f)]; out[A.SPR + f] = clamp(spr + j(0.12), 0, 1) - BASE[ac(s, A.SPR + f)]; }
}

export function createArmState(rng, s) {
  return { from: new Float32Array(ARMN), to: new Float32Array(ARMN), cur: new Float32Array(ARMN), m: new Float32Array(ARMN), mv: new Float32Array(ARMN), v: new Float32Array(ARMN), name: 'hang', prev: 'hang',
    blend: 1, dur: 1.5, hold: (s ? 3.5 : 1.5) + rng() * 4, t: 0, forceLow: false, weights: new Float32Array(ARM_NAMES.length) };
}

function pickArm(P, s, prefs) {
  const me = P.arms[s], other = P.arms[1 - s], op = ARM_POSES[other.name], W = me.weights, dr = P.shapeDrive || 0;
  for (let i = 0; i < ARM_NAMES.length; i++) {
    const n = ARM_NAMES[i], p = ARM_POSES[n];
    let w = ARM_BASEW[n] || 0;
    for (const id in prefs) { const v = P.lv[id] || 0; if (v < 0.05) continue; const pr = prefs[id]; if (pr[n]) w += v * pr[n] * 2.2; }
    const d = (p.size - dr) / 0.38; w *= 0.06 + Math.exp(-d * d);
    if (n === other.name) w *= 0.04;                      // the arms never share a posture
    if (p.fwd && op.fwd) w = 0;                           // never both forward of the chest
    if (op.high) w *= p.low ? 1.7 : p.high ? 0.35 : 1;    // one up, the other low or curving
    if (p.high) w *= 0.04 + 0.96 * sstep((dr - 0.5) / 0.35); // overhead only when the intensity is near full
    if (n === me.name) w *= 0.2;
    if (me.forceLow && !p.low) w = 0;
    W[i] = w;
  }
  let sum = 0; for (let i = 0; i < W.length; i++) sum += W[i];
  if (sum <= 0) return 'hang';
  let r = P.rng() * sum;
  for (let i = 0; i < W.length; i++) { r -= W[i]; if (r <= 0) return ARM_NAMES[i]; }
  return 'hang';
}

export function updateArms(P, dts, prefs) {
  for (let s = 0; s < 2; s++) {
    const A_ = P.arms[s];
    A_.t += dts;
    if (A_.forceLow || (A_.blend >= 1 && A_.t > A_.hold)) {
      A_.from.set(A_.cur); A_.prev = A_.name;
      A_.name = pickArm(P, s, prefs);
      writeArmPose(A_.to, s, ARM_POSES[A_.name], P.rng, 0.5 + P.variation);
      A_.blend = 0; A_.dur = A_.forceLow ? 0.9 : 1.2 + P.rng() * 1.3; A_.t = 0; A_.hold = 4 + P.rng() * 5;
      A_.forceLow = false;
    }
    if (A_.blend < 1) A_.blend = Math.min(1, A_.blend + dts / A_.dur);
    const w = 8 / A_.dur;
    dampArr(A_.m, A_.mv, A_.to, w, dts, ARMN);
    dampArr(A_.cur, A_.v, A_.m, w, dts, ARMN);
  }
}
