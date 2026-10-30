# Код-ревью #1124 — заход r2

Материал: `fc64641b9178ae238054fcb155b432963858456f` (дерево `f187491b3c80d072c709186d435956f11ac7dad2`). Трек `show`, этап `code`, блокирующих циклов 0/2.

## Скоуп

Issue #1124 не изменилась со времени r1: первый прогон CodeQL (default setup) дал 32 Medium-алерта `actions/missing-workflow-permissions` на трёх workflow (`validate.yml` и генерируемые `validate-product.yml`/`validate-tooling.yml`). Нужно: явный `permissions: contents: read` на уровне каждого из трёх workflow; расширение прав только тем job, которым действительно нужно больше; закрытие алертов после выпуска в `main` — вне материала этого ревью.

Задекларированная база диапазона для этого захода — `52f572a68e687deb5b099971364986dbb30c7734` (после публикации ревью #1132), а не база r1 (`72c63464ae88`). `read:log` на этом диапазоне даёт ровно 2 коммита:

- `b8bf44004` — `ci: restrict validation token defaults and declare artifact reader permissions` — тот же код-патч по существу, что ревьюился в r1, перебазированный на текущий `dev`.
- `fc64641b9` — `docs: review document for #1124` — публикация самого `docs/reviews/CODE-REVIEW-1124-r1.md` (документ r1 теперь часть дерева).

Изменённые файлы — 12: те же 11, что в r1 (`.github/workflows/{validate,validate-product,validate-docs,validate-tooling}.yml`, `scripts/ci-profiles.mjs`, `scripts/ci-registry-inventory.json`, `test/ci-profiles.test.mjs`, `docs/{ARCHITECTURE,DEVELOPMENT,STATUS}.md`, `docs/release-ledger/v1.82.0/1124.json`), плюс новый `docs/reviews/CODE-REVIEW-1124-r1.md`. Это согласуется с указанием «Смена SHA из-за review/docs сама по себе не отменяет пригодное доказательство»: единственная причина нового SHA — ребейз + публикация документа r1, не новая правка по существу.

## Как проверялось

Static-first: прочитан REVIEW_CONTEXT, тело issue (не изменилось — тот же `bodyDigest`), хендофф автора (тот же `id`/`digest`, что в r1), документ r1 целиком.

Выполнено адресно (через `mcp__houseplan_review__run_check`):
- `read:log`, `read:diff` — независимая сверка диапазона/диффа этого захода против документа r1.
- `unit:test/ci-profiles.test.mjs` → **passed**, 14/14, 0 fail/skip, личный прогон на этом SHA (не переиспользование r1). Единственный прямой unit-свидетель AC `#1124`, включая негативные конфигурационные кейсы.
- `static:status-snapshot` → **passed** («snapshot block is current») — адресная проверка новой дельты в `docs/STATUS.md` (счётчики/дата/тег бета), которой не было в r1 (ребейз на более новый `dev` после выпуска `beta.4`).
- `unit:test/release-ledger.test.mjs` → **passed**, 6/6 — адресная проверка нового `docs/release-ledger/v1.82.0/1124.json`.

Независимо прочитаны (не только через диф, а в текущем дереве) все четыре workflow и ключевые функции `scripts/ci-registry-inputs.mjs` (`executionHeader`, `jobRecipe`) и `scripts/ci-registry-build.mjs` (`restoreRegistryBuild`) — см. ниже.

Не запускал общий `gate:small`/`npm test`/`tsc`/browser smokes: `review-light-full` зелёный ровно на этом SHA `fc64641b9178ae238054fcb155b432963858456f` (https://github.com/Matysh/houseplan-card/actions/runs/40977338353, «review-light-full proof is complete»), покрывает build/typecheck, product+tooling unit-группы, no-new-any/private-writes, bundle policy/budget, unused ratchet, process-gate. Входы/окружение/oracle с этого прогона не менялись — дополнительный прогон этих наборов непропорционален риску чисто-CI-конфигурационного диффа (PROCESS.md §8).

## Независимый разбор

1. **Диф по существу идентичен r1.** Прочитал полный `read:diff` (база→кандидат) и сверил построчно с хунками, описанными в документе r1: три `permissions:\n  contents: read\n` блока на уровне workflow (`validate.yml`, `validate-product.yml`, `validate-tooling.yml`, плюс нетронутый issue `validate-docs.yml`, тоже получивший этот блок), единственное job-расширение `bundle: { contents: read, actions: read }` в `validate.yml`/`validate-product.yml`, изменение дефолта `header()` в `scripts/ci-profiles.mjs:17`, одна добавленная строка пути в `scripts/ci-registry-inventory.json` (дважды, для product и tooling инвентарей), новый тест `#1124` в `test/ci-profiles.test.mjs`. Расхождений с r1 по существу нет.
2. **Прямая проверка текущих файлов, а не только диффа.** Прочитал `grep` по `permissions:`/`contents:`/`actions:` в живых `.github/workflows/validate.yml` и `validate-product.yml`: ровно 9 вхождений `permissions:` в каждом (1 workflow-level + 8 job-level — `preflight`, `changes`, `reuse`, `tooling`, `bundle` (новый), `browser_selected`, `dev_build`, `proof`). Это число точно совпадает с суммой «уже существовавшие explicit-блоки (7) + один новый (bundle)» — значит ни одна из 12 job без собственного блока (`hacs`, `hassfest`, `changed_mutants`, `frontend`, `product_guards`, `smoke`, `smoke_done`, `golden`, `performance_smoke`, `geometry_parity`, `backend`) не получила лишних прав помимо наследуемого `contents: read`, и `bundle` — единственное реальное расширение. Независимо подтверждено для `validate-docs.yml`/`validate-tooling.yml`.
3. **Механизм генерации всё ещё корректен.** Прочитал `executionHeader()` (`scripts/ci-registry-inputs.mjs:153-157`): вытягивает `env`/`defaults`/`permissions` блоки из текста workflow до `\njobs:` — с новым `permissions:` в `validate.yml` функция подхватывает именно его, что объясняет идентичный блок в трёх generated-профилях. `jobRecipe()` (`:158-165`) хэширует `executionHeader(text)` вместе с телами job — значит новый уровень прав меняет recipe-digest, старые registry-записи не маскируют его задним числом. `restoreRegistryBuild()` (`scripts/ci-registry-build.mjs:18-23`) реально вызывает `execFileSync('gh', ['run', 'download', ...])` — кросс-ранный REST-вызов, которому нужен `actions: read` на токене; это обосновывает единственное расширение `bundle`. Ни один из этих трёх файлов не входит в диф — они читаются ради независимой проверки механизма, не предположения на веру.
4. **Тест `#1124` — личный прогон, не переиспользование.** Запустил `unit:test/ci-profiles.test.mjs` сам на этом SHA: 14/14 passed, 0 fail/skip, включая подтест `#1124`. Код теста (виден в `read:diff`) вычисляет **эффективные** права каждой job (`job.permissions ?? workflow.permissions`) по распарсенному реальному `validate.yml` и трём generated-файлам и фейлится на обычных отрицательных конфигурационных объектах — `permissions` не задан/`{}`/`read-all`/`write-all`/`contents: write`/лишний `issues: write` на workflow-уровне, `frontend` с `contents: write`, `proof` без своего блока, `bundle` без `actions:`. Все случаи — `assert.throws` над `structuredClone`/литеральными объектами конфигурации, без патча исполняемого workflow-файла и без исполнения мутанта — соответствует разрешённой политике «обычные negative-input cases на неизменённой реализации».
5. **Единственная новая дельта этого захода — `docs/STATUS.md`.** Диапазон базы (`52f572a68e`) новее базы r1 (`72c63464ae`): между ними landed нотация релиза `beta.4` и правки других issue, поэтому сгенерированный снимок обновился (`2026-10-29`→`2026-10-30`, `5894`→`5895` Node-тестов, `beta.3`→`beta.4`). Это не ручная правка: файл несёт маркер «generated... do not edit by hand», а `static:status-snapshot` подтверждает «snapshot block is current» — числа в снимке соответствуют текущему дереву, а не выдуманы. Не является изменением по существу этой задачи.
6. **Леджер и документация не изменились по содержанию** относительно r1 (сверено построчно по `read:diff`): `category: infra`, без `introducedBy`, трейлер `User-Visible: no` по-прежнему согласуется с отсутствием UI/продуктовых правок и отсутствием правок changelog в диапазоне.

## Что проверено и корректно

- Диф этого захода по существу (все 11 изначальных файлов) идентичен ревьюированному в r1; единственная новая дельта — регенерированный `docs/STATUS.md` (объяснена рутинным ребейзом, подтверждена отдельным адресным прогоном).
- Прямое чтение живых workflow подтверждает: ровно один новый уровень прав (`bundle: actions: read`), ни одна из 12 перечисленных в issue job без собственного блока не получила избыточных прав.
- Механизм `executionHeader`/`jobRecipe`/`restoreRegistryBuild`, обосновывающий дизайн, независимо прочитан и подтверждён в текущем дереве (не входит в диф, но несёт риск, если бы был сломан).
- Тест `#1124` лично выполнен на материале этого захода (не унаследован бездоказательно) — 14/14 passed, воспроизводимо падает на перечисленных обычных отрицательных конфигурациях.
- Леджер (`category: infra`) и трейлер `User-Visible: no` согласованы с характером правки (§7.2/#838); отдельный `unit:test/release-ledger.test.mjs` зелёный на новом файле.
- `read:log` показывает ровно 2 коммита в диапазоне, без посторонних/незапушенных правок.

## Что не проверялось

- Фактическое закрытие 32 CodeQL-алертов на `main` — наблюдается после публикации, не доказуемо на этом материале (как и в r1).
- Полный `gate:small`/браузерные smoke — не адресная проверка для чисто-CI-конфигурационного диффа; переиспользован зелёный `review-light-full` на этом точном SHA.
- Живое поведение `bundle`/`gh run download` с реальным токеном в GitHub Actions — оценено чтением кода и существующим CI-доказательством, не воспроизводилось ревьюером.

## Гейты

Прогнано (адресно, этим ревью): `read:log`, `read:diff`, `unit:test/ci-profiles.test.mjs` (14/14 passed), `static:status-snapshot` (passed), `unit:test/release-ledger.test.mjs` (6/6 passed).
Не прогонялось отдельно (переиспользовано из `review-light-full`, https://github.com/Matysh/houseplan-card/actions/runs/40977338353, тот же материал `fc64641b9178ae238054fcb155b432963858456f`): build/typecheck, product+tooling unit-группы, no-new-any/private-writes, bundle policy/budget, unused ratchet, `process-gate`/commit-provenance/трейлеры. Причина: входы/окружение/oracle не изменились с момента этого прогона, задача не product/UI — полный набор непропорционален риску (PROCESS.md §8).

## Маршрут

Критерии §5 пройдены (как в r1, факты не изменились): одна поверхность (CI-конфигурация workflow), сложность/риск низкие, нет миграции конфигурации продукта, нет нового UX-контракта, нет влияния на производительность/touch, ожидаемое поведение зафиксировано в документации (ARCHITECTURE/DEVELOPMENT/STATUS/леджер) и в самом issue. `route: fix`.

## Находки

High: 0. Medium (в скоупе): 0. Побочных находок вне скоупа нет — `outside_findings` пуст (политика `mode=issues`, round 2).

## Вердикт

**green.**

## Закрытие раунда r1

| Находка | Чем закрыта | Где это видно |
|---|---|---|
| — | r1 завершился зелёным вердиктом без High/Medium находок (High 0, Medium 0); закрывать нечего. | `docs/reviews/CODE-REVIEW-1124-r1.md`, раздел «Находки»/«Вердикт» |

## Унаследовано из r1

- Независимый разбор механизма least-privilege (workflow-level default, эффект на 12 job без собственного блока, единственное расширение `bundle: actions: read`, чувствительность `jobRecipe` к правам) — принят без повторного самостоятельного вывода «с нуля», но в этом заходе дополнительно перепроверен прямым чтением живых workflow и исходников `ci-registry-inputs.mjs`/`ci-registry-build.mjs` (см. «Независимый разбор» выше), а не просто процитирован. Документ: `docs/reviews/CODE-REVIEW-1124-r1.md`, материал r1 `9f7b3cc7b24e73b2d4da1273bbaa359c5949015d`.
- Классификация леджера (`category: infra`, без `introducedBy`) и вывод о `User-Visible: no` — приняты без повторного обсуждения §7.2/#838, содержание `docs/release-ledger/v1.82.0/1124.json` в этом заходе не изменилось (сверено `read:diff`). Документ: `docs/reviews/CODE-REVIEW-1124-r1.md`, материал r1 `9f7b3cc7b24e73b2d4da1273bbaa359c5949015d`.
- Авторский хендофф (комментарий `6509198180`) — тот же объект, что рассматривался в r1 (идентичный `digest`), повторно не передопрашивался, но сопоставлен с независимым разбором этого захода, а не принят на веру.

## Публикация

Доверенный снимок prepare: `mode=issues`. Побочных Medium находок вне скоупа нет — `outside_findings` пуст.

---

## Материал раунда

- Коммиты в диапазоне (`read:log`): `b8bf44004` (`ci: restrict validation token defaults and declare artifact reader permissions`), `fc64641b9` (`docs: review document for #1124`).
- Материал: `fc64641b9178ae238054fcb155b432963858456f`, дерево `f187491b3c80d072c709186d435956f11ac7dad2`.
- Тело issue: `cfbc7bf81081f68d77ae7057fca5bdc10aecd83e1ea69c906eec4af8ae658057` (не изменилось с r1).
- Validate-gate на этом материале: https://github.com/Matysh/houseplan-card/actions/runs/40977338353 — «review-light-full proof is complete».
- Вердикт этого захода: `green` · High 0 · Medium 0 · маршрут `fix`.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImEyM2RhN2QyMGM1NmJiOTA2ZjU5NjEyNmZhNzYxZDRhMTk0ZmRjZGU3NjNlOGY2YWJmN2ZlODBhMzE0MmM1N2QiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI3MDVkOGQxMTIyNjU3NjRkMjIyZjE2MzVkNGI0MmU2N2Q3NDQ3NjkxYzE4ODEwYTQzODljOGFkYjRhYWU2MmFjIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTI0LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MiwibWF0ZXJpYWwiOiJmYzY0NjQxYjkxNzhhZTIzODA1NGZjYjE1NWI0MzI5NjM4NTg0NTZmIiwidHJlZSI6ImYxODc0OTFiM2M4MGQwNzJjNzA5MTg2ZDQzNTk1NmYxMWFjN2RhZDIiLCJib2R5RGlnZXN0IjoiY2ZiYzdiZjgxMDgxZjY4ZDc3YWU3MDU3ZmNhNWJkYzEwYWVjZDgzZTFlYTY5YzkwNmVlYzRhZjhhZTY1ODA1NyIsInByb2R1Y2VyUnVuIjoiNDA5NzgyMTk1MjMiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijc4MzBmM2Y3ZGNiYTUzMjkzNmM0NmIzZWJiYWI2NzYyYWM4NDk4NjY0ZjNhZjM4OWI5ZGQwM2Q3ZTgzMWY1MTkiLCJ2ZXJkaWN0RGlnZXN0IjoiZGU3MDNmNDg4Njc3OTY5ZDM5OGExYjYyZWUyMmEyZDc0MWJiNDAzZDhjNjZmODYzOGM5ZTc3ZGQ3MTBlNTg4ZCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI1NWM4OTU4YjU4MjA3MGMyODVlOTE4YTMyZWY2OWQyYTk5NWFiYzdhMzE4MmI2MGY3ZDBhMTFjMzYyM2Q1MmNhIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTExNzE3MTk5LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTI0I2lzc3VlY29tbWVudC02NTExNzE3MTk5IiwiYm9keURpZ2VzdCI6ImYzNWQ2ZTBjZGRmNjY2MmE2MjNlZGFlMGRiYzE0MjJhOWE0YmNiNTc5MDUyZDBmYmFkM2MwOTJlYjA1MDdmOTQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1124-explicit-validation-permissions`, коммит `fc64641b9178` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f187491b3c80d072c709186d435956f11ac7dad2`
  ```
  git log --all --format='%H %T' | grep f187491b3c80
  ```
- Тело issue: `cfbc7bf81081f68d77ae7057fca5bdc10aecd83e1ea69c906eec4af8ae658057`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40978219523,"run_attempt":1,"digest":"9dd1c591412dd6ed08bc7e1f23fa8889eb4f20993c33a16255763471b4f11e33"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6MzgsIm91dHB1dF90b2tlbnMiOjIwNDgyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjg3NjcwLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MTI3MjE3OSwiY29zdFVzZEVzdGltYXRlIjowLjgxMDAxMTh9XSwidHVybnMiOjMxLCJkdXJhdGlvbk1zIjoyNzU1MjAsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjowLjgxMDAxMTgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=38 output_tokens=20482 cache_creation_input_tokens=87670 cache_read_input_tokens=1272179 num_turns=31 -->
