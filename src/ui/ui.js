// ui.js: the interface that floats over the studio. OWNER: builder D.
// createUI({ vocab, scripts, engine, cameras, audio, figures, post, studio, app }) -> { update(dt), settings, on(evt, cb), ... }
//
// Layout keeps the middle of the frame for the dancer:
//   left column  = what is happening (Now in the body, class captions)
//   right column = what you can do (the word list, or one word's study card)
//   bottom centre = how you watch (study bar: pause, step, speed, angle, trails, sensation map)
// Phones: the word list becomes a one-row strip above the study bar, cards and panels become bottom sheets.
import { createTeacher } from './teacher.js';
import * as VOCAB_MODULE from '../vocab.js';

const APP_NAME = ['Gaga', 'World'];
const STORE_KEY = 'gaga-world:settings:v1';
const COACH_KEY = 'gaga-world:coach:v1';
const DEFAULTS = Object.freeze({ sensationMap: false, sound: true, volume: 0.7, material: 'charcoal', quality: 'high' });

const REGION_ORDER = ['center', 'pelvis', 'spine', 'extremities', 'flesh', 'texture', 'whole'];
const REGION_LABEL = { center: 'Center', pelvis: 'Pelvis', spine: 'Spine', extremities: 'Hands and feet', flesh: 'Flesh', texture: 'Texture', whole: 'Whole body' };
const KIND_LABEL = { generator: 'Movement', modifier: 'Quality', accent: 'Accent' };
const LANDMARK_LABEL = { lena: 'Lena, low in the belly', biba: 'the sit bones and pelvis', luna: 'the pads of the hands and feet', spine: 'the spine', flesh: 'the flesh', feet: 'the feet', head: 'the head', hands: 'the hands' };
const SOURCE = {
  A: 'From Gaga or Ohad Naharin’s own words.',
  B: 'Several independent accounts describe it the same way.',
  C: 'A single account describes it.',
};
const SPEEDS = [[0.25, '¼', 'Quarter speed'], [0.5, '½', 'Half speed'], [1, '1×', 'Full speed']];
const FALLBACK_VIEWS = [
  { id: 'three', label: 'Three-quarter' }, { id: 'front', label: 'Front' }, { id: 'side', label: 'Side' }, { id: 'back', label: 'Back' },
  { id: 'overhead', label: 'Overhead' }, { id: 'hands', label: 'Hands' }, { id: 'feet', label: 'Feet' }, { id: 'spine', label: 'Spine' }, { id: 'pelvis', label: 'Pelvis' },
];
const MODES = [
  { id: 'orbit', label: 'Orbit', tip: 'Circle the dancer freely. Drag to turn, scroll to come closer.' },
  { id: 'walk', label: 'Walk', tip: 'Stand at eye level in the room, at the edge of the floor.' },
  { id: 'join', label: 'Join', tip: 'You join the class as a dancer. Gaga classes have no observers.' },
  { id: 'director', label: 'Director', tip: 'The camera moves on its own and frames the part of the body the words live in.' },
];
const MATERIALS = [['charcoal', 'Charcoal', 'A dark cast surface, like iron.'], ['plaster', 'Plaster', 'A pale, chalky surface.'], ['graphite', 'Graphite', 'A soft grey with a faint sheen.']];
const QUALITIES = [['high', 'High', 'Full shadows and light. Best on a desktop.'], ['medium', 'Medium', 'Lighter shadows for laptops and tablets.'], ['low', 'Low', 'The lightest setting, for phones and older machines.']];

// ---- helpers ------------------------------------------------------------------------------------

const safe = (fn) => { try { return fn(); } catch (err) { console.error('[ui]', err); return undefined; } };
const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch { /* private mode */ } },
};

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

function emitter() {
  const m = new Map();
  return {
    on(evt, cb) { if (!m.has(evt)) m.set(evt, new Set()); m.get(evt).add(cb); return () => m.get(evt)?.delete(cb); },
    emit(evt, ...args) { m.get(evt)?.forEach((cb) => safe(() => cb(...args))); },
  };
}

function loadSettings() {
  const out = { ...DEFAULTS };
  try { if (window.matchMedia?.('(max-width: 820px), (pointer: coarse)')?.matches) out.quality = 'medium'; } catch { /* ignore */ }
  let saved = null;
  try { saved = JSON.parse(store.get(STORE_KEY) || 'null'); } catch { saved = null; }
  if (saved && typeof saved === 'object') for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === typeof DEFAULTS[k]) out[k] = saved[k];
  if (!MATERIALS.some(([id]) => id === out.material)) out.material = DEFAULTS.material;
  if (!QUALITIES.some(([id]) => id === out.quality)) out.quality = DEFAULTS.quality;
  out.volume = clamp01(out.volume);
  return out;
}

// ---- icons (20 x 20, hairline) ------------------------------------------------------------------

const ICONS = {
  orbit: '<ellipse cx="10" cy="12" rx="7.6" ry="3.1"/><path d="M10 5.6v8.6"/><circle class="f" cx="10" cy="4.2" r="1.25"/><circle class="f" cx="15.6" cy="13.9" r="1.35"/>',
  walk: '<path d="M2.4 10.4h2.4M15.2 10.4h2.4"/><path d="M5.4 10.4c1.4-2.5 2.9-3.7 4.6-3.7s3.2 1.2 4.6 3.7c-1.4 2.5-2.9 3.7-4.6 3.7s-3.2-1.2-4.6-3.7z"/><circle class="f" cx="10" cy="10.4" r="1.45"/>',
  join: '<circle cx="6.8" cy="5.4" r="1.75"/><path d="M4.3 16.6v-3.9a2.5 2.5 0 0 1 5 0v3.9"/><circle class="f" cx="13.4" cy="5.4" r="1.75"/><path class="f2" d="M10.9 16.6v-3.9a2.5 2.5 0 0 1 5 0v3.9z"/><path d="M2.6 16.6h14.8"/>',
  director: '<path d="M3 6.6V3.6h3M14 3.6h3v3M17 13.4v3h-3M6 16.4H3v-3"/><circle cx="10" cy="10" r="2.3"/>',
  view: '<path d="M3 6.6V3.6h3M14 3.6h3v3M17 13.4v3h-3M6 16.4H3v-3"/><circle cx="10" cy="7.6" r="1.6"/><path d="M7.4 14.4c.4-2.2 1.3-3.4 2.6-3.4s2.2 1.2 2.6 3.4"/>',
  settings: '<path d="M3 6.2h8.4M15.6 6.2H17M3 13.8h1.6M8.6 13.8H17"/><circle cx="13.5" cy="6.2" r="2.1"/><circle cx="6.6" cy="13.8" r="2.1"/>',
  show: '<path d="M2.8 10c1.9-3 4.3-4.5 7.2-4.5s5.3 1.5 7.2 4.5c-1.9 3-4.3 4.5-7.2 4.5S4.7 13 2.8 10z"/><circle cx="10" cy="10" r="2.2"/>',
  close: '<path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/>',
  back: '<path d="M16.5 10H3.6M7.8 5.6 3.4 10l4.4 4.4"/>',
  arrow: '<path d="M3 10h13.4M12.2 5.6 16.6 10l-4.4 4.4"/>',
  out: '<path d="M7 4.5h8.5V13M15.3 4.7 5 15"/>',
  play: '<path class="f" d="M6.6 4.4v11.2l8.9-5.6z"/>',
  pause: '<path d="M7.2 5v10M12.8 5v10"/>',
  step: '<path class="f" d="M4.6 5.2v9.6l6.8-4.8z"/><path d="M14.6 5v10"/>',
  trails: '<path d="M2.8 15.2c2.7-.6 3.9-6.4 7-6.4 2.7 0 3.1 3.4 5 3.4" stroke-dasharray="0.1 2.6"/><circle class="f" cx="16.4" cy="12.1" r="1.7"/>',
  map: '<circle cx="10" cy="4.4" r="1.7"/><path d="M6.6 17.2 7.3 9.1c.1-.9.8-1.5 1.7-1.5h2c.9 0 1.6.6 1.7 1.5l.7 8.1"/><circle class="f" cx="10" cy="11.6" r="1.4"/>',
  fire: '<path d="M10 2.4v3.4M10 14.2v3.4M2.4 10h3.4M14.2 10h3.4M4.6 4.6l2.4 2.4M13 13l2.4 2.4M4.6 15.4 7 13M13 7l2.4-2.4"/><circle class="f" cx="10" cy="10" r="1.3"/>',
  plus: '<path d="M10 4.6v10.8M4.6 10h10.8"/>',
  minus: '<path d="M4.6 10h10.8"/>',
  chev: '<path d="M5.6 8 10 12.4 14.4 8"/>',
  chevup: '<path d="M5.6 12 10 7.6l4.4 4.4"/>',
};
const svg = (name) => `<svg class="ico" viewBox="0 0 20 20" focusable="false" aria-hidden="true">${ICONS[name] || ''}</svg>`;
function icon(name, cls = '') {
  const s = el('span', { class: `ico-wrap ${cls}`.trim(), 'aria-hidden': 'true' });
  s.innerHTML = svg(name);
  return s;
}

// ---- body map (front and side silhouettes from a few measured points) --------------------------

function smoothPath(pts, closed = true) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.min(n - 1, Math.max(0, i))]);
  const f = (v) => v.toFixed(2);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + (closed ? 'Z' : '');
}
function limbOutline(center, widths) {
  const left = [], right = [];
  for (let i = 0; i < center.length; i++) {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
    left.push([center[i][0] - ty * widths[i], center[i][1] + tx * widths[i]]);
    right.push([center[i][0] + ty * widths[i], center[i][1] - tx * widths[i]]);
  }
  return [...left, ...right.reverse()];
}
const BODY = (() => {
  const cx = 70, ang = 24 * Math.PI / 180, ux = Math.sin(ang), uy = Math.cos(ang), nx = uy, ny = -ux, sh = [20.5, 55];
  const along = (d, w) => [sh[0] + ux * d + nx * w, sh[1] + uy * d + ny * w];
  const arm = [[4, 6.4], [14, 6.2], [30, 5.3], [44, 4.4], [52, 4.3], [70, 3.6], [84, 2.8], [90, 3.6], [98, 3.6], [104, 2.3]];
  const half = [
    [0, 6], [7.5, 7.8], [11.2, 14.5], [12.2, 23], [11, 30.5], [8.2, 36], [5.8, 39.5], [5.6, 45], [9.5, 48.6], [16, 50.6], [22.6, 52.4],
    ...arm.map(([d, w]) => along(d, w)), along(108, 0), ...arm.slice().reverse().filter(([d]) => d >= 14).map(([d, w]) => along(d, -w)),
    [18.6, 73], [17.6, 84], [15.6, 97], [16.4, 109], [18.8, 121], [20, 132], [19.2, 150], [16.8, 171], [15, 186], [15.6, 198],
    [13.4, 218], [10.2, 235], [11.6, 241.5], [14, 246.5], [12, 249], [5, 249], [4, 244], [4.6, 235], [5.2, 218], [5.6, 199], [4.4, 186], [4, 170], [2.8, 150], [0.9, 134],
  ];
  const hand = along(97, 0), upper = along(26, 0);
  const front = {
    w: 140, outline: smoothPath([...half.map(([x, y]) => [cx + x, y]), ...half.slice(1).reverse().map(([x, y]) => [cx - x, y])]), extra: '',
    spots: {
      lena: [[cx, 113]], head: [[cx, 21]], feet: [[cx - 9.5, 245], [cx + 9.5, 245]], hands: [[cx - hand[0], hand[1]], [cx + hand[0], hand[1]]],
      luna: [[cx - hand[0], hand[1] + 3], [cx + hand[0], hand[1] + 3], [cx - 10.5, 246.5], [cx + 10.5, 246.5]],
      flesh: [[cx, 103], [cx - 10, 158], [cx + 10, 158], [cx - upper[0], upper[1]], [cx + upper[0], upper[1]]], biba: [[cx, 128]],
    },
    spine: smoothPath([[cx, 43], [cx, 70], [cx, 100], [cx, 132]], false), bowl: `M${cx - 14} 118Q${cx} 142 ${cx + 14} 118`,
  };
  const sidePts = [
    [40, 6], [46, 7.5], [50.5, 12], [52.5, 19], [52.5, 26], [51, 32], [48.5, 36], [45, 38.5], [44.5, 44], [47, 49], [51, 54], [53, 62], [53.5, 70], [52, 80],
    [50.5, 92], [51.5, 102], [52, 112], [50.5, 122], [49, 129], [50, 140], [49.5, 158], [47.5, 176], [46.8, 186], [46.5, 196], [45.5, 214], [44, 232], [47, 239],
    [54, 244.5], [56.5, 247.5], [54, 249.4], [38, 249.4], [34.5, 247.5], [34, 242], [35.5, 232], [35, 218], [33.5, 204], [35, 190], [35, 176], [33, 160], [31, 146],
    [29.5, 136], [30, 126], [33, 118], [34.5, 108], [33.5, 96], [31.5, 84], [30.5, 70], [31.5, 58], [34, 50], [36.5, 44], [35, 38], [32.5, 32], [31.5, 24], [33.5, 14], [36.5, 8.5],
  ];
  const side = {
    w: 80, outline: smoothPath(sidePts),
    extra: smoothPath(limbOutline([[41.4, 56], [40.8, 76], [40.2, 97], [41.4, 116], [42.8, 133], [44, 142], [45, 152]], [5.4, 4.9, 4.2, 3.6, 2.8, 3.3, 1.1])),
    spots: { lena: [[47, 114]], head: [[42, 22]], feet: [[46, 246]], hands: [[44.2, 146]], luna: [[44.6, 148], [52, 247]], flesh: [[50, 105], [46, 160], [31.5, 140], [40.6, 80]], biba: [[33, 134]] },
    spine: smoothPath([[37.6, 42], [36, 58], [34.6, 80], [36.2, 100], [37, 114], [35, 129]], false), bowl: '',
  };
  return { front, side };
})();
let bmUid = 0;
function bodyMapView(view, ids, label) {
  const uid = `bm${++bmUid}`;
  const set = new Set(ids);
  let hot = '';
  if (set.has('spine')) hot += `<path class="bm-spine-glow" d="${view.spine}"/><path class="bm-spine" d="${view.spine}"/>`;
  if (set.has('biba') && view.bowl) hot += `<path class="bm-bowl" d="${view.bowl}"/>`;
  let k = 0;
  for (const id of ['lena', 'biba', 'head', 'hands', 'luna', 'feet', 'flesh']) {
    if (!set.has(id)) continue;
    const r = id === 'flesh' ? 13 : id === 'luna' ? 8 : 11;
    for (const [x, y] of view.spots[id] || []) {
      hot += `<g class="bm-hot" style="--d:${(k++ % 5) * 0.35}s"><circle class="bm-halo" cx="${x}" cy="${y}" r="${r}" fill="url(#${uid}g)"/><circle class="bm-dot" cx="${x}" cy="${y}" r="${id === 'flesh' ? 2 : 2.7}"/></g>`;
    }
  }
  const all = ids.length === 0 ? ' is-all' : '';
  return `<svg viewBox="0 0 ${view.w} 256" role="img" aria-label="${label}"><defs><radialGradient id="${uid}g"><stop offset="0" stop-color="currentColor" stop-opacity=".62"/><stop offset=".5" stop-color="currentColor" stop-opacity=".24"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient></defs><path class="bm-body${all}" d="${view.outline}"/>${view.extra ? `<path class="bm-limb${all}" d="${view.extra}"/>` : ''}<g>${hot}</g></svg>`;
}
function bodyMap(ids = []) {
  const known = ids.filter((id) => LANDMARK_LABEL[id]);
  const label = known.length ? `Marked: ${known.map((id) => LANDMARK_LABEL[id]).join(', ')}` : 'Felt through the whole body';
  const wrap = el('div', { class: 'bodymap' });
  wrap.innerHTML = `<figure class="bm-fig">${bodyMapView(BODY.front, known, `Front view. ${label}`)}<figcaption>Front</figcaption></figure><figure class="bm-fig">${bodyMapView(BODY.side, known, `Side view. ${label}`)}<figcaption>Side</figcaption></figure>`;
  return wrap;
}

function normalizeNotes(raw) {
  const out = { attribution: '', link: 'https://www.gagapeople.com', principles: [] };
  if (!raw) return out;
  if (typeof raw === 'string') { out.attribution = raw; return out; }
  out.attribution = raw.attribution || raw.about || raw.text || '';
  out.link = raw.link || raw.url || out.link;
  const list = Array.isArray(raw) ? raw : raw.principles || [];
  out.principles = list.map((p) => (typeof p === 'string' ? p : [p?.title, p?.text].filter(Boolean).join('. '))).filter(Boolean);
  return out;
}

// =================================================================================================

export function createUI(opts = {}) {
  const { vocab = [], scripts = [], engine, cameras, audio, post, studio, app } = opts;
  const figuresOf = () => { const f = typeof opts.figures === 'function' ? opts.figures() : opts.figures; return Array.isArray(f) ? f.filter(Boolean) : []; };
  const notes = normalizeNotes(opts.notes || VOCAB_MODULE.GAGA_NOTES);
  const illustrationNote = opts.illustrationNote || VOCAB_MODULE.ILLUSTRATION_NOTE || '';
  const comparison = Array.isArray(opts.comparison || VOCAB_MODULE.GAGA_VS_CLASS) ? (opts.comparison || VOCAB_MODULE.GAGA_VS_CLASS) : [];
  const bus = emitter();
  const settings = loadSettings();
  const byId = new Map(vocab.map((v) => [v.id, v]));
  const keyMap = new Map(vocab.filter((v) => v.key != null && v.key !== '').map((v) => [String(v.key), v]));
  const views = Array.isArray(cameras?.studyViews) && cameras.studyViews.length ? cameras.studyViews : FALLBACK_VIEWS;
  const viewLabel = (id) => views.find((x) => x.id === id)?.label || MODES.find((m) => m.id === id)?.label || cap(id || '');
  const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const compact = () => !!window.matchMedia?.('(max-width: 820px)')?.matches;
  const verb = () => (host.classList.contains('is-touch') ? 'Tap' : 'Click');

  const host = opts.root || document.getElementById('ui') || document.body.appendChild(el('div', { id: 'ui' }));
  host.replaceChildren();
  host.classList.add('ui', 'is-pre');
  try { if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) host.classList.add('is-touch'); } catch { /* ignore */ }
  const chrome = el('div', { class: 'chrome' });
  host.append(chrome);

  const teacher = createTeacher({ engine, scripts });
  let entered = false, hidden = false, openPanel = null, cardId = null;
  let layersNow = [], layerMap = new Map();
  const study = { speed: 1, paused: false, trails: false, view: null, mode: cameras?.mode || 'orbit' };

  // ---- tooltips ---------------------------------------------------------------------------------
  const tip = el('div', { class: 'tip', role: 'tooltip' });
  let tipTimer = 0, tipFor = null, tipWarm = 0;
  function placeTip(t) {
    const r = t.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const x = Math.min(Math.max(r.left + r.width / 2 - tw / 2, 10), window.innerWidth - tw - 10);
    let y = r.top - th - 10;
    if (y < 10 || t.closest('.topbar')) y = r.bottom + 10;
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }
  function showTip(t) {
    const text = t.getAttribute('data-tip');
    if (!text || hidden || !t.isConnected) return;
    tipFor = t; tip.textContent = text; placeTip(t); tip.classList.add('is-on');
  }
  function hideTip() { clearTimeout(tipTimer); if (tipFor) tipWarm = performance.now(); tipFor = null; tip.classList.remove('is-on'); }
  host.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = e.target.closest?.('[data-tip]');
    if (!t || t === tipFor) return;
    clearTimeout(tipTimer);
    tip.classList.remove('is-on');
    tipTimer = setTimeout(() => showTip(t), performance.now() - tipWarm < 700 ? 90 : 520);
  });
  host.addEventListener('pointerout', (e) => { const t = e.target.closest?.('[data-tip]'); if (t && !t.contains(e.relatedTarget)) hideTip(); });
  host.addEventListener('focusin', (e) => {
    const t = e.target.closest?.('[data-tip]');
    let fv = false; try { fv = !!t && e.target.matches(':focus-visible'); } catch { fv = false; }
    if (fv) { clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(t), 260); }
  });
  host.addEventListener('focusout', hideTip);
  host.addEventListener('pointerdown', hideTip);

  // ---- toast ------------------------------------------------------------------------------------
  const toastEl = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
  let toastT = 0;
  function toast(text, ms = 2600) {
    toastEl.textContent = text;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), ms);
  }

  // ---- settings ---------------------------------------------------------------------------------
  function applySetting(key) {
    if (key === 'material') for (const f of figuresOf()) safe(() => f.setMaterial?.(settings.material));
    else if (key === 'quality') { safe(() => post?.setQuality?.(settings.quality)); safe(() => studio?.setQuality?.(settings.quality)); }
    else if (key === 'sound' && entered) safe(() => audio?.setEnabled?.(settings.sound));
    else if (key === 'volume') safe(() => audio?.setVolume?.(settings.volume));
  }
  function setSetting(key, value, force = false) {
    if (settings[key] === value && !force) return;
    settings[key] = value;
    applySetting(key);
    store.set(STORE_KEY, JSON.stringify(settings));
    syncSettingsUI();
    bus.emit('settings', settings, key);
  }

  // =================================================================================================
  // Entry: three ways in
  // =================================================================================================
  const firstClass = scripts[0];
  const studyWord = vocab.find((v) => v.region === 'center' && (v.tier || 1) === 1) || vocab[0];
  const pathBtn = (n, title, desc, onclick, cls = '') => el('button', { class: `path ${cls}`.trim(), type: 'button', onclick },
    el('span', { class: 'path-n', text: n }), el('span', { class: 'path-text' }, el('span', { class: 'path-title', text: title }), el('span', { class: 'path-desc', text: desc })), icon('arrow', 'path-arrow'));
  const paths = el('div', { class: 'paths', role: 'group', 'aria-label': 'Ways to begin' },
    firstClass ? pathBtn('01', `Take the ${firstClass.title.toLowerCase()}`, `${firstClass.minutes ? `${firstClass.minutes} minutes. ` : ''}A teacher adds words one by one. You watch them stack.`, () => begin('class'), 'is-primary') : null,
    pathBtn(firstClass ? '02' : '01', 'Explore the words', 'Add and release words yourself, at your own pace.', () => begin('explore')),
    studyWord ? pathBtn(firstClass ? '03' : '02', 'Study one word', `${studyWord.word}: ${studyWord.gloss.charAt(0).toLowerCase()}${studyWord.gloss.slice(1)}. Slowed down, with what to watch for.`, () => begin('study')) : null,
  );
  const entry = el('section', { class: 'entry', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'entry-title' },
    el('div', { class: 'entry-wash' }),
    el('div', { class: 'entry-inner' },
      el('h1', { class: 'entry-title', id: 'entry-title' }, el('span', { class: 'entry-a', text: APP_NAME[0] }), el('span', { class: 'entry-b', text: APP_NAME[1] })),
      el('p', { class: 'entry-line', text: 'Gaga is Ohad Naharin’s movement language, taught through spoken images that stack on top of each other. Learn its words by watching one dancer take them on.' }),
      paths,
      el('p', { class: 'entry-meta' },
        el('button', { class: 'btn-text', type: 'button', 'data-tip': 'Where Gaga comes from and how a class differs from other dance classes.', onclick: () => showPanel('about') }, 'About Gaga'),
        el('span', { text: `${vocab.length} words · ${scripts.length} ${scripts.length === 1 ? 'class' : 'classes'} · Sound starts when you enter` })),
    ));
  host.append(entry);

  function enter() {
    if (entered) return;
    entered = true;
    safe(() => audio?.setVolume?.(settings.volume));
    safe(() => audio?.setEnabled?.(settings.sound));
    if (settings.sound) safe(() => { const p = audio?.start?.(); if (p?.catch) p.catch(() => {}); });
    host.classList.remove('is-pre');
    host.classList.add('is-entering');
    entry.classList.add('is-leaving');
    if (openPanel === 'about') closePanels();
    setTimeout(() => { entry.remove(); host.classList.remove('is-entering'); }, reduced() ? 0 : 1000);
    bus.emit('enter');
  }
  function begin(path) {
    enter();
    if (path === 'class' && firstClass) startClass(firstClass.id);
    else if (path === 'study' && studyWord) setTimeout(() => { openCard(studyWord.id); showMe(studyWord.id); }, reduced() ? 0 : 450);
    else setTimeout(() => coachStart(), reduced() ? 0 : 900);
  }

  // =================================================================================================
  // Top bar: brand, class, about, settings, shortcuts
  // =================================================================================================
  const classLabel = el('span', { class: 'class-label', text: 'Take a class' });
  const classBtn = el('button', { class: 'btn-top btn-class', type: 'button', onclick: onClassButton }, el('span', { class: 'class-dot', 'aria-hidden': 'true' }), classLabel);
  const aboutBtn = el('button', { class: 'btn-top', type: 'button', 'data-tip': 'Where Gaga comes from and how a class differs from other dance classes.', onclick: () => togglePanel('about') }, 'About Gaga');
  const setBtn = el('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Settings', 'aria-expanded': 'false', 'data-tip': 'Sound, how the figure looks, quality, and hiding the interface.', onclick: () => togglePanel('settings') }, icon('settings'));
  const helpBtn = el('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Keyboard shortcuts', 'data-tip': 'Keyboard shortcuts. Press ? at any time.', onclick: () => togglePanel('help') }, el('span', { class: 'qmark', 'aria-hidden': 'true', text: '?' }));
  chrome.append(el('header', { class: 'topbar' },
    el('div', { class: 'brand', 'aria-label': APP_NAME.join(' ') }, el('span', { class: 'brand-a', text: APP_NAME[0] }), el('span', { class: 'brand-b', text: APP_NAME[1] })),
    el('div', { class: 'top-actions' }, classBtn, aboutBtn, el('span', { class: 'vrule', 'aria-hidden': 'true' }), setBtn, helpBtn)));

  // =================================================================================================
  // Left column: Now in the body
  // =================================================================================================
  const stackCount = el('span', { class: 'stack-count', text: '0' });
  const stackSummary = el('span', { class: 'stack-summary' });
  const stackHead = el('button', { class: 'stack-head', type: 'button', 'aria-expanded': 'true', 'data-tip': 'Fold or open the list of layers.', onclick: () => setStackFolded(!stack.classList.contains('is-folded')) },
    el('span', { class: 'eyebrow ink', text: 'Now in the body' }), stackCount, icon('chev', 'stack-chev'), stackSummary);
  const stackList = el('ol', { class: 'stack-list', 'aria-label': 'Active layers, in the order they were added' });
  const stackEmpty = el('p', { class: 'stack-empty' },
    el('span', { text: 'With no words, the body still breathes and listens. Gaga classes never stop.' }),
    el('span', { class: 'stack-hint', text: 'Add a word from the list to start the first layer.' }));
  const releaseAll = el('button', { class: 'btn-text', type: 'button', 'data-tip': 'Let every layer go. Each fades at its own pace and the body returns to breathing.', onclick: () => safe(() => engine?.releaseAll?.()) }, 'Release all');
  const stack = el('aside', { class: 'stack panel', 'aria-label': 'Now in the body' }, stackHead,
    el('div', { class: 'stack-body' }, stackEmpty, stackList, el('div', { class: 'stack-foot' }, el('span', { class: 'stack-note', text: 'Each word stacks on the ones before.' }), releaseAll)));
  chrome.append(stack);
  function setStackFolded(f) { stack.classList.toggle('is-folded', f); stackHead.setAttribute('aria-expanded', f ? 'false' : 'true'); }
  if (compact()) setStackFolded(true);

  function makeDial(id, word) {
    const env = el('span', { class: 'dial-env' });
    const input = el('input', { class: 'dial-input', type: 'range', min: '0', max: '100', step: '1', value: '70', 'aria-label': `${word} intensity`, 'data-tip': `How much ${word} the body takes on. The thumb is where you set it; the line is the body getting there.` });
    const dial = el('div', { class: 'dial' }, el('span', { class: 'dial-track' }), env, input);
    const d = { dial, drag: false, lastEnv: -1, lastTarget: -1 };
    input.addEventListener('pointerdown', () => { d.drag = true; });
    input.addEventListener('input', () => safe(() => engine?.setLayer?.(id, Number(input.value) / 100)));
    for (const ev of ['pointerup', 'pointercancel', 'blur']) input.addEventListener(ev, () => { d.drag = false; });
    d.sync = (L) => {
      const t = L ? clamp01(L.target) : 0, v = L ? clamp01(L.value) : 0;
      if (Math.abs(v - d.lastEnv) > 0.002) { d.lastEnv = v; env.style.transform = `scaleX(${v.toFixed(4)})`; }
      if (!d.drag && Math.abs(t - d.lastTarget) > 0.004) { d.lastTarget = t; input.value = String(Math.round(t * 100)); }
    };
    return d;
  }

  const rows = new Map();
  const classIds = new Set();
  let lastSummary = null;
  function makeRow(id) {
    const v = byId.get(id) || { id, word: cap(id) };
    const idx = el('span', { class: 'layer-idx', 'aria-hidden': 'true' });
    const word = el('button', { class: 'layer-word', type: 'button', 'data-tip': `Open the study card for ${v.word}.`, onclick: () => openCard(id) }, v.word);
    const val = el('span', { class: 'layer-val' });
    const x = el('button', { class: 'layer-x', type: 'button', 'aria-label': `Release ${v.word}`, 'data-tip': `Release ${v.word}. The body lets it go slowly.`, onclick: () => safe(() => engine?.setLayer?.(id, 0)) }, icon('close'));
    const dial = makeDial(id, v.word);
    const tag = el('span', { class: 'layer-tag', 'data-tip': 'The teacher added this layer. You can still change or release it.' });
    const li = el('li', { class: 'layer is-entering', 'data-id': id },
      el('div', { class: 'layer-inner' }, idx, el('div', { class: 'layer-main' }, el('div', { class: 'layer-line' }, word, val, x), el('div', { class: 'layer-dialrow' }, dial.dial, tag))));
    const len = String(v.word).length;
    return { id, li, idx, word, val, tag, dial, stretchMax: len > 14 ? 104 : len > 10 ? 112 : 125, leaving: false, lastV: -1, lastTxt: '', lastIdx: '', fromClass: false };
  }
  function syncStack(layers) {
    const seen = new Set(), order = [];
    for (const L of layers) {
      seen.add(L.id);
      let r = rows.get(L.id);
      if (!r) {
        r = makeRow(L.id);
        rows.set(L.id, r);
        stackList.append(r.li);
        requestAnimationFrame(() => requestAnimationFrame(() => r.li.classList.remove('is-entering')));
      }
      if (r.leaving) { r.leaving = false; clearTimeout(r.leaveT); r.li.classList.remove('is-leaving'); }
      order.push(r);
      const v = clamp01(L.value), t = clamp01(L.target), releasing = t <= 0.0001;
      r.li.classList.toggle('is-releasing', releasing);
      if (Math.abs(v - r.lastV) > 0.003) {
        r.lastV = v;
        r.word.style.fontStretch = `${(96 + (r.stretchMax - 96) * v).toFixed(1)}%`;
        r.word.style.fontWeight = String(Math.round(360 + 300 * v));
      }
      const txt = releasing ? 'letting go' : String(Math.round(t * 100));
      if (txt !== r.lastTxt) { r.lastTxt = txt; r.val.textContent = txt; }
      const fromClass = classIds.has(L.id);
      if (fromClass !== r.fromClass) { r.fromClass = fromClass; r.tag.textContent = fromClass ? 'class' : ''; }
      r.dial.sync(L);
    }
    const live = [...stackList.children].filter((li) => !li.classList.contains('is-leaving'));
    if (live.length !== order.length || live.some((li, i) => li !== order[i].li)) for (const r of order) stackList.append(r.li);
    order.forEach((r, i) => { const s = String(i + 1).padStart(2, '0'); if (s !== r.lastIdx) { r.lastIdx = s; r.idx.textContent = s; } });
    for (const [id, r] of rows) {
      if (seen.has(id) || r.leaving) continue;
      r.leaving = true;
      r.li.classList.add('is-leaving');
      r.leaveT = setTimeout(() => { r.li.remove(); rows.delete(id); }, reduced() ? 0 : 520);
    }
    const active = layers.filter((L) => L.target > 0);
    if (stackCount.textContent !== String(active.length)) stackCount.textContent = String(active.length);
    const summary = active.map((L) => byId.get(L.id)?.word || L.id).join(', ') || 'Breathing and listening';
    if (summary !== lastSummary) { lastSummary = summary; stackSummary.textContent = summary; }
    stack.classList.toggle('is-empty', layers.length === 0);
    releaseAll.disabled = layers.length === 0;
  }

  // =================================================================================================
  // Left column, lower: class captions
  // =================================================================================================
  const subs = el('div', { class: 'subs', 'aria-live': 'polite' });
  const trTitle = el('span', { class: 'cap-title' });
  const trTime = el('span', { class: 'cap-time' });
  const trFill = el('span', { class: 'cap-fill' });
  const capState = el('span', { class: 'cap-state' });
  const lesson = el('section', { class: 'lesson panel', 'aria-label': 'Class' },
    subs,
    el('div', { class: 'cap-bar', 'aria-hidden': 'true' }, trFill),
    el('div', { class: 'cap-foot' },
      el('span', { class: 'cap-live', 'aria-hidden': 'true' }), trTitle, capState, trTime,
      el('span', { class: 'cap-btns' },
        el('button', { class: 'btn-text', type: 'button', 'data-tip': 'Skip ahead to the next cue.', onclick: () => teacher.skip() }, 'Next cue'),
        el('button', { class: 'btn-text', type: 'button', 'data-tip': 'End the class. Your layers stay until you release them.', onclick: () => teacher.stop() }, 'End'))));
  chrome.append(lesson);

  let lastCueAt = -10, lastLine = null, lastTimeTxt = '';
  const wordSpans = (words, step) => words.flatMap((w, i) => [el('span', { class: 'w', style: `--d:${(i * step).toFixed(2)}s` }, w), ' ']);
  function addCue(text) {
    text = String(text || '').trim();
    if (!text) return;
    const now = performance.now() / 1000;
    const words = text.split(/\s+/);
    const short = words.length <= 2;
    // Rapid short cues (a countdown) gather on one line instead of flushing the history.
    if (short && lastLine?.dataset.short === '1' && now - lastCueAt < 2.2 && lastLine.childElementCount < 24) {
      lastCueAt = now;
      lastLine.append(el('span', { class: 'sep', 'aria-hidden': 'true' }), ...wordSpans(words, 0.06));
      return;
    }
    lastCueAt = now;
    const line = el('p', { class: 'sub' }, wordSpans(words, Math.max(0.05, Math.min(0.11, 2.2 / words.length))));
    line.dataset.short = short ? '1' : '0';
    subs.append(line);
    lastLine = line;
    const lines = [...subs.children].filter((n) => !n.classList.contains('is-gone'));
    lines.forEach((n, i) => {
      const age = lines.length - 1 - i;
      n.dataset.age = String(Math.min(age, 3));
      if (age >= 3) { n.classList.add('is-gone'); setTimeout(() => n.remove(), reduced() ? 0 : 800); }
    });
  }
  teacher.on('cue', (c) => { if (c.step?.set) for (const id of Object.keys(c.step.set)) classIds.add(id); addCue(c.text); });
  teacher.on('start', ({ script }) => {
    subs.replaceChildren(); lastLine = null; classIds.clear();
    trTitle.textContent = script?.title || 'Class';
    host.classList.add('is-teaching');
    closePanels('classes');
    syncClassButton();
  });
  teacher.on('end', ({ reason }) => {
    classIds.clear();
    if (reason === 'restart') return;
    toast(reason === 'complete' ? 'The class is over. The body keeps moving; release the layers when you are ready.' : 'Class ended. Your layers stay until you release them.', 4200);
    setTimeout(() => { if (teacher.state === 'idle') host.classList.remove('is-teaching'); }, reason === 'complete' ? 3500 : 200);
    syncClassButton();
  });
  function syncClassButton() {
    const active = teacher.state !== 'idle';
    classLabel.textContent = active ? 'End class' : 'Take a class';
    classBtn.classList.toggle('is-on', active);
    classBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    classBtn.setAttribute('data-tip', active ? 'End the class. Your layers stay until you release them.' : 'A teacher leads a class: words arrive over time and stack. You can add your own at any point. Press T.');
  }
  syncClassButton();
  function syncCaptions() {
    if (teacher.state === 'idle') return;
    const d = teacher.duration || 1;
    trFill.style.transform = `scaleX(${clamp01(teacher.time / d).toFixed(4)})`;
    const txt = `${fmtTime(teacher.time)} / ${fmtTime(d)}`;
    if (txt !== lastTimeTxt) { lastTimeTxt = txt; trTime.textContent = txt; }
    const st = study.paused ? 'Paused' : '';
    if (capState.textContent !== st) capState.textContent = st;
  }

  const classes = el('div', { class: 'pop classes', role: 'dialog', 'aria-label': 'Choose a class', tabindex: '-1' },
    el('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    el('p', { class: 'eyebrow ink', text: 'Choose a class' }),
    el('p', { class: 'pop-sub', text: 'The teacher adds and releases words over time. Add your own whenever you like.' }),
    el('div', { class: 'class-list' }, scripts.map((s) => {
      const ids = [];
      for (const st of s.steps || []) for (const id of Object.keys(st.set || {})) if (!ids.includes(id)) ids.push(id);
      const names = ids.map((id) => byId.get(id)?.word || id);
      return el('button', { class: 'class-item', type: 'button', onclick: () => startClass(s.id) },
        el('span', { class: 'ci-title', text: s.title }), el('span', { class: 'ci-min', text: s.minutes ? `${s.minutes} min` : '' }),
        el('span', { class: 'ci-meta', text: names.length > 4 ? `${names.slice(0, 4).join(', ')} and ${names.length - 4} more` : names.join(', ') }), icon('arrow', 'ci-arrow'));
    })));
  chrome.append(classes);
  function startClass(id) {
    if (!entered) enter();
    if (study.paused) setPaused(false);
    teacher.start(id);
    toast('Class begins. Keep your eyes open and keep moving.', 2600);
  }
  function onClassButton() {
    if (teacher.state !== 'idle') { teacher.stop(); return; }
    if (scripts.length > 1) togglePanel('classes'); else if (scripts.length === 1) startClass(scripts[0].id);
  }

  // =================================================================================================
  // Right column: the word list (a one-row strip on phones)
  // =================================================================================================
  const chips = new Map();
  function makeWord(v) {
    const accent = v.kind === 'accent';
    const btn = el('button', { class: 'word-btn', type: 'button', 'aria-pressed': 'false', 'aria-label': `${v.word}. ${v.gloss}.${v.key ? ` Key ${v.key}.` : ''}`, onclick: () => toggleWord(v.id) },
      el('span', { class: 'ring', 'aria-hidden': 'true' }, el('span', { class: 'ring-key', text: v.key != null && v.key !== '' ? String(v.key) : '' })),
      el('span', { class: 'word-name', 'data-text': v.word }, el('span', { class: 'word-text', text: v.word })));
    const fire = accent ? el('button', { class: 'word-fire', type: 'button', 'aria-label': `Fire ${v.word} once`, 'data-tip': `Fire ${v.word} once: a single burst, then back to what the body was doing.`, onclick: () => fireAccent(v.id) }, icon('fire')) : null;
    const info = el('button', { class: 'word-info', type: 'button', 'aria-label': `Study ${v.word}`, 'data-tip': `Open the study card for ${v.word}: what to watch for and what to try.`, onclick: () => openCard(v.id) }, icon('arrow'));
    const wrap = el('li', { class: `word${accent ? ' is-accent' : ''}`, 'data-id': v.id }, btn, fire, info);
    chips.set(v.id, { v, btn, wrap, on: false, live: false, lastV: -1 });
    btn.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') schedulePreview(v.id, wrap); });
    btn.addEventListener('pointerleave', () => schedulePreview(null));
    btn.addEventListener('focus', () => { let fv = false; try { fv = btn.matches(':focus-visible'); } catch { fv = false; } if (fv) schedulePreview(v.id, wrap, 150); });
    btn.addEventListener('blur', () => schedulePreview(null));
    return wrap;
  }
  function groupsFor(tier) {
    const words = vocab.filter((v) => (tier === 1 ? (v.tier || 1) <= 1 : (v.tier || 1) > 1));
    const regions = [...new Set(words.map((v) => v.region))].sort((a, b) => ((REGION_ORDER.indexOf(a) + 1 || 99) - (REGION_ORDER.indexOf(b) + 1 || 99)));
    return regions.map((region) => el('div', { class: 'group', role: 'group', 'aria-label': REGION_LABEL[region] || cap(region) },
      el('span', { class: 'group-label', 'aria-hidden': 'true', text: REGION_LABEL[region] || cap(region) }),
      el('ul', { class: 'group-words' }, words.filter((w) => w.region === region).map(makeWord))));
  }
  const tier2Count = vocab.filter((v) => (v.tier || 1) > 1).length;
  const tier2 = el('div', { class: 'tier-2', id: 'more-words' }, el('div', { class: 'tier-inner' }, groupsFor(2)));
  const moreBtn = tier2Count ? el('button', { class: 'more-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'more-words', onclick: () => setMore(!rail.classList.contains('is-more')) },
    icon('plus', 'more-ico'), el('span', { class: 'more-label' }), el('span', { class: 'more-count', text: String(tier2Count) })) : null;
  const rail = el('nav', { class: 'rail panel', 'aria-label': 'Gaga words' },
    el('div', { class: 'rail-head' }, el('span', { class: 'eyebrow ink', text: 'Words' }), el('span', { class: 'rail-hint', text: `${verb()} to add. ${verb()} again to release.` })),
    el('div', { class: 'rail-scroll' }, el('div', { class: 'tier-1' }, groupsFor(1)), moreBtn, tier2Count ? tier2 : null));
  chrome.append(rail);
  function setMore(on) {
    rail.classList.toggle('is-more', on);
    if (!moreBtn) return;
    moreBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    moreBtn.querySelector('.more-label').textContent = on ? 'Fewer words' : 'More words';
    moreBtn.setAttribute('data-tip', on ? 'Show only the words a first class uses.' : `Show ${tier2Count} more words from later in a class.`);
    moreBtn.querySelector('.more-ico').innerHTML = svg(on ? 'minus' : 'plus');
    if (on) requestAnimationFrame(() => tier2.scrollIntoView?.({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest', inline: 'start' }));
  }
  setMore(false);

  function toggleWord(id) {
    const wasOn = !!layerMap.get(id) && layerMap.get(id).target > 0;
    safe(() => engine?.toggleLayer?.(id));
    const c = chips.get(id);
    if (c) { c.wrap.classList.remove('is-tapped'); void c.wrap.offsetWidth; c.wrap.classList.add('is-tapped'); }
    if (!wasOn) coachDone('word');
  }
  function fireAccent(id) {
    safe(() => engine?.accent?.(id));
    for (const n of [chips.get(id)?.wrap, cardId === id ? card : null]) { if (!n) continue; n.classList.remove('is-fired'); void n.offsetWidth; n.classList.add('is-fired'); }
  }
  function syncWords() {
    for (const [id, c] of chips) {
      const L = layerMap.get(id);
      const v = L ? clamp01(L.value) : 0, on = !!L && L.target > 0;
      if (Math.abs(v - c.lastV) > 0.004) { c.lastV = v; c.wrap.style.setProperty('--v', v.toFixed(3)); }
      if (on !== c.on) { c.on = on; c.wrap.classList.toggle('is-on', on); c.btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
      const live = v > 0.01;
      if (live !== c.live) { c.live = live; c.wrap.classList.toggle('is-live', live); }
    }
  }

  // Hover preview, to the side of the list.
  const preview = el('div', { class: 'preview', 'aria-hidden': 'true' });
  chrome.append(preview);
  let previewT = 0, previewId = null;
  function schedulePreview(id, anchor, delay = 300) {
    clearTimeout(previewT);
    if (!id) { previewT = setTimeout(hidePreview, 120); return; }
    previewT = setTimeout(() => showPreview(id, anchor), preview.classList.contains('is-on') ? 60 : delay);
  }
  function showPreview(id, anchor) {
    const v = byId.get(id);
    if (!v || hidden || openPanel === 'card') return;
    previewId = id;
    preview.replaceChildren(
      el('p', { class: 'eyebrow', text: [REGION_LABEL[v.region] || cap(v.region), KIND_LABEL[v.kind] || cap(v.kind)].join(' · ') }),
      el('p', { class: 'pv-word', text: v.word }),
      el('p', { class: 'pv-gloss', text: v.gloss }),
      v.cue ? el('p', { class: 'pv-cue', text: `“${v.cue}”` }) : null,
      el('p', { class: 'pv-hint', text: `${verb()} to ${chips.get(id)?.on ? 'release' : 'add'}${v.key ? ` (key ${v.key})` : ''}. The arrow opens its study card.` }));
    preview.classList.add('is-on');
    const r = anchor.getBoundingClientRect(), pw = preview.offsetWidth, ph = preview.offsetHeight;
    if (compact()) {
      preview.style.left = `${Math.round(Math.min(Math.max(r.left + r.width / 2 - pw / 2, 12), window.innerWidth - pw - 12))}px`;
      preview.style.top = `${Math.round(r.top - ph - 12)}px`;
    } else {
      const rr = rail.getBoundingClientRect();
      preview.style.left = `${Math.round(rr.left - pw - 14)}px`;
      preview.style.top = `${Math.round(Math.min(Math.max(r.top + r.height / 2 - ph / 2, 80), window.innerHeight - ph - 90))}px`;
    }
  }
  function hidePreview() { previewId = null; preview.classList.remove('is-on'); }

  // =================================================================================================
  // Study card (replaces the word list on the right; a bottom sheet on phones)
  // =================================================================================================
  const card = el('article', { class: 'card panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'card-word', tabindex: '-1' });
  chrome.append(card);
  let cardParts = null;
  const section = (title, ...kids) => el('section', { class: 'card-sec' }, el('h3', { class: 'eyebrow', text: title }), ...kids);
  function renderCard(v) {
    const dial = makeDial(v.id, v.word);
    const addLabel = el('span', { text: 'Add to the body' });
    const addIco = icon('plus');
    const addBtn = el('button', { class: 'btn btn-solid', type: 'button', onclick: () => toggleWord(v.id) }, addIco, addLabel);
    const fireBtn = v.kind === 'accent' ? el('button', { class: 'btn btn-line card-fire', type: 'button', 'data-tip': `Fire ${v.word} once. F does the same while this card is open.`, onclick: () => fireAccent(v.id) }, icon('fire'), 'Fire once') : null;
    const showBtn = el('button', { class: 'btn btn-line btn-show', type: 'button', onclick: () => showMe(v.id) }, icon('show'), 'Show me');
    const preset = v.show || {};
    const presetText = [preset.view ? viewLabel(preset.view) : null, SPEEDS.find((s) => s[0] === preset.speed)?.[2]?.toLowerCase(), preset.trails ? 'trails on' : null, preset.map ? 'sensation map on' : null].filter(Boolean).join(', ');
    showBtn.setAttribute('data-tip', `Set up the best view to see ${v.word}${presetText ? `: ${presetText}` : ''}. Adds the word if it is not in the body yet.`);
    const meta = [REGION_LABEL[v.region] || cap(v.region), KIND_LABEL[v.kind] || cap(v.kind), v.key ? `Key ${v.key}` : null].filter(Boolean).join(' · ');
    const grade = String(v.confidence || '').toUpperCase();
    card.replaceChildren(
      el('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
      el('div', { class: 'card-top' },
        el('button', { class: 'btn-text card-back', type: 'button', 'data-tip': 'Back to the list of words. Esc also works.', onclick: () => closePanels() }, icon('back'), 'Words'),
        el('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Close the card', 'data-tip': 'Close the card. Esc also works.', onclick: () => closePanels() }, icon('close'))),
      el('div', { class: 'card-scroll' },
        el('header', { class: 'card-head' },
          el('p', { class: 'eyebrow', text: meta }),
          el('h2', { class: 'card-word', id: 'card-word', text: v.word }),
          el('p', { class: 'card-gloss', text: v.gloss })),
        section('What it is',
          el('p', { class: 'card-text', text: v.meaning }),
          v.cue ? el('figure', { class: 'card-cue' }, el('blockquote', {}, el('p', { text: `“${v.cue}”` })), el('figcaption', { text: 'What a teacher might say' })) : null),
        el('section', { class: 'card-sec' },
          el('div', { class: 'sec-head' }, el('h3', { class: 'eyebrow', text: 'Watch for' }), showBtn),
          v.lookFor?.length ? el('ul', { class: 'card-list' }, v.lookFor.map((t) => el('li', { text: t }))) : el('p', { class: 'card-text muted', text: 'Watch the whole body and notice what changes.' })),
        v.explore?.length ? section('Try in your body', el('ul', { class: 'card-list is-questions' }, v.explore.map((t) => el('li', { text: t })))) : null,
        section('Where you feel it', el('div', { class: 'feel' }, el('p', { class: 'card-text feel-text', text: v.sensation || 'Through the whole body' }), bodyMap(v.bodyMap || []))),
        SOURCE[grade] ? section('Source strength', el('div', { class: 'source' }, el('span', { class: 'grade', text: grade, 'data-tip': 'How firmly the research backs this description. A: Gaga or Naharin\u2019s own words. B: several independent accounts. C: a single account.' }), el('p', { class: 'card-text', text: SOURCE[grade] }))) : null,
        illustrationNote ? el('p', { class: 'fine', text: illustrationNote }) : null),
      el('div', { class: 'card-foot' },
        el('div', { class: 'card-dial' }, el('span', { class: 'eyebrow', text: 'Intensity' }), dial.dial),
        el('div', { class: 'card-buttons' }, fireBtn, addBtn)));
    cardParts = { dial, addBtn, addLabel, addIco, on: null };
    card.classList.toggle('has-fire', !!fireBtn);
  }
  function openCard(id, focus = true) {
    const v = byId.get(id);
    if (!v) return;
    hidePreview();
    if (cardId !== id || !cardParts) renderCard(v);
    cardId = id;
    showPanel('card');
    syncCard();
    card.querySelector('.card-scroll').scrollTop = 0;
    if (focus) requestAnimationFrame(() => card.focus({ preventScroll: true }));
  }
  function syncCard() {
    if (openPanel !== 'card' || !cardParts) return;
    const L = layerMap.get(cardId), on = !!L && L.target > 0;
    if (on !== cardParts.on) {
      cardParts.on = on;
      card.classList.toggle('is-active', on);
      cardParts.addLabel.textContent = on ? 'Release' : 'Add to the body';
      cardParts.addIco.innerHTML = svg(on ? 'minus' : 'plus');
      cardParts.addBtn.className = `btn ${on ? 'btn-line' : 'btn-solid'}`;
      cardParts.addBtn.setAttribute('data-tip', on ? 'Release this word. The body lets it go slowly.' : 'Add this word as a layer. It stacks on whatever is already in the body.');
    }
    cardParts.dial.sync(L);
  }

  // "Show me": the angle, speed and overlays where this word's detail is easiest to see.
  function showMe(id) {
    const v = byId.get(id);
    if (!v) return;
    const L = layerMap.get(id);
    if (!L || L.target <= 0) safe(() => engine?.setLayer?.(id, 0.7));
    let preset = null;
    if (app?.show) preset = safe(() => app.show(id));
    if (!preset) {
      preset = v.show || {};
      if (preset.view) setView(preset.view, false);
      if (preset.speed) setSpeed(preset.speed, false);
      setTrails(!!preset.trails);
    }
    if (preset?.view) study.view = preset.view;
    if (preset?.map) setSetting('sensationMap', true, true);
    if (study.paused && app?.paused === false) study.paused = false;
    syncStudy(true);
    const bits = [preset?.view ? viewLabel(preset.view) : null, SPEEDS.find((s) => s[0] === preset?.speed)?.[2]?.toLowerCase(), preset?.trails ? 'trails' : null, preset?.map ? 'sensation map' : null].filter(Boolean);
    toast(`${v.word}: ${bits.join(', ')}`, 2400);
  }

  // =================================================================================================
  // Study bar (bottom centre): pause, step, speed, angle, trails, sensation map
  // =================================================================================================
  const hasApp = !!app;
  const pauseBtn = el('button', { class: 'sb-btn', type: 'button', disabled: !hasApp || null, 'aria-label': 'Pause', onclick: () => setPaused(!study.paused) }, icon('pause'));
  const stepBtn = el('button', { class: 'sb-btn', type: 'button', disabled: !hasApp || null, 'aria-label': 'Step one frame', 'data-tip': 'Step forward one frame. Pauses first if needed. Period key.', onclick: () => stepFrame() }, icon('step'));
  const speedBtns = SPEEDS.map(([val, label, name]) => {
    const b = el('button', { class: 'sb-seg', type: 'button', role: 'radio', 'aria-checked': 'false', disabled: !hasApp || null, 'aria-label': name, 'data-tip': `${name}. Slows the dancer only; the camera and the class keep their pace. [ and ] change speed.`, onclick: () => setSpeed(val) }, label);
    b.dataset.value = String(val);
    return b;
  });
  const speedSeg = el('div', { class: 'sb-group', role: 'radiogroup', 'aria-label': 'Speed' }, speedBtns);
  const viewLabelEl = el('span', { class: 'sb-view-label', text: 'Angle' });
  const viewBtn = el('button', { class: 'sb-view', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'data-tip': 'Choose an angle, or another way to watch. V cycles the angles.', onclick: () => togglePanel('views') }, icon('view'), viewLabelEl, icon('chevup', 'sb-chev'));
  const trailsBtn = el('button', { class: 'sb-btn sb-toggle', type: 'button', 'aria-pressed': 'false', disabled: !hasApp || null, 'aria-label': 'Trails', 'data-tip': 'Trails: thin lines that show where the hands, head, pelvis and feet just travelled. R key.', onclick: () => setTrails(!study.trails) }, icon('trails'), el('span', { class: 'sb-text', text: 'Trails' }));
  const mapBtn = el('button', { class: 'sb-btn sb-toggle', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Sensation map', 'data-tip': 'Sensation map: soft light on the body where the active words are felt.', onclick: () => setSetting('sensationMap', !settings.sensationMap) }, icon('map'), el('span', { class: 'sb-text', text: 'Map' }));
  const studybar = el('div', { class: 'studybar panel', role: 'toolbar', 'aria-label': 'Study controls' },
    pauseBtn, stepBtn, el('span', { class: 'sb-rule' }), speedSeg, el('span', { class: 'sb-rule' }), viewBtn, el('span', { class: 'sb-rule' }), trailsBtn, mapBtn);
  chrome.append(studybar);

  const viewBtns = new Map();
  const viewsPop = el('div', { class: 'pop views', role: 'dialog', 'aria-label': 'Angle and ways to watch', tabindex: '-1' },
    el('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    el('p', { class: 'eyebrow ink', text: 'Angle' }),
    el('div', { class: 'view-grid' }, views.map((vw) => {
      const b = el('button', { class: 'view-opt', type: 'button', 'data-tip': `Frame the dancer: ${vw.label.toLowerCase()}. You can keep orbiting from there.`, onclick: () => { setView(vw.id); closePanels(); } }, vw.label);
      viewBtns.set(vw.id, b);
      return b;
    })),
    el('p', { class: 'eyebrow ink pop-gap', text: 'Ways to watch' }),
    el('div', { class: 'mode-list' }, MODES.map((m) => {
      const b = el('button', { class: 'mode-opt', type: 'button', 'data-mode': m.id, onclick: () => { setMode(m.id); closePanels(); } }, icon(m.id), el('span', { class: 'mode-text' }, el('span', { class: 'mode-name', text: m.label }), el('span', { class: 'mode-desc', text: m.tip })));
      viewBtns.set(`mode:${m.id}`, b);
      return b;
    })));
  chrome.append(viewsPop);

  function setPaused(p) {
    if (!app) return;
    safe(() => app.setPaused(!!p));
    study.paused = !!p;
    syncStudy(true);
  }
  function stepFrame() {
    if (!app) return;
    safe(() => app.step());
    study.paused = true;
    syncStudy(true);
  }
  function setSpeed(x, mark = true) {
    if (!app) return;
    safe(() => app.setSpeed(x));
    study.speed = app.speed ?? x;
    syncStudy(true);
    if (mark) coachDone('speed');
  }
  function nudgeSpeed(dir) {
    const i = SPEEDS.findIndex((s) => s[0] === study.speed);
    const next = SPEEDS[Math.min(SPEEDS.length - 1, Math.max(0, (i < 0 ? 2 : i) + dir))];
    setSpeed(next[0]);
    toast(next[2], 1200);
  }
  function setTrails(on) {
    if (!app) return;
    safe(() => app.setTrails(!!on));
    study.trails = !!(app.trails ?? on);
    syncStudy(true);
  }
  function setView(id, mark = true) {
    if (app?.study) safe(() => app.study(id)); else safe(() => cameras?.study?.(id));
    study.view = id;
    study.mode = 'orbit';
    syncStudy(true);
    if (mark) coachDone('angle');
  }
  function cycleView() {
    const i = views.findIndex((v) => v.id === study.view);
    const next = views[(i + 1) % views.length];
    setView(next.id);
    toast(next.label, 1200);
  }
  function setMode(m) {
    safe(() => cameras?.setMode?.(m));
    study.mode = cameras?.mode || m;
    if (m !== 'orbit') study.view = null;
    syncStudy(true);
    if (m === 'join') toast('You joined the class. Gaga classes have no observers.', 3000);
    coachDone('angle');
  }
  function cycleMode() {
    if (cameras?.cycle) safe(() => cameras.cycle());
    else { const i = MODES.findIndex((m) => m.id === study.mode); safe(() => cameras?.setMode?.(MODES[(i + 1) % MODES.length].id)); }
    study.mode = cameras?.mode || study.mode;
    study.view = null;
    syncStudy(true);
    toast(study.mode === 'join' ? 'You joined the class. Gaga classes have no observers.' : `${viewLabel(study.mode)} camera`, 1800);
  }
  safe(() => cameras?.on?.('mode', (m) => { study.mode = m; if (m !== 'orbit') study.view = null; syncStudy(true); }));
  safe(() => cameras?.on?.('study', (v) => { study.view = typeof v === 'string' ? v : v?.id || v?.view || study.view; study.mode = 'orbit'; syncStudy(true); }));

  const lastSync = {};
  function syncStudy(force = false) {
    if (app) {
      study.speed = app.speed ?? study.speed;
      study.paused = !!app.paused;
      study.trails = !!app.trails;
    }
    const key = `${study.speed}|${study.paused}|${study.trails}|${study.view}|${study.mode}|${settings.sensationMap}`;
    if (!force && key === lastSync.key) return;
    lastSync.key = key;
    pauseBtn.replaceChildren(icon(study.paused ? 'play' : 'pause'));
    pauseBtn.setAttribute('aria-label', study.paused ? 'Play' : 'Pause');
    pauseBtn.setAttribute('data-tip', study.paused ? 'Play. Space bar.' : 'Pause the dancer and the class, to look closely. Space bar.');
    pauseBtn.classList.toggle('is-on', study.paused);
    host.classList.toggle('is-paused', study.paused);
    for (const b of speedBtns) { const on = Number(b.dataset.value) === study.speed; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }
    trailsBtn.classList.toggle('is-on', study.trails); trailsBtn.setAttribute('aria-pressed', study.trails ? 'true' : 'false');
    mapBtn.classList.toggle('is-on', !!settings.sensationMap); mapBtn.setAttribute('aria-pressed', settings.sensationMap ? 'true' : 'false');
    const label = study.mode && study.mode !== 'orbit' ? viewLabel(study.mode) : study.view ? viewLabel(study.view) : 'Angle';
    if (viewLabelEl.textContent !== label) viewLabelEl.textContent = label;
    for (const [k, b] of viewBtns) {
      const on = k.startsWith('mode:') ? k.slice(5) === study.mode && !(k === 'mode:orbit' && study.view) : k === study.view && study.mode === 'orbit';
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    host.dataset.cam = study.mode || '';
  }

  // =================================================================================================
  // Settings
  // =================================================================================================
  const switches = new Map(), segs = new Map();
  const makeSwitch = (key, label, tipText) => { const b = el('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-label': label, 'data-tip': tipText, onclick: () => setSetting(key, !settings[key]) }, el('span', { class: 'switch-knob' })); switches.set(key, b); return b; };
  const makeSeg = (key, items, label) => {
    const btns = items.map(([id, name, t]) => { const b = el('button', { class: 'seg-btn', type: 'button', role: 'radio', 'aria-checked': 'false', 'data-tip': t, onclick: () => setSetting(key, id) }, name); b.dataset.value = id; return b; });
    segs.set(key, btns);
    return el('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, btns);
  };
  const volInput = el('input', { class: 'dial-input', type: 'range', min: '0', max: '100', step: '1', 'aria-label': 'Volume', 'data-tip': 'Music volume.' });
  volInput.addEventListener('input', () => setSetting('volume', Number(volInput.value) / 100));
  const volDial = el('div', { class: 'dial vol-dial' }, el('span', { class: 'dial-track' }), volInput);
  const settingsPop = el('div', { class: 'pop settings', role: 'dialog', 'aria-label': 'Settings', tabindex: '-1' },
    el('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    el('div', { class: 'pop-head' }, el('p', { class: 'eyebrow ink', text: 'Settings' }), el('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Close settings', 'data-tip': 'Close settings.', onclick: () => closePanels() }, icon('close'))),
    el('div', { class: 'set-row' }, el('div', { class: 'set-text' }, el('span', { class: 'set-title', text: 'Sound' }), el('span', { class: 'set-desc', text: 'Music that follows the body. M mutes it.' })), makeSwitch('sound', 'Sound', 'Turn the music on or off. M does the same.')),
    el('div', { class: 'set-vol' }, el('span', { class: 'eyebrow', text: 'Volume' }), volDial),
    el('div', { class: 'set-group' }, el('span', { class: 'eyebrow', text: 'Figure' }), makeSeg('material', MATERIALS, 'Figure material')),
    el('div', { class: 'set-group' }, el('span', { class: 'eyebrow', text: 'Quality' }), makeSeg('quality', QUALITIES, 'Quality')),
    el('div', { class: 'pop-foot' },
      el('button', { class: 'btn-text', type: 'button', 'data-tip': 'Hide everything but the dancer. H, or the Show button, brings it back.', onclick: () => { closePanels(); setHidden(true); } }, 'Hide interface'),
      el('button', { class: 'btn-text', type: 'button', 'data-tip': 'Show the three-step tour again.', onclick: () => { closePanels(); store.set(COACH_KEY, ''); coachStart(true); } }, 'Replay the tour'),
      el('button', { class: 'btn-text', type: 'button', 'data-tip': 'Every keyboard shortcut on one page.', onclick: () => showPanel('help') }, 'Shortcuts'),
      el('button', { class: 'btn-text', type: 'button', 'data-tip': 'Where Gaga comes from and how a class differs from other dance classes.', onclick: () => showPanel('about') }, 'About Gaga')));
  chrome.append(settingsPop);
  function syncSettingsUI() {
    for (const [k, b] of switches) { b.setAttribute('aria-checked', settings[k] ? 'true' : 'false'); b.classList.toggle('is-on', !!settings[k]); }
    for (const [k, btns] of segs) for (const b of btns) { const on = b.dataset.value === settings[k]; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }
    volInput.value = String(Math.round(settings.volume * 100));
    volDial.style.setProperty('--vt', settings.volume.toFixed(3));
    host.classList.toggle('is-muted', !settings.sound);
    syncStudy(true);
  }

  // =================================================================================================
  // Sheets: About Gaga, Shortcuts
  // =================================================================================================
  const scrim = el('div', { class: 'scrim', onclick: () => closePanels() });
  const closeX = () => el('button', { class: 'btn-icon', type: 'button', 'aria-label': 'Close', 'data-tip': 'Close. Esc also works.', onclick: () => closePanels() }, icon('close'));
  const about = el('div', { class: 'sheet-modal about', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'about-title', tabindex: '-1' },
    el('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    el('div', { class: 'pop-head' }, el('p', { class: 'eyebrow', text: 'About' }), closeX()),
    el('h2', { class: 'sheet-title', id: 'about-title', text: 'Gaga' }),
    notes.attribution ? el('p', { class: 'about-lede', text: notes.attribution }) : null,
    comparison.length ? el('section', { class: 'about-sec' },
      el('h3', { class: 'eyebrow ink', text: 'Gaga and a typical dance class' }),
      el('table', { class: 'compare' },
        el('thead', {}, el('tr', {}, el('th', { scope: 'col', text: 'In Gaga' }), el('th', { scope: 'col', text: 'In a typical class' }))),
        el('tbody', {}, comparison.map((r) => el('tr', {}, el('td', { text: r.gaga }), el('td', { text: r.typical })))))) : null,
    notes.principles.length ? el('section', { class: 'about-sec' }, el('h3', { class: 'eyebrow ink', text: 'Ideas a class follows' }), el('ol', { class: 'about-list' }, notes.principles.map((p) => el('li', { text: p })))) : null,
    illustrationNote ? el('section', { class: 'about-sec' }, el('h3', { class: 'eyebrow ink', text: 'About the dancer' }), el('p', { class: 'about-note', text: illustrationNote })) : null,
    el('div', { class: 'about-foot' },
      el('a', { class: 'btn btn-line', href: notes.link, target: '_blank', rel: 'noopener noreferrer', 'data-tip': 'Classes, teachers and background from Gaga itself. Opens in a new tab.' },
        el('span', { text: notes.link.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') }), icon('out')),
      el('span', { class: 'about-credit', text: `${APP_NAME.join(' ')} is an independent study of Ohad Naharin’s Gaga.` })));

  const sc = (keys, desc) => el('div', { class: 'sc-row' }, el('span', { class: 'sc-keys' }, keys.map((k) => el('kbd', { text: k }))), el('span', { text: desc }));
  const help = el('div', { class: 'sheet-modal help', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'help-title', tabindex: '-1' },
    el('div', { class: 'sheet-grip', 'aria-hidden': 'true' }),
    el('div', { class: 'pop-head' }, el('p', { class: 'eyebrow', text: 'Keyboard' }), closeX()),
    el('h2', { class: 'sheet-title', id: 'help-title', text: 'Shortcuts' }),
    el('div', { class: 'sc-cols' },
      el('div', {}, el('h3', { class: 'eyebrow ink', text: 'Words' }), [...keyMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => sc([k], v.word))),
      el('div', {},
        el('h3', { class: 'eyebrow ink', text: 'Study' }),
        sc(['Space'], 'Pause or play'), sc(['.'], 'Step one frame'), sc(['[', ']'], 'Slower, faster'), sc(['V'], 'Next angle'), sc(['R'], 'Trails on or off'),
        el('h3', { class: 'eyebrow ink sc-gap', text: 'Studio' }),
        sc(['T'], 'Choose a class, or pause it'), sc(['C'], 'Next way to watch'), sc(['M'], 'Sound on or off'), sc(['H'], 'Hide or show the interface'),
        sc(['F'], 'Fire the accent on the open card'), sc(['Esc'], 'Close cards and panels'), sc(['?'], 'This page'))));
  chrome.append(scrim, about, help);

  // =================================================================================================
  // First-run tour: add a word, slow it down, change the angle
  // =================================================================================================
  const COACH = [
    { id: 'word', title: 'Add a word', text: 'Choose any word in the list. It becomes a layer in the body, and the next word stacks on top.', anchor: () => (compact() ? rail : rail.querySelector('.group')) },
    { id: 'speed', title: 'Slow it down', text: 'Watch at half or quarter speed to see the detail. The camera keeps its pace.', anchor: () => speedSeg },
    { id: 'angle', title: 'Change the angle', text: 'Look from the side, from behind, or close on the hands and feet.', anchor: () => viewBtn },
  ];
  const coachText = el('p', { class: 'coach-text' });
  const coachTitle = el('p', { class: 'coach-title' });
  const coachCount = el('span', { class: 'coach-count' });
  const coach = el('div', { class: 'coach', role: 'dialog', 'aria-live': 'polite', 'aria-label': 'Tour' },
    el('div', { class: 'coach-head' }, coachCount, el('button', { class: 'btn-text', type: 'button', 'data-tip': 'Close the tour. You can replay it from Settings.', onclick: () => coachEnd() }, 'Skip tour')),
    coachTitle, coachText, el('span', { class: 'coach-arrow', 'aria-hidden': 'true' }));
  chrome.append(coach);
  let coachStep = -1;
  function coachStart(force = false) {
    if (!force && store.get(COACH_KEY) === 'done') return;
    coachStep = 0;
    // Skip steps already done (for example a word is already in the body).
    if (layersNow.some((L) => L.target > 0)) coachStep = 1;
    coachShow();
  }
  function coachShow() {
    if (coachStep < 0 || coachStep >= COACH.length) return;
    const s = COACH[coachStep];
    coachCount.textContent = `${coachStep + 1} of ${COACH.length}`;
    coachTitle.textContent = s.title;
    coachText.textContent = s.text;
    coach.classList.add('is-on');
    host.dataset.coach = s.id;
    requestAnimationFrame(placeCoach);
  }
  function placeCoach() {
    if (coachStep < 0 || coachStep >= COACH.length) return;
    const a = COACH[coachStep].anchor();
    if (!a) return;
    const r = a.getBoundingClientRect(), cw = coach.offsetWidth, ch = coach.offsetHeight;
    let x, y, side;
    if (!compact() && r.left > window.innerWidth * 0.6) { x = r.left - cw - 16; y = r.top + Math.min(r.height, 120) / 2 - 28; side = 'right'; }
    else { x = r.left + r.width / 2 - cw / 2; y = r.top - ch - 16; side = 'down'; }
    x = Math.min(Math.max(x, 12), window.innerWidth - cw - 12);
    y = Math.max(y, 70);
    coach.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    coach.dataset.side = side;
    const ax = side === 'down' ? Math.min(Math.max(r.left + r.width / 2 - x, 18), cw - 18) : cw;
    coach.style.setProperty('--ax', `${Math.round(ax)}px`);
  }
  function coachDone(id) {
    if (coachStep < 0 || COACH[coachStep]?.id !== id) return;
    coachStep += 1;
    if (coachStep >= COACH.length) { coachEnd(); toast('You have the basics. Press ? any time for shortcuts.', 3000); return; }
    coach.classList.remove('is-on');
    host.dataset.coach = COACH[coachStep].id;
    setTimeout(coachShow, reduced() ? 0 : 450);
  }
  function coachEnd() {
    coachStep = -1;
    coach.classList.remove('is-on');
    delete host.dataset.coach;
    store.set(COACH_KEY, 'done');
  }

  // =================================================================================================
  // Panels: one at a time
  // =================================================================================================
  const panels = { card, settings: settingsPop, classes, about, help, views: viewsPop };
  for (const p of Object.values(panels)) p.inert = true;
  function showPanel(name) {
    if (openPanel && openPanel !== name) { panels[openPanel].classList.remove('is-open'); panels[openPanel].inert = true; }
    openPanel = name;
    const p = panels[name];
    p.inert = false;
    p.classList.add('is-open');
    host.classList.toggle('has-sheet', name === 'about' || name === 'help');
    host.dataset.panel = name;
    setBtn.setAttribute('aria-expanded', name === 'settings' ? 'true' : 'false');
    viewBtn.setAttribute('aria-expanded', name === 'views' ? 'true' : 'false');
    hideTip();
    hidePreview();
    if (name !== 'card') requestAnimationFrame(() => p.focus({ preventScroll: true }));
  }
  function closePanels(only) {
    if (!openPanel || (only && openPanel !== only)) return;
    const p = panels[openPanel];
    p.classList.remove('is-open');
    p.inert = true;
    if (openPanel === 'card' && cardParts) cardParts.on = null;
    openPanel = null;
    host.classList.remove('has-sheet');
    delete host.dataset.panel;
    setBtn.setAttribute('aria-expanded', 'false');
    viewBtn.setAttribute('aria-expanded', 'false');
  }
  function togglePanel(name) { if (openPanel === name) closePanels(); else showPanel(name); }
  document.addEventListener('pointerdown', (e) => {
    if (!openPanel || ['card', 'about', 'help'].includes(openPanel)) return;
    if (panels[openPanel].contains(e.target)) return;
    if ((openPanel === 'settings' && setBtn.contains(e.target)) || (openPanel === 'classes' && classBtn.contains(e.target)) || (openPanel === 'views' && viewBtn.contains(e.target))) return;
    closePanels();
  }, true);

  // =================================================================================================
  // Hide / show
  // =================================================================================================
  const showBtn = el('button', { class: 'show-ui', type: 'button', 'aria-label': 'Show the interface', onclick: () => setHidden(false) }, icon('show'), el('span', { text: 'Show' }));
  host.append(toastEl, showBtn, tip);
  function setHidden(h) {
    if (!entered && h) return;
    hidden = !!h;
    host.classList.toggle('is-hidden', hidden);
    hideTip(); hidePreview();
    if (hidden) toast('Press H, or Show, to bring the interface back.', 2400); else toastEl.classList.remove('is-on');
  }

  // =================================================================================================
  // Keyboard
  // =================================================================================================
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || (t.tagName === 'INPUT' && t.type !== 'range') || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    const k = e.key;
    if (!entered) { if (k === 'Escape' && openPanel) { closePanels(); e.preventDefault(); } return; }
    if (k === 'Escape') {
      if (openPanel) closePanels(); else if (coachStep >= 0) coachEnd(); else if (hidden) setHidden(false); else hidePreview();
      e.preventDefault();
      return;
    }
    if (keyMap.has(k)) { toggleWord(keyMap.get(k).id); e.preventDefault(); return; }
    const onButton = t && (t.tagName === 'BUTTON' || t.tagName === 'A');
    switch (k) {
      case ' ': if (onButton || !app) return; setPaused(!study.paused); break;
      case '.': if (!app) return; stepFrame(); break;
      case '[': if (!app) return; nudgeSpeed(-1); break;
      case ']': if (!app) return; nudgeSpeed(1); break;
      case '?': togglePanel('help'); break;
      default:
        switch (k.toLowerCase()) {
          case 'v': cycleView(); break;
          case 'r': if (!app) return; setTrails(!study.trails); toast(study.trails ? 'Trails on' : 'Trails off', 1200); break;
          case 't':
            if (teacher.state === 'idle') { if (scripts.length > 1) togglePanel('classes'); else if (scripts.length) startClass(scripts[0].id); }
            else if (app) { setPaused(!study.paused); toast(study.paused ? 'Class paused' : 'Class resumed', 1300); }
            else teacher.toggle();
            break;
          case 'c': cycleMode(); break;
          case 'm': setSetting('sound', !settings.sound); toast(settings.sound ? 'Sound on' : 'Sound off', 1300); break;
          case 'h': setHidden(!hidden); break;
          case 'f': if (openPanel === 'card' && byId.get(cardId)?.kind === 'accent') fireAccent(cardId); else return; break;
          default: return;
        }
    }
    e.preventDefault();
  });

  // Layout measurements other modules can read in CSS.
  const measure = () => {
    host.style.setProperty('--sb-h', `${Math.round(studybar.getBoundingClientRect().height)}px`);
    host.style.setProperty('--strip-h', `${Math.round(rail.getBoundingClientRect().height)}px`);
    host.style.setProperty('--lesson-h', `${Math.round(lesson.getBoundingClientRect().height)}px`);
    if (coachStep >= 0) placeCoach();
  };
  if (window.ResizeObserver) { const ro = new ResizeObserver(measure); ro.observe(studybar); ro.observe(rail); ro.observe(lesson); }
  window.addEventListener('resize', () => { measure(); if (tipFor) placeTip(tipFor); });
  document.fonts?.ready?.then(measure).catch(() => {});
  requestAnimationFrame(measure);

  syncSettingsUI();
  applySetting('material');
  applySetting('quality');

  // =================================================================================================
  // Frame update
  // =================================================================================================
  function update(dt) {
    syncStudy();
    // Pausing the dancer also holds the class clock.
    if (!study.paused) teacher.update(dt);
    const layers = safe(() => engine?.getLayers?.()) || [];
    layersNow = layers;
    layerMap = new Map(layers.map((L) => [L.id, L]));
    syncStack(layers);
    syncWords();
    syncCard();
    syncCaptions();
  }

  return {
    update,
    get settings() { return settings; },
    on: bus.on,
    teacher,
    enter,
    begin,
    openCard: (id) => openCard(id, false),
    showMe,
    closePanels: () => closePanels(),
    openPanel: (name) => (name === 'card' ? openCard(cardId || vocab[0]?.id, false) : showPanel(name)),
    setHidden,
    setMore,
    coach: (force = true) => coachStart(force),
    preview: (id) => { const c = chips.get(id); if (c) showPreview(id, c.wrap); },
    get element() { return host; },
  };
}
