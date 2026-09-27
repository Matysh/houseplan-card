# CODE-REVIEW-276-r3

- **Issue:** https://github.com/Matysh/houseplan-card/issues/276
- **Ветка:** `issue/276-reconcile-coincident-partition`
- **Проверенный HEAD:** `ff2f2063cf5b1f6292a6a4369274d0b59ea228dc` (совпадает с заявленным в хендоффе автора)
- **Предыдущий раунд:** `docs/reviews/CODE-REVIEW-276-r2.md`, HEAD `82fe98bcd3fb76833c27dd888d265fc15583a43b`, вердикт жёлтый (High: 0, Medium: 1 — M1-r2)
- **Заход:** r3 (код-ревью) · блокирующих циклов до этого раунда: 2/4

## 1. Скоуп проверки

Разбор по дельте (PROCESS.md §2.10): `git diff 82fe98bc..HEAD` (=`git diff 82fe98bc..ff2f2063`).

Коммиты дельты:

```
b5519e99 docs: review document for #276          ← публикация CODE-REVIEW-276-r2 (инфраструктура)
ff2f2063 test: stabilize Optimize overhead benchmark   ← дельта r3
```

Дельта строго локальна — `git diff --stat` показывает только:

```
demo/benchmark_coincident_partitions.mjs             |  22 +-
demo/golden/baselines/baselines-index.json           |  26 ++-
demo/golden/baselines/coincident-partition-*.png     | (4 новых файла)
demo/golden/baselines/{9 существующих сцен}.png      | (обновлены байты)
docs/reviews/CODE-REVIEW-276-r2.md                   | 222 +++ (публикация r2)
```

Ни один файл `src/**`, `test/**`, `custom_components/**` не тронут. Продуктовый
код (`src/coincident-partitions.ts`, `src/plan-optimizer.ts`) дельтой не
задет — значит контракт поведения не меняется, новая подсистема не
затрагивается, ребейза на ушедший вперёд `dev` не было. Разбор по дельте, а
не заново, оправдан по всем критериям §2.10.

Коммит `ff2f2063` несёт `Issue: #276`, `User-Visible: no` — верно, видимого
поведения нет. Поскольку коммит трогает `demo/golden/baselines/**`, обязательны
и присутствуют `Release: v1.67.0-beta.8` и `Baseline-Reviewed:
https://github.com/Matysh/houseplan-card/actions/runs/32684802336`.

## 2. Закрытие раунда r2

| Находка r2 | Чем закрыта | Где видно |
|---|---|---|
| **M1-r2** — `benchmark:coincident-partitions` гейтит `pass` по разности двух независимых `p95` (`candidateSummary.p95 - baselineSummary.p95`) вместо уже вычисленной корректной парной статистики (`overheadSummary.p95`), из-за чего ~⅓ прогонов красные/зелёные без единой правки кода | Закрыта. `measuredOverheadP95 = Math.max(0, overheadSummary.p95)` — гейт теперь считает именно парную разницу `candidateMs - baselineMs` на каждой итерации, а не разность независимых квантилей. Дополнительно введены `BATCH_SIZE=10` (усреднение таймер-шума внутри одного замера) и ABBA/BAAB-порядок (`first,second,third,fourth` со средним `(second+third)/2` и `(first+fourth)/2`), гасящий линейный дрифт: для арифметической прогрессии позиций `(1+4)/2 == (2+3)/2`, поэтому линейный член дрифта вычитается точно | `demo/benchmark_coincident_partitions.mjs:26-53,67`; воспроизведено мной (см. §4) — 4/4 прогона стабильно `pass: true`, `relativeP95` в диапазоне 12.2–14.1 % против 4 прогонов r2, где расчётная (но не используемая тогда) `pairedOverhead.p95` не проходила бюджет все 4 раза |

## 3. Унаследовано из r2 (без повторной проверки)

Источник: `docs/reviews/CODE-REVIEW-276-r2.md`, HEAD `82fe98bc`. Дельта не
касается перечисленного, поэтому вывод r2 (который для AC1,2,4,6-10,12-14
сам был унаследован из r1, HEAD `496e79a6`) принят без повторного исполнения:

- **AC1, AC2, AC4** (exact-match условие, byte-preserved fail-closed
  варианты, nested narrower/wider, orphan/overlap/draft/column/unknown-field)
  — `src/coincident-partitions.ts` дельтой не тронут ни в r2, ни в r3.
- **AC3** (несколько hosted door/window/gate) — тесты из r2
  (`test/coincident-partitions.test.mjs:74-121`) дельтой r3 не тронуты.
- **AC5** (targeted golden: 5-см офсеты + hosted door до/после 10/30/virtual)
  — сценарии и тест формы из r2 (`demo/golden/matrix.mjs`,
  `test/golden-matrix.test.mjs:258-286`) дельтой r3 не тронуты; сама
  визуальная приёмка baseline произошла именно в дельте r3 (см. §4) и
  проверена там впрямую, а не по доверию.
- **AC6, AC7, AC8** (Preview/atomic Apply/report/Undo/идемпотентность) —
  `smoke_optimize_coincident_partition.mjs` не менялся с r1; вывод принят.
- **AC9** (preflight гейтит Apply), **AC10** (consumer parity) —
  соответствующий код дельтой не тронут; выводы r1/r2 приняты как есть.
- **AC12, AC13** (мутации, дешёвые гейты) — идентификаторы мутантов и состав
  гейтов не изменились дельтой r3; тем не менее дешёвые гейты
  (`typecheck`/`test`/`build`+sync/`check-docs`) перезапущены заново в этом
  раунде, а не унаследованы (см. §4), как и в r2.
- **AC14** (changelog/docs/терминология) — уже закрыт в `a6056111`; дельта r3
  не добавляет пользовательских документов (только review-документ и golden
  baseline).
- Раздел «Одно число — один источник» — дельта r3 не добавляет и не меняет
  ни одной пользовательски видимой величины (тесты, бенчмарк, эталонные
  изображения); вывод r1/r2 принят.

## 4. Как проверялось в этом раунде (гейты)

Дешёвые гейты — все перезапущены на HEAD `ff2f2063`, все green:

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | green, без вывода |
| `npm test` | **1180/1180 passed**, 0 skipped, 0 failed |
| `npm run build && npm run bundle:sync` | green; `git status` чист после сборки; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` — идентичны |
| `node scripts/check-docs.mjs` | green: «Documentation checks passed (7 files, 10 external links)» — дельта `src/**` не трогает, но гейт дёшев и перезапущен |
| `node scripts/process-gate.mjs --issues` | «гейт пройден, предупреждений 0» |

`node scripts/smoke-select.mjs --base 82fe98bc --head HEAD`:

```
Исполняемого frontend-диффа нет (src/**/*.ts не тронут).
Browser-smoke этим диффом не выбираются — это не «пропустить проверки»,
а «выбирать нечего»: смоки проверяют собранную карточку.
```

Корректно: инструмент подтверждает, что дельта не касается рендер-пути,
браузерные смоки в этом раунде не нужны.

**Целевая проверка находки M1-r2** — сам предмет дельты, разобран не по
чтению, а исполнением:

```
$ for i in 1 2 3 4; do npm run benchmark:coincident-partitions; done
RUN 1: overheadP95Ms=3.47ms  relativeP95=12.2%  pass=true
RUN 2: overheadP95Ms=3.75ms  relativeP95=13.4%  pass=true
RUN 3: overheadP95Ms=3.93ms  relativeP95=14.1%  pass=true
RUN 4: overheadP95Ms=3.59ms  relativeP95=13.0%  pass=true
```

4/4 стабильно зелёные (в r2 корректная-но-неиспользуемая метрика проваливала
бюджет все 4 раза подряд при том же коде реконсиляции — реальный оверхед не
менялся между раундами, поменялась только надёжность его измерения).
Дополнительно проверено, что метрика **умеет падать**: временно (без
коммита, только в рабочей копии) понижен `ABSOLUTE_OVERHEAD_MS` с `25` до
`0.001` — `pass` корректно стал `false`; файл возвращён в исходное состояние,
`git status`/`git diff` после возврата пусты.

**Проверка легитимности golden-приёмки** (класс D, коммит только с
`Release`/`Baseline-Reviewed`, PROCESS.md §8/правило 13):

```
gh run view 32684802336 → headSha 82fe98bcd3fb76833c27dd888d265fc15583a43b (= HEAD r2, как и требуется —
  артефакт снят с ветки на проверенном ревью SHA, а не откуда попало)
  job golden: шаг «Capture or verify golden matrix» — 4× missing-baseline для новых сцен coincident-partition-*
    (ожидаемое поведение для «initial no-baseline CI run», demo/golden/README.md:24)
  job «Upload golden candidates/diffs»: «With the provided path, there will be 105 files uploaded» — полный артефакт
Общий conclusion прогона «failure» — это штатно: golden-job фейлится на отсутствующих
baseline ровно для того, чтобы получить артефакт для локального `golden:accept --reviewed --from=...`
(механизм описан в demo/golden/README.md), а не признак сломанного прогона.
```

`baselines-index.json`: `matrixVersion` 41→42, `acceptedAt` 2026-08-24T03:17:51Z
(после `createdAt` прогона 02:58:12Z — порядок корректный), `chromium`
`151.0.7922.34` — совпадает с пином CI. Изменившихся хэшей ровно 9
(существующие сцены) + 4 новых — совпадает с формулировкой хендоффа «девять
byte-различий» и «четыре новых сцены».

Не запускался (по необходимости, обосновано):

- Полный `golden:verify`/`golden:capture` — предрелизный гейт (§8/§11.4);
  сами эталоны уже приняты штатным `golden:accept --reviewed` на полном
  Linux CI артефакте (см. выше), повторная локальная съёмка ничего не
  добавляет к ревью и дала бы другой байтовый PNG на другой машине
  (demo/golden/README.md).
- `python -m pytest tests_backend` — дельта не касается `custom_components/**/*.py`.
- Остальные browser-смоки — инструмент выбора не вернул ни одной связи, дельта
  не трогает `src/**`.
- Мутации (`optimizer-coincident-*`, `optimize-preflight-bypassed`) и
  `model-invariants` — не перезапускались в этом раунде: код, который они
  проверяют (`src/coincident-partitions.ts`, `src/plan-optimizer.ts`),
  дельтой r3 не тронут, а в r2 они уже были перезапущены (не по доверию) на
  HEAD, ближайшем к текущему.

## 5. Находки

Новых находок нет. M1-r2 закрыта полностью — по существу («тест переживёт
будущую правку и умеет упасть»), не только по букве. High: 0, Medium: 0,
Low: 0.

## 6. Проверка AC — что изменилось в этом раунде

| AC | Статус r2 | Статус r3 | Доказательство дельты |
|---|---|---|---|
| AC5 | ✅ (данные/фикстура; визуальная приёмка — предрелизный гейт) | ✅ (визуальная приёмка выполнена: 4 новых baseline приняты `golden:accept --reviewed` на полном Linux CI артефакте прогона `32684802336`, headSha совпадает с проверенным ревью r2) | `demo/golden/baselines/baselines-index.json` (matrixVersion 42, 4 новых записи); проверено `gh run view` выше |
| AC11 | 🟡 частично (call-count/ownership ✅ твёрдо; budget-часть недетерминирована — M1-r2) | ✅ (обе половины доказаны: call-count/ownership не менялся, budget-бенчмарк теперь гейтится по корректной парной статистике и стабилен 4/4) | `demo/benchmark_coincident_partitions.mjs:62-67`; воспроизведено мной 4× + проверка «умеет падать» (см. §4) |

Остальные AC (1-4,6-10,12-14) дельтой r3 не задеты — статус наследуется из
r2 (§3).

## 7. Чего не проверял и почему

- Полный `golden:verify`/`golden:capture` матрица целиком — предрелизный
  гейт по процессу; новые baseline уже приняты штатным путём, что я
  проверил через историю CI-прогона, а не повторным захватом.
- `python -m pytest tests_backend` — дельта не касается Python-кода.
- Мутационные гейты и `model-invariants` — не перезапускались повторно в
  r3, так как затрагиваемый ими код не входит в дельту `82fe98bc..HEAD`
  (унаследовано из r2, где они были перезапущены не по доверию).
- Пиксельные диффы 9 изменившихся сцен «вручную» — не пересчитывал побайтово
  сам; доверился штатному механизму `golden:accept --reviewed` на полном
  CI-артефакте (что и есть предписанный процессом способ приёмки, а не
  повторная ручная проверка ревьюером).

## 8. Вывод

Единственная находка предыдущего раунда (M1-r2) закрыта предметно: гейт
бенчмарка теперь считает именно ту статистику, которая измеряет реальный
парный оверхед, и подтверждён экспериментально как стабильный (4/4 зелёных
без правок) и как способный упасть (искусственно ужесточённый бюджет дал
`pass: false`). Дельта раунда не касается продуктового кода и не меняет
контракт поведения — разбор по дельте с наследованием AC1-4,6-10,12-14 из
r1/r2 корректен по PROCESS.md §2.10. Новых находок нет.

**Вердикт: зелёный.**
