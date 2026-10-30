// qualities.js: one generator / modifier per Gaga word. OWNER: builder C.
// Every quality writes into the performer's channel targets (P.T, smoothed by springs), post-spring accents
// (P.ACC, crisp), spring velocity kicks (P.V), or modifiers (P.mods). Signals are layered noise, traveling
// waves and impulses; the only steady oscillators are the groove bounce and the countdown swings.
import { n1, n2, n3, spow, clamp, smoothstep, smoother, burst, bump, cd2 } from './noise.js';
import { TR, PX, PY, PZ, A, L, ac, lc, STW, FYAW, REL, WS, GW, SG, NTR } from './rig.js';
import { spreadSpine } from './shapes.js';
import { LANDMARKS, BONE_BY_NAME } from '../skeleton.js';

const T3 = (i, k) => TR + 3 * i + k;      // trunk channel: i 0 pelvis .. 9 head; k 0 flex, 1 abd, 2 twist
const TAU = Math.PI * 2;
const SFX = ['_L', '_R'];

// fixed-rate history of a few values (for delayed sampling of integrated signals)
export class DelayLine {
  constructor(n, cap = 300, h = 1 / 60) { this.n = n; this.cap = cap; this.h = h; this.buf = new Float32Array(n * cap); this.head = 0; this.count = 0; this.tNext = -1e9; }
  push(t, a, b = 0, c = 0, d = 0, e = 0) {
    if (this.tNext < -1e8) this.tNext = t;
    let guard = 8;
    while (this.tNext <= t && guard--) {
      const o = this.head * this.n, B = this.buf;
      B[o] = a; if (this.n > 1) B[o + 1] = b; if (this.n > 2) B[o + 2] = c; if (this.n > 3) B[o + 3] = d; if (this.n > 4) B[o + 4] = e;
      this.head = (this.head + 1) % this.cap; this.count = Math.min(this.cap, this.count + 1); this.tNext += this.h;
    }
    if (this.tNext < t - this.h) this.tNext = t; // big jumps: resync
  }
  read(age, k) {
    if (this.count === 0) return 0;
    const x = Math.max(0, age / this.h), i0 = Math.min(this.count - 1, Math.floor(x)), i1 = Math.min(this.count - 1, i0 + 1), f = x - Math.floor(x);
    const p0 = ((this.head - 1 - i0) % this.cap + this.cap) % this.cap, p1 = ((this.head - 1 - i1) % this.cap + this.cap) % this.cap;
    return this.buf[p0 * this.n + k] * (1 - f) + this.buf[p1 * this.n + k] * f;
  }
}

// --------------------------------------------------------------------------- helpers
// A calm word sets the stage for its own movement: the generic background (small gestures, drift, quick posture
// changes) steps back so what you see is the word's own pathway, not the idle shimmer.
function calmMods(M, v, k = 1) {
  M.gesture *= 1 - 0.8 * k * v; M.gestureHands *= 1 - 0.95 * k * v; M.gestureFeet *= 1 - 0.85 * k * v;
  M.drift *= 1 - 0.5 * k * v; M.holdDrift *= 1 - 0.6 * k * v; M.holdMul *= 1 + 2.0 * k * v; M.fastScale *= 1 - 0.35 * k * v;
  M.weightShift *= 1 - 0.6 * k * v; M.travel *= 1 - 0.7 * k * v;
}
function armAdd(T, s, k, v) { T[ac(s, k)] += v; }
function legAdd(T, s, k, v) { T[lc(s, k)] += v; }
function fingersAdd(T, s, curl, spr) { for (let f = 0; f < 5; f++) { T[ac(s, A.CURL + f)] += curl; T[ac(s, A.SPR + f)] += spr; } }

function firstFree(arr) { for (let i = 0; i < arr.length; i++) if (!arr[i].on) return arr[i]; return null; }
function curveAct(ts, j, s0, v) { return smoothstep(-0.25, 0.35, n1(ts * 0.05 + j * 3.7, s0 + j)) * (0.35 + 0.65 * v); }
function shakeGain(v, sp, dist) { return v * clamp(0.25 + (sp - dist) * 0.55, 0, 1); }
function quakeQ(t, k, s0) { return n3(t * 6.2, s0 + k) * (0.35 + 0.65 * smoothstep(-0.3, 0.5, n1(t * 0.7, s0))); }
function grooveBeat(p) { return Math.pow(0.5 + 0.5 * Math.cos(p), 1.6); }

// event slot helper: returns true when the timer fires
function tick(st, key, dt, lo, hi, rng) {
  st[key] -= dt;
  if (st[key] <= 0) { st[key] = lo + rng() * (hi - lo); return true; }
  return false;
}

// --------------------------------------------------------------------------- base layer (always on)
// breath, drift band (0.05..0.3 Hz), weight shifts every 1..2 s, small gestures (2..5 Hz) on distal joints,
// and the idle float that keeps the body from ever standing still.
export function baseLayer(P) {
  const T = P.T, M = P.mods, s0 = P.ns, ts = P.ts, tf = P.tf, dts = P.dts, rng = P.rng;
  const g = M.gesture, gh = M.gestureHands, gf = M.gestureFeet, dg = M.drift;
  const fl = Math.max(P.lv.float || 0, 0.15);
  // breath
  P.breathPh += TAU * (0.2 + 0.05 * n1(ts * 0.05, s0 + 1)) * dts;
  const br = Math.sin(P.breathPh); P.breath = br;
  for (let i = 4; i <= 6; i++) T[T3(i, 0)] -= 0.7 * br;
  T[T3(7, 0)] += 0.6 * br;
  T[ac(0, A.CLA)] += 1.4 * br; T[ac(1, A.CLA)] += 1.4 * br;
  T[PY] += 0.002 * br;
  // drift band
  T[PX] += dg * 0.012 * n2(ts * 0.12, s0 + 50);
  T[PZ] += dg * 0.009 * n2(ts * 0.1, s0 + 51);
  T[PY] += dg * 0.006 * n2(ts * 0.09, s0 + 52);
  T[T3(0, 2)] += dg * 4 * n2(ts * 0.09, s0 + 53);
  T[T3(0, 1)] += dg * 1.5 * n2(ts * 0.11, s0 + 54);
  for (let i = 1; i <= 6; i++) {
    const tt = ts - i * 0.12;
    T[T3(i, 1)] += dg * 0.9 * n2(tt * 0.15, s0 + 60);
    T[T3(i, 2)] += dg * 0.8 * n2(tt * 0.12, s0 + 61);
    T[T3(i, 0)] += dg * 0.5 * n2(tt * 0.13, s0 + 62);
  }
  for (let s = 0; s < 2; s++) {
    armAdd(T, s, A.UEL, dg * 6 * n2(ts * 0.13, s0 + 70 + s * 9));
    armAdd(T, s, A.UAZ, dg * 9 * n2(ts * 0.11, s0 + 71 + s * 9));
    armAdd(T, s, A.EF, dg * 7 * n2(ts * 0.14, s0 + 72 + s * 9));
    armAdd(T, s, A.FTW, dg * 12 * n2(ts * 0.1, s0 + 73 + s * 9));
  }
  // ribcage: its own slow sway, twist and side bend on top of the pelvis (the chest is never a rigid block)
  const rb = 0.6 + 0.6 * (P.shapeDrive || 0) + 0.4 * fl;
  for (let i = 3; i <= 6; i++) {
    const tt = ts - (i - 3) * 0.1;
    T[T3(i, 1)] += rb * 1.6 * n2(tt * 0.27, s0 + 80);
    T[T3(i, 2)] += rb * 1.8 * n2(tt * 0.23, s0 + 81);
    T[T3(i, 0)] += rb * 0.9 * n2(tt * 0.31, s0 + 82);
  }
  // weight shift
  const W = P.wsh;
  if (tick(W, 'timer', dts, 1.0, 2.2, rng)) {
    const same = rng() < 0.22;
    W.target = same ? W.target * 0.4 : -Math.sign(W.target || 1) * (0.35 + 0.55 * rng());
  }
  // the decision is smoothed (two critically damped stages) before anything reads it: no jump reaches the body
  const wsv = cd2(W, W.target, 3.2, dts);
  T[WS] += wsv * (0.55 + 0.35 * fl) * M.weightShift;
  const free = wsv > 0 ? 1 : 0; // weight on the left -> right foot is free
  legAdd(T, free, L.PEEL, Math.abs(wsv) * 0.3 * gf * M.peelAllowed);
  legAdd(T, free, L.KNEE, Math.abs(wsv) * 3);
  // small gestures, distributed, aperiodic
  for (let i = 1; i <= 6; i++) {
    T[T3(i, 1)] += g * 1.3 * n2(tf * 0.9 - i * 0.04, s0 + 100 + i);
    T[T3(i, 2)] += g * 1.2 * n2(tf * 0.8 - i * 0.04, s0 + 110 + i);
    T[T3(i, 0)] += g * 0.7 * n2(tf * 0.85 - i * 0.04, s0 + 120 + i);
  }
  T[T3(0, 2)] += g * 3 * n2(tf * 0.7, s0 + 130);
  T[T3(0, 1)] += g * 2 * n2(tf * 0.75, s0 + 131);
  for (let i = 7; i <= 9; i++) {
    T[T3(i, 0)] += g * 2.2 * n2(tf * 1.1 - i * 0.05, s0 + 140 + i);
    T[T3(i, 1)] += g * 2.6 * n2(tf * 1.0 - i * 0.05, s0 + 150 + i);
    T[T3(i, 2)] += g * 2.6 * n2(tf * 0.9 - i * 0.05, s0 + 160 + i);
  }
  for (let s = 0; s < 2; s++) {
    const o = s0 + 200 + s * 40;
    armAdd(T, s, A.CLA, g * 6 * n2(tf * 1.5, o));
    armAdd(T, s, A.CLF, g * 5 * n2(tf * 1.3, o + 1));
    armAdd(T, s, A.UEL, g * 5 * n2(tf * 0.9 - 0.0, o + 2));
    armAdd(T, s, A.UAZ, g * 7 * n2(tf * 0.8, o + 3));
    armAdd(T, s, A.EF, g * 14 * n2(tf * 1.9 - 0.08, o + 4));
    armAdd(T, s, A.FTW, gh * 20 * n2(tf * 1.4 - 0.12, o + 5));
    armAdd(T, s, A.WF, gh * 26 * n2(tf * 2.5 - 0.16, o + 6));
    armAdd(T, s, A.WA, gh * 12 * n2(tf * 2.2 - 0.16, o + 7));
    for (let f = 0; f < 5; f++) {
      T[ac(s, A.CURL + f)] += gh * 0.34 * n2(tf * 3.3 - 0.24 + f * 0.9, o + 10 + f);
      T[ac(s, A.SPR + f)] += gh * 0.3 * n2(tf * 2.0 + f * 1.3, o + 20 + f);
    }
    legAdd(T, s, L.KNEE, g * 5 * n2(tf * 0.7, o + 30));
    legAdd(T, s, L.TOE, gf * 10 * n2(tf * 1.2, o + 31));
  }
  // occasional small foot lift of the unweighted foot (every 2..3 s at full small-gesture level)
  const FE = P.footEv;
  if (FE.t < 0) {
    FE.wait -= dts * (0.4 + 1.6 * gf);
    if (FE.wait <= 0 && !P.stepping && !P.stepPending && M.liftAllowed > 0.5) { FE.t = 0; FE.side = free; FE.dur = 0.55 + rng() * 0.4; FE.h = (0.03 + rng() * 0.06) * Math.min(1, 0.5 + gf); }
  } else {
    FE.t += P.dt;
    const u = FE.t / FE.dur;
    if (u >= 1) { FE.t = -1; FE.wait = 2 + rng() * 2.5; }
    else {
      const e = Math.pow(Math.sin(Math.PI * u), 1.6); // leaves and meets the floor at zero speed
      legAdd(T, FE.side, L.LIFT, FE.h * e);
      legAdd(T, FE.side, L.LFWD, FE.h * 0.4 * e);
      T[WS] += SG[1 - FE.side] * 0.6 * smoother(Math.min(1, Math.sin(Math.PI * u) * 1.7));
    }
  }
}

// --------------------------------------------------------------------------- quality table
// Each entry: { kind, attack, release, shapeGain, shapes, regions, tempo(P,v), init(P), gen(P,v), mod(P,v), post(P,v), glow(P,v,push) }
export const Q = {};

// ---- float: lift against gravity, buoyant arms, slow drift
Q.float = {
  attack: 2.2, release: 2.6, shapeGain: 0.95,
  shapes: { armsMid: 1.6, vUp: 1.0, armsOut: 0.9, brush: 0.6, reachDiag: 0.6, ready: 0.5, sideBend: 0.35, archBack: 0.1 },
  armPrefs: { floatSide: 1.4, floatLow: 1.2, upOut: 1.0, floatFwd: 0.6, overhead: 0.5, reachDiag: 0.4, curveLow: 0.4, hang: 0.3 },
  regions: { center: 0.2, pelvis: 0.2, spine: 0.4, arms: 0.7, hands: 0.4, legs: 0.15, feet: 0.1, head: 0.3, flesh: 0.1 },
  tempo: () => 0.12,
  mod(P, v) { P.mods.drift += 1.2 * v; P.mods.trail += 1.6 * v; P.mods.weightShift += 0.3 * v; P.mods.travel += 0.2 * v; P.mods.holdDrift += 0.5 * v; },
  gen(P, v) {
    const T = P.T, ts = P.ts, s0 = P.ns + 1000;
    for (let s = 0; s < 2; s++) {
      const o = s0 + s * 31;
      // each arm wanders on its own slow path, as if held up by water; elbows and palms keep changing
      const lift = 0.5 + 0.5 * n2(ts * 0.11, o);
      armAdd(T, s, A.UEL, (v * (6 + 34 * lift) + v * 16 * n2(ts * 0.27, o + 9)) * clamp(1.6 - T[ac(s, A.UEL)] / 110, 0.15, 1));
      armAdd(T, s, A.UAZ, v * 32 * n2(ts * 0.1, o + 1) + v * 10 * n2(ts * 0.3, o + 10));
      armAdd(T, s, A.EF, v * (6 + 30 * (0.5 + 0.5 * n2(ts * 0.17, o + 2))) * (1 - clamp((T[ac(s, A.UEL)] - 100) / 45, 0, 1)));
      armAdd(T, s, A.FTW, v * 40 * n2(ts * 0.11, o + 3));
      armAdd(T, s, A.UTW, v * 22 * n2(ts * 0.09, o + 4));
      armAdd(T, s, A.WA, v * 10 * n2(ts * 0.17, o + 5));
      armAdd(T, s, A.CLA, v * 4 * (0.5 + 0.5 * n2(ts * 0.12, o + 6)));
      T[ac(s, A.DROOP)] += v * 0.45 * (0.6 + 0.4 * n2(ts * 0.09, o + 11));
      // fingers open, spread, and ripple in sequence
      for (let f = 0; f < 5; f++) {
        T[ac(s, A.CURL + f)] += v * (-0.12 + 0.2 * n2((ts - f * 0.09) * 0.45, o + 7));
        T[ac(s, A.SPR + f)] += v * (0.35 + 0.25 * n2(ts * 0.3 + f * 0.4, o + 8));
      }
    }
    for (let i = 1; i <= 6; i++) {
      const tt = (ts - i * 0.14) * 0.11;
      T[T3(i, 1)] += v * 1.6 * n2(tt, s0 + 70);
      T[T3(i, 0)] += v * (1.0 * n2(tt, s0 + 71) - 0.35);
      T[T3(i, 2)] += v * 1.5 * n2(tt, s0 + 72);
    }
    T[T3(0, 1)] += v * 3 * n2(ts * 0.08, s0 + 73);
    T[PX] += v * 0.02 * n2(ts * 0.07, s0 + 80);
    T[PZ] += v * 0.015 * n2(ts * 0.06, s0 + 81);
    T[PY] += v * (0.004 + 0.012 * n2(ts * 0.1, s0 + 82));
  },
  glow(P, v, push) { push('spine03', 0, 0.03, 0.06, 0.16, v * 0.5); push('hand_L', 0.03, -0.04, 0, 0.08, v * 0.35); push('hand_R', -0.03, -0.04, 0, 0.08, v * 0.35); },
};

const LUNA_LM = [0, 1].map(s => ['thumb', 'index', 'middle', 'ring', 'pinky'].map(n => LANDMARKS['luna_' + n + SFX[s]]));
const FOOTBALL_LM = [LANDMARKS.football_L, LANDMARKS.football_R];
const BIBA_LM = [LANDMARKS.sitbone_L, LANDMARKS.sitbone_R, LANDMARKS.sacrum];
// ---- lunas: hands and feet come alive
Q.lunas = {
  attack: 1.6, release: 2.0, shapeGain: 0.5,
  shapes: { handsFront: 1.6, ready: 0.8, readyLow: 0.6, armsMid: 0.2, brush: 0.3 },
  armPrefs: { curveLow: 1.4, floatLow: 0.8, chestCurve: 0.6, brushThigh: 0.6, floatFwd: 0.4 },
  regions: { hands: 1, feet: 1, arms: 0.3, legs: 0.25, center: 0.05 },
  tempo: () => 2.2,
  init(P) { P.q.lunas = { relT: 6 + P.rng() * 6, rel: 0, relDur: 0, relAge: 99 }; },
  mod(P, v) { P.mods.gestureHands += 0.9 * v; P.mods.gestureFeet += 0.9 * v; P.mods.gazeHands += 0.5 * v; },
  gen(P, v) {
    const T = P.T, ts = P.ts, tf = P.tf, s0 = P.ns + 2000, st = P.q.lunas;
    for (let s = 0; s < 2; s++) {
      const o = s0 + s * 50;
      for (let f = 1; f < 5; f++) {
        const press = spow(n2(tf * 1.6 + f * 0.37, o + f), 0.7);
        T[ac(s, A.CURL + f)] += v * (0.12 + 0.32 * press);
        T[ac(s, A.SPR + f)] += v * (0.35 + 0.4 * n2(ts * 0.45 + f, o + 10 + f));
      }
      T[ac(s, A.CURL)] += v * 0.3 * n2(tf * 1.3, o + 20);
      T[ac(s, A.SPR)] += v * 0.5;
      armAdd(T, s, A.WF, v * (22 * n2(tf * 1.0, o + 21) - 6));
      armAdd(T, s, A.WA, v * 12 * n2(tf * 0.9, o + 22));
      armAdd(T, s, A.FTW, v * (-32 + 22 * n2(ts * 0.3, o + 23)));
      armAdd(T, s, A.UEL, v * 4); armAdd(T, s, A.UAZ, v * 6); armAdd(T, s, A.EF, v * 18);
      legAdd(T, s, L.TOE, v * 14 * n2(tf * 0.8, o + 30));
    }
    // weight rolls over the balls of the feet, heels peel alternately
    const a = n2(ts * 0.42, s0 + 40);
    legAdd(T, 0, L.PEEL, v * 0.9 * Math.max(0, a) * P.mods.peelAllowed);
    legAdd(T, 1, L.PEEL, v * 0.9 * Math.max(0, -a) * P.mods.peelAllowed);
    T[WS] += -0.45 * a * v;
    T[PZ] += v * 0.012 * (0.5 + 0.5 * n2(ts * 0.2, s0 + 41)); // weight over the balls
    // occasional releve
    st.relAge += P.dts;
    if (tick(st, 'relT', P.dts, 7, 14, P.rng)) { st.relAge = 0; st.relDur = 1.6 + P.rng() * 1.6; st.rel = 0.5 + 0.4 * P.rng(); }
    if (st.relAge < st.relDur) T[REL] += v * st.rel * Math.sin(Math.PI * st.relAge / st.relDur) * P.mods.peelAllowed;
  },
  glow(P, v, push) {
    const tf = P.tf, s0 = P.ns + 2000;
    for (let s = 0; s < 2; s++) {
      const f1 = 1 + ((Math.floor(tf * 0.8 + s * 1.7) % 4 + 4) % 4), f2 = 1 + ((f1 + 1) % 4);
      for (let q = 0; q < 2; q++) {
        const f = q === 0 ? f1 : f2;
        const lm = LUNA_LM[s][f];
        const press = 0.5 + 0.5 * n2(tf * 1.6 + f * 0.37, s0 + s * 50 + f);
        push(lm.bone, lm.offset[0], lm.offset[1], lm.offset[2], 0.035, v * (0.4 + 0.6 * press));
      }
      const fb = FOOTBALL_LM[s];
      push(fb.bone, fb.offset[0], fb.offset[1], fb.offset[2], 0.05, v * 0.8);
    }
  },
};

// ---- biba: length away from the sit bones (modifier)
Q.biba = {
  attack: 2.4, release: 2.4, shapeGain: 0.3,
  shapes: { ready: 1, armsMid: 0.5, vUp: 0.4 },
  armPrefs: { hang: 1, brushThigh: 0.6 },
  regions: { pelvis: 0.8, spine: 0.7, center: 0.3, head: 0.2 },
  tempo: () => 0.1,
  init(P) { P.q.biba = { a: P.rng() * TAU, b: P.rng() * TAU, c: P.rng() * TAU, d: P.rng() * TAU }; },
  mod(P, v) {
    calmMods(P.mods, v, 1);
  },
  // the tail lengthens and releases, the weight rocks from one sit bone to the other, the pelvis circles slowly
  // under a spine that hangs from the head: its own movement, slow and heavy
  gen(P, v) {
    const T = P.T, st = P.q.biba, ts = P.ts, dts = P.dts, s0 = P.ns + 13000;
    st.a += TAU * (0.3 + 0.06 * n2(ts * 0.05, s0)) * dts;
    st.b += TAU * (0.22 + 0.05 * n2(ts * 0.04, s0 + 1)) * dts;
    st.c += TAU * (0.17 + 0.04 * n2(ts * 0.05, s0 + 2)) * dts;
    st.d += TAU * (0.26 + 0.05 * n2(ts * 0.045, s0 + 3)) * dts;
    const tuck = Math.sin(st.a), rock = Math.sin(st.b), turn = Math.sin(st.c), knee = Math.sin(st.d);
    T[T3(0, 0)] += v * (20 * tuck - 4); T[T3(0, 1)] += v * 18 * rock; T[T3(0, 2)] += v * 18 * turn;
    T[PX] += v * 0.028 * Math.sin(st.b + 0.9); T[PZ] += v * 0.022 * Math.sin(st.a + 0.5);
    T[PY] -= v * (0.018 + 0.016 * (0.5 + 0.5 * tuck));
    spreadSpine(T, 0, v * -7 * tuck, v * -9 * rock, v * -6 * turn);
    for (let s = 0; s < 2; s++) {
      legAdd(T, s, L.KNEE, v * 14 * Math.sin(st.d + s * 1.9));
      armAdd(T, s, A.UAZ, v * 30 * Math.sin(st.b + s * Math.PI + 0.4)); armAdd(T, s, A.UEL, v * 24 * Math.sin(st.c + s * 2.1) + 8 * v); armAdd(T, s, A.EF, v * 14 * Math.sin(st.a + s));
    }
    T[T3(9, 0)] += v * 5 * knee * 0.4;
  },
  post(P, v) { // posture pass: runs after generators
    const T = P.T;
    for (let i = 1; i <= 6; i++) { const o = T3(i, 0); if (T[o] > 0) T[o] *= 1 - 0.65 * v; }
    T[T3(1, 0)] -= 2.2 * v; T[T3(2, 0)] -= 1.8 * v; T[T3(5, 0)] -= 1.5 * v; T[T3(6, 0)] -= 1.5 * v;
    if (T[T3(7, 0)] > 0) T[T3(7, 0)] *= 1 - 0.6 * v;
    T[T3(7, 0)] -= 2 * v; T[T3(9, 0)] += 3 * v;
    T[T3(0, 0)] -= 5 * v; // tail drops, pelvis heavy
    T[PY] -= 0.016 * v;
    T[ac(0, A.CLA)] -= 2 * v; T[ac(1, A.CLA)] -= 2 * v; // shoulders soften down as the spine grows
  },
  glow(P, v, push) {
    for (let i = 0; i < 3; i++) { const lm = BIBA_LM[i]; push(lm.bone, lm.offset[0], lm.offset[1], lm.offset[2], 0.06, v * 0.8); }
    push('spine02', 0, 0.04, -0.06, 0.08, v * 0.4);
  },
};

// ---- lena: the pelvis as the prime mover; spine follows segment by segment, arms passively later
Q.lena = {
  attack: 2.0, release: 2.4, shapeGain: 0.6,
  shapes: { plie: 0.45, readyLow: 1.6, armsMid: 0.4, ready: 0.9, lunge: 0.3 },
  armPrefs: { hang: 1.2, curveLow: 0.8, hangBack: 0.6, floatLow: 0.4, backLow: 0.4 },
  regions: { center: 1, pelvis: 0.9, spine: 0.6, legs: 0.45, arms: 0.3, head: 0.25 },
  mod(P, v) { P.mods.travel += 0.1 * v; P.mods.weightShift *= 1 - 0.6 * v; },
  tempo: (P) => 0.3,
  init(P) { P.q.lena = { ph: P.rng() * TAU, dir: 1, dirS: 1, hist: new DelayLine(5, 200, 1 / 60) }; },
  gen(P, v) {
    const T = P.T, ts = P.ts, s0 = P.ns + 3000, st = P.q.lena;
    const f = 0.2 + 0.1 * n2(ts * 0.05, s0);
    const dTarget = n1(ts * 0.025, s0 + 1) > -0.35 ? 1 : -1; // mostly one way, reverses now and then
    st.dirS += (dTarget - st.dirS) * Math.min(1, P.dts * 0.8);
    st.ph += TAU * f * P.dts * st.dirS;
    const m = 0.5 + 0.5 * n2(ts * 0.04, s0 + 2);           // circle <-> figure eight
    const ph = st.ph;
    const rx = v * 0.085 * (0.8 + 0.3 * n2(ts * 0.06, s0 + 3)), rz = v * 0.065 * (0.8 + 0.3 * n2(ts * 0.05, s0 + 4));
    const x = rx * Math.sin(ph), z = rz * ((1 - m) * Math.cos(ph) + m * Math.sin(2 * ph));
    const tf_ = v * 17 * ((1 - m) * Math.cos(ph + 0.9) + m * Math.sin(2 * ph + 0.9)); // pelvic tilt leads the travel
    const ta = v * 14 * Math.sin(ph + 0.7);
    const tt = v * 11 * Math.sin(ph * 0.5 + 0.4 * n2(ts * 0.1, s0 + 5)) + v * 4 * n2(ts * 0.2, s0 + 6);
    st.hist.push(ts, tf_, ta, tt, x, z);
    T[PX] += x; T[PZ] += z;
    T[PY] -= v * (0.015 + 0.02 * (0.5 - 0.5 * Math.cos(2 * ph)));
    T[T3(0, 0)] += tf_; T[T3(0, 1)] += ta; T[T3(0, 2)] += tt;
    // follow chain: world tilt of segment i follows the pelvis delayed by i * d, fading toward the head
    const d = 0.14;
    let pf = tf_, pa = ta, pt = tt;
    for (let i = 1; i <= 9; i++) {
      const g = Math.max(0, 1 - i * 0.09);
      const wf = g * st.hist.read(i * d, 0), wa = g * st.hist.read(i * d, 1), wt = g * st.hist.read(i * d, 2);
      // translation lag: the chest stays where the pelvis was a moment ago
      const lagX = st.hist.read(i * d, 3) - x, lagZ = st.hist.read(i * d, 4) - z;
      const lf = i <= 6 ? -lagZ * 60 / 6 : 0, la = i <= 6 ? lagX * 60 / 6 : 0;
      T[T3(i, 0)] += wf - pf + lf; T[T3(i, 1)] += wa - pa + la; T[T3(i, 2)] += wt - pt;
      pf = wf; pa = wa; pt = wt;
    }
    for (let s = 0; s < 2; s++) {
      legAdd(T, s, L.KNEE, v * 6 * Math.sin(ph + s * Math.PI));
      // arms follow last: they swing after the pelvis path with more lag
      const ax = st.hist.read(0.45, 3), az = st.hist.read(0.45, 4);
      armAdd(T, s, A.UAZ, -az * 260 + SG[s] * ax * 120);
      armAdd(T, s, A.UEL, SG[s] * -ax * 160 + 6 * v);
      armAdd(T, s, A.EF, 10 * v);
      T[ac(s, A.HANG)] += 0.15 * v;
    }
  },
  glow(P, v, push) { const lm = LANDMARKS.lena; push(lm.bone, lm.offset[0], lm.offset[1], lm.offset[2], 0.07 + 0.03 * v, v); },
};

// ---- snake of the spine: traveling waves pelvis <-> head, lateral and sagittal, sometimes twisting
Q.snake = {
  attack: 2.0, release: 2.4, shapeGain: 0.45,
  shapes: { readyLow: 1.0, plie: 0.5, ready: 1.0, armsMid: 0.6, armsOut: 0.3 },
  armPrefs: { hang: 1.4, hangBack: 0.6, curveLow: 0.5, floatLow: 0.4 },
  regions: { spine: 1, pelvis: 0.5, head: 0.6, center: 0.4, arms: 0.3 },
  tempo: () => 0.32,
  init(P) { P.q.snake = { pl: P.rng() * TAU, ps: P.rng() * TAU, pt: P.rng() * TAU, up: 1, hist: new DelayLine(3, 240, 1 / 60), crest: 4, crestV: 0 }; },
  mod(P, v) { P.mods.loose += 0.15 * v; },
  gen(P, v) {
    const T = P.T, ts = P.ts, s0 = P.ns + 4000, st = P.q.snake, dts = P.dts;
    st.pl += TAU * (0.3 + 0.06 * n2(ts * 0.07, s0)) * dts;
    st.ps += TAU * (0.28 + 0.06 * n2(ts * 0.06, s0 + 1)) * dts;
    st.pt += TAU * (0.16 + 0.06 * n2(ts * 0.05, s0 + 2)) * dts;
    const al = 0.75 + 0.35 * n2(ts * 0.05, s0 + 3), as = 0.6 + 0.4 * n2(ts * 0.045, s0 + 4), at = 0.25 + 0.5 * Math.max(0, n2(ts * 0.04, s0 + 5));
    const lat = al * Math.sin(st.pl) + 0.2 * n2(ts * 0.5, s0 + 6);
    const sag = as * Math.sin(st.ps) + 0.2 * n2(ts * 0.45, s0 + 7);
    const tw = at * Math.sin(st.pt);
    st.hist.push(ts, lat, sag, tw);
    const upT = n1(ts * 0.03, s0 + 8) > -0.62 ? 1 : 0; // tail to head, only now and then head to tail
    st.up += (upT - st.up) * Math.min(1, dts * 0.7);
    const d = 0.3; // seconds per spine segment; with the follower chain this makes about half a wavelength over the trunk
    let maxA = 0, crest = 4;
    for (let i = 0; i <= 9; i++) {
      const dl = (k) => Math.min(k, 6) * d; // the neck and head ride on the follower chain from the chest
      const aU = dl(i), aD = dl(9) - dl(i);
      const L_ = st.up * st.hist.read(aU, 0) + (1 - st.up) * st.hist.read(aD, 0);
      const S_ = st.up * st.hist.read(aU, 1) + (1 - st.up) * st.hist.read(aD, 1);
      const W_ = st.up * st.hist.read(aU, 2) + (1 - st.up) * st.hist.read(aD, 2);
      const gl = i === 0 ? 8 : i < 7 ? 6.2 : 6.5, gs = i === 0 ? 8 : i < 7 ? 11 : 8;
      T[T3(i, 1)] += v * gl * L_;
      T[T3(i, 0)] += v * gs * S_;
      T[T3(i, 2)] += v * 2.5 * W_;
      const mag = Math.abs(L_) + 0.7 * Math.abs(S_);
      if (mag > maxA) { maxA = mag; crest = i; }
    }
    st.crestV += (crest - st.crestV) * Math.min(1, dts * 6);
    // arms hang loose, a little lower and softer
    for (let s = 0; s < 2; s++) { armAdd(T, s, A.EF, 8 * v); T[ac(s, A.HANG)] += 0.12 * v; }
    T[PY] -= 0.015 * v;
  },
  glow(P, v, push) {
    const c = P.q.snake.crestV, i = Math.max(0, Math.min(9, Math.round(c)));
    const names = ['pelvis', 'spine01', 'spine02', 'spine03', 'spine04', 'spine05', 'spine06', 'neck01', 'neck02', 'head'];
    push(names[i], 0, 0.03, -0.05, 0.08, v);
    const j = Math.max(0, Math.min(9, i + (c > i ? 1 : -1)));
    push(names[j], 0, 0.03, -0.05, 0.06, v * 0.5);
  },
};

// ---- flesh and bones (modifier): flesh lags on a steadier skeleton
Q.flesh = {
  attack: 2.0, release: 2.4, shapeGain: 0.2,
  shapes: { readyLow: 0.6, armsMid: 0.4 },
  armPrefs: { hang: 0.8, floatLow: 0.5 },
  regions: { flesh: 1, spine: 0.1 },
  tempo: () => 0.2,
  init(P) { P.q.flesh = { a: P.rng() * TAU, b: P.rng() * TAU, c: P.rng() * TAU }; },
  gen(P, v) { // a soft bounce in the knees and a slow sway: the bones move gently, the flesh answers a beat later
    const T = P.T, st = P.q.flesh, ts = P.ts, dts = P.dts, s0 = P.ns + 14000;
    st.a += TAU * (1.25 + 0.2 * n2(ts * 0.05, s0)) * dts;
    st.b += TAU * (0.22 + 0.06 * n2(ts * 0.04, s0 + 1)) * dts;
    st.c += TAU * (0.16 + 0.04 * n2(ts * 0.05, s0 + 2)) * dts;
    const bob = Math.sin(st.a), sway = Math.sin(st.b), turn = Math.sin(st.c);
    T[PY] += v * 0.009 * bob - 0.008 * v; T[PX] += v * 0.02 * sway; T[PZ] += v * 0.012 * Math.sin(st.b * 0.5 + st.c);
    T[T3(0, 1)] += v * 8 * sway; T[T3(0, 2)] += v * 9 * turn;
    spreadSpine(T, 0, v * 1.5 * bob, v * -6 * sway, v * -7 * turn);
    for (let s = 0; s < 2; s++) {
      legAdd(T, s, L.KNEE, v * (5 + 7 * bob));
      armAdd(T, s, A.UEL, v * 7 * Math.sin(st.b + s * Math.PI * 0.8)); armAdd(T, s, A.UAZ, v * 15 * Math.sin(st.c + s * Math.PI + 0.6));
      armAdd(T, s, A.EF, v * 9 * (0.5 + 0.5 * Math.sin(st.a + s * 1.3)));
    }
  },
  mod(P, v) { const M = P.mods; M.fleshGain += 1.1 * v; M.fleshStiff *= 1 - 0.5 * v; M.fleshDamp *= 1 - 0.35 * v; M.zetaAdd += 0.08 * v; calmMods(M, v, 0.8); },
  glow(P, v, push) { push('thigh_L', 0, -0.15, 0.03, 0.1, v * 0.6); push('thigh_R', 0, -0.15, 0.03, 0.1, v * 0.6); push('spine02', 0, 0.02, 0.1, 0.12, v * 0.6); push('upperarm_L', 0.1, -0.1, 0, 0.06, v * 0.4); push('upperarm_R', -0.1, -0.1, 0, 0.06, v * 0.4); },
};

// ---- traveling balls: impulses passing joint to joint along pathways
const BALL_PATHS = [
  // [node, channel(s) per node] node descriptors: [boneName, kind]
  ['hand_L', 'forearm_L', 'upperarm_L', 'clavicle_L', 'spine06', 'clavicle_R', 'upperarm_R', 'forearm_R', 'hand_R'],
  ['hand_R', 'forearm_R', 'upperarm_R', 'clavicle_R', 'spine06', 'clavicle_L', 'upperarm_L', 'forearm_L', 'hand_L'],
  ['head', 'neck02', 'neck01', 'spine06', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'pelvis', 'thigh_L', 'shin_L', 'foot_L'],
  ['head', 'neck02', 'neck01', 'spine06', 'spine05', 'spine04', 'spine03', 'spine02', 'spine01', 'pelvis', 'thigh_R', 'shin_R', 'foot_R'],
  ['pelvis', 'spine01', 'spine02', 'spine03', 'spine04', 'spine05', 'spine06', 'neck01', 'neck02', 'head'],
  ['hand_L', 'forearm_L', 'upperarm_L', 'clavicle_L', 'spine06', 'spine05', 'spine04', 'spine03'],
  ['hand_R', 'forearm_R', 'upperarm_R', 'clavicle_R', 'spine06', 'spine05', 'spine04', 'spine03'],
];
const TRUNK_I = { pelvis: 0, spine01: 1, spine02: 2, spine03: 3, spine04: 4, spine05: 5, spine06: 6, neck01: 7, neck02: 8, head: 9 };
function ballBump(P, node, amp, sx, sy) {
  const T = P.T, side = node.endsWith('_R') ? 1 : 0, base = node.replace(/_[LR]$/, '');
  if (base in TRUNK_I) { const i = TRUNK_I[base]; const k = i === 0 ? 2.6 : i >= 7 ? 3 : 1.35; T[T3(i, 1)] += amp * 5 * k * sx; T[T3(i, 0)] += amp * 4 * k * sy; T[T3(i, 2)] += amp * 3 * k * sx; if (i === 0) T[PY] -= amp * 0.02; return; }
  switch (base) {
    case 'hand': armAdd(T, side, A.WF, amp * 45 * sy); armAdd(T, side, A.WA, amp * 16 * sx); fingersAdd(T, side, amp * 0.4 * sy, amp * 0.5); break;
    case 'forearm': armAdd(T, side, A.EF, amp * 42); armAdd(T, side, A.FTW, amp * 35 * sx); break;
    case 'upperarm': armAdd(T, side, A.UEL, amp * 32); armAdd(T, side, A.UAZ, amp * 22 * sx); break;
    case 'clavicle': armAdd(T, side, A.CLA, amp * 13); armAdd(T, side, A.CLF, amp * 9 * sx); break;
    case 'thigh': legAdd(T, side, L.KNEE, amp * 12 * sx); T[PY] -= amp * 0.025; break;
    case 'shin': legAdd(T, side, L.PEEL, amp * 0.7); T[PY] -= amp * 0.015; break;
    case 'foot': legAdd(T, side, L.PEEL, amp * 0.9); legAdd(T, side, L.TOE, amp * 20); break;
  }
}
Q.balls = {
  attack: 1.6, release: 2.0, shapeGain: 0.6,
  shapes: { armsOut: 1.3, armsMid: 1.0, ready: 0.6, oneArmUp: 0.5, readyLow: 0.4 },
  armPrefs: { floatSide: 1.0, floatLow: 0.8, upOut: 0.5, curveLow: 0.5 },
  regions: { arms: 0.7, spine: 0.6, hands: 0.5, legs: 0.3, head: 0.3, center: 0.2 },
  tempo: () => 0.7,
  init(P) { P.q.balls = { next: 0.5 + P.rng(), pool: Array.from({ length: 4 }, () => ({ on: false, path: 0, t: 0, dur: 1, amp: 1, sx: 1, sy: 1 })) }; },
  gen(P, v) {
    const st = P.q.balls, dts = P.dts, rng = P.rng;
    st.next -= dts * (0.5 + v);
    if (st.next <= 0) {
      st.next = 1 + rng() * 2;
      const b = firstFree(st.pool);
      if (b) { b.on = true; b.path = Math.floor(rng() * BALL_PATHS.length); b.t = 0; b.dur = 0.6 + rng() * 1.4; b.amp = 0.55 + 0.45 * rng(); b.sx = rng() < 0.5 ? -1 : 1; b.sy = rng() < 0.5 ? -1 : 1; }
    }
    for (const b of st.pool) {
      if (!b.on) continue;
      b.t += dts;
      const path = BALL_PATHS[b.path], n = path.length, step = b.dur / (n - 1), w = step * 1.7;
      if (b.t > b.dur + w) { b.on = false; continue; }
      for (let i = 0; i < n; i++) {
        const k = bump((b.t - i * step) / w);
        if (k > 0.001) ballBump(P, path[i], v * b.amp * k, b.sx * (i % 2 ? 1 : -1) * 0.5 + b.sx * 0.5, b.sy);
      }
    }
  },
  glow(P, v, push) {
    for (const b of P.q.balls.pool) {
      if (!b.on) continue;
      const path = BALL_PATHS[b.path], n = path.length, step = b.dur / (n - 1);
      const x = Math.max(0, Math.min(n - 1.001, b.t / step)), i = Math.floor(x), f = x - i;
      push(path[i], 0, 0, 0, 0.05 + 0.03 * b.amp, v * Math.min(1, 1.5 - Math.max(0, b.t - b.dur) * 2), path[i + 1], f);
    }
  },
};

// ---- curves: several joints draw circles at once
const CURVE_J = 8; // clavL, clavR, pelvis, head, wristL, wristR, ribs, armL, armR -> 9 entries (index 0..8)
Q.curves = {
  attack: 1.8, release: 2.2, shapeGain: 0.8,
  shapes: { armsOut: 1.0, oneArmUp: 0.9, vUp: 0.6, armsMid: 1.0, sideBend: 0.5, plie: 0.5, ready: 0.3 },
  armPrefs: { floatSide: 0.8, upOut: 0.8, curveLow: 0.8, backLow: 0.6, reachDiag: 0.5, overhead: 0.4 },
  regions: { arms: 0.6, pelvis: 0.5, head: 0.5, hands: 0.5, spine: 0.4, center: 0.3, legs: 0.2 },
  tempo: () => 0.45,
  mod(P, v) { P.mods.travel += 0.5 * v; },
  init(P) { const r = P.rng; P.q.curves = { ph: Float32Array.from({ length: 11 }, () => r() * TAU), f: Float32Array.from({ length: 11 }, () => 0.2 + r() * 0.4), dir: Float32Array.from({ length: 11 }, () => (r() < 0.5 ? -1 : 1)) }; },
  gen(P, v) {
    const T = P.T, ts = P.ts, s0 = P.ns + 5000, st = P.q.curves, dts = P.dts;
    for (let j = 0; j < 11; j++) {
      const dirN = n1(ts * 0.02 + j * 1.3, s0 + 50 + j);
      st.ph[j] += TAU * st.f[j] * (1 + 0.25 * n2(ts * 0.08, s0 + 20 + j)) * dts * (dirN > -0.4 ? st.dir[j] : -st.dir[j]);
    }
    const ph = st.ph;
    for (let side = 0; side < 2; side++) {
      const a = curveAct(ts, side, s0, v) * v;
      armAdd(T, side, A.CLA, a * 8 * Math.sin(ph[side])); armAdd(T, side, A.CLF, a * 8 * Math.cos(ph[side]));
      const aw = curveAct(ts, 4 + side, s0, v) * v;
      armAdd(T, side, A.WF, aw * 30 * Math.sin(ph[4 + side])); armAdd(T, side, A.WA, aw * 16 * Math.cos(ph[4 + side])); armAdd(T, side, A.FTW, aw * 20 * Math.sin(ph[4 + side]));
      const aa = curveAct(ts, 7 + side, s0, v) * v;
      armAdd(T, side, A.UEL, aa * 30 * Math.sin(ph[7 + side])); armAdd(T, side, A.UAZ, aa * 34 * Math.cos(ph[7 + side])); armAdd(T, side, A.EF, aa * 15 * (1 + Math.sin(ph[7 + side])));
      const ak = curveAct(ts, 9 + side, s0, v) * v;
      legAdd(T, side, L.KNEE, ak * 12 * Math.sin(ph[9 + side])); legAdd(T, side, L.PEEL, ak * 0.5 * Math.max(0, Math.cos(ph[9 + side])) * P.mods.peelAllowed);
    }
    const ap = curveAct(ts, 2, s0, v) * v;
    T[T3(0, 1)] += ap * 9 * Math.sin(ph[2]); T[T3(0, 0)] += ap * 8 * Math.cos(ph[2]); T[PX] += ap * 0.03 * Math.sin(ph[2]); T[PZ] += ap * 0.025 * Math.cos(ph[2]);
    const ah = curveAct(ts, 3, s0, v) * v;
    T[T3(7, 1)] += ah * 5 * Math.sin(ph[3]); T[T3(8, 1)] += ah * 5 * Math.sin(ph[3]); T[T3(7, 0)] += ah * 6 * Math.cos(ph[3]); T[T3(8, 0)] += ah * 5 * Math.cos(ph[3]); T[T3(9, 1)] += ah * 4 * Math.sin(ph[3]);
    const ar = curveAct(ts, 6, s0, v) * v;
    for (let i = 4; i <= 6; i++) { T[T3(i, 1)] += ar * 5 * Math.sin(ph[6]); T[T3(i, 0)] += ar * 4 * Math.cos(ph[6]); }
    T[PX] -= ar * 0.02 * Math.sin(ph[6]);
  },
  glow(P, v, push) { push('clavicle_L', 0.1, 0, 0, 0.06, v * 0.5); push('clavicle_R', -0.1, 0, 0, 0.06, v * 0.5); push('pelvis', 0, 0, 0.05, 0.1, v * 0.5); push('head', 0, 0.08, 0, 0.07, v * 0.4); push('hand_L', 0.04, -0.05, 0, 0.05, v * 0.4); push('hand_R', -0.04, -0.05, 0, 0.05, v * 0.4); },
};

// ---- shake: chosen, starts at a point in the torso and spreads
// distance of each region from the origin point (spine02/03), used for the spread
const SHAKE_DIST = { spine: 0, pelvis: 1, chest: 1, clav: 2, neck: 2, knees: 2, uarm: 3, head: 3, fore: 4, feet: 4, hand: 5, fing: 6 };
Q.shake = {
  attack: 2.2, release: 1.8, shapeGain: 0.85,
  shapes: { patFront: 0.3, halfFold: 0.3, toesArmUp: 0.3, armsOut: 0.3, readyLow: 0.3 }, // the performer's own variant is boosted
  armPrefs: { hang: 1, floatSide: 0.7, curveLow: 0.5 },
  regions: { flesh: 1, center: 0.7, spine: 0.6, arms: 0.6, hands: 0.6, legs: 0.5, head: 0.4, feet: 0.3, pelvis: 0.6 },
  tempo: (P) => 4.6 * P.shakeHz,
  init(P) { P.q.shake = { spread: 0 }; },
  mod(P, v) { P.mods.loose += 0.6 * v; P.mods.fleshGain += 0.9 * v; P.mods.gesture *= 1 - 0.3 * v; P.mods.gazeAway += 0.5 * v; },
  gen(P, v) {
    const st = P.q.shake, T = P.T, Ac = P.ACC, tf = P.tf, s0 = P.ns + 6000;
    const tau = 30 - 22 * v;
    st.spread += (1 - st.spread) * Math.min(1, P.dt / tau);
    const sp = st.spread * 7.5;
    const hz = 4.6 * P.shakeHz, ft = tf * hz;
    const s1 = n2(ft, s0), s2 = n2(ft * 1.07 + 3, s0 + 1), s3 = n2(ft * 0.93 + 7, s0 + 2);
    // torso point
    const gs = shakeGain(v, sp, 0), gc = shakeGain(v, sp, 1), gp = shakeGain(v, sp, 1);
    for (let i = 1; i <= 6; i++) {
      const k = i <= 3 ? gs : gc, lag = i * 0.012;
      Ac[T3(i, 0)] += k * 2.2 * n2((tf - lag) * hz, s0 + 3);
      Ac[T3(i, 1)] += k * 2.4 * n2((tf - lag) * hz, s0 + 4);
      Ac[T3(i, 2)] += k * 2.0 * n2((tf - lag) * hz, s0 + 5);
    }
    Ac[T3(0, 1)] += gp * 3 * s2; Ac[T3(0, 2)] += gp * 3 * s3;
    // knees pump: pelvis bob
    const gk = shakeGain(v, sp, SHAKE_DIST.knees);
    Ac[PY] += gk * 0.026 * s1 - gk * 0.012;
    Ac[PX] += gk * 0.008 * s2;
    T[PY] -= 0.015 * v;
    // shoulders and arms loose: proximal leads, distal follows with lag and grows in size
    const gcl = shakeGain(v, sp, 2), gu = shakeGain(v, sp, 3), gf = shakeGain(v, sp, 4), gh = shakeGain(v, sp, 5), gfi = shakeGain(v, sp, 6), ghd = shakeGain(v, sp, 3), gn = shakeGain(v, sp, 2);
    for (let s = 0; s < 2; s++) {
      const o = s0 + 20 + s * 20;
      const tb = tf - 0.02 * s;
      Ac[ac(s, A.CLA)] += gcl * 8 * n2((tb - 0) * hz, o + 0); Ac[ac(s, A.CLF)] += gcl * 5 * n2((tb - 0) * hz, o + 1);
      Ac[ac(s, A.UEL)] += gu * 11 * n2((tb - 0.03) * hz, o + 2); Ac[ac(s, A.UAZ)] += gu * 10 * n2((tb - 0.03) * hz, o + 3);
      Ac[ac(s, A.EF)] += gf * 18 * n2((tb - 0.07) * hz, o + 4); Ac[ac(s, A.FTW)] += gf * 26 * n2((tb - 0.07) * hz, o + 5);
      Ac[ac(s, A.WF)] += gh * 38 * n2((tb - 0.11) * hz, o + 6); Ac[ac(s, A.WA)] += gh * 16 * n2((tb - 0.11) * hz, o + 7);
      for (let f = 0; f < 5; f++) Ac[ac(s, A.CURL + f)] += gfi * 0.3 * n2((tb - 0.14 + f * 0.01) * hz, o + 8 + f);
      armAdd(T, s, A.EF, gf * 10);
      Ac[lc(s, L.PEEL)] += shakeGain(v, sp, 4) * 0.1 * Math.max(0, n2((tb - 0.0) * hz, o + 14));
    }
    for (let i = 7; i <= 9; i++) { Ac[T3(i, 0)] += (i === 9 ? ghd : gn) * 4 * n2((tf - 0.04 * i) * hz, s0 + 60 + i); Ac[T3(i, 1)] += (i === 9 ? ghd : gn) * 3.5 * n2((tf - 0.04 * i) * hz, s0 + 70 + i); }
  },
  onRelease(P) { P.q.shake.spread *= 0.5; },
  glow(P, v, push) { const sp = P.q.shake.spread; push('spine02', 0, 0.04, 0.05, 0.05 + 0.3 * sp, v * (0.6 + 0.4 * sp)); },
};

// ---- quake: tremor from the floor, involuntary, passes up with lag
Q.quake = {
  attack: 1.4, release: 1.8, shapeGain: 0.5,
  shapes: { readyLow: 1.2, plie: 0.4, ready: 0.7, halfFold: 0.3 },
  armPrefs: { hang: 1.2, curveLow: 0.5 },
  regions: { feet: 1, legs: 0.9, pelvis: 0.7, spine: 0.5, flesh: 0.6, head: 0.3, arms: 0.3 },
  tempo: () => 6,
  mod(P, v) { P.mods.loose += 0.5 * v; P.mods.fleshGain += 0.7 * v; P.mods.gesture *= 1 - 0.3 * v; },
  gen(P, v) {
    const Ac = P.ACC, T = P.T, tf = P.tf, s0 = P.ns + 7000;
    for (let s = 0; s < 2; s++) { Ac[lc(s, L.PEEL)] += v * 0.22 * Math.max(0, quakeQ(tf, 10 + s, s0)); Ac[lc(s, L.KNEE)] += v * 4 * quakeQ(tf - 0.02, 12 + s, s0); }
    Ac[PY] += v * (0.02 * quakeQ(tf - 0.03, 1, s0) - 0.012);
    Ac[PX] += v * 0.01 * quakeQ(tf - 0.04, 2, s0);
    Ac[T3(0, 0)] += v * 4.5 * quakeQ(tf - 0.05, 3, s0); Ac[T3(0, 1)] += v * 4.5 * quakeQ(tf - 0.05, 4, s0);
    for (let i = 1; i <= 9; i++) {
      const t = tf - 0.06 - i * 0.03;
      Ac[T3(i, 0)] += v * (i >= 7 ? 4 : 2) * quakeQ(t, 5, s0); Ac[T3(i, 1)] += v * (i >= 7 ? 4 : 2.3) * quakeQ(t, 6, s0); Ac[T3(i, 2)] += v * 1.2 * quakeQ(t, 7, s0);
    }
    for (let s = 0; s < 2; s++) {
      const t = tf - 0.2;
      Ac[ac(s, A.CLA)] += v * 6 * quakeQ(t, 30 + s, s0);
      Ac[ac(s, A.UEL)] += v * 9 * quakeQ(t, 20 + s, s0); Ac[ac(s, A.UAZ)] += v * 8 * quakeQ(t, 22 + s, s0);
      Ac[ac(s, A.EF)] += v * 14 * quakeQ(t - 0.05, 24 + s, s0); Ac[ac(s, A.WF)] += v * 30 * quakeQ(t - 0.1, 26 + s, s0);
      for (let f = 0; f < 5; f++) Ac[ac(s, A.CURL + f)] += v * 0.25 * quakeQ(t - 0.12 - f * 0.01, 28 + s, s0);
      armAdd(T, s, A.EF, 12 * v);
    }
    T[PY] -= 0.02 * v;
  },
  glow(P, v, push) {
    const u = (P.tf * 0.9) % 1;
    const chain = ['foot_L', 'shin_L', 'thigh_L', 'pelvis', 'spine03', 'spine06', 'head'];
    const x = u * (chain.length - 1), i = Math.floor(x);
    push('foot_L', 0, -0.04, 0.05, 0.06, v * 0.7); push('foot_R', 0, -0.04, 0.05, 0.06, v * 0.7);
    push(chain[i], 0, 0, 0, 0.07, v * 0.7, chain[i + 1], x - i);
  },
};

// ---- boil like spaghetti: Poisson bubbles push loose limbs and spine
const BOIL_CH = [];
for (let i = 0; i <= 9; i++) for (let k = 0; k < 3; k++) BOIL_CH.push([T3(i, k), i === 0 ? 10 : i >= 7 ? 12 : 4.5]);
for (let s = 0; s < 2; s++) {
  BOIL_CH.push([ac(s, A.UEL), 28], [ac(s, A.UAZ), 30], [ac(s, A.UTW), 30], [ac(s, A.EF), 36], [ac(s, A.FTW), 40], [ac(s, A.WF), 45], [ac(s, A.CLA), 10], [ac(s, A.CLF), 9]);
  BOIL_CH.push([lc(s, L.KNEE), 14]);
}
BOIL_CH.push([PX, 0.03], [PZ, 0.025], [PY, 0.03]);
Q.boil = {
  attack: 1.4, release: 2.0, shapeGain: 0.5,
  shapes: { readyLow: 1.2, halfFold: 0.6, ready: 0.6, plie: 0.3 },
  armPrefs: { hang: 1, floatLow: 0.6, curveLow: 0.5 },
  regions: { flesh: 0.7, spine: 0.7, arms: 0.7, hands: 0.6, pelvis: 0.6, head: 0.6, legs: 0.5, center: 0.5, feet: 0.2 },
  tempo: () => 5,
  mod(P, v) { P.mods.loose += 0.9 * v; P.mods.gestureHands += 0.3 * v; P.mods.fleshGain += 0.6 * v; },
  gen(P, v) {
    const rng = P.rng, rate = (3 + 5 * v) * P.mods.fastScale;
    let p = 1 - Math.exp(-rate * P.dt);
    for (let k = 0; k < 3 && rng() < p; k++) {
      // a bubble: kick one channel, sometimes a connected group
      const bc = BOIL_CH[Math.floor(rng() * BOIL_CH.length)], ch = bc[0], mag = bc[1];
      const sgn = rng() < 0.5 ? -1 : 1, size = v * (0.5 + rng());
      P.V[ch] += sgn * size * mag * P.omega[ch] * 2.6;
      if (rng() < 0.3) { // spine bubble travels a little
        for (let i = 1; i <= 6; i++) P.V[T3(i, rng() < 0.5 ? 1 : 0)] += sgn * size * 3 * P.omega[T3(i, 1)] * 0.5;
      }
      p *= 0.5;
    }
    const T = P.T, tf = P.tf, s0 = P.ns + 8000;
    for (let s = 0; s < 2; s++) {
      armAdd(T, s, A.EF, v * (18 + 20 * n3(tf * 0.9, s0 + 10 + s))); armAdd(T, s, A.WF, v * 30 * n3(tf * 1.5, s0 + s));
      armAdd(T, s, A.UEL, v * 18 * n3(tf * 0.7, s0 + 12 + s)); armAdd(T, s, A.UAZ, v * 20 * n3(tf * 0.6, s0 + 14 + s));
      T[ac(s, A.HANG)] += 0.2 * v;
    }
    spreadSpine(T, 0, v * 8 * n3(tf * 0.5, s0 + 20), v * 10 * n3(tf * 0.55, s0 + 21), v * 10 * n3(tf * 0.45, s0 + 22));
    T[PY] -= 0.02 * v;
  },
  glow(P, v, push) { const k = Math.floor(P.tf * 4) % 5; const n = ['spine02', 'hand_L', 'spine05', 'hand_R', 'pelvis'][k]; push(n, 0, 0.02, 0.04, 0.07, v * 0.8); push('spine03', 0, 0, 0.05, 0.14, v * 0.4); },
};

// ---- thick (modifier): honey. Slower, heavier, compact, effortful
Q.thick = {
  attack: 2.4, release: 2.4, shapeGain: 0.8,
  shapes: { compact: 2.2, plie: 0.5, readyLow: 0.8, crouch: 0.3, halfFold: 0.3 },
  armPrefs: { curveLow: 1, chestCurve: 0.8, floatLow: 0.6 },
  regions: { flesh: 0.5, arms: 0.45, spine: 0.35, center: 0.3, legs: 0.3, hands: 0.4 },
  tempo: () => 0.12,
  mod(P, v) {
    const M = P.mods;
    M.slowScale *= 1 - 0.55 * v; M.fastScale *= 1 - 0.5 * v; M.stiff *= 1 - 0.42 * v; M.zetaAdd += 0.28 * v; M.loose *= 1 - 0.7 * v;
    M.fleshGain -= 0.35 * v; M.fleshStiff *= 1 + 0.7 * v; M.trail *= 1 - 0.5 * v; calmMods(M, v, 1);
  },
  init(P) { P.q.thick = { a: P.rng() * TAU, b: P.rng() * TAU, c: P.rng() * TAU, d: P.rng() * TAU }; },
  gen(P, v) { // working against resistance: slow strong pushes, the whole body leaning into the air and giving way again
    v *= 0.72;
    const T = P.T, st = P.q.thick, ts = P.ts, dts = P.dts, s0 = P.ns + 9000;
    st.a += TAU * (0.42 + 0.1 * n2(ts * 0.05, s0 + 30)) * dts;
    st.b += TAU * (0.31 + 0.08 * n2(ts * 0.04, s0 + 31)) * dts;
    st.c += TAU * (0.25 + 0.06 * n2(ts * 0.05, s0 + 32)) * dts;
    st.d += TAU * (0.36 + 0.08 * n2(ts * 0.045, s0 + 33)) * dts;
    const push = Math.sin(st.a), lean = Math.sin(st.b), turn = Math.sin(st.c), dip = Math.sin(st.d);
    for (let s = 0; s < 2; s++) {
      const ph = s * 2.6 + 0.4;
      armAdd(T, s, A.UEL, v * (30 + 40 * Math.sin(st.a + ph))); armAdd(T, s, A.UAZ, v * 52 * Math.sin(st.b + ph));
      armAdd(T, s, A.EF, v * 22 * Math.sin(st.c + ph + 1)); armAdd(T, s, A.FTW, v * 30 * Math.sin(st.d + ph));
      legAdd(T, s, L.KNEE, v * 14 * Math.sin(st.d + s * Math.PI * 0.7));
    }
    spreadSpine(T, 0, v * 12 * lean, v * 16 * turn, v * 26 * Math.sin(st.a * 0.7 + 0.5));
    T[T3(0, 2)] += v * 12 * turn; T[T3(0, 1)] += v * 8 * Math.sin(st.d + 1); T[T3(0, 0)] += v * 7 * lean;
    T[PX] += v * 0.035 * Math.sin(st.b + 1); T[PZ] += v * 0.02 * push;
    T[PY] -= v * (0.03 + 0.025 * (0.5 + 0.5 * dip));
  },
  post(P, v) {
    const T = P.T;
    for (let s = 0; s < 2; s++) {
      T[ac(s, A.EF)] += 28 * v;
      for (let f = 0; f < 5; f++) { const o = ac(s, A.CURL + f); T[o] += (0.88 - T[o]) * 0.65 * v; T[ac(s, A.SPR + f)] *= 1 - 0.6 * v; }
      T[ac(s, A.CLA)] += 2 * v;
    }
  },
  glow(P, v, push) { push('spine04', 0, 0, 0.06, 0.18, v * 0.5); push('upperarm_L', 0.12, -0.12, 0, 0.07, v * 0.4); push('upperarm_R', -0.12, -0.12, 0, 0.07, v * 0.4); push('thigh_L', 0, -0.2, 0.03, 0.08, v * 0.3); push('thigh_R', 0, -0.2, 0.03, 0.08, v * 0.3); },
};

// ---- plenty of time (modifier): large motion slows, small fast textures keep their speed
Q.time = {
  attack: 2.6, release: 2.6, shapeGain: 0.35,
  shapes: { armsMid: 0.8, vUp: 0.5, brush: 0.6, ready: 0.5 },
  armPrefs: { floatLow: 0.8, floatSide: 0.6, hang: 0.5 },
  regions: { spine: 0.3, center: 0.2, arms: 0.2 },
  tempo: () => 0.08,
  init(P) { P.q.time = { a: P.rng() * TAU, b: P.rng() * TAU, c: P.rng() * TAU, d: P.rng() * TAU }; },
  mod(P, v) {
    const M = P.mods;
    M.slowScale *= 1 - 0.55 * v; M.accentDecay *= 1 + 0.9 * v;
    calmMods(M, v, 1);
  },
  // there is plenty of time: the arms and the spine sweep through a large range and arrive without hurry
  gen(P, v) {
    v *= 0.8;
    const T = P.T, st = P.q.time, dts = P.dts, ts = P.ts, s0 = P.ns + 15000;
    st.a += TAU * (0.4 + 0.08 * n2(ts * 0.05, s0)) * dts;
    st.b += TAU * (0.32 + 0.07 * n2(ts * 0.04, s0 + 1)) * dts;
    st.c += TAU * (0.26 + 0.06 * n2(ts * 0.05, s0 + 2)) * dts;
    st.d += TAU * (0.22 + 0.05 * n2(ts * 0.045, s0 + 3)) * dts;
    for (let s = 0; s < 2; s++) {
      const ph = s * 2.4;
      armAdd(T, s, A.UEL, v * (22 + 30 * Math.sin(st.a + ph))); armAdd(T, s, A.UAZ, v * 40 * Math.sin(st.b + ph + 0.7));
      armAdd(T, s, A.EF, v * (14 + 16 * Math.sin(st.c + ph))); armAdd(T, s, A.UTW, v * 22 * Math.sin(st.d + ph)); armAdd(T, s, A.FTW, v * 26 * Math.sin(st.b + ph + 2));
      armAdd(T, s, A.WF, v * 16 * Math.sin(st.a + ph + 1.2));
    }
    spreadSpine(T, 0, v * 10 * Math.sin(st.c + 0.5), v * 16 * Math.sin(st.d), v * 20 * Math.sin(st.b + 1.1));
    T[T3(0, 2)] += v * 10 * Math.sin(st.b + 0.4); T[T3(0, 1)] += v * 7 * Math.sin(st.d + 1.4);
    T[T3(9, 0)] += v * 6 * Math.sin(st.a); T[T3(8, 2)] += v * 10 * Math.sin(st.b + 1.9);
    T[PX] += v * 0.025 * Math.sin(st.c); T[PY] -= v * (0.012 + 0.012 * Math.sin(st.a));
  },
  glow(P, v, push) { push('spine05', 0, 0, 0.08, 0.12, v * 0.4 * (0.6 + 0.4 * P.breath)); },
};

// ---- groove: a personal rhythmic pulse in pelvis and knees
Q.groove = {
  attack: 1.6, release: 2.0, shapeGain: 0.65,
  shapes: { grooveV: 1.0, armsOut: 0.5, readyLow: 1.2, ready: 0.8 },
  armPrefs: { curveLow: 1.2, floatLow: 0.8, upOut: 0.5, hang: 0.5 },
  regions: { pelvis: 1, legs: 0.8, feet: 0.7, center: 0.6, head: 0.35, arms: 0.35, spine: 0.3 },
  tempo: (P) => P.grooveHz,
  init(P) { P.q.groove = { ph: P.rng() * TAU, sync: 0, syncT: 4 + P.rng() * 6, amp: 1 }; },
  mod(P, v) { P.mods.weightShift *= 1 - 0.5 * v; P.mods.travel += 0.35 * v; },
  gen(P, v) {
    const st = P.q.groove, T = P.T, Ac = P.ACC, s0 = P.ns + 10000;
    st.ph += TAU * P.grooveHz * P.dt;
    // syncopation: every few seconds one beat is skipped, doubled, or pushed late
    st.syncT -= P.dt;
    if (st.syncT <= 0) { st.syncT = 3 + P.rng() * 6; st.sync = 1; st.syncKind = Math.floor(P.rng() * 3); }
    let am = 1, phOff = 0;
    if (st.sync > 0) {
      st.sync -= P.dt * P.grooveHz * 0.8;
      const e = Math.sin(Math.PI * clamp(1 - st.sync, 0, 1));
      if (st.syncKind === 0) am = 1 - 0.7 * e; else if (st.syncKind === 1) phOff = 0; else phOff = -0.6 * e;
    }
    const ph = st.ph + phOff;
    const b = grooveBeat(ph), b2 = st.syncKind === 1 && st.sync > 0 ? grooveBeat(ph * 2) : b;
    Ac[PY] -= v * am * (0.024 * b2 + 0.006);
    T[PY] -= 0.012 * v;
    T[REL] += v * (0.18 + 0.12 * (1 - b2)) * P.mods.peelAllowed;
    const half = ph * 0.5;
    T[PX] += v * 0.022 * Math.sin(half + 0.3);
    T[WS] += v * 0.55 * Math.sin(half);
    T[T3(0, 1)] += v * 5 * Math.sin(half + 0.6); T[T3(0, 2)] += v * 7 * Math.sin(half + 1.1);
    T[T3(0, 0)] += v * 4 * Math.cos(ph + 0.4) * am;
    for (let s = 0; s < 2; s++) {
      const sg = SG[s];
      legAdd(T, s, L.PEEL, v * 0.5 * Math.max(0, -sg * Math.sin(half)) * P.mods.peelAllowed);
      legAdd(T, s, L.KNEE, v * 6 * Math.sin(half + s * Math.PI));
      Ac[ac(s, A.CLA)] += v * 5 * grooveBeat(ph - 0.5 - s * 0.25) * am;
      Ac[ac(s, A.CLF)] += v * 5 * Math.sin(half + s * Math.PI + 0.7);
      Ac[ac(s, A.UEL)] += v * 12 * grooveBeat(ph - 0.6) * am;
      Ac[ac(s, A.EF)] += v * 16 * grooveBeat(ph - 0.85) * am;
      Ac[ac(s, A.WF)] += v * 20 * grooveBeat(ph - 1.1) * am;
      armAdd(T, s, A.UAZ, v * 24 * Math.sin(half + s * Math.PI + 0.5));
      armAdd(T, s, A.UEL, v * 10 * Math.sin(half * 0.5 + s * 1.7));
      armAdd(T, s, A.EF, v * 28);
      fingersAdd(T, s, 0.2 * v, 0);
    }
    Ac[T3(7, 0)] += v * 4.5 * grooveBeat(ph - 0.7) * am; Ac[T3(9, 0)] += v * 3 * grooveBeat(ph - 1.0) * am;
    for (let i = 3; i <= 6; i++) Ac[T3(i, 0)] += v * 1.2 * grooveBeat(ph - 0.3 - i * 0.05) * am;
    T[T3(9, 1)] += v * 6 * Math.sin(half + 2.1);
    spreadSpine(T, 0, 0, v * 8 * Math.sin(half + 1.4), v * 12 * Math.sin(half + 1.8));
  },
  glow(P, v, push) { const b = Math.pow(0.5 + 0.5 * Math.cos(P.q.groove.ph), 2); const lm = LANDMARKS.lena; push(lm.bone, lm.offset[0], lm.offset[1], lm.offset[2], 0.08, v * (0.4 + 0.6 * b)); push('foot_L', 0, -0.04, 0.06, 0.05, v * 0.5 * b); push('foot_R', 0, -0.04, 0.06, 0.05, v * 0.5 * b); },
};

// ---- silly: playful quirky events and broken symmetry
Q.silly = {
  attack: 1.4, release: 1.8, shapeGain: 0.5,
  shapes: { oneArmUp: 0.7, reachDiag: 0.7, armsMid: 0.7, readyLow: 0.5, twist: 0.6, ready: 0.4 },
  armPrefs: { reachDiag: 0.6, curveLow: 0.6, backLow: 0.6, upOut: 0.5 },
  regions: { head: 0.8, arms: 0.55, pelvis: 0.5, hands: 0.5, spine: 0.35, legs: 0.35 },
  tempo: () => 1.6,
  init(P) { P.q.silly = { next: 0.5 + P.rng(), ev: [{ on: false }, { on: false }] }; },
  mod(P, v) { P.mods.gesture += 0.2 * v; P.mods.gestureHands += 0.2 * v; P.mods.loose += 0.2 * v; P.mods.travel += 0.3 * v; },
  gen(P, v) {
    const st = P.q.silly, rng = P.rng, Ac = P.ACC, T = P.T;
    st.next -= P.dt * P.tempo;
    if (st.next <= 0) {
      st.next = 0.8 + rng() * 1.4;
      const e = firstFree(st.ev);
      if (e) { e.on = true; e.kind = Math.floor(rng() * 6); e.t = 0; e.dur = [0.9, 0.8, 0.9, 0.8, 1.0, 1.6][e.kind] * (0.8 + 0.5 * rng()); e.side = rng() < 0.5 ? 0 : 1; e.f = 3 + rng() * 1.5; e.ph = rng() * TAU; e.amp = 1.0 + 0.5 * rng(); }
    }
    for (const e of st.ev) {
      if (!e.on) continue;
      e.t += P.dt;
      if (e.t > e.dur) { e.on = false; continue; }
      const env = smoothstep(0, 0.12, e.t) * (1 - smoothstep(e.dur - 0.3, e.dur, e.t)) * v * e.amp;
      const osc = Math.sin(TAU * e.f * e.t + e.ph), s = e.side;
      switch (e.kind) {
        case 0: // shoulder giggle bursts
          Ac[ac(s, A.CLA)] += env * 9 * Math.max(0, osc); Ac[ac(1 - s, A.CLA)] += env * 6 * Math.max(0, -osc); Ac[T3(9, 0)] += env * 3 * osc; break;
        case 1: // head bobs
          Ac[T3(7, 0)] += env * 6 * Math.sin(TAU * 2.6 * e.t); Ac[T3(8, 1)] += env * 8 * Math.sin(TAU * 1.3 * e.t + e.ph); Ac[T3(9, 1)] += env * 6 * Math.sin(TAU * 1.3 * e.t + e.ph); break;
        case 2: // hip roll
          Ac[PX] += env * 0.035 * Math.sin(TAU * 1.4 * e.t + e.ph); Ac[PZ] += env * 0.03 * Math.cos(TAU * 1.4 * e.t + e.ph); Ac[T3(0, 1)] += env * 10 * Math.sin(TAU * 1.4 * e.t + e.ph + 1); break;
        case 3: // knock-knee moment
          Ac[lc(s, L.KNEE)] -= env * 22; Ac[lc(s, L.PEEL)] += env * 0.8 * P.mods.peelAllowed; Ac[PY] -= env * 0.025; Ac[T3(0, 1)] -= SG[s] * env * 5; break;
        case 4: // wiggly hands
          for (let k = 0; k < 2; k++) { Ac[ac(k, A.WF)] += env * 30 * Math.sin(TAU * 5.2 * e.t + k); Ac[ac(k, A.WA)] += env * 14 * Math.sin(TAU * 4.1 * e.t + k * 2); for (let f = 0; f < 5; f++) Ac[ac(k, A.CURL + f)] += env * 0.4 * Math.sin(TAU * 5.5 * e.t + f * 0.9 + k); } break;
        case 5: { // lopsided reach with a head tilt (blend toward an up-and-out diagonal)
          const X = P.X, k = Math.min(1, env);
          Ac[ac(s, A.UEL)] += k * (140 - X[ac(s, A.UEL)]); Ac[ac(s, A.UAZ)] += k * (10 - X[ac(s, A.UAZ)]); Ac[ac(s, A.EF)] += k * (15 - X[ac(s, A.EF)]);
          Ac[T3(9, 1)] += SG[s] * env * 12; Ac[T3(8, 1)] += SG[s] * env * 8;
          for (let i = 3; i <= 6; i++) Ac[T3(i, 1)] -= SG[s] * env * 3; break; }
      }
    }
    // lopsided posture bias while silly is on
    T[ac(0, A.UEL)] += v * 10 * P.asym; T[ac(1, A.UEL)] -= v * 10 * P.asym; T[T3(9, 1)] += v * 6 * P.asym;
  },
  glow(P, v, push) { push('head', 0, 0.08, 0.02, 0.09, v * 0.7); push('clavicle_L', 0.12, 0, 0, 0.05, v * 0.4); push('clavicle_R', -0.12, 0, 0, 0.05, v * 0.4); },
};

// ---- explosive (accent): sharp extension from calm, no wind-up, soft decay back to delicate
function fireExplosion(P, strength) {
  const st = P.q.explosive, rng = P.rng;
  const e = firstFree(st.ev) || st.ev[0];
  e.on = true; e.t = -rng() * 0.06; e.amp = (0.6 + 0.45 * strength) * (0.85 + 0.3 * rng());
  e.rise = 0.15 + rng() * 0.1; e.decay = (0.85 + rng() * 0.55) * P.mods.accentDecay;
  const pref = P.prefLimb;
  let kind = rng() < 0.5 ? (pref < 2 ? 0 : 2) : Math.floor(rng() * 5);
  // kinds: 0 arm thrust, 1 both arms pop overhead in fists, 2 low kick, 3 torso snap, 4 side leg flick
  if ((kind === 2 || kind === 4) && (P.stepping || P.st.feet[0].lift > 0.01 || P.st.feet[1].lift > 0.01)) kind = 0;
  e.kind = kind; e.side = pref < 2 ? (rng() < 0.7 ? pref : 1 - pref) : (rng() < 0.7 ? pref - 2 : 3 - pref);
  e.el = 70 + rng() * 100; e.az = -20 + rng() * 130; e.tw = (rng() * 2 - 1); e.dir = rng() < 0.5 ? -1 : 1;
}
Q.explosive = {
  kind: 'accent', attack: 0.4, release: 1.2, shapeGain: 0.25,
  shapes: { ready: 1.2, readyLow: 1.0, armsMid: 0.4 },
  armPrefs: { hang: 1.2, brushThigh: 0.6, curveLow: 0.5 },
  regions: { arms: 0.9, legs: 0.6, center: 0.6, spine: 0.5, hands: 0.5, head: 0.4 },
  tempo: () => 0.45,
  init(P) { P.q.explosive = { next: 1 + P.rng() * 2, ev: [{ on: false }, { on: false }, { on: false }] }; },
  mod(P, v) { P.mods.gesture *= 1 - 0.25 * v; P.mods.gestureHands *= 1 - 0.2 * v; },
  gen(P, v) {
    const st = P.q.explosive;
    st.next -= P.dt;
    if (st.next <= 0) { st.next = 1.2 + P.rng() * 1.8; fireExplosion(P, v); }
  },
  always(P) { // accents keep playing after release
    const st = P.q.explosive, Ac = P.ACC, X = P.X;
    for (const e of st.ev) {
      if (!e.on) continue;
      e.t += P.dt;
      if (e.t < 0) continue;
      if (e.t > e.rise + 0.08 + e.decay * 1.6) { e.on = false; continue; }
      // fast rise, a short hold at the peak (0.08 s), then a soft decay
      const tu = e.t > e.rise ? Math.max(e.rise, e.t - 0.08) : e.t;
      let k = burst(tu, e.rise, e.decay);
      if (e.t > e.rise && e.t < e.rise + 0.2) k *= 1 + 0.08 * Math.sin(Math.PI * (e.t - e.rise) / 0.2);
      k *= e.amp;
      const s = e.side;
      switch (e.kind) {
        case 0: { // arm thrust: snap toward a direction, elbow straight, fist
          Ac[ac(s, A.UEL)] += k * (e.el - X[ac(s, A.UEL)]); Ac[ac(s, A.UAZ)] += k * (e.az - X[ac(s, A.UAZ)]);
          Ac[ac(s, A.EF)] += k * (4 - X[ac(s, A.EF)]); Ac[ac(s, A.WF)] -= k * X[ac(s, A.WF)];
          for (let f = 0; f < 5; f++) Ac[ac(s, A.CURL + f)] += k * (0.95 - X[ac(s, A.CURL + f)]);
          for (let i = 2; i <= 6; i++) Ac[T3(i, 2)] += k * SG[s] * -2.5 * Math.sin(e.az * Math.PI / 180);
          Ac[T3(9, 2)] += k * SG[s] * 10; break;
        }
        case 1: // both arms pop overhead into fists
          for (let a = 0; a < 2; a++) {
            Ac[ac(a, A.UEL)] += k * (150 - X[ac(a, A.UEL)]); Ac[ac(a, A.UAZ)] += k * (10 - X[ac(a, A.UAZ)]); Ac[ac(a, A.EF)] += k * (75 - X[ac(a, A.EF)]); Ac[ac(a, A.UTW)] += k * (40 - X[ac(a, A.UTW)]);
            for (let f = 0; f < 5; f++) Ac[ac(a, A.CURL + f)] += k * (0.95 - X[ac(a, A.CURL + f)]);
          }
          for (let i = 3; i <= 6; i++) Ac[T3(i, 0)] -= k * 3; Ac[T3(9, 0)] -= k * 8; Ac[PY] += k * 0.01; break;
        case 2: // low kick: knee snaps up and forward
          Ac[lc(s, L.LIFT)] += k * 0.42; Ac[lc(s, L.LFWD)] += k * 0.3; Ac[lc(s, L.KNEE)] += k * 8;
          Ac[WS] += 0; Ac[PX] += k * SG[1 - s] * 0.04; Ac[PZ] -= k * 0.03;
          for (let i = 1; i <= 6; i++) Ac[T3(i, 0)] += k * 1.5;
          for (let a = 0; a < 2; a++) { Ac[ac(a, A.UEL)] += k * 25; Ac[ac(a, A.EF)] += k * 20; }
          break;
        case 3: // torso snap: quick extension and twist, head follows
          for (let i = 1; i <= 6; i++) { Ac[T3(i, 0)] -= k * 3.2; Ac[T3(i, 2)] += k * e.dir * 4.5; }
          Ac[T3(0, 2)] += k * e.dir * 10; Ac[T3(9, 0)] -= k * 10; Ac[T3(8, 2)] += k * e.dir * 10;
          for (let a = 0; a < 2; a++) { Ac[ac(a, A.UEL)] += k * 35; Ac[ac(a, A.UAZ)] -= k * 25; Ac[ac(a, A.EF)] -= k * 10; fingersAdd(Ac, a, -0.2 * k, 0.8 * k); }
          break;
        case 4: // side flick of the leg
          Ac[lc(s, L.LIFT)] += k * 0.12; Ac[lc(s, L.KNEE)] += k * 38; Ac[PX] += k * SG[1 - s] * 0.05; Ac[T3(0, 1)] -= SG[s] * k * 8;
          Ac[ac(s, A.UEL)] += k * 40; Ac[ac(1 - s, A.UEL)] += k * 20; break;
      }
    }
  },
  accent(P, strength) { fireExplosion(P, strength); },
  glow(P, v, push) {
    for (const e of P.q.explosive.ev) if (e.on && e.t > 0) {
      const k = burst(e.t, e.rise, e.decay);
      const b = e.kind === 2 || e.kind === 4 ? 'foot' + SFX[e.side] : e.kind === 3 ? 'spine04' : 'hand' + SFX[e.side];
      push(b, 0, 0, 0, 0.06 + 0.12 * k, Math.max(v, 0.6) * k);
    }
    const lm = LANDMARKS.lena; push(lm.bone, lm.offset[0], lm.offset[1], lm.offset[2], 0.06, v * 0.4);
  },
};

// ---------------------------------------------------------------- tier 2
Q.collapse = {
  attack: 1.4, release: 1.8, shapeGain: 0.45,
  shapes: { ready: 1, armsMid: 0.8, readyLow: 0.6, vUp: 0.3 },
  armPrefs: { hang: 1, floatLow: 0.6 },
  regions: { spine: 0.7, pelvis: 0.7, legs: 0.6, center: 0.5, arms: 0.3 },
  tempo: () => 0.4,
  init(P) { P.q.collapse = { next: 0.8 + P.rng() * 1.5, t: 9, kind: 0, drop: 0.3, hold: 0.15, rec: 1, amp: 0 }; },
  gen(P, v) {
    const st = P.q.collapse, Ac = P.ACC;
    st.next -= P.dt;
    if (st.next <= 0 && st.t > st.drop + st.rec) { st.next = 2 + P.rng() * 2.2; st.t = 0; st.kind = Math.floor(P.rng() * 3); st.drop = 0.2 + P.rng() * 0.2; st.hold = 0.1 + P.rng() * 0.15; st.rec = (0.9 + P.rng() * 0.4) * P.mods.accentDecay; st.amp = v * (0.7 + 0.4 * P.rng()); }
    st.t += P.dt;
    const t = st.t; let k;
    if (t < st.drop) { const x = t / st.drop; k = x * x; }            // gravity: accelerating fall
    else if (t < st.drop + st.hold) k = 1;
    else k = 1 - smoother((t - st.drop - st.hold) / st.rec);          // carried up again
    k = Math.max(0, k) * (st.amp || 0);
    if (!(k > 0)) return;
    if (st.kind === 0) { // chest
      for (let i = 4; i <= 6; i++) Ac[T3(i, 0)] += k * 9; Ac[T3(7, 0)] += k * 9; Ac[T3(9, 0)] += k * 6;
      for (let s = 0; s < 2; s++) { Ac[ac(s, A.CLF)] += k * 9; Ac[ac(s, A.CLA)] -= k * 5; Ac[ac(s, A.UEL)] -= k * 10; Ac[ac(s, A.EF)] += k * 10; }
      Ac[PY] -= k * 0.02;
    } else if (st.kind === 1) { // pelvis: drops and tucks, chest and arms stay buoyant (carried up)
      Ac[PY] -= k * 0.08; Ac[T3(0, 0)] -= k * 9; Ac[T3(1, 0)] += k * 5; Ac[T3(2, 0)] += k * 4;
      for (let s = 0; s < 2; s++) Ac[ac(s, A.UEL)] += k * 14; Ac[T3(7, 0)] -= k * 4;
    } else { // knees
      Ac[PY] -= k * 0.13; Ac[PZ] += k * 0.015; Ac[lc(0, L.KNEE)] += k * 6; Ac[lc(1, L.KNEE)] += k * 6;
      for (let s = 0; s < 2; s++) { Ac[ac(s, A.UEL)] += k * 18; Ac[ac(s, A.EF)] += k * 10; }
      Ac[T3(9, 0)] -= k * 5;
    }
  },
  glow(P, v, push) { const k = P.q.collapse.kind; push(k === 0 ? 'spine05' : k === 1 ? 'pelvis' : 'shin_L', 0, 0, 0.06, 0.1, v * 0.7); if (k === 2) push('shin_R', 0, 0, 0.06, 0.1, v * 0.7); },
};

Q.melt = {
  attack: 1.8, release: 2.4, shapeGain: 0.35,
  shapes: { ready: 1, armsMid: 0.8, armsOut: 0.6 },
  armPrefs: { hang: 1, floatLow: 0.5 },
  regions: { flesh: 0.9, legs: 0.6, spine: 0.6, arms: 0.5, center: 0.3 },
  tempo: () => 0.1,
  init(P) { P.q.melt = { t: P.rng() * 3, down: 8, up: 3, rest: 1.5, m: 0 }; },
  mod(P, v) { P.mods.fleshGain += 0.8 * v * (P.q.melt ? P.q.melt.m : 0); P.mods.loose += 0.3 * v; },
  gen(P, v) {
    const st = P.q.melt, T = P.T;
    st.t += P.dts;
    const cyc = st.down + st.up + st.rest;
    if (st.t > cyc) { st.t -= cyc; st.down = 6 + P.rng() * 6; st.up = 2.2 + P.rng() * 1.8; st.rest = 0.8 + P.rng() * 1.5; }
    const t = st.t;
    const m = t < st.down ? smoother(t / st.down) : t < st.down + st.up ? 1 - smoother((t - st.down) / st.up) : 0;
    const lead = t >= st.down && t < st.down + st.up ? smoother((t - st.down) / st.up * 1.6) : 0; // arms float up first
    st.m = m;
    const k = v * m;
    P.deep -= k * 0.2; T[PZ] -= k * 0.05;
    spreadSpine(T, 0, k * 30, 0, 0);
    T[T3(7, 0)] += k * 8; T[T3(8, 0)] += k * 8; T[T3(0, 0)] += k * 10;
    T[GW] -= k * 0.6;
    for (let s = 0; s < 2; s++) {
      T[ac(s, A.HANG)] += k * 0.7; armAdd(T, s, A.EF, k * 15); fingersAdd(T, s, k * 0.15, -k * 0.1);
      armAdd(T, s, A.UEL, v * lead * 20 * (1 - m));
      legAdd(T, s, L.KNEE, k * 6);
    }
  },
  glow(P, v, push) { const m = P.q.melt.m; push('spine04', 0, 0, 0.08, 0.15, v * (0.3 + 0.5 * m)); push('thigh_L', 0, -0.15, 0.04, 0.09, v * m * 0.6); push('thigh_R', 0, -0.15, 0.04, 0.09, v * m * 0.6); },
};

Q.tashi = {
  attack: 1.6, release: 2.0, shapeGain: 0.4,
  shapes: { readyLow: 1.2, plie: 0.6, ready: 0.8 },
  armPrefs: { hang: 1, curveLow: 0.6 },
  regions: { feet: 1, legs: 0.9, pelvis: 0.6, spine: 0.3, center: 0.3 },
  tempo: () => 0.35,
  mod(P, v) { P.mods.peelAllowed *= 1 - 0.95 * v; P.mods.liftAllowed *= 1 - v; P.mods.stepAllowed *= 1 - v; calmMods(P.mods, v, 0.8); },
  gen(P, v) {
    const T = P.T, ts = P.ts, s0 = P.ns + 11000;
    // the feet stay planted and the weight rolls through them: ankles rolling in and out, toes lifting, knees and pelvis answering
    for (let s = 0; s < 2; s++) { legAdd(T, s, L.INV, v * (5 + 8 * n2(ts * 0.9, s0 + 20 + s))); legAdd(T, s, L.TOE, v * 26 * n2(ts * 0.95, s0 + 22 + s)); }
    T[WS] += v * 0.7 * n2(ts * 0.5, s0 + 24);
    for (let s = 0; s < 2; s++) legAdd(T, s, L.KNEE, v * 26 * n2(ts * 0.8, s0 + s));
    T[PX] += v * 0.04 * n2((ts - 0.12) * 0.3, s0 + 5); T[PZ] += v * 0.035 * n2((ts - 0.12) * 0.3, s0 + 6);
    T[PY] -= v * (0.028 + 0.02 * (0.5 + 0.5 * n2((ts - 0.1) * 0.3, s0 + 7)));
    T[T3(0, 1)] += v * 7 * n2((ts - 0.25) * 0.3, s0 + 8); T[T3(0, 0)] += v * 6 * n2((ts - 0.25) * 0.3, s0 + 9); T[T3(0, 2)] += v * 8 * n2((ts - 0.25) * 0.3, s0 + 10);
    for (let i = 1; i <= 6; i++) { T[T3(i, 1)] -= v * 1.1 * n2((ts - 0.3 - i * 0.08) * 0.3, s0 + 8); T[T3(i, 0)] -= v * 0.8 * n2((ts - 0.3 - i * 0.08) * 0.3, s0 + 9); }
  },
  glow(P, v, push) { push('foot_L', 0, -0.06, 0.03, 0.08, v); push('foot_R', 0, -0.06, 0.03, 0.08, v); push('shin_L', 0, -0.3, 0, 0.05, v * 0.5); push('shin_R', 0, -0.3, 0, 0.05, v * 0.5); },
};

Q.ashi = {
  attack: 1.6, release: 2.0, shapeGain: 0.4,
  shapes: { readyLow: 1.2, plie: 0.6, ready: 0.6 },
  armPrefs: { hang: 1, curveLow: 0.6 },
  regions: { feet: 1, legs: 0.8, pelvis: 0.5, center: 0.3 },
  tempo: () => 0.4,
  mod(P, v) { P.mods.peelAllowed *= 1 - 0.7 * v; },
  gen(P, v) {
    const T = P.T, ts = P.ts, s0 = P.ns + 12000;
    for (let s = 0; s < 2; s++) {
      legAdd(T, s, L.INV, v * (9 + 7 * n2(ts * 0.3, s0 + s)));
      legAdd(T, s, L.KNEE, v * (10 + 14 * n2(ts * 0.35, s0 + 3 + s)));
    }
    T[PX] += v * 0.03 * n2(ts * 0.3 - 0.15, s0 + 6);
    T[T3(0, 2)] += v * 7 * n2(ts * 0.3 - 0.2, s0 + 7);
    T[T3(0, 1)] += v * 5 * n2(ts * 0.28 - 0.2, s0 + 8);
    T[PY] -= v * 0.02;
  },
  glow(P, v, push) { push('foot_L', 0.03, -0.06, 0.04, 0.07, v); push('foot_R', -0.03, -0.06, 0.04, 0.07, v); },
};

Q.grab = {
  attack: 1.2, release: 1.8, shapeGain: 0.5,
  shapes: { compact: 1.0, readyLow: 0.8, ready: 0.6, armsMid: 0.4 },
  armPrefs: { curveLow: 1, chestCurve: 0.6 },
  regions: { arms: 0.8, hands: 0.9, spine: 0.4, center: 0.3 },
  tempo: () => 0.5,
  init(P) { P.q.grab = { phase: 0, t: 0, dur: 1.5, side: 0, tension: 0 }; },
  mod(P, v) {
    const st = P.q.grab;
    if (!st) return;
    P.mods.stiff *= 1 + 0.6 * v * st.tension; P.mods.zetaAdd += 0.15 * v * st.tension;
    P.mods.loose += 0.5 * v * (1 - st.tension) * (st.phase === 1 ? 1 : 0);
  },
  gen(P, v) {
    const st = P.q.grab, T = P.T, rng = P.rng;
    st.t += P.dt;
    if (st.t > st.dur) {
      st.t = 0; st.phase = (st.phase + 1) % 2;
      st.dur = st.phase === 0 ? 1 + rng() * 1 : 1.2 + rng() * 1.2;
      if (st.phase === 1) { // release: send the energy out through one arm
        st.side = rng() < 0.5 ? 0 : 1;
        const s = st.side;
        P.V[ac(s, A.UEL)] += v * (300 + 250 * rng()); P.V[ac(s, A.UAZ)] += v * (rng() * 2 - 1) * 300; P.V[ac(s, A.EF)] -= v * 500;
        P.V[ac(1 - s, A.UEL)] += v * 120;
      }
    }
    const target = st.phase === 0 ? smoothstep(0, 0.35, st.t) : 1 - smoothstep(0, 0.25, st.t);
    st.tension += (target - st.tension) * Math.min(1, P.dt * 10);
    const k = v * st.tension;
    for (let s = 0; s < 2; s++) {
      T[ac(s, A.UEL)] += (25 - T[ac(s, A.UEL)]) * 0.6 * k; armAdd(T, s, A.EF, k * 45); armAdd(T, s, A.CLA, k * 9); armAdd(T, s, A.CLF, k * 7);
      for (let f = 0; f < 5; f++) { const o = ac(s, A.CURL + f); T[o] += (1 - T[o]) * k; T[ac(s, A.SPR + f)] *= 1 - k; }
      if (st.phase === 1 && s === st.side) fingersAdd(T, s, -0.3 * v * (1 - st.tension), 0.9 * v * (1 - st.tension));
    }
    spreadSpine(T, 0, k * 10, 0, 0); T[PY] -= k * 0.035;
  },
  glow(P, v, push) { const t = P.q.grab.tension; push('hand_L', 0.03, -0.05, 0, 0.06, v * (0.3 + 0.7 * t)); push('hand_R', -0.03, -0.05, 0, 0.06, v * (0.3 + 0.7 * t)); push('spine05', 0, 0, -0.08, 0.1, v * t * 0.7); },
};

// other forces: a far point is pulled along a slow path; the body trails
Q.forces = {
  attack: 1.6, release: 2.0, shapeGain: 0.5,
  shapes: { ready: 1, armsMid: 0.6, readyLow: 0.5 },
  armPrefs: { hang: 1, floatLow: 0.6 },
  regions: { hands: 0.7, arms: 0.7, head: 0.5, legs: 0.4, spine: 0.4 },
  tempo: () => 0.15,
  init(P) { P.q.forces = { which: 0, prev: 0, t: 0, dur: 6, blend: 1 }; },
  gen(P, v) {
    const st = P.q.forces, T = P.T, ts = P.ts, s0 = P.ns + 13000, rng = P.rng;
    st.t += P.dts; st.blend = Math.min(1, st.blend + P.dts / 1.5);
    if (st.t > st.dur) { st.t = 0; st.prev = st.which; st.which = Math.floor(rng() * 5); st.dur = st.which === 2 || st.which === 3 ? 2.5 + rng() * 1.5 : 4 + rng() * 4; st.blend = 0; }
    const apply = (which, w) => {
      if (w < 0.001) return;
      const k = v * w;
      if (which < 2) { // wrist on a thread: the arm follows the point, the hand dangles from the wrist
        const s = which, x = n2(ts * 0.07, s0 + s), y = n2(ts * 0.06, s0 + 3 + s), z = n2(ts * 0.065, s0 + 6 + s);
        P.thr[s].w = Math.max(P.thr[s].w, k);
        P.thr[s].x = SG[s] * (0.45 + 0.25 * x); P.thr[s].y = 1.45 + 0.35 * y; P.thr[s].z = 0.35 + 0.2 * z;
        armAdd(T, s, A.WF, k * 30); fingersAdd(T, s, k * 0.1, k * 0.2);
      } else if (which < 4) { // a balloon lifts a knee
        const s = which - 2, h = Math.max(0, n2(ts * 0.3, s0 + 10 + s) + 0.25);
        legAdd(T, s, L.LIFT, k * (0.08 + 0.12 * h) * P.mods.liftAllowed); legAdd(T, s, L.LFWD, k * 0.1 * h); legAdd(T, s, L.KNEE, k * 10);
        T[WS] += SG[1 - s] * k * 0.9;
        armAdd(T, s, A.UEL, k * 15);
      } else { // crown pulled up and drifting
        const x = n2(ts * 0.08, s0 + 20), z = n2(ts * 0.07, s0 + 21);
        spreadSpine(T, 0, -k * 6 + k * 10 * z, k * 14 * x, 0);
        T[T3(7, 0)] -= k * 6; T[T3(8, 1)] += k * 6 * x; T[PY] += k * 0.008; T[REL] += k * 0.35 * P.mods.peelAllowed; T[PX] -= k * 0.03 * x;
        for (let s = 0; s < 2; s++) armAdd(T, s, A.UEL, k * 10);
      }
    };
    apply(st.which, smoother(st.blend)); apply(st.prev, 1 - smoother(st.blend));
  },
  glow(P, v, push) { const w = P.q.forces.which; const n = ['hand_L', 'hand_R', 'shin_L', 'shin_R', 'head'][w]; push(n, 0, w === 4 ? 0.13 : 0, 0, 0.07, v); },
};

const DOLFI_CH = [ac(0, A.UEL), ac(1, A.UEL), ac(0, A.UAZ), ac(1, A.UAZ), T3(9, 2), T3(0, 2), PX, lc(0, L.KNEE), lc(1, L.KNEE), ac(0, A.WF), ac(1, A.WF)];
Q.dolfi = {
  attack: 1.6, release: 2.0, shapeGain: 0.3,
  shapes: { readyLow: 1.6, ready: 0.8, plie: 0.4 },
  armPrefs: { hang: 1, curveLow: 0.6 },
  regions: { legs: 0.5, feet: 0.5, center: 0.4, arms: 0.2, hands: 0.2 },
  tempo: () => 0.3,
  init(P) { P.q.dolfi = { next: 1 + P.rng(), tw: [{ on: false }, { on: false }] }; },
  mod(P, v) { calmMods(P.mods, v, 0.8); P.mods.genGain *= 1 - 0.35 * v; },
  gen(P, v) {
    const st = P.q.dolfi, T = P.T, Ac = P.ACC, rng = P.rng;
    // a slow undulation that starts in the pelvis and rolls up through the spine
    st.ph = (st.ph || P.rng() * TAU) + TAU * (0.38 + 0.07 * n2(P.ts * 0.05, P.ns + 16000)) * P.dts;
    T[T3(0, 0)] += v * 18 * Math.sin(st.ph); T[T3(0, 1)] += v * 10 * Math.sin(st.ph * 0.5 + 1); spreadSpine(T, 0, v * 9 * Math.sin(st.ph - 0.5), v * -8 * Math.sin(st.ph * 0.5 + 1), 0);
    T[PY] += v * 0.02 * Math.sin(st.ph * 2 + 0.6); T[PZ] += v * 0.03 * Math.sin(st.ph + 0.3);
    for (let s = 0; s < 2; s++) { armAdd(T, s, A.UEL, v * 26 * Math.sin(st.ph - 0.9 + s * 0.8)); armAdd(T, s, A.UAZ, v * 26 * Math.sin(st.ph * 0.5 + s * 2)); armAdd(T, s, A.EF, v * 14 * Math.sin(st.ph + s)); legAdd(T, s, L.KNEE, v * 10 * Math.sin(st.ph + s * Math.PI)); }
    T[PY] -= 0.035 * v; legAdd(T, 0, L.KNEE, 4 * v); legAdd(T, 1, L.KNEE, 4 * v);
    st.next -= P.dt;
    if (st.next <= 0) {
      st.next = 0.8 + rng() * 1.7;
      const e = firstFree(st.tw);
      if (e) { e.on = true; e.t = 0; e.ch = DOLFI_CH[Math.floor(rng() * DOLFI_CH.length)]; e.amp = (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.5); }
    }
    for (const e of st.tw) {
      if (!e.on) continue;
      e.t += P.dt;
      if (e.t > 0.9) { e.on = false; continue; }
      const k = burst(e.t, 0.16, 0.42) * e.amp * v; // soft twitches: they rise over 0.16 s
      Ac[e.ch] += k * (e.ch === PX ? 0.02 : e.ch === T3(0, 2) ? 5 : 12);
    }
  },
  glow(P, v, push) { push('shin_L', 0, -0.05, 0.04, 0.06, v * 0.5); push('shin_R', 0, -0.05, 0.04, 0.06, v * 0.5); const lm = LANDMARKS.lena; push(lm.bone, lm.offset[0], lm.offset[1], lm.offset[2], 0.06, v * 0.5); },
};

Q.hotfloor = {
  attack: 1.0, release: 1.4, shapeGain: 0.35,
  shapes: { ready: 1, armsMid: 0.6, readyLow: 0.6 },
  armPrefs: { hang: 0.8, floatLow: 0.6, curveLow: 0.6 },
  regions: { feet: 1, legs: 0.8, pelvis: 0.3, arms: 0.2 },
  tempo: () => 4,
  init(P) { P.q.hotfloor = { t: 0, dur: 0.22, gap: 0.1, side: 0, on: false, wait: 0.2 }; },
  gen(P, v) {
    const st = P.q.hotfloor, Ac = P.ACC, T = P.T, rng = P.rng;
    T[REL] += 0.25 * v; T[PY] -= 0.01 * v;
    if (!st.on) {
      st.wait -= P.dt;
      if (st.wait <= 0 && !P.stepping) { st.on = true; st.t = 0; st.dur = 0.15 + rng() * 0.15; st.side = rng() < 0.82 ? 1 - st.side : st.side; st.h = (0.04 + rng() * 0.05) * v; }
    } else {
      st.t += P.dt;
      const u = st.t / st.dur;
      if (u >= 1) { st.on = false; st.wait = (0.05 + rng() * 0.2) / Math.max(0.3, v); }
      else {
        const e = Math.sin(Math.PI * u);
        Ac[lc(st.side, L.LIFT)] += st.h * e; Ac[lc(st.side, L.LFWD)] += st.h * 0.25 * e;
        Ac[PX] += SG[1 - st.side] * 0.012 * e * v; Ac[PY] += 0.006 * e * v;
        Ac[ac(st.side, A.UEL)] += 8 * e * v; Ac[ac(1 - st.side, A.UEL)] += 4 * e * v;
      }
    }
  },
  glow(P, v, push) { push('foot_L', 0, -0.06, 0.04, 0.07, v); push('foot_R', 0, -0.06, 0.04, 0.07, v); },
};

// countdown (accent): about 11 s of escalating vigorous motion, slaps on the body, then an abrupt drop into float
const CD_LEN = 11;
Q.countdown = {
  kind: 'accent', attack: 0.3, release: 0.6, shapeGain: 0.3,
  shapes: { ready: 1, readyLow: 0.8 },
  armPrefs: { hang: 1 },
  regions: { center: 1, pelvis: 1, spine: 1, arms: 1, hands: 1, legs: 1, feet: 1, head: 1, flesh: 1 },
  tempo: () => 2.2,
  init(P) { P.q.countdown = { t: 99, ph: 0, slapT: 0, slap: { on: false, t: 0, side: 0, chest: false } }; },
  start(P) { const st = P.q.countdown; st.t = -P.rng() * 0.2; st.ph = 0; },
  onSet(P) { this.start(P); },
  accent(P) { this.start(P); },
  always(P) {
    const st = P.q.countdown;
    if (st.t > CD_LEN + 0.6) return;
    st.t += P.dt;
    if (st.t < 0) return;
    const T = P.T, Ac = P.ACC, rng = P.rng;
    let I;
    if (st.t < CD_LEN) I = 0.45 + 0.55 * (st.t / CD_LEN);
    else { I = 1 - smoothstep(CD_LEN, CD_LEN + 0.35, st.t); if (st.t - P.dt < CD_LEN) { P.floatBoost = 0.9; P.shape.pendingIn = 0.05; } }
    if (I <= 0) return;
    st.ph += TAU * (1.9 + 0.5 * (st.t / CD_LEN)) * P.dt;
    const ph = st.ph;
    // big arm swings, alternating, growing
    for (let s = 0; s < 2; s++) {
      const p = ph + s * Math.PI;
      Ac[ac(s, A.UEL)] += I * (55 + 55 * Math.sin(p)); Ac[ac(s, A.UAZ)] += I * 45 * Math.cos(p);
      Ac[ac(s, A.EF)] += I * 25 * (0.5 + 0.5 * Math.sin(p + 1)); P.V[ac(s, A.WF)] += I * 60 * Math.cos(p * 2);
    }
    // bounces and shaking
    Ac[PY] -= I * (0.03 * Math.pow(0.5 + 0.5 * Math.cos(ph * 2), 1.5) + 0.02);
    T[REL] += I * 0.3;
    for (let i = 1; i <= 9; i++) Ac[T3(i, 1)] += I * 2.2 * n2(P.tf * 5 - i * 0.03, P.ns + 14000 + i);
    Ac[T3(9, 0)] += I * 6 * Math.sin(ph * 2 + 0.5);
    // slaps: a hand hits a thigh or the chest every 0.5..0.8 s
    st.slapT -= P.dt;
    if (st.slapT <= 0 && st.t < CD_LEN) { st.slapT = 0.5 + rng() * 0.3; const sl0 = st.slap; sl0.on = true; sl0.t = 0; sl0.side = rng() < 0.5 ? 0 : 1; sl0.chest = rng() < 0.45; }
    const sl = st.slap;
    if (sl.on) {
      sl.t += P.dt;
      if (sl.t > 0.45) sl.on = false;
      else {
        const k = burst(sl.t, 0.09, 0.25) * I, s = sl.side, X = P.X;
        const tEl = sl.chest ? 45 : 12, tAz = sl.chest ? 110 : 25, tEf = sl.chest ? 115 : 8;
        Ac[ac(s, A.UEL)] += k * (tEl - X[ac(s, A.UEL)] - Ac[ac(s, A.UEL)]); Ac[ac(s, A.UAZ)] += k * (tAz - X[ac(s, A.UAZ)] - Ac[ac(s, A.UAZ)]);
        Ac[ac(s, A.EF)] += k * (tEf - X[ac(s, A.EF)] - Ac[ac(s, A.EF)]);
        for (let f = 0; f < 5; f++) Ac[ac(s, A.CURL + f)] += k * (0.05 - X[ac(s, A.CURL + f)]);
      }
    }
  },
  glow(P, v, push) { const st = P.q.countdown; if (st.t < CD_LEN && st.t > 0) { const I = st.t / CD_LEN; push('spine03', 0, 0, 0.06, 0.15 + 0.25 * I, 0.5 + 0.5 * I); push('hand_L', 0, 0, 0, 0.06, I); push('hand_R', 0, 0, 0, 0.06, I); } },
};

export const QUALITY_ORDER = ['float', 'lunas', 'lena', 'snake', 'balls', 'curves', 'shake', 'quake', 'boil', 'groove', 'silly', 'explosive',
  'collapse', 'melt', 'tashi', 'ashi', 'grab', 'forces', 'dolfi', 'hotfloor', 'countdown', 'thick', 'time', 'biba', 'flesh'];
export const BONE_EXISTS = (n) => !!BONE_BY_NAME[n];
