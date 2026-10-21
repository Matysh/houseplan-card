# CODE-REVIEW-996-r1

## Якоря материала

- Issue: #996 · этап `code` · заход r1 · трек `track:ask` · блокирующих циклов израсходовано 0 из 4
- Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`
- SHA: `f89ee2ef646992d7bd4cf3765c445a10b026bfde` (совпадает с `git rev-parse HEAD`
  на момент написания документа)
- Коммиты диапазона: `c284dafb1` (fix, User-Visible: yes), `97213f5d2` (test,
  User-Visible: no), `f89ee2ef6` (fix, User-Visible: no) — все с трейлером
  `Issue: #996`.
- Доверенный снимок политики побочных находок: `mode=issues` (см. раздел
  «Побочные находки»).

## Скоуп ревью

ТЗ (тело issue, раздел `## ТЗ`) требует узкое доказуемое исключение из запрета
`partition→wall` для обычного `config/set`: один и тот же физический носитель
(та же ось, толщина, ID), полностью консумированный комнатой, может обратно
стать независимой стеной без привилегированного клиентского флага — ровно
столько, сколько нужно для Undo/Redo и повторного создания комнаты после
«Удалить комнату, оставить стены». Import и Optimize свои текущие политики не
меняют. Закрывает J6 `docs/SCOPE.md` (сохранность плана при эволюции дома).

Риск по изменённым участкам (#707):
- **migration** (`validation.py:25-27,719-720,+19`) — это модуль, который
  обычно отвечает за схему/миграцию; фактическая правка — новый импорт, новая
  сигнатура `allow_room_wall_promotion` и ветка `same_wall` внутри
  `validate_partition_opening_hosts`. ТЗ §«Модель данных и миграция» прямо
  фиксирует «нет новых полей и миграции, v10 остаётся v10»; прочитано кодом —
  действительно нет изменений схемы/версии. AC этого класса закрывают AC1–AC4
  (функциональный контракт самой функции).
- **devices** (`websocket_api.py:1967-1969`) — это точка вызова общего CPU-
  валидатора `config/set`, который также проверяет маркеры/устройства; правка
  — только добавление kwarg `allow_room_wall_promotion=True`, маркерные/
  device-валидаторы выше по тексту не тронуты. AC по устройствам не
  заявлялось; регрессия исключена прогоном полного `pytest tests_backend`
  (ниже) — все существующие marker/device-тесты зелёные.

Оба класса покрыты: migration — ТЗ §«Модель данных», devices — отсутствием
изменений в соседних валидаторах + зелёным полным backend-прогоном.

## Как проверялось

Прочитаны требуемые источники роли (`docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md`
§1–§12 по ссылкам `docs/process/REVIEWER.md`, `docs/STATUS.md`) и
канонические документы подсистемы: `docs/WALL-THICKNESS.md`,
`docs/CONFIG-COMPATIBILITY.md`. Прочитан `docs/reviews/SPEC-REVIEW-996-r1.md`
(спек уже прошёл зелёным, материал кода — отдельный SHA).

Полностью прочитан весь дифф (`git diff origin/dev...HEAD`, 23 файла, +1597/-9):
- `custom_components/houseplan/partition_promotion.py` (новый модуль, 98
  строк) — чистая функция `same_partition_wall_promotion` построчно.
- `custom_components/houseplan/validation.py` — сигнатура, новая ветка
  `same_wall`, docstring.
- `custom_components/houseplan/websocket_api.py` — единственная точка вызова
  с `allow_room_wall_promotion=True`; проверено чтением, что `node_move`
  (:2110), `optimize` (:2591) и `import_export.py:1664` этот флаг НЕ
  передают — ровно то, что требует п.5 контракта.
- `demo/helpers/partition-host-oracle.py`, `demo/smoke_room_opening_host.mjs`,
  `test/helpers/room-opening-host-fixture.mjs`, `test/room-opening-host.test.mjs`,
  `tests_backend/test_room_opening_host.py`, `tests_backend/test_ha_room_opening_host.py` —
  построчно.
- Документация: `docs/ARCHITECTURE.md`, `docs/CONFIG-COMPATIBILITY.md`,
  `docs/WALL-THICKNESS.md`, `docs/USER-GUIDE.ru.md`, `docs/DEVELOPMENT.md`,
  `docs/STATUS.md`, `docs/CHANGELOG.md`/`.ru.md`,
  `docs/release-ledger/v1.81.0/996.json` — построчно, сверено с кодом.
- `scripts/mutation-registry.mjs`, `scripts/ci-registry-inventory.json`,
  `test/fixtures/845-wall-corpus-identities.json` (регистрация, не
  поведение).

### Разбор `same_partition_wall_promotion` (ключевой защитный код)

Прослежена каждая проверка контракта п.2 ТЗ до строки кода:
- тот же непустой ID, `kind: partition → wall` — `old_host.get("id") == host.get("id")`,
  `not old_host.get("id")` отбрасывает пустой ID.
- отсутствие выжившей одноимённой независимой стены и принадлежность комнате —
  вынесено в `validate_partition_opening_hosts` (`host.get("id") not in partitions`,
  `host.get("id") in room_wall_ids`), не в чистую функцию — разделение
  обосновано (функция не видит соседние коллекции без явной передачи).
- неупорядоченная пара концов с допуском — `_point_equal` в обеих ориентациях
  `(("a","b"),("b","a"))`.
- толщина строго равна и положительна — `cm == float(wall["cm"])`, `cm > 0`,
  `math.isfinite`.
- сохранение ID/типа/длины/настроек проёма — `_same_json_fields` по всем
  полям, кроме `{host,x,y,angle}`; включает `length` и `type` (оба покрыты
  AC3-тестами `length`/`type`).
- центр/направление/длина до-после и `t` по новой оси, проём помещается в
  стену — `_geometry()` пересчитывает из оси+t+length с проверкой
  принадлежности отрезку; `_angle_equal` по модулю 180°; отдельная проверка
  `_angle_equal(angle, new[2])` ловит рассинхронизированное поле `angle`
  кандидата, даже когда оно исключено из `_same_json_fields`.
- JSON-типы: `_same_json_fields` отдельно отличает `bool` от числа (коммит
  `f89ee2ef6` закрыл именно этот зазор — без него Python `True == 1` склеил
  бы булево будущее поле с числовым и пропустил бы подмену семантики),
  сохраняя легитимный JS-круговорот `1.0 → 1`.
- allow-list `_WALL_KEYS = {id,a,b,cm}` на `partition`/`wall`: сегодня
  продуктовый код действительно не кладёт в `wall_segments`/`partitions`
  ничего, кроме этих четырёх полей (`src/wall-segment-model.ts:796`,
  `src/houseplan-editor-runtime.ts:2598`) — схема при этом `extra=ALLOW_EXTRA`
  и формально допускает будущие поля. Отказ при незнакомом поле —
  осознанно консервативное поведение, покрыто тестом `future-wall-field` /
  `future-partition-field` (AC3); если будущая версия легитимно добавит поле
  в wall/partition, эту allow-list придётся расширить вместе с ней — не
  находка сейчас, честно отмечаю как технический долг на будущее.

### «Чем краснеет» — защитный AC3

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC3 (Python) | `tests_backend/test_room_opening_host.py::test_issue_996_ordinary_promotion_rejects_changed_carrier_or_opening` — 22 параметризованных мутации (id/geometry/thickness/t/type/contact/future-fields/foreign-space/partial-carrier и т.д.) | обычный отрицательный тест-кейс внутри самого теста: `pytest.raises(PartitionOpeningHostError, match="host changed")`; прогнан лично — 333 passed, 1 skipped в `test_room_opening_host.py`+`test_validation.py` |
| AC3 (HA) | `tests_backend/test_ha_room_opening_host.py::test_issue_996_unsafe_promotion_never_changes_store_or_revision` — 6 мутаций через реальный WS-writer | обычный отрицательный кейс, `refused["error"]["code"] == "invalid_partition_opening_host"` + неизменность durable store; прогнан лично в HA-harness — 10 passed |
| AC3 (мутанты) | `scripts/mutation-registry.mjs`: `room-promotion-coerces-json-booleans-to-numbers`, `room-promotion-rejects-safe-restoration`, `room-promotion-ignores-carrier-thickness` | зарегистрированы (`--check` зелёный), **не исполнялись** — не ночной workflow; это дополнительные, не единственные свидетели, основной caught-результат уже дан обычными негативными тестами выше |

Третий столбец непустой и подтверждён исполнением, а не заявлением — честный
разбор по общей политике («Отрицательные проверки и мутанты»): мутанты
зарегистрированы и не запускались, но для «чем краснеет» этого достаточно,
поскольку есть обычные отрицательные кейсы с названной командой и результатом.

### AC1/AC2 — позитивный путь, включая реальный браузер

- `test/room-opening-host.test.mjs` (Node unit) — гоняет реальные продуктовые
  стадии (`commitWallSegmentModel`, `planRoomDeletion`, `reconcileCoincidentPartitions`,
  `selectWallFaceLineage`/`settleWallFaceLineage`) и сверяет с зафиксированными
  в `test/fixtures/996-room-opening-host-candidates.json` кандидатами по 4
  сценариям (door/window × reverse); проверяет `checkSpacePhysicalGeometry(...).ok`
  на всех трёх снимках (физический preflight, названный в AC2).
- `tests_backend/test_room_opening_host.py::test_issue_996_frontend_room_restoration_and_recreation`
  прогоняет те же кандидаты через реальный `validate_partition_opening_hosts`
  + `validate_wall_model_transition` по циклу delete→Undo→Redo→recreate.
- `tests_backend/test_ha_room_opening_host.py::test_issue_996_ordinary_history_and_recreation_are_durable`
  — тот же цикл через реальный WS `config/set`/`config/get`, с проверкой
  `rev`/CAS/durable store и read-only-отказа.
- `demo/smoke_room_opening_host.mjs` — **прогнан лично в headless Chromium**
  (после `npm run bundle:sync`, см. «Гейты»): реальный редактор, реальные
  клики (удаление с диалогом → Undo×2/Redo×2 → создание комнаты), oracle на
  fake-hass boundary зовёт настоящую `same_partition_wall_promotion` (не
  заглушку) через `demo/helpers/partition-host-oracle.py`. Результат: `OK`,
  все 3 проверки (`HP_SMOKE_CHECKS=1`) прошли, включая «all 12 physical
  transitions reached the production promotion proof». Это сильный,
  исполненный свидетель, а не чтение кода.

AC4 — `test_issue_996_unrelated_write_and_deletion_keep_previous_policy` и
`test_issue_996_promotion_does_not_grant_import_or_optimize_new_capabilities`
(Python): неизменённый конфиг, прямой edit независимого проёма, удаление
проёма, Optimize-доказательство и импорт/node_move без флага ведут себя как
раньше — прочитано и прогнано (см. «Гейты»); `websocket_api.py` подтверждает
чтением, что только `config/set` передаёт новый флаг.

## Гейты — что прогнано и результат

Зелёного Validate на `f89ee2ef6` не найдено — все гейты ниже прогнаны лично.

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | чисто, без ошибок |
| Node unit | `npm test` | 5505 passed / 0 failed / 1 skipped (совпадает с `npm run inventory`: 5013 деклараций верхнего уровня) |
| build + бандл | `npm run build`, затем `npm run bundle:clean` (возврат dist к закоммиченному, т.к. локальная сборка — не кандидат релиза) | сборка 24.3s, дерево чисто после `bundle:clean` |
| bundle-policy --verify | `node scripts/bundle-policy.mjs --verify HEAD` | «свежая сборка dist цела (60 ассетов)» |
| bundle:budget | `npm run bundle:budget` | в пределах потолков, headroom положительный (диф не трогает `src/**`, ожидаемо) |
| no-new-any | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 0 добавленных строк в `src/**/*.ts` — не применимо, диф бэкендовый |
| no-new-private-writes | `node scripts/no-new-private-writes.mjs --base origin/dev --head HEAD` | 113 строк в 1 новом смоке, новых записей в приватное состояние нет |
| lint:unused (монолит) | `node scripts/unused-locals-gate.mjs` | мёртвого кода нет; bundleBytes ниже базы (ожидаемо, бэкенд-диф) |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» — `src/**/*.ts` не тронут, автовыбора смоков нет |
| **Браузерный smoke по плану автотестов** | `npm run bundle:sync && node demo/smoke_room_opening_host.mjs` (не выбран smoke-select, но назван в АС/плане автотестов issue) | **OK**, все проверки прошли (см. выше); dist возвращён `npm run bundle:clean` после прогона |
| pure backend (без HA) | `python3 -m pytest tests_backend/ -q` (без `test_ha_*`) | 1164 passed; 2 FAILED в `test_support_builds.py` — не связаны с диффом: `async def functions are not natively supported` (в среде ревью не установлен `pytest-asyncio`, это окружение, а не регрессия; эти тесты не затронуты диффом и не входят в AC #996) |
| **HA-harness backend** | установлен `tests_backend/requirements.txt` в выделенный venv на Python 3.14 (`pytest-homeassistant-custom-component==0.13.357`, `homeassistant==2026.8.3`), затем `python -m pytest tests_backend/ -q` | **1958 passed, 1 skipped** — полный HA-harness зелёный, включая `test_ha_room_opening_host.py` (10 passed) и все существующие marker/device/wall-тесты (регрессий в «devices»-классе риска нет) |
| mutation-registry --check | `node scripts/mutation-registry.mjs --check` | чисто (exit 0); сами 3 новых мутанта **не исполнялись** — не ночной workflow |
| Трейлеры | `git log origin/dev..HEAD` | все 3 коммита несут `Issue: #996`; `User-Visible: yes` только на `c284dafb1`, и в том же коммите правлены оба changelog (RU+EN) |
| Одно число — один источник (§8) | `docs/STATUS.md` счётчики тестов vs `npm run inventory` | совпадают дословно: 5013/574/483/403 |
| release-ledger | `docs/release-ledger/v1.81.0/996.json` | `category: stable-fix` обоснована: баг (Keep walls deletion + Undo/recreate) уже был в v1.81.0 (стабилизирован коммитом `b3f5aefa2`/#804, 2026-10-06, до тега v1.81.0 от 2026-10-16) — классификация корректна, не инфраструктура и не новая бета-функция |

## Что проверено и корректно

- Разделение ответственности: чистая функция без side-effects в отдельном
  модуле (легко читается, легко тестируется изолированно); окружающие проверки
  (принадлежность комнате, отсутствие выжившей партиции, cell_cm) — в
  `validate_partition_opening_hosts`, где и так есть доступ к пространству.
- Privilege separation по вызывающим: только `ws_config_set` передаёт
  `allow_room_wall_promotion=True`; `node_move`, `optimize`, `import_export`
  явно не передают — проверено чтением всех 4 точек вызова.
- Явная защита от `bool`/`int` алиасинга в JSON-сравнении (исправлено в
  `f89ee2ef6` до этого раунда ревью) — редкий, но реальный класс багов.
- Документация (`ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`,
  `WALL-THICKNESS.md`, `USER-GUIDE.ru.md`, `DEVELOPMENT.md`, `STATUS.md`,
  `CHANGELOG.md`/`.ru.md`) согласована друг с другом и с кодом; `USER-GUIDE.ru.md`
  использует уже принятую терминологию («Удалить комнату, оставить стены»),
  новых терминов не вводит.
- Фикстуры — полностью синтетические (seed с `wall-N`/`binding_sensor.synthetic_*`),
  не приватный support-экспорт, что и требует ТЗ.
- Нет изменений модели данных/миграции/i18n/UX — соответствует заявленному
  в ТЗ non-scope.

## Чего не проверял

- `pytest-asyncio`-плагин не ставился — 2 неродственных теста в
  `test_support_builds.py` падают в этой среде по окружению, не по диффу;
  не входят в AC #996, диф их не касается.
- `npm run invariants` не прогонялся: диф не меняет `src/**` (геометрическая
  модель фронтенда не тронута), гейт неприменим к этому бэкенд-only изменению.
- `golden:verify` не прогонялся: метки `ci:golden` нет, рисунок не меняется
  (ни один файл `src/**` не в диффе), риска визуального сдвига нет.
- Зарегистрированные мутанты (`room-promotion-coerces-json-booleans-to-numbers`,
  `room-promotion-rejects-safe-restoration`, `room-promotion-ignores-carrier-thickness`)
  не исполнялись — политика разрешает это только ночному workflow; обычные
  негативные тесты выше дают исполненное свидетельство caught без этого.
- Ручная dev/GPU-приёмка владельцем не проводилась и не требуется (#929).
- Полная предрелизная матрица (`npm run gate:small` целиком одной командой,
  остальные ~200 browser smokes, performance-набор) не прогонялась —
  несоразмерна объёму задачи (§8); прогнаны компоненты, покрывающие
  изменённые участки и названный в плане автотестов смок.

## Побочные находки вне скоупа

Доверенный снимок политики: `mode=issues` (`HP_REVIEW_OUTSIDE_FINDINGS_FILE_ISSUES`).
Побочных находок вне скоупа этой задачи не обнаружено — новый issue не
заводится.

## Вердикт

Зелёный. Реализация соответствует контракту ТЗ: узкое, доказуемое исключение
`partition→wall` для обычного `config/set`, без расширения прав Optimize/
import/node_move; защитный AC3 имеет исполненные отрицательные свидетельства
на двух уровнях (чистый Python и реальный HA-writer); позитивный путь AC1/AC2
подтверждён вплоть до реального браузерного прогона через настоящий редактор
и настоящую серверную функцию доказательства, а не только чтением кода.
Документация, трейлеры, changelog и release-ledger согласованы и обоснованы.
Находок High/Medium не выявлено.

Маршрут: `fix`.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/996-room-opening-host`, коммит `f89ee2ef6469` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7783faa9fba4cb9b3841e49d4fca84a72efa4872`
  ```
  git log --all --format='%H %T' | grep 7783faa9fba4
  ```
- Тело issue: `1e6b968930dbf17127404cc133603ea7c5674da0606b03bd916cc68cdf1e1bb3`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ4NjYsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0OTUxfSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoxOTAsIm91dHB1dF90b2tlbnMiOjQxNDQ3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2NjYzNCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjEyMDkxOTEyLCJjb3N0VXNkRXN0aW1hdGUiOjMuNDk5NzY4NDAwMDAwMDAwMn1dLCJ0dXJucyI6MTE1LCJkdXJhdGlvbk1zIjo5OTAxOTQsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjozLjUwNDcxOTQwMDAwMDAwMDQsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5056 output_tokens=41464 cache_creation_input_tokens=166634 cache_read_input_tokens=12091912 num_turns=115 -->
