# Спецификации задач

Актуально на 2026-08-19.

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
| [#131](https://github.com/Matysh/houseplan-card/issues/131) Полный первый кадр View у read-only-пользователя | [131-readonly-cold-start.md](131-readonly-cold-start.md) |
| [#138](https://github.com/Matysh/houseplan-card/issues/138) Автозамыкание комнаты по существующей стене | [138-adjacent-room-autoclose.md](138-adjacent-room-autoclose.md) |
| [#146](https://github.com/Matysh/houseplan-card/issues/146) Четырёхфазный фон «Следует за Солнцем» | [146-four-phase-sun-background.md](146-four-phase-sun-background.md) |
| [#156](https://github.com/Matysh/houseplan-card/issues/156) Регрессии Full Performance перед v1.64.0 stable | [156-full-performance-regressions.md](156-full-performance-regressions.md) |
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

## P2

| Issue | ТЗ |
|---|---|
| [#10](https://github.com/Matysh/houseplan-card/issues/10) Roomba live position | [010-vacuum-roomba-live-position.md](010-vacuum-roomba-live-position.md) |
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
| [#43](https://github.com/Matysh/houseplan-card/issues/43) Private support report | [043-private-support-report.md](043-private-support-report.md) |
| [#44](https://github.com/Matysh/houseplan-card/issues/44) Filtering/grouping policy | [044-filter-grouping-policy.md](044-filter-grouping-policy.md) |
| [#51](https://github.com/Matysh/houseplan-card/issues/51) Custom decor images | [051-custom-decor-images.md](051-custom-decor-images.md) |
| [#52](https://github.com/Matysh/houseplan-card/issues/52) Dimensions in View | [052-view-dimensions.md](052-view-dimensions.md) |
| [#54](https://github.com/Matysh/houseplan-card/issues/54) Zigbee topology overlay | [054-zigbee-topology-overlay.md](054-zigbee-topology-overlay.md) |
| [#55](https://github.com/Matysh/houseplan-card/issues/55) Independent Glow overlay | [055-independent-glow-overlay.md](055-independent-glow-overlay.md) |
| [#56](https://github.com/Matysh/houseplan-card/issues/56) Static room color | [056-static-room-color.md](056-static-room-color.md) |
| [#68](https://github.com/Matysh/houseplan-card/issues/68) Подсказки к настройкам | [068-help-affordance.md](068-help-affordance.md) |
| [#75](https://github.com/Matysh/houseplan-card/issues/75) + [#76](https://github.com/Matysh/houseplan-card/issues/76) Единый поток размещения проёмов | [075-076-opening-placement-flow.md](075-076-opening-placement-flow.md) |
| [#84](https://github.com/Matysh/houseplan-card/issues/84) Источник «Всегда» без сущности HA + [#88](https://github.com/Matysh/houseplan-card/issues/88) ведущая сущность | [084-passive-forced-light-sources.md](084-passive-forced-light-sources.md) |
| [#90](https://github.com/Matysh/houseplan-card/issues/90) Управляемый бейдж со значением | [090-device-value-badge.md](090-device-value-badge.md) |
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
| [#157](https://github.com/Matysh/houseplan-card/issues/157) Тип проёма «Открытый проём» | [157-open-passage.md](157-open-passage.md) |
| [#150](https://github.com/Matysh/houseplan-card/issues/150) Точная геометрия коллинеарного перепада толщины | [150-wall-thickness-transition.md](150-wall-thickness-transition.md) |
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
| [#238](https://github.com/Matysh/houseplan-card/issues/238) Размеры проёма до внутренних физических границ | [238-opening-inner-distances.md](238-opening-inner-distances.md) |
| [#242](https://github.com/Matysh/houseplan-card/issues/242) Символ проёма по центру толщины стены | [242-opening-symbol-center.md](242-opening-symbol-center.md) |
| [#244](https://github.com/Matysh/houseplan-card/issues/244) Восстановление маркеров с мёртвой ссылкой на пространство | [244-orphan-space-references.md](244-orphan-space-references.md) |

## P3

| Issue | ТЗ |
|---|---|
| [#198](https://github.com/Matysh/houseplan-card/issues/198) Optimize очищает изолированный микро-интервал толщины | [198-optimize-micro-interval.md](198-optimize-micro-interval.md) |
| [#103](https://github.com/Matysh/houseplan-card/issues/103) Состояния в Toggle confirmation | [103-toggle-confirmation-state.md](103-toggle-confirmation-state.md) |
| [#200](https://github.com/Matysh/houseplan-card/issues/200) Одинаковая геометрия подписи комнаты в View и Plan editor | [200-room-label-parity.md](200-room-label-parity.md) |

## P3

| Issue | ТЗ |
|---|---|
| [#57](https://github.com/Matysh/houseplan-card/issues/57) Единый выбор цвета и прозрачности | [057-color-opacity-picker.md](057-color-opacity-picker.md) |
| [#180](https://github.com/Matysh/houseplan-card/issues/180) Единый picker во всех местах выбора цвета | [180-all-color-call-sites.md](180-all-color-call-sites.md) |

## Правило актуализации

При изменении продуктового решения сначала обновляется соответствующее issue, затем ТЗ. Реализация не считается завершённой только по наличию кода: нужны выполненные acceptance criteria, предусмотренная ТЗ проверка и актуальный статус Project v2.
