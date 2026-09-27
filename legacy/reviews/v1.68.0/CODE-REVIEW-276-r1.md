# CODE-REVIEW-276-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/276
- **Ветка:** `issue/276-reconcile-coincident-partition`
- **Проверенный HEAD:** `496e79a6dff56db2d5e491d11d02c67ca77d08d2` (совпадает с заявленным в хендоффе автора)
- **Диапазон:** `origin/dev...HEAD` (`origin/dev` = `240316a6`)
- **ТЗ:** `docs/specs/276-coincident-partition-reconciliation.md`, зелёное ревью
  `docs/reviews/SPEC-REVIEW-276-r3.md` (3 захода на этапе spec, 1/4
  блокирующих циклов израсходовано там; счётчик код-ревью отдельный)
- **Заход:** r1 (код-ревью) · блокирующих циклов до этого раунда: 0/4

## 1. Скоуп проверки

Полный разбор (это первый заход код-ревью, §2.10 не применяется).
Диапазон коммитов:

```
a06c94b9 docs: specify coincident partition reconciliation      (ТЗ, r1..r3 циклы spec)
ca516643 docs: address spec review for partition reconciliation
cfc8f211 docs: cover nested coincident partition thickness
a6056111 fix: reconcile coincident partitions during Optimize   ← продуктовый код
434995be test: strengthen coincident partition mutation
496e79a6 docs: refresh screenshot fingerprint
```

Продуктовая логика — единственный коммит `a6056111`. Он несёт `Issue: #276`,
`User-Visible: yes`, и в нём же — оба changelog (`docs/CHANGELOG.md`,
`docs/CHANGELOG.ru.md`), `docs/USER-GUIDE.md`/`.ru.md`, `docs/WALL-THICKNESS.md`,
`docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/STATUS.md`, все тесты, demo
smoke, `scripts/mutation-gate.mjs`, `scripts/smoke-links.mjs` и три копии
бандла. `434995be` — тест-только правка мутанта (`User-Visible: no`, верно).
`496e79a6` — обновление отпечатка скриншотов (`User-Visible: no`, верно,
отдельный коммит по прецеденту #237).

## 2. Как проверялось (гейты)

Дешёвые гейты — всегда, в этом раунде тоже:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, без вывода |
| Unit | `npm test` | **1176/1176 passed**, 0 skipped, 0 failed (авторский хендофф заявлял 1175 passed + 1 штатно skipped — расхождение на 1 тест воспроизведено средой: пропуски в `test/process-gate.test.mjs` условны на `git`/`gh`-стаб и различаются Windows/Linux; не дефект диффа) |
| Build + sync | `npm run build && npm run bundle:sync` | green; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `demo/srv/assets/houseplan-card.js` — три копии byte-identical, `git status` чистый после сборки |
| check-docs | `node scripts/check-docs.mjs` | green: «Documentation checks passed (7 files, 10 external links)» — обязателен, диффа задел `src/**` |

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` — полный вывод
приложен ниже с решением по каждой строке.

```
Прямое совпадение (13): smoke_zero_divider_taper, smoke_decor_layer_order,
  smoke_drag_bounds, smoke_furniture, smoke_glow, smoke_grid_snap,
  smoke_infinite_canvas, smoke_merge_split, smoke_open_passage,
  smoke_opening_tunnel_fill, smoke_optimize_micro_interval,
  smoke_optional_space_model, smoke_split_corner_wall
Зарегистрированная связь (3): smoke_optimize_coincident_partition,
  smoke_resize_wall_thickness, smoke_wall_key_roundtrip
```

Решение: все 13 «прямых совпадений» — следствие того, что новый модуль
импортирует широко используемые имена (`wallKey`, `NORM_W`, `GRID_PITCH`,
`SpaceModel`), а не потому что диффа меняет их контракт — классический
«слабая связь по распространённому имени» (PROCESS.md §8). Ни один из этих
13 смоков не относится к теме issue (decor layer order, furniture, glow
generic, grid snap, infinite canvas…), и полный прогон всех 16 не
пропорционален задаче. Прогнаны:

- `demo/smoke_optimize_coincident_partition.mjs` — прямо назван в AC6/AC7,
  запущен: **все 11 проверок true** (Preview не пишет, один атомарный
  Apply, reload сохраняет каноническое тело, one-shot Undo восстанавливает
  hosted-форму, Boundary видит shared wall, Thickness меняет единственное тело);
- `demo/smoke_wall_key_roundtrip.mjs` — «зарегистрированная связь» напрямую
  касается AC10 (consumer parity Plan/View/kiosk/Static/hidden Iso/light):
  запущен, **все 24 проверки true**;
- `demo/smoke_resize_wall_thickness.mjs` — «зарегистрированная связь» по
  `WallEntry`, который использует `setWallThickness`: запущен, **все 7
  проверок true**; Resize сам по себе вне скоупа (#277), но это дешёвая
  проверка отсутствия регресса в общем помощнике.

Остальные 10 «прямых совпадений» не прогонялись — тема (decor/furniture/
glow/grid snap/infinite canvas/merge-split/open passage/tunnel fill/split
corner) не пересекается ни с одним AC #276, а связь чисто по имени
импортированной утилиты.

Мутации (AC12, три идентификатора):

```
node scripts/mutation-gate.mjs --id=optimizer-coincident-opening-rehost-disabled
  → поймано 1 из 1
node scripts/mutation-gate.mjs --id=optimizer-coincident-partial-accepted
  → поймано 1 из 1
node scripts/mutation-gate.mjs --id=optimize-preflight-bypassed   (общий #199 мутант,
  переиспользован — reconciliation идёт через тот же `d.preflight?.ok` гейт)
  → поймано 1 из 1
```

Инварианты модели (диффа меняет геометрию/ссылки — обязателен, PROCESS.md §8,
#254/#253/#244/#252/#258/#259). Прогнан на выходе `optimizePlans()` для
фикстуры issue (5-см офсеты, room 15/partition 20) и на синтетической
nested-fixture (room 30/partition 20):

```
npm run invariants -- --config /tmp/276-reconciled.json
  → Инварианты выполнены: ссылки разрешимы, записи толщины находятся.
npm run invariants -- --config /tmp/276-nested.json
  → Инварианты выполнены: ссылки разрешимы, записи толщины находятся.
```

Оба файла получены прогоном `test-build/plan-optimizer.js` на входных
данных теста (команда воспроизводима, не «verified» без результата).

**Одно число — один источник.** Новые видимые числа — два счётчика Optimize
report (`partitionsReconciled`, `openingsRehosted`); каждый рендерится ровно
в одном месте (`src/houseplan-card.ts` вокруг строки 16233) через
существующий `_t()`-путь, как остальные счётчики отчёта. Итоговая толщина
общей стены (`max(roomCm, partitionCm)`) после Apply читается Thickness и
Boundary из одного и того же `space.walls` — тот же источник, что и для
любой обычной стены, второго хранения нет. `node --test
test/single-source-numbers.test.mjs` — 3/3 green, диффа не касается
форматтера.

## 3. Не прогонялось и почему

- **Полный `golden` матрикс (155 сценариев)** — предрелизный гейт (PROCESS.md
  §8, §11.4), не гейт код-ревью; диффа не меняет ни один существующий golden
  fixture (нет coincident-partition геометрии ни в одном текущем сценарии
  `demo/golden/matrix.mjs`), поэтому целевой прогон был бы no-op, а полный —
  не соразмерен задаче. См. находку M3 — целевой сценарий для #276 в матрицу
  не добавлен вовсе, поэтому полный/предрелизный прогон и не смог бы его
  проверить.
- **`python -m pytest tests_backend`** — диффа не касается `custom_components/**/*.py`.
- **Полная performance-матрица / `demo/benchmark_large_house.mjs` как есть** —
  не тот профиль (это render/pointer-путь, не «Optimize candidate pass»);
  вместо него — целевое измерение см. §4, M1.
- **`node demo/smoke_*.mjs` полный набор (177)** — не соразмерно; выбор по
  инструменту и теме см. §2.

## 4. Находки

Все три ниже — **Medium, в скоупе задачи** (High не найдено, красного нет).
По правилу §2.7/§4 это жёлтый вердикт, автор чинит в этом же issue, фикс
проходит следующий раунд.

### M1 — AC11 (перф-бюджет §10) не доказан ни автотестом, ни явным
«проверено чтением, не исполнением»

`docs/specs/276-coincident-partition-reconciliation.md` §10 обещает
«дополнительный p95 не превышает 15%... и 25 ms абсолютного overhead» на
large-house fixture, а AC11 называет доказательство: «Benchmark +
call-count test». Ни то, ни другое не добавлено:

- `demo/benchmark_large_house.mjs` — рендер/pointer-профиль, не измеряет
  `optimizePlans()`;
- `demo/benchmark_optimize_geometry_preflight.mjs` — измеряет только #199
  preflight, вызывается на данных, подготовленных `prepareSpacePhysicalGeometryInputs`,
  и не включает новый pass;
- ни один тест не проверяет счётчик вызовов `reconcileCoincidentPartitions`
  (call-count) — то есть будущая регрессия «функция стала вызываться на
  render/pointer path» не будет отловлена ничем.

Я измерил бюджет сам (не входит в зачёт «тест умеет падать» — это ad hoc
проверка ревьюера, а не доказательство автора), чтобы понять, реален ли
риск:

```
git worktree add --detach /tmp/hp-baseline cfc8f211   # до продуктового коммита
# baseline (без reconciliation), large-house fixture, N=30:
BASELINE min 31.20 median 34.59 p95 50.25 max 107.17
# HEAD (496e79a6), тот же прогон:
HEAD     min 30.62 median 34.07 p95 50.98 max 105.23
```

Разница p95 — 0.73 ms (~1.5%), внутри бюджета §10 с большим запасом.
**Фактического риска для перфоманса нет**, но это устанавливает ревьюер
разовым замером, а не тест, который переживёт следующую правку и умеет
упасть. Чинится добавлением: (а) целевого бенчмарка `optimizePlans()` на
large-house fixture с ассертом бюджета §10, аналогично
`benchmark_optimize_geometry_preflight.mjs`; (б) unit-теста, считающего
вызовы `reconcileCoincidentPartitions` только из `optimizePlans()` (например,
через инструментированный импорт/счётчик), либо равноценного доказательства
«не вызывается на render/pointer» по коду с явной пометкой в тесте.

### M2 — AC3 «несколько hosted openings на одной partition» не покрыто тестом

Спецификация (AC3) и план тестов (§13) требуют доказательства для «один И
**несколько** hosted door/window/gate». Все три источника (fixture
`test/fixtures/276-coincident-partition.json`, `test/coincident-partitions.test.mjs`,
`test/plan-optimizer.test.mjs`) используют ровно один hosted opening на
кандидата; парный overlap-цикл в `src/coincident-partitions.ts:265-270`
(`for i; for j > i;`) и `openingsRehosted += nextHosted.length` для случая
`length > 1` остаются непроверенными автотестом.

Проверил сам, чтобы понять фактический риск (ad hoc, не входит в зачёт
автора):

```js
// два hosted openings (door + window) на одной coincident partition
partitionsReconciled 1 openingsRehosted 2
// оба opening корректно материализованы на своих x/y/angle, host снят,
// повторный optimizePlans() — changed=false
```

Код и в этом случае работает верно — но это не устраняет разрыв: без
committed-теста регресс в парном overlap-цикле не будет пойман никем. Чинится
добавлением одного кандидата с двумя (лучше — тремя, чтобы задеть все пары
`i<j`) hosted openings в `test/coincident-partitions.test.mjs` либо
`test/plan-optimizer.test.mjs`, включая позитивный (не конфликтующие) и
негативный (два новых opening перекрылись бы после rehost → fail-closed)
случай.

### M3 — AC5 «targeted golden» не добавлен ни в каком виде

`docs/specs/276-coincident-partition-reconciliation.md` §13 обещает
«targeted golden: short 5-cm offsets + hosted door до/после 10/30/virtual», и
AC5 называет доказательством «Canonical geometry unit + targeted golden».
`demo/golden/matrix.mjs` не тронут этим диффом — ни один сценарий для #276 не
существует. Геометрическая часть AC5 полностью доказана (`wallIntervals`
unit-проверка в `test/coincident-partitions.test.mjs`/`plan-optimizer.test.mjs`
+ browser-smoke), но визуальный/пиксельный канал, который отдельно ловил
предыдущие регрессы такого рода (#234: подсветка «Толщины» и запись
расходились именно на уровне рендера, не геометрии), для этой фичи не
существует вовсе — ни сейчас, ни в будущем предрелизном прогоне, потому что
сценарий просто не описан в матрице. Это не блокирует Apply/AC своей
неполнотой сегодня (риск чисто визуального дефекта низкий: путь рендера
переиспользует давно проверенный `physicalBodyParts()`/`wallBodiesGeometry`,
никакой новой отрисовки не добавлено), но обещанный тест-план не выполнен.
Чинится добавлением сценария в `demo/golden/matrix.mjs` (короткие 5-см
офсеты + hosted door, до/после 10/30/virtual) — сама запись сценария не
требует прохождения через `golden:accept`, это делает пре-релизный гейт
(§8/§11.4) при первом реальном захвате.

## 5. Проверка AC — что доказано и как

| AC | Статус | Доказательство |
|---|---|---|
| AC1 | ✅ | `test('issue 276 exact proof ignores endpoint direction and room order')` — матрица 2×2 (direction×room order), все проходят |
| AC2 | ✅ | `test/plan-optimizer.test.mjs`: same-cm (20/20), nested narrower (30/20→30), nested wider (20/30→30), partial (byte-equivalent), ambiguous second partition (byte-equivalent); `test/coincident-partitions.test.mjs`: orphan/overlap/draft/column/unknown-field все byte-equivalent |
| AC3 | 🟡 частично | один hosted opening — unit + unknown-field round-trip (`future_field`) доказаны; **несколько** — не покрыто автотестом (M2), верно по факту исполнения (проверено мной ad hoc), но не доказано committed-тестом |
| AC4 | ✅ | `test('issue 276 fails closed for an orphan host, overlap, draft, column and unknown partition data')` — 5 вариантов, все fail-closed |
| AC5 | 🟡 частично | геометрическая эквивалентность — unit (`wallIntervals` после Apply) + browser smoke; **targeted golden не добавлен** (M3) |
| AC6 | ✅ | `smoke_optimize_coincident_partition.mjs`: `boundarySeesSharedWall`, `thicknessToolSelectsCanonicalWall`, `thicknessChangesSingleBody`, `previewDoesNotWrite` — все true |
| AC7 | ✅ | i18n unit (`test/i18n.test.mjs` проверяет обе строки в исходнике card) + smoke (`reportRendersBothCounters`, `applyUsesOneAtomicWrite`, `applyEnablesUndo`, `undoRestoresHostedPartition`) |
| AC8 | ✅ | Идемпотентность доказана в обоих unit-тестах (`second.changed === false`, `second.report.partitionsReconciled === 0`, `deepEqual(second.config, first.config)`) и smoke (reload) |
| AC9 | ✅ (проверено чтением, переиспользует #199) | `_runAlignToGrid()` блокирует Apply на `!d.preflight?.ok` (src/houseplan-card.ts:15112) — путь общий для всех Optimize-кандидатов, включая новый; мутант `optimize-preflight-bypassed` подтверждён (1/1) |
| AC10 | ✅ (проверено чтением) | Все консумеры (Plan/View/kiosk/Static/hidden Iso/Glow/sun) читают геометрию из одного `model.partitions`/`space.walls` через `physicalBodyParts()`/`modelOf()` — нет отдельной копии на consumer; после Apply запись `partitions` удаляется из персистентной конфигурации целиком, поэтому расхождения консумеров структурно невозможны. Отдельного dedicated parity-теста для #276 нет, но `smoke_wall_key_roundtrip.mjs` (запущен, 24/24 green) подтверждает единый источник для смежного случая |
| AC11 | 🟡 частично | call-count и бюджет §10 не доказаны автотестом (M1); эмпирически бюджет выполняется (p95 +1.5%, см. M1) |
| AC12 | ✅ | 3 мутанта, все 1/1 (см. §2) |
| AC13 | ✅ | typecheck/test/build+sync — все green, см. §2 |
| AC14 | ✅ | оба changelog, USER-GUIDE (RU/EN), WALL-THICKNESS.md, ARCHITECTURE.md, TESTING.md, STATUS.md — все в одном коммите с кодом, терминология («Толщина», «Граница») соответствует USER-GUIDE |

## 6. Прочее (не находки, для полноты)

- Хостинг документации/строк использует существующую терминологию
  («Граница», «Толщина») — не изобретена.
- `rawPartitionKnown()` фильтрует по сырому JSON (`{id,a,b,cm}`), а не по
  нормализованной модели — верно, иначе неизвестное поле терялось бы до
  проверки; подтверждено тестом `unknown partition data`.
- Эпсилон `Math.max(GRID_PITCH * 0.0002, 1e-9)` — доля шага сетки (~0.02%
  клетки), а не сама сетка; соответствует запрету ТЗ «пользовательская сетка
  не является epsilon».
- `columnBlocks()` использует точный circumradius (квадрат — `size *
  Math.SQRT1_2`, круг — `size * 0.5`), что совпадает с фактической
  геометрией `columnBody()` в `src/physical-geometry.ts` — не эвристика.

## 7. Вывод

Ядро реализации корректно, идемпотентно и хорошо покрыто тестами по
основным путям; все проверенные мной гейты (typecheck/test/build/check-docs/
целевые smoke/mutation/invariants) зелёные, три копии бандла синхронны,
трейлеры и changelog на месте. Три Medium-находки — все про **полноту
доказательной базы**, названной в самом ТЗ (AC3/AC5/AC11), а не про дефект
поведения; ни одна не про-функциональна (я лично исполнением подтвердил, что
множественные hosted openings и перф-бюджет фактически работают верно).
Все три в скоупе issue #276 и чинятся автором в этом же issue.

**Вердикт: жёлтый.**
