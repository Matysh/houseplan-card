# CODE-REVIEW — issue #1117, заход r1

Вердикт: зелёный · заход r1 · блокирующих циклов 0/4 · High: 0 · Medium: 0 → в задаче

Материал: `1b985c5659a8ef32a2dbf6387f691a9cad669fb5` (commits `937d1c9a9` + `1b985c565`,
ветка `issue/1117-dreame-history`). Трек: `ask`. Маршрут вердикта зафиксирован
политикой запуска: `route: fix`.

## Скоуп

Баг #1117: историческая уборка Dreame, у которой архивный JSON не содержит
`map_index` (поле отсутствует либо явный `null`), отклонялась матчером
`history_route()` как `coordinates_unverified`, хотя `saved_map_id` совпадал с
уже откалиброванным native-свидетелем. ТЗ требует точечного исправления
сравнения floor/slot только для исторического пути, с сохранением строгости
обычного live-сопоставления, ACL/lease и persisted-данных.

Изменённые файлы (A/B/C по ТЗ):
- A: `custom_components/houseplan/vacuum_history.py` — единственная
  поведенческая правка, локализована в `history_route()`.
- B: `tests_backend/test_vacuum_history.py`, `tests_backend/test_ha_vacuum_history.py`,
  `test/fixtures/vacuum-history/produce.py` + новый fixture
  `dreame-tasshack-2.0.2-no-slot.json`, три новых декларации в
  `scripts/mutation-registry.mjs`, вычисляемые inventories
  (`scripts/ci-registry-inventory.json`, `test/fixtures/845-wall-corpus-identities.json`).
- C: `docs/VACUUM.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`,
  `docs/CHANGELOG.md`/`.ru.md`, `docs/release-ledger/v1.82.0/1117.json`.

`Issue:`/`User-Visible: yes` трейлеры и парный CHANGELOG RU+EN — в одном
коммите `937d1c9a9` (диапазон диффа подтверждает совместное изменение файлов;
полные сообщения коммитов инструментом ревью не читаются — см. «Чего не
проверял»).

## Как проверялось

Static-first: прочитан `REVIEW_CONTEXT` (тело issue/ТЗ, handoff, ciEvidence),
затем через `run_check`:
- `read:diff` — полный base→candidate дифф по всем изменённым файлам, прочитан
  целиком.
- `read:log` — подтверждён двухкоммитный диапазон (`937d1c9a9`, `1b985c565`),
  совпадает с заявленным в handoff.

Полностью прочитан код `custom_components/houseplan/vacuum_history.py` (не
только hunk) и смежный `vacuum_paths.py` (`dreame_coordinate_key`,
`same_native_coordinates`, `number`) — чтобы независимо проверить типизацию
floor/slot, fallback-правила и неизменность live-пути. Прочитаны целиком
оба тестовых файла (новые кейсы + соседние неизменённые, чтобы убедиться, что
новая логика не ломает существующие assert'ы), `produce.py`, новый fixture,
`vacuum_routes.py::effective_routes`, вызывающий код в
`vacuum_history_websocket.py` (подтверждено: `history_route` вызывается без
изменений сигнатуры, wiring не трогали — соответствует не-скоупу).
Проверены `scripts/release-ledger.mjs` (валидатор категорий/обязательности
`summary`) и один существующий `line-fix`-ledger для сверки формата.

Исполняемых проверок через `run_check` для продуктового кода на этом материале
не запускал: в объявленном манифесте для этого диапазона нет `check_id` для
прогона `tests_backend/*` (только `read:base:*` для этих файлов и
`build:*`/`smoke:*`/`unit:test/*.mjs` для фронтенда/тулинга, не относящихся к
правке). Диффу не нужен ни один из объявленных `build:*`/`smoke:*` — правка
не затрагивает фронтенд, бандл или typecheck-поверхность. Опирался на уже
пригодное доказательство: validate-gate CI на точном SHA материала
(https://github.com/Matysh/houseplan-card/actions/runs/40765991998, «review-light
proof is complete») и отчёт автора о реальном прогоне
`pytest tests_backend/test_vacuum_history.py tests_backend/test_ha_vacuum_history.py
tests_backend/test_vacuum_paths.py tests_backend/test_ha_vacuum_paths.py -q` →
197 PASS с настоящим Home Assistant harness. Поверх этого провёл независимую
ручную трассировку кода (ниже) вместо повторного запуска — повторный прогон
того же окружения/входов не даёт нового сигнала при неизменном коде и тестах.

## Независимый разбор кода (до сверки с хендоффом)

`history_route()` до правки сравнивал `dreame_coordinate_key(identity[1]) !=
dreame_coordinate_key(value.map_key)` целиком (строгое равенство пары
floor/slot). Historical `map_key` строится в `history_snapshot()` как
`[map_id, saved_map_id, map_index]`; `saved_map_id` там уже обязателен
(`data.get("saved_map_id") is None` → `coordinates_unverified`, не менялось
этой правкой). Поэтому `history_key[0]` после правки — это всегда typed
`saved_map_id` без фоллбэка на `map_id` (фоллбэк в `dreame_coordinate_key`
используется только когда `fields[1] is None`, что для истории уже исключено
выше по стеку) — это ровно требование «правило не разрешает fallback для
исторического JSON» без необходимости отдельной проверки в `history_route`.

Новый код раскладывает сравнение на floor и slot раздельно:
```
if native_key is None or native_key[0] != history_key[0] \
        or history_key[1] is not None and native_key[1] != history_key[1]:
    continue
```
Прошёл вручную всю таблицу контракта из ТЗ (Передан/Передан, Передан/Отсутствует,
Отсутствует/Передан, Отсутствует/Отсутствует) подстановкой значений — во всех
четырёх случаях поведение совпадает с требуемым, включая разбор по типам:
`0` как валидное значение (проверка `is not None`, не truthiness — типичный
риск «Python bool=0» закрыт), `"0" != 0` (разнотипица не схлопывается),
`bool`/`float`/`list`/`dict` в `map_index`/`saved_map_id` отклоняются на уровне
`dreame_coordinate_key` (`type(value) not in (str, int)`) ещё в
`history_snapshot`, то есть никогда не доходят до `history_route` как «мнимое
отсутствие».

Кандидаты (`current`/`previous`) собираются в `matched`, ключ — `route["id"]`:
это даёт дедупликацию одинакового route из обоих слотов (не создаёт ложной
неоднозначности) и `ambiguous`, если два **разных** route прошли проверку
координат, причём эта проверка (`len(matched) != 1`) выполняется **до**
проверки `space`/`calibration` — то есть «один некалиброванный + один
калиброванный» всё равно даёт `ambiguous`, а не выбор калиброванного первым
match'ем. Это закрывает прямо названный в ТЗ риск «выбор первой откалиброванной
строки».

Проверил обратную совместимость: существующий (неизменённый) тест
`test_previous_coordinate_witness_zero_and_ambiguous_routes` (строгое
равенство `saved_map_id=0, map_index=0` с обеих сторон) и
`test_history_transport_map_id_alone_does_not_prove_the_saved_floor`
(посчитан вручную) проходят через новую decomposed-логику с тем же
результатом, что и через старую строгую проверку — регрессии на «оба слота
заданы» нет.

## Сопоставление с хендоффом и доказательствами по AC

| AC | Чем доказан | Чем краснеет | Независимая проверка |
|---|---|---|---|
| AC1 | `test_history_without_slot_uses_unique_saved_map_native_proof` (explicit+legacy×absent/null, через настоящий `effective_routes()`) | Вручную подставил old-code формулу: `(36,None) != (36,1)` → `continue` → `matched={}` → `coordinates_unverified`. Подтверждено: тест красный на старом коде, зелёный на новом | Код прочитан, логика верна |
| AC2 | `test_history_optional_slot_table_preserves_known_and_typed_slots` (12 комбинаций), `test_history_optional_slot_never_coerces_malformed_identity` (10 комбинаций) | Параметризованные `allowed=False` строки и malformed-инварианты — прямые negative assertions в самом тесте | Прогнал все 12 строк таблицы вручную — совпадают с кодом без исключений |
| AC3 | `test_slot_absence_still_requires_the_same_source_native_route_passport` (8 полей), `test_slot_absence_does_not_relax_saved_floor_or_native_validity` (5 identity) + существующий `test_same_bounds_foreign_or_unproved_native_map_is_refused` | `pytest.raises(PathRejected, match="coordinates_unverified")` в каждом параметре; mutant `history-optional-slot-forgets-saved-floor-1117` зарегистрирован (не исполнялся, ночной процесс) | Проверено чтением: source/provider/schema/quality/route/map-поля проверяются до слот-сравнения, правка их не касается |
| AC4 | `test_two_slots_for_one_saved_map_are_ambiguous_before_calibration` (перестановки ×8), `test_duplicate_native_route_and_missing_space_or_calibration_keep_exact_results` | `pytest.raises(PathRejected, match="ambiguous")` независимо от порядка/калибровки; mutant `history-optional-slot-chooses-calibrated-first-1117` зарегистрирован, не исполнялся | Подтверждено чтением: `len(matched)!=1` проверяется раньше `calibration is None` |
| AC5 | `test_original_producer_no_slot_fixture_has_unchanged_pin_hashes_and_methods` — сверка pin/AST/source-hash и побайтовое совпадение payload кроме отсутствующего поля | Тест падает, если `syntheticInput`/`pin`/`methodAstSha256`/`sourceSha256`/`metadata` разойдутся, или если в поле `payload` появится что-то кроме отсутствия `map_index` | Это сравнение двух **уже закоммиченных** JSON, а не повторный запуск upstream-producer в тесте (внешний pinned source недоступен в CI) — задокументировано в handoff как ручной прогон автора с 5 hash-сверками; тот же паттерн уже используется в проекте для исходного `-two-records` fixture. Не новый дефект, но и не независимо переисполненное доказательство — отмечено как ограничение ниже |
| AC6 | `test_original_producer_optional_slot_through_registered_ws_preserves_store_and_live` — настоящие `houseplan/vacuum/history/{list,get}` через `hass_ws_client`, `Store.async_save`/`services.async_call` замоканы на `pytest.fail` | WS-ответ, Store-spy и call-count — реальные negative/positive assertions в самом тесте | Проверено чтением: тест переиспользует существующий `prepared()`/`catalog()`/`request()` конвейер (тот же, что у соседних ACL/held-read тестов), не кустарный прямой вызов pure-функции |
| AC7 | Существующие client-side unit/smoke (43 Node unit, 7+35 smoke) из отчёта автора; `history_route`/`history_snapshot`/`vacuum_history_websocket.py` вне правки | Не исполнял повторно (frontend не менялся, CI уже зелёный на этом SHA) | Подтверждено чтением диффа: ни один frontend/рендер-файл не изменён |
| AC8 | Ревью диффа + `docs/release-ledger/v1.82.0/1117.json` + `scripts/release-ledger.mjs` | — (неисполняемый AC, проверяется составом диффа) | Дифф строго A-уровневый (один файл), B — тесты/fixture/реестр мутаций/инвентари, C — документация; новых API/UI/миграций/polling нет. Ledger-классификация `line-fix`/`introducedBy:999`/`baseStable:v1.82.0` прошла собственноручную проверку по `validateEntry()` — `summary` не требуется, т.к. `isUserReleaseEntry` включает только `major`/`stable-fix`, `line-fix` не входит в пользовательский milestone (соответствует тексту ТЗ) |

## Что проверено и корректно

- Сравнение floor/slot декомпозировано верно по всем четырём ячейкам таблицы
  контракта, включая типовые ловушки (`0`, `"0"` vs `0`, bool/float/array,
  отсутствие vs `null`).
- Дедупликация кандидатов по `route["id"]` и порядок проверок
  (`ambiguous` → `missing_space` → `needs_calibration`) соответствуют ТЗ и не
  открывают выбор первой калиброванной строки.
- `saved_map_id` остаётся обязательным для истории, fallback на `map_id`
  исторического JSON недостижим (структурно, через уже существующую проверку
  в `history_snapshot`), live-путь (`dreame_coordinate_key`,
  `same_native_coordinates`, `vacuum_history_websocket.py`) не тронут.
- Новые тесты используют настоящие `effective_routes()` (explicit и legacy) и
  настоящий зарегистрированный WS-эндпоинт (не прямой вызов pure-функции,
  выдаваемый за endpoint-proof).
- Три новые декларации в `scripts/mutation-registry.mjs` зарегистрированы (не
  исполнены — в рамках разрешённой политики), и их `find`-паттерны дословно
  совпадают с текущим кодом (проверено построчно) — мутанты не станут тихим
  no-op при ночном прогоне.
- `docs/STATUS.md` счётчики тестов (+9 pure backend, +1 HA-harness) совпадают
  с фактическим числом новых `def test_`/`async def test_` в обоих файлах
  (пересчитано вручную).
- `docs/VACUUM.md`/`DEVELOPMENT.md`/CHANGELOG формулировки соответствуют
  фактической реализации, без новых i18n-ключей и без противоречия
  `docs/USER-GUIDE.ru.md` (раздел «Просмотр прошлой уборки» не требует правки
  — текст не специфицирует внутренний матчинг и не становится неточным).
- `docs/release-ledger/v1.82.0/1117.json` валиден по `scripts/release-ledger.mjs`
  (`validateEntry`): schema/issue/baseStable/category/rationale заполнены,
  `introducedBy` присутствует для `line-fix`.

## Чего не проверял

- Не исполнял `pytest tests_backend/...` сам: в манифесте проверок для этого
  материала нет `check_id` для запуска backend-тестов (есть только
  `read:base:*` для затронутых файлов и фронтенд-ориентированные
  `build:*`/`smoke:*`/`unit:test/*.mjs`). Опирался на зелёный validate-gate CI
  точного SHA и отчёт автора (197 PASS) плюс собственную ручную трассировку
  кода против каждого нового теста — это не равносильно независимому
  повторному исполнению, но соразмерно объёму правки (один backend-файл,
  manifest не предлагает подходящего executable oracle).
- Не проверял буквальные trailers (`Issue:`/`User-Visible:`) в телах коммитов
  напрямую — у `read:log` нет режима, возвращающего полные сообщения, только
  oneline. Полагаюсь на то, что `process-gate.mjs --issues` в отчёте автора
  прошёл (0 warnings) и что тот же механизм входит в зелёный validate-gate CI.
- Не исполнял producer (`produce.py`) против внешнего vendor source — он не
  vendored в репозитории; верификация hash/AST-пина — задокументированный
  ручной прогон автора (см. AC5 выше), а не воспроизведённое мной
  доказательство.
- Не запускал frontend/typecheck/smoke-проверки (AC7) — диапазон не меняет
  frontend-код; это соразмерно объёму (PROCESS.md §8), а не пропуск риска.

## Находки

Нет (High: 0, Medium: 0). Побочных находок вне скоупа не обнаружено.

## Маршрут

`route: fix` (зафиксирован политикой запуска для данного трека/этапа).

---

<!-- hp:review-publication-receipt eyJzY2hlbWEiOiJob3VzZXBsYW4tcmV2aWV3LWRvY3VtZW50LXB1YmxpY2F0aW9uL3YxIiwicGF5bG9hZERpZ2VzdCI6IjgyYmYyNGEwNzY3NTcwZGY0OWZiY2I4MjY1YzFhOTJlNjA1ZTNlMDVhODcxMjRjMjJmMjJlOTdlY2IxMzJkZjYiLCJyZWNlaXB0Ijp7InNjaGVtYSI6ImhvdXNlcGxhbi1yZXZpZXctcHVibGljYXRpb24vdjEiLCJ0eXBlIjoiY29tcGxldGUiLCJrZXkiOiJjZTMxNjY1NzQ3ODQ3NWM2OTRjZjg3NjY1MGZhNTI0NDM5NmQ3OWFlYjVhZGE3YWZlY2NhMDZiYmFmMTQyNzU2IiwiaWRlbnRpdHkiOnsicmVwbyI6Ik1hdHlzaC9ob3VzZXBsYW4tY2FyZCIsImlzc3VlIjoxMTE3LCJzdGFnZSI6ImNvZGUiLCJyb3VuZCI6MSwibWF0ZXJpYWwiOiIxYjk4NWM1NjU5YThlZjMyYTJkYmY2Mzg3ZjY5MWE5Y2FkNjY5ZmI1IiwidHJlZSI6IjEwMmUxY2U5Y2E1MWUzNDY1M2QwNmI3N2I1NWE4YTkyOTQ4NjNiYjEiLCJib2R5RGlnZXN0IjoiMDhmODIwODNhMzMzM2EzOGIwZDJiOTExYmIwMmRlZTk3NzI1YmEzZDMzNmFmMWZlNTQwNjFjYzZhZDNkZjI5NiIsInByb2R1Y2VyUnVuIjoiNDA3NjcyOTQxNDQiLCJwcm9kdWNlckF0dGVtcHQiOiIxIn0sInJlcG9ydERpZ2VzdCI6IjZiNzM5ZDhlYWExOTAwMzdjZjI3MzRkZGE1OTk0N2E5YzM0ZGFjN2Y5MjBjNjM0OTYxZTkyN2M4MTJjNDkyOGEiLCJ2ZXJkaWN0RGlnZXN0IjoiNzYzMTkzNjU2OGZiY2YzNDVlMjM5MWYzMDc2MDc0Y2JlNjRhMjAyYTFjZmFhZWVhZWIwMjhlNDMyYTliZTI4NCIsInZlcmRpY3RDYW5vbmljYWxEaWdlc3QiOiJiMjNlY2U3OTcxYzA2Mzc4ZWNiZWY3ZmVmN2ZmMTBhZTdjNmM3YzBkOTdhMmY0OWFkMjBkZjQ2NzZiZWM0MDg1IiwiZmluZGluZ3MiOltdLCJjb21tZW50Ijp7ImlkIjo2NDgwNzE0NTkzLCJ1cmwiOiJodHRwczovL2dpdGh1Yi5jb20vTWF0eXNoL2hvdXNlcGxhbi1jYXJkL2lzc3Vlcy8xMTE3I2lzc3VlY29tbWVudC02NDgwNzE0NTkzIiwiYm9keURpZ2VzdCI6IjhlOGUwMDE3OTFjNDFlNmQ1NDUzYzBjNjIyMDlkZDhhMTNhNmEwOTEzMGM2MTE2MDQyYmFhMDhjOWJkZjZhNmUifX19 -->

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/1117-dreame-history`, коммит `1b985c5659a8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `102e1ce9ca51e34653d06b77b55a8a9294863bb1`
  ```
  git log --all --format='%H %T' | grep 102e1ce9ca51
  ```
- Тело issue: `08f82083a3333a38b0d2b911bb02dee97725ba3d336af1fe54061cc6ad3df296`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
- Сертификат переноса счётчиков: `{"run_id":40767294144,"run_attempt":1,"digest":"b6e1eb945b967afd879cb830ea7fe3f629dc8fdd8ba7b1197dfe4775181371bd"}`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1zb25uZXQtNSIsImlucHV0X3Rva2VucyI6NjYsIm91dHB1dF90b2tlbnMiOjM1MTU2LCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjEzNzMyOCwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjMxNzQ4NTcsImNvc3RVc2RFc3RpbWF0ZSI6MS41MzU5NzUzOTk5OTk5OTk3fV0sInR1cm5zIjo0MSwiZHVyYXRpb25NcyI6NDgwOTM1LCJmaW5pc2hSZWFzb24iOiJzdWNjZXNzIiwib3V0Y29tZSI6InN1Y2Nlc3MiLCJwcm92aWRlckNvc3RVc2RFc3RpbWF0ZSI6MS41MzU5NzUzOTk5OTk5OTk3LCJiaWxsaW5nIjoicHJvdmlkZXItZXN0aW1hdGUtbm90LW9hdXRoLWNoYXJnZS1vci1xdW90YSJ9 -->
<!-- hp:usage input_tokens=66 output_tokens=35156 cache_creation_input_tokens=137328 cache_read_input_tokens=3174857 num_turns=41 -->
