# CODE-REVIEW-510-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/510
- **Материал:** `cbece6324f83b3400364fcd1a8eb1fa3b321a3ff` (рабочая копия на нём; `git rev-parse HEAD` сверен непосредственно перед выводом)
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4
- **Ветка:** `issue/510-mutants-on-candidate-and-review-gate`
- **ТЗ:** `docs/specs/510-mutants-on-candidate-and-review-waits-validate.md`, ревью ТЗ зелёное на r4 (`docs/reviews/SPEC-REVIEW-510-r4.md`)

Ветка приведена к `dev` конвейером до ревью: поверх старого материала `025634cc`
легло 4 коммита `dev` (в том числе #511 `ci: release gate judges the latest
non-cancelled Validate run of the SHA`), и текущий тип — `cbece632` — другой
код по содержимому дерева (§7.2). Разбор ниже полный, не по дельте.

## Скоуп

Полный трек, класс B/C: `.github/workflows/{process,validate}.yml`,
`scripts/{classify-changes,merge-candidate,validate-gate,mutation-gate}.mjs`,
пять тестовых файлов, `PROCESS.md`, `AGENTS.md`, `docs/TESTING.md`,
`docs/specs/README.md`. Ни одного файла класса A — `src/**` не тронут,
`User-Visible: no` на каждом коммите, changelog не требуется.

Предмет: `changed_mutants` в Validate идёт только по запросу (dispatch,
PR, ночь, кандидат беты), ревью-конвейер и слияние кандидата сами
запускают Validate с мутантами на материале и ждут его перед тем, как
читать код или сливать в `dev`; правила хендоффа (один пуш на заход).

## Как проверялось

Зелёного Validate на `cbece632` в момент ревью не найдено — гейты
прогнаны вручную.

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit | `npm test` | 2419 тестов, 2418 pass, 1 skip (`issue 281 private exact fixture` — предсуществующий, привязан к отсутствующей приватной фикстуре, не в этом диффе), 0 fail |
| build + бандл | `npm run build` затем `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | сборка зелёная, копии идентичны |
| check-docs | не прогонялся | `src/**` не тронут — гейт не относится к этому диффу (§8: отпечаток считается по `src/**`, здесь его нет) |
| smoke / golden / pytest / invariants / perf | не прогонялись | ни одна геометрия, ни один визуальный путь, ни один Python-файл, ни один perf-профиль не задеты; AC6 явно фиксирует «`src/**` без изменений» |
| мутанты реестра, заявленные ТЗ §8/AC4 | `node scripts/mutation-gate.mjs --id=<id>` по каждому из пяти | все пять «поймано 1 из 1» (таблица ниже) |
| таргетированные unit-тесты диффа | `node --test test/{review-doc-guard,validate-workflow,validate-gate,merge-candidate,classify-changes}.test.mjs` | 103/103 pass |

### AC → доказательство → чем краснеет

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 (обычный push не запускает `changed_mutants`; dispatch/PR/schedule/кандидат беты — запускают) | `test/classify-changes.test.mjs` (`mutantsRequested` таблица) + структурный тест `validate-workflow.test.mjs` на `if: needs.changes.outputs.mutants_requested == 'true'` | мутант `mutants-run-on-every-push` (classify всегда true) — прогнан лично, «поймано 1 из 1» |
| AC2 (гейт находит/запускает/красный/таймаут/несовпадение SHA, ревью не идёт без зелёного) | `test/validate-gate.test.mjs` (9 сценариев: chужой skip-dispatch игнорируется, push не доказательство, красный, таймаут, материал сменился, слежение за tracked-run) + `test/review-doc-guard.test.mjs` (структура `process.yml`: порядок шагов, условия `proceed`, сохранённый конъюнкт `reuse != 'true'`) | мутанты `review-starts-on-red-validate` и `review-trusts-push-run-without-mutants` — прогнаны лично, оба «поймано 1 из 1» |
| AC3 (слияние кандидата ждёт dispatch с мутантами, не push) | `test/merge-candidate.test.mjs` (dispatch после push, до validate; `waitValidate(candidate, {event:'workflow_dispatch'})`) | мутанты `merge-waits-push-run-without-mutants` и `merge-pushes-unvalidated-candidate` (переанкорен коммитом `cbece632`) — прогнаны лично, оба «поймано 1 из 1» |
| AC4 (три мутанта протокола пойманы штатным раннером) | см. строку выше — фактически пять мутантов, не три (`mutants-run-on-every-push`, `review-starts-on-red-validate`, `review-trusts-push-run-without-mutants`, `merge-waits-push-run-without-mutants`, `merge-pushes-unvalidated-candidate`) | все пять — «поймано 1 из 1», лично воспроизведено, не только со слов хендоффа |
| AC5 (доки обновлены) | проверено чтением: `PROCESS.md` (§10.4 «Ревью не начинается на красном коде», «Один хендофф — один пуш»), `AGENTS.md` (тот же блок), `docs/TESTING.md` («Мутанты по диффу»), `docs/specs/README.md` (строка на ТЗ) — построчно сверены с реализацией | не защитный AC (текст/наличие раздела) — свидетель обычное сравнение, третий столбец не нужен (§2.7) |
| AC6 (perf/touch/UX не затронуты, `src/**` не тронут) | `git diff origin/dev...HEAD --stat` — ни одного файла `src/**` | не защитный AC — сравнение diff-stat |

### Демонстрация: тест умеет падать (снятая защита вручную, помимо реестра)

Для `provesMutants` и `isMutantRun` дополнительно прогнал `test/validate-gate.test.mjs`
после ручного снятия проверки `run.conclusion !== 'success'` (без реестра
`mutation-gate.mjs`) — красный, три упавших сценария (red/timeout/missing
перестают различаться). Восстановлено сразу после проверки, в диффе не
осталось.

## Находки

### Medium (в скоупе задачи — чинится в этой же задаче, без отдельного issue)

**M1. Отменённый (`cancelled`) dispatch-прогон читается как красный, а не игнорируется — то же семейство дефектов, которое #511 только что исправил в соседнем скрипте той же ветки dev.**

- Файлы: `scripts/validate-gate.mjs:32` (`if (run.conclusion !== 'success') return { result: 'red', ... }`), тот же паттерн в `scripts/merge-candidate.mjs:147` (`result: run.conclusion === 'success' ? 'green' : 'red'`), которым #510 начал подавать новый вид прогона (`event: 'workflow_dispatch'`) — раньше туда попадал только push.
- **Сценарий отказа:** пока гейт (или слияние кандидата) ждёт свой dispatch-прогон Validate, кто-то с правом записи запускает ещё один `workflow_dispatch` на той же ветке (ручная проверка, вторая попытка после сетевого сбоя, повторный запуск job). Группа concurrency dispatch-прогонов — `validate-dispatch-<ref>` с `cancel-in-progress: true` (сохранена этим же ТЗ §4, `validate.yml:37`) — отменяет прогон гейта. `validate-gate.mjs` находит его по точному SHA, `run.status === 'completed'`, `run.conclusion === 'cancelled'` — не `'success'` — и до проверки job'ов мутантов сразу возвращает `{result:'red', note:'dispatch-прогон завершился: cancelled'}`. Задача уходит в `S6-in-progress` с сообщением «Validate — red», хотя материал никто не отверг: прогон просто заменён.
- **Воспроизведено лично** (не только рассуждением):
  ```js
  import { validateGate } from './scripts/validate-gate.mjs';
  const SHA = 'a'.repeat(40);
  const ops = {
    listRuns: async () => [{ databaseId: 1, status: 'completed', conclusion: 'cancelled',
      url: 'https://run/cancelled', event: 'workflow_dispatch', headSha: SHA }],
    listRunsOnRef: async () => [], jobs: async () => [],
    dispatch: async () => { throw new Error('не должно понадобиться'); },
    sleep: async () => {}, now: () => 0,
  };
  await validateGate({ ref: 'issue/1', sha: SHA, ops, pollMs: 1000 });
  // → { result: 'red', url: 'https://run/cancelled', note: 'dispatch-прогон завершился: cancelled' }
  ```
  Ни `test/validate-gate.test.mjs`, ни `test/merge-candidate.test.mjs` не содержат сценария с `conclusion: 'cancelled'` (`grep -i cancel` по обоим файлам и по обоим скриптам — пусто).
- **Почему это в скоупе, а не смежная находка:** `scripts/validate-gate.mjs` — новый файл этой самой задачи, и его прямая цель — не тратить впустую цикл ревью/минуты раннера на прогон, который ничего не доказал. Отменённый прогон — ровно такой случай: он не про красный код, а про замещённый прогон, и должен либо игнорироваться (как уже сделано для «зелёного чужого dispatch без мутантов» — `ignored`/`tracked = null`/`continue`), либo триггерить повторный dispatch, а не отправлять задачу автору с ложным «Validate red». Тот же коммит-предок (`dev`, #511, `scripts/release-gate.mjs`: `latestRelevantRun` — «cancelled run proves nothing either way») решает точно эту проблему для соседнего скрипта той же категории («дождаться зелёного Validate на SHA») буквально в этом же ребейзе — то есть паттерн исправления уже есть в дереве, просто не применён к новому коду.
- **Не блокирует:** направление отказа безопасное (не пропускает недоказанный код в ревью/слияние), это не потеря доказательства, а лишний беспричинный откат к автору — то есть дефект существующий, но не High. Чинится в этой же задаче (Medium в скоупе, §2.7/#202) — добавить `cancelled` в игнорируемые исходы (как для skip-dispatch) в обоих местах и тест на сценарий.

Других Medium/High не найдено.

### Low

Не найдено требующих записи — единственная спорная деталь (M1) достаточно
конкретна и воспроизведена, чтобы быть Medium, а не «наблюдением».

## Что проверено и корректно

- `.github/workflows/process.yml`: новый шаг `gate` стоит после `material` и
  `reuse` и до `validated`/установки зависимостей/`Review` — порядок
  подтверждён и структурным тестом, и чтением файла. `proceed` подставлен
  ровно на место конъюнкта `steps.rebase.outputs.conflict != 'true'` во всех
  перечисленных ТЗ шагах; прочие конъюнкты (`reuse != 'true'`, `stage ==
  'code'`, `decide.outputs.green == 'true'`) не тронуты — reuse-тест #499
  («модель не вызывается») остаётся зелёным без изменений своей логики.
- `.github/workflows/validate.yml`: вход `mutants` (default `false`),
  `mutants_requested` в выходах `changes`, `changed_mutants.if` заменён с
  файлового отбора на `mutants_requested == 'true'` — job исполняется даже
  на пустом отборе файлов (подтверждено чтением тела job: матрица из трёх
  шардов не имеет собственного условия внутри, только job-level `if`), что
  и требуется, чтобы `skipped` однозначно означал «не запрашивали».
- `scripts/classify-changes.mjs`: `mutantsRequested` — `pull_request`/
  `schedule` → true, `workflow_dispatch` → `full || mutants`, `push` → только
  по трейлеру `Release:`. Таблица тестов покрывает все ветки, включая
  «кнопка без запроса» (`full=false, mutants=false` → false).
- `scripts/validate-gate.mjs`: `isMutantRun`/`provesMutants` корректно
  отличают чужой зелёный dispatch без исполненных job мутантов (`skipped`)
  от настоящего доказательства; таймаут и «материал сменился» (dispatch
  появился на другом SHA) разведены и оба протестированы.
- `scripts/merge-candidate.mjs`: `dispatchValidate` вызывается один раз
  после успешного `pushWithLease` кандидата, `waitValidate` теперь
  фильтрует по `event`, что делает возможным ждать именно dispatch, а не
  push-прогон на той же SHA — порядок вызовов (push → dispatch → validate)
  подтверждён тестом на реальном git (`на настоящем git: чистый ребейз`).
- Пять мутантов реестра (AC4) лично прогнаны через `node
  scripts/mutation-gate.mjs --id=<id>` — все дают «поймано 1 из 1», не
  только заявлены хендоффом.
- Документация (`PROCESS.md`, `AGENTS.md`, `docs/TESTING.md`,
  `docs/specs/README.md`) построчно сверена с реализацией — расхождений
  не найдено; `AGENTS.md` и `PROCESS.md` описывают именно то место
  мутантов и то же правило хендоффа, которое реализует код.
- Асимметрии между `validate-gate.mjs` (гейт перед ревью) и
  `merge-candidate.mjs` (гейт перед слиянием) нет там, где она была бы
  находкой: у `merge-candidate.mjs` SHA кандидата всегда свежесозданный
  (только что запушен через `--force-with-lease`), поэтому там нет риска
  подобрать «чужой» зелёный push-прогон без мутантов, который решает
  `provesMutants` в `validate-gate.mjs` — разное решение для разных
  сценариев обосновано, не дефект.

## Чего не проверял и почему

- `check-docs.mjs`, golden, смоки, инварианты модели, `pytest
  tests_backend`, perf-профили — diff не касается `src/**`,
  `custom_components/**/*.py` или геометрии; AC6 явно фиксирует отсутствие
  влияния. Прогон был бы тратой времени без цели.
- Зеркалирование `process.yml`/`validate.yml` в `main` (AC5, §5.3
  спеки) — по правилу #454 происходит **после** слияния в `dev`; на этом
  SHA проверять нечего, это шаг публикации, не код-ревью.
- Реальный прогон `validate-gate.mjs`/`dispatchValidate` против живого GitHub
  Actions (`realOps`, `gh` CLI) — не воспроизводил: `gh` в этом окружении
  не аутентифицирован на этот репозиторий для целей ревью, а хендофф-
  комментарий уже приводит два реальных дешёвых/dispatch-прогона на
  материале (`34367209869` зелёный за 1:56, `34368454919` зелёный с тремя
  исполненными job «Мутанты по диффу») — доверяю этим ссылкам как факту
  внешнего состояния, а не как замене чтения кода; логика `ops`-инъекции
  проверена юнитами и мутантами, что и есть предмет код-ревью для скрипта
  без сети.
- Полный `npm run gate:small` / `--smokes` не запускал — при отсутствии
  `src/**` в диффе браузерные смоки не выбираются `smoke-select.mjs` в
  принципе (нет входов), прогон дал бы пустой список.

## Материал раунда

- SHA: `cbece6324f83b3400364fcd1a8eb1fa3b321a3ff` (сверено `git rev-parse HEAD`
  непосредственно перед выводом вердикта).
- Ветка: `issue/510-mutants-on-candidate-and-review-gate`.
- Ребейз: старый материал хендоффа `025634cc` не входит в историю `cbece632`
  (`git log --oneline 025634cc..cbece632` не показывает общего предка в
  выводимом диапазоне — ветка была переиграна поверх ушедшего вперёд `dev`,
  включая #511). Полный разбор выполнен по этой причине, не по дельте.

## Вердикт

Жёлтый: одна находка Medium в скоупе (M1), High нет. AC1–AC6 доказаны и
перепроверены лично (тесты + пять мутантов + сборка), гейты класса
code — зелёные без ссылки на CI (typecheck/test/build прогнаны в этом
ревью). Возврат автору для правки M1 в этой же задаче.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/510-mutants-on-candidate-and-review-gate`, коммит `025634cc7599` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b043dcd5e460e5e25561c530355b262c018f4c2c`
  ```
  git log --all --format='%H %T' | grep b043dcd5e460
  ```
- ТЗ `docs/specs/510-mutants-on-candidate-and-review-waits-validate.md`, блоб `df99bed3c772e12fcfde5439176d6827fe6d79dd`
  ```
  git log --all --find-object=df99bed3c772e12fcfde5439176d6827fe6d79dd -- docs/specs/510-mutants-on-candidate-and-review-waits-validate.md
  ```
- Вердикт конвейера: `yellow` · High 0
