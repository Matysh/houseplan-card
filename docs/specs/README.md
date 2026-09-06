# Спецификации задач

Актуально на 2026-09-06.

GitHub Issues и GitHub Projects (v2) остаются единственным каноническим backlog проекта. Этот каталог содержит развёрнутые ТЗ: каждое ТЗ ссылается на issue, а issue — на соответствующий файл. Статус, приоритет и факт завершения меняются только в GitHub.

Статусы ТЗ:

- **готово к реализации** — продуктовые решения зафиксированы, остаётся техническая работа;
- **черновик решения** — в ТЗ дана рекомендация, но перед реализацией требуется принять отмеченные продуктовые решения;
- **в реализации** — работа уже ведётся в рамках текущего этапа;
- **реализовано** — ТЗ сохранено как проверяемый acceptance contract.

## Обязательные release-артефакты номерного ТЗ

Если задача меняет пользовательское поведение, её ТЗ обязано явно перечислить:

- записи в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- затронутую пользовательскую документацию;
- требуемые screenshots/golden и способ их review, если меняется визуал;
- release/performance/security artifacts, если они входят в acceptance gate.

Отсутствие этого раздела не означает, что документация необязательна. Для
чистого refactoring ТЗ должно прямо зафиксировать отсутствие пользовательских
изменений и перечислить технические доказательства безопасного поведения.

## P1

| Issue | ТЗ |
|---|---|
| [#471](https://github.com/Matysh/houseplan-card/issues/471) Убрать белые raised plates вокруг маркеров и названий комнат | [471-isometric-overlay-white-plates.md](471-isometric-overlay-white-plates.md) |
| [#6](https://github.com/Matysh/houseplan-card/issues/6) Vacuum XCME path segments | [006-vacuum-xcme-path.md](006-vacuum-xcme-path.md) |
| [#7](https://github.com/Matysh/houseplan-card/issues/7) Valetudo room outlines | [007-vacuum-valetudo-room-outlines.md](007-vacuum-valetudo-room-outlines.md) |
| [#8](https://github.com/Matysh/houseplan-card/issues/8) Vacuum support docs and XCME hint | [008-vacuum-support-docs-xcme-hint.md](008-vacuum-support-docs-xcme-hint.md) |
| [#27](https://github.com/Matysh/houseplan-card/issues/27) External vacuum source picker | [027-vacuum-external-source-picker.md](027-vacuum-external-source-picker.md) |
| [#28](https://github.com/Matysh/houseplan-card/issues/28) Room View card | [028-room-view-card.md](028-room-view-card.md) |
| [#29](https://github.com/Matysh/houseplan-card/issues/29) Device inbox lifecycle | [029-device-inbox-lifecycle.md](029-device-inbox-lifecycle.md) |
| [#30](https://github.com/Matysh/houseplan-card/issues/30) Dialog information architecture | [030-dialog-information-architecture.md](030-dialog-information-architecture.md) |
| [#31](https://github.com/Matysh/houseplan-card/issues/31) View accessibility | [031-view-accessibility.md](031-view-accessibility.md) |
| [#32](https://github.com/Matysh/houseplan-card/issues/32) Unified danger confirmation | [032-unified-danger-confirmation.md](032-unified-danger-confirmation.md) |
| [#33](https://github.com/Matysh/houseplan-card/issues/33) Config schema lifecycle | [033-config-schema-lifecycle.md](033-config-schema-lifecycle.md) |
| [#34](https://github.com/Matysh/houseplan-card/issues/34) Frontend decomposition | [034-frontend-decomposition.md](034-frontend-decomposition.md) |
| [#35](https://github.com/Matysh/houseplan-card/issues/35) Current UX documentation | [035-current-ux-docs.md](035-current-ux-docs.md) |
| [#50](https://github.com/Matysh/houseplan-card/issues/50) Экспорт и импорт конфигурации | [050-config-export-import.md](050-config-export-import.md) |
| [#58](https://github.com/Matysh/houseplan-card/issues/58) Vacuum integration coverage — Stage 1 | [058-vacuum-stage1.md](058-vacuum-stage1.md) |
| [#89](https://github.com/Matysh/houseplan-card/issues/89) Опциональный объёмный 2.5D/изометрический вид | [089-isometric-view.md](089-isometric-view.md) |
| [#89](https://github.com/Matysh/houseplan-card/issues/89) Этап 1: объёмный вид за флагом Labs | [089-isometric-view-stage1.md](089-isometric-view-stage1.md) |
| [#98](https://github.com/Matysh/houseplan-card/issues/98) Единая система пульсаций и активностей устройства | [098-device-pulse-system.md](098-device-pulse-system.md) |
| [#126](https://github.com/Matysh/houseplan-card/issues/126) HA Area переносит marker в новую комнату | [126-ha-area-marker-relocation.md](126-ha-area-marker-relocation.md) |
| [#131](https://github.com/Matysh/houseplan-card/issues/131) Полный первый кадр View у read-only-пользователя | [131-readonly-cold-start.md](131-readonly-cold-start.md) |
| [#138](https://github.com/Matysh/houseplan-card/issues/138) Автозамыкание комнаты по существующей стене | [138-adjacent-room-autoclose.md](138-adjacent-room-autoclose.md) |
| [#146](https://github.com/Matysh/houseplan-card/issues/146) Четырёхфазный фон «Следует за Солнцем» | [146-four-phase-sun-background.md](146-four-phase-sun-background.md) |
| [#156](https://github.com/Matysh/houseplan-card/issues/156) Регрессии Full Performance перед v1.64.0 stable | [156-full-performance-regressions.md](156-full-performance-regressions.md) |
| [#162](https://github.com/Matysh/houseplan-card/issues/162) Многоэтажный робот: карты отдельно от пространства базы | [162-vacuum-map-space-routing.md](162-vacuum-map-space-routing.md) |
| [#164](https://github.com/Matysh/houseplan-card/issues/164) Активный цикл стиральной машины должен быть жёлтым | [164-washer-active-cycle.md](164-washer-active-cycle.md) |
| [#166](https://github.com/Matysh/houseplan-card/issues/166) Солнечные лучи зеркально учитывают направление севера | [166-sun-north-rotation.md](166-sun-north-rotation.md) |
| [#167](https://github.com/Matysh/houseplan-card/issues/167) Экспорт «только планировка» | [167-plan-only-export.md](167-plan-only-export.md) |
| [#170](https://github.com/Matysh/houseplan-card/issues/170) HA-устройство не привязывается к комнате без HA-зоны | [170-room-without-area.md](170-room-without-area.md) |
| [#179](https://github.com/Matysh/houseplan-card/issues/179) Новый визуальный язык маркеров устройств | [179-device-icons-redesign.md](179-device-icons-redesign.md) |
| [#199](https://github.com/Matysh/houseplan-card/issues/199) Geometry preflight перед записью Optimize | [199-optimize-geometry-preflight.md](199-optimize-geometry-preflight.md) |
| [#210](https://github.com/Matysh/houseplan-card/issues/210) Фиксированное пространство экземпляра карточки | [210-fixed-floor-card.md](210-fixed-floor-card.md) |
| [#211](https://github.com/Matysh/houseplan-card/issues/211) Визуальное соответствие маркеров дизайн-пакету #179 | [211-device-icons-visual-parity.md](211-device-icons-visual-parity.md) |
| [#217](https://github.com/Matysh/houseplan-card/issues/217) Внешняя рамка Text-маркера должна быть капсулой | [217-text-shell-outline.md](217-text-shell-outline.md) |
| [#218](https://github.com/Matysh/houseplan-card/issues/218) Floating-point шум комнаты не гасит Glow пространства | [218-glow-floor-geometry.md](218-glow-floor-geometry.md) |
| [#219](https://github.com/Matysh/houseplan-card/issues/219) Единая палитра замков и glyph на оранжевых подложках | [219-lock-orange-palette.md](219-lock-orange-palette.md) |
| [#205](https://github.com/Matysh/houseplan-card/issues/205) Продолжение следа после короткой остановки пылесоса | [205-vacuum-trail-resume-grace.md](205-vacuum-trail-resume-grace.md) |
| [#220](https://github.com/Matysh/houseplan-card/issues/220) Порядок пространств перетаскиванием вкладок | [220-space-tab-reorder.md](220-space-tab-reorder.md) |
| [#229](https://github.com/Matysh/houseplan-card/issues/229) Сращивание коллинеарных отрезков стен | [229-merge-collinear-partitions.md](229-merge-collinear-partitions.md) |
| [#226](https://github.com/Matysh/houseplan-card/issues/226) Entity-marker не дублируется родительским HA-устройством | [226-entity-parent-dedup.md](226-entity-parent-dedup.md) |
| [#223](https://github.com/Matysh/houseplan-card/issues/223) Optimize канонизирует координаты без floating-point шума | [223-optimize-coordinate-canonicalization.md](223-optimize-coordinate-canonicalization.md) |
| [#224](https://github.com/Matysh/houseplan-card/issues/224) Канонические координаты на каждой записи | [224-config-coordinate-canonicalization.md](224-config-coordinate-canonicalization.md) |
| [#228](https://github.com/Matysh/houseplan-card/issues/228) Надёжное рисование стен и операции с готовым контуром | [228-plan-drawing-problems.md](228-plan-drawing-problems.md) |
| [#239](https://github.com/Matysh/houseplan-card/issues/239) Масштаб сетки не меняет внешний вид плана; default 1 см/1 дюйм | [239-grid-scale-invariance.md](239-grid-scale-invariance.md) |
| [#231](https://github.com/Matysh/houseplan-card/issues/231) Декоративный слой виден поверх заливок комнат | [231-decor-layer-order.md](231-decor-layer-order.md) |
| [#243](https://github.com/Matysh/houseplan-card/issues/243) Рабочее перетаскивание вкладок и точный указатель вставки | [243-space-tab-drop-target.md](243-space-tab-drop-target.md) |
| [#276](https://github.com/Matysh/houseplan-card/issues/276) Совпадающая partition становится одной общей стеной | [276-coincident-partition-reconciliation.md](276-coincident-partition-reconciliation.md) |
| [#277](https://github.com/Matysh/houseplan-card/issues/277) Безопасный Resize без изменения топологии | [277-safe-resize.md](277-safe-resize.md) |
| [#278](https://github.com/Matysh/houseplan-card/issues/278) Локальный сбой extra-body union не гасит всю кладку | [278-wall-union-isolation.md](278-wall-union-isolation.md) |
| [#279](https://github.com/Matysh/houseplan-card/issues/279) Сплошной почти ортогональный T-стык | [279-near-orthogonal-junction.md](279-near-orthogonal-junction.md) |
| [#280](https://github.com/Matysh/houseplan-card/issues/280) Backend принимает доказанный Optimize rehost | [280-optimize-rehost-validation.md](280-optimize-rehost-validation.md) |
| [#281](https://github.com/Matysh/houseplan-card/issues/281) Честный Resize после outer-partition reconciliation | [281-resize-zero-range.md](281-resize-zero-range.md) |
| [#293](https://github.com/Matysh/houseplan-card/issues/293) Активная рукоятка Resize выполняет pointer-жест | [293-resize-pointer-noop.md](293-resize-pointer-noop.md) |
| [#296](https://github.com/Matysh/houseplan-card/issues/296) Optimize удаляет доказанно избыточные скрытые стены | [296-optimize-hidden-obstacles.md](296-optimize-hidden-obstacles.md) |
| [#298](https://github.com/Matysh/houseplan-card/issues/298) Resize сохраняет wall records на решётке и на carrier | [298-resize-wall-thickness-carrier.md](298-resize-wall-thickness-carrier.md) |
| [#299](https://github.com/Matysh/houseplan-card/issues/299) Записи толщины не пересекают границу роли стены | [299-mixed-role-wall-records.md](299-mixed-role-wall-records.md) |
| [#314](https://github.com/Matysh/houseplan-card/issues/314) Атомарная запись v8 drafts и независимой геометрии | [314-v8-draft-write-regression.md](314-v8-draft-write-regression.md) |
| [#306](https://github.com/Matysh/houseplan-card/issues/306) Нулевые стены вместо виртуальных границ | [306-zero-thickness-walls.md](306-zero-thickness-walls.md) |
| [#348](https://github.com/Matysh/houseplan-card/issues/348) Полная немецкая локализация | [348-german-localization.md](348-german-localization.md) |
| [#428](https://github.com/Matysh/houseplan-card/issues/428) Round-trip экспорта с отсутствующей картинкой декора | [428-missing-decor-asset-roundtrip.md](428-missing-decor-asset-roundtrip.md) |
| [#462](https://github.com/Matysh/houseplan-card/issues/462) Надёжная регистрация frontend-ресурса и восстановление после обновления | [462-card-resource-registration.md](462-card-resource-registration.md) |

## P2

| Issue | ТЗ |
|---|---|
| [#478](https://github.com/Matysh/houseplan-card/issues/478) Отказ от persisted-сущности `room_drafts` | [478-remove-room-drafts.md](478-remove-room-drafts.md) |
| [#10](https://github.com/Matysh/houseplan-card/issues/10) Roomba live position | [010-vacuum-roomba-live-position.md](010-vacuum-roomba-live-position.md) |
| [#442](https://github.com/Matysh/houseplan-card/issues/442) Атомарный откат отклонённых записей маркера | [442-marker-write-rollback.md](442-marker-write-rollback.md) |
| [#11](https://github.com/Matysh/houseplan-card/issues/11) Vacuum source health | [011-vacuum-source-health.md](011-vacuum-source-health.md) |
| [#12](https://github.com/Matysh/houseplan-card/issues/12) Room cleaning highlight | [012-vacuum-room-cleaning-highlight.md](012-vacuum-room-cleaning-highlight.md) |
| [#13](https://github.com/Matysh/houseplan-card/issues/13) Golden open context tray | [013-golden-open-context-tray.md](013-golden-open-context-tray.md) |
| [#19](https://github.com/Matysh/houseplan-card/issues/19) Additive Glow blending | [019-glow-additive-blending.md](019-glow-additive-blending.md) |
| [#20](https://github.com/Matysh/houseplan-card/issues/20) Glow through open doors | [020-glow-open-door-spill.md](020-glow-open-door-spill.md) |
| [#21](https://github.com/Matysh/houseplan-card/issues/21) Safe color CSS variables | [021-color-css-injection.md](021-color-css-injection.md) |
| [#36](https://github.com/Matysh/houseplan-card/issues/36) Room Glow override | [036-room-glow-override.md](036-room-glow-override.md) |
| [#37](https://github.com/Matysh/houseplan-card/issues/37) Room scale system | [037-room-scale-system.md](037-room-scale-system.md) |
| [#38](https://github.com/Matysh/houseplan-card/issues/38) Icon rule builder | [038-icon-rule-builder.md](038-icon-rule-builder.md) |
| [#39](https://github.com/Matysh/houseplan-card/issues/39) Large backdrops | [039-large-backdrops.md](039-large-backdrops.md) |
| [#40](https://github.com/Matysh/houseplan-card/issues/40) Floors/Areas onboarding | [040-floor-area-onboarding.md](040-floor-area-onboarding.md) |
| [#41](https://github.com/Matysh/houseplan-card/issues/41) Keyboard object editing | [041-keyboard-object-editing.md](041-keyboard-object-editing.md) |
| [#42](https://github.com/Matysh/houseplan-card/issues/42) Backend engineering quality | [042-backend-engineering-quality.md](042-backend-engineering-quality.md) |
| [#43](https://github.com/Matysh/houseplan-card/issues/43) Help/feedback and private support package | [043-private-support-report.md](043-private-support-report.md) |
| [#44](https://github.com/Matysh/houseplan-card/issues/44) Filtering/grouping policy | [044-filter-grouping-policy.md](044-filter-grouping-policy.md) |
| [#51](https://github.com/Matysh/houseplan-card/issues/51) Custom decor images | [051-custom-decor-images.md](051-custom-decor-images.md) |
| [#52](https://github.com/Matysh/houseplan-card/issues/52) Dimensions in View | [052-view-dimensions.md](052-view-dimensions.md) |
| [#54](https://github.com/Matysh/houseplan-card/issues/54) Zigbee topology overlay | [054-zigbee-topology-overlay.md](054-zigbee-topology-overlay.md) |
| [#55](https://github.com/Matysh/houseplan-card/issues/55) Independent Glow overlay | [055-independent-glow-overlay.md](055-independent-glow-overlay.md) |
| [#56](https://github.com/Matysh/houseplan-card/issues/56) Static room color | [056-static-room-color.md](056-static-room-color.md) |
| [#68](https://github.com/Matysh/houseplan-card/issues/68) Подсказки к настройкам | [068-help-affordance.md](068-help-affordance.md) |
| [#74](https://github.com/Matysh/houseplan-card/issues/74) Position-only Undo/Redo устройств | [074-device-position-undo.md](074-device-position-undo.md) |
| [#75](https://github.com/Matysh/houseplan-card/issues/75) + [#76](https://github.com/Matysh/houseplan-card/issues/76) Единый поток размещения проёмов | [075-076-opening-placement-flow.md](075-076-opening-placement-flow.md) |
| [#82](https://github.com/Matysh/houseplan-card/issues/82) Плавное масштабирование zoom/fit/reset | [082-smooth-zoom.md](082-smooth-zoom.md) |
| [#84](https://github.com/Matysh/houseplan-card/issues/84) Источник «Всегда» без сущности HA + [#88](https://github.com/Matysh/houseplan-card/issues/88) ведущая сущность | [084-passive-forced-light-sources.md](084-passive-forced-light-sources.md) |
| [#86](https://github.com/Matysh/houseplan-card/issues/86) Подсказки к настройкам, партия 1 | [086-settings-help-content-party1.md](086-settings-help-content-party1.md) |
| [#90](https://github.com/Matysh/houseplan-card/issues/90) Управляемый бейдж со значением | [090-device-value-badge.md](090-device-value-badge.md) |
| [#378](https://github.com/Matysh/houseplan-card/issues/378) Выбираемый источник для режима «Значение + состояние» | [378-value-face-source.md](378-value-face-source.md) |
| [#381](https://github.com/Matysh/houseplan-card/issues/381) Действие по нажатию «Ничего не делать» | [381-no-op-tap-action.md](381-no-op-tap-action.md) |
| [#383](https://github.com/Matysh/houseplan-card/issues/383) Плавные трансформации и зеркалирование мебели | [383-furniture-transform.md](383-furniture-transform.md) |
| [#94](https://github.com/Matysh/houseplan-card/issues/94) Универсальное действие «Переключить состояние» | [094-universal-state-toggle.md](094-universal-state-toggle.md) |
| [#101](https://github.com/Matysh/houseplan-card/issues/101) Плавный переход View ↔ редакторы | [101-view-editor-transition.md](101-view-editor-transition.md) |
| [#107](https://github.com/Matysh/houseplan-card/issues/107) Переключение виртуального источника света «Всегда» | [107-virtual-light-toggle.md](107-virtual-light-toggle.md) |
| [#113](https://github.com/Matysh/houseplan-card/issues/113) Optional-контракт SpaceModel | [113-optional-space-model.md](113-optional-space-model.md) |
| [#117](https://github.com/Matysh/houseplan-card/issues/117) Registry-less entity у проёма | [117-registryless-opening-entity.md](117-registryless-opening-entity.md) |
| [#122](https://github.com/Matysh/houseplan-card/issues/122) Изометрический режим Stage 2: скрытый режим и визуальная полировка | [122-isometric-stage2.md](122-isometric-stage2.md) |
| [#123](https://github.com/Matysh/houseplan-card/issues/123) Split из вершины не меняет наружную геометрию стен | [123-corner-split-wall.md](123-corner-split-wall.md) |
| [#132](https://github.com/Matysh/houseplan-card/issues/132) Проёмы в независимых стенах (+ bug [#185](https://github.com/Matysh/houseplan-card/issues/185)) | [132-partition-openings.md](132-partition-openings.md) |
| [#137](https://github.com/Matysh/houseplan-card/issues/137) Узлы и линии привязки в редакторе Плана | [137-plan-snap-overlay.md](137-plan-snap-overlay.md) |
| [#141](https://github.com/Matysh/houseplan-card/issues/141) Бесшовные стыки перегородок и открытых контуров | [141-wall-junctions.md](141-wall-junctions.md) |
| [#159](https://github.com/Matysh/houseplan-card/issues/159) Новый набор мебели и двухуровневая библиотека | [159-furniture-pack.md](159-furniture-pack.md) |
| [#160](https://github.com/Matysh/houseplan-card/issues/160) Изометрический режим Stage 3: глубина сцены, материалы и пространственные overlays | [160-isometric-stage3.md](160-isometric-stage3.md) |
| [#361](https://github.com/Matysh/houseplan-card/issues/361) Физическая толщина линий мебели при camera zoom | [361-furniture-stroke-zoom.md](361-furniture-stroke-zoom.md) |
| [#157](https://github.com/Matysh/houseplan-card/issues/157) Тип проёма «Открытый проём» | [157-open-passage.md](157-open-passage.md) |
| [#150](https://github.com/Matysh/houseplan-card/issues/150) Точная геометрия коллинеарного перепада толщины | [150-wall-thickness-transition.md](150-wall-thickness-transition.md) |
| [#152](https://github.com/Matysh/houseplan-card/issues/152) Click/tap по комнате вписывает её в View | [152-room-click-fit.md](152-room-click-fit.md) |
| [#172](https://github.com/Matysh/houseplan-card/issues/172) Нулевой Split-разделитель не получает ложную толщину | [172-zero-divider-taper.md](172-zero-divider-taper.md) |
| [#173](https://github.com/Matysh/houseplan-card/issues/173) Единый инструмент рисования стен и предложение комнаты по замыканию | [173-unified-wall-tool.md](173-unified-wall-tool.md) |
| [#174](https://github.com/Matysh/houseplan-card/issues/174) Связанный виртуальный источник следует реальному контроллеру | [174-linked-virtual-light-controller.md](174-linked-virtual-light-controller.md) |
| [#178](https://github.com/Matysh/houseplan-card/issues/178) Выбор сущности для действия «Переключить состояние» | [178-toggle-entity.md](178-toggle-entity.md) |
| [#197](https://github.com/Matysh/houseplan-card/issues/197) Один junction-патч не гасит кладку всего плана | [197-junction-patch-fail-dark.md](197-junction-patch-fail-dark.md) |
| [#204](https://github.com/Matysh/houseplan-card/issues/204) Честные defaults границ и имён при создании пространства | [204-space-create-display-defaults.md](204-space-create-display-defaults.md) |
| [#201](https://github.com/Matysh/houseplan-card/issues/201) Наследование толщины для атомарного участка стены | [201-atomic-thickness-lookup.md](201-atomic-thickness-lookup.md) |
| [#203](https://github.com/Matysh/houseplan-card/issues/203) Выключение названий скрывает все подписи комнат | [203-hide-room-names.md](203-hide-room-names.md) |
| [#186](https://github.com/Matysh/houseplan-card/issues/186) Безопасный остаток стены у торцов партиционного проёма | [186-partition-opening-jamb-margin.md](186-partition-opening-jamb-margin.md) |
| [#234](https://github.com/Matysh/houseplan-card/issues/234) Толщина отрезка цепочки не расходится между превью и записью | [234-chain-segment-thickness.md](234-chain-segment-thickness.md) |
| [#233](https://github.com/Matysh/houseplan-card/issues/233) Ресайз показывает внутренние размеры, а не осевые | [233-resize-inner-dimensions.md](233-resize-inner-dimensions.md) |
| [#300](https://github.com/Matysh/houseplan-card/issues/300) Понятные подписи и измеряемые стены во время Resize | [300-resize-measurement-layout.md](300-resize-measurement-layout.md) |
| [#238](https://github.com/Matysh/houseplan-card/issues/238) Размеры проёма до внутренних физических границ | [238-opening-inner-distances.md](238-opening-inner-distances.md) |
| [#242](https://github.com/Matysh/houseplan-card/issues/242) Символ проёма по центру толщины стены | [242-opening-symbol-center.md](242-opening-symbol-center.md) |
| [#244](https://github.com/Matysh/houseplan-card/issues/244) Восстановление маркеров с мёртвой ссылкой на пространство | [244-orphan-space-references.md](244-orphan-space-references.md) |
| [#248](https://github.com/Matysh/houseplan-card/issues/248) Идемпотентный Optimize после записи и reload | [248-optimize-idempotence.md](248-optimize-idempotence.md) |
| [#251](https://github.com/Matysh/houseplan-card/issues/251) Доступность контроллера не наследуется от управляемой цели | [251-controller-target-availability.md](251-controller-target-availability.md) |
| [#252](https://github.com/Matysh/houseplan-card/issues/252) Понятная и безопасная очистка забытых позиций в Optimize | [252-optimize-orphan-layout-report.md](252-optimize-orphan-layout-report.md) |
| [#253](https://github.com/Matysh/houseplan-card/issues/253) Resize не теряет интервалы толщины стен | [253-resize-wall-thickness.md](253-resize-wall-thickness.md) |
| [#258](https://github.com/Matysh/houseplan-card/issues/258) Канонический wall key после Optimize и storage round-trip | [258-wall-key-storage-roundtrip.md](258-wall-key-storage-roundtrip.md) |
| [#262](https://github.com/Matysh/houseplan-card/issues/262) Повторное добавление entity после удаления родительского устройства | [262-readd-child-entity-after-device-delete.md](262-readd-child-entity-after-device-delete.md) |
| [#265](https://github.com/Matysh/houseplan-card/issues/265) Единый контракт ссылочного шва импорта | [265-import-reference-seam.md](265-import-reference-seam.md) |
| [#267](https://github.com/Matysh/houseplan-card/issues/267) Таблица решений для «лица» маркера | [267-device-presentation-decision-table.md](267-device-presentation-decision-table.md) |
| [#274](https://github.com/Matysh/houseplan-card/issues/274) Беспроводной контроллер одинаково выглядит на плане и в preview | [274-wireless-controller-presentation-parity.md](274-wireless-controller-presentation-parity.md) |
| [#317](https://github.com/Matysh/houseplan-card/issues/317) Климат комнаты следует размещению датчика в House Plan | [317-room-climate-placement.md](317-room-climate-placement.md) |
| [#318](https://github.com/Matysh/houseplan-card/issues/318) Активный контроллер без собственных сущностей следует `controls` | [318-empty-controller-roster.md](318-empty-controller-roster.md) |
| [#373](https://github.com/Matysh/houseplan-card/issues/373) Плотное кадрирование static card по геометрии дома | [373-space-card-house-fit.md](373-space-card-house-fit.md) |
| [#294](https://github.com/Matysh/houseplan-card/issues/294) Esc завершает текущую цепочку стен без удаления геометрии | [294-wall-esc-detach.md](294-wall-esc-detach.md) |
| [#419](https://github.com/Matysh/houseplan-card/issues/419) Безопасная уборка Area-снапшота при пустом или усечённом HA-реестре | [419-area-snapshot-roster-guard.md](419-area-snapshot-roster-guard.md) |
| [#421](https://github.com/Matysh/houseplan-card/issues/421) Отрицательные доказательства для трёх защитных проверок | [421-negative-test-proofs.md](421-negative-test-proofs.md) |
| [#426](https://github.com/Matysh/houseplan-card/issues/426) Отключение информационного окна комнаты при наведении | [426-room-hover-tooltip-toggle.md](426-room-hover-tooltip-toggle.md) |
| [#431](https://github.com/Matysh/houseplan-card/issues/431) Канонизация координат пользовательских изображений | [431-image-coordinate-canonicalization.md](431-image-coordinate-canonicalization.md) |
| [#432](https://github.com/Matysh/houseplan-card/issues/432) Ограниченный resolve и единая проверка целостности изображений | [432-asset-resolve-authorization-cache.md](432-asset-resolve-authorization-cache.md) |
| [#454](https://github.com/Matysh/houseplan-card/issues/454) Счёт заходов и циклов ревью по артефактам | [454-review-round-counter.md](454-review-round-counter.md) |
| [#440](https://github.com/Matysh/houseplan-card/issues/440) Полиш аудита v1.71.0-beta.2 | [440-v171-beta2-polish.md](440-v171-beta2-polish.md) |
| [#445](https://github.com/Matysh/houseplan-card/issues/445) Магнит мебели к физической поверхности стены | [445-furniture-wall-face-snap.md](445-furniture-wall-face-snap.md) |
| [#447](https://github.com/Matysh/houseplan-card/issues/447) Наружная грань для мебели и сдвиг декора стрелками | [447-exterior-furniture-snap-keyboard-nudge.md](447-exterior-furniture-snap-keyboard-nudge.md) |
| [#448](https://github.com/Matysh/houseplan-card/issues/448) Единый бессрочный переключатель `hp_alpha` | [448-alpha-switch.md](448-alpha-switch.md) |
| [#449](https://github.com/Matysh/houseplan-card/issues/449) Двойной клик/тап по свободному фону вписывает весь план | [449-double-fit-all.md](449-double-fit-all.md) |
| [#451](https://github.com/Matysh/houseplan-card/issues/451) Фильтрация render и лёгкий live-слой взаимодействий | [451-render-performance.md](451-render-performance.md) |
| [#456](https://github.com/Matysh/houseplan-card/issues/456) Копирование пространства без комнат и устройств | [456-copy-space.md](456-copy-space.md) |
| [#457](https://github.com/Matysh/houseplan-card/issues/457) Направление Zigbee-связей к координатору | [457-zigbee-route-arrows.md](457-zigbee-route-arrows.md) |
| [#460](https://github.com/Matysh/houseplan-card/issues/460) Детерминированное завершение кадра живого редактора | [460-live-editor-settlement.md](460-live-editor-settlement.md) |
| [#461](https://github.com/Matysh/houseplan-card/issues/461) Быстрый commit промежуточной точки цепочки стен | [461-wall-draw-click-performance.md](461-wall-draw-click-performance.md) |
| [#464](https://github.com/Matysh/houseplan-card/issues/464) Верхний контекстный слой Zigbee-топологии | [464-zigbee-topology-layer-order.md](464-zigbee-topology-layer-order.md) |
| [#473](https://github.com/Matysh/houseplan-card/issues/473) Свидетели перф-дельты #160 и диффозависимый перф-смок | [473-iso-perf-witnesses-and-smoke.md](473-iso-perf-witnesses-and-smoke.md) |
| [#476](https://github.com/Matysh/houseplan-card/issues/476) Явное завершение выбора цвета кнопкой «ОК» | [476-color-picker-ok.md](476-color-picker-ok.md) |
| [#474](https://github.com/Matysh/houseplan-card/issues/474) Стартовый граф: арт мебели уходит в ленивый чанк | [474-lazy-furniture-art.md](474-lazy-furniture-art.md) |

## P3

| Issue | ТЗ |
|---|---|
| [#209](https://github.com/Matysh/houseplan-card/issues/209) Плавный след пылесоса | [209-vacuum-trail-smoothing.md](209-vacuum-trail-smoothing.md) |
| [#198](https://github.com/Matysh/houseplan-card/issues/198) Optimize очищает изолированный микро-интервал толщины | [198-optimize-micro-interval.md](198-optimize-micro-interval.md) |
| [#103](https://github.com/Matysh/houseplan-card/issues/103) Состояния в Toggle confirmation | [103-toggle-confirmation-state.md](103-toggle-confirmation-state.md) |
| [#200](https://github.com/Matysh/houseplan-card/issues/200) Одинаковая геометрия подписи комнаты в View и Plan editor | [200-room-label-parity.md](200-room-label-parity.md) |
| [#340](https://github.com/Matysh/houseplan-card/issues/340) Обязательная ревизия повторной записи config/set | [340-config-set-revision.md](340-config-set-revision.md) |
| [#372](https://github.com/Matysh/houseplan-card/issues/372) Компактное верхнее кадрирование static card без заголовка | [372-space-card-empty-title.md](372-space-card-empty-title.md) |
| [#423](https://github.com/Matysh/houseplan-card/issues/423) Полиш support pipeline и защитных инструментов v1.70.0 | [423-v170-polish.md](423-v170-polish.md) |
| [#434](https://github.com/Matysh/houseplan-card/issues/434) Полиш аудита v1.71.0-beta.1 | [434-v171-polish-audit.md](434-v171-polish-audit.md) |
| [#443](https://github.com/Matysh/houseplan-card/issues/443) Полиш маршрутов карт робота | [443-vacuum-route-polish.md](443-vacuum-route-polish.md) |

## P3

| Issue | ТЗ |
|---|---|
| [#57](https://github.com/Matysh/houseplan-card/issues/57) Единый выбор цвета и прозрачности | [057-color-opacity-picker.md](057-color-opacity-picker.md) |
| [#180](https://github.com/Matysh/houseplan-card/issues/180) Единый picker во всех местах выбора цвета | [180-all-color-call-sites.md](180-all-color-call-sites.md) |

## P3

| Issue | ТЗ |
|---|---|
| [#62](https://github.com/Matysh/houseplan-card/issues/62) Масштабируемая i18n-инфраструктура | [062-i18n-registry.md](062-i18n-registry.md) |

## Правило актуализации

При изменении продуктового решения сначала обновляется соответствующее issue, затем ТЗ. Реализация не считается завершённой только по наличию кода: нужны выполненные acceptance criteria, предусмотренная ТЗ проверка и актуальный статус Project v2.
