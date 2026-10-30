// skeleton.js: single source of truth for the soloist's skeleton. OWNER: integrator (do not edit in builder agents).
// Units: meters. Y up. Figure stands on y=0 at the origin facing +Z. Figure's LEFT = +X, RIGHT = -X.
// Rest pose = A-pose (arms 50 deg below horizontal, palms facing the thighs, thumbs forward), legs slightly apart.
// Every bone's REST local rotation is IDENTITY, so in rest every bone frame equals the world frame and the
// anatomical axes below (given in rest world coordinates) are valid local-space rotation axes for that bone.
//
// Anatomical angle conventions (degrees, positive values), used by jointQuat():
//   spine/neck/head/pelvis: flex = bend forward, abd = bend to figure's left, twist = turn to figure's left
//   clavicle:  flex = protraction (shoulder forward), abd = elevation (shrug)
//   upperarm:  flex = raise forward, abd = raise sideways away from body, twist = external rotation
//   forearm:   flex = elbow bend, twist = supination (palm turns forward/up)
//   hand:      flex = wrist flexion toward palm, abd = radial deviation (toward thumb side)
//   fingers:   flex = curl toward palm, abd = spread away from the middle finger
//   thumb:     flex = curl across the palm, abd = away from the index finger
//   thigh:     flex = knee forward/up, abd = leg out to the side, twist = external rotation (turn-out)
//   shin:      flex = knee bend (heel goes back)
//   foot:      flex = dorsiflexion (toes up; negative = pointing), abd = inversion (sole turns inward)
//   toes:      flex = extension (toes bend up relative to the foot; used in releve)

const D2R = Math.PI / 180;
const A = 50 * D2R; // arm angle below horizontal in rest
const ca = Math.cos(A), sa = Math.sin(A);

function add(p, d, s) { return [p[0] + d[0] * s, p[1] + d[1] * s, p[2] + d[2] * s]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function rotAbout(v, axis, ang) { // Rodrigues
  const k = norm(axis), c = Math.cos(ang), s = Math.sin(ang);
  const kxv = cross(k, v), kdv = dot(k, v);
  return [v[0] * c + kxv[0] * s + k[0] * kdv * (1 - c), v[1] * c + kxv[1] * s + k[1] * kdv * (1 - c), v[2] * c + kxv[2] * s + k[2] * kdv * (1 - c)];
}

const B = []; // {name, parent, head, tail, flexDir, abdDir, twistRef, twistDir, limits:{flex,abd,twist}}
function bone(name, parent, head, tail, o = {}) { B.push({ name, parent, head, tail, ...o }); }
const LIM = (f, a, t) => ({ flex: f, abd: a, twist: t });

// ---- trunk
const UP = [0, 1, 0], FWD = [0, 0, 1], LEFT = [1, 0, 0];
const TRUNK = { flexDir: FWD, abdDir: LEFT, twistRef: FWD, twistDir: LEFT };
bone('root', null, [0, 0, 0], [0, 0.1, 0], { ...TRUNK, limits: LIM([0, 0], [0, 0], [0, 0]) });
bone('pelvis', 'root', [0, 0.96, 0.0], [0, 1.08, 0.0], { ...TRUNK, limits: LIM([-30, 40], [-20, 20], [-40, 40]) });
const spineY = [1.03, 1.10, 1.18, 1.26, 1.34, 1.42], spineZ = [-0.03, -0.036, -0.042, -0.046, -0.044, -0.036];
const spineLim = [LIM([-10, 14], [-7, 7], [-4, 4]), LIM([-10, 14], [-7, 7], [-5, 5]), LIM([-8, 12], [-7, 7], [-7, 7]),
  LIM([-6, 10], [-6, 6], [-8, 8]), LIM([-6, 9], [-6, 6], [-8, 8]), LIM([-6, 9], [-6, 6], [-7, 7])];
for (let i = 0; i < 6; i++) {
  const n = 'spine0' + (i + 1), next = i < 5 ? [0, spineY[i + 1], spineZ[i + 1]] : [0, 1.47, -0.028];
  bone(n, i === 0 ? 'pelvis' : 'spine0' + i, [0, spineY[i], spineZ[i]], next, { ...TRUNK, limits: spineLim[i] });
}
bone('neck01', 'spine06', [0, 1.47, -0.028], [0, 1.53, -0.018], { ...TRUNK, limits: LIM([-25, 25], [-20, 20], [-35, 35]) });
bone('neck02', 'neck01', [0, 1.53, -0.018], [0, 1.585, -0.008], { ...TRUNK, limits: LIM([-25, 25], [-20, 20], [-35, 35]) });
bone('head', 'neck02', [0, 1.585, -0.008], [0, 1.72, 0.0], { ...TRUNK, limits: LIM([-25, 25], [-15, 15], [-30, 30]) });

// ---- arms (side s = +1 left, -1 right)
function arm(sfx, s) {
  const out = [s, 0, 0];
  const d = [s * ca, -sa, 0];                        // arm direction in rest
  const palm = [-s * sa, -ca, 0];                    // palm normal (faces the thigh: down-in)
  const sc = [s * 0.02, 1.43, 0.07], sh = [s * 0.18, 1.42, -0.02];
  const el = add(sh, d, 0.29), wr = add(el, d, 0.25);
  bone('clavicle' + sfx, 'spine06', sc, sh, { flexDir: FWD, abdDir: UP, twistRef: FWD, twistDir: out, limits: LIM([-10, 20], [-8, 25], [0, 0]) });
  bone('upperarm' + sfx, 'clavicle' + sfx, sh, el, { flexDir: FWD, abdDir: UP, twistRef: FWD, twistDir: out, limits: LIM([-50, 170], [-40, 130], [-80, 80]) });
  bone('forearm' + sfx, 'upperarm' + sfx, el, wr, { flexDir: FWD, abdDir: UP, twistRef: palm, twistDir: FWD, limits: LIM([0, 145], [0, 0], [-80, 80]) });
  const knuckle = add(wr, d, 0.09);
  bone('hand' + sfx, 'forearm' + sfx, wr, knuckle, { flexDir: palm, abdDir: FWD, twistRef: FWD, twistDir: out, limits: LIM([-70, 80], [-20, 30], [-10, 10]) });
  // fingers fan in the plane spanned by d and +Z; index is the front-most (+Z) finger
  const F = [ // name, mcp offset along d, z offset, fan angle (deg toward +Z), phalanx lengths, spread direction
    ['index', 0.088, 0.025, 6, [0.045, 0.026, 0.022], FWD],
    ['middle', 0.090, 0.005, 0, [0.049, 0.030, 0.023], FWD],
    ['ring', 0.085, -0.015, -5, [0.046, 0.028, 0.022], [0, 0, -1]],
    ['pinky', 0.078, -0.033, -11, [0.036, 0.021, 0.020], [0, 0, -1]],
  ];
  for (const [fn, off, z, fan, L, spread] of F) {
    let p = add(add(wr, d, off), FWD, z);
    const fd = norm(rotAbout(d, cross(d, FWD), fan * D2R)); // positive fan tilts the finger toward +Z
    for (let k = 0; k < 3; k++) {
      const q = add(p, fd, L[k]);
      const lim = k === 0 ? LIM([-20, 90], [-20, 20], [0, 0]) : k === 1 ? LIM([0, 105], [0, 0], [0, 0]) : LIM([-5, 80], [0, 0], [0, 0]);
      bone(`${fn}0${k + 1}${sfx}`, k === 0 ? 'hand' + sfx : `${fn}0${k}${sfx}`, p, q, { flexDir: palm, abdDir: spread, twistRef: palm, twistDir: FWD, limits: lim });
      p = q;
    }
  }
  // thumb: base near the wrist, angled forward (+Z) and slightly toward the palm
  let tp = add(add(add(wr, d, 0.022), FWD, 0.022), palm, 0.012);
  const td = norm(add(add(scale(d, 0.75), FWD, 0.6), palm, 0.25));
  const TL = [0.045, 0.032, 0.027];
  for (let k = 0; k < 3; k++) {
    const q = add(tp, td, TL[k]);
    const lim = k === 0 ? LIM([-20, 50], [-15, 50], [0, 0]) : k === 1 ? LIM([0, 60], [0, 0], [0, 0]) : LIM([-10, 80], [0, 0], [0, 0]);
    bone(`thumb0${k + 1}${sfx}`, k === 0 ? 'hand' + sfx : `thumb0${k}${sfx}`, tp, q,
      { flexDir: norm(add(palm, [0, 0, -1], 0.6)), abdDir: norm(add(scale(palm, -1), FWD, 0.5)), twistRef: palm, twistDir: FWD, limits: lim });
    tp = q;
  }
}
arm('_L', 1); arm('_R', -1);

// ---- legs
function leg(sfx, s) {
  const out = [s, 0, 0], inn = [-s, 0, 0];
  const hip = [s * 0.09, 0.91, 0.0], knee = [s * 0.10, 0.49, 0.012], ankle = [s * 0.105, 0.075, -0.012];
  const ball = [s * 0.112, 0.022, 0.13], tip = [s * 0.112, 0.016, 0.19];
  bone('thigh' + sfx, 'pelvis', hip, knee, { flexDir: FWD, abdDir: out, twistRef: FWD, twistDir: out, limits: LIM([-25, 120], [-25, 45], [-40, 50]) });
  bone('shin' + sfx, 'thigh' + sfx, knee, ankle, { flexDir: [0, 0, -1], abdDir: out, twistRef: FWD, twistDir: out, limits: LIM([0, 150], [0, 0], [-10, 10]) });
  bone('foot' + sfx, 'shin' + sfx, ankle, ball, { flexDir: UP, abdDir: inn, twistRef: UP, twistDir: out, limits: LIM([-50, 25], [-20, 20], [-5, 5]) });
  bone('toes' + sfx, 'foot' + sfx, ball, tip, { flexDir: UP, abdDir: inn, twistRef: UP, twistDir: out, limits: LIM([-30, 60], [0, 0], [0, 0]) });
}
leg('_L', 1); leg('_R', -1);

// ---- derive axes. For a bone with direction d (head->tail):
// flexAxis = normalize(d x perp(flexDir)), so rotating +angle moves the tail toward flexDir. Same for abd.
// twistAxis = +-d, signed so that rotating +angle moves twistRef toward twistDir.
function perp(v, d) { return sub(v, scale(d, dot(v, d))); }
for (const b of B) {
  const d = norm(sub(b.tail, b.head));
  b.dir = d;
  b.length = len(sub(b.tail, b.head));
  b.flexAxis = norm(cross(d, perp(b.flexDir, d)));
  b.abdAxis = norm(cross(d, perp(b.abdDir, d)));
  const tr = perp(b.twistRef, d);
  b.twistAxis = dot(cross(d, tr), b.twistDir) >= 0 ? d : scale(d, -1);
}

export const BONES = B.map(b => ({
  name: b.name, parent: b.parent, head: b.head, tail: b.tail, dir: b.dir, length: b.length,
  axes: { flex: b.flexAxis, abd: b.abdAxis, twist: b.twistAxis }, limits: b.limits,
}));
export const BONE_INDEX = Object.fromEntries(BONES.map((b, i) => [b.name, i]));
export const BONE_BY_NAME = Object.fromEntries(BONES.map(b => [b.name, b]));
export const HEIGHT = 1.72;
export const SPINE_CHAIN = ['pelvis', 'spine01', 'spine02', 'spine03', 'spine04', 'spine05', 'spine06', 'neck01', 'neck02', 'head'];
export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
export const SIDES = ['_L', '_R'];

// Landmarks for imagery (rest world positions). Lena: a point inside the body a few cm below the navel.
// Each landmark: { bone, offset (bone-local meters, valid because rest rotations are identity), rest (world point in rest) }.
// Lena: engine between navel and groin. Biba: sit bones + sacrum (lengthening away from the sit bones).
// Lunas: fleshy pads at the base of the fingers (palm side) and the balls of the feet.
export const LANDMARKS = {};
function mark(name, boneName, offset) {
  const h = BONE_BY_NAME[boneName].head;
  LANDMARKS[name] = { bone: boneName, offset, rest: [h[0] + offset[0], h[1] + offset[1], h[2] + offset[2]] };
}
mark('lena', 'pelvis', [0, 0.03, 0.04]);
mark('sacrum', 'pelvis', [0, -0.01, -0.09]);
mark('sitbone_L', 'pelvis', [0.055, -0.10, -0.06]);
mark('sitbone_R', 'pelvis', [-0.055, -0.10, -0.06]);
mark('navel', 'spine01', [0, 0.03, 0.13]);
mark('sternum', 'spine05', [0, -0.02, 0.154]);
mark('crown', 'head', [0, 0.13, 0.01]);
for (const [sfx, s] of [['_L', 1], ['_R', -1]]) {
  const palm = [-s * sa, -ca, 0], d = [s * ca, -sa, 0];
  for (const f of ['index', 'middle', 'ring', 'pinky']) mark(`luna_${f}${sfx}`, `${f}01${sfx}`, add(scale(palm, 0.009), d, 0.004));
  mark(`luna_thumb${sfx}`, `thumb01${sfx}`, scale(palm, 0.012));
  mark(`football${sfx}`, `toes${sfx}`, [0, -0.012, -0.005]);
  mark(`heel${sfx}`, `foot${sfx}`, [0, -0.06, -0.065]);
}

// Builds THREE.Bone objects with rest local positions (head - parent head) and identity rotations.
export function buildSkeleton(THREE) {
  const bones = BONES.map(b => { const o = new THREE.Bone(); o.name = b.name; return o; });
  BONES.forEach((b, i) => {
    const p = b.parent ? BONE_BY_NAME[b.parent] : null;
    const h = p ? sub(b.head, p.head) : b.head;
    bones[i].position.set(h[0], h[1], h[2]);
    if (p) bones[BONE_INDEX[b.parent]].add(bones[i]);
  });
  const byName = Object.fromEntries(bones.map(o => [o.name, o]));
  return { bones, byName, root: bones[0], skeleton: new THREE.Skeleton(bones) };
}

// Anatomical rotation -> local quaternion (degrees in, clamped to limits unless clamp=false).
// Applied order: twist, then abduction, then flexion (q = qFlex * qAbd * qTwist).
const _tmp = {};
export function jointQuat(THREE, name, flex = 0, abd = 0, twist = 0, out = new THREE.Quaternion(), clamp = true) {
  const b = BONE_BY_NAME[name];
  if (clamp) {
    const L = b.limits;
    flex = Math.min(L.flex[1], Math.max(L.flex[0], flex));
    abd = Math.min(L.abd[1], Math.max(L.abd[0], abd));
    twist = Math.min(L.twist[1], Math.max(L.twist[0], twist));
  }
  const ax = b.axes;
  const qf = (_tmp.qf ||= new THREE.Quaternion()), qa = (_tmp.qa ||= new THREE.Quaternion()), qt = (_tmp.qt ||= new THREE.Quaternion());
  const v = (_tmp.v ||= new THREE.Vector3());
  qf.setFromAxisAngle(v.set(...ax.flex), flex * D2R);
  qa.setFromAxisAngle(v.set(...ax.abd), abd * D2R);
  qt.setFromAxisAngle(v.set(...ax.twist), twist * D2R);
  return out.copy(qf).multiply(qa).multiply(qt);
}
