# Issue #291 — единый барьер записи lattice-координат

- **Issue:** https://github.com/Matysh/houseplan-card/issues/291
- **Статус:** первая редакция для внешнего ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** tech-debt / P1
- **Оценка:** пользовательская ценность 7/10; ценность для разработки 10/10;
  сложность 10/10; риск 10/10
- **Область:** frontend/backend config+layout persistence boundary, near-grid
  coordinate canonicalization, explicit Optimize report, imports/Undo/recovery,
  invariant and mutation gates
- **Модель данных:** JSON schema, Store/storage/model version и типы полей не
  меняются; координаты остаются numbers
- **Связано:** #198, #223, #224, #248, #258, #278, #282–#284,
  `docs/adr/282-wall-geometry-representation.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/CANVAS.md`

## 1. Сценарий и измеренная причина

Stage 0 (#283) показала, что на двух живых пространствах владельца 65,38% и
78,77% координат лежат рядом с узлом решётки, но не равны canonical double
этого узла. Худшее отклонение — `8×10⁻⁸` шага. Авторской off-grid geometry
почти нет.

Текущий storage barrier #224 округляет allow-listed numbers до девяти
десятичных знаков. Для шага `1/240` это создаёт стабильную десятичную запись,
но не canonical IEEE-754 result `Math.round(v×240)/240`. Поэтому независимые
пути вычисления одного узла получают разные bits: wall key уезжает в соседний
bucket (#258), а Optimize после round-trip снова видит работу (#248).

Смена schema на integer node ids для устранения этого явления не нужна.
Нужна одна boundary-функция, которую невозможно обойти обычным writer path.

## 2. Решения владельца

Зафиксированы в #284:

1. На lattice canonicalization распространяются и plan geometry, и позиции
   маркеров/room labels в layout.
2. Дальняя authored geometry не притягивается к узлу; она сохраняется и
   перечисляется в отчёте.
3. После migration и после произвольной editing session noise population
   должна быть нулевой.
4. Видимый отчёт Optimize остаётся компактным: общий счётчик исправленных
   координат и максимальный физический сдвиг, затем строки только для
   пространств, где действительно были изменения, с их счётчиками.
   Неизменённые пространства не перечисляются.

## 3. Пользовательский контекст и результат

**Кто и где:** владелец дома с несколькими этажами/пространствами, который
импортировал старый план либо продолжает редактировать его в Plan. Проблема
проявляется в обслуживающем действии Optimize и после обычной записи geometry,
хотя на экране субпиксельный хвост координаты неразличим.

**До:** один визуальный узел может иметь разные double-биты в зависимости от
истории вычислений. Пользователь видит повторную «работу» Optimize, неверный
wall key или последующий дефект стыка, но не может связать его с координатным
шумом.

**После:** любой сохранённый config/layout не содержит near-node noise. Обычная
запись убирает только измеренный невидимый хвост без перемещения authored
off-grid geometry. Перед явным Optimize пользователь видит отдельное от
физических перемещений описание координатной очистки, решает Confirm/Cancel и
получает один Undo. В доме с несколькими этажами отчёт показывает общий итог и
только затронутые пространства, не превращая диалог в полный технический лог.

## 4. Термины и scalar contract

### 4.1 Одна решётка и одна граница noise

- `GRID_N = 240`, canonical node: `Math.round(value × GRID_N) / GRID_N`;
- deviation измеряется в шагах:
  `abs(value × GRID_N − round(value × GRID_N))`;
- `exact`: deviation строго `0`;
- `noise`: `0 < deviation < 1e-4` шага;
- `off-grid`: deviation `>= 1e-4` шага.

`1e-4` — существующая измерительная граница Stage 0 и единый shared constant
для invariant, TypeScript и Python. Она на четыре порядка меньше шага и выше
измеренного ULP-хвоста. Literal «дальше половины шага» из исследования
выражает запрет видимого snap: математически расстояние до *ближайшего* узла
никогда не бывает больше половины шага, поэтому рабочее разделение намеренного
off-grid и noise обязано использовать измеренный `1e-4` threshold.

### 4.2 Две канонизации, не одна рекурсивная

`canonicalizeLatticeCoordinate(value)`:

- finite exact/noise value возвращает canonical nearest node double;
- finite off-grid value не grid-snap'ится и сохраняет действующую
  nine-decimal storage canonicalization #224;
- `-0` становится `+0`;
- non-number/non-finite проходит без изменения до существующей validation.

`canonicalizeScalar(value)` сохраняет nine-decimal contract #224 для
allow-listed angles, transforms, lengths и normalized ratios, которые не
обязаны быть lattice nodes.

Рекурсивное округление любых numbers запрещено: unknown/future fields,
physical centimetres, colours, brightness, vacuum calibration и остальные
неперечисленные значения byte-equivalent.

## 5. Allow-list lattice fields

Near-node canonicalization применяется только к coordinate/size components:

- room `poly[*][0..1]`; legacy rect `x/y/w/h`;
- lossless endpoints `walls[].a/b`;
- `room_drafts[].points`, `partitions[].a/b`, `wall_columns[].center`,
  `open_spans[].a/b`;
- opening `x/y` только как coordinate components; diagonal/wall-bound values,
  попадающие в off-grid population, не притягиваются независимо к lattice;
- decor line endpoints и grid-bound origin/size fields existing allow-list;
- layout position `x/y` для device markers, room labels и сохранённых future
  owners.

Остаются scalar-only: plan backdrop transforms, angles, opening length/host
`t`, decor angle/scale, column angle и marker angle. Их existing
nine-decimal semantics не меняются.

Allow-list реализуется зеркально в frontend и backend и закрепляется общей
fixture. Добавление нового persisted coordinate field требует обновить оба
runtime и registry/test в одном коммите.

## 6. Непроходимый write barrier

### 6.1 Frontend

Все product mutations могут работать с immutable/local candidate, но ни один
config/layout/position payload не отправляется и не принимается в committed
state до общей boundary-функции:

- serialized config write канонизирует целый candidate и frontend принимает
  ровно его;
- individual layout write канонизирует position;
- localStorage/cache канонизирует full layout;
- Optimize/import/Undo/recovery responses принимаются в том exact виде,
  который подтвердил backend, без повторной несовместимой формулы.

Не требуется расставлять snap по десяткам assignments. Source-guard перечисляет
все outbound config/layout writer methods и падает при новом writer, который
не проходит общий boundary.

### 6.2 Backend

`async_save_config_state()` и `async_save_layout_state()` остаются единственной
Store boundary для config/layout. Их shared payload builders применяют Python
mirror до `Store.async_save`; import, optimize, undo, recovery и ordinary WS
writers обязаны сходиться туда. Direct Store write config/layout вне boundary
запрещён source/AST guard'ом. Operational stores (trails, virtual lights) не
являются plan geometry и не канонизируются.

Backend validation возвращает canonical candidate, поэтому stale/old frontend
не может занести noise. Frontend/Python shared fixture сравнивает точные JSON
numbers, а не tolerance.

## 7. Existing data и explicit Optimize report

Read существующего Store не переписывает данные. Первая последующая обычная
config/layout write проходит barrier и устраняет near-node noise во всём
candidate; это невидимый sub-pixel canonicalization, уже разрешённый owner.

Явный **Optimize plans** остаётся немедленным bulk-path и добавляет отчёт:

- total `latticeCoordinatesCanonicalized`;
- `latticeCoordinatesFar` — untouched off-grid coordinate components;
- maximum shift для canonicalized noise в physical units;
- ниже — только изменённые пространства с их
  `latticeCoordinatesCanonicalized` и `latticeCoordinatesFar`; пространства с
  нулём изменений не показываются;
- layout entries входят в общий итог и, если UI имеет отдельного именованного
  owner для layout, показываются по тому же правилу «только изменённые»;
- maximum shift для canonicalized noise в physical units не смешивается с
  видимым `moved/maxShiftCm` обычного grid alignment.

Optimize не пытается snap'ить far population этой задачей; действующий explicit
Align-to-grid pass может предлагать видимое движение отдельно по своему
контракту. UI обязан различать `noise canonicalized` и `elements moved`.

Confirm сохраняет exact preview config/layout revision-guarded transaction и
один Undo. Cancel/close не пишет. Повторный Optimize после storage/event/cold
reload даёт нулевой noise counter и no-op, если других maintenance changes нет.

### 7.1 i18n-контракт отчёта

Новые строки не расширяют общий `gs.optimize_changes`: координатная
канонизация имеет отдельный maximum и не должна смешиваться с обычным
grid-alignment. Добавляются два ключа с нейтральными числовыми формулировками,
не требующими отдельной pluralisation:

| Ключ | English | Русский |
|---|---|---|
| `gs.optimize_lattice_summary` | `Noisy coordinate values canonicalized: {n}; maximum movement: {cm} cm.` | `Канонизировано шумовых значений координат: {n}; максимальный сдвиг: {cm} см.` |
| `gs.optimize_lattice_space` | `{space}: coordinate values canonicalized: {n}; off-grid values left unchanged: {far}.` | `{space}: канонизировано значений координат: {n}; оставлено значений вне сетки: {far}.` |

`gs.optimize_lattice_summary` показывается только при `n > 0`.
`gs.optimize_lattice_space` показывается только для затронутых пространств;
layout без собственного пользовательского имени входит только в summary.
Кнопки Confirm/Cancel/Undo и общий lossy-warning используют существующие ключи.

## 8. Scope

### Входит

- lattice-aware scalar + shared constants в TS/Python/invariant;
- typed allow-list config/layout/position traversal;
- frontend/backend boundary and bypass guards;
- existing-data cleanup через next write и explicit Optimize report/Undo;
- import/export/restore/recovery parity;
- real/noisy fixture acceptance, exact idempotence range, mutation and
  performance;
- compatibility/canvas/architecture/testing/user docs и оба changelog.

### Не входит

- integer storage schema, stable wall ids или planar graph from ADR #282;
- выпрямление законного уступа `316×1` (#290);
- renderer corridor #288, partial resize #289 или union algorithm #278;
- grid snap authored off-grid geometry без отдельного Optimize permission;
- изменение grid resolution, unit system или physical cm;
- очистка source fixtures с noise.

## 9. Acceptance criteria

### AC1. Scalar idempotence и exact bits

Для 4801 nodes `k/240`, `k=-2400..2400`:

- canonicalization идемпотентна;
- canonical node не меняется;
- nine-decimal noise form каждого выбранного node превращается точно в тот же
  JS/Python double/JSON number;
- negative range и `-0` корректны;
- off-grid `0.06`, `0.2875` и boundary values вокруг `1e-4` не grid-snap'ятся.

### AC2. Shared allow-list parity

Одна fixture содержит все lattice fields, scalar fields, unknown siblings,
diagonal opening и future layout owner. TS и Python outputs deep-equal expected;
input immutable. Scalar/unknown/off-grid values сохраняют #224 semantics.

### AC3. Живой профиль после migration равен нулю

На privacy-minimized real-plan clones после boundary/Optimize:

```
npm run invariants -- --config <candidate> --lattice
  шум у узла          0 (0.00%)  — ближе 0.0001 шага, но не точно
```

для обоих spaces и layout. `checkWallKeys`, `checkMixedRoleRecords`, references
и production geometry preflight дают ноль violations. Far population остаётся
и совпадает с preview report.

### AC4. Произвольная editing session не возвращает noise

Production-bundle smoke последовательно:

- рисует/продолжает Walls chain;
- делает разрешённый Resize;
- ставит/двигает opening, partition, column и decor;
- двигает device marker и room label;
- выполняет config/layout write, reload и export.

После каждого committed pair `latticeProfile.noise === 0`; операция не может
потребовать отдельного ручного snap call в каждом controller.

### AC5. Write barrier нельзя обойти

Executable source/AST guard знает все frontend outbound config/layout writers и
backend config/layout Store writers. Добавленный test writer с direct payload
или `Store.async_save` мимо boundary красит gate. Operational non-geometry
stores остаются разрешены explicit allow-list.

### AC6. Source fixtures остаются шумными

`test/fixtures/real-plan-*.json` не переписываются implementation/formatting
tools. Existing profile pins (`noise >= 100`) остаются зелёными на raw files;
tests работают только с clones. Отдельно доказано: barrier на clone даёт ноль,
а raw fixture после теста byte/hash-equivalent.

### AC7. Optimize report и transaction

Preview показывает общий счётчик canonicalized coordinates, maximum physical
noise shift и строки только для пространств с ненулевыми изменениями;
неизменённые пространства отсутствуют. Сумма строк согласована с total; far не
считается moved, maximum noise shift не занижается. Cancel — zero writes; stale
revision — no partial pair; Confirm — один config/layout transaction и один
Undo; reload/cold read deep-equal preview; второй run no-op.

### AC8. Compatibility paths

Full/space/plan-only import, export, duplicate remap, backup restore, optimize
undo, pending recovery и ordinary old-client config/layout write заканчиваются
одинаковой canonical pair. Unknown fields и valid off-grid geometry survive.
No schema/storage/model version bump.

### AC9. Polyclip and structural regression

Точная co-incidence после snap проходит #278 failure-isolation fixtures и full
wall body tests. Barrier не является поводом ослабить preflight или удалять
локальную union isolation. #288/#289/#290 exact-grid regressions сохраняют свои
ожидаемые результаты независимо от noise cleanup.

### AC10. Мутанты

Обязательны:

- `Math.round`/Python `round-equivalent` → truncation;
- порог меньше measured `8×10⁻⁸` либо больше authored boundary;
- пропуск layout `x/y`;
- direct frontend writer bypass;
- direct backend Store bypass;
- рекурсивная канонизация unknown number.

Каждый mutant убивается AC1–AC6.

### AC11. Performance

Boundary traversal линейный и выполняется один раз на serialized payload, не на
pointermove/render tick. Large config save/Optimize benchmark не регрессирует
действующий p95 более чем на 20% same-run baseline и не добавляет второго full
deep clone сверх существующего candidate contract.

### AC12. Локальные гейты

- `npm run typecheck`;
- `npm test`;
- `npm run build` и bundle parity;
- backend canonicalization/validation tests;
- `node scripts/check-docs.mjs`;
- targeted write-barrier/Optimize smoke, invariants, mutation and benchmark.

Полные golden, smoke, performance и Linux HA harness выполняются перед beta.

## 10. Совместимость, UX, touch и security

JSON numbers и field shapes не меняются, old clients continue reading. Old
writer cannot persist near-node noise because backend owns the boundary. Read
не мигрирует silently; next write canonicalizes tiny measured tails, explicit
Optimize gives report and Undo.

View/touch/kiosk appearance не меняется на видимом масштабе. Device-marker drag
на touch получает тот же final boundary; Plan editor остаётся desktop-first.
Новых HA actions, external data, URL/HTML и permission boundaries нет.

## 11. Риски и меры

- Ошибочно широкий threshold может притянуть намеренную off-grid geometry.
  Мера: measured `1e-4`, boundary cases AC1, typed allow-list AC2 и сохранение
  far population AC3/AC7.
- TS и Python могут получить разные округления одного узла и снова создать
  wall-key drift. Мера: shared exact fixture/JSON bits AC1–AC2 и запрет
  tolerance-сравнения.
- Новый writer может обойти barrier. Мера: executable frontend/backend guard и
  bypass mutants AC5/AC10.
- Full-candidate traversal может удвоить clone/save cost. Мера: один boundary
  pass и same-run benchmark AC11.
- Обычная следующая запись очистит старый noise без отдельного Optimize. Мера:
  граница ограничена доказанным невидимым хвостом; authored off-grid и unknown
  fields byte-equivalent, а explicit bulk path сохраняет preview/Cancel/Undo.

## 12. Откат

Чистый revert implementation-коммита прекращает новую canonicalization; schema
и Store migration откатывать не требуется. Уже сохранённые canonical lattice
bits не восстанавливаются автоматически: они семантически равны прежнему узлу,
а обратное внесение noise было бы новой порчей. Явный Optimize до следующей
операции можно отменить штатным Undo, который хранит pre-transaction snapshot.

## 13. Ожидаемые файлы

Product/frontend:

- `src/coordinate-canonicalization.ts`;
- `src/houseplan-card.ts` только для boundary/report UI integration;
- `src/align-grid.ts`, `src/plan-optimizer.ts` для report accounting;
- `src/i18n/en.json`, `src/i18n/ru.json`.

Backend:

- `custom_components/houseplan/coordinate_canonicalization.py`;
- central store/validation/websocket paths только если guard выявит обход.

Tests/evidence:

- shared coordinate fixture и TS/Python tests;
- optimizer/align/import/recovery tests;
- source/bypass guard;
- real-plan clone smoke/invariants;
- mutation registry and save/Optimize benchmark.

Документация:

- `docs/CONFIG-COMPATIBILITY.md`, `docs/CANVAS.md`, `docs/ARCHITECTURE.md`,
  `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, ADR note;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 14. Release

Implementation-коммит имеет `Issue: #291`, `User-Visible: yes` и оба
changelog. Visual baselines не перепринимаются без semantic change; если
Optimize dialog меняется визуально, targeted golden/docs screenshots
принимаются только из штатного Linux artifact после bundle sync.

## 15. Принятые технические предположения

1. Owner intent «не трогать дальние» означает не grid-snap'ить Stage-0
   `offGrid` population; existing invisible nine-decimal scalar storage
   canonicalization #224 сохраняется.
2. Existing Store не переписывается на read. Immediate bulk path — Optimize;
   ordinary next write применяет общий barrier ко всему candidate.
3. `PLAN_MODEL_VERSION` не повышается: pass data-driven и идемпотентен, schema
   и read semantics не меняются.
4. Diagonal wall-bound coordinates, не попадающие в noise population, остаются
   off-grid; их независимый X/Y snap запрещён.
5. Touch editor: best effort; View/kiosk fully supported.
6. Layout без самостоятельного пользовательского имени агрегируется только в
   общий итог; если UI уже показывает именованного layout-owner, для него
   действует то же правило отчёта, что для пространства: строка появляется
   только при ненулевых изменениях.
