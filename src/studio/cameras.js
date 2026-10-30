// cameras.js: orbit, walk, join (first person beside the soloist) and director. OWNER: builder B.
// Every mode produces a target pose; the rig eases between poses on mode changes. The director cuts on purpose.
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VOCAB } from '../vocab.js';
import { BONE_BY_NAME } from '../skeleton.js';

const MODES = ['orbit', 'walk', 'join', 'director'];
const EYE = 1.62;
const VOCAB_BY_ID = Object.fromEntries((VOCAB || []).map((v) => [v.id, v]));

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (dt, tc) => 1 - Math.exp(-dt / Math.max(1e-4, tc));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Director shot library. d: distance [start, end]; h: camera height [start, end] (absolute, or relative to the
// subject when rel is true); fov [start, end]; hold [min, max] seconds; follow/anchor: smoothing time constants.
const SHOTS = {
  wide: { bone: 'spine03', d: [6.4, 5.3], h: [1.5, 1.38], fov: [40, 38], hold: [9, 12], drift: 0.16, follow: 0.6, anchor: 2.0 },
  wideOut: { bone: 'spine03', d: [4.6, 6.0], h: [1.25, 1.55], fov: [38, 40], hold: [9, 12], drift: -0.12, follow: 0.6, anchor: 2.0 },
  full: { bone: 'spine02', d: [3.7, 3.3], h: [1.0, 1.18], fov: [34, 33], hold: [7, 10], drift: 0.1, follow: 0.45, anchor: 1.4 },
  pelvis: { bone: 'pelvis', d: [2.0, 1.72], h: [0.95, 1.02], fov: [30, 29], hold: [6, 9], drift: 0.08, follow: 0.3, anchor: 1.0, look: [0, 0.02, 0] },
  hand: { bone: 'hand', d: [0.98, 0.82], h: [0.1, 0.06], rel: true, fov: [29, 28], hold: [6, 8], drift: 0.1, follow: 0.16, anchor: 0.55, dof: 0.8 },
  spineBack: { bone: 'spine04', d: [1.95, 1.65], h: [1.42, 1.32], fov: [32, 31], hold: [7, 10], drift: 0.06, follow: 0.35, anchor: 1.1, rel: false, facing: 'back' },
  spineProfile: { bone: 'spine04', d: [2.1, 1.85], h: [1.36, 1.3], fov: [32, 31], hold: [7, 10], drift: 0.06, follow: 0.35, anchor: 1.1, facing: 'side' },
  feet: { bone: 'feet', d: [1.75, 1.45], h: [0.26, 0.3], fov: [36, 35], hold: [6, 9], drift: 0.1, follow: 0.3, anchor: 1.0, look: [0, 0.14, 0], dof: 0.6 },
  flesh: { bone: 'spine04', d: [2.4, 2.2], h: [1.46, 1.42], fov: [33, 32], hold: [6, 9], drift: 0.05, follow: 0.4, anchor: 1.2, handheld: 1 },
  arms: { bone: 'spine05', d: [2.9, 2.55], h: [1.52, 1.46], fov: [36, 35], hold: [7, 10], drift: 0.1, follow: 0.4, anchor: 1.2 },
  head: { bone: 'head', d: [1.45, 1.25], h: [0.06, 0.04], rel: true, fov: [28, 27], hold: [6, 8], drift: 0.07, follow: 0.25, anchor: 0.9, look: [0, 0.04, 0], dof: 0.6 },
};
// Study views (training layer). az: degrees around the soloist relative to their facing (0 front, +90 their left,
// -90 their right, which is the sunlit side when they face the room). y: absolute camera height, or rel: height above
// the bone. alt: alternative azimuth when the first does not fit in the room. close views get a shallow focus hint.
const STUDY = {
  front: { label: 'Front', bone: 'spine03', az: 0, alt: 15, dist: 3.7, y: 1.2, fov: 36 },
  side: { label: 'Side', bone: 'spine03', az: -90, alt: 90, dist: 3.3, y: 1.2, fov: 36 },
  back: { label: 'Back', bone: 'spine03', az: 180, alt: 165, dist: 3.6, y: 1.25, fov: 36 },
  three: { label: 'Three quarter', bone: 'spine03', az: -40, alt: 40, dist: 3.5, y: 1.45, fov: 36 },
  hands: { label: 'Hands', bone: 'hand_R', az: -35, alt: 30, dist: 0.95, rel: 0.12, fov: 30, close: true, dof: 1, follow: 0.16 },
  feet: { label: 'Feet', bone: 'feet', az: -25, alt: 25, dist: 1.45, y: 0.32, fov: 32, close: true, dof: 1, look: [0, 0.07, 0], follow: 0.25 },
  spine: { label: 'Spine', bone: 'spine04', az: 160, alt: -160, dist: 1.9, y: 1.38, fov: 34, follow: 0.3 },
  pelvis: { label: 'Pelvis', bone: 'pelvis', az: -30, alt: 30, dist: 2.0, y: 1.0, fov: 32, follow: 0.3 },
  overhead: { label: 'Overhead', bone: 'pelvis', az: 0, alt: 180, dist: 1.1, y: 4.3, fov: 50 },
};
const DEG = Math.PI / 180;
const REGION_SHOT = { center: ['pelvis'], pelvis: ['pelvis'], hands: ['hand'], arms: ['arms'], spine: ['spineBack', 'spineProfile'], feet: ['feet'], legs: ['full', 'feet'], flesh: ['flesh'], head: ['head', 'arms'] };

export function createCameraRig(THREE, { camera, dom, studio } = {}) {
  const V3 = THREE.Vector3, Q = THREE.Quaternion;
  const B = studio.bounds, CEIL = (studio.ceilingY ?? 5) - 0.25, MARGIN = 0.25;
  const spot = studio.soloistSpot ? studio.soloistSpot.clone() : new V3();
  const baseFov = camera.fov;
  const listeners = { mode: new Set() };
  const emit = (ev, v) => listeners[ev] && listeners[ev].forEach((cb) => { try { cb(v); } catch (e) { console.error(e); } });

  let mode = 'orbit', time = 0;
  let soloist = null, participant = null, activity = null;
  const out = { pos: camera.position.clone(), quat: camera.quaternion.clone(), fov: camera.fov };
  const want = { pos: new V3(), quat: new Q(), fov: baseFov };
  const trans = { active: false, t: 0, dur: 1.2, pos: new V3(), quat: new Q(), fov: baseFov };
  const _v = new V3(), _v2 = new V3(), _q = new Q(), _m = new THREE.Matrix4(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
  const UP = new V3(0, 1, 0);

  // ---- helpers
  function bonePos(name, target) {
    if (name === 'feet') {
      bonePos('foot_L', target); bonePos('foot_R', _v2); return target.add(_v2).multiplyScalar(0.5);
    }
    const b = soloist && soloist.byName && soloist.byName[name];
    if (b) return b.getWorldPosition(target);
    const r = BONE_BY_NAME[name];
    if (r) {
      target.set(r.head[0], r.head[1], r.head[2]);
      if (soloist && soloist.object3d) return soloist.object3d.localToWorld(target);
      return target.add(spot);
    }
    return target.copy(spot).setY(1.2);
  }
  function facingAz() { // world azimuth (x,z plane) of the soloist's chest forward
    const b = soloist && soloist.byName && (soloist.byName.spine03 || soloist.byName.pelvis);
    const f = _v.set(0, 0, 1);
    if (b) f.applyQuaternion(b.getWorldQuaternion(_q));
    else if (soloist && soloist.object3d) f.applyQuaternion(soloist.object3d.getWorldQuaternion(_q));
    return Math.atan2(f.z, f.x);
  }
  function lookQuat(from, to, out) {
    _m.lookAt(from, to, UP);
    return out.setFromRotationMatrix(_m);
  }
  function clampRoom(p, m = MARGIN) {
    p.x = Math.min(B.maxX - m, Math.max(B.minX + m, p.x));
    p.z = Math.min(B.maxZ - m, Math.max(B.minZ + m, p.z));
    p.y = Math.min(CEIL, Math.max(0.12, p.y));
    return p;
  }
  function insideRoom(p, m = 0.4) {
    return p.x > B.minX + m && p.x < B.maxX - m && p.z > B.minZ + m && p.z < B.maxZ - m && p.y > 0.1 && p.y < CEIL;
  }
  function inObstacle(p, pad = 0.2) {
    return (studio.obstacles || []).some((o) => p.x > o.minX - pad && p.x < o.maxX + pad && p.z > o.minZ - pad && p.z < o.maxZ + pad && p.y < 1.5);
  }
  function soloistXZ(target) { return bonePos('pelvis', target).setY(0); }

  // ---- orbit -----------------------------------------------------------
  const proxy = camera.clone();
  const orbit = new OrbitControls(proxy, dom);
  orbit.enableDamping = true; orbit.dampingFactor = 0.075; orbit.enablePan = false;
  orbit.minDistance = 1.2; orbit.maxDistance = 9; orbit.rotateSpeed = 0.55; orbit.zoomSpeed = 0.8;
  orbit.minPolarAngle = 0.15; orbit.maxPolarAngle = Math.PI * 0.58;
  orbit.autoRotate = false; orbit.autoRotateSpeed = 0;
  let focusBone = 'spine05', lastInteract = 0, driftAmt = 0, driftDir = 1, focusDist = null;
  let studyState = null, follow = false, orbitFov = baseFov, fovCur = baseFov, dofWant = 0, dofCur = 0, restoreMin = false;
  const focusOffset = new V3(), _v3 = new V3(), _v4 = new V3();
  orbit.addEventListener('start', () => { lastInteract = time; driftAmt = 0; focusDist = null; });
  orbit.addEventListener('end', () => { lastInteract = time; });
  {
    const t0 = bonePos('spine05', new V3());
    orbit.target.copy(t0);
    proxy.position.copy(t0).add(new V3(3.25, 0.25, 3.7));
    proxy.lookAt(orbit.target);
    orbit.update();
    // start the rig (and the camera) at the orbit framing so any first mode change eases from a real pose
    out.pos.copy(proxy.position); out.quat.copy(proxy.quaternion);
    camera.position.copy(out.pos); camera.quaternion.copy(out.quat); camera.updateMatrixWorld();
  }
  function orbitPose(dt) {
    const tgt = bonePos(focusBone, _v).add(focusOffset);
    const prev = _v3.copy(orbit.target);
    orbit.target.lerp(tgt, damp(dt, studyState ? (studyState.def.follow || 0.4) : 0.45));
    if (follow) proxy.position.add(_v4.subVectors(orbit.target, prev)); // keep the study framing on a moving bone
    const idle = time - lastInteract;
    driftAmt = idle > 8 && !studyState ? Math.min(1, driftAmt + dt / 3) : 0;
    orbit.autoRotate = driftAmt > 0;
    orbit.autoRotateSpeed = 0.32 * driftAmt * driftDir;
    if (focusDist !== null) {
      const off = _v2.copy(proxy.position).sub(orbit.target);
      const d = off.length(), nd = d + (focusDist - d) * damp(dt, 0.6);
      off.setLength(nd); proxy.position.copy(orbit.target).add(off);
      if (Math.abs(nd - focusDist) < 0.02) { focusDist = null; if (restoreMin) { orbit.minDistance = 1.2; restoreMin = false; } }
    }
    orbit.update(dt);
    const before = _v2.copy(proxy.position);
    clampRoom(proxy.position, MARGIN + 0.1);
    if (driftAmt > 0 && before.distanceToSquared(proxy.position) > 1e-6) driftDir *= -1;
    proxy.lookAt(orbit.target);
    fovCur += (orbitFov - fovCur) * damp(dt, 0.5);
    want.pos.copy(proxy.position); want.quat.copy(proxy.quaternion); want.fov = fovCur;
  }
  function studyCamPos(def, tgt, outPos) {
    const phi = facingAz(), fx = Math.cos(phi), fz = Math.sin(phi), lx = fz, lz = -fx;
    const azs = [def.az, def.alt, -def.az].filter((a) => a !== undefined);
    for (const k of [1, 0.85, 0.7]) for (const azd of azs) {
      const a = azd * DEG, dx = fx * Math.cos(a) + lx * Math.sin(a), dz = fz * Math.cos(a) + lz * Math.sin(a);
      outPos.set(tgt.x + dx * def.dist * k, def.rel !== undefined ? tgt.y + def.rel : def.y, tgt.z + dz * def.dist * k);
      if (insideRoom(outPos, 0.35) && !inObstacle(outPos)) return outPos;
    }
    return clampRoom(outPos, 0.35);
  }
  function leaveStudy() {
    if (!studyState) return;
    studyState = null; follow = false; orbitFov = baseFov; dofWant = 0;
    if (proxy.position.distanceTo(orbit.target) < 1.2) { focusDist = 1.6; restoreMin = true; } else orbit.minDistance = 1.2;
  }
  function study(id) {
    const def = STUDY[id];
    if (!def) return;
    let modeChanged = false;
    if (mode !== 'orbit') {
      mode = 'orbit'; orbit.enabled = true; modeChanged = true;
      if (document.pointerLockElement === dom && document.exitPointerLock) document.exitPointerLock();
    }
    focusBone = def.bone; focusDist = null; restoreMin = false;
    focusOffset.set(...(def.look || [0, 0, 0]));
    orbit.minDistance = def.close ? 0.5 : 1.2;
    bonePos(def.bone, orbit.target).add(focusOffset);
    studyCamPos(def, orbit.target, proxy.position);
    proxy.lookAt(orbit.target); orbit.update();
    orbitFov = def.fov; dofWant = def.dof || 0;
    studyState = { id, def }; follow = true;
    lastInteract = time; driftAmt = 0;
    beginTransition(1.2);
    if (modeChanged) emit('mode', 'orbit');
    emit('study', id);
  }

  // ---- walk ------------------------------------------------------------
  const walk = { pos: new V3(), yaw: 0, pitch: 0, vel: new V3(), keys: new Set(), drag: false, lx: 0, ly: 0, locked: false, touches: new Map(), joy: { x: 0, y: 0 }, bob: 0 };
  const KEYMAP = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run' };
  const editable = (el) => el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));
  const onKey = (down) => (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    if (down && (e.metaKey || e.ctrlKey || e.altKey || editable(e.target))) return;
    if (down) walk.keys.add(k); else walk.keys.delete(k);
    if (mode === 'walk' && down && e.code.startsWith('Arrow')) e.preventDefault();
  };
  const kd = onKey(true), ku = onKey(false), blur = () => walk.keys.clear();
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur);
  const look = (dx, dy, k = 0.0032) => {
    walk.yaw -= dx * k; walk.pitch = Math.max(-1.25, Math.min(1.25, walk.pitch - dy * k));
  };
  const onDown = (e) => {
    if (mode !== 'walk') return;
    if (e.pointerType === 'touch') {
      walk.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      if (walk.touches.size === 2) { const c = centroid(); walk.joy0 = c; }
    } else if (e.button === 0) { walk.drag = true; walk.lx = e.clientX; walk.ly = e.clientY; }
    try { dom.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
  };
  const centroid = () => { let x = 0, y = 0; walk.touches.forEach((t) => { x += t.x; y += t.y; }); const n = Math.max(1, walk.touches.size); return { x: x / n, y: y / n }; };
  const onMove = (e) => {
    if (mode !== 'walk') return;
    if (walk.locked) { look(e.movementX || 0, e.movementY || 0, 0.0024); return; }
    if (e.pointerType === 'touch') {
      const t = walk.touches.get(e.pointerId); if (!t) return;
      const dx = e.clientX - t.x, dy = e.clientY - t.y; t.x = e.clientX; t.y = e.clientY;
      if (walk.touches.size === 1) look(dx, dy, 0.005);
      else if (walk.touches.size === 2 && walk.joy0) {
        const c = centroid();
        walk.joy.x = Math.max(-1, Math.min(1, (c.x - walk.joy0.x) / 70));
        walk.joy.y = Math.max(-1, Math.min(1, (c.y - walk.joy0.y) / 70));
      }
      return;
    }
    if (walk.drag) { look(e.clientX - walk.lx, e.clientY - walk.ly); walk.lx = e.clientX; walk.ly = e.clientY; }
  };
  const onUp = (e) => {
    if (e.pointerType === 'touch') {
      walk.touches.delete(e.pointerId);
      if (walk.touches.size < 2) { walk.joy.x = 0; walk.joy.y = 0; walk.joy0 = null; }
    } else walk.drag = false;
  };
  const onDbl = () => {
    if (mode !== 'walk' || !dom.requestPointerLock) return;
    try { const p = dom.requestPointerLock(); if (p && p.catch) p.catch(() => { walk.locked = false; }); } catch (_) { walk.locked = false; }
  };
  const onLockChange = () => { walk.locked = document.pointerLockElement === dom; };
  const onLockError = () => { walk.locked = false; };
  dom.addEventListener('pointerdown', onDown); dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp); dom.addEventListener('pointercancel', onUp); dom.addEventListener('dblclick', onDbl);
  document.addEventListener('pointerlockchange', onLockChange); document.addEventListener('pointerlockerror', onLockError);

  function collide(p) {
    p.x = Math.min(B.maxX - 0.35, Math.max(B.minX + 0.35, p.x));
    p.z = Math.min(B.maxZ - 0.35, Math.max(B.minZ + 0.35, p.z));
    const s = soloistXZ(_v2), dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz);
    if (d < 0.6) { const k = d > 1e-4 ? 0.6 / d : 1; p.x = s.x + (d > 1e-4 ? dx * k : 0.6); p.z = s.z + (d > 1e-4 ? dz * k : 0); }
    for (const o of studio.obstacles || []) {
      const pad = 0.25;
      if (p.x > o.minX - pad && p.x < o.maxX + pad && p.z > o.minZ - pad && p.z < o.maxZ + pad) {
        const pushes = [[o.minX - pad - p.x, 0], [o.maxX + pad - p.x, 0], [0, o.minZ - pad - p.z], [0, o.maxZ + pad - p.z]];
        pushes.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        p.x += pushes[0][0]; p.z += pushes[0][1];
      }
    }
    return p;
  }
  function enterWalk() {
    walk.pos.copy(out.pos).setY(0); collide(walk.pos);
    const f = _v.set(0, 0, -1).applyQuaternion(out.quat);
    walk.yaw = Math.atan2(-f.x, -f.z);
    walk.pitch = Math.max(-0.35, Math.min(0.35, Math.asin(Math.max(-1, Math.min(1, f.y)))));
    walk.vel.set(0, 0, 0);
  }
  function walkPose(dt) {
    let fwd = 0, side = 0;
    if (walk.keys.has('f')) fwd += 1; if (walk.keys.has('b')) fwd -= 1;
    if (walk.keys.has('r')) side += 1; if (walk.keys.has('l')) side -= 1;
    fwd -= walk.joy.y; side += walk.joy.x;
    const len = Math.hypot(fwd, side); if (len > 1) { fwd /= len; side /= len; }
    const speed = walk.keys.has('run') ? 2.4 : 1.35;
    const sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw);
    const tx = (-sy * fwd + cy * side) * speed, tz = (-cy * fwd - sy * side) * speed;
    const k = damp(dt, 0.18);
    walk.vel.x += (tx - walk.vel.x) * k; walk.vel.z += (tz - walk.vel.z) * k;
    walk.pos.x += walk.vel.x * dt; walk.pos.z += walk.vel.z * dt;
    collide(walk.pos);
    const sp = Math.hypot(walk.vel.x, walk.vel.z);
    walk.bob += dt * sp * 5.2;
    want.pos.set(walk.pos.x, EYE + Math.sin(walk.bob) * 0.012 * Math.min(1, sp), walk.pos.z);
    want.quat.setFromEuler(_e.set(walk.pitch, walk.yaw, Math.sin(walk.bob * 0.5) * 0.004 * Math.min(1, sp), 'YXZ'));
    want.fov = baseFov + 4;
  }

  // ---- join: first person from the participant's head --------------------
  const join = { pos: new V3(), quat: new Q(), init: false };
  const FLIP = new Q().setFromAxisAngle(new V3(0, 1, 0), Math.PI), FLIP_INV = FLIP.clone().invert();
  const ID = new Q();
  function joinPose(dt) {
    const eye = _v, delta = _q.identity();
    const head = participant && participant.byName && participant.byName.head;
    if (head) {
      head.updateWorldMatrix(true, false);
      const hq = new Q(); head.getWorldQuaternion(hq);
      eye.set(0, 0.085, 0.125).applyQuaternion(hq).add(head.getWorldPosition(_v2));
      const base = new Q();
      if (participant.object3d) participant.object3d.getWorldQuaternion(base);
      const rel = base.invert().multiply(hq);                 // head motion in the body frame
      const relCam = FLIP_INV.clone().multiply(rel).multiply(FLIP); // same motion in camera axes
      delta.copy(ID).slerp(relCam, 0.35);
    } else {
      const p = studio.participantSpot || spot;
      eye.set(p.x + Math.sin(time * 0.7) * 0.03, EYE + Math.sin(time * 1.3) * 0.015, p.z + Math.sin(time * 0.5) * 0.03);
      delta.setFromEuler(_e.set(Math.sin(time * 0.6) * 0.03, Math.sin(time * 0.4) * 0.05, Math.sin(time * 0.5) * 0.02, 'YXZ'));
    }
    const tgt = bonePos('spine05', new V3());
    tgt.y = tgt.y * 0.75 + bonePos('head', _v2).y * 0.25;
    const stable = lookQuat(eye, tgt, new Q());
    const desired = stable.multiply(delta);
    if (!join.init) { join.pos.copy(eye); join.quat.copy(desired); join.init = true; }
    join.pos.lerp(eye, damp(dt, 0.06));
    join.quat.slerp(desired, damp(dt, 0.12));
    want.pos.copy(join.pos); want.quat.copy(join.quat); want.fov = baseFov + 12;
  }

  // ---- director -----------------------------------------------------------
  const dir = { shot: null, t: 0, hold: 8, subj: new V3(), anchor: new V3(), history: [], az: 0, n: 0, seed: Math.random() * 100 };
  function regionScores() {
    const r = (activity && activity.regions) || {};
    const s = {};
    for (const k of Object.keys(REGION_SHOT)) s[k] = Number(r[k]) || 0;
    const v = activity && activity.dominant && VOCAB_BY_ID[activity.dominant];
    if (v) {
      const bump = { center: 'center', pelvis: 'pelvis', spine: 'spine', flesh: 'flesh' }[v.region];
      if (bump) s[bump] += 0.3;
      if (v.region === 'extremities') { s.hands += 0.2; s.feet += 0.15; }
      for (const m of v.bodyMap || []) {
        const k = { lena: 'center', biba: 'pelvis', spine: 'spine', flesh: 'flesh', feet: 'feet', hands: 'hands', head: 'head', luna: 'hands' }[m];
        if (k) s[k] += 0.08;
      }
    }
    return s;
  }
  function chooseKind() {
    const s = regionScores();
    let best = null, bv = 0;
    for (const [k, v] of Object.entries(s)) if (v > bv) { bv = v; best = k; }
    const last = dir.history.slice(-2);
    const wideTurn = dir.n % 4 === 3;
    let kind;
    if (!best || bv < 0.3 || wideTurn) kind = Math.random() < 0.55 ? (Math.random() < 0.5 ? 'wide' : 'wideOut') : 'full';
    else kind = pick(REGION_SHOT[best]);
    if (last.length === 2 && last[0] === kind && last[1] === kind) kind = kind === 'full' ? 'wide' : 'full';
    return kind;
  }
  const windowPref = (az) => { // camera on +X looks toward the windows (silhouette); +-Z keeps them beside the body
    const c = Math.cos(az);
    return c > -0.25 ? 1 + 0.35 * Math.max(0, Math.sin(Math.abs(az) * 2)) : 0.15;
  };
  function shotCam(shot, az, s, subject, target) {
    const d = shot.d[0] + (shot.d[1] - shot.d[0]) * ease(s);
    const h = shot.h[0] + (shot.h[1] - shot.h[0]) * ease(s);
    const a = az + shot.drift * (s - 0.5);
    target.set(subject.x + Math.cos(a) * d, shot.rel ? subject.y + h : h, subject.z + Math.sin(a) * d);
    return target;
  }
  function makeShot(kind) {
    const base = SHOTS[kind];
    const shot = { ...base, kind };
    if (base.bone === 'hand') shot.bone = Math.random() < 0.5 ? 'hand_L' : 'hand_R';
    shot.hold = rnd(base.hold[0], base.hold[1]);
    const subject = bonePos(shot.bone, new V3());
    let cands = [];
    if (base.facing) {
      const f = facingAz();
      const opts = base.facing === 'back' ? [f + Math.PI, f + Math.PI * 0.8, f - Math.PI * 0.8] : [f + Math.PI / 2, f - Math.PI / 2, f + Math.PI * 0.6, f - Math.PI * 0.6];
      cands = opts.map((a) => a + rnd(-0.08, 0.08));
    } else {
      for (let i = 0; i < 14; i++) cands.push(-1.9 + (3.8 * i) / 13 + rnd(-0.1, 0.1));
    }
    let best = null, bestScore = -Infinity;
    for (const az of cands) {
      const p0 = shotCam(shot, az, 0, subject, new V3()), p1 = shotCam(shot, az, 1, subject, new V3());
      if (!insideRoom(p0) || !insideRoom(p1) || inObstacle(p0) || inObstacle(p1)) continue;
      let score = windowPref(az) + Math.random() * 0.35;
      if (dir.shot) {
        const da = Math.abs(Math.atan2(Math.sin(az - dir.az), Math.cos(az - dir.az)));
        score += da > 0.5 ? 0.25 : -0.3; // a cut needs a real change of angle
      }
      if (score > bestScore) { bestScore = score; best = az; }
    }
    if (best === null) { // nothing fits: fall back to a full-body framing toward the room's open side
      const fb = { ...SHOTS.full, kind: 'full', hold: rnd(7, 10) };
      fb.az = Math.atan2(-spot.z, -spot.x) + rnd(-0.3, 0.3);
      return fb;
    }
    shot.az = best;
    return shot;
  }
  function startShot(first) {
    const kind = chooseKind();
    const shot = makeShot(kind);
    const prevPos = out.pos.clone();
    dir.shot = shot; dir.t = 0; dir.hold = shot.hold; dir.az = shot.az; dir.n++;
    dir.history.push(shot.kind); if (dir.history.length > 6) dir.history.shift();
    bonePos(shot.bone, dir.subj); dir.anchor.copy(dir.subj);
    if (first) return; // the mode change already glides in
    const np = shotCam(shot, shot.az, 0, dir.anchor, new V3());
    // glide when close and the path stays clear of the dancer; otherwise cut
    const s = soloistXZ(new V3());
    const seg = np.clone().sub(prevPos), L = seg.length();
    let clear = true;
    for (let i = 1; i < 10; i++) { const p = prevPos.clone().addScaledVector(seg, i / 10); if (Math.hypot(p.x - s.x, p.z - s.z) < 0.9) clear = false; }
    const glide = clear && (L < 2.6 ? Math.random() < 0.7 : Math.random() < 0.3);
    if (glide) beginTransition(L < 2.6 ? 2.6 : 3.6); else trans.active = false;
  }
  function directorPose(dt) {
    if (!dir.shot) startShot(true);
    dir.t += dt;
    if (dir.t > dir.hold) startShot(false);
    const sh = dir.shot, s = Math.min(1, dir.t / dir.hold);
    const bp = bonePos(sh.bone, _v);
    dir.subj.lerp(bp, damp(dt, sh.follow));
    dir.anchor.lerp(bp, damp(dt, sh.anchor));
    const anchor = _v2.copy(dir.anchor);
    if (!sh.rel) anchor.y = 0;
    const p = shotCam(sh, sh.az, s, sh.rel ? dir.anchor : anchor, want.pos);
    if (!sh.rel) p.y = sh.h[0] + (sh.h[1] - sh.h[0]) * ease(s);
    const lookAt = new V3().copy(dir.subj);
    if (sh.look) lookAt.add(_v.set(sh.look[0], sh.look[1], sh.look[2]));
    const hh = (sh.handheld || 0.12);
    const tt = time + dir.seed;
    p.x += hh * 0.012 * (Math.sin(tt * 1.13) + 0.5 * Math.sin(tt * 2.71));
    p.y += hh * 0.009 * (Math.sin(tt * 1.57 + 1) + 0.5 * Math.sin(tt * 3.1));
    p.z += hh * 0.012 * (Math.sin(tt * 0.97 + 2) + 0.5 * Math.sin(tt * 2.3));
    lookAt.x += hh * 0.01 * Math.sin(tt * 0.83); lookAt.y += hh * 0.008 * Math.sin(tt * 1.21 + 0.4);
    clampRoom(p, 0.3);
    lookQuat(p, lookAt, want.quat);
    want.fov = sh.fov[0] + (sh.fov[1] - sh.fov[0]) * ease(s);
  }

  // ---- transitions -------------------------------------------------------
  function beginTransition(dur = 1.2) {
    trans.active = true; trans.t = 0; trans.dur = dur;
    trans.pos.copy(out.pos); trans.quat.copy(out.quat); trans.fov = out.fov;
  }
  function setMode(m) {
    if (!MODES.includes(m) || m === mode) return;
    const prev = mode;
    mode = m;
    if (m !== 'orbit') leaveStudy();
    orbit.enabled = m === 'orbit';
    if (m !== 'walk' && document.pointerLockElement === dom && document.exitPointerLock) document.exitPointerLock();
    if (m === 'walk') enterWalk();
    if (m === 'join') join.init = false;
    if (m === 'director') { dir.shot = null; }
    if (m === 'orbit') {
      // continue from where the camera is, kept within the orbit's limits
      const tgt = bonePos(focusBone, new V3());
      orbit.target.copy(tgt);
      const off = out.pos.clone().sub(tgt);
      const d = Math.min(orbit.maxDistance, Math.max(2.2, off.length()));
      if (off.lengthSq() < 1e-6) off.set(0, 0.3, 1);
      proxy.position.copy(tgt).add(off.setLength(d));
      clampRoom(proxy.position, MARGIN + 0.1);
      proxy.lookAt(tgt); orbit.update();
      lastInteract = time;
    }
    beginTransition(m === 'director' ? 1.8 : prev === 'join' || m === 'join' ? 1.5 : 1.2);
    emit('mode', m);
  }

  function update(dt, ctx = {}) {
    dt = Math.max(0, Math.min(dt || 0, 0.1));
    time += dt;
    soloist = ctx.soloist || null; participant = ctx.participant || null; activity = ctx.activity || null;
    if (soloist && soloist.object3d) soloist.object3d.updateWorldMatrix(true, true);
    if (participant && participant.object3d) participant.object3d.updateWorldMatrix(true, true);
    if (mode === 'orbit') orbitPose(dt);
    else if (mode === 'walk') walkPose(dt);
    else if (mode === 'join') joinPose(dt);
    else directorPose(dt);
    if (trans.active) {
      trans.t += dt;
      const e = ease(Math.min(1, trans.t / trans.dur));
      out.pos.copy(trans.pos).lerp(want.pos, e);
      out.quat.copy(trans.quat).slerp(want.quat, e);
      out.fov = trans.fov + (want.fov - trans.fov) * e;
      if (trans.t >= trans.dur) trans.active = false;
    } else {
      out.pos.copy(want.pos); out.quat.copy(want.quat); out.fov = want.fov;
    }
    clampRoom(out.pos, 0.18);
    camera.position.copy(out.pos);
    camera.quaternion.copy(out.quat);
    if (Math.abs(camera.fov - out.fov) > 1e-3) { camera.fov = out.fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
    // shallow-focus hint for post.js: close study views and director close-ups
    let dw = 0, fd = 3;
    if (mode === 'orbit') { dw = dofWant; fd = camera.position.distanceTo(orbit.target); }
    else if (mode === 'director' && dir.shot) { dw = dir.shot.dof || 0; fd = camera.position.distanceTo(dir.subj); }
    dofCur += (dw - dofCur) * damp(dt, 0.4);
    const ud = camera.userData.dof || (camera.userData.dof = { focus: 3, amount: 0 });
    ud.focus = fd; ud.amount = dofCur < 0.01 ? 0 : dofCur;
  }

  return {
    get mode() { return mode; },
    setMode,
    cycle() { setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]); },
    update,
    study,
    studyViews: Object.entries(STUDY).map(([id, v]) => ({ id, label: v.label })),
    get studying() { return studyState ? studyState.id : null; },
    focus(boneName) {
      if (!boneName || (!BONE_BY_NAME[boneName] && boneName !== 'feet')) return;
      leaveStudy();
      focusOffset.set(0, 0, 0);
      focusBone = boneName;
      lastInteract = time;
      const small = /hand|thumb|index|middle|ring|pinky|foot|toes|head|neck/.test(boneName);
      const d = proxy.position.distanceTo(orbit.target);
      if (small && d > 3.4) focusDist = 2.6; else if (d > 6) focusDist = 4.5;
    },
    on(ev, cb) { (listeners[ev] ||= new Set()).add(cb); return () => listeners[ev].delete(cb); },
    get director() { return dir.shot ? { kind: dir.shot.kind, bone: dir.shot.bone, t: dir.t, hold: dir.hold } : null; },
    orbit,
    dispose() {
      orbit.dispose();
      window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur);
      dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerup', onUp); dom.removeEventListener('pointercancel', onUp); dom.removeEventListener('dblclick', onDbl);
      document.removeEventListener('pointerlockchange', onLockChange); document.removeEventListener('pointerlockerror', onLockError);
    },
  };
}
