# #1118 — bounded raster-history witness

These are observations from the native WSL run, not baseline acceptance or CI
approval. The `.mjs` files preserve the exact executed diagnostic sources,
including this workstation's root/output paths. To replay elsewhere, change those
two constants to a prepared checkout and a separate artifact directory. They use
ordinary public scene preparation/background input, never source/guard patches.

## Before the repair

`unchanged-history-witness.mjs` ran on accepted `502247fa` with build fingerprint
`2dcf9e58ef7b568f0111e68b18a89393d471046120fa212214800bca9191e542`.
Four independent browsers made three freshly prepared captures each. Only the
middle capture included the existing root-background colour/restore procedure.
The last ordinary frame in process 3 reproduced the exact prior first-CI failure:
`2221172916c0c9b4a6f83e0da7a7385592b987cee1fe389f37f12055021106a1`.
The indexed ordinary frame is
`4e93c4352a86399be68aad356466cf1190f6a6c55e507bf9bc6fb00ad4fb29c3`.
This demonstrates retained raster history; it does not identify the historical
CI prefix, exact CPU, or an environmental cause. `unchanged-history-report.json`
records every actual frame and semantic/keyboard result.

## Candidate

`candidate-witness.mjs` ran after opting only `geometry-plan-editor-dark` into
`captureGoldenFrame`'s existing repaint. Build fingerprint:
`b6a21769c817578b93bfa13725dd8a5ccdc8d5e4deb03d3259bfbd15be26e82f`.
Ten independent Chromium 151.0.7922.34 processes made 30 target captures:
cold, warm, and ordinary background-history prefix. All 30 are byte-identical:
`243de7d024962abb44c9f9247e50c56e9696022c1d1b7891835a8f8dbc3cb035`.
Four additional dark/light View neighbors remain byte-identical to the index.
The ordinary semantic preparation and trusted Shift+Tab/Tab keyboard witness
are recorded, not bypassed. No page errors occurred.

The canonical command also completed successfully:

```sh
npm run bundle:sync
node demo/golden/run.mjs --mode=capture --scenario=geometry-plan-editor-dark
```

Its launched pinned-browser attestation passed and its actual PNG SHA is the
same `243de7d0…`. Its ordinary tolerant metric is zero pixels/maxDelta 1;
**that is not a strict unchanged result**. Decoded RGBA differs from the accepted
index at exactly `(54,63)` by one channel unit. The matrix/index epoch is still
pending the complete beta acceptance. #1118 explicitly declares this canonical
one-AA-pixel change; the 67-pixel historical failure is not accepted.

Four focused `test/golden-scene-repaint.test.mjs` tests pass. They execute the
real browser callback, verify all opted scenes and every non-opted matrix scene,
restore value/priority/absence on frame failures, and preserve screenshot options
and rejection behavior. No mutants were executed. Global launch arguments,
fixtures, keyboard/geometry controls and strict unchanged gates remain intact.

Task evidence is not the required complete beta artifact or its review. Global
baseline files and the production bundle are absent from this task commit.
