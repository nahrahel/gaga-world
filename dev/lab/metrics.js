// dev/lab/metrics.js: objective motion metrics for the Gaga motion lab (engine agnostic).
// Input is a recording of bone transforms (see motion-lab.html `record`); nothing here reads engine internals
// except the optional `dbg` block (shape names, channel values) which is used only when present.
// Conventions: angular quantities in deg, deg/s, deg/s^2, deg/s^3; lengths in mm in the outputs; time in s.
// Positive xcorr lag = the second signal happens later than the first.

export const TRACK = ['pelvis', 'spine01', 'spine02', 'spine03', 'spine04', 'spine05', 'spine06', 'neck01', 'neck02', 'head',
  'clavicle_L', 'clavicle_R', 'upperarm_L', 'upperarm_R', 'forearm_L', 'forearm_R', 'hand_L', 'hand_R',
  'thigh_L', 'thigh_R', 'shin_L', 'shin_R', 'foot_L', 'foot_R', 'toes_L', 'toes_R'];
export const SPINE = TRACK.slice(0, 10);
export const POINTS = ['heel_L', 'heel_R', 'ball_L', 'ball_R', 'toetip_L', 'toetip_R'];
export const GROUPS = {
  pelvis: ['pelvis'], lumbar: ['spine01', 'spine02', 'spine03'], thorax: ['spine04', 'spine05', 'spine06'],
  neckhead: ['neck01', 'neck02', 'head'], shoulder: ['clavicle_L', 'clavicle_R'], upperarm: ['upperarm_L', 'upperarm_R'],
  forearm: ['forearm_L', 'forearm_R'], hand: ['hand_L', 'hand_R'], thigh: ['thigh_L', 'thigh_R'], shin: ['shin_L', 'shin_R'],
  foot: ['foot_L', 'foot_R', 'toes_L', 'toes_R'],
};
export const REGIONS = { trunk: ['pelvis', 'spine01', 'spine02', 'spine03', 'spine04', 'spine05', 'spine06'], neckhead: GROUPS.neckhead,
  armProx: [...GROUPS.shoulder, ...GROUPS.upperarm], armDist: [...GROUPS.forearm, ...GROUPS.hand], legs: [...GROUPS.thigh, ...GROUPS.shin], feet: GROUPS.foot };
export const BANDS = [[0.05, 0.5], [0.5, 1.5], [1.5, 4], [4, 12]];
// A "snap": angular acceleration above 3000 deg/s^2, i.e. the joint's velocity changes by more than 50 deg/s inside one
// 60 Hz frame. Reference points: a brisk 40 deg elbow move in 0.5 s with a minimum-jerk profile peaks near 920 deg/s^2;
// a 3 deg, 4.6 Hz shake peaks near 2500 deg/s^2. Above 3000 is either a deliberate strike (explosive) or a discontinuity.
export const SNAP = 3000;
const R2D = 180 / Math.PI;
const BI = Object.fromEntries(TRACK.map((n, i) => [n, i]));

// ------------------------------------------------------------------ small math
function rotvec(x, y, z, w, out, o) { // unit quaternion -> rotation vector (rad), shortest path
  if (w < 0) { x = -x; y = -y; z = -z; w = -w; }
  const s = Math.sqrt(x * x + y * y + z * z);
  const k = s < 1e-12 ? 2 : 2 * Math.atan2(s, w) / s;
  out[o] = x * k; out[o + 1] = y * k; out[o + 2] = z * k;
}
// a * conj(b) (spatial increment from b to a)
function mulConj(ax, ay, az, aw, bx, by, bz, bw, out) {
  bx = -bx; by = -by; bz = -bz;
  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
}
function pct(arr, p) { if (!arr.length) return null; const a = Float64Array.from(arr).sort(); const i = Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1)))); return a[i]; }
function mean(a) { let s = 0; for (const v of a) s += v; return a.length ? s / a.length : 0; }
const r1 = (v, d = 1) => (v == null || !isFinite(v) ? null : +v.toFixed(d));

export function xcorr(a, b, maxLag) { // mean-removed, normalized by the overlap; returns {r, lag (samples)} at max |r|
  const n = Math.min(a.length, b.length); if (n < 8) return { r: null, lag: 0 };
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let va = 0, vb = 0; for (let i = 0; i < n; i++) { va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  va /= n; vb /= n; if (va < 1e-12 || vb < 1e-12) return { r: null, lag: 0 };
  let best = 0, bestL = 0;
  for (let L = -maxLag; L <= maxLag; L++) {
    let s = 0, c = 0;
    for (let i = Math.max(0, -L); i < n && i + L < n; i++) { s += (a[i] - ma) * (b[i + L] - mb); c++; }
    const r = s / c / Math.sqrt(va * vb);
    if (Math.abs(r) > Math.abs(best)) { best = r; bestL = L; }
  }
  return { r: best, lag: bestL };
}
// vector xcorr: components summed (directional coupling); A, B arrays of [x[], y[], z[]]
export function xcorrVec(A, B, maxLag) {
  const n = Math.min(A[0].length, B[0].length); if (n < 8) return { r: null, lag: 0 };
  const m = (X) => X.map(c => { let s = 0; for (let i = 0; i < n; i++) s += c[i]; return s / n; });
  const ma = m(A), mb = m(B);
  let va = 0, vb = 0; for (let k = 0; k < 3; k++) for (let i = 0; i < n; i++) { va += (A[k][i] - ma[k]) ** 2; vb += (B[k][i] - mb[k]) ** 2; }
  va /= n; vb /= n; if (va < 1e-12 || vb < 1e-12) return { r: null, lag: 0 };
  let best = 0, bestL = 0;
  for (let L = -maxLag; L <= maxLag; L++) {
    let s = 0, c = 0;
    for (let i = Math.max(0, -L); i < n && i + L < n; i++) { for (let k = 0; k < 3; k++) s += (A[k][i] - ma[k]) * (B[k][i + L] - mb[k]); c++; }
    const r = s / c / Math.sqrt(va * vb);
    if (Math.abs(r) > Math.abs(best)) { best = r; bestL = L; }
  }
  return { r: best, lag: bestL };
}
function fftPow(sig, fs) { // power spectrum (one sided) of a real signal, zero padded to 2^k, Hann window
  let N = 1; while (N < sig.length) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N), n = sig.length;
  let m = 0; for (let i = 0; i < n; i++) m += sig[i]; m /= n;
  for (let i = 0; i < n; i++) re[i] = (sig[i] - m) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  const P = new Float64Array(N / 2); for (let k = 0; k < N / 2; k++) P[k] = (re[k] ** 2 + im[k] ** 2) / n;
  return { P, df: fs / N };
}

// ------------------------------------------------------------------ derived series
// rec: { N, NB, NP, t[N], dt[N], qL[N*NB*4], qW[N*NB*4], p[N*NB*3], pts[N*NP*3], com[N*3], restPts[NP*3], axes[NB]{flex,abd,twist}, limits[NB],
//        segRest[NB*3] (tail-head in rest), dbg? }
export function derive(rec) {
  const { N, NB } = rec;
  // samples: skip frames that advanced less than 1 ms (dt = 0 / 1e-5 edge cases) so derivatives stay meaningful
  const idx = [0];
  for (let k = 1; k < N; k++) if (rec.t[k] - rec.t[idx[idx.length - 1]] >= 1e-3) idx.push(k);
  const S = idx.length, ts = Float64Array.from(idx, k => rec.t[k]);
  const wL = new Float64Array(S * NB * 3), wW = new Float64Array(S * NB * 3); // angular velocity, local (parent frame) and world, deg/s
  const q = new Float64Array(4), rv = new Float64Array(3);
  for (let s = 1; s < S; s++) {
    const k = idx[s], kp = idx[s - 1], h = rec.t[k] - rec.t[kp];
    for (let b = 0; b < NB; b++) {
      for (const [src, dst] of [[rec.qL, wL], [rec.qW, wW]]) {
        const o = (k * NB + b) * 4, op = (kp * NB + b) * 4;
        mulConj(src[o], src[o + 1], src[o + 2], src[o + 3], src[op], src[op + 1], src[op + 2], src[op + 3], q);
        rotvec(q[0], q[1], q[2], q[3], rv, 0);
        const d = (s * NB + b) * 3; dst[d] = rv[0] / h * R2D; dst[d + 1] = rv[1] / h * R2D; dst[d + 2] = rv[2] / h * R2D;
      }
    }
  }
  for (let b = 0; b < NB * 3; b++) { wL[b] = wL[NB * 3 + b]; wW[b] = wW[NB * 3 + b]; }
  // acceleration and jerk of the local angular velocity (non-uniform central differences)
  const aL = new Float64Array(S * NB * 3), jL = new Float64Array(S * NB * 3);
  for (let s = 1; s < S - 1; s++) {
    const h = (ts[s + 1] - ts[s - 1]) / 2;
    for (let c = 0; c < NB * 3; c++) aL[s * NB * 3 + c] = (wL[(s + 1) * NB * 3 + c] - wL[s * NB * 3 + c]) / h;
  }
  for (let s = 2; s < S - 1; s++) {
    const h = (ts[s] - ts[s - 1]);
    for (let c = 0; c < NB * 3; c++) jL[s * NB * 3 + c] = (aL[s * NB * 3 + c] - aL[(s - 1) * NB * 3 + c]) / h;
  }
  // anatomical angles (deg) from the local rotation vector projected on the bone axes
  const ang = new Float64Array(S * NB * 3);
  for (let s = 0; s < S; s++) {
    const k = idx[s];
    for (let b = 0; b < NB; b++) {
      const o = (k * NB + b) * 4; rotvec(rec.qL[o], rec.qL[o + 1], rec.qL[o + 2], rec.qL[o + 3], rv, 0);
      const ax = rec.axes[b], d = (s * NB + b) * 3;
      ang[d] = (rv[0] * ax.flex[0] + rv[1] * ax.flex[1] + rv[2] * ax.flex[2]) * R2D;
      ang[d + 1] = (rv[0] * ax.abd[0] + rv[1] * ax.abd[1] + rv[2] * ax.abd[2]) * R2D;
      ang[d + 2] = (rv[0] * ax.twist[0] + rv[1] * ax.twist[1] + rv[2] * ax.twist[2]) * R2D;
    }
  }
  return { idx, S, ts, wL, wW, aL, jL, ang };
}

function series(D, arr, b, c, NB) { const out = new Float64Array(D.S); for (let s = 0; s < D.S; s++) out[s] = arr[(s * NB + b) * 3 + c]; return out; }
function mag(D, arr, b, NB, s) { const o = (s * NB + b) * 3; return Math.hypot(arr[o], arr[o + 1], arr[o + 2]); }

// ------------------------------------------------------------------ metric blocks
function smoothness(rec, D, events) {
  const NB = rec.NB, S = D.S, dur = D.ts[S - 1] - D.ts[0], per = {};
  const accIdx = new Float64Array(S), accLeg = new Float64Array(S); // acceleration index per sample: RMS over upper-body bones (trunk, head, arms) / over leg+foot bones
  const isLeg = (n) => /^(thigh|shin|foot|toes)/.test(n), nUp = TRACK.filter(n => !isLeg(n)).length, nLeg = NB - nUp;
  for (let b = 0; b < NB; b++) {
    const acc = [], jerkC = []; let snaps = 0, jss = 0, jn = 0;
    for (let s = 2; s < S - 2; s++) {
      const a = mag(D, D.aL, b, NB, s); acc.push(a); if (a > SNAP) snaps++;
      if (isLeg(TRACK[b])) accLeg[s] += a * a / nLeg; else accIdx[s] += a * a / nUp;
      const o = (s * NB + b) * 3;
      for (let c = 0; c < 3; c++) { const j = D.jL[o + c]; jerkC.push(j); jss += j * j; jn++; }
    }
    let m2 = 0, m4 = 0; const mj = mean(jerkC);
    for (const j of jerkC) { const d = j - mj; m2 += d * d; m4 += d ** 4; }
    m2 /= jerkC.length || 1; m4 /= jerkC.length || 1;
    per[TRACK[b]] = { rmsJerk: Math.sqrt(jss / (jn || 1) * 3), p99Acc: pct(acc, 0.99), snaps, kurt: m2 > 0 ? m4 / (m2 * m2) : null };
  }
  for (let s = 0; s < S; s++) { accIdx[s] = Math.sqrt(accIdx[s]); accLeg[s] = Math.sqrt(accLeg[s]); }
  const region = {};
  for (const [rg, bones] of Object.entries(REGIONS)) {
    region[rg] = { rmsJerk: r1(Math.sqrt(mean(bones.map(n => per[n].rmsJerk ** 2))), 0), p99Acc: r1(Math.max(...bones.map(n => per[n].p99Acc)), 0),
      snapsPerMin: r1(bones.reduce((a, n) => a + per[n].snaps, 0) / dur * 60, 1), kurt: r1(mean(bones.map(n => per[n].kurt || 0)), 1) };
  }
  const totalSnaps = Object.values(per).reduce((a, x) => a + x.snaps, 0);
  const worst = Object.entries(per).sort((a, b) => b[1].snaps - a[1].snaps || b[1].p99Acc - a[1].p99Acc).slice(0, 4)
    .map(([n, x]) => ({ bone: n, snaps: x.snaps, p99Acc: r1(x.p99Acc, 0), kurt: r1(x.kurt, 1) }));
  // windowed peak of the acceleration index relative to its median: events vs typical windows (upper body and legs separately)
  const mk = (X) => {
    const med = pct(Array.from(X.subarray(2, S - 2)), 0.5) || 1e-9;
    const peakIn = (t0, t1) => { let p = 0, at = t0; for (let s = 2; s < S - 2; s++) if (D.ts[s] >= t0 && D.ts[s] <= t1 && X[s] > p) { p = X[s]; at = D.ts[s]; } return { p: p / med, at }; };
    // typical window peak, from windows that overlap no event (layer change / accent) and no posture switch
    const typical = (w, excl) => { const r = [], all = [];
      for (let t = D.ts[0]; t + w < D.ts[S - 1]; t += 0.25) { const p = peakIn(t, t + w).p; all.push(p); if (!excl.some(([a, b]) => t < b && t + w > a)) r.push(p); }
      return pct(r.length >= 4 ? r : all, 0.5); };
    const evEx = (events || []).map(e => [e.t - 0.25, e.t + 3.5]);
    const swEx = rec.dbg && rec.dbg.switches ? rec.dbg.switches.map(x => [x.t - 0.25, x.t + 1.6]) : [];
    return { med, peakIn, typ3: typical(3, evEx), typ08: typical(0.8, evEx.concat(swEx)) };
  };
  const U = mk(accIdx), G = mk(accLeg);
  const ev = (events || []).filter(e => e.t >= D.ts[0] && e.t < D.ts[S - 1] - 1).map(e => { const pk = U.peakIn(e.t, e.t + 3), pl = G.peakIn(e.t, e.t + 3);
    return { t: e.t, what: e.label, peakVsTypical: r1(pk.p / U.typ3, 2), at: r1(pk.at, 2), legsPeakVsTypical: r1(pl.p / G.typ3, 2) }; });
  let sw = null;
  if (rec.dbg && rec.dbg.switches) {
    const xs = rec.dbg.switches.filter(x => x.t > D.ts[0] + 0.2 && x.t < D.ts[S - 1] - 0.8);
    const vals = xs.map(x => U.peakIn(x.t - 0.1, x.t + 0.7).p / U.typ08);
    sw = { count: xs.length, perMin: r1(xs.length / dur * 60, 1), peakVsTypical: r1(mean(vals), 2), worst: r1(Math.max(0, ...vals), 2),
      kinds: xs.reduce((a, x) => (a[x.kind] = (a[x.kind] || 0) + 1, a), {}) };
  }
  const med = U.med;
  // snap events: contiguous runs (merged within 0.1 s) where any bone of the group exceeds the threshold
  const snapEvents = (pred) => {
    let n = 0, last = -1e9;
    for (let s = 2; s < S - 2; s++) {
      let hit = false; for (let b = 0; b < NB && !hit; b++) if (pred(TRACK[b]) && mag(D, D.aL, b, NB, s) > SNAP) hit = true;
      if (hit) { if (D.ts[s] - last > 0.1) n++; last = D.ts[s]; }
    }
    return n;
  };
  const upEv = snapEvents(n => !isLeg(n)), legEv = snapEvents(isLeg), headEv = snapEvents(n => /^(neck|head)/.test(n));
  const legSnaps = TRACK.filter(isLeg).reduce((a, n) => a + per[n].snaps, 0);
  return { snapFramesPerMin: r1(totalSnaps / dur * 60, 1), upperSnapsPerMin: r1(upEv / dur * 60, 1), legSnapsPerMin: r1(legEv / dur * 60, 1), headSnapsPerMin: r1(headEv / dur * 60, 1), legSnapFramesPerMin: r1(legSnaps / dur * 60, 1), region, worst, events: ev, switches: sw, accIndexMedian: r1(med, 0), _per: per, _accIdx: accIdx, _accLeg: accLeg };
}

function connectedness(rec, D) {
  const NB = rec.NB, fs = (D.S - 1) / (D.ts[D.S - 1] - D.ts[0]), ML = Math.round(0.6 * fs);
  const angVel = (b, c) => { const a = series(D, D.ang, b, c, NB), v = new Float64Array(D.S); for (let s = 1; s < D.S - 1; s++) v[s] = (a[s + 1] - a[s - 1]) / (D.ts[s + 1] - D.ts[s - 1]); return v; };
  const detr = (a) => { // remove slow posture holds: subtract a 6 s moving average
    const w = Math.round(3 * fs), o = new Float64Array(a.length), cs = new Float64Array(a.length + 1);
    for (let i = 0; i < a.length; i++) cs[i + 1] = cs[i] + a[i];
    for (let i = 0; i < a.length; i++) { const lo = Math.max(0, i - w), hi = Math.min(a.length, i + w + 1); o[i] = a[i] - (cs[hi] - cs[lo]) / (hi - lo); }
    return o;
  };
  const chain = (c) => {
    const A = SPINE.map(n => detr(series(D, D.ang, BI[n], c, NB))), v = SPINE.map(n => angVel(BI[n], c)), out = [];
    for (let i = 0; i < 9; i++) {
      const x = xcorr(A[i], A[i + 1], ML), xv = xcorr(v[i], v[i + 1], ML);
      out.push({ pair: SPINE[i] + '>' + SPINE[i + 1], r: r1(x.r, 2), lag: r1(x.lag / fs, 3), rVel: r1(xv.r, 2) });
    }
    const trunk = out.slice(1, 6).filter(o => o.r != null); // spine01 .. spine06
    const pos = trunk.filter(o => o.lag > 0.005).length, neg = trunk.filter(o => o.lag < -0.005).length;
    const far = xcorr(A[1], A[6], Math.round(1.5 * fs)), hd = xcorr(A[6], A[9], Math.round(1.0 * fs)), pv = xcorr(A[0], A[1], Math.round(1.0 * fs));
    const sum = new Float64Array(D.S); for (let i = 1; i <= 6; i++) { const a = A[i]; for (let s = 0; s < D.S; s++) sum[s] += a[s]; }
    const { P, df } = fftPow(sum, fs); let pk = 0, f0 = 0; for (let k = 1; k < P.length; k++) { const f = k * df; if (f >= 0.08 && f <= 3 && P[k] > pk) { pk = P[k]; f0 = f; } }
    const amp = []; for (let i = 1; i <= 6; i++) { const a = A[i]; amp.push(Math.sqrt(mean(Array.from(a, x => x * x))) * Math.SQRT2); }
    return { pairs: out, meanR: r1(mean(trunk.map(o => Math.abs(o.r))), 2), meanRVel: r1(mean(out.filter(o => o.rVel != null).map(o => Math.abs(o.rVel))), 2),
      lagSum: r1(trunk.reduce((a, o) => a + o.lag, 0), 3), upLags: pos, downLags: neg,
      trunkEndToEnd: { r: r1(far.r, 2), lag: r1(far.lag / fs, 3) }, chestToHead: { r: r1(hd.r, 2), lag: r1(hd.lag / fs, 3) }, pelvisToSpine01: { r: r1(pv.r, 2), lag: r1(pv.lag / fs, 3) },
      period: f0 ? r1(1 / f0, 2) : null, phaseOnTrunk: f0 && far.r > 0 ? r1(Math.abs(far.lag / fs) * f0, 2) : null, segAmp: r1(mean(amp), 2) };
  };
  const lateral = chain(1), sagittal = chain(0), twist = chain(2);
  // arm chains: proximal -> distal local angular speed envelopes
  const speed = (n) => { const b = BI[n], o = new Float64Array(D.S); for (let s = 0; s < D.S; s++) o[s] = mag(D, D.wL, b, NB, s); return o; };
  const armChain = {};
  for (const sd of ['_L', '_R']) {
    const c = speed('clavicle' + sd), u = speed('upperarm' + sd), f = speed('forearm' + sd), h = speed('hand' + sd);
    const x1 = xcorr(c, u, ML), x2 = xcorr(u, f, ML), x3 = xcorr(f, h, ML);
    armChain[sd.slice(1)] = { clav_up: { r: r1(x1.r, 2), lag: r1(x1.lag / fs, 3) }, up_fore: { r: r1(x2.r, 2), lag: r1(x2.lag / fs, 3) }, fore_hand: { r: r1(x3.r, 2), lag: r1(x3.lag / fs, 3) } };
  }
  // pelvis as prime mover: world linear velocity of pelvis vs chest / head / hands, world angular velocity pelvis vs chest / head
  const linVel = (n) => { const b = BI[n], X = [new Float64Array(D.S), new Float64Array(D.S), new Float64Array(D.S)];
    for (let s = 1; s < D.S; s++) { const k = D.idx[s], kp = D.idx[s - 1], h = rec.t[k] - rec.t[kp]; for (let c = 0; c < 3; c++) X[c][s] = (rec.p[(k * NB + b) * 3 + c] - rec.p[(kp * NB + b) * 3 + c]) / h; } return X; };
  const angW = (n) => [0, 1, 2].map(c => series(D, D.wW, BI[n], c, NB));
  const pl = linVel('pelvis'), pa = angW('pelvis'), ML2 = Math.round(1.0 * fs);
  const f = (x) => ({ r: r1(x.r, 2), lag: r1(x.lag / fs, 3) });
  const pelvisLin = { chest: f(xcorrVec(pl, linVel('spine06'), ML2)), head: f(xcorrVec(pl, linVel('head'), ML2)), handL: f(xcorrVec(pl, linVel('hand_L'), ML2)), handR: f(xcorrVec(pl, linVel('hand_R'), ML2)) };
  const pelvisAng = { chest: f(xcorrVec(pa, angW('spine06'), ML2)), head: f(xcorrVec(pa, angW('head'), ML2)) };
  // passive arms: does the upper arm's own (local) motion answer the chest's world rotation? (a hanging arm should, with lag)
  const ch = angW('spine06'), armPassive = {};
  for (const sd of ['_L', '_R']) armPassive[sd.slice(1)] = f(xcorrVec(ch, [0, 1, 2].map(c => series(D, D.wL, BI['upperarm' + sd], c, NB)), ML2));
  return { lateral, sagittal, twist, armChain, pelvisLin, pelvisAng, armPassive };
}

function grounding(rec, D) {
  const { N, NB, NP } = rec, rest = rec.restPts, TH = 0.008;
  const y = (k, i) => rec.pts[(k * NP + i) * 3 + 1] - rest[i * 3 + 1];
  const P = (k, i) => [rec.pts[(k * NP + i) * 3], rec.pts[(k * NP + i) * 3 + 2]];
  const out = { feet: {} }; let minPen = 1e9, minPenWhat = ''; const minBy = { heel: 0, ball: 0, toe: 0 };
  let steps = 0, lifts = 0, slideMax = 0, toeDrag = 0; const stepT = []; const slides = []; let creepLen = 0, creepT = 0;
  const contact = []; // per frame per foot: {heel, ball, toe}
  for (let s = 0; s < 2; s++) {
    const hi = s, bi = 2 + s, ti = 4 + s;
    let heelUp = 0, onBall = 0, air = 0, frames = 0;
    let phase = null, airStart = null, prevToe = null; // ball contact phase: anchor
    let hphase = null;
    for (let k of D.idx) {
      const hy = y(k, hi), by = y(k, bi), ty = y(k, ti);
      for (const [v, w] of [[hy, 'heel'], [by, 'ball'], [ty, 'toe']]) { if (v < minBy[w]) minBy[w] = v; if (v < minPen) { minPen = v; minPenWhat = w + (s ? '_R' : '_L') + '@' + rec.t[k].toFixed(2); } }
      const hc = hy < TH, bc = by < TH, tc = ty < TH;
      (contact[k] ||= [])[s] = { hc, bc, tc };
      frames++;
      if (hy > 0.010) heelUp++;
      if (hy > 0.010 && bc) onBall++;
      const inAir = !hc && !bc && !tc; if (inAir) air++;
      const swing = !hc && !bc; // heel and ball off the floor (the toe tip may still touch: toe drag)
      const tp = P(k, ti);
      if (swing && tc && prevToe) toeDrag += Math.hypot(tp[0] - prevToe[0], tp[1] - prevToe[1]);
      prevToe = swing && tc ? tp : null;
      // ball slide during continuous ball contact
      const bp = P(k, bi);
      if (bc) {
        if (!phase) phase = { x: bp[0], z: bp[1], max: 0, len: 0, px: bp[0], pz: bp[1], t0: rec.t[k] };
        const d = Math.hypot(bp[0] - phase.x, bp[1] - phase.z); if (d > phase.max) phase.max = d;
        phase.len += Math.hypot(bp[0] - phase.px, bp[1] - phase.pz); phase.px = bp[0]; phase.pz = bp[1]; phase.t1 = rec.t[k];
      } else if (phase) { slides.push(phase.max); slideMax = Math.max(slideMax, phase.max); creepLen += phase.len; creepT += phase.t1 - phase.t0; phase = null; }
      const hp = P(k, hi);
      if (hc) { if (!hphase) hphase = { x: hp[0], z: hp[1], max: 0 }; hphase.max = Math.max(hphase.max, Math.hypot(hp[0] - hphase.x, hp[1] - hphase.z)); }
      else if (hphase) { slides.push(hphase.max); slideMax = Math.max(slideMax, hphase.max); hphase = null; }
      // steps vs lifts
      if (swing && !airStart) airStart = bp; // ball position at liftoff (first swing frame)
      if (!swing && airStart) { const d = Math.hypot(bp[0] - airStart[0], bp[1] - airStart[1]); if (d > 0.03) { steps++; stepT.push(rec.t[k]); } else lifts++; airStart = null; }
    }
    if (phase) { slides.push(phase.max); slideMax = Math.max(slideMax, phase.max); creepLen += phase.len; creepT += (phase.t1 || phase.t0) - phase.t0; }
    if (hphase) { slides.push(hphase.max); slideMax = Math.max(slideMax, hphase.max); }
    out.feet[s ? 'R' : 'L'] = { heelLift: r1(heelUp / frames, 3), onBall: r1(onBall / frames, 3), air: r1(air / frames, 3) };
  }
  const dur = rec.t[D.idx[D.S - 1]] - rec.t[D.idx[0]];
  // support polygon and COM margin
  const margins = [], single = [], plotM = []; let airborne = 0;
  const kneeL = [], kneeR = [], kneeSt = [];
  for (const k of D.idx) {
    const pts = [];
    for (let s = 0; s < 2; s++) {
      const c = contact[k][s]; if (!c) continue;
      // foot lateral axis on the floor from the heel->ball direction
      const h = P(k, s), b = P(k, 2 + s), t = P(k, 4 + s);
      let fx = b[0] - h[0], fz = b[1] - h[1]; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl; const lx = -fz, lz = fx;
      if (c.bc) { pts.push([b[0] + lx * 0.045, b[1] + lz * 0.045], [b[0] - lx * 0.045, b[1] - lz * 0.045]); }
      if (c.tc) pts.push(t);
      if (c.hc) { pts.push([h[0] + lx * 0.03, h[1] + lz * 0.03], [h[0] - lx * 0.03, h[1] - lz * 0.03]); }
    }
    const cx = rec.com[k * 3], cz = rec.com[k * 3 + 2];
    const feetDown = [0, 1].filter(s => { const c = contact[k][s]; return c && (c.hc || c.bc || c.tc); }).length;
    if (!pts.length) { airborne++; plotM.push(NaN); } else {
      const m = polyMargin(pts, cx, cz);
      margins.push(m); plotM.push(m); if (feetDown === 1) single.push(m);
    }
    for (let s = 0; s < 2; s++) {
      const th = BI['thigh' + (s ? '_R' : '_L')], sh = BI['shin' + (s ? '_R' : '_L')], ft = BI['foot' + (s ? '_R' : '_L')];
      const g = (b) => [rec.p[(k * NB + b) * 3], rec.p[(k * NB + b) * 3 + 1], rec.p[(k * NB + b) * 3 + 2]];
      const H = g(th), K = g(sh), A = g(ft);
      const u = [K[0] - H[0], K[1] - H[1], K[2] - H[2]], v = [A[0] - K[0], A[1] - K[1], A[2] - K[2]];
      const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v));
      const kd = Math.acos(Math.max(-1, Math.min(1, c))) * R2D; (s ? kneeR : kneeL).push(kd);
      const cc = contact[k][s]; if (cc && (cc.hc || cc.bc)) kneeSt.push(kd);
    }
  }
  const knees = kneeL.concat(kneeR);
  const unb = margins.filter(m => m < 0).length;
  return {
    slideMaxMm: r1(slideMax * 1000, 1), slideP95Mm: r1(pct(slides, 0.95) * 1000, 1), creepMmPerS: r1(creepT > 0 ? creepLen / creepT * 1000 : 0, 1),
    penetrationMm: r1(Math.min(0, minPen) * 1000, 1), penetrationAt: minPen < 0 ? minPenWhat : null, penetrationByPointMm: { heel: r1(minBy.heel * 1000, 1), ball: r1(minBy.ball * 1000, 1), toe: r1(minBy.toe * 1000, 1) },
    feet: out.feet, steps, lifts, stepsAfterBodySwitch: rec.dbg && rec.dbg.switches && stepT.length ? r1(stepT.filter(t => rec.dbg.switches.some(x => x.kind === 'body' && t - x.t > 0 && t - x.t < 3)).length / stepT.length, 2) : null, toeDragMmPerMin: r1(toeDrag * 1000 / dur * 60, 0), stepsPerMin: r1(steps / dur * 60, 1), liftsPerMin: r1(lifts / dur * 60, 1),
    comMarginP5Mm: r1(pct(margins, 0.05) * 1000, 0), comMarginMinMm: r1(pct(margins, 0) * 1000, 0), comMarginP50Mm: r1(pct(margins, 0.5) * 1000, 0),
    unbalancedFrac: r1(unb / (margins.length || 1), 3), singleSupportFrac: r1(single.length / (margins.length || 1), 3),
    unbalancedInSingle: single.length ? r1(single.filter(m => m < 0).length / single.length, 3) : null, airborneFrac: r1(airborne / D.S, 3),
    kneeStance: { p5: r1(pct(kneeSt, 0.05), 1), p50: r1(pct(kneeSt, 0.5), 1), p95: r1(pct(kneeSt, 0.95), 1), locked: r1(kneeSt.filter(x => x < 3).length / (kneeSt.length || 1), 3), over60: r1(kneeSt.filter(x => x > 60).length / (kneeSt.length || 1), 3) },
    knee: { mean: r1(mean(knees), 1), p5: r1(pct(knees, 0.05), 1), p50: r1(pct(knees, 0.5), 1), p95: r1(pct(knees, 0.95), 1),
      locked: r1(knees.filter(x => x < 3).length / (knees.length || 1), 3), over60: r1(knees.filter(x => x > 60).length / (knees.length || 1), 3) },
    _plot: { kneeL, kneeR, margins: plotM },
  };
}
function hull(P) { // monotone chain
  const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function segDist(px, pz, a, b) {
  const vx = b[0] - a[0], vz = b[1] - a[1], L = vx * vx + vz * vz; let t = L > 0 ? ((px - a[0]) * vx + (pz - a[1]) * vz) / L : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - a[0] - t * vx, pz - a[1] - t * vz);
}
export function polyMargin(pts, x, z) { // signed distance to the convex hull boundary (inside > 0)
  const H = hull(pts);
  if (H.length === 1) return -Math.hypot(x - H[0][0], z - H[0][1]);
  let d = 1e9; for (let i = 0; i < H.length; i++) d = Math.min(d, segDist(x, z, H[i], H[(i + 1) % H.length]));
  if (H.length < 3) return -d;
  let inside = true; // counter-clockwise hull from the monotone chain
  for (let i = 0; i < H.length; i++) { const a = H[i], b = H[(i + 1) % H.length]; if ((b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) { inside = false; break; } }
  return inside ? d : -d;
}

function head(rec, D, sm) {
  const NB = rec.NB, hb = BI.head, cb = BI.spine06, dur = D.ts[D.S - 1] - D.ts[0];
  let fol = 0, cnt = 0, ind = 0, n = 0; const sp = []; let relSS = 0, chSS = 0;
  for (let s = 1; s < D.S; s++) {
    const o = (s * NB + hb) * 3, oc = (s * NB + cb) * 3;
    const h = [D.wW[o], D.wW[o + 1], D.wW[o + 2]], c = [D.wW[oc], D.wW[oc + 1], D.wW[oc + 2]];
    const hm = Math.hypot(...h), cm = Math.hypot(...c); sp.push(hm);
    const rel = [h[0] - c[0], h[1] - c[1], h[2] - c[2]]; relSS += rel[0] ** 2 + rel[1] ** 2 + rel[2] ** 2; chSS += cm * cm;
    if (hm > 5 && cm > 5) { const cs = (h[0] * c[0] + h[1] * c[1] + h[2] * c[2]) / (hm * cm); n++; if (cs > 0.3) fol++; else if (cs < -0.3) cnt++; else ind++; }
  }
  const hs = sm._per.head, n1 = sm._per.neck01, n2 = sm._per.neck02;
  return { p99AngSpeed: r1(pct(sp, 0.99), 0), p99Acc: r1(Math.max(hs.p99Acc, n1.p99Acc, n2.p99Acc), 0), snapsPerMin: sm.headSnapsPerMin,
    follow: r1(fol / (n || 1), 2), counter: r1(cnt / (n || 1), 2), independent: r1(ind / (n || 1), 2), movingFrac: r1(n / D.S, 2),
    relToChest: r1(Math.sqrt(relSS / (chSS || 1)), 2) };
}

function rhythm(rec, D) {
  const NB = rec.NB, fs = (D.S - 1) / (D.ts[D.S - 1] - D.ts[0]);
  const E = new Float64Array(D.S);
  for (let s = 0; s < D.S; s++) for (let b = 0; b < NB; b++) if (!TRACK[b].startsWith('toes')) E[s] += mag(D, D.wL, b, NB, s);
  let m = 0; for (const v of E) m += v; m /= E.length; let v0 = 0; for (const v of E) v0 += (v - m) ** 2; v0 /= E.length;
  const acf = (L) => { let s = 0; for (let i = 0; i + L < E.length; i++) s += (E[i] - m) * (E[i + L] - m); return s / (E.length - L) / v0; };
  let aS = -1, aSL = 0, aL = -1, aLL = 0;
  for (let L = Math.round(0.25 * fs); L <= Math.round(2 * fs); L++) { const a = acf(L); if (a > aS) { aS = a; aSL = L; } }
  for (let L = Math.round(2 * fs); L <= Math.min(E.length - 10, Math.round(12 * fs)); L += 2) { const a = acf(L); if (a > aL) { aL = a; aLL = L; } }
  // band power signature per group (local angular velocity, all components)
  const sig = {}, bandTot = [0, 0, 0, 0], rms = {};
  for (const [g, bones] of Object.entries(GROUPS)) {
    const bp = [0, 0, 0, 0]; let ss = 0, cnt = 0;
    for (const n of bones) for (let c = 0; c < 3; c++) {
      const x = series(D, D.wL, BI[n], c, NB); for (const v of x) { ss += v * v; cnt++; }
      const { P, df } = fftPow(x, fs);
      for (let k = 1; k < P.length; k++) { const f = k * df; for (let bi = 0; bi < 4; bi++) if (f >= BANDS[bi][0] && f < BANDS[bi][1]) bp[bi] += P[k]; }
    }
    sig[g] = bp.map(v => +Math.log10(v + 1e-6).toFixed(3)); bp.forEach((v, i) => bandTot[i] += v); rms[g] = r1(Math.sqrt(ss / (cnt || 1)), 1);
  }
  const tot = bandTot.reduce((a, b) => a + b, 0) || 1;
  return { acfShort: r1(aS, 2), acfShortLag: r1(aSL / fs, 2), acfLong: r1(aL, 2), acfLongLag: r1(aLL / fs, 2), bandShare: bandTot.map(v => r1(v / tot, 3)),
    meanSpeed: r1(mean(Array.from(E)) / (NB - 2), 2), rms, sig };
}

function limitsSat(rec, D) {
  const NB = rec.NB, out = {};
  for (let b = 0; b < NB; b++) {
    const n = TRACK[b]; if (/^(upperarm|thigh|shin|foot|toes)/.test(n)) continue; // IK / direction driven
    const L = rec.limits[b]; let sat = 0;
    for (let s = 0; s < D.S; s++) {
      let any = false;
      for (const [c, key] of [[0, 'flex'], [1, 'abd'], [2, 'twist']]) {
        const lo = L[key][0], hi = L[key][1], h = (hi - lo) / 2; if (h < 0.5) continue;
        const v = D.ang[(s * NB + b) * 3 + c]; if (Math.abs(v - (lo + hi) / 2) > 0.75 * h) any = true;
      }
      if (any) sat++;
    }
    out[n] = r1(sat / D.S, 3);
  }
  const sp = ['spine01', 'spine02', 'spine03', 'spine04', 'spine05', 'spine06'];
  return { spine: r1(mean(sp.map(n => out[n])), 3), neckhead: r1(mean(['neck01', 'neck02', 'head'].map(n => out[n])), 3), pelvis: out.pelvis, perJoint: out };
}

// edge cases (variable dt): pose change while time does not advance, spike after resume, irregular dt vs steady
function edge(rec, D, sm) {
  const NB = rec.NB, q = new Float64Array(4); let pauseMax = 0, tinyMax = 0;
  for (let k = 1; k < rec.N; k++) {
    const d = rec.dtIn[k]; if (d > 1e-4) continue;
    let m = 0;
    for (let b = 0; b < NB; b++) { const o = (k * NB + b) * 4, op = ((k - 1) * NB + b) * 4; mulConj(rec.qL[o], rec.qL[o + 1], rec.qL[o + 2], rec.qL[o + 3], rec.qL[op], rec.qL[op + 1], rec.qL[op + 2], rec.qL[op + 3], q); const a = 2 * Math.acos(Math.min(1, Math.abs(q[3]))) * R2D; if (a > m) m = a; }
    if (d === 0) pauseMax = Math.max(pauseMax, m); else tinyMax = Math.max(tinyMax, m);
  }
  const seg = rec.segments || {}, accIdx = sm._accIdx.map((v, i) => Math.max(v, sm._accLeg[i]));
  const p99In = (t0, t1) => { const v = []; for (let s = 2; s < D.S - 2; s++) if (D.ts[s] >= t0 && D.ts[s] < t1) v.push(accIdx[s]); return pct(v, 0.99); };
  const maxIn = (t0, t1) => { let m = 0; for (let s = 2; s < D.S - 2; s++) if (D.ts[s] >= t0 && D.ts[s] < t1) m = Math.max(m, accIdx[s]); return m; };
  const steady = p99In(seg.steady0 || 1, seg.pause || 6);
  return { poseChangeAtDt0Deg: r1(pauseMax, 4), poseChangeAtDt1e5Deg: r1(tinyMax, 4),
    resumeSpike: r1(maxIn(seg.resume, seg.resume + 0.5) / steady, 2), irregularP99VsSteady: r1(p99In(seg.irr0, seg.irr1) / steady, 2),
    bigDtSpike: r1(maxIn(seg.big - 0.05, seg.big + 0.3) / steady, 2) };
}

// Share of frames in which either hand's knuckle point is within 0.18 m of the head point (the two points the rig's face
// opener uses). A hand cupping the crown or sitting on the face counts; a raised hand beside the head does not.
function handHead(rec, D) {
  const NB = rec.NB, bh = BI.head, R = [BI.hand_L, BI.hand_R], TH = 0.18;
  const rot = (o, v) => { const x = rec.qW[o], y = rec.qW[o + 1], z = rec.qW[o + 2], w = rec.qW[o + 3];
    const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]; };
  let n = 0; const per = [0, 0]; let minD = 9;
  for (const k of D.idx) {
    const ho = (k * NB + bh) * 4, hp = (k * NB + bh) * 3, r = rot(ho, rec.headPt);
    const hx = rec.p[hp] + r[0], hy = rec.p[hp + 1] + r[1], hz = rec.p[hp + 2] + r[2];
    let any = false;
    for (let s = 0; s < 2; s++) {
      const b = R[s], q = rot((k * NB + b) * 4, rec.knuck[s]), p = (k * NB + b) * 3;
      const d = Math.hypot(rec.p[p] + q[0] - hx, rec.p[p + 1] + q[1] - hy, rec.p[p + 2] + q[2] - hz);
      if (d < minD) minD = d; if (d < TH) { per[s]++; any = true; }
    }
    if (any) n++;
  }
  return { share: r1(n / D.idx.length, 3), L: r1(per[0] / D.idx.length, 3), R: r1(per[1] / D.idx.length, 3), minDist: r1(minD, 3) };
}

export function computeMetrics(rec, spec) {
  const D = derive(rec);
  const sm = smoothness(rec, D, rec.events);
  const out = { name: spec.name, seconds: r1(D.ts[D.S - 1] - D.ts[0], 2), samples: D.S, nan: rec.nan, hash: rec.hash };
  out.smooth = sm; out.connect = connectedness(rec, D); out.ground = grounding(rec, D); out.head = head(rec, D, sm);
  out.rhythm = rhythm(rec, D); out.limits = limitsSat(rec, D); if (rec.knuck) out.handHead = handHead(rec, D);
  if (rec.dtIn && spec.dtSeq) out.edge = edge(rec, D, sm);
  if (rec.dbg && rec.dbg.names) out.schedule = rec.dbg.names; // engine debug only: body shape | arm postures every 0.5 s
  // plot payloads (stripped before JSON export by the runner)
  out._plot = { t: Array.from(D.ts), knee: [out.ground._plot.kneeL, out.ground._plot.kneeR], margins: out.ground._plot.margins,
    heel: [0, 1].map(s => D.idx.map(k => (rec.pts[(k * rec.NP + s) * 3 + 1] - rec.restPts[s * 3 + 1]) * 1000)),
    ball: [0, 1].map(s => D.idx.map(k => (rec.pts[(k * rec.NP + 2 + s) * 3 + 1] - rec.restPts[(2 + s) * 3 + 1]) * 1000)),
    spineAng: [1, 0].map(c => SPINE.map(n => Array.from(series(D, D.ang, BI[n], c, rec.NB)))),
    dbgLat: rec.dbg && rec.dbg.lat ? rec.dbg.lat : null, switches: rec.dbg ? rec.dbg.switches : null, events: rec.events };
  delete sm._per; delete sm._accIdx; delete sm._accLeg; delete out.ground._plot;
  return out;
}
