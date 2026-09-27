# CODE-REVIEW-126-r2

- **Issue:** #126 — «Смена area устройства в HA не переносит иконку в новую комнату, если позиция была сохранена»
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r2 · блокирующих циклов 1/4
- **Диапазон:** `origin/dev...HEAD`, HEAD = `26cb00db`
- **Вердикт:** зелёный · High: 0 · Medium: 0

## Скоуп раунда

r1 (код-ревью, `docs/reviews/CODE-REVIEW-126-r1.md`, вердикт жёлтый на SHA,
названном в вердикте как `34b99b95`) нашёл один High и один Medium, оба в
скоупе задачи. Ревью этого раунда — по дельте, а не заново, согласно
PROCESS.md §2.9: причина не в ребейзе на ушедший вперёд `dev` (`git merge-base
HEAD origin/dev` = `5c8cb58e` = сам `origin/dev`, т.е. база не сдвигалась) и
не в новой подсистеме — исправления r1 локальны к тестовой обвязке и одной
строке продуктового кода.

**SHA-несостыковка (зафиксирована, не блокирует).** `34b99b95` из вердикта r1
не существует в текущей истории (`git cat-file -t 34b99b95` → `Not a valid
object name`). По временным меткам коммитов (`633cb20e` 09:24 → `b319fc95`
09:29 → `61dd7ccb` 09:44, добавляющий сам `CODE-REVIEW-126-r1.md`) и по
содержимому диффа `b319fc95` — это тот же логический снимок, что был назван
`34b99b95` в вердикте: тот же продуктовый коммит + тот же screenshot-refresh,
непосредственно предшествующий добавлению документа ревью. Хэш разошёлся,
видимо, из-за локального reword/amend перед публикацией. Использую `b319fc95`
как границу дельты — контент, а не сам хэш, подтверждён построчно ниже.

Дельта — коммиты `d5268086` («fix: harden HA area relocation regressions»,
`User-Visible: no`) и `26cb00db` («docs: refresh canonical screenshots for
area relocation», `User-Visible: no`), диапазон `b319fc95..HEAD`:

```
demo/golden/harness.mjs          |  15 ++-
demo/golden/matrix.mjs           |  38 +++++++
demo/smoke_area_relocation.mjs   | 205 +++++++++++++++++++++++++++++++++++--
demo/smoke_discovery_filters.mjs |  15 +++
demo/smoke_marker_stay.mjs       |  10 +-
demo/smoke_subarea.mjs           |  11 +-
demo/smoke_vacuum_firstuse.mjs   |  21 ++--
demo/srv/demo.html               |   5 +
src/houseplan-card.ts            |   5 +
+ dist/**, custom_components/houseplan/frontend/** (сгенерированные копии, класс D)
+ docs/images/*.png, docs/images/screenshots.json (класс C, канонические скриншоты)
```

Продуктовая логика `src/device-area-relocation.ts`, `src/types.ts`, backend
(`validation.py`, `websocket_api.py`, `config-schema.json`), unit-тесты
резолвера — не изменились между `b319fc95` и `HEAD` (`git diff --stat` по
этим путям — пусто). По §2.9 п.4 повторно проверяю только те AC, чьё
доказательство дельта задевает: AC-доказательства через browser smoke (AC2,
AC6 §19 ТЗ) и Save-диалог устройства (AC-контракт `roomTouched`, r1 H1).
Остальные AC наследую из r1 без повторной проверки — см. раздел ниже.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **H1** (High) — `demo/smoke_subarea.mjs` и `demo/smoke_marker_stay.mjs` писали `_markerDialog.room` напрямую, минуя реальное DOM-событие `#marker-room`; после введения `roomTouched` эта запись стала no-op, smoke проходил vacuously (`smoke_subarea` реально падал 6/14 на `34b99b95`) | `smoke_subarea.mjs` теперь берёт реальный `<select id="marker-room">` из `renderRoot`, ставит `.value` и диспатчит настоящий `change`-event (`bubbles: true, composed: true`), затем читает `_markerDialog.roomTouched === true` как отдельную проверку `realRoomChangeMarkedTouched`. `smoke_marker_stay.mjs` (тестирует другой инвариант — что позиция НЕ мигрирует при смене комнаты) явно проставляет `roomTouched: true` рядом с прямой записью `room`, восстанавливая запись как реальное действие, плюс добавлена проверка `roomChangePersisted` | `demo/smoke_subarea.mjs` (diff), `demo/smoke_marker_stay.mjs` (diff). Прогнано мной: `node demo/smoke_subarea.mjs` → 15/15 true; `node demo/smoke_marker_stay.mjs` → 8/8 true (см. «Как проверялось») |
| **M1** (Medium) — `demo/smoke_area_relocation.mjs` покрывал 4 из 8 сценариев §19 ТЗ; cross-space, standalone entity marker, explicit-override/composite exclusion и cold-start backfill были доказаны только на уровне чистого resolver в unit-тестах, не через production bundle | Добавлены сценарии `crossSpaceRelocated` (переезд между пространствами через тот же `_syncAreaRelocations`), `standaloneEntityRelocated` (entity-маркер без device), `explicitOverrideExcluded` (явный `marker.room_id`/`area` не трогается), `compositeGroupExcluded` (markerless light-group не переезжает и не получает attention), `coldStartBackfilled` (отдельная свежесозданная карта, первый authoritative rebuild, delete-before-config порядок) | `demo/smoke_area_relocation.mjs` (diff, +205 строк). Прогнано мной: `node demo/smoke_area_relocation.mjs` → 18/18 true, все пять новых полей включены |

Оба закрытия проверены исполнением теста на текущем `HEAD`, не пересказом
коммита автора.

## Унаследовано из r1

Без повторной проверки в этом раунде — дельта этих путей не касается:

- **Резолвер и его контракт** (§8/§11/§12 ТЗ: duplicate-Area guard,
  known-binding area-changed, backfill по сохранённой точке, explicit wins,
  eligibility virtual/unverified/removed/composite) — `src/device-area-relocation.ts`,
  проверено в r1 построчно против ТЗ, unit-тесты `test/device-area-relocation.test.mjs`
  подтверждены как способные падать. Документ: `docs/reviews/CODE-REVIEW-126-r1.md`
  (раздел «Что проверено и корректно»), SHA `b319fc95` (=`34b99b95` вердикта).
- **AC3 (read-only/static truth)** — `space-render.ts`/`space-geometry.ts`
  (`markerPos`, `ignoreSaved`), подтверждено smoke `staticReadOnlyProjection`/
  `staticMadeNoWrites` в r1. Файлы не менялись в дельте.
- **AC9 (fail-safe, delete-first, retry)** — `_syncAreaRelocations`
  (`houseplan-card.ts:5137-5251` на момент r1), проверено по коду и smoke
  `failedConfigRetryable`/`configRetrySucceeded`. Единственная правка этой
  области в дельте — добавленная строка `_saveConfigDebounced.cancel()`
  внутри уже проверенного в r1 блока (см. «Новое в дельте» ниже), остальной
  контур не тронут.
- **AC10 (no Undo после relocation)** — `_cancelDeviceDrag()`/
  `_devicePositionHistory.clear()`, прочитано в r1, не покрыто отдельным
  smoke (низкий риск, отмечено в r1 как принятый пробел).
- **Backend схема и import/export** (`marker_area_snapshot`, лимит
  `MAX_KNOWN_DEVICES`/`MAX_MARKER_AREA_SNAPSHOT`, `tests_backend/test_validation.py`,
  `tests_backend/test_ha_import_export.py`) — не менялись в дельте, приняты в
  r1 по коду и тестам.
- **Changelog/трейлеры продуктового коммита** — `633cb20e`
  (`User-Visible: yes`) уже содержит правки `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` в том же коммите; это проверено в r1 и не изменилось.

Источник: `docs/reviews/CODE-REVIEW-126-r1.md`, диапазон на SHA `34b99b95`
(содержимое = `b319fc95` в текущей истории, см. «SHA-несостыковка» выше).

## Новое в дельте (не из r1, самостоятельно проверено)

Автор указал ещё два самостоятельно найденных и исправленных дефекта, не
поднятых r1. Проверены по коду и исполнением:

1. **Дублирующая config-запись при пересечении Area-sync с debounced
   пользовательской записью** (`src/houseplan-card.ts:5214`,
   `if (this._saveConfigDebounced.pending()) this._saveConfigDebounced.cancel();`).
   Прочитано: `_saveConfigDebounced` (`houseplan-card.ts:7695`) при срабатывании
   таймера просто вызывает `_writeConfig()` над текущим `this._serverCfg` — не
   хранит отдельный payload. `debounce().cancel()` (`houseplan-card.ts:756-760`)
   очищает таймер без trailing-вызова. Поэтому отмена ожидающего таймера прямо
   перед синхронным `await this._writeConfig()` не теряет пользовательскую
   мутацию (она уже находится в `this._serverCfg` к моменту rebuild) и убирает
   гарантированный повторный сетевой write несколько сотен миллисекунд спустя.
   Корректно, находок нет.
2. **Golden-сценарии и два «legacy»-смока читали устаревший снэпшот `cfg`/
   `writes` до one-time provenance-бэкафилла #126**, из-за чего добавление
   резолвера начало превращать чужие тестовые фикстуры (намеренно
   расположенные вне «своей» HA-комнаты для проверки иконок на фиксированных
   координатах) в сценарии релокации и портить write-count инварианты. Правки
   изолируют это через `markerAreaSnapshot`-«прошивку» golden-фикстур
   (`demo/golden/harness.mjs`, `demo/golden/matrix.mjs`) и через ожидание
   `_areaRelocationWrite`/`_writeChain` перед снятием baseline в
   `smoke_discovery_filters.mjs`/`smoke_vacuum_firstuse.mjs`. Оба поля —
   реальные, существующие свойства (`_areaRelocationWrite:
   houseplan-card.ts:1013`, `_writeChain: houseplan-card.ts:7489`), не опечатки
   с молчаливым `undefined`. Подтверждено исполнением (см. ниже).

## Как проверялось

**Дешёвые гейты.** Инструкция ревью подтверждает Validate на `26cb00db` —
success (https://github.com/Matysh/houseplan-card/actions/runs/33368059072),
это покрывает `npx tsc --noEmit`, `npm test`, `npm run build` на точном SHA;
повторно не гонял. Дополнительно сам прогнал (дёшево, диф трогает `src/**`):

- `npm run build` — green (несёт `tsc --noEmit`);
- `npm run bundle:sync` — green; `git status --porcelain` после — пусто, т.е.
  `dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/`
  синхронны с committed-состоянием на этом SHA;
- `node scripts/check-docs.mjs` — green (диф трогает `src/houseplan-card.ts`).

**Smoke, отобранные по дельте и риску.**
`node scripts/smoke-select.mjs --base b319fc95 --head HEAD`:

```
Изменено файлов src/**: 1 · символов проекта на изменённых строках: 1
Прямое совпадение (9): _saveConfigDebounced →
  smoke_config_writer, smoke_danger_confirmation, smoke_decor_default_persist,
  smoke_discovery_filters, smoke_grid_snap, smoke_optional_space_model,
  smoke_save_race, smoke_v8_draft_write, smoke_vacuum_firstuse
```

Прогнал все 9 «прямых совпадений» плюс три smoke, изменённых в дельте напрямую
(`smoke_area_relocation`, `smoke_subarea`, `smoke_marker_stay` — уже
учтены/включены выше):

| Smoke | Причина прогона | Результат |
|---|---|---|
| `smoke_area_relocation.mjs` | изменён в дельте (M1 r1) | 18/18 true |
| `smoke_subarea.mjs` | изменён в дельте (H1 r1) | 15/15 true |
| `smoke_marker_stay.mjs` | изменён в дельте (H1 r1) | 8/8 true |
| `smoke_discovery_filters.mjs` | изменён в дельте + прямое совпадение | OK |
| `smoke_vacuum_firstuse.mjs` | изменён в дельте + прямое совпадение | 27/27 true |
| `smoke_config_writer.mjs` | прямое совпадение `_saveConfigDebounced` | OK |
| `smoke_danger_confirmation.mjs` | прямое совпадение | OK (19/19 true; stderr-стек в выводе принадлежит намеренному error-path тесту `markerCancelAccept`, не сбою) |
| `smoke_decor_default_persist.mjs` | прямое совпадение | OK |
| `smoke_grid_snap.mjs` | прямое совпадение | 6/6 true |
| `smoke_optional_space_model.mjs` | прямое совпадение | 6/6 true |
| `smoke_save_race.mjs` | прямое совпадение | 4/4 true |
| `smoke_v8_draft_write.mjs` | прямое совпадение | 6/6 true |

Итого 12/12 запущенных — зелёные. Остальные ~198 smoke не отбирались
инструментом на этой дельте и не прогонялись — полная матрица является
предрелизным гейтом, не гейтом ревью.

**Golden.** Дельта редактирует `demo/golden/harness.mjs` и
`demo/golden/matrix.mjs` (новое поле `markerAreaSnapshot` в фикстурах) — это
прямое изменение исходных данных для видимого рендера, поэтому прогнал
`npm run golden:verify` целиком: **60/60 passed, 0 failed**, включая два
сценария, которые правка непосредственно защищает (`orphan-references-*`,
где markerless-фикстуры намеренно вне «своей» комнаты).

**Не прогонял:** `npm run invariants` (дельта не трогает рёбра комнат, записи
толщины, `layout`-схему или `open_spans`; `src/space-geometry.ts` не менялся
между `b319fc95` и `HEAD`); `python -m pytest tests_backend` (backend не
менялся в дельте, r1 уже проверил точечно); performance-профили (не названы
в AC, не задеты дельтой); полный `smoke_*` набор (~198 файлов, не отобраны
инструментом и не требуются объёмом дельты).

## Единый источник чисел

Дельта не вводит и не меняет ни одной пользовательски видимой величины
(только тестовую обвязку и внутренний debounce-guard) — раздел «одно число —
один источник» неприменим к этому раунду; актуален вывод r1 (не поднимал
находок по этому классу).

## Итог

Оба блокировавших находки r1 закрыты и подтверждены исполнением тестов, а не
текстом коммита. Два дополнительных самостоятельно найденных дефекта (debounce
double-write, golden/legacy-smoke изоляция от provenance-бэкафилла) читаются
корректно и подтверждены прогоном golden (60/60) и целевых smoke (12/12).
Новых находок нет. High: 0, Medium: 0 — задача готова к `S8`.
