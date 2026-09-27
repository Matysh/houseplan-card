# Issue #272 — без белых полостей в multi-wall стыках

- Дата: 2026-08-23
- Тип: bug · приоритет P1
- Оценка: пользовательская ценность 10/10 · ценность для разработки 10/10 ·
  сложность 8/10 · риск 9/10
- Issue: [#272](https://github.com/Matysh/houseplan-card/issues/272)
- Ветка: `issue/272-no-multiwall-holes`
- Статус ТЗ: готово к ревью

Канонические документы: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`,
`docs/WALL-THICKNESS.md`, `docs/USER-GUIDE.ru.md` и `docs/TESTING.md`.

Связанные задачи:
[#249](https://github.com/Matysh/houseplan-card/issues/249),
[#258](https://github.com/Matysh/houseplan-card/issues/258),
[#261](https://github.com/Matysh/houseplan-card/issues/261),
[#270](https://github.com/Matysh/houseplan-card/issues/270) и
[#271](https://github.com/Matysh/houseplan-card/issues/271).

## 1. Сценарий и персона

Администратор открывает два реальных плана после Optimize в свежей beta.5. В
обычных прямоугольных T/X-стыках между штрихованными полосами видны белые
треугольники. Они выглядят как отверстия в стене, сохраняются в View и на
разных масштабах и не соответствуют ни opening, ни room topology.

Семья не может доверять главной визуальной поверхности. Это прямое нарушение
J1 и J6: физически непрерывный стык должен быть непрерывным у всех consumers,
а тест не может принимать белую дыру только потому, что она мала относительно
полного кадра.

## 2. Подтверждённое воспроизведение

Приватные экспорты `1.json` (`cell_cm: 5`, 12 degree-3+ nodes) и `2.json`
(`cell_cm: 1`, 14 nodes) прогнаны точной production geometry. Скриншоты
`1-1.png`, `1-3.png`, `2-2.png`, `2-3.png` показывают белые клинья на разных
сочетаниях равной и смешанной толщины.

#261 исправила измеренный сектор около `(887.5, 550)` и добавила один
`retainedWedgeProbe`. Но она не проверила полную окрестность каждого node.

#270 независимо измерила текущее состояние golden-сцены:

- старый baseline содержит четыре запертые пустые компоненты;
- текущий код после #261 содержит две;
- pixel diff составляет меньше допуска сцены, поэтому golden проходит;
- добавляемый #270 inventory фиксирует `enclosedHoles: 2`, но сознательно не
  решает, правильны ли они.

Новый пользовательский репорт даёт продуктовый вердикт: видимых запертых
фоновых полостей в непрерывном стыке быть не должно. При этом внешний фон за
фаской и существующий discarded-wedge contract #249 должны остаться пустыми.

Полные пользовательские экспорты не коммитятся. В репозиторий попадают только
минимизированные анонимные node fixtures для обоих grid scales.

## 3. Подтверждённая зона причины

`multiWallBevelTrianglesAt()` строит pairwise cut для последовательных rays,
если старое пересечение offset-lines дальше `R = 1.25 × H`.
`bevelMultiWallBody()`:

1. вычитает full-origin pairwise triangles из исходного body;
2. независимо union-ит ray rectangles;
3. вычитает bounded excessive triangles;
4. добавляет tiny core;
5. клипует local result к envelope и подменяет часть исходной masonry в mask.

`bevelMultiWallPaper()` применяет bounded triangles к paper отдельно. Эти
операции локально разумны по точечным probes #249/#261, но не гарантируют, что
границы нескольких pairwise cuts образуют один внешний bevel вместо
изолированного треугольного hole. Masonry и paper могут также оставить разные
локальные компоненты.

Корневая зона доказана; точная boolean-перестройка остаётся техническим
решением реализации и должна выводиться из инварианта §6, а не подгоняться под
один пиксельный baseline.

## 4. Что человек увидит до и после

**До:** между реальными лучами T/X-стыка виден белый треугольник, иногда с
outline по краям, будто кладка разорвана.

**После:** стык читается как единое сплошное тело. Если внешний угол ограничен
фаской #249, пустота лежит снаружи непрерывного контура и соединена с внешним
фоном; она не становится запертой дырой внутри masonry/paper.

Новых UI, настроек и миграции нет. Исправление действует при чтении плана во
всех режимах.

## 5. Scope

### Входит

- общий топологический инвариант для непрерывных degree-3+ wall nodes;
- согласованная локальная реконструкция body и paper без запертых фоновых
  компонентов;
- T и X, равные/смешанные толщины, `cell_cm: 1/5`, разные winding/order;
- сохранение bounded exterior bevel и finite rays;
- room masonry, final masonry, paper, clean floors/fills/hover, Static/Iso и
  light/sun barriers;
- unit geometry inventory, browser semantic inventory, mutation, targeted
  smoke и golden crop;
- интеграция с #270 и осознанное принятие новых baselines;
- каноническая документация и оба changelog.

### Не входит

- изменение сохранённых rooms/walls/open spans/openings;
- Optimize data cleanup #273;
- удаление independent bodies;
- повышение общего pixel-diff порога либо попытка поймать дыру только порогом;
- отказ от `R = 1.25 × H` или возврат неограниченного mitre-spike;
- округление/скругление bevel, новый визуальный стиль стен;
- backend, schema/model version, i18n и UI.

## 6. Геометрический контракт

### 6.1 Required solid и внешний фон

Для canonical node степени `3+` берутся конечные положительные physical rays.
Zero-depth, virtual/open rays material не добавляют. Required local solid —
связная область конечных ray strips и допустимого node join внутри canonical
paper/exterior envelope.

Из required solid можно удалить excessive mitre area за `R`, только если
результат образует внешний bevel: удалённая область должна быть связана с
внешним фоном относительно локального physical contour. Cut не может оставить
закрытый пустой остров между полосами стен.

Следствия:

- node core и каждый incident positive ray area-connected;
- local masonry не содержит polygon hole, целиком окружённый required solid;
- straight bevel может иметь discarded-wedge probe #249 снаружи contour;
- отсутствие hole не означает заливку всего квадратного mask;
- область вне finite ray/support #271 не материализуется.

### 6.2 Masonry и paper

`roomGeom`, final `geom` и `paperGeom` имеют одну physical boundary около node.
Paper покрывает canonical masonry и room centre, но не маскирует masonry-hole
белой накладкой. Final independent bodies/opening cuts сохраняют действующий
порядок и не используются для сокрытия дефекта room-wall join.

### 6.3 Семантическое определение hole

Тест не равняет «любую пустую точку в окне» дыре. Для каждого fixture/node:

1. задаётся bounded local window, пересекающее все incident strips за join;
2. классифицируются physical fill и пустота реальным geometry/SVG API;
3. пустые samples считаются внешним фоном только тогда, когда их компонент
   связности достигает границы local window, не пересекая вычисленный union
   конечных incident ray strips и node core;
4. оставшиеся связные компоненты внутри required-solid envelope — holes;
5. ожидаемое число holes для непрерывного T/X node равно нулю.

Exterior здесь не назначается fixture-аннотацией. Он вычисляется из той же
finite physical geometry и связности пустого пространства; поэтому тест не
может «объявить» запертую полость допустимым сектором. Discarded wedge #249
проходит классификацию только если у него действительно есть путь к границе
окна, а не по заранее записанному исключению.

Pure vector test дополнительно проверяет polygon rings/area, browser inventory
проверяет фактический path после рендера. Raster pixel threshold не заменяет ни
одну из этих проверок.

### 6.4 Clean floor и physics

Clean floor не присваивает площадь стены комнате, а light/sun barrier не имеет
прохода там, где masonry сплошная. Все consumers используют один canonical
node; отдельный white patch поверх SVG запрещён.

### 6.5 Детерминизм и failure isolation

Rooms/walls order, reversed endpoints, winding и duplicate shared owner не
меняют geometry/hole inventory. Ошибка одного optional node изолируется по
контракту #197; обязательный structural boolean failure остаётся fail-dark.

## 7. Compatibility, UX, touch, security и performance

- Config/layout/model version не меняются, вход не мутируется.
- Legacy/canonical wall keys #258 дают одинаковую topology.
- Новых controls, i18n, focus/keyboard/touch/ARIA нет.
- Новых HA данных, URL/HTML, permissions и security boundaries нет.
- Semantic inventory исполняется в tests/golden harness, а не на каждом
  production frame. Product geometry остаётся в cached structural pass без
  нового state-tick traversal и без глобального pairwise `O(E²)`.

## 8. Acceptance criteria и доказательства

### AC1. Все реальные классы node не имеют запертых holes

Minimized fixtures из обоих экспортов содержат как минимум:

- rectilinear T с тремя равными half-depth;
- T со смешанной толщиной;
- X/degree-4;
- короткий incident ray после/вместе с finite-ray #271;
- normalized `cell_cm: 5` и high-resolution `cell_cm: 1`.

Для каждого node vector inventory даёт `0` enclosed holes в `roomGeom`, final
masonry и paper; join связан со всеми rays.

**Доказательство:** `test/wall-thickness.test.mjs` и анонимная fixture.

### AC2. #249 остаётся ограниченным внешним bevel

Existing `discardedWedgeProbe` остаётся пустым; geometry не выходит дальше
`R + epsilon`; пустая область probe связана с внешним сектором, а не заперта
внутри стены. `MITRE_LIMIT`/`MULTI_WALL_JOIN_LIMIT` не меняются без отдельного
решения.

**Доказательство:** существующий #249 vector unit плюс новая проверка
connected-component inventory в `test/wall-thickness.test.mjs`.

### AC3. #261 и #271 не регрессируют

`retainedWedgeProbe` #261 заполнен в masonry/paper и не становится clean floor.
Finite short ray не удлиняется ради закрытия hole. Zero-depth interval не
материализуется. Existing #197 failure-isolation остаётся зелёным.

**Доказательство:** существующие #197/#249/#261 и finite-ray #271 unit,
mutation и targeted smoke probes.

### AC4. Browser surfaces показывают один непрерывный узел

Targeted production-bundle smoke проверяет hole inventory настоящим
`isPointInFill()` для Plan/View/kiosk и Static. Hidden Iso source и light/sun
barriers не имеют прохода/разрыва. Theme, hover и HA update не меняют
structural fingerprint.

**Доказательство:** targeted production-bundle multiwall/junction smoke с
настоящим SVG `isPointInFill()` и geometry inventory для Iso/barriers.

### AC5. Golden больше не может принять белый клин

Для `multiwall-junction-bevel-view-dark` и новых minimized real scenes:

- semantic inventory выполняется до pixel comparison;
- `enclosedHoles`/эквивалентный contract равен нулю для перечисленных nodes;
- добавление одного локального hole переводит сцену в error независимо от его
  доли кадра;
- stale pre-fix baseline не принимается автоматически.

Если #270 уже слита, её временное значение `2` заменяется product contract, а
не сохраняется ради зелёного теста. Если не слита, реализация переносит её
полезный inventory без дублирующих механизмов.

**Доказательство:** `demo/golden/harness.mjs`, matrix scenarios и
`test/golden-matrix.test.mjs`; targeted Linux semantic golden verify.

### AC6. Мутант воспроизводит слепой класс

Mutation возвращает текущую pairwise реконструкцию/один из holes. AC1 или AC5
обязаны падать. Отдельно доказывается, что single retained/discarded probes
могут остаться зелёными, то есть новый inventory действительно сильнее.

**Доказательство:** отдельная исполняемая запись `scripts/mutation-gate.mjs`,
которая обязана покрасить AC1/AC5 при зелёных legacy single-point probes.

### AC7. Privacy и determinism

Полные пользовательские экспорты и имена комнат не коммитятся. Permutations,
reversed intervals, повторный расчёт и оба coordinate scales дают одинаковые
semantic outcomes без мутации input.

**Доказательство:** анонимные minimized table-driven units с deep-equal
permutation/scale signatures и проверкой неизменности сериализованного input.

### AC8. Локальные гейты реализации

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- `node scripts/check-docs.mjs`;
- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` и все выбранные
  targeted smokes;
- mutation для enclosed hole;
- targeted semantic golden verify.

Полные smoke/golden/performance и Linux HA harness — prerelease gates.

## 9. Ожидаемые файлы

Product code:

- `src/wall-thickness.ts`.

Tests/evidence:

- `test/wall-thickness.test.mjs`, minimized fixture;
- targeted multiwall smoke;
- `demo/golden/harness.mjs`, `matrix.mjs`, `run.mjs` и matrix unit;
- `scripts/mutation-gate.mjs` и registries;
- координация с веткой/реализацией #270 без параллельных inventory helpers.

Документация:

- `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 10. Release-артефакты

Implementation-коммит имеет `Issue: #272`, `User-Visible: yes` и оба changelog.
Golden baseline `multiwall-junction-bevel-view-dark` и новые scenes принимаются
только из полного Linux artifact после независимого просмотра. При изменении
visual fingerprint docs screenshots также переснимаются Linux workflow и
принимаются штатной reviewed-командой. Перед beta обязательны полный golden,
smoke, performance и exact-SHA Validate.

## 11. Риски и меры

| Риск | Мера |
|---|---|
| «Закрыть дыру» возвратом длинного spike | AC2 и exterior-connectivity contract. |
| Залить внешний фон вокруг T | §6.3 различает exterior-connected emptiness и hole. |
| Маскировать дефект только paper | AC1/AC4 проверяют masonry, paper, floor и barriers. |
| Golden снова пройдет по общему порогу | Semantic inventory до pixel diff и mutant. |
| Конфликт с #270/#271 | Один inventory implementation; рекомендуемый порядок merge: #271, затем #272, затем обновление #270 evidence. |

## 12. Rollback

Откатывается product geometry вместе с vector/browser inventory, mutation,
golden baselines и документацией. Нельзя оставить baseline нового сплошного
стыка при старом коде или временное `enclosedHoles: 2` после нового кода.
Миграции данных нет.

## 13. Принятые технические предположения

1. Правильный критерий — не «закрасить любой белый пиксель», а исключить
   interior-connected hole при сохранении внешнего bounded bevel.
2. Конкретный boolean algorithm выбирается реализацией; тестовый topology
   contract обязателен.
3. #270 используется как инфраструктурная основа, но её временное ожидаемое
   число не является продуктовым решением.
4. #271 рекомендуется слить первой, чтобы hole repair работал на конечных rays
   и не закреплял ложные длинные rectangles.
5. Продуктовых вопросов нет: владелец явно признал видимые белые треугольники
   артефактами, а сохранение exterior clamp уже зафиксировано #249.
