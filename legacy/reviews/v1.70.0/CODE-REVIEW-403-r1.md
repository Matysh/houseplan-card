# CODE-REVIEW-403-r1

- Issue: https://github.com/Matysh/houseplan-card/issues/403
- ТЗ: `docs/specs/403-area-relocation-safety.md` (ревью: `SPEC-REVIEW-403-r1.md` жёлтый → `SPEC-REVIEW-403-r2.md` зелёный)
- Диапазон: `origin/dev..HEAD`, SHA на момент вердикта — `9c4d07abe27de7d55b8fd78947dcf21579e8055a`
- Ветка: `issue/403-area-relocation-safety`
- Заход: r1 (первый код-ревью этой задачи; спек-ревью не тратит бюджет код-ревью, §7.2 PROCESS.md)
- Ребейз: ветка приведена к `dev` конвейером до ревью (024114fd → 9c4d07ab, +1 коммит `dev`) — разбор ниже полный, не по дельте, как того требует §7.2/§2.9

## Скоуп

Две находки одного аудита (`AUDIT-2026-08-31-v1700beta2.md`), одна поверхность —
`_syncAreaRelocations` в `src/houseplan-card.ts` и стек Undo позиций устройств:

- **C2 (High)**: отказ `houseplan/config/set` после успешного удаления layout
  ранее терял ручную позицию устройства без следа и без метки внимания.
- **M1 (Medium)**: переезд area одного устройства чистил весь стек
  Undo/Redo позиций, а не только записи переехавшего устройства.

Коммиты диапазона: `0d338b9c` (ТЗ), `caddeb08`/`6b515800` (документы спек-ревью,
кладутся конвейером), `94502d3d` (правка ТЗ по H1 спек-ревью r1),
`71bbc953` (**код**: `src/houseplan-card.ts`, `src/command-stack.ts`,
`test/command-stack.test.mjs`, `scripts/mutation-gate.mjs`,
`demo/smoke_area_relocation_safety.mjs` (новый), `demo/smoke_area_relocation.mjs`
(правка одной ветки), `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`/`.ru.md`,
бандл-копии), `9c4d07ab` (docs: пересъёмка скриншотов, `Issue: #403`,
`User-Visible: no`, обязательна т.к. `check-docs.mjs` считает отпечаток по всему
`src/**`).

## Как проверялось

### Гейты (все на SHA `9c4d07ab`)

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | 0 ошибок |
| unit | `npm test` | `pass 1697 · fail 0 · skipped 1` (`# tests 1698`) |
| build + сверка бандла | `npm run build`; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js`; сверка `houseplan-assets.json` и списка файлов `houseplan-assets/`; затем `npm run bundle:sync` (пересборка + синхронизация трёх копий, включая `demo/srv/assets`) | все копии побайтово совпали **до** пересборки — в дереве уже лежит актуальный бандл; `git status --short` после пересборки пуст |
| docs-фингерпринт (обязателен, diff трогает `src/**`) | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | `Проверено добавленных строк: 52 в 2 файл(ах). Новых any нет` |
| провенанс коммитов/веток | `node scripts/process-gate.mjs --base origin/dev --head HEAD` | `коммитов 6, гейт пройден, предупреждений 0` (проверка 8 — статус issue — не запускалась, не нужна для ревью) |
| выбор смоков по diff | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 22 «прямых совпадения» из 212; см. решение по каждому ниже |
| смок AC1–AC6 (новый) | `node demo/smoke_area_relocation_safety.mjs` | все 11 полей `true`, `OK` |
| смок AC7 (существующий #126) | `node demo/smoke_area_relocation.mjs` | все 18 полей `true`, `OK`, включая переименованное `failedConfigRestoredAndRetryable` |
| смок по прямому совпадению символа (`_devicePositionHistory`, `_persistDevicePlacement`) | `node demo/smoke_device_position_history.mjs` | все 32 поля `true`, `OK` |
| мутант 1 | `node scripts/mutation-gate.mjs --id=area-relocation-loses-position-on-refusal` | `тест покраснел, как обязан`, поймано 1/1 |
| мутант 2 | `node scripts/mutation-gate.mjs --id=area-relocation-clears-whole-history` | `тест покраснел, как обязан`, поймано 1/1 |

### Что НЕ прогонялось и почему

- **Остальные 19 «прямых совпадений» `smoke-select`** (`smoke_optimize_coordinate_canonicalization`,
  `smoke_room_resize`, `smoke_cold_view_toggle`, `smoke_cold_view_vacuum`,
  `smoke_help_affordance`, `smoke_junction_limits`, `smoke_lattice_write_barrier`,
  `smoke_linked_virtual_light`, `smoke_partition_openings`, `smoke_plan_upload_race`,
  `smoke_resize_audit_1550`, `smoke_resize_pointer_real_plan`, `smoke_save_race`,
  `smoke_space_tab_reorder`, `smoke_tap_ctx`, `smoke_v8_draft_write`,
  `smoke_virtual_light_toggle`, `smoke_ws_resilience`, `smoke_zero_wall_migration_unblocked`)
  — совпали только по одиночным широко используемым символам (`_showToast`,
  `_writeConfig`, `_reloadConfigOnly`), которые diff не переопределяет и вызывает
  теми же сигнатурами, что и раньше. Слабая связь по PROCESS.md §8 — повод
  посмотреть, не обязанность прогонять; ни один из этих смоков не касается
  area-relocation/undo-истории по теме. Полная матрица (212 смоков) —
  предрелизный гейт.
- **`npm run invariants -- --config <export>`** — диф трогает `layout` (позиции
  устройств), формально попадающий под правило PROCESS.md §доп. «трогает
  геометрию/ссылки на неё» (`marker.space`, `layout`). Решение: не запускать,
  явно. Причина: правка не вычисляет новые координаты/ключи и не производит
  новых записей толщины/рёбер — `_persistDevicePlacement(id, placement)` в
  ветке восстановления вызывается с тем же объектом `before`, захваченным
  `devicePlacement(this._layout, decision.id)` до удаления (`houseplan-card.ts:5180`),
  т.е. записывается обратно **байт-в-байт то же значение**, которое уже прошло
  инварианты до удаления; ключ (`deviceId`) не меняется. Сама логика инвариантов
  (`checkReferences`, `latticeProfile`) не тронута и продолжает проверяться
  юнит-тестами (`test/model-invariants.test.mjs` и смежные — в зелёном `npm test`
  выше). Ни `src/device-area-relocation.ts` (резолвер, вне скоупа ТЗ), ни
  wall/thickness/open_spans код не задеты.
- **`npm run golden:verify`** — ТЗ прямо утверждает «Видимого оформления не
  меняем» (раздел UX), и чтение диффа это подтверждает: нет правок CSS,
  разметки, `render()`; единственная пользовательская связь — переиспользуемый
  toast (`toast.pos_save_failed`, уже существующий ключ) и существующая метка
  внимания (`.newdot`, уже существующая разметка — её же проверяет наш смок
  через `fallbackEl?.querySelector('.newdot')`).
- **`python -m pytest tests_backend`** — diff не трогает `custom_components/**/*.py`.
- **Performance-профили** — не названы в AC; ТЗ утверждает «нет доп. циклов,
  подписок, сетевых вызовов сверх уже выполняемых `_syncAreaRelocations` /
  `_writeConfig`» — проверено чтением: цикл восстановления идёт по
  `deletedPlacements` (Map, максимум по числу решений `relocate` в одном
  проходе — уже ограничено существующим циклом `for (const decision of
  current.decisions)`), доп. запись конфига только при `restoreFailed.size > 0`
  (редкая ветка, не на каждый тик).

## Находки

Нет. High: 0, Medium: 0, Low: 0 (нет находок, требующих правки или списания записью).

Ниже — отдельно, для прозрачности разбора: одна проанализированная, но не
блокирующая деталь.

**Наблюдение (не находка).** Тройной отказ подряд — отказ `config/set`, затем
отказ восстановления `layout/update`, затем отказ второй, дополнительной
записи конфига с меткой внимания (`houseplan-card.ts:5273-5283`) — оставляет
локальное состояние (`_serverCfg.settings.new_device_ids` содержит id) впереди
серверного на один цикл: сама эта последняя запись не откатывается при
неудаче, в отличие от первой (`previousSnapshot`/`previousAttention`
restore чуть выше). Разобрано по коду, не воспроизведено намеренно (третий
отказ подряд у одного и того же устройства — вырожденный случай, вне
разумной проверки браузерным смоком). Самолечится: `_regSignature = ''` и
`_areaRelocationSyncKey = ''` сброшены в этой же ветке, так что следующий
authoritative rebuild пересчитает резолюцию заново и либо успешно допишет
attention на сервер (через обычный путь #126 — `nextAttention` включает
любой `committed` id независимо от исхода восстановления позиции), либо
покажет очередной toast. Тот же риск закрыт в разделе «Риски» ТЗ
(«Восстановление на сервере тоже может отказать... этот случай обязан
оставлять метку внимания» — оставляет, пусть и не гарантированно с первой
попытки). Не Low, потому что не расходится с контрактом ТЗ и не имеет
пользовательского воспроизводимого сценария потери данных — в худшем случае
лишний toast и задержка в один rebuild-тик.

## Разбор по AC

Все доказательства ниже — исполнением (браузерный смок `demo/smoke_area_relocation_safety.mjs`,
запущен выше), кроме отдельно помеченных «прочитано, не исполнено».

- **AC1** (отказ `config/set` не оставляет устройство без позиции: либо
  позиция на месте, либо `new_device_ids`). Доказано смоком:
  `rejectedWriteRestoresAfterDelete: true` (позиция восстановлена локально
  **и** на сервере — `layout/update` вызван после отказа `config/set`,
  порядок проверен по индексу вызова) и `failedRestoreLeavesAttention: true`
  (второй сценарий: отказывает и восстановление — устройство попадает в
  `new_device_ids` **и на сервере**, `.newdot` в DOM). Мутант
  `area-relocation-loses-position-on-refusal` красит именно этот смок при
  удалении восстановления — доказательство не тавтологично.
- **AC2** (успешный переезд работает как раньше). Доказано полным прогоном
  `demo/smoke_area_relocation.mjs` (18/18 `true`, включая
  `staleLayoutDeleted`, `provenanceAdvanced`, `attentionShown`) и
  `successfulRetry: true` в новом смоке (тот же сценарий после снятия
  задержки ответа сервера).
- **AC3** (delete-first: устаревшая точка не выигрывает, пока ответ сервера
  в пути). Доказано: `stalePointSuppressedWhilePending: true` — во время
  задержанного `config/set` `c._layout[relocatedId]` пуст, а устройство
  вычисляется в новой area, то есть старая точка не «воскресает» до
  подтверждения.
- **AC4** (ветка `conflict` подчиняется AC1). Доказано:
  `conflictRestoresBeforeRetry: true` — порядок вызовов
  restore(`layout/update`) → `config/get` (reload) → повторный
  `layout/delete` подтверждён по индексам в логе WS-вызовов, не только по
  финальному состоянию; `conflictEventuallyCompletes: true`. Код-путь
  проверен построчно: `await this._reloadConfigOnly(true)` (было `void`) —
  сделано намеренно awaited, чтобы блок восстановления attention ниже читал
  уже перезагруженный `this._settings`, а не гонялся с ним.
- **AC5** (переезд одного не гасит историю другого). Доказано:
  `unrelatedHistorySurvives: true`, `unrelatedUndoStillWorks: true`
  (Undo лампы после её drag остаётся рабочим после переезда другого
  устройства), `conflictKeepsUnrelatedHistory: true` в ветке conflict.
  Дополнительно юнит-тестом `test/command-stack.test.mjs` — `removeWhere`
  оставляет несвязанные undo/redo записи (`stack.undoName === 'lamp'`,
  `canRedo === true` после удаления записи `sensor`).
- **AC6** (записи переехавшего устройства удалены из истории). Доказано:
  `relocatedHistoryRemoved: true` (после удаления записи `undoName` уже не
  «Move relocating light», `canRedo` пуст). Юнит-тест то же самое проверяет
  на уровне `CommandStack.removeWhere` изолированно. Мутант
  `area-relocation-clears-whole-history` красит смок при возврате
  безусловного `clear()` — доказательство не тавтологично.
- **AC7** (существующее поведение #126 не сломано). Доказано полным зелёным
  прогоном `demo/smoke_area_relocation.mjs`; единственное изменённое
  утверждение (`failedConfigRetryable` → `failedConfigRestoredAndRetryable`)
  соответствует тексту ТЗ буквально — сверено построчно с
  `docs/specs/403-area-relocation-safety.md:174-180`.

## Что проверено и корректно

- **Тип `DevicePlacement`/`deviceId`** — прочитано, не исполнено:
  `src/device-position-history.ts:1-20` подтверждает поля `x/y/s` у
  `DevicePlacement` и `deviceId/spaceId/placement` у `DevicePositionState`,
  что делает `removeWhere(({before, after}) => relocating.has(before.deviceId) ...)`
  типобезопасным (подтверждено также нулём ошибок `tsc --noEmit`).
- **Идентичность восстанавливаемого значения** — прочитано: `before` в цикле
  удаления (`houseplan-card.ts:5180`) берётся через `devicePlacement(this._layout, decision.id)`
  **до** вызова удаления, и то же самое значение (без пересчёта) передаётся в
  `_persistDevicePlacement(id, placement)` при восстановлении — ветка
  восстановления не может записать испорченные координаты.
- **i18n** — использованные ключи (`toast.pos_save_failed`, `toast.cfg_save_failed`,
  `toast.conflict`) уже существуют во всех четырёх словарях
  (`src/i18n/{en,ru,de,fr}.json`, сверено `grep`) — новых строк diff не
  добавляет, что соответствует разделу «i18n» ТЗ.
- **Трейлеры и changelog** — `71bbc953` несёт `Issue: #403` / `User-Visible: yes`
  и правит `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том же коммите;
  текст точен относительно кода (сверено построчно — «restores the point
  before retrying, or marks the marker for attention if the restore also
  fails» соответствует именно реализованной логике, а не общей фразе).
  `9c4d07ab` (скриншоты) несёт `Issue: #403` / `User-Visible: no`, что верно
  — рендер не менялся.
- **`docs/ARCHITECTURE.md`** — абзац про area-relocation writer дополнен
  точным описанием восстановления и точечной инвалидации истории, без
  расхождений с кодом.
- **Одно число — один источник**: diff не добавляет и не меняет ни одной
  видимой пользователю величины (позиция маркера не отображается как число,
  Undo-кнопка — булев enabled/disabled без числа); неприменимо к этому diff.

## Унаследовано (без повторной проверки)

Не применимо — это первый код-ревью задачи (r1). Вердикт и находки
`SPEC-REVIEW-403-r1.md`/`SPEC-REVIEW-403-r2.md` относятся к другому этапу
(§7.2 PROCESS.md: цикл считается по этапу, спек-ревью не тратит бюджет
код-ревью и не подменяет его разбор) — их выводы не наследуются автоматически
в код-ревью, но диагноз C2/M1 и AC1–AC7 из зелёного `SPEC-REVIEW-403-r2.md`
использованы как контракт, против которого проверялся код в разделе «Разбор
по AC» выше.

## Вердикт

Зелёный. Обе находки аудита устранены и доказаны исполнением с
мутационным контролем (не тавтологичны); AC1–AC7 доказаны; гейты, обязательные
для объёма этой задачи, зелёные; трейлеры и changelog на месте.
