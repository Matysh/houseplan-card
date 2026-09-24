# Геометрия: стены, проёмы, комнаты, холст

> Приложение к [`docs/TESTING.md`](../TESTING.md): перенесено оттуда дословно (#634).
> Индекс всех приложений — [`README.md`](README.md).

## Stable wall-segment identity (#282)

- [ ] Wall junction limits (#329): drawing refuses an apex under 15°, a seventh
      wall in one node, a wall shorter than 20 cm or than its own thickness,
      nodes closer than 5 cm and a room with under 25 cm² of interior, each
      through the surface's own channel — a toast naming the rule for drawing
      and Thickness, a stopped wall for Resize. A T-joint stays legal, a short
      filler atom compensating a thickness step stays legal (length is measured
      along the collinear same-thickness wall run), and an inherited violation
      never blocks an unrelated edit
      [unit: junction-limits; auto: smoke_junction_limits, smoke_island_rooms;
      mutants: junction-limit-angle-not-enforced,
      junction-limit-write-gate-removed, degenerate-apex-bevelled-again].
- [ ] A degenerate sharp apex renders as ONE point on both faces — no flat
      chamfer, no bow-tie fold, no jags between the inner and outer vertex; the
      room ring of the #329 fixture triangle has exactly three distinct
      vertices [unit: junction-limits §4].
- [ ] Shared fixture `test/fixtures/282-wall-identity-parity.json` produces the
      same exact v8 catalog, room references, opening host and draft IDs in
      TypeScript and Python.
- [ ] Initial v7 migration is deterministic and idempotent; new post-v8 atoms
      use UUIDs. A split/promoted draft keeps one documented carrier ID, while
      reserved/colliding deterministic IDs receive stable `-2`, `-3` suffixes.
- [ ] The three structural writer families — interactive commit, Undo/Redo
      restore and Optimize — are enumerated by the source guard and each has an
      independent bypass mutant in `scripts/mutation-gate.mjs`. A rejected
      migration changes neither config, Undo history nor revision.
- [ ] Full/space imports cover v7→v7 (no upgrade), v7→v8 and v8→v8; copy/merge
      remaps every ID and reference together. A byte-equivalent legacy-client
      round-trip of v8 is accepted, while a structural legacy change is rejected.
- [ ] Resize, Split/Merge, opening edit and Optimize browser smokes retain wall
      thickness and ownership across reload. Performance gate:
      `npm run benchmark:wall-model` materialises 10,000 atoms with p95 below
      500 ms on the reference Windows machine.
- [ ] Local commands: `npm test`, `npm run typecheck`,
      `npm run benchmark:wall-model`; backend parity/schema tests run through
      `tests_backend/test_wall_segment_model.py` and
      `tests_backend/test_validation.py`. HA import/export coverage runs in the
      normal Linux/CI Home Assistant harness when unavailable natively.

## Legacy draft migration and atomic wall-chain writes (#314, #478)

- [ ] `demo/smoke_v8_draft_write.mjs` (compatibility filename) proves that a
      model-v9 draft migrates once to ordinary partitions, preserves existing
      edge IDs/thicknesses and leaves no `room_drafts` in model v10.
- [ ] The same fake-WS smoke proves each accepted current wall reaches storage,
      a later edge preserves earlier identities, Undo removes only the terminal
      wall, and a closed chain creates a durable room without carrier debris.
- [ ] A rejected in-flight physical write synchronously rolls back its whole
      pending batch: active path, session partition IDs, pending map and command
      history are empty, so no optimistic ghost wall survives.
- [ ] Frontend/backend model tests consume the same
      `478-room-draft-migration-vectors.json`: missing/null IDs, colliding IDs,
      numeric strings, `null`/boolean thickness and epsilon-length edges must
      produce the same exact partitions or rejection reason in both runtimes.
      Backend coverage also rejects a stale v9 `room_drafts` write over v10.
- [ ] `demo/smoke_unified_wall_tool.mjs` accepts a room over a partially
      coincident older partition, preserves only its outside tail and an
      unrelated partition, then proves an immediate Optimize reports zero
      reconciliation and no config change. A forced missing post-mutation wall
      model restores the whole room transaction.
- [ ] Local commands: `npm test`, `npm run bundle:sync`,
      `node demo/smoke_v8_draft_write.mjs`, targeted backend pytest and
      `node scripts/check-docs.mjs --external`.
- [ ] Mutation `current-rejected-physical-write-keeps-optimistic-wall` proves
      the browser rollback scenario fails when rejection recovery is bypassed.
- [ ] Mutation `room-accept-leaves-coincident-partitions` proves the real editor
      smoke fails if accepted room carriers stop being consumed atomically.

## Current-writer fixed point (#477)

- [ ] `test/writer-fixed-point.test.mjs` proves seed-bounded repeated collinear
      merge, safe positive coincident reconciliation/opening rehost, identical
      fail-closed cases, exact room-reference rewrite/restore and the executable
      writer-owner manifest.
- [ ] `demo/smoke_writer_fixed_point.mjs` finishes a real straight Walls chain
      through the production bundle, then proves the immediate, post-Undo and
      post-Redo Optimize previews are no-ops. The same smoke deletes a room and
      restores/reapplies direct and cross-space vacuum references without
      overwriting unrelated marker fields.
- [ ] `demo/benchmark_wall_draw_click.mjs` keeps the #461 terminal-click budgets
      and structural counters, then separately proves finish uses one bounded
      physical/junction transaction, one write, no extra history and sublinear
      scaling when unrelated rooms are added.
- [ ] `test/align-grid.test.mjs` proves Optimize leaves complete furniture/image
      transforms byte-equivalent while an ordinary decor rectangle remains
      grid-bound.
- [ ] The `writer-*` mutations in `scripts/mutation-gate.mjs` remove one finish
      owner, pre-adoption safety, history normalization, direct/vacuum reference
      rewrite, free-transform exclusion, terminal-click separation, seed merge
      and seed reconciliation; each named witness must turn red.

## Resize: реальный pointer pipeline (#293)

- [ ] `demo/smoke_resize_pointer_real_plan.mjs` загружает tracked fixture
      второго этажа обычным `houseplan/config/get`, включает Resize кнопкой и
      двигает доступную общую стену только реальными `page.mouse` событиями.
      Прямые вызовы приватных resize-методов в этом smoke запрещены source
      guard-юнитом.
- [ ] На десятом шаге сетки обе комнаты имеют видимый preview, а server config
      ещё байт-в-байт исходный. Pointerup создаёт одну history-команду и одну
      запись; wall count и набор толщин сохраняются; Ctrl+Z возвращает исходную
      геометрию.
- [ ] Pointer capture продолжает жест минимум в двух диаметрах и 120 px от
      хэндла, чужой
      pointer id игнорируется, а Escape и `lostpointercapture` возвращают DOM и
      config без дополнительной записи.
- [ ] Невозможная физическая preview-геометрия останавливает стену на последней
      безопасной позиции и показывает один локализованный toast за жест. Отдельно
      проверяется отказ финального preflight без commit/history.
- [ ] Мутанты `resize-pointer-delta-zeroed`,
      `resize-shared-seam-not-coalesced`, `resize-pointer-capture-removed`,
      `resize-preview-reject-silent` и
      `safe-resize-commit-preflight-bypassed` обязаны красить соответствующие
      unit/production smoke guards.
- [ ] Fixed-topology wall records (#298): moving-wall breakpoints translate
      rigidly, side-wall interior endpoints never scale proportionally,
      the exact first-floor 49→52 gesture ends on 17/52/57/101, unrelated
      records remain byte-equivalent, and a full-span carrier/lattice proof
      rejects gaps before preview. Key-only legacy records move only by one
      whole-edge identity; partial midpoint ambiguity produces no preview,
      history or config write [unit: `wall-thickness.test.mjs`; auto:
      `smoke_resize_pointer_real_plan`, `smoke_resize_wall_thickness`, six
      `smoke_edit_walk` runs; mutation:
      `safe-resize-wall-endpoints-affine-scaled`,
      `safe-resize-legacy-midpoint-fail-open`].

## Opening symbol centreline (#242, #250)

- [ ] Unit and browser checks prove that door/window/gate stay on the wall
      centreline for both `flip_v` values, door/window flips change only their
      direction, and gate `flip_v` reverses the first-leaf 10° turn on shared room walls,
      independent partitions and hidden Iso without translating the gate
      [unit: `opening-symbol.test.mjs`, `iso-openings.test.mjs`; auto:
      `smoke_wall_thickness.mjs`, `smoke_isometric_contract.mjs`; mutations:
      `opening-symbol-flip-restores-edge-offset`,
      `opening-gate-flip-cancels-turn`].
- [ ] Matrix v37 adds four dedicated semantic scenes. Before PNG comparison
      they assert the saved flip value, wall centreline, visible-group offset,
      full jamb depth, window glass membership and opposite gate turn signs:
      `opening-symbol-room-wall-light`,
      `opening-symbol-diagonal-partition-dark`,
      `opening-symbol-flip-pairs-light`,
      `isometric-opening-symbol-parity-dark`.
- [ ] #250 reuses those four scenes and requires `offset: center` for every
      door/window/gate entry, including flipped pairs. The semantic guard must
      fail before PNG comparison if any saved flip restores a wall-face offset.
- [ ] The exact existing golden impact set below contains **67** scenes. It was
      measured by comparing `actualSha256` for HEAD and `origin/dev` under the
      same Chromium build; baseline status alone is not used because `dev`
      already has unrelated pending pre-release candidates. Every listed frame
      uses a shared fixture containing an affected opening or retains that plan
      behind an editor/dialog. No other existing frame changed:

      `isometric-geometry-view-dark`, `isometric-geometry-view-light`,
      `isometric-live-layers-dark`, `isometric-no-borders-dark`,
      `isometric-touch-kiosk-dark`, `isometric-large-warm-remount-dark`,
      `geometry-view-dark-fit`, `geometry-view-light-fit`,
      `room-label-parity-view-dark`, `room-label-parity-plan-dark`,
      `room-label-parity-view-light`, `room-label-parity-plan-light`,
      `day-cycle-dawn-dark`, `day-cycle-day-dark`, `day-cycle-dusk-dark`,
      `day-cycle-night-dark`, `geometry-plan-editor-dark`,
      `space-tab-drop-before-light`, `space-tab-drop-after-dark`,
      `plan-snap-endpoint-light`, `plan-snap-line-gaps-dark`,
      `junction-patch-resilience-plan-dark`,
      `opening-placement-door-thick-wall-dark`,
      `opening-placement-passage-thick-wall-dark`,
      `opening-placement-passage-thick-wall-light`,
      `geometry-devices-editor-dark`, `geometry-decor-editor-dark`,
      `tray-wide-selection-en`, `tray-wide-tool-ru`,
      `tray-medium-group-en`, `tray-medium-selection-ru`,
      `tray-narrow-palette-en`, `tray-narrow-tool-ru`,
      `geometry-diagonal-45-opening-dark`, `openings-thick-wall-dark`,
      `lighting-glow-sun-dark`, `device-value-badge-positions-dark`,
      `device-icon-state-table-light`, `device-icon-state-table-dark`,
      `device-text-shell-long-light`, `device-text-shell-long-dark`,
      `lighting-sun-window-state-only-dark`,
      `lighting-fill-light-axis-split-dark`,
      `lighting-fill-temp-axis-split-dark`,
      `lighting-fill-lqi-axis-split-dark`, `lighting-temp-glow-dark`,
      `lighting-temp-glow-light`, `lighting-custom-glow-dark`,
      `lighting-opaque-glow-two-doorways-dark`,
      `lighting-custom-glow-light`, `lighting-temp-glow-no-sources-dark`,
      `lighting-temp-glow-room-override-dark`,
      `lighting-manual-auto-spill-overlap-dark`, `hover-over-glow-dark`,
      `hover-nested-room-dark`, `large-house-zoom-040-dark`,
      `large-house-zoom-250-dark`, `large-house-warm-remount-dark`,
      `device-dialog-desktop-en`, `device-help-popover-light-ru`,
      `decor-color-popover-desktop-en`, `general-color-popover-desktop-en`,
      `space-room-color-popover-desktop-ru`,
      `backup-full-preview-desktop-en`,
      `backup-plan-only-export-desktop-en`,
      `optimize-preflight-dialog-dark-en`,
      `optimize-preflight-dialog-light-ru`.
- [ ] Baselines for the 67 existing and four dedicated scenes are accepted
      only from the reviewed full Linux pre-beta artifact. Local
      `golden:accept` remains forbidden.

## Empty-space lifecycle (#113)

- [ ] Active selection keeps active-or-first compatibility, while an empty
      model returns `undefined`; exact lookup of a stale saved id never falls
      back to another space [unit: `space-model-selection.test.mjs`].
- [ ] There are no unguarded `_spaceModel().…` dereferences, explicit-id calls
      use `_spaceModelById()`, and marker/position persistence validates its target
      before config/file/WS side effects
      [unit: `optional-space-model-contract.test.mjs`].
- [ ] Delete the last space while an editor gesture and debounced write are
      active: the empty card renders, View is restored, pointer/draft/dialog
      state is cleared, the pending write is cancelled and Add space still
      opens Create. Recreate a plan, then receive an empty WS config and repeat
      under a theme/resize/read-only tick [auto: `smoke_optional_space_model`].
- [ ] Removing the authoritative empty-state cleanup makes that smoke red
      [mutation: `empty-space-cleanup-disabled`].

## Fixed card space (#210)

- [ ] `floor` resolves exact stable IDs and zero-based finite integer indexes;
      quoted numeric strings stay IDs, and explicit empty, unknown, fractional,
      negative or out-of-range values fail closed [unit: `initial-load.test.mjs`].
- [ ] Three coexisting instances (fixed ID, fixed index and unpinned) keep
      independent authority while sharing the legacy navigation key. Fixed
      cards ignore hash, tabs, guarded internal transitions, warm remount,
      kiosk swipe/cycle/dots and never read or write saved navigation. Invalid
      config renders an accessible error without a spatial stage, while the
      unpinned card still restores legacy navigation
      [auto: `smoke_fixed_floor.mjs`, `smoke_nav_persist.mjs`, `smoke_kiosk.mjs`].
- [ ] The GUI offers stable IDs only, preserves an existing numeric YAML value
      during unrelated edits and deletes the `floor` property when cleared
      [unit: `fixed-floor-contract.test.mjs`; auto: `smoke_fixed_floor.mjs`].
- [ ] Bypassing the shared transition guard makes the focused browser scenario
      red; before-fix evidence also records that `origin/dev` has no fixed
      resolver or guarded transition
      [mutation: `fixed-floor-transition-guard-bypassed`].

## Open passage (#157)

- [ ] Подменю и диалог показывают четвёртый тип в порядке Окно / Дверь /
      Открытый проём / Ворота; новый проём имеет ширину 90 см. [auto: open-passage-contract, opening-placement]
- [ ] В Plan/View у passage отсутствуют створка, дуга, рамка и пунктир, но
      сохраняются hitbox, wall cut и room-coloured tunnel. [auto: opening-symbol, smoke_open_passage]
- [ ] Static вырезает и заполняет тоннель только для passage, не меняя старые
      door/window/gate. [auto: space-geometry, smoke_open_passage]
- [ ] Внутренний passage пропускает Glow, внешний и неизвестный будущий тип
      остаются fail-dark. [auto: light-visibility, smoke_open_passage]
- [ ] Passage в скрытой изометрии имеет full-height cut и zero leaves.
      [auto: iso-openings, golden]
- [ ] Смена типа предупреждает о датчике/замке; Save удаляет пять
      неприменимых ключей, Cancel не меняет config. [auto: open-passage-contract, smoke_open_passage]
- [ ] Full/space import отвергает forged binding до preview, а старое битое
      значение можно прочитать и очистить. [auto: test_validation, test_ha_import_export]
- [ ] Пять passage-мутантов из `scripts/mutation-gate.mjs` пойманы своими
      guards до передачи в review. [auto: mutation-gate]

## Independent-wall openings and structural axes (#132, #185)

- [ ] Door/window/gate/passage placement on a finished independent wall stores
      `host.kind/id/t`; a coincident room wall chooses that explicit host, while
      crossing or duplicate-host ties are rejected. [auto: opening-placement,
      partition-openings]
- [ ] Every hosted type cuts only its host full-depth in Plan/View/Static/Iso;
      exact composite room masonry is also cut, nearby bodies remain intact,
      and malformed hosts fail dark. [auto: physical-geometry,
      smoke_partition_openings]
- [ ] Rigid host drag preserves `t` and updates projections atomically; delete
      lists hosted openings, Cancel changes nothing, Confirm cascades in one
      Undo/Redo command. [auto: partition-openings, smoke_partition_openings]
- [ ] Contact/lock actions keep existing security rules; passage stays inert;
      windows and exterior passages stay opaque to Glow, and partition windows
      produce no sun wedge. [auto: runtime contracts, smoke_glow]
- [ ] Door/window/gate/passage presentation gaps do not split the structural
      axis used by the Walls face graph; real `open_spans` still do. [auto:
      plan-snap-overlay, smoke_room_autoclose, smoke_partition_openings]
- [ ] Backend rejects missing host references, out-of-range `t`, non-fitting or
      overlapping hosted openings and stale host stripping; exports round-trip
      the host. [auto: test_validation, test_ha_import_export]
- [ ] The exact #276 Optimize candidate is shared by frontend and backend tests:
      Python independently proves the removed partition, two-room solid wall,
      envelope, opening identity and non-overlap; config/set and every partial
      or mutated candidate remain rejected. Linux HA WS persists and reloads
      the implicit opening, then Undo restores the partition and explicit host.
      [auto: coincident-partitions, test_validation, test_ha_websocket]

## Independent-wall opening jamb margin (#186)

- [ ] Strict resolver and placement reserve half the host depth for
      door/window/gate/passage at both endpoints, including exact-boundary,
      diagonal, reversed, thickness and scale matrices; room-wall placement
      keeps its zero-jamb rule. [auto: partition-openings, opening-placement]
- [ ] Direct drag, dialog length edits and rebind share the same formatted
      RU/EN guidance; a rejected edit writes neither config nor history.
      [auto: smoke_partition_openings]
- [ ] Backend config/set and optimize reject a new/direct invalid geometry with
      `invalid_partition_opening_jamb_margin`, while unrelated writes, rigid
      translation and full backup restore preserve a legacy near-end record.
      [auto: test_validation, test_ha_websocket, test_ha_import_export]

## Room resize (docs/RESIZE.md)

- [ ] `ResizeController` is the sole owner of selection, gesture, preview,
      labels and eligibility cache. The card is only the DOM/render/persistence
      adapter; controller state-machine unit tests cover foreign pointers,
      repeated deltas, rejection rollback, cancel and exact commit
- [ ] One production wall-record preservation helper serves Resize and the
      invariant CLI. Resize checks exact multiplicity for every finite value,
      including `cm: 0`; the CLI keeps positive-value presence semantics
      [unit: wall-record-preservation + resize-controller]
- [ ] The «Размер» tool appears in the Plan editor toolbar; in EVERY other
      tool (and in Devices/Decor/View) there is not a single `.rszhandle`
- [ ] Every edge has a finger-sized midpoint handle. Eligible handles capture
      the pointer; ineligible handles remain visible/dimmed, expose a localized
      reason through hover/focus/tap, carry `aria-disabled=true`, and create no
      drag, Undo or write [auto: smoke_room_resize + resize-production-path]
- [ ] Only a numerically horizontal/vertical wall with perpendicular side
      edges is eligible. Diagonal, partial/unequal shared, coincident physical
      extra and third-owner cases fail closed with the stable reason matrix
      [unit: resize.test]
- [ ] A non-shared drag changes exactly one room; an exact endpoint-to-endpoint
      shared drag changes exactly two. Both existing endpoints move by one
      vector and every room keeps its vertex count/order [unit + smoke]
- [ ] An irregular exact pair moves only until the first corner/grid node that
      would change the moving segment or collapse a side. No third room can
      join the gesture. The anonymized private #277 topology stays predictably
      disabled [unit fixture + production pointer smoke]
- [ ] Side-wall ownership stays atomic (#289): the anonymized 43-step repro is
      disabled before pointer capture in both directions, while an outer side
      reaches but cannot cross the next room's edge. No thickness record can
      become partly shared and partly outer
      [unit: resize.test + fixture 289-mixed-role-resize; auto:
      smoke_room_resize; mutation: safe-resize-side-ownership-bypassed]
- [ ] Wall compaction preserves physical ownership (#299): equal thickness on
      `shared(A,B) -> outer(A)` and `shared(A,B) -> shared(A,C)` remains split
      at the exact role breakpoint, while equal neighbouring atoms inside one
      role still compact. Optimize on `real-plan-first-floor.json` is immutable,
      invariant-clean and idempotent; real-plan edit-walk seeds 1 and 3 exercise
      Optimize and Delete-room/Keep-walls without producing a mixed-role record
      [unit: wall-thickness + plan-optimizer; auto: smoke_edit_walk seeds 1/3;
      mutation: wall-compaction-owner-role-bypassed]
- [ ] Live badges while dragging: lengths of the dragged wall + both
      adjacent walls, and the m² area at the room centre; dragging a shared
      wall shows BOTH areas; all numbers update continuously
- [ ] Stops are contiguous from zero: 30 cm room clearance, first topology
      corner, foreign room/island, partition/column and every side-wall
      opening. The opening jamb includes half the moving wall thickness, and a
      wall cannot jump through an invalid interval to a later valid position
- [ ] An ordinary door/window/gate ON the moving wall travels exactly once;
      length/type/angle/other fields remain byte-equivalent. A hosted opening
      never transfers to a room wall through Resize
- [ ] The corner scale frame and its four handles are absent. Source guard
      proves `applyRoomScale`, `clampRoomScale`, partial-shared insertion and
      commit-time `simplifyPoly` are unreachable from `houseplan-card.ts`
- [ ] Esc, pointercancel and lost capture cancel instantly with original
      persisted geometry, zero Undo and zero config writes
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
- [ ] Exact eligible wall thickness/open spans re-key losslessly in the same
      overlay; unrelated extras and rooms are byte-equivalent. Any production
      wall/floor failure on the exact final preview cancels before save
- [ ] `npm run benchmark:safe-resize`: pointer clamp p95 ≤16 ms, ≤20% over the
      same-run historical baseline (with bounded noise); cached pointerup
      preflight p95 ≤75 ms; active-plan delta cache ≤4096 entries
- [ ] `npm run benchmark:safe-resize-render`: on the 20-room/80-handle floor,
      a warm Resize layer takes one geometry snapshot per frame and stays at
      p95 ≤25 ms
- [ ] Six Resize mutants are caught: axis eligibility, third-room cascade,
      topology signature, side ownership, physical jamb and controller commit
      preflight
- [ ] The test-only Resize eligibility audit calls the production resolver,
      pins exact post-Optimize totals/reason counts and per-handle identities
      for both real-plan fixtures, and reports stable handle ids when the
      baseline changes. The known second-floor shared seam has two enabled
      owner handles; raw-vs-optimized classification proves near-axis repair
      removes only false angle reasons [unit: resize-availability-audit.test;
      source: resize-production-path; mutation: resize-audit-resolver-bypassed]
- [ ] Disabled Resize handles expose the same actionable localized explanation
      through aria-label, click, Enter and Space; pointerdown starts no drag and
      creates no history/write [auto: smoke_room_resize]
- [ ] Device markers do not move; the room settings gear re-centres itself
- [ ] Smoke: `node demo/smoke_room_resize.mjs`

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

## Honest new-space display defaults (#204, dev, unreleased)

- [ ] **The dialog and Save agree**: open a new space. File begins with room
      borders/names `false/false`; before either control is touched, switching
      to Draw shows `true/true` and switching back restores `false/false`.
      Saving either source and reopening it yields the exact visible pair
      [auto: `space-dialog.test`, `smoke_space_create_display_defaults`,
      `smoke_space_settings`].
- [ ] **One touch protects both choices**: on Draw change either display
      switch, including the mixed `true/false` and `false/true` cases. Further
      File ↔ Draw switches change only the source; Save never silently restores
      `true/true` [auto: `space-dialog.test`,
      `smoke_space_create_display_defaults`; mutation:
      `space-create-hidden-display-override`].
- [ ] **Draft state does not leak**: Cancel and a fresh Create return to File
      `false/false`. In Floors/Areas onboarding every next floor also starts
      clean and cannot inherit the preceding floor's touched state
      [auto: `smoke_space_create_display_defaults`].

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
- [ ] **Hover width follows wall centimetres (#303)**: on a 30 cm cell a
      50 cm wall's hover fill matches the masonry within 2%; a zero-thickness
      wall keeps the same physical visual minimum across cell sizes, while the
      pointer still hits at five grid pitches from the axis
      [unit: grid-scale.test.mjs; auto: smoke_wallthick_hover_width;
      mutations: wallthick-hover-floor-back,
      wallthick-zero-strip-not-visual, wallthick-hit-narrowed]
- [ ] **Hatched body, clean-floor area**: after setting thickness a `.wallbody`
      path appears; room-card and tooltip m² both decrease to the same inner-
      contour area
      [auto: smoke_wall_thickness]
- [ ] **Exact thickness transition after Split**: split one zero-thickness room,
      apply 10 cm to every wall of one child and keep the other child at zero.
      Both halves of the 10 cm facade end at the divider endpoint; no hatch,
      paper or light masonry continues along the zero side. Plan, View, static
      and hidden Iso consume the same stepped geometry
      [auto: smoke_wall_thickness_transition + test/wall-thickness.test.mjs]
- [ ] **One virtual-junction patch cannot blank the plan (#197)**: load the
      complete 8-room, 25-wall, 3-cut regression fixture. Its ULP-noisy patch
      is stabilised below geometry tolerance; a forced failure of one optional
      patch retains the previous body and later patches still run. Plan, View,
      kiosk, static and hidden Iso keep one non-empty canonical masonry path;
      paper, clean-floor and light/sun consumers stay non-empty, and theme/HA
      ticks neither rebuild topology nor write configuration
      [auto: test/wall-thickness.test.mjs +
      smoke_junction_patch_resilience + junction-patch-resilience golden
      scenarios].
- [ ] **A bounded T-junction keeps its exterior half-wall (#261)**: in the
      anonymised #197 fixture the measured point `(895.5, 556)` is filled by
      room masonry, final masonry and paper, and excluded from clean floor.
      Plan, View, kiosk, Static, hidden Iso and light/sun barriers agree at that
      point, while the old excessive #249 spike remains absent
      [unit: test/wall-thickness.test.mjs; auto:
      smoke_junction_patch_resilience; golden:
      junction-patch-resilience-plan-dark +
      junction-patch-resilience-view-dark; mutation:
      multi-wall-paper-full-origin-cut].
- [ ] **Degree-3 repair stops at every finite ray endpoint (#271)**: canonical
      co-directional rays retain separate short-thick and long-thin supports;
      the rebuilt masonry, paper and light barrier contain the real short arm
      but no area after its endpoint. Plan, View, kiosk, Static, hidden Iso and
      clean floor agree, independent of owner order, winding and scale
      [unit: test/wall-thickness.test.mjs; auto:
      smoke_junction_patch_resilience; golden:
      junction-patch-resilience-plan-dark +
      junction-patch-resilience-view-dark; mutation:
      multi-wall-finite-ray-disabled].
- [ ] **A degree-3+ junction has no enclosed white triangle (#272)**: every
      excessive bevel sector remains empty but is connected to the exterior
      through a finite-width local corridor. Equal/mixed T and X nodes at
      `cell_cm: 1/5` have zero local holes in room/final masonry and paper;
      Plan, View, kiosk, Static, hidden Iso and light/sun agree
      [unit: test/wall-thickness.test.mjs; auto: smoke_multiwall_junction;
      golden: multiwall-junction-bevel-view-dark; mutation:
      multi-wall-exterior-corridor-disabled].
- [ ] **A perpendicular T/X junction keeps every real wall strip (#275)**:
      every finite ray with a perpendicular partner remains filled through its
      node even when the removed sector is exterior-connected or neighbouring
      node masks overlap. Mixed orthogonal/diagonal nodes protect only the
      qualifying rays; the non-orthogonal #249 wedge stays empty. Raw,
      Optimize preview, applied storage and reload agree at `cell_cm: 5/1`, as
      do Plan, View, kiosk, Static, hidden Iso, paper, clean floor and light
      [unit: test/wall-thickness.test.mjs; auto:
      smoke_multiwall_strip_containment; golden:
      orthogonal-strip-cell-5-view-dark +
      orthogonal-strip-cell-1-view-dark; mutation:
      multi-wall-orthogonal-strip-protection-disabled; exact local gate:
      scripts/wall-strip-containment.mjs].
- [ ] **A short multi-wall ray cannot erase its attached shared wall (#288)**:
      the real second-floor `349 / 120 / 5` node keeps the 20 cm wall beginning
      at the short ray's far endpoint; both tracked real plans have zero
      undeclared centreline gaps, while the #271 outer phantom remains absent
      [unit: test/wall-thickness.test.mjs; auto:
      smoke_real_plan_masonry; mutation:
      multi-wall-shared-continuation-protection-disabled].
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
- [ ] **Shared once / zero → line / safe Resize**: one body for a shared wall;
      setting thickness to zero restores the centreline. Resize preserves
      thickness on an eligible uniformly thick exact wall. Partial/unequal
      shared and mixed-thickness walls remain visibly disabled; an attempted
      drag changes no rooms, openings, wall atoms or Undo history
      [auto: smoke_wall_thickness + smoke_zero_walls +
      smoke_resize_wall_thickness + smoke_room_resize +
      test/wall-thickness.test.mjs + mutation-gate]
- [ ] **Wall key survives storage round-trip (#258)**: exact grid endpoints and
      their nine-decimal stored form produce one midpoint key, including odd
      and even lengths, negative/reversed coordinates and render-space scale.
      Both known persisted key variants resolve the same exact span immediately
      without accepting a parent, child, neighbour or parallel wall. The
      affected T-node stays filled in Plan, View, kiosk, Static and hidden Iso;
      clean-floor and light barriers use the same masonry. Explicit Optimize
      rewrites the stable key and the next in-memory/backend echo is a no-op
      [unit: test/wall-thickness.test.mjs + test/plan-optimizer.test.mjs +
      test/model-invariants.test.mjs; auto: smoke_wall_key_roundtrip; golden:
      wall-key-roundtrip-view-dark; mutation: wall-key-storage-normalization-disabled +
      wall-exact-span-fallback-disabled + invariant-wall-key-storage-normalization-disabled].
- [ ] **Zero-wall T-junction**: when two positive thick arms from different
      room contours meet at a zero-wall endpoint, the outside corner is a clean
      mitre with no stair-step. Editors paint the complete zero axis above the
      real hatch; View paints it below the body so jambs mask its ends without
      changing stored geometry [auto: test/wall-thickness.test.mjs +
      smoke_zero_walls].
- [ ] **Zero fragment normalisation**: adjacent or overlapping `cm:0` atoms
      with the same ownership compact without losing the exact breakpoint at a
      positive thickness or owner-role change. Resize transforms their stable
      endpoints without recreating legacy `open_spans/open_to`
      [auto: test/wall-segment-model.test.mjs + test/wall-thickness.test.mjs +
      smoke_zero_walls].
- [ ] **Near-axis authoring and explicit repair (#290)**: the shared
      `0.25°` classifier includes `316×1`, excludes `316×2` and 30° diagonals,
      and Walls preview/click persist `316×0` without claiming the wrong saved
      endpoint. Optimize deduplicates the tracked shared wall across two room
      owners, reports one wall and an exact physical maximum, rekeys thickness,
      passes production preflight, applies one atomic write, reloads as a no-op
      and restores the original through one Undo. Independent walls use the
      same classifier; unsafe candidates are counted as skipped
      [unit: test/near-axis.test.mjs; auto: smoke_plan_drawing_repairs +
      smoke_near_axis_optimize; mutations: `near-axis-threshold-weakened`,
      `near-axis-inclusive-boundary-disabled`,
      `near-axis-authoring-snap-bypassed`].
- [ ] **Explicit Optimize cleans only an isolated micro-interval (#198)**:
      `22 → 15 → 22` with a centre shorter than half a grid step and no
      room/opening node becomes one 22 cm run in Preview and Apply; Cancel
      writes nothing and server Undo restores the three exact entries. Exact
      half-step, end, unequal-neighbour, chained and topological cases remain
      lossless at normalized/render scales; a second Optimize is idempotent
      [unit: test/plan-optimizer.test.mjs; auto:
      smoke_optimize_micro_interval; mutation:
      `optimizer-micro-interval-cleanup-disabled`].
- [ ] **A single T-node does not preserve an artificial thickness island
      (#273)**: the minimized beta.5 `22 → 15 → 22` profile has a 1.381904-unit
      centre beside one perpendicular room edge. Preview/Apply store one 22 cm
      run, the T coordinate and incident room stay unchanged, render probes
      see one continuous outer face, reload is idempotent and server Undo
      restores the exact entries. A second topology endpoint or any open-span
      endpoint still blocks cleanup [unit: test/plan-optimizer.test.mjs; auto:
      smoke_optimize_micro_interval; mutation:
      `optimizer-single-topology-island-blocked`].
- [ ] **Optimize reconciles only one exact coincident wall (#276)**: the
      anonymized two-room fixture keeps its two 5 cm endpoint offsets while an
      exact independent wall is removed, its hosted door becomes an ordinary
      opening at the same centre/angle with all bindings and unknown fields,
      and the wider centred thickness survives. Direction and room order do
      not matter; three non-overlapping hosted door/window/gate records are
      rehosted atomically, while a hosted-hosted overlap and all other
      partial/extra/unknown/column/opening conflicts fail closed. Preview
      writes nothing, Apply uses one WS transaction,
      reload is idempotent, Undo restores the hosted form, and Boundary plus
      Thickness target the resulting shared wall. Four targeted golden scenes
      retain the 5 cm offset and show before, 10 cm, 30 cm and virtual results;
      the paired large-house benchmark enforces p95 overhead ≤15% and ≤25 ms,
      while source ownership plus an injected counter keep the helper out of
      render/pointer paths [unit:
      test/coincident-partitions.test.mjs + test/plan-optimizer.test.mjs;
      auto: smoke_optimize_coincident_partition; mutations:
      `optimizer-coincident-opening-rehost-disabled`,
      `optimizer-coincident-partial-accepted`, existing
      `optimize-preflight-bypassed`; performance:
      `npm run benchmark:coincident-partitions`; golden:
      `coincident-partition-{before,thin,thick,virtual}-dark`].
- [ ] **Optimize unlocks only proved zero-range Resize handles (#281)**: three
      exact independent partitions over solid one-room outer boundaries block
      the affected shared-wall Resize before maintenance. Optimize removes all
      three, materializes both hosted windows without changing their fields,
      passes independent backend proof and is idempotent. Afterwards the target
      handle has a non-zero grid step in both directions and one production
      pointer gesture changes exactly the two adjacent rooms. Partial, unknown
      or opening-overlapped outer candidates remain untouched. Every handle
      reported enabled on the anonymized `44.json` fixture has a non-zero
      contiguous range; a zero-range handle stays visible/focusable but disabled
      and captures no pointer [unit: test/resize-optimize.test.mjs; backend:
      tests_backend/test_validation.py + tests_backend/test_ha_websocket.py;
      auto: smoke_resize_outer_reconciliation].
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

## Wall chains, partitions and columns

- [ ] **Persistence and joining**: every accepted wall-chain edge is immediately
      one ordinary partition with its selected thickness and one history/save
      boundary. Switching tools or reloading leaves those walls intact but does
      not resume their chain. A current config never stores `room_drafts`; a v9
      draft migrates edge-for-edge to partitions [auto: smoke_free_walls +
      smoke_unified_wall_tool + frontend/backend wall-segment-model tests].
- [ ] **Creation limits and validation**: 1/100 cm partitions and 1/150 cm
      columns save exactly. Zero, NaN and 101/151 cm block the final click with
      a range toast and create no history entry. Client caps match backend:
      2000 partitions and 500 columns [auto: backend validation +
      smoke_free_walls].
- [ ] **Select gestures**: creation tools click through existing physical
      bodies. Select gives at least a 24 px target, cycles overlaps on repeated
      clicks and moves a partition rigidly on the grid. Escape/pointercancel
      restores the pre-drag state. A square column rotates in 5° steps (Shift
      free); a circle has no rotation handle [auto: smoke_free_walls; manual].
- [ ] **Delete contract**: every accepted open-chain edge is an ordinary
      independently selectable partition. Delete and properties therefore use
      the standard partition confirmation/dialog; there is no whole-outline or
      segment-of-draft action [auto: smoke_free_walls].
- [ ] **Area and light**: overlapping bodies are subtracted once from clean
      area; closed partition rings keep the enclosed floor; bodies outside all
      rooms create no paper. Glow does not cross a long nearby partition and a
      source inside masonry lights nothing. Window rays are blocked by the same
      bodies. `show_borders: false` changes paint only [auto:
      physical-geometry.test; manual visual].
- [ ] **Seamless junctions**: partition L corners (right, acute and
      obtuse), unequal thickness, endpoint-on-line T and a branch touching a
      room wall use one bounded joined body; near-miss, X crossing, malformed
      segments and flat free caps keep their documented semantics. The active
      rubber-band has the same contour before and after commit, target records
      are not split, Plan/View/static/hidden-iso paths agree, clean floor and
      light use the joined corner, and preview/render never writes config
      [auto: wall-thickness.test, physical-geometry.test,
      smoke_wall_junctions, wall-junctions golden scenarios; manual golden
      artifact review].
- [ ] **Lifecycle/performance**: an external config revision cancels live
      move/rotate state before replacing geometry. Drag preview performs no
      polygon boolean work; clean floor and Glow clips are reused until the
      config/space/source changes [auto: editor/preloader smokes; performance
      profile for a dense plan].

## Вписывание выбранной комнаты (#152)

- [ ] В View чистый mouse click и одиночный touch tap по полу простой,
      вогнутой и вложенной комнаты центрируют именно browser-target и помещают
      её видимый пол вместе с ограничивающими стенами в центральные 80% stage.
- [ ] В Flat и Iso ограничивающая ось даёт поля `10% ± 1 CSS px`; устройства,
      badges, room label, Glow, солнце, подложка и декор bounds не расширяют.
- [ ] Device/capsule, opening/lock/action, vacuum и HA Area link выполняют только
      своё действие; pan выше click threshold, pinch и long press не запускают
      room fit, а движение ниже threshold остаётся tap.
- [ ] В kiosk два tap по комнате не запускают Fit all и не меняют background
      double-tap sequence; два tap по свободному фону сохраняют прежний reset.
- [ ] Быстрые клики разных комнат retarget-ят один camera controller; повторный
      fit уже вписанной комнаты не создаёт RAF и не пишет `LS_ZOOM`.
- [ ] Stable resize атомарно пересчитывает активную комнату. Wheel, zoom buttons,
      Fit all/home, pan/pinch, mode/space/projection, hidden/disconnect и новая
      structural snapshot снимают intent.
- [ ] Видимая подпись имеет один `role=button`/tab stop, локализованное имя и
      `:focus-visible`; Enter/Space вызывают тот же fit и не двигают focus.
      Скрытая/безымянная подпись не создаёт невидимый tab stop.
- [ ] Pure proofs: `node --test test/room-fit.test.mjs`; полный cycle:
      `npm run typecheck`, `npm test`, `npm run build`. Browser matrix и
      мутации room ownership и session-only zoom persistence выполняются перед
      бетой.
