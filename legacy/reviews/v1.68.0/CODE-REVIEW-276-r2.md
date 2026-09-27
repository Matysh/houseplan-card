# CODE-REVIEW-276-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/276
- **Ветка:** `issue/276-reconcile-coincident-partition`
- **Проверенный HEAD:** `82fe98bcd3fb76833c27dd888d265fc15583a43b` (совпадает с заявленным в хендоффе автора)
- **Предыдущий раунд:** `docs/reviews/CODE-REVIEW-276-r1.md`, HEAD `496e79a6dff56db2d5e491d11d02c67ca77d08d2`, вердикт жёлтый (High: 0, Medium: 3 — M1/M2/M3)
- **Заход:** r2 (код-ревью) · блокирующих циклов до этого раунда: 1/4

## 1. Скоуп проверки

Разбор по дельте (PROCESS.md §2.9): `git diff 496e79a6..82fe98bc`. Дельта локальна —
только тесты, бенчмарк, golden-фикстура, docs — контракт поведения не меняется,
новая подсистема не затронута, ребейза не было (`origin/dev` в этом диапазоне не
двигался относительно r1). Полный разбор не требуется; уже прочитанное ядро
реализации (`src/coincident-partitions.ts`, интеграция в `optimizePlans()`)
наследуется из r1 без повторного чтения — единственная продуктовая правка
дельты, `src/plan-optimizer.ts`, — это DI-шов для теста (см. §2 ниже), а не
изменение поведения.

Коммиты дельты:

```
a6056111 fix: reconcile coincident partitions during Optimize          (унаследован из r1)
434995be test: strengthen coincident partition mutation                 (унаследован из r1)
496e79a6 docs: refresh screenshot fingerprint                            (унаследован из r1, HEAD r1)
57fdfdbd docs: review document for #276                                  ← публикация CODE-REVIEW-276-r1 (инфраструктура)
82fe98bc test: prove coincident partition acceptance                     ← дельта r2
```

`82fe98bc` несёт `Issue: #276`, `User-Visible: no` — верно: правки только в
`src/plan-optimizer.ts` (DI-шов без изменения поведения по умолчанию),
`test/**`, `demo/benchmark_coincident_partitions.mjs`, `demo/golden/{harness,matrix}.mjs`,
`docs/ARCHITECTURE.md`, `docs/TESTING.md`, `package.json`, плюс штатный
рефреш `docs/images/screenshots.json`/`06-device-editor.png` (отпечаток
считается по всему `src/**`, а `src/plan-optimizer.ts` в дельте изменился —
рефреш обязателен и корректно лёг в тот же коммит). Видимого поведения нет —
`User-Visible: no` верен.

## 2. Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| **M1** — AC11 (перф-бюджет §10, «Benchmark + call-count test») не доказан ни одним committed-тестом | Частично закрыта. Добавлен `demo/benchmark_coincident_partitions.mjs` (`npm run benchmark:coincident-partitions`) и unit-тест `test('issue 276 reconciliation is owned by explicit Optimize and called once per valid space')` в `test/coincident-partitions.test.mjs`. Call-count/source-ownership половина закрыта твёрдо. Бенчмарк-половина закрыта только по букве — сам бенчмарк содержит дефект измерения, см. **новую находку M1-r2** ниже | `test/coincident-partitions.test.mjs:139-172` (call-count+ownership, зелёный, детерминирован); `demo/benchmark_coincident_partitions.mjs` (недетерминирован, см. §4) |
| **M2** — AC3 «несколько hosted door/window/gate» не покрыто автотестом | Закрыта. Добавлены позитивный тест (`door`+`window`+`gate`, 3 непересекающихся openings, атомарный rehost, идемпотентность повторного Optimize) и негативный (`overlap-door`+`overlap-window`, fail-closed, partition и hosts не тронуты) | `test/coincident-partitions.test.mjs:74-121`; прогнано мной: `node --test test/coincident-partitions.test.mjs` — все проходят |
| **M3** — AC5 «targeted golden: 5-см офсеты + hosted door до/после 10/30/virtual» не добавлен | Закрыта на уровне фикстуры/данных (сама визуальная приёмка — предрелизный гейт, как и в r1). Добавлены 4 сценария `coincident-partition-{before,thin,thick,virtual}-dark` в `demo/golden/matrix.mjs` (`GOLDEN_MATRIX_VERSION` 41→42), логика подготовки фикстуры в `demo/golden/harness.mjs`, и тест `test('issue 276 golden captures 5 cm offsets and hosted door before/after 10/30/virtual')` проверяет форму каждого состояния (5-см офсет виден, `partitions`/`host` сняты, толщина 10/30, `open_spans` для virtual) | `demo/golden/matrix.mjs:168-179`; `demo/golden/harness.mjs:70-96`; `test/golden-matrix.test.mjs:258-286`; прогнано: `node --test test/golden-matrix.test.mjs` — зелёный; baseline-изображений для новых ID нет — ожидаемо, приёмка при первом `golden:capture`/`golden:accept` предрелизного гейта |

## 3. Унаследовано из r1 (без повторной проверки)

Источник: `docs/reviews/CODE-REVIEW-276-r1.md`, HEAD `496e79a6`. Дельта не
касается перечисленного ниже кода/поведения, поэтому вывод r1 принят без
повторного исполнения:

- **AC1, AC2, AC4** (exact-match условие, byte-preserved fail-closed варианты,
  nested narrower/wider, orphan/overlap/draft/column/unknown-field) —
  `src/coincident-partitions.ts` дельтой не тронут.
- **AC6, AC7, AC8** (Preview/atomic Apply/report/Undo/идемпотентность) —
  `smoke_optimize_coincident_partition.mjs` не менялся; я перезапустил его в
  этом раунде как дешёвую проверку регресса (см. §5) — 11/11 green, вывод
  подтверждён, не только унаследован.
- **AC9** (preflight гейтит Apply) — код `_runAlignToGrid()` не тронут;
  мутант `optimize-preflight-bypassed` тот же (см. §5, перезапущен).
- **AC10** (consumer parity, единый источник геометрии для всех потребителей)
  — рендер-путь дельтой не тронут; вывод r1 «проверено чтением» принят как
  есть.
- **AC12, AC13** (мутации, дешёвые гейты) — идентификаторы мутантов и состав
  гейтов не изменились; я перезапустил их заново на новом HEAD (не по
  доверию, а потому что это дёшево, см. §5) и они дают тот же результат.
- **AC14** (changelog/docs/терминология) — уже закрыт в `a6056111`, дельта
  добавляет только `ARCHITECTURE.md`/`TESTING.md`, что не отменяет прежнюю
  проверку остальных документов.
- Раздел «Одно число — один источник» (report counters, итоговая толщина) —
  дельта не добавляет новых видимых пользователю чисел; вывод r1 принят.

## 4. Как проверялось в этом раунде (гейты)

Дешёвые гейты — все green на HEAD `82fe98bc`:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | green, без вывода |
| `npm test` | **1180/1180 passed**, 0 skipped, 0 failed (у автора в хендоффе — 1179 pass + 1 conditional skip; расхождение на 1 тест — тот же класс среды, что в r1: условный skip в `test/process-gate.test.mjs` на git/gh-стаб отличается по окружению, не дефект диффа) |
| `npm run build && npm run bundle:sync` | green; три копии бандла (`dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/`) идентичны, `git status` чист после сборки |
| `node scripts/check-docs.mjs` | green: «Documentation checks passed (7 files, 10 external links)» — обязателен, дельта касается `src/**` (`plan-optimizer.ts`) |

`node scripts/smoke-select.mjs --base 496e79a6 --head 82fe98bc`:

```
Изменено файлов src/**: 1 · символов проекта на изменённых строках: 2
Зарегистрированная связь (1): demo/smoke_optimize_coincident_partition.mjs
  ← reconcileCoincidentPartitions
```

Единственная связь — сама AC6/AC7 сцена. Прогнана:

```
node demo/smoke_optimize_coincident_partition.mjs → все 11 проверок true, OK
```

Мутации (перезапущены на новом HEAD, не по доверию к r1 — дёшево и делта
трогает `src/plan-optimizer.ts`, где интегрирован вызов):

```
node scripts/mutation-gate.mjs --id=optimizer-coincident-opening-rehost-disabled → поймано 1 из 1
node scripts/mutation-gate.mjs --id=optimizer-coincident-partial-accepted        → поймано 1 из 1
node scripts/mutation-gate.mjs --id=optimize-preflight-bypassed                  → поймано 1 из 1
```

Инварианты модели — дельта не меняет геометрию/ссылки (`coincident-partitions.ts`
не тронут), но перезапущены дёшево на исходной фикстуре issue:

```
node scripts/model-invariants.mjs --config test/fixtures/276-coincident-partition.json
  → Инварианты выполнены: ссылки разрешимы, записи толщины находятся.
```

`golden:verify` (полный, 155+4 сценария) не запускался — предрелизный гейт
(PROCESS.md §8/§11.4), дельта не меняет ни один существующий рендер-путь, а
для 4 новых сценариев ещё нет baseline (ожидаемо, приёмка происходит на
первом `golden:capture`). `python -m pytest tests_backend` не запускался —
дельта не касается `custom_components/**/*.py` (в песочнице ревью к тому же
отсутствует модуль `pytest`, что подтверждено отдельно и не влияет на этот
диапазон).

## 5. Находки

### M1-r2 (Medium, в скоупе, чинится тем же автором) — `benchmark:coincident-partitions` даёт систематически смещённую и нестабильную оценку p95-оверхеда

`demo/benchmark_coincident_partitions.mjs:62-67` считает **два разных**
показателя оверхеда, но использует для gate худший из них:

```js
const overheadSummary = summary(overheadTimes);              // p95 ПАРНОЙ разницы на каждой итерации — корректная оценка
...
const measuredOverheadP95 = Math.max(0, candidateSummary.p95 - baselineSummary.p95); // разность ДВУХ НЕЗАВИСИМЫХ p95 — используется в gate
const relativeP95 = measuredOverheadP95 / Math.max(baselineSummary.p95, Number.EPSILON);
const pass = measuredOverheadP95 <= ABSOLUTE_OVERHEAD_MS && relativeP95 <= RELATIVE_OVERHEAD;
```

`overheadSummary` (парная разница `candidateTimes[i] - baselineTimes[i]` на
каждой итерации, корректная статистика «сколько именно эта операция стоит
дороже») вычисляется и даже публикуется в отчёте как `pairedOverhead`, но
**не используется в самом решении pass/fail** — вместо неё gate вычитает
`baselineSummary.p95` из `candidateSummary.p95`, то есть разность двух
отдельно посчитанных квантилей по двум переставленным (interleaved), но не
идентичным по составу выборкам. Это статистически более шумная и смещённая
вниз оценка тем сильнее, чем меньше сам baseline (~30 мс на этой машине для
large-house фикстуры, при бюджете 15%).

Воспроизведение (без единой правки кода, только повторные запуски):

```
$ for i in 1 2 3 4; do npm run benchmark:coincident-partitions; done
RUN 1: gate metric 1.29 ms → pass: true   | pairedOverhead.p95 9.22 ms → would-fail (23%)
RUN 2: gate metric 0.52 ms → pass: true   | pairedOverhead.p95 5.74 ms → would-fail (16%)
RUN 3: gate metric 6.44 ms → pass: false  | pairedOverhead.p95 8.67 ms → would-fail (24%)
RUN 4: gate metric 5.25 ms → pass: true   | pairedOverhead.p95 11.25 ms → would-fail (31%)
```

(дополнительно ранее в этой же сессии: ещё 9 запусков дали 3 `pass:false` на
используемой сейчас метрике — т.е. ~⅓ прогонов красные без единой правки
кода). Корректная метрика (`pairedOverhead.p95`), которую сам скрипт уже
считает и печатает, проваливает бюджет §10 **во всех 4** прогонах подряд —
то есть используемый в `pass` показатель систематически даёт более
оптимистичный результат, чем собственная более точная оценка того же
скрипта.

Почему это Medium, а не просто «шумная машина»: сиблинг-бенчмарк той же
кодовой базы, `demo/benchmark_optimize_geometry_preflight.mjs` (#199), уже
решает ровно эту проблему — малый baseline делает относительный процент
неустойчивым к таймер-шуму — явным запасом
`relativeLimit = baseline.p95 * RELATIVE_RATIO + RELATIVE_NOISE_MS`
(строки 73-76 того файла). Новый бенчмарк #276 не переиспользует этот приём
и вдобавок не гейтится по уже вычисленной корректной парной статистике.
Итог: коммит закрывает M1 из r1 по букве («тест добавлен»), но не по духу
(«тест переживёт будущую правку и умеет упасть по существу») — доказательная
база AC11 по-прежнему ненадёжна, только теперь недетерминированно, а не
отсутствует вовсе. Не блокирует (реальный оверхед — единицы мс, см. и
собственное измерение r1: +1.5%), но должен быть починен в этом же issue:
либо гейтить на `overheadSummary.p95` вместо `candidateSummary.p95 -
baselineSummary.p95`, либо добавить абсолютный noise floor по образцу #199.

Продуктовых вопросов владельцу нет — всё техническое, решает автор.

## 6. Проверка AC — что изменилось в этом раунде

| AC | Статус r1 | Статус r2 | Доказательство дельты |
|---|---|---|---|
| AC3 | 🟡 частично (M2) | ✅ | `test('issue 276 rehosts three non-overlapping door/window/gate openings atomically')` + `test('issue 276 fails closed when two hosted openings would overlap after rehost')`, обе зелёные |
| AC5 | 🟡 частично (M3) | ✅ (данные/фикстура; визуальная приёмка остаётся предрелизным гейтом, как и для всех golden) | `demo/golden/matrix.mjs` 4 новых сценария + `test/golden-matrix.test.mjs` проверка формы каждого состояния |
| AC11 | 🟡 частично (M1) | 🟡 частично иначе: call-count/ownership ✅ твёрдо, budget-часть не доказана надёжно (M1-r2) | `test/coincident-partitions.test.mjs:139-172` (calls===2, source ownership) зелёный и детерминирован; `demo/benchmark_coincident_partitions.mjs` недетерминирован, см. §5 |

Остальные AC (1,2,4,6-10,12-14) дельтой не задеты — статус наследуется из r1
без изменений (см. §3).

## 7. Чего не проверял и почему

- Полный `golden:verify`/`golden:capture` — предрелизный гейт, дельта не
  меняет существующий рендер-путь; для новых 4 сценариев baseline ещё нет.
- `python -m pytest tests_backend` — дельта не касается
  `custom_components/**/*.py`.
- Остальные 176 browser-смоков кроме названного инструментом и уже
  прогнанного в r1 набора (`smoke_wall_key_roundtrip`,
  `smoke_resize_wall_thickness`) — не перезапускал повторно, они не входят в
  «зарегистрированную связь» этой дельты (инструмент в этом раунде вернул
  только одну связь, см. §4), а сама delta не трогает их темы.
- Полная performance-матрица `demo/performance/*` — не гейт код-ревью;
  таргетный `benchmark:coincident-partitions` разобран отдельно как находка
  M1-r2.

## 8. Вывод

Обе предметные находки r1 (M2, M3) закрыты полностью и доказуемо: новые
тесты для нескольких hosted openings и golden-сценарии для 5-см офсетов
существуют, зелёные и способны падать (проверено запуском). Находка M1
закрыта только наполовину — call-count/source-ownership тест твёрдый и
детерминированный, но добавленный бенчмарк содержит собственный дефект
измерения (использует смещённую метрику вместо уже вычисленной корректной)
и эмпирически недетерминирован на ~⅓ прогонов без единой правки кода. Это
новая Medium-находка (M1-r2), в скоупе issue, не блокирует мёрж по
серьёзности, но по правилу §2.7 требует ещё одного раунда правки от автора.

**Вердикт: жёлтый.**
