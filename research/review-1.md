# Gaga World: independent review 1

Reviewer notes from a cold pass on 2026-10-29. Desktop 1440x900 and phone 400x860, headless Chromium (Metal). Screenshots are in `/Users/nahrahellouis/context/gaga-world/dev/shots/` (all prefixed `review-`). Motion numbers come from a deterministic harness that pauses the app, steps the engine at 30 Hz and samples bone positions (24 s per word at 0.7 intensity, after 10 s warm-up). Idle baseline: mean speed 0.065 m/s, hands mostly hanging.

Not tested: audio, frame rate, touch gestures on a real phone, the Walk camera beyond one frame, long-session behavior. Known issues the team is already fixing (parallel forward arms, deep knees, hands near the face) are not ranked below, except where they change a verdict.

## Ranked problems

### 1. On phones the Study path and the Angle picker hide the dancer completely

**Saw.** On 400x860, "Study one word" opens a bottom sheet that covers about 82% of the screen. The remaining top strip shows an empty grey wall, because the camera frames the dancer at screen center, which is under the sheet. Tapping "Show me" changes the camera and speed but leaves the sheet up, so the demonstration cannot be seen. The Angle sheet (about 430 px tall) leaves only the dancer's head visible. In the explore stack the dancer's feet sit under the word strip and study bar, and the first-run tour card covers the legs.
**Shots.** `review-34-phone-sheet.png` (stack, card, angles), `review-39-phone-sheet2.png` (class, study, show me, about), `review-36-phone-study.png`, `review-37-phone-showme.png`.
**Why it matters.** The core promise ("watch one dancer take words on") fails on the device most first-time visitors use. The recommended third path on the entry screen is the broken one.
**Fix.** (a) Offset the camera's look-at and framing by the visible stage rectangle on narrow screens (dancer centered in the area above the sheet and below the top bar, feet above the strip). (b) Give sheets a peek state at about 40% height with drag to expand, and collapse to peek when "Show me" or an angle is chosen. (c) Make the Angle picker a single horizontal chip row above the study bar on phones, not a sheet. (d) Move the tour card to the top on phones.

### 2. Float raises the arms overhead, contradicts its own card, and then dominates every class frame

**Saw.** Float alone has hands at mean 0.67 m above the pelvis (shoulder height or higher) and up to 1.01 m (fully overhead). The card says "the arms lift a little off the ribs" and research (vocabulary.md 2b) specifies small, very slow, arms lifted slightly off the ribs. Because the class keeps Float at 0.7 for most of its length, the quake frame, the countdown frame and the stack frames all show a "hands up" V. Curves and Groove do the same (mean 0.64 and 0.58).
**Shots.** `review-41-class-shake.png` (Quake cue, arms straight up like a surrender), `review-42-class-countdown.png`, `review-16-tile-side-back-over-front.png` (back and front tiles), `review-47-trails-curves-groove.png`.
**Why it matters.** It is the most visible mismatch between guidance and simulation, it makes unrelated words look the same, and it reads as a worship or surrender gesture on a first impression.
**Fix.** Cap Float's arm elevation at roughly 25 to 35 degrees of abduction with ribs-clear elbows, keep wrists soft, and let the occasional overhead drift be a rare, slow event. Where Float stacks under another generator, scale Float's arm contribution by (1 - other generators' arm activity) so it is a carrier and not a pose. Keep Float's whole-body buoyancy (micro sway, weight shifts).

### 3. Many words look identical to idle or to each other, so "Watch for" often cannot be seen

**Saw.** Mean speed of tracked points (m/s): idle 0.065. Tashi 0.041, Thick 0.043, Flesh 0.051, Time 0.055, Biba 0.068, Dolfi 0.074 (all at or below idle). Tashi is a generator, yet quieter than doing nothing. In a 12-word contact sheet at the same camera, Biba, Tashi, Dolfi, Time, Flesh, Ashi, Hot floor and Lunas all show an upright stance with loose arms and bent elbows. Mean-pose distances between Snake, Hot floor, Ashi, Tashi and Silly are 0.09 to 0.15 (units of summed meters, small). By contrast Shake (0.51), Groove (0.39), Quake (0.34), Boil (0.33) and Grab (0.31) are clearly energetic. Countdown ("everything you have") is only 0.21, milder than Groove, with no body slaps (research 2b "Countdown burst").
**Shots.** `review-24-subtle-words.png`, `review-22-study-lena.png`, `review-23-study-lena-showme.png`.
**Why it matters.** The product teaches by "watch for" bullets. The card for Biba says "the top of the head rises while the pelvis gets heavier", Tashi says "waves rise through ankles, knees and pelvis". At normal viewing these are invisible, which weakens the paid-product claim.
**Fix.** Each word needs a signature a viewer can name in 5 seconds at 1x. Lower-energy words are legitimate (Biba, Thick, Time are small and slow in research), so make them legible by contrast: let the "Show me" preset exaggerate amplitude by about 1.5x and add a one-line "what changed" caption. For Tashi and Ashi, raise ankle and knee amplitude and add a visible foot-planted indicator in the Feet view. Give Countdown escalating amplitude and visible hand slaps on thighs and chest, then an abrupt drop. Add a "compare with idle" toggle on the card (2 seconds idle, then the word).

### 4. The sensation map is nearly invisible, and one word card tells the learner to use it

**Saw.** With Map on, Lena in the Side view produced a maximum block luminance change of 4.6 (out of 255) versus map off, which is no visible change. The engine does emit glow points (for example spine04, radius 0.07 m, intensity 0.65 for Traveling balls) but the surface only lifts by about 30 luma in one small block on the chest, which reads as lighting. The Snake glow in the Back view appears as a washed, overexposed head, which looks like a render fault, not a sensation. The Traveling balls card says "Turn on the sensation map to see where the ball is."
**Shots.** `review-22-study-lena.png` (Map button pressed, no glow), `review-27-map-on-balls.png`, `review-27b-map-crop.png` (3x crop), `review-28-map-snake-on.png`, `review-25-balls-showme.png`.
**Why it matters.** A control with a visible "on" state that produces no visible result erodes trust in every other control. It is one of the three headline study tools.
**Fix.** Raise glow radius to 0.12 to 0.18 m, add a screen-space additive halo or rim outline pass in the post pipeline so it survives dark skin and bright rooms, and place Lena and Biba glow points on the surface of the pelvis, not at the bone center (the belly point sits inside the body, so the skin barely lights). Use a color that contrasts with charcoal (warm white with a thin bloom). Add a small legend under the Map button ("light = where the word is felt").

### 5. Nude anatomical figure, close angles that frame the groin and glutes, and hands that settle on the groin

**Saw.** The figure has a navel, glutes and genital contour. The Pelvis angle is a torso and hip close-up with the head cropped, the Director shot frames the back and glutes for several seconds, and Spine frames the glutes in the lower third. In at least 5 of 12 contact-sheet frames a hand rests at or over the groin (Tashi, Thick, Biba, Hot floor, Lunas). In Join, the soloist has a hand on the groin in the first frame.
**Shots.** `review-11-pelvis.png`, `review-19-director.png`, `review-19b-director.png`, `review-10-spine.png`, `review-21-join-via-ui.png`, `review-24-subtle-words.png`.
**Why it matters.** Schools, studios and workplace buyers are a likely paying audience. This also contradicts the research note that classes wear loose clothing (vocabulary.md section 5, "Dance clothing"). It is a liability in screenshots, store listings and screen-sharing.
**Fix.** Add loose shorts and a simple sleeveless top or a one-piece unitard in the same charcoal, with a slightly different roughness so the silhouette reads. Remove the navel and glute detail from the mesh. Add a hand-to-groin avoidance constraint to the arm solver (hand targets within 12 cm of the pelvis front are pushed outward). Exclude the pelvis front from Director shot candidates.

### 6. Join mode shows no "you", frames the soloist badly, and its main interaction is undiscoverable

**Saw.** Projecting the participant's bones through the Join camera puts the head and both hands behind or far outside the view (z over 1.5 in normalized depth, hands at screen x of -5.1 and -1.2). So the first-person body never appears. The soloist sits against the left edge in one frame, cropped at the knees and partly under the "Now in the body" panel, with the rest of the screen empty curtain. The cursor controls the participant's hands as a thread, but no hint says so; the only toast is "You joined the class. Gaga classes have no observers."
**Shots.** `review-18-join.png`, `review-21-join-via-ui.png`.
**Why it matters.** Join is the answer to the "no observers" principle and the most distinctive feature for a learner. As shipped it looks like a worse Orbit with no feedback.
**Fix.** Show the participant's forearms and hands at the lower edge of the frame (lower the camera pitch about 12 degrees and widen the field of view slightly, or render the hands in a first-person overlay layer). Aim the camera so the soloist is in the right two thirds, clear of the left panel. On entering Join, show a persistent hint ("Move your cursor: a thread lifts your hands") that fades after the first move, and ghost a soft ring at the cursor. Show the participant's differing interpretation with a small side-by-side tag ("Your body answers the same cue differently").

### 7. Several study cameras are framed badly or show nothing useful

**Saw.**
- Spine (from behind): a near-black silhouette against a mid-grey wall; the spine wave that the word teaches is not readable. `review-10-spine.png`
- Pelvis: head cropped at the top, legs cut at mid-thigh, and visible streaky banding on the abdomen and thigh. `review-11-pelvis.png`
- Hands: the camera sits so close that the head and shoulder fill the frame and the hand overlaps the face; the palm and finger bases (the point of Lunas) are not shown. `review-08-hands.png`
- Director: a tight, soft-focus crop of the back and glutes at 6 s, then a close crop with the head clipped and an arm clipped at 12 s. `review-19-director.png`, `review-19b-director.png`
- Side, Front, Three quarter: the feet disappear under the bottom bar at 1440x900. `review-16-tile-side-back-over-front.png`, `review-26-curves-trails.png`, `review-25-balls-showme.png`
- Feet: well framed, but the floor behind shows blocky dithering. `review-09-feet.png`
**Why it matters.** Angles are one of the app's three headline tools, and 4 of 9 give a poor image on first use.
**Fix.** Spine: add a rim light and an optional thin spine ridge line (auto on in this view). Pelvis: dolly back 30% so head-to-knee shows, and fix the shading. Hands: aim at the palm side with the face out of frame and a 60 cm standoff; offset right of center. Director: minimum shot distance (never closer than torso plus margin), no pelvis-rear shots, forbid cropping of head and hands. All angles: subtract the bottom bar height (about 90 px) from the frame so feet rest above it.

### 8. The illustration-versus-instruction message is buried, and some copy overstates

**Saw.**
- The disclosure ("The dancer is an illustration... has not been reviewed by a certified Gaga teacher... no single correct shape") lives at the very bottom of each word card in small grey type, below the fold on desktop and phone. It is absent from the entry screen, the tour and the class view. `review-07-card-bottom.png`
- CTAs say "Take the first class" and "Take a class", and Join says "You join the class as a dancer", which presents the animation as a class even though the About sheet says to find a certified teacher.
- "Source strength: A. From Gaga or Ohad Naharin's own words." sits beside the animation without saying it grades the term, not the animation. A reader can read it as "this movement is verified".
- Float's meaning says "Each new layer starts from float"; research says teachers only occasionally return to float to reset (Q16) and open nearly every class with it.
- Shake says the shake "spreads over about half a minute"; research says it can build over minutes (H15, DGb).
- "Each body finds its own answer" and "no single correct shape" are accurate, but the app never states the research's counterweight: tasks are specific, terms are standardized and copying the teacher (kagami) is accepted. Without it the product can read as anything-goes freestyle (vocabulary.md section 5).
**Why it matters.** The owner's bar includes honest teaching. The check is whether a learner could believe the app assesses them or shows a correct form. No screen asks the learner to match a pose, and nothing scores them, which is good. The risk is the opposite: a reader may think the animation is an authoritative demonstration.
**Fix.** Add a persistent one-line badge on the stage when a card is open or Show me runs: "Illustration, one interpretation. Not reviewed by a Gaga teacher." Rename the CTAs "Watch the first class" and "Watch a class". Relabel "Source strength" to "Confidence in this meaning" with the sub-line "How well sources agree on the word. Not a rating of the animation." Replace the Float and Shake wording with the research phrasing. Add one line to About: "Tasks are specific and you can copy the teacher. Your answer is yours."

### 9. Popovers cover the dancer at the moment you need to see them

**Saw.** The Angle menu is about 430 px tall and covers the center of the stage where the dancer stands, so the dancer is hidden while you pick the angle. The hover preview for a word (for example Lena) extends about 280 px left over the stage and covered the dancer's head and raised hand in one frame.
**Shots.** `review-20-views-pop.png`, `review-26-curves-trails.png`.
**Why it matters.** Both appear in the middle of the core loop (choose a word, choose an angle, watch).
**Fix.** Anchor the Angle menu as a compact 3x3 grid with thumbnails above the study bar and limit height to about 200 px. Place hover previews inside the word rail column (above or below the item) and never over the stage center. Delay hover preview by 400 ms.

### 10. First 30 seconds: the landing dancer is idle, the phone hero is ghosted, and the word list hides the starting word

**Saw.**
- The entry dancer stands in an A-pose with almost no motion, in light grey on a light room, so the hero does not demonstrate movement. `review-01-entry.png`
- On phone the dancer is a faint silhouette behind the text. `review-02-entry-phone.png`
- The word list is sorted by body region, so Float (key 1, where every class starts) sits at the bottom of the desktop list and at the far right of the phone strip, which starts with Lena, Biba, Groove. The number rings (4, 3, 5, 2...) are shown without explanation; they are keyboard keys, mentioned only in the hover preview and the Shortcuts sheet. `review-03-explore-begin.png`, `review-30-phone-explore-tour.png`
- The tour step ("Add a word") works but does not point at Float.
**Fix.** Run Float at 0.4 on the entry screen with the camera at three quarter so the hero dances. On phone, place the hero in the top 45% and the text below it. In Explore, pin Float first with a "Start here" tag, order the rest by class order within region groups, and show the key hints only after the first keyboard use or as a small "keys 1 to 9" line in the rail header.

### 11. The first class silently drops words, which contradicts "keep" cues and the stacking idea

**Saw.** At 2:40 the teacher says "Back to float. Keep the snake, keep the flesh." and at 3:00 releases the snake without saying so while the cue introduces Traveling balls. The step at 1:24 releases Lunas without mention. At 7:32 Explosive and Groove vanish under a single cue. The "Now in the body" list shrinks without explanation. The class peaks at 5 layers around 2:20 for about 20 s, then returns to 3.
**Shots.** `review-40-class-stack5.png`, `review-42-class-countdown.png`.
**Why it matters.** Stacking is the central teaching idea ("instructions layer, never replace", research section 1). The script shows replacing.
**Fix.** In `CLASS_SCRIPTS` ("first"), say the release in the cue ("Let go of the snake") or keep it. Aim for a visible 4 to 5 word stack for at least 60 seconds in the middle of the class. Add a short fade-out label in the "Now in the body" panel ("released by the teacher").

### 12. Business risk: the product name and the use of "Gaga" (resolve before charging)

**Saw.** The product is called "Gaga World" and uses Gaga's terms and Naharin's name throughout. Research section 5 ("Naming and licensing") records that teaching is limited to certified teachers and that a 2015 intensive waiver barred "Gaga-inspired" classes (Q16). The About sheet states the study is independent, which helps.
**Why it matters.** It does not show on screen as a defect, but it can end a paid launch.
**Fix.** Get written guidance from Gaga's licensing contact. Until then, brand as "A study of the Gaga vocabulary" with a neutral product name, keep the independent-study line on the entry screen (it is only in About now), and avoid "Take a class" copy (see 8).

## What already works well (protect these)

- **Entry screen.** The wordmark, the three numbered paths with "Start here" on the first, and the plain line "25 words, 2 classes, Sound starts when you enter" are clear and honest. Typography (wide sans plus italic serif) has real hierarchy. `review-01-entry.png`
- **Studio.** The daylight loft with window grid light, curtain, piano, barre, lamp and floor shadows is convincing. The charcoal figure has strong contrast in Orbit and Front views, with good grain and sheen. No mirrors anywhere, which matches the research.
- **Word cards.** What it is, a teacher-style quote, Watch for, Try in your body (framed as invitations, with no checks or scores), Where you feel it with front and side body maps, confidence grade. `review-06-card-snake.png`, `review-07-card-bottom.png`
- **Study bar.** Pause, step, 1/4, 1/2, 1x, Angle (the label shows the current view), Trails and Map all show their on state clearly (white pill for the active speed, dark pill for toggles). The Shortcuts sheet is complete. `review-46-panels.png`
- **Trails.** With wide hand motion (Curves plus Groove) the ellipses are readable and attractive. `review-47-trails-curves-groove.png`
- **Class captions.** The current cue in large italic with earlier cues fading above it, a progress line, "Next cue" and "End". The "Now in the body" panel with intensity sliders and "CLASS" labels makes layer ownership clear. `review-40-class-stack5.png`
- **Stacking panel.** Numbered layers with sliders and "Release all", and the one-line "Each word stacks on the ones before." `review-05-stack3.png`
- **Wording of the guidance.** Imperatives are short and sensory, and the invitations avoid "don't". The About comparison table is a strong teaching device.
- **Overhead and Walk cameras.** Overhead gives a clear, well-framed top view with shadows; Walk is a calm eye-level view. `review-16-tile-side-back-over-front.png`, `review-17-walk.png`
- **Feet camera.** Well framed on the feet and ankles. `review-09-feet.png`
- **Phone chrome.** The one-row word strip, compact top bar, and class caption card are good; the issue is only the stage visibility in item 1. `review-35` (in `review-39-phone-sheet2.png`)
- **Motion on strong words.** Shake, Quake, Boil, Groove and Grab have clearly different energy (0.31 to 0.51 m/s) from the calm words (0.04 to 0.07). Groove's bounce period (about 1.1 s) fits the footage. Tashi, Thick and Time being slow is right in principle; the problem is legibility (item 3).

## Appendix: motion measurements (24 s per word, intensity 0.7)

| Word | Mean speed m/s | Pelvis height range (m) | Mean hand height above pelvis (m) | Max hand height above pelvis (m) |
|---|---|---|---|---|
| idle | 0.065 | 0.029 | 0.04 | 0.26 |
| float | 0.121 | 0.061 | 0.67 | 1.01 |
| lunas | 0.115 | 0.068 | 0.18 | 0.44 |
| biba | 0.068 | 0.026 | 0.09 | 0.38 |
| lena | 0.108 | 0.158 | 0.10 | 0.33 |
| snake | 0.148 | 0.025 | 0.08 | 0.38 |
| flesh | 0.051 | 0.016 | 0.03 | 0.27 |
| balls | 0.171 | 0.038 | 0.42 | 1.06 |
| curves | 0.165 | 0.024 | 0.64 | 1.09 |
| shake (30 s warm) | 0.511 | 0.116 | 0.32 | 1.05 |
| quake | 0.337 | 0.101 | 0.02 | 0.38 |
| boil | 0.334 | 0.098 | 0.00 | 0.51 |
| thick | 0.043 | 0.078 | 0.30 | 0.43 |
| time | 0.055 | 0.016 | 0.03 | 0.17 |
| groove | 0.394 | 0.058 | 0.58 | 0.98 |
| silly | 0.189 | 0.057 | 0.13 | 0.96 |
| collapse | 0.083 | 0.095 | 0.07 | 0.28 |
| melt | 0.252 | 0.139 | 0.04 | 0.33 |
| tashi | 0.041 | 0.027 | 0.01 | 0.29 |
| ashi | 0.098 | 0.029 | 0.04 | 0.29 |
| grab | 0.312 | 0.060 | 0.15 | 0.49 |
| forces | 0.092 | 0.024 | 0.15 | 0.41 |
| dolfi | 0.074 | 0.020 | 0.04 | 0.21 |
| hotfloor | 0.164 | 0.028 | 0.07 | 0.32 |
| countdown | 0.211 | 0.051 | 0.42 | 1.07 |
| explosive | 0.287 | 0.026 | 0.11 | 0.97 |

Notes. Lena's 0.158 m pelvis drop (floor 0.79 m) is the known deep-knee issue; it also means Lena reads as a squat bob and not as a pelvis-first wave. An autocorrelation loop test was inconclusive (slow motion stays correlated past 1 s), so no claim is made about repetition beyond Groove's expected pulse.
