// trails.js: thin ink ribbons tracing the last ~1.5 s of a few bones. OWNER: builder B.
// One draw call for all ribbons. Samples are taken in dancer time (the dt passed to update), so trails slow down,
// pause and step with the dancer. Ribbons are billboarded in the vertex shader and keep a near-constant pixel width.
import { BONE_BY_NAME } from '../skeleton.js';

const SPAN = 1.5;        // seconds of dancer time shown
const RATE = 60;         // samples per second of dancer time
const N = Math.round(SPAN * RATE) + 2;

export function createTrails(THREE, { scene, figure, bones = ['hand_L', 'hand_R', 'head', 'pelvis', 'foot_L', 'foot_R'] } = {}) {
  const B = bones.filter((n) => figure && figure.byName && figure.byName[n]);
  // trace a visible point instead of the joint centre (palm, mid-foot, middle of the head)
  const ALONG = { hand: 0.62, foot: 0.6, toes: 0.5, head: 0.5, index: 1, middle: 1, ring: 1, pinky: 1, thumb: 1 };
  const local = B.map((n) => {
    const r = BONE_BY_NAME[n], f = ALONG[n.replace(/0\d|_[LR]$/g, '')] || 0;
    return r ? [r.dir[0] * r.length * f, r.dir[1] * r.length * f, r.dir[2] * r.length * f] : [0, 0, 0];
  });
  const nb = Math.max(1, B.length);
  // ring buffers per bone: positions + sample time
  const ring = B.map(() => ({ pos: new Float32Array(N * 3), t: new Float32Array(N).fill(-1e9), head: 0, count: 0 }));
  const V = nb * N * 2;
  const position = new Float32Array(V * 3), other = new Float32Array(V * 3), side = new Float32Array(V), age = new Float32Array(V), width = new Float32Array(V);
  const index = [];
  for (let b = 0; b < nb; b++) for (let i = 0; i < N - 1; i++) {
    const a = (b * N + i) * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  for (let v = 0; v < V; v++) side[v] = v % 2 ? 1 : -1;
  const WID = { hand_L: 1, hand_R: 1, head: 0.85, pelvis: 0.8, foot_L: 0.9, foot_R: 0.9 };
  for (let b = 0; b < nb; b++) for (let i = 0; i < N * 2; i++) width[(b * N) * 2 + i] = WID[B[b]] || 0.85;
  const g = new THREE.BufferGeometry();
  const attr = (arr, n) => { const a = new THREE.BufferAttribute(arr, n); a.setUsage(THREE.DynamicDrawUsage); return a; };
  g.setAttribute('position', attr(position, 3));
  g.setAttribute('aOther', attr(other, 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aAge', attr(age, 1));
  g.setAttribute('aWidth', new THREE.BufferAttribute(width, 1));
  g.setIndex(index);
  const uniforms = { uRes: { value: new THREE.Vector2(1, 1) }, uPx: { value: 2.4 }, uColor: { value: new THREE.Color().setRGB(0.012, 0.012, 0.014) }, uOpacity: { value: 0.92 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      attribute vec3 aOther; attribute float aSide, aAge, aWidth;
      uniform vec2 uRes; uniform float uPx;
      varying float vAge; varying float vEdge;
      void main() {
        vec4 a = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        vec4 b = projectionMatrix * modelViewMatrix * vec4( aOther, 1.0 );
        vec2 sa = a.xy / max( a.w, 1e-4 ) * uRes, sb = b.xy / max( b.w, 1e-4 ) * uRes;
        vec2 d = sb - sa;
        d = length( d ) > 1e-4 ? normalize( d ) : vec2( 1.0, 0.0 );
        vec2 n = vec2( -d.y, d.x );
        float taper = pow( 1.0 - aAge, 0.6 );
        float px = uPx * aWidth * ( 0.35 + 0.65 * taper );
        a.xy += n * aSide * px / uRes * a.w;
        gl_Position = a;
        vAge = aAge; vEdge = aSide;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uOpacity;
      varying float vAge; varying float vEdge;
      void main() {
        if ( vAge >= 1.0 ) discard;
        float fade = pow( 1.0 - vAge, 0.8 ) * smoothstep( 1.0, 0.85, vAge );
        float edge = 1.0 - smoothstep( 0.55, 1.0, abs( vEdge ) );
        gl_FragColor = vec4( uColor, uOpacity * fade * ( 0.75 + 0.25 * edge ) );
      }`,
  });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = 'gaga-trails'; mesh.frustumCulled = false; mesh.renderOrder = 4;
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.userData.noAO = true; // post.js hides it from the AO normal pass
  mesh.visible = false;
  scene.add(mesh);
  const reg = scene.userData.gagaNoAO || (scene.userData.gagaNoAO = new Set());
  reg.add(mesh);

  let enabled = false, time = 0, acc = 0;
  const v = new THREE.Vector3(), size = new THREE.Vector2();
  function sample() {
    for (let b = 0; b < B.length; b++) {
      const r = ring[b];
      figure.byName[B[b]].localToWorld(v.set(local[b][0], local[b][1], local[b][2]));
      r.head = (r.head + 1) % N; r.count = Math.min(N, r.count + 1);
      r.pos[r.head * 3] = v.x; r.pos[r.head * 3 + 1] = v.y; r.pos[r.head * 3 + 2] = v.z; r.t[r.head] = time;
    }
  }
  function rebuild() {
    for (let b = 0; b < nb; b++) {
      const r = ring[b];
      // newest first; slot 0 follows the live bone so the ribbon never lags its source
      let live = null;
      if (B[b]) { figure.byName[B[b]].localToWorld(v.set(local[b][0], local[b][1], local[b][2])); live = [v.x, v.y, v.z]; }
      for (let i = 0; i < N; i++) {
        let px, py, pz, ag;
        if (i === 0 && live) { [px, py, pz] = live; ag = 0; }
        else {
          const k = Math.min(i - 1, Math.max(0, r.count - 1)), idx = ((r.head - k) % N + N) % N;
          px = r.pos[idx * 3]; py = r.pos[idx * 3 + 1]; pz = r.pos[idx * 3 + 2];
          ag = r.count === 0 || i - 1 >= r.count ? 1 : Math.min(1, (time - r.t[idx]) / SPAN);
        }
        for (let s = 0; s < 2; s++) {
          const o = (b * N + i) * 2 + s;
          position[o * 3] = px; position[o * 3 + 1] = py; position[o * 3 + 2] = pz; age[o] = ag;
        }
      }
      // "other" = the neighbour toward the older end (the last vertex points back to its predecessor)
      for (let i = 0; i < N; i++) {
        const j = i < N - 1 ? i + 1 : i - 1, sgn = i < N - 1 ? 1 : -1;
        for (let s = 0; s < 2; s++) {
          const o = (b * N + i) * 2 + s, q = (b * N + j) * 2 + s;
          const ox = position[q * 3], oy = position[q * 3 + 1], oz = position[q * 3 + 2];
          // keep a consistent direction so the side offset never flips between neighbours
          other[o * 3] = sgn > 0 ? ox : 2 * position[o * 3] - ox;
          other[o * 3 + 1] = sgn > 0 ? oy : 2 * position[o * 3 + 1] - oy;
          other[o * 3 + 2] = sgn > 0 ? oz : 2 * position[o * 3 + 2] - oz;
        }
      }
    }
    g.attributes.position.needsUpdate = true; g.attributes.aOther.needsUpdate = true; g.attributes.aAge.needsUpdate = true;
  }

  const trails = {
    get enabled() { return enabled; },
    setEnabled(on) {
      on = !!on;
      if (on === enabled) return;
      enabled = on; mesh.visible = on;
      if (on) trails.clear();
    },
    update(dt = 0) {
      if (!enabled || !B.length) return;
      if (figure.object3d) figure.object3d.updateWorldMatrix(true, true);
      dt = Math.max(0, Math.min(dt, 0.25));
      time += dt; acc += dt;
      const step = 1 / RATE;
      if (acc >= step) { const n = Math.min(4, Math.floor(acc / step)); acc -= n * step; sample(); }
      rebuild();
    },
    // call once per frame from the renderer side if the canvas size changes (keeps the pixel width right)
    setResolution(w, h) { uniforms.uRes.value.set(w / 2, h / 2); },
    clear() {
      for (const r of ring) { r.t.fill(-1e9); r.count = 0; }
      time = 0; acc = 0;
      if (enabled && B.length) { sample(); rebuild(); }
    },
    setStyle({ width, opacity, color } = {}) {
      if (width !== undefined) uniforms.uPx.value = width;
      if (opacity !== undefined) uniforms.uOpacity.value = opacity;
      if (color !== undefined) uniforms.uColor.value.set(color);
    },
    dispose() { scene.remove(mesh); reg.delete(mesh); g.dispose(); mat.dispose(); },
  };
  // pixel width needs the drawing-buffer size; take it from the renderer the first time the mesh is drawn
  mesh.onBeforeRender = (renderer) => {
    const rt = renderer.getRenderTarget();
    if (rt) size.set(rt.width, rt.height); else renderer.getDrawingBufferSize(size);
    uniforms.uRes.value.set(size.x / 2, size.y / 2);
  };
  return trails;
}
