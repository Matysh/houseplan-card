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

Размеры записываются без изменения лимитов ради PASS. Итоговые результаты и
сырые отчёты прикладываются после окончательного прогона.
