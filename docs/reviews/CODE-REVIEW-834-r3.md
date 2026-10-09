# CODE-REVIEW-834-r3

Issue: #834 · Трек: ask · Заход: r3 · Блокирующих циклов использовано: 2/4

Материал: `a0d92bf6a34f684e540c41ae59f05c2836b45792` (рабочая копия на нём),
диапазон `origin/dev..HEAD`:

```
a0d92bf6 perf: avoid repeated exact scaling and mid-preview layout flush
d4bd6e2c fix: reject crossings between newly spliced wall edges
ca1c000e docs: review document for #834
90d8702e perf: reuse unchanged node baselines and diff preview styles
a249d62d fix: reuse proved local node geometry to reduce drag work
7c40a4a6 fix: preserve wall operand ownership during numerical retry
02aaa29f docs: review document for #834
d9dfc471 fix: retain native node capture and presented camera
5b4c8f56 perf: prune proved redundant node geometry work
a032feb9 perf: add headroom to connected-node dragging
45c33ee6 fix: stabilize and accelerate connected-floor node dragging
```

Между r2 (материал `90d8702e`) и r3 ветка один раз возвращалась в `S6`
**CI-only**: Validate на `d4bd6e2c` (run `37881199359`) провалился только по
трём perf-лимитам нативного жеста (CPU p95 50.2/50 мс, input→paint p95
109.858/100 мс), код никто не читал, цикл модели не израсходован — это
совпадает с заявлением автора в хендоффе и с правилом «красный CI всё равно
вернул бы задачу, но уже после потраченного ревью» (#510). Фактический
предмет r3 — дельта после материала r2: два коммита, `d4bd6e2c` и `a0d92bf6`
(`ca1c000e` — только документ ревью r2, class C, повторно не разбирается).

## Скоуп дельты

- `d4bd6e2c` — закрытие единственной находки r2 (Medium,
  `src/wall-boundary-splice.ts:183-207`, `safeAddedEdges` не проверял added×added
  пересечения).
- `a0d92bf6` — узкая perf-правка по итогам провала native-лимитов на
  `d4bd6e2c`: переиспользование уже построенной точной координатной карты
  predicates для знака площади кольца (`areaSign`) вместо повторного парсинга
  десятичных чисел, и перестановка `this.render(true)` в `paint()` до
  коммитов paper/room SVG-слоёв (устранение read-after-write чтения
  viewport-ширины).

Обе правки точечные (25 строк в `wall-boundary-splice.ts` + 5 строк в
`wall-node-editor.ts` продуктового кода), без новых модулей и без смены
контракта → делаю разбор по дельте (§2.10), а не полный повторный разбор
всей задачи.

**Риск по изменённым участкам (#707):** класс **geometry** —
`src/wall-boundary-splice.ts` (`safeAddedEdges` added×added проверка,
переиспользование `areaSign`) — прямо закрыт AC2 ТЗ («небезопасные позиции
остаются запрещены... защитные AC имеют таблицу отрицательных проб и mutant
anchors»); класс **perf** — `src/wall-node-editor.ts` (порядок
`render(true)`/коммитов SVG-слоёв в `paint()`) — закрыт AC3/AC4 ТЗ
(«тяжёлая работа/paint объединяется в animation frame», «p95 main-thread
candidate+proof+paint ≤50 мс и p95 input→paint ≤100 мс»). Оба класса из
списка задачи покрыты AC — пробела не нашёл, `route: fix`.

## Как проверялось

Читал оба коммита построчно (полный `git show d4bd6e2c` и `git show
a0d92bf6`), проследил:

1. **`safeAddedEdges`** (`wall-boundary-splice.ts:183-213`) — что `checked`
   теперь инициализируется retained-рёбрами и после каждой успешной проверки
   очередного `next` добавляет его в `checked` (`checked.push({ ...next,
   box })`), то есть каждая пара added×added сравнивается ровно один раз (при
   обработке более позднего ребра относительно более раннего), без сравнения
   ребра с собой.
2. **Новые тесты** `test/wall-boundary-splice.test.mjs` (5 новых: self-cross
   одного кольца, пересечение двух outer rings, наложение коллинеарных
   added-рёбер, endpoint-interior контакт, легитимный общий endpoint) — что
   каждый негативный сценарий подтверждён независимым оракулом (`union`/
   `strictlyCross`/`cross`), а не просто «вернул null».
3. **Два новых mutant-якоря** в `scripts/mutation-registry.mjs`
   (`node-boundary-splice-skips-new-edge-safety`,
   `node-boundary-splice-checks-added-against-retained-only`) — что патчи
   точно соответствуют строкам кода на этом SHA.
4. **`areaSign` reuse** (`a0d92bf6`, `wall-boundary-splice.ts:182-193`) — что
   общая `scaled`-карта (BigInt-координаты, один общий положительный
   масштаб на все точки `resultEdges`) математически сохраняет знак
   shoelace-суммы при любом общем положительном масштабировании, и что
   `trimAxisSubdivisions` (строки 112-131) только удаляет коллинеарные точки,
   поворачивает список и копирует существующие координаты
   (`[point[0], point[1]]`) — никогда не создаёт новое числовое значение,
   которого нет в исходной карте `scaled` → `scaled.get(...)!` не может
   получить `undefined` для точек реконструированного кольца.
5. **Перестановка `render(true)`** в `paint()` (`wall-node-editor.ts:399-430`)
   — что `s.outline` вычисляется (строка 418) ДО нового места вызова
   (строка 421), то есть `render(true)` по-прежнему видит актуальное
   состояние сессии; что сам `render()` не читает DOM-состояние
   `liveRoots[0]`/`liveRoots[1]` помимо `this.port.unitsPerPixel()` —
   единственного источника read-after-write, который и убирает правка.
6. **Новый тест** `test/wall-node-paint.test.mjs` («retained node layers read
   viewport scale before committing paper, rooms or live SVG») — что мок
   `unitsPerPixel` сам проверяет `dirty === false` на каждом чтении
   (`dirty` становится `true` после первого `_$AI`-коммита), то есть тест
   по конструкции ловит именно read-after-write, а не произвольный порядок.
7. Трейлеры (`Issue:`/`User-Visible:`), changelog (оба файла в тех же
   коммитах, без конкретных чисел — дублирования одной цифры в двух
   источниках нет), `docs/ARCHITECTURE.md`/`WALL-THICKNESS.md`/
   `DEVELOPMENT.md`/`STATUS.md` на непротиворечивость с кодом.

### Независимая проверка «тест умеет падать» (исполнением, не только чтением)

Я не гонял реестр мутаций целиком (на `ask` в разработке он не гоняется,
#709) — но обе новые защитные линии проверил сам, применив РОВНО патчи
мутантов к `src/wall-boundary-splice.ts` и временную правку к
`src/wall-node-editor.ts`, собрав тестовый билд и прогнав целевые тесты;
после проверки каждый файл восстановлен (`git checkout --`), рабочее дерево
подтверждено чистым (`git status --short`):

| Правка | Мутация/откат | Команда | Результат |
|---|---|---|---|
| `safeAddedEdges` не отключён | `if (false && !safeAddedEdges(...)) return null;` (= `node-boundary-splice-skips-new-edge-safety`) | `node --test --test-name-pattern="added edges cannot self-cross inside one reconstructed ring" test/wall-boundary-splice.test.mjs` | **FAIL** (`1 !== null`) — тест ловит отключение |
| added×added накопление не убрано | `checked.push(...)` → комментарий (= `node-boundary-splice-checks-added-against-retained-only`) | `node --test --test-name-pattern="added edges cannot cross between two reconstructed outer rings" ...` | **FAIL** — тест ловит возврат к r2-дефекту |
| `render(true)` вызывается до коммита paper/room слоёв | откат к старому порядку (вызов `this.render(true)` инлайн в конце третьего `render()`) | `node --test --test-name-pattern="retained node layers read viewport scale before committing paper, rooms or live SVG" test/wall-node-paint.test.mjs` | **FAIL** (`true !== false`, «a viewport read after an SVG commit can force layout») |
| (контроль) текущий код без мутаций | — | те же три команды + полный `test/wall-boundary-splice.test.mjs` (17), `test/wall-node-paint.test.mjs` (28), и связка `wall-boundary-splice/wall-boolean-incremental/wall-boolean-cache/wall-intersection-signature/wall-node-editor/wall-node-paint/wall-node-card-adapter` (105 тестов) | **PASS** во всех случаях |

Это подтверждает: обе защитные линии реально проверяются исполняемым тестом,
который умеет падать при убранной защите, а не только «не бросило
исключение».

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: `safeAddedEdges` (`src/wall-boundary-splice.ts:183-207`) сравнивал новые рёбра только со старыми (`retained`), пара added×added никогда не проверялась; mutant-якоря на функцию не было | Накопительный `checked` (инициализация `retained`, затем `checked.push({ ...next, box })` после каждой успешной пары) — каждая пара added×added теперь проверяется ровно один раз теми же точными predicates, что added×retained | `d4bd6e2c`, `src/wall-boundary-splice.ts:183-213`; 5 новых тестов `test/wall-boundary-splice.test.mjs` (self-cross, two-outers, overlap, endpoint-interior, legit shared endpoint — все через `union`/`difference`-оракул); 2 новых mutant-якоря `node-boundary-splice-skips-new-edge-safety`/`node-boundary-splice-checks-added-against-retained-only` в `scripts/mutation-registry.mjs`. Я сам применил оба патча мутантов и подтвердил падение соответствующих тестов (таблица выше) |

## Унаследовано из r2

Из `docs/reviews/CODE-REVIEW-834-r2.md` (материал `90d8702e26ca973a5b8149d88f793579d680b60e`,
зелёный Validate run `37875962990`) — весь периметр, не затронутый дельтой
r3, принят без повторной проверки: закрытие r1 Medium (`sameWallOperandTopology`),
остальная часть `wall-boundary-splice.ts` (identity-карта рёбер, глобальный
bounding box, точный ориентационный тест added×retained, независимая
`validOutputHierarchy`), `wall-intersection-signature.ts`,
`wall-boolean-incremental.ts` (вынос сериализации в `apply()`), точный
ось-снэп `wall-thickness.ts`, переживание Esc в `wall-boolean-baseline.ts`/
`wall-node-card-adapter.ts`, дифф стилей превью в `syncPaint` (до строк,
изменённых `a0d92bf6`), View-изоляция через ленивый `import()`, бюджет
Select-only (14→18 KiB по разрешению владельца), трейлеры/changelog
коммитов r1/r2, backend parity, rAF/указатель/камера из r1. Также из r1
(через r2) — fail-closed численный retry `wall-shell-union.ts`/
`wall-operand-topology.ts`, Select-only шорткаты (`wall-quad-coverage.ts` и
соседи), `junction-limits.ts`/`houseplan-editor-runtime.ts` наблюдательный
колбэк `onRoomInnerContour`.

## Находки

Не найдено ни одной. Оба коммита дельты точечные, математически
обоснованные (перестановка чтения не меняет вычисляемое значение; общий
положительный масштаб не меняет знак shoelace-суммы; добавленная проверка
`same(p, a) || same(p, b)` в `orientation()` — не новое правило, а точный
нулевой результат, который и так дала бы полная BigInt-арифметика при
p равном одному из концов сравниваемого отрезка, подтверждено прохождением
всего прежнего набора тестов `safeAddedEdges`/`validOutputHierarchy` без
изменений), и обе снабжены исполняемыми тестами, которые я лично заставил
падать и чинил обратно (таблица выше). High: 0, Medium: 0.

## Что проверено и корректно

- **`safeAddedEdges` added×added** — см. таблицу закрытия r2 выше.
- **`areaSign` reuse (`a0d92bf6`)** — `predicates.areaSign` использует общую
  `scaled`-карту, построенную из точек `resultEdges` ПОСЛЕ применения
  removed/added (`wall-boundary-splice.ts:284`); `ring`, передаваемый в
  `trimAxisSubdivisions`, целиком состоит из точек, уже входящих в эту карту
  (обход `outgoing`/`incoming`, построенных из тех же `resultEdges`);
  `trimAxisSubdivisions` не создаёт новых числовых значений — только
  копирует существующие. Крах `scaled.get(...)!` на `undefined` невозможен.
  Новый тест `test/wall-boundary-splice.test.mjs` («boundary area keeps exact
  decimal signs through cancellation and mixed coordinate scales») отдельно
  подтверждает на реальном примере (`origin=1e8`, `ulp=2**-26`), что обычная
  `Number`-shoelace сумма теряет знак при сокращении разрядов, а точный путь
  — нет, и что `baselineSigns` (отдельный, независимый, вычисляемый один раз
  путь на `frozenResult`) сравнивается с новым точным знаком корректно: я
  прочитал оба определения `areaSign` — модульное (строка 60, BigInt per-ring,
  используется только для `baselineSigns` на подготовке) и
  `predicates.areaSign` (переиспользует уже построенный общий масштаб) — и
  подтвердил, что оба всегда точные, различается только степень
  переиспользования готовой координатной карты, а не точность.
- **Перестановка `render(true)` в `paint()`** — `s.outline` вычисляется до
  нового места вызова; `render()` не зависит от DOM-эффектов
  `render(scene?.paper...)`/`render(scene?.rooms...)`, кроме одного чтения
  viewport через `unitsPerPixel()`, которое правка и переносит до любых
  SVG-коммитов. Подтверждено тестом и моим ручным откатом (таблица выше).
- **Доказательство AC4 после возврата CI.** Хендофф автора называет точную
  причину прошлого красного Validate (`37881199359`: CPU p95 50.2/50 мс,
  input→paint p95 109.858/100 мс) и показывает, что узкая правка устраняет
  именно эти два источника лишней работы (повторный decimal-parsing и
  read-after-write layout), без изменения нативного протокола ввода или
  лимитов (`docs/DEVELOPMENT.md`/`docs/STATUS.md` правки непротиворечивы
  коду, числа не дублируются в changelog).
- **Трейлеры/changelog.** Оба коммита дельты несут `Issue: #834` и
  `User-Visible: yes`; `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` правятся в
  тех же коммитах (проверено `git show --stat` на каждом), без повторения
  конкретных чисел — пользователю показан текст поведения, не метрика,
  дублирования цифры нет.
- **Отсутствие расширения скоупа.** `git diff --stat 90d8702e..a0d92bf6`
  — 12 файлов, из них только `src/wall-boundary-splice.ts` (+25/-11) и
  `src/wall-node-editor.ts` (+4/-1) — продуктовый код; остальное — доки,
  тесты, реестр мутантов, документ ревью r2. Новых модулей, новых
  публичных контрактов, новых пользовательских строк нет — соответствует
  «не-скоупу» ТЗ (никакого нового UX, физических лимитов, миграции).

## Чего не проверял

- **`npx tsc --noEmit` (основной конфиг), `npm run build` + сверка трёх
  копий бандла, `npm run golden:verify`, `node scripts/model-invariants.mjs`,
  `pytest tests_backend`/junction TS/Python parity, `node
  scripts/mutation-gate.mjs --check` (реестр целиком) — не перегонял сам.**
  Validate на точном SHA `a0d92bf6a34f684e540c41ae59f05c2836b45792` зелёный
  ([run 37885661469](https://github.com/Matysh/houseplan-card/actions/runs/37885661469),
  указан в задаче ревью) — дешёвые гейты сошлись на этом прогоне. Вместо
  повторного прогона я сделал точечную, но исполняемую проверку (tsc test
  build + таргетные `node --test` + два применённых патча мутантов, см.
  таблицу выше) непосредственно на изменённых дельтой файлах — она не
  заменяет `npm test` целиком, но подтверждает «тест умеет падать» для
  обеих новых/изменённых защитных линий сильнее, чем просто чтение кода.
- **Браузерный AC4-протокол (реальные 60×8 native pointer moves,
  calibration) и `smoke_wall_node_connected`.** Не исполнял сам в браузере;
  полагаюсь на «Смоки: все шарды зелёные» в составе зелёного Validate на
  этом SHA и на числовые таблицы автора в хендоффах (CPU p95 21.6 мс,
  input→paint p95 48.796 мс, long tasks 0 — все заявлены как локальные
  данные, не CI-числа, и явно помечены автором как таковые).
- **Полный HA-harness (`test_ha_*.py`) и его сборка.** Вне скоупа дельты (ни
  один файл `custom_components/**`/`tests_backend/**` в этой дельте не
  менялся), не проверялся.
- **Полные preset/golden/perf наборы и свежесть скриншотов документации.**
  Предрелизный гейт, не гейт ревью (§8); `check-docs.mjs` по заявлению
  автора сообщает только ожидаемый stale screenshot fingerprint — не гейт
  задачи (#697).
- **Черновик автора.** Не читается по правилам ревью кода (материал — только
  запушенная ветка на названном SHA).

## Вердикт

High: 0 · Medium: 0. Единственная находка r2 (`safeAddedEdges` не проверял
added×added пересечения, `src/wall-boundary-splice.ts:183-207`) закрыта
доказательно: сам применил оба предложенных мутанта к рабочей копии и
подтвердил, что новые тесты реально падают без правки и проходят с ней.
Последующая узкая perf-правка (`a0d92bf6`) математически не меняет
вычисляемые значения (общий масштаб сохраняет знак площади; перестановка
чтения viewport не меняет наблюдаемую сессией геометрию) и также снабжена
тестом, который я лично откатил и подтвердил падающим на старом порядке.
Новых находок нет. Зелёный вердикт, цикла не образует.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/834-node-geometry-performance`, коммит `a0d92bf6a34f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b48a8414f2ef263f68a49185946b92704acc33ea`
  ```
  git log --all --format='%H %T' | grep b48a8414f2ef
  ```
- Тело issue: `748943c2a398aa56ed4fe383b98244248d65da00d99180a3263b27037395bc87`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4312 output_tokens=31063 cache_creation_input_tokens=142492 cache_read_input_tokens=3454285 num_turns=41 -->
