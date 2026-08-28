# Manual testing checklist

## Правила для новых тестов (issue #85) — обязательны

Зелёный тест в этом проекте несколько раз означал «ничего не проверено»:
смок непрерывности не заметил удаления механизма, который защищает; golden-сцена,
заведённая под #71, была пустой; смок теней был зелёным, пока тени физически не
рисовались. Общее у всех случаев — **тест ни разу не проверяли на способность
падать**. Отсюда правила.

1. **Наличие атрибута, класса или узла — не проверка поведения.** Такой ассерт
   допустим только рядом с пиксельным либо поведенческим: атрибут доказывает,
   что код выполнился, а не что механизм сработал.
2. **Golden-сцена, заведённая под конкретную задачу, несёт семантический
   ассерт** (`warmPixelRegion` и родственные в `demo/golden/run.mjs`): сцена
   обязана падать, если перестала показывать то, ради чего заведена. Пиксельный
   дифф с эталоном этого не заменяет — пустая сцена совпадает со своим пустым
   эталоном идеально.
3. **Фикстура содержит слои, которые тест защищает.** Смок непрерывности без
   подложки, Glow и декора проверяет пустую страницу; солнце с азимутом, при
   котором луч не достигает единственного окна (#89), — та же ошибка в
   геометрии.
4. **Тест, охраняющий механизм, сопровождается мутантом** в
   `scripts/mutation-gate.mjs`: 2–5 строк патча, воспроизводящего поломку,
   против которой тест заведён, и тест обязан на ней краснеть. Чистым функциям
   с обычными юнитами мутант не нужен.
5. **Тавтологический ассерт — читающий то же свойство, которое код только что
   выставил, — не пишется вовсе.** Он может упасть только при удалении строки,
   но не при её неработоспособности.

Проверка: `node scripts/mutation-gate.mjs --check` — якоря патчей живы;
полный прогон — workflow `mutation-gate.yml` (четыре чересполосных шарда,
`--shard=i/4`), перед стабильным релизом и по понедельникам. Дешёвая половина
идёт с юнитами: `test/mutation-gate.test.mjs`. Локально для дельты задачи —
`node scripts/mutation-gate.mjs --changed origin/dev..HEAD`: гоняются только
мутанты, чьи patch-файлы задеты диффом (#332). Бандл собирается только
мутантам с браузерным гвардом; компиляция тестов в worktree стартует с
тёплого `test-build/` основного дерева.

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

## Atomic model-v8 draft writes (#314)

- [ ] `demo/smoke_v8_draft_write.mjs` proves that write sanitation preserves
      the carrier ID after duplicate adjacent points, Undo keeps all surviving
      IDs, and two successful queued physical writes retain the newer edge.
- [ ] The same fake-WS smoke rejects the first in-flight physical write and
      observes synchronous rollback of its whole pending batch: active path,
      pending map and command history are empty, and finishing the tool cannot
      create a ghost partition.
- [ ] The smoke also loads the anonymised
      `demo/fixtures/v8-draft-regression.mjs` population (13 rooms, 44 wall
      catalogue segments, 24 intentional partitions, one known unusable
      draft), closes and reloads a new room through the real editor path, then
      runs the `model-invariants.mjs` CLI before and after. The exact existing
      `unusable_draft` finding must remain the only violation; no independent
      object may disappear and no new hidden obstacle may appear.
- [ ] `tests_backend/test_wall_segment_model.py` accepts valid independent v8
      draft/partition/column/hosted-opening changes with an unchanged contour
      catalog, while the existing current/downgraded stale-contour negatives
      and complete `CONFIG_SCHEMA` checks remain fail-closed.
- [ ] Local commands: `npm run typecheck`, `npm run bundle:sync`,
      `node demo/smoke_v8_draft_write.mjs`, targeted backend pytest and
      `node scripts/check-docs.mjs --external`.
- [ ] Mutations `v8-draft-sanitation-shifts-segment-identity` and
      `v8-rejected-physical-write-keeps-optimistic-draft` prove that the pure
      ID fixture and browser rollback scenario fail on the original defects.

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

## Decor composition order (#231)

- [ ] All five decor kinds render in one `.decorlayer` after opaque room/data
      fill, active room-hover fill, opening tunnels and Glow-base rooms/tunnels,
      but before live Glow, sun, physical walls, opening symbols and the HTML
      device/room-label layer [auto: `smoke_decor_layer_order.mjs`,
      `smoke_glow.mjs`].
- [ ] Pixel probes through an opaque room and a filled opening tunnel stay the
      decor colour before/after hover and over Glow base. Restoring the old DOM
      order makes those probes red [auto: `smoke_decor_layer_order.mjs`;
      mutation: `decor-restored-below-room-fills`].
- [ ] The complete #231 golden impact set is reviewed before baseline
      acceptance. The two dedicated Light/opaque-hover and Dark/Glow-base
      scenes contain all five decor types and semantic probes in both rooms and
      the shared doorway. The three existing large-house scenes also change
      because their dense decor grid now renders above Glow-base room fills.
      Reviewed baselines are accepted only from the Linux release artifact
      [golden: `decor-over-opaque-hover-light`,
      `decor-over-glow-base-dark`, `isometric-large-warm-remount-dark`,
      `large-house-zoom-250-dark`, `large-house-warm-remount-dark`].
- [ ] `hide_decor`, the Background editor override and stored config remain
      unchanged; no per-object under-plan compatibility flag is introduced.

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

## Device icon design package (#179)

- [ ] Pure presentation tests cover lock/unlock, exact marker-only LQI bands
      `0/40/41/179/180`, unchanged room gradient, package pulse defaults,
      semantic colors and reduced motion
      [unit: `device-presentation.test.mjs`, `device-pulse.test.mjs`].
- [ ] Shared face tests cover shell/core DOM, four Double positions, a third
      legacy section, deterministic font fitting, full text and safe CSS color
      variables [unit: `device-face.test.mjs`].
- [ ] The browser renders the exact shell ratio and shadow color, Light/Dark
      cores without backdrop blur, state/LQI colors, 3.6 s presence pulse,
      unavailable no-hover, full Text/Double values, 44×44 target, View and
      Device-editor keyboard paths, and no Plan tab stop
      [auto: `smoke_device_icon_design.mjs`].
- [ ] Full plan, preview and static card preserve the same face after the DOM
      redesign; static mode, state/value and disabled-device contracts stay
      green [auto: `smoke_device_preview_parity.mjs`, `smoke_static_icon.mjs`,
      `smoke_state_value.mjs`, `smoke_disabled_device.mjs`].
- [ ] Restoring unavailable hover, shifting the LQI boundary, restoring value
      ellipsis or bypassing `_clickDevice()` makes its guard red
      [mutation: `device-unavailable-hover-restored`,
      `device-marker-lqi-low-boundary-shifted`,
      `device-long-value-ellipsis-restored`,
      `device-keyboard-bypasses-click-path`].
- [ ] Pre-beta golden reviews desktop/mobile Light/Dark states, combo states,
      Text, four Double positions, long and legacy values, LQI, reduced motion,
      sizes 32/56/96 and colored backgrounds. Full smoke/golden/performance
      remains a Linux release gate.

## Device marker polish and pointer modality (#212)

- [ ] Shared icon geometry applies one 0.9 visual factor after card/per-marker
      sizing, keeps the saved centre and 44×44 hit floor unchanged, and gives
      wide Text cores a radius equal to half their height
      [unit: `device-marker-polish-contract.test.mjs`; auto:
      `smoke_device_icon_design.mjs`].
- [ ] Only a genuinely dispatched toggle/run action produces one
      `1 → .95 → 1` feedback cycle lasting 200 ms. Info, editor, confirmation
      before acceptance, unavailable/secure/no-target and cancelled gestures do
      not; reduced motion has no scale tween
      [auto: `smoke_device_icon_design.mjs`].
- [ ] Pointer authority is isolated per card. Touch/pen and compatibility mouse
      input clear JS/CSS hover, while a later real mouse restores it only on
      fine/hover hardware; mode/space/visibility/disconnect cleanup remains
      bounded [unit: `pointer-modality.test.mjs`; auto: `smoke_feedback_v2.mjs`].
- [ ] Pre-beta visual review covers Light/Dark desktop and touch matrices for
      ordinary, Text, Double, unavailable and vacuum markers; full golden and
      performance gates remain release work.

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

## Toggle confirmation state (#103)

- [ ] Every executable `ToggleNextEffect` formats current and expected lines
      without deriving direction from the state label; `toggle` names Home
      Assistant as the authority and a no-operation intent produces no lines
      [unit: `device-toggle.test.mjs`].
- [ ] All-off/mixed/partial groups use only executable targets for their
      active/total count and show skipped targets as a separate line
      [unit: `device-toggle.test.mjs`].
- [ ] EN/RU confirmation renders prompt → current → expected → skipped before
      the buttons, wraps a long name at 390 px and has no horizontal scroll
      [auto: `smoke_toggle_confirmation.mjs`].
- [ ] A state race with the same target executes the newly resolved direction;
      a changed target set makes zero service calls and shows the existing
      retry toast [auto: `smoke_toggle_confirmation.mjs`].
- [ ] Cover, virtual-light, HA-control and Run confirmations keep their
      existing actuation/cancel contracts [auto: `smoke_cover_tap`,
      `smoke_virtual_light_toggle`, `smoke_ha_controls`, `smoke_controls`,
      `smoke_tap_run`].

## Unified color and opacity picker (#57)

- [ ] RGB↔HSV round trips stay within one RGB channel; 3/6-digit HEX input is
      normalized and invalid drafts never become persisted colors
      [unit: `color-picker.test.mjs`].
- [ ] Every existing `hp-color-opacity` consumer receives per-card localized
      labels through the unchanged color/opacity event contract, and the shared
      component contains no native `input[type=color]`
      [unit: `color-picker.test.mjs`].
- [ ] At 390 px the one surface exposes hue, saturation, brightness, HEX and
      opacity without horizontal overflow; keyboard Shift+Arrow, touch pointer
      cancellation, invalid HEX recovery, Escape focus return and disabled mode
      remain safe [auto: `smoke_color_picker.mjs`].
- [ ] The color-only Glow consumer keeps the same picker without an opacity row,
      and native/fallback floating surfaces remain mutually exclusive with help
      [auto: `smoke_help_affordance.mjs`].
- [ ] The Hue range keeps `0…359`, step 1 and its existing input events while its
      WebKit/Blink and Gecko tracks expose the same cyclic spectrum. A dual
      theme-aware ring keeps the native thumb distinct from every hue, while
      forced-colors falls back to system track/thumb rendering [unit:
      `color-picker.test.mjs`, auto: `smoke_color_picker.mjs`].
- [ ] The dark mobile and light desktop open-picker goldens are reviewed from the
      complete Linux artifact before a beta; baseline acceptance is not part of
      the implementation loop [golden: `decor-color-popover-mobile-ru`,
      `decor-color-popover-desktop-en`].

## Unified picker coverage for every color field (#180)

- [ ] A recursive source contract rejects every native `input[type=color]` in
      product TypeScript and fixes the complete shared-component inventory at
      13 template instances [unit: `color-picker.test.mjs`].
- [ ] The 11 general light/temperature/LQI/Glow/wall palettes and the space room
      colour move their existing opacity into the unified picker; color and
      alpha update one parent draft atomically [unit: `color-picker.test.mjs`,
      auto: `smoke_color_picker_consumers.mjs`].
- [ ] Global background, space background and activity ripple are color-only;
      opening/closing does not materialize an inherited/default value, and
      Default/Inherit restore `null` without adding alpha
      [auto: `smoke_color_picker_consumers.mjs`].
- [ ] General settings keep one exclusive picker open among 12 swatches; marker
      activity colour and ripple size use separate, non-overlapping mobile rows,
      ripple size remains independent, and cancelling the space dialog writes
      no color draft [unit: `color-picker.test.mjs`, auto:
      `smoke_color_picker_consumers.mjs`].
- [ ] The three new dialog families are reviewed from the complete Linux
      artifact before a beta; implementation does not accept their baselines
      [golden: `general-color-popover-desktop-en`,
      `device-ripple-color-popover-mobile-ru`,
      `space-room-color-popover-desktop-ru`].


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


## Device value badge (#90)

- [ ] An untouched legacy thermometer/humidity marker remains pixel-identical;
  saving another field does not materialize `value_badge`. [auto: device-presentation]
- [ ] Explicit on/off overrides the legacy temperature gate; zero, false and
  off remain visible, while missing/unknown/unavailable render a stable `—`. [auto: device-presentation]
- [ ] State, every allowlisted attribute, derived LQI and `marker:<id>` light
  state resolve identically on the full plan, static space card and preview. [auto: smoke_device_preview_parity]
- [ ] Opening the editor explicitly selects the persisted source and position,
  even when they are not the first dynamic options, without touching config. [auto: smoke_device_preview_parity]
- [ ] Right, bottom, left and top update live in the editor; bottom stacks above
  system LQI and derived LQI suppresses the duplicate system row. [auto: device-presentation]
- [ ] Browser bounding boxes stay inside `.previewstage` with a safe gap for
  all positions, a long value, scale ×3 and the maximum activity ring. [auto: smoke_device_preview_parity]
- [ ] Rebind resets the source, delete leaves a missing diagnostic reference,
  and space import remaps internal refs or disables/counts external refs. [auto: test_ha_import_export]
- [ ] `static_icon` suppresses but preserves the setting; live-state and room
  label toggles do not suppress an explicit badge. [auto: device-presentation]

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
- [ ] The local short-activity demo lasts 3.3 seconds and the continuous demo
      runs until stopped. Neither sends a service call; reduced motion uses a
      compact dot, and both reset immediately on binding change, real activity
      or alarm.
- [ ] Provider metadata is cached between dialog openings and refreshed after
      registry/config-entry changes; source integrations remain separate from
      the binding provider.
- [ ] Long provider/source/state text wraps without horizontal scroll; maximum
      marker/ripple size fits the stage and reports its preview scale.
- [ ] Derived temperature/humidity values keep the compact plan form (`22.4°`,
      `48%`), while a direct entity value continues to use HA localization and
      units.

## Device icon package parity (#211)

The independent reference subset under
`demo/srv/reference/device-icons/` comes directly from designer package 1.1.1;
it is not generated from production CSS. The package archive hash and the
owner's #219 red/green Lock/Unlock paint override are recorded in that
directory's README.

- [ ] `node demo/smoke_device_icon_design.mjs` reads the SVG colors and stroke
      widths, then compares them with fresh computed styles. It also measures
      circular core/shell geometry, the real `mdi:lightbulb-spot` painted path,
      value-pill radius and 44×44 hit area at 32/56/96 px.
- [ ] `node demo/capture_device_icon_reference.mjs` writes a two-column
      **Reference SVG / Runtime** matrix for both themes to
      `artifacts/device-icon-reference/`. Code review must inspect this artifact
      visually; a green historical golden is not proof of package parity.
- [ ] Preview/static parity and unavailable keyboard/tap behavior remain
      covered by `smoke_device_preview_parity`, `smoke_static_icon` and
      `smoke_disabled_device` after a fresh production build.

## Device marker geometry and input polish (#213)

- [ ] `node demo/smoke_device_icon_pixel_alignment.mjs` covers core bases
      24…112 CSS px in quarter-pixel steps at DPR 1/1.25/1.5/2. DOM centres,
      isolated painted centroids/support and a deliberate 1 CSS px mutant must
      distinguish browser raster parity from a persistent offset.
- [ ] `node demo/smoke_device_icon_design.mjs` keeps the effective 32/56/96
      geometry, uses the direct 0.55 MDI/core ratio and proves hover plus the
      configured action from the far value-capsule end at right/bottom/left/top.
- [ ] Opening binding/registry-less/lock-action smokes preserve the secure
      no-toggle-on-plan invariant while checking compact Light/Dark
      locked/unlocked/unknown shell/core presentation.
- [ ] `node demo/smoke_opening_entity_search.mjs` checks the real opening
      dialog: contact and lock search by friendly name/entity ID, preserved
      contact priority, visible IDs, persistent **none** option and unchanged
      `opening.contact`/`opening.lock` storage.
- [ ] Unit presentation coverage compares marker LQI colour with the shared
      continuous `lqiColor()` across former 40/41 and 179/180 boundaries; bands
      remain semantic metadata only.

## Text marker shell shape (#217)

- [ ] `node demo/smoke_device_icon_design.mjs` checks the external Text frame,
      not only its core: a long value keeps a saturating capsule radius at
      24/32/56/96/112 px, while Icon-only remains circular and Double remains a
      capsule. The runtime mutation to `border-radius: 50%` must be rejected.
- [ ] `device-text-shell-long-light` and `device-text-shell-long-dark` isolate a
      large `498 ppm` Text marker. Golden review must visibly confirm straight
      upper/lower middle sections rather than an ellipse.
- [ ] `node demo/capture_device_icon_reference.mjs` includes an additional
      96 px Text row beside the normative Light/Dark `Text Default.svg`.

## Device lock and orange foreground palette (#219)

- [ ] Closed/`locked` is green `#66D17A`; open/`unlocked` is red `#F0410C`.
      The same core/stroke palette is used by ordinary lock markers and compact
      door/gate lock badges; glyph shape remains closed/open/question.
- [ ] Every device glyph on an orange core (`on`/working and physical `open`)
      is white in Light and `#252525` in Dark. `device-icon-state-table-light`
      and `device-icon-state-table-dark` show `on` and `open` together, plus
      both lock states [unit: device-marker-polish-contract; auto:
      smoke_device_icon_design; golden: device-icon-state-table-*].
- [ ] Alarm, hover, focus, selected, unavailable, virtual, press feedback,
      pulse, hit-area and lock actions retain their existing priority and
      behaviour [unit: device presentation/polish/pointer; visual source review].

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
- [ ] Touch tooltips: touch/pen immediately clears hover even if the browser
      claims hover support; compatibility mouse is ignored, while a later real
      paired-mouse event restores desktop hover without reload
      [auto: smoke_feedback_v2]

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
      the area to the inner contour. The wash/halo use plain SVG without CSS
      filters, and hovering never replaces or flashes the Glow pool/gradient
      DOM. Editors do neither [auto: smoke_ux_fixes + smoke_glow; manual visual]

## Локальный набор перед пушем (#343)

Красный CI — дорогой способ узнать о проблеме: пять минут ожидания, а при
код-ревью ещё и лишний раунд. Прецедент назван в задаче: находка r2-H1 в #329
стоила целого раунда и ловилась локальным `npm test`.

```bash
node scripts/pre-push-gate.mjs                       # origin/dev..HEAD
node scripts/pre-push-gate.mjs --base origin/dev --head HEAD
node scripts/pre-push-gate.mjs --no-smokes --no-mutants
node scripts/pre-push-gate.mjs --max-smokes=3 --max-mutants=1
```

Что прогоняется: `npx tsc --noEmit`, `npm test`, смоки, выбранные
`scripts/smoke-select.mjs` по диффу, и мутанты, выбранные
`scripts/mutation-gate.mjs --changed` по тем же файлам. Замер на реальном
диапазоне (`953f675~1..953f675`, правка `src/houseplan-card.ts`): типы 5 с,
юниты 17–19 с, два смока 22 с — **46 секунд** на всё.

Три свойства, без которых такой набор бесполезен:

- **не останавливается на первом упавшем** — иначе автор узнаёт о втором
  нарушении следующим кругом, то есть ровно то, от чего набор защищает;
- **громко перечисляет, чего не проверял** — молчаливый пропуск дважды стоил
  проекту дня (#171, #207), а «Verified» без названной команды и её результата
  доказательством не является;
- **не претендует на полноту.** Golden, полная матрица смоков, HA-харнесс и весь
  мутационный реестр — предрелизный гейт, а не этот набор.

Бандл не собирается: `bundle-sync.mjs` раскладывает закоммиченный `dist`, а
свежесть проверяет сам продукт — `assertFreshDemoBundle` внутри каждого смока
сверяет вшитый отпечаток с исходниками дерева и скажет, если нужна пересборка.

Лимиты по умолчанию — шесть смоков и два мутанта. Мутант дорог: каждый
пересобирает бандл, а правка `src/houseplan-card.ts` задевает их 62. Превышение
лимита не проглатывается — набор печатает точную команду для полного прогона.

Три вида ответа `smoke-select` различаются и здесь: дифф без исполняемого кода —
«смоки не требуются»; прямое совпадение или зарегистрированная связь —
прогоняется; **связь не доказана** — отдельная громкая строка, потому что это не
«проверять нечего»: молчание стоило #234 бета-блокирующего регресса.

### Как включить в хук

Набор намеренно не включён в `.githooks/pre-push` по умолчанию: 20–45 секунд на
каждый пуш, включая пуши одной строки документации, — цена, которую стоит платить
осознанно. Включается переменной окружения:

```bash
export HP_PREPUSH_GATE=1     # в профиль оболочки
git push                     # хук прогонит набор перед процессным гейтом
```

Обойти, как и процессный гейт, можно через `git push --no-verify` — и тогда то же
самое найдёт Validate, уже после того как код окажется в `dev`.

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
- [ ] RU, EN and DE profile locales (+ `language:` card option forcing each);
      `de-DE`, `de-AT` and `de-CH` resolve to German, while an unknown locale
      falls back to English [unit: i18n, i18n-runtime]
- [ ] German cold start requests exactly one locale chunk, shows only a neutral
      busy frame before commit and never flashes English; a second card reuses
      the page cache. EN/RU request no locale chunk [auto: German locale smoke]
- [ ] German locale download failure retries the content-hashed asset once and
      then unblocks the card in English with one warning [unit: i18n-runtime;
      auto: German locale smoke fault injection]
- [ ] German View and a representative settings/device dialog fit at desktop
      and 390 px without horizontal overflow or clipped actions [golden: German
      desktop/mobile scenarios]

## Installation / upgrade / removal

- [ ] Fresh install from the HACS default catalog (plain search) → integration appears, card auto-registers as a Lovelace resource (`?v=` matches manifest); no manual resource setup
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
- [ ] Every completed segment is crash-safe in `room_drafts`. Changing tool,
      editor or floor finishes an open chain as ordinary partitions in one
      history/config transaction; the finished chain is not resumed as a draft
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
- [ ] Tap action cleanup + right click (v1.38.1, #94): the per-device action
      list has four options (Device card / HA more-info / Toggle state / Run),
      no separate cover or "card default" option — the card editor's global
      tap option is gone and ignored;
      Device card opens locally for compound curtains/covers even during a
      transient registry revalidation and calls no HA service (#96)
      [auto: smoke_cover_not_primary];
      right click on an icon in VIEW opens HA more-info (native menu kept in
      editors; virtual w/o entity → device card) [auto: smoke_tap_ctx]
- [ ] Binding section redesign (v1.38.0): two radios — Virtual / Pick from
      the HA list — with a "Show entities" checkbox (tooltip) next to the
      second; the dropdown (search inside) appears only in HA mode, opens
      itself when nothing is chosen, closes on pick; Save is blocked until a
      binding is chosen in HA mode; groups/helpers listed always, device
      entities only with the checkbox; editing pre-selects everything [auto: smoke_binding_ui]
- [ ] Canonical zero walls (#306): the Plan toolbar has no Boundary, Virtual
      wall or Physical wall tool. Walls and Thickness accept exact `0..100`;
      zero works for room atoms, drafts and partitions, while columns remain
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
      `cm:0` is treated identically, canonical v9 removes both legacy fields,
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
      target is on, and a virtual controller remains available. A separately
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
- [ ] No Reset button (v1.33.2): the Device editor toolbar has three tools —
      add, show all, icon rules; the layout-wiping Reset is gone [auto: smoke_editor_tabs]
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

The matrix covers thick wall junctions, the full #197 multi-room
virtual-junction resilience fixture in Plan and View (including the #261
measured exterior-wedge fill probe), the #249 three-ray
unequal-thickness fixture with a semantic filled-node/empty-old-wedge gate,
the two #275 orthogonal-strip fixtures at `cell_cm: 5/1` with dense
`isPointInFill()` containment before raster comparison,
virtual/physical boundaries,
partitions/columns, axis-aligned and 45° door/window/gate tunnels, hidden
opening symbols, Glow and sun, live/manual Glow overlap and light through a doorway,
light/temperature/LQI fill splits on a wall axis, hover over Glow and nested rooms, all three editors, dark/light themes,
0.4×/fit/2.5×, warm remount and adaptive RU/EN dialogs including focus and the
decor colour popover. The two device-dialog scenes deliberately bind a real
light, select Always plus fixed colour/brightness, and scroll the complete
role/colour/brightness/radius block into the captured viewport; a screenshot
that contains only its heading is a scenario error, not an acceptable baseline. In the
canonical Linux CI profile Chromium, viewport, DPR, locale, timezone, colour
profile, font rendering, animations and caret are deterministic. The separate
CI job captures review candidates until the first baseline is accepted; after
that it automatically runs blocking verification. Review and accept the
`golden-images` CI artifact rather than treating a developer OS raster as the
canonical set. See `demo/golden/README.md`.

For #249, `test/wall-thickness.test.mjs` additionally covers equal and unequal
three-/four-ray nodes (including literal 15/50/70 cm arms), reversed input,
winding/order changes, production `coordScale = 1000`, unchanged two-ray joins
and the anonymised regression fixture in
`test/fixtures/249-multiwall-junction.json`. The asymmetric corner-Split case
also proves that the union of clean-room floors equals the original room union
minus canonical bounded masonry and that every floor vertex remains inside the
source building.
`demo/smoke_multiwall_junction.mjs` checks Plan/View/kiosk/Static/hidden-Iso
parity, paper and clean-floor presence, shared Glow/sun masonry, cache reuse on
HA/theme ticks, no saved-config mutation, a filled node and the removed old
spike. Full golden/smoke/performance remain pre-beta gates.

For #272 the same fixture and table-driven equal/mixed T/X fans inventory every
polygon hole fully enclosed in the local degree-3+ node window. The matrix runs
at `cell_cm: 5` and `cell_cm: 1`, reversed/permuted input and production scale;
`roomGeom`, final masonry and paper must all report zero local holes while the
existing discarded-wedge probe remains empty. The browser smoke repeats a
local flood-fill with real `SVGGeometryElement.isPointInFill()` in Plan, View,
kiosk and Static, and inspects hidden-Iso and light/sun source rings. The golden
scenario declares `enclosedHoles: 0`, so semantic failure happens before the
whole-frame pixel threshold. Mutation `multi-wall-exterior-corridor-disabled`
restores point-only contact and must be caught by the hole inventory even while
the legacy single-point probes remain green.

For #275, `test/fixtures/275-orthogonal-strip-containment.json` contains only
the minimized coordinates and wall depths needed from both owner backups. The
unit oracle classifies perpendicular ray pairs independently, differences their
finite strip union against `roomGeom`/paper, covers adjacent overlapping repair
masks and keeps the non-orthogonal #249 discarded wedge empty. The production-
bundle smoke densely samples the same strips through Plan, View, kiosk, Static,
hidden Iso and light barriers. Golden scenes
`orthogonal-strip-cell-5-view-dark` and
`orthogonal-strip-cell-1-view-dark` repeat that semantic containment before
pixel comparison; `enclosedHoles: 0` remains a separate #272 assertion and can
no longer approve an exterior-connected notch. For private full-plan evidence,
`scripts/wall-strip-containment.mjs <backup...>` checks raw, Optimize preview,
applied canonical storage and JSON reload without printing or committing plan
contents. Mutation `multi-wall-orthogonal-strip-protection-disabled` restores
the release escape and must be killed by the containment tests.

For #288, the node-map unit fixes the real topology class: `349 / 120 / 5`
steps, a 30 cm short ray and a perpendicular 20 cm shared wall beginning at its
far endpoint. It runs at scales corresponding to `cell_cm: 1/5/30`, reversed
endpoints and input permutations, while an outer continuation remains under
the established #271 contract. `demo/smoke_real_plan_masonry.mjs` loads both
tracked real-plan fixtures through the production bundle and densely samples
every undeclared room edge with `SVGGeometryElement.isPointInFill()`. Both
plans require exact `gapCount: 0` and `totalGapSteps: 0`. Mutation
`multi-wall-shared-continuation-protection-disabled` removes the endpoint
handoff and must be killed by the unit before the real-plan smoke.

For #261, the anonymised #197 fixture also probes the real regression point
`(895.5, 556)`: `roomGeom`, final masonry and paper must fill it, while every
clean-floor contour must exclude it. The browser smoke repeats semantic point
coverage in Plan, View, kiosk, Static, hidden Iso and light/sun masonry; the two
existing #197 goldens require `SVGGeometryElement.isPointInFill()` at the same
point. Mutation `multi-wall-paper-full-origin-cut` restores the faulty
offset-origin cut and must make that regression test fail.

### Issue #73 baseline and implementation (2026-08-11)

The published v1.61.0-beta.6 exact SHA is the renderer baseline for #73: it
contains the accepted visibility-based light model and the matrix-v7 published
baseline; local review fixes prepare matrix-v8 with a semantic warm-pixel gate,
including `lighting-opaque-glow-two-doorways-dark`; canonical light behaviour
is `docs/LIGHT.md`. The owner explicitly started #73 on 2026-08-11.

`test/visual-continuity.test.mjs` covers tokens, quick/long return, delayed
overlay timing, paint barriers and fingerprints. `demo/smoke_visual_continuity.mjs`
samples presented frames and rejects hidden/empty plans, viewport rollback,
overlay over a stale frame, missing production attributes and unbounded or
sensitive trace data. It supplements rather than replaces warm-remount,
websocket-resilience and golden verification.

`npm run continuity:screencast` is the separate compositor-level gate required
before a stable release. It captures acknowledged PNG frames through CDP
`Page.startScreencast`, crops the real plan stage, rejects uniform/black frame
regressions and writes the exact frames plus metrics to
`artifacts/continuity-screencast`. Prereleases keep the faster mandatory rAF
smoke; the stable release workflow installs Chromium and runs the screencast
before attaching the public card asset.

## Large-house performance gate

`npm run benchmark:large-house` runs a deterministic fictional three-floor
fixture with 60 rooms, 200 devices, 100 openings, 60 partitions, 40 columns and
500 decor objects. It records model readiness, first stable render, space
switch, HA state update, shared-wall resize preview, pan/zoom, settings-dialog render, repeated navigation,
Long Tasks, warmed hot-cache growth and post-GC heap growth.

Every blocking `Validate` uses a candidate-only `performance_smoke`: one
warm-up and three measured samples of the heaviest 60-source Glow state. It
enforces absolute timing, Long Task, heap, cache and 200-device ceilings, but
does not claim to detect small relative regressions.

The dedicated `Full Performance` workflow builds the candidate and base SHA,
then captures seven measured samples for each sequentially on the same Node 22,
Playwright Chromium and hosted runner. It runs on `main`, weekly and by manual
dispatch. `demo/performance/compare.mjs` applies the tighter of the approved
absolute ceiling and baseline-relative allowance. Stable release assets need
an exact-SHA green full run; prereleases need the fast exact-SHA `Validate`
only. Raw reports and comparisons are uploaded as CI artifacts, and the check
tables are written to the job summary. Local measurements remain diagnostic.
See `demo/performance/README.md` for commands and the budget-review contract.

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

## Unified device status and pulse activity (#98)

- [ ] The Display list contains exactly Icon + state, Icon + state and activity,
      Value + state, Always static icon, in that order. Legacy
      `display: ripple` reads and saves back as `icon_ripple`
- [ ] Icon + dynamic plate shows state plate/morph but no ordinary activity
      effect; Icon + activity adds the semantic effect; Value keeps the
      state-coloured plate and hides ordinary activity; Always static icon
      keeps one neutral base icon and suppresses all state-driven visuals
- [ ] Motion/vibration/sound/contact rising edges render exactly three waves
      for about 3.3 s; initial load and recovery from unknown/unavailable do
      not fake an event; a rapid retrigger restarts it
- [ ] Occupancy/presence is one calm continuous pulse for the whole active state
- [ ] Cover/lock/valve movement continuously pulses until the travelling state ends;
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
- [ ] Open contact/open valve are orange; unlocked lock is red and locked lock
      is green; an open cover stays neutral because its icon morph carries that
      state
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
- [ ] With OS "reduce motion" enabled, ordinary activity becomes a compact
      solid dot; alarm keeps the red plate and accessible alarm description,
      without an animated or static ring

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
      corner, foreign room/island, partition/draft/column and every side-wall
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
      finger still lands on them without aiming. Room Resize deliberately has
      wall-midpoint handles only (its former corner frame is removed); robot-map
      calibration keeps its own frame [auto: smoke_hide_layers, smoke_backdrop,
      smoke_room_resize]
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

## Styling hooks and HA-formatted values (docs/STYLING-HOOKS.md, dev, unreleased)

- [ ] **The hooks are there and they are the config's ids**: open the plan's
      DOM (devtools → the card's shadow root) and check that a device marker
      carries `data-hp="device"`, `data-id`, `data-entity` and `data-area`; a
      room `data-hp="room"` + `data-id` + `data-area`; a door/window/gate
      `data-hp="opening"` + `data-kind`; a decor shape `data-hp="decor"` +
      `data-kind`; a visible room card `data-hp="room-label"`; a floor tab
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
      has `data-hp` on its rooms, visible room labels and markers (it draws no openings
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
      and restores the original through one Undo. Saved drafts and independent
      walls use the same classifier; unsafe candidates are counted as skipped
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
      partial/extra/unknown/draft/column/opening conflicts fail closed. Preview
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
      draft-count cap. A localized two-line title is fully contained by the HA
      header, and the three/four footer actions remain inside their padding:
      destructive actions left, Cancel/Save right or together on a second row
      when they do not fit [auto: smoke_free_walls; manual dialog labels].
- [ ] **Area and light**: overlapping bodies are subtracted once from clean
      area; closed partition rings keep the enclosed floor; bodies outside all
      rooms create no paper. Glow does not cross a long nearby partition and a
      source inside masonry lights nothing. Window rays are blocked by the same
      bodies. `show_borders: false` changes paint only [auto:
      physical-geometry.test; manual visual].
- [ ] **Seamless junctions**: saved draft/partition L corners (right, acute and
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

## Contextual help (issue #68, v1.62)

- [ ] A setting with complete RU/EN help body and ARIA copy shows one 32 px
      desktop / 40 px coarse-pointer button with the outlined circled-question
      icon. Mouse hover, keyboard focus and tap open the same text surface
      [auto: `smoke_help_affordance`].
- [ ] Empty or whitespace-only help body produces no trigger. A non-empty body
      without a complete ARIA label also produces no trigger; neither case adds
      a tab stop or reserves visible space [auto: `smoke_help_affordance`].
- [ ] Escape, outside pointer, owning-dialog scroll, toast and a competing colour
      picker close help in the documented order. The Popover and portal fallback
      paths stay inside the visual viewport [auto: `smoke_help_affordance`].
- [ ] Opening help by hover, focus or tap changes neither `clientHeight`,
      `scrollHeight` nor `scrollTop` of the owning dialog body. The native
      Popover and forced portal fallback have the same no-layout-shift contract
      [auto: `smoke_help_affordance`].

## Lazy editor runtime and frontend asset tree (#337)

- [ ] A cold configured View reaches a complete interactive frame without any
      request for `houseplan-editor-runtime-*.js`. The first Plan/Devices/
      Background intent requests it once; later editor switches do not repeat
      the request [auto: `smoke_lazy_editor_chunk`].
- [ ] Two failed requests, or a runtime with a different build fingerprint,
      leave mode, camera and plan in View and show the localized refresh advice
      [auto: `editor-runtime-loader.test`, `smoke_lazy_editor_chunk`].
- [ ] An empty installation requests the dedicated onboarding chunk, displays
      the first-space dialog and still has no editor request. Saving a drawn
      first space requests the editor once and continues into Plan; async
      `getConfigElement()` still returns `houseplan-card-editor`
      [auto: `smoke_lazy_editor_chunk`].
- [ ] `bundle:budget` follows transitive static imports and keeps initial View
      at or below 256000 B gzip. Bundle sync, demo freshness, CI artifacts and
      release zip validation fail when any manifest-listed asset is missing or
      its SHA-256 differs [auto: `bundle-assets.test`, `bundle-freshness.test`,
      release-contract tests].

## Hiding layers: decor, openings, zero-thickness walls (docs/UX-MODES.md)

- [ ] **Room names have one literal off state (#203)**: disable «Показывать
      названия» in the live space dialog, save and reopen it. Full View, kiosk,
      hidden isometric and `houseplan-space-card` contain no
      `[data-hp="room-label"]` and no legacy `text.rlabel`. Plan temporarily
      shows the same draggable HTML card and gear; returning to View hides it.
      Cancel restores the previous setting, while re-enabling names restores
      the saved card position and area icon
      [auto: `smoke_hide_room_names`, `smoke_styling_hooks`].
- [ ] **Each renderer can fail independently**: restoring the old full-card SVG
      fallback, compact-card SVG fallback or hidden-isometric override makes
      the dedicated smoke red
      [mutation: `hidden-room-names-full-svg-fallback`,
      `hidden-room-names-compact-svg-fallback`,
      `hidden-room-names-iso-override`].
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
- [ ] **Zero walls follow the borders switch only in View**: set a wall to
      `0 cm`, then turn **«Всегда отображать границы комнат» OFF**. Its line
      disappears with the borders and returns when enabled. Plan, Devices and
      Background editors always show the line. Dashed/solid light behaviour is
      unchanged while hidden [auto: `smoke_hide_layers`, `smoke_zero_walls`].
- [ ] **Nothing is stored when nothing is hidden**: with both boxes unticked,
      the space's config carries no `hide_decor` / `hide_openings` at all, and
      a plan saved by an older card still opens here unchanged
      [auto: smoke_hide_layers, tests_backend test_hide_layer_settings]
