# Issue #201 — наследование толщины для атомарного участка стены

- Дата: 2026-08-19
- Тип: bug · приоритет P2 · ценность 6/10 · сложность 4/10
- Issue: [#201](https://github.com/Matysh/houseplan-card/issues/201)
- Ветка: `issue/201-atomic-thickness-lookup`

Канонические документы: `docs/SCOPE.md`, `docs/UX-MODES.md`,
`docs/WALL-THICKNESS.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Администратор редактирует план с частично совпадающими границами трёх комнат.
На одном физическом пролёте уже задана толщина стены. Администратор закрывает
виртуальный участок этой границы и ожидает, что восстановленная кладка получит
толщину ближайшего сплошного продолжения, как и обещает текущий инструмент.

Это часть J4/J6: редактирование не должно незаметно заменять сохранённую
физическую характеристику значением по умолчанию.

## 2. Что человек увидит до и после

**До:** если соседний сплошной участок является атомарной частью более длинной
wall-записи, Close не узнаёт его толщину и создаёт восстановленный участок с
default 15 см. На стене 20/22 см появляется непреднамеренная ступень.

**После:** Close наследует фактическую толщину покрывающего точного wall-run.
Default 15 см используется только тогда, когда ни один подходящий сосед
действительно не имеет толщины.

## 3. Подтверждённая проблема и причина

На production-scale fixture из #197 сохранённая запись 20 см точно покрывает
пролёт `[620.83,550]–[887.5,550]`. Третья комната делит его на два атомарных
ребёнка:

- `[620.83,550]–[691.67,550]`;
- `[691.67,550]–[887.5,550]`.

На текущем `dev` `wallIntervals()` правильно разрешает обоих детей в 20 см:
`cmsForPoly()` уже умеет искать покрывающий exact span. Но публичный pure-helper
`thicknessCmAt()` вызывает только `lookupWall()`, рассчитанный на собственный
key/midpoint одного stretch, и возвращает 0 для обоих детей. Полный parent-run
тем же вызовом разрешается в 20 см.

Единственный продуктовый consumer `thicknessCmAt()` — `thicknessOnClose()` в
`src/open-spans.ts`. Он перебирает соседние `solidEdges`; нулевой ответ исключает
реального соседа и приводит к `DRAW_WALL_DEFAULT_CM`.

Исходное предположение issue о нулевой толщине в общем render-path устарело:
render использует `wallIntervals()` и на текущем коде сохраняет 20 см. Баг
ограничен чтением exact parent-run при закрытии виртуальной границы.

## 4. Scope

- научить `thicknessCmAt()` читать наиболее узкий exact stored span, который
  коллинеарен и полностью покрывает запрошенный дочерний сегмент;
- сохранить прямой key/tolerant lookup как первый и совместимый путь;
- обеспечить правильное наследование в `thicknessOnClose()` и
  `applyThicknessOnClose()`;
- покрыть normalized и production coordinate scales;
- добавить regression unit, browser smoke, mutation gate, тестовый контракт и
  пользовательские changelog.

## 5. Non-scope

- изменение `wallIntervals()`, `cmsForPoly()`, body geometry или рендера;
- очистка уже сохранённых коротких интервалов (#198);
- изменение выбора ближайшего коллинеарного соседа в `thicknessOnClose()`;
- изменение default 15 см, UI Close, snapping, open-span ownership или Undo;
- расширение legacy key-only записи на произвольный покрывающий parent;
- schema/backend/API, миграция, Optimize и переписывание config при чтении;
- общая замена midpoint/key модели wall entries.

## 6. Контракт разрешения толщины

### 6.1. Порядок поиска

Для query `[a,b]` функция `thicknessCmAt(walls,a,b,pitch,coordScale)`:

1. сохраняет текущий результат `lookupWall()` при direct key или его
   совместимом midpoint fallback;
2. если direct hit отсутствует, рассматривает только записи с валидными
   конечными точками `a/b`, положительной толщиной и совпадающим направлением;
3. принимает запись только тогда, когда обе query endpoints лежат на её
   конечном отрезке в действующем scale-relative tolerance, то есть stored span
   покрывает query целиком;
4. при нескольких кандидатах выбирает наиболее узкий покрывающий span; tie
   разрешается детерминированно и независимо от порядка входного массива;
5. если кандидата нет, возвращает 0 как сейчас.

### 6.2. Запрет утечки толщины

Exact запись, покрывающая только часть query, не подходит, даже если направления
и midpoint близки. `[0..4]` не может дать толщину запросу `[0..10]`; тем самым
сохраняется защита AUD-159B6-01. Параллельный сосед на другой линии,
перпендикулярный участок, zero-length/malformed endpoints и `cm <= 0` также не
подходят.

Legacy `{key,cm}` без exact endpoints продолжает работать только по нынешнему
direct/midpoint контракту: новая логика не может доказать его покрытие.

### 6.3. Close

`thicknessOnClose()` не меняет сортировку кандидатов: среди коллинеарных
`solidEdges` побеждает ближайший к закрываемому span участок с разрешённым
`cm > 0`. Исправление меняет только ложный `0` на фактическую толщину exact
parent-run. Default применяется лишь при отсутствии любого такого соседа.

`applyThicknessOnClose()` записывает выбранную толщину существующим
`setWallThickness()`; последующая normalisation, preview/apply и Undo не
получают отдельной ветки поведения.

## 7. Данные, миграция и совместимость

Формат `walls`, ключи и exact endpoints не меняются. Миграции нет. Существующие
планы не переписываются до явного Close. Уже созданные ошибочные 15-см участки
остаются данными пользователя и относятся к #198.

Downgrade возвращает неверное наследование только при следующем Close, не
повреждая уже сохранённый план. Backend validation и старые key-only планы
сохраняют текущую совместимость.

## 8. UX, i18n, accessibility и touch

Новых элементов, строк, уведомлений и жестов нет. Исправляется результат уже
существующего действия. Keyboard/touch policy, focus и editor affordance не
меняются.

## 9. Acceptance criteria и доказательства

| AC | Критерий | Обязательное доказательство |
|---|---|---|
| AC1 | Exact parent `[0..10]` толщиной 20 см даёт 20 для атомарных queries `[0..4]` и `[4..10]`. | Table-driven unit `wall-thickness.test.mjs`. |
| AC2 | AC1 одинаков при `coordScale = 1` и `coordScale = NORM_W`; направление endpoints можно развернуть. | Unit scale/direction matrix. |
| AC3 | Exact partial `[0..4]` не даёт толщину query `[0..10]`; параллельный offset, perpendicular и malformed rows не совпадают. | Negative unit matrix. |
| AC4 | Из нескольких покрывающих exact spans выбирается наиболее узкий; перестановка rows не меняет ответ. | Unit permutation test. |
| AC5 | Legacy key-only direct/midpoint lookup сохраняет текущий результат. | Existing + focused regression unit. |
| AC6 | `thicknessOnClose()` на частично расщеплённом parent-run наследует 20/22 см, а без толстого соседа сохраняет default 15 см. | `open-spans.test.mjs`. |
| AC7 | Реальное Close в Plan на трёхкомнатном partial-overlap fixture сохраняет восстановленный span с соседним cm, без console/page errors; Undo восстанавливает virtual span. | Расширенный targeted browser smoke. |
| AC8 | Render-path полного fixture до/после не меняется вне закрываемого span. | Existing wall/open-span units и targeted smoke. |
| AC9 | Пользовательский и тестовый контракты обновлены. | Оба changelog + `docs/TESTING.md`. |
| AC10 | Regression доказана исполняемым мутантом. | `mutation-gate --check`, clean green / mutant red. |
| AC11 | Рабочие gates зелёные. | typecheck, unit, build, targeted smoke. |

## 10. План автотестов

### 10.1. Unit

В `test/wall-thickness.test.mjs` добавить матрицу exact containment: child,
reversed, scale 1/1000, nested candidates, row permutation и negative cases.
Тест обязан быть красным на текущем `dev` именно потому, что child возвращает 0.

В `test/open-spans.test.mjs` построить parent-run с атомарными `solidEdges` и
проверить, что Close выбирает parent cm. Отдельно сохранить default-case.

### 10.2. Browser smoke

Расширить ближайший по fixture smoke (`smoke_resize_virtual_thick.mjs` либо
выделенный targeted smoke): три комнаты создают частичный breakpoint на одной
линии, более длинный exact wall-run имеет не-default толщину, средний virtual
span закрывается UI-действием. Проверить persisted cm, визуальное отсутствие
15-см ступени, Undo и отсутствие ошибок. Выбор конкретного файла — техническое
решение реализации.

Golden не обязателен: видимая форма уже покрывается числовой browser-проверкой,
а общий wall renderer не меняется. Если реализация добавит новую визуальную
сцену, её baseline принимается только перед бетой.

### 10.3. Mutation gate

Добавить entry `atomic-child-thickness-parent-fallback`. Мутант отключает новый
exact-parent fallback в `thicknessCmAt()` и возвращает прежний direct-only
результат. Guard — focused unit `wall-thickness` + `open-spans`; на чистом коде
green, на мутанте non-zero.

## 11. Риски и меры

| Риск | Мера |
|---|---|
| Частичная запись снова протекает на весь parent. | Полное покрытие обеих query endpoints и AC3. |
| Overlapping exact rows дают order-dependent cm. | Наиболее узкий span + stable tie, permutation AC4. |
| Scale tolerance работает только в normalized units. | AC2 на `coordScale = 1/NORM_W`. |
| Исправление меняет общий renderer. | Render не использует новый fallback; AC8 и non-scope. |
| Поиск по walls дорог. | Он выполняется только при editor Close; линейный проход сопоставим с текущим lookup и не находится в render tick. |

Security/privacy boundary не меняется.

## 12. Rollback

Frontend pure-правка откатывается вместе с тестами и документацией одним
коммитом. Данные и schema не требуют обратной миграции. Уже выполненный Close
остаётся валидной wall-записью с выбранной толщиной.

## 13. Release-артефакты

- записи в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в implementation-коммите
  с `User-Visible: yes`;
- обновление `docs/TESTING.md`;
- unit, targeted browser smoke и mutation entry;
- синхронные bundle snapshots;
- отдельные backend, i18n, user-guide, golden, performance и migration
  artifacts не нужны;
- полные smoke/golden/performance остаются предрелизным гейтом.

## 14. Принятые предположения

Принято предположительно, поменять свободно при ревью:

1. Fallback реализуется внутри `thicknessCmAt()`, а `lookupWall()` сохраняет
   узкий контракт «один key — один stretch».
2. Для containment используется уже действующий scale-relative wall lookup
   tolerance, без нового пользовательского порога.
3. Stable tie не меняет persisted rows; он только делает чтение независимым от
   порядка.
4. Targeted browser-сценарий расширяет ближайший существующий smoke, если это
   не ухудшит его читаемость; иначе создаётся отдельный файл.
