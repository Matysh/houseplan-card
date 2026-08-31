# Исследование и ТЗ #54 — диагностический слой Zigbee-топологии

- Issue: https://github.com/Matysh/houseplan-card/issues/54
- Приоритет: P3
- Статус: **Stage 0 research завершён; реализация не начиналась**
- Решение Stage 0: **GO с условиями и поэтапным вводом провайдеров**
- Дата проверки контрактов: 2026-08-31

Проверенные upstream-состояния:

| Компонент | Проверено |
|---|---|
| Home Assistant Core | `2026.8.3` и `dev@6ad726ba56d517e56536cdd6fa2ba9f358bbc0ef` |
| Home Assistant Frontend | `dev@6b7d3871754dada4d599e4fecc0d5ca0442cf22b` |
| Zigbee2MQTT | `2.13.0` и `master@fcbb7ff44bdc05a16e95d3472a81d110646cc17b` |
| House Plan | `dev@6bf39ee9a7ecbc62dcc8b999af3c23b6d877c5a0` |

## 1. Сценарий и продуктовая рамка

Персона — Enthusiast/Power User, поверхность — полная карточка House Plan в
режиме View, момент — диагностика нестабильного Zigbee-устройства. Пользователь
включает временный слой и видит наблюдаемые Zigbee-связи поверх реального плана,
не переходя в редактор и не изменяя сеть.

До: House Plan показывает LQI устройства и комнаты, но не отвечает, через какой
router идёт наблюдаемая связь и где он находится относительно стен.

После: для размещённых устройств текущего пространства видны наблюдаемые связи и
их LQI; связи в другие пространства представлены честной навигационной ссылкой,
а не геометрически ложной линией между независимыми планами.

Функция служит J7 из `docs/SCOPE.md`. Это read-only диагностика, не network
manager: pairing, reconfigure, bind/unbind, удаление устройств и изменение
маршрутов не входят в scope.

## 2. Краткий вердикт Stage 0

| Часть | Вердикт | Основание и ограничение |
|---|---|---|
| Общая модель и пространственный слой | **GO** | Текущий House Plan уже имеет полный registry snapshot, exact bindings, позиции и пространство каждого live marker. Слой можно загружать лениво и держать pointer-transparent. |
| ZHA: чтение snapshot | **GO, высокая уверенность** | Admin-only `zha/devices` возвращает `device_reg_id`, IEEE, роль, `neighbors`, `routes` и LQI. Это тот же источник, который использует штатная ZHA visualization. |
| ZHA: принудительный свежий scan | **условный GO** | `zha/topology/update` существует и admin-only, но в проверенной реализации только запускает background scan и не отправляет result/completion. Нельзя честно показать завершение или определить неизменившийся результат. |
| Zigbee2MQTT: свежий scan | **GO с настройкой** | Документированный MQTT request/response возвращает raw nodes/links. Нужен явно заданный base topic для каждой Z2M-инстанции; надёжно вывести его из HA registry нельзя. |
| Одинаковая семантика данных | **GO с нормализацией** | Оба провайдера дают наблюдаемые directional neighbor records, но completeness, route flags и freshness различаются. Нельзя выдавать их за гарантированный фактический маршрут каждого пакета. |
| Связи между этажами | **GO без межплановой линии** | Пространства имеют независимые viewBox/камеры. Нужны endpoint indicator, список связей и переход к удалённому marker. |

Итог: задачу реализовать можно. Нельзя обещать полную паритетность двух
провайдеров или «живую карту маршрутов». Выпускать следует provider capability,
а не включать хрупкий общий режим при частично доступном источнике.

## 3. Подтверждённые provider-контракты

### 3.1 ZHA

Источник:

- Home Assistant Core:
  `homeassistant/components/zha/websocket_api.py`;
- Home Assistant Frontend: `src/data/zha.ts` и
  `zha-network-data.ts` штатной network visualization;
- zigpy: `zigpy/topology.py` и `zigpy/application.py`.

Подтверждено:

1. `zha/devices` требует admin и отдаёт массив устройств. У каждого устройства
   есть `ieee`, `device_reg_id`, `device_type`, `neighbors`, `routes`; neighbor
   несёт `ieee`, `nwk`, `relationship` и `lqi`.
2. `device_reg_id` даёт прямое соответствие HA Device Registry без эвристики по
   имени или entity id.
3. Штатный HA frontend строит граф именно из этих `neighbors`/`routes`, хранит
   два directional LQI для пары при наличии двух записей и использует route
   только вместе с реальным neighbor next hop.
4. zigpy по умолчанию включает периодический topology scan с периодом четыре
   часа. Поэтому `zha/devices` обычно является дешёвым чтением кеша, а не новым
   radio scan. Данные могут быть неполными и старыми.
5. `zha/topology/update` также требует admin, но на проверенных `2026.8.3` и
   текущем `dev` запускает `topology.scan()` через background task и не отправляет
   WebSocket result. Клиент не получает completion и timestamp результата.

Следствие для реализации:

- безопасный первый ZHA capability — **прочитать кешированный snapshot**;
- кнопка «Пересканировать сеть» не должна использовать fire-and-forget как будто
  это завершённый request;
- свежий scan допускается после появления completion-aware upstream API либо в
  отдельном изолированном compatibility adapter, который await-ит ZHA topology
  scan и fail-closed при несовместимой версии. Этот вариант повышает стоимость
  поддержки и не является условием первого ZHA этапа;
- UI должен писать «Данные ZHA прочитаны …», а не утверждать неизвестное время
  фактического сканирования.

### 3.2 Zigbee2MQTT

Источник:

- документация MQTT API:
  `BASE/bridge/request/networkmap` → `BASE/bridge/response/networkmap`;
- `lib/extension/networkMap.ts` и `lib/types/api.ts` Zigbee2MQTT.

Подтверждено:

1. Request `{"type":"raw","routes":false,"transaction":"…"}` возвращает
   raw `nodes[]` и `links[]`; `transaction` позволяет сопоставить конкурентные
   request/response.
2. Node содержит IEEE, friendly name, роль и scan failures. Link содержит
   `source`, `target`, directional `lqi`, relationship и необязательные routes.
3. Scan опрашивает coordinator и routers, делает паузу между устройствами и
   retry после ошибки. Документация предупреждает о снижении отзывчивости сети
   и длительности от 10 секунд до 2 минут; запускать его разрешено только явно.
4. `routes:false` достаточен для spatial links и уменьшает нагрузку: route table
   не нужна, чтобы показать наблюдаемый neighbor edge.
5. Disabled в конфигурации Z2M и Green Power устройства исключаются самим
   provider; отдельные router failures приходят в snapshot и не должны ломать
   весь граф.
6. HA MQTT предоставляет admin-only WebSocket subscription `mqtt/subscribe`, а
   `mqtt.publish` является штатным action. Adapter может работать через HA,
   не подключая браузер напрямую к broker.

Base topic:

- default равен `zigbee2mqtt`, но он конфигурируемый и может содержать `/`;
- HA Device/Entity Registry не содержит надёжного исходного base topic;
- wildcard-поиск по всему broker недопустим из-за privacy, нагрузки и риска
  прочитать чужие topics;
- поэтому для Z2M нужен список provider instances с явным `baseTopic`.
  Начальное значение `zigbee2mqtt` проверяется чтением retained `bridge/info`;
  несколько инстансов задаются отдельно.

### 3.3 Соответствие Z2M node → HA device

Zigbee2MQTT по умолчанию публикует HA device identifiers:

- обычное устройство: `zigbee2mqtt_<ieee>`;
- bridge/coordinator: `zigbee2mqtt_bridge_<ieee>`.

Adapter нормализует IEEE и ищет exact identifier в полном HA Device Registry.
Допустимые fallback идут только через exact Entity Registry owner того же HA
device. Friendly name, entity name и model не используются для автоматического
matching. User-overridden discovery identifiers могут оставить node unmatched;
это диагностируется, но не исправляется догадкой.

## 4. Нормализованная модель

Provider-specific payload не проходит в render.

```ts
type ZigbeeProvider = 'zha' | 'z2m';

type ZigbeeTopologyWarning = {
  code:
    | 'invalid_payload'
    | 'duplicate_link'
    | 'self_link'
    | 'unmatched_device'
    | 'ambiguous_placement'
    | 'provider_scan_failure';
  nodeKey?: string;
  detail?: string;
};

type ZigbeeTopology = {
  provider: ZigbeeProvider;
  instanceId: string;
  obtainedAt: number;
  freshness: 'provider-cache' | 'fresh-scan';
  nodes: ZigbeeTopologyNode[];
  links: ZigbeeTopologyLink[];
  warnings: ZigbeeTopologyWarning[];
};

type ZigbeeTopologyNode = {
  key: string;                 // provider instance + normalized IEEE
  ieee: string;                // never shown/logged by default
  deviceId?: string;           // exact HA Device Registry id
  role: 'coordinator' | 'router' | 'end' | 'unknown';
  available?: boolean;
  providerFailures?: string[];
};

type ZigbeeDirectionalObservation = {
  lqi?: number;                // provider-native 0..255
  relationship?: string;
  activeRoute?: boolean;
};

type ZigbeeTopologyLink = {
  a: string;
  b: string;
  aToB?: ZigbeeDirectionalObservation;
  bToA?: ZigbeeDirectionalObservation;
};
```

Правила нормализации:

- одинаковая unordered pair хранится один раз, две стороны не усредняются;
- один directional record не превращается в bidirectional;
- route destination не создаёт прямую линию: route только помечает реальный
  neighbor next-hop;
- неизвестный/некорректный LQI остаётся `undefined`, а не `0`;
- duplicate и self links отбрасываются с warning;
- payload ограничивается по числу nodes/links и размеру до разбора.

## 5. Mapping на House Plan marker

Для node сначала определяется exact HA `deviceId`, затем кандидаты среди live
House Plan markers этого HA device:

1. единственный видимый marker с binding `device:<deviceId>`;
2. если его нет — единственный видимый entity marker, чья entity принадлежит
   этому device;
3. несколько равноправных markers — `ambiguous_placement`, node не рисуется;
4. hidden, removed и HA-disabled markers не являются drawable endpoints;
5. rebind/перемещение/смена пространства пересчитывают mapping по существующему
   snapshot без нового Zigbee scan.

Так исключается линия к случайной сущности составного устройства. Unmatched,
ambiguous и hidden nodes входят в summary с раздельными причинами.

Coordinator часто не размещён на плане. Это не повод создавать автоматический
marker или фиктивную координату: его связи остаются в summary, пока пользователь
не разместит соответствующий HA device существующим workflow.

## 6. Связи между пространствами и этажами

### 6.1 Почему нельзя рисовать одну линию

Каждое пространство House Plan имеет собственные viewBox, камеру, масштаб и
проекцию. Координаты `(x, y)` первого этажа не имеют геометрического отношения к
таким же координатам второго. Линия до координаты remote marker на текущем SVG
создала бы вымышленное направление и длину.

Кроме того, порядок вкладок не является физической высотой: пространство может
быть двором, гаражом или отдельным строением. Поэтому стрелки «вверх/вниз» по
порядку вкладок запрещены.

### 6.2 Контракт cross-space edge

Если оба drawable endpoint находятся в текущем пространстве, рисуется обычная
линия.

Если локальный endpoint находится в текущем пространстве, а второй — в другом:

- линия на плане не рисуется;
- возле локального endpoint появляется компактный topology port/badge с общим
  количеством cross-space links;
- click/tap открывает panel, сгруппированный по **названию пространства**;
- строка показывает remote device, provider, directional LQI и роль, не выдавая
  наблюдение за гарантированный текущий маршрут;
- действие «Показать» переключает полную карточку на destination space,
  центрирует и кратко подсвечивает remote marker; topology layer остаётся
  включённым и использует тот же snapshot;
- после перехода прежний endpoint становится remote и получает симметричное
  представление.

Topology port — UI overlay, а не часть plan geometry: он не меняет bounding box,
fit/zoom, layout и export. На touch это полноценный tap target не менее 44 CSS px;
hover не является единственным способом открыть список.

### 6.3 Пограничные случаи

- Remote marker hidden/removed/HA-disabled/unmatched: link попадает в summary
  «не показано» с причиной, но не в cross-space badge.
- Fixed `floor` full card: список виден, но переход в недоступное пространство
  отсутствует. Нельзя обходить fixed-floor контракт.
- `houseplan-space-card`: topology не показывается — карточка статична и
  pointerless по действующему контракту.
- Kiosk: topology toggle и диагностическая panel не экспонируются; случайно
  сохранённое UI-состояние не включает слой в kiosk.
- Несколько House Plan cards используют shared snapshot, но не рисуют линии
  между DOM экземплярами.
- Изометрическая проекция использует уже спроецированную локальную координату
  marker; cross-space port остаётся screen overlay и не получает fake Z.

## 7. Fetch, кеш и permissions

- Feature доступна только HA admin. Нельзя проксировать ZHA/MQTT через House Plan
  backend так, чтобы расширить штатные права non-admin.
- Overlay выключен по умолчанию и не сохраняется в plan config/localStorage.
- Показ уже полученного snapshot не вызывает network scan.
- «Показать слой» и «Пересканировать сеть» — разные действия. Z2M scan запускает
  только явная кнопка с предупреждением «10 секунд — 2 минуты; сеть может отвечать
  медленнее».
- Shared cache: per HA connection + provider + instance, memory-only, in-flight
  dedupe. Snapshot живёт до reload/remount connection; после 5 минут помечается
  stale, но не обновляется автоматически.
- Toggle off прекращает progress UI, но не пытается отменить уже начатый radio
  scan. Adapter сохраняет успешный ответ в memory cache и гарантированно снимает
  MQTT subscription.
- Z2M timeout — 150 секунд после publish; transaction обязателен. Late response
  игнорируется. Retained response до request с другим transaction игнорируется.
- Ни HA state tick, ни space switch, ни hover, ни remount второй карточки не
  запускают scan.
- IEEE и raw topology не пишутся в plan config, diagnostics по умолчанию или
  console. Из provider-данных в config допустим только явно заданный
  `baseTopic`, потому что это connection setting, а не topology snapshot.

## 8. Визуальная семантика

- Edges — отдельный pointer-transparent lazy layer под devices и над планом.
- Толщина/opacity показывают LQI. Цветовая шкала должна переиспользовать
  канонический House Plan LQI resolver, но не усреднять две стороны.
- При двух directional observations tooltip/list показывает обе: `A→B` и
  `B→A`. При одной — только подтверждённую сторону.
- Arrow допускается только для подтверждённой directional observation. Направление
  Zigbee никогда не смешивается с направлением «на другой этаж».
- Unknown LQI — нейтральный пунктир. Provider failures — warning в panel, не
  красная линия «плохой связи».
- Стены не окрашиваются и не объявляются причиной слабого сигнала: overlay
  показывает корреляцию в пространстве, не RF-симуляцию.

## 9. Ограничения достоверности

- Neighbor tables — наблюдаемый snapshot, а не лог всех текущих packet routes.
- Спящие end devices могут отсутствовать или иметь устаревшую связь.
- Pair может быть видна только с одной стороны; это нормальный результат.
- Coordinator/router failures могут оставить частичный связный граф.
- LQI 0..255 сопоставим по диапазону, но два provider не гарантируют одинаковую
  методику и время измерения. Межпровайдерные рейтинги качества не строятся.
- Нельзя выводить причинный текст «стена ухудшает сигнал».

## 10. Рекомендуемая последовательность реализации

### Этап A — provider-neutral foundation

- normalized model, validation/limits, exact registry matching;
- same-space edge projection и cross-space panel/navigation;
- обезличенные ZHA/Z2M fixtures;
- memory cache, capability/error states, lazy bundle boundary.

### Этап B — ZHA cached adapter

- admin-only `zha/devices`;
- cached topology без принудительного scan;
- явная маркировка provider-cache и отсутствия точного capture timestamp.

### Этап C — Zigbee2MQTT adapter

- настройки одной/нескольких provider instances (`baseTopic`);
- проверка `bridge/info`;
- HA MQTT subscribe + publish, raw networkmap с `routes:false`, transaction,
  timeout/cleanup.

### Этап D — ZHA on-demand scan отдельно

Только после одного из условий:

1. upstream `zha/topology/update` даёт completion-aware result/event; или
2. отдельный compatibility adapter доказан на поддерживаемой HA matrix и имеет
   fail-closed capability probe.

Этап D не блокирует полезный cached ZHA overlay и не должен задерживать Z2M.

## 11. Проверки будущей реализации

- unit: ZHA/Z2M normalization, directional pair merge, invalid/self/duplicate,
  payload limits, provider failures;
- unit: IEEE → HA registry → exact marker, coordinator special identifier,
  entity-owner fallback, ambiguous/hidden/removed/disabled;
- unit: same-space/cross-space/unplaced classification, fixed floor, no tab-order
  up/down semantics;
- backend или adapter contract: admin-only, unsupported provider, MQTT absent,
  wrong base topic, transaction mismatch, retained/late response, timeout,
  subscription cleanup;
- smoke desktop + touch View: toggle, progress, cross-space list, transition and
  focus remote marker; topology controls absent in kiosk/static card;
- golden: same-space lines, one-way/two-way/unknown, cross-space badge/panel,
  partial graph warning;
- performance: 20/100/500 nodes, dense malformed graph, edge cap and no work on
  ordinary HA state ticks;
- privacy: topology and IEEE do not enter exported config, diagnostics or logs.

## 12. Риски, откат и non-scope

Главные риски: нестабильный ZHA refresh contract, дорогой Z2M scan, неправильный
base topic, неоднозначное размещение составного device, перегруженный dense graph
и ложное восприятие snapshot как реального маршрута.

Откат каждого provider независим: capability отключается, общий план и LQI
продолжают работать. Поскольку snapshot не сохраняется, миграция и cleanup
пользовательских данных не нужны. Настройка Z2M base topic игнорируется при
отключённом adapter и может быть удалена без изменения плана.

Не входят в #54: изменение Zigbee-сети, автоматическое создание markers,
RF-прогноз по стенам, history, background auto-scan, cross-building 3D-линия,
support non-admin, topology в kiosk и `houseplan-space-card`.

## 13. Решения, принятые технически и доступные для пересмотра на ревью

- Default Z2M base topic — `zigbee2mqtt`, но scan невозможен до успешной проверки
  instance.
- Provider cache stale после 5 минут; это только label, не auto-refresh trigger.
- Z2M hard timeout 150 секунд.
- `routes:false` в первом Z2M этапе.
- Multiple markers одного HA device считаются ambiguous, если нет единственного
  exact device binding.
- Cross-space detail — panel/list с переходом, без межплановой линии и без
  «вверх/вниз» по порядку вкладок.

## 14. Источники Stage 0

- Home Assistant Core ZHA WebSocket API:
  https://github.com/home-assistant/core/blob/dev/homeassistant/components/zha/websocket_api.py
- Home Assistant Frontend ZHA data contract:
  https://github.com/home-assistant/frontend/blob/dev/src/data/zha.ts
- Home Assistant Frontend graph normalization:
  https://github.com/home-assistant/frontend/blob/dev/src/panels/config/integrations/integration-panels/zha/zha-network-data.ts
- zigpy topology scanner:
  https://github.com/zigpy/zigpy/blob/dev/zigpy/topology.py
- Home Assistant MQTT WebSocket subscription:
  https://github.com/home-assistant/core/blob/dev/homeassistant/components/mqtt/__init__.py
- Home Assistant `mqtt.publish` action:
  https://www.home-assistant.io/actions/mqtt.publish/
- Zigbee2MQTT networkmap API:
  https://www.zigbee2mqtt.io/guide/usage/mqtt_topics_and_messages.html#zigbee2mqttbridgerequestnetworkmap
- Zigbee2MQTT networkmap implementation/model:
  https://github.com/Koenkk/zigbee2mqtt/blob/master/lib/extension/networkMap.ts
  and https://github.com/Koenkk/zigbee2mqtt/blob/master/lib/types/api.ts
