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

The shared Ask S6 result and substantive code-review verdict are published by the normal queue, not claimed by this evidence file. No full stable/golden set or real HA ACL test is implied. Real HA follow-up before beta is recorded in [houseplan-e2e#71](https://github.com/Matysh/houseplan-e2e/issues/71). Backend format, backups, source images and legacy global LS_CFG wire stay unchanged; the unscoped legacy hint is not interactive cold-load authority. Server SVG remains a theoretical alternative, not implemented.
