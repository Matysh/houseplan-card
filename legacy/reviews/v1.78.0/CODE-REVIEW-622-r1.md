# CODE-REVIEW-622-r1

**Issue:** #622 · «имена job validate.yml — контракт, сверяемый с файлом; шарды из матрицы»
**Трек:** инфраструктурный (§1 PROCESS.md), класс B, ни одного файла класса A
**Материал:** `855373d8dbae8d7fe9b96b8a6193af6ba6c3e74d` (рабочая копия уже на нём, `git log --oneline origin/dev..HEAD` — один коммит)
**Заход:** r1 · блокирующих циклов израсходовано 0 из 4

## Скоуп

Диапазон `origin/dev...HEAD`: 12 файлов, +593/-93, только `scripts/**` и `test/**`.
`.github/workflows/*` не тронуты (подтверждено — `git diff --stat` по пути пуст).

Проблема из тела issue: имена job `validate.yml` и число шардов `changed_mutants`
жили строковыми копиями в `scripts/ci-proof.mjs`, `scripts/validate-gate.mjs`,
`scripts/e2e-gate.mjs` и тестовых фикстурах; переименование job или смена
размера матрицы давали немой `claimed execution is absent` без единого
красного теста (см. #604).

Правка: новый `scripts/workflow-jobs.mjs` разбирает job-уровень `validate.yml`
(id, `name:`, `strategy.matrix`) без зависимостей; `ci-proof.mjs` берёт число и
точные имена экземпляров матричных job из файла (`resolveJobRules`), сверяет
контракт в обе стороны (`jobContractProblems`) и превращает расхождение в
именованный `failed`, а не тихий обход. `validate-gate.mjs` и `e2e-gate.mjs`
реэкспортируют/зеркалят тот же контракт вместо собственных строк.

## AC — разбор

| AC | Чем доказан | Проверено мной |
|---|---|---|
| AC1. Переименование любого `name:` в `validate.yml` без правки правил краснит юнит-тест | `test/workflow-jobs.test.mjs` «renaming ANY job name…» — цикл по всем 14 job-level `name:` файла, каждое переименование даёт ровно одну проблему контракта; `ci-proof.test.mjs` «#622 AC1» — рантайм `evaluateCiProof` даёт `failed` с названной job | Прогнал `node --test`, зелёный (см. таблицу гейтов). Прогнал мутанты `ci-proof-rule-name-drifts-from-workflow`, `job-contract-ignores-undeclared-jobs`, `ci-proof-skips-job-name-contract` — все красят заявленный тест (1 из 1) |
| AC2. Число шардов `changed_mutants` берётся из YAML, не из константы `6` | `ci-proof.test.mjs` «#622 AC2»: тот же фикстурный прогон против файла с 7 шардами → `failed`; 7 job по 7-шардовому файлу → `green`; недостача одного экземпляра → `failed`; дубль экземпляра → `failed`. `test/validate-workflow.test.mjs` литералы `$SHARD/N`, `из N`, `SHARDS: 'N'` сверяются с `matrix.shard.size`, а не константой | Прогнал мутант `ci-proof-mutant-shards-are-a-constant` — красит (1 из 1). Прочитал: `resolveJobRules` использует `jobInstanceNames(job)` (без обрезки), число экземпляров = произведение осей матрицы |
| Побочный AC (заявлен автором явно, не в теле issue): контракт имени с `houseplan-e2e` задокументирован и под тестом | `e2e-gate.test.mjs` «#622» — зеркало строки `e2e.yml` сверяется с `E2E_JOB_NAME` | Прочитал **сам файл `Matysh/houseplan-e2e/.github/workflows/e2e.yml`** через `gh api` (см. ниже) — совпадение точное, включая цитируемый SHA |

Защитная таблица «чем краснеет» покрывает оба AC мутантами, третий пункт —
собственным мутантом `e2e-gate-hides-broken-name-contract`, тоже прогнан.

## Кросс-репозиторный факт — проверен напрямую

`scripts/e2e-gate.mjs` вводит `E2E_JOB_NAME` как «дословное зеркало строки
`name:` из `Matysh/houseplan-e2e` `.github/workflows/e2e.yml`, сверено на
`43899da5`». Это утверждение о чужом репозитории, которое юнит-тест здесь
доказать не может (автор сам это отметил в «Чего не проверял»). Проверил
напрямую:

```
$ gh api repos/Matysh/houseplan-e2e/commits/HEAD --jq '.sha'
43899da523ab1d3cdc5dcbdff164e0ac5901b736
$ gh api repos/Matysh/houseplan-e2e/contents/.github/workflows/e2e.yml --jq '.content' | base64 -d | sed -n '75p'
    name: "${{ matrix.suite }} · HP ${{ matrix.ref }} · HA ${{ matrix.ha }}"
```

Совпадает байт-в-байт с `E2E_JOB_NAME` в `scripts/e2e-gate.mjs`, и `HEAD`
чужого репозитория на момент ревью — ровно процитированный коммит: контракт
не успел устареть между хендоффом и ревью.

## Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| Validate на материале | ссылка автора задачи на прогон 22.09 | success (см. вводную ревью, полагаюсь на неё — не перегонял `tsc`/`npm test`/`npm run build` целиком) |
| Юниты по затронутым файлам | `node --test test/{check-inputs,ci-proof,classify-changes,e2e-gate,merge-candidate,mutation-gate,release-contract,release-gate,release-workflow,reviews-index,smoke-exception-guard,validate-gate,validate-workflow,workflow-jobs}.test.mjs` | pass 239, fail 0 (сам прогнал, число совпало с заявленным автором) |
| Мутанты, реестр | `node scripts/mutation-gate.mjs --check` | exit 0, все якоря `ok` |
| Мутанты, точечно (6 из 6) | `node scripts/mutation-gate.mjs --id=<каждый из шести #622>` | «поймано 1 из 1» на всех шести: `ci-proof-mutant-shards-are-a-constant`, `ci-proof-skips-job-name-contract`, `ci-proof-rule-name-drifts-from-workflow`, `job-contract-ignores-undeclared-jobs`, `e2e-gate-hides-broken-name-contract`, `ci-proof-trusts-reuse-without-source-job` |
| Покрытие входов | `node scripts/check-inputs.mjs --coverage` | exit 0 |
| Новый `any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | «Новых any нет», добавленных строк в `src/**` — 0 |
| Процессный гейт | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» |
| Отбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет… смоки не выбираются» — не гонял, выбирать нечего |
| Кросс-репо факт | `gh api repos/Matysh/houseplan-e2e/...` | см. выше |

### Чего не проверял и почему

- Полный `npx tsc --noEmit` / `npm test` / `npm run build` со сверкой бандла —
  `src/**` не тронут диффом, дешёвые гейты уже зелёные на этом SHA по ссылке
  на прогон Validate (22.09), а лёгкий набор по затронутым файлам я прогнал
  сам и он совпал с заявленным числом. Расширять до полного прогона было бы
  несоразмерно диффу (только `scripts/`+`test/`).
- `node scripts/check-docs.mjs` — diff не трогает `src/**`, отпечаток
  скриншотов не мог устареть.
- `npm run golden:verify`, performance-профили, `python -m pytest
  tests_backend` — diff не меняет рендер, перф-пути или Python; ни один AC их
  не требует.
- `npm run invariants` — diff не касается геометрии, стен, `layout`,
  `marker.space`, `open_spans`.
- Браузерные смоки — `smoke-select.mjs` явно сказал «выбирать нечего»
  (нет исполняемого frontend-диффа); не привожу к прогону.
- Переименование job **на стороне `houseplan-e2e`** юнит-тестом здесь не
  ловится — сам автор называет это границей защиты («правка обеих сторон в
  один день»). Это принятый и явно названный риск, не скрытая дыра; я
  дополнительно проверил, что на момент ревью расхождения ещё нет (см. выше).

## Находки

Не найдено ни одной High или Medium. Просмотрено построчно: парсер YAML в
`workflow-jobs.mjs` (кавычки/эскейпы, block scalars, `include`/`exclude`,
`fromJSON` — везде громкая ошибка, а не молчаливое приближение, что
соответствует заявленному дизайну), `resolveJobRules`/`jobContractProblems`
(сверка в обе стороны, дубликаты job id, `UNCONSUMED_JOBS`), реэкспорт
`MUTANT_JOB_PREFIX` (проверил: старое значение `'Мутанты по диффу'` без
хвостовой скобки, новое — `'Мутанты по диффу ('`; `startsWith` не ломается,
матчит те же строки — не регрессия), `e2e-gate.mjs` (`e2eJobName`,
`isNamedE2eJob`, `offContract`-накопление и текст ошибки). Отдельно проверил,
что нигде в `scripts/*.mjs` не осталось старой формы правил (`exact:`/
`prefix:`/`count:`) — grep пуст.

Low: нет находок, отдельно снимать нечего.

## Что проверено и корректно

- Оба AC доказаны автотестами, которые умеют падать (мутанты подтверждают
  для защитных путей; для «числа читается из YAML, не константы» — прямой
  тест с подменённым `workflowJobs` на 7-шардовый файл).
- Контракт симметричен: `jobContractProblems` ловит и «job без записи», и
  «запись без job», и «job под другим именем» — все три пути покрыты тестом
  и мутантами.
- Кросс-репо утверждение (`houseplan-e2e` SHA `43899da5`) сверено напрямую
  и подтверждено точным совпадением на момент ревью.
- Трейлеры коммита: `Issue: #622`, `User-Visible: no` — верно, видимого
  поведения продукта нет; `docs/USER-GUIDE.ru.md` не требует правок.
- `SCOPE.md`: правка не касается ни одного Core user job — это внутренняя
  надёжность конвейера ревью/слияния/релиза, чинит документированный дефект
  из #604; продуктовой рамки здесь нет и не должно быть.

## Вердикт

Зелёный. AC1 и AC2 доказаны исполнимыми тестами, которые я лично прогнал и
которые красятся на снятой защите; кросс-репозиторное утверждение проверено
напрямую, а не принято на слово; регрессий в примыкающих потребителях
(`validate-gate.mjs`, `merge-candidate.test.mjs`, `release-gate.test.mjs`,
`validate-workflow.test.mjs`) не найдено.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/622-job-name-contract`, коммит `855373d8dbae` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `51a46b3aca40a99a4e564cc718aa1931d2b88347`
  ```
  git log --all --format='%H %T' | grep 51a46b3aca40
  ```
- Тело issue: `d04057d3030982b22401499ad89292cc18665a2af448cd0f0c2a931680e0a727`
- Вердикт конвейера: `green` · High 0
