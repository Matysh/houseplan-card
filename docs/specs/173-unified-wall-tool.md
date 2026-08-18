# Issue #173 — единый инструмент рисования стен и предложение комнаты по замыканию

- **Issue:** https://github.com/Matysh/houseplan-card/issues/173
- **Редакция:** первая редакция для независимого ревью; статус определяется только метками issue
- **Тип / приоритет:** feature / P1
- **Оценка:** пользовательская ценность 9/10; ценность для разработки 6/10;
  сложность/риск 9/10
- **Область:** desktop-first редактор Плана, рисование стен, planar topology,
  создание и разделение комнат, Undo/Redo, i18n и release-проверки
- **Модель данных:** существующие `rooms`, `room_drafts`, `partitions` и `walls`;
  без новой schema, backend API и миграции
- **Связано:** #137, #138, #141, #150, #172, `docs/SCOPE.md`,
  `docs/UX-MODES.md`, `docs/CANVAS.md`, `docs/WALL-THICKNESS.md`,
  `docs/TOUCH-SUPPORT.md`

## 1. Сценарий и персона

**Персона:** администратор дома, который рисует новый план либо достраивает
существующий в desktop-редакторе Плана.

**Момент:** пользователь хочет провести стены. Сегодня перед первым кликом ему
надо решить внутренний вопрос модели House Plan: это будущий контур комнаты или
независимая перегородка. При ошибочном выборе приходится менять инструмент либо
перерисовывать геометрию.

Задача поддерживает J4 и J6 из `docs/SCOPE.md`: встроенный GUI должен позволять
нарисовать и поддерживать правдивый план без знания внутренней схемы данных и без
внешнего редактора.

## 2. Что человек увидит до и после

**До:** в панели есть отдельные «Контур комнаты» и «Перегородка». Первый ждёт
замыкания своего draft, второй заканчивается после одного сегмента. Замыкание по
старым стенам, нескольким рёбрам, T- и X-пересечениям обычно не предлагает
комнату.

**После:** в панели есть один инструмент **«Стены»**. Пользователь ведёт одну
ломаную столько, сколько нужно. Если она остаётся открытой и человек меняет
инструмент или выходит из редактора, нарисованное остаётся обычными
перегородками. Если новый сегмент замкнул одну или несколько допустимых областей,
House Plan предлагает создать комнаты; отказ оставляет новые линии стенами.

Никакой отдельной кнопки «Завершить» и клавиши Enter не появляется.

## 3. Проблема и подтверждённое текущее состояние

1. `MarkupTool` содержит разные `draw` и `partition`; toolbar показывает две
   кнопки, а warm viewport способен восстановить оба значения.
2. `draw` сохраняет каждый завершённый сегмент в `room_drafts`; `partition`
   создаёт одну запись `partitions` после двух кликов и очищает `_path`.
3. `_markupClick()` предлагает комнату при возврате к собственной первой точке,
   `Ctrl`/`Cmd` closure либо в узком контракте #138: начало и конец лежат на
   одном непрерывном room-owned отрезке.
4. `plan-snap-overlay.ts` уже собирает стены комнат, сохранённые drafts и
   partitions, разрешает endpoint-first и line-snap. Он не строит planar faces.
5. `_keepClosedAsPartitions()` умеет преобразовать только собственный замкнутый
   draft. Он не знает provenance рёбер, пришедших из старой стены, T/X-узла или
   нескольких новых граней.
6. Отдельный Split уже сохраняет большую часть исходной комнаты с прежним id и
   метаданными, а меньшую открывает как новую комнату.
7. #141 объединяет физические тела T/endpoint-стыков, но намеренно не создаёт
   persisted node для случайного X. В #173 X становится **вычисляемым узлом
   только для face topology**; persisted записи и физический join-контракт #141
   от этого не меняются.

Следовательно, задача не сводится к удалению кнопки: нужен детерминированный
поиск новых bounded faces и безопасная транзакция между draft, partitions и
rooms.

## 4. Решения владельца

Решения зафиксированы 18.08.2026:
https://github.com/Matysh/houseplan-card/issues/173#issuecomment-5330235454

1. Специальных кнопок завершения и Enter нет. Смена инструмента, пространства
   либо выход из редактора завершает открытую цепочку; она становится обычными
   partitions и больше не возобновляется как draft.
2. Esc/Ctrl+Z убирает последнюю точку. Pinch, pan и `pointercancel` никогда не
   завершают цепочку и не добавляют геометрию.
3. Сохраняется действующий overlap-контракт: partial overlap запрещён, exact
   duplicate не предлагается, полное вложение комнат разрешено. Devices, decor,
   openings, columns и внутренние стены не блокируют предложение сами по себе.
4. При разделении существующей комнаты большая часть сохраняет id, имя, HA area,
   настройки и позиции; диалог настраивает меньшую новую часть. Отказ не меняет
   исходную комнату.
5. Если один сегмент замкнул несколько допустимых областей, они предлагаются
   последовательно от меньшей площади к большей; решение по каждой независимо.
6. Endpoint, T и геометрический X являются вычисляемыми узлами face graph.
   Collinear/coincident edges дедуплицируются. Opening/open-span gap не замыкает
   область через отсутствующую стену.
7. Детектор работает только после добавления пользователем нового завершённого
   сегмента. Пассивных предложений после загрузки, move/delete/Align/толщины нет;
   session/global «не предлагать» не вводится.
8. Отдельный Partition удаляется из toolbar. Отдельный Split остаётся доступен;
   возможная дедупликация Split — отдельная будущая задача.

## 5. Scope

В #173 входят:

1. один публичный инструмент «Стены» вместо кнопок «Контур комнаты» и
   «Перегородка»;
2. сохранение активной открытой цепочки как crash-safe `room_draft` во время
   рисования и её явное завершение по смене контекста;
3. преобразование завершённой незамкнутой цепочки в ordinary `partitions` без
   потери координат и толщин;
4. planar graph из solid room-wall intervals, drafts, partitions и нового
   сегмента, включая endpoint, T, X и collinear atomization;
5. поиск только новых bounded faces, возникших из последнего принятого сегмента;
6. предложение standalone, adjacent, nested и clean-split комнат по принятому
   overlap-контракту;
7. последовательная очередь нескольких кандидатов;
8. действия «Создать комнату», «Оставить стенами» и Cancel без частично
   применённой конфигурации;
9. сохранение provenance и толщины новых/существующих рёбер;
10. совместимость старых drafts, partitions и warm session tool;
11. Undo/Redo, optimistic save/conflict, limits, touch safety floor;
12. unit, production-bundle smoke, golden и performance coverage;
13. i18n RU/EN, пользовательские/архитектурные документы и оба changelog.

## 6. Non-scope

В задачу не входят:

- удаление или изменение отдельного Split;
- автоматическое предложение комнат при загрузке, импорте, reload, move, drag,
  delete, Resize, Align, изменении толщины, Undo/Redo или внешнем config update;
- фоновая миграция всех старых `room_drafts` в partitions;
- persisted `node`, `junction`, `face` либо новый storage/config field;
- переписывание или дробление **старых** partitions/drafts ради вычисляемого X/T;
- изменение snap tolerance, endpoint-first порядка и overlay-радиусов #137;
- изменение bounded physical join, cap/mitre/bevel и renderer semantics #141;
- создание комнаты через opening/open-span gap;
- колонны, decor, backdrop, furniture и device markers как рёбра graph;
- новая session/global настройка «не предлагать комнату»;
- новый Finish control, Enter/double-click shortcut либо touch-hover parity;
- удаление, перенос или автоматический rebinding устройств;
- backend schema/API, HA service calls, новые зависимости и security permissions;
- принятие golden baseline вне reviewed Linux artifact.

## 7. Термины и базовые инварианты

- **Активная цепочка** — текущая полилиния инструмента «Стены», хранимая во
  время работы как один `room_draft` с per-segment `cm`.
- **Исходное ребро** — room-wall solid interval, segment draft/partition либо
  новый segment до разрезания пересечениями.
- **Атомарное ребро** — ненулевой отрезок между соседними вычисляемыми graph
  vertices после endpoint/T/X/collinear atomization.
- **Face** — простой bounded polygon, найденный обходом half-edges. Внешняя
  бесконечная область face не является.
- **Новая face** — face, отсутствовавшая до последнего принятого сегмента и
  содержащая хотя бы одно атомарное ребро этого сегмента.
- **Consumed atom** — часть активной цепочки, которая после подтверждения стала
  границей созданной комнаты. Остальные части активной цепочки становятся
  independent partitions.

Инварианты:

1. Topology вычисляется из координат и canonical cuts, не из SVG DOM, толщины
   stroke либо пикселей.
2. Render/hover/topology не мутируют config.
3. Существующая geometry не удаляется и не переписывается по inference.
4. Одна пользовательская координата после snap имеет одну graph-вершину;
   record order, id и direction не меняют результат.
5. Комната создаётся только после явного подтверждения в диалоге.
6. Ошибка/Cancel сохраняет уже нарисованные стены как редактируемый draft, но не
   создаёт частичную комнату.

## 8. UX единого инструмента

### 8.1 Toolbar и начало цепочки

1. Кнопка `Partition` удаляется из Plan toolbar.
2. Текущая кнопка `draw` становится публичным инструментом **«Стены»** и
   остаётся neutral/default tool редактора.
3. Первый click/tap ставит только стартовую точку; одиночная точка не пишется.
4. Каждый следующий отличный resolved point создаёт segment с текущим `cm`,
   сохраняет его в активный `room_draft` и продолжает цепочку.
5. Shift/45°, grid, endpoint/line snap, preview, size badge и limits сохраняют
   действующие контракты.
6. Повторный клик по уже активной кнопке «Стены» ничего не завершает.
7. Existing `Reset` не становится Finish: он очищает локальное продолжение по
   действующему reset-контракту, не конвертируя draft в partitions.

### 8.2 Завершение незамкнутой цепочки

Завершение запускают только:

- переход с «Стены» на другой Plan tool;
- переход в View, Devices или Background;
- смена пространства/этажа, пока активна цепочка.

Reload, route remount/disconnect, external config adoption, pan, pinch,
`pointercancel`, suppressed synthetic click, Escape, Ctrl/Cmd+Z и повторный
выбор «Стены» завершением не являются.

Если есть только стартовая точка, она просто отбрасывается. Если есть один или
больше segment, завершение одной geometry-транзакцией:

1. создаёт ordinary `partitions` из сегментов с теми же endpoints и `cm`;
2. удаляет только соответствующий активный `room_draft`;
3. очищает `_path`, resume/session references и preview;
4. после reload не предлагает эту цепочку для продолжения;
5. записывается именованной Undo/Redo-командой и сохраняется до фактической
   смены контекста.

До добавления каждого segment проверяется, что итоговая конвертация не превысит
`MAX_PARTITIONS`/общие limits. Поэтому смена инструмента не может оставить
пользователя в ловушке «переключение невозможно из-за позднего лимита».

### 8.3 Замыкание и диалог

После каждого принятого ненулевого segment строится topology delta. Если новых
eligible faces нет, рисование продолжается. Если они есть:

1. terminal segment остаётся безопасно сохранённым в active draft;
2. открывается стандартный диалог новой комнаты;
3. при нескольких faces диалог показывает понятный прогресс `i из N` и идёт в
   стабильном порядке §9.5;
4. **Save/Create room** запоминает настройки текущей face;
5. **Оставить стенами** отклоняет только текущую face;
6. после последнего решения весь batch применяется одной geometry-транзакцией;
7. цепочка завершается: consumed atoms становятся room boundaries, остальные
   новые atoms/segments — partitions, active draft удаляется.

Нового предварительного confirm и silent-mode нет.

### 8.4 Cancel, Escape и ошибка

- Cancel, X или Escape в room dialog отменяет **весь ещё не применённый batch**,
  включая ранее введённые в очереди ответы, и возвращает terminal active draft
  в открытое редактируемое состояние.
- Уже сохранённый terminal segment не пропадает; комнаты/partitions из pending
  batch не создаются.
- Validation/limit/boolean/save failure действует так же: no partial room,
  no partial conversion, draft остаётся восстанавливаемым.
- Esc вне диалога и Ctrl/Cmd+Z сохраняют действующую семантику удаления последней
  точки/segment до shared history.
- Conflict с удалённым config проходит текущий reload/conflict path без
  дубликатов rooms/partitions.

## 9. Контракт planar graph и новых faces

### 9.1 Входная геометрия

Graph получает immutable snapshot:

- room boundary axes после canonical opening/open-span cuts #137/#138;
- все валидные inactive `room_drafts`;
- все валидные `partitions`;
- active draft до candidate segment для `before` и с ним для `after`.

Active/saved draft и partition не получают room opening cuts. Columns, wall
thickness offsets, physical body edges, decor, devices и paper не входят.
Malformed/non-finite/zero-length sources игнорируются fail-safe и не ломают
валидный connected component.

### 9.2 Atomization и vertices

1. Endpoint каждого source segment — vertex.
2. Endpoint, точно лежащий на другом solid segment, создаёт T-vertex.
3. Proper X-intersection двух внутренних интервалов создаёт derived vertex в
   обоих рёбрах, даже если пользователь там не кликал.
4. Collinear overlap режется по всем конечным точкам и дедуплицируется в
   undirected atomic edge; provenance всех источников сохраняется.
5. Near-miss вне canonical epsilon не соединяется.
6. Opening/open-span gap удалён до atomization и не получает искусственных
   bridge/endpoints.
7. Persisted old records не дробятся и не переписываются. Atomization является
   вычисляемой projection; исключение — новый active segment при финальной
   принятой конвертации §10.4.

### 9.3 Face traversal и canonical identity

Outgoing half-edges у vertex сортируются по геометрическому углу со стабильным
tie-break. Обход каждого ещё не посещённого half-edge даёт candidate ring.

Face допускается только если:

- ring имеет минимум три разные vertices и положительную площадь выше
  canonical epsilon;
- ring simple после удаления повторов;
- все boundary atomic edges существуют в graph;
- это bounded, а не внешняя face;
- canonical ring identity одинакова при cyclic shift, reverse winding,
  перестановке records, id и направлении endpoints.

Точный алгоритм half-edge/DCEL свободен, но pairwise «нашли любой цикл» без
выделения faces запрещён: он создаёт составные внешние циклы поверх внутренних.

### 9.4 Delta: только то, что замкнул пользователь

До append строится или берётся cached `before` component; после append —
`after`. В очередь попадают только faces, которые:

1. отсутствуют по canonical identity в `before`;
2. присутствуют в `after`;
3. содержат хотя бы один atomic interval нового segment;
4. проходят room eligibility §10.

Поэтому уже существующий closed partition ring не открывает диалог при reload
или при несвязанном клике. Detector вызывается только после commit candidate
segment; pointermove/hover строят прежний локальный preview без face traversal.

### 9.5 Порядок и дедупликация кандидатов

Exact room polygon duplicate исключается. Остальные eligible faces
дедуплицируются по canonical identity и сортируются:

1. площадь по возрастанию;
2. canonical ring key как стабильный tie-break.

При равной площади DOM order, room id, source record order и winding не меняют
очередь. Отклонение одной face не удаляет из очереди другую.

## 10. Создание комнат и provenance стен

### 10.1 Standalone, adjacent и nested room

Для face, которая не является clean split:

- partial overlap с любой существующей room polygon отклоняется текущей
  validation/toast семантикой;
- exact duplicate не предлагается;
- полное вложение в существующую комнату или охват существующей вложенной комнаты
  разрешены как действующий island-room контракт;
- devices, decor, openings, columns и independent walls не блокируют face;
- Save создаёт обычный `room.poly` с выбранными name/HA area/settings;
- существующие room walls, drafts и partitions, использованные как часть
  boundary, остаются на месте и не удаляются по inference.

### 10.2 Clean split существующей комнаты

Если new wall path даёт валидное разбиение одной room polygon на две простые
части по действующему `splitRoomPath`/area invariant:

1. диалог относится к меньшей части;
2. большая сохраняет исходные id, name, HA area, settings, label/device positions;
3. при равной площади используется действующий детерминированный tie-break;
4. Save применяет тот же materialize/normalize/open-span порядок, что Split;
5. «Оставить стенами» не меняет room polygon или metadata;
6. отдельный Split остаётся pixel/behavior-compatible.

Если graph face находится внутри комнаты, но не образует представимое clean
split с одной простой remainder polygon, она рассматривается по разрешённому
nested-room контракту либо отклоняется текущей partial-overlap validation; parent
не переписывается эвристически.

### 10.3 Несколько faces

Room settings для каждого принятого кандидата буферизуются до конца очереди.
Одна final transaction валидирует batch повторно на исходном snapshot и только
затем одновременно:

- создаёт принятые rooms;
- применяет clean splits;
- конвертирует не consumed новую геометрию в partitions;
- удаляет active draft;
- обновляет walls/open spans и rebuild устройств по действующим контрактам;
- создаёт одну именованную Undo/Redo-команду и один config save.

Если комбинация независимых ответов образует partial overlap, disconnected
remainder либо превышает limits, batch не применяется: пользователь получает
validation error, а active draft остаётся. Частичное сохранение первых диалогов
запрещено.

### 10.4 Новые рёбра, старые рёбра и толщина

1. Existing room wall сохраняет свою authoritative thickness.
2. Existing partition/draft сохраняет запись, id, selection/history identity и
   собственный `cm`; создание room по его оси не удаляет объект.
3. Каждый active-draft segment сохраняет `cm`, выбранный в момент клика.
4. Если только часть нового segment consumed room boundary, segment можно
   разрезать **в рамках явной подтверждённой операции** по graph vertices:
   consumed atoms переходят в room wall intervals, остальные становятся одной
   или несколькими partitions с исходным `cm`.
5. Полностью consumed active atoms не дублируются independent partition.
6. При полном отказе от faces исходные active segments становятся partitions без
   лишнего дробления только ради derived X/T.
7. Room-wall normalization #150/#172, joined physical geometry #141, clean
   floor, Glow, sun, static и hidden Iso используют существующие canonical
   consumers; topology detection не вводит второй renderer.

## 11. Модель данных, compatibility и миграция

Новых persisted полей нет.

- `rooms[].poly`, `walls`, `room_drafts`, `partitions`, `openings` и
  `open_spans` сохраняют текущую schema;
- backend validation, storage version, import/export и Python model не меняются;
- старые partitions остаются обычными selectable objects;
- старые room drafts остаются видимыми и могут быть продолжены через единый
  инструмент; автоматически при чтении они не конвертируются;
- legacy warm viewport tool `partition` нормализуется в `draw`/«Стены» без
  создания geometry;
- reload/remount во время активного рисования восстанавливает безопасный draft,
  а не считает технический disconnect выходом из редактора;
- новая версия пишет только уже валидные старой schema rooms/partitions, поэтому
  downgrade не требует data rollback;
- topology, hover и dialog preview не пишут config/layout/localStorage.

## 12. UX, i18n, accessibility и touch

### UX и i18n

RU/EN обязательно обновляют:

- toolbar label `Контур комнаты / Room outline` → `Стены / Walls`;
- title и hints: одна цепочка, Shift/45°, Esc/Ctrl+Z, предложение комнаты;
- удаляется toolbar-only copy отдельного Partition, но слово «Перегородка»
  сохраняется как label существующего selectable object/properties;
- при queue `N > 1` диалог показывает локализованный `Комната i из N / Room i of
  N` либо эквивалентный понятный progress;
- существующие «Оставить стенами», validation toasts, room fields и Save/Cancel
  переиспользуются, где их смысл совпадает.

Нового Finish/Enter control, setting или help toggle нет.

### Accessibility

- удалённая кнопка больше не остаётся в tab order или ARIA toolbar;
- «Стены» получает корректные title/aria-label и pressed state;
- room queue остаётся modal, сохраняет focus trap/return и объявляет `i из N` в
  title/status без отдельного плавающего слоя;
- keyboard Escape/Undo не меняют смысл;
- forced colours/reduced motion не получают новой анимационной зависимость.

### Touch

**Touch editor: best effort / intentionally degraded.** Desktop — reference.

- tap без pointermove повторно решает snap/topology после commit;
- hover parity не обещается;
- смена инструмента/режима завершает цепочку так же, как desktop;
- pinch, pan, second pointer, pointercancel и suppressed synthetic click не
  завершают цепочку и не создают segment/room;
- View и kiosk остаются fully supported и не получают новых interactions.

## 13. Архитектурный и performance-контракт

1. Face detection выделяется в чистый модуль (`wall-face-graph.ts` или
   эквивалент), независимый от Lit/DOM и пригодный для exhaustive unit tests.
2. `plan-snap-overlay` остаётся источником canonical architectural axes/cuts
   либо делит с detector общий pure collector; второй opening resolver запрещён.
3. Graph строится для connected component нового segment либо использует
   bounded structural cache. На каждом pointermove full graph не строится.
4. Structural key включает coordinates/provenance/cuts/space/grid epsilon, но не
   HA state, theme, hover, cursor, glow tick и animation.
5. Atomization и half-edge traversal должны иметь документированную сложность;
   на валидном input ожидается не хуже `O((E + I) log E)` либо эквивалентного
   bounded spatial подхода, где `I` — реальные intersections component.
6. Cache bounded и инвалидируется существующим geometry lifecycle.
7. Нельзя ослаблять `large-house-plan-snap-v1` budgets. Accepted-click/face
   traversal получает измерение в этом профиле либо отдельный профиль с теми же
   original timing/heap/DOM invariants.
8. Boolean/graph failure fail-safe: draft остаётся, room не создаётся, config не
   мутирует. Исчезновение стены или частичная комната как fallback запрещены.
9. Новых network calls, HA services, dynamic code и внешних зависимостей нет.

## 14. Acceptance criteria

- **AC1 (`unit` + `smoke` + `golden`; разработчик):** Plan toolbar содержит одну
  кнопку `Стены/Walls` вместо Room outline + Partition; legacy warm tool
  `partition` безопасно открывает `Walls`, отдельный Split остаётся доступен и
  сохраняет прежний сценарий.
- **AC2 (`unit` + `smoke`; разработчик):** open chain из 1…N segments сохраняет
  per-segment endpoints/cm как active draft; смена Plan tool, mode или space
  атомарно создаёт ordinary partitions, удаляет draft и исключает auto-resume.
  Одна стартовая точка не пишет config.
- **AC3 (`smoke`; разработчик):** Esc/Ctrl+Z убирают последнюю точку, Reset не
  становится Finish, а pan/pinch/second pointer/pointercancel/suppressed click,
  reload и remount не завершают цепочку и не создают лишнюю geometry.
- **AC4 (`unit`; разработчик):** graph atomizes endpoint, exact T, proper X и
  collinear overlaps; near-miss и opening/open-span gaps не соединяются;
  malformed/zero input не портит valid component. Persisted old records не
  мутируют.
- **AC5 (`unit`; разработчик):** half-edge traversal возвращает только simple
  bounded faces с canonical identity; результат и order не зависят от ids,
  record order, endpoint direction, winding и cyclic start. Compound cycles и
  внешняя face исключены.
- **AC6 (`unit` + `smoke`; разработчик):** dialog появляется только для face,
  добавленной последним committed segment и содержащей его atom. Existing
  closed ring, reload, move/delete/Align/Resize/thickness/Undo/Redo и unrelated
  segment не вызывают пассивное предложение.
- **AC7 (`unit` + `smoke`; разработчик):** новая область замыкается собственной
  цепочкой, несколькими room edges, saved draft/partition, endpoint, T и X.
  Adjacent scenario #138 остаётся зелёным; gap через opening/open-span не
  предлагает room.
- **AC8 (`unit` + `smoke`; разработчик):** exact duplicate room не предлагается,
  partial overlap отклоняется без mutation, full nesting в обе стороны
  сохраняет island-room contract; devices/decor/openings/columns внутри не
  блокируют valid candidate.
- **AC9 (`unit` + `smoke`; разработчик):** clean wall-to-wall split сохраняет
  metadata/id/positions большей части и настраивает меньшую; отказ оставляет
  original room bit-equivalent. Отдельный Split проходит прежние regression
  tests.
- **AC10 (`unit` + `smoke`; разработчик):** несколько faces идут area-ascending
  с stable tie-break и progress `i/N`; Create/Keep решения независимы, но final
  apply один. Cancel/error/conflict/invalid combination оставляют terminal draft
  без частичных rooms/partitions.
- **AC11 (`unit` + `smoke`; разработчик):** accepted batch удаляет только active
  draft; existing walls/drafts/partitions не удаляются. Consumed active atoms
  получают правильные room-wall cm, unconsumed части становятся partitions с
  исходным cm; полный отказ сохраняет исходные segments без лишнего split.
- **AC12 (`unit` + `smoke` + `golden`; разработчик):** Plan/View/static/hidden
  Iso, clean floor, Glow и sun используют существующую canonical physical
  geometry #141/#150/#172; dialog/topology/render не переписывают config и не
  создают визуального jump/double wall.
- **AC13 (`unit` + `smoke`; разработчик):** conversion и accepted room batch
  являются именованными Undo/Redo-командами; partition/room limits проверяются
  до mutation; save conflict не оставляет duplicate/lost geometry.
- **AC14 (`unit` + backend/schema review; разработчик/ревьюер):** schema,
  backend, import/export, старые plans/drafts/partitions и downgrade остаются
  совместимыми без migration/write-on-read; новых HA/network/security paths нет.
- **AC15 (`performance` + code review; разработчик/ревьюер):** face traversal не
  запускается на pointermove/hover/HA state; large-house snap profile и новый
  accepted-click measurement проходят неизменные timing, heap, cache и DOM
  budgets.
- **AC16 (`smoke` + code review; разработчик/ревьюер):** touch safety floor и
  View/kiosk не регрессируют; no-hover tap может выполнить тот же commit, но
  hover parity редактора не обещается.
- **AC17 (`typecheck` + `unit` + `build` + documentation review; разработчик):**
  implementation-loop gates зелёные, три bundle-копии побайтно одинаковы, RU/EN
  i18n, оба changelog и перечисленные документы обновлены в одном
  user-visible implementation commit.

## 15. План автотестов и гейтов

### 15.1 Unit

Добавить отдельный pure suite, предпочтительно
`test/wall-face-graph.test.mjs`, плюс lifecycle tests:

1. endpoint/T/X/collinear atomization, reverse/order/permutation invariance;
2. near-miss, gaps, zero/non-finite, duplicate axes;
3. rectangle, concave face, nested faces, compound cycles и unbounded face;
4. before/after delta и provenance последнего segment;
5. several faces area order и equal-area tie;
6. exact duplicate, partial overlap, inner/outer nesting;
7. clean split metadata и bit-equivalent rejection;
8. active draft → partitions, per-segment cm, limit reservation;
9. consumed/unconsumed atom conversion без mutation старых records;
10. pending batch Cancel/error/conflict/Undo/Redo;
11. legacy `partition` tool normalization и old draft compatibility;
12. structural cache invalidation и immutability.

Минимум один topology test должен краснеть на `origin/dev` без detector, а
ревьюер обязан проверить его mutation discipline.

### 15.2 Targeted production-bundle smoke

Добавить `demo/smoke_unified_wall_tool.mjs` либо эквивалент, который через
реальный UI:

1. подтверждает одну toolbar-кнопку Walls и наличие Split;
2. рисует open polyline, меняет tool/mode/space и проверяет partitions/no draft;
3. проверяет Esc/Undo и pointer safety;
4. создаёт room собственным loop, adjacent multi-edge path и older partition;
5. создаёт T и X closure без persisted rewrite старых records;
6. разделяет room wall-to-wall, проверяет original metadata и Keep walls;
7. проводит segment, замыкающий две faces, проходит progress/order и mixed
   Create/Keep;
8. отменяет queue и получает исходный active draft без partial room;
9. выполняет reload/remount и safe resume;
10. сравнивает Plan/View/static/hidden Iso signatures и no-write render.

Named smoke запускается локально перед `S7-code-review` по актуальному процессу.

### 15.3 Golden

Golden matrix получает минимум:

- light/dark Plan toolbar без Partition;
- active Walls chain и T/X snap topology;
- room queue `1/N` и `N/N`;
- before/after open-chain conversion;
- View/static/hidden Iso результата с adjacent/split room.

Existing unrelated baselines не принимаются автоматически. Любой baseline —
только через `golden:accept -- --reviewed` по полному Linux artifact.

### 15.4 Performance и backend

- расширить `large-house-plan-snap-v1` accepted-click diagnostics либо добавить
  сопоставимый `large-house-wall-face-v1` без ослабления исходных budgets;
- измерить no-op segment, one-face и multi-intersection component;
- подтвердить отсутствие traversal на серии pointermove и bounded cache growth;
- backend не меняется; отдельный Python test не требуется, но Linux Validate
  остаётся release gate.

### 15.5 Implementation loop

Во время реализации:

```powershell
npm run typecheck
npm test
npm run build
```

После build три bundle-копии синхронизируются побайтно. Named smoke выполняется
перед передачей в code review. Полный golden/performance/backend suite — на
предрелизном этапе и Linux CI по действующему процессу.

## 16. План реализации

1. Выделить pure architectural source collector/face graph с provenance.
2. Добавить before/after delta и room eligibility/classification.
3. Свести toolbar/session state к одному Walls tool и legacy normalization.
4. Реализовать безопасное finish active draft → partitions на смене контекста.
5. Ввести pending room-face queue и atomic batch commit.
6. Переиспользовать current room creation/Split/wall normalization для
   standalone/nested/split cases.
7. Добавить unit, targeted smoke, golden fixtures и performance diagnostics.
8. Обновить i18n, документы, changelog и три bundle-копии.

Точные имена helpers и раскладка файлов не являются продуктовым контрактом.

## 17. Release-артефакты

Изменение пользовательское. Implementation commit имеет `User-Visible: yes` и
в том же коммите обновляет:

- `docs/CHANGELOG.md`;
- `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — единый Walls flow, finish и room proposal;
- `docs/UX-MODES.md` — Plan toolbar и independent walls;
- `docs/CANVAS.md` — graph/snap/face topology;
- `docs/ARCHITECTURE.md` — session draft, planar graph и batch transaction;
- `docs/WALL-THICKNESS.md` — provenance consumed/unconsumed edges;
- `docs/TESTING.md` — unit/smoke/golden/performance coverage;
- `docs/TOUCH-SUPPORT.md` только если implementation уточняет documented
  degradation;
- `docs/STATUS.md` после фактической реализации;
- RU/EN i18n;
- golden matrix/fixtures без непроверенного baseline;
- три поставляемые bundle-копии.

Перед бетой: exact-SHA Linux Validate, полный smoke-suite, reviewed golden,
performance smoke/Full Performance и зелёный code review. Изменение проходит
beta до stable.

## 18. Риски и снижение

| Риск | Вероятность / ущерб | Снижение |
|---|---|---|
| Cycle finder примет составной цикл вместо face | высокая / высокий | half-edge face traversal, compound/unbounded units |
| X/collinear epsilon создаст ложную комнату | средняя / высокий | canonical atomization, near-miss/gap matrix |
| Batch частично изменит несколько rooms | средняя / высокий | buffered decisions, one revalidation + one transaction |
| Split потеряет id/HA area/devices | средняя / высокий | reuse current Split path, metadata regression smoke |
| Active draft исчезнет при Cancel/remount | средняя / высокий | terminal segment persisted first, no partial commit |
| Consumed segment потеряет внешнюю часть | средняя / высокий | provenance atoms, consumed/unconsumed conversion tests |
| Existing partition удалится как «лишний» | низкая / высокий | standing no-delete-on-inference invariant |
| Finish превысит partition limit при смене tool | средняя / высокий | reserve/check capacity before accepting each segment |
| Full graph попадёт в pointermove | средняя / высокий | click-only API, benchmark diagnostics and cache assertions |
| Toolbar cleanup сломает old warm state | средняя / средний | normalize legacy `partition` → Walls unit/smoke |
| Touch gesture сохранит стену | низкая / высокий | pointercancel/pinch/suppressed-click smoke |
| Golden изменятся шире editor toolbar | средняя / средний | matrix audit, reviewed Linux acceptance only |

## 19. Откат

Откат — revert одного user-visible implementation commit вместе с tests, docs,
i18n, changelog и bundles. Новые rooms и partitions используют старую schema и
останутся читаемыми; data migration/rollback не нужны. После отката вернутся две
кнопки и прежний ограниченный closure flow.

Красный topology/smoke/golden/performance gate блокирует выпуск. Feature flag,
ослабление budget или удаление теста как способ отката не используются.

## 20. Принятые технические предположения — можно менять без продуктового ревью

1. Рекомендуется half-edge/DCEL-подобный pure representation; другой алгоритм
   допустим при выполнении canonical face AC.
2. Graph epsilon переиспользует существующую geometry/grid precision и не
   становится настройкой пользователя.
3. Before/after может пересчитывать только connected component candidate
   segment; exact cache structure свободна.
4. Pending queue хранится только в session memory; persisted draft является
   crash-safe source of truth до final batch.
5. Exact progress key, history names, helper/file/smoke/golden ids свободны при
   наличии RU/EN и выполнении AC.
6. `Reset` может очистить только active session pointer либо оставить saved draft
   для явного endpoint resume, но не считается owner-approved Finish trigger.
7. Active new segments разрешено разрезать в persisted partitions только когда
   пользователь подтвердил room и это нужно для сохранения unconsumed части;
   старые records не дробятся.
8. Clean split classification может переиспользовать `splitRoomPath`; общий face
   detector не обязан заменять canonical polygon split helper.
9. Full nested rooms сохраняют действующий smallest/geometry resolution других
   подсистем; #173 не вводит новый device-room arbitration.
10. Открытых продуктовых вопросов нет: Q1 принят с правкой владельца, Q2–Q7 —
    defaults, 18.08.2026.
