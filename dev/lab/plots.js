// dev/lab/plots.js: canvas renderers for the motion lab (kymograph of the spine wave, legs and balance traces).
// Diverging scale: blue (negative) to a neutral grey midpoint to red (positive). Series: left = blue, right = orange.
const BG = '#fbfbfa', INK = '#1d1d1b', MUTED = '#6b6a64', GRID = '#e1e0d9', AXIS = '#c3c2b7';
const NEG = [24, 79, 149], MID = [240, 239, 236], POS = [165, 44, 43];
const SER = ['#2a78d6', '#eb6834'];
const SEG = ['pelvis', 'spine01', 'spine02', 'spine03', 'spine04', 'spine05', 'spine06', 'neck01', 'neck02', 'head'];

function div(v, m) { // value -> rgb on the diverging scale, |v| >= m saturates
  const x = Math.max(-1, Math.min(1, v / (m || 1))), a = Math.abs(x), c = x < 0 ? NEG : POS;
  const k = Math.pow(a, 0.85);
  return `rgb(${Math.round(MID[0] + (c[0] - MID[0]) * k)},${Math.round(MID[1] + (c[1] - MID[1]) * k)},${Math.round(MID[2] + (c[2] - MID[2]) * k)})`;
}
function p99abs(rows) { const v = []; for (const r of rows) for (const x of r) v.push(Math.abs(x)); v.sort((a, b) => a - b); return v[Math.floor(v.length * 0.99)] || 1; }

function heat(ctx, x0, y0, w, h, rows, t, m, title, note) {
  const nR = rows.length, nT = rows[0].length, rh = h / nR;
  ctx.fillStyle = INK; ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif'; ctx.fillText(title, x0, y0 - 10);
  if (note) { ctx.fillStyle = MUTED; ctx.font = '12px ui-sans-serif, system-ui, sans-serif'; ctx.fillText(note, x0 + ctx.measureText(title).width + 220, y0 - 10); }
  for (let r = 0; r < nR; r++) { // head on top
    const y = y0 + (nR - 1 - r) * rh;
    for (let px = 0; px < w; px++) {
      const i0 = Math.floor(px / w * nT), i1 = Math.max(i0 + 1, Math.floor((px + 1) / w * nT));
      let s = 0; for (let i = i0; i < i1 && i < nT; i++) s += rows[r][i];
      ctx.fillStyle = div(s / (i1 - i0), m); ctx.fillRect(x0 + px, y, 1, rh - 1);
    }
    ctx.fillStyle = MUTED; ctx.font = '11px ui-monospace, Menlo, monospace'; ctx.textAlign = 'right'; ctx.fillText(SEG[r], x0 - 6, y + rh * 0.65); ctx.textAlign = 'left';
  }
  // time ticks
  ctx.strokeStyle = AXIS; ctx.fillStyle = MUTED; ctx.font = '11px ui-monospace, Menlo, monospace';
  const tA = t[0], tB = t[t.length - 1];
  for (let s = Math.ceil(tA); s <= tB; s++) { if ((s - Math.ceil(tA)) % 2) continue; const x = x0 + (s - tA) / (tB - tA) * w; ctx.beginPath(); ctx.moveTo(x, y0 + h); ctx.lineTo(x, y0 + h + 4); ctx.stroke(); ctx.fillText(s + 's', x - 8, y0 + h + 16); }
}
function legendBar(ctx, x, y, w, m, label) {
  for (let i = 0; i < w; i++) { ctx.fillStyle = div((i / (w - 1) * 2 - 1) * m, m); ctx.fillRect(x + i, y, 1, 10); }
  ctx.fillStyle = MUTED; ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.fillText(`-${m.toFixed(1)}`, x - 34, y + 9); ctx.fillText(`+${m.toFixed(1)} deg`, x + w + 6, y + 9); ctx.fillText(label, x, y + 24);
}

export function renderKymo(canvas, res, { title, from = null, span = 20 } = {}) {
  const P = res._plot, t = P.t, t0 = from ?? t[0], i0 = t.findIndex(x => x >= t0), i1 = Math.min(t.length, i0 + Math.round(span * 60));
  const cut = (rows) => rows.map(r => r.slice(i0, i1)), tt = t.slice(i0, i1);
  const panels = [[cut(P.spineAng[0]), 'Lateral bend per joint (bone local, deg). Left bend = red, right = blue'],
    [cut(P.spineAng[1]), 'Sagittal bend per joint (bone local, deg). Flexion = red, extension = blue']];
  if (P.dbgLat) panels.push([cut(P.dbgLat), 'Engine channel C (lateral, deg) before the rig soft clamp']);
  const W = 1500, ph = 190, gap = 70, top = 60;
  canvas.width = W; canvas.height = top + panels.length * (ph + gap) + 30;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = BG; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = INK; ctx.font = '600 16px ui-sans-serif, system-ui, sans-serif'; ctx.fillText(title || `Spine kymograph: ${res.name}`, 20, 26);
  const c = res.connect.lateral;
  ctx.fillStyle = MUTED; ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`A travelling wave shows diagonal stripes. Lateral: spine01 to spine06 lag ${c.trunkEndToEnd.lag}s (r ${c.trunkEndToEnd.r}), period ${c.period}s, phase on trunk ${c.phaseOnTrunk} of a wavelength, amplitude ${c.segAmp} deg/joint, chest to head r ${c.chestToHead.r}. Scale set by pelvis..spine06; neck and head saturate.`, 20, 46);
  const m = Math.max(p99abs(panels[0][0].slice(0, 7)), p99abs(panels[1][0].slice(0, 7)));
  panels.forEach(([rows, label], k) => {
    const y = top + 24 + k * (ph + gap);
    const mm = k === 2 ? p99abs(rows.slice(0, 7)) : m;
    heat(ctx, 80, y, W - 300, ph, rows, tt, mm, label);
    legendBar(ctx, W - 190, y + 10, 120, mm, k === 2 ? 'own scale' : 'shared scale');
  });
  return canvas.toDataURL('image/png');
}

function line(ctx, x0, y0, w, h, t, series, { lo, hi, title, unit, bands = [], labels = ['left', 'right'] }) {
  ctx.fillStyle = INK; ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif'; ctx.fillText(title, x0, y0 - 10);
  const X = (i) => x0 + (t[i] - t[0]) / (t[t.length - 1] - t[0]) * w, Y = (v) => y0 + h - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * h;
  for (const [a, b, col] of bands) { ctx.fillStyle = col; ctx.fillRect(x0, Y(b), w, Y(a) - Y(b)); }
  ctx.strokeStyle = GRID; ctx.lineWidth = 1; ctx.fillStyle = MUTED; ctx.font = '11px ui-monospace, Menlo, monospace';
  const step = niceStep((hi - lo) / 4);
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) { ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x0 + w, Y(v)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(`${+v.toFixed(1)}`, x0 - 6, Y(v) + 4); ctx.textAlign = 'left'; }
  ctx.fillText(unit, x0 - 50, y0 - 10 + 0);
  for (let s = Math.ceil(t[0]); s <= t[t.length - 1]; s += 2) { const x = x0 + (s - t[0]) / (t[t.length - 1] - t[0]) * w; ctx.fillText(s + 's', x - 8, y0 + h + 15); }
  series.forEach((ser, k) => {
    if (!ser) return; ctx.strokeStyle = SER[k]; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < ser.length; i++) { const x = X(i), y = Y(ser[i]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  });
  // legend (identity never colour alone: the label sits beside the swatch)
  let lx = x0 + w - 170;
  series.forEach((ser, k) => { if (!ser) return; ctx.fillStyle = SER[k]; ctx.fillRect(lx, y0 - 20, 14, 3); ctx.fillStyle = INK; ctx.font = '12px ui-sans-serif, system-ui, sans-serif'; ctx.fillText(labels[k], lx + 18, y0 - 15); lx += 80; });
}
function niceStep(x) { const p = Math.pow(10, Math.floor(Math.log10(x))); const m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }

export function renderLegs(canvas, res, { title, from = null, span = 20 } = {}) {
  const P = res._plot, t0 = from ?? P.t[0], i0 = P.t.findIndex(x => x >= t0), i1 = Math.min(P.t.length, i0 + Math.round(span * 60));
  const t = P.t.slice(i0, i1), cut = (a) => a.slice(i0, i1);
  const W = 1500, ph = 150, gap = 62, top = 70, x0 = 80, w = W - 120;
  canvas.width = W; canvas.height = top + 4 * (ph + gap);
  const ctx = canvas.getContext('2d'); ctx.fillStyle = BG; ctx.fillRect(0, 0, W, canvas.height);
  ctx.fillStyle = INK; ctx.font = '600 16px ui-sans-serif, system-ui, sans-serif'; ctx.fillText(title || `Legs and balance: ${res.name}`, 20, 26);
  const g = res.ground;
  ctx.fillStyle = MUTED; ctx.font = '12px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`knee p5/p50/p95 ${g.knee.p5}/${g.knee.p50}/${g.knee.p95} deg | heel lift L ${g.feet.L.heelLift} R ${g.feet.R.heelLift} | steps ${g.steps}, lifts ${g.lifts} | slide max ${g.slideMaxMm} mm | COM outside support ${(g.unbalancedFrac * 100).toFixed(1)}% of frames`, 20, 46);
  const kn = P.knee.map(cut), hmax = Math.max(40, ...P.heel.flat().slice(0, 1)), heel = P.heel.map(cut), ball = P.ball.map(cut);
  line(ctx, x0, top + 20, w, ph, t, kn, { lo: 0, hi: 70, title: 'Knee flexion (deg). Shaded: locked under 3 deg, deep over 60 deg', unit: 'deg', bands: [[0, 3, 'rgba(227,73,72,0.12)'], [60, 70, 'rgba(42,120,214,0.10)']] });
  line(ctx, x0, top + 20 + (ph + gap), w, ph, t, heel, { lo: -10, hi: Math.min(120, Math.max(60, ...heel.flat())), title: 'Heel height above the resting contact (mm). Below 0 = through the floor', unit: 'mm', bands: [[-10, 0, 'rgba(227,73,72,0.12)']] });
  line(ctx, x0, top + 20 + 2 * (ph + gap), w, ph, t, ball, { lo: -10, hi: Math.min(120, Math.max(40, ...ball.flat())), title: 'Ball of foot height above the resting contact (mm)', unit: 'mm', bands: [[-10, 0, 'rgba(227,73,72,0.12)']] });
  const mg = P.margins.slice(i0, i1).map(v => (isFinite(v) ? v * 1000 : 0));
  line(ctx, x0, top + 20 + 3 * (ph + gap), w, ph, t.slice(0, mg.length), [mg], { lo: Math.min(-60, ...mg), hi: Math.max(80, ...mg), title: 'Centre of mass margin inside the support polygon (mm). Below 0 = outside the feet', unit: 'mm', bands: [[-500, 0, 'rgba(227,73,72,0.12)']], labels: ['margin'] });
  return canvas.toDataURL('image/png');
}
