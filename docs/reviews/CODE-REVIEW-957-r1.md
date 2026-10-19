# CODE-REVIEW-957-r1

Материал: `0077ea9f061f6e37757b8f29f48e6e8279ad00aa`, ветка `issue/957-spec-material-retention`.
Этап: code. Трек: show. Заход: r1. Блокирующих циклов израсходовано 0 из 2.

## Скоуп

Issue #957: после автоматического S7-ребейза задачи, чей spec-материал уже был
опубликован, исходное дерево SPEC становится недостижимым в свежем CI
checkout — `readTaskCommit` безусловно вызывал `git cat-file -t <anchorTree>`,
и отсутствие дерева обрывало `readMergeEntry`/ledger/код-ревью. Инфраструктурный
вход по §1 (классы B/C, нет файла `src/**`): без ТЗ и ревью ТЗ, сразу
`S7-code-review`. Продукт (`src/**`, интеграция) не тронут; поведение View/
редакторов не меняется — это чистая process-инфраструктура.

Изменённые файлы: `scripts/review-material.mjs` (новый), `scripts/task-delivery.mjs`,
`.github/workflows/_process.yml`, `.github/workflows/validate.yml`,
`test/task-delivery-903.test.mjs`, `PROCESS.md`, `docs/DEVELOPMENT.md`,
`docs/STATUS.md`, `docs/process/AUTHOR.md`, `docs/release-ledger/v1.81.0/957.json`.
Один коммит, трейлеры `Issue: #957` / `User-Visible: no` — корректно: изменений
в CHANGELOG не требуется и нет (бот/конвейер-поведение, не продукт).

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом SHA
(https://github.com/Matysh/houseplan-card/actions/runs/39203506466) — `tsc
--noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` повторно не
гонялись.

Сам прогнал (кроме Validate):

| Гейт | Команда | Результат |
|---|---|---|
| Таргетные unit-тесты #957 | `node --test --test-name-pattern='#957' test/task-delivery-903.test.mjs` | PASS, 8/8 |
| Полный файл тестов (регрессия) | `node --test test/task-delivery-903.test.mjs` | PASS, 31/31 |
| Смежные process-тесты | `node --test test/process-digests.test.mjs test/validate-workflow.test.mjs test/review-preflight.test.mjs test/release-ledger.test.mjs` | PASS, 54/54 |
| Диапазон коммитов/трейлеры | `node scripts/process-gate.mjs --issues --range origin/dev..HEAD --report` | PASS, 1 WARN (штатный: инфраструктурный диапазон без класса A не требует статусной метки до S7, #562) |
| Выбор смоков по диффу | `node scripts/smoke-select.mjs --base origin/dev --head HEAD --json` | `noExecutableDiff: true`, direct/registered/visualMinimum пусты → браузерные смоки не нужны |
| Пробелы/конфликт-маркеры | `git diff --check origin/dev...HEAD` | PASS (exit 0) |
| Чистота слияния с dev | `git merge-tree --write-tree HEAD origin/dev` | чистое дерево, конфликтов нет |

Чего не проверял и почему: `pytest tests_backend` — диапазон не трогает Python;
`npm run invariants` — геометрия/модель плана не затронуты; golden/визуальные
смоки — `src/**` не менялся, `smoke-select` подтвердил `noExecutableDiff`;
нативный Windows gate — отдельно заведён #960 автором, вне скоупа #957;
полный `npm run gate:small`/`tsc`/`build` повторно не гонял — Validate зелёный
уже на этом точном SHA.

## Разбор AC

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1: свежий object store восстанавливает исходное дерево после настоящего ребейза; ledger/merge entry и membership согласованы | `test('#957 fresh checkout restores the exact retained SPEC tree after a real rebase')` — реальный `git rebase`, `git clone --no-local --single-branch`, отсутствие `alternates`, реальный `cat-file -t` до фикса падал (`could not get object info`) | Та же real-git фикстура без восстановления: `assert.throws(() => run(['cat-file', '-t', tree]), /could not get object info/)` воспроизводит исходный баг на неизменённой среде |
| AC2: retention неизменяемый, идемпотентный, fail-closed | `#957 retention CLI is idempotent...`, `#957 a concurrent create with the same exact tree is safe...`, `#957 absent or wrong retained material refuses (...)` — реальные гонки `push`, create-only CAS, подмена чужим ref | Отсутствующий ref / чужое корневое дерево / несовпадающая пара commit-tree → `assert.throws(..., /SPEC material tree .* unavailable.*exact objects required/)`; занятый чужим коммитом ref → `/publication must stop/`; секрет в сообщении об ошибке транспорта не просачивается (`!error.message.includes('secret')`) — проверено отдельным тестом |
| AC3: восстановление объектов не ослабляет SPEC provenance, совместимо с legacy rescue | `#957 legacy rescue refs restore only a matching original root tree`, `#957 recovered objects do not authorize a foreign publisher or extra delivery paths` | Чужой author/лишний файл в SPEC-коммите продолжает валить `taskDelivery` (`/Unproven spec-only delivery/`) даже когда объекты успешно восстановлены — проверено тем же реальным деревом |

Все три защитных AC доказаны обычными отрицательными случаями на неизменённой
реализации (реальный `git`, без патча исполняемого кода/бандла/гарда);
мутанты не исполнялись и не требовались — согласовано с общей политикой.

Восьмой тест (`#957 pipeline retains sealed material before any SPEC
publication...`) читает исполняемый YAML и подтверждает: `retain` вызывается
до `git reset`/`git push` документа и только при `STAGE=spec`;
`validate.yml` исключает `review-material/**` из Validate. Это статическая
проверка контракта, не замена исполнения — сверено лично чтением
`.github/workflows/_process.yml:1750-1758` и `.github/workflows/validate.yml:9`.

## Что проверено и корректно

- `retainReviewMaterial` — create-only CAS (`--force-with-lease=<ref>:`),
  никогда не двигает существующий чужой ref; гонка параллельного создания с
  тем же деревом идемпотентна (повторный `fetchRef` после проигранной гонки).
- `fetchRef` проверяет не только имя ref, но и то, что advertised commit —
  действительно `commit`, с нужным `^{tree}`, и что локально фетчнутый ref
  реально указывает на тот же sha — защита от подмены между `ls-remote` и
  `fetch`.
- Ошибки транспорта (которые могут содержать push URL с токеном) никогда не
  эхо в сообщение наружу — проверено тестом на буквальном `secret` в строке
  исключения.
- `reviewMaterialTreeType` для обычного (не осиротевшего) пути ничего не
  меняет: при наличии дерева локально — тот же `cat-file -t` сразу, без сети;
  это сохраняет поведение для подавляющего большинства прогонов.
- `retain` вызывается только на этапе `spec` (`STAGE = spec`), не на
  код-ревью — соответствует тому, что проблема описана именно для spec
  material; код-ревью не публикует отдельного материала для retention.
- `docs/release-ledger/v1.81.0/957.json`: `category: infra`, `baseStable:
  v1.81.0` (предыдущий stable, текущая линия — 1.82.0-beta), обоснование
  точное — не входит в пользовательский milestone, совпадает с другими infra
  записями той же директории.
- Документация (`PROCESS.md`, `docs/DEVELOPMENT.md`, `docs/process/AUTHOR.md`,
  `docs/STATUS.md`) описывает именно то поведение, что в коде: создание ref до
  публикации, create-only CAS, fail-closed при недостающем/чужом материале,
  отсутствие влияния на membership/S8.
- Трейлеры коммита корректны (`Issue: #957`, `User-Visible: no`); изменений в
  CHANGELOG нет и не требуется.

## Находки

Нет. High: 0, Medium: 0. Low не обнаружено.

## Маршрут §5 (track:show)

- complexity: диапазон узкий (один новый модуль + точечная интеграция +
  тесты), риск ограничен object-retention механизмом конвейера — ≤3.
- surfaces: одна поверхность — сохранение/восстановление SPEC-материала в
  конвейере ревью (prepare → retain → shared reader).
- migration: нет миграции конфига, новых compatibility-полей нет.
- ux-contract: нет — `src/**` не затронут, продуктового UX здесь нет.
- perf-touch: нет влияния — изменения вне продукта и вне touch-контракта.
- undocumented: поведение зафиксировано в PROCESS.md/DEVELOPMENT.md/AUTHOR.md
  этим же коммитом и подробно описано в отчёте автора (issue #957 comment).

Все критерии §5 пройдены → `route: fix`.

## Побочные находки

Побочных находок нет (`mode=issues`, маршрут — issue с меткой `S1-new`, если
бы находки были; не потребовалось).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/957-spec-material-retention`, коммит `0077ea9f061f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d68223b05212e5dcd866ed6603a17327dbf08344`
  ```
  git log --all --format='%H %T' | grep d68223b05212
  ```
- Тело issue: `408481138122b4b1260402527480656c8f55db92cb248076a2ae72b6e5bf135d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxOTIsIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjgxOTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo1MCwib3V0cHV0X3Rva2VucyI6MTk5NjAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6ODk1NjIsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxOTcwMDY2LCJjb3N0VXNkRXN0aW1hdGUiOjAuOTUxOTYxMjAwMDAwMDAwMX1dLCJ0dXJucyI6MzQsImR1cmF0aW9uTXMiOjI0OTMzMywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuOTU3MjQzMjAwMDAwMDAwMSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5242 output_tokens=19978 cache_creation_input_tokens=89562 cache_read_input_tokens=1970066 num_turns=34 -->
