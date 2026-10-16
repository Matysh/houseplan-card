# Код-ревью #912 — заход r1

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`,
ровно `5865e09c9e3e6c425f8f9c8d901ecb11fbba1f66` (рабочая копия на нём).
Трек: `ask`. Блокирующих циклов израсходовано 0 из 4.

## Скоуп

Issue #912: сохранить успешно полученные карты связей Zigbee2MQTT между
перезапусками Home Assistant/интеграции до явного действия пользователя
(«Обновить карту» или сохранённое выключение связей). Контракт поведения,
AC1–AC7 и решение владельца 1б (принятый Refresh удаляет старую карту сразу,
ошибка/отмена её не возвращают) зафиксированы в теле issue и прошли зелёное
SPEC-REVIEW-912-r1.

Коммиты в материале: `47ed7938` (feat, User-Visible: yes), `e5e55563`
(build: два owner-approved потолка бюджета), `5865e09c` (docs: evidence).

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом же SHA
(https://github.com/Matysh/houseplan-card/actions/runs/38759907700,
`issue/912-z2m-durable-topology` @ `5865e09c`). Прогон по диффу/AC — лично,
чтением и перепроверкой фактов из этого прогона и соседнего пуш-прогона.

| Гейт | Результат | Источник |
| --- | --- | --- |
| `npx tsc --noEmit` / `npm test` / `npm run build` + bundle-policy | PASS | Validate `38759907700`, job «Фронтенд: типы, юниты, мутанты, синхрон бандла» (3м22с) |
| `pytest tests_backend` | PASS, 1494 passed / 1 skipped, HA-harness собран (597 `test_ha_*`) | Validate переиспользует входы, байтово идентичные прогону `38755995729` (commit `43e25c6e`, предок текущего HEAD по дереву, differs only by evidence-doc): там `pytest` реально выполнен и зелёный (job «Бэкенд: pytest в Home Assistant», 3м12с), что и проверено отдельно |
| `golden:verify` (`ci:golden`, обязателен — риск в `hp-zigbee-topology-overlay.ts`) | PASS, полная матрица, релевантная сцена `device-battery-zigbee-overlap-dark` diff=0px | Validate `38759907700`, job «Golden-кадры против принятых эталонов» (4м26с) |
| Перф-смок / смоки в браузере (3 шарда) | PASS | тот же прогон |
| `mutation-gate --check` (статика) | PASS, execution=0 | тот же прогон, job «Мутанты по диффу» помечен nightly-only (0с) — политика не требует запуска в ревью |
| `node --test test/coordinate-write-barrier-guard.test.mjs` | Проверено чтением: один `config_store.async_save` вызов в `store.py:236` | grep по дереву |

Не прогонял сам: ни один из перечисленных гейтов — они уже зелёные на этом
точном SHA либо на дереве, побайтово идентичном backend-входам (см. таблицу).
Полные (не выборочные) смоки и performance-серии не требовались: диф не
расширяет скоуп AC6 сверх уже прогнанного native-набора.

## Разбор по AC и рискам (трек ask — каждый класс закрыт строкой ТЗ)

- **migration** (`store.py:234–239`, обёртка `config_store.async_save` в
  `zigbee.async_save_config`): контракт п.6 ТЗ («Команда очистки/Refresh
  считается принятой только после успешной durable-очистки») и AC2/AC4.
  Прочитано и воспроизведено тестом
  `test_issue_912_clear_failure_refuses_refresh_and_saved_off_without_publish`:
  провал Zigbee-Store блокирует и публичный `config/set` (`storage_clear`,
  конфиг не меняется), и внутренний `async_save_config_state`. Единственный
  писатель (`coordinate-write-barrier-guard`) не ослаблен — в дереве ровно
  один `config_store.async_save`.
  Единственный найденный нюанс — независимый отказ *последующей* записи
  `config_store.async_save` (не Zigbee-Store) уже после успешной дюрабельной
  очистки карт: карты пропадут, а флаг «включено» на диске может остаться
  прежним. Это не скрытый дефект: `CONFIG-COMPATIBILITY.md` прямо
  документирует «If the subsequent config write fails, the cache may already
  be empty, never resurrected», и это же названо риском в
  `docs/reviews/evidence-912/ordinary.md` (п.5). ТЗ не требует кросс-Store
  атомарности («генерация fence исключают races», не произвольные
  межфайловые отказы), раскрытие честное — не нахожу тут находку.
- **devices** (`websocket_api.py:1791–1795`, флаг `zigbee_maps_api: 1` в
  `ws_config_get`): контракт «Capability и совместимость WS фиксируются при
  реализации», AC5/AC7. Фронтенд требует оба флага
  (`zigbee-topology-runtime.ts`: `zigbee_scan_api !== 1 || zigbee_maps_api
  !== 1` → `backend_required`), покрыто тестом
  `#912 durable capability is mandatory even when the old background scan
  API exists`.
- **ux** (29 новых i18n-ключей: `backup.error.storage_clear/storage_read` в
  `src/i18n/{de,en,fr,ru}.json`, `storage_pending/failed/error_storage_read/
  error_storage_clear/error_capacity_exceeded/error_disabled` в
  `src/i18n/topology/{de,en,fr,ru}.json`): раздел ТЗ «i18n» требует EN+RU и
  отсутствие противоречия в DE/FR. Все 4 локали присутствуют и для основного,
  и для topology-namespace, формулировки не обещают сохранности после
  storage-ошибки. Покрыто `test/config-write-context.test.mjs` (новый тест
  «#912 saved OFF cache failures…») для RU/EN.

Все три класса закрыты AC/разделами ТЗ — реклассификация (`route:
reclassify`) не требуется; маршрут вердикта — `fix` (трек `ask`).

## AC — чем доказаны, чем краснеют

| AC | Доказательство | Чем краснеет |
| --- | --- | --- |
| AC1 restore | `test_issue_912_success_survives_real_entry_reload_without_radio_scan`: реальный `async_unload`/`async_setup`, тот же `obtained_at`, `stale=True`, 0 MQTT publish при restore | Обычный pre-impl прогон этого теста был RED на неизменённом коде (отсутствие `_store`/`async_setup`); зарегистрированный мутант `zigbee-durable-reload-discards-successful-maps` — не исполнялся (nightly-only) |
| AC2 Refresh/OFF | `test_issue_912_refresh_durably_forgets_old_map_even_when_replacement_fails` (error/cancel/reload параметризованы), `test_issue_912_clear_must_finish_before_mqtt_and_replacement_is_durable` (контролируемый `asyncio.Event`, без реального ожидания) | Мутант `zigbee-durable-refresh-keeps-old-map-on-disk` — не исполнялся; обычный `monkeypatch` отказа `Store.async_save` в `test_issue_912_clear_failure_refuses_refresh_and_saved_off_without_publish` — ordinary negative input на границе HA Store, не правка продукта |
| AC3 bounds/recovery | `test_issue_912_eight_slots_never_evict_a_successful_map`, `test_issue_912_topic_removal_keeps_exact_cache_and_reload_does_not_scan`, `test_issue_912_invalid_store_is_preserved_and_cannot_start_a_radio_scan` (future/foreign/topic/nodes/time) | Обычные негативные входы (9-й топик отклонён, повреждённые payload'ы не читаются как карта) — каждый параметр даёт конкретный RED-путь |
| AC4 authority/privacy | Существующие admin/session тесты не изменены; новый Store приватен (`private=True`), не входит в export/support | Обычные non-admin/foreign-reply отказы в неизменном наборе `test_issue_800_*` |
| AC5 runtime | `test/zigbee-topology-runtime-routes.test.mjs` (новые тесты «durable capability is mandatory», «restored stale maps retain original time…», «persistence failures and reset read errors are visible…») — 68/68 compiled suite | Мутант `zigbee-durable-feed-retains-cleared-browser-routes` — не исполнялся |
| AC6 native | `demo/smoke_zigbee_topology_job.mjs` — 6 новых именованных проверок (`restoredMapIsStaleWithOriginalTimeAndNoAutomaticScan`, `keyboardRefreshImmediatelyRemovesOldRoutes`, `failedRefreshDoesNotRestoreOldMap`, `newSuccessfulMapReplacesOnlyWithNewOriginalTime`, `savedOffFromAnotherClientClearsMapWithoutRadio`, `offOnCannotResurrectClearedMap`); `demo/smoke_zigbee_tooltip_layout.mjs` — топик-фильтр без удаления карты | Прогон этих именно смоков на этом SHA — PASS (Validate, шард браузерных смоков); обычное отрицательное поведение (`error`/`cancel` не восстанавливают маршруты) видно прямо в записи ассертов |
| AC7 docs/copy | `CONFIG-COMPATIBILITY.md`, `USER-GUIDE(.ru).md`, `ARCHITECTURE.md`, `DEVELOPMENT.md`, `STATUS.md`, оба `CHANGELOG`, `release-ledger/v1.80.1/912.json` — прочитаны, устаревшие memory-only/keep-on-error формулировки заменены | Не защитный AC — проверено чтением |

## Проверено и корректно

- Трейлеры `Issue: #912` на всех трёх коммитах; `User-Visible: yes` только на
  `47ed7938`, где в том же коммите правятся оба changelog
  (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`).
- Бюджетные потолки: `scripts/bundle-budget.mjs`
  (`LAZY_EDITOR_GZIP_CEILING = 265_955`) и
  `scripts/monolith-baseline.json` (`bundleBytes: 2936529`) — ровно те два
  числа, что владелец одобрил в issuecomment-6194871293; обе 2000-байтные
  полосы и прочие лимиты не тронуты. Одно число — один источник: числа
  определены только в этих двух файлах, остальные упоминания (issue-комментарии,
  evidence.md) на них ссылаются, не переопределяют.
- Порядок вызова `zigbee_coordinator.async_setup` в `__init__.py` —
  **после** восстановления прерванной пары config/layout и миграции square
  canvas, с явным комментарием «A pre-recovery half of an interrupted import
  must not erase the map cache» — соответствует контракту п.2 (нет ложного
  authoritative reset до завершения restore).
- `_cache_exists`/`MAX_CACHE_BYTES` ограничивают размер файла до парсинга
  (executor job, не блокирует event loop) — соответствует «не блокировать
  event loop сериализацией неограниченного raw payload».
- `release-ledger/v1.80.1/912.json`: категория `major` относительно
  `v1.80.1`, обоснование — новая пользовательская возможность, не
  внутри-бетное исправление; попадает в milestone релиза корректно.
- release-ledger/changelog корректно разводят #912 (новая возможность) от
  инфраструктурных правок; `introducedBy` не требуется — функция не
  добавлена внутри текущей беты впервые как промежуточная (была #800/#808,
  заменяется контрактом).
- Единственный писатель (`central-writer-guard`) не продублирован; статика
  `mutation-gate --check` зелёная, три новых декларации синтаксически
  валидны и не исполнялись вне ночи.

## Находки

Нет High. Нет Medium (ни в скоупе, ни вне скоупа). Один пограничный нюанс
(кросс-Store отказ при OFF, см. «migration» выше) разобран и не считается
находкой — раскрыт в документации и в evidence.md как осознанный компромисс,
ТЗ не требует иного.

## Чего не проверял

- Не прогонял `tsc`/`npm test`/`npm run build`/`pytest tests_backend`/
  `golden:verify` локально — взял зелёный Validate на этом точном SHA
  (`38759907700`) и один дополнительный прогон на дереве, побайтово
  идентичном backend-входам (`38755995729`), для подтверждения, что
  «переиспользование» не маскирует непрогнанный HA-harness.
- Не исполнял зарегистрированные мутанты и не трогал продукт/бандл/гарды
  вручную — только статическая регистрация, согласно общей политике
  («Отрицательные проверки и мутанты»).
- Полные (не выбранные по диффу) performance-серии и полный golden-набор вне
  уже пройденной матрицы не гонял — ТЗ их не требует, а полная матрица уже
  прошла в Validate.
- Ручного HA/браузерного тестирования не делал (цикл этого не предусматривает);
  интерактивный golden-прогон на реальном Z2M-брокере не входит в скоуп
  задачи («не возобновлять скан», «не обновлять live HA»).
- Не проверял производительность диска/Store под очень большим числом
  параллельных entries — вне заявленных рисков задачи.

## Вердикт

Зелёный. AC1–AC7 доказаны автотестами с доказанной способностью падать
(ordinary witness или зарегистрированный, честно помеченный «не исполнялся»
мутант); все три risk-класса (migration/devices/ux) закрыты строками ТЗ;
гейты подтверждены на материале SHA `5865e09c`; трейлеры и changelog в
порядке; бюджетные потолки совпадают с owner-approval.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/912-z2m-durable-topology`, коммит `5865e09c9e3e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `a8b52e0396b996c33853b2d04833aee8aa06f81d`
  ```
  git log --all --format='%H %T' | grep a8b52e0396b9
  ```
- Тело issue: `cc7b0e742ffa10286fad8065696571b52f549fa3b091fee850f46af9e686bd62`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUwNDEsIm91dHB1dF90b2tlbnMiOjE3LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MTI2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo4Niwib3V0cHV0X3Rva2VucyI6MzUzMTAsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTYyNTgxLCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NDgzNTM0OSwiY29zdFVzZEVzdGltYXRlIjoxLjk3MDY2NTgwMDAwMDAwMDF9XSwidHVybnMiOjUzLCJkdXJhdGlvbk1zIjo0NTExMDMsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoxLjk3NTc5MTgsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5127 output_tokens=35327 cache_creation_input_tokens=162581 cache_read_input_tokens=4835349 num_turns=53 -->
