# Motion lab final

2026-10-30T05:41:41.286Z. Fixed dt 1/60, seed 7, soloist, warmup 8 s then 30 s recorded unless noted. Values in brackets: dev/lab/baseline.json.

Snap = joint angular acceleration above 3000 deg/s^2 (velocity change over 50 deg/s inside one frame); snaps/min counts snap events (frames merged within 0.1 s) in the upper body (trunk, neck, head, arms) or the legs and feet. Jerk kurtosis: 3 = smooth Gaussian texture, higher = impulsive. Trunk wave r: mean |peak cross-correlation| of neighbouring spine01..06 lateral bend angles (6 s trend removed); trunk lag: spine01 to spine06 lag (positive = wave travels up); phase on trunk: that lag divided by the wave period (a readable S-wave needs about 0.5); chest>head r: spine06 vs head lateral bend (negative = the head cancels the wave); sagittal amp: mean sagittal wave amplitude per spine joint. Spine sat: share of frames with a spine joint inside the soft-clamp zone (over 75% of its limit).

## Smoothness and connectedness

| scenario | snaps/min upper | snaps/min legs | p99 acc trunk | p99 acc arms | jerk kurt trunk | jerk kurt arms | trunk wave r | trunk lag s (up +) | phase on trunk | chest>head r | sagittal amp deg | spine sat | arm passive r |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 0 (4) | 54 (48) | 60 (296) | 726 (721) | 11.2 (143.9) | 6.7 (6.5) | 0.98 (0.93) | -0.15 (0.03) | 0.04 (0.01) | -0.34 (-0.78) | 0.4 (0.6) | 0% (0%) | -0.11 (0.17) |
| float | 10 (34) | 60 (74) | 68 (603) | 789 (736) | 28.3 (132.2) | 14.2 (8.8) | 0.97 (0.95) | -0.12 (0.07) | 0.03 (0.02) | 0.32 (-0.58) | 0.6 (0.7) | 0% (2%) | 0.33 (0.45) |
| lunas | 0 (12) | 72 (62) | 71 (413) | 1771 (1793) | 6.4 (116.7) | 6.2 (7.2) | 0.98 (0.95) | -0.1 (0.02) | 0.02 (0) | -0.38 (-0.69) | 0.5 (0.5) | 0% (0%) | 0.15 (0.21) |
| biba | 0 (8) | 38 (54) | 84 (334) | 163 (724) | 9.6 (130.7) | 27.5 (6.5) | 0.99 (0.92) | -0.23 (0.03) | 0.04 (0.01) | 0.3 (-0.42) | 0.7 (0.4) | 0% (0%) | -0.11 (0.27) |
| lena | 0 (18) | 40 (62) | 54 (216) | 717 (717) | 9.2 (68.6) | 6.3 (6.6) | 0.97 (0.9) | 0.1 (-1.5) | 0.01 | 0.27 (0.29) | 1.1 (1.1) | 0% (0%) | 0.3 (0.29) |
| snake | 0 (30) | 36 (64) | 59 (363) | 742 (736) | 16.6 (90.6) | 6.6 (6.2) | 0.97 (0.99) | 1.22 (0.57) | 0.43 (0.18) | 0.88 (-0.89) | 3.2 (1.5) | 2% (4%) | 0.14 (-0.09) |
| flesh | 0 (16) | 54 (44) | 52 (396) | 237 (678) | 5 (136.7) | 6 (6.5) | 0.99 (0.91) | -0.33 (0.02) | 0.07 (0) | 0.57 (-0.78) | 0.5 (0.6) | 0% (0%) | 0.14 (-0.09) |
| balls | 30 (56) | 48 (72) | 335 (532) | 4871 (3322) | 93.4 (37) | 307.6 (380.5) | 0.89 (0.73) | -0.13 (0.03) | 0.03 (0.01) | 0.26 (-0.67) | 0.9 (1.1) | 0% (2%) | 0.34 (0.21) |
| curves | 2 (26) | 72 (90) | 77 (377) | 728 (693) | 51.7 (116.8) | 9 (6.9) | 0.91 (0.87) | -0.67 (-0.12) | 0.12 (0.04) | 0.38 (-0.75) | 0.7 (1) | 0% (7%) | 0.34 (0.18) |
| shake | 70 (68) | 70 (66) | 663 (698) | 6035 (6073) | 3.2 (3.4) | 6.4 (6.5) | 0.98 (0.97) | 0.05 (0.05) | 0.01 (0.01) | -0.13 (-0.41) | 1.1 (1.6) | 0% (1%) | -0.07 (0.29) |
| quake | 10 (6) | 54 (88) | 4202 (4180) | 21526 (21526) | 7.3 (7.3) | 13.5 (13.5) | 0.97 (0.96) | 0.13 (0.13) | 0.03 (0.03) | 0.25 (-0.5) | 0.9 (0.8) | 0% (0%) | -0.18 (-0.21) |
| boil | 128 (152) | 82 (102) | 3196 (3421) | 16078 (18607) | 302 (320.7) | 683.5 (671.5) | 0.78 (0.74) | -0.33 (0.18) | 0.07 (0.06) | 0.25 (-0.58) | 1.2 (1.1) | 1% (2%) | -0.12 (-0.37) |
| thick | 0 (8) | 20 (52) | 34 (155) | 90 (194) | 7.2 (199.5) | 23.8 (7.2) | 0.96 (0.96) | -0.48 (0.07) | 0.07 (0.01) | 0.46 (-0.92) | 1.2 (0.5) | 3% (0%) | 0.43 (-0.3) |
| time | 0 (2) | 16 (50) | 41 (200) | 177 (722) | 19.3 (266.8) | 15.7 (6.5) | 0.94 (0.88) | -0.7 (-0.03) | 0.18 (0.01) | 0.66 (-0.86) | 1 (0.5) | 0% (0%) | 0.36 (0.24) |
| groove | 28 (84) | 82 (60) | 207 (284) | 1850 (1815) | 4.1 (39.5) | 5.7 (10.8) | 0.96 (0.92) | -0.05 (0) | 0.01 (0) | -0.54 (-0.71) | 0.7 (1) | 0% (1%) | -0.67 (-0.6) |
| silly | 48 (38) | 52 (88) | 1007 (1398) | 30598 (26006) | 111.7 (376.3) | 178.6 (180.4) | 0.86 (0.92) | 1.5 (-0.02) | - | -0.77 (-0.69) | 0.5 (0.7) | 0% (40%) | 0.45 (0.32) |
| explosive | 64 (76) | 52 (58) | 571 (547) | 3869 (3554) | 227.1 (346.3) | 425 (197.6) | 0.98 (0.92) | -0.08 (0) | 0.02 (0) | 0.71 (0.34) | 0.9 (0.9) | 1% (0%) | 0.04 (0.05) |
| tashi | 0 | 0 | 11 | 255 | 17 | 6.9 | 0.96 | -0.18 | 0.04 | 0.47 | 0.5 | 0% | -0.12 |
| dolfi | 4 | 48 | 158 | 305 | 79.7 | 771 | 0.99 | -0.22 | 0.04 | 0.15 | 0.8 | 0% | 0.2 |
| snake@0.8 | 0 (10) | 36 (76) | 54 (377) | 747 (823) | 16.5 (50.3) | 6.4 (5.4) | 0.98 (1) | 1.15 (0.53) | 0.4 (0.17) | 0.95 (-0.96) | 3.7 (1.6) | 4% (5%) | -0.07 (-0.35) |
| snake+float | 8 (38) | 50 (80) | 73 (549) | 754 (869) | 15.7 (64) | 6.6 (3.1) | 0.97 (0.98) | 1.23 (0.57) | 0.43 (0.18) | 0.89 (-0.82) | 3.6 (1.6) | 7% (5%) | 0.22 (0.5) |
| trans lena>snake | 0 (13.5) | 57 (58.5) | 69 (332) | 732 (730) | 21.9 (104.4) | 270.1 (6.5) | 0.97 (0.99) | 0.97 (0.5) | 0.13 (0.14) | 0.83 (-0.88) | 1.6 (1) | 0% (4%) | -0.21 (-0.12) |
| trans shake>float | 24 (39) | 39 (67.5) | 545 (606) | 1253 (1306) | 9.9 (10.6) | 1445.2 (548.6) | 0.97 (0.95) | 0.05 (0.03) | 0.01 (0.01) | 0.37 (-0.82) | 0.8 (1.2) | 1% (0%) | 0.11 (-0.05) |
| accents | 18 (33) | 27 (75) | 313 (396) | 2319 (2868) | 553.6 (353.9) | 857.5 (361.9) | 0.94 (0.94) | -0.15 (-0.02) | 0.04 (0) | -0.18 (-0.51) | 0.7 (0.6) | 1% (8%) | 0.13 (0.3) |
| stack4 | 10 (20) | 72 (86) | 71 (358) | 1764 (1663) | 11 (57.6) | 191.3 (9.4) | 0.96 (0.98) | 1.03 (0.58) | 0.36 (0.19) | 0.64 (-0.74) | 2.7 (1.7) | 7% (2%) | 0.3 (-0.18) |
| stack4b | 20 (26) | 50 (70) | 173 (323) | 1473 (2527) | 8.4 (3.2) | 30 (7.9) | 0.96 (0.98) | 0.02 (0.07) | 0 (0.01) | 0.28 (-0.46) | 1.5 (0.9) | 4% (0%) | 0.27 (-0.45) |
| edge dt | 9.5 (37.8) | 34.7 (53.6) | 437 (604) | 1607 (1960) | 33 (44.7) | 56.4 (23.9) | 0.96 (0.96) | 0.04 (0.05) | 0.01 (0.02) | 0.37 (-0.75) | 0.8 (1.5) | 0% (20%) | 0.09 (0.5) |

## Grounding, balance, head

| scenario | slide max mm | toe / heel penetration mm | heel lift L/R | steps/min | lifts/min | toe drag mm/min | COM outside % | COM p5 mm | stance knee p5/p50/p95 | head/neck sat | head counter/follow | head p99 deg/s | ACF 0.25-2 s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 0.9 (5.2) | 0 (-24) / 0 | 23%/23% | 4 (8) | 24 (20) | 7 (98) | 2% (19%) | 13 (-37) | 9/19.6/48 | 6% (11%) | 7%/75% | 120 (325) | 0.2 (0.3) |
| float | 0.8 (6) | 0 (-22.9) / 0 | 28%/20% | 22 (24) | 6 (14) | 0 (286) | 6% (20%) | -4 (-67) | 9/20.2/47.3 | 7% (18%) | 20%/66% | 114 (414) | 0.23 (0.3) |
| lunas | 3.1 (8.2) | 0 (-35.3) / 0 | 36%/44% | 18 (14) | 20 (16) | 6 (706) | 6% (66%) | -8 (-116) | 9/22.5/48.5 | 7% (21%) | 15%/76% | 75 (290) | 0.1 (0.19) |
| biba | 0.8 (5.4) | 0 (-21.7) / 0 | 27%/17% | 4 (2) | 12 (30) | 1 (171) | 5% (15%) | 5 (-42) | 18.2/33.7/59.2 | 14% (10%) | 12%/76% | 107 (386) | 0.16 (0.29) |
| lena | 1 (5.8) | 0 (-21.4) / 0 | 22%/29% | 8 (12) | 8 (24) | 2 (253) | 1% (22%) | 18 (-81) | 9/30.2/55.7 | 8% (18%) | 17%/65% | 99 (423) | 0.23 (0.24) |
| snake | 0.9 (5.7) | 0 (-23.3) / 0 | 21%/20% | 10 (14) | 8 (18) | 0 (289) | 2% (18%) | 13 (-59) | 9/22.9/50.1 | 7% (14%) | 1%/82% | 129 (363) | 0.18 (0.23) |
| flesh | 0.9 (5.3) | 0 (-23.1) / 0 | 19%/23% | 2 (0) | 12 (28) | 1 (93) | 2% (17%) | 20 (-51) | 9/18.6/50.5 | 16% (11%) | 14%/62% | 121 (357) | 0.21 (0.24) |
| balls | 2 (9.1) | 0 (-28) / 0 | 21%/20% | 18 (10) | 8 (26) | 3 (227) | 2% (20%) | 16 (-98) | 9/23.4/48.6 | 12% (10%) | 10%/70% | 127 (408) | 0.18 (0.31) |
| curves | 1.2 (7) | 0 (-28.2) / 0 | 35%/34% | 12 (30) | 18 (20) | 0 (482) | 4% (34%) | 8 (-112) | 9/28.8/69.2 | 10% (14%) | 6%/77% | 95 (368) | 0.2 (0.23) |
| shake | 2.2 (6) | 0 (-22.6) / 0 | 24%/24% | 16 (8) | 14 (28) | 1 (283) | 3% (22%) | 11 (-101) | 24.4/36/57.6 | 0% (4%) | 1%/94% | 155 (313) | 0.34 (0.38) |
| quake | 1.9 (5.7) | 0 (-22.8) / 0 | 21%/9% | 2 (4) | 34 (30) | 5 (227) | 2% (20%) | 20 (-50) | 31.2/39/57.3 | 7% (6%) | 10%/69% | 171 (381) | 0.49 (0.57) |
| boil | 1.1 (5.9) | 0 (-24) / 0 | 23%/23% | 14 (14) | 14 (32) | 0 (416) | 1% (23%) | 16 (-71) | 23.1/49.7/62.6 | 2% (14%) | 5%/90% | 241 (546) | 0.14 (0.21) |
| thick | 0.6 (5.8) | 0 (-22.8) / 0 | 17%/9% | 6 (4) | 4 (26) | 5 (215) | 0% (17%) | 23 (-53) | 24.7/34.3/54.7 | 11% (4%) | 5%/88% | 62 (140) | 0.23 (0.32) |
| time | 0.6 (5.8) | 0 (-23.7) / 0 | 8%/6% | 4 (2) | 2 (26) | 0 (188) | 0% (18%) | 27 (-41) | 9/19.2/29.3 | 9% (6%) | 3%/86% | 72 (235) | 0.26 (0.35) |
| groove | 0.9 (6.8) | 0 (-31.4) / 0 | 79%/72% | 10 (0) | 6 (30) | 0 (560) | 1% (100%) | 6 (-122) | 9/28.1/53.2 | 9% (7%) | 2%/90% | 195 (379) | 0.47 (0.5) |
| silly | 1 (5.8) | 0 (-24.6) / 0 | 20%/19% | 8 (18) | 46 (26) | 1 (281) | 3% (25%) | 7 (-56) | 9/17.6/47.5 | 12% (11%) | 26%/59% | 143 (351) | 0.53 (0.3) |
| explosive | 9.4 (5.7) | 0 (-21.1) / 0 | 17%/21% | 8 (2) | 14 (30) | 1 (197) | 4% (27%) | 3 (-54) | 9/17.9/46.4 | 3% (6%) | 20%/69% | 256 (385) | 0.2 (0.24) |
| tashi | 3.4 | 0 / -0.4 | 0%/0% | 0 | 0 | 0 | 0% | 81 | 31.7/54.4/62.3 | 2% | 46%/50% | 68 | 0.56 |
| dolfi | 0.9 | 0 / 0 | 27%/13% | 6 | 10 | 0 | 3% | 21 | 9/31.3/54.6 | 6% | 6%/84% | 120 | 0.17 |
| snake@0.8 | 0.9 (5.8) | 0 (-22.2) / 0 | 20%/15% | 8 (8) | 8 (32) | 2 (271) | 1% (21%) | 19 (-57) | 9.8/27.9/51.1 | 4% (5%) | 1%/83% | 100 (273) | 0.14 (0.31) |
| snake+float | 1.3 (5.7) | 0 (-22.7) / 0 | 27%/17% | 18 (22) | 8 (18) | 2 (365) | 6% (19%) | -6 (-58) | 9/24.9/49.9 | 12% (11%) | 6%/79% | 105 (436) | 0.16 (0.33) |
| trans lena>snake | 1 (5.8) | 0 (-22.3) / 0 | 25%/32% | 15 (13.5) | 7.5 (18) | 0 (189) | 6% (20%) | -1 (-52) | 9/28/67.5 | 5% (7%) | 4%/85% | 111 (366) | 0.16 (0.28) |
| trans shake>float | 0.9 (5.9) | 0 (-23.2) / 0 | 14%/16% | 9 (13.5) | 13.5 (24) | 3 (276) | 2% (23%) | 16 (-59) | 9/20.5/49.4 | 1% (5%) | 5%/89% | 122 (291) | 0.46 (0.59) |
| accents | 0.8 (5.5) | 0 (-21.5) / 0 | 7%/13% | 9 (15) | 9 (24) | 9 (229) | 0% (21%) | 19 (-75) | 9/18.2/48.8 | 18% (10%) | 6%/83% | 153 (450) | 0.25 (0.24) |
| stack4 | 3.3 (7.5) | 0 (-34.6) / 0 | 43%/36% | 22 (12) | 12 (32) | 0 (704) | 8% (61%) | -30 (-146) | 15.1/41.3/78.2 | 4% (24%) | 4%/72% | 97 (490) | 0.1 (0.18) |
| stack4b | 0.9 (6.6) | 0 (-30.5) / 0 | 81%/85% | 6 (4) | 8 (18) | 4 (274) | 1% (100%) | 4 (-151) | 31.2/42.6/61.2 | 1% (0%) | 0%/99% | 109 (142) | 0.37 (0.38) |
| edge dt | 0.8 (5.4) | 0 (-17.7) / 0 | 11%/11% | 3.2 (6.3) | 9.5 (18.9) | 0 (140) | 1% (20%) | 22 (-46) | 13.3/23.7/46.3 | 0% (0%) | 5%/87% | 109 (211) | 0.49 (0.63) |

## Events and posture switches

Peak upper-body acceleration in the 3 s after a layer change or accent (or 0.8 s around an internal posture switch), relative to a typical window with no event or switch. Legs: peak leg acceleration in the 3 s after the event, same baseline.

- **idle**: no events; shape/arm switches 12 (24/min), upper peak x1.19 avg (worst x1.84); steps starting within 3 s after a body-shape switch 0% of 2
- **float**: no events; shape/arm switches 14 (28/min), upper peak x2.77 avg (worst x8.67); steps starting within 3 s after a body-shape switch 45% of 11
- **lunas**: no events; shape/arm switches 10 (20/min), upper peak x0.95 avg (worst x1.42); steps starting within 3 s after a body-shape switch 44% of 9
- **biba**: no events; shape/arm switches 5 (10/min), upper peak x1.11 avg (worst x1.62); steps starting within 3 s after a body-shape switch 0% of 2
- **lena**: no events; shape/arm switches 11 (22/min), upper peak x1.34 avg (worst x3.56); steps starting within 3 s after a body-shape switch 50% of 4
- **snake**: no events; shape/arm switches 11 (22/min), upper peak x1.17 avg (worst x2.36); steps starting within 3 s after a body-shape switch 60% of 5
- **flesh**: no events; shape/arm switches 6 (12/min), upper peak x2.15 avg (worst x5.31); steps starting within 3 s after a body-shape switch 0% of 1
- **balls**: no events; shape/arm switches 12 (24/min), upper peak x1.87 avg (worst x4.11); steps starting within 3 s after a body-shape switch 33% of 9
- **curves**: no events; shape/arm switches 10 (20/min), upper peak x1.87 avg (worst x5.24); steps starting within 3 s after a body-shape switch 50% of 6
- **shake**: no events; shape/arm switches 12 (24/min), upper peak x0.93 avg (worst x1.4); steps starting within 3 s after a body-shape switch 25% of 8
- **quake**: no events; shape/arm switches 9 (18/min), upper peak x1.32 avg (worst x2.07); steps starting within 3 s after a body-shape switch 100% of 1
- **boil**: no events; shape/arm switches 12 (24/min), upper peak x2.56 avg (worst x5.47); steps starting within 3 s after a body-shape switch 43% of 7
- **thick**: no events; shape/arm switches 3 (6/min), upper peak x0.91 avg (worst x1.02); steps starting within 3 s after a body-shape switch 33% of 3
- **time**: no events; shape/arm switches 3 (6/min), upper peak x2.49 avg (worst x5.61); steps starting within 3 s after a body-shape switch 50% of 2
- **groove**: no events; shape/arm switches 16 (32/min), upper peak x1.15 avg (worst x1.82); steps starting within 3 s after a body-shape switch 60% of 5
- **silly**: no events; shape/arm switches 12 (24/min), upper peak x2.68 avg (worst x11.17); steps starting within 3 s after a body-shape switch 25% of 4
- **explosive**: no events; shape/arm switches 12 (24/min), upper peak x4.83 avg (worst x13.75); steps starting within 3 s after a body-shape switch 25% of 4
- **tashi**: no events; shape/arm switches 5 (10/min), upper peak x1.19 avg (worst x1.46); steps starting within 3 s after a body-shape switch - of 0
- **dolfi**: no events; shape/arm switches 4 (8/min), upper peak x0.5 avg (worst x0.87); steps starting within 3 s after a body-shape switch 0% of 3
- **snake@0.8**: no events; shape/arm switches 12 (24/min), upper peak x1.18 avg (worst x2.86); steps starting within 3 s after a body-shape switch 50% of 4
- **snake+float**: no events; shape/arm switches 14 (28/min), upper peak x2.78 avg (worst x6.41); steps starting within 3 s after a body-shape switch 33% of 9
- **trans lena>snake**: lena:0.7 @10.0s upper x1.43 legs x1.02, lena:0 @25.0s upper x1.99 legs x0.67, snake:0.7 @26.0s upper x1.99 legs x0.58; shape/arm switches 16 (24/min), upper peak x1.08 avg (worst x2.51); steps starting within 3 s after a body-shape switch 60% of 10
- **trans shake>float**: shake:0.7 @10.0s upper x0.57 legs x1.86, shake:0 @25.0s upper x9.02 legs x0.8, float:0.7 @26.0s upper x1.1 legs x1.03; shape/arm switches 14 (21/min), upper peak x0.47 avg (worst x1.24); steps starting within 3 s after a body-shape switch 50% of 6
- **accents**: !explosive @14.0s upper x80.3 legs x2.17, !explosive @19.0s upper x31.31 legs x0.75, !explosive @24.0s upper x80.61 legs x0.02; shape/arm switches 9 (27/min), upper peak x10.11 avg (worst x80.3); steps starting within 3 s after a body-shape switch 67% of 3
- **stack4**: no events; shape/arm switches 14 (28/min), upper peak x1.17 avg (worst x2.35); steps starting within 3 s after a body-shape switch 27% of 11
- **stack4b**: no events; shape/arm switches 1 (2/min), upper peak x0.87 avg (worst x0.87); steps starting within 3 s after a body-shape switch 0% of 3
- **edge dt**: no events; shape/arm switches 7 (22.1/min), upper peak x0.76 avg (worst x1.67); steps starting within 3 s after a body-shape switch 0% of 1

Edge dt: pose change during dt=0 0 deg, during dt=1e-5 0.0003 deg, resume spike x3.66, irregular dt p99 x1.7, dt=0.5 (clamped) spike x0.45, NaN 0.

## Sameness across words

Determinism (idle twice, same hash): true. Mean pairwise cosine of the words' band-power change vs idle (11 body groups x 4 bands): **0.41** (0.41) (1 = every word moves away from idle in the same way).

Same seed, different words: the body shape and both arm postures are identical in **1%** of 0.5 s samples on average across word pairs (body shape alone: 17%).

| word | distance from idle (log10 power) | own generator share of motion | full / gen off / idle mean speed deg/s | same pose as idle |
|---|---|---|---|---|
| float | 0.787 | 9% | 14.67 / 13.36 / 11.07 | 0% |
| lunas | 0.467 | 22% | 19.72 / 15.32 / 11.07 | 0% |
| biba | 0.731 | 51% | 12.1 / 5.88 / 11.07 | 3% |
| lena | 0.437 | -4% | 10.55 / 10.98 / 11.07 | 0% |
| snake | 0.522 | 12% | 11.23 / 9.92 / 11.07 | 0% |
| flesh | 0.616 | 49% | 11.97 / 6.05 / 11.07 | 2% |
| balls | 1.566 | 30% | 15.42 / 10.79 / 11.07 | 0% |
| curves | 0.98 | 31% | 18.07 / 12.53 / 11.07 | 0% |
| shake | 2.713 | 68% | 32.54 / 10.54 / 11.07 | 0% |
| quake | 2.724 | 69% | 31.11 / 9.6 / 11.07 | 2% |
| boil | 2.849 | 34% | 29.25 / 19.25 / 11.07 | 2% |
| thick | 1.243 | 59% | 9.42 / 3.89 / 11.07 | 0% |
| time | 1.033 | 56% | 9 / 3.96 / 11.07 | 0% |
| groove | 1.925 | 69% | 34.8 / 10.71 / 11.07 | 0% |
| silly | 2.54 | 53% | 23.54 / 11.13 / 11.07 | 3% |
| explosive | 2.388 | - | - | 3% |
