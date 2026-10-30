// studio.js: the daylight Gaga studio. Room, sun, bounce, dust motes, curtains, props. OWNER: builder B.
// Units: meters, Y up. Interior: x -5..5 (tall steel windows on the -X long wall), z -7..7, ceiling 5 m.
// The curtained mirror wall is z = -7 (behind the soloist, who faces +Z). Barres run along the +X wall.
// Everything is procedural (canvas + shader noise); no external images.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const ROOM = { minX: -5, maxX: 5, minZ: -7, maxZ: 7, height: 5 };
const WALL_T = 0.3;
const WIN = { sill: 0.75, head: 4.55, width: 2.0, centers: [-5.4, -2.7, 0, 2.7, 5.4], planeX: -5.2 };
const SUN = { elevation: 31, azimuth: 20, intensity: 19, color: [1.0, 0.962, 0.915], halfAngle: 0.0047, soft: 1.15 };
const QUALITY = {
  high: { shadow: 4096, motes: 2600, shafts: { steps: 48, scale: 0.5 } },
  medium: { shadow: 2048, motes: 1500, shafts: { steps: 32, scale: 0.5 } },
  low: { shadow: 1024, motes: 600, shafts: { steps: 18, scale: 0.34 } },
};

// ---------------------------------------------------------------- small utils
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function smooth(t) { return t * t * (3 - 2 * t); }
// Periodic value noise; periods must be powers of two <= 256 so octaves tile.
function makeNoise(seed) {
  const r = mulberry32(seed), N = 256, tab = new Float32Array(N * N);
  for (let i = 0; i < tab.length; i++) tab[i] = r();
  const n = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = smooth(x - xi), v = smooth(y - yi);
    const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const a = tab[y0 * N + x0], b = tab[y0 * N + x1], c = tab[y1 * N + x0], d = tab[y1 * N + x1];
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
  };
  n.fbm = (x, y, p, oct = 4, gain = 0.5) => {
    let s = 0, amp = 1, norm = 0, f = 1;
    for (let o = 0; o < oct; o++) { s += amp * n(x * f, y * f, Math.min(256, p * f)); norm += amp; amp *= gain; f *= 2; }
    return s / norm;
  };
  return n;
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function fillNoise(ctx, w, h, fn) {
  const img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x, y), i = (y * w + x) * 4;
    const r = Array.isArray(v) ? v : [v, v, v];
    d[i] = Math.max(0, Math.min(255, r[0] * 255)); d[i + 1] = Math.max(0, Math.min(255, r[1] * 255));
    d[i + 2] = Math.max(0, Math.min(255, r[2] * 255)); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
// UVs in meters from position + dominant normal axis (consistent texel density on any box/plane).
function worldUV(geo, offset = [0, 0, 0]) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + offset[0], y = p.getY(i) + offset[1], z = p.getZ(i) + offset[2];
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    if (ax >= ay && ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; }
    else if (ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; }
    else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  geo.setAttribute('uv', new p.constructor(uv, 2));
  return geo;
}

// ---------------------------------------------------------------- procedural textures
function texturesFor(THREE, renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
  const tex = (c, { srgb = false, repeat = true } = {}) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    return t;
  };
  const out = {};
  // Plaster: fine bump (tile 1.2 m) and broad mottle (tile 4 m).
  {
    const n = makeNoise(11), S = 512, c = canvas(S, S);
    fillNoise(c.getContext('2d'), S, S, (x, y) => {
      const f = n.fbm(x / 16, y / 16, 32, 5, 0.55), g = n(x / 2, y / 2, 256);
      return 0.5 + (f - 0.5) * 0.9 + (g - 0.5) * 0.12;
    });
    out.plasterBump = tex(c);
    const m = makeNoise(12), M = 256, c2 = canvas(M, M);
    fillNoise(c2.getContext('2d'), M, M, (x, y) => 0.955 + 0.045 * m.fbm(x / 32, y / 32, 8, 4, 0.6));
    out.plasterMottle = tex(c2, { srgb: true });
  }
  // Marley floor layout (10 m x 14 m at ~10 cm per 10 px): strips, seams, scuffs, tape marks.
  {
    const W = 1024, H = 1434, ppm = W / 10, n = makeNoise(21), r = mulberry32(77);
    const c = canvas(W, H), ctx = c.getContext('2d');
    const cr = canvas(W / 2, H / 2), rtx = cr.getContext('2d');
    const stripW = 1.6, strips = Math.ceil(10 / stripW), tone = [];
    for (let i = 0; i < strips; i++) tone.push((r() - 0.5) * 0.022);
    fillNoise(ctx, W, H, (x, y) => {
      const s = Math.min(strips - 1, Math.floor(x / ppm / stripW));
      const broad = n.fbm(x / 128, y / 128, 8, 4, 0.55) - 0.5;
      const streak = n(x / 3, y / 90, 128) - 0.5;
      const wr2 = ((x / ppm - 4.0) ** 2) + ((y / ppm - 5.65) ** 2), wear = Math.exp(-wr2 / 9) * 0.03 + Math.exp(-wr2 / 2.2) * 0.07; // the class works here
      const v = 0.735 + tone[s] + broad * 0.035 + streak * 0.008 - wear;
      return [v * 1.0, v * 0.997, v * 0.99];
    });
    fillNoise(rtx, W / 2, H / 2, (x, y) => {
      const v = 0.44 + (n.fbm(x / 64, y / 64, 8, 4) - 0.5) * 0.12;
      return [v, v, v];
    });
    // seams: taped joins between strips
    for (let i = 1; i < strips; i++) {
      const x = i * stripW * ppm;
      ctx.fillStyle = 'rgba(70,70,72,0.10)'; ctx.fillRect(x - 2.6, 0, 5.2, H);
      ctx.fillStyle = 'rgba(40,40,42,0.22)'; ctx.fillRect(x - 0.5, 0, 1, H);
      rtx.fillStyle = 'rgb(92,92,92)'; rtx.fillRect(x / 2 - 1.3, 0, 2.6, H / 2);
    }
    // scuffs: rubber-sole arcs and soft smudges, clustered in the dance area
    const gauss = () => { let s = 0; for (let k = 0; k < 4; k++) s += r(); return (s - 2) / 0.58; };
    ctx.lineCap = 'round';
    for (let i = 0; i < 150; i++) {
      const cx = (i < 110 ? 4.0 + gauss() * 2.0 : r() * 10) * ppm, cy = (i < 110 ? 5.6 + gauss() * 2.6 : r() * 14) * ppm;
      const len = (0.05 + r() * 0.35) * ppm, ang = r() * Math.PI * 2, bend = (r() - 0.5) * 1.6;
      const a = 0.025 + r() * 0.09, wdt = 0.6 + r() * 2.4;
      ctx.filter = `blur(${(0.4 + r() * 1.6).toFixed(1)}px)`;
      ctx.strokeStyle = `rgba(30,30,32,${a})`; ctx.lineWidth = wdt;
      const rad = len / Math.max(0.2, Math.abs(bend)), ccw = bend < 0;
      ctx.beginPath(); ctx.arc(cx, cy, rad, ang, ang + bend, ccw); ctx.stroke();
      rtx.filter = 'blur(1px)'; rtx.strokeStyle = 'rgba(170,170,170,0.5)'; rtx.lineWidth = wdt;
      rtx.beginPath(); rtx.arc(cx / 2, cy / 2, rad / 2, ang, ang + bend, ccw); rtx.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const cx = (4 + gauss() * 2.2) * ppm, cy = (5.6 + gauss() * 2.8) * ppm, rad = (0.08 + r() * 0.3) * ppm;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, `rgba(40,40,42,${0.025 + r() * 0.03})`); g.addColorStop(1, 'rgba(40,40,42,0)');
      ctx.filter = 'none'; ctx.fillStyle = g; ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.4 + r()); ctx.translate(-cx, -cy);
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.filter = 'none'; rtx.filter = 'none';
    // spike tape marks (pale grey), a few lines of class tape
    const tape = (x, z, w, h, rot, shade = 'rgba(235,235,232,0.85)') => {
      ctx.save(); ctx.translate(x * ppm, z * ppm); ctx.rotate(rot); ctx.fillStyle = shade;
      ctx.fillRect(-w * ppm / 2, -h * ppm / 2, w * ppm, h * ppm); ctx.restore();
      rtx.save(); rtx.translate(x * ppm / 2, z * ppm / 2); rtx.rotate(rot); rtx.fillStyle = 'rgb(70,70,70)';
      rtx.fillRect(-w * ppm / 4, -h * ppm / 4, w * ppm / 2, h * ppm / 2); rtx.restore();
    };
    const cross = (x, z, rot, shade) => { tape(x, z, 0.12, 0.025, rot, shade); tape(x, z, 0.025, 0.12, rot, shade); };
    cross(5.0, 7.0, 0.05); cross(7.6, 10.2, -0.1, 'rgba(60,60,62,0.55)'); cross(2.2, 11.6, 0.2);
    tape(5.0, 12.9, 0.5, 0.025, 0.0); tape(3.1, 3.2, 0.1, 0.025, 0.7, 'rgba(60,60,62,0.5)');
    tape(8.4, 4.6, 0.14, 0.025, -0.3);
    out.floorMap = tex(c, { srgb: true, repeat: false });
    out.floorRough = tex(cr, { repeat: false });
    // fine marley emboss, tiles every 0.25 m
    const f = makeNoise(31), S = 256, cb = canvas(S, S);
    fillNoise(cb.getContext('2d'), S, S, (x, y) => 0.5 + (f.fbm(x / 4, y / 4, 64, 3, 0.6) - 0.5) * 1.0);
    out.floorBump = tex(cb);
  }
  // Curtain weave: vertical threads with slub variation
  {
    const n = makeNoise(41), S = 256, c = canvas(S, S);
    fillNoise(c.getContext('2d'), S, S, (x, y) => {
      const warp = 0.5 + 0.5 * Math.sin(x * Math.PI * 2 / 4), weft = 0.5 + 0.5 * Math.sin(y * Math.PI * 2 / 4);
      return 0.5 + (warp * 0.6 + weft * 0.25 - 0.42) * 0.6 + (n(x / 2, y / 16, 16) - 0.5) * 0.35;
    });
    out.weave = tex(c);
  }
  // Wood grain (barre, piano bench)
  {
    const n = makeNoise(51), W = 512, H = 64, c = canvas(W, H);
    fillNoise(c.getContext('2d'), W, H, (x, y) => {
      const g = n.fbm(x / 64, y / 4 + n(x / 32, y / 8, 8) * 2, 8, 4, 0.5);
      const v = 0.62 + (Math.sin(g * 30) * 0.5 + 0.5) * 0.08 + (g - 0.5) * 0.12;
      return [v * 1.02, v, v * 0.97];
    });
    out.wood = tex(c, { srgb: true });
  }
  // Exterior: pale sky and sunlit facades across the street, deliberately low contrast.
  {
    const W = 1024, H = 512, n = makeNoise(61), r = mulberry32(5), c = canvas(W, H), ctx = c.getContext('2d');
    fillNoise(ctx, W, H, (x, y) => {
      const t = y / H, sky = 0.93 + 0.07 * t + (n.fbm(x / 128, y / 64, 8, 3) - 0.5) * 0.02;
      return [sky * 0.975, sky * 0.99, sky];
    });
    let x = -20;
    while (x < W) {
      const bw = 90 + r() * 170, bh = 140 + r() * 190, top = H - bh - 40, shade = 0.72 + r() * 0.14;
      const s = Math.round(shade * 255);
      ctx.fillStyle = `rgb(${s},${s},${s - 3})`; ctx.fillRect(x, top, bw, H - top);
      const cols = Math.max(2, Math.floor(bw / 26)), rows = Math.floor(bh / 30);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const ws = Math.round((shade - 0.1 - r() * 0.08) * 255);
        ctx.fillStyle = `rgb(${ws},${ws},${ws})`;
        ctx.fillRect(x + 8 + i * (bw - 12) / cols, top + 12 + j * 30, (bw - 12) / cols - 9, 15);
      }
      // balcony bands, a Tel Aviv habit
      ctx.fillStyle = `rgba(255,255,255,0.35)`;
      for (let j = 0; j < rows; j += 2) ctx.fillRect(x, top + 30 + j * 30, bw, 4);
      x += bw + 6 + r() * 30;
    }
    ctx.filter = 'blur(2.5px)'; ctx.drawImage(c, 0, 0); ctx.filter = 'none';
    out.exterior = tex(c, { srgb: true, repeat: false });
  }
  return out;
}

// ---------------------------------------------------------------- soft sun shadows (PCSS with receiver-plane bias)
let ORIGINAL_SHADOW_CHUNK = null;
function patchShadowChunk(THREE, frustumW, depthRange) {
  const SC = THREE.ShaderChunk;
  if (ORIGINAL_SHADOW_CHUNK === null) ORIGINAL_SHADOW_CHUNK = SC.shadowmap_pars_fragment;
  const src = ORIGINAL_SHADOW_CHUNK;
  const start = src.indexOf('float getShadow(');
  const endMarker = 'return mix( 1.0, shadow, shadowIntensity );';
  const end = src.indexOf(endMarker, start);
  if (start < 0 || end < 0) return false;
  const close = src.indexOf('}', end + endMarker.length);
  const original = src.slice(start, close + 1);
  const f = (v) => v.toFixed(8);
  const penScale = depthRange * Math.tan(SUN.halfAngle * SUN.soft) / frustumW;
  const mine = /* glsl */`
#define GAGA_PEN_SCALE ${f(penScale)}
#define GAGA_MAX_PEN ${f(0.055 / frustumW)}
#define GAGA_SLOPE_EPS ${f(0.012 / depthRange)}
const vec2 gagaDisk[ 16 ] = vec2[ 16 ](
  vec2( -0.94201624, -0.39906216 ), vec2( 0.94558609, -0.76890725 ), vec2( -0.09418410, -0.92938870 ), vec2( 0.34495938, 0.29387760 ),
  vec2( -0.91588581, 0.45771432 ), vec2( -0.81544232, -0.87912464 ), vec2( -0.38277543, 0.27676845 ), vec2( 0.97484398, 0.75648379 ),
  vec2( 0.44323325, -0.97511554 ), vec2( 0.53742981, -0.47373420 ), vec2( -0.26496911, -0.41893023 ), vec2( 0.79197514, 0.19090188 ),
  vec2( -0.24188840, 0.99706507 ), vec2( -0.81409955, 0.91437590 ), vec2( 0.19984126, 0.78641367 ), vec2( 0.14383161, -0.14100790 ) );
float gagaIGN( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
  vec3 c = shadowCoord.xyz / shadowCoord.w;
  c.z += shadowBias;
  vec3 ddx = dFdx( c ), ddy = dFdy( c );
  float det = ddx.x * ddy.y - ddx.y * ddy.x;
  vec2 grad = abs( det ) > 1e-14 ? vec2( ddy.y * ddx.z - ddx.y * ddy.z, ddx.x * ddy.z - ddy.x * ddx.z ) / det : vec2( 0.0 );
  grad = clamp( grad, vec2( -6.0 ), vec2( 6.0 ) );
  if ( c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0 ) return 1.0;
  float texel = 1.0 / shadowMapSize.x;
  // Fixed rotation (no per-pixel noise): per-pixel random rotation read as a halftone stipple on the body.
  mat2 R = mat2( 1.0, 0.0, 0.0, 1.0 );
  float bSum = 0.0, bN = 0.0;
  for ( int i = 0; i < 12; i ++ ) {
    vec2 o = ( i == 0 ) ? vec2( 0.0 ) : R * gagaDisk[ i ] * GAGA_MAX_PEN;
    float d = unpackRGBAToDepth( texture2D( shadowMap, c.xy + o ) );
    if ( d < c.z + dot( grad, o ) - GAGA_SLOPE_EPS ) { bSum += d; bN += 1.0; }
  }
  if ( bN < 0.5 ) return 1.0;
  float zb = bSum / bN;
  float pen = clamp( ( c.z - zb ) * GAGA_PEN_SCALE, texel * max( shadowRadius, 0.75 ), GAGA_MAX_PEN );
  // 32-sample Vogel spiral: smooth penumbra without noise.
  float s = 0.0;
  for ( int i = 0; i < 32; i ++ ) {
    float r = sqrt( ( float( i ) + 0.5 ) / 32.0 ), th = float( i ) * 2.39996323;
    vec2 o = vec2( cos( th ), sin( th ) ) * r * pen;
    s += step( c.z + dot( grad, o ), unpackRGBAToDepth( texture2D( shadowMap, c.xy + o ) ) );
  }
  return mix( 1.0, s / 32.0, shadowIntensity );
}`;
  SC.shadowmap_pars_fragment = src.slice(0, start) +
    `#if defined( SHADOWMAP_TYPE_PCF_SOFT )\n${mine}\n#else\n${original}\n#endif\n` + src.slice(close + 1);
  return true;
}

// ---------------------------------------------------------------- the studio
export function createStudio(THREE, { renderer, scene, quality = 'high' } = {}) {
  const V3 = THREE.Vector3;
  const T = texturesFor(THREE, renderer);
  const root = new THREE.Group(); root.name = 'studio';
  scene.add(root);
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // materials ------------------------------------------------------------
  const lin = (v, g = v, b = v) => new THREE.Color().setRGB(v, g, b);
  const plaster = (v, tile = 1.2) => {
    const bump = T.plasterBump.clone(); bump.repeat.set(1 / tile, 1 / tile); bump.needsUpdate = true;
    const mott = T.plasterMottle.clone(); mott.repeat.set(1 / 4.2, 1 / 4.2); mott.needsUpdate = true;
    return keep(new THREE.MeshStandardMaterial({ color: lin(v, v * 0.995, v * 0.985), map: mott, bumpMap: bump, bumpScale: 0.6, roughness: 0.93, metalness: 0 }));
  };
  const M = {
    wall: plaster(0.78),
    reveal: plaster(0.8),
    ceiling: plaster(0.74, 1.6),
    beam: keep(new THREE.MeshStandardMaterial({ color: lin(0.7, 0.695, 0.685), roughness: 0.85 })),
    steel: keep(new THREE.MeshStandardMaterial({ color: lin(0.035), roughness: 0.48, metalness: 0.35 })),
    steelLight: keep(new THREE.MeshStandardMaterial({ color: lin(0.09), roughness: 0.4, metalness: 0.6 })),
    skirting: keep(new THREE.MeshStandardMaterial({ color: lin(0.52), roughness: 0.6 })),
    radiator: keep(new THREE.MeshStandardMaterial({ color: lin(0.72, 0.71, 0.70), roughness: 0.45 })),
    piano: keep(new THREE.MeshPhysicalMaterial({ color: lin(0.018), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.18 })),
    pianoKeyWood: keep(new THREE.MeshStandardMaterial({ color: lin(0.03), roughness: 0.5 })),
    speaker: keep(new THREE.MeshStandardMaterial({ color: lin(0.045), roughness: 0.75 })),
    grille: keep(new THREE.MeshStandardMaterial({ color: lin(0.07), roughness: 0.95 })),
    mat: keep(new THREE.MeshStandardMaterial({ color: lin(0.33, 0.33, 0.335), roughness: 0.8 })),
    bottle: keep(new THREE.MeshStandardMaterial({ color: lin(0.7), roughness: 0.22, metalness: 1.0 })),
    cap: keep(new THREE.MeshStandardMaterial({ color: lin(0.03), roughness: 0.6 })),
    shade: keep(new THREE.MeshStandardMaterial({ color: lin(0.78), roughness: 0.32, side: THREE.FrontSide })),
    shadeIn: keep(new THREE.MeshStandardMaterial({ color: lin(0.5), roughness: 0.7, side: THREE.BackSide })),
    cord: keep(new THREE.MeshStandardMaterial({ color: lin(0.03), roughness: 0.6 })),
    door: keep(new THREE.MeshStandardMaterial({ color: lin(0.6, 0.6, 0.595), roughness: 0.55 })),
    exterior: keep(new THREE.MeshBasicMaterial({ map: T.exterior, color: lin(2.2, 2.21, 2.25), fog: false })),
    ground: keep(new THREE.MeshBasicMaterial({ color: lin(1.6, 1.58, 1.55), fog: false })),
    glass: keep(new THREE.MeshStandardMaterial({ color: lin(1), transparent: true, opacity: 0.07, roughness: 0.08, metalness: 0, depthWrite: false })),
  };
  {
    const w = T.wood.clone(); w.repeat.set(1 / 1.4, 1 / 0.05); w.needsUpdate = true;
    M.wood = keep(new THREE.MeshStandardMaterial({ color: lin(0.62, 0.6, 0.58), map: w, roughness: 0.5 }));
  }
  {
    const fb = T.floorBump.clone(); fb.repeat.set(10 / 0.25, 14 / 0.25); fb.needsUpdate = true;
    M.floor = keep(new THREE.MeshStandardMaterial({
      color: lin(0.62, 0.62, 0.62), map: T.floorMap, roughnessMap: T.floorRough, roughness: 1.0, metalness: 0,
      bumpMap: fb, bumpScale: 0.35, envMapIntensity: 0.9,
    }));
  }
  {
    const wv = T.weave.clone(); wv.repeat.set(1 / 0.09, 1 / 0.09); wv.needsUpdate = true;
    M.curtain = keep(new THREE.MeshPhysicalMaterial({
      color: lin(0.5, 0.5, 0.505), roughness: 0.9, sheen: 0.6, sheenRoughness: 0.55, sheenColor: lin(0.65),
      bumpMap: wv, bumpScale: 0.5,
    }));
  }

  const add = (geo, mat, { cast = true, receive = true, name, pos } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name;
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    root.add(m); keep(geo);
    return m;
  };
  // Box positioned by min/max corners, UVs in meters.
  const boxMM = (x0, y0, z0, x1, y1, z1, mat, opts) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    worldUV(g, c);
    return add(g, mat, { ...opts, pos: c });
  };

  // room shell -----------------------------------------------------------
  const { minX, maxX, minZ, maxZ, height: H } = ROOM, t = WALL_T;
  {
    const g = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ); g.rotateX(-Math.PI / 2);
    add(g, M.floor, { cast: false, name: 'floor' });
  }
  boxMM(minX - t, H, minZ - t, maxX + t, H + t, maxZ + t, M.ceiling, { name: 'ceiling' });
  boxMM(maxX, -0.05, minZ - t, maxX + t, H, maxZ + t, M.wall);
  boxMM(minX - t, -0.05, minZ - t, maxX + t, H, minZ, M.wall);
  boxMM(minX - t, -0.05, maxZ, maxX + t, H, maxZ + t, M.wall);
  // window wall: strips + piers, so the openings are real holes the sun passes through
  const wx0 = minX - t, wx1 = minX;
  boxMM(wx0, -0.05, minZ - t, wx1, WIN.sill, maxZ + t, M.reveal);
  boxMM(wx0, WIN.head, minZ - t, wx1, H, maxZ + t, M.reveal);
  {
    const edges = [minZ - t];
    for (const c of WIN.centers) edges.push(c - WIN.width / 2, c + WIN.width / 2);
    edges.push(maxZ + t);
    for (let i = 0; i < edges.length; i += 2) boxMM(wx0, WIN.sill, edges[i], wx1, WIN.head, edges[i + 1], M.reveal);
  }
  // steel window frames (merged)
  {
    const parts = [], X = WIN.planeX, D = 0.06;
    const bar = (y0, y1, z0, z1, d = D) => {
      const g = new THREE.BoxGeometry(d, y1 - y0, z1 - z0); g.translate(X, (y0 + y1) / 2, (z0 + z1) / 2); parts.push(g);
    };
    const fw = 0.06, mw = 0.042, cols = 4, rows = 6;
    for (const c of WIN.centers) {
      const z0 = c - WIN.width / 2, z1 = c + WIN.width / 2, y0 = WIN.sill, y1 = WIN.head;
      bar(y0, y0 + fw, z0, z1); bar(y1 - fw, y1, z0, z1); bar(y0, y1, z0, z0 + fw); bar(y0, y1, z1 - fw, z1);
      for (let k = 1; k < cols; k++) { const z = z0 + (k * (z1 - z0)) / cols; bar(y0, y1, z - mw / 2, z + mw / 2, 0.05); }
      for (let k = 1; k < rows; k++) { const y = y0 + (k * (y1 - y0)) / rows; bar(y - mw / 2, y + mw / 2, z0, z1, 0.05); }
      // a heavier transom where the hopper opens
      bar(y0 + (y1 - y0) * 0.5 - 0.035, y0 + (y1 - y0) * 0.5 + 0.035, z0, z1, 0.075);
    }
    add(mergeGeometries(parts), M.steel, { name: 'window-frames' });
    parts.forEach((g) => g.dispose());
    for (const c of WIN.centers) {
      const g = new THREE.PlaneGeometry(WIN.width, WIN.head - WIN.sill); g.rotateY(Math.PI / 2);
      const m = add(g, M.glass, { cast: false, receive: false, pos: [X + 0.01, (WIN.sill + WIN.head) / 2, c] });
      m.renderOrder = 2;
    }
  }
  // exterior backdrop and street far below
  {
    const g = new THREE.PlaneGeometry(90, 46); g.rotateY(Math.PI / 2);
    add(g, M.exterior, { cast: false, receive: false, pos: [-24, 7, 0], name: 'exterior' });
    const gg = new THREE.PlaneGeometry(19, 90); gg.rotateX(-Math.PI / 2);
    add(gg, M.ground, { cast: false, receive: false, pos: [-14.8, -4, 0] });
  }
  // beams across the ceiling
  for (let z = -6; z <= 6; z += 2) boxMM(minX, 4.6, z - 0.12, maxX, H, z + 0.12, M.beam);
  // skirting
  boxMM(maxX - 0.016, 0, minZ, maxX, 0.1, maxZ, M.skirting);
  boxMM(minX, 0, maxZ - 0.016, maxX, 0.1, maxZ, M.skirting);
  boxMM(minX, 0, minZ, minX + 0.016, 0.1, maxZ, M.skirting);

  // radiators under the windows (instanced cast-iron columns)
  {
    const g = new RoundedBoxGeometry(0.09, 0.58, 0.046, 2, 0.016); keep(g);
    const per = 22, count = per * WIN.centers.length;
    const im = new THREE.InstancedMesh(g, M.radiator, count); im.castShadow = true; im.receiveShadow = true;
    const m4 = new THREE.Matrix4(); let k = 0;
    for (const c of WIN.centers) for (let i = 0; i < per; i++) {
      m4.makeTranslation(minX + 0.11, 0.43, c - (per - 1) * 0.0325 + i * 0.065); im.setMatrixAt(k++, m4);
    }
    root.add(im);
    for (const c of WIN.centers) {
      boxMM(minX + 0.085, 0.16, c - 0.73, minX + 0.135, 0.19, c + 0.73, M.radiator);
      boxMM(minX + 0.085, 0.66, c - 0.73, minX + 0.135, 0.69, c + 0.73, M.radiator);
      const p = new THREE.CylinderGeometry(0.014, 0.014, 0.16, 10);
      add(p, M.steelLight, { pos: [minX + 0.11, 0.08, c + 0.78] });
    }
  }

  // curtains over the mirror wall: deep folds, gentle sway --------------
  const curtainUniforms = { uTime: { value: 0 } };
  {
    const W = maxX - minX - 0.1, Hc = 4.86, segX = 420, segY = 36;
    const g = new THREE.PlaneGeometry(W, Hc, segX, segY);
    const p = g.attributes.position, n = makeNoise(91);
    // fold widths vary (phase accumulated over a noisy wavelength), amplitudes vary, crests are a little sharp
    const phase = new Float32Array(segX + 1), amp = new Float32Array(segX + 1), dx = W / segX;
    let ph = 0;
    for (let j = 0; j <= segX; j++) {
      const x = -W / 2 + j * dx;
      const lam = 0.2 + 0.26 * n(x * 0.55 + 7.3, 1.5, 64) + 0.08 * n(x * 2.1 + 1.7, 3.5, 64);
      ph += (dx / lam) * Math.PI * 2; phase[j] = ph;
      amp[j] = 0.045 + 0.075 * n(x * 0.4 + 2.2, 5.5, 64);
    }
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), hang = (Hc / 2 - y) / Hc; // 0 top, 1 bottom
      const j = Math.max(0, Math.min(segX, Math.round((x + W / 2) / dx)));
      const wob = (n(x * 0.8 + 11, y * 0.35 + 4, 64) - 0.5) * 1.2 * hang;
      const sv = Math.sin(phase[j] + wob), shaped = Math.sign(sv) * Math.pow(Math.abs(sv), 0.75);
      const deep = amp[j] * (0.85 + 0.3 * hang) * shaped + 0.03 * Math.sin(x / 0.97 * Math.PI * 2 + 1.1) * (0.3 + hang);
      const top = 0.03 * Math.sin(x / 0.15 * Math.PI * 2);
      const mix = smooth(Math.min(1, hang / 0.1));
      p.setZ(i, top * (1 - mix) + deep * mix);
    }
    g.computeVertexNormals();
    const inject = (shader) => {
      shader.uniforms.uTime = curtainUniforms.uTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float hang = clamp( ( ${(Hc / 2).toFixed(3)} - position.y ) / ${Hc.toFixed(3)}, 0.0, 1.0 );
        float sw = hang * hang;
        transformed.z += sw * ( 0.016 * sin( uTime * 0.41 + position.x * 1.7 ) + 0.009 * sin( uTime * 0.23 + position.x * 0.55 + 1.3 ) );
        transformed.x += sw * 0.006 * sin( uTime * 0.31 + position.x * 2.3 );`);
    };
    M.curtain.onBeforeCompile = inject;
    const depthMat = keep(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
    depthMat.onBeforeCompile = inject;
    const m = add(g, M.curtain, { name: 'curtain', pos: [(minX + maxX) / 2, 0.035 + Hc / 2, minZ + 0.24] });
    m.customDepthMaterial = depthMat;
    boxMM(minX + 0.05, 4.9, minZ + 0.2, maxX - 0.05, 4.94, minZ + 0.27, M.steelLight);
  }

  // barres along the +X wall --------------------------------------------
  {
    const rail = (y, z0, z1) => {
      const g = new THREE.CylinderGeometry(0.022, 0.022, z1 - z0, 20); g.rotateX(Math.PI / 2);
      add(g, M.wood, { pos: [maxX - 0.24, y, (z0 + z1) / 2] });
    };
    for (const [z0, z1] of [[-5.6, -2.3], [-1.9, 1.4], [1.8, 4.6]]) {
      rail(0.86, z0, z1); rail(1.08, z0, z1);
      for (let z = z0 + 0.25; z <= z1 - 0.2; z += (z1 - z0 - 0.5) / 2) {
        boxMM(maxX - 0.25, 0.83, z - 0.012, maxX, 0.85, z + 0.012, M.steelLight);
        boxMM(maxX - 0.25, 1.05, z - 0.012, maxX, 1.07, z + 0.012, M.steelLight);
        boxMM(maxX - 0.012, 0.78, z - 0.03, maxX, 1.12, z + 0.03, M.steelLight);
      }
    }
  }

  // pendant lamps (unlit) -----------------------------------------------
  {
    const prof = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 0.5; prof.push(new THREE.Vector2(0.03 + Math.sin(a) * 0.2, 0.2 - (1 - Math.cos(a)) * 0.2 - 0.0)); }
    const shadeG = new THREE.LatheGeometry(prof.reverse(), 40);
    for (const x of [-2.2, 1.6]) for (const z of [-5, -1, 3]) {
      const yb = 3.35;
      add(shadeG.clone(), M.shade, { pos: [x, yb, z] });
      add(shadeG.clone(), M.shadeIn, { pos: [x, yb, z], cast: false });
      add(new THREE.CylinderGeometry(0.004, 0.004, H - yb - 0.2, 6), M.cord, { pos: [x, (H + yb + 0.2) / 2, z], cast: false });
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16), M.steel, { pos: [x, H - 0.025, z], cast: false });
      add(new THREE.SphereGeometry(0.045, 16, 12), M.shade, { pos: [x, yb + 0.03, z], cast: false });
    }
    shadeG.dispose();
  }

  // props ------------------------------------------------------------------
  // upright piano against the +Z wall, keyboard facing the room
  {
    const px = 2.9, pz = maxZ - 0.33;
    boxMM(px - 0.76, 0.09, pz - 0.3, px + 0.76, 1.27, pz + 0.3, M.piano);
    boxMM(px - 0.78, 1.27, pz - 0.33, px + 0.78, 1.31, pz + 0.31, M.piano);
    boxMM(px - 0.72, 0.68, pz - 0.58, px + 0.72, 0.8, pz - 0.3, M.piano);
    boxMM(px - 0.68, 0.8, pz - 0.44, px + 0.68, 0.98, pz - 0.3, M.piano);
    boxMM(px - 0.76, 0.0, pz - 0.6, px - 0.68, 0.68, pz - 0.5, M.piano);
    boxMM(px + 0.68, 0.0, pz - 0.6, px + 0.76, 0.68, pz - 0.5, M.piano);
    boxMM(px - 0.76, 0.0, pz - 0.3, px + 0.76, 0.09, pz + 0.3, M.pianoKeyWood);
    // bench
    boxMM(px - 0.42, 0.46, pz - 1.2, px + 0.42, 0.52, pz - 0.86, M.wood);
    for (const [dx, dz] of [[-0.38, -1.16], [0.38, -1.16], [-0.38, -0.9], [0.38, -0.9]]) boxMM(px + dx - 0.02, 0, pz + dz - 0.02, px + dx + 0.02, 0.46, pz + dz + 0.02, M.wood);
  }
  // speaker on a tripod stand near the curtain corner
  {
    const sx = 4.05, sz = minZ + 0.95;
    add(new THREE.CylinderGeometry(0.017, 0.017, 1.3, 12), M.steel, { pos: [sx, 0.85, sz] });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4, g = new THREE.CylinderGeometry(0.012, 0.012, 0.72, 8);
      const m = add(g, M.steel, { pos: [sx + Math.cos(a) * 0.24, 0.3, sz + Math.sin(a) * 0.24] });
      m.lookAt(sx, 0.62, sz); m.rotateX(Math.PI / 2);
    }
    const spk = new RoundedBoxGeometry(0.34, 0.52, 0.3, 3, 0.02);
    const m = add(spk, M.speaker, { pos: [sx, 1.72, sz] }); m.rotation.y = -0.5;
    const gr = new THREE.PlaneGeometry(0.29, 0.46);
    const gm = add(gr, M.grille, { pos: [sx + Math.sin(-0.5) * 0.152, 1.72, sz + Math.cos(-0.5) * 0.152], cast: false });
    gm.rotation.y = -0.5;
  }
  // folded mats and a steel bottle by the barre wall
  {
    const mx = maxX - 0.48, mz = -3.4;
    for (let i = 0; i < 4; i++) {
      const g = new RoundedBoxGeometry(0.62, 0.05, 0.5, 2, 0.022);
      const m = add(g, M.mat, { pos: [mx + (i % 2) * 0.01, 0.025 + i * 0.05, mz + (i % 2 ? 0.012 : -0.008)] });
      m.rotation.y = 0.05 + (i % 3) * 0.02;
    }
    const prof = [[0, 0], [0.036, 0], [0.037, 0.006], [0.037, 0.2], [0.033, 0.225], [0.02, 0.24], [0.02, 0.252], [0, 0.252]].map(([a, b]) => new THREE.Vector2(a, b));
    add(new THREE.LatheGeometry(prof, 28), M.bottle, { pos: [maxX - 0.42, 0, -2.75] });
    add(new THREE.CylinderGeometry(0.023, 0.023, 0.03, 20), M.cap, { pos: [maxX - 0.42, 0.265, -2.75] });
  }
  // a plain door in the +Z wall
  {
    const dx = -2.7;
    boxMM(dx - 0.56, 0, maxZ - 0.03, dx + 0.56, 2.26, maxZ + 0.02, M.steel);
    boxMM(dx - 0.5, 0, maxZ - 0.04, dx + 0.5, 2.2, maxZ, M.door);
    boxMM(dx + 0.36, 1.02, maxZ - 0.1, dx + 0.42, 1.04, maxZ - 0.04, M.steelLight);
  }

  // sun -------------------------------------------------------------------
  const el = THREE.MathUtils.degToRad(SUN.elevation), az = THREE.MathUtils.degToRad(SUN.azimuth);
  const travel = new V3(Math.cos(el) * Math.cos(az), -Math.sin(el), -Math.cos(el) * Math.sin(az)).normalize();
  const sunDirection = travel.clone().negate(); // unit vector from the scene toward the sun
  const sunColor = new THREE.Color().setRGB(...SUN.color);
  const sun = new THREE.DirectionalLight(sunColor, SUN.intensity);
  sun.name = 'sun';
  const center = new V3(0, H / 2, 0);
  sun.position.copy(center).addScaledVector(sunDirection, 40);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.018;
  sun.shadow.radius = 2.2; // minimum penumbra in texels (soft self-shadow edges on the body)
  let frustumW = 18, depthRange = 30;
  {
    const cam = sun.shadow.camera;
    const tmp = new THREE.OrthographicCamera();
    tmp.position.copy(sun.position); tmp.lookAt(center); tmp.updateMatrixWorld(true);
    const inv = tmp.matrixWorldInverse, v = new V3();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const X of [minX - t - 0.05, maxX + t + 0.05]) for (const Y of [-0.1, H + t + 0.05]) for (const Z of [minZ - t - 0.05, maxZ + t + 0.05]) {
      v.set(X, Y, Z).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
      z0 = Math.min(z0, -v.z); z1 = Math.max(z1, -v.z);
    }
    const w = Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    cam.left = cx - w / 2; cam.right = cx + w / 2; cam.bottom = cy - w / 2; cam.top = cy + w / 2;
    cam.near = Math.max(0.1, z0 - 0.5); cam.far = z1 + 0.5;
    cam.updateProjectionMatrix();
    frustumW = w; depthRange = cam.far - cam.near;
  }
  root.add(sun, sun.target);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const softShadows = /[?&]pcss=0/.test(location.search) ? false : patchShadowChunk(THREE, frustumW, depthRange);

  const hemi = new THREE.HemisphereLight(lin(0.92, 0.95, 1.0), lin(0.62, 0.6, 0.57), 0.12);
  root.add(hemi);
  // floor bounce: the sunlit patches throw soft light back up into the body's shadow side and onto the ceiling
  const bounce = new THREE.DirectionalLight(lin(1.0, 0.97, 0.93), 0.85);
  bounce.name = 'floor-bounce';
  bounce.position.set(-1.4, -3.0, -0.9);
  bounce.target.position.set(0, 0, 0);
  root.add(bounce, bounce.target);

  // bounce environment: a coarse radiance model of this room, prefiltered once
  const probe = new V3(-1.0, 1.25, -1.35);
  {
    const env = new THREE.Scene();
    const quad = (w, h, rad, pos, rot) => {
      const g = new THREE.PlaneGeometry(w, h);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: rad, side: THREE.DoubleSide }));
      m.position.set(pos[0] - probe.x, pos[1] - probe.y, pos[2] - probe.z);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      env.add(m); return m;
    };
    quad(10, 14, lin(0.27, 0.27, 0.268), [0, 0, 0], [-Math.PI / 2, 0, 0]);
    quad(10, 14, lin(0.36, 0.355, 0.35), [0, H, 0], [Math.PI / 2, 0, 0]);
    quad(14, H, lin(0.42), [maxX, H / 2, 0], [0, -Math.PI / 2, 0]);
    quad(10, H, lin(0.36, 0.36, 0.365), [0, H / 2, minZ], [0, 0, 0]);
    quad(10, H, lin(0.4), [0, H / 2, maxZ], [0, Math.PI, 0]);
    quad(14, H, lin(0.16), [minX - 0.01, H / 2, 0], [0, Math.PI / 2, 0]);
    for (const c of WIN.centers) quad(WIN.width, WIN.head - WIN.sill, lin(2.3, 2.33, 2.4), [minX, (WIN.sill + WIN.head) / 2, c], [0, Math.PI / 2, 0]);
    // sunlit patches on the floor: each window opening projected along the sun
    const patchMat = new THREE.MeshBasicMaterial({ color: lin(1.3, 1.26, 1.2), side: THREE.DoubleSide });
    for (const c of WIN.centers) {
      const pts = [];
      for (const [y, z] of [[WIN.sill, c - WIN.width / 2], [WIN.sill, c + WIN.width / 2], [WIN.head, c + WIN.width / 2], [WIN.head, c - WIN.width / 2]]) {
        const k = y / -travel.y, P = new V3(minX, y, z).addScaledVector(travel, k);
        P.x = Math.min(P.x, maxX); P.z = Math.max(P.z, minZ);
        pts.push(P.x - probe.x, 0.005 - probe.y, P.z - probe.z);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
      env.add(new THREE.Mesh(g, patchMat));
    }
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, 0.035, 0.05, 60);
    pm.dispose();
    env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.9;
    scene.background = lin(0.8);
    keep(rt);
  }

  // dust motes, lit only where the sun reaches (shadow-map lookup per mote) --
  const MAXM = QUALITY.high.motes;
  const moteUniforms = {
    uTime: { value: 0 }, uShadow: { value: null }, uShadowMatrix: { value: sun.shadow.matrix }, uReady: { value: 0 },
    uColor: { value: new V3(sunColor.r, sunColor.g, sunColor.b).multiplyScalar(2.6) }, uScale: { value: 1 },
  };
  const motes = (() => {
    const pos = new Float32Array(MAXM * 3), seed = new Float32Array(MAXM * 4), r = mulberry32(404);
    const lit = (x, y, z) => { // walk toward the sun until the window wall; is that point inside an opening?
      const k = (minX - x) / sunDirection.x;
      const yw = y + sunDirection.y * k, zw = z + sunDirection.z * k;
      if (yw < WIN.sill - 0.1 || yw > WIN.head + 0.1) return false;
      return WIN.centers.some((c) => Math.abs(zw - c) < WIN.width / 2 + 0.15);
    };
    let i = 0, guard = 0;
    while (i < MAXM && guard++ < 400000) {
      const x = minX + 0.15 + r() * 7.6, y = 0.08 + r() * 4.3, z = minZ + 0.1 + r() * 13.8;
      if (!lit(x, y, z) && r() > 0.06) continue;
      pos.set([x, y, z], i * 3); seed.set([r(), r(), r(), r()], i * 4); i++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    const mat = new THREE.ShaderMaterial({
      uniforms: moteUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`
        #include <packing>
        attribute vec4 seed;
        uniform float uTime, uReady, uScale;
        uniform sampler2D uShadow;
        uniform mat4 uShadowMatrix;
        varying float vI;
        void main() {
          vec3 p = position;
          float t = uTime;
          p += vec3( sin( t * 0.11 + seed.x * 6.283 ) * 0.22 + sin( t * 0.043 + seed.y * 9.0 ) * 0.3,
                     sin( t * 0.07 + seed.y * 6.283 ) * 0.16 + sin( t * 0.021 + seed.w * 7.0 ) * 0.35,
                     sin( t * 0.09 + seed.z * 6.283 ) * 0.22 + sin( t * 0.037 + seed.x * 5.0 ) * 0.3 );
          float lit = 0.0;
          if ( uReady > 0.5 ) {
            vec4 sc = uShadowMatrix * vec4( p, 1.0 );
            if ( sc.x > 0.0 && sc.x < 1.0 && sc.y > 0.0 && sc.y < 1.0 )
              lit = step( sc.z - 0.002, unpackRGBAToDepth( texture2D( uShadow, sc.xy ) ) );
          }
          float inside = step( ${(minX + 0.02).toFixed(2)}, p.x ) * step( 0.02, p.y );
          vec4 mv = modelViewMatrix * vec4( p, 1.0 );
          gl_Position = projectionMatrix * mv;
          float d = -mv.z;
          float glint = 0.35 + 0.65 * pow( 0.5 + 0.5 * sin( t * ( 0.6 + seed.w * 1.7 ) + seed.x * 40.0 ), 3.0 );
          vI = lit * inside * glint * smoothstep( 0.35, 1.2, d ) * ( 0.4 + 0.6 * seed.z );
          gl_PointSize = clamp( uScale * ( 2.6 + seed.w * 3.0 ) / max( d, 0.1 ), 1.0, 5.0 * uScale );
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        varying float vI;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep( 0.5, 0.0, length( c ) );
          if ( vI * a < 0.002 ) discard;
          gl_FragColor = vec4( uColor * vI * a * a, 1.0 );
        }`,
    });
    keep(g); keep(mat);
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false; pts.name = 'dust-motes'; pts.renderOrder = 3;
    root.add(pts);
    return pts;
  })();

  // shared state for post.js (volumetric shafts are ray-marched against this sun's shadow map)
  const shafts = {
    enabled: true, intensity: 1.0, density: 0.0017, steps: 48, scale: 0.5, color: sunColor,
    toSun: sunDirection, boxMin: new V3(minX, 0, minZ), boxMax: new V3(maxX, WIN.head, maxZ), // no sun above the window heads
  };

  let curQuality = null;
  function setQuality(level) {
    const q = QUALITY[level] || QUALITY.high;
    if (curQuality === level) return;
    curQuality = level in QUALITY ? level : 'high';
    if (sun.shadow.mapSize.x !== q.shadow) {
      sun.shadow.mapSize.set(q.shadow, q.shadow);
      if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    motes.geometry.setDrawRange(0, q.motes);
    shafts.steps = q.shafts.steps; shafts.scale = q.shafts.scale;
  }
  setQuality(quality);

  const sunBase = SUN.intensity;
  const _size = new THREE.Vector2();
  const studio = {
    bounds: { minX, maxX, minZ, maxZ },
    floorY: 0,
    ceilingY: H,
    soloistSpot: new V3(-1.0, 0, -1.35),
    participantSpot: new V3(0.65, 0, 0.1),
    sunDirection,
    sun, hemi, shafts, softShadows,
    obstacles: [
      { minX: 2.1, maxX: 3.7, minZ: 5.4, maxZ: 7 },       // piano + bench
      { minX: 3.75, maxX: 4.35, minZ: -6.35, maxZ: -5.75 }, // speaker stand
      { minX: 4.2, maxX: 5, minZ: -3.75, maxZ: -2.5 },      // mats + bottle
    ],
    time: 0,
    get quality() { return curQuality; },
    setQuality,
    update(dt, time) {
      const tt = time ?? (studio.time + (dt || 0));
      studio.time = tt;
      curtainUniforms.uTime.value = tt;
      moteUniforms.uTime.value = tt;
      if (sun.shadow.map) { moteUniforms.uShadow.value = sun.shadow.map.texture; moteUniforms.uReady.value = 1; }
      renderer.getDrawingBufferSize(_size);
      moteUniforms.uScale.value = Math.max(0.5, _size.y / 900);
      // a slow breath in the daylight, as if thin cloud crossed the sun
      sun.intensity = sunBase * (1 + 0.025 * Math.sin(tt * 0.071) * Math.sin(tt * 0.033 + 1.0));
    },
    dispose() {
      scene.remove(root);
      disposables.forEach((d) => d.dispose && d.dispose());
      if (scene.userData.gagaStudio === studio) delete scene.userData.gagaStudio;
    },
  };
  scene.userData.gagaStudio = studio;
  return studio;
}
