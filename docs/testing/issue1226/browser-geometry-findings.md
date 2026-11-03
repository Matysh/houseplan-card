# Retained browser geometry failures (#1226)

These are not waived by the fixture port. Product changes remain outside #1226.
Current product checked: dev `96ffe544474c6a0ffd40f005caa977afff308d26`.

## GEO-OPT-REPORT (#1229): a no-op Optimize erases actionable diagnostics

`src/plan-optimizer.ts`'s final `if (!changed)` loop keeps only `modelFrom`,
`modelTo`, `total`, position counts and `wallsStraightenSkipped`; it converts
every other report array to `[]` and every boolean to numeric `0`.
`references.report` was correctly computed immediately before this loop.

Reproduction: `node demo/smoke_optimize_cleanup.mjs` (also context/unverified).
The current source layout still contains `grp_obsolete`,
`grp_second_obsolete`, an opaque missing owner, and `future_widget` on the
deleted floor. Yet `invalidPositionsEligible`, `invalidPositionsRetained`,
`unverifiedPositions` are all empty and `registryAuthoritative` is `0`.
The current dialog still implements the `.optimize-invalid-cleanup` control;
it correctly omits it because those arrays were erased. This is not a selector
rename or a reason to delete the retry/cleanup/keyboard/layout assertions.

Evidence: `output/issue1226/geometry/smoke_optimize_cleanup.log`,
`smoke_optimize_context.log`, `smoke_optimize_unverified.log` and the bounded
`output/issue1226/probe-cleanup.mjs` diagnostic (`PROBE` output).

## GEO-OPT-ROLE: a role-boundary coordinate remains short of its lattice node

`node demo/smoke_optimize_micro_interval.mjs` still fails after #1224.
The three expected role-aware 22 cm runs are retained, but their first internal
x boundary is `0.845833333` instead of exact `203 / 240`; y is now exact
`83 / 240`. The strict run oracle is deliberately retained. The report also
counts `wallsMerged=1` rather than the old legacy `0`; this bookkeeping change
alone does not justify accepting the still-wrong coordinate.

Evidence: `output/issue1226/geometry/micro-current-dev.log` and the bounded
`probe-opt-reports.mjs smoke_optimize_micro_interval` output. The almost-axis
sibling `smoke_near_axis_optimize` now passes after #1224; that success is not
used to suppress the distinct role-boundary failure.

## GEO-LEGACY-RENDER: historical plan still throws from an inner room contour

`node demo/smoke_wall_union_isolation.mjs` throws while rendering the unchanged
captured `test/fixtures/278-wall-union-isolation.json`:

```
Unable to complete output ring starting at [-1670.833333, 1266.6666666666665].
Last matching segment found ends at [245.83333333333331, -145.83333332624113].
```

The stack reaches `_innerRoomContour` before the smoke can assert the repaired
physical union. Keep the full Plan/View/static/2.5D and refusal checks: a
fixture-only edit must not mask the exception. Evidence:
`output/issue1226/geometry/union-current-dev.log`.

The failure is now reproduced without DOM, Home Assistant, the card cache, or
the browser. Run `node docs/testing/issue1226/repros/legacy-contour.mjs` after
compiling `tsconfig.test.json`: one rectangle, one30cm wall, `cell_cm=1`.
Normalized coordinates scale by1000 for rendering; lattice pitch1/240 becomes
1000/240 render units. The raw model7 inner contour succeeds; the official
model11 migration produces successful masonry, then its inner-contour
subtraction throws. This manual RED reproducer intentionally exits1.

Keep the source identities `r1` and `wall-union-regression` in this reproducer:
renaming the space to `minimal` selects a different canonical edge order during
migration and changes which near-lattice source scalars remain noisy. The
reproducing migrated top wall is
`[-1.6708333333333334,-0.208333333] → [0.2875,-0.20833333333333334]`.
In `innerContourForRoom`, the historical branch guards subtraction and has a
bounded contour fallback; the `graphSource` branch calls the same subtraction
without catching its exception. #1226 does not change either product branch.

## GEO-CAMERA-REMOUNT: readiness failure needs separate diagnosis

After its four native scenarios, 100 accepted/cancelled cycles and ten lifecycle
terminals pass, `smoke_wall_node_topology` changes the host width to 740 px and
remounts the explicitly legacy fixture. Its real camera readiness guard observes
stage `740 × 704`, `_lastValidStageSize=[740,793]`, and a coherent stored/painted
view whose aspect still matches the former height. No refit is pending and the
guard times out. Do not bypass the guard or repair the camera in the fixture.
This is retained for diagnosis rather than asserted to be a fully isolated
product root cause. Evidence: original geometry log and the native current
run's `diagnostic wall-node-camera` output.

## Other retained oracles

`smoke_zero_divider_taper`'s former rollback has been isolated. Its cut from
`[600,400]` to `[900,404.1666666666667]` has one lattice step of vertical
separation(5cm), but the node-to-slanted-segment distance is perpendicular:
the guard correctly measures **4.99951781667279cm**, below5cm. The toast rounds
both numbers to5cm; this is not a false floating-point threshold comparison.
The observed candidate contains a straight-wall profile seam at`[900,400]`.

The #172 no-taper fixture now uses two steps of vertical separation, retaining
the slant and zero-depth divider. It asserts both snapped endpoints and passes
all original Plan/View/light/kiosk/2.5D/static/no-rewrite oracles. The independent
guard is unchanged. `node docs/testing/issue1226/repros/divider-clearance.mjs`
preserves the one-step expected refusal and two-step allowed control; this
manual diagnostic is not registered as a new mandatory test.

`browser-geometry-classification.json` names every original failed smoke and
distinguishes confirmed fixture ports from failures still needing an isolated
cause. In particular, a true room/host, single-guide, or exact-identity failure
does not become an obsolete expectation merely because migration and the
current graph have changed.
