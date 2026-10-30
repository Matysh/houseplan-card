# CODE-REVIEW — issue #1028, заход r1

Материал: `64e19e6f29895f581dd186d83047fbcfabb8dbd0` (ветка
`issue/1028-room-opening-host-smoke`, база `origin/dev` =
`df1452d821e0618075639b764f28f2c4c203836c`). Трек `show`. Блокирующих
циклов израсходовано 0 из 2 (предыдущий отказ на `7cdc84d67` был
механической подготовкой — модель не вызывалась, цикл не списан).

## Скоуп

Инфраструктурная задача (класс B/C по PROCESS.md §1, без S1–S6): Windows
native-прогон `node demo/smoke_room_opening_host.mjs` падал по таймауту
первого `settleWrites(1)` после удаления комнаты, потому что exposed
browser-oracle жёстко вызывал `python3`, а на машине владельца есть только
`python`. Ошибка `spawnSync … ENOENT` ловилась продуктовым путём ошибки
записи config/set и превращалась в посторонний 30-секундный таймаут.

Правка (`demo/smoke_room_opening_host.mjs`):
- выбор интерпретатора вынесен в общую функцию `proveRoomOpeningHost`,
  используемую и preflight-вызовом, и exposed-oracle браузера — один
  источник правды вместо дублирования;
- порядок выбора `PYTHON` → (`win32`: `.venv-ci/Scripts/python.exe`, если
  существует, иначе `python`) → (POSIX: `python3`) дословно повторяет уже
  принятый паттерн `demo/smoke_vacuum_route_recovery.mjs` (сверено
  построчно — идентичен);
- перед запуском Chromium скрипт один раз прогоняет тот же Python-мост на
  неизменном seed (`config: seed, previous: seed`) и ждёт
  `{ ok: true, code: null }`; при отказе бросает `Error` с именем
  использованного интерпретатора и исходной `cause` — диагностика видна
  сразу, браузер не открывается;
- явный, но нерабочий `PYTHON` не подменяется — используется как есть и
  проваливается с прямой причиной (соответствует требованию issue «не
  подменять случайным интерпретатором»).

`docs/DEVELOPMENT.md` описывает этот порядок выбора и преflight отдельным
абзацем; `docs/release-ledger/v1.82.0/1028.json` классифицирует изменение
как `infra` с обоснованием относительно `v1.82.0` — корректно: продукт
(`src/**`, `custom_components/`) не тронут, меняется только тестовая
инфраструктура и документация. `baseStable` совпадает с текущим
`package.json.version` (1.82.0).

Продуктовый код, бэкенд-оракул (`demo/helpers/partition-host-oracle.py`),
фикстура (`test/fixtures/996-room-opening-host.json`), геометрия кликов,
Undo/Redo-ассерты и подсчёт «12 physical transitions» не изменены — сверено
построчным диффом.

## Как проверялось

| Гейт | Статус | Примечание |
|---|---|---|
| Validate (CI) на `64e19e6f2` | ✅ не перегонялся | success, https://github.com/Matysh/houseplan-card/actions/runs/39839357599 — покрывает `tsc --noEmit`, `npm test`, `npm run build` + `bundle-policy --verify` на этом SHA (#343) |
| `node scripts/smoke-select.mjs --base df1452d82… --head 64e19e6f2` | ✅ прогнан | «Исполняемого frontend-диффа нет… Browser-smoke этим диффом не выбираются» — ожидаемо для B/C-диффа без `src/**` |
| `node demo/smoke_room_opening_host.mjs` (назван в AC1/AC2), позитивный путь, Linux, `python3` в PATH, без `PYTHON` | ✅ прогнан лично | после `npm run bundle:sync` (`dist` отсутствовал в рабочей копии) — `OK`, exit 0; все 12 переходов и промоушен-пруф пройдены, preflight не исказил счётчик |
| AC3, обычный отрицательный вход: `PYTHON=/nonexistent/missing-python node demo/smoke_room_opening_host.mjs` | ✅ прогнан лично | exit 1 за 0.45 с, `Error: Room-opening host Python oracle failed (/nonexistent/missing-python); set PYTHON to a working Python interpreter.`, cause `ENOENT`; браузер не запускался, таймаута 30 с не было — защитный AC доказан исполнением обычного негативного случая на неизменённой реализации (без мутанта и без правки продукта/смоука ради проверки) |
| Нативный Windows-прогон с реальным `.venv-ci/Scripts/python.exe`-ветвлением | ⬜ не проверял | ревью выполняется на Linux-раннере; ветка `win32 && existsSync(localPython)` логически идентична уже работающему коду `demo/smoke_vacuum_route_recovery.mjs` (дословное совпадение), отдельно не переисполнялась |
| `golden:verify` | — не применимо | диф не трогает рендер/геометрию |
| `npm run invariants` | — не применимо | геометрия модели не менялась |
| `pytest tests_backend` | — не применимо | Python-оракул (`partition-host-oracle.py`) не менялся |
| Трейлеры | ✅ проверено | оба коммита (`7cdc84d67`, `64e19e6f2`) несут `Issue: #1028` и `User-Visible: no` — корректно, видимое поведение продукта не меняется, changelog не требуется |

«Чем краснеет» для защитного AC3:

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC3 (ошибка окружения: явный отсутствующий `PYTHON` даёт прямую диагностику до открытия браузера, без 30с и без fallback) | исполнением обычного негативного случая (см. таблицу выше) | обычный отрицательный вход `PYTHON=<несуществующий путь>`, результат — exit 1 за 0.45 с с прямой причиной ENOENT, воспроизведено лично в этом раунде |

AC1 и AC2 — позитивные сценарии, доказаны исполнением того же именованного
смоука (эта сессия воспроизвела Linux-ветвь с нуля; Windows-ветвь — чтением
кода, идентичного уже работающему паттерну, запись «проверено чтением, не
исполнением» для Windows-специфичной ветки `.venv-ci/Scripts/python.exe`).

## Маршрут (§5)

- `complexity` ≤3 — да, локальная правка выбора интерпретатора и
  преflight в одном demo-скрипте.
- `surfaces` — одна поверхность: смоук `demo/smoke_room_opening_host.mjs`.
- `migration` — нет изменений конфигурации/compatibility-полей.
- `ux-contract` — нет, `User-Visible: no`, продукт не тронут.
- `perf-touch` — не затронуто.
- `undocumented` — поведение зафиксировано однозначно в самом теле issue
  (точный порядок выбора интерпретатора процитирован из уже принятого
  паттерна `demo/smoke_vacuum_route_recovery.mjs`) и задокументировано в
  `docs/DEVELOPMENT.md` этим же диффом.

Все критерии §5 пройдены → `route: fix`.

## Находки

Нет. High: 0, Medium: 0.

## Что проверено и корректно

- Причинно-следственная цепочка «ENOENT → отказ config/set → ложный 30с
  таймаут» воспроизведена и устранена именно там, где заявлено (до
  `launch()`), без ослабления backend-оракула, геометрии кликов или
  подсчёта принятых переходов.
- Preflight-вызов не попадает в массив `accepted` (пушится только внутри
  `installOracle`'s exposed-функции) — финальная проверка «all 12 physical
  transitions» не искажена, подтверждено чтением и исполнением.
- Явный ошибочный `PYTHON` не подменяется автоматическим fallback —
  подтверждено и чтением кода, и исполнением.
- Трейлеры и классификация release-ledger (`infra`, обоснование
  относительно `v1.82.0`) корректны для чисто инфраструктурного изменения.
- Побочных находок вне скоупа нет (`REVIEW_FINDINGS_POLICY`: `mode=issues`
  — маршрут не понадобился, отдельных issue не заводил).

## Чего не проверял

- Нативный Windows-прогон с реальным `.venv-ci/Scripts/python.exe` по
  месту (ревью — на Linux-раннере); эта ветка не исполнялась, только
  прочитана и сверена построчно с идентичным уже работающим кодом
  `demo/smoke_vacuum_route_recovery.mjs`.
- Полную релизную smoke/golden-матрицу и HA-harness — не требуются этим
  диффом (не тронуты Python-бэкенд и geometрия/рендер).
- Повторный прогон `tsc --noEmit` / `npm test` / `npm run build` —
  опирается на зелёный Validate этого же SHA (#343), не перегонял.

## Маршрут побочных находок

`mode=issues` (снимок `REVIEW_FINDINGS_POLICY` совпадает с переданным в
промпте); побочных находок нет, новые issue не заводились.

## Вердикт

Зелёный. AC1–AC3 доказаны: позитивный путь исполнением на этой машине,
Windows-специфичная ветка — чтением (идентична уже работающему коду),
защитный AC3 — исполнением обычного негативного случая. Продукт не
тронут, трейлеры и release-ledger корректны.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1028-room-opening-host-smoke`, коммит `64e19e6f2989` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `4a1edc4bfab5c89cffff3127ac4ccb91d9326661`
  ```
  git log --all --format='%H %T' | grep 4a1edc4bfab5
  ```
- Тело issue: `8e6b9afefa807932ec16b5d87ab9d74df4076358130f33c9c8655daf1b24d647`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxMDYsIm91dHB1dF90b2tlbnMiOjE5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjAxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo0Niwib3V0cHV0X3Rva2VucyI6MTY0MjEsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6NzI1NTMsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjoxNTg5NDU3LCJjb3N0VXNkRXN0aW1hdGUiOjAuNzcyNDA1NDAwMDAwMDAwMn1dLCJ0dXJucyI6MzYsImR1cmF0aW9uTXMiOjI3Mzg0MiwiZmluaXNoUmVhc29uIjoic3VjY2VzcyIsIm91dGNvbWUiOiJzdWNjZXNzIiwicHJvdmlkZXJDb3N0VXNkRXN0aW1hdGUiOjAuNzc3NjA2NDAwMDAwMDAwMywiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5152 output_tokens=16440 cache_creation_input_tokens=72553 cache_read_input_tokens=1589457 num_turns=36 -->
