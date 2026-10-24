# CODE-REVIEW-1058-r1

## Материал

- SHA: `3e363dec297fc0394cf7d672c110e3915920732d` (= `git rev-parse HEAD`, совпадает с меткой задачи).
- Диапазон: `git log --oneline origin/dev..HEAD` — 1 коммит.
- Трек: `show`, этап `code`, заход `r1`, блокирующих циклов использовано 0 из 2 (лимит show).
- Файлы: `.github/workflows/validate.yml`, `.github/workflows/validate-product.yml`,
  `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/release-ledger/v1.82.0/1058.json`,
  `scripts/ci-registry-inventory.json`.
- Ветка к `dev` не приводилась (track show, #696): `dev` впереди на 6 коммитов,
  `git merge-tree --write-tree HEAD origin/dev` — чистое слияние без конфликтов.
  Материал принят как есть.
- Validate-gate на этом материале принят заранее (review-light proof,
  https://github.com/Matysh/houseplan-card/actions/runs/40088850648) —
  переиспользован без повторного прогона. Ниже прогнаны только адресные
  проверки, специфичные для этого диффа (не входят в общий review-light набор
  по сути задачи — канонический/генерируемый workflow и инфра-реестр).

## Скоуп задачи

Issue #1058 (docs/SCOPE.md: Core user job не затрагивается напрямую — это
инфраструктура CI, обслуживающая доставку, не продукт). Проблема: выбранный
(не полный) план из 256 browser-смоков в #1025 был обрезан жёстким лимитом
job `40m0s` на 246/256 выполненных сценариев (244 PASS, 2 FAIL, 10 не
исполнены), интервал фактического выполнения 2358.432 с. Изменение — поднять
только конечный `timeout-minutes` job `browser_selected` в каноническом
`validate.yml` с 40 до 50 минут и пересоздать производный
`validate-product.yml` штатным генератором. Состав плана, child-таймаут 180 с,
assertions, full/selected routing, Golden intent/эталоны и продуктовые budgets
не меняются. Трейлеры коммита: `Issue: #1058`, `User-Visible: no` — верно,
правок changelog не требуется.

## Критерий трека show (route, §5, #726)

Задача проходит все критерии track show без reclassify:

- **complexity** — одна строка значения (`40` → `50`) в двух синхронизированных
  файлах + сопроводительная документация; риск низкий.
- **surfaces** — одна поверхность: бюджет job `browser_selected` в CI.
- **migration** — нет миграции конфига, нет новых compatibility-полей.
- **ux-contract** — `User-Visible: no`, поведение карточки не меняется.
- **perf-touch** — явно не продуктовый perf-threshold, а бюджет задания CI;
  touch-контракт не затронут.
- **undocumented** — паттерн уже задокументирован тем же предшественником
  #1055 (тот же механизм «конечный job-бюджет по измеренному инвентарю»,
  `docs/DEVELOPMENT.md`, `docs/STATUS.md`); это изменение продолжает тот же
  зафиксированный приём, не вводит новый.

Вывод: `route: fix`.

## Как проверялось (адресные проверки)

| Проверка | Команда | Результат |
|---|---|---|
| Синхронность canonical/generated workflow | `node scripts/ci-profiles.mjs --check` | PASS (exit 0), расхождений нет |
| Реестр CI-инвентаря включает новый ledger | `node scripts/ci-registry-inventory.mjs --check` | PASS (exit 0) |
| Трейлеры/статус issue для инфра-диапазона | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 1 ожидаемое WARN (п.8: инфраструктурный диапазон без файлов класса A, статусная метка не требуется до S7) — совпадает с заявлением автора |
| Документация/ссылки | `node scripts/check-docs.mjs --screenshots=warn --external=warn` | PASS (7 файлов, 17 внешних ссылок); WARN о несвежем снимке экрана — не гейт задачи (#697) |
| Покрытие входов | `node scripts/check-inputs.mjs --coverage` | PASS, без вывода |
| Выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — смоки не выбираются, корректно для B+C-диффа без `src/**/*.ts` |
| Целевые unit-тесты, читающие изменённые workflow/инвентарь (риск по участкам диффа) | `node --test test/workflow-hygiene.test.mjs test/validate-workflow.test.mjs test/ci-proof-registry.test.mjs test/browser-push-plan.test.mjs` | 88/88 PASS |
| Прочие tooling-тесты, упоминающие `timeout-minutes`/workflow-парсинг (нет завязки на жёсткое значение 40 для `browser_selected`, но проверено явно) | `node --test test/release-workflow.test.mjs test/smoke-exception-guard.test.mjs test/review-doc-guard.test.mjs test/process-metrics.test.mjs test/mutation-gate-report.test.mjs test/mutation-gate.test.mjs test/mutation-shards-899.test.mjs test/coverage-diagnostic.test.mjs` | 237/237 PASS |
| Чистота слияния с `dev` | `git merge-tree --write-tree HEAD origin/dev` | один write-tree хэш, конфликтов нет; `git status --short` пуст |

Ни один из найденных тестов не хардкодит `40` специально для job
`browser_selected`; `test/workflow-hygiene.test.mjs` проверяет только диапазон
`1..180` минут — `50` в него укладывается.

## Проверка AC

AC — обычные (не защитные: не валидация/гард/лимит продукта, а CI job budget),
таблица «чем краснеет» не требуется.

1. **«Только selected browser job получает конечные 50 мин, остальное не
   трогается; canonical/generated согласованы»** — доказано чтением диффа
   (изменены ровно по 2 строки в каждом из двух файлов, комментарий и
   `timeout-minutes`) и исполнением `ci-profiles.mjs --check` (PASS, т.е.
   generated файл — точная проекция canonical). Остальные job/таймауты в
   `git diff --stat` не фигурируют. **Выполнен.**
2. **«Existing tooling/workflow/parser/CI-plan tests, derived metadata/static/
   process checks и обязательный pre-push hook проходят»** — доказано
   исполнением: 88+237 целевых тестов зелёные, `process-gate.mjs`,
   `check-docs.mjs`, `check-inputs.mjs`, `ci-registry-inventory.mjs` зелёные.
   Полный pre-push hook самостоятельно не перезапускался (автор уже прогнал
   его при push, числа в комментарии правдоподобны и не противоречат
   независимо прогнанным частям) — см. «Чего не проверял». **Выполнен**
   (в покрытой автором и независимо перепроверенной части).
3. **«После фактического S8 потребители включают accepted dev и исполняют
   полный собственный selected plan с новым бюджетом; новый infra PASS сам по
   себе не делает #1025/#1038 зелёными»** — это условие о будущем поведении
   вне данного SHA, непроверяемое сейчас. Разобрано чтением: изменение не
   объявляет и не могло бы объявить #1025/#1038 зелёными — ledger/комментарии
   explicitно это отрицают, продуктовый код не тронут. Проверено чтением,
   не исполнением.

## Числа, видимые дважды (§8)

`50` минут и исходные `246/256`, `2358.432 с` фигурируют в: issue, commit
message (неявно через ledger rationale), `docs/release-ledger/v1.82.0/1058.json`,
`docs/DEVELOPMENT.md`, `docs/STATUS.md`, и дважды в самом коде
(`validate.yml`, `validate-product.yml`). Источник один — фактический прогон
run `40084326899`/job `120844476069`; `validate-product.yml` — не независимый
источник, а генерируемая проекция `validate.yml`, что подтверждено
`ci-profiles.mjs --check`. Расхождений не обнаружено.

## Побочные находки

Доверенный снимок политики: `{"schema":"houseplan-outside-findings-policy/v1",
"mode":"issues", ...}`. Побочных находок вне скоупа задачи не обнаружено —
новых issue не заводится.

## Что проверено и корректно

- Диапазон изменений строго ограничен заявленным B+C: workflow-таймаут,
  сопровождающая документация и инфра-ledger; продуктовый код, `src/**`,
  состав планов и отдельные invocation-лимиты не тронуты.
- Трейлеры `Issue: #1058` и `User-Visible: no` на коммите корректны; при `no`
  changelog не требуется и не менялся.
- `docs/release-ledger/v1.82.0/1058.json`: `category: infra`, обоснование
  соответствует факту (resize только таймаута), без `introducedBy` —
  уместно, так как это не правка внутри-бетной функции, а инфраструктура.
  Формат совпадает с соседними infra-записями (#1055, #1057).
  `baseStable: v1.82.0` корректен (инфраструктура и внутри-бетные правки не
  входят в пользовательский milestone релиза, #838).
- Нарратив в `docs/DEVELOPMENT.md`/`docs/STATUS.md` согласован по числам и не
  противоречит соседним абзацам (#1055 описан отдельно, #1058 — как следующая
  измеренная граница того же механизма).
- Критерий track show (route, §5) пройден по всем пунктам — reclassify не
  требуется.

## Чего не проверял

- Реальный прогон GitHub Actions с новым 50-минутным лимитом (станет ли он
  действительно достаточным для полных 256 смоков) — технически невозможно
  проверить без исполнения полного selected-плана в CI; это явный риск,
  названный самим автором («50 минут — конечный запас по измеренным 246/256 за
  2358.432 с, а не гарантия времени любого будущего плана»), не находка.
- Полный обязательный pre-push hook и полный `gate:small`/tooling-набор не
  перезапускались целиком — переиспользован review-light proof для
  материала и независимо перепроверены только риск-зоны диффа (workflow-
  parsing/registry/process-gate/check-docs/check-inputs тесты и файлы,
  упоминающие `timeout-minutes`). Общий `npm test`/`gate:small` не являются
  запасным сценарием ревью при принятом proof.
- Мутанты, полная ночная mutation-matrix, perf/визуальная регрессия — не
  запускались: задача их не задевает (чистая CI-инфраструктура, не
  продуктовая логика/геометрия/UI), и это явно согласовано ТЗ («перф/мутации/
  полную регрессию локально не запускать»).
- AC3 (будущее поведение потребителей после S8) — не тестируемо на этом SHA,
  разобрано чтением с явной записью выше.
- Ручная dev/GPU-приёмка владельцем не проводилась — для трека show и
  инфраструктурной задачи без визуального риска это не находка (#929).

## Вердикт

Зелёный. High: 0, Medium: 0. Маршрут: `fix` (задача проходит все критерии §5
track show, reclassify не требуется).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1058-selected-browser-budget`, коммит `3e363dec297f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `92fc833510c4db60e572921c8bac5773bebb9d4f`
  ```
  git log --all --format='%H %T' | grep 92fc833510c4
  ```
- Тело issue: `f6a31df227c80255373e0ce18de8ff65692e6d83302b7861c59009d259306c87`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNzQsIm91dHB1dF90b2tlbnMiOjI1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1Mjk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo2MCwib3V0cHV0X3Rva2VucyI6MTU3NTcsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NTg3NDUsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNzg5MjYzLCJjb3N0VXNkRXN0aW1hdGUiOjAuNzUwNTIyNTk5OTk5OTk5OH1dLCJ0dXJucyI6MzgsImR1cmF0aW9uTXMiOjMzNTM0MCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzU1ODIxNTk5OTk5OTk5OCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5234 output_tokens=15782 cache_creation_input_tokens=58745 cache_read_input_tokens=1789263 num_turns=38 -->
