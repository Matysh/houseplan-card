# Ручной чек-лист по поверхностям

> Приложение к [`docs/TESTING.md`](../TESTING.md): перенесено оттуда дословно (#634).
> Индекс всех приложений — [`README.md`](README.md).

## Modes (v1.25.0) ★

- [ ] The card always loads in **View**; edit modes are never restored [manual]
- [ ] View: pan/zoom/space-switch/tap/long-press/tooltips only — dragging an icon,
      label or opening does nothing; panning may start on top of an icon [manual]
- [ ] View header: space tabs + count + zoom + editor tabs, the general-settings
      cog and the per-space gears (visible in EVERY mode since v1.30.1/v1.30.3
      for users who may edit); no editor toolbars [auto: smoke_modes]
- [ ] Space-tab reorder (#243): in an editor with at least three spaces, use a
      real mouse drag while browser pointer capture remains on the held tab;
      moving left resolves the tab under the cursor and paints its left divider,
      moving right paints the right divider, and each valid drop saves exactly
      once [auto: smoke_space_tab_reorder; golden: space-tab-drop-before-light,
      space-tab-drop-after-dark]
- [ ] Move a held space from a valid target out over the plan: the divider
      clears immediately and release does not save. `pointercancel` and removing
      the card mid-drag also end the gesture without changing order
      [auto: smoke_space_tab_reorder]
- [ ] A sub-threshold mouse gesture remains a tab click; the next click after an
      outside release still works. Touch, View and a card fixed to one `floor`
      never expose reordering [auto: smoke_space_tab_reorder]
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
- [ ] Physical rulers while PLACING a new opening (#238): one room shows two
      lines/four endpoint ticks from the preview jambs to the physical inner
      face endpoints. A shared wall shows four independently resolved lines/
      eight ticks, two on each room face. A finished independent wall stops per
      direction at the nearest physical face of a connected wall/partition and
      falls back to its own endpoint where none exists. Lines, ticks and labels
      update in the same frame as the preview and are pointer/ARIA inert; saved
      opening drag retains the legacy two badges and no new lines
      [unit: opening-dimensions; auto: smoke_opening_inner_distances +
      smoke_opening_measure]
- [ ] While PLACING a new opening: pressing **Opening** only
      opens the shared secondary tray; choosing Window / Door / Gate arms the
      120 / 90 / 300 cm session preset. Moving over a physical wall shows the
      complete architectural symbol at 50% opacity, above the masonry, together
      with the physical dimension badges and the existing centre tick/magnet. The
      preview accepts pointer hits anywhere inside a thick wall body, is absent
      on virtual spans and existing openings, and never carries an interactive
      or persistent identity. A direct click without prior hover resolves the
      same candidate authoritatively and opens its dialog. Save and Cancel keep
      the selected preset for repeated placement; tool/mode/space exit and Esc
      clear it [unit: opening-placement; auto: smoke_opening_preview +
      smoke_opening_measure; golden: opening-placement-door-thick-wall-dark]

## Onboarding ★

- [ ] Empty config, HA has floors → floors-import wizard offers them sorted by level [manual]
- [ ] Wizard: uncheck all → "Create" disabled; "Start from scratch" → classic dialog
- [ ] Wizard: N floors → space dialog per floor with prefilled name and progress "i of N"; Skip skips one; Cancel aborts the whole queue [manual]
- [ ] After the last wizard space (or first manual space) → markup mode auto-opens with a toast
- [ ] Empty config, no floors → classic "New space" dialog auto-opens once per session
- [ ] All floors skipped, nothing created → empty state with "Add space" button remains usable
      [auto: smoke_optional_space_model]

## Spaces ★

- [ ] Create with an image (SVG, PNG, JPG, WebP) → correct aspect, crisp at zoom (SVG)
- [ ] Oversized plan (>8 MB) → readable error toast, dialog stays open
- [ ] Create with "No image — I'll outline rooms by hand": orientation landscape/portrait/square respected [manual]; borders+names default ON [manual]
- [ ] Draw-space (no background) renders a WHITE canvas (paper-like), markup works on it; room borders/names stay legible on white [manual]
- [ ] Edit: rename; replace image; **switch image→draw detaches the plan** [manual]
- [ ] Delete space with rooms/devices → tab disappears, layout of other spaces untouched
- [ ] Delete the last space → empty state without console errors; active editor
      gestures and drafts are aborted, and creating the first space remains available
      [auto: smoke_optional_space_model]
- [ ] Display settings: borders toggle, names toggle, color picker + opacity slider live-preview after save, fill selector [manual]
- [ ] Fill "zigbee": rooms tint red→green by average LQI; rooms without zigbee stay unfilled [manual]
- [ ] Fill "lights": yellow when any light on, grey when all off, unfilled when the room has no lights [manual]; toggling a light from the plan recolors the room
- [ ] Fill "temperature": blue below the comfort range, green inside, yellow above [manual]; comfort bounds editable inline on the radio row (swapped bounds tolerated [manual], clearing a field cannot zero a bound [manual]); rooms without a temperature reading stay unfilled [manual]
- [ ] Fill mode is a radio group (no dropdown); labels carry no color legend
- [ ] Room hover adds a subtle accent wash and double contour without changing
      the underlying room fill or Glow brightness
- [ ] Room tooltip shows average room temperature and humidity after the area line and before LQI; missing values are omitted [auto: smoke_ux_fixes]
- [ ] General settings can hide only the room tooltip: default/Cancel/save/reopen
      semantics, skipped area work, persistent room highlight, unaffected
      device tooltip and restoration on the next mouse move
      [auto: smoke_room_tooltip_toggle]
- [ ] Average room temperature counts ONLY thermometer/air-monitor devices — fridges, TRV heads,
      smart-plug chip temperatures (`*_device_temperature`) and diagnostic-category temps are excluded [manual]
- [ ] Space dialog is 500 px wide; the comfort-bounds inputs are compact (56 px)
- [ ] The scale input is compact (72 px), not full-width; it shows cm in metric
      HA and inches in imperial HA [manual; auto: smoke_space_scale_defaults]
- [ ] A new manual space and every floor-import draft start at 1 cm in metric HA
      or exactly 1 inch/2.54 canonical cm in imperial HA. Opening and saving an
      existing 5 cm, fractional or missing legacy value without editing the
      field is lossless; changing language does not rewrite the canonical draft
      [auto: smoke_space_scale_defaults]
- [ ] Physically equivalent rich fixtures at 1 cm and 5 cm have equal View,
      Plan-with-grid-masked and static-card pixels/critical bounds. The grid has
      five times the intervals only; openings retain their edge hit target, and
      physical/screen-fixed layers are not double-scaled
      [auto: smoke_grid_scale_invariance; unit: grid-scale.test.mjs,
      opening-symbol.test.mjs, canvas.test.mjs]
- [ ] General settings (⚙ in the header): fill colors grouped by mode (lights on/off/none,
      temp cold/comfy/hot, LQI weak/strong), each with its own opacity slider [manual];
      Reset restores defaults; saving defaults stores nothing [manual]
- [ ] Custom fill colors apply to the full card AND the static space-card
- [ ] **Room colour follows the room's own mode (#581):** a room colour counts
      only with the room's own «Свой цвет»; «Как у пространства» clears the
      colour draft at once, the saved room keeps neither `fill_mode` nor
      `custom_fill`, and the plan paints the space colour. A colour stored
      without the mode (an orphan from an older editor) paints the space colour,
      opens as «Как у пространства» without a colour row and is dropped by a
      plain save; `name_scale`/`label_scale` survive [unit: `logic.test.mjs`
      `#581 AC1`; auto: `smoke_room_settings` step 7, `smoke_space_settings`
      `customRoomOrphanInheritsSpace`; mutation: `room-orphan-colour-wins-again`]
- [ ] LQI gradient interpolates between the configured weak/strong colors [manual]
- [ ] Per-space "Show zigbee signal (LQI)" toggle hides/shows the badges next to
      devices and the signal line in room tooltips for that space only [manual]
- [ ] Device icon badge is centred exactly on its point (no 1 px down-right drift) [manual]
- [ ] Device glyph is centred within its badge (no vertical drift — real ha-icon is block+line-height) [manual]
- [ ] Room hover highlight still works when custom borders/fills are on
- [ ] Settings persist across reload and other browsers (server-side)

## Room markup editor ★

- [ ] The toolbar has one **Walls** tool and no separate Room outline or
      Partition drawing button; Split remains available [auto:
      smoke_unified_wall_tool + unified-wall-tool-source.test]
- [ ] Grid appears; dots snap; the wall chain draws pair-by-pair; shared walls reused
- [ ] Ruler: while drawing, the length of the current segment follows the cursor
      (metres, or feet+inches on an imperial HA); scale = canonical per-space
      `cell_cm` (new-space default 1 cm or 1 inch; missing legacy fallback 5 cm)
- [ ] Every completed segment is saved immediately as one ordinary partition.
      Changing tool, editor or floor clears only the session-local chain state;
      accepted walls stay unchanged and are not resumed after reload/remount
      [auto: smoke_unified_wall_tool + smoke_free_walls +
      smoke_plan_snap_overlay]
- [ ] A legacy warm-viewport token `partition` still opens the unified Walls
      tool, but `partition` is not a runtime tool-state, dispatch branch or
      golden-matrix option [auto: wall-face-graph.test +
      unified-wall-tool-source.test + golden-matrix.test]
- [ ] Re-selecting Walls, Reset, pan, pinch, a second pointer, `pointercancel`
      and a suppressed synthetic click never finish a chain or save an extra
      segment [auto: smoke_unified_wall_tool]
- [ ] The active segment keeps a visible thin axis and endpoint above a thick
      preview. Distinct nodes inside the ambiguity radius fail closed with a
      zoom prompt. Shift constrains the actual endpoint to the nearest exact
      45° ray, including exact ray/wall intersections; the angle colour follows
      the stored vector, not pointer intent [unit: plan-snap-overlay.test.mjs;
      auto: smoke_plan_snap_overlay + smoke_plan_drawing_repairs].
- [ ] With no active chain, a click strictly inside the smallest unoccupied
      exact wall face offers a room; boundary/snap hits and Shift bypass it.
      Keep/Cancel is a true no-op. If one endpoint→endpoint or
      endpoint→solid-line repair closes the face within 2 physical cm, the red
      diagnostic is offered and moves geometry only together with Create.
      A larger gap, hosted-opening mover or multiple possible repairs fails
      closed [unit: wall-face-graph.test.mjs + wall-face-repair.test.mjs; auto:
      smoke_plan_drawing_repairs].
- [ ] Deleting a room uses an accessible Keep walls / Delete walls / Cancel
      dialog. Keep materialises only exclusive positive solid intervals as
      partitions and rehosts their openings; Delete cascades only openings on
      those exclusive walls. Shared walls/openings, explicit partitions and
      partition-hosted openings survive. Either accepted choice is one
      Undo/Redo/save transaction [unit: room-deletion.test.mjs; auto:
      smoke_plan_drawing_repairs].
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
- [ ] Esc / Ctrl+Z removes the last dot (and its line); Reset clears the active path
- [ ] A latest segment that creates bounded endpoint, T or X faces opens the
      room queue in area/key order. Existing exact/partial rooms and physical
      gaps, including opening cuts, are excluded; nested rooms remain eligible
      [unit: wall-face-graph; auto: smoke_unified_wall_tool +
      smoke_room_autoclose]
- [ ] Create and Keep as walls answers are buffered. The last answer applies all
      rooms and unconsumed wall atoms as one Undo/Redo transaction; Cancel/Esc
      restores the terminal draft without partial rooms [auto:
      smoke_unified_wall_tool]
- [ ] A clean divider across one existing room offers only the smaller child;
      the larger child keeps the original room id, name, area binding, settings
      and device placement [auto: smoke_unified_wall_tool]
- [ ] Room dialog: area list shows only unassigned areas; picking an area prefills the name
- [ ] Room dialog uses the medium width and its body has no horizontal overflow;
      long options stay inside it at desktop and narrow widths [auto:
      smoke_editor_tabs; manual: narrow viewport]
- [ ] "No area" room (decorative) requires a name; saves with `area: null`
- [ ] Cancel in a Walls face queue restores the persisted terminal draft
- [ ] Saving a room with an area: area devices appear with icons; positions are fixed into the layout [manual]
- [ ] Delete-room consequences are chosen explicitly as described above; there
      is no Erase tool
- [ ] Device icons hidden during markup; visible again on exit

## Devices on the plan ★

- [ ] Auto devices appear only in rooms bound to their area [manual]
- [ ] **Entity/parent ownership (#226):** placing `entity:X` removes X from its
      automatic parent. A visible unclaimed sibling keeps one residual parent;
      an empty or HA-hidden-only residual removes it. State, primary/action,
      `allEntities`, light/Glow and LQI cannot see X twice
      [auto: unit `devices.test.mjs`; browser `smoke_entity_parent_dedup.mjs`].
- [ ] Two explicit markers `entity:X` + `device:D` coexist and the device stays
      complete. A user-hidden live entity marker still owns X, while an entity
      tombstone returns X to the parent; disabled entity ownership follows the
      known full-registry relation [auto: unit `devices.test.mjs`].
- [ ] The #94 curtain boundary is deliberate: untouched hidden `cover.*` stays
      cover-first, but after placing the only visible auxiliary switch the
      hidden-only automatic remainder disappears. An explicit `device:D`
      restores the complete curtain beside that entity marker
      [auto: unit `devices.test.mjs`].
- [ ] Renderer and seeder cannot drift back to exact-binding-only ownership
      [mutation: `entity-marker-kept-in-parent-device`,
      `entity-marker-parent-seeded`].
- [ ] Filtering hides bridges/groups/scenes/excluded integrations; 👁 "show all" reveals [manual]
- [ ] Duplicate "name|area" numbered ("Lamp", "Lamp 2") [manual]
- [ ] Light groups fold their single lamps; `group_lights=false` unfolds [manual]
- [ ] Drag anywhere (no edit mode), snaps to grid, persists after reload, per space
- [ ] ↺ reset restores auto layout after confirm
- [ ] Temperature badge on thermometers; LQI value under zigbee icons with red→green color
- [ ] Unified live states (dev, owner 2026-08-05; lock palette #219): actual
      work is yellow; open door/window and open valve are orange; unlocked lock
      is red and locked lock is green; covers stay neutral and morph their icon;
      unavailable is faded. The plate and the activity effect come from the same
      semantic resolver
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
      when the entry is unavailable; layout/set and config/set without
      expected_rev may bootstrap revision zero, but over a non-empty store each
      returns `conflict` without changing its document/rev/backups or firing an
      event (including a no-op body); explicit stale revisions are rejected; a
      production config-writer inventory requires expected_rev;
      NaN/Infinity coordinates and oversized collections are rejected
      [auto: tests_backend/test_ha_websocket.py + coordinate-write-barrier-guard.test]
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
      scene.turn_on per domain; a deleted target toasts and calls nothing
      [auto: smoke_tap_run + unit resolveToggleIntent/runServiceFor + backend
      test_run_target_is_bounded_to_runnable_domains]
- [ ] Universal Toggle state (#94): the option is visible for device, entity
      and virtual markers; the separate Open/close option is absent. The hint
      names the exact target(s), current state, next effect and skipped refs.
      Exact entity never retargets to a sibling; explicit controls never fall
      back to the controller; partial groups call exactly the shown available
      subset; a no-target tap is a quiet no-op. Locks, alarm panels and
      garage/door/gate covers are explained secure no-ops. Cover/valve use
      closed→open, open→close, moving→stop when supported, otherwise their
      domain toggle. Confirmation re-resolves current state but cancels if the
      target set changed. Opening and saving an untouched legacy `cover` or an
      absent light default preserves the original token/absence; an intentional
      selector edit writes `toggle`. Feature-gated climate/water-heater/siren/
      camera/media-player/legacy-vacuum entities require their exact HA bits;
      an empty service catalog is unsupported. If #73 retains an older visual
      device while live controls change, click calls only the current controls
      [auto: test/device-toggle.test.mjs + smoke_cover_tap +
      smoke_cover_not_primary + smoke_controls + backend action-schema parity]
      The synthetic HA fixture publishes its service catalog explicitly, so
      browser checks exercise the same fail-closed resolver as production
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
      window binary sensor and an open valve still wear the orange «открыто»
      frame (a valve has no icon pair, so the frame is all it has); lock keeps
      its separate red-unlocked/green-locked palette [auto:
      smoke_cover_no_plate + unit stateIcon «every class, both ways»]
- [ ] Cover target and indication parity: on a device where a hidden functional
      `cover.*` competes with an auxiliary option switch, the shared resolver
      selects the cover, calls only it and supplies the same entity to icon
      morph/activity. A mixed lamp+cover remains a lamp unless the universal
      toggle result actually selects the cover. Cover presentation remains
      neutral in every state and cannot be painted yellow by its controls;
      secure cover classes call nothing and never fall back to info
      [auto: smoke_cover_not_primary + smoke_cover_plate_precedence +
      test/device-toggle.test.mjs]
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
- [ ] Touch gesture ownership (dev): in the plan editor on a phone, pinch zooms
      and a moving finger pans; releasing after a gesture does not draw a point
      and a clean tap still does. In View, both marker-first and stage-first
      pinches change zoom; the latter holds its second contact on the marker for
      more than 600 ms. Neither order opens the local card, HA more-info,
      confirmation/service or a compatibility click/contextmenu action. Reverse
      release, a third contact, pointer cancel and lost capture stay blocked,
      while the next deliberate single-touch tap and long press work once
      without waiting; real mouse and keyboard context menus remain available
      [unit: touch-gesture-click-guard; auto: smoke_editor_gestures; mutations:
      touch-pinch-click-block-cleared-on-terminal,
      touch-pinch-marker-hold-rearmed,
      touch-pinch-contextmenu-guard-removed]
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
- [ ] Portable import rechecks local content under its paired-write lock: a
      plan or marker PDF deleted after preview fails with `missing_plan` or
      `missing_content`, and neither store advances
      [auto: backend test_apply_rechecks_plan_file_under_the_write_lock +
      test_apply_rechecks_attachment_under_the_write_lock]
- [ ] Uploads are bounded (v1.49.0, HP-1470-01): past the store quota an upload
      is refused with a clear error and the disk does not grow; the plan list
      returns the newest 60 with a total
      [auto: unit: test_check_quota_counts_the_whole_store_not_one_request,
      backend test_uploads_are_bounded_by_a_store_quota]
- [ ] An attachment already written to staging is not reserved twice: with the
      real 512 MiB disk reserve intact its same-filesystem promotion succeeds,
      while one byte below the reserve still fails. Uploads checked before any
      bytes are written continue to reserve their full incoming size
      [auto: backend test_issue_554_low_disk_reserve_distinguishes_staged_and_unwritten_bytes
      + test_issue_554_upload_uses_actual_free_space_after_staging; mutation:
      quota-reserves-staged-bytes-twice-on-disk]
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
- [ ] Lattice write boundary (#291): a nine-decimal echo of every one of the
      4801 nodes from `-2400/240` through `2400/240` becomes the exact same
      Python/TypeScript double; authored off-grid and unknown numeric fields
      survive. Ordinary config and point-wise layout writers adopt the exact
      payload, while Optimize shows a separate total/physical maximum and only
      touched spaces. Apply writes one pair, Cancel writes zero, Undo/reload are
      exact and the second preview is a no-op
      [auto: `coordinate-canonicalization.test`, backend shared fixture,
      `coordinate-write-barrier-guard.test`, `smoke_lattice_write_barrier`,
      `smoke_optimize_coordinate_canonicalization`].
- [ ] An arbitrary editing session cannot reintroduce lattice noise. The proof
      is compositional: production smokes for wall chain, Resize, openings,
      free walls/columns, decor and marker/room-label drag exercise the real
      controllers; the executable writer inventory forbids a private outbound
      path; `smoke_lattice_write_barrier` feeds noise through every inventoried
      production writer and checks `latticeProfile(...).noise === 0` after
      every committed config/layout pair [auto: `smoke_wall_chain_thickness`,
      `smoke_room_resize`, `smoke_opening_preview`, `smoke_free_walls`,
      `smoke_decor`, `smoke_drag_bounds`,
      `coordinate-write-barrier-guard.test`, `smoke_lattice_write_barrier`].
- [ ] Lattice regressions are fail-dark: raw real-plan fixtures remain noisy,
      their boundary clones have zero noise, every required truncation/
      threshold/layout/frontend/backend/recursive mutant is killed, and the
      large-house boundary p95 is no more than 20% over the same-run full-clone
      baseline [auto: `model-invariants.test`, `mutation-gate`,
      `benchmark_coordinate_write_barrier`].
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
      sensor value is still visible immediately. Explicit marker targets and
      area-less rooms are indexed before this same pass; they do not add a pass
      per room [auto: smoke_climate_once + smoke_room_climate_placement]
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
      room tooltip and temperature fill — works for rooms without an HA area;
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
- [ ] Room link icon (v1.40.1, #200 parity): clicking empty room space in View
      does nothing (default cursor); an open-in-new icon after the room name
      appears for rooms with an HA area in View and Plan. In View it navigates
      to the area; in Plan it has no separate action/title and remains part of
      the draggable room label. Its name/metrics geometry relative to the
      saved label anchor matches View within 0.5 CSS px at DPR 1/2 in light and
      dark themes. Area-less rooms have no icon [auto: smoke_room_link]
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
      an untouched open dialog follows a newly resolved light primary instead
      of retaining a stale Device-card label (#97); explicit per-device
      "Device card" wins over the default [auto: smoke_light_default_tap]
- [ ] Nav persistence (#93): reload or another-HA-route → return restores only
      the last space and always starts in View; legacy `{space, mode}` ignores
      `mode` and is rewritten without it. A `#space=` deep link beats the saved
      space but still opens View. A technical same-route remount preserves an
      unfinished editor/dialog, while a real route departure clears both
      [auto: smoke_nav_persist + smoke_warm_dialogs]. During a pending
      `can_write` warm restore, one press on the visible editor close button
      cancels the deferred editor and a late response cannot reopen it (#95)
      [auto: smoke_nav_persist]
- [ ] Tap action cleanup + right click (v1.38.1, #94; #381): the per-device
      action list has five options (Device card / HA more-info / Toggle state /
      Run / Do nothing),
      no separate cover or "card default" option — the card editor's global
      tap option is gone and ignored;
      Device card opens locally for compound curtains/covers even during a
      transient registry revalidation and calls no HA service (#96)
      [auto: smoke_cover_not_primary];
      right click on an icon in VIEW opens HA more-info (native menu kept in
      editors; virtual w/o entity → device card); explicit Do nothing consumes
      short click, Enter and Space without card, confirmation, feedback, toast
      or HA call [auto: smoke_tap_ctx]
- [ ] Binding section redesign (v1.38.0): two radios — Virtual / Pick from
      the HA list — with a "Show entities" checkbox (tooltip) next to the
      second; the dropdown (search inside) appears only in HA mode, opens
      itself when nothing is chosen, closes on pick; Save is blocked until a
      binding is chosen in HA mode; groups/helpers listed always, device
      entities only with the checkbox; editing pre-selects everything [auto: smoke_binding_ui]
- [ ] Canonical zero walls (#306): the Plan toolbar has no Boundary, Virtual
      wall or Physical wall tool. Walls and Thickness accept exact `0..100`;
      zero works for room atoms and partitions, while columns remain
      `1..150`. Empty/invalid input writes nothing [auto: unit +
      `smoke_zero_walls`].
- [ ] Decor line style: a newly drawn or legacy line is solid and the drawing
      toolbar has no dash control. Double-click it under Select, switch the
      properties radio to Dashed and save: only that line receives
      `line_style: dashed`, renders with a dash array, stays clickable inside
      its gaps, and Undo restores the solid version [auto: smoke_decor]
- [ ] Zero-wall interaction target remains usable at every zoom even though
      the visual line is thin. Changing `positive ↔ 0` atomizes only the picked
      carrier, preserves neighbouring thickness and stable IDs, and creates one
      Undo step. A target with any door/window/gate/passage is rejected before
      mutation [auto: unit + `smoke_zero_walls`].
- [ ] Zero-wall style: missing setting and `dashed` render one true dash and
      transmit Glow/sun; `solid` renders one solid axis and blocks both as a
      zero-area barrier. `show_borders:false` hides the line in View/kiosk but
      not its light semantics or editor axis [auto: `smoke_zero_walls`, golden].
- [ ] v8 migration: explicit `open_spans` wins over `open_to`; otherwise full
      proven shared boundaries are atomized. Stable IDs survive, all existing
      `cm:0` is treated identically, the canonical current model removes both legacy fields,
      repeat migration is a no-op, and a zero/opening conflict fails atomically
      [auto: frontend/backend wall-segment model parity tests].
- [ ] Light transport (#71, model: `docs/LIGHT.md`): a source paints exactly
      ONE region — the floor it can see. Opaque: the drawn wall bodies with their real thickness, plus
      independent bodies, plus solid zero-wall axes. Transparent: doorways,
      gates and dashed zero walls — but only
      where BOTH sides are floor; a window and an outside door are opaque, and
      an outside door must not change the lit region at all (no half-lit
      tunnel). A source centred inside an exterior door, gate or window
      opening produces no Glow pool at all, while the same placement inside an
      interior door/gate passage remains valid. Light must never appear inside
      a wall body: at an opening it
      shows only within the gap between the jamb faces, never as a bright bar
      along the wall, and a shadow starts at the corner that casts it rather
      than half a wall away from it.
      Therefore, with an opaque floor: the aperture itself gains at least 8
      brightness units when the light turns on (a doorway is never an unlit
      bar), the floor just beyond it gains at least 8 as well, and the visible
      beam stays no wider than twice the opening. Behind a column there is no
      light at all (delta ≤ 3) while the floor beside it is lit (≥ 8), and the
      lit→unlit border is at most 4 stage pixels wide — a geometric edge, not a
      Gaussian. A spot contains exactly one painted child; no `mask` or
      per-source filter may appear in the light layer, exactly one
      `feGaussianBlur` feathers the complete layer, and the pool
      clip may never leave the rooms. The pool gradient falls off monotonically
      over the whole radius (no plateau; at 70% at most 75% of the centre
      alpha). A lamp lights a room across a dashed zero wall, and across two of
      them in sequence, only where it can actually see through both
      [auto: smoke_glow, smoke_zero_walls;
      unit: light-visibility, golden-matrix;
      golden: lighting-opaque-glow-two-doorways-dark]
- [ ] Glow floor resilience (#218): a six-room floor containing the captured
      one-ULP shared-coordinate tails still produces a complete Glow clip and
      preserves every Glow-base room without mutating stored outlines. If one
      room is deterministically malformed, healthy rooms remain lit, the bad
      room is skipped, overlapping healthy rooms are geometrically united, and
      an all-invalid floor remains dark rather than exposing the raw visibility
      fan. Repeated renders emit exactly one warning for the affected
      space/revision/room; it contains no coordinates, room names, entity IDs or
      exception text [unit: physical-geometry, golden-matrix; auto:
      `node demo/smoke_glow_geometry_resilience.mjs`; mutation:
      union-quantization-removed, union-failure-kills-space,
      union-failure-silent, glow-fail-dark-weakened].
- [ ] Per-source glow radius (v1.36.2): the device dialog has a "Glow radius"
      field (HA units; empty = general-settings default shown as placeholder);
      an override changes that source's visibility-clipped pool only [auto: smoke_glow]
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
      controller is encountered first. Controller availability is independent
      (#251): live battery/LQI/update keeps it neutral and opaque when every
      target is unavailable, all unavailable own entities fade it even if a
      target is on, and a virtual controller remains available. An active
      physical `device:` controller with an empty own roster remains available
      (#318): target `on` is yellow, while target `off`, unavailable, missing or
      runtime-filtered is neutral; the plan and device-dialog preview must agree.
      This exception must not apply to a non-empty all-unavailable roster,
      `entity:` bindings, HA-disabled/orphaned bindings or virtual lifecycle.
      A separately
      deleted target marker also cannot turn a live wireless controller into
      `unavailable` or make dialog preview disagree with the saved plan (#274):
      both projections consume the complete marker roster, preserve the live
      LQI value and become yellow only after an active target returns. A fully
      unavailable configured group shows the named singular/plural local toast
      without service, confirmation or press feedback; partial groups still
      execute silently, and a target lost after confirmation uses the same
      unavailable toast [auto: smoke_controls; unit: devices.test.mjs,
      device-presentation.test.mjs, device-toggle.test.mjs; golden:
      device-icon-state-table light/dark; mutation: controller-availability-follows-target,
      controller-diagnostics-do-not-prove-online,
      entityless-active-controller-stays-available,
      wireless-controller-loses-filtered-target-role,
      wireless-controller-preview-drops-sibling-markers,
      unavailable-toggle-stays-silent, partial-group-shows-noop-toast; #274:
      smoke_wireless_controller_parity]
- [ ] Linked manual virtual light (#174): an exact #107 virtual Always-light
      with an incoming controller follows the real HA driver despite a saved
      manual off-bit. Clicking either marker operates the real relay and one HA
      state tick updates both presentations, Glow, Light fill and room count;
      source touch tap calls once, while long-press/pan/pinch/pointercancel call
      nothing. Removing the final link restores the preserved manual state and
      operational toggle [auto: smoke_linked_virtual_light; unit: devices,
      device-toggle, device-presentation].
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
      role «Always» (`is_light: true`) explicitly restores those light behaviours;
      role «Never» suppresses the own source but keeps genuine external controls
      [auto: smoke_controls; unit: devices.test.mjs, plan-optimizer.test.mjs].
      Repeat with a `device:*` binding whose controls contain one of that
      device's child switches; the child is excluded while external targets remain
- [ ] Independent Glow (#55/#64): the space has data-fill radios
      Custom/LQI/Light/Temperature plus a separate Glow switch; every combination
      persists and renders both layers in order. Legacy space/room
      `fill_mode: glow` has identical effective state; legacy space `none`
      remains losslessly readable and projects to Custom when edited; explicit booleans win,
      normal Save materialises both fields atomically and Optimize Plans makes
      the same idempotent model-v7 migration without deleting unknown settings.
      Glow-off everywhere creates no base/tunnel/pool SVG layer; a dynamic mode
      without usable HA data falls back to base darkness instead of bright
      paper; static room cards show the same data/base projection but no live pools
      unless `light_pools: true` opts them in (#374)
      [unit: logic, plan-optimizer, backend validation; auto: golden matrix].
- [ ] Additive Glow (#19/#67): 1/10/30/60-source fixture renders one flat isolated
      pool group with no outer opacity; the shared 0.7 ceiling, perceptual
      brightness curve and palette alpha live only in gradient stops. A real SVG raster probe is cached per Document:
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
- [ ] Device-position history (#74): the Device editor always shows Undo/Redo
      before Close. One pointerup after a real snapped move creates exactly one
      point-wise server write and one command; Undo/Redo use update or delete
      as appropriate and preserve `s`, `k: 0` and unknown sibling fields.
      Pointercancel, lost capture, a second pointer, Escape, no movement and a
      failed write restore the preview and create no command. A failed history
      write restores the previous stack direction; own storage echoes preserve
      history while a different remote baseline, rebinding, deletion or
      optimization clears it. The independent stack is limited to 50 moves;
      `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` and `Ctrl+Y` work outside native fields
      [unit: device-position-history; auto: smoke_device_position_history].
- [ ] No Reset button (v1.33.2): the Device editor toolbar has three entry
      tools — add, show all, icon rules — plus position Undo/Redo and Close;
      the layout-wiping Reset is gone [auto: smoke_editor_tabs]
- [ ] Grid in all editors + decor fade (v1.33.1): the dot grid shows in the
      Device and Background editors too (instant "I'm editing" cue), not in
      View; in the Background editor rooms/devices/openings/labels plus solid,
      thick and zero-thickness walls fade to 35% while decor shapes stay fully
      opaque; no fade in the other editors [auto: smoke_decor / smoke_grid_fade /
      smoke_zero_walls]
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
- [ ] Opening placement preview: after a type is selected in the Opening
      sub-menu, hover paints the complete window/door/gate symbol at 50%
      opacity on the resolved physical wall interval. It uses the same visible
      renderer as a committed opening, remains pointer/ARIA inert, and is
      absent far from walls, on virtual spans, over an existing opening, before
      a type is selected, or in other tools [auto: smoke_opening_preview;
      golden: opening-placement-door-thick-wall-dark]
- [ ] Open-passage placement preview: hover paints one wall-coloured cut segment
      at effective opacity 0.35 plus exactly two orange boundary marks. Its
      length and depth come from the resolved candidate, ruler labels remain
      visible, and save leaves no preview-only symbol in the committed passage
      [unit: opening-placement, open-passage-contract; auto:
      smoke_opening_preview; golden:
      opening-placement-passage-thick-wall-dark/light]
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
      on the active tab does nothing; the header X keeps a 13 px glyph inside a
      ≥24 × 24 px hit target and closes from its expanded edge, during an active
      transition and after finishing a Walls chain; a geometry-limit blocker
      keeps the draft with an explicit toast; Plan↔Devices switches directly
      [auto: smoke_editor_tabs]
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
      and editor↔editor. One controller interpolates measured toolbar height,
      stage geometry, world centre + screen scale, background/paper and layer
      weights. Every intermediate viewBox matches the current stage aspect; a
      same-space switch fades in the new toolbar, supports wrapped bars and
      retargets a rapid second choice. Hidden editor chrome and the moving stage
      are inert; disconnect/reconnect leaves no RAF or transient class
      [auto: smoke_mode_transition, smoke_preloader_lifecycle, smoke_zoom_out]
- [ ] Space gear (v1.30.1): the cog next to the space name is visible in every
      mode (admins only), vertically centered with the tab text; clicking it
      opens space settings without switching the tab; "+" tab stays Plan-only [auto: smoke_gear_tabs / smoke_gs_always]
- [ ] Lock action (v1.30.0): opening info card (View) shows Unlock (red) when
      locked / Lock when unlocked; button calls the lock service; disabled while
      locking/unlocking; hidden when unavailable; plan-icon tap still never
      toggles a lock [auto: smoke_gear_tabs / smoke_gs_always]
- [ ] Registry-less opening binding (#117): a live YAML contact/lock without
      `unique_id` is offered by the picker and drives the frozen View frame,
      badge and info card; marker tombstones do not block it, an HA tick swaps
      the frame without rebuilding geometry/config, and explicit disabled rows
      with stale states remain hidden. Only the confirmed info-card lock action
      may call a service [auto: ha-binding-status, render-device-snapshot,
      smoke_registryless_opening, mutation-gate]
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
      return on rebuild/reload, but its binding is offered in **Available again**. Re-add it:
      one marker only, fresh centred/grid position, no tombstone
      [auto: smoke_hidden_flag; unit + manual]
- [ ] Delete `device:D`, enable Show entities in **Devices → Available** and restore only child
      `entity:X`: X receives one live marker and a fresh position; the parent
      tombstone remains, so D and sibling Y do not return or contribute to
      aggregates. Delete/re-add X is idempotent; explicitly re-adding D later
      leaves the intentional D + X pair from #226
      [auto: smoke_binding_picker; unit: devices.test.mjs; mutation x4]
- [ ] Delete an entity marker and a virtual marker: the entity is offered by
      the catalog (with Show entities when applicable); the virtual marker is gone and
      can be recreated manually. The exact deleted entity remains offered even
      if HA marks its registry entry hidden. Other virtual markers survive both
      Save and Delete [auto: smoke_hidden_flag; unit + manual]
- [ ] The Device editor has one **Devices** entry point. Its four lifecycle
      tabs, counts, search, keyboard arrows and narrow layout work; browsing,
      Find and a nested Edit/Cancel round-trip write neither config nor layout
      [auto: smoke_device_inbox; unit: device-inbox.test; golden: device-inbox-*].
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

- [ ] Default: tap → info card, except a primary light's lossless toggle default.
      Universal Toggle state is visible for every marker and its inline hint
      exactly matches the eventual service target/effect [manual +
      test/device-toggle.test.mjs]
- [ ] Locks, alarms and secure garage/door/gate covers resolve to explained
      no-op. Ordinary covers/valves use open/close/stop through the same option;
      virtual/no-target toggle saves but neither calls a service nor opens info
      [manual + smoke_cover_tap]
- [ ] Long-press (600 ms) always opens the info card, also when tap=toggle [manual]
- [ ] Drag > 3 px cancels both tap and long-press; pinch/pan never triggers taps
- [ ] `pointercancel` (touch interrupted) does not leave a phantom info card [manual]

## Zoom / pan / labels

- [ ] Wheel zoom at cursor; +/− buttons; fit button resets; badge shows %
- [ ] Discrete zoom has an intermediate frame and exact legacy target; rapid
      wheel retarget/reversal keeps its live pointer anchor and one final
      persistence write; pointerdown/pinch, mode/space/projection/resize,
      hidden and reduced motion leave no stale camera animation
      [auto: smoke_smooth_zoom]
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
- [ ] Static Glow (#374): omitted/false `light_pools` creates no pool layer,
      visibility geometry, cache entries or transition timers; `true` renders
      the same source coordinates, radius, colour, brightness, per-source floor
      clip, opening transmission and masonry shadows as the full card. The
      stage remains `pointer-events:none`, and `live_states:false` does not
      disable pools [unit: glow-scene; auto: smoke_glow_blending; performance:
      large-space-card-default-v1 + large-space-card-glow-v1].

## Doors, windows & gates (v1.23.0+)

- [ ] Markup → "Opening": a click away from any wall shows a toast; near a wall — the dialog
- [ ] A door placed on a wall renders jambs + leaf + swing arc at the wall's angle; length in cm
      matches the ruler/scale of the space
- [ ] Bind a contact sensor: open → leaf swings and the arc draws on in the accent colour;
      closed → leaf lies along the wall, arc hidden; invert flips this
- [ ] Sensor unavailable → the opening freezes at its static default (door open / window closed)
- [ ] A door with a lock shows the compact padlock badge: green locked, red
      unlocked and neutral unknown; coloured glyphs are white in Light and
      `#252525` in Dark
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
