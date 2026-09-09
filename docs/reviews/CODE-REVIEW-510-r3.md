# CODE-REVIEW-510-r3

- **Issue:** https://github.com/Matysh/houseplan-card/issues/510
- **Материал:** `615181050b9ba4d4568834d56ac5a0ed97ca804d` (рабочая копия на нём; `git rev-parse HEAD` сверен перед выводом)
- **Заход:** r3 · блокирующих циклов израсходовано 2 из 4 (зелёный вердикт цикла не образует, #227)
- **Ветка:** `issue/510-mutants-on-candidate-and-review-gate`
- **Предыдущий раунд:** CODE-REVIEW-510-r2 (жёлтый, Medium M1(r2)), материал `00130e08aa247cd8796a99125deb7f9b5131bfa1`
- **ТЗ:** `docs/specs/510-mutants-on-candidate-and-review-waits-validate.md` (без изменений в этой дельте), ревью ТЗ зелёное на r4 (`docs/reviews/SPEC-REVIEW-510-r4.md`)

## Скоуп раунда

Ребейза между r2 и r3 не было: `git merge-base --is-ancestor 00130e08 HEAD`
подтверждает прямое потомство, `git log --oneline 00130e08..HEAD` даёт ровно
два коммита сверху:

```
61518105 test: the real waitValidate is exercised against a cancelled dispatch
8acbd333 docs: review document for #510
```

`git diff 00130e08..HEAD --stat` (без `docs/reviews/**`):

```
scripts/merge-candidate.mjs   |  8 +-
scripts/mutation-gate.mjs     | 11 ++
test/merge-candidate.test.mjs | 39 ++++
3 files changed, 55 insertions(+), 3 deletions(-)
```

Предмет дельты — ровно и единственно закрытие **M1(r2)**: половина фикса
M1(r1) в `scripts/merge-candidate.mjs::waitValidate` (отменённый dispatch не
должен читаться как красный) была исправлена в коде, но не имела ни одного
теста или мутанта — реальная реализация `waitValidate` внутри `realOps()`
никогда не вызывалась ни в одном тесте проекта. Разбор этого раунда
сосредоточен на том, закрыт ли этот пробел; AC1–AC6 дельта не задевает и
наследуются из r1/r2 без повторной проверки (раздел ниже).

## Как проверялось

Зелёного Validate на `61518105` нет — проверено лично:
`gh run list --repo Matysh/houseplan-card --workflow validate.yml --commit 61518105 …`
вернул `[]` (прогона на этом SHA не существует вовсе). Гейты прогнаны лично.

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| unit (полный набор) | `npm test` | 2423 тестов, 2422 pass, 1 skip (предсуществующий #281, не в этом диффе), 0 fail |
| build + бандл (2 committed-копии) | `npm run build` затем `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | сборка зелёная; `cmp` — идентичны; `git status --porcelain` после сборки пуст — рабочая копия и так была на актуальном бандле |
| смок-селектор | `node scripts/smoke-select.mjs --base 00130e08 --head HEAD` | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут). Browser-smoke этим диффом не выбираются — выбирать нечего. Тронуто файлов: 4» — браузерные смоки не запускались, основание — вывод инструмента, а не тема диффа |
| check-docs / golden / инварианты / pytest / perf | не прогонялись | дельта не трогает `src/**` ни `custom_components/**/*.py` (подтверждено тем же diff --stat и выводом smoke-select) |
| новый мутант `merge-trusts-cancelled-dispatch` | `node scripts/mutation-gate.mjs --id=merge-trusts-cancelled-dispatch` | `поймано 1 из 1` (лично) |
| пять мутантов r1 + один мутант r2 (`review-returns-task-on-cancelled-dispatch`) | не перепрогонялись | делта r2→r3 не трогает их `patches`/`guard` — новая запись реестра добавлена, старые не изменены (`git diff` выше показывает только вставку блока) |

### Демонстрация: тест умеет падать (независимая проверка, не со слов автора)

Ручной откат фикса, тот же приём, что в r2, — на текущем коде:

```
# вручную снял фильтр в scripts/merge-candidate.mjs:
#   const runs = all.filter((x) => (!event || x.event === event) && x.conclusion !== 'cancelled');
# → const runs = all.filter((x) => (!event || x.event === event));
node --test test/merge-candidate.test.mjs
```

Результат: **10 pass, 2 fail** — оба новых теста краснеют независимо друг от
друга:

```
not ok 11 - #510 r2 M1: realOps.waitValidate ignores a cancelled dispatch and follows its replacement
    expected: { result: 'green', url: 'https://run/3' }
    actual:   не тот исход (продолжает опрашивать не туда/красит раньше)
not ok 12 - #510 r2 M1: realOps.waitValidate with only a cancelled dispatch reports missing after the appear window, never red
    expected: 'missing'
    actual:   'red'
```

Файл восстановлен, `git status --porcelain` пуст. Это прямой контраст с r2,
где тот же ручной откат при том же полном `npm test` **не ронял ни одного
теста из 2420** — асимметрия закрыта: обе ветки (`green`-цепочка через
замену и одинокий `cancelled` без замены) теперь имеют падающего свидетеля,
не только мутант из реестра.

Штатный мутант `merge-trusts-cancelled-dispatch`
(`scripts/mutation-gate.mjs:8161`) патчит ровно ту же строку тем же
`find`/`replace`, гвард — `node --test test/merge-candidate.test.mjs`,
прогнан лично: `поймано 1 из 1`.

## Находки

Новых High/Medium/Low не найдено. Дельта узкая, точечная и делает ровно то,
что требовала находка M1(r2) — не больше и не меньше.

Отдельно проверено, что фикс не меняет поведение продакшен-пути: единственный
вызов `realOps({ repo, token })` в `scripts/merge-candidate.mjs:242` не
передаёт `exec`, поэтому в реальном запуске используется тот же `sh`
(`spawnSync`-обёртка), что и до этой правки — инъекция существует только для
теста. Проверено чтением (`grep -rn "realOps(" ...` — единственный
продакшен-вызов без параметра `exec`).

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| **M1(r2)**: половина фикса M1(r1) в `scripts/merge-candidate.mjs::waitValidate` не защищена ни одним тестом/мутантом — реальная реализация не вызывалась ни в одном тесте проекта, ручной откат фильтра оставлял весь `npm test` (2420/2420) зелёным | `realOps()` получил инъекцию `exec` (по умолчанию `sh`, поведение продакшена не изменилось — см. выше); `test/merge-candidate.test.mjs:248-278` — два новых теста гоняют **реальный** `waitValidate` через скриптованные ответы `gh run list`, не подменяя саму функцию; мутант `merge-trusts-cancelled-dispatch` добавлен в `scripts/mutation-gate.mjs:8161-8171` | `git diff 00130e08..HEAD -- scripts/merge-candidate.mjs scripts/mutation-gate.mjs test/merge-candidate.test.mjs`; независимый ручной откат в этом раунде — 2/12 теста падают (было 0/2420 в r2); `node scripts/mutation-gate.mjs --id=merge-trusts-cancelled-dispatch` → «поймано 1 из 1» |

## Унаследовано из r1/r2

Принято без повторной проверки в этом раунде — дельта
(`scripts/merge-candidate.mjs` +4/-4 внутри `realOps`, `scripts/mutation-gate.mjs`
+11, `test/merge-candidate.test.mjs` +39) не задевает ни один из перечисленных
предметов. Источники: CODE-REVIEW-510-r1.md (материал `cbece6324f83b3400364fcd1a8eb1fa3b321a3ff`)
и CODE-REVIEW-510-r2.md (материал `00130e08aa247cd8796a99125deb7f9b5131bfa1`).

- **AC1** (обычный push не запускает `changed_mutants`; dispatch/PR/schedule/кандидат
  беты — запускают) — доказано `test/classify-changes.test.mjs` +
  `test/validate-workflow.test.mjs`, мутант `mutants-run-on-every-push`
  («поймано 1 из 1» в r1). Файлы дельтой r2→r3 не тронуты.
- **AC2** (гейт находит/запускает/красный/таймаут/несовпадение SHA, включая
  `cancelled`) — доказано `test/validate-gate.test.mjs`, мутанты
  `review-starts-on-red-validate` / `review-trusts-push-run-without-mutants` /
  `review-returns-task-on-cancelled-dispatch` (последний подтверждён в r2).
  `scripts/validate-gate.mjs` дельтой r2→r3 не тронут вовсе.
- **AC3** (слияние ждёт dispatch с мутантами, не push) — доказано
  `test/merge-candidate.test.mjs`, мутанты `merge-waits-push-run-without-mutants` /
  `merge-pushes-unvalidated-candidate`. Логика диспатча и ожидания вне участка
  `cancelled`-фильтра дельтой не изменена.
- **AC4** (мутанты протокола пойманы штатным раннером) — шесть мутантов r1/r2
  (`mutants-run-on-every-push`, `review-starts-on-red-validate`,
  `review-trusts-push-run-without-mutants`, `merge-waits-push-run-without-mutants`,
  `merge-pushes-unvalidated-candidate`, `review-returns-task-on-cancelled-dispatch`)
  не перепрогонялись — их `patches`/`guard` не менялись (`git diff` показывает
  только добавление новой записи `merge-trusts-cancelled-dispatch`). Седьмой
  мутант этого раунда прогнан лично и подтверждён выше.
- **AC5** (доки описывают место мутантов и правила хендоффа) — сверены
  построчно в r1, дельта r2→r3 не касается `PROCESS.md`/`AGENTS.md`/
  `docs/TESTING.md`/`docs/specs/README.md` (только `scripts/**` и `test/**`).
- **AC6** (`src/**` не тронут, perf/touch/UX не задеты) — верно и для этой
  дельты: `git diff 00130e08..HEAD --stat` не содержит ни одного файла
  `src/**`, подтверждено также выводом `smoke-select.mjs`.
- Асимметрия дизайна между `validate-gate.mjs` и `merge-candidate.mjs` —
  признана обоснованной в r1, дельта её не меняет.
- Замечание r2 о риске дублирования одинаковой формулы фильтра в двух файлах
  (`validate-gate.mjs` и `merge-candidate.mjs`) — это было наблюдение о
  будущем рефакторинге, не находка с блокирующим статусом; r2 не потребовала
  унификации, только теста на существующий код. Дельта r3 её не адресует и не
  обязана была: предмет M1(r2) — отсутствие свидетеля, а не дублирование кода.

## Что проверено и корректно (в этом раунде)

- `scripts/merge-candidate.mjs`: инъекция `exec = sh` в сигнатуру `realOps`
  консервативна — единственный продакшен-вызов (`mergeCandidate` внутри
  `main()`, строка 242) не передаёт `exec`, значит в реальном запуске
  используется прежний `sh`/`spawnSync`; поведение продакшена не изменилось
  (проверено чтением всех вызовов `realOps(` в дереве).
- `test/merge-candidate.test.mjs:239-246` (`scriptedExec`): фейковый `exec`
  отвечает только на `gh run list`, на любой другой вызов бросает — новые
  тесты не могут случайно замаскировать вызов `git`/`gh workflow run`
  реальной командой; поведение проверено запуском (12/12 pass).
  Оба теста используют управляемые `sleep`/`now` (счётчик `clock`), поэтому
  не спят по-настоящему и не зависят от таймингов среды.
- Тест 1 (`ignores a cancelled dispatch and follows its replacement`)
  проверяет **обе** стороны контракта одним прогоном: что `cancelled` не даёт
  зелёный/красный результат по первому ответу (иначе `gh.calls()` было бы
  1, а не 3) и что итоговый green берётся из `replacement`, а не из
  `cancelled`.
- Тест 2 (`reports missing after the appear window, never red`) закрывает
  сценарий «замены не будет вовсе» — обязательный по тексту AC2/M1(r1)
  («ждём замену, а не красим») симметрично для пути слияния.
- Новая запись реестра `merge-trusts-cancelled-dispatch`
  (`scripts/mutation-gate.mjs:8161-8171`): `find`/`replace` совпадают
  один-в-один со строкой кода на момент проверки, `guard` запускает
  правильный тестовый файл, лично прогнана — красит при внесении мутации
  (`поймано 1 из 1`) и не красит на чистом дереве.
- Двойное независимое воспроизведение (ручной откат + штатный мутант) даёт
  одинаковый вывод: регрессия ловится, причём **сильнее**, чем закрывает
  минимальный порог §2.7 (для чистых юнитов достаточно ручного прогона со
  снятой защитой — здесь есть и он, и зарегистрированный мутант).

## Чего не проверял и почему

- `check-docs.mjs`, golden, браузерные смоки, инварианты модели,
  `pytest tests_backend`, perf-профили — дельта не касается `src/**`,
  `custom_components/**/*.py` или геометрии; `smoke-select.mjs` подтверждает
  это инструментально, а не по теме диффа.
- Шесть мутантов протокола, подтверждённых в r1/r2 — не перепрогонял: дельта
  не меняет ни их `patches`, ни `guard`-файлы (диф показывает только вставку
  новой записи).
- Реальный прогон `merge-candidate.mjs` против живого GitHub Actions — не
  воспроизводил (та же причина, что в r1/r2: цель кода-ревью для скрипта без
  сети — юниты, мутанты и ручное воспроизведение регрессии, что и сделано).
- Зеркалирование `process.yml`/`validate.yml` в `main` (AC5, §5.3 ТЗ) — шаг
  публикации после слияния, вне код-ревью.

## Материал раунда

- SHA: `615181050b9ba4d4568834d56ac5a0ed97ca804d` (сверено `git rev-parse HEAD`
  непосредственно перед выводом).
- Предыдущий материал (r2, код): `00130e08aa247cd8796a99125deb7f9b5131bfa1`.
- Ребейза между раундами не было — прямые 2 коммита сверху
  (`git merge-base --is-ancestor 00130e08 HEAD` — успех), дельта локальна.

## Вердикт

Зелёный. M1(r2) закрыта полностью: тестом на реальную реализацию
`waitValidate` (не фейк) и отдельно зарегистрированным мутантом
`merge-trusts-cancelled-dispatch`; независимое воспроизведение регрессии в
этом раунде даёт 2 упавших теста из 12 (в r2 было 0 из 2420 на том же
приёме) — асимметрия «код исправлен, но не защищён» устранена. High и Medium
не найдено. Дешёвые гейты (`typecheck`, `npm test`, `build`+сверка бандла)
зелёные, лично прогнаны за отсутствием зелёного Validate на этом SHA;
`smoke-select.mjs` подтверждает отсутствие исполняемого frontend-диффа —
браузерные проверки не нужны по инструменту, а не по теме. AC1–AC6
наследуются из r1/r2 без повторной проверки — дельта их не задевает.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/510-mutants-on-candidate-and-review-gate`, коммит `615181050b9b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1cc8f27b4d5e0648f5133206f0843a91cca54754`
  ```
  git log --all --format='%H %T' | grep 1cc8f27b4d5e
  ```
- ТЗ `docs/specs/510-mutants-on-candidate-and-review-waits-validate.md`, блоб `d68ed7818b4c77535305d0aae7da9765a2ad6c61`
  ```
  git log --all --find-object=d68ed7818b4c77535305d0aae7da9765a2ad6c61 -- docs/specs/510-mutants-on-candidate-and-review-waits-validate.md
  ```
- Вердикт конвейера: `green` · High 0
