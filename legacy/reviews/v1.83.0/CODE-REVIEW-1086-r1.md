# CODE-REVIEW — issue #1086, заход r1

Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче · Документ: docs/reviews/CODE-REVIEW-1086-r1.md

Материал: `6a33400ecbb8a7db27e70a9570de406b13dc589f` (коммиты `c48de5b1a` «fix(review): audit permissions without binding read arguments», `6a33400ec` «docs(review): keep test guidance within its existing budget»). Трек `track:show`, инфраструктурная задача (класс B — `scripts/review-*`, `test/review-*`; класс C — `PROCESS.md`/`docs/*`), входит сразу на `S7-code-review`.

## Скоуп

Задача не обслуживает ни одну строку `docs/SCOPE.md` напрямую — это инфраструктура самого ревью-конвейера (мета-уровень, явно разрешённый классом B/инфраструктурных задач, AGENTS.md «Rule #1»/«Change classes»). Исправляется баг пайплайна #1065: аудит ревью сравнивал полный canonical JSON входа Read/Grep/Glob/ToolSearch между hook и trace, хотя политика допуска (`toolProblem`) эти четыре инструмента и так пропускает по одному имени, независимо от аргументов. Нормализация native SDK (относительный/абсолютный `file_path`, алиасы Grep) превращала разрешённое чтение в ложный `tool call has no matching policy decision` (run 40290595628, 4 Read mismatch). Решение — новый маркер `sha256/hp-review-policy-v2`: для Read/Grep/Glob/ToolSearch хэш входного digest строится только из имени инструмента (`binding: 'tool-only'`), для всех остальных (Write, `run_check`, StructuredOutput, неизвестные) — из имени и полного canonical JSON (`binding: 'exact-input'`), как раньше. Старый алгоритм `sha256/hp-native-2.1.295-json-v1` сохранён только для диагностики исторических записей.

## Как проверялось

Материал читается `read:log`/`read:diff` (манифест `f7d33936389...378567`, тот же, что в `REVIEW_CHECKS`); полностью прочитаны все 15 файлов из `fullHunkReads`, включая исходники до правки (`scripts/review-execution-policy.mjs`, `scripts/review-capabilities.mjs`, `scripts/review-native-call-digest.mjs`) для независимой проверки вызывающего кода, а не только диффа.

Независимый разбор (до сопоставления с хендоффом):

- `scripts/review-capabilities.mjs:10-11` — `READ_ONLY_REVIEW_TOOLS` (`['Read','Grep','Glob','ToolSearch']`) **побайтово совпадает** со старым `READ_TOOLS = NATIVE_REVIEW_TOOLS.filter(name => name !== 'Write')`, который действовал до этой задачи (`scripts/review-execution-policy.mjs:37`, прежде `git show base:...`). Значит набор инструментов, допускаемых по одному имени независимо от аргументов, **не расширился** — это ровно тот набор, для которого `toolProblem` (review-execution-policy.mjs:124-147) и раньше возвращал `null` без осмотра `tool_input`. Задача меняет только то, как `nativeCallDigest` сверяет hook-запись с trace-записью для *уже* безусловно допущенных инструментов, а не какие вызовы допускаются — это снимает единственный найденный риск несанкционированного расширения допуска.
- `scripts/review-native-call-digest.mjs:40-48` (`nativeCallDigest`) — `canonicalCallJson(input)` вызывается **до** определения `binding`, т.е. валидация JSON (отказ на getter/`toJSON`/cycles/`Infinity`/sparse) действует для read-only инструментов так же строго, как раньше; различается только то, что сам `input` в хэш не попадает. Дискриминатор `binding` (`'tool-only'` vs `'exact-input'`) в самом хэшируемом объекте исключает коллизию между схемами.
- `scripts/review-execution-policy.mjs:162-214` (`traceProblems`) — hook записывает journal-строку через `callDigest(call.tool_name, call.tool_input)` (строка 272, тот же `nativeCallDigest`), а sealing сверяет `callDigest(call.name, call.input)` из trace тем же алгоритмом. Поскольку для Read/Grep/Glob/ToolSearch обе стороны хэшируют `{binding:'tool-only', name}`, любая SDK-нормализация пути/флагов конкретно этих инструментов больше не ломает сравнение, а подмена **имени** инструмента по-прежнему меняет хэш и ловится (`matching[0].input !== inputDigest`). Для Write/`run_check`/StructuredOutput/неизвестных путь сравнения не менялся.
- Раздельно проверил `scripts/review-failure-diagnostics.mjs` — raw `diagnostic`/`diagnosticDecision` (построены через `reviewToolMetadata`) не используются в `nativeCallDigest` и остаются отдельным каналом; `metadataAgreesWithTrace` способен показать «false» даже когда аудит согласен — т.е. диагностика не теряет честность при расхождении (AC1 «диагноз сохраняет различия»).
- Legacy-путь: `legacyNativeCallDigest` — точная копия прежнего тела `nativeCallDigest` (включая `projectNativeCallInput` с алиасами Grep #1084); используется только диагностикой (`review-failure-diagnostics.mjs`) и тестами, не импортируется в `review-execution-policy.mjs` — исторические записи физически не могут получить текущий `semantics: 'current'` (алгоритм в journal определяет ветку `algorithmInfo`/`HISTORICAL_ALGORITHMS`, а `traceProblems` требует ровно `CALL_DIGEST_ALGORITHM` в `policy.callDigestAlgorithm`, иначе `'unsupported call digest algorithm'`).

Сопоставление с хендоффом — выводы совпадают; дополнительных расхождений не нашёл.

Адресные проверки через `run_check` (манифест принят, material unchanged на каждом вызове):

| Проверка | Результат |
|---|---|
| `unit:test/review-execution-policy.test.mjs` | PASS 53/53 |
| `unit:test/review-native-call-digest.test.mjs` | PASS 8/8 |
| `unit:test/review-failure-diagnostics.test.mjs` | PASS 23/23 |
| `unit:test/review-capabilities.test.mjs` | PASS 5/5 |
| `unit:test/process-digests.test.mjs` | PASS 11/11 |
| `unit:test/testing-doc.test.mjs` | PASS 5/5 |
| `static:status-snapshot` | PASS (`docs/STATUS.md: snapshot block is current`) |
| `static:ci-registry-inventory` | PASS |

`process-digests.test.mjs` и `testing-doc.test.mjs` запущены адресно, так как задача правит одновременно `PROCESS.md` и `docs/process/REVIEWER.md` (первый сверяет ссылки/формулировки между ними) и дважды касается `docs/TESTING.md` (второй коммит специально ужимает текст под лимит размера — именно это и проверяет документный бюджет). `static:status-snapshot`/`ci-registry-inventory` закрывают число `5605` в `docs/STATUS.md` (единственный источник, сверено построчно: diff добавляет ровно 7 новых `test(...)` — 1 в `review-execution-policy.test.mjs`, 3 в `review-native-call-digest.test.mjs`, 3 в `review-failure-diagnostics.test.mjs`, что даёт `5598 → 5605`).

Переиспользовано без повторного прогона: `ciEvidence` (validate-gate run [40295851967](https://github.com/Matysh/houseplan-card/actions/runs/40295851967), «review-light proof is complete») и хендофф — Linux `process-gate --issues`/`gate:small` (289 с, 0 failed), адресные 138/138 PASS Linux и 135 PASS/3 POSIX-SKIP Windows по тем же тест-файлам, пуш CI docs/tooling зелёный. Задача не трогает `src/**`, демо, бандл и backend — `build:build`/`build:typecheck`/`build:bundle:sync`, смоки, golden, `pytest tests_backend`, `invariants`, performance не запускал: нет изменённого продуктового/визуального/Python/геометрического кода и ни один из них не назван в AC — полные наборы здесь являются предрелизным, а не ревью-гейтом (REVIEWER.md «Объём гейтов»).

Побочно замечена разница диффа: `read:diff` сейчас дополнительно показывает удаление `docs/reviews/SPEC-REVIEW-1078-r1.md` и правку `docs/reviews/INDEX.md` (Документов 144→143). Эти файлы не входят в заявленный `changedFiles` задачи и не упомянуты ни в теле issue, ни в хендоффе. Причина — `dev` на момент запроса впереди ветки на 1 коммит (см. gitStatus), и этот коммит на `dev` уже содержит публикацию ревью #1078; `base` для `read:diff` резолвится к текущему `dev`, поэтому файл, которого нет на ветке, выглядит «удалённым» относительно живого `dev`. Это ожидаемый шум трека `show` (ветка не ребейзится до ревью, REVIEWER.md «Трек show»), а не часть изменений #1086 — коммиты `c48de5b1a`/`6a33400ec` его не касаются.

## Находки

Нет High. Нет Medium. Нет Low.

**AC · чем доказан · чем краснеет** (все три AC — защитные: это сам допускающий/отказывающий guard аудита):

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (разрешённое чтение не ломается нормализацией; диагноз хранит разницу) | `unit:test/review-execution-policy.test.mjs` тест «#1086 four Read mismatches…» (4 Read с разными `file_path`, journal с resolved-путём) и «#1086 read parameter differences…» (Grep alias/default разницы) — оба PASS; `unit:test/review-failure-diagnostics.test.mjs` «#1086 current read binding preserves input differences…» подтверждает `metadataAgreesWithTrace:false` при `problems:[]` | Отрицательный случай встроен в тот же тест: `rows.slice(1)` (пропущенная запись), `[rows[0], ...rows]` (дубликат), `{...rows[0], denied:true}`, `{...rows[0], id:'foreign'}`, `{...rows[0], input: callDigest('Write', reads[0].input)}` — каждый вариант **красит** `assert.ok(traceProblems(...).length)`; подмена имени инструмента (`Read→Write` и т.п.) красит отдельной проверкой в том же файле |
| AC2 (подмена имени/журнала/результата/denied/Write/run_check/StructuredOutput/материала/отчёта по-прежнему отклоняется) | `unit:test/review-execution-policy.test.mjs` (имя инструмента, алгоритм-маркер), `unit:test/review-failure-diagnostics.test.mjs` «#1086 current Write and run_check diagnostics still require exact full input binding» — оба PASS | Та же пара тестов варьирует `content`/`check_id`/значения массивов для Write и `run_check` и проверяет `problems.includes('input-digest-mismatch')`/`row.journal.inputDigestMatches===false` — обычный красный случай в самом тесте, не мутант реестра |
| AC3 (историческая диагностика — старый алгоритм, без переоценки) | `unit:test/review-failure-diagnostics.test.mjs` «#1086 old native Read mismatches remain historical…» и «…old native Grep keeps its historical projection…», `unit:test/review-native-call-digest.test.mjs` «#1086 read authorization binds exact native tool identity…» (`assert.notEqual(expected, nativeCallDigest(name, {}))`) — PASS | `traceProblems` с `policy.callDigestAlgorithm = LEGACY_NATIVE_CALL_DIGEST_ALGORITHM` красится `'unsupported call digest algorithm'` в том же тесте; `expected.semantics` зафиксирован как `'legacy-not-re-evaluated'`, а не `'current'` |

Качество/читаемость: изменение узкое и локальное — один новый список (`READ_ONLY_REVIEW_TOOLS`), один дискриминатор в хэше, переименование экспорта (`nativeCallDigest`→ новая семантика, старая сохранена под `legacyNativeCallDigest`). Старый путь (`projectNativeCallInput`/`sha256/hp-native-2.1.295-json-v1`) не удалён молча — задача прямо документирует и тестирует, что он остаётся только для диагностики (AC3), это объяснённое удержание легаси, а не незамеченный дубль (REVIEWER.md §7.2).

## Что проверено и корректно

- Набор инструментов, допускаемых по имени независимо от аргументов, не изменился относительно политики допуска (`toolProblem`) — задача не расширяет и не сужает то, что разрешено исполнять, только чинит сверку журнала.
- Валидация входного JSON (`canonicalCallJson`) выполняется для read-only инструментов до определения типа binding — отказ на враждебные входы (getter/`toJSON`/cycles/`Infinity`) не ослаблен, подтверждено тестом «tool-only binding still rejects malformed JSON without callbacks» (0 вызовов getter/`toJSON`).
- Подмена имени инструмента, журнала (пропуск/дубликат/чужой id), `denied`, точного входа Write/`run_check`/StructuredOutput — по-прежнему ловится; независимо перепроверено по коду `traceProblems`/`nativeCallDigest`, не только по тексту теста.
- Исторический алгоритм (`sha256/hp-native-2.1.295-json-v1`) изолирован: не импортируется действующей политикой (`review-execution-policy.mjs`), используется только диагностикой; старые отказы не получают `semantics:'current'`.
- Документация (`PROCESS.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/process/REVIEWER.md`, `docs/STATUS.md`, `docs/TESTING.md`) синхронно и непротиворечиво описывает новый маркер и границу гарантии; `process-digests.test.mjs` подтверждает согласованность ссылок/формулировок между `PROCESS.md` и `REVIEWER.md`.
- `docs/STATUS.md` Tests-счётчик (5605) — один источник, пересчитан вручную по диффу (+7 новых тестов) и подтверждён `static:status-snapshot --check`; `docs/release-ledger/v1.82.0/1086.json` — корректная классификация `infra` (продукт не меняется, не затрагивает `src/**`), что соответствует фактическому диффу.
- Трейлеры коммитов: отсутствие правок `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в диффе непротиворечиво с `User-Visible: no`; задача не меняет видимое пользователю поведение продукта (критерий §8 «одно число — один источник» неприменим — видимых пользователю чисел в диффе нет).
- Критерии §5 трека `show`: сложность низкая (один дискриминатор в существующем digest-алгоритме), одна поверхность (аудит ревью-пайплайна), нет миграции/compatibility-полей, нет нового UX-контракта и влияния на перф/touch, поведение уже зафиксировано самим телом issue (разделы «Проблема»/«Решение») — `reclassify` не применяется.

## Чего не проверял

- Дословные трейлеры `Issue:`/`User-Visible:` каждого коммита — доступные мне инструменты дают только `git log --oneline` и кумулятивный `git diff`, без `git show`/`log --format` для тела коммита; полагаюсь на уже заявленный автором зелёный `process-gate --issues` (хендофф) и отсутствие правок changelog как косвенное подтверждение `User-Visible: no`.
- `build:build`/`build:typecheck`/`build:bundle:sync`, браузерные смоки, golden, `pytest tests_backend`, `npm run invariants`, performance — не запускал: задача не трогает `src/**`, демо-харнесс, Python-бэкенд или геометрию, ни один из этих гейтов не назван в AC; полные наборы — предрелизный гейт, не ревью.
- Исполнение ночного mutation-реестра для `review-native-call-digest.mjs`/`review-execution-policy.mjs` — вне ревью по общей политике (#709/#905): только обычные negative-input внутри тестов, что и было проверено выше.
- Фактическое поведение в живом CI-прогоне модели ревью (воспроизведение run 40290595628 на реальном native SDK) — недоступно и не требуется: синтетические фикстуры воспроизводят форму отказа, не приватные пути, что и заявлено в самом тесте.

## Гейты

| Гейт | Прогнан | Почему |
|---|---|---|
| `unit:test/review-execution-policy.test.mjs`, `review-native-call-digest.test.mjs`, `review-failure-diagnostics.test.mjs`, `review-capabilities.test.mjs` | Да (PASS) | Прямое покрытие AC1-AC3 и изменённого кода; требовалось свежее независимое доказательство, не переиспользование |
| `unit:test/process-digests.test.mjs`, `unit:test/testing-doc.test.mjs` | Да (PASS) | Адресный риск одновременной правки PROCESS.md/REVIEWER.md и бюджета TESTING.md |
| `static:status-snapshot`, `static:ci-registry-inventory` | Да (PASS) | Проверка сгенерированных `docs/STATUS.md`/registry против дерева |
| `read:log`, `read:diff`, `read:base:*` | Да | Статический разбор материала и файлов до правки |
| `build:build`/`build:typecheck`/`build:bundle:sync` | Нет | Нет изменений `src/**`/TS; переиспользован зелёный validate-gate/`gate:small` автора |
| Смоки/golden | Нет | Нет изменений демо/рендера; не названы в AC |
| `pytest tests_backend` | Нет | Нет изменений Python |
| `npm run invariants` | Нет | Нет изменений геометрии |
| Performance | Нет | Не названо в AC |
| Ночной mutation-реестр | Нет | Запрещено вне ночного workflow (#709/#905) |

## Маршрут

route: fix (трек `show`, все критерии §5 пройдены — см. «Что проверено и корректно»).

## Побочные находки (REVIEW_FINDINGS_POLICY: mode=issues)

Побочных находок нет.

## Материал раунда

- Ветка: `issue/1086-review-read-audit`, вершина `6a33400ecbb8a7db27e70a9570de406b13dc589f`; `dev` на момент ревью впереди на 1 коммит, слияние без конфликта (см. «Как проверялось» про шум `docs/reviews/INDEX.md`/`SPEC-REVIEW-1078-r1.md`).
- Дерево материала: `6cbf7fe877ec76871f8d5e428c1b5a1bc45dec09`.
- Вердикт: зелёный · High 0 · Medium 0 · маршрут `fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6Ijc0MmU0YTJiOTc4MGE4YTNlYzE3ZWM0NjlmMDNlNWRiODZmNWQxN2MzY2FjY2I4MjU3M2FhY2IyZjU5ZDY1ODAiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0NmU2NWJiYzMzMGZlYWIwYWE2NDJhZjI0N2Y3NGE1YjQyYjg1ODRhYjM0MDQ5YzdhNThiOTU4ODJkYTA4MDg2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDg2LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI2YTMzNDAwZWNiYjhhN2RiMjdlNzBhOTU3MGRlNDA2YjEzZGM1ODlmIiwidHJlZSI6IjZjYmY3ZmU4NzdlYzc2ODcxZjhkNWU0MjhjMWI1YTFiYzQ1ZGVjMDkiLCJib2R5RGlnZXN0IjoiOThmM2UwNTg5ZDI0YWQxNDA2YzBiMDQ3NzVkNzg5MDdkZDZjODI2Yzc3NmFkMDAxMDZiMTIyMWZiYmRiNTQwZSIsInByb2R1Y2VyUnVuIjoiNDAyOTY3Mjc0NDgiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImEyNzFmODJiYWYxM2IzNmMwNzRjZGQxNDU5NTY5NDkxNzU4ZDEzNGYwYWM0MmViYmNmN2Y1NTY1YzNmMDU4Y2MiLCJ2ZXJkaWN0RGlnZXN0IjoiZmVlYzU0YjRjMGZjNTM0YzdmNzM1Nzg0NTIwMDc3MDg2MzkyNDJlMjg2YTE4NWU2Yzg0YWEyNjAyZDhmMWE4ZCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJmNzdlNDhiNGM3YmY3MjExYTcxNjEwMWQzMzk1YjQ2ZjI3Y2QyYWVjMzgwNjQ4YzdjM2JmMjkyN2ZlMmE0YTk5IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDEyMzg5ODk1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDg2I2lzc3VlY29tbWVudC02NDEyMzg5ODk1IiwiYm9keURpZ2VzdCI6ImRkMmZiNWNkNDE5NjEzYzQxMTc4ZDRiY2JhNmFjZTA0NDRkY2JhMDBlZjM4ZmM0NTIzMjQ3NjVjMmYyN2VkZTgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1086-review-read-audit`, коммит `6a33400ecbb8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6cbf7fe877ec76871f8d5e428c1b5a1bc45dec09`
  ```
  git log --all --format='%H %T' | grep 6cbf7fe877ec
  ```
- Тело issue: `98f3e0589d24ad1406c0b04775d78907dd6c826c776ad00106b1221fbbdb540e`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40296727448,"run_attempt":1,"digest":"a76dd16d2f5160604f8841d1b98c5793f380e93aa34eb6c1a4bc11ae4ac57bbc"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTIsIm91dHB1dF90b2tlbnMiOjMwMTgxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0MDc2OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI3NTU5MjMsImNvc3RVc2RFc3RpbWF0ZSI6MS40MTYxNzA1OTk5OTk5OTk2fV0sInR1cm5zIjo0NSwiZHVyYXRpb25NcyI6NDQwMzkzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40MTYxNzA1OTk5OTk5OTk2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=52 output_tokens=30181 cache_creation_input_tokens=140768 cache_read_input_tokens=2755923 num_turns=45 -->
