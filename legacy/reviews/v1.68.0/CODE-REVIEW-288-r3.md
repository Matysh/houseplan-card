# CODE-REVIEW-288-r3

- **Issue:** https://github.com/Matysh/houseplan-card/issues/288
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r3 · блокирующих циклов израсходовано 1 из 4
- **Ветка:** `issue/288-bounded-multiwall-corridor`
- **HEAD на момент ревью:** `f2c0721a9da6db255145abd14f1b52c20e15bbad`
- **Диапазон:** `origin/dev...HEAD` (`origin/dev` = `f472af88a3e9c89fec1f2b90b6f2c10471d5c693`,
  включает слитый в `dev` #289)

## Почему разбор полный, а не по дельте

Формально третий заход код-ревью, но объём разбора — полный §2.7, а не по
дельте §2.10. Причина явно названа владельцем в issue, а не выведена мной:
после зелёного вердикта CODE-REVIEW-288-r2 слияние ветки в `dev` конфликтовало
(владелец, issue #288, предпоследний комментарий): *«Не удалось только
слияние: ветка `issue/288-bounded-multiwall-corridor` конфликтует с `dev`. …
Повторный прогон ревью — не формальность: после ребейза на новый `dev` это
другой код, и принимать его без проверки нельзя»*. Это прямое применение
PROCESS.md §7.2/§2.10 («ребейз на ушедший вперёд dev — другой код»),
подтверждённое фактом: `git merge-base origin/dev HEAD` = `f472af88` —
текущий tip `dev`, то есть ветка `#288` целиком лежит поверх свежего `dev`, в
который между r2 и r3 влился #289 («fix: prevent mixed-role walls during
resize»).

Доказательство, что это настоящий ребейз, а не просто новый коммит сверху:
SHA r2 (`HEAD на момент ревью: 162f9b0eca8f61b4ae1d716785f1f94f8d448acc`) не
существует в текущем репозитории:

```
$ git cat-file -e 162f9b0eca8f61b4ae1d716785f1f94f8d448acc
fatal: Not a valid object name 162f9b0eca8f61b4ae1d716785f1f94f8d448acc
```

Коммит с тем же сообщением («docs: recapture screenshots after fixture
repair») присутствует в текущей истории, но под новым хешем `406e46ec` — это
переигранный (rebased), а не идентичный объект: контент коммита совпадает,
хеш — нет, потому что родитель сменился (старый `dev` → новый `dev` с #289).

Итог: пункты 3 и 5 инструкции («чем закрыта находка» / «унаследовано»)
выполнены ниже, но объём проверки — полный §2.7, включая живые прогоны всех
гейтов заново на текущем HEAD, как и в r2.

## Скоуп диффа

`git diff origin/dev...HEAD --stat`: `src/wall-thickness.ts` (+134/-6, то же
ядро фикса, что в r1/r2), `test/wall-thickness.test.mjs` (+51),
`scripts/mutation-gate.mjs` (+14), `demo/smoke_real_plan_masonry.mjs` (числа
`PLANS`/`KNOWN_GAP_*` на нулях), `docs/{WALL-THICKNESS,ARCHITECTURE,TESTING,
CHANGELOG,CHANGELOG.ru}.md`, 2 PNG + `docs/images/screenshots.json`
(пересъёмка после интеграции с #289), `docs/reviews/{SPEC-REVIEW-288-r1,
SPEC-REVIEW-288-r2,CODE-REVIEW-288-r1,CODE-REVIEW-288-r2}.md` (артефакты
предыдущих раундов), `dist/houseplan-card.js` и
`custom_components/houseplan/frontend/houseplan-card.js` (сгенерированные,
класс D).

Продуктовое ядро **не изменилось ни байтом** относительно того, что получило
зелёный вердикт в r2. Прямая проверка контентом, а не по хешам коммитов:

```
$ git diff e8a4db79..HEAD --stat     # e8a4db79 — коммит доки CODE-REVIEW-288-r2
 docs/images/06-device-display-preview.png | Bin 327898 -> 327899 bytes
 docs/images/07-background-editor.png      | Bin 304173 -> 304173 bytes
 docs/images/09-device-info.png            | Bin 146160 -> 146170 bytes
 docs/images/screenshots.json              |  26 +++++++++++++-------------
 4 files changed, 13 insertions(+), 13 deletions(-)
```

Единственная разница между деревом, которое видел r2, и текущим HEAD — это
одна дополнительная пересъёмка docs-скриншотов (`f2c0721a`, «после интеграции
с #289»), нужная потому, что #289 тоже трогал `docs/images/screenshots.json`
и правит фичи по соседним экранам (`06-device-display-preview`,
`07-background-editor`, `09-device-info` — не относятся к multi-wall junction,
относятся к общему `sourceFingerprint`, который считается по всему `src/**`).
`src/wall-thickness.ts`, `test/wall-thickness.test.mjs`,
`scripts/mutation-gate.mjs`, `demo/smoke_real_plan_masonry.mjs` идентичны
r2 побайтово.

Проверено также, что #289 не пересекается с продуктовым кодом #288: `#289`
трогает `src/resize.ts`, `src/i18n/*.json`, `docs/RESIZE.md`,
`demo/smoke_room_resize.mjs`, `demo/golden/baselines/safe-resize-*` — ни один
из этих путей не входит в диапазон `#288` и не пересекается с
`wall-thickness.ts`/`mutation-gate.mjs`/`wall-thickness.test.mjs`. Единственная
общая поверхность двух задач — общий отпечаток docs-скриншотов
(`screenshots.json`, весь `src/**`) и три копии бандла — механическое
пересечение, не логическое.

Напоминание ядра изменения (не менялось с r1): `buildMultiWallNodeMap`
добавляет каждому `MultiWallNodeRay` поле `continuations` — конечные общие
полосы («shared»-стены), примыкающие к дальнему концу одного из `supports`
луча. `bevelMultiWallBody` восстанавливает эти полосы
(`multiWallContinuationStripGeometry`) внутри маски узла и `union`-ит
результат вместо старой тройки `outside/preservedExterior/localInside`.

## Закрытие раунда r2

r2 — зелёный вердикт, High/Medium в этом раунде не было. Единственный пункт,
требующий явного отслеживания в r3, — процессный (не находка в скоупе #288,
как и в r2):

| Из r2 | Статус в r3 |
|---|---|
| Процессное наблюдение r2: вердикт-комментарии не называют SHA явно | Не устранено: комментарий владельца с решением «ребейзить и вернуть на code-review» также не называет SHA. SHA пришлось восстанавливать так же, как в r2 — проверкой существования объекта (`git cat-file -e 162f9b0e…` → отсутствует) и сверкой сообщений коммитов. Не блокирует и не заводится отдельным issue (уже отмечено дважды в r2 и здесь — не новая находка, а тот же неустранённый паттерн; решение по нему не в скоупе #288). |

Единственная оставшаяся содержательная находка — унаследованная Low из r1,
не тронутая ни в r2, ни в этом раунде (см. ниже).

## Унаследовано из r2 (без повторной проверки по существу, но перепроверено гейтами)

Формально разбор полный (rebase = «другой код», см. выше), поэтому все AC
перепроверены живыми прогонами на текущем HEAD (таблица гейтов ниже) — не
«наследование без проверки». Тем не менее по содержанию не пересматривались
повторно, так как дельта их не касается:

- Продуктовая рамка и соответствие J1/J6 из `docs/SCOPE.md`
  (`docs/SCOPE.md:39-46`) — текст спеки не менялся с версии, принявшей
  SPEC-REVIEW-288-r2 (зелёный); `docs/specs/288-bounded-multiwall-corridor.md`
  идентичен варианту, разобранному в CODE-REVIEW-288-r1/r2.
- Диагноз причины (узел `577,299`, лучи `349/120/5` шагов, `30/30/30` см,
  соседняя стена `20` см, радиус `4×15=60`, вырез `60−15=45`) — принят
  владельцем в теле issue, переоценке в r1/r2/r3 не подвергался.
- Ручная экспериментальная проверка риска «маска узла A съедает то, что узел B
  восстановил через `continuations`» (синтетические сценарии, документированы
  в CODE-REVIEW-288-r1.md, раздел «Прочитано, не исполнено») — не повторялась,
  код `multiWallContinuationStripGeometry`/`preservedExterior` не менялся.

Документы-источники: `docs/reviews/SPEC-REVIEW-288-r2.md` (зелёный, SHA
диапазона `fba615e9`), `docs/reviews/CODE-REVIEW-288-r1.md` (SHA `4aa79dee`,
не существует в текущем дереве — восстановлен по контенту),
`docs/reviews/CODE-REVIEW-288-r2.md` (SHA `162f9b0e`, также не существует —
восстановлен по контенту, см. выше).

## Как проверялось

### Прочитанное

`docs/SCOPE.md` (§ Core user jobs, J1/J6), `AGENTS.md`, `PROCESS.md`
§2.7/§2.9/§2.10/§4/§7/§8/§12, тело issue #288 и все 8 комментариев (аналитика,
«ТЗ готово», оба вердикта спек-ревью, правки автора, оба вердикта
код-ревью r1/r2, решение владельца о ребейзе), `docs/specs/
288-bounded-multiwall-corridor.md` целиком, `docs/WALL-THICKNESS.md`/
`docs/ARCHITECTURE.md`/`docs/TESTING.md` (диффы коммита `17086d3c`),
`docs/reviews/CODE-REVIEW-288-r1.md`, `docs/reviews/CODE-REVIEW-288-r2.md`,
полный diff `src/wall-thickness.ts`, `test/wall-thickness.test.mjs`,
`scripts/mutation-gate.mjs`, `demo/smoke_real_plan_masonry.mjs`, полный diff
#289 (`git diff 6a4e665d^..a7618151 --stat`) — для подтверждения отсутствия
файлового пересечения с #288.

### Гейты — выполнено (живые прогоны на текущем HEAD)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто |
| Unit | `npm test` | `1225 tests, 1224 pass, 1 skipped, 0 fail` |
| Build + bundle parity | `npm run build`, `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны; `npm run bundle:sync` синхронизировал третью копию (`demo/srv/assets`) без расхождений |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` — подтверждает, что пересъёмка `f2c0721a` соответствует текущему `src/**` |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 3 «зарегистрированные связи» на `MultiWallNodeRaySupport` (то же множество, что в r1/r2): `smoke_junction_patch_resilience`, `smoke_multiwall_junction`, `smoke_multiwall_strip_containment`; изменено файлов `src/**`: 1, символов на изменённых строках: 12; порог «широкого» символа (36 из 181 смоков) не превышен |
| Целевой смок AC1/AC2/AC5 | `node demo/smoke_real_plan_masonry.mjs` (после `bundle:sync`) | `second-floor: gapCount 0, totalGapSteps 0` (45757 samples); `first-floor: gapCount 0, totalGapSteps 0` (8048 samples, 830 skipped); все 8 проверок `true`, итог `OK` |
| 3 «зарегистрированные связи» | `node demo/smoke_junction_patch_resilience.mjs`, `node demo/smoke_multiwall_junction.mjs`, `node demo/smoke_multiwall_strip_containment.mjs` | все три — `OK`, все булевы поля `true` (включая `excessWedgeIsEmpty` #249, `nodeRemainsFilled` #261, `viewStopsAtFiniteRayEndpoint` #271, `cell_5_mixed_depth_t_*`/`cell_1_thick_crossbar_t_*` #275) |
| Инварианты модели | `npm run invariants -- --config test/fixtures/real-plan-second-floor.json` и то же для `real-plan-first-floor.json` | оба: `Инварианты выполнены: ссылки разрешимы, записи толщины находятся` |
| Мутант AC7 | `node scripts/mutation-gate.mjs --id=multi-wall-shared-continuation-protection-disabled` | чистый прогон зелёный, мутант красный (`тест покраснел, как обязан`), `поймано 1 из 1` |
| Реестр мутантов целиком | `node scripts/mutation-gate.mjs --check` | все патчи (включая #260/#288/#289 в одном файле) применяются к текущему коду без конфликтов, `exit 0` |
| **Полная золотая матрица** | `npm run golden:verify` | 80/80 сценариев `passed`, 0 `failed`, включая `wall-junctions-*`, `junction-patch-resilience-*`, `wall-union-isolation-*`, `multiwall-junction-bevel-view-dark`, `orthogonal-strip-cell-5/1-view-dark`, `wall-key-roundtrip-view-dark`, `isometric-wall-junctions-dark`, а также golden-сцены #289 (`safe-resize-handles-clamp-*`); `exit 0` |
| Одно число — один источник | `node --test test/single-source-numbers.test.mjs` | pass |

Полная золотая матрица прогнана по тем же причинам, что в r2: AC5/AC6 прямо
требуют согласованности всех consumers, инструмент не даёт частичного
прогона, а сама пересъёмка скриншотов после интеграции с #289 — ровно тот
случай, когда дешевле подтвердить визуальную согласованность целиком, чем
полагаться только на semantic-smoke.

### Гейты — не выполнено, с причиной

- `python -m pytest tests_backend -q` — диапазон не трогает
  `custom_components/**/*.py` (только сгенерированный бандл).
- `npm run performance`/`benchmark_*` — не назван в AC8; спека §6 относит
  performance-профиль к предрелизному гейту («перед beta»).

### Прочитано, не исполнено

- Побайтовое содержимое пересобранного `dist/houseplan-card.js` не читал
  построчно — детерминированная сборка и `cmp` трёх копий достаточны.
- Логика `nearbyBuckets`/дедупликации `continuationKeys`/самоисключения через
  `candidate.other == node.point` в `buildMultiWallNodeMap`
  (`src/wall-thickness.ts:1704-1743`) не перечитывалась заново построчно в
  этом раунде — файл байтово идентичен версии, разобранной построчно в r1/r2
  (подтверждено `git diff e8a4db79..HEAD -- src/`, пустой вывод).
- Отсутствие файлового пересечения между #289 и #288 — проверено чтением
  списков файлов (`comm`-эквивалент вручную): пересечение пустое, кроме
  `docs/images/screenshots.json` и трёх копий бандла (механическое, не
  логическое).

## Находки

Ни одной находки уровня High или Medium в скоупе задачи в этом раунде.
Единственная непогашенная **Low** — унаследованная из r1, не изменившаяся ни
в r2, ни в r3: `test/wall-thickness.test.mjs`, тест «issue #288 keeps a shared
wall attached beyond a short node ray finite» проверяет только метаданные
`ray.continuations`, не строит `wallBodiesGeometry` и не измеряет фактическую
геометрическую потерю площади. Не блокирует: geometрический результат
подтверждён напрямую живым прогоном AC1/AC2 (`gapCount: 0` на обоих реальных
планах) и мутантом AC7 в этом же раунде. Автор может закрыть опционально.

Процессное наблюдение (не находка в скоупе #288, не блокирует, повторяется
третий раз подряд — r2 уже фиксировал это же наблюдение): вердикт-комментарии
и комментарии с процессными решениями по этому issue не называют SHA явно.

## Что проверено и корректно

- **AC1/AC2** — доказаны напрямую живым прогоном: оба реальных плана дают
  `gapCount: 0`/`totalGapSteps: 0` на текущем HEAD после ребейза; плотная
  выборка (45757/8048 точек), не только 4 исторических гэпа; `npm run
  invariants` чист на обоих планах.
- **AC3** — юнит проверяет три масштаба (`cell_cm: 1/5/30`), прямой и
  реверсированный порядок rays/endpoints, отдельно проверяет отсутствие
  continuation при `kind: 'outer'` (не нарушает #249). Ограничение теста
  (метаданные, не геометрия тела) компенсируется смоком AC1/AC2 и мутантом
  AC7 — как и в r1/r2 (см. Low выше).
- **AC4** — все семь прежних контрактов (#249/#261/#271/#272/#275/#278/#279)
  зелёные в `npm test` и в трёх браузерных смоках с прямым совпадением по
  `MultiWallNodeRaySupport`.
- **AC5** — единственный canonical `wallBodiesGeometry`
  (`multiWallContinuationStripGeometry` вызывается один раз внутри
  `bevelMultiWallBody`, до всех downstream потребителей — проверено чтением,
  файл не менялся). Полная золотая матрица подтверждает согласованность всех
  сцен, включая Static/hidden Iso и light/sun, на текущем HEAD.
- **AC6** — семантический `gapCount === 0` подтверждён живым прогоном на
  текущем HEAD; полный `golden:verify` (80/80 passed) подтверждает отсутствие
  визуальной регрессии без единой переприёмки baseline специально для #288.
- **AC7** — мутант зарегистрирован, инвертирует ключевую проверку, убивается
  юнитом AC3 — воспроизведено живым прогоном на текущем HEAD.
- **AC8** — все локальные гейты выполнены и зелёные (таблица выше).
- **Порядок слияния из issue/§10 (наследие r1)** — остаётся соблюдённым:
  `#260` уже в `dev` с r2, и не затрагивается этим раундом.
- **Docs/changelog** — `docs/WALL-THICKNESS.md`/`ARCHITECTURE.md`/
  `TESTING.md` описывают именно то, что делает код (файлы не менялись с r2,
  сверка построчно проведена в r1/r2 и не требует повтора при неизменном
  диффе); `docs/CHANGELOG.md`/`CHANGELOG.ru.md` правлены в fix-коммите
  `17086d3c`, `User-Visible: yes`. Трейлеры `Issue: #288` — на всех 9 коммитах
  диапазона; `User-Visible: yes` — ровно на fix-коммите `17086d3c`, `no` — на
  остальных (спека, документы ревью, пересъёмки скриншотов).
- **Одно число — один источник.** Дифф не вводит и не меняет ни одной
  пользовательски видимой числовой величины; `test/single-source-numbers.test.mjs`
  прошёл отдельным прогоном на текущем HEAD.
- **Совместимость/touch/security/perf** — диапазон не трогает
  `schema`/`config`/`i18n`-файлы (проверено: `git diff origin/dev...HEAD
  --name-only | grep -E "schema|config|i18n"` → пусто); изменение локально по
  `rays`/`supports` одного узла, не вводит новый глобальный проход по стенам.
- **Независимость от #289** — файловые множества диффов #288 и #289 не
  пересекаются в продуктовом/тестовом коде (проверено чтением списков путей);
  общая поверхность — только `docs/images/screenshots.json` и три копии
  бандла, что и объясняет коммит `f2c0721a`.

## Гейты, которые прогнал/не прогнал — сводка

Прогнал: `tsc --noEmit`, `npm test`, `npm run build` + `cmp` трёх копий
бандла (`npm run bundle:sync`), `node scripts/check-docs.mjs`,
`node scripts/smoke-select.mjs --base origin/dev --head HEAD`,
`demo/smoke_real_plan_masonry.mjs`, три «зарегистрированные связи» смока,
`npm run invariants` на конфигах обеих real-plan фикстур, целевой мутант AC7,
`node scripts/mutation-gate.mjs --check` (весь реестр), **полный**
`npm run golden:verify` (80/80 passed), `test/single-source-numbers.test.mjs`.

Не прогнал: `pytest tests_backend` (Python не тронут), performance-профили
(не названы в AC8).

## Вердикт

Зелёный. Ребейз на ушедший вперёд `dev` (после интеграции #289) не изменил
ни строки продуктового или тестового кода #288 — подтверждено прямым
`git diff` содержимого дерева, а не только пересчётом хешей. Единственное
новое в этом диапазоне — повторная пересъёмка docs-скриншотов, подтверждённая
чистым `check-docs`. Полный повторный прогон всех гейтов, включая полную
золотую матрицу (80/80), не выявил новых находок уровня Medium/High.
Остаётся одна унаследованная Low-находка (AC3-тест ограничен метаданными,
не блокирует) и одно неустранённое процессное наблюдение (SHA не называется
в вердикт-комментариях) — оба не блокируют зелёный вердикт.
