# ТЗ #457 — направление Zigbee-связей к координатору

- Issue: https://github.com/Matysh/houseplan-card/issues/457
- Базовый контракт топологии: [ТЗ #54](054-zigbee-topology-overlay.md)
- Приоритет: P2
- Тип: feature
- Сложность: 4/5
- Трек: полный — новый визуальный контракт, производный граф, i18n и browser smoke
- Продуктовые решения владельца: 2026-09-05

## 1. Сценарий

Персона — администратор дома из `docs/SCOPE.md`, работающий в полной карточке
House Plan на компьютере с мышью. В общих настройках уже включено отображение
Zigbee-связей и явно загружен snapshot ZHA или Zigbee2MQTT.

Администратор наводит курсор на проблемное устройство и хочет не только увидеть
его радиососедей, но и понять, через какое следующее устройство путь ведёт к
координатору и какие устройства, наоборот, используют наведённый router как
следующий шаг.

## 2. Что человек увидит до и после

До: при наведении House Plan показывает одинаковые линии ко всем доступным
соседям; направление к координатору по ним определить нельзя.

После: те же линии и LQI-цвета остаются, но на рёбрах выбранного дерева
маршрутов появляются стрелки к координатору. У обычного устройства одна
исходящая стрелка, у router также могут быть входящие стрелки от детей, а
резервные соседские связи остаются без стрелок. Если следующий узел нельзя
показать на текущем плане, короткая стрелка ведёт в поясняющий bubble рядом с
наведённым устройством.

## 3. Проблема и текущее состояние

`ZigbeeTopologyLink` уже хранит направленные наблюдения `aToB` и `bToA`, но
`ZigbeeHoverLine` несёт только `neighborMarkerId` и `lqi`.
`resolveMappedTopologyHover()` классифицирует локальные, удалённые и
неотрисованные endpoints, а `hp-zigbee-topology-overlay` рисует обычные SVG
`line`. Поэтому существующая картинка отвечает на вопрос «кого видит это
устройство», но не отвечает на вопрос «куда отсюда двигаться к координатору».

Нельзя ставить стрелку непосредственно по `relationship` каждого neighbour
record. Снимки могут быть неполными или взаимно противоречивыми: два узла могут
одновременно назвать друг друга родителем, sibling не задаёт направление, а
устаревшие записи способны образовать цикл. Требование владельца сильнее
отдельного provider-наблюдения: двигаясь по стрелкам, пользователь должен
приходить к координатору. Это свойство должно обеспечиваться построением
производного дерева.

Дополнительный дефект нормализации: Zigbee2MQTT передаёт `relationship` числом,
а текущий `observation()` принимает только строку. В результате полезное
предпочтение родителя теряется, хотя сам граф и LQI сохраняются.

## 4. Скоуп

В #457 входят:

- детерминированное дерево аплинков отдельно для каждой topology instance;
- построение дерева по полному нормализованному графу, включая узлы без marker;
- стрелки только на рёбрах дерева, всегда в направлении к координатору;
- сохранение всех существующих прямых соседских линий, halo и LQI-семантики;
- parent bubble со стрелкой, если следующий узел находится в другом
  пространстве или не имеет drawable marker;
- нормализация числовых `relationship` Zigbee2MQTT;
- локализованные тексты для отсутствующего устройства и координатора;
- пояснение семантики в руководстве пользователя;
- unit-проверка дерева и инварианта, расширение topology hover smoke;
- сохранение lazy boundary и существующих performance budgets.

## 5. Не-скоуп

В #457 не входят:

- фактическая трассировка каждого Zigbee-пакета или гарантия реального текущего
  маршрута между router-узлами;
- постоянный полный mesh-граф, режим «показать все связи» или легенда;
- изменение способа и частоты получения ZHA/Zigbee2MQTT snapshots;
- автоматическое сканирование, история маршрутов и анимация пакетов;
- новая визуализация асимметрии LQI;
- изменение цветов, толщины или состава существующих соседских линий;
- отдельный topology-жест для touch/pen, keyboard focus, kiosk,
  `houseplan-space-card` или редакторов;
- автоматическое размещение координатора либо других отсутствующих устройств;
- переход в другое пространство по bubble;
- новые настройки или изменение сохранённого конфига.

## 6. Контракт производного дерева

### 6.1. Изоляция provider-сетей

Дерево строится отдельно для каждого `ZigbeeTopology`, то есть для пары
`provider + instanceId`. Узлы и рёбра разных ZHA/Zigbee2MQTT instances никогда
не объединяются в один маршрут.

Ровно один узел с `role: coordinator` становится корнем. Если координатора нет
или нормализованный instance содержит несколько координаторов, дерево для этого
instance не строится: соседские линии продолжают работать как сейчас, но
стрелок и parent bubble нет. Неоднозначность не исправляется выбором по имени,
порядку или IEEE.

### 6.2. Дистанция и выбор родителя

От координатора выполняется обход в ширину по ненаправленному набору
нормализованных links. Для каждого достижимого узла фиксируется минимальное
число рёбер до координатора.

Родитель узла с дистанцией `d > 0` выбирается только среди его соседей с
дистанцией `d - 1`. Это ограничение обязательно: оно по построению исключает
циклы и гарантирует продвижение к корню на каждом шаге.

Если допустимых родителей несколько, применяется стабильный порядок:

1. сначала сосед, которого направленное наблюдение **от дочернего узла к
   соседу** называет `parent`;
2. затем большее известное LQI того же направления; известное значение выше
   отсутствующего;
3. при полном равенстве — лексикографически меньший `node.key`.

Обратное LQI не подменяет отсутствующее прямое наблюдение и не усредняется с
ним. `relationship`, указывающий на соседа той же или большей дистанции,
игнорируется как устаревшее предпочтение, потому что нарушил бы инвариант.

Недостижимые от координатора компоненты не получают parent. Их прямые связи
видны как сейчас, без стрелок; отсутствие стрелки и есть согласованный сигнал,
что путь по snapshot неизвестен.

### 6.3. Нормализация relationship

Строковые значения нормализуются без учёта регистра, пробелов, дефисов и
подчёркиваний. Числа Zigbee2MQTT преобразуются в канонические значения:

| Значение | Каноническая семантика |
|---:|---|
| 0 | `parent` |
| 1 | `child` |
| 2 | `sibling` |
| 3 | `none` |
| 4 | `previous_child` |

Неизвестное число или строка не отбрасывает link и LQI, а означает отсутствие
предпочтения. Только `parent` влияет на tie-break выбора родителя; остальные
значения сохраняются для диагностики, но не задают стрелку напрямую.

### 6.4. Инварианты

Для каждого построенного дерева должны выполняться свойства:

1. у координатора нет parent;
2. у каждого другого включённого узла ровно один parent;
3. дистанция parent всегда на единицу меньше дистанции ребёнка;
4. циклов нет;
5. повторный переход по parent за конечное число шагов достигает координатора;
6. одинаковый snapshot всегда даёт одинаковое дерево независимо от порядка
   `nodes` и `links` во входном массиве.

## 7. Контракт hover

### 7.1. Локальные endpoints

Hover по-прежнему берёт только incident links наведённого node.

- если сосед выбран parent наведённого node, стрелка идёт от наведённого marker
  к соседу;
- если наведённый node выбран parent соседа, стрелка идёт от marker соседа к
  наведённому marker;
- если link не входит в дерево, линия остаётся без стрелки;
- координатор не имеет исходящей стрелки, но может принимать входящие;
- цвет, пунктир и LQI линии по-прежнему берутся из наблюдения от наведённого node
  к соседу, независимо от направления стрелки;
- существующий halo каждого drawable локального соседа сохраняется.

Если одна и та же физическая пара неожиданно пришла из двух независимых
instances, результаты instances не смешиваются в одно дерево. Совпадающие
отрисованные линии могут быть дедуплицированы по marker endpoints; при
противоречащих направлениях наконечник fail-closed не показывается.

### 7.2. Parent в другом пространстве

Если parent имеет drawable marker, но находится в другом пространстве, линия к
его неизвестной экранной позиции не рисуется. Возле наведённого marker
появляется один короткий parent bubble с названием пространства, и стрелка от
marker направлена к bubble.

Название берётся из текущего server config и передаётся overlay как явная
`spaceId -> title` проекция. Пустой или отсутствующий title не заменяется raw
space id: используется локализованный безопасный fallback «другое
пространство».

Parent, представленный отдельным bubble, исключается из старого агрегата
`+{n} в других пространствах`, чтобы одна связь не считалась дважды. Остальные
drawable remote соседи, не являющиеся parent наведённого node, продолжают
участвовать в агрегате по контракту #54.

### 7.3. Parent без drawable marker

Если parent присутствует в полном графе, но не сопоставлен с drawable marker,
показывается bubble со стрелкой:

| Роль parent | Текст bubble |
|---|---|
| `coordinator` | «координатора нет на плане» |
| любая другая | «устройства нет на плане» |

Одинаковый текст «устройства нет на плане» применяется к отсутствующему,
hidden/removed, ambiguous, HA-disabled, unmatched и отмеченному provider как
недоступный parent. Эти технические причины не раскрываются в View.

Bubble создаётся только для parent наведённого устройства. Неразмещённые дети,
для которых наведённый router является parent, не получают ни bubble, ни
подпись. Остальные omitted endpoints остаются невидимыми, как в #54.

### 7.4. Нет известного пути

Если дерево не построено либо наведённый node не достижим от координатора,
parent bubble не показывается и маршрут не выдумывается. Существующие прямые
соседские линии, remote count и lifecycle hover продолжают работать.

## 8. UX и визуальная геометрия

> **Заменено #464:** актуальный порядок active topology относительно room
> labels, посторонних markers и endpoints, а также casing unknown-LQI линии
> задаёт [ТЗ #464](464-zigbee-topology-layer-order.md). Геометрия и семантика
> route arrows/bubbles из этого раздела сохраняются.

- Стрелка — заполненный треугольный наконечник цвета своей линии; новый цвет или
  legend не вводятся.
- Геометрия наконечника рассчитывается в экранных пикселях, а не в процентах
  растянутого SVG. Изменение aspect ratio контейнера не сплющивает и не
  поворачивает стрелку неверно.
- Наконечник локальной связи располагается перед halo целевого marker и не
  уходит под marker/halo. Линия остаётся визуально соединённой с endpoint.
- Для входящей стрелки целью является halo наведённого marker; для исходящей —
  halo соседнего marker.
- Bubble имеет screen-space отступ от наведённого marker, не перекрывает его
  hit area, остаётся `pointer-events:none` и не участвует в fit/bounds.
- Короткая линия к bubble оканчивается у границы bubble, а наконечник направлен
  в bubble, не в произвольную точку плана.
- При недостатке места bubble может сместиться на противоположную сторону
  marker, оставаясь внутри видимой области overlay; текст не обрезается сырой
  идентификационной строкой.
- Arrow/bubble находятся в существующем topology layer: над архитектурой и
  decor, под device markers и tooltip.
- Light/dark themes сохраняют существующую контрастность bubble. В
  `forced-colors` линия, наконечник и граница bubble используют системные
  `Highlight` / `CanvasText` / `Canvas`.
- Hover cleanup, pointer ownership и действия устройств не меняются. Весь новый
  слой pointer-transparent.

## 9. Режимы, touch и доступность

Функция остаётся mouse-hover диагностикой полной карточки в View для
администратора.

- Touch/pen не получают стрелок, bubble или нового жеста; их событие немедленно
  очищает активный mouse hover по контракту #54.
- Keyboard focus не имитирует hover.
- В Plan, Devices, Background, kiosk и `houseplan-space-card` topology overlay
  не создаётся.
- Новые элементы имеют `aria-hidden` и не образуют интерактивных tab stops,
  потому что дублируют временную визуальную диагностику без нового действия.
- Существующие tap, long press, click, tooltip, pan/pinch и fit не меняются.

Это сознательно не добавляет touch-путь к административной radio-диагностике и
не ослабляет touch-first контракт обычного View: сама функция остаётся
выключенной по умолчанию и недоступна non-admin.

## 10. Модель данных, миграция и совместимость

Сохранённая конфигурация и topology provider payload не меняются. Новые данные
существуют только в памяти:

```ts
type ZigbeeRouteParent = {
  parentNodeKey: string;
  distance: number;
};

type ZigbeeRouteDirection = 'toward-neighbor' | 'toward-origin' | 'none';

type ZigbeeParentTarget =
  | { kind: 'local'; markerId: string }
  | { kind: 'remote-space'; spaceId: string }
  | { kind: 'unplaced-device' }
  | { kind: 'unplaced-coordinator' };
```

Имена типов допускается уточнить без изменения поведения. Route projection
вычисляется рядом с `mapTopologies` и мемоизируется на тот же snapshot + devices
+ registry lifecycle; она не пересчитывается на каждый render или HA state tick.

`ZigbeeHoverLine` расширяется направлением стрелки, а
`ZigbeeHoverResolution` — максимум одним parent target для каждого обработанного
instance. Raw IEEE, provider payload и внутренний node key не передаются в DOM,
тексты или console.

Миграции нет. Старый config читается и сохраняется без изменений, downgrade
игнорирует отсутствие runtime-only полей. Compatibility-поля не добавляются.

## 11. i18n

В `src/i18n/topology/{en,ru,de,fr}.json` добавляются одинаковые ключи:

- `route_device_not_on_plan`;
- `route_coordinator_not_on_plan`;
- `route_other_space` — безопасный fallback, если title пространства пуст.

Название пространства остаётся пользовательским title и не переводится. Новые
строки не включают IEEE, device id, space id или provider error text. Parity и
dead-key проверки обязательны для четырёх тематических словарей.

## 12. Производительность и lazy boundary

- Полный обход ограничен действующими лимитами: не более 1000 nodes и 6000
  links на instance.
- Построение расстояний и parent map имеет сложность `O(V + E)` и выполняется
  один раз на изменение topology/mapping, а не на hover.
- Hover остаётся incident-only; он не запускает повторный BFS.
- `benchmark:zigbee-topology` расширяется построением дерева и сохраняет текущие
  потолки `normalize 80 ms`, `map 160 ms`, `first hover 180 ms`, `20 repeated
  hovers 120 ms` на 500-node fixture. Поднимать бюджеты в рамках задачи нельзя
  без отдельного измеренного решения.
- Topology model/overlay/i18n остаются в существующем lazy chunk. Выключенная
  опция не загружает их и не выполняет route work.
- Initial View graph остаётся в действующем bundle budget и ceiling.

## 13. Безопасность и privacy

Новых backend/API/service-call поверхностей нет. Стрелки используют только уже
загруженный memory-only snapshot и не инициируют scan или fetch. Права остаются
admin-only на существующем bridge.

IEEE, raw topology, внутренние ids и `relationship` не попадают в saved config,
export, backup, diagnostics, support report, localStorage, DOM-текст или console.
Пользовательский title пространства проходит существующий Lit text binding, не
вставляется через `unsafeHTML` и не становится CSS.

## 14. Критерии приёмки и доказательства

### AC1. Дерево всегда ведёт к координатору

Для каждого корректного instance ровно с одним координатором parent map
ациклична, уменьшает дистанцию на каждом шаге и приводит каждый достижимый узел
к координатору. Порядок входных arrays результат не меняет.

Доказательство: pure unit на цепочке, ромбе, циклическом mesh, disconnected
component и перестановках nodes/links.

### AC2. Parent выбирается детерминированно

Среди соседей предыдущего BFS-уровня соблюдается порядок: direct
`relationship=parent`, затем direct LQI, затем stable node key. Противоречивый
relationship не создаёт цикл и не уводит на тот же/следующий уровень.

Доказательство: table-driven unit, включая one-way observations и ties.

### AC3. Z2M relationship сохраняется

Числа 0…4 реальной Z2M network-map fixture нормализуются в заявленные значения;
неизвестное значение сохраняет link/LQI и не становится parent preference.

Доказательство: unit на обезличенной fixture и snake/camel-case payloads.

### AC4. Локальные стрелки имеют правильное направление

При hover parent-связь наведённого устройства показывает стрелку от него к
соседу; child-связь — от соседа к наведённому; non-tree link остаётся без
наконечника. У координатора нет исходящей стрелки.

Доказательство: resolver unit + `smoke_zigbee_topology_hover.mjs` с DOM-атрибутом
направления и pixel-geometry assertions.

### AC5. Соседские линии не регрессируют

Количество существующих drawable incident links, их hovered-side LQI-цвет,
unknown-пунктир и halo не меняются из-за route tree. Линия без известного пути
остаётся обычной линией.

Доказательство: существующие unit/smoke assertions #54 плюс regression cases.

После #464 состав, LQI и геометрия линий по-прежнему не меняются, но
unknown-LQI пунктир получает 1 CSS px внешний casing и новый порядок слоя.

### AC6. Remote parent заканчивается названием пространства

Parent в другом пространстве получает короткую стрелку к bubble с title
пространства; не создаёт линию к выдуманной позиции и не дублируется в
`remote_count`. Остальные remote соседи продолжают учитываться агрегатом.

Доказательство: resolver unit + browser smoke с двумя пространствами.

### AC7. Unplaced parent объяснён без утечки деталей

Неразмещённый coordinator показывает «координатора нет на плане», другой parent
— «устройства нет на плане». Hidden, ambiguous, unmatched, HA-disabled и
provider-unavailable parent используют тот же безопасный device-текст.
Неразмещённые дети bubble не создают.

Доказательство: classification unit + browser smoke + DOM privacy assertions.

### AC8. Неоднозначный или неизвестный корень fail-closed

При нуле/нескольких координаторах и для disconnected component стрелки и parent
bubble не выдумываются, а обычные incident lines продолжают работать.

Доказательство: pure unit + smoke fallback case.

### AC9. Arrow geometry остаётся экранной

На широком и высоком контейнере, при min/default/max zoom наконечник сохраняет
размер и угол, располагается перед target halo; bubble line заканчивается у
границы bubble. Layer остаётся pointer-transparent.

Доказательство: pure pixel-geometry unit + browser smoke на двух aspect ratios и
трёх zoom; computed styles для pointer ownership.

### AC10. Themes, forced colors и lifecycle сохранены

Light/dark/forced-colors читаемы; pointerleave, mouse→touch/pen, mode/space
change, setting off и disconnect очищают стрелки и bubble вместе с линиями.

Доказательство: browser theme/modality/lifecycle smoke и CSS audit.

### AC11. Производительность и lazy boundary не ухудшены

Route tree строится один раз на snapshot/mapping, benchmark проходит без
увеличения бюджетов, disabled topology не грузит lazy chunks, bundle budget и
initial View ceiling зелёные.

Доказательство: benchmark, call-count unit, browser resource spy,
`npm run bundle:budget`.

### AC12. Документация и локализация полны

Четыре topology-словаря имеют одинаковые ключи, руководства RU/EN объясняют
семантику стрелки, approximation и случаи без стрелки; changelog RU/EN содержит
пользовательское изменение со ссылкой на #457.

Доказательство: i18n tests, `node scripts/check-docs.mjs`, review diff.

## 15. План автотестов

1. Расширить `test/zigbee-topology.test.mjs` pure suites для normalised
   relationship, BFS distances, parent tie-breaks, invariant/path traversal,
   input-order stability и zero/multiple coordinator fail-closed.
2. Добавить hover projection cases: local parent/child/peer, remote parent с
   title, unplaced device/coordinator, hidden/ambiguous parent, unplaced child,
   disconnected node и remote-count deduplication.
3. Вынести расчёт screen-space наконечника/обрезания линии в pure helper и
   проверить горизонталь, вертикаль, диагональ, короткую линию, разные marker
   размеры и границу bubble.
4. Расширить `demo/smoke_zigbee_topology_hover.mjs`: direction attributes,
   наконечники, parent bubble, две формы контейнера, три zoom, light/dark,
   forced-colors emulation, pointer transparency и существующий cleanup.
5. Расширить `demo/benchmark_zigbee_topology.mjs` route-build measurement в
   существующем `mapMs` либо отдельной метрикой внутри тех же суммарных потолков.
6. Добавить mutation witnesses для удаления BFS-level guard, инверсии стрелки и
   повторного включения parent в remote count.
7. Перед S7 выполнить `npm run typecheck`, `npm test`, `npm run build`,
   `npm run bundle:sync`, `npm run bundle:budget`,
   `node scripts/check-docs.mjs`, `node scripts/smoke-select.mjs --base
   origin/dev --head HEAD`, выбранные topology/device-action smokes,
   `npm run benchmark:zigbee-topology` и `node scripts/no-new-any.mjs --base
   origin/dev --head HEAD`.
8. Golden baselines не добавляются: topology отсутствует в текущей golden
   matrix и появляется только после реального hover. `npm run golden:verify`
   должен подтвердить отсутствие изменений существующих эталонов. Поскольку
   меняется `src/**`, docs screenshots и их fingerprint обновляются штатным
   capture workflow по общему процессу.

## 16. Затронутые файлы и модули

Ожидаемые продуктовые поверхности:

- `src/zigbee-topology.ts` — relationship normalization, route parent map,
  hover direction и parent-target classification;
- `src/hp-zigbee-topology-overlay.ts` — screen-space arrowheads, bubble и
  forced-colors;
- `src/zigbee-topology-overlay-bridge.ts`, `src/houseplan-card.ts` — проекция
  названий пространств без загрузки topology в initial graph;
- `src/i18n/topology/{en,ru,de,fr}.json` — три новых строки.

Доказательные и документальные поверхности:

- `test/zigbee-topology.test.mjs` и при необходимости отдельный pure geometry
  test;
- `demo/smoke_zigbee_topology_hover.mjs`;
- `demo/benchmark_zigbee_topology.mjs`;
- `scripts/mutation-gate.mjs` и smoke-selection registry при необходимости;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`;
- manifest-driven `dist/**` и integration frontend после `bundle:sync`;
- docs screenshot fingerprint/artifacts по обязательному `check-docs` flow.

Backend Python не меняется. Если реализация потребует новый House Plan API или
provider fetch, это расширение скоупа и возврат в `S3-spec`.

## 17. Риски и меры

| Риск | Мера |
|---|---|
| Provider relationship противоречит графу | Parent только на предыдущем BFS-уровне; relationship лишь tie-break |
| Стрелка сплющивается `preserveAspectRatio=none` | Вся arrow geometry считается в screen pixels |
| Наконечник скрывается marker/halo | Обрезать линию по фактическому target radius и проверять geometry smoke |
| Неразмещённый router искажает путь | BFS использует полный graph, mapping применяется только при проекции |
| Стрелки прыгают между hover | Stable node-key tie-break и permutation unit |
| Несколько provider instances смешиваются | Parent map scoped by topology instance |
| Parent считается дважды как remote | Явное исключение parent из `remote_count` и regression test |
| Текст раскрывает внутренний id | Только space title или локализованный fallback, DOM privacy test |
| Hover начинает делать дорогой BFS | Memo на snapshot/mapping, benchmark и call-count witness |
| Lazy-код протекает в initial View | Bundle graph/budget gate и disabled resource spy |

## 18. Откат

Пользовательский немедленный откат — выключить существующую опцию «Показывать
связи Zigbee при наведении на устройство»: lazy overlay исчезает целиком и не
выполняет route work.

Кодовый откат удаляет runtime-only parent projection, arrow/bubble rendering и
три i18n-ключа, возвращая обычные линии #54. Сохранённый config и provider data
не мигрируются, поэтому обратного преобразования данных нет.

## 19. Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: одна пользовательская запись со
  ссылкой на #457 без публикации внутренних ключей/алгоритма;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: стрелка означает следующий
  шаг производного пути к координатору, а не фактический маршрут пакета;
  описать parent bubble и честное отсутствие стрелки;
- golden: новых baselines нет; `golden:verify` подтверждает отсутствие
  регрессий существующей matrix;
- docs screenshots: обновить штатным reviewed capture после изменения `src/**`;
- performance: зелёные `benchmark:zigbee-topology` и `bundle:budget`;
- security/privacy: DOM/serialization audit без новых backend surfaces;
- generated bundles: синхронизировать только через `npm run bundle:sync`.

## 20. Принятые предположения

Ниже технические решения, не меняющие утверждённый владельцем пользовательский
контракт; ревьюер может уточнить их без нового продуктового вопроса.

1. Только сосед предыдущего BFS-уровня может стать parent; это формализует
   обязательный инвариант и безопаснее прямого доверия `relationship`.
2. Если instance содержит не ровно одного coordinator, стрелки fail-closed не
   показываются, а существующие линии сохраняются.
3. Parent в другом пространстве исключается из общего remote count, остальные
   remote-соседи остаются в нём.
4. Пустой title пространства не заменяется raw id, а получает локализованный
   fallback.
5. Новых golden baselines нет, потому что текущая матрица не активирует
   mouse-hover topology; screen-space геометрию защищает целевой browser smoke.
6. Размер и точная форма наконечника определяются общими визуальными токенами
   overlay при условии соблюдения AC9, без новой пользовательской настройки.
