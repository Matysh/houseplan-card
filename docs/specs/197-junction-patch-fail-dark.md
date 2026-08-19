# Issue #197 — один junction-патч не гасит кладку всего плана

- **Issue:** https://github.com/Matysh/houseplan-card/issues/197
- **Редакция:** r2 после `docs/reviews/SPEC-REVIEW-197-r1.md`; статус
  определяется только метками issue
- **Тип / приоритет:** bug / P2
- **Оценка:** пользовательская ценность 9/10; ценность для разработки 9/10;
  сложность 6/10; риск 8/10
- **Область:** каноническая геометрия стен, Plan, View/киоск, static card,
  hidden Iso, clean floor/paper, Glow и солнце
- **Модель данных:** без изменений и миграции
- **Связано:** #141, #150, #198, #199, #201, `docs/WALL-THICKNESS.md`,
  `docs/ARCHITECTURE.md`, `docs/TOUCH-SUPPORT.md`

## 0. Ответ на ревью r1

High-1 принят в части воспроизводимости: первая редакция не проговорила
критически важный контракт координат `WallEntry.a/b`, поэтому независимый
повтор оказался не тем production-вызовом, который выполнял автор.

В коде ревью комнаты, cuts **и `walls[].a/b`** были заранее умножены на 1000.
Это двойное масштабирование wall endpoints: `WallEntry.a/b` являются
persisted config coordinates, а `entrySpan(w, coordScale)` в
`src/wall-thickness.ts:124–129` сам умножает их на `coordScale`. Production
renderer масштабирует room polygons и open cuts, но передаёт `space.walls`
неизменными. При корректном вызове исходный fixture по-прежнему даёт один patch
и `wallBodiesGeometry() === null` на `19e92e0`.

R2 закрывает High не возражением на словах, а:

1. фиксирует координатный контракт явно;
2. добавляет ниже полный исполняемый reproducer, который сам извлекает fixture
   из issue и не допускает ручного преобразования walls;
3. уточняет AC1/AC2 так, чтобы unit сначала доказывал правильную подготовку
   fixture и наличие patch, а затем красный `null` исходного кода;
4. отделяет #201: прямой exact-key helper `thicknessCmAt()` действительно даёт
   `0` на новом atomic child, но canonical `wallIntervals()`/`intervalCmAt()` на
   production input дают `20 см`; поэтому #201 не подавляет patch и остаётся
   отдельной задачей для собственной аналитики вызовов.

## 1. Сценарий и персона

**Персона:** домашний администратор, который уже построил подробный план и
периодически обслуживает его через «Общие настройки → Оптимизировать планы».

**Поверхность и момент:** после оптимизации или обычного открытия ранее
сохранённого много-комнатного плана человек переходит в View либо Plan. В одном
виртуальном T-стыке сходятся реальные стены соседних комнат с ненулевой
толщиной.

Задача поддерживает J1, J4 и J6 из `docs/SCOPE.md`: план должен правдиво
показывать пространственную структуру, штатно обслуживаться через GUI и не
терять физическую геометрию от одного локального численного отказа. View,
киоск и static card — блокирующие поверхности; Plan editor остаётся
desktop-first, но не может создавать или показывать иную физику.

## 2. Что человек увидит до и после

**До:** из-за одного стыка во всём пространстве исчезает штрихованная кладка;
между отступившими заливками комнат остаются белые полосы полной или половинной
толщины, как будто все стены одновременно стали прозрачными.

**После:** весь план продолжает показывать стены. Проблемный T-стык строится
обычно; даже если его дополнительный соединительный фрагмент численно
необрабатываем, отказ ограничивается этим фрагментом и не удаляет остальную
кладку, бумагу и физические препятствия.

## 3. Подтверждённая проблема и причина

Дефект воспроизведён на `origin/dev` `19e92e0` с анонимизированным fixture из
issue и production-параметрами:

- 8 комнат, 25 wall-записей, 3 `open_spans`;
- только `rooms[].poly` и `open_spans` переведены в render coordinates через
  `NORM_W = 1000`; `walls[].a/b` оставлены в persisted config coordinates;
- `pitch = GRID_STEP_N`, `cell_cm = 5`, `gridPitch = GRID_PITCH`,
  `coordScale = 1000`;
- `wallIntervals()` успешно разрешает значения `15/20/22/28/29/33 см`;
- `wallBodiesGeometry(...)` возвращает `null`.

`walls[].a/b` нельзя предварительно умножать на `NORM_W`: `entrySpan()` делает
это внутри по переданному `coordScale`. Следующий reproducer является
каноническим для проверки r2 после обычной сборки `test-build`:

```js
import { execFileSync } from 'node:child_process';
import { wallBodiesGeometry, wallIntervals } from './test-build/wall-thickness.js';
import { resolveOpenCuts } from './test-build/open-spans.js';
import { GRID_PITCH, GRID_STEP_N, NORM_W } from './test-build/space-geometry.js';

const issue = JSON.parse(execFileSync('gh', [
  'issue', 'view', '197', '--repo', 'Matysh/houseplan-card', '--json', 'body',
], { encoding: 'utf8' }));
const raw = issue.body.match(/```json\s*([\s\S]*?)```/)[1];
const fixture = JSON.parse(raw);
const rooms = fixture.rooms.map((room) => ({
  ...room,
  poly: room.poly.map(([x, y]) => [x * NORM_W, y * NORM_W]),
}));
const walls = structuredClone(fixture.walls); // config coords: НЕ умножать
const openCuts = resolveOpenCuts(
  rooms, fixture.open_spans, NORM_W, GRID_PITCH * 0.02,
);
const intervals = wallIntervals(
  rooms, walls, openCuts, GRID_STEP_N, fixture.cell_cm, GRID_PITCH, NORM_W,
);
const geometry = wallBodiesGeometry(
  rooms, walls, openCuts, [], GRID_STEP_N, fixture.cell_cm, GRID_PITCH,
  NORM_W, [],
);
console.log({
  counts: [rooms.length, walls.length, openCuts.length], // [8, 25, 3]
  nodeCm: intervals
    .filter((iv) => Math.abs(iv.a[1] - 550) < 1e-6
      && Math.abs(iv.b[1] - 550) < 1e-6)
    .map((iv) => iv.cm), // содержит 20
  failed: geometry === null, // true на 19e92e0
});
```

Для прямого контроля patch-list автор исполнил ту же compiled module с временно
экспортированной без изменения тела `virtualJunctionPatches()`; результат — один
patch:

```json
[[[620.8333333333334,550],[612.5,550],
  [612.5000000000001,541.6666666666665],
  [620.8333333333334,541.6666666666666]]]
```

В реализации test seam должен сделать этот pre-union результат проверяемым без
source rewriting; точная публичность helper не является продуктовым контрактом.

Причинная цепочка:

1. `virtualJunctionPatches()` создаёт один прямоугольный patch около
   `[620.8333…, 550]`.
2. Две математически совпадающие координаты приходят разными IEEE-754 числами:
   `612.5` и `612.5000000000001`; аналогичный шум есть по Y.
3. `polyclip-ts` не может завершить output ring при `union(body, patch)` и
   выбрасывает исключение.
4. Room rings и atomic wall-edge bodies имеют per-piece `try/catch`, а цикл
   junction patches в `src/wall-thickness.ts:1760–1761` — нет.
5. Исключение достигает общего `catch`, `wallBodiesGeometry()` возвращает
   `null`, и все потребители закономерно включают общий fail-dark.

Дополнительные исполняемые проверки отделяют причину от корреляций:

- удаление 15-см микро-интервала оставляет результат `null`;
- удаление open cuts, которое отключает virtual-junction pass, даёт валидную
  geometry;
- округление только координат patch с технической точностью от `10⁻⁹` до
  `10⁻¹²` render unit даёт валидную geometry; итоговая площадь после canonical
  clipping совпадает с вариантом, где единственный отказавший patch локально
  пропущен.

Проверка замечания r1 о толщине также выполнена на корректном production input:
`wallIntervals()` и `intervalCmAt()` возвращают `20 см` на обоих atomic children
горизонтальной стены узла. `thicknessCmAt()` — более узкий direct-key helper —
не наследует parent entry для child key и возвращает `0`, однако
`virtualJunctionPatches()` его не вызывает: она получает уже разрешённые
`wallIntervals()`. Поэтому Medium #201 не является причиной нулевого patch-list
в корректном воспроизведении #197.

Это не дефект #150: atomic thickness profile и exterior transition исправны.
Короткий вне-сеточный интервал — отдельная находка #198. Общая проверка результата
Optimize перед записью — отдельный защитный барьер #199.

## 4. Зафиксированное продуктовое решение

Открытых продуктовых вопросов нет. Действующий контракт уже задан
`docs/WALL-THICKNESS.md` и ТЗ #141:

1. локальный independent/virtual junction не может удалить валидную кладку
   остальных комнат;
2. канонический результат един для рисунка, пола и световых препятствий;
3. при невозможности обработать дополнительный patch допустима локальная
   консервативная деградация без записи config;
4. основной structural boolean failure по-прежнему отличим от успешной пустой
   geometry и остаётся fail-dark; #197 не превращает любой сбой в оптимистичный
   raw-ring fallback.

## 5. Скоуп

В задачу входят:

1. численная стабилизация координат, вычисленных для virtual junction patches,
   перед передачей в boolean engine;
2. изоляция `union` каждого patch: один отказ не откатывает ранее построенные
   room rings, edge bodies и успешные patches;
3. сохранение валидной основной geometry, `paperGeom`, `depthUnits` и
   `openingIndex`, когда отказал только дополнительный patch;
4. одинаковый исправленный structural result для Plan, View/киоска,
   `houseplan-space-card`, hidden Iso/floor footprint, clean floor/area, Glow,
   source guard и солнца;
5. неизменность opening cuts, exterior shell, независимых partitions/columns и
   порядка, в котором они входят в canonical body;
6. существующие сохранённые планы без миграции и фоновой записи;
7. unit regression на полном fixture, матрица численных вариантов, targeted
   production-bundle browser smoke, visual regression и release-документация.

## 6. Не входит в задачу

- удаление, слияние или изменение минимальной длины wall interval — #198;
- geometry self-check в Optimize preview/apply/undo — #199;
- изменение алгоритма `normalizeWallIntervals()`, `degradeWalls()` или
  `alignAllToGrid()`;
- общая замена `polyclip-ts` или настройка его глобальной точности;
- новый persisted junction/node, schema version или migration;
- привязка offset/mitre-вершин к пользовательской сетке;
- изменение толщины, `MITRE_LIMIT`, типов стыка или правил #141;
- исправление произвольного основного exterior/ring/opening boolean failure;
- новые controls, предупреждения, диагностический toast или настройка fallback;
- публикация скрытой изометрии.

## 7. Контракт поведения

### 7.1. Численная стабилизация patch

1. Координаты patch должны быть конечными; patch с не-конечным значением либо
   площадью не больше действующего geometry tolerance не передаётся в union.
2. Математически совпадающие результаты операций с общей вершиной и offsets
   приводятся к одной детерминированной координате с технической точностью,
   многократно меньшей общего geometry epsilon.
3. Стабилизация не использует шаг пользовательской сетки: half-depth 15–33 см и
   диагональные mitre вправе находиться между grid nodes.
4. Сдвиг любой вершины от исходного конечного значения не превышает выбранный
   numeric tolerance и не меняет видимую толщину, bounded-mitre envelope или
   association с исходным узлом.
5. Результат не зависит от представления `x` против `x ± ulp`, направления
   segment и порядка эквивалентных wall records.

### 7.2. Изоляция локального отказа

1. Каждый junction patch объединяется независимо, как room-ring и edge-body
   pieces в соседних canonical loops.
2. Перед попыткой сохраняется последняя успешная `body`. Если union patch
   выбрасывает исключение, эта `body` остаётся результатом следующего шага.
3. Ошибка одного patch не пропускает последующие patches, exterior clipping,
   shell union, opening cuts и independent extra-body union.
4. Если до patches существует валидная непустая structural body, функция не
   возвращает `null` только из-за patch. `paperGeom` также не теряется.
5. Если основная exterior/ring/opening geometry не может быть построена либо
   финальный обязательный pass падает, сохраняется действующий общий `null` и
   fail-dark; raw per-room rings не воскрешаются.
6. Fallback ничего не записывает, не меняет входные массивы и не создаёт
   различающуюся физику между render consumers.

### 7.3. Канонические потребители

Один возвращённый `wallBodiesGeometry()`/structural cache определяет:

- masonry path полного Plan/View и киоска;
- masonry path static card;
- hidden Iso footprint и wall faces;
- clean-floor subtraction, room fill и displayed area;
- paper footprint;
- Glow barriers, source-inside-body guard и spill;
- солнечные препятствия.

Ни один consumer не получает отдельный SVG-only обход либо собственную
нормализацию patch. Presentation-различия вроде hatch suppression при малой
экранной толщине остаются допустимыми; физическое множество совпадает.

### 7.4. Совместимость существующей геометрии

- Исправный virtual T продолжает получать прежний bounded patch.
- Room L/T/nested joins, corner Split #123, thickness transition #150 и
  zero-divider #172 не меняют внешний outline.
- Openings по-прежнему режут room masonry после junction pass; совпавший
  independent body не режется room opening.
- Partitions, drafts и columns не увеличивают Stage floor footprint.
- Перестановка комнат/стен может менять внутренний порядок boolean operations,
  но не геометрическое множество и не способность функции завершиться.

## 8. Архитектурный контракт реализации

1. Исправление живёт в общей geometry-логике `src/wall-thickness.ts`, рядом с
   построением/union virtual junction patches, а не в отдельном renderer.
2. Numeric normalization является чистым локальным helper либо эквивалентной
   операцией и применяется только к вычисляемым patch vertices.
3. Tolerance масштабируется согласованно с `coordScale`, чтобы normalized и
   render-space вызовы описывали одну физическую форму; жёсткое округление до
   сантиметра, grid step или фиксированного числа видимых знаков запрещено.
4. Per-patch fallback сохраняет `body` транзакционно: присваивание происходит
   только после успешного `union`.
5. Structural cache key не меняется: стабилизация является детерминированной
   функцией уже входящих в fingerprint координат, cuts и толщин.
6. Логирование, если добавляется, не содержит config/названий комнат и не
   спамит каждый HA state tick. Новый публичный diagnostic API не требуется.

Предполагаемые файлы:

- `src/wall-thickness.ts`;
- `test/wall-thickness.test.mjs`;
- `demo/smoke_junction_patch_resilience.mjs` либо узкое расширение существующего
  wall-thickness smoke с однозначной связью с #197;
- visual fixture в golden matrix, если текущая wall-junction сцена не доказывает
  сохранение полного много-комнатного плана;
- `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`,
  `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, `docs/STATUS.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`;
- три синхронные поставляемые копии bundle.

## 9. Модель данных, compatibility и миграция

Форматы `RoomCfg`, `WallEntry`, `open_spans`, openings, partitions и columns не
меняются. Новых ключей, aliases и version markers нет.

- старые и уже оптимизированные планы исправляются вычисляемо при чтении;
- render, preview и cache warm-up не выполняют config/layout/storage write;
- Optimize не запускается автоматически и его отчёт не меняется;
- import/export и backend validation не меняются;
- откат возвращает прежнее поведение без преобразования данных;
- future/unknown fields не затрагиваются.

## 10. UX, i18n, accessibility и touch

Новых controls, текстов, focus/keyboard semantics, ARIA, animation и locale keys
нет. RU/EN i18n не меняется.

Plan editor остаётся desktop-first. Touch editor — best effort / intentionally
degraded, но один сохранённый plan не может получить другую masonry geometry из-за
pointer type. View, kiosk и static card полностью поддерживаются и обязаны
оставаться читаемыми.

Светлая/тёмная тема, forced colours, `prefers-reduced-motion`, hatch color и wall
opacity не меняют fallback. Цвет не используется как единственное доказательство:
unit проверяет геометрическое множество, browser smoke — реально отрисованный
path на двух темах.

## 11. Критерии приёмки

- **AC1 (`unit`):** полный анонимизированный fixture из issue готовится ровно по
  reproducer §3: room/cut coordinates масштабированы, persisted `walls[].a/b`
  остаются нормализованными; получаются 8 rooms, 25 walls, 3 cuts и 20-см
  horizontal atomic intervals. На исходном `dev` этот вызов даёт `null`, после
  исправления — ненулевой объект с непустыми `geom` и `paperGeom`.
- **AC2 (`unit`):** test seam подтверждает ровно один pre-union patch с четырьмя
  вершинами из §3; варианты `x`, `x ± ulp` и стабилизированный эквивалент дают
  одно geometric set в пределах numeric tolerance и не меняют bounded envelope.
- **AC3 (`unit`):** принудительный throw на первом из нескольких patch unions
  сохраняет последнюю успешную body, позволяет обработать следующий patch и не
  меняет `paperGeom`; основной обязательный boolean throw по-прежнему даёт
  `null`.
- **AC4 (`unit`):** удаление и слияние микро-интервала не используются как
  лечение: regression проходит с исходными 25 wall records; входные `rooms`,
  `walls`, `openCuts`, `openings` и `extraBodies` после вызова побайтно
  эквивалентны исходным.
- **AC5 (`unit`):** перестановка room/wall records, обратное направление
  эквивалентных segments и повторный вызов дают одно множество без исключения;
  geometry сравнивается symmetric difference/area, а не строковым порядком rings.
- **AC6 (`unit`):** существующие матрицы #123/#141/#150/#172, nested/courtyard,
  openings, open spans и independent extras остаются зелёными; валидные обычные
  junction fixtures геометрически не меняются за пределами numeric tolerance.
- **AC7 (`smoke`):** targeted production-bundle smoke загружает полный fixture и
  подтверждает непустой masonry path в Plan, View, kiosk/static и hidden Iso,
  одинаковый structural fingerprint и отсутствие write после render.
- **AC8 (`smoke`):** тот же smoke проверяет clean floor/paper и Glow/source/sun
  consumers: кладка не исчезает при переключении HA state, светлой/тёмной темы и
  режима отображения; topology не пересчитывается от обычного state tick.
- **AC9 (`golden`):** детерминированная сцена полного плана показывает кладку и
  T-стык в Plan и View минимум в dark theme. Baseline принимается только из
  просмотренного полного Linux artifact через `golden:accept -- --reviewed`.
- **AC10 (`ревью кода`):** отсутствуют renderer-specific fallback, grid snapping
  физических offsets, schema/backend/i18n изменения и исправления #198/#199;
  локальный catch не скрывает основной structural failure.
- **AC11 (`typecheck` + `unit` + `build` + `smoke`):** локальный gate зелёный,
  целевой smoke выполнен до S7, три bundle-копии после build побайтно одинаковы.

## 12. План автотестов и гейтов

### Unit

В `test/wall-thickness.test.mjs` либо отдельном узком pure-geometry файле:

1. добавить полный issue fixture без ручного сокращения и вызвать production
   signature `wallBodiesGeometry()`;
2. проверить patch count/finite vertices/bounds и numeric-equivalent variants;
3. внедрить контролируемый отказ одного patch union через узкий pure helper либо
   другую тестируемую границу, не подменяя production algorithm;
4. проверить продолжение после отказа и отдельно общий structural fail-dark;
5. проверить input immutability, repeatability и permutation invariance;
6. прогнать существующие wall junction/thickness/opening/floor/light regressions.

Минимум один новый тест обязан уметь падать: возврат старого незащищённого цикла
должен снова дать `null` на полном fixture. Ревьюер проверяет эту мутацию или
эквивалентное доказательство.

### Targeted browser smoke

`node demo/smoke_junction_patch_resilience.mjs` либо эквивалентный явно названный
scenario:

1. загружает поставляемый production bundle и fixture issue;
2. снимает signatures masonry/paper/floor в Plan, View, static и hidden Iso;
3. проверяет dark/light theme и HA light-state update без исчезновения paths;
4. проверяет Glow/source guard и доступный sun-occluder contract;
5. подтверждает отсутствие config/layout write.

Этот targeted smoke выполняется локально перед `S7-code-review`. Полный набор
smoke не запускается в implementation loop.

### Golden и pre-release

Golden-сцена может расширить существующий wall-junction scenario, если полный
fixture и глобальное сохранение кладки читаются однозначно. Локальное принятие
baseline ради зелёной ветки запрещено. Full smoke, golden capture/verify,
performance и Linux Validate выполняются перед бетой на точном SHA по
`PROCESS.md`.

### Обязательный implementation loop

```text
npm run typecheck
npm test
npm run build
сравнение трёх bundle-копий
node demo/smoke_junction_patch_resilience.mjs
```

Python/HA harness не нужен для локального gate: backend не меняется; полный
Linux harness остаётся release gate.

## 13. Производительность и безопасность

Numeric normalization и один локальный `try/catch` не меняют асимптотику.
Количество patches, boolean passes и structural cache invalidation остаются
прежними. HA states, theme, hover и animation tick не входят в geometry key.

Отдельный budget не добавляется. Перед бетой существующие large-house и Full
Performance должны пройти без ослабления порогов; точный fixture #197 добавляется
в performance только если измерение покажет отдельный значимый профиль.

Security/privacy влияние отсутствует: нет HTML/CSS ввода, сетевых запросов, HA
services, новых permissions или пользовательских данных. Полный fixture уже
анонимизирован; diagnostic output не должен печатать исходный config.

## 14. Риски и снижение

| Риск | Вероятность / ущерб | Снижение |
|---|---|---|
| Слишком грубая нормализация изменит толщину или mitre | средняя / высокий | tolerance значительно меньше geometry epsilon; exact bounds и symmetric-difference tests |
| Grid rounding сломает диагонали и half-depth | средняя / высокий | явный запрет grid snapping; matrix разных `coordScale` и толщин |
| Catch скроет основной отказ и вернёт опасную geometry | средняя / высокий | catch только вокруг одного optional patch; отдельный core-failure test |
| Plan исправится, а light/Iso продолжат использовать другой body | низкая / высокий | один canonical result и consumer smoke AC7/AC8 |
| Перестановка records снова вызовет polyclip failure | средняя / высокий | permutation + ulp matrix на полном fixture |
| Golden примет массовый anti-aliasing diff | низкая / средний | узкая сцена, просмотр полного Linux artifact, без локального auto-accept |
| Попутно изменится optimizer | низкая / высокий | явный non-scope и отдельные #198/#199 |

## 15. Откат

Откат — revert одного user-visible implementation commit вместе с тестами,
документацией, changelog и bundle-копиями. Persisted schema и данные не меняются,
поэтому migration/cleanup не нужны. После отката возвращается риск полного
исчезновения кладки на исходном fixture.

Feature flag не добавляется: это восстановление обязательного fail-closed
контракта общей физической геометрии, а не экспериментальная функция.

## 16. Release-артефакты

Изменение пользовательское. Implementation-коммит имеет `User-Visible: yes` и
в том же коммите обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #197;
- `docs/WALL-THICKNESS.md` — per-piece junction failure и numeric normalization;
- `docs/ARCHITECTURE.md` — граница optional patch против core structural failure;
- `docs/USER-GUIDE.ru.md` — диагностика исчезнувшей кладки после Optimize;
- `docs/TESTING.md` — unit/smoke/golden coverage #197;
- `docs/STATUS.md` — фактическая реализованная release-линия;
- unit fixture, targeted smoke и golden scenario/candidate;
- `dist/houseplan-card.js`,
  `custom_components/houseplan/frontend/houseplan-card.js`,
  `demo/srv/assets/houseplan-card.js` после build.

Screenshots вне golden не требуются. Backend, migration, i18n, отдельный security
report и отдельный performance budget не требуются. Issue закрывается только
после включения в опубликованную бету.

## 17. Принятые технические предположения — можно менять без продуктового ревью

1. Рекомендуемый numeric step — величина порядка `coordScale × 10⁻¹²` либо
   эквивалентная relative/ULP-нормализация, доказанная AC2; точное имя helper и
   коэффициент не являются продуктовым контрактом.
2. Нормализуются только junction patch vertices непосредственно перед boolean
   boundary; persisted rooms/walls/cuts и основные room profiles не округляются.
3. Patch с не-конечными координатами или ничтожной площадью считается локально
   непригодным и проходит тот же isolated fallback.
4. Если нормализованный patch всё равно вызывает исключение, он пропускается;
   последующие patches и обязательные passes продолжаются.
5. Для текущего полного fixture пропуск и успешный стабилизированный union после
   final exterior clipping дают одинаковую площадь; тест всё равно проверяет
   успешную нормализацию, чтобы catch не был единственным лечением.
6. Инъекция отказа в unit может быть реализована через небольшой pure helper,
   test-only boolean adapter или эквивалент без публичного runtime API.
7. Имена smoke/golden scenarios и раскладка test fixture свободны, если связь с
   AC и возможность красного прогона сохраняются.
8. Нет открытых продуктовых вопросов; смежные решения вынесены в #198 и #199.
