# Issue #228 — надёжное рисование стен и операции с готовым контуром

- Дата: 2026-08-22
- Тип: bug · приоритет P1
- Оценка: пользовательская ценность 9/10 · ценность для разработки 8/10 ·
  сложность 9/10 · риск 9/10
- Issue: [#228](https://github.com/Matysh/houseplan-card/issues/228)
- Ветка: `issue/228-plan-drawing-problems`

Канонические документы: `docs/SCOPE.md`, `docs/USER-GUIDE.ru.md`,
`docs/ARCHITECTURE.md`, `docs/CANVAS.md`, `docs/WALL-THICKNESS.md`,
`docs/TOUCH-SUPPORT.md`, `docs/CONFIG-COMPATIBILITY.md`, а также принятые
контракты #137, #141 и #173.

## 1. Сценарий, персона и момент

Домашний администратор рисует или исправляет план в desktop-редакторе Плана
инструментом **«Стены»**. В этот момент ему нужно видеть точную ось активного
отрезка, однозначно понимать будущий узел, сохранять строгий угол с `Shift`,
создать комнату внутри уже готового контура и удалить старую комнату, не теряя
нужную кладку.

Задача закрывает J4 — точный план без внешнего SVG-редактора — и J6 — безопасное
обслуживание плана. View и киоск не получают новых действий, но обязаны без
регрессии показывать результат созданной или удалённой геометрии.

## 2. Что человек увидит до и после

**До:** активная толстая стена скрывает собственную ось и конечный узел;
неразличимые близкие endpoints молча разрешаются в один из них; snap может
сломать зафиксированный `Shift` угол, а подпись 90,1° остаться зелёной; готовый
контур нельзя превратить в комнату без нового отрезка; удаление комнаты всегда
удаляет её эксклюзивные стены.

**После:** активный отрезок показывает ось и точный будущий узел; неоднозначный
узел не записывается; `Shift` означает действительно строгий угол; клик внутри
готовой пустой области предлагает комнату и при подтверждении может исправить
единственный разрыв до 2 см; при удалении комнаты человек явно выбирает,
оставить её физические стены или удалить их.

## 3. Подтверждённое текущее состояние

1. В `_renderMarkupLayer()` толстый `previewD` строится по `path + cursor`, но
   `.pathline` и `.vertex` — только по уже поставленному `_path`. Пунктирный
   `.preview` существует, однако теряется на штриховке и не даёт конечного узла.
2. `resolvePlanSnap()` возвращает ближайший endpoint внутри 12 CSS px и
   детерминированно разрешает равенство. Два разных узла могут быть корректными
   кандидатами, но визуально сливаться на текущем масштабе; commit всё равно
   молча выбирает один.
3. `wall-face-graph.ts` соединяет только точные endpoint/T/X/collinear узлы с
   малым geometry epsilon. Промах 1,2 см из отчёта не образует face, даже когда
   тела стен визуально соприкасаются.
4. `_deleteRoomClick()` использует native `confirm()`, удаляет `room` и клипует
   open spans. Эксклюзивные room edges не материализуются в `partitions`.
5. #173 ищет только faces, появившиеся после последнего принятого сегмента.
   Существующий замкнутый partition/draft ring намеренно не вызывает пассивного
   предложения.
6. `_resolvePlanDrawPoint()` безусловно предпочитает любой snap candidate
   `_snapDrawPoint(raw, lock45)`. `is45(deg, 0.5)` затем считает 90,1° зелёным.
   Это старый контракт #137, который настоящая задача заменяет решением
   владельца.

## 4. Решения владельца

22.08.2026 владелец подтвердил все defaults:

1. Визуально неразличимые разные endpoints не выбираются автоматически: commit
   блокируется и предлагает увеличить масштаб.
2. Только при явном создании комнаты допустимо точно исправить единственный
   промах до **2 см**; исправление и комната входят в один Undo. Больший разрыв
   не чинится и подсвечивается.
3. Основное действие удаления — **«Удалить комнату, оставить стены»**; отдельное
   опасное действие — **«Удалить комнату и стены»**; общие стены остаются всегда.
   Сохраняемые эксклюзивные стены удерживают свою толщину и проёмы.
4. Одиночный клик пустой цепочкой внутри наименьшей подходящей области предлагает
   комнату; `Shift+click` начинает новую цепочку и обходит предложение; клик по
   оси или узлу сохраняет обычный Walls flow.
5. `Shift` строгий: принимается только совместимый endpoint либо точное
   пересечение зафиксированного луча с линией. Зелёная подпись означает
   фактически точный кратный угол; 90,1° зелёным не считается.

## 5. Scope

1. Ось и конечный узел активного Walls rubber-band поверх тела стены.
2. Явное состояние неоднозначных близких endpoints, блокирующее commit.
3. Новый strict-Shift resolver для endpoint и line snap без изменения обычного
   no-modifier поведения.
4. Строгая семантика зелёной угловой подписи для Walls/Split preview.
5. Поиск наименьшей подходящей уже существующей bounded face по клику внутри неё.
6. `Shift+click` как desktop-bypass предложения комнаты до первой точки.
7. Вычисляемый repair proposal endpoint↔endpoint или endpoint↔solid-line до
   2 физических сантиметров, его preview, revalidation и атомарное применение
   только вместе с подтверждённым созданием комнаты.
8. Диагностика единственного большего/неоднозначного разрыва без мутации.
9. Диалог удаления комнаты с Keep walls / Delete walls / Cancel.
10. Материализация эксклюзивных физических room-wall intervals в независимые
    `partitions`, сохранение толщины и перепривязка проёмов при Keep walls.
11. Каскадное удаление проёмов эксклюзивных удаляемых стен при Delete walls;
    сохранение общих стен и их проёмов в обоих вариантах.
12. Один named Undo/Redo и один config transaction на создание комнаты с
    repair либо удаление комнаты с выбранным вариантом.
13. RU/EN i18n, документация, unit, targeted smoke, visual/performance coverage.

## 6. Non-scope

- глобальное автоматическое выравнивание, чтение или сохранение старых планов;
- соединение обычного snap с допуском 2 см: вне явного room-create обычная
  геометрия остаётся точной;
- слияние разных близких узлов на pointermove, reload, Optimize, View или HA tick;
- repair разрывов больше 2 см либо нескольких неоднозначных разрывов;
- автоматическое перемещение вершин существующих комнат;
- новый общий инструмент редактирования узлов/стен, изменение toolbar #148;
- пассивное предложение комнат при загрузке, Undo/Redo, Resize, move, delete,
  thickness, Optimize или внешнем config update;
- изменение 12 CSS px общей snap-зоны, радиусов 5/10 см либо endpoint-first
  порядка в однозначном no-Shift случае;
- удаление уже существующих совпадающих partitions по inference;
- новая настройка, feature flag, persisted `node`, `face`, `repair` или draft;
- touch-паритет desktop hover и modifier gestures;
- изменение рендера стыков #141, общей face-модели #173 или задачи #232 за
  пределами необходимых точек расширения.

## 7. Термины и инварианты

- **Активная ось** — центрline от последней поставленной точки до текущей
  resolved cursor point.
- **Визуально неразличимые endpoints** — два разных endpoint-кандидата внутри
  общей snap-зоны, расстояние между центрами которых на текущем view меньше
  технического CSS-порога различимости. Точное значение порога не хранится.
- **Existing face** — simple bounded face текущего structural wall graph,
  существовавшая до клика и не занятая комнатой.
- **Repair proposal** — immutable список точных endpoint moves, необходимый для
  получения одной face и ограниченный 2 см на каждое движение.
- **Физическая стена комнаты** — solid room-wall interval с эффективной
  положительной толщиной. Intentional `open_span` и нулевая boundary-линия не
  материализуются как новая masonry partition.
- **Эксклюзивный interval** — часть границы удаляемой комнаты, которую после её
  удаления не продолжает ни одна другая room boundary.

Инварианты:

1. Hover, face hit-test, ambiguity и repair preview не мутируют config/layout.
2. Обычный click/tap всегда повторно решает актуальный snapshot; hover не
   авторитетен.
3. Неоднозначность fail-closed: нет точки, segment, history или save.
4. Repair не остаётся вычисляемой «почти связью»: после Save persisted endpoints
   точно совпадают с выбранным endpoint/линией.
5. Repair применяется только после явного подтверждения комнаты; Keep walls,
   Cancel, X, Escape и ошибка оставляют исходную геометрию bit-equivalent.
6. Общую стену нельзя удалить удалением одной комнаты.
7. Проём не остаётся orphan по результату обеих веток удаления.
8. Любая успешная операция является одной атомарной geometry-командой.

## 8. UX-контракт

### 8.1 Активная ось и узел

После первой точки и до commit следующей:

- тонкая ось продолжается до resolved cursor point поверх толстого preview;
- на свободном конце виден один контрастный узел;
- при endpoint/line snap роль конечного узла выполняет уже существующий активный
  snap marker, второй совпадающий круг не рисуется;
- при miss рисуется обычный live endpoint;
- committed path и active axis выглядят как одна непрерывная конструкция;
- существующий thick fill, bounded join patch, length/angle badge и hit-testing
  не меняют источник геометрии.

Layer pointer-inert и `aria-hidden`; анимации нет. Light, dark, forced-colours и
reduced-motion остаются читаемыми.

### 8.2 Неоднозначные endpoints

Resolver получает три исхода endpoint-ветки: `none`, `resolved`, `ambiguous`.

- Exact-dedup endpoints остаются одним endpoint и не создают ambiguity.
- Если два разных endpoint внутри 12 CSS px визуально неразличимы на текущем
  view, все конфликтующие точки получают контрастный conflict-state, а активный
  resolved endpoint отсутствует.
- Pointermove только показывает конфликт. Click/tap не добавляет точку и один
  раз показывает локализованный toast «Увеличьте масштаб, чтобы выбрать узел».
- После zoom, когда центры различимы, обычное nearest-endpoint правило #137
  снова действует; tie остаётся детерминированным.
- Endpoint ambiguity сильнее line snap: resolver не падает сквозь конфликт к
  более удобной линии.

### 8.3 Строгий `Shift`

При наличии anchor ближайший октант определяется из `anchor → raw pointer`.

1. Совместимый endpoint принимается только если лежит на выбранном ray в
   canonical geometry epsilon и не даёт нулевой segment.
2. Для line candidate вычисляется пересечение solid segment с выбранным ray.
   Оно принимается, только если лежит на segment, направлено от anchor и само
   остаётся в текущей 12 CSS px зоне pointer.
3. Для collinear ray/line используется ближайшая ненулевая wall-bound точка на
   ray; для parallel/non-intersecting или несовместимого endpoint кандидат
   игнорируется.
4. При отсутствии совместимого snap результат — действующий strict 45°
   grid-bound point из `snapSegment45()`.
5. Без `Shift` endpoint-first/line-snap #137 не меняется, кроме ambiguity guard.

First-point `Shift+click` не имеет anchor и поэтому использует обычную grid point,
но служит bypass из §8.5.

### 8.4 Угловая подпись

Для текущего Walls/Split segment зелёное состояние вычисляется по вектору, а не
по широкому допуску `±0,5°`:

- горизонталь, вертикаль и диагональ с `|dx| = |dy|` в geometry epsilon зелёные;
- неизбежный floating-point шум точного пересечения допускается;
- 89,9°/90,1° и другие реально некратные значения красные;
- отображаемое число продолжает округляться до 0,1° и совпадает с цветовым
  обещанием.

### 8.5 Создание комнаты из готовой области

При `Walls`, пустой `_path` и обычном click/tap применяется такой порядок:

1. room card, physical editor chrome и другие существующие владельцы события
   сохраняют приоритет;
2. ambiguity либо клик в snap-зоне endpoint/line обрабатывается обычным Walls
   flow и не предлагает комнату;
3. `Shift+click` на desktop всегда начинает новую цепочку;
4. иначе structural graph ищет existing face, содержащую raw click;
5. exact room duplicate, partial overlap и face, чья внутренняя точка уже
   принадлежит любой комнате, исключаются;
6. из оставшихся выбирается наименьшая площадь, затем canonical key;
7. открывается стандартный room dialog/queue #173 с Create room, Keep walls и
   Cancel; existing partitions/drafts не удаляются после Create.

Keep walls и Cancel для existing face ничего не пишут. Следующий обычный click
может снова предложить ту же face; новый persisted dismiss-state не вводится.

### 8.6 Допуск 2 см и явный repair

Exact graph проверяется первым. Если exact face под click/последним segment не
найдена, разрешён поиск face с одним однозначным repair proposal:

- endpoint→endpoint либо endpoint→внутренняя точка solid structural line;
- физическое расстояние вычисляется через `cell_cm/gridPitch` и не превышает
  2,0 см включительно;
- endpoint room boundary является неподвижным target; двигается endpoint
  independent partition/draft/active chain;
- room vertex никогда не двигается;
- если обе стороны independent, выбирается deterministic target по геометрии и
  grid-canonicality, не по record order/id;
- несколько равноценных target, несколько необходимых разрывов, zero-length,
  self-intersection, open-span bridge или конфликт проёма делают repair
  недопустимым;
- opening types не разрывают structural axis, а `open_span` остаётся настоящим
  gap и никогда не чинится;
- preview подсвечивает исходный разрыв и точку будущего соединения.

Room dialog не применяет repair заранее. Create повторно проверяет config
revision, face, 2 см, limits, overlap и hosted openings, затем одним commit:

1. двигает только предложенные independent endpoints;
2. обновляет compatibility-проекцию `x/y/angle` проёмов изменённого partition,
   сохраняя host id/t, если strict jamb validation остаётся зелёной;
3. создаёт room по уже точному repaired graph;
4. применяет обычный consumed/unconsumed contract #173;
5. записывает одну named Undo-команду.

Если gap больше 2 см, но около click существует единственный диагностируемый
разрыв в screen snap-range, он подсвечивается и room dialog не открывается.
Неоднозначный или недиагностируемый открытый набор остаётся обычным Walls flow;
House Plan не строит комнату из произвольного почти-цикла.

### 8.7 Удаление комнаты

Клик инструментом «Удалить комнату» открывает `hp-dialog`, не native `confirm`:

- title называет комнату;
- основная кнопка **«Удалить комнату, оставить стены»**;
- danger-кнопка **«Удалить комнату и стены»**;
- Cancel/X/Escape ничего не меняют.

**Keep walls:**

1. до удаления материализуется effective room-wall profile;
2. solid positive-thickness exclusive intervals становятся `partitions` с теми
   же endpoints и `cm`;
3. совпадающая уже существующая partition переиспользуется, а не дублируется;
4. room-wall opening эксклюзивного interval получает явный partition host и
   сохраняет type, length, flips, contact/lock и положение; strict jamb margin
   валидируется до commit;
5. shared intervals остаются производными стенами соседей и не получают
   partition;
6. virtual/open и zero-thickness boundary intervals не материализуются как
   physical partition;
7. target room удаляется, walls/open spans нормализуются действующими helpers.

**Delete walls:**

1. target room удаляется без новых partitions;
2. openings, чья resolved structural ассоциация была только с эксклюзивной
   стеной target room, удаляются тем же commit;
3. opening на shared wall сохраняется и после re-resolution принадлежит
   surviving room wall;
4. уже существующая совпадающая partition и её hosted opening не удаляются:
   это отдельный объект, а не стена комнаты.

Обе ветки сохраняют neighbour rooms/metadata/devices, пересчитывают open spans,
wall intervals и device projection и дают один Undo. Capacity/validation failure
показывается до мутации и оставляет исходный snapshot.

## 9. Модель данных и архитектурный контракт

### 9.1 Snap result

`PlanSnapCandidate` либо соседний pure type расширяется до результата,
различающего `resolved` и `ambiguous`. Список конфликтующих endpoint содержит
только immutable coordinates/keys; CSS threshold передаётся из live view и не
входит в cache key static geometry.

Strict-Shift projection выделяется в pure helper. Card orchestrator передаёт
raw point, anchor, ray, candidate и geometry epsilon; SVG DOM не является
источником координат.

### 9.2 Existing face и repair proposal

`wall-face-graph.ts` получает read-only face-at-point query поверх уже построенного
exact graph. Она не меняет правило #173 «новые faces только после segment»:
новый query вызывается только явным idle click.

Near-junction repair строится отдельным pure planning pass или расширением graph
API с provenance:

- input — room axes после `open_spans`, partitions, inactive drafts и active
  chain, physical conversion и click/added-segment context;
- output — candidate face, exact endpoint moves и diagnostics;
- no output при неоднозначности либо необходимости двигать room vertices;
- record order, ids, direction и winding не меняют repaired geometry;
- input objects не мутируются.

### 9.3 Room deletion plan

До показа/commit строится immutable deletion plan:

- exact old room-wall intervals и ownership после atomization;
- shared/exclusive classification;
- partitions to create/reuse;
- room-wall openings to rehost, keep or delete;
- next walls/open spans и capacity/validation result.

Commit revalidates room id и structural fingerprint. UI не повторяет геометрию
планировщика самостоятельно.

### 9.4 Кэши и lifecycle

- Static snap geometry cache сохраняется; ambiguity зависит от event/view и не
  создаёт новый O(E) DOM на каждый pointermove.
- Exact face graph использует действующий bounded LRU. Existing-face и repair
  query запускаются только по click/accepted segment, не по hover/render/HA tick.
- Mode/tool/space change, pointerleave, Cancel и external config adoption очищают
  active/conflict/repair preview.
- Никаких timer, websocket, service, fetch или localStorage путей не добавляется.

## 10. Совместимость и миграция

Новых persisted полей и write-on-read нет.

- `rooms`, `walls`, `room_drafts`, `partitions`, `openings`, `open_spans` и
  layout сохраняют текущую schema;
- repair записывает только допустимые текущей schema endpoints и обновлённые
  compatibility-поля hosted openings;
- Keep walls создаёт обычные `partitions` с `cm` 1–100; нулевая boundary-линия
  не превращается в новый тип данных;
- import/export, model version и backend storage API не меняются;
- backend semantic validation должен принять обе ветки удаления и repaired
  partition; для новых schema keys Python-изменений нет;
- downgrade читает созданные rooms/partitions как обычные существующие данные;
- старые планы не меняются до явного Create/Delete;
- no-op/Cancel/Keep existing face возвращают bit-equivalent config.

## 11. UX, i18n, accessibility и touch

### 11.1 RU/EN i18n

Добавляются или уточняются ключи для:

- ambiguous endpoints / рекомендация увеличить масштаб;
- gap больше 2 см либо неоднозначный repair;
- room-delete dialog title/body;
- «Удалить комнату, оставить стены»;
- «Удалить комнату и стены»;
- validation/capacity/opening failure при сохранении стен;
- history «Создать комнату и соединить стены» и две ветки удаления, если для
  понятного Undo нужны разные названия.

Термины следуют `docs/USER-GUIDE.ru.md`: **Стены**, **комната**,
**независимая стена**, **проём**, **увеличить масштаб**.

### 11.2 Accessibility

- активная/конфликтная геометрия декоративна, `aria-hidden`, pointer-inert;
- toast получает действующий status/announcement path;
- delete dialog использует `hp-dialog`: title, focus trap, Escape и restore focus;
- primary/danger/Cancel имеют явные текстовые labels и логичный tab order;
- forced colours различает normal active node и conflict;
- новой клавиатурной навигации по plan nodes нет.

### 11.3 Touch

**Touch editor: best effort / intentionally degraded.**

- tap без pointermove повторно решает ambiguity, existing face и repair;
- hover preview не обещается;
- на touch нет modifier-bypass: tap внутри eligible empty face предлагает
  комнату; свободную цепочку внутри неё начинают с axis/node либо на desktop;
- pinch, pan, second pointer, pointercancel и suppressed synthetic click не
  создают point/room, не применяют repair и не подтверждают delete;
- View/kiosk остаются fully supported и не получают editor DOM/actions.

Эта deliberate degradation описывается в user guide/release notes.

## 12. Производительность и безопасность

- pointermove остаётся O(E) resolver по cached geometry и обновляет только
  ограниченное active/conflict состояние;
- face traversal/repair/delete planning не запускаются на pointermove, render
  или HA state;
- large-house budgets не ослабляются; отдельные accepted-click measurements
  покрывают exact face, one-repair и ambiguity;
- conflict set/repair proposal/deletion plan ограничены текущим числом
  архитектурных рёбер и существующими schema limits;
- нет HTML от пользователя, новых URL, network, HA action или permission paths;
- delete/repair mutation проходят существующий config write/CAS и Undo boundary;
- secure opening contact/lock references только сохраняются либо удаляются как
  данные; сервисы HA не вызываются.

## 13. Acceptance criteria

- **AC1 (`unit` + `smoke` + pre-beta `golden`; разработчик):** после первой
  точки active Walls segment показывает непрерывную ось поверх thick preview и
  ровно один конечный узел для miss/endpoint/line snap в light/dark/forced
  colours; pointer/ARIA и committed geometry не меняются.
- **AC2 (`unit` + `smoke`; разработчик):** два exact-dedup endpoints остаются
  одним, а разные visually-indistinguishable endpoints дают conflict state;
  click/tap не пишет point/history/config и показывает zoom toast. После zoom
  nearest endpoint снова принимается; line fallback при конфликте отсутствует.
- **AC3 (`unit` + `smoke`; разработчик):** без `Shift` #137 остаётся
  pixel/coordinate-compatible; с `Shift` принимаются только endpoint на strict
  ray либо точное line/ray intersection в solid interval и hit zone;
  несовместимый snap даёт grid-bound strict-45 point.
- **AC4 (`unit` + `smoke`; разработчик):** angle badge зелёный для точных
  0/45/90° vectors с численным epsilon и красный для 89,9°/90,1°; показанное
  значение и committed endpoint совпадают.
- **AC5 (`unit` + `smoke`; разработчик):** idle ordinary click внутри
  наименьшей existing empty bounded face открывает room dialog без нового
  segment; snap-zone click рисует стену, `Shift+click` bypass начинает цепочку,
  occupied/duplicate/partial face не предлагаются.
- **AC6 (`unit` + `smoke`; разработчик):** unique endpoint↔endpoint и
  endpoint↔line gap `<=2,0 cm` создаёт repair proposal; только Create атомарно
  записывает exact junction + room и один Undo. Keep/Cancel/X/Escape/error
  оставляют config bit-equivalent.
- **AC7 (`unit` + `smoke`; разработчик):** `>2 cm`, two-gap, equal-target,
  room-vertex move, open-span bridge, zero/self-intersection и invalid hosted
  opening не ремонтируются; доступный больший single gap подсвечивается без
  room/save.
- **AC8 (`unit` + `smoke`; разработчик):** room, созданная из existing/repaired
  face, соблюдает #173 eligibility/order/limits; existing room walls, drafts и
  partitions не удаляются, active consumed/unconsumed cm/provenance сохраняются.
- **AC9 (`smoke`; разработчик):** Delete room открывает `hp-dialog` с primary
  Keep walls, danger Delete walls и Cancel; focus/Escape/restore работают,
  native `confirm` не используется.
- **AC10 (`unit` + `smoke`; разработчик):** Keep walls материализует только
  positive solid exclusive intervals как partitions с exact endpoints/cm,
  reuses coincident partition, rehosts valid openings и не дублирует shared,
  virtual или zero-thickness intervals.
- **AC11 (`unit` + `smoke`; разработчик):** Delete walls удаляет только target
  room и openings эксклюзивных room walls; shared walls/openings, neighbour
  rooms и explicit coincident partitions/hosted openings остаются.
- **AC12 (`unit` + `smoke`; разработчик):** обе delete ветки и room+repair —
  один named Undo/Redo/config save; capacity, opening validation, stale room и
  conflict fail before mutation; Redo детерминированно восстанавливает результат.
- **AC13 (`unit` + targeted smoke + code review; разработчик/ревьюер):**
  Plan/View/static/hidden Iso, clean floor, Glow, sun и junction rendering
  используют existing canonical consumers; no-op hover/dialog/render не меняют
  config, а shared masonry не получает double wall/tooth/gap.
- **AC14 (`smoke` + code review; разработчик/ревьюер):** tap выполняет
  authoritative click resolution, но pinch/pan/second pointer/pointercancel/
  suppressed click ничего не сохраняют; View/kiosk pixels/actions не меняются.
- **AC15 (`performance` + code review; разработчик/ревьюер):** 60-room/
  60-partition profile проходит pointer ambiguity, existing-face click и
  one-repair query без ослабления timing/heap/cache/DOM budgets; graph не
  запускается на pointermove/HA ticks.
- **AC16 (`unit` + backend/schema review; разработчик/ревьюер):** current
  schema/import/export/storage/API/permissions остаются совместимыми; старые
  планы не мигрируют, новые rooms/partitions/openings валидны для backend;
  no network/security paths.
- **AC17 (`typecheck` + `unit` + `build` + documentation review; разработчик):**
  fast gates зелёные, три bundle-копии побайтно одинаковы, named smokes зелёные,
  RU/EN i18n, оба changelog и перечисленные документы обновлены в одном
  `User-Visible: yes` implementation commit.

## 14. План автотестов и гейтов

### 14.1 Unit

Расширить `test/plan-snap-overlay.test.mjs`, `test/wall-face-graph.test.mjs` и
добавить pure room-deletion suite:

1. active-axis projection: miss/resolved/duplicate-node suppression;
2. ambiguity по screen threshold, exact dedup, zoom separation, endpoint-first;
3. strict ray endpoint, diagonal/vertical/horizontal intersection, collinear,
   parallel, outside interval/hit zone, immutability;
4. exact-octant badge против 89,9/90,1 и floating epsilon;
5. exact existing face hit, smallest/nested/order, room occupancy exclusion;
6. 1,2 см endpoint/endpoint и endpoint/line repair при `cell_cm:1`;
7. physical invariance threshold at other `cell_cm`, exact 2,0 / 2,01 boundary;
8. ambiguous/multi-gap/open-span/room-vertex/hosted-opening negative matrix;
9. repair revalidation, Keep/Cancel immutability, one history snapshot;
10. delete classification for exclusive/shared/partial-collinear/open spans;
11. positive cm preservation, coincident partition reuse, limits;
12. room opening rehost with t/x/y/angle and delete cascade;
13. shared opening and explicit hosted partition survival;
14. walls/open spans normalisation, Undo/Redo and record-order invariance.

Каждая новая ветка имеет mutation test: удаление ambiguity guard, поднятие
порога выше 2 см, движение room vertex либо удаление shared opening делает
соответствующий тест красным.

### 14.2 Targeted production-bundle smoke

Добавить `demo/smoke_plan_drawing_repairs.mjs` либо эквивалент и при
необходимости расширить `demo/smoke_plan_snap_overlay.mjs` /
`demo/smoke_unified_wall_tool.mjs`:

1. active thick segment показывает axis/node и сохраняет exact preview point;
2. два близких endpoint блокируют click, zoom разрешает выбранный endpoint;
3. strict Shift endpoint/line и красный 90,1°;
4. existing closed partition ring → click → room dialog → Create/Keep/Cancel;
5. `Shift+click` начинает chain, snap-zone click не открывает room;
6. 1,2 см gap → preview → Create → exact persisted repair + Undo/Redo;
7. 2,01 см/ambiguous/open-span/invalid-opening negative paths;
8. Keep walls: exclusive thick walls/room openings становятся hosted
   partitions, shared wall/opening не дублируются;
9. Delete walls: exclusive opening удалён, shared/explicit partition сохранены;
10. pan/pinch/pointercancel/suppressed tap и View/kiosk absence.

Перед `S7-code-review` обязательны точные команды:

```powershell
npm run typecheck
npm test
npm run build
node demo/smoke_plan_snap_overlay.mjs
node demo/smoke_unified_wall_tool.mjs
node demo/smoke_plan_drawing_repairs.mjs
```

После build три bundle-копии синхронизируются и сравниваются побайтно.

### 14.3 Golden и performance

- pre-beta golden review проверяет light/dark Plan с active axis, endpoint
  conflict, repair preview и delete dialog;
- существующие View/static/hidden-Iso baselines не меняются только из-за
  editor chrome; baseline принимается исключительно из полного reviewed Linux
  artifact через `golden:accept -- --reviewed`;
- large-house profile получает accepted-click cases exact/ambiguous/repair и
  доказывает отсутствие graph work на pointermove;
- бюджеты не ослабляются; полный golden/performance suite остаётся pre-beta
  gate на exact SHA.

### 14.4 Backend

Backend schema не меняется. Pure frontend unit + backend/schema code review
доказывают действующие `partition`/host limits. Полный HA harness выполняется в
Linux CI/WSL; native Windows из-за `fcntl` каноном не является.

## 15. План реализации

1. Расширить pure snap result ambiguity и добавить strict-ray projection.
2. Подключить active axis/node render без дублирования snap marker.
3. Заменить wide angle colour check на exact-vector predicate для editor badge.
4. Добавить exact face-at-point query и idle-click routing.
5. Реализовать provenance-aware near-junction repair planner и atomic apply.
6. Реализовать pure room deletion plan с partition/opening consequences.
7. Заменить native confirm на `hp-dialog` и связать оба commits с history/save.
8. Добавить unit, targeted smokes и performance diagnostics.
9. Обновить i18n, docs, changelogs и три bundle-копии.

Точные helper/file names свободны при соблюдении границ модулей и AC.

## 16. Затронутые файлы и модули

Ожидаемо:

- `src/plan-snap-overlay.ts` — ambiguity и candidate metadata;
- `src/wall-face-graph.ts` — exact face-at-point / repair planning extensions;
- новый pure helper room deletion/repair либо эквивалент;
- `src/houseplan-card.ts` — orchestration, dialog, history, lifecycle;
- `src/styles.ts` — active/conflict/repair visuals;
- `src/i18n/en.json`, `src/i18n/ru.json`;
- `test/plan-snap-overlay.test.mjs`, `test/wall-face-graph.test.mjs`, новый
  deletion/repair suite;
- `demo/smoke_plan_snap_overlay.mjs`, `demo/smoke_unified_wall_tool.mjs`, новый
  targeted smoke и при необходимости performance fixture;
- `docs/USER-GUIDE.ru.md`, `docs/CANVAS.md`, `docs/ARCHITECTURE.md`,
  `docs/WALL-THICKNESS.md`, `docs/TOUCH-SUPPORT.md`, `docs/TESTING.md`,
  `docs/STATUS.md`, оба changelog;
- `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`,
  `demo/srv/assets/houseplan-card.js` как один generated build.

Изменение Python/schema не ожидается. Если реализация потребует новый persisted
field либо расширение допустимых `cm`, работа останавливается и возвращается в
`S3-spec`: это изменение контракта вне утверждённого ТЗ.

## 17. Release-артефакты

Изменение пользовательское. Implementation commit имеет `User-Visible: yes` и
в том же коммите обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #228;
- `docs/USER-GUIDE.ru.md` — active preview, ambiguity, strict Shift, existing
  face, 2 см repair, room delete choices и touch limitation;
- `docs/CANVAS.md` — обновлённый snap/Shift/face contract;
- `docs/ARCHITECTURE.md` — repair/deletion plans и atomic transactions;
- `docs/WALL-THICKNESS.md` — materialized exclusive positive wall intervals;
- `docs/TOUCH-SUPPORT.md` — modifier bypass отсутствует на touch;
- `docs/TESTING.md` и `docs/STATUS.md` после реализации;
- RU/EN i18n;
- named smokes и performance diagnostics;
- три одинаковые bundle-копии.

Перед бетой: полный smoke suite, reviewed Linux golden, performance smoke/Full
Performance, Linux backend harness и Validate на exact candidate SHA. Изменение
проходит beta/RC до stable.

## 18. Риски и снижение

| Риск | Вероятность / ущерб | Снижение |
|---|---|---|
| Ambiguity заблокирует обычный endpoint | средняя / высокий | screen-threshold matrix, zoom smoke, exact dedup |
| Strict Shift потеряет полезный line snap | средняя / средний | exact ray/segment intersection и no-Shift parity |
| Repair соединит намеренный разрыв | средняя / высокий | 2 см, one-gap, explicit Create, open-span/ambiguity guards |
| Repair изменит room polygon | низкая / высокий | room vertices immutable, provenance units |
| Hosted opening перестанет помещаться | средняя / высокий | preflight strict validation, fail before mutation |
| Existing face click мешает начать стену | средняя / средний | snap-zone priority + desktop Shift bypass + docs |
| Keep walls создаст двойную кладку | средняя / высокий | interval ownership и coincident partition reuse |
| Delete walls удалит shared opening | низкая / высокий | old/new association plan, shared regression smoke |
| Multi-action commit сохранится частично | средняя / высокий | immutable plan + revalidation + one history/save |
| Graph попадёт в pointermove | средняя / высокий | click-only API и performance diagnostics |
| Touch tap сохранит лишнюю геометрию | низкая / высокий | gesture safety smoke |
| Визуальные golden изменятся шире scope | средняя / средний | targeted frames, reviewed Linux acceptance only |

## 19. Откат

Откат — revert одного user-visible implementation commit вместе с tests, docs,
i18n, changelogs и bundles. Новых persisted полей нет; rooms, partitions и
hosted openings, уже явно созданные новой версией, остаются валидными для старой.
Автоматическая data rollback не нужна.

Красный targeted smoke/golden/performance/backend gate блокирует бету. Ослабление
budget, удаление теста или silent fallback к приблизительной связи не являются
откатом.

## 20. Принятые технические предположения — можно менять без продуктового ревью

1. Порог screen-различимости endpoints рекомендуется держать около 8 CSS px;
   точное значение свободно при выполнении zoom/ambiguity AC.
2. Exact-octant лучше проверять по `dx/dy`, а не по degrees; helper/name свободны.
3. Repair target priority: immutable room axis → более grid-canonical
   independent endpoint → stable geometric tie. Persisted id не определяет
   координату результата.
4. Диагностика gap больше 2 см может искать один virtual bridge только в
   текущей 12 CSS px event-zone; произвольный open-chain solver не требуется.
5. Existing face может переиспользовать `_wallFaceBatch` с новым origin либо
   отдельный pending object, если Create/Keep/Cancel остаются эквивалентны.
6. Delete planner может atomize old room edges через `wallIntervals()` и
   canonical segment helpers; DOM measurement запрещён.
7. Совпадающая partition переиспользуется только при exact collinearity/coverage
   и совместимой толщине; иначе создаётся отдельный interval в пределах limits.
8. Нулевая room boundary — контур/бордер, а не physical masonry partition.
   Настоящая поддержка zero-cm independent wall требует отдельного model review.
9. Точные i18n/history keys, названия helper/test/smoke и раскладка файлов
   свободны.
10. Все пять продуктовых вопросов закрыты defaults владельца 22.08.2026;
    открытых продуктовых вопросов нет.
