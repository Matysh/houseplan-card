# Спецификации задач P1 и P2

Актуально на 2026-08-09.

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

| Issue | ТЗ | Статус ТЗ |
|---|---|---|
| [#6](https://github.com/Matysh/houseplan-card/issues/6) Vacuum XCME path segments | [006-vacuum-xcme-path.md](006-vacuum-xcme-path.md) | в реализации |
| [#7](https://github.com/Matysh/houseplan-card/issues/7) Valetudo room outlines | [007-vacuum-valetudo-room-outlines.md](007-vacuum-valetudo-room-outlines.md) | в реализации |
| [#8](https://github.com/Matysh/houseplan-card/issues/8) Vacuum support docs and XCME hint | [008-vacuum-support-docs-xcme-hint.md](008-vacuum-support-docs-xcme-hint.md) | в реализации |
| [#27](https://github.com/Matysh/houseplan-card/issues/27) External vacuum source picker | [027-vacuum-external-source-picker.md](027-vacuum-external-source-picker.md) | в реализации |
| [#28](https://github.com/Matysh/houseplan-card/issues/28) Room View card | [028-room-view-card.md](028-room-view-card.md) | черновик решения |
| [#29](https://github.com/Matysh/houseplan-card/issues/29) Device inbox lifecycle | [029-device-inbox-lifecycle.md](029-device-inbox-lifecycle.md) | черновик решения |
| [#30](https://github.com/Matysh/houseplan-card/issues/30) Dialog information architecture | [030-dialog-information-architecture.md](030-dialog-information-architecture.md) | готово к ревью |
| [#31](https://github.com/Matysh/houseplan-card/issues/31) View accessibility | [031-view-accessibility.md](031-view-accessibility.md) | черновик: требуется a11y-проверка |
| [#32](https://github.com/Matysh/houseplan-card/issues/32) Unified danger confirmation | [032-unified-danger-confirmation.md](032-unified-danger-confirmation.md) | готово к реализации |
| [#33](https://github.com/Matysh/houseplan-card/issues/33) Config schema lifecycle | [033-config-schema-lifecycle.md](033-config-schema-lifecycle.md) | в реализации |
| [#34](https://github.com/Matysh/houseplan-card/issues/34) Frontend decomposition | [034-frontend-decomposition.md](034-frontend-decomposition.md) | в реализации |
| [#35](https://github.com/Matysh/houseplan-card/issues/35) Current UX documentation | [035-current-ux-docs.md](035-current-ux-docs.md) | готово к реализации |
| [#50](https://github.com/Matysh/houseplan-card/issues/50) Config export/import | [050-config-export-import.md](050-config-export-import.md) | готово к ревью |
| [#58](https://github.com/Matysh/houseplan-card/issues/58) Vacuum integration coverage — Stage 1 | [058-vacuum-stage1.md](058-vacuum-stage1.md) | в реализации |

## P2

| Issue | ТЗ | Статус ТЗ |
|---|---|---|
| [#10](https://github.com/Matysh/houseplan-card/issues/10) Roomba live position | [010-vacuum-roomba-live-position.md](010-vacuum-roomba-live-position.md) | черновик: требуется UX-решение |
| [#11](https://github.com/Matysh/houseplan-card/issues/11) Vacuum source health | [011-vacuum-source-health.md](011-vacuum-source-health.md) | в реализации |
| [#12](https://github.com/Matysh/houseplan-card/issues/12) Room cleaning highlight | [012-vacuum-room-cleaning-highlight.md](012-vacuum-room-cleaning-highlight.md) | готово к ревью |
| [#13](https://github.com/Matysh/houseplan-card/issues/13) Golden open context tray | [013-golden-open-context-tray.md](013-golden-open-context-tray.md) | реализовано |
| [#19](https://github.com/Matysh/houseplan-card/issues/19) Additive Glow blending | [019-glow-additive-blending.md](019-glow-additive-blending.md) | v1.61.0-beta.2 candidate; exact-SHA gate |
| [#20](https://github.com/Matysh/houseplan-card/issues/20) Glow through open doors | [020-glow-open-door-spill.md](020-glow-open-door-spill.md) | готово к реализации |
| [#21](https://github.com/Matysh/houseplan-card/issues/21) Safe color CSS variables | [021-color-css-injection.md](021-color-css-injection.md) | готово к реализации |
| [#36](https://github.com/Matysh/houseplan-card/issues/36) Room Glow override | [036-room-glow-override.md](036-room-glow-override.md) | черновик продуктового решения |
| [#37](https://github.com/Matysh/houseplan-card/issues/37) Room scale system | [037-room-scale-system.md](037-room-scale-system.md) | черновик migration semantics |
| [#38](https://github.com/Matysh/houseplan-card/issues/38) Icon rule builder | [038-icon-rule-builder.md](038-icon-rule-builder.md) | черновик data model |
| [#39](https://github.com/Matysh/houseplan-card/issues/39) Large backdrops | [039-large-backdrops.md](039-large-backdrops.md) | research-first |
| [#40](https://github.com/Matysh/houseplan-card/issues/40) Floors/Areas onboarding | [040-floor-area-onboarding.md](040-floor-area-onboarding.md) | черновик fallback-политики |
| [#41](https://github.com/Matysh/houseplan-card/issues/41) Keyboard object editing | [041-keyboard-object-editing.md](041-keyboard-object-editing.md) | prototype-first draft |
| [#42](https://github.com/Matysh/houseplan-card/issues/42) Backend engineering quality | [042-backend-engineering-quality.md](042-backend-engineering-quality.md) | готово к реализации |
| [#43](https://github.com/Matysh/houseplan-card/issues/43) Private support report | [043-private-support-report.md](043-private-support-report.md) | черновик privacy defaults |
| [#44](https://github.com/Matysh/houseplan-card/issues/44) Filtering/grouping policy | [044-filter-grouping-policy.md](044-filter-grouping-policy.md) | готово к product review |
| [#51](https://github.com/Matysh/houseplan-card/issues/51) Custom decor images | [051-custom-decor-images.md](051-custom-decor-images.md) | черновик: security dependencies |
| [#52](https://github.com/Matysh/houseplan-card/issues/52) Dimensions in View | [052-view-dimensions.md](052-view-dimensions.md) | готово к ревью |
| [#54](https://github.com/Matysh/houseplan-card/issues/54) Zigbee topology overlay | [054-zigbee-topology-overlay.md](054-zigbee-topology-overlay.md) | research + adapter contract |
| [#55](https://github.com/Matysh/houseplan-card/issues/55) Independent Glow overlay | [055-independent-glow-overlay.md](055-independent-glow-overlay.md) | v1.61.0-beta.2 candidate; exact-SHA gate |
| [#56](https://github.com/Matysh/houseplan-card/issues/56) Static room color | [056-static-room-color.md](056-static-room-color.md) | готово после security gate #21 |

## Правило актуализации

При изменении продуктового решения сначала обновляется соответствующее issue, затем ТЗ. Реализация не считается завершённой только по наличию кода: нужны выполненные acceptance criteria, предусмотренная ТЗ проверка и актуальный статус Project v2.
