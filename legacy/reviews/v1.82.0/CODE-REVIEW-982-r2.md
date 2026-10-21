# CODE-REVIEW-982-r2

Issue: #982 · Этап: code · Трек: show · Заход: r2 · блокирующих циклов израсходовано 1/2 (после этого вердикта — 1/2, зелёный цикла не образует)

Материал: `2de721611cd99c0ce9eccf1609f780317f216245` (ветка `issue/982-test-partitions`), база `origin/dev`. Дельта раунда: `git diff c582db5f7..2de721611` (r1 SHA `c582db5f7ada4290043ab6769a738f7f300f8cf2` → r2 SHA). `git rev-parse HEAD` рабочей копии ревью: `2de721611cd99c0ce9eccf1609f780317f216245` — совпадает с материалом.

Ветка к `dev` не приводилась (трек `show`, #696): merge-tree чистый, автор это заявляет и ребейз не требовался; Validate на этом SHA зелёный: https://github.com/Matysh/houseplan-card/actions/runs/39525477450.

## Скоуп

Единственная находка r1 (Medium, в скоупе): `groupsAffectedBy` в `scripts/unit-groups.mjs` коротким путём относил любой файл `scripts/**` к `tooling`, минуя реальную проверку по `grouping.dependencies` — ломая заявленное этим же диффом свойство «общие/неизвестные входы требуют оба» (AC2, PROCESS §8, DEVELOPMENT.md). Дельта r2 — ровно исправление этой находки: 3 файла, +31/-2 (`scripts/unit-groups.mjs`, `test/unit-groups.test.mjs`, `docs/DEVELOPMENT.md`), плюс публикация `docs/reviews/CODE-REVIEW-982-r1.md` на ветку (docs-only, без трейлеров — корректно по AGENTS.md). Продуктового кода (`src/**`, `custom_components/**`) в дельте нет, release-ledger и трейлеры не тронуты.

Критерии §5 трека `show` для дельты: сложность — тривиальная (удаление одной ветки раннего `continue`, одна функция), одна поверхность (локальный селектор тестов), миграции конфига нет, UX-контракта нет, продуктовой производительности/touch не касается, ожидаемое поведение зафиксировано самим AC2 и формулировкой r1-находки. `route: fix`, переквалификация не нужна.

## Как проверялось

| Гейт | Статус | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` | не перегонял — переиспользован | зелёный Validate на точном SHA материала: [39525477450](https://github.com/Matysh/houseplan-card/actions/runs/39525477450) |
| `node --test test/unit-groups.test.mjs` на текущем материале | прогнал сам | 9/9 PASS (новые 2 кейса дельты r2 включены) |
| Негативное доказательство дельты: те же 2 новых кейса против **кода r1** (`c582db5f7`, до фикса) — отдельный `git worktree`, без правки материала ревью | прогнал сам | 2 теста из 9 падают именно так, как описывает находка r1: `assert.ok(groupsAffectedBy([modelTool], g).includes('product'))` → `false`; `requiredUnitGroups(root, 'HEAD')` на fixture с общим `scripts/shared.mjs` → `['tooling']` вместо `['product','tooling']`. На текущем материале (2de721611) те же 2 кейса — PASS |
| Чтение полного тела `groupsAffectedBy` (не только диффа) | выполнено | см. «Проверено и корректно» |
| golden/смоки/pytest/инварианты модели/perf | не прогонял | диффу не нужны: нет `src/**`/`custom_components/**`/`demo/**`/геометрии/Python/UX, AC их не называет |
| Мутанты | не исполнялись | дельта не добавляет новых мутантов; негативное доказательство получено сравнением с реальным предыдущим коммитом (r1), а не патчем текущей реализации |

Чем проверено, что тест умеет падать: не мутант текущей реализации, а исполнение тех же (неизменных) тестовых файлов дельты против отдельного, уже существующего в истории коммита `c582db5f7` — обычная регрессионная проверка, не затрагивающая материал ревью `2de721611`.

## Находки

Нет. Единственная Medium-находка r1 закрыта (см. ниже), новых High/Medium в этой дельте не обнаружено.

## Проверено и корректно

- Фикс убирает именно ту раннюю ветку (`/^(?:scripts|\.github|\.githooks)\//`), на которую указывал r1, и делает это способом не слабее предложенного ревьюером: вместо переупорядочивания условий автор убрал префиксный ярлык совсем — принадлежность файлов `scripts/`/`.github/`/`.githooks/` теперь всегда решается через `grouping.dependencies` (то же вычисление, что использует `unitGroups()` для классификации самих тестов), а для файлов без ни одного `dependencies[t]` остаётся честный fail-closed `['product', 'tooling']` (`scripts/unit-groups.mjs:123-133`).
- Ярлыки для `src|custom_components|demo|assets` не тронуты и не должны были — для них «всегда product» корректно независимо от того, есть ли реальный test-consumer (новый файл в этих деревьях тоже обязан быть product).
- Побочный эффект проверен: для `.github/**`/`.githooks/**`-файлов, не входящих ни в один `dependencies[t]` (например, часть `.yml`, не инспектируемая тестами как данные), поведение стало *более* консервативным (оба набора вместо одного `tooling`) — это соответствует заявленному «неизвестные входы выбирают оба», не регрессия.
- Новый тест `test/unit-groups.test.mjs:95-120` (расширение) проверяет на **реальном дереве репозитория** все 76 файлов `scripts/**`, реально входящих в зависимости хотя бы одного product-теста — ровно тот набор, на котором r1 нашёл потерю; плюс новый `scripts/new-unowned.mjs` (несуществующий, без потребителей) → `['product','tooling']`.
- Новый тест `test/unit-groups.test.mjs:136-153` воспроизводит сценарий r1 на git-фикстуре: общий `scripts/shared.mjs`, используемый и tooling-, и product-тестом (через `scripts/helper.mjs`) → локальный `requiredUnitGroups` после правки `shared.mjs` требует `['product','tooling']`; после сужения правки только к `helper.mjs` (не влияющей на tooling-тест транзитивно) — `['product']`; новый неизвестный скрипт → оба. Все три ветки воспроизводимы и я лично проверил их падение на r1-коде и прохождение на r2.
- `docs/DEVELOPMENT.md` обновлён в том же коммите текстом, прямо описывающим исправленное свойство («Imported tools keep every computed consumer, including product tests; a scripts/ prefix cannot discard them») — соответствует новому поведению, не расходится с кодом.
- Трейлеры коммита `2de721611`: `Issue: #982`, `User-Visible: no` — корректно, CHANGELOG не нужен и не тронут (diff stat подтверждён).
- Не нашёл числа, видимого дважды в этой дельте (§8): дельта не меняет пользовательских величин.

## Чего не проверял

- Полный `npx tsc --noEmit`/`npm test`/`npm run build`+`bundle-policy --verify` своими руками — переиспользован зелёный Validate на точном SHA материала (39525477450).
- golden, браузерные смоки, `pytest tests_backend`, широкие perf-прогоны — дельта их не касается (нет `src/**`/`custom_components/**`/`demo/**`/геометрии/Python/UX).
- Остальные унаследованные из r1 гейты (compound CI-proof, cold no-build tooling, `test/ci-proof.test.mjs` и смежные контрактные тесты) — не перегонял повторно: реализация этих файлов в дельте r2 не менялась (см. «Унаследовано из r1»).
- Поведение `--group=all`/ручных `gate:product`/`gate:tooling` путей вне `groupsAffectedBy` — не трогалось дельтой, не перепроверял.

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| Medium: `groupsAffectedBy` коротким путём относит любой `scripts/**` к `tooling`, теряя реальных product-потребителей (76 файлов, включая `scripts/model-invariants.mjs`) | Префиксный ярлык `scripts\|\.github\|\.githooks` удалён; принадлежность решается только через `grouping.dependencies`, неизвестный/неиспользуемый файл — fail-closed `['product','tooling']` | `scripts/unit-groups.mjs:123-133` (diff `c582db5f7..2de721611`); новый прогон всех 76 файлов и git-fixture теста — `test/unit-groups.test.mjs:95-120,135-153`, лично воспроизведено падение на r1-коде / прохождение на r2-коде (таблица гейтов выше) |

## Унаследовано из r1

Без повторной проверки в r2, принято по документу `docs/reviews/CODE-REVIEW-982-r1.md` на материале `c582db5f7ada4290043ab6769a738f7f300f8cf2` (реализация этих частей дельтой r2 не затронута):

- AC1 (классификация по импортам/реальным чтениям без allowlist, 8 unit-кейсов, реальное дерево 316 product / 163 tooling / 479 всего).
- AC2 (frontend ≤4 мин): независимо подтверждённый тайминг CI [39520777002](https://github.com/Matysh/houseplan-card/actions/runs/39520777002) — frontend 218 с, tooling 242 с, оба `success` на SHA `c582db5f7`; раздельность `frontend`/`tooling` job в `validate.yml`.
- AC3 (объединение без потерь, обе CI job обязательны): `test/ci-proof.test.mjs` негативные случаи (отсутствующая/красная tooling job), `scripts/ci-proof.mjs` `JOB_RULES.frontend`.
- `docs/release-ledger/v1.81.0/982.json`: `category: infra`, `baseStable: v1.81.0`, согласован с #974/#977/#979 — не тронут в r2.
- Low (не блокировал в r1): недостижимая ветка `dynamicConsumers.has(p)` в `isProductInput` — дельта r2 её не трогает, остаётся поддерживаемость-note.

## Маршрут

`route: fix`. Единственная Medium-находка r1 закрыта минимальным, точным по месту изменением с реальным (не мутантным) негативным доказательством; новых находок нет. Критерии §5 трека `show` дельтой не нарушены.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/982-test-partitions`, коммит `2de721611cd9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `36343badc540f8453059ce5a01059dbff5394260`
  ```
  git log --all --format='%H %T' | grep 36343badc540
  ```
- Тело issue: `afaa2ba63c140558972a8820b27ea68cbe395bc9ba65574e1afbf5168a8c8c4c`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxODUsIm91dHB1dF90b2tlbnMiOjE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjY1MDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjozOCwib3V0cHV0X3Rva2VucyI6MTY0NDksImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzY2MTksImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxMjg1MjM3LCJjb3N0VXNkRXN0aW1hdGUiOjAuNzI4MDg5Mzk5OTk5OTk5OX1dLCJ0dXJucyI6MjksImR1cmF0aW9uTXMiOjIwMzIwMywiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzMzMzU0NCwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5223 output_tokens=16465 cache_creation_input_tokens=76619 cache_read_input_tokens=1285237 num_turns=29 -->
