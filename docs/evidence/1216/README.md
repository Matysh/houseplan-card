# #1216 — прямой расчёт кладки и надёжность графа

Baseline: `aecc10148dfdb40f8c6b7c0c6cc2489af254ff4c`. Все данные синтетические.
Выпуска версии и принятия golden в этой задаче нет.

## Граница алгоритма и потребители

`plan-graph-view`, `space-geometry` и ленивый `DemandSpaceModels` регистрируют исходный граф и масштаб
эфемерной проекции. `wall-thickness` выбирает direct builder до legacy кода.
Старый offset/boolean renderer остаётся только для чтения моделей до 11.
`render-exact` намеренно не наследует предел 4096 бит хранимого графа.

| Потребитель | Путь и проверка |
|---|---|
| View и редактор | Общие wall/paper/room caches карточки; browser smoke и native node gesture с принятым ответом |
| Static / fit | `space-render` → `wallBodiesUnionPath`; общий graph registry в `spaceModels` |
| ISO | `iso-scene-render` → общий результат; адресный scene test и настоящая сцена карточки |
| PDF | `pdf/pdf-scene` → `physicalBodyParts` + `wallBodiesGeometry`; адресные PDF scene tests |
| Preview узла | Сохраняется ограниченный граф с исходными ID; `wall-node-preview` больше не выбрасывает authority |
| Live Resize | `resizeLiveCandidateSpace` сохраняет accepted graph closure; physical proof возвращает direct geometry, её узлы и coordinateScale идут в preview/P5 без повторного legacy расчёта; `graph-live-read.test.mjs` |
| Draw / finish | model11 идёт через explicit graph intent и общий `_commitPhysicalGeometry`; старый bounded append — только codec10. Read-only `wallChainLiveCandidateSpace` также сохраняет graph closure; fault injection в `graph-live-read.test.mjs` |
| Preview проёма | Старый локальный crop не знает владельцев графа; model11 использует общий canonical pass с сохранённой структурой |
| Метрики / clean floor | `summary-panel-metrics` и `innerContourForRoom` используют общий room material; независимые floor/decor booleans остаются |
| Контакт / LED | `device-contact-floor` и `led-strip-editor` используют общий material; raw partition quads сохраняют индексацию по record |
| Освещение | `glow-scene` → `recutWallBodiesGeometry`, те же material domains и host/run masks |
| Запись / Optimize | `plan-geometry-preflight` отклоняет failed/degraded geometry; `junction-limits` переводит shared result в normalized scale |

Колонки и декор не принадлежат graph. Их add/edit/delete законны с metadata
intent и прежними physical barriers. Инвентарь `_commitPhysicalGeometry`:
wall segment/partition операции имеют `segments`/`partitions`, толщина —
`thickness`, resize — `resize`, openings — `openings`, room face/split/delete/merge —
соответствующий явный intent. У column_add и не-partition ветвей physical
properties/delete остаётся metadata. Переданный metadata structural edit
отклоняется, edge props явно переносятся перед projection.

`_structuralDraftModel` используется только внутри explicit topology transaction
для численного планирования thickness intervals и поглощения совпадающих
partition carriers при создании room face. Он не строит material domains и
не выносит physical verdict. Его промежуточная проекция не является read model;
физический барьер получает уже подготовленный граф, не этот planning carrier.

Решение владельца от 2026-11-03: дверь/окно режет только свой host/run.
Distinct коллинеарная стена комнаты остаётся непрозрачной даже под перегородкой
с дверью. Прежнее composite-исключение относится к legacy reader. Регрессия
проверяет отдельно исчезновение собственного partition material и сохранение
чужой стены в полной геометрии и light recut, при scale1 и1000.

Порядок комнат уже был canonical ID order в model11. Рендер повторяет этот
порядок, metrics/cards/transfer именуют комнаты по ID. Strict room lookup
сохраняет first-match, selection — reverse-layer lookup; новой сортировки
и wire order нет. Порядок пространств не меняется.

## Геометрический oracle

`test/direct-wall-geometry.test.mjs` проверяет точные площади, membership,
виртуальный T, совпадающие разные ID, настоящие узкие отверстия, dyadic gaps,
2–8 лучей, finite supports, scale/translation/reversal, host-only разрезы
через seam, degraded extra и сохранность исходного графа. Старый boolean join
в model11 dispatch проверяется fault injection.

`demo/capture_direct_wall_geometry.mjs` сравнивает legacy reader, старый
model11 renderer и direct на девяти сценах. Polygon boolean здесь — отдельный
oracle, а не production core. Симметрическая разность кладки проверяется по
`tau*P + 4*tau²*V`; raw coverage и картинка приложены отдельно.

Сохранены прежние исключения: полный двухлучевой drawing-point mitre #310,
4H room facade и вырожденный apex #329/#339. 1.5H относится к multi-ray.
Самостоятельная перегородка не расширяет плиту пола.

У courtyard старый renderer оставляет четыре треугольных отверстия в paper
под непрерывной кладкой (суммарно 78.125 render²); direct оставляет одно
настоящее отверстие двора. Независимый expected: `812.5² - 387.5² = 510000`.
Кладка и размеры отверстия двора совпадают в пределах tau. Это устранение
ложных дырок подкладки, не принятие нового golden. Старый migrator этого
legacy fixture также отказывает `open-cycle:right`; новый terminal path
успешен с original-source bound и TS/Python parity.

256 фиксированных seeds хранят независимые контактные witnesses. Expected
digest фиксирует parity, но не служит oracle корректности: отдельно проверяются
исходный Euclidean R, обязательная incidence, валидность, неизменность source,
перестановки/развороты и idempotence. Есть room-cycle witness и отрицательный
повреждённый source.

## Backend и границы доказательства

Настоящий HA storage/websocket/HTTP harness покрывает первую запись v1/v2,
diagnostic mismatch с принятием серверной пары, undo/node/opening seam,
ACL/CAS после await, atomically rejected room projection, source-before-pair
fault path, downgrade/edit/fresh backup и admin export прошлой reference.
Upload unit corpus моделирует cancel/replacement/append/TTL между immutable
snapshot и завершением worker, устаревший lease и single-use consume.

Критичные продуктовые проверки запускает общий S6 через `finish`. В дополнение
выбраны адресные Node/backend tests и browser smoke. Старый диагностический
`commit-physical-geometry.test.mjs` не объявляется зелёным: на pinned baseline
у него 38 отказов (устаревшие snapshots и неявные structural metadata calls).
Новый guard добавляет закономерные отказы старых неявных thickness calls;
реальный положительный commit с явным intent закреплён отдельной регрессией.

HA E2E перед бетой: **надо**, [houseplan-e2e#15](https://github.com/Matysh/houseplan-e2e/issues/15).
Здесь не выполнялся выпускной HA E2E и не менялся пользовательский стенд.

## Воспроизведение замеров

`demo/benchmark_direct_wall_geometry.mjs --root=<pinned tree> --output=<report>`
и та же команда без `--root` для кандидата. Сначала один полный прогон, затем
другой; сборки и тесты не запускаются параллельно с замерами. По три серии,
пять warmups и двадцать измерений. В отчётах есть raw samples, runner/fixture
hash, source fingerprint, CPU, Node, pinned Chromium, viewport/DPR.

`cold-core` включает свежую graph projection/preparation и material boundary.
Browser cold-open ждёт настоящую кладку, не skeleton; floor switch — готовую
сцену. Node timing включает native pointer capture/move/up, production exact
node reducer в synthetic authority, adoption ответа и два RAF. Это не замер
сетевой задержки или скорости HA. Heap — максимум покадровых samples от создания
карточки до accepted frame, плюс retained heap после forced GC в каждой серии;
кратковременная аллокация и GC внутри одного синхронного task не наблюдаются.
Heap в обычных временных отчётах квантован Chromium и остаётся диагностикой.
Для приёмки памяти `memory.mjs` повторяет journey с
`--enable-precise-memory-info`: три серии, пять warmups и один sampled journey
на серию. Эти отдельные raw reports сравнивают точный покадровый peak и retained
heap при одинаковой длине серий. Их тайминги не подмешиваются в 60 timing samples.
Холодный прогон также сбрасывает static warm-boot placement cache и ждёт
окончания boot/fade/settle/soft и `continuity.state=steady`. Ранний диагностический
прогон измерял тёплый remount с `_bootSoft=true`, поэтому следующая смена этажа
перекрывалась со стабилизацией камеры. Окончательные before/after серии не
используют эти преждевременные cold/switch данные.

Первый кандидат выявил реальную регрессию повторных rational→Number conversions
в AABB-поиске. Профиль `toNumber` объяснил большую часть CPU. Derived rationals
неизменяемы: их rounded projection теперь memoized в WeakMap, polygon boxes
строятся один раз на arrangement. Геометрические predicates/допуски не менялись.
Predicate-only orientation/cross signs очищают положительные знаменатели без
ненужного gcd; отдельный rational oracle проверяет знаки, включая 5000-битный
знаменатель. Точные коллинеарные промежуточные события не передаются далее как
углы итоговой границы. Это не epsilon-cleanup и не удаление настоящих отверстий.

## Осевой профиль первого раунда S6

Все десять timing/memory checks — PASS, `comparison.json`. Временные raw reports:
`baseline.json`, `candidate.json` (по 543 записи); точная память —
`baseline-memory.json`, `candidate-memory.json`. CPU: Intel Core Ultra 7 155H,
WSL, Node22.23.2, Chromium151.0.7922.34, viewport1440×1000/DPR1.

| Операция | Median до → после, мс | p95 до → после, мс |
|---|---:|---:|
| Optimize | 91.74 → 95.06 | 101.34 → 111.18 |
| No-op Optimize | 83.57 → 86.36 | 93.66 → 95.18 |
| Полный physical preflight | 401.93 → 8.92 | 422.31 → 10.24 |
| Холодный core | 139.57 → 50.55 | 149.02 → 56.53 |
| Холодный устойчивый View | 2329.80 → 2346.60 | 2346.60 → 2380.00 |
| Холодная смена этажа | 316.70 → 252.00 | 317.00 → 254.60 |
| Тёплая смена этажа | 183.40 → 183.40 | 183.60 → 183.60 |
| Native node → accepted frame | 714.00 → 761.85 | 764.30 → 846.70 |

Точный покадровый peak heap: 146366841 → 146316247 bytes; retained после GC:
73912100 → 80866212 (+9.41%, бюджет15%). Тайминги внутри15/10% без ослабления.
`sizes.json`, `zip-sizes.json`: JS gzip1200205 → 1208388 bytes,
ZIP2007069 → 2018728 bytes, first-write graph_change74909(v1) → 1052(v2) bytes.
Лимиты размеров ради PASS не менялись.

Сборка с типами — PASS. 217 адресных Node cases — PASS (`node-tests.xml`);
94 адресных backend cases — PASS, включая настоящий HA Store/HTTP/WS.
`browser.json` — настоящая карточка и work-count invariants;
`coverage.json`/`coverage.png` — девять геометрических сравнений.
Обязательный критичный минимум и финальный addressed set выполняются общим
`finish` в очереди; его результат сохраняется процессом в задаче.
