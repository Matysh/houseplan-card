# ТЗ: визуальная непрерывность плана при возврате на вкладку

**Issue:** [#73 — Исключить мигание плана при возврате на вкладку](https://github.com/Matysh/houseplan-card/issues/73)<br>
**Статус:** ТЗ принято после двух раундов ревью; implementation gate пока не пройден, реализация не начата<br>
**Область:** `houseplan-card`, `houseplan-space-card`, lifecycle браузера и Home Assistant<br>
**Модель данных:** без изменений<br>
**Backend API:** без обязательных изменений

## 1. Краткое решение

House Plan должен сохранять на экране последний полностью собранный кадр плана, пока новый кадр не готов целиком. При возврате на вкладку запрещено заранее скрывать сцену, сбрасывать viewport, фон, Glow или геометрию.

Допускается кратковременно показывать последнее известное состояние устройств. Визуальная непрерывность имеет приоритет над мгновенным отображением свежего HA-state. Новые состояния устройств, конфигурация, layout, viewport и защищённые изображения применяются атомарно — без промежуточных кадров.

Непрозрачный слой восстановления является аварийным fallback, а не штатной анимацией возврата. Он появляется только тогда, когда сохранить предыдущий полноценный кадр невозможно, и только после короткой задержки, чтобы сам слой не стал новым источником мигания.

## 2. Проблема

После возврата на вкладку, восстановления свёрнутого браузера или переподключения Home Assistant пользователь может увидеть один или несколько артефактов:

- план исчезает и появляется снова;
- на мгновение меняется масштаб или центр;
- контур дома временно становится чёрным;
- пропадает и возвращается подложка;
- Glow меняет яркость или режим смешивания;
- разные слои плана восстанавливаются в разные кадры;
- артефакт возникает даже после короткого ухода с вкладки.

Предыдущие правки защищали отдельные симптомы, однако сформировали несколько несвязанных lifecycle-механизмов. Каждый из них локально оправдан, но совместно они не гарантируют целостный кадр.

## 3. Результаты исследования

### 3.1. Принудительное скрытие сцены

После длительного background текущий `_beginResumeSettle()` в обычном режиме просмотра включает `_resumeSettling`, а класс `hpresume` задаёт `visibility: hidden` для `.zoomwrap` и связанных элементов на 220–750 мс. Это гарантированно создаёт исчезновение плана даже тогда, когда предыдущий кадр корректен и размеры сцены не изменились.

В kiosk и редакторах `_beginResumeSettle()` и `_resumeSettleTick` завершаются до включения `hpresume`: принудительного скрытия там уже нет. Контракт #73 всё равно распространяется на эти режимы, но задача в них другая — сохранять фон, Glow, device snapshot, viewport и защищённые ресурсы при reconnect/remount, а не удалять несуществующий veil.

### 3.2. Подписанные изображения принадлежат экземпляру карточки

`ContentSigner` хранит подписанные URL внутри экземпляра. При remount новый экземпляр начинает с пустого cache, а `_display()` возвращает пустую строку до batch-delay, ответа WS и загрузки/декодирования изображения. `warmBoot` переносит viewport и часть UI-состояния, но не переносит готовность защищённых ресурсов.

### 3.3. Reconnect безусловно запускает обновление модели

`_onConnReady()` повторно загружает config/layout либо вызывает `_reloadConfigOnly()`. Даже если ревизия и содержимое не изменились, новый объект `_serverCfg` повышает `_cfgEpoch`, инвалидирует геометрические memo/cache и создаёт лишние render-проходы.

### 3.4. Режим смешивания Glow меняется после первого кадра

`svgScreenBlendSupported()` уже дедуплицирует асинхронную проверку через document-scope `WeakMap<Document, Promise<boolean>>`. Проблема не в отсутствии promise-cache: новый экземпляр создаётся с `_glowScreenBlend = false`, а присваивание даже уже вычисленного результата выполняется через `.then()` и откладывается на микрозадачу. Первый синхронный render поэтому может пройти с `normal`, а следующий — с `screen`.

Требуемое исправление — хранить рядом с promise синхронно доступный разрешённый результат. При его наличии поле инициализируется до первого render; асинхронный путь остаётся только для первого холодного probe и входит в readiness gate.

### 3.5. Visibility и ResizeObserver создают лишние refit/render

`visibilitychange` всегда вызывает `requestUpdate()`. `ResizeObserver` вызывает `_refitView()`, а тот — `_applyView()` и ещё один `requestUpdate()` даже при фактически неизменившемся размере и viewport. Нулевые размеры уже частично отфильтрованы, но положительный размер после восстановления всё равно не проверяется на эквивалентность предыдущему.

### 3.6. Статическая карточка имеет отдельный lifecycle

`houseplan-space-card` создаёт собственный `ContentSigner`, при config event временно обнуляет `_snap`, отдельно измеряет сцену и загружает данные. Поэтому исправление только основной карточки не закрывает проблему на компактных карточках пространств.

### 3.7. GPU-композиция не является авторитетным состоянием

SVG filters, `mix-blend-mode`, opacity и большие composited layers могут быть выгружены браузером в background и пересобраны после возврата. Это нельзя полностью контролировать, но можно не усиливать эффект одновременным скрытием DOM, заменой ресурсов и сменой режима смешивания.

## 4. Цели

1. При обычном возврате на вкладку ни один уже видимый слой плана не исчезает и не меняет вид промежуточным кадром.
2. Размер, масштаб и центр плана остаются прежними, если фактическая рабочая область не изменилась.
3. Если рабочая область изменилась, новый viewport применяется одним законченным кадром.
4. Подложка, Glow, геометрия, устройства и room fill не восстанавливаются по отдельности.
5. Переподключение с совпадающими парами config/layout `revision + content fingerprint` не инвалидирует геометрию.
6. Краткая задержка обновления состояний устройств считается допустимой и не должна вызывать overlay.
7. Одинаковый контракт действует для основной и статической карточек.
8. Причины редкого fallback-восстановления должны быть диагностируемы.

## 5. Не цели

- Изменение серверной модели House Plan или формата сохранённой конфигурации.
- Гарантия актуальности устройств во время отсутствия связи с HA.
- Маскировка холодной загрузки страницы после `Ctrl+F5`, обновления ресурса карточки или полного уничтожения документа браузером.
- Сохранение незавершённого pointer-жеста при уходе с вкладки.
- Создание bitmap/screenshot-копии плана для штатного возврата.
- Анимация каждого изменения HA-state.
- Исправление багов самого GPU/браузера ценой отключения Glow или визуальных эффектов.

## 6. Термины

**Последний полноценный кадр (last complete frame)** — уже показанное согласованное состояние, включающее структуру плана, layout, viewport, доступные защищённые изображения, выбранный режим смешивания и render-снимок устройств.

**Кандидатный кадр (candidate frame)** — новое состояние, которое подготавливается после resume, reconnect, remount, resize или обновления данных, но ещё не заменило видимый кадр.

**Структурные данные** — config, layout, выбранное пространство, геометрия, настройки отображения и viewport.

**Live-данные** — состояния HA, activity pulse, температура, влажность, сигнал, vacuum state/trail и прочие быстро меняющиеся значения.

**Визуальная готовность** — кандидат можно показать без пустого фона, промежуточного viewport, смены blend-mode следующим кадром или частично обновлённых слоёв.

**Stale frame** — полноценный кадр с последними известными, но потенциально уже устаревшими live-данными.

## 7. Базовые инварианты

1. Наличие нового data snapshot само по себе не разрешает убирать старый DOM с экрана.
2. `document.visibilityState = visible` не означает, что размеры, connection и protected assets уже готовы.
3. Нулевой или переходный размер никогда не записывается в `_view`, warm memo или layout cache.
4. Эквивалентный размер не вызывает refit.
5. Идентичность config/layout определяется парой `revision + content fingerprint`. Только совпадение обоих значений сохраняет авторитетный объект модели и geometry epoch; при одинаковой ревизии, но разном fingerprint приоритет имеет фактическое содержимое с соблюдением optimistic-write/conflict-контракта.
6. Состояние устройств может быть старее structural frame. Это разрешённая асимметрия.
7. Render-снимок устройств используется только для изображения. Любое действие по клику разрешается по последнему доступному runtime HA, а не по замороженному render-снимку.
8. Устаревший кадр не должен отправлять unsigned content requests.
9. Overlay не показывается только потому, что отсутствует новый HA-state.
10. Первый полностью видимый кадр после resume должен уже иметь окончательный blend-mode.
11. Hover, tooltip и focus не должны сбрасываться при быстром возврате. При реальном remount они восстанавливаются только если уже входят в существующий warm lifecycle; эта задача не расширяет хранение transient hover.
12. Если предыдущий полноценный кадр существует, временная ошибка WS не заменяет его loading/error-состоянием.

## 8. Продуктовое поведение

### 8.1. Быстрый возврат

Для ухода с вкладки менее чем на 15 секунд:

- план остаётся в DOM без veil и overlay;
- `_view`, zoom, pan, выбранное пространство и режим не пересчитываются без фактического изменения размеров;
- текущий hover сохраняется, если тот же экземпляр карточки остался подключён;
- новый HA snapshot применяется обычным render-проходом;
- отсутствие нового HA snapshot не вызывает никаких специальных эффектов.

Порог 15 секунд перестаёт означать «обязательно скрыть план» и используется только как диагностический признак возможного browser freeze.

### 8.2. Длительный background без remount и reconnect

- Последний полноценный кадр остаётся видимым.
- Положение солнца, daylight, Glow и live-данные пересчитываются в candidate frame.
- Candidate frame коммитится атомарно после проверки размеров и visual capability.
- Если размеры совпали, refit запрещён.
- Overlay не показывается.

### 8.3. Длительный background с reconnect

- Последний полноценный кадр продолжает отображаться как stale frame.
- Состояния устройств могут оставаться прежними до получения первого пригодного snapshot после resume.
- Возраст render-снимка 1000 мс после resume — только диагностический порог: controller записывает trace-событие `device-snapshot-stale`, но не меняет UI и не запускает таймер принудительной замены. При отсутствии нового snapshot stale frame продолжает отображаться.
- Config/layout проверяются по парам `revision + content fingerprint`. Совпадение обеих частей не пересобирает геометрию.
- Новый согласованный кадр заменяет последний полноценный кадр одной операцией.
- Offline/reconnecting сам по себе не закрывает план overlay, пока последний полноценный кадр доступен.

### 8.4. Remount в том же DOM-слоте

Новый экземпляр должен получить из session/module runtime:

- warm viewport и mode;
- structural fingerprint последнего кадра;
- последний render-снимок устройств;
- результат определения Glow blend capability;
- доступные и ещё пригодные signed URL;
- сведения о decoded/loaded protected assets.

Если всё перечисленное пригодно, первый кадр нового экземпляра визуально эквивалентен последнему кадру старого. Новый экземпляр не должен сначала рисовать `normal` Glow, пустую подложку или default fit.

Если protected asset уже нельзя безопасно использовать, применяется раздел 8.7.

### 8.5. Реальное изменение размеров

При orientation change, изменении dashboard chrome, split-screen или resize:

- последний полноценный кадр остаётся видимым до получения положительного стабильного размера;
- candidate viewport вычисляется с сохранением zoom и центра;
- старый размер не перезаписывается нулём;
- новый viewport применяется атомарно;
- обычный resize не требует непрозрачного overlay;
- если последний полноценный кадр невозможно корректно удержать внутри изменившегося контейнера, разрешено временно clip-нуть его границами stage, но не масштабировать через промежуточные значения.

### 8.6. Реальное изменение config/layout во время отсутствия

- Последний полноценный кадр остаётся до готовности новой структурной ревизии.
- Config и layout образуют один candidate structural frame. Нельзя показать новую геометрию со старым layout или наоборот, если обе ревизии получены в рамках одного recovery cycle.
- Перед применением защищённые ресурсы новой конфигурации должны получить безопасные display URL и пройти decode/load gate.
- Если изменён выбранный space или он удалён, fallback-space выбирается до commit, а не после первого render.
- Удалённый в новой конфигурации asset не является blocker.
- Незавершённые локальные записи и conflict/reload продолжают соблюдать существующий optimistic-write контракт; recovery controller не имеет права молча отбросить edit history.

### 8.7. Когда допустим непрозрачный слой восстановления

Overlay разрешён только если одновременно выполняются условия:

1. предыдущий полноценный кадр невозможно показать безопасно или его нет;
2. candidate frame ещё не готов;
3. проблема сохраняется дольше 150 мс после первого видимого кадра документа.

Примеры:

- remount после истечения подписанного URL, когда background image обязателен для полноценного кадра и общего session-cache недостаточно;
- браузер уничтожил composited/DOM state, а новый защищённый ресурс ещё не декодирован;
- выбранное пространство удалено удалённой конфигурацией, но replacement candidate ещё не собран;
- stage остаётся нулевого размера после восстановления и последний полноценный кадр физически некуда показать.

Overlay запрещён при:

- обычном quick return;
- наличии старого полноценного кадра с устаревшими устройствами;
- простом reconnect при сохранной геометрии;
- ожидании только новых HA states;
- повторной подписи ресурса, пока старый display URL ещё пригоден и уже видим;
- неизменившемся config/layout.

Текст:

- общий случай: **«Восстанавливаем план…»** / **“Restoring floor plan…”**;
- только при подтверждённом disconnected/reconnecting HA и отсутствии пригодного кадра: **«Восстанавливаем подключение к устройствам…»** / **“Restoring device connection…”**.

Overlay:

- полностью непрозрачен относительно плана;
- появляется fade-in 150 мс после delay;
- если candidate готов до полного завершения fade-in, появление немедленно отменяется и overlay удаляется без минимальной выдержки;
- минимум 250 мс применяется только после того, как overlay стал полностью непрозрачным;
- исчезает fade-out 180 мс после paint barrier готового кадра;
- не меняет размеры stage;
- блокирует pointer interaction со скрытым неготовым кадром;
- при `prefers-reduced-motion: reduce` не анимируется, но сохраняет delay появления;
- имеет `role="status"`, `aria-live="polite"`, без перехвата focus;
- не должен зависнуть: при постоянной ошибке соблюдает числовые пределы и переходы из раздела 9.9; если позже появился последний полноценный кадр, controller использует его как stale frame.

### 8.8. Cold boot

Холодная загрузка без предыдущего кадра остаётся отдельным сценарием. Текущий boot veil можно сохранить, но он должен использовать общий readiness contract там, где это возможно. Данная задача не требует заменить onboarding/loading UX, однако не допускается ошибочно классифицировать warm remount как cold boot.

## 9. Архитектура

### 9.1. Единый `VisualContinuityController`

Основная и статическая карточки используют общий state machine/controller. Конкретное имя может измениться, но запрещены две независимые реализации правил resume.

Минимальные состояния:

| Состояние | Видимый результат | Допустимые действия |
|---|---|---|
| `steady` | актуальный полноценный кадр | обычные updates |
| `holding` | последний полноценный кадр | подготовка candidate, stale live-data допустимы |
| `candidate-ready` | пока последний полноценный кадр | atomic commit + paint barrier |
| `overlay-pending` | последний полноценный кадр либо stage background | таймер 150 мс, отмена при быстрой готовности |
| `overlay-visible` | непрозрачный recovery overlay | ожидание candidate, отмена неполного fade-in или error fallback |
| `offline-stale` | последний полноценный stale frame | ожидание связи без обязательного overlay |
| `recovery-error` | непрозрачный error/offline fallback | явный retry после timeout paint barrier |

Controller получает события:

- `visibility-hidden` / `visibility-visible`;
- `stage-size-valid` / `stage-size-invalid`;
- `connection-ready` / `connection-lost`;
- `config-candidate` / `layout-candidate`;
- `hass-snapshot`;
- `asset-ready` / `asset-failed`;
- `blend-capability-ready`;
- `card-connected` / `card-disconnected`;
- `render-committed` / `paint-barrier`.

Controller не хранит пользовательскую конфигурацию и не вызывает HA service. Он только решает, какой frame можно показывать и нужен ли overlay.

### 9.2. Двойной буфер данных

Нужны отдельные immutable references:

```ts
type RenderDeviceState = Readonly<{
  markerId: string;
  entityIds: readonly string[];
  spaceId?: string;
  position: Readonly<{ x: number; y: number }>;
  icon: string;
  displayMode: string;
  hidden: boolean;
  opacity: number;
  visualState: 'static' | 'idle' | 'active' | 'unavailable';
  classes: readonly string[];
  value?: string;
  valueFull?: string;
  activity: Readonly<{
    kind: 'none' | 'motion' | 'presence' | 'cover-motion' | 'working' | 'pulse' | 'vacuum' | 'other';
    generation: number;
    expiresAt?: number;
  }>;
  roomContribution: Readonly<{
    isLightSource: boolean;
    lightOn: boolean;
    temperature?: number;
    humidity?: number;
    signal?: number;
    sourceEntityIds: readonly string[];
  }>;
  controlPresentation: Readonly<Record<string, string | number | boolean | null>>;
}>;

type RenderDeviceSnapshot = Readonly<{
  sourceSequence: number;
  capturedAt: number;
  devices: readonly RenderDeviceState[];
}>;

type VisualFrame = Readonly<{
  structuralFingerprint: string;
  configFingerprint: string;
  layoutFingerprint: string;
  configRev: number;
  layoutRev: number;
  spaceId: string;
  mode: 'view' | 'plan' | 'devices' | 'decor';
  viewport: Readonly<{ x: number; y: number; w: number; h: number }>;
  stageSize: Readonly<{ width: number; height: number }>;
  deviceSnapshot: RenderDeviceSnapshot;
  assetKeys: readonly string[];
  blendMode: 'screen' | 'normal';
}>;
```

Тип иллюстративен на уровне имён, но граница обязательна: render-снимок содержит уже разрешённые presentation-данные устройства, activity на текущий момент, вклады в данные комнаты и presentation-state controls. Он не содержит полный `hass`, entity objects или callbacks. Реализация может хранить отдельные memo и fingerprints, но обязана различать visible и candidate state. Нельзя мутировать объект, который считается последним полноценным кадром.

Все render-пути, входящие в атомарный кадр, читают device-derived данные только из `RenderDeviceSnapshot`; прямое чтение `this.hass` в них запрещено. Event handlers и отправка service calls, напротив, всегда читают актуальный runtime HA в момент действия.

### 9.3. Structural fingerprint

Fingerprint должен позволять дешёво ответить, изменилась ли визуальная структура. Для config и layout отдельно хранится пара `revision + content fingerprint`; общий structural fingerprint собирается из этих пар и визуального контекста. В него входят как минимум:

- config revision и identity/fingerprint содержимого;
- layout revision;
- выбранный space;
- mode и настройки, влияющие на состав слоёв;
- viewport/stage size;
- theme/display параметры, меняющие геометрию или palette.

Обычный HA-state tick не меняет structural fingerprint и не инвалидирует geometry cache.

### 9.4. Config/layout revalidation

`_onConnReady()` не должен безусловно заменять `_serverCfg`.

Обязательное поведение:

1. Получить ревизии и дешёвые content fingerprints config/layout из фактически принятых данных.
2. Если и revision, и fingerprint совпадают с применёнными, сохранить текущие object references и geometry epoch.
3. Если revision совпадает, но fingerprint отличается, фактическое содержимое считается изменившимся: собрать candidate и провести его через существующие optimistic-write/defer/conflict-правила. Совпавшая revision не имеет права скрыть локальную или удалённую правку.
4. Если revision изменилась, но fingerprint визуально значимого содержимого совпал, обновить revision metadata без пересборки geometry.
5. Если изменился только layout fingerprint, не пересобирать config-derived geometry.
6. Если изменился config fingerprint, собрать candidate model и только затем заменить visible structural frame.
7. Одновременные ответы config/layout относятся к одному recovery cycle и коммитятся согласованно.
8. Ошибка запроса сохраняет stale frame.

Backend endpoint только для ревизий может быть добавлен как оптимизация позже; он не является обязательным условием реализации.

### 9.5. Shared protected-asset runtime

`ContentSigner` должен разделить instance lifecycle и page/session cache:

- подписанные URL и время выдачи доступны преемнику в том же документе;
- cache key включает backend/content identity и не смешивает разные HA connections;
- устаревающая, но ещё пригодная подпись продолжает отображаться, пока новая запрашивается в фоне;
- истёкшая подпись никогда не вставляется в новый DOM;
- факт успешной загрузки/decode ресурса хранится отдельно от факта наличия URL;
- resource candidate считается готовым только после load/decode либо когда тот же уже видимый DOM-resource остаётся на месте;
- cache ограничен по количеству/TTL и освобождается без удержания DOM nodes;
- несколько карточек дедуплицируют одинаковые sign requests.

Не требуется превращать все изображения в data/blob URL. Если после истинного remount нет пригодного URL и удержать последний полноценный кадр нельзя, используется overlay из раздела 8.7.

### 9.6. Blend capability

Существующий document-scope promise-cache `svgScreenBlendSupported()` сохраняется и расширяется синхронным кэшем уже разрешённого boolean-результата. Создавать параллельный capability cache или повторный probe на экземпляр запрещено.

- При наличии разрешённого результата warm remount инициализирует `_glowScreenBlend` синхронно до первого render и не проходит через default `false`.
- Асинхронный путь используется только для первого cold probe; его blend-mode входит в readiness gate.
- Запрещён видимый переход `normal -> screen` сразу после resume/remount.
- Изменение capability вследствие смены документа/браузерного контекста применяется только как часть candidate frame.

### 9.7. Viewport и observers

Наблюдение stage должно хранить последнее валидное измерение.

Refit выполняется только если:

- новый размер положителен;
- он отличается от последнего применённого больше допустимого epsilon;
- размер подтверждён в следующем animation frame либо браузер уже завершил resize;
- controller разрешил candidate commit.

Если новый `_view` численно эквивалентен текущему, reactive fields не присваиваются и `requestUpdate()` не вызывается.

`visibilitychange` без изменившихся данных не вызывает обязательный render. Оно только уведомляет controller и запускает проверку readiness.

### 9.8. Live-device snapshot

На входе в `holding` фиксируется последний render-снимок устройств. После resume:

1. Геометрия и фон продолжают отображаться с ним.
2. Приходит новый `hass` object/snapshot — устройства пересчитываются в candidate buffer.
3. Все связанные derived-данные одного устройства (иконка, dynamic background, pulse, room light contribution, temperature/signal и controls) вычисляются из одного candidate snapshot.
4. Candidate применяется одним render commit.
5. Если свежий snapshot не пришёл, старый остаётся; overlay не нужен.

Activity/pulse timers, истёкшие в background, не должны воспроизводить пропущенную анимацию. После resume они нормализуются к состоянию на текущий момент и коммитятся вместе с candidate.

Обработчик клика обязан читать последний runtime HA в момент действия. Замороженный render-снимок запрещено использовать как источник решения «что отправить».

### 9.9. Paint barrier

Готовность данных не равна готовности пикселей. Перед удалением overlay либо объявлением candidate полноценным кадром требуется:

1. Lit `updateComplete`;
2. готовность обязательных images;
3. минимум два `requestAnimationFrame`: первый позволяет браузеру собрать layout/layers, второй подтверждает следующий paint opportunity;
4. повторная проверка положительного stage size и того же candidate token.

Если за это время candidate устарел, старый candidate не раскрывается.

Один paint barrier имеет верхний предел `PAINT_BARRIER_MAX_MS = 2000` мс с момента готовности данных candidate:

- если timeout наступил при наличии последнего полноценного кадра, candidate отклоняется, stale frame остаётся видимым, записывается `paint-barrier-timeout`, а поздняя готовность ресурса создаёт новый candidate token;
- если timeout наступил без последнего полноценного кадра, recovery overlay остаётся непрозрачным, controller переходит в `recovery-error` и показывает существующий локализованный recoverable error/offline UX с явным retry;
- поздний `asset-ready`, reconnect или ручной retry запускает новый recovery cycle; просроченный token не может раскрыть старый candidate;
- бесконечное ожидание image decode, rAF или положительного stage size запрещено.

Paint barrier и таймеры recovery overlay независимы: достижение `PAINT_BARRIER_MAX_MS` само по себе не снимает overlay. Если последнего полноценного кадра нет, уже показанный overlay остаётся непрозрачным при переходе в `recovery-error` и до явного retry/нового recovery cycle; если stale frame есть, timeout оставляет его видимым и не включает overlay задним числом.

## 10. Слои и атомарность

В один visual commit входят:

- paper/room fills;
- backdrop;
- decor;
- walls/openings/partitions/columns;
- Glow и его masks/filters;
- солнечные лучи;
- room hover и tooltip, если их состояние осталось валидным;
- устройства и device-derived room data;
- vacuum map/trail;
- viewport/viewBox;
- theme-dependent palette.

Допускается не пересоздавать неизменившиеся DOM-узлы. Требование относится к наблюдаемому результату: пользователь не должен увидеть комбинацию старых и новых слоёв.

## 11. Режимы карточки

### 11.1. Обычный просмотр

Полный контракт обязателен.

### 11.2. Kiosk

Kiosk не использует `hpresume` уже сейчас, поэтому удалять veil в нём не требуется. Тем не менее он входит в continuity contract: обязан сохранять фон, Glow, device snapshot и signed assets при reconnect/remount. Он может не нуждаться в resize settle из-за `100dvh`; overlay применяется по тем же редким условиям.

### 11.3. Редакторы

- Незавершённый pointer/touch gesture отменяется существующим контрактом `_interruptViewGesture`, принятым в #59 и покрытым `smoke_long_press_gesture`; отдельная параллельная логика отмены не создаётся.
- Сохранённая конфигурация, mode, selection и command stack не сбрасываются.
- Видимый план не скрывается при возврате.
- Recovery overlay при необходимости блокирует редактирование до готовности structural frame.
- Замороженное live-состояние устройств допустимо; локальный geometry draft не подменяется серверным candidate без существующего conflict workflow.

### 11.4. `houseplan-space-card`

Статическая карточка использует общий shared signer/capability cache и общий controller либо его упрощённый adapter. Config event не должен сначала обнулять `_snap` при наличии валидного текущего snapshot. Старый snapshot остаётся видимым до успешной загрузки нового.

### 11.5. Несколько карточек на странице

- Controller state принадлежит placement, а asset/capability cache — document/connection scope.
- Существующие module-scope `pageHiddenAt`, `pageLongResumeEvent` и общий visibility handler являются основой реализации: они расширяются единым resume token, а не заменяются вторым document listener/state-механизмом.
- Visibility event обрабатывается один раз на document и распространяется всем экземплярам с единым resume token.
- Одна карточка не очищает timestamp/token до обработки соседней.
- Одинаковая конфигурация в двух placements не даёт права наследовать чужой viewport или device snapshot.

## 12. Edge cases

| Сценарий | Требуемое поведение |
|---|---|
| Вкладка hidden 2 секунды | Никаких специальных визуальных действий |
| Вкладка hidden 30 секунд, размеры те же | Последний полноценный кадр остаётся; candidate коммитится без refit |
| Браузер свёрнут, HA connection жива | То же, что long background без reconnect |
| HA reconnect, revision и fingerprint те же | Stale frame → один live update; geometry epoch не меняется |
| HA reconnect, revision та же, fingerprint изменился | Содержимое выигрывает; candidate проходит optimistic-write/conflict workflow и коммитится атомарно |
| HA reconnect, revision изменилась, fingerprint тот же | Обновляется revision metadata без пересборки geometry |
| HA reconnect, config изменён | Последний полноценный кадр остаётся до готовности новой структуры; atomic commit |
| ResizeObserver дал `0×0`, затем прежний размер | Ничего не менять и не рендерить новый viewport |
| ResizeObserver дал новый положительный размер | Один refit по стабильному размеру |
| Remount с валидной shared подписью | Первый кадр уже с подложкой |
| Remount с истёкшей подписью | Последний полноценный кадр, если он доступен; иначе delayed recovery overlay |
| Фоновая картинка удалена в новой config | Asset gate её не ждёт |
| Устройство изменилось во время hidden | Старое состояние допустимо до atomic candidate commit |
| Устройство стало unavailable | Новое состояние применяется вместе со всем device snapshot, без структурного repaint |
| Связь не вернулась | Stale frame остаётся видимым без обязательного overlay |
| Theme сменена в background | Palette и dependent layers меняются одним candidate frame |
| Space удалён удалённо | Fallback space выбирается до reveal |
| Пользователь сменил Lovelace view | Разделение использует существующий `warmBootKey(config)`; внутри его scope действуют текущие placement/owner rules. Новый ключ по DOM-позиции и наследование чужого frame запрещены |
| Browser back/forward cache | После `pageshow` используется тот же readiness workflow; `persisted` учитывается как сигнал, не как причина скрытия |
| Touch pinch был активен при hidden | Gesture отменяется, click suppression сохраняется на безопасное окно |
| `prefers-reduced-motion` | Нет fade, но нет промежуточного пустого кадра |
| Несколько Glow sources | Blend-mode и filters готовы до общего commit |
| Vacuum animation/timer истёк | Переход к текущему состоянию без проигрывания пропущенных pulse frames |

## 13. Диагностика

В development/demo runtime нужен кольцевой trace последних 50–100 событий без production console spam:

```ts
type ContinuityTraceEvent = {
  at: number;
  token: number;
  event: string;
  state: string;
  reason?: string;
  stage?: [number, number];
  configRev?: number;
  layoutRev?: number;
  assetPending?: number;
};
```

Тестовые hooks/data attributes:

- `data-continuity-state`, `data-continuity-token` и `data-frame-fingerprint` — стабильный низкокардинальный контракт на корневом элементе в production и test builds;
- `data-recovery-reason` — стабильный production/test атрибут только при overlay/error fallback;
- `data-device-snapshot-age` и read-only hook кольцевого trace — только development/demo/test.

Обязательные production-атрибуты не исключаются build-флагом и могут использоваться lifecycle smoke. Они не содержат entity IDs, URL или другие чувствительные/высококардинальные данные. Ошибки signed assets и connection не должны логироваться на каждом render.

## 14. Accessibility и interaction

- Recovery overlay не получает initial focus и не крадёт текущий focus.
- `aria-live="polite"`; повтор одного и того же текста не анонсируется заново.
- Пока overlay видим, скрытая сцена `inert` для pointer/keyboard, но сама карточка не исчезает из accessibility tree целиком.
- Если stale frame остаётся видимым без overlay, room navigation и безопасные действия доступны.
- Device actions используют live runtime на момент клика; при фактическом disconnected HA существующая обработка service error остаётся авторитетной.
- Не добавляется новый постоянный индикатор stale state в рамках этой задачи.

## 15. Производительность и память

1. Обычный `hass` tick не делает deep clone всей config/layout.
2. Structural fingerprint не пересчитывает тяжёлую геометрию при state-only update.
3. Shared asset cache имеет LRU/TTL и верхнюю границу.
4. Warm device snapshot хранит только данные, необходимые renderer, а не полный `hass` object.
5. Не допускаются параллельные continuity rAF loops на один placement.
6. Observer callback без реального изменения не вызывает Lit update.
7. Sign requests дедуплицируются между карточками.
8. Trace ограничен по размеру.

Производительность измеряется существующим профилем `large-house-glow-overlay-v1` и политикой issue #69, а не отдельным неизмеримым обещанием «<1 мс». После внедрения фиксируется continuity baseline в том же runner. Обязательные условия: отсутствие дополнительного Lit render при quick return без изменений и отсутствие регресса текущего профиля сверх принятого в #69 допуска.

## 16. Тестирование

### 16.1. Unit tests

Отдельный state machine тестируется с fake clock:

- quick return остаётся `steady`;
- long return с complete frame переходит `holding -> steady` без overlay;
- отсутствие device snapshot не вызывает overlay;
- overlay появляется только после 150 мс и только при отсутствии последнего полноценного кадра;
- candidate, готовый до полного fade-in, отменяет overlay без minimum visible duration;
- minimum visible duration применяется только к полностью непрозрачному overlay;
- stale candidate token не коммитится;
- offline сохраняет stale frame;
- `prefers-reduced-motion` меняет только animation, не state logic;
- одинаковые размеры не создают viewport candidate;
- нулевой размер не уничтожает последний валидный;
- совпадающие пары `revision + content fingerprint` сохраняют references/epoch;
- одинаковая revision с разным fingerprint создаёт candidate, а изменившаяся revision с тем же fingerprint не пересобирает geometry;
- asset gate различает signed, loaded/decoded и expired;
- уже разрешённый document-scope blend result читается синхронно до первого render;
- timeout paint barrier сохраняет stale frame либо переводит отсутствие последнего полноценного кадра в `recovery-error`;
- atomic render-пути не читают `this.hass` в обход `RenderDeviceSnapshot`.

### 16.2. Lifecycle smoke

Нужен отдельный smoke-сценарий с управляемыми:

- `document.visibilityState`;
- fake timers/resume token;
- connection `ready`;
- задержкой `content/sign`;
- задержкой image decode;
- ResizeObserver (`0×0`, прежний и новый размер);
- remount в том же placement;
- обновлением state во время hidden;
- основной и статической карточкой.

Новый controller расширяет существующий module-scope warm memo и не дублирует/не подменяет его. Без ослабления assertions обязаны оставаться зелёными `smoke_warm_remount`, `smoke_warm_dialogs`, `smoke_warm_owners`, `smoke_preloader_lifecycle`, `smoke_ws_resilience`, `smoke_dialog_zombie`, `smoke_long_press_gesture` и контракт `docs/WARM-REMOUNT.md`.

Проверки должны подтверждать не только наличие DOM:

- `.zoomwrap` не получает `visibility:hidden` при resume;
- viewBox не меняется при том же размере;
- protected backdrop не получает пустой `href` между кадрами;
- geometry epoch не меняется при совпадающих парах `revision + content fingerprint`;
- Glow не проходит видимый `normal -> screen` после remount;
- overlay не появляется в быстрых/нормальных сценариях;
- при forced overlay текст и reason корректны;
- device render snapshot кратко остаётся старым, затем заменяется новым одним commit.

### 16.3. Frame sequence и pixel test

Обычный golden одного конечного кадра и цикл `page.screenshot()` недостаточны: Playwright screenshot не синхронизирован с presented frames и может пропустить артефакт длительностью один кадр. Проверка разделяется на два нормативных уровня.

**Обязательный CI-гейт — in-page rAF sampler.** До перевода вкладки в visible страница вооружает sampler; начиная с первого `requestAnimationFrame` после resume он записывает не менее 30 последовательных animation opportunities:

- наличие и computed `visibility`/`display` `.zoomwrap`;
- `viewBox` и стабильный stage bounding box;
- `data-continuity-state`, token и frame fingerprint;
- фактический `href` обязательной подложки;
- `data-blend`/применённый Glow blend-mode;
- факт наличия recovery overlay и его reason.

Sampler запускается внутри страницы, использует один и тот же clock/token с фикстурой и падает при любом запрещённом промежуточном состоянии. Это детерминированный обязательный тест для PR/beta CI, но он доказывает DOM/render-state, а не фактически представленные браузером пиксели.

Нормативный список запрещённых промежуточных состояний и переходов:

| Поле sampler | Запрещённое состояние или переход |
|---|---|
| `.zoomwrap` | Отсутствует, получает `display:none` или `visibility:hidden`, когда доступен last complete/stale frame и его не закрывает разрешённый непрозрачный recovery overlay |
| `viewBox` | Пустое/нечисловое значение; изменение при неизменившихся положительных размерах stage; промежуточный default-fit перед возвратом к сохранённому viewport |
| Stage bounding box | `0×0` становится авторитетным кадром; при неизменившемся размере контейнера bbox дома меняется между samples до атомарного commit нового token |
| `data-continuity-state` | Переход в loading/recovery-состояние при доступном stale frame; возврат уже завершённого token из `steady` в предыдущее состояние |
| Continuity token | Уменьшается, повторно используется новым recovery cycle либо меняется без события, создающего candidate |
| Frame fingerprint | Пуст после наличия complete frame; меняется до атомарного commit соответствующего candidate либо расходится между слоями одного sample |
| Backdrop `href` | Пригодный URL временно становится пустым/непригодным без удаления подложки новой structural revision и без разрешённого непрозрачного overlay |
| Glow `data-blend` | Пустое/неопределённое значение после complete frame; видимый переход `screen -> normal -> screen` или `normal -> screen` после remount при уже разрешённом document capability |
| Recovery overlay | Появляется при доступном stale frame, раньше 150 мс, без reason либо с connection-текстом без подтверждённого disconnected/reconnecting состояния |

Любое совпадение со строкой таблицы является падением sampler. Тест не имеет права заменять эти правила более слабой проверкой только конечного sample.

**Pixel-level sequence — CDP `Page.startScreencast`.** Настоящая последовательность presented frames захватывается через CDP screencast в nightly/manual профиле и обязательно перед стабильным релизом. `page.screenshot()` не считается заменой. Кадры связываются с resume token и контрольными временными метками sampler; после захвата screencast обязательно останавливается и acknowledgements кадров завершаются.

Фикстура должна содержать:

- непрозрачный фон пространства;
- защищённую подложку;
- толстые стены и проёмы;
- room fill;
- Glow с `screen` blending;
- солнечные лучи;
- несколько устройств с динамической подложкой;
- vacuum с детерминированным состоянием и видимым overlay;
- минимум один детерминированный decor-объект.

Утверждения rAF sampler:

1. `.zoomwrap`, viewBox, frame fingerprint и blend-mode не проходят через запрещённое промежуточное значение.
2. Bounding box дома и viewBox стабильны при неизменном размере.
3. Backdrop имеет пригодный `href` во всех samples либо закрыт разрешённым непрозрачным overlay.
4. Overlay не появляется в сценариях с доступным stale frame.

Утверждения CDP screencast:

1. В области, где до hidden был план, ни один presented frame не равен чистому stage background.
2. Контрольные пиксели стены не переходят во временный чёрный цвет.
3. Яркость контрольных пикселей Glow не имеет одиночного выброса сверх tolerance.
4. Backdrop присутствует во всех presented frames либо полностью закрыт разрешённым непрозрачным overlay.

Порог pixel-diff должен учитывать субпиксельный raster noise, но не позволять исчезновение слоя. Конкретное значение фиксируется после измерения baseline в Chromium CDP-профиле. Критерий «нет чистого stage background» доказывается только screencast, а не последовательностью `screenshot()`.

### 16.4. Реальный browser lifecycle

Минимум один ручной чек перед стабильным релизом:

- desktop Chrome/Edge: quick switch, 30–60 секунд background, minimize/restore;
- Android Chrome или HA Companion WebView: background/foreground;
- reconnect HA при открытой карточке;
- обычный View, kiosk и `houseplan-space-card`;
- signed backdrop;
- переход между Lovelace views с remount.

## 17. Критерии приёмки

1. При уходе с вкладки на 1–10 секунд и возврате план визуально не меняется, если данные и размеры не изменились.
2. При уходе более чем на 15 секунд нет обязательного скрытия `.zoomwrap`/плана.
3. При неизменившихся размерах viewBox, zoom и центр идентичны до и после возврата.
4. `0×0 -> прежний размер` не меняет viewport и не создаёт visible repaint plan geometry.
5. Reconnect с совпадающими парами config/layout `revision + content fingerprint` не повышает geometry epoch и не заменяет structural model; разный fingerprint при той же revision не игнорируется.
6. Warm remount с пригодным shared asset cache показывает backdrop с первого видимого кадра.
7. Glow не меняет blend-mode видимым отдельным кадром.
8. Старое состояние устройства разрешено до первого atomic live commit; промежуточное отсутствие устройства/иконки запрещено.
9. Отсутствие свежего HA snapshot не вызывает recovery overlay.
10. Overlay не появляется раньше 150 мс, не показывается при наличии stale frame, отменяется без минимальной выдержки до завершения fade-in и плавно исчезает только после успешного paint barrier.
11. Основная и статическая карточки проходят одинаковые lifecycle-инварианты.
12. Обязательный CI rAF sampler не обнаруживает ни одного перехода из нормативной таблицы §16.3; CDP screencast перед стабильным релизом не обнаруживает пустого, чёрного или несогласованного presented frame.
13. Холодная загрузка, signed URL security и stale-while-revalidate при outage не регрессируют.
14. Ни одна локальная geometry edit/command stack не теряется из-за recovery/reconnect.

## 18. План реализации

**Implementation gate.** Реализация #73 не начинается, пока не закрыты и не прошли code review renderer-задачи [#67](https://github.com/Matysh/houseplan-card/issues/67), [#71](https://github.com/Matysh/houseplan-card/issues/71) и [#72](https://github.com/Matysh/houseplan-card/issues/72). После их закрытия действующие golden images переснимаются только при подтверждённом ожидаемом изменении, переутверждаются и фиксируются как авторитетный baseline для frame-sequence fixture. SHA baseline записывается в issue #73/тестовую документацию до первой реализации continuity controller.

**Текущий статус gate на 2026-08-10.** Зависимость #67 закрыта после code review. Финальные локальные реализации #71 и #72 присутствуют и проходят целевые проверки, но обе issue ещё открыты и изменения не зафиксированы в `dev`, поэтому renderer-gate пока не выполнен. После пересборки `test-build` прошли 152/152 теста в `test/logic.test.mjs`, `test/golden-matrix.test.mjs` и `test/release-contract.test.mjs`; `demo/smoke_glow.mjs` и `demo/smoke_glow_blending.mjs` также зелёные. Детерминированная golden-матрица v7 снята локально полностью: 34/34 сценария без runtime-ошибок, build fingerprint `82ddcb9a6909d1bf624e4a95e511d9c15a6adbab6ae6082cd0e31472c49ad56a`. Windows-кандидат `lighting-opaque-glow-two-doorways-dark` имеет SHA-256 `b0bbb9949e661f0f46b27ea018f9bd0e1485b7e8beb30e7c41af20f83f85ae10`, но служит только диагностическим предпросмотром: владельцем не утверждён и не заменяет авторитетный Linux CI artifact. До закрытия #71/#72, owner approval полного Linux artifact и записи авторитетного baseline SHA реализация continuity controller не начинается. Отдельный frame-sequence baseline будет создан уже на этапе 5 из утверждённого статического renderer baseline, а не подменяет этот gate.

### Этап 1. Наблюдаемость и state machine

- Расширить существующие module-scope `pageHiddenAt`/`pageLongResumeEvent` единым document-level resume token без параллельного lifecycle-механизма.
- Добавить общий controller и trace.
- Убрать `hpresume` как механизм штатного скрытия только в обычном View; kiosk/редакторы покрыть сохранением ресурсов и frame state.
- Добавить no-op guards в ResizeObserver/refit и visibility path.
- Покрыть unit tests.

### Этап 2. Atomic structural/live frames

- Разделить visible/candidate frame references.
- Добавить adoption config/layout по паре `revision + content fingerprint`.
- Ввести typed immutable `RenderDeviceSnapshot`; заморозить только presentation-данные live devices, не service runtime.
- Добавить paint barrier.

### Этап 3. Assets и Glow capability

- Перенести signer cache в connection/document scope.
- Добавить asset loaded/decode readiness.
- Дополнить существующий document promise-cache синхронным resolved blend result и читать его до первого visible render.
- Расширить warm placement memo только необходимыми fingerprints/snapshots.

### Этап 4. Статическая карточка и overlay fallback

- Подключить `houseplan-space-card` к общему контракту.
- Реализовать delayed overlay, локализацию и a11y.
- Добавить offline/error fallback.

### Этап 5. Lifecycle/pixel QA

- Добавить deterministic smoke fixture.
- Добавить обязательный 30-frame rAF state sampler и отдельный CDP screencast профиль.
- Провести manual checks desktop/Android/Companion.
- Только после этого закрывать issue #73.

Этапы являются порядком разработки, а не разрешением выпускать промежуточное пользовательское поведение. В beta должен попасть законченный continuity contract либо явно ограниченный, протестированный slice без нового мигания.

## 19. Риски и меры

| Риск | Мера |
|---|---|
| Пользователь кратко видит старое состояние устройства | Осознанно принято; actions используют live runtime, новый snapshot коммитится сразу после готовности |
| Shared signer cache смешает разные HA sessions | Scope cache по connection/backend identity, очистка при смене authority |
| Последний полноценный кадр удерживает большой объём памяти | Immutable render snapshot без полного `hass`; bounded LRU/TTL assets |
| Overlay скроет план слишком часто | Строгие три условия из 8.7, delay и automated negative tests |
| Atomic commit усложнит Lit reactivity | Controller хранит tokens/references, но не дублирует business model; внедрение по этапам |
| Browser всё равно пересоберёт GPU layer | Не менять одновременно DOM/resource/blend; rAF sampler ловит render-state, CDP screencast — наблюдаемый пиксельный артефакт |
| Remote config конфликтует с локальной правкой | Сохранить существующие flush/defer/conflict правила; candidate не имеет права обходить их |
| Static и full cards снова разойдутся | Общие controller/cache и единый набор contract tests |

## 20. Документация после реализации

Обновить:

- `docs/ARCHITECTURE.md` — visual frame, shared asset cache, revision-aware revalidation;
- `docs/WARM-REMOUNT.md` — связь существующего module-scope placement memo с continuity controller без второго warm-механизма;
- `docs/TESTING.md` — lifecycle smoke, обязательный rAF sampler и CDP screencast профиль;
- `docs/STATUS.md` — фактический статус и ограничения;
- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` — пользовательский результат без внутренних деталей.

## 21. Зафиксированные решения

1. Визуальная непрерывность важнее мгновенной актуальности live-состояний.
2. Кратко устаревшее состояние устройства допустимо.
3. Stale frame лучше loading/пустого/чёрного промежуточного кадра.
4. Recovery overlay — редкий fallback, а не штатное поведение long resume.
5. Текст про восстановление подключения показывается только при подтверждённой проблеме соединения.
6. Модель House Plan не меняется.
7. Реализация должна быть общей для обеих карточек.
8. Критерий качества — отсутствие артефакта в последовательности кадров, а не только корректный конечный DOM.
9. Config/layout сравниваются по паре `revision + content fingerprint`; при конфликте одинаковой revision содержимое не игнорируется.
10. Покадровый CI-контракт доказывается in-page rAF sampler, а pixel-level контракт — CDP screencast, не циклом Playwright screenshots.
11. Реализация начинается только после закрытия #67, #71, #72 и переутверждения golden baseline.
12. Новый controller расширяет существующий warm/visibility lifecycle и не создаёт параллельную систему возврата.
