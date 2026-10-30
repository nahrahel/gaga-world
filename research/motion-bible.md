# Motion bible (integrator's translation of research into engine design)

Read with `vocabulary.md` (meanings, confidence) and `movement-observations.md` (what footage showed, with numbers). Where this file and the footage disagree on numbers, footage wins; where they disagree on meaning, vocabulary.md wins.

## What must be true on screen
1. The body never stops. Zero layers = float at ~15% plus breath, a weight shift every 1-2 s and small gestures in the hands. Never a neutral mannequin stance.
2. Slow shape + fast texture. Big postures (reach V with spread fingers, forward fold with hanging arms and bent knees, side bend with one arm overhead, deep plie, twist, arms out) hold 8-12 s and blend over 1.5-3 s. On top, distal joints (fingers, wrists, elbows, knees, shoulders, head) carry aperiodic 2-5 Hz "small gestures" that never fully switch off. Use two noise bands: ~0.3 Hz for pelvis/weight, ~3 Hz for distal joints.
3. No shared beat. Everything except gait and the Groove bounce is layered noise, traveling waves and impulses. No sine-wave robot loops; if you use oscillators, modulate frequency and amplitude with noise and keep per-joint phase offsets.
4. Sequential flow. Proximal leads, distal follows (shoulder -> elbow ~0.08 s -> wrist ~0.16 s -> fingers ~0.24 s; pelvis -> lumbar -> thoracic -> neck -> head for Lena). This lag is what reads as Gaga flow.
5. Cues stack and are absorbed over 1-3 s (smoothstep attack). Release 1.5-3 s. Accents land in under 0.25 s and decay softly over 0.5-1 s back to what was there.
6. Grounded and soft. Knees are soft at all times (5-25 deg), deep plie is common. Feet stay planted unless a deliberate foot event lifts them (heel peel 3-5 cm, a full lift every 2-3 s in small gestures with knee 40-60 deg). Zero foot sliding, zero floor penetration, hands and forearms never pass through the torso or thighs.
7. Eyes open, aware. The faceless head still behaves like someone looking: it scans the room slowly, often looks at the hands, sometimes at the other dancer or camera. Never a hanging trance head except inside a fold or a shake. Neck and jaw region stay free (pleasure, no strain).
8. Float is lift against gravity, never slump. "Dead flesh" is the thing to avoid. Melt and collapse always get carried back up.
9. Individuality. Per performer: own noise seed, tempo offset +-20%, preferred limb for accents, posture bias for the same cue (folded vs upright vs high), cue onset delay 0.5-3 s. The soloist and the participant must never look in unison.

## Engine architecture (suggested; deviate with reasons)
Per frame, per performer, build anatomical angles {flex, abd, twist} per bone plus a pelvis offset, then:
1. Stance base (Gaga ready stance: feet parallel hip width, knees soft, arms slightly off the ribs: from the A-pose that is upperarm abd about -25..-30 so the arms hang ~12-18 deg from the body, elbows 15-25, fingers lightly and unevenly curled, head level).
2. Shape layer: library of target postures with per-region masks; each active quality biases which shapes are chosen and how far; intensity scales the blend toward the shape.
3. Drift band (0.05-0.3 Hz noise) and weight shifts.
4. Small-gesture band (2-5 Hz noise, distal joints). Base level always on; Lunas, Shake, Silly, Boil raise it; Thick and Plenty of time lower it.
5. Quality generators (below), each with a region mask and its own state.
6. Modifiers transform the mix: time scale, damping, band gains, posture bias.
7. Per-joint springs (critically damped by default; looseness from Boil, Flesh, Shake makes them underdamped) to smooth targets and create follow-through.
8. Clamp to `limits` via `jointQuat`, write `bone.quaternion`; pelvis bone position = rest local + offset.
9. Legs: two-bone IK to planted foot targets (knee pole forward with slight turn-out), foot flat or heel-peeled per foot events, toes extend in releve. Pelvis horizontal offset kept inside the support polygon; if a shape wants more, trigger a re-plant step (lift, arc, plant over ~0.35-0.5 s).
10. Self-collision pass: capsules for torso, pelvis, thighs, head; push the arm out (upperarm abd/flex) when a forearm or hand capsule penetrates.

## Quality specs (engineering translation; numbers are starting points)
Tier 1:
- **float** (generator, whole): drift band dominant, upward bias. Arms buoyant, lifting slowly toward shoulder height and above at high intensity, as if held by water; elbows 20-60, wrists trailing; spine micro-sway 2-4 deg per segment; weight shifts; slow (0.05-0.15 Hz). Light, indirect, sustained. Shapes: arms floating up, open V, slow reaches. Also the 15% idle floor.
- **lunas** (generator, extremities): hands come alive: finger MCP joints press and release in irregular sequences (as if the pads touch a surface), spread varies, wrists articulate; palms often turn down/out. Feet: weight rolls over the balls of the feet, heels peel 2-5 cm alternately, toes press (toes flex), occasionally rise to releve. Raises the small-gesture band on hands and feet. Glow: the luna_* and football_* landmarks.
- **biba** (modifier, pelvis/spine): spine lengthens: removes forward flexion and slump, slight extension through the lumbar, chest lifts, neck long, pelvis heavy (pelvis drops 1-2 cm with knees softening while the crown rises). Reduces downward shape bias. Slow, small, sustained. Glow: sitbone_L/R, sacrum.
- **lena** (generator, center): the pelvis is the prime mover: smooth 3D pelvis paths (circles, figure eights, tilts and translations within the support polygon) with the spine following segment by segment (0.06-0.1 s per segment), arms following passively with more lag. Mid to large. Knees adapt via IK. Glow: lena.
- **snake** (generator, spine): traveling waves along pelvis..head (10 segments), lateral and sagittal, sometimes with twist; period 2-5 s; 0.08-0.15 s delay per segment; 4-8 deg per segment at full intensity; direction reverses now and then (head to tail). Arms passive with lag. Seaweed quality: soft, free flow. Glow: moving points on the spine at the wave crest.
- **flesh** (modifier, flesh): raises `getFleshParams` gain a lot, lowers stiffness; slightly steadies bone motion (the skeleton feels like a stable core with flesh lagging on it).
- **balls** (generator, whole): impulses that travel along paths (hand -> forearm -> upperarm -> clavicle -> spine06 -> other clavicle -> other arm; head -> spine -> pelvis -> thigh -> shin -> foot; pelvis -> spine -> head). Each joint gets a local bump (rotation pulse) as the ball passes; speed 0.5-2 s per path; size varies (amplitude), new ball every 1-3 s. Glow: the ball itself as a moving point (this is the best use of the sensation map).
- **curves** (generator, whole): several joints draw circles at once (two axes in quadrature): shoulders (clavicle), pelvis, head, wrists, ribcage (spine04-06); different radii, directions and rates (0.2-0.6 Hz) per joint, slowly changing which joints are active.
- **shake** (generator, flesh/whole): chosen shaking that starts at a point in the torso and spreads: maintain `spread` 0..1 that grows over ~20-40 s since activation (or faster at high intensity); frequency 3-6 Hz with jitter, amplitude small; knees pump vertically (pelvis bob 1-2 cm), shoulders and arms loose, flesh gain high. Footage: many posture variants at once (upright patting, folded and hanging, on toes with an arm up, arms out): pick a posture bias per performer. Glow: point in torso expanding.
- **quake** (generator, whole): involuntary, irregular tremor from the floor: random impulses (2-10 Hz mixed) entering at the feet and passing up through knees, pelvis, spine with spring lag; less control than shake, spatially indirect. Glow: feet, then up.
- **boil** (generator, whole): Poisson-timed bubbles (3-8 per second) at random joints push loose limbs and spine; underdamped springs (spaghetti); mid to fast; everything loose.
- **thick** (modifier, texture): time scale ~0.45 for generators and drift, joint springs heavier (more lag, less overshoot), small-gesture band down, posture more compact (elbows more bent, fingers curl toward fists), flesh firmer. Footage: steadiest output, about 22% more motion than small gestures alone (the body still works hard; it moves slower and with effort).
- **time** (modifier): slows the large-motion bands (shape, drift, lena, snake) without slowing small fast bands (shake, gestures); accents become unhurried (longer decay). "Slow travel with quick action inside".
- **groove** (generator, pelvis): personal rhythmic pulse 1.6-2.1 Hz per performer: pelvis bob 1-3 cm via knees, pelvis sway and rolls, shoulders and head echo with small offsets, occasional syncopation; expose the tempo in `getActivity().tempo` so music can follow.
- **silly** (modifier + generator): breaks symmetry: random quirky events every 1-3 s (shoulder giggle bursts at 3-4 Hz, head bobs, hip rolls, knock-knee moments, wiggly hands, a lopsided reach). Playful, never mechanical.
- **explosive** (accent): as a layer, small explosions every 1.5-4 s; `accent()` fires one now. A burst is a sharp extension or punch in a random direction from a preferred limb or the whole body (arm thrust, low kick, torso snap), reaching peak within 0.15-0.25 s with stiff springs, then decaying softly over 0.5-1 s back to delicate small motion. No wind-up. Footage: "kick" then "soft", ~69% more motion than small gestures.
Tier 2:
- **collapse**: a region (chest, pelvis, knees) drops suddenly for ~0.2-0.4 s, then is carried up again over 1 s; staggered; never a stop.
- **melt**: slow lowering over 6-12 s (knees bend deeper, spine flexes, arms descend, flesh gain up), then the bones float back up; repeats; never dead.
- **tashi**: feet strictly planted and flat; movement waves from ankles through knees and pelvis.
- **ashi**: weight rolls to the outer edges of the feet (foot abd/inversion), knees swing, pelvis follows.
- **grab**: tension phases (muscles grip: compact posture, stiff springs, fists) 1-2 s, then release (springs loose, an arm flies out), repeating irregularly.
- **forces**: a distal point (wrist, knee, crown) is pulled by an invisible thread or balloon along a slow path; the rest of the body trails with lag.
- **dolfi**: softer, lower stance, quiet motion, with occasional tiny preparatory twitches that could become any direction.
- **hotfloor**: quick light alternating foot lifts (0.15-0.3 s each), heels and toes barely touching.
- **countdown** (accent): ~11 s escalating vigorous motion (big arm swings, body slaps implied by hands hitting thighs and chest, jumps optional as small bounces), then an abrupt drop into float.

## Outputs
- `getActivity`: region levels from layer region masks times values, blended with measured angular speed per region; `energy` from overall angular speed; `dominant` = the most recently added strong layer (value > 0.3), else the strongest.
- `getGlowPoints`: up to 8 points from active layers using `LANDMARKS` (bone + offset), with moving points for snake and balls.
- `getFleshParams`: base subtle; flesh, shake, quake, boil raise gain; thick lowers it.
