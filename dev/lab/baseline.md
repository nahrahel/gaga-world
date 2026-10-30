# Motion lab baseline

2026-10-30T01:46:11.781Z. Fixed dt 1/60, seed 7, soloist, warmup 8 s then 30 s recorded unless noted. 

Snap = joint angular acceleration above 3000 deg/s^2 (velocity change over 50 deg/s inside one frame); snaps/min counts snap events (frames merged within 0.1 s) in the upper body (trunk, neck, head, arms) or the legs and feet. Jerk kurtosis: 3 = smooth Gaussian texture, higher = impulsive. Trunk wave r: mean |peak cross-correlation| of neighbouring spine01..06 lateral bend angles (6 s trend removed); trunk lag: spine01 to spine06 lag (positive = wave travels up); phase on trunk: that lag divided by the wave period (a readable S-wave needs about 0.5); chest>head r: spine06 vs head lateral bend (negative = the head cancels the wave); sagittal amp: mean sagittal wave amplitude per spine joint. Spine sat: share of frames with a spine joint inside the soft-clamp zone (over 75% of its limit).

## Smoothness and connectedness

| scenario | snaps/min upper | snaps/min legs | p99 acc trunk | p99 acc arms | jerk kurt trunk | jerk kurt arms | trunk wave r | trunk lag s (up +) | phase on trunk | chest>head r | sagittal amp deg | spine sat | arm passive r |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 4 | 48 | 296 | 721 | 143.9 | 6.5 | 0.93 | 0.03 | 0.01 | -0.78 | 0.6 | 0% | 0.17 |
| float | 34 | 74 | 603 | 736 | 132.2 | 8.8 | 0.95 | 0.07 | 0.02 | -0.58 | 0.7 | 2% | 0.45 |
| lunas | 12 | 62 | 413 | 1793 | 116.7 | 7.2 | 0.95 | 0.02 | 0 | -0.69 | 0.5 | 0% | 0.21 |
| biba | 8 | 54 | 334 | 724 | 130.7 | 6.5 | 0.92 | 0.03 | 0.01 | -0.42 | 0.4 | 0% | 0.27 |
| lena | 18 | 62 | 216 | 717 | 68.6 | 6.6 | 0.9 | -1.5 | - | 0.29 | 1.1 | 0% | 0.29 |
| snake | 30 | 64 | 363 | 736 | 90.6 | 6.2 | 0.99 | 0.57 | 0.18 | -0.89 | 1.5 | 4% | -0.09 |
| flesh | 16 | 44 | 396 | 678 | 136.7 | 6.5 | 0.91 | 0.02 | 0 | -0.78 | 0.6 | 0% | -0.09 |
| balls | 56 | 72 | 532 | 3322 | 37 | 380.5 | 0.73 | 0.03 | 0.01 | -0.67 | 1.1 | 2% | 0.21 |
| curves | 26 | 90 | 377 | 693 | 116.8 | 6.9 | 0.87 | -0.12 | 0.04 | -0.75 | 1 | 7% | 0.18 |
| shake | 68 | 66 | 698 | 6073 | 3.4 | 6.5 | 0.97 | 0.05 | 0.01 | -0.41 | 1.6 | 1% | 0.29 |
| quake | 6 | 88 | 4180 | 21526 | 7.3 | 13.5 | 0.96 | 0.13 | 0.03 | -0.5 | 0.8 | 0% | -0.21 |
| boil | 152 | 102 | 3421 | 18607 | 320.7 | 671.5 | 0.74 | 0.18 | 0.06 | -0.58 | 1.1 | 2% | -0.37 |
| thick | 8 | 52 | 155 | 194 | 199.5 | 7.2 | 0.96 | 0.07 | 0.01 | -0.92 | 0.5 | 0% | -0.3 |
| time | 2 | 50 | 200 | 722 | 266.8 | 6.5 | 0.88 | -0.03 | 0.01 | -0.86 | 0.5 | 0% | 0.24 |
| groove | 84 | 60 | 284 | 1815 | 39.5 | 10.8 | 0.92 | 0 | 0 | -0.71 | 1 | 1% | -0.6 |
| silly | 38 | 88 | 1398 | 26006 | 376.3 | 180.4 | 0.92 | -0.02 | 0 | -0.69 | 0.7 | 40% | 0.32 |
| explosive | 76 | 58 | 547 | 3554 | 346.3 | 197.6 | 0.92 | 0 | 0 | 0.34 | 0.9 | 0% | 0.05 |
| snake@0.8 | 10 | 76 | 377 | 823 | 50.3 | 5.4 | 1 | 0.53 | 0.17 | -0.96 | 1.6 | 5% | -0.35 |
| snake+float | 38 | 80 | 549 | 869 | 64 | 3.1 | 0.98 | 0.57 | 0.18 | -0.82 | 1.6 | 5% | 0.5 |
| trans lena>snake | 13.5 | 58.5 | 332 | 730 | 104.4 | 6.5 | 0.99 | 0.5 | 0.14 | -0.88 | 1 | 4% | -0.12 |
| trans shake>float | 39 | 67.5 | 606 | 1306 | 10.6 | 548.6 | 0.95 | 0.03 | 0.01 | -0.82 | 1.2 | 0% | -0.05 |
| accents | 33 | 75 | 396 | 2868 | 353.9 | 361.9 | 0.94 | -0.02 | 0 | -0.51 | 0.6 | 8% | 0.3 |
| stack4 | 20 | 86 | 358 | 1663 | 57.6 | 9.4 | 0.98 | 0.58 | 0.19 | -0.74 | 1.7 | 2% | -0.18 |
| stack4b | 26 | 70 | 323 | 2527 | 3.2 | 7.9 | 0.98 | 0.07 | 0.01 | -0.46 | 0.9 | 0% | -0.45 |
| edge dt | 37.8 | 53.6 | 604 | 1960 | 44.7 | 23.9 | 0.96 | 0.05 | 0.02 | -0.75 | 1.5 | 20% | 0.5 |

## Grounding, balance, head

| scenario | slide max mm | toe / heel penetration mm | heel lift L/R | steps/min | lifts/min | toe drag mm/min | COM outside % | COM p5 mm | stance knee p5/p50/p95 | head/neck sat | head counter/follow | head p99 deg/s | ACF 0.25-2 s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 5.2 | -24 / 0 | 14%/14% | 8 | 20 | 98 | 19% | -37 | 11.9/28.6/34.6 | 11% | 38%/39% | 325 | 0.3 |
| float | 6 | -22.9 / 0 | 9%/24% | 24 | 14 | 286 | 20% | -67 | 9/24.7/44.3 | 18% | 22%/51% | 414 | 0.3 |
| lunas | 8.2 | -35.3 / 0 | 74%/83% | 14 | 16 | 706 | 66% | -116 | 9/30.2/42.4 | 21% | 27%/44% | 290 | 0.19 |
| biba | 5.4 | -21.7 / 0 | 15%/11% | 2 | 30 | 171 | 15% | -42 | 18.6/26.7/36.4 | 10% | 25%/57% | 386 | 0.29 |
| lena | 5.8 | -21.4 / 0 | 18%/16% | 12 | 24 | 253 | 22% | -81 | 17/35/67.3 | 18% | 28%/45% | 423 | 0.24 |
| snake | 5.7 | -23.3 / 0 | 20%/11% | 14 | 18 | 289 | 18% | -59 | 16.6/30/65.4 | 14% | 6%/82% | 363 | 0.23 |
| flesh | 5.3 | -23.1 / 0 | 15%/10% | 0 | 28 | 93 | 17% | -51 | 10.6/23.8/31.8 | 11% | 30%/38% | 357 | 0.24 |
| balls | 9.1 | -28 / 0 | 23%/21% | 10 | 26 | 227 | 20% | -98 | 14.6/27.1/38.3 | 10% | 19%/61% | 408 | 0.31 |
| curves | 7 | -28.2 / 0 | 36%/42% | 30 | 20 | 482 | 34% | -112 | 20.2/30.4/64.9 | 14% | 20%/59% | 368 | 0.23 |
| shake | 6 | -22.6 / 0 | 13%/25% | 8 | 28 | 283 | 22% | -101 | 31.1/41.4/62.1 | 4% | 6%/87% | 313 | 0.38 |
| quake | 5.7 | -22.8 / 0 | 22%/17% | 4 | 30 | 227 | 20% | -50 | 25.6/34.7/43.7 | 6% | 16%/73% | 381 | 0.57 |
| boil | 5.9 | -24 / 0 | 19%/22% | 14 | 32 | 416 | 23% | -71 | 30.9/59/68.9 | 14% | 21%/69% | 546 | 0.21 |
| thick | 5.8 | -22.8 / 0 | 11%/20% | 4 | 26 | 215 | 17% | -53 | 33.1/46.3/71.5 | 4% | 34%/43% | 140 | 0.32 |
| time | 5.8 | -23.7 / 0 | 14%/16% | 2 | 26 | 188 | 18% | -41 | 9/20.8/30 | 6% | 25%/57% | 235 | 0.35 |
| groove | 6.8 | -31.4 / 0 | 100%/100% | 0 | 30 | 560 | 100% | -122 | 27/36/44.6 | 7% | 6%/75% | 379 | 0.5 |
| silly | 5.8 | -24.6 / 0 | 17%/31% | 18 | 26 | 281 | 25% | -56 | 9/37.9/47.9 | 11% | 20%/61% | 351 | 0.3 |
| explosive | 5.7 | -21.1 / 0 | 11%/28% | 2 | 30 | 197 | 27% | -54 | 9/24.1/31.9 | 6% | 41%/49% | 385 | 0.24 |
| snake@0.8 | 5.8 | -22.2 / 0 | 18%/18% | 8 | 32 | 271 | 21% | -57 | 19.8/34.4/63.5 | 5% | 9%/80% | 273 | 0.31 |
| snake+float | 5.7 | -22.7 / 0 | 21%/14% | 22 | 18 | 365 | 19% | -58 | 9/26.4/50 | 11% | 8%/81% | 436 | 0.33 |
| trans lena>snake | 5.8 | -22.3 / 0 | 11%/20% | 13.5 | 18 | 189 | 20% | -52 | 10.2/26.4/63.9 | 7% | 17%/67% | 366 | 0.28 |
| trans shake>float | 5.9 | -23.2 / 0 | 13%/24% | 13.5 | 24 | 276 | 23% | -59 | 13.6/34.8/54.3 | 5% | 15%/74% | 291 | 0.59 |
| accents | 5.5 | -21.5 / 0 | 20%/16% | 15 | 24 | 229 | 21% | -75 | 9/23.9/38.1 | 10% | 34%/46% | 450 | 0.24 |
| stack4 | 7.5 | -34.6 / 0 | 67%/86% | 12 | 32 | 704 | 61% | -146 | 19.1/38.1/75 | 24% | 6%/78% | 490 | 0.18 |
| stack4b | 6.6 | -30.5 / 0 | 100%/100% | 4 | 18 | 274 | 100% | -151 | 41.8/58.7/65 | 0% | 1%/96% | 142 | 0.38 |
| edge dt | 5.4 | -17.7 / 0 | 19%/9% | 6.3 | 18.9 | 140 | 20% | -46 | 9/24.5/40.8 | 0% | 9%/84% | 211 | 0.63 |

## Events and posture switches

Peak upper-body acceleration in the 3 s after a layer change or accent (or 0.8 s around an internal posture switch), relative to a typical window with no event or switch. Legs: peak leg acceleration in the 3 s after the event, same baseline.

- **idle**: no events; shape/arm switches 12 (24/min), upper peak x2.15 avg (worst x5.81); steps starting within 3 s after a body-shape switch 0% of 4
- **float**: no events; shape/arm switches 11 (22/min), upper peak x3.49 avg (worst x8.08); steps starting within 3 s after a body-shape switch 75% of 12
- **lunas**: no events; shape/arm switches 10 (20/min), upper peak x1.62 avg (worst x4.28); steps starting within 3 s after a body-shape switch 29% of 7
- **biba**: no events; shape/arm switches 11 (22/min), upper peak x2.56 avg (worst x6.93); steps starting within 3 s after a body-shape switch 0% of 1
- **lena**: no events; shape/arm switches 10 (20/min), upper peak x1.5 avg (worst x3.51); steps starting within 3 s after a body-shape switch 83% of 6
- **snake**: no events; shape/arm switches 14 (28/min), upper peak x1.56 avg (worst x6.08); steps starting within 3 s after a body-shape switch 43% of 7
- **flesh**: no events; shape/arm switches 9 (18/min), upper peak x1.4 avg (worst x3.84); steps starting within 3 s after a body-shape switch - of 0
- **balls**: no events; shape/arm switches 11 (22/min), upper peak x2.18 avg (worst x6.97); steps starting within 3 s after a body-shape switch 40% of 5
- **curves**: no events; shape/arm switches 14 (28/min), upper peak x2.91 avg (worst x6.4); steps starting within 3 s after a body-shape switch 47% of 15
- **shake**: no events; shape/arm switches 10 (20/min), upper peak x1.09 avg (worst x1.85); steps starting within 3 s after a body-shape switch 75% of 4
- **quake**: no events; shape/arm switches 12 (24/min), upper peak x0.97 avg (worst x1.32); steps starting within 3 s after a body-shape switch 0% of 2
- **boil**: no events; shape/arm switches 9 (18/min), upper peak x1.84 avg (worst x4.64); steps starting within 3 s after a body-shape switch 86% of 7
- **thick**: no events; shape/arm switches 16 (32/min), upper peak x2.56 avg (worst x13.77); steps starting within 3 s after a body-shape switch 50% of 2
- **time**: no events; shape/arm switches 5 (10/min), upper peak x1.31 avg (worst x2.13); steps starting within 3 s after a body-shape switch 100% of 1
- **groove**: no events; shape/arm switches 13 (26/min), upper peak x1.11 avg (worst x2.44); steps starting within 3 s after a body-shape switch - of 0
- **silly**: no events; shape/arm switches 11 (22/min), upper peak x3.43 avg (worst x13.78); steps starting within 3 s after a body-shape switch 44% of 9
- **explosive**: no events; shape/arm switches 14 (28/min), upper peak x1.77 avg (worst x8.99); steps starting within 3 s after a body-shape switch 0% of 1
- **snake@0.8**: no events; shape/arm switches 11 (22/min), upper peak x1.32 avg (worst x2.44); steps starting within 3 s after a body-shape switch 75% of 4
- **snake+float**: no events; shape/arm switches 10 (20/min), upper peak x1.23 avg (worst x2.59); steps starting within 3 s after a body-shape switch 36% of 11
- **trans lena>snake**: lena:0.7 @10.0s upper x1.05 legs x0.06, lena:0 @25.0s upper x0.51 legs x0.94, snake:0.7 @26.0s upper x1.48 legs x0.94; shape/arm switches 18 (27/min), upper peak x1.43 avg (worst x3.27); steps starting within 3 s after a body-shape switch 33% of 9
- **trans shake>float**: shake:0.7 @10.0s upper x0.58 legs x1.01, shake:0 @25.0s upper x5.13 legs x1.07, float:0.7 @26.0s upper x0.49 legs x1.07; shape/arm switches 16 (24/min), upper peak x3.41 avg (worst x11.48); steps starting within 3 s after a body-shape switch 67% of 9
- **accents**: !explosive @14.0s upper x6.14 legs x1.71, !explosive @19.0s upper x19.35 legs x1.7, !explosive @24.0s upper x11.08 legs x1.66; shape/arm switches 8 (24/min), upper peak x25.83 avg (worst x152.33); steps starting within 3 s after a body-shape switch 40% of 5
- **stack4**: no events; shape/arm switches 13 (26/min), upper peak x1.07 avg (worst x2.21); steps starting within 3 s after a body-shape switch 100% of 6
- **stack4b**: no events; shape/arm switches 4 (8/min), upper peak x0.84 avg (worst x0.92); steps starting within 3 s after a body-shape switch 0% of 2
- **edge dt**: no events; shape/arm switches 7 (22.1/min), upper peak x1.18 avg (worst x1.64); steps starting within 3 s after a body-shape switch 0% of 2

Edge dt: pose change during dt=0 0 deg, during dt=1e-5 0.0013 deg, resume spike x0.27, irregular dt p99 x1.19, dt=0.5 (clamped) spike x1.36, NaN 0.

## Sameness across words

Determinism (idle twice, same hash): true. Mean pairwise cosine of the words' band-power change vs idle (11 body groups x 4 bands): **0.41** (1 = every word moves away from idle in the same way).

Same seed, different words: the body shape and both arm postures are identical in **1%** of 0.5 s samples on average across word pairs (body shape alone: 15%).

| word | distance from idle (log10 power) | own generator share of motion | full / gen off / idle mean speed deg/s | same pose as idle |
|---|---|---|---|---|
| float | 0.556 | 1% | 15.92 / 15.71 / 10.33 | 0% |
| lunas | 0.419 | -2% | 15.76 / 16.13 / 10.33 | 0% |
| biba | 0.272 | - | - | 0% |
| lena | 0.319 | 7% | 13.36 / 12.48 / 10.33 | 0% |
| snake | 0.538 | 13% | 14.78 / 12.91 / 10.33 | 0% |
| flesh | 0.309 | - | - | 11% |
| balls | 1.064 | 36% | 19.48 / 12.4 / 10.33 | 0% |
| curves | 0.688 | 23% | 20.73 / 15.94 / 10.33 | 0% |
| shake | 1.8 | 37% | 40.27 / 25.39 / 10.33 | 0% |
| quake | 1.804 | 44% | 38.93 / 21.75 / 10.33 | 0% |
| boil | 1.913 | 26% | 40.85 / 30.25 / 10.33 | 0% |
| thick | 0.97 | 14% | 7.32 / 6.29 / 10.33 | 0% |
| time | 0.234 | - | - | 0% |
| groove | 1.244 | 61% | 35.14 / 13.73 / 10.33 | 0% |
| silly | 1.278 | 4% | 21.69 / 20.88 / 10.33 | 0% |
| explosive | 1.349 | - | - | 0% |
