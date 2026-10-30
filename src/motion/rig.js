// rig.js: channel layout and pose application for the motion engine. OWNER: builder C.
// The engine works in "channels" (anatomical angles in degrees, meters for offsets). This module turns a
// channel vector into bone quaternions (same axes and sign conventions as skeleton.js jointQuat, with a
// soft clamp to the joint limits), solves the legs with two-bone IK onto planted feet, aims the upper arms
// by direction (elevation + plane), pushes arms out of the torso, and keeps a root-space FK cache.
import { BONES, BONE_INDEX, LANDMARKS } from '../skeleton.js';
import { cd2 } from './noise.js';

// ---------------------------------------------------------------- channel layout
export const TRUNK_BONES = ['pelvis', 'spine01', 'spine02', 'spine03', 'spine04', 'spine05', 'spine06', 'neck01', 'neck02', 'head'];
export const NTR = TRUNK_BONES.length;
export const TR = 0;                         // trunk: TR + 3*i + (0 flex, 1 abd, 2 twist)
export const PX = 30, PY = 31, PZ = 32;      // pelvis offset (m) from rest
export const ARM0 = 33, ARMN = 21;           // per side (0 = left, 1 = right)
// DROOP 0..1: roll the raised upper arm so the bent elbow lets the forearm hang toward the floor (arms held in water)
export const A = { CLF: 0, CLA: 1, UEL: 2, UAZ: 3, UTW: 4, EF: 5, FTW: 6, WF: 7, WA: 8, HANG: 9, CURL: 10, SPR: 15, DROOP: 20 };
export const LEG0 = ARM0 + 2 * ARMN, LEGN = 7;
export const L = { PEEL: 0, LIFT: 1, LFWD: 2, KNEE: 3, INV: 4, TOE: 5, FOFF: 6 };
export const STW = LEG0 + 2 * LEGN;          // half stance width (m, ball x)
export const FYAW = STW + 1;                 // foot turn-out (deg)
export const REL = STW + 2;                  // releve 0..1 (both heels)
export const WS = STW + 3;                   // weight side -1 (right) .. +1 (left)
export const GW = STW + 4;                   // gaze weight 0..1
export const NCH = STW + 5;
export const ac = (s, k) => ARM0 + s * ARMN + k;
export const lc = (s, k) => LEG0 + s * LEGN + k;
export const SG = [1, -1];
const SFX = ['_L', '_R'];

// Spring groups (natural frequency rad/s, damping ratio) for each channel.
export const GROUPS = {
  pel: [11, 1.0], ppos: [13, 1.0], spine: [12, 1.0], neck: [10, 0.92], head: [10, 0.88],
  clav: [20, 0.9], uarm: [10, 0.95], elbow: [16, 0.85], ftw: [15, 0.9], wrist: [22, 0.8], fing: [34, 0.8],
  leg: [20, 1.0], stance: [6, 1.0], ws: [6.5, 1.0], gaze: [5, 1.0],
};
export const CH_GROUP = new Array(NCH);
for (let i = 0; i < NTR; i++) for (let k = 0; k < 3; k++) CH_GROUP[TR + 3 * i + k] = i === 0 ? 'pel' : i < 7 ? 'spine' : i < 9 ? 'neck' : 'head';
CH_GROUP[PX] = CH_GROUP[PY] = CH_GROUP[PZ] = 'ppos';
for (let s = 0; s < 2; s++) {
  const g = ['clav', 'clav', 'uarm', 'uarm', 'uarm', 'elbow', 'ftw', 'wrist', 'wrist', 'uarm'];
  for (let k = 0; k < 10; k++) CH_GROUP[ac(s, k)] = g[k];
  for (let k = 10; k < 20; k++) CH_GROUP[ac(s, k)] = 'fing';
  CH_GROUP[ac(s, A.DROOP)] = 'uarm';
  for (let k = 0; k < LEGN; k++) CH_GROUP[lc(s, k)] = k === L.FOFF ? 'stance' : 'leg';
}
CH_GROUP[STW] = CH_GROUP[FYAW] = 'stance'; CH_GROUP[REL] = 'leg'; CH_GROUP[WS] = 'ws'; CH_GROUP[GW] = 'gaze';

// Gaga ready stance (absolute channel values). Feet parallel hip width, knees soft, arms a little off the ribs,
// elbows soft, fingers lightly and unevenly curled, head level.
export const BASE = new Float32Array(NCH);
BASE[PY] = -0.006;
for (let s = 0; s < 2; s++) {
  BASE[ac(s, A.UEL)] = 10; BASE[ac(s, A.UAZ)] = 12; BASE[ac(s, A.UTW)] = 0; BASE[ac(s, A.EF)] = 20; BASE[ac(s, A.WF)] = 6;
  const curl = [0.18, 0.22, 0.27, 0.32, 0.38];
  for (let f = 0; f < 5; f++) { BASE[ac(s, A.CURL + f)] = curl[f]; BASE[ac(s, A.SPR + f)] = 0.15; }
}
BASE[STW] = 0.112; BASE[FYAW] = 6; BASE[GW] = 1;

// ---------------------------------------------------------------- skeleton data
export const BI = BONE_INDEX;
const NB = BONES.length;
const PARENT = BONES.map(b => (b.parent ? BONE_INDEX[b.parent] : -1));
const REST_LOCAL = BONES.map((b, i) => { const p = PARENT[i] >= 0 ? BONES[PARENT[i]].head : [0, 0, 0]; return [b.head[0] - p[0], b.head[1] - p[1], b.head[2] - p[2]]; });
const TRUNK_IDX = TRUNK_BONES.map(n => BI[n]);
const D2R = Math.PI / 180;

function vsub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function vlen(a) { return Math.hypot(a[0], a[1], a[2]); }
function vnorm(a) { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

// Soft ceiling: the identity up to m below hi, then eases into hi (C1 continuous).
function satMax(x, hi, m) { return x <= hi - m ? x : hi - m + m * Math.tanh((x - hi + m) / m); }

// Soft clamp: linear in the central 75% of the range, then eases into the limit (C1 continuous).
function smoothstep01(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
export function softClamp(x, lo, hi) {
  if (hi - lo < 1e-6) return lo;
  const c = 0.5 * (lo + hi), h = 0.5 * (hi - lo);
  const y = (x - c) / h, ay = Math.abs(y);
  if (ay <= 0.75) return x;
  const yy = 0.75 + 0.25 * Math.tanh((ay - 0.75) / 0.25);
  return c + (y < 0 ? -yy : yy) * h;
}

export function createRig(THREE) {
  const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion();
  const AX = BONES.map(b => ({ f: new THREE.Vector3(...b.axes.flex), a: new THREE.Vector3(...b.axes.abd), t: new THREE.Vector3(...b.axes.twist) }));
  const LIM = BONES.map(b => b.limits);
  const qf = Q(), qa = Q(), qt = Q(), q1 = Q(), q2 = Q(), q3 = Q(), v1 = V(), v2 = V(), v3 = V(), v4 = V(), v5 = V(), m4 = new THREE.Matrix4();
  const DOWN = new THREE.Vector3(0, -1, 0), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), Z = new THREE.Vector3(0, 0, 1);

  // anatomical quaternion (twist, then abduction, then flexion: q = qf * qa * qt), soft clamped to limits
  function anat(i, f, a, t, out, soft = true) {
    const lim = LIM[i];
    if (soft) { f = softClamp(f, lim.flex[0], lim.flex[1]); a = softClamp(a, lim.abd[0], lim.abd[1]); t = softClamp(t, lim.twist[0], lim.twist[1]); }
    const ax = AX[i];
    qf.setFromAxisAngle(ax.f, f * D2R); qa.setFromAxisAngle(ax.a, a * D2R); qt.setFromAxisAngle(ax.t, t * D2R);
    return out.copy(qf).multiply(qa).multiply(qt);
  }

  // per-side constants
  const S = [0, 1].map(s => {
    const n = (k) => BI[k + SFX[s]];
    const up = BONES[n('upperarm')], th = BONES[n('thigh')], sh = BONES[n('shin')];
    const thDir = new THREE.Vector3(...vnorm(vsub(th.tail, th.head)));
    const hinge = new THREE.Vector3(...sh.axes.flex); hinge.addScaledVector(thDir, -hinge.dot(thDir)).normalize();
    const e3 = new THREE.Vector3().crossVectors(thDir, hinge);
    const qE = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(thDir, hinge, e3));
    const ballRest = BONES[n('toes')].head, ankleRest = BONES[n('foot')].head;
    const L1 = th.length, L2 = sh.length;
    return {
      clav: n('clavicle'), up: n('upperarm'), fore: n('forearm'), hand: n('hand'),
      fingers: ['index', 'middle', 'ring', 'pinky'].map(f => [n(f + '01'), n(f + '02'), n(f + '03')]),
      thumb: [n('thumb01'), n('thumb02'), n('thumb03')], mid3: n('middle03'),
      thigh: n('thigh'), shin: n('shin'), foot: n('foot'), toes: n('toes'),
      armDir: new THREE.Vector3(...up.dir), bendRest: new THREE.Vector3(...BONES[n('forearm')].axes.flex).cross(new THREE.Vector3(...up.dir)).normalize(), upLen: up.length, foreLen: BONES[n('forearm')].length, handLen: BONES[n('hand')].length,
      thDir, qEinv: qE.clone().invert(), shinDir: new THREE.Vector3(...vnorm(vsub(sh.tail, sh.head))), L1, L2,
      reach: Math.sqrt(L1 * L1 + L2 * L2 + 2 * L1 * L2 * Math.cos(9 * D2R)),
      ballRest: new THREE.Vector3(...ballRest), ankleFromBall: new THREE.Vector3(...vsub(ankleRest, ballRest)), ballFromAnkle: new THREE.Vector3(...vsub(ballRest, ankleRest)),
    };
  });

  // floor contact points per foot (same landmarks the motion lab uses): heel on the foot bone, ball on the toes
  // bone, toe tip at the end of the toes bone. Heights are measured against the rest pose (flat foot = 0).
  const CP = [0, 1].map(s => {
    const sx = SFX[s], hl = LANDMARKS['heel' + sx], fb = LANDMARKS['football' + sx];
    const fo = BONES[BI['foot' + sx]], tb = BONES[BI['toes' + sx]];
    return { heelOff: hl.offset, heelRest: fo.head[1] + hl.offset[1], ballOff: fb.offset, ballRest: tb.head[1] + fb.offset[1],
      tipOff: [tb.tail[0] - tb.head[0], tb.tail[1] - tb.head[1] - 0.012, tb.tail[2] - tb.head[2]], tipRest: tb.tail[1] - 0.012 };
  });
  const FLOOR_TIP = 0.0012, AIR_TIP = 0.011; // toe tip clearance: 1 mm on the floor, 12 mm once the foot is in the air

  // ------------------------------------------------------------ performer setup
  function setupPerformer(P, figure) {
    P.cpH = [V(), V()]; P.cpB = [V(), V()]; P.cpT = [V(), V()]; P.crel = [[0, 0, 0], [0, 0, 0]];
    P.b = BONES.map(bn => figure.byName ? figure.byName[bn.name] : figure.bones[BI[bn.name]]);
    P.wq = Array.from({ length: NB }, Q); P.wp = Array.from({ length: NB }, V);
    P.ankle = [V(), V()]; P.footQ = [Q(), Q()]; P.pole = [V(), V()]; P.airborne = [false, false];
    P.ballW = [V(), V()]; P.heelW = [V(), V()]; P.toeOut = [0, 0]; P.liftNow = [0, 0];
    P.collide = [0, 0];
    P.thr = [{ w: 0, x: 0, y: 0, z: 0 }, { w: 0, x: 0, y: 0, z: 0 }];
  }

  function fk(P, i) {
    const p = PARENT[i], b = P.b[i];
    if (p < 0) { P.wq[i].copy(b.quaternion); P.wp[i].copy(b.position); return; }
    P.wq[i].copy(P.wq[p]).multiply(b.quaternion);
    P.wp[i].copy(b.position).applyQuaternion(P.wq[p]).add(P.wp[p]);
  }
  // world point of bone i at bone-local offset (x,y,z) (bone-local = rest coords relative to head)
  function pointOf(P, i, x, y, z, out) { return out.set(x, y, z).applyQuaternion(P.wq[i]).add(P.wp[i]); }

  // ------------------------------------------------------------ feet
  // foot pose from the stance state: planted ball (x, z), yaw (deg), peel (deg, heel up about the ball),
  // inversion (deg, onto the outer edge), lift (m) / liftFwd (m) for airborne feet, point (deg, toes down in the air).
  function footPose(P, s, bx, bz, yawDeg, peelDeg, invDeg, lift, liftFwd, pointDeg) {
    const C = S[s], sg = SG[s];
    q1.setFromAxisAngle(Y, yawDeg * D2R);
    q2.setFromAxisAngle(X, (peelDeg + pointDeg) * D2R);
    q3.setFromAxisAngle(Z, -sg * invDeg * D2R);
    const fq = P.footQ[s].copy(q1).multiply(q2).multiply(q3);
    // pivot: ball, shifted to the outer edge while inverting
    const out = Math.min(1, Math.abs(invDeg) / 6) * sg * 0.025;
    v1.set(out, 0, 0); // pivot offset from the ball joint (rest frame): the toes lie flat and the foot hinges at the ball joint, so peeling never slides the ball
    v2.copy(C.ankleFromBall).sub(v1).applyQuaternion(fq); // pivot -> ankle
    v3.copy(v1).applyQuaternion(q1);                        // ball -> pivot (yaw only, pivot stays on floor)
    const a = P.ankle[s].set(bx, C.ballRest.y, bz).add(v3).add(v2);
    if (lift > 0) { v4.set(0, 0, liftFwd).applyQuaternion(q1); a.x += v4.x; a.z += v4.z; a.y += lift; }
    P.airborne[s] = lift > 0.004;
    return a;
  }

  // two-bone IK for one leg; ankle target P.ankle[s], foot orientation P.footQ[s], knee pole P.pole[s]
  function legIK(P, s, toeFlexDeg) {
    const C = S[s], b = P.b, pel = BI.pelvis;
    const hip = v1.copy(b[C.thigh].position).applyQuaternion(P.wq[pel]).add(P.wp[pel]);
    const tgt = P.ankle[s];
    const d = v2.copy(tgt).sub(hip); let D = d.length();
    const u = d.multiplyScalar(1 / (D || 1));
    const Dc = Math.min(Math.max(D, 0.25), C.L1 + C.L2 - 1e-4);
    const p = v3.copy(P.pole[s]); p.addScaledVector(u, -p.dot(u));
    if (p.lengthSq() < 1e-8) p.set(0, 0, 1).addScaledVector(u, -u.z);
    p.normalize();
    const cosA = (C.L1 * C.L1 + Dc * Dc - C.L2 * C.L2) / (2 * C.L1 * Dc);
    const a = Math.acos(Math.min(1, Math.max(-1, cosA)));
    const f1 = v4.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(p, Math.sin(a)).normalize();
    const f2 = v5.crossVectors(p, u); f2.addScaledVector(f1, -f2.dot(f1)).normalize();
    const f3 = _f3.crossVectors(f1, f2);
    m4.makeBasis(f1, f2, f3);
    const R = q1.setFromRotationMatrix(m4).multiply(C.qEinv); // thigh world rotation
    // thigh local
    b[C.thigh].quaternion.copy(P.wq[pel]).invert().multiply(R);
    P.wq[C.thigh].copy(R); P.wp[C.thigh].copy(hip);
    // knee point and shin
    const knee = f3.copy(f1).multiplyScalar(C.L1).add(hip);
    const g = v4.copy(tgt).sub(knee).normalize();       // world shin dir
    g.applyQuaternion(q2.copy(R).invert());            // in thigh frame
    b[C.shin].quaternion.setFromUnitVectors(C.shinDir, g);
    fk(P, C.shin);
    // foot: world orientation requested by the stance
    b[C.foot].quaternion.copy(P.wq[C.shin]).invert().multiply(P.footQ[s]);
    fk(P, C.foot);
    // toes: the requested flex, then extended just enough that the tip never goes below the floor
    const cp = CP[s];
    let fl = toeFlexDeg;
    anat(C.toes, fl, 0, 0, b[C.toes].quaternion); fk(P, C.toes);
    const clr = FLOOR_TIP + AIR_TIP * smoothstep01((P.liftNow[s] - 0.006) / 0.014);
    let rel = pointOf(P, C.toes, cp.tipOff[0], cp.tipOff[1], cp.tipOff[2], P.cpT[s]).y - cp.tipRest;
    if (rel < clr) {
      anat(C.toes, fl + 2, 0, 0, b[C.toes].quaternion); fk(P, C.toes);
      const r1 = pointOf(P, C.toes, cp.tipOff[0], cp.tipOff[1], cp.tipOff[2], P.cpT[s]).y - cp.tipRest, slope = (r1 - rel) / 2;
      if (slope > 1e-5) fl += Math.min(70, (clr - rel) / slope);
      anat(C.toes, fl, 0, 0, b[C.toes].quaternion); fk(P, C.toes);
      pointOf(P, C.toes, cp.tipOff[0], cp.tipOff[1], cp.tipOff[2], P.cpT[s]);
    }
    P.toeOut[s] = fl;
    // contact points (root space) and their heights above the rest floor
    pointOf(P, C.foot, cp.heelOff[0], cp.heelOff[1], cp.heelOff[2], P.cpH[s]);
    pointOf(P, C.toes, cp.ballOff[0], cp.ballOff[1], cp.ballOff[2], P.cpB[s]);
    const cr = P.crel[s]; cr[0] = P.cpH[s].y - cp.heelRest; cr[1] = P.cpB[s].y - cp.ballRest; cr[2] = P.cpT[s].y - cp.tipRest;
    pointOf(P, C.foot, C.ballFromAnkle.x, C.ballFromAnkle.y - 0.012, C.ballFromAnkle.z, P.ballW[s]);
    pointOf(P, C.foot, 0, -0.06, -0.065, P.heelW[s]);
  }
  const _f3 = new THREE.Vector3();

  // How far must the pelvis drop so both planted ankles stay within reach (knees keep a soft bend)?
  function reachDrop(P, pelvisQ, px, py, pz) {
    let drop = 0;
    for (let s = 0; s < 2; s++) {
      if (P.airborne[s]) continue;
      const C = S[s];
      const hip = v1.copy(P.b[C.thigh].position).applyQuaternion(pelvisQ); hip.x += px; hip.y += py; hip.z += pz;
      const a = P.ankle[s];
      const hx = hip.x - a.x, hz = hip.z - a.z, h2 = hx * hx + hz * hz, R = C.reach;
      const need = hip.y - a.y - Math.sqrt(Math.max(0.0001, R * R - h2));
      if (need > drop) drop = need;
    }
    return drop;
  }

  // ------------------------------------------------------------ arms
  // direction of the upper arm from elevation (0 = hanging, 90 = horizontal, 180 = overhead) and plane
  // (0 = sideways, 90 = forward, > 90 = across the body, < 0 = behind), in the clavicle frame.
  function armDirection(s, elevDeg, azimDeg, out) {
    const e = elevDeg * D2R, z = azimDeg * D2R, se = Math.sin(e);
    return out.set(SG[s] * se * Math.cos(z), -Math.cos(e), se * Math.sin(z));
  }

  // collision volumes (in the frame of a trunk bone): [bone, yMin, yMax, cz, rx, rz]
  const SLABS = [[BI.pelvis, -0.12, 0.08, 0.02, 0.165, 0.115], [BI.spine02, -0.02, 0.17, 0.05, 0.135, 0.11], [BI.spine05, -0.09, 0.15, 0.06, 0.15, 0.12]];
  const push = V(), bestPush = V(), lp = V(), tp = V(), qinv = Q(), accP = V(), tmpP = V(), rho = V(), rhoK = V();
  // Push needed to move a point out of the torso, head and floor volumes. Several volumes can overlap a point; their pushes
  // are blended by depth cubed (the deepest dominates, equal depths average), so the push never flips when the deepest one changes.
  function penetration(P, pt, r, s, outPush, soft) {
    outPush.set(0, 0, 0); let wsum = 0; accP.set(0, 0, 0);
    for (let si = 0; si < SLABS.length; si++) {
      const SL = SLABS[si], bi = SL[0], y0 = SL[1], y1 = SL[2], cz = SL[3], rx = SL[4], rz = SL[5];
      lp.copy(pt).sub(P.wp[bi]).applyQuaternion(qinv.copy(P.wq[bi]).invert());
      // the slab fades out over 3 cm above and below its range, so the push is continuous in height
      const yOut = lp.y < y0 ? y0 - lp.y : lp.y > y1 ? lp.y - y1 : 0;
      if (yOut >= 0.03) continue;
      const yf = 1 - smoothstep01(yOut / 0.03);
      const x = lp.x, z = lp.z - cz;
      // soft margin in front of the pelvis and groin: a continuous repulsive field for hands
      const mg = si === 0 ? soft * smoothstep01((z + 0.03) / 0.08) : 0;
      const ax = rx + r + mg, az = rz + r + mg;
      const e = Math.sqrt((x / ax) * (x / ax) + (z / az) * (z / az));
      if (e >= 1) continue;
      let px, pz;
      if (e < 0.08) { px = SG[s] * ax; pz = 0; } else { px = x * (1 / e - 1); pz = z * (1 / e - 1); }
      // in front of the pelvis a hand is moved sideways, toward its own hip, never forward onto the belly or groin.
      // The push grows smoothly with depth (zero at the edge of the zone), so nothing snaps as a hand passes through.
      if (z > -0.03 && bi !== BI.spine05) {
        const f = Math.min(1, (z + 0.03) / 0.08);
        const xe = ax * Math.sqrt(Math.max(0, 1 - (z / az) * (z / az)));
        px += f * (SG[s] * xe * (1 - e) - px); pz *= 1 - f;
      }
      px *= yf; pz *= yf;
      const m = Math.hypot(px, pz);
      if (m > 1e-6) { const w = m * m * m; wsum += w; accP.addScaledVector(tmpP.set(px, 0, pz).applyQuaternion(P.wq[bi]), w); }
    }
    // head sphere
    const hb = BI.head;
    pointOf(P, hb, 0, 0.085, 0.02, tp);
    const dx = pt.x - tp.x, dy = pt.y - tp.y, dz = pt.z - tp.z, dl = Math.hypot(dx, dy, dz), hr = 0.105 + r;
    if (dl < hr && hr - dl > 1e-6) { const mh = hr - dl, k = mh / (dl || 1), w = mh * mh * mh; wsum += w; accP.addScaledVector(tmpP.set(dx * k, dy * k, dz * k), w); }
    // floor
    const fy = r + 0.012 - pt.y;
    if (fy > 1e-6) { const w = fy * fy * fy; wsum += w; accP.addScaledVector(tmpP.set(0, fy, 0), w); }
    if (wsum <= 0) return 0;
    outPush.copy(accP).multiplyScalar(1 / wsum);
    return outPush.length();
  }

  const armPts = [V(), V(), V(), V()], ARM_R = [0.042, 0.038, 0.032, 0.03], SOFT = [0, 0.012, 0.03, 0.03];
  function armFK(P, C) { fk(P, C.up); fk(P, C.fore); fk(P, C.hand); }
  const qc0 = Q(), qc1 = Q();
  function armCollide(P, s) {
    const C = S[s]; let total = 0;
    qc0.copy(P.b[C.up].quaternion);                // the pose before any correction
    for (let it = 0; it < 3; it++) {
      pointOf(P, C.fore, 0, 0, 0, armPts[0]);                              // elbow
      pointOf(P, C.fore, C.armDir.x * C.foreLen * 0.5, C.armDir.y * C.foreLen * 0.5, 0, armPts[1]);
      pointOf(P, C.hand, 0, 0, 0, armPts[2]);                              // wrist
      pointOf(P, C.hand, C.armDir.x * C.handLen, C.armDir.y * C.handLen, 0, armPts[3]);
      // each arm point that is inside a volume asks for its own rotation about the shoulder (angle = push / lever); the
      // requests are blended by size, so the correction stays continuous as one point takes over from another
      const sh = P.wp[C.up];
      let best = 0, wsum = 0; rho.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const m = penetration(P, armPts[k], ARM_R[k], s, push, SOFT[k]);
        if (m < 0.0004) continue;
        if (m > best) best = m;
        const ks = smoothstep01(m / 0.008);            // grows from zero with zero slope: a limb meeting or leaving the torso is eased, never kicked
        v1.copy(armPts[k]).sub(sh); v2.copy(armPts[k]).addScaledVector(push, 1.15 * ks).sub(sh);
        v1.normalize(); v2.normalize();
        rhoK.crossVectors(v1, v2); const sn = rhoK.length(), ang = Math.atan2(sn, v1.dot(v2));
        if (sn < 1e-9 || ang < 1e-7) continue;
        rhoK.multiplyScalar(ang / sn);                 // rotation vector (axis * angle)
        const w = ang * ang * ang; wsum += w; rho.addScaledVector(rhoK, w);
      }
      if (best < 0.0004 || wsum <= 0) break;
      total += best;
      rho.multiplyScalar(1 / wsum);
      const ra = rho.length();
      if (ra > 1e-9) q1.setFromAxisAngle(rho.multiplyScalar(1 / ra), ra); else q1.identity();   // world correction
      q2.copy(P.wq[C.clav]).invert().multiply(q1).multiply(P.wq[C.clav]); // to clavicle frame
      P.b[C.up].quaternion.premultiply(q2);
      armFK(P, C);
    }
    // The solved correction is applied through a short two stage follower (quick to engage, slower to let go), so a limb
    // that meets the torso is stopped within a few frames and releases gently, and no push ever appears as a one frame kick.
    {
      qc1.copy(P.b[C.up].quaternion).multiply(qc0.invert());   // total correction, clavicle frame
      if (qc1.w < 0) { qc1.x = -qc1.x; qc1.y = -qc1.y; qc1.z = -qc1.z; qc1.w = -qc1.w; }
      const sn = Math.hypot(qc1.x, qc1.y, qc1.z), ang = 2 * Math.atan2(sn, qc1.w), f = sn > 1e-9 ? ang / sn : 2;
      const CS = (P.collS || (P.collS = [null, null]))[s] || (P.collS[s] = [0, 1, 2].map(() => ({ x1: 0, v1: 0, x2: 0, v2: 0 })));
      const tx = qc1.x * f, ty = qc1.y * f, tz = qc1.z * f;
      const cur = Math.hypot(CS[0].x2, CS[1].x2, CS[2].x2), want = Math.hypot(tx, ty, tz);
      const w = want > cur ? 48 : 12;
      const rx = cd2(CS[0], tx, w, P.dt), ry = cd2(CS[1], ty, w, P.dt), rz = cd2(CS[2], tz, w, P.dt), ra = Math.hypot(rx, ry, rz);
      if (ra > 1e-7) qc1.setFromAxisAngle(rho.set(rx / ra, ry / ra, rz / ra), ra); else qc1.identity();
      qc0.invert();                                            // back to the pre-collision pose
      P.b[C.up].quaternion.copy(qc1).multiply(qc0);
      armFK(P, C);
    }
    P.collide[s] = total;
  }

  // ------------------------------------------------------------ full pose
  // c: final channel vector. st: stance { feet: [{bx,bz,yaw,lift,liftFwd,point}], toeFlex:[..] }
  const pelQ = Q(), uDir = V(), hang = V();
  function applyPose(P, c, st) {
    const b = P.b;
    b[0].position.set(0, 0, 0); b[0].quaternion.identity(); fk(P, 0);
    // trunk rotations
    for (let i = 0; i < NTR; i++) anat(TRUNK_IDX[i], c[TR + 3 * i], c[TR + 3 * i + 1], c[TR + 3 * i + 2], b[TRUNK_IDX[i]].quaternion);
    // feet first (they constrain the pelvis height)
    for (let s = 0; s < 2; s++) {
      const F = st.feet[s]; P.liftNow[s] = F.lift;
      footPose(P, s, F.bx, F.bz, F.yaw, F.peel, F.inv, F.lift, F.liftFwd, F.point);
      const kn = (F.yaw + SG[s] * F.knee) * D2R;
      P.pole[s].set(Math.sin(kn), 0, Math.cos(kn));
    }
    const pel = BI.pelvis, rp = REST_LOCAL[pel];
    let px = rp[0] + c[PX], py = rp[1] + c[PY], pz = rp[2] + c[PZ];
    const drop = reachDrop(P, b[pel].quaternion, px, py, pz);
    py -= drop; P.reachDrop = drop;
    b[pel].position.set(px, py, pz);
    for (let i = 0; i < NTR; i++) fk(P, TRUNK_IDX[i]);
    // arms
    for (let s = 0; s < 2; s++) {
      const C = S[s], o = ARM0 + s * ARMN;
      // the limits are eased (no hard clip: a wide drifting arm reaching a limit would turn in one frame)
      const elev = satMax(-satMax(-satMax(c[o + A.UEL], 178, 15), 0, 8), 400, 1);
      // high arms never cross over the head: the plane is limited as the arm rises
      const azMax = 150 - 105 * smoothstep01((elev - 85) / 50);
      const azim = satMax(-satMax(-c[o + A.UAZ], 75, 20), azMax, 25);
      const h = Math.min(1, Math.max(0, c[o + A.HANG]));
      // scapulohumeral rhythm: shoulder girdle elevates overhead and protracts when reaching forward
      const rhythmE = (Math.max(0, elev - 30) * 0.09 + Math.max(0, elev - 100) * 0.08) * (1 - h);
      const rhythmP = (Math.max(0, Math.sin(azim * D2R)) * Math.max(0, elev - 25) * 0.1 + Math.min(0, Math.sin(azim * D2R)) * Math.max(0, elev - 25) * 0.08) * (1 - h);
      anat(C.clav, c[o + A.CLF] + rhythmP, c[o + A.CLA] + rhythmE, 0, b[C.clav].quaternion);
      fk(P, C.clav);
      armDirection(s, elev, azim, uDir);
      if (h > 0.001) {
        hang.copy(DOWN).applyQuaternion(qinv.copy(P.wq[C.clav]).invert());
        uDir.lerp(hang, h).normalize();
      }
      if (uDir.dot(C.armDir) < -0.93) { uDir.addScaledVector(Z, 0.4).normalize(); } // stay away from the swing singularity
      q3.setFromUnitVectors(C.armDir, uDir);
      let tw = c[o + A.UTW];
      // droop: roll the upper arm so the elbow bend points toward the floor (forearm and hand dangle from a floating arm)
      const drT = Math.min(1, Math.max(0, c[o + A.DROOP])) * smoothstep01((elev - 25) / 35) * smoothstep01((125 - elev) / 45);
      // The roll is large (up to about 110 deg) and its target can move fast (the arm is swinging, and near a half turn the
      // solution flips side), so the roll itself goes through two damped stages before it is applied.
      let rollT = 0;
      if (drT > 1e-5) { // no threshold: the roll grows continuously from zero
        const bd = v1.copy(C.bendRest).applyQuaternion(q3);                       // bend direction after the swing
        const gd = v2.copy(DOWN).applyQuaternion(qinv.copy(P.wq[C.clav]).invert());
        gd.addScaledVector(uDir, -gd.dot(uDir));
        if (gd.lengthSq() > 1e-4) {
          gd.normalize();
          const ang = Math.atan2(v3.crossVectors(bd, gd).dot(uDir), bd.dot(gd)) * 180 / Math.PI; // rotation about +u
          const need = -SG[s] * ang;
          let d = need - tw; d -= 360 * Math.round(d / 360);
          // near a half turn the solution flips side: fade the droop out there so the roll never pops
          const fade = smoothstep01((150 - Math.abs(d)) / 50);
          rollT = d * drT * fade;
        }
      }
      tw += cd2((P.droopS || (P.droopS = [null, null]))[s] || (P.droopS[s] = { x1: 0, v1: 0, x2: 0, v2: 0 }), rollT, 12, P.dt);
      v1.copy(uDir).multiplyScalar(-SG[s]);
      q2.setFromAxisAngle(v1, softClamp(tw, -88, 88) * D2R);
      b[C.up].quaternion.copy(q2).multiply(q3);
      anat(C.fore, c[o + A.EF], 0, c[o + A.FTW], b[C.fore].quaternion);
      anat(C.hand, c[o + A.WF], c[o + A.WA], 0, b[C.hand].quaternion);
      armFK(P, C);
      // thread: the hand is drawn toward a point (root space) by rotating the whole arm about the shoulder
      const th = P.thr[s];
      if (th.w > 0.001) {
        pointOf(P, C.hand, C.armDir.x * C.handLen * 0.5, C.armDir.y * C.handLen * 0.5, 0, v4);
        const sh = P.wp[C.up];
        v1.copy(v4).sub(sh).normalize(); v2.set(th.x, th.y, th.z).sub(sh).normalize();
        q1.setFromUnitVectors(v1, v2);
        q3.identity().slerp(q1, Math.min(1, th.w));
        q2.copy(P.wq[C.clav]).invert().multiply(q3).multiply(P.wq[C.clav]);
        b[C.up].quaternion.premultiply(q2);
        armFK(P, C);
      }
      armCollide(P, s);
      // the hand never parks on the face: open the elbow when the hand comes within reach of the head
      const hl = C.handLen + 0.05; // knuckles and the first finger joints
      pointOf(P, C.hand, C.armDir.x * hl, C.armDir.y * hl, 0, v4);
      pointOf(P, BI.head, 0, 0.085, 0.03, v5);
      const dh = v4.distanceTo(v5);
      if (dh < 0.5 && P.thr[s].w < 0.5) {
        // eased in (softplus then a ceiling): the opening starts from zero slope instead of a corner at 0.3 m
        const open = 15 * Math.log(1 + Math.exp(Math.min(30, (0.3 - dh) * 450 / 15)));
        const ef = Math.max(0, c[o + A.EF] - 80 * Math.tanh(open / 80));
        anat(C.fore, ef, 0, c[o + A.FTW], b[C.fore].quaternion);
        fk(P, C.fore); fk(P, C.hand);
      }
      // fingers: MCP leads at low curl (pads press), PIP and DIP join as the curl deepens
      for (let f = 0; f < 4; f++) {
        const cu = c[o + A.CURL + 1 + f], sp = c[o + A.SPR + 1 + f], j = C.fingers[f];
        const cp = Math.max(0, cu);
        anat(j[0], cu * 80, (f === 1 ? 0.15 : f === 0 ? 1 : 0.85 + f * 0.1) * sp * 16 - (f === 1 ? 0 : 3), 0, b[j[0]].quaternion);
        anat(j[1], Math.pow(cp, 1.5) * 95, 0, 0, b[j[1]].quaternion);
        anat(j[2], Math.pow(cp, 1.7) * 60, 0, 0, b[j[2]].quaternion);
      }
      const tc = c[o + A.CURL], ts = c[o + A.SPR];
      anat(C.thumb[0], tc * 30, 8 + ts * 30, 0, b[C.thumb[0]].quaternion);
      anat(C.thumb[1], Math.max(0, tc) * 42, 0, 0, b[C.thumb[1]].quaternion);
      anat(C.thumb[2], Math.max(0, tc) * 55, 0, 0, b[C.thumb[2]].quaternion);
    }
    // legs; a foot whose heel or toe tip still ends up under the floor is raised and solved again
    for (let s = 0; s < 2; s++) {
      legIK(P, s, st.feet[s].toe);
      const cr = P.crel[s], low = Math.min(cr[0], cr[1], cr[2]);
      if (low < -0.0001) { P.ankle[s].y += -low + 0.0003; legIK(P, s, st.feet[s].toe); }
    }
  }

  // full FK for every bone (used by the harness and for glow positions)
  function fkAll(P) { for (let i = 0; i < NB; i++) fk(P, i); }

  return { anat, setupPerformer, applyPose, fk, fkAll, pointOf, armDirection, S, PARENT, REST_LOCAL, TRUNK_IDX };
}
