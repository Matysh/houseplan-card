# Issue #288 — ограниченный коридор многостенного узла

- **Issue:** https://github.com/Matysh/houseplan-card/issues/288
- **Статус:** первая редакция для внешнего ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 9/10; ценность для разработки 8/10;
  сложность 7/10; риск 8/10
- **Область:** canonical wall bodies, degree-3+ junction cuts, Plan/View/Static/Iso,
  real-plan smoke, semantic golden и structural consumers
- **Модель данных:** schema, config, layout и Optimize не меняются
- **Связано:** #249, #261, #271, #272, #275, #278, #279, #284–#286,
  `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`

## 1. Сценарий и подтверждённая причина

В beta.9 на реальном втором этаже две общие стены визуально обрываются перед
перпендикулярной 30-сантиметровой стеной. В разрыве видны room fills, хотя в
модели там нет ни opening, ни virtual span, ни нулевой толщины.

Репозиторный smoke `node demo/smoke_real_plan_masonry.mjs` измеряет четыре
копии разрыва — по одной с каждой стороны двух общих стен — общей длиной
`181.00` шага. Каждый разрыв равен `45.25` шага.

Узел `(577, 299)` в шагах решётки содержит finite rays `349 / 120 / 5` с
толщинами `30 / 30 / 30` см; соседняя общая стена имеет 20 см. Локальная
машинерия использует радиус `MITRE_LIMIT × H = 4 × 15 = 60` шагов, и внешний
connector/cut получает мандат далеко за пределами пятишагового support. Из
соседней 20-сантиметровой полосы исчезает `60 − 15 = 45` шагов — ровно
измеренный дефект. Данные чистые и lattice-exact; исправляется только
вычисляемая geometry.

## 2. Пользовательский результат

Непрерывные стены доходят до физического узла без 45-шагового провала во всех
режимах. Короткий пятишаговый луч остаётся коротким, внешний bounded bevel
#249 не возвращает бесконечный mitre, а opening/virtual gaps остаются пустыми.

Новых настроек, миграции и видимого действия нет: существующий план начинает
рисоваться правильно сразу после обновления.

## 3. Геометрический контракт

### 3.1 Finite ownership

Каждый локальный ray material и каждый защищающий/вырезающий corridor обязан
быть ограничен реальными `MultiWallNodeRay.supports`. Длина support —
физическая граница полномочий узла, а не подсказка после построения mask.

Connector, созданный для связи bevel-cut с внешним фоном, не может пересечь
чужую finite wall strip дальше собственной полутолщины этой полосы от узла.
Иными словами, у соседней стены без opening нельзя удалить продольный участок
длиннее её `halfDepth`, если отдельное продуктовое решение явно не разрешило
больший cap.

### 3.2 Короткий луч

Луч длиной `L < MITRE_LIMIT × H`:

- не достраивается до глобального radius;
- не создаёт corridor, длина которого выводится только из максимального `H`;
- сохраняет свою полную finite strip и не удаляет материал другого ray;
- при перекрывающихся mask соседних nodes остаётся ограничен меньшим из
  физического support и локального безопасного extent.

Конкретная boolean-формула остаётся техническим решением, но результат обязан
выполнять семантические инварианты, а не только совпасть с raster crop.

### 3.3 Единый источник

Исправление применяется в canonical `wallBodiesGeometry` до downstream
consumers. Нельзя дорисовать SVG-патч поверх разрыва: `roomGeom`, final
`geom`, `paperGeom`, clean floor, room fills/hover, Static/hidden Iso и
light/sun barriers должны видеть одну и ту же сплошную physical geometry.

Failure isolation #278 сохраняется: ошибка необязательного локального узла не
гасит кладку пространства; обязательный structural preflight остаётся
fail-dark.

## 4. Scope

### Входит

- finite-aware corridor/cut в degree-3+ node;
- конфигурация `349 / 120 / 5` и смешанные `30/30/20` см;
- оба реальных privacy-minimized плана #285/#286;
- semantic vector/browser probes, mutation и targeted golden;
- canonical wall/architecture/testing docs и оба changelog.

### Не входит

- переписывание persisted rooms/walls либо запуск Optimize;
- исправление partial resize #289 или near-axis geometry #290;
- изменение `MITRE_LIMIT`, `MULTI_WALL_JOIN_LIMIT` или стиля фаски глобально;
- новая модель стен из ADR #282;
- generic визуальная маска, расширение pixel-diff tolerance или переприёмка
  baseline без semantic evidence.

## 5. Acceptance criteria

### AC1. Реальный второй этаж не содержит разрывов

`node demo/smoke_real_plan_masonry.mjs` выдаёт для second-floor
`gapCount: 0` и `totalGapSteps: 0`. Ожидания `PLANS` меняются на нули в том же
implementation-коммите. Проверяются все четыре прежние строки, а не одна
выбранная точка.

### AC2. Первый этаж не платит за исправление

Тот же smoke сохраняет `gapCount: 0` и `totalGapSteps: 0` для first-floor.
Оба плана проходят `npm run invariants` и production geometry preflight.

### AC3. Unit фиксирует полномочия corridor

Table-driven unit строит узел с rays `349 / 120 / 5` шагов и physical
half-depths, соответствующими 30/30/20 см. На каждом порядке rays, reversed
endpoints и `cell_cm: 1/5/30` longitudinal material loss соседней тонкой стены
не превышает её собственного half-depth; короткий support не удлиняется.

### AC4. Старые junction-контракты не регрессируют

- discarded wedge #249 остаётся внешним и пустым;
- retained wedge #261 заполнен;
- finite rays #271 не становятся длиннее;
- enclosed holes #272 остаются нулевыми;
- protected strips #275 не теряют area;
- optional union failure #278 остаётся локальным;
- near-orthogonal #279 остаётся защищённым.

### AC5. Все consumers согласованы

Production-bundle smoke проверяет прежние четыре gap intervals настоящим SVG
fill API в Plan и View; structural fingerprints для Static/hidden Iso и
light/sun barriers не содержат прохода. Light/dark themes дают одинаковый
semantic result.

### AC6. Golden не принимает дефект по общему порогу

Targeted real-plan golden выполняет semantic `gapCount === 0` до pixel diff.
Если визуальный fingerprint меняется, baseline принимается только из Linux CI
artifact со ссылкой на прогон и объяснением изменившихся junction areas.
Старые baselines без semantic нуля неприемлемы.

### AC7. Мутант доказывает чувствительность

Mutation возвращает corridor, зависящий только от
`MITRE_LIMIT × node.halfDepth`, либо игнорирует finite support. AC1 или AC3
обязаны падать при сохранении зелёного unrelated first-floor контроля.

### AC8. Локальные гейты

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- `node scripts/check-docs.mjs`;
- targeted real-plan masonry smoke и mutation.

Полные golden, smoke, performance и Linux HA harness выполняются перед beta.

## 6. Совместимость, touch, security и performance

Schema/model version и read/write compatibility не меняются. View на touch и
kiosk получает тот же canonical result; editor touch contract не меняется.
Новых HA service calls, URL/HTML и permission boundaries нет.

Алгоритм остаётся локальным по rays/supports одного node. Запрещён новый
глобальный pairwise pass по стенам. `npm run performance` перед beta обязан
сохранить действующие masonry/render budgets; exact fixture дополнительно
проверяет детерминизм при permutation без роста числа local patches.

## 7. Риски и меры

- Изменение общего `bevelMultiWallBody` может вернуть дефект любого из прежних
  junction-контрактов #249/#261/#271/#272/#275/#278/#279. Мера: полная
  table-driven матрица AC4, оба реальных плана и semantic golden без повышения
  tolerance.
- Слишком широкий corridor недосечёт соседнюю стену и оставит наложение;
  слишком узкий снова вырежет её глубже собственного half-depth. Мера: численные
  верхние границы AC3, structural consumers AC5 и чувствительный мутант AC7.
- Локально правильный polygon может разойтись между Plan/View/Static/Iso. Мера:
  один canonical source AC5 и запрет consumer-specific post-fix.

## 8. Откат

Чистый revert implementation-коммита возвращает прежнюю renderer geometry;
feature flag и миграция не требуются, потому что persisted model не меняется.

## 9. Ожидаемые файлы

Product code:

- `src/wall-thickness.ts`.

Tests/evidence:

- `test/wall-thickness.test.mjs`;
- `demo/smoke_real_plan_masonry.mjs`;
- при необходимости targeted golden harness/matrix и mutation registry;
- privacy-minimized fixtures остаются без имён/полного пользовательского
  экспорта.

Документация:

- `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 10. Release и порядок интеграции

Implementation-коммит имеет `Issue: #288`, `User-Visible: yes` и оба
changelog. Если меняются canonical docs screenshots, они снимаются только
штатным Linux workflow после `npm run bundle:sync` и принимаются reviewed
командой.

Инфраструктурная ветка #260 должна попасть в `dev` до финальной пересъёмки
docs screenshots, как требует issue. Она не входит в product scope #288 и не
обходится ручным слиянием автора продуктовой задачи.

## 11. Принятые технические предположения

1. Ограничение «не больше half-depth соседней стены» — верхняя граница ущерба,
   а не требование обязательно вырезать этот half-depth.
2. Правильный способ может полностью убрать connector там, где основной cut
   уже связан с внешним фоном; контракт задаёт результат, не конкретный polygon.
3. Полный экспорт владельца не коммитится; уже добавленная минимизированная
   fixture является каноническим exact repro.
4. Touch editor: best effort; View/kiosk rendering fully supported.
