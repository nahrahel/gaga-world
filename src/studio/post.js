// post.js: the photographic finish. OWNER: builder B.
// Chain: RenderPass (HDR + depth) -> GTAO (contact grounding) -> sun shafts (ray-marched against the sun's
// shadow map, so mullions and the dancer cut the beams) -> subtle bloom (bright floor patches, windows)
// -> grade (AgX, monochrome split-tone, vignette, grain, sRGB) -> SMAA / FXAA to screen.
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

const PRESETS = {
  high: { pr: 2, gtao: true, gtaoScale: 1, gtaoSamples: 16, bloom: true, shafts: true, aa: 'smaa' },
  medium: { pr: 1.5, gtao: true, gtaoScale: 0.5, gtaoSamples: 8, bloom: true, shafts: true, aa: 'smaa' },
  low: { pr: 1, gtao: false, gtaoScale: 0.5, gtaoSamples: 8, bloom: false, shafts: true, aa: 'fxaa' },
};
const ORDER = ['high', 'medium', 'low'];

const FS_VERT = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;

function noiseTexture(THREE, S = 128) {
  // tileable value-noise fBm, two independent channels
  const data = new Uint8Array(S * S * 4);
  const lat = (seed) => { const r = []; let a = seed; for (let i = 0; i < 64 * 64; i++) { a = (a * 1664525 + 1013904223) >>> 0; r.push(a / 4294967296); } return r; };
  const L = [lat(7), lat(1234)];
  const val = (tab, x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % p) + p) % p, y0 = ((yi % p) + p) % p, x1 = (x0 + 1) % p, y1 = (y0 + 1) % p;
    const a = tab[y0 * 64 + x0], b = tab[y0 * 64 + x1], c = tab[y1 * 64 + x0], d = tab[y1 * 64 + x1];
    const top = a + (b - a) * u, bot = c + (d - c) * u; return top + (bot - top) * v;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    for (let ch = 0; ch < 2; ch++) {
      let s = 0, amp = 0.5, norm = 0, f = 4;
      for (let o = 0; o < 4; o++) { s += amp * val(L[ch], (x / S) * f, (y / S) * f, f); norm += amp; amp *= 0.5; f *= 2; }
      data[(y * S + x) * 4 + ch] = Math.round((s / norm) * 255);
    }
    data[(y * S + x) * 4 + 2] = 0; data[(y * S + x) * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}

export function createPost(THREE, { renderer, scene, camera, quality = 'high', autoQuality = true } = {}) {
  const shared = { depthTexture: null };
  let cam = camera;

  // ---------------------------------------------------------- render pass that also captures depth
  class DepthRenderPass extends RenderPass {
    render(r, writeBuffer, readBuffer, dt, mask) {
      super.render(r, writeBuffer, readBuffer, dt, mask);
      shared.depthTexture = this.renderToScreen ? null : readBuffer.depthTexture;
    }
  }

  // ---------------------------------------------------------- volumetric sun shafts
  const noiseTex = noiseTexture(THREE);
  class ShaftPass extends Pass {
    constructor() {
      super();
      this.fogRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
      this.scale = 0.5; this.steps = 0; this.frame = 0; this.w = 4; this.h = 4;
      this.march = new THREE.ShaderMaterial({
        defines: { STEPS: 48 },
        uniforms: {
          tDepth: { value: null }, tShadow: { value: null }, tNoise: { value: noiseTex },
          uShadowMatrix: { value: new THREE.Matrix4() }, uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
          uCamPos: { value: new THREE.Vector3() }, uToSun: { value: new THREE.Vector3(0, 1, 0) },
          uBoxMin: { value: new THREE.Vector3() }, uBoxMax: { value: new THREE.Vector3() },
          uTime: { value: 0 }, uFrame: { value: 0 }, uDensity: { value: 0.02 },
        },
        vertexShader: FS_VERT,
        fragmentShader: /* glsl */`
          #include <packing>
          uniform sampler2D tDepth, tShadow, tNoise;
          uniform mat4 uShadowMatrix, uProjInv, uCamWorld;
          uniform vec3 uCamPos, uToSun, uBoxMin, uBoxMax;
          uniform float uTime, uFrame, uDensity;
          varying vec2 vUv;
          float ign( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }
          void main() {
            float depth = texture2D( tDepth, vUv ).x;
            vec4 v = uProjInv * vec4( vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );
            v.xyz /= v.w;
            vec3 wp = ( uCamWorld * vec4( v.xyz, 1.0 ) ).xyz;
            vec3 rd = wp - uCamPos;
            float dist = length( rd );
            rd /= dist;
            float viewDist = length( v.xyz );
            if ( depth >= 0.999999 ) dist = 1e4;
            vec3 inv = 1.0 / rd;
            vec3 t0 = ( uBoxMin - uCamPos ) * inv, t1 = ( uBoxMax - uCamPos ) * inv;
            vec3 lo = min( t0, t1 ), hi = max( t0, t1 );
            float tn = max( max( lo.x, lo.y ), max( lo.z, 0.0 ) );
            float tf = min( min( min( hi.x, hi.y ), hi.z ), dist );
            if ( tf <= tn ) { gl_FragColor = vec4( 0.0, 0.0, 0.0, viewDist ); return; }
            float stepL = ( tf - tn ) / float( STEPS );
            float j = fract( ign( gl_FragCoord.xy ) + uFrame * 0.6180339 );
            float acc = 0.0;
            for ( int i = 0; i < STEPS; i ++ ) {
              vec3 p = uCamPos + rd * ( tn + ( float( i ) + j ) * stepL );
              vec4 sc = uShadowMatrix * vec4( p, 1.0 );
              vec2 inb = step( vec2( 0.0 ), sc.xy ) * step( sc.xy, vec2( 1.0 ) );
              float lit = inb.x * inb.y * step( sc.z - 0.0015, unpackRGBAToDepth( texture2D( tShadow, sc.xy ) ) );
              float n1 = texture2D( tNoise, p.xz * 0.075 + vec2( uTime * 0.0035, uTime * 0.0021 ) ).r;
              float n2 = texture2D( tNoise, vec2( p.x * 0.7 + p.z * 0.7, p.y ) * 0.13 + vec2( -uTime * 0.0027, uTime * 0.0052 ) ).g;
              float wisp = smoothstep( 0.18, 0.62, n1 * n2 * 2.2 );
              float nearWin = exp( -( p.x - uBoxMin.x ) * 0.28 );
              float dens = ( 0.18 + 1.6 * wisp ) * ( 0.45 + 0.9 * nearWin ) + 0.2 * smoothstep( 1.5, 0.0, p.y );
              acc += lit * dens;
            }
            acc *= stepL * uDensity;
            float mu = dot( rd, uToSun );
            float g = 0.5;
            float hg = ( 1.0 - g * g ) / pow( 1.0 + g * g - 2.0 * g * mu, 1.5 );
            float phase = 0.6 + 0.4 * hg;
            gl_FragColor = vec4( vec3( acc * phase ), viewDist );
          }`,
        depthTest: false, depthWrite: false,
      });
      const compositeFrag = (addBase) => /* glsl */`
        uniform sampler2D tFog, tDepth, tBase;
        uniform mat4 uProjInv;
        uniform vec2 uFogSize;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float depth = texture2D( tDepth, vUv ).x;
          vec4 v = uProjInv * vec4( vUv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0 );
          float d = length( v.xyz / v.w );
          vec2 fc = vUv * uFogSize - 0.5;
          vec2 i0 = floor( fc ), f = fc - i0;
          ivec2 mx = ivec2( uFogSize ) - 1;
          vec3 sum = vec3( 0.0 ); float wsum = 0.0;
          for ( int k = 0; k < 4; k ++ ) {
            ivec2 o = ivec2( k & 1, k >> 1 );
            vec4 s = texelFetch( tFog, clamp( ivec2( i0 ) + o, ivec2( 0 ), mx ), 0 );
            float bw = ( o.x == 1 ? f.x : 1.0 - f.x ) * ( o.y == 1 ? f.y : 1.0 - f.y );
            float w = bw * ( 1.0 / ( 0.02 + abs( s.a - d ) / max( d, 0.1 ) ) ) + 1e-5;
            sum += s.rgb * w; wsum += w;
          }
          vec3 fog = sum / wsum * uColor;
          ${addBase ? 'gl_FragColor = vec4( texture2D( tBase, vUv ).rgb + fog, 1.0 );' : 'gl_FragColor = vec4( fog, 1.0 );'}
        }`;
      const compUniforms = () => ({
        tFog: { value: this.fogRT.texture }, tDepth: { value: null }, tBase: { value: null },
        uProjInv: { value: new THREE.Matrix4() }, uFogSize: { value: new THREE.Vector2(4, 4) }, uColor: { value: new THREE.Vector3(1, 1, 1) },
      });
      this.compAdd = new THREE.ShaderMaterial({ uniforms: compUniforms(), vertexShader: FS_VERT, fragmentShader: compositeFrag(false), blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false });
      this.compCopy = new THREE.ShaderMaterial({ uniforms: compUniforms(), vertexShader: FS_VERT, fragmentShader: compositeFrag(true), blending: THREE.NoBlending, depthTest: false, depthWrite: false });
      this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); this.black.needsUpdate = true;
      this.debug = false;
      this.fsMarch = new FullScreenQuad(this.march);
      this.fsComp = new FullScreenQuad(this.compAdd);
    }
    setSize(w, h) {
      this.w = w; this.h = h;
      const fw = Math.max(4, Math.round(w * this.scale)), fh = Math.max(4, Math.round(h * this.scale));
      this.fogRT.setSize(fw, fh);
    }
    render(r, writeBuffer, readBuffer) {
      this.needsSwap = false;
      const st = scene.userData.gagaStudio;
      const sh = st && st.shafts;
      const depth = shared.depthTexture;
      if (!sh || !sh.enabled || !st.sun || !st.sun.shadow.map || !depth) return;
      if (sh.scale !== this.scale) { this.scale = sh.scale; this.setSize(this.w, this.h); }
      if (sh.steps !== this.steps) { this.steps = sh.steps; this.march.defines.STEPS = sh.steps; this.march.needsUpdate = true; }
      const u = this.march.uniforms;
      u.tDepth.value = depth; u.tShadow.value = st.sun.shadow.map.texture;
      u.uShadowMatrix.value.copy(st.sun.shadow.matrix);
      cam.updateMatrixWorld();
      u.uProjInv.value.copy(cam.projectionMatrixInverse); u.uCamWorld.value.copy(cam.matrixWorld);
      u.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
      u.uToSun.value.copy(sh.toSun); u.uBoxMin.value.copy(sh.boxMin); u.uBoxMax.value.copy(sh.boxMax);
      u.uTime.value = st.time || 0; u.uFrame.value = (this.frame = (this.frame + 1) % 4096); u.uDensity.value = sh.density;
      const oldAuto = r.autoClear; r.autoClear = false;
      r.setRenderTarget(this.fogRT); r.clear(); this.fsMarch.render(r);
      const toCopy = this.debug || readBuffer.depthTexture === depth; // sampling depth while bound to its own target is a feedback loop
      const m = toCopy ? this.compCopy : this.compAdd;
      const cu = m.uniforms;
      cu.tDepth.value = depth; cu.uProjInv.value.copy(cam.projectionMatrixInverse);
      cu.uFogSize.value.set(this.fogRT.width, this.fogRT.height);
      const k = sh.intensity * (st.sun.intensity || 1);
      cu.uColor.value.set(sh.color.r * k, sh.color.g * k, sh.color.b * k);
      this.fsComp.material = m;
      if (toCopy) {
        cu.tBase.value = this.debug ? this.black : readBuffer.texture;
        r.setRenderTarget(this.renderToScreen ? null : writeBuffer); r.clear(); this.fsComp.render(r);
        this.needsSwap = true;
      } else {
        r.setRenderTarget(this.renderToScreen ? null : readBuffer); this.fsComp.render(r);
      }
      r.autoClear = oldAuto;
    }
    dispose() { this.fogRT.dispose(); this.march.dispose(); this.compAdd.dispose(); this.compCopy.dispose(); this.fsMarch.dispose(); this.fsComp.dispose(); }
  }

  // ---------------------------------------------------------- shallow focus for close views (camera.userData.dof)
  class DofPass extends Pass {
    constructor() {
      super();
      this.distRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, format: THREE.RedFormat, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      this.copy = new THREE.ShaderMaterial({
        uniforms: { tDepth: { value: null }, uProjInv: { value: new THREE.Matrix4() } },
        vertexShader: FS_VERT,
        fragmentShader: /* glsl */`
          uniform sampler2D tDepth; uniform mat4 uProjInv; varying vec2 vUv;
          void main() {
            float z = texture2D( tDepth, vUv ).x;
            vec4 v = uProjInv * vec4( vUv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0 );
            gl_FragColor = vec4( z >= 0.999999 ? 1e3 : length( v.xyz / v.w ), 0.0, 0.0, 1.0 );
          }`,
        depthTest: false, depthWrite: false,
      });
      this.blur = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: null }, tDist: { value: this.distRT.texture }, uFocus: { value: 2 }, uMaxPx: { value: 8 }, uRes: { value: new THREE.Vector2(1, 1) } },
        vertexShader: FS_VERT,
        fragmentShader: /* glsl */`
          uniform sampler2D tDiffuse, tDist; uniform float uFocus, uMaxPx; uniform vec2 uRes; varying vec2 vUv;
          float coc( vec2 uv ) {
            float d = texture2D( tDist, uv ).r;
            float c = d > uFocus ? 1.0 - uFocus / d : ( uFocus / max( d, 0.05 ) - 1.0 ) * 0.5;
            return clamp( c, 0.0, 1.0 ) * uMaxPx;
          }
          void main() {
            vec3 base = texture2D( tDiffuse, vUv ).rgb;
            float c0 = coc( vUv );
            if ( c0 < 0.6 ) { gl_FragColor = vec4( base, 1.0 ); return; }
            vec3 sum = base; float ws = 1.0;
            for ( int i = 0; i < 28; i ++ ) {
              float r = sqrt( ( float( i ) + 0.5 ) / 28.0 ) * c0;
              float a = float( i ) * 2.39996;
              vec2 uv = vUv + vec2( cos( a ), sin( a ) ) * r / uRes;
              float w = smoothstep( r - 1.0, r + 0.5, coc( uv ) ); // in-focus pixels never bleed into the blur
              sum += texture2D( tDiffuse, uv ).rgb * w; ws += w;
            }
            gl_FragColor = vec4( sum / ws, 1.0 );
          }`,
        depthTest: false, depthWrite: false,
      });
      this.fsCopy = new FullScreenQuad(this.copy); this.fsBlur = new FullScreenQuad(this.blur);
      this.amount = 0; this.focus = 2;
    }
    setSize(w, h) { this.distRT.setSize(Math.max(4, w >> 1), Math.max(4, h >> 1)); this.blur.uniforms.uRes.value.set(w, h); }
    render(r, writeBuffer, readBuffer) {
      this.copy.uniforms.tDepth.value = shared.depthTexture;
      this.copy.uniforms.uProjInv.value.copy(cam.projectionMatrixInverse);
      r.setRenderTarget(this.distRT); this.fsCopy.render(r);
      const u = this.blur.uniforms;
      u.tDiffuse.value = readBuffer.texture; u.uFocus.value = this.focus;
      u.uMaxPx.value = 9 * this.amount * (u.uRes.value.y / 900);
      r.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.fsBlur.render(r);
    }
    dispose() { this.distRT.dispose(); this.copy.dispose(); this.blur.dispose(); this.fsCopy.dispose(); this.fsBlur.dispose(); }
  }

  // ---------------------------------------------------------- grade: AgX, monochrome split-tone, vignette, grain
  const GradeShader = {
    defines: { TONE: 0 },
    uniforms: {
      tDiffuse: { value: null }, toneMappingExposure: { value: 1.0 },
      uSaturation: { value: 0.08 }, uGrain: { value: 0.03 }, uVignette: { value: 0.13 }, uContrast: { value: 0.08 },
      uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      uShadowTint: { value: new THREE.Vector3(0.975, 0.99, 1.025) }, uHighTint: { value: new THREE.Vector3(1.02, 1.0, 0.975) },
      uLift: { value: 0.01 }, uPivot: { value: 0.62 }, uGamma: { value: 1.42 },
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: /* glsl */`
      #include <tonemapping_pars_fragment>
      uniform sampler2D tDiffuse;
      uniform float uSaturation, uGrain, uVignette, uContrast, uTime, uLift, uPivot, uGamma;
      uniform vec2 uRes;
      uniform vec3 uShadowTint, uHighTint;
      varying vec2 vUv;
      float h12( vec2 p ) { vec3 p3 = fract( vec3( p.xyx ) * 0.1031 ); p3 += dot( p3, p3.yzx + 33.33 ); return fract( ( p3.x + p3.y ) * p3.z ); }
      void main() {
        vec3 c = max( texture2D( tDiffuse, vUv ).rgb, 0.0 );
        // filmic contrast about a pivot near the wall level: darks sink, the room stays bright, highlights roll off
        float L0 = max( dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-5 );
        c *= pow( L0 / uPivot, uGamma - 1.0 );
        #if TONE == 1
          c = AgXToneMapping( c );
        #else
          c = ACESFilmicToneMapping( c );
        #endif
        float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
        vec3 tint = mix( uShadowTint, uHighTint, smoothstep( 0.05, 0.7, l ) );
        c = mix( vec3( l ) * tint, c, uSaturation );
        c = sRGBTransferOETF( vec4( max( c, 0.0 ), 1.0 ) ).rgb;
        c = mix( c, c * c * ( 3.0 - 2.0 * c ), uContrast );
        c = uLift + c * ( 1.0 - uLift );
        vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
        float vig = smoothstep( 1.0, 0.3, length( q ) );
        c *= mix( 1.0 - uVignette, 1.0, vig );
        vec2 gp = floor( vUv * uRes );
        float tt = floor( uTime * 24.0 );
        float g = ( h12( gp + tt * 17.31 ) + h12( gp * 1.37 + tt * 7.77 + 3.1 ) + h12( gp * 0.73 - tt * 3.9 ) ) / 3.0 - 0.5;
        float lum = dot( c, vec3( 0.3333 ) );
        c += g * uGrain * ( 0.45 + 0.55 * ( 1.0 - abs( lum * 2.0 - 1.0 ) ) );
        gl_FragColor = vec4( c, 1.0 );
      }`,
  };

  // ---------------------------------------------------------- assemble
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  {
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x * pr), Math.max(1, size.y * pr), {
      type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(Math.max(1, size.x * pr), Math.max(1, size.y * pr)),
    });
    rt.texture.name = 'gaga.rt';
    composer.reset(rt);
    // r170 clones a depth texture with a shared Source, so both targets would share one GL depth texture
    // (a feedback loop when the shafts read depth). Give the second target its own.
    composer.renderTarget2.depthTexture = new THREE.DepthTexture(rt.width, rt.height);
  }
  const renderPass = new DepthRenderPass(scene, cam);
  const gtao = new GTAOPass(scene, cam, size.x, size.y);
  gtao.updateGtaoMaterial({ radius: 0.42, distanceExponent: 1.6, thickness: 1.2, scale: 1.0, samples: 16, distanceFallOff: 1.0 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  gtao.blendIntensity = 0.8;
  {
    // objects registered in scene.userData.gagaNoAO (ink trails) stay out of the AO normal pass
    const orig = gtao.render.bind(gtao);
    gtao.render = (...args) => {
      const reg = scene.userData.gagaNoAO, hidden = [];
      if (reg) reg.forEach((o) => { if (o.visible) { o.visible = false; hidden.push(o); } });
      orig(...args);
      hidden.forEach((o) => { o.visible = true; });
    };
  }
  {
    const orig = gtao.setSize.bind(gtao);
    gtao.setSize = (w, h) => orig(Math.max(1, Math.round(w * gtao._scale || w)), Math.max(1, Math.round(h * gtao._scale || h)));
    gtao._scale = 1;
  }
  const shafts = new ShaftPass();
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.55, 1.15);
  const grade = new ShaderPass(GradeShader);
  grade.material.depthTest = false; grade.material.depthWrite = false; grade.material.toneMapped = false;
  const smaa = new SMAAPass(size.x, size.y);
  const fxaa = new ShaderPass(FXAAShader);
  const dof = new DofPass();
  dof.enabled = false;
  [renderPass, gtao, shafts, bloom, dof, grade, smaa, fxaa].forEach((p) => composer.addPass(p));

  // ---------------------------------------------------------- quality
  let level = null;
  function applySizes() {
    const s = renderer.getSize(new THREE.Vector2());
    const pr = Math.min(renderer.getPixelRatio(), PRESETS[level].pr);
    composer.setPixelRatio(pr);
    composer.setSize(s.x, s.y);
    fxaa.material.uniforms.resolution.value.set(1 / Math.max(1, s.x * pr), 1 / Math.max(1, s.y * pr));
    grade.uniforms.uRes.value.set(s.x * pr, s.y * pr);
  }
  function setQuality(q, fromAuto = false) {
    if (!PRESETS[q]) q = 'high';
    if (q === level) return;
    level = q;
    const P = PRESETS[q];
    gtao.enabled = P.gtao; gtao._scale = P.gtaoScale;
    gtao.updateGtaoMaterial({ samples: P.gtaoSamples });
    bloom.enabled = P.bloom; shafts.enabled = P.shafts;
    smaa.enabled = P.aa === 'smaa'; fxaa.enabled = P.aa === 'fxaa';
    applySizes();
    const st = scene.userData.gagaStudio;
    if (st && st.setQuality && st.quality !== q) st.setQuality(q);
    if (fromAuto && typeof post.onAutoQuality === 'function') post.onAutoQuality(q);
  }

  // automatic downgrade: under 45 fps for 3 s steps down one level
  const perf = { last: 0, slow: 0, ema: 1 / 60, cooldown: 0 };
  function watch() {
    const now = performance.now();
    if (perf.last) {
      const d = (now - perf.last) / 1000;
      if (d < 0.25) { // ignore hidden-tab gaps
        perf.ema += (d - perf.ema) * 0.1;
        perf.cooldown = Math.max(0, perf.cooldown - d);
        if (1 / perf.ema < 45) perf.slow += d; else perf.slow = Math.max(0, perf.slow - d * 2);
        if (post.autoQuality && perf.slow > 3 && perf.cooldown === 0) {
          const i = ORDER.indexOf(level);
          if (i < ORDER.length - 1) { setQuality(ORDER[i + 1], true); perf.cooldown = 3; }
          perf.slow = 0;
        }
      }
    }
    perf.last = now;
  }

  let time = 0;
  const post = {
    composer,
    autoQuality,
    onAutoQuality: null,
    get quality() { return level; },
    get fps() { return 1 / perf.ema; },
    passes: { renderPass, gtao, shafts, bloom, dof, grade, smaa, fxaa },
    render(dt = 1 / 60) {
      watch();
      time += dt;
      grade.uniforms.uTime.value = time;
      const hint = cam.userData && cam.userData.dof;
      dof.enabled = !!(hint && hint.amount > 0.01 && shared.depthTexture !== undefined && level !== 'low');
      if (dof.enabled) { dof.amount = hint.amount; dof.focus = hint.focus; }
      composer.render(dt);
    },
    setSize(w, h) { renderer.setSize(w, h, false); applySizes(); },
    setCamera(c) {
      cam = c; renderPass.camera = c; gtao.camera = c;
      gtao.gtaoMaterial.defines.PERSPECTIVE_CAMERA = c.isPerspectiveCamera ? 1 : 0; gtao.gtaoMaterial.needsUpdate = true;
    },
    setQuality: (q) => setQuality(q, false),
    setGrade({ saturation, grain, vignette, exposure, contrast, tone } = {}) {
      const u = grade.uniforms;
      if (tone !== undefined) { grade.material.defines.TONE = tone === 'agx' ? 1 : 0; grade.material.needsUpdate = true; }
      if (saturation !== undefined) u.uSaturation.value = saturation;
      if (grain !== undefined) u.uGrain.value = grain;
      if (vignette !== undefined) u.uVignette.value = vignette;
      if (exposure !== undefined) u.toneMappingExposure.value = exposure;
      if (contrast !== undefined) u.uContrast.value = contrast;
    },
    dispose() { composer.passes.forEach((p) => p.dispose && p.dispose()); composer.dispose && composer.dispose(); noiseTex.dispose(); },
  };
  setQuality(quality);
  return post;
}
