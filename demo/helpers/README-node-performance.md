# Connected-node performance observer (#834)

`smoke_wall_node_connected.mjs` and the isolated historical diagnostic use the
same monotonic clock, source-input ledger and phase-aware paint observer. The
workload remains three warmup and five measured gestures, each with 60 distinct
native positions sent independently every 16 ms. It does not wait for a render
or a CDP response before submitting the next position. Authoritative limits are
the `budgets` in the smoke and each raw report (currently delegated flush
wall-time p95 **55 ms**, source-input-to-paint p95 **121 ms**, longest task
**150 ms**, owner headroom decision #898). This is wall-time, not OS CPU
accounting. Historical reports retain their own recorded thresholds.

## Clock contract

Before mouse-down, exactly 32 independent RTT probes record Node
`performance.now()` immediately before and after reading browser
`performance.now()` directly through `Runtime.evaluate` on the same page CDP
session used for native input (no additional Playwright evaluation wrapper).
Each yields an offset interval
`[browser - nodeAfter - 0.1, browser - nodeBefore + 0.1]` ms. Chromium's coarse
clock can round in either direction, so the 0.1 ms padding is conservative.
All 32 intervals must intersect. The narrowest measured interval must have
uncertainty at most 1 ms; its **lower** offset is fixed for the whole gesture.
The entire fixed series always runs, even if its first probe is precise. There
is no early success, adaptive extension or retry-until-calibration-passes loop.
The larger fixed sample window (#952) replaces the former eight probes; it
does not make the original imprecise CI samples valid or relax the 1 ms bound.

Every source clock is `nodeSendTime + lowerOffset`, frozen before dispatch.
Using the lower offset can increase the reported latency, never improve it.
32 further independent probes after the measurement must share a feasible
offset with the before-probe intersection. This check never refits or rewrites
the already frozen source clocks. Raw before/after probes and the chosen pair
remain in the report, including calibration failures.
An unavailable calibration remains FAIL with `clock-calibration` stage, gesture
and before/after phase, received/valid/required counts, best observed uncertainty
and all available raw probes. Transport/invalid replies retain partial evidence;
no partial gesture becomes performance acceptance. This does not diagnose why
the host/transport was slow, and historical eight-probe reports have a different
protocol identity rather than being pooled with current 32-probe reports.

Native CDP events deliberately omit `timestamp`: their receipt timestamps use
Chromium's monotonic clock. The old `Date.now() - performance.timeOrigin` bridge
was unsafe: Chromium converts supplied epoch timestamps against current clocks
at each event, and the observed bridge moved during a gesture. Old epoch-based
reports are retained as historical diagnostics but are **superseded** for the
current comparison; before and after must both use this protocol.

Primary sources: [Chromium input timestamp conversion](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/devtools/protocol/input_handler.cc),
[coarse clock resolution](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/timing/time_clamper.h),
[clock rounding](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/timing/time_clamper.cc).

## Native event identity and readiness

`sendNodeNativeMove` sends both `button: 'left'` and `buttons: 1` for a held
primary mouse move, matching Playwright's native protocol. Omitting `button`
can make Chromium release capture even with `buttons: 1`; a four-move native
probe on an isolated blank page protects this contract before measurement.
The probe is outside the product fixture and never paces the measured stream.

The browser readiness predicate and Node ledger share one pure inspector,
installed directly with `page.evaluate(installNodeInputObserver)`, without
`eval`. Source positions must be unique at the 0.001 px native-coordinate
precision. A match also requires a trusted mouse event, the captured pointer
ID and held primary button. Matched observations must be strictly ordered and
unambiguous: duplicates, reorderings and ambiguous positions fail.

Each matched native receipt must be between the conservative source timestamp
and its browser dispatch timestamp. A delayed native receipt is legitimate;
its delay remains included because latency is measured from the earlier source
clock, not from receipt. Every matched observation needs a finite post-paint
opportunity at or after receipt, and source 59 must be matched. A painted final
input cannot hide an earlier matched input still awaiting paint.

Unmatched native observations remain raw diagnostics. Readiness does not invent
paint or latency for them or wait for them to acquire a production update. All
60 source clocks still settle against observed latest candidates; superseded
positions are labelled, not falsely claimed to have been rendered. This domain
consistency correction does not establish the cause of an earlier timeout whose
active gesture had not been captured.

The phase-aware observer retains both its post-paint opportunity and the
unconditional two-RAF diagnostic. Production wrappers only delegate and record;
they cannot validate a candidate, change geometry or persist an edit. On CI the
full post-measurement report is also saved to
`os.tmpdir()/smoke-logs/smoke_wall_node_connected.raw.json`, including failures.

## Budget and phase diagnostics (#888)

`node-performance-report.mjs` names every exceeded budget with actual, limit and
excess. Exact equality passes; missing/non-finite measurements, functional
failures and clock exceptions cannot silently derive a green result. The smoke
keeps its original exit condition and all geometry/pixel/write/history guards.

The pure phase report joins existing source/native/flush records by exact
ledger identities, without another browser wrapper or clock fit. Each source
latency is the sum of source-to-matching-native, native dispatch, frame
scheduling, delegated candidate wall-time and candidate-to-paint-opportunity.
An incomplete/ambiguous join is `unknown`, not a guessed diagnosis. Superseded
inputs wait for a later matching input, so their first interval is not pure CDP
transport; they are not claimed rendered separately. Phase quantiles weight
sources (one flush may repeat); the main-thread gate still weights flushes.
Component p95s cannot be added, and neither these intervals nor a green repeat
establish CPU/descheduling cause or real-GPU/compositor presentation.

The raw passport records commit/tree, non-bundle worktree dirtiness, harness,
fixture and freshly served bundle fingerprints, pinned browser/Node, protocol,
workload and an allowlisted OS/CPU/memory/runner-image identity. Load and free
memory before/after are observations, not attribution. No secrets/full env dump.

Read-only offline derivation:

```sh
node scripts/node-connected-diagnostics.mjs raw-1.json raw-2.json raw-3.json
```

It never launches or retries a gate, edits reports or replaces `originalPass`.
Three complete clean receipts with the same material/protocol/workload,
recorded static environment identity and budgets are comparable bounded
observations. Missing identity, incomplete functions/clocks, foreign material
or fewer than three receipts prevent that claim. A red budget outcome remains
in a complete series. Retain every predeclared run, not retry-until-green;
the cause remains `unknown` without further evidence.
