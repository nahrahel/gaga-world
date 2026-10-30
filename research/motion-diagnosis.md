# Motion diagnosis: engine v1

Numbers come from `node dev/motion-lab.mjs` (seed 7, dt 1/60, 30 s after an 8 s warmup); results in `dev/lab/baseline.md`, plots in `dev/shots/lab-*.png`. Compare a rebuild with `--out after --compare dev/lab/baseline.json`. Keep what works: determinism, clean dt edge cases, no NaN.

A snap is angular acceleration above 3000 deg/s^2 (over 50 deg/s velocity change in one frame).

## Ranked root causes

### 1. No wave travels through the spine, and the joints move independently
- Each frame the pose is rebuilt as a sum of joint angles (`engine.js:552-598`). Every channel then passes through its own spring, and no spring is coupled to its parent (`engine.js:431-446`, `rig.js:30-34`).
- Base-layer noise has a separate seed per spine and neck joint (`qualities.js:105-114`); 155 noise calls in total.
- `spreadSpine` (`shapes.js:11-17`) sends every trunk command to all six spine joints in phase.
- Snake fakes a travelling wave by delaying the same signal 0.12 s per segment on a 3 to 6 s period (`qualities.js:339-362`). Across spine01 to spine06 that adds up to only 0.17 of a wavelength, so the trunk sways as one C-curve.
- Gaze then cancels the trunk tilt at the head (`engine.js:403`, `engine.js:411-413`).
- **Proof:** snake spine01 to spine06 lag 0.53 s on a 3.1 s period; chest-to-head r -0.96; sagittal 1.6 deg per joint (bible 4 to 8). Other words: spine moves as a block (lag 0 to 0.07 s). Arm chain lags inconsistent, r -0.16 to 0.41. See `lab-kymo-snake-0-8.png`, `lab-snake-side.png`.
- **Fix:** articulated dynamics where each child inherits its parent's motion through inertia and damping; spine driven by a curvature field `kappa(s,t)` with a wavelength of about one spine length, reaching the head; gaze as a slow bias, never cancellation.

### 2. Shape changes and other transitions are abrupt
- Weight-shift targets jump every 1 to 2.2 s (`qualities.js:95-99`, read unfiltered at `engine.js:235-238`); gaze targets jump every 1.2 to 3.8 s (`engine.js:384-399`).
- Shape blends are synchronous lerps in joint space (`shapes.js:171-177`). A forced re-pick restarts the blend from zero velocity (`shapes.js:162-164`).
- Nine qualities add offsets after the springs (`engine.js:595`). Boil and grab inject velocity kicks directly (`qualities.js:597`, `qualities.js:970`).
- Noise is only C1 (`noise.js:27`); shake release halves spread in one frame (`qualities.js:534`).
- **Proof:** all top 0.5% jerk spikes in pelvis, spine and head land within 4 frames of a target jump; trunk jerk kurtosis 144 in idle (smooth is about 3); shake release hits the forearm at 28,000 deg/s^2; head p99 273 to 546 deg/s.
- **Fix:** every decision becomes a minimum-jerk trajectory from the current position and velocity; textures are band-limited C2 signals feeding the dynamics; gains change through envelopes; nothing is added after integration.

### 3. Feet never roll onto the balls, and the dancer is often off balance
- Weight transfer moves the pelvis only halfway toward the standing foot (`engine.js:362`). The balance box is the area between both ankles and ignores heel peel (`engine.js:367-370`).
- Steps are a state machine that runs after the springs. The heel peels 26 deg in 0.1 s (`engine.js:458`), and the lift follows a sin envelope that hits the floor at full speed (`engine.js:462`).
- The toe angle jumps when a foot crosses the 4 mm airborne threshold (`engine.js:474`).
- The foot's orientation is copied from the stance (`rig.js:185`), so there is no heel-ball-toe roll. Toes have no floor constraint (`qualities.js:131`, `qualities.js:224`).
- Lunas moves the COM forward 1.2 cm (`qualities.js:231`); groove keeps heels up (`qualities.js:687`).
- **Proof:** COM outside support in 100% of single-support frames everywhere; overall 15 to 27% in calm words, 66% lunas, 100% groove. Toe tips 21 to 35 mm below the floor. Legs 44 to 102 snap events per min, shin up to 48,000 deg/s^2 at touchdown. See `lab-legs-idle.png`, `lab-step-foot-side.png`.
- **Fix:** a capture-point COM controller owns the pelvis; heel, ball and toe contacts per foot; phased steps (shift weight, unload, peel, swing with toes clear, strike, load); ankle solved to keep active contacts and toes on the floor; peel moves the support region.

### 4. Hands settle at the groin (from code; not measured)
- Every hanging arm posture keeps the elbow bent at 26 to 62 deg (`shapes.js:186-190`; the base pose has 20 deg, `rig.js:52`).
- When an arm hangs with a bent elbow, a rule swings it forward (`engine.js:266-272`).
- The pelvis collision slab carries the forearm to the front of the belly (`rig.js:219`, `rig.js:233-235`).
- **Fix:** keep relaxed arms close to straight (elbow about 5 to 15 deg) and let them hang beside the thigh. Replace the position push with a continuous repulsive field that moves the hand sideways rather than forward. Plan rest points for the hands inside each motor program.

### 5. Float lifts the arms too high at low intensity (from code; not measured)
- The amount of the current shape never drops below 0.75, whatever the layer intensity (`engine.js:568-571`). Shapes are chosen by size and never scaled down (`shapes.js:57-61`).
- Float's shape weight is 0.95 and its arm postures sit at 80 to 124 deg elevation (`qualities.js:157-159`, `shapes.js:193-195`).
- A float floor of 0.15 is always on (`engine.js:561`, `engine.js:582`).
- **Fix:** scale posture amplitude by intensity; keep the idle floor out of shape selection.

### 6. Calm words are hard to tell from idle
- All words share one body-shape scheduler (21 shapes, holds of 8 to 12 s, `shapes.js:22-56`, `shapes.js:169`) and one arm scheduler (12 postures, `shapes.js:185-198`).
- A word only changes the pick weights and some gains (`engine.js:170-184`).
- One random stream drives everything, so time and thick lift the same foot at the same moment.
- **Proof:** with its own generator off, mean joint speed drops only 1% (float), 7% (lena), 13% (snake), 4% (silly), 14% (thick); lunas rises 2%. readyLow and ready fill 45% of all time; every word switches posture 18 to 32 times per min. See `lab-sameness-rows.png`.
- **Fix:** give each quality its own motor program with its own initiation point, pathway, tempo structure, effort and postures. Let modifiers transform program parameters, and give each subsystem its own random stream.

### 7. Arm clamps and position pushes add kinks
Hard clamps and pushes in `rig.js:250-358` add kinks. **Fix:** barrier torques inside the dynamics.

## Target architecture (same public Engine API, 240 Hz substeps)

1. Layer envelopes produce weights, with per-performer onset delays.
2. One motor program per quality, each with its own state and random stream, emits minimum-jerk goals, curvature fields, effort parameters and force pulses. Modifiers transform those parameters.
3. Arbitration per region shares an attention budget.
4. Articulated dynamics run in world space with parent-to-child coupling and barrier-torque limits.
5. Balance: capture-point COM, heel/ball/toe contacts, phased steps, foot roll, leg IK.
6. Gaze applies a minimum-jerk bias inside step 4.
7. Output writes quaternions; activity, glow and flesh read from the integrated state.

**Gates:** calm words under 5 upper snaps per min, trunk jerk kurtosis under 8, head under 150 deg/s; snake 0.4 to 0.6 wavelength on the trunk, chest-to-head r above +0.5, sagittal 3 to 6 deg; arm lags 0.05 to 0.12 s; COM outside under 2% (0% single support); penetration under 2 mm; stance knee p50 10 to 25 deg; each word's own generator above 50% of its motion.
