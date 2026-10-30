// Motion lab runner: node dev/motion-lab.mjs [--out baseline] [--compare dev/lab/baseline.json] [--only idle,snake] [--no-png] [--prefix lab]
// Runs every scenario in dev/motion-lab.html (server http://127.0.0.1:5181 must be up), writes dev/lab/<out>.json and
// dev/lab/<out>.md, saves plots to dev/shots/<prefix>-*.png. Re-run against a rebuilt engine with --out after
// --compare dev/lab/baseline.json to get a before/after table.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const require = createRequire('/Users/nahrahellouis/context/playwright-parallel-browsers/package.json');
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const OUT = arg('out', 'baseline'), CMP = arg('compare', null), ONLY = arg('only', null), PNG = !process.argv.includes('--no-png'), PFX = arg('prefix', 'lab');
const URL_ = arg('url', 'http://127.0.0.1:5181/dev/motion-lab.html');

const TIER1 = ['float', 'lunas', 'biba', 'lena', 'snake', 'flesh', 'balls', 'curves', 'shake', 'quake', 'boil', 'thick', 'time', 'groove', 'silly', 'explosive'];
const S = [];
S.push({ name: 'idle', layers: {} });
for (const id of TIER1) S.push({ name: id, layers: { [id]: 0.7 } });
for (const id of ['tashi', 'dolfi']) S.push({ name: id, layers: { [id]: 0.7 } }); // the other calm words (generator share only)
S.push({ name: 'snake@0.8', layers: { snake: 0.8 } });
S.push({ name: 'snake+float', layers: { snake: 0.8, float: 0.6 } });
S.push({ name: 'trans lena>snake', warmup: 2, duration: 40, events: [{ t: 10, set: { lena: 0.7 } }, { t: 25, set: { lena: 0 } }, { t: 26, set: { snake: 0.7 } }] });
S.push({ name: 'trans shake>float', warmup: 2, duration: 40, events: [{ t: 10, set: { shake: 0.7 } }, { t: 25, set: { shake: 0 } }, { t: 26, set: { float: 0.7 } }] });
S.push({ name: 'accents', warmup: 8, duration: 20, layers: { float: 0.4 }, events: [{ t: 14, accent: 'explosive' }, { t: 19, accent: 'explosive' }, { t: 24, accent: 'explosive' }] });
S.push({ name: 'stack4', layers: { float: 0.6, lunas: 0.6, lena: 0.6, snake: 0.6 } });
S.push({ name: 'stack4b', layers: { shake: 0.6, thick: 0.6, time: 0.6, groove: 0.5 } });
S.push({ name: 'edge dt', dtSeq: 'edge', layers: { float: 0.5, shake: 0.5 } });
// generator ablations: the word's own generator switched off, everything else identical
const ABL = ['float', 'lunas', 'lena', 'snake', 'balls', 'curves', 'shake', 'quake', 'boil', 'thick', 'groove', 'silly', 'biba', 'flesh', 'time', 'tashi', 'dolfi'];
for (const id of ABL) S.push({ name: `${id} (gen off)`, layers: { [id]: 0.7 }, ablate: [id], ablation: true });
S.push({ name: 'idle (repeat)', layers: {}, repeatOf: 'idle' });

const PLOTS = [
  ['snake@0.8', 'kymo', { span: 20 }], ['snake+float', 'kymo', { span: 20 }], ['lena', 'kymo', { span: 20 }], ['idle', 'kymo', { span: 20 }],
  ['trans lena>snake', 'kymo', { from: 6, span: 30 }],
  ['idle', 'legs', { span: 30 }], ['lunas', 'legs', { span: 30 }], ['groove', 'legs', { span: 20 }], ['stack4', 'legs', { span: 30 }], ['lena', 'legs', { span: 30 }],
];

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL_, { waitUntil: 'load' });
await page.waitForFunction(() => window.__labReady, null, { timeout: 30000 });
const info = await page.evaluate(() => window.labInfo);
const results = {};
const t0 = Date.now();
for (const spec of S) {
  if (ONLY && !ONLY.split(',').includes(spec.name)) continue;
  if (spec.ablation && !info.ablation) continue;
  try { results[spec.name] = await page.evaluate(s => window.runScenario(s), spec); process.stdout.write('.'); }
  catch (e) { results[spec.name] = { error: e.message }; process.stdout.write('x'); }
}
console.log(` ${Object.keys(results).length} scenarios in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (PNG) {
  fs.mkdirSync(path.join(ROOT, 'dev/shots'), { recursive: true });
  for (const [name, kind, opts] of PLOTS) {
    if (!results[name] || results[name].error) continue;
    const url = await page.evaluate(([n, k, o]) => window.renderPlot(n, k, o), [name, kind, opts]);
    if (!url) continue;
    const file = path.join(ROOT, 'dev/shots', `${PFX}-${kind}-${name.replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '')}.png`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', path.relative(ROOT, file));
  }
}
await browser.close();
if (errs.length) console.log('page errors:\n' + errs.slice(0, 10).join('\n'));

// ------------------------------------------------------------------ cross-scenario analysis
const R = results, idle = R.idle;
const cross = {};
if (idle && !idle.error) {
  // determinism
  if (R['idle (repeat)']) cross.deterministic = R['idle (repeat)'].hash === idle.hash;
  // sameness: each word's band-power signature relative to idle; cosine similarity between words
  const vec = (r) => Object.keys(idle.rhythm.sig).flatMap(g => r.rhythm.sig[g].map((v, i) => v - idle.rhythm.sig[g][i]));
  const words = TIER1.filter(w => R[w] && !R[w].error);
  const V = Object.fromEntries(words.map(w => [w, vec(R[w])]));
  const cos = (a, b) => { let s = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return s / Math.sqrt(na * nb || 1); };
  const sim = {}; let tot = 0, n = 0;
  for (const a of words) { sim[a] = {}; for (const b of words) { const c = +cos(V[a], V[b]).toFixed(2); sim[a][b] = c; if (a < b) { tot += c; n++; } } }
  const norm = Object.fromEntries(words.map(w => [w, +Math.sqrt(V[w].reduce((s, x) => s + x * x, 0) / V[w].length).toFixed(3)]));
  cross.sameness = { meanPairCos: +(tot / n).toFixed(2), distFromIdle: norm, sim };
  // generator share: how much of a word's motion its own generator makes (RMS angular speed with vs without it)
  const share = {};
  for (const id of ABL) {
    const a = R[id], b = R[`${id} (gen off)`]; if (!a || !b || a.error || b.error) continue;
    share[id] = { full: a.rhythm.meanSpeed, genOff: b.rhythm.meanSpeed, idle: idle.rhythm.meanSpeed, genShare: +(1 - b.rhythm.meanSpeed / a.rhythm.meanSpeed).toFixed(2),
      sigCosGenOffVsFull: +cos(vec(b), vec(a)).toFixed(2) };
  }
  cross.generatorShare = share;
  // schedule overlap: share of 0.5 s samples where two words hold the same body shape and the same two arm postures (same seed)
  if (idle.schedule) {
    const ov = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) if (a[i] === b[i]) s++; return n ? s / n : 0; };
    const sc = {}; let t2 = 0, n2 = 0;
    const ws = ['idle', ...words].filter(w => R[w].schedule);
    for (const a of ws) { sc[a] = {}; for (const b of ws) { const v = +ov(R[a].schedule, R[b].schedule).toFixed(2); sc[a][b] = v; if (a < b && a !== 'idle' && b !== 'idle') { t2 += v; n2++; } } }
    const bodyOnly = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) if (a[i].split('|')[0] === b[i].split('|')[0]) s++; return n ? s / n : 0; };
    let t3 = 0; for (const a of words) for (const b of words) if (a < b) t3 += bodyOnly(R[a].schedule, R[b].schedule);
    cross.scheduleOverlap = { meanPairFullPose: +(t2 / (n2 || 1)).toFixed(2), meanPairBodyShape: +(t3 / (n2 || 1)).toFixed(2), withIdle: Object.fromEntries(words.map(w => [w, sc.idle[w]])), matrix: sc };
  }
}
const out = { generated: new Date().toISOString(), url: URL_, scenarios: S.map(s => s.name), results: R, cross, pageErrors: errs };
fs.mkdirSync(path.join(ROOT, 'dev/lab'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `dev/lab/${OUT}.json`), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(ROOT, `dev/lab/${OUT}.md`), markdown(out, CMP ? JSON.parse(fs.readFileSync(path.resolve(ROOT, CMP), 'utf8')) : null));
console.log(`wrote dev/lab/${OUT}.json and dev/lab/${OUT}.md`);

// ------------------------------------------------------------------ markdown
function markdown(o, base) {
  const L = [], R = o.results, f = (v, d = 1) => (v == null ? '-' : typeof v === 'number' ? (+v.toFixed(d)).toString() : v);
  const pc = (v) => (v == null ? '-' : (v * 100).toFixed(0) + '%');
  const rows = Object.keys(R).filter(k => !R[k].error && !k.includes('(gen off)') && !k.includes('(repeat)'));
  const B = base && base.results;
  const cell = (v, bv, d = 1, p = false) => { const s = p ? pc(v) : f(v, d); if (!B || bv == null || v == null) return s; return `${s} (${p ? pc(bv) : f(bv, d)})`; };
  L.push(`# Motion lab ${OUT}`, '', `${o.generated}. Fixed dt 1/60, seed 7, soloist, warmup 8 s then 30 s recorded unless noted. ${B ? 'Values in brackets: ' + CMP + '.' : ''}`, '');
  L.push('Snap = joint angular acceleration above 3000 deg/s^2 (velocity change over 50 deg/s inside one frame); snaps/min counts snap events (frames merged within 0.1 s) in the upper body (trunk, neck, head, arms) or the legs and feet. Jerk kurtosis: 3 = smooth Gaussian texture, higher = impulsive. Trunk wave r: mean |peak cross-correlation| of neighbouring spine01..06 lateral bend angles (6 s trend removed); trunk lag: spine01 to spine06 lag (positive = wave travels up); phase on trunk: that lag divided by the wave period (a readable S-wave needs about 0.5); chest>head r: spine06 vs head lateral bend (negative = the head cancels the wave); sagittal amp: mean sagittal wave amplitude per spine joint. Spine sat: share of frames with a spine joint inside the soft-clamp zone (over 75% of its limit).', '');
  L.push('## Smoothness and connectedness', '');
  L.push('| scenario | snaps/min upper | snaps/min legs | p99 acc trunk | p99 acc arms | jerk kurt trunk | jerk kurt arms | trunk wave r | trunk lag s (up +) | phase on trunk | chest>head r | sagittal amp deg | spine sat | arm passive r |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of rows) { const r = R[k], b = B && B[k];
    L.push(`| ${k} | ${cell(r.smooth.upperSnapsPerMin, b?.smooth?.upperSnapsPerMin)} | ${cell(r.smooth.legSnapsPerMin, b?.smooth?.legSnapsPerMin)} | ${cell(r.smooth.region.trunk.p99Acc, b?.smooth?.region?.trunk?.p99Acc, 0)} | ${cell(r.smooth.region.armDist.p99Acc, b?.smooth?.region?.armDist?.p99Acc, 0)} | ${cell(r.smooth.region.trunk.kurt, b?.smooth?.region?.trunk?.kurt)} | ${cell(r.smooth.region.armDist.kurt, b?.smooth?.region?.armDist?.kurt)} | ${cell(r.connect.lateral.meanR, b?.connect?.lateral?.meanR, 2)} | ${cell(r.connect.lateral.trunkEndToEnd.lag, b?.connect?.lateral?.trunkEndToEnd?.lag, 2)} | ${cell(r.connect.lateral.phaseOnTrunk, b?.connect?.lateral?.phaseOnTrunk, 2)} | ${cell(r.connect.lateral.chestToHead.r, b?.connect?.lateral?.chestToHead?.r, 2)} | ${cell(r.connect.sagittal.segAmp, b?.connect?.sagittal?.segAmp, 1)} | ${cell(r.limits.spine, b?.limits?.spine, 2, true)} | ${cell(r.connect.armPassive.L.r, b?.connect?.armPassive?.L?.r, 2)} |`); }
  L.push('', '## Grounding, balance, head', '');
  L.push('| scenario | slide max mm | toe / heel penetration mm | heel lift L/R | steps/min | lifts/min | toe drag mm/min | COM outside % | COM p5 mm | stance knee p5/p50/p95 | head/neck sat | head counter/follow | head p99 deg/s | ACF 0.25-2 s |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const k of rows) { const r = R[k], g = r.ground, b = B && B[k], bg = b?.ground;
    L.push(`| ${k} | ${cell(g.slideMaxMm, bg?.slideMaxMm)} | ${cell(g.penetrationByPointMm.toe, bg?.penetrationByPointMm?.toe)} / ${f(g.penetrationByPointMm.heel)} | ${pc(g.feet.L.heelLift)}/${pc(g.feet.R.heelLift)} | ${cell(g.stepsPerMin, bg?.stepsPerMin)} | ${cell(g.liftsPerMin, bg?.liftsPerMin)} | ${cell(g.toeDragMmPerMin, bg?.toeDragMmPerMin, 0)} | ${cell(g.unbalancedFrac, bg?.unbalancedFrac, 1, true)} | ${cell(g.comMarginP5Mm, bg?.comMarginP5Mm, 0)} | ${g.kneeStance.p5}/${g.kneeStance.p50}/${g.kneeStance.p95} | ${cell(r.limits.neckhead, b?.limits?.neckhead, 1, true)} | ${pc(r.head.counter)}/${pc(r.head.follow)} | ${cell(r.head.p99AngSpeed, b?.head?.p99AngSpeed, 0)} | ${cell(r.rhythm.acfShort, b?.rhythm?.acfShort, 2)} |`); }
  L.push('', '## Hands near the head', '', 'Share of frames in which either hand\'s knuckle point is within 0.18 m of the head point (rig.js face opener points). Target 3% or less for float, idle, lena, snake, lunas and the stacks.', '', '| scenario | share | left | right | closest m |', '|---|---|---|---|---|');
  for (const k of rows) { const r = R[k], b = B && B[k]; if (!r.handHead) continue;
    L.push(`| ${k} | ${cell(r.handHead.share * 100, b?.handHead && b.handHead.share * 100, 1)}% | ${f(r.handHead.L * 100, 1)}% | ${f(r.handHead.R * 100, 1)}% | ${f(r.handHead.minDist, 3)} |`); }
  L.push('', '## Events and posture switches\n\nPeak upper-body acceleration in the 3 s after a layer change or accent (or 0.8 s around an internal posture switch), relative to a typical window with no event or switch. Legs: peak leg acceleration in the 3 s after the event, same baseline.', '');
  for (const k of rows) { const r = R[k]; const ev = r.smooth.events, sw = r.smooth.switches;
    if (!ev.length && !sw) continue;
    L.push(`- **${k}**: ${ev.map(e => `${e.what} @${e.t.toFixed(1)}s upper x${e.peakVsTypical} legs x${e.legsPeakVsTypical}`).join(', ') || 'no events'}${sw ? `; shape/arm switches ${sw.count} (${sw.perMin}/min), upper peak x${sw.peakVsTypical} avg (worst x${sw.worst}); steps starting within 3 s after a body-shape switch ${r.ground.stepsAfterBodySwitch == null ? '-' : pc(r.ground.stepsAfterBodySwitch)} of ${r.ground.steps}` : ''}`); }
  if (R['edge dt']?.edge) { const e = R['edge dt'].edge; L.push('', `Edge dt: pose change during dt=0 ${e.poseChangeAtDt0Deg} deg, during dt=1e-5 ${e.poseChangeAtDt1e5Deg} deg, resume spike x${e.resumeSpike}, irregular dt p99 x${e.irregularP99VsSteady}, dt=0.5 (clamped) spike x${e.bigDtSpike}, NaN ${R['edge dt'].nan}.`); }
  const c = o.cross;
  if (c.sameness) {
    L.push('', '## Sameness across words', '', `Determinism (idle twice, same hash): ${c.deterministic}. Mean pairwise cosine of the words' band-power change vs idle (11 body groups x 4 bands): **${c.sameness.meanPairCos}**${B && base.cross?.sameness ? ` (${base.cross.sameness.meanPairCos})` : ''} (1 = every word moves away from idle in the same way).`, '');
    if (c.scheduleOverlap) L.push(`Same seed, different words: the body shape and both arm postures are identical in **${pc(c.scheduleOverlap.meanPairFullPose)}** of 0.5 s samples on average across word pairs (body shape alone: ${pc(c.scheduleOverlap.meanPairBodyShape)}).`, '');
    L.push('| word | distance from idle (log10 power) | own generator share of motion | full / gen off / idle mean speed deg/s | same pose as idle |', '|---|---|---|---|---|');
    for (const w of Object.keys(c.sameness.distFromIdle)) { const g = c.generatorShare[w];
      L.push(`| ${w} | ${c.sameness.distFromIdle[w]} | ${g ? pc(g.genShare) : '-'} | ${g ? `${g.full} / ${g.genOff} / ${g.idle}` : '-'} | ${c.scheduleOverlap ? pc(c.scheduleOverlap.withIdle[w]) : '-'} |`); }
  }
  return L.join('\n') + '\n';
}
