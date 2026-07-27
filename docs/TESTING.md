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
      placed on the plan (hidden by curation or by the user) still feeds the
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
- [ ] Curation hides bridges/groups/scenes/excluded integrations; 👁 "show all" reveals [manual]
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
- [ ] RGB lights (v1.27.0): an on light with a color tints its icon/glow and the ripple
      (explicit ripple color still wins); off/white lights unchanged [manual]
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
      off, all off → all on, one service call); the icon and its RGB tint
      mirror the targets, not the marker's own entity; without explicit Toggle
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
