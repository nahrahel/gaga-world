# Gaga World

A 3D study of the vocabulary of Gaga, the movement language developed by Ohad Naharin. One faceless sculpted dancer works in a daylight studio. You give it Gaga cues, and they stack the way they do in a class: float, then lunas, then Lena, and nothing stops.

Live: https://nahrahel.github.io/gaga-world/

## What you can do
- Add and release 25 words (16 introductory, 9 extended). Each active word has an intensity slider.
- Take a guided class that stacks and releases cues over 8 minutes.
- Study any word at quarter, half or full speed, pause and step frame by frame, switch between 9 camera angles, and turn on motion trails or the sensation map.
- Watch from Orbit, Walk at eye level, Join the class as a dancer (your cursor guides your hands), or let the Director frame the body part a word lives in.

## Honesty notes
The dancer is an illustration built from public sources and footage. It has not been reviewed by a certified Gaga teacher, and it is one possible interpretation. Gaga is taught only by certified teachers: https://www.gagapeople.com. The app does not watch or assess your movement.

## Run locally
```
python3 -m http.server 5181 --bind 127.0.0.1
```
Open http://127.0.0.1:5181/src/index.html for the source version. `node build.mjs` bundles everything into `index.html` (GitHub Pages) and `dist/gaga-world.html`. three.js 0.170.0 loads from jsDelivr.

## Layout
- `src/skeleton.js` 57-bone skeleton and anatomical joint conventions
- `src/figure.js`, `src/assets/body-data.js`, `tools/build-body.mjs` sculpted body (signed distance field, polygonized, skinned)
- `src/motion/` procedural Gaga motion engine
- `src/studio/` daylight studio, post-processing, cameras, motion trails
- `src/ui/` interface, guided class, generative music
- `research/` vocabulary research with sources, footage observations, motion design notes
