# Gaga movement observations (footage analysis)

Analyst notes for the procedural motion engine. Every observation carries a tag:
- **[seen]**: visible in extracted frames (contact sheets listed at the end).
- **[inferred]**: from captions, spoken cues or text, with no matching frames.

Angles are eyeballed from 360 to 480 px frames and are approximate (plus or minus 15 deg). Joint names follow `src/skeleton.js` (flex / abd / twist).

## 0. The footage problem (read first)

Gaga forbids observers, mirrors and class recording, so public footage is mostly 20 to 90 s promos. These are montage-cut (shots of 1 to 2 s) and often slowed down. Only one public source is a continuous, captioned class: Saar Harari's 9:41 "Gaga/break". Most timing numbers below come from it. The 26:46 "Gaga/people Online Class with Rachael Osborne" (youtube.com/watch?v=5H8beZLmY7A) appears in search but returns "This video is not available", so I could not watch it.

**Consequence:** floating, Lena, Biba, Luna (by name), boiling, noodles/spaghetti, snakes, seaweed, "the ball", silly and heaviness never appear on camera with their cue. Section 3 lists them with no kinematic spec.

## 1. Sources watched

| # | URL | Title | Segment used |
|---|---|---|---|
| A | youtube.com/watch?v=4UGm5estbK4 | Gaga/break with Saar Harari, Artistic Director (Gaga Movement Language, 9:41) | Whole video, 480x852 portrait, static phone camera. One dancer (the teacher) dances non-stop while cueing. Captions aligned to frames. 9 motion sheets plus a motion-energy measurement. |
| B | youtube.com/watch?v=CBTWp-6PgFQ | Gaga with Ohad Naharin (0:42) | 0:26 to 0:33, where Ohad says "All right. Let's shake." Sheets at 6 and 15 fps. Montage cut. |
| C | youtube.com/watch?v=AWCy4-lG6e8 | Gaga training excerpt, Batsheva Ensemble (0:21) | Whole clip at 1 fps. Gaga/dancers class, about 12 dancers, wide shots. |
| D | youtube.com/watch?v=OGPG1QL1vJc | Ohad Naharin discusses Gaga movement (Dance Consortium, 2:09) | 0:06 to 0:48 "Gaga class" wide shots. Ohad's audio: "we work without mirrors, mirrors are forbidden". |
| E | youtube.com/watch?v=gRky99sO-og | The Guardian: Batsheva Dance Company, "It's about making the body listen" (5:00) | 0:00 to 0:24 floor work; 1:48 to 2:36 studio. Audio on delicacy, "dead flesh", effort and pleasure. |
| F | youtube.com/watch?v=WCEx1UzL-i0 | GagaLabs Summer 2026 (1:24) | 0:30 to 0:54. Teacher: "nice collapse, hold ... I'm going down but I feel like I'm being carried up ... how you carry your flesh". Repertory teaching, Gaga vocabulary. |
| G | youtube.com/watch?v=tSmfmMn1fBc | GAGA at the HANGAR, Batsheva fundraiser (0:45) | 0:07 to 0:19. Ohad on a platform inside a crowd of about 1,000. |
| H | youtube.com/watch?v=ZzXhcNFXwYM | Gaga training and groove at Batsheva Ensemble (2:44) | Overview frames, plus captions: "there are no stops", "the molecular level". |
| I | youtube.com/watch?v=3_ZB-_tcWdk | Mr. Gaga deleted scene, Ohad explains the groove (2:43) | Captions plus overview: groove sits slightly after the beat. |
| J | youtube.com/watch?v=bje66VbeJGM | BAM: Ohad Naharin on the language of gaga (2:42) | Captions on "multi-layer tasks" and being "available to explode". |
| K | 18 promo clips on the official Gaga Movement Language YouTube channel (IDs listed in `scratchpad/footage/ov/`), plus Hangar 2016 (Dce_psMxlFw), Malta workshop (vCa6zrYoT-M) and vimeo.com/1073486329 | 12 to 18 frames each | Studio look, staging, clothing, ages and individuality only. These clips are slowed and cut, so I did not measure tempo from them. |

Excluded: sPQGdksokMQ ("Gaga Dance Meditation"). Its teacher has no Gaga affiliation, and its routine does not match the official Gaga footage.

## 2. Spec blocks for the qualities I could see

### 2.1 Small gestures / small dancing (the base layer)
- **Cue** [seen + captions], A 0:13 to 1:27: "bringing a lot of small movement gestures to your shoulders, to your head, to the inside of your hands, to your knees, to your tail ... to keep soft in your flesh ... to bring movement to all your joints ... to connect to your groove". At 0:57: "small movement to your spine from the front and the back, from the sides ... move the shoulder blades too". At 1:14: "movement with your toes ... lift them, push them to the floor".
- **Initiation** [seen]: distributed, with no single source. Hands and fingers are the busiest. Then shoulders (shrug and roll), then knees (weight shifting).
- **Joint map** [seen], sheet s01 (4 fps):
  - spine01..06: lateral and twist about plus or minus 5 to 10 deg
  - neck/head: tilt and turn plus or minus 10 deg
  - clavicle: elevation and protraction 2 to 3 cm
  - forearm: elbow held at 60 to 110 deg flex, wobbling plus or minus 15 deg
  - hand: wrist plus or minus 20 to 30 deg
  - fingers: curl and spread across their full range, fast and independently of each other
  - thigh/shin: knees 5 to 25 deg flex, alternating
  - foot: the unweighted heel rises 3 to 5 cm. Every 2 to 3 s one foot leaves the floor (knee 40 to 60 deg).
- **Tempo** [seen + measured]: a new micro-position every frame at 0.25 s spacing, so the content sits around 2 to 5 Hz. Motion-energy autocorrelation shows no dominant period: max ACF 0.15 between 0.25 and 2 s. It is aperiodic.
- **Amplitude** [seen]: small. The dancer stays inside a 30 cm circle.
- **Weight** [seen]: upright. The center of mass drops about 2 to 4 cm through soft knees. Weight shifts foot to foot about every 1 to 2 s.
- **Feet** [seen]: planted, with heel peels and occasional lifts.
- **Head** [seen]: follows the spine with small extra tilts. Gaze is soft, often down at the hands. Eyes open.
- **Noise character**: high-frequency jitter on distal joints, over a low-frequency weight drift. Use 2 noise bands: about 0.3 Hz for pelvis and weight, about 3 Hz for fingers, wrists and elbows.
- **Engine suggestion**: generator. It is also the floor that most other cues sit on (section 4).

### 2.2 Curves and circles
- **Cue** [seen + captions], A 1:28 to 1:56: "add a bit of curves and circles for the small gestures ... describe curves with your edges, with your skin". At 2:05: "bigger curves with your hands, shoulders, hips, knees".
- **Joint map** [seen], sheet s02 (2 fps):
  - upperarm: flex to 150 to 170 deg (overhead), crossing the midline
  - spine: lateral 15 to 30 deg, twist plus or minus 30 deg
  - thigh: knee lifts to 60 to 90 deg hip flex
  - shin: deep bends to about 60 deg
  - foot: brief relevé, heels up 5 to 8 cm
- **Tempo** [seen]: one arc takes about 1 to 2 s, continuous with no holds. Motion energy is 22% above small gestures (weak ACF peak at 1.6 s).
- **Amplitude and travel** [seen]: medium to large. Small steps keep the dancer within about 1 m.
- **Asymmetry** [seen]: the arms almost never mirror. One goes up while the other bends at the head or hangs.
- **Noise character**: smooth low-frequency arcs (0.5 to 1 Hz), with the 2.1 jitter still visible in the hands.

### 2.3 Held shape with small gestures inside (reach, fold, side)
- **Cue** [seen + captions], A 2:10 to 3:06: "take the hands up and use the small gestures and the curves to move in this position" ... "go down, try to touch the floor and go up" ... "go to the side ... keep the small gestures" ... "rolling up".
- **Joint map** [seen], sheet s03 (0.5 fps):
  - hands up: upperarm flex about 160 deg, abd 20 to 30 deg (wide V); fingers spread; knees almost straight; feet hip-width and parallel. The pose holds for about 10 s.
  - fold: hip flex 100 to 120 deg, knee flex 60 to 90 deg, hands at the floor, head hanging. It lasts about 4 s, then rolls up over 3 to 4 s, spine segment by segment from the bottom up.
  - side bend: lateral spine flexion 30 to 40 deg, top arm overhead, the other arm hanging. Holds about 8 s per side.
- **Key observation** [seen]: the large shape changes every 8 to 12 s. Inside it, hands, knees and chest keep moving at the small-gesture rate. This "slow carrier pose plus fast micro-noise" pattern is the most consistent texture in the footage.
- **Engine suggestion**: pose targets with long blends (1.5 to 3 s) under an always-on noise layer.

### 2.4 Walking and running with spine, tail and ribs
- **Cue** [seen + captions], A 3:07 to 6:23: "move the tailbone as we walk and touch the ribs ... move the ribs away from the [pelvis] ... feel the tail can go inside, outside, the sides" (3:25 to 3:52). "Slide [the shoulders] forward and backwards" (3:59). "Find the easy run ... forward and backwards" (4:36). "Allow the spine to move forward when you run ... we don't have a broomstick, we have a spine" (5:37). "Look behind you" (5:33).
- **Walk** [seen], sheet s04 (2 fps):
  - hands rest on the ribs and iliac crests, elbows out
  - torso upright, ribcage shifting sideways about 3 to 5 cm against the pelvis
  - pelvis tilting fore and aft
  - about 2 steps per second
  - travels 3 to 4 m forward and back
- **Run** [seen], sheet s05 (4 fps):
  - small jog steps; forearms near the chest with loose, fluttering hands
  - torso slightly forward
  - travels forward and back about 4 m
  - motion-energy period about 0.6 s (weak), which fits a stride of 2 steps
  - the look behind turns head plus thorax about 90 deg while the legs keep running
- **Engine suggestion**: the only quality here with a real oscillator (the gait). Everything layered on top stays aperiodic.

### 2.5 Delicacy / brushing the skin (Luna-adjacent)
- **Cue** [seen + captions], A 6:24 to 7:22: "get a bit delicate by brushing our skin ... the inside of your thighs, the outside of your thighs, between your fingers, between your toes, on the collar bones, between the shoulder blades" ... "let's move even slower" (6:51).
- **Luna** [inferred]: the cue covers the spaces between fingers and toes, which other sources call Luna, but the teacher never says the word.
- **Joint map** [seen], sheet s06 (1 fps):
  - surprisingly open and large
  - upperarm abd 80 to 100 deg (arms wide at shoulder height), fingers fully spread
  - legs sweep out with only the toe touching (thigh abd 30 to 45 deg)
  - wide lunges with knee flex 45 to 70 deg; spine twist plus or minus 30 deg
- **Tempo** [measured]: the lowest motion energy in the class, 11% below small gestures, and the smoothest (highest frame-to-frame correlation). No accents.
- **Noise character**: very low frequency (0.2 to 0.5 Hz), big amplitude, no jitter. Fingers stay spread and alive.

### 2.6 Texture: thicker / softer
- **Cue** [captions], A 7:23 to 7:41: "play a bit with our texture. Let's get thicker as we keep the small gestures, as we maintain the delicacy on our skin. Thicker ... and softer ... soft and slow energy spreading over the flesh".
- **Seen** (partly, sheet s07, 4 fps):
  - fists, compact arms with elbows bent 90 to 120 deg and held closer to the body, a knee lift
  - motion energy 22% above small gestures, with the most even output of any segment (coefficient of variation 0.43, lowest in the class)
  - on "softer" the hands open with spread fingers and the arms float up into a V
- **Not resolvable at this resolution** [inferred]: muscle tone. Proxy for animation: "thick" raises joint stiffness and damping and narrows the gap between amplitude peaks and the average. "Soft" lowers both and raises flesh follow-through (`setFlesh` gain).
- **Engine suggestion**: modifier, applied to every active generator.

### 2.7 Explosive accent, then soft ("kick ... and soft")
- **Cue** [seen + captions], A 7:42 to 7:52: "and kick ... and soft". Ohad (J): "teach about explosiveness, but even more about available to explode ... available to snap, and sometimes we never snap".
- **Joint map** [seen], sheet s07b (4 fps):
  - within one 0.25 s frame, a knee snaps to 80 to 90 deg hip flex, or a leg flicks sideways (thigh abd about 45 deg)
  - 2 frames later both arms pop overhead into fists
  - each accent returns into 0.5 to 1 s of soft continuation, with no freeze
- **Tempo** [measured]: the highest motion energy in the class, 69% above small gestures. Spikes are isolated, about 1 per 1 to 2 s.
- **Engine suggestion**: accent. Rise of 80 to 150 ms, overshoot, then a 0.6 to 1 s soft decay back into the running layers. Randomize which limb fires.

### 2.8 Shaking (quake)
- **Cue** [seen, montage], B 0:28: "All right. Let's shake. Hey!" Cut-to-cue alignment is approximate because the promo is edited.
- **Seen**, sheets s09 (6 fps) and s10 (15 fps). 4 bodies, 4 versions at once:
  - (a) Ohad: upright, knees bent about 30 deg, hands bouncing in front of the chest, torso jiggling
  - (b) a man folded forward 60 to 90 deg at the hips: arms dangling, head loose, the whole torso bouncing, with the head dropping about 10 cm in 0.13 s steps
  - (c) a woman up on the balls of her feet, one arm overhead, hair whipping, so the head is shaking
  - (d) a man with arms held out to the sides, shaking through them
- **Tempo** [seen]: direction reverses every 2 to 4 frames at 15 fps, so about 3 to 5 Hz. There is motion blur on hands and hair.
- **Amplitude** [seen]: about 2 to 5 cm at the trunk and 10 to 20 cm at the hands and hair. It stays in place.
- **Weight** [seen]: knees always bent, heels mostly down except in (c). Gravity pulls the hanging parts and the shake rides on it.
- **Noise character**: high-frequency jitter at 3 to 5 Hz, strongest in the free-hanging distal segments. Phase and posture are different for each person.

### 2.9 Groove (free dancing to music)
- **Cue** [seen + captions], A 7:52 to 9:08: "keep playing with your texture, with your skin, with your grooves", then music.
- **Seen**, sheet s08 (4 fps):
  - continuous bounce on the balls of the feet, heels never fully down
  - the knees pulse
  - arms held in a high V for 1 to 2 s, then swept out to horizontal; turning and stepping
  - travels 1 to 2 m
  - burstiest segment (coefficient of variation 0.86)
- **Timing** [inferred], I: "the tendency is to rush ... when you groovy, you almost have to slow down a little bit ... it's after the beat a little". Groove lags the beat slightly. A 30 to 80 ms phase lag behind the audio beat is my estimate for implementation, and the footage does not measure it.
- **Groove as personal** [inferred], H: "Groove is your own personal ... how you move, how you express". Every performer needs a different groove.

### 2.10 Collapse / yielding to gravity, carried up
- **Cue** [seen + captions], F 0:33 to 0:56: "one, two, three, nice collapse, hold ... I feel the texture changing, but I'm going down. I'm on the way down, but I feel like I'm being carried up ... separate the textures ... how you carry your flesh".
- **Seen**, sheet s15 (1 fps):
  - a large group drops from standing into squats, kneeling and sitting over about 1 to 3 s
  - the drop is staggered: at any instant some are still standing, some are halfway, some are down
  - then they hold low
- **Inferred**: "going down but carried up" describes a split. The pelvis and legs yield (center of mass drops fast), while sternum, head and arms stay buoyant and lag behind. That is a texture difference between body regions at the same moment.

### 2.11 Gaga/dancers intensity (professional class)
- **Seen**, C (sheet s12) and D (sheet s17):
  - much larger range than Gaga/people: deep pliés (knee 90 to 120 deg), relevé on one leg with the other in passé
  - back arches of 30 to 45 deg with the head thrown back
  - arms flung asymmetrically, low crouches with hands near the floor, off-balance tilts caught by a step
  - one dancer held a low crouch for at least 10 s while those around her flung and kicked
- Not tied to a specific cue (no class audio).

## 3. Qualities not verified on camera

| Quality | Status | What exists |
|---|---|---|
| Floating | Not seen with cue | A 2:10 to 2:24 (arms held up, small gestures inside) is the nearest visual. Text only: "imagine you are floating in liquid" (gagapeople.com, 30 Days of Gaga, day 6). Other sources say float does not ignore gravity. No spec. |
| Lena (center below navel) | Not seen | Text only (lena sits between navel and groin). No footage cue. |
| Biba (pelvis area) | Not seen by name | A 3:25 to 3:52 "move the tailbone ... tail can go inside, outside, the sides" is seen (pelvis tilt during the walk). It is unclear whether teachers would call this Biba. |
| Luna | Not seen by name | See 2.5: fingers and toes, brushing between them. |
| Flesh moving on bones | Inferred | A 0:33 "keep soft in your flesh"; F "how you carry your flesh"; E "dead flesh" is the opposite. Frames cannot show flesh at this resolution. |
| Boiling, noodles/spaghetti, snakes in the spine, seaweed, the ball, silly, heaviness, thick vs thin | Not seen | None of these words appear in any caption I could retrieve. "Thick" appears only as "thicker" (2.6). |
| Effort and pleasure | Spoken only | B 0:09, E 4:01. |
| Lying on the floor | Seen, no cue | E 0:10 to 0:24: supine with one leg lifted to vertical; seated leaning back on the hands. Promos B and K show dozens lying in star shapes. |

## 4. Layering and transitions

- **Cues stack** [seen + captions]. The teacher almost never cancels a layer. He adds one and says "keep" the old one:
  - "Keep the small gestures and the big curves" (2:27)
  - "Keep the small gestures under the feet and rolling up" (3:03)
  - "Keep looking for small gestures ... as we walk" (3:11)
  - "keeping the small gestures especially in our spine" while running (4:43)
  - "Let's get thicker as we keep the small gestures, as we maintain the delicacy on our skin" (7:25)
  - The small-gesture layer stays on for the whole 9 minutes.
- **Layers can sit in different body parts** [inferred], J: "ignite parts in your body in different textures while another part is doing something else". F: "separate the textures". This supports per-region layer masks with different stiffness at the same time.
- **Nothing stops** [seen + captions]: there are no pauses between cues in A, and H says "there are no stops". Even the stop-and-reach moment in A at 4:09 ("stop and send the shoulders all the way") keeps the chest moving.
- **Cue cadence** [measured from A captions]: about 35 cue changes between 0:13 and 8:10, a mean of about 14 s each (range 3 to 45 s). Big structural changes (walk, run, skin, texture) come every 60 to 110 s. Smaller "add this body part" cues come every 5 to 15 s. Use this for `CLASS_SCRIPTS`.
- **Transition shape** [seen]: a new cue is absorbed over 1 to 3 s. Amplitude grows while the old layer keeps going. The exception is the accent ("kick"), which lands in under 0.25 s and then hands back to "soft".
- **No-cue state** [seen]: between cues the body keeps a small-gesture idle and a weight shift. It never goes still.

## 5. Individuality

- **Same cue, different bodies** [seen]:
  - B shake: 4 people, 4 postures (upright patting, folded and hanging, on toes with an arm up, arms out to the side)
  - C and D: in every wide frame no 2 dancers share the same shape, facing or phase
  - F collapse: staggered over 1 to 3 s
  - G Hangar crowd: hundreds with arms at every height
- **Practical parameters**:
  - each performer gets its own noise seed
  - its own preferred limb for accents
  - its own posture bias for the same cue (folded vs upright vs high)
  - its own tempo offset (plus or minus 20%)
  - its own facing; dancers do not face a front
  - phase offsets of 0.5 to 3 s between performers on cue onset
- **Unison** [seen]: none observed in any Gaga class footage. Repertory teaching (F, before the collapse) is the only case where people face the teacher together.

## 6. Class staging and studio look

- **Mirrors** [seen + captions]: none visible in any Batsheva or Gaga class shot. "Mirrors are forbidden" (D 0:44). James Graham in 6ZXfG3Y3ZpY: "we never allow a mirror ... we don't let observers come in".
- **Studios** [seen]:
  - Batsheva Ensemble (C, D, H): white walls, a high band of windows, pale grey marley floor, benches and folding chairs along the walls, even daylight
  - Batsheva main studio (E): dark grey floor, black side curtains, tall windows
  - Gaga/people Tel Aviv (B): white walls, columns, big windows, light wood floor
  - GagaLab NYC (F and promos): a large hall with arched windows and a wood floor
  - Saar's online class (A): steel-framed floor-to-ceiling windows. The backlight puts him near silhouette, close to our charcoal-figure look.
- **Spacing and facing** [seen]:
  - studio classes have 10 to 15 dancers spaced 1.5 to 3 m apart, facing every direction (C, D)
  - mass events: about 0.7 to 1 m apart, with the teacher on a raised platform draped in cloth in the middle of the crowd (G)
- **Teacher position** [seen]: Ohad stands among participants and dances while talking (B), or speaks into a microphone from a platform (G, SL4BR4Cx9zQ). Saar dances the entire class himself. Teachers never stop to watch.
- **Clothing** [seen]: T-shirts, tank tops, leggings, sweatpants and shorts. Mostly barefoot; some Gaga/dancers in socks. No uniforms, no dance shoes.
- **Bodies and ages** [seen]:
  - Gaga/people (B, G, K): roughly 20 to 75 years old, all body types, including a white-haired man in the online promo, older women at the Hangar and Ohad himself in his 70s
  - Gaga/dancers (C, D, F): professionals aged 18 to 35, lean

## 7. Motion-energy numbers (source A, measured)

Mean absolute frame difference: 48x86 grayscale, 25 fps, after removing duplicated frames. The camera is static, but the dancer's distance from it varies, so treat these as relative.

| Segment | Energy vs small gestures | Coefficient of variation | Periodicity |
|---|---|---|---|
| Small gestures | 1.00 | 0.48 | none |
| Curves and circles | 1.22 | 0.51 | none (weak 1.6 s) |
| Walk with tail and ribs | 1.14 | 0.46 | none |
| Easy run | 1.05 | 0.87 | weak 0.6 s (stride) |
| Brush skin, slower | 0.89 | 0.58 | none, smoothest |
| Thicker | 1.22 | 0.43 | none |
| Kick then soft | 1.69 | 0.64 | none, spikes |
| Free groove with music | 1.37 | 0.86 | none |

Every non-gait segment is aperiodic: max autocorrelation is 0.21 or less for lags of 0.25 to 2 s. Drive motion from layered noise and traveling waves, and keep sine oscillators for gait and bounce only.

## 8. Most informative contact sheets

All files are in `/private/tmp/claude-501/-Users-nahrahellouis-context/72ad8a94-9786-498b-b855-535c56519111/scratchpad/footage/sheets/`:

1. `s01_small_gestures_break_0020_4fps.jpg`: base layer, 0.25 s per frame
2. `s03_reach_fold_side_break_0210_0p5fps.jpg`: held shapes with micro-motion inside
3. `s06_brush_skin_slow_break_0640_1fps.jpg`: delicacy is slow, but the shapes are wide
4. `s07b_kick_then_soft_break_0742_4fps.jpg`: accent timing
5. `s10_shake_detail_CBTW_0030_15fps.jpg`: shake frequency and 4 interpretations
6. `s12_ensemble_training_AWCy_0000_1fps.jpg`: Gaga/dancers range and individuality
7. `s17_batsheva_gaga_class_wide_OGPG_0006_2fps.jpg`: spacing, facing, simultaneous differences
8. `s15_collapse_carried_gagalab_WCEx_0030_1fps.jpg`: staggered group collapse
9. `s16_hangar_teacher_platform_tSmf_0007_1fps.jpg`: mass staging, teacher on a platform
10. `s08_free_groove_music_break_0820_4fps.jpg`: groove bounce on the balls of the feet

The other 8 sheets (s02, s04, s05, s07, s09, s11, s13, s14) are in the same folder. Overview sheets for every clip are in `../ov/`, and caption transcripts are in `../subs/*.txt`.
