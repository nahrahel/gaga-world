# Motion lab polish

2026-10-30T13:38:49.634Z. Fixed dt 1/60, seed 7, soloist, warmup 8 s then 30 s recorded unless noted. Values in brackets: dev/lab/final.json.

Snap = joint angular acceleration above 3000 deg/s^2 (velocity change over 50 deg/s inside one frame); snaps/min counts snap events (frames merged within 0.1 s) in the upper body (trunk, neck, head, arms) or the legs and feet. Jerk kurtosis: 3 = smooth Gaussian texture, higher = impulsive. Trunk wave r: mean |peak cross-correlation| of neighbouring spine01..06 lateral bend angles (6 s trend removed); trunk lag: spine01 to spine06 lag (positive = wave travels up); phase on trunk: that lag divided by the wave period (a readable S-wave needs about 0.5); chest>head r: spine06 vs head lateral bend (negative = the head cancels the wave); sagittal amp: mean sagittal wave amplitude per spine joint. Spine sat: share of frames with a spine joint inside the soft-clamp zone (over 75% of its limit).

## Smoothness and connectedness

| scenario | snaps/min upper | snaps/min legs | p99 acc trunk | p99 acc arms | jerk kurt trunk | jerk kurt arms | trunk wave r | trunk lag s (up +) | phase on trunk | chest>head r | sagittal amp deg | spine sat | arm passive r |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 0 (0) | 34 (54) | 47 (60) | 721 (726) | 9.7 (11.2) | 7.1 (6.7) | 0.98 (0.98) | -0.12 (-0.15) | 0.03 (0.04) | 0.56 (-0.34) | 0.4 (0.4) | 0% (0%) | 0.08 (-0.11) |
| float | 0 (10) | 54 (60) | 61 (68) | 713 (789) | 13.4 (28.3) | 7.6 (14.2) | 0.97 (0.97) | -0.03 (-0.12) | 0.01 (0.03) | 0.36 (0.32) | 0.7 (0.6) | 0% (0%) | 0.31 (0.33) |
| lunas | 0 (0) | 66 (72) | 53 (71) | 1810 (1771) | 25.4 (6.4) | 6.3 (6.2) | 0.98 (0.98) | -0.17 (-0.1) | 0.04 (0.02) | 0.34 (-0.38) | 0.6 (0.5) | 0% (0%) | 0.21 (0.15) |
| biba | 0 (0) | 42 (38) | 87 (84) | 165 (163) | 8.4 (9.6) | 21 (27.5) | 0.99 (0.99) | -0.15 (-0.23) | 0.03 (0.04) | 0.48 (0.3) | 0.7 (0.7) | 0% (0%) | 0.21 (-0.11) |
| lena | 0 (0) | 42 (40) | 271 (54) | 968 (717) | 16.1 (9.2) | 12.3 (6.3) | 0.98 (0.97) | 0.43 (0.1) | 0.27 (0.01) | 0.7 (0.27) | 1.2 (1.1) | 1% (0%) | 0.43 (0.3) |
| snake | 0 (0) | 44 (36) | 60 (59) | 730 (742) | 16.4 (16.6) | 6.5 (6.6) | 0.98 (0.97) | 1.2 (1.22) | 0.42 (0.43) | 0.9 (0.88) | 3.2 (3.2) | 1% (2%) | -0.41 (0.14) |
| flesh | 0 (0) | 28 (54) | 44 (52) | 260 (237) | 5.1 (5) | 6 (6) | 0.99 (0.99) | -0.25 (-0.33) | 0.05 (0.07) | 0.76 (0.57) | 0.4 (0.5) | 0% (0%) | 0.21 (0.14) |
| balls | 26 (30) | 64 (48) | 349 (335) | 4334 (4871) | 131.7 (93.4) | 410.1 (307.6) | 0.9 (0.89) | -0.17 (-0.13) | 0.05 (0.03) | 0.78 (0.26) | 0.8 (0.9) | 0% (0%) | 0.47 (0.34) |
| curves | 0 (2) | 90 (72) | 84 (77) | 732 (728) | 6.8 (51.7) | 6.5 (9) | 0.96 (0.91) | -0.23 (-0.67) | 0.07 (0.12) | 0.8 (0.38) | 0.8 (0.7) | 0% (0%) | -0.09 (0.34) |
| shake | 52 (70) | 72 (70) | 676 (663) | 6031 (6035) | 3.2 (3.2) | 6.4 (6.4) | 0.97 (0.98) | 0.05 (0.05) | 0.01 (0.01) | 0.53 (-0.13) | 1.1 (1.1) | 0% (0%) | 0.08 (-0.07) |
| quake | 8 (10) | 76 (54) | 4211 (4202) | 21527 (21526) | 7.3 (7.3) | 13.5 (13.5) | 0.97 (0.97) | 0.13 (0.13) | 0.04 (0.03) | 0.75 (0.25) | 0.7 (0.9) | 0% (0%) | -0.07 (-0.18) |
| boil | 154 (128) | 76 (82) | 4120 (3196) | 14324 (16078) | 331.7 (302) | 1035.2 (683.5) | 0.75 (0.78) | 0.13 (-0.33) | 0.02 (0.07) | 0.18 (0.25) | 1.1 (1.2) | 1% (1%) | -0.16 (-0.12) |
| thick | 0 (0) | 26 (20) | 36 (34) | 97 (90) | 11.2 (7.2) | 26.1 (23.8) | 0.96 (0.96) | -0.38 (-0.48) | 0.1 (0.07) | 0.77 (0.46) | 1.2 (1.2) | 1% (3%) | 0.31 (0.43) |
| time | 0 (0) | 26 (16) | 64 (41) | 176 (177) | 24.1 (19.3) | 7.6 (15.7) | 0.97 (0.94) | -0.6 (-0.7) | 0.16 (0.18) | 0.44 (0.66) | 1 (1) | 0% (0%) | 0.35 (0.36) |
| groove | 8 (28) | 94 (82) | 208 (207) | 1714 (1850) | 5.7 (4.1) | 110.3 (5.7) | 0.97 (0.96) | -0.02 (-0.05) | 0 (0.01) | 0.53 (-0.54) | 0.7 (0.7) | 0% (0%) | -0.59 (-0.67) |
| silly | 54 (48) | 46 (52) | 1680 (1007) | 29823 (30598) | 226.5 (111.7) | 208.7 (178.6) | 0.93 (0.86) | 0 (1.5) | 0 | -0.66 (-0.77) | 0.5 (0.5) | 0% (0%) | 0.4 (0.45) |
| explosive | 44 (64) | 70 (52) | 481 (571) | 2318 (3869) | 312.7 (227.1) | 791.4 (425) | 0.98 (0.98) | -0.1 (-0.08) | 0.03 (0.02) | 0.42 (0.71) | 1.3 (0.9) | 4% (1%) | 0.11 (0.04) |
| tashi | 0 (0) | 0 (0) | 8 (11) | 254 (255) | 24.6 (17) | 7.8 (6.9) | 0.94 (0.96) | -0.17 (-0.18) | 0.04 (0.04) | -0.27 (0.47) | 0.5 (0.5) | 0% (0%) | 0.09 (-0.12) |
| dolfi | 2 (4) | 48 (48) | 209 (158) | 316 (305) | 88.8 (79.7) | 278.3 (771) | 0.99 (0.99) | -0.23 (-0.22) | 0.04 (0.04) | 0.69 (0.15) | 0.8 (0.8) | 0% (0%) | -0.25 (0.2) |
| snake@0.8 | 0 (0) | 48 (36) | 58 (54) | 752 (747) | 16.7 (16.5) | 6.4 (6.4) | 0.98 (0.98) | 1.22 (1.15) | 0.39 (0.4) | 0.89 (0.95) | 3.6 (3.7) | 2% (4%) | -0.3 (-0.07) |
| snake+float | 0 (8) | 56 (50) | 69 (73) | 732 (754) | 16.7 (15.7) | 10.2 (6.6) | 0.97 (0.97) | 1.32 (1.23) | 0.46 (0.43) | 0.9 (0.89) | 3.6 (3.6) | 8% (7%) | 0.24 (0.22) |
| trans lena>snake | 0 (0) | 45 (57) | 135 (69) | 732 (732) | 12.4 (21.9) | 69.4 (270.1) | 0.94 (0.97) | -1.5 (0.97) | 0.48 (0.13) | 0.79 (0.83) | 1.7 (1.6) | 0% (0%) | -0.2 (-0.21) |
| trans shake>float | 4.5 (24) | 45 (39) | 541 (545) | 1448 (1253) | 9.8 (9.9) | 43.8 (1445.2) | 0.98 (0.97) | 0.05 (0.05) | 0.01 (0.01) | -0.27 (0.37) | 0.8 (0.8) | 0% (1%) | 0.08 (0.11) |
| accents | 15 (18) | 54 (27) | 119 (313) | 1705 (2319) | 652.2 (553.6) | 266 (857.5) | 0.96 (0.94) | -0.08 (-0.15) | 0.02 (0.04) | 0.85 (-0.18) | 0.7 (0.7) | 1% (1%) | 0.38 (0.13) |
| stack4 | 0 (10) | 98 (72) | 251 (71) | 1809 (1764) | 15.1 (11) | 7.8 (191.3) | 0.97 (0.96) | 0.58 (1.03) | 0.21 (0.36) | 0.86 (0.64) | 3 (2.7) | 23% (7%) | 0.33 (0.3) |
| stack4b | 0 (20) | 60 (50) | 159 (173) | 1567 (1473) | 7.3 (8.4) | 17.1 (30) | 0.95 (0.96) | 0.05 (0.02) | 0.01 (0) | 0.65 (0.28) | 1.6 (1.5) | 2% (4%) | 0.53 (0.27) |
| edge dt | 22.1 (9.5) | 37.8 (34.7) | 438 (437) | 1622 (1607) | 33.2 (33) | 59.4 (56.4) | 0.97 (0.96) | 0.04 (0.04) | 0.01 (0.01) | 0.71 (0.37) | 0.9 (0.8) | 0% (0%) | 0.22 (0.09) |

## Grounding, balance, head

| scenario | slide max mm | toe / heel penetration mm | heel lift L/R | steps/min | lifts/min | toe drag mm/min | COM outside % | COM p5 mm | stance knee p5/p50/p95 | head/neck sat | head counter/follow | head p99 deg/s | ACF 0.25-2 s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 1 (0.9) | 0 (0) / 0 | 11%/16% | 6 (4) | 12 (24) | 1 (7) | 1% (2%) | 17 (13) | 9/19.8/47.9 | 7% (6%) | 8%/67% | 58 (120) | 0.26 (0.2) |
| float | 1.1 (0.8) | 0 (0) / 0 | 27%/21% | 12 (22) | 12 (6) | 1 (0) | 2% (6%) | 12 (-4) | 9/22.1/51 | 8% (7%) | 12%/76% | 98 (114) | 0.21 (0.23) |
| lunas | 3 (3.1) | 0 (0) / 0 | 44%/50% | 4 (18) | 30 (20) | 0 (6) | 3% (6%) | 4 (-8) | 9/23.1/49.5 | 10% (7%) | 9%/74% | 83 (75) | 0.26 (0.1) |
| biba | 0.9 (0.8) | 0 (0) / 0 | 19%/22% | 4 (4) | 10 (12) | 0 (1) | 5% (5%) | 0 (5) | 9.6/31/56.3 | 10% (14%) | 1%/85% | 102 (107) | 0.18 (0.16) |
| lena | 0.8 (1) | 0 (0) / 0 | 11%/28% | 10 (8) | 8 (8) | 0 (2) | 3% (1%) | 8 (18) | 9/28.8/50.8 | 1% (8%) | 9%/76% | 80 (99) | 0.35 (0.23) |
| snake | 0.8 (0.9) | 0 (0) / 0 | 30%/12% | 6 (10) | 12 (8) | 0 (0) | 2% (2%) | 18 (13) | 11.7/29.2/53.5 | 6% (7%) | 5%/79% | 77 (129) | 0.22 (0.18) |
| flesh | 0.5 (0.9) | 0 (0) / 0 | 7%/10% | 2 (2) | 8 (12) | 0 (1) | 0% (2%) | 24 (20) | 13.7/25.6/47 | 7% (16%) | 9%/69% | 96 (121) | 0.25 (0.21) |
| balls | 2.2 (2) | 0 (0) / 0 | 16%/29% | 2 (18) | 22 (8) | 0 (3) | 3% (2%) | 8 (16) | 9/20.6/48 | 6% (12%) | 2%/85% | 67 (127) | 0.11 (0.18) |
| curves | 1.1 (1.2) | 0 (0) / 0 | 34%/40% | 20 (12) | 6 (18) | 0 (0) | 6% (4%) | -2 (8) | 9/40.6/71.3 | 11% (10%) | 1%/88% | 126 (95) | 0.12 (0.2) |
| shake | 1.1 (2.2) | 0 (0) / 0 | 17%/23% | 14 (16) | 10 (14) | 0 (1) | 3% (3%) | 11 (11) | 24.7/34.9/56.1 | 0% (0%) | 1%/96% | 144 (155) | 0.33 (0.34) |
| quake | 0.9 (1.9) | 0 (0) / 0 | 18%/25% | 10 (2) | 12 (34) | 0 (5) | 3% (2%) | 5 (20) | 21.4/38.1/62.3 | 4% (7%) | 11%/67% | 135 (171) | 0.55 (0.49) |
| boil | 1.3 (1.1) | 0 (0) / 0 | 21%/12% | 6 (14) | 16 (14) | 0 (0) | 3% (1%) | 6 (16) | 14.4/32.6/55.9 | 9% (2%) | 4%/90% | 229 (241) | 0.14 (0.14) |
| thick | 1 (0.6) | 0 (0) / 0 | 12%/17% | 0 (6) | 10 (4) | 3 (5) | 0% (0%) | 26 (23) | 16.3/28.7/52.1 | 12% (11%) | 2%/95% | 80 (62) | 0.17 (0.23) |
| time | 0.8 (0.6) | 0 (0) / 0 | 16%/12% | 4 (4) | 6 (2) | 0 (0) | 2% (0%) | 16 (27) | 9/21.6/49.2 | 8% (9%) | 1%/93% | 69 (72) | 0.32 (0.26) |
| groove | 1.2 (0.9) | 0 (0) / 0 | 62%/55% | 14 (10) | 10 (6) | 0 (0) | 2% (1%) | 5 (6) | 9/26.9/52.5 | 6% (9%) | 1%/96% | 159 (195) | 0.49 (0.47) |
| silly | 1 (1) | 0 (0) / 0 | 15%/14% | 8 (8) | 8 (46) | 0 (1) | 1% (3%) | 18 (7) | 11.1/26.5/49.4 | 6% (12%) | 18%/69% | 121 (143) | 0.51 (0.53) |
| explosive | 1.1 (9.4) | 0 (0) / 0 | 26%/17% | 8 (8) | 14 (14) | 0 (1) | 2% (4%) | 14 (3) | 9/22.4/49.5 | 7% (3%) | 13%/80% | 281 (256) | 0.15 (0.2) |
| tashi | 3.4 (3.4) | 0 (0) / -0.4 | 0%/0% | 0 (0) | 0 (0) | 0 (0) | 0% (0%) | 82 (81) | 26.9/34.2/37.7 | 8% (2%) | 11%/75% | 90 (68) | 0.59 (0.56) |
| dolfi | 0.9 (0.9) | 0 (0) / 0 | 14%/24% | 6 (6) | 14 (10) | 2 (0) | 5% (3%) | 1 (21) | 9.5/28.3/53.5 | 8% (6%) | 3%/87% | 72 (120) | 0.18 (0.17) |
| snake@0.8 | 1 (0.9) | 0 (0) / 0 | 23%/24% | 8 (8) | 10 (8) | 0 (2) | 2% (1%) | 18 (19) | 17.9/30/54 | 8% (4%) | 4%/87% | 80 (100) | 0.31 (0.14) |
| snake+float | 1.1 (1.3) | 0 (0) / 0 | 16%/31% | 8 (18) | 16 (8) | 0 (2) | 4% (6%) | 7 (-6) | 9/28.7/66.1 | 11% (12%) | 5%/84% | 78 (105) | 0.17 (0.16) |
| trans lena>snake | 1.2 (1) | 0 (0) / 0 | 23%/17% | 12 (15) | 7.5 (7.5) | 0 (0) | 3% (6%) | 15 (-1) | 10/25.2/52.7 | 5% (5%) | 7%/78% | 80 (111) | 0.3 (0.16) |
| trans shake>float | 1 (0.9) | 0 (0) / 0 | 16%/15% | 9 (9) | 12 (13.5) | 5 (3) | 2% (2%) | 16 (16) | 9/28.4/52.7 | 4% (1%) | 4%/88% | 132 (122) | 0.48 (0.46) |
| accents | 1.1 (0.8) | 0 (0) / 0 | 16%/21% | 9 (9) | 12 (9) | 0 (9) | 3% (0%) | 16 (19) | 9/16/46.7 | 0% (18%) | 2%/80% | 83 (153) | 0.15 (0.25) |
| stack4 | 2.6 (3.3) | 0 (0) / 0 | 41%/45% | 16 (22) | 32 (12) | 0 (0) | 5% (8%) | -1 (-30) | 9/32.2/55.6 | 5% (4%) | 3%/87% | 83 (97) | 0.22 (0.1) |
| stack4b | 0.7 (0.9) | 0 (0) / 0 | 71%/71% | 0 (6) | 8 (8) | 2 (4) | 3% (1%) | 4 (4) | 16.8/31.6/45.8 | 0% (1%) | 0%/100% | 126 (109) | 0.17 (0.37) |
| edge dt | 1.2 (0.8) | 0 (0) / 0 | 12%/12% | 3.2 (3.2) | 18.9 (9.5) | 0 (0) | 2% (1%) | 13 (22) | 14.6/29.3/51.1 | 3% (0%) | 4%/86% | 115 (109) | 0.49 (0.49) |

## Events and posture switches

Peak upper-body acceleration in the 3 s after a layer change or accent (or 0.8 s around an internal posture switch), relative to a typical window with no event or switch. Legs: peak leg acceleration in the 3 s after the event, same baseline.

- **idle**: no events; shape/arm switches 10 (20/min), upper peak x1.2 avg (worst x1.54); steps starting within 3 s after a body-shape switch 0% of 3
- **float**: no events; shape/arm switches 13 (26/min), upper peak x1.07 avg (worst x1.45); steps starting within 3 s after a body-shape switch 33% of 6
- **lunas**: no events; shape/arm switches 13 (26/min), upper peak x1.2 avg (worst x1.94); steps starting within 3 s after a body-shape switch 50% of 2
- **biba**: no events; shape/arm switches 3 (6/min), upper peak x1.55 avg (worst x1.85); steps starting within 3 s after a body-shape switch 50% of 2
- **lena**: no events; shape/arm switches 9 (18/min), upper peak x0.95 avg (worst x1.37); steps starting within 3 s after a body-shape switch 20% of 5
- **snake**: no events; shape/arm switches 11 (22/min), upper peak x0.99 avg (worst x1.45); steps starting within 3 s after a body-shape switch 67% of 3
- **flesh**: no events; shape/arm switches 4 (8/min), upper peak x0.94 avg (worst x1.05); steps starting within 3 s after a body-shape switch 0% of 1
- **balls**: no events; shape/arm switches 13 (26/min), upper peak x0.53 avg (worst x1.74); steps starting within 3 s after a body-shape switch 100% of 1
- **curves**: no events; shape/arm switches 12 (24/min), upper peak x1.06 avg (worst x1.52); steps starting within 3 s after a body-shape switch 50% of 10
- **shake**: no events; shape/arm switches 12 (24/min), upper peak x1.13 avg (worst x1.77); steps starting within 3 s after a body-shape switch 43% of 7
- **quake**: no events; shape/arm switches 10 (20/min), upper peak x0.77 avg (worst x1.21); steps starting within 3 s after a body-shape switch 20% of 5
- **boil**: no events; shape/arm switches 9 (18/min), upper peak x0.88 avg (worst x1.59); steps starting within 3 s after a body-shape switch 33% of 3
- **thick**: no events; shape/arm switches 3 (6/min), upper peak x1.03 avg (worst x1.25); steps starting within 3 s after a body-shape switch - of 0
- **time**: no events; shape/arm switches 3 (6/min), upper peak x0.94 avg (worst x0.98); steps starting within 3 s after a body-shape switch 0% of 2
- **groove**: no events; shape/arm switches 12 (24/min), upper peak x1.28 avg (worst x3.52); steps starting within 3 s after a body-shape switch 29% of 7
- **silly**: no events; shape/arm switches 9 (18/min), upper peak x0.13 avg (worst x0.15); steps starting within 3 s after a body-shape switch 50% of 4
- **explosive**: no events; shape/arm switches 9 (18/min), upper peak x0.09 avg (worst x0.13); steps starting within 3 s after a body-shape switch 0% of 4
- **tashi**: no events; shape/arm switches 5 (10/min), upper peak x0.93 avg (worst x1.03); steps starting within 3 s after a body-shape switch - of 0
- **dolfi**: no events; shape/arm switches 5 (10/min), upper peak x1.06 avg (worst x1.82); steps starting within 3 s after a body-shape switch 33% of 3
- **snake@0.8**: no events; shape/arm switches 10 (20/min), upper peak x1.01 avg (worst x1.43); steps starting within 3 s after a body-shape switch 25% of 4
- **snake+float**: no events; shape/arm switches 12 (24/min), upper peak x1.07 avg (worst x1.6); steps starting within 3 s after a body-shape switch 25% of 4
- **trans lena>snake**: lena:0.7 @10.0s upper x1.12 legs x1.07, lena:0 @25.0s upper x1.59 legs x0.5, snake:0.7 @26.0s upper x1.59 legs x0.96; shape/arm switches 18 (27/min), upper peak x1.1 avg (worst x1.95); steps starting within 3 s after a body-shape switch 63% of 8
- **trans shake>float**: shake:0.7 @10.0s upper x1.78 legs x1.01, shake:0 @25.0s upper x3.67 legs x0.09, float:0.7 @26.0s upper x2.43 legs x0.45; shape/arm switches 17 (25.5/min), upper peak x1.01 avg (worst x3.18); steps starting within 3 s after a body-shape switch 67% of 6
- **accents**: !explosive @14.0s upper x119.4 legs x0.05, !explosive @19.0s upper x51.63 legs x0.59, !explosive @24.0s upper x64.53 legs x0.23; shape/arm switches 8 (24/min), upper peak x14.95 avg (worst x112.48); steps starting within 3 s after a body-shape switch 67% of 3
- **stack4**: no events; shape/arm switches 12 (24/min), upper peak x1.21 avg (worst x2.01); steps starting within 3 s after a body-shape switch 38% of 8
- **stack4b**: no events; shape/arm switches 1 (2/min), upper peak x0.89 avg (worst x0.89); steps starting within 3 s after a body-shape switch - of 0
- **edge dt**: no events; shape/arm switches 8 (25.2/min), upper peak x1 avg (worst x2.35); steps starting within 3 s after a body-shape switch 100% of 1

Edge dt: pose change during dt=0 0 deg, during dt=1e-5 0.0006 deg, resume spike x0.11, irregular dt p99 x3.14, dt=0.5 (clamped) spike x0.42, NaN 0.

## Sameness across words

Determinism (idle twice, same hash): true. Mean pairwise cosine of the words' band-power change vs idle (11 body groups x 4 bands): **0.4** (0.41) (1 = every word moves away from idle in the same way).

Same seed, different words: the body shape and both arm postures are identical in **1%** of 0.5 s samples on average across word pairs (body shape alone: 19%).

| word | distance from idle (log10 power) | own generator share of motion | full / gen off / idle mean speed deg/s | same pose as idle |
|---|---|---|---|---|
| float | 0.657 | 2% | 12.9 / 12.6 / 8.72 | 0% |
| lunas | 0.654 | 12% | 16.59 / 14.54 / 8.72 | 0% |
| biba | 0.75 | 43% | 11.96 / 6.79 / 8.72 | 0% |
| lena | 1.313 | 37% | 17.43 / 10.9 / 8.72 | 0% |
| snake | 0.605 | 15% | 11.41 / 9.71 / 8.72 | 0% |
| flesh | 0.533 | 40% | 11.01 / 6.64 / 8.72 | 0% |
| balls | 1.71 | 31% | 15.01 / 10.32 / 8.72 | 0% |
| curves | 0.741 | 32% | 17.08 / 11.63 / 8.72 | 0% |
| shake | 2.854 | 60% | 32.27 / 12.88 / 8.72 | 0% |
| quake | 2.869 | 70% | 31.43 / 9.36 / 8.72 | 0% |
| boil | 2.999 | 27% | 27.01 / 19.82 / 8.72 | 0% |
| thick | 1.202 | 58% | 10.33 / 4.36 / 8.72 | 0% |
| time | 0.86 | 58% | 9.5 / 4 / 8.72 | 0% |
| groove | 2.088 | 70% | 32.97 / 9.85 / 8.72 | 5% |
| silly | 2.601 | 42% | 19.04 / 11.09 / 8.72 | 0% |
| explosive | 2.514 | - | - | 2% |
