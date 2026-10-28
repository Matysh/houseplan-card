# CODE-REVIEW #1101 — r1

Материал: `be371e5ec6ea22f9af224100d8ebbe4bdd463796` (единственный коммит в диапазоне `origin/dev..HEAD`: «Prepare space deletion off the Home Assistant event loop»). Трек: show. Заход r1, блокирующих циклов 0/2.

## Скоуп

Единственная рабочая поверхность — обработчик `ws_space_delete` в `custom_components/houseplan/websocket_api.py` (один эндпоинт `houseplan/space/delete`). Сопутствующие изменения — документация (ARCHITECTURE/STATUS/DEVELOPMENT/CHANGELOG×2), `docs/release-ledger/v1.82.0/1101.json`, `scripts/ci-registry-inventory.json`, `scripts/mutation-registry.mjs`, новый тест `tests_backend/test_ha_space_delete_executor.py`.

ТЗ (тело issue): CPU-часть `space/delete` — JSON-roundtrip кандидата, `CONFIG_SCHEMA`/`LAYOUT_SCHEMA`, `canonicalize_*` — переносится в `hass.async_add_executor_job` под тем же `write_lock`, по образцу `config/set` (#330). Ответ/события/парная запись/rollback/отказы не меняются.

## Как проверялось

1. **Независимый разбор кода** (`read:diff`, полное чтение `websocket_api.py` вокруг изменённого участка: 2491–2817 — `_space_delete_candidate`, `_space_delete_target`, `_forget_deleted_markers`, `ws_space_delete`; сверка с образцом `ws_config_set` 2034–2155).
2. **Статические проверки изменённых служебных файлов** выполнены свежо через фиксированный runner (не переиспользованы из CI, т.к. это точечная сверка содержимого диффа):
   - `static:mutation-registry` → PASS (exit 0).
   - `static:ci-registry-inventory` → PASS (exit 0).
   - `static:status-snapshot` → PASS (exit 0).
3. **Переиспользование пригодного evidence** (#857): validate-gate зелёный, https://github.com/Matysh/houseplan-card/actions/runs/40664483608, «review-light proof is complete». Материал/вход/оракул не менялись с момента этого прогона (SHA тот же, код не правился после preflight-возврата — поменялось только оформление AC2 в теле issue, не код). По хендоффу приняты как пройденные без повторного исполнения:
   - `python -m pytest tests_backend -k space_delete -q` → PASS 29, 2573 deselected.
   - `ruff check custom_components/houseplan/websocket_api.py` → PASS.
   - `node scripts/mutation-gate.mjs --check` → PASS (1980 definitions; execution 0/caught unknown — статический `--check`, не маркер «caught»).
   - `npm run gate:small` → PASS 298 с, 0 failed.
   - `node scripts/process-gate.mjs --range origin/dev..HEAD --issues` → PASS, 1 коммит, 0 предупреждений.
   В манифесте `REVIEW_CHECKS` этого runner'а нет check_id для pytest/ruff/mutation-gate (только `build:*`, `static:*`, `unit:test/*.test.mjs`, `smoke:demo/*.mjs`, `read:*`) — повторный прогон pytest/ruff здесь недоступен и не требуется: конкретных непокрытых AC/рисков нет (см. ниже).

## Независимый разбор по AC

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| **AC1** (CPU-валидация в executor, large-house) | `test_issue_1101_space_delete_large_house_cpu_runs_in_executor` — реальный large-house конфиг через `config/set`+`space/delete`, monkeypatch на `_space_delete_target`/`CONFIG_SCHEMA`/`LAYOUT_SCHEMA`/`canonicalize_config_geometry`/`canonicalize_layout_geometry` с `assert threading.get_ident() != loop_thread` и проверкой `write_lock.locked()` внутри каждого вызова. Ordinary PASS (пригодное CI-evidence, п.3). | Зарегистрированный мутант `space-delete-cpu-on-event-loop-1101` (`scripts/mutation-registry.mjs`) заменяет `await hass.async_add_executor_job(_prepare_delete_cpu)` на синхронный вызов `_prepare_delete_cpu()` — по хендоффу witness **не исполнялся** (обычная регистрация + статический `--check`, не исполнение мутанта за пределами ночного workflow). Независимо прочитал диф мутации и исходный код построчно (`validate_active_marker_ids` на 16 пробелах, `remove_markers=msg[...]` на 20 — `static:mutation-registry` подтверждает актуальность обоих изменённых якорей прежних мутантов на новой разметке). |
| **AC2** (`unit / HA-harness`, контракт сохранён) | Существующие `test_ha_websocket.py` (#244/#819/#826), `test_ha_space_delete_routes.py` (#822) — без правки ожиданий, зелёные в составе `pytest tests_backend -k space_delete -q` (п.3, переиспользованное evidence). | Регрессионное покрытие не изменялось; явного нового негативного свидетеля не требуется — это AC сохранения поведения, а не нового гарда. |
| **AC3** (сериализация записи под `write_lock`) | `test_issue_1101_space_delete_keeps_lock_during_executor_before_competing_write` — патчит `hass.async_add_executor_job`, приостанавливает именно `_prepare_delete_cpu`, проверяет `write_lock.locked()` и что конкурирующий `config/set` не завершается (`not reply.done()`), затем снимает паузу и проверяет, что конкурент получает `conflict` после успешного удаления. Обычный PASS, встроенный негативный assert внутри теста. | Это сам тест и есть красный случай: ослабление удержания лока в `_prepare_delete_cpu` даст либо `write_lock.locked() is False`, либо `reply.done()` истинным до освобождения — тест сломается без изменения входа. |

Независимо проследил, что `_space_delete_candidate` всегда делает `json.loads(json.dumps(config))` до любой мутации — хранимые `current_config`/`current_layout` в фоновом потоке только читаются, мутация идёт в копии. Это совпадает с уже принятым прецедентом `config/set` (#330, комментарий `websocket_api.py:2099-2104`) и не вводит новую гонку чтения/записи сверх уже принятой модели.

## Трейлеры и видимые величины

- `User-Visible`: поведение соответствует `yes` — `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` правятся в одном и том же коммите `be371e5ec`, оба добавляют одну и ту же запись под «Unreleased» (RU/EN формулировки согласованы).
- Видимая пользователю величина — счётчик тестов `HA-harness backend 604 → 606` в `docs/STATUS.md` (+2 за новый файл); единственный источник — `npm run inventory`, подтверждено свежим `static:status-snapshot` (PASS).
- Полный текст commit trailers (`Issue:`/`User-Visible:`) этим набором инструментов не читается (доступны только `read:log` построчно и `read:diff`); фактическое поведение диффа (парный CHANGELOG в одном коммите) соответствует заявленному `User-Visible: yes`, поэтому это не расхождение, а граница доступного evidence — отмечаю честно.

## Release ledger

`docs/release-ledger/v1.82.0/1101.json`: категория `stable-fix`, обоснование — пространство удаляется в stable v1.82.0 уже на event loop; правка переносит существующий CPU-путь в executor, не меняя контракт. Это авторское суждение (владелец подтвердил чтением опубликованного blob v1.82.0), согласуется с тем, что `space/delete` — давно существующий писатель (не новая beta-функция), и не противоречит диффу.

## Маршрут вердикта (§5, трек show)

- `complexity` — один вынос CPU-блока в замыкание executor-джобы, зеркало уже существующего паттерна `config/set`/`plan/optimize`. Сложность/риск ≤3. ✓
- `surfaces` — одна поверхность: один обработчик (`ws_space_delete`) в одном модуле. ✓
- `migration` — конфиг/схема не меняются, новых полей совместимости нет. ✓
- `ux-contract` — ответ, коды ошибок, события, парная запись не меняются; внешний WS/UI контракт идентичен. ✓
- `perf-touch` — улучшение производительности строго по уже документированному правилу #330 (комментарий `websocket_api.py:2099-2104`), новый контракт/порог не вводится; touch-контракт не затрагивается (бэкенд). ✓
- `undocumented` — ожидаемое поведение зафиксировано: правило «CPU-валидация писателя в executor под write_lock» уже документировано в коде (#330) и применяется к `config/set`/`plan/optimize`; это распространение того же правила на `space/delete`, явно описанное в теле issue как тождественный образец. ✓

Все критерии §5 выполнены → **route: fix** (не `reclassify`).

## Находки

Блокирующих находок нет. Побочных Medium вне скоупа не обнаружено.

## Что не проверялось повторно (и почему это допустимо)

- Сам прогон `pytest tests_backend -k space_delete`, `ruff check`, `node scripts/mutation-gate.mjs --check`, `npm run gate:small`, `node scripts/process-gate.mjs` — не переисполнялись: манифест данного runner'а не содержит check_id для pytest/ruff/mutation-gate/gate:small (только `build:*`, `static:*`, `unit:test/*.test.mjs`, `smoke:demo/*.mjs`, `read:*`); материал/вход/оракул с момента зелёного validate-gate (run 40664483608) не менялись — переиспользование разрешено явно политикой ревью.
- Полный `npm run gate:small`/browser-смоки не прогонялись заново — задача не меняет фронтенд/UI, `smoke-select` для этого диффа не требует обязательных browser-smoke (подтверждено статическим `static:smoke-select`, не перепроверялось отдельно, т.к. не относится к изменённым файлам бэкенда).
- Содержимое `docs/USER-GUIDE.ru.md` не трогалось и не проверялось — видимое поведение для пользователя (UI/контракт WS) не меняется.

## Гейты: что прогнано и что нет

Прогнано в этом ревью:
- `read:diff`, `read:log` — чтение материала.
- `static:mutation-registry`, `static:ci-registry-inventory`, `static:status-snapshot` — свежий прогон, все PASS.

Не прогонялось повторно (переиспользовано зелёное CI-evidence validate-gate run 40664483608, review-light proof):
- `pytest tests_backend -k space_delete -q` (AC1/AC2/AC3).
- `ruff check custom_components/houseplan/websocket_api.py`.
- `node scripts/mutation-gate.mjs --check`.
- `npm run gate:small` + pre-push.
- `node scripts/process-gate.mjs --range origin/dev..HEAD --issues`.

Не прогонялось и не требуется: browser/E2E-смоки (внешний контракт не менялся, обоснование автора принято), полная релизная регрессия.

## Вердикт

**green**, маршрут **fix**. High: 0, Medium: 0.

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjU1MzdkY2NiNGIzZTJlMjYwZDQ4OTk4ODkyMDhlNmVlNGYxZmMxNTIzNjE3ODYwMjhiMWQxZjM5ZDNiNmQ0NzgiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiI0ZjIzMjYzMDNlMTUyMjBkMWQyOWU4ZDY0MmEyYTM4YzE5NDA3ZjM2NjM4NDc3MDM2ZTVhODc3NTkxYjY2MDEyIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTAxLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiJiZTM3MWU1ZWM2ZWEyMmY5YWYyMjQxMDBkOGViYmU0YmRkNDYzNzk2IiwidHJlZSI6ImYyYWYzOTRhZDM0YWJlNzk5NjQ3MWU4YmY5MzRkOGQyYjgxOTQ4MzMiLCJib2R5RGlnZXN0IjoiM2FjYjRmZDg0NDhkZWFmOWU4NDk3Y2RkMWEzOWM2NzQ1YzA2NTUyY2Y1NDI4NGFhNTQ1YmIxN2JlZjVjNmM1MyIsInByb2R1Y2VyUnVuIjoiNDA2NjY4MTM2MzEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6Ijk1MDAyNGIxNmMxMGUyODYxNTdjNDNlMDljNWI1NDEyYTY2N2VkNDE3NWI1ZjU1MGFmYTkyZjM0YTA4MzJhYmYiLCJ2ZXJkaWN0RGlnZXN0IjoiYjZlOGY4NDAzNGQ4MjhmYzBlN2YwMWZmZjM0YmQ1NjMwOTI1OTBkMzYwNTMyYjM3MWQ4ZDc5ZWMwYjJmNGUyNyIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiZDJlM2RhNmY0NTg4NWYzNzQxMDFhNDA0YTU2NTlhNTgyNjZkYjYxNTQ4ZDFiYTI3ZTdlYjEzOTVmODFjNjQ4IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDY1ODk5MzYwLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTAxI2lzc3VlY29tbWVudC02NDY1ODk5MzYwIiwiYm9keURpZ2VzdCI6ImYyOWE3ZTQyZDFjYjk4YWU5OWMwMmRmYzZmY2M1NzkwNmRiNzZlMDJiNGI5NGEzYzc4NDU1ZTQ4OWIyYWQwOTAifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1101-space-delete-executor`, коммит `be371e5ec6ea` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f2af394ad34abe7996471e8bf934d8d2b8194833`
  ```
  git log --all --format='%H %T' | grep f2af394ad34a
  ```
- Тело issue: `3acb4fd8448deaf9e8497cdd1a39c6745c06552cf54284aa545bb17bef5c6c53`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40666813631,"run_attempt":1,"digest":"10f1a24794a556e8c83f58d5edd4287945c07d77fd5f8bf1f58f417cc76e70f0"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTgsIm91dHB1dF90b2tlbnMiOjIyMTE2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzMTY1NSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMxMDExMTEsImNvc3RVc2RFc3RpbWF0ZSI6MS4zNjgxMTgyfV0sInR1cm5zIjozOCwiZHVyYXRpb25NcyI6MzI2Njc0LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS4zNjgxMTgyLCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=58 output_tokens=22116 cache_creation_input_tokens=131655 cache_read_input_tokens=3101111 num_turns=38 -->
