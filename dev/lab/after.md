# Motion lab after

2026-10-30T05:40:11.528Z. Fixed dt 1/60, seed 7, soloist, warmup 8 s then 30 s recorded unless noted. Values in brackets: dev/lab/baseline.json.

Snap = joint angular acceleration above 3000 deg/s^2 (velocity change over 50 deg/s inside one frame); snaps/min counts snap events (frames merged within 0.1 s) in the upper body (trunk, neck, head, arms) or the legs and feet. Jerk kurtosis: 3 = smooth Gaussian texture, higher = impulsive. Trunk wave r: mean |peak cross-correlation| of neighbouring spine01..06 lateral bend angles (6 s trend removed); trunk lag: spine01 to spine06 lag (positive = wave travels up); phase on trunk: that lag divided by the wave period (a readable S-wave needs about 0.5); chest>head r: spine06 vs head lateral bend (negative = the head cancels the wave); sagittal amp: mean sagittal wave amplitude per spine joint. Spine sat: share of frames with a spine joint inside the soft-clamp zone (over 75% of its limit).

## Smoothness and connectedness

| scenario | snaps/min upper | snaps/min legs | p99 acc trunk | p99 acc arms | jerk kurt trunk | jerk kurt arms | trunk wave r | trunk lag s (up +) | phase on trunk | chest>head r | sagittal amp deg | spine sat | arm passive r |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 0 (4) | 38 (48) | 47 (296) | 726 (721) | 10.7 (143.9) | 6.8 (6.5) | 0.98 (0.93) | -0.13 (0.03) | 0.03 (0.01) | -0.6 (-0.78) | 0.4 (0.6) | 0% (0%) | -0.14 (0.17) |
| float | 8 (34) | 46 (74) | 66 (603) | 723 (736) | 9.7 (132.2) | 7.5 (8.8) | 0.97 (0.95) | -0.2 (0.07) | 0.06 (0.02) | 0.54 (-0.58) | 0.5 (0.7) | 0% (2%) | 0.27 (0.45) |
| lunas | 0 (12) | 74 (62) | 71 (413) | 1772 (1793) | 6.4 (116.7) | 6.3 (7.2) | 0.98 (0.95) | -0.1 (0.02) | 0.02 (0) | -0.39 (-0.69) | 0.5 (0.5) | 0% (0%) | -0.12 (0.21) |
| biba | 2 (8) | 38 (54) | 84 (334) | 163 (724) | 9.6 (130.7) | 26.7 (6.5) | 0.99 (0.92) | -0.22 (0.03) | 0.04 (0.01) | 0.3 (-0.42) | 0.7 (0.4) | 0% (0%) | -0.1 (0.27) |
| lena | 0 (18) | 40 (62) | 54 (216) | 718 (717) | 9.2 (68.6) | 6.4 (6.6) | 0.97 (0.9) | 0.08 (-1.5) | 0.01 | 0.23 (0.29) | 1.1 (1.1) | 0% (0%) | 0.31 (0.29) |
| snake | 0 (30) | 36 (64) | 52 (363) | 745 (736) | 16.3 (90.6) | 6.4 (6.2) | 0.98 (0.99) | 1.13 (0.57) | 0.4 (0.18) | 0.93 (-0.89) | 3.2 (1.5) | 2% (4%) | -0.06 (-0.09) |
| flesh | 0 (16) | 56 (44) | 52 (396) | 237 (678) | 5 (136.7) | 6 (6.5) | 0.99 (0.91) | -0.33 (0.02) | 0.07 (0) | 0.57 (-0.78) | 0.5 (0.6) | 0% (0%) | 0.18 (-0.09) |
| balls | 24 (56) | 50 (72) | 335 (532) | 4878 (3322) | 93.5 (37) | 309.4 (380.5) | 0.89 (0.73) | -0.13 (0.03) | 0.03 (0.01) | 0.25 (-0.67) | 0.9 (1.1) | 0% (2%) | 0.25 (0.21) |
| curves | 4 (26) | 90 (90) | 73 (377) | 728 (693) | 8.5 (116.8) | 6.8 (6.9) | 0.92 (0.87) | -0.27 (-0.12) | 0.05 (0.04) | 0.44 (-0.75) | 0.7 (1) | 0% (7%) | 0.14 (0.18) |
| shake | 84 (68) | 64 (66) | 663 (698) | 6027 (6073) | 3.2 (3.4) | 6.4 (6.5) | 0.98 (0.97) | 0.05 (0.05) | 0.01 (0.01) | -0.12 (-0.41) | 1.4 (1.6) | 0% (1%) | -0.07 (0.29) |
| quake | 10 (6) | 56 (88) | 4202 (4180) | 21527 (21526) | 7.3 (7.3) | 13.5 (13.5) | 0.97 (0.96) | 0.13 (0.13) | 0.03 (0.03) | 0.25 (-0.5) | 0.9 (0.8) | 0% (0%) | -0.19 (-0.21) |
| boil | 148 (152) | 84 (102) | 3427 (3421) | 16046 (18607) | 332.3 (320.7) | 566.7 (671.5) | 0.76 (0.74) | -0.4 (0.18) | 0.09 (0.06) | 0.15 (-0.58) | 0.9 (1.1) | 1% (2%) | -0.14 (-0.37) |
| thick | 0 (8) | 20 (52) | 34 (155) | 91 (194) | 7.3 (199.5) | 24 (7.2) | 0.96 (0.96) | -0.48 (0.07) | 0.07 (0.01) | 0.47 (-0.92) | 1.2 (0.5) | 3% (0%) | 0.41 (-0.3) |
| time | 0 (2) | 18 (50) | 41 (200) | 176 (722) | 19.3 (266.8) | 16 (6.5) | 0.95 (0.88) | -0.68 (-0.03) | 0.18 (0.01) | 0.67 (-0.86) | 1 (0.5) | 0% (0%) | 0.36 (0.24) |
| groove | 34 (84) | 90 (60) | 209 (284) | 1809 (1815) | 4.7 (39.5) | 5 (10.8) | 0.97 (0.92) | -0.02 (0) | 0 (0) | 0.5 (-0.71) | 0.8 (1) | 0% (1%) | 0.48 (-0.6) |
| silly | 52 (38) | 60 (88) | 1073 (1398) | 29304 (26006) | 173.5 (376.3) | 159.9 (180.4) | 0.87 (0.92) | 1.37 (-0.02) | - | -0.62 (-0.69) | 0.5 (0.7) | 19% (40%) | 0.31 (0.32) |
| explosive | 70 (76) | 50 (58) | 802 (547) | 2098 (3554) | 298.3 (346.3) | 688.7 (197.6) | 0.98 (0.92) | -0.13 (0) | 0.02 (0) | 0.61 (0.34) | 0.9 (0.9) | 1% (0%) | 0.05 (0.05) |
| tashi | 0 | 0 | 11 | 255 | 17 | 6.8 | 0.97 | -0.2 | 0.05 | 0.49 | 0.5 | 0% | -0.05 |
| dolfi | 2 | 48 | 157 | 306 | 79.7 | 771.1 | 0.99 | -0.23 | 0.04 | 0.15 | 0.8 | 0% | 0.2 |
| snake@0.8 | 2 (10) | 36 (76) | 54 (377) | 749 (823) | 16.5 (50.3) | 6.4 (5.4) | 0.98 (1) | 1.15 (0.53) | 0.4 (0.17) | 0.94 (-0.96) | 3.7 (1.6) | 4% (5%) | -0.09 (-0.35) |
| snake+float | 2 (38) | 54 (80) | 73 (549) | 758 (869) | 15.8 (64) | 6.5 (3.1) | 0.97 (0.98) | 1.3 (0.57) | 0.46 (0.18) | 0.9 (-0.82) | 3.7 (1.6) | 6% (5%) | 0.09 (0.5) |
| trans lena>snake | 0 (13.5) | 54 (58.5) | 60 (332) | 732 (730) | 21.2 (104.4) | 298.8 (6.5) | 0.98 (0.99) | 1 (0.5) | 0.13 (0.14) | 0.67 (-0.88) | 1.7 (1) | 1% (4%) | 0.21 (-0.12) |
| trans shake>float | 16.5 (39) | 39 (67.5) | 545 (606) | 1249 (1306) | 9.9 (10.6) | 1353.9 (548.6) | 0.97 (0.95) | 0.05 (0.03) | 0.01 (0.01) | 0.37 (-0.82) | 0.7 (1.2) | 1% (0%) | -0.09 (-0.05) |
| accents | 12 (33) | 27 (75) | 313 (396) | 1620 (2868) | 552.1 (353.9) | 838.5 (361.9) | 0.95 (0.94) | -0.12 (-0.02) | 0.03 (0) | -0.19 (-0.51) | 0.7 (0.6) | 1% (8%) | 0.12 (0.3) |
| stack4 | 18 (20) | 76 (86) | 80 (358) | 1787 (1663) | 45.5 (57.6) | 10.4 (9.4) | 0.93 (0.98) | 1.2 (0.58) | 0.28 (0.19) | 0.63 (-0.74) | 2.6 (1.7) | 31% (2%) | 0.21 (-0.18) |
| stack4b | 30 (26) | 42 (70) | 168 (323) | 1465 (2527) | 6.2 (3.2) | 33.1 (7.9) | 0.94 (0.98) | 0.07 (0.07) | 0.01 (0.01) | -0.41 (-0.46) | 1.5 (0.9) | 3% (0%) | 0.27 (-0.45) |
| edge dt | 6.3 (37.8) | 34.7 (53.6) | 437 (604) | 1608 (1960) | 33 (44.7) | 56.7 (23.9) | 0.96 (0.96) | 0.04 (0.05) | 0.01 (0.02) | -0.37 (-0.75) | 0.8 (1.5) | 0% (20%) | 0.1 (0.5) |

## Grounding, balance, head

| scenario | slide max mm | toe / heel penetration mm | heel lift L/R | steps/min | lifts/min | toe drag mm/min | COM outside % | COM p5 mm | stance knee p5/p50/p95 | head/neck sat | head counter/follow | head p99 deg/s | ACF 0.25-2 s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 1.2 (5.2) | 0 (-24) / 0 | 17%/27% | 8 (8) | 10 (20) | 1 (98) | 1% (19%) | 17 (-37) | 9/19.8/49 | 5% (11%) | 7%/87% | 121 (325) | 0.22 (0.3) |
| float | 1 (6) | 0 (-22.9) / 0 | 21%/17% | 16 (24) | 8 (14) | 5 (286) | 3% (20%) | 12 (-67) | 9/17.3/46.2 | 9% (18%) | 30%/51% | 118 (414) | 0.28 (0.3) |
| lunas | 3.1 (8.2) | 0 (-35.3) / 0 | 36%/44% | 18 (14) | 20 (16) | 6 (706) | 6% (66%) | -8 (-116) | 9/22.5/48.5 | 7% (21%) | 15%/76% | 82 (290) | 0.11 (0.19) |
| biba | 0.8 (5.4) | 0 (-21.7) / 0 | 27%/17% | 4 (2) | 12 (30) | 1 (171) | 5% (15%) | 5 (-42) | 18.4/33.7/59.2 | 14% (10%) | 12%/76% | 110 (386) | 0.16 (0.29) |
| lena | 1 (5.8) | 0 (-21.4) / 0 | 22%/29% | 8 (12) | 8 (24) | 2 (253) | 1% (22%) | 18 (-81) | 9/30.2/55.7 | 7% (18%) | 17%/65% | 98 (423) | 0.23 (0.24) |
| snake | 1.6 (5.7) | 0 (-23.3) / 0 | 20%/15% | 8 (14) | 8 (18) | 2 (289) | 1% (18%) | 19 (-59) | 9/27.1/50.7 | 4% (14%) | 1%/77% | 104 (363) | 0.14 (0.23) |
| flesh | 0.9 (5.3) | 0 (-23.1) / 0 | 20%/23% | 2 (0) | 12 (28) | 1 (93) | 2% (17%) | 19 (-51) | 9/18.7/50.5 | 16% (11%) | 13%/63% | 120 (357) | 0.2 (0.24) |
| balls | 2 (9.1) | 0 (-28) / 0 | 21%/20% | 18 (10) | 8 (26) | 3 (227) | 2% (20%) | 16 (-98) | 9/23.3/48.6 | 11% (10%) | 9%/70% | 129 (408) | 0.17 (0.31) |
| curves | 1.2 (7) | 0 (-28.2) / 0 | 40%/35% | 20 (30) | 16 (20) | 0 (482) | 6% (34%) | -6 (-112) | 9/28.4/70.6 | 7% (14%) | 6%/76% | 112 (368) | 0.16 (0.23) |
| shake | 1.5 (6) | 0 (-22.6) / 0 | 27%/21% | 20 (8) | 12 (28) | 2 (283) | 3% (22%) | 10 (-101) | 24.7/36.7/58.4 | 0% (4%) | 1%/94% | 155 (313) | 0.32 (0.38) |
| quake | 1 (5.7) | 0 (-22.8) / 0 | 21%/9% | 2 (4) | 36 (30) | 5 (227) | 2% (20%) | 20 (-50) | 31.1/39/57.3 | 7% (6%) | 10%/69% | 172 (381) | 0.48 (0.57) |
| boil | 0.7 (5.9) | 0 (-24) / 0 | 15%/18% | 10 (14) | 10 (32) | 5 (416) | 1% (23%) | 16 (-71) | 15.4/30.8/60.9 | 6% (14%) | 4%/91% | 235 (546) | 0.16 (0.21) |
| thick | 0.6 (5.8) | 0 (-22.8) / 0 | 17%/9% | 6 (4) | 4 (26) | 5 (215) | 0% (17%) | 22 (-53) | 24.7/34.3/54.8 | 11% (4%) | 5%/87% | 62 (140) | 0.22 (0.32) |
| time | 0.6 (5.8) | 0 (-23.7) / 0 | 8%/6% | 4 (2) | 2 (26) | 0 (188) | 0% (18%) | 26 (-41) | 9/19.2/29.3 | 8% (6%) | 3%/85% | 72 (235) | 0.29 (0.35) |
| groove | 0.9 (6.8) | 0 (-31.4) / 0 | 84%/82% | 14 (0) | 4 (30) | 0 (560) | 1% (100%) | 6 (-122) | 9/30.9/55.6 | 6% (7%) | 0%/98% | 150 (379) | 0.47 (0.5) |
| silly | 1 (5.8) | 0 (-24.6) / 0 | 23%/23% | 6 (18) | 50 (26) | 4 (281) | 5% (25%) | -1 (-56) | 9/19.4/48.2 | 10% (11%) | 25%/60% | 137 (351) | 0.52 (0.3) |
| explosive | 1 (5.7) | 0 (-21.1) / 0 | 23%/19% | 6 (2) | 32 (30) | 4 (197) | 2% (27%) | 11 (-54) | 9/17.7/46.5 | 3% (6%) | 10%/85% | 273 (385) | 0.18 (0.24) |
| tashi | 3.4 | 0 / -0.4 | 0%/0% | 0 | 0 | 0 | 0% | 81 | 31.7/54.4/62.3 | 2% | 47%/49% | 68 | 0.56 |
| dolfi | 0.9 | 0 / 0 | 27%/13% | 6 | 10 | 0 | 3% | 21 | 9/31.3/54.6 | 6% | 6%/84% | 119 | 0.18 |
| snake@0.8 | 1.2 (5.8) | 0 (-22.2) / 0 | 20%/15% | 8 (8) | 8 (32) | 2 (271) | 1% (21%) | 19 (-57) | 10.1/27.9/51.2 | 4% (5%) | 1%/82% | 104 (273) | 0.14 (0.31) |
| snake+float | 1.3 (5.7) | 0 (-22.7) / 0 | 27%/17% | 20 (22) | 4 (18) | 0 (365) | 5% (19%) | 2 (-58) | 13.7/28.7/59.9 | 8% (11%) | 6%/83% | 103 (436) | 0.12 (0.33) |
| trans lena>snake | 1.1 (5.8) | 0 (-22.3) / 0 | 27%/32% | 9 (13.5) | 9 (18) | 1 (189) | 4% (20%) | 3 (-52) | 9/25.9/67.4 | 7% (7%) | 6%/77% | 103 (366) | 0.15 (0.28) |
| trans shake>float | 0.9 (5.9) | 0 (-23.2) / 0 | 15%/16% | 7.5 (13.5) | 15 (24) | 3 (276) | 2% (23%) | 15 (-59) | 9/20.6/50 | 1% (5%) | 5%/89% | 121 (291) | 0.44 (0.59) |
| accents | 0.8 (5.5) | 0 (-21.5) / 0 | 7%/14% | 9 (15) | 6 (24) | 4 (229) | 0% (21%) | 20 (-75) | 9/18.2/49 | 18% (10%) | 5%/82% | 160 (450) | 0.26 (0.24) |
| stack4 | 2.6 (7.5) | 0 (-34.6) / 0 | 47%/37% | 22 (12) | 0 (32) | 0 (704) | 5% (61%) | -3 (-146) | 15.9/42.2/77.5 | 7% (24%) | 3%/84% | 109 (490) | 0.16 (0.18) |
| stack4b | 0.8 (6.6) | 0 (-30.5) / 0 | 70%/73% | 4 (4) | 6 (18) | 5 (274) | 3% (100%) | 1 (-151) | 29.4/42.2/61.3 | 1% (0%) | 0%/99% | 108 (142) | 0.41 (0.38) |
| edge dt | 0.8 (5.4) | 0 (-17.7) / 0 | 11%/11% | 3.2 (6.3) | 9.5 (18.9) | 1 (140) | 1% (20%) | 22 (-46) | 13.3/23.7/46.3 | 0% (0%) | 5%/88% | 109 (211) | 0.48 (0.63) |

## Events and posture switches

Peak upper-body acceleration in the 3 s after a layer change or accent (or 0.8 s around an internal posture switch), relative to a typical window with no event or switch. Legs: peak leg acceleration in the 3 s after the event, same baseline.

- **idle**: no events; shape/arm switches 14 (28/min), upper peak x1.18 avg (worst x2.37); steps starting within 3 s after a body-shape switch 25% of 4
- **float**: no events; shape/arm switches 15 (30/min), upper peak x1.85 avg (worst x7.21); steps starting within 3 s after a body-shape switch 50% of 8
- **lunas**: no events; shape/arm switches 10 (20/min), upper peak x0.95 avg (worst x1.42); steps starting within 3 s after a body-shape switch 44% of 9
- **biba**: no events; shape/arm switches 5 (10/min), upper peak x1.52 avg (worst x3.08); steps starting within 3 s after a body-shape switch 0% of 2
- **lena**: no events; shape/arm switches 11 (22/min), upper peak x1.36 avg (worst x3.35); steps starting within 3 s after a body-shape switch 25% of 4
- **snake**: no events; shape/arm switches 12 (24/min), upper peak x1.1 avg (worst x1.85); steps starting within 3 s after a body-shape switch 50% of 4
- **flesh**: no events; shape/arm switches 6 (12/min), upper peak x2.05 avg (worst x5.41); steps starting within 3 s after a body-shape switch 0% of 1
- **balls**: no events; shape/arm switches 12 (24/min), upper peak x1.61 avg (worst x3.92); steps starting within 3 s after a body-shape switch 33% of 9
- **curves**: no events; shape/arm switches 11 (22/min), upper peak x1.88 avg (worst x6.97); steps starting within 3 s after a body-shape switch 50% of 10
- **shake**: no events; shape/arm switches 13 (26/min), upper peak x1.03 avg (worst x1.51); steps starting within 3 s after a body-shape switch 40% of 10
- **quake**: no events; shape/arm switches 9 (18/min), upper peak x1.31 avg (worst x2.04); steps starting within 3 s after a body-shape switch 100% of 1
- **boil**: no events; shape/arm switches 12 (24/min), upper peak x2.26 avg (worst x4.8); steps starting within 3 s after a body-shape switch 20% of 5
- **thick**: no events; shape/arm switches 3 (6/min), upper peak x1.11 avg (worst x1.19); steps starting within 3 s after a body-shape switch 33% of 3
- **time**: no events; shape/arm switches 3 (6/min), upper peak x1.36 avg (worst x2.18); steps starting within 3 s after a body-shape switch 50% of 2
- **groove**: no events; shape/arm switches 13 (26/min), upper peak x0.97 avg (worst x1.57); steps starting within 3 s after a body-shape switch 57% of 7
- **silly**: no events; shape/arm switches 13 (26/min), upper peak x2.39 avg (worst x8.74); steps starting within 3 s after a body-shape switch 33% of 3
- **explosive**: no events; shape/arm switches 11 (22/min), upper peak x2.67 avg (worst x5.54); steps starting within 3 s after a body-shape switch 33% of 3
- **tashi**: no events; shape/arm switches 5 (10/min), upper peak x1.19 avg (worst x1.45); steps starting within 3 s after a body-shape switch - of 0
- **dolfi**: no events; shape/arm switches 4 (8/min), upper peak x0.61 avg (worst x1.02); steps starting within 3 s after a body-shape switch 0% of 3
- **snake@0.8**: no events; shape/arm switches 12 (24/min), upper peak x1.08 avg (worst x1.81); steps starting within 3 s after a body-shape switch 50% of 4
- **snake+float**: no events; shape/arm switches 12 (24/min), upper peak x2.37 avg (worst x5.17); steps starting within 3 s after a body-shape switch 30% of 10
- **trans lena>snake**: lena:0.7 @10.0s upper x1.2 legs x1.02, lena:0 @25.0s upper x1.38 legs x0.98, snake:0.7 @26.0s upper x1.38 legs x0.98; shape/arm switches 16 (24/min), upper peak x1.02 avg (worst x1.79); steps starting within 3 s after a body-shape switch 33% of 6
- **trans shake>float**: shake:0.7 @10.0s upper x0.77 legs x1.87, shake:0 @25.0s upper x17.31 legs x0.8, float:0.7 @26.0s upper x1.48 legs x1.04; shape/arm switches 14 (21/min), upper peak x0.44 avg (worst x1.25); steps starting within 3 s after a body-shape switch 40% of 5
- **accents**: !explosive @14.0s upper x80.17 legs x2.44, !explosive @19.0s upper x34.4 legs x0.8, !explosive @24.0s upper x106.21 legs x0.01; shape/arm switches 9 (27/min), upper peak x9.36 avg (worst x73.55); steps starting within 3 s after a body-shape switch 67% of 3
- **stack4**: no events; shape/arm switches 14 (28/min), upper peak x1.57 avg (worst x4.24); steps starting within 3 s after a body-shape switch 18% of 11
- **stack4b**: no events; shape/arm switches 1 (2/min), upper peak x2.08 avg (worst x2.08); steps starting within 3 s after a body-shape switch 0% of 2
- **edge dt**: no events; shape/arm switches 7 (22.1/min), upper peak x0.99 avg (worst x2.9); steps starting within 3 s after a body-shape switch 0% of 1

Edge dt: pose change during dt=0 0 deg, during dt=1e-5 0.0003 deg, resume spike x3.83, irregular dt p99 x2.43, dt=0.5 (clamped) spike x0.45, NaN 0.

## Sameness across words

Determinism (idle twice, same hash): true. Mean pairwise cosine of the words' band-power change vs idle (11 body groups x 4 bands): **0.32** (0.41) (1 = every word moves away from idle in the same way).

Same seed, different words: the body shape and both arm postures are identical in **2%** of 0.5 s samples on average across word pairs (body shape alone: 21%).

| word | distance from idle (log10 power) | own generator share of motion | full / gen off / idle mean speed deg/s | same pose as idle |
|---|---|---|---|---|
| float | 0.511 | -1% | 13.39 / 13.57 / 9.11 | 0% |
| lunas | 0.526 | 22% | 19.59 / 15.19 / 9.11 | 0% |
| biba | 0.689 | 53% | 12.08 / 5.68 / 9.11 | 3% |
| lena | 0.444 | -4% | 10.43 / 10.86 / 9.11 | 0% |
| snake | 0.538 | 9% | 10.77 / 9.8 / 9.11 | 7% |
| flesh | 0.545 | 39% | 11.96 / 7.3 / 9.11 | 0% |
| balls | 1.542 | 30% | 15.3 / 10.74 / 9.11 | 0% |
| curves | 0.682 | 43% | 19.96 / 11.38 / 9.11 | 0% |
| shake | 2.706 | 68% | 32.47 / 10.48 / 9.11 | 0% |
| quake | 2.719 | 68% | 31.05 / 9.86 / 9.11 | 2% |
| boil | 2.861 | 33% | 28.51 / 18.99 / 9.11 | 2% |
| thick | 1.188 | 59% | 9.29 / 3.84 / 9.11 | 0% |
| time | 0.949 | 56% | 8.86 / 3.92 / 9.11 | 0% |
| groove | 1.911 | 69% | 32.61 / 10.09 / 9.11 | 0% |
| silly | 2.445 | 55% | 24.53 / 11.01 / 9.11 | 3% |
| explosive | 2.414 | - | - | 5% |
