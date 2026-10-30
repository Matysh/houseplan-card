# CODE-REVIEW-1067 — issue #1067

Материал: `1d2dadc03fe9e8d60dce69aec0311e92b19fe9e1` (tree
`acf54209c801f30357bd38619b7f177097104df9`), диапазон `git log --oneline
origin/dev..HEAD` — 5 коммитов (`fc0468a1f` fix(ci): authenticate retained
same-run task execution → `946a976a9`/`aab003f72` docs: review document for
#1067 → `7dda0c2da`/`1d2dadc03` docs(ci): preserve/refresh bounded review
context). Трек: `ask` (повышен конвейером после `route: reclassify` в
CODE-REVIEW-1067-r1). Этап: `code`. Заход r3, блокирующих циклов 1/4
(единственный потраченный цикл — жёлтый `reclassify` в r1; бюджет кода
отдельный от бюджета SPEC).

## Скоуп

Диапазон — 22 файла, классы **B** (`scripts/**`, `test/**`,
`.github/workflows/**`) и **C** (`docs/**`, `docs/release-ledger/**`,
`docs/development-notes/**`). Класс A (`src/**`) не затронут — классы риска
по участкам не вычисляются.

Задача реализует ТЗ, принятое в SPEC-REVIEW-1067-r1 (зелёный, High0/Medium0):
аутентифицированное «retained execution» — producer и consumer независимо
подтверждают, что job с тем же именем в старой и новой попытке того же
GitHub run — одно и то же исполнение (не повторный запуск), через вызовы
GitHub API (`/attempts/<N>/jobs`) и побайтовое сравнение исполнения/шагов, не
доверяя общему `conclusion` рана. Инфраструктурная задача — обслуживает не
строку `docs/SCOPE.md`, а единственный доверенный канал приёмки кандидата
(§1 PROCESS.md/AGENTS.md), как и зафиксировано в SPEC-REVIEW-1067-r1.

## Как проверялось

Независимый построчный разбор кода предшествовал сопоставлению с хендоффом.
`validate-gate` для точного материала (ciEvidence) явно называет только run
`validate-product.yml` (40240846533); run `validate-tooling.yml`
(40240846556), под которым реально выполняются все четыре изменённых suite
(`task-check-reuse/source`, `ci-proof`, `task-check-workflow` — это
tooling-инфраструктура), в приложенном evidence не назван отдельно. Это
конкретный непокрытый пробел по названным suites — закрыт адресным
исполнением через `run_check`, а не чтением:

| Гейт | Статус | Где видно |
|---|---|---|
| `read:diff`, `read:log` на точном материале | PASS | это ревью, независимое построчное чтение всего диффа |
| `unit:test/task-check-reuse.test.mjs` | PASS 66/66 | адресный прогон ревьюером, 0.41 с |
| `unit:test/task-check-source.test.mjs` | PASS 15/15 | адресный прогон ревьюером, 0.58 с |
| `unit:test/ci-proof.test.mjs` | PASS 29/29 (видно по числу subtests в TAP) | адресный прогон ревьюером, 7.26 с |
| `unit:test/task-check-workflow.test.mjs` | PASS 2/2 | адресный прогон ревьюером, 0.30 с |
| `unit:test/status-counter-equivalence.test.mjs` | PASS 8/8, 1 skip (не по теме — отсутствующий force-push fixture, та же причина, что в r1) | адресный прогон ревьюером — закрывает «одно число, один источник» для счётчика Tests в STATUS.md |
| `static:ci-profiles` | PASS (генератор ≡ committed `validate-*.yml`) | адресный прогон ревьюером |
| `static:ci-registry-inventory` | PASS (нет дрейфа инвентаря) | адресный прогон ревьюером |
| `validate-gate` на точном материале (product) | GREEN, переиспользован | https://github.com/Matysh/houseplan-card/actions/runs/40240846533 |
| Полный `npm test`/browser/golden/performance/ночные мутанты | не прогонялся | класс A не менялся, visual/render риска нет, объём соразмерен диффу (§8); мутанты не гоняются в разработке (#709) |

Ручной подсчёт по регексу счётчика (`/^\s*(test|it)\(/gm`,
`scripts/status-counter-equivalence.mjs`) применительно к диффу: новых
совпадающих верхнеуровневых регистраций — 1 в `ci-proof.test.mjs` + 2 в
`task-check-reuse.test.mjs` (строка `})) test(...)` внутри `for`-цикла не
совпадает с `^\s*test\(`, поэтому не считается, хотя физически порождает 28
подтестов) + 3 в `task-check-source.test.mjs` + 0 в `task-check-workflow.test.mjs`
= 6, что ровно совпадает с диффом `STATUS.md` (5541→5547). Число одно, источник
один; подтверждено также зелёным `status-counter-equivalence.test.mjs`.

## Независимый разбор кода

- `retainedTaskCheck` (`scripts/task-check-reuse.mjs`): same-run (`record.run
  === proof.run.id`), same-sha, same-workflow, строго меньший `attempt`.
  Единая предикат-функция для producer (`stampRetainedTaskChecks`), consumer
  (`verifyTaskCheckClaim`) и merge-уровня (`taskCheckProblem` в
  `ci-proof.mjs`) — не продублирована инлайн нигде.
- `retainedExecution` (`scripts/task-check-reuse.mjs`): находит job по имени
  ровно один раз в исходном и текущем списках, требует `completed/success`,
  конечные упорядоченные `started_at/completed_at`, непустые шаги с
  уникальными номерами, корректными статусами/временными окнами, затем
  побайтовое совпадение (`sameRecord`) проекции исходного/текущего job без
  `id` (комментарий в коде прямо объясняет, почему именно это, а не
  равенство id, доказывает «не исполнялось повторно» — GitHub создаёт новый
  id для retained job). Три временных инварианта проверены построчно: job
  начался не раньше старта исходного рана (допуск 30 с), завершился до
  старта новой попытки, `record.created` лежит в окне исполнения job
  (+1 с). Негативные юнит-кейсы (`absentOriginal/absentClone/ambiguousClone/
  originalRed/cloneRed/cloneForeign{Sha,Run,Attempt}/absentStamps/absentSteps/
  changedSteps/failedStep/executedAgain/...` — 28 параметризованных отказов)
  независимо прогнаны и красны ровно на той мутации, которую называют;
  `executedAgain` (устанавливает `started_at` клона в момент старта новой
  попытки) корректно ловится через рассинхронизацию `before`/`after`
  проекций, а не отдельной проверкой «это не вторая попытка».
- `verifyTaskCheckClaim`: для retained-пути ослабляет только требование
  `run.conclusion === 'success'` у исходного `run` (unrelated failure
  исходного attempt не стирает success конкретного job — контракт п.7),
  сохраняя требование `completed` у него и `completed/success` у
  `retainedRun`, кроме одного явного исключения — `producing &&
  status === 'in_progress'` только для producer sealing (consumer эту
  поблажку не получает: отдельный тест
  `'#1067 only producer sealing may observe the still-running current proof
  job'` подтверждает оба направления). Блок retained-гейтов сверяет
  tree-эквивалентность (`consumerProof.candidate.tree === sourceSnapshot.tree`),
  совпадение `request`/`requiredProfiles` между исходным и текущим proof
  (закрывает AC5 — full/fresh waiver невозможен), и что `retainedRun`
  совпадает по identity-полям с независимо запрошенным `latestRun` — это
  именно то, что ловит «stale current attempt» (тест `newerAttempt`).
  Старый `claim.retained === undefined` (unannotated legacy passport) не
  даёт льготы — ветка `retained` вычисляется и проверяется по тем же
  правилам, аннотация лишь сверяется побайтово, если присутствует
  (`forgedPassport` тест).
- `stampRetainedTaskChecks` (`scripts/task-check-source.mjs`): вызывается в
  `ci-proof.mjs`/`ci-profile-proof.mjs` **до** `writeFileSync`; при любом
  отказе (`throw`) паспорт не публикуется — закрыто тестом
  `'retained source needs complete independent API evidence; producer
  refuses before publication'` (неполный job-inventory, красный клон,
  отсутствующий артефакт → `reject` до записи). Для обычных нерезервных
  claim функция рано возвращается без сетевых вызовов (`pending.length`
  пуст) — не добавляет retained-probe для обычного свежего receipt (контракт
  п.9).
- `taskCheckProblem` (`scripts/ci-proof.mjs`): для `mode=executed` с
  несовпадающим `attempt` требует независимо вычисленный `contexts.get(id)`
  с `accepted && retained`, побайтовым совпадением `verified.record` и
  `verified.target`/`proof.run`, и `record.attempt < proof.run.attempt`.
  Нет пути принять retained без этого контекста — подтверждено тестом в
  `ci-proof.test.mjs` (зелёный только после подстановки `taskCheckContexts`,
  красный при подмене `currentJobId` или смене `verified.target.attempt`).
  Перенос top-level `isMainModule(...)`-блока в `async function main()` с
  явным комментарием о дедлоке кругового импорта (`task-check-source.mjs`
  импортирует `readCiProofArtifact`/`JOB_RULES` обратно из `ci-proof.mjs`) —
  обоснован и подтверждён реальным temp-git CLI-тестом
  (`'actual proof producer CLI completes adapter loading before writing its
  passport'`), прочие импортёры `ci-proof.mjs` используют только именованные
  экспорты и не зависят от побочного эффекта топ-левел блока.
- `registryPublicationRecords` (`scripts/ci-registry-cli.mjs`): добавлено
  условие `record.run === proof.run?.id && record.attempt ===
  proof.run?.attempt` — retained-запись (старый `attempt`) исключена из
  `registry.produced`; негативный кейс в `task-check-workflow.test.mjs`
  (`proof.run.attempt = 3` после `registryPublicationRecords` с прежним
  `attempt=2` в записи) воспроизводит это и подтверждён зелёным прогоном.
- `GH_TOKEN` добавлен в три места, реально вызывающие `ci-proof.mjs --emit`/
  `ci-profile-proof.mjs` (`validate.yml`, `validate-product.yml`,
  `validate-tooling.yml`) и в генератор `ci-profiles.mjs`. Проверено, что
  `validate-product.yml`/`validate.yml` получают `GH_TOKEN` не отдельной
  правкой генератора, а автоматически — их блок «Собрать единый CI proof»
  переносится из канонического `validate.yml` текстовой заменой в
  `generatedProfiles()`, т.е. один источник правки распространяется в оба
  файла; `static:ci-profiles` подтверждает отсутствие дрейфа. `GH_TOKEN` для
  `validate-tooling.yml` (другой producer-путь через `ci-profile-proof.mjs`)
  добавлен отдельной строкой в генератор — тоже без дрейфа.
- `permissions: actions: read` на этих job'ах не менялись (уже существовали
  для фичи #1060 reused task-check) — новый сетевой вызов `stampRetainedTaskChecks`
  не требует новых прав.

Рискованных гипотез (реальное окружение vs фикстура, холодный/прогретый
producer, отмена/гонка, границы входов) отдельных пробелов не нашлось:
сетевые негативные случаи перечислены выше и закрыты параметризованными
тестами; исполнение producer CLI проверено реальным temp-git фикстуром, не
моком.

## Закрытие раунда r2

В дереве материала нет документа `docs/reviews/CODE-REVIEW-1067-r2.md`
(`docs/reviews/*1067*` возвращает только `-r1.md` для CODE и SPEC) — по
§2.10 отсутствие резолвящегося SHA/документа предыдущего раунда само по себе
не находка. Единственный резолвящийся предыдущий CODE-раунд —
`CODE-REVIEW-1067-r1.md` (материал `4a3d233c4ad8238c891d5aaf386290061f863232`,
жёлтый, `route: reclassify · criterion: undocumented`, High0/Medium0 по
корректности).

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| `route: reclassify/undocumented` — технический выбор между двумя стратегиями п.1 «Scope будущей задачи» не был зафиксирован ни в одном каноне до коммита | SPEC-REVIEW-1067-r1.md (зелёный, High0/Medium0) принял тело issue с явным «Выбрана одна стратегия: поддержать аутентифицированное сохранённое исполнение внутри того же run» и полным контрактом п.1–10, AC1–AC8 | `docs/reviews/SPEC-REVIEW-1067-r1.md` §«Находки» и §«Вердикт»; тело issue #1067 раздел «Контракт поведения»/«Критерии приёмки» в REVIEW_CONTEXT |

## Унаследовано из r2

Раунда r2 как отдельного документа не существует (см. выше) — наследовать
не из чего. Единственное, что принято без повторного независимого
исполнения в этом раунде, — эмпирическая проверка премисы «GitHub выдаёт
новый job id сохранённому job, сохраняя `started_at/completed_at`», которую
CODE-REVIEW-1067-r1.md подтвердил живыми вызовами `gh api
.../runs/40163270549/attempts/{1,2}/jobs` на подлинных данных исходного
инцидента (job `121079146039` → `121086744650`). У этого ревью нет
инструмента произвольных вызовов GitHub API, поэтому вызов не повторён;
вместо этого корректность самого кода, реализующего эту премису
(`retainedExecution`/`projection`), проверена построчным чтением и
прогоном параметризованных негативных юнит-тестов на синтетических
фикстурах (см. «Независимый разбор кода» выше) — обе проверки независимы и
дополняют друг друга, а не заменяют одна другую.

## Находки

High: 0. Medium: 0.

Low (не блокирует, записано и снимается ревьюером): `docs/development-notes/
retained-proof-review-comments.json` — сырой дамп 1885 строк GitHub API
(полные объекты пользователей/bot-приложений с avatar/GraphQL node_id/
permissions/events), закоммиченный как «C-доказательство для ревью». Это
расширяющийся при каждом раунде баланс (уже два коммита `docs(ci):
preserve/refresh bounded review context` поверх него) без продуктовой
ценности сверх уже доступного через GitHub API; риска для корректности или
доверительного контракта это не несёт (сам файл явно помечен
`contextOnly: true, verdictAuthority: false`), поэтому не поднимаю до
Medium — отмечаю для будущей уборки, не для этого цикла.

## Побочные находки

Доверенный снимок политики: `mode=issues` (issue #1067, stage=code,
round=3). Побочных находок вне скоупа диффа нет: весь дифф относится к
одной подсистеме (task-check/ci-proof паспорт) плюс её собственная
документация ревью; `outside_findings` пуст.

## Что проверено и корректно

- Независимая цепочка producer→consumer→merge-уровень (`taskCheckProblem`)
  для retained-receipt не имеет пути принять неподтверждённый claim, включая
  старый unannotated passport.
- `stampRetainedTaskChecks` отказывает до публикации паспорта на любой
  неподтверждённый retained job; порядок вызовов (`await` до
  `writeFileSync`) в обоих producer-путях (`ci-proof.mjs`,
  `ci-profile-proof.mjs`) корректен.
- `registryPublicationRecords` исключает retained-записи из
  `registry.produced` — соответствует инварианту, зафиксированному в
  `docs/DEVELOPMENT.md`/`docs/STATUS.md` этим же коммитом (AC6).
- Full/fresh waiver невозможен: совпадение `request`/`requiredProfiles`
  между исходным и текущим proof проверяется явно (AC5), reused/partial
  источник для retained исключён (`inheritedSource`-тест).
  AC4 (unrelated overall failure не стирает job-success, in-progress — только
  для producer sealing) и AC3 (полный перечень отклоняемых случаев:
  абсент/неоднозначный job, чужой SHA/run/workflow/repo/attempt/scope/
  recipe/runtime, red job/step, forged passport, просроченный артефакт)
  закрыты параметризованными негативными юнит-тестами, каждый из которых
  независимо прогнан и красен ровно на названной мутации.
- `GH_TOKEN` добавлен везде, где он реально нужен (три вызывающих
  `--emit` места плюс генератор), и нигде лишнего (`validate-docs.yml` не
  тронут — он не вызывает `--emit`).
- Генератор `ci-profiles.mjs` и `ci-registry-inventory.json` не разошлись с
  закоммиченными файлами (`static:ci-profiles`, `static:ci-registry-inventory`
  зелёные).
- Счётчик `Tests` в `STATUS.md` (5541→5547) имеет один источник и
  подтверждён как регексом вручную, так и зелёным
  `status-counter-equivalence.test.mjs`.
- `docs/release-ledger/v1.82.0/1067.json`: `category: "infra"`, без
  `introducedBy`, RU/EN summary — согласовано с `User-Visible: no` из тела
  issue; `CHANGELOG.md` не тронут, что и требуется при `User-Visible: no`.
- Трейлеры `Issue:#1067`/`User-Visible:no` на коммите `fix(ci): authenticate
  retained same-run task execution` подтверждены для функционально того же
  сообщения в CODE-REVIEW-1067-r1.md (материал с идентичной B/C-логикой,
  подтверждённой этим раундом построчно); остальные 4 коммита диапазона —
  чистый класс C (docs-only), трейлерное правило на них не распространяется.

## Чего не проверял

- Полный `npm test`/`gate:small`/browser/golden/performance/`pytest
  tests_backend` — не запускал; класс A не менялся, Python не затронут,
  visual/render риска нет, объём соразмерен диффу (§8).
- Ночной прогон реестра мутантов (`ci:mutants`) — не гоняется ни на одном
  треке в разработке (#709); предъявленные негативные кейсы — обычные
  negative-input на неизменённой реализации, не мутанты, и мутанты в этом
  ревью не исполнялись.
- Полные тексты 5 коммитов диапазона с трейлерами не перечитывал напрямую
  инструментом (доступные `read:log`/`read:diff` отдают `--oneline` и
  squashed diff, не per-commit `git show`); для коммита класса B принято
  построчно подтверждённое ранее значение трейлеров (см. выше), для 4
  docs-only коммитов трейлер не обязателен.
- Живой вызов GitHub API для повторной эмпирической проверки премисы
  renaming job id/run_attempt на исходном инциденте — не повторял (нет
  инструмента произвольных вызовов API в этом ревью); принято как
  диагностический контекст из CODE-REVIEW-1067-r1.md, код, который эту
  премису реализует, проверен независимо построчно и тестами.
- Сценарий «два retained job одновременно в одном паспорте» (и tooling, и
  browser_selected retained в одном run) — тесты покрывают каждый job по
  отдельности (`['{}', 'browser_selected'], ['{}', 'tooling']` и т.д.), но
  не комбинацию обоих сразу в одном паспорте; не является отдельным AC и не
  блокирует вердикт, т.к. код обрабатывает `taskChecks` по ключам
  независимо (`Object.entries`/`.filter`) без общего состояния между job.

## Маршрут

`route: fix`. Вердикт зелёный, AC1–AC8 закрыты кодом и тестами, трек `ask`
не меняется, CODE-бюджет (`блокирующих циклов`) не увеличивается зелёным
вердиктом (§4).

## Вердикт

Вердикт: зелёный · заход r3 · блокирующих циклов 1/4 · High: 0 · Medium: 0 → в задаче

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjQ1ZDhlNDNhOTNjYjczMTM1NWIxYzU5NDE5ODdlYmQ4YTNkN2FhNzY0MzcyNzhmZjdhNjViOWJkMzA0YjhlNmYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJmMjY5NTE5OWM3YWNlOWVjMDNmOTE5YjRmOTc4Mzk4OTkzYmQwOTA1OWRlZjA4YjZiOTk0MzU2NWZiNGFkOTViIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDY3LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MywibWF0ZXJpYWwiOiIxZDJkYWRjMDNmZTllOGQ2MGRjZTY5YWVjMDMxMWU5MmIxOWZlOWUxIiwidHJlZSI6ImFjZjU0MjA5YzgwMWYzMDM1N2JkMzg2MTliN2YxNzcwOTcxMDRkZjkiLCJib2R5RGlnZXN0IjoiYmU1MGY0NDVkOTgyZTI2MzEwODJlMjJmYTI1Yzc5Yzk0YzBkNWIzMGViOWY4MDA5YTcwMzM0Y2IwNGUyNDk3MCIsInByb2R1Y2VyUnVuIjoiNDAyNDEzNTEyMTQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6ImY0YTVjZTlhNWYyMDVkYTMzNDljZjE5MmRiYTk1ZWY0YWRlMzRjZDJiMGNmYjZhMjE5ODE5YWU3MmNkODUxM2YiLCJ2ZXJkaWN0RGlnZXN0IjoiMTYwNzc3MDQ3NTU0MDc1NDM1MzZlYmJiZmQ5MWE1OTNiZjEyNmFkM2ZmMzllNTY4NTA3NWIxZDM2YjE2OWNhZCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiIxYzU0ZjY4YmZlYjdiNGFjOTIzN2Q0OTQ1M2VjNWVmZWQ5YmI3OGJkMjA5YmZiZDYzNmEwZTNiM2ZmYTM2OGVhIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDA0NTcwMjQ2LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDY3I2lzc3VlY29tbWVudC02NDA0NTcwMjQ2IiwiYm9keURpZ2VzdCI6ImNmZGI3ODkwZjJhYzRjNTYyYzQ0YzcyM2M0ZTUyYWM2YTJlOGQ0YTJjY2RlMzAyNzMwYzAwNDk2MjU0Nzk1YjcifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1067-retained-job-proof`, коммит `1d2dadc03fe9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `acf54209c801f30357bd38619b7f177097104df9`
  ```
  git log --all --format='%H %T' | grep acf54209c801
  ```
- Тело issue: `be50f445d982e2631082e22fa25c79c94c0d5b30eb9f8009a70334cb04e24970`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40241351214,"run_attempt":1,"digest":"ec684a50f452cff02805e0103b17a4362623d418a8da7b1731aaff3a4a523a8f"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6ODYsIm91dHB1dF90b2tlbnMiOjYwNDY0LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIxMTg0NywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjU4ODExNTcsImNvc3RVc2RFc3RpbWF0ZSI6Mi42Mjg0MzE0fV0sInR1cm5zIjo1NSwiZHVyYXRpb25NcyI6Nzg5NjczLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6Mi42Mjg0MzE0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=86 output_tokens=60464 cache_creation_input_tokens=211847 cache_read_input_tokens=5881157 num_turns=55 -->
