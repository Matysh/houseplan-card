# CODE-REVIEW-1067-r1

Материал: `4a3d233c4ad8238c891d5aaf386290061f863232` (tree `afdd5831692a95a53b96349ad7266848220d8224`),
`git log --oneline origin/dev..HEAD` — один коммит
`fix(ci): authenticate retained same-run task execution` (`Issue: #1067`, `User-Visible: no`).
Трек: `show` (метка владельца отсутствует; инфраструктурная задача §1 без трековой
метки читается как `track:show`, AGENTS.md/PROCESS.md §5.1). Этап: `code`.
Заход r1, блокирующих циклов 0/2.

## Скоуп

Диапазон `origin/dev...HEAD` — 18 файлов, только классы **B** (`scripts/**`,
`test/**`, `.github/workflows/**`) и **C** (`docs/**`, `docs/release-ledger/**`).
Класс A (`src/**`) не затронут — классы риска по участкам (`geometry/touch/
migration/devices/perf/ux/visual`) не вычисляются, они определены только для
диффа класса A.

Задача чинит реальный инцидент: после частичного GitHub rerun
(`Full Validate 40163270549`, кандидат `ef4eac9c`) оба канонических consumer'а
(`release:check`, `release:prepare`) корректно отказали с
`tooling: foreign direct task receipt` — паспорт producer сохранил успешный
`tooling`-receipt из attempt 1, а consumer (`scripts/ci-proof.mjs:304–310` на
момент issue) требовал точного совпадения `attempt`. Коммит вводит
аутентифицированную схему «retained execution»: producer и consumer независимо
подтверждают, что job с тем же именем в старой и новой попытке — одно и то же
исполнение (а не повторный запуск), через внешние вызовы GitHub API
(`/attempts/<N>/jobs`) и побайтовое сравнение исполнения/шагов, не доверяя
общему `conclusion` рана.

## Как проверялось

| Гейт | Статус | Где видно |
|---|---|---|
| Классификация изменённых файлов / риск по участкам класса A | не применим (класс A не менялся) | `git diff --stat origin/dev...HEAD` |
| `validate-gate` на точном материале `4a3d233c4` | PASS (переиспользован, см. ниже) | https://github.com/Matysh/houseplan-card/actions/runs/40180995257 |
| Адресный прогон 4 изменённых suites (`ci-proof.test.mjs`, `task-check-reuse.test.mjs`, `task-check-source.test.mjs`, `task-check-workflow.test.mjs`) | PASS, 107/107 | независимый перезапуск ревьюером, `node --test …`, 7.56 с |
| `status-counter-equivalence.test.mjs` (адресно — диф меняет счётчик Tests в STATUS.md) | PASS, 8/8 (1 skip не по теме — отсутствующий force-push fixture) | независимый перезапуск ревьюером |
| `ci-profiles.test.mjs` (генератор vs committed `validate-tooling.yml`, т.к. в обоих местах добавлен `GH_TOKEN`) | PASS, 13/13 | независимый перезапуск ревьюером |
| Эмпирическая проверка премисы «GitHub выдаёт новый job id сохранённому job» | подтверждено на реальных данных исходного инцидента | `gh api .../runs/40163270549/attempts/1/jobs` vs `.../attempts/2/jobs`: job «Инструменты: вычисляемый набор юнитов» — id `121079146039` (attempt 1) vs `121086744650` (attempt 2), идентичные `started_at`/`completed_at`/`conclusion`; `run_attempt` в ответе API равен номеру запрошенной попытки, а не исходной — ровно это поведение кодирует `retainedExecution`/`projection` |
| Трейлеры `Issue:`/`User-Visible:` | OK | `git log`: `Issue: #1067`, `User-Visible: no`; CHANGELOG не тронут — согласовано |
| `docs/release-ledger/v1.82.0/1067.json` (category/rationale) | OK | `category: "infra"`, без `introducedBy` — консистентно с соседним `1068.json`, не внутрибетный поведенческий фикс продукта |
| Полный `npm test`/`gate:small`/browser/golden/performance | не прогонялся — не требуется объёмом задачи (§8); `validate-gate` уже покрыл Инструменты/Фронтенд-юниты/Hassfest/HACS/Бэкенд pytest/Упаковку/Продукт на этом SHA, browser/golden/perf jobs в нём пропущены как не относящиеся к изменению (нет visual/render риска, класс A не менялся) | run 40180995257 job list |

Полные наборы (ночной registry mutants, release-прогоны) — предрелизный/ночной
гейт, не гейт этого ревью (§8, AGENTS.md).

## Независимый разбор кода

- `taskCheckProblem` (`scripts/ci-proof.mjs:288-318`): для `mode=executed` с
  несовпадающим `attempt` требует контекст `verified` с `accepted && retained`,
  побайтовым совпадением `verified.record`/`claim.record` и
  `verified.target`/`proof.run`, и `claim.record.attempt < proof.run.attempt`.
  Прочитано и проверено построчно — обратного пути (принять retained без
  независимой проверки) нет.
- `retainedTaskCheck` (`scripts/task-check-reuse.mjs:136-142`): same-run,
  same-sha, same-workflow, строго меньший attempt. Используется и producer'ом
  (`stampRetainedTaskChecks`), и consumer'ом (`verifyTaskCheckClaim`,
  `taskCheckProblem` через явную проверку) — одна и та же предикат-функция,
  не продублированный инлайн.
- `retainedExecution` (`scripts/task-check-reuse.mjs:144-183`): находит job по
  имени в исходном и текущем списках (ровно один), требует `completed/success`,
  конечные и упорядоченные `started_at/completed_at`, непустые шаги с
  уникальными номерами и совместимыми статусами/окнами времени, затем требует
  **побайтового совпадения** (`sameRecord`) проекции исходного и текущего job
  без `id`, плюс три временных инварианта: job начался не раньше старта
  исходного рана (окно 30 с), job завершился до старта новой попытки, и
  `record.created` (штамп паспорта) лежит внутри окна исполнения job.
  Независимая сверка через `gh api` на реальных данных исходного инцидента
  (таблица выше) подтвердила, что это ровно то поведение GitHub, под которое
  писалась проверка, включая смену `id` и `run_attempt` у несработавшего
  повторно job.
- `stampRetainedTaskChecks` (`scripts/task-check-source.mjs`): вызывается в
  `ci-proof.mjs`/`ci-profile-proof.mjs` **до** `writeFileSync` паспорта —
  при любом отказе (`throw`) паспорт не публикуется, что проверено на отказах
  (`test/task-check-source.test.mjs`: неполный job-inventory, красный клон,
  отсутствующий артефакт — каждый приводит к `reject` до публикации).
- Перенос `isMainModule(...)`-блока в `async function main()` с
  `main().catch(...)` вместо прежнего топ-левел блока: обоснованно комментарием
  и корректно — `task-check-source.mjs` импортирует обратно из `ci-proof.mjs`
  (`readCiProofArtifact`, `JOB_RULES`), топ-левел `await` внутри этого же
  модуля дедлокнул бы круговой импорт; вынесение в `main()` без `await` на
  module scope даёт модулю `ci-proof.mjs` закончить инициализацию прежде, чем
  динамический `import('./task-check-source.mjs')` вернётся. Прочие импортёры
  `ci-proof.mjs` (`release-gate.mjs`, `night-red.mjs`,
  `workflow-continuation.mjs`, …) используют только именованные экспорты и не
  зависят от побочного эффекта топ-левел блока — поведение не изменилось.
- `registryPublicationRecords` (`scripts/ci-registry-cli.mjs`): добавлено
  условие `record.run === proof.run?.id && record.attempt === proof.run?.attempt`
  — не даёт retained-записи (старый attempt) попасть в
  `registry.produced`-список, соответствует зафиксированному в
  `docs/DEVELOPMENT.md`/`docs/STATUS.md` инварианту «retention не создаёт
  нового registry producer»; негативный кейс в
  `test/task-check-workflow.test.mjs` воспроизводит ровно это и красен без
  патча (обычный negative-input case, не мутант).
- `GH_TOKEN` добавлен во все три места, реально вызывающие
  `ci-proof.mjs --emit`/`ci-profile-proof.mjs` (`validate.yml`,
  `validate-product.yml`, `validate-tooling.yml`) и в генератор
  `scripts/ci-profiles.mjs`, который производит текст тулинг-профиля;
  `validate-docs.yml` только публикует существующий артефакт и `--emit` не
  вызывает — токен там не нужен. Проверено `grep` по всем workflow.
- Счётчик `Node unit` в `docs/STATUS.md` (5433→5439) соответствует ровно 6
  новым верхнеуровневым `test(...)`/`)) test(...)`-регистрациям в диффе
  (статический подсчёт, которым и живёт `status-counter-equivalence.mjs`);
  число одно и с одним источником (§8), пересчёт подтверждён отдельным
  прогоном его теста.

Рискованных гипотез (реальное окружение vs фикстура, холодный/прогретый
producer, отмена/гонка) не нашлось отдельных пробелов: сетевые негативные
случаи (неполный job inventory, просроченный артефакт, чужой SHA/run/workflow/
repo/attempt, красный job/шаг, forged `claim.retained`, in-progress для
`producing=false`) явно закрыты в `test/task-check-reuse.test.mjs` (25
параметризованных отказов) и `test/task-check-source.test.mjs`; исполнение
producer CLI проверено реальным temp-git фикстуром, не моком (
`'#1067 actual proof producer CLI completes adapter loading before writing its passport'`).

## Находка

**route: reclassify · criterion: undocumented.**

Тело issue #1067 в разделе «Scope будущей задачи» прямо оставляет техническое
решение открытым: пункт 1 предлагает **на выбор** одну из двух принципиально
разных стратегий («проверяемое представление настоящего источника attempt/job»
**либо** «ранний точный отказ до внешнего GitHub green»), а пункт 3 заявляет
буквально: «Конкретное техническое решение определить при взятии задачи».
Ни `docs/USER-GUIDE.ru.md`, ни канонический документ подсистемы (на момент
взятия задачи — ни в `docs/ARCHITECTURE.md`, ни в `docs/DEVELOPMENT.md` не было
ни строки о retained-receipt, они добавлены этим же коммитом) не фиксировали
ожидаемое поведение заранее. Это ровно случай, который подсказка §5
исключает из `show`: «ожидаемое поведение уже зафиксировано… решать нечего» —
здесь решать было что, и решение (какую из двух стратегий выбрать, какой новый
контракт паспорта ввести, как аутентифицировать клонированный job) было
принято в процессе кодирования, без ревью ТЗ.

Практический вес решения: коммит вводит новое поле паспорта (`claim.retained`),
новый алгоритм межпопыточной аутентификации job/шагов по меткам времени и
дайджесту, три новых обращения к GitHub API и доверительные допуски (окна
30 с/1 с) — это новый контракт релизного доверительного механизма
(`release:check`/`release:prepare`/merge gate), а не локальная полировка в
рамках уже описанного поведения. Независимая проверка (раздел выше) не нашла
в этой логике дефектов и подтвердила её соответствие реальному поведению
GitHub API — вопрос не в корректности кода, а в том, что решение по новому
доверительному контракту принято без места, где оно проверяется до написания
кода (§5: «Если по ходу выясняется, что решать есть что, трек повышается до
`ask`»).

Это не классическая находка High/Medium по корректности/AC — High: 0,
Medium: 0. Код, тесты и документация внутренне согласованы и прошли адресную
проверку; возврат — по треку, не по дефекту.

## Побочные находки

Доверенный снимок политики: `mode=issues` (issue #1067, round 1). Побочных
находок вне скоупа диффа не обнаружено — весь дифф относится к одной
подсистеме (task-check/ci-proof паспорт), новых issue не заводилось.

## Что проверено и корректно

- Независимая цепочка producer→consumer для retained-receipt: нет пути принять
  неподтверждённый retained claim (ни по `taskCheckProblem`, ни по
  `verifyTaskCheckClaim`).
- `stampRetainedTaskChecks` отказывает до публикации паспорта на любой
  неподтверждённый retained job — порядок вызовов в `ci-proof.mjs` и
  `ci-profile-proof.mjs` корректен (`await` до `writeFileSync`).
- `registryPublicationRecords` не пропускает retained-записи в publication
  registry — закрывает ровно инвариант, зафиксированный в документации этим
  же коммитом.
- `GH_TOKEN` добавлен везде, где он реально нужен, и нигде лишнего.
- Трейлеры, release-ledger, обновление счётчика STATUS — корректны и
  единообразны с соседними infra-задачами (`1068.json`).
- Эмпирическая премиса механизма (смена job id и `run_attempt` у retained job)
  подтверждена на подлинных данных исходного инцидента через `gh api`, а не
  принята на веру.

## Чего не проверял

- Полный `npm test`, `gate:small`, browser/golden/performance наборы — не
  запускал; не относится к объёму этой правки (класс A не менялся, нет
  visual/render риска), покрыто переиспользованным `validate-gate`
  (run 40180995257).
- Ночной прогон реестра мутантов (`ci:mutants`) — не относится к ревью на
  `show`, его не гоняют ни на одном треке в разработке (§709/AGENTS.md); на
  предъявленные контракт-кейсы это не требуется — они обычные negative-input,
  не мутанты.
- Поведение на реальном «in-flight» partial rerun с несколькими одновременно
  сохранёнными job (несколько retained job сразу) — покрыто по одному job за
  раз в тестах; отдельного сценария «два retained job в одном паспорте» не
  нашёл и не проверял отдельно (не является AC issue, не блокирует вердикт).

## Маршрут

`route: reclassify`, `criterion: undocumented`. Вердикт не зелёный; код
остаётся в ветке `issue/1067-retained-job-proof`, бюджет код-ревью (`show`,
лимит 2) не обнуляется. Решение по вердикту переводит задачу в `track:ask` и
`S3-spec` — полное ТЗ пишется в теле issue по §7.1, со строкой «что уже
реализовано» для независимого сопоставления при следующем ревью.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1067-retained-job-proof`, коммит `4a3d233c4ad8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `afdd5831692a95a53b96349ad7266848220d8224`
  ```
  git log --all --format='%H %T' | grep afdd5831692a
  ```
- Тело issue: `9eaf192948aaa1194165bade3ca52dd3bba66847cb5cbffbdc243c08e118ba8d`
- Вердикт конвейера: `yellow` · High 0 · маршрут `reclassify` (критерий `undocumented`)
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNDMsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjE4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxMDAsIm91dHB1dF90b2tlbnMiOjM1NzQyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyMjM0NiwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjUwODQ0NTcsImNvc3RVc2RFc3RpbWF0ZSI6MS44NjM4OTUzOTk5OTk5OTk5fV0sInR1cm5zIjo1MiwiZHVyYXRpb25NcyI6NDc0OTk2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS44NjkxMTM0LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=5243 output_tokens=35757 cache_creation_input_tokens=122346 cache_read_input_tokens=5084457 num_turns=52 -->
