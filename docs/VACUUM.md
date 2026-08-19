# Live robot vacuums on the plan

Status: implemented contract for the v1.61 development cycle. Stage 1 covers
Tier-A integrations. Roomba string-position support remains a separate Stage 2
issue and is not claimed here.

## What the user sees

The placed vacuum marker is the dock and never moves. While the vacuum is in
`cleaning`, `returning` or `on`, a second round puck follows the live position.
Clicking the puck opens the vacuum's HA more-info dialog. A hidden, deleted,
HA-disabled or `static_icon` marker has no puck, trail or room overlay.

## Integration coverage

| Integration family | Position | Rooms / auto-calibration | Integration path | Map ID | Source discovery |
|---|---:|---:|---:|---|---|
| Xiaomi Cloud Map Extractor | Yes, when the attributes below are enabled | Yes | Yes, including `path.path` subpaths | `map_name` when exposed | Usually explicit camera selection |
| dreame-vacuum (Tasshack) | Yes | Yes; explicit room `x/y` is the anchor | No | Vacuum `selected_map` fallback | Automatic on the same HA device |
| Valetudo camera conventions | Yes | Yes when room data is exposed | No | Often `default`; no stable multi-floor promise | Automatic on the same HA device |
| Roomba core `position` string | Not in Stage 1 | No | No | — | Stage 2 |

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
scanned only when opened and is never used for automatic binding.

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

## Calibration

The stored transform is a six-number affine matrix per map:
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

Map ID uses one nullish chain and deliberately ignores volatile values such as
`vacuum_json_id`:

`map_name → current_map → source map_index → source selected_map → vacuum selected_map → default`

Numeric `0`, string `"0"` and an empty string are valid IDs.

## Paths and trails

The current visible path has one authority:

1. drawable integration path;
2. drawable current server run;
3. drawable local runtime buffer;
4. no path.

An integration path can contain several subpaths. They are transformed and
thinned independently and rendered with separate SVG `M` commands, so a data
gap never becomes a long false line. Invalid points and segments shorter than
two points are discarded before limits are applied. The newest 64 drawable
subpaths are kept, with at most 4000 total points; both endpoints of every kept
subpath survive deterministic proportional thinning.

| Display mode | While moving | After movement stops |
|---|---|---|
| `never` | Hidden | Hidden |
| `cleaning` (default) | Current path | Hidden immediately |
| `always` | Current path | Current integration path or stored current/previous runs |

Server trails are recorded by `custom_components/houseplan/trails.py`, even
with no card open. It stores current and one previous run in raw robot
coordinates. An available non-moving state ends the visible current run
immediately, but a new point on the same map within an inclusive 30-minute
grace reopens that same run and keeps all earlier points. The first stop fixes
the timestamp: repeated dock/pause samples do not extend the window. A map
change, a longer stop, malformed persisted time or wall-clock rollback starts a
new run. `unavailable`, `unknown` and a missing state remain neutral. Without a
vendor task id, two genuinely separate same-map cleanups started inside the
grace may therefore appear as one run.

Server recording is independent of the display mode. The source
health monitor checks saved marker/source pairs on config refresh and restart:
one warning is emitted for a missing/disabled incident, reason changes are
deduplicated, and another warning is possible only after proven recovery.
Detection is intentionally refresh/restart based in Stage 1; no extra entity
registry subscription is installed.

## Storage and lifecycle

```text
marker.vacuum = {
  live?, trail?, trail_mode?, source?,
  calibration?: { [map_id]: [a,b,c,d,e,f] },
  room_highlight?, segment_map?
}
```

All fields are optional and old plans remain readable. Hiding retains the
configuration. Deleting a vacuum marker removes its layout and server trails,
creates the normal removal tombstone and makes the HA device available for a
fresh add without resurrecting old runs.

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
are outside Stage 1.
