# SPEC-REVIEW-1099-r1

**Issue:** #1099 · **Трек:** ask · **Этап:** spec · **Заход:** r1 ·
**Материал ТЗ:** тело issue #1099, `bodyDigest`
`5779097e0757624ded7b18e6948c55f0e385e6206790d5c06a894f44f0508078`,
основа дифф-ссылок — dev `09bda8dbee8b50577bfc4affc332b8cda914f5b4` (материал
ревью, рабочая копия уже на нём). Реализации нет — оценивается только ТЗ.

## Скоуп ревью

Задача #1099 продолжает отчёт аудита #1094 (ч.2 п.7): на коммите одной
физической правки одного пространства (`_commitPhysicalGeometry`) сегодня
строится до четырёх полных union стен этажа (`wallBodiesGeometry`) и
полная модель стен всего конфига, хотя менялось одно пространство.
ТЗ предлагает: (1) делить один union между preflight и проверкой лимитов
стыков; (2) кэшировать baseline стыков по содержимому вместо identity
`WeakMap`; (3) сузить `commitWallSegmentModel`/JSON-копии до одного
пространства, если доказана независимость модели по пространствам;
(4) переиспользовать union preview в Resize на коммите.

Обслуживаемая работа — J6 из `docs/SCOPE.md` ("Keep the plan true as the
home evolves" — merge/split, resize, drag — административный writer на
desktop); задача не меняет видимое поведение кроме задержки подтверждения,
что соответствует разделу ТЗ «Что человек увидит».

## Как проверялось

Кодовый Validate на этапе spec не требуется (owner note в прикреплённом
`ciEvidence`, `docs/process/REVIEWER.md` › «Ревью ТЗ»). Проверка — чтение
материала dev `09bda8dbe` и прослеживание каждого утверждения ТЗ до
реального кода, без исполнения чек-ранера: ни один check из
`review-execution-policy.json` не задействован, поскольку реализации ещё
нет и ни один конкретный непокрытый вопрос не требовал прогона — оба
найденных ниже вопроса разрешились чтением (детерминированная логика
canonicalize/restore, видна без исполнения).

Прочитано и сверено построчно с цитатами аудита в теле issue:

- `src/houseplan-editor-runtime.ts:2074-2290` (`_junctionLimitViolations`,
  `_junctionLimitsIntroduced`, `_commitPhysicalGeometry`) — номера строк в
  ТЗ (`:2155-2290`, `:2179`, `:2254`, `:2095-2150`, `:2269`, `:2235`)
  совпадают с реальным кодом на этом SHA.
- `src/plan-geometry-preflight.ts:80-162, 334-429`
  (`checkOptimizeGeometry`, `checkSpacePhysicalGeometry`,
  `spacePhysicalGeometryFingerprint`, опция `fingerprint`,
  `captureWallGeometry`) — существующая опция `fingerprint` действительно
  принимается, но это только переопределение значения отпечатка в
  результате preflight, а не внутренняя память union; реальный канал
  переиспользования — уже существующий `captureWallGeometry` →
  `sharedGeometry`/`candidateGeometry` у `_junctionLimitViolations`
  (`src/junction-limits.ts:72-90`, тип `JunctionSharedGeometry`).
- `src/draft-live-commit.ts` (весь файл) — прямой прецедент: альтернативные
  бounded-транзакции `commitWallChainFinishGeometry`/
  `commitWallChainSegmentGeometry` УЖЕ строят один union через
  `captureWallGeometry` и передают его в `_junctionLimitsIntroduced` как
  `candidateGeometry`. Это подтверждает, что скоуп-пункт 1 ТЗ — рабочий,
  уже обкатанный в проде паттерн, а не гипотеза.
- `src/wall-segment-model.ts:498-980` (`migrateSpace`, `assignLineage`,
  `commitWallSegmentModel`, `adoptWallSegmentModelCandidateInPlace`) — id
  новых атомов генерируются `Date.now()+counter+Math.random()`
  (`:228`), не зависят от других пространств; `canonicalizeConfigGeometryInPlace`
  уже вызывается с конфигом из одного пространства в двух других местах
  продакшн-кода (`src/wall-node-delete-menu.ts:108`,
  `src/wall-node-editor.ts:262`). Подтверждает осуществимость скоуп-пункта 3
  (однопространственный `commitWallSegmentModel`) для обычного случая.
- `src/coordinate-canonicalization.ts:314-330` —
  `canonicalizeConfigGeometryInPlace` итерирует только `root.spaces`,
  без обращения к данным других пространств.
- `src/houseplan-editor-runtime.ts:1939-1981`
  (`_restoreGeometryStateInConfig`) и `src/room-reference-transaction.ts:51-73`
  (`restoreMarkerRoomReferences`) — см. находку F1 ниже.
- `src/houseplan-editor-runtime.ts:6425-6454` (`_commitMerge`) — точка, где
  `before.roomReferences` реально заполняется для headline-сценария
  «слияние комнат».
- `src/houseplan-editor-runtime.ts:3280-3420, 3340-3390`
  (`_rszProjectPreview`/`_rszSpaceCandidateGeometry`/
  `_rszSpaceCandidateRenderable`/`_rszUp`) — подтверждает диагноз ТЗ:
  `_rszSpaceCandidateGeometry` уже захватывает `wallGeometry` через
  `captureWallGeometry`, но `_rszCandidateRenderable`→
  `_rszSpaceCandidateRenderable` на `pointerup` (`:3360-3381`) вызывает
  `_checkSpacePhysicalGeometry` без каптура и без переиспользования —
  ровно пятый union, который называет ТЗ.
- Существование файлов тестового плана: `test/wall-union-isolation.test.mjs`,
  `demo/benchmark_junction_limits.mjs`, `demo/smoke_junction_limits.mjs`,
  `demo/smoke_geometry_cleanup_842.mjs`,
  `demo/smoke_optimize_geometry_preflight.mjs`,
  `demo/smoke_floor_cache_reuse.mjs`,
  `demo/smoke_physical_body_characterization.mjs`,
  `demo/benchmark_safe_resize.mjs`, `demo/benchmark_safe_resize_render.mjs`,
  `tests_backend/test_junction_limits.py`,
  `tests_backend/test_junction_parity.py`,
  `tests_backend/test_wall_node_*.py` — все подтверждены Glob/Grep,
  название файлов в плане автотестов ссылается на реальные существующие
  цели, а не на вымышленные пути.
- Обязательные разделы ТЗ (`PROCESS.md` §7.1: сценарий · что человек
  увидит · проблема · скоуп/не-скоуп · контракт поведения · UX · модель
  данных и миграция · i18n · AC с доказательством · план автотестов ·
  риски · откат · release-артефакты) — присутствуют все, в порядке секций
  тела issue.

## Находки

### F1 (Medium, в скоупе задачи) — скоуп-пункт 2 рискует мутировать живой `markers[]` именно в headline-сценарии «слияние/разделение комнат»

Скоуп-раздел ТЗ формулирует: «`beforeConfig` не копирует весь конфиг»
(замена сегодняшнего `beforeConfig = JSON.parse(JSON.stringify(liveCandidate))`,
`src/houseplan-editor-runtime.ts:2269`). Но `_restoreGeometryStateInConfig`,
которым `beforeConfig` затем наполняется (`:2270`), при заполненном
`state.roomReferences` делает:

```
config.markers ||= [];
restoreMarkerRoomReferences(config.markers, state.roomReferences);
```

(`src/houseplan-editor-runtime.ts:1976-1979`). А
`restoreMarkerRoomReferences` **мутирует переданные объекты `marker` на
месте** (`marker.room_id = ...`, `marker.vacuum.segment_map = ...`,
`src/room-reference-transaction.ts:51-73`), а не заменяет массив целиком.

`state.roomReferences` заполняется ровно в headline-сценарии ТЗ —
слиянии комнат: `_commitMerge` делает
`before.roomReferences = referenceRewrite.before`
(`src/houseplan-editor-runtime.ts:6433-6436`) перед вызовом
`_commitPhysicalGeometry(this._t('history.merge_rooms'), before)`.

Если «не копирует весь конфиг» на практике означает частичное
клонирование (например, `{ ...liveCandidate, spaces: [spaceCopy] }` без
отдельного глубокого клонирования `markers`), то `beforeConfig.markers`
окажется тем же массивом объектов, что и `liveCandidate.markers` (живой,
отображаемый конфиг редактора). Тогда вызов
`_restoreGeometryStateInConfig(beforeConfig, before)` внутри
`_junctionLimitsIntroduced` — нужный только для СРАВНЕНИЯ с прежним
документом — фактически перепишет `room_id`/`vacuum.segment_map` у живых
маркеров ДО решения о допустимости записи. Это произойдёт даже если
коммит затем будет отклонён проверкой лимитов стыков (`introduced.length`
→ ранний `return false` на `:2274-2279`): откат идёт через
`_restoreGeometryStateLocal(before)`, который не доказанно восстанавливает
только что испорченные ссылки маркеров на комнаты — риск именно «данные»
(корректность `room_id`/`vacuum.segment_map` живого маркера, биндинг
устройства на комнату).

Раздел «Риски» ТЗ прямо указывает: «Классы риска: геометрия — AC2/AC4;
объём/performance — AC1/AC6; **визуал/async/данные/права/host — нет**».
Эта классификация расходится с прямым следствием собственного
скоуп-пункта 2 для headline-сценария задачи. Ни один AC не формулирует
защиту конкретно для «слияние комнат с привязанным к комнате маркером,
коммит отклонён проверкой стыков → содержимое/идентичность `markers[]`
не меняется» — AC3 защищает только записи ДРУГИХ пространств
(«После коммита на этаже A записи этажей B/C»), а не маркеры текущего
пространства при отклонённой записи.

Это не довод за «нельзя реализовать»: одно из нескольких безопасных
прочтений фразы «не копирует весь конфиг» (например, отдельное глубокое
клонирование `markers` при построении `beforeConfig`) полностью снимает
риск. Но ТЗ, как написано, не называет этот риск и не защищает его явным
AC — то есть ровно то «недоговорённое место», которое ревью обязано
поднять (§7.1: «утверждение о поведении, которого нет ни в одном
документе и которое не помечено как предположение, — замечание»).

**Что нужно в ТЗ:** добавить в «Риски» явный пункт о данных
(маркеры/`room_id`/`vacuum.segment_map`) с названной защитой (например,
«`beforeConfig` клонирует `markers` отдельно независимо от сужения
`spaces`») и явный AC/негативный вход: слияние комнат с маркером,
привязанным к сливаемой комнате, коммит отклонён проверкой лимитов
стыков или safe-проверкой → `markers[]` живого конфига побайтно те же,
что до вызова `_commitPhysicalGeometry`.

### F2 (Medium, в скоупе задачи) — контракт «≤1 union на кандидата» проверяется только на сценарии, где он почти наверняка выполняется, и не покрывает headline-сценарии ТЗ

Контракт поведения п.1 формулирует безусловно: «За один
`_commitPhysicalGeometry` число полных сборок `wallBodiesGeometry`/union
для редактируемого этажа не больше одного для кандидата». Но тот же
раздел «Скоуп» оговаривает механизм условно: «повторный preflight
канонизированного кандидата выполняется только если его отпечаток
отличается от живого» — то есть сам автор закладывает случай, где
кандидатских union **два** (живой + канонизированный), когда
`commitWallSegmentModel` меняет `spacePhysicalGeometryFingerprint`
пространства.

Это не краевой случай. `commitWallSegmentModel` → `migrateSpace` →
`assignLineage` (`src/wall-segment-model.ts:500-554, 865-896`)
переназначает `id` атомов/`wall_segments` по геометрическому
перекрытию/наследованию, когда прежних совпадающих id нет. Слияние
комнат убирает одну комнату и заменяет полигон другой
(`src/houseplan-editor-runtime.ts:6437-6449`) без предварительного
присвоения новых `wall_segments` — именно тот путь, где `assignLineage`
создаёт новые границы и, вероятно, новые id, то есть живой и
канонизированный отпечатки, скорее всего, разойдутся. То же вероятно для
добавления колонны и диалога проёма (новая геометрия без заранее
присвоенных id сегментов) — все три входят в «Сценарий»/«Проблема» ТЗ
как равноправные примеры наравне со сменой толщины стены.

AC1, однако, формулирует проверяемый сценарий только как «толщина стены»
— единственный из четырёх примеров, где живой и канонизированный
кандидат, вероятнее всего, идентичны (скаляр `cm` не меняет состав/id
`wall_segments`), то есть именно тот случай, где «≤1» тривиально
выполняется механизмом из скоуп-пункта 1. AC6 («время коммита... до/после»)
не называет, на каком наборе сценариев публикуется измерение. В
результате ТЗ не фиксирует ни числовую границу (1? 2? больше), ни тест
для union-счётчика headline-сценариев «слияние/разделение комнат» и
«добавление колонны» — именно тех, что открывают «Проблему» задачи и,
предположительно, наиболее затратны на large-house (больше геометрии,
чем правка толщины одной стены).

**Что нужно в ТЗ:** либо явно ослабить контракт п.1 до «≤1, когда
canonicalize не меняет отпечаток пространства; иначе ≤2» и добавить
AC/негативный вход на merge/split-room и column-add с named union-счётчиком
(не только perf-репорт AC6), либо (если разработчик докажет, что для
headline-сценариев отпечаток тоже обычно совпадает) явно зафиксировать это
в «Риски» с названным доказательством, а не оставлять как непроверенное
предположение.

## Что проверено и корректно

- Обязательные разделы ТЗ присутствуют и в порядке §7.1; оба первых
  раздела («Сценарий», «Что человек увидит») сформулированы продуктово,
  без терминов реализации.
- Каждая цитата кода и номер строки в разделе «Проблема» ТЗ точно
  соответствуют материалу на dev `09bda8dbe` — проверено построчным
  чтением, расхождений не найдено.
- Контракт «Неизменное» (порядок legacy-safe → канонизация → safe →
  стыки → adopt → история → запись) соответствует фактическому порядку
  вызовов в `_commitPhysicalGeometry` (`:2177-2288`).
- AC4 (fail-closed/fail-open) соответствует реальным `try/catch` веткам:
  `legacySafe=false` на исключении preflight (`:2183`, fail-closed),
  необоснованный baseline возвращает `[]` (`:2128-2131`, fail-open
  как сегодня), исключение проверки кандидата возвращает
  `check_failed` (`:2147-2150`, fail-closed) — все три пути
  инструментируемы инъекцией исключения в unit-тесте, как указано в
  плане.
- Скоуп-пункты 1 и 3 опираются на существующие, уже работающие в проде
  механизмы (`captureWallGeometry`/`sharedGeometry` в `draft-live-commit.ts`;
  однопространственная `canonicalizeConfigGeometryInPlace` в
  `wall-node-delete-menu.ts`/`wall-node-editor.ts`) — не гипотетические
  API, а перенос уже обкатанного паттерна.
- AC5/Resize диагноз подтверждён: `_rszSpaceCandidateGeometry` уже
  захватывает `wallGeometry`, а `_rszCandidateRenderable` на pointerup
  отбрасывает его и строит заново — пятый union, который называет ТЗ,
  реален и воспроизводим чтением.
- Все файлы, упомянутые в «Плане автотестов» (новые и существующие),
  резолвятся в дереве на этом SHA; ссылки не на вымышленные пути.
- «Принято предположительно» корректно выносит технические решения
  (место кэша, однопространственный commit, отсутствие нового кэш-слоя)
  как подлежащие свободному изменению при реализации — соответствует
  правилу §7.1 «всё, чего пользователь не наблюдает, решает автор».
- Release-артефакты и i18n разделы не заявляют новых видимых ключей/UX —
  согласуется с «UX»-разделом («те же диалоги, тексты отказов... новых
  элементов и настроек нет»).

## Чего не проверял

- Исполнение любых автотестов/бенчмарков/gate — не требуется на этапе
  spec (`ciEvidence.result: skipped`, `docs/process/REVIEWER.md` ›
  «Ревью ТЗ»); реализации ещё нет, прогонять нечего.
- Release-ledger `docs/release-ledger/<previous-stable>/1099.json` — не
  создан (реализации нет); классификация `stable-fix` в ТЗ — предположение
  автора, подлежит подтверждению при код-ревью чтением тега, как сам ТЗ
  и оговаривает.
- Текст отчёта аудита #1094 целиком — читал только цитаты, воспроизведённые
  в теле issue #1099; независимая сверка остального отчёта #1094 не
  требуется для оценки этого ТЗ.
- Поведение бэкенда/Python (`tests_backend`) не читал построчно — только
  подтвердил существование целевых файлов по именам из плана автотестов.
- Докрутка производительности (реальные миллисекунды на large-house) —
  не измерял; это задача AC6 после реализации, не предмет spec-ревью.

## Гейты

Этап spec: кодовый Validate/`tsc`/`build`/`npm test`/`gate:small` не
прогонялись — не требуются (`docs/process/REVIEWER.md` › «Ревью ТЗ»,
`PROCESS.md` §8). `run_check` не вызывался: ни один доступный check не
относится к ещё не написанному коду, и оба открытых технических вопроса
(F1, F2) разрешились чтением существующего кода без необходимости
исполнения. Адресных negative-input проверок не проводил — обе находки
статические (логика `restoreMarkerRoomReferences`/`assignLineage`
детерминирована и видна по коду без прогона).

## Маршрут

Доверенный снимок политики: `mode=issues`, `round=1`. Обе находки (F1,
F2) — **в скоупе** задачи #1099 (относятся напрямую к собственным
скоуп-пунктам и контракту этого ТЗ), поэтому идут в тело текущего issue,
а не в `outside_findings`/trusted publisher. Побочных находок вне скоупа
нет.

## Вердикт

High: 0 · Medium (в скоупе): 2 (F1, F2) · Low: 0.

Жёлтый: обе находки — реальные, адресные пробелы контракта/рисков,
которые должны быть закрыты в тексте ТЗ (не в коде — кода ещё нет) перед
переходом в `S5-ready`: явная защита данных маркеров в скоуп-пункте 2 и
согласование численного контракта «≤1 union» с headline-сценариями
merge/split/column, либо названное доказательство, что они тоже
укладываются в «≤1». High отсутствует — обе находки устранимы точечной
правкой текста ТЗ (риск + AC), без пересмотра архитектуры решения.

`route: fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImIwOTY5ZjMxYzg0M2ZhZjY2NmQwODFmNzY5ZDZkYmNiYWEzMDFmMjMyMjI1MzdmMDA4YWZlMWY4ZTViZmEwNjIiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJiYjZiMjRlYmVhNTUyMmYwMTE5MDY5OWMxMTNjYTBkZGY2OTU0ZDZkNTYzZDM2YTAzZmQyNzE1MTVkNGRhZDZkIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDk5LCJzdGFnZSI6InNwZWMiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIwOWJkYThkYmVlOGI1MDU3N2JmYzRhZmZjMzMyYjhjZGE5MTRmNWI0IiwidHJlZSI6ImE2NWQ4YmU5M2I2ZTY0NGZhNmYzZGUzZTQxMmJlOTRmZDYwNTdjZTkiLCJib2R5RGlnZXN0IjoiNTc3OTA5N2UwNzU3NjI0ZGVkN2IxOGU2OTQ4YzU1ZjBlMzg1ZTYyMDY3OTBkNWMwNmE4OTRmNDRmMDUwODA3OCIsInByb2R1Y2VyUnVuIjoiNDA2NTA4MjUzNTQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImU2NTc4N2M5NmVmZjdmMTg3NGY3ZWVhMTMwNDJlY2RjNmVlMzM2ZWQ0MTRmMzQyYWFlNjkzMjk5YTBmMjM2OGEiLCJ2ZXJkaWN0RGlnZXN0IjoiODMxYzBlM2NlMGQ5MjkwMmJjMDYyYmFlOTMyMTE4ZmI5NTk3ODM1NzJjNjA0YTlhNzcyYmZmNWExMjRhZDhlOCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJmOTc3NjkxMTJiOTk3NWEwYmM3YzgwZGM5Njg4YjY5MGJkNzUyYTI5YmMzYjI3OGQwMDM3NmJkNjI1Y2ZkMTAxIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDYzNTM2OTU4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDk5I2lzc3VlY29tbWVudC02NDYzNTM2OTU4IiwiYm9keURpZ2VzdCI6ImQ2NWE4NzkyOTZkMDA2ZDI5NjRiOWRhMmU2MTIxNzM2YjNkNjhkNzkwNTA4MjM2YTc4NzEwNjM2MzBmNGU4YWQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `dev`, коммит `09bda8dbee8b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a65d8be93b6e644fa6f3de3e412be94fd6057ce9`
  ```
  git log --all --format='%H %T' | grep a65d8be93b6e
  ```
- Тело issue: `5779097e0757624ded7b18e6948c55f0e385e6206790d5c06a894f44f0508078`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NzgsIm91dHB1dF90b2tlbnMiOjQxMzU2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE0NjYxOSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjM3Mzg0OTIsImNvc3RVc2RFc3RpbWF0ZSI6MS43NDc4OTA0fV0sInR1cm5zIjo1NCwiZHVyYXRpb25NcyI6NTMxNTQzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS43NDc4OTA0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=78 output_tokens=41356 cache_creation_input_tokens=146619 cache_read_input_tokens=3738492 num_turns=54 -->
