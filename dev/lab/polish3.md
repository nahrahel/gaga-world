# Motion lab polish3

2026-10-30T14:45:39.371Z. Fixed dt 1/60, seed 7, soloist, warmup 8 s then 30 s recorded unless noted. Values in brackets: dev/lab/polish.json.

Snap = joint angular acceleration above 3000 deg/s^2 (velocity change over 50 deg/s inside one frame); snaps/min counts snap events (frames merged within 0.1 s) in the upper body (trunk, neck, head, arms) or the legs and feet. Jerk kurtosis: 3 = smooth Gaussian texture, higher = impulsive. Trunk wave r: mean |peak cross-correlation| of neighbouring spine01..06 lateral bend angles (6 s trend removed); trunk lag: spine01 to spine06 lag (positive = wave travels up); phase on trunk: that lag divided by the wave period (a readable S-wave needs about 0.5); chest>head r: spine06 vs head lateral bend (negative = the head cancels the wave); sagittal amp: mean sagittal wave amplitude per spine joint. Spine sat: share of frames with a spine joint inside the soft-clamp zone (over 75% of its limit).

## Smoothness and connectedness

| scenario | snaps/min upper | snaps/min legs | p99 acc trunk | p99 acc arms | jerk kurt trunk | jerk kurt arms | trunk wave r | trunk lag s (up +) | phase on trunk | chest>head r | sagittal amp deg | spine sat | arm passive r |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 0 (0) | 32 (34) | 53 (47) | 688 (721) | 9.3 (9.7) | 6.5 (7.1) | 0.97 (0.98) | -0.1 (-0.12) | 0.02 (0.03) | 0.82 (0.56) | 0.6 (0.4) | 0% (0%) | -0.18 (0.08) |
| float | 0 (0) | 60 (54) | 67 (61) | 599 (713) | 27 (13.4) | 34.5 (7.6) | 0.99 (0.97) | 0.35 (-0.03) | 0.05 (0.01) | 0.85 (0.36) | 1.2 (0.7) | 29% (0%) | 0.2 (0.31) |
| lunas | 0 (0) | 44 (66) | 57 (53) | 1663 (1810) | 7.5 (25.4) | 6.1 (6.3) | 0.97 (0.98) | -0.08 (-0.17) | 0.01 (0.04) | 0.8 (0.34) | 0.6 (0.6) | 0% (0%) | -0.19 (0.21) |
| biba | 0 (0) | 32 (42) | 81 (87) | 160 (165) | 8.7 (8.4) | 17.3 (21) | 0.99 (0.99) | -0.2 (-0.15) | 0.04 (0.03) | 0.92 (0.48) | 0.8 (0.7) | 0% (0%) | 0.18 (0.21) |
| lena | 0 (0) | 50 (42) | 273 (271) | 883 (968) | 16.8 (16.1) | 12.3 (12.3) | 0.98 (0.98) | 0.42 (0.43) | 0.26 (0.27) | 0.9 (0.7) | 1.2 (1.2) | 1% (1%) | 0.38 (0.43) |
| snake | 0 (0) | 34 (44) | 68 (60) | 731 (730) | 16.5 (16.4) | 6.3 (6.5) | 0.98 (0.98) | 1.07 (1.2) | 0.38 (0.42) | 0.95 (0.9) | 3.1 (3.2) | 4% (1%) | -0.25 (-0.41) |
| flesh | 0 (0) | 34 (28) | 44 (44) | 249 (260) | 4.8 (5.1) | 6 (6) | 0.99 (0.99) | -0.2 (-0.25) | 0.04 (0.05) | 0.93 (0.76) | 0.6 (0.4) | 0% (0%) | 0.17 (0.21) |
| balls | 28 (26) | 46 (64) | 328 (349) | 3942 (4334) | 119.5 (131.7) | 268.7 (410.1) | 0.88 (0.9) | -0.1 (-0.17) | 0.03 (0.05) | 0.77 (0.78) | 0.9 (0.8) | 0% (0%) | 0.41 (0.47) |
| curves | 0 (0) | 62 (90) | 88 (84) | 698 (732) | 6.6 (6.8) | 6.7 (6.5) | 0.96 (0.96) | -0.33 (-0.23) | 0.1 (0.07) | 0.85 (0.8) | 0.9 (0.8) | 0% (0%) | 0.24 (-0.09) |
| shake | 50 (52) | 64 (72) | 682 (676) | 6043 (6031) | 3.2 (3.2) | 6.4 (6.4) | 0.97 (0.97) | 0.05 (0.05) | 0.01 (0.01) | 0.41 (0.53) | 1.1 (1.1) | 0% (0%) | 0.06 (0.08) |
| quake | 8 (8) | 76 (76) | 4209 (4211) | 21520 (21527) | 7.3 (7.3) | 13.5 (13.5) | 0.97 (0.97) | 0.13 (0.13) | 0.03 (0.04) | 0.81 (0.75) | 0.8 (0.7) | 0% (0%) | -0.07 (-0.07) |
| boil | 154 (154) | 78 (76) | 4057 (4120) | 15796 (14324) | 312.8 (331.7) | 624.5 (1035.2) | 0.77 (0.75) | -0.4 (0.13) | 0.08 (0.02) | 0.39 (0.18) | 1 (1.1) | 1% (1%) | 0.18 (-0.16) |
| thick | 0 (0) | 32 (26) | 37 (36) | 110 (97) | 19.6 (11.2) | 134.4 (26.1) | 0.97 (0.96) | -0.57 (-0.38) | 0.1 (0.1) | 0.94 (0.77) | 1.2 (1.2) | 0% (1%) | 0.35 (0.31) |
| time | 0 (0) | 32 (26) | 53 (64) | 161 (176) | 24 (24.1) | 12.5 (7.6) | 0.96 (0.97) | -0.43 (-0.6) | 0.11 (0.16) | 0.97 (0.44) | 1.1 (1) | 0% (0%) | 0.31 (0.35) |
| groove | 2 (8) | 88 (94) | 203 (208) | 1750 (1714) | 24.4 (5.7) | 44.4 (110.3) | 0.96 (0.97) | 0.02 (-0.02) | 0 (0) | 0.86 (0.53) | 0.7 (0.7) | 0% (0%) | -0.52 (-0.59) |
| silly | 58 (54) | 50 (46) | 1652 (1680) | 27505 (29823) | 115.6 (226.5) | 162.8 (208.7) | 0.89 (0.93) | 0.15 (0) | 0.05 (0) | -0.71 (-0.66) | 0.6 (0.5) | 35% (0%) | 0.25 (0.4) |
| explosive | 56 (44) | 48 (70) | 605 (481) | 1950 (2318) | 253.6 (312.7) | 610.6 (791.4) | 0.98 (0.98) | -0.07 (-0.1) | 0.01 (0.03) | 0.63 (0.42) | 1.4 (1.3) | 4% (4%) | 0.05 (0.11) |
| tashi | 0 (0) | 0 (0) | 11 (8) | 248 (254) | 10.8 (24.6) | 6.4 (7.8) | 0.96 (0.94) | 0.27 (-0.17) | 0.03 (0.04) | 0.83 (-0.27) | 0.5 (0.5) | 0% (0%) | -0.09 (0.09) |
| dolfi | 2 (2) | 44 (48) | 208 (209) | 316 (316) | 90.1 (88.8) | 277.3 (278.3) | 0.98 (0.99) | -0.27 (-0.23) | 0.05 (0.04) | 0.91 (0.69) | 0.9 (0.8) | 0% (0%) | 0.21 (-0.25) |
| snake@0.8 | 0 (0) | 44 (48) | 62 (58) | 719 (752) | 16.3 (16.7) | 6.3 (6.4) | 0.97 (0.98) | 1.23 (1.22) | 0.43 (0.39) | 0.95 (0.89) | 3.6 (3.6) | 5% (2%) | -0.16 (-0.3) |
| snake+float | 0 (0) | 50 (56) | 62 (69) | 647 (732) | 21.7 (16.7) | 9.6 (10.2) | 0.97 (0.97) | 0.98 (1.32) | 0.35 (0.46) | 0.87 (0.9) | 3.5 (3.6) | 32% (8%) | 0.2 (0.24) |
| trans lena>snake | 0 (0) | 43.5 (45) | 128 (135) | 717 (732) | 12.3 (12.4) | 69.9 (69.4) | 0.97 (0.94) | 0.72 (-1.5) | 0.17 (0.48) | 0.9 (0.79) | 1.7 (1.7) | 2% (0%) | -0.22 (-0.2) |
| trans shake>float | 1.5 (4.5) | 46.5 (45) | 542 (541) | 1460 (1448) | 9.8 (9.8) | 57.8 (43.8) | 0.97 (0.98) | 0.08 (0.05) | 0.02 (0.01) | 0.76 (-0.27) | 1 (0.8) | 10% (0%) | 0.09 (0.08) |
| accents | 18 (15) | 57 (54) | 173 (119) | 825 (1705) | 1334.9 (652.2) | 434.8 (266) | 0.99 (0.96) | 0.35 (-0.08) | 0.05 (0.02) | 0.81 (0.85) | 0.9 (0.7) | 9% (1%) | -0.19 (0.38) |
| stack4 | 0 (0) | 78 (98) | 243 (251) | 1405 (1809) | 66.2 (15.1) | 20.4 (7.8) | 0.97 (0.97) | 0.53 (0.58) | 0.19 (0.21) | 0.86 (0.86) | 2.8 (3) | 39% (23%) | 0.24 (0.33) |
| stack4b | 0 (0) | 38 (60) | 161 (159) | 1531 (1567) | 6.5 (7.3) | 43.1 (17.1) | 0.95 (0.95) | 0.03 (0.05) | 0.01 (0.01) | 0.66 (0.65) | 1.6 (1.6) | 2% (2%) | 0.44 (0.53) |
| edge dt | 0 (22.1) | 66.2 (37.8) | 431 (438) | 1586 (1622) | 33.7 (33.2) | 37.5 (59.4) | 0.98 (0.97) | 0.09 (0.04) | 0.02 (0.01) | 0.71 (0.71) | 1.5 (0.9) | 15% (0%) | 0.06 (0.22) |

## Grounding, balance, head

| scenario | slide max mm | toe / heel penetration mm | heel lift L/R | steps/min | lifts/min | toe drag mm/min | COM outside % | COM p5 mm | stance knee p5/p50/p95 | head/neck sat | head counter/follow | head p99 deg/s | ACF 0.25-2 s |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 1 (1) | 0 (0) / 0 | 17%/21% | 6 (6) | 10 (12) | 0 (1) | 1% (1%) | 10 (17) | 9/18.8/47.9 | 7% (7%) | 14%/63% | 60 (58) | 0.23 (0.26) |
| float | 0.9 (1.1) | 0 (0) / 0 | 37%/36% | 16 (12) | 6 (12) | 0 (1) | 3% (2%) | 8 (12) | 9/25.7/57 | 3% (8%) | 2%/86% | 80 (98) | 0.12 (0.21) |
| lunas | 3.2 (3) | 0 (0) / 0 | 41%/39% | 8 (4) | 12 (30) | 3 (0) | 2% (3%) | 7 (4) | 9.7/23/51.5 | 6% (10%) | 23%/52% | 74 (83) | 0.19 (0.26) |
| biba | 0.8 (0.9) | 0 (0) / 0 | 26%/17% | 4 (4) | 12 (10) | 0 (0) | 3% (5%) | 9 (0) | 9.7/35/58.4 | 13% (10%) | 4%/84% | 87 (102) | 0.21 (0.18) |
| lena | 0.8 (0.8) | 0 (0) / 0 | 11%/28% | 10 (10) | 8 (8) | 0 (0) | 3% (3%) | 10 (8) | 9/28.5/50.7 | 1% (1%) | 8%/71% | 80 (80) | 0.35 (0.35) |
| snake | 0.9 (0.8) | 0 (0) / 0 | 16%/26% | 10 (6) | 8 (12) | 0 (0) | 3% (2%) | 5 (18) | 11.9/32.9/58.8 | 4% (6%) | 5%/79% | 80 (77) | 0.39 (0.22) |
| flesh | 0.7 (0.5) | 0 (0) / 0 | 10%/12% | 2 (2) | 8 (8) | 0 (0) | 0% (0%) | 11 (24) | 9/24.6/47 | 8% (7%) | 14%/65% | 96 (96) | 0.2 (0.25) |
| balls | 2.1 (2.2) | 0 (0) / 0 | 24%/34% | 2 (2) | 18 (22) | 1 (0) | 2% (3%) | 10 (8) | 9/21.3/48.3 | 6% (6%) | 4%/81% | 70 (67) | 0.12 (0.11) |
| curves | 1 (1.1) | 0 (0) / 0 | 32%/45% | 18 (20) | 8 (6) | 0 (0) | 2% (6%) | 8 (-2) | 9/38.1/70.5 | 5% (11%) | 2%/91% | 79 (126) | 0.15 (0.12) |
| shake | 1.1 (1.1) | 0 (0) / 0 | 20%/22% | 18 (14) | 8 (10) | 1 (0) | 2% (3%) | 13 (11) | 20.2/33.8/54.9 | 0% (0%) | 1%/96% | 143 (144) | 0.3 (0.33) |
| quake | 1 (0.9) | 0 (0) / 0 | 21%/28% | 10 (10) | 12 (12) | 1 (0) | 2% (3%) | 9 (5) | 25.1/38.4/62.7 | 4% (4%) | 10%/68% | 140 (135) | 0.58 (0.55) |
| boil | 1.1 (1.3) | 0 (0) / 0 | 12%/14% | 4 (6) | 12 (16) | 0 (0) | 1% (3%) | 13 (6) | 20.4/32/52 | 2% (9%) | 5%/88% | 245 (229) | 0.09 (0.14) |
| thick | 0.8 (1) | 0 (0) / 0 | 24%/34% | 6 (0) | 6 (10) | 0 (3) | 3% (0%) | 8 (26) | 9/26.2/61.7 | 11% (12%) | 0%/98% | 63 (80) | 0.14 (0.17) |
| time | 0.6 (0.8) | 0 (0) / 0 | 36%/25% | 2 (4) | 6 (6) | 0 (0) | 1% (2%) | 11 (16) | 9/19.7/51.1 | 7% (8%) | 1%/87% | 71 (69) | 0.29 (0.32) |
| groove | 1.1 (1.2) | 0 (0) / 0 | 68%/73% | 14 (14) | 8 (10) | 0 (0) | 3% (2%) | 3 (5) | 9.7/29.3/53.1 | 6% (6%) | 0%/98% | 151 (159) | 0.45 (0.49) |
| silly | 1.1 (1) | 0 (0) / 0 | 20%/18% | 6 (8) | 10 (8) | 0 (0) | 2% (1%) | 8 (18) | 9/23.5/47.5 | 13% (6%) | 13%/73% | 125 (121) | 0.31 (0.51) |
| explosive | 1.2 (1.1) | 0 (0) / 0 | 29%/30% | 4 (8) | 14 (14) | 0 (0) | 1% (2%) | 14 (14) | 9/21.1/48.9 | 5% (7%) | 18%/71% | 287 (281) | 0.09 (0.15) |
| tashi | 3.4 (3.4) | 0 (0) / 0 | 0%/0% | 0 (0) | 0 (0) | 0 (0) | 0% (0%) | 75 (82) | 27.2/34/38.3 | 7% (8%) | 12%/69% | 90 (90) | 0.59 (0.59) |
| dolfi | 0.8 (0.9) | 0 (0) / 0 | 16%/24% | 6 (6) | 14 (14) | 0 (2) | 4% (5%) | 4 (1) | 9.6/27.1/53.5 | 8% (8%) | 3%/87% | 70 (72) | 0.22 (0.18) |
| snake@0.8 | 1 (1) | 0 (0) / 0 | 27%/29% | 8 (8) | 10 (10) | 0 (0) | 2% (2%) | 7 (18) | 15.1/29.1/53.2 | 8% (8%) | 5%/85% | 79 (80) | 0.33 (0.31) |
| snake+float | 1.2 (1.1) | 0 (0) / 0 | 32%/16% | 14 (8) | 12 (16) | 1 (0) | 4% (4%) | 7 (7) | 9/25.4/54.5 | 4% (11%) | 3%/89% | 81 (78) | 0.16 (0.17) |
| trans lena>snake | 1.3 (1.2) | 0 (0) / 0 | 17%/24% | 13.5 (12) | 6 (7.5) | 0 (0) | 2% (3%) | 8 (15) | 9.7/26.6/62.3 | 5% (5%) | 11%/73% | 75 (80) | 0.32 (0.3) |
| trans shake>float | 1 (1) | 0 (0) / 0 | 31%/24% | 10.5 (9) | 7.5 (12) | 0 (5) | 3% (2%) | 8 (16) | 9/26.7/52 | 4% (4%) | 9%/83% | 132 (132) | 0.48 (0.48) |
| accents | 0.8 (1.1) | 0 (0) / 0 | 39%/23% | 12 (9) | 9 (12) | 1 (0) | 3% (3%) | 10 (16) | 9/17.9/48.1 | 0% (0%) | 10%/71% | 68 (83) | 0.21 (0.15) |
| stack4 | 3.2 (2.6) | 0 (0) / 0 | 51%/34% | 10 (16) | 16 (32) | 0 (0) | 2% (5%) | 7 (-1) | 9/34.5/72.5 | 4% (5%) | 5%/85% | 99 (83) | 0.2 (0.22) |
| stack4b | 0.7 (0.7) | 0 (0) / 0 | 77%/76% | 4 (0) | 4 (8) | 3 (2) | 5% (3%) | 0 (4) | 16.8/32.4/52.7 | 2% (0%) | 0%/99% | 110 (126) | 0.4 (0.17) |
| edge dt | 1.5 (1.2) | 0 (0) / 0 | 26%/17% | 3.2 (3.2) | 15.8 (18.9) | 4 (0) | 3% (2%) | 10 (13) | 9/24.3/52.8 | 0% (3%) | 3%/90% | 109 (115) | 0.39 (0.49) |

## Hands near the head

Share of frames in which either hand's knuckle point is within 0.18 m of the head point (rig.js face opener points). Target 3% or less for float, idle, lena, snake, lunas and the stacks.

| scenario | share | left | right | closest m |
|---|---|---|---|---|
| idle | 0% | 0% | 0% | 0.904 |
| float | 0% | 0% | 0% | 0.544 |
| lunas | 0% | 0% | 0% | 0.646 |
| biba | 0% | 0% | 0% | 0.761 |
| lena | 0% | 0% | 0% | 0.769 |
| snake | 0% | 0% | 0% | 0.858 |
| flesh | 0% | 0% | 0% | 0.836 |
| balls | 0% | 0% | 0% | 0.704 |
| curves | 0% | 0% | 0% | 0.752 |
| shake | 0% | 0% | 0% | 0.718 |
| quake | 0% | 0% | 0% | 0.831 |
| boil | 0% | 0% | 0% | 0.722 |
| thick | 0% | 0% | 0% | 0.44 |
| time | 0% | 0% | 0% | 0.721 |
| groove | 0% | 0% | 0% | 0.343 |
| silly | 0% | 0% | 0% | 0.473 |
| explosive | 0% | 0% | 0% | 0.392 |
| tashi | 0% | 0% | 0% | 0.881 |
| dolfi | 0% | 0% | 0% | 0.849 |
| snake@0.8 | 0% | 0% | 0% | 0.801 |
| snake+float | 0% | 0% | 0% | 0.544 |
| trans lena>snake | 0% | 0% | 0% | 0.748 |
| trans shake>float | 0% | 0% | 0% | 0.556 |
| accents | 0% | 0% | 0% | 0.618 |
| stack4 | 0% | 0% | 0% | 0.485 |
| stack4b | 0% | 0% | 0% | 0.386 |
| edge dt | 0% | 0% | 0% | 0.662 |

## Events and posture switches

Peak upper-body acceleration in the 3 s after a layer change or accent (or 0.8 s around an internal posture switch), relative to a typical window with no event or switch. Legs: peak leg acceleration in the 3 s after the event, same baseline.

- **idle**: no events; shape/arm switches 10 (20/min), upper peak x1.18 avg (worst x1.54); steps starting within 3 s after a body-shape switch 0% of 3
- **float**: no events; shape/arm switches 14 (28/min), upper peak x1.22 avg (worst x2.36); steps starting within 3 s after a body-shape switch 38% of 8
- **lunas**: no events; shape/arm switches 13 (26/min), upper peak x1.03 avg (worst x1.53); steps starting within 3 s after a body-shape switch 50% of 4
- **biba**: no events; shape/arm switches 3 (6/min), upper peak x1.09 avg (worst x1.3); steps starting within 3 s after a body-shape switch 0% of 2
- **lena**: no events; shape/arm switches 9 (18/min), upper peak x0.95 avg (worst x1.41); steps starting within 3 s after a body-shape switch 20% of 5
- **snake**: no events; shape/arm switches 11 (22/min), upper peak x1.14 avg (worst x1.72); steps starting within 3 s after a body-shape switch 60% of 5
- **flesh**: no events; shape/arm switches 4 (8/min), upper peak x0.9 avg (worst x0.96); steps starting within 3 s after a body-shape switch 0% of 1
- **balls**: no events; shape/arm switches 13 (26/min), upper peak x0.94 avg (worst x2.31); steps starting within 3 s after a body-shape switch 100% of 1
- **curves**: no events; shape/arm switches 12 (24/min), upper peak x1.05 avg (worst x1.59); steps starting within 3 s after a body-shape switch 33% of 9
- **shake**: no events; shape/arm switches 10 (20/min), upper peak x0.83 avg (worst x1.3); steps starting within 3 s after a body-shape switch 56% of 9
- **quake**: no events; shape/arm switches 12 (24/min), upper peak x0.7 avg (worst x1.14); steps starting within 3 s after a body-shape switch 40% of 5
- **boil**: no events; shape/arm switches 9 (18/min), upper peak x1.48 avg (worst x3.69); steps starting within 3 s after a body-shape switch 0% of 2
- **thick**: no events; shape/arm switches 3 (6/min), upper peak x1.17 avg (worst x1.47); steps starting within 3 s after a body-shape switch 0% of 3
- **time**: no events; shape/arm switches 3 (6/min), upper peak x0.89 avg (worst x0.94); steps starting within 3 s after a body-shape switch 0% of 1
- **groove**: no events; shape/arm switches 11 (22/min), upper peak x1.1 avg (worst x2.45); steps starting within 3 s after a body-shape switch 29% of 7
- **silly**: no events; shape/arm switches 9 (18/min), upper peak x0.09 avg (worst x0.21); steps starting within 3 s after a body-shape switch 33% of 3
- **explosive**: no events; shape/arm switches 8 (16/min), upper peak x0.09 avg (worst x0.14); steps starting within 3 s after a body-shape switch 0% of 2
- **tashi**: no events; shape/arm switches 5 (10/min), upper peak x0.9 avg (worst x1.03); steps starting within 3 s after a body-shape switch - of 0
- **dolfi**: no events; shape/arm switches 5 (10/min), upper peak x0.69 avg (worst x1.8); steps starting within 3 s after a body-shape switch 33% of 3
- **snake@0.8**: no events; shape/arm switches 10 (20/min), upper peak x1.02 avg (worst x1.46); steps starting within 3 s after a body-shape switch 25% of 4
- **snake+float**: no events; shape/arm switches 11 (22/min), upper peak x1.06 avg (worst x1.44); steps starting within 3 s after a body-shape switch 29% of 7
- **trans lena>snake**: lena:0.7 @10.0s upper x1.16 legs x0.75, lena:0 @25.0s upper x1.67 legs x0.74, snake:0.7 @26.0s upper x1.67 legs x0.74; shape/arm switches 18 (27/min), upper peak x1.14 avg (worst x2.07); steps starting within 3 s after a body-shape switch 56% of 9
- **trans shake>float**: shake:0.7 @10.0s upper x1.43 legs x0.79, shake:0 @25.0s upper x3.1 legs x0.13, float:0.7 @26.0s upper x2.87 legs x0.66; shape/arm switches 18 (27/min), upper peak x1.06 avg (worst x3.67); steps starting within 3 s after a body-shape switch 71% of 7
- **accents**: !explosive @14.0s upper x28.2 legs x1.01, !explosive @19.0s upper x57.77 legs x1.31, !explosive @24.0s upper x55.62 legs x0.78; shape/arm switches 7 (21/min), upper peak x9.89 avg (worst x62.55); steps starting within 3 s after a body-shape switch 0% of 4
- **stack4**: no events; shape/arm switches 11 (22/min), upper peak x1.02 avg (worst x1.57); steps starting within 3 s after a body-shape switch 40% of 5
- **stack4b**: no events; shape/arm switches 1 (2/min), upper peak x1.01 avg (worst x1.01); steps starting within 3 s after a body-shape switch 0% of 2
- **edge dt**: no events; shape/arm switches 7 (22.1/min), upper peak x0.72 avg (worst x1.26); steps starting within 3 s after a body-shape switch 100% of 1

Edge dt: pose change during dt=0 0 deg, during dt=1e-5 0.0004 deg, resume spike x0.47, irregular dt p99 x6.41, dt=0.5 (clamped) spike x0.86, NaN 0.

## Sameness across words

Determinism (idle twice, same hash): true. Mean pairwise cosine of the words' band-power change vs idle (11 body groups x 4 bands): **0.36** (0.4) (1 = every word moves away from idle in the same way).

Same seed, different words: the body shape and both arm postures are identical in **2%** of 0.5 s samples on average across word pairs (body shape alone: 20%).

| word | distance from idle (log10 power) | own generator share of motion | full / gen off / idle mean speed deg/s | same pose as idle |
|---|---|---|---|---|
| float | 0.911 | 26% | 16.52 / 12.21 / 9.4 | 0% |
| lunas | 0.422 | 0% | 14.61 / 14.66 / 9.4 | 0% |
| biba | 0.69 | 35% | 11.8 / 7.66 / 9.4 | 0% |
| lena | 1.22 | 37% | 17.65 / 11.14 / 9.4 | 0% |
| snake | 0.549 | 10% | 11.53 / 10.32 / 9.4 | 0% |
| flesh | 0.572 | 35% | 11.55 / 7.52 / 9.4 | 0% |
| balls | 1.626 | 26% | 14.65 / 10.86 / 9.4 | 0% |
| curves | 0.704 | 30% | 16.02 / 11.29 / 9.4 | 0% |
| shake | 2.774 | 59% | 31.66 / 12.83 / 9.4 | 0% |
| quake | 2.811 | 65% | 30.8 / 10.69 / 9.4 | 0% |
| boil | 2.915 | 49% | 23.85 / 12.18 / 9.4 | 0% |
| thick | 1.13 | 47% | 10.64 / 5.66 / 9.4 | 0% |
| time | 0.885 | 42% | 9.94 / 5.8 / 9.4 | 0% |
| groove | 1.951 | 66% | 31.19 / 10.68 / 9.4 | 5% |
| silly | 2.598 | 37% | 18.75 / 11.79 / 9.4 | 0% |
| explosive | 2.446 | - | - | 0% |
