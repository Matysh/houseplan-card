# CODE-REVIEW #1122 (заход r1)

## Материал

SHA `fa419e02e7179e928e528090a8ed0e862b27cfaf` (ветка `issue/1122-...`,
2 коммита: `2339f0019 fix(review): bind task diff to common ancestor (#1122)`,
`fa419e02e test(review): expose temporary directory cleanup to hygiene guard (#1122)`).
Трек: show. Класс изменений: B (`scripts/**`, `test/**`) + C (`docs/**`,
`docs/release-ledger/**`, сгенерированный `scripts/ci-registry-inventory.json`).
Продуктовый код (`src/**`) и UI не затронуты.

## Скоуп

Задача — внутренний process/tooling-фикс к собственному review-конвейеру
(`run_check`/`prepare`), а не продуктовая фича. Наблюдение #1122 указывало на
конкретный дефект, зафиксированный в CODE r1 #1116 (yellow H0/M1, route=fix,
не отменяется этой записью): единственная `policy.base` использовалась и для
`read:diff`/`read:base`, и как подразумеваемая база сравнения с принятым
`dev`-reference, из-за чего входящий C-документ (`INDEX.md` на новом `dev`)
выглядел как будто удалён задачей, хотя собственный task-patch его не трогал.
Правка вводит явный `diffBasis` (schema `houseplan-review-diff-basis/v1`):
для `kind: task` база — единственный `git merge-base --all` между material и
accepted reference; для `ship`/`release` база остаётся прямым диапазоном
(`referenceSha`), как раньше. Отдельные read-рецепты `read:incoming-diff` и
`read:reference-diff` явно размечены как контекст, а не доказательство
авторского удаления.

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT` целиком (body, handoff, changedFiles,
fullHunkReads). Через фиксированный `run_check` прочитаны `read:diff` и
`read:log` материала — полный постраничный diff по всем 10 заявленным файлам
(PROCESS.md, docs/ARCHITECTURE.md, docs/DEVELOPMENT.md, docs/STATUS.md,
docs/release-ledger/v1.82.0/1122.json, scripts/ci-registry-inventory.json,
scripts/review-capabilities.mjs, scripts/review-execution-policy.mjs,
test/review-capabilities.test.mjs, test/review-execution-policy.test.mjs) и
лог из 2 коммитов — совпадает с заявленным материалом и changedFiles.

Независимо от хендоффа прочитан текущий код `scripts/review-capabilities.mjs`
целиком и фрагмент `scripts/review-execution-policy.mjs` (`prepare`) —
прослежены вызывающие пути `resolveReviewDiffBasis` → `validateMaterial` →
`recipes` → `buildReviewCapabilities`/`readReviewCapabilities` и их инварианты
(единственный merge-base для `task`, прямой `referenceSha` для `ship`/`release`,
связывание `diffBasis` в sealed-digest манифеста, разрешение `read:base:<file>`
для уже удалённых task-файлов только при `taskBasis`).

Адресно исполнены (не просто прочитаны) целевые unit-тесты, проверяющие именно
новую логику #1122, поскольку материал меняет доверенный инструмент самого
ревью (риск, оправдывающий отдельный прогон сверх уже принятого proof):

- `unit:test/review-capabilities.test.mjs` — 7/7 PASS, включая оба новых теста
  `#1122 incoming reference documents are not authored deletions...` и
  `#1122 ambiguous or invalid task bases fail closed...`.
- `unit:test/review-execution-policy.test.mjs` — 54/54 PASS, включая реальный
  (не skipped — среда Linux) тест `#1122 real prepare uses the task common
  ancestor but preserves ship/release direct ranges`, который гоняет
  настоящий `git`/`prepare` CLI на временном репозитории с реальной
  криво-ancestry (общий предок, собственное удаление, параллельный "newer dev"
  с входящим документом) и проверяет `base`, `diffBasis`, `changedFiles` и
  аргументы `read:diff` для всех четырёх комбинаций `kind`/`stage`.

Оба прогона — новое исполнение в этой сессии (receipt `448aaa84…`/
`6a3c4676…`), не повтор уже засчитанного доказательства, т.к. это точечная
проверка названного риска (корректность новой диспетчеризации diff-базы),
которую общий `validate-gate` подтверждает только агрегированно.

Переиспользовано (не повторялось исполнением): зелёный `validate-gate`
https://github.com/Matysh/houseplan-card/actions/runs/40846663556 и его
проверочный план — покрывает `build:build`/`build:typecheck`/`build:bundle:sync`,
полный `node --test` набор (103 PASS на Windows pin + 4 PASS Linux-only без
skip в WSL), `gate:small` (264s, 0 отказов) после rebase на S8 #1121,
`status-snapshot --write`, `ci-registry-inventory --write`, `ci-profiles
--check`, `process-gate --issues`. Эти значения сверены по смыслу с текущим
диффом (ниже) и не пересчитывались заново.

## Находки

Находок нет. Отдельно зафиксирована граница проверки (ниже), а не находка:
трейлеры `Issue:`/`User-Visible:` коммитов не читались напрямую — доступный
fixed-check `read:log` отдаёт только `--oneline`, без тела коммита/трейлеров,
а отдельного read-рецепта для полного commit message в манифесте нет. Оба
заголовка коммитов несут `(#1122)`, оба коммита — class B (не docs-only), и
`git`-hook на стороне автора принудительно требует трейлеры для таких
коммитов до принятия; расхождений, которые могли бы указывать на их
отсутствие (не найдено несоответствий в STATUS/changelog), не обнаружено.
Самостоятельно подтвердить дословные строки трейлеров через доступный ревью-
инструментарий не удалось — честно фиксирую это как непроверенное, не как
нарушение.

## Что проверено и корректно

- `resolveReviewDiffBasis` (`scripts/review-capabilities.mjs:20`) отказывает
  при неизвестном `kind`, невалидном `materialSha`/`referenceSha`, и для
  `kind: task` — при отсутствии/множественности/невалидности `mergeBases`
  (строго один элемент). Для `ship`/`release` база — всегда `referenceSha`
  (`comparison: 'direct-tree'`), что сохраняет прежний прямой диапазон.
- `validateMaterial` связывает `policy.diffBasis` с `policy.base`/`policy.sha`
  через повторный вызов `resolveReviewDiffBasis` и `canonicalCallJson`-
  сравнение — несогласованная пара (`base` не равен `diffBasis.baseSha`, или
  `diffBasis` подменён) отказывает до построения чеков.
- `recipes()`: при `taskBasis` (`diffBasis.comparison === 'task-patch'`)
  `read:diff` читает только task-patch от merge-base до material (не включает
  входящие изменения reference-ветки); `read:incoming-diff` и
  `read:reference-diff` — отдельные читаемые ветки с описанием, прямо
  исключающим трактовку как "authored deletion"; `read:base:<file>` теперь
  доступен и для файлов, удалённых самой задачей (не входящих в текущий
  `files`), что раньше не позволял `files.has(file)`-гейт.
  Для `ship`/`release` (без `taskBasis`) поведение не изменилось.
- `readReviewCapabilities` сверяет `diffBasis` манифеста с `diffBasis` policy
  (`canonicalCallJson`) — подмена `referenceSha` в любой стороне отказывает
  (подтверждено тестом с 5 видами порчи: `base`, `diffBasis.referenceSha` в
  policy, `capabilities.diffBasis.referenceSha`, отсутствие
  `capabilities.diffBasis`, посторонний `changedFiles`).
- `scripts/review-execution-policy.mjs` `prepare`: `referenceSha` берётся из
  `REVIEW_BASE` (как раньше), `kind` — из `REVIEW_KIND`; `diffBasis`
  вычисляется один раз через реальный `git merge-base --all` только для
  `kind: task`; записывается в `policy` и используется и для `base`, и для
  `changedFiles`. Не пересчитывается на каждый tool call (комментарий и
  архитектура это явно поддерживают).
- `docs/release-ledger/v1.82.0/1122.json`: `category: infra`, без
  `introducedBy` — соответствует прецедентам (`638.json`, `674.json`,
  `1021.json`, `1121.json` и др. той же категории без `introducedBy`);
  `baseStable: v1.82.0` совпадает с актуальным latest stable tag в STATUS.md.
- Единственное число, видимое дважды в диффе — счётчик Node unit-тестов в
  `docs/STATUS.md` (`5877` → `5880`): ровно 3 новых top-level теста добавлены
  (2 в `review-capabilities.test.mjs`, 1 в `review-execution-policy.test.mjs`),
  источник один — `status-snapshot --write` (сгенерированный, не ручной).
  Остальные три счётчика (pure backend, HA-harness, browser smokes) не
  изменились — согласуется с отсутствием изменений вне `scripts/`/`test/`/docs.
- `scripts/ci-registry-inventory.json`: добавлена одна строка-ссылка на новый
  `docs/release-ledger/v1.82.0/1122.json` в двух местах (генерируемый индекс),
  без постороннего дрейфа.
- PROCESS.md/ARCHITECTURE.md/DEVELOPMENT.md/STATUS.md правки описывают именно
  то поведение, что в коде: единственный общий предок, раздельные
  incoming/reference ридеры как контекст, сохранение прямого диапазона для
  ship/release, перечисленные тестовые файлы для верификации — совпадает
  дословно с фактическим составом новых тестов.
- User-Visible: поведение не предназначено для конечного пользователя карточки
  (review-инструментарий, не продукт) — `docs/CHANGELOG(.ru).md` не тронуты,
  что согласуется с инфраструктурным характером правки; отдельно см. честную
  границу выше про трейлеры коммитов.

## Чего не проверял

- Полные build/typecheck/bundle и общий `node --test` набор — не повторялись
  исполнением, переиспользован зелёный `validate-gate`
  (https://github.com/Matysh/houseplan-card/actions/runs/40846663556); дифф не
  меняет ничего в их области (TS/бандл/продукт), только `scripts/review-*`,
  2 теста и документацию/ledger/generated-инвентарь.
  `build:typecheck`/`build:build`/`build:bundle:sync` не перезапускались отдельно.
- Браузерные смоки и `pytest tests_backend` — не затронуты диффом (нет
  изменений в `src/**`, `demo/**`, `tests_backend/**`); не запускал, т.к.
  задача не меняет продуктовое поведение/геометрию/perf/touch.
- Полные `test/review-approved-check.test.mjs`,
  `test/review-native-call-digest.test.mjs`, `test/review-result-gate.test.mjs`,
  `test/review-context.test.mjs`, `test/process-digests.test.mjs`,
  `test/entry-cost.test.mjs`, `test/temp-dir-hygiene.test.mjs` — не
  перезапускались отдельно; покрыты зелёным `validate-gate`/хендоффом и не
  меняются этим диффом (кроме двух уже адресно прогнанных файлов).
- Дословное содержимое трейлеров `Issue:`/`User-Visible:` обоих коммитов — см.
  раздел «Находки» (инструментарий ревью не даёт читать тело коммита, только
  `--oneline`).

## Маршрут и вердикт

Критерии §5: `complexity` ≤3 (локальная, хорошо протестированная правка одной
функции diff-базы и её потребителей), `surfaces` — одна поверхность
(диспетчеризация diff-базы review-конвейера), `migration` — нет (сам
манифест — generated/sealed на каждый прогон, нет persisted config), `ux-
contract` — нет (внутренний tooling, не продукт), `perf-touch` — не
затронуто, `undocumented` — поведение зафиксировано в этом же коммите
(PROCESS.md/ARCHITECTURE.md/DEVELOPMENT.md/STATUS.md). Все критерии
пройдены.

**route: fix**
**verdict: green**

Побочных находок вне скоупа нет (политика mode=issues; `outside_findings`
пуст).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjZmNTA4OGUwNzYzYmEwZDgxNWFhODRiYjQyMDBmMmJmYThkNWViOWUxYmEwNjZjNmM4ODcxYzNmZGQ0Njk0NTYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJiOTFjNTM3ZDFiYjA4YjE3ZjEwMjM5NmExMWFiNmQxYTYzMGIyYTdjMWY5MTczNDBjOTFhY2M4YzJmNTQwNTM2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTIyLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJmYTQxOWUwMmU3MTc5ZTkyOGU1MjgwOTBhOGVkMGU4NjJiMjdjZmFmIiwidHJlZSI6IjAwNjY1MGVmNTRlMWZiN2Q4MjQxNDJmNjZlMDgzNTkwOWIwNWQ2ZDIiLCJib2R5RGlnZXN0IjoiYmE5NTFmMDkwYzg1Njg5OTRhMThlNGM0NWY2NjM3NjM3YTY5M2EwMTdiYzdkNzlhZDJhYzdiMjBhZWI2MTllMSIsInByb2R1Y2VyUnVuIjoiNDA4NDc2NjY5MDUiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImQxM2NmYWIyOGU0YTZiNmNiY2Y2YWE1MDQ4NWVmM2U3Mjc2NTNjYzhmMWNmNDY0NWM1NWFiYzA3OWFiYTkyNmMiLCJ2ZXJkaWN0RGlnZXN0IjoiOGMyMTIwNjE1OWIyMDBlMDNmNjc0MmRjOTdjMTE4YjFkYTFiYjJjMTk4ZjE0ODRmZWJiYTI5MzdiOTBhNzY1MiIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIzODU5ODU1NWE2Yjk2NzEyMzEzMjc3ZWVhZTM0ZTk0ZjFmYWVmM2ZmYWRlOTUyMTc5ZjllMzgxZTMzNTYwNTI3IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDkyNzk1MzUzLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTIyI2lzc3VlY29tbWVudC02NDkyNzk1MzUzIiwiYm9keURpZ2VzdCI6IjRkNjJiMjg4MjBjNTg0MmRhNGJhMmU2ZmRlNTliNDI4MWFiYmYzOWMxNjgwYjI2Y2U3YzE4NTgyZjA5Y2QzYzgifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1122-review-diff-provenance`, коммит `fa419e02e717` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `006650ef54e1fb7d824142f66e0835909b05d6d2`
  ```
  git log --all --format='%H %T' | grep 006650ef54e1
  ```
- Тело issue: `ba951f090c8568994a18e4c45f6637637a693a017bc7d79ad2ac7b20aeb619e1`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40847666905,"run_attempt":1,"digest":"4278e2da2a07c2d7e4bd24ae45fe98a14f13a07626ff7b833aac2777c091df5b"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzgsIm91dHB1dF90b2tlbnMiOjIwMzY2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwOTMwNCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEzNjkyMjUsImNvc3RVc2RFc3RpbWF0ZSI6MC45MTQ3OTcwMDAwMDAwMDAyfV0sInR1cm5zIjozMCwiZHVyYXRpb25NcyI6MjY0MDg2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MC45MTQ3OTcwMDAwMDAwMDAyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=38 output_tokens=20366 cache_creation_input_tokens=109304 cache_read_input_tokens=1369225 num_turns=30 -->
