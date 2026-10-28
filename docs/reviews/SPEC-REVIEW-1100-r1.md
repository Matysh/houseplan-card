# SPEC-REVIEW-1100-r1

Issue: #1100 · этап: spec · трек: ask · заход r1 · блокирующих циклов 0/4
Материал: тело issue #1100, SHA body `1a2e1c9630601c97474fa9e1cae97c3a03e9f73bba8f4a3cf7a9d2f901084ab6`,
основа ТЗ — dev `09bda8dbee8b50577bfc4affc332b8cda914f5b4` (рабочая копия на этом SHA).

## Скоуп

Оценивается ТЗ в разделе `## ТЗ` тела issue #1100: быстрая дорожка восстановления
истории геометрии (Undo/Redo) для шагов без физического изменения (подложка
`plan_transform`, лестницы `stairs`) и адресная (не blanket) инвалидация
кэшей `_wallUnionPool`/`_physicalBodiesPool` при восстановлении физического шага.
Обслуживаемая работа — J6 из `docs/SCOPE.md` («Keep the plan true as the home
evolves» — редакторы плана, drag/resize, undo/redo как часть поддержания
актуальности плана); сценарий и наблюдаемый результат описаны прямо в ТЗ.
Кодовый Validate на этом этапе не требуется (реализации нет).

## Как проверялось

Статически, без изменения предмета ревью: прочитаны обязательные источники
роли (`docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`), тело issue
и комментарий-оценка автора (`sources-1.md`, `sources-2.md`). Для каждого
технического утверждения проблемы и каждого AC сверены точные координаты кода
на материале (SHA `09bda8dbe`, текущая рабочая копия, идентичен указанной в
ТЗ основе):

- `src/houseplan-editor-runtime.ts:2023-2032` (`_restoreGeometryStateLocal`) —
  подтверждено: ставит `_wallUnionCache = null` и `_physicalBodiesCache = null`
  безусловно.
- `src/houseplan-card.ts:1893-1899` и `:1943-1946` (сеттеры `_wallUnionCache`/
  `_physicalBodiesCache`) — подтверждено: `value === null` чистит весь
  `_wallUnionPool`/`_physicalBodiesPool` (все этажи), а не только ключ
  восстановленного пространства.
- `src/houseplan-editor-runtime.ts:2380-2448` (`_applyGeometryState`, в ТЗ —
  `:2385-2445`) — подтверждено: `physicalChanged` (строки 2401-2402) уже
  вычисляется через `spacePhysicalGeometryFingerprint(before/target)`, но не
  используется, чтобы пропустить `commitWallSegmentModel` (2418) и
  `_regSignature`/`_maybeRebuildDevices` (2438) — они гейтятся только
  `decorOnly`. Это и есть корень проблемы, который ТЗ предлагает исправить
  третьим пунктом контракта.
- `src/plan-geometry-preflight.ts:124-136` (`spacePhysicalGeometryFingerprint`)
  — подтверждено: отпечаток строится по `id, cell_cm, rooms, walls,
  wall_segments, open_spans, openings, partitions, wall_columns`; `stairs` и
  `plan_transform` в него не входят — утверждение ТЗ «отпечаток их не читает»
  точное.
- `src/decor-history-restore.ts:7-21` (`restoreDecorOnlyHistory`, `withoutDecor`,
  `guarded`) — подтверждено: `withoutDecor` вырезает только `decor`, `stairs`
  и `plan_transform` остаются в сравнении `contentFingerprint`, поэтому шаг
  подложки/лестниц не проходит decor-only и уходит в strict lane — ровно то,
  что описывает раздел «Проблема» ТЗ. `guarded()` (`nodeMove`,
  `wallChainSeedIds`, `roomReferences`) — тот же список, что в контракте п.3 и
  AC4; переиспользование существующей функции, а не новое определение.
- `src/geometry-history-state.ts:16-40` (`SpaceGeometryState`) — подтверждено:
  `stairs?` и `plan_transform` — поля состояния шага, как написано в разделе
  «Модель данных и миграция».
- `src/houseplan-card.ts:1905-1946` (счётчики `_floorCacheBuilds`,
  LRU-пулы `_wallUnionPool`/`_physicalBodiesPool`) и `:9176-9204`
  (`_wallUnionGeometry`, инкремент `_floorCacheBuilds.wallUnion` только на
  реальный промах по ключу) — подтверждено: существующий счётчик пригоден как
  измеримый oracle для AC1/AC3 без новой инфраструктуры.
- `src/houseplan-editor-runtime.ts:2381` (`allowHistoryBoundaryRepair`
  параметр `_applyGeometryState`) — подтверждено: существует, контракт п.4
  («не меняется») корректен.
- Файлы плана автотестов существуют на материале: `test/geometry-history-refusal.test.mjs`,
  `test/decor-history-restore.test.mjs`, `demo/smoke_floor_cache_reuse.mjs`,
  `demo/smoke_backdrop.mjs`, `demo/smoke_stairs.mjs`,
  `demo/smoke_wall_chain_history.mjs`, `demo/smoke_node_history_context.mjs`,
  `demo/smoke_geometry_history_refusal.mjs`,
  `demo/smoke_selective_invalidation_history0.mjs`/`history320.mjs`,
  `docs/analysis/1075-editor-command-latency.md` — ни один тест/документ плана
  не выдуман, все — реальные существующие файлы, которые задача расширяет, а
  не создаёт с нуля (кроме нового `test/geometry-history-restore.test.mjs`,
  явно помеченного как новый).
- `tests_backend/test_wall_node_*.py`, `tests_backend/test_junction_*.py` —
  подтверждено: фильтр AC7 `-k "wall_node or junction"` действительно
  отбирает существующие серверные тесты смежной подсистемы (`#843` node
  commands), корректный регрессионный периметр для «нодовые команды не
  трогаются» (`nodeMove` остаётся на server-transaction дорожке, `:2385`).
- `_modelCache`/`host._frame` (houseplan-card.ts:4150, :6361) — проверено:
  это одноключевые кэши текущего пространства, а не межэтажные LRU-пулы;
  ТЗ обоснованно не включает их в скоуп инвалидации — других blanket-сбросов
  по всем этажам, кроме двух названных пулов, в `_restoreGeometryStateLocal`
  нет.

Адресная проверка осуществимости не выявила ни одного расхождения между
описанием проблемы/контракта и фактическим кодом материала: каждая строка,
каждое имя функции, каждое поле состояния и каждый файл плана тестов
резолвятся именно так, как написано в ТЗ. Открытых непокрытых технических
вопросов, которые оправдывали бы дополнительный negative-input прогон, не
обнаружено — адресные build/test/gate не запускались (не требуются для этапа
spec при отсутствии такого вопроса).

## Обязательные разделы (§7.1)

Присутствуют все: сценарий · что человек увидит до/после · проблема · скоуп
и не-скоуп · контракт поведения · UX · модель данных и миграция · i18n ·
критерии приёмки AC1–AC7 с доказательством · план автотестов · риски · откат
· release-артефакты · блок «принято предположительно». Формально ТЗ
комплектно (DoR, §2.5).

## Находки

Находок нет. Каждое утверждение раздела «Проблема» проверено построчно против
материала и подтвердилось; каждый AC называет конкретный, существующий способ
доказательства (unit-файл, smoke-файл, backend-фильтр) и наблюдаемый
измеримый результат (счётчик, факт вызова, побайтное равенство); скоуп и
не-скоуп разводят эту задачу с пересекающимися #1093/#1098/#1099/#1073/#1075
по конкретному критерию (дорожка восстановления vs проекция ключа этажа vs
коммит vs структурная история маркеров vs decor-only семантика), с явным
порядком разрешения конфликта общего helper'а с #1099. Технических вопросов,
которые стоило бы адресовать владельцу, не осталось — все пункты раздела
«принято предположительно» решают исполнительские детали (механизм
инвалидации, критерий быстрой дорожки, расположение общего helper'а), не
видимое пользователем поведение, и ревьюер с ними согласен по итогам сверки
с кодом.

Побочных находок вне скоупа задачи не обнаружено.

## Что проверено и корректно

- Техническая точность раздела «Проблема» — построчно против материала (см.
  «Как проверялось»).
- Непротиворечивость AC1–AC5 контракту поведения (п. 1–5) и друг другу:
  AC1/AC2 — поведенческие инварианты «нет blanket reset» и «быстрая дорожка»;
  AC3 — защитный инвариант «≤1 union» и побайтное равенство документа; AC4 —
  отказы/guard не меняются; AC5 — decor-only lane (#1075) не регрессирует,
  кроме явно обозначенного исключения (`stairs`/`plan_transform` уходят в
  новую дорожку, а не в decor-only).
- Измеримость AC1–AC3 существующей, не придуманной заново инфраструктурой
  (`_floorCacheBuilds.wallUnion`, пулы по ключу, spy на экспортируемые
  функции `commitWallSegmentModel`/`checkSpacePhysicalGeometry`).
- Соответствие плана автотестов реально существующим файлам, отсутствие
  вымышленных путей.
- Отсутствие изменений в i18n, UX, персистентной модели/миграции,
  подтверждённое чтением описанных полей/файлов.
- Корректность release-классификации как предположения («stable-fix,
  подтвердить чтением тега») — это явно пред positioned для code-ревью,
  не блокирует spec.
- AC7 как регрессионный периметр смежной серверной подсистемы (`wall_node`/
  `junction`) — тесты существуют и релевантны unaffected-пути (`nodeMove`).

## Чего не проверял

- Реализацию — её нет (`Реализации ещё нет` в теле issue). Кодовый Validate,
  `tsc`, `npm test`, `gate:small` не запускались — не требуются на этапе spec
  при отсутствии конкретного непокрытого вопроса (REVIEWER.md, «Ревью ТЗ»;
  PROCESS.md §8).
- Фактическое поведение билда/бенчмарка AC6 (времена Undo/Redo) — числа
  появятся только после реализации; формат заимствован у уже принятого
  `docs/analysis/1075-editor-command-latency.md`, который существует и
  методологически совпадает.
- Содержимое будущего `docs/release-ledger/1100.json` и точную формулировку
  changelog — это код-ревью (§11.9).
- Пересечение с #1093/#1098/#1099 на уровне реализации (ещё не написана);
  проверено только, что ТЗ корректно описывает границу и порядок разрешения.

## Гейты

| Гейт | Статус | Причина |
|---|---|---|
| tsc/build/`npm test`/`gate:small` | не прогонялся | этап spec, Validate не требуется, реализации нет |
| Адресный negative-input / feasibility-check | не потребовался | ни одного непокрытого технического вопроса не возникло — все координаты кода и файлы плана тестов подтвердились чтением материала |
| `pytest tests_backend -k "wall_node or junction"` | не прогонялся | это AC7, относится к коду, а не к ТЗ; на этапе spec реализации нет, прогонять нечего |
| Chromium/Playwright-зависимости | не ставились | этап spec, #696 |

## Маршрут и вердикт

Route: `fix` (задан пакетом ревью, #726).
Вердикт: зелёный. High: 0, Medium: 0.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjhjZjU0YzczY2ExNDU2OTRhNzk3NWM5NTcxYmIxNTM0OWQyNjg5N2IzMWFkZTg5NGY3NWQ3YTc3NTE5MGRiYTEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJmMTgzYzU5ZTc3MTgxYjUwYTEwNzJiNDYxZTdhYzBmYjhkMGM5MDU4NDRiYTJkMDhhOTU0ODU0MzBhM2E0ZWYwIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTAwLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwOWJkYThkYmVlOGI1MDU3N2JmYzRhZmZjMzMyYjhjZGE5MTRmNWI0IiwidHJlZSI6ImE2NWQ4YmU5M2I2ZTY0NGZhNmYzZGUzZTQxMmJlOTRmZDYwNTdjZTkiLCJib2R5RGlnZXN0IjoiMWEyZTFjOTYzMDYwMWM5NzQ3NGZhOWUxY2FlOTdjM2EwM2U5ZjczYmJhOGY0YTNjZjdhOWQyZjkwMTA4NGFiNiIsInByb2R1Y2VyUnVuIjoiNDA2NTA4OTM4MzkiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImNmZWU4NzExNDVhN2I0ZDU5MWQzNDBmN2FiZjQ5NDNkYzAxZGIwNTI4NjVmMjU0OGZiZTU4M2U4YzIwYjA3ODIiLCJ2ZXJkaWN0RGlnZXN0IjoiNDZkNGNiMmFhMGIzNDM1NzI4N2M5ZDY2NjFjNDY2ZmFmMjUxNzhiOWNiMWVjZTAxNjA4ZWUzYzc4M2UwNjllZiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI0NTEwMDQ5NGRkOTY5YWMzYzViMGM1YzM1ZGJjOTc0ZTVhODAyM2U5OWQyODZjZmZjYjI1ZTI4YmJkNGQ2NzVkIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDYzNTAxOTc2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTAwI2lzc3VlY29tbWVudC02NDYzNTAxOTc2IiwiYm9keURpZ2VzdCI6IjQyNzQ5NGFiMjRkMzUzMWU1ZmIyNDFmNWJhZTZmNmMwMDQ1OTY3NWFiOTM1MTMyYjFmOGU4ZGQ0MzQxZmYxMDcifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `09bda8dbee8b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a65d8be93b6e644fa6f3de3e412be94fd6057ce9`
  ```
  git log --all --format='%H %T' | grep a65d8be93b6e
  ```
- Тело issue: `1a2e1c9630601c97474fa9e1cae97c3a03e9f73bba8f4a3cf7a9d2f901084ab6`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDQsIm91dHB1dF90b2tlbnMiOjI1OTU1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwNjkzNSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE4ODU2MjYsImNvc3RVc2RFc3RpbWF0ZSI6MS4wNjQ1MDMxOTk5OTk5OTk5fV0sInR1cm5zIjo0MCwiZHVyYXRpb25NcyI6MzE1NjM3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4wNjQ1MDMxOTk5OTk5OTk5LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=44 output_tokens=25955 cache_creation_input_tokens=106935 cache_read_input_tokens=1885626 num_turns=40 -->
