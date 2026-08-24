# CODE-REVIEW-288-r2

- **Issue:** https://github.com/Matysh/houseplan-card/issues/288
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r2 · блокирующих циклов израсходовано 1 из 4
- **Ветка:** `issue/288-bounded-multiwall-corridor`
- **HEAD на момент ревью:** `162f9b0eca8f61b4ae1d716785f1f94f8d448acc`
- **Диапазон:** `origin/dev...HEAD`

## Почему разбор полный, а не по дельте

Раунд формально второй код-ревью, но материал был перепроверен полностью, а
не только по видимой дельте — по правилу PROCESS.md §7.2 «после ребейза это
другой код». Доказательство, а не предположение:

- CODE-REVIEW-288-r1.md называет SHA на момент r1: `4aa79dee6b1e...`
  (коммит «docs: accept screenshots after junction repair»), а fix-коммит
  r1 — `ff5e393c`, спецификацию — `cb0f9e73`/`fba615e9`. Сам вердикт-комментарий
  в issue эти SHA не называет — это тоже находка процесса, отдельно отмечена
  ниже.
- Ни один из этих объектов не существует в текущем репозитории:
  `git cat-file -e 4aa79dee6b1e66946c9fb97ee38fc855b0020808` → отсутствует;
  `9031ba0d`, `ff5e393c`, `cb0f9e73` → `fatal: Not a valid object name`.
- Причина: между r1 и r2 ветка `issue/260-fixture-wall-keys` была доведена до
  готовности и слита в `dev` (`git merge-base --is-ancestor
  origin/issue/260-fixture-wall-keys origin/dev` → предок, тогда как в r1
  `9031ba0d` предком `origin/dev` не был), а `issue/288-...` была перестроена
  на новый `dev` — отсюда новые хеши у всех коммитов диапазона (спека,
  ревью-документы, fix, пересъёмка скриншотов). Премьерный коммит пересъёмки
  `4aa79dee` («after junction repair») заменён на `162f9b0e` («after fixture
  repair») — другое сообщение, другое содержимое `screenshots.json`
  (`sourceFingerprint` пересчитан).
- Ребейз не декоративный: `demo/smoke_real_plan_masonry.mjs` и обе копии
  бандла входят и в стек `#260`, и в fix-коммит `#288` (`comm -12` между
  списками файлов даёт непустое пересечение) — то есть после ребейза fix
  накладывался на файл, уже изменённый `#260` на 71 строку. Контент нужно
  было перепроверять заново, а не считать «тем же diff под новым именем».

Итог: пункт 3 инструкции («по каждой находке предыдущего раунда покажи, чем
именно она закрыта») выполнен, но объём проверки — полный §2.7, включая
живые прогоны всех гейтов заново на текущем HEAD.

## Скоуп диффа

`git diff origin/dev...HEAD --stat`: `src/wall-thickness.ts` (+134/-6, ядро
фикса), `test/wall-thickness.test.mjs` (+51, AC3), `scripts/mutation-gate.mjs`
(+14, AC7), `demo/smoke_real_plan_masonry.mjs` (числа `PLANS`/`KNOWN_GAP_*`
обновлены на нули), `docs/{WALL-THICKNESS,ARCHITECTURE,TESTING,CHANGELOG,
CHANGELOG.ru}.md`, 1 PNG + `docs/images/screenshots.json` (пересъёмка после
слияния #260), `docs/reviews/{SPEC-REVIEW-288-r1,SPEC-REVIEW-288-r2,
CODE-REVIEW-288-r1}.md` (артефакты предыдущих раундов), `dist/houseplan-card.js`
и `custom_components/houseplan/frontend/houseplan-card.js` (сгенерированные,
класс D).

Ядро изменения не поменялось относительно описанного в CODE-REVIEW-288-r1:
`buildMultiWallNodeMap` добавляет каждому `MultiWallNodeRay` поле
`continuations` — конечные общие полосы («shared»-стены), примыкающие к
дальнему концу одного из `supports` луча. `bevelMultiWallBody` восстанавливает
эти полосы (`multiWallContinuationStripGeometry`) внутри маски узла и
`union`-ит результат вместо старой тройки `outside/preservedExterior/
localInside`.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| **Medium** — пересъёмка docs-скриншотов состоялась раньше слияния `issue/260-fixture-wall-keys` в `dev`, нарушая явный порядок из issue и §10 спеки | `#260` слит в `dev` (доведён до нового tip), ветка `#288` перестроена на этот `dev`, скриншоты пересняты повторно уже после слияния | `git merge-base --is-ancestor origin/issue/260-fixture-wall-keys origin/dev` → предок (в r1 было «не предок»); коммит `162f9b0e` «docs: recapture screenshots after fixture repair» — самый верхний коммит диапазона, идёт строго после того, как `52722876` (tip `#260`) стал предком всей цепочки; `node scripts/check-docs.mjs` зелёный на текущем `sourceFingerprint` |
| **Low** — юнит AC3 проверяет только метаданные `ray.continuations`, не строит `wallBodiesGeometry` и не измеряет фактическую потерю площади | Не тронуто этим диапазоном (файл `test/wall-thickness.test.mjs` не менялся после r1) — находка остаётся открытой, но не блокирует; компенсируется независимо перепроверенными живыми прогонами AC1/AC2/AC7 ниже | `test/wall-thickness.test.mjs`, тест «issue #288 keeps a shared wall attached beyond a short node ray finite» — содержимое идентично тому, что описано в CODE-REVIEW-288-r1.md |

Дополнительное процессное наблюдение (не находка в скоупе #288, не блокирует):
вердикт-комментарии в issue (ни r1, ни спек-раунды) не называют SHA явно —
его пришлось восстанавливать по телу committed review-документов и по
проверке существования объектов в репозитории. Именно это в данном раунде
и обнажило факт ребейза. Стоит на будущее указывать SHA прямо в
комментарии-вердикте, а не только в файле документа.

## Унаследовано из r0 (без повторной проверки)

Из-за полного пересмотра (см. выше) в этом раунде почти ничего не наследуется
слепо — весь код, тесты, гейты и смоки перепрогнаны заново на текущем HEAD.
Единственное, что не проверялось повторно и принимается как есть:

- Продуктовая рамка и соответствие J1/J6 из `docs/SCOPE.md`, зафиксированные
  в аналитике issue (комментарий 0) и в SPEC-REVIEW-288-r1/r2 (зелёный на
  спеке) — текст спеки в этом диапазоне не менялся относительно принятой
  версии r2 спеки (docs/specs/288-bounded-multiwall-corridor.md идентичен
  версии, получившей зелёный вердикт SPEC-REVIEW-288-r2).
- Диагноз причины (узел `577,299`, лучи `349/120/5` шагов, `30/30/30` см,
  соседняя стена `20` см, радиус `4×15=60`, вырез `60−15=45`) — подтверждён
  владельцем в теле issue, не переоценивался повторно.

## Как проверялось

### Прочитанное

`docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` §2.7/§2.9/§4/§7/§8/§12, тело issue
#288 и все 6 комментариев (аналитика, «ТЗ готово», оба вердикта спек-ревью,
правки автора, вердикт CODE-REVIEW-288-r1), `docs/specs/
288-bounded-multiwall-corridor.md` целиком, `docs/WALL-THICKNESS.md`/
`docs/ARCHITECTURE.md`/`docs/TESTING.md` до и после диффа, полный diff
`src/wall-thickness.ts`, `test/wall-thickness.test.mjs`,
`scripts/mutation-gate.mjs`, `demo/smoke_real_plan_masonry.mjs`.

### Гейты — выполнено (живые прогоны на текущем HEAD)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто |
| Unit | `npm test` | `1224 tests, 1223 pass, 1 skipped, 0 fail` |
| Build + bundle parity | `npm run build`, `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны; `npm run bundle:sync` синхронизировал третью копию (`demo/srv/assets`) без расхождений |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` — подтверждает, что `sourceFingerprint`/`imageSha256` в `screenshots.json` соответствуют текущему `src/**` и текущим PNG байт-в-байт |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 3 «зарегистрированные связи» на `MultiWallNodeRaySupport`: `smoke_junction_patch_resilience`, `smoke_multiwall_junction`, `smoke_multiwall_strip_containment`; порог «широкого» символа (36) не превышен |
| Целевой смок AC1/AC2/AC5 | `node demo/smoke_real_plan_masonry.mjs` (после `bundle:sync`) | `second-floor: gapCount 0, totalGapSteps 0` (45757 samples); `first-floor: gapCount 0, totalGapSteps 0` (8048 samples, 830 skipped); все 8 проверок `true`, итог `OK` |
| 3 «зарегистрированные связи» | `node demo/smoke_junction_patch_resilience.mjs`, `node demo/smoke_multiwall_junction.mjs`, `node demo/smoke_multiwall_strip_containment.mjs` | все три — `OK`, все булевы поля `true` (включая `excessWedgeIsEmpty` #249, `nodeRemainsFilled` #261, `viewStopsAtFiniteRayEndpoint` #271, `cell_5_mixed_depth_t_*`/`cell_1_thick_crossbar_t_*` #275) |
| Инварианты модели | `npm run invariants -- --config test/fixtures/real-plan-second-floor.json` и то же для `real-plan-first-floor.json` | оба: `Инварианты выполнены: ссылки разрешимы, записи толщины находятся` |
| Мутант AC7 | `node scripts/mutation-gate.mjs --id=multi-wall-shared-continuation-protection-disabled` | чистый прогон зелёный, мутант красный (`тест покраснел, как обязан`), `поймано 1 из 1` |
| Реестр мутантов целиком | `node scripts/mutation-gate.mjs --check` | все патчи (включая новые из `#260` и `#288` в одном файле) применяются к текущему коду без конфликтов, `exit 0` |
| **Полная золотая матрица** | `npm run golden:verify` | все сценарии `passed`, включая `wall-junctions-*`, `junction-patch-resilience-*`, `wall-union-isolation-*`, `multiwall-junction-bevel-view-dark`, `orthogonal-strip-cell-5/1-view-dark`, `wall-key-roundtrip-view-dark`, `isometric-wall-junctions-dark`; `exit 0` |

Полная золотая матрица прогнана, а не пропущена как «предрелизный гейт»: AC5/6
прямо требуют согласованности всех consumers и запрещают тихое повышение
tolerance, а сам фикс меняет общий для всех junction-сценариев
`bevelMultiWallBody`, так что дешевле было прогнать полный матрикс (инструмент
не даёт частичного прогона), чем полагаться только на semantic-smoke.

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
  (`src/wall-thickness.ts:1704-1743`) прочитана построчно и прослежена вручную
  на топологии AC3 (`349/120/5` шагов, `30/30/20` см) — корректна, совпадает с
  тем, что уже отследил r1.
- Мутант `multi-wall-shared-continuation-protection-disabled` инвертирует
  ровно одно условие (`candidate.kind !== 'shared'` → `=== 'shared'`) — при
  такой инверсии первым делом принимаются кандидаты `kind !== 'shared'`
  (например, `outer`), что напрямую противоречит утверждению теста AC3 про
  `outerNode` (`continuations.length === 0` для внешней стены) и одновременно
  отключает восстановление настоящей общей стены — проверено чтением патча,
  подтверждено живым прогоном (мутант красный).

## Находки

Ни одной находки уровня High или Medium в скоупе задачи. Единственная
непогашенная Low-находка — унаследованная и не изменившаяся с r1 (см. таблицу
закрытия выше), автор может закрыть её опционально; не блокирует зелёный
вердикт при отсутствии High.

## Что проверено и корректно

- **AC1/AC2** — доказаны напрямую живым прогоном: оба реальных плана дают
  `gapCount: 0`/`totalGapSteps: 0`; проверены все точки контура (плотная
  выборка 45757/8048), не только 4 исторических гэпа; `PLANS`/
  `KNOWN_GAP_COUNT`/`KNOWN_GAP_STEPS` — нули в том же коммите (`888a7eae`), а
  не в отдельном; `npm run invariants` чист на обоих планах.
- **AC3** — юнит проверяет три масштаба (`cell_cm: 1/5/30`), прямой и
  реверсированный порядок rays/endpoints; отдельно проверяет, что при
  `kind: 'outer'` continuation не регистрируется (не нарушает контракт #249).
  Ограничение теста (метаданные, не геометрия тела) не устраняет доказательную
  силу: geometрический результат независимо подтверждён смоком AC1/AC2 и
  мутантом AC7.
- **AC4** — все семь прежних контрактов (#249/#261/#271/#272/#275/#278/#279)
  зелёные и в `npm test`, и в трёх браузерных смоках с прямым совпадением по
  `MultiWallNodeRaySupport`.
- **AC5** — та же продукционная сборка (`bundle:sync`) и `isPointInFill` в
  Plan/View; структурные консюмеры используют один и тот же canonical
  `wallBodiesGeometry` (`multiWallContinuationStripGeometry` вызывается один
  раз внутри `bevelMultiWallBody`, до всех downstream потребителей — проверено
  чтением). Полная золотая матрица (см. выше) подтверждает согласованность
  всех сцен, включая Static/hidden Iso и light/sun.
- **AC6** — семантический `gapCount === 0` подтверждён живым прогоном
  (первичное доказательство); полный `golden:verify` дополнительно подтвердил
  отсутствие визуальной регрессии без единой переприёмки baseline.
- **AC7** — мутант зарегистрирован, инвертирует ключевую проверку, убивается
  юнитом AC3 — воспроизведено живым прогоном в этом раунде.
- **AC8** — все локальные гейты выполнены и зелёные (таблица выше).
- **Порядок слияния из issue/§10** — теперь фактически соблюдён (см.
  «Закрытие раунда r1»), а не только продекларирован.
- **Docs/changelog** — `docs/WALL-THICKNESS.md`/`ARCHITECTURE.md`/
  `TESTING.md` описывают именно то, что делает код (построчно сверено с
  диффом `src/wall-thickness.ts`); `docs/CHANGELOG.md`/`CHANGELOG.ru.md`
  правлены в том же коммите `888a7eae`, `User-Visible: yes`. Трейлеры
  `Issue: #288` присутствуют на всех 7 коммитах диапазона; `User-Visible: yes`
  — ровно на fix-коммите, `no` — на остальных (спека, документы ревью,
  пересъёмка скриншотов).
- **Одно число — один источник.** Дифф не вводит и не меняет ни одной
  пользовательски видимой числовой величины — это фикс геометрии
  заливки/рендера стен, не текстовое отображение размеров;
  `test/single-source-numbers.test.mjs` прошёл в составе `npm test` без
  затрагивающих его изменений.
- **Совместимость/touch/security/perf** — проверено чтением: изменение
  локально по `rays`/`supports` одного узла, не вводит новый глобальный проход
  по стенам, не меняет schema/config/layout/Optimize (диапазон не трогает эти
  файлы), не добавляет HA service calls.

## Гейты, которые прогнал/не прогнал — сводка

Прогнал: `tsc --noEmit`, `npm test`, `npm run build` + `cmp` трёх копий
бандла (`npm run bundle:sync`), `node scripts/check-docs.mjs`,
`node scripts/smoke-select.mjs --base origin/dev --head HEAD`,
`demo/smoke_real_plan_masonry.mjs`, три «зарегистрированные связи» смока,
`npm run invariants` на конфигах обеих real-plan фикстур, целевой мутант AC7,
`node scripts/mutation-gate.mjs --check` (весь реестр), **полный**
`npm run golden:verify`.

Не прогнал: `pytest tests_backend` (Python не тронут), performance-профили
(не названы в AC8).

## Вердикт

Зелёный. Единственная Medium-находка r1 (нарушенный порядок слияния #260 →
пересъёмка скриншотов) закрыта фактически, не декларативно: `#260` слит в
`dev`, ветка `#288` перестроена на новый `dev`, скриншоты пересняты после
слияния и подтверждены чистым `check-docs`. Полный повторный прогон всех
гейтов, включая полную золотую матрицу, не выявил новых находок уровня
Medium/High. Остаётся одна открытая Low-находка (AC3-тест ограничен
метаданными) — не блокирует, оставлена на решение автора, как и в r1.
