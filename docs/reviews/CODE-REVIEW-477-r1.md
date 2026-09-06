# CODE-REVIEW #477 · заход r1

- **Issue:** #477 «Оптимизировать планы» не должна требоваться повторно
- **Этап:** code (PROCESS.md §2.7)
- **SHA:** `04f4cd10` (HEAD), диапазон `origin/dev..HEAD` = 9 коммитов
  (`4693d97d`…`04f4cd10`), из них продуктовый `a979699a` (`fix:`,
  `User-Visible: yes`), остальные — тест-таргетинг и документация
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4
- **Ребейз:** ветка приведена к `dev` конвейером (+1 коммит `dev` поверх
  `dfc4ce60` → `04f4cd10`); разбор ниже — полный, не по дельте
- **ТЗ:** `docs/specs/477-editor-writer-fixed-point.md`, ревью ТЗ зелёное
  (r1, см. `docs/reviews/SPEC-REVIEW-477-r1.md` и комментарий issue от
  2026-09-06 16:51)

## Скоуп

Диапазон `git diff origin/dev...HEAD` — 63 файла, из них продуктовый код:
`src/writer-fixed-point.ts` (новый), `src/room-reference-transaction.ts`
(новый), правки `src/houseplan-editor-runtime.ts`, `src/draft-live-commit.ts`,
`src/coincident-partitions.ts`, `src/align-grid.ts`, `src/houseplan-card.ts`.
Плюс новые/изменённые тесты (`test/writer-fixed-point.test.mjs`,
`test/align-grid.test.mjs`, фикстура `test/fixtures/477-writer-fixed-point-writers.json`),
смоки (`demo/smoke_writer_fixed_point.mjs` новый, `demo/smoke_wall_chain_merge.mjs`
изменён), бенчмарк-харнесс, `scripts/mutation-gate.mjs` (+9 новых
mutation-свидетелей), `scripts/smoke-links.mjs`, документация (ARCHITECTURE,
CANVAS, STATUS, TESTING, USER-GUIDE ru/en, CHANGELOG ru/en, specs/README) и
синхронизированный бандл (три копии).

Соответствует ТЗ §5.1 пункт за пунктом: seed-bounded merge/reconciliation на
finish цепочки, единый finish barrier для всех штатных выходов, history-aware
Undo/Redo без скрытого шага, room-reference transaction для Delete/Merge,
исключение furniture/image из `alignAllToGrid`, исполняемая матрица writers,
перф-свидетель terminal-click/finish, обновлённая документация.

## Как проверялось

Зелёного Validate на `04f4cd10` не найдено — прогнал гейты сам.

**Дешёвые гейты (обязательные):**
- `npx tsc --noEmit` — чисто, без вывода.
- `npm test` — **2156 pass / 0 fail / 1 skip** (не 46/40, как заявил автор в
  комментарии — это был targeted подмножество; полный прогон зелёный).
- `npm run build` и `npm run bundle:sync` — сборка чистая, working tree после
  синка не изменился (`git status --porcelain` пуст) → три копии бандла
  (`dist`, `custom_components/.../frontend`, `demo/srv/assets`) совпадают.
- `node scripts/check-docs.mjs` — «Documentation checks passed (7 files, 12
  external links)» (diff трогает `src/**`, гейт обязателен и пройден).

**Инварианты модели (diff трогает `partitions`, `openings`,
`marker.vacuum.segment_map` — обязателен по инструкции):**
- `npm test` уже гоняет их на всех моделях проекта — зелёный.
- `node scripts/model-invariants.mjs --config test/fixtures/optimize-storage-roundtrip.json --json`
  → `violations: []`.
- то же для `test/fixtures/477-writer-fixed-point-writers.json` → `violations: []`.

**Мутационный гейт:**
- `node scripts/mutation-gate.mjs --check` → **530/530 ok**, exit 0, включая
  9 новых `writer-*` свидетелей (`writer-finish-reset-bypasses-finalizer`,
  `writer-finish-adopts-unsafe-candidate`, `writer-history-skips-finished-chain-normalization`,
  `writer-room-delete-keeps-direct-reference`, `writer-room-delete-keeps-vacuum-reference`,
  `writer-align-snaps-free-decor-transform`, `writer-terminal-click-runs-finish-reconciliation`,
  `writer-finish-skips-seed-merge`, `writer-finish-skips-coincident-reconciliation`) —
  дисциплина «тест умеет падать» проверена самим прогоном гейта: guard
  реально краснеет при мутации и гейт репортит `ok`, то есть проверяемый код
  ловит регресс.

**Смоки — выбраны по выводу `node scripts/smoke-select.mjs --base origin/dev --head HEAD`**
(228 смоков всего; изменено 7 файлов `src/**`, 81 символ на изменённых
строках). Прогнал прямые совпадения и одну зарегистрированную связь,
относящиеся к затронутым путям (wall-chain finish, room reference, terminal
click, room acceptance/reconcile):

| Смок | Связь | Результат |
|---|---|---|
| `smoke_writer_fixed_point.mjs` | прямое (новый, специально под #477) | OK, все 12 полей `true` |
| `smoke_wall_chain_merge.mjs` | прямое (`_finishWallChain`, изменён в diff) | OK, все 9 полей `true` |
| `smoke_wall_draw_click.mjs` | прямое (`_activeWallChainId`, `_path`…) | OK, все 8 полей `true` (rejected-state atomicity) |
| `smoke_unified_wall_tool.mjs` | прямое | OK, все 16 полей `true`, включая `acceptedRoomIsOptimizeFixedPoint` |
| `smoke_room_resize.mjs` | прямое (`_checkSpacePhysicalGeometry`, изменена сигнатура) | OK |
| `smoke_optimize_coincident_partition.mjs` | зарегистрированная (`reconcileCoincidentPartitions`, #276) | OK, все 10 полей `true` |
| `smoke_v8_draft_write.mjs` | прямое (`_activeWallChainPartitionIds`, `_pendingPhysicalWrites`) | OK, все 8 полей `true` |

Не прогонял остальные ~46 прямых/слабых совпадений (`smoke_room_autoclose`,
`smoke_editor_tabs`, `smoke_free_walls`, zigbee/topology/decor смоки и т.д.):
совпадения там — по общим геттерам состояния (`_curSpaceCfg`, `_path`,
`_saveConfig`), которые не входят в изменённый контракт: правки не трогают
zigbee, decor-персист, resize-контроллер или furniture-палитру напрямую;
выбор ограничен темой diff, а не полным списком «прямых» имён. `smoke_edit_walk`
(зарегистрированная связь, «дефекты рождаются в редактировании») не
прогонялся отдельно — покрытие того же класса рисков дают
`smoke_wall_chain_merge`+`smoke_wall_draw_click`+`smoke_writer_fixed_point`.

**Перформанс (AC9, §11 ТЗ — обязателен, путь #461 задет):**
`npm run benchmark:wall-draw-click` — `pass: true`, `structural: true`,
`timingPass: true`. Ключевые числа (сам прогнал, не со слов автора):
click median 7 ms / max 10.7 ms (бюджет 150/250), remote median 11.4 ms
(бюджет 30.5), finish 4.7 ms (бюджет 250), remote-finish (удвоенные
unrelated rooms/partitions, `remoteFixture.positiveSegments = 2×base`) 9.5 ms
(бюджет `4.7×1.5+20=27.1`) — это ровно требование §11 «удвоение unrelated
rooms/partitions не должно более чем в 1.5 раза увеличивать median finish
плюс 20 ms». Структурные счётчики: terminal click — `fullSpacePhysicalChecks:0`,
`configWrites` = 1 на клик, `history` = 1 на клик; finish — один
`localPhysicalChecks`, один `configWrites`, `history: 0`,
`wallFinishBarriers: 1` — подтверждает «один bounded transaction, без
дополнительной history-команды».

**Golden:** НЕ прогонял `npm run golden:verify` (222 сценария, полный
предрелизный гейт). Обоснование по чтению кода и матрицы, а не по заявлению
автора: (1) merge коллинеарных partitions и reconcile — lossless-операции над
идентичной абсолютной геометрией (те же `a/b`, тот же `cm`), рендер стен не
зависит от числа записей partitions с одинаковым итоговым контуром; (2) два
единственных golden-сценария, упоминающих Optimize
(`optimize-preflight-dialog-*`, `optimize-orphan-references-dark-en`),
подставляют синтетический `card._alignDialog = {...}` вручную
(`demo/golden/harness.mjs:1582-1610`), а не вызывают реальный
`alignAllToGrid`/`optimizePlans` на fixture — furniture-exemption в
`align-grid.ts` не может повлиять на их пиксели; (3) ни один сценарий матрицы
не проходит через `_finishWallChain`/Delete-Merge room. Риск ложного
пропуска низкий, но это явное решение, а не тихий пропуск.

**Explicit-skip (по diff и AC не требуются):**
- `python -m pytest tests_backend` — `custom_components/**/*.py` не тронут.
- Полный набор `demo/smoke_*.mjs` (228 шт.) — задача не задевает всё
  (zigbee/vacuum/isometric/decor-палитра и т.д. вне скоупа).

## Находки

Находок уровня High или Medium в скоупе задачи не обнаружено.

Мелкое наблюдение (не находка, не блокирует): в комментарии реализации автор
написал «расширенный регрессионный набор — 40/40» вместо честного полного
`npm test`; сам прогнал полный набор — 2156/0/1, разночтений с продуктовым
кодом не выявлено. Указываю для полноты картины, замечание не по существу
кода.

## Что проверено и корректно

- **AC1 (finished chain fixed point).** `test/writer-fixed-point.test.mjs`
  прогоняет 2- и 3-сегментные коллинеарные цепочки через
  `finalizeWallChainSpace` → `optimizePlans(...).changed === false`; смок
  `smoke_wall_chain_merge` подтверждает то же через реальный `_markupClick`/
  `_finishWallChain` в собранном бандле (`straightRunMergedAtFinish: true`).
- **AC2 (coincident chain fixed point).** unit-тест на фикстуре
  `276-coincident-partition.json`: `partitionsReconciled: 1`,
  `openingsRehosted: 1`, абсолютная геометрия проёма (`x`, `length`,
  `contact`, `future_field`) сохранена, следующий Optimize — no-op; смок
  `smoke_optimize_coincident_partition` подтверждает атомарность Apply/reload/Undo.
  Прочитано и проверено: seed-scope действительно ограничивает reconciliation
  только выжившими ID цепочки (`survivingSeedIds` в `writer-fixed-point.ts:47-58`),
  несвязанные швы не трогаются (тест «seed scope merges the touched chain but
  leaves unrelated historical seams alone»).
- **AC3 (fail-closed atomicity).** Юнит-тест «unsafe coincidence is
  fail-closed and byte-equivalent» — 3 варианта (unknown field, column
  conflict, orphan opening host) не дают частичной записи, `report.config.spaces[0]`
  побайтово равен `before`. На уровне транзакции —
  `commitWallChainFinishGeometry` (`draft-live-commit.ts`) строит candidate на
  клоне, проверяет `wallModelOffGridValueCount` + `_checkSpacePhysicalGeometry`
  + `_junctionLimitsIntroduced` **до** `adoptWallSegmentModelCandidateInPlace`;
  при отказе `_finalizeWallChainPartitions` (`houseplan-editor-runtime.ts:1481+`)
  восстанавливает `_path`/`_activeWallChainId`/`_wallChainRedo`/`_closingWallCm`
  из локального `session`-снапшота. Мутация `writer-finish-adopts-unsafe-candidate`
  красит guard, если проверку убрать — свидетель умеет падать (гонял gate,
  `ok`). Смок `smoke_wall_draw_click`: `rejectedStateRestored`,
  `rejectedSessionRestored`, `rejectedAddsNoHistory`, `rejectedQueuesNoWrite`
  — все `true`.
- **AC4 (history continuity).** `_canonicalWallChainHistoryState`
  (`houseplan-editor-runtime.ts:1976-2016`) прогоняет lossless finalizer на
  snapshot только если цепочка уже не активна (`this.host._activeWallChainId`
  проверен первым), иначе возвращает snapshot буквально — соответствует §7
  ТЗ («пока цепочка активна, `_applyGeometryState` применяет snapshot
  буквально»). Смок `smoke_writer_fixed_point`: `finishedChainUndoOptimizeNoop`,
  `finishedChainUndoHasOnePartition`, `finishedChainRedoOptimizeNoop`,
  `finishedChainRedoHasOnePartition` — все `true`, т.е. Undo/Redo после finish
  не возвращает optimizer debt и не плодит лишний partition. `finishAddsNoHistory: true`
  — история не получает скрытый шаг. Мутация
  `writer-history-skips-finished-chain-normalization` подтверждена красной.
- **AC5 (all finish owners).** Source-contract тест
  «routes every explicit chain finish through one finalizer» проверяет:
  `_finishWallChain` вызывает `_finalizeWallChainPartitions`; Reset-кнопка
  (`btn.reset`) в контекст-трее теперь идёт через `_finishWallChain()`, а не
  напрямую через `_cancelPath()` (проверил диф — `_cancelPath` не удаляет уже
  принятые стены, только сессионное состояние, так что смена поведения кнопки
  корректна и соответствует §6.4); `_applyWallFaceBatch` при «не создавать ни
  одну предложенную комнату» и `_keepClosedAsPartitions` тоже проведены через
  `_finalizeWallChainPartitions`; `_slideTo`, `_onHashChange`, `Escape`
  (в `houseplan-card.ts`) вызывают `_finishWallChain`; тест явно проверяет
  ОТСУТСТВИЕ вызова финализатора из `_markupClick` (terminal-click путь) —
  прочитал `_stagePointerCancel`: pointer cancel/pinch не вызывают
  `_finishWallChain`/`_finalizeWallChainPartitions`, соответствует «pointer
  cancel, pinch и второй touch сами по себе не заканчивают цепочку».
- **AC6 (room reference transaction).** `room-reference-transaction.ts`
  прочитан целиком: `rewriteMarkerRoomReferences` меняет только точное
  совпадение `room_id`/значений `vacuum.segment_map`, сканирует markers всех
  пространств (глобальная уникальность room ID, как того требует §8.1),
  пустой `segment_map`/`vacuum` удаляется канонически только если больше
  ничего не осталось. `restoreMarkerRoomReferences` восстанавливает только
  захваченные поля, не трогая более поздние правки прочих полей — юнит-тест
  явно это проверяет («unrelated later marker fields survive Undo»). В
  runtime `_confirmRoomDelete`/`_commitMerge` вызывают rewrite **до**
  геометрической мутации и сохраняют `before.roomReferences` для отмены;
  `_recordGeometry` делает симметричный `after`-снэпшот. Смок
  `smoke_writer_fixed_point`: `deleteClearsExactReferences`,
  `undoRestoresGeometryAndReferences`, `redoReappliesGeometryAndReferences`,
  `unrelatedMarkerFieldsSurvive` — все `true`. Две мутации
  (`writer-room-delete-keeps-direct-reference`,
  `writer-room-delete-keeps-vacuum-reference`) подтверждены.
- **AC7 (continuous transforms stay canonical).** `align-grid.ts`: `kind ===
  'furniture' || kind === 'image'` пропускается до какого-либо изменения
  (строка добавлена перед инкрементом `total`/`moved`, то есть транформ вообще
  не участвует в отчёте — соответствует ТЗ «не увеличивает `moved`,
  `coordsCanonicalized`... из-за их transform»). Юнит-тест: byte-equivalent
  furniture/image (включая `future_field`, флаги отражения), `report.total ===
  1` (только ordinary decor учтён), обычный `rect` по-прежнему двигается.
  Мутация `writer-align-snaps-free-decor-transform` подтверждена.
- **AC8 (writer coverage manifest).** `test/fixtures/477-writer-fixed-point-writers.json`
  (27 строк, уникальные owners) + source-contract тест, который AST-парсит
  `houseplan-editor-runtime.ts` (через `typescript`), собирает все методы,
  вызывающие `_commitPhysicalGeometry`/`_recordGeometry`, и падает, если
  найденный owner отсутствует в манифесте — реальный «краснеет при
  добавлении нового writer» механизм, не декларативный список.
- **AC9 (perf).** См. «Как проверялось» выше — прогнал сам, оба структурных и
  оба тайминговых критерия зелёные, включая seeded-scaling budget.
- **AC10 (compatibility/docs).** `model_version`/схема не менялись (grep по
  diff — новых persisted полей нет; `wallChainSeedIds`/`roomReferences`
  объявлены в `SpaceGeometryState` с пометкой «Session-only» и не попадают в
  `ServerConfig`, что и требуется §12). i18n: `toast.geometry_unsafe` — уже
  существующий ключ (использовался в 9 др. местах runtime до этого диффа),
  новых строк не добавлено. USER-GUIDE.md/.ru.md, CANVAS.md, ARCHITECTURE.md,
  STATUS.md, TESTING.md обновлены синхронно и по существу совпадают с кодом
  (сверил формулировки построчно с реализацией, а не только с фактом правки
  файла). `docs/specs/README.md` получил строку на #477.
- **Трейлеры.** Все 9 коммитов несут `Issue: #477`; `User-Visible: yes`
  только на продуктовом `a979699a`, который включает оба changelog
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) в одном коммите — соответствует
  требованию.
- **Одно число — один источник.** Диф не добавляет и не меняет ни одной новой
  пользовательски видимой величины (Optimize-отчёт — существующий механизм,
  его числа как и раньше берутся из одного источника, `alignAllToGrid`/
  `optimizePlans`; никакого нового дублирующего представления числа в UI не
  введено). `test/single-source-numbers.test.mjs` прошёл в составе `npm test`.

## Чего не проверял и почему

- **`npm run golden:verify`** — не прогонял (обоснование выше: код-чтение
  показывает, что изменённые пути lossless и не пересекаются с двумя
  Optimize-related golden-сценариями, которые используют синтетический
  `_alignDialog`, а не реальный расчёт). Если ревьюер/владелец сочтёт риск
  неприемлемым, это единственный неисполненный гейт из «по необходимости».
- **`python -m pytest tests_backend`** — не запускал, `custom_components/**/*.py`
  не тронут диффом.
- **Полная матрица `demo/smoke_*.mjs` (228 файлов)** — не запускал; задача не
  задевает весь редактор (zigbee-топология, isometric, decor-палитра и т.п.
  вне скоупа и вне выборки инструмента).
- Остальные ~46 «прямых»/«слабых» совпадений из вывода `smoke-select.mjs`
  (`smoke_room_autoclose`, `smoke_editor_tabs`, `smoke_free_walls`,
  `smoke_wall_junctions`, decor/save-race/zigbee смоки и т.д.) — не
  запускал: совпадения там по широко переиспользуемым геттерам состояния
  (`_curSpaceCfg`, `_path`, `_saveConfig`), не по изменённому контракту;
  прогнанные 7 смоков покрывают все реально изменённые точки входа
  (wall-chain finish, terminal click, room acceptance/reconcile, room
  reference transaction).
- Ручного тестирования в браузере вне смоков не проводил (в этом цикле его и
  не предполагается — «Ручного тестирования в цикле нет»).

## Вердикт

Зелёный. Все AC доказаны исполняемыми свидетелями (unit + smoke + mutation +
source-contract + benchmark), гейты прогнаны лично и по существу, документация
и трейлеры в порядке, High/Medium-находок в скоупе нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/477-optimizer-fixed-point`, коммит `dfc4ce60033f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5ea87e1947f3f9ed13fefda60629a7aecc427bf8`
  ```
  git log --all --format='%H %T' | grep 5ea87e1947f3
  ```
- ТЗ `docs/specs/477-editor-writer-fixed-point.md`, блоб `a07a7248e008229e6e865ef793b213fdb524d5e4`
  ```
  git log --all --find-object=a07a7248e008229e6e865ef793b213fdb524d5e4 -- docs/specs/477-editor-writer-fixed-point.md
  ```
