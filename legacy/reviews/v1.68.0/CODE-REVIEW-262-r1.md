# CODE-REVIEW-262-r1

- Issue: [#262](https://github.com/Matysh/houseplan-card/issues/262) — «Deleting entities prevents them from being added again later»
- Ветка: `issue/262-readd-child-entity`
- HEAD ревью: `5fa2dc289354f83b3e0e36126cd115fcfcc3b5ac` (совпадает с точным HEAD, указанным автором в хендоффе)
- Реализация: `8cdf6b489481badaf25817efcca6cff1079ef6d1` · `Issue: #262` · `User-Visible: yes`
- ТЗ: `docs/specs/262-readd-child-entity-after-device-delete.md`, ревью ТЗ зелёное (`docs/reviews/SPEC-REVIEW-262-r1.md`)
- Заход: **r1** · блокирующих циклов израсходовано **0/4**

## Скоуп

Точный tombstone-binding в picker и runtime-семантике блокировал повторное
добавление ОДНОЙ дочерней entity удалённого устройства, хотя само устройство
целиком возвращалось штатно. Правка вводит единственное исключение: живой
exact `entity:X` marker перекрывает parent `device:D` tombstone только для X,
не трогая siblings, device-level source и существующие контракты #161/#226/#104.

Продуктовый diff:

- `src/devices.ts` — `RemovedPlanBindings.liveEntities`, `isRemovedPlanEntity()`,
  `areaClimateMap()`;
- `src/houseplan-card.ts` — `_bindingCandidates()` (picker-исключение для детей
  tombstoned device за флагом «Показывать сущности»).

Плюс `test/devices.test.mjs` (+3 теста), `demo/smoke_binding_picker.mjs`
(known-defect-проверка перевёрнута и расширена до полного lifecycle),
`scripts/mutation-gate.mjs` (+4 мутанта), документация (`FILTERING.md`,
`ARCHITECTURE.md`, `TESTING.md`, `USER-GUIDE.md`/`.ru.md`, оба CHANGELOG),
пересъёмка одного скриншота и `screenshots.json`.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | green, без вывода |
| unit | `npm test` | 1162/1162 pass, 0 fail (0 skip здесь; у автора 1 skip — `process-gate.test.mjs` пропускает git/gh-зависимые кейсы в зависимости от окружения, не связано с диффом) |
| build + bundle parity | `npm run build && npm run bundle:sync` + `sha256sum` трёх копий | все три идентичны, `f88f5089…f65aff9d` — совпадает с SHA из хендоффа |
| docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | одна зарегистрированная связь: `demo/smoke_binding_picker.mjs` ← `isRemovedPlanEntity` |
| целевой browser smoke | `node demo/smoke_binding_picker.mjs` | 24/24 проверки true, `OK` |
| mutation guards (4 именованных) | `node scripts/mutation-gate.mjs --id=<каждый>` | все 4 — «тест покраснел, как обязан», поймано 1/1 каждый |
| process-gate (офлайн) | `node scripts/process-gate.mjs --base origin/dev --head HEAD` | «гейт пройден, предупреждений 0» |
| CI на точном SHA | `gh run view` | `Validate` на `5fa2dc2…` — `success`; `Docs screenshots` на `8cdf6b4…` — `success` (канонический Linux-артефакт, принятие скриншота обосновано) |

### Чего не проверял и почему

- `npm run golden:verify` — не запускал. Diff не меняет рендер/геометрию/стили;
  единственный визуальный артефакт (`docs/images/09-device-info.png`) обновлён
  только из-за отпечатка `src/**`, что подтверждено принятым прогоном `Docs
  screenshots` на коммите реализации, а не новым UI-состоянием.
- `python -m pytest tests_backend` — не запускал. Диф не трогает
  `custom_components/**/*.py` (подтверждено `git diff --stat`).
- `node scripts/model-invariants.mjs` — не запускал. Diff не трогает геометрию,
  `layout`, `marker.space`, `open_spans`, ребра комнат — только tombstone/entity
  runtime-семантику.
- performance-профили — не запускал; в AC они не названы, а сложность
  ограничена O(1)-проверкой по уже существующему проходу по `markers[]`
  (см. ниже).
- Полный `demo/smoke_*.mjs` набор — не гонял. `smoke-select` даёт ровно одну
  зарегистрированную связь и diff локален для picker/tombstone-модели; остальные
  смоки (стены, геометрия, толщина, golden-инфраструктура) тематически не
  связаны с этим диффом.

## Находки

Нет ни одной High- или Medium-находки в скоупе или вне скоупа. Единственное
замечание вне скоупа (`docs/USER-GUIDE.ru.md` vs `marker.show_entities` i18n)
было выявлено на этапе ревью ТЗ и корректно заведено отдельно как
[#269](https://github.com/Matysh/houseplan-card/issues/269) (проверено:
issue существует, `P3`/`docs`/`S1-new`, не тронут в этой ветке). Новый текст
документации, добавленный в этом коммите, повторяет уже существующую (пусть и
спорную) формулировку гайда без создания нового расхождения.

## AC — проверка

**AC1. Дочерняя entity доступна в Add.** Доказано `demo/smoke_binding_picker.mjs`:
`deletedDeviceChildHiddenWithoutCheckbox`/`deletedDeviceChildOfferedWithCheckbox`
= true; `device:D` остаётся предложен (`parentStillOfferedAfterChildSave`).
Прочитан код: picker-исключение (`childOfRemovedDevice`) находится строго внутри
блока `if (this._markerDialog?.showEntities)`, поэтому флаг не обходится.
Mutation `device-tombstone-blocks-child-picker` подтверждает, что тест падает
при откате исключения.

**AC2. Save возвращает только X.** Доказано smoke (`childSaveCreatesOneLiveMarker`,
`childSaveKeepsParentTombstone`, `childBuiltWithoutAutoParent`,
`childGetsFreshLayoutPosition`, `childDrawnInView`) + unit
(`buildDevices: only X built from parent tombstone`). Идемпотентность
delete→re-add проверена smoke (`childDeleteLeavesBothTombstones`,
`secondChildSaveIsIdempotent`). Прочитан код `_saveMarker`: фильтр удаляет только
маркеры с тем же `id` или тем же `binding`, что и сохраняемый — parent-tombstone
с другим binding переживает save по построению; mutation
`child-readd-clears-parent-tombstone` подтверждает, что тест ловит регрессию,
если фильтр ослабить до полного сброса tombstones при сохранении entity-марки.

**AC3. Исключение exact, не протекает на siblings.** Доказано unit
(`isRemovedPlanEntity`/`isRemovedPlanSource` для X vs `switch.mic_mute` vs
`device:hub`; `areaClimateMap` room climate только по X) + smoke
(`liveChildRemovedFromPicker` для X после сохранения; отсутствие sibling/D в
`_devices`). Прочитан код: единственная точка исключения —
`removed.liveEntities.has(eid)` в `isRemovedPlanEntity`; все runtime-потребители
(`_planEntityAvailable`, `_renderEntityAvailable`, `_roomSrcCandidates`,
`buildDevices`, `isRemovedPlanSource`, `applyMarker`→controls) идут через эту же
функцию или через `buildDevices`, то есть исключение — «один choke point», а не
раздельные патчи с риском разойтись. Отдельно патчен только `areaClimateMap` —
он читает `markers`/`removed.devices` напрямую, минуя `isRemovedPlanEntity`;
грепом по `removed.(devices|entities).has` подтверждено, что других таких
прямых обращений в `src/**`, кроме уже патченных мест и `_roomSrcCandidates`
(там нужен именно device-level запрет, без исключения — верно по §6.4), не
осталось. Mutations `live-child-still-suppressed-by-parent-tombstone` и
`parent-tombstone-restores-all-siblings` подтверждают, что тест ловит и
отсутствие исключения, и его чрезмерное расширение на всех siblings сразу.

**AC4. Существующие контракты не меняются.** Доказано полным прогоном `npm test`
(1162/1162, включает регресс-покрытие #161/#226/#104/#233/#234 и т.д. без
дискриминации по имени) — из диффа видно, что тесты на #226 (`entity tombstone
does not strip that entity from a live parent device`), #161 (readd) и opening
contact/lock не переписывались. Прочитан код: `entityMarkerOwnership`/
`residualAutoDeviceEntities` (контракт #226) не тронуты; `isRemovedPlanEntity`
и его новая ветка проверяются раньше существующих проверок и не меняют их
семантику для случаев без live exact marker.

**AC5. Данные и UX совместимы.** Диф не содержит новых config-полей, i18n-ключей
или миграции (подтверждено `git diff --stat`: нет изменений в `src/i18n/*`,
`custom_components/**/*.py`, `PLAN_MODEL_VERSION`). `npx tsc --noEmit` green.
`check-docs` green. UI не меняется — читано: единственная правка в
`houseplan-card.ts` — булево условие внутри уже существующего цикла, без новых
элементов диалога.

**AC6. Гейты реализации зелёные.** См. таблицу выше — все обязательные и
применимые по diff/AC гейты прогнаны и зелёные; полные golden/smoke/performance
не требуются и оставлены предрелизным гейтом, как и разрешает ТЗ §10 явным
текстом «Golden не требуется для этого невизуального изменения».

## Одно число — один источник

Диф не добавляет и не показывает пользователю никакую числовую величину
(площадь, толщину, подпись, подсветку) — только логическую доступность
привязки в списке и её runtime-приоритет. Правило неприменимо к этому диффу.

## Что проверено и корректно

- Единая точка исключения (`isRemovedPlanEntity`) вместо рассеянных патчей —
  снижает риск того, что новый runtime-потребитель забудет учесть live-override.
- Layout-идентичность X независима от D (`markerIdForBinding('entity:X')` →
  `lg_X`, не совпадает с `dev.id` D) — подтверждено чтением `src/logic.ts` и
  тестом на `childGetsFreshLayoutPosition`/юнит-ассерт `lg_sensor.voice_level`.
- Перф: новый `liveEntities` Set собирается в уже существующем единственном
  проходе по `markers[]` внутри `removedPlanBindings()`, проверка — O(1) по Set;
  никакого нового прохода по registry на render не добавлено.
- Процессные формальности: трейлеры `Issue`/`User-Visible` на месте во всех 5
  коммитах диапазона; `User-Visible: yes` только на коммите с продуктовым
  изменением, и там же оба changelog; ветка/issue соответствуют;
  `process-gate.mjs` офлайн-проверка пройдена; CI `Validate` зелёный на точном
  финальном SHA; Medium-находка предыдущего этапа корректно заведена отдельным
  issue (#269), не тронута в этой ветке.

## Вердикт

Зелёный. High: 0, Medium: 0 (в скоупе — 0; вне скоупа — уже закрыто #269 на
этапе ревью ТЗ, здесь новых находок вне скоупа нет).
