# Cold View timeout — fixture authority split, not browser teardown

The original smoke produced all12 successful observations, then stalled before
`finish()` could perform its delivery round-trip. Instrumentation established
that `page.evaluate(() => 0)` in `roundTripLivePages()` never returned. The
subsequent `browser.close()` had not started; the open driver handles were a
consequence, not the cause. A SIGTERM closed the browser and rejected the pending
round-trip, explaining the late `OK` after an externally imposed timeout.

A CDP debugger pause and a bounded diagnostic wrapper around `requestUpdate`
identified an endless Lit update/microtask loop. The request stack entered
`HouseplanCard._syncAreaRelocations`' completion path. The smoke returned a
captured constant `serverConfig` from `config/get`, but delegated `config/set`
to the base demo's different store. Acknowledged Area-snapshot writes could
never be read back from that captured authority, so the lifecycle rolled back
and retried during rendering. The renderer then starved subsequent page tasks.

The repaired smoke uses one existing `createFixtureStore` for reads, writes,
layout and CAS. Its initial revisions match the server it replaces; the fixture
store gained explicit initial-revision options and a targeted read-after-write/
stale-CAS unit check. Virtual-light updates retain the current config revision.
Event delivery snapshots the listener set. No production code, private lifecycle
guard, `finish`, page-error collection or timeout verdict was weakened.

Validation on the same fresh bundle:

```text
node --test test/demo-fixture.test.mjs test/smoke-harness-lifecycle.test.mjs
16 passed, 0 failed, 0 skipped

timeout 20s node demo/smoke_cold_view_toggle.mjs
12 observations true; OK; exit0 in1.52 seconds
```

The cold-before/cold-after assertions and the assertion against an editor-runtime
network request remain unchanged. The existing lifecycle negative tests still
reject exceptions delivered during awaited browser close.
