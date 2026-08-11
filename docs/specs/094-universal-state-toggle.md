# Issue #94 — универсальное действие «Переключить состояние»

- **Статус:** ТЗ принято владельцем; редакция 2 после технического ревью
  2026-08-12; готово к реализации
- **Issue:** https://github.com/Matysh/houseplan-card/issues/94
- **Область:** frontend, marker action model, HA service dispatch, backend
  compatibility, i18n, документация и QA
- **Приоритет:** P2
- **Тип:** bug + feature / UX

## 1. Резюме

В настройках каждого устройства вариант действия по нажатию
`Переключить (свет/розетки)` заменяется универсальным вариантом
**«Переключить состояние»**.

Он показывается для всех устройств без исключения: HA-bound, entity-bound,
device-bound и виртуальных. Выбор всегда сохраняется. Сразу под селектором
диалог объясняет результат тем же resolver, который выполнит действие:

- какую сущность или группу сущностей переключит нажатие;
- какую семантику имеет переключение;
- либо почему у marker сейчас нет переключаемого состояния.

Если цели нет, нажатие является полным no-op: не вызывается HA service, не
открывается карточка устройства и не происходит скрытой подмены действия.

Отдельный пользовательский вариант `Открыть/закрыть (шторы/жалюзи)` удаляется.
Корректная семантика cover/valve остаётся внутренним адаптером общего действия.
Legacy `tap_action: cover` продолжает читаться и импортироваться, но в UI
проецируется как новый `toggle`. До явного изменения действия пользователем
runtime сохраняет исходную cover-семантику и приоритет цели; обычное
Open → Save не является миграцией и не меняет persisted token.

## 2. Исследование текущей реализации

### 2.1. Где расходятся UI, config и runtime

Сейчас:

1. `TAP_ACTIONS` в `src/logic.ts` объявляет одновременно `toggle` и `cover`.
2. Диалог в `src/houseplan-card.ts` показывает `toggle` всем marker, но
   `cover` фильтрует по binding.
3. Save безусловно пишет выбранный `tap_action`; backend принимает `toggle` и
   `cover`.
4. При клике `resolveTapAction()` повторно проверяет domain и может молча
   вернуть `info` вместо явно сохранённого `toggle`/`cover`.
5. `_clickDevice()` отдельно обрабатывает external controls, `run`, `cover`,
   direct `toggle`, `more-info` и в конце открывает внутреннюю info-card.
6. Для virtual marker нет `primary`, поэтому explicit `toggle` фактически
   заканчивается info-card. Пользователь воспринимает это как сброшенную
   настройку.
7. Для части пассивных доменов explicit `toggle`, наоборот, проходит resolver
   и вызывает `homeassistant.toggle` у сущности, которая не умеет включаться и
   выключаться.

Итоговая ошибка архитектурная: один слой разрешает выбор, второй сохраняет, а
третий самостоятельно решает, считать ли выбор действительным.

### 2.2. Почему нельзя просто снять domain-фильтр

Home Assistant определяет состояние не для device, а для его entities.
`homeassistant.toggle` работает только с entity, которая действительно
поддерживает включение и выключение. Sensor, binary sensor, button, number,
select и многие другие сущности имеют состояние, но не имеют операции toggle.

У составного device могут одновременно присутствовать:

- функциональная сущность (`cover.*`, `climate.*`, `media_player.*`);
- диагностические sensors;
- конфигурационные switches;
- скрытая основная сущность и видимый служебный switch;
- несколько независимо управляемых функций.

Поэтому универсальным должен стать UX и контракт resolver, а не слепой вызов
одного сервиса для любого `primary`.

Официальная модель HA подтверждает это: `homeassistant.toggle` применим только
к entity, поддерживающим turn on/off, а cover и valve предоставляют свои
`toggle`/open/close/stop actions:

- https://www.home-assistant.io/docs/scripts/perform-actions#homeassistant-actions
- https://www.home-assistant.io/integrations/cover
- https://www.home-assistant.io/actions

## 3. Пользовательская ценность

**Оценка: высокая, 8/10.** Это маленький UI-блок, но он исправляет базовое
доверие к настройкам устройства:

- выбранное действие больше не превращается молча в другое;
- до сохранения понятно, чем именно управляет marker;
- виртуальный marker честно сохраняет будущую настройку даже без текущей цели;
- шторы, свет, розетки, climate, media player и другие управляемые domains
  укладываются в одну понятную модель;
- пользователь видит ошибочную auto-resolution до первого нажатия;
- support получает entity id и причину no-op прямо из UI, а не восстанавливает
  их по конфигу и registry.

Особенно полезно для сложных интеграций, где device содержит десятки entities
и `primary` неочевиден.

## 4. Цели

1. Один понятный вариант «Переключить состояние» для всех marker.
2. Один resolved result для hint, клика, confirmation и cover-индикации.
3. Explicit action всегда сохраняется и никогда не подменяется другой action.
4. Никаких service calls при отсутствии безопасной и поддерживаемой цели.
5. Сохранить текущую групповую семантику `controls`.
6. Сохранить корректное open/close/stop поведение cover/valve без отдельного
   пользовательского пункта.
7. Обеспечить lossless compatibility старых конфигов.

## 5. Не входит в задачу

- отдельный пользовательский селектор target entity;
- произвольный выбор HA service и service data;
- настройка разных действий для single/double/hold/right click;
- изменение `Запрашивать подтверждение`;
- изменение long press и right click;
- управление атрибутами, position, brightness, temperature или режимами;
- запуск button/input_button через toggle;
- автоматическая материализация действия у всех старых marker;
- изменение секции `Управляет другими источниками света` и её light semantics;
- полная замена действия `Запустить` для script/scene/automation.

Если auto-target неверен у сложного device, пользователь в первой версии
может создать точный `entity:` binding. Отдельный target picker следует
добавлять только по подтверждённым кейсам, а не расширять этот scope заранее.

## 6. UX диалога

### 6.1. Список действий

Нормативный порядок:

1. `Карточка устройства` (`info`);
2. `Диалог Home Assistant` (`more-info`);
3. `Переключить состояние` (`toggle`);
4. `Запустить сценарий/автоматизацию` (`run`).

`Открыть/закрыть (шторы/жалюзи)` больше не показывается.

`Переключить состояние` видно всегда, независимо от binding и текущей
доступности HA.

### 6.2. Пояснение под селектором

Hint показывается, когда эффективное выбранное действие равно `toggle`, в том
числе когда light использует default toggle без materialized `tap_action`.
Hint связан с select через `aria-describedby` и обновляется при изменении
binding, controls, registry, HA state или action.

Hint обязан показывать не только постоянную пару состояний, но и **текущее
состояние плюс ожидаемый результат следующего нажатия**. Идентификатор target
стабилен, а current/next часть обновляется по live state без Save.

Примеры:

```text
Будет переключаться: Торшер (light.floor_lamp).
Сейчас включено → по нажатию выключится.
```

```text
Будет переключаться: Шторы (cover.living_room).
Сейчас открываются → по нажатию остановятся.
```

```text
Будут переключаться 3 источника: Люстра, Бра, Торшер.
Сейчас включён 1 из 3 → по нажатию выключатся все доступные цели.
```

```text
У этого устройства нет состояния, которое можно переключить.
По нажатию ничего не произойдёт.
```

```text
Настроенные цели сейчас недоступны. Собственная сущность устройства не будет
подставлена вместо них.
```

Для одного target всегда показываются friendly name и entity id. Для группы
показываются количество и имена; полный список entity id доступен в
раскрываемом/переносимом detail либо title, не создающем горизонтальный scroll.
Если часть группы недоступна, hint отдельно называет количество пропущенных
целей и перечисляет их в detail; пользователь до клика видит точный состав
будущего service call.

### 6.3. Confirmation

`Запрашивать подтверждение` остаётся на прежнем месте и с прежней моделью:

- показывается для `toggle`, `run` и legacy cover, спроецированного в toggle;
- сохраняется в `tap_confirm` без изменений;
- confirmation открывается только если resolver вернул исполняемую команду;
- no-op не показывает бессмысленное подтверждение;
- текст confirmation использует те же структурированные target-данные, что hint;
- при открытии confirmation запоминаются идентификаторы целей, но не готовая
  команда;
- после подтверждения resolver запускается повторно. Если набор целей изменился,
  действие отменяется с toast `Цель действия изменилась. Повторите попытку`;
- если цели те же, но их state изменился, команда пересчитывается по актуальному
  состоянию и выполняется. Захваченная до confirmation команда никогда не
  исполняется вслепую.

Для сравнения используются отсортированные уникальные entity id текущей
команды; порядок registry/controls не считается изменением цели. Переход
пропущенной цели в доступную или обратно меняет фактический набор команды и
требует нового tap/confirmation.
Если повторный resolver больше не возвращает `command` (entity стала
unavailable/disabled/secure либо исчез service/adapter), действие отменяется с
тем же toast и без вызова HA.

### 6.4. Save

- `toggle` разрешено сохранять всегда, даже при `kind: none`.
- Save не требует target.
- После повторного открытия явно выбранный action остаётся `toggle`; legacy
  `cover` отображается в select как `toggle`, но сохраняет свой origin.
- Смена binding не сбрасывает action; меняется только resolved hint.
- Если target появляется позднее, сохранённый toggle начинает работать без
  повторного Save.
- Dialog хранит `originalTapAction` и `tapActionTouched`. Обычный Open → Save
  не materialize-ит default и не переписывает legacy token; новая запись
  появляется только после фактического изменения select пользователем.
- Если пользователь действительно изменил select и выбрал
  `Переключить состояние`, Save пишет `tap_action: 'toggle'`; с этого момента
  применяется новый контракт explicit toggle.

## 7. Единая resolved-модель

Вынести чистый resolver, не завязанный на Lit template:

```ts
type ToggleNoneReason =
  | 'no-binding'
  | 'no-actionable-entity'
  | 'configured-targets-missing'
  | 'ha-disabled'
  | 'unavailable'
  | 'unsupported'
  | 'secure';

type ToggleSemantics = 'power' | 'group-power' | 'cover' | 'valve';

type ToggleOrigin =
  | 'explicit-toggle'
  | 'default-light'
  | 'legacy-cover';

type ToggleNextEffect =
  | 'turn-on'
  | 'turn-off'
  | 'open'
  | 'close'
  | 'stop'
  | 'toggle';

interface ResolvedToggleTarget {
  entityId: string;
  name: string;
  state: string | null;
  via: 'binding' | 'device-role' | 'control-entity' | 'control-marker-driver';
}

interface SkippedToggleTarget {
  ref: string;
  entityId: string | null;
  name: string | null;
  reason: 'missing' | 'ha-disabled' | 'unavailable' | 'unsupported' | 'secure';
}

interface ResolvedToggleIntent {
  origin: ToggleOrigin;
  kind: 'single' | 'group' | 'none';
  semantics: ToggleSemantics | null;
  // Только цели текущего service call; порядок детерминирован.
  targets: ResolvedToggleTarget[];
  skippedTargets: SkippedToggleTarget[];
  noneReason: ToggleNoneReason | null;
  nextEffect: ToggleNextEffect | null;
  command: null | {
    domain: string;
    service: string;
    data: { entity_id: string | string[] };
  };
}
```

Название интерфейса не нормативно; нормативна одна функция и один результат.
`command !== null` является единственным признаком исполнимости; отдельное
поле `executable` не вводится. Pure resolver не возвращает готовые
локализованные `label`/`detail`: общий formatter строит hint, confirmation и
диагностику из этого же результата. Это исключает расхождение перевода и
фактической команды.

Для частичной группы `targets` в точности соответствует текущему service call,
а `skippedTargets` сохраняет пользовательское намерение и причину пропуска.
Для single target, который временно недоступен, `targets` пуст, identity
показывается из `skippedTargets`, `command` равен `null`.

Resolver получает:

- effective action;
- marker/config и `DevItem`;
- registry-aware HA projection;
- resolved devices для marker controls;
- текущие states/services.

Его потребляют:

1. hint в диалоге;
2. `_clickDevice()`;
3. confirmation text;
4. выбор cover entity для presentation/icon morph/activity;
5. preview diagnostics при необходимости.

Ни один consumer не повторяет domain/target resolution самостоятельно.

## 8. Нормативный алгоритм выбора цели

### 8.1. Приоритет намерения

Сначала определяется origin действия:

- `explicit-toggle` — пользователь явно сохранил `tap_action: 'toggle'`;
- `default-light` — у light отсутствует materialized action и действует
  существующий default;
- `legacy-cover` — в конфиге сохранён `tap_action: 'cover'`.

Далее цель выбирается с учётом origin:

1. **External controls** владеют tap только для `explicit-toggle`. Если raw
   persisted controls не пусты, они являются явным пользовательским намерением.
2. **Точный entity binding.** Используется только связанная entity. Если она
   unsupported, missing, disabled или unavailable, resolver не ищет sibling.
3. **Device binding.** Используется первая поддерживаемая entity из
   `resolvedDeviceStateEntities`, то есть из функциональной роли device, а не
   по registry order.
4. **Virtual без controls.** `kind: none`, `no-actionable-entity`.

`default-light` сохраняет прежнее поведение: переключает собственную light и
не передаёт tap внешним controls. `legacy-cover` сохраняет прежнюю cover-цель
и игнорирует controls до явного изменения action пользователем. Благодаря
этому открытие старого marker в новом UI не является скрытым изменением
поведения.

Нельзя переходить к следующему пункту, если более приоритетное *явное*
намерение существует, но временно недоступно. В частности, stale/disabled
controls не дают общего fallback на собственный switch контроллера; единственное
исключение — явно описанная ниже driver-семантика ссылки на passive forced-light
marker.

### 8.2. Фильтрация device candidates

Для device binding:

- config/diagnostic entities не становятся implicit target;
- disabled registry rows не участвуют;
- hidden functional entity участвует: hidden в HA не означает disabled;
- unavailable/missing entity сохраняется как объяснимый target, но команда не
  выполняется до восстановления;
- функциональная роль (`cover`, `climate`, `media_player`, `light`, etc.)
  приоритетнее служебных switches;
- если resolved role пассивна или заблокирована secure contract, случайный
  sibling switch не подставляется;
- exact `entity:` binding может осознанно выбрать такой switch.

Это предотвращает повторение проблем с Anti interference, Customized Cleaning,
reverse direction и другими peer/config entities.

### 8.3. External controls

Сохраняется текущий контракт:

- resolved entity/marker references de-duplicate;
- обычная ссылка на entity разрешается только в эту entity, без fallback;
- ссылка на пассивный forced-light marker разрешается в собственную
  переключаемую entity контроллера как в driver этой связи. Это специальная
  семантика существующей модели «умный выключатель управляет виртуальной тупой
  лампой», а не общий fallback при stale control; если у контроллера нет
  собственной поддерживаемой actionable entity, связь остаётся no-op;
- несколько пассивных marker, использующих один driver, дают одну
  дедуплицированную service target;
- если хотя бы одна активная цель `on`, команда — `homeassistant.turn_off` для
  всей группы;
- если все активные цели `off`, команда — `homeassistant.turn_on`;
- временно missing/disabled цели не удаляются из config;
- service call получает только доступное и поддерживаемое подмножество. Hint
  показывает число и список пропущенных целей; group state считается только
  по целям, которые войдут в вызов;
- если после resolution нет ни одной доступной поддерживаемой цели, result =
  `configured-targets-missing`, без fallback;
- self-reference не становится external control;
- виртуальный marker с валидными controls переключает их точно так же, как
  HA-bound controller.

Эта задача не расширяет допустимый состав `controls`: он остаётся частью
существующей light-source модели и её текущей валидации. Универсальность нового
tap action относится к выбору собственной цели marker, а не превращает
`Управляет другими источниками света` в произвольный multi-domain target picker.

## 9. Domain adapters

### 9.1. Power/toggle

Entity допускается, если:

- binding активен;
- entity не относится к secure contract;
- для domain существует централизованный adapter с известным контрактом
  turn_on/turn_off/toggle, а entity удовлетворяет его требованиям;
- нужный service присутствует в текущем `hass.services` как runtime guard;
- entity существует в registry/state projection.

Само наличие `<domain>.toggle` в `hass.services` не доказывает capability
конкретной entity: список services публикуется на уровне domain. Поэтому нельзя
строить поддержку только на этой проверке или слепо вызывать
`homeassistant.toggle` для произвольного state.

Каждый adapter обязан декларативно задать:

- predicate применимости к конкретной entity, включая `supported_features`,
  если domain кодирует capability feature bits;
- какие states считаются off и on/active;
- точные `turn_on`/`turn_off` services и обязательные service data;
- допустим ли `toggle` при `unknown`, либо безопасен только no-op;
- человекочитаемые current/next semantics для formatter.

При известном state resolver предпочтительно строит направленную команду
`turn_on` или `turn_off`: именно её обещает hint. `<domain>.toggle` допустим
только если adapter явно объявляет его безопасным для неопределённого state.
Если adapter не может доказать capability или next effect, entity получает
`unsupported`, а не оптимистичный service call.

Registry может содержать отдельные проверенные adapters для light, switch,
fan, humidifier, climate, media_player, input_boolean, automation, remote,
siren, vacuum, water_heater и других domains. Появление нового service в HA
само по себе не включает domain автоматически. `script`/`scene` не получают
toggle только из-за наличия `turn_on`: их запуск остаётся action `run`.
Список adapters и state semantics не копируется по renderer/click paths.

Для automation hint обязан говорить «включить/выключить автоматизацию», а не
«запустить»: запуск остаётся отдельным action `run`.

### 9.2. Cover

Пользователь видит общий `toggle`, но resolver использует cover semantics:

- `closed` → `cover.open_cover` либо `cover.toggle`;
- `open`/ajar → `cover.close_cover` либо `cover.toggle`;
- `opening`/`closing` + feature support и наличие service stop →
  `cover.stop_cover`;
- движение без stop support → `cover.toggle`;
- `unknown` → `cover.toggle`;
- `unavailable`/missing → no-op до восстановления.

Для каждой ветки проверяются feature support конкретной entity и наличие
выбранного service. Fallback на `cover.toggle` разрешён только если adapter
подтвердил его доступность; иначе результат — `unsupported`/no-op.

Таким образом удаляется отдельная настройка, но не ухудшается уже корректное
поведение «нажатие во время движения останавливает штору».

### 9.3. Valve

Аналогично cover:

- closed → open;
- open → close;
- opening/closing + feature support и наличие service stop → stop;
- иначе `valve.toggle`;
- unavailable/missing → no-op.

Для open/close/stop/toggle действуют те же двойные guards: feature capability
конкретной entity и наличие service в загруженном domain.

### 9.4. Непереключаемые domains

Sensor, binary_sensor, number, select, text, event, button, input_button,
script, scene, image, weather, person, device_tracker и прочие entities без toggle
service дают `no-actionable-entity`/`unsupported`. Наличие изменяющегося state
само по себе не считается capability.

## 10. Защищённые устройства — принятое решение

Существующий House Plan contract запрещает обычным tap переключать:

- `lock.*`;
- `alarm_control_panel.*`;
- secure cover classes `garage`, `door`, `gate`.

Запрет сохраняется. Вариант `Переключить состояние` остаётся видим
и сохраняется, но resolver возвращает `kind: none`, `reason: secure` и hint:

```text
Переключение замков, сигнализации и защитных ворот с плана заблокировано из
соображений безопасности. По нажатию ничего не произойдёт.
```

Причины:

- optional confirmation не является достаточной защитой: пользователь может
  оставить её выключенной;
- generic toggle не выражает arm mode, code, lock/unlock direction;
- HA и voice ecosystems отдельно классифицируют lock, alarm и door/garage/gate
  covers как secure devices;
- расширять полномочия существующих конфигов молча нельзя.

Любое будущее разрешение secure toggle является отдельной задачей с
обязательным confirmation и явным предупреждением. Текущая задача такого
расширения не авторизует.

Secure-фильтр применяется после разрешения каждой цели, включая targets,
полученные через binding, device role и external controls. Косвенная ссылка на
secure entity не позволяет обойти запрет. Если группа по ошибке содержит такую
цель, она исключается из команды и явно отмечается в hint; если безопасных целей
не осталось, результат — `secure`/no-op.

## 11. Legacy и модель данных

### 11.1. Persisted tokens

Новых config fields не требуется:

- новый UI пишет `tap_action: 'toggle'`;
- backend продолжает принимать `tap_action: 'cover'` как legacy read/import
  compatibility token;
- UI показывает legacy `cover` как выбранный пункт `toggle`, но runtime
  передаёт resolver origin `legacy-cover`, не стирая исходный token;
- UI никогда не создаёт новый `cover`, однако untouched запись продолжает
  сериализоваться как `cover`;
- только фактическое изменение action пользователем материализует `toggle` и
  переводит marker на origin `explicit-toggle`;
- импорт/полный round-trip старого плана не падает до пользовательского
  редактирования.

Backend не должен начать отклонять untouched legacy `cover`, иначе любая
несвязанная запись всей конфигурации может сломаться.

### 11.2. Default light action

Текущий default сохраняется:

- pure `light` без explicit action по умолчанию переключается;
- остальные marker по умолчанию открывают info-card;
- dialog hint для default light строится как для toggle;
- простое Open → Save не обязано materialize default, если пользователь не
  менял action;
- наличие `controls` не меняет default-light tap: внешняя группа получает
  приоритет только после явного выбора `Переключить состояние`;
- пользовательский выбор другого action остаётся сильнее default.

### 11.3. Presentation

Если resolved toggle target имеет semantics `cover`, он становится тем же
cover indicator, который управляет morph/activity marker. Отдельная проверка
`tapAction === 'cover'` удаляется. Mixed device показывает cover только если
именно cover выбран единым target resolver; иначе presentation не меняется.

## 12. Lifecycle и edge cases

| Ситуация | Нормативное поведение |
|---|---|
| Virtual без controls | Сохраняет toggle; no-target hint; tap = no-op |
| Virtual с active controls и explicit toggle | Group hint и group toggle |
| Virtual controls временно missing | Missing hint; no fallback; config сохранён |
| Control ссылается на passive forced-light marker | Собственная actionable entity контроллера становится driver связи; без неё no-op |
| Entity-bound light/switch | Точная entity, без sibling inference |
| Entity-bound sensor | Unsupported hint; tap = no-op |
| Device с cover + config switch | Cover role, config switch не перехватывает tap |
| Device с climate + sensors | Climate role, sensors не участвуют |
| Switch-only composite device | Выбранный resolved Power/representative switch показывается в hint |
| Несколько равноправных functional entities | Детерминированно первая по shared role resolver; hint честно показывает её |
| Target state `unknown` | Target сохраняется; adapter может вызвать domain toggle |
| Target `unavailable` | Hint «сейчас недоступно»; tap = no-op |
| Entity исчезла из states, но есть registry row | Missing/unavailable hint; без retarget |
| Entity disabled_by HA | Команды нет; lifecycle устройства остаётся действующим |
| Весь device disabled | Marker скрыт по действующему contract; action/config не стираются |
| Friendly name изменён | Hint обновляет имя, entity id остаётся тем же |
| Integration добавила более сильную role entity | Auto-target device binding может измениться; hint отражает результат |
| Explicit controls + own relay | Controls полностью выигрывают; relay не fallback |
| Default light + controls | Собственный light default сохраняется; controls не перехватывают tap |
| Legacy cover + controls | До явного изменения action сохраняется старая cover-цель; controls игнорируются |
| Group: one on, others off | Turn off all |
| Group: all off | Turn on all |
| Group: часть unavailable/missing | Команда для доступного подмножества; hint перечисляет пропущенные цели |
| Cover moving | Stop при support, иначе domain toggle |
| Legacy `cover`, Open → Save | UI показывает toggle; runtime сохраняет legacy cover semantics; token остаётся `cover` |
| Legacy `cover`, пользователь меняет action на toggle | Save пишет `toggle`; начинает действовать explicit-toggle contract |
| `tap_confirm: true`, target есть | Confirmation перед service call |
| `tap_confirm: true`, target нет | Confirmation не показывается, tap = no-op |
| Target state изменился в confirmation | При тех же target id команда пересчитывается и выполняется по актуальному state |
| Target set изменился в confirmation | Действие отменяется с toast; stale command не выполняется |
| static_icon | Меняет только presentation, action работает как настроено |
| hidden marker | Не интерактивен как и сейчас |
| right click / long press | Без изменений: info/more-info path |
| Service исчез между hint и tap | Повторный resolution; no-op + toast, без stale call |
| Service call rejected | Локализованный error toast, action/config не меняются |

## 13. Ошибки и feedback во время View

В обычном стабильном no-target состоянии клик ничего не показывает: hint уже
объяснил настройку, а marker может быть виртуальной декоративной кнопкой.

Если исполняемая команда существовала, но исчезла между render и click, допускается
один короткий toast `Действие сейчас недоступно`; service call не выполняется.
Ошибка реального service call использует существующий error toast.

Нельзя открывать info-card как fallback ни в одном explicit toggle case.

## 14. Accessibility и touch

- select имеет постоянный label и `aria-describedby` на hint;
- изменение hint объявляется через ненавязчивый `aria-live="polite"` только
  при пользовательском изменении action/binding, не на каждом HA state tick;
- entity id остаётся копируемым текстом;
- длинные имена переносятся и не создают horizontal scroll;
- no-target и secure состояния различимы не только цветом;
- View tap target остаётся marker; новая подпись не появляется на плане и не
  вмешивается в pinch/pan;
- editor на touch остаётся best-effort по общей политике, View — полностью
  поддерживаемым.

## 15. I18n

Добавить/обновить синхронно RU/EN:

- `tap.toggle`: «Переключить состояние» / “Toggle state”;
- single target hint;
- group target hint и group semantics;
- no actionable state;
- configured targets missing;
- unavailable target;
- secure target blocked;
- partially unavailable/skipped targets;
- target changed during confirmation;
- cover/valve semantics;
- current action wording при необходимости;
- accessible descriptions.

Удалить из активного UI, но не обязательно из legacy словарей, `tap.cover`.
Тест паритета i18n обязателен.

## 16. Архитектурный план

1. Вынести projection action для UI и lossless определение origin
   (`explicit-toggle`/`default-light`/`legacy-cover`) вместе с единым
   `resolveToggleIntent` в небольшой pure module, а не наращивать
   `houseplan-card.ts`.
2. Использовать shared `resolvedDeviceStateEntities` и registry lifecycle.
3. Свести target selection, current command и human explanation в один result.
4. Перевести `_clickDevice()` на resolved result без fallback.
5. Перевести cover indicator/presentation на тот же result.
6. Перевести dialog hint и confirmation на тот же result.
7. Удалить `cover` из UI `TAP_ACTIONS`, сохранив backend compatibility.
8. Обновить marker types/comments/import-export policy.

## 17. Тестовая матрица

### 17.1. Unit

- action origin/projection: every current token + legacy cover + unknown;
- untouched legacy cover сохраняет token, target priority и presentation;
- touched legacy action materialize-ит explicit toggle;
- default light с controls не меняет прежний собственный target;
- exact entity light/switch/fan/climate/media player/vacuum, когда
  зарегистрированный adapter подтверждает capability;
- sensor/binary_sensor/button/select/number/scene no-op;
- service absent from `hass.services` → unsupported;
- наличие domain service без зарегистрированного entity adapter не делает
  entity переключаемой;
- cover closed/open/opening/closing/unknown/unavailable, with/without stop;
- cover/valve stop требует и feature bit, и доступный service;
- valve equivalent;
- lock/alarm/secure cover → secure no-op;
- virtual without controls;
- virtual with entity and marker controls;
- passive forced-light marker control resolves to controller driver and
  de-duplicates repeated driver targets;
- controls any-on/all-off group semantics;
- partially unavailable group executes available subset and reports skipped;
- configured but all missing controls do not fall back;
- exact entity binding outranks device siblings;
- device role outranks config/diagnostic switches;
- hidden functional entity remains eligible, disabled one does not;
- legacy cover сохраняет прежнюю cover target/presentation semantics, пока
  пользователь явно не изменил action;
- default light and explicit override;
- exact entity unsupported/missing never retargets to device sibling;
- confirmation re-resolve: same targets/new state recomputes command; changed
  targets cancel without a call;
- no target never resolves to info/more-info.

### 17.2. Backend/import-export

- every current UI action accepted;
- legacy cover accepted;
- unknown action rejected;
- `toggle` without binding target accepted for virtual marker;
- `tap_confirm` round-trip for command and no-target cases;
- full/partial import/export preserves legacy and new records;
- unrelated config save cannot fail because an untouched marker contains
  `cover`.

### 17.3. Browser/smoke

- selector shows `Переключить состояние` for HA device, exact entity and
  virtual marker;
- `Открыть/закрыть` absent;
- virtual select → Save → reopen remains toggle;
- legacy cover Open → Save remains `cover` in persisted config;
- explicit change of legacy cover writes `toggle`;
- virtual no-target click does not open info-card and makes no service call;
- hint target exactly equals service-call target;
- binding and controls changes update hint before Save;
- unavailable transition changes hint and suppresses call;
- когда вся группа доступна, group call uses the complete resolved list;
- partial group call uses exactly the available subset shown in hint;
- cover tap chooses open/close/stop correctly;
- confirmation unchanged for direct/group/cover and absent for no-op;
- RU/EN long hints fit without horizontal scroll;
- right click/long press unchanged.

### 17.4. Mutation gate #85

Минимум четыре доказательных мутанта:

1. Вернуть fallback `info` для no-target toggle → падает no-op smoke.
2. Разрешить stale controls fallback на primary → падает controls-intent unit.
3. Развести dialog и click resolvers → падает target parity smoke.
4. Удалить legacy `cover` из backend schema → падает compatibility test.
5. Materialize-ить untouched legacy/default при Open → Save → падает lossless
   round-trip test.
6. Считать наличие domain service достаточным без adapter → падает unsupported
   entity unit.
7. Выполнить захваченную до confirmation команду после смены target set →
   падает confirmation race smoke.

## 18. Документация

Обновить при реализации:

- `docs/USER-GUIDE.ru.md` и английскую пользовательскую документацию;
- `docs/ARCHITECTURE.md` — единый device action resolver;
- `docs/FILTERING.md` — что считается functional action entity;
- `docs/TESTING.md`;
- config examples;
- RU/EN changelog beta.

Старые тексты о `TOGGLE_SAFE_DOMAINS`, отдельном `tap_action: cover` и
безусловном `_actEntity = primary` должны быть удалены или помечены legacy.

## 19. Критерии приёмки

1. Вариант называется «Переключить состояние» и виден для любого marker.
2. Выбранный toggle сохраняется даже без исполняемой команды.
3. Под select всегда есть точный target/semantics hint или точная no-op причина.
4. Hint, confirmation, click и cover indication используют один resolver.
5. Explicit toggle никогда не открывает info-card/more-info как fallback.
6. Virtual без controls — полный no-op; virtual с controls и explicit toggle
   управляет ими.
7. Настроенные controls не дают общего fallback на собственную entity;
   документированная passive-marker driver semantics остаётся рабочей.
8. Cover/valve переключаются корректно, движение останавливается при support.
9. Отдельного cover action в UI нет.
10. Legacy `tap_action: cover` читается/импортируется и работает без регрессии.
11. Confirmation сохраняет текущее поведение и config field.
12. Passive и unavailable targets не получают ошибочный service call.
13. Secure contract реализует принятое решение: lock, alarm и secure cover
    classes всегда дают no-op без confirmation и service call.
14. RU/EN, a11y, touch-view и no-horizontal-scroll требования выполнены.
15. Backend validation и import/export round-trip зелёные.
16. Untouched legacy cover сохраняет token, старую цель и приоритет даже после
    Open → Save; явное изменение action переводит его на новый контракт.
17. Default-light не отдаёт tap внешним controls без explicit toggle.
18. Частично доступная группа вызывает service только для подмножества,
    показанного в hint; skipped targets видны с причиной.
19. Exact entity binding никогда не retarget-ится на sibling, а появление
    domain service без adapter не делает entity переключаемой.
20. Confirmation повторно разрешает intent: изменение state пересчитывает
    команду, изменение target set отменяет действие.
21. Реализация проходит beta до stable по promotion rule.

## 20. Сложность, риски и оценка

### 20.1. Сложность

**Средняя, ближе к высокой.** Переименование и hint дёшевы; основная работа —
сделать один resolver вместо нескольких несовпадающих решений.

| Блок | Оценка |
|---|---:|
| Pure resolver, adapters, legacy origin/projection | 1,25–2 дня |
| Dialog hint, i18n, a11y | 0,5–1 день |
| Click/confirmation/presentation integration | 0,5–1 день |
| Backend/import-export compatibility | 0,25–0,5 дня |
| Unit/browser/mutation/docs/beta hardening | 1–1,5 дня |
| **Итого** | **3,5–6 рабочих дней, одна beta-итерация** |

### 20.2. Риски

| Риск | Вероятность / ущерб | Снижение |
|---|---|---|
| Не та entity у composite device | средняя / высокий | shared role resolver + visible entity id |
| Stale controls неожиданно переключат controller | высокая / высокий | no fallback after explicit intent |
| Регрессия штор при удалении cover option | средняя / высокий | internal cover adapter + legacy matrix |
| Случайное unlock/disarm/open gate | низкая / критический | secure no-op contract |
| Domain публикует service, но entity его не поддерживает | средняя / средний | domain adapter + call error handling + fixtures |
| Legacy cover ломает config write или меняет цель при Open → Save | средняя / высокий | origin + touched gate + lossless round-trip |
| Hint и клик расходятся после live update | средняя / высокий | один resolver; re-resolve at click |
| Слишком длинный hint | высокая / низкий | wrap/detail, no horizontal scroll |
| Scope разрастается в target picker | средняя / средний | entity binding как точный escape hatch |

## 21. Принятые продуктовые решения

Рекомендуется принять без дополнительных расширений:

1. Один universal UI action, но domain-aware execution.
2. No target — сохранённый no-op, никогда не info fallback.
3. External controls — явное намерение explicit toggle без общего fallback;
   passive-marker driver остаётся специальным существующим контрактом.
4. Device target выбирается shared functional-role resolver.
5. Legacy cover остаётся compatibility token и сохраняет старое runtime-
   поведение до явного изменения action пользователем.
6. Cover/valve stop-on-movement сохраняется внутри общего adapter.
7. Target picker не входит в первую версию.

8. Для lock, alarm и cover classes `garage`/`door`/`gate` принят secure no-op:
   action виден и сохраняется, hint объясняет блокировку, service call и
   confirmation по нажатию не выполняются.

Блокирующих продуктовых вопросов перед реализацией нет.
