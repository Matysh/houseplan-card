# Issue #277 — безопасный Resize без изменения топологии

- **Issue:** https://github.com/Matysh/houseplan-card/issues/277
- **Статус:** первая редакция для ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 10/10; ценность для разработки 10/10;
  сложность 9/10; риск 10/10
- **Область:** Plan Resize, room polygons, shared boundaries, thickness/openings,
  live preview, commit/Undo, geometry preflight, i18n и визуальные тесты
- **Модель данных:** schema не меняется; набор room segments остаётся неизменным
- **Связано:** #34, #199, #233, #234, #253, #264, #276, #278,
  `docs/RESIZE.md`, `docs/WALL-THICKNESS.md`, `docs/TOUCH-SUPPORT.md`

## 1. Сценарий и персона

Домашний администратор хочет немного сдвинуть одну стену готовой комнаты, не
перерисовывая план. Текущий Resize разрешает диагональные рёбра, частичные
shared spans, вставляет вершины соседу и отдельно масштабирует комнату угловой
рамкой. На реальном плане эти широкие преобразования рассинхронизировали room
polygons, thickness records, independent partitions и hosted openings; один
результат перестал показывать всю кладку.

После исправления Resize делает только доказуемо безопасную операцию: переносит
одну горизонтальную или вертикальную стену параллельно себе, меняет длину её
двух примыкающих стен без изменения толщины и никогда не меняет число сегментов.
Если гарантии перестают выполняться, live preview физически упирается в первую
границу безопасного диапазона либо ручка остаётся disabled с понятной причиной.

### Что человек увидит до и после

**До:** после перетаскивания одна стена может стать визуально толще или тоньше,
оставить куски на старом месте либо заставить исчезнуть все стены пространства.

**После:** выбранная стена двигается, а всё остальное на плане остаётся как
было; когда безопасно продолжать нельзя, стена видимо упирается и дальше не
идёт. Неподходящую стену нельзя потянуть, и рядом с её ручкой написана причина.

## 2. Решения владельца

Зафиксированы 2026-08-24:

1. Угловой scale-frame удаляется. Resize больше не масштабирует комнату целиком.
2. Двигаются только строго горизонтальные и вертикальные room walls.
3. Запрещённая стена сохраняет видимый disabled handle; hover/click/tap даёт
   короткую человекопонятную причину.
4. Необщая стена меняет положение; две примыкающие перпендикулярные стены
   удлиняются/укорачиваются без изменения толщины и числа segments.
5. Shared wall в начале жеста обязана совпадать endpoint-to-endpoint у двух
   комнат. Неправильная форма комнаты сама по себе допустима.
6. Shared drag продолжается только пока сохраняется исходное exact
   endpoint-to-endpoint соответствие. Перед углом/ступенькой, где следующий шаг
   изменил бы длину moving segment или topology, preview упирается и не идёт
   дальше.
7. За один жест меняются максимум две комнаты. Третья комната не вовлекается в
   каскад: она становится stop/disabled obstacle.
8. Если sliding endpoint дошёл до opening на примыкающей перпендикулярной
   стене, движущаяся кладка упирается в ближний косяк и не перекрывает проём.
9. Opening на самой moving wall продолжает ехать с ней, если после операции
   полностью помещается.
10. Любой нарушенный инвариант отменяет жест целиком; частичной записи нет.

Открытых продуктовых вопросов нет.

## 3. Термины и геометрический допуск

- **Moving edge** — выбранная сторона polygon комнаты между двумя соседними
  topology vertices.
- **Side edges** — предыдущая и следующая стороны того же polygon.
- **Exact shared pair** — ровно два moving edges разных rooms с совпадающими
  endpoints независимо от направления.
- **Topology** — количество, циклический порядок и identity correspondence
  vertices/segments каждой затронутой комнаты.
- **Safe range** — замкнутый диапазон нормального смещения, в котором все
  проверки §5–§7 выполняются.

«Строго horizontal/vertical» допускает только численный шум хранения меньше
canonical coordinate epsilon. Это не пользовательский angle snap: заметно
наклонённая стена не округляется и остаётся disabled. Все сравнения выполняются
в production render coordinates; шаг сетки определяет итоговую позицию, но не
геометрический epsilon.

Если математическая граница safe range лежит между grid nodes, commit получает
ближайший grid node внутри диапазона. Если следующий node схлопнул бы side edge
в ноль, стена визуально доходит до угла, но persisted candidate остаётся на
последней положительной длине не меньше действующего minimum segment tolerance.
Нулевая сторона и удаление vertex запрещены.

## 4. Eligibility и disabled reasons

Для каждого room edge pure resolver возвращает `enabled + plan` либо один
стабильный reason. Порядок причин детерминирован:

1. `diagonal` — moving edge не horizontal/vertical;
2. `side-angle` — одна из side edges не перпендикулярна moving edge;
3. `duplicate-physical-wall` — ось перекрывает partition/draft/column; после
   канонизации #276 точное redundant совпадение исчезает;
4. `partial-shared` — сосед касается только части moving edge;
5. `unequal-shared` — endpoints/длины пары различаются;
6. `multiple-rooms` — moving edge либо swept side geometry вовлекла бы третью
   комнату;
7. `thickness-conflict` — effective thickness пары/side continuation
   неоднозначна либо не может быть перенесена lossless;
8. `opening-conflict` — opening на moving edge уже не помещается даже при
   нулевом смещении либо host неоднозначен;
9. `invalid-geometry` — исходный polygon/physical candidate не проходит
   обязательные structural проверки.

Enabled non-shared edge принадлежит ровно одной комнате. Enabled shared edge
принадлежит ровно двум комнатам и совпадает endpoint-to-endpoint. У обеих
комнат side edges в каждом конце лежат на одной перпендикулярной оси и имеют
совместимую физическую толщину; короткая ступенька или T-contact не переносится
каскадом, а ограничивает safe range.

Disabled handle:

- рисуется тем же размером и hit area, но приглушённо;
- имеет `aria-disabled="true"`, cursor `not-allowed` и локализованный label;
- hover/focus показывает tooltip/hint, click/tap — тот же текст без начала drag;
- не захватывает pointer и не создаёт Undo/save;
- reason не содержит room ids, координат или исключений.

## 5. Преобразование non-shared wall

1. Оба endpoint moving edge получают один snapped normal displacement.
2. Два существующих side edges сохраняют свои противоположные endpoints и
   меняют только длину. Их оси не меняются.
3. Ни vertex, ни segment не добавляется, не удаляется и не переставляется.
4. Комната сохраняет orientation, positive area, simple polygon и действующий
   minimum clearance; foreign rooms/islands/physical extras не пересекаются.
5. Thickness profile каждого из трёх затронутых edges переносится геометрически
   и lossless. Не затронутые wall entries byte-equivalent.
6. Ordinary openings moving edge смещаются тем же вектором; openings side edges
   остаются на месте и определяют stop §7.
7. Partitions, room drafts, wall columns, hosted openings и остальные комнаты
   не меняются.

Общее число room segments всего пространства до/после одинаково; геометрию
меняет ровно одна room.

## 6. Преобразование shared wall

1. Одна geometric moving edge представлена двумя противоположно направленными
   polygon edges ровно двух rooms. Обе копии смещаются одним вектором.
2. Четыре side edges меняют длину вдоль своих исходных осей. Никаких новых
   vertices, `shiftSharedSpans()`-вставок или `simplifyPoly()`-удалений нет.
3. В каждый момент preview endpoints обеих копий совпадают. Если следующий
   delta потребовал бы partial span, смену длины, схлопывание side edge, T-branch
   или третью room, delta clamp'ится к последнему safe положению.
4. Площади меняются только у этих двух rooms: одна растёт, другая уменьшается.
   Другие room polygons byte-equivalent.
5. Shared thickness/open spans преобразуются один раз. Разные destinations,
   conflicting cm либо ambiguous ownership fail closed.
6. Openings moving shared wall смещаются один раз и остаются на той же shared
   boundary. Side-wall openings остаются на месте и ограничивают range.

Если safe range после grid snap содержит только исходную позицию, handle
остаётся visible enabled для объяснимости, но попытка drag даёт stop/no-op и не
создаёт запись.

## 7. Stops и live clamp

Один pure range resolver заранее собирает верхнюю/нижнюю границы normal delta.
`pointermove` только clamp'ит snapped delta и проверяет exact candidate.

Обязательные ограничения:

1. minimum room clearance/positive area/simple orientation;
2. ближайший topology corner, после которого side edge стал бы нулевым либо
   moving edge перестал endpoint-to-endpoint совпадать;
3. foreign/third room, island, partition/draft/column physical body;
4. opening на moving edge должен полностью помещаться после переноса;
5. opening на каждом perpendicular side edge: outer face движущейся стены не
   входит в clear slot opening. Центр moving wall останавливается у ближнего
   jamb с учётом половины собственной физической толщины;
6. никакое opening не меняет host, длину, angle или unrelated compatibility
   fields;
7. canonical wall bodies/floor footprint точного preview не возвращают
   structural failure.

При нескольких stops выбирается ближайший к исходному положению. Clamp
одинаков для обеих сторон drag и не зависит от частоты/порядка pointer events.
Pinch, pan, pointercancel и lostpointercapture отменяют drag, как прежде.

## 8. Preview, commit и Undo

Preview строится каждый раз из immutable pre-drag snapshot и содержит точный
candidate целого пространства: rooms, openings, walls/open spans и неизменные
extras. Render не собирает candidate повторно другим путём.

Перед pointerup commit выполняет единый transaction check:

- touched room ids равны plan и их не больше двух;
- topology signature каждой room не изменилась;
- unrelated rooms/extras/openings byte-equivalent;
- wall/open-span preservation и destinations согласованы;
- exact production geometry preflight успешен;
- повторное применение результата является no-op.

Failure отбрасывает overlay, показывает локализованное безопасное сообщение и
делает 0 config writes/Undo entries. Success выполняет ровно один save и одну
именованную Undo-команду. Undo/Redo восстанавливают/повторяют rooms, openings,
walls и open spans целиком.

## 9. Удаляемое старое поведение

- corner scale frame и четыре corner handles;
- `applyRoomScale`/`clampRoomScale` из production interaction path;
- drag диагональных edges;
- partial shared span movement;
- вставка vertices соседней комнате и commit-time `simplifyPoly`;
- вовлечение цепочки из трёх и более rooms.

Pure helpers могут временно оставаться для backward test history, но не должны
быть reachable из bundle. Мёртвый production code удаляется в этой задаче.

## 10. В скоупе

- safe eligibility/range/candidate pure geometry;
- Resize controller, handles, tooltip/reason and live measures;
- fixed-topology rekey thickness/open spans and ordinary openings;
- exact commit preflight and zero-write failure;
- removal scale-frame/diagonal/partial-shared behavior;
- unit, production-bundle pointer smoke, mutation, benchmark, targeted golden;
- RU/EN i18n, user/canvas/architecture/testing docs и changelogs.

## 11. Не входит

- исправление/канонизация coincident partition (#276);
- generic wall union fail-safe для уже сохранённого bad plan (#278);
- произвольный vertex editor, room scale или diagonal resize replacement;
- изменение толщины, типа стены, room split/merge;
- автопочинка исходно invalid polygon;
- перемещение partitions/drafts/columns;
- touch parity редактора сверх safety floor.

## 12. Архитектура

1. Pure geometry/eligibility остаётся в `src/resize.ts` либо меньших pure
   модулях. Controller integration согласуется с #264 и не создаёт второй
   topology model.
2. Один typed `ResizePlan` содержит room ids, edge indices, fixed topology
   signatures, affected wall/opening mapping, safe delta interval и reason.
3. Один `applySafeResize(snapshot, plan, delta)` используется preview и commit;
   commit не вычисляет другую геометрию.
4. Thickness/open-span mapping использует canonical interval helpers #253, не
   compatibility keys как identity.
5. Structural preflight переиспользует production preparation #199; локальный
   simplified polygon-only check не считается достаточным.
6. No-op/failed drag не меняет `_serverCfg`, cfg epoch, history, layout или
   queued saves. Mid-drag previous save по-прежнему читает committed snapshot.

## 12.1. Риски и меры

| Риск | Мера |
|---|---|
| Сужение функции неожиданно делает привычную стену недоступной | Visible disabled handle и точная причина; positive/negative eligibility matrix AC1–AC4. |
| Corner clamp схлопывает side edge либо меняет число segments | Last safe grid coordinate, fixed topology signature и mutant topology-simplify. |
| Shared drag вовлекает третью комнату через T/partial contact | План содержит максимум два room ids; swept third-room stop и dedicated mutant. |
| Opening stop рассчитан по оси и кладка всё равно перекрывает проём | Physical half-thickness + jamb calculation, все типы openings и targeted golden AC6. |
| Preview проходит, а commit пересчитывает другую геометрию | Один immutable snapshot/`applySafeResize` для preview и commit, AC8/AC9. |
| Thickness/open spans расходятся при переносе | Canonical interval mapping #253, preservation assertions и реальная fixture AC17. |
| Параллельная реализация #264 создаёт второй controller boundary | #277 не зависит от #264 и реализуется на текущей границе; #264 не начинается параллельно, после #277 обязан rebase и refactor-only parity. |
| #276/#278 меняют соседние geometry helpers во время работы | Порядок merge #276 → #277 → #278; перед код-ревью ветка содержит актуальный `dev`, конфликты разрешаются автором с повтором targeted fixtures. |
| Strict checks ухудшают pointer latency | Range вычисляется до drag/мемоизируется, §13 budgets и call-count. |
| Rollback возвращает опасный старый Resize | Полный revert допустим технически, release note предупреждает не редактировать geometry до обновления. |

## 13. Производительность

Eligibility всех handles мемоизируется по exact geometry fingerprint и не
пересчитывает boolean geometry на каждый render. Pointermove p95 на large-house
fixture — не более 16 ms и не более 20% хуже current edge-drag same-run baseline.
Pointerup preflight может быть дороже, но не более 75 ms p95 на fixture; это не
render/state path. Cache ограничен активным пространством и очищается при cfg
epoch/tool exit.

## 14. Touch и accessibility

Plan editor остаётся desktop-first. Все handles сохраняют существующую
finger-sized hit area. Disabled reason доступен focus и tap, не только hover.
Pointer capture начинается только для enabled handle. `pointercancel`,
`lostpointercapture`, pinch и app switch не коммитят. View и kiosk не получают
handles и остаются полностью поддержанными.

## 15. Критерии приёмки

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Только numerically axis-aligned edge eligible; diagonal и non-perpendicular side edges disabled с точным RU/EN reason. | Unit + UI smoke. |
| AC2 | Non-shared drag меняет одну room и длины ровно двух side edges; topology/count/thickness неизменны. | Parameterized unit + invariants. |
| AC3 | Exact shared drag меняет ровно две rooms и сохраняет endpoint-to-endpoint на каждом preview delta. | Unit matrix. |
| AC4 | Partial/unequal/multiple-room/coincident-extra cases disabled; никакие vertices/segments не создаются. | Negative unit + mutation. |
| AC5 | Irregular shared rooms двигаются до первого topology corner; следующий grid step clamp'ится и не схлопывает side edge. | Focused unit + production pointer smoke. |
| AC6 | Side-wall door/window/gate ограничивает delta по физическому jamb; moving body не перекрывает slot с обеих сторон. | Geometry unit + targeted golden. |
| AC7 | Opening на moving edge едет один раз и сохраняет fit/host fields; conflict даёт no-op. | Unit + browser smoke. |
| AC8 | Preview и commit используют один candidate; pointercancel/lost capture/Esc делают 0 writes, pointerup success — 1 write/Undo. | Production-bundle smoke. |
| AC9 | Exact commit preflight ловит wall/floor failure, third-room mutation, thickness loss и topology change до save. | Injectable unit + mutation gate. |
| AC10 | Undo/Redo/reload сохраняют тот же plan, thickness/open spans/openings; repeated save canonical/no-op. | Browser smoke + round-trip unit. |
| AC11 | Corner frame отсутствует, old scale/diagonal/partial-shared handlers unreachable; View/other tools pixel-equivalent. | Source guard + golden. |
| AC12 | Disabled handle доступен mouse/keyboard/touch, reason локализован и pointer не захватывается. | a11y/i18n unit + browser smoke. |
| AC13 | Performance budgets §13 и bounded cache выполняются. | Targeted benchmark/call-count. |
| AC14 | Мутации eligibility bypass, third-room cascade, topology simplify, opening-stop bypass и commit-preflight bypass пойманы 1/1. | Mutation gate. |
| AC15 | Typecheck, unit, build, targeted smokes зелёные; tracked bundles byte-identical. | Fast gates. |
| AC16 | RU/EN changelog и RESIZE/user/canvas/architecture/testing docs описывают суженный контракт. | Docs gate + review. |
| AC17 | Анонимизированная before-fixture из исходного пользовательского плана воспроизводит старое расхождение через production pointer handlers; новый Resize либо безопасно завершает тот же допустимый жест, либо предсказуемо clamp/disabled, сохраняет все walls/extras/openings и не даёт global wall-null. | Fixture provenance test + production-bundle smoke + model invariants. |

## 16. План тестов

- переписать `test/resize.test.mjs` под eligibility/safe-range/fixed topology;
- synthetic fixtures: non-shared rectangle/L-room, exact shared regular/irregular,
  corner clamp, third room, partition duplicate, all opening types;
- `test/fixtures/resize-safe-regression.json`: минимизированная и
  анонимизированная из пары реальных экспортов до/после (названия, ids,
  markers/layout удалены), с provenance-комментарием #277; smoke исполняет
  исходную последовательность pointer gestures, а не подставляет готовый after;
- `demo/smoke_safe_resize.mjs`: реальные pointerdown/move/up, disabled reasons,
  preview/commit/Undo/Redo/reload и zero-write failures;
- targeted golden light/dark: enabled/disabled handles, corner/opening clamp и
  final masonry;
- mutation ids из AC14;
- pointer/preflight benchmark на large-house fixture.

Полные golden/smoke/performance и Linux HA harness выполняются перед бетой.

## 17. Release-артефакты и rollback

Изменение пользовательское. Implementation commit имеет `User-Visible: yes` и
обновляет:

- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` со ссылкой #277;
- `docs/RESIZE.md` как source of truth;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`, `docs/CANVAS.md`;
- `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/STATUS.md`;
- RU/EN i18n, tests/smoke/mutations/benchmark, reviewed golden candidates;
- tracked bundles и docs screenshot fingerprint при затронутом source.

Rollback — revert implementation commit. Schema/persisted migration нет.
Планы, безопасно сохранённые новым Resize, совместимы со старой версией. После
rollback вернётся широкий нестабильный UI, поэтому release rollback должен быть
полным и сопровождаться предупреждением не использовать Resize до обновления.

## 18. Принятые технические предположения

1. Причины disabled имеют стабильный приоритет §4, но внутренние enum names не API.
2. Tooltip использует общий доступный hint primitive; отдельный modal не нужен.
3. Последняя безопасная grid coordinate перед нулевой side edge считается
   пользовательским «упором в угол» и не нарушает запрет изменения topology.
4. Thickness compatibility означает одинаковый физический профиль на
   совпадающих continuations, а не обязательно одно число для всех четырёх
   side edges; конфликт на одном атомарном участке запрещает gesture.
5. #276 реализуется раньше #277; exact redundant partition после Optimize
   исчезает, а оставшийся неоднозначный extra продолжает блокировать handle.
6. Реальная fixture обязательна, но публикуется только после минимизации и
   удаления пользовательских строк; исходные private exports в git не попадают.
