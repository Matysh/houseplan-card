# CODE-REVIEW-1064-r1

Issue: #1064 — CI: увеличить общий бюджет full-smoke шарда до 35 минут без ослабления сценариев.
Трек: `track:show`. Заход: r1. Материал: `4dda29f77994c023ee9ee7adc8933e69aa91a920` (рабочая копия).
Блокирующих циклов: 0/2.

## Скоуп

Класс B (инфраструктура CI) + сопутствующая C-документация. Единственное
функциональное изменение — повышение `timeout-minutes` job `smoke` (full-smoke
шард) с 25 до 35 минут в каноническом `.github/workflows/validate.yml`, с
канонической регенерацией производного `validate-product.yml`. Сопровождается:

- обновлением двух существующих witness-тестов и добавлением двух новых
  (`test/validate-workflow.test.mjs`, `test/smoke-exception-guard.test.mjs`);
- документацией решения (`docs/DEVELOPMENT.md`, `docs/STATUS.md`);
- авторской release-ledger записью `docs/release-ledger/v1.82.0/1064.json`
  (категория `infra`);
- регенерацией `scripts/ci-registry-inventory.json` штатным `--write` после
  слияния `dev` (вторая авторская коммита) — часть добавленных путей
  (golden-baselines `decor-multiselect-*`, `device-offline-*`,
  `ui-1051-*`, `vacuum-history-*` и др.) принесена `Merge … origin/dev`
  (`fd18b21ff`, включающий принятый `600cebe08`), не этой задачей; сверено
  построчно `git show 4dda29f77 -- scripts/ci-registry-inventory.json` против
  `git diff origin/dev...HEAD` — различие объясняется исключительно слиянием.

Задача не задевает продуктовый код (`src/**`, `custom_components/**`), не
меняет видимое пользователю поведение — обслуживает инфраструктурную работу
по надёжности CI, а не строку Core user jobs из `docs/SCOPE.md` (ожидаемо для
infra/track:show).

## Как проверялось (независимый разбор)

Прослежен путь: единственная изменённая константа читается в одном месте
(`jobs.smoke.timeout-minutes` в `validate.yml`), транслируется генератором
`ci-profiles.mjs` в `validate-product.yml` без иной логики, и проверяется
статическим regex-тестом в двух независимых файлах теста (`validate-workflow.test.mjs`
новый тест, `smoke-exception-guard.test.mjs` существующий #434). Child timeout
180s/kill-after 10s, matrix `shard: [1,2,3]`, формула деления по индексу файла,
guard пустого шарда (`ran -eq 0`) и guard отказа (`fail=1`) — тело шага
`Smoke suite (шард … из 3)` в этом диффе не тронуто; его разбор подтверждает,
что единственное изменение — верхний job-бюджет, без ослабления ни одной
существующей защиты.

Отказные гипотезы: (1) рассинхрон `validate.yml`/`validate-product.yml` —
исключено `ci-profiles.mjs --check` (генератор зелёный, PASS, см. таблицу);
(2) скрытая зависимость другого job/workflow от литерала «25 минут» —
не найдена (`grep` по обоим файлам); (3) устаревший/несвежий committed
inventory после слияния — исключено `ci-registry-inventory.mjs --check`
(PASS); (4) рассинхрон счётчика тестов в `STATUS.md` после добавления двух
тестов — исключено `status-snapshot.mjs --check` (PASS) и прямым
пересчётом `node scripts/inventory.mjs` (5395, совпадает); (5) невалидная
или излишне щедрая release-ledger классификация — проверено
`release-ledger.mjs: validateEntry()` (VALID; `summary` не требуется для
`infra`, в отличие от `major`/`stable-fix` — см. #1062/#1063 для сравнения
формата).

### Гейты: что прогнано и результат

| Гейт | Команда | Результат |
|---|---|---|
| Таргетные witness-тесты (новые + соседние #434/#622) | `node --test test/validate-workflow.test.mjs test/ci-profiles.test.mjs test/workflow-jobs.test.mjs test/smoke-exception-guard.test.mjs test/ci-registry-inputs.test.mjs` | 75/75 PASS |
| Каноничность производного workflow | `node scripts/ci-profiles.mjs --check` | PASS, exit 0 |
| Свежесть committed inventory | `node scripts/ci-registry-inventory.mjs --check` | PASS, exit 0 |
| Снимок STATUS.md | `node scripts/status-snapshot.mjs --check` | PASS («snapshot block is current») |
| Пересчёт счётчика тестов | `node scripts/inventory.mjs` | Node unit 5395 — совпадает с STATUS.md |
| Process-gate | `node scripts/process-gate.mjs --issues` | PASS, 1 WARN (ожидаемый: инфраструктурный диапазон без class A, статусная метка не требуется до S7) |
| Покрытие input-проверок | `node scripts/check-inputs.mjs --coverage` | PASS, exit 0 |
| Выбор smoke по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Browser-smoke этим диффом не выбираются» — продуктового/frontend-диффа нет, выбирать нечего (ожидаемо для чистого B/C) |
| Whitespace/diff hygiene | `git diff --check origin/dev...HEAD` | PASS, exit 0 |
| Release-ledger схема | `validateEntry()` из `scripts/release-ledger.mjs` на `docs/release-ledger/v1.82.0/1064.json` | VALID |
| Адресный «чем краснеет» для AC1 (защитный AC: job-бюджет не ослаблен) | Обычный negative-input case: временный `sed -i 's/timeout-minutes: 35/timeout-minutes: 25/' .github/workflows/validate.yml`, прогон тех же двух тестов, немедленный `git checkout --` (файл теста/реестра не менялся, мутант не регистрировался, вне ночного workflow не исполнялся) | Оба теста красные: `not ok … #434 smoke job and each smoke file have independent time bounds`, `not ok … #1064 full shards have a finite 35-minute budget …`; после отката `git status` чист |

**Не прогонялось и почему:**
- Полный `gate:small`/`tsc`/`npm run build`/общий `npm test` — материал уже
  прошёл `validate-gate` на этом точном SHA (прогон `40161798976`,
  review-light proof complete, зафиксирован в промпте ревью); повторный общий
  прогон не адресует конкретный пробел и запрещён как «запасной сценарий
  ревью» (§8). Адресные тесты выше покрывают единственный изменённый путь.
- Настоящий полный `smoke`-job в GitHub Actions (35 минут, реальный браузер) —
  не инициирован: это платный, видимый внешней системе прогон (билз CI-минуты
  трёх раннеров), не локальная обратимая проверка; сам AC3 отдельно относит
  «новый full release run» к обязанности беты после S8, а не ревью. Из
  завершённого прежнего BEFORE-лога (130/148 без единого FAIL) и измеренной
  throughput, 35 минут — заявленный автором конечный бюджет с честно названным
  риском («не обещание 148×180с»); это продуктовое/инфраструктурное суждение
  автора, а не то, что ревью обязано воспроизвести целиком.
- `pytest tests_backend`/HA-harness — Python-файлы продукта не менялись.
- Golden/визуальные сцены — задача не трогает путь отрисовки плана; новые
  baseline-пути в `ci-registry-inventory.json` принесены слиянием `dev`, не
  авторским диапазоном этой задачи (см. скоуп выше).
- Исполнение зарегистрированного мутанта — не требуется и запрещено вне ночи
  (#709/#905); для AC1 достаточно обычного negative-input case (выполнен
  выше), для AC2 логика шага не менялась и уже защищена существующим #434 и
  новым исполняемым тестом раздела «Как проверялось».

## Находки

Находок нет — ни High, ни Medium, ни Low.

Проверенные и отклонённые гипотезы дефектов перечислены в разделе «Как
проверялось»: рассинхрон generated-профиля, устаревший inventory, скрытая
зависимость от литерала 25, невалидная ledger-классификация, ослабленный
job-бюджет без защитного теста — ни одна не подтвердилась.

Побочных находок нет (политика `mode=issues`: маршрут — заводить отдельный
issue только при обнаружении Medium вне скоупа; таких не найдено, новый issue
не создавался).

## Что проверено и корректно

- Единственная функциональная правка — повышение `timeout-minutes` с 25 до 35
  только для full-smoke job `smoke`, в обоих файлах согласованно, через
  канонический генератор (не ручное дублирование).
- Все перечисленные в ТЗ «сохранить без изменений» защиты (три шарда,
  modulo-разбиение, child timeout 180s/kill-after 10s, failure/empty guards,
  selected-browser budget 50 минут, product/perf-бюджеты) — не задеты диффом;
  это подтверждено как чтением (тело шага `Smoke suite` идентично по обе
  стороны диффа), так и исполнением нового теста, реально прогоняющего этот
  shell-скрипт на синтетическом корпусе из 7 файлов с намеренно падающим
  первым.
- Защитный AC1 («общая защита бюджета не ослаблена незаметно») доказан парой
  независимых witness-тестов, оба подтверждённо красные на обычном
  отрицательном случае (таблица выше).
- Трейлеры `Issue: #1064` / `User-Visible: no` на обоих нетривиальных
  коммитах; `User-Visible: no` корректен — ни одна пользовательская строка
  поведения не меняется, changelog не затронут (и не должен быть).
- Release-ledger классификация `infra` относительно `v1.82.0` обоснована и
  валидна по схеме; `infra` корректно не получает milestone релиза (её не
  видит пользователь).
- STATUS.md счётчик тестов (5393→5395) точно соответствует фактическому
  приросту (два новых теста) и подтверждён генератором.
- Числа в диффе («130 из 148», «25→35 минут», run `40158618236`/job
  `121065727842`) у одного источника — исходный CI-лог/аннотация,
  процитированы идентично в issue, `docs/DEVELOPMENT.md`, `docs/STATUS.md` и
  release-ledger rationale; дублирования с расхождением не найдено.
- Критерии §5 для `track:show`: сложность низкая (один числовой константный
  параметр + согласованные тесты/документация), одна поверхность (бюджет CI
  full-smoke job), миграции конфигурации нет, нового UX-контракта нет, влияния
  на продуктовую производительность/touch нет, ожидаемое поведение
  зафиксировано этой же задачей в `docs/DEVELOPMENT.md`/`docs/STATUS.md` и в
  самом issue. Понижения трека не требуется.

## Чего не проверял

- Реальное исполнение полного 35-минутного `smoke` job в GitHub Actions (три
  шарда с настоящим браузером) — не инициировалось в ревью намеренно (см.
  «Не прогонялось и почему»); подтверждение остаётся за первым полным
  предрелизным Validate после merge, как прямо указано в AC3.
- Экономическую обоснованность выбора именно 35 (а не, например, 30 или 40)
  минут — это продуктовое/инфраструктурное суждение автора с честно названным
  риском в хендоффе, не кодовый дефект; критерии §5 (сложность/поверхность)
  это суждение не исключают.
- Полную предрелизную матрицу (full regression, Golden-эталоны, мутанты) —
  вне объёма ревью по §8, обязанность беты.

## Вердикт

Маршрут: `fix` (задача проходит все критерии §5 для `track:show`: сложность,
поверхность, миграция, UX-контракт, perf/touch, зафиксированность поведения).

`Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1064-full-smoke-job-budget`, коммит `4dda29f77994` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `2079e2c552545d90e97e3bca04d7ac1036f672ac`
  ```
  git log --all --format='%H %T' | grep 2079e2c55254
  ```
- Тело issue: `999a005cc7cabbe3520c8c024ca747cecc6be13eb50103be82e6ffd099d8f944`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNDUsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjV9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjkwLCJvdXRwdXRfdG9rZW5zIjoyMTU3MSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjo5OTY2MywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjQwNjI0MTUsImNvc3RVc2RFc3RpbWF0ZSI6MS40MjcwMjUwMDAwMDAwMDAyfV0sInR1cm5zIjo1MywiZHVyYXRpb25NcyI6MzEzMzU2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40MzIyNzUwMDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5235 output_tokens=21592 cache_creation_input_tokens=99663 cache_read_input_tokens=4062415 num_turns=53 -->
