// audio.js: generative score for the studio. WebAudio only: no samples, no network.
// Warm filtered pads on a slow modal progression (D dorian), sparse soft plucks, a generated room reverb.
// The body steers it: activity.energy opens the filter, 'groove' brings a soft pulse (thump + brushed shaker),
// 'shake' adds a fine ticking texture, 'thick' darkens and slows, 'float' adds an airy high pad.

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (x) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const rand = (a, b) => a + Math.random() * (b - a);

// D dorian voicings, low to high. Open fifths and added seconds keep it unresolved and calm.
const CHORDS = [
  [50, 57, 64, 65], // Dm add9
  [50, 55, 59, 64], // G6 over D
  [53, 60, 64, 69], // Fmaj7
  [48, 55, 62, 64], // C add9
  [45, 52, 60, 62], // Am7 add11
  [52, 59, 62, 67], // Em7
];
const PROGRESSION = [0, 1, 0, 2, 3, 4, 5, 1];
const SCALE = [62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81]; // D dorian, plucks live here
const LOOKAHEAD = 0.25;

export function createAudio() {
  let ctx = null;
  let nodes = null;
  let started = false;
  let enabled = true;
  let volume = 0.7;
  let timer = 0;
  let suspendT = 0;

  // Smoothed control values.
  const lv = { energy: 0, groove: 0, shake: 0, thick: 0, float: 0, time: 0 };
  const target = { energy: 0, groove: 0, shake: 0, thick: 0, float: 0, time: 0 };
  let applyClock = 0;

  // Sequencer state.
  let next16 = 0;
  let step = 0;
  let bar = 0;
  let chordPos = 0;
  let melody = 4; // index into SCALE

  function noiseBuffer(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Stereo room impulse: decaying noise, darker as it fades, with a short pre-delay.
  function impulse(seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const pre = Math.floor(rate * 0.018);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / (len - pre);
        const coef = 0.25 + 0.7 * t; // more smoothing (darker) toward the tail
        lp = lp * coef + (Math.random() * 2 - 1) * (1 - coef);
        d[i] = lp * Math.pow(1 - t, decay) * 1.6;
      }
    }
    return buf;
  }

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC({ latencyHint: 'playback' });
    const n = {};

    n.master = ctx.createGain();
    n.master.gain.value = 0;
    n.comp = ctx.createDynamicsCompressor();
    n.comp.threshold.value = -20; n.comp.knee.value = 12; n.comp.ratio.value = 3; n.comp.attack.value = 0.02; n.comp.release.value = 0.35;
    n.limit = ctx.createDynamicsCompressor();
    n.limit.threshold.value = -3; n.limit.knee.value = 0; n.limit.ratio.value = 20; n.limit.attack.value = 0.002; n.limit.release.value = 0.12;
    n.master.connect(n.comp); n.comp.connect(n.limit); n.limit.connect(ctx.destination);

    n.music = ctx.createGain(); n.music.gain.value = 0.9; n.music.connect(n.master);

    n.reverb = ctx.createConvolver(); n.reverb.buffer = impulse(4.8, 2.6);
    n.wet = ctx.createGain(); n.wet.gain.value = 0.42;
    n.reverb.connect(n.wet); n.wet.connect(n.music);

    // Pads: shared lowpass with a very slow drift.
    n.padFilter = ctx.createBiquadFilter(); n.padFilter.type = 'lowpass'; n.padFilter.frequency.value = 520; n.padFilter.Q.value = 0.5;
    n.padGain = ctx.createGain(); n.padGain.gain.value = 0.55;
    n.padFilter.connect(n.padGain); n.padGain.connect(n.music);
    n.padSend = ctx.createGain(); n.padSend.gain.value = 0.55; n.padGain.connect(n.padSend); n.padSend.connect(n.reverb);
    n.drift = ctx.createOscillator(); n.drift.frequency.value = 0.043;
    n.driftAmt = ctx.createGain(); n.driftAmt.gain.value = 140;
    n.drift.connect(n.driftAmt); n.driftAmt.connect(n.padFilter.frequency); n.drift.start();

    // Plucks: dry, a tape-like feedback delay, and the room.
    n.pluck = ctx.createGain(); n.pluck.gain.value = 0.8; n.pluck.connect(n.music);
    n.delay = ctx.createDelay(2); n.delay.delayTime.value = 0.62;
    n.fb = ctx.createGain(); n.fb.gain.value = 0.32;
    n.fbTone = ctx.createBiquadFilter(); n.fbTone.type = 'lowpass'; n.fbTone.frequency.value = 2200;
    n.delayOut = ctx.createGain(); n.delayOut.gain.value = 0.35;
    n.pluck.connect(n.delay); n.delay.connect(n.fbTone); n.fbTone.connect(n.fb); n.fb.connect(n.delay);
    n.fbTone.connect(n.delayOut); n.delayOut.connect(n.music);
    n.pluckSend = ctx.createGain(); n.pluckSend.gain.value = 0.5; n.pluck.connect(n.pluckSend); n.pluckSend.connect(n.reverb);

    // Rhythm: thump + brush + fine shake ticks.
    n.rhythm = ctx.createGain(); n.rhythm.gain.value = 0.9; n.rhythm.connect(n.music);
    n.rhythmSend = ctx.createGain(); n.rhythmSend.gain.value = 0.18; n.rhythm.connect(n.rhythmSend); n.rhythmSend.connect(n.reverb);
    n.noise = noiseBuffer(1.5);

    // Float: an airy pad of high sines that glide to the current chord.
    n.airHP = ctx.createBiquadFilter(); n.airHP.type = 'highpass'; n.airHP.frequency.value = 900;
    n.air = ctx.createGain(); n.air.gain.value = 0;
    n.airHP.connect(n.air); n.air.connect(n.music);
    n.airSend = ctx.createGain(); n.airSend.gain.value = 1.1; n.air.connect(n.airSend); n.airSend.connect(n.reverb);
    n.airVoices = [0, 1, 2].map((i) => {
      const o = ctx.createOscillator(); o.type = i === 1 ? 'triangle' : 'sine';
      const g = ctx.createGain(); g.gain.value = 0.22;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07 + i * 0.045;
      const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.16;
      lfo.connect(lfoAmt); lfoAmt.connect(g.gain);
      const pan = ctx.createStereoPanner(); pan.pan.value = (i - 1) * 0.6;
      o.connect(g); g.connect(pan); pan.connect(n.airHP);
      o.start(); lfo.start();
      return o;
    });

    nodes = n;
    return true;
  }

  // ---- instruments --------------------------------------------------------------------------

  function playChord(t, notes, dur) {
    const n = nodes;
    const made = [];
    const atk = 3.6;
    const rel = 5.5;
    notes.forEach((m, i) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + atk);
      g.gain.setValueAtTime(0.05, t + dur);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + rel);
      const pan = ctx.createStereoPanner();
      pan.pan.value = ((i / (notes.length - 1)) - 0.5) * 0.7;
      g.connect(pan); pan.connect(n.padFilter);
      for (const cents of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = midiHz(m);
        o.detune.value = cents + rand(-2, 2);
        o.connect(g);
        o.start(t); o.stop(t + dur + rel + 0.1);
        made.push(o);
      }
    });
    // Soft sine bass an octave under the root.
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(0.11, t + atk * 0.8);
    bg.gain.setValueAtTime(0.11, t + dur);
    bg.gain.linearRampToValueAtTime(0.0001, t + dur + rel);
    const bo = ctx.createOscillator(); bo.type = 'sine'; bo.frequency.value = midiHz(notes[0] - 12);
    bo.connect(bg); bg.connect(n.music);
    bo.start(t); bo.stop(t + dur + rel + 0.1);
    made.push(bo);
    // Air voices glide to the upper chord tones.
    const air = [notes[2] + 12, notes[3] + 12, notes[1] + 24];
    n.airVoices.forEach((o, i) => o.frequency.setTargetAtTime(midiHz(air[i]), t, 1.4));
    return made;
  }

  function pluck(t, midi, vel) {
    const n = nodes;
    const hz = midiHz(midi);
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = hz;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 2; o2.detune.value = 3;
    const g2 = ctx.createGain(); g2.gain.value = 0.16;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.4;
    const bright = 900 + 2200 * lv.energy * (1 - 0.6 * lv.thick);
    f.frequency.setValueAtTime(bright, t);
    f.frequency.exponentialRampToValueAtTime(420, t + 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    const p = ctx.createStereoPanner(); p.pan.value = rand(-0.55, 0.55);
    o1.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(p); p.connect(n.pluck);
    o1.start(t); o2.start(t); o1.stop(t + 2.5); o2.stop(t + 2.5);
  }

  function thump(t, vel) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(108, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 190;
    o.connect(g); g.connect(f); f.connect(nodes.rhythm);
    o.start(t); o.stop(t + 0.5);
  }

  function brush(t, vel, len) {
    const s = ctx.createBufferSource(); s.buffer = nodes.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = rand(4600, 6200); bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + len * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const p = ctx.createStereoPanner(); p.pan.value = rand(-0.3, 0.3);
    s.connect(bp); bp.connect(g); g.connect(p); p.connect(nodes.rhythm);
    s.start(t, rand(0, 1.2), len + 0.05);
  }

  function tick(t, vel, pan) {
    const s = ctx.createBufferSource(); s.buffer = nodes.noise;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.025, 0.045));
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    s.connect(hp); hp.connect(g); g.connect(p); p.connect(nodes.rhythm);
    s.start(t, rand(0, 1.4), 0.06);
  }

  // ---- sequencer ----------------------------------------------------------------------------

  const tempo = () => 72 - 14 * lv.thick - 6 * lv.time;
  const barsPerChord = () => (lv.thick > 0.4 || lv.time > 0.4 ? 6 : 4);

  function nextChord(t) {
    const notes = CHORDS[PROGRESSION[chordPos % PROGRESSION.length]];
    chordPos += 1;
    const dur = (60 / tempo()) * 4 * barsPerChord();
    playChord(t, notes, dur);
  }

  function pickNote() {
    melody = Math.min(SCALE.length - 1, Math.max(0, melody + Math.round(rand(-2.4, 2.4))));
    // Lean toward chord tones: snap to a nearby pitch class in the current chord half the time.
    const chord = CHORDS[PROGRESSION[(chordPos - 1 + PROGRESSION.length) % PROGRESSION.length]];
    let note = SCALE[melody];
    if (Math.random() < 0.5) {
      const pcs = chord.map((m) => m % 12);
      for (const d of [0, 1, -1, 2, -2]) {
        const cand = SCALE[melody + d];
        if (cand && pcs.includes(cand % 12)) { note = cand; melody += d; break; }
      }
    }
    return note;
  }

  function scheduleStep(s, t) {
    const sixteenth = 60 / tempo() / 4;
    const groove = lv.groove;
    if (groove > 0.02) {
      if (s % 4 === 0) thump(t, (s % 8 === 0 ? 0.62 : 0.36) * groove);
      if (s % 4 === 2) brush(t + sixteenth * 0.14, 0.11 * groove, 0.16);
      else if (s % 4 === 0) brush(t, 0.035 * groove, 0.22);
    }
    if (lv.shake > 0.02 && Math.random() < 0.88) {
      tick(t + rand(0, 0.008), 0.05 * lv.shake * rand(0.35, 1), s % 2 ? 0.35 : -0.35);
    }
    if (s % 2 === 0) {
      const p = (0.06 + 0.14 * lv.energy + 0.04 * lv.float) * (1 - 0.6 * lv.thick);
      if (Math.random() < p) pluck(t, pickNote(), rand(0.07, 0.13));
    }
  }

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (next16 < now - 0.2) next16 = now + 0.05; // fell behind (hidden tab): skip ahead quietly
    while (next16 < now + LOOKAHEAD) {
      scheduleStep(step, next16);
      next16 += 60 / tempo() / 4;
      step = (step + 1) % 16;
      if (step === 0) {
        bar += 1;
        if (bar % barsPerChord() === 0) nextChord(next16);
      }
    }
  }

  function applyParams() {
    if (!ctx) return;
    const n = nodes;
    const now = ctx.currentTime;
    const cut = (420 + 2300 * Math.pow(lv.energy, 1.25)) * (1 - 0.55 * lv.thick);
    n.padFilter.frequency.setTargetAtTime(Math.max(180, cut), now, 0.6);
    n.air.gain.setTargetAtTime(0.06 * lv.float, now, 0.8);
    n.wet.gain.setTargetAtTime(0.42 + 0.18 * lv.float + 0.1 * lv.thick, now, 1.2);
    n.fbTone.frequency.setTargetAtTime(2200 * (1 - 0.5 * lv.thick), now, 0.8);
  }

  function rampMaster(to, seconds) {
    if (!ctx) return;
    const g = nodes.master.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(to, now + seconds);
  }

  // ---- public API ---------------------------------------------------------------------------

  return {
    get started() { return started; },
    get enabled() { return enabled; },
    get volume() { return volume; },

    async start() {
      if (started) {
        if (ctx && ctx.state === 'suspended' && enabled) await ctx.resume().catch(() => {});
        return;
      }
      try {
        if (!build()) return;
      } catch (err) {
        console.warn('[audio] unavailable', err);
        ctx = null; nodes = null;
        return;
      }
      started = true;
      try { await ctx.resume(); } catch { /* resumes on a later gesture */ }
      next16 = ctx.currentTime + 0.1;
      nextChord(ctx.currentTime + 0.05);
      applyParams();
      if (enabled) rampMaster(volume, 4);
      timer = window.setInterval(schedule, 40);
      schedule();
    },

    setEnabled(on) {
      enabled = !!on;
      if (!ctx) return;
      clearTimeout(suspendT);
      if (enabled) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        rampMaster(volume, 1.6);
      } else {
        rampMaster(0, 1.2);
        suspendT = setTimeout(() => { if (!enabled && ctx) ctx.suspend().catch(() => {}); }, 1500);
      }
    },

    setVolume(v) {
      volume = clamp01(v);
      if (ctx && enabled) {
        const g = nodes.master.gain;
        g.cancelScheduledValues(ctx.currentTime);
        g.setTargetAtTime(volume, ctx.currentTime, 0.12);
      }
    },

    update(dt, activity, layers) {
      target.energy = clamp01(activity?.energy);
      target.groove = 0; target.shake = 0; target.thick = 0; target.float = 0; target.time = 0;
      if (Array.isArray(layers)) {
        for (const L of layers) if (L && L.id in target && L.id !== 'energy') target[L.id] = clamp01(L.value);
      }
      const k = 1 - Math.exp(-Math.max(0, Number(dt) || 0) / 0.8);
      for (const key in lv) lv[key] += (target[key] - lv[key]) * k;
      applyClock += Number(dt) || 0;
      if (applyClock > 0.12) { applyClock = 0; applyParams(); }
    },

    stop() {
      clearInterval(timer);
      if (ctx) { rampMaster(0, 0.8); setTimeout(() => ctx && ctx.close().catch(() => {}), 900); }
    },
  };
}
