# #959 — canonical device preview capture

Unchanged accepted dev `0031dd58ddca7fe7d77052198fd07d24e0690842` refused
the ordinary canonical capture in [run39173950661](https://github.com/Matysh/houseplan-card/actions/runs/39173950661):
`documentation viewport does not show the device presentation preview` at
`applyDocumentationState`. No screenshot acceptance or derived commit occurred.

The new settings keep inactive sections mounted. The adapter must open Display
on plan through its existing Appearance button before reading the real preview.
Its old fixed180px inset also exceeded the available space for the taller real
preview. The inset is now capped at180 and half the remaining space; an oversized
preview still refuses under the unchanged full-visibility oracle. Focus follows
the activated button without scrolling the page.

Exact source executed: `68e7cef55a71e1713e9591e7afa38983a81f69de`.
`node scripts/capture-determinism.mjs` — both ordinary full processes completed,
all11 current scenarios captured, and12 PNG files matched (including the retained
overview). [Output](positive.txt), [manifest](capture.json), [preview](preview.png).
The actual preview is fully inside the existing1100px viewport and has been
visually inspected. Existing46 capture/determinism/docs acceptance tests PASS.

This local diagnostic uses the existing pinned Chromium151.0.7922.34/rev1234
and Node22.23.2. Local oxipng is absent and reported as such: these unoptimized
PNGs are observation evidence, not replacement documentation baselines. After
independent acceptance, the unchanged canonical beta-derived workflow must still
run pinned oxipng, cross-process determinism, stability3 and the declared six
changes/five byte witnesses before release. Product source, data, capture bounds,
browser arguments, clipping, golden matrix, thresholds and publisher are unchanged.
No mutation execution or temporary product replacement occurred.
