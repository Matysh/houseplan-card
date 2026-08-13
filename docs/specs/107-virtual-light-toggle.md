# Issue #107 — переключение виртуального источника света «Всегда»

- **Issue:** https://github.com/Matysh/houseplan-card/issues/107
- **Редакция:** первая редакция для независимого ревью; статус задачи определяется
  только метками issue
- **Тип / приоритет:** feature + polish / P2
- **Оценка:** пользовательская ценность 6/10; ценность для разработки 3/10;
  сложность и риск 7/10
- **Область:** View-action, canonical light resolver, target preview, backend
  operational state, multi-card live-sync, i18n, compatibility и тесты
- **Связано:** #65, #84, #88, #94, #97, `docs/SCOPE.md`,
  `docs/TOUCH-SUPPORT.md`, `docs/LIGHT.md`,
  `docs/CONFIG-COMPATIBILITY.md`

## 1. Сценарий и продуктовый контекст

**Персона:** home admin либо домочадец, который пользуется обычным View на
настенной панели, телефоне или desktop dashboard. Право редактировать план для
этого действия не требуется.

**Поверхность и момент:** на плане есть virtual marker, у которого роль источника
света явно установлена в «Всегда», а действие по нажатию — «Переключить
состояние». Пользователь нажимает marker, чтобы погасить или снова включить
изображённый виртуальный светильник.

Задача обслуживает:

- **J1:** Glow, room fill и room light statistics показывают одно текущее
  пространственное состояние;
- **J3:** очевидное безопасное действие выполняется прямо с плана;
- гарантированный touch/View/kiosk-контракт: tap работает так же, как click, и
  результат не расходится между настенной панелью, телефоном и второй карточкой.

Это утверждённое владельцем узкое исключение к замороженной функциональности
virtual devices. Оно не создаёт общего state engine для виртуальных маркеров и
не меняет их роль placeholder в остальных комбинациях.

## 2. Что человек увидит до и после

**До:** диалог честно сообщает, что переключаемого состояния нет, а нажатие в
View является тихим no-op. Passive `Always` source без контроллера всегда
считается включённым по контракту #84.

**После:** в точной утверждённой комбинации preview показывает сам виртуальный
источник, его текущее состояние и следующий эффект. Нажатие выключает его, а
повторное включает. Одновременно меняются его Glow и все room-light consumers.
Результат сразу видят другие карточки и он сохраняется после reload страницы и
restart Home Assistant.

## 3. Подтверждённая причина текущего поведения

1. `resolvedLightSources()` создаёт для passive `Always` источник с identity
   `marker:<id>`, пустыми `stateEids`/`serviceEids` и default `on`.
2. Если сохранены incoming controller links, #84 заменяет default на OR их HA
   driver entities. Ручного состояния у источника нет.
3. `resolveToggleIntent()` ищет только HA service target. Virtual marker без
   actionable entity получает `no-actionable-entity`.
4. `_clickDevice()` выполняет только HA service command и при его отсутствии
   намеренно ничего не делает.
5. Hint в диалоге форматирует тот же resolved intent и поэтому показывает
   `marker.toggle_none_no_actionable_entity`.

Локальная ветка только в renderer не подходит: #84 закрепил
`resolvedLightSources()` как authority для Glow, room fill, room state,
`N из M`, room card и preview. Локальный browser state также нарушил бы принятое
решение о reload/restart и multi-card synchronization.

## 4. Решения владельца

Владелец принял defaults Q1–Q3 14.08.2026. Каноническая запись:
https://github.com/Matysh/houseplan-card/issues/107#issuecomment-5287719167

1. Состояние общее для всех карточек, live-синхронизируется, переживает reload
   страницы и restart Home Assistant. Источник без сохранённой записи начинает
   в `on`, сохраняя совместимость с #84. State является operational data и не
   входит в конфигурацию плана или export.
2. Переключается canonical state источника, а не один SVG Glow. Вместе меняются
   Glow, room light fill, room statistics/card и preview. Геометрия, цвет,
   яркость и радиус не меняются.
3. Пока действует точная тройка `binding=virtual` + `is_light=true` + effective
   `tap_action=toggle`, ручное состояние авторитетно; incoming controller links
   сохраняются, но не управляют этим источником. Когда тройка перестаёт
   действовать, ручная запись удаляется и немедленно возвращается обычная
   семантика #84. Повторное включение тройки начинает с `on`.

## 5. Точное условие исключения

Manual virtual-light action существует только для активного marker, у которого
одновременно выполняется:

1. `marker.binding === 'virtual'`;
2. `marker.is_light === true`;
3. effective tap action равен `toggle`;
4. marker не является удалённым tombstone (`removed !== true`).

Для virtual marker нет HA domain, который мог бы неявно спроецировать default
`toggle`, поэтому сохранённый action token обязан быть `toggle`. Backend всё
равно проверяет persisted config, а не доверяет утверждению frontend.

`hidden: true` временно убирает источник из визуальных consumers, но не стирает
его ручное состояние: возврат видимости восстанавливает прежний `on/off`.

В точной тройке manual target имеет приоритет действия. Tap переключает только
состояние собственного virtual source и не вызывает HA service даже при наличии
сохранённых outgoing `controls`. Сами `controls` остаются lossless и продолжают
участвовать в light graph по правилам #65/#84. После выхода из тройки обычный
resolver #94 снова получает их без изменения.

Все прочие сочетания — virtual Auto/Never, non-virtual Always, другое действие,
удалённый marker — сохраняют текущее поведение без нового state target.

## 6. Нормативная модель состояния

### 6.1. Значение по умолчанию

Отсутствующая запись означает `on`. Поэтому существующие passive `Always`
источники не меняют вид после обновления, а первый tap переводит источник в
`off`.

Хранилище может сохранять только множество выключенных marker IDs: отсутствие
ID является canonical `on`. Это техническая форма, а не новый пользовательский
режим. В ответах frontend получает revisioned snapshot, достаточный для
однозначного восстановления `on/off`.

### 6.2. Один canonical consumer contract

Для eligible marker manual state подменяет только вычисление `source.on`.
Identity, room ownership, position, `castsGlow`, geometry, manual/live colour,
brightness и radius остаются теми же.

Один и тот же resolved source обязан дать одинаковый результат для:

- spatial Glow full card и kiosk;
- light room fill;
- room light state и `resolvedLightStats` / `N из M`;
- room card и device presentation;
- device-editor preview;
- статического `houseplan-space-card`.

Нельзя добавлять manual-state ветку отдельно в SVG renderer, room card,
preview или static card. Runtime snapshot является входом canonical light
resolver, а его revision входит в cache invalidation. Один tap не должен ждать
следующего HA state tick.

### 6.3. Controller semantics

- Для eligible source manual `on/off` выигрывает у incoming controllers.
- Incoming `marker:<id>` links не удаляются, не становятся service targets и не
  меняют HA entities.
- Контроллер продолжает выполнять собственное действие #94, но его HA state не
  меняет manual source, пока тройка активна.
- После выхода target из тройки manual record очищается; incoming links снова
  определяют passive source по OR-контракту #84 без Save со стороны controller.
- Остальные источники того же room продолжают давать независимые votes. Поэтому
  выключенный manual source не обязан погасить комнату, если в ней включён другой
  источник.

## 7. Backend storage и WebSocket contract

### 7.1. Отдельные operational data

State хранится в отдельном versioned Home Assistant `Store`, например
`houseplan.virtual_lights`, а не в `Marker`, layout, Lovelace config,
localStorage-authority или HA entity registry.

Минимальная логическая структура:

- monotonic runtime revision;
- последняя согласованная config revision;
- bounded set/map выключенных eligible marker IDs.

Точные Python class/key names можно изменить. Обязательны отсутствие записи =
`on`, лимит не выше числа markers, отказ от произвольных строк вне live config и
отдельность от export/import payload.

### 7.2. Initial snapshot

`houseplan/config/get` возвращает дополнительное optional поле с revisioned
virtual-light snapshot. Оно читается вместе с той же config revision, по которой
backend проверил eligibility.

Это поле является обязательной частью корректного нового frontend frame:
сохранённый `off` не может сначала отрисоваться как `on` и исправиться только
после необязательной подписки. Старый frontend игнорирует добавочное поле.

Поле optional на wire только для rolling/downgrade compatibility. Новый frontend
при его отсутствии применяет legacy/default `on`; попытка toggle на старом
backend завершается контролируемой ошибкой, без optimistic ложного состояния.

### 7.3. Atomic toggle command

Добавляется один authenticated WS command вида
`houseplan/virtual_light/toggle`, принимающий только `marker_id`.

Backend под общим для config/state load-modify-save lock:

1. загружает текущую config revision и marker;
2. повторно проверяет точное условие §5;
3. читает текущее значение (`on`, если записи нет);
4. атомарно инвертирует его и сохраняет state revision;
5. возвращает `{marker_id, on, rev}`;
6. после успешного save публикует `houseplan_virtual_light_updated` с тем же
   payload.

Клиент не присылает желаемый boolean и не выполняет read→set: две одновременные
команды сериализуются как два toggle, а не теряют одну запись. Event не
публикуется до durable save. Invalid/missing/ineligible marker получает
стабильную ошибку `not_toggleable`; store и event при этом не меняются.

### 7.4. Права

Команда доступна любому аутентифицированному HA-пользователю, которому доступна
карточка. `may_write` и опция admin-only защищают редактирование плана, но не
View-action; иначе утверждённая household/kiosk persona увидела бы рабочий hint
и получила no-op.

Это разрешение уже, чем HA service toggle: request содержит только marker
ID, backend разрешает ровно утверждённую тройку и не вызывает HA service. Guest
без authenticated HA session доступа не получает.

### 7.5. Config coherence и cleanup

Каждый backend writer конфигурации — обычный Save, import apply, optimize/undo,
setup migration и другие пути замены config — согласует operational store с
новой config revision до публикации завершённого config update:

- сохраняет `off` только для marker IDs, которые всё ещё eligible;
- удаляет записи deleted/rebound/Auto/Never/non-toggle markers;
- сохраняет state при rename, move, room/space reassignment, hidden/unhidden и
  несвязанных edits;
- записывает согласованную config revision.

Из-за двух отдельных HA Store файлов crash между saves не может быть общей
транзакцией. Fail-safe правило: если operational store видит неизвестный разрыв
config revision (включая downgrade, старый writer или прерванный save), он
сбрасывает manual-off overrides к безопасному compatibility default `on`, а не
рискует воскресить старый `off` после повторного включения тройки. Следующий
snapshot сохраняет согласованную revision.

Все config writers должны использовать один backend helper; список разрозненных
ручных `state_store.async_save()` не допускается.

## 8. Frontend action и synchronization

### 8.1. Единый resolved intent

Authority #94 расширяется typed operational target, а не обходится ранним
`if` непосредственно в `_clickDevice()` или диалоге.

Для eligible marker resolver возвращает:

- stable target identity `marker:<id>` и читаемое имя marker;
- current `on/off` из принятого runtime snapshot;
- next effect `turn-off` / `turn-on`;
- executable operation `virtual-light-toggle`, отличную по типу от HA service
  command.

Formatter preview/confirmation получает эту же модель. Virtual target никогда
не выдаётся за `entity_id` и никогда не попадает в `callService`.

### 8.2. Tap, click и confirmation

- Обычный tap/click отправляет atomic WS toggle и принимает только response/event
  с revision не старее локального.
- Optimistic визуальный flip запрещён: transport/backend failure не должен
  показывать несохранённое состояние.
- `tap_confirm: true` сохраняет существующий confirmation dialog. Перед
  выполнением eligibility/target re-resolve повторяется; текущий direction
  решает серверный atomic toggle.
- Если marker перестал быть eligible до подтверждения или ответа, action не
  retargets на controls/HA entity. Пользователь получает существующий смысл
  «цель изменилась» либо локализованную контролируемую ошибку.
- Ошибка WS использует локализованный toast и оставляет последний подтверждённый
  state. Page error и unhandled rejection недопустимы.

### 8.3. Live-sync и несколько карточек

Full card подписывается на `houseplan_virtual_light_updated` рядом с текущими
House Plan events. `houseplan-space-card` получает тот же snapshot/event через
module-level shared cache, чтобы N static cards не создавали N fetch/subscription.

Monotonic revision защищает от перестановки response и event. Применение более
новой revision:

1. заменяет immutable runtime snapshot;
2. инвалидирует light/presentation cache;
3. обновляет local server-snapshot cache;
4. просит render без structural config/device rebuild и без HA state mutation.

Missed event после disconnect исправляется следующим `config/get`. Подписка
best-effort не заменяет initial snapshot и не является условием первого полного
кадра.

### 8.4. Local cache

`LS_CFG` может хранить последний revisioned operational snapshot рядом с
config/layout для мгновенного stale-while-revalidate кадра. Он не становится
authority: server response всегда выигрывает по revision/config coherence.

Старый cache без поля означает default `on`. Corrupt/oversized/wrong-shape state
игнорируется целиком, а не частично внедряется в resolver. Runtime event обновляет
cache, чтобы reload не давал краткого обратного Glow flash.

## 9. UX редактора и i18n

В точной тройке прежний текст
`marker.toggle_none_no_actionable_entity` не показывается. Вместо него preview
содержит локализованные строки:

- target: виртуальный источник с именем marker, без вымышленного entity ID;
- current state: «включён/выключен»;
- next effect: «включить/выключить».

Новый несохранённый draft и draft, который только что вошёл в тройку, показывают
initial `on → off`. Редактируемый сохранённый marker показывает server state.
Cancel не меняет operational state; Save меняет eligibility и запускает cleanup
только после принятого config write.

Нужны полноценные RU/EN keys для virtual target/state и ошибки toggle. Нельзя
склеивать предложения или показывать backend error text как готовый перевод.
Существующие HA entity/group/secure/missing hints #94 не меняются.

## 10. Accessibility и touch

Новых controls и focus order нет. Existing device marker, selector,
confirmation и toast сохраняют текущие accessible surfaces.

Touch View и kiosk — блокирующие поверхности:

- один tap выполняет ровно один toggle;
- pan, pinch, long-press и suppressed synthetic click не выполняют action;
- confirmation остаётся доступным и не теряет focus contract;
- live event не перехватывает focus и не создаёт screen-reader spam;
- static card остаётся неинтерактивной, но показывает тот же state.

Touch editor остаётся best effort: новый control не добавляется, а существующий
desktop-first preview должен оставаться читаемым без горизонтального overflow.

## 11. Lifecycle и edge cases

1. Existing eligible marker без state entry: `on`; первый tap → `off`.
2. Повторный tap: `off` → `on`, off-entry может быть удалена.
3. Reload/new browser/restart HA: последнее durable значение восстановлено.
4. Две full cards и static card: одно событие приводит все к одной revision.
5. Два одновременных tap: две server revisions, итог равен исходному состоянию.
6. Response пришёл после более нового event: stale response игнорируется.
7. Incoming controller включён, manual source выключен: source остаётся `off`.
8. Manual source выключен, другой room source включён: room остаётся `on`, stats
   считают голоса раздельно.
9. Outgoing controls есть: manual tap не вызывает их HA services; config
   сохраняется lossless.
10. `Always → Auto/Never`: off-entry очищена, #84/#65 действует сразу.
11. `toggle → info/run/more-info`: запись очищена, новое действие штатное.
12. Virtual → HA binding/rebind: запись очищена и не приклеивается к новой цели.
13. Delete/tombstone: запись очищена; restore/recreate начинает `on`.
14. Rename/move/room/space/hidden: state сохраняется по stable marker ID.
15. Full import сохраняет state только для совпавших всё ещё eligible IDs;
    импорт не приносит state из backup.
16. Config revision gap/downgrade writer: conservative reset к `on`, без stale
    resurrection.
17. Backend unavailable/command failure: confirmed state остаётся, generic no-op
    не маскирует ошибку.
18. Old frontend + new backend: extra snapshot/event игнорируются, config не
    повреждается; marker ведёт себя по старому.
19. New frontend + old backend: default `on`, команда не создаёт local false
    state и заканчивается контролируемой ошибкой.
20. Auto/Never/non-virtual/missing marker request, подделанный вручную: backend
    `not_toggleable`, без save/event/service.

## 12. Модель данных, compatibility и import/export

`Marker`, `ServerConfig`, layout и Lovelace card config не получают новых полей.
Backend `CONFIG_SCHEMA`, import schema и config revision не меняются. Миграция
плана и materialization отсутствуют.

Создаётся отдельный optional operational Store version 1. Его отсутствие при
upgrade/downgrade означает пустой off-set/default `on`. Старые integration и
frontend его не читают и не уничтожают plan config. Config revision gap после
старого writer обрабатывается fail-safe правилом §7.5.

Operational state намеренно не входит в:

- full/space export и import preview/apply;
- marker JSON и compatibility passthrough;
- Lovelace config/local editor draft;
- HA entity/device registry.

Диагностика может показывать version/revision/count, но не обязана экспортировать
полную map marker IDs. `docs/CONFIG-COMPATIBILITY.md` фиксирует wire field,
отдельный Store, old/new matrix и reset-on-unknown-revision.

## 13. Не входит в задачу

- общее переключаемое состояние для virtual devices;
- действие для virtual Auto/Never либо для `info`, `run`, `more-info`;
- создание `input_boolean`, synthetic HA light/entity или helper;
- управление цветом, brightness, radius, geometry или animation через tap;
- запись state в marker config, layout или export backup;
- изменение OR/links semantics #84 вне manual-authority исключения;
- переключение HA entities из exact manual action;
- история состояний, расписания, automations или restoration UI;
- новый editor control «начальное состояние»;
- polling, remote API либо отдельная general-purpose runtime-state platform.

## 14. Критерии приёмки

- **AC1 (`unit`):** eligibility matrix разрешает operational target только для
  active `virtual + is_light:true + explicit/effective toggle`; Auto, Never,
  non-virtual, other action и removed сохраняют прежний resolver #94.
- **AC2 (`backend`):** новый eligible marker без записи возвращает `on`; atomic
  toggle сохраняет `off`, второй сохраняет `on`, увеличивает revision и
  публикует event только после успешного durable save.
- **AC3 (`backend`):** два concurrent toggle одного marker сериализуются без
  lost update; response/event revisions монотонны, итог соответствует двум
  инверсиям.
- **AC4 (`backend` + `ревью кода`):** non-admin authenticated connection может
  выполнить eligible toggle без `may_write`; forged missing/ineligible ID
  получает `not_toggleable`, не меняет store и не вызывает HA service.
- **AC5 (`unit`):** manual `off` является `source.on=false` во всех canonical
  light consumers; incoming controller `on` его не перекрывает, а другой
  независимый room source продолжает влиять на room aggregate.
- **AC6 (`unit` + `ревью кода`):** exact manual intent имеет typed marker target,
  current/next effect и operational operation; marker ID никогда не попадает в
  `hass.states` как entity и в `callService`/`entity_id`.
- **AC7 (`unit` + `smoke`):** диалог exact-комбинации не показывает
  `toggle_none_no_actionable_entity`, показывает virtual target и current/next;
  остальные hints/confirmation #94 не изменились.
- **AC8 (`backend`):** restart/recreation runtime data загружает сохранённый
  `off`; config/get возвращает согласованный revisioned snapshot, достаточный
  для первого `off` frame без ожидания event.
- **AC9 (`backend`):** все config writers сохраняют state для rename/move/
  hidden/unrelated edits и очищают его при role/action/binding/delete change;
  неизвестный config revision gap сбрасывает overrides к `on`.
- **AC10 (`smoke`):** tap/click в full View меняет Glow, room fill и room
  `N из M` вместе; повторный tap возвращает их. Touch pointer выполняет один
  toggle, pan/pinch/long-press не выполняют.
- **AC11 (`smoke`):** две full cards и `houseplan-space-card` принимают один
  server event и показывают одинаковый state; stale response не откатывает
  более новую revision, reconnect/reload исправляет missed event.
- **AC12 (`unit` + `smoke`):** outgoing controls exact marker не получают HA
  service от manual tap; после выхода из тройки прежний resolver #94 получает
  сохранённые controls без потери.
- **AC13 (`unit` + `smoke`):** `tap_confirm` re-resolves stable marker target,
  выполняет server-current atomic toggle и безопасно отказывает, если eligibility
  изменилась до подтверждения.
- **AC14 (`unit` + `ревью кода`):** runtime revision инвалидирует canonical
  light/presentation cache без HA tick, polling и structural config/device
  rebuild; N static cards разделяют cache/subscription.
- **AC15 (`unit` + `build`):** RU/EN parity, malformed cache/store input и
  old/new optional field matrix покрыты; три bundle snapshot после build
  побайтно совпадают.
- **AC16 (`ревью кода`):** оба changelog, RU user guide, README light recipe,
  LIGHT, ARCHITECTURE и CONFIG-COMPATIBILITY описывают точное исключение,
  persistence/permissions и отсутствие export.

## 15. План тестов и доказательств

### 15.1. Frontend unit

1. Eligibility/action matrix AC1/AC6/AC12.
2. Canonical source matrix: default on, manual off/on, controller OR ignored,
   other room sources, hidden and exit from triple.
3. Intent formatter: virtual target/current/next, no fake entity ID, no old
   no-actionable text, confirmation target stability.
4. Runtime snapshot cache: revision ordering, event-before-response,
   reconnect snapshot and malformed local cache.
5. Resolver-cache mutant: removing runtime revision from cache key must make a
   test fail because state would stay stale without HA tick.

### 15.2. Backend

1. Store absence/default, off/on persistence and runtime recreation.
2. Atomic concurrency with controlled interleaving; save/event ordering.
3. Admin and non-admin authenticated connection; invalid marker matrix.
4. Config writer lifecycle for ordinary set, import apply, optimize/undo and
   setup migration path.
5. Config revision gap, corrupt/oversized Store, bounded pruning and save
   failure without false event.
6. Wire compatibility: optional snapshot, old client payload and no config
   schema/export changes.

### 15.3. Browser smoke

Targeted scenario builds one eligible virtual lamp, one incoming controller,
one unrelated room source, two full cards and one static card. It checks
AC7/AC10–AC13 using real click and touch pointer sequences, visible Glow/room
presentation, WS call log, event revisions and zero HA service calls.

Reload starts from server `off` and proves the first committed candidate is
already off. A disconnected card misses an event, reconnects and adopts the
current snapshot. Confirmation race changes config before confirm and proves no
retarget.

По действующему процессу smoke пишется вместе с реализацией, но в цикле
реализации запускаются только typecheck, unit и build. Целевой smoke и полный
browser smoke исполняются перед бетой; reviewer может запустить узкий сценарий
для доказательства AC.

### 15.4. Golden и performance

Golden matrix получает точный on/off virtual-lamp fixture на существующей flat
View сцене; новый художественный baseline не проектируется. Golden verify и
обновление принятого baseline выполняются только на pre-beta gate.

Performance gate должен подтвердить отсутствие polling, дополнительного HA
state subscription, per-source network call и полного config/device rebuild на
event. Отдельный новый численный budget не вводится: операция пользовательская,
state snapshot bounded числом markers, а resolver остаётся frame-cached.

## 16. Security и надёжность

Основной новый trust boundary — authenticated non-admin WS mutation. Он
ограничен следующими правилами:

- marker выбирается только из server config;
- eligibility вычисляет backend;
- command не принимает state, entity ID, service/domain или config fragment;
- payload и persisted set ограничены существующим marker limit;
- одна команда делает одну atomic inversion;
- никакой HA service/file/network action не выполняется;
- failed save не создаёт success response/event;
- revision gap деградирует в `on`, а не в stale manual state.

Lock/alarm invariant `docs/SCOPE.md` не затронут: virtual operational target не
может резолвиться в secure entity или HA service.

## 17. Release-артефакты

Реализационный пользовательский коммит содержит:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #107;
- `docs/USER-GUIDE.ru.md` — рецепт точной тройки, persistence и отличие от
  controller link;
- `README.md` — краткий EN recipe/contract;
- `docs/LIGHT.md` — manual authority в canonical resolver;
- `docs/ARCHITECTURE.md` — operational Store/WS/live-sync boundary;
- `docs/CONFIG-COMPATIBILITY.md` — old/new matrix, config-revision coherence и
  export exclusion;
- frontend unit, backend tests и browser scenario;
- синхронные `dist/houseplan-card.js`,
  `custom_components/houseplan/frontend/houseplan-card.js` и
  `demo/srv/assets/houseplan-card.js`.

Новых migration UI, screenshot документации и отдельного security report не
требуется. Перед бетой идут штатные golden verify, browser smoke и performance
gate по release runbook.

## 18. Откат

Откат — обычный revert frontend/backend изменения, тестов, документации,
changelog и bundle snapshot. Plan config/layout/import formats не меняются.

Отдельный operational Store после downgrade безопасно игнорируется; старая
версия снова считает passive `Always` source включённым и не умеет его
переключать. При последующем upgrade незнакомый config revision сбрасывает stale
overrides к `on`. Ручное редактирование `.storage` пользователю не предлагается.

## 19. Принятые технические предположения — можно менять без пересмотра продукта

1. Отдельный Store и хранение только off IDs предпочтительны, но точный key и
   Python class names не являются продуктовым решением.
2. Initial state может ехать дополнительным полем `config/get` либо другим
   атомарным snapshot endpoint, если первый frame, old/new compatibility и
   config-revision coherence полностью сохранены.
3. Typed intent можно оформить union-командой либо отдельным operational action
   рядом с HA command; запрещены только две расходящиеся resolver-ветки.
4. Full card может иметь собственную event subscription, а static cards — общую
   module-level; точная раскладка допустима при отсутствии N одинаковых fetch.
5. Local cache хранит snapshot для continuity, но server revision остаётся
   authority и optimistic toggle не вводится.
6. Config writer helper может консервативно сбросить все manual overrides при
   неизвестном revision gap вместо попытки угадать историю eligibility.
7. Hidden marker сохраняет state, tombstone удаляет; это следует существующей
   границе visual hide против semantic delete.
8. Full import не импортирует state, но может сохранить текущее значение
   совпавшего stable eligible marker ID после reconciliation.
