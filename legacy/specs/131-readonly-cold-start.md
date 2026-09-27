# Issue #131 — полный первый кадр View у read-only-пользователя

- **Issue:** https://github.com/Matysh/houseplan-card/issues/131
- **Редакция:** первая редакция для независимого ревью; статус задачи определяется
  только метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 9/10; ценность для разработки 7/10;
  сложность и риск 4/10
- **Область:** холодная загрузка `houseplan-card`, выбор пространства,
  read-only View/киоск, локальный config-cache, reload и warm remount
- **Модель данных:** без изменений и миграции
- **Связано:** #73, #93, `docs/SCOPE.md`, `docs/TOUCH-SUPPORT.md`,
  `docs/UX-MODES.md`, `docs/USER-GUIDE.ru.md`, `docs/ARCHITECTURE.md`

## 1. Сценарий и продуктовый контекст

**Персона:** домочадец без права редактирования плана либо пользователь
настенной панели/киоска. Для него View — основной продуктовый режим, а не
предпросмотр перед редактором.

**Поверхность и момент:** пользователь впервые открывает Lovelace-страницу после
чистой установки, очистки локального состояния или на новом браузере. Сервер
разрешает прочитать House Plan, но HA-сессия не разрешает одну или несколько
подписок на служебные события интеграции.

Задача поддерживает:

- **J1:** план должен быть читаемым и полным сразу при открытии;
- **J6:** reload, reconnect и техническое перемонтирование не должны менять
  смысл или состав видимого плана;
- гарантированный View/touch/kiosk-контракт: телефон, планшет и настенная панель
  являются целевыми устройствами просмотра и управления.

## 2. Что человек увидит до и после

**До:** при первом открытии видна только часть плана, ни одно пространство не
выделено, а нажатие его вкладки неожиданно «дорисовывает» пол, мебель, стены,
свет и подписи состояний.

**После:** первый кадр уже совпадает с нормальным видом после нажатия вкладки;
пространство выбрано, все его слои и состояния на месте, а нажатие активной
вкладки ничего не исправляет.

## 3. Проблема и подтверждённая причина

`setConfig()` начинает без server-cache с legacy-значения `_space = 'f1'`.
После ответов `houseplan/config/get` и `houseplan/layout/get` метод
`_loadFromServer()` принимает конфигурацию через `_adoptStructuralResponses()`,
но до выбора реального пространства последовательно ожидает три live-sync
подписки.

Отказ первой `subscribeEvents()` попадает во внешний `catch` и пропускает весь
оставшийся хвост успешной инициализации:

1. hash/saved/default/first precedence не применяется;
2. `_cacheSnapshot()` не вызывается;
3. zoom/viewport не восстанавливается по принятому пространству;
4. ошибка ошибочно считается сбоем всей загрузки и запускает полный retry.

При этом `_loadOk` уже установлен и server config уже принят. `_spaceModel()`
скрывает часть ошибки, подставляя первый model space вместо несуществующего
`f1`, поэтому устройства и часть геометрии видны. Но `_curSpaceCfg` ищет точное
совпадение и остаётся `undefined`; header также сравнивает точные ID. Из-за этого
неактивна вкладка и отсутствуют зависящие от raw-space слои.

Диагностика на `dev` SHA `0e69c4a18337` с двумя пространствами `home` и
`upstairs`:

| Сценарий | `_space` | model fallback | exact space | active tab |
|---|---|---|---|---|
| Cold start, подписка запрещена | `f1` | `home` | — | — |
| После клика `home` | `home` | `home` | `home` | `home` |
| Технический remount без config-cache | `f1` | `home` | — | — |
| Новый экземпляр с валидным `LS_NAV`, без config-cache | `f1` | `home` | — | — |
| Reload с валидным config-cache | `home` | `home` | `home` | `home` |

`can_write: false` без отказа подписок загружается правильно. Значит, условие
дефекта — не запрет редактирования сам по себе, а ошибка необязательной подписки
в обязательной последовательности cold start.

## 4. Решения владельца

Владелец принял defaults D1–D3 14.08.2026. Каноническая запись:
https://github.com/Matysh/houseplan-card/issues/131#issuecomment-5287280361

1. Задача имеет приоритет P1 и идёт полным маршрутом без `small`/`trivial`.
2. После принятия серверной конфигурации карточка выбирает ровно одно
   существующее пространство по действующему приоритету до пространственного
   рендера.
3. Полнота initial snapshot не зависит от права записи, результата
   необязательных live-sync-подписок, числа пространств, наличия cache, reload
   или технического remount. Отказ подписки может отключить только последующую
   live-синхронизацию.

## 5. Скоуп

В задачу входят:

1. обязательное завершение server snapshot после успешных `config/get` и
   `layout/get`, даже если любая houseplan event subscription отклонена;
2. выбор валидного пространства до первого пространственного кадра;
3. cold start без `LS_CFG`, включая валидный и stale `LS_NAV`;
4. одно и несколько пространств, валидные и stale `#space`/`default_floor`;
5. сохранение принятого server snapshot в `LS_CFG` после успешной загрузки;
6. reload и same-route warm remount;
7. View и киоск при `can_write: false`; обычная admin-сессия остаётся той же;
8. независимая best-effort установка config, trail и layout subscriptions;
9. отсутствие полного load-retry только из-за отказа необязательной подписки;
10. unit/browser regression coverage, архитектурная документация и два
    changelog.

## 6. Не входит в задачу

- выдача read-only-пользователю права редактировать план или подписываться на
  запрещённые HA events;
- изменение backend permissions, websocket API или Home Assistant auth;
- гарантированная live-синхронизация после явно запрещённой подписки;
- новый warning, toast, recovery overlay или индикатор ограниченных прав;
- изменение порядка вкладок, названий пространств, `default_floor`, deep link
  или формата локального cache/navigation;
- изменение выбора пространства в `houseplan-space-card`, где пространство
  задаётся отдельным обязательным параметром;
- изменение рендера пола, мебели, стен, Glow, устройств либо их состояний после
  того, как raw space уже выбран правильно;
- изменение reconnect/asset-failure контракта #73 для обязательных данных;
- schema/config migration, import/export и новые compatibility-поля;
- отдельная оптимизация производительности или переработка всего boot lifecycle.

## 7. Контракт поведения

### 7.1. Инвариант выбранного пространства

Если принятая серверная конфигурация содержит хотя бы одно пространство, перед
публикацией spatial candidate одновременно выполняются условия:

- `_space` равен ID существующего пространства;
- model space и exact raw space описывают один и тот же ID;
- ровно одна вкладка full card имеет active-состояние, кроме киоска, где header
  намеренно не рендерится;
- все raw-space consumers получают один и тот же объект пространства;
- несуществующее legacy/stale значение не остаётся скрытым за model fallback.

Если пространств нет, карточка сохраняет существующий empty/onboarding-контракт:
она не обязана выдумывать ID и не падает.

### 7.2. Приоритет выбора

Для cold/reload без уже принятого валидного same-route warm viewport применяется
существующий порядок, причём каждый кандидат обязан присутствовать в live model:

1. валидный `#space=<id>`;
2. валидное сохранённое пространство `LS_NAV`;
3. валидный `default_floor` карточки;
4. первое пространство live config.

Невалидный кандидат пропускается, а не сохраняется как `_space`. Explicit hash
по-прежнему выигрывает. Уже принятый валидный same-route warm viewport остаётся
существующим continuity-исключением #73/#93 и не сбрасывается менее точным
saved/default значением; при отсутствии его пространства в live config порядок
выше применяется заново.

### 7.3. Обязательная и необязательная части загрузки

Успешный initial snapshot состоит из обязательных шагов:

1. получить config и layout;
2. при структурном изменении подготовить обязательный backdrop;
3. принять config/layout, revisions и `can_write`;
4. выбрать валидное пространство;
5. записать локальный snapshot;
6. восстановить применимый viewport/zoom;
7. опубликовать полный candidate frame и построить устройства.

Config/trail/layout event subscriptions являются best-effort live-sync. Ни одна
из них не может отменить или задержать перечисленные гарантии после принятия
server data.

### 7.4. Деградация live-sync

- Каждая подписка устанавливается независимо; отказ одной не запрещает попытки
  установить остальные.
- Успешная подписка сохраняет текущий idempotent one-subscription-per-card
  контракт и штатно очищается при disconnect.
- Неуспешная подписка остаётся доступной для повторной попытки при следующем
  обычном load/reconnect, но не запускает tight loop и не перечитывает весь
  snapshot только ради подписки.
- Отказ подписки не показывает новый toast и не подменяет принятый config
  fallback-данными.
- Ошибка обязательных config/layout calls, обязательного asset или последующей
  config reload сохраняет нынешний stale-while-revalidate/recovery-контракт и
  не маскируется как успех.

### 7.5. Reload, cache и warm remount

- После успешного server snapshot `LS_CFG` записывается независимо от результата
  подписок.
- Сохранённый `LS_NAV` применяется после появления live model, даже если до
  server response не было config-cache, в котором можно было проверить ID.
- Технический same-route remount сохраняет валидное пространство по текущему
  warm/navigation contract; отсутствие cache не возвращает `_space` к `f1`.
- Валидный старый cache может дать мгновенный полный кадр, но не является
  условием корректности.
- После исправления клик уже активной вкладки является no-op и не меняет состав
  сцены.

## 8. Архитектурный контракт реализации

Конкретные helper names являются техническим выбором автора, но обязательны
следующие границы:

1. Нормализация пространства является частью принятия structural snapshot и
   выполняется до первого `await`, который относится только к live-sync.
2. Один resolver владеет проверкой существования и cold precedence; setConfig,
   live load и warm path не должны получать расходящиеся копии правил.
3. Model fallback не считается доказательством валидного exact space. После
   принятия непустого config invariant проверяется по точному ID.
4. Подписки изолируют rejection по отдельности; rejected Promise не достигает
   outer catch обязательной загрузки и не создаёт unhandled rejection.
5. Ошибка optional subscription не устанавливает recovery/error state полного
   кадра и не запускает `_scheduleLoadRetry(true)` сама по себе.
6. Существующие `_unsubCfg`, `_unsubTrail`, `_unsubLayout` остаются authority
   идемпотентности: успешную подписку нельзя дублировать.
7. Cache записывает только уже принятые server config/layout и revisions;
   optional subscription state в persistent data не добавляется.
8. Device rebuild и continuity candidate читают уже нормализованное пространство;
   отдельной исправленной ветки рендера для read-only быть не должно.

Предполагаемые файлы реализации:

- `src/houseplan-card.ts`;
- при полезном выделении pure resolver — небольшой frontend module;
- соответствующий `test/*.test.mjs`;
- `demo/smoke_readonly_cold_start.mjs` либо эквивалентный browser scenario;
- `docs/ARCHITECTURE.md`, `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`.

## 9. Модель данных, compatibility и миграция

Форматы `CardConfig`, server config, layout, `LS_CFG`, `LS_NAV` и warm memo не
меняются. Новых полей, schema version, backend validation и compatibility aliases
нет.

Сохранённые планы не переписываются. Исправление вычисляется на каждом старте;
конфигурации прежней версии остаются читаемыми новой и старой версиями. Прямая
и обратная миграция не нужны.

## 10. UX, i18n, accessibility и touch

Новых controls, текстов, фокуса, клавиатурных команд или motion нет. Новые
i18n-ключи en/ru не требуются.

Активная вкладка сохраняет существующую семантику кнопки и focus order.
Исправление не должно программно переводить фокус и не должно объявлять
служебную ошибку подписки через live region.

View на touch блокирующий: первый кадр телефона/планшета обязан быть полным без
тапа по вкладке. В киоске требование ещё строже, потому что header скрыт и обход
недоступен. Touch editor остаётся вне скоупа; право редактирования не меняется.

## 11. Критерии приёмки

- **AC1 (`unit`):** resolver cold selection покрывает матрицу valid/stale
  hash, `LS_NAV`, `default_floor`, legacy current ID, одного/нескольких/нулевого
  числа пространств и всегда возвращает существующий ID при непустом model.
- **AC2 (`unit` + `ревью кода`):** после принятия config/layout exact space
  нормализован и cache/viewport finalization выполнены до optional subscription;
  rejection любой подписки не может пропустить эти шаги.
- **AC3 (`smoke`):** read-only cold start без `LS_CFG`, с пространствами
  `home/upstairs`, `can_write: false` и rejected houseplan subscriptions сразу
  имеет `_space = home`, exact raw space `home`, одну active-вкладку и полный
  набор floor/decor/wall/Glow/device-state слоёв без клика и page error.
- **AC4 (`smoke`):** fixed HA snapshot до клика активной вкладки и после её
  no-op клика имеет одинаковые проверяемые spatial layers; сцена не
  «дорисовывается».
- **AC5 (`unit` + `smoke`):** valid/stale saved/default/hash precedence на
  нескольких пространствах выбирает ожидаемый live ID; stale `f1` никогда не
  остаётся exact selection, если такого пространства нет.
- **AC6 (`smoke`):** после cold start с rejected subscriptions `LS_CFG`
  существует; reload и same-route warm remount без предварительного admin-cache
  сохраняют полный кадр и валидное пространство.
- **AC7 (`unit` + `ревью кода`):** rejection config, trail или layout
  subscription изолирован: остальные подписки всё равно предпринимаются,
  успешные не дублируются, unhandled rejection и full-load retry storm нет.
- **AC8 (`smoke`):** тот же cold сценарий с `kiosk: true` рендерит полный план
  при скрытом header; никакого пользовательского действия для восстановления
  не требуется.
- **AC9 (`unit` + `ревью кода`):** обязательный `config/get`, `layout/get` или
  asset failure продолжает действующий stale-while-revalidate/recovery путь;
  optional и mandatory errors не смешиваются.
- **AC10 (`ревью кода`):** исправление не выдаёт право записи, не вызывает
  write/service API, не показывает редакторы при `can_write: false` и не меняет
  backend/security boundary.
- **AC11 (`unit` + `ревью кода`):** на успешную карточку остаётся не более одной
  подписки каждого типа; нормализация не добавляется в HA state render hot path.
- **AC12 (`build` + `ревью кода`):** оба changelog и архитектурный документ
  описывают исправление, пользовательское руководство остаётся правдивым без
  нового контракта, а три bundle snapshot после build побайтно совпадают.

## 12. План автотестов и проверок

### Unit

1. Выделить или напрямую покрыть pure resolution matrix из AC1/AC5.
2. Покрыть mandatory/optional orchestration контролируемыми fulfilled/rejected
   Promises: порядок finalization, независимость трёх подписок, idempotency и
   отсутствие retry от optional failure.
3. Сохранить регрессию обязательного fetch/asset failure из AC9.

### Browser smoke

Новый узкий сценарий создаёт отдельную full card с пустым House Plan
localStorage, non-admin hass, `can_write: false`, двумя пространствами с ID, не
равными `f1`, и управляемыми subscription outcomes. Он проверяет AC3/AC4/AC6/AC8
по внутреннему exact state и реальному shadow DOM, а не только по `_model`
fallback.

По действующему решению владельца в цикле реализации запускаются только
`typecheck`, unit и build. Smoke добавляется вместе с кодом, а его штатный
прогон входит в pre-beta browser-smoke gate; независимый код-ревьюер вправе
выполнить целевой сценарий для проверки AC.

### Golden и ручные изображения

Нового намеренного визуала нет: правильный результат уже совпадает с состоянием
после клика и существующими View/golden. Новые baseline и их принятие не нужны.
Скриншоты до/после уже приложены к issue и используются как диагностическая
ссылка, не как новый эталон.

## 13. Производительность и security

Изменение выполняется один раз на structural load, а не на HA state tick.
Дополнительного boolean geometry, DOM-слоя, polling или per-frame resolver нет.
Количество успешных подписок не растёт. Performance benchmark и новый budget
не нужны; штатный performance gate остаётся pre-beta проверкой.

Security boundary не ослабляется: read-only-пользователь только использует уже
разрешённые read calls. Запрещённая подписка не эмулируется, backend permission
не обходится, write API не вызывается. Отдельный security artifact не нужен.

## 14. Риски

1. **Регрессия precedence:** повторная нормализация может затереть valid hash или
   same-route warm viewport. Закрывается AC1/AC5/AC6.
2. **Дубликаты подписок:** независимый retry может создать два listener после
   позднего успеха. Закрывается authority через `_unsub*` и AC7/AC11.
3. **Ложный успех mandatory load:** слишком широкий `catch` может скрыть отказ
   config/layout/asset. Закрывается явной границей phases и AC9.
4. **Partial live-sync:** read-only-сессия может не получать последующие внешние
   изменения. Это допустимая деградация запрещённой подписки, но initial snapshot
   обязан оставаться полным.
5. **Cache leakage между browser tests:** сценарий должен изолировать и очищать
   House Plan keys, иначе валидный admin-cache маскирует регрессию.

## 15. Release-артефакты

Поскольку исправление пользовательски видимо, реализационный коммит содержит:

- `docs/CHANGELOG.md` — EN bug-fix bulletin со ссылкой на #131;
- `docs/CHANGELOG.ru.md` — эквивалентный RU bulletin со ссылкой на #131;
- `docs/ARCHITECTURE.md` — граница mandatory initial snapshot и best-effort
  live-sync subscriptions, плюс invariant exact space;
- user guide — **без изменения**: он уже обещает правильный first space,
  read-only View и полноценный kiosk/touch; задача приводит код к этому тексту;
- новый unit и browser regression scenario;
- build-синхронизация `dist/houseplan-card.js`,
  `custom_components/houseplan/frontend/houseplan-card.js` и
  `demo/srv/assets/houseplan-card.js`.

Golden baseline, screenshots, migration, backend, performance и security
артефакты не создаются по причинам из разделов 9, 12 и 13. Перед бетой идут
штатные golden verify, полный browser smoke и performance gate по release runbook.

## 16. Откат

Откат — обычный revert frontend-изменения и синхронных документации/changelog/
тестов/bundle snapshot. Данные и localStorage форматы не меняются, поэтому
чистить cache или восстанавливать конфигурацию не требуется.

После отката у затронутой read-only-сессии вернётся прежний неполный cold frame;
пользовательским временным обходом остаётся выбор пространства там, где header
доступен. Feature flag и обратная миграция не нужны.

## 17. Принятые технические предположения — можно менять без пересмотра продукта

1. Предпочтительно выделить один pure resolver cold precedence, но точное имя и
   файл не являются продуктовым решением.
2. Подписки можно устанавливать после mandatory finalization последовательно
   с локальными `try/catch` или общей best-effort orchestration; наблюдаемый
   контракт и AC важнее формы.
3. Повторная попытка rejected subscription использует следующий штатный
   load/reconnect, без отдельного polling timer.
4. Отказ optional subscription остаётся тихим: новый UX ограниченных live
   updates потребовал бы отдельного продуктового решения.
5. Browser smoke может расширить существующий WS/warm lifecycle scenario вместо
   нового файла, если сохраняет изоляцию cache и все проверки AC.
6. Valid same-route warm viewport трактуется как уже принятое пространство, а
   не как новый пятый cold persistence source; explicit valid hash сохраняет
   действующий приоритет.
