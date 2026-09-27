# Issue #317 — климат комнаты следует размещению датчика в House Plan

- Дата: 2026-08-28
- Тип: bug · приоритет P2
- Оценка: пользовательская ценность 7/10 · сложность 4/10 · риск 4/10
- Issue: [#317](https://github.com/Matysh/houseplan-card/issues/317)
- Ветка: `issue/317-room-climate-placement`

Канонические документы: `docs/SCOPE.md`, `docs/ARCHITECTURE.md`,
`docs/FILTERING.md`, `docs/CONFIG-COMPATIBILITY.md`, `docs/TOUCH-SUPPORT.md`,
`docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

## 1. Сценарий и персона

Житель разместил реальный датчик температуры или влажности в комнате House
Plan и включил климатические метрики пространства. Он ожидает, что датчик
влияет на подпись комнаты, tooltip и температурную заливку той комнаты, в
которой виден на плане. Это ожидание одинаково для комнаты, связанной с HA
Area, и для комнаты без HA Area.

Поверхности: основной план в View/kiosk и hosted Static. Настройка явного
источника комнаты остаётся доступна в редакторе комнаты. Это J1 «что происходит
сейчас» и J5 «климат комнаты с первого взгляда» из `docs/SCOPE.md`.

## 2. Что человек увидит до и после

**До:** marker датчика можно вручную поместить в комнату House Plan, но
автоматическая средняя температура/влажность продолжает следовать только
`area_id` реестра HA. У комнаты без HA Area автоматического среднего нет вовсе.

**После:** реальный датчик участвует в автоматическом среднем той комнаты, куда
он явно помещён в House Plan. Перенос marker немедленно переносит и его вклад;
старое HA Area больше не получает этот вклад. Комната без HA Area работает по
тому же правилу. Явно выбранный в свойствах комнаты источник по-прежнему имеет
высший приоритет.

## 3. Подтверждённый диагноз

`areaClimateMap()` одним проходом группирует registry entities исключительно по
`entity.area_id || device.area_id`. Сохранённые `marker.area`, `marker.space` и
`marker.room_id` используются `buildDevices()` для визуального размещения, но
не участвуют в климатическом агрегате. `_roomTemp()` и `_roomHum()` затем читают
карту только по `room.area`; ранний gate `_renderRoomLabel()` дополнительно не
пытается показать автоматический климат у комнаты без HA Area.

Выбор `room.settings.temp_source`/`hum_source` работает, поскольку
`sourceValue()` обходит автоматический агрегат. Tooltip, подпись и temp-fill
используют общие `_roomTemp/_roomHum`, поэтому дефект воспроизводится сразу на
трёх пользовательских поверхностях.

## 4. Зафиксированное решение владельца

1. Явный источник температуры/влажности комнаты имеет высший приоритет.
2. Для автоматического среднего явное размещение реального датчика в House
   Plan имеет приоритет над HA registry Area.
3. Сенсор учитывается ровно в одной климатической цели; перенос marker не
   оставляет голос в старой HA Area.
4. Правило распространяется на комнаты без HA Area: реальный датчик, помещённый
   туда через `room_id`, участвует в среднем автоматически.
5. Скрытый, но сохранённый marker продолжает участвовать; удалённый marker либо
   HA-disabled binding не участвует.
6. Подпись комнаты, tooltip и температурная заливка читают один результат.

Продуктовых вопросов не осталось.

## 5. Скоуп

### Входит

- room-aware климатический агрегат температуры и влажности;
- приоритет точного `entity:` marker над `device:` marker для этой entity;
- приоритет размещения `device:` marker над registry placement для остальных
  принадлежащих устройству entities;
- автоматический климат комнаты без HA Area;
- ровно один registry pass на один render snapshot и O(1) lookup комнаты;
- parity View/kiosk/hosted Static и всех трёх потребителей климата;
- unit, production-bundle smoke, performance и mutation evidence;
- актуализация архитектуры, RU/EN user guide, testing и обоих changelog.

### Не входит

- изменение LQI, света, площади, room hover либо tooltip layout;
- новый UI, selector или настройка;
- изменение эвристики, какие readings считаются комнатной температурой или
  влажностью (`NON_AIR_RE`, entity category, icon rules);
- изменение опции `use_climate_temp`, кроме применения того же placement;
- миграция `marker.area`, `marker.room_id`, room settings или model version;
- автоматическое создание marker для комнаты без HA Area;
- изменение фильтрации, удаления либо HA-disabled lifecycle;
- backend, registry API, polling или запись конфигурации.

## 6. Контракт данных

### 6.1. Климатическая цель комнаты

Агрегат должен поддерживать два непересекающихся вида цели:

- **area target** — HA Area комнаты (`room.area`); историческое поведение для
  всех комнат, использующих эту Area, сохраняется;
- **local-room target** — пара `(space.id, room.id)` для комнаты без HA Area.

Внутренний key может быть tagged string либо структурой, но не должен допускать
коллизию HA Area с local room. `room.id` без `space.id` недостаточен. Marker со
ссылкой на несуществующую комнату может создать невостребованную цель, но не
должен падать, попадать в другую комнату либо записывать config.

### 6.2. Назначение каждой entity

Каждая active registry entity рассматривается ровно один раз. Её effective
placement определяется в таком порядке:

1. live exact marker `entity:<entity_id>` с явной комнатой;
2. live parent marker `device:<device_id>` с явной комнатой;
3. registry `entity.area_id`;
4. registry `device.area_id`;
5. без цели — не участвует в автоматическом среднем.

Явная комната marker определяется так:

- непустой `room_id` вместе с `space` и `area: null` → local-room target;
- непустой `area` → area target;
- иначе placement не переопределён, применяется registry fallback.

Точная entity с live marker исключается из parent-device projection только
если её marker действительно задаёт другую/effective цель. Удалённый exact
marker не перехватывает entity у живого родительского устройства — сохраняется
binding-scoped tombstone contract #262. Если удалён весь parent device, live
exact child marker по #262 может восстановить только эту entity и назначить её
своей комнате; siblings остаются исключены.

При нескольких некорректно дублированных live markers одного binding применяется
тот же детерминированный first-match contract, что и `buildDevices()`; двойной
голос запрещён.

### 6.3. Группировка и среднее

После effective placement entities группируются по `(target, device_id)`, а
standalone/exact projection — по собственной entity identity. Это сохраняет
действующую модель «одно физическое устройство — один голос» внутри цели и не
склеивает части одного устройства, вручную разнесённые по разным комнатам.

Существующие правила определения воздуха сохраняются:

- diagnostic/config entities не участвуют;
- excluded domains и `NON_AIR_RE` фильтруются;
- автоматический icon resolver решает thermometer/air-filter/water-percent;
- `use_climate_temp: true` разрешает `current_temperature` выбранного climate
  binding и подчиняется тому же effective placement;
- unavailable/missing/non-numeric readings голоса не дают;
- temperature округляется до 0.1°, humidity — до целого процента.

Entity не может голосовать одновременно в marker target и registry target.
Одинаковая marker и registry Area также даёт только один голос.

### 6.4. Lifecycle и видимость

| Состояние | Участие в автоматическом климате |
|---|---|
| Нет marker, active HA entity/device с Area | Да, в registry Area как сейчас |
| Live visible marker | Да, по effective placement |
| Live `hidden: true` marker | Да, по effective placement |
| Удалённый `entity:` marker при живом parent device | Binding-scoped contract #262: parent может продолжить учитывать entity в своей effective/registry цели |
| Удалённый `device:` marker | Нет; live exact child — только сам child |
| HA-disabled entity/device | Нет |
| Orphaned/unverified/missing state | Нет голоса; без исключения и без resurrection |
| Virtual marker | Нет |

User-hidden означает «не показывать значок», а не «не использовать данные».
Удаление и HA-disable означают исключение из plan data. Эти правила совпадают с
действующей документацией и не требуют нового флага.

## 7. Приоритет источников комнаты

Для каждой величины независимо:

1. если `room.settings.temp_source`/`hum_source` задан, вернуть его валидное
   значение через действующий `sourceValue()`;
2. иначе прочитать room-aware automatic aggregate по room target;
3. если target или валидных readings нет — `null`.

Явный источник не смешивается со средним и не меняет membership автоматического
агрегата. Невалидный явно выбранный источник сохраняет действующее fail-closed
поведение `null`; автоматический fallback за ним самовольно не включается.

## 8. Потребители и UX

- **Room label:** включённые `label_temp`/`label_hum` показывают значения и у
  комнаты без HA Area; существующий outer gate больше не блокирует их.
- **Tooltip:** показывает те же temperature/humidity, что label, без изменения
  структуры, pointer/touch поведения и площади.
- **Temperature fill:** `fill_mode: temp` использует тот же `_roomTemp()` и
  меняет цвет той же комнаты.
- **Hosted Static:** использует тот же frame-local snapshot и resolver.
- **Editor preview:** отдельного нового preview нет; dimmed live plan за room
  dialog остаётся тем же renderer.

Перенос marker и следующий HA state tick должны менять все потребители
атомарно. Snapshot continuity сохраняется: допустимо кратко показать предыдущее
согласованное состояние, но нельзя в одном кадре показать новое значение в label
и старую заливку либо наоборот.

Новых элементов, строк i18n, жестов и touch-обязательств нет. Desktop и touch
View/kiosk получают одинаковые данные.

## 9. Model, compatibility и migration

Persisted schema, `Marker`, room settings, model version и backend не меняются.
Существующие `area`/`space`/`room_id` читаются как есть. Миграции и config save
нет.

Ожидаемая compatibility-дельта только визуальная: после обновления некоторые
существующие marker, вручную перенесённые относительно HA Area, начнут влиять на
комнату House Plan, где они уже отображались. Это исправление неверной runtime
интерпретации, а не перепись данных. Старый frontend продолжит считать по HA
Area; новый применит правило на первом render.

Комментарий типа `Marker.room_id` и `parseRoomRef()` должен описывать local room
без HA Area как поддерживаемое назначение, а не утверждать, что room-aware
потребителей кроме визуального размещения нет.

## 10. Архитектура и производительность

Нужен один общий room-aware resolver рядом с текущим `areaClimateMap()`. Старый
export/wrapper может быть сохранён для совместимости тестов и area-only callers,
но карточка не должна строить отдельную area-map и room-map двумя проходами.

Инварианты:

- один `Object.entries(hass.entities)` на новый frame-local hass snapshot;
- число проходов не растёт от количества комнат, marker или потребителей;
- lookup `_roomTemp/_roomHum` — O(1);
- cache key учитывает hass snapshot, icon rules, markers и room target model;
- смена space/model/markers инвалидирует target map;
- новый registry/backend fetch, timer либо subscription запрещён.

`createRenderDeviceSnapshot()` обязан сохранить registry/state rows реальных
markers, включая hidden marker, чтобы View и hosted Static вычисляли одинаковое
среднее. Расширять snapshot всем HA registry разрешено только если доказано, что
текущая device projection недостаточна; предпочтителен bounded набор уже
размещённых devices/entities плюс Area rows текущих комнат.

## 11. Документация и i18n

Новых UX-строк нет; каталоги `en/ru/de` не меняются. Обновляются:

- `docs/ARCHITECTURE.md`: room-aware target, precedence и one-pass cache;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: ручное размещение реального
  датчика определяет автоматический климат, в том числе без HA Area;
- `docs/TESTING.md`: точная regression/performance/mutation matrix;
- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: короткий user-visible пункт со
  ссылкой на #317.

## 12. Критерии приёмки

| AC | Требование | Доказательство |
|---|---|---|
| AC1 | Sensor из registry Area A с live marker в Area B голосует только в B; при совпадении Area голосует один раз | `test/devices.test.mjs` exact mean matrix |
| AC2 | Sensor с `space + room_id + area:null` даёт temperature/humidity комнате без HA Area | unit + production-bundle smoke |
| AC3 | Exact `entity:` placement имеет приоритет над parent `device:` placement только для этой entity; siblings остаются у parent/registry | unit ownership matrix |
| AC4 | Hidden marker участвует; removed device, HA-disabled и unavailable не участвуют; device tombstone + live exact child сохраняет #262 | unit lifecycle matrix |
| AC5 | `use_climate_temp` следует effective placement и не создаёт дубль; существующие air/non-air filters и округление не меняются | existing + new climate units |
| AC6 | Explicit room source остаётся выше automatic aggregate и не получает silent fallback при invalid value | room source unit/browser fixture |
| AC7 | Label, tooltip и temp-fill area-less комнаты используют один room-aware result; перенос marker обновляет их вместе | расширенный production-bundle smoke |
| AC8 | View/kiosk и hosted Static получают одинаковый result из bounded render snapshot; config не мутирует | snapshot/shared resolver test + diff audit |
| AC9 | Registry сканируется один раз на snapshot и не чаще при 44/60 rooms либо repeated render | расширенный `demo/smoke_climate_once.mjs` |
| AC10 | Мутант, игнорирующий marker placement либо возвращающий label gate `room.area`, ловится целевым тестом | `scripts/mutation-gate.mjs` direct run |
| AC11 | Typecheck, unit, build, bundle sync/budget, docs check и выбранные smokes зелёные | точные команды в issue handoff |

## 13. План реализации и проверок

1. Вынести стабильный room climate target/key и построение effective placement
   в чистые helpers `src/devices.ts` либо соседний pure module.
2. Перестроить одно-проходный aggregate так, чтобы target выбирался до
   device/entity grouping, сохранив area-only compatibility wrapper.
3. Передать текущие rooms/space identity в card cache либо использовать
   канонический key, который `_roomTemp/_roomHum` строят без линейного поиска.
4. Убрать area-only gate label; не менять LQI gate.
5. Проверить bounded render snapshot для hidden/manual markers и hosted Static.
6. Добавить AC1–AC6 unit matrix, AC7/AC9 production-bundle smoke и AC10 mutant.
7. Обновить канонические документы и оба changelog.
8. Перед `S7-code-review` выполнить минимум:

```text
npm run typecheck
npm test
npm run build
npm run bundle:sync
npm run bundle:budget
node scripts/check-docs.mjs
node scripts/smoke-select.mjs --base origin/dev --head HEAD
node demo/smoke_climate_once.mjs
node demo/smoke_climate_temp.mjs
node scripts/mutation-gate.mjs --id=<new-room-climate-placement-mutant>
```

Все дополнительные smokes, выбранные `smoke-select`, обязательны. Golden
baseline в реализации не принимается; полный visual gate остаётся предрелизным.

## 14. Риски и меры

| Риск | Мера |
|---|---|
| Перенесённый sensor останется голосом старой Area | effective target выбирается до grouping; AC1 проверяет обе карты |
| Entity и parent marker дадут двойной голос | exact ownership + одно назначение каждой entity; AC3 |
| Area-less room collide с HA Area/другим space | tagged key включает `space.id + room.id` |
| Hidden либо restored child потеряется из snapshot | bounded snapshot regression и lifecycle matrix |
| Disabled/orphaned data воскреснет из live `hass.states` | resolver принимает active projection; negative tests |
| Производительность вернётся к O(rooms × entities) | один pass, cache identity и traced ownKeys smoke |
| Разойдутся label/fill/tooltip | единственные `_roomTemp/_roomHum`; один browser fixture проверяет три поверхности |
| Изменится эвристика air sensors | не трогать classifier; existing tests и non-air negative matrix |

## 15. Безопасность и privacy

Новых service calls, разрешений, сетевых запросов, логов и persisted identifiers
нет. Решение только читает уже доступные active registry/state rows. Entity и
device IDs не выводятся в UI. Disabled/missing данные не должны использоваться
как fallback.

## 16. Откат и release-артефакты

Откат — вернуть area-only lookup и сопровождающие tests/docs. Обратной миграции
нет, потому что config не меняется. Если до беты обнаружится неоднозначность
старых duplicated markers, задача возвращается в `S3-spec`; нельзя добавлять
новый compatibility flag без решения владельца.

- user-visible: **yes**;
- оба changelog содержат один короткий пункт со ссылкой на #317;
- release body включает исправление только если оно значимо для публикуемого
  диапазона, иначе входит в `Small fixes and improvements`;
- issue закрывает release manager после зелёной опубликованной беты;
- новый golden baseline не ожидается: semantic DOM/result smoke достаточен,
  если существующая visual matrix остаётся зелёной.

## 17. Принятые технические предположения — менять свободно

1. Area target можно оставить raw `area_id` ради compatibility, а local room
   сериализовать как tagged key; внешний формат key не является API.
2. Existing `areaClimateMap()` можно расширить либо обернуть новым
   `roomClimateMap()`; важно, чтобы card делал один registry pass.
3. Exact marker без явной комнаты не обязан раскалывать parent group: registry
   placement остаётся fallback.
4. Existing `_renderDevices` и snapshot projection вероятно уже содержат hidden
   marker entities; это нужно доказать тестом, а не расширять snapshot заранее.
5. LQI остаётся area-only и сознательно не входит в #317.
