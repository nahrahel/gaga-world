// engine.js: Gaga motion engine. OWNER: builder C. API in CONTRACT.md (Motion engine section).
// Pipeline per performer per frame: layer envelopes (with a personal onset delay) -> modifiers and clocks ->
// base stance + slow carrier shape -> breath, drift, weight shifts, small gestures -> quality generators ->
// threads -> posture modifiers -> stance and balance -> gaze -> follow-through -> joint springs -> accents ->
// rig (soft joint limits, arm aim, collisions, leg IK onto planted feet).
// Deterministic for a given seed and dt sequence; no allocations in the per-frame path.
import { makeRng, n1, n2, n3, clamp, smoothstep, smoother } from './noise.js';
import { createRig, BASE, NCH, TR, PX, PY, PZ, A, L, ac, lc, STW, FYAW, REL, WS, GW, SG, GROUPS, CH_GROUP, NTR, ARM0, ARMN, LEG0, LEGN } from './rig.js';
import { createShapeState, updateShapes, spreadSpine, createArmState, updateArms } from './shapes.js';
import { Q, QUALITY_ORDER, baseLayer } from './qualities.js';
import { BONE_INDEX, BONE_BY_NAME } from '../skeleton.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, R2D = 180 / Math.PI;
const T3 = (i, k) => TR + 3 * i + k;
const REGIONS = ['center', 'pelvis', 'spine', 'arms', 'hands', 'legs', 'feet', 'head', 'flesh'];
const IDLE_REG = { center: 0.06, pelvis: 0.06, spine: 0.1, arms: 0.1, hands: 0.15, legs: 0.05, feet: 0.05, head: 0.12, flesh: 0.1 };

// channel -> region for measured activity, with a speed normalizer (deg/s or m/s that reads as "full")
const CH_REGION = new Array(NCH).fill(null), CH_NORM = new Float32Array(NCH).fill(1);
for (let i = 0; i < NTR; i++) for (let k = 0; k < 3; k++) { const c = T3(i, k); CH_REGION[c] = i === 0 ? 'pelvis' : i < 7 ? 'spine' : 'head'; CH_NORM[c] = i === 0 ? 60 : i < 7 ? 25 : 90; }
CH_REGION[PX] = CH_REGION[PZ] = 'center'; CH_NORM[PX] = CH_NORM[PZ] = 0.25; CH_REGION[PY] = 'legs'; CH_NORM[PY] = 0.25;
for (let s = 0; s < 2; s++) {
  for (const k of [A.CLF, A.CLA]) { CH_REGION[ac(s, k)] = 'arms'; CH_NORM[ac(s, k)] = 60; }
  for (const k of [A.UEL, A.UAZ, A.UTW, A.EF]) { CH_REGION[ac(s, k)] = 'arms'; CH_NORM[ac(s, k)] = 200; }
  for (const k of [A.FTW, A.WF, A.WA]) { CH_REGION[ac(s, k)] = 'hands'; CH_NORM[ac(s, k)] = 300; }
  for (let f = 0; f < 10; f++) { CH_REGION[ac(s, A.CURL + f)] = 'hands'; CH_NORM[ac(s, A.CURL + f)] = 3; }
  CH_REGION[lc(s, L.PEEL)] = 'feet'; CH_NORM[lc(s, L.PEEL)] = 3; CH_REGION[lc(s, L.LIFT)] = 'feet'; CH_NORM[lc(s, L.LIFT)] = 0.6;
  CH_REGION[lc(s, L.KNEE)] = 'legs'; CH_NORM[lc(s, L.KNEE)] = 80; CH_REGION[lc(s, L.INV)] = 'feet'; CH_NORM[lc(s, L.INV)] = 60; CH_REGION[lc(s, L.TOE)] = 'feet'; CH_NORM[lc(s, L.TOE)] = 150;
}

const GROUP_LIST = Object.keys(GROUPS);
const CH_G = Int8Array.from(CH_GROUP.map(g => GROUP_LIST.indexOf(g)));
const G_OM = Float32Array.from(GROUP_LIST.map(g => GROUPS[g][0]));
const G_ZE = Float32Array.from(GROUP_LIST.map(g => GROUPS[g][1]));
// how much looseness (boil, shake, flesh...) lowers damping per group
const G_LOOSE = Float32Array.from(GROUP_LIST.map(g => ({ pel: 0.3, ppos: 0.2, spine: 0.55, neck: 0.7, head: 0.8, clav: 0.7, uarm: 0.9, elbow: 1, ftw: 1, wrist: 1, fing: 1, leg: 0.2, stance: 0, ws: 0, gaze: 0 }[g])));
// how much stiffness modifiers (thick, grab) apply per group
const G_STIFF = Float32Array.from(GROUP_LIST.map(g => ({ stance: 0, ws: 0.5, gaze: 0 }[g] ?? 1)));

export function createEngine(THREE, { vocab } = {}) {
  const rig = createRig(THREE);
  const VOC = new Map((vocab || []).map(v => [v.id, v]));
  const layers = new Map(); // id -> { id, target, value, from, t, dur, addedAt }
  const performers = new Map();
  const listeners = { layers: [] };
  let nextId = 1, clock = 0;
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
  const prefs = {}, armPrefs = {};
  for (const id of QUALITY_ORDER) { prefs[id] = Q[id].shapes || {}; armPrefs[id] = Q[id].armPrefs || {}; }

  function attackOf(id) { const a = Q[id] && Q[id].attack; return typeof a === 'number' ? a : 1.8; }
  function releaseOf(id) { const r = Q[id] && Q[id].release; return typeof r === 'number' ? r : 2.2; }

  // ------------------------------------------------------------------ performers
  function addPerformer(figure, { seed = 1, role = 'soloist', variation = 0.5 } = {}) {
    const rng = makeRng(seed * 7919 + 13);
    const P = {
      id: nextId++, figure, seed, role, variation: clamp(variation, 0, 1), rng, ns: (seed * 7919) % 100000,
      T: new Float32Array(NCH), X: Float32Array.from(BASE), V: new Float32Array(NCH), ACC: new Float32Array(NCH),
      C: Float32Array.from(BASE), Cprev: Float32Array.from(BASE), omega: new Float32Array(NCH), zeta: new Float32Array(NCH),
      ts: rng() * 100, tf: rng() * 100, dt: 0, dts: 0, dtf: 0, breathPh: rng() * TAU, breath: 0,
      lay: new Map(), lv: {},
      q: {}, mods: {}, floatBoost: 0,
      wsh: { timer: rng() * 1.5, target: rng() < 0.5 ? 0.4 : -0.4 },
      footEv: { t: -1, wait: 1.5 + rng() * 3, side: 0, dur: 0.6, h: 0.04 },
      feet: [0, 1].map(s => ({ bx: SG[s] * BASE[STW], bz: rig.S[s].ballRest.z, yaw: SG[s] * BASE[FYAW], step: { on: false, t: 0, dur: 0.5, x0: 0, z0: 0, y0: 0, x1: 0, z1: 0, y1: 0, h: 0.06 } })),
      st: { feet: [0, 1].map(() => ({ bx: 0, bz: 0, yaw: 0, peel: 0, inv: 0, lift: 0, liftFwd: 0, point: 0, knee: 0, toe: 0 })) },
      stepping: false, stepCool: 0, lean: [0, 0], travel: { x: 0, z: 0, f: 0, tx: 0, tz: 0, tf: 0, timer: 4 + rng() * 6 },
      gaze: { mode: 0, timer: 0.5, x: 0, y: 1.6, z: 4, hand: 0 },
      shapeAmt: 0.3, shapeBoost: { patFront: 0, halfFold: 0, toesArmUp: 0, armsOut: 0, vUp: 0 },
      userThr: [{ on: false, w: 0, str: 0, x: 0, y: 1.4, z: 0.5, tx: 0, ty: 1.4, tz: 0.5, init: false }, { on: false, w: 0, str: 0, x: 0, y: 1.4, z: 0.5, tx: 0, ty: 1.4, tz: 0.5, init: false }],
      act: { regions: {}, energy: 0, tempo: 0.25, dominant: null }, regionSpeed: {},
      glow: Array.from({ length: 8 }, () => ({ bone: 'pelvis', offset: [0, 0, 0], radius: 0.05, intensity: 0 })), glowOut: [],
      flesh: { gain: 0.12, stiffness: 140, damping: 9 },
    };
    // individuality
    const vr = 0.4 + P.variation;
    P.tempo = 1 + (rng() * 2 - 1) * 0.2 * Math.min(1, vr);
    P.grooveHz = 1.6 + rng() * 0.5;
    P.shakeHz = 0.85 + rng() * 0.3;
    const r = rng(); P.prefLimb = r < 0.38 ? 0 : r < 0.76 ? 1 : r < 0.88 ? 2 : 3;
    P.bias = ['upright', 'low', 'high', 'open'][Math.floor(rng() * 4)];
    P.shakeVariant = ['patFront', 'halfFold', 'toesArmUp', 'armsOut'][Math.floor(rng() * 4)];
    P.onset = role === 'soloist' ? [0.15, 0.9] : [0.5 * vr, 2.4 * vr];
    P.asym = rng() * 2 - 1;
    P.shape = createShapeState(rng);
    P.arms = [createArmState(rng, 0), createArmState(rng, 1)]; P.deep = 0; P.zombieT = 0;
    for (const id of QUALITY_ORDER) if (Q[id].init) Q[id].init(P);
    rig.setupPerformer(P, figure);
    P.glowPush = makeGlowPush(P);
    for (const l of layers.values()) P.lay.set(l.id, { id: l.id, tgt: l.target, val: l.value, from: l.value, t: 0, dur: 1 });
    performers.set(P.id, P);
    // settle into the stance immediately (so the first frame is already a living body)
    poseOne(P, 1 / 60);
    return P.id;
  }
  function removePerformer(id) { performers.delete(id); }

  // ------------------------------------------------------------------ layers
  function emit(ev) { const arr = listeners[ev]; if (!arr) return; const data = getLayers(); for (const cb of arr) { try { cb(data); } catch (e) { console.error(e); } } }
  function setLayer(id, target) {
    if (!VOC.has(id)) return;
    target = clamp(+target || 0, 0, 1);
    let l = layers.get(id);
    if (!l) {
      if (target <= 0) return;
      l = { id, target: 0, value: 0, from: 0, t: 0, dur: 1, addedAt: clock };
      layers.set(id, l);
    } else if (l.target <= 0 && target > 0) l.addedAt = clock;
    const rising = target > l.target;
    const wasOff = l.target <= 0;
    l.from = l.value; l.t = 0; l.dur = target > l.value ? attackOf(id) : releaseOf(id); l.target = target;
    for (const P of performers.values()) {
      let pl = P.lay.get(id);
      if (!pl) { pl = { id, tgt: 0, val: 0, from: 0, t: 0, dur: 1 }; P.lay.set(id, pl); }
      const delay = rising ? P.onset[0] + P.rng() * (P.onset[1] - P.onset[0]) : P.rng() * 0.4;
      pl.from = pl.val; pl.t = -delay; pl.dur = l.dur * (0.85 + 0.3 * P.rng()); pl.tgt = target;
      if (rising && wasOff) {
        if (Q[id] && Q[id].onSet) Q[id].onSet(P);
        if (id === 'countdown' && P.q.countdown) P.q.countdown.t = -delay * 0.3;
        // a newly added cue is absorbed: re-pick the carrier shape shortly after it lands
        if (Q[id] && (Q[id].shapeGain || 0) >= 0.3) P.shape.pendingIn = delay + 0.4 + P.rng() * 0.8;
      }
      if (!rising && target <= 0 && Q[id] && Q[id].onRelease) Q[id].onRelease(P);
    }
    emit('layers');
  }
  function toggleLayer(id, defaultIntensity = 0.7) {
    if (!VOC.has(id)) return;
    const l = layers.get(id);
    setLayer(id, l && l.target > 0 ? 0 : defaultIntensity);
  }
  function releaseAll() { for (const id of [...layers.keys()]) if (layers.get(id).target > 0) setLayer(id, 0); }
  function getLayers() {
    const out = [];
    for (const l of layers.values()) out.push({ id: l.id, target: l.target, value: l.value, addedAt: l.addedAt });
    out.sort((a, b) => a.addedAt - b.addedAt);
    return out;
  }
  function accent(id) {
    if (!VOC.has(id) || !Q[id] || !Q[id].accent) return;
    for (const P of performers.values()) Q[id].accent(P, 0.85);
  }
  function setThread(performerId, { target = null, hand = 'R', strength = 0.7 } = {}) {
    const P = performers.get(performerId); if (!P) return;
    const sides = hand === 'both' ? [0, 1] : hand === 'L' ? [0] : [1];
    for (let s = 0; s < 2; s++) {
      const U = P.userThr[s];
      const on = !!target && sides.includes(s);
      if (on) {
        P.figure.object3d && P.figure.object3d.updateWorldMatrix && P.figure.object3d.updateWorldMatrix(true, false);
        _v.copy(target); if (P.figure.object3d) P.figure.object3d.worldToLocal(_v);
        U.tx = _v.x; U.ty = _v.y; U.tz = _v.z;
        if (!U.on && U.w < 0.02) { // start the smoothed point at the hand so the pull begins where the hand is
          const h = P.wp[BONE_INDEX['hand' + (s ? '_R' : '_L')]]; U.x = h.x; U.y = h.y; U.z = h.z;
        }
        U.on = true; U.str = clamp(strength, 0, 1);
      } else U.on = false;
    }
  }

  // ------------------------------------------------------------------ per-frame helpers
  function updateEnvelope(l, dt) {
    l.t += dt;
    if (l.t < 0) return;
    const p = Math.min(1, l.t / Math.max(0.05, l.dur));
    l.value = l.from + (l.target - l.from) * smoother(p);
  }

  function computeMods(P) {
    const M = P.mods;
    M.gesture = 0.36; M.gestureHands = 0.42; M.gestureFeet = 0.3; M.drift = 0.55; M.trail = 0.35; M.weightShift = 1;
    M.peelAllowed = 1; M.liftAllowed = 1; M.stepAllowed = 1; M.gazeHands = 0; M.gazeAway = 0; M.loose = 0;
    M.fleshGain = 0.3; M.fleshStiff = 1; M.fleshDamp = 1; M.zetaAdd = 0; M.stiff = 1; M.slowScale = 1; M.fastScale = 1;
    M.accentDecay = 1; M.holdMul = 1; M.genGain = 1; M.travel = 0.15; M.holdDrift = 1;
    for (const id of QUALITY_ORDER) {
      const q = Q[id]; if (!q.mod) continue;
      let v = P.lv[id] || 0;
      if (id === 'float') v = Math.max(v, 0.15 + P.floatBoost);
      if (v > 0.001) q.mod(P, v);
    }
    M.loose = clamp(M.loose, 0, 1);
    M.fleshGain = clamp(M.fleshGain, 0, 2);
  }

  function threads(P) {
    // user threads (smoothed, soft lag) merged with the forces quality
    for (let s = 0; s < 2; s++) {
      const U = P.userThr[s];
      const target = U.on ? U.str : 0;
      const rate = U.on ? 2.2 : 1.6;
      U.w += (target - U.w) * Math.min(1, P.dt * rate * (U.on ? 1 : 1.4));
      if (!U.on && U.w < 0.002) U.w = 0;
      const k = Math.min(1, P.dt * 5);
      U.x += (U.tx - U.x) * k; U.y += (U.ty - U.y) * k; U.z += (U.tz - U.z) * k;
      const th = P.thr[s];
      if (U.w > th.w) { th.w = U.w; th.x = U.x; th.y = U.y; th.z = U.z; }
    }
    // pre-spring: aim the arm channels at the point, set the elbow from distance, lean the body a little
    const T = P.T;
    for (let s = 0; s < 2; s++) {
      const th = P.thr[s]; if (th.w <= 0.001) continue;
      const C = rig.S[s];
      const sh = P.wp[C.up], clq = P.wq[C.clav];
      _v.set(th.x - sh.x, th.y - sh.y, th.z - sh.z);
      // reach limit: keep the point inside the arm's reach
      const reach = C.upLen + C.foreLen + C.handLen * 0.5;
      let dist = _v.length();
      const over = Math.max(0, dist - reach * 0.92);
      const dl = _v2.copy(_v).normalize().applyQuaternion(_q.copy(clq).invert());
      const elev = Math.acos(clamp(-dl.y, -1, 1)) * R2D;
      let az = Math.atan2(dl.z, SG[s] * dl.x) * R2D;
      if (az < -75) az = az < -130 ? 150 : -75;
      const w = th.w;
      const se = Math.min(1, Math.sin(elev * D2R) * 2);
      T[ac(s, A.UEL)] += (elev - T[ac(s, A.UEL)]) * w;
      T[ac(s, A.UAZ)] += (az - T[ac(s, A.UAZ)]) * w * se;
      const L1 = C.upLen, L2 = C.foreLen + C.handLen * 0.5, D = clamp(dist, 0.2, L1 + L2 - 0.01);
      const ef = 180 - Math.acos(clamp((L1 * L1 + L2 * L2 - D * D) / (2 * L1 * L2), -1, 1)) * R2D;
      T[ac(s, A.EF)] += (Math.max(8, ef) - T[ac(s, A.EF)]) * w;
      T[ac(s, A.HANG)] *= 1 - w;
      // the body follows a little, more when the point is beyond reach
      const lean = w * (0.25 + clamp(over / 0.3, 0, 1));
      const lx = _v.x / (dist || 1), ly = _v.y / (dist || 1), lz = _v.z / (dist || 1);
      for (let i = 1; i <= 6; i++) { T[T3(i, 1)] += lean * 3.5 * lx * (1 - Math.abs(ly) * 0.3); T[T3(i, 0)] += lean * 3 * lz - lean * 1.5 * Math.max(0, ly); T[T3(i, 2)] += lean * 2.5 * lz * SG[s] * 0; }
      T[T3(0, 2)] += lean * 6 * lz * -SG[s] * 0.5;
      T[PX] += lean * 0.03 * lx; T[PZ] += lean * 0.03 * lz;
      T[ac(s, A.CLA)] += lean * 8 * Math.max(0, ly); T[ac(s, A.CLF)] += lean * 8 * Math.max(0, lz);
    }
  }

  // whole-body coordination: contrapposto from the weight side, the trunk answering the arms
  function coordinate(P) {
    const T = P.T;
    const ws = clamp(T[WS], -1, 1);
    T[T3(0, 1)] -= ws * 5.5;          // the free hip drops
    T[T3(0, 2)] += ws * 4;            // and swings a little forward
    spreadSpine(T, 0, 0, ws * 8.5, -ws * 2.5);
    T[T3(8, 1)] -= ws * 2.5; T[T3(9, 1)] -= ws * 1.5;
    const eL = T[ac(0, A.UEL)], eR = T[ac(1, A.UEL)];
    const fL = Math.sin(clamp(T[ac(0, A.UAZ)], -90, 180) * D2R) * Math.sin(Math.min(eL, 90) * D2R);
    const fR = Math.sin(clamp(T[ac(1, A.UAZ)], -90, 180) * D2R) * Math.sin(Math.min(eR, 90) * D2R);
    const over = Math.max(0, eL - 60) + Math.max(0, eR - 60);
    spreadSpine(T, 0, -0.025 * over + 3 * Math.max(0, fL + fR - 0.8), clamp(-0.06 * (eL - eR), -8, 8), -16 * (fL - fR));
    T[T3(0, 2)] -= 5 * (fL - fR);
    // knees: soft by default (5..15 deg); incidental drops from stacked words saturate near 30 deg.
    // Deliberate depth (plie, crouch, fold shapes, melt) passes through.
    const shapeDrop = Math.min(0, P.shape.cur[PY] * P.shapeAmt);
    const extra = T[PY] - BASE[PY] - shapeDrop;
    if (extra < 0) T[PY] = BASE[PY] + shapeDrop - 0.024 * Math.tanh(-extra / 0.024);
    T[PY] += P.deep;
    // the ribcage answers arm motion as it happens (sway, twist and side bend with the arms); shoulders lead lifts
    const V = P.V;
    const dvE = clamp(V[ac(0, A.UEL)] - V[ac(1, A.UEL)], -160, 160), dvA = clamp(V[ac(0, A.UAZ)] - V[ac(1, A.UAZ)], -160, 160);
    const vSum = clamp(V[ac(0, A.UEL)] + V[ac(1, A.UEL)], -200, 200);
    for (let i = 3; i <= 6; i++) { T[T3(i, 1)] -= clamp(0.028 * dvE, -4, 4); T[T3(i, 2)] -= clamp(0.03 * dvA, -4, 4); T[T3(i, 0)] -= clamp(0.012 * vSum, -2.5, 2.5); }
    T[T3(8, 1)] += clamp(0.03 * dvE, -5, 5); T[T3(9, 2)] += clamp(0.025 * dvA, -6, 6); // the head answers, a beat later (softer neck springs)
    for (let s = 0; s < 2; s++) T[ac(s, A.CLA)] += clamp(0.04 * V[ac(s, A.UEL)], -4, 9);
    // never two parallel arms held forward (the mannequin "zombie" look): separate their heights
    {
      const aL = T[ac(0, A.UAZ)], aR = T[ac(1, A.UAZ)];
      const d = clamp(1 - Math.abs(eL - eR) / 35, 0, 1) * clamp(1 - Math.abs(aL - aR) / 45, 0, 1)
        * clamp((Math.min(aL, aR) - 25) / 25, 0, 1) * clamp((Math.min(eL, eR) - 40) / 20, 0, 1) * clamp((125 - Math.max(eL, eR)) / 20, 0, 1);
      if (d > 0) { const lo = P.asym > 0 ? 1 : 0; T[ac(lo, A.UEL)] -= 38 * d; T[ac(lo, A.EF)] += 15 * d; T[ac(1 - lo, A.UEL)] += 12 * d; T[ac(lo, A.UAZ)] -= 15 * d; }
    }
    // hanging arms with bent elbows: forearms come forward, never folded into the hip
    for (let s = 0; s < 2; s++) {
      const e = T[ac(s, A.UEL)]; if (e >= 45) continue;
      const k = 1 - Math.max(0, e) / 45;
      if (T[ac(s, A.UTW)] < -8) T[ac(s, A.UTW)] = -8 + (T[ac(s, A.UTW)] + 8) * (1 - k);
      T[ac(s, A.UAZ)] += k * Math.max(0, T[ac(s, A.EF)] - 35) * 0.4;
    }
    for (let s = 0; s < 2; s++) { const o = ac(s, A.UEL); if (T[o] > 140) T[o] = 140 + 25 * Math.tanh((T[o] - 140) / 25); }
    // overhead arms keep the hands off the head: cap the elbow bend as the arm rises past 110
    for (let s = 0; s < 2; s++) {
      const e = T[ac(s, A.UEL)], o = ac(s, A.EF);
      // elbow additions from many words saturate softly; raised arms bend less so the hands stay off the face
      if (T[o] > 55) T[o] = 55 + 32 * Math.tanh((T[o] - 55) / 32);
      const cap = e > 110 ? Math.max(14, 55 - (e - 110) * 0.8) : e > 60 ? 85 - (e - 60) * 0.6 : 200;
      if (T[o] > cap) T[o] = cap + (T[o] - cap) * 0.25;
      // high arms: limit the upper-arm roll so a bent elbow never folds the hand behind the head
      if (e > 90) { const tw = ac(s, A.UTW), m = Math.max(12, 50 - (e - 90) * 0.7); T[tw] = m * Math.tanh(T[tw] / m); }
    }
    // a held shape is never frozen: shoulders, elbows, wrists and palms keep drifting inside it
    const ts = P.ts, s0 = P.ns + 300;
    for (let s = 0; s < 2; s++) {
      const e = T[ac(s, A.UEL)], up = clamp(e / 90, 0, 1.3), k = (0.45 + 0.55 * up) * P.mods.holdDrift, o = s0 + s * 17;
      T[ac(s, A.UEL)] += k * 14 * n2(ts * 0.16, o);
      T[ac(s, A.UAZ)] += k * 18 * n2(ts * 0.13, o + 1);
      T[ac(s, A.EF)] += k * (4 + 14 * n2(ts * 0.21, o + 2)) * (0.4 + 0.6 * up);
      T[ac(s, A.UTW)] += k * 16 * n2(ts * 0.12, o + 3);
      T[ac(s, A.FTW)] += k * 24 * n2(ts * 0.15, o + 4);
      T[ac(s, A.WF)] += k * 10 * n2(ts * 0.27, o + 5);
      T[ac(s, A.CLA)] += k * 3 * n2(ts * 0.19, o + 6) + 0.05 * Math.max(0, e - 20);
      T[ac(s, A.CLF)] += k * 3 * n2(ts * 0.17, o + 7);
    }
    // facing and travel: the stance center wanders a little and the body slowly changes facing (by stepping)
    const Tr = P.travel;
    Tr.timer -= P.dts;
    if (Tr.timer <= 0) {
      const r = P.rng;
      Tr.timer = 7 + r() * 9;
      const rad = 0.03 + 0.12 * P.mods.travel;
      const a = r() * TAU; Tr.tx = clamp(Tr.x + Math.cos(a) * rad, -0.16, 0.16); Tr.tz = clamp(Tr.z + Math.sin(a) * rad, -0.14, 0.14);
      Tr.tf = clamp(Tr.f + (r() * 2 - 1) * (12 + 25 * P.mods.travel), -28, 28);
    }
    const k = Math.min(1, P.dts * 0.25);
    Tr.x += (Tr.tx - Tr.x) * k; Tr.z += (Tr.tz - Tr.z) * k; Tr.f += (Tr.tf - Tr.f) * k;
    if (P.mods.stepAllowed < 0.5) { Tr.tx = Tr.x; Tr.tz = Tr.z; Tr.tf = Tr.f; }
    T[T3(0, 2)] += Tr.f * 0.75; T[T3(1, 2)] += Tr.f * 0.05; T[T3(2, 2)] += Tr.f * 0.05;
  }

  function stance(P) {
    const T = P.T, M = P.mods, F = P.feet, Tr = P.travel;
    const cf = Math.cos(Tr.f * D2R), sf = Math.sin(Tr.f * D2R);
    // step scheduling
    P.stepCool -= P.dt;
    if (!P.stepping && P.stepCool <= 0 && M.stepAllowed > 0.5) {
      let best = -1, err = 0;
      for (let s = 0; s < 2; s++) {
        desiredFoot(P, s, T, cf, sf);
        const dx = DF[0] - F[s].bx, dz = DF[1] - F[s].bz, dy = DF[2] - F[s].yaw;
        const e = Math.hypot(dx, dz) + Math.abs(dy) * 0.004;
        if (e > err) { err = e; best = s; }
      }
      const other = P.st.feet[1 - Math.max(0, best)];
      P.stepPending = err > 0.03;
      if (best >= 0 && err > 0.04 && other.lift < 0.005) {
        const f = F[best], S = f.step;
        S.on = true; S.t = 0; S.dur = (0.42 + P.rng() * 0.12) / Math.sqrt(Math.max(0.35, M.slowScale));
        S.x0 = f.bx; S.z0 = f.bz; S.y0 = f.yaw;
        // clamp: never cross the other foot, keep a sane stance
        const ox = F[1 - best].bx, oz = F[1 - best].bz;
        desiredFoot(P, best, T, cf, sf);
        let x1 = DF[0], z1 = DF[1];
        // never cross the other foot (in the facing frame), never a split
        const lx = (x1 - ox) * cf - (z1 - oz) * sf;
        if (SG[best] * lx < 0.12) { const fix = SG[best] * 0.12 - lx; x1 += fix * cf; z1 -= fix * sf; }
        if (Math.hypot(x1 - ox, z1 - oz) > 0.5) { const d = Math.hypot(x1 - ox, z1 - oz); x1 = ox + (x1 - ox) * 0.5 / d; z1 = oz + (z1 - oz) * 0.5 / d; }
        S.x1 = x1; S.z1 = z1; S.y1 = DF[2]; S.h = 0.045 + P.rng() * 0.035;
        P.stepping = true; P.stepSide = best;
      }
    }
    // weight transfer for a step in progress
    if (P.stepping) {
      const s = P.stepSide, S = F[s].step, u = S.t / S.dur;
      const k = smoothstep(0, 0.22, u) * (1 - smoothstep(0.82, 1, u));
      T[WS] += (SG[1 - s] * 0.95 - T[WS]) * k;
    }
    // support center from current plants
    let ax0 = 0, az0 = 0, ax1 = 0, az1 = 0;
    for (let s = 0; s < 2; s++) {
      const f = F[s], afb = rig.S[s].ankleFromBall, c = Math.cos(f.yaw * D2R), sn = Math.sin(f.yaw * D2R);
      const ax = f.bx + afb.x * c + afb.z * sn, az = f.bz - afb.x * sn + afb.z * c;
      if (s === 0) { ax0 = ax; az0 = az; } else { ax1 = ax; az1 = az; }
    }
    const midX = (ax0 + ax1) / 2, midZ = (az0 + az1) / 2, halfW = Math.abs(ax0 - ax1) / 2;
    // releve: when both heels are up the whole body rises with them (the ankles rise ~ 0.145 * sin(peel))
    const pl = Math.max(0, T[lc(0, L.PEEL)]) * 28, pr = Math.max(0, T[lc(1, L.PEEL)]) * 28, rel = Math.max(0, T[REL]) * 34;
    const rise = 0.145 * Math.sin(Math.min(44, Math.min(pl, pr) + rel) * D2R * M.peelAllowed);
    T[PY] += rise * 0.9;
    T[PX] += midX + clamp(T[WS], -1, 1) * halfW * 0.5;
    T[PZ] += midZ + 0.012 + 0.012;
    // balance: keep the whole-body center of mass over the feet (upper body lean measured last frame)
    T[PX] -= 0.7 * P.lean[0]; T[PZ] -= 0.7 * P.lean[1];
    const comX = T[PX] + 0.75 * P.lean[0], comZ = T[PZ] + 0.75 * P.lean[1];
    const minX = Math.min(ax0, ax1) + 0.015, maxX = Math.max(ax0, ax1) - 0.015;
    const minZ = Math.min(az0, az1) - 0.05, maxZ = Math.max(F[0].bz, F[1].bz) - 0.03;
    if (comX < minX) T[PX] += minX - comX; else if (comX > maxX) T[PX] -= comX - maxX;
    if (comZ < minZ) T[PZ] += minZ - comZ; else if (comZ > maxZ) T[PZ] -= comZ - maxZ;
  }

  const DF = new Float32Array(3);
  function desiredFoot(P, s, T, cf, sf) {
    const Tr = P.travel;
    const lx = SG[s] * clamp(T[STW], 0.07, 0.3), lz = rig.S[s].ballRest.z + clamp(T[lc(s, L.FOFF)], -0.3, 0.35);
    DF[0] = Tr.x + lx * cf + lz * sf; DF[1] = Tr.z - lx * sf + lz * cf; DF[2] = SG[s] * clamp(T[FYAW], -5, 40) + Tr.f;
  }

  function gaze(P, others) {
    const G = P.gaze, T = P.T, M = P.mods, rng = P.rng;
    G.timer -= P.dts;
    const chestQ = P.wq[BONE_INDEX.spine06], head = P.wp[BONE_INDEX.head];
    if (G.timer <= 0) {
      G.timer = 1.2 + rng() * 2.6;
      const pHands = 0.14 + 0.4 * M.gazeHands, pOther = others ? 0.12 : 0, pFloor = 0.05;
      const r = rng();
      if (r < pHands) { G.mode = 1; G.hand = rng() < 0.5 ? 0 : 1; G.timer *= 0.7; }
      else if (r < pHands + pOther) G.mode = 3;
      else if (r < pHands + pOther + pFloor) { G.mode = 2; }
      else {
        G.mode = 0;
        _v.set(0, 0, 1).applyQuaternion(chestQ);
        const yaw0 = Math.atan2(_v.x, _v.z) + (rng() * 2 - 1) * 1.3;
        const d = 3.5 + rng() * 3, hgt = 1.45 + rng() * 0.55 + 0.4 * (P.lv.float || 0);
        G.x = Math.sin(yaw0) * d; G.z = Math.cos(yaw0) * d; G.y = hgt;
      }
      if (G.mode === 2) { _v.set(0, 0, 1).applyQuaternion(chestQ); const y = Math.atan2(_v.x, _v.z) + (rng() - 0.5); G.x = Math.sin(y) * 3.2; G.z = Math.cos(y) * 3.2; G.y = 0; }
    }
    let tx = G.x, ty = G.y, tz = G.z;
    if (G.mode === 1) { const h = P.wp[BONE_INDEX[G.hand ? 'hand_R' : 'hand_L']]; tx = h.x; ty = h.y; tz = h.z; }
    else if (G.mode === 3 && others) { tx = others.x; ty = others.y; tz = others.z; }
    _v.set(tx - head.x, ty - head.y - 0.08, tz - head.z).applyQuaternion(_q.copy(chestQ).invert());
    let yaw = Math.atan2(_v.x, _v.z) * R2D, pitch = Math.atan2(-_v.y, Math.hypot(_v.x, _v.z)) * R2D;
    if (_v.z < -0.2 && Math.abs(yaw) > 100) yaw = Math.sign(yaw) * 75; // never try to look straight behind
    yaw = clamp(yaw, -75, 75); pitch = clamp(pitch, -25, G.mode === 1 ? 34 : 26);
    const w = clamp(P.X[GW], 0, 1) * (1 - 0.7 * M.gazeAway);
    T[T3(7, 2)] += w * yaw * 0.3; T[T3(8, 2)] += w * yaw * 0.3; T[T3(9, 2)] += w * yaw * 0.4;
    // nod mostly at the head, keep the neck long; a level, lifted carriage by default
    T[T3(7, 0)] += w * (pitch * 0.12 - 3); T[T3(8, 0)] += w * (pitch * 0.16 - 1.5); T[T3(9, 0)] += w * (pitch * 0.72 + 1.5);
    // the head keeps the eyes level: cancel the trunk's lateral tilt a little
    let tilt = 0; for (let i = 0; i <= 6; i++) tilt += T[T3(i, 1)];
    T[T3(8, 1)] -= w * tilt * 0.25; T[T3(9, 1)] -= w * tilt * 0.3;
  }

  function followThrough(P) {
    const T = P.T, V = P.V, M = P.mods;
    let vtw = 0; for (let i = 0; i <= 6; i++) vtw += V[T3(i, 2)];
    for (let s = 0; s < 2; s++) {
      const vel = V[ac(s, A.UEL)], vaz = V[ac(s, A.UAZ)];
      T[ac(s, A.WF)] += clamp(0.2 * M.trail * vel, -38, 38);
      T[ac(s, A.WA)] += clamp(0.08 * M.trail * vaz * SG[s], -15, 15);
      T[ac(s, A.FTW)] += clamp(-0.1 * M.trail * vaz, -20, 20);
      T[ac(s, A.EF)] += clamp(0.03 * (Math.abs(vel) + Math.abs(vaz)), 0, 22);
      T[ac(s, A.UAZ)] += clamp(-SG[s] * 0.12 * vtw, -30, 30);
      T[ac(s, A.UEL)] += clamp(-35 * V[PY], -15, 15);
      for (let f = 1; f < 5; f++) T[ac(s, A.CURL + f)] += clamp(-0.0008 * M.trail * Math.abs(vel) * f, -0.25, 0);
    }
  }

  function springs(P) {
    const M = P.mods, X = P.X, V = P.V, T = P.T, om = P.omega, ze = P.zeta;
    for (let c = 0; c < NCH; c++) {
      const g = CH_G[c];
      om[c] = G_OM[g] * (1 + (M.stiff - 1) * G_STIFF[g]);
      ze[c] = Math.max(0.2, G_ZE[g] * (1 - 0.68 * M.loose * G_LOOSE[g]) + M.zetaAdd * G_LOOSE[g]);
    }
    const dt = P.dt, n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
    for (let k = 0; k < n; k++) {
      for (let c = 0; c < NCH; c++) {
        const w = om[c];
        const a = w * w * (T[c] - X[c]) - 2 * ze[c] * w * V[c];
        V[c] += a * h; X[c] += V[c] * h;
      }
    }
  }

  function feetOut(P) {
    const C = P.C, M = P.mods, F = P.feet;
    for (let s = 0; s < 2; s++) {
      const f = F[s], o = P.st.feet[s], S = f.step;
      let peel = (Math.max(0, C[lc(s, L.PEEL)]) * 28 + Math.max(0, C[REL]) * 34) * M.peelAllowed;
      let lift = Math.max(0, C[lc(s, L.LIFT)]) * M.liftAllowed, fwd = C[lc(s, L.LFWD)];
      o.bx = f.bx; o.bz = f.bz; o.yaw = f.yaw;
      if (S.on) {
        S.t += P.dt;
        const u = Math.min(1, S.t / S.dur);
        if (u < 0.22) peel += 26 * smoothstep(0, 0.22, u);
        else if (u < 0.88) {
          const w = (u - 0.22) / 0.66, sm = smoother(w);
          o.bx = S.x0 + (S.x1 - S.x0) * sm; o.bz = S.z0 + (S.z1 - S.z0) * sm; o.yaw = S.y0 + (S.y1 - S.y0) * sm;
          lift += S.h * Math.sin(Math.PI * w); peel += 26 * (1 - smoothstep(0.6, 1, w));
        } else {
          o.bx = S.x1; o.bz = S.z1; o.yaw = S.y1;
          peel += 26 * (1 - smoothstep(0.88, 1, u)) * 0.3;
        }
        if (u >= 1) { S.on = false; f.bx = S.x1; f.bz = S.z1; f.yaw = S.y1; P.stepping = false; P.stepCool = 0.25 + P.rng() * 0.3; }
      }
      o.peel = Math.min(44, peel);
      o.lift = lift; o.liftFwd = fwd;
      o.point = 22 * clamp(lift / 0.08, 0, 1);
      o.inv = clamp(C[lc(s, L.INV)], -5, 25);
      o.knee = clamp(C[lc(s, L.KNEE)], -30, 45);
      o.toe = (lift > 0.004 ? 0 : o.peel) + C[lc(s, L.TOE)] * (lift > 0.004 ? 0.4 : 1);
    }
  }

  // measured motion and outputs
  function measure(P) {
    const C = P.C, Cp = P.Cprev, dt = Math.max(1e-4, P.dt), RS = P.regionSpeed;
    for (const r of REGIONS) RS[r] = 0;
    let energy = 0;
    for (let c = 0; c < NCH; c++) {
      const r = CH_REGION[c]; if (!r) continue;
      const sp = Math.abs(C[c] - Cp[c]) / dt / CH_NORM[c];
      RS[r] += sp / REG_CNT[r];
      energy += sp;
    }
    Cp.set(C);
    // upper body lean for balance (COM of the trunk, head and arms relative to the pelvis)
    const wp = P.wp, pel = wp[BONE_INDEX.pelvis];
    let lx = 0, lz = 0;
    for (let i = 0; i < BIDX.length; i++) { const p = wp[BIDX[i]]; lx += (p.x - pel.x) * BW[i]; lz += (p.z - pel.z) * BW[i]; }
    P.lean[0] += (lx - P.lean[0]) * Math.min(1, P.dt * 8); P.lean[1] += (lz - P.lean[1]) * Math.min(1, P.dt * 8);
    // sleepwalker guard: both hands forward of the chest at shoulder height for more than ~0.8 s -> one arm drops
    const chQ = _qm.copy(P.wq[CHEST]).invert(), chP = P.wp[CHEST];
    let fwd = 0;
    for (let s = 0; s < 2; s++) {
      _vm.copy(P.wp[HANDS[s]]).sub(chP).applyQuaternion(chQ);
      if (_vm.z > 0.2 && _vm.y > -0.22 && _vm.y < 0.32) fwd++;
    }
    if (fwd === 2 && P.thr[0].w < 0.3 && P.thr[1].w < 0.3) P.zombieT += P.dt; else P.zombieT = Math.max(0, P.zombieT - 2 * P.dt);
    if (P.zombieT > 0.8) { const s = P.arms[0].t > P.arms[1].t ? 0 : 1; P.arms[s].forceLow = true; P.zombieT = 0; P.zombieHits = (P.zombieHits || 0) + 1; }
    // activity
    const act = P.act, M = P.mods;
    for (const r of REGIONS) act.regions[r] = IDLE_REG[r];
    let tempoW = 0.2, tempoSum = 0.2 * 0.25 * M.slowScale;
    let dom = null, domT = -1, strong = null, strongV = 0;
    for (const id of QUALITY_ORDER) {
      const v = P.lv[id] || 0; if (v < 0.01) continue;
      const q = Q[id], rg = q.regions || {};
      for (const r in rg) act.regions[r] = Math.max(act.regions[r], v * rg[r]);
      const tq = q.tempo ? q.tempo(P) : 0.3;
      const scale = tq > 1 ? M.fastScale : M.slowScale;
      tempoSum += v * tq * (id === 'groove' ? 1 : scale); tempoW += v;
      const l = layers.get(id);
      if (v > 0.3 && l && l.addedAt > domT) { domT = l.addedAt; dom = id; }
      if (v > strongV) { strongV = v; strong = id; }
    }
    for (const r of REGIONS) act.regions[r] = clamp(0.55 * act.regions[r] + 0.45 * Math.min(1, RS[r] * 1.5), 0, 1);
    act.regions.flesh = clamp(0.5 * act.regions.flesh + 0.5 * M.fleshGain / 1.5, 0, 1);
    act.energy = clamp(energy / 9, 0, 1) * 0.7 + 0.3 * clamp(act.energy, 0, 1) * 0;
    act.tempo = (P.lv.groove || 0) > 0.3 ? P.grooveHz : tempoSum / tempoW;
    act.dominant = dom || (strongV > 0.05 ? strong : null);
    // flesh params for the figure: gain 0..2 (0 = rigid), stiffness ~0.3..2 (relative spring stiffness), damping 0..1
    // figure.js units: gain (offset per unit acceleration, default 0.12), stiffness (spring k, default 140), damping (default 9)
    P.flesh.gain = clamp(0.12 * M.fleshGain / 0.3, 0, 0.5);
    P.flesh.stiffness = clamp(140 * M.fleshStiff, 50, 320);
    const zf = clamp(0.38 * M.fleshDamp * (1 - 0.3 * M.loose) + 0.3 * Math.max(0, 1 - M.stiff), 0.12, 1);
    P.flesh.damping = 2 * zf * Math.sqrt(P.flesh.stiffness);
  }
  const BIDX = ['spine03', 'spine06', 'head', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R', 'upperarm_L', 'upperarm_R'].map(n => BONE_INDEX[n]);
  const BW = [0.28, 0.3, 0.12, 0.06, 0.06, 0.04, 0.04, 0.05, 0.05];
  const CHEST = BONE_INDEX.spine06, HANDS = [BONE_INDEX.hand_L, BONE_INDEX.hand_R], _qm = new THREE.Quaternion(), _vm = new THREE.Vector3();
  const REG_CNT = { center: 2, pelvis: 3, spine: 18, head: 9, arms: 12, hands: 26, legs: 3, feet: 8, flesh: 1 };

  // ------------------------------------------------------------------ main
  function poseOne(P, dt, others) {
    P.dt = dt;
    // personal layer values
    for (const pl of P.lay.values()) {
      pl.t += dt;
      if (pl.t >= 0) { const p = Math.min(1, pl.t / Math.max(0.05, pl.dur)); pl.val = pl.from + (pl.tgt - pl.from) * smoother(p); }
      P.lv[pl.id] = pl.val;
    }
    P.floatBoost = Math.max(0, P.floatBoost - dt / 6);
    computeMods(P);
    const M = P.mods;
    P.dts = dt * P.tempo * M.slowScale; P.dtf = dt * P.tempo * M.fastScale;
    P.ts += P.dts; P.tf += P.dtf;
    const T = P.T;
    T.set(BASE); P.ACC.fill(0); P.deep = 0;
    P.thr[0].w = 0; P.thr[1].w = 0;
    // carrier shape
    for (const k in P.shapeBoost) P.shapeBoost[k] = 0;
    const shL = P.lay.get('shake');
    if (shL && shL.tgt > 0.05) P.shapeBoost[P.shakeVariant] = 7 * shL.tgt;
    if (P.floatBoost > 0.1) { P.shapeBoost.vUp = 4; P.shapeBoost.armsOut = 4; }
    let drive = 0, sumD = 0;
    for (const id of QUALITY_ORDER) {
      let v = P.lv[id] || 0; if (id === 'float') v = Math.max(v, 0.15 + P.floatBoost);
      // use the layer target too, so the cue's shape is picked as soon as the cue is absorbed
      const pl = P.lay.get(id); if (pl && pl.tgt > v && pl.t >= 0) v = 0.5 * (v + pl.tgt);
      const d = v * (Q[id].shapeGain || 0); sumD += d; if (d > drive) drive = d;
    }
    P.shapeDrive = clamp(drive + 0.15 * (sumD - drive), 0, 1) * (1 - 0.3 * (P.lv.dolfi || 0));
    updateShapes(P, P.dts / M.holdMul, prefs, false);
    const amtT = 0.75 + 0.25 * clamp(P.shapeDrive * 1.5, 0, 1);
    P.shapeAmt += (amtT - P.shapeAmt) * Math.min(1, P.dts * 0.7);
    const cur = P.shape.cur, amt = P.shapeAmt;
    for (let c = 0; c < NCH; c++) T[c] += cur[c] * (c === GW || c === ac(0, A.HANG) || c === ac(1, A.HANG) ? Math.min(1, amt * 1.4) : amt);
    // each arm's own posture, unless the body shape owns the arms (folds, V up, side bend...)
    updateArms(P, P.dts / M.holdMul, armPrefs);
    const free = 1 - P.shape.own;
    for (let s = 0; s < 2; s++) { const ap = P.arms[s].cur, o = ac(s, 0); for (let k = 0; k < ARMN; k++) T[o + k] += free * ap[k]; }
    // always-on layer
    baseLayer(P);
    // generators
    for (const id of QUALITY_ORDER) {
      const q = Q[id];
      let v = P.lv[id] || 0;
      if (id === 'float') v = Math.max(v, 0.15 + P.floatBoost);
      if (q.gen && v > 0.001) q.gen(P, v * M.genGain);
      if (q.always) q.always(P);
    }
    threads(P);
    coordinate(P);
    for (const id of QUALITY_ORDER) { const q = Q[id], v = P.lv[id] || 0; if (q.post && v > 0.001) q.post(P, v); }
    stance(P);
    gaze(P, others);
    followThrough(P);
    springs(P);
    const C = P.C, X = P.X, Ac = P.ACC;
    for (let c = 0; c < NCH; c++) {
      let v = X[c] + Ac[c];
      if (!(v === v) || Math.abs(v) > 1e4) { X[c] = BASE[c]; P.V[c] = 0; v = BASE[c]; P.nanCount = (P.nanCount || 0) + 1; } // never let a bad value through
      C[c] = v;
    }
    feetOut(P);
    rig.applyPose(P, C, P.st);
    measure(P);
  }

  function update(dt, time) {
    dt = clamp(+dt || 0, 0, 1 / 20);
    clock += dt;
    let changed = false;
    for (const l of layers.values()) {
      updateEnvelope(l, dt);
      if (l.target <= 0 && l.t >= l.dur) { l.value = 0; layers.delete(l.id); changed = true; }
    }
    for (const P of performers.values()) {
      for (const pl of P.lay.values()) if (!layers.has(pl.id) && pl.tgt <= 0 && pl.t >= pl.dur) { P.lay.delete(pl.id); P.lv[pl.id] = 0; }
    }
    // where are the other performers (for an occasional glance)? use the first other one, in this performer's local space
    for (const P of performers.values()) {
      let others = null;
      for (const O of performers.values()) {
        if (O === P || !O.figure.object3d || !P.figure.object3d) continue;
        O.figure.object3d.updateWorldMatrix?.(true, false); P.figure.object3d.updateWorldMatrix?.(true, false);
        _v2.set(0, 1.6, 0); O.figure.object3d.localToWorld(_v2); P.figure.object3d.worldToLocal(_v2);
        others = _v2; break;
      }
      poseOne(P, dt, others);
    }
    if (changed) emit('layers');
  }

  // ------------------------------------------------------------------ outputs
  function getActivity(performerId) {
    const P = performerId != null ? performers.get(performerId) : performers.values().next().value;
    if (!P) return { regions: Object.fromEntries(REGIONS.map(r => [r, 0])), energy: 0, tempo: 0, dominant: null };
    return P.act;
  }
  function getFleshParams(performerId) { const P = performers.get(performerId); return P ? P.flesh : { gain: 0.12, stiffness: 140, damping: 9 }; }

  const _w = new THREE.Vector3(), _w2 = new THREE.Vector3(), _qi = new THREE.Quaternion();
  function getGlowPoints(performerId) {
    const P = performers.get(performerId); if (!P) return [];
    const out = P.glowOut; out.length = 0;
    P.glowN = 0;
    const push = P.glowPush;
    const ls = getLayersCached();
    for (let i = ls.length - 1; i >= 0 && P.glowN < 8; i--) {
      const id = ls[i].id, q = Q[id]; if (!q || !q.glow) continue;
      const v = P.lv[id] || 0; if (v < 0.05 && !(id === 'countdown' || id === 'explosive')) continue;
      q.glow(P, v, push);
    }
    if (P.glowN === 0) push('spine03', 0, 0.02, 0.06, 0.12, 0.25 + 0.1 * P.breath); // idle: a soft point in the center that breathes
    return out;
  }
  function makeGlowPush(P) {
    return (bone, ox, oy, oz, radius, intensity, next, frac) => {
      if (P.glowN >= 8 || !(intensity > 0.02) || !BONE_BY_NAME[bone]) return;
      const g = P.glow[P.glowN++];
      g.bone = bone; g.radius = radius; g.intensity = clamp(intensity, 0, 1);
      if (next && BONE_BY_NAME[next] && frac > 0) {
        const bi = BONE_INDEX[bone], ni = BONE_INDEX[next];
        _w.copy(P.wp[ni]).sub(P.wp[bi]).multiplyScalar(frac).applyQuaternion(_qi.copy(P.wq[bi]).invert());
        g.offset[0] = _w.x + ox; g.offset[1] = _w.y + oy; g.offset[2] = _w.z + oz;
      } else { g.offset[0] = ox; g.offset[1] = oy; g.offset[2] = oz; }
      P.glowOut.push(g);
    };
  }
  const _lc = [], byAdded = (a, b) => a.addedAt - b.addedAt;
  function getLayersCached() {
    _lc.length = 0; for (const l of layers.values()) _lc.push(l);
    _lc.sort(byAdded); return _lc;
  }

  function on(ev, cb) { (listeners[ev] ||= []).push(cb); return () => { const a = listeners[ev]; const i = a.indexOf(cb); if (i >= 0) a.splice(i, 1); }; }

  // debug view for the harness (not part of the contract)
  function debug(performerId) {
    const P = performers.get(performerId); if (!P) return null;
    return { C: P.C, T: P.T, arms: P.arms.map(a => a.name), zombieHits: P.zombieHits || 0, own: P.shape.own, feet: P.st.feet, plants: P.feet, ballW: P.ballW, heelW: P.heelW, airborne: P.airborne, stepping: P.stepping, shape: P.shape.name, shapeAmt: P.shapeAmt, collide: P.collide, reachDrop: P.reachDrop, lv: P.lv, bias: P.bias, tempo: P.tempo };
  }

  return { addPerformer, removePerformer, setLayer, toggleLayer, releaseAll, getLayers, accent, getActivity, getGlowPoints, getFleshParams, update, on, setThread, debug };
}
