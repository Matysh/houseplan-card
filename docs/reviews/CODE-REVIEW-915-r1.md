# CODE-REVIEW-915-r1

**Issue:** #915 · **Этап:** code · **Трек:** show · **Заход:** r1 · блокирующих циклов 0/2
**Материал:** `2e1c22cd288fa8681ccaf8e138755293ab5ce022` (ровно вершина ветки на момент ревью)

## Скоуп

Задача класса B: CI ветки `main` покраснел после #914, т.к. новый
`.github/FUNDING.yml` (метаданные кнопки GitHub Sponsor) не был
классифицирован ни как чей-то вход Validate, ни как явный не-вход. Исправление
точечное: один `glob`-литерал в `NOT_AN_INPUT` (`scripts/check-inputs.mjs`),
два юнит-теста на этот случай и соседние негативные случаи
(`test/check-inputs.test.mjs`), запись в `docs/DEVELOPMENT.md` и
`docs/STATUS.md`, классификация релиза `docs/release-ledger/v1.80.1/915.json`.
Продуктовый код и кнопки Boosty не трогаются — соответствует границам
исправления из тела issue.

Отношение к `docs/SCOPE.md`: сама задача не закрывает пользовательскую Core
job — это починка инфраструктуры CI (поддержание зелёного Validate), что
прямо названо в теле issue как класс B, без продуктовых файлов; это
согласуется с `docs/release-ledger/.../915.json` → `category: infra`.

Диапазон `git log --oneline origin/dev..HEAD`: один коммит
`2e1c22cd fix(ci): classify GitHub funding metadata as a non-input`.
`git diff --stat`: 5 файлов, только docs + `scripts/check-inputs.mjs` +
`test/check-inputs.test.mjs`, без `src/**`, без Python — риск минимален.

## Маршрут вердикта (§5 критерий трека show)

- **complexity** — один `glob`-литерал + 2 юнит-теста; сложность/риск ≤ 1.
- **surfaces** — одна поверхность: модуль `scripts/check-inputs.mjs` и его тест.
- **migration** — нет миграции конфига, нет новых compatibility-полей.
- **ux-contract** — нет видимого пользователем поведения, UI не тронут.
- **perf-touch** — не затрагивает производительность/touch.
- **undocumented** — поведение зафиксировано тем же коммитом в
  `docs/DEVELOPMENT.md` (раздел «GitHub funding metadata…», #915) и в AC1–AC3
  тела issue; способ, которым `.github` и YAML уже охраняются — существующий
  канон того же файла (`EXECUTABLE_ROOTS`, `NOT_AN_INPUT`).

Все пункты проходят → `route: fix`.

## Как проверялось

| Гейт | Статус | Примечание |
|---|---|---|
| Validate на точном SHA `2e1c22cd` | ✅ зелёный (ссылка в задаче ревью: run 38851038323) | принят по ссылке (#343) как базовое подтверждение |
| `node --test test/check-inputs.test.mjs` (точечно) | ✅ 27/27, включая оба новых `#915 AC1`/`#915 AC2` и неизменившийся `§5.5 лист покрытия` | прогнан локально в этом ревью |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | ✅ «Исполняемого frontend-диффа нет… смоки не выбираются» | детерминированный ответ, не «НЕОПРЕДЕЛЁННОСТЬ»; `src/**` не тронут |
| `npm run gate:small` (полный) | ✅ прогнан локально до конца: сборка+typecheck 28с, no-new-any, no-new-private-writes, smoke-select, юниты (`npm test`) 217с, bundle-policy --verify, бюджет бандла, lint:unused — итого 252с, упало 0 | дополнительно к уже зелёному Validate на этом SHA; напрямую подтверждает typecheck/build/весь unit-сьют/bundle-policy, не только по ссылке |
| pytest `tests_backend` | не прогонялся | диффом не затронут ни один Python-файл |
| `npm run invariants` | не прогонялся | геометрия/модель не затронуты |
| golden / performance_smoke / geometry_parity | не прогонялись | `ci:golden` не установлена, рендер-путь и геометрия не тронуты, AC их не называет |

## AC — доказательство и «чем краснеет»

| AC | Чем доказан | Чем краснеет (защитный AC) |
|---|---|---|
| AC1: funding-файл — не вход, `coverage`/`checksAffectedBy` его не поднимают | `test/check-inputs.test.mjs:447-460`, исполнен, PASS | Без строки `['.github/FUNDING.yml', …]` в `NOT_AN_INPUT` (scripts/check-inputs.mjs:93) `isDeclaredNotAnInput(funding)` вернёт `false` → `report.unknown` в этом же тесте перестанет быть `[]` и `assert.deepEqual(report.unknown, [])` упадёт; `affected.affected.size` перестанет быть `0` (подключится полный fallback). Проверено чтением кода `coverage`/`checksAffectedBy` (scripts/check-inputs.mjs:452-478), не исполнением мутанта |
| AC2: соседние неизвестные `.github/*.yml`/`workflows/FUNDING.yml` остаются guarded | `test/check-inputs.test.mjs:462-479`, исполнен, PASS: `isDeclaredNotAnInput` для них `false`, `coverage().unknown` включает все три, `checksAffectedBy` расширяет до всех проверок | Если бы исключение в `NOT_AN_INPUT` было оформлено глобом шире точного пути (например `.github/*.yml` или `.github/**`), `isDeclaredNotAnInput` для `OTHER.yml`/`FUNDING.yaml`/`workflows/FUNDING.yml` стало бы `true`, и `assert.ok(!isDeclaredNotAnInput(file), file)` в этом же тесте упало бы. Запись фактически точный литерал (`globToRegExp` эскейпит `.`, не добавляет `*`) — проверено чтением diff и `globToRegExp` (scripts/check-inputs.mjs:99-114), тест это же утверждение уже прогоняет и проходит |
| AC3: `check-inputs` suite, `--coverage`, `gate:small` зелёные на материале | `node --test test/check-inputs.test.mjs` — 27/27 зелёный; `--coverage`-эквивалент входит в тест `§5.5`/CLI-тест (`test/check-inputs.test.mjs:501-511`, тоже PASS); полный `npm run gate:small` — зелёный, прогнан в этом ревью целиком (252с, упало 0) | не защитный AC (процессный), таблица «чем краснеет» не обязательна |

## Что проверено и корректно

- `NOT_AN_INPUT` запись — точный путь `'.github/FUNDING.yml'`, не директория и не
  маска: `globToRegExp` оставляет `.` буквальной точкой и не трогает путь
  регэкспом-маской — расширение не затронуто, риск ограничен ровно файлом
  Sponsor-кнопки, как и требуют границы исправления в issue.
- Новые тесты строят путь через `p('.github', 'FUNDING.yml')` из кусков, а не
  литералом — так же, как остальной файл (`test/check-inputs.test.mjs:18-22`,
  `264-278`), чтобы сам тестовый файл не стал неявным «читателем» funding-пути
  и не исказил `MANIFEST.frontend`; подтверждено чтением остального файла —
  приём системный, не изобретён для этой задачи.
- Тесты AC1/AC2 используют синтетический `tracked`/`manifest` (не живой
  `MANIFEST`/`trackedFiles(ROOT)`), потому что `.github/FUNDING.yml`
  физически отсутствует в `dev`/материале этой ветки (проверено: `git ls-tree
  origin/dev -- .github/FUNDING.yml` и `git ls-tree HEAD -- .github/FUNDING.yml`
  — пусто, файл есть только в `origin/main`). Это соответствует комментарию в
  самом тесте и реальному положению дел, а не фиктивному обходу.
  Общий `§5.5 лист покрытия` на реальном дереве (без funding-файла) по-прежнему
  зелёный, новое исключение не создаёт `declaredButCovered`-находки, т.к. под
  него на этом дереве ничего не попадает — подтверждено исполнением теста.
- `docs/release-ledger/v1.80.1/915.json` — ровно по образцу существующих
  `infra`-записей (`638.json`, `674.json`, `905.json`): schema 1, `baseStable:
  v1.80.1` (сверено с `docs/release-ledger/cycle.json` — это актуальный
  предыдущий stable), `category: infra`, обоснование по смыслу совпадает с
  телом issue. `introducedBy` не нужен — это не правка бета-функции.
- Коммит несёт трейлеры `Issue: #915` и `User-Visible: no`; при `no`
  changelog RU/EN не требуется и не менялся — соответствует заявленному в
  issue «пользовательский changelog не меняется».
- `docs/DEVELOPMENT.md`/`docs/STATUS.md` формулировки точно описывают код:
  явный литерал, не весь `.github`, не всё YAML; соседние guard-кейсы
  остаются красными до явного исключения — проверено построчным сопоставлением
  с diff `scripts/check-inputs.mjs`/`test/check-inputs.test.mjs`.
- Число "27 тестов, 0 упавших" в этом документе имеет один источник — вывод
  `node --test test/check-inputs.test.mjs`, прогнанный в этом ревью; число
  "252с, упало 0" — один источник, вывод `npm run gate:small` этого же ревью;
  ни одно не дублируется другим числом в диффе.

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне его.

## Чего не проверял

- `pytest tests_backend` — не прогонялся: диффом не затронут ни один
  Python-файл.
- `npm run invariants` — не прогонялся: геометрия/модель не затронуты.
- golden / performance_smoke / geometry_parity — не прогонялись: метка
  `ci:golden` не установлена, рендер-путь и геометрия диффом не задеты, AC их
  не называет.
- Ручная/браузерная проверка CI на `main` после переноса фикса («Доставка
  после ревью» в теле issue) — вне скоупа этого ревью: это последующий шаг
  доставки, который владелец выполнит отдельно и которым прямо сказано не
  обуславливать допуск в `dev`.
- Не проверял реальное поведение `.github/FUNDING.yml` на `main` исполнением
  Validate там — файла нет в материале этой ветки, он придёт туда отдельно;
  это согласуется с комментарием в самом тесте и не является пробелом этого
  ревью.

## Вердикт

Зелёный. AC1–AC3 доказаны автотестами (точечный прогон `check-inputs` suite и
полный `gate:small` — оба зелёные, прогнаны целиком в этом ревью), оба
защитных AC сопровождены строкой «чем краснеет» с объяснением, какой
код/глоб привёл бы к падению конкретного уже исполняемого assert. Границы
исправления соблюдены (точный путь, не директория/маска), документация и
release-ledger согласованы с кодом и между собой, трейлеры на месте. Находок
нет.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/915-funding-input-coverage`, коммит `2e1c22cd288f` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `cad7e3af144ecef881b5eb0bc75bc0a0c8494718`
  ```
  git log --all --format='%H %T' | grep cad7e3af144e
  ```
- Тело issue: `ebac531c8cefdb8bb770e4c720f1e800ce4dba43a7ce73090da770ca1261ee4d`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4ODcsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTYyfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5MCwib3V0cHV0X3Rva2VucyI6Mjg1NTQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTQ0MDc2LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDU0MDQxMSwiY29zdFVzZEVzdGltYXRlIjoxLjc3MDEwNjE5OTk5OTk5OTl9XSwidHVybnMiOjUzLCJkdXJhdGlvbk1zIjo0NzM3MDgsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjc3NTA2ODE5OTk5OTk5OTgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=4977 output_tokens=28569 cache_creation_input_tokens=144076 cache_read_input_tokens=4540411 num_turns=53 -->
