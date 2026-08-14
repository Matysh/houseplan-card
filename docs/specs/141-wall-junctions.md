# Issue #141 — бесшовные стыки перегородок и открытых контуров

Статус: **ТЗ на ревью**  
Дата: 2026-08-14  
Тип: `bug` · приоритет: `P2` · оценка ценности: 8/10 · сложность/риск: 7/10

Issue: [#141](https://github.com/Matysh/houseplan-card/issues/141)  
Ветка: `issue/141-wall-joints`  
Канонические документы: [SCOPE](../SCOPE.md),
[WALL-THICKNESS](../WALL-THICKNESS.md), [CANVAS](../CANVAS.md),
[UX-MODES](../UX-MODES.md), [LIGHT](../LIGHT.md), [SUN](../SUN.md),
[ISOMETRIC](../ISOMETRIC.md), [TOUCH-SUPPORT](../TOUCH-SUPPORT.md).

Решения владельца Q1–Q3 и defaults аналитики приняты 2026-08-14 в issue #141.

## 1. Сценарий и продуктовый контекст

Основная персона — домашний администратор, который в desktop Plan editor с нуля
рисует план либо позднее добавляет к нему независимые перегородки. После второго
клика он должен оценивать уже финальную форму стены, а не ждать замыкания комнаты
или перехода в View, чтобы обнаружить клин, щель либо зуб в стыке.

Это часть J4/J6 из `docs/SCOPE.md`: GUI должен доводить администратора от пустого
холста до правдивого плана без внешнего редактора и сохранять этот план правдивым
при дальнейших изменениях. View и киоск не получают новых действий, но обязаны
показывать ту же физическую кладку и те же световые препятствия.

## 2. Что человек увидит до и после

**До:** два соединённых толстых сегмента выглядят как наложенные прямоугольники:
у прямого угла остаётся ступень/зуб, у непрямого — клиновидный разрыв; открытая
комнатная стена исправляется только после замыкания контура.

**После:** намеренно соединённые сегменты сразу, включая live rubber-band,
образуют одно ровное тело с тем же ограниченным mitre/bevel, которое человек
видит у готовой комнаты; после клика, замыкания или перехода в View форма не
прыгает.

## 3. Проблема и подтверждённая причина

1. `drawWallPreviewD()` использует `outset − inset` только для закрытого
   контура. Открытый путь создаётся как несколько независимых прямоугольников.
2. `partitionBody()` правильно создаёт один сегмент с плоскими торцами, но
   `physicalBodies()` передаёт набор таких прямоугольников без топологии узлов.
3. Polygon union удаляет перекрытие прямоугольников, но не может догадаться,
   какой отсутствующий сектор следует достроить в endpoint↔endpoint углу.
   Поэтому прямой и косой угол показывают один механизм в разном масштабе.
4. Закрытая комната проходит другой путь: смежные рёбра одного polygon получают
   offset-line intersection с `MITRE_LIMIT`, поэтому её углы нормализованы.
5. Full/static/isometric render уже объединяют независимые тела с кладкой, но
   Glow и солнце местами обходят исходные прямоугольники отдельно. В результате
   визуальная щель может стать реальным световым просветом, а внутренняя грань
   перекрытия — ложным окклюдером.
6. Предположенный в исходном описании отдельный дефект свободного торца по
   приложенному скриншоту не подтверждён: видимый нижний левый зуб находится в
   стыке двух сегментов. Одиночный корректный сегмент уже имеет плоский cap.

## 4. Решения владельца

1. Исправление охватывает точные endpoint↔endpoint и endpoint↔line (T)
   соединения, которые могут создать инструменты «Контур» и «Перегородка» после
   #137, между active/saved draft, partition и готовой комнатной стеной.
2. Rubber-band до клика использует тот же join, что сохранённое тело; клик не
   меняет внешнюю форму стыка.
3. Свободный конец остаётся плоским. Отдельные round/square cap, настройка cap
   или новый UX не вводятся.
4. Существующие сегменты не дробятся и сохранённый config не переписывается ради
   вычисляемого T-узла.
5. Случайное X-пересечение без endpoint сохраняет текущую union-семантику и не
   становится новым persisted node.

## 5. Scope

В задачу входят:

1. вычисляемая топология точных узлов у `room_drafts` и `partitions`;
2. бесшовные endpoint↔endpoint углы: прямые, острые и тупые;
3. endpoint↔line T-соединения с partition, saved draft и комнатной стеной;
4. open-draft preview после размещения сегмента и rubber-band до следующего
   клика/замыкания;
5. собственная толщина каждого уже размещённого сегмента и текущая толщина
   rubber-band;
6. одна joined geometry для full View, Plan, static card, hidden isometric,
   clean floor/area, Glow, sun и проверки источника внутри кладки;
7. сохранение per-object geometry для выбора, hit testing, drag, properties,
   удаления и Undo/Redo;
8. unit, targeted production-bundle smoke, golden и performance regression
   coverage;
9. пользовательская и архитектурная документация плюс RU/EN changelog.

## 6. Non-scope

В задачу не входят:

- изменение snap tolerance, приоритетов или overlay из #137;
- автоматическое дробление room/draft/partition в persisted config;
- превращение partition в комнатную границу, разбиение комнаты или HA area;
- новый тип persisted node/junction и миграция старых планов;
- новый cap/join selector, round cap, декоративные окончания и материалы;
- изменение opening/open-span, wall thickness, Split или Resize semantics;
- исправление #138 про замыкание контура по углам существующей комнаты;
- изменение furniture magnet, opening placement либо selection UX;
- touch parity редактора сверх действующего safety floor;
- новые backend API, HA service calls, зависимости или i18n-тексты.

## 7. Контракт геометрии и поведения

### 7.1. Что считается соединением

1. Узел вычисляется только из координат, уже совпавших по действующему
   grid/wall-bound snap и geometry epsilon. Визуально близкие, но разные точки
   автоматически не стягиваются.
2. Endpoint↔endpoint — общий конец двух или более segment centrelines.
3. Endpoint↔line — endpoint одного segment точно лежит на сплошном интервале
   другого. Для вычисления тела проходящий segment можно временно представить
   двумя incident rays, но его persisted запись остаётся одной.
4. Opening и open-span gap не является физической линией комнатной стены и не
   создаёт join с ней. Independent partition/draft не получает проём только
   потому, что совпал с room opening.
5. Пересечение двух внутренних точек без endpoint не создаёт node metadata;
   наложившиеся физические объёмы по-прежнему соединяются обычным boolean union.

### 7.2. Endpoint↔endpoint corner

1. Исходные segment bodies растут на `½ thickness` по обе стороны centreline.
2. Внешние offset faces смежных incident rays пересекаются в mitre point.
3. Если расстояние до точки пересечения не превышает
   `MITRE_LIMIT × max(adjacent half-depth)`, отсутствующий сектор включается в
   joined body.
4. Если предел превышен либо устойчивого пересечения нет, применяется bounded
   bevel. Бесконечный spike, self-intersection, щель и незаполненный зуб
   недопустимы.
5. Для коллинеарных продолжений результат — один прямой wall run без внутреннего
   торца. Для разворота назад/нулевой длины новая неоднозначная кладка не
   создаётся.

### 7.3. T-соединения и комнатные стены

1. Branch, endpoint которого лежит на другом solid segment, входит в тело
   проходящей стены без щели и без видимой внутренней butt-face.
2. Для готовой комнатной стены authoritative room ring/exterior shell не
   перестраивается по правилам partition. Joined independent geometry
   объединяется с уже готовой `wallBodiesGeometry()` после opening cuts, как и
   сейчас; partition не пробивается совпавшим room opening.
3. Подключение к exterior corner не меняет наружный фасад комнаты за пределами
   реального independent body и не возвращает регрессию #123.
4. Разная толщина incident segments не усредняется и не записывается обратно.
   Joined contour переходит между их реальными offset faces без прозрачной щели.

### 7.4. Свободные торцы и сложные узлы

1. Узел степени 1 заканчивается текущим плоским cap на исходном endpoint.
2. В узле степени 3+ объединяется volume всех incident bodies и только
   ограниченные join patches. Алгоритм не должен заполнять произвольный круг
   вокруг узла или расширять кладку дальше bounded mitre/bevel envelope.
3. Zero-length, non-finite или уже отклонённый schema segment не создаёт body или
   join patch и не ломает остальные валидные тела.
4. Порядок records, id и направление `a↔b` не меняют результат.

### 7.5. Live preview

1. После каждого законченного segment открытый контур показывает joined body
   немедленно; замыкание не является первым моментом нормализации.
2. Если есть cursor candidate, rubber-band присоединяется к предыдущему segment
   и к точному target endpoint/line тем же bounded join.
3. Предыдущие segment используют сохранённые `room_drafts[].segments[].cm`, а
   rubber-band — текущее session thickness. Изменение поля толщины не
   перерисовывает уже сохранённые segment новой толщиной.
4. При клике outer contour rubber-band становится committed contour без скачка;
   допустимо только изменение preview/editor styling.
5. При закрытии простой комнаты все уже существовавшие вершины совпадают с
   нормализованной формой готовой комнаты в пределах geometry epsilon.

### 7.6. Единая физическая семантика

Для валидного сохранённого плана один structural result определяет:

- full Plan/View wall-body path;
- `houseplan-space-card` wall-body path;
- hidden isometric wall footprint/faces;
- subtraction из clean floor и вычисляемой площади;
- Glow barriers и fail-dark source placement;
- sun occluders.

Ни один consumer не должен заново обходить raw segment rectangles как будто их
внутренние butt-faces являются наружными стенами. Raw per-object body остаётся
доступным только там, где требуется identity редактируемой записи: hit,
selection frame, drag/properties/delete и history snapshot.

### 7.7. Ошибки вычисления

1. На валидных schema/snap inputs joined pass обязан быть детерминированным.
2. Malformed legacy input не должен превращать видимую стену в прозрачность:
   fallback остаётся conservative/opaque и не пишет config.
3. Boolean failure не разрешается маскировать исчезновением кладки, световым
   проходом или миграцией данных. Диагностический fallback может вернуть raw
   bodies с прежним визуальным дефектом, но plan и light должны fail consistently
   opaque.

## 8. Архитектурный контракт реализации

### 8.1. Structural physical frame

Реализация вводит один чистый вычисляемый frame (точное имя свободно), который
получает room walls/open cuts/openings, partitions, room drafts, columns и scale
inputs и возвращает как минимум:

- raw bodies с source identity для редактора;
- joined independent geometry;
- объединённую room + independent masonry geometry для presentation/occlusion;
- стабильный structural fingerprint либо данные для существующего cache key.

Join topology строится из centreline segments и их half-depth, а не из SVG DOM,
stroke-linejoin или raster measurement. Columns остаются обычными closed bodies
и участвуют в union, но не становятся incident wall rays.

### 8.2. Canonical consumers

`wallBodiesGeometry()` остаётся канонической точкой room masonry либо получает
эквивалентный единый wrapper; full/static/isometric не создают разные join
алгоритмы. `_lightBarriers` получает outer/hole rings объединённой opaque geometry,
а не внутренние грани перекрывающихся raw rectangles. Clean-floor и source guard
используют тот же joined result.

Preview использует тот же pure node/join primitive, но может строить только
активный path плюс локально необходимые target segments. Он не мутирует и не
инвалидирует saved structural frame на каждый pointermove.

### 8.3. Cache и invalidation

1. Saved topology пересчитывается только при structural geometry change:
   coordinates, cm, room/opening/open-span topology, `cell_cm` или grid/scale.
2. HA state, theme, hover, cursor, Glow brightness и animation tick не входят в
   saved geometry key.
3. Live rubber-band допускает дешёвый локальный расчёт на pointermove; полный
   boolean union всего дома на каждый move запрещён.
4. Full/static/isometric/light consumers переиспользуют structural result либо
   эквивалентный immutable geometry, а не копируют O(N²) node search.
5. Cache остаётся bounded и очищается существующими lifecycle hooks.

## 9. Модель данных, compatibility и миграция

- `rooms`, `walls`, `room_drafts`, `partitions`, `wall_columns`, `openings` и
  `open_spans` не меняют schema.
- Backend validation, storage version, import/export и Python model не меняются.
- Старые планы получают исправленную вычисляемую форму при чтении без записи.
- Hover, preview, render и cache warm-up не вызывают config/layout/storage write.
- Undo/Redo продолжает хранить существующие geometry snapshots; одна partition
  остаётся одной записью и одним history action.
- Прямой и обратной миграции нет.

## 10. UX, i18n, accessibility и touch

Новых controls, диалогов, toasts, focus/keyboard semantics и текстов нет;
следовательно, новые RU/EN i18n keys не требуются.

Plan editor остаётся desktop-first. На touch/coarse pointer новый hover parity не
обещается, но если существующий tap создаёт segment, его сохранённая geometry
обязана быть той же; pinch, pointercancel и synthetic click не могут сохранить
лишний segment. View/киоск остаются полностью поддержанными и получают ту же
исправленную форму без новых взаимодействий.

Selection frame и handles могут показывать границу конкретной редактируемой
записи поверх общего wall body; это editor chrome, а не альтернативная физика.
Forced colours и `prefers-reduced-motion` не получают новой ветки поведения.

## 11. Производительность и безопасность

**Производительность:** large-house fixture уже содержит 60 partitions. Новая
топология не должна пересчитываться на HA state tick, создавать unbounded cache
или ослаблять действующие budgets. Перед бетой обязательны exact-SHA performance
smoke и Full Performance; изменение budget допускается только отдельным решением
процесса, не в #141.

**Безопасность:** HA permissions, services, locks, network, HTML и внешние данные
не меняются. Главный safety invariant — нарисованная кладка, clean floor и
окклюдер совпадают. При ошибке вычисления приоритет у непрозрачного fail-closed
поведения, а не у сохранения декоративной картинки.

## 12. Acceptance criteria

- **AC1 (`unit` + `golden`; разработчик):** open draft из двух segment с общим
  endpoint при 90°, остром и тупом угле образует один body без gap, tooth,
  overlap seam или неограниченного spike; до замыкания и после замыкания уже
  размещённые вершины геометрически совпадают в пределах epsilon.
- **AC2 (`unit` + `smoke` + `golden`; разработчик):** rubber-band до клика
  использует тот же bounded mitre/bevel к предыдущему segment и к выбранному
  endpoint/line target; commit не меняет outer contour, кроме preview styling.
- **AC3 (`unit`; разработчик):** каждый segment сохраняет собственную толщину,
  `MITRE_LIMIT = 4` ограничивает spike, excess angle переходит в bevel,
  collinear continuation не имеет внутреннего cap, а degree-1 endpoint остаётся
  плоским.
- **AC4 (`unit` + `smoke`; разработчик):** две и более saved partitions с точным
  endpoint↔endpoint соединением дают одинаковую joined geometry для прямого и
  косого угла независимо от record order, id, направления и допустимой разной
  толщины.
- **AC5 (`unit` + `smoke`; разработчик):** endpoint↔line соединение с partition,
  saved draft и solid room wall образует бесшовный T-body; target record не
  дробится, room/partition/draft config до и после render/hover побайтно
  эквивалентен.
- **AC6 (`unit`; разработчик):** near-miss вне geometry epsilon остаётся
  раздельным, opening/open-span gap не создаёт room-wall join, incidental X без
  endpoint сохраняет union semantics, zero-length/non-finite segment не портит
  валидные neighbours.
- **AC7 (`unit` + `smoke` + `golden`; разработчик):** full Plan/View,
  `houseplan-space-card` и hidden iso получают один joined footprint: крупный
  прямой/косой стык не показывает внутреннюю butt-face, зуб или второй hatch.
- **AC8 (`unit` + `smoke`; разработчик):** clean-floor area, Glow barriers,
  source-inside-body guard и sun occlusion используют joined geometry: свет не
  проходит через corner/T join и не блокируется внутренней гранью бывшего
  overlap.
- **AC9 (`smoke`; разработчик):** hit/selection/drag/properties/delete и Undo/Redo
  сохраняют identity отдельных partitions/draft segments; joined render не
  объединяет записи в config и не меняет их history granularity.
- **AC10 (`unit` + code review; разработчик/ревьюер):** room wall openings,
  virtual-T, nested/partial walls, exterior shell #123, columns и одиночные
  partitions сохраняют действующую геометрию; совпавший room opening не режет
  independent wall.
- **AC11 (`performance` + code review; разработчик/ревьюер):** structural joined
  pass cached/bounded, HA state и pointer hover не запускают full-house topology,
  60-partition fixture проходит существующие budgets без их ослабления.
- **AC12 (`unit` + backend/schema review; разработчик/ревьюер):** schema,
  serialized config, backend, import/export, i18n, HA/network calls и зависимости
  не меняются; старый plan исправляется без migration/write.
- **AC13 (`typecheck` + `unit` + `build` + documentation review; разработчик):**
  implementation-loop gates зелёные; три bundle-копии после build побайтно
  одинаковы; RU/EN changelog и перечисленная документация обновлены в том же
  user-visible implementation commit.

## 13. План автотестов

### 13.1. Unit

Добавить geometry regression tests в `test/physical-geometry.test.mjs`,
`test/wall-thickness.test.mjs` либо отдельный узкий файл:

1. сравнить joined L-body с ожидаемым offset envelope для 90°, acute и obtuse;
2. проверить bounded mitre и bevel threshold вокруг `MITRE_LIMIT`;
3. проверить equal/unequal thickness, reversed endpoints и permutation records;
4. проверить collinear run, flat free caps, zero-length и near-miss;
5. проверить T partition→partition, draft→partition и partition→solid room wall;
6. проверить gap/open span и X-crossing contract;
7. сравнить open-preview committed vertices с closed-room ring;
8. доказать, что предыдущие draft segment сохраняют свой `cm`, когда current
   session thickness меняется;
9. проверить clean-floor boolean area и united opaque rings для Glow/source/sun;
10. regression: openings do not cut extras, columns unchanged, #123 exterior,
    virtual-T и nested wall remain green;
11. проверить immutability inputs и structural fingerprint/cache invalidation.

Минимум один новый test должен быть запущен/проверен ревьюером на `origin/dev` и
краснеть на старой прямоугольной geometry, а не только подтверждать новый helper.

### 13.2. Targeted production-bundle smoke

Добавить `demo/smoke_wall_junctions.mjs` либо эквивалент:

1. открыть Plan editor и нарисовать open draft с прямым и косым join;
2. проверить rubber-band path до click и отсутствие geometry jump после click;
3. создать две partitions endpoint↔endpoint и новую partition через line-snap #137
   к середине существующей wall/partition;
4. проверить единый body path, отсутствие split target record и no-write hover;
5. переключить Plan → View → static card → hidden iso и сравнить footprint/bbox
   signatures;
6. проверить selection/drag/Undo/Redo отдельных records;
7. поставить Glow source и sun case по разные стороны junction и подтвердить
   opaque/no-false-edge result;
8. проверить pointercancel/pinch/suppressed click — новых records нет.

По процессу smoke пишется вместе с кодом, но полный browser-suite запускается
только перед бетой.

### 13.3. Golden

Добавить deterministic joined-wall scenario минимум с кадрами:

- Plan/light: committed 90° и oblique open-draft joins плюс active rubber-band;
- Plan/dark: endpoint-to-line T-preview поверх существующей partition/room wall;
- View/static/iso: saved 90° и oblique partitions с крупно читаемым outer contour;
- lighting при необходимости: junction рядом с Glow pool, чтобы щель не стала
  световой полосой.

Не связанные View baselines с одиночными partitions должны остаться
pixel-identical. Любые затронутые эталоны принимаются только из полного
просмотренного Linux artifact через
`npm run golden:accept -- --reviewed`; локальное принятие ради зелёного CI
запрещено.

### 13.4. Performance и backend

Перед бетой прогнать существующий `large-house-v1`/performance smoke с 60
partitions и Full Performance на точном SHA. Если для локального join-preview
нужен отдельный профиль, он получает новый id и не переопределяет старый budget.

Backend не меняется; отдельный backend test не требуется. Полный Linux Validate
остаётся release gate.

## 14. План реализации

1. Выделить чистое представление linear physical segments и exact junction
   topology с source identity.
2. Построить bounded mitre/bevel node patches и joined independent geometry.
3. Разделить raw editable bodies и canonical joined presentation/physics frame.
4. Подключить joined frame к full/static/isometric, clean floor, Glow/source guard
   и sun, сохранив opening ordering.
5. Перевести open-draft/rubber-band preview на тот же join primitive и per-segment
   thickness.
6. Добавить unit и targeted smoke; подготовить golden/performance fixtures.
7. Обновить документы, оба changelog и поставляемые bundle-копии.

Точные имена helpers/files не являются продуктовым контрактом.

## 15. Release-артефакты

Изменение пользовательское. Implementation-коммит имеет `User-Visible: yes` и в
том же коммите обновляет:

- `docs/CHANGELOG.md`;
- `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — рисование открытых контуров и partitions;
- `docs/WALL-THICKNESS.md` — independent joined-body/cap/mitre contract;
- `docs/ARCHITECTURE.md` — raw editable bodies против canonical joined frame;
- `docs/LIGHT.md` и при необходимости `docs/SUN.md`/`docs/ISOMETRIC.md` — единый
  opaque geometry consumer;
- `docs/TESTING.md` — unit/smoke/golden coverage;
- `docs/STATUS.md` — релизная линия после фактической реализации;
- три поставляемые bundle-копии, создаваемые build/release-процессом.

Перед бетой обязательны exact-SHA Linux Validate, полный smoke-suite, просмотр и
reviewed acceptance Linux golden artifact, performance smoke и Full Performance,
а также зелёный code review. Отдельный security report не требуется: новых
внешних данных, вызовов и разрешений нет. Изменение проходит beta до stable.

## 16. Риски и снижение

| Риск | Вероятность / ущерб | Снижение |
|---|---|---|
| Pairwise patch переполнит узел степени 3+ | средняя / высокий | radial/node envelope units, T/Y matrix, bounded area assertion |
| Разная толщина усреднится или даст self-intersection | средняя / высокий | per-ray half-depth и boolean difference tests |
| Plan исправится, а Glow/sun сохранят raw butt-faces | средняя / высокий | один canonical joined frame и occlusion smoke |
| Opening случайно прорежет coincident partition | средняя / высокий | сохранить union extras after cuts, regression unit |
| Selection потеряет identity после union | средняя / высокий | raw bodies отдельным editor-only channel, drag/Undo smoke |
| Room exterior изменится при attached partition | низкая / высокий | #123 exterior regression и room-ring authority |
| Live preview начнёт делать full union на pointermove | средняя / высокий | local target subset, performance/code review AC11 |
| Старый near-miss внезапно соединится | средняя / средний | exact epsilon contract и explicit near-miss test |
| Boolean failure сделает стену прозрачной | низкая / высокий | conservative opaque fallback и malformed fixture |
| Golden изменятся шире joined cases | средняя / средний | baseline diff audit; unrelated single partitions pixel-identical |

## 17. Откат

Откат — revert user-visible implementation commit #141 вместе с тестами,
документацией, changelog и bundle-копиями. Schema и persisted data не меняются,
поэтому migration/data rollback не нужны; после отката вернётся прежний
визуальный дефект прямоугольных bodies.

Красный golden/performance gate перед бетой блокирует выпуск. Feature flag,
ослабление budget или принятие baseline без review не используются как обход.

## 18. Принятые технические предположения — можно менять без продуктового ревью

1. Junction epsilon переиспользует существующий grid/geometry tolerance и не
   вводит пользовательскую настройку.
2. Рекомендуется immutable `PhysicalGeometryFrame` либо эквивалент с raw и
   joined projections; точное имя и раскладка файлов свободны.
3. Node patches могут строиться вручную через offset intersections или через
   другую deterministic boolean decomposition, если все AC выполняются.
4. Room-wall geometry может оставаться внутри `wallBodiesGeometry()` либо быть
   обёрнута общим helper; второй независимый renderer запрещён.
5. Preview может добавлять локальный patch поверх existing saved body либо
   строить небольшой joined subset; DOM decomposition не важна при отсутствии
   seam/jump.
6. Cache может использовать `_cfgEpoch` плюс structural fingerprint или полный
   fingerprint; HA state/theme/cursor не входят в saved key.
7. Selection frame вправе показывать raw body выбранной записи, если base wall
   body остаётся joined и hit order не меняется.
8. Имена smoke/golden scenarios и точные test files не являются продуктовым
   контрактом.
9. Для malformed legacy fallback допустимы raw opaque bodies; валидные schema
   inputs обязаны проходить joined path без fallback.
10. Нет открытых продуктовых вопросов: Q1–Q3 и предложенные 8/10 · P2 приняты
    владельцем 2026-08-14.
