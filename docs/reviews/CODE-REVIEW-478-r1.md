# CODE-REVIEW-478-r1

- **Issue:** #478 — отказ от сущности «черновик контура» (`room_drafts`), wall model v9 → v10
- **Ветка:** `issue/478-remove-room-drafts`
- **SHA материала:** `1cadd520c0658e14ec8fd1410241e55ddbac21e1` (сверено `git rev-parse HEAD` перед выводом итога)
- **Диапазон:** `git diff origin/dev...HEAD` — 154 файла, +3515/-4309
- **ТЗ:** `docs/specs/478-remove-room-drafts.md`, ревью ТЗ зелёное (`docs/reviews/SPEC-REVIEW-478-r1.md`, r1, 0 циклов)
- **Заход:** r1 · блокирующих циклов израсходовано **0 из 4** до этого вердикта

## Вердикт

**Красный.** Найдено High: 2 (обе — контракты миграции/защиты модели, заявленные AC1/AC2), Medium: 4 (все в скоупе задачи), Low: 2.

## Скоуп

Полный разбор (не по дельте — это r1). Задача убирает persisted `room_drafts`, поднимает модель до v10 в TS и Python, переносит каждый принятый клик цепочки сразу в `partitions`, и при замыкании комнаты атомарно поглощает совпадающие partitions (`reconcileCoincidentPartitions`). Это ровно тот случай, где "работает ли оно вообще" зависит от точного соответствия TS/Python логики миграции, атомарности поглощения и того, что golden/смоки реально что-то доказывают, а не молчат.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Дешёвые гейты | подтверждены зелёным Validate на этом SHA: https://github.com/Matysh/houseplan-card/actions/runs/34041344030 (jobs `frontend`, `backend`, `hacs`, `hassfest`, `process-gate` — success; `smoke`/`golden`/`performance_smoke` — **skipped**, обычный push не `heavy`) | не перегонял typecheck/test отдельно — доверяю CI на этом SHA |
| `npm run build` | напрямую | зелёный, 15.6s |
| `npm run bundle:sync` + `cmp` 3 копий | напрямую | побайтно совпадают (dist / custom_components/houseplan/frontend / demo/srv/assets) |
| `node scripts/check-docs.mjs` | напрямую (diff трогает `src/**`) | «Documentation checks passed (7 files, 12 external links)» |
| `node scripts/model-invariants.mjs` | на синтетическом large-house конфиге (`demo/fixtures/large-house.mjs`) и на мигрированном v9→v10 фикстуре (`test/fixtures/282-wall-identity-parity.json`, прогнан через `commitWallSegmentModel`) | «Инварианты выполнены» на обоих |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | напрямую | 75 прямых совпадений, 1 зарегистрированная связь (`smoke_optimize_coincident_partition` ← `reconcileCoincidentPartitions`), 37 слабых |
| Целевые смоки (17 из выборки: `room_autoclose`, `v8_draft_write`, `free_walls`, `unified_wall_tool`, `plan_snap_overlay`, `wall_face_overlap`, `active_chain_ink`, `wall_chain_thickness`, `wall_draw_click`, `wall_chain_merge`, `wall_junctions`, `zero_wall_migration_unblocked`, `edit_walk`, `merge_split`, `island_rooms`, `optimize_coincident_partition`, `plan_drawing_repairs`) | `node demo/smoke_<name>.mjs` после свежей сборки | все 17 зелёные |
| `npm run golden:verify` | напрямую | **145 passed / 16 different** — см. находки; проверено, что вызвано этим диффом только частично (см. ниже) |
| `python -m pytest tests_backend` | — | **не прогонял**: `.venv-backend` в этой среде нет, `python3 -c "import homeassistant"` падает `ModuleNotFoundError`. Доверяю зелёному backend-джобу CI, но независимая параллельная проверка миграции backend показала расхождение с TS (см. High-1) без запуска pytest — прямым исполнением обоих движков |
| Мутанты `wall-draw-full-preflight-again`, `current-rejected-physical-write-keeps-optimistic-wall` | `node scripts/mutation-gate.mjs --id=<id>` (оба смысла проверены отдельным агентом) | чистый прогон зелёный, с мутантом — красный на обоих |
| `npm run inventory` / полный `mutation-gate` | — | не прогонял: требует Python-окружение (часть guard'ов — `pytest`), которого здесь нет; это не мешает вердикту, т.к. два новых/переименованных мутанта проверены точечно |

### Что НЕ проверял и почему

- Полный `pytest tests_backend` — среда без `homeassistant`. Компенсировано прямым запуском Python-модуля миграции вне HA-обвязки.
- Полная матрица golden (161 сценарий) прогонялась целиком один раз; для 16 расхождений отдельно проверял, вызваны ли они этим диффом (см. ниже) — не по касательной, а сравнением с `origin/dev` на этом же дереве зависимостей.
- Performance-профили `large-house-*` не гонял отдельно (`benchmark_wall_draw_click` — только через мутационный гейт); полный performance smoke — предрелизный гейт.

## Golden: что вызвано этим диффом, а что нет

`golden:verify` в режиме `--mode=verify` не принимает `--scenario`, поэтому расхождения перепроверялись `--mode=capture --scenario=<id>` на HEAD и на чистом `origin/dev` (worktree, тот же `node_modules`, тот же Chromium — `package-lock.json` не менялся). Дважды столкнулся с нестабильностью самого харнесса (см. ниже) и учёл её отдельными повторными прогонами.

| Сценарий | Вердикт | Как проверено |
|---|---|---|
| `isometric-geometry-view-dark/light`, `isometric-live-layers-dark`, `isometric-touch-kiosk-dark`, `isometric-stage3-*` (5), `decor/general/device-ripple/space-room-color-popover-*` (4) | **Не вызвано этим диффом** — расхождение с эталоном идентично на `origin/dev` (совпадающий `actualSha256` в изолированном `--scenario`-прогоне на обеих ветках для проверенных представителей; для цветовых поповеров дополнительно подтверждена нестабильность — три изолированных прогона одного и того же дерева дают три разных sha при стабильном большом `diffRatio`, т.е. это существующий шум/дрейф эталона, не имеющий отношения к #478) | сравнение sha256 HEAD vs `origin/dev`, повторные прогоны на стабильность |
| `isometric-large-warm-remount-dark` | **Не вызвано этим диффом** — при изолированном `--scenario` прогоне HEAD и `origin/dev` дают идентичный sha; расхождение в самом первом полном прогоне было артефактом порядка сценариев в общем батче (переменное «тёплое» состояние демо-страницы), а не кода | то же сравнение, плюс контрольный повторный прогон полного батча не проводился (дорого) — вывод basируется на изолированном сравнении, что достаточно для причинности, но не исключает нестабильности самого батч-режима как отдельного явления |
| `wall-junctions-plan-preview-light` | **Вызвано этим диффом — реальная находка**, см. Medium-1 ниже | стабильный `diffRatio` (≈0.0009 на dev против ≈0.0024 на HEAD в нескольких повторах каждой стороны, при том что sha «шумит» из-за несвязанного дрожания пикселей в другом месте кадра) |

## Находки

### High-1 — TS и Python дают разные ID и разные решения accept/reject на одном и том же legacy JSON (нарушение AC1/§7.2)

Файлы: `src/wall-segment-model.ts:723-780` (`migrateRoomDraftsToPartitions`) vs `custom_components/houseplan/wall_segment_model.py:621-670` (`_migrate_room_drafts_to_partitions`). Проверено прямым запуском обоих движков на одинаковом JSON (компилированный `test-build/wall-segment-model.js` против `wall_segment_model.py` в обход HA-обвязки), не по описанию, а по факту выполнения:

1. **`cm: null` в сегменте черновика.** TS: `Number(segment?.cm)` → `Number(null) === 0`, конечно и в диапазоне → **принимается**, партиция с `cm: 0`. Python: `float(segment["cm"])` на `None` бросает `TypeError`, пойман общим `except` и переброшен как `zero-length` → **отклоняется**. Один и тот же документ мигрирует на фронтенде и убивает запись на бэкенде.
2. **`draft.id` как явный JSON `null` (не отсутствующий ключ).** TS: `String(draft?.id || '')` даёт `''` независимо от того, был ли ключ `null`, отсутствовал или был пуст. Python: `draft.get('id', '')` возвращает **дефолт только при отсутствующем ключе**; при `"id": null` возвращает `None`, и f-строка кладёt в соль буквальное `"None"`. Проверено: при отсутствующем `id` сгенерированные ID совпадают (`wall-ertogsjkok3uxzjjhuco` == `wall-ertogsjkok3uxzjjhuco`), при явном `"id": null` — расходятся (`wall-ertogsjkok3uxzjjhuco` vs `wall-657kjbohfjpfg6vyuvu3`). Ровно тот класс входа, который называет сам §15.1.3 ТЗ («pre-v8 draft без ID»).
3. **Допуск нулевой длины ребра.** TS зовёт `samePoint(a, b, eps = 0.001)` (`src/logic.ts:426`) — тот же helper, что используется по всему проекту как «действующая legacy fail-closed политика» для вырожденных отрезков. Python сравнивает `a == b` как списки — **без допуска вообще**. Проверено на `a=[0,0], b=[0.0005,0.0005]` (расстояние ≈0.0007, внутри допуска TS): TS кидает `zero-length`, Python принимает и сохраняет партицию длиной 0.0007 нормализованных единиц. Это отдельно неверно и относительно самого Python (не использует объявленный допуск), не только относительно TS.

**Чем краснеет:** прямой запуск (см. выше) — не тест из репозитория, а ручное исполнение обоих движков на трёх конкретных входах; воспроизводится детерминированно. Существующий тест с меткой AC1 (`test/wall-segment-model.test.mjs:58-89` и `tests_backend/test_wall_segment_model.py:379-401`) эти три входа не покрывает и для сгенерированного fallback ID проверяет только `startsWith('wall-')` — т.е. не способен поймать даже полное расхождение значений ID между языками, только его отсутствие.

**Почему High, а не Medium:** AC1 прямо требует «generated IDs совпадают в TS/Python» и «malformed input обрабатывается одинаково с действующей legacy политикой fail-closed» (§7.2 ТЗ) — это ядро обязательного условия отказа задачи (единая идентичность через миграцию), а не побочная деталь. Реальный legacy-экспорт с `cm: null` или `"id": null` в одном из полей (оба валидны JSON, оба правдоподобны как результат кривого экспорта/бэкапа) мигрирует по-разному в зависимости от того, какой движок обработал документ первым — ровно то, чему AC1/§7.2 посвящены целиком.

### High-2 — устаревшая v9-запись поверх уже мигрированного v10-документа не отклоняется (нарушение AC2/§6.2)

Файлы: `custom_components/houseplan/validation.py:175-216` (`validate_wall_model_transition`), `:111-131` (`_catalog_coupled_wall_geometry_projection`), `:1867-1881` (`_config_wall_segment_invariants`), `custom_components/houseplan/websocket_api.py` (обработчик `config/set`, строки ~1570-1610).

Сценарий: сохранённый документ — `model_version: 10`, без `room_drafts`. Устаревший v9-клиент, ничего не знающий о миграции, отправляет `config/set` с `model_version: 9` и восстановленным/локально закешированным `room_drafts`, при этом `rooms`/`walls`/`open_spans` не меняются (обычный «эхо» неизменённого контура — типичный случай для клиента, который просто открыл старую вкладку и сохранил несвязанную правку).

Трассировка:
- `_catalog_coupled_wall_geometry_projection` (validation.py:111-131) по своей собственной документации **намеренно не смотрит на `room_drafts`** («Drafts… carry their own ids… None of those independent objects requires a different contour wall_segments catalogue») — это верно для дизайна v8, но именно `room_drafts` теперь и есть поле, чьё возвращение как раз обязано быть отклонено (§6.2).
- Значит `contour_geometry_changed` (validation.py:183-186) — `False`.
- Единственная ветка, которая может бросить `WallModelClientOutdatedError` для `8 ≤ new_model ≤ old_model`, целиком под условием `contour_geometry_changed` (validation.py:199-215) — при `False` не выполняется вовсе.
- `_config_wall_segment_invariants`'ин room_drafts-чек (validation.py:1880-1881) смотрит на **заявленный отправителем** `model_version ≥ 10` — у честно устаревшего клиента он `9`, проверка не срабатывает.
- Обработчик `config/set` (websocket_api.py, ~1570-1610) вызывает только `validate_wall_model_transition` + `CONFIG_SCHEMA` + маркерные валидаторы — **не** вызывает `commit_wall_segment_model`/миграцию. (Миграция вызывается только в обработчике `houseplan/optimize`, websocket_api.py:1931 — другая команда, не обычное сохранение.)

Итог: документ с `model_version: 9` и восстановленным `room_drafts` **проходит и перезаписывает** уже мигрированный v10-документ — ровно то, что §6.2 запрещает текстом («Поле нельзя молча отбросить, частично принять или вернуть в current config», «backend отклоняет весь write существующей ошибкой `wall_model_client_outdated`»).

Косвенное подтверждение из самого диффа: `git diff origin/dev...HEAD -- tests_backend/test_wall_segment_model.py` показывает, что прежний тест `with_draft` (устаревшая запись, добавляющая новый `room_drafts`, ранее корректно **проходившая** `validate_wall_model_transition` без исключения) был просто переименован/заменён на `with_partition` с тем же исходом «проходит», а не переведён в утверждение об отказе. Единственный новый тест на `room_drafts`-инвариант (`test_wall_segment_model.py`, вокруг `validation.py:1880`) отправляет конфиг, сам заявляющий `model_version: 10`, — не реалистичный случай «хранится v10, прислан v9».

**Чем краснеет:** прочитано и прослежено по коду (`проверено чтением, не исполнением`) — конкретный вход построен явно (см. выше), путь трассирован до персиста без единого блокирующего условия. Не запускал pytest (среда без `homeassistant`), но трассировка не зависит от рантайма HA — это чистая проверка функций модуля `validation.py`.

### Medium-1 — golden-харнесс не переименован вслед за полем, из-за чего сценарий превью толщины цепочки реально сломан (в скоупе, `demo/golden/harness.mjs`)

`demo/golden/harness.mjs:1287,1289,1308` всё ещё пишет `card._activeDraftId = null` и `card._draftSegmentCms = [...cms]`. Этот диф переименовал соответствующие поля продукта в `_activeWallChainId`/`_wallChainSegmentCms` (проверено — ни одного `_activeDraftId`/`_draftSegmentCms` не осталось в `src/*.ts`), но эти два места в харнессе — тот же файл, который этот дифф уже правил в других местах (замена `room_drafts` → `partitions` в фикстурах) — остались нетронутыми.

Сценарий `wall-junctions-plan-preview-light` (matrix.mjs:422-427) использует `wallJunctionPreview: { cms: [12], cm: 24 }` — специально с разными значениями, чтобы отличить «превью показывает толщину сегмента» от «превью показывает толщину инструмента по умолчанию». Поскольку харнесс пишет в несуществующее более поле, рендерер (который реально читает `this.host._wallChainSegmentCms`, подтверждено чтением кода рендер-пути) получает `undefined` и откатывается на равномерную `24`, а не заявленные `12`.

**Чем краснеет:** эмпирически. `npm run golden:verify` на HEAD даёт для этого сценария `status: different`, стабильный `diffRatio ≈ 0.0024` (2517 px) в трёх повторных изолированных прогонах (sha «шумит» из-за несвязанного дрожания в другом месте кадра, но diffRatio стабилен). На `origin/dev` (тот же baseline, тот же Chromium, `--scenario`-прогон в чистом воркdереве) тот же сценарий даёт стабильный `diffRatio ≈ 0.0009` (933 px) в двух повторах. То есть дифф **увеличивает** расхождение с эталоном примерно втрое, воспроизводимо, и это расхождение никто не объяснил и не принял (`golden:verify` в CI на этом SHA не запускался — job `golden` был `skipped`, обычный push не `heavy`; в хендофф-комментарии автора `golden:verify` не упомянут вовсе).

Нарушает: §12.6/AC14 ТЗ («визуальный контракт намеренно не меняется… любое отличие требует отдельного объяснения»/«golden:verify» как обязательное доказательство) — расхождение есть, объяснения и `--reviewed`-приёмки нет.

### Medium-2 — путь поглощения комнаты не атомарен при вырожденном `_spaceModel()` (в скоупе, риск для AC9)

`src/houseplan-editor-runtime.ts:6856` (`_applyWallFaceBatch`) и `:7010` (`_commitRoom`) — новый (для 6856) и существующий (для 7010, оба зеркальны) паттерн: после того как `sp.rooms` уже мутирован (новая комната добавлена, `sp.walls` переприсвоен), код берёт свежий `_spaceModel()` для запуска `reconcileCoincidentPartitions` и на `if (!reconciledModel) return;` **выходит без вызова `_commitPhysicalGeometry(..., before)`** — то есть без коммита и без отката к `before`. `sp` — живая ссылка внутрь `this.host._serverCfg` (не копия), так что уже внесённая мутация остаётся в памяти неподтверждённой и неоткаченной.

Это расширение уже существовавшего на `origin/dev` паттерна (`if (!updatedModel) return;`, строка 6820, существовала и раньше как `:7273` в `origin/dev`) — но строка 6856 добавлена именно этим диффом для шага поглощения, то есть это новый повторный случай той же дыры, не унаследованный один-в-один. Триггер («когда `_spaceModel()` реально возвращает `null` в этой точке») не продемонстрирован ни тестом, ни ручным прогоном — оцениваю как маловероятный, но реальный пробел относительно буквального текста AC9 («Cancel, validation failure, save conflict и лимит оставляют исходные partitions и session chain без partial room»).

### Medium-3 — AC13 (фикс-пойнт Optimize сразу после accept) не доказан через реальный путь редактора

Тесты `test/optimize-hidden-obstacles.test.mjs:26-52` и релевантный кейс `test/coincident-partitions.test.mjs` проверяют `partitionsReconciled === 0` на **уже смигрированных/подготовленных** данных через прямой вызов `reconcileCoincidentPartitions`/`optimizePlans`, не через настоящий путь редактора (`_applyWallFaceBatch`/`_commitRoom`). Единственный смок, реально проходящий через путь редактора с `allowCoincidentPartitions: true` — `demo/smoke_unified_wall_tool.mjs` (`acceptConsumesCoincidentPartitions`) — проверяет отсутствие partitions сразу после accept, но **не вызывает Optimize после** и покрывает только тривиальный случай «поглощается всё целиком» (без partial overlap, без чужой ранее существовавшей partition, без `cm ≤ 0`, без проёма).

Ни один mutation-witness не целится именно в `allowCoincidentPartitions`-ветку `reconcileCoincidentPartitions` (единственную ветку, которая реально используется при создании комнаты — она отличается от ветки Optimize отключением `blockedByPartition` и допуском `cm ≤ 0`). AC13 буквально требует «мутант, оставляющий coincident partition либо draft, краснит gate» — по правилу код-ревью (PROCESS.md §2.7) защитный AC без названного свидетеля в дорогом гейте (smoke) — Medium, а не примечание, независимо от того, сколько мутантов принесла задача в целом.

### Low-1 — мёртвые поля `redundantDraftsRemoved`/`removedDrafts` в моке смока

`demo/smoke_preflight_diagnostics.mjs:53,56` (файл не тронут этим диффом) содержит литерал отчёта Optimize с полями `removedDrafts`/`redundantDraftsRemoved`, которых в реальном типе отчёта больше нет (`grep` по `src/*.ts`/`custom_components/**/*.py` на `redundantDraftsRemoved` — ноль совпадений). Не типизируется (untyped `.mjs`), не ловится typecheck; безвредно на рантайме, но нарушает §12.6 ТЗ («мёртвые ключи удалить… один вариант должен быть одинаков в… tests») буквально по букве, раз задача уже прошлась по всем остальным упоминаниям поля.

### Low-2 — churn ID активной цепочки при отклонённом клике

`src/houseplan-editor-runtime.ts` — при неудачном клике внутри цепочки `_clearGeometryGesture()` обнуляет `_activeWallChainId`, а следующий клик генерирует новый id (`_activeWallChainId ||= 'chain-...'`) даже когда `_activeWallChainPartitionIds`/`_path`/`_wallChainSegmentCms` корректно откачены к `before`. Данные не теряются, только внутренний id меняется без надобности — может вызвать лишний re-key в Lit по `_activeWallSourceKey`, но не потерю данных. Снимаю с записью: не блокирует и не имеет наблюдаемого пользователем следствия по коду рендера.

## Что проверено и корректно

- Основная геометрия поглощения (`reconcileCoincidentPartitions`, `src/coincident-partitions.ts:203-502`): breakpoints признаются поглощаемыми только при доказанном owner+kind+cm match, непоглощённые остатки корректно переизлучаются как partitions с ID по канонической `a`/`b`-ориентации (не зависящей от направления исходной записи) — соответствует §9.3. Openings либо полностью переезжают на room-wall, либо остаются на верном остатке, либо (fail-closed) всё поглощение партиции отменяется — проверено чтением и подтверждено смоком `smoke_optimize_coincident_partition` (`applyUsesOneAtomicWrite`, `undoRestoresHostedPartition`: true).
- Session-only контракт активной цепочки (§8): первый клик не пишет config, каждый следующий даёт один partition + один history/save; переключение инструмента/режима/пространства и Esc завершают цепочку без изменения уже сохранённых partitions — прослежено по коду (`houseplan-editor-runtime.ts`, `houseplan-card.ts`) и подтверждено смоками `smoke_v8_draft_write` (`rejectedWriteRollsBackOptimisticWall`), `smoke_wall_chain_thickness` (`toolChangeOnlyEndsSession`).
- Быстрый путь клика (#461) сохранён и не деградировал к полному preflight — `demo/benchmark_wall_draw_click.mjs` считает реальные счётчики (`fullSpacePhysicalChecks === 0`, `localPhysicalChecks === 1`), мутант `wall-draw-full-preflight-again` красит именно этот тест.
- i18n: все 4 локали (`de/en/fr/ru`) синхронно убрали одни и те же 14 draft-специфичных ключей и добавили одни и те же 3 новых; `test/i18n.test.mjs` реально проверяет парность ключей набором `deepEqual`.
- Миграция `room_drafts` → `partitions` для «чистого» входа (существующий ID, валидный `cm`, без null-полей) даёт байтово идентичный результат в TS и Python — подтверждено общими фикстурами `test/fixtures/282-wall-identity-parity.json` и `319-orphan-span-migration.json`, используемыми **и** в юнит-тесте, **и** в pytest с одинаковыми ожиданиями.
- `check-docs`, три копии бандла, `model-invariants` на двух конфигурациях (синтетический large-house и мигрированный многокомнатный фикстур) — зелёные.
- CONFIG-COMPATIBILITY.md/CHANGELOG (RU+EN)/USER-GUIDE.ru.md корректно описывают новое поведение согласованными терминами («партиция», «сессионная цепочка», отсутствие resume) — сверено построчно с диффом кода.
- 17 целевых смоков из прямых совпадений выборки — зелёные (полный лог приложен к прогону в CI-логах сессии ревью, не коммитился).

## Итог

High-1 и High-2 — оба про буквальные, явно заявленные обязательные условия задачи (единая идентичность миграции между движками; отказ устаревшей записи поверх мигрированного документа), а не про периферийную деталь. Оба воспроизведены конкретным входом/трассировкой, а не общими словами. Medium-находки все в скоупе (тот же диф правил эти самые файлы) и чинятся в этой же задаче без отдельного цикла. Возврат автору.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/478-remove-room-drafts`, коммит `1cadd520c065` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `fa6d69e796845ebcaf2da97888c1d9589906e001`
  ```
  git log --all --format='%H %T' | grep fa6d69e79684
  ```
- ТЗ `docs/specs/478-remove-room-drafts.md`, блоб `70719ed585a993825720f90a2483fa760747bb06`
  ```
  git log --all --find-object=70719ed585a993825720f90a2483fa760747bb06 -- docs/specs/478-remove-room-drafts.md
  ```
