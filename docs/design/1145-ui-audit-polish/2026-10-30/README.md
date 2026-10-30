# #1145 — visual and computed-style evidence

Synthetic demo only; no owner design approval or production/GPU acceptance is claimed. Pinned Chromium151.0.7922.34, DPR1. Source/digests in [provenance](provenance.json).

Before/after pairs share1100×900, dark theme and the same fixture data: [before Save](before-decor-text.png), [after Save](after-decor-text.png); [before shared-CSS probe](before-probe.png), [after shared-CSS probe](after-probe.png). The first pair is the real text dialog. The second is an explicit native hp-dialog CSS fixture; it is not a real HA destructive action. Both pairs were visually inspected. Save becomes primary, ordinary color target40→44, and body row padding12px16px /1px top divider →0/0.

Real forms: [stairs](native-rows-stairs.png), [partition](native-rows-partition.png), [column](native-rows-column.png), [Optimize](native-rows-optimize.png). Optimize uses failed-result data to select its diagnostics branch; no geometry implementation/guard was patched and this is not a geometry-failure proof. Actual fields/direction/Cancel are exercised; full save/undo semantics remain in smoke_stairs and smoke_optimize_context.

Theme fixtures: [light](native-theme-light.png), [dark](native-theme-dark.png), [custom](native-theme-custom.png). Light/dark explicitly use the existing HA fallback error token #db4437; the custom fixture supplies #ffab91. Colors track the supplied token; theme changes do not set a new global palette.

| Fixture | Danger text contrast on surface | Backup error contrast before → after |
| --- | ---: | ---: |
| light | 4.29 | 2.02 → 3.44 |
| dark | 3.74 | 5.57 → 3.22 |
| custom | 7.52 | 4.82 → 5.33 |

Before error text/background (#ff7a5c and rgba179,64,42,.16) are measured on the original source ([before measurements](before.json)); their alpha composition against each supplied theme surface is calculated by the same luminance oracle. After values are browser-computed. These coefficients are measurements, not a universal4.5:1 claim: HA's fallback token itself yields lower contrast in some contexts, including a decrease on dark relative to the old peach literal. Custom theme contrast remains the theme author's responsibility; no user token is overridden to disguise it.

[320px picker](native-picker-320.png), [390px picker](native-picker-390.png): bounds and scroll checked, all ordinary controls44px, compact trigger36px. [Native report](native.json) records actual boxes/rows/colors and desktop authority; [after collector](after.json) is measurement output, not an assertion suite.

Command: node demo/smoke_ui_polish_1145.mjs → PASS. Negative43px width/height inputs and the positive44px case execute the size oracle without changing product code. Native disabled commands stay inert, enabled neighbour works; desktop disabled hover keeps paint. Real touch leaves summary hover clear; desktop hover and keyboard focus remain.

| Protective AC | Ordinary proof | Negative/nightly witness |
| --- | --- | --- |
| AC3 | native disabled/enabled mouse/keys and computed hit cursor/paint | disabled-kit-loses-pointer-hit-1145 (registered, not executed) |
| AC4 | measured ordinary44px/compact36px and320/390px bounds | negative43px inputs PASS; ordinary-color-target40-1145 (not executed) |
| AC5 | actual stairs/physical/Optimize row padding/border/justify | dialog-footer-leaks-into-body-1145 (not executed) |
| AC6 | actual summary native touch/desktop mouse/Tab | summary-touch-sticky-hover-1145 (not executed) |

No global Golden baselines accepted by the task; beta acceptance remains separate. Existing legacy .btn styling is still required by non-migrated consumers and is scheduled for removal in #1150, rather than duplicated here.
