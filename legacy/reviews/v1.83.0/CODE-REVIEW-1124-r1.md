# Код-ревью #1124 — заход r1

Материал: `9f7b3cc7b24e73b2d4da1273bbaa359c5949015d` (ветка `issue/1124-explicit-validation-permissions`, база `72c63464ae88cd5714e60ab68da3d09ae04d39b4`). Трек `show`, этап `code`, блокирующих циклов 0/2.

## Скоуп

Issue #1124: первый прогон CodeQL (default setup) дал 32 Medium-алерта `actions/missing-workflow-permissions` на трёх workflow (`validate.yml`, генерируемые `validate-product.yml`/`validate-tooling.yml`). Нужно: явный `permissions: contents: read` на уровне каждого из трёх workflow; расширение прав только тем job, которым действительно нужно больше; после выпуска в `main` — закрытие алертов (вне материала этого ревью).

Изменённые файлы (ровно 11, совпадает с `changedFiles` в REVIEW_CONTEXT): `.github/workflows/{validate,validate-product,validate-docs,validate-tooling}.yml`, `scripts/ci-profiles.mjs`, `scripts/ci-registry-inventory.json`, `test/ci-profiles.test.mjs`, `docs/{ARCHITECTURE,DEVELOPMENT,STATUS}.md`, `docs/release-ledger/v1.82.0/1124.json`. Один коммит `9f7b3cc7b`.

## Как проверялось

Static-first: прочитан REVIEW_CONTEXT, тело issue, хендофф автора. Самостоятельно прочитаны все 4 workflow (полностью, включая нетронутые job — чтобы увидеть эффективные права каждой job), `scripts/ci-profiles.mjs` целиком, `scripts/ci-registry-inputs.mjs` (`executionHeader`, `jobRecipe`), `scripts/ci-registry-build.mjs` (`restoreRegistryBuild`), `test/ci-profiles.test.mjs` целиком, релиз-леджер и три абзаца документации. Получен полный `read:diff` — сверен построчно с тем, что я увидел при независимом чтении файлов; совпадает полностью, посторонних правок нет.

Выполнено адресно (через `mcp__houseplan_review__run_check`, не дублируя покрытие `review-light-full`):
- `unit:test/ci-profiles.test.mjs` → **passed** (exitCode 0). Этот файл несёт единственный прямой unit-свидетель AC — выполнил его лично на материале, а не положился на переиспользование.
- `read:log`, `read:diff` — для независимой сверки диапазона и диффа против собственного чтения файлов.

Не запускал общий `gate:small`/`npm test`/`tsc` отдельно: `review-light-full` (https://github.com/Matysh/houseplan-card/actions/runs/40972582037) уже зелёный на этом SHA и покрывает их; материал/входы с момента прогона не менялись.

## Независимый разбор

1. **Workflow-level default.** Все три generated-профиля и канонический `validate.yml` получили `permissions:\n  contents: read\n` сразу после `concurrency:`/`name:`. Для generated-профилей это не захардкожено в шаблоне ревью, а реально вычисляется `executionHeader(canonical)` (`scripts/ci-registry-inputs.mjs:153`) — функция вытягивает из текста `validate.yml` блоки `env`/`defaults`/`permissions` до `jobs:`. Проверил регэксп и порядок конкатенации: извлекается ровно новый верхний `permissions:` блок, посторонний текст не захватывается. Значит, явный источник правды один — `validate.yml`; три generated-файла синхронизируются с ним автоматически и это гонится автотестом `#980` (сравнение `generatedProfiles()` с записанными файлами), который прошёл в `unit:test/ci-profiles.test.mjs`.
2. **Эффект workflow-level default на job без своего блока.** В `validate.yml` до правки 12 job не имели собственного `permissions` (`hacs`, `hassfest`, `changed_mutants`, `frontend`, `bundle`, `product_guards`, `smoke`, `smoke_done`, `golden`, `performance_smoke`, `geometry_parity`, `backend`) — именно это перечислено в теле issue. После правки они по-прежнему не имеют собственного блока, но теперь это не "ничего не объявлено" (implicit repo-wide default, потенциально read+write), а явное наследование `contents: read` от workflow. Я прочитал шаги каждой из этих job и не нашёл ни одной, которой нужно больше `contents: read`: `hacs`/`hassfest`/`changed_mutants`/`geometry_parity`/`backend` — только checkout и сторонние/локальные команды; `frontend`/`smoke`/`smoke_done`/`golden`/`performance_smoke`/`product_guards` используют `actions/download-artifact` и `actions/upload-artifact` **в рамках одного прогона** — эти действия аутентифицируются внутренним `ACTIONS_RUNTIME_TOKEN`, а не `GITHUB_TOKEN`, поэтому `actions:` scope им не нужен (в отличие от `gh run download` между прогонами). Это согласуется с тем, что CodeQL-правило `actions/missing-workflow-permissions` реагирует именно на отсутствие explicit-блока, а не требует минимум прав сверх `contents: read`.
3. **Единственное реальное расширение — `bundle: { contents: read, actions: read }`.** Проверил по коду, а не по утверждению автора: `bundle` вызывает `node scripts/ci-registry-build.mjs` → `prepareRegistryBundle` → при `FRONTEND_REUSED=true` зовёт `restoreRegistryBuild()` (`scripts/ci-registry-build.mjs:18`), которая делает `execFileSync('gh', ['run', 'download', String(run), '--repo', repo, ...])` — кросс-ранный REST-вызов, аутентифицированный `GH_TOKEN: ${{ github.token }}` (объявлен в том же шаге `bundle`). Такому вызову действительно нужен `actions: read` на токене. Других job с `gh run download`/`gh api` не нашёл за пределами уже имевшихся explicit-блоков (`preflight`, `changes`, `reuse`, `tooling`, `browser_selected`, `dev_build`, `proof`) — они не тронуты диффом, что я сверил по `read:diff`.
4. **`jobRecipe` не теряет чувствительность к правам.** `jobRecipe()` (`scripts/ci-registry-inputs.mjs:158`) хэширует `executionHeader(text)` вместе с телами job для content-addressed reuse/registry. Так как `executionHeader` теперь включает новый `permissions:` блок, смена прав меняет recipe-хэш — старые "зелёные" записи реестра не маскируют новый уровень прав задним числом. Проверил это по коду, не запуская отдельно registry-механику (не относится к риску этой задачи — права, не контент сборки).
5. **Тест `#1124`.** Прочитан и выполнен. Он не просто сравнивает текст YAML, а вычисляет **эффективные** права каждой job (`job.permissions ?? workflow.permissions`) по распарсенному реальному `validate.yml` и по трём generated-файлам, и фейлит на обычных отрицательных конфигурационных объектах (без патча исполняемого файла, без исполнения мутанта — именно то, что разрешено политикой): `permissions` не задан/`{}`/`read-all`/`write-all`/`contents: write`/лишний `issues: write` на workflow-уровне; `frontend` с `contents: write`; `proof` без своего блока (пропала публикация); `bundle` без `actions:` (пропал кросс-ранный ридер). Все 6 негативных кейсов проверены как `assert.throws`. Это прямое попадание в требование "AC · чем доказан · чем краснеет" для защитного AC (least-privilege — это и есть ограничение/гард).
6. **Документация и леджер.** `docs/ARCHITECTURE.md`/`DEVELOPMENT.md`/`STATUS.md` описывают новое поведение корректно и совпадают с кодом (кроме одной словесной неточности — см. ниже). `docs/release-ledger/v1.82.0/1124.json` — `category: infra`, без `introducedBy` — верно: это не новая функция беты, а инфраструктурное усиление default-прав существующего CI, не входит в пользовательский milestone (§7.2/#838). User-Visible не затронут (нет UI/поведения продукта), трейлер `User-Visible: no` ожидаемо не требует правок changelog — это согласуется с единственным коммитом, прошедшим `process-gate`/`validate-commit-provenance` в зелёном `review-light-full`.

### Мелкая неточность в документации (не находка)

`docs/ARCHITECTURE.md` и `docs/DEVELOPMENT.md` формулируют так, будто product-профиль наследует "канонический execution header", а docs/tooling — некий отдельный "restricted default". По коду все три generated-профиля получают **один и тот же** `executionHeader(canonical)` (`scripts/ci-profiles.mjs:111-113`) — отдельного дефолта для docs/tooling нет. Итоговое поведение, которое описывает текст (`contents: read` у всех трёх), верно, расхождение чисто в объяснении механизма. Это не вводит читателя в заблуждение относительно наблюдаемого поведения и не меняет доказательную силу теста, поэтому не поднимаю это как Medium — называю для протокола.

## Что проверено и корректно

- Все 32 алерта CodeQL адресуются ровно тем способом, который правило ожидает (explicit workflow-level `permissions`), без избыточного расширения прав ни одной job.
- Единственное реальное увеличение прав (`bundle: actions: read`) обосновано конкретным кодовым путём (`gh run download`), а не "про запас".
- Старые explicit job-блоки (`preflight`, `changes`, `reuse`, `tooling`, `dev_build`, `browser_selected`, `proof`) не тронуты диффом — сверено по `read:diff`.
- Генератор (`scripts/ci-profiles.mjs --write`) — единственный источник трёх производных workflow; ручных правок YAML нет; фикстура `scripts/ci-registry-inventory.json` синхронна (добавлена одна строка-путь к новому леджеру в двух местах).
- Тест `#1124` выполнен лично и прошёл; он воспроизводимо падает на обычных отрицательных конфигурациях (перечислены выше) — требование "чем краснеет" закрыто без мутанта и без патча исполняемой реализации.
- Леджер классифицирован как `infra`, что соответствует характеру изменения (§7.2, #838).
- Трейлеры/провенанс/процессный гейт — часть `review-light-full`, зелёный на этом SHA; не переисполнял.

## Что не проверялось

- Фактическое закрытие 32 CodeQL-алертов в `main` — по определению задачи это наблюдение после публикации, не доказуемо на этом материале; корректно обозначено в теле issue и леджере как последующий шаг.
- Полный `gate:small`/браузерные smoke — не являются адресной проверкой для этого диффа (чисто workflow-permissions конфигурация, без продуктового кода/UI); тело issue не называет смоук-сценарий.
- Поведение `bundle` job живьём в GitHub Actions (реальный `gh run download` с реальным токеном) — не запускается ревьюером; оценено чтением кода и существующим CI-доказательством.

## Гейты

Прогнано (адресно, этим ревью): `unit:test/ci-profiles.test.mjs` (passed), `read:log`, `read:diff`.
Не прогонялось отдельно (переиспользовано из `review-light-full`, https://github.com/Matysh/houseplan-card/actions/runs/40972582037, тот же материал): build/typecheck, product+tooling unit-группы, no-new-any/private-writes, bundle policy/budget, unused ratchet, `process-gate`. Причина: входы/окружение/oracle не изменились с момента этого прогона, а задача не product/UI — полный `gate:small` непропорционален риску (PROCESS.md §8).

## Маршрут

Критерии §5 пройдены: один модуль (CI-конфигурация workflow), сложность/риск низкие, нет миграции конфигурации продукта, нет нового UX-контракта, нет влияния на производительность/touch, ожидаемое поведение зафиксировано в документации (ARCHITECTURE/DEVELOPMENT/STATUS/леджер) и в самом issue. `route: fix`.

## Находки

High: 0. Medium (в скоупе): 0. Побочных находок вне скоупа нет — `outside_findings` пуст (политика `mode=issues`).

## Вердикт

**green.**

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjZiNDAzYTAxMDVhMmJhN2RjM2JlMzdkYmI2ZmY1ZTk5NmU1NjE5ZDkwODQ3MWViOTE5ZjgyNjY5ZmQzNTg3MmMiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJlMjlmMTllZDIwN2ViM2Y0ZTdhZjEwNDYxODBiOTE5N2U3MDFhZWM0ZjYwZTgzN2NhZTdkMjhkYzJkNDIwNTIxIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTI0LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI5ZjdiM2NjN2IyNGU3M2IyZDRkYTEyNzNiYmFhMzU5YzU5NDkwMTVkIiwidHJlZSI6IjVlYTM4MmI5ZmEwMmQ0ZGI0OTQyNThhNTMwNzMxODNlMGE0Zjc5OWEiLCJib2R5RGlnZXN0IjoiY2ZiYzdiZjgxMDgxZjY4ZDc3YWU3MDU3ZmNhNWJkYzEwYWVjZDgzZTFlYTY5YzkwNmVlYzRhZjhhZTY1ODA1NyIsInByb2R1Y2VyUnVuIjoiNDA5NzUyMjU4MzYiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImU4YjEwYzhiMTM2NjkwMzY0NmY1MDRjYjQ3YzI1ZTE2YTJlNGVlODI0ZjBkOGVlNjQxNTAyYmZhZGRmYjIxYmUiLCJ2ZXJkaWN0RGlnZXN0IjoiOTg4YzE0YWJkZTZmMjM0YTJhYTM2MjU5ZmJkYjYxZDU5YWI4OTc1YWQ3OGM3NGZlOGNjN2ZiNDU0OTZmMDE5OSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI0MmZiNDU4NTUyMWNjYzFkMThhYTdiMjk5YTFkNTVhNjg0NjgxNDE4MTZmNGM2MDg0MjI3NzJiZTc4ZTU3ZmIzIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NTExMzE0ODE4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTI0I2lzc3VlY29tbWVudC02NTExMzE0ODE4IiwiYm9keURpZ2VzdCI6IjQ1Yzk2YmIxYTU3MWVmODhiMDhkMDkyMmUwZTIyZDUwNjI4NjgwOWYyNzQ5MDVhZDYyY2MzMzg5Mzc5NmJmMmQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1124-explicit-validation-permissions`, коммит `9f7b3cc7b24e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `5ea382b9fa02d4db494258a53073183e0a4f799a`
  ```
  git log --all --format='%H %T' | grep 5ea382b9fa02
  ```
- Тело issue: `cfbc7bf81081f68d77ae7057fca5bdc10aecd83e1ea69c906eec4af8ae658057`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40975225836,"run_attempt":1,"digest":"9a63b3e403b76c0b39ca501959e9c0d384ddf49011262e48ced1dc3f18b70077"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTAsIm91dHB1dF90b2tlbnMiOjE5NjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2NzAxMywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMzNzE3MDcsImNvc3RVc2RFc3RpbWF0ZSI6MS41Mzg2ODM0MDAwMDAwMDAzfV0sInR1cm5zIjozNSwiZHVyYXRpb25NcyI6MjY0NjA3LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS41Mzg2ODM0MDAwMDAwMDAzLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=50 output_tokens=19619 cache_creation_input_tokens=167013 cache_read_input_tokens=3371707 num_turns=35 -->
