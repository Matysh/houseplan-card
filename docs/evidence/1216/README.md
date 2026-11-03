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

## Итог S6 после первого код-ревью

Все **21 timing/memory checks — PASS** без изменения бюджетов: median≤1.10,
p95≤1.15, peak/retained heap≤1.15. Продуктовый источник:
`865ece616231652b42602a9f5c74615acdbe27f1`, build fingerprint
`844d4ecb4c6af8a5c81c234203ebab642705fc87ee165df8fc34775e0a4121b9`.
CPU: Intel Core Ultra 7 155H, WSL, Node22.23.2, Chromium151.0.7922.34,
viewport1440×1000/DPR1. Сборки и другие product runs с замерами не совмещались.

### Large-house / selective-invalidation

Один осевой fixture: 3×20 комнат, 200 активных markers. `baseline.json`,
`candidate.json` — по543 raw records; `baseline-memory.json`,
`candidate-memory.json` — отдельная точная память. `comparison.json`: 10 PASS.
Сохранённый baseline переиспользован с **тем же байтовым runner из c90041db**
(SHA256 `0dcd714d030d86a6378c07f7cf682f28ecfa2d72d194bf46a9621677e2e4ac61`),
который повторно запущен на окончательных продуктовых исходниках. Его относительные
импорты требуют расположения в `demo/`; идентичная копия под другим именем
в этой папке также сохраняет runner hash. После замера текущий runner восстановлен.
У product source/build входы не подменялись.

| Операция | Median до → после, мс | p95 до → после, мс |
|---|---:|---:|
| Optimize | 91.74 → 89.71 | 101.34 → 104.12 |
| No-op Optimize | 83.57 → 80.20 | 93.66 → 96.32 |
| Полный physical preflight | 401.93 → 6.04 | 422.31 → 8.04 |
| Холодный core | 139.57 → 26.93 | 149.02 → 30.85 |
| Холодный устойчивый View | 2329.80 → 2346.30 | 2346.60 → 2362.90 |
| Холодная смена этажа | 316.70 → 233.40 | 317.00 → 233.60 |
| Тёплая смена этажа | 183.40 → 183.40 | 183.60 → 183.60 |
| Native node → accepted frame | 714.00 → 547.75 | 764.30 → 590.60 |

Максимум покадрового heap по трём сериям: 146366841 → 144049418 bytes;
максимум retained после GC: 73912100 → 74897844 (+1.33%).

### Small / junction и кадр проёма

`directWallJunctionLoad`: диагональная комната, восьмилучевой узел с разной
толщиной, отдельный стык ≈20°, перегородки, колонка и дверь рядом с узлом.
`junction-baseline.json`, `junction-candidate.json` — по843 records, включая
60 whole journeys и300 отдельных native opening frames. Три серии ×
(5 warmups+20 samples); пять pointermove на проём в каждом journey.
Кадр измеряется от native move до завершения live paint, с IPC и RAF;
Save ACK не входит в эту метрику. Heap sampler продолжает работать и на фазе
проёма. `junction-*-memory.json`: три серии ×(5 warmups+1 sampled journey),
тот же precise flag; maxima, не медианы. `junction-comparison.json`: 11 PASS.

| Операция | Median до → после, мс | p95 до → после, мс |
|---|---:|---:|
| Optimize | 25.87 → 25.79 | 30.05 → 30.92 |
| No-op Optimize | 23.19 → 22.94 | 24.93 → 26.75 |
| Полный physical preflight | 56.09 → 1.46 | 63.72 → 2.17 |
| Холодный core | 20.72 → 16.83 | 22.81 → 19.75 |
| Холодный устойчивый View | 2280.95 → 2264.85 | 2297.30 → 2289.50 |
| Холодная смена этажа | 200.00 → 183.50 | 200.30 → 200.10 |
| Тёплая смена этажа | 183.30 → 183.30 | 183.50 → 183.60 |
| Native node → accepted frame | 213.25 → 212.05 | 238.70 → 237.00 |
| Native opening frame | 80.61 → 80.71 | 90.42 → 81.27 |

Peak heap: 58270167 → 63874263 bytes (+9.62%); retained:
24748572 → 26989084 (+9.05%). Команды сравнения:
`node docs/evidence/1216/compare-profiles.mjs` и та же команда с `--axial`.

Новый junction-профиль сначала выявил реальные CPU/heap регрессии. Они не
объявлены PASS: промежуточные замеры остаются диагностикой. Устранены лишние gcd
в рациональной арифметике, пересечения вычисляются целочисленными homogeneous
determinants с сокращением только итоговых координат; predicate и clipping
сохраняют точность. Новый oracle сравнивает арифметику с независимым persisted
rational codec, включая 5000-битный derived знаменатель.
Bounded512 memo неизменяемых dyadic coordinates уменьшает аллокации.
Opening continuity переиспользуется по graph/kind/scale; масштабируется уже
готовая normalized projection, без повторного решения графа. Carrier mutation
и replacement graph покрыты отдельной регрессией. Component cache принадлежит
immutable structure и переиспользует результат только при тождественном составе
полигонов; изменившиеся/объединившиеся компоненты пересчитываются, failures не
кешируются. Проём не заставляет перестраивать независимые неизменные компоненты.

Сборка с типами — PASS. 240 адресных Node cases — PASS (`node-tests.xml`);
95 адресных backend cases — PASS, включая настоящий HA Store/HTTP/WS.
`browser.json` — настоящая карточка и work-count invariants;
`coverage.json`/`coverage.png` — повтор девяти геометрических сравнений;
bitmap SHA256 совпадает с просмотренным первым раундом.
`sizes.json`, `zip-sizes.json`: JS gzip1200205 → 1209272 bytes,
ZIP2007069 → 2019587 bytes, first-write graph_change74909(v1) → 1052(v2) bytes.
Это сравнительный ZIP в памяти, не выпуск версии. Лимиты ради PASS не менялись.
Критичный минимум и финальный addressed set выполняются общим `finish` в очереди;
его результат сохраняется процессом в задаче.
