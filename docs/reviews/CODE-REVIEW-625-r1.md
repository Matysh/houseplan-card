# CODE-REVIEW-625-r1

**Issue:** [#625](https://github.com/Matysh/houseplan-card/issues/625) — backend I/O, конкурентность и целостность конфигурации
**Стадия:** код-ревью, заход r1 (первый код-ревью раунд задачи; ТЗ прошло r1→r2 жёлтый→зелёный ранее)
**Материал:** `15bc6bcf5a69ef3423badfc61311dd0efc072030` (ветка `issue/625-backend-io-invariants`)
**Класс изменения:** A (продукт) — `custom_components/houseplan/**/*.py`, `quality_scale.yaml`; плюс B (`tests_backend/**`, `scripts/mutation-registry.mjs`) и C (`docs/**`)
**Трек:** полный (аналитика явно назвала критерии: несколько поверхностей, влияние на конкурентность, изменение контракта валидации, сложность 8/10)

## Скоуп

Диффа по `src/**` нет вовсе (0 файлов) — чисто backend-задача:

```
custom_components/houseplan/{__init__,diagnostics,http_api,import_export,plans,
  store,trails,validation,virtual_lights,websocket_api}.py, quality_scale.yaml
tests_backend/{test_ha_diagnostics(new),test_ha_import_export,test_ha_upload,
  test_ha_virtual_lights,test_ha_websocket,test_trail_recorder,test_validation,
  test_virtual_lights}.py
scripts/mutation-registry.mjs
docs/{ARCHITECTURE,CONFIG-COMPATIBILITY,CHANGELOG,CHANGELOG.ru}.md
```

Четыре продуктовых дефекта из аудита плюс шесть low-пунктов, все явно входящие в ТЗ:

1. блокирующий file I/O `_missing_internal_attachments` на event loop под `write_lock` → вынесен в executor;
2. `write_lock` удерживается на весь `create_export` → снят snapshot под локом, экспорт строится без него;
3. нет инварианта уникальности `markers[].id` → delta-aware previous-aware валидатор плюс исправление tombstone-double в `ws_layout_update`;
4. upload пишет до квоты/проверки → ранний Content-Length preflight, финальная проверка+promotion под `upload_lock`, `validate_asset` серилизован тем же локом;
5. low-пучок: атомарная запись плана, coalesced virtual-light save с flush при unload, redaction diagnostics, DEBUG-дедуп ревизии, `quality_scale.yaml`, flush trail при unload.

## Как проверялось

Полное построчное чтение диффа по каждому из десяти изменённых модулей `custom_components/houseplan/**` плюс всех новых/изменённых тестов. Отдельно прослежена каждая из четырёх точек вызова `validate_active_marker_ids` (websocket_api.py:1692,1939,2085; import_export.py:1893) и обе точки `_snapshot_payload`/`VirtualLightController` (store.py wiring, `__init__.py` unload). Проверены анкеры всех 46 мутантов, патчащих тронутые этим диффом файлы (`node`-скрипт, см. таблицу гейтов) — ни один не разошёлся с текущим кодом.

Для трёх защитных AC лично прогнаны отрицательные пробы (guard снят → тест краснеет) на чистых юнит-тестах, которые в этой песочнице исполнимы без Home Assistant (`tests_backend/test_validation.py`, `test_virtual_lights.py`, `test_trail_recorder.py` — не подпадают под `test_ha_*.py`, поэтому `conftest.py` их не пропускает). Результаты — в таблице «чем краснеет» ниже.

HA-tier тесты (`test_ha_*.py`) в песочнице не выполнялись: здесь нет `homeassistant` и нет `.venv-backend` (по `AGENTS.md`, он появляется только в облачных агентах). Их зелёность подтверждена отдельно: Validate на точном SHA `15bc6bcf` зелёный (ссылка в системном контексте задачи, run 35851865360), плюс автор явно называет WSL-прогон полного HA harness `879 passed, 1 skipped` и `pytest tests_backend -q` Windows-подмножества `480 passed, 4 skipped` в хендоффе.

### Гейты

| Гейт | Статус | Как получен |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build`+сверка бандлов | зелёные | Validate на `15bc6bcf` (уже подтверждено конвейером на этом SHA, run 35851865360) — не перегонялись повторно, задача backend-only и эти гейты не специфичны к диффу |
| `python -m pytest tests_backend -q` (полный, включая HA-tier) | зелёный (заявлено) | тот же Validate run + хендофф автора: Windows pure `480 passed, 4 skipped`, WSL full HA harness `879 passed, 1 skipped` |
| `python -m pytest tests_backend/test_validation.py -q` | **зелёный, воспроизведено лично** | `/tmp/review-venv` (Python 3.12 + pytest + voluptuous, установлены в песочнице): `151 passed, 1 skipped` |
| `python -m pytest tests_backend/test_virtual_lights.py -q` | **зелёный, воспроизведено лично** | `4 passed` |
| `python -m pytest tests_backend/test_trail_recorder.py -q` | **зелёный, воспроизведено лично** | `38 passed` |
| `ruff check custom_components/houseplan` | зелёный | заявлено автором; независимо перепроверено (`ruff` установлен в `/tmp/review-venv`) — `All checks passed!` на всех 10 тронутых модулях |
| `ruff check tests_backend/test_validation.py` | зелёный (19 pre-existing, не связанных с диффом; новые строки — 0 находок) | перепроверено лично, см. «Найдено и корректно» |
| mypy strict (тронутые модули) | зелёный | заявлено автором, не переисполнялось — не мой инструментарий в песочнице, риск низкий (типизация backend стабильна, диффы малы) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Исполняемого frontend-диффа нет» | выполнено лично — 0 файлов `src/**`, смоки не выбираются законно, не «пропущено» |
| `node scripts/check-docs.mjs` | не требуется | 0 файлов `src/**` — отпечаток скриншотов не мог устареть |
| `npm run golden:verify`, performance-профили | не требуются | нет визуальной поверхности, AC13 явно освобождает backend-only изменение |
| мутационные анкеры (46 патчей в тронутых файлах) | зелёные, проверено лично | `node --input-type=module` скрипт сверил `find`-паттерны всех мутантов, чьи патчи целятся в 10 тронутых модулей, с текущим содержимым файлов — 0 расхождений |
| `node scripts/process-gate.mjs --issues 625` | зелёный | заявлено автором в хендоффе, трейлеры и структура коммитов подтверждают то же самое независимо (см. ниже) |

### Не проверялось и почему

- Полный HA-tier прогон (`test_ha_*.py`, ~7 файлов с новыми/изменёнными тестами) — недоступен локально (нет `homeassistant`, нет `.venv-backend`). Заменено: (а) зелёный Validate на точном SHA, (б) построчное чтение каждого нового теста на логическую корректность и falsifiability, (в) три независимые отрицательные пробы на pure-эквивалентных модулях, которые тестируют структурно ту же защиту.
- `mypy --strict` — доверено заявлению автора, не переисполнено (нет установленного mypy с конфигом проекта под рукой; риск низкий, дифф в основном добавляет функции с явными аннотациями).
- Мутационный CI-прогон (`mutation-gate.yml` / Validate `mutants=true`) — не переисполнялся (дорогой прогон); вместо этого лично сверены все анкеры (см. гейты выше) и лично воспроизведены три отрицательные пробы вручную.

## Разбор по AC

| AC | Заявлено | Проверено | Чем |
|---|---|---|---|
| AC1 | `_missing_internal_attachments` в executor, не в event loop | **да** | код: `websocket_api.py:596-601` — `await hass.async_add_executor_job(_missing_internal_attachments, ...)`; тест `test_import_attachment_scan_runs_in_executor` сравнивает `threading.get_ident()` вызова с `threading.get_ident()` event-loop потока (HA-tier, не исполнено локально, но логика теста корректна: реальный, а не шаблонный, oracle) |
| AC2 | `config/get` не ждёт `export/create` | **да** | код: `write_lock` теперь охватывает только два `async_load()`+`deepcopy`, снимается до `async_add_executor_job(create_export, ...)` (`websocket_api.py:456-483`); тест `test_config_get_does_not_wait_for_slow_export_materialization` — реальный конкурентный тест с `asyncio.wait_for(timeout=1)` и `threading.Event`, падает по таймауту, если `write_lock` держится дольше (HA-tier, не исполнен локально, но конструкция теста falsifiable и логически корректна) |
| AC3 | previous-aware валидатор отклоняет новый duplicate, разрешает неизменённую legacy-группу и т.д. | **да, с оговоркой** | `validation.py:37-62` — реализация точно соответствует ТЗ (см. «Найдено и корректно»); unit-тесты `test_validation.py` покрывают все перечисленные в AC3 случаи; **но** три из четырёх точек вызова (`ws_config_set`, `ws_space_delete`, `ws_plan_optimize`) не имеют ни одного теста, вызывающего сам websocket-хендлер с дублирующимся id — см. **M1** |
| AC4 | tombstone+live не теряет drag в `ws_layout_update` | **да** | код: `deleted = not live_explicit and any(tombstone...)` (`websocket_api.py:829-832`) — корректно меняет семантику именно так, как требует ТЗ; тест расширяет `test_deleted_marker_rejects_a_stale_layout_update` кейсом `dev_both` (tombstone + live одного id), проверяет что drag проходит и **не** помечен `ignored` (HA-tier, не исполнен локально, тест реален и falsifiable) |
| AC5 | ранний Content-Length reject до multipart/temp; сохранено поведение при отсутствующем length; cleanup при abort | **в основном да** | ранний reject: `http_api.py:378-397`, тест `test_attachment_upload_rejects_impossible_content_length_before_multipart` + `..._quota_before_multipart` (оба HA-tier, оба с синтетическим `_Request` — падают, если preflight убрать). Cleanup при abort — существующий тест `test_upload_leaves_no_temporary_behind` (не новый, но применим). **Пробел**: ни новый, ни существующий тест не проверяет явно, что streaming hard cap (`if size > MAX_FILE_BYTES`) продолжает работать, когда `content_length` отсутствует/лжёт — см. **L1** |
| AC6 | не более одного одновременного `validate_asset`; точная quota-проверка перед promotion | **да** | decor: `validate_asset` теперь внутри `async with runtime.upload_lock` (`http_api.py:334-339`); тест `test_decor_asset_upload_deduplicates_and_rejects_mime_spoofing` расширен реальным потоковым счётчиком `max_active_validations == 1` — подлинный конкурентный oracle, не синтетика. upload: `_check_and_promote` объединяет `check_quota`+`_promote` под тем же локом (`http_api.py:507-524`); тест `test_issue_625_concurrent_uploads_serialize_exact_quota_check` гоняет два реальных параллельных запроса, `max_active == 1` |
| AC7 | сбой атомарной записи плана не портит старый файл, temp удаляется | **да, лично воспроизведено** | `plans.py:29-41` (`atomic_write`); тест `test_atomic_write_keeps_destination_and_cleans_temp_when_replace_fails` — **лично прогнан**, зелёный (151 passed вместе с остальными); лично сделана отрицательная проба (см. таблицу «чем краснеет») |
| AC8 | серия toggle → 1 coalesced запись, flush при unload | **да, лично воспроизведено** | `virtual_lights.py:44-136` (`VirtualLightController`); pure-тест `test_runtime_controller_coalesces_rapid_toggles_into_one_durable_write` — **лично прогнан**, зелёный; HA-tier тест `test_unload_flushes_a_toggle_still_inside_the_debounce_window` реально перезагружает config entry и проверяет персистентность (не исполнен локально) |
| AC9 | diagnostics не содержит binding/settings | **да, лично прочитано + тест проверен построчно** | `diagnostics.py` — `TO_REDACT` расширен `binding`,`settings`; тест `test_diagnostics_redact_marker_bindings_and_all_settings` (HA-tier, не исполнен локально) — сериализует результат в JSON и грепает шесть секретов, плюс проверяет что `rev`/`layout_entries`/`rooms`-агрегаты выжили. Логика теста подлинная (текстовый grep по сериализованному payload — сильный oracle) |
| AC10 | DEBUG-дедуп, conflict не скрыт от клиента | **да** | `_debug_missing_revision_once` (`websocket_api.py:33-45`); тесты `test_issue_340_...`/`test_issue_356_...` явно проверяют, что **оба** запроса без revision получают `conflict`, а строка лога появляется **ровно один раз**, отфильтровано по имени логгера House Plan (после исправления в `15bc6bcf`, устранившего ложный шум от HA Store) |
| AC11 | trail flush при unload, нет висящих подписок/таймеров | **да, лично воспроизведено** | `trails.py:458-479` (`async_teardown`); тест `test_async_teardown_flushes_pending_debounced_state_and_closes_handles` — **лично прогнан**, зелёный; лично сделана отрицательная проба |
| AC12 | `quality_scale.yaml` не заявляет отсутствие HTTP | **да** | текст переписан, описывает support-relay |
| AC13 | typecheck/backend/build зелёные; golden/smoke/perf не требуются | **да** | см. таблицу гейтов; backend-only diff подтверждён (0 файлов `src/**`) |

## Находки

### Medium (в скоупе задачи — чинится в этой же задаче, без отдельного issue)

**M1. Три из четырёх точек вызова `validate_active_marker_ids` не имеют ни одного теста, exercising сам websocket-хендлер.**

- **Файлы:** `custom_components/houseplan/websocket_api.py:1692` (`ws_config_set`), `:1939` (`ws_space_delete`), `:2085` (`ws_plan_optimize`).
- **Что доказано:** только сама функция `validate_active_marker_ids` (чистый юнит, `test_validation.py`, воспроизведено лично) и путь `kind=full` импорта (`test_full_import_rejects_duplicate_active_marker_ids`, вызывает `create_preview` напрямую, не через websocket-хендлер). Ни `ws_config_set` (самый частый путь записи — срабатывает на каждое сохранение из редактора), ни `ws_space_delete`, ни `ws_plan_optimize`, ни путь `kind=space` импорта (`revalidate_candidate`/`prepare_apply`) не имеют теста, который бы послал реальный дублирующийся id через сам WS-хендлер и проверил `invalid_config`/`duplicate active marker id`.
- **Почему это находка, а не примечание:** AC3 и §2.7 (таблица «чем краснеет») требуют для каждого защитного AC либо мутант (недоступно — гейт дорогой, HA-tier), либо отрицательную пробу самого ревьюера (недоступно — те же тесты недостижимы без HA), либо тест, который сам по себе умеет падать на этой конкретной точке. Ни одно из трёх не выполнено для этих трёх точек: пустой третий столбец таблицы «чем краснеет» — Medium по тексту процесса, а не заметка.
- **Смягчающее:** вызов `validate_active_marker_ids(msg["config"], data.get("config"))` в `ws_config_set` — код, который сидит рядом и **синтаксически идентичен** по контракту вызовам `validate_marker_controls(msg["config"], data.get("config"))` и остальным валидаторам этой же функции (`_validate_config_cpu`), уже покрытым отдельными тестами по тому же паттерну. Риск случайной поломки именно этой строки при будущем рефакторинге невысок, но не нулевой — то же самое рассуждение относили к #423, где паттерн «рядом стоящий работающий валидатор» не спас конкретный контракт от дыры.
- **Воспроизведение (чего не хватает):** отправить `houseplan/config/set` с двумя активными маркерами одного `id` через `hass_ws_client`, ожидать `error.code == "invalid_config"`. Аналогичный по духу тест уже существует для `import/apply` (`test_full_import_rejects_duplicate_active_marker_ids`) — паттерн можно скопировать для `config/set`, `space/delete`, `plan/optimize` и `kind=space` импорта.
- **Что делать:** добавить минимум один WS-уровневый тест на `ws_config_set` (самый частый и самый рискованный путь); по возможности — на остальные три точки. Задача не блокируется целиком: правки локальны и укладываются в оставшийся бюджет ревью.

### Low (снято записью, не блокирует)

**L1.** AC5 текстуально обещает «отдельные тесты сохраняют поведение при отсутствующем length» — для streaming hard cap (`if size > MAX_FILE_BYTES` внутри цикла чтения чанков, код не тронут этим диффом) такого теста нет ни в этом диффе, ни в `origin/dev` до него. Риск низкий: сам защитный код не менялся этой задачей, это чистый предсуществующий путь; но формально буква AC5 не полностью покрыта. Снимаю без блокировки: код не тронут, регрессионный риск равен риску, существовавшему до этой задачи.

**L2.** `store.py:async_save_config_state` — `controller.async_flush()` и последующий `controller.reset()` обёрнуты в общий `try/except Exception` вместе с `async_reconcile_virtual_lights`; если сам `async_flush()` бросит (redo-попытка при сбое диска), `reset()` не выполнится и рантайм-кэш virtual-light останется непересброшенным до следующего toggle/snapshot. Последствие ограничено: следующий `async_snapshot`/`async_toggle` всё равно пересчитает состояние относительно актуального `config_rev`, просто на один переход позже подхватит новый config. Не блокирует, автор может оставить как есть — записано для истории.

## Найдено и корректно (подробности)

- **`validate_active_marker_ids` (validation.py:37-62)** — семантика delta-aware сравнения через отсортированный JSON-подпись (`sort_keys=True`) корректно реализует все пункты ТЗ: новый дубликат id всегда отклоняется (`validate_all or previous is None`), неизменённая legacy-группа проходит (сравнение `old.get(id) == signatures` по каждому дублирующемуся id), любое изменение внутри группы либо исправляет до ≤1 активного (выходит из множества `duplicates`, проходит), либо остаётся дублем с другой сигнатурой (отклоняется). `kind=full` импорт всегда `validate_all=True` — корректно соответствует «full import не переносит новый конфликт, doesn't license перенос legacy-группы».
- **`ws_layout_update` tombstone fix** — `deleted` теперь требует `not live_explicit`; `live_explicit` не завязан на `binding`, поэтому legacy-дубликат (два активных с одним id, ещё не почищенный) не ломает drag ни для одной из копий — только настоящий tombstone-без-активного-partner по-прежнему считается удалением. Корректный минимальный фикс, ничего лишнего не меняет.
- **`ws_export_create`** — deepcopy снимается **внутри** `write_lock` (оба `async_load()` последовательно под одним и тем же локом → согласованная пара), исполнитель запускается уже снаружи. `except ImportFailure`/`except Exception` по-прежнему оборачивают весь блок (включая теперь-незалоченный executor call) — обработка ошибок не потеряна.
- **Upload preflight (`http_api.py`)** — `payload_floor = max(0, declared_size - _FLUSH_AT)` корректно реализует «консервативный отказ у самой границы квоты» из «Принятых предположений» ТЗ; финальная точная проверка остаётся под `upload_lock` вместе с promotion (`_check_and_promote`), поэтому окно между preflight и записью не создаёт TOCTOU. Коммит `15bc6bcf` исправил реальный баг первой версии (сравнение по `declared_size` без вычета multipart-overhead ложно отклоняло файл на самой границе) — обнаружен собственным CI Validate до ревью, исправлен до передачи на ревью, что и требует #510.
- **`VirtualLightController`** — единственный фоновый `_save_task` на контроллер, `_schedule_save` не плодит дублей (проверяет `is None or done()`), `async_flush` корректно ждёт текущую задачу и досохраняет, если `_dirty` всё ещё true после неё. Ответы/события стали немедленными (оптимистичный revision), персистентность отложенная и гарантированно flush-ится при unload (`__init__.py:267-269`) и при config-транзишне (`store.py:236-241`, до `async_reconcile_virtual_lights`, чтобы reconcile не гонялся со старым pending-состоянием).
- **Diagnostics** — `settings` целиком редактируется через оборачивающий словарь (`async_redact_data({"settings": ...}, TO_REDACT)["settings"]`), что валидный способ заредактировать весь блок целиком через существующий helper, не изобретая новый.
- **Мутационные анкеры** — все 46 патчей, целящихся в 10 тронутых этим диффом файлов, сверены построчно с текущим содержимым: 0 расхождений. Переименование `quota-ignores-foreign-staged-uploads` → `quota-check-and-promotion-are-not-serialized` оправдано: защита, которую тестировал старый мутант (незалоченный quota-check игнорирует ЧУЖОЙ staged-файл), больше не воспроизводима в новой конструкции — quota-check и promotion теперь строго сериализованы одним локом, поэтому к моменту чужой проверки конкурента либо уже нет (он либо промотирован, либо отклонён). Новый мутант тестирует именно новый контракт (сериализация). Механизм exclude-своего-файла (`plans.py:229`, ради которого был старый мутант) не тронут этим диффом и по-прежнему защищён комментарием+существующим `dir_usage`-тестом косвенно через `test_issue_498_upload_accepts_the_last_bytes_and_the_last_file_of_the_quota`.
- **Трейлеры и changelog** — терминальный коммит `965bbb05` несёт `User-Visible: yes` и правит оба changelog в этом же коммите; два последующих fix-коммита (`4051899b`, `15bc6bcf`) — `User-Visible: no`, корректно, так как чинят баг, обнаруженный CI до выхода из ревью, не добавляя новое видимое поведение сверх уже описанного.
- **`quality_scale.yaml`** — текст корректно описывает support-relay, не заявляет более ничего лишнего.

## Итог

High: 0. Medium (в скоупе): 1 (M1). Low: 2, обе сняты записью выше, не требуют правки.

Единственная блокирующая для зелёного вердикта находка — M1: три из четырёх мест, где вводится центральный инвариант задачи, не имеют собственного witness-теста (ни мутанта, ни исполнимой ревьюером отрицательной пробы, ни HA-tier теста, вызывающего сам хендлер). Это не сомнение в правильности кода — построчное чтение показывает точное соответствие ТЗ и консистентность с соседними уже проверенными вызовами — а отсутствие доказательства по правилу §2.7. Фикс узкий (добавить 1–4 WS-теста по образцу уже существующего `test_full_import_rejects_duplicate_active_marker_ids`) и не требует нового раунда полного разбора — только доказательства по AC3.

**Вердикт: жёлтый.**

---

## Материал раунда

- SHA: `15bc6bcf5a69ef3423badfc61311dd0efc072030`
- Дерево: `git diff origin/dev...HEAD` — 26 файлов, +1341/−138
- Ветка: `issue/625-backend-io-invariants`

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/625-backend-io-invariants`, коммит `15bc6bcf5a69` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `07548b0e43a44ee1943690b774235e9284f85030`
  ```
  git log --all --format='%H %T' | grep 07548b0e43a4
  ```
- Тело issue: `f9d2f583a9c977bd535f6f14de24ad8c8757914db26218bea46875ad89fbaa67`
- Вердикт конвейера: `yellow` · High 0
