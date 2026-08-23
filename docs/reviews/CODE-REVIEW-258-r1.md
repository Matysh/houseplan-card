# CODE-REVIEW-258-r1

- Issue: [#258](https://github.com/Matysh/houseplan-card/issues/258) — «На 1.67.0-beta.4 после «Оптимизировать» появились белые клинья в местах схода стен»
- Ветка `issue/258-wall-key-storage-roundtrip`, коммит `28eaf86662819651b2c75e7423280f10820a757d`
- Этап: code (PROCESS.md §2.7)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4
- Вердикт: **жёлтый**

## Скоуп

ТЗ `docs/specs/258-wall-key-storage-roundtrip.md` описывает регресс: `wallKey()`
квантует середину стены через `Math.round`, и у стены нечётной длины в шагах
решётки середина попадает точно на границу округления. Точное узловое
представление вершины (`83/240`) и её девятизнаковое persisted-представление
(#224) дают два разных `key` для одного и того же ребра; `lookupWall()`
находит запись только по точному совпадению строки или терпимому запасу
ровно в полшага, а `thicknessCmAt()` — ещё и по точным `a/b` через
`exactCoveringWall()`. Реализация стабилизирует генерацию `key` near-grid
нормализацией endpoint'ов, добавляет строгий same-span lookup по точным `a/b`
между exact-key и legacy midpoint fallback, и пересобирает диагностику
`checkWallKeys` в `scripts/model-invariants.mjs`.

**Важное уточнение хронологии, которое меняет оценку скоупа.** Между
утверждением ТЗ (spec-review, зелёный, `docs/reviews/SPEC-REVIEW-258-r1.md`)
и завершением реализации владелец сам проверил исходный диагноз исполнением
на своих реальных экспортах и
[отозвал его](https://github.com/Matysh/houseplan-card/issues/258#issuecomment-5385705030):
переписанные Optimize ключи не меняют `wallIntervals`/`wallEdgeBodies`/
`buildMultiWallNodeMap` — тела стен и карта узлов побайтово идентичны
независимо от того, какой из двух ключей записан. Реальная причина белых
клиньев на скриншотах владельца осталась неизвестной; названы два других
следа (рост `wall-thickness.ts` на 760 строк в beta.4 от #249/#253, и
сплошное ребро без записи толщины, существовавшее уже на beta.3). Реализация
всё равно доведена по первоначальному контракту ТЗ — это осмысленное решение
(правит реальный, отдельно доказанный дефект класса «одно ребро — разные
ответы у потребителей»), но релиз-артефакты этой задачи заявляют, что именно
зарепорченный симптом устранён. Разбор ниже отдельно оценивает код (полностью
корректен по контракту ТЗ) и это продуктовое несоответствие.

## Как проверялось

1. Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` §2.7/§2.10/§7–§8/§12,
   `docs/WALL-THICKNESS.md`, `docs/CONFIG-COMPATIBILITY.md`,
   `docs/ARCHITECTURE.md` (участок Room Resize/wall key), тело issue #258 и
   **все** комментарии, включая отзыв диагноза и хендофф от 2026-08-23, и
   ТЗ/спек-ревью документ.
2. Первый заход код-ревью — разбор полный, без «дельты» (§2.10 неприменим).
3. `git diff origin/dev...HEAD --stat` — 25 файлов; продуктовый код —
   только `src/wall-thickness.ts` (+40/-…). Остальное: тесты, `scripts/**`
   (class B), `docs/**` (class C), `dist/**` +
   `custom_components/houseplan/frontend/**` (class D, сгенерированы).
4. Прочитан весь diff `src/wall-thickness.ts`: `keyEpsilon()`,
   `canonicalKeyCoordinate()`, изменённый `wallKey()`, изменённый
   `lookupWall()` (новый same-span шаг между exact-key и legacy fallback).
   Отдельно проверено, что `thicknessCmAt()` (:319) и `cmsForPoly()` (:1366)
   оба вызывают именно этот `lookupWall()` — то есть AC2/AC3 «один resolved
   wall entry для всех структурных потребителей» действительно следует из
   единой точки входа, а не из совпадения двух отдельных формул.
5. Прочитан diff `scripts/model-invariants.mjs`, `scripts/mutation-gate.mjs`,
   `scripts/smoke-links.mjs`, все новые/изменённые тесты
   (`test/wall-thickness.test.mjs`, `test/plan-optimizer.test.mjs`,
   `test/model-invariants.test.mjs`, `test/golden-matrix.test.mjs`,
   `demo/golden/harness.mjs`, `demo/golden/matrix.mjs`,
   `demo/smoke_wall_key_roundtrip.mjs`), документация
   (`docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`,
   `docs/CONFIG-COMPATIBILITY.md`, `docs/TESTING.md`, оба changelog).
6. Прогнаны гейты (таблица ниже) и три новых/изменённых mutation-анкера
   отдельно, чтобы убедиться, что связанные с ними тесты умеют падать.

### Гейты

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 1159 passed, 0 failed, 0 skipped |
| Build + bundle parity | `npm run build && npm run bundle:sync` + `cmp` трёх копий | `dist/houseplan-card.js` = `custom_components/houseplan/frontend/houseplan-card.js` = `demo/srv/assets/houseplan-card.js` |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| Smoke selection | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 173 смоков в матрице; 2 «зарегистрированные связи»: `smoke_resize_wall_thickness.mjs` (← `closePoint`, `wallDir`), `smoke_wall_key_roundtrip.mjs` (← `canonicalKeyCoordinate`, `keyEpsilon`) — обе прогнаны |
| Целевые смоки | `node demo/smoke_wall_key_roundtrip.mjs`, `node demo/smoke_resize_wall_thickness.mjs` | оба `OK`, все под-проверки `true` |
| Model invariants | часть `npm test` (`test/model-invariants.test.mjs`, включает parity-тест копии `wallKey` и фикстур-sweep) | зелёный; отдельный `npm run invariants -- --config <файл>` не запускался — diff не даёт нового полного экспорта конфигурации сверх уже покрытых unit-фикстур, а `npm test` уже гоняет полную проверку по всем моделям проекта (демо-фикстуры + demo-стенд) |
| Mutation-анкеры (новые/изменённые) | `node scripts/mutation-gate.mjs --id=wall-key-storage-normalization-disabled` / `--id=wall-exact-span-fallback-disabled` / `--id=invariant-wall-key-storage-normalization-disabled` / `--id=invariant-keys-cry-wolf` / `--id=invariant-keys-hide-stale-observation` | все 5: «тест покраснел, как обязан» — тесты действительно умеют падать |
| Golden | часть `npm test` (`test/golden-matrix.test.mjs`); `npm run golden:verify` (браузерный рендер) не запускался | сценарий `wall-key-roundtrip-view-dark` зарегистрирован и покрыт unit-проверкой контракта; baseline не принимался (правильно — только через полный Linux CI artifact) |
| Backend | — | не запускался: diff не трогает `custom_components/**/*.py` |
| Performance | — | не запускался: AC не называет перф-эффект, спецификация явно фиксирует `O(1)`/`O(W)` без изменений |

**Не прогнано и почему:** полный browser-`golden:verify` и полный набор из 173
смоков — задача касается одного узкого T-стыка и явно выбранных потребителей;
`smoke-select` назвал ровно два релевантных смока, оба прогнаны, остальные 171
не относятся к диффу и полный прогон — предрелизный гейт, не гейт ревью.
`pytest tests_backend` — diff не трогает Python. Отдельный `npm run invariants
-- --config <файл>` на внешнем экспорте — не требовался: diff не добавляет
новую геометрию, которую не покрыли бы уже прогнанные unit-фикстуры и полный
sweep внутри `npm test`.

## Проверка AC

| AC | Статус | Как доказано |
|---|---|---|
| AC1 (один key для exact/9-знака, odd/even, ±, reversed) | Выполнен | `test/wall-thickness.test.mjs` «issue 258 wallKey survives...» — 4 кейса + негативный тест на epsilon-границу; mutant `wall-key-storage-normalization-disabled` убивается |
| AC2 (строгий same-span lookup, без parent/child/neighbour/parallel) | Выполнен | `test/wall-thickness.test.mjs` «issue 258 exact-span lookup...» — оба варианта ключа находят 29 см, явные негативные кейсы (`broken-parent/child/neighbour/parallel`) не принимаются; render-space (`coordScale`) тоже проверен; mutant `wall-exact-span-fallback-disabled` убивается |
| AC3 (Optimize канонизирует key, preview не пишет, идемпотентность после roundtrip) | Выполнен | `test/plan-optimizer.test.mjs` «issue 258 Optimize canonicalizes...» — deepEqual на preview, `changed:true`/`canonicalized:1` на первом Apply, `changed:false` на in-memory и backend-echo повторе. Код в `plan-optimizer.ts` не менялся: `rekeyWallsAfterMove()`/canonicalизация уже вызывают исправленный `wallKey()` — прочитано и подтверждено, отдельная вторая формула не добавлена |
| AC4 (инвариант сообщает оба mismatch, парность с production `wallKey`) | Выполнен, но **изменена формулировка относительно ТЗ §8 — явно заявлено автором** | `checkWallKeys()` больше не возвращает `violations` (массив всегда пуст) — несовпадение репортится только как `notes`/observation. Автор прямо попросил ревьюера отдельно оценить это отступление. Технически обоснованно: после фикса `lookupWall()` резолвит любую запись с валидными `a/b` независимо от старого key через same-span шаг, поэтому «нарушение» никогда не воспроизводимо для записи с координатами — а `checkWallKeys` как «hard violation» немедленно покрасил бы `demo/fixtures/large-house.mjs`/`visual-matrix.mjs`, чьи ключи не по контракту по другой причине (заведено отдельно, #260). Даунгрейд подтверждён тестом «#258: старый и неразбираемый compatibility key — наблюдение» и двумя mutation-анкерами (`invariant-keys-cry-wolf`, `invariant-keys-hide-stale-observation`), оба убиваются. Принимаю как согласованное с текущим `dev` решение, а не как найденную находку |
| AC5 (T-node без клина во всех потребителях до/после Optimize/reload) | Выполнен для минимизированного T-fixture из issue | `demo/smoke_wall_key_roundtrip.mjs` — прогнан, `OK`, 24 под-проверки `true` (Plan/View/kiosk/Static/hidden-Iso/clean-floor/light-barrier × canonical/affected); unit `test/wall-thickness.test.mjs` «issue 258 repaired span reaches intervals, junction nodes and masonry» — реальная геометрическая проба `assertProbeInside` |
| AC6 (golden light/dark T-node) | Выполнен по прецеденту проекта | Сценарий `wall-key-roundtrip-view-dark` добавлен и покрыт `test/golden-matrix.test.mjs`; только dark-вариант — совпадает с прецедентом трёх похожих T-стыковых сценариев (#249/#253: `wall-junctions-view-dark`, `junction-patch-resilience-view-dark`, `multiwall-junction-bevel-view-dark`), которые тоже dark-only; baseline не принимался локально (правильно) |
| AC7 (регрессии: legacy key-only, parent inheritance, #253, #249, #248, openings, two-ray) | Выполнен | Полный `npm test` зелёный (1159/1159), включая все именованные регрессионные наборы; новых провалов не внесено |
| AC8 (implementation loop + provenance) | Выполнен | `typecheck`/`test`/`build`/parity/`check-docs` — все зелёные (см. таблицу гейтов); коммит несёт `Issue: #258` / `User-Visible: yes`; оба changelog правлены в том же коммите |

## Находки

### Medium (в скоупе задачи — правится в ней же)

**Release-артефакты заявляют больше, чем доказано, и противоречат собственному
расследованию владельца в этом же issue.**

- Файл: `docs/CHANGELOG.md` (и `docs/CHANGELOG.ru.md`)
- Итог: «Thick-wall T-junctions no longer develop white wedges after
  “Optimize plans”» / «После «Оптимизировать планы» в T-образных стыках
  толстых стен больше не появляются белые клинья» — безусловное утверждение,
  что именно зарепорченный в #258 симптом устранён.
- Сценарий, в котором это ломается: владелец обновляется на бету с этим
  коммитом, открывает свой реальный план (тот самый, со скриншотов), нажимает
  «Оптимизировать» — и, по его же собственному измерению
  ([комментарий](https://github.com/Matysh/houseplan-card/issues/258#issuecomment-5385705030)),
  `wallEdgeBodies`/карта узлов для его двух реальных пространств не меняются
  ни на бит между старым и новым кодом ключа. Если клинья на его скриншотах
  вызваны не этим (а иным следом — код #249/#253 или ребро без толщины,
  подробности в новом [#261](https://github.com/Matysh/houseplan-card/issues/261)),
  changelog утверждает то, что не подтверждено, и создаёт основание закрыть
  #258 без бета-регрессии, хотя визуальный дефект, из-за которого issue был
  заведён, может остаться на месте.
- Почему это в скоупе и не High: код и все AC1–AC8 корректны и полностью
  доказаны — правки не требуют переписывания реализации, только формулировки
  release-артефактов (§13 ТЗ прямо включает их в DoD задачи). Достаточно
  переформулировать записи `CHANGELOG.md`/`.ru.md` так, чтобы они описывали
  фактически исправленный дефект («несогласованность потребителей толщины
  стены при устаревшем/пересчитанном compatibility-key после Optimize»), а не
  безусловно закрывали зарепорченный визуальный симптом. Тот же нюанс стоит
  отразить и в финальном комментарии/закрытии #258 — новый
  [#261](https://github.com/Matysh/houseplan-card/issues/261) уже открыт для
  отдельного расследования реальной причины.

### Low (снято с записью)

- `scripts/model-invariants.mjs`, `titles` внутри `report()`: ключ `wall_key:
  'Записи толщины, которые не найдутся по ключу'` теперь мёртв — `wall_key`
  как `kind` violation больше никогда не push'ится (см. AC4 выше, `violations`
  для этого инварианта теперь всегда `[]`). Не влияет на поведение — вывод
  просто никогда не использует эту строку. Не блокирую: тривиальная
  косметика, безопасно оставить или почистить в следующей правке того же
  файла.

## Что проверено и корректно

- Единая точка генерации key (`wallKey`) и единая точка резолва (`lookupWall`)
  — оба структурных потребителя (`thicknessCmAt`, `cmsForPoly`) проходят
  через один и тот же исправленный `lookupWall()`; вторая формула нигде не
  завелась.
- Near-grid нормализация консервативна: epsilon строго на порядки меньше
  половины шага решётки, легитимная off-grid геометрия не снапится
  (проверено тестом и mutant'ом).
- Same-span резолв — действительно same-span, не containment: negative-кейсы
  на parent/child/neighbour/parallel явно протестированы и не проходят.
- Optimize канонизирует ключ через уже существующий код (`rekeyWallsAfterMove`
  импортирует и использует исправленный `wallKey`), отдельной второй формулы
  оптимизатора не появилось; preview не мутирует, повторный вызов и
  backend-echo — no-op.
- Копия формулы в `scripts/model-invariants.mjs` прикреплена parity-тестом к
  продуктовой `wallKey` (как и предписывало ТЗ и практика #233/#234) —
  расхождение будет обнаружено автоматически.
- Три новых и два переработанных mutation-анкера действительно убивают
  соответствующие правки (проверено запуском каждого).
- Bundle parity (`dist` = `custom_components/.../frontend` = `demo/srv/assets`)
  и docs-fingerprint — в порядке; трейлеры коммита корректны, оба changelog
  правились в одном коммите с кодом.
- AC7 (регрессии #248/#249/#253/legacy key-only/two-ray/openings) не сломаны —
  полный `npm test` зелёный без единого нового провала.

## Чего не проверял

- Полный `npm run golden:verify` (браузерный рендеринг golden) и полный набор
  173 смоков — не требуется объёмом задачи; ограничился двумя смоками,
  названными `smoke-select`, плюс уже пройденной unit-частью golden-контракта.
- `python -m pytest tests_backend` — diff не касается `custom_components/**/*.py`.
- Perf-профили — AC не называет влияние на перф, а спецификация фиксирует
  неизменную асимптотику; не проверял исполнением, принял по чтению кода
  (линейный `lookupWall`, ни одного нового прохода по комнатам).
- Реальную причину белых клиньев на исходных скриншотах владельца — это вне
  моей роли ревьюера кода этой задачи; зафиксировано находкой выше и новым
  [#261](https://github.com/Matysh/houseplan-card/issues/261).

## Итог

Код и тесты для заявленного в ТЗ контракта (стабильный `wallKey`, строгий
same-span `lookupWall`, канонизация через Optimize, пересмотренная
диагностика инварианта) — корректны, полны и доказаны исполнением, включая
работающие mutation-анкеры. Единственная находка — Medium, в скоупе,
касается не кода, а точности формулировки release-артефактов, которые
безусловно заявляют устранение зарепорченного в #258 визуального симптома,
хотя собственное расследование владельца в этом же issue показывает, что
исправленный дефект не объясняет этот симптом на его реальных данных. Это
ровно случай «AC выполнены, но изменение не решает заявленный сценарий» —
жёлтый вердикт, возврат автору для правки формулировок в `docs/CHANGELOG.md`
и `docs/CHANGELOG.ru.md` (и, по желанию автора, уточнения в самом issue перед
закрытием).
