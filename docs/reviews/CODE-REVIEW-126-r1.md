# CODE-REVIEW-126-r1

- **Issue:** #126 — «Смена area устройства в HA не переносит иконку в новую комнату, если позиция была сохранена»
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r1 (первый код-ревью, спек уже принят зелёным на r2 `cfd9c0fd`)
- **Диапазон:** `origin/dev...HEAD`, HEAD = `34b99b95` (продуктовый коммит `24251a25` + `docs: refresh canonical screenshots`)
- **Вердикт:** жёлтый · блокирующих циклов кода 1/4 · High: 1 · Medium: 1 → в задаче

## Скоуп

Полный трек, новая подсистема: pure resolver `src/device-area-relocation.ts`,
интеграция в `houseplan-card.ts` (persistence coordinator, `_livePos`, drag
cancel/history clear), в `space-card.ts`/`space-render.ts`/`space-geometry.ts`
(hosted Static, read-only projection), backend schema/import-export
(`marker_area_snapshot`), правка семантики Save в Device dialog
(`roomTouched`), доки, unit/backend/browser-smoke тесты.

Разбор полный (не по дельте) — это первый код-ревью раунд для #126.

## Как проверялось

Дешёвые гейты прогнаны на `34b99b95`:

- `npx tsc --noEmit` — green;
- `npm test` — green, 1679/1680 pass, 1 known skip, 0 fail;
- `npm run build` — green;
- `npm run bundle:sync` — green, `dist`/`custom_components/.../frontend`/`demo/srv/assets` синхронны (`git status` после — чисто);
- `node scripts/check-docs.mjs` — green (docs-check запускался, т.к. диф трогает `src/**`; отпечаток скриншотов уже обновлён коммитом `34b99b95`).

Инварианты модели (`npm run invariants`) не запускал: диф не трогает рёбра
комнат, записи толщины, `layout` schema (`x/y/s/k` не менялись) или
`open_spans` — resolver только читает существующие `room.poly` для
point-in-room проверки, ничего геометрического не пишет.

Geometry/perf-профили не запускал — не названы в AC и не задеты диффом.
`python -m pytest tests_backend` не гонял целиком, но точечно прочитал новые
тесты в `tests_backend/test_validation.py` и `tests_backend/test_ha_import_export.py`
— оба соответствуют §16 ТЗ и реально проверяют границы (bad binding, лишний
ключ, `MAX_MARKER_AREA_SNAPSHOT+1`, cross-source drop, same-source preserve).

**Отбор smoke.** `node scripts/smoke-select.mjs --base origin/dev --head HEAD`
дал 38 «прямых совпадений» и 37 «слабых связей» (общие символы `_markerDialog`,
`_model`, `NORM_W`, `_showToast`, `_writeConfig`, `_reloadConfigOnly`, `_snap`
и т.п. — задеты фоново из-за размера диффа в `houseplan-card.ts`/
`houseplan-editor-runtime.ts`, не из-за новой логики Area relocation).
Прогнал целевую выборку по риску, не всю матрицу:

| Smoke | Категория | Прогнан | Результат |
|---|---|---|---|
| `demo/smoke_area_relocation.mjs` | новый, AC1/2/3/7/9/11 | да | OK (все 13 проверок true) |
| `demo/smoke_subarea.mjs` | слабая связь (`_markerDialog`), тематически прямое попадание — explicit room override между spaces | да | **FAIL, 6/14** |
| `demo/smoke_marker_stay.mjs` | слабая связь, «позиция не движется при смене комнаты» — тот же механизм записи room | да | OK, но см. находку H1 — тест не детектирует регрессию |
| `demo/smoke_controls.mjs` | слабая связь (`_markerDialog`) | да | OK (virtual binding, не задет) |
| `demo/smoke_hidden_flag.mjs` | не в списке инструмента, проверил вручную по тому же паттерну кода | да | OK (virtual binding, не задет) |
| `demo/smoke_device_inbox.mjs` | слабая связь, тематика #29 lifecycle, которую §4 ТЗ явно наследует | да | OK |
| `demo/smoke_new_device.mjs` | слабая связь, переиспользуемая метка `new_device_ids` | да | OK |
| `demo/smoke_disabled_device.mjs` | слабая связь, ha_disabled eligibility (§8 п.4 ТЗ) | да | OK |
| `demo/smoke_readonly_cold_start.mjs` | слабая связь (`_canEdit`), тематика read-only/cold-start, которую сам новый smoke не покрывает | да | OK |
| Остальные 30 «прямых» / 29 «слабых» | символы из типов (`DevItem`,`Marker`,`Layout`,`SpaceModel`) или несвязанные путём диффа строки (`_cfgContentFingerprint`,`_reloadConfigOnly` в контексте drag/upload/optimize, не Area) | нет | не прогонял — связь по имени, не по функции; риск низкий, задача их не касается |

`smoke_subarea.mjs` — единственный найденный красный результат; воспроизвёл
дважды и сверил с чистым `origin/dev` (отдельный `git worktree`, тот же
Chromium) — там он проходит полностью. Регрессия принадлежит этой ветке.

`npm run golden:verify` не запускал — рендер/геометрия/стили/слои не меняются
(маркер продолжает использовать существующий `defaultPositions()` путь и
существующую красную точку, новый визуальный язык не вводится, это прямо
зафиксировано в ТЗ §19 и подтверждается диффом — новых CSS/SVG путей нет).

## Находки

### H1 (High, блокирует) — Save диалога устройства без изменения комнаты больше не пишет явный room override; регрессия существующего smoke

**Файл:** `src/houseplan-editor-runtime.ts:8192-8213` (`_saveMarker`), зеркально `_markerDraft:12321-12330`.

Новый флаг `roomTouched` — правильная и нужная часть задачи: раньше **любое**
сохранение диалога устройства навсегда закрепляло эффективную HA-комнату как
`marker.room_id`/`marker.area` (потому что `dlg.room` всегда непустой — он
показывает текущее эффективное размещение), что при принятии #126 сделало бы
открытие/сохранение диалога **эквивалентным явному override** и тихо
уничтожало бы саму фичу (после первого же захода в Device editor устройство
переставало бы следовать HA Area). Флаг это чинит: писать `marker.room_id`
теперь можно только если `dlg.roomTouched === true` (реальный `@change` на
`#marker-room`) либо маркер уже был явным раньше (`previousExplicit`).

Побочный эффект: единственное место в продуктовом коде, которое выставляет
`roomTouched: true`, — это буквально обработчик `@change` `<select
id="marker-room">` (`houseplan-editor-runtime.ts:12852-12855`). Любой код
(включая существующие тесты), который выставляет `_markerDialog.room`
напрямую, минуя реальное DOM-событие, **больше не производит запись явного
room override** — `writePlacement` остаётся `false`.

`demo/smoke_subarea.mjs` — существующий, не тронутый в этом диффе smoke —
делает именно это: `c._markerDialog = { ...c._markerDialog, room:
'garden#@garden-shed-a' }` для реального HA-устройства `d_light1` без
`marker`, затем `_saveMarker()`. Раньше это был штатный (и единственный)
способ протестировать «явный выбор комнаты в другом space побеждает HA Area»
(#83/#317 контракт). Сейчас:

```
$ node demo/smoke_subarea.mjs
FAILED (6):
  - haMarkerSaved: expected true, got false
  - haRuntimePlacement: expected true, got false
  - crossSpaceCentered: expected true, got false
  - haReopenRoom: expected true, got false
  - invalidPairPlaceholder: expected true, got false
  - sameSpaceRoomSaved: expected true, got false
```

На чистом `origin/dev` (тот же Chromium, отдельный worktree) этот smoke
проходит полностью (все 14 проверок true) — регрессия принадлежит этой ветке,
не окружению.

Настоящий пользовательский путь (клик по `<select>`) действительно
выставляет `roomTouched: true` вместе с `room`, так что для живого клика в
браузере регрессии, видимо, нет — но:

1. это не доказано ни одним тестом с реальным DOM-событием (`dispatchEvent`)
   на `#marker-room`, только предположением по коду;
2. `demo/smoke_marker_stay.mjs` использует тот же паттерн прямой записи
   `room` для auto-устройства без `marker` (строка 16) и теперь **тоже
   тестирует не то, что заявлено**: `stayAfterRoomChange: true` проходит не
   потому что позиция осталась на месте при смене комнаты, а потому что смена
   комнаты стала no-op (запись `marker.room_id` не происходит вовсе) — тест
   зелёный, но перестал быть доказательством;
3. `git diff --stat` подтверждает, что ни `smoke_subarea.mjs`, ни
   `smoke_marker_stay.mjs` не редактировались в этом диффе — автор не
   перепрогнал существующую smoke-матрицу после изменения контракта
   `_markerDialog`.

**Воспроизведение:** `node demo/smoke_subarea.mjs` на `34b99b95` (см. вывод
выше); `node demo/smoke_subarea.mjs` на `origin/dev` (worktree) для контраста
— зелёный.

**Что нужно:** обновить существующие smoke (`smoke_subarea.mjs`,
`smoke_marker_stay.mjs` и любые другие с тем же паттерном) так, чтобы они
ставили `roomTouched: true` вместе с `room` при симуляции пользовательского
выбора — это восстановит их как реальное доказательство приёмки #83/#317, а
не тихо превратит их в vacuous pass. Альтернативно, если реальный сценарий
сохранения room должен остаться доступным программно без `roomTouched`,
нужно явное решение о контракте, а не побочный эффект нового поля.

Это находка внутри скоупа задачи (её же код это сломал) — правится в этой же
ветке, без отдельного issue.

### M1 (Medium, в скоупе) — Browser smoke не покрывает 4 из 8 сценариев, обязательных по §19 ТЗ

`docs/specs/126-ha-area-marker-relocation.md` §19 требует, чтобы
`demo/smoke_area_relocation.mjs` (или эквивалент) «обязан проверить»:
same-space (✓ есть), cross-space, standalone entity marker, explicit room
override и composite exclusion, cold-start stale backfill, red badge (✓),
hosted Static (✓), no-op при unchanged rebuild (✓).

Фактический файл покрывает 4 из 8: same-space drag, badge/acknowledgement,
hosted Static read-only projection, no-double-write. Cross-space, standalone
entity, explicit override/composite exclusion и cold-start backfill
проверены только на уровне чистого resolver в
`test/device-area-relocation.test.mjs` — это доказывает корректность формул,
но не то, что `_maybeRebuildDevices`, `_syncAreaRelocations`,
`resolveHaBindingStatus`, `_openMarkerDialog`/`_saveMarker` и cold-boot таймингов
`authoritative`-флага действительно проводят эти случаи через реальный
production bundle. Ни один из этих четырёх интеграционных путей не имеет
альтернативного покрытия (в `houseplan-card.ts` вообще нет unit-тестов
уровня класса — весь integration-контур тестируется только smoke).

Учитывая, что H1 — это как раз пример: логика, безупречная в pure-модуле,
сломалась именно на стыке с Device dialog, которого чистый unit-тест не
видит. Отсутствие cross-space/entity/explicit/cold-start smoke — это
конкретно обязательство ТЗ (AC2 «unit + smoke», AC6 «unit + cold-start
smoke»), которое сейчас закрыто только наполовину.

**Что нужно:** дополнить `demo/smoke_area_relocation.mjs` (или отдельный
файл) четырьмя недостающими сценариями либо явно задокументировать в ТЗ/issue,
почему интеграционное покрытие для них не требуется — молчаливое сужение
недопустимо.

Находка в скоупе — правится в этой же ветке, без отдельного issue.

## Что проверено и корректно (по коду, где явно указано «прочитано, не исполнено»)

- **AC1/AC2 (resolver-формулы для same-space/cross-space).** Прочитано
  построчно `resolveDeviceAreaRelocations` (`src/device-area-relocation.ts:137-230`)
  против §11/§12 ТЗ: порядок проверок (duplicate-Area guard → known-binding
  area-changed → backfill by saved point) соответствует §11 п.1-3 и §12
  случаям 1-5 один в один; юнит-тесты (`test/device-area-relocation.test.mjs`)
  реально могут падать — проверил, что при обратной логике (`sameRoom`/`staleRoom`)
  падают ожидаемо. Cross-space путь через полный бандл — см. M1, не доказан.
- **AC3 (read-only/static truth).** `space-render.ts:280-286` считает
  `areaRelocationIds` тем же чистым resolver'ом без побочных эффектов;
  `markerPos()` (`space-geometry.ts:629`) получает `ignoreSaved` и не
  обращается к записи/сети. Подтверждено smoke `staticReadOnlyProjection` +
  `staticMadeNoWrites`.
- **AC4/AC5 (explicit wins, eligibility).** `registryFollowingBinding`
  (`device-area-relocation.ts:95-107`) читает как отсекающий guard: virtual,
  unverified, explicit area/room, removed, binding mismatch, markerless entity
  (композитная light-group). Прочитано против §8 построчно, юнит-тест
  `explicit placement, virtual markers and composite groups...` реально
  различает 7 кейсов включая `disabled` (eligible per §8 п.4 — код специально
  НЕ фильтрует `ha_disabled`, только `unverified`; прочитано в паре с
  `devices.ts:1203-1206`, где `ha_disabled` маркер остаётся в `rest[]` с
  актуальным `area` из полного реестра — реактивация получит верную комнату).
- **AC8 (rebind provenance).** `previous?.binding === binding` guard —
  различие binding трактуется как новый baseline, не relocation; юнит-тест
  `rebind establishes a new baseline...` бьётся именно на этом.
- **AC9 (fail-safe, delete-first).** `_syncAreaRelocations`
  (`houseplan-card.ts:5137-5251`): цикл `await this._persistDevicePlacement(id,
  null)` до формирования `nextSnapshot`/`nextAttention`; при неудаче удаления
  `deleteFailed=true` → `_areaRelocationSyncKey=''` для ретрая на следующий
  authoritative pass; при неудаче записи конфига — восстановление
  `marker_area_snapshot`/`new_device_ids` только если конкурентная мутация не
  успела заменить именно эту попытку (сверка по `contentFingerprint`).
  Подтверждено smoke (`failedConfigRetryable`, `configRetrySucceeded`) —
  сценарий реально симулирует отказ `houseplan/config/set` через перехват
  `hass.callWS` и проверяет ретрай на следующий `window.__setRegistryArea`.
- **AC10 (no Undo).** При `_areaRelocationIds.size` вызывается
  `_cancelDeviceDrag()` и `_devicePositionHistory.clear()`
  (`houseplan-card.ts:5058-5059`) на каждый authoritative rebuild, в котором
  есть relocation — до применения новых позиций. Прочитано, не покрыто
  отдельным unit/smoke именно на срез «Undo не воскрешает» — риск невысокий,
  т.к. `.clear()` детерминированно опустошает стек, но формально AC10 просит
  «history unit/source contract», а такого точечного теста нет (не поднимаю
  до Medium: это самый безопасный из недостающих кейсов — `.clear()`
  тривиален по семантике и уже покрыт существующими unit-тестами
  `device-position-history.ts`).
- **AC12 (compatibility).** `custom_components/houseplan/validation.py:1936-1949`
  — схема соответствует §16 (bounded map, `_NONEMPTY_TEXT`, regex на binding,
  `MAX_MARKER_AREA_SNAPSHOT`); `import_export.py:1727` роняет
  `marker_area_snapshot` вместе с `known_devices`/`new_device_ids` при чужом
  источнике — совпадает с §16 «Full import из другого source удаляет...».
  Backend-тесты реально проверяют оба направления (same-source preserve,
  cross-source drop) и границы схемы (5 негативных кейсов + предел+1).
  `scripts/config-field-registry.mjs` и `docs/CONFIG-COMPATIBILITY.md`
  обновлены в одном духе.
- **Save-диалог, `writePlacement`/`previousExplicit` (кроме регрессии H1).**
  Логика сохранения существующего явного override при повторном Save без
  касания комнаты (`previousExplicit && !dlg.roomTouched` → взять значения из
  `previousMarker`, не из `dlg.room`) корректна и необходима для §15 ТЗ
  («При Save обязан заново разрешить binding... stale room draft не может
  вернуть marker в прежнюю комнату»). Именно это подтверждает
  `roomDraftRefreshed`/`noStaleExplicitOverride` в новом smoke.
- **Doc/gate discipline.** Оба changelog правлены в том же коммите, что и
  продуктовый код (`24251a25`, `User-Visible: yes`); трейлеры `Issue`/
  `User-Visible` на месте на обоих коммитах; `docs/CONFIG-COMPATIBILITY.md`,
  `docs/ARCHITECTURE.md`, `docs/FILTERING.md`, EN/RU `USER-GUIDE`,
  `docs/TESTING.md` обновлены по существу, без выдумывания несуществующей
  терминологии (используют «Area», «House Plan room», «red attention dot» —
  термины уже приняты в USER-GUIDE.ru.md/en).
- **Одно число — один источник.** Диф не вводит новую видимую пользователю
  величину, дублируемую в двух местах (нет второго badge/подписи/числа);
  единственная воспроизведённая сущность — булево «отмечено вниманием»,
  которое явно **переиспользует** существующий `new_device_ids`
  (`_newIds` getter объединяет `settings.new_device_ids` и
  `_areaRelocationIds` в одно множество, `houseplan-card.ts:5254-5257`) — один
  источник для чтения, один для записи (после коммита `_areaRelocationIds`
  пусто, `new_device_ids` содержит id). Регрессии по классу #234/#233 не вижу.

## Чего не проверял

- Полную smoke-матрицу (210 файлов) — не запускал, обоснование выбора выше по
  выводу `smoke-select.mjs`; 30 «прямых»/29 «слабых» совпадений не прогнаны —
  риск по существу (не по имени символа) оценил как низкий, диф их не
  затрагивает функционально.
- `npm run golden:verify`, `npm run invariants`, performance-профили,
  `python -m pytest tests_backend -q` целиком — обоснование выше (визуальный
  язык/геометрия/производительность не меняются; backend прочитан точечно, но
  полный прогон питон-сьюта не выполнял).
- Реальный DOM `dispatchEvent('change')` по `#marker-room` для верификации,
  что живой пользовательский клик действительно не задет H1, — сделал вывод
  чтением обработчика (`houseplan-editor-runtime.ts:12852-12855`), не
  исполнением; учитывая, что именно предположение по коду и подвело в этой же
  задаче, эту конкретную гипотезу стоит подтвердить исполнением при доработке.
- Мобильный/touch рендер и kiosk-режим для самой Area-релокации специально —
  косвенно закрыто тем, что `renderSpaceStatic` (used by hosted Static/kiosk)
  и interactive card используют один и тот же resolver и одну и ту же
  `markerPos`/`_livePos` точку входа; отдельного touch-smoke для #126 не
  запускал, т.к. в §15 ТЗ явно сказано «View и kiosk на touch обязаны
  показать то же положение, что desktop View» без нового UI на touch.
