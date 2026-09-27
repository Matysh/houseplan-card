# CODE-REVIEW-478-r2

- **Issue:** #478 — отказ от сущности «черновик контура» (`room_drafts`), wall model v9 → v10
- **Ветка:** `issue/478-remove-room-drafts`
- **SHA материала:** `0c670a9862ab4266a677b5553c070f2e41bab0c0` (сверено `git rev-parse HEAD`)
- **SHA предыдущего раунда (r1):** `1cadd520c0658e14ec8fd1410241e55ddbac21e1` — назван явно в r1-документе и в
  r1-комментарии; не пришлось восстанавливать по истории.
- **Диапазон дельты:** `git diff 1cadd520..HEAD` — 50 файлов, +1036/-593 (без учёта дублирования
  bundle-копий: правки продукта в `src/wall-segment-model.ts`,
  `custom_components/houseplan/validation.py`, `custom_components/houseplan/wall_segment_model.py`,
  `src/houseplan-editor-runtime.ts`; правки гейтов в `demo/golden/harness.mjs`,
  `demo/smoke_preflight_diagnostics.mjs`, `demo/smoke_unified_wall_tool.mjs`,
  `demo/smoke_wall_draw_click.mjs`, `scripts/mutation-gate.mjs`,
  `test/wall-segment-model.test.mjs`, `tests_backend/test_wall_segment_model.py`,
  новая фикстура `test/fixtures/478-room-draft-migration-vectors.json`; docs
  (`docs/TESTING.md`, `docs/images/*`); bundle-копии.
- **Заход:** r2 · блокирующих циклов на входе в раунд — 0 из 4 (значение из заголовка задачи);
  фактическая видимая история — r1 уже был красным («блокирующих циклов 1/4» в его собственном
  вердикте), так что счётчик в заголовке этого раунда, по всей видимости, не кумулятивен между
  раундами. Довожу до сведения, не блокирую этим находку.

## Вердикт

**Жёлтый.** High: 0, Medium: 1 (в скоупе задачи — тот же файл документации, который AC15 требует
держать в соответствии с v10), Low: 0.

Обе High-находки r1 закрыты и подтверждены исполнением, все четыре Medium и оба Low r1 закрыты и
подтверждены. Дельта сама внесла один новый Medium: канонический документ подсистемы разошёлся с
кодом ровно в той фразе, которую эта дельта должна была держать верной.

## Скоуп

Разбор по дельте (не заново): dev не двигался (`git merge-base origin/dev HEAD` ==
`git rev-parse origin/dev` == `c82ba84c`), контракт поведения не меняется, новая подсистема не
затронута, размер дельты (50 файлов, +1036/-593) кардинально меньше исходной задачи (154 файла,
+3515/-4309 на r1). Полный повторный разбор не требуется — граница определена решением по п.
«разбор остаётся полным, если…», ни одно условие не выполняется.

Предмет раунда — код и тесты, добавленные commit'ом `38abe78c` (`fix: address room draft review
findings`) поверх материала r1, плюс два docs-коммита с принятием скриншота (`0b577be5`,
`0c670a98`), которые к продуктовому коду отношения не имеют.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **High-1** — TS/Python дают разные ID и разные accept/reject на одном JSON (`cm: null`, явный `id: null`, допуск нулевой длины) | Общие функции `legacyFiniteNumber`/`legacyDraftPoint`/`legacyIdentity` (TS) и `_legacy_finite_number`/`_legacy_draft_point`/`_legacy_identity` (Python) с одинаковой numeric-regex и одинаковым epsilon `0.001`; единая JSON-фикстура `test/fixtures/478-room-draft-migration-vectors.json` потребляется **обоими** движками через новые тесты | `src/wall-segment-model.ts:723-741`, `custom_components/houseplan/wall_segment_model.py:33-56`; тесты `test/wall-segment-model.test.mjs:91-113`, `tests_backend/test_wall_segment_model.py:422-447`. Проверено исполнением: 28/28 в `node --test test/wall-segment-model.test.mjs` на HEAD; откат файла `wall-segment-model.ts` к версии r1 (`git show 1cadd520:...`) на этой же фикстуре ловит регресс (`WallSegmentModelError: duplicate-id: wall-d2ypm2qxakxh3ptdvgvl` — см. «Как проверялось») |
| **High-2** — устаревшая v9-запись с `room_drafts` поверх сохранённого v10 не отклоняется | Новая явная проверка в `validate_wall_model_transition`: `old_model >= 10 and new_model < 10 and any("room_drafts" in space ...)` → `WallModelClientOutdatedError`, выполняется **до** `contour_geometry_changed` и до `CONFIG_SCHEMA` | `custom_components/houseplan/validation.py:183-193`; вызов до схемы подтверждён в `custom_components/houseplan/websocket_api.py:1568` (`validate_wall_model_transition` — первая строка `_validate_config_cpu`, до `CONFIG_SCHEMA(msg["config"])`). Новый тест `tests_backend/test_wall_segment_model.py:327-343` строит именно сценарий r1 (сохранённая v10-модель, эхо v9 с восстановленным `room_drafts`, геометрия не менялась) — прочитан, не исполнен (нет `homeassistant` в среде), но трассировка не зависит от HA-рантайма |
| **Medium-1** — golden-харнесс не переименован вслед за полем, сценарий превью толщины реально сломан | `demo/golden/harness.mjs:1287,1289,1308` переименован `_activeDraftId`→`_activeWallChainId`, `_draftSegmentCms`→`_wallChainSegmentCms` | Диф `demo/golden/harness.mjs`. Проверено исполнением: `node demo/golden/run.mjs --mode=verify` (полная матрица, 161 сценарий) — `wall-junctions-plan-preview-light` теперь `passed` (было `different`, `diffRatio≈0.0024` на r1) |
| **Medium-2** — путь поглощения комнаты не атомарен при `_spaceModel() === null` | Введён `abortMutation()` (`_restoreGeometryStateLocal(before)` + toast) во всех точках выхода после мутации `sp.rooms`/`sp.walls` в `_applyWallFaceBatch` и `_commitRoom`; добавлена ранняя проверка `if (!before) { abort(...); return; }` | `src/houseplan-editor-runtime.ts:2517-2545` (churn ID), `:6764-6893` (`_applyWallFaceBatch`), `:6931-7040` (`_commitRoom`). Проверено исполнением: `node demo/smoke_unified_wall_tool.mjs` → `nullModelRollsBackWholeRoomMutation: true`, `classicNullModelRollsBackWholeRoomMutation: true` (оба теста форсируют `_spaceModel()` в `null` после мутации и проверяют побайтовый откат) |
| **Medium-3** — AC13 (фикс-пойнт Optimize сразу после accept) не доказан через реальный путь редактора | Новый сценарий смока: partial-overlap с «чужой» несвязанной partition + вызов `_openAlignDialog()` (реальный Optimize-путь) сразу после accept; новый мутационный свидетель `room-accept-leaves-coincident-partitions`, целящийся именно в `allowCoincidentPartitions: true` | `demo/smoke_unified_wall_tool.mjs` (+50 строк), `scripts/mutation-gate.mjs:2519-2530`. Проверено исполнением: смок → `acceptSplitsOnlyCoincidentForeignInterval: true`, `acceptedRoomIsOptimizeFixedPoint: true`; `node scripts/mutation-gate.mjs --id=room-accept-leaves-coincident-partitions` → «чистый прогон» + «мутант покраснел, как обязан» |
| **Low-1** — мёртвые поля `removedDrafts`/`redundantDraftsRemoved` в моке смока | Убраны из литерала отчёта | `demo/smoke_preflight_diagnostics.mjs:53-56` |
| **Low-2** — churn ID активной цепочки при отклонённом клике | `_activeWallChainId` восстанавливается к `beforeChainId` вместо генерации нового при откате | `src/houseplan-editor-runtime.ts:2520,2538`; смок `demo/smoke_wall_draw_click.mjs:26,30` (`sessionRestored: ... card._activeWallChainId === chainIdBeforeReject`) — проверено исполнением, `rejectedSessionRestored: true` |

Все восемь находок r1 закрыты фактическим изменением кода/теста, а не заявлением; шесть из восьми
подтверждены исполнением в этом раунде (не только чтением).

## Унаследовано из r1

Без повторной проверки принято (дельта их не касается):

- продуктовая рамка и соответствие `docs/SCOPE.md` (J6) — из r1-документа, SHA `1cadd520`;
- полнота ТЗ и решения владельца — `docs/reviews/SPEC-REVIEW-478-r1.md` (зелёное, 0 циклов),
  из вердикта в issue от `2026-09-06T12:05:47Z`, SHA ТЗ `30a16ed3`;
- корректность миграции v9→v10 в частях, не тронутых дельтой: перенос `points`/`segments` в
  `partitions`, идемпотентность повторного commit, структура `fixedTopologyWallLineageHints`,
  структура `reconcileCoincidentPartitions` (сигнатура, а не вызовы вокруг неё) — из r1-документа,
  раздел «Что проверено и корректно», SHA `1cadd520`;
- AC4 (performance/mutation, bounded fast path #461), AC5 (session-only chain), AC6 (room face
  detection), AC7/AC8 (кроме нового partial-overlap-с-чужой-partition кейса, который дельта как раз
  добавила и который я перепроверил — см. Medium-3 выше), AC10, AC11, AC12, AC14 (golden — но
  верифицировано заново полным прогоном, см. ниже), AC15 (typecheck/build/bundle — доверено
  зелёному Validate) — из r1-документа, SHA `1cadd520`.

## Как проверялось (этот раунд)

| Гейт | Команда | Результат |
|---|---|---|
| Дешёвые гейты (typecheck/test/build) | подтверждены зелёным Validate на точном SHA `0c670a98`: https://github.com/Matysh/houseplan-card/actions/runs/34043584139 (упомянут автором и проверен по номеру run) | не перегонял `tsc --noEmit`/полный `npm test`/`npm run build` отдельно — доверяю этому прогону |
| Целевой unit-тест высокого приоритета | `npx tsc -p tsconfig.test.json && node scripts/fix-test-build.mjs && node --test test/wall-segment-model.test.mjs` | 28/28 green |
| Тест умеет падать (не декларация) | тот же тест на файле `src/wall-segment-model.ts`, возвращённом к состоянию r1 (`git show 1cadd520:src/wall-segment-model.ts`), с восстановлением после проверки (`git status` чист) | `not ok — WallSegmentModelError: duplicate-id: wall-d2ypm2qxakxh3ptdvgvl` — тест ловит регресс |
| `node scripts/check-docs.mjs` | напрямую (diff трогает `src/**`) | «Documentation checks passed (7 files, 12 external links)» |
| `npm run bundle:sync` + сверка 3 копий | напрямую (потребовалось для запуска браузерных смоков — `demo/srv/assets` не закоммичен) | `dist` / `custom_components/houseplan/frontend` / `demo/srv/assets` побайтно идентичны; `git status` после — чисто (совпадает с уже закоммиченным) |
| Инварианты модели (диф трогает геометрию миграции) | `node scripts/model-invariants.mjs --config <результат commitWallSegmentModel на accepted-фикстуре>` и то же с `--lattice` | «ссылки разрешимы, записи толщины находятся»; 16/16 координат точно на узле решётки, 0 расхождений ключа |
| `node scripts/smoke-select.mjs --base 1cadd520 --head HEAD` | напрямую | 11 «прямых совпадений», 15 «слабых связей» (общий символ `_activeWallChainId`) — вывод приложен ниже |
| 11 смоков прямого совпадения | `node demo/smoke_{decor_images,edit_walk,help_affordance,junction_limits,near_axis_optimize,optimize_coordinate_canonicalization,partition_openings,room_resize,tap_ctx,zero_divider_taper,zero_wall_migration_unblocked}.mjs` | все 11 `OK` |
| `demo/smoke_unified_wall_tool.mjs` (изменён этой дельтой) | напрямую | все 16 полей `true`, `OK`, включая 4 новых поля Medium-2/Medium-3 |
| `demo/smoke_wall_draw_click.mjs` (изменён этой дельтой) | напрямую | все 8 полей `true`, `OK` |
| `demo/smoke_v8_draft_write.mjs` (слабая связь, соседняя тема — v8/v9 запись) | напрямую, точечно | все 8 полей `true`, `OK` |
| `node scripts/mutation-gate.mjs --id=room-accept-leaves-coincident-partitions` | напрямую | чистый прогон green, мутант покраснел — «поймано 1 из 1» |
| `golden:verify` (диф правит рендер-путь превью толщины) | `node demo/golden/run.mjs --mode=verify` — полная матрица, фильтр по сценарию запрещён самим скриптом (`policy.mjs`) | 161 сценарий: 146 passed, 15 different. Ранее сломанный `wall-junctions-plan-preview-light` теперь `passed`. Оставшиеся 15 different — те же категории (`isometric-*`, `*-color-popover-*`), что r1 уже определил как несвязанные с этим диффом и сверил с `origin/dev`; дельта их не касается (ни один файл изометрии/попапов цвета в diff 1cadd520..HEAD не участвует) |

### Что НЕ проверял и почему

- `python -m pytest tests_backend` — среда без `homeassistant` (`ModuleNotFoundError`), как и в r1.
  Компенсировано: (а) High-2 проверен трассировкой кода и порядком вызовов в
  `websocket_api.py`, не зависящим от HA-рантайма; (б) High-1 перепроверен исполнением
  эквивалентного TS-движка на той же самой JSON-фикстуре, которую потребляет и Python-тест —
  фикстура едина, разошедшегося поведения в TS уже не осталось, а сам факт единого источника
  снижает шанс, что Python читает её иначе, не отменяя необходимость дождаться зелёного
  backend-джоба CI (заявлен автором и Validate-job включает его).
- 14 из 15 «слабых связей» смок-выборки (`smoke_active_chain_ink`, `smoke_editor_tabs`,
  `smoke_free_walls`, `smoke_island_rooms`, `smoke_optional_space_model`,
  `smoke_plan_drawing_repairs`, `smoke_plan_snap_overlay`, `smoke_room_autoclose`,
  `smoke_wall_chain_merge`, `smoke_wall_chain_thickness`, `smoke_wall_face_overlap`,
  `smoke_wall_junctions`) — общий символ `_activeWallChainId` очень распространён, а дельта трогает
  его ровно в двух строках (`_markupClick`, сохранение `beforeChainId` вместо генерации нового id),
  и это поведение уже покрыто и подтверждено напрямую в `smoke_wall_draw_click.mjs`. `golden:verify`
  (полная матрица, включает `wall-junctions-*` сценарии) прошёл зелёным, что косвенно снимает риск
  визуальной регрессии для смежных сценариев.
- Полный `npm test`/`npx tsc --noEmit`/`npm run build` по отдельности — см. таблицу выше, доверено
  Validate на этом SHA.
- Performance-профиль (#461) — не в скоупе дельты r1→r2 (только новые тесты/фиксы, профиль не
  тронут); AC4 унаследован из r1 без изменений.

## Находки

### Medium-1 — канонический документ подсистемы утверждает поведение, которого дельта только что лишила код (docs/CONFIG-COMPATIBILITY.md)

`docs/CONFIG-COMPATIBILITY.md:203` (раздел «Ordinary wall chains — model v10 (#478)», не тронутый
этой дельтой) буквально говорит: «Malformed geometry, invalid thickness or an id collision fails
closed» — то есть коллизия ID при миграции черновика обязана останавливать запись целиком.

Это было верно на SHA `1cadd520` (код r1): `if (id) { if (used.has(id)) throw
WallSegmentModelError('duplicate-id', id); }`. Именно этот текст в документе и описывал то
поведение.

Фикс High-1 в этой дельте (`38abe78c`) заменил ветку на `if (!id || used.has(id)) { /* сгенерировать
новый id детерминированно, добавить суффикс -N при повторной коллизии */ }` — коллизия ID теперь
**не бросает исключение никогда**, а тихо заменяется на свежесгенерированный id. Это сделано
намеренно и раскрыто автором в хендоффе («…отсутствующие/повторные ID») и подтверждено собственной
фикстурой задачи: `test/fixtures/478-room-draft-migration-vectors.json`, `accepted.input` содержит
сегмент черновика с явным `"id": "wall-d2ypm2qxakxh3ptdvgvl"`, дословно совпадающим с ID уже
существующей partition, и ожидает не отказ, а успешную миграцию с новым id
`wall-d2ypm2qxakxh3ptdvgvl-2`.

Проверено исполнением (не только чтением): та же фикстура на файле `wall-segment-model.ts`,
откаченном к r1 (`1cadd520`), даёт `WallSegmentModelError: duplicate-id:
wall-d2ypm2qxakxh3ptdvgvl` — то есть код на SHA `1cadd520` действительно бросал исключение (док был
верен), а код на HEAD (`0c670a98`) мигрирует эту же фикстуру успешно (28/28 green) — то есть текст
дока с этим самым SHA уже разошёлся с фактическим поведением.

**Чем краснеет:** прямое чтение `docs/CONFIG-COMPATIBILITY.md:203` против
`src/wall-segment-model.ts:774-782` и `custom_components/houseplan/wall_segment_model.py:695-707`
на HEAD, плюс эмпирическое подтверждение через откат/повтор теста выше.

**Почему Medium, а не High:** AC15 требует «канонические документы… соответствуют v10» как условие
приёмки самой задачи — расхождение прямое и в файле, который эта же задача обязана была
актуализировать (задача трогала `docs/CONFIG-COMPATIBILITY.md` в исходных коммитах
`5ab41a72`/`04d6c5cd`, просто не при этой правке). Не High, потому что: (а) поведение кода не
регрессирует ни один AC — наоборот, оно устраняет реальный TS/Python-разнобой High-1, и на практике
коллизия ID при миграции черновика уже отсекается на входе отдельным, куда более старым инвариантом
схемы (`_space_geometry_invariants` в `validation.py:1592-1610`, общий `seen`-набор ID по всем
категориям пространства включая `room_drafts[].segments[].id`) для любого документа, прошедшего
запись после появления этого инварианта — то есть реальная достижимость этой ветки на боевых
данных низкая (только для документов, унаследованных до появления инварианта); (б) единственный
пострадавший артефакт — текст документации, откат которой не требует правки продукта.

**Как чинится:** одна строка в `docs/CONFIG-COMPATIBILITY.md:203` — убрать «or an id collision» из
списка отказов и в одном предложении описать реальное поведение (детерминированная регенерация +
суффикс при повторной коллизии), не трогая соседние verified-фразы про malformed geometry/thickness
(они по-прежнему бросают исключение — подтверждено той же фикстурой: `null-cm`, `boolean-cm`,
`null-point`, `epsilon-point` все в `rejected`).

## Что проверено и корректно

- High-1 и High-2 из r1 закрыты фактически, не декларативно — оба перепроверены исполнением
  (см. таблицу выше и раздел «Как проверялось»).
- Medium-1..3 и Low-1..2 из r1 закрыты, каждое подтверждено конкретным зелёным прогоном нового или
  изменённого теста/смока/мутанта, а не только чтением диффа.
- `golden:verify` на полной матрице подтверждает: ранее сломанный сценарий исправлен, новых
  регрессий не внесено.
- Инварианты модели (ссылки, записи толщины, ключ решётки) — 0 нарушений на мигрированной
  фикстуре задачи.
- `bundle:sync` — три копии побайтно идентичны, дерево чисто после локальной пересборки.
- Один источник числа (`test/single-source-numbers.test.mjs`) — этой дельтой не тронут ни один
  видимый пользователю числовой путь (правки — миграция/атомарность/тестовая инфраструктура),
  предмета для отдельной проверки в этом раунде не возникло.

## Итог

Ни одной High-находки. Ровно одна Medium — внутри скоупа задачи (тот же canonical-документ, что
AC15 требует держать актуальным), не блокирует, чинится без нового цикла по решению владельца
2026-08-19 (#202). Возврат автору для одной правки документации.

## Материал раунда

- `git diff 1cadd520..HEAD` (дельта r1→r2, основной предмет разбора)
- `git diff origin/dev...HEAD` (полный контекст, не как предмет полного разбора — только для
  сверки, что dev не двигался и делать полный разбор не требуется)
- Issue #478 и все комментарии, включая полный текст `docs/reviews/CODE-REVIEW-478-r1.md`
  (закоммичен в дерево на `b754d362`)
- `docs/specs/478-remove-room-drafts.md` (не менялся в этой дельте)
- `docs/CONFIG-COMPATIBILITY.md`, `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/478-remove-room-drafts`, коммит `0c670a9862ab` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e46feab93fe544c6506b07ea404d10ccfe191c7c`
  ```
  git log --all --format='%H %T' | grep e46feab93fe5
  ```
- ТЗ `docs/specs/478-remove-room-drafts.md`, блоб `70719ed585a993825720f90a2483fa760747bb06`
  ```
  git log --all --find-object=70719ed585a993825720f90a2483fa760747bb06 -- docs/specs/478-remove-room-drafts.md
  ```
