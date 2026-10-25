# CODE-REVIEW-1069-r1

Issue: #1069 · Трек: show · Этап: code · Заход r1 · Материал:
`15decc62efef83d07fc0f5cbe42e32b98f01aee3` (HEAD, `origin/dev..HEAD` = 1 коммит).

## Скоуп

Единственный коммит `fix(test): isolate night-red temporary Git lifecycle`
(`Issue: #1069`, `User-Visible: no`) — класс B/C, инфраструктура:

- `test/night-red.test.mjs` — изоляция временного Git-окружения
  night-red-фикстур и ограниченная (bounded) очистка после хуков.
- `docs/DEVELOPMENT.md` — новый абзац «Local repository maintenance (#628)»
  по образцу уже принятых #925/#969.
- `docs/STATUS.md` — обновлён счётчик Node unit (5433 → 5436) и абзац
  «Current cycle and standing decisions».
- `docs/release-ledger/v1.82.0/1069.json` — `category: infra`, без milestone.
- `scripts/ci-registry-inventory.json` — ссылка на новый release-ledger файл
  (генерируемый).

Задача помечена `infra`, в `S7-code-review` без прохождения spec/S1–S6
(AGENTS.md «An infrastructure task… skips analysis and spec»). Production
`scripts/night-red.mjs` не тронут; продуктовый код (`src/**`,
`custom_components/**`) не задет — строка `docs/SCOPE.md` не применима
напрямую, задача обслуживает инфраструктуру CI, а не Core user job.

## Маршрут (track show, §5, #726)

Проверка критериев:

| Критерий | Оценка |
|---|---|
| complexity | низкая: один test-файл + документация, без новой логики продукта |
| surfaces | одна поверхность — жизненный цикл временных Git-фикстур в одном test-модуле |
| migration | нет миграции конфига/новых compatibility-полей |
| ux-contract | нет UX-контракта, тест CI не виден пользователю |
| perf-touch | не затрагивает производительность или touch |
| undocumented | поведение зафиксировано в новом абзаце `docs/DEVELOPMENT.md` по образцу #925/#969 |

Все критерии пройдены → `route: fix`.

## Как проверялось

Независимый разбор: сначала прочитан полный `test/night-red.test.mjs`
(исходная история до диффа — что осталось неизменным — и новые хунки),
`scripts/night-red.mjs` (`gitClient`/`runGit` — `spawnSync('git', …, { cwd })`
без своего `env`, то есть реально использует ambient `process.env` процесса;
это и есть «production Git reads», которые новый код обязан изолировать),
`scripts/workflow-jobs.mjs` (`validateJobs()` — только `readFileSync`, Git не
трогает, порядок вызова после модульной инициализации `ENV` не важен).

Прослежены вызывающие пути и побочные эффекты:

- Удаление `GIT_*` на `process.env` самого test-воркера (не только в локальной
  копии `ENV` для `execFileSync`) + `Object.assign(process.env, ENV)` —
  действует на весь процесс этого test-файла. `node --test` по умолчанию на
  Node 22 изолирует файлы по процессам (`v22.23.3`, см. `.nvmrc`), поэтому
  мутация не протекает в соседние test-файлы при `npm test`; проверено также
  тем, что полный тулинг-прогон (ниже, review-light proof) не показал
  побочных эффектов в других файлах.
- Регэксп `/^GIT_/i` не трогает `GITHUB_*` (четвёртый символ `H`, не `_`),
  то есть `GITHUB_STEP_SUMMARY`/`GITHUB_API_URL`, используемые в том же файле
  для подмены Actions/`gh`, не задеты — прочитано и проверено исполнением.
- Все точки создания временного репозитория идут через новый
  `initFixtureGit()` (`history()` и assertion-failure тест) — ни один фикстурный
  репозиторий не остался без `maintenance.auto=false`/`gc.auto=0`/
  `receive.autogc=false`.
- Все `mkdtempSync` фикстуры теперь закрыты либо `temporaryTree()`, либо прямым
  `rmSync(…, REMOVE_FIXTURE_TREE)` — старый безретрайный путь
  `rmSync(x, { recursive: true, force: true })` без `maxRetries` полностью
  заменён в этом же коммите, не оставлен параллельно (§7.2 «что удалено взамен
  добавленного»): `grep -n "rmSync(" test/night-red.test.mjs` даёт два
  вхождения, оба на `REMOVE_FIXTURE_TREE`.
- `t.after` в `temporaryTree()` не оборачивает `rmSync` в `try/catch` — чтение
  кода подтверждает: исчерпание 10 ретраев всё ещё бросает и проваливает тест
  (политика «не трактовать ошибку cleanup как успех» выполнена статически).

Гипотезы риска: реальное окружение vs фикстура (унаследованные `GIT_*` от
родителя, включая чужой `GIT_CONFIG_GLOBAL`), холодный процесс (мутация на
модульном уровне, до первого теста) — обе покрыты тестом 2 и проверены
исполнением ниже; отмена/гонки самого ENOTEMPTY — явно вне границ issue
(«не заявлять воспроизведение… без свидетельств»), только усилено retry +
отключением auto-maintenance, не формально доказано как устраняющее причину
(и это не заявляется автором).

### Исполненные проверки

| Проверка | Команда | Результат |
|---|---|---|
| Validate (review-light) на точном материале | `gh run view 40178802258` | `headSha=15decc62e…`, `conclusion=success`; job «Инструменты: вычисляемый набор юнитов» и «Фронтенд: типы, юниты, мутанты» — success; backend/HA/golden/perf/browser — skipped (ожидаемо для test-only диффа без Python/geometry/visual) |
| Адресный повтор изменённого файла | `node --test test/night-red.test.mjs` | 14 PASS / 0 FAIL (совпадает с заявленным автором) |
| Генератор инвентаря registry не устарел | `node scripts/ci-registry-inventory.mjs` (check-режим) | exit 0, без диффа — файл не правился руками |
| Пересчёт счётчиков STATUS | `node scripts/inventory.mjs` | Node unit 5436 — совпадает с зафиксированным в `docs/STATUS.md`; три остальных счётчика не изменились (653/555/443) |
| Процесс-гейт диапазона | `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` | PASS, единственное предупреждение — ожидаемое «инфраструктурный диапазон (#562), статусная метка не требуется до S7» |
| Типы тестового кода | `npx tsc -p tsconfig.test.json` | без ошибок |
| Release-ledger читается | `node scripts/release-ledger.mjs catalogue --candidate=HEAD --issue=1069` | выполняется без ошибки схемы |

### Не прогонялось (и почему)

- `npm run gate:small` / полный `npm test` / `pytest tests_backend` /
  HA-harness / browser smokes / golden / `npm run invariants` / performance —
  дифф не трогает `src/**`, Python, геометрию, визуал или touch; эти гейты
  уже честно `skipped` в самом Validate-прогоне материала (review-light), а
  полные наборы — предрелизный, не ревью-гейт (§8).
- Мутанты по диффу/registry execution — не прогонялись ни CI (shard
  «Мутанты по диффу» в этом прогоне `skipped`, как и для прочих `track:show`
  в разработке — ночной прогон реестра отдельным workflow), ни мной: ручное
  исполнение мутанта/гарда вне ночного workflow запрещено ревьюеру (#905)
  независимо от отсутствия registry CLI.
- Воспроизведение исторической гонки `ENOTEMPTY` — не предпринималось: сама
  задача прямо запрещает заявлять воспроизведение без свидетельств; «чем
  краснеет» для bounded-cleanup дано чтением (нет `catch` вокруг `rmSync` в
  `t.after`), это разрешённая форма доказательства для защитного AC без
  соразмерного детерминированного oracle.

## Находки

Высоких и Medium-находок нет.

Low (снято ревьюером без действия автора): `delete childEnv.NODE_TEST_CONTEXT;`
(`test/night-red.test.mjs:122`) не сопровождается комментарием, почему это
необходимо для чистого TAP-вывода вложенного `node --test`. Последствие
ограничено читаемостью теста 2 для будущего правщика; поведение подтверждено
исполнением (результат `status: 0` и совпадение regexp по TAP-строке в самом
тесте), мутанта/регресса это не создаёт — снимаю без цикла.

## Что проверено и корректно

- Изоляция окружения: тест «#1069 inherited Git variables cannot redirect…»
  — реальный дочерний `node --test` процесс с подменёнными
  `GIT_DIR`/`GIT_WORK_TREE`/`GIT_COMMON_DIR`/`GIT_INDEX_FILE` на
  несуществующие пути и чужим `GIT_CONFIG_GLOBAL` (`maintenance.auto=true`)
  — обычный отрицательный вход на неизменной реализации, выполнен, зелёный;
  по чтению кода без модульной зачистки `GIT_*` (строка 31) эти значения
  достигли бы `git init`/`git commit` в фикстуре и сломали бы их либо включили
  чужой auto-maintenance — это и есть «чем краснеет» для данного защитного
  поведения.
- Локальный конфиг фикстур: тест 1 читает `git config --local --get` по
  каждому ключу `FIXTURE_GIT_CONFIG` — без `initFixtureGit()` это упало бы
  (ненулевой код git config --get на отсутствующий ключ).
- Завершённая очистка не глотает отказ: тест 3 — ordinary `AssertionError`
  проходит через `finally { rmSync(…) }» с сохранением identity объекта
  исключения, каталог удалён.
- Существующие защищённые AC (#736, #751, #766 — доставка по настоящему
  bash/HTTP, ошибка API/упавший скрипт, нестандартный `GITHUB_SERVER_URL`)
  не переписаны, только их `mkdtempSync/rmSync` обёрнуты в общий хелпер;
  логика и ассерты побайтово те же.
- `docs/STATUS.md`/`ci-registry-inventory.json`/`inventory.mjs` — одно число
  (5436), один источник, пересчитанный генератором и совпадающий с
  зафиксированным.
- `release-ledger/v1.82.0/1069.json`: `category: infra`, без milestone —
  соответствует прецедентам (#1068, #1064), `introducedBy` не требуется для
  infra вне внутри-бетного line-fix.
- Трейлеры коммита: `Issue: #1069`, `User-Visible: no`; CHANGELOG не тронут —
  согласовано, видимого пользователю поведения нет.

## Чего не проверял

- Истинную причину исторического `ENOTEMPTY` — не установлена и не
  заявляется автором; вне границ issue.
- Полный ночной прогон registry/мутантов для этого диапазона — не входит в
  ревью-гейт track show при отсутствии изменений в проверяемом продуктовом
  пути.
- Поведение на Windows (автор привёл отдельный локальный прогон); не
  переисполнялось — нет доступной Windows-среды в ревью, Linux review-light
  proof и мой адресный Linux-прогон достаточны для заявленных на этом треке
  проверок.

## Побочные находки

`REVIEW_FINDINGS_POLICY`: `mode=issues`, `round=1` — совпадает с встроенным
доверенным снимком. Побочных находок вне скоупа задачи нет — новых issue не
заводится.

## Вердикт

Зелёный. High: 0, Medium: 0, Low: 1 (снят без цикла). `route: fix` — все
критерии §5 трека show пройдены.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1069-night-red-temp-git-lifecycle`, коммит `15decc62efef` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `553eb81d1fdd62fbf8b46662edadf41e9c47ec2e`
  ```
  git log --all --format='%H %T' | grep 553eb81d1fdd
  ```
- Тело issue: `d3079164b7efb005f38fa9ef432b8dc99f12ea483961b2913e16fcf4551a2866`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40179240880,"run_attempt":1,"digest":"4106bb2a914bb5c0e9dbf33a52ae36f2126cff59412761c05dfb0d8617c67af3"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyMzcsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzEyMDAwMDAwMDAwMDAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo3OCwib3V0cHV0X3Rva2VucyI6MzczMjksImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTA2MDczLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6MzM2NzEwNCwiY29zdFVzZEVzdGltYXRlIjoxLjQ3MTE1ODgwMDAwMDAwMDJ9XSwidHVybnMiOjQzLCJkdXJhdGlvbk1zIjo0ODgzNjcsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjQ3NjQ3MDgwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5315 output_tokens=37344 cache_creation_input_tokens=106073 cache_read_input_tokens=3367104 num_turns=43 -->
