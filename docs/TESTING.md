# Manual testing checklist

> **Policy:** this checklist is updated **in the same commit** as any functional
> change (like CHANGELOG.md). Every release: run at least the smoke column on the
> synthetic demo (`demo/`), and the full list before major releases. Items marked
> `[manual]` are covered by unit tests or the headless smokes in `demo/` — they still
> deserve an occasional eyeball. File every failure as a GitHub issue before fixing.

> **What `[manual]` means (since 2026-07-27).** A named check exists that FAILS
> when the behaviour breaks — in `npm test` or in the smoke suite, both of which
> run in CI on every push. Where the check lives is written next to the marker
> (`[auto: smoke_modes]`). Before this date the marker described an intention:
> the smoke suite printed values and always exited 0, so 96 markers guarded
> nothing (external audit T1/T3). If you add a checklist line marked `[manual]`,
> add the failing check in the same commit.

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
      fixtures glows in the "Light sources" fill once "This device is a light
      source" is ticked (its own entity or the lights bound under "Controls");
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
      pointer through the tolerant helper; decor shapes cannot be dragged more
      than a quarter of the plan outside the viewBox [auto: smoke_decor]

- [ ] Room climate counts hidden sensors (v1.44.5): a thermometer that is NOT
      placed on the plan (hidden by filtering or by the user) still feeds the
      room card, the tooltip and the temperature fill; fridges/TRVs still do
      not; an explicit per-room source still wins [auto: unit devices.test]
- [ ] Room tooltip wording (v1.44.5): hovering a room shows its name (plus
      temperature/signal when available) and no longer claims "open the area" —
      room clicks were removed in v1.40.1 [manual]

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
- [ ] Openings in View (v1.28.1): the door/window itself is a pure drawing — no
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
      perpendicular dashed tick appears and the center magnet-snaps — Shift
      disables the magnet; badges and tick vanish on release
      [auto: smoke_opening_measure + unit openingShoulders]
- [ ] The SAME rulers while PLACING a new opening (2026-08-03): with the
      Opening tool, moving along a wall shows the dashed ghost together with a
      badge on each shoulder of the would-be opening (default 90 cm, measured
      on the snapped room's OWN edge), a perpendicular tick + magnet at that
      edge's centre, Shift opting out; the click places the opening at the
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
- [ ] Room dialog: area list shows only unassigned areas; picking an area prefills the name
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
- [ ] Live states: light on = yellow, open cover/lock/door = orange, unavailable = faded
- [ ] State icons (v1.26.0): auto icons morph with state — door/window/garage open↔closed,
      lock locked↔unlocked, bulb on; custom icons and unavailable states never morph [manual]
- [ ] display "Value instead of an icon": the marker shows the measurement (°/%/unit)
      as its body, small badges hidden; non-numeric fallback keeps the icon [manual]
- [ ] RGB lights (v1.27.0, contract changed in v1.52.0): a lamp's colour lives
      in its glow spot and the ripple fallback ONLY — the icon/badge/border get
      no RGB tint; explicit ripple color still wins; off lights unchanged
      [auto: smoke_light_badges + smoke_rgb_alarm]
- [ ] Alarm pulse (v1.27.0): leak/smoke/gas/CO/siren in 'on' pulse a red ring over any
      display mode; clears on 'off'; unavailable never alarms [manual]; reduced-motion static
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
- [ ] One indicator always (v1.52.1, HP-1520-01): in a glow space the plan
      editor (no glow layer) shows the lit lamp yellow again; the devices
      editor draws the layer and keeps the badge standard
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
      Indication: while travelling the icon breathes a soft yellow ring
      (.covermove, 2.2s, static under prefers-reduced-motion) and the plate
      stays NEUTRAL — yellow is «включено»; the icon morphs by state +
      device_class (blinds/shutter/curtain…), unknown state morphs nothing;
      no position percentages anywhere
      [auto: smoke_cover_tap + units resolveTapAction/coverService/stateIcon +
      backend test_cover_tap_action_is_accepted]
- [ ] Open/close works when the cover is NOT the primary entity (dev, owner's
      report 2026-08-04): a curtain driver that ships its `cover.*` hidden by
      the integration next to a visible `switch.*_reverse_direction` (Aqara
      E1 — his own) has a SWITCH for a primary; picking «Open/close» in the
      dialog, saving it and tapping the marker sends `cover.open_cover` to the
      cover, never touches the service switch and never falls back to the info
      card. The guarded class is read off that same cover, so a garage still
      degrades to info and is still not offered in the dialog
      [auto: smoke_cover_not_primary + unit coverEntityOf]
- [ ] Light-source badges (v1.52.0): in glow fill a lit lamp's badge stays
      standard (the spot is the indicator) and a lit socket stays yellow; in
      other fills a lit lamp is plain yellow with no RGB tint; morphing and
      the ripple colour fallback survive [auto: smoke_light_badges +
      smoke_rgb_alarm]
- [ ] Icon size multiplier scales the glyph (dev): set a marker's size to 3 —
      the icon inside grows with the badge instead of staying default
      [auto: smoke_icon_scale]
- [ ] Auto-grid parity (v1.51.2, HP-1511-01): with an empty layout, a visible
      device among hidden ones sits at the same spot on both cards
      [auto: smoke_hidden_flag autoGridParity]
- [ ] Ripple ghost (v1.51.2, HP-1511-02): a hidden ripple-display marker shows
      its base icon, no pulse [auto: smoke_hidden_flag rippleGhost*]
- [ ] Hidden LQI parity (v1.51.1, HP-1510-01): a room whose only Zigbee
      devices are hidden paints the same lqi fill on the full and the static
      card [auto: smoke_hidden_flag lqiParity]
- [ ] Ghost shows no numbers (v1.51.1, HP-1510-02): a hidden value-display
      device renders as a plain ghost — no value/temp/hum/LQI, no icon morph
      [auto: smoke_hidden_flag ghostHidesValue]
- [ ] Hide-from-plan flag (dev, docs/FILTERING.md): every device dialog has
      the checkbox, incl. virtual; hidden devices vanish from every mode and
      the count, still count toward room LQI, cast no glow/light fill; the
      device editor's "Show hidden" (local, per tab) shows them as BLUE
      dashed ghosts — distinct from a grey unavailable icon — with NO live
      state paint (no yellow, no alarm, no ripple);
      unticking keeps a hidden:false marker (re-seed protection); an old
      config materialises on first load by an editing client and legacy
      clients keep the old behaviour until then
      [auto: smoke_hidden_flag + unit seedHiddenBindings/seeded/legacy]
- [ ] Yellow means working (dev): a TRV whose hvac_action is heating glows
      yellow; one that is merely enabled (idle) or has a service switch on
      (anti-scaling, child lock) stays dark; a lit light turns its state on by
      the same condition that lights the glow pool — and shows the yellow
      badge only where the glow spot is NOT drawn: with the glow layer
      visible the spot is the one indicator (v1.52.0)
      [auto: smoke_yellow_principle + smoke_light_badges]
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
- [ ] Open-wall hover (v1.37.1): with the tool active the cursor is default;
      near a shared wall it turns pointer and the exact stretch that would
      open is previewed (amber dashed); an already-open boundary previews red
      solid (the click will close it); preview follows the cursor and clears
      on miss [auto: smoke_openwall]
- [ ] Open boundaries (v1.37.0): the Plan editor's "Open boundary" tool
      toggles a virtual wall between two rooms by clicking their shared wall
      (pull like Split; miss → toast); open stretches render dashed (amber
      highlight while the tool is active); glow light floods the whole
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
      since v1.52.0, target colours reach only the glow/ripple; without explicit Toggle
      the click opens info as usual; the info card lists targets with states;
      locks/other domains are filtered out of controls [auto: smoke_controls]
- [ ] Glow fill (v1.35.0): fill mode "Light sources" — every room painted with
      one uniform darkness color; lit lamps glow with a radial gradient
      (rgb_color → color temp → default color; brightness scales opacity),
      clipped by the source's room plus door sectors into NEIGHBOUR rooms
      (entrance doors leak nothing; windows don't spill); radius set in
      general settings in HA units (m/ft, stored in cm); no shadow casting —
      islands don't block light (documented limitation) [auto: smoke_glow]
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
      dialog's icon picker shows the auto-derived icon as its placeholder, plus
      an "Auto: mdi:..." hint line with the icon preview; the hint disappears
      once an explicit icon is picked [auto: smoke_icon_placeholder]
- [ ] No Reset button (v1.33.2): the Device editor toolbar has three tools —
      add, show all, icon rules; the layout-wiping Reset is gone [auto: smoke_editor_tabs]
- [ ] Grid in all editors + decor fade (v1.33.1): the dot grid shows in the
      Device and Background editors too (instant "I'm editing" cue), not in
      View; in the Background editor rooms/devices/openings/labels fade to 35%
      while decor shapes stay fully opaque; no fade in the other editors [auto: smoke_decor / smoke_grid_fade]
- [ ] Background editor (v1.33.0): third tab with its own toolbar (select /
      line / rect / oval / text / erase + color, width, fill, X); shapes drag-
      drawn with grid snap and live preview; degenerate shapes dropped; text
      via dialog (S/M/L, color; dblclick re-edits); Select moves (snap), Delete
      removes, Erase deletes on click; Esc: draft → selection → select tool →
      View; decor renders under rooms, visible everywhere, inert outside the
      editor; stored in space.decor (rev/lock, backend schema) [auto: smoke_decor / smoke_grid_fade]
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
- [ ] General settings gear (v1.30.3): the header cog is visible in every mode
      (admins), opens the palette dialog from View too [auto: smoke_gear_tabs / smoke_gs_always]
- [ ] Editor tabs (v1.30.2): only two tabs — "Plan editor" / "Device editor"
      (no View button; View is the default state); clicking a tab opens its
      bottom toolbar (Devices got its own bar with add/show-all/reset/rules);
      the bar and the active tab both show an X that returns to View; re-click
      on the active tab does nothing; Plan↔Devices switches directly [auto: smoke_editor_tabs]
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
- [ ] Remove: auto device → hidden marker (reappears via dialog "show all"? no — stays hidden until re-added); virtual → gone incl. its layout entry [auto backend]

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
- [ ] Room without area + borders ON → drawn, click does nothing, no area tooltip signal
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
      inside; a door/window on a shortening wall (the wall corner can not
      pass the opening edge)
- [ ] A door/window ON the moving wall travels with it (openings x/y
      recompute; angle unchanged)
- [ ] Esc mid-drag cancels: the original geometry is back instantly
- [ ] Click a room in the resize tool → dashed bbox frame with 4 corner
      handles; dragging a corner scales all vertices proportionally about
      the opposite corner; neighbours are NOT dragged along (the one
      exception to «shared walls together»), growing into one stops
- [ ] Ctrl+Z / ⌘Z after releasing a handle restores the previous geometry —
      one release = one undo step (rooms AND openings)
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
- [ ] Brightness + the 3° threshold (2026-08-03): wedges are visibly brighter
      (peak alpha 0.30, was 0.18) yet still readable over white paper AND the
      dark glow canvas; there is NO gradual ramp near the horizon — below 3°
      no rays at all, at/above 3° full strength; crossing the threshold fades
      the whole layer in/out over exactly 2 s (CSS on `.sunlayer`, the
      geometry never moves), and `prefers-reduced-motion` makes it instant.
      Every other way of losing the wedges (editor, feature off, night, rain)
      stays instant [auto: smoke_sun «the 3° threshold» + unit rayAlpha/
      raysVisible/rayPeakAlpha; shots: demo/shot_sun_bright.mjs]
- [ ] Weather entity (optional, global): cloudy fades the wedges, rain/snow
      removes them, a dead/unknown weather sensor changes nothing
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
