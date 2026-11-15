# #1454: addressed cache evidence

Measured on 2026-11-15, not a release qualification. No owner HA instance or visual baseline was changed. Raw seven-sample readiness, warm navigation, long-task and worker/read/hydration observations are in [measurement.json](measurement.json). The benchmark is `demo/performance/floor-persistent-cache.mjs`.

## Method and result

Base: `98806c06ec8eb601c8e8774ceeb748e1a4511982`; candidate: `1189148792b454f9d98f11eacd19821a85e85573`. Source fingerprints are recorded with each series. Both built from their own complete source trees. Node 22.23.4, Playwright 1.62.0, pinned Chromium 151.0.7922.34 rev1234, Ryzen 9 7950X, Windows High Performance scheme, Ubuntu WSL2. Runs were sequential, without parallel builds/tests. One declared warm-up and seven retained samples per ordinary series; no outlier removal.

`large-house-v1`: three floors, 60 rooms, 200 devices, 100 openings, 60 partitions, 40 columns, 500 decor items and 250 stairs. Cold-document samples reset JS memory but preserve origin-local IDB; miss samples delete the derived database. Timing starts before `_pickSpace`, ends after fresh-pair/boot/continuity/resource readiness and two animation frames. Animation time is reported separately. Long-task detection includes tasks overlapping the intent (not just tasks starting afterwards).

| Median, ms | Base | Disk-ready candidate | Cache-miss candidate |
| --- | ---: | ---: | ---: |
| Selected floor ready/current | 501.8 | 315.2 | 517.3 |
| Return via memory | 49.9 | 66.6 | 73.6 |
| Mount to ready/current | 1225.0 | 1054.9 | 1049.8 |

Disk improvement: **37.2%**, above the accepted 30% target. Miss adds 15.5ms; warm adds at most 23.7ms in these paired medians, below the accepted `max(reference × 10%, 50ms)` allowance. This is not a promise for every plan/client. The largest observed floor-navigation long task fell from 516ms to 69ms; producer witnesses independently show canonical structural work in the worker, not merely a lower aggregate timer.

The first complete candidate series exposed a real miss regression (576.2ms). CPU profiling found full-domain room-floor clipping repeatedly processing distant unrelated operands. Production now uses the existing exact local boolean helper. The old full-sweep differential oracle covers holes, touching bounds, rotations, orphan/distant faces, both Polygon/MultiPolygon forms and all large-house floors. Coordinates/ownership/holes/bounds remain equal; SVG ring order/start or redundant collinear vertices can differ. No geometry test was weakened to gain speed. The intermediate failure and debugging logs remain in the local task artifacts.

### Post-repair revalidation

[revalidated.json](revalidated.json) retains another complete paired run after
the expanded native-consumer repairs: base `98806c06ec8eb601c8e8774ceeb748e1a4511982`,
product-source candidate `26b05d29e6d9cfedb21419e49920297dee938c71`.
The same pinned environment, synthetic fixture, one warm-up and seven retained
samples were used, with no concurrent heavy work; the Windows High Performance
scheme was checked again. The earlier measurements above are not overwritten.

| Median, ms | Base | Disk-ready candidate | Cache-miss candidate |
| --- | ---: | ---: | ---: |
| Selected floor ready/current | 532.9 | 290.7 | 495.3 |
| Return via memory | 49.9 | 66.5 | 82.5 |
| Mount to ready/current | 1245.8 | 1035.7 | 1095.4 |

Disk improvement is **45.4%**; miss is 37.6ms faster than this paired base.
The largest warm-median addition is 32.6ms, within the accepted 50ms allowance.
These are medians, not bounds on individual runs: all seven samples and their
ranges remain in the raw report, including the 100ms maximum warm miss-series
sample. The three accepted performance decisions pass without sample removal.

After the first code-review light-refresh/publication repair, another paired
series in [review-r1.json](review-r1.json) uses source
`663f66a40b9a664e1394bf9079b590a863dc9242` against the same base. Power mode was
verified again; all three series ran sequentially with one warm-up and seven
retained samples, without concurrent heavy work.

| Median, ms | Base | Disk-ready candidate | Cache-miss candidate |
| --- | ---: | ---: | ---: |
| Selected floor ready/current | 516.5 | 285.9 | 486.5 |
| Return via memory | 50.0 | 66.8 | 66.4 |
| Mount to ready/current | 1235.5 | 1032.3 | 1074.4 |

Disk improvement is **44.6%**; miss is 30.0ms faster than its paired base and
the largest warm-median addition is 16.8ms. All three accepted decisions pass.
This does not turn sample maxima into guarantees; all raw samples and earlier
series remain available.

## Storage, CPU and bytes

Ordinary disk series: zero IDB timeouts in 42 observed reads; read/open intervals 11.4–79.2ms. Candidate cold worker processing 168.0–188.4ms on hits, 367.3–408.5ms on misses; main hydration 3.2–4.1ms. A separate **one-sample CDP 4x CPU diagnostic**, not a paired performance acceptance series, observed four timeouts in six reads, ordinary worker reconstruction and a complete current frame (961.2ms). Read elapsed time includes delayed event dispatch under main-thread load and can exceed the 100ms timer budget; this is not a claim that timers can preempt a busy JS task. CDP throttling is not a calibrated physical low-power machine. No errors are presented to users for a cache timeout.

An additional instrumented slow-CPU sample separates pre-open completion from addressed reads: [slow-open.json](slow-open.json). Pre-open completed after 388.1ms (including event-loop delay); four of six addressed reads timed out and reconstruction still completed. This diagnostic retains the earlier slow sample rather than replacing it to obtain a better number.

One representative flat floor payload: 460,072 bytes / 4,811 graph nodes; isometric examples remain below the 8MiB cap. Native IDB boundary tests include 2/8MiB per-level payload limits, eight floor buckets, 32MiB scope / 64MiB global caps, concurrent same-origin connections, atomic generations, versionchange, denied access and late publication cancellation. Only derived stores are touched.

Manifest bytes (gzip), base → candidate: initial View **438,131 → 453,512** (+15,381; 3.5%); all frontend chunks **2,085,461 → 2,170,841** (+85,380; 4.1%). The isolated worker is a lazy manifest dependency: 202,788 raw / 68,478 gzip bytes, with no imports. Large serialization/checksum stays in that worker. This task does not publish a ZIP or grant release-size acceptance; ordinary manifest/installer contracts verify delivery and the release route retains its own packaging checks.

## Behavioral evidence and boundaries

Addressed Node tests exercise lossless exact/hidden/WeakMap semantics, actual retained recut versus a negative fallback control, lazy clean area, isometric physical source and quarter turns, malformed keys/source/scale/rooms, passive SVG vocabulary, authority/connection/ABA fencing, fit-only coalescing, worker priority and duplicate error fallback. Native Chromium tests use the actual module worker, IndexedDB and real card consumers, including:

- A genuinely new browser document paints the full cached View before a delayed fresh server pair, with current HA states and no write authority. Remount-only evidence is not substituted for this case.
- L1 is a painted passive basis; the unchanged logical camera and actual SVG screen transform match full View to the accepted tolerance. The isometric variant actually rotates through the UI controller and tests a narrow 2x-DPR viewport.
- A door state changes during a delayed worker job; the final light fingerprint is the current one. Old user jobs cannot hydrate or publish after authority replacement.
- In-place optimistic config/layout bodies and deferred writes fail the publication proof. Both geometry and summary publishers require current bodies to match the accepted snapshot.
- Summary scalar demand is preempted by navigation; all-floor areas equal the original canonical calculation. A foreign-floor stair change at equal server revision invalidates the scalar; persisted accepted scalars avoid hidden-floor main-thread geometry.
- Corrupt payload, storage getter SecurityError, absent Worker and a truly missing worker asset all retain a complete View with one honestly reported degraded fallback.

The expanded Ask selection also exercised the older native consumer journeys.
Its first complete pass was retained, not treated as a successful qualification.
Repairs keep menus/dialogs live while only spatial presentation is held, retain
the entire synchronous warm editor/tool intent, preserve geometry identity on
light-only jobs, restore a camera against the actual destination projection and
coherent header/stage dimensions, and prevent an already shown owner from being
reseeded by a hint after an authority change. A placement-owned, exact-key L1
avoids empty warm frames; its actual SVG viewport follows late camera adoption
without another fit or update loop.

Legacy synchronous test drivers now wait for the actual full scene or committed
mode, not one Lit update. Their numerical geometry/camera/authority oracles stay
strict. Worker producer witnesses replace main-thread-only positive controls;
`cleanFloorGeometry` counts the real clean-floor miss in either realm, rather
than confusing it with masonry floor-footprint work. Restoring an evicted
consumer pool from an already prepared L2 frame is a positive memory hit, not a
required canonical rebuild. These controls do not claim zero worker masonry
work for every structural edit.

Independent golden and node-command fixtures retire the preceding owner and
clear its in-memory warm slot before creating a different test case. Otherwise
a legitimate deferred editor restore or retained camera can leak between cases.
This reset is outside the golden harness's internal `mount`: the deliberate
`warmRemount` still claims its first mount, verified separately. The static-card
signing fixture waits for the exact accepted/painted candidate instead of a
fixed delay; its URL, backoff and immediate expiry/aging oracles are unchanged.

### First code-review repair: ready View light updates

The first substantive review found that a contact/cover light revision made a
ready View pending and inert. The new `smoke_floor_light_refresh.mjs` reproduced
the lost native tap on the old build before the repair. After the repair, an
explicitly held real module-worker light job leaves the stage/header live and
paints the current door state. One native device tap dispatches exactly one
current action. Eight intermediate updates plus a final cover position coalesce
into two light jobs, with no worker termination, geometry job, synchronous
fallback, full IDB write or publication attempt. The final light fingerprint has
its own successful worker reply; camera/DOM/structural-pool identities stay the
same, and navigation fences the late old-floor reply.

The ready-only refresh does not replace navigation readiness or its strict
current-state initial preparation. Main consumes the previous accepted light
table briefly, not another synchronous recut, and light completion requests a
repaint without camera refit. Generation publication remembers only the last
confirmed generation per bounded floor bucket. An overwrite immediately retires
the previous confirmation; rejected, stale or displaced inflight writes cannot
confirm a generation. Addressed runtime/scheduler/main-boundary tests pass all
34 cases, including the confirmed G1 → held G2 → return G1 → stale-success race.

Two speculative review questions required no product changes: live isometric
leaves/textures are already excluded from L1 capture, and the summary overlay
and its area demand are intentionally absent in all three editors.

The shared Ask S6 result and substantive code-review verdict are published by the normal queue, not claimed by this evidence file. No full stable/golden set or real HA ACL test is implied. Real HA follow-up before beta is recorded in [houseplan-e2e#71](https://github.com/Matysh/houseplan-e2e/issues/71). Backend format, backups, source images and legacy global LS_CFG wire stay unchanged; the unscoped legacy hint is not interactive cold-load authority. Server SVG remains a theoretical alternative, not implemented.
