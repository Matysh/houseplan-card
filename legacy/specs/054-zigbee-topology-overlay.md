# ТЗ #54 — контекстные связи Zigbee на плане

- Issue: https://github.com/Matysh/houseplan-card/issues/54
- Приоритет: P3
- Тип: feature
- Трек: полный — новый UX-контракт, провайдеры, настройки, privacy и performance
- Stage 0: capability research завершён, решение **GO с условиями**
- Контракты проверены: 2026-08-31
- UX скорректирован решением владельца: 2026-09-04

## 1. Сценарий

Персона — Home admin (HA enthusiast) из `docs/SCOPE.md`. Поверхность — полная
карточка House Plan в режиме View на устройстве с мышью. Момент — пользователь
ищет пространственную причину нестабильной работы конкретного Zigbee-устройства
и хочет увидеть его наблюдаемых соседей относительно комнат и стен, не переходя
в отдельный сетевой граф.

## 2. Что человек увидит до и после

До: House Plan показывает LQI устройства и комнаты, но не показывает, с какими
Zigbee-узлами связано выбранное устройство и где они находятся на плане.

После: если пользователь заранее включил диагностику в общих настройках и навёл
мышь на размещённое Zigbee-устройство, House Plan временно показывает только его
непосредственные связи; без наведения план выглядит как раньше.

## 3. Проблема

Полный mesh-граф поверх жилого плана быстро превращается в нечитаемую паутину:
число линий растёт вместе с сетью, связи закрывают геометрию и устройства, а
пользователь всё равно диагностирует один проблемный endpoint за раз. При этом
ZHA и Zigbee2MQTT дают разные по свежести и стоимости snapshots, а их neighbor
records нельзя честно называть фактическим маршрутом каждого пакета.

Нужен opt-in диагностический слой с progressive disclosure: сеть не видна в
обычном состоянии, а непосредственное окружение одного устройства появляется
только на время hover.

## 4. Scope и non-scope

### 4.1 Входит в #54

- одна выключенная по умолчанию опция в «Общих настройках»;
- provider-neutral topology model и точное сопоставление узлов с размещёнными
  маркерами;
- ZHA cached snapshot через штатный admin-only WebSocket API;
- Zigbee2MQTT raw network map через штатные HA MQTT surfaces и явно заданные
  base topics;
- ручное получение/обновление provider data из «Общих настроек»;
- только непосредственные связи наведённого устройства;
- локальные линии внутри текущего пространства и временный счётчик связей в
  другие пространства;
- состояния загрузки, устаревшего snapshot, partial data, unsupported и error;
- lazy loading, общий memory cache, privacy guards, i18n, unit/backend/browser,
  golden и performance coverage.

### 4.2 Не входит в #54

- постоянный слой или кнопка «показать весь граф»;
- вычисление либо изображение «маршрута до координатора»;
- tap, long press или другой topology-жест на touch/pen;
- интерактивная панель cross-space links и переход к удалённому marker;
- линии между независимыми пространствами, этажами или экземплярами карточки;
- принудительный ZHA radio scan без completion-aware upstream API;
- background/periodic scan, scan по hover, HA state tick, смене пространства или
  созданию второй карточки;
- pairing, reconfigure, bind/unbind, удаление устройств и изменение сети;
- автоматическое создание маркеров, matching по имени/model/friendly name;
- RF-прогноз по стенам, причинные утверждения, history и графики;
- topology в kiosk, редакторах и `houseplan-space-card`;
- доступ non-admin в обход штатных прав Home Assistant.

## 5. Контракт поведения

### 5.1 Общая настройка

В «Общих настройках» появляется переключатель
«Показывать связи Zigbee при наведении на устройство».

- missing/invalid/`false` означает выключено;
- значение сохраняется вместе с общими настройками и действует для всех
  пространств полной карточки;
- выключенное состояние не загружает topology runtime, не вызывает provider API
  и не строит topology/mapping;
- включение разрешает отображение, но само по себе не запускает radio scan;
- выключение немедленно убирает hover-слой. Уже начатый явный Z2M scan не
  прерывается небезопасным unsubscribe: ответ может завершить shared cache, но
  UI остаётся скрыт;
- non-admin не видит активный control и не инициирует provider requests, даже
  если настройку ранее сохранил admin.

### 5.2 Получение данных

Под переключателем, только в раскрытом включённом состоянии, показываются
provider controls и статус последнего snapshot.

- ZHA: действие «Прочитать данные ZHA» читает cached `zha/devices`. Оно не
  обещает свежий radio scan и не показывает фиктивный момент сканирования;
- Zigbee2MQTT: для каждой настроенной instance задаётся base topic и доступно
  действие «Обновить карту Zigbee2MQTT»;
- перед Z2M scan показывается предупреждение: операция занимает от 10 секунд до
  2 минут и временно может снизить отзывчивость сети;
- provider actions явные и независимые. Ошибка одного provider не скрывает
  пригодный snapshot другого;
- статус сообщает provider, время получения House Plan, stale/partial и
  человекопонятную ошибку. IEEE, raw payload и внутренние identifiers не
  показываются;
- snapshot старше пяти минут помечается устаревшим, но не обновляется сам.

### 5.3 Hover одного устройства

Связи разрешены только если одновременно выполняются условия:

1. настройка включена;
2. текущая поверхность — View полной карточки, не kiosk;
3. последняя pointer modality — реальная мышь с fine/hover capability;
4. существует пригодный snapshot;
5. курсор находится над drawable live marker, точно сопоставленным Zigbee node.

Тогда House Plan берёт только incident links выбранного node — пары, в которых
этот node является одним из концов. Весь остальной граф не строится и не
рисуется. Это наблюдаемые непосредственные соседи, а не вычисленный путь до
координатора.

Если второй endpoint точно сопоставлен видимому marker текущего пространства,
рисуется одна связь между маркерами, а marker-сосед получает лёгкое временное
выделение. Если второй endpoint находится в другом пространстве, линия не
рисуется; рядом с исходным marker появляется компактный неинтерактивный счётчик
«ещё N в других пространствах». Unmatched, ambiguous, hidden, removed и
HA-disabled endpoints не рисуются и в cross-space count не входят.

Hover-слой очищается при pointerleave marker, переходе на touch/pen, смене
пространства или режима, remount/disconnect и выключении настройки. Он не
остаётся закреплённым после клика. Existing click, long-press, hover tooltip,
device action и dispatched-action animation не меняются.

### 5.4 Touch, keyboard и другие режимы

- Touch/pen topology не показывают и не получают нового жеста. Tap и long press
  продолжают действовать по существующему контракту устройства.
- Keyboard focus не имитирует mouse hover и не вводит новую навигацию по плану;
  это соответствует текущей accessibility-границе `docs/SCOPE.md`.
- Plan, Devices и Decor не показывают линии, соседнее выделение или cross-space
  count независимо от сохранённой настройки.
- Kiosk и `houseplan-space-card` не загружают runtime и не делают запросы.
- Несколько полных карточек могут переиспользовать один snapshot, но каждая
  самостоятельно владеет своим mouse-hover состоянием.

## 6. UX и визуальная семантика

> **Заменено #464:** первоначальный контракт ниже оставлен как исторический
> контекст. Актуальный порядок слоёв и оформление unknown-LQI пунктира задаёт
> [ТЗ #464](464-zigbee-topology-layer-order.md): активная топология находится
> над названиями комнат и посторонними маркерами, но под полными маркерами
> устройств — концов реально показанных локальных связей.

- В обычном View при включённой функции нет постоянной легенды, badges или
  линий. Визуальный шум равен выключенному состоянию.
- Связи находятся в отдельном pointer-transparent layer: над архитектурой и
  decor, но под device markers и их tooltips.
- Линия соединяет фактические центры двух уже спроецированных маркеров, не
  участвует в fit/bounds и не меняет геометрию плана.
- Цвет использует каноническую непрерывную шкалу House Plan LQI. Unknown LQI —
  нейтральный пунктир. Provider error никогда не изображается как «плохая»
  красная связь.
- Для двух directional observations визуал линии использует наблюдение от
  наведённого node к соседу; обратное значение не усредняется и остаётся в
  нормализованной модели для диагностики/тестов.
- Толщина/opacity допускают ограниченное усиление по LQI, но сохраняются в
  читаемом screen-space диапазоне при любом zoom.
- Coordinator/router/end не получают постоянных новых обозначений. Во время
  hover сосед может получить один нейтральный halo, не похожий на alert,
  selection или dispatched-action animation.
- Cross-space count живёт только пока активен тот же hover, имеет
  `pointer-events:none`, не становится частью hit area и не предлагает tap.
- При отсутствии incident links или drawable соседей план не показывает
  ложную линию или toast. Причина и summary доступны в provider status общих
  настроек.

## 7. Подтверждённые provider-контракты Stage 0

### 7.1 ZHA

Проверены Home Assistant Core `2026.8.3` и
`dev@6ad726ba56d517e56536cdd6fa2ba9f358bbc0ef`, Home Assistant Frontend
`dev@6b7d3871754dada4d599e4fecc0d5ca0442cf22b`, а также zigpy topology.

1. Admin-only `zha/devices` возвращает `device_reg_id`, IEEE, роль,
   `neighbors`, `routes` и directional LQI.
2. `device_reg_id` даёт exact HA Device Registry mapping.
3. Штатный HA frontend строит граф из `neighbors`/`routes`, сохраняет два
   directional LQI пары и использует route только вместе с реальным neighbor
   next hop.
4. zigpy обычно сканирует topology раз в четыре часа. `zha/devices` читает
   кешированный snapshot, который может быть старым или неполным.
5. `zha/topology/update` в проверенном контракте запускает background scan, но
   не возвращает completion/result. Поэтому #54 его не вызывает.

### 7.2 Zigbee2MQTT

Проверены Zigbee2MQTT `2.13.0` и
`master@fcbb7ff44bdc05a16e95d3472a81d110646cc17b`.

1. Документированный request
   `BASE/bridge/request/networkmap` с
   `{"type":"raw","routes":false,"transaction":"…"}` отвечает на
   `BASE/bridge/response/networkmap` и возвращает nodes/links.
2. Node содержит IEEE, friendly name, роль и scan failures. Link содержит
   source, target, directional LQI и relationship.
3. Scan занимает 10 секунд — 2 минуты и может временно снизить отзывчивость
   Zigbee-сети; только явное действие пользователя вправе его запускать.
4. `routes:false` достаточно для непосредственных neighbor edges и уменьшает
   нагрузку.
5. HA MQTT предоставляет admin-only WebSocket subscription, а `mqtt.publish` —
   штатное HA action. Браузер не подключается к broker напрямую.
6. Base topic конфигурируем и не выводится надёжно из HA registry. Для каждой
   instance пользователь задаёт его явно; default `zigbee2mqtt` проверяется по
   retained `bridge/info` до scan.

## 8. Модель данных и миграция

### 8.1 Сохраняемая настройка

Концептуальная форма общих настроек:

```ts
type ZigbeeTopologySettings = {
  enabled?: boolean;             // missing/invalid => false
  z2mBaseTopics?: string[];      // normalized exact base topics
};
```

Точное внутреннее имя поля вправе изменить реализация без изменения UX.
Настройка принадлежит плану целиком, а не пространству. Повторное сохранение
несвязанных общих настроек не удаляет её. Дубликаты/пустые/невалидные base topic
нормализуются fail-closed.

Миграции существующих планов нет: отсутствие объекта означает выключенную
функцию. Downgrade игнорирует неизвестное поле. Выключение функции не удаляет
base topics, чтобы повторное включение не требовало настройки заново.

### 8.2 Runtime model

Provider payload не проходит в render:

```ts
type ZigbeeProvider = 'zha' | 'z2m';

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
  key: string;                   // provider instance + normalized IEEE
  ieee: string;                  // private runtime value
  deviceId?: string;
  role: 'coordinator' | 'router' | 'end' | 'unknown';
  available?: boolean;
};

type ZigbeeDirectionalObservation = {
  lqi?: number;                  // provider-native 0..255
  relationship?: string;
  activeRoute?: boolean;
};

type ZigbeeTopologyLink = {
  a: string;
  b: string;
  aToB?: ZigbeeDirectionalObservation;
  bToA?: ZigbeeDirectionalObservation;
};

type ZigbeeTopologyWarning = {
  code:
    | 'invalid_payload'
    | 'duplicate_link'
    | 'self_link'
    | 'unmatched_device'
    | 'ambiguous_placement'
    | 'provider_scan_failure';
  nodeKey?: string;
};
```

Snapshot остаётся memory-only и не входит в экспорт, backup, diagnostics,
support report, localStorage или console. Shared cache key включает HA connection,
provider и instance; concurrent requests дедуплицируются.

## 9. Нормализация и mapping

- IEEE нормализуется до одного canonical representation; raw/friendly name не
  используется как identity.
- Одинаковая unordered pair хранится один раз; directional observations не
  усредняются и не выдумываются из отсутствующей стороны.
- Self links и exact duplicates отбрасываются с warning.
- Route destination не создаёт прямую линию: route может только пометить
  существующий neighbor next hop.
- Некорректный/неизвестный LQI становится `undefined`, а не `0`.
- Payload ограничивается по bytes, nodes и links до дорогостоящей обработки.

Для каждого node сначала определяется exact HA `deviceId`, затем marker:

1. единственный видимый live marker с binding `device:<deviceId>`;
2. если его нет — единственный видимый entity marker, чья entity принадлежит
   тому же HA device;
3. несколько равноправных markers дают `ambiguous_placement` и не рисуются;
4. hidden, removed и HA-disabled markers не являются drawable endpoints;
5. rebind, перемещение и смена пространства пересчитывают mapping по тому же
   snapshot без provider request.

Для Z2M обычный identifier `zigbee2mqtt_<ieee>`, а bridge/coordinator —
`zigbee2mqtt_bridge_<ieee>`. Exact Entity Registry owner допускается как
fallback. User-overridden identifiers могут оставить node unmatched; matching
по friendly name, entity name или model запрещён.

## 10. Fetch, cache, lifecycle и permissions

- Runtime загружается динамически только после сохранённого `enabled:true` на
  доступной admin View/full-card поверхности.
- Provider data загружается только явными controls в общих настройках; hover
  никогда не вызывает fetch или scan.
- Shared cache — per HA connection + provider + instance, memory-only, с
  in-flight dedupe. Snapshot старше пяти минут stale, но пригоден до явного
  обновления или конца connection lifecycle.
- Z2M transaction обязателен; timeout — 150 секунд. Retained ответ до request,
  ответ с чужой transaction и late response игнорируются; subscription всегда
  очищается после success/error/timeout.
- Hide/disable, изменение binding, удаление marker, смена режима/пространства и
  disconnect синхронно инвалидируют draw mapping/hover, но не запускают scan.
- Provider/API failure не ломает план, device actions, LQI badges/fill и
  остальные режимы.
- Если HA отказывает в admin API, adapter fail-closed и не пытается обойти права
  через backend House Plan.

## 11. Ограничения достоверности

- Neighbor tables — наблюдаемый snapshot, а не лог текущих packet routes.
- Спящие end devices могут отсутствовать или иметь устаревшую связь.
- Пара может наблюдаться только с одной стороны; это нормальный результат.
- Coordinator/router failures могут оставить частичный граф.
- Диапазон LQI 0..255 общий, но providers не гарантируют одинаковую методику и
  момент измерения. Межпровайдерный рейтинг качества не строится.
- Геометрия стен используется только как визуальный контекст. House Plan не
  утверждает, что конкретная стена вызвала слабый сигнал.

## 12. i18n

Новые пользовательские строки добавляются синхронно в `en`, `ru`, `de`, `fr`:

- название и help переключателя;
- названия ZHA/Z2M provider controls;
- статус «данные не загружены / получены / устарели / частичные»;
- предупреждение о длительности и нагрузке Z2M scan;
- ошибки permission, unsupported, timeout, invalid base topic/payload;
- cross-space count с pluralization;
- нейтральное summary «связи не найдены / часть узлов не показана».

Тексты используют «наблюдаемые связи» и «полученные данные», а не «текущий
маршрут». Internal identifiers и raw provider errors локализованную границу не
пересекают.

## 13. Критерии приёмки

- **AC1 — default/off.** Новый и существующий план без валидного `enabled:true`
  визуально и по поведению совпадает с текущим View; topology runtime/API не
  вызываются. Доказательство: unit config tests + browser request spy, Codex.
- **AC2 — persistence.** Admin может включить/выключить настройку в «Общих
  настройках»; она переживает reload, относится ко всем spaces и не теряется при
  сохранении соседнего поля. Доказательство: config/store unit + browser smoke,
  Codex; backend suite на Linux CI при изменении store schema.
- **AC3 — permissions.** Non-admin не получает активного control, не вызывает
  ZHA/MQTT API и не видит слой при сохранённом `true`. Доказательство: unit
  permission matrix + browser smoke, Codex.
- **AC4 — contextual only.** При включённой функции и пригодном snapshot без
  hover нет линий, постоянных badges или легенды; hover одного mapped Zigbee
  marker рисует только incident links этого node. Доказательство: resolver unit
  + browser smoke + golden light/dark, Codex.
- **AC5 — no inferred route.** Реализация не строит путь до coordinator и не
  добавляет несуществующие edges из route destinations. Доказательство:
  provider fixtures + mutation witness, Codex.
- **AC6 — same-space mapping.** Рисуются только links с двумя exact drawable
  endpoints текущего space; сосед получает transient neutral highlight.
  Доказательство: mapping unit + browser smoke + golden, Codex.
- **AC7 — cross-space truth.** Remote endpoint не создаёт линию; рядом с
  hovered marker временно показан неинтерактивный count только drawable remote
  endpoints, без направления «выше/ниже». Доказательство: classification unit +
  browser smoke + golden, Codex.
- **AC8 — ambiguous/hidden lifecycle.** Unmatched, ambiguous, hidden, removed и
  HA-disabled endpoints не рисуются и не входят в cross-space count; rebind и
  перемещение пересчитывают mapping без scan. Доказательство: unit + browser
  smoke, Codex.
- **AC9 — modality and modes.** Touch/pen, keyboard focus, editors, kiosk и
  `houseplan-space-card` не показывают topology и не получают нового действия;
  существующие tap/long-press/click работают без изменений. Доказательство:
  browser mouse/touch/mode matrix + existing device-action smokes, Codex.
- **AC10 — cleanup.** Pointerleave, mouse→touch/pen, mode/space change,
  disconnect/remount и setting off очищают линии, highlight и count в том же
  lifecycle turn. Доказательство: state-machine unit + browser smoke, Codex.
- **AC11 — pointer ownership.** Линии, highlight и count pointer-transparent,
  не меняют device hit area, hover tooltip, click action, pan/zoom или fit.
  Доказательство: DOM/computed-style assertions + browser gestures smoke, Codex.
- **AC12 — LQI visual.** Hover→neighbor observation использует каноническую
  continuous LQI colour; unknown — нейтральный пунктир; reverse observation не
  усредняется. Stroke остаётся читаемым в screen space на min/default/max zoom.
  Доказательство: pure resolver unit + golden zoom/theme matrix, Codex.

Порядок слоёв в AC6 и внешний casing unknown-LQI линии в AC12 впоследствии
уточнены #464; provider/mapping-семантика этих критериев не меняется.
- **AC13 — ZHA contract.** Явное действие читает admin-only `zha/devices`,
  нормализует fixtures и не вызывает `zha/topology/update`; UI не заявляет
  неизвестную scan freshness. Доказательство: adapter unit/contract fixture +
  request spy, Codex.
- **AC14 — Z2M contract.** Только подтверждённая instance публикует raw
  `routes:false` request после явного предупреждения; transaction, 150 s timeout,
  retained/foreign/late response и cleanup соблюдены. Доказательство: adapter
  unit with fake clock/MQTT + HA MQTT contract fixture на Linux CI (не House
  Plan backend), Codex/CI.
- **AC15 — no implicit work.** HA state ticks, hover, space switch, rebind и
  второй экземпляр карточки не запускают provider fetch/scan; concurrent explicit
  requests дедуплицируются. Доказательство: call-count unit + browser smoke +
  mutation witnesses, Codex.
- **AC16 — failures.** Unsupported API, permission denial, invalid payload,
  partial provider failure и timeout дают локализованный status и не ломают plan
  либо snapshot другого provider. Доказательство: unit/error fixtures + browser
  smoke, Codex.
- **AC17 — privacy.** IEEE/raw topology не попадают в saved config, exports,
  backup, diagnostics, support report, localStorage или console. Доказательство:
  serialization/privacy tests + reviewer code audit, Codex/Claude.
- **AC18 — bounds.** Payload limits, edge cap и incident-only render сохраняют
  установленный performance budget на fixtures 20/100/500 nodes и dense
  malformed graph. Доказательство: benchmark + performance smoke, Codex/CI.
- **AC19 — lazy boundary.** Выключенный initial View не включает topology runtime
  в initial graph и сохраняет действующий bundle ceiling; включённый путь
  загружает отдельный chunk один раз. Доказательство: chunk/import unit + bundle
  budget + browser network spy, Codex.
- **AC20 — i18n.** Все новые видимые состояния имеют parity en/ru/de/fr,
  корректные plurals и не показывают raw provider text. Доказательство: i18n
  parity/dead-key tests + golden, Codex.

## 14. План автотестов

1. Добавить pure-unit suites для settings normalization, normalized graph,
   directional pair merge, incident-edge selection, exact registry/marker
   mapping, cross-space classification, payload bounds и cache/in-flight dedupe.
2. Добавить обезличенные ZHA и Z2M fixtures: one-way/two-way/unknown LQI,
   sleeping end device, coordinator, multiple instances, duplicates/self links,
   partial router failure, wrong base topic и malformed/dense payload.
3. Adapter tests с fake clock/transport доказывают ZHA read-only path и полную
   Z2M transaction/timeout/retained/late/cleanup матрицу. Для защит implicit scan,
   matching и cleanup зарегистрировать mutation-gate entries.
4. Новый browser smoke `smoke_zigbee_topology_hover.mjs`: off/no requests;
   admin enable/persistence; explicit load; mouse hover incident-only; leave и
   lifecycle cleanup; same/cross-space; touch/pen/mode/kiosk/static absence;
   click/pan/zoom regression; errors и second-card dedupe.
5. Golden-сценарии light/dark: local strong/weak/unknown links, cross-space count,
   min/default/max zoom и partial-data status в общих настройках. Baselines
   принимаются только через штатный Linux reviewed workflow.
6. Performance fixture 20/100/500 nodes измеряет normalize/map, first hover,
   repeated hover и dense-invalid rejection; обычный HA tick сохраняет нулевую
   topology работу. Бюджеты фиксируются до S7 на измеренном dev-стенде.
7. Если реализация добавляет House Plan backend surface, выполнить полный HA
   harness на Linux CI; Windows native результат не считать backend-доказательством.
8. Перед S7 обязательны `npm run typecheck`, `npm test`, `npm run build`,
   `npm run bundle:sync`, `npm run bundle:budget`, `node scripts/check-docs.mjs`,
   `node scripts/smoke-select.mjs --base origin/dev --head HEAD`, выбранные smoke,
   `node scripts/no-new-any.mjs --base origin/dev --head HEAD` и относящиеся
   mutation runs. Golden/performance полным набором — перед бетой, targeted
   witnesses — до код-ревью.

## 15. Затронутые файлы и модули

Ожидаемые продуктовые поверхности:

- `src/types.ts` и нормализация общих настроек — optional topology settings;
- новый pure topology module — provider-neutral types, validation,
  normalization, incident-link selection и exact marker mapping;
- новый lazy topology runtime/provider adapters — shared cache, ZHA WebSocket,
  Z2M MQTT transaction/lifecycle и permission guards;
- `src/houseplan-card.ts` и device render seams — lazy lifecycle, mouse-hover
  ownership, same-space edge projection, cross-space count и cleanup;
- `src/houseplan-editor-runtime.ts` — переключатель, provider controls и status
  в «Общих настройках»;
- device/dialog styles — pointer-transparent edge/highlight/count layer и
  responsive provider settings;
- `src/i18n/*.json` и при необходимости тематический lazy i18n chunk — новые
  строки en/ru/de/fr.

Ожидаемые доказательные и документальные поверхности:

- `test/**` — settings/model/mapping/cache/provider/privacy unit suites и
  обезличенные fixtures;
- `demo/smoke_zigbee_topology_hover.mjs`, golden matrix/baselines и topology
  performance fixture/budget;
- `scripts/mutation-gate.mjs` и smoke-link registry — negative witnesses и
  связь нового smoke с изменёнными модулями;
- `docs/UX-MODES.md`, `docs/SCOPE.md`, пользовательское руководство, оба
  changelog и при необходимости privacy/config compatibility docs;
- manifest-driven generated bundle/chunks после `npm run bundle:sync`.

`custom_components/houseplan/**/*.py` не планируется: штатных HA WebSocket/MQTT
surfaces достаточно. Если реализация докажет обратное, появление House Plan
backend считается изменением заявленного технического скоупа и требует явной
фиксации до код-ревью.

## 16. Риски

- ZHA snapshot может быть старым, а completion-aware refresh отсутствует.
- Z2M scan дорогой и зависит от корректного base topic/MQTT permissions.
- Один HA device может иметь несколько маркеров, а custom discovery identifiers
  могут разрушить exact mapping.
- Пользователь может принять neighbor snapshot за реальный маршрут трафика.
- Dense/ошибочный payload способен перегрузить normalization или DOM без ранних
  limits и incident-only resolver.
- Hover-only UX недоступен на touch; это осознанное ограничение диагностической
  функции, а не скрытая попытка переопределить device gestures.

## 17. Откат

Функция fail-closed и выключена по умолчанию. Операционный откат — отключить
настройку: runtime перестаёт загружаться/рисоваться, provider requests не
выполняются, текущий план и LQI остаются прежними. Каждый provider adapter можно
отключить независимо без изменения данных плана. Snapshot memory-only, поэтому
cleanup пользовательских данных и миграция назад не требуются; сохранённые base
topics безопасно игнорируются старой версией.

## 18. Release-артефакты

- запись со ссылкой на #54 в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том
  же user-visible implementation commit;
- актуализация `docs/UX-MODES.md`, `docs/SCOPE.md`/J7 и пользовательского
  руководства: default-off, mouse-only, incident-only, manual provider refresh;
- обновление описания общих настроек и privacy/support boundary;
- reviewed golden screenshots для topology hover и настроек;
- release note прямо сообщает ограничения: admin, mouse hover, snapshot, без
  ZHA forced scan и без touch interaction.

## 19. Предположения автора — можно менять на ревью без решения владельца

- Внутреннее поле настроек группируется в `settings.zigbee_topology`; точное имя
  не является продуктовым контрактом.
- Provider-neutral runtime и adapters живут в отдельном lazy chunk; House Plan
  backend не добавляется, пока штатных HA WebSocket/MQTT surfaces достаточно.
- Default Z2M base topic — `zigbee2mqtt`; несколько instances представлены
  списком exact base topics.
- Stale threshold — пять минут; он меняет только status, не запускает refresh.
- Z2M hard timeout — 150 секунд, `routes:false`.
- Line visual использует LQI направления hovered→neighbor; reverse observation
  хранится, но не требует второго параллельного stroke.
- Cross-space detail ограничен неинтерактивным count; список и навигация могут
  стать отдельной задачей только после полевого запроса.
- Точные числовые performance budgets устанавливаются до S7 по измеренному
  dev-стенду для уже перечисленных fixtures, а не угадываются на этапе ТЗ.

## 20. Источники Stage 0

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
- Zigbee2MQTT implementation/model:
  https://github.com/Koenkk/zigbee2mqtt/blob/master/lib/extension/networkMap.ts
  and https://github.com/Koenkk/zigbee2mqtt/blob/master/lib/types/api.ts
