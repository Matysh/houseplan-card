# Manual testing checklist

> **Policy:** this checklist is updated **in the same commit** as any functional
> change (like CHANGELOG.md). Every release: run at least the smoke column on the
> synthetic demo (`demo/`), and the full list before major releases. Items marked
> `[auto]` are covered by unit tests or the headless smokes in `demo/` — they still
> deserve an occasional eyeball. File every failure as a GitHub issue before fixing.

## Environments matrix

Run the *core flows* (marked ★ below) in each environment at least once per minor release:

- [ ] Chrome / Edge (desktop, Windows or Linux)
- [ ] Firefox (desktop) — SVG viewBox math and container queries differ historically
- [ ] Safari (macOS) — pointer events / pinch behavior
- [ ] HA Companion app, Android (cold start! the v1.7.2 race lived here)
- [ ] HA Companion app, iOS
- [ ] Tablet in kiosk/panel mode (wall-tablet scenario, landscape)
- [ ] Phone portrait, narrow ≤400 px (adaptive header ≤620 px)
- [ ] Dark theme and light theme (badges, dialogs, plan contrast)
- [ ] RU profile locale and EN profile locale (+ `language:` card option forcing each)

## Installation / upgrade / removal

- [ ] Fresh install via HACS custom repository → integration appears, card auto-registers as a Lovelace resource (`?v=` matches manifest); no manual resource setup
- [ ] `single_config_entry`: adding a second entry is impossible [auto]
- [ ] Upgrade via HACS: `?v=` bumps after HA restart, browser picks the new bundle without cache clearing
- [ ] YAML-mode Lovelace: falls back to `extra_module_url` (card loads)
- [ ] Removal: delete entry → Lovelace resource entry disappears; `.storage/houseplan.*` survives; reinstall picks the old config up
- [ ] Diagnostics download works; personal fields (name/link/description/pdfs) are `**REDACTED**` [auto]

## Modes (v1.25.0) ★

- [ ] The card always loads in **View**; edit modes are never restored [auto]
- [ ] View: pan/zoom/space-switch/tap/long-press/tooltips only — dragging an icon,
      label or opening does nothing; panning may start on top of an icon [auto]
- [ ] View header: space tabs + count + zoom + mode tabs, ZERO edit buttons [auto]
- [ ] Plan: markup toolbar, space gears, +space, ⚙ palette; device icons hidden,
      labels/openings draggable; orange stage frame [auto]
- [ ] Devices: icon drag works, click opens the marker editor directly; +/👁/↺/⬡
      buttons; accent stage frame [auto]
- [ ] Mode tabs hidden for non-admin users; segmented control highlights the active mode
- [ ] Openings in View (v1.28.1): the door/window itself is a pure drawing — no
      cursor change, no hover outline, no hit target, no click, regardless of
      bindings [auto]
- [ ] The LOCK BADGE is the one exception: when a lock is bound it is shown and
      clickable in View (pointer cursor, click → door/lock info card); inert in
      Plan so it does not fight editing [auto]
- [ ] Device icons in View show a pointer cursor (no grab); grab only in the
      Devices mode [auto]
- [ ] In Plan an opening is interactive: grab cursor, hover outline, drag along
      walls, click (any tool) opens its properties [auto]

## Onboarding ★

- [ ] Empty config, HA has floors → floors-import wizard offers them sorted by level [auto]
- [ ] Wizard: uncheck all → "Create" disabled; "Start from scratch" → classic dialog
- [ ] Wizard: N floors → space dialog per floor with prefilled name and progress "i of N"; Skip skips one; Cancel aborts the whole queue [auto]
- [ ] After the last wizard space (or first manual space) → markup mode auto-opens with a toast
- [ ] Empty config, no floors → classic "New space" dialog auto-opens once per session
- [ ] All floors skipped, nothing created → empty state with "Add space" button remains usable

## Spaces ★

- [ ] Create with an image (SVG, PNG, JPG, WebP) → correct aspect, crisp at zoom (SVG)
- [ ] Oversized plan (>8 MB) → readable error toast, dialog stays open
- [ ] Create with "No image — I'll outline rooms by hand": orientation landscape/portrait/square respected [auto]; borders+names default ON [auto]
- [ ] Draw-space (no background) renders a WHITE canvas (paper-like), markup works on it; room borders/names stay legible on white [auto]
- [ ] Edit: rename; replace image; **switch image→draw detaches the plan** [auto]
- [ ] Delete space with rooms/devices → tab disappears, layout of other spaces untouched
- [ ] Display settings: borders toggle, names toggle, color picker + opacity slider live-preview after save, fill selector [auto]
- [ ] Fill "zigbee": rooms tint red→green by average LQI; rooms without zigbee stay unfilled [auto]
- [ ] Fill "lights": yellow when any light on, grey when all off, unfilled when the room has no lights [auto]; toggling a light from the plan recolors the room
- [ ] Fill "temperature": blue below the comfort range, green inside, yellow above [auto]; comfort bounds editable inline on the radio row (swapped bounds tolerated [auto], clearing a field cannot zero a bound [auto]); rooms without a temperature reading stay unfilled [auto]
- [ ] Fill mode is a radio group (no dropdown); labels carry no color legend
- [ ] Room hover darkens the current fill (no recolor to blue); unfilled rooms hover light grey
- [ ] Room tooltip shows the average room temperature when any thermometer reports [auto]
- [ ] Average room temperature counts ONLY thermometer/air-monitor devices — fridges, TRV heads,
      smart-plug chip temperatures (`*_device_temperature`) and diagnostic-category temps are excluded [auto]
- [ ] Space dialog is 500 px wide; the comfort-bounds inputs are compact (56 px)
- [ ] The scale (cm per cell) input is compact (72 px), not full-width [auto]
- [ ] General settings (⚙ in the header): fill colors grouped by mode (lights on/off/none,
      temp cold/comfy/hot, LQI weak/strong), each with its own opacity slider [auto];
      Reset restores defaults; saving defaults stores nothing [auto]
- [ ] Custom fill colors apply to the full card AND the static space-card
- [ ] LQI gradient interpolates between the configured weak/strong colors [auto]
- [ ] Per-space "Show zigbee signal (LQI)" toggle hides/shows the badges next to
      devices and the signal line in room tooltips for that space only [auto]
- [ ] Device icon badge is centred exactly on its point (no 1 px down-right drift) [auto]
- [ ] Device glyph is centred within its badge (no vertical drift — real ha-icon is block+line-height) [auto]
- [ ] Room hover highlight still works when custom borders/fills are on
- [ ] Settings persist across reload and other browsers (server-side)

## Room markup editor ★

- [ ] Grid appears; dots snap; the outline draws pair-by-pair; shared walls reused
- [ ] Ruler: while drawing, the length of the current segment follows the cursor
      (metres, or feet+inches on an imperial HA); scale = space "cm per cell" (default 5)
- [ ] A line cannot exist on its own: start an outline, do NOT close it, leave markup —
      no lines are left behind (nothing was written to the config)
- [ ] Deleting a room removes its walls, EXCEPT those shared with a neighbouring room
      (the neighbour still yields them); deleting the neighbour too removes them as well
- [ ] There is no "Erase" tool in the markup toolbar (removed in v1.19.0)
- [ ] Rooms never overlap (v1.20.0): a click strictly inside an existing room is refused with a
      toast; a click ON a shared wall (including mid-span of a longer neighbour wall) still works
- [ ] Closing an outline drawn AROUND an existing room is refused; the outline stays open
- [ ] Merge (v1.21.0): two rooms sharing a wall merge into one; the dialog picks the surviving
      name/area; rooms touching only at a corner or apart are refused with a toast
- [ ] Split (v1.21.0): click a room, then two points on its walls — the bigger part keeps the
      name/area/devices, the smaller opens the new-room dialog; Cancel leaves the room whole
- [ ] Split: a cut with an end off the wall, or along a wall, is refused with a toast
- [ ] Split: the click snaps to the nearest wall, so it works on non-grid-aligned rooms
      (imported/legacy polygons), not only on rooms drawn on the current grid [auto]
- [ ] Split: a click far from any wall (middle of the room) is a miss with a toast —
      the wall-snap pull is capped, accidental clicks do not pick a wall [auto]
- [ ] Esc / Ctrl+Z removes the last dot (and its line); Reset clears the path
- [ ] Closing the contour (click the first dot, ≥4 points) opens the room dialog
- [ ] Room dialog: area list shows only unassigned areas; picking an area prefills the name
- [ ] "No area" room (decorative) requires a name; saves with `area: null`
- [ ] Cancel in the dialog reopens the contour (last point undone)
- [ ] Saving a room with an area: area devices appear with icons; positions are fixed into the layout [auto]
- [ ] Erase tool removes exactly the clicked line; Delete-room removes the polygon after confirm
- [ ] Device icons hidden during markup; visible again on exit

## Devices on the plan ★

- [ ] Auto devices appear only in rooms bound to their area [auto]
- [ ] Curation hides bridges/groups/scenes/excluded integrations; 👁 "show all" reveals [auto]
- [ ] Duplicate "name|area" numbered ("Lamp", "Lamp 2") [auto]
- [ ] Light groups fold their single lamps; `group_lights=false` unfolds [auto]
- [ ] Drag anywhere (no edit mode), snaps to grid, persists after reload, per space
- [ ] ↺ reset restores auto layout after confirm
- [ ] Temperature badge on thermometers; LQI value under zigbee icons with red→green color
- [ ] Live states: light on = yellow, open cover/lock/door = orange, unavailable = faded
- [ ] State icons (v1.26.0): auto icons morph with state — door/window/garage open↔closed,
      lock locked↔unlocked, bulb on; custom icons and unavailable states never morph [auto]
- [ ] display "Value instead of an icon": the marker shows the measurement (°/%/unit)
      as its body, small badges hidden; non-numeric fallback keeps the icon [auto]
- [ ] RGB lights (v1.27.0): an on light with a color tints its icon/glow and the ripple
      (explicit ripple color still wins); off/white lights unchanged [auto]
- [ ] Alarm pulse (v1.27.0): leak/smoke/gas/CO/siren in 'on' pulse a red ring over any
      display mode; clears on 'off'; unavailable never alarms [auto]; reduced-motion static
- [ ] Space gear (v1.30.1): the cog next to the space name is visible in every
      mode (admins only), vertically centered with the tab text; clicking it
      opens space settings without switching the tab; "+" tab stays Plan-only [auto]
- [ ] Lock action (v1.30.0): opening info card (View) shows Unlock (red) when
      locked / Lock when unlocked; button calls the lock service; disabled while
      locking/unlocking; hidden when unavailable; plan-icon tap still never
      toggles a lock [auto]
- [ ] New-device flag (v1.29.0): a device added to HA after install gets a big red
      dot top-right of its icon (all clients); opening its editor clears it
      everywhere; upgrade/first-run seeds the baseline silently — no dot flood [auto]
- [ ] No devices at all in HA (fresh instance) → plan renders, "0 dev.", no console errors [auto]

## Device dialog (markers) ★

- [ ] Open via info card → Edit; all fields persist (name, icon, model, link, description)
- [ ] Rebind to another device/entity/helper: search filters; already-placed candidates excluded; old position cleaned up [auto backend]
- [ ] Virtual device: requires name; room required; renders dashed
- [ ] Sub-area rooms (v1.28.0): a room WITHOUT an HA area appears in the marker
      room list ("no area, manual"); a device placed there lands at its centre,
      the marker stores room_id, reopening the dialog restores the choice [auto]
- [ ] Room override moves the icon to the room center
- [ ] Tap-action override select (default/info/more-info/toggle) saves and applies
- [ ] PDF/manual upload: ok path; >50 MB → readable error; .exe → bad-ext error [auto backend]; traversal names sanitized [auto backend]
- [ ] `javascript:` in the link field is not rendered as a clickable link [auto]
- [ ] Remove: auto device → hidden marker (reappears via dialog "show all"? no — stays hidden until re-added); virtual → gone incl. its layout entry [auto backend]

## Icon rules ★

- [ ] ⬡ opens the editor with current rules (defaults if none saved)
- [ ] Test field resolves live; add/delete/reorder rows; first match wins [auto]
- [ ] Invalid regex highlights red and is skipped at runtime (other rules still work) [auto]
- [ ] Reset to defaults; saving defaults stores nothing (settings key removed) [auto]
- [ ] Custom rules re-icon existing devices immediately; per-device icon override still wins; lock devices keep mdi:lock [auto]
- [ ] Rules survive reload; second browser sees them after live-sync

## Tap actions & gestures ★

- [ ] Default: tap → info card; card option `toggle`: tap toggles lights/switches/fans/humidifiers only [auto]
- [ ] Locks/alarms never toggle, even with per-device override [auto]; covers/valves toggle only with explicit per-device override [auto]
- [ ] Long-press (600 ms) always opens the info card, also when tap=toggle [auto]
- [ ] Drag > 3 px cancels both tap and long-press; pinch/pan never triggers taps
- [ ] `pointercancel` (touch interrupted) does not leave a phantom info card [auto]

## Zoom / pan / labels

- [ ] Wheel zoom at cursor; +/− buttons; fit button resets; badge shows %
- [ ] Pinch zoom + two-finger pan on touch; one-finger pan when zoomed
- [ ] Zoom level persists per space (localStorage), restored on reload
- [ ] Window resize / sidebar collapse refits without distortion
- [ ] Room name labels: default at room center; dragging moves and persists (server layout, `rl_*`) [auto]; hidden in markup mode
- [ ] Labels legible on light and dark plans (no text shadow) at min/max zoom

## Multi-client & concurrency ★

- [ ] Two browser tabs: drag in A → position appears in B without reload (live event)
- [ ] Config edit collision: stale tab saving gets a conflict toast, auto-resyncs, retry works [auto backend]
- [ ] Point layout updates from two windows don't overwrite each other's icons [auto backend]
- [ ] `admin_only` ON: non-admin user gets readable "administrators only" errors on every write path

## Edge cases

- [ ] HA instance with zero devices/areas → onboarding works, rooms can be drawn, no crashes [auto]
- [ ] Space with zero rooms → renders; markup hint visible
- [ ] Room without area + borders ON → drawn, click does nothing, no area tooltip signal
- [ ] No zigbee devices anywhere → no LQI badges, lqi fill leaves all rooms unfilled [auto]
- [ ] 100+ devices in one space → build under ~50 ms [auto], drag stays smooth
- [ ] Very long device/room names → ellipsis/wrap, no layout explosion
- [ ] HTML/emoji in names (`<b>xss</b>`, 🚿) → rendered as text, never as markup [auto]
- [ ] Plan file deleted from disk → Repairs issue appears after config save/restart; re-upload clears it [auto backend]
- [ ] Corrupted `.storage/houseplan.config` → entry retries (ConfigEntryNotReady), no crash loop [auto backend]
- [ ] HA restart while a dialog is open → next save gets a clean error/conflict, no data loss
- [ ] Legacy layout entries (v1 {x,y} without space) are ignored gracefully
- [ ] Kiosk cold start on mobile app: card defined before dashboard render (resource registration)

## Release regression quickies

- [ ] Browser console has zero errors from houseplan-card.js on: dashboard load, markup, dialogs, zoom
- [ ] HA log has zero houseplan errors/warnings after restart
- [ ] `npm test` (frontend), `pytest tests_backend` (pure), CI HA-harness — all green
- [ ] README screenshots/GIF still match the current UI (synthetic home only)

---

## Last self-run

**v1.21.1 (2026-07-16), full audit of v1.16–v1.21.** All `[auto]` items pass (73 frontend
tests, 12 backend). New smokes on the synthetic home: `smoke_merge_split` (merge fuses
adjacent rooms keeping the survivor's id; non-adjacent refused with a toast; split creates
the new room, cancel keeps the room whole, along-wall cut refused) and `smoke_split_nonsnap`.
Finding turned into a fix (shipped this release): **Split required the click to land on a grid
node**, so it silently failed on rooms whose walls are not grid-aligned (imported/legacy
polygons) — the click now snaps to the nearest wall instead of the grid, and `splitRoom()`
still rejects a bad cut. README (en+ru) gained the merge/split/ruler/scale documentation it
was missing. The earlier self-run record follows.

**v1.14.0 (2026-07-06), headless demo harness + unit suites.** All `[auto]` items pass
(43 frontend tests, 11 pure + 12 HA-harness backend tests, `smoke_space_settings`,
tap/hold/wizard/rules smokes). Bugs found during the run, fixed in the same release:
1. Edit dialog: switching an existing space from image to "draw" kept the old
   background (`plan_url` not detached) — fixed.
2. `_stateClass` crashed on state objects without `entity_id` (domain is now
   derived from `d.primary`, which the state was looked up by) — fixed; found by
   the 150-device perf item of this checklist.
3. Perf item measured: 162 devices build in ~14 ms, re-render ~1 ms — well within budget.
4. (earlier rounds) long-press phantom after `pointercancel`; `_saveConfigNow`
   conflict without resync — fixed in v1.13.2.
Unchecked boxes above (real browsers/devices, multi-tab live sync, Companion apps)
require hands on real hardware — they remain for the human pass.

## houseplan-space-card (read-only embedded)
- [ ] `type: custom:houseplan-space-card, space: <id>` renders the space identical to the full
      card's plan (background + configured borders/names + room fills + icons), no header/controls [auto]
- [ ] The schematic is fully non-interactive: click/hover anywhere does nothing — no more-info,
      no tooltip, no drag (`.hp-static-stage` is pointer-events:none) [auto]
- [ ] Footer button opens the full component already showing that space (deep-link `#space=<id>`) [auto]
- [ ] Several cards with different `space` coexist on one board; one shared config WS request
- [ ] Unknown `space` → tidy error card [auto]
- [ ] `show_button: false` hides the footer
- [ ] Full card honours `#space=<id>` on load and on hashchange; invalid id ignored [auto]

## Presence ripples / per-device icon (v1.22.0)

- [ ] Marker dialog → Display = "Ripple only": the icon badge disappears, rings pulse while the
      entity is on, and collapse to a faint dot when it goes off
- [ ] Display = "Icon + ripple": both the icon and the rings are drawn
- [ ] Ripple colour and size (×2..×8) apply per device
- [ ] An entity going `unavailable` stops the pulsing (idle dot), never leaves it running
- [ ] Icon size ×0.5..×3 and rotation 0..350° apply per device; the temp/humidity badges
      scale with the icon
- [ ] Ripples still work with the card-wide "live states" toggle OFF (they are opt-in per device)
- [ ] With OS "reduce motion" enabled, rings do not animate

## Doors & windows (v1.23.0)

- [ ] Markup → "Opening": a click away from any wall shows a toast; near a wall — the dialog
- [ ] A door placed on a wall renders jambs + leaf + swing arc at the wall's angle; length in cm
      matches the ruler/scale of the space
- [ ] Bind a contact sensor: open → leaf swings and the arc draws on in the accent colour;
      closed → leaf lies along the wall, arc hidden; invert flips this
- [ ] Sensor unavailable → the opening freezes at its static default (door open / window closed)
- [ ] A door with a lock shows the padlock badge: green locked / orange unlocked / grey unknown
- [ ] Clicking an opening (or the padlock) in view mode opens the info card with both states;
      the lock can NOT be toggled from the plan
- [ ] Flip toggles mirror the hinge side and the swing side
- [ ] Click an existing opening with the tool → edit dialog; Delete removes it
- [ ] (v1.23.1) Hovering an opening in view mode shows the accent outline + grab cursor
- [ ] Dragging an opening slides it along walls (re-snapping, incl. around corners) and saves
      on release; dragging far away from walls leaves it in place; hinge does not flip while
      crossing wall-segment boundaries
- [ ] Single click still opens the status card; double click opens the properties dialog;
      a drag does NOT open either
