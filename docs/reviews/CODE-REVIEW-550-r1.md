# CODE-REVIEW-550-r1

Issue: #550 «Мутационный гейт: отличать срабатывание теста от ошибки сборки и подготовки»
Материал ревью: `d89b55ccf0bba40b51d713f880515b6f17a641a0` (ветка `issue/550-mutation-outcomes`)
Диапазон: `43ba198d..d89b55cc` (два коммита: `4d8ad3db`, `d89b55cc`)
Трек: инфраструктурный (§1 PROCESS.md) — ни одного файла класса A, вход сразу на `S7-code-review`.
Заход: r1 · блокирующих циклов израсходовано 0 из 4.

## Скоуп

Диапазон трогает только класс B/C: `scripts/mutation-gate.mjs`,
`scripts/mutation-gate-report.mjs`, новый `scripts/mutation-guard-outcome.mjs`,
`test/mutation-gate.test.mjs`, `test/mutation-gate-report.test.mjs`, новый
`test/mutation-guard-outcome.test.mjs`, `docs/TESTING.md`. `src/**`,
`custom_components/**` не тронуты — `User-Visible: no` на обоих коммитах верно,
changelog не требуется.

Риск из тела issue: `runMutant` трактовал любой ненулевой exit гарда как
«assertion killed», хотя многие гварды — цепочка `подготовка && ... && oracle`,
и падение подготовки (компиляция, сборка, collection теста) не доказывает, что
заявленный тест вообще исполнился.

## Как проверялось

**Дешёвые гейты подтверждены на этом SHA без повторного прогона** (см. вводную
задачи): `npx tsc --noEmit`, `npm test`, `npm run build` — Validate
`34750198536` и push-Validate `34750061003`, оба на точном `d89b55cc`, success.

**Дополнительно проверено мной, потому что диапазон заявляет защитный AC:**

| Гейт | Статус | Почему |
|---|---|---|
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнан | диапазон не трогает `src/**`, инструмент подтвердил: «browser-smoke этим диффом не выбираются» — смоки не нужны |
| `node --test test/mutation-guard-outcome.test.mjs` | прогнан локально | зелёный, 9/9 |
| `check-docs.mjs`, `golden:verify`, `pytest tests_backend`, `model-invariants` | не прогнаны | диапазон не трогает `src/**`, рендер, геометрию, Python — гейты не относятся к диффу |
| perf-профили | не прогнаны | не названы в AC, диапазон не трогает рендер/interaction пути |

**Проверка «тест умеет падать» для защитных AC** — не поверила заявлению
автора, а воспроизвела три новых мутанта из `MUTANT_DEFINITIONS` вручную,
патчами по тем же якорям, что в реестре, и убедилась, что суит краснеет:

1. `mutation-outcome-setup-counts-as-assertion` (патч `if (false && phase ===
   'setup')` в `mutation-guard-outcome.mjs`) → `node --test
   test/mutation-guard-outcome.test.mjs`: 8 pass / **1 fail** (тест
   `mutant-induced compile failure is setup, not a killed assertion` красне­ет,
   потому что без раннего `return` для setup-фазы TS-ошибка мутанта не
   совпадает ни с `ASSERTION_EVIDENCE`, ни с `ORACLE_SETUP_FAILURE`, и попадает
   в `ASSERTION_KILLED` по умолчанию — именно та путаница, которую AC1-AC3
   запрещают).
2. `mutation-ledger-accepts-setup-proof` (патч `validProof` в
   `mutation-gate.mjs`, чтобы принимать `'setup'`) → `node --test
   --test-name-pattern="#550 fixture: clean setup|#481 AC3"
   test/mutation-guard-outcome.test.mjs test/mutation-gate.test.mjs`: 1 pass /
   **1 fail** (`assert.throws(() => recordCaught(..., 'setup'), /недоказанный
   outcome/)` перестаёт бросать).
3. `mutation-report-setup-as-unparsed` (патч `if (false && asUnverifiable...)`
   в `mutation-gate-report.mjs`) → `node --test --test-name-pattern="#550:
   setup/invalid/interruption" test/mutation-gate-report.test.mjs`: **1 fail**
   (`unverifiable.length` `1 !== 4` — без ветки парсера три строки уходят в
   `unparsed`, отчёт больше не называет недоказанные исходы явно).

После каждой проверки файл восстановлен (`git status --short` — чисто).

Все три мутанта также подтверждены **на CI**, причём двумя разными
dispatch-прогонами (Validate с `mutants=true`, что и требует PROCESS.md как
единственное валидное доказательство, а не push-прогон):
- Прогон на материале ревью `34750198536` (SHA `d89b55cc`): shard 2/6 поймал
  `mutation-outcome-setup-counts-as-assertion`, shard 1/6 —
  `mutation-ledger-accepts-setup-proof`, shard 5/6 — уже существующий
  `ledger-written-at-end-only` (регрессия, которую чинит второй коммит захода).
- Предыдущий прогон `34749818213` (SHA `4d8ad3db`, красный целиком из-за
  `ledger-written-at-end-only`) поймал `mutation-report-setup-as-unparsed` в
  shard 1/6 **до** точки отказа — это легитимное переиспользование через
  per-shard ledger-кэш Actions (третий мутант не нуждался в повторном прогоне
  на `d89b55cc`, потому что его файлы отпечатка не изменились между двумя
  коммитами захода).

Итого: 705 определений в реестре, диффом затронуто 35 (по файлам) / 5 (по
определениям изменённых мутантов), все относящиеся к диффу свидетели пойманы
на точном материале ревью — конвейер подтверждает это сам job'ом
«Доказательство выполненных проверок» (success).

## Таблица «чем краснеет» (#435) по AC issue

| AC (из тела issue) | Чем доказан | Чем краснеет |
|---|---|---|
| Fixtures на все пять исходов (setup/invalid/compile/assertion/survived/timeout) получают честный outcome | `test/mutation-guard-outcome.test.mjs` (9 тестов, включая regression-фикстуры из `d89b55cc` для subtest-вывода Node) | Снятие любой из веток `classifyCommandResult`/`interruption` ломает соответствующий фикстурный тест — проверено вручную для setup-ветки (см. выше, п.1), остальные ветки покрыты симметрично тем же файлом |
| Guard `tsc && test` не сообщает исполнение named test, если tsc остановился раньше | `mutation-outcome-setup-counts-as-assertion` (мутант в реестре) + фикстура «mutant-induced compile failure is setup» | Воспроизведено вручную: без early-return для `phase==='setup'` тест краснеет (8/9, см. п.1); также поймано в CI на материале ревью |
| Ledger/report/reuse не переносят setup failure как подтверждение | `mutation-ledger-accepts-setup-proof` + `mutation-report-setup-as-unparsed`, `#481 AC3` (`recordCaught` бросает на `proof='setup'`, `readLedger` не пускает старую/недоказанную схему) | Оба мутанта воспроизведены вручную (п.2, п.3) и пойманы в CI |
| Существующие правомерные witnesses сохраняются, без рефактора всех определений | Прочитано: в `scripts/mutation-gate.mjs` ни один существующий мутант не декларирует `oracle: 'compile'` (`grep oracle:` — совпадений в определениях нет), правки реестра ограничены тремя новыми записями плюс точечные патчи двух `#481`-мутантов под новую форму ledger | Не защитный AC (ограничение объёма правки), доказательство — чтением диффа `scripts/mutation-gate.mjs`, не исполнением |

## Прочитано, но не переисполнялось

- `runGuardPhases`/`guardPhases`/`classifyCommandResult` в
  `mutation-guard-outcome.mjs` — логика разбора `&&`-цепочки, регэкспы
  `ORACLE_SETUP_FAILURE`/`ASSERTION_EVIDENCE`: проверено чтением плюс целевым
  исполнением (см. выше), отдельно проверил, что `guardNeedsTestBuild`/
  `guardNeedsBundle` не пересекаются с гипотетическим `oracle: 'compile'`
  гвардом (такой гвард — одна tsc-команда без `node --test`/`demo/`, обе
  проверки не сработают) — проверено чтением, не исполнением, живых мутантов с
  `oracle: 'compile'` в реестре пока нет.
- `buildTestBuild`/`buildBundle` в `mutation-gate.mjs` теперь бросают на
  ненулевом статусе вместо игнорирования — согласуется с идеей задачи (tsc в
  подготовке мутанта — не оракул); поймано в CI как часть штатного прогона
  мутантов (ни один существующий мутант не полагался на старое поведение
  «код выхода tsc игнорируется»), отдельного мутанта на этот конкретный узел
  не заводили — риск низкий, узел прикрыт тем, что почти все гварды с
  `test-build` реально запускают его через `buildTestBuild` в каждом прогоне.
- `sh()` получил `timeout: 180_000` и `killSignal: 'SIGTERM'` — проверено
  чтением; не нашёл гварда, который перемножает несколько долгих команд под
  одним таймаутом (полный `npm test`/`npm run build` как гвард в реестре не
  встречается), поэтому 180 с — не риск ложных `infrastructure-interruption`.
- `LEDGER_SCHEMA` bump 1→2 и инвалидация старых записей — намеренный сброс
  кэша, не миграция данных; чтением подтвердил, что `readLedger` отбрасывает
  и чужую схему, и записи без `proof` (тест `#481 AC3` это покрывает).

## Находки

Нет. High — 0, Medium — 0, Low — 0.

Отдельно отмечу (не находка, а наблюдение без действия): `splitAndChain` не
обрабатывает последний символ строки в цикле (`index < text.length - 1`),
теоретически мог бы неверно закрыть кавычку, если строка гварда заканчивается
ровно на кавычке перед `&&` — в реестре таких гвардов нет, и хвост всё равно
берётся простым `slice`, так что наблюдаемого дефекта нет; проверил на трёх
адверсариальных примерах (см. журнал проверки) — поведение корректно на всех.

## Вердикт

Зелёный. Реализация закрывает риск из тела issue: подготовка (`tsc`, `rollup`,
`fix-test-build`) больше не может выдать себя за падение заявленного oracle,
compile-time свидетель допускается только явным `oracle: 'compile'`, ledger
schema 2 fail-closed отбрасывает недоказанные и старые записи, ночной отчёт
отдельно называет недоказанные исходы. Три новых мутанта воспроизведены и
вручную, и по логам CI-прогона на точном материале ревью. Объём правки
реестра соразмерен риску — рефактора всех 705 определений не случилось.

---

## Материал раунда

- SHA: `d89b55ccf0bba40b51d713f880515b6f17a641a0`
- Диапазон: `43ba198d7f74d92499e4dfd582c2a00adc4bd076..d89b55ccf0bba40b51d713f880515b6f17a641a0`
- Validate (push) на точном SHA: https://github.com/Matysh/houseplan-card/actions/runs/34750061003 — success
- Validate (mutants=true, dispatch, доказательство мутантов по PROCESS.md): https://github.com/Matysh/houseplan-card/actions/runs/34750198536 — success

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/550-mutation-outcomes`, коммит `d89b55ccf0bb` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9d43b0e649a50deea03989718d9e25fe200ccf6a`
  ```
  git log --all --format='%H %T' | grep 9d43b0e649a5
  ```
- Тело issue: `ccb0c6233ab2eca52ebe2ee4560645f5d118d84b8981a8de76550f4937c61a87`
- Вердикт конвейера: `green` · High 0
