# CODE-REVIEW-548-r1

**Issue:** #548 — CI: TS/Python parity геометрии должна исполняться на чистом backend runner, а не skip
**Трек:** инфраструктурный (§1 AGENTS.md/PROCESS.md) — ни одного файла класса A в диапазоне
**Материал:** `git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD`
**SHA материала:** `b15d357fa2d9b4596864905008be82c7239f47cf` (HEAD ветки `issue/548-backend-parity`, рабочая копия проверена на нём — `git rev-parse HEAD` совпадает)
**Заход:** r1 · блокирующих циклов израсходовано 0 из 4 (первый заход этапа code-review; предыдущий прогон конвейера на `76d8017e` остановился на красном Validate до чтения кода и цикл не потратил — комментарий issue от 2026-09-13T07:56:49Z)

## Скоуп

Два коммита:

1. `76d8017e` — основная реализация: отдельная reusable job `geometry_parity` в
   `validate.yml`, узкий `tsconfig.junction-parity.json`, новый исполняемый
   fail-closed харнесс `tests_backend/junction_parity.py`, перенос 15 сценариев
   из старого optional pytest-теста в `test/fixtures/junction-limits-parity.json`,
   удаление старого `test_parity_with_the_frontend_checks` (тихий skip), новый
   `tests_backend/test_junction_parity.py`, обновление `classify-changes.mjs`,
   `check-inputs.mjs`, `gate-reuse.mjs`, `ci-proof.mjs`, новый мутационный
   свидетель `junction-limit-ts-python-parity-drift`, правки документации
   (`AGENTS.md`, `PROCESS.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`).
2. `b15d357f` — точечный фикс: `evaluateCiProof` не принимал reuse-заявку
   `geometry_parity` («unsupported proof mode»), найдено предыдущим (несостоявшимся)
   прогоном Validate с мутантами; добавлен `geometry_parity` в разрешённый список
   reuse-режимов и регрессионный тест на верифицированный источник.

Файлы только классов B/C/D-адъютант (`test/**`, `tests_backend/**`, `scripts/**`,
`.github/workflows/validate.yml`, `tsconfig.junction-parity.json`, `docs/**`,
`AGENTS.md`, `PROCESS.md`) — ни одного `src/**` или `custom_components/**/*.py`
продуктового файла. Инфраструктурный трек применён корректно.

Продуктовая геометрия не менялась (заявлено автором и подтверждено чтением:
`src/junction-limits.ts` и `custom_components/houseplan/junction_limits.py`
отсутствуют в диапазоне изменённых файлов).

## Как проверялось

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit` | green | прогнан локально на SHA `b15d357f` |
| `npm test` (полный) | green | не перегонял — уже подтверждён зелёным Validate на этом SHA (см. ниже); вместо этого прогнал целевой поднабор |
| Целевой `node --test` (`ci-proof`, `check-inputs`, `classify-changes`, `gate-reuse`, `validate-workflow`, `mutation-gate`) | green, 129/129 | `node --test test/ci-proof.test.mjs test/check-inputs.test.mjs test/classify-changes.test.mjs test/gate-reuse.test.mjs test/validate-workflow.test.mjs test/mutation-gate.test.mjs` |
| `npm run build` + сверка копий бандла | не гонял | diff не касается `src/**`/`rollup.config.mjs`; бандл не мог измениться, и это уже подтверждено зелёным Validate на точном SHA |
| `node scripts/check-docs.mjs` | не гонял, не нужен | diff не касается `src/**` |
| `node scripts/model-invariants.mjs` | не гонял, не нужен | геометрия/ссылки на неё не менялись — менялся только тестовый харнесс вокруг уже существующих зеркал |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | прогнан | «Исполняемого frontend-диффа нет — Browser-smoke этим диффом не выбираются». Смоки не нужны |
| `python -m pytest tests_backend -q` | не гонял (pytest не установлен в среде ревьюера, `.venv-backend` не провизирован) | вместо этого руками воспроизвёл обе новые проверки `test_junction_parity.py` вызовом их тела через `python3 -c` (см. «Защитные AC») и реальным прогоном `tests_backend/junction_parity.py` в отдельном git worktree |
| `node scripts/process-gate.mjs --issues` | green (1 WARN, ожидаемый) | «инфраструктурный диапазон (#562): статусная метка не требуется до S7-code-review» |
| Реальный прогон новой job на чистом runner | **воспроизведено на живом CI** | см. ниже |

**Дешёвые гейты уже подтверждены зелёным Validate на этом SHA:**
https://github.com/Matysh/houseplan-card/actions/runs/34746690349 (типы/юниты/сборка/бандл-синхрон/no-new-any) — поэтому полный `npm test`/`npm run build` не перегонялись, бюджет раунда потрачен на чтение кода и целевые прогоны.

### Живая проверка на реальном CI (не из отчёта автора)

Проверил напрямую через `gh run view`, а не поверил хендоффу:

- Run [34746521147](https://github.com/Matysh/houseplan-card/actions/runs/34746521147) (SHA `b15d357f`): job **«Геометрия: TS/Python parity исполнена»** реально выполнилась (не reuse) — `npm ci`, `tsc -p tsconfig.junction-parity.json`, `fix-test-build.mjs`, `python tests_backend/junction_parity.py --build-dir=test-build/junction-parity`, все шаги green. Лог шага «Сравнить настоящие TS/Python validators»:
  ```
  geometry parity: 15 scenarios executed; TS/Python verdicts identical
  ```
  Это прямое доказательство AC1/AC4 — не «verified» без команды, а конкретный прогон с конкретным выводом.
- Run [34746690349](https://github.com/Matysh/houseplan-card/actions/runs/34746690349) (тот же SHA, повторный push-триггер): job `geometry_parity` — `conclusion: skipped` из-за reuse (тот же контент уже проверен), а job **«Доказательство выполненных проверок»** (`proof`) — **success**. Это подтверждает вживую, что фикс `b15d357f` (принятие `geometry_parity` в списке reuse-режимов `evaluateCiProof`) реально работает на настоящем прогоне, а не только в юнит-тесте.

## Защитные AC — таблица «чем краснеет» (§2.7)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1: чистый runner исполняет parity реально; отсутствие prerequisites — setup failure, не skip | `tests_backend/test_junction_parity.py::test_missing_typescript_build_is_a_setup_failure_not_a_skip` + реальный прогон job на CI (лог выше) | Воспроизвёл сам: `python3 -c` с вызовом `frontend_rules(spaces, build_dir=<несуществующий путь>)` → `FileNotFoundError: geometry parity prerequisites are missing: …`, не `pytest.skip`. Старый `test_parity_with_the_frontend_checks` с `pytest.skip(...)` физически удалён (diff подтверждён чтением) |
| AC2: намеренное расхождение одного TS/Python правила красит guard | Мутант `junction-limit-ts-python-parity-drift` в `scripts/mutation-gate.mjs`, guard = `npx tsc -p tsconfig.junction-parity.json && node scripts/fix-test-build.mjs && python3 tests_backend/junction_parity.py --build-dir=test-build/junction-parity` | **Воспроизвёл сам** в отдельном `git worktree` (не в рабочей копии материала): применил патч `MIN_NODE_DISTANCE_CM = 5` → `4`, собрал TS через `tsc -p tsconfig.junction-parity.json`, прогнал `junction_parity.py` — получил `AssertionError: TypeScript/Python geometry parity diverged: {"distance-4": {"typescript": [], "python": ["distance"]}}`, exit code 1. Совпадает буквально с тем, что заявил автор в хендоффе («обнаружено на сценарии distance-4») — я это не переписал с его слов, а получил тем же прогоном независимо. Worktree удалён после проверки, рабочая копия чистая |
| AC3: selection/reuse учитывают обе стороны, fixture, runtime/pins | `test/classify-changes.test.mjs` («#548: parity выбирается по обоим зеркалам…»), `test/check-inputs.test.mjs` («§8.1 представители» + «§8.1 обратная проба») | Прогнал: `node --test test/classify-changes.test.mjs test/check-inputs.test.mjs` — green. Тест на обратную пробу явно проверяет, что `src/houseplan-card.ts` и `custom_components/houseplan/websocket_api.py` НЕ входят в manifest `geometry_parity` |
| AC4: результат CI явно показывает исполненный сценарий, а не только число тестов | Job печатает `geometry parity: N scenarios executed; TS/Python verdicts identical`; `ci-proof.mjs` требует точное имя job `Геометрия: TS/Python parity исполнена` (`JOB_RULES.geometry_parity`) | Подтверждено логом реального прогона (см. выше) — вывод буквально такой |
| Reuse-заявка `geometry_parity` не проходит без верифицированного источника (фикс `b15d357f`) | `test/ci-proof.test.mjs`: «#548: geometry parity reuse is accepted only with a verified source job» | Прогнал: тест сам содержит отрицательную пробу (`reuseRuns: new Map()` → `status === 'failed'`) — воспроизводить руками нечего, тест уже параметризован обоими исходами и я убедился, что оба ветвления присутствуют и осмысленны |

## Проверено чтением, не исполнением

- Точность миграции всех 15 сценариев из старого inline pytest-теста в
  `test/fixtures/junction-limits-parity.json`: построчно сверил каждый кейс
  (включая тонкие — `debris-node` с сырым `-1e-8` в units, `collinear-fork` с
  `units_offset: [0, 1e-9]` поверх `cm`-точки) с оригинальными Python-выражениями
  `cm(...)`/`ray(...)` в удалённом коде `tests_backend/test_junction_limits.py`
  (версия `origin/dev`). Расхождений не нашёл — числа воспроизведены байт-в-байт
  по семантике, не только по количеству кейсов.
- `tsconfig.junction-parity.json` компилирует только `src/junction-limits.ts` как
  root, но TS транзитивно подтягивает и эмитит `space-geometry.ts` через реальный
  import (`import { GRID_STEP_N } from './space-geometry'`) — подтверждено и
  структурой `tsconfig`, и тем, что job реально получает оба файла в
  `test-build/junction-parity/` (лог CI-прогона это показывает: harness падал бы
  на `FileNotFoundError`, если бы `space-geometry.js` не собрался, а он собрался).
- `scripts/fix-test-build.mjs` не менялся содержательно (просто уже обходит всё
  дерево `test-build/` рекурсивно) — новый выходной каталог `test-build/junction-parity/`
  подхватывается без правок скрипта.
- Не тронут `backend`-job (обычный HA pytest) — его `needs`/шаги не изменились;
  требование issue «не возвращать всему backend зависимость от всего UI ради
  одного теста» выполнено буквально: `geometry_parity` — отдельная job с
  `needs: [changes, reuse]`, без зависимости от `frontend`.
- Trailer-дисциплина: оба коммита несут `Issue: #548` и `User-Visible: no`;
  changelog не тронут — корректно, поведение продукта не менялось.
- `process-gate.mjs --issues` — green, единственный WARN ожидаемый
  (инфраструктурный трек без `S*` до первого code-review, что уже не актуально —
  метка `S7-code-review` уже стоит).

## Находки

Нет. High: 0, Medium: 0, Low: 0.

## Чего не проверял и почему

- Полный `npm test` и `npm run build` целиком — не гонял, положился на зелёный
  Validate на точном SHA (https://github.com/Matysh/houseplan-card/actions/runs/34746690349),
  дополнительно прогнав целевой поднабор (129 тестов) руками.
- `python -m pytest tests_backend -q` целиком — в среде ревьюера нет `pytest` и
  нет `.venv-backend` (он провизируется только для облачных агентов). Вместо
  полного прогона: (а) сверил зелёный `backend`-job на предыдущих прогонах ветки
  не требовался для этого диапазона, так как правки в `tests_backend/**` не
  меняют HA-специфичные тесты; (б) вручную выполнил тела обеих новых функций
  `test_junction_parity.py` через `python3 -c` — обе ведут себя как заявлено.
- Полный набор мутантов (`scripts/mutation-gate.mjs` целиком, все ~256 мутантов) —
  не гонял, это ночной/relase-гейт, а не гейт ревью (§8). Один целевой мутант
  (`junction-limit-ts-python-parity-drift`) воспроизведён руками персонально.
- Golden/скриншоты/perf-смоки — diff не касается `src/**`/визуального вывода,
  не применимо.
- `npm run model-invariants` — diff не меняет геометрию, только тестовый
  харнесс поверх неизменных зеркал; неприменимо.

## Вердикт

Зелёный. Задача узкая, полностью в скоупе issue, инфраструктурный трек применён
верно (ни одного файла класса A), все четыре AC issue доказаны — три из них я
лично воспроизвёл (позитивный сценарий на живом CI, негативный сценарий через
собственноручную мутацию в отдельном worktree, классификацию через целевые
юнит-тесты), а не принял со слов автора. Отдельный точечный фикс `b15d357f`
исправляет ровно то, что назвал предыдущий (нерасходующий цикл) прогон Validate,
и сам доказан тестом с положительной и отрицательной ветками.

---

## Материал раунда

- Диапазон: `origin/dev..HEAD`, коммиты `76d8017e`, `b15d357f`.
- SHA материала ревью: `b15d357fa2d9b4596864905008be82c7239f47cf`.
- Дерево рабочей копии на момент подведения итогов совпадает с `git rev-parse HEAD`
  на момент начала разбора — новых коммитов в ходе ревью не появилось.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/548-backend-parity`, коммит `b15d357fa2d9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `e062bddd5488d8aef8049c726d85fedee1ea2a8e`
  ```
  git log --all --format='%H %T' | grep e062bddd5488
  ```
- Тело issue: `583f18e1a114a5eaab171e7394d7c74ddcb51ca9741beb2e9126afefc27f44bb`
- Вердикт конвейера: `green` · High 0
