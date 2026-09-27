# Issue #271 — конечная длина лучей multi-wall узла

- Дата: 2026-08-23
- Тип: bug · приоритет P1
- Оценка: пользовательская ценность 10/10 · ценность для разработки 9/10 ·
  сложность 7/10 · риск 9/10
- Issue: [#271](https://github.com/Matysh/houseplan-card/issues/271)
- Ветка: `issue/271-finite-multiwall-rays`
- Статус ТЗ: готово к ревью

Канонические документы: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`,
`docs/WALL-THICKNESS.md`, `docs/CONFIG-COMPATIBILITY.md`,
`docs/USER-GUIDE.ru.md` и `docs/TESTING.md`.

Связанные, но не дублирующие задачи:
[#249](https://github.com/Matysh/houseplan-card/issues/249),
[#261](https://github.com/Matysh/houseplan-card/issues/261),
[#270](https://github.com/Matysh/houseplan-card/issues/270) и
[#273](https://github.com/Matysh/houseplan-card/issues/273).

## 1. Сценарий и персона

Администратор нажимает Optimize для реального плана и затем открывает Plan или
View. У короткой ступени контура появляется длинный штрихованный торец без
соответствующей осевой линии и конечного узла. В другом месте ложная кладка
становится окклюдером и даёт тёмное пятно возле корректно вырезанной двери.

Семья видит архитектуру, которой нет в сохранённом плане. Это нарушает J1:
план обязан правдиво показывать дом. Одновременно нарушен J6: одна каноническая
геометрия должна обслуживать masonry, paper, floor, Iso и световые барьеры.

## 2. Подтверждённое воспроизведение

Два приватных plan-only экспорта владельца из `v1.67.0-beta.5` после Optimize
прогнаны через production-цепочку `spaceModels()` →
`prepareSpacePhysicalGeometryInputs()` → `wallIntervals()` →
`buildMultiWallNodeMap()` → `wallBodiesGeometry()`.

| Экспорт / node, render units | Реальная длина ray | Текущий rebuild |
|---|---:|---:|
| 1 / `(420.833, 437.500)` | `12.500` | `110.000` |
| 1 / `(887.500, 345.833)` | `1.381904` | `96.667` |
| 2 / `(2404.167, 1245.833)` | `20.833` | `500.000` |
| 2 / `(2404.167, 2308.333)` | `20.833` | `500.000` |
| 2 / `(-354.167, 2087.500)` | `200.000` | `666.667` |
| 2 / `(-354.167, 2287.500)` | `200.000` | `333.333` |

Во втором экспорте все 14 opening slots проверены по центру и по 41 точке вдоль
оси. Final masonry в них отсутствует. Поэтому пятно в `2-1.png` не требует
отдельного opening-cut бага: его источник — лишняя geometry/occlusion около
проёма.

Первый экспорт также содержит две явные `wall_columns`. Они являются
сохранёнными пользовательскими телами и не удаляются этой задачей. Regression
фиксирует только площадь, которую multi-wall reconstruction добавляет дальше
конца room-wall interval.

Приватные экспорты не входят в репозиторий. Для тестов из них выделяются
минимальные обезличенные room/wall/opening fixtures с теми же длинами и
отношениями толщин.

## 3. Подтверждённая причина

`buildMultiWallNodeMap()` получает конечные `WallInterval.a/b`, но после
дедупликации сохраняет в `MultiWallNodeRay` только:

```ts
{ u, halfDepth }
```

Фактическая длина `hypot(b - a)` теряется. `bevelMultiWallBody()` затем
реконструирует каждый ray прямоугольником с общей длиной:

```ts
radius = MITRE_LIMIT * node.halfDepth;
extent = radius * 2;
```

При `MITRE_LIMIT = 4` это `8 × H`, где `H` — максимальная half-depth всего
узла, а не длина конкретного ray. Mask ограничивает rebuild только квадратом
вокруг node, но не реальным endpoint. Поэтому короткий ray становится длиннее,
хотя `wallIntervals`, осевой overlay и сохранённый room polygon остаются
короткими. Final masonry затем закономерно используется как общий occluder.

## 4. Что человек увидит до и после

**До:** короткая ступень или micro-segment может выглядеть как длинная стена;
у неё нет оси и конечного snap-node, а её тень может лечь в дверной проём.

**После:** masonry, hatch, outline, paper и тени заканчиваются там же, где
заканчивается реальный входящий wall interval. Сам T/X-стык остаётся замкнутым,
а bounded bevel #249 не возвращает длинный mitre-spike.

Исправление работает при чтении плана; Save и повторный Optimize не требуются.
Новых настроек и сообщений нет.

## 5. Scope

### Входит

- сохранение конечной длины каждого canonical ray в multi-wall node map;
- детерминированная дедупликация сонаправленных физических intervals;
- ограничение local body/paper reconstruction фактическими конечными rays;
- согласование room masonry, final masonry, paper, clean floor, Static/Iso и
  light/sun barriers;
- короткие rays рядом с opening, но без изменения opening association/cut;
- pure unit, minimized real-topology fixture, mutation, targeted smoke и
  semantic golden evidence;
- документация и оба changelog.

### Не входит

- удаление или изменение явных `wall_columns`, partitions и room drafts;
- optimizer-cleanup micro-thickness island #273;
- изменение `MITRE_LIMIT = 4`, `MULTI_WALL_JOIN_LIMIT = 1.25` или формы
  чрезмерного bevel #249;
- общий фикс белых запертых полостей #272;
- изменение room coordinates, snapping, wall keys, opening symbols/placement;
- schema/model-version/backend/i18n/UI изменения.

## 6. Канонический контракт finite ray

### 6.1 Длина

Каждый положительный конечный `WallInterval` создаёт directed endpoint ray с
`u`, `halfDepth` и `length > epsilon`. `length` измеряется в тех же render units,
что `point`, до любого local rebuild. Node map остаётся immutable projection и
не мутирует intervals.

Локальная полоса ray существует только на параметре `t ∈ [0, length]` плюс
scale-relative boolean epsilon на границе. Ни mask, ни join radius не дают
права продолжить её за `length`.

### 6.2 Co-directional duplicates

Shared interval может прийти от двух room owners. Полные физические дубликаты
одной оси/endpoint схлопываются как сейчас. Если в одном направлении есть
несколько коллинеарных intervals:

- `halfDepth` берётся как максимальная эффективная положительная толщина;
- finite support является union реально существующих `[0, length]`, а не
  автоматически бесконечным ray;
- для непрерывных co-directional supports от одного endpoint достаточно
  максимального `length`;
- зазор нельзя перекрыть только потому, что более короткий/толстый duplicate
  присутствует рядом;
- сортировка, room order, interval direction и duplicate count не меняют
  результат.

Точная структура (`length` либо bounded spans) остаётся техническим решением,
если этот физический контракт доказан тестами.

### 6.3 Local reconstruction

`bevelMultiWallBody()` может перестраивать только intersection finite ray
strips с действующей node mask и bounded paper/exterior envelope. Pairwise
join material у математического node сохраняется, но никакой rectangle не
пересекает плоскость конечного торца ray наружу.

Если другой независимый ray/body законно занимает точку за этим торцом, final
union остаётся заполненным им. Тест finite ray сравнивает provenance/local
piece либо fixture без другого владельца, а не требует пустоты там, где есть
реальная пересекающаяся стена.

### 6.4 Paper, floor и physics

`roomGeom` и `paperGeom` не получают фасад/торец за finite endpoint. Clean floor
не теряет площадь из-за выдуманной masonry. Final `geom`, hidden Iso и
light/sun occluders используют тот же bounded result. Запрещён render-only или
shadow-only workaround.

### 6.5 Failure isolation

Невалидная/nonfinite length исключает только кандидат ray/node и не гасит
остальной план. Обязательные structural boolean failures продолжают fail-dark
по действующему контракту #197/#199.

## 7. Compatibility, UX, security и performance

- Persisted config/layout/model version не меняются; вход не мутируется.
- Legacy key-only walls и canonical endpoint walls используют одну длину из
  resolved `WallInterval`.
- Optimize не нужен для runtime-исправления и не удаляет independent bodies.
- Новых controls, keyboard/touch/focus/ARIA и locale keys нет.
- Новых HA calls, permissions, URL/HTML и security surfaces нет.
- Node map строится в существующем structural pass. State/theme/hover ticks не
  пересчитывают topology. Запрещён новый глобальный `O(E²)` проход; bounded
  supports вычисляются во время уже существующей endpoint aggregation.

## 8. Acceptance criteria и доказательства

### AC1. Node map не теряет конечную длину

Table-driven unit строит nodes с rays длиной `20.833`, `200` и длиннее `8H`.
Публичный результат хранит finite support; duplicate owners, reversed
intervals и permutations дают deep-equal map. Input arrays неизменны.

**Доказательство:** `test/wall-thickness.test.mjs`.

### AC2. Короткий ray не достраивается

Minimized node `(2404.167, 1245.833)` с vertical ray `20.833` и `H = 62.5`
не содержит local/final masonry в устойчивом probe за endpoint, хотя старый
`extent = 500` его заполняет. Внутри `[0, 20.833]` полоса и node core остаются.
То же проверяется для `12.5 → не 110` при `cell_cm: 5`.

**Доказательство:** geometry unit с point/area coverage, не SVG string.

### AC3. Реальные длинные rays и join #249 не обрезаны

Ray длиннее local mask сохраняет material до границы mask; T/X node связан со
всеми incident rays. Existing excessive-wedge probe #249 остаётся пустым,
join-radius не увеличивается, zero/open ray не материализуется.

**Доказательство:** существующие #249/#261 units плюс finite-length matrix.

### AC4. Проём остаётся настоящим проёмом без ложной тени

Fixture с коротким perpendicular ray рядом с door подтверждает:

- весь opening slot пуст в final masonry;
- finite ray не входит в slot/local probe, если его endpoint до slot;
- light/sun occluder не содержит добавленной за endpoint площади;
- opening tunnel/symbol contract не меняется.

**Доказательство:** geometry unit и targeted browser smoke с реальным SVG/
shadow probe.

### AC5. Все поверхности используют finite result

Plan, View, kiosk, Static и hidden Iso не показывают stump за endpoint;
room paper/fill/hover и clean floor не вырезают там ложную стену; Glow/sun
barriers не создают пятно. Theme/HA state update сохраняют structural
fingerprint и cache reuse.

**Доказательство:** targeted production-bundle smoke.

### AC6. Семантический visual gate

Golden scene содержит короткую осевую ступень и local crop. До pixel diff
harness проверяет, что два probes за finite endpoint пусты в wall/paper и что
probe внутри ray заполнен. Общая доля изменённых пикселей не является
единственным gate. Linux artifact просматривается до baseline acceptance.

### AC7. Мутант ловит исходную регрессию

Mutation entry отбрасывает finite support или возвращает rectangle длиной
`8H`. AC2 либо AC4 обязаны краснеть. Мутант выполняется, а не только
регистрируется.

### AC8. Приватность, данные и детерминизм

Полные `1.json`/`2.json` и пользовательские названия не коммитятся. Fixture
содержит только минимальную анонимную topology. Render не меняет config;
повторный расчёт и повторный Optimize детерминированы.

### AC9. Локальные гейты реализации

- `npm run typecheck`;
- `npm test`;
- `npm run build` и byte-identical shipped bundles;
- `node scripts/check-docs.mjs`;
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` и все выбранные
  targeted smokes;
- целевой mutation;
- целевые semantic golden scenes.

Полные golden/smoke/performance и Linux HA harness остаются prerelease gates.

## 9. Ожидаемые файлы

Product code:

- `src/wall-thickness.ts`.

Доказательства:

- `test/wall-thickness.test.mjs` и обезличенная fixture при необходимости;
- targeted smoke для finite multi-wall ray/occluder;
- `demo/golden/matrix.mjs`, `demo/golden/harness.mjs` и matrix tests;
- `scripts/mutation-gate.mjs`, smoke/mutation registries.

Документация:

- `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`;
- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`.

## 10. Release-артефакты

Implementation-коммит класса A имеет trailers `Issue: #271` и
`User-Visible: yes`; оба changelog входят в тот же коммит. Изменившиеся
golden/docs screenshots принимаются только из полного Linux CI artifact после
визуального review штатными `*:accept -- --reviewed` командами. Перед beta
обязательны полный golden, smoke, performance и exact-SHA Validate.

## 11. Риски и меры

| Риск | Мера |
|---|---|
| Короткая толщина одного duplicate обрежет длинную реальную стену | §6.2 и duplicate/permutation matrix. |
| Вернётся mitre-spike #249 | Existing radius/excessive-wedge negative tests. |
| Починится Plan, но останется тень | AC4/AC5 проверяют общий occluder. |
| Внешний probe законно занят другой стеной | Minimized provenance-aware fixture и отдельные local/final assertions. |
| Boolean epsilon создаст щель у endpoint | Probes с запасом и area-connected node assertions. |

## 12. Rollback

Откатывается finite-ray projection/reconstruction вместе с semantic tests,
smoke/golden и документацией. Данных и миграций нет. Partial rollback только
тестов запрещён: он снова сделает регрессию невидимой.

## 13. Принятые технические предположения

1. Внутреннее представление finite support (`length`, interval либо clipped
   polygon) выбирает автор реализации; продуктовый контракт задан §6.
2. Тёмное пятно `2-1.png` не получает отдельную задачу: opening slot доказанно
   пуст, а лишняя geometry уже является общим light barrier.
3. Явные `wall_columns` первого экспорта остаются данными плана. Их автоматическое
   удаление было бы отдельным продуктовым решением и не маскирует этот bug.
4. Minimized fixtures достаточно для репозитория; приватные экспорты остаются
   локальным cross-check перед handoff.
5. Новых продуктовых вопросов нет: конечное физическое тело обязано соблюдать
   конечный источник.
