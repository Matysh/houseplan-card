# SPEC-REVIEW-1100-r2

Issue: #1100 · этап: spec · трек: ask · заход r2 · блокирующих циклов 0/4

Материал: тело issue #1100, SHA body
`b77babe0ad22cf5ccc0ce324bb6ffba7b98212df740a20ec2345f5580addac20`,
основа ТЗ — принятый dev `31b17bec040f25224b80f0f679378807ccfd37fc`
(после S8 #1099); рабочая копия сейчас на `86c6c7eab555e50e417d6d6fdeb2c3b8b27eb4fb`
(материал ревью, тот же файловый контент подсистемы, что и база ТЗ — #1099
между этими двумя SHA не менялся, дальнейшие коммиты — документы/индекс
ревью, #1114).

## Скоуп

Оценивается «Редакция 2» ТЗ в разделе `## ТЗ` тела issue #1100: быстрая
дорожка восстановления истории геометрии (Undo/Redo) для шагов без
физического изменения (подложка `plan_transform`, лестницы `stairs`),
адресная (не blanket) инвалидация `_wallUnionPool`/`_physicalBodiesPool` при
восстановлении физического шага, и (новое в r2) согласование контракта
«≤1/≤2 union» с уже принятым общим helper'ом `src/physical-candidate-proof.ts`
из #1099 r2. Обслуживаемая работа — J6 из `docs/SCOPE.md` («Keep the plan
true as the home evolves» — редакторы плана, undo/redo как часть поддержания
актуальности плана). Кодовый Validate не требуется — реализации всё ещё нет
(«Реализации #1100 ещё нет: сохранены только исходные RED и
characterization-корпус»).

Причина нового раунда: не ребейз «по умолчанию» — ТЗ содержит материальное
изменение контракта (AC3/Контракт п.2) по прямому решению владельца
([issuecomment-6471228080](https://github.com/Matysh/houseplan-card/issues/1100#issuecomment-6471228080)),
и база ТЗ сместилась с `09bda8dbe` (слияние #1099 ещё не было) на `31b17bec0`
(#1099 уже смержен, `src/physical-candidate-proof.ts` существует). По правилу
«сомнение в локальности» (REVIEWER.md, «Повторный раунд»: ребейз на ушедший
вперёд `dev` + смена контракта) разбор в этом раунде — полный, а не только по
дельте текста.

## Как проверялось

Статически, без изменения предмета ревью: прочитаны обязательные источники
роли (`docs/SCOPE.md`, `AGENTS.md`, `docs/process/REVIEWER.md`), тело issue
#1100 (приложенные страницы), предыдущий документ раунда
(`docs/reviews/SPEC-REVIEW-1100-r1.md`) и строки смежных задач в
`docs/reviews/INDEX.md` (#1093, #1098, #1099). Заново, на текущем материале
(не повторяя вывод r1 как факт), сверены построчно все технические
утверждения и координаты символов:

- `src/houseplan-editor-runtime.ts:2025-2034` (`_restoreGeometryStateLocal`)
  — подтверждено: после восстановления содержимого ставит
  `_wallUnionCache = null` и `_physicalBodiesCache = null` безусловно.
- `src/houseplan-card.ts:1924-1930` и `:1973-1977` (сеттеры `_wallUnionCache`/
  `_physicalBodiesCache`) — подтверждено: `value === null`/`!value` чистит
  весь `_wallUnionPool`/`_physicalBodiesPool` (LRU по всем недавно показанным
  этажам), а не только ключ восстановленного пространства — корень проблемы
  п.1 контракта не изменился.
- `src/houseplan-editor-runtime.ts:2381-2449` (`_applyGeometryState`) —
  подтверждено: `physicalChanged` (2402-2403) вычисляется через
  `spacePhysicalGeometryFingerprint(before/target)`, но не используется для
  того, чтобы пропустить `commitWallSegmentModel` (2419)/`_regSignature`+
  `_maybeRebuildDevices` (2439) — они гейтятся только `decorOnly`
  (`restoreDecorOnlyHistory`, 2398). Контракт п.3 предлагает добавить второй
  критерий (равенство fingerprint + отсутствие `guarded`), не трогая
  существующий `decorOnly`.
- `src/plan-geometry-preflight.ts:124-136` (`spacePhysicalGeometryFingerprint`)
  — подтверждено: строится из `id, cell_cm, rooms, walls, wall_segments,
  open_spans, openings, partitions, wall_columns`; `stairs`/`plan_transform`
  в него не входят — утверждение ТЗ точное.
- `src/decor-history-restore.ts:7-21` (`restoreDecorOnlyHistory`,
  `withoutDecor`, `guarded`) — подтверждено: `guarded()` возвращает
  `nodeMove || wallChainSeedIds || roomReferences` — ровно список контракта
  п.3/AC4; ТЗ переиспользует, а не переопределяет этот предикат.
- `src/geometry-history-state.ts:16-40` (`SpaceGeometryState`) —
  подтверждено: `stairs?`/`plan_transform` — поля состояния шага, других
  изменений модели не требуется.
- **Новое в r2** — `src/physical-candidate-proof.ts` (создан #1099, принят
  r2/code r2 — `docs/reviews/INDEX.md` строки #1099): `physicalCandidateProof`
  (строка 16) реально реализует заявленный контракт «кандидат пере­используется,
  только если `previous.result.ok && previous.fingerprint === fingerprint &&
  previous.modelVersion === modelVersion`», иначе — новый проход `check(...)`.
  `commitEditedSpaceModel`/`adoptEditedSpaceModelInPlace` сохраняют границу
  атомарной миграции всего конфига для `model_version < 9` и one-space путь
  для текущей версии — то, что в ТЗ названо «принятым общим helper'ом».
- Применение этого helper'а уже существует в продакшен-пути `_commitPhysicalGeometry`
  (`:2158-2290`, вызов `_commitRoom`/Resize): raw-проверка кандидата **до**
  канонизации (`:2181-2191`, `physicalCandidateProof(liveCandidate, ...,
  resizeProof)`), канонизация (`:2192-2243`, `commitEditedSpaceModel`), и
  повторная проверка канонизированного кандидата с передачей предыдущего
  proof для возможного переиспользования (`:2256-2257`). Это ровно тот
  паттерн «raw guard → canonicalize → verdict(canonical), reuse если
  fingerprint+model_version совпали», который ТЗ требует перенести в
  `_applyGeometryState` для восстановления. Технически перенос осуществим:
  сигнатуры и побочные эффекты helper'а не завязаны на Resize-специфичные
  поля.
- `src/houseplan-editor-runtime.ts:2433` — подтверждено: при разрешённой
  отрицательной boundary-проверке (`allowHistoryBoundaryRepair` +
  `wall-degraded-extra`) `fingerprint: strict ? ... : ''` — отрицательный
  вердикт не превращается в положительный outbound proof; Контракт п.2
  («outbound fingerprint остаётся `''`») точен.
- Файлы плана автотестов существуют на материале (проверено Glob):
  `test/geometry-history-refusal.test.mjs`, `test/decor-history-restore.test.mjs`,
  `demo/smoke_floor_cache_reuse.mjs`, `demo/smoke_backdrop.mjs`,
  `demo/smoke_stairs.mjs`, `demo/smoke_wall_chain_history.mjs`,
  `demo/smoke_node_history_context.mjs`, `demo/smoke_geometry_history_refusal.mjs`,
  `demo/smoke_selective_invalidation_history0.mjs`/`history320.mjs`,
  `docs/analysis/1075-editor-command-latency.md`. `test/geometry-history-restore.test.mjs`
  корректно отсутствует (заявлен как новый файл).
- `tests_backend/test_wall_node_move.py`, `test_ha_wall_node_delete.py`,
  `test_ha_wall_node_move_baseline.py`, `test_ha_websocket.py` — подтверждено:
  фильтр AC7 `-k "wall_node or junction"` отбирает существующие файлы
  смежной подсистемы.

### Непокрытый технический вопрос, разобранный и снятый ревьюером

ТЗ описывает смену механизма сброса кэшей **внутри** `_restoreGeometryStateLocal`
— общей функции, а не только вызова из `_applyGeometryState`. Проверено, у
скольких вызывающих это меняет поведение и не ломает ли их:
`_restoreGeometryStateLocal` вызывается восемью местами —
`houseplan-editor-runtime.ts:2188,2240,2263,2277` (аварийные откаты
`_commitPhysicalGeometry`/Resize), `:2400,2414,2442` (сама история), `:6802`
(`abortMutation` в коммите room/wall-chain), `:7001` (`abortMutation` в
`_commitRoom`), и `draft-live-commit.ts:82,121,140,171,207` (откаты
click-Line/wall-chain live-commit). Во всех восьми случаях `before`/`state`
— снимок **текущего активного** пространства (`_geometrySnapshot()` без
`spaceId` или `target.spaceId` того же этажа, на котором идёт жест); ни один
путь не восстанавливает чужой, неактивный этаж. Узкая (по ключу
восстановленного этажа) инвалидация вместо `null`-сброса пула безопасна для
всех восьми вызывающих одинаково — скоуп ТЗ не обязан перечислять их
отдельно, а AC1/AC2 остаются достаточным доказательством для реализации.
Вывод: открытых пробелов не осталось, перенос решения в общую функцию не
создаёт непокрытого риска для путей вне Undo/Redo.

Адресная проверка осуществимости (чтение кода, без прогона) полностью
покрыла единственный непокрытый вопрос, возникший при независимом разборе;
дополнительных build/test/gate для этого не потребовалось.

## Обязательные разделы (§7.1)

Присутствуют все: сценарий · что человек увидит до/после · проблема · скоуп
и не-скоуп · контракт поведения (1-5) · UX · модель данных и миграция · i18n
· критерии приёмки AC1-AC7 со способом доказательства · план автотестов ·
риски · откат · release-артефакты · блок «принято предположительно». Формально
комплектно (DoR, §2.5). Редакция 2 также добавила отдельный абзац, прямо
документирующий сам факт и источник изменения контракта (ссылка на
комментарий владельца) — это снимает вопрос «почему базовая линия сдвинулась»
без обращения к истории issue.

Каждый AC называет конкретный существующий способ доказательства (unit/smoke/
backend-файл) и *наблюдаемый* критерий (счётчик `_floorCacheBuilds.wallUnion`,
количество вызовов через spy, побайтное равенство документа, токсты отказов) —
ни один AC не сформулирован как субъективное «стало быстрее». Для защитных AC:

- AC3 называет оба отрицательных/краевых случая (равный fingerprint+model_version
  → ≤1 union; разный → ≤2 union с отдельной канонической проверкой, включая
  pre-v9) и явный запрет на обход raw guard — соответствует требованию
  «AC · чем доказан · чем краснеет» по существу, хотя сама трёхколоночная
  таблица — требование код-ревью (§2.7, #435), а не спецификации.
- AC4 называет точный отрицательный критерий для разрешённой boundary-проверки
  (`fingerprint: ''`, исключение не становится успехом) — не общая фраза
  «отказы работают».

## Находки

Находок нет. Независимая перепроверка (не доверие выводу r1) каждой строки
«Проблемы», каждого AC и нового абзаца о контракте union против текущего
материала (`31b17bec0`/`86c6c7eab5`, включая принятый за это время
`src/physical-candidate-proof.ts`) не выявила расхождений: код, имена
функций/полей и файлы плана тестов резолвятся именно так, как написано.
Единственный технический вопрос, который стоило разобрать самостоятельно
(см. «Непокрытый технический вопрос» выше — влияние общей функции
`_restoreGeometryStateLocal` на восемь вызывающих мест), разобран чтением
кода и снят: угрозы нет, AC не нуждаются в расширении.

Побочных находок вне скоупа задачи не обнаружено.

## Что проверено и корректно

- Техническая точность раздела «Проблема» (r2, символьные ссылки вместо
  номеров строк — устойчиво к ребейзу) — построчно против текущего материала.
- Согласованность нового контракта AC3/Контракт п.2 с уже принятым и
  закоммиченным интерфейсом `physicalCandidateProof`/`commitEditedSpaceModel`/
  `adoptEditedSpaceModelInPlace` (#1099 r2) — не декларация, а реально
  существующий, уже используемый в `_commitPhysicalGeometry` код с тем же
  порядком «raw guard → canonicalize → verdict», который ТЗ просит повторно
  применить к restore-пути.
- Непротиворечивость AC1-AC5 контракту поведения и друг другу; AC5 явно
  называет единственное намеренное изменение поведения decor-only lane
  (stairs/plan_transform уходят в новую быструю дорожку, а не в decor-only).
  Измеримость AC1-AC3 существующей инфраструктурой без новых счётчиков.
- Отсутствие вымышленных файлов плана тестов (все проверены Glob/Read).
- Отсутствие изменений в i18n, UX, персистентной модели/миграции.
- Разводка со смежными задачами (#1093 закрыта code r1 — правило «нет blanket
  reset» уже прецедент; #1098 ещё на spec r2, не реализована — ключ этажа для
  `stairs`/`plan_*` действительно не пересекается с этой задачей, подтверждено
  по `docs/reviews/INDEX.md`; #1099 code r2 зелёная и смержена — общий helper
  существует и используется, подтверждено чтением).
- Безопасность переноса механизма сброса в общую `_restoreGeometryStateLocal`
  для всех восьми вызывающих (см. раздел «Непокрытый технический вопрос»).

## Чего не проверял

- Реализацию — её нет. Кодовый Validate, `tsc`, `npm test`, `gate:small` не
  запускались — не требуются на этапе spec при отсутствии дополнительного
  непокрытого вопроса сверх разобранного выше.
- Фактические числа AC6 (времена Undo/Redo) — появятся только после
  реализации.
- `pytest tests_backend -k "wall_node or junction"` (AC7) — относится к коду;
  на этапе spec нечего прогонять (реализации нет); сами файлы существуют
  (проверено Glob).
- Содержимое будущего `docs/release-ledger/1100.json` и точную формулировку
  changelog, а также подтверждение `stable-fix` чтением тега — это код-ревью
  (§11.9); ТЗ прямо помечает классификацию как предположение «подтвердить
  чтением тега».
- Пересечение с #1093/#1098/#1099 на уровне фактической реализации (её нет);
  проверено только, что ТЗ корректно описывает границу и что принятый общий
  helper реально существует и имеет заявленную форму.

## Гейты

| Гейт | Статус | Причина |
|---|---|---|
| tsc/build/`npm test`/`gate:small` | не прогонялся | этап spec, Validate не требуется, реализации нет |
| Адресная проверка осуществимости | выполнена чтением (без запуска) | единственный непокрытый вопрос — влияние общей `_restoreGeometryStateLocal` на 8 вызывающих мест, закрыт грепом/чтением всех вызовов и их семантики (все — текущий активный этаж) |
| `pytest tests_backend -k "wall_node or junction"` | не прогонялся | AC7 относится к коду; на этапе spec реализации нет, прогонять нечего; существование файлов подтверждено |
| Chromium/Playwright-зависимости | не ставились | этап spec, #696 |

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| — (находок не было) | н/д | `docs/reviews/SPEC-REVIEW-1100-r1.md`, раздел «Находки»: «Находок нет» |

## Унаследовано из r1

Ничего не принято без повторной проверки: база ТЗ сдвинулась (`09bda8dbe` →
`31b17bec0`, после слияния #1099) и сам контракт AC3/п.2 изменился по решению
владельца, поэтому в этом раунде (см. «Скоуп» — «сомнение в локальности»)
выполнен полный независимый разбор заново, а не перенос вывода r1. Неизменным
от r1 принят только процессный факт — трек `ask`, обслуживаемая работа J6
(`docs/SCOPE.md`) и форма обязательных разделов (§7.1) ТЗ, которые сама
Редакция 2 не трогала; эти пункты зафиксированы в
`docs/reviews/SPEC-REVIEW-1100-r1.md` (материал `09bda8dbee8b`).

## Маршрут и вердикт

Route: `fix` (задан пакетом ревью, #726).
Вердикт: зелёный. High: 0, Medium: 0.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImZhNjZmZGU5YmM3NDQzYzlkNmRkMzQxNjkxYmIwNGRkM2Q4NzAxOTk3NjUzNmNiNDUyNmQ3NmE5MmQ5Y2U5M2IiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIwNDVmNTRkNjAzZDMwZDgzMGNlNmZiMThkNGRlYjUwMTExNTY4OGFkYTAwYzk4ZGY0NWU3M2Q3OTUzNjI0YWY3IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTAwLCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiI4NmM2YzdlYWI1NTVlNTBlNDE3ZDZkNmZkZWIyYzNiOGIyN2ViNGZiIiwidHJlZSI6IjkxYWMxOWUzYTM0ZjJiYjY5ZWYzMWExOGI2MDc2NTk0ZDA0MzA2YmEiLCJib2R5RGlnZXN0IjoiYjc3YmFiZTBhZDIyY2Y1Y2NjMGNlMzI0YmI2ZmZiYTdiOTgyMTJkZjc0MGEyMGVjMjM0NWY1NTgwYWRkYWMyMCIsInByb2R1Y2VyUnVuIjoiNDA3MDY4MTI1NjUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImFlNjRhMDU5ZWNjM2JkYWYwMzJmMDA1NjVlZjE2MjAzMTg1YzU4NWJlYmE3YmQwNTNlMmQ3MGE5MmZhMTE4MjYiLCJ2ZXJkaWN0RGlnZXN0IjoiOWI1NDc5MDI4NzM0YjZkMDcwYWUxZWRlNTg0ZGJmOWYzMTZhNTg5MjllYTgxYzU3ODliNmI3NTc5Y2Q2OTFkMSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJmMGU0YTliMmJkZTIwMmJjZDk3M2IyNmZhYjkxMDA5MjA4NDg5NmJlZTRkNDIzYjg2ZDk5YzcxODU1ZmNmYjgyIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDcyMDA4Mzk1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTAwI2lzc3VlY29tbWVudC02NDcyMDA4Mzk1IiwiYm9keURpZ2VzdCI6IjU0YjhmMWJiOTcxMDc2OTEyZjE3NzQ4MzI4NTU0MThhZTNmNDk3OGQ5NTBhZWQzYjc3MjFkYTcyMjgyMmY3MTEifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `86c6c7eab555` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `91ac19e3a34f2bb69ef31a18b6076594d04306ba`
  ```
  git log --all --format='%H %T' | grep 91ac19e3a34f
  ```
- Тело issue: `b77babe0ad22cf5ccc0ce324bb6ffba7b98212df740a20ec2345f5580addac20`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTYsIm91dHB1dF90b2tlbnMiOjMyMTkzLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzNjg2NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI4MDA2NTUsImNvc3RVc2RFc3RpbWF0ZSI6MS40Mjk2MzN9XSwidHVybnMiOjQ2LCJkdXJhdGlvbk1zIjo0MTE4MTgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjQyOTYzMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=56 output_tokens=32193 cache_creation_input_tokens=136865 cache_read_input_tokens=2800655 num_turns=46 -->
