# Live robot vacuums on the plan — the spec (source of truth)

Status: approved by the owner 2026-07-31. Scope decisions final: all
three Tier-A adapters in P1, the trail ships in P1, the marker's placed
position IS the dock, and tap-to-clean is out — display only, no
commands (owner: «не нужно вообще»).

## Principle

The device marker «Пылесос» NEVER moves: it stands where the user
placed it — that is the base/dock — with its normal badge, states and
tap actions. While the robot cleans, a SECOND visual appears: a round
puck (the vacuum icon in a circle), no badge plate, with a soft
pulse, driving around the plan on live coordinates. Owner's exact
wording: «Иконка движущегося пылесоса должна быть круглой, без
подложки и с легкой пульсацией. Основное устройство "Пылесос" при этом
остается всегда на своем месте (база)». The puck is not clickable UI
chrome duplicating the device — a tap on it opens the same more-info as
the base marker. When the robot docks, the puck drives home and
dissolves into the base marker.

## Data tiers (auto-detected, zero user input)

- **Tier A — coordinates + own calibration data.** `vacuum_position
  {x,y,angle}` (+ `calibration_points`, rooms, sometimes `path`):
  Xiaomi Cloud Map Extractor, dreame-vacuum (Tasshack), Valetudo camera
  (sca075). All three ship in P1.
- **Tier B — bare coordinates.** Roomba core (`position {x,y,theta}`),
  raw Valetudo MQTT, template sensors. Works after manual calibration.
  P3.
- **Tier C — current room only.** `current_room` / `current_segment`.
  The room being cleaned gets a soft fill pulse + a 🤖 badge in the
  room card; no puck. Segment→room matched by name, manual override in
  the dialog.
- **Tier D — nothing.** Today's behaviour; yellow badge on the base
  marker while cleaning per the «yellow = working right now» principle.

Tiers degrade gracefully: coords gone → room highlight; that gone too →
just the base marker.

## Coordinate binding

Affine transform (translate+rotate+scale+mirror), 6 numbers, least
squares over ≥3 point pairs. Stored per robot map:
`marker.vacuum.calibration[map_id]` — multi-floor robots get one matrix
per map; an active map without a matrix falls back to Tier C.

- **Path 1, auto-calibration by rooms (the default):** Tier-A adapters
  expose the robot's room list with coordinates; our rooms carry HA
  area bindings. Match by name, take centroids of ≥3 matches, solve,
  show a live preview («робот сейчас здесь») — one click to confirm.
- **Path 2, the fit panel (replaced the 3-point wizard, owner call
  2026-07-31):** the robot's rooms render as a translucent dashed ghost
  over the plan; the user DRAGS the ghost into place and stretches it by
  its four corner handles (uniform scale about the opposite corner, like
  a graphics-editor frame). Rotation is quarter-turn buttons, mirror is
  one toggle — both re-anchor about the ghost centre. Mirror defaults ON:
  every robot map seen so far has Y flipped versus the screen. No numeric
  fields; the old park-the-robot-three-times wizard is gone entirely —
  it was the most fragile part of the feature.
- The panel folds into the same stored 6-number matrix
  (S·R(rot)·mirror + offset); legacy matrices reopen in the panel with
  the rotation snapped to the nearest quarter.

## Puck behaviour

Appears when the robot leaves `docked` AND live coords flow; CSS
interpolation ~1.2 s between updates; a data gap over 10 s teleports
without animation (no gliding through walls on sparse cloud updates).
Soft pulse always while visible (respects prefers-reduced-motion: the
pulse freezes, position still animates). Size: same --icon-size
system as devices, circle, transparent background, no badge plate.
Stale coords (>60 s while «cleaning»): puck freezes and dims. On
`docked`/`idle`-at-base the puck rides home and fades out. Hidden
markers render neither base nor puck (general hidden rules). Works in
the full card, static card and kiosk; in editors no puck — the base
marker is edited as usual.

## Trail (ships in P1)

- Integration `path` when available (Map Extractor) — transform and
  draw as-is, includes history from before the card was opened.
- Otherwise self-recorded: client-side ring buffer, ~600 points with
  Douglas-Peucker thinning, one SVG polyline.
- Style fixed, no options: cartography casing — a dark translucent halo under a light core. Neutral (pure black/white alphas) and readable over any room fill; blend modes were rejected: each has a blind luminance where the line vanishes, and mix-blend-mode is costly on old kiosk WebViews. Lifecycle:
  appears on cleaning start, lives until dock + 10 min, dissolves;
  `docked → cleaning` clears the old trail. Ephemeral, never stored.
- Marker option «Показывать след уборки», on by default where data
  exists.

## Setup UX

A «Живая позиция» section in the device dialog, vacuum markers only:
status line (which source was found / room-only / nothing), one button
(«Настроить автоматически» for Tier A, «Калибровка по трём точкам» for
Tier B), three checkboxes (live position / trail / room highlight, all
on), and for multi-map robots a per-map calibration status list. The
source entity is discovered via the device registry — no YAML, no
entity pickers.

## Storage & validation

`marker.vacuum: { live, trail, room_highlight, source, calibration:
{[map_id]: [6 numbers]}, segment_map: {[segment]: room_id} }` — all
optional (old configs stay valid), matrices are 6 finite numbers,
backend-validated. Calibration is server-side state shared by every
screen, like the whole plan.

## Cases covered explicitly

Two vacuums (independent markers, calibrations, pucks); one robot on
two floors (maps ↔ spaces, the puck only renders in the space whose map
is active); robot outside the plan (±4 canvas bounds allow it, trail
clipped by viewport); integration restart changes map_id (rebind by
room-list match, else ask to recalibrate); user redraws rooms (the
matrix does not depend on rooms); demo stand gets a scripted synthetic
robot as the showcase.

## Out of scope

Commands of any kind (owner decision: display only) — no tap-to-clean,
no zone sending. No-go zones, cleaned-area polygons, cleaning history,
multi-robot collision avoidance — v2 candidates.

## Phases

- **P1:** adapter framework + all three Tier-A adapters +
  auto-calibration by rooms + manual 3-point wizard + the puck + trail (both sources).
- **P2:** Tier C room highlight + the demo-stand scripted robot.
- **P3:** Tier B zoo (Roomba, raw Valetudo MQTT), Deebot, multi-map
  polish by feedback.
