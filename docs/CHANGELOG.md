# Changelog

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
