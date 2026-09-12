# CODE-REVIEW — issue #545, заход r1

Материал: `81daebd788c532f9d0e321010ba471282ae076d1` (рабочая копия на нём же,
`git fetch`/`checkout` не выполнялись). Диапазон `origin/dev..HEAD` — один
коммит `81daebd7 fix: complete radar source inventory (#545)`.

## Скоуп диффа

```
custom_components/houseplan/radar_validation.py |  31 ++-
docs/ARCHITECTURE.md                            |   7 +
docs/CHANGELOG.md                               |   5 +
docs/CHANGELOG.ru.md                            |   5 +
docs/TESTING.md                                 |  12 +
scripts/mutation-gate.mjs                       |  17 ++
tests_backend/test_ha_radar.py                  |  64 ++++-
tests_backend/test_ha_radar_websocket.py        | 170 ++++++++++-
tests_backend/test_radar_validation.py          |  62 ++++
9 files changed, 358 insertions(+), 15 deletions(-)
```

`radar.py` и `radar_websocket.py` **не менялись** — оба уже читали общий
inventory через `radar_source_entity_ids()`/`coordinator.source_ids()`,
поэтому исправление одного extractor'а автоматически чинит подписки
coordinator, setup-подписку и ACL. Соответствует «Затронутые файлы» ТЗ
(«radar.py/radar_websocket.py — только если потребуется», и не
потребовалось).

## Как проверялось

Прочитан весь диффнутый код построчно (`radar_validation.py`,
`mutation-gate.mjs`, три backend test-модуля, доки), плюс непосредственно
задействованные, но не изменённые call sites в `radar.py` (`source_ids()`,
`_resubscribe_sources`) и `radar_websocket.py` (`_can_read`,
`ws_radar_subscribe`, `ws_radar_setup_inspect`, `ws_radar_setup_subscribe`),
чтобы убедиться, что фикс действительно долетает до подписок и ACL, а не
только до валидации.

Дешёвые гейты уже подтверждены Validate на этом SHA (ссылка в хендоффе,
run 34716865575) — не перегонялись:
- `Фронтенд: типы, юниты, мутанты, синхрон бандла` → success (покрывает
  `tsc --noEmit`, `npm test`, `npm run build`, `no-new-any`).
- `Бэкенд: pytest в Home Assistant` → success (полный `tests_backend`, а не
  urlезанный набор без HA — так что backend действительно доказан, а не
  тихо пропущен).
- `Hassfest`, `HACS` → success.
- `Мутанты по диффу` (все 6 шардов) → success. Проверил лог шарда 6/6
  напрямую (`gh run view --job 103616172006 --log`):
  ```
  ok   radar-profile-source-entity-id-omitted: тест покраснел, как обязан
  ```
  Это независимое подтверждение AC5 из самого CI-лога, а не только со слов
  автора.
- `Golden`, `Смоки`, `Перф-смок` → skipped (тяжёлые гейты, диффом не задеты
  `src/**`/рендер — корректно не входят в обычный push).

Не прогонял сам: `npx tsc --noEmit`, `npm test`, `npm run build`,
`pytest tests_backend`, `mutation-gate` — все уже зелёные на этой SHA
(см. выше), перегонка добавила бы только время. `check-docs.mjs` и golden
не нужны: диффом не тронут ни один файл `src/**`, экран/рендер не меняется.
`npm run invariants` не нужен: геометрия (`layout`, `marker.space`,
`open_spans`, толщина стен) диффом не тронута — меняется только
radar source inventory, HA-подписки и ACL. Браузерные smoke не нужны по той
же причине (нет фронтенд-файлов в диффе; `smoke-select.mjs` не запускал —
diff не содержит ни одного файла, который мог бы задеть выборку по
символам, а тема задачи (backend radar ACL) не пересекается с
рендер-путём).

## Проверка по AC

- **AC1 (exact profile inventory).** `_PROFILE_SOURCE_ROLES` в
  `radar_validation.py:23-32` — явная таблица `profile → (group, roles)`,
  заменяющая эвристику `key.endswith('_entity')`. Значения совпадают
  построчно с контрактом ТЗ п.3: `range_v1` → `("entity_id",
  "presence_entity")`, `zones_v1` → `("entity_id",)`, слоты — `x/y/distance/
  angle_entity` + optional `presence_entity`, `presence_v1` — без вложенных
  ролей. Параметризованный тест
  `test_stage1_source_inventory_is_exact_for_each_profile`
  (`test_radar_validation.py`) доказывает точный set для всех шести
  profiles, включая контрольный `future_entity`-мусор внутри common и
  вложенной группы — он остаётся вне set. Отдельный тест на неизвестный
  `profile: "future_v2"` возвращает `set()` целиком (соответствует
  контракту п.1: неизвестный профиль не даёт даже общих ролей). Доказано
  автотестом, тест умеет падать (см. AC5 mutation witness — красный на
  урезанном контракте).

- **AC2 (setup live-update range/zone).**
  `test_setup_subscribes_to_range_and_zone_primary_sources` в
  `test_ha_radar_websocket.py` гоняет реальный
  `ws_radar_setup_subscribe` (мокаются только `_coordinator` и
  `async_track_state_*`/`may_write`, как и в остальных тестах файла — то
  есть production-shaped путь). Для `range_v1`/`zones_v1` с единственным
  `entity_id`-источником (без occupancy/count/presence) проверяет, что оба
  HA-стрима (`state_report`, `state_change`) подписаны именно на этот
  entity, и что вызов callback приводит к новому `send_result` через
  ограниченный `1/MAX_FRAME_HZ` коалесер — без переоткрытия. Проверены и
  saved, и draft путь в одном тесте. AC выполнен.

- **AC3 (saved coordinator + lifecycle).**
  `test_range_and_zone_primary_source_subscriptions_rebind_and_teardown` в
  `test_ha_radar.py` — реальный `RadarCoordinator`, монkeypatch только на
  `async_track_state_report_event`/`async_track_state_change_event`.
  Проверяет: `coordinator.source_ids("radar")` содержит `entity_id`
  range/zone; при rebind (смена документа + `async_refresh`) старые
  подписки полностью отписаны (`cleaned`), новые — ровно на новый entity;
  `teardown()` снимает оставшиеся. AC выполнен.

- **AC4 (ACL fail-closed).**
  `test_range_and_zone_primary_sources_are_permission_checked_fail_closed`
  использует записывающий `_Permissions.checked` (пер-entity, а не булев
  allow/deny — именно то, что в «Рисках» ТЗ названо необходимым, чтобы тест
  не проходил по общему allow/deny). Deny выставлен точно на
  range/zone `entity_id`; проверены `ws_radar_setup_inspect` (saved и
  draft) и `ws_radar_subscribe` (live) — во всех трёх ветках получен
  `source_restricted`/`health: restricted` с пустыми `targets/ranges/zones`
  (секретные `secret-range`/`secret-zone` из фикстуры `frames_for_space` не
  утекают). AC выполнен.

- **AC5 (mutation witness).** Новый мутант
  `radar-profile-source-entity-id-omitted` в `mutation-gate.mjs` вырезает
  `entity_id` из обеих ролей (`range_v1`, `zones_v1`) и указывает guard'ом
  именно новый параметризованный тест. Проверено чтением: удаление роли
  ломает assertion точного set в тесте → тест обязан покраснеть. Проверено
  исполнением — CI-лог шарда 6/6 (`Мутанты по диффу`, run 34716865575)
  прямо печатает `ok radar-profile-source-entity-id-omitted: тест
  покраснел, как обязан`. Двойное (чтением + исполнением) подтверждение.

- **AC6 (bounded runtime).** `radar.py` не менялся: coordinator по-прежнему
  регистрирует ровно два агрегированных listener'а
  (`_resubscribe_sources`, строки не тронуты), `MAX_FRAME_HZ` не менялся.
  Setup-подписка в `radar_websocket.py` — тоже два listener'а на marker
  (не менялась). Никаких polling/timer на source не добавлено — сам fix
  расширяет только *set* уже читаемых entity, не механизм подписки.
  Проверено чтением (файлы, реализующие лимиты, не в диффе).

- **AC7 (совместимость и артефакты).** Схема `marker.radar` не менялась
  (только внутренний Python-словарь ролей). `docs/ARCHITECTURE.md`
  описывает единый inventory-контракт как основу для listeners/ACL;
  `docs/TESTING.md` называет три guard-модуля и мутанта; оба changelog
  (`CHANGELOG.md`, `CHANGELOG.ru.md`) обновлены в том же коммите, без
  раскрытия security-чувствительных деталей (совпадает с «Release
  Metadata» ТЗ). Frontend/i18n не тронуты. Трейлеры коммита: `Issue: #545`,
  `User-Visible: yes` — оба changelog присутствуют, условие выполнено.

## Что проверено чтением, но не отдельным тестом

- `_immediate_source_ids` в `radar.py:197-213` — отдельная, не
  происходящая из нового `_PROFILE_SOURCE_ROLES`, ручная классификация
  «мгновенных» источников (используется только для решения
  immediate-vs-coalesced публикации, не для полноты подписки/ACL — та
  берётся из `radar_source_entity_ids()` несколькими строками выше и уже
  чинится этим диффом). Файл не тронут этим коммитом и был идентичен уже
  на аудиторском SHA `66a64854` — то есть это существующее, не внесённое
  этой задачей поведение. У неё есть асимметрия: `ranges[].presence_entity`
  считается «мгновенным», а сам `ranges[].entity_id` — нет (`zones[].entity_id`
  — считается). ТЗ прямо разрешает оставить отдельную политику для
  immediate-классификации («Принято предположительно», п.2) и явно требует
  сохранить существующую семантику немедленных/коалесцированных обновлений
  (контракт п.9) — эта асимметрия под неё подпадает, а не под AC2/AC3
  (те про полноту подписки/ACL, доказанную тестами выше). Не блокирует;
  фиксирую как наблюдение, не находку — правка вне скоупа этой задачи и не
  меняет ни completeness инвентаря, ни ACL.

## Находки

Нет ни High, ни Medium, ни Low. Диф точный, доказательства по каждому AC —
автотестом с проверкой «умеет падать» (AC1, AC5 — двойное подтверждение
чтением и исполнением CI), либо чтением production-shaped теста, который
реально гоняет проверяемый код (AC2-AC4, AC7), либо чтением незатронутого
кода с обоснованием, почему он не должен был измениться (AC6, наблюдение
по `_immediate_source_ids`).

## Не проверял и почему

- `npx tsc --noEmit`, `npm test`, `npm run build`, `pytest tests_backend`,
  `mutation-gate.mjs --check`/`--changed` — не перегонял: Validate на точном
  SHA `81daebd7` зелёный, включая полный backend HA harness и все 6 шардов
  diff-мутантов (проверено по логу, не только по статусу).
- `golden:verify`, `demo/smoke_*.mjs`, performance-профили — не запускал:
  диффом не тронут ни один файл `src/**` и ни один рендер-путь; Validate
  корректно пропустил (skipped) golden/smoke/perf как тяжёлые гейты для
  обычного пуша без `Release:`-трейлера.
- `npm run invariants` — не запускал: диффом не тронуты геометрия,
  `layout`, `marker.space`, `open_spans` или толщина стен.
- Ручного тестирования в UI не проводил (задача backend-only, UI не
  меняется по контракту ТЗ и подтверждено отсутствием файлов `src/**` в
  диффе).

## Вердикт

Зелёный. Все AC1–AC7 доказаны либо исполняемым тестом с подтверждённой
способностью падать, либо чтением незатронутого кода с явным обоснованием.
Единственное наблюдение (`_immediate_source_ids` асимметрия) — не находка:
предсуществующий код вне скоупа, явно разрешённый ТЗ оставить как есть.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/545-radar-source-inventory`, коммит `81daebd788c5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `f8ce151d796b63484e9b8b59865488102273291a`
  ```
  git log --all --format='%H %T' | grep f8ce151d796b
  ```
- Тело issue: `8b063fe89abbf48179a894847dff1b5c223f394fa4f6e98ec284302624b71437`
- Вердикт конвейера: `green` · High 0
