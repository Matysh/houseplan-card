# Geometry commit measurements (#1099)

Baseline: clean immutable `61cc75bb`; candidate fingerprint `b32f2c0bf2f12338c4935f549501cf6442e983bd7d4cddf8a5c57e1da7067bf0`.
Pinned Chromium 151.0.7922.34, Node v22.23.2. Each group contains seven successful real bundled-runtime calls at DPR1 or DPR2 over 146 real rooms and three floors.

The independent host shell replaces storage/history/gesture UI only. Preflight, wall identity, junction validation and adoption are production code. These are synchronous writer CPU measurements in a real browser, not native end-to-end UI latency. UUID creation remains real; the separate exact-document unit corpus controls entropy as an input.

| DPR | Edit | Before median ms | After median ms | Unions before | Unions after |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | thickness | 2374.7 | 1382.6 | 4 | 2 |
| 1 | merge | 1643.2 | 1611.6 | 4 | 3 |
| 1 | split | 2408.4 | 1824.1 | 4 | 3 |
| 1 | column | 2434.3 | 1301.6 | 4 | 2 |
| 2 | thickness | 2375.9 | 1334.1 | 4 | 2 |
| 2 | merge | 1651.6 | 1652.5 | 4 | 3 |
| 2 | split | 2651.9 | 1876.1 | 4 | 3 |
| 2 | column | 2399.4 | 1299.8 | 4 | 2 |

Every baseline sample builds four wall unions. The candidate builds two when the live/canonical fingerprints agree (thickness/column), three when they differ (merge/split). The large-house unit corpus explicitly exercises both equality outcomes. Counts are the acceptance rule; raw medians are reported without retuning a time threshold. The near-equal DPR2 merge median is retained.

`benchmark_junction_limits.mjs` before/after: `tsFullCandidateMs` 98.4 → 86.2 ms, unchanged 400 ms budget. Segment-length/node-distance and Python warm/cold budgets also pass; their algorithms are unchanged. `benchmark_safe_resize.mjs`, `benchmark_safe_resize_render.mjs` and `smoke_editor_command_latency.mjs` pass with existing limits.

Raw results are [before.json](1099-geometry-commit-2026-10-28/before.json) and [after.json](1099-geometry-commit-2026-10-28/after.json). Each records all 56 samples, the actual source/build fingerprint, browser/Node versions, fixture SHA256 and benchmark recipe SHA256. No global Golden baseline is changed.

Setup failures (boolean page-error assertion and a subsequently edited donor checkout) were diagnosed separately and are excluded from product evidence. Measurements use a new clean baseline checkout and the unchanged freshness/byte verification. The unknown `rect` test column was corrected to the valid product `square` before accepted measurements.

The old runtime characterization corpus covers 19 exact outcomes, including safety/junction/migration refusal and room-reference rewrites. Ordinary negative inputs and injected boundary exceptions remain unit evidence. The three registered mutation witnesses are declarations only; no development-time mutation was executed.

The corpus membership passport was extended by exactly 19 new #1099 documents using the unchanged accepted 61cc75bb model. All 135 existing document records and existing inventory rows were asserted byte-equal before the write. The compatibility inventory rebinds one legacySafe source hit to its moved proof result, retaining the prior wall-model-chain classification and reason; no reader deadline or retirement decision changes. Legacy test-shell cache construction and source anchors follow the new per-space Map; their behavioral oracles remain intact.

Selected `smoke_summary_first_paint.mjs` initially failed while other task gates were running: a 705 ms long task and values still pending after 4447 ms. No summary implementation changes or threshold changes were made. A root-coordinated exclusive paired control then passed on both immutable61cc75bb and rebased candidate57046d78: baseline long tasks144/70/121/118 ms, values2087 ms; candidate143/139/115 ms, values2006 ms. The first control wrapper had a missing newline before saving the baseline exit, so that setup attempt is excluded from the pair; its separately completed candidate pass is retained only as unpaired evidence.

The other selected/AC smokes passed. With Home Assistant imported from the hp545 environment, `pytest tests_backend -k "junction or wall_node" -q` passed221 tests (2379 deselected). `model-invariants --config` reports zero violations/notes on the four actual committed146-room outputs. An initial bare `npm run invariants` only printed required-argument usage; it was corrected with explicit config inputs and is not claimed as a successful invocation.