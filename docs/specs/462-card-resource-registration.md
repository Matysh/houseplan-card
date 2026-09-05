# #462 — Надёжная регистрация frontend-ресурса и восстановление после обновления

- **Issue:** https://github.com/Matysh/houseplan-card/issues/462
- **Тип / приоритет:** bug / P1
- **Трек:** полный; меняются backend lifecycle, websocket-протокол и обязательный
  View/kiosk UX
- **Оценка:** пользовательская ценность 10/10; ценность для разработки 8/10;
  сложность 7/10; риск 8/10
- **Связано:** #2, #295, #353, #412; `docs/SCOPE.md`,
  `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md`,
  `docs/CONFIG-COMPATIBILITY.md`

## 1. Сценарий

Администратор устанавливает House Plan через HACS, добавляет интеграцию и
перезапускает Home Assistant. Либо обновляет уже установленную интеграцию. В
открытой вкладке карточка отсутствует в picker или продолжает исполнять старый
frontend bundle, хотя backend и файл новой версии уже доступны.

Пользователь должен получить три независимых уровня помощи:

1. корректную инструкцию для своего режима Lovelace;
2. видимую диагностику способа подключения ресурса на стороне HA;
3. понятное восстановление при несовпадении уже загруженной карточки и backend.

На настенной панели в kiosk обновление применяется само, но только в момент,
когда перезагрузка не уничтожит действие пользователя и не создаст reload-loop.

## 2. Что человек увидит до и после

**До:** документация предлагает невалидный верхнеуровневый `resources:`,
storage-пользователь применяет YAML, который его dashboard игнорирует, отказ
авторегистрации скрыт в логе, а старая вкладка выглядит как актуальная. Иногда
помогает только угаданный `Ctrl+F5`.

**После:** документация отдельно описывает storage и YAML; HA сообщает, что
нужно перезагрузить frontend, пока совпадающий bundle действительно не
подключился; System Health показывает файл, статический путь, способ регистрации
и URL. Уже загруженная full card при несовпадении версий показывает компактную
плашку с перезагрузкой. Kiosk выполняет не более одной тихой перезагрузки для
конкретной пары версий и при неуспехе показывает ту же плашку.

## 3. Подтверждённая причина

На `dev` `16b4c2d6` (`v1.72.0-beta.4`) подтверждены все исходные разрывы:

- README и оба User Guide показывают плоский `resources:` без `lovelace:` и не
  разделяют storage/YAML mode;
- `_register_lovelace_resource()` возвращает один `False` для отсутствующего
  реестра, YAML mode и исключения, поэтому lifecycle не может отличить
  устойчивый fallback от временной гонки;
- fallback `add_extra_js_url()` невидим в UI и не ожидается Lovelace перед
  построением dashboard;
- `manifest.json` не содержит `after_dependencies: ["lovelace"]`, повторной
  попытки нет;
- System Health содержит только статистику плана;
- backend уже отдаёт `integration_version`, а full card уже знает
  `CARD_VERSION`, но сравнение живёт в lazy editor runtime и не защищает View
  или kiosk;
- браузер не может переопределить уже зарегистрированный custom element без
  reload документа. Кэш-бастинг `?v=<VERSION>` исправен и не является причиной.

Полевой сценарий #462 завершился после `Ctrl+F5`, поэтому задача не меняет путь
раздачи или стратегию кэш-бастинга: она делает существующий механизм надёжным и
наблюдаемым.

Гипотеза о штатной startup-race **не подтверждена**: и в минимально
поддерживаемом HA 2024.6, и в актуальном HA 2026.8 hard dependency
`houseplan → frontend → lovelace` должна подготовить `hass.data["lovelace"]` до
setup entry. Явный `after_dependencies` документирует намерение и страхует
изменение upstream-графа; one-shot retry восстанавливает искусственный transient
отказ/исключение, но ни один release note не называет гонку установленной
причиной полевого случая.

## 4. Решения владельца

1. В обычном режиме автоматической перезагрузки нет.
2. В kiosk разрешена тихая перезагрузка только при безопасном состоянии.
3. Минимальные обязательные guards переиспользуют смысл `_cycleTick`:
   `Date.now() >= _cyclePausedUntil` и `_zoom <= 1.001`; дополнительно запрещены
   editor, dialog и незавершённые physical writes.
4. На одну пару несовпадающих версий допустима ровно одна автоматическая
   перезагрузка в рамках browser-tab session. Отметка записывается до reload.
5. Если после неё версии всё ещё различаются, повтор запрещён и показывается
   ручная плашка.

## 5. Термины и границы

- **Storage mode** — ресурсы управляются UI HA. Интеграция может создавать и
  обновлять запись Lovelace resource registry.
- **YAML mode** — ресурсы объявляются под `lovelace.resources` в
  `configuration.yaml`; backend не пишет их в registry.
- **Fallback** — подключение через `add_extra_js_url` при недоступном для записи
  registry. Это поддерживаемая деградация, но она требует reload документа.
- **Совпадение версий** — точное равенство непустых строк `CARD_VERSION` и
  `integration_version`. Порядок semver не угадывается: frontend может быть как
  старее, так и новее backend.
- **Неизвестная версия** — одна из сторон не предоставила корректную непустую
  строку. Она не считается mismatch и не запускает notice/reload.
- **Full card** — `custom:houseplan-card`. Runtime-плашка и kiosk auto-reload
  относятся к ней. `custom:houseplan-space-card` загружается тем же bundle и
  подтверждает его версию backend, но отдельный runtime banner/kiosk-контроллер
  в этой задаче не получает.

## 6. Скоуп

1. Исправление README EN/RU и английского/русского User Guide: установка,
   storage/YAML развилка и hard reload.
2. Типизированный результат регистрации ресурса вместо boolean.
3. `after_dependencies: ["lovelace"]`, одна lifecycle-bound повторная попытка
   после старта HA для временно недоступного registry и корректная отмена при
   unload.
4. Взаимоисключающий финальный loader: Lovelace registry либо
   `extra_module_url`; fallback удаляется, если retry успешно перешёл на
   registry.
5. Локализованная Repairs-подсказка о необходимости загрузить новый frontend;
   она снимается только после подтверждения совпадающего bundle.
6. Опциональный `card_version` в `houseplan/config/get`; его передают full и
   space card. Старые клиенты без поля полностью совместимы.
7. Состояние frontend-регистрации в System Health.
8. Runtime version mismatch controller в initial full-card bundle, без импорта
   lazy editor runtime.
9. Ручная плашка и безопасная одноразовая kiosk-перезагрузка.
10. i18n EN/RU/DE/FR, backend/unit/browser/mutation проверки, документация и два
    changelog.

## 7. Не входит

- изменение `/houseplan_files/houseplan-card.js` или query cache busting;
- горячая замена custom element без reload документа;
- поддержка одиночного JS без установленной интеграции;
- автоматическое изменение пользовательского `configuration.yaml`;
- отдельная update-плашка и kiosk-режим для `houseplan-space-card`;
- общий менеджер обновлений HACS/HA и проверка наличия новой версии в сети;
- повторные бесконечные polling/backoff попытки Lovelace registry;
- перестройка picker или dashboard UI Home Assistant.

## 8. Backend-контракт регистрации

### 8.1 Типизированный результат

Одна функция регистрации возвращает структурированный outcome, достаточный для
диагностики и решения lifecycle, минимум со следующими состояниями:

| Outcome | Смысл | Финальный loader |
|---|---|---|
| `created` | запись resource создана | `lovelace_resource` |
| `updated` | URL существующей записи обновлён до текущей версии | `lovelace_resource` |
| `existing` | точный URL уже существовал | `lovelace_resource` |
| `registry_pending` | registry ещё не появился/не загрузился | временно fallback, затем один retry |
| `yaml_fallback` | registry сознательно недоступен для записи | `extra_module_url` |
| `error_fallback` | безопасно перехвачен неожиданный отказ | `extra_module_url` |

Outcome включает безопасный короткий `last_error` только для диагностики; stack
trace, токены и пути вне config не попадают в System Health.

### 8.2 Lifecycle и retry

1. Статический путь регистрируется как сейчас, один раз на HA run.
2. При наличии файла выполняется первая попытка registry.
3. `created/updated/existing` завершают путь без `extra_module_url`.
4. `registry_pending` включает fallback немедленно и ставит ровно один callback
   через штатный HA start helper. Helper выполняется после старта либо сразу,
   если HA уже running.
5. Callback зарегистрирован через `entry.async_on_unload`; unload/remove до его
   выполнения делает его no-op и не может воскресить удалённую интеграцию.
6. Успешный retry удаляет через штатный frontend helper только тот exact
   versioned URL, который этот setup сам добавил в `extra_module_url`, и
   фиксирует registry как финальный loader. Чужие URL не затрагиваются.
7. Неуспешный retry превращает состояние в устойчивый fallback. Нового timer,
   tight loop и накопления listeners нет.
8. `yaml_fallback` и `error_fallback` не создают бесконечный retry. Повторный
   setup остаётся идемпотентным.
9. Несколько найденных legacy resource entries не размножаются: authority —
   одна каноническая запись; существующее best-effort удаление при uninstall
   очищает все записи с base URL.

Если HA API текущей минимально поддерживаемой версии не предоставляет удаление
`extra_module_url`, реализация не создаёт два разных URL: это фиксируется как
`lovelace_resource_with_session_fallback` в диагностике до следующего reload, а
registry остаётся authority для будущих документов. Предпочтителен доступный
штатный `remove_extra_js_url`.

### 8.3 Наблюдаемое runtime-состояние

В `hass.data[DOMAIN]` хранится только состояние текущего run:

- `card_file_present`;
- `static_path_registered`;
- `resource_status` — последний outcome;
- `loader` — `lovelace_resource`, `extra_module_url`,
  `lovelace_resource_with_session_fallback` или `none`;
- `module_url` — точный versioned URL;
- `retry_pending` и `retry_attempted`;
- безопасный `last_error` либо `null`.

Отсутствующий bundle не валит setup: `loader=none`, файл `false`, warning и
честный System Health. Ложное значение `static_path_registered=true` до
успешного вызова HA API запрещено.

## 9. Уведомление и подтверждение загрузки frontend

Используется локализованный Repairs issue с постоянным ID
`frontend_reload_required`, severity `warning`, `is_fixable=false`. Это
технический выбор в рамках разрешённого владельцем «Repairs или persistent
notification»: Repairs даёт клиентскую локализацию и может автоматически
исчезнуть после доказанного результата.

### 9.1 Публикация

- При доступном frontend-файле backend создаёт/обновляет issue для текущего
  `VERSION`, если эта версия ещё не подтверждена браузером.
- Подтверждённая версия хранится в служебном поле config entry, отдельно от
  плана. Отсутствие поля у старой установки означает «не подтверждено» и не
  требует миграции данных плана.
- Повторный setup той же уже подтверждённой версии не создаёт кратковременное
  ложное issue. Для новой или downgraded версии issue создаётся снова.
- Текст сообщает: интеграция готова; перезапустите HA после незавершённого
  обновления, затем полностью перезагрузите страницу (`Ctrl+F5` /
  `Cmd+Shift+R`); в storage mode при ручной настройке ресурс находится в
  Settings → Dashboards → Resources.

### 9.2 Подтверждение

`houseplan/config/get` принимает необязательное поле `card_version` — непустую
строку с разумным пределом длины. Full и space card передают `CARD_VERSION` при
каждом штатном initial/reconnect запросе.

- `card_version === VERSION`: backend записывает acknowledgement текущей
  версии и удаляет Repairs issue.
- поле отсутствует, malformed либо не равно `VERSION`: конфигурация всё равно
  возвращается как раньше; acknowledgement и issue не меняются.
- side effect не требует write permission: загрузить совпадающий публичный
  bundle может любой аутентифицированный пользователь, а изменение касается
  только служебной подсказки, не плана.
- одновременные совпадающие запросы идемпотентны и не вызывают reload config
  entry.
- uninstall удаляет Repairs issue; служебное поле исчезает вместе с entry.

Первый релиз механизма намеренно покажет issue существующим установкам, пока
хотя бы один браузер не загрузит новый bundle. Это закрывает переходный случай,
когда старый frontend ещё не умеет показать runtime-плашку.

## 10. System Health

`system_health_info()` сохраняет существующую статистику и добавляет
локализованные ключи:

| Поле | Значение |
|---|---|
| `card_file` | `present` / `missing` |
| `static_path` | `registered` / `not_registered` |
| `resource_status` | последний типизированный outcome либо `not_attempted` |
| `resource_loader` | финальный loader из §8.3 |
| `resource_url` | точный `FRONTEND_URL?v=VERSION` либо `unavailable` |
| `resource_retry` | `pending` / `attempted` / `not_needed` |
| `resource_error` | безопасная причина либо `none` |

Ключи `system_health.info.*` добавляются в `strings.json` и EN/RU/DE/FR
translations по контракту HA. Значения остаются короткими и пригодными для
копирования в support report. System Health не обещает, что конкретная вкладка
браузера уже перезагружена: это показывает Repairs acknowledgement и runtime
сравнение.

## 11. Frontend version controller

### 11.1 Источник истины

Контроллер находится в initial graph full card, использует только
`CARD_VERSION` и последний корректный `integration_version` из успешного
`config/get`. Lazy editor runtime не загружается ради проверки.

Каждый успешный `config/get` авторитетен: отсутствующее или malformed
`integration_version` очищает ранее принятое значение до `unknown`, а не
оставляет stale mismatch от предыдущего ответа/reconnect.

Матрица:

| Frontend | Backend | Обычный режим | Kiosk |
|---|---|---|---|
| unknown | любой | ничего | ничего |
| `A` | `A` | ничего | ничего |
| `A` | `B`, пара не пыталась | плашка, только ручной reload | без плашки; при safe state одна auto-попытка |
| `A` | `B`, пара уже пыталась | плашка | плашка, auto запрещён |

Mismatch симметричен. Текст не утверждает, какая сторона новее, и предлагает
завершить restart HA, затем reload страницы.

### 11.2 Плашка

- Компактная overlay-плашка располагается внутри full card над сценой и не
  изменяет высоту editor/header или fit viewport.
- Содержит понятный direction-neutral текст, версии frontend/backend и кнопку
  «Перезагрузить страницу» / `Reload page`.
- Кнопка вызывает `window.location.reload()` только из trusted click/tap.
- Плашка доступна с клавиатуры, имеет `role=status` или эквивалентный live-region
  без повторного объявления на каждый render; touch-target кнопки не менее
  44×44 CSS px.
- Она не перехватывает pan/zoom вне своей поверхности, не закрывает основной
  navigation и не меняет focus самопроизвольно.
- В обычном режиме отображается при любом известном mismatch, включая editor и
  открытый dialog; reload остаётся осознанным действием пользователя.
- В kiosk плашка до первой разрешённой auto-попытки не показывается: это
  осознанное исключение из обычного mismatch UX ради тихого обновления настенной
  панели. Если safe state долго не наступает, карточка сохраняет текущий кадр;
  после первой попытки и сохранившегося mismatch появляется обычная плашка.
- Motion — короткое opacity-появление/исчезновение; при
  `prefers-reduced-motion: reduce` без анимации.

### 11.3 Ровно одна тихая kiosk-перезагрузка

Attempt хранится в `sessionStorage` под namespaced key и содержит точную пару
`CARD_VERSION + integration_version`. Один module-level helper разделяет его
между всеми full card на странице.

1. Перед `location.reload()` pair синхронно записывается в `sessionStorage`.
2. Та же pair после reload или в другом card instance не получает вторую
   auto-попытку.
3. Новая pair может получить одну новую попытку.
4. Manual button не очищает guard и не обещает auto retry.
5. Если `sessionStorage` читать или писать нельзя, fail-safe — banner и никакой
   автоматической перезагрузки.
6. Совпадение версий не требует очищать историю; хранится только одна небольшая
   pair, без плана, entity ID и других пользовательских данных.

Auto-reload разрешён только при одновременном выполнении:

- `config.kiosk === true` и компонент connected;
- initial server load завершён, есть полный settled frame, нет recovery/loading;
- режим `view`, `_editing === false`;
- ни один first-class dialog/confirm/menu overlay не открыт; единый predicate
  обязан включать как минимум editor-secondary dialogs, room/partition delete,
  import, backdrop guard, danger confirm и незавершённый `_vacFit`;
- `_pendingPhysicalWrites.size === 0`, `_writesPending === 0` и нет
  незавершённой config write chain;
- нет активного pointer/pinch/swipe/drag gesture или mode transition;
- `Date.now() >= _cyclePausedUntil`;
- `_zoom <= 1.001`.

Проверка идёт независимым bounded controller/timer: `cycle: 0` не отключает
механизм. Одновременно существует не более одного timer на card; disconnect,
совпадение версий и смена pair его отменяют. Проверка не чаще одного раза за
animation frame/разумный timer и не добавляется в HA state render hot path.

## 12. Документация установки

`README.md`, `README.ru.md`, `docs/USER-GUIDE.md` и
`docs/USER-GUIDE.ru.md` содержат одну и ту же развилку:

### Storage mode (HA default)

Обычно ручная запись не нужна. Если автоматическое подключение не сработало:
Settings → Dashboards → меню ⋮ → Resources → Add resource; URL
`/houseplan_files/houseplan-card.js`, type JavaScript module. После установки или
изменения ресурса полностью reload страницы; hard reload shortcuts названы.

### YAML mode

Показан валидный top-level snippet:

```yaml
lovelace:
  mode: yaml
  resources:
    - url: /houseplan_files/houseplan-card.js
      type: module
```

Явно сказано, что `lovelace.resources` не подключает resource к storage-managed
dashboard, а UI Resources не заменяет YAML для YAML-managed dashboard. Путь
`/custom_components/...` остаётся явно запрещён.

## 13. Модель данных, compatibility и миграция

- Формат плана, layout, storage schema и card config не меняются.
- Websocket-поле `card_version` опционально; старые frontend продолжают получать
  прежний ответ. `integration_version` остаётся ответным compatibility-полем.
- Служебное acknowledgement в config entry читается как optional string.
  Отсутствующее/невалидное значение означает «не подтверждено»; schema migration
  и перепись планов не нужны.
- `sessionStorage` — transient browser-tab metadata, не экспортируется и не
  синхронизируется.
- Downgrade безопасен: старый backend игнорирует невозможный для него новый
  request field только если его schema это допускает; поэтому новый frontend
  должен при `invalid_format` один раз повторить `config/get` без
  `card_version`, принять ответ и перейти в состояние unknown вместо load-loop.
  Этот compatibility retry выполняется не чаще одного раза на load.
- Возврат к backend, где поле уже поддержано, снова включает handshake.

## 14. i18n

Новые строки добавляются одновременно:

- frontend EN/RU/DE/FR: заголовок/текст version mismatch, подписи обеих версий,
  кнопка reload;
- backend `strings.json` + EN/RU/DE/FR: Repairs title/description и ключи
  `system_health.info.*`;
- документация EN/RU синхронна по смыслу.

Тексты не говорят «backend новее» и не обещают, что один reload всегда исправит
незавершённое обновление. Значения status enum в System Health не требуют
перевода для машинной диагностики, но их названия полей локализованы.

## 15. Критерии приёмки

### AC1 — документация режима (`unit`/docs contract)

Оба README и оба User Guide содержат `lovelace:` перед YAML `resources:`,
отдельную storage UI-инструкцию и hard reload shortcuts. Возврат плоского
top-level `resources:` делает docs contract красным.

### AC2 — честный outcome регистрации (`backend`)

Backend различает `created`, `updated`, `existing`, `registry_pending`,
`yaml_fallback`, `error_fallback`; существующая запись обновляется без дубля, а
отсутствующий файл не сообщает успешный loader.

### AC3 — lifecycle retry без двойного loader (`backend` + mutation)

Registry отсутствует на первой попытке и появляется к HA started: один retry
регистрирует канонический resource и снимает fallback либо честно маркирует его
остаток. Unload до event отменяет callback; повторный setup не накапливает
listeners. Мутанты «удалить retry» и «не привязать callback к unload» краснеют.

### AC4 — Repairs handshake (`backend` + mutation)

Неподтверждённая текущая версия создаёт локализованный Repairs issue; совпадающий
`card_version` сохраняет acknowledgement и удаляет issue. Missing/malformed/
different version не блокирует чтение config и не снимает issue. Повторный setup
подтверждённой версии не создаёт его снова; uninstall очищает. Мутант
«подтверждать любую версию» краснеет.

### AC5 — System Health (`backend`)

Матрица missing file / registry success / pending→success / YAML fallback /
exception возвращает правдивые поля §10, точный versioned URL и безопасную
ошибку. Существующая статистика плана не исчезает.

### AC6 — точное frontend-сравнение (`unit` + mutation)

Pure controller покрывает equal, symmetric mismatch, unknown и смену pair.
В обычном режиме banner существует iff известен mismatch; kiosk-исключение до
первой auto-попытки соответствует матрице §11.1. Отключение сравнения или
принятие unknown за mismatch ловится unit/mutation gate.

### AC7 — обычный режим никогда не reload сам (`unit` + browser + mutation)

При mismatch full card показывает плашку, но любое ожидание без click оставляет
`location.reload` невызванным. Trusted button вызывает один reload. Мутант,
разрешающий timer reload при `kiosk !== true`, краснеет.

### AC8 — kiosk safety (`unit` + browser + mutation)

Каждый отдельный unsafe guard из §11.3 блокирует auto-reload; после перехода в
полностью safe state pair записывается до ровно одного reload. Минимум мутанты
«игнорировать pause», «игнорировать dialog/editor», «игнорировать pending write»
и «помечать attempt после reload» детерминированно краснеют.

### AC9 — защита от reload-loop (`unit` + browser + mutation)

После simulated reload тот же mismatch показывает banner и не вызывает reload
повторно; второй card instance той же вкладки также не вызывает. Новая pair
получает одну попытку. Исключение storage переводит в manual-only. Мутант
«игнорировать сохранённую pair» краснеет.

### AC10 — full/space handshake и граница UX (`unit`/browser)

Обе карточки посылают `CARD_VERSION` и могут подтвердить загрузку bundle.
Runtime banner/auto-reload рендерит только full card; space card не падает и не
теряет config при новом ответном поле.

### AC11 — downgrade и lifecycle compatibility (`unit` + backend)

Старый backend, отклонивший request с `card_version`, получает один fallback
request без поля; загрузка завершается без retry storm. Setup/unload/remove и
существующие `test_ha_setup.py` остаются зелёными.

### AC12 — View/touch/a11y и визуальная стабильность (`browser` + golden)

Плашка не меняет stage bounds/fit, доступна клавиатурой и touch, не блокирует
жесты сцены вне себя, не двигает focus. Desktop, узкий touch viewport и kiosk
after-failed-attempt имеют принятый screenshot/golden; reduced-motion вариант
не анимируется.

### AC13 — сборка и синхронные артефакты (`build` + ревью кода)

Typecheck/unit/backend/build/bundle parity/no-new-any/check-docs и целевые smoke
зелёные; EN/RU/DE/FR ключи полны; оба changelog и пользовательская документация
обновлены. Три коммитящихся bundle-копии побайтно совпадают.

## 16. План тестов и отрицательные доказательства

### Backend

- расширить `tests_backend/test_ha_setup.py` матрицей outcomes, delayed registry,
  listener cleanup, idempotent reload, missing bundle и uninstall cleanup;
- отдельные тесты `system_health_info` для §10;
- websocket schema/handshake: equal, missing, malformed, mismatch, concurrent
  equal и старый client;
- mutation witnesses для retry, unload-bound callback и exact acknowledgement.

### Frontend unit

- pure mismatch/session guard controller без DOM;
- exact pair, storage exception, multiple instances, mark-before-reload;
- каждый safe predicate независимо false/true;
- compatibility request fallback на old backend.

### Browser smoke/golden

- full card mismatch в обычном View: banner, стабильный stage bbox, no auto,
  click reload spy;
- kiosk mismatch: unsafe→safe без предварительной плашки, one auto;
  remount/reload с той же pair — banner и zero auto;
- editor/dialog/pending-write/zoom/recent interaction отдельными probes;
- narrow touch + keyboard focus + reduced motion;
- space card успешно отправляет handshake без runtime banner.

### Docs/mutation

- статический parser проверяет не просто строку `lovelace:`, а вложенность
  `resources` в каждом canonical snippet и отдельную storage-инструкцию;
- `scripts/mutation-gate.mjs` хранит дорогие backend/browser mutants из AC3,
  AC4, AC7–AC9 с точными target test commands;
- в документе code review каждый защитный AC получает строку «чем краснеет» по
  §2.7 `PROCESS.md`.

## 17. Затронутые файлы и модули

Ожидаемый минимум:

- `custom_components/houseplan/__init__.py`, `manifest.json`,
  `system_health.py`, `repairs.py`, `websocket_api.py`, runtime/store typing;
- `custom_components/houseplan/strings.json` и translations EN/RU/DE/FR;
- `src/houseplan-card.ts`, shared websocket/config client для обеих cards,
  небольшой pure version controller, frontend i18n EN/RU/DE/FR и CSS;
- `README.md`, `README.ru.md`, `docs/USER-GUIDE.md`,
  `docs/USER-GUIDE.ru.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`,
  `docs/TESTING.md`, оба changelog;
- backend/unit/browser/docs/mutation tests и синхронные generated bundles.

Точные helper names и разбиение pure-модулей остаются за реализацией; границы
поведения и доказательства менять нельзя без актуализации ТЗ.

## 18. Производительность и security

- Registry retry — максимум один callback на entry setup; polling отсутствует.
- Version comparison — O(1) только после config response/update, не на каждый HA
  state tick и не внутри geometry/render hot path.
- Kiosk использует один bounded timer только пока существует непредпринятый
  mismatch; после match/attempt/disconnect timer уничтожается.
- Banner добавляет постоянный DOM только во время mismatch. Geometry/Glow/device
  pipelines не меняются; новый performance capture не нужен, но штатные budget
  gates обязательны.
- `card_version` — недоверенная bounded строка, не используется как URL/path и
  не даёт write capability. В System Health не попадают traceback, секреты,
  внешние filesystem paths или пользовательская конфигурация.
- Repairs acknowledgement не меняет план и доступен обычному authenticated
  клиенту; resource registration/removal остаётся серверной операцией.

## 19. Риски

1. **Двойное исполнение bundle:** fallback и resource могут сосуществовать после
   retry. Закрывается единым exact URL, удалением fallback и AC3.
2. **Ложное вечное Repairs issue:** закрывается matching handshake и persistent
   acknowledgement текущей версии.
3. **Ложное снятие issue старым frontend:** exact equality и malformed tests.
4. **Reload-loop kiosk:** sessionStorage pair до reload и AC8/AC9.
5. **Потеря правки:** полный safe predicate, обычный режим manual-only.
6. **Frontend новее backend:** direction-neutral copy и symmetric matrix.
7. **Old backend rejects new request key:** один compatibility retry без поля.
8. **Несколько cards/tabs:** attempt общий в пределах вкладки, но не между
   вкладками; это намеренная граница `sessionStorage`.
9. **HA startup race/uninstall:** after dependency, one-shot lifecycle callback,
   unload cancellation и removal tests.
10. **Заблуждающий System Health:** отдельные file/static/loader/outcome/error
    поля, без обещания browser state.

## 20. Rollback

Откат — один revert продуктового коммита и синхронных тестов/документации/
bundles. План и layout не мигрируют. Старый backend игнорирует служебное поле
acknowledgement в config entry; при необходимости оно безопасно удаляется
следующим setup/removal, но не требует ручного вмешательства.

После отката вернутся невидимый fallback и необходимость ручного reload;
зарегистрированный Lovelace resource с прежним корректным URL останется
работоспособным. Удаление интеграции продолжает убирать ресурс.

## 21. Release-артефакты

Поскольку исправление пользовательски видимо:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` получают короткий пункт со ссылкой
  на #462;
- README и User Guide EN/RU меняются по §12; `docs/TESTING.md` больше не
  утверждает старый reload-контракт;
- `docs/ARCHITECTURE.md` фиксирует authority resource loader, handshake и
  full-card version controller;
- `docs/DEVELOPMENT.md` фиксирует backend/frontend version test seam и
  lifecycle retry;
- принимаются три целевых golden/screenshot из AC12; изменение `src/**` требует
  актуального Linux `Docs screenshots` artifact и fingerprint acceptance;
- release performance/security отдельных отчётов не требует; штатные gates и
  pre-beta runbook остаются обязательными;
- generated bundle trees обновляются только через штатный build.

## 22. Принятые технические предположения — можно менять на ревью

1. Repairs выбран вместо `persistent_notification`, потому что даёт HA-native
   локализацию и доказанное автоматическое закрытие; пользовательский результат
   остаётся тем же.
2. Acknowledgement хранится в `entry.data`, а не в плане или layout; точное имя
   поля внутреннее.
3. One-shot retry использует `homeassistant.helpers.start.async_at_started` либо
   эквивалентный lifecycle helper, привязанный к unload.
4. Loader outcome может быть dataclass/enum/typed dict; публичны только значения
   System Health.
5. Banner в kiosk появляется только после уже предпринятой auto-попытки для этой
   pair; до неё сохраняется тихий текущий кадр, как решил владелец.
6. One-pair `sessionStorage` достаточно: новая target pair заменяет старую, а не
   создаёт неограниченный список.
7. Проверка всех dialog/gesture состояний может быть выделена в общий pure
   snapshot helper; перечисление §11.3 является обязательным контрактом.
