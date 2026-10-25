# CODE-REVIEW-1065-r2

Issue: #1065 · этап: code · трек: show · заход: r2 · материал: `258d599029eb77615a2ae18e4bd9e8eda32eedb3`
(рабочая копия на этом SHA; `git fetch/pull/checkout` на другой коммит не выполнялись)

## Скоуп

Дельта к r1 (`16bb4695e4b55fd35ea77491250048ed7d5d565d` → `258d59902`), помимо
двух мерджей без ручного разрешения конфликтов (`069f56fa6` — публикация
`docs/reviews/CODE-REVIEW-1065-r1.md`; `258d59902` — принятый `origin/dev`
с #1074, уже входит в `origin/dev` и не влияет на диапазон
`origin/dev...HEAD`), — ровно два новых коммита:

- `49b711086` fix(process): restrict every sed read operand — закрывает
  единственный High из r1.
- `ce706c8ff` fix(process): refuse dangerous Git option abbreviations —
  самостоятельно найденная автором ambiguous-prefix дыра в той же
  Bash-политике, обнаруженная при работе над первым фиксом.

Оба коммита трогают только `scripts/review-execution-policy.mjs`,
`scripts/mutation-registry.mjs`, `test/review-execution-policy.test.mjs`,
`docs/DEVELOPMENT.md`. Весь остальной материал (`PROCESS.md`,
`docs/process/REVIEWER.md`, `docs/ARCHITECTURE.md`, workflow-файлы,
`scripts/review-result-gate.mjs`, `scripts/check-inputs.mjs`,
`test/model-usage.test.mjs`, `test/process-digests.test.mjs`,
`docs/release-ledger/v1.82.0/1065.json`) между r1 и r2 побайтово не
изменился (`git diff 16bb4695e 258d59902 -- <файлы>` — пусто, кроме
`docs/STATUS.md`, где меняется только счётчик тестов, и
`scripts/ci-registry-inventory.json`, куда вписан несвязанный #1074).

Обслуживаемая работа — внутри PROCESS §12 (процесс ревью), не Core user
job из `docs/SCOPE.md`; User-Visible: no на обоих новых коммитах —
верно, `docs/CHANGELOG*.md` не трогались.

## Как проверялось

Прочитаны: тело issue #1065, все 6 текущих комментариев (включая два
author-handoff r1→r2 и опубликованный ботом r1-вердикт), r1-документ
`docs/reviews/CODE-REVIEW-1065-r1.md` целиком, `scripts/review-execution-policy.mjs`
целиком заново (не только дифф), `test/review-execution-policy.test.mjs`
целиком, оба diff новых коммитов построчно.

Материал не изменялся (`git status` чист). Выполнены обычные/статические
проверки и обычные negative-input вызовы экспортированных чистых функций
на неизменённой реализации:

- `node --test test/review-execution-policy.test.mjs` — 46/46 PASS (было
  33/33 на r1; +13 новых тестов — каждая добавленная строка в
  `for (const command of […]) test(…)` на строках 53–76 компилируется в
  отдельный `test()`, поэтому прирост виден по числу тестов, а не только
  по ассертам внутри одного теста).
- `node --test test/review-execution-policy.test.mjs test/model-usage.test.mjs
  test/process-digests.test.mjs test/review-result-gate.test.mjs` — 84/84
  PASS (адресный набор на изменённых входах; `review-result-gate.test.mjs`
  сам не менялся, но зависит от того же модуля через `reviewResultProblems`).
- `node scripts/mutation-gate.mjs --check` — статическая целостность:
  оба новых `review-sed-read-allows-extra-options-1065` и
  `review-git-read-allows-option-prefix-1065` — `ok`; тот же класс WARN
  #650 на `--test-name-pattern` с `${…}` в имени, что и у всех пяти
  остальных мутантов #1065 (не новый для этого раунда).
- `node scripts/ci-profiles.mjs --check`, `node scripts/check-inputs.mjs
  --coverage` — 0 проблем.
- `node scripts/inventory.mjs` — Node unit 5449, совпадает со
  `STATUS.md`.
- Собственный обычный negative-input поверх теста автора — прямой вызов
  `bashProblem()` синтетическими строками, не покрытыми
  `test/review-execution-policy.test.mjs` дословно, чтобы независимо
  проверить границы фикса (ни одна команда не исполнялась):

  ```
  node -e "
  import('./scripts/review-execution-policy.mjs').then(({ bashProblem }) => {
    const policy = { root: process.cwd(), stage: 'code', kind: 'task', outputs: ['/tmp/x.md'], files: ['PROCESS.md','AGENTS.md','guard.mjs'] };
    const cases = ['sed -ns 1p PROCESS.md', 'sed -n 1,2p PROCESS.md guard.mjs', 'sed -n 1p ./PROCESS.md',
      'sed -n 1p PROCESS.md/../AGENTS.md', 'sed -n 1p symlink-escape.md',
      'git diff --ext-diff=foo HEAD', 'git diff --o HEAD', 'git diff --output HEAD',
      'git cat-file --batch', 'git show --format=%H HEAD',
      'git diff --output-indicator-new=+ --output=x HEAD', 'git -C /tmp diff HEAD',
      'git diff --no-color -O /tmp/orderfile HEAD'];
    for (const c of cases) console.log(JSON.stringify(c), '=>', bashProblem({ command: c }, policy));
  });"
  ```

  Результат: все sed-варианты с лишним флагом/непосредственным
  нетрекаемым файлом (`-ns`, второй аргумент без canonicalFile,
  `../`-эскейп, символ вне `policy.files`) — denied; `sed -n 1p
  ./PROCESS.md` — allowed (резолвится в тот же трекаемый файл через
  `resolve()`, не брешь). `git diff --ext-diff=foo`, `--o`, `--output`
  (в любой комбинации с безопасным `--output-indicator-new=`) —
  denied; `git cat-file --batch`, `git show --format=…`, `git diff -O
  <file>`, `git -C /tmp diff` (последний denied, т.к. `-C` не входит в
  `READ_GIT.has(rest[0])` — `rest[0]` становится `-C`, а не subcommand)
  — allowed, но ни один не даёт запись/исполнение (только чтение/вывод в
  stdout), новой находки не образуют.
- Чтение `git log`/`git show -s --format=%B` по двум новым и трём
  merge/doc-коммитам диапазона — трейлеры `Issue: #1065` /
  `User-Visible: no` на месте.

**Переиспользовано без повтора:** review-light proof / validate-gate run
[40188072152](https://github.com/Matysh/houseplan-card/actions/runs/40188072152)
на материале `258d599029eb77615a2ae18e4bd9e8eda32eedb3` — принят как
статическая готовность входов, не переисполнялся. Архитектурные выводы
r1 по неизменным частям (`unchanged()`, startup self-probe, post-execution
audit, `Write`-ограничение на `policy.outputs`, `node`/`npm`/`npx
tsc`/`pytest`-ветки, интеграция в три workflow, release-ledger `infra`,
удаление legacy-фоллбэка) переиспользованы без повторной проверки — код
этих частей между r1 и r2 побайтово не изменился.

**Не прогонялось и почему не требовалось:** `npm run build`/`typecheck`
(диффа в `src/**` нет), golden/browser smokes/HA-harness/pytest (ноль
изменений в `demo/**`/`custom_components/**`), полный `npm test`/
`gate:small` (объём гейтов соразмерен диффу — две точечные правки в
одном B/C-инфраструктурном модуле, §8). Живой прогон PreToolUse hook
внутри этой CI-сессии по тем же причинам, что в r1, недоступен (текущий
`_process.yml` ещё не содержит materialized шаг для этого SHA) — не
дефект диффа.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| High: `sed` read-ветка в `bashProblem` проверяла только первые два аргумента (`-n`, `N[,M]p`), третий и далее — не сверялись с `canonicalFile()`; `sed -n 1p -i guard.mjs`, `-e '1e …'`, чтение `/etc/passwd` — все `null` (разрешены) | `49b711086`: условие дополнено `&& rest.slice(2).every(a => !a.startsWith('-') && canonicalFile(a, policy))` — каждый хвостовой операнд обязан быть трекаемым файлом без ведущего `-` | `scripts/review-execution-policy.mjs:91-92`; негативные кейсы `sed -n 1p -i PROCESS.md`, `--in-place`, `-e '1e …'`, `--expression=`, `--file=`, хвостовой `-i` после файла, нетрекаемый `/tmp/untracked-input` — все 7 новых `test(…)` в `test/review-execution-policy.test.mjs:55-59` PASS (denied); мой независимый вызов `bashProblem({command:'sed -n 1p -i guard.mjs'}, policy)` подтверждает non-null |

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (исключить путь временной подмены canonical/guard/limit с прогоном через `sed`) | Обычный прогон `node --test test/review-execution-policy.test.mjs` (7 новых `test('#1065 refuses unsafe requested argv as DATA: sed …')`) — PASS; независимо повторено вызовом `bashProblem()` синтетическими строками вне тестового файла (см. «Как проверялось») | Откат патча: зарегистрированный ночной свидетель `review-sed-read-allows-extra-options-1065` (не исполнялся) восстанавливает `&& true` вместо проверки хвостовых операндов — `scripts/mutation-registry.mjs:15966-15975` |
| AC1 (та же цель для ambiguous-prefix обхода в `git`-ветке, самостоятельно найденная автором в рамках этой же задачи) | Обычный прогон `node --test` (6 новых `test(…)` на `--out`, `--o`, `--ext-dif`, `--textc`, `--filt`, `--open-files-in-p=`) — PASS; независимая проверка `bashProblem()` на тех же и дополнительных префиксах (см. выше) | Зарегистрированный ночной свидетель `review-git-read-allows-option-prefix-1065` (не исполнялся) возвращает точное сравнение `name === option` вместо `name.startsWith(option)` — `scripts/mutation-registry.mjs:15976-15985` |
| AC2 (исключить ложную классификацию подмены как ordinary/«не исполнялся») | Код `reportProblems`/`traceProblems` между r1 и r2 не менялся; переиспользован вывод r1 (обычный прогон тестов `#1065 published historical claim…`, `#1065 journal binds…` — PASS на r1, код не тронут) | Унаследовано из r1 — свидетели `review-report-calls-patch-run-ordinary-1065`, `review-trace-skips-hook-journal-binding-1065` (не исполнялись) |
| AC3 (проверить защиту на обычных/safe входах и synthetic fixture, неизменённая реализация) | Код теста `#1065 real hook refuses an unsafe request…` между r1 и r2 не менялся; переиспользован вывод r1 (реальный дочерний процесс на synthetic git-репозитории — PASS на r1, код не тронут) | Унаследовано из r1 — свидетели `review-tool-policy-allows-arbitrary-bash-1065`, `review-native-hook-failure-opens-tool-1065` (не исполнялись) |

## Что проверено и корректно

- Оба фикса закрывают ровно то, что было найдено: `sed`-хвост теперь
  требует `!a.startsWith('-') && canonicalFile(a, policy)` для каждого
  операнда после `-n N[,M]p` — ни лишний флаг, ни нетрекаемый/внешний
  путь, ни `..`-эскейп, ни символьная ссылка не проходят (подтверждено
  как тестами автора, так и независимыми вызовами).
- `forbiddenGitOption()` корректно реализует консервативный fail-closed
  prefix-match: любой `--опция`, для которой хотя бы одно из пяти
  опасных полных имён (`--output`, `--ext-diff`, `--textconv`,
  `--filters`, `--open-files-in-pager`) начинается с этой опции,
  считается опасным, включая `=value`-форму (`option.split('=')[0]`).
  При этом более длинные легитимные опции (`--output-indicator-new`,
  `--output-indicator-old`) не попадают под запрет — ни одно из пяти
  опасных имён не является их префиксом — остаются разрешены, что и
  показывают тесты `git diff --output-indicator-new=+ HEAD` / мой `git
  diff --no-color -O /tmp/orderfile HEAD` (allowed, но это чтение без
  записи, не регрессия).
- Оба новых мутанта в `scripts/mutation-registry.mjs` — точные инверсии
  соответствующих фиксов (`&& true` вместо хвостовой проверки;
  `name === option` вместо `name.startsWith(option)`), привязаны к тому
  же `--test-name-pattern="#1065 refuses unsafe"`, статически `ok` в
  `mutation-gate.mjs --check`; ночные, не исполнялись — соответствует
  правилу.
- `docs/DEVELOPMENT.md` честно описывает границу находки и фикса:
  отдельно оговорено, что автор обнаружил брешь обычным DATA-пробой, ни
  одна предложенная команда не исполнялась, а для git-правки прямо
  сказано «`git diff --out` не запускался и не объявляется доказанным
  write path» — нет переклейки denial в caught.
- `docs/STATUS.md` счётчик Node unit 5449 совпадает с `npm run
  inventory`; `docs/release-ledger/v1.82.0/1065.json` не менялся между
  r1 и r2 — `category: infra`, без `introducedBy`, по-прежнему верно.
- Трейлеры обоих новых коммитов и двух merge-коммитов диапазона:
  `Issue: #1065` / `User-Visible: no` — корректно.

## Унаследовано из r1

Без повторной проверки приняты (код и входы между r1 `16bb4695e` и r2
`258d59902` побайтово не изменились):

- Архитектура native fail-closed hook, startup self-probe, post-execution
  trace/journal/report audit, `Write`-ограничение на `policy.outputs`,
  `node`/`npm`/`npx tsc`/`pytest`-ветки `bashProblem`, интеграция во все
  три workflow, удаление legacy-фоллбэка публикации — `docs/reviews/CODE-REVIEW-1065-r1.md`,
  раздел «Что проверено и корректно», материал `16bb4695e4b55fd35ea77491250048ed7d5d565d`.
- `pwd`/`ls`/`cat`/`head`/`tail`/`wc` без проверки аргументов — не новая
  возможность сверх уже разрешённых по дизайну `Read`/`Grep`/`Glob`
  (`READ_TOOLS`); оценено в r1 как не являющееся отдельной находкой,
  код этой ветки не менялся.
- `docs/release-ledger/v1.82.0/1065.json` (`category: infra`), трейлеры
  трёх исходных коммитов `a845b6685`/`9580e4bc3`/`2a6942abd` — приняты в
  r1, не менялись.

## Побочные находки (REVIEW_FINDINGS_POLICY)

Доверенный снимок: `mode=issues`. Других находок вне скоупа этой задачи
не обнаружено.

## Вердикт

Зелёный. Единственный High из r1 (обход хвостовых аргументов `sed`)
закрыт точечным исправлением, подтверждённым обычным прогоном тестов и
независимым повторным вызовом экспортированной функции; самостоятельно
найденная автором в процессе того же фикса ambiguous-prefix брешь в
`git`-ветке закрыта аналогично и так же проверена. Новых High/Medium не
обнаружено. Критерии §5 (сложность/поверхность/миграция/UX/perf/
документированность) не нарушены — маршрут `fix`.

---

<!-- material-anchors: заполняется конвейером (#414) -->

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1065-review-execution-boundary`, коммит `258d599029eb` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `db919d30cb1f3ec1ceca89c27a9241610656efb4`
  ```
  git log --all --format='%H %T' | grep db919d30cb1f
  ```
- Тело issue: `54a9f9ef09580f97513b492ce36dc287bf22112539eaad766098d4246866245d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40188451153,"run_attempt":1,"digest":"97e6f4ad3901fbb805eb8f9e7f95a1782e230c78af32130bf510aa7664904f0b"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUyMzUsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MzN9LHsiaWQiOiJjbGF1ZGUtc29ubmV0LTUiLCJpbnB1dF90b2tlbnMiOjcwLCJvdXRwdXRfdG9rZW5zIjo0MjkyOSwiY2FjaGVfY3JlYXRpb25faW5wdXRfdG9rZW5zIjoxMTYyMDUsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoyOTA5NTY4LCJjb3N0VXNkRXN0aW1hdGUiOjEuNDc2MTYzNjAwMDAwMDAwMn1dLCJ0dXJucyI6MzYsImR1cmF0aW9uTXMiOjUzMTMxMCwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjEuNDgxNDkzNjAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5305 output_tokens=42948 cache_creation_input_tokens=116205 cache_read_input_tokens=2909568 num_turns=36 -->
