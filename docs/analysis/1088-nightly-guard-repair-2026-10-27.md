# Nightly mutation guard repair — #1088, 2026-10-27

## Immutable incident and scope

- [Original nightly run 40456423875](https://github.com/Matysh/houseplan-card/actions/runs/40456423875),
  attempt 1, material `e5849080cc01e10349be1c5ec922f8bb4a428094`,
  tree `1f03ef6bb4ee5a0c534f9f67c7b59ef62ecc9a72`.
- The 20 shard evidence files identify that same material. Eighteen shards
  failed; the incident reports two surviving mutations and nine distinct guards
  failing on the unmodified source. Repeated guard failures across shards are
  not nine additional product regressions per shard.
- This repair changes only tests, synthetic fixtures and documentation. No
  product source, guard deadline, RGB tolerance, failure classification, retry
  policy, renderer, released bundle or global golden baseline changes.
- The task follows the infrastructure route. The preceding beta request was
  interrupted by the owner's instruction to work on this issue; no release is
  part of this repair.

## Ordinary baseline evidence

Pinned native Windows Node 22.23.3, Playwright 1.62.0 / Chromium 151.0.7922.34;
fresh `npm run build`, `node scripts/bundle-sync.mjs`,
`npx tsc -p tsconfig.test.json`, `node scripts/fix-test-build.mjs` from the
incident material. Only the nine reported ordinary guards were run, with two
browser children at a time. Eight reproduced the reported failures. The View
recovery guard passed locally; that PASS does not invalidate its historical RED
or establish Linux timing equivalence.

| Ordinary guard (`node demo/<name>.mjs`) | Failure and repair | Retained oracle |
|---|---|---|
| `smoke_color_picker_presentation` | The first dark frame was sampled during the accepted popup entrance. Await finite surface animations before sampling settled pixels. | Exact selected colour, 20px white-rimmed thumbs, 10px tracks, gradients and fit; original RGB tolerances, real motion and native screenshots. |
| `smoke_decor` | An old furniture probe sent down but no up. Complete the accepted mouse sequence and assert that down alone does not place. | Exactly one item through the inert device core, plus existing background input/history checks. |
| `smoke_furniture_polish` | The old fixture omitted both right and left terminal events. This left placement and hit-testing in an unfinished gesture. Complete both sequences. | Right click places nothing; left down places nothing; release places once and retires listeners. Both small and large real handle-hit checks remain. |
| `smoke_device_inbox_batch` | The approved catalog no longer wraps the New-only checkbox in the obsolete help container. Check its actual native label and field identity. | Batch stays outside filters; exactly the real New-only checkbox remains in the filters; selection and all batch writer guards remain. |
| `smoke_settings_mock_match_948` | It waited for catalog help deliberately removed by the approved UI. Check the genuine labelled filter instead. | Settings help remains 22px; unscoped help remains 32px; original layout, motion and theme checks remain. |
| `smoke_space_delete_with_devices` | Compact navigation exposes the gear for the selected space only. Explicitly select the target with the existing public facade before opening settings, including the second viewport pass. | Both viewports retain warning focus/visibility, counts, confirmation, cancellation, exact writer and refused-write checks. |
| `smoke_view_runtime_recovery` | Historical stack at `houseplan-card-CHWd37ks.js:482:8180` is the independent compact-selector import's `then(requestUpdate)`, not either physically held View import. Complete that visible-header dependency before retirement/instrumentation. | The live and summary imports stay held throughout setup. Their one shared request, no construction or late update for the retired card, and independent warm-card instances remain mandatory. |
| `smoke_wall_guide_ownership` | At 50% zoom the adaptive grid accepts first X=395.83333333333337 rather than raw X=400. The fixture searched saved partitions by the raw pointer location and reported `undefined` despite a successful write. Identify the segment by its observed initial anchor. | The fixed independent alignment target, guide ownership, saved endpoint and native pinch checks remain. A fresh write after this exact click is now required, not any earlier write. |
| `smoke_wallthick_standalone` | The scenario directly clicked wide tabs after compact navigation replaced them. Use existing `__hpTest.switchSpace`, which operates the actual tab or UI Kit popup. | A real floor switch still clears the selected wall indication; View/tool/Escape/dialog apply/cancel coverage remains. |

All nine ordinary guards passed after their respective repairs on that same
fresh product build. The original before logs and targeted after logs are local
ignored artifacts, not files from a real house.

## Surviving witness analysis — not a mutation execution

### `first-space-converter-writer-only`

The existing mutation changes the converter boundary from informational owner
to configuration-write-context owner. Merely checking the rendered custom
element cannot witness this: evaluating its module registers the element and
can upgrade existing DOM even when the boundary's completion loses authority.

The ordinary smoke now includes a card without `hass.callWS` and a controlled
HTTP 404 for the information module. It must show its real failure notice,
recover through the native Retry button with exactly one fresh nonce request,
show the link, clear the notice and make no configuration/layout writes. A
write-context-only boundary cannot publish this error/recovery without the
transport. No implementation was patched to demonstrate that reasoning.

The mutation ID, source anchor and native browser guard remain unchanged; its
explanation now names this actual observable difference. The controlled HTTP
error is an ordinary dependency input, not a modified canonical module.

### `vacuum-live-future-prefix-consumed-1049`

Removing the candidate watermark alone does not erase a distinct future
endpoint: the later prefix watermark independently refuses it. The former
test therefore still passed. The early filter also has another responsibility:
exclude future visits when proving that an old endpoint is unique.

The new ordinary case visits X values `[0, 10, 20, 10, 30]` at times
`[0, 1000, 2000, 3000, 4000]`, then acknowledges endpoint 10 from a request
started at 1500. The exact expected suffix is `[10, 20, 10, 30]` with timestamps
`[1000, 2000, 3000, 4000]`. It must remove the witnessed old prefix without
consuming future samples or treating the future visit as old ambiguity.
Without the early filter both visits enter the candidate set, so its unique
join is incorrectly refused. The original future-consumption and ambiguous
old-revisit negatives remain.

The stable mutation ID/patch and `only_unique_covered_prefix` guard selection
are retained; its explanation records the independent second barrier.

`wsl -d Ubuntu-24.04 .../python -m pytest tests_backend/test_vacuum_live_tail.py -q`
passed **21 tests** on Python 3.14.7. This is ordinary unchanged-product evidence,
not proof that a mutation was caught.

## Boundary of proof

- Static mutation readiness validates the declarations and anchors only.
- No local mutation, temporary patch/run/restore, generated-bundle mutation or
  nightly execution override was run in this task.
- The next scheduled mutation workflow must establish actual caught status.
  The two historical survivors remain real findings until that evidence exists.
- Task CI/review provide acceptance of this test repair; neither is described
  as a new successful full nightly mutation run.
