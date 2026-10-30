// teacher.js: runs a CLASS_SCRIPT against the motion engine on wall-clock dt.
// Steps fire when the class clock passes step.t: releases first, then sets, then the cue text (shown as subtitles).
// The user can keep adding or releasing their own words while a class runs; the teacher only
// touches the ids its steps name.

const safe = (fn) => { try { return fn(); } catch (err) { console.error('[teacher]', err); return undefined; } };

export function createTeacher({ engine, scripts = [] } = {}) {
  const subs = new Map();
  const emit = (evt, payload) => subs.get(evt)?.forEach((cb) => safe(() => cb(payload)));

  let script = null;
  let steps = [];
  let idx = 0;
  let time = 0;
  let duration = 0;
  let state = 'idle'; // 'idle' | 'playing' | 'paused'

  function durationOf(s, list) {
    const last = list.length ? list[list.length - 1].t : 0;
    const planned = s.minutes > 0 ? s.minutes * 60 : Infinity;
    // Leave room after the final cue to sit in it, without a long silent tail.
    return Math.max(last + 20, Math.min(planned, last + 45));
  }

  function setState(next) {
    if (state === next) return;
    state = next;
    emit('state', state);
  }

  function runStep(i) {
    const step = steps[i];
    if (!step) return;
    for (const id of step.release || []) safe(() => engine?.setLayer(id, 0));
    for (const [id, v] of Object.entries(step.set || {})) safe(() => engine?.setLayer(id, v));
    emit('cue', { text: step.say || '', index: i, total: steps.length, step, script, time });
  }

  function finish(reason) {
    const ended = script;
    setState('idle');
    emit('end', { script: ended, reason });
  }

  const api = {
    get state() { return state; },
    get script() { return script; },
    get time() { return time; },
    get duration() { return duration; },
    get stepIndex() { return idx; },
    get stepCount() { return steps.length; },

    start(scriptId) {
      const s = scripts.find((x) => x.id === scriptId) || scripts[0];
      if (!s) return false;
      if (state !== 'idle') finish('restart');
      script = s;
      steps = (s.steps || []).slice().sort((a, b) => (a.t || 0) - (b.t || 0));
      idx = 0;
      time = 0;
      duration = durationOf(s, steps);
      setState('playing');
      emit('start', { script });
      api.update(0);
      return true;
    },

    pause() { if (state === 'playing') setState('paused'); },
    resume() { if (state === 'paused') setState('playing'); },
    toggle() { if (state === 'playing') api.pause(); else if (state === 'paused') api.resume(); },

    // Jump to the next cue and run it now.
    skip() {
      if (state === 'idle') return;
      if (idx < steps.length) {
        time = Math.max(time, steps[idx].t || 0);
        runStep(idx);
        idx += 1;
      } else {
        finish('complete');
      }
    },

    stop() {
      if (state === 'idle') return;
      finish('stop');
    },

    update(dt) {
      if (state !== 'playing') return;
      const step = Math.min(Math.max(Number(dt) || 0, 0), 0.25);
      time += step;
      while (idx < steps.length && (steps[idx].t || 0) <= time) {
        runStep(idx);
        idx += 1;
      }
      if (idx >= steps.length && time >= duration) finish('complete');
    },

    on(evt, cb) {
      if (!subs.has(evt)) subs.set(evt, new Set());
      subs.get(evt).add(cb);
      return () => subs.get(evt)?.delete(cb);
    },
  };
  return api;
}
