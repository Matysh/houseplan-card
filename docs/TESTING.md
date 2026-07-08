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
- [ ] Draw-space renders an empty canvas (no black hole), markup works on it
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
- [ ] Room hover highlight still works when custom borders/fills are on
- [ ] Settings persist across reload and other browsers (server-side)

## Room markup editor ★

- [ ] Grid appears; dots snap; segments draw pair-by-pair; shared walls reused
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
- [ ] No devices at all in HA (fresh instance) → plan renders, "0 dev.", no console errors [auto]

## Device dialog (markers) ★

- [ ] Open via info card → Edit; all fields persist (name, icon, model, link, description)
- [ ] Rebind to another device/entity/helper: search filters; already-placed candidates excluded; old position cleaned up [auto backend]
- [ ] Virtual device: requires name; room required; renders dashed
- [ ] Room override moves the icon to the room center
- [ ] Tap-action override select (default/info/more-info/toggle) saves and applies
- [ ] PDF/manual upload: ok path; >25 MB → readable error; .exe → bad-ext error [auto backend]; traversal names sanitized [auto backend]
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
- [ ] Labels legible on light plans (text shadow) at min/max zoom

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
