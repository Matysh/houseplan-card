# #1133: three observations, not one diagnosed failure

Original material: `9f7b3cc7b24e73b2d4da1273bbaa359c5949015d`; fingerprint
`db22631f8dffce327662c122343d4c921f036b08d153a1b63c45a9e9ddaeb125`.
[Validate attempt 1](https://github.com/Matysh/houseplan-card/actions/runs/40964200582/attempts/1)
failed; unchanged attempt 2 passed. Neither result cancels the other.

| Original artifact | ID | Verified ZIP SHA256 |
|---|---|---|
| Golden | 12938236273 | b0159e6863ed4752d6e3dea2b0a9123478756adf6e4a0b7761620ee59ca7e0bd |
| Performance | 12937833248 | 558f38b40c26730d0953cb8de99c9120ea4e394562e53362ba2427e3e178eccd |
| Smoke shard 2 | 12939216070 | 5617be644d666e952eb41ba925a26d9a8f16fcf9e77ac9d239f8e10533a207b8 |

## Golden

The grid-pan scene deliberately leaves the mouse down after eight native moves:
an active Background-editor pan, not settled View. The historical runner
reproduced a difference in WSL: 1956 pixels, ratio 0.001842, maxDelta 45.
Fingerprint, Playwright1.62.0 and Chromium151.0.7922.34/rev1234 match. WSL's
Node22.23.2 is auxiliary diagnosis, not reusable pinned-CI proof.

A separate paired probe invoked the existing root-background repaint control
without changing product source, fixture or launch flags. Before/repaint/repeat
hashes were equal, as were config/stage/SVG rectangles. This does NOT prove that
#1118's repaint fix applies. The standalone probe also omits some intermediate
runner work; its exact-pixel counts do not replace the canonical comparison.

Classification: reproducible active-pan raster difference, exact cause unknown.
Do not add a repaint, retry, mask or baseline replacement on that evidence.
The runner now records stage/SVG/marker rectangles, DPR, background positioning,
transforms and stage classes AFTER the judged screenshot, without pre-capture
layout reads. The current dev diagnostic capture still differs (1073px): this
delivery is observability, not a claim that the underlying drift is repaired.

## Performance

Of 846 raw samples, the only failing paint row was the first
large/DPR1/room-name/0ms sample: input22977.7, paint23078.8, client101.1ms.
The overlapping long task starts at22976.2 and lasts101ms; the overlap predicate
correctly includes it. No stack/GC/scheduler trace establishes a specific cause.

Classification: isolated historical paint-budget exceedance, not a proven
measurement bug. It remains FAIL under the historical100ms limit. No full matrix
was rerun to hunt for another answer. Owner-approved #1145 subsequently changed
the paint limit to117ms for beta.5; that separate decision is retained, not
introduced here or retroactively applied. No timing predicate changes here.

## Cancel

The original log has two false strict serialized `_serverCfg` comparisons but
no retained before/after or persisted delta. The unchanged historical vacuum/
radar guard passed locally. That control cannot distinguish asynchronous
adoption, normalization, key order or a genuine persisted edit in the old run.

Classification: unresolved cancellation/equality failure. The original boolean
oracle stays unchanged. Only after failure is recorded, diagnostics compare
original/client/persisted snapshots and save bounded changed JSON paths, explicit
omissions, serialized equality and structural equality. Array order matters;
order-only evidence never grants Cancel PASS. Pure negative cases cover these
distinctions. No production state, limits, timeout, flags or baselines change.
