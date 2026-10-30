# Gaga World: module contract

One faceless soloist dances Gaga in a daylight dance studio. The user clicks Gaga words; each word adds a movement layer to the body (layers stack like a real class; click again to release; each layer has an intensity dial). A guided "Teach" mode runs a class that stacks and releases cues over time. Camera modes: Orbit (default, walk-around), Walk (eye level), Join (first-person participant dancing beside the soloist; Gaga classes have no observers), Director (auto camera that frames the body part the active words live in).

Look: premium, high-key, monochrome (black, white, greys). Daylight studio: white walls, pale grey marley floor, tall steel windows throwing sun shafts, curtained mirror wall (Gaga classes avoid mirrors), wooden barres. The soloist is a sculpted charcoal body (think Antony Gormley cast-iron figure) that reads like ink on paper against the bright room.

## Stack and house rules
- three.js **0.170.0** only, via import map: `"three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"`, `"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"`. No other runtime libraries. ES modules, `.js` extension, browser code imports `* as THREE from 'three'`.
- Final artifact rules (CSP): runtime fetches to other hosts are blocked; fonts only from Google Fonts; all assets ship inside our own JS (base64) or as relative files. No `alert/confirm/prompt`, no iframes.
- Dev server: `python3 -m http.server 5181 --bind 127.0.0.1` from the project root (already running). URLs: `http://127.0.0.1:5181/dev/<page>.html`.
- Headless screenshots (WebGL works, Apple M4 Metal): `node dev/shot.mjs <url> <out.png> [waitMs] [WxH]`; prints console errors. View the png with the Read tool. Save shots under `dev/shots/<yourprefix>-*.png`.
- Time: drive animation from wall-clock dt clamped to [0, 1/20] s (hidden panes throttle rAF).
- Only edit files you own (see ownership). Need something from another module? Code to this contract and write `DEVIATION:` in your report if you must diverge.
- UI copy rules (also apply to any user-visible strings in any module): no em dashes; no "not X, it's Y" style reframes; sentence case; digits for numbers; no hype words (seamless, immersive, intuitive, elevate, unlock, leverage, robust, dynamic, effortless, transformative, showcase, enhance, empower, streamline, cutting-edge, innovative, vibrant).
- No git commits. No network calls at runtime other than the import map CDN and Google Fonts.

## Ownership
| Area | Files | Owner |
|---|---|---|
| Skeleton, vocab data, bootstrap, build | `src/skeleton.js`, `src/vocab.js`, `src/main.js`, `build.mjs`, `CONTRACT.md`, `dev/shot.mjs` | integrator |
| Body + figure | `tools/build-body.mjs`, `src/figure.js`, `src/assets/body-data.js`, `dev/figure-test.html` | builder A |
| Studio, post, cameras | `src/studio/studio.js`, `src/studio/post.js`, `src/studio/cameras.js`, `dev/studio-test.html` | builder B |
| Motion engine | `src/motion/*.js`, `dev/motion-test.html` | builder C |
| UI, teacher, audio, page shell | `src/index.html`, `src/styles.css`, `src/ui/*.js`, `dev/ui-test.html` | builder D |

## Skeleton (src/skeleton.js, read it, do not edit)
57 bones, names like `pelvis, spine01..spine06, neck01, neck02, head, clavicle_L, upperarm_L, forearm_L, hand_L, thumb01_L..thumb03_L, index01_L..03, middle.., ring.., pinky.., thigh_L, shin_L, foot_L, toes_L` (+ `_R`). `root` sits on the floor at the origin. Figure faces +Z, its left is +X. Rest pose is an A-pose (arms 50 deg below horizontal, palms toward thighs). Every bone has IDENTITY rest rotation; rest local position = head minus parent head.
Exports: `BONES` (name, parent, head, tail, dir, length, axes {flex, abd, twist}, limits), `BONE_INDEX`, `BONE_BY_NAME`, `SPINE_CHAIN`, `FINGERS`, `SIDES`, `LANDMARKS` (lena, biba, navel, sternum: bone + rest world point), `buildSkeleton(THREE) -> {bones, byName, root, skeleton}`, `jointQuat(THREE, name, flexDeg, abdDeg, twistDeg, out?, clamp=true) -> Quaternion` (anatomical sign conventions documented at the top of the file).

## Figure API (src/figure.js, builder A)
```js
export async function createFigure(THREE, { material = 'charcoal', role = 'soloist' } = {}) -> Figure
Figure = {
  object3d,            // THREE.Group; contains the SkinnedMesh and the root bone. Place/rotate this for world placement.
  mesh,                // THREE.SkinnedMesh (castShadow + receiveShadow on)
  bones, byName,       // from buildSkeleton(THREE): the engine writes bone.quaternion / pelvis+root position
  setMaterial(name),   // 'charcoal' | 'plaster' | 'graphite'
  setFlesh({ gain, stiffness, damping }), // secondary flesh motion; gain 0 = rigid
  setGlow(points),     // [{ bone, offset:[x,y,z] (bone-local meters), radius, intensity 0..1 }]; [] clears. Sensation map.
  setHeadVisible(bool),// false in first-person Join mode (hides head + neck verts to avoid clipping)
  update(dt),          // call once per frame AFTER the engine posed the bones (flesh springs, glow uniforms)
  dispose(),
}
```

## Motion engine API (src/motion/engine.js, builder C)
```js
export function createEngine(THREE, { vocab }) -> Engine
Engine = {
  addPerformer(figure, { seed = 1, role = 'soloist', variation = 0.5 }) -> id   // participant gets its own seed: same cues, own interpretation
  removePerformer(id),
  setLayer(id, target),   // target 0..1. 0 releases with that quality's release envelope. Unknown ids are ignored.
  toggleLayer(id, defaultIntensity = 0.7),
  releaseAll(),
  getLayers() -> [{ id, target, value, addedAt }], // value = current enveloped intensity; ordered by addedAt
  accent(id),             // one-shot accent for kind 'accent' words (e.g. quick/explosive)
  getActivity(performerId?) -> { regions: { center, pelvis, spine, arms, hands, legs, feet, head, flesh }, energy, tempo, dominant },
                          // all 0..1 except tempo (Hz-ish) and dominant (vocab id or null); used by cameras, audio, UI meters
  getGlowPoints(performerId) -> [...] // feed to figure.setGlow when the sensation map is on
  getFleshParams(performerId) -> { gain, stiffness, damping } // feed to figure.setFlesh
  update(dt, time),       // poses every performer's bones
  on(event, cb),          // 'layers' (array as getLayers) whenever targets change
}
```
The body never fully stops (Gaga classes never stop): with zero layers there is still breath and a quiet listening sway.

## Vocabulary data (src/vocab.js, integrator)
```js
export const VOCAB = [{ id, word, tier /*1 intro, 2 extended*/, region /*center|pelvis|spine|extremities|flesh|whole|texture*/,
  kind /*'generator'|'modifier'|'accent'*/, gloss /*<=8 words*/, meaning /*1-3 sentences*/, cue /*paraphrased teacher cue*/,
  sensation /*where you feel it*/, bodyMap /*landmark ids: lena|biba|luna|spine|flesh|feet|head|hands*/, key /*shortcut or null*/ }]
export const CLASS_SCRIPTS = [{ id, title, minutes, steps: [{ t /*sec*/, say, set: { [id]: intensity }, release: [id] }] }]
```
`src/vocab.js` starts as a provisional list and gets replaced with researched content; code to the schema, never hardcode words.

## Studio / Post / Cameras API (src/studio/*, builder B)
```js
export function createStudio(THREE, { renderer, scene, quality = 'high' }) -> Studio
Studio = { update(dt, time), bounds: { minX, maxX, minZ, maxZ }, floorY: 0, soloistSpot: Vector3, participantSpot: Vector3, sunDirection: Vector3, setQuality(level) }

export function createPost(THREE, { renderer, scene, camera, quality = 'high' }) -> Post
Post = { render(dt), setSize(w, h), setCamera(cam), setQuality('high'|'medium'|'low'), setGrade({ saturation /*0..1, default 0.08*/, grain, vignette }) }

export function createCameraRig(THREE, { camera, dom, studio }) -> Cameras
Cameras = {
  mode, setMode('orbit'|'walk'|'join'|'director'), cycle(),
  update(dt, { activity, soloist /*Figure*/, participant /*Figure or null*/ }),
  focus(boneName),        // orbit target eases to that bone of the soloist (click-to-follow)
  on('mode', cb),
}
```

## UI / Teacher / Audio (src/ui/*, builder D)
```js
export function createUI({ vocab, scripts, engine, cameras, audio, figures, post, studio }) -> UI   // builds DOM over the canvas
UI = { update(dt), settings /* { sensationMap, sound, material, quality } */, on('settings', cb) }
export function createTeacher({ engine, scripts }) -> Teacher  // subtitles only, no voice (user decision)  // { start(scriptId), pause(), resume(), stop(), update(dt), state, on('cue'|'end', cb) }
export function createAudio() -> Audio // { start() (after a user gesture), setEnabled(bool), setVolume(0..1), update(dt, activity, layers) }  // music only
```

## Frame order (src/main.js, integrator)
dt (wall clock, clamped) -> ui.update -> teacher (inside ui) -> engine.update -> figure.update (each) -> studio.update -> cameras.update -> post.render -> audio.update.

## Builder report format (return to integrator, 150-300 words)
Files touched with line counts; API `DEVIATION:` notes; screenshot paths that prove it works; known issues; what you'd do next.

## Training layer (v2, added after the user's "make it a 10/10 training product" brief)
Goal: a learner can watch any word from the angle and speed where its detail is visible, understand what to look for, and get prompts to explore in their own body. The app never claims to assess the learner. The dancer is labelled as an illustration (`ILLUSTRATION_NOTE`), never as correct form.
- Vocab additions (src/vocab.js): each entry has `lookFor[]` (what the animation shows), `explore[]` (questions for the learner's body), `confidence` ('A'|'B'|'C' research grade), `show: { view, speed, trails?, map? }` ("Show me" preset). New exports: `ILLUSTRATION_NOTE`, `GAGA_VS_CLASS` ([{ gaga, typical }]).
- `app` object (src/main.js, integrator) passed to `createUI({ ..., app })`:
  `app.setSpeed(x)` (0.25 | 0.5 | 1; slows the dancer, flesh and trails, never the camera or UI), `app.speed`, `app.setPaused(bool)`, `app.paused`, `app.step()` (advance 1/30 s of dancer time while paused), `app.setTrails(bool)`, `app.trails`, `app.study(view)` (calls `cameras.study`), `app.show(id)` (applies a word's `show` preset: view, speed, trails, sensation map).
- Cameras (builder B): `cameras.study(view)` with views `front | side | back | three | hands | feet | spine | pelvis | overhead`. Switches to orbit mode, eases (about 1.2 s) to a framing that tracks the soloist's bones for that view, then the user can keep orbiting from there. `cameras.studyViews` = [{ id, label }]. `cameras.on('study', cb)`.
- Trails (builder B, new file `src/studio/trails.js`): `createTrails(THREE, { scene, figure, bones = ['hand_L','hand_R','head','pelvis','foot_L','foot_R'] })` -> `{ setEnabled(bool), enabled, update(dt), clear() }`. Thin ink-coloured ribbons showing the last ~1.5 s of each bone's path, fading out; must read on the bright floor and stay subtle. dt passed in is dancer time (so trails slow down with speed).
