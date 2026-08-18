# Issue #174 — связанный виртуальный источник следует реальному контроллеру

- **Issue:** https://github.com/Matysh/houseplan-card/issues/174
- **Редакция:** первая редакция для независимого ревью; статус определяется только метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 8/10; ценность для разработки 6/10;
  сложность и риск 5/10
- **Область:** canonical light graph, универсальный Toggle, View/kiosk/touch,
  device presentation, preview/confirmation и тесты
- **Модель данных:** без новых полей и миграции
- **Связано:** #84, #94, #107, `docs/LIGHT.md`,
  `docs/DEVICE-LIGHT-SETTINGS-MATRIX.ru.md`, `docs/TOUCH-SUPPORT.md`

## 1. Сценарий и персона

**Персона:** администратор дома настраивает план, после чего он сам, домочадец
или пользователь киоска управляет светом в обычном View.

**Поверхность и момент:** физическая лампа не имеет собственной сущности HA. На
плане она представлена virtual marker с ролью **Всегда** и действием
**Переключить состояние**. Реальный умный выключатель или реле имеет отдельный
marker и в поле **Управляет другими источниками света** ссылается на эту лампу.
Пользователь нажимает либо выключатель, либо изображение лампы.

Задача поддерживает:

- **J1:** Glow, заливка «Свет», статистика комнаты и оба marker показывают одно
  реальное текущее состояние;
- **J3:** очевидное безопасное действие с любой из двух пространственных точек
  действительно переключает физический свет;
- обязательный View/kiosk/touch-контракт: tap и click не расходятся и не создают
  отдельное состояние только внутри карточки.

## 2. Что человек увидит до и после

**До:** клик по реальному выключателю меняет его HA state, но Glow виртуальной
лампы не меняется; клик по лампе меняет только внутреннее ручное состояние House
Plan и не переключает физическое реле.

**После:** связанная пара ведёт себя как два умных представления одного света.
Клик по выключателю или лампе переключает реальное реле, а его HA state едино
управляет Glow, заливкой, статистикой и состоянием обоих marker. Несвязанная
виртуальная лампа сохраняет ручное поведение #107.

## 3. Проблема и подтверждённая причина

В `resolvedLightSources()` passive source сначала получает правильное состояние
по #84:

```text
source.on = OR(active incoming controller driver entities)
```

Затем точная тройка #107 — `binding=virtual`, `is_light=true`, effective
`tap_action=toggle` — безусловно заменяет результат значением operational Store
`virtual_lights`. Поэтому входящие контроллеры существуют в конфигурации, но не
влияют ни на Glow, ни на остальные canonical consumers.

В `resolveToggleIntent()` та же тройка проверяется раньше `controls` и всегда
возвращает operation `virtual-light`. Resolver не рассматривает incoming links
на текущий marker, поэтому клик по лампе не может построить HA-команду к driver
entities контроллеров.

Подтверждённая матрица текущего `dev`:

| Manual state | Реальный driver | Сейчас source.on |
|---|---|---|
| on | on | on |
| on | off | on — driver проигнорирован |
| off | on | off — driver проигнорирован |
| off | off | off |

Это не дубликат:

- #84 ввёл связь passive lamp → реальные driver entities и OR-состояние;
- #107 ввёл ручной state и намеренно дал ему абсолютный приоритет;
- #174 по решению владельца меняет только конфликтующую комбинацию и объединяет
  её с реальным управлением.

## 4. Решение владельца

Владелец подтвердил изменение поведения 18.08.2026:
https://github.com/Matysh/houseplan-card/issues/174#issuecomment-5330854846

1. Пара «умный выключатель/реле + virtual lamp» ведёт себя как два умных
   устройства, когда у обоих выбрано **Переключить состояние**.
2. Клик по любому marker включает/выключает свет на плане и реально переключает
   выключатель/реле.
3. В linked-режиме HA state реальных driver entities является единственным
   текущим источником истины; ручной state #107 применяется только без связи.
4. Рекомендованный в issue default принят как граница lifecycle: создание связи
   не стирает сохранённый manual state, а снятие последней связи возвращает его.

## 5. Термины

| Термин | Значение |
|---|---|
| **Manual-eligible source** | Active marker точной тройки #107 |
| **Incoming link** | Сохранённый `marker:<target_id>` в `controls` другого marker |
| **Linked source** | Manual-eligible passive source, на который существует хотя бы один валидный incoming link |
| **Controller** | Marker, содержащий incoming link |
| **Driver entities** | Реальные effective `light.*`/`switch.*`, по которым #84 вычисляет состояние controller |
| **Manual mode** | Operational `virtual_lights` state несвязанного manual-eligible source |
| **Linked mode** | Состояние и действие через driver entities при наличии incoming link |

`marker:*` остаётся только идентификатором графа. Он никогда не становится HA
entity ID, не читается из `hass.states` и не передаётся в `callService`.

## 6. Скоуп

В задачу входят:

1. приоритет linked controller state над manual state для точной тройки #107;
2. обратное разрешение source → все его incoming controllers → реальные driver
   entities;
3. клик/tap по linked virtual source через существующую групповую семантику HA;
4. сохранение текущего клика по controller и согласование его с тем же driver
   projection;
5. HA state updates от физического устройства и автоматизаций без клика House
   Plan;
6. несколько controllers, дедупликация driver entities и partial availability;
7. preview, confirmation и безопасная повторная резолюция цели;
8. manual fallback после снятия последней связи без потери operational state;
9. единое состояние для Glow, room fill/counts, device presentation, full/static
   cards и редакторского preview;
10. unit, targeted browser smoke, документация и оба changelog.

## 7. Не входит в задачу

- новый UI, отдельная кнопка режима или новое поле конфигурации;
- создание synthetic HA entity/helper либо запись manual state в HA;
- изменение picker, синтаксиса `controls`, валидации, import/export или remap;
- AND/NOT/приоритет между несколькими controllers вместо действующего OR;
- синхронизация цвета/яркости реального relay с passive lamp;
- вызов operational `houseplan/virtual_light/toggle` одновременно с HA service;
- автоматическое связывание лампы и выключателя;
- изменение безопасного запрета для lock/alarm/guarded cover;
- общая переработка universal Toggle вне связи passive source;
- история состояний, автоматизации или новая диагностическая поверхность.

## 8. Контракт состояния

### 8.1. Выбор authority

Для manual-eligible passive source:

```text
if validIncomingLinks.length > 0:
    source.on = any(activeDriverEntity.state == "on")
else:
    source.on = virtualLightIsOn(source, operationalSnapshot)
```

- Сам факт валидной сохранённой связи включает linked mode.
- Если links есть, но ни одного active driver нет, source dormant/off; он не
  возвращается к manual или constant-on.
- Несколько controllers используют OR без второго голоса комнаты.
- HA automation, физическая клавиша либо другой dashboard, изменивший driver,
  меняет source на следующем HA state update без House Plan WS-команды.
- `virtual_lights` revision не может переопределить linked source. Событие Store
  допустимо инвалидирует cache, но визуальный результат остаётся driver-owned.

### 8.2. Driver projection

Driver entities определяются ровно по действующему правилу #84:

1. если controller имеет active реальные entity targets в `controls`, drivers —
   эти effective targets;
2. иначе driver — собственная ведущая controllable entity controller;
3. missing, HA-disabled, unavailable и неподдерживаемые targets не становятся
   executable service targets;
4. одинаковая entity, найденная через несколько controllers/refs, учитывается
   один раз;
5. `marker:*` и passive target не входят в service payload.

Один pure reverse-index/helper является authority и для `source.on`, и для
source Toggle. Две независимо написанные проекции incoming graph запрещены.

### 8.3. Lifecycle manual state

- Добавление первой incoming связи немедленно переключает source на driver
  authority, но не удаляет существующий off-bit.
- Клик по linked source не читает и не меняет off-bit.
- Снятие последней связи немедленно возвращает exact сохранённый manual state;
  если записи нет, действует compatibility default `on`.
- Role/action/binding/delete lifecycle по #107 остаётся прежним и может очистить
  manual state независимо от links.
- Hidden source сохраняет state, но не рисуется. Hidden controller не разрывает
  сохранённую физическую связь по контракту #84.
- Broken ref, target без forced-source роли и self/cycle не создают linked mode
  в runtime; их lossless/validation-поведение остаётся за #84.

## 9. Контракт действия

### 9.1. Клик по controller

Существующий controller Toggle остаётся групповым:

- если любой доступный target/driver включён — `turn_off` всех доступных;
- иначе — `turn_on` всех доступных;
- passive `marker:*` не уходит в HA service;
- в простой паре команда содержит реальный relay controller;
- после HA state update связанная лампа меняет все canonical consumers.

Реализация не должна поддерживать визуал отдельным optimistic manual flip.

### 9.2. Клик по linked virtual source

Для explicit Toggle linked source resolver возвращает обычную typed
`ha-service` operation по объединённым driver entities incoming controllers:

- any available driver on → `turn_off` всех available drivers;
- все available drivers off → `turn_on` всех available drivers;
- partial group вызывает service только для показанного available subset и
  перечисляет пропуски существующим formatter;
- нет available drivers → объяснённый safe no-op, без fallback к
  `virtual-light` и без вызова HA;
- target preview показывает реальные driver names/current effect, а не
  operational virtual target;
- service response сам по себе не меняет visual state; authority — последующий
  HA snapshot, как для обычного умного света.

Для manual-eligible source без incoming links сохраняется поведение #107:
`virtual-light` operation, server-authoritative operational state, sync между
карточками и отсутствие HA service.

### 9.3. Confirmation и гонки

`tap_confirm` сохраняет действующий confirmation flow. Перед выполнением intent
резолвится заново.

- смена manual ↔ linked mode во время открытого confirmation меняет kind/target
  operation и отменяет старое подтверждение как «цель изменилась»;
- изменение набора driver entities не разрешает тихо вызвать другую группу;
- изменение только направления `turn_on` ↔ `turn_off` при том же target set
  допустимо и использует актуальный state;
- исчезновение всех drivers заканчивается safe no-op, без operational fallback.

## 10. Единые визуальные consumers

Linked source получает один `source.on` из canonical light resolver. Этот же
результат обязателен для:

- Glow full card и kiosk;
- room fill «Свет»;
- `resolvedLightState` и `resolvedLightStats` / `N из M`;
- marker background/status и controller aggregate presentation;
- device-editor preview;
- `houseplan-space-card`.

Отдельная ветка в SVG, presentation resolver или room card запрещена. Один HA
state tick обязан обновить все consumers без config rebuild, operational toggle
или polling.

## 11. Модель данных, compatibility и миграция

`Marker`, `ServerConfig`, layout, Lovelace config и backend schema не меняются.
Синтаксис `controls: [marker:<id>]` остаётся форматом #84. Operational Store
`houseplan.virtual_lights` и wire snapshot #107 остаются без изменения.

Compatibility:

| Состояние конфигурации | Поведение после #174 |
|---|---|
| Exact triple, links отсутствуют | Manual state #107 без изменений |
| Exact triple, valid incoming link | Driver-owned linked mode |
| Exact triple, link снят | Прежний manual state снова видим |
| Не exact triple | Обычная семантика #84/#94 |
| Старый frontend/backend | Их прежнее поведение; конфигурация не повреждается |

Новых migration/compatibility fields, materialization, Store reconciliation и
import/export изменений нет. Откат не требует преобразования данных.

## 12. UX, i18n, accessibility и touch

Новых controls, DOM-поверхностей, focus order и ARIA нет. Используются
существующие localized group target/current/next/missing строки universal
Toggle; новые RU/EN i18n-ключи не требуются. Если реализация докажет, что
существующий formatter не может человекопонятно показать driver group, это
считается отдельной продуктовой находкой, а не разрешением молча добавить текст.

View и kiosk на touch — блокирующие:

- один короткий tap выполняет ровно одну service operation;
- long-press по-прежнему открывает карточку;
- pan, pinch, pointercancel и suppressed synthetic click не выполняют Toggle;
- confirmation остаётся доступным и не меняет target после подтверждения;
- отсутствие/ошибка service не создаёт unhandled rejection или ложный Glow.

Device editor остаётся desktop-first; меняется только уже существующий preview.
Touch editor: **best effort**, новых редакторских действий нет.

## 13. Критерии приёмки

- **AC1 (`unit`):** exact triple с incoming controller и `manual=off`,
  `driver=on` даёт `source.on=true`; `manual=on`, `driver=off` даёт false.
  Возврат безусловного manual override обязан красить тест.
- **AC2 (`unit`):** HA state driver, изменённый без House Plan action, сразу
  меняет source, room state/stats и marker/controller presentation через один
  canonical resolver; operational revision не меняет linked result.
- **AC3 (`unit`):** explicit Toggle linked virtual source возвращает
  `ha-service` operation к реальным driver entities, а не `virtual-light`;
  простой relay получает `turn_on`/`turn_off` и никогда не получает marker ID.
- **AC4 (`unit`):** несколько controllers и aliases дают детерминированный
  deduplicated target set; any-on выключает все, all-off включает все.
- **AC5 (`unit`):** unavailable/missing/HA-disabled subset пропускается и
  объясняется; при нуле available drivers intent является safe no-op без manual
  fallback и без service call.
- **AC6 (`unit`):** клик по controller сохраняет #84/#94 group semantics и
  переключает тот же driver projection, которым вычисляется linked source.
- **AC7 (`unit`):** добавление link не стирает manual off-bit; снятие последней
  связи возвращает exact прежний state и operation `virtual-light`. Несвязанные
  regression tests #107 остаются зелёными.
- **AC8 (`unit`):** confirmation принимает смену направления при неизменном
  target set, но отказывает при смене manual/linked mode либо набора drivers.
- **AC9 (`smoke`):** в full View реальный click по controller и по linked lamp
  по очереди вызывает реальное relay, а смоделированный HA state update вместе
  меняет Glow, room fill/count и presentation; operational WS toggle не вызван.
- **AC10 (`smoke`):** touch tap по linked lamp выполняет один HA service;
  long-press/pan/pinch/pointercancel не выполняют service и не меняют visual.
- **AC11 (`smoke`):** внешний HA state update/automation меняет связанный свет
  без клика; unlink возвращает сохранённый manual state и manual toggle #107.
- **AC12 (`unit` + `ревью кода`):** incoming graph/driver projection реализован
  одним authority helper, переиспользованным light state и Toggle; renderer-only
  и дублирующая reverse-graph ветки отсутствуют.
- **AC13 (`unit` + `build`):** no-link #84 constant-on, unlinked #107,
  stateful marker targets, direct entity controls, secure no-op и RU/EN parity
  остаются зелёными; три bundle snapshot побайтово совпадают.
- **AC14 (`ревью кода`):** config/backend/Store/import/export schema не меняются;
  нет optimistic state, polling, новых network paths или ослабления lock/alarm
  invariant.

## 14. План автотестов и гейтов

### Unit

1. Расширить `test/devices.test.mjs` матрицей manual × driver, automation update,
   linked/unlinked lifecycle, multiple controllers и cache invalidation.
2. Расширить `test/device-toggle.test.mjs` reverse source action, dedupe,
   any-on/all-off, partial/zero availability и operation identity.
3. Расширить `test/device-presentation.test.mjs` общей linked-state проекцией.
4. Добавить mutation assertions: возврат manual override и запись
   `virtual_lights` при linked click обязаны красить тесты.

### Targeted browser smoke

Новый `demo/smoke_linked_virtual_light.mjs` либо однозначно названное расширение
существующего controls/Glow smoke строит одну пару relay + virtual lamp,
перехватывает service/operational WS calls и доказывает AC9–AC11. Он выполняется
локально перед `S7-code-review`.

### Implementation loop

```text
npm run typecheck
npm test
npm run build
node demo/smoke_linked_virtual_light.mjs
```

После build три поставляемые bundle-копии совпадают byte-for-byte. Python/backend
гейт не нужен, если diff действительно не затронет backend. Полные smoke,
golden и performance выполняются перед бетой. Нового golden baseline нет: вид
уже существующих on/off состояний не меняется, меняется источник их authority.

## 15. Риски, performance и security

| Риск | Мера |
|---|---|
| Light resolver и Toggle выберут разные driver entities. | Один reverse-index/helper и AC6/AC12. |
| Source click при нескольких controllers переключит только один relay. | Детерминированный union/dedupe и group tests. |
| Broken/dormant link неожиданно вернёт manual Glow. | Сам факт valid link фиксирует linked mode; zero-driver AC5. |
| Confirmation вызовет новую цель после изменения config. | Сравнение operation target sets, AC8. |
| HA service response даст преждевременный визуальный flip. | Только HA state authority, smoke проверяет отсутствие optimistic update. |
| Исправление сломает несвязанную #107 лампу. | AC7 и существующая backend/frontend suite #107. |

Performance: reverse graph уже строится при canonical light resolution. Требуется
переиспользовать или кэшировать ту же bounded проекцию по content fingerprint;
нельзя добавлять полный O(markers + links) обход на каждый visual consumer либо
pointer event сверх одного resolution действия. Нового численного budget нет;
pre-release performance smoke остаётся обязательным.

Security/privacy: service targets остаются allow-listed реальными
`light.*`/`switch.*`, resolver сохраняет unavailable/disabled guards, а
`marker:*` не покидает frontend graph. Новых прав, payload, Store данных и
внешних запросов нет. Lock/alarm invariant не затронут.

## 16. Откат

Откат — обычный revert frontend, тестов, документации, changelog и bundle.
Форматы данных не меняются, поэтому migration/cleanup не нужны. Manual state в
отдельном Store всё время сохраняется и после отката снова становится authority
для exact triple по старому #107.

Feature flag не добавляется: это исправление уже обещанного J1/J3 поведения, а
не экспериментальная presentation-функция.

## 17. Release-артефакты

- пользовательские записи в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том
  же implementation-коммите (`User-Visible: yes`);
- `docs/USER-GUIDE.ru.md` — linked и unlinked recipe;
- `docs/LIGHT.md` и `docs/DEVICE-LIGHT-SETTINGS-MATRIX.ru.md` — authority и
  action matrix;
- supersession note в `docs/specs/107-virtual-light-toggle.md` для linked-случая;
- `docs/ARCHITECTURE.md` — только если меняется публично описанная граница
  resolver/action modules;
- unit и targeted browser smoke;
- синхронные `dist/houseplan-card.js`, HA frontend и demo bundle;
- новых screenshots, golden baseline, backend migration, security report и
  i18n keys не требуется;
- issue закрывается только после включения в опубликованную бету.

## 18. Принятые технические предположения

1. Reverse-index может быть отдельным pure helper либо частью plan-wide light
   graph cache; его форма не продуктовый контракт, если state и action используют
   один результат.
2. Существующий `ResolvedLightSource` можно расширить driver metadata либо
   оставить её в соседнем graph object; нельзя выдавать driver за собственный
   `serviceEids` passive lamp, если это ломает source/service identity #84.
3. «Валидный incoming link» означает существующую runtime-связь к активному
   forced source. Broken/dormant legacy refs сохраняют lossless-поведение #84 и
   не создают выдуманную HA цель.
4. Hidden controller продолжает быть физическим driver по #84; hidden target не
   рисуется, но связь и manual state остаются сохранены.
5. Operational WS command #107 может оставаться backend-доступным для eligible
   marker, однако обычный frontend linked action его не вызывает, а linked
   resolver не читает изменённый off-bit.
6. Existing group formatter и toast должны переиспользоваться. Если нужен новый
   пользовательский текст, это отдельная продуктовая находка и возврат в
   `S3-spec`, а не техническое предположение.
7. Source service action не применяет optimistic Glow: задержка до HA state tick
   совпадает с обычным умным устройством и является частью единого authority.

