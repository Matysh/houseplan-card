# Support diagnostic inventory (#942)

This is the implementation inventory, not a backlog or a replacement for the
spec in issue #942. Privacy: [SUPPORT-PRIVACY](SUPPORT-PRIVACY.md). Ordinary View
does not invoke the collector; no polling, source scans, vendor calls, services,
registry/Store writes or lazy panel/radar activation are added.

## Questions → sources → package fields → exclusions → witnesses

| Question | Actual source | Package v2 | Deliberately excluded | Executable witness |
|---|---|---|---|---|
| Where/why is a device placed? | persisted area/room/binding/layout, accepted RenderDeviceSnapshot | plan_backup settings/spaces/markers/layout; diagnostics.devices.client placement/binding_status | names, full HA registry | test_support_config_projection; test_ha_support_v2 |
| Why icon/value/action? | resolved presentation + projectedTapAction/resolveToggleIntent | display, source_kind, face/badge source/shape/outcome/attribute presence, activity/pulse, action kind/targets/skips | numeric readings, arbitrary text/attribute values | test_support_package_v2; smoke_support_diagnostics |
| Which fill/light/opening config? | persisted settings, roomFillModeOf/roomGlowOf/sunRaysOn | global/space/room inheritance and bounds; LED geometry/ref; opening contact/lock; environment.rooms | new light engine, external source responses | test_support_config_projection; test/support-diagnostics.test.mjs |
| Why an empty summary row? | persisted panel version1 + already-loaded supportFacts | structure/source refs/show/mobile; environment.panel normalized shapes/reasons | text/values, forced runtime load, nonexistent size controls | test_support_config_projection; test_ha_support_v2 |
| What radar is configured? | validated radar version1/source refs | profile/units/mount/room/calibration + referenced availability | live targets, tracking IDs/history/heatmap; future opaque version | test_support_config_projection; test_support_package_v2 |
| Image/editor context? | persisted bounds/transforms + existing asset metadata; accepted revision/mode | pseudonymous resource refs/status, mode/projection/pending/recovery | URLs/bytes/DOM/screenshot/Undo commands; unobserved is not loaded | smoke_support_diagnostics; test_support_wire_schema |
| Which robot source/route/run? | source resolver + actual planVacuumOverlay/adopt_legacy_run; cached recorder and HA states | exact root/effective source/map/route equality, matrix, current/previous identities/ages/quality/provenance/reasons | raw camera response, credentials, fabricated current job or lifecycle history | test_support_package_v2 (root A/B); test/support-diagnostics.test.mjs |
| Why zero drawn points? | diagnoseVacuumTrails + frozen overlay facts | raw/stored/rendered counts, source input/current/previous/local separately | chords across gaps, resampling that changes affine geometry | test_support_diagnostic_values; test_support_package_v2 |
| Can a writer read this entity? | HA entity read permissions, verified persisted/auto placement refs | allowed facts/claims only; fixed access_denied coverage | denied entity facts and foreign run geometry; raw ACL scope in attachment/logs | test_ha_support_v2 (before publication and submit, panel/action/foreign source) |
| Is the report complete? | source/revision matching, available runtime and collection/byte budgets | four fixed coverage rows, counts/reasons, client_status and source-part ages | false complete for old backend, stale client, unobserved resources | test_support_package_v2; smoke_support_diagnostics |

## Bounds and identity

Config remains complete within product limits; runtime input is at most 512 KiB,
depth 12, 2000 devices. Diagnostic output is at most 2 MiB; attachment 8 MiB and
request 8.5 MiB remain unchanged. Caps: 32 robots, 16 candidates, 64 routes,
256 room anchors; globally 4096 kept points/256 fragments. Source/current/
previous/local samples share this budget, preserve original indices and break
on invalid points. A bounded scan records scan_limited rather than inventing a
complete valid-point count. Under byte pressure samples go first, then runtime
entity/client collections with total counts and partial coverage; config,
vacuum identity/ownership/counts/ages remain. Essential overflow refuses safely.

All references use one package-local random namespace. Source is an entity
reference, `marker:*` remains a marker reference; map 0/"0" follows consumer
normalization, empty/null/absent remain distinct. No independent coordinate
rounding. Unknown matrices/versions are marked rather than repaired. Absolute
timestamps become exact signed ages; invalid/null/missing times remain distinct.

One physical build per user/draft, four globally, ten-second deadline including
capture waits. Cancellation/timeout cannot release an executing job. The
HA-lifetime pool survives integration reload and late completion cannot publish
into a new runtime. Preview memory alone retains raw read-scope IDs until TTL.

## Verification and compatibility

Run `python -m pytest tests_backend/test_support*.py tests_backend/test_ha_support_v2.py`,
the existing HA support tests, `node --test test/support-diagnostics.test.mjs`,
`python -m unittest discover -s scripts/support-relay/tests`,
`node demo/smoke_support_diagnostics.mjs`, and the existing support-feedback smoke.
The new browser scenario uses public cold mount/config/HA inputs and the actual
Python builder, not a hand-written preview. Captures live under ignored
`artifacts/support-diagnostics/`; inspect 360/1100 light/dark before handoff.
It also completes a real preview while the busy-close confirmation is open:
accepting that confirmation discards the latest token exactly once, rather
than the stale pre-confirmation snapshot. The registered protective witness
is `support-v2-close-discards-stale-snapshot`; mutation execution stays nightly.
Private reports are never fixtures. Upper-marker/capped-path fixtures and an
executor heartbeat test establish bounded work, not a wall-clock speed claim.

| Frontend | Backend | Result |
|---|---|---|
| Old | New | default request → unchanged package1 |
| New | Old API1 | legacy request, no diagnostics input → package1 + limited warning |
| New | New advertises2 | explicit package2 + closed diagnostics input |
| Any | unknown/future/malformed2 | stable rejection; no silent fallback during submit |

Relay accepts both formats; v2 rejects unknown nested keys, wrong types,
duplicates, depth/byte/count overflow and malformed references. Actual canonical
and relay validators read the same positive/negative cases; schema-copy equality
is an additional guard, not the only one. Deployment/rollback is separate from
HACS and documented in the relay README.
