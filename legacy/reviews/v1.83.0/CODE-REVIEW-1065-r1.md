# CODE-REVIEW-1065-r1

Issue: #1065 · этап: code · трек: show · заход: r1 · материал: `16bb4695e4b55fd35ea77491250048ed7d5d565d`
(рабочая копия на этом SHA; `git fetch/pull/checkout` на другой коммит не выполнялись)

## Скоуп

Диапазон `origin/dev...HEAD` = 5 коммитов (`a845b6685`, `295d26ade` merge, `9580e4bc3`,
`2a6942abd`, `16bb4695e` merge), класс B/C, без изменений `src/**`/Python/`demo/golden/**`:

- `.github/workflows/{_process,_ship-review,release-review}.yml` — подготовка
  `review-execution-policy.json`/`.settings.json`, шаг `Ограничить инструменты
  ревью (#1065)`, шаг `Проверить execution boundary (#1065)`, изолированный pin
  CLI через новый модуль, удалён legacy fallback-копир из `docs/reviews/`.
- `scripts/review-execution-policy.mjs` (новый, 232 строки) — PreToolUse hook,
  startup self-probe, post-execution audit (trace/journal/report lint).
- `scripts/review-result-gate.mjs` — подключает `reportProblems` к
  `review-document.md`/`verdict.summary`.
- `scripts/mutation-registry.mjs` — 4 новых мутанта `review-*-1065`
  (ночные, не исполнялись).
- `scripts/check-inputs.mjs`, `scripts/ci-profile-paths.json`,
  `scripts/ci-registry-inventory.json` — явный учёт нового test-файла и
  `demo/verify_ha_dialog_discard_recovery.mjs` как input.
- `PROCESS.md`, `docs/process/REVIEWER.md`, `docs/ARCHITECTURE.md`,
  `docs/DEVELOPMENT.md`, `docs/STATUS.md` — описание политики.
- `docs/release-ledger/v1.82.0/1065.json` — `category: infra`.
- `test/review-execution-policy.test.mjs` (новый, 227 строк),
  `test/model-usage.test.mjs`, `test/process-digests.test.mjs`.

Обслуживаемая работа — `docs/SCOPE.md` не затрагивается напрямую: задача внутри
самого процесса ревью (PROCESS §12, «нарушение процесса — тоже issue»), не
Core user job. User-Visible: no на всех трёх коммитах — верно, продуктового
поведения нет; `docs/CHANGELOG*.md` не трогались — согласовано.

## Как проверялось

Прочитаны один раз: `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` §1, §2.7, §4,
§5, §7.2, §8, §12, `docs/process/REVIEWER.md` целиком, тело issue #1065 и все
4 текущих комментария (включая комментарий автора о собственном возврате в S6).
Полностью прочитаны все файлы из `fullHunkReads` пакета и новый модуль
`scripts/review-execution-policy.mjs` целиком, построчно.

Материал не изменялся (`git status` чист на протяжении всей сессии). Выполнены
только чтения и обычные/статические проверки на неизменённой реализации:

- `node --test test/review-execution-policy.test.mjs` — 33/33 PASS.
- `node --test test/model-usage.test.mjs test/process-digests.test.mjs
  test/review-result-gate.test.mjs` — 38/38 PASS.
- `node scripts/mutation-gate.mjs --check` — статическая целостность реестра:
  все 4 новых `review-*-1065` определения `ok` (один `WARN` — известный класс
  #650, `--test-name-pattern` не проверяем статически из-за `${…}` в имени
  теста одного из четырёх; это существующий паттерн ещё у 4 старых мутантов
  в том же прогоне, не новый для #1065).
- `node scripts/ci-profiles.mjs --check`, `node scripts/check-inputs.mjs
  --coverage` — 0 проблем; подтверждает, что новый test-файл и явный HA-диалог
  вход учтены профилями корректно.
- `node scripts/inventory.mjs` — Node unit 5444, совпадает со STATUS.md.
- Прямой вызов экспортированных чистых функций (`bashProblem`, `toolProblem`)
  из `scripts/review-execution-policy.mjs` синтетическими строками —
  обычный negative-input на неизменённой реализации, без исполнения какой-либо
  shell-команды (см. находку ниже).
- `git log`/`git show -s --format=%B` по трём новым коммитам — трейлеры
  `Issue: #1065` / `User-Visible: no` на месте, PROCESS/AGENTS не нарушены.

**Переиспользовано без повтора:** `review-light proof` / validate-gate run
[40183401314](https://github.com/Matysh/houseplan-card/actions/runs/40183401314)
на этом же материале — принят как статическая готовность входов, не
переисполнялся.

**Не прогонялось и почему не требовалось:** `npm run build`/`typecheck`
(диффа в `src/**` нет, `tsconfig.json` не включает `scripts/**`), golden/
browser smokes/HA-harness/pytest (ноль изменений в `demo/**` кроме записи
в `check-inputs.mjs`, ноль в `custom_components/**`), полный `npm test`/
`gate:small` (объём гейтов соразмерен диффу — B/C-инфраструктура, §8).
Живой прогон нового PreToolUse hook внутри самой этой CI-сессии недоступен:
текущий запуск модели выполняется по `_process.yml`, актуальному на
`origin/dev` (ещё без шага `Ограничить инструменты ревью (#1065)` — он
появляется только в материале этой задачи). Это ожидаемое свойство
label-триггерного пайплайна, а не дефект диффа: `$RUNNER_TEMP` этой сессии не
содержит `review-execution-policy.json`/`.settings.json`, что подтверждает
отсутствие самохостинга на первом прогоне, а не поломку шага.

## Находки

### High — PreToolUse-политика Bash пропускает `sed` с деструктивными флагами/произвольным путём (AC1 не выполнен)

`scripts/review-execution-policy.mjs:84`:

```js
if (bin === 'sed' && rest.length >= 3 && rest[0] === '-n' && /^\d+(?:,\d+)?p$/.test(rest[1])) return null;
```

Проверяются только первые два аргумента (`-n` и `N[,M]p`); `rest.length >= 3`
лишь требует присутствия *хотя бы одного* дальнейшего аргумента и не
проверяет ни его количество, ни содержимое, ни принадлежность
`canonicalFile()` (в отличие от всех остальных веток `bashProblem`, где
путь файла явно сверяется с неизменённым `git ls-files`). Любые
дополнительные флаги после второго аргумента проходят без проверки.

Воспроизведение — обычный negative-input case, вызов экспортированной чистой
функции синтетическими строковыми данными (ни одна команда не исполнялась):

```
node -e "
import('./scripts/review-execution-policy.mjs').then(({ bashProblem }) => {
  const policy = { root: process.cwd(), stage: 'code', kind: 'task', outputs: ['/tmp/x.md'], files: ['guard.mjs'] };
  console.log(bashProblem({ command: 'sed -n 1p -i guard.mjs' }, policy));
  console.log(bashProblem({ command: \"sed -n 1p -e '1e forbidden-action' guard.mjs\" }, policy));
  console.log(bashProblem({ command: 'sed -n 1,5p /etc/passwd' }, policy));
});
"
```

Результат: `null` для всех трёх — политика их пропускает.

Последствие: `sed -n 1p -i guard.mjs` — реальная команда GNU sed, которая
при исполнении перезаписывает файл на диске (режим `-n` подавляет обычный
вывод, `-i` записывает результат явного `p` обратно в файл) — это ровно тот
«временный патч canonical guard/limit», который issue #1065 обязана
исключить (AC1, «Требуемый результат будущей работы», п.1). `sed -n 1p -e
'1e forbidden-action' guard.mjs` использует GNU-расширение `e` (execute) и
является известным вектором исполнения произвольной команды через sed.
`sed -n 1,5p /etc/passwd` читает файл вне `policy.files`/вне репозитория —
третий аргумент никогда не прогоняется через `canonicalFile()`.

Тестовый файл `test/review-execution-policy.test.mjs:38` покрывает только
один позитивный случай `sed -n 30,50p PROCESS.md`; негативного случая на
`sed` с дополнительными флагами или непосредственным файлом нет — поэтому
33/33 PASS не свидетель отсутствия дефекта.

**Это не новое открытие ревью, а независимое подтверждение.** Автор сам
обнаружил и зафиксировал тот же обход на этом же замороженном SHA в
[комментарии](https://github.com/Matysh/houseplan-card/issues/1065#issuecomment-6396420871)
(через тот же метод — вызов `bashProblem()` синтетическими данными,
`proposedCommandsExecuted=0`) и вернул задачу в `S6-in-progress` для точечного
исправления всех «хвостовых» аргументов `sed`. На момент этого ревью метка в
репозитории действительно `S6-in-progress` (не `S7-code-review`), но
материал по заданному SHA не изменился — красный вердикт по этому SHA
фиксирует то же состояние, которое уже признал сам автор.

AC1 («Исключить в ревью путь временного изменения canonical
implementation/build/guard/limit с исполнением проверок вне ночного
workflow») на зафиксированном SHA не выполнен: конкретный путь
(`sed -n Np -i`/`-e 'e …'`) остаётся открытым.

Других аналогичных пропусков не найдено: `git`/`npm`/`npx tsc`/
`pytest`/`node --test` ветки явно сверяют путь файла через `canonicalFile()`
или ограничивают аргументы точным совпадением (`rest.length === 2`,
`['build','typecheck','bundle:sync']` и т.п.). `pwd/ls/cat/head/tail/wc`
(строка 82) тоже пропускают произвольные аргументы без проверки пути, но
это не превышает уже принятую границу: `Read/Grep/Glob` в том же hook
(`READ_TOOLS`) разрешены без всякой проверки пути по дизайну («tool policy,
не OS sandbox», `docs/ARCHITECTURE.md`) — `cat`/`head`/`tail` не добавляют
новой возможности сверх уже предоставленной, поэтому отдельной находкой не
считаю; `sed` — качественно другой случай, потому что единственная ветка
Bash-политики, которая скрыто пропускает запись/исполнение, а не только
чтение.

## AC · чем доказан · чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (исключить путь временной подмены canonical/guard/limit с прогоном) | Не выполнен — см. находку High | Обычный негативный вызов `bashProblem({command:'sed -n 1p -i guard.mjs'}, policy)` выше: ожидаемо non-null, фактически `null` |
| AC2 (исключить ложную классификацию подмены как ordinary/«не исполнялся») | Прочитан код `reportProblems`/`traceProblems`/`reviewResultProblems`; обычный прогон `node --test test/review-execution-policy.test.mjs` (тесты `#1065 published historical claim…`, `#1065 journal binds…`) — PASS | Зарегистрированный свидетель `review-report-calls-patch-run-ordinary-1065` (не исполнялся, ночной) и `review-trace-skips-hook-journal-binding-1065` (не исполнялся, ночной) |
| AC3 (проверить защиту на обычных/safe входах и synthetic fixture, неизменённая реализация) | Обычный прогон теста `#1065 real hook refuses an unsafe request…` (реальный дочерний процесс hook на synthetic git-репозитории, не на продуктовом дереве) — PASS | Зарегистрированные свидетели `review-tool-policy-allows-arbitrary-bash-1065` и `review-native-hook-failure-opens-tool-1065` (не исполнялись, ночные) |

Табличные «не исполнялся» относятся к ночному mutation-реестру (#709,
подтверждено статическим `node scripts/mutation-gate.mjs --check`, caught
неизвестен до ночи) — это не подменяет находку по AC1 выше, которая доказана
обычным (не мутационным) вызовом экспортированной функции.

## Что проверено и корректно

- Архитектура в целом состоятельна: `unchanged()` сверяет HEAD/diff на каждом
  вызове hook/prepare/audit; `--setting-sources ""` исключает
  user/project/local settings; `disableAllHooks:false` + `onFailure:'block'`
  держат native fail-closed; startup self-probe денай JSON-данными без
  диспетчеризации; `Write` ограничен ровно `policy.outputs` с проверкой
  симлинков; `traceProblems` требует полного совпадения journal↔trace и
  отказывает на forbidden-запросе, даже исполненном как «отказанный».
- `node`-ветка (includes `--test`, `scripts/mutation-gate.mjs --check`,
  `scripts/fix-test-build.mjs`, `demo/smoke_*`/explicit HA-диалог,
  `CHECK_SCRIPTS`) и `git`/`npx tsc`/`pytest` ветки — путь файла либо точное
  совпадение аргументов, либо `canonicalFile()`; глобальный запрет
  `--write/--apply/--fix/--accept/--execute-nightly/--return/--seal/--publish/
  --push/--force/-e` действует для всех `node`-вызовов.
- Все три workflow (`_process.yml`, `_ship-review.yml`, `release-review.yml`)
  единообразно подключают `prepare`→`settings:`→`Review`→`audit`→`seal`;
  `test/model-usage.test.mjs`/`test/process-digests.test.mjs` зелёные и
  реально проверяют порядок шагов, `--setting-sources ""`, явные абсолютные
  пути в промпте вместо shell/env-вычисления.
- Удаление legacy-фоллбэка (копия из `docs/reviews/<marker>-<NUM>-r<CYCLE>.md`
  в `_process.yml`) закрывает параллельный путь публикации — согласуется с
  `docs/DEVELOPMENT.md` описанием.
- `docs/release-ledger/v1.82.0/1065.json`: `category: infra`, без
  `introducedBy` — верно, это не правка бета-функции, а независимая
  инфраструктурная находка по PROCESS §12 после #1064.
- `STATUS.md` счётчик Node unit 5444 совпадает с `npm run inventory`;
  `scripts/ci-profile-paths.json`/`ci-registry-inventory.json` синхронно
  включают новый тест-файл и `docs/release-ledger/v1.82.0/1065.json`.
- Трейлеры всех трёх некорневых коммитов: `Issue: #1065` / `User-Visible: no`
  — корректно, продуктовое поведение не меняется, CHANGELOG не нужен.
- 4 новых мутанта в `scripts/mutation-registry.mjs` статически целостны
  (`ok` в `mutation-gate.mjs --check`); они не исполнялись ни автором, ни
  мной — соответствует правилу «мутант пишется, но вне ночи не гоняется».

## Побочные находки (REVIEW_FINDINGS_POLICY)

Доверенный снимок: `mode=issues`. Других находок вне скоупа этой задачи не
обнаружено — единственная находка (High) принадлежит коду, который issue
#1065 сама и вводит, поэтому остаётся в задаче; отдельный issue не заводится.

## Вердикт

Красный. High-находка — реальный, воспроизводимый на зафиксированном SHA
обход центрального механизма задачи (обычный `sed -n Np -i`/`-e 'e …'` на
guard/limit-файле проходит PreToolUse-политику), сам автор пришёл к тому же
выводу тем же методом и вернул задачу в `S6-in-progress`. Это не вопрос
критериев §5 (сложность/поверхность/миграция/UX/perf/документированность) —
маршрут `fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1065-review-execution-boundary`, коммит `16bb4695e4b5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `672a2e47dcb7ab46f3f8e466bd322fd870e98d0f`
  ```
  git log --all --format='%H %T' | grep 672a2e47dcb7
  ```
- Тело issue: `54a9f9ef09580f97513b492ce36dc287bf22112539eaad766098d4246866245d`
- Вердикт конвейера: `red` · High 1 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNDMsIm91dHB1dF90b2tlbnMiOjIxLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjQ4fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5Miwib3V0cHV0X3Rva2VucyI6NTM0MzIsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTM4MzE4LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDg2MjUwMiwiY29zdFVzZEVzdGltYXRlIjoyLjA2MDI3NjR9XSwidHVybnMiOjYwLCJkdXJhdGlvbk1zIjo2Njc3NDUsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjA2NTUyNDM5OTk5OTk5OTcsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5235 output_tokens=53453 cache_creation_input_tokens=138318 cache_read_input_tokens=4862502 num_turns=60 -->
