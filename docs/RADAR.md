# Presence radars

Stage 1 of [#485](https://github.com/Matysh/houseplan-card/issues/485)
projects current Home Assistant radar observations onto one House Plan room.
It is intentionally a visualization and setup feature: House Plan does not
identify people, record tracks, configure hardware zones or create derived Home
Assistant entities at this stage.

## What appears on the plan

- Cartesian or polar coordinates become small live target dots.
- A distance-only source becomes an arc or full range circle. It is not
  presented as an exact person position.
- Known zone states may be presented as occupied/clear state; unknown geometry
  is never invented.
- Presence-only sources report presence and health but do not fabricate a dot.
- Coordinates, arcs and known zone geometry are clipped to the selected room's
  real polygon, including concave rooms. A missing room is an error and never
  falls back to another room or to its bounding box.

The layer is pointer-transparent. Small verified jumps may transition smoothly;
large jumps, source gaps, slot changes, calibration changes and non-convex room
contours never animate through an unverified path. Reduced-motion mode disables
target motion. The diagnostic trail is limited to eight seconds and exists only
inside the current browser session.

## Supported input profiles

| Profile | Required source data | Result |
|---|---|---|
| ESPHome LD2450 | One to three exact X/Y sensor pairs, millimetres | Target dots; `x=0,y=0` together means an absent target, while one zero axis is a valid coordinate |
| Cartesian | One to eight exact X/Y pairs, explicit unit, axis order and directions | Target dots |
| Polar | One to eight exact distance/angle pairs, explicit length/angle units and angle convention | Target dots |
| Distance only | One or two exact distances, explicit unit and known/entered direction/FOV | Honest range arcs |
| Zone states | Exact occupancy/count entities | Read-only states; outlines only when geometry is actually known |
| Presence only | Exact binary presence entity | Presence and health without a position |

An optional global availability entity and per-target/range presence gates may
make absence explicit. Numeric zero remains data unless the selected adapter
defines an exact pair rule such as LD2450's `(0,0)`. Empty strings,
`unknown`, `unavailable`, NaN and infinity are never converted to zero.

## Configure a radar

1. Add or open the real device marker in the **Device editor**.
2. For a recognized radar, open **Presence on the plan**. For custom hardware,
   use **Additional actions → This is a presence radar**.
3. Enable the radar, choose the room and verify every exact source. For generic
   profiles, specify units and coordinate conventions explicitly.
4. Use **Check live data** before calibration. Correct unavailable, stale,
   partial or contradictory values in Home Assistant or the source mapping.
5. Enter the physical mounting point, heading, range and field of view manually,
   or use **Configure on plan**. The latter records the mount and a point straight
   ahead. Coordinate profiles then measure two separated reference positions.
6. Optionally check a third position. Its error is diagnostic and does not alter
   the solved transform.
7. Apply the setup, then use the ordinary marker **Save**. Until that final Save,
   Cancel, Escape, page hide or a config revision conflict discards the draft.

The physical mount is not the decorative icon position. Moving the icon later
does not move or recalibrate the radar. Changing the radar source/profile,
coordinate convention, room or physical installation invalidates an accepted
calibration; display-only switches do not.

Use a desktop browser for calibration. Touch View/kiosk remains fully supported,
but precise editor setup on touch is best effort.

## Health meanings

| Status | Meaning |
|---|---|
| Current data received | Complete, fresh source data was normalized |
| No targets detected | An explicit absence was reported |
| Some coordinate data is out of date | One or more paired values exceeded the freshness/skew contract |
| Presence reported; current position unavailable | Presence is true but no honest current coordinate is available |
| Sensor data unavailable | A required source or availability gate is unavailable |
| Installation needs setup | Sources exist but physical mapping is incomplete |
| Sources report conflicting values | Fresh sources contradict each other, for example a zero target count with current target coordinates |

Coordinate/range reports have short server leases and disappear when they are
not refreshed. Reopening a tab, reconnecting or changing a source/calibration
starts a new ordering epoch; an old frame cannot resurrect a target.

## Privacy, permissions and storage

House Plan subscribes only to the exact configured entity IDs. Read delivery is
filtered through the current Home Assistant user's entity permissions; setup
requires House Plan write permission. Payload sizes, subscriptions and update
rates are bounded.

Saved configuration contains source entity IDs, selected room, physical mount,
orientation, units and calibration — not observations. Raw source values,
measurement samples, live targets, trails and health frames are runtime memory
only. They do not enter plan export/import, support diagnostics, uploaded files,
browser storage or Home Assistant history through House Plan. Home Assistant and
the source integration may independently keep their normal entity history.

Virtualized plan imports intentionally drop hardware-specific radar bindings.
Unknown future radar versions remain preserved but inert until supported.

## Troubleshooting

- **The section is absent:** only positively recognized hardware or an already
  saved radar gets the main section. Use the manual action for a custom real
  device. Virtual markers cannot own a radar binding.
- **The source list is incomplete:** ensure the entity is enabled and readable
  by the current Home Assistant user. Manual mapping can use exact entities from
  different devices.
- **Targets are missing:** inspect health first. Verify units, axis signs, room,
  mount and heading. For LD2450, do not treat `x=0` or `y=0` alone as absence.
- **A target stops at the room boundary:** this is the intended safety clip.
- **Calibration is noisy:** repeat with one stationary person, separated
  references and no second reported target.

The normative engineering contract is
[`docs/specs/485-radar-presence-stage1.md`](specs/485-radar-presence-stage1.md).
