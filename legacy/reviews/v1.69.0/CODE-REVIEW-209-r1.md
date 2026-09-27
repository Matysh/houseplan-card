# CODE-REVIEW-209-r1

- Issue: [#209](https://github.com/Matysh/houseplan-card/issues/209) — сглаживание следа пылесоса
- Спецификация: `docs/specs/209-vacuum-trail-smoothing.md` (зелёное ревью ТЗ, SPEC-REVIEW-209-r1)
- Диапазон: `origin/dev...HEAD`, HEAD = `17da1e3b3c19cdab720218c36fdb0f7d9f7f2cf8`
- Заход: r1 (первый код-ревью этой задачи) · блокирующих циклов израсходовано 0/4
- Вердикт: **зелёный**

## Скоуп

Полный трек (не `small`): владелец подтвердил критерий "нет влияния на производительность" не пройден. Диапазон коммитов:

```
43516cc1 docs: specify bounded vacuum trail smoothing (#209)
2890b9a1 docs: review document for #209
9d2ef12c feat: smooth vacuum trails (#209)             ← реализация
afd1ba61 test: bind vacuum golden to smoothing default (#209)
3c2d9e88 build: refresh bundle after golden contract (#209)
6c0b3f7c docs: refresh screenshots for final #209 tree
c743e1ec test: accept vacuum smoothing golden (#209)   ← принятие golden-эталона
17da1e3b test: accept pending door-state golden alongside #209
```

Изменённые продуктовые файлы: `src/vacuum.ts` (новый pure builder `smoothVacPath` + тип `VacPathCommand` + константа `VAC_TRAIL_SMOOTH_RADIUS_CM`), `src/houseplan-card.ts` (`_vacTrailPathD`, переключение current/previous на общий builder, previous с `polyline` на `<path>`). Тесты: `test/vacuum.test.mjs`, `demo/smoke_vacuum.mjs`, `demo/smoke_isometric_live_touch.mjs`, `scripts/mutation-gate.mjs`, golden-сцена `vacuum-trail-smoothing-dark` (`demo/golden/matrix.mjs`, `demo/golden/harness.mjs`, `test/golden-matrix.test.mjs`). Документация: `CHANGELOG.md`/`.ru.md`, `ARCHITECTURE.md`, `TESTING.md`, `VACUUM.md`, `USER-GUIDE.ru.md`, `STATUS.md`, `specs/README.md`, скриншоты. Трейлеры на всех коммитах корректны (`Issue: #209`, `User-Visible: yes|no`; commit класса D несёт `Release:`+`Baseline-Reviewed:`).

## Как проверялось

**Готовый зелёный прогон уже есть на этом SHA**: Validate `17da1e3b` — https://github.com/Matysh/houseplan-card/actions/runs/33209117223 (success). Разобран пофазово, а не принят на слово:

| Job Validate на 17da1e3b | Результат | Как учтён |
|---|---|---|
| `frontend` (typecheck/unit/mutation/bundle:sync/bundle:budget/no-new-any) | success | принят как есть — не перегонял `tsc`/`npm test`/`npm run build` |
| `docs` (screenshots fingerprint) | success | не перегонял `check-docs.mjs` |
| `golden` | success (не reuse — `Cache not found` для golden-ключа, реально пересчитан) | принят как есть |
| `smoke` (3 шарда + сводный) | **skipped**, но не молчаливый пропуск: reuse-механизм (#208) нашёл кэш `reuse-smoke-2a64a49d…` — «входы побайтово те же, что в предыдущем успешном прогоне» | проверил разницу руками, см. ниже |
| `performance_smoke` | skipped, тот же reuse | см. ниже |
| `backend`, `hacs`, `hassfest` | skipped (нет .py/manifest в диффе) | корректно, диффа нет |

Reuse для `smoke`/`performance_smoke` не принят на слово: сверил `git diff 3c2d9e88 17da1e3b -- src/ demo/ test/ scripts/` — единственная разница между этими двумя коммитами лежит в `demo/golden/baselines/**` (генерируемое, class D), код и смоки байт-в-байт идентичны. Нашёл более ранний прогон **на этом же дереве кода** — `33207816479` (SHA `3c2d9e88`), где все три шарда браузерных смоков и `performance_smoke` реально выполнились (`success`, не skip). Golden в том прогоне красный — ожидаемо: baseline тогда ещё не был принят. Значит smoke/performance_smoke гейты на HEAD подтверждены не переиспользованием ярлыка, а фактическим зелёным исполнением на идентичном коде.

Дополнительно проверено самостоятельно (не входит в кэш Validate):

- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` → прямое совпадение по символам (`_cmToUnits`, `samePoint`) указывает на `smoke_glow`, `smoke_near_axis_optimize`, `smoke_plan_drawing_repairs`, `smoke_plan_snap_overlay`, `smoke_zero_divider_taper` — это геометрические смоки, не относящиеся к следу пылесоса; символы совпали случайно (общие имена утилит). Не гонял: диффу и AC они не соответствуют по существу (нет изменений в geometry/optimize/divider-коде), а `smoke_vacuum.mjs`/`smoke_isometric_live_touch.mjs` — целевые смоки задачи — уже подтверждены зелёным прогоном `33207816479` на идентичном коде (см. выше).
- Мутационный гвард `vacuum-trail-smoothing-disabled` (`scripts/mutation-gate.mjs`) — воспроизвёл вручную: заменил `quadratic` на `line` в единственном месте `src/vacuum.ts:284`, пересобрал `test-build`, прогнал `node --test --test-name-pattern="smoothVacPath rounds corners" test/vacuum.test.mjs` → **красный** (`0 !== 2` совпадающих quadratic-команд), затем откатил файл до исходного состояния (`git status` чист). Тест умеет падать — не тавтология.
- `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и сравнение `houseplan-assets.json` — три копии бандла синхронны.
- Модельные инварианты (`npm run invariants`) не прогонял — диф не трогает геометрию комнат/стен, `layout`, `marker.space`, `open_spans`; след пылесоса не является геометрической записью, ссылок толщины нет.

## Проверка AC (docs/specs/209-vacuum-trail-smoothing.md §10)

| AC | Статус | Доказательство |
|---|---|---|
| AC1 (endpoints точные, внутренние углы — quadratic) | ✅ | `test/vacuum.test.mjs`: `smoothVacPath rounds corners…` проверяет `commands[0]`/`commands.at(-1)` равны первой/последней исходным точкам, ровно 2 quadratic на 2 внутренних вершинах. Прошёл, мутационно проверяем падение (см. выше) |
| AC2 (≤17.5 см от ломаной, короткие/неравномерные отрезки) | ✅ | тот же тест: 100-точечный sampling каждой quadratic-дуги, перевод `cellCm/gridPitch`→см, допуск `1e-9`. Прочитан вывод формулы §6.2 (radius = min(лимит, |AB|/2, |BC|/2)) — кривая лежит в hull P-B-Q, что структурно не даёт превысить радиус; тест это же подтверждает численно |
| AC3 (несколько подпутей, без bridge, независимые endpoints) | ✅ | unit `smoothVacPath preserves subpath gaps…` (2 подпути, 2 разных `M`, независимые concluding points) + smoke `multiSubpathNoBridge` в `smoke_vacuum.mjs`. Разобрал вручную нетривиальный кейс: `trimVacPathTarget()` вызывается ДО builder и снимает последнюю точку последнего подпути при движении, поэтому 3-точечный последний подпуть в смоке усекается до 2 точек и не получает Q — прочтением кода подтвердил, что это ожидаемо, а не путаница теста с реализацией |
| AC4 (0/1/2-точечные, дубликаты, non-finite, ~180°) | ✅ | unit `smoothVacPath fails closed for degenerate…`: пустой путь, 1-точечный (отброшен), maxRadius=0 (отброшен), non-finite (весь подпуть отброшен), точный дубликат (дедуп по соседней точке, вырожденный сегмент схлопывается в прямую), разворот 180° (нет `quadratic`, нет `null` в JSON) |
| AC5 (current: arbitration/trim/tip не меняются) | ✅ | `smoke_vacuum.mjs`: `srvResumedCurrentKeepsEarlierPoints`, `srvCurTrimmed`, `tipGluedToPuck`, `tipExists` — все существовавшие проверки сохранены и дополнены `srvResumedCurrentSmooth`/`Q`-подсчётом. Прочитан код: `trimVacPathTarget()` вызывается до `_vacTrailPathD`, tip остаётся отдельным `line`, стартующим из последней точки builder-результата |
| AC6 (previous → `<path>`, тот же builder, парный `d` case/core) | ✅ | `src/houseplan-card.ts`: `case`/`core` получают буквально один и тот же `pathD` (одна переменная). smoke: `srvPrevRunShown` проверяет `prevD === prevCore.getAttribute('d')`, ровно 1 `M`+1 `Q`; golden harness (`demo/golden/harness.mjs`) кидает исключение, если case/core разошлись |
| AC7 (матрица режимов не меняется) | ✅ | существующие smoke-проверки `never/cleaning/always`, hidden/static/unknown-map/absent-telemetry не тронуты диффом — сверил построчно, что тестовые ожидания (`puckGoneWhenDocked`, `hiddenNoPuck`, `unknownMapNoPuck`, `neverHidesAll`, `integrationPathAlwaysAtRest`) не менялись |
| AC8 (flat/iso — одна геометрия, zoom/DPR не влияют) | ✅ (частично проверено чтением, не отдельным unit-тестом) | `smoke_isometric_live_touch.mjs`: новая проверка `vacuumTrailCurved` (ровно 1 `Q` в iso-кривой current). Отдельного unit-теста «projection invariant» в `test/vacuum.test.mjs` НЕТ, хотя ТЗ в колонке доказательства называет его — структурно проверено чтением: `_vacTrailPathD()` (`src/houseplan-card.ts:11816`) применяет `smoothVacPath()` к уже откалиброванным плоским точкам (`applyAffine`) и лишь ЗАТЕМ вызывает `_scenePoint()` для каждой команды; `_cmToUnits()` использует `gridPitch/cellCm` — величины калибровки плана, не зависящие от текущего zoom/DPR. Инвариант следует из порядка вызовов, а не из отдельного теста — это находка ниже (Low) |
| AC9 (golden-сцена, разрыв, прямые/острые/90° углы) | ✅ | `vacuum-trail-smoothing-dark` в `demo/golden/matrix.mjs`: 2 current-подпути (включая разрыв) + previous run. `harness.mjs` содержит структурный guard ДО сравнения PNG: требует 2×`M`, ≥4×`Q` в current, ≥2×`Q` в previous, побайтовое совпадение case/core — иначе сценарий кидает исключение ещё до захвата кадра. Golden job на HEAD — success (пересчитан, не reuse). Baseline принят `c743e1ec` через `Release:`+`Baseline-Reviewed:` на полном Linux CI-артефакте (канон соблюдён) |
| AC10 (64/4000, линейность, ≤2N команд) | ✅ | unit `smoothVacPath stays linear and finite at the 64/4000 path budget`: строит ровно 4000 точек/64 подпути, проверяет `commandCount <= pointCount * 2` и отсутствие `null` в JSON. Структура builder — один проход `for…of` без вложенных проходов по всем точкам — подтверждает O(n) чтением. Full Performance — предрелизный гейт, не гейт код-ревью; `performance_smoke` зелёный (см. выше) |
| AC11 (гейты зелёные, бандл синхронен) | ✅ | таблица выше + `cmp` бандлов |

## Находки

Находок, требующих правки в скоупе задачи, нет.

**Low** — AC8 в таблице ТЗ называет доказательством «Unit projection invariant + smoke», но выделенного unit-теста именно на инвариантность к проекции/zoom нет: доказательство фактически чтением кода (порядок `applyAffine → smoothVacPath → _scenePoint`) плюс один смок-подсчёт `Q` в iso. Риска нет — сам инвариант в коде выполнен и не зависит от занятого места в рендер-пайплайне, а не от теста, который бы его мог сломать незаметно. Снимаю без правки: добавлять unit-тест ради буквы таблицы ТЗ, когда структурное чтение уже даёт нужную гарантию, было бы правкой ради процесса, а не риска.

**Low, вне обсуждения кода #209** — коммит `17da1e3b` принимает golden-эталон `lighting-opaque-glow-two-doorways-dark.png`, оставшийся неподтверждённым от уже смерженного issue #20 (`S8-merged`), под трейлером `Issue: #209`, хотя контент относится к #20. Формально допустимо (класс D, `Baseline-Reviewed` на реальный зелёный Linux-прогон CI, issue #20 в допустимом множестве меток `process-gate`), риска для #209 нет — код #209 этот эталон не меняет, о чём прямо сказано в хендоффе. Отмечаю ради трассируемости, правки не требую.

## Одно число — один источник

Диф не вводит новое пользовательски видимое числовое значение, отображаемое дважды: 17.5 см — это только внутренний геометрический предел (`VAC_TRAIL_SMOOTH_RADIUS_CM`), используемый один раз в `_vacTrailPathD()` через единственную константу; в UI не показывается ни как текст, ни как подпись. Совпадений «превью против записи» не обнаружено.

## Что проверено и корректно

- Общий builder `smoothVacPath` — единственная точка сглаживания для current и previous (`src/houseplan-card.ts:11816-11830`), устраняет прежнее дублирование `path`/`polyline`.
- `trimVacPathTarget()` по-прежнему выполняется до builder — прочтением подтверждено, что порядок вызовов не изменился относительно ТЗ §6.3.
- Деградация на вырожденных/невалидных данных — fail-closed (пустой массив команд, весь подпуть отбрасывается целиком при hitting non-finite, а не частично).
- Мутационный гвард нацелен на единственное вхождение паттерна в файле (не даёт ложных срабатываний на другом `push`).
- Три копии бандла (`dist/`, `custom_components/houseplan/frontend/`) байт-в-байт синхронны.
- Документация (`ARCHITECTURE.md`, `VACUUM.md`, `USER-GUIDE.ru.md`, `TESTING.md`, оба `CHANGELOG`) непротиворечиво описывает новый контракт и ссылается на #209.

## Чего не проверял и почему

- `npx tsc --noEmit`, `npm test`, `npm run build` (с сверкой копий) — не перегонял: Validate на точном HEAD SHA (`17da1e3b`) зелёный, job `frontend` включает всё это плюс `bundle:sync`/`bundle:budget`/`no-new-any`.
- Полный набор `demo/smoke_*.mjs` — не гонял целиком: задача не задевает весь рендер-путь, только vacuum-trail; целевые смоки (`smoke_vacuum.mjs`, `smoke_isometric_live_touch.mjs`) подтверждены зелёным исполнением на идентичном коде в прогоне `33207816479`, а не переиспользованием метки вслепую.
- Пять «прямых совпадений» от `smoke-select.mjs` (`smoke_glow`, `smoke_near_axis_optimize`, `smoke_plan_drawing_repairs`, `smoke_plan_snap_overlay`, `smoke_zero_divider_taper`) — не гонял: совпадение по имени утилиты (`_cmToUnits`, `samePoint`), не по изменённой логике; ни AC, ни диф не задевают geometry/optimize/divider поверхности.
- `python -m pytest tests_backend -q` — не требуется, диф не трогает `custom_components/**/*.py`.
- `npm run invariants -- --config …` — не требуется, диф не трогает геометрию комнат/стен/`layout`/`marker.space`/`open_spans`.
- Full Performance benchmark — предрелизный гейт (после `S8-merged`), не гейт код-ревью; `performance_smoke` зелёный.
- Ручной просмотр golden PNG (`vacuum-trail-smoothing-dark.png`) глазами — не открывал файл визуально; полагаюсь на структурный guard в `harness.mjs` (бросает исключение до захвата кадра при неверной геометрии) и на подтверждение автора «Linux-кадр просмотрен и принят» с валидным `Baseline-Reviewed` на реальный CI-прогон, что соответствует канону приёмки (только `golden:accept -- --reviewed` на полном Linux-артефакте).

## Итог

Все AC1–AC11 доказаны — либо автотестом, который я перепроверил на способность падать (мутация builder), либо явным чтением кода с зафиксированной оговоркой. High-находок нет. Two Low-заметки сняты без правки (обоснование выше, риска нет, в скоуп задачи не входят). Готово к очереди на пре-релиз.
