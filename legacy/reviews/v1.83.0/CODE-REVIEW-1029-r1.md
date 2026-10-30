# CODE-REVIEW-1029-r1

Материал: `2b99eb69e00eb77d36a8465ae599176b5708a7da` (merge of `38ffbd99f` ← `fb38ee9f9` ← `81c73f0a2` onto current `dev`). Трек: `ask`. Заход r1, блокирующих циклов израсходовано 0 из 4.

## Скоуп

Issue #1029: House Plan читает собственный LQI физического Zigbee-устройства напрямую из Zigbee2MQTT и ZHA, не требуя включённых диагностических сущностей HA. Один entry-owned volatile coordinator с двумя пассивными адаптерами (Z2M MQTT, ZHA memory-read), один resolver (`device-signal.ts`), новый read-only WS-контракт `houseplan/zigbee_lqi/subscribe` (capability `zigbee_lqi_api:1`), HA остаётся совместимым резервом. SPEC-REVIEW-1029-r1 — зелёный, без находок (16 AC, все с однозначным способом доказательства).

Работа закрывает J7 (Zigbee-mesh health) и J1 (live overview) из `docs/SCOPE.md`: сигнал виден без ручного включения десятков сенсоров.

## Риск по изменённым участкам (#707) — проверка покрытия AC

| Класс | Участок | Покрыт ТЗ/AC? |
|---|---|---|
| migration | `store.py:122,251-253` | Да — не модель/миграция данных: volatile runtime-поле `HouseplanData.zigbee_lqi` (не персистится) и хук `async_config_saved`; §7 ТЗ прямо требует «новых полей plan/config/layout/marker и повышения версии модели нет» — соблюдено, подтверждено чтением (store.py не трогает Store-схему). |
| devices | `websocket_api.py:279,316` | Да — только импорт/регистрация `zigbee_lqi_websocket.async_register`; реальная ACL-логика в `zigbee_lqi_websocket.py`, покрыта AC11 и executed-тестом `test_authenticated_read_only_projection_acl_and_no_raw_or_foreign_data` (admin/household/read-only/revoked). |
| devices | `device-signal-runtime.ts:32` (`identityOf` включает `is_admin`) | Да — AC10/14; оправданная консервативная граница кэша (смена admin-статуса инвалидирует кэш), не влияет на корректность, т.к. контракт одинаков для всех ролей (AC11). |
| perf | `render-device-snapshot.ts:203`, `render-snapshot-reuse.ts:100` | Да — AC8; `directSignalReadings(hass)` возвращает стабильную по ссылке заморозку, заменяемую только при реальном изменении revision (`zigbee_lqi.py::_project` эмитит только при `rows != self.rows`); `same()` в `render-snapshot-reuse.ts` сравнивает по `===`, подтверждено тестом `#1029 AC8` (`test/device-signal-runtime.test.mjs:159`). |
| ux | `i18n/*.json` (`tip.signal_last_known`), `i18n/settings/*.json` (`gs.signal_help.aria`) | Да — ключ `tip.signal_last_known` подключён в `src/live-hover.ts:97`; `gs.signal_help.aria` подхватывается автоматически по конвенции `${key}.aria` в `src/editors/settings-copy.ts:25` (используется `shelp('gs.signal_help')` в `space-form.ts`/`general-settings-dialog.ts`) — не orphaned ключ. en/ru/de/fr присутствуют во всех 4 изменённых парах файлов. |

Все классы покрыты ТЗ/AC; `route: fix` (track `ask` — поле `route` всегда `fix` вне `show`).

## Как проверялось

Чтением исполняемого кода и тестов (без запуска мутантов — политика #905/#709, ночь не входит в этот заход). Прочитаны целиком: `zigbee_lqi.py`, `zigbee_lqi_model.py`, `zigbee_lqi_z2m.py`, `zigbee_lqi_zha.py`, `zigbee_lqi_websocket.py`, `device-signal-runtime.ts`, `device-signal.ts`, диффы `device-presentation.ts`, `device-value-badge.ts`, `live-hover.ts`, `space-card.ts`, `houseplan-card.ts`, `__init__.py`, `manifest.json`, `store.py`, весь `tests_backend/test_ha_zigbee_lqi.py` (10 тестов) и `test_zigbee_lqi_model.py`, весь `test/device-signal-runtime.test.mjs` (5 тестов), диффы docs (`ARCHITECTURE.md`, `CONFIG-COMPATIBILITY.md`, `DEVICE-PRESENTATION.md`, `USER-GUIDE.md/.ru.md`, `DEVELOPMENT.md`, `STATUS.md`), i18n (все 4 языка в двух словарях), `docs/CHANGELOG.md/.ru.md`, `docs/release-ledger/v1.82.0/1029.json`, `scripts/mutation-registry.mjs`/`bundle-budget.mjs`/`ci-registry-inventory.json`/`monolith-baseline.json`.

### Принятый proof (validate-gate), не повторялся

План проверок материала `2b99eb69e00eb77d36a8465ae599176b5708a7da` подтверждён `validate-gate` (run 40031065911), review-light-golden proof полный. Использован принятый хендофф автора:

- Финальный SHA `38ffbd99f` принят product/tooling/docs push-профилями CI (SUCCESS) — 20 task smokes + 2 новые Golden-сцены, HA/backend и frontend. `2b99eb69e` (merge dev) — pre-push gate PASS, 202 с.
- `npm run gate:small` на `81c73f0a2`/`38ffbd99f`/`2b99eb69e` → PASS, 0 failures.
- `pytest tests_backend/test_ha_zigbee_lqi.py test_zigbee_lqi_model.py test_ha_zigbee_topology.py test_ha_setup.py` → 88 passed, настоящий Linux HA-harness (HA 2026.8.3).
- `node demo/smoke_direct_zigbee_lqi.mjs` → PASS, 14 флагов, pinned Chromium.
- Все 19 строк `smoke-select --base origin/dev --head HEAD` + 5 AC9-regression smokes → PASS.
- `node --test test/golden-matrix.test.mjs` → 57/57; обе новые Golden-сцены captured, ledger `expectation:new` только для них.
- `node --test test/device-signal-runtime.test.mjs test/golden-scene-repaint.test.mjs` → 10/10.
- `mutation-gate.mjs --check` для пяти новых `zigbee-lqi-*-1029` → readiness PASS, execution 0 (мутанты не исполнялись — соответствует политике, не находка).

Эти прогоны не повторялись: материал (SHA, продуктовые исходники, визуальные входы) не изменился после ревью/докс-коммитов между `38ffbd99f` и `2b99eb69e` (`git diff 38ffbd99f..2b99eb69e -- src custom_components/houseplan` — пусто, проверено).

### Адресные проверки, выполненные в этом ревью (чтением, не исполнением)

AC1–AC16 разобраны построчно против кода и таблицы автора «AC · доказательство · чем краснеет» (issue-комментарий, строки 80–97). Подтверждено исполняемыми негативными случаями в прочитанных тестах, конкретно:

- **AC3** (конфликт идентичности): `test_multiple_instances_foreign_inventory_exact_registry_and_conflict_refusal` — совпавший IEEE в двух инстансах отказывает обоим (`zigbee_lqi.py:148-156`, `duplicated`-логика).
- **AC4** (поздний callback): `test_rename_remove_repair_topics_registry_and_old_callbacks_are_fenced`, `test_delayed_subscribe_after_topic_generation_change_releases_old_transport` — generation fencing в `zigbee_lqi_z2m.py` (`self.generation`, `expected`-токены) реально отвергает устаревшие колбэки.
- **AC5** (приоритет источника): `device-signal.ts::deviceLqi` — прямое доступное значение приоритетно, иначе HA-резерв, иначе последний известный прямой снимок, иначе `null`; порядок подтверждён `test/device-signal-runtime.test.mjs:122-157` (direct/HA/stale/null все 4 ветки пройдены).
- **AC6** (malformed/граница): `test_lqi_is_a_whole_finite_number_in_range` (pure, 15 параметров) и frontend `normalizeDirectSignalReadings` тест (8 malformed значений) — настоящий отрицательный свидетель с результатом, не только happy path.
- **AC7** (один физический источник — один вклад): `devices.ts::areaLqi` дедуплицирует по `deviceSignalPhysicalId`, подтверждено `test/device-signal-runtime.test.mjs:138` (`alias`-маркер того же устройства не удваивает среднее).
- **AC10/14/15**: `test/device-signal-runtime.test.mjs:32-59` — поздняя ревизия отвергается, смена пользователя чистит проекцию синхронно, старый backend без capability не шлёт неизвестную команду.
- **AC11** (ACL): `test_authenticated_read_only_projection_acl_and_no_raw_or_foreign_data`, параметризован admin/household/read-only; произвольный `base_topic` отклоняется схемой voluptuous (параметр не объявлен в `ws_zigbee_lqi_subscribe`), сторонний девайс не попадает в выдачу, ревокация пользователя закрывает listener.
- **AC15 (частично, см. «Чего не проверял»)**: нагрузочный HA-тест на 200 устройств/600 маркеров/4 клиента подтверждает 1 cycle/401 точную подписку/0 leaks после unload.

Логика резолвера (`deviceLqi`, `deviceSignalSource`) и их взаимная согласованность (tooltip «last known» показывается только когда реально используется устаревшее прямое значение, а не когда сработал HA-фоллбек) проверены построчно — отдельного АС на это нет, но это прямое следствие 5.2/5.7 и корректно реализовано.

## Находки

Нет High и Medium. Низкоприоритетные наблюдения (правятся или снимаются ревьюером, цикла не образуют):

1. **Low** — `custom_components/houseplan/zigbee_lqi.py:157-158`: ветка `if len(bindings) > MAX_DEVICES: bindings = {}` (полный сброс всех привязок при превышении 1500 устройств) не покрыта ни одним тестом — ни позитивным, ни негативным. Поведение безопасно (fail-safe: нет данных, а не искажённые/чужие данные — не «тихое вытеснение», т.к. обнуляются все привязки одинаково), и порог сам отмечен в §13 ТЗ как «предложено, ревью вправе уточнить значения». Не блокирует: ни один реальный дом не достигает 1500 Zigbee-устройств, а остальные защитные лимиты (`MAX_INVENTORY_BYTES`, `MAX_STATE_BYTES`, `MAX_SNAPSHOT_BYTES`, ZHA `MAX_DEVICES`) проверены тестами. Отмечаю как незакрытый зазор в «чем краснеет» для этой конкретной строки, не как дефект поведения.
2. **Low** — `docs/DEVICE-PRESENTATION.md` (строка после `364`): опечатка «Available direct data win without averaging sources» → «wins». Косметика, не продуктовый код.

## Что проверено и корректно

- Идентичность провайдера (`provider+instance+IEEE`, затем HA device registry) и запрет на наследование сигнала виртуальными устройствами/controls/роутером/`via_device` — реализовано через `deviceSignalPhysicalId`/`bindingOf`, которые игнорируют `virtual`, `binding==='virtual'`, `marker.removed`, неактивный `bindingStatus`.
- Порядок выбора значения (5.2) реализован ровно как в таблице ТЗ, включая настоящий `0` как измерение (`lqi_number` явно отличает `0` от `None`) и защиту от «повреждённое сообщение не заменяет корректное число нулём» (`unknown`-ветка в `zigbee_lqi_z2m.py:166-171`).
- Z2M: пассивные подписки на точные topics (`bridge/devices`, `<topic>/<name>[/linkquality]`), без `#`, без publish (тест `forbidden`-monkeypatch на `async_publish` — любой publish роняет тест), JSON/attribute режимы разделены без удвоения вклада.
- ZHA: только `device.lqi` из памяти, оба API-shape (`gateway.devices` / `gateway_proxy.gateway`), без импорта zha/zigpy, без `topology.scan`/reconfigure/ping.
- Время/кэш: `observed_at` — момент получения кэшем, `measurement_at` всегда `None` (провайдеры не сообщают реальное время радиоизмерения) — честно, без подмены «обновлено сейчас»; подтверждено `test_disconnect_retains_truthful_last_known_and_reload_unloads_every_listener`.
- Авторизация: `ws_zigbee_lqi_subscribe` требует только активного аутентифицированного пользователя — симметрично существующей модели доступа House Plan (`ws_layout_get` и другие read-команды тоже не делают доп. проверок прав чтения, т.к. View намеренно не entity-by-entity privacy boundary — `docs/SCOPE.md`). Выдача ограничена проекцией represented-устройств, сторонние устройства/IEEE/MQTT-доступы не передаются.
- Перф: события коалесцируются (`call_later(1, …)`) и эмитятся только при реальном изменении (`rows != self.rows`), `directSignalReadings` возвращает стабильную по идентичности структуру → `render-snapshot-reuse.ts`'s `same()` (референсное сравнение) не форсирует лишний full-recompute на неизменном фиде.
- Жизненный цикл: `async_close`/`Z2mLqiReader.close` отменяют все подписки/таймеры/задачи, `async_config_saved` синхронно обрезает scope до сохранения конфигурации (без гонки с асинхронным refresh).
- Трейлеры: все 3 нетривиальных коммита несут `Issue: #1029`; `User-Visible: yes` на `81c73f0a2` и `38ffbd99f` — оба changelog (RU/EN) правлены в тех же коммитах; `fb38ee9f9` — `User-Visible: no`, без changelog (корректно, только visual-тест-сцены).
- Одно число, один источник (§8): `docs/STATUS.md` счётчики тестов (Node unit +5, pure backend +3, HA-harness +10, browser smokes +1) совпадают с фактическим числом добавленных `test(...)`/`def test_...`/новых smoke-файлов — не разошлись с `npm run inventory`. `scripts/bundle-budget.mjs` ceiling (339 368 B) и `scripts/monolith-baseline.json` `bundleBytes` (3 410 642) — согласованы между собой и с числами в хендоффе/DEVELOPMENT.md.
- release-ledger `docs/release-ledger/v1.82.0/1029.json`: `category: "major"` относительно предыдущего stable v1.82.0 — обоснованное авторское суждение (новая пользовательская возможность, не infra/stable-fix/line-fix); `visual` поле с двумя новыми Golden-сценами и smoke — присутствует и соответствует коду.
- i18n: `tip.signal_last_known` и `gs.signal_help.aria` — не orphaned, оба подключены (проверено grep + чтением `settings-copy.ts`); en/ru обязательны, de/fr актуальны — все 4 присутствуют в обоих изменённых словарях.
- Замена пути (#1014): синхронный-only `cleanup` в `device-signal-runtime.ts` заменён на обработку и sync-throw, и rejected-promise в том же коммите `38ffbd99f`; старого дублирующего пути не осталось. Существующий HA-resolver в `device-signal.ts` — не забытый путь: AC5/AC14 требуют его как резерв, что явно зафиксировано в ТЗ (не-скоуп: «данные координатора/соседа вместо собственного LQI» запрещены, но HA-фоллбек — обязательная часть контракта).

## Чего не проверял

- Не исполнял ни одного мутанта (включая 5 новых `zigbee-lqi-*-1029`) — вне ночного workflow запрещено политикой #905/#709; readiness-check автора (`mutation-gate.mjs --check`) принят как есть.
- Не повторял build/typecheck/`gate:small`/`npm test`/golden/pytest/smoke-select — приняты как принятый proof validate-gate (run 40031065911) и хендофф автора; материал (SHA, продуктовые исходники, визуальные входы) не менялся после этих прогонов.
- Не запускал адресно ветку `len(bindings) > MAX_DEVICES` (1501+ устройств) — нет встроенного для неё теста ни у автора, ни добавленного мной; описано как находка Low выше, а не закрыто самостоятельным прогоном (это проверка осуществимости edge-case, не относящаяся к заявленным AC напрямую — автор может закрыть её позже без цикла).
- Не поднимал реальные Z2M/ZHA инстансы и не трогал HA владельца — не требуется для этого ревью (все заявленные AC проверяются fixture/fake-транспортами, что соответствует «проверено чтением исполняемого consumer/handler», а не ручной GPU/живой приёмкой — она добровольна, #929).
- Не проверял полный предрелизный набор/мутанты/global baseline acceptance — вне объёма гейта ревью на `ask` (§8, полные наборы — предрелизный гейт).

## Вердикт

Все 16 AC разобраны против кода; защитные AC имеют исполняемый негативный свидетель (кроме одного Low-зазора на граничном пределе ёмкости, не меняющего вердикт). High/Medium не найдено. Зелёный вердикт цикла не образует.

route: fix (track `ask`).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1029-direct-zigbee-lqi`, коммит `2b99eb69e00e` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `98cbd5ccd7ee7c2c4611cf87c95fb9997762c8b7`
  ```
  git log --all --format='%H %T' | grep 98cbd5ccd7ee
  ```
- Тело issue: `34282cb968a5b2a8c9218c1ab4bb1e7db337383187b9cfb83d8f55b762047f18`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjUxNzksIm91dHB1dF90b2tlbnMiOjE4LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA1MjY4OTk5OTk5OTk5OTk5fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjo5OCwib3V0cHV0X3Rva2VucyI6MzUyMTQsImNhY2hlX2NyZWF0aW9uX2lucHV0X3Rva2VucyI6MTY1NjQ1LCJjYWNoZV9yZWFkX2lucHV0X3Rva2VucyI6NjA5MTE5MywiY29zdFVzZEVzdGltYXRlIjoyLjIzMzE1NDZ9XSwidHVybnMiOjYzLCJkdXJhdGlvbk1zIjo0MTgwNDksImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjoyLjIzODQyMzYsImJpbGxpbmciOiJwcm92aWRlci1lc3RpbWF0ZS1ub3Qtb2F1dGgtY2hhcmdlLW9yLXF1b3RhIn0 -->
<!-- hp:usage input_tokens=5277 output_tokens=35232 cache_creation_input_tokens=165645 cache_read_input_tokens=6091193 num_turns=63 -->
