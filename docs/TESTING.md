# Manual testing checklist

> **Policy:** this checklist is updated **in the same commit** as any functional
> change (like CHANGELOG.md). For a pre-release, build the production bundle and
> run the smallest unit/smoke subset that covers its changed surfaces. Run the
> complete local frontend, backend and smoke gates only before a stable release.
> The exact-SHA GitHub Validate remains mandatory for publication. Items marked
> `[manual]` are covered by unit tests or the headless smokes in `demo/` — they still
> deserve an occasional eyeball. File every failure as a GitHub issue before fixing.

> **What `[manual]` means (since 2026-07-27).** A named check exists that FAILS
> when the behaviour breaks — in `npm test` or in the smoke suite, both of which
> run in CI on every push. Where the check lives is written next to the marker
> (`[auto: smoke_modes]`). Before this date the marker described an intention:
> the smoke suite printed values and always exited 0, so 96 markers guarded
> nothing (external audit T1/T3). If you add a checklist line marked `[manual]`,
> add the failing check in the same commit.

> **⚠ Rule: a new scrollable list inside a dialog is tested by GEOMETRY, never
> by the DOM.** Any new scrolling box or `overflow` container added to a dialog
> MUST get a smoke that measures **the container's own height and the visible
> position of its first item** (`getBoundingClientRect`, and the item's rect
> against the box's rect) — counting rendered rows, or asserting that the nodes
> exist, proves nothing. The failure mode is always the same and always
> invisible to a DOM check: a scrolling box is a flex item whose automatic
> minimum size is zero (`min-height: auto` → 0 for an `overflow` child), and a
> dialog body is a flex column with a height cap, so the box is the one child
> that can be squeezed to a sliver while every row inside it renders happily.
> It has bitten us twice already: the **target search results** in the tap
> action dialog (v1.53.1 — 26 matching automations rendered into a 1 px
> stripe; the smoke counted rows and passed) and the **«Already uploaded»**
> plan picker (dev, unreleased — rows present, box 14 px tall, same story).
> Both smokes measure heights now; write the third one that way from the start.

## HA-disabled binding gate

The source-of-truth matrix is
`docs/superpowers/specs/2026-08-08-ha-disabled-devices-design.md` §17.
`test/ha-binding-status.test.mjs` covers full/limited registry decisions and
the active-only state projection. The standalone demo exposes complete
`disabled_by` rows through both registry list WS commands plus
`window.__setRegistryDisabled(kind, id, disabledBy)` and
`window.__setRegistryAccess(mode)` for browser scenarios.

- [ ] A saved device/entity marker disappears from View, room data, Glow,
      controls, live text, openings and vacuum overlays after its registry row
      becomes disabled; config/layout remain byte-for-byte unchanged.
- [ ] Device editor → Hidden and disabled shows a labelled grey ghost. Show is
      refused, metadata/Delete/Open in HA remain available, and the ghost is
      not draggable.
- [ ] Reactivating the same ID restores its metadata/layout without a false
      new-device event; an explicitly user-hidden marker stays hidden.
- [ ] A never-seen auto device disabled before discovery appears as new only
      after its first activation.
- [ ] All disabled child entities make an otherwise active device disabled;
      one disabled auxiliary entity never suppresses active functional rows.
- [ ] If full registry WS access is denied, positive live evidence stays
      active, an unknown binding is `unverified`, and no false disabled/orphaned
      ghost or service call is produced.
- [ ] Two full cards plus a static space card share one registry fetch and one
      subscription pair per HA connection; registry events invalidate all of
      them without a reload.
- [ ] `houseplanDiagnostics()` reports only redacted registry access/age/error
      and binding-status counts; it contains no names, states or marker data.

## Device display preview and face parity

The behaviour matrix is defined in
`docs/superpowers/specs/2026-08-08-device-display-preview-design.md` §22.
Pure source/value/presentation rules live in `test/device-presentation.test.mjs`.
`demo/smoke_device_preview_parity.mjs` compares the same live fixture across
the interactive plan, `hp-device-preview` and `houseplan-space-card`, including
semantic classes, icon/value/badges, scale variables, provider text and the
public binding-status hook.

- [ ] Every binding/display/icon/size/angle/control/temperature draft change
      updates the preview before Save; Cancel writes neither config nor layout.
- [ ] Working, open, cover, presence, short event, transition, alarm, static,
      unavailable, media-neutral, composite-Power and `live_states: false`
      explanations match the actual face.
- [ ] The local activity demo lasts 3.3 seconds, sends no service call, survives
      reduced motion as a static ring, and resets immediately on binding change,
      real activity or alarm.
- [ ] Provider metadata is cached between dialog openings and refreshed after
      registry/config-entry changes; source integrations remain separate from
      the binding provider.
- [ ] Long provider/source/state text wraps without horizontal scroll; maximum
      marker/ripple size fits the stage and reports its preview scale.
- [ ] Derived temperature/humidity values keep the compact plan form (`22.4°`,
      `48%`), while a direct entity value continues to use HA localization and
      units.

## Touch support and release gates

The product contract is defined in `docs/TOUCH-SUPPORT.md`:

| Surface | Touch release status |
|---|---|
| View and View dialogs/actions | Required and release-blocking |
| Kiosk/wall tablet | Required and release-blocking |
| Editor entry/exit and no accidental mutation during multi-touch | Safety floor; release-blocking |
| Feature parity of Plan/Device/Background editors | Best effort; not a general release gate |

All editors remain fully tested on desktop with mouse/keyboard. A touch-editor
failure may be accepted only as a deliberate scope change with updated user
documentation and test classification in the same change. “Best effort” cannot
be used to waive data corruption, unsafe service calls, permission failures,
missing destructive confirmation or an editor exception that breaks View.

- [ ] Smoke harness itself (v1.43.2, audit T1/T2): every smoke asserts named
      facts via `check`/`checkAll` and exits non-zero on any mismatch or
      uncaught in-card exception; the suite runs in CI against a FRESHLY built
      bundle. Sanity ritual: break one invariant on purpose (e.g. remove the
      kiosk editor guard) and confirm the matching smoke goes red [auto: CI job "smoke"]

- [ ] Room gear discoverability (v1.43.3, user feedback): in the Plan editor
      every room card carries a pill button "⚙ Room" of a FIXED readable size
      (independent of the card font) — including rooms without a name; it opens
      Room settings [auto: smoke_feedback_v2]
- [ ] Metrics readability (v1.43.3): the metrics line is 0.75 of the room name
      (was 0.62 — unreadable on tablets); per-room sliders still apply on top [auto: smoke_feedback_v2]
- [ ] Touch tooltips, take two (v1.43.3): a hover tooltip never appears after
      ANY touch/pen pointer event, even if the browser claims `hover: hover`
      (stylus, paired mouse, vendor skins) [auto: smoke_feedback_v2]

- [ ] Light-source flag (v1.44.0, user feedback): a smart SWITCH driving dumb
      fixtures creates a Glow pool only once "This device is a
      light source" is ticked. External targets under "Controls" still feed
      group state/statistics but never create a pool at the switch coordinates;
      unticked devices without a light entity never glow [auto: smoke_glow]
- [ ] Device card controls (v1.44.0): the device card opens with its
      controllable entities FIRST — toggles right there (≥30 px tap targets),
      cover/lock/climate open HA more-info; model, links and manuals moved
      below; config/diagnostic entities are not listed; locks never toggle from
      the card [auto: smoke_card_controls]

- [ ] Lock invariant, all paths (v1.44.2, review CR-1): icon tap, controls[],
      device card and _cardToggle refuse locks/alarm panels entirely; the door
      card's Unlock asks for confirmation, Lock does not [auto: smoke_lock_invariant]
- [ ] Attachment migration is transactional (v1.44.2, review CR-2/CR-3):
      rebinding COPIES files, saves the config, and only then deletes the old
      folder; a rejected save leaves the old files and urls intact; a name
      collision in the destination gets a unique name (the pre-existing file is
      never silently linked); urls are rewritten only for confirmed copies
      [auto: unit logic.test + tests_backend]

- [ ] Plans and PDFs load in a real browser (v1.44.3, B1 regression): open a
      dashboard with an uploaded plan — the background renders and a manual link
      opens; DevTools shows /api/houseplan/content/... returning 200 via a
      signed url, while the same url without authSig returns 401
      [auto: tests_backend + manual]
- [ ] Auth policy is single-sourced (v1.44.4, B2): the HTTP upload and every WS
      write use the same `may_write`, which denies non-admins when the config
      entry is unavailable [auto: tests_backend]
- [ ] Coordinates and caps (v1.44.4, B5): NaN/Infinity are refused on room
      rects, polygon vertices, view_box and openings — not only in layout; the
      openings list honours MAX_OPENINGS [auto: tests_backend]
- [ ] Drag hardening (v1.44.4, L4 sub-item): every drag pipeline captures the
      pointer through the tolerant helper; decor follows the infinite canvas
      and stops only at the shared normalized ±5000 garbage bound
      [auto: smoke_decor, smoke_drag_bounds]

- [ ] Room climate counts hidden sensors (v1.44.5): a thermometer that is NOT
      placed on the plan (hidden by filtering or by the user) still feeds the
      room card, the tooltip and the temperature fill; fridges/TRVs still do
      not; an explicit per-room source still wins [auto: unit devices.test]
- [ ] Room hover + tooltip: in View, hovering any room visibly highlights it
      (filled, transparent and area-less alike) and shows its name plus clean-
      floor area; temperature/signal follow when available. Thick walls reduce
      the area to the inner contour. Editors do neither [auto: smoke_ux_fixes;
      manual visual]

## Environments matrix

Run View/kiosk core flows in every applicable touch environment. Run editor core
flows in desktop environments; touch editors only need the safety floor and
separately promised workflows:

- [ ] Chrome / Edge (desktop, Windows or Linux) — View + all editors
- [ ] Firefox (desktop) — View + all editors; SVG viewBox math and container queries differ historically
- [ ] Safari (macOS) — View + all editors; pointer events / pinch behavior
- [ ] HA Companion app, Android — View only as the parity contract; cold start is mandatory
- [ ] HA Companion app, iOS — View only as the parity contract
- [ ] Tablet in kiosk/panel mode — View/kiosk, landscape, touch gestures
- [ ] Phone portrait, narrow ≤400 px — View and View dialogs/actions
- [ ] Dark theme and light theme (badges, dialogs, plan contrast)
- [ ] RU profile locale and EN profile locale (+ `language:` card option forcing each)

## Installation / upgrade / removal

- [ ] Fresh install via HACS custom repository → integration appears, card auto-registers as a Lovelace resource (`?v=` matches manifest); no manual resource setup
- [ ] `single_config_entry`: adding a second entry is impossible [manual]
- [ ] Upgrade via HACS: `?v=` bumps after HA restart, browser picks the new bundle without cache clearing
- [ ] YAML-mode Lovelace: falls back to `extra_module_url` (card loads)
- [ ] Removal: delete entry → Lovelace resource entry disappears; `.storage/houseplan.*` survives; reinstall picks the old config up
- [ ] Diagnostics download works; personal fields (name/link/description/pdfs) are `**REDACTED**` [manual]

## Modes (v1.25.0) ★

- [ ] The card always loads in **View**; edit modes are never restored [manual]
- [ ] View: pan/zoom/space-switch/tap/long-press/tooltips only — dragging an icon,
      label or opening does nothing; panning may start on top of an icon [manual]
- [ ] View header: space tabs + count + zoom + editor tabs, the general-settings
      cog and the per-space gears (visible in EVERY mode since v1.30.1/v1.30.3
      for users who may edit); no editor toolbars [auto: smoke_modes]
- [ ] Plan: markup toolbar, space gears, +space, ⚙ palette; device icons hidden,
      labels/openings draggable; orange stage frame [manual]
- [ ] Devices: icon drag works, click opens the marker editor directly; +/👁/↺/⬡
      buttons; accent stage frame [manual]
- [ ] Mode tabs hidden for non-admin users; segmented control highlights the active mode
- [ ] Openings in View (v1.28.1+): the door/window/gate itself is a pure drawing — no
      cursor change, no hover outline, no hit target, no click, regardless of
      bindings [manual]
- [ ] The LOCK BADGE is the one exception: when a lock is bound it is shown and
      clickable in View (pointer cursor, click → door/lock info card); inert in
      Plan so it does not fight editing [manual]
- [ ] Device icons in View show a pointer cursor (no grab); grab only in the
      Devices mode [manual]
- [ ] In Plan an opening is interactive: grab cursor, hover outline, drag along
      walls, click (any tool) opens its properties — with a 3 px drag threshold
      since v1.43.1, so a tap is never swallowed [auto: smoke_inert_openings]
- [ ] Opening drag rulers (2026-08-03): while an opening is dragged, a measure
      badge on EACH shoulder shows the along-the-wall distance from the wall end
      to the nearest opening edge, live; the wall is ONE room's edge — the edge
      the opening is snapped to — so a neighbouring room's collinear edge is
      never merged in; at that edge's center (±half a grid step) a
      perpendicular dashed tick appears and the center magnet-snaps; there is
      no modifier that disables the magnet; badges and tick vanish on release
      [auto: smoke_opening_measure + unit openingShoulders]
- [ ] The SAME rulers while PLACING a new opening (2026-08-03): with the
      Opening tool, moving along a wall shows the dashed ghost together with a
      badge on each shoulder of the would-be opening (default 90 cm, measured
      on the snapped room's OWN edge), a perpendicular tick + magnet at that
      edge's centre; the click places the opening at the
      magnetised point and ghost, badges and tick all disappear at once
      [auto: smoke_opening_measure, the «PLACING a new opening» section]

## Onboarding ★

- [ ] Empty config, HA has floors → floors-import wizard offers them sorted by level [manual]
- [ ] Wizard: uncheck all → "Create" disabled; "Start from scratch" → classic dialog
- [ ] Wizard: N floors → space dialog per floor with prefilled name and progress "i of N"; Skip skips one; Cancel aborts the whole queue [manual]
- [ ] After the last wizard space (or first manual space) → markup mode auto-opens with a toast
- [ ] Empty config, no floors → classic "New space" dialog auto-opens once per session
- [ ] All floors skipped, nothing created → empty state with "Add space" button remains usable

## Spaces ★

- [ ] Create with an image (SVG, PNG, JPG, WebP) → correct aspect, crisp at zoom (SVG)
- [ ] Oversized plan (>8 MB) → readable error toast, dialog stays open
- [ ] Create with "No image — I'll outline rooms by hand": orientation landscape/portrait/square respected [manual]; borders+names default ON [manual]
- [ ] Draw-space (no background) renders a WHITE canvas (paper-like), markup works on it; room borders/names stay legible on white [manual]
- [ ] Edit: rename; replace image; **switch image→draw detaches the plan** [manual]
- [ ] Delete space with rooms/devices → tab disappears, layout of other spaces untouched
- [ ] Display settings: borders toggle, names toggle, color picker + opacity slider live-preview after save, fill selector [manual]
- [ ] Fill "zigbee": rooms tint red→green by average LQI; rooms without zigbee stay unfilled [manual]
- [ ] Fill "lights": yellow when any light on, grey when all off, unfilled when the room has no lights [manual]; toggling a light from the plan recolors the room
- [ ] Fill "temperature": blue below the comfort range, green inside, yellow above [manual]; comfort bounds editable inline on the radio row (swapped bounds tolerated [manual], clearing a field cannot zero a bound [manual]); rooms without a temperature reading stay unfilled [manual]
- [ ] Fill mode is a radio group (no dropdown); labels carry no color legend
- [ ] Room hover darkens the current fill (no recolor to blue); unfilled rooms hover light grey
- [ ] Room tooltip shows the average room temperature when any thermometer reports [manual]
- [ ] Average room temperature counts ONLY thermometer/air-monitor devices — fridges, TRV heads,
      smart-plug chip temperatures (`*_device_temperature`) and diagnostic-category temps are excluded [manual]
- [ ] Space dialog is 500 px wide; the comfort-bounds inputs are compact (56 px)
- [ ] The scale (cm per cell) input is compact (72 px), not full-width [manual]
- [ ] General settings (⚙ in the header): fill colors grouped by mode (lights on/off/none,
      temp cold/comfy/hot, LQI weak/strong), each with its own opacity slider [manual];
      Reset restores defaults; saving defaults stores nothing [manual]
- [ ] Custom fill colors apply to the full card AND the static space-card
- [ ] LQI gradient interpolates between the configured weak/strong colors [manual]
- [ ] Per-space "Show zigbee signal (LQI)" toggle hides/shows the badges next to
      devices and the signal line in room tooltips for that space only [manual]
- [ ] Device icon badge is centred exactly on its point (no 1 px down-right drift) [manual]
- [ ] Device glyph is centred within its badge (no vertical drift — real ha-icon is block+line-height) [manual]
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
      (imported/legacy polygons), not only on rooms drawn on the current grid [manual]
- [ ] Split: a click far from any wall (middle of the room) is a miss with a toast —
      the wall-snap pull is capped, accidental clicks do not pick a wall [manual]
- [ ] Esc / Ctrl+Z removes the last dot (and its line); Reset clears the path
- [ ] Closing the contour (click the first dot, ≥4 points) opens the room dialog
- [ ] Ctrl/Cmd+click closes the current endpoint back to the first point without
      adding another vertex. It requires at least two existing edges and refuses
      degenerate or self-intersecting closure [auto: smoke_editor_tabs]
- [ ] Room dialog: area list shows only unassigned areas; picking an area prefills the name
- [ ] Room dialog uses the medium width and its body has no horizontal overflow;
      long options stay inside it at desktop and narrow widths [auto:
      smoke_editor_tabs; manual: narrow viewport]
- [ ] "No area" room (decorative) requires a name; saves with `area: null`
- [ ] Cancel in the dialog reopens the contour (last point undone)
- [ ] Saving a room with an area: area devices appear with icons; positions are fixed into the layout [manual]
- [ ] Erase tool removes exactly the clicked line; Delete-room removes the polygon after confirm
- [ ] Device icons hidden during markup; visible again on exit

## Devices on the plan ★

- [ ] Auto devices appear only in rooms bound to their area [manual]
- [ ] Filtering hides bridges/groups/scenes/excluded integrations; 👁 "show all" reveals [manual]
- [ ] Duplicate "name|area" numbered ("Lamp", "Lamp 2") [manual]
- [ ] Light groups fold their single lamps; `group_lights=false` unfolds [manual]
- [ ] Drag anywhere (no edit mode), snaps to grid, persists after reload, per space
- [ ] ↺ reset restores auto layout after confirm
- [ ] Temperature badge on thermometers; LQI value under zigbee icons with red→green color
- [ ] Unified live states (dev, owner 2026-08-05): actual work is yellow;
      open door/window, unlocked lock and open valve are orange; covers stay
      neutral and morph their icon; unavailable is faded. The plate and the
      activity effect come from the same semantic resolver
- [ ] State icons (v1.26.0): auto icons morph with state — door/window/garage open↔closed,
      lock locked↔unlocked, bulb on; custom icons and unavailable states never morph [manual]
- [ ] display "Value instead of an icon": the marker shows the measurement (°/%/unit)
      as its body, small badges hidden; non-numeric fallback keeps the icon [manual]
- [ ] RGB lights (v1.27.0, contract changed in v1.52.0): a lamp's colour lives
      in its glow spot and the activity-effect fallback ONLY — the icon/badge/border get
      no RGB tint; explicit activity color still wins; off lights unchanged
      [auto: smoke_light_badges + smoke_rgb_alarm]
- [ ] Alarm pulse (v1.27.0, unified dev): leak/smoke/gas/CO/siren in `on`
      and an alarm control panel in `triggered`
      get a red plate and red pulse over every dynamic display mode and even
      with ordinary live-state dressing off; `static_icon` is the deliberate
      neutral exception after an editor warning; clears on 'off'; unavailable
      never alarms [manual]; reduced-motion is static
- [ ] Render cost (v1.43.1, audit L1): geometry (space model, open pairs) is
      computed once per config change, not per HA state push — smoke asserts
      zero recomputations across 10 state pushes and recomputation after an
      edit; the plan still renders dashes/islands correctly [auto: smoke_render_perf]
- [ ] Opening tap vs drag (v1.43.1, audit L4): a tap on a door in the Plan
      editor opens its properties (3 px threshold like the other pipelines) and
      writes nothing; a real drag that ends where it started also writes nothing [auto: smoke_render_perf]
- [ ] Concave containment (v1.43.1, audit G2): an island room inside a U- or
      L-shaped parent is accepted and punches the evenodd hole; a traced
      duplicate outline is still NOT containment [auto: smoke_inert_openings]
- [ ] Backend hardening (v1.43.1, audit B2-B5): the admin check fails closed
      when the entry is unavailable; layout/set honours expected_rev; a
      config/set without expected_rev over a non-empty store logs a warning;
      NaN/Infinity coordinates and oversized collections are rejected [auto: unit: logic.test]
- [ ] Save race (v1.43.0, audit L2): make a markup edit, then press Save in any
      dialog within 500 ms (or let another client save) — the markup edit must
      survive and reach the server; a failed reload now shows a toast [auto: unit: tests_backend]
- [ ] Niche split (v1.43.0, audit G1): a cut that starts AND ends on the same
      wall carves a niche; the two parts' areas must sum to the original (the
      invariant is enforced in code and asserted for every split test) [auto: smoke_save_race]
- [ ] Authenticated content (v1.43.0, audit B1): plan images and marker files
      are only reachable through /api/houseplan/content/… with a session; the
      old /houseplan_files/plans|files paths return 404 after a restart; old
      stored URLs keep working (rewritten on read) [auto+manual]
- [ ] Every editor option is storable (v1.45.3, issue #3): set a sensor to
      "value instead of an icon" and save — no validation error, the value shows
      on the plan after a reload. Same for each tap action and each fill mode
      [auto: backend test_every_display_mode_the_editor_offers_is_accepted and
      neighbours, test_a_marker_showing_its_value_can_be_saved]
- [ ] Room settings button (dev): detached from the (movable) name label —
      always at the room's geometric centre, one button-height below it; sized
      at 70% of a device icon and zooming WITH the plan; the small metric rows
      under the room name now show in the plan editor too
      [auto: smoke_room_cards gearDetached/plainInPlan]
- [ ] Working plate remains universal: in a source-glow space a lit lamp or
      other actually working device stays yellow in View and in every editor;
      the glow pool is an additional spatial indicator, not a replacement
      [auto: smoke_light_badges]
- [ ] Size/angle parity (v1.52.1, HP-1513-01): a marker with size 3 / angle 37
      scales x3 and rotates on BOTH cards [auto: smoke_size_angle_parity]
- [ ] Tap runs an automation (dev, owner's spec 2026-07-29): the tap-action
      list has "Run automation/script/scene" with a searchable picker; saving
      without a target is refused; the confirm checkbox guards toggle AND run
      (our dialog, Esc/cancel = no call); automation.trigger / script.turn_on /
      scene.turn_on per domain; a deleted target toasts and calls nothing;
      covers/valves joined the card-wide toggle EXCEPT garage/door/gate
      device classes (explicit per-device toggle still works for them)
      [auto: smoke_tap_run + unit resolveTapAction/runServiceFor + backend
      test_run_target_is_bounded_to_runnable_domains]
- [ ] Tap opens/closes a cover (dev, owner's spec 2026-08-03): the tap-action
      list gains "Open/close (curtains/blinds)" — offered ONLY when the binding
      has a cover entity, and never for the guarded classes garage/door/gate
      (a value smuggled into the config there degrades to the info card).
      closed -> cover.open_cover, open (incl. ajar) -> cover.close_cover,
      opening/closing -> cover.stop_cover, no readable state -> cover.toggle;
      the «ask for confirmation» checkbox guards it like toggle/run.
      Indication: while travelling the icon breathes a soft activity ring
      (`.activity-transition`, 2.2s, static under prefers-reduced-motion) in
      display «Icon + activity» and the plate stays NEUTRAL in EVERY state
      (2026-08-04, see the next item); the icon
      morphs by state + device_class (blinds/shutter/curtain…), unknown state
      morphs nothing; no position percentages anywhere
      [auto: smoke_cover_tap + units resolveTapAction/coverService/stateIcon +
      backend test_cover_tap_action_is_accepted]
- [ ] A cover is NEVER painted (dev, owner 2026-08-04): «у штор не должно быть
      жёлтой подложки никогда, индикация открыто/закрыто за счёт морфинга
      иконки». Walk one curtain through closed / open / ajar / opening /
      closing: the plate is the plain neutral badge every time — never the
      yellow «включено» one, never the orange «открыто» frame it used to wear
      while open — the icon is the only open/closed signal, and the breathing
      `.activity-transition` ring appears in the two travelling states and
      nowhere else when «Icon + activity» is selected.
      The morph is exhaustive: every device class gives two DIFFERENT glyphs
      (awning included), a cover with no device_class morphs within its own
      auto-icon family (mdi:roller-shade, mdi:garage-variant), a hand-picked
      icon morphs only inside the pair it was picked from, and an
      unknown/unavailable state morphs nothing. NOT touched: an open door /
      window binary sensor, an unlocked lock and an open valve still wear the
      orange «открыто» frame (a valve has no icon pair, so the frame is all it
      has) [auto: smoke_cover_no_plate + unit stateIcon «every class, both
      ways»]
- [ ] Open/close works when the cover is NOT the primary entity (dev, owner's
      report 2026-08-04): a curtain driver that ships its `cover.*` hidden by
      the integration next to a visible `switch.*_reverse_direction` (Aqara
      E1 — his own) has a SWITCH for a primary; picking «Open/close» in the
      dialog, saving it and tapping the marker sends `cover.open_cover` to the
      cover, never touches the service switch and never falls back to the info
      card. The guarded class is read off that same cover, so a garage still
      degrades to info and is still not offered in the dialog
      [auto: smoke_cover_not_primary + unit coverEntityOf]
- [ ] Curtain INDICATION follows the same cover (dev, owner 2026-08-04): with
      «Open/close» chosen on that same Aqara marker, the plan shows the cover
      and not the service switch — the breathing ring while it travels
      (`activity-transition`, opening AND closing), the `mdi:curtains-closed` /
      `mdi:curtains` morph, a neutral plate throughout (the «открыто» frame
      was retired for covers later the same day), and no yellow plate when
      `switch.*_reverse_direction` happens to be on. The rule is exactly
      the explicit action (docs/FILTERING.md «What a marker SHOWS»): take the
      action away and the marker speaks for its primary again; a lit lamp that
      also owns a cover keeps its yellow and its own icon
      [auto: smoke_cover_not_primary (the indication section)]
- [ ] Nothing paints over an explicit curtain (dev, audit DEV-1DA1-01): the
      cover is the FIRST rule of «What a marker SHOWS», above `controls` and
      above a lit light. Two markers set to «Открыть/закрыть»: one on a mixed
      device whose own `light.*` is ON, one whose bound `controls` switch is
      ON. In every cover state (closed / open / opening / closing) the plate
      stays neutral — never the yellow «включено», never the orange «открыто»
      — with «Icon + activity» the travelling ring breathes, the icon morphs
      with the cover, and in glow fill the ring is still there (that is where a yellow-plated curtain
      used to lose BOTH indicators). Untouched: the same mixed device without
      the explicit action is yellow again, a wall switch still mirrors its
      controls, and an «Открыть/закрыть» marker whose device has no `cover.*`
      at all falls back to its primary [auto: smoke_cover_plate_precedence]
- [ ] Light-source badges (current contract): in glow fill a lit lamp's badge
      stays yellow just like a lit socket; the pool keeps the source's RGB while
      the marker keeps semantic yellow. Other fills behave identically;
      morphing and the activity-colour fallback survive [auto: smoke_light_badges +
      smoke_rgb_alarm]
- [ ] Icon size multiplier scales the glyph (dev): set a marker's size to 3 —
      the icon inside grows with the badge instead of staying default
      [auto: smoke_icon_scale]
- [ ] Auto-grid parity (v1.51.2, HP-1511-01): with an empty layout, a visible
      device among hidden ones sits at the same spot on both cards
      [auto: smoke_hidden_flag autoGridParity]
- [ ] Activity ghost (v1.51.2, unified dev): a hidden icon+activity marker
      shows its base icon and no effect [auto: smoke_hidden_flag rippleGhost*]
- [ ] Hidden LQI parity (v1.51.1, HP-1510-01): a room whose only Zigbee
      devices are hidden paints the same lqi fill on the full and the static
      card [auto: smoke_hidden_flag lqiParity]
- [ ] Ghost shows no numbers (v1.51.1, HP-1510-02): a hidden value-display
      device renders as a plain ghost — no value/temp/hum/LQI, no icon morph
      [auto: smoke_hidden_flag ghostHidesValue]
- [ ] Hide-from-plan flag (dev, docs/FILTERING.md): every existing device
      dialog has a bottom-left "Hide" / "Show" action, incl. virtual; the
      change is applied by Save; hidden devices vanish from every mode and
      the count, still count toward room LQI, cast no glow/light fill; the
      device editor's "Show hidden" (local, per tab) shows them as BLUE
      dashed ghosts — distinct from a grey unavailable icon — with NO live
      state paint (no yellow, no alarm, no activity);
      showing and saving keeps a hidden:false marker (re-seed protection); an old
      config materialises on first load by an editing client and legacy
      clients keep the old behaviour until then
      [auto: smoke_hidden_flag + unit seedHiddenBindings/seeded/legacy]
- [ ] Yellow means working (dev): a TRV whose hvac_action is heating glows
      yellow; one that is merely enabled (idle) or has a service switch on
      (anti-scaling, child lock) stays dark; a lit light turns its state on by
      the same condition that lights the glow pool and shows the yellow badge
      even where that pool is drawn
      [auto: smoke_yellow_principle + smoke_light_badges]
- [ ] Activity baseline (beta.10 audit): rebuilding the device registry seeds
      the current snapshot immediately, so the very first later motion/event
      transition is detected. Rebinding a marker's effective source clears the
      old source's finite flash in the same update [auto: smoke_motion_sense]
- [ ] Editor gestures on touch (dev): in the plan editor on a phone, pinch
      zooms and a moving finger pans; releasing after a gesture does not draw
      a point, a clean tap still does [auto: smoke_editor_gestures]
- [ ] Legacy geometry parity (v1.50.4, HP-1503-01): a store with a zero
      viewport and a negative rect renders identically sane in BOTH cards —
      full canvas fallback, normalised rectangle [auto: smoke_legacy_geometry]
- [ ] Sizes are positive (v1.50.3, HP-1502-01): view_box or room w/h of zero
      or below is refused; a store that already holds one opens on the full
      canvas, not a blank screen [auto: test_sizes_are_not_coordinates + unit
      safeViewBox fallback]
- [ ] Room card layout (v1.50.3): the settings button is the bottom row of the
      card and the room name sits in the same spot in view and plan modes
      [manual; verified by vb-coordinate measurement]
- [ ] Geometry bounds (v1.50.2, HP-1501-01): a config with a 1e100 room
      vertex is refused by the server; one already stored still renders with a
      sane frame [auto: test_geometry_magnitudes_are_bounded + unit
      contentBounds legacy case]
- [ ] No-op repair (v1.50.2, HP-1501-02): geometry/repair with a typo'd space
      id errors, moves no revision and keeps the previous backup undoable
      [auto: test_a_noop_repair_does_not_eat_the_backup]
- [ ] Card below other dashboard content (v1.50.1, HP-1500-02): place the card
      after a tall card in a normal dashboard — the plan still gets most of the
      viewport instead of a zero-height stage [auto: smoke_zoom_out]
- [ ] Frame never degenerate (v1.50.1, HP-1500-03): a space with one lone
      marker opens with canvas around it, not an empty scene; an absurd stored
      coordinate neither hides the plan nor is accepted by the server
      [auto: unit contentBounds + backend test_layout_coordinates_are_bounded]
- [ ] Stranded migration repair (v1.50.1, HP-1500-01): geometry/repair with
      dry_run previews, applies with a backup, undo restores; wrong space is
      recoverable [auto: test_geometry_repair_is_explicit_previewable_and_undoable]
- [ ] Editors see the whole canvas (v1.50.0, HP-1490-03): a hand-drawn space
      with one small room opens content-fit in View; switching to the plan
      editor shows the full square with room to draw a second room far away;
      back to View restores the content fit [auto: smoke_audit_1490]
- [ ] Save waits for a picked plan's proportions (v1.50.0, HP-1490-04): pick a
      saved plan and hit Save before the thumbnail loads — the stored aspect is
      the real one, never the previous file's [auto: smoke_audit_1490]
- [ ] Zoom goes below the fit (v1.50.0): minus past 100% floats the plan
      centred, floor at 0.4x; entering an editor keeps the stage inside the
      viewport [auto: smoke_zoom_out]
- [ ] Migration crash recovery (v1.50.0, HP-1490-01): kill HA between the two
      store writes of the square migration — the next start finishes the layout
      half from the saved intent
      [auto: test_square_migration_finishes_after_a_crash_between_the_writes]
- [ ] Parallel upload quota (v1.50.0, HP-1490-02): two simultaneous uploads
      with one slot left — exactly one succeeds
      [auto: test_parallel_uploads_cannot_slip_past_the_quota_together]
- [ ] Zoom opens on the content (v1.49.0): a space with no background and one
      small room opens with that room filling the screen, with a small margin.
      With a background it still fits the whole image
      [auto: unit: contentBounds]
- [ ] Deleting a picked plan is refused (v1.49.0, HP-1470-02): pick a saved
      plan, reopen the list — its delete button is disabled. Ask the server to
      store a plan url whose file is gone: `missing_plan`, and the revision does
      not move [auto: smoke_saved_plans + backend
      test_config_set_refuses_a_plan_that_no_longer_exists]
- [ ] Uploads are bounded (v1.49.0, HP-1470-01): past the store quota an upload
      is refused with a clear error and the disk does not grow; the plan list
      returns the newest 60 with a total
      [auto: unit: test_check_quota_counts_the_whole_store_not_one_request,
      backend test_uploads_are_bounded_by_a_store_quota]
- [ ] Square canvas migration (v1.48.0): after the upgrade every existing plan
      looks exactly as before, just with margins where the canvas was extended.
      Measure a wall in the plan editor — the length in cm is unchanged. Marker
      positions, doors, decor and the saved zoom are all where they were
      [auto: unit: test_a_wide_plan_gains_margins_above_and_below and neighbours,
      test_migration_preserves_real_lengths_and_shapes]
- [ ] A plan image is centred (v1.48.0): a wide image sits in the middle with
      empty bands above and below, a tall one with bands at the sides, and it is
      never stretched [auto: unit: fitInSquare + smoke_space_settings]
- [ ] Re-attaching a detached plan (v1.47.0): detach a plan, save, RELOAD THE
      PAGE, open space settings → "Already uploaded" → the image is listed with
      its size and no "in use" note → attach it → it renders. The one a space
      uses shows that space and cannot be deleted; a free one can, with a
      confirm, and disappears from the list
      [auto: smoke_saved_plans + backend test_stored_plans_can_be_listed_and_deleted_on_request]
- [ ] Detaching a plan keeps the file (v1.46.6): switch a space to "draw" and
      SAVE — the image is still in `config/houseplan/plans/` right afterwards,
      and after a restart, and can be re-attached. Deleting the space keeps it
      too. Replacing a plan still removes the one it replaced, immediately.
      Check straight after the save: the earlier bug deleted the file at that
      moment, while every scheduled-pass test passed
      [auto: unit: test_plan_collection_matrix, test_attachment_collection_matrix,
      backend test_detaching_a_plan_keeps_the_file]
- [ ] Rebinding a device does not eat its manuals (v1.46.5): attach two files to
      a device, rebind it to another HA device — both are readable afterwards.
      If a copy failed, the file it failed on is still there rather than deleted
      with the folder [auto: backend test_files_cleanup_keeps_referenced_files]
- [ ] Nothing accumulates on an idle instance (v1.46.2/v1.46.3, HP-1461-01,
      HP-1462-01): attach a file, cancel the dialog, and do not save anything
      else — the file is gone after a restart AND after the daily pass, while
      every file the configuration still references is untouched. Seed the
      strays AFTER the last save, or `config/set` collects them and the check
      proves nothing
      [auto: backend test_startup_sweep_collects_what_no_commit_will,
      test_daily_sweep_callback_collects_too, test_sweep_and_a_config_write_do_not_race]
- [ ] A drag wins over a concurrent remote move (v1.46.2, HP-1461-02): drag an
      icon and, while the save is still in flight, have another window move a
      different icon — your icon stays where you put it and the other one
      updates [auto: smoke_layout_sync]
- [ ] Concurrent uploads of one name (v1.46.1, HP-1460-01): attach the same
      file from two browser tabs at once — two attachments, two sets of bytes,
      neither lost. A file whose name is at the length limit still downloads
      [auto: unit: test_reserve_filename_is_safe_under_concurrency and neighbours]
- [ ] No temporary files survive (v1.46.1, HP-1460-02): abort a large upload
      mid-transfer, send two files in one request, make promotion fail — in each
      case the files folder holds no `.upload-*`. An old one is swept at startup
      [auto: backend test_upload_leaves_no_temporary_behind + unit: sweep_upload_temps]
- [ ] Two full cards agree on positions (v1.46.1, HP-1460-03): open the plan in
      two windows, drag an icon in one — it moves in the other without a reload;
      a drag in progress in the second window is not thrown away
      [auto: smoke_layout_sync]
- [ ] Uploaded SVG is inert as a document (v1.46.0, HP-1454-01): open a plan's
      signed url directly in a tab — a `<script>` inside it must not run and must
      not reach the HA session's localStorage; the same plan still renders in the
      card. PDFs still open in the browser viewer
      [auto: smoke_svg_sandbox + backend test_uploaded_svg_is_sandboxed_and_a_pdf_is_not]
- [ ] An attachment never overwrites another (v1.46.0, HP-1454-02): attach a file,
      cancel the dialog — the previously stored file is byte-identical. Attach
      `manual.pdf` to two NEW icons — two independent files. A cancelled upload is
      gone an hour later
      [auto: backend test_upload_never_overwrites_an_existing_attachment + unit: collect_attachments]
- [ ] Two quick edits both survive (v1.46.0, HP-1454-03): with a slow connection,
      make an edit and another one before the first save answers — both are in the
      stored config, only one write is ever in flight, and no conflict toast fires
      [auto: smoke_config_writer]
- [ ] Open boundaries follow geometry (v1.46.0, HP-1454-04): change a space's
      aspect or drag a room vertex — the open boundary and the light through it
      move with the walls, without a reload [auto: smoke via model-identity key]
- [ ] Inner limits (v1.46.0, HP-1454-05): max and max+1 for polygon points,
      open_to, controls, pdfs, text and url lengths; an oversized config as a
      whole is refused with `too_large`
      [auto: unit: test_inner_collection_limits + backend test_config_write_is_capped_by_total_size]
- [ ] Big files stream (v1.46.0, HP-1454-06): upload a ~50 MB manual and download
      it twice in parallel — HA's memory does not grow by a file per transfer
      [manual]
- [ ] Static card parity (v1.46.0, HP-1454-07): a room whose fill is set to "none"
      under a space filled by light is transparent on BOTH cards
      [auto: smoke_render_parity]
- [ ] Layout reaches the static card (v1.46.0, HP-1454-08): drag an icon on the
      full card — a static card on the same dashboard moves it too, with no
      config write and no reload
      [auto: backend test_layout_keeps_its_revision_and_announces_changes + manual]
- [ ] Repair issues are not immortal (v1.46.0, HP-1454-09): create a missing-plan
      warning, then delete the space — the warning disappears [manual]
- [ ] A path the backend cannot sign does not become a request loop (v1.45.4,
      review R5-1): when `content/sign` answers successfully but omits a path,
      the card backs that path off individually and keeps the urls it did get;
      a re-render asks only for what is still missing, and only after the wait
      [auto: unit: signing.test + backend test_signing_one_path_may_fail_without_failing_the_request]
- [ ] Signing does not amplify on a bad connection (v1.45.2, review R4-2): with
      the WebSocket slow or refusing, the card issues ONE sign request per url
      and backs off after a failure instead of asking again on every render; a
      request that never answers stops blocking retries after 15 s
      [auto: unit: signing.test + smoke_space_card_bg]
- [ ] A broken plans directory does not fail a save (v1.45.2, review R4-1): make
      the plans folder unreadable and save the configuration — the save
      succeeds, the revision is usable, and the next save does not conflict
      [auto: backend test_a_failing_collector_does_not_undo_an_accepted_save]
- [ ] Two editors, one plan (v1.45.1, review R3-1): with the same space open in
      two tabs, attach a background in each in turn — the plan last saved is the
      one served, and neither commit deletes the other's file. A rejected upload
      disappears on a later save, not immediately
      [auto: backend test_late_commit_of_one_client_never_deletes_another_client_s_plan,
      test_commit_does_not_collect_another_client_s_uncommitted_upload,
      test_abandoned_uploads_are_collected_once_old]
- [ ] Static card background (v1.45.1, review R3-2): a houseplan-space-card on a
      dashboard shows the plan image, not an empty stage; the browser never
      requests the unsigned path and Home Assistant logs no failed login. A
      failed signing request is retried on the next render
      [auto: smoke_space_card_bg]
- [ ] Rejected save leaves the plan intact (v1.45.0, review R2-1): attach a new
      background, make the config write fail (a second tab saving first is
      enough) — the previously stored plan is still served, with the same or a
      different extension; after a successful save the old files are gone
      [auto: smoke_plan_upload_reject + backend test_plan_upload_does_not_touch_the_previous_file]
- [ ] Signature cache on a wall tablet (v1.45.0, review R2-2): with more than
      200 signed urls every one of them is refreshed (batched), entries for
      files no longer in the config are dropped, an expired signature is never
      served and an aging one keeps working while its replacement arrives
      [auto: smoke_sign_cap]
- [ ] Climate cost does not grow with rooms (v1.45.0, review R2-3): on a plan
      with dozens of rooms an unrelated HA state update triggers ONE registry
      pass, repeated renders on the same snapshot trigger none, and a changed
      sensor value is still visible immediately [auto: smoke_climate_once]
- [ ] Plan upload survives a concurrent config revision (v1.44.8): with a second
      tab open on the same plan, attach a background image in space settings —
      the plan shows immediately, `plan_url` is in `.storage/houseplan.config`,
      and the same holds when the space is being CREATED, not edited
      [auto: smoke_plan_upload_race]
- [ ] Signed plan background (v1.44.7): a space whose plan lives on the content
      endpoint renders its background image with an `authSig` query — the plan is
      visible after a plain page load, and Home Assistant logs NO failed-login
      attempt from the viewer's own IP. Nothing is requested before the signature
      arrives; a 12 h re-sign keeps the previous url until the new one lands
      [auto: smoke_plan_signed]
- [ ] Dialog zombies (v1.43.0, audit L3): close a dialog (Esc) while its save is
      in flight and let the save fail — the dialog stays closed, the card keeps
      rendering, the error toast still fires [auto: unit: logic.test + manual]
- [ ] No hover tooltips on touch (v1.42.2): on hover-less devices (tablets,
      phones) taps never pop the room/device tooltip — the data lives in room
      cards and long-press; desktop hover tooltips unchanged [auto: smoke_dialog_zombie]
- [ ] Card font scales (v1.42.1): three sliders — space-level base (space
      dialog) plus per-room name and metrics sizes (room settings), 50–300%,
      multiplied together and on top of resize-k and kiosk multipliers; the
      live sample card in both dialogs follows the sliders instantly; name and
      metrics scale independently [auto: smoke_font_scales]
- [ ] Room settings, tier 3 (v1.42.0): a gear on every room card in the Plan
      editor opens Room settings (name, HA area incl. the current one, fill
      override, temp/hum source); the creation dialog has the same section;
      fill override repaints only that room (incl. opting OUT of the glow
      darkness); a temp/hum source (device or entity) feeds the room card,
      tooltip and temperature fill — works for rooms without an HA area;
      renaming/rebinding an existing room now possible [auto: smoke_room_settings]
- [ ] PDF survival on rebinding (v1.41.2): rebind a marker with attached
      PDFs to another device — the server moves /files/<oldId>/ to the new id
      and the links keep opening; the old folder disappears (no orphans) [manual]
- [ ] Kiosk mode (v1.41.0): kiosk: true hides the whole header, blocks every
      editor (admins incl.), full-height stage; swipe left/right switches
      spaces at 1:1 (dots indicator, wraps), never while zoomed; double tap
      resets zoom; long-press (3 s) on empty plan opens the per-screen size
      popover (icon ×0.5–3, room-card font; localStorage per device);
      cycle: N auto-advances spaces with a 60 s pause after any touch;
      manual: walk the real wall tablet [auto+manual]
- [ ] Room link icon (v1.40.1): clicking empty room space in View does
      nothing (default cursor); an open-in-new icon after the room name (rooms
      with an HA area, View only) navigates to the area; no icon in editors or
      on area-less rooms [auto: smoke_room_link]
- [ ] Smart guides (v1.40.0): while drawing (outline, cut, decor shapes) or
      dragging (icons, room cards, decor) dashed accent guides appear from the
      nearest object sharing the X and/or Y (max two, with a dot at the
      source); the cursor badge shows length · angle and turns green on 45°
      multiples; indication only — no magnetism; nothing in View mode [auto: smoke_align_guides]
- [ ] Lights toggle by default (v1.39.0): a device whose PRIMARY entity is a
      light (bulbs, chandeliers, night lights, light groups) toggles on click
      out of the box — no per-device setting needed; the device dialog shows
      "Toggle" as its effective default; devices where light is a side
      function (kettle: primary = sensor) keep the Device-card default;
      explicit per-device "Device card" wins over the default [auto: smoke_light_default_tap]
- [ ] Derived walls cut too (v1.38.4): in the Plan editor the derived wall
      segments (.seg) no longer run solid through an open stretch — only the
      dash remains there [auto: smoke_openwall]
- [ ] Dashed boundaries in the Plan editor (v1.38.3): open stretches render as
      a true dash in markup too (blue trimmed outlines); merge/split-picked
      rooms keep their full amber highlight [auto: smoke_openwall]
- [ ] Nav persistence (v1.38.2): closing/reopening the tab restores the last
      space AND editor mode (admins; localStorage); a #space= deep link beats
      the saved space; a stale cache without the saved space retries after the
      live config loads [manual]
- [ ] Tap action cleanup + right click (v1.38.1): the per-device action list
      has three options (Device card / HA more-info / Toggle), no "card
      default" — the card editor's global tap option is gone and ignored;
      right click on an icon in VIEW opens HA more-info (native menu kept in
      editors; virtual w/o entity → device card) [auto: smoke_tap_ctx]
- [ ] Binding section redesign (v1.38.0): two radios — Virtual / Pick from
      the HA list — with a "Show entities" checkbox (tooltip) next to the
      second; the dropdown (search inside) appears only in HA mode, opens
      itself when nothing is chosen, closes on pick; Save is blocked until a
      binding is chosen in HA mode; groups/helpers listed always, device
      entities only with the checkbox; editing pre-selects everything [auto: smoke_binding_ui]
- [ ] True dashed boundary (v1.37.3): the open stretch is a REAL dash — the
      rooms' solid strokes are trimmed out beneath it (hover doesn't bring
      them back), walls elsewhere stay solid; the dashes render ABOVE the
      glow pools [auto: smoke_openwall]
- [ ] Unified Boundary tool: the Plan toolbar has exactly one Boundary button
      and no separate Virtual wall / Physical wall buttons. A solid shared
      wall shows a local start marker; two points on that same wall open the
      chosen range. A dashed span previews the inherited physical wall body
      and restores the whole canonical span with one click [auto:
      smoke_openwall, smoke_openwall_hover]
- [ ] Decor line style: a newly drawn or legacy line is solid and the drawing
      toolbar has no dash control. Double-click it under Select, switch the
      properties radio to Dashed and save: only that line receives
      `line_style: dashed`, renders with a dash array, stays clickable inside
      its gaps, and Undo restores the solid version [auto: smoke_decor]
- [ ] Boundary hit safety: target widths remain 12 CSS px for a fine pointer
      and 22 CSS px for touch at every zoom (or half the physical wall body,
      whichever is larger); a dash accepts only 6/10 px past its endpoints.
      Near an ambiguous junction the edit is refused until the pointer moves
      farther away. Outer walls and boundaries covered by a partition, column
      or unfinished contour are refused with an explanatory toast [manual +
      auto: smoke_openwall_hover + open-spans unit resolver]
- [ ] Boundary transient state: an invalid second point keeps P1 for retry; a
      too-short range clears it. Esc, first Undo/Redo, editor/space navigation,
      external config adoption, pointercancel and a second touch cancel P1
      without advancing history. A double-click on a dash restores it once and
      does not immediately arm a new opening [manual]
- [ ] Open boundaries (v1.37.0): virtual stretches exist only between two
      rooms on their shared wall and render dashed; glow light floods the whole
      connected open zone transitively, door sectors work from the zone's
      outer walls; merge/split keep links by room id [auto: smoke_openwall]
- [ ] Sector wedge fix (v1.36.3): door sectors never darken the light INSIDE
      the room — room outline and sectors are separate clipPath children
      (union), not subpaths of one nonzero path [auto: smoke_glow]
- [ ] Per-source glow radius (v1.36.2): the device dialog has a "Glow radius"
      field (HA units; empty = general-settings default shown as placeholder);
      an override changes that source's pool and door sectors only [auto: smoke_glow]
- [ ] Hidden-light primary (v1.36.1): a lamp whose light entity is HIDDEN in
      the registry (folded into a light group) still toggles/reflects the lamp,
      not its do-not-disturb switch or identify button; visible entities of the
      same domain still win over hidden ones [manual: click hallway lamps]
- [ ] Marker controls (v1.36.0): a marker with "Controls light sources" and
      tap action Toggle flips all bound lights/switches at once (any on → all
      off, all off → all on, one service call); the icon state (yellow badge)
      mirrors the targets, not the marker's own entity — the RGB tint is gone
      since v1.52.0, target colours reach only the glow/activity effect; without explicit Toggle
      the click opens info as usual; the info card lists targets with states;
      locks/other domains are filtered out of controls. Glow is spatial: the
      controller casts no pool and the real lamp marker owns it even when the
      controller is encountered first [auto: smoke_controls; unit: devices.test.mjs]
- [ ] Marker controls are lossless across Open → Save: their stored order,
      duplicates and temporarily unknown/vendor targets survive unchanged;
      only the marker's own bound/device entities are removed, while runtime
      toggle still filters to currently controllable targets
      [auto: smoke_controls; unit: devices.test.mjs]
- [ ] Bound-entity self-control regression: a marker bound to
      `entity:switch.hood` with legacy `controls: ["switch.hood"]` is not a
      light source/group, opens with no self chip and its explicit Toggle acts
      directly on the switch. When ON it may still show the ordinary yellow
      working-state plate, but creates no Glow/Light fill/statistics; setting
      `is_light` explicitly restores those light behaviours
      [auto: smoke_controls; unit: devices.test.mjs, plan-optimizer.test.mjs].
      Repeat with a `device:*` binding whose controls contain one of that
      device's child switches; the child is excluded while external targets remain
- [ ] Independent Glow (#55): the space has data-fill radios
      None/LQI/Light/Temperature plus a separate Glow switch; every combination
      persists and renders both layers in order. Legacy space/room
      `fill_mode: glow` has identical effective state, explicit booleans win,
      normal Save materialises both fields atomically and Optimize Plans makes
      the same idempotent model-v6 migration without deleting unknown settings.
      Glow-off everywhere creates no base/tunnel/pool SVG layer; static room
      cards show the data fill plus base darkness but no live pools
      [unit: logic, plan-optimizer, backend validation; auto: golden matrix].
- [ ] Additive Glow (#19): 1/10/30/60-source fixture renders one flat isolated
      pool group and exactly one outer opacity; brightness/palette alpha live
      only in gradient stops. A real SVG raster probe is cached per Document:
      pending/error/timeout/unsupported use `data-blend=normal`, success changes
      mounted cards to `screen`. Warm/cool overlap, reverse DOM order,
      same-colour brightening and a non-pool sector are pixel-checked
      [unit: glow-blend, fixture schema; auto: smoke_glow_blending; golden and
      large-light-blend-v1/large-house-glow-overlay-v1 performance profiles].
- [ ] Long-press gesture interruption (#59): mouse pointerdown on a marker,
      hold until the device card opens, release over the modal and close via X;
      pointermove cannot pan, all stage pointer/pan anchors are empty and the
      next clean short click follows the ordinary path
      [auto: smoke_long_press_gesture].
- [ ] Island rooms (v1.34.0): a contour drawn fully inside an existing room
      (or around one) saves as a nested room — column in a ring, inner room;
      the parent's fill renders with an evenodd hole so the ring paints
      correctly; the island stays clickable; partial overlaps and duplicate
      outlines are still rejected at closing [auto: smoke_island_rooms]
- [ ] Icon stays on edit (v1.33.4): rebinding a device (HA device/entity) or
      changing its room within the same space never moves the icon — the saved
      or auto position migrates to the new marker id; only a brand-new icon or
      a move to another space centers it in the target room [auto: smoke_marker_stay]
- [ ] Icon picker placeholder (v1.33.3): with no explicit icon the device
      dialog's icon picker shows both the glyph and `mdi:*` label of the
      auto-derived effective icon, plus an "Auto: mdi:..." hint line with the
      icon preview; opening/saving untouched must keep the explicit override
      empty, and the hint disappears once an explicit icon is picked
      [auto: smoke_icon_placeholder]
- [ ] No Reset button (v1.33.2): the Device editor toolbar has three tools —
      add, show all, icon rules; the layout-wiping Reset is gone [auto: smoke_editor_tabs]
- [ ] Grid in all editors + decor fade (v1.33.1): the dot grid shows in the
      Device and Background editors too (instant "I'm editing" cue), not in
      View; in the Background editor rooms/devices/openings/labels plus solid,
      thick and dashed virtual walls fade to 35% while decor shapes stay fully
      opaque; no fade in the other editors [auto: smoke_decor / smoke_grid_fade /
      smoke_resize_virtual_thick]
- [ ] Background editor (unified after v1.59.2): it always opens on Select and
      has Select / optional Plan backdrop / Line / Rectangle / Oval / Text /
      Furniture / Erase, colour+opacity, physical line width, optional
      fill colour+opacity and named Undo/Redo. Shapes are drag-drawn with
      mandatory grid snap and live preview; degenerate shapes are dropped.
      One click selects every decor kind; lines get endpoint handles and box
      kinds get the common proportional resize/rotate frame. Double click
      opens complete numeric/style/content properties. Delete removes the
      selection and Erase deletes on click. Esc restores only an active draft
      or gesture; a released operation is reverted through Undo. Decor stays
      purely visual and inert outside its editor [auto: smoke_decor /
      smoke_grid_fade; unit: decor-geometry.test.mjs]
- [ ] Background-editor gesture regressions: a perfectly horizontal/vertical
      rect or ellipse draft is discarded; switching tools during a live move
      restores the pointer-down snapshot; resizing a rotated box keeps the
      opposite corner fixed without a post-resize grid wobble
      [auto: smoke_decor; unit: decor-geometry.test.mjs]
- [ ] Opening hover preview (v1.32.1): with the Opening tool, hovering near a
      wall shows a dashed 90 cm ghost snapped onto the wall (with a center
      dot); no ghost far from walls, over an existing opening (click = edit),
      or in other tools [manual]
- [ ] Split polyline + cursors + Esc (v1.32.0): Merge shows a pointer cursor,
      Split shows pointer until a room is picked then crosshair; the cut can be
      a polyline — start on a wall, intermediate clicks inside the room, finish
      on a wall (path drawn live, walls/self-crossing rejected); Esc walks back:
      last cut point → room pick → back to the Draw tool (same for Merge:
      selection → tool) [auto: smoke_split_polyline]
- [ ] Merge/split pick highlight (v1.31.2): the first room clicked with the
      Merge tool (and the split-selected room) gets an amber outline + fill;
      visible over the blue markup outlines [auto: smoke_merge_highlight]
- [ ] Card vs tool conflict (v1.31.1): in the Plan editor, dragging/resizing or
      clicking a room card never feeds the active tool (no draw point, no
      delete-room confirm, no merge/split pick); clicks past the card work [auto: smoke_merge_highlight]
- [ ] Room cards (v1.31.0): with metrics enabled in space settings (4
      checkboxes: temperature, humidity, avg Zigbee, lights) the room name gets
      a smaller metrics line under it; lights show On/Off or "1 of 3" when
      partially lit; rooms without an HA area show the name only; in the Plan
      editor cards show the name only, are draggable and resizable via corner
      handles on hover (uniform scale 0.5–3, stored in layout, survives drag);
      View mode has no handles/hover [auto: smoke_room_cards]
- [ ] Esc closes dialogs (v1.30.4): Escape closes the topmost dialog (opening
      info, device info, icon rules, general settings, device editor, opening
      editor, space dialog incl. abandoning an import queue); stacked dialogs
      close one per press; Esc while drawing still undoes the last point [manual]
- [ ] Shared dialog footer (dev after v1.59.2): in the wide device editor the
      divider spans the full modal width, Hide is bottom-left and Cancel/Save
      are bottom-right; the scrollable body ends above the footer. At narrow
      width the two action groups wrap without overlap [manual]
- [ ] General settings gear (v1.30.3): the header cog is visible in every mode
      (admins), opens the palette dialog from View too [auto: smoke_gear_tabs / smoke_gs_always]
- [ ] Editor tabs: three tabs — "Plan editor" / "Device editor" /
      "Background editor" (no View button; View is the default state); clicking a tab opens its
      bottom toolbar (Devices got its own bar with add/show-all/reset/rules);
      the bar and the active tab both show an X that returns to View; re-click
      on the active tab does nothing; Plan↔Devices switches directly [auto: smoke_editor_tabs]
- [ ] Stable editor chrome (HP-UX-11): selection, tool parameters, operation
      hints and furniture palette use the single stage-owned context tray;
      opening/closing it leaves stage top/height, `_hdrH`, zoom/pan and the
      pinned Close position unchanged. Context actions cannot execute for a
      stale target, Delete/Backspace cannot fall through focused tray controls,
      and injected explicit groups support ArrowDown, roving arrows,
      Home/End, Escape focus restore and consumed outside-dismiss. Check
      420/559/560/719/720/721/899/900/1200 px, RU/EN, light/dark and reduced
      motion [auto: smoke_editor_tabs, smoke_decor, smoke_furniture; manual:
      responsive/theme matrix]
- [ ] Navigation motion is short and coherent for space changes, View↔editor
      and editor↔editor. A same-space editor switch fades in the new toolbar
      and interpolates from the outgoing measured height to the incoming one,
      including wrapped multi-row bars and a rapid second switch. Hidden editor
      chrome is `aria-hidden`, inert and cannot receive pointer input;
      disconnect/reconnect clears transient slide/resume
      classes instead of replaying a stale transition [auto: smoke_editor_tabs,
      smoke_preloader_lifecycle, smoke_zoom_out]
- [ ] Space gear (v1.30.1): the cog next to the space name is visible in every
      mode (admins only), vertically centered with the tab text; clicking it
      opens space settings without switching the tab; "+" tab stays Plan-only [auto: smoke_gear_tabs / smoke_gs_always]
- [ ] Lock action (v1.30.0): opening info card (View) shows Unlock (red) when
      locked / Lock when unlocked; button calls the lock service; disabled while
      locking/unlocking; hidden when unavailable; plan-icon tap still never
      toggles a lock [auto: smoke_gear_tabs / smoke_gs_always]
- [ ] New-device flag (v1.29.0): a device added to HA after install gets a big red
      dot top-right of its icon (all clients); opening its editor clears it
      everywhere; upgrade/first-run seeds the baseline silently — no dot flood [auto: smoke_new_device]
- [ ] No devices at all in HA (fresh instance) → plan renders, "0 dev.", no console errors [auto: smoke_new_device]

## Device dialog (markers) ★

- [ ] Open via info card → Edit; all fields persist (name, icon, model, link, description)
- [ ] Rebind to another device/entity/helper: search filters; already-placed candidates excluded; old position cleaned up [auto backend]
- [ ] Virtual device: requires name; room required; renders dashed
- [ ] Sub-area rooms (v1.28.0): a room WITHOUT an HA area appears in the marker
      room list ("no area, manual"); a device placed there lands at its centre,
      the marker stores room_id, reopening the dialog restores the choice [manual]
- [ ] Room override moves the icon to the room center
- [ ] Tap-action override select (default/info/more-info/toggle) saves and applies
- [ ] PDF/manual upload: ok path; >50 MB → readable error; .exe → bad-ext error [auto backend]; traversal names sanitized [auto backend]
- [ ] `javascript:` in the link field is not rendered as a clickable link [manual]
- [ ] Delete versus Hide: both buttons sit together at bottom-left; Delete asks
      for confirmation, Cancel changes nothing, Confirm closes the dialog
      immediately [manual]
- [ ] Delete an auto device: no icon and no Show-hidden ghost; it does not
      return on rebuild/reload, but its binding is offered by Add. Re-add it:
      one marker only, fresh centred/grid position, no tombstone
      [auto: smoke_hidden_flag; unit + manual]
- [ ] Delete an entity marker and a virtual marker: the entity is offered by
      Add (with Show entities when applicable); the virtual marker is gone and
      can be recreated manually. The exact deleted entity remains offered even
      if HA marks its registry entry hidden. Other virtual markers survive both
      Save and Delete [auto: smoke_hidden_flag; unit + manual]
- [ ] Deleted device contributes to none of LQI, climate average, explicit room
      temp/humidity, resolved lights, Light fill, Glow, room stats or another
      marker's controls. Hidden device keeps the documented hidden semantics
      [unit + manual]
- [ ] References are non-destructive: a deleted contact/lock stops driving an
      opening and a deleted live-text variable prints `—`; re-adding the
      binding restores both. Layout, attachments and current/previous vacuum
      trails are gone [unit + backend + manual]
- [ ] Tombstones stay binding-scoped: deleting a standalone entity does not
      remove the same entity from a still-live parent device; temporarily
      inactive `controls` remain stored and become active again after re-add.
      A stale old card sees a non-virtual tombstone as hidden, never visible
      [unit: devices.test.mjs; manual for the old-card fallback]
- [ ] Multi-tab race: after deletion, a stale tab's late layout/update is
      acknowledged as ignored and cannot resurrect the old position [backend]
- [ ] A live explicit non-virtual marker whose custom id begins with `v_`
      accepts both point and batch layout writes; only an actually orphaned
      virtual id is ignored [backend: test_ha_websocket.py]

## Icon rules ★

- [ ] ⬡ opens the editor with current rules (defaults if none saved)
- [ ] Test field resolves live; add/delete/reorder rows; first match wins [manual]
- [ ] Invalid regex highlights red and is skipped at runtime (other rules still work) [manual]
- [ ] Reset to defaults; saving defaults stores nothing (settings key removed) [manual]
- [ ] Custom rules re-icon existing devices immediately; per-device icon override still wins; lock devices keep mdi:lock [manual]
- [ ] Rules survive reload; second browser sees them after live-sync

## Tap actions & gestures ★

- [ ] Default: tap → info card; card option `toggle`: tap toggles lights/switches/fans/humidifiers only [manual]
- [ ] Locks/alarms never toggle, even with per-device override [manual]; covers/valves toggle only with explicit per-device override [manual]
- [ ] Long-press (600 ms) always opens the info card, also when tap=toggle [manual]
- [ ] Drag > 3 px cancels both tap and long-press; pinch/pan never triggers taps
- [ ] `pointercancel` (touch interrupted) does not leave a phantom info card [manual]

## Zoom / pan / labels

- [ ] Wheel zoom at cursor; +/− buttons; fit button resets; badge shows %
- [ ] Pinch zoom + two-finger pan on touch; one-finger pan when zoomed
- [ ] Zoom level persists per space (localStorage), restored on reload
- [ ] Window resize / sidebar collapse refits without distortion
- [ ] Room name labels: default at room center; dragging moves and persists (server layout, `rl_*`) [manual]; hidden in markup mode
- [ ] Labels legible on light and dark plans (no text shadow) at min/max zoom

## Multi-client & concurrency ★

- [ ] Two browser tabs: drag in A → position appears in B without reload (live event)
- [ ] Config edit collision: stale tab saving gets a conflict toast, auto-resyncs, retry works [auto backend]
- [ ] Point layout updates from two windows don't overwrite each other's icons [auto backend]
- [ ] `admin_only` ON: non-admin user gets readable "administrators only" errors on every write path

## Edge cases

- [ ] HA instance with zero devices/areas → onboarding works, rooms can be drawn, no crashes [manual]
- [ ] Space with zero rooms → renders; markup hint visible
- [ ] Room without HA area + borders OFF → still has a transparent View hit
      surface, highlights on hover, reports geometric floor area, click does nothing
- [ ] No zigbee devices anywhere → no LQI badges, lqi fill leaves all rooms unfilled [manual]
- [ ] 100+ devices in one space → build under ~50 ms [manual], drag stays smooth
- [ ] Very long device/room names → ellipsis/wrap, no layout explosion
- [ ] HTML/emoji in names (`<b>xss</b>`, 🚿) → rendered as text, never as markup [manual]
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

## Golden-image regression matrix

`npm run golden:capture` records the data-only scenarios from
`demo/golden/matrix.mjs` into ignored `artifacts/golden/actual/`; it never
changes a reviewed image and fails if any scenario itself errors.
`golden:verify` always compares the complete matrix (a diagnostic
`--scenario` is capture-only) with
`demo/golden/baselines/`, writes high-contrast pixel diffs and fails on a
missing image, changed dimensions, excessive diff, scenario error or stale
matrix manifest. It also refuses a different Chromium build and baseline PNGs
whose hashes no longer match the reviewed manifest. `golden:accept --
--reviewed` is the only baseline write path and also requires a complete,
error-free report captured from the current source fingerprint; the entire set
is validated before any reference is copied.

The matrix covers thick wall junctions, virtual/physical boundaries,
partitions/columns, axis-aligned and 45° door/window/gate tunnels, hidden
opening symbols, Glow and sun, light/temperature/LQI fill splits on a wall
axis, hover over Glow and nested rooms, all three editors, dark/light themes,
0.4×/fit/2.5×, warm remount and adaptive RU/EN dialogs including focus and the
decor colour popover. In the
canonical Linux CI profile Chromium, viewport, DPR, locale, timezone, colour
profile, font rendering, animations and caret are deterministic. The separate
CI job captures review candidates until the first baseline is accepted; after
that it automatically runs blocking verification. Review and accept the
`golden-images` CI artifact rather than treating a developer OS raster as the
canonical set. See `demo/golden/README.md`.

## Large-house performance gate

`npm run benchmark:large-house` runs a deterministic fictional three-floor
fixture with 60 rooms, 200 devices, 100 openings, 60 partitions, 40 columns and
500 decor objects. It records model readiness, first stable render, space
switch, HA state update, shared-wall resize preview, pan/zoom, settings-dialog render, repeated navigation,
Long Tasks, warmed hot-cache growth and post-GC heap growth.

The blocking `performance` CI job builds the candidate and its base SHA, then
captures seven measured samples for each sequentially on the same Node 22,
Playwright Chromium and hosted runner. `demo/performance/compare.mjs` applies
the tighter of the approved absolute ceiling and baseline-relative allowance
from `demo/performance/budgets.json`. It fails on a runtime/profile mismatch,
an incomplete sample set, a timing/Long Task/heap regression, cache growth or
an incomplete 200-device render. Raw base/candidate reports and the comparison
are always uploaded as `large-house-performance`; the check table is also
written to the GitHub job summary. Local measurements remain diagnostic only.
See `demo/performance/README.md` for the budget-review contract.

## Last self-run

**v1.21.1 (2026-07-16), full audit of v1.16–v1.21.** All `[manual]` items pass (73 frontend
tests, 12 backend). New smokes on the synthetic home: `smoke_merge_split` (merge fuses
adjacent rooms keeping the survivor's id; non-adjacent refused with a toast; split creates
the new room, cancel keeps the room whole, along-wall cut refused) and `smoke_split_nonsnap`.
Finding turned into a fix (shipped this release): **Split required the click to land on a grid
node**, so it silently failed on rooms whose walls are not grid-aligned (imported/legacy
polygons) — the click now snaps to the nearest wall instead of the grid, and `splitRoom()`
still rejects a bad cut. README (en+ru) gained the merge/split/ruler/scale documentation it
was missing. The earlier self-run record follows.

**v1.14.0 (2026-07-06), headless demo harness + unit suites.** All `[manual]` items pass
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
      card's plan (background + configured borders/names + room fills + icons), no header/controls [manual]
- [ ] The schematic is fully non-interactive: click/hover anywhere does nothing — no more-info,
      no tooltip, no drag (`.hp-static-stage` is pointer-events:none) [manual]
- [ ] Footer button opens the full component already showing that space (deep-link `#space=<id>`) [manual]
- [ ] Several cards with different `space` coexist on one board; one shared config WS request
- [ ] Unknown `space` → tidy error card [manual]
- [ ] `show_button: false` hides the footer
- [ ] Full card honours `#space=<id>` on load and on hashchange; invalid id ignored [manual]

## Unified device status and activity (dev, owner 2026-08-05)

- [ ] The Display list contains exactly Icon + dynamic plate, Icon + activity,
      Value instead of an icon, Always static icon, in that order. Legacy
      `display: ripple` reads and saves back as `icon_ripple`
- [ ] Icon + dynamic plate shows state plate/morph but no ordinary activity
      effect; Icon + activity adds the semantic effect; Value keeps the
      state-coloured plate and hides ordinary activity; Always static icon
      keeps one neutral base icon and suppresses all state-driven visuals
- [ ] Motion/vibration/sound/contact rising edges render exactly three waves
      for about 3.3 s; initial load and recovery from unknown/unavailable do
      not fake an event; a rapid retrigger restarts it
- [ ] Occupancy/presence is one calm static ring for the whole active state
- [ ] Cover/lock/valve movement breathes until the travelling state ends;
      direct terminal `closed ↔ open` / `locked ↔ unlocked` without an
      intermediate state breathes for about 3.3 s
- [ ] Actual work (light/switch/fan/humidifier on, active climate action,
      vacuum cleaning, script running) is yellow and slowly
      breathes in Icon + activity; `automation = on` is merely enabled and
      remains neutral
- [ ] Every `media_player` is neutral and has no running activity for `on`,
      `idle`, `playing`, `paused` and other transport states; explicit `off`
      uses the same faded treatment as `unknown`/`unavailable`. Several
      resolved media entities fade only when none is available and powered
- [ ] Controls aggregate their targets: any working target drives both the
      yellow plate and the running effect
- [ ] Open contact/unlocked lock/open valve are orange; an open cover stays
      neutral because its icon morph carries that state
- [ ] Unavailable suppresses ordinary activity. Alarm outranks all dynamic
      presentation, including when ordinary live states are off; `static_icon`
      deliberately hides alarm paint without suppressing service-call errors
- [ ] `static_icon` hides temperature/humidity/LQI, RGB, value, icon morph,
      activity and live vacuum puck/trails/room highlight on the full and static
      cards; preview still names the real HA state/source and explains the static result
- [ ] Switching a static vacuum back to a dynamic display restores applicable
      live/server trails; choosing static never deletes stored trail history
- [ ] Activity colour and size (×2..×8) apply per device; alarm ignores them
- [ ] Icon size ×0.5..×3 and rotation 0..355° apply per device; the
      temp/humidity badges scale with the icon
- [ ] With OS "reduce motion" enabled, activity/alarm rings are static

## Doors, windows & gates (v1.23.0+)

- [ ] Markup → "Opening": a click away from any wall shows a toast; near a wall — the dialog
- [ ] A door placed on a wall renders jambs + leaf + swing arc at the wall's angle; length in cm
      matches the ruler/scale of the space
- [ ] Bind a contact sensor: open → leaf swings and the arc draws on in the accent colour;
      closed → leaf lies along the wall, arc hidden; invert flips this
- [ ] Sensor unavailable → the opening freezes at its static default (door open / window closed)
- [ ] A door with a lock shows the padlock badge: green locked / orange unlocked / grey unknown
- [ ] A gate defaults to 300 cm, has two equal leaves, no swing arc and opens
      10° outwards; contact, inversion, lock, drag and resize anchoring match a door
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

## Live vacuums (docs/VACUUM.md)

- Docked robot: only the base marker, at the user-placed spot (the dock).
- Cleaning + calibrated map: a round pulsing puck — the base badge but
  circular and 20% smaller, same plate colors, glyph dead-centre — drives
  the plan; the base marker never moves. No heading arrow.
- Puck motion: glides ~1.2 s between telemetry points; TELEPORTS (no glide)
  on zoom, pan, space switch, browser-tab return, and after a >10 s data
  gap. Stale coords (>60 s while cleaning) freeze and dim it.
- «Показывать путь робота» has three modes: never / while cleaning (default
  — the line hides the instant the run ends) / always (the only mode that
  also shows the previous run at 40% opacity).
- The trail is server-recorded (trails.py watches the source entity; two
  runs kept per marker, survives reloads, shared by every screen) and never
  outruns the icon: drawn segments lag one point, and the last segment is a
  rAF-driven tip glued to the puck centre every frame.
- Calling trail delete for a marker with no stored run is a true no-op: its
  source/vacuum pair stays subscribed. A successful delete removes only that
  marker's pairs and immediately rebuilds the subscription
  [backend: test_trail_recorder.py].
- Trail style: cartography casing (dark halo 2.25 + light core 0.9),
  readable over any room fill.
- Hidden marker: neither puck nor trail. Uncalibrated active map: no puck.
- Calibration: «Настроить автоматически» (≥3 rooms matched by name) or the
  fit panel — drag the dashed room ghost, stretch by 4 corner handles,
  rotate 90°/mirror buttons (mirror ON by default), Save/Cancel/Esc. Real
  clicks must land on the overlay (elementFromPoint smoke guards it).
- Multi-floor: one matrix per robot map (Dreame `selected_map` on the
  vacuum entity names the active one).

## Room resize (docs/RESIZE.md)

- [ ] The «Размер» tool appears in the Plan editor toolbar; in EVERY other
      tool (and in Devices/Decor/View) there is not a single `.rszhandle`
- [ ] Handles sit at the midpoint of every wall of every room; they are
      finger-sized, capture the pointer and never start a stage pan
- [ ] Dragging a handle moves the wall along its normal, both edge ends
      together; the wall line snaps to the drawing grid
- [ ] A wall fully shared with a neighbour drags the neighbour's wall with
      it — the neighbour shrinks/grows, no gap and no overlap can appear
- [ ] A partially shared wall (T-junction) moves only the coinciding
      stretch: the neighbour becomes L-shaped (new vertices), shown live
- [ ] Legacy x/y/w/h rectangle rooms resize the same way and are saved back
      as polygons
- [ ] Live badges while dragging: lengths of the dragged wall + both
      adjacent walls, and the m² area at the room centre; dragging a shared
      wall shows BOTH areas; all numbers update continuously
- [ ] Stops: ~30 cm minimum for the own room AND the shrinking neighbour;
      a foreign room in the path (touch is ok, overlap never); islands
      inside; a door/window/gate on a shortening wall (the wall corner can not
      pass the opening edge)
- [ ] A door/window/gate ON the moving wall travels with it (openings x/y
      recompute; angle unchanged)
- [ ] Esc mid-drag cancels: the original geometry is back instantly
- [ ] Click a room in the resize tool → dashed bbox frame with 4 corner
      handles; dragging a corner scales all vertices proportionally about
      the opposite corner; neighbours are NOT dragged along (the one
      exception to «shared walls together»), growing into one stops
- [ ] Ctrl+Z / ⌘Z after releasing a handle restores the previous geometry —
      one release = one undo step (rooms AND openings)
- [ ] The Plan toolbar names the next Undo/Redo operation; Ctrl+Shift+Z and
      Ctrl+Y redo it, and a new geometry edit after Undo clears the redo branch.
      Fifty committed operations remain available in the shared stack
      [auto: command-stack.test]
- [ ] History shortcuts are layout-independent without conflating physical and
      labelled keys: Cyrillic Ctrl/Cmd+Z works, QWERTZ Ctrl+Z/Ctrl+Y pick the
      labelled command, and AZERTY Ctrl+W never becomes Undo. Focused inputs
      keep native history [auto: smoke_editor_tabs]
- [ ] A moved shared wall with a partial virtual middle and thick solid
      remainders keeps the dash and both thickness values during live drag and
      after release; Undo restores rooms, `open_spans` and `walls` together
      [auto: smoke_resize_virtual_thick]
- [ ] Device markers do not move; the room settings gear re-centres itself
- [ ] Smoke: `node demo/smoke_room_resize.mjs`

## Sun on the plan (docs/SUN.md)

- [ ] Everything below is INERT until `north_deg` is set (general ⚙ or the
      space settings) AND the install has `sun.sun`; both dialogs hint at
      whichever is missing
- [ ] The ⚙ compass: dragging the «N» arrow turns it in 1° steps (15° with
      Shift); the number field mirrors the dial and accepts 0–359; «Clear»
      returns the unset state
- [ ] «Plan background» selector: `static` keeps the existing color picker
      and behaviour byte-for-byte; `daynight` hides the picker and the stage
      follows the sun — neutral day, warm golden hour, dark night — with a
      slow (tens of seconds) transition; the PLAN dims only ~10% at night
- [ ] Opaque plan paper (2026-08-03, owner): the scene background —
      `bg_color` or the daynight sky — is visible ONLY around the plan and
      NEVER bleeds through it, in view/kiosk/editors and on the static
      space-card. An image plan papers the backdrop image rect
      (`rect.hp-paper`). A hand-drawn plan papers the ROOM CONTOURS: one
      `.hp-paper` shape per room in exactly the room's own geometry (fill
      only, no stroke), so an L-shaped house or detached buildings never
      grow a white bounding rectangle — the scene colour reaches the
      exterior walls, shows in the L's pocket and between buildings, and an
      empty drawn space has no paper at all. A live resize preview
      (`_rszPreview`) moves the paper together with the dragged wall.
      Colours: historical white for drawn plans, the theme card background
      under an image. At night (`daynight`) the paper dims via the zoomwrap
      `brightness` filter only — its alpha stays 1. Pixel-proofed against
      an acid `#ff00ff` background [auto: smoke_bg_color]
- [ ] Per-space overrides (background mode, north, sun-in-windows) inherit
      when empty, exactly like show_lqi/fill_mode
- [ ] «Sunlight through windows» (default OFF): wedges appear only from
      windows on EXTERIOR walls facing the sun; interior windows, open
      (virtual) boundaries and doors never light up
- [ ] Wedge direction follows the compass; length grows toward
      sunrise/sunset and shrinks toward noon; every wedge is clipped by its
      room polygon; night = no wedges at all
- [ ] With wall thickness, both crisp side edges start at the two room-side
      corners of the window opening (the full span translated inward by half
      the wall depth), including at an oblique sun angle; no edge starts on the
      wall centreline [auto: unit `sun.test.mjs` + `smoke_wall_thickness`]
- [ ] Brightness + the 3° threshold (2026-08-03): wedges are visibly brighter
      (peak alpha 0.30, was 0.18) yet still readable over white paper AND the
      dark glow canvas; there is NO gradual ramp near the horizon — below 3°
      no rays at all, at/above 3° full strength; crossing the threshold fades
      the whole layer in/out over exactly 2 s (CSS on `.sunlayer`, the
      geometry never moves), and `prefers-reduced-motion` makes it instant.
      Every other way of losing the wedges (editor, feature off, night)
      stays instant [auto: smoke_sun «the 3° threshold» + unit rayAlpha/
      raysVisible/rayPeakAlpha; shots: demo/shot_sun_bright.mjs]
- [ ] Weather independence: sunny, cloudy, rain and snow all leave the same
      wedge geometry and peak opacity; a legacy `weather_entity` value is ignored
- [ ] Sun geometry recomputes ONLY when the sun attributes or the config
      change — an unrelated `hass` tick reuses the memo
- [ ] Editors (plan/devices/decor) render with NO wedges and NO day/night;
      kiosk works; the static space-card honours the background mode
      (wedges are full-card-only in v1)
- [ ] `prefers-reduced-motion` → no transitions, static colors
- [ ] Smoke: `node demo/smoke_sun.mjs`; units: `test/sun.test.mjs`;
      backend: `tests_backend/test_validation.py` (sun settings)

## Climate temperature opt-in (dev)

- [ ] «Use the device's temperature sensor» (marker dialog, climate devices
      only, default OFF): current_temperature shows as the standard `.tval`
      badge and joins the room average like a thermometer; unavailable /
      missing attribute = no badge, no vote; hidden devices keep voting
      (registry-wide climate, like hidden thermometers); the tick survives
      dialog recreation [auto: smoke_climate_temp; units: test/devices.test.mjs;
      backend: tests_backend/test_validation.py (use_climate_temp)]

## Infinite canvas (docs/CANVAS.md, dev)

- [ ] **A plan drawn past the old square opens whole**: a space whose rooms
      live at normalised 1.5..3.0 renders complete and centred (it used to
      frame empty canvas with the house off-screen) [auto:
      smoke_infinite_canvas; units: test/canvas.test.mjs]
- [ ] **Nothing stops at an edge any more**: in the Plan / Devices / Decor
      editors a room, a marker and a decor shape can be drawn, dragged and
      SAVED far outside `0..1`, on any floor; reload keeps them there
      [backend: tests_backend/test_validation.py::test_infinite_canvas_range]
- [ ] **A typical small plan is visually unchanged** — same framing, same
      room and label positions as before the feature. The ONE intended
      difference is icon size (below) [auto: smoke_infinite_canvas
      (legacyFrameUnchanged); the whole smoke suite is the regression net]
- [ ] **Icons no longer grow with zoom** (§6, owner is aware): a marker keeps
      the same pixel size at zoom 1, 4 and at the zoom-out floor; the
      per-device size multiplier, kiosk icon/font scales, badges, LQI chips
      and presence rings all still scale from `--dev-size`
- [ ] **Start view follows the content**: opening a space frames what is
      drawn plus a small margin, on every floor, with and without a backdrop
      image (with one the IMAGE sets the extent — it must not be cropped to
      the outlined rooms)
- [ ] **What is not drawn does not frame** (audit DEV-2C947-01): tick «hide
      from plan» on a marker standing far from the house and the view snaps
      back to the house — the hidden marker neither renders nor stretches the
      frame, on the full card and on `houseplan-space-card`. Untick it and the
      frame takes it in again; room LQI counted it the whole time
      [auto: smoke_canvas_frame]
- [ ] **The editor frame does not follow you out** (audit DEV-2C947-02): move
      the only room five canvases away in the Plan editor (the frame grows
      there, deliberately), close the editor — View frames the room where it
      is NOW, not the union with where it was; re-entering the editor starts
      from the current geometry [auto: smoke_canvas_frame]
- [ ] **A far stray does not inflate the icons either** (audit DEV-2C947-03):
      one ROOM dragged an order of magnitude away is rejected from the frame
      (as before) and the markers of the main plan keep the size they have
      without it; auto-placement spacing goes with them
      [auto: smoke_canvas_frame + unit canvas.test.mjs]
- [ ] **A far stray does not break the view** (§4.1): a marker dragged an
      order of magnitude away leaves the opening view alone and raises the
      inline chip «Объектов далеко от плана: N» with «Показать». No modal.
      «Показать» fits the plan AND the stray; the chip then disappears
- [ ] **«Вписать всё»** (middle zoom button): fits the content from any pan
      and any zoom, is never disabled, tooltip en/ru
- [ ] **Zoom-out floor**: the wheel / the minus button stop at three times the
      content frame; zoom-in still stops at 800 %
- [ ] **Pan has slack, not walls**: you can pan a full screen past the plan in
      every direction; when the plan is fully off screen a small arrow points
      home and one click fits it back
- [ ] **Pan at ANY zoom** (owner's report 2026-08-04): dragging empty scene
      moves the view at 100 %, at 50 % and at the zoom-out floor — in View and
      in all three editors, with every plan tool selected. The tools keep the
      pointer they own (a resize handle resizes, a device badge in the Devices
      editor moves the device, an opening slides along its wall — none of them
      pan), two fingers still pinch, and on a kiosk screen a horizontal drag
      is still the floor swipe (a vertical one pans) [auto: smoke_pan_any_zoom]
- [ ] **Kiosk: a pan stays a pan to the very end** (dev, audit DEV-1DA1-02):
      on a wall tablet at 100 % start a drag with a small VERTICAL lead-in
      (the plan starts following the finger — the gesture is locked as `pan`),
      then curve it far to the left or right and lift. The floor must NOT
      change: the decision taken on the first movement is final, and only a
      gesture locked as a swipe may switch storeys. Mirror check: a horizontal
      lead-in locks the swipe — the plan never slides under it, and if the
      trajectory then bends vertically and no longer qualifies as a swipe, the
      gesture simply does nothing (it does not turn into a pan). Straight
      swipes still switch, straight vertical drags still pan, a motionless
      double tap still resets the zoom [auto: smoke_kiosk_pan_lock]
- [ ] **Adaptive grid** (§7): in the Plan editor zoomed far out the grid does
      not merge into a grey wash — fine dots thin out, every 5th/10th node
      stays bigger; zoomed in the grid is the usual one and snapping still
      lands on the same nodes as before
- [ ] **Everything else on a far-out plan**: sun wedges, glow radii, open
      boundaries, room resize handles/rulers, opening rulers, split/merge,
      vacuum trails, the static `houseplan-space-card` and kiosk carousel all
      behave exactly as on a plan inside `0..1`
- [ ] **Real config regression**: a production config (e.g. the dacha, 3
      floors / 106 markers) frames bit-identically to the previous release —
      no outliers reported, no frame movement

## Batch 2026-08-04 (dev, unreleased)

- [ ] **Room borders have no teeth** (owner 2026-08-04): draw a room with a
      sharp corner (a wedge with a 30-60° apex, or an L) — the corner is
      ROUNDED off by the stroke's own radius, never a spike sticking out past
      the two walls and never a flat bevel. Same in the plan View, in the Plan
      editor and on the static `houseplan-space-card`; a room with OPEN
      boundaries (its trimmed outline) has round corners too
      [auto: smoke_render_parity, still: demo/shot_room_joins.mjs]
- [ ] **The Background editor measures what you draw** (owner 2026-08-04, «в
      редакторе подложки у линий писать длину»): while a decor LINE is being
      dragged out, a badge on the MIDDLE of the segment shows «length · angle»
      in the HA unit system (`cell_cm`, metres or feet) and turns green on a
      45° multiple — exactly the badge a wall gets in the Plan editor. It
      updates on every move, is absent before the drag has any length, and is
      gone the moment the shape is committed. Rectangles show «W × H» plus
      area; circles show `R`, and non-circular ovals show `Rx × Ry`
      [auto: smoke_decor]

## The text block on the plan (docs/LIVE-TEXT.md, dev, unreleased)

- [ ] **One text, many HA variables**: write `Бак {sensor.tank}, зал
      {climate.hall:current_temperature}` — both values render and update
      independently. The hand-written dotted attribute form
      `{climate.hall.current_temperature}` works too; ordinary/invalid braces
      stay literal [auto: smoke_live_text + unit logic.test]
- [ ] **Picker inserts at the caret**: put the cursor between two words, choose
      an entity and then its state/attribute — the full token appears exactly
      at that selection and focus returns immediately after it. Continue typing
      and insert another variable until the textarea's 200-character limit
      [auto: smoke_live_text]
- [ ] **No separate unit/preview/single-slot UI**: the dialog has none of the
      old unit field, `{}` hint, or preview block. State units come from HA;
      attributes do not inherit the state unit, and a custom suffix is ordinary
      text after the token [manual]
- [ ] **A dead sensor says so**: make the entity unavailable (or delete it) —
      the value becomes «—» and the rest of the caption stays. The dash carries
      no unit [auto: smoke_live_text]
- [ ] **Nothing is rounded**: a sensor reporting `23.94781` shows `23.94781`.
      Rounding is the sensor's `display_precision`, not ours [auto:
      smoke_live_text]
- [ ] **Old links migrate without loss**: a stored beta.9 `text + entity/attr`
      label still renders unchanged. A representable link moves into the
      textarea token and drops legacy fields on save; an explicit `unit` or an
      attribute name outside the inline grammar remains legacy and survives an
      otherwise unrelated text/colour edit
      [auto: smoke_live_text]
- [ ] **The same everywhere**: the label reads identically in View, in the
      editors and on a kiosk screen [auto: smoke_live_text]
- [ ] **Physical text size**: the dialog has no Small/Medium/Large; instead it
      exposes a numeric centimetre/inch size. Select a label and pull a corner
      — the text scales uniformly about its anchor even with Shift; the handle
      above it turns the block in 5° steps, Shift for any angle. A new/edited
      label stores `size_cm`, while legacy `size/scale` remains pixel-identical
      until edited or explicitly optimized. Rotating back to zero leaves a straight label
      [auto: smoke_decor_text]
- [ ] **Old labels keep their size**: a plan made before the handles renders
      its Small/Medium/Large labels at exactly the old 14/20/30 px, and the
      first corner drag converts that setting into the equivalent `size_cm`
      [auto: smoke_decor_text + unit logic.test]
- [ ] **Enter is a new line**: type two lines in the dialog (Ctrl/⌘+Enter or
      the button saves) — the plan shows two lines, centred, growing around the
      anchor. A very long single line is NOT wrapped for you
      [auto: smoke_decor_text]
- [ ] **The text tool edits the label under the cursor**: with the text tool
      selected, press an existing label — its form opens, prefilled, and no
      second label is created. Press empty canvas, or a line/rectangle, and a
      NEW label is created there instead (non-text shapes stay inert under
      drawing tools) [auto: smoke_decor_text, smoke_decor]
- [ ] **A text label has one atomic hit area where supported**: in Chromium,
      clicks between glyphs and on multiline gaps still select/edit/erase the
      whole label via `pointer-events: bounding-box`. Gecko/WebKit fall back to
      `visiblePainted`: glyph clicks must still edit the existing label instead
      of creating a new one, while gap hit-testing may degrade to painted ink
      [auto: smoke_decor_text (Chromium); manual: Firefox/Safari fallback]
- [ ] **A label is still a caption, not a device**: no tap action, no icon, no
      part in room averages; it is not offered in any of the device pickers
      [manual]
- [ ] **Grazing sunlight** (dev, audit DEV-EB173-01): with `sun_rays` on, set
      the sun almost ALONG a wall carrying a window (e.g. a west window,
      azimuth 190°, elevation 90° at north_deg 0). The shaft is a true
      parallelogram — both sides exactly as long as the nominal reach, 70 % of
      the pre-v1.57 curve — the whole pane of glass is at FULL brightness (no
      end of the window starts out transparent), and the light fades along the
      ray, dying out before the far edge. A sun within ~3° of the wall plane
      (`RAY_MIN_COS`) casts nothing at all [auto: smoke_sun_soft + unit sun.test]
- [ ] **Nothing stops at the old canvas border** (owner 2026-08-04, DEV-B58-01:
      «названия комнат и устройства не перетаскиваются дальше старых границ
      холста»). On an ORDINARY plan (rooms inside 0..1), in the Devices editor
      drag a marker far outside the drawing — to about 2.5 / 2.2 normalised. It
      follows the cursor the whole way, the position is stored, the plan's frame
      grows to include it, and it is still there after a reload. Repeat with a
      room NAME in the Plan editor (this one used to stop at the old unit square
      exactly), with a decor shape in the Background editor (draw it far out,
      then drag it further), and with an opening on a wall that lives past the
      old square. The only thing that still stops you is ±5000 — drag wildly and
      the marker parks there instead of at 1e12 [auto: smoke_drag_bounds]
- [ ] **Everything lands on the grid** (owner 2026-08-04, docs/CANVAS.md §9):
      place a device, a room name, a decor rectangle, a decor text, a room
      vertex and a resize handle with the mouse — each ends exactly on a grid
      node, never between two. An opening is wall-bound rather than freely
      grid-bound: it stays ON its wall, at a whole number of steps along it.
      Holding **Shift** must not bypass the grid. For a room-outline vertex it
      additionally selects the nearest grid node on a 45° ray from the previous
      point; all other positions keep their existing modifier behaviour
      [auto: smoke_grid_snap]
- [ ] **«Выровнять всё по сетке»** (owner 2026-08-04): gear → general settings →
      **Grid** → the button. On an already tidy plan it says everything is
      already on the grid and offers no confirm button. On a plan with elements
      between the nodes it names how many will move and the largest shift in cm,
      and warns there is no undo. Press it: rooms, decor, markers and room names
      snap to nodes in ONE write, openings stay on their walls, and pressing the
      button a second time reports nothing to do. Cancel does nothing at all
      [auto: smoke_grid_snap + unit test/align-grid.test.mjs]
- [ ] Optimizer migration safety: legacy decor width/text size is clamped to
      the backend schema, `fill: true` receives explicit fill style, invalid
      legacy `plan_scale` is preserved for repair, an already canonical plan is
      a no-op, a future model version is never downgraded, and zero/null/negative
      `cell_cm` is repaired to the 5 cm default (positive subminimum values clamp
      to 0.1 cm)
      [unit: plan-optimizer.test.mjs; backend: test_validation.py]

## Backdrop picture: move & scale (docs/BACKDROP.md, dev)

- [ ] **The frame is there, and only there** (owner 2026-08-04): open a space
      that HAS an uploaded plan image → **Редактор подложки**. It opens on
      Select; the toolbar contains «Картинка-подложка». Select that tool: a
      dashed, rotated frame hugs the picture with four corner handles and one
      upper rotate handle. Switch to Select / Line / Rectangle / Oval / Text /
      Furniture / Erase — the frame disappears and the image is pointer-inert.
      Leave for View, Plan, Devices or kiosk — no frame anywhere. A space with
      NO image has no image tool [auto: smoke_backdrop, smoke_decor]
- [ ] **Opacity is contextual**: under Select or any drawing/furniture/erase
      tool the image opacity is exactly 0.5; under Plan backdrop it is 1.0.
      View, Plan, Devices, kiosk and the static card always use 1.0
      [auto: smoke_backdrop, smoke_hide_layers]
- [ ] **The corner handles are beads, not blobs** (owner 2026-08-05,
      «уменьшить в 4 раза… они постоянно гигантские»): the four dots on the
      picture's frame are small — they must not cover the picture — yet a
      finger still lands on them without aiming. Same on the room-resize
      frame (Plan → «Размер», click a room) and on the robot-map calibration
      [auto: smoke_hide_layers, smoke_backdrop, smoke_room_resize]
- [ ] **Dragging the picture moves the picture, and nothing else** (owner
      2026-08-04): with the «Картинка-подложка» tool (the cursor over the
      picture is a hand), grab the picture by its body and pull it aside.
      It follows the finger the whole way — it must NOT drift away from the
      cursor or jump when the toolbar changes — while the rooms, walls, doors,
      windows, devices, room names and decor stay exactly where they were.
      Release, reload the page — the picture is still where you left it
      [auto: smoke_backdrop]
- [ ] **One-finger pan survives** (regression, DEV-B58 «таскать план при любом
      масштабе»): back on the «Выбрать» tool, drag across the middle of the
      picture — the PLANE pans, the picture does not move. Same at 50 % and
      33 % zoom [auto: smoke_backdrop, smoke_pan_any_zoom]
- [ ] **The corners scale it evenly**: pull a corner handle. The picture grows
      and shrinks in BOTH directions at once, keeps its proportions (nothing
      is stretched), and the OPPOSITE corner does not move a pixel. Try all
      four corners; the cursor over a handle is a diagonal resize arrow. On a
      tablet the handles are big enough to hit with a finger. Repeat with
      Shift: width and height now change independently, but stay grid-bound
      [auto: smoke_backdrop]
- [ ] **Rotation and numeric properties**: the upper handle rotates around the
      image centre in 5° steps; Shift allows any angle. Double click the image
      while its tool is active, enter width/height in m/ft and an angle, save,
      reload and compare. Esc during a live transform restores pointer-down;
      after release Ctrl+Z restores and Ctrl+Y reapplies it [manual + unit:
      backdrop.test.mjs]
- [ ] **Live size in metres**: while dragging or scaling, a badge in the middle
      of the picture states its real size, «Ш × В», in the same units the wall
      ruler uses (metres, or feet on an imperial HA). Change the space's
      `cell_cm` in its settings and the numbers change with it. The badge
      disappears on release [auto: smoke_backdrop]
- [ ] **Mandatory snap**: after a plain drag the picture's corner sits on a
      grid node (zoom in on the corner — it is on a crossing, not between
      two). After a corner scale one side of the picture ends on a node too;
      holding Shift produces the same snapped result [auto: smoke_backdrop]
- [ ] **«Вернуть картинку»**: the button appears in the backdrop toolbar only
      after the picture has been moved, scaled or rotated. Press it — the picture goes
      back to centred, at its own size and zero angle; Undo restores the prior
      transform, and the button disappears at the reset state
      [auto: smoke_backdrop]
- [ ] **NEW PAPER RULE — the sheet is the rooms** (owner 2026-08-04, changes
      the old behaviour): set a loud `bg_color` (or `daynight`) on a space
      that has BOTH a picture and drawn rooms, then shrink the picture with a
      corner handle. The opaque white/card-coloured sheet follows the ROOM
      CONTOURS — it is no longer a rectangle the size of the picture. The
      scene colour is visible around the rooms, including in the pocket of an
      L-shaped house and between detached buildings. The picture is drawn ON
      that sheet: above it, below the walls, doors, decor and devices. A space
      with a picture and NO rooms has no sheet at all, so a transparent PNG
      shows the scene through itself — deliberate
      [auto: smoke_backdrop + smoke_bg_color, still: demo/shot_backdrop.mjs]
- [ ] **«Вписать всё» does not lose the picture**: drag the picture well away
      from the rooms (or scale it right down), leave the editor, press «Вписать
      всё». The view frames the rooms AND the picture; the "home is that way"
      arrow points at them together [auto: smoke_backdrop]
- [ ] **The static card and the kiosk agree**: put a `houseplan-space-card` for
      the same space on a dashboard and open the kiosk view. Both draw the
      picture at the same offset, independent size and angle, with the same room-contour paper
      [auto: smoke_backdrop, smoke_render_parity]
- [ ] **Old plans are untouched**: a space whose picture has never been moved
      renders exactly as before the update — same place, same size. Nothing is
      written to its config until the first drag [auto: unit test/backdrop.test.mjs
      + tests_backend/test_validation.py]

## Sun ray rim (docs/SUN.md «The rim», dev, unreleased)

- [ ] **A ray reads on white paper**: with `sun_rays` on and a LIGHT scene
      (`bg_mode: daynight` at midday, or a white plan), a lit wedge is bounded
      by a thin dark hairline along its two SIDE edges — the ones running
      inward from the ends of the window. There is NO line across the glass and
      none across the far end; the hairline fades out with the light and is
      already gone before the wedge's tip [auto: smoke_sun_rim]
- [ ] **It stays a hairline**: zoom the plan all the way in and all the way out
      — the line is one pixel wide at every zoom, never a growing black band.
      Check on a phone and on a kiosk display too [auto: smoke_sun_rim
      (`non-scaling-stroke`), still: demo/shot_sun_rim.mjs]
- [ ] **It is not an outline on a dark scene**: switch to the glow fill or
      night — the rim is a subtle darker edge on the shaft, not a drawn contour
      around it [manual, visual]
- [ ] **It lives and dies with the wedge**: below 3° it goes with the wedge in
      the same two-second fade (not a frame before, not a frame after); weather
      does not alter either layer; the editors show neither; the kiosk and the
      plan view agree
      [auto: smoke_sun_rim + smoke_sun]
- [ ] **A wall still stops it**: point the sun so a shaft runs into the
      opposite wall or into the inner corner of an L — the hairline stops on
      the wall exactly where the wedge does, and never continues into the next
      room [auto: unit sun.test «a room that cuts the shaft cuts the rim»]

## «Already uploaded» plan picker (dev, unreleased)

- [ ] **«Already uploaded» is a list, not a stripe**: in both space dialogs
      (new space and space settings, source = "I have a floor-plan image")
      press «Already uploaded» with at least five plans on the server. The box
      is a few hundred pixels tall, the first thumbnail is fully visible inside
      it, and the rest scroll. With nothing uploaded the box shows its message
      instead of clipping it. Repeat at phone width. Measure heights, do not
      trust the DOM: the rows were always there, the box was 14 px
      [auto: smoke_plan_picker]

## «+» adds a space from anywhere (dev, unreleased)

- [ ] **The button is where the floors are, always**: as an admin, open the
      card in View — the «+» sits at the end of the tab row next to the floor
      names, is at least icon-sized and actually hittable (nothing overlaps
      it), and opens the NEW-space dialog. Repeat in all three editors (Plan,
      Devices, Background): the same button in the same place, not only in the
      Plan editor as before [auto: smoke_gear_tabs]
- [ ] **A kiosk has no «+»**: a card with `kiosk: true` does not RENDER the
      button at all — checking that the header is `display:none` is not
      enough, a hidden node is still clickable from script [auto: smoke_gear_tabs]
- [ ] **The tab row still fits a phone**: at 390 px the row wraps, nothing
      scrolls sideways out of the card, and the «+» stays inside the card and
      hittable [auto: smoke_gear_tabs measures `scrollWidth` vs `clientWidth`]
- [ ] **A non-admin never sees it**: the button follows the same rule as the
      per-space gear (`_canEdit`) [manual, needs a non-admin HA user]

## Coming back to the tab (docs/WARM-REMOUNT.md, dev, unreleased)

- [ ] **A quick return does not flash**: leave the browser tab or minimise the
      window for a few seconds and return. The existing viewport, day/night
      background and room hover remain painted continuously; neither
      `skysnap` nor the long-sleep `hpresume` veil is armed
      [auto: smoke_sun_live_bg]
- [ ] **The view does not twitch**: pan the plan into a corner and zoom in
      (say 2.5×), leave the tab for long enough that HA reconnects, come back —
      the plan is in exactly the same place at exactly the same scale. Not
      «about the same»: the restored viewport is the same rectangle, and the
      smoke compares it frame by frame [auto: smoke_warm_dialogs]
- [ ] **The same inside an editor**: do it while the Devices editor is open at
      a working zoom (say 350 %) — the editor and its zoom both come back
      (before the fix the mode came back and the zoom fell to 100 %). Leaving
      the editor afterwards still restores the view-mode viewport
      [auto: smoke_warm_dialogs]
- [ ] **An open dialog stays open**: leave the tab with the space settings (or
      a device card) open and a field edited but NOT saved — on return the
      dialog is still there with the same draft [auto: smoke_warm_dialogs]
- [ ] **A closed dialog stays closed**: close it with Esc (or Cancel, or Save)
      and only then leave the tab — nothing reopens on return, and it does not
      reappear on a second reconnect either (the snapshot is consumed once)
      [auto: smoke_warm_dialogs]
- [ ] **Confirmations are never resurrected**: open «Align everything to the
      grid», leave the tab, come back — the confirmation is GONE and the plan
      is untouched. Same for the room-merge confirmation. This is deliberate:
      a modal whose whole content is «press OK to rewrite your plan» must not
      be waiting under a returning user's cursor [auto: smoke_warm_dialogs]
- [ ] **Nothing is revived into the wrong place**: switch to another floor (or
      another editor) after the reconnect — a dialog that belonged to the old
      space/mode does not appear there [auto: smoke_warm_dialogs (space/mode
      guard), manual for the floor switch]
- [ ] **A save in flight is not offered twice**: press Save in the space dialog
      and reload/reconnect during the write — the dialog does not come back
      with a live Save button; the reloaded config shows the outcome [manual]
- [ ] **Two identical cards keep to themselves**: put the SAME card config
      twice on one view, park one in the Devices editor at 350 % and leave the
      other in View with an unsaved space dialog, then force a rebuild — each
      card comes back with its OWN floor, mode and zoom, and the draft returns
      to the card that owned it, not to its neighbour (AUD-159B1-01)
      [auto: smoke_warm_owners, section A]
- [ ] **Two dashboard views keep to themselves**: the same card config on two
      views of one dashboard — switching between them never carries a viewport
      or a dialog across (`location.pathname` is part of the key) [manual]
- [ ] **A rebuild storm keeps the draft**: a dashboard that rebuilds twice in a
      row (config churn, a flapping websocket) still returns the unsaved dialog
      — the draft travels down the chain of instances (AUD-159B1-02)
      [auto: smoke_warm_owners, section B]
- [ ] **A forgotten draft frees its plan file**: open the space dialog with a
      plan chosen, leave the view and do not come back — after the 10-second
      TTL the memo no longer holds the dialog (a plan is base64 in memory), and
      nothing revives afterwards (AUD-159B1-03)
      [auto: smoke_warm_owners, section C]

## Styling hooks and HA-formatted values (docs/STYLING-HOOKS.md, dev, unreleased)

- [ ] **The hooks are there and they are the config's ids**: open the plan's
      DOM (devtools → the card's shadow root) and check that a device marker
      carries `data-hp="device"`, `data-id`, `data-entity` and `data-area`; a
      room `data-hp="room"` + `data-id` + `data-area`; a door/window/gate
      `data-hp="opening"` + `data-kind`; a decor shape `data-hp="decor"` +
      `data-kind`; a room caption `data-hp="room-label"`; a floor tab
      `data-hp="space-tab"`. The ids are the ones in your config, not DOM
      positions — they survive a reload [auto: smoke_styling_hooks]
- [ ] **Absent is absent**: a virtual marker has NO `data-entity` at all, and a
      sub-area room (no HA area) has NO `data-area` — never the string
      «undefined» [auto: smoke_styling_hooks]
- [ ] **A card-mod rule actually applies**: with card-mod installed, add
      `ha-card [data-hp="device"] .lqi { display: none; }` to the card — the
      signal badges disappear and nothing else moves. Then target one marker by
      `[data-entity="…"]` and confirm it is the only one affected [manual]
- [ ] **The static card carries the same hooks**: a `houseplan-space-card`
      has `data-hp` on its rooms, room labels and markers (it draws no openings
      and no decor, so those are simply absent), and it needs its OWN card-mod
      block — it is a different card with its own shadow root
      [auto: smoke_styling_hooks]
- [ ] **`ha-icon` internals stay out of reach**: a rule may style the icon HOST
      (colour, transform) but cannot reach the `<svg>` inside it. That is a
      browser rule, and it is why the hooks sit on our wrappers
      [auto: smoke_styling_hooks]

- [ ] **A value badge is formatted by HA**: set a numeric sensor's display
      precision in HA (Settings → the entity → Display precision) to 1 and put
      it on the plan as «value instead of icon». The badge shows the rounded
      number with YOUR decimal separator and the entity's unit — once, not
      twice — and matches what more-info shows [auto: smoke_value_format]
- [ ] **A live decor label is formatted by HA**: the same sensor in a text
      shape reads identically; a switch shows «Включено», not `on`; an
      attribute goes through the attribute formatter (a climate's
      `current_temperature` is a number, not the climate's state)
      [auto: smoke_value_format + unit logic.test]
- [ ] **A literal suffix stays literal**: write an attribute token followed by
      ` проц.` — the suffix is part of the text, with no hidden unit override
      and no duplicate appended by the label renderer [auto: smoke_live_text]
- [ ] **An older Home Assistant is unchanged**: on an HA without
      `formatEntityState` the badge and the label print the raw state with the
      entity's unit appended, exactly as before — nothing is blank and nothing
      throws [auto: smoke_value_format + unit logic.test]
- [ ] **The °/% plates are untouched**: the small temperature/humidity badges
      next to an icon (and the same numbers in a room card and the tooltip)
      still read «21.5°» / «48%». They are a derived reading, not an entity
      state — deliberately ours [auto: smoke_value_format]

- [ ] **The text block's handles are small but still catchable**: select a
      label in the Background editor. The four corner circles and the rotate
      handle are a quarter of their old size — beads, not buttons — and the
      dashed frame no longer hides the text. Now grab one on a TABLET with a
      finger, aiming roughly at it rather than exactly: it is caught, because
      the invisible hit circle is still the old finger-sized one. Same at any
      zoom [auto: smoke_decor_text]

## The furniture library (docs/FURNITURE.md, dev, unreleased)

## Wall thickness (docs/WALL-THICKNESS.md, Unreleased)

- [ ] **Walls + adjacent draw thickness**: the first Plan-editor tool is named
      “Walls” / «Стены» rather than “Add”; while it is active, its thickness
      field is the immediately following toolbar element, before Merge. The
      field still defaults to 15 cm and disappears when another tool is selected
      [auto: smoke_draw_wall_thickness]
- [ ] **Tool + hover + input**: Plan editor → Thickness. Hover highlights
      the whole wall; click opens the cm/in field; empty/0 clears; Esc closes
      without applying; «Apply to all walls of this room» fills every allowed
      edge [auto: smoke_wall_thickness]
- [ ] **Hatched body, clean-floor area**: after setting thickness a `.wallbody`
      path appears; room-card and tooltip m² both decrease to the same inner-
      contour area
      [auto: smoke_wall_thickness]
- [ ] **Openings cut the slab**: a door/window/gate on a thick wall leaves a gap in
      the body; the door swing is offset toward the inner face and gate leaves
      toward the exterior face; with
      `hide_openings` the symbols hide but the cut remains
      [auto: smoke_wall_thickness]
- [ ] **Opening tunnel repeats the room fill**: check a door, window and gate on
      outer and shared thick walls. An outer opening uses its room colour for
      the complete wall depth; a shared opening with different fills has one
      hard transition exactly on the wall axis and no white/alpha seam. Window
      glass and all architectural symbols remain above it. Repeat with hidden
      opening symbols, hidden wall borders and in the Background editor; Glow
      and sun geometry must not change
      [auto: smoke_opening_tunnel_fill + test/wall-thickness.test.mjs +
      test/logic.test.mjs]
- [ ] **Opening association and overlap edges**: a parallel room separated by
      an air gap does not colour the outer half; a perpendicular T arm does not
      capture the opening; a 45° wall keeps its local-axis split; nested rooms
      resolve deterministically; a legacy opening beyond an endpoint paints
      only the real wall interval. Exact and partial duplicate openings do not
      stack alpha, and an angle-invalid opening is consistently rejected by
      symbol offset, wall cut and tunnel fill
      [auto: test/wall-thickness.test.mjs]
- [ ] **Door/gate light uses the clear tunnel**: place an off-centre light beside a
      door or gate in a thick wall. In the neighbouring room the glow is limited by
      sight lines through both the near and far inner-face corners; neither
      side crosses a solid jamb return. Clearing wall thickness restores the
      wider centreline-based sector [auto: test/logic.test.mjs; manual visual]
- [ ] **Wide gate stays compact**: add a 300–400 cm Gate. It has two equal
      leaves with no swing arc; without a contact they open exactly 10°
      outwards, and a closed/open contact changes the angle between 0° and
      10°. A lock badge and Glow tunnel behave exactly like a door
      [auto: test/logic.test.mjs + test/wall-thickness.test.mjs +
      tests_backend/test_validation.py + smoke_styling_hooks]
- [ ] **Shared once / clear → line / resize re-keys**: one body for a shared
      wall; clearing thickness restores the centreline; resizing a thick wall
      keeps the thickness on the moved stretch, including both atomic solid
      remainders around a partial virtual span
      [auto: smoke_wall_thickness + smoke_resize_virtual_thick]
- [ ] **Virtual T-junction**: when two real thick arms from different room
      contours meet at an `open_span` endpoint, the outside corner is a clean
      mitre with no stair-step. In every editor the saved dash and the two-click
      rubber band paint above the real hatch right up to the centreline; in
      View the same saved dash paints below the body, so each thick jamb masks
      its centreline end without shortening the stored span
      [auto: test/wall-thickness.test.mjs + smoke_resize_virtual_thick]
- [ ] **Fragment normalisation**: draw adjacent/overlapping virtual stretches
      along the same pair of rooms — they persist and select as one span. Close
      the last virtual stretch — consecutive solid fragments merge into maximal
      runs of equal thickness; equal neighbours become one, a thickness change
      remains an exact endpoint. Resize transforms those endpoints. Repeat
      across a Split boundary: spans owned by different room pairs must stay separate
      [auto: test/open-spans.test.mjs + test/wall-thickness.test.mjs +
      smoke_resize_virtual_thick]
- [ ] **Unit + backend**: inset/mitre/bevel, key from either end, degrade,
      rekey, cm↔inches; `walls` schema bounds
      [auto: test/wall-thickness.test.mjs + tests_backend/test_validation.py]
- [ ] **Thin-on-screen parity**: at the same card width a 1 cm wall suppresses
      the hatch (solid fill stays) in both `houseplan-card` and
      `houseplan-space-card`; a 20 cm wall restores the hatch in both
      [auto: smoke_wall_thickness + test/wall-thickness.test.mjs]
- [ ] **Split through an open span**: split one side of a shared wall through
      the middle of an existing open stretch. Both resulting pieces remain in
      `open_spans`, and both new rooms link to the neighbour in `open_to`
      [auto: smoke_merge_split + test/open-spans.test.mjs]

## The furniture library (docs/FURNITURE.md, dev, unreleased)

- [ ] **The tool and the palette**: Background editor → **Furniture**. A panel
      opens under the bar with the symbols grouped (furniture / appliances /
      plumbing / other), every tile drawing the real symbol, and the plan stays
      visible behind it [auto: smoke_furniture]
- [ ] **Real size through `cell_cm`**: pick the sofa, click in the middle of a
      room, then measure it against the plan's own grid — it is 2.2 m wide and
      0.9 m deep. Change the space's scale (Space settings → cm per cell) from
      5 to 10 and place a second sofa: it covers the same 2.2 m of the plan,
      i.e. half as many cells [auto: smoke_furniture + furniture.test]
- [ ] **The size fields**: pick the bath, type 1.5 in Width, click — the piece
      is 1.5 m, not 1.7. In an imperial HA profile the same fields read and
      accept FEET, and the stored plan is unchanged when you switch back
      [auto: smoke_furniture (metric); manual for the imperial profile]
- [ ] **The wall magnet**: click near a wall — the piece's BACK lands flat on
      it and it turns to the wall's direction (a bed's headboard against the
      wall, a toilet's cistern against it, a sofa's back against it). Holding
      **Shift** bypasses the wall magnet but still lands through the
      decor/room/grid magnet, never between grid nodes
      [auto: smoke_furniture]
- [ ] **The magnet while dragging**: drag a placed sofa across the room to
      another wall — it turns to that wall as it arrives. Drag it back into the
      middle: it keeps the angle it had rather than snapping straight. On a
      DIAGONAL wall it lands at the wall's own angle [auto: smoke_furniture for
      the axis-aligned case; manual for a diagonal wall]
- [ ] **One stamp per pick**: after placing, the editor is back in **Select**
      with the new piece selected, and the palette is disarmed — clicking the
      plan again does not place a second one [auto: smoke_furniture]
- [ ] **The frame is the text block's frame**: four corner beads and a rotate
      handle, the beads a quarter of their hit area. Grab one with a finger on
      a tablet, aiming roughly: it is caught [auto: smoke_furniture]
- [ ] **Proportional by default**: drag a corner sideways or down — the current
      ratio is preserved about the opposite corner. Hold Shift to change width
      and depth independently. Two live badges show both in metres (or feet)
      while you drag, and they match a later measurement against the grid;
      neither mode creates sizes off the grid
      [auto: smoke_furniture]
- [ ] **Rotation**: the handle above the box turns the piece in 5° steps about
      its CENTRE (not a corner); Shift goes past the step; turning back to
      straight removes the angle entirely [auto: smoke_furniture]
- [ ] **Complete properties**: double click a piece and change its symbol,
      width/depth in m/ft, angle, contour colour/opacity and line width in
      cm/in. Save keeps its centre/transform and reloads exactly; Cancel changes
      nothing; reopening a non-first symbol selects that exact option
      [auto: smoke_furniture; manual]
- [ ] **It is only decor**: a piece takes no tap in view mode, has no entity
      and no state, and does not appear in any room aggregation. Erase removes
      it; Delete removes the selected one [auto: smoke_furniture]
- [ ] **Old plans and old servers**: a plan saved before this release opens
      unchanged. A plan WITH furniture saved by this card and opened by an
      older integration still saves (the backend accepts any well-formed symbol
      id) [auto: tests_backend test_decor_furniture; manual for the old server]
- [ ] **card-mod**: `[data-symbol="toilet"] { stroke: #4fc3f7; }` colours only
      the toilets [auto: smoke_furniture checks the attributes; manual for the
      rule itself]

## Unfinished outlines, partitions and columns (dev, unreleased)

- [ ] **Persistence and joining**: draw two unfinished outlines, switch tools,
      reload and resume each from either end. Continue one into the free end of
      the other: one draft id remains, segment thicknesses keep their order,
      and an endpoint-to-endpoint loop opens the room dialog. A click in the
      middle never creates a branch [auto: smoke_free_walls; backend schema].
- [ ] **Creation limits and validation**: 1/100 cm partitions and 1/150 cm
      columns save exactly. Zero, NaN and 101/151 cm block the final click with
      a range toast and create no history entry. Client caps match backend:
      200 drafts, 500 points per draft, 2000 total draft segments, 2000
      partitions and 500 columns [auto: backend validation + smoke_free_walls].
- [ ] **Select gestures**: creation tools click through existing physical
      bodies. Select gives at least a 24 px target, cycles overlaps on repeated
      clicks and moves a partition rigidly on the grid. Escape/pointercancel
      restores the pre-drag state. A square column rotates in 5° steps (Shift
      free); a circle has no rotation handle [auto: smoke_free_walls; manual].
- [ ] **Delete contract**: Delete on a selected draft asks once and removes the
      whole outline. Its properties dialog has distinct “Delete segment” and
      “Delete entire outline” actions; a middle-segment split respects the
      draft-count cap [auto: smoke_free_walls; manual dialog labels].
- [ ] **Area and light**: overlapping bodies are subtracted once from clean
      area; closed partition rings keep the enclosed floor; bodies outside all
      rooms create no paper. Glow does not cross a long nearby partition and a
      source inside masonry lights nothing. Window rays are blocked by the same
      bodies. `show_borders: false` changes paint only [auto:
      physical-geometry.test; manual visual].
- [ ] **Lifecycle/performance**: an external config revision cancels live
      move/rotate state before replacing geometry. Drag preview performs no
      polygon boolean work; clean floor and Glow clips are reused until the
      config/space/source changes [auto: editor/preloader smokes; performance
      profile for a dense plan].

## Hiding layers: decor, openings, virtual walls (docs/UX-MODES.md, dev, unreleased)

- [ ] **«Скрыть декоративный слой»** (owner 2026-08-05): a space with lines,
      labels or furniture on it → space settings → Display → tick the box, save.
      The plan loses all of it, in View, in the Plan editor and in the Device
      editor. Open **Редактор подложки** — everything is back, editable, exactly
      where it was. Untick it: the plan looks as it did before you started
      [auto: smoke_hide_layers]
- [ ] **«Скрыть проёмы»**: tick it on a space with doors, windows and gates. The
      symbols are gone from View and from the Device editor; the **Plan editor
      still draws them**, or the Opening tool would be editing blind. Nothing
      else changed: a lit room still spills light through a door/gate, the sun
      still comes in at the window, a door with a contact sensor still reports
      open/closed in the room card, and the resize tool still refuses to
      shorten a wall past its opening [auto: smoke_hide_layers, smoke_glow]
- [ ] **Virtual walls follow the borders switch only in View** (owner 2026-08-05): make an
      open boundary between two rooms (Plan → «Граница», two points), then turn
      **«Всегда отображать границы комнат» OFF**. The dashed stretch goes with
      the borders — no floating dashes on a plan that draws no walls. Turn the
      borders back on and it returns. In Plan, Devices and Background editors
      the dashes are always visible, whatever the switch says
      [auto: smoke_hide_layers, smoke_openwall]
- [ ] **Nothing is stored when nothing is hidden**: with both boxes unticked,
      the space's config carries no `hide_decor` / `hide_openings` at all, and
      a plan saved by an older card still opens here unchanged
      [auto: smoke_hide_layers, tests_backend test_hide_layer_settings]
