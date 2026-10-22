# Live robot vacuums on the plan

This is the contract for the integration families in the coverage table
below. Roomba's core `position` string is not covered.

## What the user sees

The placed vacuum marker is the dock and never moves. While the vacuum is in
`cleaning`, `returning` or `on`, a second round puck follows the live position.
Clicking the puck opens the vacuum's HA more-info dialog. A hidden, deleted,
HA-disabled or `static_icon` marker has no puck, trail or room overlay.

### Camera attachment (#871)

Current/previous paths and every subpath keep their world coordinates during
pan, pinch, wheel and Fit in Flat/2.5D View or kiosk, including held-pointer
pauses and HA updates. The trail SVG is passive inside `.devlayer`: its HTML
parent is the sole live camera owner. It does not also receive a scene transform
or a budgeted `viewBox`. This preserves the existing marker/Zigbee stacking.
`live-viewport.ts` moves its bounded paint window on the shared 100 ms / 15%
anchor budget; the window exposes 25% around that anchor, not the entire plan.

`vacuum-view.ts` translates each animated puck's visual centre through the
actual current SVG screen-matrix inverse into its matching tip. All geometry
is read before endpoint writes; unchanged endpoints are not written. Missing,
singular/nonfinite matrices or detached/zero-size pucks skip that frame without
changing path data. One existing vacuum RAF retries valid pairs, stops when
none remain or the card is hidden/disconnected, and resumes on a valid mount
or visible page. It never becomes a second camera or per-pointer Lit render.

## Integration coverage

| Integration family | Position | Rooms / auto-calibration | Integration path | Map ID | Source discovery |
|---|---:|---:|---:|---|---|
| Xiaomi Cloud Map Extractor | Yes, when the attributes below are enabled | Yes | Yes, including `path.path` subpaths | `map_name` when exposed | Usually explicit camera selection |
| dreame-vacuum (Tasshack) | Yes | Yes; explicit room `x/y` is the anchor | Yes, through the supported ordinary-camera serializer below | Vacuum `selected_map` fallback | Automatic on the same HA device |
| Valetudo camera conventions | Yes | Yes when room data is exposed | No | Often `default`; no stable multi-floor promise | Automatic on the same HA device |
| Official Ecovacs, recognized SVG dialect (#939) | Yes, from SVG robot use | No room geometry; manual PNG fit | Yes, SVG linear trace | Image `map_name`, ordinary nullish fallback | Same-device `image.*`; explicit initial choice |
| Roomba core `position` string | Not covered | No | No | — | not covered |

For Xiaomi Cloud Map Extractor the camera must expose:

```yaml
attributes:
  - vacuum_position
  - rooms
  - path
  - map_name
```

The card recognises finite `vacuum_position` or `robot_position` objects. A
generic `position` string on an unrelated sensor or tracker is never treated as
vacuum telemetry.

## Source resolution and diagnostics

The device dialog has one diagnostic block and one source picker. It reports
the selected entity, integration, status, position, room count, integration
path and map ID. Automatic mode considers compatible entities attached to the
same HA device. Candidate order cannot change the result; a compatible camera
outranks a non-camera candidate. The collapsed **All cameras** section is
scanned only when opened and is never used for automatic binding. Its label is
now **All cameras and maps**, including registered Ecovacs image entities.

### Official Ecovacs images (#939)

The first verified family is X1 Omni / official HA Ecovacs 2026.10.2 /
deebot-client 18.7.0. Other models work only when they expose the same recognized
SVG dialect; compatibility with every Ecovacs model is not promised. A map and
robot must be enabled Ecovacs registry entities on the same HA device. A
different robot's image cannot supply coordinates even if another marker has
already activated that image. Pins are preserved on unsupported/missing data.

Select the robot's `image.*` in **Choose source**. Once current server telemetry
arrives, **Fit manually** shows its translucent embedded floor PNG and four
corner handles, without inventing room geometry from the rooms' names/IDs.
Move, uniform resize, quarter-turn, mirror, Cancel and Save/Retry retain the
ordinary calibration transaction. An in-flight preview belongs to the exact
dialog, HA user/connection, source and map; a changed owner cannot open or save
the stale fit. A changed map ID needs its own existing route/calibration.
An older House Plan backend displays an update/restart hint. Unrecognized maps
report unsupported data rather than drawing a guessed position.

The backend uses HA's public Image API and one physical read per exact source,
regardless of cards or markers. Event reads coalesce with a two-second minimum;
while moving there is a ten-second reserve poll. After stopping, final checks
are due at 0/15/45 seconds (subject to the minimum interval), bounded by sixty
seconds, then polling stops. A ten-second timeout marks telemetry stale;
errors back off 30/60/120/300 seconds. A timed-out/unloaded owner cannot release
still-running physical work for another overlapping read or publish its answer.

Robot use coordinates, viewBox, trace and PNG share SVG coordinates. The trace
parser accepts compact absolute/relative `M/L/H/V`, preserves move gaps and
revisits, and applies only its explicit scale transform. Absent trace in a
recognized whole SVG means empty drawable geometry, not a failed read. Received
point counts count decoded SVG vertices, not hidden upstream samples. Valid
native empty replaces current geometry under the existing source-first policy;
read errors retain the last native geometry with a reason, not sampled additions.
The fixed House Plan dock never follows the robot. No job ID, heading, metric
scale or architecture is inferred from a digest, a viewBox or raw-position API.

Limits: SVG 8 MiB / 20,000 XML nodes / depth 32, 100,000 path vertices / 1,024
fragments; preview PNG 2 MiB / 4,096 pixels per side / 16 million pixels. The
pinned non-interlaced 8-bit PNG form is validated, including bounded decompression
and CRCs, and metadata is removed. Unsupported preview does not destroy valid
numeric telemetry. XML DTD/entities, event handlers, scripts, external resources
and unsupported transforms are rejected. No raw SVG enters the browser.

`houseplan/trail/get` adds `vacuum_source_format:1` and small `vacuum_sources`
frames: exact source/robot, map/revision, position, bounds, native capability and
reason. They contain no SVG, PNG, image tokens or URL. The ordinary subscription
refreshes those frames; there is no client poll. `houseplan/vacuum/map_preview`
requires current editing permission and an authoritative configured marker,
source and map. Only that endpoint returns the sanitized PNG. Images/caches do
not enter trail storage, config, backups or support reports. No storage version
or user config migration is introduced. Auto-building House Plan from a robot
map is outside this feature.

The Ecovacs raster smoke (`node demo/smoke_vacuum_ecovacs.mjs`, #1009) waits
for the accepted device-dialog exit to detach before capturing the fit image.
On native Windows the retained modal darkened an earlier screenshot enough to
fail the original predicate: more than 1000 pixels with B−R > 50 and B−G > 40.
The predicate is unchanged. A transparent PNG response follows the same
screenshot/count path and must yield at most 1000 matching pixels despite its
visible bounds and four handles. No platform skip, fixed delay or pixel retry
is used. The pinned headless browser remains attested; this harness proof does
not establish a user-visible rendering failure or physical GPU acceptance.

Choosing a candidate stores `marker.vacuum.source`. A stored source is pinned:
it is never silently replaced when it becomes missing, disabled, unavailable,
unverified or unsupported. Restoring the same HA entity restores operation
without editing the plan.

| Status | Meaning and behaviour |
|---|---|
| `ok` | Valid live position is available |
| `unsupported` | Entity exists but has no valid position; its rooms/path may still be usable |
| `unavailable` | Exact HA entity exists but is currently unavailable; stale attributes are not rendered |
| `disabled` | Entity is disabled in HA; stale attributes are not rendered |
| `missing` | Authoritative registry and live states both prove that the saved entity is absent |
| `unverified` | Current HA permissions cannot prove existence or removal; the pin is preserved |
| `none` | No source was selected or found |

Registry-less YAML entities are valid: an exact live HA state is positive
evidence even when a full entity-registry response has no row. A disabled row
still wins. A selected camera without position data gets the XCME attribute
hint; arbitrary unselected cameras do not.

## Maps and floors (#162)

One robot can hold several maps, and each map belongs to one space. The dock
marker never moves: it stays in `marker.space`, while the live puck and the
current trail belong to the space of the map that is active right now.

A **route** is one saved answer to "this exact map of this exact source lives
here": `{ id, source, map_id, space, calibration }`. The exact source is part
of the identity, because two cameras can both report `default` and a map id
alone cannot tell two floors apart.

Route resolution has exactly one answer per frame:

| Result | What is drawn | When |
|---|---|---|
| `ready` | puck and trails in `route.space` | one route matches, its space exists, matrix is six finite numbers |
| `needs_calibration` | nothing | the matching route has no matrix yet |
| `unmapped` | nothing | the observed map is not assigned to any floor |
| `ambiguous` | nothing | two routes match at once — list order never picks a floor |
| `missing_space` | nothing | the route points at a space that was deleted |
| `none` | nothing | no source reports telemetry |

Every negative result is fail-closed on purpose: a robot drawn on a guessed
floor makes the plan a false statement about the house. While the robot is
moving, the dock shows an amber `mdi:alert-outline` badge whose accessible name
carries the exact reason.

With explicit routes, recording and live rendering use the same unique,
available exact `(source, map_id)` match (#918). The root source remains the
saved discovery/setup choice; it cannot supply the puck, tip or samples for
another camera's route, even if both cameras report the same map ID. A route
without calibration may still record raw positions for later display.
Unmatched/ambiguous events do not replace a trusted current/previous run.

Rules that follow from the identity being exact:

- source and `map_id` of a saved route are immutable; a wrong identity is
  deleted and added again, never silently re-pointed;
- changing the target space is a NEW route identity: the matrix was solved
  against the old space's geometry and the recorded runs were filed under the
  old id, so both are dropped after an explicit confirmation;
- deleting a space removes the routes that pointed at it — the confirmation
  states how many — and leaves the dock and the other routes alone;
- `default` stays a valid single-map id, but it is not proof of a stable
  multi-floor identity; the editor says so next to such a route.

The authoritative `houseplan/space/delete` candidate performs route cleanup
inside its existing revision-guarded config/layout pair (#822), including
hidden and removed carriers and deletion of the last space. An emptied
`map_routes` remains `[]`: retained legacy calibration must not become active.
Blocked, stale or missing-space requests change nothing. This is not a sweep
of older orphan routes into other missing spaces, nor a change to trail history.

## Calibration

Calibration belongs to the route: the matrix is solved against the rooms of
`route.space`, and the manual fit opens on that space rather than the dock's.

The legacy transform is a six-number affine matrix per map:
`marker.vacuum.calibration[map_id]`. Existing matrices are not migrated.

- **Automatic:** at least three room names must match. Robot anchors use
  `cx/cy`, then `center.x/y`, then explicit `x/y`, then the polygon area
  centroid of `outline`, and finally the centre of a complete `x0/y0/x1/y1`
  bounding box. The bbox tier is a compatibility fallback for integrations
  that expose no better room geometry. Plan rooms use the area-centroid
  definition.
- **Manual fit:** move and uniformly resize the translucent robot-room map;
  quarter-turn and mirror controls re-anchor around its centre.

The automatic residual is the worst matched-room error converted to physical
centimetres from the current grid. At `≤ 40 cm` the matrix is saved normally.
At `> 40 cm` nothing is saved until the user explicitly chooses **Apply**.
**Fit manually** opens the proposal in the fit overlay; **Cancel** leaves the
saved configuration byte-for-byte unchanged.

Calibration Save is complete only after Home Assistant accepts the config
write. While it is pending, automatic-calibration controls, a high-residual
proposal or the manual-fit overlay stay busy and cannot submit, close or move a
second draft. On rejection the last accepted matrix is restored immediately:
the Device editor remains open, a high-residual proposal keeps its exact matrix,
and manual fit keeps its exact transform for Retry. A rejected first-use
calibration also removes the unaccepted synthetic marker. Success closes the
relevant proposal/overlay and appears only after server acceptance.

Map ID uses one nullish chain and deliberately ignores volatile values such as
`vacuum_json_id`:

`map_name → current_map → source map_index → source selected_map → vacuum selected_map → default`

Numeric `0`, string `"0"` and an empty string are valid IDs.

## Paths and trails

### Appearance (#1002)

The accepted UI-012–015 appearance is a single `0.9` screen-pixel rounded
stroke, without a casing, default `#64B5F6` at 70% opacity. Each vacuum has
its own colour/opacity picker in device settings. Changes preview only that
robot's current path, animated tip and previous path; the previous run keeps
its additional `0.4` fading. Save commits after config ACK; discard restores
the accepted appearance. An untouched dialog never materialises defaults.
Source, map and calibration writes retain their existing immediate boundaries;
the appearance save merges into the latest vacuum config, not its opening copy.

Optional `trail_color` is `#RRGGBB`; `trail_opacity` is a finite numeric value
in `[0,1]`, not a boolean or numeric string. Missing/null fields use defaults
independently, including valid zero opacity. No migration or trail geometry
change is involved. JSON/ZIP/space backup retains the fields through the
ordinary config schema. Closed support projections intentionally omit these
appearance-only fields. Older strict backends may reject them: update card and
integration together, rather than retrying against an old backend.

With a format-2 trail backend the current visible path has one authority:

1. complete server snapshot from the exact supported integration, including empty;
2. server-sampled positions, with literal gaps;
3. local positions only when the backend does not advertise format 2;
4. no path.

An old/missing backend keeps the integration → server → local compatibility
order; HA attributes never bypass a format-2 server. Source-first authority
(#940, owner decision 2026-10-19) replaces the old local moving-reset proof:
the first valid current native snapshot can be used when connecting mid-cleanup,
without an invented job ID or observing the beginning of the path.
An explicit valid empty is also a complete value: current paths/points, cached
SVG and tip become empty, without substituting sampled positions. A retained
separate previous run stays available in Always. Repeated empty values create
no history slots. Even singleton → empty → singleton follows the provider;
House Plan does not hide an actual empty response to prevent flicker.
Absent/null/malformed/oversize/unavailable data and all-invalid nonempty input
are errors or missing information, not empty. They retain the last accepted
value (including accepted empty) and a separate reason. A malformed
point splits a fragment; boolean/string/nonfinite coordinates are not points.
Adjacent duplicates are removed; repeated visits are not. There is no index
thinning, newest-64 pruning or every-other-point Store decimation (#872).

Limits: 8 MiB provider JSON before our decode, 100,000 raw samples and 1024
fragments per run, 8 MiB normalized geometry and 64 MiB serialized entry data.
An oversize full snapshot is rejected whole. Position recording stops honestly
at its quota. Rendering has a shared 20,000-point current-before-previous quota
for all robots in the selected space; over-budget geometry is a contiguous
certified prefix plus a separate real latest-point dot, not a chord across
removed ranges. The dot shares the quota; with no remaining quota only
diagnostics can indicate `limited`. Legacy raw-ingest quota rejection also
reports `limited`, including when a compatible positional fallback remains.
Raw revisions and affine/grid keys own immutable geometry/SVG memoization;
unrelated HA updates, hover, pan and projection do not rebuild the full path.

Current and previous trails use the same bounded rounded-corner curve. The
curve preserves every subpath endpoint and never leaves the recorded polyline
by more than 17.5 cm in physical plan coordinates. Smoothing happens after
vacuum calibration and before flat/isometric projection, so zoom, viewport,
DPR and projection do not change that limit. Ordered simplification certifies
every original sample against a finite segment with monotone progress, at
most 2 cm after affine calibration. Reversals over 90° and endpoints survive.
Smoothing uses the remaining 15.5 cm allowance; shortest-roundtrip SVG numbers
add no unconditional decimal quantization. With an unverifiable physical
transform no physical simplification/smoothing claim is made. Native full paths
are neither target-trimmed nor connected synthetically to the puck. Only a
continuous, non-limited sampled fragment may have the existing animated live tip.

| Display mode | While moving | After movement stops |
|---|---|---|
| `never` | Hidden | Hidden |
| `cleaning` (default) | Current path | Hidden immediately |
| `always` | Current path | Stored current/previous runs (legacy integration fallback with an old backend) |

Server trails are recorded by `custom_components/houseplan/trails.py`, even
with no card open. It stores current and one previous run in raw robot
coordinates. An available non-moving state ends the visible current run
immediately. For position-only sources without provider session information,
a new point on the same map within an inclusive 30-minute grace reopens that
same run and keeps all earlier points. The first stop fixes
the timestamp: repeated dock/pause samples do not extend the window. A map
change, a longer stop, malformed persisted time or wall-clock rollback starts a
new run. `unavailable`, `unknown` and a missing state remain neutral. Without a
vendor task id, two genuinely separate position-only same-map cleanups started
inside the grace may therefore appear as one run. Native geometry and genuine
provider session information outrank these heuristics: a dock visit or a long
pause never truncates a native path. Full snapshots replace, never append to,
the current geometry; digest/frame/map/receive time are not invented session IDs.

**Device editor → Vacuum → Source and path display** offers **New path after
docking when no integration path is available**. The optional shared
`marker.vacuum.new_run_after_dock` is Off when absent/null/false; only true enables
it. Without integration path/session authority, an observed real bound vacuum's
`docked` followed by `cleaning` rotates current to previous once, even inside
the grace. Idle/paused/error/returning/on/unknown/unavailable intermediates keep
that proof; returning/on alone does not consume it. A service dock visit also
splits this sampled path. Enabling mid-cleaning never retroactively clears it.
Disabling, rebinding, removal or live Off cancels unconsumed proof; ordinary
restart retains proof/consumption in the existing private Store. Native data
always wins regardless of the toggle. Errors of a previously supported native
channel do not silently switch its boundaries to positional heuristics.
The setting applies after the ordinary config-write ACK. Unsupported backends
show a disabled switch and update/restart guidance, retaining the saved value.

Opening or reopening the card during cleaning restores positions already
recorded on the server. If an old run has no route identity and an exact
explicit route becomes available, recording starts a new identified run;
the old points stay in the previous slot without being relabelled. The
transition also happens on refresh/restart or source recovery, without an
editor save or a new cleanup. Missing historical samples cannot be recovered
from a camera that only supplies the current position.

The position teleport guard splits when calibrated distance exceeds
max(100 cm, 200 cm/s × trustworthy positive elapsed seconds). Unknown periods,
map/source changes and pause/resume break fragments even without physical
scale proof. Full snapshots require exact available source/map/route and known
coordinates/schema, not proof of a locally observed cleanup start. Run generation
and a separate collector attempt fence reject retired owners and reads superseded
by newer source observations, including when the generation did not change.
Provider revision checks remain separate from inferred cleanup boundaries.

### Provider passports (#872)

| Provider | Proven channel/schema/coordinates | Live / final capability | Fallback |
|---|---|---|---|
| Dreame Vacuum / Tasshack 2.0.2 (`f5b8472b8e2e4bb3dff7bc2a81a5fd594eca9585`) | Exact registered ordinary camera, public `map_data_string(include_resources=False)`, `map_index == 0`, ordinary JSON `version:2`. Ordered chunks `[1/2/3,x,y,…]` (S/W/M; L continues the chunk). Raw millimetres, same axes/origin as `robot_position`; not pixel/Valetudo coordinates. Private provider key includes map_id/saved_map_id/map_index; frame_id orders revisions, not jobs. | Shared server read, active poll 30 s, minimum 10 s, timeout 10 s; one initial stopped-source read uses the same lease. An in-flight physical lease survives timeout/unload/reload. Backoff 30/60/120/300 s. On available stop, attempts at 0/15/45 s, ≤3 in 60 s under the same limits. No proven stable job id or explicit final marker: final remains **unconfirmed**. | Missing interface or unverified coordinates/schema cannot establish native authority. A proven native channel retains last accepted geometry/empty on read error, not guessed dock boundaries. No token, self-HTTP, forced-update service or private coordinator. |
| Xiaomi Cloud Map Extractor / generic attributes | Existing `path`, nested `path.path`/`path.points`, flat x/y tuples or x/y objects, optionally multiple fragments. Same saved source and raw coordinate system as position/calibration. Predicted goto is ignored. | Initial state and HA events; no added vendor poll. No fabricated job/final metadata. First valid nonempty/explicit empty follows source-first authority above. | Sampled positions if no path is supplied; enable XCME `path` attribute if absent. |
| Valetudo / core Roborock | Existing compatible positions or generic attributes only. PNG path pixels are not structured path data. | No new raw-MQTT decoder, raster tracing or private coordinator access. | Positions or no path; native support is not claimed. |

Primary pinned sources: [public camera bridge](https://github.com/Tasshack/dreame-vacuum/blob/f5b8472b8e2e4bb3dff7bc2a81a5fd594eca9585/custom_components/dreame_vacuum/camera.py),
[ordinary serializer, including path chunks](https://github.com/Tasshack/dreame-vacuum/blob/f5b8472b8e2e4bb3dff7bc2a81a5fd594eca9585/custom_components/dreame_vacuum/dreame/map.py#L8335-L8349).
These prove upstream compatibility, not a blanket promise for every installed
version/model. The owner's private X50 2.0.2 snapshot decodes 201 points without
coordinate loss; this is only partial real-device evidence, not end-to-end/GPU
acceptance. Personal maps are not committed or automatically attached to support.

The device editor's existing diagnostics separately show source health, path
source, quality/reason, received/stored/drawn counts, last sample/snapshot time
and whether the source explicitly confirmed the final snapshot. No new user
cleanup commands are added. Explicit empty reports **The integration reported
an empty path**, native source and zero current received/stored/drawn points;
a singleton has one received/stored point but no drawable line.
The **Path display** row explains a suppressed path separately from recording
quality: display mode or stop, unavailable/ambiguous/unassigned map, missing
calibration, another floor, unmatched stored run, or insufficient consecutive
points. It uses the same route applicability, target trim and rendering quota
as View. A sampled path with unconfirmed final status remains drawable.

Store version stays 1 with additive per-run `path_format:2`, `paths`, `quality`,
`provenance` and private generation/provider identity. Legacy `points` projects
one contiguous fragment for downgrade, never flattened gaps. Malformed known
runs are isolated; unknown future formats are not interpreted or rewritten.
The authenticated shared read policy is unchanged; only the allowlisted public
shape reaches clients, without source/job identity, raster or access tokens.
Events are throttled to 2 s with a trailing update; Store writes retain their
10 s debounce and teardown flush. To preserve full geometry before downgrade,
back up `.storage/houseplan.trails`: ordinary plan/support exports are not trail
backups, and an old writer may discard additive fields.

Server recording is independent of the display mode. The source
health monitor checks saved marker/source pairs on config refresh and restart:
one warning is emitted for a missing/disabled incident, reason changes are
deduplicated, and another warning is possible only after proven recovery.
Detection is intentionally refresh/restart based; no extra entity
registry subscription is installed.

## Storage and lifecycle

An event-driven `trail/get` keeps the connection/user and subscription generation
that started it (#901), rechecked after the response. Only the latest request of
that subscription may publish trails/format. A replaced context, detach or late
rejection leaves the new owner's last-good path unchanged; ordinary same-owner
updates continue without an added timer or server request.

```text
marker.vacuum = {
  live?, trail?, trail_mode?, trail_color?, trail_opacity?, new_run_after_dock?, source?,
  calibration?: { [map_id]: [a,b,c,d,e,f] },   // legacy-read after #162
  map_routes?: [{ id, source, map_id, space, calibration? }],
  room_highlight?, segment_map?    // schema only: no runtime consumer (#12)
}
```

`room_highlight` and `segment_map` are accepted and round-tripped so that plans
written by any version stay readable, but nothing draws them: the room-cleaning
highlight (#12) was rejected, not shipped. A live vacuum draws its puck, its
trail and — on an unmapped map — the route warning; that is the whole overlay.

All fields are optional and old plans remain readable. When `map_routes` is
absent or `null`, every valid `calibration[map_id]` is read as an effective
route into the dock's space, so a plan made before #162 renders byte for byte
as before. Any array is explicit authority: `map_routes: []` means that no map
is assigned and must not revive a retained legacy matrix. The first explicit
routing edit converts the whole dictionary at once — all matrices or none —
and needs an exact source to do it; `calibration` is dropped only after the
config write succeeds. Where both exist, `map_routes` is the only authority
and the legacy dictionary takes no part in rendering. A single-space export
also preserves an explicit empty array when all foreign routes are filtered.

A stored run carries the route that wrote it:
`{ route_id, source, map_id, started, ended, points }`. A run recorded before
#162 has neither `route_id` nor `source`; it is adopted at read time by the
routes of the same marker whose `map_id` matches, narrowed by the marker's root
`vacuum.source` when that still exists. Exactly one candidate means the run is
drawn in that route's space; zero or more than one means it is drawn nowhere
and left untouched on disk. Hiding retains the
configuration. Deleting a vacuum marker removes its layout and server trails,
creates the normal removal tombstone and makes the HA device available for a
fresh add without resurrecting old runs. The backend reconciles both a removal
tombstone and a completely absent marker with the trail store after every
successful config change, so an interrupted browser-side cleanup is repaired.
An initial position sampled during integration startup follows the same
debounced persistence and live-update path as a later state event.

## Code ownership

- `src/vacuum-routes.ts` is the only answer to "which map is on which floor":
  `effectiveRoutes()` (explicit `map_routes`, or the legacy `calibration`
  dictionary as routes into the dock's space) and `resolveRoute()` (the six
  results above, never a guess). The result is computed once per frame into
  `render-device-snapshot.ts` (`facts.get('vacuum:<id>')`) so `render()` cannot
  derive a second answer; `planVacuumOverlay()` decides what the visible space
  draws.
- `src/vacuum-runtime-source.ts` composes that route result with the source's
  telemetry for the recorder-equivalent View choice. Snapshot capture retains
  all configured route sources, including cameras on another HA device.
- Route editing lives only in the lazy editor graph (`vacuum-route-edit.ts`,
  `editors/vacuum-maps-section.ts`); the View card never loads it.
- `custom_components/houseplan/vacuum_routes.py` mirrors the resolver and the
  legacy-run adoption rule byte for byte, driven by `test/fixtures/vacuum-routes/`;
  a divergence shows up as a robot on the wrong floor.
- `src/vacuum.ts` owns pure normalization/arbitration: paths are always
  `Pt[][]`; `resolveCurrentVacPath()` is the only integration → server → local
  decision; `resolveVacSource()` pins saved sources and limits automatic
  selection to compatible same-device entities; the card adds registry status
  through `resolveHaBindingStatus()`.
- `smoothVacPath()` takes calibrated flat plan coordinates and returns typed
  `move|line|quadratic` commands for a caller-supplied physical radius; the card
  then projects (flat/2.5D) and serializes. Each corner is a quadratic inside the
  adjacent-segment convex hull, bounded by half of both segment lengths, which
  makes the 17.5 cm limit, exact endpoints and subpath gaps structural.
- Auto-calibration uses the same shoelace `areaCentroid()` for plan polygons and
  robot outlines; residuals go through resolved grid pitch and `cell_cm`.
  `trails.py` owns current/previous runs and the refresh-time `(marker, source)`
  health state.

## Troubleshooting

1. Open the vacuum's device settings and read the source diagnostics.
2. If no same-device source is found, open **Choose source → All cameras** and
   select the actual map camera.
3. For XCME, enable the four attributes shown above and reload that entity.
4. Ensure the active map has a calibration and the vacuum state is
   `cleaning`, `returning` or `on`.
5. A disabled source must be re-enabled in HA or replaced explicitly; House
   Plan will not guess a replacement.

Commands, zones/no-go polygons, cleaning-history UI and Roomba string parsing
are outside this contract.

## Deleting and restoring a vacuum marker (#369)

Deleting a vacuum marker erases its server-side trail immediately: the next
`config/set` purges trails of removed markers (#335), so an undeleted (re-added
or restored) vacuum starts its trail from scratch. This is deliberate — a
tombstone that kept trails alive used to leak the store — but it means trail
history does not survive marker deletion.
