# Issue #117 — registry-less YAML entity работает у проёма в View

- **Issue:** https://github.com/Matysh/houseplan-card/issues/117
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P2
- **Тип:** bug, обычный трек
- **Пользовательское изменение:** да

## 1. Проблема

Picker проёма принимает точную live YAML entity без `unique_id`: у неё есть
`hass.states[entity_id]`, но нет Entity Registry row. Live availability уже
считает такую ссылку active. Immutable render path дополнительно требует
`_renderPlanHass.entities[entity_id]`, поэтому сохранённый contact/lock не влияет
на отрисованный проём.

Это разрыв одного exact-binding contract между editor, action и painted frame.

## 2. Установленная причина

`activeRegistryHass()` намеренно сохраняет live states registry-less entities и
удаляет states только при явном disabled/orphaned registry evidence. Однако
`renderOpeningEntityAvailable()` требует одновременно:

```ts
projectedHass.entities[entityId] && projectedHass.states[entityId]
```

У YAML entity первая часть всегда отсутствует. При этом `_openingAmt()` и lock
badges используют именно frame-local helper. Issue #104 сознательно оставил эту
часть отдельной и отметил parity как #117.

## 3. Цели

1. Если exact entity предлагается picker и имеет active live state, её contact
   или lock работает в painted frame.
2. Сохранить запрет disabled/orphaned/missing entities.
3. Сохранить immutable render snapshot: ни один слой не читает raw live hass в
   середине кадра.
4. Не связывать opening reference с marker lifecycle/tombstone.

## 4. Не входит в задачу

- добавление Entity Registry row или `unique_id`;
- изменение candidate picker;
- миграция `opening.contact`/`opening.lock`;
- marker lifecycle и removed bindings;
- изменение lock security/confirmation;
- generic поддержка registry-less entities во всех marker bindings;
- новые opening types или geometry.

## 5. Каноническая availability policy

### 5.1 Live path

`openingEntityAvailable(hass, entityId, snapshot)` остаётся authoritative для
picker, info card и lock action. Exact opening reference active, когда
`resolveHaBindingStatus(...).kind === 'active'`.

### 5.2 Render path

`renderOpeningEntityAvailable(projectedHass, entityId)` принимает только
projection, построенную `activeRegistryHass()` и замороженную в общем render
snapshot.

В такой projection наличие state является достаточным frame-local доказательством:

```ts
return !!entityId && !!projectedHass.states?.[entityId];
```

Отсутствующая registry row не является доказательством disabled. Явно disabled
entity/device и authoritative orphan не проходят, потому что
`activeRegistryHass()` удаляет их state до capture.

Запрещено вызывать render helper с raw `this.hass`. Тип/имя параметра,
комментарий и source-contract test должны сохранять эту trust boundary.

## 6. Матрица поведения

| Entity | Live helper | Render helper | Результат |
| --- | --- | --- | --- |
| registry row active + state | active | active | работает |
| YAML/no registry row + live state | active | active | работает |
| registry entity `unavailable/unknown` | active | active | существующая unknown semantics |
| explicit `disabled_by` entity | inactive | state удалён | не работает |
| explicit disabled parent device | inactive | state удалён | не работает |
| authoritative orphan parent | inactive | state удалён | не работает |
| missing state | inactive/missing | inactive | не работает |
| limited registry + exact live state | active | active | работает |
| marker tombstone того же entity | не влияет | не влияет | opening работает |

`unavailable/unknown` здесь означает, что exact reference существует; текущая
opening renderer semantics решает, рисовать closed/unknown и badge state. #117
не подменяет эти states active/open.

## 7. Render snapshot

Capture уже добавляет `opening.contact` и `opening.lock` в `entityIds`. После
исправления необходимо доказать:

- registry-less state входит в `_renderPlanHass.states`;
- один кадр использует одну и ту же state projection для leaf amount, tone,
  lock badge и tooltip data;
- HA tick заменяет snapshot атомарно;
- config/registry update не смешивается с предыдущим state;
- static `houseplan-space-card` не получает новую интерактивность.

Нельзя исправлять баг чтением `this.hass.states` непосредственно в
`_openingAmt()` или `_renderOpeningLocks()`.

## 8. Contact contract

Для door/window/gate с registry-less contact:

- state проходит текущий `openingAmount(type, state, invert)`;
- invert сохраняется;
- open tone/leaf и opening info согласованы;
- неизвестный state не становится самовольно open;
- скрытие opening symbols не меняет физическую/light semantics, определённую
  существующим opening contract.

## 9. Lock contract и безопасность

Registry-less `lock.*`:

- показывает badge/state по той же матрице, что registry lock;
- info card использует live exact availability;
- lock/unlock action остаётся только в явно открытой info card;
- unlock по-прежнему требует confirmation;
- перед service call выполняется live availability check;
- tap по plan badge/opening не получает новую actuation семантику.

#117 не ослабляет secure-device rules универсального toggle.

## 10. Совместимость

- config/storage/API не меняются;
- существующие registry-backed openings pixel-identical;
- disabled/missing cases не становятся видимыми;
- Plan/View/kiosk touch gestures и hit targets не меняются;
- no new i18n key;
- backend не меняется.

## 11. Acceptance criteria

1. Registry-less live contact, выбранный picker, меняет opening presentation.
2. Registry-less live lock показывает корректный badge/info state.
3. Full-card frame использует immutable active projection, не raw hass.
4. Active registry entity сохраняет прежнее поведение.
5. Disabled entity/device, authoritative orphan и missing state остаются
   unavailable.
6. Limited-registry live exact entity работает.
7. Marker tombstone не блокирует independent opening reference.
8. Lock action security и unlock confirmation не меняются.
9. Contact/lock state update не создаёт geometry/config rebuild.
10. Existing opening golden и interactions не регрессируют.

## 12. План тестирования

### Unit

- расширить `ha-binding-status.test.mjs` для render helper:
  registry-backed, registry-less, disabled entity, disabled parent, orphan,
  missing state, limited registry;
- mutation: вернуть requirement `.entities[entityId]` — YAML case красный;
- `openingAmount` registry-less state/invert parity.

### Browser smoke

- YAML-like `binary_sensor` без registry row: closed → open → closed;
- YAML-like `lock`: locked/unlocked/unknown badge и info;
- disabled row со stale live state не отображается;
- same entity tombstoned as marker, opening всё ещё работает;
- render snapshot atomicity на state tick;
- no service call from direct opening/badge tap; explicit info action unchanged.

### Регрессия

- existing opening/contact/lock smokes;
- `test/render-device-snapshot.test.mjs`;
- typecheck, full unit и build.

Golden обновлять не нужно: registry-backed baseline не меняется. Новый YAML case
проверяется targeted smoke/DOM state; screenshot допустим как новое доказательство,
но не требует переакцептации старых сцен.

## 13. План реализации

1. Исправить frame-local helper и его trust-boundary comment.
2. Добавить unit matrix и mutation guard.
3. Добавить registry-less contact/lock smoke.
4. Проверить snapshot/action parity и regression suite.

## 14. Документация и release-артефакты

- оба changelog получают user-visible bug-fix пункт;
- `docs/USER-GUIDE.ru.md`/diagnostics уточняет, что exact YAML entity без
  `unique_id` поддерживается у contact/lock;
- `docs/ARCHITECTURE.md` или HA binding doc фиксирует render projection rule;
- новых RU/EN строк нет;
- performance/golden/full backend harness не требуются;
- targeted browser smoke обязателен перед S7 по AC.

## 15. Риски и откат

| Риск | Мера |
| --- | --- |
| Raw hass обходит immutable frame | helper принимает только projection + source test |
| Disabled state случайно оживает | complete disabled/orphan matrix |
| Lock security расширяется | отдельные render/live action assertions |
| Marker tombstone снова влияет | independent-reference unit/smoke |

Откат возвращает прежний render helper. Данные не мигрируют; сохранённые exact
references остаются в config.

## 16. Принятые технические предположения

- `activeRegistryHass()` остаётся единственным producer render projection;
- наличие state в этой projection достаточно для exact opening reference;
- unavailable/unknown считаются существующей entity, но не автоматически open;
- `houseplan-space-card` остаётся статическим и не получает actions.
