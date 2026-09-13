# CODE-REVIEW-558-r1

Issue: #558 · «Мутант: bounded refactor/оптимизация scripts/mutation-gate.mjs»
Материал: `c53fd1a54f7ac7e504372d48e93ea87ebdd4b802` (рабочая копия совпадает,
`origin/dev..HEAD` = один коммит). Заход r1, предыдущих раундов ревью по
этой задаче не было (первая передача в код-ревью была отменена конвейером до
чтения кода из-за конфликта ребейза — см. комментарий от 17:28, цикл не
израсходован).

## Скоуп

Инфраструктурная задача (issue без `S*`-меток, вход по прямому назначению
владельца, §1 PROCESS.md). Диапазон изменений — ровно класс B/C/ни одного
файла класса A:

```
docs/ARCHITECTURE.md                |    16 +
docs/STATUS.md                      |     2 +-
docs/TESTING.md                     |     8 +-
scripts/check-inputs.mjs            |     7 +-
scripts/mutation-evidence.mjs       |   115 + (новый)
scripts/mutation-execution.mjs      |   233 + (новый)
scripts/mutation-gate.mjs           | 10161 +--- (10161 строк удалено, CLI-обвязка + ре-экспорт)
scripts/mutation-guard-outcome.mjs  |     4 +-
scripts/mutation-registry.mjs       |  9487 + (новый, декларации)
scripts/mutation-selection.mjs      |   306 + (новый)
test/classify-changes.test.mjs      |    12 +-
test/mutation-gate.test.mjs         |   120 +-
test/smoke-exception-guard.test.mjs |     2 +-
```

Задача — bounded-рефакторинг: 9678-строчный монолит `scripts/mutation-gate.mjs`
разбит на `mutation-registry.mjs` (720→725 деклараций мутантов),
`mutation-selection.mjs` (отбор по диффу, guard-input closure, invocation-scoped
кэш), `mutation-evidence.mjs` (fingerprint + ledger) и `mutation-execution.mjs`
(worktree/сборка/запуск), при сохранении стабильного CLI и публичного
API-поверхности `scripts/mutation-gate.mjs`.

Продуктового кода, changelog нет (`User-Visible: no` — верно, трейлеры на
коммите корректны: `Issue: #558`, `User-Visible: no`).

## Как проверялось

Дешёвые гейты прогнаны лично на этом SHA (не только по ссылке на Validate,
т.к. объём диффа велик и трогает системообразующий инструмент ревью же):

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | green |
| unit | `npm test` | 2652 passed, 1 штатный skip — совпадает с числом автора после ребейза |
| unit (точечно) | `node --test test/mutation-gate.test.mjs` | 57/57 passed |
| mutation anchors | `node scripts/mutation-gate.mjs --check` | 725 ok, 0 FAIL |
| check-inputs coverage | `node scripts/check-inputs.mjs --coverage` | green (без вывода) |
| process-gate | `node scripts/process-gate.mjs --issues` | green, ожидаемый инфра-WARN §8 (#562) |
| дифф-режим (реальная проверка отбора) | `node scripts/mutation-gate.mjs --changed=origin/dev..HEAD --plan-only` | `мутантов затронуто 56 из 725 (по файлам 56, по определениям 12)` — согласуется с заявленными автором «12 tooling-мутантов» |
| smoke-select (по диффу) | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Browser-smoke этим диффом не выбираются» — `src/**` не тронут, смоки не нужны |
| Validate на материале | https://github.com/Matysh/houseplan-card/actions/runs/34771849370 | `success` на точном SHA `c53fd1a5` (сверено `headSha`) |

Не прогонялись и почему: `npm run build` (со сверкой копий бандла) —
покрыт зелёным Validate на этом же SHA, диффом бандл не затронут (класс D не
менялся); `golden:verify` — diff не меняет визуал (`src/**` не тронут);
`python -m pytest tests_backend` — Python не менялся; performance-профили —
не названы в AC и не затронуты (`src/iso-*`, `src/live-*`, `src/render-*`
не в диффе); `check-docs` — не обязателен, `src/**` не тронут.

### Верификация мутационно-защищённого AC (мутант в моём прогоне, не в реестре)

AC «Cache сбрасывается при изменении tree/input; одинаковая строка guard на
другом материале не наследует старый результат» защищён юнит-тестом
`test/mutation-gate.test.mjs` — «#558: invocation-scoped resolver computes
each unique guard once and cannot leak across trees». Тест чистый (не
браузерный/бэкенд-гвард), поэтому по §2.7 PROCESS.md достаточно прогона со
снятой защитой, приведённого здесь, отдельного мутанта в реестре не
требуется:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| Резолвер не даёт кэшу утечь между материалами/деревьями | `node --test --test-name-pattern="invocation-scoped resolver" test/mutation-gate.test.mjs` | Ввёл модульный `GLOBAL_LEAK_CACHE` вместо `cache = new Map()` внутри `createGuardInputResolver` (имитация утечки кэша между инстансами) → тест упал: `secondTree(guard)` вернул `['scripts/example-guard.mjs', 'test/a.test.mjs']` вместо ожидаемого `[...'test/b.test.mjs']` — старое дерево унаследовано новым резолвером. Патч откачен, дерево чистое (`git status` пусто) |

### Проверка обратной совместимости легаси-фолбэка (не покрыта отдельным unit-тестом — проверено вручную вживую)

`baseRegistry()` в `scripts/mutation-selection.mjs` сначала читает
`scripts/mutation-registry.mjs` из указанной базы, а при неудаче — старый
монолитный `scripts/mutation-gate.mjs` (комментарий в коде: «Compatibility
across the one-time #558 split»). Прямого юнита на этой ветке нет, но
`origin/dev` в этом самом ревью — ровно родитель коммита c53fd1a5, то есть
последний pre-#558 SHA с монолитным реестром. Проверено этим:

```
node -e "import('./scripts/mutation-selection.mjs').then(async m => {
  console.log(await m.baseRegistry('origin/dev'));
})"
→ legacy base loaded: true 725
```

725 деклараций прочитаны из `origin/dev:scripts/mutation-gate.mjs` (легаси-
слой) без исключений — путь живой и работает на реальном историческом SHA,
не на синтетике. Recommendation (Low, не блокирует): закрепить эту ветку
отдельным юнитом на фикстуре, а не полагаться на то, что `origin/dev`
останется pre-#558 достаточно долго для случайной ре-проверки — см. «Низкое».

## Найдено и корректно (сверено построчно, не по заявлению автора)

- **Механическая идентичность execution-модуля.** Все 11 функций
  `mutation-execution.mjs` (`applyPatches`, `makeWorktree`, `dropWorktree`,
  `guardNeedsTestBuild`, `guardNeedsBundle`, `seedTestBuild`, `buildTestBuild`,
  `buildBundle`, `printMutantOutcome`, `runMutant`, `runCleanGuards`) побайтово
  идентичны своим прежним телам в `origin/dev:scripts/mutation-gate.mjs`
  (сравнено программно, diff пуст для каждой).
- **Механическая идентичность большей части selection-модуля.** 10 из 13
  функций идентичны байт-в-байт (`guardFiles`, `wrapperInputs`, `guardInputs`,
  `anchorSpan`, `anchorRegion`, `parseDiffRanges`, `patchTouched`,
  `packageJsonRelevance`, `registryDelta`, `shardMutants`). Три отличаются
  осмысленно и ожидаемо: `selectChangedMutants` (ранний выход на пустом
  `changed`, снимает лишний расчёт closure — чистая оптимизация, поведение то
  же: старый код на пустом `changed` тоже возвращал `[]`, просто вычисляя
  `inputsOf` вхолостую), `selectForDiff` (проверка «дифф трогает реестр»
  теперь смотрит `MUTATION_REGISTRY_FILES` вместо жёстко зашитого имени
  монолита — корректно, т.к. декларации переехали), `baseRegistry` (добавлен
  легаси-фолбэк, см. выше).
- **Реестр деклараций перенесён без искажений.** Массив `MUTANT_DEFINITIONS`
  побайтово идентичен прежнему, за вычетом ровно 12 записей — тех, чьи патчи
  указывали на `scripts/mutation-gate.mjs` как на файл-цель (тулинговые
  мутанты, проверяющие сам гейт). У них поле `file` механически переведено на
  новый реальный файл (`mutation-selection.mjs` × 8, `mutation-evidence.mjs`
  × 4), с точным совпадением числа, заявленного автором («12 tooling-мутантов
  механически перенесены… все их якоря живы») — подтверждено количественно
  (`git diff` по извлечённому массиву показывает ровно 12 строк
  `file: 'scripts/mutation-gate.mjs'` замененных на новые пути) и поведенчески
  (`--check` → 725/725 green на рабочей копии).
- **Публичный API-контракт сохранён.** `mutation-gate.mjs` ре-экспортирует всё,
  что реально импортируют внешние потребители: `test/mutation-gate.test.mjs`
  (17 символов), `test/device-presentation-policy.test.mjs` (`MUTANTS`),
  `scripts/mutation-gate-report.mjs` (`MUTANTS` через динамический `import`).
  Ни один внешний вызов не сломан — подтверждено запуском полного `npm test`
  (импорт бросил бы ошибку загрузки модуля, тест-файл не прошёл бы вовсе).
- **Внешние entrypoints не тронуты.** `.github/workflows/mutation-gate.yml`,
  `.github/workflows/validate.yml`, `scripts/pre-push-gate.mjs` вызывают
  только стабильный `node scripts/mutation-gate.mjs …` — ни один не адресуется
  к внутренним модулям напрямую.
- **Invocation-scoped резолвер не создаёт бессрочный кэш поверх ledger.**
  `createGuardInputResolver` — фабрика с локальным `Map`, создаётся заново в
  каждом вызове `main()` (`mutation-gate.mjs:43`); ledger (`mutation-evidence.mjs`)
  остаётся отдельным явным персистентным слоем со своей схемой (`LEDGER_SCHEMA
  = 2`, не менялась). Кэш и ledger не путаются: `splitByLedger` принимает
  `fingerprintOf`, который может быть как кэширующим, так и нет —
  эквивалентность проверена тестом «cached and uncached representative plans
  and fingerprints are equivalent» (сам прогнал: green).
- **`MUTATION_REGISTRY_FILES`/`LEAF_FILES` синхронизированы с новой раскладкой.**
  `scripts/check-inputs.mjs`: `LEAF_FILES` перенесён с `mutation-gate.mjs` на
  `mutation-registry.mjs` (патч-данные, похожие на импорты, лежат теперь там),
  `changed_mutants.entries` расширен до `scripts/mutation-*.mjs` — покрывает
  все пять новых/оставшихся файлов. Проверено: `check-inputs --coverage`
  green, `test/classify-changes.test.mjs` явно перечисляет все пять файлов
  под ожиданием `mutants=true, frontend=true, backend=false`.
- **Документация обновлена в том же коммите и по существу.**
  `docs/ARCHITECTURE.md` получил раздел «Mutation tooling boundaries (#558)» с
  верным направлением зависимостей (CLI → границы, не наоборот);
  `docs/TESTING.md` — актуализированы команды (`git show
  <base>:scripts/mutation-registry.mjs` + упоминание легаси-фолбэка);
  `docs/STATUS.md` — строка кандидата бета дополнена #558.
- **Измерение производительности не является голым заявлением.** Автор привёл
  таблицу (9893→5319 чтений, 4661.9→2312.4 ms) и утверждение, что
  selection/fingerprints/ledger outcomes совпадают до/после — это утверждение
  закреплено исполняемым тестом («cached and uncached … equivalent»,
  прогнан мной, green), а не декларацией.

## Находки

Нет находок уровня High или Medium.

**Low (снимаю с записью, не блокирует):** легаси-ветка `baseRegistry()` —
фолбэк на монолитный `scripts/mutation-gate.mjs` для базы старше #558 — не
покрыта отдельным юнит-тестом с фикстурой; она проверяется только косвенно,
через существование подходящего исторического SHA. Я вручную воспроизвёл
сценарий на `origin/dev` (реальный pre-#558 коммит, 725 деклараций прочитаны
корректно), так что путь сейчас работает и доказан этим ревью, но регрессия в
этой ветке в будущем не будет поймана автоматически, т.к. подходящий
исторический материал в конце концов перестанет попадать в типичные диапазоны
диффа. Автор сам пометил её как «one-time» совместимость — цена вреда низкая,
и правки в этой же задаче не требую; следующая правка `mutation-selection.mjs`
может добавить unit на синтетической фикстуре, если сочтёт нужным.

## Чего не проверял

- Полный `npm run build` со сверкой трёх копий бандла — не прогонял лично,
  беру зелёным Validate на точном SHA (класс D в диффе не менялся, риска
  расхождения нет).
- `golden:verify`, браузерные смоки, `pytest tests_backend`, performance-
  профили — не прогонял: diff не касается `src/**`/`custom_components/**/*.py`
  /рендера, `smoke-select.mjs` подтвердил «выбирать нечего».
- Абсолютные числа из измерительной таблицы автора (9893/5319 чтений,
  4661.9/2312.4 ms на матрице 720 definitions/476 guards) не переисполнял
  бит-в-бит — дорогая матрица не входит в дешёвые гейты; вместо этого
  верифицирована сама *логика* эквивалентности (тест «cached and uncached…»)
  и реальный дифф-прогон на этом дереве (56/725, 12 по реестру, кэш-хиты 952
  из 1418 запросов) — направление и порядок величин совпадают с заявленным.

## Вердикт

Зелёный. Рефакторинг механический, границы модулей проверены построчным
сравнением с прежним монолитом, защитный AC (изоляция кэша между деревьями)
воспроизведён с реальной сломанной мутацией и красным тестом, легаси-путь
проверен вживую на настоящем историческом SHA, публичный API и внешние
entrypoints не нарушены, документация и трейлеры в порядке.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/558-mutation-modules`, коммит `c53fd1a54f7a` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `6f2cdb8678dd01ac67a25fa926039c75f77b772a`
  ```
  git log --all --format='%H %T' | grep 6f2cdb8678dd
  ```
- Тело issue: `d18e5fa3c60b241b22f7efd851e378e07998e55e947d136e36947a85e3484690`
- Вердикт конвейера: `green` · High 0
