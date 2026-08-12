# ТЗ #50 — экспорт и импорт конфигурации House Plan

- Issue: https://github.com/Matysh/houseplan-card/issues/50
- Приоритет: **P1**, feature
- Статус ТЗ: **реализовано локально** (ревизия 3; проверки запланированы на
  следующий пре-релиз по правилу владельца)
- Связано: #33 (жизненный цикл схемы конфига), #51 (custom decor images), #85
  (тесты должны уметь падать)
- Security scope: только пользователь, которому разрешена запись политикой
  `may_write` (`custom_components/houseplan/auth.py:16`); файл намеренно
  не анонимизируется

---

## 0. Что изменено ревью 2026-08-11

Ревизия 1 писалась «по памяти о модели». Ревью сверило каждое утверждение с
кодом v1.61.0; ниже — только то, что не сошлось, и принятое решение.

| # | Находка | Решение |
|---|---|---|
| R1 | **`PLAN_MODEL_VERSION` на бэкенде не существует.** ТЗ обещало «обязательный parity-test frontend/backend» и отказ при `model_version > PLAN_MODEL_VERSION`, но константа есть только во фронте (`src/plan-optimizer.ts:27`), в `custom_components/**` её нет ни одной. Сверять нечего | Ввести `PLAN_MODEL_VERSION = 6` в `const.py` и parity-тест — это входит в объём задачи (§5). Плюс: оптимизатор пишет поле только при `modelFrom < PLAN_MODEL_VERSION && meaningfulChanged` (`plan-optimizer.ts:382-384`), поэтому у большинства реальных конфигов поля **нет** — отсутствие трактуется как `0`, а не как ошибка |
| R2 | **Полный импорт по обычному пути записи стёр бы картинки планов.** `ws_config_set` после коммита зовёт `collect_plans`/`collect_attachments` (`websocket_api.py:817-819`), правило которых — «файл, на который ссылалась СТАРАЯ конфигурация и не ссылается новая, удалить» (`plans.py:273-299`). Полная замена конфига — ровно этот переход для всех планов сразу | Apply **не вызывает** collect-функции (§7). Это то, что делает one-deep Undo настоящим. Суточный sweep безопасен: он передаёт один и тот же конфиг с обеих сторон (`__init__.py:225-235`), а непривязанные планы по второму правилу `collect_plans` сохраняются |
| R3 | **Импорт с недостающим планом был бы отклонён существующим инвариантом.** `_missing_internal_plans` (`websocket_api.py:714-732`) блокирует запись кодом `missing_plan` для каждого нового внутреннего plan-url, которого нет на диске | Отсоединение файлов — не вежливость UX, а обязательное условие записи. Preview выполняет **ту же самую** функцию и показывает её результат до применения (§5.3, §6.2) |
| R4 | **Три разных способа сохранять layout-стор, служебные ключи теряются.** `layout/set|update|delete` пишут по чёрному списку (`websocket_api.py:195, 259, 657`), `optimize` — через `layout_meta` (`:906`), а `geometry/repair` — по **белому** списку `{"layout","rev"[,"repair_backup"]}` (`:314`, `:346`) и молча стирает `optimize_backup`/`optimize_pending`/`geom_pending`. Новый intent импорта умер бы там же | Нормативно: единственный helper записи layout-стора, все существующие вызовы переводятся на него в рамках этой задачи (§7). Существующая потеря `optimize_backup` в `geometry/repair` выделена в отдельный баг #87 |
| R5 | **Два независимых Undo в одном UI.** One-deep снапшот уже есть: `optimize_backup`/`optimize_pending` + флаг `can_optimize_undo` (`websocket_api.py:40-58`, `houseplan-card.ts:539`, кнопка `:12332`). ТЗ добавляло второй флаг `can_import_undo` и, значит, вторую кнопку на ту же ячейку | Один слот, одна кнопка. К снапшоту добавляется поле `kind: "optimize" \| "import"`, ответы `config/get`/`layout/get` отдают `can_optimize_undo` + новый `undo_kind`; подпись кнопки зависит от kind (§6.3). Имена ключей стора не меняются — миграция не нужна, существующий recovery продолжает работать |
| R6 | **`known_devices`/`new_device_ids` — bookkeeping инстанса, а не модель.** После импорта из чужого HA `diffNewDevices` объявит новыми все устройства цели (`houseplan-card.ts:3407-3412`) | При `source_fingerprint != target` эти два поля не импортируются и это показано в preview; при совпадении отпечатков импортируются буквально (§8) |
| R7 | **Layout-записи без `s` (legacy render-units).** `houseplan-card.ts:3514-3518`: отсутствие `s` = старые координаты, не привязанные к пространству | Space export их не видит по определению (правило `pos.s == space.id`), full export переносит буквально. Preview показывает отдельной строкой «позиции без пространства: N» (§5.2) |
| R8 | **Список ссылок для remap был неполон** — названы только `open_to`, `room_id`, room-label ключи и `pos.s` | §9.1 получает полную таблицу полей модели: `marker.controls[]`, `marker.tap_target`, `marker.vacuum.segment_map`, `room.settings.temp_source\|hum_source`, `opening.contact\|lock`, decor `entity`, layout-ключи `lg_<entity_id>` и `v_*` — с явным разделением «переименовать» / «сохранить буквально» |
| R9 | **Префикс `import.*` в i18n уже занят** мастером «создать пространства из этажей HA» (6 ключей: `import.title/hint/start/manual/progress/done`) | Все новые ключи — `backup.*`, секция настроек — `gs.backup_group`/`gs.backup_hint` (§4.1) |
| R10 | **Новая секция в «Общих настройках» валит смок с зашитым эталоном** — `demo/smoke_general_settings.mjs:53-56` фиксирует `rows: 15` и массив из девяти групп | Обновление эталона входит в объём задачи; оно же — естественный мутант по #85: если секция не отрендерилась, смок обязан покраснеть (§12) |
| R11 | **Golden для нового диалога требует ветки в harness.** `demo/golden/harness.mjs` умеет открывать ровно два диалога (`scenario.dialog === 'device'` и `'decor-color'`), плюс `GOLDEN_MATRIX_VERSION` (сейчас 10) надо поднять | §12 явно включает работу по harness и bump версии матрицы |
| R12 | **Треки пылесосов ключуются `marker_id` из конфига** и живут в отдельном сторе `houseplan.trails` без rev (`trails.py:104, 135-141`); сборщика сирот нет | После полного импорта recorder не только refresh-ится, но и удаляет прогоны, чьих маркеров больше нет (§7). Для Undo это безопасно: треки не входят в snapshot и в §3 записаны как принятая потеря |
| R13 | **`source_fingerprint` требует HA `instance_id`,** которого проект ещё не касался (`homeassistant.helpers.instance_id` — 0 вхождений в бэкенде) | Явная новая зависимость: получить в `async_setup_entry`, положить в runtime data, солить домен-сепаратором (§5) |
| R14 | **`MAX_EXPORT_BYTES` не существует, а реальные лимиты конкретны:** `MAX_CONFIG_BYTES = 2 MiB` (`validation.py:114`), `MAX_LAYOUT = 5000`, `MAX_SPACES = 50`, `MAX_MARKERS = 2000` (`validation.py:79-108`); у HTTP-вьюх `client_max_size` не задан | `MAX_EXPORT_BYTES = 8 * 1024 * 1024`, проверяется потоково до разбора JSON, ровно как в `HouseplanUploadView` (`http_api.py:185-189`) (§6.2, §9.3) |
| R15 | **`owner_path` в content manifest был JSON-pointer с индексами** (`/payload/config/spaces/0/plan_url`) — ломается от любой пересортировки | Ссылки по id: `{"owner":"space","id":…,"field":"plan_url"}` и `{"owner":"marker","id":…,"url":…}` (§5.3) |
| R16 | **Конфликт при apply был бы массовым из-за собственной вкладки.** Позиции пишутся debounce-ом 600 мс через `layout/update`, у которого нет `expected_rev` (`websocket_api.py:210-262`), — любое перетаскивание в фоне двигает layout rev, и пользователю пришлось бы заново выбирать файл | Добавлен `houseplan/import/revalidate {token}`: сервер уже держит проверенный candidate, пересчитывает preview и выдаёт свежие `expected_*_rev`, не требуя повторной загрузки файла (§6.2) |
| R18 | **`controls` перестанет быть целиком «буквальным» полем** — ревью ТЗ #84 (2026-08-11) вводит внутренние ссылки `marker:<id>` внутри того же массива. Скопированные буквально, они после remap id указывали бы в пустоту | §9.1 делит `controls` по префиксу значения: entity-ссылки буквально, `marker:`-ссылки ремапятся; ссылка за пределы импортируемого пространства удаляется и показывается в preview. Внести до коммита реализации, иначе понадобится миграция |
| R17 | **Единственная ws-команда без `may_write` — `houseplan/content/sign`** (`websocket_api.py:530`), и это сделано намеренно: read-only зритель обязан видеть фон плана, а подпись выдаётся только на собственный namespace и привязана к refresh token вызывающего | Не образец для новых endpoint-ов: export, preview, revalidate, apply и undo проверяют `_runtime` + `may_write` без исключений. Отдельный баг не заводится |

### 0.1 Правки после code review локальной реализации

Ревизия 3 уточняет не продуктовый UX, а проверяемые инварианты реализации:

- envelope сохраняет **фактический** `model_version` хранимого плана, включая
  `0` и future-значение; в `payload.config` это поле не дублируется и экспорт
  никогда не штампует текущую версию поверх данных;
- apply повторно проверяет внутренние plan-файлы под тем же `write_lock`, что и
  revisions; исчезновение файла между preview и apply возвращает стабильный
  `missing_plan`;
- при сбое paired commit handler один раз докатывает target, затем заменяет
  intent на rollback и восстанавливает before-pair. После ответа об ошибке
  restart не имеет права самостоятельно закончить импорт;
- token проверяет digest нормализованного candidate при каждом обращении;
  одновременно в памяти хранится не более трёх parsed preview **суммарно**, а
  не по три на каждого writer;
- HA-набор переименован в `test_ha_import_export.py` и расширен endpoint-
  проверками detach, remap, metadata, write failure, recovery и порядка events.

---

## 1. Цель

Дать владельцу переносимую резервную копию **модели House Plan** и безопасный
способ перенести одно пространство между собственными Home Assistant.

В v1 есть две операции:

1. **Полная конфигурация** — экспорт `config + live layout`; импорт полностью
   заменяет текущую модель после подробного предпросмотра.
2. **Одно пространство** — экспорт текущего пространства с принадлежащими ему
   объектами и позициями; импорт всегда добавляет новое пространство и ничего
   существующего не заменяет.

Это резервная копия модели, а не архив всего медиаконтента. Локальные планы и
вложения перечисляются в manifest, но их bytes в JSON не входят.

## 2. Зафиксированные решения

Ревизия 1 сняла следующие неоднозначности:

- `config` и `layout` экспортируются одним согласованным снимком под общим
  `write_lock`, а не двумя независимыми frontend-запросами;
- вместо невозможной буквальной транзакции двух HA Store используется
  crash-resumable paired commit с intent до первой записи;
- полный импорт получает одно безопасное Undo до следующего изменения плана;
- импортируемый файл разбирается строго на backend, до попадания недоверенного
  объекта во frontend runtime;
- локальный URL с другой HA instance никогда не связывается с одноимённым
  случайным файлом на target;
- правила владения layout-записями, remap внутренних id, повторного импорта и
  дубликатов HA binding определены явно;
- future model не понижается молча; неизвестные поля поддерживаемой версии
  сохраняются благодаря существующему `extra=vol.ALLOW_EXTRA`
  (`validation.py:709`);
- определён конечный UX, разрешения, error codes, recovery и release gate.

Ревизия 2 добавила к ним: переиспользование существующего слота Undo вместо
второго (R5), запрет collect-функций на пути импорта (R2), единый helper записи
layout-стора (R4), полную таблицу remap-ссылок (R8) и `revalidate` вместо
повторного выбора файла (R16).

## 3. Не входит в v1

- ZIP с локальными plan/PDF/image bytes;
- облачная синхронизация или расписание резервных копий;
- анонимизация entity/device ids, имён, ссылок или координат;
- экспорт vacuum trails (`houseplan.trails`), runtime caches, подписанных URL,
  undo/command stacks;
- merge полного backup в существующую модель;
- импорт пространства поверх существующего пространства;
- автоматический подбор «похожей» сущности на другой HA instance;
- перенос dashboard/card YAML и настроек самого Home Assistant.

Portable ZIP с assets является отдельным следующим этапом. Будущие custom
decor images из #51 подключаются к тому же content manifest, но не расширяют
scope этой версии.

## 4. Пользовательский интерфейс

### 4.1 Точка входа

В **«Общие настройки»** (`houseplan-card.ts:12236`) перед разделом
«Обслуживание планов» (`gs.grid_group`, `:12325`) появляется раздел
**«Резервная копия и перенос»** — `gs.backup_group` + `gs.backup_hint` — с двумя
кнопками в одном `div.colorrow.gsrow`, по образцу кнопки «Оптимизировать планы»:

- **«Экспортировать…»** (`mdi:download`, `backup.export_open`);
- **«Импортировать…»** (`mdi:upload`, `backup.import_open`).

Отдельные четыре кнопки для full/space не добавляются: вид импорта определяется
из файла автоматически. В настройках конкретного пространства в v1 нет
дублирующей кнопки.

Все новые i18n-ключи живут под префиксом `backup.*` — `import.*` занят мастером
этажей (R9). Оба словаря пополняются в одном коммите: `test/i18n.test.mjs:9`
падает при расхождении.

Раздел виден только при `_canEdit` (`houseplan-card.ts:652`, зеркало серверного
`can_write`). Backend независимо повторяет `may_write` для export, preview,
revalidate, apply и undo.

### 4.2 Экспорт

Диалог **«Экспорт House Plan»** содержит radio:

- **«Вся конфигурация»** — выбран по умолчанию;
- **«Текущее пространство: <title>»** — выключено, если пространства нет.

Под вариантами явно написано:

- файл содержит реальные HA ids, имена, ссылки и координаты (в отличие от
  HA-диагностики, которая часть полей вырезает — `diagnostics.py:12`);
- локальные изображения и вложения перечислены, но не вложены в JSON;
- trails и текущее состояние устройств не экспортируются.

Кнопка **«Скачать JSON»** запрашивает свежий backend snapshot и только после
ответа создаёт `Blob`, временный object URL и download. URL обязательно
revoke-ится. Экспорт ничего не записывает и не создаёт undo point.

Имена файлов:

- `houseplan-full-YYYY-MM-DD_HH-mm-ss.json`;
- `houseplan-space-<safe-title>-YYYY-MM-DD_HH-mm-ss.json`.

### 4.3 Импорт и предпросмотр

Кнопка «Импортировать…» использует скрытый `input[type=file]` с
`accept="application/json,.json"`. Выбор файла **не изменяет данные**. Файл
отправляется в backend preview endpoint, после чего открывается диалог с:

- именем и размером файла;
- видом экспорта, временем, версиями card/integration/model;
- признаком «эта HA instance» / «другая HA instance»;
- количеством пространств, комнат, стен, проёмов, декора, markers и layout;
- отдельной строкой «позиции без пространства (legacy): N» (R7);
- active / disabled / missing / virtual HA bindings;
- локальными assets: доступны, отсутствуют или непереносимы;
- всеми блокирующими ошибками и предупреждениями.

Неизвестный формат, неподдерживаемая будущая версия, невалидная schema или
превышение лимита дают read-only error dialog без кнопки применения.

### 4.4 Полный импорт

Preview показывает `current → incoming` минимум для spaces, rooms, markers и
layout и отдельный danger block:

> Текущая конфигурация и позиции будут полностью заменены. Локальные файлы на
> диске не удаляются. Отменить импорт можно только до следующего изменения.

Если локальные refs надо отсоединить, появляется обязательный checkbox
**«Импортировать без N локальных файлов»** со списком затронутых объектов.
Без него Apply недоступен — и это не вежливость, а условие записи (R3).

Footer построен на существующем контракте `dialog-action-footer` /
`dialog-action-danger` / `dialog-action-commit` (`styles.ts:2754-2776`):
«Отмена» и последней в DOM danger-кнопка **«Заменить конфигурацию»**. Initial
focus всегда на «Отмена»; Enter сам по себе не подтверждает замену.
Escape/close/scrim = cancel и ноль записей.

После успеха:

- закрываются открытые редакторские диалоги и жесты;
- очищаются локальные состояния: `_geometryHistory.clear()` (как в
  `_runAlignToGrid`, `houseplan-card.ts:11597`), `_dirtyPos`/`_sentPos`,
  `_defPos`, кэш `ContentSigner`, `_renderDeviceSnapshot`;
- выбирается прежнее пространство, если его id осталось, иначе первое;
- показывается toast с итоговыми counts;
- в том же разделе настроек появляется **«Отменить последний импорт»** —
  та же кнопка, что и у оптимизации, с текстом по `undo_kind` (R5).

Undo доступно только пока не было ни одного последующего config/layout write:
любой обычный `config/set` вызывает `_discard_optimizer_snapshot`
(`websocket_api.py:804`). Новый импорт или Optimize заменяет предыдущий
одноразовый plan-wide снимок.

### 4.5 Импорт пространства

Preview показывает итоговое название (`Гараж`, `Гараж (2)`, …), counts,
bindings и предупреждение, что глобальные цвета, icon rules, Glow defaults и
прочие общие настройки берутся с target instance.

Для binding, уже размещённого/настроенного на target, доступна одна общая
политика:

1. **«Пропустить повторяющиеся устройства»** — безопасное значение по
   умолчанию;
2. **«Добавить как статичные виртуальные обозначения»** — сохраняет позицию,
   имя, явную иконку, размер и угол, но удаляет управление, vacuum, controls,
   light/glow role и HA actions. Такой marker не влияет на данные плана.

Изменение политики пересчитывает preview до применения (через `revalidate`, без
повторного выбора файла). Footer: **«Отмена»**, **«Добавить пространство»**.
Это не destructive replacement, поэтому danger style не используется.

После успеха новое пространство выбирается автоматически. Оно может быть
удалено обычным существующим действием; отдельное Undo импорта пространства в
v1 не добавляется.

### 4.6 Responsive и accessibility

Оба сценария используют `hp-dialog`: focus trap, initial/restore focus, Escape
через существующий реестр поверхностей (`hp-dialog.ts:345`), scrollable body и
общий responsive footer. На узком экране нет горизонтального scroll; длинные
title/file names переносятся или сокращаются с полным `title`. Статус
чтения/preview/apply объявляется через `aria-live`.

Импорт/экспорт — безопасная dialog-based maintenance operation, поэтому она
должна работать на desktop и touch. Точные редакторские операции по-прежнему
остаются desktop-first согласно `docs/TOUCH-SUPPORT.md`.

## 5. Формат export v1

Один UTF-8 JSON без BOM:

```json
{
  "format": "houseplan-export",
  "export_version": 1,
  "kind": "full|space",
  "created_at": "2026-08-11T12:34:56Z",
  "source_fingerprint": "sha256:…",
  "card_version": "1.61.0",
  "integration_version": "1.61.0",
  "model_version": 6,
  "payload": {
    "config": {},
    "layout": {}
  },
  "placement_manifest": [],
  "content_manifest": []
}
```

`source_fingerprint` — SHA-256 от `houseplan-export-v1|` + HA `instance_id`
(`homeassistant.helpers.instance_id.async_get`, новая зависимость — R13);
исходный instance id в файл не пишется. Значение нужно только для безопасного
отличия собственной storage от чужой и не используется как секрет.

`model_version` повторяет фактически сохранённую версию модели; **отсутствие
поля в конфиге означает `0`** и ошибкой не является (R1). Поле живёт только в
envelope и удаляется из копии `payload.config`: это исключает два источника
истины и молчаливое понижение future-модели при экспорте. Изменения envelope
требуют нового `export_version`. Импорт с `export_version > 1` или
`model_version > PLAN_MODEL_VERSION` отклоняется без downgrade.

В объём задачи входит:

- завести `PLAN_MODEL_VERSION = 6` в `custom_components/houseplan/const.py`;
- parity-тест: значение в `const.py` равно `PLAN_MODEL_VERSION` из
  `src/plan-optimizer.ts:27` (сканер исходника, как это уже сделано для
  `MAX_SIGN_PATHS` — `logic.ts:1829`).

### 5.1 Full payload

- `payload.config` — полный текущий config после backend schema normalization,
  кроме envelope-поля `model_version`;
- `payload.layout` — результат `_live_layout(config, stored_layout)`
  (`websocket_api.py:114`), без позиций удалённых маркеров и сиротских `v_*`;
  функция выносится из ws-модуля в общий helper и **переиспользуется**, а не
  копируется;
- `placement_manifest` может быть пустым: full import не remap-ит ids.

Служебные ключи layout-стора (`rev`, `geom_pending`, `optimize_pending`,
`optimize_backup`, `repair_backup`) в экспорт не попадают.

### 5.2 Space payload

`payload.config` содержит только:

```json
{ "spaces": [/* ровно одно */], "markers": [/* только владельцы space */] }
```

Глобальный `settings` не входит и при импорте не меняется. Пространство входит
целиком: rooms, walls, drafts, partitions, columns, open spans, openings,
decor, backdrop transforms (`plan_x/plan_y/plan_scale*/plan_angle`) и
собственные `settings`.

В space export входят live layout records с `pos.s == space.id` (включая поле
`k` — сохранённый масштаб карточки комнаты, 0.5..3, `houseplan-card.ts:14065`)
и marker без `removed`, если выполняется хотя бы одно условие:

- его id владеет одной из этих layout positions;
- `marker.space == space.id`;
- `marker.room_id` указывает на room экспортируемого пространства.

Записи layout **без поля `s`** — legacy-координаты в render-units
(`houseplan-card.ts:3514-3518`) — не принадлежат пространству, в space export не
входят и в full export переносятся буквально; их количество показано в preview
(R7).

Global removed tombstones, `known_devices`, `new_device_ids` и прочие global
settings в space export не попадают.

`placement_manifest` классифицирует каждую layout key:

```json
{
  "layout_id": "…",
  "owner": "marker|room_label|light_group|auto_device",
  "binding": "device:…|entity:…|virtual|null",
  "owner_id": "…",
  "label": "…",
  "icon": "…"
}
```

Это позволяет не потерять layout-only auto-discovered device (ключ = HA
`device_id`, `devices.ts:688`) и группу света (`lg_<entity_id>`,
`devices.ts:712`): на другой instance они превращаются в явный orphan marker, а
не исчезают из импорта.

### 5.3 Content manifest

Manifest содержит только ссылки, без bytes, и адресует владельца по **id**, а не
по индексу в массиве (R15):

```json
{
  "kind": "plan|attachment|decor_asset",
  "owner": "space|marker",
  "owner_id": "loft",
  "field": "plan_url",
  "url": "/api/houseplan/content/plans/_/loft.ab12cd34.svg",
  "storage": "internal|external",
  "exists_at_export": true
}
```

Текущие обязательные owners: `space.plan_url` и `marker.pdfs[].url`
(источник истины по составу — `logic.ts:1851 referencedContentUrls`);
`decor_asset` подключается после появления соответствующего поля из #51. Signed
URL, auth token и runtime-resolved URL никогда не экспортируются: в конфиге и
так лежит сырой путь, подпись живёт только в рантайме (`signing.ts`).

Правила импорта:

| Ссылка | Результат |
|---|---|
| external schema-valid URL | сохраняется без сетевого запроса |
| internal, тот же fingerprint, файл существует | сохраняется |
| internal, тот же fingerprint, файл исчез | preview требует отсоединения |
| internal, другой fingerprint | считается непереносимой даже при совпадении имени |

Отсоединение означает `plan_url = null` либо удаление соответствующего PDF ref.
Проверка существования — та же функция, что защищает обычную запись:
`_missing_internal_plans` (`websocket_api.py:714`). Без отсоединения apply
физически не может завершиться: он вернул бы `missing_plan` (R3).

Ни preview, ни apply не удаляют файлы с диска и не выполняют внешние HTTP GET.

## 6. Backend API

### 6.1 Export

```text
houseplan/export/create
  {kind: full|space, space_id?, card_version}
  → {document, filename}
```

Backend под `write_lock` (`store.py:45` — он общий для обоих сторов) одним
чтением получает config и layout, строит live snapshot, manifest и metadata.
Lock удерживается только на чтение/копирование, не на frontend download.
Направление «сервер → клиент» размерных ограничений WS не создаёт: конфиг
ограничен `MAX_CONFIG_BYTES = 2 MiB` (`validation.py:114`).

### 6.2 Import preview и revalidate

Недоверенный JSON не парсится в карточке, и WS для загрузки не используется:
входящее направление ограничено и уже занято `config/set`. Frontend отправляет
файл как raw body в новый authenticated view — по образцу
`HouseplanUploadView` (`http_api.py:115`), регистрация в `async_setup`
(`__init__.py:35-38`), `requires_auth = True`, `may_write` внутри:

```text
POST /api/houseplan/import/preview?duplicate_policy=skip|virtual
→ {token, preview, expected_config_rev, expected_layout_rev, expires_at}
```

Endpoint streaming-читает не больше `MAX_EXPORT_BYTES = 8 MiB` (новая константа,
проверка по мере чтения, ответ `413`, как в `http_api.py:185-189`), строго
разбирает JSON, валидирует envelope, `CONFIG_SCHEMA`, `LAYOUT_SCHEMA`, content
policy и итоговые collection/byte caps после merge. Никакие HA services или
store writes во время preview не выполняются.

```text
houseplan/import/revalidate
  {token, duplicate_policy?}
  → {token, preview, expected_config_rev, expected_layout_rev, expires_at}
```

Пересчитывает preview на актуальных revision из уже проверенного candidate —
это ответ на смену политики дубликатов и на конфликт, вызванный собственной
фоновой записью позиций (`layout/update` без `expected_rev`, debounce 600 мс —
R16). Повторно выбирать файл пользователь не должен.

Preview token:

- криптографически случайный, одноразовый на apply, TTL 10 минут;
- связан с user id, digest файла, выбранной duplicate policy и обеими rev;
- хранит уже проверенный candidate только в памяти;
- максимум три token на пользователя и одновременно максимум три token на весь
  runtime (parsed JSON занимает больше wire bytes); старейший вытесняется;
- не переживает restart и никогда не пишется в лог целиком.

### 6.3 Apply и Undo

```text
houseplan/import/apply
  {token, expected_config_rev, expected_layout_rev,
   confirm_missing_content: bool}
  → {ok, kind, config_rev, layout_rev, counts, can_undo}
```

Undo отдельной команды не получает: используется существующая
`houseplan/plan/optimize_undo` (`websocket_api.py:941`) — тот же слот
`optimize_backup`, та же проверка `_optimizer_backup_is_current`, те же
`expected_config_rev`/`expected_layout_rev`. К снапшоту добавляется поле
`kind: "optimize" | "import"`; `config/get` и `layout/get` рядом с существующим
`can_optimize_undo` отдают `undo_kind`, и подпись кнопки выбирается по нему
(R5). Имена ключей стора не меняются — миграции не требуется, setup-recovery
(`__init__.py:156-193`) продолжает работать как есть.

Apply повторно проверяет `may_write`, owner/TTL/single-use token и обе текущие
revision. Любой mismatch возвращает `conflict`/`preview_expired`; клиент
вызывает `revalidate`, а не присылает candidate повторно. Full import создаёт
backup; space import — нет.

## 7. Согласованная запись двух Store

Буквальная atomic transaction между `.storage/houseplan.config` и
`.storage/houseplan.layout` невозможна. Механизм уже существует дважды
(`geom_pending` — `__init__.py:112-154`, `optimize_pending` —
`websocket_api.py:900-925`); третий не заводится. Обе половины импорта проходят
через **тот же** paired commit:

1. Под `write_lock` повторно загрузить stores и сравнить revisions.
2. Сохранить в layout store intent (`optimize_pending` + `kind: "import"`) с
   target config/layout и before snapshot.
3. Сохранить target config.
4. Сохранить target layout и удалить pending intent; для full import оставить
   one-deep backup.
5. Только после обеих durable writes отправить `houseplan_config_updated` и
   `houseplan_layout_updated` и success response.

При сбое любой записи handler один раз повторно сходится к target, учитывая
fail-after-write. Если это не удалось, он сначала заменяет durable intent на
`kind: import_rollback`, затем сходится к before-pair. Поэтому error response
никогда не оставляет intent, который при restart сам закончит импорт; при
аварии уже во время rollback setup-time recovery идемпотентно восстанавливает
before-pair до регистрации API. Events никогда не посылаются для
полуприменённой пары.

Нормативно (R4): запись layout-стора выполняется **единственным** helper-ом,
который сохраняет все служебные ключи и заменяет только `layout` и `rev`. Все
существующие вызовы (`websocket_api.py:195, 259, 314, 346, 657, 913, 985`)
переводятся на него в рамках этой задачи; белый список в `geometry/repair`
(`:314`, `:346`) сегодня стирает `optimize_backup`/`geom_pending` — это баг #87,
и он же — готовый мутант для §12.

Space import использует тот же paired commit без пользовательского Undo: это
гарантирует, что новый space и его positions не разъедутся при сбое.

Файлы (R2). Путь импорта **не вызывает** `collect_plans` и
`collect_attachments`: для них полная замена конфига выглядит как «старый
референс исчез» и они удалили бы картинки планов предыдущей конфигурации,
обесценив Undo. Суточный sweep (`__init__.py:210-244`) безопасен: он передаёт
один и тот же конфиг с обеих сторон, а непривязанные plan-файлы сохраняются по
второму правилу `collect_plans` (`plans.py:288-296`). Отсоединённые файлы
пользователь удаляет существующим менеджером планов.

После успешного full import выполняются:

- `_refresh_trail_recorder(hass)` и удаление прогонов, чьих маркеров больше нет
  (`houseplan.trails` ключуется `marker_id` из конфига — `trails.py:135-141`,
  собственного GC у книги нет, R12);
- `async_check_plan_files` — пересчёт repair-issue `broken_plan_<space_id>`
  (`repairs.py:18`).

## 8. Правила полного импорта

- Incoming config/layout полностью заменяют current config/live layout.
- Revisions, optimizer/import pending/backup и runtime metadata из файла
  игнорируются: новый target получает собственные revisions.
- Current normalized data roundtrip сохраняет config/layout эквивалентно,
  включая поля, проходящие через `extra=vol.ALLOW_EXTRA`.
- Known lifecycle fields с `vol.Remove` (`aspect` — `validation.py:520`,
  `segments` — `:595`) и допустимые coercions показываются в preview как
  normalization; это не скрытая Optimize operation.
- `settings.known_devices` и `settings.new_device_ids` импортируются только при
  совпадении `source_fingerprint`; при импорте с чужой instance они
  отбрасываются, иначе все устройства target станут «новыми»
  (`houseplan-card.ts:3407-3412`, R6). Это отдельная строка preview.
- Missing, disabled, removed, virtual markers и vacuum calibration сохраняются.
- Missing/disabled HA bindings не блокируют импорт и после него обрабатываются
  существующим binding lifecycle.
- HA area ids комнат сохраняются буквально; preview отдельно показывает
  отсутствующие target areas, автоматического matching по названию нет.
- Full import не выполняет entity actions и не меняет HA registry.

## 9. Правила импорта пространства

### 9.1 Новое пространство, ids и ссылки

- Import всегда создаёт новый safe space id (`SPACE_ID_RE`, `validation.py:17`).
- Title сравнивается после trim + Unicode normalization + casefold; конфликт
  получает ` (2)`, ` (3)` и далее.
- Все space-owned ids всегда получают новые ids, даже если сейчас не
  конфликтуют: room, room draft, partition, column, opening и decor.
- Геометрические wall keys и `open_spans` не являются object ids и
  пересчитываются/сохраняются по действующему wall contract, а не получают
  случайный suffix.
- Одна immutable remap map переписывает все внутренние ссылки.

| Поле | Действие |
|---|---|
| `room.id`, `opening.id`, `decor.id`, `partition.id`, `wall_column.id`, `room_draft.id`, `marker.id`, `space.id` | новый id |
| `room.open_to[]` | remap на новые room id |
| `marker.room_id`, `marker.space` | remap |
| `marker.vacuum.segment_map` (значения — room id; поле объявлено в `types.ts:110`, потребителя пока нет) | remap, чтобы не оставить мину |
| layout keys `<marker_id>`, `rl_<room_id>`, `v_*` | новые ключи по той же map |
| `pos.s` | новый space id; `k` сохраняется |
| `marker.binding`, `marker.tap_target`, `marker.vacuum.source` | **буквально**, guessed matching запрещён |
| `marker.controls[]` — значения `light.*`/`switch.*` | **буквально** |
| `marker.controls[]` — значения `marker:<id>` (вводятся задачей #84) | remap по той же map, что и `marker.id`; ссылка на маркер вне импортируемого пространства **удаляется**, а не остаётся битой, и считается в preview отдельной строкой |
| `room.area`, `room.settings.temp_source`, `room.settings.hum_source` | **буквально** |
| `opening.contact`, `opening.lock`, decor `entity` | **буквально** |
| `marker.vacuum.calibration` (ключи — map id робота, `vacuum.ts:80`) | **буквально** |
| `space.plan_url`, `marker.pdfs[].url` | по правилам §5.3 |
| layout keys вида HA `device_id` и `lg_<entity_id>` | **буквально**: это идентификаторы HA, а не наши |

- Повторный импорт того же файла создаёт ещё одно независимое пространство и
  не меняет результат первого импорта.

### 9.2 HA bindings

- `device:`/`entity:` ids сохраняются буквально; guessed matching запрещён.
- Room `area` ids сохраняются буквально; отсутствующий area не блокирует
  геометрию комнаты и явно отмечается в preview.
- Отсутствующий target binding импортируется как явный orphan marker.
- Disabled binding импортируется, но остаётся скрытым по существующему правилу
  disabled devices.
- `controls` и другие entity refs сохраняются; runtime отдельно фильтрует
  недоступные targets.
- Binding конфликтует, если target уже имеет live, hidden, removed tombstone
  или layout-only placement с тем же binding. Ничего не реактивируется молча.
- Для конфликта действует выбранная в preview политика `skip` или безопасная
  virtual visual copy из §4.5.

### 9.3 Итоговые limits

До выдачи apply token валидируется **merged target**, а не только файл:

| Лимит | Значение | Источник |
|---|---|---|
| `MAX_CONFIG_BYTES` | 2 MiB | `validation.py:114` |
| `MAX_SPACES` | 50 | `validation.py:79-108` |
| `MAX_ROOMS` | 400 | там же |
| `MAX_MARKERS` | 2000 | там же |
| `MAX_LAYOUT` | 5000 | там же |
| `MAX_DECOR` / `MAX_OPENINGS` / `MAX_WALLS` | 1000 / 500 / 500 | там же |
| `MAX_EXPORT_BYTES` | 8 MiB | новая, `const.py` |

Плюс все inner collection caps. При превышении preview read-only и ничего не
записывается.

## 10. Безопасность и приватность

- UI visibility не считается authorization; каждый новый endpoint вызывает
  `may_write` (`auth.py:16`) и `_runtime`. Исключение `content/sign`
  (`websocket_api.py:530`) сделано ради read-only зрителей и образцом не
  является (R17).
- JSON содержит персональные HA ids/имена/ссылки; это прямо указано до export.
  В отличие от `diagnostics.py`, здесь ничего не редактируется намеренно.
- Strict parser отклоняет NaN/Infinity, duplicate keys, BOM после первого
  символа, trailing data и рекурсивные `__proto__`/`prototype`/`constructor`.
- Path traversal, неизвестный internal content namespace и неканонический
  internal URL дают invalid content error; канон — `CONTENT_URL` +
  `/plans/_/<name>` и `/files/<marker_id>/<name>` (`const.py:13`,
  `websocket_api.py:1075`, `http_api.py:248`).
- Preview не возвращает payload обратно в DOM: только bounded summary и token.
- Raw document, entity ids, titles, coordinates и links не логируются; допустимы
  digest, bytes, kind, counts и stable error code.
- Preview/apply не вызывают HA services и не загружают external URLs.
- Cancel, validation error, conflict, expired token и disconnect дают ноль
  store writes.
- Backend export создаёт обычный JSON response; никакая внешняя telemetry не
  используется.

## 11. Stable error codes

Минимальный набор:

- `unauthorized`, `not_ready`, `too_large`;
- `invalid_json`, `invalid_format`, `unsupported_export_version`;
- `future_model`, `invalid_config`, `invalid_layout`, `invalid_content`;
- `space_not_found`, `capacity_exceeded`;
- `preview_expired`, `preview_owner_mismatch`, `conflict`;
- `content_confirmation_required`, `missing_plan`, `missing_content`,
  `commit_failed`, `no_backup`.

Preview обязан заранее поймать недостающий plan и предложить отсоединение
(§5.3). Но файл может исчезнуть после preview, поэтому apply повторяет проверку
под write-lock и в этой гонке возвращает стабильный `missing_plan`. Та же
проверка применяется к локальным PDF-вложениям и возвращает
`missing_content`, если файл исчез после preview. Frontend локализует code;
backend message остаётся диагностикой, но не является единственным
пользовательским текстом.

## 12. Проверки

### Backend (`tests_backend/`, HA-тесты в файлах `test_ha_*.py`)

- export во время конкурентной записи даёт одну согласованную пару revisions;
- current normalized full roundtrip сохраняет config + live layout + unknown
  supported fields;
- strict parser и каждый envelope/schema/size/content error не пишут stores;
- preview token: owner, TTL, cap, policy, single-use, conflict; `revalidate`
  выдаёт свежие rev и не требует повторной загрузки файла;
- full paired commit: success, failure каждой write, crash recovery, events;
- **apply не удаляет файлы**: план предыдущей конфигурации остаётся на диске
  после полной замены (прямая проверка R2);
- **apply с недостающим внутренним планом** без отсоединения отклоняется, с
  отсоединением проходит (R3);
- Undo работает один раз, отдаёт `undo_kind: "import"` и становится stale после
  любого следующего edit; Optimize и импорт делят один слот (R5);
- запись layout-стора любым существующим хендлером сохраняет служебные ключи
  (регрессия на `geometry/repair`, R4);
- space paired commit не оставляет config без layout и наоборот;
- remap всех ids/references из таблицы §9.1, повторный импорт,
  title/layout/marker collisions;
- layout-only device, `lg_*`, legacy-запись без `s`, orphan, disabled, hidden,
  removed, virtual и duplicate binding с обеими policies;
- vacuum calibration/segment map сохраняются, trails отсутствуют, сироты
  трек-книги удаляются после full import (R12);
- `known_devices`/`new_device_ids` отбрасываются при чужом fingerprint и
  сохраняются при своём (R6);
- same-instance internal asset сохраняется; missing/cross-instance требует
  detach confirmation; external URL не fetch-ится;
- merged collection/byte caps проверяются до token;
- parity-тест `PLAN_MODEL_VERSION` между `const.py` и `plan-optimizer.ts` (R1).

### Frontend (`test/*.test.mjs`, `demo/smoke_*.mjs`)

- раздел виден только writer; две кнопки имеют правильные accessible names;
- обновлён эталон `demo/smoke_general_settings.mjs` (`rows`, массив групп) —
  без этого смок красный (R10);
- паритет RU/EN для всех `backup.*` (`test/i18n.test.mjs`);
- full/space export формируют корректный download и revoke object URL;
- import file picker не парсит payload и не пишет state до preview/apply;
- invalid/too-large/future files показывают локализованную read-only ошибку;
- full preview: counts, missing-content checkbox, focus, cancel, danger apply;
- space preview: suffix, target-global warning, смена duplicate policy идёт
  через `revalidate`;
- success reload очищает stale dialogs/caches и выбирает корректное space;
- cancel/Escape/scrim/double click/disconnect не применяют token дважды;
- desktop + narrow touch: footer не обрезан, horizontal scroll отсутствует;
- RU/EN golden для export dialog, full destructive preview и space preview:
  требуется новая ветка в `demo/golden/harness.mjs` (сейчас поддержаны только
  `device` и `decor-color`) и bump `GOLDEN_MATRIX_VERSION` (R11).

### Mutation/negative gate (контракт #85)

Задача не считается выполненной, пока не показано, что тесты краснеют при:

1. возврате `collect_plans`/`collect_attachments` на путь apply — тест «план
   предыдущей конфигурации остался на диске» обязан упасть;
2. пропуске detach-проверки — apply обязан упасть на `missing_plan`;
3. записи layout-стора белым списком (как в `geometry/repair`) — снапшот Undo
   обязан пропасть и тест обязан это заметить;
4. приёме payload от клиента вместо preview token;
5. переиспользовании исходных ids при space import;
6. отправке event между двумя Store writes;
7. удалении секции из «Общих настроек» — смок обязан покраснеть на эталоне.

## 13. Acceptance criteria

1. Writer скачивает один versioned JSON для всей модели или текущего space.
2. Full export является согласованным snapshot config + live layout.
3. Full import ничего не меняет до preview и явной danger-кнопки, затем заменяет
   оба stores согласованно и предоставляет one-deep Undo — **тот же самый**, что
   у оптимизации, одной кнопкой.
4. Полная замена конфигурации не удаляет ни одного файла с диска.
5. Space import всегда добавляет независимое пространство, remap-ит все
   внутренние ids/references из таблицы §9.1 и не перезаписывает существующие
   данные.
6. Missing/disabled bindings, duplicates и layout-only devices имеют
   предсказуемое поведение из §9; guessed matching отсутствует.
7. Локальные assets другой instance не подменяются одноимёнными target files;
   их отсоединение всегда видно и отдельно подтверждено.
8. Invalid, future, oversize, stale, unauthorized и interrupted операции не
   оставляют наблюдаемую несогласованную пару config/layout.
9. Trails, runtime state, revisions, signed tokens и undo metadata в export не
   попадают; import не вызывает HA services и внешнюю сеть.
10. UI доступен с клавиатуры, не обрезается на узком экране и локализован RU/EN.
11. Документация честно называет JSON backup моделью без media bytes.

## 14. Release artifacts

В том же release cycle обязательны:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #50;
- новый раздел backup/transfer в `docs/USER-GUIDE.ru.md`;
- обновление `docs/ARCHITECTURE.md`: новый HTTP view, paired commit, token,
  manifests, единый helper записи layout-стора;
- `docs/STATUS.md` после реализации;
- RU/EN goldens из §12, обновлённый `demo/smoke_general_settings.mjs` и
  backend/frontend test inventory;
- короткий release body: пользовательская ценность, без перечисления protocol.
