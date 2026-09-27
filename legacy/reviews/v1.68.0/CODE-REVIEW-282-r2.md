# CODE-REVIEW-282-r2

- **Issue:** #282 — стабильная идентичность сегментов стен (ADR Stage 1)
- **Ветка:** `issue/282-wall-geometry-model`, HEAD `3588284f` (после ребейза на `origin/dev` `30698d6e` — merge-base подтверждён, ветка полностью впереди `dev`)
- **ТЗ:** `docs/specs/282-stable-wall-segment-identity.md` (spec-review зелёный на r2, `2f30c481`)
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r2 · блокирующих циклов израсходовано 1 из 4 до этого вердикта
- **Предыдущий раунд:** `docs/reviews/CODE-REVIEW-282-r1.md`, красный, HEAD на тот момент `5adfdb5d` (SHA назван в документе — не находка). Этот SHA более не существует в истории ветки: после r1 ветка дважды уходила на ребейз (issue-комментарии `#282`, 19:33 и 21:12/21:21), причём второй ребейз (на `dev` `30698d6e`) потребовал реального разрешения конфликта — по словам автора, «post-rebase fixes also make direct backend Optimize cross the v7→v8 barrier, retain authored active-chain coordinates during conversion, and keep a rejected wall transaction atomic» — то есть новую продуктовую логику, а не только смену родителя.
- **Вердикт:** **красный**

## 1. Скоуп проверки

Раунд не локален по критериям PROCESS.md §2.10: ребейз на ушедший вперёд `dev`
с конфликтом, разрешённым новым кодом в самом identity-барьере — ровно та
подсистема, где r1 нашёл H1/H2. Поэтому разбор полный, но выполнен по факту
через дельту `9fc213c6..HEAD` (27 файлов, +1793/−1020: коммит `9fc213c6` — это
сам документ `CODE-REVIEW-282-r1.md`, его родитель `466a6765` — переименованный
рикбейзом эквивалент `5adfdb5d`, на котором получен вердикт r1). Дельта
покрывает: `src/houseplan-card.ts` (`_commitPhysicalGeometry`,
`_applyGeometryState`), `src/wall-segment-model.ts` (lineage hints, off-grid
guard), `src/plan-geometry-preflight.ts`, backend
`validation.py`/`wall_segment_model.py`/`websocket_api.py`, тесты и
mutation-gate. Остальные ~45 файлов исходного 62-файлового диффа r1 (import/export
remap, i18n, документация, backend-зеркало валидации помимо перечисленного)
дельтой не задеты — раздел «Унаследовано из r1» ниже.

## 2. Как проверялось — таблица гейтов

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit/frontend | `npm test` | 1331 тестов, **1329 passed, 1 failed, 1 skipped** — см. H1 |
| Build + sync бандла | `npm run build && npm run bundle:sync` + `cmp` трёх копий | зелёный, `dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/` побайтово идентичны |
| Docs fingerprint | `node scripts/check-docs.mjs` | зелёный (7 файлов, 10 внешних ссылок) — обязателен, дельта трогает `src/**` |
| Model invariants (синтетика) | часть `npm test` (`test/model-invariants.test.mjs`, `test/wall-segment-model.test.mjs`) | зелёный |
| Model invariants (реальная нагрузка) | `node scripts/model-invariants.mjs --config <large-house.mjs, до и после `commitWallSegmentModel`>` | зелёный до миграции («ссылки разрешимы, записи толщины находятся»), зелёный после; `--lattice`: 0.00% шума у узла |
| Smoke selection | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 31 прямое совпадение, 5 зарегистрированных связей, 7 слабых — вывод см. §4 |
| Golden | `npm run golden:verify` | **зелёный**, 129/129 сценариев, в т.ч. оба сценария из M1(r1) |
| Mutation gate | `node scripts/mutation-gate.mjs --check` | **зелёный**, 226/226 мутантов пойманы, включая 3 мутанта #282 (editor-commit/history-restore/optimize barrier) |
| Named/registered smokes | 31 прямых + 5 зарегистрированных = 36 запущено | **1 красный** (`smoke_open_passage.mjs`) — см. H2, остальные 35 зелёные |
| Backend pure (`tests_backend`) | не прогонялся мной — среда без `homeassistant`/`voluptuous`/`.venv-backend` (см. §6) | проверено чтением диффа `validation.py`/`wall_segment_model.py` + нового backend-теста, не исполнением |
| `pytest tests_backend` (полный, Linux CI) | не прогонялся | пре-релизный гейт, вне объёма код-ревью (§8) |
| Performance-профили (полный `performance_smoke`) | не прогонялся | пре-релизный гейт; целевой `npm run benchmark:wall-model` дельтой не задет (файл вне диффа) |

Дешёвые гейты (`tsc`, `build`, `check-docs`) зелёные. Но `npm test` сам по себе
**красный** — это не пре-релизный, а обязательный на каждом раунде гейт (§8,
§2.10), и он не проходит на предъявленном HEAD. Расширенные гейты (invariants,
smoke-select, golden, mutation-gate, целевые smoke) прогнаны, потому что дельта
меняет геометрию/ссылки на неё и барьер идентичности — именно то сочетание,
для которого §8 требует их «по необходимости». Golden и mutation-gate теперь
полностью зелёные (закрывают M1(r1) и M2(r1) — см. §5 «Закрытие раунда r1»); но
один из 36 запущенных смоков нашёл новую, не связанную с r1 регрессию (H2).

## 3. High — блокирующие находки

### H1. `npm test` красный: диагностика больше не соответствует контракту, который сама же проверяет

**Файл:** `test/open-passage-contract.test.mjs:70-74`, тест «all write/import
paths invoke the semantic passage validator».

**Воспроизведение:**

```
npm test
# ...
not ok 688 - all write/import paths invoke the semantic passage validator
  Expected values to be strictly equal:
  3 !== 2
  location: test/open-passage-contract.test.mjs:71
```

Тест жёстко ожидает ровно 2 вхождения `validate_opening_passages(` в
`custom_components/houseplan/websocket_api.py`. Последний коммит дельты,
`3588284f` («fix: preserve passage validation during wall migration»),
осознанно добавил третий вызов — `validate_opening_passages(candidate_config,
config_data.get("config"))` в `ws_plan_optimize` **до** барьера
`commit_wall_segment_model`, рядом с уже существующим вызовом **после** барьера
(строки 1655 и 1672; третий, старый вызов на 1327 — в `ws_config_set`). Это
осмысленное и корректное по существу исправление (см. §5, closure M-out
comment #16 в issue): без него Optimize возвращал общий
`wall_model_migration_blocked` вместо конкретного
`invalid_passage_fields`-кода на конфиге с некорректным passage ещё до миграции.
Но тест, фиксирующий количество мест вызова, не обновлён вместе с фиксом — он
писался под контракт «ровно 2 вызова» и не отражает намеренно добавленный
третий.

Это прямое нарушение дисциплины: `npm test` — гейт, обязательный **в каждом
раунде** (§2.10, §8), и он сейчас красный на предъявленном коде. Хендофф-
комментарий автора к `3588284f` (issue, 22:04:14) называет только узкий прогон
14 pure-passage-кейсов и process-gate, не полный `npm test` — расхождение
между «verified» и фактическим состоянием gate.

**Доказательство:** тест уже красный на HEAD, механически (`node --test
test/open-passage-contract.test.mjs`); падение детерминировано, не флуктуация.

### H2. AC7 нарушен: opening на обычной стене исчезает со Static-карточки после миграции в v8

**Файл:** `demo/smoke_open_passage.mjs` — не тронут этой дельтой (0 строк в
`git diff --stat origin/dev...HEAD`). Корень — `src/space-render.ts:217-278`
(`renderSpaceStatic`, единственный потребитель — `space-card.ts:770`, т. е.
`houseplan-space-card`, документированная в `ARCHITECTURE.md` «Second card»);
файл не тронут диффом #282 вовсе (`git diff --stat origin/dev...HEAD --
src/space-render.ts` → пусто).

**Воспроизведение:** на `origin/dev` (`30698d6e`, отдельный git-worktree, тот
же `npm run bundle:sync`):

```
node demo/smoke_open_passage.mjs → OK (все 13 проверок true)
```

На HEAD (`3588284f`), дважды подряд, детерминированно:

```
"staticCutsAndFillsPassage": false
FAILED (1)
```

Целевая диагностика (см. приложенный debug-прогон) показывает точный механизм:
после того как `_saveOpening()` проводит объект через
`_commitPhysicalGeometry` (v7→v8 baseline-replay из `c694f6ea`), опция
`passage-main` корректно получает `host: {kind:'wall', id:'wall-…', t:0.5}` —
барьер `hostRoomOpenings` (`src/wall-segment-model.ts:530-556`) тегирует
**любой** незакреплённый за partition opening (door/window/gate/passage
одинаково, без разбора по типу) таким `host` при миграции. Но
`renderSpaceStatic` (`space-render.ts:217-222`, `resolvedHosted`) резолвит
`opening.host` только через `resolvePartitionOpeningCompat` — функцию,
понимающую исключительно `host.kind === 'partition'`. Для нашего
`host.kind === 'wall'` резолюция не находится, `resolvedHosted` пуст для этой
записи, и `resolvedRawOpenings` (строки 274-278) на строке `return resolved ?
[materializePartitionOpening(...)] : []` **молча роняет** opening из всего
дальнейшего рендера Static-карточки — не только из tunnel-заливки прохода, а
из любой отрисовки (символ, вырез в стене, hit-box).

Сам код `src/houseplan-card.ts` (полный/Plan/View card) везде корректно
различает `host?.kind === 'partition'` от прочих случаев (8295, 8325, 8480,
12766, 12804, 12958) — регрессия локализована именно в `space-render.ts`,
единственном месте, которое ADR Stage 1 должен был обновить и не обновил, хотя
сам ТЗ прямо обещает это в AC7: «v8 → legacy… projection даёт текущим full,
**static**… consumers прежние inputs» с доказательством «projection snapshots
+ **existing geometry suite**» — а именно этот existing-geometry смок
(`smoke_open_passage.mjs`, часть suite с #157) и ловит нарушение AC7.

Blast radius не ограничен синтетическим passage из смока: `hostRoomOpenings`
единообразно тегирует **все** типы openings без partition-host при миграции,
значит после Optimize/любой структурной правки, переводящей пространство в
v8, **любой** door/window/gate/passage на обычной (не-partition) стене
перестаёт отображаться на `houseplan-space-card` — символ, вырез, hit-box.
Это прямой конфликт с J1/J2 из `docs/SCOPE.md` (план должен показывать, что
происходит и где) на реальной, документированной с v1.16.0 поверхности
продукта.

**Доказательство:** тест умеет падать — зафиксирована пара «зелёный на
`origin/dev` `30698d6e` / красный на HEAD `3588284f`» на байт-идентичном файле
теста, дважды воспроизведено. Причина локализована до конкретных строк (в
отличие от недиагностированных H1/H2 из r1) через целевой debug-прогон,
приложенный к разбору находки, а не только «зелёный/красный».

**Итог по H1+H2:** оба блокируют. H1 — процессный, лечится синхронизацией
числа в тесте с фактическим количеством вызовов (тривиально, но не сделано).
H2 — продуктовый: явное нарушение собственного AC7 задачи, широкий blast
radius на документированной поверхности продукта, которую эта дельта не
касалась и не тестировала.

## 4. Medium — по существу задачи

Новых находок Medium в этом раунде нет. Все четыре Medium из r1 закрыты — см.
§5 «Закрытие раунда r1». Отдельных находок вне скоупа нет — новый issue не
заводился.

## 5. Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** — guard #278 не отклоняет правку деградированного пространства | `_commitPhysicalGeometry` (`c694f6ea`, `src/houseplan-card.ts:7296-7313`) теперь вызывает `_checkSpacePhysicalGeometry` на `liveCandidate` **до** прохождения identity-барьера (`legacySafe`), а не после — восстановлен исходный порядок guard-а #278 | `node demo/smoke_wall_union_isolation.mjs` → OK, все 11 проверок `true` (перепроверено мной на HEAD, включая три ранее красные: `degradedPhysicalEditRejected`, `rejectedEditHasNoHistoryOrWrite`, `rejectedEditHasLocalizedToast`) |
| **H2** — 8 именованных structural-smoke красные | Переработан `_commitPhysicalGeometry`: для v7-пространства identity выводится из pre-edit baseline (`baselineSource`/`historyBefore`), а не из уже отредактированной геометрии, плюс lineage hints (`fixedTopologyWallLineageHints`) для сохранения ID при чистом split | Все 8 смоков (`smoke_resize_pointer_real_plan`, `smoke_wall_chain_thickness`, `smoke_unified_wall_tool`, `smoke_wall_face_overlap`, `smoke_edit_walk`, `smoke_editor_tabs`, `smoke_plan_snap_overlay`, `smoke_partition_openings`) перепрогнаны мной на HEAD — все зелёные |
| **M1** — golden baseline не обновлён под AC15-строку | Baseline не потребовался: фикстура `optimize-orphan-references-*` (`demo/golden/matrix.mjs:695-720`) уже v8/canonical, `Optimize` на ней не мигрирует ни одного сегмента, `r.wallSegmentsMigrated` = 0 → строка `gs.wall_segments_migrated` не рендерится, визуального различия нет | `npm run golden:verify` → 129/129 passed, включая `optimize-orphan-references-dark-en`/`-light-ru`; `demo/golden/baselines/**` не тронут диффом (подтверждено `git log` — пусто), что согласуется, а не противоречит |
| **M2** — AST/choke-point guard уже, чем заявлено в AC5/`TESTING.md` | Добавлены два новых именованных мутанта: `wall-identity-history-restore-barrier-bypassed` (Undo/Redo restore) и `wall-identity-optimize-barrier-bypassed` (`plan-optimizer.ts`), плюс переименован исходный в `wall-identity-editor-commit-barrier-bypassed` — все три известных writer-пути теперь поимённо покрыты | `node scripts/mutation-gate.mjs --check` → 226/226 `ok`, включая все три `wall-identity-*` мутанта (перепрогнано мной) |
| **M3** — `wall_model_client_outdated` не срабатывает на реалистичном echo-сценарии | `validate_wall_model_transition` (`custom_components/houseplan/validation.py:185-217`) получил новую ветку `old_model >= 8 and new_model >= 8 and geometry_changed`, сверяющую `_wall_catalog_projection` (только `wall_segments`) — расхождение поднимает `WallModelClientOutdatedError` с текстом «unchanged wall catalogue» | Новый тест `tests_backend/test_wall_segment_model.py::test_stale_client_echoing_v8_catalog_gets_the_named_error` — прочитан, логика соответствует описанному сценарию; **не исполнен** (см. §6, нет `homeassistant`/`voluptuous` в этой среде) — проверено чтением, не исполнением |
| **M4** — регрессионный тест #248 ослаблен без обновления фикстуры | `test/fixtures/optimize-storage-roundtrip.json` обновлена под полный v8-выход, `test/plan-optimizer.test.mjs:366` вернул строгий `assert.deepEqual(first.config, storageRoundtripFixture.expected.config)` вместо частичного сравнения только `poly` | Тест прогнан мной в составе `npm test` — проходит (часть 1329 passed); дифф `test/plan-optimizer.test.mjs` (`9fc213c6..HEAD`) показывает возврат полного `deepEqual` |

Все шесть находок r1 (H1, H2, M1-M4) закрыты предметно, не декларативно. Ни
одна из них не осталась открытой или не переоткрылась при моей перепроверке.

## 6. Унаследовано из r1

Из полного 62-файлового диффа r1 (`git diff origin/dev...5adfdb5d` — уже
недоступен напрямую как SHA, но содержательно эквивалентен диапазону, который
описывает `docs/reviews/CODE-REVIEW-282-r1.md`), эта дельта не касается и
поэтому **не переразобрано**, а принято на основании выводов r1 (документ
`CODE-REVIEW-282-r1.md`, SHA на котором получен вывод — `5adfdb5d`/содержательно
`466a6765` после ребейза):

- **Migration determinism/idempotence** (`deterministicWallSegmentId`,
  суффиксы при коллизии) — r1 §5, не задето дельтой (`test/wall-segment-model.test.mjs`
  дельта затрагивает только новые тест-кейсы, не эту логику).
- **Backend-зеркало валидации** — unique-id, owner-count, dangling refs,
  edge-geometry parity кроме нового `_wall_catalog_projection`-блока (см. §5
  M3) — r1 §5, файл `wall_segment_model.py` в дельте затронут (+48/-х строк),
  но это тот же lineage-код, что и H1/H2-фикс на фронтенде; backend-инварианты
  (owner-count/dangling refs) не изменены текстуально в дельте.
- **Import/export remap** (`import_export.py`, `secrets.token_hex(4)`) — не в
  дельте (`git diff --stat 9fc213c6..HEAD` не содержит `import_export.py`),
  наследуется из r1 §5 без переразбора.
- **i18n-ключи** (`toast.wall_model_migration_blocked`,
  `toast.wall_model_client_outdated`, `gs.wall_segments_migrated`,
  `wall_model.reason.*`) — не в дельте, наследуется из r1 §5.
- **Документация** (`WALL-THICKNESS.md`, `CANVAS.md`, `USER-GUIDE.{ru,}.md` —
  кроме `TESTING.md`, который в дельте, см. §5 M2) — наследуется из r1 §5.
- **`config-field-registry.mjs`** — не в дельте, наследуется.
- **Трейлеры и changelog структуры коммитов r1** — наследуется; трейлеры
  каждого нового коммита дельты проверены заново мной отдельно (см. §7).

Обоснование, почему это не требует переразбора несмотря на общий полный охват
раунда (§1): дельта физически не касается перечисленных файлов
(`git diff --stat 9fc213c6..HEAD`, приведён в §1), а находки этого раунда (H1,
H2) обнаружены и локализованы именно в затронутых дельтой файлах
(`test/open-passage-contract.test.mjs` тестирует код `websocket_api.py`,
который в дельте; `space-render.ts` хоть и не в дельте, но находка H2 —
следствие данных, которые генерирует именно delta-код `wall-segment-model.ts`,
т.е. вызвана дельтой, а не унаследованным кодом).

## 7. Что проверено и корректно

- **Трейлеры** — все 6 коммитов дельты (`c694f6ea`, `41d7a63f`, `c24792b6`,
  `35fce64a`, `38b03549`, `3588284f`) несут `Issue: #282`; четыре
  `User-Visible: yes` (`c694f6ea`, `35fce64a`, `38b03549`, `3588284f`) —
  каждый правит оба changelog в том же коммите (проверено `git show --stat`
  на каждом).
- **Backend-барьер Optimize** (`35fce64a`) — `ws_plan_optimize` теперь ведёт
  тот же v7→v8-барьер, что и frontend `_commitPhysicalGeometry`
  (`commit_wall_segment_model` + `too_large`-проверка после миграции +
  `WallSegmentMigrationError` в списке перехватываемых) — прочитано полностью,
  логика симметрична фронтенду.
- **Guard-переупорядочивание #278** (H1(r1)) — `legacySafe`-проверка на
  `liveCandidate` до барьера, restore на отказ — прочитано и подтверждено
  прогоном (см. §5).
- **Lineage hints** (`fixedTopologyWallLineageHints`,
  `adoptWallSegmentModelCandidateInPlace`) — прочитаны; логика различения
  `preferredIds`/`positionalIds` через `collinearOverlap` (защита от
  «застарелого ординала» при сплите) выглядит осмысленной и подтверждена всем
  доступным smoke/mutation набором.
- **Off-grid guard с authored path** (`38b03549`) — `wallModelOffGridValueCount`
  теперь учитывает `_path` (активная рисуемая цепочка) как базовую линию
  роста, не как новое отклонение — юнит-тест на это добавлен и проходит.
- **Три мутанта #282** (editor-commit/history-restore/optimize barrier) —
  реально пойманы (§2, §5 M2).
- **`npm run invariants`-эквивалент на реальной нагрузке** — прогнан на
  `demo/fixtures/large-house.mjs` (3 пространства, 1788 записей по прошлым
  измерениям Stage 0) до и после `commitWallSegmentModel`: ссылки разрешимы,
  записи толщины находятся, 0% шума у узла.
- **35 из 36 запущенных смоков** зелёные (см. §2, §4).

## 8. Чего не проверял и почему

- **`pytest tests_backend`, даже pure-subset** — среда исполнения не содержит
  `homeassistant`, а `custom_components/houseplan/__init__.py` безусловно
  импортирует `homeassistant.components.frontend`, поэтому даже
  не-`test_ha_*.py` модули (`test_validation.py`, `test_wall_segment_model.py`)
  не собираются без полного HA-пакета — это не селективный пропуск
  `conftest.py`, а полный отказ коллекции. `.venv-backend` в этой среде не
  существует (в отличие от cloud-agent окружения, описанного в `AGENTS.md`).
  M3 (§5) и общая корректность `validation.py`/`wall_segment_model.py`-диффа
  проверены **чтением**, не исполнением — честно назвать это ограничением, не
  «verified».
- **Полный `performance_smoke`** — пре-релизный гейт (§8); целевой
  `benchmark:wall-model` дельтой не затронут (файл вне диффа), поэтому не
  перепрогонялся отдельно в этом раунде — цифры из r1/хендоффа автора (167-284
  мс на p95 при бюджете 500 мс) остаются в силе, так как измеряемый код не в
  дельте.
- **7 «слабая связь» смоков** (`smoke_align_guides`, `smoke_card_tool_conflict`,
  `smoke_editor_gestures`, `smoke_esc_dialogs`, `smoke_island_rooms`,
  `smoke_optional_space_model`, `smoke_pan_any_zoom` — связь только по
  `_path`) — не прогонялись: методология идентична r1 (§6 её документа) — уже
  найденных блокирующих находок достаточно для возврата, и один из 36 более
  сильно связанных смоков (`open_passage`) уже красный. Автору стоит
  прогнать все 7 вместе с полным набором перед следующей сдачей.
- **Глубокий line-by-line аудит `buildAtoms`/lineage-логики
  (`src/wall-segment-model.ts`, весь диапазон 218 изменённых строк)** — не
  выполнен formal-proof, только чтение ключевых веток плюс полное
  black-box-покрытие (36 смоков, 226 мутантов, 129 golden, полный `npm test`
  кроме H1). Смок `smoke_open_passage.mjs` — прямое доказательство, что
  black-box-покрытие не исчерпывающее; глубже эту логику не разбирал, так как
  найденных H1/H2 достаточно, чтобы вернуть задачу автору (тот же принцип, что
  в r1 §3 «проверять глубже уже не требуется по методологии»).

## 9. Резюме

Красный вердикт, второй подряд, но по существу другим находкам, чем r1: все
шесть находок r1 (2 High + 4 Medium) закрыты предметно и перепроверены
исполнением (кроме M3 — чтением, backend-харнесс недоступен). Однако именно
дельта, закрывшая r1, внесла две новые блокирующие находки:

- **H1** — `npm test` красный прямо сейчас: тест на количество вызовов
  `validate_opening_passages(` не обновлён под намеренно добавленный третий
  вызов из последнего коммита дельты. Механически тривиально, но нарушает
  обязательный на каждом раунде гейт.
- **H2** — нарушение собственного AC7 задачи: `houseplan-space-card` теряет
  **любой** wall-hosted opening (не только passage) после миграции
  пространства в v8, потому что `src/space-render.ts` — единственный
  нетронутый диффом #282 потребитель `opening.host` — не различает
  `host.kind === 'wall'` от `host.kind === 'partition'` и молча роняет
  нерезолвленные openings из рендера. Реальный blast radius на
  документированной поверхности продукта, конфликтующий с J1/J2
  `docs/SCOPE.md`.

Задача возвращается в «В разработке». Оба фикса локальны и не должны требовать
повторного полного разбора всей подсистемы в r3, если дельта останется
локальной к `websocket_api.py`-тесту и `space-render.ts`; но `space-render.ts`
до сих пор не в диффе #282 вовсе — стоит проверить на этом же файле и другие
пути, потребляющие `opening.host` (hidden-isometric, если он существует
отдельно), а не только `houseplan-space-card`.
