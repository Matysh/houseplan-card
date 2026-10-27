# Код-ревью #1090 — заход r1

Материал: `91145c156211191c8c94b2c5ed334dd93412d29a` (база `e2541d6c0` после #1015).
Трек: ask. Этап: code. Маршрут находок: `mode=issues` (см. REVIEW_FINDINGS_POLICY).

## Скоуп

Задача — backend performance bug: Zigbee LQI coordinator блокировал MainThread
HA полным обходом device registry на каждом MQTT-пакете и использовал
deprecated mapping API device registry. Изменённые файлы (ровно по
`review-context.json.changedFiles`):

- `custom_components/houseplan/zigbee_lqi.py`, `zigbee_lqi_model.py` — продуктовый код.
- `tests_backend/test_ha_zigbee_lqi_performance.py` (новый), `test_zigbee_lqi_model.py`.
- `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`, `docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`, `docs/analysis/1090-lqi-event-loop-2026-10-27.md`.
- `docs/release-ledger/v1.82.0/1090.json`, `scripts/ci-registry-inventory.json` (generated),
  `scripts/mutation-registry.mjs` (пять новых witness).

`zigbee_lqi_z2m.py` и `zigbee_lqi_zha.py` не менялись — прочитаны для понимания
контракта `source`-ключей (`("topic", ieee)`), которым пользуется продуктовый код.

## Как проверялось

1. Независимо прочитан весь изменённый код (оба продуктовых файла целиком,
   оба тестовых файла целиком) и сопоставлен с базовой версией через
   `read:base:*` (без мутации рабочей копии).
2. Прослежены вызывающие пути: MQTT-пакет → `_z2m_value` → `_put` →
   `_project_one`; ZHA 30-секундный `_tick` → `async_refresh`; структурные
   события (`device_registry_updated`, `entity_registry_updated`,
   `SIGNAL_CONFIG_ENTRY_CHANGED`, `async_config_saved`) → `request_refresh`
   → `_rebuild_bindings` + `_project`.
3. Прослежена гонка «held subscribe + registry revocation» и «валидное
   обновление во время dirty await» по коду (`_structure_dirty`/`_generation`
   fence), сверено построчно с тестом
   `test_registry_retirement_during_held_subscribe_cannot_republish_old_radio`
   и с комментарием в `docs/analysis/...`.
4. Выполнены доступные через runner проверки (см. «Гейты» ниже).
5. Сопоставлены выводы с хендоффом и зелёным `ciEvidence` (validate-gate run
   40481665406): хендофф не противоречит независимому разбору кода.

## Разбор ключевого дефекта и исправления

В базовой версии `_z2m_value` после каждого `_put` вызывал полный `_project`,
который для **каждой** привязки делал `dr.async_get(self.hass).devices.get(device_id)`
— то есть реестр читался на каждый MQTT-пакет, что и описано в issue. Базовый
`async_refresh` также обходил `scope`/`candidates` на любой вызов, включая
периодический ZHA-тик.

В материале это устранено:

- `_z2m_value` теперь обновляет один `self.values[key]` через `_put` и, если
  значение реально изменилось и структура не «грязная», вызывает
  `_project_one(key)` — точечное обновление одной строки без обращения к
  registry (`custom_components/houseplan/zigbee_lqi.py:233-240`).
- Полный `_project`/`_rebuild_bindings` (с обходом `represented_devices` и
  `dr.async_get`) вызывается только при `self._structure_dirty` — то есть
  при реальных registry/config/provider-identity событиях, а не на каждый
  пакет (строки 146-221).
- Периодический 30-секундный ZHA-тик (`_tick` → `request_refresh(structural=False)`)
  не трогает registry, если `gateway`/`zha_devices.keys()` не изменились;
  значения ZHA обновляются через тот же точечный `_put`/`_project_one` цикл
  (строки 156-172).
- Modern/legacy registry API разделены в `zigbee_lqi_model.py`:
  `device_entries()` (iterate vs `.values()` только для `Mapping`),
  `config_entry_ids()` (`config_entry_id` для обычных современных entries,
  `config_entries` только для `is_composite_device` или legacy-2024.6
  формы), `represented_devices()` использует `registry.async_get(key)`
  вместо индексирования по ключу.
- Синхронная ретирация строки (`registry_changed` callback, строки 58-77)
  немедленно убирает `self.rows[device_id]` до какого-либо `await`, затем
  планирует асинхронный `request_refresh()` для пересборки привязок —
  это закрывает окно «запоздалый MQTT callback возвращает старые данные»,
  что подтверждено тестом с удержанным subscribe.

Это точно соответствует «Подтверждённому пути лишней работы» и «Контракту
поведения» §5 п.1–5 из тела issue. Ручная трассировка (включая сценарий
`unrelated-device` в тесте retirement, где валидное значение, полученное во
время структурного dirty-окна, кэшируется и публикуется только после новой
identity proof) совпадает с описанным в коде поведением построчно — баг
здесь не найден, реализация соответствует описанному контракту.

## Что проверено и корректно

- **AC1** (modern/legacy registry API): `config_entry_ids`/`device_entries`/
  `represented_devices` не используют deprecated mapping-доступ в модерн-ветке;
  `device.config_entries` читается только для `is_composite_device` или когда
  `config_entry_id` отсутствует (legacy 2024.6). Подтверждено чтением кода и
  pure-тестом `test_registry_api_legacy_mapping_modern_collection_and_composite_entry`
  (`tests_backend/test_zigbee_lqi_model.py:44-55`) — читался, не исполнялся
  (нет pytest-oracle в этом ревью-раннере, см. «Чего не проверял»).
- **AC2** (не-обход на каждый пакет): `_z2m_value`/`_put`/`_project_one` не
  содержат обращений к `dr`/`represented_devices`; полный `_project` вызывается
  только при `_structure_dirty`. Подтверждено чтением кода.
- **AC3** (периодический ZHA не пересобирает scope): `async_refresh` условие
  `if self._structure_dirty` ограждает `_rebuild_bindings`/`_project` от
  вызова на обычном тике; membership/gateway-смена явно включает
  `_structure_dirty = True`. Подтверждено чтением кода.
- **AC4/AC5** (ретирация, гонки): синхронный pop строки в `registry_changed`
  + `_structure_dirty`/`_generation` fence в `_z2m_value`/`async_refresh`
  корректно откладывают публикацию «грязного» значения до новой identity
  proof, что прослежено построчно для всех четырёх параметров теста
  `test_registry_retirement_during_held_subscribe_cannot_republish_old_radio`.
- **AC6**: `_put`/`lqi_number` не изменены содержательно (0 остаётся числом,
  unknown удаляет значение, malformed не затирает) — сверено построчно с
  `zigbee_lqi_model.py`.
- **Trailers/release**: `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` обновлены
  в одном коммите с `(#1090)`; `docs/release-ledger/v1.82.0/1090.json`
  классифицирован как `line-fix`, `introducedBy: 1029` — соответствует §9
  ТЗ (прямой LQI появился после v1.82.0 через #1029, это не новая stable-линия
  и не крупная фича).
- **Generated inventory**: `scripts/ci-registry-inventory.json` синхронен с
  фактическим деревом файлов (`static:ci-registry-inventory` — PASS).
- **Mutation registry**: пять новых witness (`zigbee-lqi-per-packet-full-projection-1090`,
  `zigbee-lqi-periodic-binding-rebuild-1090`, `zigbee-lqi-modern-entry-uses-legacy-shim-1090`,
  `zigbee-lqi-dirty-binding-late-publish-1090`, `zigbee-lqi-config-entry-lifecycle-ignored-1090`)
  зарегистрированы корректно, их `find`-паттерны совпадают с текущим текстом
  продуктового кода (`static:mutation-registry` — PASS, статическая проверка
  регистрации, не исполнение мутанта).

### AC · чем доказан · чем краснеет (из хендоффа, сверено с кодом)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 | Strict modern collection/entry input + pure legacy/composite тест | До ремонта — `deprecated devices.items`; witness `zigbee-lqi-modern-entry-uses-legacy-shim-1090` — не исполнялся (nightly only) |
| AC2 | Счётчики `registry_reads`/`scope_passes`/`full_projections` на 1000 MQTT-пакетов = 0 | Historical RED на неизменённом продукте (1000 full projections / 200000 registry reads); witness `zigbee-lqi-per-packet-full-projection-1090` — не исполнялся |
| AC3 | 10 ZHA-циклов / 200 устройств: счётчики = 0 | Historical RED (10 scope / 20 projections / 4010 registry calls); witness `zigbee-lqi-periodic-binding-rebuild-1090` — не исполнялся |
| AC4 | Native registry/config-entry события, inventory/topics, membership | Существующие source-conflict/removal тесты; witness `zigbee-lqi-config-entry-lifecycle-ignored-1090` — не исполнялся |
| AC5 | Held-subscribe race × 4 параметра | Witness `zigbee-lqi-dirty-binding-late-publish-1090` — не исполнялся |
| AC6 | Существующий `test_ha_zigbee_lqi.py` + pure model тест | Существующие witness #1029 — не исполнялись |
| AC7 | До/после отчёт в `docs/analysis/1090-lqi-event-loop-2026-10-27.md` | Детерминированный гейт — ноль лишних проходов, не wall-clock |
| AC8 | Diff review + существующие ACL/lifecycle тесты | `git diff --check`, generated inventory PASS |

Третий столбец ни в одной строке не пуст — требование §2.7/#435 выполнено.

## Гейты: что прогнано в этом ревью и почему

Прогнано через `mcp__houseplan_review__run_check` (фиксированный раннер,
reuse там, где доказательство уже пригодно; адресно — там, где был пробел):

- `static:mutation-registry` — **PASS**. Назначение: проверить, что пять
  новых witness для #1090 зарегистрированы корректно (find-паттерны реально
  совпадают с текущим кодом) — адресная проверка под «registry без execution».
- `static:ci-registry-inventory` — **PASS**. Проверка, что generated
  `scripts/ci-registry-inventory.json` синхронен с деревом файлов диффа.
- `unit:test/user-stable-changelog.test.mjs` — **PASS**. Структура
  CHANGELOG/CHANGELOG.ru после правки.
- `unit:test/backend-test-hygiene.test.mjs` — **PASS**. Гигиена нового
  `tests_backend/test_ha_zigbee_lqi_performance.py`.
- `unit:test/backend-pins.test.mjs` — **PASS**.
- `read:log`, `read:diff`, `read:base:*` (оба продуктовых файла) — чтение
  материала/истории для независимого разбора дельты.

**Не прогонялось и почему:**

- **Backend pytest-суита** (`tests_backend/test_ha_zigbee_lqi_performance.py`,
  `test_ha_zigbee_lqi.py`, `test_zigbee_lqi_model.py`) — в каталоге
  фиксированного раннера (`REVIEW_CHECKS`) нет Python/pytest oracle, только
  Node-based `build:*`/`unit:*`/`smoke:*`/`static:*` и `read:*`. Это не
  заменено чтением как «тест упал/прошёл» — честная граница: AC1–AC6
  закрыты «проверено чтением, не исполнением» (построчная трассировка выше),
  а заявленный хендоффом результат (43 PASS, 18.58s, счётчики 0) принят как
  контекстное authority-доказательство (`ciEvidence`), не как собственный
  прогон. Несоответствий между кодом и заявленным результатом не найдено.
- Полный `node scripts/mutation-gate.mjs --check` (1943 definitions) —
  не повторялся; уже зелёный согласно хендоффу и ciEvidence, а адресная
  `static:mutation-registry` проверка покрывает именно новый риск (пять
  новых witness для #1090).
- `npm run gate:small`, `build:build`/`build:typecheck`/`build:bundle:sync` —
  не прогонялись повторно: продукт этой задачи — Python/docs/JSON, TS/JS
  исполняемый код карточки не менялся (кроме `mutation-registry.mjs`,
  покрытого статической проверкой). Общий gate:small не является «запасным
  сценарием ревью» по инструкции и не даёт новой информации к диффу.
- Браузерные `smoke:*` — не запускались: frontend/визуальный код не менялся,
  `smoke-select` по заявлению хендоффа ничего не выбрал для этого диффа.
- Реальные мутации (execution) witness — не запускались: запрещено вне
  ночного workflow (§«Отрицательные проверки и мутанты»); для всех пяти
  новых и переиспользуемого #1029 witness зафиксировано «не исполнялся».
- Live HA/ZHA/радио — не затрагивались ни автором, ни этим ревью.

## Находки

Находок уровня High или Medium в скоупе не обнаружено. Побочных находок вне
скоупа также не обнаружено (все изменённые файлы входят в заявленный скоуп
ТЗ, посторонних правок нет).

## Вердикт

**green.** Реализация соответствует контракту поведения §5 ТЗ, независимая
построчная трассировка самого рискованного пути (held-subscribe +
registry revocation + dirty-window update) совпадает с заявленным
поведением и тестом. Release-артефакты (changelog RU/EN, ledger,
ARCHITECTURE/DEVELOPMENT/STATUS, dated evidence) на месте и согласованы.
Маршрут находок: `route: fix` (задан политикой #726, применим независимо от
цвета вердикта).

Outside findings: нет (mode=issues, outside_findings пуст).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6ImM4NTQzM2Y5ZmExNDAzNTJmZTI1N2EyNGU0YmNiOTdkZjVlNDAwZTZhZTU5M2UxMWZlNDZlMGE0NDZkMDViYTQiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiIzNjUxODMwNzk1MTI2NDY2NmM1MDBmNTdjOGI5NTI4OTRjNzRhMWI2ZTdjM2JmMTJhOGZkMjk4ZGYyODdlZDU4IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMDkwLCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiI5MTE0NWMxNTYyMTExOTFjOGM5NGIyYzVlZDMzNGRkOTM0MTJkMjlhIiwidHJlZSI6Ijg5ZTQwMDcxYmQxMWY4MmM5YzkzYzcxN2M2NWI5NGRmOWJjOTJmZDQiLCJib2R5RGlnZXN0IjoiMjM0MGRmZTVmMzA3N2Q0MWQ3MjlhNGQ4OTU3ZjIzNTM0MTU4MzM0MGQyNjExOGM3MDczMzk2NTkyNmRjMWRmMCIsInByb2R1Y2VyUnVuIjoiNDA0ODI0NDkxNDEiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjAzMjdmODZjMTBhZWE4M2NmOTAxOTA2NjU0MGZlZDIxYmE5YTQ1ZjJkZGI5NjcxMWFkN2JmMGY2ZmE5MDZiN2QiLCJ2ZXJkaWN0RGlnZXN0IjoiYWQxZGE2ODg1NDZkNzdkOGNlYWI0YjRiMmJhOTNiNTkxYjQyNGQ1NDFhYmU1NGZlYmRmYzMyY2U0NjUzNDUyZCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiI4ZGZiM2JlMGMxNDJlOGQxYTFlYzEyMDg4NWU0ODhmMTViMTk4N2Q5ZTU2ZGIxZWIzODJiNjlkZDIwNDQxMWVhIiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDM4NjY2NDc4LCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMDkwI2lzc3VlY29tbWVudC02NDM4NjY2NDc4IiwiYm9keURpZ2VzdCI6Ijk5MDNlNTQ4NGU1M2VkNTQ3ODhkZGMzYjgxNjMwNGNhZWUwZGUzYTQ5NDNiNzJjMTk0ZDAyMDUzNTUxN2RhZmYifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1090-lqi-event-loop`, коммит `91145c156211` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `89e40071bd11f82c9c93c717c65b94df9bc92fd4`
  ```
  git log --all --format='%H %T' | grep 89e40071bd11
  ```
- Тело issue: `2340dfe5f3077d41d729a4d8957f235341583340d26118c70733965926dc1df0`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40482449141,"run_attempt":1,"digest":"1e19cfa17b23313e25dc8aaab65ff600aba8d3247ceba1bf694f7a95d51c2e02"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjIsIm91dHB1dF90b2tlbnMiOjMyODEyLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEyOTM4NCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMxMTU2ODksImNvc3RVc2RFc3RpbWF0ZSI6MS40Njg5MTc3OTk5OTk5OTk4fV0sInR1cm5zIjo0NSwiZHVyYXRpb25NcyI6Mzk5OTk2LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS40Njg5MTc3OTk5OTk5OTk4LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=62 output_tokens=32812 cache_creation_input_tokens=129384 cache_read_input_tokens=3115689 num_turns=45 -->
