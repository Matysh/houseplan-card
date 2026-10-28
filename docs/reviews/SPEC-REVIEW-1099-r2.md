# SPEC-REVIEW-1099-r2

**Issue:** #1099 · **Трек:** ask · **Этап:** spec · **Заход:** r2 ·
блокирующих циклов 1/4

**Материал ТЗ:** тело issue #1099, `bodyDigest`
`76091f244b9e0c6604be796e9341705f134a77101c234621913d133bedef2d3b`;
документ ревью закреплён на SHA `f10c65bdb56377c76c5593628fea46aaeb20fd31`
(дерево `579ee7690f331a13f03b0fd3a114187638a7d446`). Основа ТЗ для
координат кода — dev `09bda8dbe` (та же основа, что и r1:
`09bda8dbee8b50577bfc4affc332b8cda914f5b4`, после слияния #1093).
Реализации нет — оценивается только текст ТЗ.

## Скоуп ревью

Правки r2 отвечают на обе находки `SPEC-REVIEW-1099-r1.md` (F1, F2) и, по
заявлению автора, не меняют остальные разделы по существу. Задача
продолжает отчёт #1094 (ч.2 п.7): на коммите одной физической правки
одного пространства (`_commitPhysicalGeometry`) сегодня строится до
четырёх полных union стен этажа, хотя менялось одно пространство.
Обслуживаемая работа — J6 из `docs/SCOPE.md` (административный writer,
desktop, «Keep the plan true as the home evolves» — merge/split, resize);
видимое поведение задача не меняет, кроме задержки подтверждения, что
совпадает с разделом «Что человек увидит».

## Как проверялось

Кодовый Validate на этапе spec не требуется. Материал — текст issue плюс
независимое чтение реального кода на текущей рабочей копии (совпадающей
по цитируемым строкам с dev `09bda8dbe`, см. ниже), без исполнения
check-раннера: оба вопроса r1 и вся r2-правка проверяемы чтением
детерминированного кода, `run_check` не требовался.

Перечитаны и построчно сверены с правками r2:

- `src/houseplan-editor-runtime.ts:2095-2290` (`_junctionLimitsIntroduced`,
  `_commitPhysicalGeometry`) — цитируемые в ТЗ диапазоны (`:2155-2290`,
  `:2179`→`:2179`, `:2254`→реально `:2254` (`checkSpacePhysicalGeometry`
  на `committedCandidate`), `:2269`→`:2269` (`beforeConfig = JSON.parse(...)`),
  `:2271` (`_junctionLimitsIntroduced`)) совпадают с фактическим кодом
  байт-в-байт по номерам строк — материал с момента r1 не сдвинулся.
- `src/houseplan-editor-runtime.ts:1939-1981`
  (`_restoreGeometryStateInConfig`) — подтверждено: `restoreMarkerRoomReferences`
  вызывается строго под условием `if (state.roomReferences)` (`:1976`), то
  есть передача состояния без `roomReferences` гарантированно пропускает
  мутацию маркеров существующим кодом без новой инфраструктуры — ровно
  механизм, на который опирается Скоуп п.2 и Контракт п.7 правки r2.
- `src/room-reference-transaction.ts:51-73`
  (`restoreMarkerRoomReferences`) — подтверждено: функция мутирует
  переданные объекты `marker` на месте (`marker.room_id = ...`,
  `marker.vacuum.segment_map = ...`), как и описывает «Проблема» r2;
  F1 реален для сегодняшнего кода, если бы `beforeConfig` когда-нибудь
  начал делить массив `markers` с живым конфигом.
- `src/junction-limits.ts` (весь файл, Grep по `markers`) — **ноль**
  обращений к `markers`. Подтверждает заявление r2 «маркеры проверке
  стыков не нужны» — ключевое основание, почему Скоуп п.2 может просто не
  восстанавливать ссылки маркеров в этом baseline, а не клонировать их.
- `src/wall-segment-model.ts` (весь файл, Grep по `markers`) — тоже ноль
  обращений: fallback-ветка `_junctionLimitsIntroduced`
  (`commitWallSegmentModel(previousConfig)` при legacy baseline, `:2122-2124`)
  также не нуждается в маркерах. Защита Скоуп п.2 полна, а не частична.
- `docs/WALL-THICKNESS.md:61-65` — «Only an exact-revision junction
  baseline may be reused» (#1075) — подтверждает, что ключ кэша «отпечаток
  + `model_version` + ревизия», который r2 вводит в Скоуп п.2, — не новая
  терминология, а перенос уже документированного серверного паттерна на
  клиентский `_junctionBaselineCache`.
- `src/config-adoption.ts:205-244` (`configRev`, `noteLayoutRevision`) —
  подтверждает, что «ревизия» — существующее, не изобретённое понятие
  (оптимистичная блокировка, J6).
- `src/plan-geometry-preflight.ts:124-162` (`spacePhysicalGeometryFingerprint`,
  `checkSpacePhysicalGeometry`, `checkOptimizeGeometry`, опция
  `fingerprint`) и `src/junction-limits.ts:72-90` (`sharedGeometry`,
  `JunctionSharedGeometry`) — существующие параметры, на которые опирается
  Контракт п.1 и Скоуп п.1, не изменены r2, подтверждены повторно.
- `src/houseplan-card.ts` (Grep `_floorCacheBuilds`) — существующий
  тестовый seam-счётчик, на который Контракт п.1 ссылается как на прецедент
  для нового счётчика union.
- `docs/reviews/SPEC-REVIEW-1100-r1.md` (зелёный, та же основа dev
  `09bda8dbe`) — соседняя задача #1100 уже явно разводит границу с #1099 по
  общему helper'у и не формулирует противоречащих допущений об этом
  коммите; пересечение не создаёт конфликта.
- Файлы плана автотестов (`test/wall-union-isolation.test.mjs`,
  `demo/smoke_wall_chain_history.mjs`, `demo/smoke_node_history_context.mjs`,
  `demo/smoke_geometry_history_refusal.mjs`) — резолвятся в дереве,
  подтверждены Glob/Grep; не вымышлены.
- `docs/release-ledger/<previous-stable>/1099.json` — не существует
  (реализации нет), как и ожидалось на этапе spec.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **F1** (Medium) — скоуп-пункт 2 риск мутации живых `markers[]` через `restoreMarkerRoomReferences` в headline-сценарии слияния/разделения комнат, риск-раздел не называл класс «данные» | Baseline для проверки стыков теперь явно **не восстанавливает** ссылки маркеров вовсе (геометрия без `roomReferences`) — проверка стыков их не читает (подтверждено Grep по `junction-limits.ts`/`wall-segment-model.ts`); добавлен прямой запрет мутации в Контракте; добавлена таблица «AC·доказано·чем краснеет» с единым сценарием (а) успех/(б) отказ-стыки/(в) отказ-safe, негативным входом «глубокая заморозка живых `markers`» и названным мутантом «`beforeConfig` разделяет `markers` с живым конфигом»; класс риска «данные» добавлен явно | Тело issue: «Проблема» (абзац «Почему `beforeConfig` сегодня…»), «Скоуп» п.2 («ссылки маркеров… не восстанавливаются»), «Контракт поведения» п.7, AC8, «Риски» («данные — AC8») |
| **F2** (Medium) — контракт «≤1 union на кандидата» проверялся только на сценарии (толщина стены), где почти наверняка выполняется, не на headline-сценариях merge/split/column, где `assignLineage` вероятно меняет отпечаток | Контракт п.1 явно разведён: **=1** при равных отпечатках живого/канонизированного пространства, **≤2** при различных; AC1 требует корпус по всем четырём сценариям (толщина, слияние, разделение, колонна) со счётчиком на каждый и явно предписывает зафиксировать утверждением (не считать пропуском), если ни один из merge/split/column не дал различных отпечатков; AC6 называет тот же набор сценариев для perf-отчёта | Тело issue: «Проблема» (последний абзац), «Контракт поведения» п.1, AC1, AC6 |

Обе правки проверены не только по тексту, но и трассировкой до
реального, детерминированного кода (`_restoreGeometryStateInConfig`,
`restoreMarkerRoomReferences`, отсутствие чтения `markers` в
`junction-limits.ts`/`wall-segment-model.ts`): предложенный механизм
закрытия F1 реализуем без нового API, а не только декларативен.

## Унаследовано из r1

Принято без повторной проверки с нуля (материал не изменился —
`dev 09bda8dbe`, тот же, что в `docs/reviews/SPEC-REVIEW-1099-r1.md`),
хотя часть пересечений попутно подтверждена и в этом раунде:

- Наличие и порядок всех обязательных разделов §7.1.
- Точность координат кода в разделе «Проблема» (строки, имена функций) —
  r1 сверил построчно; r2 не меняет эти цитаты, в этом раунде я повторно
  подтвердил диапазон `:2095-2290` и `:1939-1981` как побочный продукт
  проверки F1/F2 и расхождений не нашёл.
- Контракт «Неизменное» (порядок legacy-safe → канонизация → safe → стыки
  → adopt → история → запись) и соответствие AC4 реальным `try/catch`
  веткам (`:2184`, `:2260`, `:2274` в текущей нумерации) — не менялись r2.
- Осуществимость скоуп-пунктов 1 и 3 на существующих, уже работающих в
  проде механизмах (`captureWallGeometry`/`sharedGeometry` в
  `draft-live-commit.ts`; однопространственная
  `canonicalizeConfigGeometryInPlace` в `wall-node-delete-menu.ts`/
  `wall-node-editor.ts`) — r1 подтвердил по коду, r2 текст не менял.
- AC5/Resize диагноз (`_rszSpaceCandidateGeometry` уже захватывает
  `wallGeometry`, `_rszCandidateRenderable` на pointerup отбрасывает его).
- Существование всех файлов плана автотестов, кроме ранее не упомянутых
  — ни один не выдуман.

## Находки

Находок нет. Обе находки r1 устранены правкой текста ТЗ, подкреплённой
реальными, уже существующими механизмами кода (условный вызов
`restoreMarkerRoomReferences`, отсутствие чтения `markers` в проверке
стыков, прецедент revision-keyed кэша в `docs/WALL-THICKNESS.md`), а не
просто смягчением формулировок. Новых пробелов в тексте r2 не найдено:
правки п.2 Скоупа, п.7 Контракта, AC8, класс риска «данные» (F1) и п.1
Контракта, AC1, AC6 (F2) непротиворечивы друг другу и остальным разделам
(AC2 «тот же вердикт» не нарушается, поскольку ни проверка стыков, ни
fallback-canonicalize маркеры не читают). Побочных находок вне скоупа
задачи не обнаружено.

## Что проверено и корректно

- Закрытие F1 реализуемо существующим API без нового слоя: передача
  `_restoreGeometryStateInConfig` состояния без `roomReferences`
  гарантированно не вызывает `restoreMarkerRoomReferences` — проверено
  чтением условия `if (state.roomReferences)` на `:1976`.
- Закрытие F1 защищено с запасом: даже если реализация ошибочно передаст
  `roomReferences` в это узкое `beforeConfig`, AC8 ловит это глубокой
  заморозкой живых `markers` (`TypeError` в строгом режиме) и отдельным
  названным мутантом — два независимых уровня защиты, а не один.
- Закрытие F2 численно непротиворечиво: Контракт п.1 — «1 (отпечатки
  равны) + 1 (baseline, холодный) = 2» или «2 (отпечатки различны) + 1 =
  3», что совпадает с «Итого… 2 или 3» в тексте; AC1 воспроизводит ту же
  арифметику и явно требует присутствия хотя бы одного сценария каждого
  вида в корпусе.
- AC8 оформлена как полноценная строка «AC · чем доказан · чем
  краснеет» для защитного AC — пустого третьего столбца нет.
- `commitWallSegmentModel`/`wall-segment-model.ts` и `junction-limits.ts`
  действительно не читают `markers` ни в одной из веток — проверка не
  ограничилась цитируемыми в ТЗ строками, а прогнана по всему файлу
  (Grep без совпадений).
- Пересечение с #1100 (уже зелёный на той же основе `dev 09bda8dbe`) не
  создаёт противоречия: #1100 явно оставляет порядок разрешения общего
  helper'а на усмотрение того, кто мержится первым, и не делает
  допущений, которые правка F1/F2 в #1099 нарушала бы.
- Классификация release-ledger (`stable-fix`, предположительно) по-прежнему
  корректно помечена как требующая подтверждения на код-ревью — r2 это
  не меняет.

## Чего не проверял

- Исполнение автотестов/бенчмарков/gate — не требуется на этапе spec,
  реализации нет; оба вопроса (F1, F2) и их закрытие разрешились чтением
  детерминированного кода, ни один check из `review-execution-policy.json`
  не относится к ещё не написанному коду.
- `docs/release-ledger/<previous-stable>/1099.json` — не создан, как и
  ожидается на этапе spec (подтверждение Glob: файла нет).
- Текст отчёта #1094 целиком и поведение `tests_backend` построчно — как
  и в r1, не требовалось для оценки текста ТЗ; план автотестов ссылается
  на реальные файлы (подтверждено существование, не содержимое).
- Фактические миллисекунды AC6 на large-house — задача пост-реализации,
  не предмет spec-ревью.

## Гейты

Этап spec: кодовый Validate/`tsc`/`build`/`npm test`/`gate:small` не
прогонялись — не требуются (`docs/process/REVIEWER.md` › «Ревью ТЗ»,
`PROCESS.md` §8), реализации нет. `run_check` не вызывался: ни оба
вопроса r1, ни проверка их закрытия в r2 не требовали исполнения — обе
опираются на детерминированный, уже существующий код
(`restoreMarkerRoomReferences`, отсутствие чтения `markers` в
`junction-limits.ts`/`wall-segment-model.ts`), проверяемый чтением.
Адресных negative-input проверок сверх чтения не потребовалось: оба
открытых вопроса разрешились статически без прогона.

## Маршрут

Доверенный снимок политики: `mode=issues`, `round=2`. Новых находок нет,
`outside_findings` пуст.

## Вердикт

High: 0 · Medium: 0 · Low: 0.

Зелёный: обе находки r1 (F1, F2) устранены в тексте ТЗ конкретными,
проверяемыми по коду механизмами (а не смягчением формулировок), новых
пробелов не найдено. ТЗ готово к `S5-ready`.

`route: fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjFkMmYzZTMyOWE3Y2NlZjY1ODYzNmZiYjQxYWY3MDZiMjhhYzEyYmNhY2NkYzIzODI1ZjhiZmY4NzdmODQxMGMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI5YzY4ZmE1ZWUzNGIzM2EzMWQ5NDlmOGY1NzA1ZTE5OGVlNGUwNmM2NDdiMjRjN2JkYTM3ZDMwZTU0NTBlMDZkIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk5LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJmMTBjNjViZGI1NjM3N2M3NmM1NTkzNjI4ZmVhNDZhYWViMjBmZDMxIiwidHJlZSI6IjU3OWVlNzY5MGYzMzFhMTNmMDNiMGZkM2ExMTQxODc2MzhhN2Q0NDYiLCJib2R5RGlnZXN0IjoiNzYwOTFmMjQ0YjllMGM2NjA0YmU3OTZlOTM0MTcwNWYxMzRhNzcxMDFjMjM0NjIxOTEzZDEzM2JlZGVmMmQzYiIsInByb2R1Y2VyUnVuIjoiNDA2NTM5MzMxNzciLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImFhNzFkYjFiNjNkODFjZDVkM2U0YWQ2MmJjZDYzZWI0YzJkM2VlNWM1MjUwMzFkNTE5ODZhMmZhNjhjOWM4NWIiLCJ2ZXJkaWN0RGlnZXN0IjoiY2EwZTA2MjhlYzIwZmMxNzliOTQ2YjIxYWE5ZWEwYzBkYWE3YWZiNDQ5MzUwZDIyYmZjODA0YWE2M2IzYWE2OCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI4N2E3MDhkNmNlZTY2N2VjN2QzYjQxN2JmY2I1Y2RhZGM0MjBhOGMwZTJlMDM2OWYzOGU2MjljMDllNjM1NjA2IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDYzOTg0Mjc1LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk5I2lzc3VlY29tbWVudC02NDYzOTg0Mjc1IiwiYm9keURpZ2VzdCI6IjIyMDQ2Nzg4MjQ3ZmY0ZmEzZDc4ODAyZDIzNmU2ZTVlMDdiNDc3ZjZjMGI5YzJiM2VjZDg5N2I5MWI0ODk2NDkifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `f10c65bdb563` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `579ee7690f331a13f03b0fd3a114187638a7d446`
  ```
  git log --all --format='%H %T' | grep 579ee7690f33
  ```
- Тело issue: `76091f244b9e0c6604be796e9341705f134a77101c234621913d133bedef2d3b`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NDQsIm91dHB1dF90b2tlbnMiOjI4NjYxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjk2MTA0LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTU4ODYxOSwiY29zdFVzZEVzdGltYXRlIjowLjk4ODgzNzgwMDAwMDAwMDF9XSwidHVybnMiOjMzLCJkdXJhdGlvbk1zIjozNTQxMTcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjk4ODgzNzgwMDAwMDAwMDEsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=44 output_tokens=28661 cache_creation_input_tokens=96104 cache_read_input_tokens=1588619 num_turns=33 -->
