# Код-ревью #223 — Optimize канонизирует координаты без floating-point шума

- Цикл: r1/4 (код-ревью; ТЗ прошло отдельный лимит и закрыто зелёным на r3)
- Диапазон: `git diff origin/dev...HEAD` (7 коммитов, `origin/dev..HEAD`)
- Реализация: коммит `38f74e0` (`fix: canonicalize near-grid coordinates exactly`,
  `Issue: #223`, `User-Visible: yes`) — единственный коммит с продуктовым
  изменением; предыдущие 6 коммитов — ТЗ и его ревью (r1–r3), уже закрыты
  отдельным циклом.
- ТЗ: `docs/specs/223-optimize-coordinate-canonicalization.md`, зелёное ревью
  `docs/reviews/SPEC-REVIEW-223-r3.md`.

## Скоуп проверки

Полный разбор — это первый цикл код-ревью, §2.10 (дельта по раундам) здесь не
применяется. Список изменённых файлов (`git diff origin/dev...HEAD --name-only`)
сверен построчно с §4/§12 ТЗ — расхождений нет, попутных правок нет:
`src/align-grid.ts`, `src/houseplan-card.ts`, `src/i18n/{en,ru}.json`,
`test/align-grid.test.mjs`, `test/plan-optimizer.test.mjs`, `test/i18n.test.mjs`,
`scripts/mutation-gate.mjs`, `demo/smoke_optimize_coordinate_canonicalization.mjs`,
`docs/{CANVAS,USER-GUIDE.ru,TESTING,STATUS,CHANGELOG,CHANGELOG.ru}.md`,
`docs/specs/README.md`, три копии бандла. `custom_components/**/*.py` не
тронут — контракт ТЗ («persisted schema и backend не меняются») подтверждён
структурой diff, не только текстом.

## Как проверялось (гейты)

Прогнано в этом цикле:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | pass, без вывода |
| Unit | `npm test` | `tests 975, pass 975, fail 0` |
| Build + сверка бандлов | `npm run build` затем `sha256sum dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js demo/srv/assets/houseplan-card.js` | все три файла — один и тот же хэш `3f7eaf824d79b33f190b9323e2d873aff7eb19d6eef7749488e96b39c76ad33a` (совпадает с хэшем из хендоффа автора) |
| Targeted browser smoke (AC6/AC7) | `node demo/smoke_optimize_coordinate_canonicalization.mjs` | `13/13 true`, `OK` |
| Смежные browser smoke (диф трогает общий `alignAllToGrid`/`snapN`, используемый этими сценариями) | `node demo/smoke_grid_snap.mjs` и `node demo/smoke_optimize_micro_interval.mjs` | оба `OK`, все проверки `true` |
| Mutation guard (AC1) | `node scripts/mutation-gate.mjs --id=snapn-returns-input-near-node` | `поймано 1 из 1` — мутант пойман, чистый прогон зелёный |
| Mutation registry hygiene | `node scripts/mutation-gate.mjs --check` | `ok snapn-returns-input-near-node` среди прочих, без ошибок уникальности `find` |
| Process gate (офлайн) | `node scripts/process-gate.mjs` | `гейт пройден, предупреждений 0` |

Не прогонялось и почему:

- **Полный набор из 127 браузерных смоков** — diff меняет ровно один
  batch-путь (`alignAllToGrid` внутри explicit Optimize) и явно поименованный
  смок плюс два смежных по тому же пути прогнаны выше; остальные 124 смока не
  затрагивают ни `align-grid.ts`, ни отчёт Optimize. Полный набор — предрелизный
  гейт (PROCESS.md §8), не гейт ревью.
- **`npm run golden:verify`** — diff не меняет разметку диалога (тот же
  `.alignmsg`, добавлена подстрока в уже существующий текст) и не двигает
  геометрию видимо: величина правки — доли `EPS` (≈4.2e-9 нормализованной
  единицы), она гарантированно ниже порога любого golden-снапшота. Само ТЗ
  §10 фиксирует это решение («Golden baseline не требуется... перед бетой
  выполняется общий golden verify по процессу»), и я согласен с этой оценкой
  после чтения diff.
- **`python -m pytest tests_backend`** — ни один файл
  `custom_components/houseplan/**/*.py` не тронут (подтверждено списком файлов
  выше).
- **performance-профили** — в AC не названы; изменение линейно по уже
  обходимым координатам, добавляет одну точную проверку на компонент; ТЗ §11
  явно снимает необходимость отдельного performance-гейта, и чтение
  `alignAllToGrid` (без новых циклов/аллокаций сверх O(1) на компоненту)
  подтверждает это.

## Находки

Находок, блокирующих или требующих правки в задаче, нет.

### Low — AC2 (неконечные числа) не имеет отдельного unit-доказательства

- **Файл:** `src/align-grid.ts:69-72` (`snapN`), контракт — AC2 в
  `docs/specs/223-optimize-coordinate-canonicalization.md:147`.
- **Что не так:** AC2 требует доказательства «boundary unit matrix» для двух
  утверждений: (1) значение дальше `EPS` продолжает выравниваться как раньше —
  это покрыто (`test/align-grid.test.mjs:48-50`, случай `off = node + S/3`);
  (2) «не конечные числа сохраняют прежний результат» — для этого в текущем
  наборе тестов нет ни одного `assert` на `NaN`/`Infinity`/`-Infinity`, ни в
  новых тестах, ни в уже существовавших (`git show origin/dev:test/align-grid.test.mjs`
  такого теста тоже не содержит).
- **Почему не блокирует:** строка `if (!Number.isFinite(v)) return v;`
  (`src/align-grid.ts:70`) в этом diff не менялась — это тот же guard, что был
  до задачи, и он был непокрыт тестом и раньше. Риск регрессии от этого diff
  нулевой: изменённая строка (`return Math.round(...)`) находится строго после
  guard и не может исполниться для нефинитного входа.
- **Решение ревьюера:** снимается без правки в этой задаче. AC2 по факту
  доказан читкой (guard не тронут), а не только тестом; отдельная задача на
  добавление такого unit-теста не заводится (тривиальная гигиена покрытия,
  не дефект поведения) — по желанию автора может быть добавлена заодно со
  следующей правкой этого файла.

## Проверено по AC (код-ревью отвечает за «оно вообще работает»)

| AC | Доказательство | Как проверено |
|---|---|---|
| AC1 | `test/align-grid.test.mjs:41-51` (юнит), мутант `snapn-returns-input-near-node` | Юнит прогнан зелёным в составе `npm test`; мутант отдельно прогнан и **пойман** (`scripts/mutation-gate.mjs --id=...` → `1 из 1`) — тест умеет падать. |
| AC2 | Юнит на `off`-случай зелёный; неконечные числа — см. находку Low выше | Частично тестом, частично чтением (guard не тронут). |
| AC3 | `test/plan-optimizer.test.mjs:75-107` (six-room ULP fixture), `unionBodies` | Юнит зелёный в `npm test`; проверено, что тест реально утверждает `moved:0, maxShift:0, coordsCanonicalized>0, changed:true` и что `unionBodies` не падает на результате — тест умеет падать (до фикса `snapN` возвращал `v`, координаты остались бы носящими шум, `coordsCanonicalized` был бы `0`, `assert.ok(... > 0)` покраснел бы). |
| AC4 | `test/align-grid.test.mjs:53-94` (poly/rect/partition accepted+rejected/wall_column/decor/marker) | Юнит зелёный; читкой кода (`src/align-grid.ts:264-291`) подтверждено, что вклад партиции считается **после** ветвления `hostedFit`, а не на входе в `snapN` — ровно то, что требовал r1 ревью ТЗ. Тест явно проверяет, что `partitions[1].a[0]` (`hostedFit=false`) остаётся `noisy`, а счётчик не растёт от неё (`coordsCanonicalized === 8`, вручную пересчитано по фикстуре — сходится). |
| AC5 | `test/align-grid.test.mjs:158-162`, `test/plan-optimizer.test.mjs:101-106` | Юниты зелёные, оба проверяют `coordsCanonicalized: 0` и `changed: false` на повторном проходе, включая глубокое равенство. |
| AC6 | `test/i18n.test.mjs:30-40`, targeted smoke | i18n-юнит проверяет ровно обе строки RU/EN и обе точки использования в `houseplan-card.ts` через regex по исходнику; smoke проверяет реальный рендер (`previewNamesBothReportUnits`, `toastExplainsZeroMoveCleanup`) — оба зелёные при прогоне выше. |
| AC7 | `test/plan-optimizer.test.mjs:83` (`assert.deepEqual(config, before, ...)`), smoke | Юнит на немутацию preview зелёный; smoke подтверждает Cancel/Apply/Undo на реальном диалоге (`previewDoesNotWrite`, `cancelDoesNotWrite`, `applyUsesOneAtomicWrite`, `undoRestoresExactNoisyValues`, `undoIsOneDeep`) — все `true` в прогоне выше. |
| AC8 | Чтение: `grep -rn "alignAllToGrid\|snapN(" src/*.ts` | `alignAllToGrid` вызывается ровно из одного места — `plan-optimizer.ts:398`, внутри `optimizePlans()`, который сам вызывается только явным `_runAlignToGrid`/`_openAlignDialog` (нет вызовов из пути save/render). Проверено чтением, не исполнением. Полный `npm test` (975/975) зелёный, включая существующие тесты #218. |
| AC9 | `git diff` по docs, `sha256sum` трёх бандлов | Документация обновлена по списку §12 ТЗ; хэши бандлов идентичны (см. таблицу гейтов). |
| AC10 | Таблица гейтов выше | typecheck/unit/build/targeted-smoke/mutation — все зелёные. |

## Что проверено и корректно (сверх таблицы AC)

- **Архитектура счётчика.** `noteCanonicalCoordinate`/`noteCanonicalPoint`
  (`src/align-grid.ts:157-166`) считают вклад строго по значению, реально
  записанному в candidate: для `room_drafts` вклад учитывается только для точек,
  попавших в итоговый `draft.points` (`written` строится параллельно с `points`,
  включая тот же dedup по `EPS`), и только когда сам draft не был отфильтрован
  фильтром `points.length >= 2` (иначе весь draft уходит в `removedDrafts`, а не
  в candidate). Для partition — вклад учитывается только внутри
  `if (snappedLength > EPS && hostedFit)`, то есть ровно в ветке, где `p.a`/`p.b`
  реально присваиваются.
- **Скрещённая проверка арифметики.** Вручную пересчитан фикстурный тест
  `near-node report counts only coordinate values actually written to the
  candidate` (`test/align-grid.test.mjs:53-88`): из восьми `noisy`-вхождений в
  фикстуре ожидаемый вклад — poly (1: только x первой вершины), rect (1: x
  дальнего угла через `x0+w0`), partition `accepted` (1), `wall_column` (1),
  decor `line`/`box`/`text` (по 1), marker (1) = 8, ровно то, что проверяет
  `assert.equal(result.report.coordsCanonicalized, 8)`. Партиция `rejected`
  корректно исключена.
- **`OptimizeReport` наследует поле честно.** `plan-optimizer.ts:38` —
  `OptimizeReport extends AlignReport`, а итоговый report собирается через
  `{ ...alignReport, ... }` (`plan-optimizer.ts:522`) без явного поля —
  `coordsCanonicalized` переносится автоматически, не задваивается и не
  теряется; `changed` в `optimizePlans()` вычисляется отдельно, через полное
  сравнение JSON конфигурации (`plan-optimizer.ts:513`), поэтому корректно
  становится `true` даже если единственная правка — ULP-чистка.
- **`moved`/`maxShift*` не растут от ULP-правок.** Это гарантирует не новый, а
  существующий `note()` (`src/align-grid.ts:181-187`, не изменён этим diff):
  `moved` увеличивается только при `d > EPS`. Новый код добавляет отдельный
  счётчик параллельно, не переиспользуя и не искажая этот путь.
- **UX-терминология.** Финальная строка `gs.optimize_changes` (RU: «обновлено
  пространств: {c}; устранён шум координат: {p}»; EN аналогично) разводит два
  счётчика без пересечения с занятым во всём проекте термином «нормализовано»/
  «канонизировано» из `docs/CANVAS.md` — ровно то решение, которое было
  согласовано на r2/r3 ревью ТЗ; я перечитал `docs/CANVAS.md:12,20,333,489,539`
  и не нашёл нового конфликта термина с этой формулировкой.
- **Итоговый toast** (`gs.align_done`, `src/houseplan-card.ts:14288-14291`)
  включает `coordsCanonicalized` в общую сумму обслуженных записей — предположение
  §13.4 ТЗ реализовано буквально.
- **Отсутствие побочных путей записи.** Подтверждено чтением (см. AC8), что
  `snapN`/`alignAllToGrid` недостижимы вне явного Optimize — обычные
  read/render/Save не подвергаются риску скрытой мутации персистентных данных.
- **Три копии бандла синхронны**, коммит несёт верные трейлеры, оба changelog
  правлены в том же коммите, что и поведение (`38f74e0`).

## Чего не проверял

- Полный browser-smoke набор (127 сценариев), `golden:verify`,
  `pytest tests_backend`, performance-профили — не прогонялись; причины и
  обоснование сужения — в таблице гейтов выше. Это решение ревьюера, а не
  молчаливый пропуск.
- Ручного визуального прогона карточки в браузере (открыть демо, покликать
  диалог глазами) не делал — заменён точечным browser-smoke и чтением
  рендер-кода; в процессе фазы ручного тестирования нет (PROCESS.md §2.7), и
  именно smoke здесь стоит на её месте.
- WSL/полный HA harness и Windows-специфичные smoke не запускались — сессия
  ревью работает в Linux CI-подобном окружении, что и предусмотрено процессом
  для код-ревью.

## Вердикт

Зелёный. High: 0. Medium: 0. Одна находка Low снята решением ревьюера с
записью (см. раздел «Находки») — правка не требуется.
