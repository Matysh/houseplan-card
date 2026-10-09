# CODE-REVIEW-671-r1

**Issue:** #671 — «Пакет ассетов (`assets/furniture/**`, `assets/fonts/**`) не входит ни в один manifest Validate и выпадает из ключа переиспользования».
**Материал раунда:** `05dfcd1c8afe3c13495b8333755a013d7a45fdec` (ветка `issue/671-assets-input-manifest`, ровно один коммит над `origin/dev@09873251`). Рабочая копия проверена — `HEAD` детачнут ровно на этом SHA, дерево чистое.
**Класс изменения:** B (инфраструктура/гейты) — `scripts/check-inputs.mjs`, `scripts/mutation-registry.mjs`, `test/check-inputs.test.mjs`, `docs/TESTING.md`. Ни одного файла класса A не тронуто — трек инфраструктурный, спецификации/спек-ревью не было, что соответствует правилу «infrastructure-only» (AGENTS.md).
**Трейлеры коммита:** `Issue: #671`, `User-Visible: no` — корректно: изменение не меняет наблюдаемое пользователем поведение продукта, только манифест CI-проверок. Changelog не тронут — это правильно при `User-Visible: no`.

## Скоуп

Диапазон `git log --oneline origin/dev..HEAD`: один коммит `05dfcd1c ci: guard asset inputs in Validate manifest`.

`git diff origin/dev...HEAD --stat`:
```
docs/TESTING.md               |  8 ++++----
scripts/check-inputs.mjs      | 26 ++++++++++++++++++++------
scripts/mutation-registry.mjs | 22 ++++++++++++++++++++++
test/check-inputs.test.mjs    | 29 ++++++++++++++++++++++++++++-
4 files changed, 74 insertions(+), 11 deletions(-)
```

Три AC из тела issue (раздел «Ожидаемое»):

| # | AC | Чем доказан | Чем краснеет |
|---|---|---|---|
| AC1 | `assets/furniture/**` — точный вход `frontend` (и всего, что реально читает пакет) | Прочитан код: `CHECKS.frontend.roots` теперь содержит `'assets/furniture/**'` (`scripts/check-inputs.mjs:336`); тест `test/check-inputs.test.mjs` «#671: весь пакет мебели…» подтверждает вложенный путь `assets/furniture/houseplan-0.4.1/svg/menu/air_conditioner.svg` попадает в `MANIFEST.frontend`, `checksAffectedBy` для этого файла даёт ровно `{affected: ['frontend'], unknown: []}`. Перепрогнан лично: `node --test --test-name-pattern="#671: весь пакет мебели" test/check-inputs.test.mjs` → зелёный | Мутант `furniture-assets-dropped-from-frontend-inputs` (`scripts/mutation-registry.mjs`), применён вручную к рабочей копии и откачен: после удаления `'assets/furniture/**'` из `roots` тест краснеет (модуль перестаёт парситься — `SyntaxError`, гайдовая логика `mutation-guard-outcome.mjs` намеренно засчитывает такой крэш как `ASSERTION_KILLED`: «a test that executes the mutated path and crashes has still exposed the regression», это документированное поведение репозитория, не находка) |
| AC2 | `assets/fonts/**` — вход либо запись в `NOT_AN_INPUT` с причиной | `NOT_AN_INPUT` содержит `['assets/fonts/**', 'исходный TTF читает только ручной generate-pdf-font.mjs; Validate использует закоммиченный результат']` (`scripts/check-inputs.mjs:89`); проверено, что оба tracked-файла (`assets/fonts/Roboto-Regular.ttf`, `assets/fonts/LICENSE`) реально покрываются глобом — `node scripts/check-inputs.mjs --coverage` не печатает ни `неизвестный вход`, ни `NOT_AN_INPUT лишний`, exit 0 | Тот же тест «#671: весь пакет мебели…» проверяет `isDeclaredNotAnInput(font)` и `MANIFEST.frontend.has(font) === false`; ручной прогон подтвердил зелёный |
| AC3 (защитный) | Тест, который краснеет, если `assets/**` снова выпадет из manifest | `GUARDED_DATA_ROOTS = ['assets']` + `isGuardedInput()` встроены в `checksAffectedBy` и `coverage()` (`scripts/check-inputs.mjs:40,414-417,428,443`); тест «#671: новый assets/** без владельца…» заводит синтетический `assets/future-pack/new.bin` и проверяет, что он одновременно (а) расширяет `affected` до полного набора и (б) попадает в `coverage().unknown` | Мутант `assets-data-root-not-guarded` (`GUARDED_DATA_ROOTS = []`) применён вручную и откачен: тест падает настоящим `AssertionError` (`deepStrictEqual` ожидал `['assets/future-pack/new.bin']`, получил `[]`) — чистое доказательство, не крэш |

Все три AC подтверждены чтением кода и личным исполнением тестов/мутаций (не только доверием к комментарию автора).

## Как проверялось

Мутации к `scripts/check-inputs.mjs` применялись через `python3`/прямую замену строки, идентичную `patch.find`/`patch.replace` из реестра (тот же механизм, что `applyPatches` в `scripts/mutation-execution.mjs`: `source.replace(patch.find, patch.replace)` — сверено чтением `scripts/mutation-execution.mjs:18-27`), затем откатывались из бэкапа; `git status` после каждого прогона — чисто.

## Гейты — что прогнано и почему

| Гейт | Статус | Комментарий |
|---|---|---|
| `typecheck`, `npm test`, `npm run build`, `bundle-policy --verify` | не перегонялись | Validate на этом же SHA `05dfcd1c` уже зелёный (https://github.com/Matysh/houseplan-card/actions/runs/36298246002) — дешёвые гейты подтверждены, перегонять незачем (issue #343) |
| `node --test test/check-inputs.test.mjs test/classify-changes.test.mjs test/gate-reuse.test.mjs` | **прогнан лично** | 56/56 зелёных — совпадает с числом из комментария автора |
| `node scripts/check-inputs.mjs --coverage` | **прогнан лично** | exit 0, вывод пуст — ни «неизвестный вход», ни «NOT_AN_INPUT лишний» |
| Оба защитных мутанта (`furniture-assets-dropped-from-frontend-inputs`, `assets-data-root-not-guarded`) | **прогнаны лично** вручную (не через полный `mutation-gate.mjs`, дешевле и достаточно для проверки конкретных двух свидетелей) | Оба реально краснеют; см. таблицу AC |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | **прогнан** | «Исполняемого frontend-диффа нет (`src/**/*.ts` не тронут)», смоки не выбираются — ожидаемо для CI-only диффа |
| `node scripts/check-docs.mjs` | не прогонялся | правило требует его только при диффе по `src/**`; диф `src/**` не трогает |
| `golden:verify` | не прогонялся | нет видимого пользователю изменения (`User-Visible: no`, диф не в `src/**`) |
| `pytest tests_backend` | не прогонялся | ни один `.py`-файл в диффе не изменён |
| `npm run invariants` | не прогонялся | диф не трогает геометрию или ссылки на неё |
| performance-профили | не прогонялись | не названы ни в AC, ни в issue |
| полный `mutation-gate.mjs`/весь набор `npm test` | не прогонялся целиком | покрыт зелёным Validate на этом SHA; проверены точечно только два новых мутанта и три файла тестов, прямо относящиеся к AC |

## Что проверено и корректно

- `assets/furniture/**` объявлен точным входом `frontend`, включая вложенные пути реального пакета (`houseplan-0.4.1/svg/menu/...`) — проверено исполнением, не только чтением.
- Все читатели пакета мебели, названные в теле issue (`test/furniture-assets.test.mjs`, `test/furniture-path-join.test.mjs`, `test/bundle-assets.test.mjs`, `scripts/generate-furniture-assets.mjs`), лежат либо под `test/**` (уже корень `frontend`), либо под `scripts/**` (уже исполняемый вход по `EXECUTABLE_ROOTS`) — отдельно добавлять их не требовалось, и авторская фраза «читатели уже покрыты test/**» подтверждена `grep` по дереву.
- Утверждение автора «у `frontend` нет reuse, поэтому сырой пакет не должен попадать в reuse-ключи smoke/golden/performance» — проверено чтением: `CHECKS.frontend.reuse` отсутствует, а `assets/furniture/**` не встречается ни в одном другом `roots`/`entries` (`grep -n assets scripts/check-inputs.mjs` — только `frontend` и объявления самих корней). Значит generated TS остаётся единственным мостом к browser-job, как и заявлено.
- `assets/fonts/**` — явное `NOT_AN_INPUT` с причиной, глоб реально покрывает оба tracked-файла (`Roboto-Regular.ttf`, `LICENSE`), не оставляя «дыр» и не будучи избыточным.
- Защитный AC3 — не «тест умеет падать» без мутации: обе мутации реестра лично применены и откачены, оба результата зафиксированы (крэш модуля для первого — документированно засчитываемый исход этого репозитория; `AssertionError` для второго).
- `docs/TESTING.md` обновлён синхронно с кодом: новое определение «неизвестный охраняемый вход» и строка про `assets/furniture/**`/`assets/fonts/**` соответствуют фактическому коду.
- Трейлеры коммита корректны, changelog не тронут — согласуется с `User-Visible: no`.
- Ни одно число, видимое пользователю, в диффе не появляется — раздел §8 «одно число — один источник» неприменим к этому диффу.

## Чего не проверял

- Полный `npm run gate:small` и весь `npm test` не перегонялись целиком — доверился зелёному Validate на точном SHA материала (ссылка в задании ревью), перепроверив только файлы и мутанты, прямо относящиеся к AC.
- Ночной полный реестр мутаций (`mutation-gate.yml`) не запускался — вне гейта ревью, это предрелизный/ночной прогон.
- Не проверял поведение `scripts/gate-reuse.mjs` на реальном CI-раннере (реюз ключей для `smoke`/`golden`/`performance_smoke`) — только статически подтвердил, что `assets/furniture/**` не входит в их `roots`/`entries`.
- Не проверял, что удаление шрифта (`assets/fonts/**`) как класса «no-op» действительно ловится существующим `generate-pdf-font.mjs` вручную — вне скоупа задачи (эта часть уже существовала до issue #671, задача только документирует и относит её к `NOT_AN_INPUT`).

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Материал раунда

`05dfcd1c8afe3c13495b8333755a013d7a45fdec` — рабочая копия на этом SHA, `git status` чист, `git rev-parse HEAD` совпадает.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/671-assets-input-manifest`, коммит `05dfcd1c8afe` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `1eee15c0ca6ef4021b49d678f45fe8d51ca9e4c5`
  ```
  git log --all --format='%H %T' | grep 1eee15c0ca6e
  ```
- Тело issue: `b0e013e0e77d8ad15970dca3f8a6b43bf19bb76a38076f522aa6d206aa652b12`
- Вердикт конвейера: `green` · High 0
