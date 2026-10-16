# CODE-REVIEW-898-r1

Issue: #898 · этап code · заход r1 · блокирующих циклов 0/2 (track:show) · трек show
Материал: ветка `issue/898-raise-tight-ceilings`, коммит
`b8bf8cf27a55d16635dbaa284882e6e6bd980e62` (рабочая копия на нём,
`git diff origin/dev...HEAD`; `git rev-parse HEAD` сверен перед итогом).

## Скоуп

Решение владельца 14.10.2026: поднять на 10 % (округление вверх) все потолки
гейтов, у которых запас меньше 10 %, по инвентаризации на `dev` `0a03bd6f`.
Один коммит, без файлов класса A (`src/**`, Python, манифесты, i18n) — входит
как инфраструктура (§1), классы B (скрипты/тесты/демо-перф) и C (документация).

Изменённые файлы: `scripts/bundle-budget.mjs`, `scripts/node-editor-bundle-budget.mjs`,
`scripts/monolith-baseline.json`, `test/core-file-budget.test.mjs`,
`test/mutation-gate.test.mjs`, `test/optimize-plans-dialog.test.mjs`,
`test/performance-budget.test.mjs`, `test/smoke-select.test.mjs`,
`test/testing-doc.test.mjs`, `test/validate-workflow.test.mjs`,
`demo/performance/budgets-interaction-smoke.json`,
`demo/performance/budgets-large-house-interaction.json`,
`demo/smoke_wall_node_connected.mjs`, `demo/performance/README.md`,
`docs/DEVELOPMENT.md`, `docs/release-ledger/v1.80.1/898.json` (новый).

Работа из `docs/SCOPE.md`: прямо ни одной строки не обслуживает — это не
продуктовая функция, а обслуживание гейтов, которые защищают J1–J7 (не дают
бандлу/связности/перфу незаметно деградировать). Отнесение к «инфраструктуре»
в §1 для такой работы корректно.

## Маршрут по критериям §5 (трек show)

Задача без строки `Трек: show — решение владельца` в комментариях — метка
`track:show` непроверена владельцем явно, значит критерии проверяю сам:

| Критерий | Вывод |
|---|---|
| `complexity` | 2/10 по оценке автора, подтверждаю: правка одной арифметической формулой, без ветвлений и новой логики |
| `surfaces` | Много файлов, но одна механика (потолок × 1,1, округление вверх) — не бандл из разных решений, а один детерминированный проход по уже проинвентаризированному списку |
| `migration` | Нет ни новых полей конфига, ни миграции |
| `ux-contract` | Нет `src/**`, видимое поведение карточки не меняется |
| `perf-touch` | Реальная производительность и touch-обработка не меняются — ни один файл `src/**` не тронут, байты бандла и код рантайма идентичны `dev`. Меняются только пороги CI-гейтов (во сколько раз регрессия должна вырасти, чтобы гейт покраснел). Канонический контракт `docs/TOUCH-SUPPORT.md` этих цифр не фиксирует (p95/input-to-paint/latency там не встречаются) — значит документированный touch-контракт не тронут. Риск снижения чувствительности (сводная interaction-серия больше не ниже проваленного результата 3501.5 мс) раскрыт явно и трижды: в теле issue, в коммите и в `demo/performance/README.md` — это не скрытая находка |
| `undocumented` | Каждое число заранее названо владельцем в теле issue и теперь — в комментариях констант, `demo/performance/README.md`, `docs/DEVELOPMENT.md`; решать было нечего |

Вывод: `route: fix`, `reclassify` не требуется ни по одному критерию.

## Как проверялось

Дешёвые гейты на этом SHA уже зелёные (ссылка автора и владельца на
Validate-прогон b8bf8cf2, success,
https://github.com/Matysh/houseplan-card/actions/runs/38617306653 — job
«Фронтенд: типы, юниты, мутанты, синхрон бандла» включает `npm ci`, `Build`,
`Unit tests`, «Мёртвый код и связность монолита», все зелёные). Дополнительно
перепрогнал сам — часть вручную дешёвых AC-гейтов не входит в типовой Validate
набор:

| Гейт | Команда | Результат |
|---|---|---|
| Полный unit-набор (включает все изменённые test/*.test.mjs) | `rm -rf test-build && npm test` (чистая пересборка) | 4627 тестов, pass 4626, fail **0**, skipped 1 — зелёный |
| Бюджет бандла | `npm run bundle:budget` | `initial View: 309892 B gzip (потолок 340882 B +2000, budget 352000 B, headroom 42108 B)` и все остальные графы — ни один не красный |
| Граф Select-only | `node scripts/node-editor-bundle-budget.mjs` | `17944 B gzip, budget 20276` — зелёный |
| Мёртвый код/связность | `node scripts/unused-locals-gate.mjs` | `ok мёртвого кода нет`, exit 0; связность ниже базы — ожидаемо, база только что поднята |
| Храповики | `node scripts/ratchets.mjs report --warn` | 12 «рыхлых» (все поднятые в этой задаче), exit 0 — совпадает с ожиданием АС2 |
| Сборка цела | `node scripts/bundle-policy.mjs --verify HEAD` | «свежая сборка dist цела» — зелёный |
| `any` в новом коде | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 0 добавленных строк в `src/**`, зелёный |
| Приватные записи смоков | `node scripts/no-new-private-writes.mjs --base origin/dev --head HEAD` | 3 строки в 1 файле (`demo/smoke_wall_node_connected.mjs`, сами бюджетные числа) — новых записей в приватное состояние нет |
| Какие смоки нужны по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD --json` | `noExecutableDiff: true`, `visualMinimum: []` — исполняемого продуктового диффа нет, смоки в браузере не требуются |

`npm run gate:small` целиком не прогонял — его компоненты (typecheck/test,
no-new-any, no-new-private-writes, smoke-select, bundle-policy --verify,
unused-locals-gate) прогнаны по отдельности выше и все зелёные; дублировать
обёртку не стал ради бюджета раунда.

### AC1 — новые числа на месте (арифметика проверена построчно)

Правило: новый потолок = старый × 1,1, округление вверх; проверил каждое число
диффа:

| Файл · константа | Было → стало | 1,1× (точно) | Совпадает |
|---|---|---|---|
| `bundle-budget.mjs` `INITIAL_VIEW_GZIP_CEILING` | 309892 → 340882 | 340881.2 → ⌈⌉=340882 | да |
| `bundle-budget.mjs` `INITIAL_VIEW_GZIP_BUDGET` | 320000 → 352000 | 352000.0 | да |
| `bundle-budget.mjs` `INITIAL_VIEW_RECALIBRATION_GZIP_BYTES` | 301037 → 320000 | н/д — решение владельца (прежняя стена), не замер, как и написано в ТЗ и в комментарии кода | да |
| `LAZY_EDITOR_GZIP_CEILING` | 259060 → 284966 | 284966.0 | да |
| `LAZY_ONBOARDING_GZIP_CEILING` | 28578 → 31436 | 31435.8 → 31436 | да |
| `LAZY_FURNITURE_ART_GZIP_CEILING` | 16940 → 18634 | 18634.0 | да |
| `LAZY_LED_GZIP_CEILING` / `..._EDITOR_...` | 11264 → 12391 | 12390.4 → 12391 | да |
| `node-editor-bundle-budget.mjs` `budget` | 18432 → 20276 | 20275.2 → 20276 | да |
| `monolith-baseline.json` delegates/portMembers/hostRefs/portPrivates/harnessPrivates/bundleBytes | 153→169, 361→398, 5317→5849, 106→117, 102→113, 2859899→3145889 | 168.3→169, 397.1→398, 5848.7→5849, 116.6→117, 112.2→113, 3145888.9→3145889 | да, все |
| `core-file-budget.test.mjs` houseplan-card.ts / editor-runtime.ts | 12966→14263, 12131→13345 | 14262.6→14263, 13344.1→13345 | да |
| `mutation-gate.test.mjs` gate/execution | <300→<330, <250→<275 | 330.0, 275.0 | да |
| `optimize-plans-dialog.test.mjs` port | ≤20→≤22 | 22.0 | да |
| `testing-doc.test.mjs` TESTING.md строк | ≤800→≤880 | 880.0 | да |
| `validate-workflow.test.mjs` окно job | 1800→1980 | 1980.0 | да |
| `smoke-select.test.mjs` визуальный минимум | 5–8→5–9 | 8.8→9 | да |
| `smoke_wall_node_connected.mjs` mainThreadP95/inputToPaint | 50→55, 110→121 | 55.0, 121.0 | да |
| `budgets-*-interaction*.json` firstStableRenderMs/interactionSeriesMs/editorSeries | 3400→3740, 3300→3630, 150→165 | 3740.0, 3630.0, 165.0 | да |

Чем доказано падение (AC1 — лимитный/защитный тип, таблица «чем краснеет»):

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| Потолок `firstStableRenderMs`/`interactionSeriesMs` = 3740/3630 | `test/performance-budget.test.mjs`, `assert.equal(ceiling, 3740)` и `assert.equal(..., 3630)` | Отрицательный случай проверил сам: вернул 3400/3300 в обоих budgets-JSON и прогнал `node --test test/performance-budget.test.mjs` — упало 2 теста из 22 (`#692 первый стабильный кадр…`, `interaction aggregate keeps hosted-runner headroom…`); файлы восстановлены `cp` из бэкапа, `git status` чист |
| Потолок `houseplan-card.ts` = 14263 строк | `test/core-file-budget.test.mjs`, `coreBudgetViolations` | Отрицательный случай проверил сам: временно поставил `100` вместо `14263` — `not ok 1 - ядра не выросли выше потолка беты…`; затем восстановил файл из бэкапа |
| Остальные потолки (bundle-budget, monolith-baseline, mutation-gate, optimize-plans-dialog, testing-doc, validate-workflow, smoke-select, smoke_wall_node_connected) | Те же тесты, тот же паттерн (`assert.equal`/`assert.ok` на литеральное число или `assert.ok(x < N)`) | Не исполнял по каждому отдельно — конструкция идентична двум проверенным выше (жёсткое равенство/сравнение с захардкоженным числом), разобрано чтением, не исполнением: при откате файла к старому числу `assert` на буквальное значение не может не покраснеть |

### AC2 — гейты зелёные

Таблица выше («Как проверялось») покрывает `bundle:budget`,
`unused-locals-gate`, `ratchets report --warn`; `gate:small` не прогонял целиком
(обоснование там же), прогнал зафиксированные в нём отдельные шаги. Храповики
печатаются «рыхлыми» — ожидаемо по ТЗ, не красит.

### AC3 — перф-бюджеты согласованы

`test/performance-budget.test.mjs` в полном `npm test`-прогоне зелёный; смок и
полный профиль читают одинаковый потолок (`assert.equal(smoke..., full...)` в
обоих тестах — построчно сверил, совпадает). Правило #692 пересчитано на 3740
мс и верхнюю границу 30 % — сам тест формулирует это неравенство и в прогоне
не падает.

## Трейлеры, релизный учёт, одно число — один источник

- `Issue: #898`, `User-Visible: no` — присутствуют, один коммит, один `Issue:`.
  `User-Visible: no` корректен: никакого видимого поведения карточки нет, оба
  CHANGELOG не тронуты — соответствует.
- `docs/release-ledger/v1.80.1/898.json`: `category: infra`, обоснование
  называет, что меняются только числа в скриптах/тестах/бюджетах и что
  поведение относительно v1.80.1 не меняется. Схема и пропуск поля `summary`
  совпадают с прецедентом той же категории (`638.json`, тоже `infra`, тоже без
  `summary`); `baseStable: v1.80.1` — действительно предыдущий стабильный тег
  (сверено `git tag`).
- Канон (комментарии у констант, `demo/performance/README.md`,
  `docs/DEVELOPMENT.md`) называет новые числа и ссылается на #898/решение
  владельца 2026-10-14 — сверено построчно в диффе, нигде не осталось старого
  числа без комментария или с противоречащим текстом. `docs/TESTING.md` сам по
  себе остался 800 строк (не правился) — укладывается в новый потолок 880,
  никакого отдельного обновления содержимого не требовалось.
- Одно число — один источник: каждая константа объявлена ровно в одном месте
  (`bundle-budget.mjs`, `monolith-baseline.json`, соответствующий `test/*.mjs`
  или `budgets-*.json`) и читается оттуда остальными — дублирования значения
  с риском разъехаться не нашёл.

## Что проверено и корректно

- Арифметика каждого из 20+ поднятых чисел (таблица AC1).
- Тесты, кодирующие новые потолки, реально способны падать (два независимых
  отрицательных прогона, см. таблицу «чем краснеет»); остальные — тот же
  паттерн, разобраны чтением.
- Полный `npm test` (чистая пересборка `test-build`) — 4626/4627 pass, 0 fail.
- `bundle:budget`, `node-editor-bundle-budget`, `unused-locals-gate`,
  `ratchets report --warn`, `bundle-policy --verify`, `no-new-any`,
  `no-new-private-writes`, `smoke-select` — все прогнаны лично, зелёные и
  совпадают с цифрами из хендоффа автора.
- Трейлеры, release-ledger, канон-документация.
- Критерии §5 трека `show` — пройдены все шесть, `route: fix`.

## Чего не проверял

- `npm run gate:small` целиком как одну обёртку — прогнал его шаги по
  отдельности (см. таблицу); не прогонял `smoke-select`-рекомендованные
  браузерные смоки, потому что сам `smoke-select` сообщил
  `noExecutableDiff: true` — продуктового диффа нет, Chromium не нужен (тело
  issue браузерный смок тоже не называет).
- Не гонял `golden:verify` — визуального риска в пути отрисовки нет (`src/**`
  не тронут), метка `ci:golden` не стоит и по правилу не должна.
- Не гонял мутанты — на `track:show` они не входят в разработку ни разу,
  ловит их ночной прогон (#709); реестр не содержит новых мутаций для этой
  задачи, что и ожидаемо для правки без `src/**`.
- Не гонял `pytest tests_backend` — Python не менялся.
- Не проверял обновление скриншотов документации — не гейт задачи (#697).
- Полностью доверился ранее опубликованному Validate-прогону для шагов, которые
  сам не дублировал повторно за пределами перечисленных выше (например,
  отдельным шардом смоков/golden в CI — они `skipped`, что ожидаемо при
  отсутствии сигналов `ci:full`/`ci:golden`).
- Технический нюанс среды: первая попытка прогнать тесты по отдельным файлам
  (`node --test test/optimize-plans-dialog.test.mjs` без предварительной чистой
  пересборки `test-build`) ловила `ERR_MODULE_NOT_FOUND` и локальный TS5011 —
  оказалось окружение (устаревший `test-build` от предыдущей частичной
  команды), не дефект кода: чистый `rm -rf test-build && npm test` прошёл
  полностью зелёным, как и CI.

## Находки

Не найдено ни одной High- или Medium-находки. Низкоуровневых (Low) замечаний,
требующих правки или снятия с записью, тоже не нашёл.

## Вердикт

Критерии трека `show` пройдены, доказательства AC полные (с отрицательными
случаями там, где это гейт лимитного типа), гейты, которые не покрывает
Validate, прогнаны лично и зелёные, трейлеры и release-ledger корректны.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/898-raise-tight-ceilings`, коммит `b8bf8cf27a55` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a8d2b8c4d6bb58d79a0fc1220510f8a43a43ff68`
  ```
  git log --all --format='%H %T' | grep a8d2b8c4d6bb
  ```
- Тело issue: `f83dd498c9a7da3d78d3528450004ef3d833be8f6df13d530285fac2e5586830`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ1OTcsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0Njk3MDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4NCwib3V0cHV0X3Rva2VucyI6NDkzNjYsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTQ2ODg1LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDkzMTI4OCwiY29zdFVzZEVzdGltYXRlIjoyLjA2NzYyNTZ9XSwidHVybnMiOjYzLCJkdXJhdGlvbk1zIjo5NzA0MTgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjA3MjMyMjYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4681 output_tokens=49386 cache_creation_input_tokens=146885 cache_read_input_tokens=4931288 num_turns=63 -->
