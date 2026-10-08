# Connected-node performance observer (#834)

`smoke_wall_node_connected.mjs` and the isolated historical diagnostic use the
same monotonic clock, source-input ledger and phase-aware paint observer. The
workload remains three warmup and five measured gestures, each with 60 distinct
native positions sent independently every 16 ms. It does not wait for a render
or a CDP response before submitting the next position. The warm limits remain
CPU p95 **50 ms**, source-input-to-paint p95 **100 ms**, longest task **150 ms**.

## Clock contract

Before mouse-down, exactly eight independent RTT probes record Node
`performance.now()` immediately before and after reading browser
`performance.now()` directly through `Runtime.evaluate` on the same page CDP
session used for native input (no additional Playwright evaluation wrapper).
Each yields an offset interval
`[browser - nodeAfter - 0.1, browser - nodeBefore + 0.1]` ms. Chromium's coarse
clock can round in either direction, so the 0.1 ms padding is conservative.
All eight intervals must intersect. The narrowest measured interval must have
uncertainty at most 1 ms; its **lower** offset is fixed for the whole gesture.
There is no retry-until-calibration-passes loop.

Every source clock is `nodeSendTime + lowerOffset`, frozen before dispatch.
Using the lower offset can increase the reported latency, never improve it.
Eight further independent probes after the measurement must share a feasible
offset with the before-probe intersection. This check never refits or rewrites
the already frozen source clocks. Raw before/after probes and the chosen pair
remain in the report, including calibration failures.

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
