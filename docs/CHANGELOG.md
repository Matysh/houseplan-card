# Changelog

## Unreleased

- Repeating “Optimize plans” immediately after a successful run now correctly
  reports that there is nothing to fix, including after the backend update
  event or a page reload. Optimize compares and retains the same nine-decimal
  geometry representation that the integration persists, so the binary
  `1/240` grid step no longer returns as freshly removed coordinate noise
  ([#248](https://github.com/Matysh/houseplan-card/issues/248)).

- “Optimize plans” now restores device references left behind by deleted or
  independently imported spaces. Exact import copies keep their positions;
  other active devices safely lose only the missing placement and return via
  their HA Area or the first space. The preview reports repaired and unresolved
  references. A space that still contains active devices cannot be deleted while
  another space remains; the sole remaining space can be removed without losing
  marker bindings or settings. A space import repairs matching target
  references, and the card editor warns when `default_floor` names a missing space
  ([#244](https://github.com/Matysh/houseplan-card/issues/244)).

## v1.67.0-beta.2 — 2026-08-22

- Door, window and gate symbols now sit on the centreline of thick room and
  independent walls by default, consistently in placement preview, Flat,
  Static and hidden Iso. Existing flipped doors/windows keep their explicit
  edge alignment; gates remain centred while the flip reverses their 10°
  opening direction on shared room and independent walls without a second
  mirror inversion, and jambs still span the full wall depth
  ([#242](https://github.com/Matysh/houseplan-card/issues/242)).

- Space tabs can once again be reordered with a real mouse drag in an editor.
  Browser pointer capture no longer traps the drop target on the held tab; a
  divider now marks the exact side where the space will be inserted, and
  releasing outside the tab strip leaves the saved order unchanged
  ([#243](https://github.com/Matysh/houseplan-card/issues/243)).

- Decorative lines, shapes, text and furniture are now drawn above opaque room
  fills, room hover, doorway fill and the dark Glow base, so the floor no
  longer hides them. Live light and sun, walls, opening symbols, devices and
  room labels keep their existing position above decor
  ([#231](https://github.com/Matysh/houseplan-card/issues/231)).

## v1.67.0-beta.1 — 2026-08-22

- “Optimize plans” now verifies the exact preview candidate with the same wall,
  opening, partition, column and floor geometry builders used by the card. If
  any space cannot be built safely, the preview names up to three affected
  spaces, explains how to report the problem and offers only Cancel: config,
  layout, revisions and the one-deep Undo snapshot remain untouched
  ([#199](https://github.com/Matysh/houseplan-card/issues/199)).

- Every config and device-layout write now canonicalizes persisted geometry to
  nine decimal places without snapping it to the grid. This removes invisible
  floating-point tails before they can break shared walls, room unions or Glow;
  import, maintenance recovery and server Undo use the same invariant. Repeating
  an unchanged canonical Save no longer creates a revision or consumes the
  one-deep Undo snapshot. Existing noisy plans are cleaned on their next write,
  or immediately through Optimize Plans
  ([#224](https://github.com/Matysh/houseplan-card/issues/224)).

- Grid precision no longer changes the appearance of the same physical plan.
  Room and wall outlines, openings and their hit areas, Plan hints, the static
  card and hidden isometric geometry now retain the `cell_cm: 5` visual size at
  every supported cell size, while physical objects and screen-fixed controls
  are not scaled twice. New metric spaces start at 1 cm per cell; imperial HA
  starts at 1 inch per cell and shows inches in the field. Existing values are
  neither migrated nor rounded when settings are opened and saved
  ([#239](https://github.com/Matysh/houseplan-card/issues/239)).

- While placing a door, window, gate or open passage, Plan now shows the usable
  distances from both jambs to the physical inner ends of the wall, with thin
  dimension lines and endpoint ticks. A shared wall shows four measurements —
  two for each room — and an independent wall measures to the nearest face of a
  connected wall or falls back to its own endpoint
  ([#238](https://github.com/Matysh/houseplan-card/issues/238)).

- Plan drawing is now fail-closed where precision matters: the active wall
  shows its centreline and endpoint, visually inseparable nodes ask for zoom,
  and Shift accepts only an exact 45° ray endpoint or wall intersection. A
  click inside an already closed empty wall contour can create its room; one
  unambiguous gap up to 2 cm is repaired only together with that confirmed
  room; ambiguous wider gaps remain ordinary drawing, and a wall carrying a
  hosted opening is never moved by repair. Deleting a room now explicitly
  offers to keep its exclusive physical walls or delete them, while shared
  walls and their openings survive
  ([#228](https://github.com/Matysh/houseplan-card/issues/228)).

- Resizing a room now reports the distance between wall faces, the number a tape
  measure gives: a 300 cm span between 15 cm walls reads 285 cm. The area label
  was already computed from the floor, so one bubble used to carry two
  conventions and neither number could be checked against anything. A passage or
  a side open to the next room keeps its full length, because there is no face to
  measure from. Area still subtracts columns and partitions, so length times
  length may differ from it — that gap is furniture in the room, not a change of
  ruler ([#233](https://github.com/Matysh/houseplan-card/issues/233)).

- A chain of walls now stores the thickness it was drawn with. A segment whose
  thickness was not recorded — which happened while the toolbar field was being
  edited between segments — used to be previewed at the drawn value and saved at
  15 cm, and the plan only revealed it later when the Thickness tool reported a
  number nobody had chosen. Preview, both writers and the Thickness highlight now
  read one resolver: a historical missing record inherits the previous segment,
  while the live rubber-band uses the current field value and therefore no longer
  changes thickness on click
  ([#234](https://github.com/Matysh/houseplan-card/issues/234)).

- Wall hatching no longer changes density with the space's grid scale. The same
  15 cm wall used to look different on plans with different `cell_cm` — from a
  dense set of stripes to almost none, a 25× spread. The step is now a distance
  on the plan (9.6 cm at any grid scale), which is exactly today's look at
  `cell_cm: 5`, and a wall twice as thick gets twice the stripes, like on a
  construction drawing. Hatching also stopped shifting as you zoom
  ([#230](https://github.com/Matysh/houseplan-card/issues/230)).

- A straight wall drawn in several clicks is now stored as one partition:
  seams between segments of the same thickness and direction are merged as soon
  as the chain is finished. A node stays only where something holds it — a third
  wall, a room wall, a column or the end of a saved draft. Older plans lose
  their seams through “Optimize plans”, reported on its own preview line; doors
  and windows keep their place
  ([#229](https://github.com/Matysh/houseplan-card/issues/229)).

- Space tabs can be reordered: grab a tab with the mouse in any editor mode and
  drop it where it belongs. The order is saved, and swipe and carousel
  navigation follow it. Markers stay exactly where they were
  ([#220](https://github.com/Matysh/houseplan-card/issues/220)).

- “Optimize plans” now removes microscopic floating-point noise from stored
  grid coordinates even when nothing visibly moves. Its preview separately
  reports updated spaces and cleaned coordinate values, and a second run is an
  exact no-op ([#223](https://github.com/Matysh/houseplan-card/issues/223)).
- Placing an individual Home Assistant entity no longer leaves a duplicate
  automatic marker of its complete parent device. The automatic marker now
  contains only the remaining active visible entities and disappears when
  none remain; two explicitly placed entity/device markers still coexist
  ([#226](https://github.com/Matysh/houseplan-card/issues/226)).
- Fixed a backup with PDF attachments refusing to import back with "The backup
  contains invalid or inconsistent content references". Attachment links that
  carry a cache-buster (`…/files/marker/doc.pdf?v=1783170649`) are now resolved
  by their path, as a URL rather than as a string
  ([#225](https://github.com/Matysh/houseplan-card/issues/225)).

## v1.66.0 — 2026-08-20

- Text device markers once again use a capsule-shaped outer outline instead of
  an ellipse.
- Glow no longer disappears from an entire space because of floating-point
  noise or one malformed room outline.
- Door and gate locks use green for locked and red for unlocked, while glyphs
  on orange device cores follow the light and dark themes consistently.
- Small fixes and improvements.

## v1.66.0-beta.1 — 2026-08-20

- Door and gate locks now use green for locked and red for unlocked on both
  compact opening badges and ordinary device markers. Every glyph on an orange
  device core is now white in the light theme and dark in the dark theme
  ([#219](https://github.com/Matysh/houseplan-card/issues/219)).
- Fixed Glow disappearing from an entire space when harmless floating-point
  tails or one malformed room outline upset floor clipping. Boolean inputs are
  now stabilised at render time, and a residual failure is isolated to the
  affected room without allowing light outside valid floors
  ([#218](https://github.com/Matysh/houseplan-card/issues/218)).
- Fixed Text device markers whose outer outline became an ellipse instead of
  matching the capsule-shaped value core and designer reference
  ([#217](https://github.com/Matysh/houseplan-card/issues/217)).

## v1.65.0-beta.9 — 2026-08-20

- Device marker cores now stay concentric with their outer shell at fractional
  sizes and common DPRs. Their current footprint is preserved without a late
  `0.9` visual factor, while the MDI glyph is 10% larger. A value capsule owns
  hover and the configured action across its complete visible area; opening
  lock badges follow the compact light/dark Lock/Unlock artwork; and marker
  LQI colours again move continuously from red to green
  ([#213](https://github.com/Matysh/houseplan-card/issues/213)).

## v1.65.0 — 2026-08-20

- Plan editing now uses one continuous Walls workflow, supports open passages
  and Home Assistant-aware openings in independent walls, and preserves exact
  wall thickness, snap gaps, junctions and room geometry through preview,
  optimization, import and rendering.
- Device placement and control are more predictable: exact toggle entities,
  registry-less opening bindings, linked virtual lights, room assignments
  without HA Areas and explicit appliance run states all follow the same live
  Home Assistant sources.
- Spaces can be exported as plan-only templates or pinned to one configured
  floor. New-space defaults, room labels, humidity tooltips and robot trails
  now stay consistent across the supported views and editing flows.
- Device markers use the new light/dark design system across plan, kiosk,
  editor preview and static cards, including complete interaction capsules,
  touch-safe hover handling, activity and availability states, opening locks
  and a continuous LQI colour scale.
- Small fixes and improvements.

## v1.65.0-beta.8 — 2026-08-20

- Device markers are now 10% more compact without moving their saved centres or
  shrinking the 44×44 px interaction floor, and wide Text markers keep uniform
  capsule insets. A real toggle/run dispatch gives a smooth 5% press response
  for 200 ms (with a reduced-motion alternative). Touch and pen no longer leave
  room, marker, Device preview or shared-control hover stuck; a real mouse
  restores hover on hybrid hardware without reloading
  ([#212](https://github.com/Matysh/houseplan-card/issues/212)).

## v1.65.0-beta.7 — 2026-08-20

- A card instance can now be pinned to one space with `floor`: use a stable
  space ID (recommended) or a zero-based numeric YAML index. A pinned card
  ignores shared last-space navigation, URL floor links, other floor tabs and
  kiosk swipe/cycling; an invalid value now shows a visible configuration
  error instead of silently opening another space. `default_floor` keeps its
  existing initial/fallback behaviour for unpinned cards
  ([#210](https://github.com/Matysh/houseplan-card/issues/210)).
- Device markers now match the source artwork from the designer package instead
  of the oversized rounded-square projection shipped in `v1.65.0-beta.6`.
  Icon cores are circular, MDI glyphs and adjacent value pills use the package
  proportions, and light/dark hover, active, lock, unlock, alert, selected,
  focus, virtual and unavailable layers retain the correct shell, stroke and
  shadow. The same renderer remains shared by the plan, kiosk, editor preview
  and static space card ([#211](https://github.com/Matysh/houseplan-card/issues/211)).

## v1.65.0-beta.6 — 2026-08-19

- Device markers now use the designer-supplied shared shell/core system in
  light and dark themes, with distinct focus, selected, locked, unlocked,
  active, alarm, virtual and unavailable states. Text and adjacent values live
  in one shell and are no longer ellipsized; marker LQI uses red at 0–40,
  amber at 41–179 and green at 180+. Activity motion follows the new package
  timings and colors, while saved custom pulse settings remain authoritative.
  The live vacuum puck uses the same theme-aware core, stroke and shadow.
  Interactive markers also have a 44×44 px target and reuse their existing
  click/confirmation path from Enter or Space
  ([#179](https://github.com/Matysh/houseplan-card/issues/179)).
- The new-space dialog now shows the defaults it will actually save: image
  spaces start with borders and names off, while switching to a hand-drawn
  plan visibly turns both on. After either switch is edited, changing the plan
  source preserves the complete user-selected pair; the Floors/Areas wizard
  follows the same rule ([#204](https://github.com/Matysh/houseplan-card/issues/204)).
- A robot that docks, pauses or briefly enters another available non-moving
  state now resumes the same server trail when it moves again on the same map
  within 30 minutes. Earlier points therefore survive mop washing and similar
  station visits; a map change or a longer stop still starts a new run
  ([#205](https://github.com/Matysh/houseplan-card/issues/205)).
- **Optimize plans** now removes an isolated wall-thickness fragment shorter
  than half a grid step when it sits strictly between two collinear fragments
  of the same thickness and has no room/opening node at either end. End
  fragments, real topology boundaries and ambiguous thickness changes remain
  lossless; Preview, Apply and server Undo keep their existing flow
  ([#198](https://github.com/Matysh/houseplan-card/issues/198)).

## v1.65.0-beta.5 — 2026-08-19

- Turning off **Show names** now removes room names completely in View, kiosk,
  the static card and hidden isometric mode, while Plan still exposes the
  existing draggable card for positioning. Re-enabling names restores its
  saved layout. **Breaking styling-hook change:** the fallback SVG
  `text.rlabel` / `.rlabel` public hook has been removed; enabled room names
  use `[data-hp="room-label"].roomlabel`
  ([#203](https://github.com/Matysh/houseplan-card/issues/203)).
- Closing a virtual room boundary now inherits the real thickness of an
  adjacent wall even when another room splits that saved wall into smaller
  atomic stretches. A 20/22 cm wall therefore no longer receives an accidental
  15 cm step, while partial thickness spans remain isolated
  ([#201](https://github.com/Matysh/houseplan-card/issues/201)).
- Room labels in the Plan editor now keep the same name, Home Assistant Area
  icon and state-row geometry as View, so switching modes no longer shifts a
  carefully positioned label. The icon still opens the Area only in View; in
  Plan it remains part of the label's drag surface
  ([#200](https://github.com/Matysh/houseplan-card/issues/200)).
- New and directly edited openings in independent walls now keep a physical
  jamb at each wall end equal to half that wall's thickness. Placement, drag,
  rebind and length edits share the same limit and explain a rejected edit,
  while existing near-end openings and full backups remain unchanged
  ([#186](https://github.com/Matysh/houseplan-card/issues/186)).
- The close icon in an active editor tab now has a forgiving 24 × 24 px click
  target while keeping the same compact glyph and header layout. Near-misses no
  longer fall through to the active tab's intentional no-op
  ([#195](https://github.com/Matysh/houseplan-card/issues/195)).

## v1.65.0-beta.4 — 2026-08-19

- Room hover tooltips now show average humidity next to temperature. The value
  follows the room's configured humidity source or its Home Assistant area
  average, and is omitted when no valid reading is available
  ([#196](https://github.com/Matysh/houseplan-card/issues/196)).
- A numerically degenerate virtual-wall junction can no longer erase every
  thick wall after **Optimize plans**. Computed junction patches are stabilised
  at sub-geometry precision and isolated individually, while the canonical
  masonry, floor, paper and light barriers remain available in Plan, View,
  kiosk, the static card and the hidden isometric experiment
  ([#197](https://github.com/Matysh/houseplan-card/issues/197)).
- Every remaining colour control now uses the same House Plan picker, including
  the global light/temperature/LQI/Glow/wall palettes, plan and space
  backgrounds, room colour and device activity ripple. Existing opacity appears
  inside the same surface, while colour-only fields and Default/Inherited
  behaviour keep their previous data model. On narrow screens, activity colour
  and ripple size use separate rows so both labels remain readable
  ([#180](https://github.com/Matysh/houseplan-card/issues/180)).

- Open-passage placement now previews the exact future wall cut before the
  click: a translucent wall-coloured segment shows its real length and depth,
  with two orange boundary marks at its ends. The saved passage remains a
  symbol-free physical opening ([#193](https://github.com/Matysh/houseplan-card/issues/193)).
- The House Plan color picker now draws the full spectrum directly on the Hue
  track, so the target colour family is visible before moving the slider. Mouse,
  touch and keyboard values remain unchanged, and a contrasting ring keeps the
  slider visible over every hue
  ([#192](https://github.com/Matysh/houseplan-card/issues/192)).

## v1.65.0-beta.3 — 2026-08-19

- Editor color controls now open a single House Plan picker with saturation,
  brightness, hue, exact HEX and opacity together. The nested browser color
  dialog is gone, while existing room, space, decor and Glow values keep their
  saved format ([#57](https://github.com/Matysh/houseplan-card/issues/57)).
- **Toggle state** confirmation now shows the current state and the exact
  expected result before acting. Groups show their active/total count and
  unavailable targets separately, while confirmation still re-resolves the
  live state and cancels if the target set changed
  ([#103](https://github.com/Matysh/houseplan-card/issues/103)).
- Doors, windows, gates and open passages can now be placed in finished
  independent Walls segments. They cut the full wall depth, move with their
  host, keep the same Home Assistant state/actions as room-wall openings and
  are removed only through an explicit cascade confirmation. Openings no
  longer break the structural wall axis, so drawing a closed contour still
  offers the room even when one of its walls already contains an opening.
  Space backups preserve the opening-to-wall binding when imported, while the
  editor's visual snap guide keeps its physical gap across the opening
  ([#132](https://github.com/Matysh/houseplan-card/issues/132),
  [#185](https://github.com/Matysh/houseplan-card/issues/185)).
- Door, window and gate contacts and locks now keep working when they are live
  YAML entities without a `unique_id` and therefore have no Entity Registry
  row. The picker, View animation, lock badge and opening info card now follow
  the same exact reference, while disabled, orphaned and missing entities
  remain unavailable ([#117](https://github.com/Matysh/houseplan-card/issues/117)).
- Glow now remains fail-dark if wall boolean geometry cannot be built: a light
  source inside a partition-hosted window or exterior opening stays suppressed,
  while valid interior passages remain transparent
  ([#187](https://github.com/Matysh/houseplan-card/issues/187)).
- The Plan editor's snap guide now leaves a real gap across openings hosted by
  independent Walls segments, so hover and clicks inside a door, window, gate
  or passage no longer snap to wall material that is not there
  ([#189](https://github.com/Matysh/houseplan-card/issues/189)).
- Small fixes and improvements.

## v1.65.0-beta.2 — 2026-08-18

- Composite Home Assistant devices with several light/switch entities now let
  you choose the exact entity operated by **Toggle state**. The dialog previews
  the selected target immediately, preserves missing choices with a warning,
  and can include the selected own entity in an explicitly configured group
  without changing existing plans ([#178](https://github.com/Matysh/houseplan-card/issues/178)).
- A virtual Always-light linked to a real relay now follows that relay instead
  of keeping an independent manual state. Tapping either marker operates the
  real Home Assistant device, while Glow, Light fill, room counts and both
  markers update together; removing the final link restores the preserved
  manual state ([#174](https://github.com/Matysh/houseplan-card/issues/174)).
- The Plan editor now has one **Walls** tool instead of separate Room outline
  and Partition tools. An open chain becomes ordinary walls when the tool,
  editor or floor changes; closing endpoint/T/X geometry offers every newly
  formed room in stable area order, with clean room splits and atomic
  Create/Keep/Cancel decisions. Ctrl/Cmd+click no longer adds an extra point
  while the chain is still too short to close
  ([#173](https://github.com/Matysh/houseplan-card/issues/173)).
- Collinear exterior walls now change thickness exactly at their saved
  breakpoint. After splitting a room, a 10 cm wall therefore keeps its full
  depth up to the divider without leaking onto an adjacent zero-thickness
  facade; Plan, View, static, hidden isometric and light geometry share the
  corrected outline ([#150](https://github.com/Matysh/houseplan-card/issues/150)).
- A zero-thickness Split divider no longer borrows a triangular wedge from an
  adjoining thick wall when the cut is slightly angled. The divider stays
  visually open along its full length while the real wall ends in a local cap,
  with the same geometry in Plan, View, Static, hidden isometric and lighting
  ([#172](https://github.com/Matysh/houseplan-card/issues/172)).
- Home Assistant devices and individual entities manually assigned to a room
  without an HA Area now stay in that exact room instead of returning to their
  registry Area. Existing saved assignments recover automatically, and
  editing a room within the same space keeps the marker position
  ([#170](https://github.com/Matysh/houseplan-card/issues/170)).
- Plan editor now supports **Open passage**, a 90 cm architectural opening
  with no leaf, arc or Home Assistant binding. It cuts masonry and continues
  the room floor in Full and Static views, passes interior light, and remains
  a full-height zero-panel cut in the hidden isometric experiment
  ([#157](https://github.com/Matysh/houseplan-card/issues/157)).

## v1.65.0-beta.1 — 2026-08-17

- Current-space export can now create a **Plan only** JSON template with rooms,
  walls, openings, decor, backdrop, room-label positions and scale, while
  removing devices and structural Home Assistant bindings. Import preview identifies
  the template before adding it as a new space
  ([#167](https://github.com/Matysh/houseplan-card/issues/167)).
- Composite appliances such as washing machines now use an explicit Home
  Assistant Status/Run state/Job state to show the yellow working marker during
  an active cycle. Power-on alone remains neutral, Power-off still fades stale
  activity, and ordinary lone relays keep their existing behaviour
  ([#164](https://github.com/Matysh/houseplan-card/issues/164)).
- Window sunlight now combines the Home Assistant azimuth with the literal
  direction of the compass N arrow, so a rotated real north lights the
  physically correct side of the plan. Users who mirrored the compass to work
  around the previous bug should point it back to the real north
  ([#166](https://github.com/Matysh/houseplan-card/issues/166)).
- Small fixes and improvements.

## v1.64.0-beta.3 — 2026-08-14

- Large plans no longer recompute an unused physical-wall union on every floor
  switch, and the Plan snap target before the first click updates without
  rerendering the complete card, removing the `v1.64.0` release performance
  regressions while preserving the same geometry and snap behaviour
  ([#156](https://github.com/Matysh/houseplan-card/issues/156)).
- Small fixes and improvements.

## v1.64.0 — 2026-08-14

- **Follows the Sun** now gives the plan a four-phase dawn/day/dusk/night
  environment with moving soft light while preserving the plan's live fills,
  Glow, devices, decor, vacuum, hover and window rays
  ([#146](https://github.com/Matysh/houseplan-card/issues/146)).
- Room outline and Partition drawing now exposes exact wall snap nodes and
  centre lines, closes valid contours along an existing room wall, and forms
  seamless thick corner and T-junctions in flat, static and hidden isometric
  geometry ([#137](https://github.com/Matysh/houseplan-card/issues/137),
  [#138](https://github.com/Matysh/houseplan-card/issues/138),
  [#141](https://github.com/Matysh/houseplan-card/issues/141)).
- Read-only View and kiosk cards now paint a complete first frame even when
  Home Assistant refuses live-sync event subscriptions
  ([#131](https://github.com/Matysh/houseplan-card/issues/131)).
- Virtual markers configured as an always-on light source can now be toggled
  without a Home Assistant helper, with persistent shared state across full
  and static cards ([#107](https://github.com/Matysh/houseplan-card/issues/107)).
- Opening and physical-object property dialogs keep their footer actions on one
  desktop line while retaining responsive narrow-screen wrapping
  ([#140](https://github.com/Matysh/houseplan-card/issues/140)).
- Large plans no longer recompute an unused physical-wall union on every floor
  switch, and the Plan snap target before the first click updates without
  rerendering the complete card
  ([#156](https://github.com/Matysh/houseplan-card/issues/156)).
- Small fixes and improvements.

## v1.64.0-beta.2 — 2026-08-14

- **Follows the Sun** now gives the plan a four-phase dawn/day/dusk/night
  environment with a moving soft light and alpha-aware outer outline. It uses
  `sun.sun` when its sample is complete, falls back to local browser time, and
  no longer needs the compass; the plan, Glow, fills, devices, decor, vacuum,
  hover and window rays remain visually unchanged across phases. Full View,
  kiosk and static space cards share the result. New installations and spaces
  enable it explicitly, while a one-time migration and portable import/export
  preserve every existing plan's prior background choice. Existing zoom
  percentage badges remain visible above the plan at magnification
  ([#146](https://github.com/Matysh/houseplan-card/issues/146)).
- Opening and physical-object property dialogs now use the existing 500 px
  desktop shell, keeping Delete, Cancel and Save on one line with localization
  headroom while preserving responsive wrapping on narrow screens
  ([#140](https://github.com/Matysh/houseplan-card/issues/140)).
- A new room outline that starts and ends on one uninterrupted solid interval
  of an existing room wall now closes automatically and opens the normal room
  dialog. Endpoints and wall-bound T-connection points work alike; openings,
  intentional gaps, different edges and a second point without enough sides do
  not trigger the shortcut ([#138](https://github.com/Matysh/houseplan-card/issues/138)).
- Connected Room outline and Partition segments now form one seamless thick
  wall immediately, including the live rubber-band. Right and oblique corners
  use bounded mitre/bevel joins, T-connections have no visible butt face, each
  segment keeps its own thickness, and single-segment thickness hover and free
  ends remain visible and flat consistently in
  Plan, View, static cards, hidden isometric, clean-floor and light geometry
  ([#141](https://github.com/Matysh/houseplan-card/issues/141)).
- Room outline and Partition drawing now shows wall centre lines and exact
  endpoints above existing walls. The enlarged target previews whether the
  next click will join an endpoint or create a wall-bound T-connection, while
  door/window/gate and intentional open-span gaps remain excluded
  ([#137](https://github.com/Matysh/houseplan-card/issues/137)).
- Small fixes and improvements.

## v1.64.0-beta.1 — 2026-08-14

- Read-only View and kiosk cards now paint a complete first frame even when
  Home Assistant refuses live-sync event subscriptions. The selected space,
  room fills, decor, walls, Glow and device values no longer require clicking
  the already active space tab ([#131](https://github.com/Matysh/houseplan-card/issues/131)).
- Virtual markers configured as **Light source → Always** with **Toggle state**
  can now be switched directly without an HA helper. Their shared state
  survives reloads/restarts and stays consistent across Glow, room light
  presentation, full cards and static space cards, including markers that retain
  saved outgoing controls
  ([#107](https://github.com/Matysh/houseplan-card/issues/107)).
- Small fixes and improvements.

## v1.63.0 — 2026-08-13

- Preserved explicit door, window and gate bindings when their standalone
  sensor or lock marker is removed, and fixed the supported empty state after
  deleting the last space
  ([#104](https://github.com/Matysh/houseplan-card/issues/104),
  [#111](https://github.com/Matysh/houseplan-card/issues/111)).
- Splitting a room from an existing corner no longer deforms the exterior
  facade, including with thick dividers. Flat, static and hidden isometric
  rendering use the same preserved wall geometry
  ([#123](https://github.com/Matysh/houseplan-card/issues/123)).
- Small fixes and improvements.

## v1.63.0-beta.2 — 2026-08-13

- Splitting a room from an existing corner no longer deforms the exterior wall
  or pulls a thick internal divider through the facade. Plan, View, kiosk,
  static cards, hidden isometric rendering and light obstacles now use the same
  preserved exterior geometry, including already saved plans
  ([#123](https://github.com/Matysh/houseplan-card/issues/123)).
- Small fixes and improvements.

## v1.63.0-beta.1 — 2026-08-13

- Deleting a standalone sensor or lock marker no longer breaks its explicit
  door, window or gate binding: the entity stays available in opening settings
  and continues to drive its state without restoring the marker on the plan
  ([#104](https://github.com/Matysh/houseplan-card/issues/104)).
- Fixed a crash after deleting the last space: the supported empty state now
  stays usable so a new space can be added ([#111](https://github.com/Matysh/houseplan-card/issues/111)).
- Small fixes and improvements.

## v1.62.0 — 2026-08-13

- Added portable full-plan and single-space backups with server-validated
  preview, safe import and one-step undo, plus reusable contextual help for
  complex settings ([#50](https://github.com/Matysh/houseplan-card/issues/50),
  [#68](https://github.com/Matysh/houseplan-card/issues/68)).
- Added passive light markers, explicit leading-entity selection and
  user-controlled value badges, while unifying device actions and activity
  presentation across the plan, preview and static cards
  ([#84](https://github.com/Matysh/houseplan-card/issues/84),
  [#88](https://github.com/Matysh/houseplan-card/issues/88),
  [#90](https://github.com/Matysh/houseplan-card/issues/90),
  [#94](https://github.com/Matysh/houseplan-card/issues/94),
  [#98](https://github.com/Matysh/houseplan-card/issues/98)).
- Reworked opening placement with a Window / Door / Gate submenu and a
  full-symbol preview on thick walls. Fixed room Split wall thickness, opening
  tunnel seams and Glow sources embedded in walls or exterior openings
  ([#75](https://github.com/Matysh/houseplan-card/issues/75),
  [#76](https://github.com/Matysh/houseplan-card/issues/76),
  [#81](https://github.com/Matysh/houseplan-card/issues/81),
  [#91](https://github.com/Matysh/houseplan-card/issues/91),
  [#92](https://github.com/Matysh/houseplan-card/issues/92)).
- Added coherent transitions between View and editors, restored reliable
  window sun rays, and hardened editor lifecycle, composite-device selection,
  previews and regression coverage
  ([#93](https://github.com/Matysh/houseplan-card/issues/93),
  [#95](https://github.com/Matysh/houseplan-card/issues/95),
  [#101](https://github.com/Matysh/houseplan-card/issues/101),
  [#102](https://github.com/Matysh/houseplan-card/issues/102)).
- Small fixes and improvements.

## v1.62.0-rc.1 — 2026-08-13

- Republished the reviewed beta.10 candidate under an RC identifier so HACS
  discovers it after beta.9; the application code and user-visible behaviour
  are unchanged.

## v1.62.0-beta.10 — 2026-08-13

- Fixed composite device presentation and actions after the beta review:
  an explicitly selected light entity now remains the tap target, a primary
  cover keeps the cover face, and registry-backed state selection is identical
  in the full plan, preview and static card. Strengthened Split, Glow,
  contextual-help and opening-preview regression coverage.
- A light source placed inside a physical wall, window tunnel or exterior
  door/gate opening intentionally produces no Glow; move its marker onto the
  room floor to restore illumination ([#92](https://github.com/Matysh/houseplan-card/issues/92)).
- Small fixes and improvements
  ([#108](https://github.com/Matysh/houseplan-card/issues/108)).

## v1.62.0-beta.9 — 2026-08-12

- Fixed post-review inconsistencies between device state and tap behaviour:
  exact bindings no longer toggle a sibling entity, a passive relay controls
  its leading entity, and incidental cover or humidity entities no longer
  take over a composite device's presentation.
- Hardened opening placement with shared defaults, a stable geometry cache,
  correct centre snapping and a stricter visual preview gate. Restored the
  public activity and preview-dot CSS hooks, improved help accessibility and
  strengthened internal process checks.
- Small fixes and improvements
  ([#108](https://github.com/Matysh/houseplan-card/issues/108)).

## v1.62.0-beta.8 — 2026-08-12

- Reworked opening placement in the Plan editor. **Opening** now opens a compact
  Window / Door / Gate sub-menu; choosing a type arms its 120 / 90 / 300 cm
  preset and shows the complete future architectural symbol at 50% opacity on
  top of physical walls. Thick-wall targeting, junction selection, click
  without prior hover and repeated placement are now deterministic, while the
  persisted opening model remains unchanged
  ([#75](https://github.com/Matysh/houseplan-card/issues/75),
  [#76](https://github.com/Matysh/houseplan-card/issues/76)).
- Hardened the beta after the full review: editor close/navigation can no
  longer be swallowed by an active transition or context tray; device taps,
  passive light state and value badges now use the same resolved sources on
  every surface; legacy temperature/humidity satellites are preserved; help,
  paired import/export and split-wall geometry gained the missing guards and
  regression coverage. Small fixes and internal improvements
  ([#50](https://github.com/Matysh/houseplan-card/issues/50),
  [#68](https://github.com/Matysh/houseplan-card/issues/68),
  [#84](https://github.com/Matysh/houseplan-card/issues/84),
  [#90](https://github.com/Matysh/houseplan-card/issues/90),
  [#91](https://github.com/Matysh/houseplan-card/issues/91),
  [#92](https://github.com/Matysh/houseplan-card/issues/92),
  [#94](https://github.com/Matysh/houseplan-card/issues/94),
  [#95](https://github.com/Matysh/houseplan-card/issues/95),
  [#98](https://github.com/Matysh/houseplan-card/issues/98),
  [#101](https://github.com/Matysh/houseplan-card/issues/101)).

## v1.62.0-beta.7 — 2026-08-12

- Fixed the first opening of device settings: **Display**, **Room** and
  **Leading light entity** now immediately show the value that is actually
  persisted instead of the first option. The form and its preview can no
  longer report different settings.
- Added a shared native-select contract and browser checks that reopen a device
  with non-first persisted choices. Future selectors can no longer silently
  reintroduce the unsafe binding pattern.

## v1.62.0-beta.6 — 2026-08-12

- Fixed the remaining cause of invisible window sun rays in real Home Assistant
  installations. Core/runtime entities such as `sun.sun` may have a live state
  without an Entity Registry row; House Plan now preserves that state while
  continuing to exclude explicitly disabled entities and devices
  ([#102](https://github.com/Matysh/houseplan-card/issues/102)).
- Added a deterministic visual regression crop of an exterior window and its
  ray. The browser now compares the reviewed image with the same frame after
  hiding only the sun layer and fails unless the ray paints a material number
  of pixels, so an empty screenshot cannot be accepted as success.

## v1.62.0-beta.5 — 2026-08-12

- Unified all device activity around one predictable pulse system. Alerts use
  the red alarm pulse, witnessed events use three finite waves, and ongoing
  work, movement or presence uses one continuous pulse. Static rings are gone;
  reduced-motion users get a compact dot for ordinary activity. The full plan,
  device preview and static space card now share the same resolver and renderer
  ([#98](https://github.com/Matysh/houseplan-card/issues/98)).
- Made transitions between View and all three editors coherent. Toolbar height,
  usable plan area, camera, background and editor presentation now move on one
  short timeline; editor-to-editor switches fade their incoming controls, rapid
  choices retarget from the visible frame, and reduced motion remains atomic
  ([#101](https://github.com/Matysh/houseplan-card/issues/101)).
- Fixed the device editor's **Value** selector visually showing its first row
  instead of the source that was actually saved and rendered on the plan.
  Saved source and position are now selected explicitly when the dialog opens,
  including temporarily missing sources ([#100](https://github.com/Matysh/houseplan-card/issues/100)).
- Fixed contextual help temporarily adding a vertical scrollbar to its owning
  dialog. The accessibility-only description no longer participates in the
  dialog's scroll geometry in either native Popover or fallback mode
  ([#99](https://github.com/Matysh/houseplan-card/issues/99)).
- Fixed a transition regression that could leave window sun rays invisible in
  View. The ray layer again owns its lifecycle independently from editor
  transitions, without changing sun position, window geometry or the existing
  threshold fade ([#102](https://github.com/Matysh/houseplan-card/issues/102)).

## v1.62.0-beta.4 — 2026-08-12

- Fixed contextual help showing a dead icon when its explanation was absent.
  Incomplete help content is now omitted entirely, and the plain `?` glyph was
  replaced with the consistent outlined circled-question icon
  ([#68](https://github.com/Matysh/houseplan-card/issues/68)).
- Hardened universal **Toggle state** after the beta code review. Climate,
  water-heater, siren, camera, media-player and legacy-vacuum actions now
  require the exact HA entity capability bits as well as a live service;
  clicks resolve current controls instead of a retained visual frame, and a
  disabled legacy cover keeps its original, explainable target
  ([#94](https://github.com/Matysh/houseplan-card/issues/94)).
- Fixed the device editor showing **Device card** for a lamp whose effective
  default action is **Toggle state**. Untouched actions now follow the current
  preview entity in real time, while explicit choices and lossless legacy
  storage remain unchanged
  ([#97](https://github.com/Matysh/houseplan-card/issues/97)).
- Fixed **Device card** taps doing nothing on compound curtain/cover devices.
  The local House Plan card now opens independently of a momentary HA registry
  revalidation, while HA more-info and service actions retain their safety gate
  ([#96](https://github.com/Matysh/houseplan-card/issues/96)).
- Fixed an editor-close race after a same-route technical remount. A visible
  editor now closes on the first press even while write permission is still
  resolving; the late server response can no longer reopen it
  ([#95](https://github.com/Matysh/houseplan-card/issues/95)).

## v1.62.0-beta.3 — 2026-08-12

- Replaced the separate Toggle and cover actions with one universal **Toggle
  state** action. The device editor now shows the exact target, current/next
  effect and any skipped or unsupported entities; covers and valves retain
  open/close/stop behaviour, secure devices remain no-op, and configured
  no-target actions never fall back to an info card. Existing `cover` records
  remain lossless until deliberately edited
  ([#94](https://github.com/Matysh/houseplan-card/issues/94)).
- Returning to House Plan now restores only the last space and always opens
  View. Editor mode and dialogs no longer survive page reloads or navigation
  through other Home Assistant pages; same-route technical remounts still
  protect unfinished work ([#93](https://github.com/Matysh/houseplan-card/issues/93)).
- Fixed Glow starting from inside a thick wall or an exterior opening and
  lighting one half of an exterior door or gate tunnel. Sources embedded in
  the final opaque masonry geometry now produce no Glow at all, while real
  interior passages remain transparent
  ([#92](https://github.com/Matysh/houseplan-card/issues/92)).

## v1.62.0-beta.2 — 2026-08-11

- Added a user-controlled value badge beside each device. Users can select the
  exact reading and place it on the right, bottom, left or top; preview, the
  main plan and the static space card consume one resolver, while untouched
  legacy markers retain their previous automatic behaviour
  ([#90](https://github.com/Matysh/houseplan-card/issues/90)).
- Fixed room Split losing the thickness of adjoining walls. Split now
  materializes exact intervals from the legacy wall profile before changing
  geometry, so the new thickness applies only to the divider
  ([#91](https://github.com/Matysh/houseplan-card/issues/91)).
- Hardened portable backups: full import retains the model version, write
  endpoints and preview tokens have negative coverage, and the test harness
  clears temporary plans and attachments.
- Removed the contextual-help scroll-listener leak and made the plan-wide light
  graph resolve once per frame instead of once for every marker.
- Strengthened golden, smoke and repository gates: the seam scenario now
  crosses a stepped wall, baseline inventory is exact, and temporary-file plus
  browser-quiescence flakes are eliminated.

## v1.62.0-beta.1 — 2026-08-11

- Fixed layout maintenance silently discarding the one-deep Optimize/Import
  undo snapshot. Explicit geometry repair and its undo now preserve all store
  metadata and keep the plan snapshot valid for the resulting layout revision
  ([#87](https://github.com/Matysh/houseplan-card/issues/87)).
- Added passive plan light sources and explicit leading-entity selection. A
  virtual dumb lamp can now own its Glow position, colour, brightness and
  radius while following a smart relay; multiple controllers use OR, and
  `marker:*` links are validated without ever reaching Home Assistant as entity
  IDs. Multi-channel Always sources can select the meaningful `light.*` or
  `switch.*` instead of silently using registry order
  ([#84](https://github.com/Matysh/houseplan-card/issues/84),
  [#88](https://github.com/Matysh/houseplan-card/issues/88)).
- Added portable House Plan backups: editors can export the complete model or
  one space, inspect a server-validated JSON import before any write, safely
  handle duplicate HA bindings and undo a full replacement until the next plan
  edit. Internal plans and attachments remain local references rather than
  being silently copied between Home Assistant instances
  ([#50](https://github.com/Matysh/houseplan-card/issues/50)).
- Fixed recurring one-pixel SVG seams in room-coloured door, window and gate
  tunnels. Equal and stepped wall profiles now render as continuous contours
  without translucent overlaps or gaps at fractional zoom ([#81](https://github.com/Matysh/houseplan-card/issues/81)).
- Added reusable localized help buttons for complex settings. They work with
  mouse, keyboard and touch, stay inside the viewport, and share the dialog's
  Escape and focus lifecycle ([#68](https://github.com/Matysh/houseplan-card/issues/68)).

## v1.61.0 — 2026-08-11

- Expanded robot-vacuum integration coverage with deterministic source
  selection, explicit capability and health diagnostics, gap-preserving trails,
  safer map arbitration and stricter calibration checks.
- Reworked room colour and lighting controls. Glow is an independent additive
  overlay, room fills keep their exact configured colour, and each source can
  use automatic, always-on or disabled behaviour with manual colour, brightness
  and radius where applicable.
- Light propagation now follows the same physical wall bodies drawn on the
  plan, including wall thickness, jambs, partitions and columns. Doorways and
  virtual boundaries transmit light without seams, while walls and corners cast
  stable clipped shadows.
- Returning to a tab, reconnecting Home Assistant or remounting the card keeps
  the last coherent plan frame. Devices, rooms, Glow, sun, openings, vacuums and
  live decorative text update atomically instead of flashing partial state.
- Small fixes and improvements to dialogs, room hover, device markers, editor
  stability, validation and release tooling.

## v1.61.0-beta.8 — 2026-08-11

- Plan recovery now has one bounded two-second barrier: a stalled signature or
  protected-backdrop decode can no longer leave an already complete plan below
  an opaque layer forever. The card retains its last coherent frame, while a
  cold failure exposes an explicit retryable error.
- Added an immutable per-frame data snapshot. Devices, positions, room fills,
  Glow, sun, openings, vacuums and HA variables in decorative text now update
  together instead of mixing old and new state during reconnect.
- Connection readiness is treated as recovery only after a confirmed loss;
  ordinary HA ticks no longer alter the structural frame fingerprint. Forced
  config refreshes, signed-URL caching and late image load events are now
  protected from their respective races.
- Strengthened deterministic continuity, protected-backdrop and screencast
  coverage. The browser scenario now exercises the production visibility
  listener while checking geometry, devices, Glow, sun and decor together.

## v1.61.0-beta.7 — 2026-08-11

- Fixed rare but severe Glow geometry failures: a clipping exception can no
  longer paint outside the house, a grid-snapped source on a wall stays dark,
  and the angular seam no longer cuts a wedge from an otherwise valid pool.
  Light barriers now invalidate for every changed body point, wall endpoint,
  scale or space.
- Delete/Cancel/Save in opening and space dialogs now use the same responsive
  grouped footer as physical-object properties, keeping localized actions
  inside narrow dialogs.
- Returning to a dashboard no longer hides or rebuilds an already complete
  plan. Full and compact cards keep the last coherent frame through tab sleep,
  reconnect, remount and transient resize; identical config/layout echoes are
  adopted without geometry churn, and protected backdrops share a bounded
  loaded cache. A localized recovery layer is reserved for the rare case where
  no complete frame can be retained. ([#73](https://github.com/Matysh/houseplan-card/issues/73))
- Restored the room-hover contract without bringing back the Glow flash: a
  neutral clean-floor wash now darkens the resolved room fill while its late
  outline remains above walls; Glow, sun, openings and devices stay visually
  independent. ([#79](https://github.com/Matysh/houseplan-card/issues/79))
- Working device markers keep their yellow resting plate with the ordinary
  neutral elevation shadow, use the same hover as other interactive markers,
  and no longer add an unrelated yellow outer glow.
  ([#80](https://github.com/Matysh/houseplan-card/issues/80))

## v1.61.0-beta.6 — 2026-08-11

- Fixed shared dialog layout for localized content: multi-line titles now grow
  the Home Assistant header instead of being clipped, and physical-object
  footers keep Delete inside the left inset while Cancel/Save wrap together on
  narrow dialogs. ([#77](https://github.com/Matysh/houseplan-card/issues/77),
  [#78](https://github.com/Matysh/houseplan-card/issues/78))
- Light now works one way, everywhere: a lamp lights the floor it can see.
  Walls block it with their real thickness — the same bodies the plan draws —
  as do columns and free-standing partitions; doorways, gates and virtual
  boundaries simply are not walls, so light crosses them, and a thick wall's
  jambs narrow the beam exactly as they would in the house. Everything
  else follows from that single rule — a doorway carries one continuous light
  instead of an unlit bar and a detached blob, a beam ends where the receiving
  room's own walls end, a column and a wall corner cast crisp shadows (also
  when they belong to a room further away), and shadow edges are lines with a
  hairline penumbra rather than smears. A window and an outside door stay solid
  for light — there is no floor behind a front door to light, so it no longer
  glows halfway. Pools also fade over their whole radius instead of holding a
  flat plateau to 70%, so distant floor is faint because it is distant. As a
  side effect the light layer became a single clipped circle per source. Cold
  geometry calculation on a complex plan became dramatically faster; the warm
  render path remains broadly comparable with beta.5 and is tracked separately.
  ([#71](https://github.com/Matysh/houseplan-card/issues/71))
- Fixed a one-frame Glow brightness flash when hovering any room. Room hover
  now uses a plain SVG wash and double outline without compositor filters.
  ([#72](https://github.com/Matysh/houseplan-card/issues/72))
- Prerelease publishing now accepts an intentionally skipped announcement job,
  so recovery after a partial workflow run no longer rejects a valid release.

## v1.61.0-beta.5 — 2026-08-10

- Device settings now offer Auto / Always / Never light-source roles. Per-source
  Glow can follow Home Assistant, use a custom colour with live brightness, or
  fix both colour and brightness; dim lights remain visibly readable through a
  perceptual intensity curve. ([#65](https://github.com/Matysh/houseplan-card/issues/65),
  [#66](https://github.com/Matysh/houseplan-card/issues/66),
  [#67](https://github.com/Matysh/houseplan-card/issues/67))
- Compatibility note: an explicitly stored `is_light: false` now means Never,
  rather than behaving like Auto. UI-authored historical configs normally used
  `null`, so this primarily affects hand-written YAML.

- Prerelease validation now uses a short candidate-only 60-source Glow
  performance smoke. The expensive same-runner baseline comparison remains
  mandatory for stable releases and runs on `main`, weekly and on demand.
  ([#69](https://github.com/Matysh/houseplan-card/issues/69))

- Telegram release announcements are now sent only for stable releases; betas
  and release candidates publish silently.
  ([#70](https://github.com/Matysh/houseplan-card/issues/70))

## v1.61.0-beta.4 — 2026-08-10

- Performance comparison now keeps newly introduced private members optional
  for older supported baselines while validating every present field's runtime
  type. Rewritten-push baselines prefer the candidate parent and emit a warning
  instead of silently jumping to an older release. ([#15](https://github.com/Matysh/houseplan-card/issues/15),
  [#16](https://github.com/Matysh/houseplan-card/issues/16))

- In Glow spaces, LQI/Light/Temperature modes without usable HA data now fall
  back to the dark room base instead of exposing a bright unfilled paper hole.
  A genuinely resolved data or custom fill still keeps its exact color and
  opacity. ([#61](https://github.com/Matysh/houseplan-card/issues/61))

- In space settings, Custom color is now the ordinary first room-fill mode and
  replaces the separate None choice. Historical spaces with `fill_mode: none`
  open as a zero-opacity custom color, preserving the same floor and Glow
  appearance through Preview and Save. New spaces also start at zero opacity,
  so replacing the choice does not change their previous initial appearance.
  An individual room can still suppress an inherited dynamic fill. ([#64](https://github.com/Matysh/houseplan-card/issues/64))

- Prerelease publication can now be completed with one fail-closed local
  command or a manual GitHub Actions run. Version files, bilingual release
  notes, the exact-SHA Validate result, annotated tag, both release assets and
  HACS discovery are checked before completion. Downloaded JS/ZIP contents are
  bound to the candidate hash and manifest version; per-tag concurrency rejects
  parallel publication. ZIP inspection is portable across Windows and Linux
  without a system `tar`, while standalone JS and hashes come from exact Git
  blobs rather than CRLF-sensitive worktree bytes; stale assets are repaired
  automatically and handled
  interruptions release the local lock. The public release is staged as a draft
  first and partial failures are safe to retry. Existing release workflows remain
  available as a fallback. ([#63](https://github.com/Matysh/houseplan-card/issues/63))

## v1.61.0-beta.3 — 2026-08-10

- Performance tooling now fails before measurement when a candidate/base card
  no longer exposes a private API consumed by the benchmark, documents the
  safe two-revision rename path, and falls back from an unreachable force-push
  comparison SHA to the latest reachable release. The bilingual release-body
  headings now have one explicit canonical template. ([#15](https://github.com/Matysh/houseplan-card/issues/15),
  [#16](https://github.com/Matysh/houseplan-card/issues/16),
  [#17](https://github.com/Matysh/houseplan-card/issues/17))
- Rooms and spaces can now use a persistent custom fill color and opacity,
  independently of border/name color and Home Assistant state. Room overrides
  inherit safely from the space and can be reset. ([#56](https://github.com/Matysh/houseplan-card/issues/56))
- Glow no longer darkens or tints LQI, light, temperature, or custom room
  fills: those colors stay exact while live radial light pools remain visible.
  ([#61](https://github.com/Matysh/houseplan-card/issues/61))
- The global Glow radius now sits with the other Glow settings. Small code
  review cleanups also remove an unreachable legacy branch and empty static
  SVG layers. ([#60](https://github.com/Matysh/houseplan-card/issues/60))

## v1.61.0-beta.2 — 2026-08-10

- Light-source Glow is now an independent overlay that can be combined with
  temperature, Zigbee signal, light-state or no room fill. Existing plans that
  used the legacy Glow fill keep the same effective appearance and migrate
  losslessly on a normal save or Optimize Plans.
- Overlapping light pools now blend additively, producing brighter mixed-colour
  intersections. The card verifies real SVG support at runtime and falls back
  safely to the previous normal composition on unsupported engines.
- Closing a device card opened by mouse long-press no longer leaves the plan
  attached to the cursor or reopens the dialog from a stale gesture.

## v1.61.0-beta.1 — 2026-08-09

- Stored plan colours now use one strict `#RRGGBB` contract at both API and
  render boundaries. Malformed legacy/imported values safely fall back instead
  of being able to add CSS declarations; Home Assistant RGB light colours stay
  supported through a separately generated numeric form.
- Vacuum integration coverage is now explicit and diagnosable. One sticky,
  order-independent source resolver supports same-device discovery and a lazy
  picker for registry-less map cameras, distinguishes missing, disabled,
  unavailable and limited-permission states, and never leaks stale disabled
  telemetry onto the plan.
- Xiaomi Cloud Map Extractor multi-subpath trails retain real gaps; path
  arbitration, point budgets and map IDs are deterministic across frontend and
  backend. Room calibration uses area centroids on both sides, keeps bbox-only
  integration dialects through a final bbox-centre fallback, and a physical
  error above 40 cm now requires Apply or manual fitting before config changes.
- Server trail health reports one deduplicated warning per missing/disabled
  source incident and records recovery. Documentation now states the verified
  Dreame/XCME/Valetudo capability matrix; Roomba remains Stage 2.

## v1.60.3 — 2026-08-09

- Editor toolbars now keep their working area stable: selection actions,
  transient tool settings and the furniture palette open in one accessible
  context tray over the stage, while Close remains pinned. Adaptive wide,
  medium and narrow layouts are covered by deterministic golden scenarios.
- Returning to a browser tab no longer causes the plan to flash or briefly
  reset its zoom/day state. Two-finger gestures cannot activate an underlying
  marker, and vacuum-map fitting isolates its own gesture surface.
- Thick-wall openings use one wall association for their symbol, cut and
  room-coloured tunnel. Detached/T-junction walls no longer steal a side,
  overlapping openings do not compound opacity, and adjacent atomic tunnel
  strips no longer expose thin SVG seams.
- Furniture previews stay inside their palette buttons, the editor Close icon
  is centred, and dismissing an unarmed palette no longer leaves click
  suppression behind.
- Maintenance improvements include deterministic golden-image coverage,
  same-runner performance gates and migration of the active backlog to GitHub
  Issues + Project v2.
- Small fixes and improvements.

## v1.60.3-beta.2 — 2026-08-09

- Editor toolbars now keep a stable height while selecting objects or changing
  active-tool context. Properties, Delete, drawing parameters, operation hints
  and the furniture palette use one translucent tray over the stage, so the
  plan no longer shrinks/refits and Close stays pinned. The same accessible
  surface is prepared for future explicitly designed tool groups without
  grouping any current buttons automatically.
- Two-finger gestures no longer activate an interactive plan item when a pinch
  starts over it, and robot-map calibration no longer zooms the plan underneath
  its overlay. Furniture palettes and future tool groups now dismiss reliably
  outside the card without swallowing an unrelated following click.
- Small fixes and improvements: reduced-motion navigation is respected again,
  stale contextual actions are rejected immediately after local edits, and the
  editor/performance regression checks now exercise their real UI and state.

## v1.60.3-beta.1 — 2026-08-08

- Returning to a briefly backgrounded browser tab no longer forces a one-frame
  day/night/hover reset that could make the whole plan flash. Long suspended
  tabs keep the protected settle and immediate sun catch-up.
- Thick-wall openings now use one cached wall association for their symbol,
  wall cut and room-coloured tunnel. Nearby detached walls and perpendicular
  T-junction arms can no longer steal a tunnel side, while overlapping openings
  no longer darken the room fill twice. A legacy opening whose saved angle or
  offset no longer actually aligns with a wall is no longer allowed to cut or
  shift that wall; re-snap the opening in the Plan editor to restore it.
- Expanded always-static device coverage now verifies RGB suppression,
  size/rotation, lifecycle priority, mode round trips, plan/preview/static-card
  parity and live-vacuum overlay removal.
- Maintenance groundwork adds an offline compatibility-field registry/config
  audit, a schema-valid large-house performance baseline with stale-bundle and
  precise-memory guards, deterministic golden-image capture/review
  infrastructure and the first render-only extraction from the root card.
  These changes do not alter saved data or the plan's SVG/interaction contract.

## v1.60.2 — 2026-08-08

- Door, window and gate tunnels in thick walls now continue the effective room
  fill instead of exposing a white paper strip. An exterior opening uses its
  room colour through the full wall depth; a shared opening splits cleanly on
  the wall centreline when its rooms use different fills. Glow, window sun
  rays and opening symbols keep their existing behaviour.
- Device display now has an **Always static icon** option. It keeps the normal
  dark icon unchanged by work, open, alarm, unavailable, RGB, values or sensor
  badges, and hides live vacuum puck/trail overlays. Hover, actions, controls
  and the device's separate contribution to room light remain unchanged. The
  former **Icon** option is now named **Icon + dynamic plate**.
- A controller no longer becomes a physical Glow origin merely because it has
  managed light targets. `controls` still drives group toggling, room light
  state and statistics, while the actual lamp marker owns the light pool. A
  marker's own legacy `switch.*` self-control is no longer inferred as a light;
  relay-driven fixtures require the explicit “This device is a light source” flag.

## v1.60.2-beta.3 — 2026-08-08

- Saved devices disabled in Home Assistant are now forced off the plan and all
  plan calculations until re-enabled, while the Device editor keeps a labelled
  service ghost. Registry refresh now also recovers from unavailable update
  subscriptions, and preview/static-card status hooks and explanations stay in
  sync. Small accessibility, routing and preview-parity fixes are included.
- Openings now include Gate. It keeps the same contact, lock, wall cut and Glow
  behaviour as a door, but defaults to 300 cm and uses two half-width leaves
  opening only 10° outwards, without a plan-obscuring full swing arc.
- Sunlight through windows no longer depends on a weather entity: clouds,
  rain and snow cannot dim or hide geometrically valid rays. The obsolete
  weather selector is removed; legacy stored values are safely ignored.
- Device settings now include a live display preview with the actual current
  state, effective source entities, the providing Home Assistant integration,
  an explanation of the resulting marker, and a safe local activity demo.
  The full plan, preview and read-only space card now share one presentation
  resolver and one marker-face renderer.
- Existing `Value instead of icon` markers can now show localized text states,
  not only numeric measurements. Long valid values are ellipsized without
  changing the marker hit area, while their full text remains accessible.
- When several equally valid visual sources exist, `Value instead of icon` no
  longer picks the first registry entity arbitrarily: it falls back to the
  device icon and the preview explains the ambiguity.
- Decorative lines can now be switched between Solid and Dashed in the
  properties dialog opened by double-clicking a finished line. Existing and
  newly drawn lines stay solid by default, and dashed gaps retain a comfortable
  selection target in the Background editor.
- The Plan editor now has one contextual Boundary tool instead of separate
  Virtual wall and Physical wall buttons. Two points on a solid shared wall
  open a virtual stretch; one click on a dashed stretch restores its complete
  physical body with the inherited thickness previewed before the click.
  Screen-space hit zones stay usable at every zoom, ambiguous junctions and
  independent masonry block unsafe edits, and an unfinished first point is
  cancelled by Esc, Undo/Redo, navigation, reconnect or multi-touch.
- The shared `hp-dialog` now wraps long translated titles and device names
  instead of clipping them horizontally. Numeric angle fields across editors
  display at most three decimal places without rounding stored geometry.

## v1.60.2-beta.2 — 2026-08-08

- Composite switch-only devices now use one representative lifecycle entity
  instead of treating every uncategorised feature toggle as whole-device
  activity. A dedicated Power switch is selected from generic Home Assistant
  metadata: powered-on appliances stay neutral, while off/unavailable ones use
  the existing faded presentation. Standalone relays retain their normal
  yellow working state.
- Device information uses the wide responsive dialog shell and a wrapping
  footer which keeps Edit, Open in HA and Close aligned on narrow screens.
- New Room has one save path: choosing “No area” in the area list and entering
  a name enables the regular Save action and stores `area: null`; the duplicate
  “No area” footer button has been removed.
- Erase in the Background editor gives thin lines and outlined shapes an
  invisible 16 px screen-space target without changing their appearance. The
  target remains usable at every zoom level.

## v1.60.2-beta.1 — 2026-08-07

- The final review follow-up makes geometry cache invalidation root-safe and
  LRU-bounded, keeps pan/pinch available over saved outline hit targets,
  rejects partially numeric editor values, preserves absent column angles in
  Optimize Plans and gives rotation handles a full 24 px touch target. Boolean
  geometry now has a lossless sequential fallback, and draft joining plus
  editor-to-editor height animation are covered by realistic browser smokes.

- The Plan editor now supports persistent unfinished room outlines,
  room-independent partitions and square/circular columns. They stay on the
  grid, participate in clean floor area, Glow and window-ray occlusion, and
  share the geometry Undo/Redo stack. Select provides drag, properties and a
  rotation handle for square columns; saved outlines can be resumed or joined
  endpoint-to-endpoint. Client and backend limits are aligned and invalid
  thicknesses are rejected visibly instead of being silently clamped.
- Audit hardening adds cached clean-floor/light geometry, complete blocking for
  a light embedded in masonry, leak-free point shadows behind long partitions,
  strict column validation, reconnect gesture cancellation and browser smoke
  coverage for the new physical objects.
- While drawing a room outline, Shift now locks the new segment to the nearest
  45° direction. The preview and committed vertex match, and the endpoint
  remains strictly grid-bound.
- The Plan editor toolbar now uses the compact labels Merge, Virtual wall,
  Physical wall and Thickness. Undo and Redo are icon-only while retaining
  localized tooltips and accessible names.
- The Background editor now de-emphasizes physical, thick and dashed virtual
  walls to the same 35% opacity as every other non-decor plan layer.
- Switching between editors on the same space now visibly fades in the new
  toolbar and interpolates its measured height. Different wrapping and tool
  composition no longer make the plan jump; rapid switches continue smoothly
  from the current intermediate height.
- Audit hardening makes editor history unambiguous on QWERTZ/AZERTY and
  non-Latin layouts, gives SVG text an atomic Gecko/WebKit hit-test fallback,
  and fully resets or disables hidden navigation/editor chrome after lifecycle
  changes. Exact header sizing no longer leaves a stale viewport.
- Opening and saving a marker no longer drops ordered, duplicate or temporarily
  unknown external controls. Climate recognizes preheating/defrosting and
  ignores vendor pseudo-actions before using its documented mode fallback;
  Optimize Plans repairs zero, null and negative grid scales to the 5 cm default.

## v1.60.1-beta.1 — 2026-08-07

- Climate markers whose integrations omit `hvac_action` now fall back to the
  current non-off HA mode advertised in `hvac_modes`, so enabled air
  conditioners regain their yellow working plate. A present action remains
  authoritative, therefore `hvac_action: idle` stays neutral.
- Room settings now opens at the medium dialog width. Long radio labels and
  source names wrap or ellipsize within the content area, eliminating the
  horizontal scrollbar while retaining responsive mobile sizing.
- Erase now treats a text label as one atomic decor object across its full
  bounding box. Clicking between glyphs or on its selection glow can no longer
  remove only the apparent outline; an empty-canvas miss is a true no-op.
- Space tabs, View/editor changes and switches between editors now use one
  short, subtle transition. Editor controls expand and collapse smoothly, and
  reduced-motion preferences still disable all navigation motion.
- While drawing a room outline, Ctrl/Cmd+click now closes the last point back
  to the first without adding another vertex. Closure requires at least two
  existing edges and refuses degenerate or self-intersecting contours.
- Editor Undo/Redo shortcuts now use layout-independent keyboard codes, so
  Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y work with non-Latin layouts too.
  Focused text and number fields retain their native browser history.
- Closed the v1.60.0 follow-up audit: reconnecting during resume settle can no
  longer strand the plan veil; legacy self-controlled switches retain their
  light-source intent and migrate to `is_light`; colour/opacity pickers use the
  browser top layer and flip/clamp inside small dialogs; Optimize repairs
  out-of-range `cell_cm` while preserving unknown/duplicate control targets;
  entity-bound legacy relays discard only their exact self-control and keep
  explicitly added sibling light targets; wall SVG fallbacks now use valid
  literal colours.

## v1.60.0 — 2026-08-07

- **Audit hardening.** Deleting one virtual marker no longer removes its
  neighbours; real `v_*` ids remain positionable; deletion tombstones are
  hidden for old clients and binding-scoped for entity members of live HA
  devices. Runtime-filtered controls are no longer destructively saved. Trail
  deletion is transactional. Optimisation clamps migrated physical styles,
  validates `cell_cm`, preserves invalid legacy transforms for manual repair
  and reports model-version bookkeeping honestly. Flat shapes are rejected,
  furniture selectors initialise reliably, rotated resize keeps its fixed
  corner, mode switches cancel live transforms, and the demo bundle is rebuilt
  from the same source as production. English device names containing
  `thermometer` now resolve as temperature sensors instead of matching the
  broader meter rule.
- Auto icons now update immediately after rebinding and can be explicitly
  pinned; imperial stroke-field bounds use inches; decor magnet geometry is
  memoised; Undo and Redo share the same live-gesture boundary.
- A marker can no longer list its own bound entity (or an entity of its bound
  device) as an external light control. Legacy self-controls are ignored immediately;
  marker Save removes them, and plan optimisation also cleans a directly bound
  entity self-reference. The explicit `is_light` switch
  remains the only way to classify that bound relay as a light source. Active
  fans/hoods still use the yellow working-state plate without entering Glow,
  Light fill or room light statistics.

- **The Background editor now has one coherent transform and style system.**
  Every decor kind can be selected, moved, resized proportionally (Shift for
  independent axes), rotated and edited numerically; lines expose endpoint
  handles. Stroke/text and fill have independent colour/opacity; stroke width
  and text size are canonical physical cm/in values. Rectangle drafts show area and ovals show radii. Drawing
  magnetises only to decor and room geometry. Decor and the plan image keep
  both dimensions on the grid even during proportional resize and use
  the named 50-step Undo/Redo stack. The image has an exclusive tool, fades to
  0.5 elsewhere in this editor, supports independent axes/rotation and remains
  fully opaque outside it. Legacy styles/transforms remain visually stable and
  migrate only via explicit plan optimisation.

- **Devices can now be deleted from the plan, not merely hidden.** Delete sits
  beside Hide/Show and requires confirmation. A deleted HA binding is excluded
  from rendering, Show-hidden ghosts, LQI, climate, room sources, light
  resolution/Glow/statistics, controls, openings and live text, while remaining
  available in Add. Re-adding replaces its minimal discovery tombstone and
  starts with a fresh position. Virtual markers are removed outright; layout,
  attachments, activity runtime and vacuum trails are cleaned, and stale-tab
  drag updates cannot resurrect the old position.

- **Device-dialog footer spans the dialog again.** The shared `hp-dialog`
  footer is now a full-width slot item instead of exposing its action row as a
  shrink-to-fit flex child. The divider no longer starts halfway across the
  modal, Hide stays at bottom-left, and Cancel/Save stay at bottom-right.

- **Auto device icons keep their label in the editor.** When a marker has no
  explicit icon override, the HA icon picker now receives the effective
  auto-derived icon as its display value, so the field shows both the glyph
  and `mdi:*` name instead of a nameless glyph. The stored override remains
  empty until the user actually selects an icon.

- **Media-player power is no longer mistaken for work.** `media_player`
  markers now stay neutral for `on`, `idle`, `playing`, `paused` and other
  transport states; an explicit `off` uses the same faded presentation as
  `unknown` / `unavailable`.
  This is a domain-level rule for TVs, receivers, speakers and soundbars, not
  a model exception. Mixed media entities fade only when none of them is
  currently available and powered.

- **Returning to a long-suspended View is stable.** In normal View (not kiosk),
  transient zero/partial ResizeObserver boxes no longer overwrite the saved
  viewport. After a genuinely long background sleep the plan is revealed only
  after the stage size is measurable and quiet, then zoom and centre are
  applied in one frame. Critical wall fill/stroke attributes also live directly
  on the SVG paths, so a warm Lovelace re-mount cannot show the browser's black
  default paint while component styles are being restored. Editors, kiosk and
  quick tab switches keep their existing immediate behaviour.

- **Device-info actions stay inside narrow dialogs.** The Edit, Open in HA and
  Close actions now wrap as complete buttons when the small HA dialog cannot
  fit one row; reduced mobile padding preserves useful width. The leading Edit
  action can no longer be pushed beyond the left edge of the modal.

## v1.59.2 — 2026-08-07

- **A11Y-02: one accessible dialog shell.** Every House Plan modal now uses
  `hp-dialog`: Home Assistant supplies the modal surface and focus trap through
  `ha-dialog`, while the standalone demo uses a native `<dialog>` fallback.
  Dialogs have an announced title, deterministic initial focus, Escape
  handling, contained Tab navigation and focus restoration to the control that
  opened the modal, including nested and dialog-to-dialog flows.

## v1.59.1 — 2026-08-06

This maintenance release makes device status and every light-related view use
shared semantic resolvers, softens Glow, and fixes the last compacted-wall
T-junction artifact.

- **Systemic device-state resolver instead of a “first entity”.** HA devices
  have no single state, so House Plan now excludes `config`/`diagnostic`
  entities first, resolves the device's functional role, then semantic binary
  signals, and uses generic switches only as a fallback. Passive readings are
  aggregated, so one unavailable entity no longer makes the whole marker
  unavailable. The same rule fixes X50/Customized Cleaning, presence/Anti
  interference, TRV service switches and equivalent integration mistakes. A
  real cover now also outranks its reverse-direction option, while a mixed
  lamp+cover remains a lamp unless the cover action is explicitly selected.
- **UX-12: one resolved light-source set.** Glow, Light fill, room light stats,
  marker indication and group controls now consume `resolvedLightSources(room)`.
  Its precedence is `controls` -> an explicit `is_light` source -> automatic
  `light.*`; hidden markers are excluded, entity ids are de-duplicated, and an
  explicit `room_id` outranks an HA area. Relays and controlled groups therefore
  mean the same thing in every light presentation.
- **Softer source glow.** The complete glow layer now renders at `0.7`
  opacity; room darkness and the yellow working-state plate are unchanged.
- **Clean real/virtual T-junctions after wall compaction.** A maximal real wall
  may cross several shorter collinear room sides. Exact endpoint containment
  now restores its thickness on every covered side even when the compacted
  wall's midpoint lies outside that room. Room hover therefore stays on the
  inner face and the adjoining real wall no longer exposes a false end cap at
  a virtual continuation.

## v1.59.0 — 2026-08-06

Stable 1.59 turns House Plan into a substantially more complete floor-plan
editor while keeping the card's live Home Assistant view coherent. It includes
every beta/RC change below and closes the line with clean-floor hover geometry
and robust wall unions.

- **Real walls, virtual boundaries and openings form one geometry system.** A
  room can mix wall thicknesses, a wall can contain real and virtual stretches,
  adjacent equal fragments compact again, and Resize preserves exact interval
  endpoints. Partial openings, virtual T-junctions, thick-wall door tunnels and
  sunlight from the inner corners of windows are handled consistently.
- **Plan edits are explicit and reversible.** Room outline, Split, Close
  boundary, Merge rooms, Delete room, Resize, wall thickness and opening edits
  have one result each and share a named 50-command Undo/Redo stack. Delete
  removes only the selected object.
- **One mandatory grid invariant.** Rooms, openings, markers, decor, furniture
  and backdrops always land on the grid or stay quantised along their wall.
  Optimize plans previews and applies all current lossless migrations, repairs
  legacy/off-grid data and compacts wall fragments with a safe one-step undo.
- **Editors gained production workflows.** Background objects open their
  properties on double click; furniture has real dimensions and wall snapping;
  live labels accept arbitrary text mixed with manually typed or picker-inserted
  Home Assistant tokens; layer and object visibility controls are explicit.
- **Device feedback uses one semantic language.** Yellow means actual work,
  orange means open/unlocked, alarms remain dominant, unavailable devices are
  muted, motion is a short event and presence lasts while detected. The marker
  plate, pulse/activity effect and source-light room fill now agree, including
  covers, climate, fans, relays, media players and other working devices.
- **Rooms explain themselves in View.** Glow and toasts are pointer-transparent;
  room hover and tooltips work through light pools, the tooltip reports clean
  floor area, and device dialogs expose an explicit Hide/Show action. The hover
  accent now follows the same inner wall faces used for area; nested-room walls
  use the face exposed to the parent floor, while doors, windows and virtual
  spans remain gaps.
- **Final wall-body correction.** Wall bodies are formed as the union of each
  room's own outset-minus-inset ring. A parent clean-floor contour can no longer
  erase half of a nested 15 cm wall or leave a white sliver at a complex
  multi-wall crossing.
- **Documentation was rebuilt from the product.** The complete Russian user
  guide, setting/device behaviour tables and improvement plan describe the
  shipped code; obsolete audits and one-off debug material live under
  `legacy/`.

## v1.59.0-rc.2 — 2026-08-06

The second release candidate makes plan editing predictable and reversible,
enforces one grid invariant, and completes the documentation refresh.

- **One tool — one result.** Closing a virtual boundary, merging rooms and
  deleting a room are now three separate Plan actions. Delete removes only the
  room that was explicitly clicked; the opening tool no longer closes an
  existing dashed stretch. The drawing action is renamed Room outline to state
  that it creates a closed room rather than a free wall.
- **One named geometry history.** Create, Split, Merge, Resize, room deletion,
  wall thickness, virtual-boundary edits and door/window add/edit/move/delete
  all share a 50-command Undo/Redo stack. Toolbar buttons and Ctrl+Z,
  Ctrl+Shift+Z/Ctrl+Y expose the same named steps; a new branch clears Redo.
  Echoes of the card's own server writes keep the history, while a genuinely
  newer external revision safely resets it.
- **The grid is mandatory.** Shift can no longer place rooms, markers, labels,
  decor, furniture, backdrops or openings between grid positions. Free points
  land on nodes; wall-bound objects stay projected and quantised along their
  wall. Shift remains only for explicitly angular controls. Optimize plans
  repairs old/imported off-grid data.
- **Clearer interaction feedback.** Glow is pointer-transparent, so room hover
  and tooltips work through a light pool. The View hover overlay follows the
  complete physical perimeter, including shared thick walls. Existing device
  dialogs now expose an explicit bottom-left Hide/Show action. The static
  space-card editor no longer offers the unused `aspect_ratio` setting. Toasts
  are pointer-transparent and cannot block a tool handle underneath them.
- **Documentation and repository hygiene.** A new Russian user guide and a
  code-grounded product audit/roadmap document current behaviour, setting and
  device matrices. Obsolete audits, rejected design notes and one-off debug
  scripts moved under `legacy/`; active docs and automated scenarios now match
  the grid, Undo and split-action contracts.

## v1.59.0-rc.1 — 2026-08-06

First release candidate of the 1.59 line: safe whole-plan optimization,
clearer object editing and room feedback, plus the beta.10 audit follow-ups.

- **Whole-plan optimizer with safe undo.** The former Align-to-grid action is
  now Optimize plans. One preview runs every current lossless model migration,
  aligns grid- and wall-bound geometry, materialises legacy open boundaries,
  merges touching virtual pieces and compacts equal-thickness real-wall
  fragments. Config and layout are committed through a durable two-store
  intent; one undo remains available until the next plan edit. Backdrop
  calibration, saved views, unattached layout entries and user files are left
  alone. Interrupted optimization/undo completes on the next integration setup.
- **Background-object properties on double click.** In the Background editor's
  Select mode, double-clicking any object now opens its properties: labels keep
  their text form, while lines, rectangles, ellipses and furniture get a compact
  colour / line-width dialog (plus fill for closed shapes). The new dialog is
  included in warm-remount draft recovery.
- **Rooms identify themselves in View.** Hover now highlights the room under the
  pointer, including rooms with no configured fill or HA area. The room tooltip
  also shows its formatted clean-floor area; thick walls use the same inner
  contour as room labels and resize measurements.
- **Yellow working state remains universal in source-light fill.** A device that
  is semantically on/working keeps its yellow marker plate when the space uses
  the per-source glow fill. The light pool supplements the marker state instead
  of replacing it.
- **beta.10 audit fixes.** The first real device transition after load is no
  longer consumed while rebuilding the registry, and changing a marker's
  effective source synchronously clears an old source's short effect. Editing a
  legacy live label preserves an explicit unit or a non-representable attribute
  instead of silently dropping it; the old `attr: state` selector migrates to a
  bare state token instead of a nonexistent attribute. Wall thickness fragments
  now persist exact normalised endpoints (legacy midpoint keys still read),
  survive resize, and
  compact into maximal equal-thickness solid runs after virtual pieces are
  closed. Virtual-wall dashes remain visible in all editors even with borders
  hidden. Release CI now reports GitHub/HACS prerelease-order trouble instead of
  silently publishing a beta that HACS cannot discover.

## v1.59.0-beta.10 — 2026-08-05

Tenth pre-release of the 1.59 line: one coherent device-state language and a
focused set of wall, doorway-light and background-label refinements.

- **One device-state language.** Marker plates and effects now come from one
  semantic resolver: yellow means actual work, orange means open/unlocked,
  unavailable is faded, and alarms are always red. The display list is reduced
  to Icon, Icon + activity and Value; the removed Ripple-only value migrates to
  Icon + activity on the next save. Activity distinguishes short events,
  persistent presence, mechanical travel and actual running, with
  reduced-motion fallbacks and no false event on first load or reconnect.
  Short effects also reset when a marker's effective source changes, while a
  cover's real opening/closing state takes precedence over the tap fallback.
- **Clearer wall-drawing toolbar.** The Plan editor's former “Add” tool is now
  labelled “Walls”, and its new-wall thickness field sits immediately to the
  right of that button instead of after the rest of the toolbar.
- **View-mode virtual walls sit behind thick wall bodies.** Their stored
  geometry still reaches the physical centreline, but in View the hatch masks
  the dash ends inside adjoining thick walls. All three editors keep saved
  dashes and live previews above the wall body so the complete span remains
  visible while editing.
- **Door light respects thick-wall reveals.** Light now crosses a doorway only
  through the clear width of its physical wall tunnel. The near and far inner
  face spans jointly clip the spill, so the two jamb returns cast the expected
  cut-offs for an off-centre source; zero-thickness walls retain the previous
  doorway sector.
- **Inline HA variables in decor text.** A label can now mix ordinary copy and
  multiple `{entity}` / `{entity:attribute}` references. Choosing a state or
  attribute inserts its token at the textarea caret. The separate unit field,
  one-slot hint, and preview are removed; old linked labels remain readable and
  migrate to inline tokens when edited.
- **Canonical wall fragments.** Touching or overlapping virtual stretches on
  the same boundary and room pair now collapse into one `open_span`; Split
  pieces belonging to different room pairs remain separate. When removing the
  last virtual stretches leaves an original wall solid and uniformly thick,
  its atomic thickness entries collapse back to one whole-wall key.

## v1.59.0-beta.9 — 2026-08-05

Ninth pre-release of the 1.59 line: mixed virtual/thick resize integrity and
clean, visible virtual T-junctions.

- **Resize keeps mixed virtual/thick walls intact.** A live edge drag now moves
  `open_spans` and whole/atomic thickness keys together with the room polygons;
  commit no longer drops the thickness of the solid remainders, and Undo
  restores the complete transaction.
- **Clean virtual T-junctions.** Real wall arms owned by different room
  contours receive the missing mitre at an open-span endpoint instead of a
  stepped corner. Virtual dashes and the two-click drawing preview paint above
  real wall bodies, so they stay visible right up to the junction centreline.

## v1.59.0-beta.8 — 2026-08-05

Eighth pre-release of the 1.59 line: beta.7 audit follow-ups, a fail-closed
release path, full/static wall-render parity, and sunlight anchored to the
room-side corners of thick window openings.

- **Sun rays start at the inner window corners.** With wall thickness, the
  wedge's full source span now sits on the room-side face of the opening, so
  both crisp side edges begin at its two inner corners even at an oblique sun
  angle. The clean-floor contour still clips the light at the wall body.
- **Beta.7 audit follow-up.** A Split crossing one `open_span` now keeps every
  valid room-pair piece and derives `open_to` for both children instead of
  silently turning one half back into a solid wall (`AUD-159B7-01`).
- **Release safety.** `release.yml` resolves the published tag to its exact
  commit and waits for all matching Validate runs to finish green; missing,
  failed, cancelled or timed-out validation withholds the asset
  (`AUD-159B7-02`). The same fail-closed policy has automated negative tests.
- **Test/render parity.** General-settings smoke includes the Walls group,
  inventory counts class-based and trail backend tests, and the static space
  card uses the same 3 px thin-wall hatch fallback as the full card
  (`AUD-159B7-03`, `AUD-159B7-04`).

## v1.59.0-beta.7 — 2026-08-05

Seventh pre-release of the 1.59 line: audit fixes for partial-wall geometry and
lifecycle, plus wall fill colour under the hatch.

- **Wall fill + hatch.** General setting `fill_colors.wall_fill` (default opaque
  white) paints under the diagonal hatch; the hatch stays. Thin-on-screen bodies
  keep the solid fill alone so the hatch does not collapse into noise.
- **Atomic wall intervals (AUD-159B6-01).** Thickness and open cuts follow
  shared-boundary / open-span endpoints, not whole polygon edges — a partial
  shared stretch no longer leaks thickness onto the outer remainder, and an open
  span away from the edge midpoint clears only its own piece.
- **Open-span geometry transaction (AUD-159B6-02).** `open_spans` ride in the
  resize snapshot/Undo; Split / Merge / Delete rekey, clip and sync `open_to` in
  one step without resurrecting a legacy stretch mid-mutation.
- **Backend `open_spans` schema (AUD-159B6-03)** with cap / finite points /
  dedupe; frontend fail-soft sanitises malformed entries.
- **Warm owner vs pending nav (AUD-159B6-04):** adopting a warm viewport clears
  the global LS pending mode so a neighbour card cannot overwrite the owner's
  editor and draft.
- **Smoke / inventory hygiene (AUD-159B6-06):** two-click openwall fixtures,
  island-by-id, render-perf hook on `_openPairs` / `_buildModel`, inventory
  counts `test` and `it`.

## v1.59.0-beta.6 — 2026-08-05

Sixth pre-release of the 1.59 line: partial open-wall spans and wall-centric Delete.

- **Partial open (virtual) wall spans** (`space.open_spans`): two-click openwall
  (anchor → second point on a shared wall, clamped to nearest corners); crosshair
  cursor; openings on virtual stretches are removed and cannot be placed;
  thickness clears on open and restores from neighbour / 15 cm on close. Legacy
  `open_to` still expands to the full shared boundary on read.
- **Wall-centric Delete**: virtual → solid; shared solid → confirm merge (whole
  shared boundary); outer wall or click inside room → confirm delete room.

## v1.59.0-beta.5 — 2026-08-05

Fifth pre-release of the 1.59 line: wall-thickness redesign (seamless ±½ rings, inner floor/area/sun), draw-with-thickness, new-space opens the plan editor, and audit hygiene from the beta.4 recheck.

- **Draw with wall thickness.** The Plan Draw toolbar has a thickness field
  (default 15 cm / HA inches). New rooms get that thickness on commit; shared
  walls keep the neighbour's value; empty clears. Live thick preview while
  drawing.

- **New space opens the plan editor.** Saving a newly created space switches to
  Plan with the draw tool armed, so an empty floor is not left in View with
  nothing to look at (same as the first-space onboard path).

- **Wall thickness redesign (docs/WALL-THICKNESS.md).** Walls grow ±½ from the
  centreline (outer and shared); bodies are outset−inset rings unioned into one
  hatch (seamless L/T as in the reference plan); fills/glow/sun clip to the
  inner contour; displayed m² is the clean floor; sun wedges narrow through the
  opening tunnel. Resize/undo/scale keep and re-key `walls`; openings resolve by
  wall angle; plan-editor mode restores after `can_write`. Hatch colour matches
  the wall outline.

## v1.59.0-beta.4 — 2026-08-05

Fourth pre-release of the 1.59 line: wall thickness in the plan editor, and a
fix so editors keep a white drawing sheet under the grid even when a backdrop
image is loaded.

- **Wall thickness in the plan editor (docs/WALL-THICKNESS.md).** A wall carries
  one thickness (`space.walls: [{ key, cm }]`), entered in cm or inches from HA's
  unit system. Shared walls grow half into each room; outer walls grow inward;
  open boundaries refuse thickness. Hatched bodies follow `show_borders` (always
  visible in the plan editor); openings cut the slab full-depth and door swings
  start at the inner face. Area, glow and sun stay on the polygon. The static
  space card draws the same bodies. Unit + smoke: `test/wall-thickness.test.mjs`,
  `demo/smoke_wall_thickness.mjs`.

- **Editors keep a white sheet under the grid with a backdrop.** With an uploaded
  plan image, the plan / devices / decor editors used the theme card colour under
  the grid instead of the white drawing sheet of a hand-drawn plan. They now stay
  white; View is unchanged (theme under an image, white without one).

## v1.59.0-beta.3 — 2026-08-05

The third pre-release of the 1.59 line: you can furnish the plan with
top-view symbols at real size, hide the decor layer or the openings from
View without losing them, aim card-mod at stable `data-*` hooks, and let
Home Assistant format entity values the way its own more-info does. A
handful of editor polish lands with it — bead-sized corner handles, the
backdrop editor opening on its own tool, virtual walls following the
room-border switch — plus the audit follow-ups (write policy, README
differentiation, tighter validation). Wall thickness is approved as a
written spec only (docs/WALL-THICKNESS.md); it is not coded yet.

- **Two new switches in a space's settings: «Hide the decorative layer» and
  «Hide doors and windows».** Both only hide. The shapes, labels, furniture
  and openings stay in your config, and each stays visible in the editor that
  owns it — the backdrop editor always draws decor, the plan editor always
  draws openings — because a layer you cannot see is a layer you cannot edit.
  What an opening *means* is untouched either way: light still spills through
  it, the sun still comes in at a window, a contact sensor still opens it; only
  the symbol is gone. Both are off by default and store nothing when off, so
  every existing plan reads back unchanged.

- **A space that does not draw room borders no longer draws virtual walls.**
  With «Always show room borders» off, the dashed stretches of an open boundary
  used to survive on their own, leaving a plan with no walls except a few
  floating dashes. They now follow the same switch. The plan editor still shows
  them — the Open-boundary tool has to show what it edits.

- **The backdrop editor opens on the tool it is named after.** With a picture
  in the space, «Backdrop image» is armed the moment the editor opens, so
  dragging the picture works straight away instead of after finding the tool.
  The frame was already drawn on open, which promised a draggable picture; the
  promise is now kept. Select is still one click away and still leaves the
  picture's body to the one-finger pan.

- **Corner handles are beads again, not blobs.** Every corner handle in the
  card — the backdrop frame, the room-resize frame and the robot-map fit —
  paints a circle a **quarter** of its old radius while its clickable area is
  unchanged, matching the text block's handles. A handle the size of a room
  hides the thing it is there to adjust.

- **You can furnish the plan (docs/FURNITURE.md).** The background editor
  gains a seventh tool, **Furniture**: a grouped palette of ~30 top-view
  symbols — furniture, appliances, plumbing and a few odds like stairs and a
  rug — that are placed at their **real size**. Pick a sofa, correct the
  2.2 × 0.9 m in the two fields if your sofa is a different one, click the
  plan, and 2.2 m of *your* plan is what it takes, because the size goes
  through the space's `cell_cm` like every other length in this card. While
  you place or drag it, the nearest wall within ~30 cm claims it: the piece's
  back lands flat on that wall and turns to it, so "put the bed against that
  wall" is one click. Shift suspends the magnet, as Shift suspends every snap
  here. A placed piece is selected in the **Select** tool and wears the text
  block's frame — the corner handles now set **width and depth independently**
  (a bed is not made deeper by being made wider), with live badges showing
  both in metres or feet, and the handle above it turns the piece in 5° steps.
  The symbols are **drawn by us, in code**: an icon set draws a sofa seen from
  the front in a 24 × 24 square, and stretching that into a 2.2 × 0.9 m
  rectangle gives an icon lying on the floor rather than a plan. That also
  settles the licence question outright — nothing third-party ships in the
  bundle. Every piece carries `data-kind="furniture"` and `data-symbol`, so
  card-mod can colour all the plumbing in one rule. New kind, nothing
  migrated: a plan written before this reads back byte-for-byte.

- **The plan has stable hooks for card-mod (docs/STYLING-HOOKS.md).** Every
  object the plan draws now carries the same identity — `data-hp` says what it
  is (`device`, `room`, `room-label`, `opening`, `decor`, `space-tab`),
  `data-id` is its id in your config, and where it applies `data-entity`,
  `data-area` and `data-kind` (door/window, line/rect/ellipse/text) come with
  it. That is all this is: we do not ship a CSS field, do not add a theme
  editor and do not support user stylesheets — we simply stop getting in the
  way of a power user who has already installed card-mod and only needed
  something stable to aim at. The names are a contract now: renaming one is a
  breaking change. Everything NOT in that table — editor chrome, boot classes,
  layer wrappers, dialog markup — is explicitly not the contract. The doc
  carries the table, three worked examples, the shadow-DOM limits (you can
  style an `ha-icon` host, never its insides) and a plain disclaimer that
  card-mod is not ours to support.

- **Values are formatted by Home Assistant, not by us.** Wherever the card
  prints one entity's state — the value badge of a «value instead of icon»
  marker, a live decor label, the device info card — it now goes through
  `hass.formatEntityState` (and `hass.formatEntityAttributeValue` for an
  attribute), the same call HA's own more-info makes. So a sensor's
  `display_precision` is honoured, the decimal separator is the one your
  locale uses, and `on` finally reads as *Включено* instead of `on`. The unit
  lands exactly once — the formatter usually appends it, and where it does not
  we still do — and your own unit on a decor label replaces the entity's
  rather than piling on after it. An older Home Assistant without those
  methods behaves exactly as before. The small °/% plates next to an icon keep
  their own compact form on purpose: they are a derived reading (an average
  over the area's sensors, a climate device's `current_temperature`), not an
  entity state, and the plan reads as one instrument panel because they all
  look alike.

- **The text block's handles are a quarter of the size** (owner's request).
  The corner circles and the rotate handle above a selected label are now ink
  the size of a bead instead of a button, so the frame stops covering the very
  words it frames. The area you can grab is unchanged — an invisible
  finger-sized circle still owns the gesture at the old 1.8 % of the visible
  view, exactly the split the wall-resize handles use.

- **Wall thickness — the approved spec (docs/WALL-THICKNESS.md).** Not
  implemented yet; the document captures the model (thickness on a wall, not
  a room edge), segment keys that survive resize, hatching that does not
  affect area, and how openings render in a thick wall.

Audit follow-ups from `legacy/docs/audit-v1.58.0/AUDIT-RECOMMENDATIONS.md` (2026-08-05):

- **Write policy aligned (P0-4).** `admin_only` now defaults to **on** for new
  installs and when the option key is missing; `houseplan/config/get` returns
  `can_write` from `may_write`, and the card's editor chrome follows that flag.
  Missing `hass.user` no longer fails open into the editors.
- **README differentiation (P0-3).** Comparison table now positions House Plan
  against both YAML/SVG incumbents and GUI draw cards (e.g. easy-floorplan):
  shared `.storage` map + area-bound rooms, not furniture CAD.
- **Validation tighten (P3-4).** Marker `binding` must be `device:…` /
  `entity:…` / `virtual`; `ripple_color` is `#rrggbb`; decor rect/ellipse
  extents are strictly positive; space `id` matches `SPACE_ID_RE`.
- **Hygiene (P3-5).** `quality_scale.yaml` points at the real config-flow test
  file; card-level `tap_action` documented as deprecated/ignored.

## v1.59.0-beta.2 — 2026-08-04

The second pre-release of the 1.59 line, and it is about the words you put
on the plan. A decor label can now read a live value off an entity, so a
caption becomes a readout without becoming a template language. The text
block itself lost the choice between three font sizes: it is scaled by its
corners and turned by its handle, like every other object on the plan, and
it may have more than one line. Under that, the three findings of the
beta.1 audit are closed — two identical cards no longer share one warm
memo, a rapid double re-mount no longer eats the draft, and an expired
dialog no longer holds a plan file in memory.

- **A decor label can show a live value (docs/LIVE-TEXT.md).** A text shape
  gains three optional fields — `entity`, `attr`, `unit` — and its `text`
  becomes a template whose `{}` is where the value lands: `Бак {}` reads
  *Бак 68 %*. Without a placeholder the value is appended; without an entity
  the label is byte-for-byte the static one it always was. The unit comes
  from the entity unless you type your own; a dead, unknown or missing
  entity shows an em dash instead of quietly vanishing. Nothing is rounded
  or reformatted — the value is what Home Assistant reports, because
  rounding belongs to the sensor's `display_precision`. Not a template
  language: one value, one place, no syntax to get wrong.

- **The text dialog gained an entity picker, an attribute picker and a live
  preview.** The attribute list is the chosen entity's own attributes, the
  unit field shows the entity's unit as its placeholder, and the preview is
  rendered through the very same substitution the plan uses.

- **A text block is sized by its corners and turned by its handle.** The
  choice between three font sizes is gone: select a label and pull a corner
  to scale it, or use the handle above it to rotate in 5° steps (Shift for
  any angle) — the same mechanics as the backdrop frame. Labels drawn with
  the old Small/Medium/Large come back at exactly their old size, and the
  first drag replaces that setting with the scale it meant.

- **A label can have more than one line.** The text field is a textarea now:
  your line breaks are stored and drawn as line breaks, centred, with the
  block growing around its anchor. Nothing wraps by itself — a caption that
  reflows on a state change is a caption that jumps around the plan.

- **The text tool edits the label you press on.** Drawing tools own the
  canvas (a new line must be able to start on the end of an old one), and
  that stays true — with one exception: pressing an existing label with the
  text tool opens ITS form instead of starting a second label on top of it.
  Empty canvas and non-text shapes still create a new label.

- **Two identical cards on one page no longer share a warm memo
  (AUD-159B1-01).** The memo key was the window size and the card config,
  which cannot tell two placements of the same config apart: the newer of
  them was the last writer, and a card re-created in the OTHER placement
  woke up with its neighbour's floor, editor mode and zoom — while the
  draft of its real predecessor was eaten by the mode guard. The memo now
  keeps one entry per card PLACEMENT: `location.pathname` (the dashboard
  view) joins the key, and inside a key the entry is claimed by DOM slot —
  the parent element and the index in it — with a live neighbour's entry
  never adoptable. When two placements are genuinely indistinguishable
  only the settled header height is adopted (it is the same for both),
  never the viewport and never the dialog.

- **A rapid double re-mount no longer destroys the draft
  (AUD-159B1-02).** `disconnectedCallback()` cleared the «I still owe my
  predecessor a dialog» flag BEFORE taking its snapshot, so a middle
  instance in an A→B→C rebuild wrote `dlg: null` over a draft it had not
  yet restored, and the third instance got nothing. The snapshot now runs
  while the flag is still set: an unsaved dialog simply travels down the
  chain until one instance lives long enough to reopen it.

- **An expired dialog no longer holds its payload (AUD-159B1-03).** The
  10-second revive TTL was only a rule checked at revive time; the entry
  itself kept the dialog — for a space dialog that is a whole plan file
  as base64 — until the page reloaded. Detaching now arms a guarded
  eviction that frees the payload the moment it stops being revivable
  (and drops the stale slot, so the next claim is unambiguous again).

## v1.59.0-beta.1 — 2026-08-04

Minor pre-release: the card survives a Lovelace re-mount bit-for-bit —
your pan, your zoom and even the dialog you had open come back with it —
sun rays get a hairline edge so they read on white paper, the «+» that
adds a space leaves the Plan editor for the tab row, and the list of
plans already uploaded to the server stops collapsing into a stripe.

- **The card no longer twitches — and no longer loses your open dialog —
  when you come back to the tab (docs/WARM-REMOUNT.md).** Lovelace
  re-creates the card element on a websocket reconnect; v1.58.0 removed
  the preloader flash, but the new instance still had to guess what the
  dead one had been looking at. Measured: the PAN never left the instance
  (a view parked in a corner came back re-centred: x=50 → x=250 at
  zoom 2.2), and the EDITOR zoom is deliberately not persisted while the
  editor MODE is — so a re-mount inside an editor came back at 1.0
  instead of 3.0. The warm memo now carries the whole viewport (space,
  mode, zoom, the `_view` rect itself, the view-mode snapshot, the
  «show far objects» frame, the selected tool and selection, the local
  «show hidden» toggle), so the restore is the same RECTANGLE, not the
  same zoom number — bit-for-bit, verified frame by frame.

- **An open dialog survives the re-creation with its draft.** The memo is
  module state and is never serialised, so the live draft object — a
  half-filled device dialog with its uploaded PDFs included — moves over
  for free. The rule is «revive the draft, never revive the decision»:
  the confirmations for «Align everything to the grid» and for a room
  merge are deliberately NOT restored (a modal whose whole content is
  «press OK to rewrite your plan» must not greet a returning user), nor
  is a tap confirmation (it closes over the dead instance), nor the floor
  import wizard (it reopens itself), nor any dialog with a save in flight.
  Revival requires the same space and the same mode, happens at most once
  (the snapshot is consumed), and only if the previous instance died
  within the last 10 s. A dialog closed on purpose — Esc, Cancel or
  Save — writes `null` into the memo on the very next render, so it can
  never come back (smoke_warm_dialogs).

- **Sun rays get an edge (docs/SUN.md, «The rim»).** On a white plan a
  wedge of light was nearly invisible, and no amount of opacity could fix
  it: painting light means adding luminance, and white paper has none
  left to give. Every lit wedge now carries a 1 px black hairline along
  its two SIDE edges — the ones running inward from the ends of the
  window. It fades to nothing on exactly the same axis, the same curve
  and the same 85 % threshold as the fill (a second gradient built on the
  fill's own stops), stays one screen pixel at any zoom
  (`non-scaling-stroke`), is cut by the room like the wedge itself, and
  lives in the same layer — so the 3° threshold, the two-second fade,
  cloud cover, night and the editors govern it without a line of extra
  logic. Peak opacity 0.42, picked against a white sheet and the dark
  glow canvas alike. The «shade instead of light» model of
  legacy/docs/SUN-CONTRAST.md was rejected in favour of this; that file now
  records the decision and keeps the analysis behind it.

- **The «+» that adds a space is not an editor tool.** The button next to
  the floor names only existed inside the Plan editor, so adding a second
  floor meant first opening an editor you did not want. Adding a space is
  navigation, not markup: the «+» now sits in the tab row in every mode —
  View and all three editors — exactly where the per-space gear already
  lives, and under the same admin rule. The kiosk is a shop window: the
  button is not rendered there at all (its header is `display:none`, and a
  hidden-but-present node is still clickable from script). The tab row
  wraps as before at 390 px (smoke_gear_tabs measures the overflow).

- **«Already uploaded» shows the plans again.** In both space dialogs
  (new space and space settings) the list of plans stored on the server
  collapsed into a thin rounded stripe: the rows were rendered, the box
  itself was 14 px tall. A scrolling box is a flex item whose automatic
  minimum size is zero, and the dialog body is a flex column with a
  66 vh cap — so the picker was the one child that could be squeezed to
  nothing. It no longer shrinks and keeps a floor of its own; up to five
  thumbnails are visible at once and the rest scroll. The empty and
  loading states stay readable instead of clipping their own text
  (smoke_plan_picker measures the heights — the old smoke only counted
  DOM nodes and passed).

## v1.58.0 — 2026-08-04

Minor release: the backdrop picture becomes a movable, scalable object,
the opaque plan sheet is redefined as the room contours, the decor
drawing tools stop stealing clicks, and «Align everything to the grid»
tells the truth about what it is going to do.

### The backdrop picture can be moved and scaled (docs/BACKDROP.md)

- **The plan image is no longer nailed down.** In the Background
  editor the picture gets a transform frame: drag it by its body to
  move it, pull a corner to resize it evenly (proportions kept, the
  opposite corner stays put). A live badge states the picture's real
  size in metres (or feet) while you drag, through the space's
  `cell_cm`. Position and size land on the grid; Shift steps off it.
  Nothing else moves — rooms, doors, devices and decor stay put — and
  there is no rotation.
- Three new optional space fields: `plan_x`, `plan_y`, `plan_scale`.
  Their absence is exactly the old behaviour, so **existing plans
  render bit-identically and nothing is migrated**. «Вернуть картинку»
  in the toolbar clears them.
- **The opaque plan sheet is now always the room contours.** It used
  to be the image rectangle whenever a picture was attached; now the
  picture is drawn ON the sheet — above it, below the walls. The
  scene colour (`bg_color`, the `daynight` sky) therefore reaches the
  exterior walls on an image plan too. Consequence, deliberate: a
  transparent picture over a space with no rooms drawn shows the
  scene background through itself.
- «Вписать всё» counts the moved and scaled picture, so it can no
  longer be left off screen.

### Drawing tools no longer grab the shape under the cursor

- **A drawing tool owns the canvas.** With Line, Rectangle, Oval or
  Text picked in the decor editor, clicking on an existing figure now
  starts a NEW figure instead of selecting the old one — so a line can
  begin exactly on the end of another line, and a rectangle can be
  drawn on top of a filled one. Double-clicking a text under a drawing
  tool no longer opens it for editing either. The same inertness
  applies in the «Картинка-подложка» tool, where a decor shape lying
  over the plan must not block the picture's own drag.
- «Выбрать» and «Стереть» are unchanged: shapes stay clickable there,
  which is where selecting and deleting belong.

### «Align everything to the grid» keeps its promise (AUD-158B1-01)

The action has no undo, so its confirmation dialog is the only safety
there is — and it was understating the damage.

- **The maximum shift is measured on the geometry that is actually
  written**, not on an intermediate one. A rect was measured by its
  origin and its far corner only — so the minimum-size correction that
  widens a too-thin box afterwards went unmeasured, and the two corners
  that carry the X error of one side together with the Y error of the
  other were never looked at at all. An ordinary box could move √2
  times further than promised; a box thinner than one grid step, much
  further.
- **Each space is converted through its own `cell_cm`.** The dialog
  used to take one normalised maximum and multiply it by the cell size
  of the FIRST space: a plan whose ground floor is drawn at 5 cm per
  cell and whose attic is at 100 cm promised 2.5 cm for a vertex that
  moved 50 cm. The report now carries the maximum in centimetres and
  the space it belongs to, and the dialog names that space when there
  is more than one.
- The last tenth of a centimetre is rounded **up**: the promise can
  never be smaller than the deed.

### An opening whose only error is its angle can now be fixed (AUD-158B1-02)

- A window sitting exactly on its wall but holding a wrong `angle` used
  to come back as `changed: false` — the dialog said there was nothing
  to move and offered no button, while the returned plan differed from
  the one given. Such openings could never be aligned. The angle is
  part of the diff now; the dialog counts them separately, and the
  displacement is measured on the opening's ENDS, so turning it in
  place is not free in the report either. Turning an opening end over
  end (180°) is still counted as a correction but displaces nothing.

## v1.57.0 — 2026-08-04

Minor release: the canvas becomes infinite — no more "plan size", no
more edge to run past — plus a tap action for curtains and blinds,
a polish pass over the sun, live rulers while placing openings, and a
warm re-mount that no longer flashes.

### The infinite canvas (docs/CANVAS.md)

The idea of a "grid size" or "plan size" is gone. The canvas is
conceptually unbounded — any coordinate is legal, with a `+/-5000`
limit kept only as garbage insurance (about 60 km of plan at the
card's own scale).

- **If your plan ran off the edge, it now just works.** Some plans
  grew past the old square and devices simply could not be placed
  outside it; the only workaround was to redraw everything. That
  limit no longer exists: draw, drag and place devices anywhere, and
  nothing needs to be redrawn. Your stored plan is untouched — the
  coordinates mean exactly what they always meant, and there is no
  migration.
- **Existing plans open exactly as before.** Verified on a real
  three-floor config: the opening frames come out bit-for-bit
  identical to v1.56.0.
- **The opening view is derived from what is actually drawn.**
  `view_box` is now an optional hint for the very first frame only;
  after that the starting view is always computed from the real
  content, with outliers rejected so one stray room cannot shrink the
  whole plan.
- **Pan at any zoom, in every editor.** Dragging the plan used to work
  only above 100% zoom; now it works at any zoom and in all editing
  modes, with one screen of slack around the content.
- **Zoom out to 3x the content**, so you can see the whole plan and
  the space around it.
- **"Fit everything" button** — one tap frames all the content again.
- **A "home is that way" arrow** appears when you have panned away
  from the plan, pointing back to it.
- **An adaptive grid.** The grid picks its step from the zoom
  (1 / 2 / 5 / 10 ... 1000) instead of a fixed cell, and the dots stay
  a muted hint rather than a pattern that competes with the plan.

### Curtains and blinds

- **New "Open/close" tap action for covers.** Closed opens, open
  closes, and a cover in motion stops. Offered only for the
  unprotected device classes — garage doors, doors and gates stay on
  the info dialog, on purpose.
- **The icon itself tells you the state**: it morphs between the open
  and closed shape (a table of cover classes, plus aliases resolved
  from the base icon), and pulses with a soft ring while the cover is
  travelling.
- **A curtain never wears a coloured plate.** No state fill behind a
  cover marker, ever.
- **The cover is found among all of the marker's entities**, not just
  the primary one — which is the common case for Aqara and
  zigbee2mqtt devices — and an explicit "Open/close" choice always
  wins the indication.

### Sun polish

- **Brighter, shorter rays.** Opacity up to 0.30, length down 30%,
  with crisp sides again.
- **Light fades only along the ray**, and is guaranteed to reach zero
  before the wedge ends — the wedge is now clipped by distance along
  the ray, so the "bright rim" that appeared with a low, oblique sun
  is gone.
- **A hard 3 degree threshold.** The rays appear and disappear at 3
  degrees of solar elevation over a two-second fade, instead of
  creeping in.
- **The day/night sky catches up with the sun** when you come back to
  the tab: a gap of more than 3 degrees is repainted at once, while
  normal movement keeps breathing smoothly.

### Everything else

- **Live rulers and the centre magnet while PLACING an opening**, not
  only while dragging one — with the distances measured along the
  owning room's own edge.
- **A warm re-mount.** When Lovelace recreates the card on reconnect
  there is no preloader and no flash of the plan any more, and a
  dropped WebSocket never blanks a plan that is already on screen.
- **Room borders and names default to dark grey `#55606c`** instead of
  the accent blue. If you picked a colour explicitly, nothing changes.
- **An "About" block at the end of the general settings** — card
  version, GitHub and Telegram links.
- **The icon angle now steps by 5 degrees.**
- Audit fixes: the sun-ray cache survives local edits, hidden devices
  no longer stretch the frame, the editor's grown frame does not leak
  into view mode, an outlier room no longer inflates icon sizes, and a
  kiosk pan stays a pan instead of flipping to the next floor.

## v1.56.0 — 2026-08-03

Minor release: the sun comes to the floor plan — a compass, a day/night
backdrop and real sunlight through the windows — plus room temperature
from climate devices, a design-token pass over the UI, live rulers for
opening drags, and a sun-cache fix.

- **The sun on your floor plan** (docs/SUN.md). Tell the plan where
  north is — a compass dial in the general settings, with a per-space
  override — and the card starts living by Home Assistant's own
  `sun.sun`:
  - *Day/night backdrop* (`bg_mode: daynight`): the scene behind the
    plan follows the sun's elevation — white at full day, warm gold
    through the golden hour, cooling dusk, deep night. The plan itself
    dims only ~10% at night, so the rooms stay readable.
  - *Light through the windows* (`sun_rays`): every window on an
    exterior wall casts a soft wedge of light into its room — clipped
    by the room's own contour, warmer near the horizon, stretching
    long at sunrise and sunset, short at noon, gone after dark.
  - *Clouds, if you want them* (`weather_entity`): point at a weather
    entity and an overcast sky mutes the wedges; rain or snow puts
    them out. A dead sensor never kills the sun.
  - The plan now sits on an *opaque sheet of paper* traced along the
    room contours: the scene background — `bg_color` or the daynight
    sky — is visible only around the walls and never bleeds through
    the rooms; in day/night mode the sheet casts a soft shadow.
  - The whole feature is silent until the compass is set; without
    `sun.sun` the settings dialog explains why.
- **Room temperature from climate devices.** A new checkbox in the
  device dialog puts the AC's or thermostat's `current_temperature` on
  the badge next to its icon and into the room's average temperature.
- **UI modernization.** A design-token pass over `styles.ts` — 209
  hard-coded values unified into spacing/radius/font/shadow scales —
  and native `ha-switch` / `ha-slider` controls in the dialogs, with a
  hard fallback to the old plain inputs where HA components are
  unavailable.
- **Live rulers for opening drags.** Dragging a door or window now
  shows the live distances to both ends of its wall, measured along
  the owning room's edge; a dashed guide and a soft magnet snap the
  opening to the wall's center (hold Shift to disable the magnet).
- **Fix DEV-B701-01** — the sun-ray cache is now invalidated by local
  geometry edits too, so a wedge can no longer go stale after you move
  a wall locally before the server confirms the change.

## v1.55.3 — 2026-08-02

Patch release: two fixes for the v1.55.2 first-open veil, found by an
adversarial lifecycle audit (AUD-1552-01/02).

- **A dashboard rebuild during the first open can no longer leave the
  plan hidden forever** (AUD-1552-01). Disconnecting the card while the
  boot veil was up (Lovelace recreates its DOM, a view switch remounts
  the card) killed the settle timers but kept their ids, so nothing ever
  lifted the veil again. The veil lifecycle now restarts from every
  reconnect — with a fresh clock and an unconditional hard cap — and the
  fade-out also survives a mid-fade remount.
- **The veil no longer opens early, right before a late panel lands**
  (AUD-1552-02). Two equal height reads at 200/400 ms used to reveal the
  plan at ~400 ms, so Home Assistant chrome arriving at 450+ ms jumped
  on a visible plan — exactly what the veil was meant to prevent. The
  veil now holds for a full protective window with trailing quiescence
  (height changes near the cap extend the wait), and for a short grace
  after the reveal any later shift glides via a height transition
  instead of snapping. Deliberate height changes (entering an editor)
  still apply instantly.

## v1.55.2 — 2026-08-02

Patch release: a calmer first open — no zoom flash and no layout jumps
while Home Assistant is still settling — plus a new background color
setting and two bits of editor polish.

- **Opening a plan no longer flashes the default view before your saved
  zoom** (HP-1551). The saved zoom used to be applied a beat after the
  first render, so the card painted the default fit for a frame and then
  snapped to your position. It is now applied synchronously, before the
  first paint — the plan appears exactly where you left it.
- **A first-open veil hides the plan until the layout settles**
  (HP-1552). While Home Assistant is still loading its side panels, the
  stage height can change several times, and the plan visibly jumped
  along with it. The card now waits under a dark veil with a pulsing
  house outline until the height stops moving, then reveals the plan
  already in place. Kiosk mode skips the veil entirely.
- **New setting: background color around the plan** (HP-1554). The area
  around the plan can now be any color — set it in general settings for
  the whole card, or override it per space. The backend validates the
  value as a #rrggbb hex color.
- **Round caps and joins on background-editor lines** (HP-1553). Strokes
  used to end and meet in square cuts; line ends and corners are rounded
  now, so traced walls and outlines look clean.
- **The Resize tool's wall handles now look the part.** They are half
  the previous size, show a wall-with-arrows glyph that rotates to
  follow the wall, and use the grab cursor — while the hit area stays
  exactly as large as before.

## v1.55.1 — 2026-08-01

Patch release: the four findings of the v1.55.0 audit, all in the new
Room resize tool (HP-1550-01..04).

- **A pending save can no longer leak a live drag to the server**
  (HP-1550-01). The resize preview used to be written straight into the
  shared config object, and a debounced save still queued from a
  previous edit could snapshot it mid-drag — so a resize you then
  cancelled with Esc quietly survived on the server and came back after
  a reload. The live geometry now stays in a separate overlay that only
  the renderer sees; it reaches the config exactly once, when the
  handle is released.
- **An interrupted drag is cancelled, not committed** (HP-1550-03).
  When the system cuts a drag short — switching apps, palm rejection on
  a tablet — the tool used to treat it as a release and save the
  half-finished geometry. Such interruptions now take the same path as
  Esc: the original geometry comes back, no undo step, no save.
- **A door in the middle of a wall no longer blocks resizing it**
  (HP-1550-04). The door's invisible hit area used to sit on top of the
  wall handle, making such a wall ungrabbable for both rooms. In the
  resize tool the handles now own the hit test (openings are not
  editable there anyway — they simply travel with the wall), while all
  other editor tools keep openings clickable exactly as before.
- **The ~30 cm minimum size now holds for any room shape**
  (HP-1550-02). The old check only measured parallel opposite walls, so
  a triangular room could be squeezed into a sliver, and a rotated
  room could scale its real short side below the floor unnoticed. Both
  measures are orientation-independent now: wall drags respect every
  obstacle in the wall's path (a triangle's apex, a slanted wall), and
  the scale frame uses the room's true minimum width. Rooms already
  thinner than the floor may still be improved, never made worse.

## v1.55.0 — 2026-08-01

Minor release: rooms are no longer set in stone — a dedicated Resize
tool in the plan editor changes their size by dragging walls; plus the
two findings of the v1.54.3 audit (HP-1543-01/02).

- **Room resize — a new «Размер» tool in the plan editor** (spec:
  docs/RESIZE.md). Every wall gets a handle at its midpoint; drag it
  and the whole wall moves, staying parallel to itself, with grid
  snap. Works for polygons (L-shapes included) and for legacy
  rectangles alike.
- **Shared walls always move together.** If the dragged wall coincides
  with a neighbour's boundary, the neighbour follows: your room grows,
  the neighbour shrinks — gaps and overlaps cannot appear by
  construction. At T-junctions only the coinciding stretch follows,
  inserting new corners into the neighbour's outline where needed.
- **Live numbers while you drag.** The dragged wall and its two
  adjacent walls show their lengths in real meters/feet, and the room
  area in m² updates live at the room centre — for a shared wall, the
  areas of both rooms.
- **The wall stops where it must.** Rooms cannot get thinner than
  ~30 cm (neither yours nor the neighbour's), an outline never crosses
  itself, a growing wall stops at foreign rooms and island rooms, and
  doors and windows are anchors: an opening travels with its wall, and
  a wall carrying openings can never get too short for them.
- **A scale frame for the whole room.** Click a room in the resize
  tool to select it: dragging a corner of the dashed frame scales the
  outline proportionally, with the same stops applied.
- **Esc and Ctrl+Z.** Esc cancels the current drag and puts the
  original geometry back; one released drag is one undo step, and
  Ctrl+Z walks back up to 30 of them while the tool is active.
- **Fix: room overlap detection missed equal-height rectangles slid
  over each other.** Found while building the resize stops; the
  slide-over case now counts as an overlap everywhere the check is
  consulted, including the draw tool.
- **Fix (HP-1543-01): editor zoom stayed on screen after a floor
  switch made inside the editor.** Exiting an editor on a different
  floor than the one you started on skipped the viewport restore and
  left the editor working zoom in view mode. Such an exit now falls
  back to the current floor's saved view zoom.
- **Fix (HP-1543-02): a motion sensor re-tripped mid-flash stayed
  invisible.** A rapid off→on before the current flash ended kept the
  old CSS animation timeline, so the second detection played nothing.
  Every witnessed trip now gets a fresh animation identity and the
  flash restarts; under reduced motion the static ring stays, as
  before.

## v1.54.3 — 2026-08-01

Patch release: three quality-of-life rounds — icon satellites now follow
the per-device size multiplier, editor zoom stopped leaking into view
mode, and motion sensors got a visual language of their own.

- **The per-device size multiplier now scales the icon's satellites
  too.** Reported by an owner with a screenshot: shrinking a device left
  the value badge, the temperature/humidity plates, the LQI label, the
  «new» dot and the alarm ring at full size, towering over the tiny
  icon. Every satellite now follows the multiplier along with the icon.
- **Editor zoom is a working tool, not a saved setting.** Zooming to
  500% to place a marker precisely and then closing the editor used to
  drop you into a 500% view mode. Leaving any editor now restores the
  viewport you had in view mode before you started editing.
- **Fix: editor zoom could still resurrect when switching floors.** The
  editor viewport raced the per-floor viewport store and won: switch
  floors while editing and the 500% was written down as that floor's
  saved view, greeting you on the next visit (steps to reproduce came
  from the owner). Editor zoom is never written to the store anymore.
- **Tripped motion and presence sensors signal with a yellow ring.** The
  rule stays «fill = on»: motion is a one-shot flash — three pulses at
  the moment of detection, with no pulsing during the cool-down tail —
  while occupancy/presence hold a static ring for as long as they report
  someone present.
- Stand only: a `services.yaml` for the demo stand's `demo_guard` to
  keep hassfest green; nothing of it ships in the integration.

## v1.54.2 — 2026-07-31

Patch release: the one remaining finding of the v1.54.1 re-audit
(HP-1541-01), pinned by regression tests on both sides of the contract.

- **Fix: a vacuum whose own `selected_map` is `0` split calibration and
  trail between two map ids.** The v1.54.1 map-id contract («the first value
  that exists wins, and zero is a value») was applied to the source entity
  but not to the card's fallback on the vacuum's `selected_map`: the
  frontend still judged it by truthiness and turned `0` into `default`,
  while the server recorder stored the run under `0`. Calibration was saved
  under a key the recorder never used, and the recorded trail never rendered
  after a reload. The fallback now follows the same not-nullish rule on both
  sides (`vacMapIdWithFallback` in the card, `resolve_map_id` on the
  server), with cross-runtime regressions for `selected_map` = `0`, `"0"`
  and `""`.

## v1.54.1 — 2026-07-31

Patch release: everything the adversarial audit of v1.54.0 found
(HP-1540-01..06), each fix pinned by a regression test that fails on the
old code.

- **Fix: the first calibration of a freshly discovered vacuum silently did
  nothing.** Until the device dialog was saved once, the robot had no config
  marker — yet the «Живая позиция» section was fully interactive, and every
  handler quietly bailed out while auto-calibration still announced success.
  Any vacuum edit now materialises the marker itself, and the success toast
  only appears after the matrix has verifiably landed in the config.
- **Fix: a robot whose first map is `map_index: 0` lost its server-side
  trail.** The backend picked the map id by truthiness and dropped the zero,
  so the recorded run was stored under a key the card never looked up. Both
  sides now share one explicit rule — the first value that exists wins, and
  zero is a value.
- **Fix: one robot on two floors recorded history for the last floor only.**
  The recorder kept a single marker per source entity, so the second
  placement silently evicted the first. Every marker fed by a source now
  gets its own copy of the run.
- **Fix: auto-calibration ignored plans drawn with rectangle rooms.** The
  room matcher only accepted polygon outlines and then blamed the room
  names. Legacy rectangles count like everywhere else in the card.
- **Fix: overlapping recorder refreshes leaked state subscriptions.** Two
  config saves racing each other could both subscribe and strand one
  callback until restart; refreshes are serialised now and teardown wins
  over any refresh still in flight.
- The «no rooms» / «no match» toasts and docs/VACUUM.md no longer send you
  to the three-point calibration that no longer exists — they point at
  «Подогнать вручную», which does.

## v1.54.0 — 2026-07-31

### Live robot vacuums

The plan now shows the robot while it works. The device marker stays where
you put it — that is the dock — and a round puck drives the plan in real
time, pouring its path out from under itself. Everything is display only:
the card never commands the robot.

- **Calibration without arithmetic.** «Настроить автоматически» matches the
  robot's room list against your rooms by name and solves the transform in
  one click. When names do not match, the fit panel lays the robot's rooms
  over the plan as a dashed ghost: drag it into place, stretch it by the
  corner handles, quarter-turn and mirror with two buttons. Mirror is on by
  default — every robot map we have measured flips Y versus the screen.
  One calibration per robot map, so two floors stay independent.
- **The path is recorded server-side.** The integration watches the robot
  itself, so the trail records with no card open, survives page reloads, and
  every screen sees the same line. The current run and one previous run are
  kept — cleaned versus not-yet-cleaned at a glance.
- **«Показывать путь робота»**: never / while cleaning (default) / always.
  Only the last mode also draws the previous run, faded.
- The trail never runs ahead of the icon: drawn segments lag one point and
  the growing tip is glued to the puck's animated centre every frame. It is
  drawn as a dark halo under a light core, so it stays readable over any
  room fill. The puck teleports instead of gliding when the view changes —
  zoom, floor switch or a return to the browser tab.
- Adapters: Xiaomi Cloud Map Extractor, dreame-vacuum (Tasshack), Valetudo.
  Verified against a live Dreame X50 Master.

### Also

- **«Свет по источникам» is the default fill for new spaces** and leads the
  options list. Existing plans are untouched: a space whose owner never
  chose a fill still renders as before.
- **Fixed: the "what to run" search showed no results.** The list is a
  scrollable box and, as a flex item, collapsed into a 1px sliver — the
  matches were there, rendered into nothing.

## v1.53.1 — 2026-07-30

- **Fix: the "what to run" search showed no results.** The results were
  there — the list is a scrollable box, and as a flex item inside the dialog
  body it collapsed into a 1px sliver, so 26 matching automations rendered
  into nothing visible. Reported within minutes of v1.53.0 by the owner. The
  list keeps its height now; the smoke measures that height instead of
  merely counting DOM rows, which is why it passed the broken build.

## v1.53.0 — 2026-07-30

**A tap can run your automation** (owner's spec)

- **New tap action: "Run automation/script/scene".** We cannot know every
  exotic device, but you know what a tap on it should do: pick any
  automation, script or scene from a searchable list, and the tap runs it —
  `automation.trigger`, `script.turn_on` or `scene.turn_on` per kind, with a
  "Started" toast. A script is the idiomatic HA "action", so all three
  runnable kinds are offered — no trigger-less dummy automations needed.
  Saving refuses a run action without a target; a target deleted later warns
  in the dialog and toasts safely on tap.
- **"Ask for confirmation" checkbox** — the accidental-tap guard, available
  for any state-changing action: toggle and run alike, wall-switch markers
  with bound targets included. The dialog is the card's own (Esc, backdrop
  or Cancel = nothing happens), so it works on a wall tablet.
- **Curtains toggle natively:** covers and valves joined the card-wide
  toggle domains — with one deliberate exception: garage doors, doors and
  gates (cover device classes garage/door/gate) stay OUT of the default
  toggle, an accidental tap must not open the driveway. An explicit
  per-device toggle remains the owner's conscious choice, and locks/alarm
  panels stay untouchable from the plan, as always.

## v1.52.2 — 2026-07-29

**From the v1.52.1 review** (no runtime changes — test and wording quality)

- The plan-editor regression check now targets THE lamp (HP-1521-01): the
  old assertion accepted any yellow badge, and the lit socket in the same
  fixture would have satisfied it with the lamp fix removed. Verified by
  mutation: reverting the v1.52.1 gate makes the smoke fail.
- The one remaining "yellow in every fill mode" wording — the checklist
  entry and the _stateClass comment — now states the actual contract: the
  lit-source state is computed by the glow-pool condition, and the yellow
  badge shows only where the glow spot is not drawn (HP-1521-02).

## v1.52.1 — 2026-07-29

**From the v1.52.0 review**

- **A lit lamp always has exactly one indicator (HP-1520-01).** The glow
  layer is hidden in the plan editor, but the yellow suppression still
  applied there — a lit lamp showed neither the spot nor the badge. The
  suppression gate now equals the layer's actual visibility: wherever the
  spot is not drawn, the yellow badge returns.
- **The static card honours a marker's size and rotation (HP-1513-01).** The
  same stored marker rendered at base size, unrotated, on the read-only
  card. It now mirrors the full card's --dev-scale and angle — geometry
  only, still a schematic.
- Documentation caught up with the v1.52.0 colour contract (HP-1520-02):
  the RGB-tint expectations in TESTING/UX-MODES and a stale inline comment.

## v1.52.0 — 2026-07-29

**One look for light sources, whatever flipped them** (owner's rule)

- **A lamp's colour lives only in its glow.** The RGB tint of the icon,
  border and shadow is gone: depending on whether the state carried colour
  data, the same lamp used to land in the "coloured icon on a dark badge" or
  the "plain yellow badge" branch — turning one lamp off by tap and the rest
  by the wall switch produced visibly different results. The branch is gone.
- **In glow fill the indicator IS the glow spot.** A light source's badge
  stays standard, lit or not — the pool of light around it says everything.
  A lit socket, fan or kettle keeps its yellow even in glow fill: they cast
  no light, the rule is for sources only.
- **In every other fill a lit source is plain yellow**, like a heating
  radiator valve — RGB and white lamps alike.
- Icon morphing (the shining-bulb outline) stays in every mode, and the
  ripple colour still falls back to the lamp's light colour.

## v1.51.3 — 2026-07-29

- **The icon size multiplier scales the glyph, not just the badge.** Changing
  a device's size grew the badge, the ripple and the value badges but left
  the icon itself at its default size — a big empty box around a small glyph
  (user report). The glyph now derives from the same per-device size as
  everything else and keeps its proportion at any multiplier and zoom.

## v1.51.2 — 2026-07-29

**From the v1.51.1 review**

- **The auto grid is the same on both cards (HP-1511-01).** The full card
  reserves grid cells for hidden devices (their ghosts keep a place in the
  device editor); the static card compacted the grid over visible ones only,
  so a freshly discovered marker with no saved position landed in different
  spots on the two cards. The static card now feeds the full roster to the
  same grid and still draws only the visible.
- **A ripple-display ghost keeps its base icon (HP-1511-02).** Hidden markers
  with the "ripple" presentation rendered as an icon-less inactive pulse —
  unrecognisable in the editor. A ghost now drops the display dressing
  entirely: base icon and name, whatever the display mode.

## v1.51.1 — 2026-07-29

**From the v1.51.0 review**

- **The static card counts hidden devices in room LQI again (HP-1510-01).**
  Its visibility filter had quietly become the aggregation filter: the same
  room showed different Zigbee health on the two cards. Aggregation and
  rendering use separate lists now — hidden devices count toward signal on
  both cards, are drawn on neither, and still cast no light.
- **A ghost shows no live numbers (HP-1510-02).** A hidden device in "Show
  hidden" suppressed the state colors but still painted its value text,
  temperature, humidity, LQI badge and state-morphed icon. All of that is
  gone: the ghost keeps only the base icon and name — enough to recognise it
  and open the dialog.

## v1.51.0 — 2026-07-29

**Hiding is an explicit flag now** (docs/FILTERING.md)

- **Every device dialog — virtual ones included — has a "Hide device from
  plan" checkbox.** The old on-the-fly filter survives only as the SEEDER of
  those flags: on first load by an editing client the config is materialised
  once — non-physical devices (bridges, scenes, service integrations, lamps
  folded into a light group) get the flag, and from then on the flag belongs
  to you. Unticking it is final: the seeder never revisits a device you have
  decided about. New non-physical devices hide silently; physical ones keep
  the red-dot flow.
- **"Show all" became "Show hidden"** — a local tool of the device editor
  (nothing flips on the wall tablets), showing hidden devices as translucent
  BLUE dashed ghosts: clearly apart from a grey unavailable icon, and with no
  live-state paint at all — a ghost is configuration, not status. Click one
  to untick the box. "Remove from plan" is gone for bound devices (the
  checkbox is the way); a virtual device's Delete still deletes.
- Hidden devices still count toward the room's Zigbee signal, but cast no
  glow and no light fill — an invisible device casts no visible light. Room
  climate is unchanged. Old configs behave exactly as before until an
  editing client materialises them.

**Yellow means working right now**

- One principle for the glowing icon: a light is shining, a socket is
  powering, a fan is spinning, media is playing, a vacuum is cleaning — or a
  radiator valve is ACTUALLY heating (hvac_action), not merely enabled for
  the winter. Previously a TRV could glow yellow because its anti-scaling
  service switch was on while the actually-heating one stayed dark: the
  primary-entity search let a vendor's config switch outrank the visible
  climate entity. Fixed — a service entity never beats the device's visible
  main function (this also fixes tap-toggle and icon morphing on such
  devices).
- The glow pool and the icon color now ask the same question: a lit light
  yellows its icon in every fill mode, by exactly the condition that lights
  its glow spot. The README (en+ru) documents the color language.

**The editors, on a phone**

- Pinch zoom and pan gestures now work in every editor: drawing is
  click-based, so the two coexist — a moving finger pans, two fingers pinch,
  releasing after a gesture never draws a point, a clean tap still does.

**The room settings button**

- Detached from the (movable) room name: it sits at the VISUAL centre of the
  room — the centre of the largest inscribed circle with a pull toward the
  area centroid, so an elongated room centres it on both axes and an L-shaped
  one keeps it in the middle of its widest part, never down a thin limb.
- Half its former size, sized from the device icon (70% of the icon box) and
  zooming WITH the plan instead of keeping a constant screen size.
- The small metric rows under the room name (temperature, humidity, signal,
  lights) now show in the plan editor too, and the name renders in exactly
  the same spot in view mode and in the editor.

## v1.50.4 — 2026-07-29

**From the v1.50.3 review**

- **Both cards build their model with the same code now (HP-1503-01).** The
  full card carried a hand-copied twin of the shared model builder, and the
  twin missed the legacy-store fallbacks v1.50.3 added — the same broken
  store rendered fine in the static card and as a blank `viewBox="0 0 0 0"`
  in the main one. The duplicate is gone: the full card calls the shared
  builder and only swaps in the raw plan url its signing flow needs. A new
  smoke runs the audit's exact legacy vector through both models and both
  DOM trees and asserts parity.

## v1.50.3 — 2026-07-29

**From the v1.50.2 review**

- **A size is not a coordinate (HP-1502-01).** The ±4 bound from v1.50.2
  treated all four view_box elements and room w/h alike, so `[0, 0, 0, 0]`
  and negative sizes still passed — and a zero axis serialises into
  `viewBox="0 0 0 0"`, a blank plan on every client, with the static card
  computing `aspect-ratio: 0 / 0` on top. Sizes now get their own validator:
  strictly positive, floored at one thousandth of the canvas; coordinates may
  still be negative, because a crop origin legitimately sits past the edge.
  And since a store may already hold a broken viewport from before, both
  cards fall back to the whole canvas instead of a blank screen, and a legacy
  rectangle with a negative size is read as the same rectangle drawn from the
  other corner.

**Also in this release**

- The room settings button moved to the bottom of the room card, and the room
  name renders in exactly the same spot in view mode and in the plan editor —
  the button and the metrics no longer take part in the label's centring.

## v1.50.2 — 2026-07-29

**From the v1.50.1 review**

- **Geometry magnitudes are bounded on both layers (HP-1501-01).** v1.50.1
  bounded layout positions, but room rectangles, polygon vertices, view_box
  and opening coordinates still took any finite float — one schema-valid 1e100
  vertex framed the space so wide the plan was a dot, for every client, and
  the server stored it as a perfectly good configuration. The config schema
  now bounds geometry to ±4 (angles to ±360°), and the content frame applies
  the same canvas envelope to room vertices it already applied to device
  positions — so a store that already holds an absurd coordinate from before
  this door existed still renders: the point draws wherever it is, it just no
  longer commands the frame. A vertex a bit past the canvas edge keeps
  working.
- **A no-op repair no longer eats the undo backup (HP-1501-02).** A typo'd
  space id "succeeded" with moved: 0 — and its empty result replaced the
  one-deep backup, destroying the only way back exactly when it was needed
  most: right after repairing the wrong space. Matching nothing is an error
  now (`nothing_to_repair`); nothing is written, the revision does not move,
  and the previous repair stays undoable.

## v1.50.1 — 2026-07-29

**From the v1.50.0 review**

- **A card below other dashboard content gets its stage back (HP-1500-02).**
  The v1.50.0 height measurement used the absolute document coordinate, so a
  tall card before this one was billed as "header" and the stage collapsed to
  zero. The card now measures only its own chrome plus a bounded allowance for
  what the dashboard keeps above it, and re-measures on window resize; the
  listener is removed on teardown.
- **The content frame can no longer be degenerate or absurd (HP-1500-03).**
  A lone marker in an empty space produced a zero-area viewBox — a blank
  scene; a single stored coordinate like 1e100 (any finite float passed
  validation) stretched the frame until the plan was a dot, for every viewer
  of the space. A near-zero axis now opens up to a floor of canvas around the
  marker, points far outside the canvas envelope no longer command the frame
  (they still render where they are), and the server refuses layout
  coordinates outside ±4 — generous slack for an icon dragged past an edge,
  not an envelope for absurdity. A real thin room keeps its tight frame, and
  the gate sensor slightly past the edge still counts.
- **A repair path for installs stranded by the v1.48 migration window
  (HP-1500-01).** If the old migration crashed between its two writes, the
  markers of a space are left in the old coordinates with nothing in the data
  able to prove it — and re-transforming a correct layout would corrupt it, so
  nothing automatic is safe. `houseplan/geometry/repair {space_id, aspect}` is
  the explicit answer: `dry_run` previews the exact moves, the previous
  positions ride the same store write as a one-deep backup, `undo` restores
  them, and routine drags no longer erase that backup. The v1.50.0
  `geom_pending` protocol already protects every future migration; this covers
  the installs it was too late for.

## v1.50.0 — 2026-07-28

**Owner's batch**

- **The default zoom counts devices as content.** They are allowed to stand
  outside every room — a gate sensor by the fence, a camera on a pole — and the
  opening view now includes them, even on a space with no rooms at all.
- **Entering an editor no longer shifts the plan.** The stage height assumed a
  fixed 118px of header, and the editor header is taller: the scene slid down
  by the difference and its bottom went below the fold. The card measures where
  the stage actually starts and gives it the rest of the viewport.
- **The zoom goes out as well as in.** Down to 0.4×, and zoomed out the plan
  floats centred instead of being pinned to a corner.

**From the v1.49.0 review**

- **The square-canvas migration survives a crash between its two writes
  (HP-1490-01).** Config and layout live in separate stores, written one after
  the other, and the first write deleted the very fields the second needed — a
  failure between them stranded markers in the old coordinates for good. The
  migration intent is durable now, saved before anything moves and cleared by
  the layout write itself; whichever half is missing after a crash, the next
  start finishes exactly that half, once.
- **Parallel uploads cannot slip past the store quota together (HP-1490-02).**
  N uploads all measured the store before any of them wrote, and all passed a
  limit only one of them fit under. The measure-and-write pair is one atomic
  step under its own lock — separate from the config lock, so a slow directory
  scan does not stall saves.
- **The editors see the whole canvas again (HP-1490-03).** The content frame
  also bounded pan, zoom and pointer maths, so after the first room there was
  nowhere left to draw the second one. Edit modes now measure from the full
  square; the view keeps its content fit, and switching modes refits instead of
  carrying a view clamped against the wrong base.
- **Save waits for the proportions of a picked plan (HP-1490-04).** Saving
  before the image had answered used to ship the PREVIOUS file's ratio, and the
  new plan kept the old shape for good. Picking a plan clears the old ratio at
  once, and Save awaits the bounded read; if it fails, "unknown" is stored —
  a square fallback is honest, an inherited ratio is not.
- Release hygiene from §5: package-lock.json caught up with the package
  version, and a duplicated comment in space-geometry.ts is gone.

## v1.49.0 — 2026-07-28

**The canvas is square** (see v1.48.0, released together with this one).

- **Zoom opens on what is drawn, not on the whole canvas.** A space without a
  background image now fits its rooms with a 5% margin, so a small plan on a big
  canvas fills the screen instead of sitting in the middle of it as a speck.
  With a background image nothing changes: the image is the plan, and cropping
  to the rooms would hide the parts nobody has outlined yet.
- **Switching spaces by swipe, or on the kiosk carousel, slides.** The plan
  leaves the way the finger went and the next one arrives from the other side.
  Respects "reduce motion".
- The room settings button says "Room settings" rather than just "Room", and
  lightens slightly under the cursor.
- "Curation" is called filtering everywhere — the interface, the documentation
  and the code.

**From the v1.47.0 review**

- **A plan you have just picked can no longer be deleted from the same dialog
  (HP-1470-02).** It was not saved yet, so the server correctly considered it
  free — and the save then stored a url with no file behind it. The button is
  disabled now, and, because two clients can do the same in either order, the
  server checks every internal plan url a configuration adds against the disk
  and refuses a new reference that is already broken. A url the stored
  configuration already carries is let through — a file can vanish from outside
  Home Assistant, and refusing then would block the very edit that detaches it.
  Urls that are not ours are left alone.
- **Uploads are bounded (HP-1470-01).** Nothing is deleted for being old — that
  cost real plans twice — so the limit sits where a decision is being made
  anyway: an upload is refused if the store would pass 256 MB or 200 plans
  (1 GB / 1000 for attachments), or if the disk would drop below 512 MB free.
  The plan list is capped at the 60 newest and its thumbnails load lazily.
- **Picking a saved plan reads its real proportions (HP-1470-03).** The card
  waited for nothing and, when the signature for the protected url had not
  arrived yet, saved a fallback ratio — a square plan came out stretched. It now
  waits for the signature, ties the result to the dialog that asked, and the
  preview in the dialog is signed like everything else.

## v1.48.0 — 2026-07-28 (the canvas is always square)
- **A space no longer has proportions of its own.** The drawing area is a square;
  a plan image keeps its own shape and is centred inside it, so a wide plan gets
  margins above and below and a tall one gets them at the sides. There is
  nothing left to choose — the canvas orientation setting for hand-drawn spaces
  is gone with it.
- **Existing plans are migrated once, on upgrade.** Nothing about a drawing
  changes: the box is padded out to a square and every coordinate is
  re-expressed against it — rooms, doors and windows, decor, marker positions
  and the saved viewport. Angles, room proportions and relative positions are
  preserved exactly. For a tall plan the scale in centimetres per grid cell is
  adjusted along with it, because the grid is tied to the width; without that a
  wall would silently measure less than it does.

## v1.47.0 — 2026-07-28 (pick a plan you already uploaded)
- **The space dialog can now show the plans stored on the server.** Detaching a
  plan keeps the image on disk — that has been the rule since v1.46.4, but until
  now the only way back was to find the original file on your computer and
  upload it again. "Already uploaded" lists what is there, with a thumbnail, the
  file size and which space uses it. One click attaches it; the aspect ratio is
  read from the image, exactly as on upload.
- **And it is where you delete one.** A plan file is never removed automatically
  — not for being detached, not for being old — which is only a sensible policy
  if you can see what is being kept and get rid of it deliberately. The trash
  button does that, and refuses while a space still uses the plan: the answer to
  "may this go" comes from the stored configuration, not from the browser.
- Documentation caught up with the code: several comments still described the
  age-based collection that v1.46.6 removed.

## v1.46.6 — 2026-07-28 (the detach promise, actually kept this time)
- **Switching a space to "draw" no longer deletes its image.** v1.46.4 and
  v1.46.5 said it did not, and the scheduled cleanup indeed left detached plans
  alone — but the save itself deleted the file the moment the reference was
  cleared, before any of those guards were reached. The cause: a file that left
  the configuration was called "superseded", and from that difference alone
  replacing a plan, detaching one and deleting its space are indistinguishable.
  Only the first is a deletion anybody asked for. The transition is now
  classified by the space that owned the file, and the same distinction applies
  to attachments: dropping one from a device that still exists removes it,
  deleting the device keeps its manuals.
- **A plan whose space was deleted is kept**, rather than the thirty days
  v1.46.5 promised — thirty days measured from the file's age is meaningless
  anyway, since it was usually uploaded months earlier.
- **Nothing is deleted for being old any more**, except a per-dialog staging
  folder. The rule that aged out "rejected uploads" turned out to race a retry:
  the cleanup removed the file from a failed save while the next attempt was
  committing a reference to it. A rule that can delete a file somebody is about
  to point at is not worth the disk it reclaims. Files therefore go when an
  action says so, and otherwise stay.

## v1.46.5 — 2026-07-28 (audit of every automatic deletion)
- **A detached plan is never deleted, at any age.** v1.46.4 gave it a month;
  this makes it permanent and writes the reason down where the next change will
  see it. The rule, now in docs/SCOPE.md: the component may delete a file only
  when a user action says so — replacing a plan, removing an attachment,
  deleting a device. "Nothing points at this any more" is not such an action.
  The errors are not symmetrical: wasted disk is visible, cheap and reversible;
  a deleted file is none of those.
- **`houseplan/files/cleanup` no longer takes a folder on the client's word.**
  After a device is rebound its files are copied to the new id and the old
  folder is dropped — with `rmtree`, on whatever id the card sent. Two ways that
  ends badly: a partial copy leaves some urls still pointing into that folder
  (the migration deliberately does not rewrite those, so they were live links to
  files being deleted), and a wrong or stale id from any client would destroy a
  live device's manuals. The server now checks the stored configuration itself,
  under the config lock, and removes only files nothing references.
- **A plan of a space that was deleted waits thirty days instead of an hour.**
  Deleting a space is deliberate, but an hour is a short window in which to
  notice it was a misclick.

## v1.46.4 — 2026-07-28 (data loss: detached plans were collected as garbage)
- **A plan you detach is no longer deleted an hour later.** Switching a space to
  "draw" clears the reference and, as the editor has always said, leaves the
  image on disk so you can put it back. The collection added in v1.46.0 did not
  make that distinction: it treated "nothing points at this right now" as
  abandoned and applied a one-hour rule. On the author's own instance the
  scheduled pass then removed two floor plans that had been detached weeks
  earlier, with no way to get them back. If you have detached a plan since
  v1.46.0 and your instance restarted or ran for a day, check
  `config/houseplan/plans/` before updating anything else — and please report it
  in the Telegram chat if a file is missing.
  The rule now: **a commit still removes exactly what it replaced**, because
  that it knows for certain. Beyond that the question is whether "unreferenced"
  means "abandoned", and the answer depends on the case. A space with no plan at
  all has had one detached and may want it back — its files are never collected.
  A space that does have a plan can only be holding rejected uploads of its own,
  so those still go after an hour. Attachments outside a per-dialog staging
  folder wait a month; a staging folder, which by construction only ever holds
  an upload from a dialog that was never saved, keeps the one-hour rule.

## v1.46.3 — 2026-07-28 (re-check of v1.46.2: HP-1462-01)
- **The cleanup at startup now actually cleans up.** It looked its own runtime
  data up by domain, and during startup Home Assistant does not yet consider
  the integration loaded — so the lookup came back empty and the pass quietly
  degraded to removing half-finished transfers, leaving the real work to a timer
  24 hours away. Restart more often than that and it never ran at all. It uses
  the object it was given at startup now.
- **The test that was supposed to prove this was passing for the wrong
  reason.** It created the stray files *before* saving the configuration — and
  saving collects too, so everything was already gone by the time the restart
  happened. Rewritten to seed after the save, plus a second test that fires the
  scheduled timer on its own, and a third that runs a restart and a save at the
  same time and asserts the accepted configuration never points at a file the
  cleanup removed.

## v1.46.2 — 2026-07-28 (re-check of v1.46.1: HP-1461-01, -02)
- **A file nobody ended up using is now cleaned up even if nothing is ever
  saved again (HP-1461-01).** Collection is tied to a configuration write,
  which is right for what a write supersedes but leaves a gap: cancel a dialog
  after the file has already uploaded, lose the connection just after, or call
  the upload API directly, and nothing references the file and no future write
  notices it. The daily sweep added in v1.46.1 only removed half-finished
  transfers, so the promise that a cancelled attachment disappears after an hour
  did not hold on an instance nobody edits. The sweep now compares against the
  stored configuration — under the same lock a write uses — and collects aged
  unreferenced attachments and plans as well.
- **A drag is no longer undone by someone else's move (HP-1461-02).** When the
  full card learned to follow position changes in v1.46.1, it protected the
  positions you had moved but not yet sent — except it read that list *after*
  flushing the pending write, and flushing empties it first. In a real drag,
  where a write is already scheduled, the list was therefore empty and the
  server's older position was painted over your move. The card now takes the
  snapshot before flushing and also holds on to positions that are sent but not
  yet acknowledged: until the server confirms a position, the card that moved it
  is the authority on it.
- Two tests grew up to their docstrings: the upload test now actually cancels
  the request task instead of only exercising error paths, and the position-sync
  smoke schedules a real debounced write and delays it, which is the ordering
  that lost the drag.

## v1.46.1 — 2026-07-28 (re-check of v1.46.0: HP-1460-01 … -03)
- **Two uploads of the same file name can no longer collide (HP-1460-01).**
  v1.46.0 stopped overwriting attachments, but choosing a free name and taking
  it were two steps: two uploads racing between them agreed on the same name,
  both reported success, and one set of bytes replaced the other. The name is
  now claimed atomically as it is chosen — twenty simultaneous uploads of
  `manual.pdf` produce twenty files. The same helper is used when rebinding
  moves files, which had the same gap.
  Also fixed there: a name at the length limit lost its extension, and the
  collision suffix pushed it past the limit, so the attachment was stored under
  a name the server would not serve back — a permanent 404 on a file the UI
  reported as attached.
- **An interrupted upload no longer leaves a temporary file forever
  (HP-1460-02).** Cleanup ran in an `except Exception`, which a cancelled
  request walks straight past, and the collector only ever looks inside marker
  folders — so an aborted transfer left a `.upload-*` in place with nothing able
  to remove it. Every exit path now cleans up, a request carrying two files is
  refused outright, and abandoned temporaries are swept at startup and daily.
  Uploads also write in 1 MB batches instead of one disk task per 64 KB.
- **Two full cards side by side keep the same positions (HP-1460-03).** v1.46.0
  taught the static card to follow position changes and left the full one
  behind, so dragging an icon in one window did not move it in another until a
  reload. It follows now, without disturbing a drag of its own: a revision
  arriving mid-drag is merged rather than applied over the top, and a card does
  not re-read what it just wrote itself.

## v1.46.0 — 2026-07-28 (full external audit of v1.45.4: HP-1454-01 … -10)

**Security**

- **An uploaded SVG plan is no longer a live document of your Home Assistant
  origin (HP-1454-01, high — release blocker).** Inside the card a plan is
  referenced by `<image>`, where scripts never run; but the same url opened
  directly became a top-level document of HA's own origin, and a `<script>` in
  it could read the session's `localStorage` and call the API. Uploading needs
  write access, which by default every authenticated user has, and a signed url
  is easy to hand to an administrator. Plan responses for SVG now carry a
  `sandbox` Content-Security-Policy, which drops the document into an opaque
  origin. Only SVG gets it — a CSP on a PDF can break the browser's built-in
  viewer, and a raster image cannot execute anything. Nothing changes for
  existing plans: the card renders them exactly as before.

**Data integrity**

- **A manual attached to a device no longer overwrites the previous one
  (HP-1454-02).** The upload wrote straight to `<marker>/<filename>`, outside
  the configuration transaction: cancelling the dialog, or a rejected save, left
  the stored url serving the new bytes. And every new icon uploaded into one
  shared folder, so two of them attaching `manual.pdf` ended up pointing at the
  same physical file. Uploads now take a free name and never overwrite, a new
  icon gets its own staging folder whose files move to the real icon when the
  save is accepted, and an upload nobody saved is collected an hour later. The
  name a collision falls back to changed from `manual (2).pdf` to `manual-2.pdf`
  — the old one was sanitised on the way back in, so a renamed attachment was
  written and then never served (found by the new test, and it applied to
  rebind collisions before this release too).
- **Two quick edits can no longer lose the second one (HP-1454-03).** The
  debounce spaced out the starts of a save, not the saves themselves. If one
  took longer than half a second — a busy instance, a slow link — the next edit
  went out with the same revision, the server accepted the first and rejected
  the second, and the conflict handler reloaded the server copy over the local
  one. The edit was gone, with a message blaming another window when there was
  none. Writes are now serialized: one at a time, each carrying the revision the
  previous one returned.

**Correctness and limits**

- **Open boundaries follow the geometry again (HP-1454-04).** Their cache was
  keyed on room ids and links only, so changing a space's aspect ratio or
  dragging a vertex left the open boundaries — and the light spilling through
  them — at their old coordinates until a reload. The cache is now keyed on the
  rendered model itself, which is exactly what it is computed from.
- **The configuration can no longer be made arbitrarily heavy (HP-1454-05).**
  The outer collections were capped; the ones inside them were not. A polygon
  with 150 000 points, or a list of 100 000 device ids, validated fine and then
  made every render walk it. There are now limits on polygon vertices, open-to
  links, controls, attachments, text and url lengths, plus a cap on the whole
  serialized configuration. The obsolete `segments` field is dropped by the
  server instead of trusting the card to strip it.
- **Large files stream instead of being held in memory (HP-1454-06).** A 50 MB
  manual was read whole into memory on the way in and again on the way out; a
  couple of parallel downloads were real pressure on a small Home Assistant
  host. Uploads stream to a temporary file, downloads stream from disk.

**Consistency**

- **The static space card honours per-room fill settings (HP-1454-07).** It
  builds its model with a different function, and room settings were not carried
  into it, so a room you had set to "no fill" was still painted.
- **Moving an icon updates the static card immediately (HP-1454-08).** Layout is
  separate state with no revision and no event: a drag on the full card left a
  static card next to it showing the old position until the configuration
  changed or the page was reloaded. Layout writes now keep a revision, return
  it, and announce themselves — which also makes the optimistic locking on a
  wholesale layout write mean something, since a point-wise write used to reset
  the counter.
- **A repair warning about a missing plan disappears with its space
  (HP-1454-09).** The cleanup only looked at spaces that still exist, so
  deleting or renaming one left its warning in Repairs with nothing able to
  clear it.
- Build chain: `serialize-javascript` pinned past two advisories (HP-1454-10).
  Not reachable at runtime and production dependencies were already clean, but
  it is one line.

## v1.45.4 — 2026-07-28 (review of v1.45.3: R5-1, R5-2)
- **A partly successful signing answer no longer skips the backoff (R5-1).**
  The backend signs each path independently: one it cannot sign is logged,
  skipped, and the call still succeeds with the remaining urls. The card took
  any successful call as "the whole batch is done", cleared the backoff for
  every path in it, and then wrote only the urls that came back — so a path the
  backend kept skipping was requested again on every single render, which is
  exactly the amplification v1.45.2 added the backoff to prevent. A path is now
  counted as signed only if the answer actually carries a url for it; the rest
  back off individually, keys nobody asked for are ignored, and a re-render is
  only triggered when at least one new signature arrived.
- **The status snapshot no longer contradicts the repository (R5-2).** It still
  described `main` as carrying releases up to v1.40.1 and quoted test counts
  from several releases back, while the version line right beside them was kept
  current — a maintainer or an agent reading it for handoff got a wrong branch
  model and a smaller picture of the coverage than exists. The branch roles are
  described accurately, and the counts are gone: `npm run inventory` prints them
  from the tree, so there is nothing left to go stale.

## v1.45.3 — 2026-07-27
- **"Value instead of an icon" could not be saved (issue #3).** The option was
  added to the device editor in v1.26.0, but the server-side schema only ever
  accepted `badge`, `ripple` and `icon_ripple`. Choosing it produced
  `not a valid value for dictionary value @ data['config']['markers'][n]['display']`
  — and because a single rejected marker fails the whole configuration write,
  the plan could not be saved at all until the setting was undone. Thanks to
  @RemyRoux for the report and the exact error text.
- **The option lists now live in one place and are checked across languages.**
  `DISPLAY_MODES`, `TAP_ACTIONS`, `SPACE_FILL_MODES` and `ROOM_FILL_MODES` are
  exported from the card and read by a backend test that asserts the schema
  accepts every value a user can actually pick. Adding an option to an editor
  and forgetting the schema now fails the test suite instead of surfacing
  through somebody's error message.

## v1.45.2 — 2026-07-27 (hardening from the v1.45.1 review: R4-1, R4-2)
- **A failed cleanup no longer reports an accepted save as an error (R4-1).**
  Collecting superseded plan files runs after the configuration is already
  stored, but an error while listing the directory — it can vanish or turn
  unreadable between the check and the walk — propagated out of `config/set`.
  The client then saw a failure for a revision the server had committed, and its
  retry came back as a conflict. The collector now reports "nothing collected"
  instead of raising, and `config/set` logs and proceeds: the event fires and
  the new revision is returned.
- **One signing request per url instead of one per render (R4-2).** The pending
  set was cleared when the batch went out rather than when it came back, so
  while a `content/sign` call was in flight every re-render queued another one —
  six calls where one was needed, and far worse on a socket that is slow rather
  than merely busy. Queued and in-flight are now separate states, a failure
  backs off (2 s doubling to 60 s) instead of retrying on the next frame, and a
  request that never settles stops blocking retries after 15 s. A late answer
  arriving after the card was torn down no longer triggers a render.
- Tests: eight unit tests for the signer with hand-settled promises (four fail
  on v1.45.1), a backend test asserting a broken collector still yields a
  successful save with a usable revision, and the pure-collector test extended
  to a disappearing directory.

## v1.45.1 — 2026-07-27 (follow-up review of v1.45.0: R3-1, R3-2)
- **Collecting old plan files moved into the config transaction (R3-1, high).**
  v1.45.0 made the upload safe but handed the deletion to the client: after a
  successful save the card asked the backend to remove everything except the
  file it had just committed. Two open editors could not be ordered — a delayed
  request from one client deleted the plan the other had just saved, and the
  accepted configuration was left pointing at nothing, which is the exact damage
  copy-on-write was added to prevent. The `houseplan/plan/cleanup` command is
  gone. `config/set` now collects inside its own write lock, comparing the
  configuration it replaced with the one it accepted: a file the old revision
  referenced and the new one does not is removed, and any other unreferenced
  upload is left alone until it is an hour old, because a fresh one may belong
  to a transaction that has not committed yet.
- **The static space card shows its plan background again (R3-2).** It signed
  the url and then threw the result away — `getCardSize()` mutated a throwaway
  model while `render()` rebuilt its own from the config — so the `<image>` kept
  requesting the protected path and got a 401 on every render. Both cards now
  share one signer, which also gives the static card the batching, the
  expiry handling and the periodic re-signing the main card already had. Its
  pending set is released in `finally`, so a single failed request no longer
  wedges a url for the life of the page.
- New tests: five backend cases for the two-client interleavings from the report
  (late commit, uncommitted upload, aged orphan, foreign files, rejected save),
  the collector extracted to a pure module and unit-tested, and
  `smoke_space_card_bg` for the signed background — it fails on v1.45.0 with the
  raw url in the DOM.

## v1.45.0 — 2026-07-27 (external review of v1.44.8: R2-1, R2-2, R2-3)
- **A rejected save can no longer damage a working plan (R2-1, high).** The
  plan file was written to its final name — deleting the previous extension on
  the way — *before* the revision-checked config write. If that write was then
  rejected (revision conflict, validation, lost connection), the live plan had
  already been replaced, or the stored config was left pointing at a file that
  no longer existed. Uploads now go to a versioned name
  (`<space>.<token>.<ext>`) and nothing is deleted; the card asks the backend to
  drop the superseded files only after the config write is accepted. A crash in
  between leaves one orphan, which the next successful upload collects.
- **Signed urls no longer expire for good on long-lived screens (R2-2).** The
  backend signs at most 200 paths per request and silently ignores the rest,
  while the card sent its whole cache in one call and treated any cached entry
  as valid forever. Past 200 attachments the later ones stopped being refreshed
  and, 24 hours in, quietly broke. Requests are now batched to the shared limit,
  entries carry their age (aging urls keep working while a replacement is
  fetched, expired ones are never served), and the cache is pruned to the urls
  the current config still references.
- **Room climate is computed once per update instead of once per room (R2-3).**
  Each room asked for temperature and humidity separately, and every ask
  rescanned the entire entity registry: with 60 rooms and 2000 entities that is
  ~120 traversals per render, enough to spend a whole frame on metadata that had
  not changed. One pass now builds a map for all areas, keyed on the Home
  Assistant snapshot, so fresh states are always observed while unrelated
  re-renders cost nothing. Measured in the smoke: 133 registry scans per update
  before, 2 after — and no longer growing with the number of rooms.
- `smoke_ux_fixes` wrote its screenshot to a hard-coded `/tmp` path and could
  not run on Windows; it uses the OS temp directory now.
- New tests: `smoke_plan_upload_reject` (cleanup happens only after an accepted
  save), `smoke_sign_cap` (201 urls, batching, pruning, expiry),
  `smoke_climate_once` (scan count does not grow with rooms), plus backend
  coverage for the versioned plan names and unit tests for the new helpers.

## v1.44.8 — 2026-07-27
- **An uploaded plan is actually attached to the space.** `_saveSpaceDialog`
  held a reference to the space object across the `await` that uploads the
  image. Every `houseplan_config_updated` event runs `_reloadConfigOnly()`,
  which *replaces* `_serverCfg` — so the reference became an orphan and
  `plan_url`, `aspect`, the title and all display settings were written into a
  detached object while the save shipped the untouched config. The file landed
  on disk, the plan never appeared, and re-saving could not help. Creating a
  space in that window lost the space entirely.
  The upload now happens *before* the config is touched, and nothing is held
  across an await.
- **`_saveConfigNow` marks the write in flight** (`_cfgWriting`), like the
  debounced writer already did, so a remote revision arriving mid-save defers
  its reload instead of replacing the config underneath it (audit L2 extended
  to this path).
- Regression test `demo/smoke_plan_upload_race.mjs` fails on v1.44.7 and passes
  here.

## v1.44.7 — 2026-07-27
- **Plan backgrounds are visible again (regression from v1.44.5).** Since the
  content endpoint requires authentication, the card asks the backend to sign
  the plan's url — but the signing happened inside the *memoized* space model,
  which is cached on the config fingerprint. The unsigned url froze in that
  cache, so the signature never reached the `<image>` element and the plan never
  loaded. The url is now resolved at render time, outside the cache. (PDF links
  were unaffected — they already resolved at render time.)
- **No more "failed login attempt" from your own IP.** While the plan was
  broken the browser kept requesting the unsigned path, which returns 401 and
  makes Home Assistant raise a login-attempt warning for the viewer's own
  address. The card now renders nothing until the signature is in hand, so an
  unsigned request is never made.
- **Long-lived screens no longer blink.** The 12-hour re-signing used to drop
  every signature and wait for new ones; it now keeps the current urls until the
  replacements arrive, so a wall tablet never shows an empty plan.
- Regression test `demo/smoke_plan_signed.mjs` fails on v1.44.6 and passes here.

## v1.44.6 — 2026-07-27
- **Only room *air* counts as room climate.** After v1.44.5 started reading the
  area registry instead of the visible icons, every hidden temperature entity in
  the area became a candidate — including ones that measure something other than
  the air. Three guards now run before averaging: entities marked
  diagnostic/config are skipped, entities from curated-out integrations are
  skipped, and entity ids naming a non-air medium are skipped
  (`water`, `coolant`, `flow_temp`, `return_temp`, `target`, `setpoint`, `chip`,
  `cpu`, `processor`, `board`, `device_temp`, `batter`, `freezer`, `fridge`,
  `oven`, `kettle`, `boiler`).
  On a live 60-area install this removed four real false positives: a NAS
  processor temperature, the water in a smart kettle, a 90 °C sauna heater and a
  virtual `better_thermostat` duplicating the real sensor.
- **New icon rules:** kettles/thermopots get `mdi:kettle`, saunas
  (`sauna`, `harvia`, `парная`) get `mdi:hot-tub` — previously both fell through
  to the generic thermometer rule, which is also what made them count as room
  climate.

## v1.44.5 — 2026-07-27
- **Room climate now counts every sensor in the area**, including devices that
  are not placed on the plan (hidden by curation or by you). Previously the
  average was taken over the visible icons only, so hiding a thermometer
  silently removed it from the room card, the tooltip and the temperature fill.
  Curation still applies (fridges, TRVs and chip-temperature plugs stay out),
  and an explicit per-room source still wins.
- The room tooltip no longer says "open the area" — clicking a room stopped
  navigating in v1.40.1; the link icon on the room card does that.


## v1.44.4 — 2026-07-27 (audit follow-up: B2, B5, L4)
- **One authorization policy (B2).** The HTTP upload view still failed **open**
  when the config entry was unavailable while the WebSocket path failed closed —
  the two had drifted apart. Both now call the same `may_write` helper, which
  denies non-admins whenever the policy cannot be read.
- **NaN/Infinity refused on every coordinate (B5).** The finite-number check
  guarded only layout positions; room rects, polygon vertices, `view_box` and
  opening coordinates accepted `"NaN"`, which serializes to `null` and corrupts
  the stored geometry permanently. The `MAX_OPENINGS` cap was defined but never
  wired in — the openings list was unbounded.
- **Drag hardening (L4 sub-item).** The tolerant `setPointerCapture` wrapper is
  now used by every drag pipeline (device, label, resize), not just openings —
  an inactive pointer id could kill a drag outright. Decor shapes gained a
  bounds clamp: they can no longer be dragged far outside the plan and saved
  there.

## v1.44.3 — 2026-07-27 (fix: plans and manuals load again)
- **The authenticated content endpoint had no working browser path.** v1.43.0
  closed the security hole correctly, but Home Assistant authenticates HTTP
  requests by a Bearer header or an `authSig` signed path — and an SVG
  `<image href>` or a plain `<a href>` sends neither. Plan backgrounds and PDF
  links returned **401** on a real dashboard (reproduced live before the fix).
  The card now asks the backend to sign what it displays
  (`houseplan/content/sign`, 24 h, bound to the session's refresh token, only
  for our own endpoint), re-renders when signatures arrive, and refreshes them
  every 12 hours so wall tablets keep working. A backend test fetches a signed
  url **without** an Authorization header and asserts 200, and 401 without the
  signature.


> 🇷🇺 Русская версия: [CHANGELOG.ru.md](CHANGELOG.ru.md) (записи с v1.42.0).

## v1.44.2 — 2026-07-27 (external code review: CR-1…CR-3)

A second, adversarial review (of v1.44.0) produced three findings; all are
addressed.

- **The lock invariant is now precise and enforced (CR-1).** The reviewer was
  right that "locks can never be actuated from the plan" was too absolute a
  claim: the door card's Unlock button does call the service. That button is a
  deliberate product decision, so the invariant is restated where it belongs
  ("never by an accidental tap; exactly one labeled surface"), unlocking now
  **asks for confirmation**, and a new smoke exercises all five actuation paths
  to prove icons, `controls[]` and the device card still refuse locks outright.
- **Attachment migration became transactional (CR-2).** Rebinding a marker used
  to MOVE its files before the revision-checked config save — if that save was
  rejected, the stored config kept the old urls while the files had already
  left. Now the server **copies**, the config is committed, and only then the
  old folder is removed (`houseplan/files/cleanup`).
- **Failed or partial migrations no longer rewrite urls (CR-3).** The copy
  reports an exact `{source: written}` mapping; only confirmed copies are
  rewritten, name collisions get a unique name instead of silently linking a
  pre-existing file, and a failed migration surfaces as a toast with the links
  left pointing at the still-existing originals.

## v1.44.1 — 2026-07-27
- Added the community chat everywhere users look: **https://t.me/ha_houseplan**
  (badge and header line in both READMEs, a "Getting help" section, the issue
  template contact links, CONTRIBUTING, STATUS and SCOPE).

## v1.44.0 — 2026-07-27 (user feedback: control first)

- **The device card is now a control surface.** It opens with the device's
  controllable entities: lights, switches and fans toggle straight from the
  card with finger-sized buttons, covers/locks/climate open Home Assistant's
  own more-info. Model, links and PDF manuals moved below — on a wall tablet
  this card is for running the home, not for reading documentation (field
  report). Config and diagnostic entities are not listed; locks still never
  toggle from a card tap.
- **"This device is a light source"** — a new per-device flag. A smart switch
  driving ordinary (dumb) fixtures now casts a glow in the "Light sources"
  fill without inventing a light-group helper: the glow follows the switch, or
  the lights bound under "Controls light sources" when they are set.

## v1.43.3 — 2026-07-27 (user feedback: discoverability and touch)

- **Room settings were unfindable.** The gear added in v1.42.0 lived inside the
  room label at 0.9em of its font and 60% opacity — a few pale pixels on a
  normal plan. It is now a pill button "⚙ Room" of a fixed, readable size that
  does not shrink with the card font, and it appears on **unnamed rooms too**
  (that is where you name them). This also unblocks the font-size sliders,
  which nobody could reach.
- **Metrics line enlarged** from 0.62 to 0.75 of the room name — the reporter
  could scale the name but the sensor line stayed unreadable on a tablet. The
  per-room and per-space multipliers still apply on top.
- **Touch tooltips, take two.** The `(hover: none)` guard was not enough: some
  devices, skins, styluses and paired mice report `hover: hover`, so tips still
  stuck under the finger. The card now also latches on the first touch/pen
  pointer event and drops any open tooltip on touch.

## v1.43.2 — 2026-07-27 (external audit: the test layer)

- **The smoke suite can finally fail (T1).** All 48 headless-browser smokes used
  to print booleans and exit 0 — a regression was visible in their own output
  and still reported success. `demo/serve.mjs` now exports `check`/`checkAll`/
  `finish`: every fact is asserted by name, mismatches and uncaught exceptions
  inside the card set a non-zero exit code. Verified by deliberately breaking
  the kiosk editor guard: the matching smoke went red.
- **The suite runs in CI (T2)** as a `smoke` job gated on `frontend`, against a
  freshly built bundle (the committed `demo/srv/assets` copy is a snapshot and
  would have tested stale code), uploading per-file logs on failure.
- **`docs/TESTING.md` reconciled (T3).** `[auto]` now means "a named check
  exists that fails when this breaks", and each such line names it; 72 lines
  whose automation was aspirational are honestly marked `[manual]`. Two
  long-standing contradictions fixed: the "ZERO edit buttons in View" line
  (wrong since v1.30.1) and the opening-click line (true again since v1.43.1).
- Three smokes carried expectations that predate v1.39.0/v1.25 and quietly
  described old behaviour; they now test the current contract.

## v1.43.1 — 2026-07-27 (external audit: P1 fixes)

- **Render cost (L1).** Home Assistant replaces `hass` on every state change in
  the home, and each of those renders recomputed the whole plan geometry —
  `_openPairs()` ran once per room (O(rooms³) collinear-overlap math) and the
  space model was rebuilt twice. Both are now memoized on the config's
  structural fingerprint and hoisted out of the per-room loop; cache
  invalidation happens synchronously at mutation time, not inside the debounce.
- **Opening tap vs drag (L4).** Dragging a door/window had no movement
  threshold, so any pointer jitter counted as a drag: the properties dialog
  never opened and an unchanged config was written (which then fed the L2 race).
  Now the same 3 px threshold as every other drag pipeline, and the write only
  happens when the geometry actually changed.
- **Concave rooms (G2).** Containment used the arithmetic mean of the vertices
  as an "interior point" — which lies OUTSIDE U- and L-shaped rooms, so island
  rooms in them were rejected as overlaps and their holes never rendered. A
  real interior point is computed instead (`interiorPoint`).
- **Wall dedup (G3).** `segKey` ordered endpoints by raw floats but printed
  rounded ones, so one shared wall could produce two keys and be drawn twice.
  Rounds first, then orders.
- **Backend hardening (B2–B5).** The write-authorization check now fails
  **closed** when the config entry is unavailable (it used to allow writes
  during a reload); `layout/set` supports `expected_rev` and conflicts like the
  config store; a `config/set` without `expected_rev` over a non-empty store
  logs a warning; coordinates reject NaN/Infinity, and spaces/rooms/markers/
  decor/layout have generous size caps.

## v1.43.0 — 2026-07-27 (external audit: P0 fixes)

An external code audit of v1.41.1 found four critical issues. All four are fixed
and covered by regression tests.

- **Silent data loss on save (L2).** A debounced config write read the config at
  fire time, so a `houseplan_config_updated` event arriving in between replaced
  it and the user's edit vanished with no error — reproducible in a single tab.
  The debounce now supports `flush()`/`pending()`, a reload flushes the pending
  write first and defers while a write is in flight, and a failed reload finally
  reports instead of staying silent.
- **Split corrupted room geometry (G1).** A cut starting and ending on the SAME
  wall (carving a niche — a natural action) produced two overlapping,
  self-intersecting rooms whose areas summed to twice the original, and the
  overlap guard did not catch it. Same-edge cuts now carve the niche correctly,
  and a partition invariant (parts must sum to the original) rejects anything
  else.
- **Plans and uploaded files were served without authentication (B1).** Anyone
  who could reach the HA endpoint could fetch floor plans and attached manuals
  without logging in. They are now served by an authenticated view; stored
  legacy URLs are rewritten on read, so nothing breaks. **The old public paths
  disappear after a Home Assistant restart.**
- **Dialogs could resurrect and blank the card (L3).** Closing a dialog while
  its save was in flight, on a failed save, spread `null` into a truthy husk;
  the renderer then threw and the card went blank until reload. Guarded in all
  four save routines; the error toast still fires.

## v1.42.2 — 2026-07-26
- Touch devices no longer pop hover tooltips on every tap (field feedback:
  "extra labels appear and get in the way on a tablet"). Hover tooltips are
  desktop-only now; on touch the same data lives in room cards and the
  long-press device card.

## v1.42.1 — 2026-07-26 (room-card font sizes)
- Closing the "can't change the font size" feedback: **three sliders**.
  Space settings gained a base room-card font size for the whole space;
  Room settings gained independent sizes for the room NAME and the METRICS
  line (50–300% each). Effects multiply — and stack with the card's corner
  resize and the kiosk per-screen multiplier as before.
- Both dialogs show a **live sample card** that follows the sliders as you
  drag them.

## v1.42.0 — 2026-07-26 (room settings — the third tier)
- **Settings now have four tiers**: global → space → room → device; the more
  specific tier overrides the more general one (owner's principle, fixed in
  ARCHITECTURE). This release adds the ROOM tier.
- Every room card in the Plan editor gained a **gear**: rename the room,
  change its HA area, override the **fill type** for this room only (works
  in glow spaces too — 'none' pulls the room out of the darkness), and pick
  an explicit **temperature / humidity source** — any HA device or entity —
  instead of the default room average. The source feeds the room card, the
  tooltip and the temperature fill, and works for rooms without an HA area
  (the user-feedback case: a custom template sensor bound to a room).
- The same settings section appears in the room dialog right after closing a
  contour.

## v1.41.2 — 2026-07-26
- Fixed attached PDF manuals breaking after a marker is rebound to another
  device: the id changes, but the uploaded files stayed in the OLD id's
  folder — orphaned and eventually lost (that is exactly how the sauna
  heater's manuals died). Rebinding now moves the files server-side
  (`houseplan/files/migrate`) and rewrites the attached urls.

## v1.41.1 — 2026-07-24 (docs)
- README (en/ru) reworked for discoverability: keyword-rich hero ("interactive
  floor plan card for Home Assistant"), badges, a feature-highlights list
  covering glow, controls, kiosk, virtual walls and room cards; the kiosk
  recipe moved next to Installation. Demo GIF slot ready for the new capture.

## v1.41.0 — 2026-07-24 (kiosk mode for wall devices)
- New card option **`kiosk: true`** (also in the GUI editor): the full View
  experience — live states, glow, lamp taps, info cards, locks — with no
  header and no editors at all, sized for a wall tablet or TV.
- **Swipe** left/right switches spaces at 1:1 zoom (wrap-around, dots
  indicator); while zoomed the gesture pans as usual; **double tap** resets
  zoom. **`cycle: N`** auto-advances spaces every N seconds (pauses for a
  minute after any touch) — for TVs and against OLED burn-in.
- **Per-screen sizes**: long-press an empty spot (3 s) to open a popover with
  icon and room-card-font multipliers, stored in this device's localStorage —
  every tablet/TV tunes itself once.
- Recipe for a full-screen wall dashboard (panel view + kiosk-mode/companion
  settings) added to the README.

## v1.40.2 — 2026-07-24
- Default icon rules: smart speakers (Yandex/Alice stations, «колонка»,
  generic speakers) now get **mdi:speaker**; mdi:soundbar stays for actual
  soundbars. Applies where the icon rules haven't been customized.

## v1.40.1 — 2026-07-23
- Rooms are no longer clickable in View (default cursor, empty space does
  nothing). Instead the room card shows a small **open-in-new icon** after
  the name — clicking it opens the HA area. Rooms without an area (and all
  editors) have no icon.

## v1.40.0 — 2026-07-23 (smart guides)
- **Alignment helper in every editor**: while drawing an outline, a cut or a
  decor shape, and while dragging icons, room cards or decor, thin dashed
  guides appear from the nearest object sharing your X and/or Y (one per
  axis, with a marker dot at the source) — lamps line up, lines end exactly
  above the end of a parallel line. Candidates follow the context: room
  vertices and path points in the Plan editor, other icons in the Device
  editor, decor endpoints/corners plus room vertices in the Background
  editor, other room cards while dragging one.
- The cursor badge now shows **length · angle** and turns green when the
  segment's angle is a multiple of 45°. Guides are pure indication — the
  grid keeps owning the actual position.

## v1.39.0 — 2026-07-23 (lights toggle by default)
- Pure light sources — devices whose primary entity is a `light` (bulbs,
  chandeliers, night lights, light groups) — now **toggle on click by
  default**, right from auto-placement, no per-device setting needed.
  Devices where light is a side function (a kettle's backlight: its primary
  is a sensor) keep the Device-card default. An explicit per-device choice
  always wins. The device dialog shows the effective default.

## v1.38.4 — 2026-07-23
- Plan editor: the DERIVED wall segments (the markup layer's solid lines)
  are now trimmed under open boundaries as well — v1.38.3 only trimmed the
  room outlines, so the virtual wall still looked solid in the editor.
  (`cutSegments` extracted as the shared workhorse; outlineWithout reuses it.)

## v1.38.3 — 2026-07-23
- The Plan editor now shows open boundaries as a true dash as well: the blue
  markup outlines are trimmed under the open stretches (rooms picked for
  merge/split keep their full amber highlight).

## v1.38.2 — 2026-07-23
- The card now **remembers where you were**: the selected space and the active
  editor survive navigation and closing the tab (localStorage; edit modes are
  restored for admins only). A `#space=` deep link still wins over the saved
  space. This reverses the earlier "always start in View" rule — the owner's
  call.

## v1.38.1 — 2026-07-23 (tap action cleanup, right-click more-info)
- The per-device action is now one of three: **Device card** (renamed from
  "Info card", the default), HA more-info, Toggle. The confusing "As the card
  default" option is gone — along with the card editor's global tap setting
  (it is ignored if present in old configs). Explicit per-device choices are
  untouched. RU wording: «по нажатию» instead of «по тапу».
- **Right click** on a device icon in View mode always opens HA's more-info
  dialog (editors keep the native browser menu; a virtual marker without an
  entity opens its device card).

## v1.38.0 — 2026-07-23 (binding section redesign)
- The device dialog's binding section is compact now: two radio buttons —
  **Virtual device** and **Pick from the HA list** — with a **Show entities**
  checkbox (adds every entity of the devices to the list; groups and helpers
  are always listed). The searchable dropdown appears only in HA mode and
  collapses once you pick. Save is disabled until a binding is chosen.
  The binding logic itself is unchanged.

## v1.37.3 — 2026-07-23
- Open boundaries now render as a **true dash**: the rooms' solid outlines are
  trimmed under the open stretch (outlineWithout) instead of dashes being
  painted over a solid line, and the dashed layer moved **above the glow
  pools** so light never covers it.

## v1.37.2 — 2026-07-23
- Glow falloff tuned: full brightness for the inner 70% of the radius,
  gradient on the outer 30% (was 80/20).

## v1.37.1 — 2026-07-23
- Open-boundary tool polish: the cursor stays default and only turns into a
  pointer near a wall shared by two rooms; hovering previews the exact
  stretch that would become open (amber dashed) — or red solid when the
  boundary is already open and the click would close it.

## v1.37.0 — 2026-07-23 (open boundaries — virtual walls)
- Rooms divided only by zoning can now share an **open boundary**: the new
  "Open boundary" tool in the Plan editor toggles it with a click on the wall
  two rooms share. The stretch renders dashed; while the tool is active open
  boundaries highlight amber. Stored as `room.open_to` links by room id, so
  redrawing/merging neighbours doesn't break them.
- In the light-sources fill, light flows through open boundaries freely —
  transitively across the whole connected zone (kitchen ↔ living ↔ hall as
  one open space), still limited by the glow radius. Door sectors now work
  from any outer wall of the zone.

## v1.36.4 — 2026-07-23
- Glow: sharper light edge — the pool is fully lit for the inner 80% of the
  radius, the gradient falloff lives only in the outer 20%.

## v1.36.3 — 2026-07-23
- Glow: fixed dark wedges appearing INSIDE a lit room near some doorways.
  The room outline and the door sectors were subpaths of a single clip path;
  with opposite winding directions the nonzero fill rule cancelled their
  overlap. Each contour is now its own clipPath child (children always
  union), so sectors only ever ADD light.

## v1.36.2 — 2026-07-23
- **Glow radius is now per source**: every device dialog gained a "Glow
  radius" field (in your HA units; empty = the global default from general
  settings, shown as the placeholder). A kettle's night light can glow half
  a meter while the ceiling lamp floods the room. Door sectors use the same
  per-source radius.

## v1.36.1 — 2026-07-23
- Fixed tap-toggle "doing nothing" on lamps whose individual `light.*` entity
  is **hidden in the registry** (the usual setup when lamps are folded into a
  light group): the primary entity fell through to a visible config switch
  (do-not-disturb) or an identify button, and the click toggled THAT.
  Primary selection now works in tiers — domain priority beats hiddenness,
  so a hidden light still wins over a visible config switch, while visible
  entities of the same domain keep winning over hidden ones.

## v1.36.0 — 2026-07-23 (wall switches that really switch)
- Markers gained **"Controls light sources"**: bind any set of `light.*` /
  `switch.*` entities to an icon. With tap action **Toggle**, a click flips
  them all with HA-group semantics — any on → all off, all off → all on — in
  one service call. Covers stateless remotes, one-switch-many-lights and
  dumb wall switches (place a virtual marker; no HA entity needed).
- The icon mirrors its targets: on when any target is on, tinted by the first
  lit RGB light. The info card lists every target with its state. Controls
  fire only on the explicit per-marker Toggle (owner's decision); locks and
  other domains can never be group-controlled.

## v1.35.0 — 2026-07-23 (glow fill: dark house, glowing lamps)
- New fill mode **"Light sources"**: the whole house is painted with a single
  configurable darkness color, and every lit lamp casts a radial pool of light
  around itself. The pool color comes from the lamp's `rgb_color`, else its
  color temperature (blackbody conversion), else a configurable default;
  brightness scales the intensity.
- Pools are clipped by the source's room — **plus the sector through each
  doorway** (rays from the source to the door edges, out to the glow radius),
  so light spills into neighbouring rooms through doors. Entrance doors (no
  room behind) spill nothing; windows don't spill. No shadow casting: islands
  and furniture do not block light (deliberate limitation).
- The glow radius is configured in General settings in your HA unit system
  (meters or feet; stored in cm, default 3 m). The palette gained a "glow"
  group: house darkness + default light color/intensity.

## v1.34.0 — 2026-07-22 (island rooms)
- **Nested rooms are now legal**: draw a contour fully inside an existing room
  (or around one) — a column in a ring-shaped room, an inner room, a wardrobe
  island. The parent room's fill is rendered with an evenodd hole, so a ring
  paints as a ring; the island itself stays clickable and can carry its own
  area, fill and devices. Partial overlaps and duplicate outlines are still
  rejected (`roomsOverlap` reworked; `polyContainsPoly`/`islandsOf` helpers,
  unit-tested). The per-click "point inside a room" rejection is gone —
  validation happens once, when the outline closes.

## v1.33.5 — 2026-07-22
- Editor tabs got extended tooltips explaining what each editor is for (plan
  geometry vs device icons vs visual decor).

## v1.33.4 — 2026-07-22
- Editing a device no longer makes its icon jump. Changing the HA binding
  (which changes the marker id) migrates the saved position to the new id;
  changing the room within the same space keeps the icon exactly where it
  stands (previously it re-centered in the new room). Only a brand-new icon,
  or a move to a room in a different space, is centered.

## v1.33.3 — 2026-07-22
- Device dialog: when no icon is set explicitly, the icon picker no longer
  looks empty — it shows the **auto-derived icon** (from the icon rules /
  device class) as a placeholder, with an "Auto: mdi:…" hint line underneath.
  Picking an explicit icon replaces it as before; clearing returns to auto.

## v1.33.2 — 2026-07-22
- Removed the **Reset** button from the Device editor. It wiped the entire
  layout — positions of all devices, room cards and their scales across every
  space — behind a single confirm. Low value, high blast radius.

## v1.33.1 — 2026-07-22
- The dot grid is now shown in **every editor** (Plan, Devices, Background),
  not just Plan — an instant visual cue that you are editing.
- In the Background editor, rooms, devices, openings and labels fade to 35%
  opacity so the decor you are drawing stands out; decor itself stays fully
  opaque. Other modes are unaffected.

## v1.33.0 — 2026-07-22 (background editor)
- New third mode: **Background editor**. Draw purely visual decor on the plan —
  lines, rectangles, ovals and text labels that never interact with rooms,
  devices or fills. Shapes are drag-drawn with grid snap and a live preview;
  text is placed via a small dialog (size S/M/L, color; double-click to edit).
  Toolbar: Select (move, Delete key), Erase, color, three line widths and an
  optional 25% fill for rects/ovals. Esc walks back: draft → selection →
  Select tool → View.
- The decor layer renders **under rooms** (a true underlay), is visible in all
  modes and completely click-transparent outside the editor. Stored per space
  in the server config (`space.decor`, validated on the backend, shared across
  clients with the usual rev/optimistic locking).

## v1.32.1 — 2026-07-22
- Opening tool: hovering near a wall now shows a **dashed preview** of where
  the opening would land — snapped onto the wall, default door length (90 cm),
  with a center dot. No preview far from walls or over an existing opening
  (a click there edits it instead).

## v1.32.0 — 2026-07-22 (split polyline, tool cursors, Esc)
- **Split can now cut along a polyline**, not just a straight chord: start on
  a wall, click intermediate points inside the room, finish on another wall.
  The path is validated (no wall crossings, no self-intersection) and drawn
  live with vertices and a preview segment. Two clicks still work as before.
- **Tool cursors**: Merge and delete-room show a pointer; Split shows a
  pointer while picking the room, then a crosshair while cutting.
- **Esc walks back out of Merge/Split** step by step: last cut point → first
  point → room selection → back to the Draw tool. Merge: selection → tool.

## v1.31.2 — 2026-07-22
- Plan editor: the room picked with the **Merge** tool (and the room selected
  for **Split**) is highlighted amber again. The `.outlined` markup style,
  added later in the stylesheet, was silently overriding the `.picked`
  highlight at equal specificity (source-order gotcha #4 — rule order fixed
  and documented in the stylesheet).

## v1.31.1 — 2026-07-22
- Plan editor: interacting with a room card (drag, corner-resize or a plain
  click) no longer leaks into the active markup tool — previously the click
  after a resize could add an outline point, pick a merge/split room or even
  prompt to delete the room under the card.

## v1.31.0 — 2026-07-22 (room cards)
- Room labels grew into **room cards**: the name on top, and an optional
  smaller metrics line below — temperature, humidity, average Zigbee signal
  and lights, each behind its own checkbox in the space settings (all off by
  default). Lights show On/Off, or **"1 of 3"** when only part of the room is
  lit. Rooms without an HA area keep showing just the name.
- Cards are **resizable** in the Plan editor: hovering shows corner handles;
  dragging one scales the whole card uniformly (0.5×–3×). The scale is stored
  in the layout next to the card position, and dragging keeps it.
- Fixed a latent v1.25 regression: room labels were not rendered as draggable
  HTML in the Plan editor at all (only a static SVG name), so moving them was
  impossible. The Plan editor now renders real cards (name only) that can be
  dragged and resized.
- Two markup smokes (merge/split) still called a method removed in v1.25 —
  repaired.

## v1.30.4 — 2026-07-22
- **Escape now closes every dialog** (general settings, icon rules, device
  editor, space dialog, opening editor, info cards), topmost first when
  stacked. Closing the space dialog with Esc abandons a floor-import queue,
  same as its Cancel button. Esc while drawing an outline still undoes the
  last point (dialogs take priority).

## v1.30.3 — 2026-07-22
- The **General settings** (fill palette) gear in the header is now visible in
  every mode for users who can edit, not just in the Plan editor.

## v1.30.2 — 2026-07-22 (editor tabs redesign)
- Mode tabs renamed and reduced to two: **"Plan editor"** and **"Device
  editor"**. View is no longer a tab — it is the implicit default state.
- The Device editor now has its own bottom toolbar (add / show all / reset
  layout / icon rules moved out of the header), mirroring the Plan toolbar.
- Both toolbars and the active tab itself got an **X** button that closes the
  editor and returns to View. Re-clicking the active tab does nothing;
  switching Plan↔Devices is direct.

## v1.30.1 — 2026-07-22 (space gear polish)
- The gear icon next to the space name is now visible in **every mode** (not
  just Plan) for users who can edit, so space settings are always one click
  away. The "+" (add space) tab remains Plan-only.
- Fixed the gear's vertical alignment — it sat noticeably lower than the space
  name (baseline-aligned web component); tabs are now flex-centered.

## v1.30.0 — 2026-07-22 (lock action in the opening info card)
- The door/window info card (View mode) now offers an explicit **Unlock/Lock
  button** when a lock entity is bound and available. Unlock is styled red as a
  security-sensitive action; the button is disabled during locking/unlocking and
  hidden when the lock is unavailable.
- The security rule is untouched: **tapping a lock icon on the plan still never
  toggles it** — the action lives only behind a deliberate, clearly labeled
  button, same interaction contract as HA's more-info dialog.

## v1.29.0 — 2026-07-22 (the "new device" flag)
- **Devices that appear in HA after installation no longer show up silently**:
  an auto-placed device (or light group) gets a big red dot at the top-right of
  its icon. The flag is stored server-side (`settings.new_device_ids`), so every
  client sees it — and it disappears everywhere the first time someone opens
  that device's editor.
- The baseline of known devices is seeded silently on the first run after the
  update, so **existing devices never flood the plan with dots**. Hand-made
  markers (virtual/rebindings) are never flagged — the user just created them.
  (Pure `diffNewDevices`, unit-tested; backend schema for the two new settings.)

## v1.28.1 — 2026-07-22 (View-mode polish: cursors and inert openings)
- **Device icons in View no longer show the grab cursor** (drag lives in the
  Devices mode); they show a pointer — clicking still works exactly as before.
- **Doors and windows in View are pure drawings**: no grab cursor, no hover
  outline, no hit target, no click — regardless of what is bound to them.
- **The lock badge is the one exception**: when a lock is bound, the badge is
  shown and clickable in View (pointer cursor, click opens the door/lock info
  card). It stays inert in Plan so it does not fight editing.
- In Plan an opening remains fully interactive: grab cursor + hover outline,
  dragging along walls, and a click with ANY tool opens its properties dialog.

## v1.28.0 — 2026-07-21 (sub-area rooms: manual placement without an HA area; issue #3)
- **Devices can now be placed into rooms that have no Home Assistant area.**
  The marker dialog's room list includes area-less rooms (marked "no area,
  manual"); pick one and the device/virtual marker lands at its centre. The
  marker stores `room_id`, so the choice survives edits and re-opens. The
  laundry-cupboard case from issue #3: a decorative room inside a larger area
  can now hold its own door sensor and light.
- Room reference parsing extracted as pure `parseRoomRef` (`space#area` /
  `space#@roomId`), unit-tested; backend schema for `room_id`.

## v1.27.0 — 2026-07-21 (RGB light colors + alarm pulse; issue #3)
- **RGB lights show their actual color**: an "on" light with a color tints its
  bulb icon, glow and — unless a custom ripple color is set — its presence ripple.
  Brightness is deliberately ignored (a dim red bulb still reads red); off,
  white-only and unavailable lights look as before. (Pure `lightColorOf`.)
- **Emergencies pulse red**: leak / smoke / gas / CO / safety / tamper / problem
  binary sensors and sirens in `on` get a red pulsing ring over any display mode.
  `unavailable`/`unknown` never alarm — an outage is not a fire. Honours
  `prefers-reduced-motion`. (Pure `isAlarmState`.)

## v1.26.0 — 2026-07-21 (state-reflecting icons + value display; issue #3)
- **Auto icons now reflect live state**, like core HA: door/window/garage sensors
  swap open↔closed variants, locks show locked/unlocked, a bulb lights up as
  `lightbulb-on`. Conservative by design: only well-known pairs, never when the
  user picked a custom icon, and `unavailable`/`unknown` keep the base icon.
  Gated by the existing "live states" card option. (Pure `stateIcon`, unit-tested.)
- **New marker display mode "Value instead of an icon"**: the measurement itself
  (temperature °, humidity %, or any numeric state with its unit) becomes the
  marker body — the small corner badges disappear for such markers. Direct
  request from issue #3. Non-numeric entities fall back to the icon.

## v1.25.0 — 2026-07-21 (three interaction modes: View / Plan / Devices)
The approved UX redesign (docs/UX-MODES.md), confirmed by user feedback (#3):

- **View** (default, and the only mode after every load): display and device
  interaction only — tap/long-press/tooltips/pan/zoom. Nothing can be dragged or
  edited; panning may start on top of an icon and never displaces it. The header
  carries only space tabs, the counter, zoom and the mode switcher.
- **Plan**: everything about geometry and appearance — room outline/delete/merge/
  split tools, openings (placement, drag along walls, click-to-edit), room-label
  dragging, per-space gear dialog, add space, the ⚙ fill palette. Orange stage frame.
- **Devices**: marker work — icon dragging lives ONLY here, a click opens the
  editor directly; add device, show-all curation, reset layout, icon rules. Accent frame.
- The mode switcher is a segmented control shown to administrators; the standalone
  markup toggle button is gone, "drag anywhere" (v1.9) is consciously reversed,
  and the v1.23.1 view-mode opening drag/double-click moved into Plan.

## v1.24.2 — 2026-07-16 (lights fill: a color for rooms with no light sources)
- The "Fill: lights" group in General settings gained a third color — **"No light
  sources"**. Its default opacity is 0, so rooms without any lights stay unfilled
  exactly as before; give it an opacity and such rooms get their own tint,
  distinguishable from "all lights off".

## v1.24.1 — 2026-07-16 (space tab: gear instead of pencil)
- The small icon next to a space name in the tabs is now a gear (was a pencil) —
  the dialog it opens is space *settings* (plan, display, scale), not just renaming.

## v1.24.0 — 2026-07-16 (general settings: fill palette; per-space LQI toggle)
- **New "General settings" dialog** (⚙ in the header): the fill colors used by every
  space, grouped by mode — lights (on / all off), temperature (cold / comfortable /
  hot) and zigbee signal (weak / strong endpoints of the gradient). Every color has
  its **own opacity slider**; the zigbee fill interpolates between the two configured
  endpoint colors. Stored server-side in `settings.fill_colors` (defaults are not
  persisted); the static `houseplan-space-card` uses the same palette.
- **Per-space "Show zigbee signal (LQI)" toggle** in the space dialog: hides or shows
  the LQI badges next to zigbee devices (and the signal line in room tooltips) for
  that space; when never touched, the card-level `show_signal` option applies as before.
- Fill opacity is now governed by the per-color setting; the space "Opacity" slider
  keeps controlling borders and names.
- New pure helpers `fillColorsOf` / `lerpColor` / `roomFillStyle` (+4 tests: 77 → 81);
  backend schema for `fill_colors` and `show_lqi`; smoke `smoke_general_settings`.

## v1.23.2 — 2026-07-16 (manual upload limit raised to 50 MB)
- The per-file limit for attached manuals (PDF etc.) is now **50 MB** (was 25).
  The limit is still enforced while the multipart body streams in, so an oversized
  upload is cut off early rather than buffered whole; the error toast reads the
  actual limit from the server response.

## v1.23.1 — 2026-07-17 (openings: hover, drag along walls, double-click properties)
- **Hover affordance**: an accent outline hugs the opening's wall strip on hover, with a
  grab cursor — placed openings now look grabbable.
- **Drag along walls** (view mode): an opening re-snaps continuously to the nearest derived
  wall while dragged; too far from any wall → it stays put. `snapToWall` now normalizes the
  angle to [-90, 90) — two rooms share a wall with OPPOSITE edge directions, and without this
  a drag across segment boundaries flipped the hinge side back and forth. Saved on release.
- **Click / double click**: a single click still opens the status card (now via a 250 ms
  timer); a **double click opens the properties dialog** right from view mode. The markup
  "Opening" tool behaves as before. Hit zone made slightly thicker and is now a strip along
  the wall (previously it covered the whole swing square, causing accidental hovers).
- (+1 test: 76 → 77.)

## v1.23.0 — 2026-07-17 (doors & windows with live open/lock state)
Visual language after easy-floorplan (MIT); the placement model is ours.
- **New markup tool "Opening"**: click next to a wall → the opening snaps onto the nearest
  DERIVED room wall (walls have no independent existence — v1.19.0) and takes its angle, then a
  dialog asks for type (door/window), **length in real cm** (defaults: door 90, window 120 —
  the per-space scale makes this honest), an open/close sensor (door/window-class
  `binary_sensor`/`cover`, invertible) and, for doors, a **lock entity**. The opening keeps
  absolute coordinates, so editing/merging/deleting rooms never breaks it. Click an existing
  opening with the tool to edit or delete it.
- **Live rendering**: a door is a leaf hinged at the jamb with a quarter-circle swing arc that
  "draws on" (stroke-dashoffset) as it opens; a window is two casement leaves meeting in the
  middle. Открыто → the moving parts take the accent colour and animate (CSS transitions,
  `prefers-reduced-motion` honoured). No sensor → the classic static plan: doors drawn open,
  windows closed. `unavailable`/`unknown` freeze that default — an outage must not fake motion
  (pure `openingAmount`, unit-tested). Hinge side / swing side via flip toggles.
- **Locks**: a padlock badge beside the door — green closed when `locked`, orange open when
  unlocked, grey question when unknown. The lock is NEVER toggled from the plan (the card's
  standing security rule); clicking the opening or the badge shows an **info card** with both
  states.
- New pure helpers `snapToWall` (projection + wall angle over derived edges) and
  `openingAmount`; `space.openings[]` validated server-side. (+2 tests: 74 → 76.)

## v1.22.0 — 2026-07-17 (presence ripples, per-device icon size/rotation, one-click install)
Ideas borrowed from [easy-floorplan](https://github.com/nicosandller/easy-floorplan) — the visuals,
not the model.
- **Presence ripples**: `display: badge | ripple | icon_ripple` per marker, with `ripple_color`
  and `ripple_size`. Active → pulsing rings; idle → a faint dot. Gated by the pure
  `isActiveState` — independent of the card-wide live_states toggle, and `unavailable`/`unknown`
  count as idle so an outage never leaves a ring pulsing. Honours `prefers-reduced-motion`.
- **Per-device icon `size` (×0.5–3) and `angle`** — sizing now hangs off `--dev-size`, so value
  badges scale with the device.
- **One-click install badge** (My Home Assistant → HACS) in both READMEs.
- (+1 test.)

## v1.21.3 — 2026-07-16 (room labels: no text shadow)
- Room name labels no longer carry a text shadow — crisper look on both the white
  hand-drawn canvas and plan images.

## v1.21.2 — 2026-07-16 (space-dialog polish)
- The **"Scale (cm per cell)" input is compact** again — a generic `width:100%`
  dialog rule was stretching it across the row.
- **A space with no background image now gets a white "paper" canvas** instead of
  the dark stage, so hand-drawn rooms read like a floor plan on paper.

## v1.21.1 — 2026-07-16 (audit: split snaps to the wall, docs for merge/split)
- **Fix (found in audit):** Split required each click to land on a grid node, so it
  silently refused rooms whose walls are not grid-aligned (imported or older polygons)
  — the "pick a wall" toast fired no matter where you clicked. The click now snaps to
  the room's nearest wall (`closestPointOnBoundary`) instead of the grid, with the pull
  capped at ~6 grid cells so an accidental click in the middle of a room stays a miss
  rather than becoming a wall point the user never meant; `splitRoom()` still rejects
  a cut that is not a clean wall-to-wall chord. Also makes aiming easier on the fine
  (240-cell) grid.
- **Docs:** README (en + ru) now documents room Merge, Split, the drawing ruler and the
  per-space scale — these v1.18–v1.21 features were shipped without user-facing docs.
  `docs/TESTING.md` gained merge/split rows and a fresh self-run record.
- New smokes `demo/smoke_merge_split.mjs` and `smoke_split_nonsnap.mjs`;
  `closestPointOnBoundary` unit-tested. (+1 test: 72 → 73.)

## v1.21.0 — 2026-07-16 (merge and split rooms)
- **Merge** (toolbar "Merge"): click a room, then a neighbour. Only rooms that **share a wall**
  can merge — and that is decided by the result rather than a heuristic: `mergeRooms` unions the
  outlines and accepts the pair only when they collapse into ONE hole-free outline. A corner
  touch, rooms apart, or a union enclosing a hole are refused. A dialog picks which name and
  area survive; the kept room keeps its id, so its label position and devices stay put. The
  dialog warns that the other area is released.
- **Split** (toolbar "Split"): click the room, then two points on its walls — the chord cuts it
  in two, with the live ruler on the cut. **The bigger part stays the room it was** (name, area,
  devices); the smaller becomes a new room and its dialog asks for name/area. Cancelling the
  dialog leaves the room whole — the cut is applied only on confirm. Cuts that do not run
  wall-to-wall inside the room (ends off the wall, chord leaving a concave room, a chord along a
  wall) are refused.
- Boolean geometry via **polyclip-ts** (proper ESM + native types; `polygon-clipping` ships named
  types but a default-only ESM build, which breaks either tsc or the runtime). Verified against
  the real plan, where neighbouring walls overlap collinearly instead of matching exactly —
  the case a hand-rolled union gets wrong. Bundle: 151 KB → 202 KB.
- New pure helpers: `polygonArea`, `mergeRooms`, `splitRoom`. (+5 tests: 67 → 72.)

## v1.20.0 — 2026-07-16 (rooms may not overlap)
- **A click strictly inside an existing room is refused** while drawing (toast names the room).
  Being *on* a wall stays legal — neighbouring rooms share walls, and real walls overlap
  collinearly rather than match exactly, so new vertices land on existing outlines mid-span
  all the time. `pointStrictlyInside` excludes the boundary explicitly (ray casting alone is
  unreliable exactly on an edge).
- **Closing an outline that overlaps an existing room is refused** — vertex checks alone are not
  enough: an outline drawn *around* a room has every vertex outside it. The outline stays open
  so it can be corrected. Nesting one room inside another counts as an overlap.
- New pure geometry in logic.ts: `roomPoly`, `pointOnBoundary`, `pointStrictlyInside`,
  `segmentsProperlyCross` (touching/collinear is deliberately not a crossing), `roomsOverlap`
  (edge crossings + containment probe, which also catches duplicate outlines). (+4 tests: 63 → 67.)

## v1.19.0 — 2026-07-16 (a line is never a thing of its own)
**Model change.** A wall can only exist as an edge of a closed room. Consequences:
- **Walls are derived from room outlines** (`roomEdges` in logic.ts), not stored. A wall
  shared by two rooms is emitted once, so **deleting a room keeps the borders its neighbours
  still contribute** — and drops the walls nobody else uses. This falls out of the model
  instead of needing bookkeeping.
- **An abandoned outline leaves nothing behind.** Previously every click pair was written to
  `space.segments` immediately, so a contour you never closed left orphan lines on the plan.
  Now nothing is persisted until the room is saved.
- **The "Erase line" tool is gone** — there is no standalone line to erase. Mis-clicks are
  undone with Esc / Ctrl+Z as before.
- **`space.segments` is dropped on every save** (legacy configs shed it on first write).
  Validation still tolerates the field so a stale browser tab cannot fail a save; diagnostics
  no longer reports it. Lines that belonged to no room disappear on upgrade — by design.
- Dead code removed: `_addSegment`, `_removeSegmentByKey`, `_distToSeg`, `_pathSegs`, `_segKey`.
  `segKey(a, b, prec)` gained a precision argument (normalized coords need more than render
  units). (+2 tests: 61 → 63.)

## v1.18.1 — 2026-07-16 (fix: the drawing ruler was invisible)
- Fix on top of v1.18.0: the length badge never showed up while drawing. It was rendered
  inside `.devlayer`, and `.stage.markup .devlayer { display: none }` hides that whole layer
  in markup mode (so icons do not get in the way) — the badge was in the DOM but invisible.
  It now lives in its own `.measurelayer` (absolute, `pointer-events: none`), which markup
  mode does not hide. Verified visually on a real drawn segment ("3.60 m" on screen).
- Testing lesson (see docs/TESTING.md): asserting on `textContent` is not enough — a DOM
  query passes on elements hidden by an ancestor. Check `offsetParent`/rect or look at a
  screenshot.

## v1.18.0 — 2026-07-14 (live measurements while drawing rooms + per-space scale)
- **Ruler while drawing.** In room-markup "draw" mode, a badge follows the cursor showing the
  length of the current segment (last placed vertex → cursor). Units come from the HA unit
  system: metric → metres ("1.25 m"), imperial → feet+inches ("4′ 1″").
- **Per-space scale.** New "Scale (grid cell size)" field in the space dialog — cm represented
  by one grid cell (default **5 cm**, i.e. 240 cells ≈ 12 m). Stored as `space.cell_cm`; each
  plan can have its own real-world size.
- Pure helpers `segmentCm` / `formatLength` in logic.ts (unit-tested); `_fmtLen` +
  `_renderMeasureLabel` in the card; `.measurelabel` style; i18n `space.scale_label`/`scale_unit`.
  (+3 tests: 58 → 61 frontend.)

## v1.17.2 — 2026-07-11 (humidity badge: gate on the sensor, not the icon)
- Fix on top of v1.17.1: the humidity `%` badge is now shown whenever the marker's primary
  entity is a humidity sensor (`device_class: humidity`), regardless of the resolved icon.
  Previously it required the `mdi:water-percent` icon, so a humidity sensor whose name matched
  another icon rule (e.g. a "Myheat Влажность …" sensor → boiler icon) showed no value.
  Verified live (45.2 → 45%). (+1 test: 57 → 58.)

## v1.17.1 — 2026-07-11 (humidity value next to the icon, like temperature)
- **Humidity sensors now show their value (%) next to the icon**, mirroring the temperature
  badge. Any marker resolved to the humidity icon (`mdi:water-percent`) — a humidity device or a
  humidity entity placed on its own (v1.17.0) — gets an integer `%` badge and the value in its
  tooltip. New `isHumEntity`/`humFor` (diagnostic entities excluded), `DevItem.hum`, `.hval`
  badge, gated by the same "sensor values" option as temperature. (+2 tests: 55 → 57.)

## v1.17.0 — 2026-07-11 (place individual entities, not just whole devices — issue #1)
- **You can now put a single entity on the plan as its own icon** — e.g. a climate sensor
  exposes temperature AND humidity; add the device (shows temperature) and separately add the
  humidity entity as a second icon. In the "add device" dialog, start typing in the binding
  search and individual entities now appear alongside devices/helpers (surfaced only while
  searching, so the default list stays clean); the sub-label shows the domain and parent device.
- Entity markers now get a **sensible auto icon** (name rules → `device_class` → chip) instead of
  the generic shape, and a **temperature value** when the entity is a thermometer/air-monitor.
  The `entity:<eid>` binding already existed (used by helpers/light groups); this exposes it for
  any entity. (+1 test: 54 → 55.)

## v1.16.2 — 2026-07-11 (docs+log: correct card resource URL — fixes "Custom element doesn't exist")
- **Support issue #2**: users adding a Lovelace resource that points at the on-disk path
  `/custom_components/houseplan/frontend/houseplan-card.js` get a `text/plain` MIME error and
  "Custom element doesn't exist: houseplan-card" — HA does not serve `custom_components/` over
  HTTP. The integration serves the card at **`/houseplan_files/houseplan-card.js`** (verified:
  `200 text/javascript`) and auto-registers it as a Lovelace resource in storage mode.
- README (en+ru) now documents the correct URL and the common mistake, incl. a YAML-mode
  `resources:` snippet.
- On setup the integration logs (INFO) the exact served URL and, when Lovelace resources are
  YAML-managed, how to add it manually — so the fix is discoverable from the logs.

## v1.16.1 — 2026-07-08 (space-card shows room fills as configured)
- **The static `houseplan-space-card` now renders room fills exactly as configured on the
  full card** (temperature / signal / lights coloring), as a snapshot of the states passed
  in via `hass` — reverting the v1.16.0 omission. The card still does not subscribe to state
  changes itself and stays non-interactive (`pointer-events:none`); fills refresh when HA
  hands the card an updated `hass`. Added shared `areaLqi()` in devices.ts.

## v1.16.0 — 2026-07-08 (new: houseplan-space-card + deep-link)
- **New second card `custom:houseplan-space-card`** — a READ-ONLY, static schematic of a
  single space, embeddable on any dashboard. Draws the configured plan + room borders/names +
  device markers at their saved positions, with **no interactivity** (the schematic layer is
  `pointer-events:none` — no clicks/hover/tooltips/drag/more-info) and **no live states**
  (no state subscription, no status/temperature fills). A footer button opens the space in the
  full component via a **deep-link** (`#space=<id>`). Config: `space` (required), `title`,
  `show_button`, `button_label`, `button_target`, `aspect_ratio`, `icon_size`; unknown space → a
  tidy error card. GUI editor with a space dropdown from the integration config.
- **Deep-link in the full card**: on load it reads `#space=<id>` (valid id wins over
  `default_floor`) and listens to `hashchange`, without blocking manual space switching.
- **Shared rendering**: pure geometry in `space-geometry.ts` (unit-tested), the static drawer in
  `space-render.ts`, and a **module-level config cache** (`config-store.ts`, rev-keyed, seeded from
  the full card's localStorage snapshot, invalidated on `houseplan_config_updated`) so N embedded
  cards on one board share a single WS request. Both cards ship in the one bundle.
- Tests: 48 → 54 frontend (space geometry) + demo smokes `smoke_space_card` and `smoke_deeplink`.
- Note: status/temperature fills are intentionally omitted from the static card (they are live);
  it shows configured room borders/names + neutral icons. Marker/position edits reflect after the
  config event or a reload.

## v1.15.6 — 2026-07-08 (room hover also reveals the border)
- Hovering a room now **shows its outline** even when borders are turned off. The stroke
  colour (`--room-stroke`) is now always set to the room colour and only hidden via
  `--room-stroke-op` — so the existing `stroke-opacity: 1` on hover reveals a crisp border
  (previously the stroke was `transparent` when borders were off, so hover showed nothing).

## v1.15.5 — 2026-07-08 (fix: room hover was always grey even when filled)
- Room hover now **darkens the current fill** for filled rooms and only greys **unfilled**
  ones (as intended since v1.15.1). The legacy `.room.overlay:hover` / `.room.yard:hover`
  grey rules were still matching styled rooms and, being applied to `fill` directly, beat
  the `--room-fill` variable — so a temperature/light/zigbee-filled room turned grey on
  hover. Scoped those legacy rules with `:not(.styled)`; styled rooms are now governed only
  by `.styled.filled:hover` (brightness 0.78) and `.styled:not(.filled):hover` (grey).

## v1.15.4 — 2026-07-08 (fix: device icon vertical centering — proper root cause)
- **Root cause of the off-centre icon, found in the live app** (the demo stub hid it):
  HA's real `<ha-icon>` host is `display:block` with a large inherited `line-height`
  (~22 px for a ~12 px glyph), so the SVG sat ~1.8 px **below** the badge centre.
  Fix: `.dev ha-icon` is now a zero-line-height flex box — the glyph centres exactly.
- Reverted the v1.15.3 `box-sizing: border-box` (it shrank the badge by 2 px and made the
  vertical offset *more* visible — "worse"). The 1 px anchor drift is instead corrected by
  the centering margin (`-(size/2 + 1px)`), keeping the original badge size.
- Verified in the real dashboard: anchor offset 0, glyph offset 0, badge size unchanged.
- Demo `ha-icon` stub made faithful to HA (block + line-height) so `smoke_icon_center`
  now actually reproduces and guards this; the smoke also asserts glyph-in-badge centering.

## v1.15.3 — 2026-07-08 (fix: device icon 1px off its anchor point)
- Device icon badges were sitting **1 px down-and-right of their true point**: `.dev`
  used the default `content-box`, so the 1 px border made the rendered square 2 px
  wider than the width the centering margin assumed. Added `box-sizing: border-box` —
  the badge centre now lands exactly on the device coordinate (verified in the demo:
  anchor offset 1 px → 0). The glyph itself was already centred within the square.

## v1.15.2 — 2026-07-08 (fix: room average temperature counted non-thermometers)
- **Average room temperature now uses only devices the card treats as thermometers**
  (`mdi:thermometer` / `mdi:air-filter`). Previously `areaTemp` swept every device in the
  area through `tempFor`, so fridges, TRV heads and smart plugs leaked their readings into
  the average (e.g. a 8.3 °C valve/appliance temperature dragging a room down).
- **`isTempEntity` now excludes chip/diagnostic temperatures**: `*_device_temperature`
  sensors and any entity in the `config`/`diagnostic` category are no longer treated as a
  room temperature — so even a genuine thermometer no longer reports its chip temperature.
- Affects the temperature room fill and the room tooltip average. (+3 frontend tests: 46 → 48.)

## v1.15.1 — 2026-07-06 (display-settings UX round from live usage)
- **Comfort-bounds input hardening**: clearing a temperature field can no longer
  collapse a bound to 0 (`Number('') === 0` — this silently turned "comfort from
  25" into a 0–25 range after the auto-swap, showing green at 24°). Inputs now
  parse with `parseFloat` + `isFinite` guard and the save path falls back to the
  defaults for non-finite values.
- Room tooltip now shows the **average room temperature** (what the temperature
  fill actually uses — averages every thermometer in the area, including TRVs).
- **Hover no longer recolors rooms blue**: filled rooms darken their current fill
  (`brightness(0.78)`), unfilled rooms get a light grey tint.
- Fill mode selector is a **radio group** with short labels (no color legend);
  the comfort bounds sit compactly inline on the temperature row (56 px inputs).
- The space dialog is wider (500 px) — the settings no longer feel cramped.

## v1.15.0 — 2026-07-06 (temperature room fill)
- New room fill mode **"Temperature"**: light blue below the comfort range, green
  inside it, warm yellow above. The comfort bounds (default 20–25 °C) are editable
  right in the space dialog and appear only when the mode is selected; bounds
  entered in the wrong order are swapped automatically. A room's temperature is
  the average of its devices' temperature readings; rooms without a reading stay
  unfilled. (+`areaTemp` helper, 3 new frontend tests, backend schema fields.)

## v1.14.0 — 2026-07-06 (per-space display settings, hand-drawn spaces, testing checklist)
- **Per-space "Display" settings** (space dialog): always-visible room borders,
  room name labels, a border/name color picker with an opacity slider, and a room
  fill mode — none / by zigbee signal (red→green) / by lights (yellow = something
  is on, grey = all lights off; rooms without lights stay unfilled).
- **Room name labels are draggable** like device icons; positions persist server-side
  (layout keys `rl_<roomId>`), defaults to the room centre; hidden in markup mode.
- **Hand-drawn spaces**: the space dialog got a "No image — I'll outline rooms by
  hand" option with a canvas orientation choice (landscape/portrait/square). Such
  spaces default to visible borders and names; switching an existing space to this
  mode detaches its background image. The plan image is no longer mandatory.
- Backend: explicit validation schema for the new per-space settings (+test).
- **`demo/` harness moved into the repository** (synthetic home, host page, capture
  and smoke scripts, icon-map generator) — public materials and smoke tests no
  longer depend on a perishable sandbox.
- **`docs/TESTING.md`**: a comprehensive manual-testing checklist (environments
  matrix, every feature, edge cases); policy — updated in the same commit as any
  functional change. The first self-run found and fixed two bugs:
  `plan_url` not detached on image→draw switch, and a `_stateClass` crash on
  state objects without `entity_id`.
- Tests: 43 frontend + 11 pure backend; new smokes `smoke_space_settings` and
  `smoke_edge_cases` (empty install, XSS names, legacy layout entries, 150-device perf).

## v1.13.3 — 2026-07-06 (privacy: drop legacy real-house plan sources)
- Removed the legacy `assets/` directory (real floor-plan sources from the pre-v1.3
  bundled-data era). Nothing in the build referenced it; instance data lives in
  server-side config. Note: the files remain in old git history and release archives.

## v1.13.2 — 2026-07-05 (audit round 3: fixes + buildDevices test suite)
- **buildDevices finally has a direct unit-test suite** (12 tests on a fake hass):
  area filtering, curation incl. show-all, duplicate numbering, light-group folding
  and its `group_lights=false` inverse, marker claim/metadata/hidden/virtual/entity
  paths, custom icon rules + the deliberate lock override, device_class fallback,
  primary-entity priority, LQI/temperature extraction. Frontend tests: 28 → 41.
- Fix: `t()` now substitutes **every** occurrence of a placeholder (extracted as the
  pure `subst()` helper with a regression test).
- Fix: `_saveConfigNow` refreshes the local config on a rev conflict before
  rethrowing — a retry no longer hits the same conflict (the debounced path already
  did this; the immediate path did not).
- Fix: `pointercancel` on a device icon clears the long-press timer — no phantom
  info card after an aborted touch gesture.
- Repairs check moved to `repairs.py` and now **re-runs after every config save**,
  so a missing/restored plan file is reflected in the Repairs UI without a restart.
- Documented the deliberate `mdi:lock` override in `devices.ts` (wins over custom
  rules — a mislabeled lock icon is safety-relevant confusion).
- Test infra: `tsconfig.test.json` also compiles `devices.ts`/`types.ts`;
  `scripts/fix-test-build.mjs` appends `.js` to tsc's extensionless ESM imports.

## v1.13.1 — 2026-07-05 (distribution materials)
- **Demo GIF** in the README — recorded on a fully synthetic demo home (no real
  floor plans): live states, tap-to-toggle, drag, zoom, info card, space tabs.
- GitHub issue templates (bug report with diagnostics hint, feature request),
  `CONTRIBUTING.md` (5-minute setup, ground rules, architecture pointers),
  Discussions enabled.

## v1.13.0 — 2026-07-05 (universality: floors import, icon rules, tap actions)
- **Floors import wizard**: on first run, if the HA registry has floors, the card
  offers to create a space per floor — names prefilled, the (mandatory) plan image is
  requested step by step, any floor can be skipped; after the last one the room-markup
  mode opens automatically. No floors / old HA → the old single-dialog onboarding.
- **Editable icon rules**: the built-in "name pattern → MDI icon" rules are now data
  (`settings.icon_rules`) with an in-card editor (⬡ in the header): reorder, delete,
  add, live test field, invalid-regex highlighting, one-click reset to the bilingual
  (EN/RU) defaults. Fallback chain: rules → entity `device_class` → generic chip.
  Invalid user regexes are skipped safely.
- **Tap actions**: `tap_action` card option (`info` default | `more-info` | `toggle`)
  plus a per-device override in the device dialog. Safety model: a card-wide toggle
  only affects lights/switches/fans/humidifiers; covers/valves need a conscious
  per-device toggle; locks and alarm panels never toggle from the plan. A long press
  (600 ms) always opens the info card.
- **i18n dictionaries moved to JSON** (`src/i18n/{en,ru}.json`) — new languages can be
  contributed without touching TypeScript; tests enforce key and placeholder parity.
- Light-theme pass: hardcoded dark badge backgrounds replaced with theme variables.
- Tests: 28 frontend (was 15) — tap-action resolver incl. security cases, icon-rule
  compilation/overrides/device-class fallback, floors sorting, i18n parity.

## v1.12.0 — 2026-07-05 (Quality Scale: Bronze + selected Silver/Gold)
Backend brought to Integration Quality Scale patterns (custom integrations are not
formally graded; progress is tracked in `custom_components/houseplan/quality_scale.yaml`):

- **`entry.runtime_data`** (typed `HouseplanData`: both stores + the write lock) replaces
  `hass.data[DOMAIN]` for entry data; WS handlers resolve it per call and answer
  `not_ready` while no entry is loaded. New `store.py` common module.
- **test-before-setup**: storage readability is verified in `async_setup_entry`
  (`ConfigEntryNotReady` on failure). **Unloading** is supported; WS commands and
  static paths are global by design (documented).
- **`single_config_entry: true`** in the manifest replaces the manual flow check.
- **Store versioning**: stores now carry `minor_version` and a migration hook
  (`HouseplanStore._async_migrate_func`) — schema changes get a single upgrade path.
- **Diagnostics** (`diagnostics.py`): redacted dump (options, rev, per-space stats,
  markers with personal fields redacted, layout size).
- **Repairs**: a missing plan file raises a repair issue (`broken_plan`) with
  en/ru translations; issues clear automatically when resolved.
- **System health** (`system_health.py`): rev, spaces/rooms/markers/layout counters.
- **Uninstall cleanup**: `async_remove_entry` deletes our Lovelace resource entry.
- **Tests**: config flow, WS API (layout ops, rev conflict, not_ready, plan upload
  validation), HTTP upload (ok/bad ext/traversal) on `pytest-homeassistant-custom-component`
  — run in CI on Python 3.13; pure validation tests still run anywhere.
- `strings.json` added; translations updated.

## v1.11.2 — 2026-07-05 (device dialog: usable Description height)
- The Description textarea in the device edit dialog was squeezed to ~2 lines by
  the dialog body's flex column. Now `min-height: 92px`, `flex-shrink: 0`, `rows=4`;
  still resizable vertically.

## v1.11.1 — 2026-07-05 (brand images shipped inside the integration)
- Brand icon and logo (256/512, transparent background) now live in
  `custom_components/houseplan/brand/` — the native mechanism for custom
  integrations since Home Assistant 2026.3 (served via `/api/brands/...`,
  local images take priority over the brands CDN). The former root `brand/`
  directory is gone, and no home-assistant/brands PR is needed (theirs bot
  closes such PRs as obsolete).

## v1.11.0 — 2026-07-05 (full English translation + UI localization)
- **UI localization (en/ru)**: every card string moved to `src/i18n.ts` dictionaries.
  The language follows the HA user profile (`hass.locale`) automatically; a new
  `language: en|ru` card option forces it. The GUI editor got the option and its own
  localized labels. Generated device names (light group, unnamed, virtual device)
  are localized via a `loc` callback in `BuildCtx`.
- **English-only codebase**: all comments, docstrings, section banners, JSDoc, test
  names, backend WS/HTTP error messages and log lines translated to English.
  Russian remains only where it is functional or content: the `ru` i18n dictionary,
  `translations/ru.json` (config flow), `iconFor` regex patterns matching Russian
  device names (with their test fixtures), and the Russian documentation copy.
- **Docs**: README is now English-first with a full Russian copy in `README.ru.md`;
  `docs/ARCHITECTURE.md`, `DEVELOPMENT.md`, `ROADMAP.md` and the entire CHANGELOG
  history translated to English. `translations/en.json` had Russian strings — fixed.
- Removed obsolete `RELEASE_NOTES_v1.9.3.md` and `scripts_publish.sh` (publication
  is done; the repo lives at github.com/Matysh/houseplan-card).

## v1.10.0 — 2026-07-05 (audit: write races, XSS, modularity)
**Backend**
- **Write race eliminated**: all load→modify→save cycles (`layout/set|update|delete`,
  `config/set`) are serialized by a shared `asyncio.Lock` — concurrent WS calls no longer lose
  changes, and the `expected_rev` check became atomic.
- New WS command `houseplan/layout/delete` — cleans up a position when a marker is deleted
  (previously orphans accumulated in `.storage/houseplan.layout`).
- Removed the dead WS command `houseplan/file/set` — files are uploaded over HTTP only
  (`/api/houseplan/upload`), as the card already did.
- HTTP upload: the 25 MB limit is enforced WHILE reading the multipart stream (abort at the limit),
  not after reading the whole file into memory; file `stat()` moved into the executor.
- `request.app[KEY_HASS]` instead of the deprecated `request.app["hass"]` (with a fallback for older HA).

**Frontend**
- **The god-component was broken up**: `houseplan-card.ts` 3023 → ~1990 lines.
  Styles → `styles.ts`; types → `types.ts`; building devices from the HA registries
  (curation, light groups, markers, LQI/temperature) → `devices.ts` (pure functions).
- **Last-writer-wins in the layout eliminated**: `_saveMarker` writes the position pointwise
  (`layout/update`), not the whole layout (`layout/set`) — it no longer wipes positions from other
  windows (the regression class of the v1.4.4 incident). Rebinding/deletion clean up the old position.
- **XSS closed**: marker `link` and `pdfs[].url` go through `safeUrl()` (only http(s)
  and relative paths; `javascript:`/`data:` are rejected). +12 tests.
- File uploads via `hass.fetchWithAuth` (auto-refresh of an expired token),
  fallback to the raw token.
- **The dacha hardcode removed from the GUI editor**: the "default space" list is built
  from the server config (WS `config/get`), not the baked-in f1/f2/yard.
- `rules.ts`: removed the dead export `GROUP_TITLES`; the `iconFor` regexes are precompiled.
- A single `_errText()` in all error handlers (never "[object Object]").

## v1.9.3 — 2026-07-05 (audit + refactoring + tests)
- The pure functions `fitView` (viewport contain rectangle) and `declump` (icon push-apart)
  were extracted from the card into `logic.ts` — covered by unit tests (was 9 → now 14 tests).
- `_lqiFor` and `_roomLqi` now use the shared `averageLqi` (duplicate averaging removed).
- Removed dead code left after dropping the separate edit mode: the `_edit` field (written but
  never read), the methods `_renderEditbar` and `_applyXY` (never called).
- No behavior change — only structure and test coverage. Verified: tsc, build,
  14 frontend tests + 10 backend tests green, headless smoke test (render/zoom/devices/declump) clean.

## v1.9.2 — 2026-07-05 (grid twice as fine)
- The markup/snapping grid step was halved: `GRID_N` 120 → 240. Device positions and room
  outlines are NOT recomputed and do not shift: coordinates are stored as normalized fractions and snap
  to grid nodes, and the old nodes (multiples of 1/120) are an exact subset of the new ones (multiples of 1/240).
  Verified on the live layout (65 positions — all already on the new grid). Dragging now
  allows more precise positioning.

## v1.9.1 — 2026-07-05 (Zigbee signal: reading from the attribute + ZHA)
- The signal level is now taken not only from the dedicated `*_linkquality` sensor (Z2M), but also:
  from `*_lqi` sensors (ZHA), and from the `linkquality`/`lqi` ATTRIBUTE on any entity of the device.
  This covers devices whose dedicated signal sensor is disabled but the value is available in an attribute.
- NOTE: if a device's `*_linkquality` sensor is disabled (disabled_by=integration) AND the value
  is not published anywhere as an attribute — the signal cannot be shown; enable the sensor in the HA registry.

## v1.9.0 — 2026-07-05 (UX: always-on dragging, declumping, show all, responsive)
- **Icon dragging is available at all times** — the separate "edit mode" is gone (the ✥ button removed).
  Clicking an icon opens the device card (metadata editing — via the "Edit" button
  inside it), dragging works at any moment. `_pointerDown` no longer requires `_edit`.
- **Icons no longer clump together** (`_declump`): after the automatic grid layout a push-apart pass
  runs within the room so that icons do not overlap each other.
- **Positions are pinned when a room is saved**: the auto-positions of the area's devices are written
  into the layout once, so icons do not get reshuffled when the order in the HA registry changes.
- **Duplicates are numbered instead of hidden**: devices with the same "name|area" get a suffix
  (" 2", " 3"…) instead of silently disappearing.
- **The 👁 "Show all devices" button** in the header: temporarily disables curation and shows
  all devices of the area (bridges, service records, duplicates) — in case a needed one is hidden. The `show_all`
  flag in the config settings.
- **Markup continuation hint**: after saving a room a toast shows the room counter and
  suggests outlining the next one or leaving markup mode.
- **Responsive header**: the toolbar wraps and shrinks on narrow screens (media query ≤620px).

## v1.8.4 — 2026-07-04 (onboarding: required fields + user guidance)
- Initial setup brought to the target scenario: install → space dialog →
  rooms → auto device icons.
- **The background is mandatory** when creating a space: "Save" stays disabled without an uploaded
  plan (previously only the name was required — an empty space could be created).
- **The room area is mandatory**, with an explicit escape hatch: the main "Save" requires binding to an HA area;
  for decorative rooms without devices (hall, sauna) there is a separate "No area" button
  (only a name is needed). Previously saving was possible with "name OR area".
- **User guidance:** with an empty server config the space dialog opens
  automatically; after the first space is added the card enters room markup mode
  by itself with an "outline the rooms" hint. 
- When a room with an area is saved, the icons of that area's devices are auto-placed inside the outline
  (the curated set: without bridges/service records/duplicates/individual lamps from groups), and a toast shows
  how many devices were added.

## v1.8.3 — 2026-07-04 (instant start: config cache, data in the background)
- Icons and the plan appeared with a delay — the card waited for the server response (WS `config/get`
  + connection warm-up retries), and until then the space model was empty.
- A "stale-while-revalidate" cache was introduced: a snapshot of the server config + rev + layout
  is saved in `localStorage['houseplan_card_cfg_v1']`. In `setConfig` (synchronously, before
  hass arrives) it is restored — the plan and icons are drawn immediately from the cache (verified: setConfig
  populates the model in 0.2 ms without the server), while fresh data loads in the background and updates the
  card. Live states/temperatures/signal come in as hass warms up.
- The cache is refreshed after every successful load, live resync and icon position save,
  so on the next open the current snapshot is visible. When the server is unavailable the
  last known plan is shown instead of the empty onboarding.

## v1.8.2 — 2026-07-04 (vector-crisp zoom via viewBox + full-width stage)
- Zoom moved from CSS `transform: scale()` to manipulating the SVG `viewBox`. Previously the layer
  was rasterized and then scaled — everything "blurred" when zooming in. Now the browser
  redraws the vector at the target resolution: icons, room labels, lines, hatching and the
  vector background remain crisp at any scale (verified at 274%).
- The icon layer (HTML) is positioned and scaled by the same `view`, not a global
  transform — the icons are crisp and grow together with the plan.
- The stage now occupies the full viewport width (a "contain" model by the stage aspect): when
  zoomed in the content fills the width without black bars on the sides. Fully zoomed out the
  whole plan is visible (both width and height), the margins around it are filled with the card
  background, not black.
- All coordinate math (markup click `_svgPoint`, icon drag, pan, pinch) was rewritten
  in unified `view` coordinates — editing is correct at any zoom. A ResizeObserver on the stage
  recomputes the `view` when dimensions change (sidebar, rotation). Pan/zoom are constrained to `fit`.

## v1.8.1 — 2026-07-04 (fit-to-viewport + per-space zoom persistence)
- Zooming out to the full view: the lower zoom limit = 100% coincides with the fully
  visible plan. `.stage` is now constrained by the viewport height
  (`width:min(100%, calc((100dvh − 118px) × aspect))`, `max-width:100%`, centering),
  so on reset/zoom-out the whole layout is visible both in width and height without clipping.
- The zoom level is remembered per space and locally per device
  (`localStorage['houseplan_card_zoom_v1']`, `_zoomBySpace`): switching floors
  restores each floor's zoom; on return the pan is centered and constrained.
- Verified on live HA: f1→196%, f2→140%, the yard untouched — after switching around the
  values are restored; reset gives 100% and the full plan (874≤992 px in height).


## v1.8.0 — 2026-07-04 (plan zooming)
- Zoom and pan of the layout: mouse wheel (towards the cursor), two-finger pinch on a touch screen,
  one-finger background drag when zoomed in, −/reset/+ buttons in the toolbar, a zoom badge.
- Implemented via a CSS transform on `.zoomwrap` (translate+scale); the coordinate math
  (markup clicks, icon drag, tooltips) was recomputed with zoom/pan in mind — editing
  works when zoomed in too. Pan is constrained so the content always covers the stage. Zoom 100–800%.
- `.stage`: overflow hidden + touch-action none (custom gestures instead of the browser's).

## v1.7.4 — 2026-07-04 (PDF over HTTP instead of WebSocket)
- THE ROOT CAUSE of being unable to upload a PDF: the file was sent as base64 in a single WebSocket
  message, and WS has a message-size limit — a real manual (>2–3 MB) exceeded it, the connection dropped
  ("Connection lost"), which both failed the upload and closed the dialog (WS drop → reconnect
  → re-render). Confirmed by test: 1 MB over WS is fine, 3 MB → Connection lost.
- Manual files are now uploaded through the HTTP endpoint `POST /api/houseplan/upload` (multipart,
  HomeAssistantView, requires_auth, admin_only check) — like media in HA itself. Verified:
  3 MB (182 ms) and 10 MB (446 ms) upload without a hitch.
- Readable errors everywhere (`_errText`): no more "[object Object]"; clear texts for
  too_large / bad_ext / unauthorized.
- The WS command houseplan/file/set is kept for compatibility, but the frontend uses HTTP.


## v1.7.3 — 2026-07-04 (device dialog fixes)
- PDF manuals failed to upload: the manual base64 (`btoa(String.fromCharCode(...subarray))`) crashed
  on real files (RangeError when spreading large arrays), and when the dialog was closed during an
  await it threw a null access. Replaced with `FileReader.readAsDataURL` (reliable for any size);
  the results are accumulated and added only if the dialog is still open (no exceptions).
- The device/space/room edit dialog closed on an outside click and "by itself"
  (an accidental click on the background overlay, including after closing the system file picker). Removed
  background-click closing for editor dialogs — only explicit Cancel/Save/Esc.
  The info card (read-only) still closes on an outside click.
- Verified on live HA: PDFs attach; a background click and dialog data refresh do not close the dialog.

## v1.7.2 — 2026-07-04 (fix for the mobile "configuration error")
- THE CAUSE: the card was hooked up only via `add_extra_js_url` (extra_module_url), whose loading the
  frontend does NOT wait for — on a cold start of the mobile app the dashboard was drawn
  before the element was registered → "configuration error". (All working HACS cards are Lovelace resources.)
- FIX 1: the integration registers the card as a **Lovelace resource** (module) — the frontend waits for
  those before rendering. Idempotent (updates the URL on a version change, no duplicates); a fallback to
  extra_module_url for Lovelace YAML mode. `_register_lovelace_resource` in __init__.py.
- FIX 2: `_loadFromServer` retries (up to 8 attempts on hass updates) — if hass arrived before
  WS readiness, the card does not get stuck on the onboarding but waits for the config.
- Verified: the houseplan-card.js resource is registered, extra_module_url is empty (a single clean
  module), the card renders the plan on a fresh tab without the error.

## v1.7.0 — 2026-07-04 (audit + refactoring + tests)
- Removed the sample house baked into the bundle (the dacha, ~245 KB of base64 plans + ROOMS/FLOOR_*): the bundle
  went 293 KB → 83 KB. A fresh install shows the "Add a space" onboarding, not someone else's house.
- Removed the legacy→server migration code (the dacha is already on the server config) and the dead
  device_overrides/virtual_devices paths (replaced by markers[]).
- Pure logic extracted into src/logic.ts (lqiColor, snapToGrid, segKey, pointInPolygon,
  markerIdForBinding, averageLqi) — covered by unit tests (node:test, 9 tests + iconFor).
- Backend: validation/sanitizers extracted into validation.py (no HA imports) — pytest, 10 tests.
- SECURITY: a test revealed that the file/marker name sanitizer preserved leading dots
  (a directory traversal risk via ".."); leading-dot stripping added, empty → misc/file.
- Fixed real bugs previously masked by the truncated rules.ts: DOMAIN_PRIORITY was
  cut short (breaking the more-info entity selection); _defaultPositions crashed on polygon rooms
  (now bbox). tsc --noEmit added to the build and CI — strict typing passes.
- Removed the junk duplicates src/data/{editor,rules}.ts; versions synchronized (the manifest was stuck at 1.4.0).
- CI: added typecheck, frontend and backend unit tests.

## v1.6.2 — 2026-07-04
- The "Room" field in the device dialog is now for ALL icons (not only virtual ones):
  for bound ones it "overrides the placement" (by default, the device's area); changing the
  room moves the icon to its center. Stored in marker.space/area and wins over the HA area.
- An "Edit" button was added to the info card — it opens the device edit dialog.

## v1.6.0 — 2026-07-04 (Phase 3: device editor)
- The "markers" model (config.markers[]): a hybrid — auto-discovered HA devices appear by themselves, markers
  edit/rebind/augment them and describe manual/virtual icons. The marker id
  preserves the position (device→device_id, entity→lg_<eid>, virtual→v_<rand>).
- Clicking an icon: normal mode → the info card (name, model, state, link, description,
  PDF manuals, an "Open in HA" button); edit mode → the edit dialog.
- The device dialog: name, binding (a picker of all HA+Z2M devices/groups+helpers with a text
  filter, minus already-placed ones and duplicates by name|area, plus "Virtual device"), MDI icon
  (ha-icon-picker), model, link, description, manual file attachment (PDF to the server),
  room (for virtual ones), Remove/Cancel/Save.
- Toolbar: a "+" button (tooltip "Add device") — an empty dialog.
- Backend: MARKER_SCHEMA in the config; WS houseplan/file/set (files in /config/houseplan/files/,
  ≤25 MB, served from /houseplan_files/files/); the files static path registered.
- Virtual icons are now draggable and positioned like normal ones (layout by id).

## v1.6.1 — 2026-07-04
- The binding picker hides device duplicates by "name|area" (Tuya/LocalTuya), same as the dedup on the plan.

## v1.5.1 — 2026-07-04 (space management)
- A pencil icon to the right of each space name in the top toolbar + a "+" button
  (only with a server config).
- The space dialog: a "Name" field, a preview of the current background + "Upload/Replace…"
  (SVG/PNG/JPG/WebP, base64 → houseplan/plan/set, the aspect ratio is detected from the file),
  Delete / Cancel / Save buttons. Creating an empty space and deletion (together with all its
  rooms and markup, with a confirmation). Saved via config/set with a revision.

## v1.5.0 — 2026-07-04 (light groups = entities)
- Lamps replaced by group entities: HA light groups (platform=group, area from the entity registry)
  and Z2M groups (device model=Group) are rendered with the mdi:lightbulb-group icon; a click → the group's
  more-info (controlling the whole group and its members natively in HA).
- Individual lamps are hidden in rooms that have a light group (settings.group_lights=false
  brings back the per-lamp mode).
- The old visual grouping and the custom member menu were removed (code simplification).
- The positions of the old groups (grp_<area>) were migrated to the new ids (lg_<entity_id>) in the dacha layout.

## v1.4.4 — 2026-07-04 (CRITICAL fix: configuration race)
- INCIDENT: the config was saved wholesale on a last-writer-wins basis — an open client with a
  stale copy wiped other clients' edits (the first iteration of the user's markup was lost).
- Fix: optimistic locking — the config carries a `rev`; `config/set` accepts `expected_rev`
  and returns a `conflict` error on mismatch; the client re-reads the config.
- Live synchronization: `config/set` broadcasts a `houseplan_config_updated` event; all open
  cards are subscribed and re-read the config automatically (windows no longer diverge).
- Positions during drag are saved pointwise via `layout/update` (dirty set), not a full
  `layout/set` — the layout is also no longer wiped between windows.
- A config backup before deployment: .storage/houseplan.config.bak-*.

## v1.4.3 — 2026-07-04
- Device icons snap to the same grid as the markup (the icon center = a node, snapping
  on drag and on X/Y input). The existing 57 positions in the dacha DB were snapped to the nodes.

## v1.4.2 — 2026-07-04 (markup grid)
- The grid step was halved: GRID_N 60 → 120 (step 8.33 render units ≈ 0.83% of the plan width).
- Grid points are rendered ON TOP of the plan and rooms (the grid-rect was moved from below the plan
  into the top markup layer); the points are higher-contrast (r=0.14g, outline).
- Dacha data: the boundaries of all 13 rooms were snapped to grid nodes (edge snapping, shifts ≤ half a step;
  only the instance config was edited via houseplan/config/set, the code was untouched).
- Card cache: the module URL ?v= is taken from const.VERSION — when updating the frontend, bump
  const.py and restart HA, otherwise browsers keep the old module in memory cache.

## v1.4.1 — 2026-07-04 (markup UX)
- Esc / Ctrl+Z while drawing remove the last point (and its line, if it was added
  by that step; reused walls belonging to others are untouched).
- The editing panel (markup and layout editing) was moved to the top under the card header
  and pinned together with it (a shared sticky container .hdr).
- Closing the outline automatically opens the "New room" modal dialog: the display
  name, a dropdown of ONLY the free HA areas (not assigned to any room of the config),
  Save/Cancel. Cancel (or Esc) removes the closing point — the outline can be continued.
  Choosing an area with an empty name fills in the area's name.

## v1.4.0 — 2026-07-04 (Phase 2: room markup editor)
- The "Markup" mode in the card (the mdi:vector-square-edit button, only with a server config):
  a grid of points (60 nodes across the width), lines drawn by pairs of clicks with node snapping, a polyline preview.
- A closed outline (a click on the first point) activates "Save": choosing an HA area from a
  dropdown + a name; the room is saved as a polygon (poly, normalized vertices).
- Tools: Add (drawing), Erase line (a click on a line), Delete room
  (a click inside + confirm). The "wall" lines are stored in space.segments and reused by
  neighboring rooms (shared walls — via clicks on existing nodes).
- Room rendering: polygons on par with rectangles (hover, click into the area, LQI tooltip,
  the label at the centroid); in markup mode the outlines and names of all rooms are visible.
- Backend: ROOM_SCHEMA accepts poly (≥3 vertices) or x/y/w/h; SPACE_SCHEMA — segments.

## v1.3.0 — 2026-07-04 (Phase 1: server-side configuration)
- The `houseplan.config` Store: spaces (plan, aspect, view_box, rooms), device_overrides
  (hidden/icon/name), virtual_devices, settings (exclude_integrations, group_lights).
- WS: `houseplan/config/get|set`, `houseplan/plan/set` (plan file upload as base64 →
  `<config>/houseplan/plans/`, served through /houseplan_files/plans/).
- The card: a resolve model — the server config (coordinates NORMALIZED 0..1, render 1000×1000/aspect)
  or the legacy bundle (canvas 1489×1053). Layout v2: {device_id: {s, x, y}} normalized.
- The "To server" button in edit mode — a one-click migration of the legacy config (plans, rooms,
  view_box, layout). Performed at the dacha: .storage/houseplan.config + plans/f1.svg,f2.svg.
- Read-side support for device overrides and virtual devices (the management UI — phases 3–4).

## v1.2.2 — 2026-07-04
- The card toolbar (floor tabs) pins under the HA header while scrolling
  (`position: sticky; top: var(--header-height)`; ha-card overflow: visible).
- Incident: an intermediate build on the unstable mount produced a broken bundle that crashed the
  dashboard rendering; the rule "build only in /tmp + md5 control" was locked into DEVELOPMENT.md.

## v1.2.1 — 2026-07-04
- Icons no longer enlarge on hover/drag (transform: scale removed).

## v1.2.0 — 2026-07-03
- Room boundaries snapped to the walls of the vector plan.
- Zigbee LQI: the value under the icon, the room average in the tooltip, a red→green gradient,
  the show_signal option.
- `mdi:lock` for any devices with a lock.* entity (TTLock).
- The hallway switch: the device's area in the HA registry was fixed (it was in detskaia_elina).

## v1.1.0 — 2026-07-03
- Vector backgrounds (SVG from REMPLANNER), automatic scale/offset alignment via raster correlation.
- Icon size as a % of the plan width (container queries, default 2.5%).

## v1.0.1 — 2026-07-03
- fix: nested SVG fragments via lit svg`` (the background/rooms were not rendered).
- fix: the version taken from const instead of a blocking manifest.json read in the event loop.

## v1.0.0 — 2026-07-03
- First release: the Lovelace card (TS+Lit, no token, driven by hass) + the houseplan integration
  (WS layout storage, JS serving). The prototype's model carried over: curation, lamp groups,
  iconFor, temperature, more-info, area navigation, drag layout.
