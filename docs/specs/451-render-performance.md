# ТЗ #451 — фильтрация render и лёгкий live-слой взаимодействий

- **Issue:** https://github.com/Matysh/houseplan-card/issues/451
- **Редакция:** первая редакция для независимого ревью; статус определяется только метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 10/10; ценность для разработки 10/10;
  сложность и риск 9/10
- **Область:** общий lifecycle `houseplan-card`, HA render snapshot и registry,
  View, редакторы Плана/Устройств/Подложки, камера и continuous interactions,
  diagnostics, performance harness
- **Модель данных:** без новых полей, миграции и backend-изменений
- **Связано:** #34, #82, #137, #156, #380, #396, #449,
  `demo/performance/README.md`

## 1. Сценарий

**Персона:** администратор дома, который использует средний или большой план в
Home Assistant на desktop, планшете или настенной панели.

**Поверхности и момент:** обычный View и все три редактора во время движения
мыши, pan/pinch/zoom, рисования, размещения, перетаскивания, вращения или
resize; также обычная работа карточки, когда HA присылает фоновые state ticks.

На измеренном плане с 5 пространствами, 139 маркерами и 144 устройствами один
полный update занимает десятки миллисекунд. Hover запускает его почти на каждое
движение указателя, pan дал 76 полных updates за четыре протяжки, а нерелевантные
HA ticks продолжают делать ту же работу в покое. Пользователь видит рывки и
замирания вплоть до 451 мс, хотя неподвижная уже нарисованная сцена сама по себе
не требует постоянной работы.

## 2. Что человек увидит до и после

**До:** план отстаёт от указателя, hover и редакторские preview дёргаются, а
фоновые изменения посторонних HA entities могут вызвать заметный фриз.

**После:** тот же план, те же эффекты и те же результаты действий двигаются
плавно; HA-изменения, относящиеся к плану, остаются актуальными, а посторонние
изменения не заставляют карточку заново строить всю сцену.

Преднамеренных визуальных изменений нет. После завершения любого жеста
канонический итог и итоговый кадр совпадают с текущим поведением.

## 3. Проблема и установленные причины

### 3.1 Диагностика находится в горячем render-path

`_renderBody()` безусловно вызывает `houseplanDiagnostics()`. Метод снова
обходит все сохранённые HA-привязки и вызывает `_bindingStatus()` для каждой,
хотя render использует результат лишь в трёх диагностических `data-*`
атрибутах корневого `ha-card`. На боевом плане это 99 resolutions и около
20–27 мс на каждый render во всех четырёх режимах.

Проверенный на живой странице cache одного результата уменьшил стоимость
принудительного render примерно вдвое, а суммарные Long Tasks pan — на 70 %.
Однако cache «навсегда» неверен: значения должны меняться при изменении
registry, config или доступности привязки.

### 3.2 Continuous state реактивно перестраивает всю карточку

`_view`, `_zoom`, hover, draft и большая часть drag/preview state объявлены Lit
state. Их изменение на каждом pointer/animation step планирует полный проход
`HouseplanCard.render()`: комнаты, стены, проёмы, декор, Glow, солнце,
устройства и подписи строятся заново, хотя между соседними шагами меняется
только камера или небольшой интерактивный слой.

Уже существующий fast path initial Plan snap hover решает один частный случай,
но не создаёт общего контракта для View и редакторов.

### 3.3 Любой новый объект `hass` считается причиной render

Карточка не отличает изменение используемой планом entity от изменения одной
из сотен посторонних entities. Вместе с render сейчас выполняется и
операционная обработка HA snapshot: registry authority, reconnect/load,
activity и vacuum histories, device rebuild и visual-continuity snapshot.
Просто вернуть `false` из `shouldUpdate()` недостаточно: это могло бы убрать
видимый render вместе с обязательной обработкой входящего состояния.

### 3.4 Performance gate проверяет другие сценарии

Абсолютные `hardMaxMs` уже есть. Пробел состоит не в отсутствии абсолютного
механизма, а в сценариях: `panZoomMs` измеряет один wheel transition,
`stateUpdateMs` меняет участвующую entity, а настоящий drag, View hover,
нерелевантный HA tick и количество тяжёлых render-проходов не проверяются.
Постоянно дорогой путь поэтому может быть одинаковым в base и candidate и
оставаться зелёным.

## 4. Scope

В issue входят:

1. Разделение приёма каждого нового `hass` snapshot, операционной обработки и
   решения о визуальной инвалидизации.
2. Явный dependency projection всех HA данных, которые использует план или
   открытая UI-поверхность, и пропуск полного render для нерелевантного tick.
3. Cache статической части diagnostics с точной инвалидизацией; публичный
   support-report и три `data-*` атрибута остаются актуальными.
4. Единый lightweight live-interaction путь для камеры, hover и непрерывных
   preview во View и трёх редакторах.
5. Coalescing pointer/animation updates до не более одного лёгкого paint на
   animation frame без повторной шаблонизации тяжёлой сцены.
6. Один полный reconciliation render после commit/cancel жеста; применение
   последнего отложенного релевантного HA snapshot в том же итоговом кадре.
7. Сохранение desktop, touch/pen, flat/hidden-iso, kiosk, fixed-floor,
   visibility/reconnect и lazy-runtime контрактов.
8. Новый performance-профиль или совместимое расширение harness с настоящими
   pointer series, абсолютными потолками, Long Task и структурными assertions.
9. Unit, targeted smoke, canonical screenshots/golden и release artifacts.

## 5. Non-scope

Не входят:

- изменение внешнего вида комнат, стен, проёмов, устройств, подсказок, Glow,
  солнечных лучей, пылесосов, декора или hidden iso;
- изменение hit areas, snap tolerance, grid, gesture thresholds, animation
  duration/easing, click/double-click/long-press или commit/cancel semantics;
- виртуализация SVG/DOM, spatial index, изменение числа отображаемых объектов;
- оптимизация конкретных geometry algorithms, room labels или decor renderer,
  кроме прекращения их повторного вызова без причины;
- изменение persisted config/layout, websocket/backend API, schema,
  import/export или миграция данных;
- ослабление существующих relative/absolute performance budgets;
- публичная настройка, feature flag или новое пользовательское сообщение.

## 6. Контракт входящих HA snapshots

### 6.1 Приём не равен render

Каждое присваивание `card.hass = next` обязано обновить актуальную ссылку на HA
и пройти безопасный intake, даже если visual render не нужен. Intake продолжает:

- отслеживать connection/reconnect и registry authority;
- запускать начальную/повторную загрузку, когда она требуется;
- поддерживать device roster, finite activity runtime и vacuum telemetry/trail;
- обновлять данные, которыми воспользуются event handlers и HA service calls;
- поддерживать visual-continuity lifecycle без публикации половины кадра.

Пропуск visual render не имеет права пропустить подписку, history point,
terminal activity edge, vacuum sample, reconnect или capability change.

### 6.2 Dependency projection

Для решения о render существует один канонический набор зависимостей, а не
отдельные списки в фильтре и в renderer. В него входят как минимум:

- entity/device/area bindings всех сохранённых маркеров и их `controls`;
- room temperature/humidity sources;
- opening contact/lock references;
- entities в live-text;
- `sun.sun`, light/Glow sources, vacuum source/map/telemetry references;
- entities и registry metadata, необходимые открытому dialog/picker/info card;
- active/disabled/removed registry resolution для bindings;
- top-level HA значения, влияющие на язык, локаль, units, theme, user/write
  permissions, capabilities, connection и frontend formatting.

Entity state считается изменившимся, если для dependency id изменилось
наличие или identity соответствующего HA state object. Это включает изменение
`state`, attributes, timestamps и unavailable/recovery без дорогого deep
comparison. Изменение нерелевантной entity не инвалидирует visual frame.

Dependency set пересобирается после config/layout/marker/space/dialog/registry
изменения до следующего решения о фильтрации. Если классификатор не может
доказать нерелевантность snapshot, он fail-open: разрешает render.

### 6.3 Обычный режим и активный жест

- Вне continuous interaction релевантный HA snapshot публикуется без новой
  намеренной задержки — в обычном ближайшем Lit update.
- Нерелевантный HA snapshot не вызывает `HouseplanCard.render()` и не меняет
  тяжёлый DOM, но становится актуальным для последующих действий и intake.
- Во время активного pan/pinch/resize/drag/draft релевантный HA snapshot не
  прерывает лёгкий live paint. Сохраняется только последний snapshot; сразу
  после `pointerup` или `pointercancel` он входит в единственный итоговый full
  render. Промежуточные snapshots не проигрываются кадр за кадром.
- `lostpointercapture`, уход со страницы, смена mode/space и structural config
  change завершают либо отменяют interaction штатным общим terminal path и не
  оставляют pending snapshot навсегда. Структурное изменение не откладывается,
  если продолжение жеста с ним небезопасно.
- HA actions и safety checks всегда читают последний принятый `hass`, а не
  отложенный visual snapshot.

## 7. Контракт diagnostics cache

1. Полный обход marker bindings не выполняется из `_renderBody()` и не
   повторяется на camera/hover/editor pointer step.
2. Cache хранит статический результат registry diagnostics и binding counts.
   Он инвалидируется при изменении marker/config binding lifecycle, registry
   revision/authority, active/disabled/removed metadata или наличия state,
   влияющего на binding status.
3. Обычное изменение значения уже доступной entity не инвалидирует binding
   counts, если её классификация `active/ha_disabled/orphaned/unverified` не
   могла измениться.
4. Три корневых атрибута сохраняют текущие имена и значения:
   `data-ha-registry-access`, `data-ha-disabled-bindings`,
   `data-ha-unverified-bindings`.
5. Публичный `houseplanDiagnostics()` сохраняет форму и redaction. Динамический
   `lastSuccessAgeMs` вычисляется в момент вызова поверх cached core; для его
   роста не запускается timer и не инвалидируется plan render.
6. После invalidation новый результат вычисляется не более одного раза до
   следующей смены dependency, независимо от количества render requests.

## 8. Контракт lightweight live-interaction слоя

### 8.1 Граница тяжёлой сцены

Тяжёлая сцена — room fills/outlines, physical walls, openings, saved decor,
Glow/sun, device faces, room labels, vacuum trails и hidden-iso geometry — не
перешаблонизируется из-за очередного pointermove или camera animation frame.
Её DOM identity сохраняется в пределах interaction, если нет отдельной
структурной причины для rebuild.

Вызов `HouseplanCard.render()` считается full render независимо от того, дал ли
Lit затем минимальный DOM diff. Рендер отдельного lightweight child/layer full
render карточки не считается.

### 8.2 Камера

Pan, pinch, wheel/camera transition, zoom buttons, room focus и double-fit
обновляют все участвующие SVG `viewBox`, HTML overlay projection и зависящие от
камеры размеры согласованно в одном RAF-coalesced live paint. Flat и hidden iso
не расходятся; tooltip, device layer, room labels, locks, measure labels,
vacuum puck и editor chrome остаются совмещены с планом.

Canonical `_view`/`_zoom` продолжают отражать реально показанный кадр, чтобы
retarget/cancel/persistence контракты #82/#396/#449 не получили stale start.
На terminal state выполняется один full reconciliation render и штатное
сохранение viewport там, где оно происходило раньше.

### 8.3 Hover

Принятый владельцем Q2 включает обычный hover:

- room fill/physical outline и room tooltip сохраняют нынешние content,
  visibility, pointer modality и настройку отключения tooltip;
- device tooltip/LQI/temperature/humidity и текущие CSS hover states остаются;
- координата tooltip может обновляться каждый RAF, не вызывая full render;
- leave, touch suppression, mode/space switch, visibility change и removal
  очищают lightweight hover без ghost overlay;
- hover никогда не меняет config/layout и не делает websocket writes.

### 8.4 Редакторские continuous interactions

Один и тот же принцип применяется ко всем состояниям, которые меняются на
pointermove до commit:

| Поверхность | Live-содержимое |
|---|---|
| План | wall chain/rubber-band, snap/conflict marker, column/opening preview и dimensions, wall/room resize preview и measurements, physical move/rotate |
| Устройства | marker drag/position preview, align guides и связанный tooltip |
| Подложка | line/shape draft, decor/furniture/image move/resize/rotate, placement preview, backdrop transform и measurements |

Pointermove меняет только соответствующий lightweight layer или transform.
Pointerup сохраняет тот же canonical результат, history entry и write, что до
#451; cancel восстанавливает то же исходное состояние и не создаёт write.
Pointerdown может выполнить отдельный full render, если действительно меняет
selection/tool UI, но последующие move-события не повторяют его.

Все movement sources coalesce: между двумя animation frames применяется
последняя позиция, но commit повторно использует последнюю canonical event
coordinate/state, поэтому coalescing не теряет конечную точку.

## 9. UX, touch и accessibility

- Внешний вид до/после settled state должен быть pixel-equivalent с текущим
  `dev`; намеренных golden diffs нет.
- Mouse, touch и pen сохраняют pointer capture, pan threshold, pinch ownership,
  click suppression и `pointercancel` поведение.
- Hover остаётся только на устройствах с fine hover capability; touch не
  получает синтетический ghost hover.
- Keyboard/Escape/Ctrl+Z и focus order не меняются.
- Reduced motion сохраняет atomic camera result; forced colours, dark/light,
  kiosk, fixed-floor и read-only не получают отдельной ветки поведения.
- Новых текстов, контролов, ARIA-элементов и i18n keys нет.

## 10. Модель данных, совместимость и безопасность

- Persisted config/layout и backend payload не меняются; migration/write-back
  отсутствуют.
- Старые планы автоматически получают ускорение после обновления frontend.
- Оптимизация не изменяет HA service calls, permission checks, destructive
  confirmations, registry redaction или support-report contents.
- Не вводятся worker, network request, dependency или глобальный shared cache
  между экземплярами карточки.
- Несколько карточек на dashboard имеют независимые interaction queues,
  dependency sets и diagnostics cache.
- Disconnect удаляет RAF/listener/observer и pending interaction state; warm
  remount не переносит незавершённый gesture в новый экземпляр.

## 11. Performance и наблюдаемость

### 11.1 Новый профиль

Добавляется отдельный `large-house-interaction-v1` на существующем
детерминированном large-house fixture, чтобы не менять смысл
`large-house-v1`. Один runner/harness обязан оставаться способен измерить base
до #451 и candidate; новые private поля сначала объявляются optional с честным
fallback либо счётчики собираются внешним instrumentation.

После warm-up профиль выполняет:

1. 120 View hover moves по room/device/miss;
2. четыре pan drag по 20 moves и terminal pointerup;
3. camera wheel/transition и pinch series;
4. не менее трёх representative editor series: Plan draw/snap, room resize и
   Decor furniture/shape transform; targeted smoke покрывает остальную матрицу;
5. 30 нерелевантных HA ticks и один релевантный tick;
6. релевантный HA tick в середине drag с проверкой deferred-last-wins frame.

### 11.2 Структурные assertions

Для измерительного окна после начального settled frame:

- 120 hover moves: **0** full renders;
- каждое pan/pinch/editor move-series: **0** full renders между start и terminal
  event и не более **1** terminal full render;
- 30 нерелевантных HA ticks: **0** full renders;
- один релевантный HA tick вне gesture: ровно **1** full render;
- несколько релевантных ticks внутри gesture: **0** промежуточных и ровно
  **1** terminal full render с последним состоянием;
- camera/hover/editor windows: **0** полных marker-binding diagnostic scans;
- static heavy-scene node identity/count, config, layout и websocket writes
  остаются стабильны; preview commit/cancel checks выполняются отдельно.

Assertions fail the runner независимо от timing result. RAF paints и renders
выделенного lightweight child считаются отдельными метриками и не маскируются.

### 11.3 Абсолютные цели

Для профиля при тех же CI browser/runtime условиях задаются base-relative
пределы и следующие bootstrap `hardMaxMs`. Они намеренно существенно ниже
опубликованного в issue времени полных updates одного pan-сценария — 3 432 мс —
и согласованы с существующим `panZoomMs: 500 ms`. Для hover потолок 500 мс на
120 moves означает в среднем не более 4,2 мс на событие против замеренных в
issue 98,9 мс на полный update:

| Метрика | Абсолютный потолок |
|---|---:|
| 120 View hover moves | 500 мс |
| 4 × 20 pan moves + terminal | 500 мс |
| wheel/pinch camera series | 500 мс |
| 120 representative editor moves + terminal | 750 мс |
| 30 нерелевантных HA ticks | 250 мс |

Для каждого pointer-series дополнительно: `maxSingleLongTaskMs <= 150`,
`longTaskTotalMs <= 300`, `longTaskCount <= 3`. Эти потолки — bootstrap safety
limits, а не разрешение расходовать весь budget; relative comparison остаётся.
Ослабление существующих budgets запрещено. Первый paired Linux artifact должен
быть описан в review/release evidence; ужесточение после него допустимо отдельной
обоснованной правкой, ослабление — только через новый review.

## 12. Acceptance criteria

- **AC1 (`unit` + code review; разработчик/ревьюер):** HA intake отделён от
  visual invalidation; нерелевантный snapshot обновляет актуальный `hass` и
  lifecycle/history, но не вызывает `HouseplanCard.render()`.
- **AC2 (`unit` + targeted smoke; разработчик):** изменение каждой категории
  dependency из §6.2 вызывает актуальный render, а изменение посторонней entity
  — нет; unknown classifier path fail-open и не оставляет stale UI.
- **AC3 (`unit` + targeted smoke; разработчик):** activity/vacuum samples,
  reconnect/load, registry subscription, permissions и action safety работают
  при серии skipped visual ticks; action использует последний `hass`.
- **AC4 (`unit` + smoke; разработчик):** diagnostics binding scan отсутствует
  в render/pointer path, cache инвалидируется по §7, три `data-*` атрибута и
  redacted public report актуальны, `lastSuccessAgeMs` растёт без repaint timer.
- **AC5 (`smoke` + performance; разработчик):** View hover, pan, pinch,
  wheel/camera animation и double-fit соблюдают render-count assertions §11.2;
  все SVG/HTML/iso layers остаются совмещены на каждом captured frame.
- **AC6 (`smoke` + performance; разработчик):** Plan draw/snap/opening/column,
  physical move/rotate, room resize, device drag, decor draft/move/resize/rotate,
  furniture/image placement и backdrop transform не вызывают full render на
  каждый move; terminal commit/cancel даёт один согласованный full frame.
- **AC7 (`unit` + smoke; разработчик):** серия relevant HA updates во время
  gesture применяет только последний snapshot сразу после всех terminal paths;
  irrelevant updates не создают pending render.
- **AC8 (`unit` + smoke; разработчик):** coalescing сохраняет конечную pointer
  coordinate, snap/geometry result, history, save count, pointer capture,
  cancel/undo и no-extra-write контракты для mouse/touch/pen.
- **AC9 (`golden` + canonical screenshots; разработчик/владелец):** settled
  View, hover/tooltip, все три редактора, dark/light, forced colours, kiosk,
  fixed-floor и hidden iso не имеют непредусмотренных pixel diffs; screenshots
  приложены к handoff/review.
- **AC10 (`performance`; разработчик):** новый interaction profile проходит
  все structural, absolute и base-relative checks §11; прежние ordinary,
  isometric, plan-snap и Glow profiles проходят без ослабления budgets.
- **AC11 (`typecheck` + `unit` + `build`; разработчик):** implementation-loop
  gates зелёные; перед beta зелёные golden, smoke и performance по runbook;
  Linux CI остаётся каноном полного HA harness.
- **AC12 (`schema/backend/i18n review`; ревьюер):** persisted model, backend,
  import/export, HA API, i18n strings и dependencies не изменены; новые caches
  bounded per card и очищаются при disconnect.
- **AC13 (`documentation review`; разработчик/ревьюер):**
  `demo/performance/README.md` описывает новый профиль, counters, budgets и
  локальный запуск; оба changelog содержат пользовательский эффект со ссылкой
  на #451.

## 13. План автотестов

### 13.1 Unit

- pure dependency classifier: relevant/irrelevant/missing state, attributes,
  all source kinds, top-level locale/theme/units/user/connection and fail-open;
- dependency-set rebuild после marker/config/dialog/registry changes;
- HA intake с skipped render: activity terminal edge, vacuum sample, reconnect,
  latest action snapshot и no duplicate processing;
- gesture gate state machine: begin/update coalescing/end/cancel/forced cancel,
  latest-relevant-wins и irrelevant-no-pending;
- diagnostics cache keys, one scan per invalidation, state-presence transition,
  dynamic age и redaction;
- camera live projection: clamp, anchor, retarget, persistence and cleanup.

### 13.2 Targeted production-bundle smoke

Инструментировать full render count, lightweight paints, diagnostics scans,
heavy node identity, writes и visible state. На production bundle пройти:

- room/device/miss hover and leave;
- mouse pan, wheel, pointercancel; touch pan/pinch and lost capture;
- #449 double-fit и interrupted/retargeted camera transition;
- матрицу interactions из AC6 с несколькими move events, commit и cancel;
- relevant/irrelevant HA ticks вне и внутри gesture;
- space/mode switch, visibility hide/show, disconnect/reconnect и warm remount;
- flat/iso, normal/fixed-floor/kiosk/read-only.

Synthetic events обязаны доходить до production handlers; `0` событий у
handler не принимается как доказательство `0` renders.

### 13.3 Golden, performance и release

- implementation loop: `npm run typecheck`, `npm test`, `npm run build`;
- после изменения `src/**` — canonical screenshots по workflow из `PROCESS.md`
  §8 (`demo/docs/capture.mjs`, затем только после проверки `npm run docs:accept`),
  inspection и существующие golden; любой diff исследуется;
- перед beta — полный smoke/golden/performance gate по runbook;
- full performance сравнивает candidate/base на одном Linux runner и публикует
  отдельный interaction artifact со structural diagnostics;
- три bundle snapshots после release build должны совпадать.

## 14. План реализации и затрагиваемые файлы

Ожидаемые точки изменения:

1. `src/houseplan-card.ts` — HA intake/visual invalidation, diagnostics cache,
   gesture terminal reconciliation и подключение live layers.
2. Новый либо существующий узкий `src/*render*`/`src/*interaction*` module —
   pure dependency classifier, bounded state machine и RAF scheduler; точные
   имена не являются контрактом.
3. `src/houseplan-editor-runtime.ts` — маршрутизация continuous editor previews
   в lightweight invalidation без изменения canonical commit logic.
4. Unit tests для classifier/cache/controller и regression tests существующих
   camera/editor controllers.
5. Targeted `demo/smoke_*.mjs` — production-bundle render-count и interaction
   matrix; обновление smoke runner/package scripts при необходимости.
6. `demo/benchmark_large_house.mjs`, `demo/performance/card-contract.mjs`, новый
   budget/profile и evaluator/report plumbing — `large-house-interaction-v1`.
7. `demo/performance/README.md` и оба changelog.

Реализация сначала выделяет pure contracts и diagnostics cache, затем HA
filter, затем camera/hover live path, затем редакторские consumers. Нельзя
массово снять `state: true`, пока у каждого изменяемого состояния нет
проверенного live paint и terminal reconciliation path.

## 15. Release-артефакты

Изменение пользовательски заметно как исправление зависаний, поэтому основной
implementation commit имеет `User-Visible: yes` и в том же коммите обновляет:

- `docs/CHANGELOG.md`;
- `docs/CHANGELOG.ru.md`.

Также обновляются:

- `demo/performance/README.md`;
- budget/profile и machine-readable performance report;
- canonical screenshots/golden evidence без ожидаемого визуального изменения;
- targeted smoke artifacts и full performance comparison.

Новые user-guide/i18n/security artifacts не требуются. Выпуск — обычной beta
по разделу 8 release runbook; issue не закрывается автором реализации.

## 16. Риски и снижение

| Риск | Вероятность / ущерб | Снижение |
|---|---|---|
| Фильтр ошибочно считает relevant HA tick посторонним | средняя / высокий | единый dependency authority, fail-open, матрица всех consumers и dialog states |
| Пропуск render одновременно пропускает activity/vacuum/reconnect intake | высокая / высокий | отдельный intake contract и тесты серий skipped ticks |
| Lightweight DOM расходится с canonical state | средняя / высокий | один state machine, last-event commit и обязательный terminal reconciliation |
| Несколько SVG/HTML/iso слоёв получают разные camera frames | средняя / высокий | один atomic projection writer и frame screenshots |
| Gesture оставляет pending HA/RAF после cancel/disconnect | средняя / высокий | единый terminal cleanup и lifecycle matrix |
| Child render формально скрывает прежнюю тяжёлую работу | средняя / средний | отдельные full/light counters, heavy-node identity и timing gate |
| Новый harness ломает сравнение со старым base | средняя / высокий | новый profile id, optional contract/fallback и тест candidate/base |
| Слишком мягкий timing budget снова пропускает проблему | средняя / высокий | structural assertions обязательны; absolute + relative gates, paired artifact review |

## 17. Откат

Откат — revert implementation commit(ов) #451 и нового interaction profile.
Данные и backend не требуют rollback/migration. Если дефект найден только в
одном live interaction, допускается временно вернуть этому interaction прежний
reactive path отдельным аварийным commit, не отключая безопасный diagnostics
cache и HA filter, но такой fallback обязан иметь issue и regression proof.

## 18. Принято предположительно, поменять свободно

Ниже технические решения, не являющиеся продуктовым выбором владельца:

- dependency projection может переиспользовать `RenderDeviceSnapshot`, но имеет
  один источник истины и включает зависимости всего сохранённого плана;
- lightweight слой может быть Lit child component, imperative DOM projection
  или их комбинацией, если full/light counters и cleanup contracts соблюдены;
- public diagnostics складывается из cached static core и динамического age;
- точные private field/helper names и разбиение unit/smoke файлов свободны;
- representative editor cases живут в performance profile, полная матрица — в
  deterministic smoke, чтобы timing fixture не превращался в функциональный
  e2e-комбайн.

Продуктовые решения владельца не предположительны: Q1 — relevant HA updates во
время жеста применяются последним итоговым кадром; Q2 — обычный hover входит в
#451 и сохраняет текущие эффекты через lightweight слой.
