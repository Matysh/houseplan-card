# CODE-REVIEW-1015-r1

**Issue:** #1015 · **Этап:** code · **Трек:** ask · **Материал:** `8fa19a4c4e0549d66d9f044c110f1acb936d7a61`
**Заход:** r1 · блокирующих циклов 0/4 · **Маршрут:** fix

## Скоуп

Срок жизни compatibility-веток config/layout: политика `since`/`until` (два
последующих опубликованных stable) в `PROCESS.md`/`docs/process/{AUTHOR,REVIEWER}.md`/
`CONFIG-COMPATIBILITY.md`, воспроизводимая инвентаризация 625 scan-hits
(`CONFIG-COMPATIBILITY-INVENTORY.md`, `scripts/config-compatibility-*`), единый
серверный canonical load/setup/write/import decoder v1
(`config_migrations.py` + `store.async_resolve_pending_pair`), crash-resumable
paired config/layout migration с исходным snapshot и admin+writer rollback-export,
снятие одной доказанно зрелой ветки (`weather-option`) отдельным cleanup,
task-packet предупреждения (`scripts/task-packet.mjs`) и смок/бэкенд-доказательства
(`demo/smoke_config_lifecycle.mjs`, `tests_backend/test_*`, `test/config-lifecycle.test.mjs`).
Обслуживает J6 «Keep the plan true as the home evolves» (`docs/SCOPE.md`) —
старые планы/копии остаются открываемыми при развитии конфигурационной модели.

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT`, тело issue/ТЗ, хендофф, `docs/SCOPE.md`,
`AGENTS.md`, `docs/process/REVIEWER.md` целиком; затем независимо, без опоры на
авторские выводы, прослежены вызывающие пути и инварианты:

- `custom_components/houseplan/__init__.py` (setup-time fence),
  `store.py` (`async_resolve_pending_pair`, `_async_converge_pair_documents`,
  `async_save_config_state`) — единая точка миграции/durable-записи;
- `config_migrations.py` (`migrate_pair`, `_scalars_v1`, `migration_version`) —
  версионированный декодер и его отказы;
- `import_export.py::parse_document` — тот же `migrate_pair` на импортном пути;
- `websocket_api.py` (export/import/revalidate/device-copy хендлеры),
  `http_api.py` (import-preview), `backup_service.py` — подтверждено, что все
  писатели проходят `async_resolve_pending_pair` под `write_lock` до чтения
  ревизий/конфига; прямые `config_store.async_load()` в остальных WS-командах
  выполняются после уже сошедшегося при setup стора (не независимый decode-путь);
- `scripts/config-lifecycle.mjs`, `config-compatibility-catalog.mjs`,
  `config-field-registry.mjs`, `config-compatibility-inventory.mjs`,
  `task-packet.mjs` — логика `since`/`until`/`eligible`/warnings;
- `docs/CONFIG-COMPATIBILITY.md`, `CONFIG-COMPATIBILITY-INVENTORY.md`,
  `PROCESS.md` §7.2 (новый абзац «Срок жизни persisted-совместимости»),
  `docs/release-ledger/v1.82.0/1015.json`, оба `CHANGELOG`;
- тесты: `tests_backend/test_config_migrations.py`,
  `tests_backend/test_ha_config_migrations.py`, `test/config-lifecycle.test.mjs`,
  `demo/smoke_config_lifecycle.mjs`;
- точечная проверка удаления ветки `weather-option`: `grep weather_entity`
  по `src/**/*.ts` — ноль совпадений (frontend-ветка снята), в то время как
  `config_migrations.py`/`validation.py` сохраняют decoder/strict-schema —
  соответствует заявленному AC6;
- авторизация узкого rollback-экспорта (`ws_export_create` с
  `migration_source: true`, `websocket_api.py:633`) — подтверждено, что
  требуются одновременно `_check_write` и `archive_admin`, снимок читается
  под `write_lock` без мутации и без записи на диск вне executor-задачи
  построения документа.

Проверенные гейты **не перезапускались** — переиспользован принятый
validate-gate для точно этого материала (https://github.com/Matysh/houseplan-card/actions/runs/40478030729,
«review-light proof is complete»), покрывающий build/typecheck,
product+tooling guards/budgets. Дополнительно независимо прочитаны (не
исполнены повторно) тестовые файлы, формирующие негативные свидетели для
защитных AC — их существование и содержание проверены чтением, они входят в
тот же green-прогон. Адресных пробелов, требующих нового `run_check`, не
выявлено: каждому риску/защитному AC соответствует либо исполненный в
принятом proof тест, либо чтение неизменного `geometry_migration.py` (файл не
входит в `changedFiles`, его контракт не менялся).

**Не проверялось** отдельно в этом раунде: полный построчный аудит всех 625
scan-hits инвентаризации (доверено мета-тесту
`checkInventory`/`matchesDigest`, который фейлится на orphan/missing/duplicate
и прогнан в принятом proof); полная regression-матрица golden/HA-harness
(вне объёма ревью по §8); реальный GPU/приватный HA (честно не заявлен и
автором).

## Защитные AC — чем доказано, чем краснеет

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 (typed since/until/provenance) | `validateLifecycle()` над `CONFIG_FIELD_REGISTRY`/`COMPATIBILITY_BRANCHES` + `docs/CONFIG-COMPATIBILITY*.md` | `test/config-lifecycle.test.mjs` теста 1: удаление `since`/`until`/`provenance` у записи → `validateLifecycle` возвращает `missing lifecycle`; теста 3: подмена `until.release` → `invalid two-stable until` (обычные прогнанные тесты, не мутант) |
| AC2 (полнота scan) | `scanCompatibility()`/`checkInventory()` против `config-compatibility-inventory.json`, 625 hits, digest-проверка | `test/config-lifecycle.test.mjs` тест 4: усечённый/задублированный/добавленный hit → `orphan source hit`/`duplicate`; `matchesDigest` меняется |
| AC3/AC4 (versioned decoder, unknown version/passport) | `config_migrations.migrate_pair`, `migration_version` | `tests_backend/test_config_migrations.py::test_unknown_or_corrupt_migration_passport_refuses_without_touching_source` и `::test_unknown_model_is_not_treated_as_current` — `pytest.raises(ValueError)`, источник не изменён; `test_old_alias_decoder_does_not_bypass_independent_strict_scalar_validation` (14 вариантов) — `ImportFailure(invalid_config)` |
| AC5 (crash-resumable paired write) | `store.async_resolve_pending_pair`/`_async_converge_pair_documents`, `write_lock` | `tests_backend/test_ha_config_migrations.py::test_failed_half_keeps_recoverable_original_and_next_load_finishes` (параметризован по intent/config/layout половине) — реальный `OSError` на `HouseplanStore.async_save`, исходные данные целы, повтор `async_resolve_pending_pair` доводит конверсию; `test_unknown_passport_keeps_durable_pair_unchanged` — `ValueError`, стор не тронут |
| AC6 (eligible removal только по доказательству) | `COMPATIBILITY_BRANCHES` (`allInputsCanonical`/`decision.kind`), `lifecycleState` | `test/config-lifecycle.test.mjs` тест 3: только `weather-option` помечен `eligible: true` среди всех веток на `v1.82.0`; независимо прочитано отсутствие `weather_entity` в `src/**/*.ts` при сохранении decoder/strict-schema в Python |
| AC7 (task-packet только предупреждает) | `buildPacket`/`lifecycleWarnings` | `test/config-lifecycle.test.mjs` тест 5: `publishedReleases: null` → пустые warnings + «current published stable could not be proved»; будущий stable/prerelease в последовательности не создаёт ложный eligible по `space-font-scale`; `packet.status`/`trackDetail` не меняются |

Пустых третьих столбцов нет — требование §2.7/REVIEWER.md «Код-ревью» выполнено.

## Находки

Нет находок High или Medium. Два наблюдения Low, не блокирующих и не
открывающих цикл (решены ревьюером без действия автора):

- `CONFIG-COMPATIBILITY-INVENTORY.md` рендерит `until` для `pending`/`keep`
  веток как сырой `JSON.stringify` (`renderLifecycleTable` в
  `config-lifecycle.mjs`) — читаемо, но менее аккуратно, чем строка-резюме;
  чисто документационная шероховатость, данные корректны и машинно проверяемы.
- `store.py::_async_converge_pair_documents` использует булево `config_changed`/
  `layout_changed` как слагаемое (`config_rev + config_changed`) — идиоматично
  для Python, но локально неочевидно при беглом чтении; поведение покрыто
  тестами выше, последствий нет.

## Что проверено и корректно

- Единая серверная точка канонизации: все писатели (`__init__.py` setup,
  `websocket_api.py`, `http_api.py`, `backup_service.py`) проходят
  `async_resolve_pending_pair` под `write_lock` до использования ревизий;
  импорт (`import_export.parse_document`) использует тот же `migrate_pair`.
  Независимого TS/Python decode-пути не найдено.
- `rev` растёт ровно при изменении контента (`config_changed`/`layout_changed`),
  `model_version` не используется как счётчик скалярных миграций — подтверждено
  чтением `migrate_pair`/`canonical_config`/`_needs_v1` и тестами identity/no-op.
- Исходный snapshot сохраняется в `config_migration_backup` до первого
  durable-изменения; rollback-экспорт (`migration_source: true`) требует
  одновременно editor- и admin-прав, не изменяет сторы, и его исходный путь
  сам проходит через существующий import dry-run (`_materialize_import_candidate`).
  `test_reader_cannot_export_previous_hidden_source_data`,
  `test_recovery_export_rechecks_permission_after_worker_await` покрывают отказ
  неадмина и потерю прав между await.
  Это выполняет требование SCOPE.md не давать View-поверхности писательские
  побочные эффекты и не выдавать административные данные ниже уровня admin.
- Политика двух последующих **опубликованных** stable (не арифметика X.Y+2,
  без prerelease/beta) реализована в `sunsetUntil`/`publishedStableSequence` и
  согласована между `PROCESS.md` §7.2, `docs/CONFIG-COMPATIBILITY.md` и
  исполняемым кодом; расхождение между типизированным `until` в реестре и
  вычисленным значением отлавливается `validateLifecycle`.
- Единственная фактически снятая ветка (`weather-option`) подтверждена и
  документом, и исходным кодом: frontend-читатель удалён, Python
  decoder/strict-schema сохранены — соответствует «decoder остаётся только как
  явно версионированная migration».
- `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` содержат согласованную запись
  `(#1015)` в обоих файлах одним содержанием; числовых величин, видимых
  пользователю дважды с разными источниками, в дифф-записи нет (§8).
- `docs/release-ledger/v1.82.0/1015.json`: `stable-fix` с обоснованием
  (существующие форматы уже поддерживались; перенос на единый boundary без
  нового пользовательского контроля) — соответствует §11.9, не претендует на
  release milestone сверх maintenance.

## Чего не проверял (явно)

- Побайтовую корректность всех 625 строк инвентаризации — доверено
  мета-тесту (`checkInventory`) и его green-прогону в принятом proof, не
  перепроверено вручную построчно.
- Полный HA-harness/golden/perf прогон — вне объёма ask-ревью по §8; переиспользован
  уже принятый green validate-gate для точно этого материала.
- Реальное GPU/приватное HA окружение — не заявлено и не являлось целью: смок
  честно описан как synthetic-transport, фактическая миграция независимо
  доказана HA-harness пайтест-тестами на реальных `Store`.
- Не перечитывал заново `geometry_migration.py`, `wall_segment_model.py`,
  `vacuum_routes.py` и прочие keep-ветки целиком — они не входят в
  `changedFiles`, их контракт не менялся этой задачей; инвентарный `keep`-статус
  проверен по записи каталога и источнику анкеров (`verifyAnchors` зелёный
  в принятом proof).

## Маршрут

`route: fix` — трек `ask`, `reclassify` применим только на `show`
(`PROCESS.md` §5, docs/process/REVIEWER.md «Трек show»).

## Побочные находки

Режим политики — `mode=issues`. Побочных находок вне скоупа задачи не
обнаружено.

## Вердикт

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImFhN2I2NTFlMWRhOGRkNDQ0NzVjZDVhOWMzOTE4M2U1MWZhNzQwZDExN2I0ZjEwYTY3ZWZlNmM2ZjExNTEzZjEiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJiZjMxNDRjMTI4NTM2NjJiZDQ3MGQ4MzZlZTdiNTZkZGZmNjNhNzYyYjZjZjg5ZDZkNjc5MDFkNTEwOGRjNjFlIiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDE1LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI4ZmExOWE0YzRlMDU0OWQ2NmQ5ZjA0NGMxMTBmMWFjYjkzNmQ3YTYxIiwidHJlZSI6Ijg4YjU2MDg2MGNiZTg5M2UwNzdmZDMwNTk2MjVkNjJkZGYzYWVhYTgiLCJib2R5RGlnZXN0IjoiYWNlMTFjNTk0ODI1YTQ0NmVmMjc1NmMzNmZlOWFmZGIzMzFkMTE0NzBiYjI0NjgxYzMxNWU1MzY5ZTcxYzQ2NiIsInByb2R1Y2VyUnVuIjoiNDA0Nzg2NzM4OTQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjdkZDQzNWQ5MGMyNzI0MDZkODdkNGZjMjhlYjk4OWFhNzZkNzRjMWZiODIxZDhkNmY3ZjkwOTRjZmVlNmZkZGEiLCJ2ZXJkaWN0RGlnZXN0IjoiZDRmMDE5ZTg1MWI1YWRkOTEwNDBjOGMwNmZjNzgzNTYzNmQyOTU2MjlhYmVmNWEzM2U1YjdjYTI0YTg0ZTc2NSIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJkNGYwMTllODUxYjVhZGQ5MTA0MGM4YzA2ZmM3ODM1NjM2ZDI5NTYyOWFiZWY1YTMzZTViN2NhMjRhODRlNzY1IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDM4MDk0MjE4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDE1I2lzc3VlY29tbWVudC02NDM4MDk0MjE4IiwiYm9keURpZ2VzdCI6IjY2ZTdjYzFiNTU5YTJhZTQ2ODVhNzUxZjJlY2RmMzQxOTJlMGUwYzMyZWQ3MDkwYjgxZDNmYmZkMGU4ZDIwZDQifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1015-compatibility-sunset`, коммит `8fa19a4c4e05` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `88b560860cbe893e077fd3059625d62ddf3aeaa8`
  ```
  git log --all --format='%H %T' | grep 88b560860cbe
  ```
- Тело issue: `ace11c594825a446ef2756c36fe9afdb331d11470bb24681c315e5369e71c466`
- Вердикт конвейера: `green` · High 0 · маршрут `fix` (критерий `complexity`)
- Сертификат переноса счётчиков: `{"run_id":40478673894,"run_attempt":1,"digest":"fdf8e9ca2004352a750f686ab0ec9c92e515da9fec65f3d3f2f8e2345b661c86"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NTQsIm91dHB1dF90b2tlbnMiOjI4MDgwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjE2NjAwMywiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMyODI1NDMsImNvc3RVc2RFc3RpbWF0ZSI6MS42MDE0Mjg2fV0sInR1cm5zIjo0MCwiZHVyYXRpb25NcyI6MzgwMjQzLCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS42MDE0Mjg2LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=54 output_tokens=28080 cache_creation_input_tokens=166003 cache_read_input_tokens=3282543 num_turns=40 -->
