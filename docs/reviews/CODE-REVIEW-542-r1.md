# CODE-REVIEW — issue #542 · заход r1

Материал: `744f502ba36955ef0ead87fb9d3fcd5ef708de2f` (единственный коммит поверх
`origin/dev`@`9c08d583`). Ребейз конвейера добавил 2 коммита dev до этого SHA
(`804dab85` → `744f502b`); согласно метке разбор ведётся полностью, но дифф
самой задачи от ребейза не изменился (тот же один коммит, тот же diffstat).

## Скоуп

Коммит `ci: include dynamic backend inputs in gates (#542)`, класс B целиком:

- `scripts/check-inputs.mjs` — добавлен точный список `BACKEND_DYNAMIC_INPUTS`
  (`src/plan-optimizer.ts`, `src/logic.ts`, `demo/fixtures/large-house.mjs`,
  `demo/fixtures/visual-matrix.mjs`) в `roots` проверки `backend`.
- `scripts/mutation-gate.mjs` — новый мутант `backend-dynamic-inputs-dropped`.
- `test/check-inputs.test.mjs`, `test/gate-reuse.test.mjs` — позитивные и
  негативные тесты на выбор `backend` и на reuse-hash.
- `docs/TESTING.md` — описание исключения и мутанта.

Продуктовый код (`src/**` как фича, `custom_components/**/*.py`) не тронут —
совпадает с заявлением issue «Продуктовый optimizer менять не требуется».
`User-Visible: no` в трейлере верен: изменение не видно пользователю, это
починка CI-гейта.

## Как проверялось

Задача изменяет только CI-манифест входов и его тесты — предметная область
дешёвых гейтов, поэтому именно они и прогонялись; Validate на этом SHA уже
зелёный (см. ссылку в постановке), но конкретно новую защиту я перепроверил
своими руками, а не по слову автора.

| Гейт | Прогнан | Результат |
|---|---|---|
| `npx tsc --noEmit`, `npm test` (весь набор), `npm run build` | нет, переиспользован | Validate green на `744f502b`: https://github.com/Matysh/houseplan-card/actions/runs/34743586126 |
| `node --test test/check-inputs.test.mjs test/gate-reuse.test.mjs` | да | 30/30 зелёных |
| `node --test test/mutation-gate.test.mjs` (структурная валидность реестра мутантов, задета правкой `mutation-gate.mjs`) | да | 50/50 зелёных |
| `node scripts/mutation-gate.mjs --id=backend-dynamic-inputs-dropped` | да | мутация поймана: `поймано 1 из 1` |
| `node scripts/check-docs.mjs` | не требовался (diff не трогает `src/**`) | проверил всё равно из осторожности: ERROR устарел уже на `origin/dev` (`9c08d583`) до этого коммита — не следствие диффа, не новая находка |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | да | «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются» — выбирать нечего, смоки не нужны |
| `npm run golden:verify` | нет, не нужен | diff не меняет рендер/геометрию/стили |
| `python -m pytest tests_backend -q` | нет, не нужен | `custom_components/**/*.py` не тронут; сам факт, что backend pytest теперь видит верные входы, доказан unit-тестами манифеста, а не прогоном pytest |
| `npm run invariants` | нет, не нужен | геометрия, `layout`, `marker.space`, толщина стен не задеты |
| performance-профили | нет, не нужен | не названы в AC, пути не тронуты |

## Проверка утверждений issue по реальному коду (не на слово автора)

Прочитал `tests_backend/test_validation.py` и `tests_backend/test_support_package.py`
целиком в местах ссылок:

- `test_validation.py:31` — `open(os.path.join(root, "src", "plan-optimizer.ts"))`:
  настоящий динамический вход, синтаксис функции `os.path.join(...)` не ловится
  статическим Python-сканером репозитория (регэксп `PY_PATH_JOIN` разбирает только
  цепочку `"a" / "b"`, а не вызов функции) — правка обоснована.
- `test_validation.py:38-58` (`@pytest.mark.parametrize` `large-house`/`visual-matrix`) —
  f-string собирает путь к `demo/fixtures/<name>.mjs` и исполняет его как отдельный
  Node-процесс через `subprocess.run(["node", "--input-type=module", "--eval", …])`;
  такого рода запуск в принципе не виден импорт-сканеру — обоснованно требует
  явного корня.
- `test_support_package.py:417-425` — `open(os.path.join(..., "src", "logic.ts"))`,
  тот же класс, что и `plan-optimizer.ts`; это и есть заявленная автором находка
  «дополнительный такой же пропуск».

Отдельно проверил, не пропущен ли ещё один такой случай, которого нет в списке:
`tests_backend/test_backend_quality.py:99` тоже читает `src/i18n/en.json`
(`REPO / "src" / "i18n" / "en.json"`, стиль `pathlib`). Прогнал
`inputsOf('backend')` руками:

```
node -e 'import("./scripts/check-inputs.mjs").then(m=>{
  console.log(m.inputsOf("backend").includes("src/i18n/en.json"))})'
→ true
```

Этот путь уже входит в `backend` **без правки #542** — он собран через `/`
(`PY_PATH_JOIN` его ловит), а не через `os.path.join(...)`, поэтому не входил в
подтверждённую аудитом проблему и не должен был попасть в
`BACKEND_DYNAMIC_INPUTS`. Отдельно прогреп по `os.path.join(..., "src"/"demo", …)`
и по всем файлам, содержащим литералы `"src"`/`"demo"`, во всём `tests_backend/**`
и `scripts/support-relay/tests/**` — других непойманных динамических input'ов не
нашёл. Список из четырёх файлов полон.

## AC — таблица «чем доказан · чем краснеет» (защитные AC, §2.7)

| AC (из тела issue) | Чем доказан | Чем краснеет |
|---|---|---|
| Изменение каждого из 4 динамических входов выбирает `backend` и меняет его reuse-hash | `test/check-inputs.test.mjs`: цикл по `[input, consumer]`, `assert.ok(affected.has('backend'))`; `test/gate-reuse.test.mjs`: `bumpsBackend()` на все 4 файла, `reuseKey` меняется | мутант `backend-dynamic-inputs-dropped` (удаляет `...BACKEND_DYNAMIC_INPUTS` из `roots`), guard `node --test --test-name-pattern="#542" …` — прогнал сам: `поймано 1 из 1` |
| Точные roots не расширяются до всего `src/**`/`demo/fixtures/**`; нерелевантные файлы не превращают `backend` в full gate | `test/check-inputs.test.mjs`: `demo/fixtures/wall-draw-click.mjs` не входит в `backend`, `affected.size < CHECK_NAMES.length`; `test/gate-reuse.test.mjs`: `demo/fixtures/one.mjs` не меняет reuse-key | прочитано: `BACKEND_DYNAMIC_INPUTS` — фиксированный список 4 файлов, а не глоб; отдельного мутанта на «расширение» не требуется — это негативная проба самого текущего кода, а не снятая защита |
| Уже исправленные входы #492 (relay/converter/schema/translations/runtime) сохраняют защиту | существующие тесты `test/gate-reuse.test.mjs` («#492 backend inputs the old HARNESS did not know…») не тронуты диффом, прогнаны вместе — 30/30 | не применимо: не новая защита этой задачи, регрессии не внесено (прогон подтверждает) |
| «Все файлы где-то известны» — не достаточный оракул | новые тесты проверяют не факт присутствия в manifest, а точную выборку (`checksAffectedBy(...).affected.has('backend')`, `affected.size < CHECK_NAMES.length`) и изменение конкретно `backend`-хеша, а не общий fallback | проверено чтением: старый «§8.1 покрытие» тест (не изменён этим диффом) действительно проверяет только «известен хоть кому-то», значит именно новый тест закрывает разницу, названную в AC |

## Находки

Нет. High — 0, Medium — 0, Low — 0.

## Что проверено и корректно

- Все 4 добавленных файла — подтверждённые чтением реальные динамические входы
  backend-тестов; список полон (см. отдельную проверку `src/i18n/en.json` выше).
- Позитивные и негативные тесты используют разные механизмы проверки
  (`checksAffectedBy` — выбор проверки; `reuseKey` — инвалидация хеша), оба
  прогнаны и оба ловят мутацию.
- Мутант зарегистрирован, гард сузен паттерном `#542` на два новых тестовых
  файла — не требует дорогого прогона; сам мутант я применил и снял руками
  (`node scripts/mutation-gate.mjs --id=backend-dynamic-inputs-dropped`).
- `docs/TESTING.md` точно описывает механизм (`os.path.join`/f-string vs
  статический сканер) и список мутантов синхронен с `MUTANT_DEFINITIONS`.
- Трейлеры корректны: `Issue: #542`, `User-Visible: no`; changelog не тронут —
  верно для чисто инфраструктурного изменения.
- Класс изменений — B целиком (`scripts/**`, `test/**`, `docs/**`), issue
  существует, работа велась в рамках указанного в issue отступления от S-flow
  (владелец), метка `S7-code-review` применена отдельно и это не противоречит
  правилам — инфраструктурные задачи не обязаны, но не запрещены проходить
  ревью.

## Чего не проверял и почему

- Полный `npm run mutation-gate -- --check` (весь реестр мутантов) — дорогой
  гейт, входит в Validate, который уже зелёный на этом SHA; проверил точечно
  только новый мутант.
- `npm test`/`tsc`/`build` целиком не перегонял — переиспользован зелёный
  Validate этого SHA.
- Browser-smokes, `golden:verify`, backend pytest, model invariants,
  performance — не выбираются диффом (см. таблицу гейтов), не прогонял.
- `node scripts/check-docs.mjs` для порядка прогнал, хотя diff не в `src/**`;
  ERROR у него унаследован от `origin/dev` и не относится к этой задаче.

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/542-backend-inputs`, коммит `744f502ba369` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `69d52ebca44f8e1cca577fedfbb0eb6156b6bf11`
  ```
  git log --all --format='%H %T' | grep 69d52ebca44f
  ```
- Тело issue: `684ae74e5be195a32338b4e82bfb1f2f1b627de2b1235cef7a9965c64c84dc1c`
- Вердикт конвейера: `green` · High 0
