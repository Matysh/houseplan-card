# CODE-REVIEW-189-r1

Issue: [#189](https://github.com/Matysh/houseplan-card/issues/189) · трек: `trivial`
(§5.1) · родитель: #132, найдено при код-ревью #132 r2 (`docs/reviews/CODE-REVIEW-132-r2.md`).
Ветка: `issue/189-partition-snap-gap`, единственный коммит `89789d8` поверх
`origin/dev` (`6846ffb`).

## Скоуп

Диапазон `git log --oneline origin/dev..HEAD` = один коммит `89789d8 fix: cut
partition snap axes at hosted openings`, трейлеры `Issue: #189` ·
`User-Visible: yes`.

Изменённые файлы (`git diff origin/dev...HEAD --stat`):

- `src/houseplan-card.ts` — +1 строка, класс A: передаёт уже существующий
  `_partitionOpeningCuts(space)` в `buildPlanSnapGeometry()`;
- `src/plan-snap-overlay.ts` — класс A: новая опция `partitionCuts`,
  сгруппированная по `hostId`, применяется только к source `kind: 'partition'`
  с совпадающим `id`;
- `test/plan-snap-overlay.test.mjs` — 2 новых unit-теста (класс B);
- `demo/smoke_plan_snap_overlay.mjs` — новый партиционный host-опенинг в
  фикстуре, 3 новые проверки (класс B);
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` — бюллетень RU+EN, тот же
  коммит, `User-Visible: yes` выполнено, терминология («независимый отрезок
  «Стены»») совпадает с `docs/USER-GUIDE.ru.md:430,444,449`;
- `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`,
  `demo/srv/assets/houseplan-card.js` — три копии бандла, класс D, в том же
  коммите, что источник.

Затронутая подсистема — presentation snap-overlay Плана (`docs/CANVAS.md`,
раздел «Architectural connection overlay»); контракт там сформулирован
универсально («Door, window, gate and intentionally open-span intervals are
cut from presentation axes») — код был рассинхронизирован с этим текстом
только для independent-partition host, поэтому `CANVAS.md` не требует правки
в этом коммите (сам текст канона не был неверным). Job — J4 (точное
редактирование плана инструментом «Стены»); правка убирает ложный snap-кандидат
внутри физически несуществующей кладки.

Trivial-трек оправдан: одна поверхность (snap-overlay/resolver Плана), три AC,
ожидаемое поведение уже зафиксировано в `docs/specs/132-partition-openings.md`
§11 и в тексте `docs/CANVAS.md`; решать было нечего, только чинить рассинхрон.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green |
| Unit | `npm test` | green, 887/887 (совпадает с заявленным в хендоффе) |
| Build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | green, три копии идентичны, SHA-256 `257c984e…` совпадает с хендоффом |
| Целевой smoke (назван в AC1) | `node demo/smoke_plan_snap_overlay.mjs` | green, все 35 проверок `true`, включая новые `partitionOpeningGapHasNoLine`, `partitionOpeningGapDoesNotActivateSnap`, `oneLinePerSolidInterval` (12→13) |
| Смежный smoke (структурный граф, AC3) | `node demo/smoke_partition_openings.mjs` | green, 12/12, включая `openingKeepsRoomFaceAxisContinuous: true` |
| Мутационная проверка «тест умеет падать» | `git checkout HEAD^ -- src/houseplan-card.ts src/plan-snap-overlay.ts`, пересборка, `cp dist/... demo/srv/assets/...`, повтор `npm test` и smoke | **упал** — unit: 886/886 pass, 1 fail (`a hosted opening cuts only its presentation partition axis…`); smoke: 3 red (`oneLinePerSolidInterval`, `partitionOpeningGapHasNoLine`, `partitionOpeningGapDoesNotActivateSnap`), остальные 32 не задеты |
| Восстановление | `git checkout HEAD -- src/houseplan-card.ts src/plan-snap-overlay.ts`, пересборка, `cp` во все три копии | дерево чистое (`git status` пусто), хэш бандла тот же `257c984e…` |
| `git diff --check` | — | green, без пробельных ошибок |

Не прогонялись, сознательно:

- **Полный набор `demo/smoke_*.mjs` (127 шт.)** — diff задевает только
  presentation snap-overlay/resolver Плана. Прогнаны названный в AC1/AC3 smoke
  плюс ближайший смежный, покрывающий тот же host-механизм
  (`smoke_partition_openings`). Полный набор — предрелизный гейт (§8), не гейт
  код-ревью.
- **`npm run golden:verify`** — diff может в принципе менять видимый результат
  (это рендер-слой), но проверено чтением фикстур: golden-сценарии
  `plan-snap-endpoint-light`/`plan-snap-line-gaps-dark` и вообще все сценарии
  `mode: 'plan'` используют пространства `golden-geometry`/`golden-lighting`
  (`demo/fixtures/visual-matrix.mjs:64-127`), и ни один из `openings[]` там не
  несёт поле `host`. Значит `_partitionOpeningCuts(space)` для этих фикстур
  возвращает `[]` независимо от диффа, и `partitionCuts.get(partition.id) ||
  []` даёт тот же пустой массив, что и раньше (`cuts: []`) — новый код-путь для
  golden-баз инертен, пересборка не может изменить ни один пиксель. Если
  фикстуры изменятся в будущем и приобретут hosted-проём — это будет уже другой
  диф, не этот.
- **`python -m pytest tests_backend -q`** — Python не тронут (diff не касается
  `custom_components/houseplan/**/*.py`).
- **Performance-профили** — не названы в AC; добавленный код — построение
  `Map` по уже посчитанному `_partitionOpeningCuts()` (эта функция уже
  вызывалась для physical/light геометрии в нескольких других местах,
  `houseplan-card.ts:4809,12640,14678`) плюс уже существующий `cutSegments()`
  на один источник больше — не расширяет асимптотику снапшота.

## Проверка AC

- **AC1 — gap на независимой перегородке.** Доказано unit
  (`test/plan-snap-overlay.test.mjs`, `'a hosted opening cuts only its
  presentation partition axis without boundary nodes'`: делит ось на два
  интервала, границы cut не входят в `geometry.endpoints`, `resolvePlanSnap`
  внутри gap — `null`) и smoke (`partitionOpeningGapHasNoLine`,
  `partitionOpeningGapDoesNotActivateSnap`, `cutBoundariesAreNotEndpoints`,
  `uniqueSourceEndpointsOnly` не выросло с 11 при добавлении cut — граница не
  стала узлом). Мутационно подтверждено, что оба доказательства чувствительны
  к регрессии.
- **AC2 — cut изолирован по host.** Доказано unit: в том же тесте соседняя
  параллельная (`nearby`) и пересекающая (`crossing`) независимая перегородка с
  другим `id` остаются полностью целыми (`a[0]===0 && b[0]===100` /
  `a[1]===-50 && b[1]===50`) при cut на `host`. Изоляция обеспечена
  структурно — `partitionCuts` это `Map<hostId, cuts>`
  (`src/plan-snap-overlay.ts:129-136,170`), не геометрический поиск
  пересечений, поэтому "совпадающая по координатам, но другая по id"
  перегородка тоже не может получить чужой cut — разобрано чтением, случай
  вырожденный (совпадающие в пространстве независимые перегородки) и отдельно
  не тестируется, см. Low-1.
  Composite room-wall (тот же контракт, что зафиксирован в #132): код-путь
  `_roomWallOpeningInputs()`/`_planSnapOpeningCuts()`, который режет
  room-ось для composite-хостов, этим диффом не тронут (diff в
  `houseplan-card.ts` — ровно одна добавленная строка, не изменяющая
  существующие функции) — «сохраняет уже действующий physical gap на
  room-оси» доказано тем, что затрагивающий её код не менялся.
- **AC3 — structural topology не меняется.** Доказано unit
  (`'partition axes remain continuous when hosted cuts are omitted from a
  structural snapshot'`: без `partitionCuts` ось остаётся одним сегментом,
  `resolvePlanSnap` внутри бывшего gap возвращает `kind: 'line'`) и разбором:
  `_planStructuralGeometrySnapshot()` (`houseplan-card.ts:6287-6307`) не
  передаёт `partitionCuts` в `buildPlanSnapGeometry()` — новая опция там просто
  не используется, а сам метод этим диффом не тронут. Смежный smoke
  `smoke_partition_openings.mjs` (`openingKeepsRoomFaceAxisContinuous: true`)
  и полный unit-прогон (887/887, включая существующие тесты #185) не показали
  регрессии.

## Находки

### Low-1 — нет теста на composite-hosted проём после этого диффа

**Файл:** `src/houseplan-card.ts:6274` в связке с `partitionOpeningHasCompositeRoomWall`
(`src/partition-openings.ts:134-168`).

**Сценарий:** `_partitionOpeningCuts(space)` вызывается с `accept: () => true`
по умолчанию — он не отличает composite-hosted проём (партиция точно совпадает
с производной стеной комнаты) от независимого. Значит для composite-хоста
теперь ДОПОЛНИТЕЛЬНО (сверх уже существовавшего room-cut) режется и
partition-kind источник той же партиции. Разбором это безопасно: обе точки
разреза вычисляются из одного и того же `resolvePartitionOpening(...)`
(`opening.rx/ry/angle/rlen` синхронизированы с `resolved.center/length/angle`
при `partitionHost`, :7932-7938), то есть совпадают в мировых координатах в
пределах эпсилон; а дедупликация в `buildPlanSnapGeometry` ранжирует источники
`room(0) < partition(2)` и коллапсирует совпадающие по точным координатам
подсегменты в один. Ни один существующий unit/smoke сценарий не комбинирует
composite-hosted проём с этой веткой кода, поэтому фактическое поведение (одна
линия vs. две перекрывающиеся с разными внешними границами, если производная
стена комнаты и партиция не совпадают в габаритах ровно от угла до угла) не
подтверждено исполнением, только чтением.

**Почему не Medium:** код-путь, ответственный за AC2/AC3 (room-cut и
структурный снапшот), этим диффом не менялся — риск регрессии там отсутствует
структурно. Дополнительное поведение для composite — не требование ни одного
AC, а безопасный побочный эффект переиспользования уже существующей функции;
максимум, что он может дать в худшем случае — лишнюю, но геометрически верную
(по той же физической точке) presentation-линию, не влияющую на snap-резолвер
(оба cut в одной точке дают одинаковый gap). Правлю с записью, issue не
завожу.

Других находок (High/Medium) нет.

## Что проверено и корректно

- `buildPlanSnapGeometry()`: новая опция `partitionCuts` валидирует `hostId`
  (строка, не пустая) и конечность точек `a`/`b` (`finitePoint`) — деградирует
  безопасно (cut отбрасывается, ось остаётся целой) на некорректном входе, а
  не бросает исключение.
- Единственный источник `partitionCuts` для presentation-снапшота —
  `_partitionOpeningCuts(space)`, уже используемая канонической функцией для
  physical/light геометрии в трёх других местах (`:4809, 12640, 14678`); новый
  вызов не дублирует резолюцию — переиспользует тот же `resolvePartitionOpening`
  путь, значит orphan/невалидный host не создаёт cut (тот же guard `if
  (resolution.resolved) cuts.push(...)`, :7954).
- `_planStructuralGeometrySnapshot()` (структурный, #185) и
  `_planSnapOpeningCuts()`/`_roomWallOpeningInputs()` (room-cut, #132) не
  тронуты этим диффом — единственная новая строка в `houseplan-card.ts`
  добавляет параметр в вызов, не меняющий существующие функции.
  Соответствует комментарию `plan-snap-overlay.ts:120-124`, тоже обновлённому
  этим коммитом в соответствии с новым поведением.
- Smoke-фикстура (`base-partition`, `a:[0.6,0.6] b:[0.9,0.6]`) — вне полигонов
  обеих комнат (`left`/`right` заканчиваются на y=0.5), то есть действительно
  независимая перегородка, а не производная стена комнаты — сценарий
  корректно воспроизводит основной (не edge-case) кейс из тела issue.
  Хостовый проём `t: 0.8` даёт `x = 0.6 + 0.8·0.3 = 0.84`, что совпадает с
  координатой `840` в проверках `crosses(...)`/`eventAt(840, 600)`.
  `uniqueSourceEndpointsOnly` не изменился (11→11) при добавлении cut — прямое
  browser-подтверждение «границы cut не создают узел», не только в unit.
- Терминология changelog («независимый отрезок «Стены»») согласована с
  `docs/USER-GUIDE.ru.md:430,444,449`, не изобретена.
- Трейлеры коммита корректны: `Issue: #189`, `User-Visible: yes`, оба
  changelog правлены в том же коммите. Класс D (три копии бандла) идентичны
  байт-в-байт локальной пересборке — подтверждено `cmp`/`sha256sum` дважды (до
  и после мутационной проверки, на разных состояниях исходника).
- Нет изменений в i18n, конфиг-миграции, touch-контракте — согласуется с
  заявлением issue («Нового UX, конфига и i18n нет») и с критериями `trivial`
  (§5.1): одна поверхность, ожидаемое поведение уже зафиксировано, решать
  нечего.

## Чего не проверял

- Полный browser smoke-набор (127 файлов) — не запускал, обоснование выше
  (объём гейта соразмерен диффу, §8).
- `npm run golden:verify` — не запускал; обоснование чтением фикстур выше
  (ни один golden-сценарий Плана не содержит hosted-проём, код-путь инертен).
- `python -m pytest tests_backend` — не запускал, Python не тронут.
- Performance-профили — не запускал, не названы в AC и не расширяют
  асимптотику существующего снапшота.
- Composite-hosted проём как отдельный интеграционный/smoke-сценарий — не
  запускал, разобран только чтением (Low-1).
- Ручной запуск карты в браузере вне smoke-харнеса — не делал; фазы ручного
  тестирования в процессе нет, AC доказаны автотестами плюс разбором кода.

## Вердикт

Зелёный. Все три AC доказаны — AC1 unit+smoke, AC2 unit плюс чтение
неизменённого room-cut пути, AC3 unit плюс чтение неизменённого структурного
снапшота. Оба новых теста подтверждённо умеют падать (мутационная проверка).
Trivial-трек оправдан. High: 0, Medium: 0, Low: 1 (правлена записью, issue не
заведён).
