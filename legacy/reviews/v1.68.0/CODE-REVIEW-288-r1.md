# CODE-REVIEW-288-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/288
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4
- **Ветка:** `issue/288-bounded-multiwall-corridor`
- **SHA на момент ревью:** `4aa79dee6b1e66946c9fb97ee38fc855b0020808`
- **Диапазон:** `origin/dev...HEAD` (2 продуктовых/тестовых коммита: `cb0f9e73`
  спецификация, `fba615e9` доработка ТЗ, `e61315cb`/`3f4b92f5` документы
  ревью ТЗ — фон; код-ревью касается `ff5e393c` fix + `4aa79dee` docs screenshots)

Это первый заход код-ревью для #288 — предыдущие два раунда были ревью ТЗ
(SPEC-REVIEW-288-r1 жёлтый → r2 зелёный). Разбор ниже полный, разделы
«Закрытие r<N-1>»/«Унаследовано из r<N-1>» не нужны (PROCESS.md §2.9 касается
только повторных заходов ОДНОГО и того же этапа).

## Скоуп диффа

`git diff origin/dev...HEAD --stat`: `src/wall-thickness.ts` (+134/-6),
`test/wall-thickness.test.mjs` (+51), `scripts/mutation-gate.mjs` (+14),
`demo/smoke_real_plan_masonry.mjs` (числа `PLANS`/`KNOWN_GAP_*`),
`docs/{WALL-THICKNESS,ARCHITECTURE,TESTING,CHANGELOG,CHANGELOG.ru}.md`,
10 PNG в `docs/images/**` + `screenshots.json`, `dist/houseplan-card.js` и
`custom_components/houseplan/frontend/houseplan-card.js` (сгенерированные,
класс D).

Ядро изменения: в `buildMultiWallNodeMap` каждый `MultiWallNodeRay` получил
поле `continuations` — конечные общие полосы («shared»-стены), примыкающие к
дальнему концу одного из `supports` луча. В `bevelMultiWallBody` эти полосы
восстанавливаются (`multiWallContinuationStripGeometry`) внутри маски узла,
после чего результат `union`-ится вместо старой тройки
`outside/preservedExterior/localInside`.

## Как проверялось

### Прочитанное (владельческий/процессный контекст)

`docs/SCOPE.md` (J1/J6 — план должен правдиво показывать стены), `AGENTS.md`,
`PROCESS.md` §2.7/§4/§7/§8/§12, тело issue #288 и все 5 комментариев (аналитика,
«ТЗ готово», два вердикта ревью ТЗ), `docs/specs/288-bounded-multiwall-corridor.md`
целиком, `docs/WALL-THICKNESS.md`/`docs/ARCHITECTURE.md`/`docs/TESTING.md` (до и
после диффа).

### Гейты — выполнено

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без ошибок |
| Unit | `npm test` | `1221 tests, 1220 pass, 1 skipped, 0 fail` |
| Build + bundle parity | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны, `git status` после сборки чист (детерминированный бандл) |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 3 «зарегистрированные связи» на `MultiWallNodeRaySupport`: `smoke_junction_patch_resilience`, `smoke_multiwall_junction`, `smoke_multiwall_strip_containment`; порог «широкого» символа (36) не превышен → не считается диффом, задевающим всё |
| Целевой смок AC1/AC2/AC5 | `node demo/smoke_real_plan_masonry.mjs` (после `npm run bundle:sync`) | `second-floor: gapCount 0, totalGapSteps 0` (45757 samples); `first-floor: gapCount 0, totalGapSteps 0` (8048 samples); все 8 проверок `true`, итог `OK` |
| 3 «зарегистрированные связи» | `node demo/smoke_junction_patch_resilience.mjs`, `node demo/smoke_multiwall_junction.mjs`, `node demo/smoke_multiwall_strip_containment.mjs` | все три — `OK`, все булевы поля `true` (включая #249 discarded wedge, #261 retained wedge, #271 finite rays, #275 protected orthogonal strips — прямое покрытие AC4) |
| Инварианты модели | `npm run invariants -- --config <second-floor as {spaces:[space]}>` и то же для first-floor (space взят из `test/fixtures/real-plan-*-floor.json`) | second-floor: `Инварианты выполнены`, без наблюдений; first-floor: `Инварианты выполнены`, 2 наблюдения «exact endpoints вместо своего ключа» (не нарушения; см. ниже) |
| Мутант AC7 | `node scripts/mutation-gate.mjs --id=multi-wall-shared-continuation-protection-disabled` | чистый прогон зелёный, мутант красный (`тест покраснел, как обязан`), `поймано 1 из 1` |

### Гейты — не выполнено, с причиной

- **`npm run golden:verify` (полная матрица).** `demo/golden/policy.mjs`
  жёстко запрещает частичный прогон (`--scenario=` кидает
  `golden verify must run the complete matrix; use capture for a diagnostic
  --scenario run`) — то есть у этого гейта нет «облегчённой» формы, только
  весь матрикс. Это ровно тот «полный набор», который PROCESS.md §8 называет
  предрелизным гейтом, а не гейтом ревью. AC6 сам делает семантический
  `gapCount === 0` (доказан выше живым прогоном smoke) первичным доказательством,
  а pixel-baseline — вторичным, принимаемым только из Linux CI. Локально не
  прогонял; риск регрессии старых `wall-junctions-*`/`multiwall-junction-bevel-*`
  golden-сцен закрыт иначе: все три «зарегистрированные связи» смоков (см.
  выше) браузерно проверяют именно эти контракты (#249/#261/#271/#275) через
  реальный SVG fill API и дают `OK`.
- **`python -m pytest tests_backend -q`.** Дифф не трогает
  `custom_components/**/*.py` — не применимо.
- **`npm run performance`/`benchmark_*`.** Не назван в AC8 (только
  typecheck/test/build/check-docs/targeted smoke/mutation); spec §6 явно
  относит performance-профиль к предрелизному гейту («перед beta»), не к
  этому ревью.

### Прочитано, не исполнено

- Полная бинарная эквивалентность трёх копий бандла подтверждена `cmp` и `npm
  run bundle:sync`; байтовое содержимое самого JS не читал построчно —
  достаточно детерминированной сборки без diff после `npm run build`.
- Логика `nearbyBuckets`/дедупликации `continuationKeys`/самоисключения через
  `candidate.other == node.point` в `buildMultiWallNodeMap`
  (`src/wall-thickness.ts:1704-1743`) прочитана построчно и прослежена вручную
  на unit-фикстуре AC3 — корректна.
- Архитектурный вопрос «не съедает ли маска ДРУГОГО узла B то, что узел A
  только восстановил через `continuations`, если их радиусы перекрываются»
  (тот самый класс риска, для которого уже существует `protectedStrips`,
  см. комментарий в коде на `src/wall-thickness.ts:2393-2395`) — не доказательство
  чтением, а **выполнено экспериментально**: собраны два синтетических
  сценария через `wallBodiesGeometry` (один — независимый удалённый узел с
  искусственно гигантским радиусом 833, другой — реалистичная цепочка «A—тонкая
  стена—B», где стена короткая для ОБОИХ узлов и оба регистрируют
  continuation друг на друга). В обоих случаях итоговая геометрия не теряет
  ни одной точки (`coverage=1.000` по всей длине связывающей стены). Причина:
  реальное удаление материала выполняют только `outerCuts`/`retainedCuts`
  (направленные вдоль конкретных лучей узла), а не абстрактный квадрат маски;
  всё остальное внутри маски восстанавливает `preservedExterior`
  (`difference(intersection(boundedCurrent, mask), centre)`), которая не
  зависит от того, чьему узлу принадлежит стена. Регрессии не найдено, риск
  не подтвердился — фиксирую как проверенный и закрытый, а не как находку.
  Скрипты одноразовые, в репозиторий не коммитились (правило «не создавать
  файлов в рабочей копии»), `git status` после проверки чист.

## Находки

### Medium (в скоупе, чинится в этом же ТЗ) — нарушен собственный порядок релиза из §10/issue

Issue #288 (тело, раздел «При слиянии») и `docs/specs/288-bounded-multiwall-corridor.md`
§10 требуют одно и то же прямым текстом: ветка `issue/260-fixture-wall-keys`
должна попасть в `dev` **до** финальной пересъёмки docs screenshots для #288
— «Порядок обязателен — съёмка до слияния обесценивается слиянием».

Проверено по SHA:

```
git merge-base --is-ancestor 9031ba0d origin/dev   # НЕ ancestor
git branch -a --contains 9031ba0d                  # только remotes/origin/issue/260-fixture-wall-keys
git show origin/dev:demo/fixtures/wall-key.mjs      # fatal: path does not exist
```

`9031ba0d` («test(fixtures): write the real wall key, in one place»,
`Issue: #260`) — последний коммит ветки #260 — не является предком
`origin/dev` и нигде в `dev` не присутствует (файл `demo/fixtures/wall-key.mjs`
там просто отсутствует). При этом коммит `4aa79dee` («docs: accept screenshots
after junction repair», автор Sergey Matyunin, `Issue: #288`) уже переснял и
принял 10 PNG в `docs/images/**` на текущей ветке #288 — то есть пересъёмка
состоялась раньше, чем требовал сам issue.

**Смягчающее обстоятельство**, которое понижает это до Medium, а не High:
`#260` меняет только `demo/fixtures/**` и тестовые фикстуры (`large-house`,
`visual-matrix` для golden/perf), не `src/**`. Отпечаток `check-docs.mjs`
считается по `src/**`, поэтому механически job `docs` не покраснеет и
пересъёмка не станет технически «протухшей» само по себе. Риск —
не в поломке, а в том, что мандатный порядок релиза, который сам issue
объявил обязательным именно для экономии повторного прогона «Docs
screenshots», не был соблюдён, и решение об этом принял продуктовый автор
(коммит от Sergey Matyunin), а не тот, кому issue явно отвёл слияние #260
(«не обходится ручным слиянием автора продуктовой задачи» — про слияние
самой ветки #260, но дух того же правила: порядок операций реализует не
автор #288 в одностороннем порядке).

Правка: либо (а) дождаться слияния `issue/260-fixture-wall-keys` в `dev`,
затем повторно прогнать `Docs screenshots` и принять командой `npm run
docs:accept -- --reviewed --from=<артефакт>` на дереве, которое уже включает
#260 (даже если PNG не изменятся байтово — процессная гарантия, которую
установил сам issue), либо явно зафиксировать в issue отказ от этого пункта
с обоснованием владельца (если порядок уже неактуален). Само по себе это не
блокирует корректность правки `wall-thickness.ts`.

### Low — AC3 не проверяет геометрию тела, только метаданные `continuations`

`test/wall-thickness.test.mjs`, тест «issue #288 keeps a shared wall attached
beyond a short node ray finite» (добавлен этим диффом) строит узел через
`buildMultiWallNodeMap` и проверяет только структуру `ray.continuations`
(`start`/`u`/`length`/`halfDepth`), но не строит `wallBodiesGeometry` и не
измеряет фактическую утрату площади соседней стены — то, что буквально
требует AC3 («longitudinal material loss соседней тонкой стены не превышает
её собственного half-depth»). Сравните с более старым тестом «issue #271
keeps finite co-directional ray supports…» в том же файле (строки
1199–1240), который для той же категории дефекта дополнительно гоняет
`wallBodiesGeometry` и `assertProbeInside/Outside` — паттерн уже есть в файле,
здесь не использован.

Не блокирует: фактическое поведение на уровне тела подтверждено (а) реальным
`demo/smoke_real_plan_masonry.mjs` на двух живых планах (AC1/AC2, строгий
`gapCount: 0`), (б) мутантом AC7, который убивает именно этот код (хотя и
через тот же метаданными-ограниченный юнит), (в) моей собственной ручной
проверкой через `wallBodiesGeometry` на синтетических конфигурациях (см.
«Прочитано, не исполнено» выше) — везде `coverage=1.000`, потерь площади не
обнаружено. Правка опциональна: добавить в AC3-тест такую же геометрическую
проверку, как в #271-тесте, для более прямого соответствия тексту AC3.
Оставляю на решение автора — не блокирует зелёный вердикт при отсутствии
High.

## Что проверено и корректно

- **AC1/AC2** — доказаны напрямую живым прогоном `smoke_real_plan_masonry.mjs`:
  оба реальных плана дают `gapCount: 0`/`totalGapSteps: 0`, проверены ВСЕ
  точки контура комнат (плотная выборка), а не только 4 исторических гэпа.
  `PLANS`/`KNOWN_GAP_COUNT`/`KNOWN_GAP_STEPS` обновлены на нули в том же
  коммите `ff5e393c`.
- **AC3** — юнит `issue #288 keeps a shared wall attached beyond a short node
  ray finite` прогоняет три масштаба (`scale: 1, 5, 30`, соответствует
  `cell_cm: 1/5/30`), прямой и реверсированный порядок rays/endpoints, и
  отдельно проверяет, что при `kind: 'outer'` на дальнем конце `continuations`
  пуст (не нарушает контракт #249/exterior corridor). Метаданные
  (`start`/`u`/`length`/`halfDepth`) точно совпадают с ожидаемыми для
  топологии `349/120/5` шагов, `30/30/20` см. Геометрический вывод (что это
  реально ограничивает потерю площади) подтверждён отдельно смоком и моей
  ручной проверкой (см. Low выше и раздел «прочитано, не исполнено»).
- **AC4** — регресс всех семи прежних контрактов (#249/#261/#271/#272/#275/#278/#279)
  покрыт: `npm test` включает их юниты без сбоев (например, тест `issue 230…`,
  `#278 anonymized regression…`, `#271 keeps finite co-directional…` —
  видны в живом прогоне выше), и три браузерных смока с прямым совпадением по
  `MultiWallNodeRaySupport` (`junction_patch_resilience`, `multiwall_junction`,
  `multiwall_strip_containment`) зелёные, включая явные поля
  `excessWedgeIsEmpty` (#249), `nodeRemainsFilled` (#261),
  `viewStopsAtFiniteRayEndpoint` (#271) и полное покрытие `cell_5_mixed_depth_t`/
  `cell_1_thick_crossbar_t` (#275).
- **AC5** — тот же `smoke_real_plan_masonry.mjs` меряет через реальный
  production-бандл (`npm run bundle:sync` перед прогоном) и `isPointInFill` в
  Plan/View; структурные консюмеры (roomGeom/geom/paperGeom) используют один
  и тот же canonical `wallBodiesGeometry` — код не создаёт consumer-specific
  патчей (проверено чтением: `multiWallContinuationStripGeometry` вызывается
  один раз внутри `bevelMultiWallBody`, до всех downstream потребителей).
- **AC7** — мутант `multi-wall-shared-continuation-protection-disabled`
  зарегистрирован в `scripts/mutation-gate.mjs`, инвертирует ключевую проверку
  `candidate.kind !== 'shared'` → `=== 'shared'`, и убивается юнитом AC3
  (продемонстрировано живым прогоном выше).
- **AC8 (локальные гейты)** — все выполнены и зелёные (таблица выше).
- **Docs/changelog** — `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`,
  `docs/TESTING.md` описывают именно то, что делает код (проверено построчно
  против диффа `src/wall-thickness.ts`); `docs/CHANGELOG.md`/`CHANGELOG.ru.md`
  правлены в том же коммите `ff5e393c` с `User-Visible: yes` — трейлеры на
  обоих коммитах диапазона корректны (`Issue: #288` + `User-Visible: yes/no`).
- **Одно число — один источник.** Дифф не добавляет и не меняет ни одной
  пользовательски видимой числовой величины (это фикс геометрии заливки/
  рендера стен, не текстовое отображение размеров); `test/single-source-numbers.test.mjs`
  прошёл в составе `npm test` без изменений с его стороны — неприменимо по
  существу, не только механически.
- **Совместимость/touch/security/perf (спека §6/§11)** — не подтверждаю
  отдельным прогоном (не требуется по AC8), но проверено чтением: изменение
  локально по `rays`/`supports` одного узла, не вводит новый глобальный
  проход по стенам, не меняет schema/config/layout/Optimize (дифф не трогает
  соответствующие файлы), не добавляет HA service calls.

## Гейты, которые прогнал/не прогнал — сводка

Прогнал: `tsc --noEmit`, `npm test`, `npm run build` + `cmp` бандлов,
`node scripts/check-docs.mjs`, `node scripts/smoke-select.mjs`,
`demo/smoke_real_plan_masonry.mjs`, три «зарегистрированные связи» смока
(`smoke_junction_patch_resilience`, `smoke_multiwall_junction`,
`smoke_multiwall_strip_containment`), `npm run invariants` на конфигах,
собранных из обеих real-plan фикстур, целевой мутант AC7.

Не прогнал: полный `npm run golden:verify` (запрещён частичный прогон
инструментом, это предрелизный гейт §8), `pytest tests_backend` (Python не
тронут), performance-профили (не названы в AC8).

## Вердикт

Жёлтый. Геометрический фикс (`src/wall-thickness.ts`) корректен, полностью
покрыт тестами/смоками/мутантом и подтверждён живым прогоном на обоих реальных
планах — по существу задача решена и решает заявленный сценарий (J1/J6:
непрерывные стены на реальном плане). Единственная причина жёлтого —
процессная: пересъёмка docs-скриншотов в этом же диапазоне коммитов состоялась
раньше, чем сам issue/спека предписывают слияние `issue/260-fixture-wall-keys`
в `dev`. High нет; Medium — один, в скоупе.
