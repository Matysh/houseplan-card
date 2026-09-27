# #486 — Панель House Plan в боковом меню Home Assistant

- **Issue:** https://github.com/Matysh/houseplan-card/issues/486
- **Тип / приоритет:** feature / P1
- **Трек:** полный; задача вводит новую пользовательскую поверхность и меняет
  backend lifecycle, frontend host, bundle graph, responsive/touch-контракт и
  первый запуск
- **Оценка:** пользовательская ценность 10/10; ценность для разработки 9/10;
  сложность 8/10; риск 8/10
- **Связано:** #40, #210, #437, #462; `docs/SCOPE.md`,
  `docs/UX-MODES.md`, `docs/TOUCH-SUPPORT.md`,
  `docs/CONFIG-COMPATIBILITY.md`

## 1. Сценарий

Персона — новый Home admin, который установил House Plan через HACS и добавил
интеграцию, либо действующий пользователь, которому нужно изменить план. Момент
— сразу после setup интеграции или при следующем обслуживании дома.

Пользователь ожидает увидеть House Plan как приложение в боковом меню Home
Assistant. Сейчас ему нужно отдельно догадаться создать dashboard, добавить
custom card, найти редакторы внутри неё и затем работать в ширине одной колонки
Sections/Masonry. На большом мониторе такая колонка может оставлять редактору
около 400 CSS px и обрывать первый пользовательский путь ещё до первой комнаты.

## 2. Что человек увидит до и после

**До:** успешная установка интеграции не даёт очевидной точки входа. Редактор
доступен только после ручного добавления карточки; по умолчанию карточка в
Sections может оказаться узкой.

**После:** после setup в стандартном боковом меню HA появляется пункт
**House Plan** с иконкой `mdi:floor-plan`. Он открывает `/houseplan`: обычную HA
страницу, где тот же план занимает всю доступную ширину и высоту. В верхней
строке страницы остаётся название продукта и стандартный доступ к меню HA, а
ниже — пространства, редакторы и действия House Plan. Dashboard-card продолжает
работать как раньше; в Sections HA предлагает ей полную ширину по умолчанию.

Первое создание плана выполняется через уже существующий onboarding House Plan.
Пользователь без права записи видит тот же read-only View и не получает ложных
редакторских действий.

## 3. Подтверждённое текущее состояние

На исходной вершине `dev` задачи:

1. `custom_components/houseplan/__init__.py` регистрирует HTTP/WS глобально,
   загружает server stores и подключает `houseplan-card.js`, но не регистрирует
   HA panel.
2. `frontend_registration.py` надёжно регистрирует Lovelace resource, fallback,
   versioned URL, одноразовое reload-уведомление и System Health для карточки.
   Этот lifecycle следует переиспользовать, а не создавать второй resource.
3. `HouseplanCard` уже получает server-side `can_write`, соблюдает `admin_only`,
   хранит последнее пространство и при уходе с HA route сбрасывает редактор в
   View. Пустой writable-план уже запускает onboarding #40, но текущая empty
   ветка ошибочно не проверяет `_canEdit`: read-only пользователь тоже видит
   Add space, а runtime может автоматически открыть onboarding. Панель для всех
   пользователей требует исправить этот разрыв в рамках #486.
4. Высота обычной карточки выводится из `100dvh` и измеренного HA chrome. Для
   собственного полноэкранного host это неоднозначно: app bar и safe area могут
   быть вычтены дважды. Нужен неперсистентный container-owned режим.
5. У full card есть `getCardSize()`, но нет `getGridOptions()`.
6. Rollup, bundle manifest и stale-entry fallback предполагают один entry и
   выбирают первый `isEntry`. Простое добавление второго entry может поменять
   authority, initial graph или оставить старый panel bundle в release.
7. Публичный совместимый API существует в HA 2024.6:
   `panel_custom.async_register_panel`. Более новые `async_panel_exists`,
   `handle_safe_area`, `sidebar_default_visible`, `show_in_sidebar` и keyword
   `warn_if_unknown` у `async_remove_panel` нельзя считать доступными на
   минимальной версии.

## 4. Продуктовые решения

1. Каноническая точка входа для создания и обслуживания плана — панель House
   Plan. Dashboard-card остаётся необязательным способом встроить план в
   пользовательский dashboard.
2. Панель и все dashboard-card используют одну server-side модель. У панели нет
   отдельного плана, пространства, layout либо набора настроек.
3. Панель общедоступна всем аутентифицированным пользователям
   (`require_admin=False`). Видимость редакторов и право записи определяются
   только существующим `can_write`/`admin_only`; sidebar visibility не является
   авторизацией.
4. Панель создаёт full card с чистыми defaults и никогда не включает card
   `kiosk`. HA kiosk/скрытый sidebar может менять только shell страницы, но не
   права или режим карточки.
5. В app bar показывается бренд **House Plan**. Дублирующий product title внутри
   card header скрывается только внутренним panel-host признаком; tabs
   пространств, редакторы, zoom/settings и остальные действия не скрываются.
6. Панель не заменяет #437: настраиваемая сводная боковая панель рядом с планом
   остаётся отдельной будущей функцией.
7. `getGridOptions() -> { columns: "full" }` входит в #486. Это fallback для
   пользователя, который начинает с dashboard-card, и не меняет ручной выбор
   ширины.
8. Empty state с Add space и автоматический onboarding доступны только при
   подтверждённом праве записи. Read-only empty state не показывает активный
   CTA и не загружает onboarding/editor runtime; правило одинаково в панели и
   dashboard-card.

## 5. Принятые предположения

Эти решения приняты предположительно и могут быть свободно изменены владельцем
до реализации без признания ТЗ заблокированным:

- route — `/houseplan`, custom element — `houseplan-panel`, sidebar icon —
  `mdi:floor-plan`;
- собственный app bar использует публичное событие `hass-toggle-menu`, а не
  внутренний API конкретной версии `ha-top-app-bar-fixed`/`ha-menu-button`;
- высота app bar следует HA theme и touch target не меньше 44×44 CSS px; точное
  число пикселей не является модельным контрактом;
- пользователю с правом записи и пустым планом сразу доступен существующий
  onboarding, без нового промежуточного welcome-screen;
- существующее одноразовое frontend-уведомление #462 получает новый текст,
  вместо создания второго persistent notification;
- HA-native пользовательские настройки порядка/видимости/sidebar title после
  регистрации не перезаписываются интеграцией.

Открытых продуктовых вопросов нет.

## 6. Термины

- **Panel shell** — новый `<houseplan-panel>`, которому HA передаёт `hass`,
  `narrow`, `route` и `panel`; он владеет app bar и одним full card.
- **Panel-host mode** — неперсистентный runtime-признак full card: контейнер
  задаёт доступную высоту, внешний card chrome становится плоским и не
  дублируется product title. Это не `CardConfig` и не YAML option.
- **Card entry** — стабильный `houseplan-card.js`, Lovelace resource и authority
  существующей dashboard-card.
- **Panel entry** — отдельный стабильный `houseplan-panel.js`, который HA
  загружает лениво только при открытии панели.
- **Owned panel** — exact registry object, созданный текущим успешным setup
  generation House Plan. Только его разрешено удалять при unload.
- **Foreign collision** — существующая панель другого владельца на route
  `houseplan`.

## 7. Скоуп

1. Зарегистрировать sidebar panel через публичный HA API и безопасно обслуживать
   setup, reload, disable, unload и remove.
2. Добавить отдельный frontend entry и manifest/release tooling для двух entry
   без роста initial graph обычной карточки.
3. Реализовать panel shell, container-owned layout и внутренний panel-host mode
   full card.
4. Сохранить существующие права, onboarding, состояние пространств и правило
   сброса editor при уходе с route.
5. Исправить empty-state permission gap: Add space и onboarding только writer.
6. Добавить `getGridOptions()` только full card.
7. Обновить config-flow completion, существующее reload-уведомление, System
   Health и переводы EN/RU/DE/FR.
8. Добавить автоматические backend/unit/browser/golden доказательства и
   пользовательскую/архитектурную документацию.

## 8. Не входит

- отдельный server config для title, icon size, стартового пространства или
  других настроек панели;
- перенос CardConfig dashboard-card на сервер или синхронизация нескольких
  разных YAML-конфигов карточек;
- новый onboarding, конвертер, sample plan или изменение #40;
- kiosk mode панели, новый fixed-floor route либо deep routing внутри панели;
- редизайн редакторов, card header, навигации пространств или инструментов;
- полная поддержка редакторов на touch: остаётся сознательная деградация из
  `docs/TOUCH-SUPPORT.md`;
- изменение пользовательского размера уже размещённых dashboard-card;
- изменение #437 либо добавление сводной панели рядом с планом;
- запись в private `.storage/frontend.panels` и принудительное восстановление
  удалённого пользователем пункта sidebar;
- изменение внешнего landing-сайта или `llms.txt`: таких поверхностей в
  текущем репозитории нет; README и User Guide являются канонической
  пользовательской документацией #486, а внешний сайт при его появлении
  получает отдельную задачу в своём репозитории;
- отдельный Lovelace resource или `extra_module_url` для panel entry;
- секреты, plan/config или instance-specific данные внутри публичного JS.

## 9. Backend-контракт

### 9.1 Регистрация

После успешной загрузки stores, миграций, repair и housekeeping
`async_setup_entry`:

1. убеждается, что `houseplan-panel.js` существует в установленном frontend;
2. регистрирует exact static URL `/houseplan_files/houseplan-panel.js` тем же
   compatibility helper, что используется для card: async API на новых HA и
   synchronous fallback на HA 2024.6;
3. вызывает:

   ```python
   await panel_custom.async_register_panel(
       hass=hass,
       frontend_url_path="houseplan",
       webcomponent_name="houseplan-panel",
       sidebar_title="House Plan",
       sidebar_icon="mdi:floor-plan",
       module_url=f"/houseplan_files/houseplan-panel.js?v={VERSION}",
       embed_iframe=False,
       trust_external=False,
       require_admin=False,
   )
   ```

4. не передаёт `config_panel_domain`, `handle_safe_area`,
   `sidebar_default_visible`, `show_in_sidebar` или другие параметры новее
   minimum HA;
5. после успеха получает exact созданный registry object и только тогда
   фиксирует ownership текущего generation;
6. регистрирует синхронный cleanup через `entry.async_on_unload`.

Панель регистрируется последней, чтобы поздний отказ миграции/repair не оставил
sidebar entry от неуспешного setup. Отказ panel setup, напротив, fail-soft: он
не отменяет уже рабочие stores, WS/HTTP и dashboard-card.

### 9.2 Static path

Process-wide состояние static registration становится per-URL set/map.
Переход в памяти с legacy boolean безопасен: `True` означает, что зарегистрирован
только `FRONTEND_URL` карточки; panel URL всё равно проверяется и регистрируется.

Static routes невозможно снять публичным HA API и они намеренно живут до
restart Core. Повторный reload entry не регистрирует тот же exact URL ещё раз.
Каталог интеграции целиком публично не публикуется.

### 9.3 Ownership, collision и generations

- `panel_custom.async_register_panel()` в HA 2024.6 возвращает `None`, а
  публичный remove API умеет удалять только по route. Ради fail-closed cleanup
  разрешено одно узкое чтение private in-memory registry
  `hass.data[frontend.DATA_PANELS]`: объект не мутируется напрямую, private
  `.storage/frontend.panels` не читается и не пишется. Эта зависимость явно
  покрывается compatibility tests на minimum/current HA.
- Если сразу после собственной успешной регистрации registry/identity нельзя
  прочитать, setup в том же синхронном участке снимает только что созданный
  route публичным `async_remove_panel`, фиксирует `ownership_error` и оставляет
  интеграцию без панели. Неидентифицируемая панель не остаётся до unload.
- Коллизия route поднимает/нормализуется в статус `collision`; чужая панель не
  обновляется, не скрывается и не удаляется.
- Cleanup сравнивает текущий runtime generation и identity registry object с
  сохранённым owned object. Старый callback не может снять новую House Plan
  generation, а внешняя замена route не может быть удалена как наша.
- Используется двухаргументный `frontend.async_remove_panel(hass, "houseplan")`,
  совместимый с HA 2024.6. `warn_if_unknown` не передаётся.
- Reload: owned panel снимается один раз, затем новая generation регистрируется
  один раз. Disable/unload: sidebar entry исчезает. Uninstall после unload
  идемпотентен и не делает второе слепое удаление.
- Missing bundle, static registration error, `ValueError` collision и иное
  исключение panel API записываются безопасно, но setup интеграции возвращает
  success.

### 9.4 Наблюдаемость

Runtime panel state минимум содержит:

- `panel_file_present`;
- `panel_static_path_registered`;
- `panel_status`: `not_attempted`, `registered`, `missing_asset`, `collision`,
  `static_error`, `registration_error`, `ownership_error`, `removed`;
- `panel_url` — `/houseplan` либо `unavailable`;
- `panel_module_url` — versioned local URL либо `unavailable`;
- `panel_error` — безопасный fingerprint `phase:ExceptionType` либо `none`;
- internal generation/owned identity, не выводимые как сериализованные данные.

System Health добавляет эти поля к существующему frontend/resource состоянию.
Логи не включают exception message, пользовательский config, filesystem paths,
токены или содержимое плана. Collision получает понятный warning с route и
советом открыть System Health; отдельный Repairs issue в #486 не вводится.

## 10. Доступ и безопасность

`require_admin=False` определяет только присутствие пункта в списке панелей HA.
Для каждого пользователя full card получает обычный `hass` и server response:

- read-only пользователь видит View, но не editor tabs/изменяющие действия;
- администратор при `admin_only=true` получает существующее право записи;
- разрешённый non-admin при `admin_only=false` получает ровно существующий
  `can_write`;
- backend WebSocket/HTTP guards остаются authority и не полагаются на скрытый
  UI.

Panel JS и card JS публичны как обычные frontend resources. В них запрещены
access tokens, план, entity states и server config; всё instance-specific
приходит только через аутентифицированный HA runtime.

## 11. Bundle и release-контракт

### 11.1 Две именованные точки входа

Rollup получает именованные entries:

- card → стабильный `houseplan-card.js`;
- panel → стабильный `houseplan-panel.js`.

Конфигурация root не оставляется на порядок enumeration:

```js
input: {
  'houseplan-card': 'src/houseplan-card.ts',
  'houseplan-panel': 'src/houseplan-panel.ts',
},
entryFileNames: '[name].js',
```

`src/houseplan-panel.ts` статически подключает card entry и регистрирует только
`houseplan-panel`. Rollup должен переиспользовать один card graph, а не собрать
его вторую копию. Editor/onboarding/locale/isometric/PDF chunks сохраняют
существующую ленивость.

### 11.2 Manifest authority

Схема расширяется аддитивно и сохраняет действующие поля карточки:

- `entry: "houseplan-card.js"` остаётся authority для всех старых consumers;
- `panelEntry: "houseplan-panel.js"` явно задаёт второй root;
- `initialViewFiles`/`initialViewGzipBytes` считаются только от card entry;
- `initialPanelFiles`/`initialPanelGzipBytes` считаются от panel entry;
- `initialPanelOnlyFiles = initialPanelFiles \\ initialViewFiles`, а
  `initialPanelOnlyGzipBytes` — сумма только этой разницы;
- все output files, включая оба entries и общие hashed chunks, присутствуют в
  manifest inventory с digest/bytes/gzip и `isEntry:true` ровно у двух
  объявленных стабильных roots.

`initialViewFiles` является подмножеством `initialPanelFiles`: panel shell
переиспользует card graph, а не дублирует его. Выбор «первый `isEntry`»
запрещён. Root определяется по exact filename и `facadeModuleId`.

### 11.3 Синхронизация и stale build

- На успешной сборке оба стабильных entry получают fail-loud stale-load
  поведение: недоступный hashed implementation chunk даёт видимую просьбу
  перезагрузить страницу, а не пустую поверхность. Compiler/Rollup failure
  завершается non-zero; неполная сборка не синхронизируется и не публикуется.
- `bundle-sync` материализует полное дерево для репозитория, demo и release
  package: hashed dependencies, оба стабильных entry, manifest и удаление
  старого inventory. Эта последовательность **не объявляется live-atomic** для
  уже обслуживаемой HA: в коротком окне замены entry новый chunk может ещё не
  входить в старый manifest allowlist, и именно stale-load UI является
  допустимой fail-loud деградацией до завершения sync/reload.
- freshness/tree/release/zip проверки валидируют оба roots и запрещают orphaned
  либо missing panel files. Unlisted root-level `houseplan-*.js` также считается
  orphan, а не только файл в `houseplan-assets/`.
- Panel entry не создаёт Lovelace resource и загружается HA лениво только при
  открытии `/houseplan`.
- `houseplan-panel.js` входит в HACS zip. Самостоятельный GitHub asset
  `houseplan-card.js` остаётся card-only; второй standalone asset в #486 не
  вводится.

### 11.4 Бюджет

Действующий ceiling initial View карточки не увеличивается ради panel shell и
не ослабляется. `initialViewFiles` не содержит panel entry. Ceiling **8 KiB
gzip** применяется к `initialPanelOnlyGzipBytes`, а не ко всему panel closure:
общий panel graph включает тот же card graph, но не дублирует его.

Изменения самой full card (`getGridOptions`, panel-host branch) остаются внутри
действующего card budget. Если он исчерпан, код уменьшается или выносится, а
бюджет не повышается в #486.

## 12. Frontend panel shell

### 12.1 Lifecycle и свойства HA

`houseplan-panel` принимает property setters `hass`, `narrow`, `route`, `panel`.
Порядок присваивания произвольный. Shell:

1. создаёт ровно один `<houseplan-card>` за своё подключение;
2. до первого `hass` вызывает `setConfig({ type: "custom:houseplan-card" })`
   ровно один раз;
3. передаёт каждое новое `hass` тому же child, не перемонтируя plan;
4. применяет `narrow`/`route`/`panel` к shell без повторного `setConfig`;
5. после disconnect не оставляет document/window listeners, observers или
   timers; reconnect того же элемента не размножает child/listeners.

Panel config не преобразуется в публичный CardConfig. `hass.kioskMode`, HA
sidebar state или `narrow` никогда не превращаются в `config.kiosk`.

### 12.2 App bar и меню

App bar содержит:

- кнопку меню на всех ширинах; обычная пользовательская активация кнопки
  (trusted исходный click/tap или keyboard activation) отправляет синтетическое,
  поэтому само по себе неизбежно `isTrusted=false`, но bubbling + composed
  событие `hass-toggle-menu`. Поэтому доступ к drawer не зависит от того,
  передаёт ли конкретная версия HA отдельный desktop-collapsed flag; `narrow`
  меняет только responsive presentation shell;
- заголовок **House Plan**;
- семантический heading/toolbar без фальшивой навигационной ссылки.

Accessible name кнопки берётся из `hass.localize` с English fallback. Shell не
зависит от private methods внутренних HA components. Если HA сам скрывает
sidebar в kiosk, это не включает card kiosk и не открывает редакторы.

### 12.3 Full-page layout

Shell — grid/flex из `appbar auto` и `content minmax(0, 1fr)`:

- занимает `width:100%` и высоту **viewport**: `100vh`, затем
  `calc(100dvh − safe-area-inset-top − safe-area-inset-bottom)` (уточнение
  #488: `<ha-panel-custom>` — блок с safe-area-паддингами и без высоты, поэтому
  `height:100%` резолвится в `auto`, и стейдж схлопывается в 0 px; HA для
  iframe-панелей по той же причине берёт `100dvh`);
- не создаёт page/horizontal scroll;
- content и child имеют `min-width:0`, `min-height:0`, `overflow:hidden`;
- паддинги safe-area, которые ставит сам `ha-panel-custom`, вычитаются из
  высоты `:host` ровно один раз — сверху и снизу; боковые уже учтены шириной;
- outer card border/radius/shadow убираются только в panel-host mode.

Порядок монтирования у HA (#488): `ha-panel-custom` создаёт элемент и
присваивает `panel`/`hass`/`narrow`/`route` сразу после `load` module-скрипта,
а entry панели определяет класс после top-level `await import('./houseplan-card.js')`.
Значения ложатся собственными свойствами инстанса и затеняют accessors;
`houseplan-panel` в конструкторе и `connectedCallback` переприсваивает их через
accessors (`_adoptPreUpgradeProperties`). Смок `smoke_houseplan_panel.mjs`
воспроизводит именно этот порядок и контейнер без высоты; два мутанта держат
оба контракта.

Panel-host mode считает stage от **измеренного контейнера**, вычитая только
собственный card header/editor chrome. Он не использует `100dvh − HA chrome`.
Существующий ResizeObserver получает итоговый stage rect и выполняет обычный
refit. Смена space, View ↔ editor, narrow, sidebar, split-view, orientation и
virtual keyboard не дают отрицательной/нулевой высоты, snap или постоянного
resize-loop.

Обычные dashboard/kiosk/space-card размеры остаются неизменными.

### 12.4 Card header

В panel-host mode скрывается только product-title fragment. Если header
содержит tabs пространств, editors, device count, zoom/settings или контекстные
действия, они остаются и занимают измеряемую строку. В empty/fixed/error ветках
не остаётся пустой title-row: app bar уже является видимым и доступным
заголовком страницы.

## 13. Состояния и навигация

| Состояние | Ожидаемое поведение панели |
|---|---|
| План существует, writer | Последнее доступное пространство, View; editors доступны |
| План существует, read-only | То же пространство и View; editors отсутствуют |
| Пустой план, writer | Существующий onboarding/создание первого пространства |
| Пустой план, read-only | Read-only empty state без Add space, автодиалога и onboarding/editor runtime |
| Последнее пространство удалено | Существующий deterministic fallback пространства |
| Уход `/houseplan` → другой HA route | Editor/dialog/draft завершаются по действующему route-departure contract; сохраняется только пространство |
| Возврат на `/houseplan` | Новая panel/card instance открывает сохранённое пространство в View |
| Same-route технический remount | Действующий короткий warm-remount может сохранить непрерывность; это не считается уходом пользователя |
| Entry reload | Панель снимается и возвращается; browser может потребовать уже существующий hard reload после смены frontend version |
| Foreign collision | Чужая панель остаётся; House Plan dashboard-card и backend работают |
| Missing/broken panel bundle | Sidebar panel не регистрируется; dashboard-card и backend работают |

Panel route не вводит новое хранилище навигации. Действующий last-space browser
state общий с full card; editor mode не записывается.

## 14. Grid contract dashboard-card

`HouseplanCard` получает instance method:

```ts
getGridOptions(): { columns: 'full' }
```

Ограничения:

- метод только у `custom:houseplan-card`, не у `houseplan-space-card`;
- `rows`, `min_rows`, `max_rows` и принудительная высота не задаются;
- `getCardSize(): 12` сохраняется для Masonry и старых HA;
- HA, не знающая метод, его игнорирует;
- существующий вручную выбранный размер Sections не перезаписывается.

## 15. Первый запуск и i18n

### 15.1 Config flow

Успешный `async_create_entry` использует `description="panel_ready"` — этот
публичный контракт присутствует в HA 2024.6. Текст EN/RU/DE/FR:

- предлагает открыть House Plan в sidebar, если пункт появился;
- называет desktop рекомендуемым местом для редактирования;
- не обещает панель безусловно: если пункта нет, предлагает dashboard-card и
  System Health, что покрывает collision/fail-soft. Безусловной ссылки на
  `/houseplan` нет: при foreign collision этот route принадлежит другому panel.

### 15.2 Одноразовое уведомление #462

Стабильный ID и persisted flag не меняются. Текст существующего уведомления во
всех четырёх backend locales теперь сообщает, что:

1. House Plan доступен в боковом меню;
2. после update всё ещё нужен полный reload страницы;
3. dashboard-card остаётся доступна и при ручном управлении resource проверяется
   Settings → Dashboards → Resources.

Существующий пользователь, уже получивший уведомление #462, не получает его
повторно только ради #486. Нового флага или второго уведомления нет.

Sidebar brand **House Plan** не локализуется. Текст карточки/onboarding следует
языку browser HA как сейчас; menu accessible label использует HA localization.

Точные ключи, обязательные одновременно в источнике и EN/RU/DE/FR:

- новый backend `config.create_entry.panel_ready`;
- существующие, но с обновлённым текстом
  `issues.frontend_reload_notice.title` и
  `issues.frontend_reload_notice.description`;
- новые System Health labels `system_health.info.panel_file`,
  `system_health.info.panel_static_path`, `system_health.info.panel_status`,
  `system_health.info.panel_url`, `system_health.info.panel_module_url`,
  `system_health.info.panel_error`;
- новый frontend `empty.read_only`, объясняющий, что первое пространство может
  создать пользователь с правом редактирования.

## 16. Модель, миграция и совместимость

- `CardConfig`, plan schema, layout, entities, markers, spaces и storage format
  не меняются; config migration отсутствует.
- Существующие dashboard-card, kiosk, fixed-floor и space-card не меняются.
- После обновления существующая установка получает панель при следующем
  setup/reload интеграции; план и browser last-space остаются.
- HA 2024.6 поддерживается без новых kwargs. Compatibility unit/stub должен
  падать, если implementation начнёт их передавать.
- Browser с уже определёнными старыми custom elements может применить новый
  frontend только после hard reload; действующий version/reload-контракт #462
  остаётся authority.
- Нативные HA overrides sidebar title/order/visibility переживают unregister по
  правилам HA и не чистятся через private storage.

## 17. Accessibility, touch и responsive

- Panel shell не ухудшает существующие pointer, keyboard и touch-контракты View
  из `docs/TOUCH-SUPPORT.md`; #486 не подменяет отдельный аудит #31.
- Menu button и все app-bar действия имеют hit target не меньше 44×44 CSS px,
  видимый focus и accessible name.
- App bar — landmark/header; title — доступный page heading. Скрытый внутренний
  title не создаёт дублирующее объявление.
- Tab order начинается с menu и продолжается существующими House Plan controls;
  retained header controls и уже доступные stage interactives сохраняют
  focus-visible, accessible name и keyboard activation. Shell не делает
  autofocus и не крадёт focus при `hass` update/refit.
- При 320 CSS px, tablet portrait/landscape, desktop wide, sidebar collapse и
  mobile safe area отсутствуют horizontal scroll, обрезанная app bar и
  недоступные View controls.
- Редакторы на touch остаются best-effort. Документация прямо рекомендует
  desktop и не обещает полноценную touch-редактуру из-за новой панели.
- `prefers-reduced-motion` использует существующие правила карточки; shell не
  добавляет самостоятельную декоративную анимацию.

## 18. Производительность

1. Регистрация panel entry не меняет cold-load dashboard-card и её Lovelace
   resource.
2. До первого открытия `/houseplan` browser не загружает panel entry.
3. Populated panel View загружает panel shell + существующий initial card graph;
   lazy editor/onboarding/locale/isometric/PDF chunks не становятся eager.
4. `hass` updates не пересоздают child, не повторяют `setConfig` и не создают
   второй WebSocket subscription/render tree.
5. Container observer не образует write/read loop и не добавляет постоянный
   layout read на каждый HA state tick.
6. Card ceiling не повышается; panel-only ceiling из §11.4 проверяется CI.

## 19. Acceptance criteria

- **AC1 (`backend` + mutation):** setup на поддерживаемом HA регистрирует ровно
  одну `/houseplan` custom panel с exact element/title/icon/versioned module URL,
  `require_admin=False`, без kwargs новее HA 2024.6; мутанты path, permissions,
  module URL и API обязаны падать.
- **AC2 (`backend` + mutation):** unload/reload/disable/remove удаляют только
  owned exact registry object и не оставляют duplicate; старая generation и
  foreign collision не могут удалить/переписать текущую чужую или новую панель.
- **AC3 (`backend`):** missing panel file, static-path failure, collision и API
  exception не роняют setup/card/WS; System Health честно различает все статусы
  §9.4 и не раскрывает exception message/path/data.
- **AC4 (`unit` + bundle gate):** manifest явно различает card/panel entries,
  inventories и graphs; card `entry`/initial semantics обратно совместимы;
  оба stable-entry stale-load поведения, sync materialization, freshness, tree
  и release zip проверяются отрицательными fixtures, включая unlisted
  root-level `houseplan-*.js`.
- **AC5 (`unit` + bundle gate + performance + mutation):** panel entry
  отсутствует в card initial graph,
  `initialViewFiles ⊆ initialPanelFiles`, действующий card ceiling не повышен,
  `initialPanelOnlyGzipBytes ≤ 8 KiB` и один card graph не продублирован;
  eager-import/duplicate-graph mutant обязан уронить проверку.
- **AC6 (`unit` + smoke):** panel shell создаёт один child, делает один
  `setConfig`, прокидывает все `hass` updates и реагирует на
  `narrow`/`route`/`panel` без remount; disconnect/reconnect не размножает
  listeners/child.
- **AC7 (`smoke` + golden):** wide View `1280×800`, wide Plan editor и narrow
  read-only/empty `320×720` имеют `scrollWidth-clientWidth ≤ 1 CSS px`; stage
  отличается от измеренного content-slot не более чем на 1 CSS px, остаётся
  положительным и после одного resize/orientation intent стабилизирует rect в
  пределах 0.5 CSS px за два последовательных animation frame. Нет двойного
  title; fit envelope целиком внутри stage с действующим отступом. Эталоны
  принимаются только независимым Linux capture/review.
- **AC8 (`smoke` + code review):** пользовательская активация menu на
  wide/narrow dispatches bubbling + composed `hass-toggle-menu`; его
  focus/ARIA/hit target корректны,
  retained header и representative existing stage interactive остаются
  keyboard-reachable; HA kiosk не превращается в card kiosk.
- **AC9 (`backend` + smoke):** admin и read-only пользователь видят panel;
  editor visibility и реальные write calls по-прежнему следуют
  `can_write`/`admin_only`, включая разрешённого non-admin.
- **AC10 (`unit` + smoke + mutation):** populated/empty writer/empty read-only и
  missing last-space дают состояния §13; read-only branch не показывает CTA,
  не открывает диалог и не импортирует onboarding/editor runtime; существующий
  writer onboarding не дублируется.
- **AC11 (`unit` + smoke):** уход с panel route и возврат сохраняют только space
  и открывают View; same-route technical remount сохраняет действующий короткий
  continuity contract.
- **AC12 (`unit` + code review):** full card возвращает только
  `{columns:"full"}`, сохраняет `getCardSize()`, space-card не получает новый
  контракт. Метод объявляет только default; код House Plan не читает и не
  мутирует сохранённый HA Sections layout, поэтому ручной размер остаётся
  ответственностью host HA.
- **AC13 (`backend` + i18n gate):** config-flow completion и существующее
  reload notice имеют согласованные EN/RU/DE/FR keys/text; существующий persisted
  flag не создаёт повторное уведомление при upgrade.
- **AC14 (`unit` + backend + code review):** plan/config/layout schema и
  `CardConfig` не меняются; публичные panel assets не содержат secrets/user data;
  HA 2024.6 compatibility stub отвергает использование новых API/kwargs.
- **AC15 (`docs` + code review):** README EN/RU, User Guide EN/RU,
  Architecture, UX Modes, Touch Support, Testing и Status описывают panel как
  основной вход, dashboard-card как optional, desktop-first editing,
  lifecycle/fail-soft диагностику и Sections default.

## 20. Test plan

### Backend HA harness / pure compatibility

1. Successful register + current panel registry contents.
2. Unload, reload, disable, remove and stale-generation callback.
3. Pre-existing foreign panel; external replacement after our register.
4. Missing panel bundle and failing static/register API.
5. `get_panels` visibility for admin/read-only and server write denial.
6. System Health matrix and safe error fingerprint.
7. Config flow `description=panel_ready`, notification persisted flag and all
   locales.
8. HA 2024.6-shaped stubs without newer parameters/methods.

### Unit/tooling

1. Exact Rollup input `{ 'houseplan-card': 'src/houseplan-card.ts',
   'houseplan-panel': 'src/houseplan-panel.ts' }`, `entryFileNames:'[name].js'`
   and deterministic exact filename/facade root selection.
2. Card/panel dependency graphs, no duplication and budgets.
3. Both stable-entry stale-load behaviors; missing/wrong digest/orphan or
   unlisted managed root-level entry fixture must fail.
4. Sync order and packaged frontend inventory.
5. Panel property/lifecycle/menu contract.
6. `getGridOptions` exact return and space-card absence.

### Browser smoke/golden

1. Cold `/houseplan` populated View writer, then first editor intent.
2. Empty writer onboarding and empty read-only state.
3. Permission matrix, no `config.kiosk` propagation.
4. Desktop wide, narrow 320 px, orientation/resize/sidebar collapse.
5. View → editor → editor swap → View; stage rect and scroll probes.
6. Route departure/return and same-route technical remount.
7. Menu event, keyboard focus and touch target probes.
8. Focused panel-host goldens from AC7 plus unchanged representative bare-card
   golden.

## 21. Затронутые файлы и модули

Ожидаемый набор (имена helper/test могут уточняться без изменения контракта):

- `src/houseplan-panel.ts`, `src/houseplan-card.ts`, panel/card styles;
- `rollup.config.mjs`, `scripts/bundle-manifest.mjs`,
  `scripts/bundle-sync.mjs`, `scripts/bundle-tree.mjs`, bundle budget/freshness,
  `scripts/release-prerelease.mjs`, `.github/workflows/release.yml` и
  `.github/workflows/publish-prerelease.yml` там, где они предполагают один
  entry;
- `custom_components/houseplan/__init__.py`, `frontend_registration.py` либо
  отдельный `panel_registration.py`, `frontend_asset_manifest.py`,
  `system_health.py`, `config_flow.py`, `manifest.json`;
- `custom_components/houseplan/strings.json` и translations EN/RU/DE/FR;
- targeted `test/*.test.mjs`, `tests_backend/test_ha_*.py`, browser smoke и
  golden matrix/baselines;
- `README.md`, `README.ru.md`, `docs/USER-GUIDE.md`,
  `docs/USER-GUIDE.ru.md`, `docs/ARCHITECTURE.md`, `docs/UX-MODES.md`,
  `docs/TOUCH-SUPPORT.md`, `docs/TESTING.md`, `docs/STATUS.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` в пользовательском implementation
  commit.

## 22. Риски и защита

| Риск | Вероятность / ущерб | Защита |
|---|---|---|
| Multi-entry меняет «первый entry» и initial budget | high / high | explicit roots, negative manifest fixtures, unchanged card ceiling |
| Release получает stale panel entry или missing chunk | medium / high | complete offline materialization, fail-loud stale-load behavior, zip integrity |
| Unload снимает чужую/новую panel | medium / high | generation + registry object identity, collision tests |
| App bar/safe area вычитаются дважды | high / high | container-owned sizing, responsive smoke/golden |
| Shell пересоздаёт card на каждом `hass` | medium / high | one-child/one-setConfig contract and subscription probe |
| `require_admin=False` ошибочно открывает writes | low / critical | existing backend auth authority + permission matrix |
| Внутренний HA component/API меняется | medium / medium | public panel helper/event only, minimum-HA stub |
| Двойная шапка съедает высоту | high / medium | panel app bar + hide only duplicated product title |
| Editor возвращается после ухода с route | medium / medium | existing route-departure integration smoke |
| Panel недоступна из-за пользовательского sidebar override | medium / low | direct `/houseplan`, docs; private storage не трогаем |

## 23. Rollback

Если panel lifecycle или frontend host даёт критическую регрессию:

1. перестать вызывать panel registration и снять owned `/houseplan` при unload;
2. оставить card entry, dashboard-card, server stores и plan schema без отката;
3. panel entry можно сохранить неиспользуемым один цикл или убрать вместе с
   manifest field/tooling после проверки package inventory;
4. `getGridOptions` можно откатить независимо без изменения сохранённых cards;
5. frontend reload notification вернуть к нейтральному тексту без изменения
   persisted flag.

Откат не требует миграции данных и не изменяет пользовательские планы.

## 24. Release-артефакты

- по одной значимой записи со ссылкой #486 в `docs/CHANGELOG.ru.md` и
  `docs/CHANGELOG.md`;
- README EN/RU и User Guide EN/RU с первичным sidebar flow и optional card;
- внешний landing и `llms.txt` явно отложены по §8, потому что не принадлежат
  этому репозиторию;
- Architecture/UX/Touch/Testing/Status по AC15;
- принятые panel-host golden и, если меняется документационный кадр, пересъёмка
  через Linux workflow + `docs:accept -- --reviewed`;
- bundle manifest/tree/budget/freshness и HACS zip с обоими entries;
- targeted backend/unit/smoke/golden gates, затем обычный full-track S7 review;
- security evidence: public bundle inventory и неизменные server write guards;
- performance evidence: неизменный card ceiling и отдельный panel-only budget.
