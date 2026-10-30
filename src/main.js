// main.js: bootstrap and frame loop. OWNER: integrator. Wires the modules described in CONTRACT.md.
import * as THREE from 'three';
import { createStudio } from './studio/studio.js';
import { createPost } from './studio/post.js';
import { createCameraRig } from './studio/cameras.js';
import { createTrails } from './studio/trails.js';
import { createFigure } from './figure.js';
import { createEngine } from './motion/engine.js';
import { VOCAB, CLASS_SCRIPTS } from './vocab.js';
import { createUI } from './ui/ui.js';
import { createAudio } from './ui/audio.js';

const STEP = 1 / 30;

function showFatal(err) {
  console.error(err);
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:auto 16px 16px 16px;padding:12px 14px;background:#fff;color:#111;font:13px/1.4 system-ui;border:1px solid #111;z-index:99';
  el.textContent = 'The studio could not load: ' + (err && err.message ? err.message : err) + '. Reload the page to try again.';
  document.body.appendChild(el);
}

async function boot() {
  const canvas = document.getElementById('stage') || Object.assign(document.body.appendChild(document.createElement('canvas')), { id: 'stage' });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 80);
  camera.position.set(2.6, 1.55, 4.2);

  const quality = 'high';
  const studio = createStudio(THREE, { renderer, scene, quality });

  const soloist = await createFigure(THREE, { material: 'charcoal', role: 'soloist' });
  soloist.object3d.position.copy(studio.soloistSpot);
  scene.add(soloist.object3d);

  // "You" in Join mode: a second body with its own interpretation of the same cues. Only visible while joined.
  const participant = await createFigure(THREE, { material: 'charcoal', role: 'participant' });
  participant.object3d.position.copy(studio.participantSpot);
  const toSolo = new THREE.Vector3().subVectors(studio.soloistSpot, studio.participantSpot);
  participant.object3d.rotation.y = Math.atan2(toSolo.x, toSolo.z) - 0.5;
  participant.object3d.visible = false;
  scene.add(participant.object3d);

  const engine = createEngine(THREE, { vocab: VOCAB });
  const soloId = engine.addPerformer(soloist, { seed: 7, role: 'soloist', variation: 0.5 });
  const partId = engine.addPerformer(participant, { seed: 19, role: 'participant', variation: 0.75 });

  const cameras = createCameraRig(THREE, { camera, dom: renderer.domElement, studio });
  const trails = createTrails(THREE, { scene, figure: soloist });
  const post = createPost(THREE, { renderer, scene, camera, quality });
  const audio = createAudio();

  // Training controls. Speed and pause apply to dancer time only (engine, flesh, trails), never to camera or UI.
  let mapForced = false, stepBudget = 0;
  const app = {
    speed: 1, paused: false, trails: false,
    setSpeed(x) { this.speed = [0.25, 0.5, 1].includes(x) ? x : 1; },
    setPaused(p) { this.paused = !!p; },
    step() { this.paused = true; stepBudget += STEP; },
    setTrails(on) { this.trails = !!on; trails.setEnabled(this.trails); if (!on) trails.clear(); },
    study(view) { cameras.study(view); },
    show(id) {
      const v = VOCAB.find((w) => w.id === id);
      if (!v) return null;
      const p = v.show || { view: 'three', speed: 1 };
      this.setSpeed(p.speed); this.setPaused(false); this.setTrails(!!p.trails); cameras.study(p.view);
      mapForced = !!p.map;
      return p;
    },
  };

  const ui = createUI({ vocab: VOCAB, scripts: CLASS_SCRIPTS, engine, cameras, audio, figures: [soloist, participant], post, studio, app });
  ui.on?.('settings', () => { mapForced = false; });

  cameras.on('mode', (m) => {
    const joined = m === 'join';
    participant.object3d.visible = joined;
    participant.setHeadVisible(!joined);
    if (!joined) engine.setThread?.(partId, { target: null });
  });

  // Pointer: in Orbit a click on the soloist focuses the nearest bone; in Join the cursor is a thread on your hands.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3(), threadTarget = new THREE.Vector3();
  let down = null, lastThreadMove = -1e9;
  const toNdc = (e) => ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || cameras.mode !== 'orbit') return;
    ray.setFromCamera(toNdc(e), camera);
    const hit = ray.intersectObject(soloist.mesh, false)[0];
    if (!hit) return;
    let best = null, bestD = Infinity;
    for (const b of soloist.bones) {
      if (b.name === 'root') continue;
      const d = b.getWorldPosition(tmp).distanceTo(hit.point);
      if (d < bestD) { bestD = d; best = b.name; }
    }
    if (best) cameras.focus(best);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (cameras.mode !== 'join' || !engine.setThread) return;
    ray.setFromCamera(toNdc(e), camera);
    threadTarget.copy(ray.ray.origin).addScaledVector(ray.ray.direction, 0.55);
    const hand = ndc.x < -0.15 ? 'L' : ndc.x > 0.15 ? 'R' : 'both';
    engine.setThread(partId, { target: threadTarget, hand, strength: 0.7 });
    lastThreadMove = performance.now();
  });
  renderer.domElement.addEventListener('pointerleave', () => engine.setThread?.(partId, { target: null }));

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post.setSize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  let last = performance.now(), danceTime = 0;
  function frame(now) {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 1 / 20);
    last = now;
    let ddt = app.paused ? 0 : dt * app.speed;
    if (app.paused && stepBudget > 0) { ddt = STEP; stepBudget = Math.max(0, stepBudget - STEP); }
    danceTime += ddt;
    if (cameras.mode === 'join' && lastThreadMove > 0 && now - lastThreadMove > 2500) {
      engine.setThread?.(partId, { target: null }); lastThreadMove = -1e9;
    }
    ui.update(dt);
    engine.update(ddt, danceTime);
    const showMap = !!ui.settings.sensationMap || mapForced;
    soloist.setFlesh(engine.getFleshParams(soloId));
    soloist.setGlow(showMap ? engine.getGlowPoints(soloId) : []);
    soloist.update(ddt);
    if (participant.object3d.visible) {
      participant.setFlesh(engine.getFleshParams(partId));
      participant.update(ddt);
    }
    trails.update(ddt);
    studio.update(dt, now / 1000);
    const activity = engine.getActivity(soloId);
    cameras.update(dt, { activity, soloist, participant: participant.object3d.visible ? participant : null });
    post.render(dt);
    audio.update(dt, activity, engine.getLayers());
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.__gaga = { THREE, scene, camera, renderer, studio, soloist, participant, engine, cameras, trails, post, ui, audio, app };
}

boot().catch(showFatal);
