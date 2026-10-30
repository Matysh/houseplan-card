# CODE-REVIEW-1057-r1

**Issue:** #1057 · **Этап:** code · **Трек:** show · **Заход:** r1 · блокирующих циклов использовано 0 из 2
**Материал:** `5f0bbbd4b2277f54926e451aae2c13e2276d8caf` (tree `d813a41470c8ce09b5f38d32e5ed0613163ad590`)
**Validate-gate:** зелёный, https://github.com/Matysh/houseplan-card/actions/runs/40069224788 (review-light proof is complete)

## Скоуп

Тело issue — не ТЗ, а авто-отчёт планового мутационного прогона `dev@39a3d38c`:
18 из 20 шардов прерваны (cancelled/timeout, не являются доказательством), а
два доведённых до конца шарда (5 и 20) оказались **красными уже на чистой
подготовке**, то есть обычные гарды (`trail-resume-test-guard.mjs`,
`backend-test-guard.mjs issue_495_dropped_route_runs_reach_the_store`) падали
без какой-либо мутации. Явного ТЗ/AC в теле нет — задача на исправление
корневой причины этого красного.

Правка (3 коммита, всё с `Issue: #1057` / `User-Visible: no`):
- `tests_backend/test_trail_recorder.py` — `_load_trails()` вместо ручного
  `importlib.util.spec_from_file_location` + `exec_module` делегирует загрузку
  `trails.py` общему `tests_backend/pure_imports.py::load_pure` (тот же
  примитив, что уже используется для `validation.py`, #394/#398/#465/#389).
- `tests_backend/test_trail_recorder_imports.py` (новый) — параметризованный
  `test_issue1057_loader_restores_module_identity_after_success_or_import_failure[False/True]`:
  наблюдает identity модулей `homeassistant*`/`houseplan*`/`custom_components*`
  до/после `_load_trails()`, один раз в обычном сценарии, один раз с
  инжектированным через `monkeypatch` обычным исключением после того, как
  зависимости `trails.py` уже загружены.
- `docs/DEVELOPMENT.md`, `docs/STATUS.md` — описание механизма и команд
  проверки; `docs/release-ledger/v1.82.0/1057.json` — классификация `infra`;
  `scripts/ci-registry-inventory.json` — регистрация нового файла теста и
  нового release-ledger файла в соответствующих списках.

Единственная поверхность — загрузчик тестов recorder'а (test-only infra),
без изменений продуктового кода `custom_components/houseplan/*`.

## Корневая причина (проверено чтением, не исполнением)

`custom_components/houseplan/trails.py` импортирует `.vacuum_paths`
относительным импортом (резолвится внутри фейковой упаковки `houseplan`,
которую создаёт `_load_trails()`). Но `custom_components/houseplan/vacuum_paths.py:10`
сам делает **канонический абсолютный** импорт:
`from custom_components.houseplan.vacuum_live_tail import project_live`.

В CI, где реальный `homeassistant` установлен, `tests_backend/conftest.py`
**не** подставляет пустышки `custom_components`/`custom_components.houseplan`
(ветка `if not HAS_HA:` — см. `conftest.py:80-91`). Старый `_load_trails()`
временно подменял `sys.modules["homeassistant"]` и `"houseplan"` на фейки, но
в `finally` восстанавливал только имена `homeassistant*`/`houseplan*` —
`custom_components*` не трогались вовсе. Если на момент загрузки
`trails.py` настоящий `custom_components.houseplan.__init__` ещё не был
импортирован, абсолютный импорт из `vacuum_paths.py` инициализировал бы его
**под уже подменённым фейковым `homeassistant`**, и этот испорченный модуль
оставался бы в `sys.modules["custom_components.houseplan"]` после выхода из
`_load_trails()` — ровно то отравление, о котором с 2026 года предупреждает
докстринг самого файла («poisons the real HA harness … it did, once») и о
чём говорит общий докстринг `pure_imports.py` (#389, #398, #465).

Новый `load_pure()` на время `exec_module` подменяет именно
`custom_components`/`custom_components.houseplan` на пустышки с реальным
`__path__` (не позволяя исполниться настоящему `__init__.py`) и гарантированно
восстанавливает оригинальные объекты по identity в `finally` — включая путь
после исключения. Это устраняет найденный механизм поломки, не трогая
поведение продукта.

Других мест, где тест грузил бы файл с тем же абсолютным импортом в обход
`pure_imports`, не нашёл: `grep` по `vacuum_paths|vacuum_live_tail|
vacuum_path_collector|vacuum_ecovacs_reader` в `custom_components/houseplan/*.py`
даёт только `trails.py`, `vacuum_ecovacs_websocket.py`, `vacuum_path_collector.py`,
`websocket_api.py` — ни один из остальных `spec_from_file_location`-загрузчиков
в `tests_backend/*.py` (`test_backend_quality.py`, `test_config_schema_manifest.py`,
`test_conftest_harness_notice.py`, `test_contact_basis.py`,
`test_frontend_assets.py`, `test_projection.py`, `test_validation.py`,
`test_virtual_lights.py`) эти файлы не загружает.

## Как проверялось

| Проверка | Команда | Результат |
|---|---|---|
| Validate-gate материала | принятый proof, run 40069224788 | зелёный, переиспользован без повтора |
| Pure pytest recorder + imports + trails | `python3 -m pytest tests_backend/test_trail_recorder.py tests_backend/test_trail_recorder_imports.py tests_backend/test_trails.py -q` | 83 passed; честная строка `HA harness NOT collected: 31 files (527 tests)` присутствует |
| Новый тест, оба параметра | `python3 -m pytest tests_backend/test_trail_recorder_imports.py -v` | `[False]` и `[True]` оба PASSED — обычный negative-input case (инжектированное исключение после загрузки зависимостей) встроен в сам тест, отдельного мутанта не требуется |
| Named guard #1 из DEVELOPMENT.md | `PYTHON=python3 node scripts/trail-resume-test-guard.mjs` | `7 passed, 74 deselected`, exit 0 |
| Named guard #2 из DEVELOPMENT.md | `PYTHON=python3 node scripts/backend-test-guard.mjs issue_495_dropped_route_runs_reach_the_store tests_backend/test_trail_recorder.py` | `1 passed, 45 deselected`, exit 0 |
| Число "pure backend" в STATUS.md | `node scripts/inventory.mjs` | выдаёт `627`, совпадает с `docs/STATUS.md`; один источник числа — генератор, не ручная правка |
| Регистрация файлов | чтение `scripts/ci-registry-inventory.json` | `test_trail_recorder_imports.py` и `docs/release-ledger/v1.82.0/1057.json` добавлены в соответствующие списки |
| Трейлеры коммитов | `git log origin/dev..HEAD` | все 3 коммита несут `Issue: #1057`; `User-Visible: no` — корректно, правка только test-infra/docs, видимого пользователю поведения нет |
| Release-ledger классификация | чтение `docs/release-ledger/v1.82.0/1057.json` | `category: infra` обоснована — только тестовая инфраструктура, продуктовый код не менялся; в пользовательский milestone не входит |
| Корневая причина (защитный AC — восстановление identity при отказе) | чтение `pure_imports.py::load_pure`, `trails.py:10` (`vacuum_paths` import), `conftest.py:80-91` | проверено чтением, не исполнением: механизм отравления `custom_components*` воспроизведён логически, закрыт инструментом `load_pure` |

### Чем краснеет (защитный AC)

AC — «loader восстанавливает identity модулей после успеха и после отказа,
не оставляя временные HA/alias/canonical имена в `sys.modules`».

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| Восстановление identity после успешной загрузки | `test_issue1057_loader_restores_module_identity_after_success_or_import_failure[False]` | обычный negative case не требуется — ассерт `after.keys() == before.keys()` и `after[name] is module` сработает на любой реальной утечке |
| Восстановление identity после отказа импорта | `test_issue1057_loader_restores_module_identity_after_success_or_import_failure[True]` | обычный отрицательный случай встроен в сам тест: `monkeypatch` заставляет `exec_module` упасть `RuntimeError` после того, как `houseplan.trails` уже выполнен — тест проверяет, что даже в этом случае `sys.modules` не отравлен |
| Старая реализация действительно текла (историческая причина #1057) | проверено чтением кода (см. раздел «Корневая причина»); воспроизведение отката старого `_load_trails()` не делал — это был бы патч тестовой «реализации»/гарда с прогоном, что запрещено вне ночного workflow | — (ordinary witness не требовался: причинно-следственная связь прослежена по коду без исполнения мутанта) |

## Что проверено и корректно

- Единственная поверхность: тестовый загрузчик recorder'а; продуктовый код
  (`custom_components/houseplan/**`) не тронут.
- Старый путь (`spec_from_file_location`+`exec_module` вручную) полностью
  удалён, а не оставлен как второй параллельный путь — находки «оставлен
  старый путь» нет.
- `docs/STATUS.md`/`docs/DEVELOPMENT.md` синхронизированы с фактическим
  состоянием (число тестов, команды), без расхождения источников.
- Трейлеры `Issue`/`User-Visible` на месте на всех трёх коммитах;
  `User-Visible: no` корректно, т.к. изменение не видно пользователю.
- `route`-критерии §5 для трека `show`: сложность низкая (точечный рефактор
  загрузчика + один новый тестовый файл), поверхность одна, миграции нет,
  нового UX-контракта нет, производительности/touch не касается, ожидаемое
  поведение зафиксировано в `pure_imports.py`/`DEVELOPMENT.md` этим же диффом
  — всем критериям соответствует, `route: fix`.

## Чего не проверял

- **Комбинированный прогон с реальным HA** (`pytest tests_backend/test_trail_recorder.py
  tests_backend/test_trail_recorder_imports.py tests_backend/test_trails.py
  tests_backend/test_ha_setup.py` под `PYTHON`, указывающим на HA-окружение) —
  именно тот сценарий, который воспроизводит исходное отравление namespace
  из отчёта. В песочнице ревью Python 3.12, а
  `pytest-homeassistant-custom-component==0.13.357` требует Python ≥3.13 —
  установить реальный HA здесь нельзя (та же инфраструктурная граница, что и
  всегда у локального/sandbox окружения, см. `tests_backend/requirements.txt`
  и предупреждение `conftest.py` про `HA harness NOT collected`). Это не
  вина диффа — компенсировано разбором механизма по коду выше (раздел
  «Корневая причина», отмечен как «проверено чтением, не исполнением»).
- Полный ночной мутационный прогон (тот самый, что был `cancelled`/`red`) —
  не гейт ревью, а предрелизный/ночной гейт; не перезапускал.
- Фронтенд/`npm test`/`tsc`/`gate:small` целиком — диффа во фронтенде нет,
  validate-gate материала уже зелёный и переиспользован; отдельного
  фронтенд-риска в этом диффе не вижу.
- Полную матрицу `node scripts/smoke-select.mjs` не прогонял — дифф не
  затрагивает геометрию/рендер/UI, адресной связи со смоуками нет.
- `npm run invariants` — дифф не меняет геометрию модели.

## Побочные находки

Побочных находок нет. Маршрут публикации — `mode=issues` (снимок политики
подтверждён), но заводить новые issue не потребовалось.

## Вердикт

Корневая причина красных шардов 5/20 идентифицирована и устранена точечно,
без побочных изменений продукта; новый тест — не бухгалтерия (не просто
регистрация), а содержательная защита identity-инварианта с собственным
встроенным отрицательным случаем; трейлеры, release-ledger и счётчики
документации согласованы. High/Medium в скоупе не найдено.

**Вердикт: зелёный · заход r1 · блокирующих циклов 0/2 · High: 0 · Medium: 0 → в задаче**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1057-isolate-trail-loaders`, коммит `5f0bbbd4b227` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `d813a41470c8ce09b5f38d32e5ed0613163ad590`
  ```
  git log --all --format='%H %T' | grep d813a41470c8
  ```
- Тело issue: `dd9eb037caf47d187b887e8cddacbdf0b6460c116571fe3b027789b2ac153126`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwOTgsIm91dHB1dF90b2tlbnMiOjE1LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTczMDAwMDAwMDAwMDAwNX0seyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTYsIm91dHB1dF90b2tlbnMiOjI4MDk5LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEwMzE3OCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjI0Nzg2NTUsImNvc3RVc2RFc3RpbWF0ZSI6MS4xODk1NDV9XSwidHVybnMiOjQzLCJkdXJhdGlvbk1zIjo0MTEyNzEsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjE5NDcxODAwMDAwMDAwMDIsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5154 output_tokens=28114 cache_creation_input_tokens=103178 cache_read_input_tokens=2478655 num_turns=43 -->
