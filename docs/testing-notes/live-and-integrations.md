# Живые слои и интеграции

> Приложение к [`docs/TESTING.md`](../TESTING.md): перенесено оттуда дословно (#634).
> Индекс всех приложений — [`README.md`](README.md).

## PDF export polish (#482)

- [ ] Нормализация контура сначала схлопывает соседние и шовные дубли в
      физическом допуске 1 мм и только затем удаляет коллинеарные точки; ложная
      диагональная хорда из почти совпавших вершин не появляется
      [unit: `test/pdf-dimensions.test.mjs`].
- [ ] Размеры выводятся только для горизонтальных/вертикальных граней с
      каноническим допуском 0,25°. Одна локальная пара противоположных граней
      комнаты или связного наружного кольца получает одну подпись; одинаковые
      длины в разных комнатах, осях и несвязных кольцах сохраняются
      [unit: `test/pdf-dimensions.test.mjs`, `test/pdf-scene.test.mjs`].
- [ ] Подписи центрированы на своей стене и сдвигаются от кладки целыми
      размерными дорожками без касательного джиттера; вогнутые комнаты выбирают
      внутреннюю нормаль по геометрии, а не по центроиду. Bbox текста и все
      сегменты полосы проверяются точными пересечениями, включая отверстия,
      вырожденные отрезки и разные направления ring
      [unit: `test/pdf-collision.test.mjs`, `test/pdf-scene.test.mjs`, golden: PDF scene].
- [ ] Стены, перегородки и колонны имеют точную заливку `#7f7f7f`, общую
      привязанную к странице штриховку 45° с шагом 3 мм и чистые even-odd
      вырезы всех проёмов; стены нулевой толщины не получают штриховку
      [unit: `test/pdf-writer.test.mjs`, `test/pdf-scene.test.mjs`, golden].
- [ ] Ориентация и первый подходящий стандартный масштаб выбираются по bbox
      полной сцены вместе с размерами, выносками, декором и растром. Вся сцена
      центрирована в доступном поле листа с допуском 0,5 мм; тяжёлая геометрия
      пространства вычисляется один раз
      [unit: `test/pdf-layout.test.mjs`, `test/pdf-scene.test.mjs`].
- [ ] Векторный компас правильно поворачивается для 0/90/180/270°, а текст PDF
      не содержит удалённой легенды `wall · door · window`
      [unit: `test/pdf-compass.test.mjs`, `test/pdf-scene.test.mjs`].
- [ ] Реальный диалог при ширине View 320 px не имеет горизонтального scroll,
      действия остаются внутри окна, имеют высоту не менее 44 px и на узком
      экране идут вертикально; сохранение PDF работает во всех четырёх локалях
      [auto: `demo/smoke_pdf_export.mjs`].
- [ ] Каждый поведенческий барьер выше защищён соответствующим мутантом, а
      обновлённый PDF golden принят только после визуальной проверки Linux CI
      [mutation: `scripts/mutation-gate.mjs`; golden: `demo/golden/`].

## Многоэтажный робот: карты и пространства (#162)

- [ ] Чистый резолвер разбирает все шесть исходов на общей фикстуре и не
      зависит от порядка списка маршрутов; усыновление легаси-прогона даёт
      ровно три исхода, оба отрицательных — fail-closed
      [unit: `test/vacuum-routes.test.mjs`, `tests_backend/test_vacuum_routes.py`,
      фикстуры `test/fixtures/vacuum-routes/*.json`].
- [ ] Живой оверлей рисуется в пространстве активного маршрута, док остаётся в
      своём; прошлый прогон виден в пространстве СВОЕГО маршрута, а легаси-конфиг
      сохраняет прежнее правило [unit: `test/vacuum-routes.test.mjs`].
- [ ] Рекордер подписывается на источники всех маршрутов и пишет прогон под
      маршрутом, который его породил; смена маршрута начинает новый прогон даже
      при том же `map_id`
      [backend: `tests_backend/test_trail_recorder.py`, `test_trails.py`].
- [ ] Правка маршрутов проверяется семантически на `config/set`, optimize и обоих
      импортах, нетронутые легаси/будущие данные не блокируют чужое сохранение
      [backend: `tests_backend/test_vacuum_route_validation.py`].
- [ ] Удаление пространства называет число чужих карт и уносит только их
      маршруты; экспорт одного пространства отбрасывает кросс-пространственные
      маршруты и считает их в `dropped_marker_links`
      [unit: `test/space-deletion.test.mjs`, backend: `tests_backend/test_ha_import_export.py`].
- [ ] Восемь мутантов краснеют: `vacuum-route-ambiguity-takes-the-first`,
      `vacuum-route-missing-space-falls-back-to-dock`,
      `vacuum-route-unmapped-draws-anyway`,
      `vacuum-route-identity-duplicates-allowed`,
      `vacuum-legacy-run-adopts-the-first-candidate`,
      `vacuum-overlay-ignores-the-rendered-space`,
      `vacuum-previous-run-follows-the-robot`,
      `vacuum-route-warning-stays-silent`, плюс серверные
      `vacuum-run-forgets-its-route`, `vacuum-retargeted-route-keeps-its-old-trails`,
      `vacuum-route-validation-accepts-a-dead-space` и
      `space-delete-keeps-foreign-vacuum-routes`
      [mutation: `scripts/mutation-gate.mjs`].
- [ ] Продакшен-бандл показывает робота на этаже активной карты, а на этаже дока
      не показывает; предупреждение у дока появляется на движущемся роботе с
      несопоставленной картой; донастройка предложения с высоким residual
      открывается на этаже маршрута, а не дока
      [auto: `demo/smoke_vacuum_multifloor.mjs`].
- [ ] Отдельная camera на карту: источник без читаемого id карты маршрута не
      создаёт и объясняет причину [ручная проверка блока «Карты и этажи»].

## Vacuum trail smoothing (#209)

- [ ] Pure `smoothVacPath` tests prove exact endpoints, separate subpaths,
      degenerate/reversal fallbacks, the 17.5 cm sampled deviation bound and
      the 64-subpath/4000-point `≤2N` command budget
      [unit: `test/vacuum.test.mjs`].
- [ ] The production bundle renders current and previous runs through paired
      case/core `<path>` elements with quadratic commands, unchanged source
      authority/modes, live-target trim and puck tip
      [auto: `demo/smoke_vacuum.mjs`].
- [ ] Flat and dormant-Iso projections retain the same curved live layer on
      touch and across HA updates [auto: `demo/smoke_isometric_live_touch.mjs`].
- [ ] `vacuum-trail-smoothing-dark` records the 17.5 cm default in fixture data,
      contains two current subpaths plus a stored previous run, and its semantic
      guard requires two `M` sections, quadratic
      commands and byte-identical case/core geometry before PNG comparison.
      The baseline is accepted only from reviewed Linux CI
      [golden: `demo/golden/matrix.mjs`].
- [ ] Replacing the quadratic corner with a straight vertex makes the focused
      unit guard red [mutation: `vacuum-trail-smoothing-disabled`].

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
- Same-map `cleaning → docked/paused/error → cleaning` resumes the ended
  current through exactly 30:00 and retains every point plus any older
  previous run; 30:00 + epsilon or a map change rotates as before. Repeated
  stop samples do not extend the window; malformed timestamps and clock
  rollback fail closed [backend: `test_trails.py`, `test_trail_recorder.py`].
- `unavailable`, `unknown` and a missing vacuum state are neutral. While
  stopped, default mode hides the ended current; after backend resume the
  production card paints the complete reopened current, while `always` keeps
  its current/previous styling [auto: `smoke_vacuum`; mutation:
  `vacuum-trail-resume-disabled`].
- Calling trail delete for a marker with no stored run is a true no-op: its
  source/vacuum pair stays subscribed. A successful delete removes only that
  marker's pairs and immediately rebuilds the subscription
  [backend: test_trail_recorder.py].
- A successful config edit purges trails for both a missing marker and its
  `removed: true` tombstone, but keeps live/hidden markers; a semantic no-op
  performs no surprise cleanup. A startup refresh that samples a new point
  schedules one save and one throttled update event
  [backend: test_ha_websocket.py + test_trail_recorder.py].
- Trail style: cartography casing (dark halo 2.25 + light core 0.9),
  readable over any room fill.
- Hidden marker: neither puck nor trail. Uncalibrated active map: no puck.
- Calibration: «Настроить автоматически» (≥3 rooms matched by name) or the
  fit panel — drag the dashed room ghost, stretch by 4 corner handles,
  rotate 90°/mirror buttons (mirror ON by default), Save/Cancel/Esc. Real
  clicks must land on the overlay (elementFromPoint smoke guards it).
- Multi-floor: one matrix per robot map (Dreame `selected_map` on the
  vacuum entity names the active one).

## Sun on the plan (docs/SUN.md)

- [ ] Four-phase background resolves strict real `sun.sun` data atomically:
      `<= -6°` night, `>= +6°` day, the middle band dawn while rising and dusk
      while falling. Missing/garbage elevation, azimuth, or rising switches the
      whole sample to local-clock fallback at exact 05:00/08:00/18:00/21:00
      boundaries [auto: `test/sun.test.mjs`, `smoke_sun_live_bg`]
- [ ] Background works without `north_deg` and without valid `sun.sun`; the
      latter arms one visible-only 30-second fallback timer, stops it while
      hidden/disconnected, and catches up on pageshow/visible return. Window
      rays independently remain gated by valid sun + compass
      [auto: `smoke_sun_live_bg`]
- [ ] The ⚙ compass: dragging the «N» arrow turns it in 1° steps (15° with
      Shift); the number field mirrors the dial and accepts 0–359; «Clear»
      returns the unset state
- [ ] «Plan background» selector: `static` keeps the existing color picker
      and behaviour byte-for-byte; `daynight` hides the picker and shows exact
      dawn/day/dusk/night environment tokens. Only environment and outer
      plan-paper outline cross-fade for 1100 ms; reduced motion is instant
      [auto: `smoke_sun_live_bg`, golden `day-cycle-*`]
- [ ] A physically ordinary day-cycle plan stored at 1 cm/grid-point keeps the
      outline compositor surface bounded by the visible stage during pinch.
      Direct gestures and animated camera commands activate the fallback, the
      inner paper group becomes unfiltered, the plan layer is explicit rather
      than overlap-promoted, no
      content layer exceeds 4096 in either dimension, and sampled presented
      frames contain no white tile. Before input the historical inner outline
      remains byte-identical to the accepted `day-cycle-*` goldens.
      The same isolated outline still satisfies the #532 relative raster
      budget; its smoke compares the median of three paired, closed-path
      static/day-cycle pans so one shared-runner spike cannot replace the A/B
      signal. The static space card uses one filtered stage-sized outline from
      its first frame and leaves its inner paper group unfiltered
      [auto: `smoke_daycycle_layer_budget`, `smoke_daycycle_raster`,
      `smoke_live_pan_coverage`]
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
      under an image. Across all four phases the paper and every plan pixel
      remain unchanged: no brightness/tint/opacity/blend filter. Pixel-proofed against
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
- [ ] **Window face (#577):** General settings always shows the global
      `inner`/`outer` selector, even when rays are off; save/reopen preserves it.
      Missing/invalid read-side values resolve to `inner`, backend writes reject
      invalid values, full export/import and support projection preserve only a
      valid enum [auto: `smoke_sun`, `sun.test.mjs`,
      `config-schema-parity.test.mjs`, `test_validation.py`,
      `test_ha_import_export.py`, `test_support_package.py`]
- [ ] In `outer`, a thick-wall ray starts at both exterior window corners and
      reaches the clean floor only through the physical opening tunnel; wall
      body and exterior space never light up. Direction, nominal reach, fade,
      colour, thresholds and shadows are identical to `inner`; at `d = 0` the
      two results are byte-identical. Switching the pending dialog value
      invalidates the geometry memo without waiting for a server revision
      [auto: `sun.test.mjs`, `smoke_sun`; golden:
      `lighting-sun-window-state-only-dark` (inner) and
      `lighting-sun-window-outer-thick-dark` (outer tunnel + room seam)]
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
- [ ] Editors (plan/devices/decor) render with NO wedges and NO four-phase
      environment; kiosk and static space-card share phase/palette/fallback
      (wedges remain full-card-only)
- [ ] New install and new manual/Floors spaces materialize `daynight`; legacy
      missing global mode migrates once to `static`; full/space transfer
      materializes source semantics before preview/apply
      [auto: `test_ha_import_export.py`]
- [ ] `prefers-reduced-motion` → no transitions, current phase renders directly
- [ ] Smoke: `node demo/smoke_sun.mjs`; units: `test/sun.test.mjs`;
      backend: `tests_backend/test_validation.py` (sun settings)

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
- [ ] **Optimize removes stored ULP coordinate noise (#223)**: a six-room
      fixture whose shared grid vertices differ by `5.5e-17` offers Apply with
      `moved: 0` and a positive cleaned-coordinate count. Preview distinguishes
      updated spaces from removed coordinate noise; Cancel writes nothing;
      Apply stores exact grid nodes in one transaction; the next run is a no-op
      and server Undo restores the original geometry in canonical
      representation. A rejected hosted
      partition contributes nothing to the counter
      [unit: align-grid + plan-optimizer + i18n; auto:
      smoke_optimize_coordinate_canonicalization; mutation:
      `snapn-returns-input-near-node`].
- [ ] **Optimize rejects an unrenderable candidate before writing (#199)**:
      all spaces pass the shared production wall/opening/physical/floor input
      projection. A forced wall/floor `null` or exception produces only a
      bounded failure code; valid empty/image-only spaces remain allowed. One
      failing floor removes Apply and makes zero Optimize WS calls without
      changing config, layout, revisions or Undo. The first three safe names,
      the remaining count and recovery hint are exact in RU/EN; unchanged Apply
      reuses its fingerprint result, while a changed candidate is checked again.
      The 3-floor/60-room/100-opening/60-partition/40-column fixture must stay
      under 250 ms p95 and within direct-builder p95 × 1.2 + 15 ms
      [unit: test/plan-geometry-preflight.test.mjs; auto:
      smoke_optimize_geometry_preflight; benchmark:
      benchmark_optimize_geometry_preflight; golden: dark/light failure dialog;
      mutations: `optimize-preflight-bypassed`,
      `optimize-preflight-active-space-only`,
      `optimize-preflight-accepts-null`,
      `optimize-preflight-renders-apply-on-failure`].
- [ ] **A local wall-union failure stays local and cannot be saved (#278)**:
      the anonymized production-derived fixture returns `degraded-extra` with
      two deterministic components instead of a global empty wall layer. Plan,
      View, Static, hidden Iso, paper and light barriers retain both components
      in light and dark themes. Every physical-geometry writer crosses the
      common exact-candidate barrier; forced degradation restores the previous
      state and creates zero Undo/WS calls, while a title-only edit still saves.
      Optimize and `model-invariants` reject the same fixture with bounded
      diagnostics. Valid large-house overhead is at most 10% and 20 ms p95;
      degraded p95 is below 100 ms
      [unit: wall-thickness + plan-geometry-preflight +
      wall-union-isolation; auto: smoke_wall_union_isolation +
      smoke_optimize_geometry_preflight + smoke_room_resize; golden:
      wall-union-isolation-view-light/dark; benchmark:
      benchmark_wall_union_isolation; mutations:
      `wall-component-failure-kills-primary`,
      `wall-isolated-extra-discarded`, `strict-wall-barrier-accepts-degraded`,
      `wall-thickness-writer-bypasses-common-barrier`,
      `model-invariants-bypasses-production-geometry`].
- [ ] **Missing space references recover without losing a marker (#244)**:
      exact import signatures remap space, room, marker/room-label positions
      and vacuum segments; Area remap and detach preserve the marker record and
      leave an old position for the owner-aware #252 decision rather than
      guessing. Ambiguous/truncated signatures and opaque layout are never
      guessed. Preview/Apply/Undo use one exact candidate and
      show remaining debt even for a no-op. Space import repairs target refs by
      its known map. With another space present, space delete deduplicates active
      marker blockers; deleting the sole remaining space instead preserves every
      affected active/removed marker record while clearing only `space` and
      `room_id`. Both paths recheck both revisions under the backend lock and
      remove owned layout without deleting marker metadata. The sole-space path
      also keeps the #113 empty-state smoke green. A missing `default_floor`
      remains raw and
      gains a RU/EN inline warning after spaces load
      [unit: space-reference-repair, plan-optimizer, space-deletion,
      card-editor-validation; backend: test_ha_import_export,
      test_ha_websocket; smoke: orphan-space-references + optional-space-model;
      pre-release: targeted browser smoke and light/dark golden].
- [ ] **Optimize explains and safely cleans forgotten positions (#252)**:
      the owner matrix covers room labels, marker tombstones, known HA devices,
      `lg_` entities and unknown namespaces across authoritative and limited
      registries. Only proven-absent owners enter the default candidate; live
      owners are named and preserved until the secondary opt-in, and unverified
      owners never receive a destructive action. The main RU/EN report contains
      bounded human categories rather than IDs; closed Details contains at most
      ten technical entries plus the remainder, and vacuum mappings remain a
      separate warning. Cancel and the secondary toggle write nothing; Apply
      writes the exact preview once, reload is a no-op, and Undo restores all
      removed positions [unit: space-reference-repair + plan-optimizer + i18n;
      auto: smoke_orphan_space_references; golden: dark EN + light RU;
      mutations: `orphan-cleanup-proven-owners-kept`,
      `orphan-cleanup-partial-registry-deletes`].
- [ ] **Every write prevents new ULP coordinate noise (#224)**: config/layout
      schema, import, direct storage writers, startup recovery and maintenance
      Undo produce the same nine-decimal allow-listed geometry as the frontend.
      A first noisy write creates one canonical revision; a repeated canonical
      write creates no store write/event/revision and preserves the maintenance
      backup. `view_box`, physical/presentation values, colours and vacuum
      calibration remain exact; the six-room #218 union and Glow clip stay
      non-empty [unit: coordinate-canonicalization + physical-geometry;
      backend: test_coordinate_canonicalization + test_ha_websocket +
      test_ha_import_export; mutations: `schema-quantization-removed`,
      `frontend-writes-raw-coords`, `quantization-hits-allowlist`,
      `import-path-bypasses-schema`; pre-release: golden verify].
- [ ] **Optimize remains idempotent across storage and reload (#248)**: its
      final config/layout pair equals the shared nine-decimal writer target;
      a second run in memory, after schema/storage round-trip, after update
      events and after a cold reload returns `changed:false`, zero change
      counters and a deep-equal pair. The shared two-scale fixture is consumed
      independently by Node and Python; the Optimize handler records the exact
      pair in pending and both final stores, and startup recovery converges on
      it [unit: plan-optimizer + coordinate-canonicalization; backend:
      test_coordinate_canonicalization + test_ha_websocket +
      test_ha_import_export; auto: smoke_optimize_coordinate_canonicalization;
      mutations: `optimize-storage-boundary-removed`,
      `optimize-config-storage-half-raw`, `optimize-layout-storage-half-raw`].
- [ ] **An unfinished config/layout pair survives the next writer (#491)**:
      Optimize and Optimize Undo use the same intent → exact reload/retry →
      rollback protocol as import and space deletion. A runtime config writer
      resolves pending before CAS; a point layout writer applies only its
      delta to the recovered target; a continuing Store failure rejects that
      writer without changing either half or deleting intent/backup. A Store
      exception after the final durable layout is recognized as success, while
      persistent Optimize/Undo target failures restore the exact before-pair
      including unknown metadata and revisions. Setup shares the resolver and
      legacy pending remains compatible [backend/HA harness:
      `test_issue_491_*`, existing `test_setup_recovers_*` and import pair
      fault tests; mutations: `pair-recovery-config-writer-skips-fence`,
      `pair-recovery-point-writer-skips-fence`,
      `optimize-skips-pair-retry-rollback`,
      `optimize-undo-skips-pair-retry-rollback`].
- [ ] Optimizer migration safety: legacy decor width/text size is clamped to
      the backend schema, `fill: true` receives explicit fill style, invalid
      legacy `plan_scale` is preserved for repair, an already canonical plan is
      a no-op, a future model version is never downgraded, and zero/null/negative
      `cell_cm` is repaired to the 5 cm default (positive subminimum values clamp
      to 0.1 cm)
      [unit: plan-optimizer.test.mjs; backend: test_validation.py]

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

## Coming back to the tab (docs/WARM-REMOUNT.md, dev, unreleased)

- [ ] **A quick return does not flash**: leave the browser tab or minimise the
      window for a few seconds and return. The existing viewport, day/night
      background and room hover remain painted continuously; the continuity
      token stays unchanged and no recovery overlay is created
      [auto: smoke_sun_live_bg, smoke_visual_continuity]
- [ ] **A long return holds the complete frame**: every sampled frame keeps a
      visible `.zoomwrap`, non-empty rooms and the same viewport while
      config/layout reconnect data is revalidated. A stale frame never gets a
      recovery overlay [auto: smoke_visual_continuity, smoke_ws_resilience]
- [ ] **Protected backdrops survive remount and refresh**: a loaded authority-
      scoped signed URL is available synchronously to another placement; an
      aging URL remains painted until its replacement decodes
      [unit: signing.test; auto: smoke_plan_signed, smoke_space_card_bg]
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

## Реальная raw-карта Zigbee2MQTT (#450)

- [ ] **Обновить карту** на Zigbee2MQTT 1.x/2.x принимает camelCase-поля
      `ieeeAddr` / `networkAddress` и показывает связи вместо
      `error_invalid_payload`; сохранена совместимость со snake_case.
- [ ] Плоские `sourceIeeeAddr` / `targetIeeeAddr` имеют приоритет над
      вложенными концами связи, а массив `failed` не превращается в ложную
      недоступность устройства [unit + production-shaped fixture + mutation].

## Порядок слоя Zigbee-топологии (#464)

- [ ] `smoke_zigbee_topology_hover.mjs` доказывает единый camera/stacking
      context: overlay — ребёнок `.devlayer` без собственной live-camera
      проекции; topology выше пересекающихся room label и постороннего marker,
      но ниже полных roots source и каждого реально нарисованного local
      endpoint. Для source это проверяется настоящим `page.mouse.move`, чтобы
      CSS `:hover` участвовал в каскаде; синтетический `pointerover` этого не
      доказывает. Host и primitives остаются pointer-transparent.
- [ ] Exact endpoint ownership очищается при pointerleave, touch/pen, потере
      hover gate, смене mode/space/setting, invalidation mapping, замене marker
      DOM и disconnect. Remote/unplaced цели не поднимают marker.
- [ ] Unknown-LQI local link состоит из совпадающих dashed strokes: casing
      `#2e2e2e`/4 px и gray core/2 px с одним `5 5`, linecap и
      non-scaling-stroke. Raster probe видит тёмную кромку и прозрачный gap;
      known-LQI и solid parent route не получают casing, forced-colors
      сохраняет системную палитру.
- [ ] Мутанты слоя/endpoints/cleanup/double projection/casing обязаны краснеть;
      `npm run benchmark:zigbee-topology`, `bundle:budget`, selected smokes и
      `golden:verify` сохраняют действующие ceilings.

## Полнота источников радара (#545)

- [ ] `tests_backend/test_radar_validation.py` проверяет точный inventory всех
      Stage 1 profiles: известные общие и профильные роли включены, future-поля
      остаются inert.
- [ ] `tests_backend/test_ha_radar.py` и
      `tests_backend/test_ha_radar_websocket.py` доказывают подписку, rebind,
      cleanup и fail-closed read ACL именно для основных `entity_id` профилей
      `range_v1`/`zones_v1`.
- [ ] Мутант `radar-profile-source-entity-id-omitted` удаляет обе роли
      `entity_id`; точный backend guard обязан покраснеть.
