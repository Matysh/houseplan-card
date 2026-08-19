# Код-ревью #201 — r1

- Issue: [#201](https://github.com/Matysh/houseplan-card/issues/201)
- ТЗ: [docs/specs/201-atomic-thickness-lookup.md](../specs/201-atomic-thickness-lookup.md)
  (ревью ТЗ зелёное: [SPEC-REVIEW-201-r1.md](SPEC-REVIEW-201-r1.md))
- Диапазон: `git log --oneline origin/dev..HEAD`
  - `f7abf14` fix: inherit parent thickness for atomic walls (`Issue: #201`, `User-Visible: yes`)
  - `8b8b9ed` docs: review document for #201 (`Issue: #201`, `User-Visible: no`)
  - `7b759f3` docs: specify atomic wall thickness lookup (`Issue: #201`, `User-Visible: no`)
- Роль: ревьюер кода, свежая сессия без контекста реализации.

## Скоуп

Баг: `thicknessCmAt()` возвращал 0 для атомарного child-сегмента, покрытого
более длинной exact wall-записью, из-за чего единственный продуктовый
потребитель — `thicknessOnClose()` в `src/open-spans.ts` — терял реального
соседа и подставлял `DRAW_WALL_DEFAULT_CM` (15 см) вместо фактических 20/22 см
при закрытии виртуальной границы, разделённой третьей комнатой. Скоуп по
non-scope ТЗ: только `thicknessCmAt()` + regression-покрытие; `wallIntervals()`,
`cmsForPoly()`, рендер, schema, Optimize (#198) не трогаются.

Относится к J4/J6 (`docs/SCOPE.md`): «Keep the plan true as the home evolves» —
Close не должен незаметно подменять сохранённую физическую толщину значением
по умолчанию.

## Как проверялось

Дешёвые гейты прогнаны лично, не только по слову автора:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | `912/912`, `fail 0` — совпадает с заявленным |
| Build | `npm run build` | зелёный |
| Bundle parity | `sha256sum dist/... custom_components/.../houseplan-card.js demo/srv/assets/houseplan-card.js` | все три `35ad6b54...a89e` — совпадает с хендоффом |
| Docs gate | `node scripts/check-docs.mjs --external` | `Documentation checks passed (7 files, 10 external links)` — уместен, т.к. коммит трогает `docs/images/screenshots.json` |
| Mutation gate | `node scripts/mutation-gate.mjs --check` | все записи `ok`, включая новую `atomic-child-thickness-parent-fallback` |
| Targeted smoke | `node demo/smoke_resize_virtual_thick.mjs` (после свежего `npm run build` + copy) | все поля `true`, включая три новых `atomicParentClose*`, `OK` |

**Тест умеет падать — проверено исполнением, не по слову автора.** Временно
откатил `src/wall-thickness.ts` до состояния `origin/dev` (`git apply -R` на
diff файла), пересобрал `test-build` (`npx tsc -p tsconfig.test.json && node
scripts/fix-test-build.mjs`) и прогнал:
`node --test --test-name-pattern="exact parent|atomic solid children" test/wall-thickness.test.mjs test/open-spans.test.mjs`
— оба новых теста красные (`0 !== 20`, `15 !== 22`). Затем `git checkout --
src/wall-thickness.ts`, пересобрал `test-build`, `node --test
test/wall-thickness.test.mjs test/open-spans.test.mjs` → зелёные (`97` тестов,
`0` fail), рабочее дерево чистое (`git status --short` пусто) — эксперимент не
оставил следов.

Читал построчно: `thicknessCmAt()`, новый приватный `exactCoveringWall()`,
`entrySpan()`, `distToSeg()`, `angleClose()`, `segAngle()`, и параллельно —
`cmsForPoly()` (уже существующий алгоритм «наиболее узкий покрывающий exact
span», строки 1081–1099/1107–1140), чтобы убедиться, что новый helper —
переиспользование того же контракта, а не новая независимая эвристика.
Читал `thicknessOnClose()`/`applyThicknessOnClose()` в `src/open-spans.ts` —
diff по этому файлу пуст, что ожидаемо: единственный вызов уже шёл через
`thicknessCmAt()`, фикс на уровне resolver'а автоматически чинит потребителя.

## Гейты, которые НЕ прогонял, и почему

- **`node demo/smoke_*.mjs` (остальные 126 из 127).** Diff ограничен одной
  чистой функцией с одним продуктовым потребителем внутри `src/wall-thickness.ts`;
  AC7/AC8 сами называют только `smoke_resize_virtual_thick.mjs`. Остальные
  smoke не касаются `thicknessCmAt`/Close и не входят в затронутые поверхности
  ТЗ (§4/§9).
- **`npm run golden:verify`.** ТЗ прямо говорит golden не обязателен (§10.2):
  видимая форма уже численно проверена browser-смоуком, общий wall renderer
  (`wallIntervals()`/`cmsForPoly()`/body geometry) не менялся. Диф
  `docs/images/screenshots.json` — только пересчитанный `sourceFingerprint`
  под изменившийся `src/**`, `imageSha256` не менялся ни для одного сценария
  → новой визуальной сцены нет.
- **`python -m pytest tests_backend -q`.** Диапазон не касается
  `custom_components/**/*.py` (см. таблицу файлов diff) — backend гейт не
  относится к этой задаче.
- **performance-профили.** Не названы в AC, риск в ТЗ явно закрыт (§11: поиск
  идёт только при editor Close, линейный проход сравним с существующим lookup,
  вне render tick) и не затрагивает горячий путь рендера.

Это сужение соразмерно объёму: один pure-helper и один тестовый/smoke файл;
полный набор гейтов — предрелизный, а не гейт код-ревью (PROCESS.md §8).

## Проверка AC (ТЗ §9)

| AC | Как доказано | Вердикт |
|---|---|---|
| AC1 | `wall-thickness.test.mjs`: `thicknessCmAt inherits the narrowest exact parent...` — прогнан, зелёный; откатом кода воспроизведён красным (`0 !== 20`). | Доказано автотестом, тест умеет падать. |
| AC2 | Тот же тест покрывает `coordScale = 1` и `1000` и обратное направление endpoints — прогнан в составе `npm test`. | Доказано автотестом. |
| AC3 | `thicknessCmAt exact-parent fallback does not leak from partial or unrelated spans` — partial `[0..4]`→`[0..10]`, parallel offset, perpendicular, malformed (`a:['bad',0]`, вырожденный `[0,0]-[0,0]`) — все дают 0; прогнан в `npm test`. Прочитан код: `entrySpan()` отбрасывает нечисловые/неполные endpoints, `spanLen<1e-12` и `spanLen+tol<queryLen` отсекают частичный/вырожденный случай до входа в `distToSeg`. | Доказано автотестом + чтением guard-условий. |
| AC4 | `nested` case в том же тесте: два кандидата (10-см родитель и 20-см вложенный `[4,0]-[6,0]`), прогнан для `nested` и `[...nested].reverse()` — оба дают 30 (узкий кандидат). Прочитан tie-break: `extra = spanLen-queryLen`, при равенстве — лексикографический `stable` (key+cm+координаты), не зависит от порядка входного массива. | Доказано автотестом + чтением. |
| AC5 | Существующие unit на legacy key-only lookup (`lookupWall finds an entry...`) прошли без изменений в `npm test` (912/912); `entrySpan()` возвращает `null` при отсутствии `a/b`, поэтому legacy-строки физически не могут попасть в новый fallback. | Доказано регрессией + чтением. |
| AC6 | `open-spans.test.mjs`: новый тест (parent 22 см → 22) плюс уже существующий `thicknessOnClose uses neighbour cm else default` (без толстого соседа → `DRAW_WALL_DEFAULT_CM`) — оба зелёные в `npm test`; новый воспроизведён красным при откате (`15 !== 22`). | Доказано автотестом, тест умеет падать. |
| AC7 | `node demo/smoke_resize_virtual_thick.mjs` после свежего build+copy — `atomicParentClosePreviewInherits`, `atomicParentClosePersistsNeighbourCm`, `atomicParentCloseUndo` все `true`, скрипт завершается `OK` (сценарий явно проверяет отсутствие console/page ошибок — общий паттерн файла, остальные 19 полей смоука тоже `true`, регрессий не внесено). | Доказано исполнением browser smoke. |
| AC8 | Тот же прогон smoke — все 19 ранее существующих полей (realBodyReady…virtualTJunctionMitred) остались `true`; `npm test` 912/912 без регрессий вне нового кода. `wallIntervals()`/`cmsForPoly()`/render не изменены (diff пуст по этим функциям). | Доказано регрессией + чтением diff (не тронуты). |
| AC9 | `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` (в том же коммите `f7abf14`, `User-Visible: yes`), `docs/TESTING.md` — все три diff проверены построчно, формулировки соответствуют факту фикса. | Проверено чтением diff. |
| AC10 | `node scripts/mutation-gate.mjs --check` — запись `atomic-child-thickness-parent-fallback` в списке `ok`; guard-команда мутанта (`--test-name-pattern="exact parent\|atomic solid children"`) — именно те тесты, которые я лично воспроизвёл красными при откате фикса. Мутант превращает `exact` в `false ? ... : null`, то есть буквально отключает новый fallback. | Доказано исполнением + чтением патча мутанта. |
| AC11 | `npx tsc --noEmit`, `npm test`, `npm run build`, `node demo/smoke_resize_virtual_thick.mjs` — все зелёные лично. | Доказано исполнением. |

## Находки

Нет находок ни High, ни Medium, ни Low.

Отдельно проверено на предмет типичных ошибок такого рефакторинга и не
подтвердилось:
- **Дублирование логики без переиспользования.** Новый `exactCoveringWall()` —
  не копия, а тот же containment-контракт (`distToSeg` двух endpoints ≤ tol,
  `angleClose`, `spanLen ≥ queryLen - tol`), что и уже работающий блок
  `cmsForPoly()` (строки 1081–1099). Общие `entrySpan`/`angleClose`/`segAngle`/
  `distToSeg` не продублированы, а вызваны из обоих мест.
- **Тихая утечка толщины через legacy fallback.** Проверено: `entrySpan()`
  требует валидных `a`/`b`; legacy `{key,cm}`-строки не имеют `a`/`b` и
  физически не проходят в `exactCoveringWall()`.
- **Ложно-зелёный мутационный гейт.** Проверил вручную (не только по выводу
  `--check`): без фикса именно эти два новых теста падают, с фиксом — проходят;
  guard мутанта запускает ровно их.

## Что проверено и корректно

- Причинно-следственная цепочка дефекта, описанная в ТЗ §3, подтверждена
  чтением: единственный продуктовый вызов `thicknessCmAt()` — из
  `thicknessOnClose()`; фикс на уровне resolver'а автоматически чинит
  потребителя без изменений в `open-spans.ts` (diff файла пуст).
- Все 11 AC ТЗ имеют явное доказательство и я его воспроизвёл лично там, где
  это было унит/smoke/mutation-тест; там, где доказательство — «не менялось» я
  сверил diff'ом.
- Три копии бандла (`dist/`, `custom_components/houseplan/frontend/`,
  `demo/srv/assets/`) байт-в-байт идентичны и совпадают с SHA, заявленным в
  хендоффе.
- Трейлеры `Issue:`/`User-Visible:` на всех трёх коммитах корректны;
  `User-Visible: yes` в `f7abf14` сопровождён правками обоих changelog в том же
  коммите.
- Изменение `docs/images/screenshots.json` — только `sourceFingerprint`
  (пересчитан от изменившегося `src/**`), `imageSha256` не менялся ни в одном
  сценарии; новой визуальной сцены нет, golden обоснованно не запускался.
- Non-scope ТЗ выдержан: `wallIntervals()`, `cmsForPoly()`, схема, Optimize/#198
  не тронуты.

## Чего не проверял

- Полный набор `demo/smoke_*.mjs` (126 из 127) — не относятся к затронутой
  поверхности, см. таблицу гейтов выше.
- `npm run golden:verify` — не запускал; обоснование — отсутствие изменения
  `imageSha256` и явное «golden не обязателен» в ТЗ §10.2.
- `python -m pytest tests_backend -q` — Python-код не затронут.
- performance-профили — не названы в AC, риск закрыт архитектурно (поиск только
  на editor Close, вне render tick).
- Ручное взаимодействие с реальным HA-сервером — вне цикла ревью по процессу;
  за него отвечает исполненный browser smoke.

## Вердикт

Зелёный. Причина дефекта верна, исправление минимально и переиспользует
существующий проверенный алгоритм, регрессия доказана падающим до фикса
тестом (лично воспроизведено), утечка толщины исключена явным негативным
покрытием, потребитель (`thicknessOnClose`) чинится автоматически без
собственных изменений, все AC подтверждены исполнением или чтением с пометкой,
документация и changelog в том же коммите, гейты зелёные.
