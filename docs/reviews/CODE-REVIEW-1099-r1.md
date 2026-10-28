# CODE-REVIEW-1099-r1

Issue: #1099 · Этап: code · Трек: ask · Заход: r1
Материал: `25783f2f4ba6adf811336e96f261db217a949d81` (рабочая копия на этом SHA)
Маршрут побочных находок: `mode=issues` (HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES) — побочных Medium вне скоупа не найдено, outside_findings пуст.
Маршрут вердикта: `fix`.

## Скоуп

Диапазон правок: `demo/benchmark_geometry_commit.mjs`, `demo/smoke_junction_limits.mjs`, `docs/ARCHITECTURE.md`, `docs/CHANGELOG*.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/WALL-THICKNESS.md`, `docs/analysis/1099-geometry-commit-2026-10-28*`, `docs/release-ledger/v1.82.0/1099.json`, `scripts/ci-registry-inventory.json`, `scripts/config-compatibility-inventory.json`, `scripts/monolith-baseline.json`, `scripts/mutation-registry.mjs`, `src/houseplan-editor-runtime.ts`, `src/physical-candidate-proof.ts`, `test/commit-physical-geometry.test.mjs`, фикстуры/хелперы, `test/geometry-cleanup-842.test.mjs`, `test/junction-limits.test.mjs`, `test/wall-segment-model.test.mjs`, `test/wall-union-isolation.test.mjs`.

Риск по изменённым участкам (#707): `_junctionBaselineCache`/`JunctionLimitViolation` (houseplan-editor-runtime.ts:959-960, 2117-2119) — переход с `WeakMap` по identity объекта на `Map` по `spaceId` с ключом `model_version|cfgRev|fingerprint`. Класс geometry/данные, покрыт AC1/AC3/AC4/AC8 (см. ниже).

Обслуживаемая строка Core user jobs (SCOPE.md): J4 (десктопный администратор подтверждает правку физической геометрии на большом этаже).

## Как проверялось

Static-first (#857): прочитан REVIEW_CONTEXT, тело issue (редакция 2, со всеми F1/F2 правками r1), handoff автора, `src/houseplan-editor-runtime.ts` (полные risky hunks: 930-1040, 2060-2320, 3260-3420), `src/physical-candidate-proof.ts` (целиком), `src/wall-segment-model.ts` (`commitWallSegmentModel`, `migrateSpace`, `adoptWallSegmentModelCandidateInPlace`), `src/coordinate-canonicalization.ts` (`canonicalizeConfigGeometryInPlace`), `src/resize-controller.ts` (`finish`), `test/commit-physical-geometry.test.mjs`, `test/helpers/geometry-commit-harness.mjs`, `test/helpers/geometry-commit-characterization.mjs`, `test/wall-union-isolation.test.mjs`, `docs/release-ledger/v1.82.0/1099.json`, `docs/CHANGELOG*.md`, `docs/WALL-THICKNESS.md`, `docs/DEVELOPMENT.md`, `docs/analysis/1099-geometry-commit-2026-10-28.md` + `path-preservation.json`, `scripts/mutation-registry.mjs` (новые пять `physicalCommit1099Cases` записей).

Независимо прослежен путь `_commitPhysicalGeometry` → `physicalCandidateProof` → `commitEditedSpaceModel`/`commitWallSegmentModel` → `_junctionLimitsIntroduced`/`_junctionBaselineCache` → `adoptEditedSpaceModelInPlace`, плюс путь Resize (`_rszSpaceCandidateRenderable` → `_resizePhysicalProof` → `_commitPhysicalGeometry`).

Исполнено адресно (через `mcp__houseplan_review__run_check`, т.к. `test/junction-limits.test.mjs` и `test/geometry-cleanup-842.test.mjs` изменены диффом и спецификация требует «без правок ожиданий» для соседних unit-тестов):
- `read:base:test/junction-limits.test.mjs` — сравнение с текущим файлом: единственная правка — три regex-ассерции в тесте «#330 AC4: кэш baseline инвалидируется по конфиг-эпохе» адаптированы под новую структуру кэша (`cached.fingerprint === cacheKey`, `_junctionBaselineCache.set(spaceId`) вместо прежних `=== fingerprint`/`.set(previousConfig`. Это механическая синхронизация source-pinning теста со сменой типа кэша (WeakMap→Map), поведенческий инвариант (кэш сверяет fingerprint, ключуется идентичностью документа/пространства) сохранён — не ослабление теста.
- `read:base:test/geometry-cleanup-842.test.mjs` — единственная правка: `h.runtime._junctionBaselineCache = new WeakMap()` → `new Map()` в тесте AC6 (та же механическая синхронизация типа).

Остальное evidence переиспользовано по `ciEvidence` (review-light proof complete, https://github.com/Matysh/houseplan-card/actions/runs/40679181789, зелёный) и собственному чтению кода/тестов — отдельного исполнения `gate:small`/`npm test`/`tsc` не требовалось, т.к. материал/входы/oracle не менялись относительно уже пройденного пакета.

## Разбор реализации (независимо от хендоффа)

1. **Один union на кандидата (Контракт п.1, AC1).** `physicalCandidateProof` (`src/physical-candidate-proof.ts:16-28`) сравнивает `fingerprint`+`modelVersion` c предыдущим успешным проходом и возвращает его без пересчёта при совпадении. В `_commitPhysicalGeometry` первый вызов (живой кандидат, guard #278, line 2181) и второй (канонизированный, line 2256) используют один и тот же механизм: при равных отпечатках второй вызов — no-op. Тестовый seam (`test/helpers/geometry-commit-harness.mjs:14`) инструментирует реальный `wallPass` внутри `checkSpacePhysicalGeometry`, так что счётчик считает фактические сборки `wallBodiesGeometry`, а не декларацию. Корпус `test/commit-physical-geometry.test.mjs` (строки 6-13, 57-66) проверяет лимит 1/2 по сценариям thickness/column/merge/split на обычной и 146-комнатной large-house фикстуре, и отдельный тест (строки 78-80) утверждает, что корпус реально содержит оба исхода равенства отпечатков (не тривиальный «всегда 1» или «всегда 2»).
2. **Baseline-кэш (`_junctionBaselineCache`, houseplan-editor-runtime.ts:959-960, 2113-2141).** Переход с `WeakMap` по identity `previousConfig` на `Map<spaceId, {fingerprint: cacheKey, violations}>`, где `cacheKey = model_version + '|' + cfgRev + '|' + spacePhysicalGeometryFingerprint(previousSpace)`. Любое изменение содержимого ИЛИ ревизии инвалидирует запись — кэш никогда не отдаёт устаревший вердикт (сверено чтением: оба компонента cacheKey участвуют в сравнении на строгое равенство). Пруннинг (2117-2118) удаляет записи для исчезнувших пространств на каждом вызове — размер кэша ограничен текущим числом пространств. Это подтверждено и тестом (`test/commit-physical-geometry.test.mjs:20-28`: 50 повторных эквивалентных коммитов, baseline считается 1 раз, затем hit; `h.runtime._junctionBaselineCache.size<=original.spaces.length`), и large-house тестом (строка 65: чужие пространства — те же объекты по identity после коммита).
3. **beforeConfig и маркеры (Контракт п.7, AC8, F1 r1).** `beforeConfig = { ...liveCandidate, spaces: [JSON.parse(JSON.stringify(liveSpace))] }` (line 2270) — `markers` остаётся ТОЙ ЖЕ ссылкой, что и у `liveCandidate` (не клонируется). Непосредственно после — `_restoreGeometryStateInConfig(beforeConfig, { ...before, roomReferences: undefined })` (line 2271) с явным обнулением `roomReferences`. Прочитан `_restoreGeometryStateInConfig` (1941-1982): ветка, которая пишет в `config.markers` (`restoreMarkerRoomReferences`), выполняется ТОЛЬКО если `state.roomReferences` truthy (строка 1978) — при `roomReferences: undefined` эта ветка недостижима, так что общая ссылка на `markers` никогда не разделяется с мутацией. Это именно устранение риска F1 (ревью r1): если бы кто-то убрал `roomReferences: undefined`, при слиянии/удалении комнаты baseline восстановил бы старые ссылки маркеров ПРЯМО в живой массив (та же identity) — испортив `room_id`/`vacuum.segment_map` после коммита. Это зарегистрировано как mutation-witness `geometry-baseline-restores-live-marker-references-1099` (`scripts/mutation-registry.mjs:22103-22106`, патч точно убирает `roomReferences: undefined`), помечен «Registered only; execution is nightly» — соответствует общей политике (id зарегистрированного свидетеля с «не исполнялся»; я этот мутант сам не патчил и не исполнял — временный патч реализации запрещён вне ночного workflow). Независимо от witness, `test/commit-physical-geometry.test.mjs` содержит прямую проверку с глубокой заморозкой живых `markers` (строки 46-55, 75-77) — реальный `_commitPhysicalGeometry` на замороженном `markers[]`/соседних пространствах не бросает (TypeError в strict mode поймал бы ЛЮБУЮ попытку записи, включая гипотетические новые пути мутации), и байт-точное сравнение с зафиксированной базой (`test/fixtures/1099-commit-characterization.json`) для `marker-merge`/`marker-delete` (успех/safe-refusal/junction-refusal, v9 и pre-v9) через `test/helpers/geometry-commit-characterization.mjs`.
4. **Одно-пространственная модель стен (Контракт п.3, `src/physical-candidate-proof.ts:31-54`).** `commitEditedSpaceModel`: для `model_version < WALL_SEGMENT_MODEL_VERSION` (10) — старый полный путь (явный fallback, соответствует «иначе — весь конфиг, но один раз»); для текущих документов — кандидат `{model_version, spaces: [space]}`, что корректно, поскольку `commitWallSegmentModel`/`migrateSpace`/`assignLineage`/`canonicalizeConfigGeometryInPlace` оперируют только над `config.spaces` и принимают объект `space` без обращения к соседним пространствам или к `config.markers` (проверено чтением: `wall-segment-model.ts:865-896`, `909-916`; `coordinate-canonicalization.ts:319-360` — только `root.spaces`). `adoptEditedSpaceModelInPlace` сверяет `target.markers !== candidate.markers`: для полного fallback-пути (разные объекты) — падает в старый `adoptWallSegmentModelCandidateInPlace(target, candidate)` по всему документу; для одно-пространственного пути (общая ссылка, т.к. `commitEditedSpaceModel`'s `{...config, spaces: map(...)}` не трогает `markers`) — адаптирует только найденный `space`-объект внутри `target.spaces`, не затрагивая остальные элементы массива. Подтверждено тестом identity других пространств (large-house, строка 65) и зарегистрированным witness `geometry-current-adoption-visits-unrelated-spaces-1099`.
5. **Fail-closed (Контракт п.4, AC4).** try/catch вокруг preflight (2180-2185), канонизации (2194-2243) и junction-проверки (2144-2155) рефьюзят запись при исключении; только «недоказуемый baseline» (строка 2131-2135) fail-open. Подтверждено тестом `test/commit-physical-geometry.test.mjs:29-36` (инъекция исключений в preflight/candidate/baseline).
6. **Resize-reuse (Контракт п.5, AC5).** `_resizePhysicalProof` строится заново на каждой live-проверке (`_rszSpaceCandidateRenderable`, 3370-3385), гасится на исключении/отсутствии конфига/preview/другом этаже (3371, 3382-3384, 3388-3390) и потребляется+обнуляется в начале `_commitPhysicalGeometry` (2176-2177). Строгое сравнение fingerprint+modelVersion в `physicalCandidateProof` делает повторное использование безопасным независимо от происхождения вызова (устаревший proof от незавершённого Resize не может быть ошибочно принят для другой правки, т.к. fingerprint почти наверняка разойдётся, а при совпадении геометрия идентична по построению). Подтверждено тестами строк 37-45 (match/mismatch по колонне) и 81-101 (4 сценария ретайра: exception/missing-config/missing-preview/different-space — ни один не даёт false positive commit).
7. **Неизменный порядок/протокол (Контракт п.6).** `_commitPhysicalGeometry` сохраняет последовательность legacy-safe → канонизация → safe → стыки → adopt → история → `_saveConfig()` (2158-2290) — тот же порядок, что в issue-аудите #1094. Backend/протокол не затронуты (вне диффа).

## Документация и release-артефакты

- CHANGELOG RU/EN: строка с #1099 присутствует в обоих файлах того же коммита (`docs/CHANGELOG.md:9`, `docs/CHANGELOG.ru.md:15`) — число/формулировка не дублирует отдельный пользовательский счётчик, исходник один (issue-ссылка), расхождения источника нет.
- `docs/WALL-THICKNESS.md` и `docs/DEVELOPMENT.md` — добавлен раздел «Physical writer proof reuse (#1099)» в обоих.
- `docs/release-ledger/v1.82.0/1099.json`: `category: stable-fix`, `rationale` — путь с четырьмя union существует в стабильном v1.82.0, значит это fix относительно той базы, а не новая бета-функция; обоснование владельца присутствует (не вывод из User-Visible). Соответствует правилу «инфраструктура/внутри-бетные правки не входят в пользовательский milestone» — здесь явно stable-fix, обосновано.
- AC-таблица в ТЗ содержит обязательную строку «AC·доказательство·негатив» для каждого защитного AC (AC4, AC7, AC8) — третий столбец не пуст нигде.

## AC · чем доказан · чем краснеет (свод для ask-трека)

| AC | Доказательство | Негатив/мутант |
|---|---|---|
| AC1 | unit `test/commit-physical-geometry.test.mjs` (сценарные + 146-комнатные тесты), реальный тестовый seam на `wallPass`/`_junctionLimitViolations` | На неизменённой базе до правки — 4 union (заявлено автором, не перепроверялось повторным исполнением; код-ревью подтверждает архитектурную причину через `physicalCandidateProof`/кэш) |
| AC2 | unit character.-корпус (19 исходов) + smoke `junction_limits`/`geometry_cleanup_842`/`optimize_geometry_preflight` (CI green, review-light) | Байт-точное сравнение с зафиксированной базой — любое изменение исхода/toast/истории красит тест |
| AC3 | unit (identity чужих пространств, bounded cache) + smoke `floor_cache_reuse` (CI green) | — |
| AC4 | unit, инъекция исключений в preflight/candidate/baseline | Явный RED-сценарий при экспериментальной инъекции (строки 29-36) |
| AC5 | unit (match/mismatch, 4 сценария ретайра) | Зарегистрированные witness `resize-preview-keeps-prior-proof-*-1099`, `physical-proof-ignores-candidate-fingerprint-1099` — **не исполнялись** (execution:0 по хендоффу и политике нет требования исполнять вне ночного workflow) |
| AC6 | `docs/analysis/1099-geometry-commit-2026-10-28.md` + `before.json`/`after.json`, `path-preservation.json` (SHA-проверка, что измерённый `_commitPhysicalGeometry`/`physical-candidate-proof.ts` байт-равен текущему) | Union 4→2/3 по сценариям, `tsFullCandidateMs` без регрессии |
| AC7 | CI green (review-light), `pytest tests_backend -k "junction or wall_node"` по хендоффу, бэкенд вне диффа | — |
| AC8 | unit (глубокая заморозка `markers`, байт-точные marker-сценарии v9/pre-v9) | Witness `geometry-baseline-restores-live-marker-references-1099` — **не исполнялся**; код-чтение подтверждает, что без `roomReferences: undefined` на line 2271 мутант воспроизвёл бы искажение (ветка 1978-1981 `_restoreGeometryStateInConfig`) |

## Находки

Находок, препятствующих зелёному вердикту, не обнаружено. Побочных находок вне скоупа также нет (outside_findings пуст, согласно политике mode=issues).

## Что не перепроверялось повторным исполнением

- Полный `gate:small`/`npm test`/backend pytest — переиспользованы как зелёный review-light proof (https://github.com/Matysh/houseplan-card/actions/runs/40679181789); входы/материал/окружение не изменились относительно этого прогона.
- Исходное «4 union на неизменённой базе» (RED до правки) — принято по авторскому отчёту и подтверждено архитектурным чтением (до правки preflight/junction действительно не делили geometry и `WeakMap`-кэш никогда не попадал — видно из diff базовых версий файлов), не воспроизводилось отдельным запуском на предыдущем SHA.
- Мутационное исполнение (registry mutants) — не выполнялось: это запрещено вне ночного workflow (временный патч реализации = исполнение мутанта); все пять новых witness идентифицированы по id и корректно помечены как «не исполнялись», что соответствует общей политике для защитных AC.
- AC6 производительность не перезамерялась — числа и SHA-пины в `path-preservation.json` проверены чтением, не повторным browser-прогоном.

## Вердикт

**green.** High: 0, Medium: 0. Маршрут: `fix` (сопровождающее поле, не меняет зелёный исход — блокирующих раундов не требуется).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjJjNDhjYzhmN2Y3Y2JjYWM4YWYyMGQzNzA2MTM5MzM2N2FmNjYyY2JjMDFmZTk5MTc2ZmFkZDgzZmI4NTE4ZjEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI1ZjNmNTA3YTRiMjA3ZTFiN2Y3MmM0NTZmYjdiMWUzZGFlMTM2MzE0ZTE1MDZhZjY2ZDEwOTI0ZjhhODdlZGI4IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk5LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIyNTc4M2YyZjRiYTZhZGY4MTEzMzZlOTZmMjYxZGIyMTdhOTQ5ZDgxIiwidHJlZSI6IjBjMWUzNTA0YjI0ZmU2ZmJhNDgwZWUxMjAxMDg4MzdkNjlkMTcyODciLCJib2R5RGlnZXN0IjoiNzYwOTFmMjQ0YjllMGM2NjA0YmU3OTZlOTM0MTcwNWYxMzRhNzcxMDFjMjM0NjIxOTEzZDEzM2JlZGVmMmQzYiIsInByb2R1Y2VyUnVuIjoiNDA2ODA2MTM1NjciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijc5NTQxZjgzZjM3MTk5OGFiN2Q1MTgzNTU3NmE0NWQxZWFlMjUzOTEyZmFlMmI3NTFlYmQ2YjlkM2ZhMGJlNDUiLCJ2ZXJkaWN0RGlnZXN0IjoiYmUxOTJiYmNlMGEwZDRjNmIyNTE3MzliOTNjMTFiMzA4MjY4NTk0MTYyNzMzY2Q5ZWU1NzcyNzlhZmZiYzFjNyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIyZmU0ZWIyNzFjMTRmOGJhMjk3MTkzNDY5M2MzZDkzMzBmMDljYzM4MjcxYzcxNWNjNjA1ZjU0NWFlN2ZhMDhlIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDY4MDc3NzgxLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk5I2lzc3VlY29tbWVudC02NDY4MDc3NzgxIiwiYm9keURpZ2VzdCI6IjgyYjRmNDI2ZmIwYzU5YWY1MzAyZTkxZTFiZjM4OGFmMDY5NWIzZmUxMmQ3ZmM4ZTUzZDE4M2Y3NWJlMGVkMTEifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1099-geometry-commit`, коммит `25783f2f4ba6` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `0c1e3504b24fe6fba480ee120108837d69d17287`
  ```
  git log --all --format='%H %T' | grep 0c1e3504b24f
  ```
- Тело issue: `76091f244b9e0c6604be796e9341705f134a77101c234621913d133bedef2d3b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40680613567,"run_attempt":1,"digest":"77ba31fc9cc9582b14bace2729a367cb4cd50e43c9585c142e4f314951ef76c6"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODQsIm91dHB1dF90b2tlbnMiOjM5NDAxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE4Nzk5MywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQyNTkwOTAsImNvc3RVc2RFc3RpbWF0ZSI6MS45OTc5Njh9XSwidHVybnMiOjUzLCJkdXJhdGlvbk1zIjo0OTc4MDAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjk5Nzk2OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=84 output_tokens=39401 cache_creation_input_tokens=187993 cache_read_input_tokens=4259090 num_turns=53 -->
