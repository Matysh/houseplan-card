# First-space converter acceptance (#1020)

Portable reference: e6a4edc8902b1954d5bd4949f8043896f1543ed5,
`docs/ui-lab-reference/2026-10-25-beta2`, UI-046.
Package verification:22 files/14 accepted sources byte-identical.
The local synthetic empty replay used the pinned HA Frontend20260930.4,
Playwright1.62.0/Chromium151.0.7922.34 rev1234, RU and identical viewport, theme,
configuration and pointer state. The candidate used its own built product: no
reference CSS/DOM adapters were installed in it. The private owner PNGs were not
used or claimed. Candidate source fingerprint:
`3ce8b17f4e66dc61656c1f5ef4d1567555a1989db48a1780c72a562f87138118`.

Both the empty paragraph and floor paragraph had identical measured text,
width/height, margins, font, link font/accent, alignment, URL/target/rel and settled
hover ink/background. Desktop body560×308.78125px, padding20px; rows520×46px,
gap12px. The frozen reference cascade retains the shared explanatory box,
level pills, compact560px width, and narrow footer padding14px.

| Theme | Width | Surface | Paragraph bounds(px) | Pixels with channel delta>10 |
| --- | ---: | --- | --- | --- |
| light | 1440 | floors | 520 × 62.390625 | 172/1440000 |
| light | 1440 | empty | 620 × 41.59375 | 0/1440000 |
| light | 390 | floors | 350 × 83.1875 | 120/390000 |
| light | 390 | empty | 342 × 83.1875 | 98/390000 |
| dark | 1440 | floors | 520 × 62.390625 | 172/1440000 |
| dark | 1440 | empty | 620 × 41.59375 | 0/1440000 |
| dark | 390 | floors | 350 × 83.1875 | 120/390000 |
| dark | 390 | empty | 342 × 83.1875 | 95/390000 |

All eight complete synthetic frames were inspected with a maximum changed pixel
ratio0.000308. The desktop empty captures have no differing pixels. These are
task comparisons, not baseline acceptance. Captures/metrics/logs are retained
locally under `output/s8-first-space/output/1020-pair-*` and
`1020-paired-comparison.json`; the reference can be replayed using its README's
`serve-reference.mjs --empty` entry and the same HA runtime/theme.

Native `smoke_first_space_converter.mjs` covers nonwriter/admin-nonwriter,
missing storage and kiosk without editor/settings requests or configuration
writes; actual keyboard Enter opens a routed synthetic converter tab while
checked floors and configuration stay unchanged. It covers cancellation, normal
backend restore/create/delete-last subscription inputs, all four languages and
a long extra format supplied through the ordinary component data property at
320px. Reduced motion removes link transitions. Both runtime floor methods
delegate to the same renderer and retain their existing guarded callbacks.
The existing form-kit frozen fixtures remain byte-identical(8/8 tests).

Matched pinned WSL builds on ca672d96:initial348302→348614(+312B),
lazy editor359326→361593(+2267B), onboarding37792→39075(+1283B).
Only these task deltas move the corresponding rolling references; absolute
initial352000B, all2000B bands and the onboarding reference remain unchanged.
The hint's four-language pack and compact style owner stay lazy. Existing
first-frame floor-row CSS remains eager as required by the #805 budget guard.
