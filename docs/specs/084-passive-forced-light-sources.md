# #84 — Passive forced light sources and smart-switch links

**Статус:** реализовано локально вместе с #88; ожидает prerelease/CI gate
 (ревизия 2, реализация 2026-08-11)
**Issue:** https://github.com/Matysh/houseplan-card/issues/84
**Канонический файл:** [`docs/specs/084-passive-forced-light-sources.md`](https://github.com/Matysh/houseplan-card/blob/dev/docs/specs/084-passive-forced-light-sources.md)
**Связанные решения:** #55, #65, #66, #67, #73, **#50** (перенос конфигурации), **#88** (выбор ведущей сущности — делать вместе), #85 (тесты должны уметь падать)
**Область:** модель источников света, диалог устройства, связи контроллеров,
канонический light resolver, совместимость конфигурации

---

## 0. Что изменено ревью 2026-08-11

Каждое утверждение ревизии 1 сверено с кодом. Ниже — только расхождения и
принятые решения.

| # | Находка | Решение |
|---|---|---|
| R1 | **Импорт пространства порвёт все `marker:`-ссылки.** #50 переименовывает id каждого маркера, а `controls` копируется буквально: в `import_export.py` слово `controls` встречается ровно один раз — в списке полей, которые *удаляются* при политике дубликатов `virtual` (`:487`); ТЗ #50 §9.1 прямо фиксирует `marker.controls[]` как «сохранить буквально» | Новый §7.5. `marker:`-ссылки ремапятся вместе с id при импорте пространства; ссылки за пределы импортируемого пространства отбрасываются с отметкой в preview; полный импорт не меняет ничего. Правку надо внести в ТЗ #50 **сейчас**, пока его реализация не закоммичена |
| R2 | **Cross-space связи не решены.** §5.3 разрешает разные комнаты, про разные пространства ТЗ молчит, а от этого зависит и picker, и перенос | Нормативно: связь допускается в пределах одного плана, включая разные пространства (§5.3). Space export/import её наружу не переносит (§7.5) |
| R3 | **Capability всё ещё выводится из transient state — ровно там, где §4.2 это запрещает.** `devices.ts:275`: `return forced && hass.states?.[forced] ? [{ eid: forced, via: 'forced' }] : []` — исчезнувший из снапшота HA entity делает stateful-источник passive | §4.2 получает адрес правки: правило меняется в `ownLightCandidatesOf`, а не в диалоге; capability определяется binding + доменом (`isControllable`, `logic.ts:1728`), состояние — отдельно |
| R4 | **Дедупликация и `on` завязаны на `eid`.** `resolvedLightSources` ведёт `const byEntity = new Map<string, number>()` (`devices.ts:333`) и считает `on: hass.states[eid]?.state === 'on'` (`:341`) — у passive-источника `eid` нет вообще | §8.1: ключом карты становится source key (`entity:*` \| `marker:*`); `on` для passive вычисляет резолвер (§5), а не `hass.states` |
| R5 | **`marker:*` отфильтруется до резолвера.** `effectiveMarkerControls` (`devices.ts:214`) прогоняет список через `isControllable`, который пропускает только `light.`/`switch.` | Это и есть гарантия downgrade-safety из §7.2, поэтому фильтр НЕ трогаем. Граф читает `persistedExternalControls` (lossless, `devices.ts:231`), а `effectiveMarkerControls` остаётся списком service targets (§8.3). Иначе «починка» фильтра отправит `marker:*` в `callService` |
| R6 | **Схему бэкенда менять не надо, но валидации нет вообще.** `vol.Optional("controls"): vol.Any(None, vol.All([_TEXT], vol.Length(max=MAX_CONTROLS)))` (`validation.py:644`), где `_TEXT = vol.All(str, vol.Length(max=MAX_TEXT))` (`:118`) — `marker:<id>` проходит уже сегодня | §7.3: схема остаётся пермиссивной; семантическая проверка применяется **только** к записям, добавляющим или меняющим ссылку. Чтение и round-trip битой ссылки не падают — иначе план, где лампу удалили вручную, станет несохраняемым |
| R7 | **Цикл может приехать импортом.** Проверка графа только на пути диалога оставляет дыру | §7.3: та же проверка выполняется в preview импорта (#50) на merged-конфиге, до выдачи apply-токена |
| R8 | **«Memoized per config revision» — известная мина.** В проекте `_cfgEpoch` отстаёт от правок геометрии in-place; на этом уже ломался кэш барьеров света, и `test/golden-matrix.test.mjs` нормативно требует контентный отпечаток и запрещает `_cfgEpoch` в glow-слое | §13: индекс графа кэшируется по **контентному отпечатку** набора маркеров (id + role + controls), не по эпохе конфигурации |
| R9 | **Не названо следствие §5.1.** `resolvedLightState` (`devices.ts:366`) возвращает `on`, если включён хотя бы один источник, а `resolvedLightStats` (`:373`) считает passive и в `total`, и в `on` | §5.1 получает явный абзац: комната с passive-источником без контроллеров никогда не показывает «0 из N» и её заливка «Свет» всегда активна. Это цена детерминированного `Always`; выход — связать источник с контроллером |
| R10 | **§4.1 частично уже выполнен задачей #68.** Светоблок разделён на два `fieldset` (`houseplan-card.ts:15916` без `disabled`, `:15931` с `?disabled=${glowControlsDisabled}`), радиус вынесен наружу | §4.1 переписан под фактическое состояние: остаётся расщепить `glowControlsDisabled` (`:15721`) на два предиката — «источника нет вообще» (гасит всё) и «нет собственного состояния» (гасит только «Из источника») |
| R11 | **§14 ссылается на несуществующий документ.** В `docs/` есть только `USER-GUIDE.ru.md`; английского гайда нет | §14: RU-гайд + английский раздел в `README.md` |
| R12 | **ТЗ не зарегистрировано** в `docs/specs/README.md`, который объявляет себя реестром ТЗ | Строка добавлена в таблицу P2 |

---

## 1. Контекст и отменяемое правило

После реализации #65–#67 роль `marker.is_light: true` («Всегда источник
света») всё ещё не создаёт источник без собственной controllable-сущности HA.
Текущая цепочка такова:

1. `forcedLightEntityOf()` (`devices.ts:259`) ищет entity binding, primary либо
   первую собственную controllable-сущность;
2. без неё `ownLightCandidatesOf()` (`:269`) возвращает пустой список;
3. `selectSpatialGlowSource()` (`:356`) возвращает `null`;
4. диалог гасит контролы цвета, яркости и радиуса (`houseplan-card.ts:15721`).

Это поведение было нормативно закреплено в §4.4
`067-light-source-controls.md` (строка таблицы «**Всегда без собственной
controllable-сущности** → **disabled**»). Настоящее ТЗ **отменяет только это
правило**. Остальные решения #67 — `glow_color`, perceptual brightness,
dormant override, Auto/Never, ownership и `resolvedLightSources()` как единый
источник истины — сохраняются.

Проблема не ограничена virtual marker. Она возникает у `sensor.*`,
неуправляемой сущности, устройства без подходящей primary-сущности и любой
другой привязки, которую пользователь осознанно назначил источником.

**Зеркальная задача — #88.** Там, где управляемая сущность есть, но их
несколько, `forcedLightEntityOf` молча берёт `controllable[0]`: свечением может
начать управлять детская блокировка вместо питания. #84 разблокирует случай
«сущности нет вообще», #88 даёт выбор, когда их много. Обе правят одну цепочку
(`forcedLightEntityOf` → `ownLightCandidatesOf` → `ResolvedLightSource`) и один
блок диалога, поэтому делаются вместе: иначе светоблок и golden переделываются
дважды.

## 2. Пользовательский сценарий и цель

Основной сценарий:

- в стене установлен умный выключатель/реле;
- физическая лампа «тупая» и отсутствует в Home Assistant как отдельная
  сущность;
- на плане нужны два разных объекта: выключатель в месте установки и лампа в
  фактическом месте свечения;
- состояние Glow берётся от выключателя, но позиция, радиус, цвет и яркость
  принадлежат лампе.

Цель — разрешить пользователю создать virtual marker лампы, выбрать «Всегда
источник света», настроить его Glow и связать его с умным выключателем через
существующий раздел «Управляет другими источниками света».

## 3. Термины

| Термин | Определение |
|---|---|
| **Forced source** | Сохранённый marker с `is_light: true` |
| **Stateful forced source** | Forced source с собственной активной controllable HA-сущностью |
| **Passive forced source** | Forced source без собственной controllable HA-сущности |
| **Controller** | Marker, в `controls` которого выбрана другая сущность либо forced-source |
| **Driver entities** | Реальные HA entity IDs, по состоянию которых определяется controller |
| **Marker target** | Ссылка `marker:<marker_id>` внутри `controls` |
| **Service target** | Реальный HA entity ID, который разрешено передать в `callService` |

`Always` означает безусловную **классификацию** marker как пространственного
источника. Для passive source отсутствие собственной HA-сущности больше не
отменяет классификацию.

## 4. Нормативная матрица роли и UI

| Роль и capability | Источник существует | «Из источника» | Ручной цвет | Ручная яркость | Радиус |
|---|---:|---:|---:|---:|---:|
| Auto, resolver нашёл own source | да | active | active | active | active |
| Auto, own source не найден | нет | disabled | disabled | disabled | disabled |
| Never | нет | disabled | disabled | disabled | disabled |
| Always + stateful | да | active | active | active | active |
| **Always + passive** | **да** | **disabled** | **active** | **active** | **active** |

### 4.1 Always + passive (уточнено ревью, R10)

Задача #68 уже разделила светоблок: `fieldset` радиуса
(`houseplan-card.ts:15916`) не наследует `disabled`, а группа режимов
(`:15931`) наследует. Осталось сделать гейтинг режимным:

- `glowControlsDisabled` (`:15721`, сейчас `d.lightRole === 'never' || !spatialSource`)
  расщепляется на два предиката: **источника нет вообще** (Auto без источника,
  Never — гасит всю группу) и **нет собственного состояния** (Always + passive —
  гасит только «Из источника»);
- радиокнопка «Из источника» остаётся видимой, получает настоящий `disabled` и
  `aria-describedby`;
- подсказка: «У устройства нет собственного источника данных. Задайте цвет и
  яркость вручную» (RU/EN полноценными ключами, без конкатенации);
- «Задать цвет» и «Задать цвет и яркость» доступны;
- `hp-color-opacity`, brightness range и radius input не наследуют disabled
  группы режимов;
- для passive source режим «Задать цвет» использует effective brightness 100 %,
  потому что живого brightness нет;
- при отсутствии сохранённого `glow_color` effective fallback равен
  `fill_colors.glow_light.c` (`houseplan-card.ts:10150`), brightness `1`, общий
  radius;
- если диалог открывает уже сохранённый passive source без `glow_color`, UI
  показывает effective ручной режим «Задать цвет и яркость» с fallback, но
  `glowTouched` остаётся false. Open → Save без касания не материализует
  `glow_color`;
- явный переход пользователя в Always допускает такой же draft fallback;
  сохранение роли не обязано сохранять override, пока пользователь не менял
  ручные значения;
- существующий валидный `glow_color` восстанавливается по обычным правилам.

### 4.2 Capability нельзя выводить из transient state (уточнено, R3)

`unavailable`/`unknown` или краткое отсутствие HA snapshot не переводит
stateful source в passive. Capability определяется binding и доменом
(`isControllable`, `logic.ts:1728`), а состояние — отдельно.

Нормативно: правку делать **в `ownLightCandidatesOf` (`devices.ts:269-276`)**,
где сегодня стоит `forced && hass.states?.[forced]`, а не в диалоге и не в
рендерере. Отсутствие entity в снапшоте даёт источник в состоянии
«неизвестно/off» по правилам #73, но не меняет классификацию.

HA-disabled binding следует принятой политике disabled devices: marker скрыт и
не участвует в light model, но конфигурация сохраняется. К passive source
понятие HA-disabled неприменимо: у него нет собственной сущности.

## 5. Состояние passive source

### 5.1 Без контроллеров

Passive forced source без сохранённых controller links считается постоянно
включённым. Это единственное детерминированное значение явного `Always`, когда
источника состояния нет.

Он:

- создаёт Glow в позиции marker;
- участвует в room light state и `N из M` один раз;
- использует ручные/fallback color, brightness и radius;
- не создаёт HA service action сам по себе.

**Следствие, которое нужно принять сознательно (R9):** `resolvedLightState`
(`devices.ts:366`) вернёт `on` для любой комнаты с таким источником, а
`resolvedLightStats` (`:373`) посчитает его и в `on`, и в `total`. Значит
комната с несвязанной «тупой» лампой никогда не покажет «0 из N» и её заливка
«Свет» всегда активна. Единственный выход для пользователя — связать источник с
контроллером (§5.2). Это должно быть написано в пользовательской документации
рядом с рецептом «тупая лампа».

### 5.2 С контроллерами

Если на passive source ссылается хотя бы один сохранённый controller, состояние
источника определяется контроллерами:

```text
passiveSource.on = any(activeController.driverEntities is on)
```

- Семантика нескольких контроллеров — OR.
- У controller с реальными entity targets в `controls` driver entities равны
  этим effective targets (`effectiveMarkerControls`, `devices.ts:214`).
- Если реальных entity targets нет, используется собственная primary
  controllable-сущность controller.
- Marker target не становится driver entity и не участвует в рекурсии.
- Если links существуют, но после settle нет ни одного активного driver,
  источник dormant/off, а не «постоянно включён».
- Краткий разрыв HA использует visual continuity #73/последнее устойчивое
  состояние и не должен мигать on/off.

### 5.3 Ownership и границы связи

| Свойство | Владелец |
|---|---|
| Положение и комната Glow | marker лампы-цели |
| Цвет, яркость, радиус | marker лампы-цели |
| On/off | effective controller drivers либо constant-on без links |
| HA service call | только реальные service targets/controller binding |
| Room statistics vote | лампа-цель, один раз |

Выключатель в комнате A может управлять лампой в комнате B. Свет и статистика
относятся к B; положение выключателя не создаёт второе пятно.

Нормативно (R2): **связь допускается и между разными пространствами** одного
плана — этаж с выключателем и этаж с лампой встречаются в реальных домах.
Ограничение одно: перенос между инстансами такие связи наружу не выносит
(§7.5).

## 6. Picker «Управляет другими источниками света»

### 6.1 Список кандидатов

Picker объединяет:

1. существующие доступные `light.*`/`switch.*` HA entities (тот же предикат
   `isControllable`, что и в рантайме);
2. все сохранённые plan markers с `is_light: true` — из всех пространств плана.

Forced-source отображается в группе «Источники на плане» с:

- именем marker;
- иконкой;
- комнатой и пространством;
- признаком «виртуальный»/«без собственной сущности», когда применимо.

Поиск работает по имени, entity ID (если есть), комнате и пространству.

### 6.2 Фильтрация и дедупликация

- Текущий marker не может выбрать себя.
- Removed target не показывается.
- HA-disabled target не доступен для нового выбора.
- User-hidden target не предлагается как новая цель, но уже сохранённый chip
  остаётся видимым как dormant/hidden и не стирается.
- Stateful forced-source и его own entity отображаются одной строкой —
  предпочтительно как plan source, чтобы связь переживала rebind.
- Existing direct entity control остаётся валидным и не переписывается при
  нетронутом Save.
- Entity ref + marker ref одного effective stateful source дают один service
  target и один room vote.

### 6.3 Chips

Chip marker target показывает имя, а не сырой `marker:*`. Для broken/dormant
ссылки chip остаётся с warning и кнопкой удаления. Неизвестная ссылка не
должна молча исчезать при Open → Save.

## 7. Модель данных и совместимость

### 7.1 Формат

Нового параллельного массива не вводить. Расширяется существующий список:

```yaml
markers:
  - id: smart_switch
    controls:
      - light.real_group
      - marker:v_dumb_bulb
  - id: v_dumb_bulb
    binding: virtual
    is_light: true
    glow_color:
      c: "#ffd58a"
      bri: 0.75
```

Тип:

```ts
type LightControlRef = EntityId | `marker:${string}`;
```

### 7.2 Почему `controls`, а не новое поле (подтверждено кодом, R5)

- Это одна пользовательская коллекция «какими источниками управляет marker».
- Сохраняется текущая UI-модель.
- `persistedExternalControls()` (`devices.ts:231`) фильтрует только собственную
  сущность marker, поэтому любые неизвестные строки переживают Open → Save
  без изменений — round-trip для `marker:*` работает уже сегодня.
- `effectiveMarkerControls()` (`:214`) прогоняет список через `isControllable`,
  который пропускает только `light.`/`switch.` — значит старый фронтенд
  физически не может отправить `marker:*` в `callService`.

**Запрещено** «чинить» `isControllable` под новый префикс: этот фильтр и есть
граница между source identity и service identity (§8.1).

### 7.3 Валидация (уточнено, R6, R7)

Схема бэкенда не меняется: `controls` уже принимает произвольные строки
(`validation.py:644`, `_TEXT` ≤ 500 символов, `MAX_CONTROLS = 200`). Новой
является **семантическая** проверка, и у неё строгая область применения.

Проверяется только запись, которая **добавляет или изменяет** ссылку:

- значение — валидный entity ID либо `marker:<non-empty-id>`;
- marker target существует в том же config package;
- target не равен controller;
- target имеет `is_light: true` для новой связи;
- дубликаты отклоняются/нормализуются детерминированно;
- граф marker refs не содержит циклов;
- применяются существующий лимит `MAX_CONTROLS` и общий лимит payload.

Не проверяется и никогда не отклоняется:

- чтение конфигурации с битой ссылкой (лампу могли удалить руками или
  YAML-правкой) — runtime игнорирует ссылку, диагностика показывает проблему,
  round-trip остаётся lossless. Иначе план становится несохраняемым.

Проверка цикла и существования target выполняется также **в preview импорта
(#50) на merged-конфиге, до выдачи apply-токена** — иначе цикл приезжает
файлом мимо диалога.

### 7.4 Lifecycle

- Delete target атомарно удаляет его refs из всех controllers.
- Rebind/смена marker id атомарно переписывает refs old → new.
- Move/room reassignment не меняет refs.
- `Always → Auto/Never` не удаляет refs: они становятся dormant, chip получает
  warning, возврат в Always восстанавливает связь.
- Повторная HA-активация/доступность восстанавливает relation без Save.
- Delete controller удаляет его links; passive target без других links снова
  работает как constant-on explicit Always.

### 7.5 Перенос между инстансами (новое, R1/R2)

`marker:`-ссылка — это внутренний идентификатор плана, а не HA-сущность,
поэтому она обязана следовать правилам remap ТЗ #50, а не правилу «сохранить
буквально».

| Операция | Поведение |
|---|---|
| Полный экспорт/импорт | ничего не меняется: id маркеров сохраняются |
| Экспорт пространства | `marker:`-ссылки на маркеры **того же** пространства экспортируются; ссылки наружу отбрасываются и считаются в preview отдельной строкой |
| Импорт пространства | `marker:`-ссылки переписываются по той же immutable remap map, что и `marker.id`; ссылка, чей target не попал в импорт, удаляется, а не остаётся висеть |
| Политика дубликатов `virtual` | уже сегодня удаляет `controls` целиком (`import_export.py:487`) — поведение сохраняется, в preview это отражается как потеря связей |
| Entity-ссылки внутри того же `controls` | остаются буквальными, как и раньше |

**Это требует правки ТЗ #50 §9.1**: строка `marker.controls[]` перестаёт быть
целиком «буквальной» и делится по префиксу значения. Правку нужно внести до
коммита реализации #50, иначе первая же выпущенная версия перенесёт битые
ссылки, и понадобится миграция.

## 8. Канонические runtime resolvers

### 8.1 Нельзя выдавать marker ref за HA entity (уточнено, R4)

Текущая `ResolvedLightSource` (`devices.ts:193`) построена вокруг обязательного
`eid`, а `resolvedLightSources` (`:327`) дедуплицирует источники через
`const byEntity = new Map<string, number>()` (`:333`) и вычисляет
`on: hass.states[eid]?.state === 'on'` (`:341`). Для passive source нужно явное
разделение понятий:

```ts
interface ResolvedLightSource {
  key: `entity:${string}` | `marker:${string}`;
  stateEids: string[];
  serviceEids: string[];
  device: LightSourceDevice;
  via: "controls" | "forced" | "light";
  castsGlow: boolean;
  on: boolean;
}
```

Точные имена можно изменить при реализации, но инварианты обязательны:

- source identity не равна service identity;
- дедупликация идёт по `key`, а не по `eid`: карта `byEntity` заменяется картой
  по source key;
- `on` для passive source вычисляет резолвер по правилам §5, а не
  `hass.states[...]`;
- `marker:*` никогда не попадает в `hass.states[...]` как будто это entity и
  никогда не передаётся в `callService`;
- passive source может иметь пустые `stateEids` и `serviceEids`;
- stateful marker target резолвится в реальные service entities;
- `via` остаётся трёхзначным: passive — это `forced` с `castsGlow: true`,
  четвёртого значения не вводить.

### 8.2 Один resolver для всех consumers

`resolvedLightSources()` и связанные pure helpers остаются единственным
источником истины для:

- независимого Glow overlay;
- заливки «Свет»;
- room light state;
- `resolvedLightStats`/`N из M`;
- room card/controls;
- preview устройства.

Запрещено реализовать passive-only ветку непосредственно в renderer или
диалоге. `selectSpatialGlowSource()` должен принимать passive source, а
`resolveGlowValues()` (`logic.ts:1679`) — получать marker override и optional
state attributes.

### 8.3 Control action

Перед вызовом HA строится отдельный дедуплицированный список `serviceEids`;
его источник — `effectiveMarkerControls()`, который по-прежнему пропускает
только `light.`/`switch.` (§7.2).

- Stateful marker target добавляет свою controllable entity.
- Passive marker target не добавляет service target.
- Если список controls содержит только passive targets, обычный Toggle
  controller продолжает переключать его own primary entity.
- Если есть реальные external controls, сохраняется текущая group semantics:
  any-on → turn_off all, иначе turn_on all. Passive targets следуют этому
  effective aggregate.
- Пустой список service entities не вызывает `callService`.

## 9. Цвет и яркость runtime

- Stateful source: текущая цепочка `rgb_color → kelvin → palette` и live
  brightness, если не перекрыты `glow_color`.
- Passive source: live attributes отсутствуют; `glow_color.c` либо palette,
  `glow_color.bri` либо `1`.
- Mode «Задать цвет» на passive source: manual color + brightness `1`.
- Mode «Задать цвет и яркость»: оба manual slots.
- Глобальный alpha ceiling и perceptual curve #67 не меняются.
- Анимация появления/исчезновения 0.5 s и правила LIGHT.md/#73 сохраняются.

## 10. Edge cases

1. **Virtual lamp без controller:** постоянно включена (см. следствие §5.1).
2. **Один switch controller:** следует его own primary.
3. **Controller с группой HA lights:** следует `any(on)` группы и общей
   toggle-semantics.
4. **Несколько controllers:** OR без двойного room vote.
5. **Controller и lamp в разных комнатах:** Glow/статистика в комнате lamp.
6. **Controller и lamp в разных пространствах:** то же; связь допустима (§5.3).
7. **Target перемещён:** только Glow position меняется.
8. **Target скрыт:** link сохранён, Glow отсутствует; chip dormant.
9. **Target HA-disabled:** по disabled-device policy не влияет; link dormant.
10. **Controller unavailable:** continuity, затем inactive; не constant-on.
11. **Target Always → Never/Auto-no:** link не стирается, source отсутствует.
12. **Target снова Always:** link оживает автоматически.
13. **Stateful → passive rebind:** link сохраняется, переходит на controller
    drivers и manual/fallback Glow.
14. **Passive → stateful rebind:** link сохраняется, service/state резолвятся в
    HA entity; «Из источника» становится доступным.
15. **Entity ref + marker ref:** один service call/source vote.
16. **Broken ref:** нет падения и service call; diagnostics + lossless chip.
17. **Self/cycle:** UI не предлагает, backend отклоняет ручной payload и
    импортируемый файл (§7.3).
18. **Save without touch:** не материализует fallback и не чистит dormant refs.
19. **Cancel:** не меняет role, refs или glow override.
20. **Импорт пространства с внутренней связью:** обе стороны переименованы,
    связь сохранена (§7.5).
21. **Импорт пространства со связью наружу:** ссылка отброшена и показана в
    preview, а не сохранена битой (§7.5).

## 11. UX, i18n и accessibility

- Все новые строки RU/EN; parity gate обязателен.
- Для disabled «Из источника» объяснение видимо текстом, а не только title;
  при наличии механизма #68 объяснение подаётся через `<hp-help>`, а не новым
  паттерном.
- Радиогруппа сохраняет accessible name; disabled опция имеет настоящее
  disabled состояние.
- Picker и chips доступны с клавиатуры; удаление chip имеет локализованный
  accessible label.
- Candidate row имеет достаточный touch target и не создаёт горизонтальный
  scroll в мобильном диалоге.
- Live preview показывает effective Glow result, но не полную геометрию пула.
- Изменение HA state не перехватывает focus и не спамит screen reader.

## 12. Acceptance criteria

1. `is_light: true` всегда создаёт forced source для активного marker, даже без
   собственной controllable-сущности.
2. Always + passive разблокирует manual color, brightness и radius.
3. «Из источника» для Always + passive остаётся disabled с объяснением.
4. Правило работает для virtual, sensor и любой иной non-source binding.
5. Классификация не меняется от пропажи entity из снапшота HA (§4.2).
6. Forced markers доступны в controls picker других markers, включая другие
   пространства.
7. Virtual dumb bulb может следовать smart switch и светить в собственной
   позиции/комнате.
8. Unlinked passive Always source считается on, и это честно отражено в
   документации (§5.1).
9. Несколько controllers дают OR; source/statistics не дублируются.
10. Marker ref никогда не уходит в HA service call.
11. Stateful marker target реально переключается через resolved entity.
12. Delete/rebind/role/hidden/disabled lifecycle соответствует §7.4/§10.
13. **Импорт пространства сохраняет внутренние связи и не создаёт битых
    внешних** (§7.5).
14. Existing entity controls сохраняют поведение и round-trip.
15. Старый frontend не уничтожает marker refs при untouched save.
16. Битая ссылка не мешает сохранить план.
17. Все light consumers получают один и тот же результат canonical resolver.
18. RU/EN, keyboard, touch, mobile footer и screen reader покрыты.

## 13. Тест-план

### Unit

- Матрица role × stateful/passive/virtual/sensor/unavailable/disabled.
- Capability helper без transient misclassification: entity пропал из
  `hass.states` → источник остаётся stateful (регрессия на `devices.ts:275`).
- Manual/fallback color, `bri`, radius и dormant override.
- Graph: no controller, one, many/OR, self, cycle, broken ref.
- Dedupe direct entity + marker ref; дедупликация по source key, а не по `eid`.
- Controller drivers and service target projection; `marker:*` не попадает в
  `serviceEids` ни при какой комбинации.
- Room ownership across different rooms/spaces.
- `resolvedLightStats` one vote per passive source.

### Persistence/backend

- Schema accepts entity ID and valid marker ref (без изменения схемы).
- Reject syntax/self/cycle/nonexistent target/duplicate/limit overflow **на
  записи, добавляющей ссылку**.
- Чтение и сохранение конфигурации с битой ссылкой не отклоняются.
- Lossless round-trip broken/dormant refs.
- Atomic target delete cleanup; atomic id rewrite on rebind.
- **Импорт (#50):** внутренняя связь переименована вместе с id; внешняя
  отброшена и посчитана в preview; цикл в импортируемом файле отклонён до
  выдачи токена.
- Downgrade fixture: prior frontend ignores runtime ref but preserves string.

### Component/smoke

- Picker groups, search, candidate labels and chips.
- Always + passive gating; Auto/Never/stateful regressions.
- Live draft switching binding/role without Save.
- Smart switch toggle drives virtual lamp preview/runtime.
- Save/Cancel and no silent materialization.
- Hidden/disabled warning chips.
- Mobile dialog without horizontal scroll/footer regression.

### Golden/performance

- Dumb lamp and smart switch in different rooms, on/off, dark/light.
- Mobile dialog with passive target selected.
- Индекс графа кэшируется по **контентному отпечатку** маркеров (id + role +
  controls), а не по `_cfgEpoch`: правка `controls` in-place обязана
  инвалидировать кэш (R8). Тест обязан краснеть, если ключ заменить на эпоху.
- No additional full device rebuild or graph traversal per source per render.

### Мутанты (контракт #85)

Задача не считается выполненной, пока не показано, что тесты краснеют при:

1. возврате `hass.states`-проверки в capability (§4.2);
2. дедупликации по `eid` вместо source key (§8.1);
3. попадании `marker:*` в `serviceEids` (§8.3);
4. отключении remap `marker:`-ссылок при импорте пространства (§7.5);
5. кэшировании графа по `_cfgEpoch` (§13).

## 14. Документация и changelog

Обновить:

- `docs/specs/067-light-source-controls.md` — ссылка на superseding rule #84;
- `docs/specs/050-config-export-import.md` — §9.1 (см. §7.5);
- `docs/USER-GUIDE.ru.md` — рецепт «тупая лампа + умный выключатель», включая
  честное предупреждение из §5.1; английская версия — раздел в `README.md`
  (отдельного EN-гайда в проекте нет);
- `docs/ARCHITECTURE.md` — source/state/service identity;
- `docs/CONFIG-COMPATIBILITY.md` — `marker:*` controls refs и downgrade;
- `docs/LIGHT.md` — canonical passive-source semantics;
- RU/EN changelog значимой пользовательской фичей, со ссылкой на #84.

## 15. Вне scope

- Ручной on/off state для virtual source.
- AND/NOT/пороговые выражения вместо OR.
- Передача live color/brightness controller → passive fixture.
- Автосоздание fixtures по HA relations.
- Отдельный drag-and-drop редактор связей.
- Изменение clip/spill/door/window geometry Glow.
