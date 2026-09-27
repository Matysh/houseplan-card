# Issue #261 — белые клинья в T-стыках после ограниченного multi-wall bevel

- Дата: 2026-08-23
- Тип: bug · приоритет P1
- Оценка: пользовательская ценность 8/10 · ценность для разработки 8/10 ·
  сложность/риск 7/10
- Issue: [#261](https://github.com/Matysh/houseplan-card/issues/261)
- Ветка: `issue/261-white-wedges-root-cause`
- Статус ТЗ: реализовано, ожидает код-ревью
- Реализация после rebase на текущий `dev`: `0dc6c39`; проверочные артефакты и
  smoke registry: `2e53cb0`.

Канонические документы: `docs/SCOPE.md`, `docs/USER-GUIDE.ru.md`,
`docs/ARCHITECTURE.md`, `docs/WALL-THICKNESS.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/TOUCH-SUPPORT.md` и
`docs/TESTING.md`.

Связанные, но не дублирующие задачи:
[#197](https://github.com/Matysh/houseplan-card/issues/197),
[#249](https://github.com/Matysh/houseplan-card/issues/249),
[#253](https://github.com/Matysh/houseplan-card/issues/253) и
[#258](https://github.com/Matysh/houseplan-card/issues/258).

## 1. Сценарий и персона

Администратор дома открывает в `v1.67.0-beta.4` обычный сохранённый план с
толстыми стенами разной толщины. В нескольких T-образных стыках вместо единого
тела кладки видны белые треугольные клинья. Они остаются после reload и видны
не только администратору в Plan, но также семье в View, kiosk и Static.

Это нарушает J1 из `docs/SCOPE.md`: план перестаёт правдиво показывать
физические стены дома. Исправление также обслуживает J6: все поверхности должны
получать одну каноническую геометрию, а не отдельную визуальную заплатку.

## 2. Подтверждённое воспроизведение

Один и тот же реальный экспорт владельца выполнен production-проекцией
`spaceModels()` → `prepareSpacePhysicalGeometryInputs()` →
`wallBodiesGeometry()` на `v1.67.0-beta.3`, `v1.67.0-beta.4` и текущем `dev`.
Вход содержит 8 комнат, 24 записи толщины, 3 виртуальных участка, 15 проёмов и
3 независимых физических тела.

Результат сравнения:

- `wallIntervals` beta.3/beta.4 совпадает побайтово;
- `wallEdgeBodies` beta.3/beta.4 совпадает побайтово;
- `buildMultiWallNodeMap()` beta.4 находит 12 физических degree-3 узлов;
- `paperGeom` beta.3 имеет площадь `727303.8201095833`, а beta.4/current dev —
  `727248.4381651384`;
- из beta.4 исчез один реальный треугольник площадью `55.3819444449`
  render-unit² с вершинами около `(887.5, 559.1667)`, `(899.5833, 550)` и
  `(899.5833, 559.1667)`;
- безопасная внутренняя точка исчезнувшего тела: `(895.5, 556.0)` в
  production render coordinates, или `(0.8955, 0.5560)` в сохранённой
  нормализованной конфигурации.

Этот узел уже присутствует в обезличенной фикстуре
`test/fixtures/197-junction-patch.json`, поэтому пользовательский экспорт в
репозиторий не добавляется. Фикстура #197 содержит 8 комнат, 25 wall entries и
3 virtual cuts; дополнительная ULP-запись не меняет сам проблемный узел.

## 3. Подтверждённая причина

Первый дефектный SHA — коммит #249 `29904df` (`fix: bound multi-wall junction
bevels`). Уже на нём masonry теряет `495.579151` render-unit² относительно
beta.3, а paper — указанный треугольник `55.381944`. Изменения #253 на этом SHA
ещё отсутствуют и причиной не являются.

У #249 есть два разных варианта одной bevel-формулы:

1. `multiWallBevelTriangles(map)` оставляет физическое пересечение лучей до
   `R = 1.25 × H` и возвращает только малый excessive wedge за этим радиусом;
2. внутренний `multiWallBevelTrianglesAt(map, false)` начинает cut от исходных
   offset-точек граней и возвращает весь треугольник до старой mitre-вершины.

`bevelMultiWallPaper()` применяет второй вариант, затем делает
`union(centre, beveled)`. Room centre возвращает только площадь внутри
объединения комнат; наружная половина физической стены не возвращается.
`bevelMultiWallBody()` использует тот же полный cut перед локальной
реконструкцией, но reconstructed ray strips клипуются к `centre`, поэтому их
внешняя часть также теряется. Алгоритм, предназначенный для удаления длинного
mitre-зуба, вырезает допустимое пересечение двух положительных физических
лучей.

Общая грань `0.620833,0.545833@1.5706` без толщины из исходной гипотезы не
причастна: её `half = 0`, она не входит в degree-3 карту и находится у
`(620.833, 545.833)`, а подтверждённый клин — у `(887.5, 550)`.

## 4. Что человек увидит до и после

**До:** у T-стыка положительных стен разной толщины штрихованное тело и бумага
теряют треугольный сектор между двумя реальными лучами. Через него виден белый
фон/пол, словно в кладке есть отверстие.

**После:** те же сохранённые комнаты и толщины образуют одно непрерывное тело
без белого клина. Старый чрезмерный mitre-зуб по-прежнему ограничивается прямой
фаской за пределом `1.25 × H`; исправление не возвращает выступ #249 и не
округляет стык. Результат одинаков в Plan, View, kiosk, Static и скрытой
изометрии, а свет не проходит сквозь восстановленную кладку.

Новых сообщений, настроек и ремонтных действий нет. План исправляется при
чтении без Save или Optimize.

## 5. Scope

### Входит

- устранение полного destructive cut для положительных ray strips в
  degree-3+ room-wall nodes;
- сохранение физического пересечения лучей вплоть до действующего
  `R = 1.25 × H` внутри и снаружи room-centre union;
- согласованные `roomGeom`, final masonry и `paperGeom` без клина;
- Full/Plan/View/kiosk, Static, hidden Iso, clean floor/room fill/hover и
  Glow/sun/light-barrier consumers одной геометрии;
- regression на существующей обезличенной фикстуре #197;
- усиление unit, browser smoke, golden semantic gate и mutation gate;
- обновление канонических документов, пользовательского руководства и двух
  changelog.

### Не входит

- изменение `R = 1.25 × H`, `MITRE_LIMIT = 4` или прямой формы фаски #249;
- возвращение старых неограниченных mitre-зубов beta.3;
- изменение wall-key/stored-endpoint ремонта #258;
- добавление толщины нулевой общей грани у `(620.833, 545.833)`;
- изменение interval classification, shared/outer/virtual semantics,
  толщины стен, openings, partitions, drafts или columns;
- изменение сохранённых rooms/walls/open spans либо новый Optimize-pass;
- новый UI, i18n, backend, schema/model/store version или WebSocket API.

## 6. Геометрический контракт

### 6.1 Физическая область multi-wall node

Для каждого canonical node степени `3+` используются существующие уникальные
положительные rays. Повторы shared interval и сонаправленные дубликаты остаются
схлопнутыми; zero-thickness и virtual intervals материала не добавляют.

Локальное физическое тело node определяется union конечных полос всех rays.
Из него разрешено удалить только ту часть pairwise mitre-overlap, которая
лежит за `R = 1.25 × H`, где `H` — максимальная incident half-depth.

Полный треугольник от offset origins до старой mitre-вершины не является
допустимым cut: его часть до `R` принадлежит физическим полосам и должна
остаться заполненной. Это правило одинаково по обе стороны room-centre union.

### 6.2 Masonry и exterior

В bounded mask проблемного node canonical room masonry:

1. сохраняет complete positive ray strips;
2. удаляет только excessive area за `R`;
3. остаётся в допустимой exterior/paper envelope;
4. имеет ненулевое заполнение в node centre и area-connected связь с каждым
   incident ray;
5. не зависит от rooms/walls order, interval direction и room winding.

Room-centre union не может быть единственным clip для repaired local strips,
потому что физическая outer half-wall по контракту растёт наружу. Одновременно
local reconstruction не вправе выходить за каноническую ограниченную exterior
envelope и возвращать старый фасадный spike.

### 6.3 Paper

`paperGeom` обязан покрывать room centre и всю каноническую room masonry,
которой нужен фон плана. Bevel paper удаляет только область за `R`; он не
вырезает bounded overlap положительных rays. Внутри node не образуется новый
hole/component.

Открытия и independent physical bodies сохраняют нынешний порядок: openings
режут masonry после canonical `roomGeom`, а independent bodies не расширяют
room paper.

### 6.4 Clean floor и physics

`roomGeom` остаётся единственным pre-opening/pre-independent wall authority.
Clean-floor/room-fill/hover subtract именно его; восстановленный wall probe не
может стать полом соседней комнаты. Final masonry, hidden Iso и light barriers
получают тот же node: визуальная щель не заменяется невидимым occluder и
наоборот.

Структурные caches и fingerprints сохраняют нынешнюю зависимость только от
геометрии. Theme, hover и HA state tick не перестраивают topology.

### 6.5 Failure isolation

Каждый node остаётся локальной транзакцией по контракту #197: invalid/nonfinite
candidate не удаляет успешную геометрию других nodes и не превращает весь план
в `null`. Обязательные exterior/body/opening failures продолжают fail-dark;
исправление не маскирует их как успешный результат.

## 7. Данные, compatibility, touch, security и performance

- Config/layout и `model_version` не меняются; чтение и render не мутируют
  вход.
- Обе сохранённые wall-key формы #258 продолжают давать одну геометрию;
  Optimize не требуется для визуального исправления.
- Legacy key-only records и нулевые/virtual intervals сохраняют действующие
  правила.
- Новых UI, focus, ARIA, клавиатурных, pointer или touch-контрактов нет. View и
  kiosk получают исправление через общий render path; редакторы остаются
  desktop-first.
- Новых данных, HTML, URL, service calls, permissions и security surfaces нет.
- Node map не строится повторно. Локальный repair остаётся в существующем
  cached structural pass; запрещён новый полный `O(E²)` обход на HA state tick.
  Отдельный performance budget не нужен, но prerelease performance smoke
  остаётся обязательным.

## 8. Acceptance criteria и доказательства

### AC1. Реальный T-узел сохраняет физический сектор

На `test/fixtures/197-junction-patch.json` при `coordScale = 1000`:

- `wallBodiesGeometry()` возвращает непустые `roomGeom`, `geom` и `paperGeom`;
- probe `(895.5, 556.0)` находится внутри `roomGeom`, final `geom` и
  `paperGeom` с устойчивым ненулевым покрытием, а не только на границе;
- probe не находится ни в одном clean-floor результате соседних rooms;
- локальное тело у `(887.5, 550)` связано со всеми тремя incident rays;
- повторный расчёт детерминирован.

**Доказательство:** unit в `test/wall-thickness.test.mjs`, использующий
существующую fixture #197 и polygon-area/point coverage, а не только общую
непустоту или brittle SVG-строку.

### AC2. Ограничение #249 не ослаблено

На fixture #249 и table-driven 3/4-ray cases:

- old excessive wedge остаётся пустым;
- join не выходит дальше `1.25 × H + epsilon`;
- ordinary two-ray joins сохраняют `MITRE_LIMIT = 4` и прежние expected values;
- равные/неравные толщины, permutations, reversed intervals, room winding и
  normalized/production scale дают эквивалентный результат.

**Доказательство:** существующие и усиленные unit
`test/wall-thickness.test.mjs`; прежние expected values #249 не переписываются
ради прохождения нового теста.

### AC3. #197, #258 и zero-depth regressions остаются закрыты

- forced failure одного optional junction candidate сохраняет остальные nodes
  и непустую canonical geometry;
- affected/canonical wall-key variants #258 дают равные masonry/paper paths;
- нулевая общая грань `(620.833, 541.667..550)` не становится физической и не
  увеличивает degree;
- render не мутирует rooms, walls, open spans, openings или extra bodies.

**Доказательство:** unit #197/#258, deep equality и mutation gate. Новый mutant
возвращает full-origin bevel cut в paper/body; AC1 обязан на нём краснеть.

### AC4. Все browser-поверхности видят один заполненный node

В `demo/smoke_junction_patch_resilience.mjs` fixture #197:

- Plan/View/kiosk wall path и paper path содержат normalized probe
  `(0.8955, 0.5560)` через реальный SVG `isPointInFill()` либо эквивалентный
  geometry probe;
- Static получает тот же canonical wall path и заполненный probe;
- hidden Iso source masonry и light-barrier masonry содержат тот же probe;
- clean-floor/hover не присваивают probe полу;
- theme и HA state tick сохраняют path/fingerprint и повторно используют cache.

**Доказательство:** targeted browser smoke. Проверка одной лишь непустоты path
недостаточна.

### AC5. Golden защищает видимый клин семантически

Сценарии `junction-patch-resilience-plan-dark` и
`junction-patch-resilience-view-dark` используют существующую полную fixture и
получают явный `retainedWedgeProbe: [0.8955, 0.5560]`. Golden capture до записи
PNG проверяет, что wall и paper SVG действительно заполняют probe; пустая,
неверно кадрированная или сохранившая клин сцена завершается ошибкой.

Изменившиеся Linux CI PNG и diff просматриваются до принятия baseline.
Локальный Windows raster не является каноном.

**Доказательство:** `demo/golden/matrix.mjs`, `demo/golden/harness.mjs`,
`demo/golden/run.mjs`, `test/golden-matrix.test.mjs` и полный
`npm run golden:verify`.

### AC6. Данные и производительность не меняются

- до/после render входной config побайтово одинаков;
- schema/backend/i18n отсутствуют в diff;
- structural cache строит node map один раз; state/theme ticks его используют;
- `node scripts/model-invariants.mjs --config <реальный экспорт>` не получает
  новых нарушений.

**Доказательство:** unit/smoke, review diff и model-invariants на исходном
экспорте владельца.

### AC7. Локальные гейты реализации зелёные

- `npx tsc --noEmit`;
- `npm test`;
- `npm run build` с действующей проверкой shipped bundle copies;
- `node scripts/check-docs.mjs`;
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` с явным решением
  по каждой предложенной строке;
- targeted `node demo/smoke_junction_patch_resilience.mjs` и
  `node demo/smoke_multiwall_junction.mjs`;
- `npm run golden:verify` для видимого изменения;
- `node scripts/model-invariants.mjs --config
  C:\\Temp\\houseplan-space-1-2026-08-23_02-30-42.json`.

Полный smoke и performance остаются prerelease gates; Python/backend suite не
требуется при отсутствии Python diff. Canonical HA harness остаётся Linux CI.

## 9. Затронутые файлы и модули

Ожидаемый product diff:

- `src/wall-thickness.ts` — canonical multi-wall body/paper repair.

Ожидаемые доказательства:

- `test/wall-thickness.test.mjs`;
- `demo/smoke_junction_patch_resilience.mjs`;
- при необходимости `demo/smoke_multiwall_junction.mjs`;
- `demo/golden/matrix.mjs`, `demo/golden/harness.mjs`,
  `demo/golden/run.mjs`, `test/golden-matrix.test.mjs`;
- `scripts/mutation-gate.mjs`.

Документация:

- `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`;
- `docs/USER-GUIDE.ru.md` и синхронный `docs/USER-GUIDE.md`;
- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- docs screenshots/manifest, если обязательный `check-docs` требует их
  обновления для текущего `src/**` fingerprint.

Новых i18n keys нет.

## 10. Release artifacts

- User-visible bugfix записывается в оба changelog в том же коммите, что
  `src/**`.
- Каноническая wall/architecture/testing документация обновляется тем же
  коммитом.
- Golden baseline меняется только после просмотра полного Linux CI artifact и
  `npm run golden:accept -- --reviewed`.
- Если source fingerprint делает docs screenshots stale, кандидаты снимаются
  только workflow `Docs screenshots` и принимаются из его полного artifact;
  локальная Windows-пересъёмка не коммитится.
- Перед бетой обязательны полный smoke, golden и performance/Validate exact-SHA
  по действующему release process.

## 11. Риски и меры снижения

### R1. Возврат фасадного spike #249

Если просто убрать full-origin cut, старый длинный mitre может вернуться.

**Митигация:** AC2 сохраняет bound `1.25 × H`, discarded-wedge probe и
перестановочную матрицу #249; меняется область cut, а не лимит.

### R2. Ложная кладка снаружи дома

Если разрешить rebuilt strips без exterior envelope, child-room ray может
расширить фасад.

**Митигация:** §6.2 требует clip к канонической bounded paper/exterior envelope,
corner-Split и concave-facade тесты остаются неизменными.

### R3. Paper, masonry и physics расходятся

Исправление только SVG path скроет белый клин, но оставит ложный clean floor или
проход света.

**Митигация:** AC1/AC4 проверяют `roomGeom`, final masonry, paper, clean floor,
Iso и light barrier одной точкой. Отдельный render-only patch запрещён.

### R4. Существующая fixture снова проверит только непустоту

#197 уже содержала проблемный node, но её unit/smoke принимали общую площадь и
непустой path, поэтому регрессия прошла.

**Митигация:** обязательные point-coverage assertions, semantic golden field и
mutant полного cut. Тест должен быть продемонстрирован красным на мутанте.

### R5. Local boolean repair погасит соседние nodes

Изменение order union/intersection может вернуть failure mode #197.

**Митигация:** node-by-node transaction сохраняется; forced-failure test и
полная fixture проверяются вместе с новым probe.

## 12. Откат

Откатывается локальная multi-wall body/paper correction вместе с unit,
smoke/golden и документацией. Данные не мигрируются, поэтому отдельного
data rollback нет. Golden baseline откатывается только вместе с product
geometry; частичный откат оставит ложный зелёный визуальный гейт.

## 13. Принятые технические предположения

1. Наблюдаемый пользовательский контракт — непрерывная физическая кладка с
   сохранённым bound #249; точное разбиение функции на helpers не является
   продуктовым решением.
2. Existing fixture #197 является достаточной обезличенной regression fixture;
   полный реальный export используется только локально для cross-version и
   model-invariants проверок.
3. Probe `(895.5, 556.0)` выбран внутри измеренного исчезнувшего треугольника с
   запасом от его границ; он не является brittle vertex equality.
4. Paper может отличаться от beta.3 на малую область excessive bevel за `R`:
   задача требует физический контракт, а не полное byte/area равенство старой
   версии.
5. Нулевая общая грань остаётся отдельным корректным zero-depth interval. Её
   материализация для маскировки клина была бы исправлением симптома и выходит
   из scope.
