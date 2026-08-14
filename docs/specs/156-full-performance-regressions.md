# Issue #156 — регрессии Full Performance перед v1.64.0 stable

- **Issue:** https://github.com/Matysh/houseplan-card/issues/156
- **Редакция:** первая редакция для независимого ревью; статус определяется только метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 8/10; ценность для разработки 10/10;
  сложность и риск 6/10
- **Область:** runtime physical geometry, Plan snap hover/render, release performance gate
- **Модель данных:** без новых полей, миграции и backend-изменений
- **Связано:** #137, #141, #153, #124, `docs/specs/137-plan-snap-overlay.md`,
  `docs/specs/141-wall-junctions.md`, `demo/performance/README.md`

## 1. Контекст и симптом

Exact-SHA stable-кандидат `321d153c22dfe2087e31437720919f872d9cd47c`
дважды воспроизводимо провалил обязательный Full Performance:

- run: https://github.com/Matysh/houseplan-card/actions/runs/31829284992;
- обычный и изометрический профили превысили бюджеты полного цикла из 12
  переключений этажей и суммарных Long Tasks;
- Plan snap профиль дополнительно потратил около 2,65 секунды на 120 pointermove
  до первого клика, включая один Long Task около 2,54 секунды;
- оба Glow-профиля прошли;
- `viewToggleMs` прошёл, поэтому #124 не является причиной этого падения.

Attempt 1 и повтор на свежем runner-е показали один класс превышений. Ослабление
budget запрещено; стабильный релиз #153 заблокирован до зелёного exact-SHA
Full Performance.

## 2. Пользовательский сценарий

**Персона:** администратор дома, который переключает этажи в View или точно
рисует контур/перегородку в desktop-редакторе Плана.

**До исправления:** релизная линия beta выполняет лишнюю polygon-union работу при
переключении пространства. В Плане движение мыши над snap topology до первой
точки инициирует полный render большой сцены; на крупном плане серия движений
может заблокировать main thread на секунды.

**После исправления:** переключение не строит неиспользуемую unioned geometry, а
до первой точки hover меняет только один SVG-маркер. Линии, точки, snap-result,
rubber-band, click и сохранённая геометрия визуально и семантически прежние.

## 3. Установленные причины

### 3.1 Лишняя unioned physical geometry

После #141 `physicalBodySet()` всегда вычисляет `geometry` через polygon union.
Полный card runtime и `physicalBodies()` используют только `drafts`,
`partitions`, `columns`, `patches` и `all`; `geometry` в production-пути не
читается. Одноэлементный cache полного card меняет ключ при каждом переходе на
другой этаж, поэтому ненужный union повторяется в каждом switch.

### 3.2 Полный render на initial snap hover

#137 сохраняет результат hover в `_planSnapHover`, а координату — в реактивный
`_cursorPt`. Даже когда `_path` пуст и rubber-band ещё отсутствует, каждый
pointermove назначает `_cursorPt` и запускает полный Lit render 60 комнат,
200 устройств и всей статической snap topology. В benchmark 120 обновлений идут
в одном interaction window и образуют наблюдаемый длинный блок.

## 4. Scope

В issue входят:

1. Разделение построения raw/join-patch physical bodies и необязательной
   unioned geometry так, чтобы production consumers без union не платили за неё.
2. Сохранение текущего pure API/семантики unioned geometry для unit-проверок и
   любого consumer, которому она действительно нужна.
3. Разделение Plan snap overlay на неизменную topology и единственный активный
   marker.
4. Обновление active marker до первого клика без полного render карточки.
5. Сохранение обычного реактивного rubber-band после появления anchor, без
   повторного создания статической topology при неизменном snapshot.
6. Regression unit/smoke и прохождение неизменённых Full Performance budgets.
7. Запись исправления в оба changelog и выпуск через дополнительную beta перед
   повторным stable promotion.

## 5. Non-scope

Не входят:

- изменение цветов, радиусов, толщины линий, layering или видимости overlay;
- изменение tolerance, endpoint-first приоритета, grid/45°/line quantization;
- изменение click/tap, T-join, autoclose, room/draft/partition или wall geometry;
- новый spatial index для resolver или общая декомпозиция большого render;
- изменение fixture, samples, budget, baseline selection или compare policy;
- исправление отдельного изометрического долга #124;
- schema, backend, storage, import/export, i18n, network или HA permissions;
- публичная функция, настройка или feature flag.

## 6. Контракт physical geometry

1. Pure-построитель physical parts возвращает тот же детерминированный набор
   `drafts`, `partitions`, `columns`, `patches` и `all`, что текущий
   `physicalBodySet()` до union.
2. `physicalBodySet()` либо эквивалентный явный union-consumer сохраняет текущее
   значение `geometry`, порядок-независимость, bounded mitre/bevel и fail-closed
   поведение malformed inputs.
3. Full card и static-card consumers, которым нужны только bodies, используют
   non-union путь. Они не вычисляют `geometry` скрыто через spread, getter или
   wrapper side effect.
4. Cache keys и invalidation остаются структурными: пространство, config epoch,
   `cell_cm` и grid/scale. HA state, hover и theme не добавляются в ключ.
5. Raw identity для editor hit/selection и joined patches для render/physics
   сохраняются. Результирующие SVG/clean-floor/light/iso pixels не меняются.

## 7. Контракт snap hover и DOM

### 7.1 Статическая topology

- Статические `plan-snap-line` и endpoint nodes строятся из существующего
  immutable geometry snapshot.
- При pointermove с тем же snapshot их DOM nodes и атрибуты не пересоздаются и
  не обходятся ради выбора active styling.
- Cache invalidation остаётся прежним: structural config, space, active draft
  и другие уже входящие в geometry key факторы перестраивают topology.

### 7.2 Один активный marker

- Overlay содержит не более одного active marker.
- Для endpoint marker расположен точно поверх статической точки, имеет прежний
  active endpoint style и радиус 10 см.
- Для line candidate marker имеет прежний dynamic style, wall-bound/grid-bound
  координату и радиус 10 см.
- При miss, pointerleave, смене инструмента/пространства/режима, pan/pinch cancel
  marker очищается.
- Marker остаётся `pointer-events:none`, `aria-hidden` через родительскую группу
  и не становится focusable.

### 7.3 Initial hover без полного render

Пока `_path` пуст:

1. pointermove использует тот же canonical `resolvePlanSnap()`;
2. `_cursorPt` остаётся пустым, потому что rubber-band ещё нечего рисовать;
3. меняется только dedicated active marker внутри уже существующего overlay;
4. полный Lit update карточки не запрашивается только ради hover;
5. click повторно вызывает resolver из координат события и не доверяет DOM или
   устаревшему hover state.

После первого click текущий reactive path/cursor render сохраняется: live
rubber-band должен двигаться вместе с marker. Следующий внешний Lit render обязан
согласовать dedicated marker с текущим state, поэтому оптимизация не создаёт
второго авторитетного snap-result.

## 8. Совместимость, touch и accessibility

- Persisted config и layout побайтно не меняются от hover/render/cache warm-up.
- Старые планы получают оптимизацию без migration и write-back.
- Desktop hover остаётся полным контрактом #137.
- Touch editor остаётся best effort: tap без hover повторно resolves candidate;
  pinch/pan/suppressed click не сохраняют сегмент. View и kiosk не получают
  новых interaction branches.
- Новых доступных элементов, текстов и keyboard semantics нет. Forced colours,
  dark/light theme и reduced motion сохраняют текущий вид.

## 9. Производительность и наблюдаемость

1. Budgets и runner не ослабляются и не меняют смысл.
2. `large-house-v1`, `large-house-isometric-v1` и
   `large-house-plan-snap-v1` проходят относительные и абсолютные thresholds на
   одном exact SHA; оба Glow-профиля остаются зелёными.
3. Plan snap diagnostics по-прежнему доказывают cache/DOM/config/ws stability,
   endpoint и line paths и единственный active candidate.
4. Технический regression test отдельно доказывает отсутствие полного Lit
   update для initial hover; один зелёный timing без structural assertion
   недостаточен.
5. Full Performance запускается после публикации исправленной beta и нового
   promotion SHA в `main`, как требует stable runbook.

## 10. Acceptance criteria

- **AC1 (`unit` + code review; разработчик/ревьюер):** pure physical-parts path
  возвращает те же raw bodies и junction patches, что текущая реализация, но не
  вызывает polygon union; explicit union path сохраняет прежнюю `geometry` и
  permutation/area assertions #141.
- **AC2 (`unit` + `smoke`; разработчик):** full/static runtime использует
  non-union parts без скрытого eager вычисления; View/Plan/static/hidden iso
  сохраняют прежний physical footprint, clean floor и wall-junction pixels.
- **AC3 (`smoke`; разработчик):** при пустом `_path` endpoint, line и miss
  pointermove обновляют ровно один active marker без вызова полного Lit update,
  не меняют static-node identity/count, geometry cache, config и websocket.
- **AC4 (`smoke` + `golden`; разработчик):** endpoint marker остаётся прежнего
  цвета/радиуса 10 см поверх статического endpoint, line marker — прежнего
  dynamic вида; lines/endpoints, layering, forced-colours и pointer transparency
  визуально не меняются.
- **AC5 (`unit` + `smoke`; разработчик):** click без предварительного hover,
  click после initial hover и следующие clicks используют canonical resolver;
  endpoint/line coordinates, Shift/grid priority, T-join, autoclose и
  no-split-target semantics #137/#138/#141 сохраняются.
- **AC6 (`smoke`; разработчик):** после первого anchor rubber-band и marker
  следуют pointer, а pointerleave, tool/space/mode change, pan/pinch и cancel
  очищают marker без ghost state или лишнего commit.
- **AC7 (`performance`; разработчик):** exact-SHA Full Performance проходит без
  правок пяти budget files, fixture semantics, sample count и compare logic;
  артефакт содержит зелёные ordinary, isometric, plan-snap, blend и overlay
  comparisons.
- **AC8 (`unit` + backend/schema review; разработчик/ревьюер):** schema,
  serialized config/layout, backend, import/export, i18n, HA calls, permissions
  и зависимости не меняются; hover и cache не создают writes.
- **AC9 (`typecheck` + `unit` + `build` + documentation review; разработчик):**
  implementation-loop gates зелёные; RU/EN changelog обновлены в том же
  `User-Visible: yes` commit; три bundle snapshots после release build идентичны.
- **AC10 (`release gate`; релиз-менеджер):** исправление опубликовано в новой
  `v1.64.0-beta.*`, beta issue закрыты штатно, затем новый promotion-only stable
  commit получает зелёные exact-SHA Validate и Full Performance до тега
  `v1.64.0`.

## 11. План тестирования

### 11.1 Unit

- выделить pure physical-parts builder и сравнить `drafts/partitions/columns`,
  patches и `all` с explicit union wrapper;
- сохранить #141 matrix: endpoint/line joins, unequal thickness, permutation,
  near-miss, malformed/zero-length и geometry area;
- добавить assertion, что production parts API не требует/не материализует
  `geometry`;
- существующие resolver tests #137/#138 остаются без изменения ожидаемых точек.

### 11.2 Targeted production-bundle smoke

Расширить `demo/smoke_plan_snap_overlay.mjs` либо добавить узкий smoke:

1. после initial render перехватить/посчитать card update requests;
2. выполнить endpoint → line → miss pointermove при пустом path;
3. доказать ноль full updates, один active marker, неизменные static nodes/cache
   и отсутствие writes;
4. выполнить click без hover и после hover, затем move с непустым path;
5. проверить rubber-band, exact coordinates и очистку marker;
6. сохранить существующие gesture, gaps, draft exclusion и T-join проверки.

Существующие smoke/golden #137/#141 являются визуальным и поведенческим
контрактом. Новые golden не требуются, потому что pixels должны остаться
прежними; любой непредусмотренный diff исследуется и не принимается автоматически.

### 11.3 Performance и release

- implementation loop: `npm run typecheck`, `npm test`, `npm run build`;
- перед beta: полный smoke/golden/HA/performance gate по runbook;
- после promotion в main: exact-SHA Validate и Full Performance;
- сравнить все пять comparison reports, а не останавливаться на первом зелёном
  профиле;
- не переиспользовать красный artifact как доказательство и не ослаблять budget.

Backend не меняется; targeted backend test не нужен, полный Linux harness остаётся
release gate.

## 12. План реализации

1. Выделить из `physicalBodySet()` построитель physical parts без union; явный
   set/geometry consumer строит union только по запросу.
2. Перевести full/static body consumers на parts path и убрать `geometry` из
   runtime cache shape, если оно не читается.
3. Разделить static snap topology и dedicated active marker; исключить обход
   всех endpoints ради active styling.
4. Добавить синхронизацию marker с canonical hover state и fast path при пустом
   `_path`; сохранить reactive path после anchor.
5. Дополнить unit/smoke, прогнать implementation gates.
6. Обновить changelog и release metadata, пересобрать bundle snapshots в
   prerelease commit, выпустить beta и повторить stable promotion/gates.

Точные имена helpers и способ локального DOM-handle (`ref`, controller или
эквивалент) не являются продуктовым контрактом.

## 13. Release-артефакты

Исправление пользовательски заметно как восстановление отзывчивости, поэтому
implementation commit имеет `User-Visible: yes` и обновляет:

- `docs/CHANGELOG.md`;
- `docs/CHANGELOG.ru.md`.

`docs/USER-GUIDE.ru.md`, `docs/CANVAS.md`, `docs/WALL-THICKNESS.md` и i18n не
меняются: описанный пользовательский контракт остаётся прежним. Новые golden
не ожидаются. Обязательны targeted smoke, полный beta gate, exact-SHA artifacts
и повторный stable Full Performance. Security report не требуется.

## 14. Риски и снижение

| Риск | Вероятность / ущерб | Снижение |
|---|---|---|
| Dedicated marker расходится с Lit state после внешнего render | средняя / высокий | один canonical hover state; render всегда повторно синхронизирует marker; transition smoke |
| Fast path оставляет ghost marker при навигации/gesture | средняя / средний | единый clear helper и matrix pointerleave/tool/space/mode/pinch |
| Endpoint меняет yellow style на dynamic green | средняя / средний | отдельный kind/class contract и golden/smoke radius/style assertions |
| Удаление eager union меняет physical footprint | низкая / высокий | parts equality, existing #141 unit/smoke/golden, explicit union wrapper unchanged |
| Локальный runner зелёный, Linux всё ещё красный | средняя / высокий | только exact-SHA Full Performance является release evidence |
| Оптимизация маскируется ослаблением gate | низкая / высокий | budget/fixture/compare files вне implementation diff |

## 15. Откат

Откат — revert user-visible implementation commit #156 вместе с тестами,
changelog и соответствующими prerelease bundle snapshots. Persisted data и
schema не меняются, migration/data rollback не нужны. После отката возвращается
performance-регрессия, поэтому стабильный релиз остаётся заблокированным.

## 16. Принятые технические предположения

1. Внешний snap/junction контракт полностью наследуется из #137/#138/#141;
   новых продуктовых решений нет.
2. Рекомендуемый physical-parts helper может называться иначе, если eager union
   доказуемо отсутствует у production consumers.
3. Active marker может обновляться через локальный DOM handle внутри overlay;
   SVG DOM не становится источником snap geometry или commit coordinates.
4. Static topology может быть защищена Lit `guard`, вынесена в child component
   или сохранена эквивалентным способом; node identity/count обязаны быть стабильны.
5. Fast path применяется только когда live rubber-band отсутствует. После anchor
   допустим полный reactive update, если Full Performance и структурные AC зелёные.
6. Любая дополнительная оптимизация вне двух установленных горячих путей требует
   отдельного обоснования в issue и не должна расширять пользовательский scope.
7. Открытых продуктовых вопросов нет.
