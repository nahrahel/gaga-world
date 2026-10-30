# Motion lab polish2

2026-10-30T14:34:46.913Z. Fixed dt 1/60, seed 7, soloist, warmup 8 s then 30 s recorded unless noted. Values in brackets: dev/lab/polish.json.

Snap = joint angular acceleration above 3000 deg/s^2 (velocity change over 50 deg/s inside one frame); snaps/min counts snap events (frames merged within 0.1 s) in the upper body (trunk, neck, head, arms) or the legs and feet. Jerk kurtosis: 3 = smooth Gaussian texture, higher = impulsive. Trunk wave r: mean |peak cross-correlation| of neighbouring spine01..06 lateral bend angles (6 s trend removed); trunk lag: spine01 to spine06 lag (positive = wave travels up); phase on trunk: that lag divided by the wave period (a readable S-wave needs about 0.5); chest>head r: spine06 vs head lateral bend (negative = the head cancels the wave); sagittal amp: mean sagittal wave amplitude per spine joint. Spine sat: share of frames with a spine joint inside the soft-clamp zone (over 75% of its limit).

## Smoothness and connectedness

| scenario | snaps/min upper | snaps/min legs | p99 acc trunk | p99 acc arms | jerk kurt trunk | jerk kurt arms | trunk wave r | trunk lag s (up +) | phase on trunk | chest>head r | sagittal amp deg | spine sat | arm passive r |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 0 (0) | 32 (34) | 49 (47) | 712 (721) | 10.8 (9.7) | 6.5 (7.1) | 0.98 (0.98) | -0.08 (-0.12) | 0.02 (0.03) | 0.92 (0.56) | 0.5 (0.4) | 0% (0%) | -0.16 (0.08) |
| float | 0 (0) | 50 (54) | 68 (61) | 782 (713) | 40.6 (13.4) | 42.2 (7.6) | 0.98 (0.97) | 0.3 (-0.03) | 0.07 (0.01) | 0.84 (0.36) | 1.2 (0.7) | 44% (0%) | -0.16 (0.31) |
| lunas | 0 (0) | 48 (66) | 55 (53) | 1799 (1810) | 10.7 (25.4) | 6.5 (6.3) | 0.98 (0.98) | -0.15 (-0.17) | 0.04 (0.04) | 0.88 (0.34) | 0.6 (0.6) | 0% (0%) | 0.11 (0.21) |
| biba | 0 (0) | 38 (42) | 92 (87) | 178 (165) | 9.2 (8.4) | 23.7 (21) | 0.99 (0.99) | -0.13 (-0.15) | 0.02 (0.03) | 0.91 (0.48) | 0.8 (0.7) | 0% (0%) | 0.12 (0.21) |
| lena | 0 (0) | 60 (42) | 277 (271) | 981 (968) | 32.6 (16.1) | 13.7 (12.3) | 0.98 (0.98) | 0.4 (0.43) | 0.25 (0.27) | 0.87 (0.7) | 1.2 (1.2) | 2% (1%) | -0.31 (0.43) |
| snake | 0 (0) | 44 (44) | 64 (60) | 734 (730) | 16.4 (16.4) | 6.4 (6.5) | 0.98 (0.98) | 1.08 (1.2) | 0.38 (0.42) | 0.95 (0.9) | 3.2 (3.2) | 5% (1%) | -0.27 (-0.41) |
| flesh | 0 (0) | 24 (28) | 45 (44) | 256 (260) | 5.1 (5.1) | 6 (6) | 0.99 (0.99) | -0.15 (-0.25) | 0.03 (0.05) | 0.92 (0.76) | 0.5 (0.4) | 0% (0%) | 0.17 (0.21) |
| balls | 26 (26) | 46 (64) | 313 (349) | 4338 (4334) | 112.4 (131.7) | 398.2 (410.1) | 0.91 (0.9) | -0.15 (-0.17) | 0.04 (0.05) | 0.84 (0.78) | 0.8 (0.8) | 0% (0%) | 0.46 (0.47) |
| curves | 0 (0) | 60 (90) | 86 (84) | 713 (732) | 7 (6.8) | 6.6 (6.5) | 0.96 (0.96) | -0.32 (-0.23) | 0.08 (0.07) | 0.89 (0.8) | 0.9 (0.8) | 1% (0%) | 0.28 (-0.09) |
| shake | 48 (52) | 60 (72) | 679 (676) | 6072 (6031) | 3.2 (3.2) | 6.4 (6.4) | 0.97 (0.97) | 0.05 (0.05) | 0.01 (0.01) | 0.5 (0.53) | 1.1 (1.1) | 1% (0%) | 0.07 (0.08) |
| quake | 8 (8) | 74 (76) | 4208 (4211) | 21546 (21527) | 7.3 (7.3) | 13.5 (13.5) | 0.98 (0.97) | 0.13 (0.13) | 0.02 (0.04) | 0.82 (0.75) | 0.8 (0.7) | 0% (0%) | -0.07 (-0.07) |
| boil | 146 (154) | 92 (76) | 4107 (4120) | 16991 (14324) | 285.5 (331.7) | 1003.3 (1035.2) | 0.83 (0.75) | -0.4 (0.13) | 0.09 (0.02) | 0.45 (0.18) | 1.1 (1.1) | 1% (1%) | -0.14 (-0.16) |
| thick | 0 (0) | 36 (26) | 41 (36) | 95 (97) | 18.2 (11.2) | 36.4 (26.1) | 0.96 (0.96) | -0.4 (-0.38) | 0.11 (0.1) | 0.93 (0.77) | 1.2 (1.2) | 1% (1%) | 0.25 (0.31) |
| time | 0 (0) | 32 (26) | 53 (64) | 180 (176) | 23.9 (24.1) | 16.1 (7.6) | 0.97 (0.97) | -0.53 (-0.6) | 0.14 (0.16) | 0.97 (0.44) | 1.1 (1) | 0% (0%) | 0.32 (0.35) |
| groove | 2 (8) | 74 (94) | 207 (208) | 1784 (1714) | 18 (5.7) | 49.3 (110.3) | 0.97 (0.97) | -0.03 (-0.02) | 0.01 (0) | 0.84 (0.53) | 0.7 (0.7) | 0% (0%) | -0.57 (-0.59) |
| silly | 44 (54) | 50 (46) | 1392 (1680) | 29970 (29823) | 213.5 (226.5) | 243.3 (208.7) | 0.91 (0.93) | 1.48 (0) | - | -0.56 (-0.66) | 0.6 (0.5) | 0% (0%) | 0.37 (0.4) |
| explosive | 54 (44) | 46 (70) | 361 (481) | 2438 (2318) | 318.3 (312.7) | 638.4 (791.4) | 0.98 (0.98) | -0.12 (-0.1) | 0.02 (0.03) | -0.4 (0.42) | 1.2 (1.3) | 4% (4%) | 0.11 (0.11) |
| tashi | 0 (0) | 0 (0) | 9 (8) | 245 (254) | 20.8 (24.6) | 6.4 (7.8) | 0.97 (0.94) | -0.02 (-0.17) | 0 (0.04) | 0.87 (-0.27) | 0.5 (0.5) | 0% (0%) | -0.19 (0.09) |
| dolfi | 4 (2) | 52 (48) | 243 (209) | 318 (316) | 62.1 (88.8) | 320.4 (278.3) | 0.99 (0.99) | -0.2 (-0.23) | 0.04 (0.04) | 0.9 (0.69) | 0.9 (0.8) | 0% (0%) | -0.31 (-0.25) |
| snake@0.8 | 0 (0) | 48 (48) | 61 (58) | 750 (752) | 16.7 (16.7) | 6.4 (6.4) | 0.98 (0.98) | 1.15 (1.22) | 0.37 (0.39) | 0.95 (0.89) | 3.6 (3.6) | 5% (2%) | -0.32 (-0.3) |
| snake+float | 0 (0) | 58 (56) | 70 (69) | 758 (732) | 16.9 (16.7) | 44.2 (10.2) | 0.98 (0.97) | 0.93 (1.32) | 0.25 (0.46) | 0.82 (0.9) | 3.5 (3.6) | 46% (8%) | 0.26 (0.24) |
| trans lena>snake | 0 (0) | 33 (45) | 127 (135) | 730 (732) | 16.1 (12.4) | 80.4 (69.4) | 0.97 (0.94) | 0.7 (-1.5) | 0.18 (0.48) | 0.91 (0.79) | 1.6 (1.7) | 3% (0%) | -0.21 (-0.2) |
| trans shake>float | 1.5 (4.5) | 40.5 (45) | 547 (541) | 1440 (1448) | 9.8 (9.8) | 44.2 (43.8) | 0.99 (0.98) | 0.07 (0.05) | 0.02 (0.01) | 0.8 (-0.27) | 1.1 (0.8) | 14% (0%) | 0.14 (0.08) |
| accents | 24 (15) | 42 (54) | 85 (119) | 1634 (1705) | 857 (652.2) | 527.7 (266) | 0.98 (0.96) | 0 (-0.08) | 0 (0.02) | 0.92 (0.85) | 0.8 (0.7) | 9% (1%) | 0.25 (0.38) |
| stack4 | 0 (0) | 62 (98) | 250 (251) | 1898 (1809) | 114.6 (15.1) | 18.1 (7.8) | 0.97 (0.97) | 0.52 (0.58) | 0.14 (0.21) | 0.87 (0.86) | 2.8 (3) | 39% (23%) | 0.22 (0.33) |
| stack4b | 0 (0) | 34 (60) | 162 (159) | 1512 (1567) | 4.7 (7.3) | 33.4 (17.1) | 0.96 (0.95) | 0.02 (0.05) | 0 (0.01) | 0.71 (0.65) | 1.5 (1.6) | 3% (2%) | 0.47 (0.53) |
| edge dt | 0 (22.1) | 37.8 (37.8) | 432 (438) | 1590 (1622) | 33.4 (33.2) | 78.7 (59.4) | 0.96 (0.97) | 0.05 (0.04) | 0.01 (0.01) | 0.88 (0.71) | 0.8 (0.9) | 9% (0%) | 0.15 (0.22) |

## Grounding, balance, head

| scenario | slide max mm | toe / heel penetration mm | heel lift L/R | steps/min | lifts/min | toe drag mm/min | COM outside % | COM p5 mm | stance knee p5/p50/p95 | head/neck sat | head counter/follow | head p99 deg/s | ACF 0.25-2 s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 1 (1) | 0 (0) / 0 | 16%/21% | 6 (6) | 12 (12) | 1 (1) | 1% (1%) | 12 (17) | 9/19.3/48.5 | 7% (7%) | 6%/74% | 59 (58) | 0.24 (0.26) |
| float | 1 (1.1) | 0 (0) / 0 | 29%/38% | 12 (12) | 10 (12) | 0 (1) | 4% (2%) | 6 (12) | 9/34.6/56 | 3% (8%) | 7%/84% | 101 (98) | 0.29 (0.21) |
| lunas | 3 (3) | 0 (0) / 0 | 41%/42% | 2 (4) | 18 (30) | 0 (0) | 4% (3%) | 3 (4) | 9/25.2/49.7 | 7% (10%) | 11%/72% | 84 (83) | 0.27 (0.26) |
| biba | 0.8 (0.9) | 0 (0) / 0 | 14%/19% | 2 (4) | 12 (10) | 0 (0) | 3% (5%) | 6 (0) | 9/30.8/54.8 | 13% (10%) | 3%/79% | 87 (102) | 0.18 (0.18) |
| lena | 1 (0.8) | 0 (0) / 0 | 32%/32% | 20 (10) | 8 (8) | 0 (0) | 4% (3%) | 4 (8) | 10.3/37.1/61.7 | 0% (1%) | 3%/82% | 84 (80) | 0.22 (0.35) |
| snake | 0.9 (0.8) | 0 (0) / 0 | 33%/21% | 10 (6) | 6 (12) | 0 (0) | 2% (2%) | 6 (18) | 9.7/26.5/51.4 | 7% (6%) | 5%/82% | 75 (77) | 0.23 (0.22) |
| flesh | 0.8 (0.5) | 0 (0) / 0 | 9%/14% | 2 (2) | 10 (8) | 0 (0) | 1% (0%) | 10 (24) | 12.8/25.1/48.5 | 7% (7%) | 12%/61% | 97 (96) | 0.21 (0.25) |
| balls | 2.2 (2.2) | 0 (0) / 0 | 23%/32% | 2 (2) | 22 (22) | 0 (0) | 2% (3%) | 10 (8) | 9/20.7/48 | 6% (6%) | 1%/89% | 70 (67) | 0.13 (0.11) |
| curves | 1 (1.1) | 0 (0) / 0 | 32%/45% | 18 (20) | 8 (6) | 0 (0) | 2% (6%) | 9 (-2) | 9/37.5/69.7 | 5% (11%) | 2%/92% | 83 (126) | 0.17 (0.12) |
| shake | 1.1 (1.1) | 0 (0) / 0 | 19%/25% | 16 (14) | 8 (10) | 0 (0) | 2% (3%) | 12 (11) | 21.2/34.7/54.8 | 0% (0%) | 1%/95% | 146 (144) | 0.31 (0.33) |
| quake | 0.9 (0.9) | 0 (0) / 0 | 22%/30% | 10 (10) | 14 (12) | 1 (0) | 3% (3%) | 6 (5) | 27/38.2/63.4 | 4% (4%) | 11%/67% | 140 (135) | 0.59 (0.55) |
| boil | 1.1 (1.3) | 0 (0) / 0 | 22%/19% | 4 (6) | 18 (16) | 0 (0) | 1% (3%) | 10 (6) | 17.1/31.5/55.3 | 9% (9%) | 5%/89% | 239 (229) | 0.06 (0.14) |
| thick | 0.9 (1) | 0 (0) / 0 | 24%/22% | 4 (0) | 12 (10) | 3 (3) | 2% (0%) | 7 (26) | 9/28.4/62.2 | 5% (12%) | 1%/95% | 72 (80) | 0.22 (0.17) |
| time | 0.6 (0.8) | 0 (0) / 0 | 35%/25% | 2 (4) | 6 (6) | 0 (0) | 2% (2%) | 11 (16) | 9/20.6/51.5 | 8% (8%) | 2%/90% | 67 (69) | 0.29 (0.32) |
| groove | 1.2 (1.2) | 0 (0) / 0 | 62%/63% | 18 (14) | 4 (10) | 0 (0) | 3% (2%) | 6 (5) | 12.4/30.9/54 | 11% (6%) | 1%/98% | 146 (159) | 0.46 (0.49) |
| silly | 0.9 (1) | 0 (0) / 0 | 33%/25% | 4 (8) | 12 (8) | 0 (0) | 3% (1%) | 7 (18) | 9/23.2/50.8 | 10% (6%) | 19%/57% | 127 (121) | 0.5 (0.51) |
| explosive | 1.1 (1.1) | 0 (0) / 0 | 25%/34% | 2 (8) | 16 (14) | 0 (0) | 2% (2%) | 8 (14) | 9/20/47.8 | 7% (7%) | 18%/73% | 213 (281) | 0.11 (0.15) |
| tashi | 3.4 (3.4) | 0 (0) / 0 | 0%/0% | 0 (0) | 0 (0) | 0 (0) | 0% (0%) | 79 (82) | 27.4/34.1/38.4 | 8% (8%) | 6%/81% | 94 (90) | 0.57 (0.59) |
| dolfi | 0.8 (0.9) | 0 (0) / 0 | 21%/28% | 4 (6) | 16 (14) | 2 (2) | 4% (5%) | 1 (1) | 9/27.8/53.7 | 6% (8%) | 2%/90% | 65 (72) | 0.08 (0.18) |
| snake@0.8 | 1.3 (1) | 0 (0) / 0 | 37%/26% | 6 (8) | 12 (10) | 0 (0) | 3% (2%) | 5 (18) | 15.3/30.1/51.8 | 7% (8%) | 3%/88% | 88 (80) | 0.23 (0.31) |
| snake+float | 1.1 (1.1) | 0 (0) / 0 | 23%/42% | 8 (8) | 14 (16) | 0 (0) | 4% (4%) | 2 (7) | 9/28.7/51 | 10% (11%) | 5%/85% | 103 (78) | 0.12 (0.17) |
| trans lena>snake | 1 (1.2) | 0 (0) / 0 | 16%/16% | 7.5 (12) | 7.5 (7.5) | 0 (0) | 0% (3%) | 16 (15) | 11.3/24.9/51.4 | 10% (5%) | 3%/84% | 80 (80) | 0.33 (0.3) |
| trans shake>float | 1 (1) | 0 (0) / 0 | 28%/14% | 12 (9) | 6 (12) | 0 (5) | 2% (2%) | 9 (16) | 9/27.6/51.6 | 2% (4%) | 3%/83% | 130 (132) | 0.5 (0.48) |
| accents | 0.9 (1.1) | 0 (0) / 0 | 34%/40% | 12 (9) | 9 (12) | 1 (0) | 4% (3%) | 3 (16) | 9/19.1/46.8 | 2% (0%) | 14%/76% | 88 (83) | 0.14 (0.15) |
| stack4 | 2.4 (2.6) | 0 (0) / 0 | 37%/43% | 16 (16) | 6 (32) | 0 (0) | 3% (5%) | 4 (-1) | 9.7/33.5/55.3 | 4% (5%) | 5%/83% | 118 (83) | 0.22 (0.22) |
| stack4b | 0.7 (0.7) | 0 (0) / 0 | 69%/71% | 2 (0) | 2 (8) | 2 (2) | 4% (3%) | 2 (4) | 17.8/32/45.2 | 2% (0%) | 0%/99% | 116 (126) | 0.47 (0.17) |
| edge dt | 1.2 (1.2) | 0 (0) / 0 | 17%/17% | 3.2 (3.2) | 12.6 (18.9) | 0 (0) | 3% (2%) | 5 (13) | 13.4/31.4/54.7 | 1% (3%) | 2%/90% | 120 (115) | 0.47 (0.49) |

## Events and posture switches

Peak upper-body acceleration in the 3 s after a layer change or accent (or 0.8 s around an internal posture switch), relative to a typical window with no event or switch. Legs: peak leg acceleration in the 3 s after the event, same baseline.

- **idle**: no events; shape/arm switches 10 (20/min), upper peak x1.2 avg (worst x1.54); steps starting within 3 s after a body-shape switch 0% of 3
- **float**: no events; shape/arm switches 13 (26/min), upper peak x1 avg (worst x1.73); steps starting within 3 s after a body-shape switch 17% of 6
- **lunas**: no events; shape/arm switches 14 (28/min), upper peak x1.19 avg (worst x2.04); steps starting within 3 s after a body-shape switch 100% of 1
- **biba**: no events; shape/arm switches 3 (6/min), upper peak x1.06 avg (worst x1.27); steps starting within 3 s after a body-shape switch 100% of 1
- **lena**: no events; shape/arm switches 12 (24/min), upper peak x0.89 avg (worst x1.11); steps starting within 3 s after a body-shape switch 20% of 10
- **snake**: no events; shape/arm switches 11 (22/min), upper peak x1.03 avg (worst x1.53); steps starting within 3 s after a body-shape switch 40% of 5
- **flesh**: no events; shape/arm switches 4 (8/min), upper peak x0.93 avg (worst x1.04); steps starting within 3 s after a body-shape switch 0% of 1
- **balls**: no events; shape/arm switches 12 (24/min), upper peak x0.58 avg (worst x1.76); steps starting within 3 s after a body-shape switch 100% of 1
- **curves**: no events; shape/arm switches 12 (24/min), upper peak x1.08 avg (worst x1.57); steps starting within 3 s after a body-shape switch 33% of 9
- **shake**: no events; shape/arm switches 12 (24/min), upper peak x1.17 avg (worst x2.03); steps starting within 3 s after a body-shape switch 63% of 8
- **quake**: no events; shape/arm switches 11 (22/min), upper peak x0.66 avg (worst x1.14); steps starting within 3 s after a body-shape switch 40% of 5
- **boil**: no events; shape/arm switches 11 (22/min), upper peak x0.59 avg (worst x1.38); steps starting within 3 s after a body-shape switch 0% of 2
- **thick**: no events; shape/arm switches 4 (8/min), upper peak x1.11 avg (worst x1.62); steps starting within 3 s after a body-shape switch 0% of 2
- **time**: no events; shape/arm switches 3 (6/min), upper peak x0.92 avg (worst x0.93); steps starting within 3 s after a body-shape switch 0% of 1
- **groove**: no events; shape/arm switches 14 (28/min), upper peak x1.02 avg (worst x1.3); steps starting within 3 s after a body-shape switch 33% of 9
- **silly**: no events; shape/arm switches 11 (22/min), upper peak x0.17 avg (worst x0.2); steps starting within 3 s after a body-shape switch 50% of 2
- **explosive**: no events; shape/arm switches 9 (18/min), upper peak x0.09 avg (worst x0.12); steps starting within 3 s after a body-shape switch 0% of 1
- **tashi**: no events; shape/arm switches 5 (10/min), upper peak x0.96 avg (worst x1.04); steps starting within 3 s after a body-shape switch - of 0
- **dolfi**: no events; shape/arm switches 4 (8/min), upper peak x0.75 avg (worst x1.1); steps starting within 3 s after a body-shape switch 50% of 2
- **snake@0.8**: no events; shape/arm switches 8 (16/min), upper peak x1.05 avg (worst x1.4); steps starting within 3 s after a body-shape switch 33% of 3
- **snake+float**: no events; shape/arm switches 13 (26/min), upper peak x1.03 avg (worst x1.49); steps starting within 3 s after a body-shape switch 25% of 4
- **trans lena>snake**: lena:0.7 @10.0s upper x1.15 legs x1.04, lena:0 @25.0s upper x1.36 legs x0.05, snake:0.7 @26.0s upper x1.36 legs x0.05; shape/arm switches 17 (25.5/min), upper peak x1.15 avg (worst x1.71); steps starting within 3 s after a body-shape switch 60% of 5
- **trans shake>float**: shake:0.7 @10.0s upper x1.8 legs x1.15, shake:0 @25.0s upper x3.8 legs x0.33, float:0.7 @26.0s upper x1.54 legs x0.97; shape/arm switches 19 (28.5/min), upper peak x1.04 avg (worst x3.45); steps starting within 3 s after a body-shape switch 63% of 8
- **accents**: !explosive @14.0s upper x41.44 legs x0.14, !explosive @19.0s upper x38.53 legs x2.07, !explosive @24.0s upper x85.54 legs x0.88; shape/arm switches 9 (27/min), upper peak x10.02 avg (worst x82.68); steps starting within 3 s after a body-shape switch 50% of 4
- **stack4**: no events; shape/arm switches 14 (28/min), upper peak x1.1 avg (worst x1.69); steps starting within 3 s after a body-shape switch 50% of 8
- **stack4b**: no events; shape/arm switches 0 (0/min), upper peak x0 avg (worst x0); steps starting within 3 s after a body-shape switch 0% of 1
- **edge dt**: no events; shape/arm switches 8 (25.2/min), upper peak x0.91 avg (worst x1.62); steps starting within 3 s after a body-shape switch 100% of 1

Edge dt: pose change during dt=0 0 deg, during dt=1e-5 0.0003 deg, resume spike x0.17, irregular dt p99 x2.79, dt=0.5 (clamped) spike x0.68, NaN 0.

## Sameness across words

Determinism (idle twice, same hash): true. Mean pairwise cosine of the words' band-power change vs idle (11 body groups x 4 bands): **0.38** (0.4) (1 = every word moves away from idle in the same way).

Same seed, different words: the body shape and both arm postures are identical in **1%** of 0.5 s samples on average across word pairs (body shape alone: 18%).

| word | distance from idle (log10 power) | own generator share of motion | full / gen off / idle mean speed deg/s | same pose as idle |
|---|---|---|---|---|
| float | 0.91 | 26% | 16.95 / 12.6 / 9.26 | 0% |
| lunas | 0.529 | 3% | 15.24 / 14.81 / 9.26 | 0% |
| biba | 0.694 | 46% | 12.47 / 6.72 / 9.26 | 0% |
| lena | 1.331 | 37% | 19.15 / 12.07 / 9.26 | 0% |
| snake | 0.53 | 8% | 11.45 / 10.57 / 9.26 | 0% |
| flesh | 0.528 | 35% | 11.55 / 7.46 / 9.26 | 0% |
| balls | 1.683 | 23% | 14.97 / 11.6 / 9.26 | 0% |
| curves | 0.745 | 30% | 16.29 / 11.37 / 9.26 | 0% |
| shake | 2.823 | 61% | 31.83 / 12.56 / 9.26 | 0% |
| quake | 2.851 | 66% | 30.78 / 10.57 / 9.26 | 0% |
| boil | 2.966 | 54% | 26 / 11.94 / 9.26 | 0% |
| thick | 1.138 | 52% | 11.45 / 5.52 / 9.26 | 0% |
| time | 0.844 | 52% | 9.82 / 4.75 / 9.26 | 0% |
| groove | 2.072 | 65% | 31.79 / 11.05 / 9.26 | 0% |
| silly | 2.521 | 45% | 20.47 / 11.24 / 9.26 | 0% |
| explosive | 2.359 | - | - | 0% |
