# CODE-REVIEW-834-r2

Issue: #834 · Трек: ask · Заход: r2 · Блокирующих циклов использовано: 1/4
Материал: `90d8702e26ca973a5b8149d88f793579d680b60e` (рабочая копия на нём), диапазон `origin/dev..HEAD`:

```
90d8702e perf: reuse unchanged node baselines and diff preview styles
a249d62d fix: reuse proved local node geometry to reduce drag work
7c40a4a6 fix: preserve wall operand ownership during numerical retry
02aaa29f docs: review document for #834
d9dfc471 fix: retain native node capture and presented camera
5b4c8f56 perf: prune proved redundant node geometry work
a032feb9 perf: add headroom to connected-node dragging
45c33ee6 fix: stabilize and accelerate connected-floor node dragging
```

Между r1 и r2 ветка вернулась в `S6` дважды **CI-only** (красный Validate
на `a249d62d`, затем численные perf-метрики native connected drag выше
лимита) — оба возврата не были циклами ревью модели (код не читался),
бюджет остался 1/4. Фактический предмет r2 — дельта после материала r1
(`d9dfc471`): три новых коммита `7c40a4a6`, `a249d62d`, `90d8702e`
(`02aaa29f` — только документ ревью r1, class C, не разбирается повторно).

## Скоуп дельты

- `7c40a4a6` — закрытие единственной находки r1 (Medium, `src/wall-shell-union.ts:46-47`).
- `a249d62d` — новая подсистема локального переиспользования boolean-границы
  при перетаскивании узла (`wall-boundary-splice.ts`, `wall-boolean-incremental.ts`,
  `wall-intersection-signature.ts`) плюс точное ось-пересечение в `wall-thickness.ts`.
- `90d8702e` — расширение `WallBooleanBaseline` на переживание Esc-повтора
  и замена ежекадрового restore→flush→hide на дифф стилей превью
  (`wall-node-editor.ts`, `wall-node-card-adapter.ts`).

Это не точечный фикс: `wall-boundary-splice.ts` (333 строки, новый модуль)
и объём тестов (+2000 строк) сопоставимы по масштабу с самой задачей →
веду полный разбор дельты (§2.10), а не только проверку, что старая
находка закрыта.

Риск по изменённым участкам (#707): класс **geometry** —
`src/junction-limits.ts`/`houseplan-editor-runtime.ts` (`_junctionLimitsIntroduced`,
`JunctionSharedGeometry`) в этой дельте не менялись (код r1, уже принятый);
новая геометрия дельты — `wall-shell-union.ts`/`wall-operand-topology.ts`
(AC2), `wall-boundary-splice.ts`/`wall-intersection-signature.ts` (AC2),
`wall-thickness.ts` `lineIntersect` (AC1/AC2) — все прямо названы в ТЗ
(«скоуп: численная устойчивость... стоимость и планирование preview/proof/paint»).
Класс **perf** — `wall-node-editor.ts:182` (rAF, код r1, не менялся),
`wall-node-editor.ts:312/392` (`getComputedStyle`, новая дельта 90d8702e,
AC3/AC4). Оба класса названы в ТЗ и закрыты AC1–AC4 → `route: fix`
(пробела класса, не покрытого AC, не нашёл).

## Как проверялось

Разбор вёл чтением каждого изменённого/нового файла дельты и трассировкой
fail-closed путей вручную, плюс два параллельных независимых агента (по
образцу r1 — «три параллельных агента») на новые модули `wall-boundary-splice.ts`/
`wall-intersection-signature.ts`/`wall-boolean-incremental.ts` и на
`wall-boolean-baseline.ts`/`wall-node-card-adapter.ts`/`wall-node-editor.ts`.
Второй агент не нашёл расхождений с моим прочтением. Первый нашёл находку
ниже, которую я проверил сам построчно и подтверждаю.

1. **Закрытие r1 Medium** (`src/wall-shell-union.ts`, `src/wall-operand-topology.ts`).
2. **`wall-boundary-splice.ts`** — локальный патч boolean-результата:
   `stableOperandOwners` (identity-карта рёбер старое↔новое), `safeAddedEdges`
   (ориентационный тест новых рёбер), `changedBox`/`vertexBox` vs
   `blockerBoxes` (глобальный, не попарный bounding box — проверил сценарий
   «фикс-операнд охвачен петлёй несоприкасающихся по отдельности рёбер»),
   реконструкция колец (Eulerian in/out-degree=1 по точной идентичности
   вершин) и независимая `validOutputHierarchy` (winding-проверка
   вложенности результата с нуля).
3. **`wall-intersection-signature.ts`** — ключ = полный subject JSON +
   отсортированное МУЛЬТИмножество релевантных рёбер; `LIMIT`-обрезание —
   безопасный промах кэша.
4. **`wall-boolean-incremental.ts`** — рефакторинг 90d8702e (вынос
   `JSON.stringify` в единственный вызов `apply()`) семантически
   эквивалентен прежнему варианту.
5. **`wall-thickness.ts` `lineIntersect`** — точный ось-снэп включается
   только при строгом `=== 0` компоненте направления; используется и вне
   Select (corner mitres), что разрешено ТЗ при сохранении прочих
   потребителей — подтверждено адверсариальным `test/wall-axis-intersection.test.mjs`
   и сохранённым зелёным junction/corner regression-набором.
6. **`wall-boolean-baseline.ts`/`wall-node-card-adapter.ts`** — переживание
   Esc при полном совпадении authoritative config object + revision + space
   + ПОЛНОГО JSON выбранного конфига.
7. **`wall-node-editor.ts` `syncPaint`** — дифф original/applied/requested
   вместо ежекадрового restore→`getComputedStyle`→hide.
8. Сверил новые mutation-registry якоря построчно против `90d8702e` (не
   против диффа) и прочитал их guard-тесты на предмет геометрической
   реалистичности, а не «не бросило исключение».
9. Трейлеры/changelog, бюджет бандла, привязка к `smoke-links.mjs`,
   View-изоляция (`WallBooleanBaseline` — только через ленивый
   `import('./wall-node-card-adapter')` в `houseplan-editor-runtime.ts:920`,
   `node-editor-bundle-budget.mjs` CI-проверяет отсутствие маркера кэша
   в View/других редакторах).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| Medium: `topology()` в `canonicalComputedWallGeometry` сравнивал только отсортированный мультисет числа колец на полигон — не ловил «переход» отверстия между компонентами одинакового размера | `src/wall-shell-union.ts:46` заменён на `sameWallOperandTopology(canonical, normalized)` (`src/wall-operand-topology.ts`) — точная идентичность границ (канонический ключ кольца привязан к своему outer, точная коллинеарность через bigint-decimal) | `7c40a4a6`; новый тест `test/wall-shell-topology.test.mjs:30` (`migratingHole()`) строит РЕАЛЬНУЮ геометрию через `union`/`difference` (не синтетический мультисет), где старая проверка пропускает дефект, и проверяет, что функция теперь бросает `'changed boolean topology'`. Три новых mutant-якоря (`node-shell-retry-accepts-ring-count-histogram`, `node-shell-topology-flattens-hole-owners`, `node-shell-topology-erases-one-ulp-bend`) ловятся этим и соседними тестами того же файла |

## Унаследовано из r1

Весь периметр, проверенный и принятый в `docs/reviews/CODE-REVIEW-834-r1.md`
(материал `d9dfc471e45346dc055c1e15f8213c7542a77143`, зелёный CI run
`37854983161`) и не изменившийся в дельте r2 — принято без повторной
проверки: fail-closed численный retry (кроме строки, закрытой выше),
Select-only шорткаты (`wall-quad-coverage.ts`, `wall-node-room-floor.ts`,
`wall-node-corners.ts`, `wall-node-openings.ts`, `wall-geometry-batch.ts`,
`wall-local-replacements.ts`), универсальный путь `unionWallShellGeometry`/
`subtractWallOpeningCuts`, `junction-limits.ts`/`houseplan-editor-runtime.ts`
наблюдательный колбэк `onRoomInnerContour`, rAF/указатель/pointerup-flush/
cancel (`wall-node-editor.ts` до 90d8702e), независимый фикс камеры/capture
(`d9dfc471`), backend parity, трейлеры/changelog коммитов r1, регистрация
AC5-гейта базовой версии.

## Находки

### Medium — `safeAddedEdges` не проверяет пересечение новых рёбер друг с другом (в скоупе AC2)

**Файл:** `src/wall-boundary-splice.ts:183-207` (`safeAddedEdges`), используется в `splice()` на `src/wall-boundary-splice.ts:268`.

**Суть:** Функция обязана доказать, что ни одно НОВОЕ ребро (`added`,
`owner: null`) не создаёт пересечения, прежде чем патч будет принят вместо
полного пересчёта. Фактически она сравнивает каждое `added`-ребро только с
`retained` — рёбрами из `resultEdges`, у которых `owner !== null`, то есть
только со СТАРЫМИ (унаследованными от `baselineResult`) рёбрами:
```
const retained = [...resultEdges.values()].filter(edge => edge.owner !== null)...
for (const [, next] of added) { for (const old of retained) { ... } }
```
Два элемента `added` между собой никогда не сравниваются. Реконструкция
колец дальше в `splice()` (строки ~269-298) обходит рёбра строго по точной
идентичности вершин (`pointKey`) — пересечение двух новых рёбер НЕ в общей
вершине для этого обхода невидимо: получатся два геометрически
пересекающихся, но формально «не связанных» кольца. `validOutputHierarchy`
проверяет вложенность одной выборочной точкой (первой вершиной кольца) по
правилу winding — это ловит некоторые касания в этой точке, но не
самопересечение между двумя кольцами в произвольном месте. Собственный
doc-комментарий модуля заявляет «reject new crossings» как один из
инвариантов, но инвариант фактически покрывает только new-vs-old, не
new-vs-new.

**Почему это в скоупе и не поймано тестами:** `test/wall-boundary-splice.test.mjs`
прямо документирует это как ДОПУЩЕНИЕ, а не как доказанный инвариант —
комментарий в начале файла говорит, что входы никогда не являются
«an invented self-crossing ring intended to bypass that precondition»,
то есть модуль полагается на непроверенную гарантию вызывающей стороны,
что `current` остаётся простым (без самопересечений). Я не нашёл явного
доказательства в `wall-node-preview.ts`/`wall-thickness.ts`, что `current`
гарантированно простой геометрии ПЕРЕД тем, как он попадает в
`wallBooleanIncremental`/`spliceWallBooleanBoundary`. Мутанта на
`safeAddedEdges` в `scripts/mutation-registry.mjs` нет вовсе (grep не
находит упоминаний этой функции в реестре) — третий столбец «чем
краснеет» для этого инварианта пуст, причём не только для узкого
подслучая, а для всей функции.

**Почему Medium, не High:** это пробел в доказательстве защитного AC
(несимметрично описанному в тесте допущению об отсутствии самопересечений
во входе), а не продемонстрированный репродюсируемый путь к принятию
видимо неверной геометрии — для реальной геометрии связного этажа после
`applyNodeMove`/`canonicalizeConfigGeometryInPlace` локальный
самопересекающийся контур в патчуемой области не воспроизведён ни одним
известным repro. Калибровка — та же, что у Medium r1 (`src/wall-shell-union.ts`):
пробел в доказательстве, не демонстрация отказа.

**Что сделать:** добавить попарную проверку пересечений внутри `added`
(тем же точным bigint-ориентационным аппаратом `exactPredicates`, что уже
используется для added×retained), либо явно и проверяемо (тестом/типом)
гарантировать простоту `current` до вызова `spliceWallBooleanBoundary`, и
добавить mutant-анchor на `safeAddedEdges`.

Находка в скоупе задачи (файл — центр новой подсистемы AC2 этой дельты) →
жёлтый вердикт, возврат автору, отдельный issue не заводится.

## Что проверено и корректно

- **Закрытие r1 Medium** — см. таблицу выше; доказательство построено на
  реальной геометрии (`union`/`difference` как независимый оракул).
- **`wall-boundary-splice.ts` — остальной периметр.** Identity-карта рёбер
  (`stableOperandOwners`), глобальный (не попарный) bounding box изменений
  против фикс-операндов (тест `test/wall-boundary-splice.test.mjs:78`
  строит сценарий «фикс-операнд охвачен петлёй несоприкасающихся по
  отдельности рёбер» реальной геометрией), точный ориентационный тест
  added×retained пересечений включая коллинеарные перекрытия, независимая
  от входа проверка вложенности результата. Тесты :91,100,126 используют
  настоящие геометрические конструкции (включая one-ULP разделение/
  касание) с оракулом `union`/`difference`. Любая прочая неопределённость —
  `return null`, откат на полный boolean.
- **`wall-intersection-signature.ts` (AC2).** Ключ = полный subject JSON +
  мультимножество рёбер (не Set — чувствительность к winding сохранена);
  `LIMIT`-обрезание — безопасный промах, не ложное совпадение; проверено
  независимо вторым агентом через явную проверку единственной доверенной
  точки вызова (`wall-boolean-baseline.ts`). Мутант
  `node-intersection-signature-forgets-full-subject` ловится тестом
  «signature is full-subject identity».
- **`wall-boolean-incremental.ts` рефакторинг 90d8702e.** Вынос
  сериализации операндов в единственный вызов (`WallBooleanBaseline.apply`)
  — семантически эквивалентен прежнему варианту; `record()` никогда не
  строит baseline из уже переиспользованного (spliced) результата —
  только из результата настоящего `clipping[operation]`, поэтому baseline
  не может накопить цепочку непроверенных патчей.
- **`wall-thickness.ts` `lineIntersect` (AC1).** Точный ось-снэп включается
  по строгому `=== 0`, подтверждено адверсариальным тестом «one-ULP
  near-axis direction remains oblique instead of snapping»; NaN/Infinity/−0
  поведение не изменено. Используется и вне Select (corner mitres) — не
  продемонстрирована регрессия ни одним существующим тестом/golden.
- **Esc-переживание baseline (AC3).** Условие реюза — authoritative config
  object + revision + space + ПОЛНЫЙ JSON выбранного конфига, проверено до
  identity-fast-path; второй агент вручную подтвердил, что удаление строки
  `if (baselineGeometry?.signature !== signature) retire();`
  (`wall-node-card-adapter.ts:87`) ломает ровно тест
  «in-place proof-input changes invalidate...». «Switching local components
  replaces the single retained baseline instead of keeping a per-node map» —
  прямое соответствие требованию ТЗ «никакой per-node map».
- **`syncPaint` дифф стилей (AC3).** Второй агент вручную подтвердил, что
  удаление строки, фиксирующей «хост независимо переписал стиль»
  (`wall-node-editor.ts:363`), ломает ровно тесты «full host render inline
  updates are reapplied...» и «host writes just before terminal cleanup are
  not overwritten by stale originals» — это настоящие adversarial-тесты
  (мутируют `element.style` напрямую посреди теста), не happy path.
  20-кратный цикл замены detached-элементов проверяет отсутствие
  накопления в `touched`.
- **View-изоляция.** `WallBooleanBaseline`/`wall-node-card-adapter.ts`
  подключаются единственно через ленивый `import()` в
  `houseplan-editor-runtime.ts:920`; `node-editor-bundle-budget.mjs`
  CI-гейт проверяет отсутствие маркера кэша вне Select-графа. Отдельно
  подтверждено: смена режима/инструмента/этажа уже вызывала
  `nodeMove?.cancel()` до этой дельты, 90d8702e лишь добавляет внутрь
  `cancel()` вызов `context()`, который и ретайрит baseline — новых
  слушателей или фоновой работы для View не добавлено.
- **Бюджет/трейлеры/гейт AC5.** Потолок Select-only поднят 14→18 KiB по
  явному предварительному разрешению владельца в самом ТЗ; факт/причина
  записаны в issue (комментарий 6072401642) в том же коммите (`a249d62d`),
  прочие потолки не меняются — одно число (raw bundle 2 780 814→2 792 454),
  один источник (`scripts/monolith-baseline.json`). Все три коммита дельты
  несут `Issue: #834`/`User-Visible: yes` и правят оба CHANGELOG в том же
  коммите. `scripts/smoke-links.mjs` связывает все новые/изменённые файлы
  дельты с `smoke_wall_node_connected.mjs`.
- **Mutation-registry.** Девять из десяти новых якорей дельты патчат точно
  ту строку, что существует в файле на `90d8702e`, и их guard-тесты
  геометрически/сценарно привязаны к заявленному отказу (подтверждено и
  мной, и обоими агентами вручную на нескольких якорях). Десятый случай —
  отсутствие якоря на `safeAddedEdges` — см. находку выше.

## Чего не проверял

- **`npx tsc --noEmit`, `npm test`, `npm run build` + сверка бандла,
  `npm run golden:verify`, `node scripts/model-invariants.mjs`,
  `pytest tests_backend`/junction TS/Python parity, `node scripts/mutation-gate.mjs --check` —
  не перегонял сам.** Validate на точном SHA `90d8702e26ca973a5b8149d88f793579d680b60e`
  зелёный (run `37875962990`) — дешёвые гейты сошлись на этом прогоне.
  Мутанты реестра на треке `ask` в разработке не гоняются (ночной прогон,
  #709) — отсутствие прогона само по себе не находка (находка — отсутствие
  самого якоря на `safeAddedEdges`, что я проверил grep'ом по исходнику
  реестра, а не отсутствием ночного прогона).
- **Браузерный AC4-протокол (native pointer, 60×8 жестов, калибровка).**
  Не исполнял сам; полагаюсь на зелёный `smoke_wall_node_connected` в
  составе прошедшего Validate и на числовые таблицы автора в хендоффах
  (локальные, не CI-числа, явно помеченные автором как таковые).
- **Воспроизведение сценария находки на реальном fixture.** Не строил сам
  repro, где `applyNodeMove` на связном 8-комнатном fixture действительно
  производит локально самопересекающийся `current` в патчуемой области —
  находка основана на отсутствии доказательства в коде/тестах, а не на
  построенном мной контрпримере с реальным деревом вызовов редактора.
- **Полный HA-harness (`test_ha_*.py`).** Вне скоупа дельты, не проверялся.
- **Полные preset/golden/perf наборы.** Предрелизный гейт, не гейт ревью
  (§8); сошлись на зелёном Validate материала.

## Вердикт

High: 0 · Medium: 1 (в скоупе). Находка r1 закрыта доказательно. Новая
находка — `safeAddedEdges` (`src/wall-boundary-splice.ts:183-207`) не
проверяет пересечение новых рёбер друг с другом, и на эту функцию вовсе
нет mutant-якоря; это пробел в доказательстве защитного AC2 для новой
подсистемы локального переиспользования geometry, не демонстрированный
путь отказа. Остальной периметр дельты (закрытие r1, `wall-intersection-signature.ts`,
`wall-boolean-incremental.ts`, точный ось-снэп, Esc-переживание baseline,
дифф стилей превью, бюджет/трейлеры/гейты/View-изоляция) проверен и
корректен, включая независимую перепроверку двумя параллельными агентами.
Жёлтый вердикт, возврат автору для усиления `safeAddedEdges`
(added×added проверка пересечений либо доказанная простота `current` до
splice) и добавления mutant-якоря.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/834-node-geometry-performance`, коммит `90d8702e26ca` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9511fbd1527c3a68bf82933fa8674bbb00491be8`
  ```
  git log --all --format='%H %T' | grep 9511fbd1527c
  ```
- Тело issue: `748943c2a398aa56ed4fe383b98244248d65da00d99180a3263b27037395bc87`
- Вердикт конвейера: `yellow` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4428 output_tokens=121701 cache_creation_input_tokens=370470 cache_read_input_tokens=9686827 num_turns=82 -->
