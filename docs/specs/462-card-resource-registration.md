# #462 — Надёжная регистрация frontend-ресурса и восстановление после обновления

- **Issue:** https://github.com/Matysh/houseplan-card/issues/462
- **Тип / приоритет:** bug / P1
- **Трек:** полный; меняются backend lifecycle, frontend recovery-controller и
  обязательный View/kiosk UX
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

**После:** документация отдельно описывает storage и YAML; после первой
доступной регистрации HA один раз сообщает, что нужно полностью перезагрузить
frontend; System Health показывает файл, статический путь, способ регистрации и
URL. Уже загруженная full card при несовпадении версий показывает компактную
плашку с перезагрузкой. Kiosk выполняет не более одной тихой перезагрузки для
конкретной целевой backend-версии и при неуспехе показывает ту же плашку.

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

Версионная граница YAML resources подтверждена первичными upstream-источниками,
а не экстраполяцией по HA 2025.x:

- Home Assistant Core PR
  [#161816](https://github.com/home-assistant/core/pull/161816), merged в milestone
  2026.2.0 коммитом
  [`190fe10`](https://github.com/home-assistant/core/commit/190fe10), прямо
  «introduce a new key: `resource_mode` to replace `mode`» и отделяет загрузку
  ресурсов от режима dashboard;
- исходник тега
  [2026.2.0](https://github.com/home-assistant/core/blob/2026.2.0/homeassistant/components/lovelace/__init__.py)
  содержит `CONF_RESOURCE_MODE`, отдельное поле `LovelaceData.resource_mode` и
  fallback на legacy `mode`;
- [актуальная официальная документация HA](https://www.home-assistant.io/dashboards/dashboards/)
  требует `resource_mode: yaml` для `lovelace.resources` и описывает его отдельно
  от `dashboards.*.mode`.

Поэтому HA до 2026.2 и HA 2026.2+ намеренно получают разные snippets; это не
противоречит исходному репорту, который описывает storage mode старого HA.

## 4. Решения владельца

1. В обычном режиме автоматической перезагрузки нет.
2. В kiosk разрешена тихая перезагрузка только при безопасном состоянии.
3. Минимальные обязательные guards переиспользуют смысл `_cycleTick`:
   `Date.now() >= _cyclePausedUntil` и `_zoom <= 1.001`; дополнительно запрещены
   editor, dialog и незавершённые physical writes.
4. На одну целевую `integration_version` допустима ровно одна автоматическая
   перезагрузка в рамках browser-tab session. Отметка записывается до reload;
   смена/чередование frontend bundle при той же backend-версии не даёт новую
   попытку.
5. Если после неё версии всё ещё различаются, повтор запрещён и показывается
   ручная плашка.

## 5. Термины и границы

- **Storage mode** — ресурсы управляются UI HA. Интеграция может создавать и
  обновлять запись Lovelace resource registry.
- **YAML resources mode** — ресурсы объявляются под `lovelace.resources` в
  `configuration.yaml`; backend не пишет их в registry. В HA 2026.2+ режим
  выбирается независимым `lovelace.resource_mode: yaml` и не переводит сами
  dashboards из storage в YAML.
- **Legacy full-YAML dashboard mode** — совместимый с поддерживаемыми HA
  2024.6–2026.1 вариант `lovelace.mode: yaml`; он управляет не только ресурсами,
  но и самим dashboard, поэтому не предлагается пользователю storage dashboard
  как равнозначная замена современному `resource_mode`.
- **Fallback** — подключение через `add_extra_js_url` при недоступном для записи
  registry. Это поддерживаемая деградация, но она требует reload документа.
- **Совпадение версий** — точное равенство непустых строк `CARD_VERSION` и
  `integration_version`. Порядок semver не угадывается: frontend может быть как
  старее, так и новее backend.
- **Неизвестная версия** — одна из сторон не предоставила корректную непустую
  строку. Она не считается mismatch и не запускает notice/reload.
- **Full card** — `custom:houseplan-card`. Runtime-плашка и kiosk auto-reload
  относятся к ней. `custom:houseplan-space-card` загружается тем же bundle, но
  отдельный runtime banner/kiosk-контроллер в этой задаче не получает.

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
5. Локализованное одноразовое persistent notification после первой доступной
   регистрации frontend-ресурса.
6. Состояние frontend-регистрации в System Health.
7. Runtime version mismatch controller в initial full-card bundle, без импорта
   lazy editor runtime.
8. Ручная плашка и безопасная одноразовая kiosk-перезагрузка.
9. i18n EN/RU/DE/FR, backend/unit/browser/mutation проверки, документация и два
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
| `transient_error` | первая попытка упала на load/create/update | временно fallback, затем один retry |
| `error_fallback` | повторная попытка также упала | `extra_module_url` |

Outcome включает безопасный короткий `last_error` только для диагностики; stack
trace, токены и пути вне config не попадают в System Health.

### 8.2 Lifecycle и retry

1. Статический путь регистрируется как сейчас, один раз на HA run.
2. При наличии файла выполняется первая попытка registry.
3. `created/updated/existing` завершают путь без `extra_module_url`.
4. `registry_pending` или первый `transient_error` включает fallback немедленно
   и ставит ровно одну отложенную попытку: штатный HA start helper дожидается
   running-state, после чего cancellable lifecycle timer даёт registry ещё одну
   фиксированную bounded паузу в 1 секунду. Если HA уже running, start helper
   вызывается сразу, но секундная пауза всё равно сохраняется — retry не должен
   повторять transient отказ в том же tick.
5. Отмена start-listener, timer и уже запущенной retry task регистрируется через
   `entry.async_on_unload`. Дополнительный cancellation/generation guard перед
   каждым поздним side effect гарантирует, что unload/remove не воскресит
   удалённую интеграцию даже при гонке с уже начавшейся coroutine.
6. Успешный retry удаляет через штатный frontend helper только тот exact
   versioned URL, который этот setup сам добавил в `extra_module_url`, и
   фиксирует registry как финальный loader. Чужие URL не затрагиваются.
7. Неуспешный retry превращает состояние в устойчивый `error_fallback`. Нового
   timer, tight loop и накопления listeners нет.
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

## 9. Одноразовое уведомление после первой регистрации

Используется локализованное `persistent_notification` со стабильным
namespaced ID. Это информационный onboarding, а не сохраняемая неисправность:
backend не пытается определять, какую из вкладок пользователь уже обновил, и не
создаёт Repairs issue.

- Уведомление создаётся ровно один раз за жизнь config entry после первой
  доступной регистрации frontend: `created`, `updated`, `existing` или
  поддерживаемый fallback при наличии файла и зарегистрированного static path.
- Флаг «уведомление уже создано» записывается в служебное поле config entry
  сразу после того, как синхронный callback `persistent_notification.async_create`
  вернулся без исключения. Он не зависит от backend `VERSION`.
- Существующая установка без поля получает одно уведомление при первом setup
  версии с #462. После этого update/downgrade/reload entry его не возвращают.
- Dismiss уведомления не влияет на интеграцию. После restart HA оно может
  исчезнуть по правилам persistent notification и не создаётся повторно: это
  намеренно одноразовая инструкция, а не контроль прочтения.
- Отсутствующий frontend-файл либо неуспешный static path не устанавливает флаг:
  уведомление появится при первом последующем setup, где frontend доступен.
- Повторный setup, параллельное завершение retry и несколько entries не создают
  дубли: стабильный notification ID и persisted flag являются authority.
- Uninstall dismiss-ит уведомление best effort; служебное поле исчезает вместе
  с entry.
- Текст сообщает: карточка подключена; полностью перезагрузите страницу
  (`Ctrl+F5` / `Cmd+Shift+R`); при ручной настройке storage dashboard ресурс
  находится в Settings → Dashboards → Resources.

Текст берётся через HA `async_get_translations` из совместимой с HA 2024.6
категории `issues` backend translation catalog для языка HA с fallback на
English; EN/RU/DE/FR поставляются одновременно. Использование переводов из
`issues` не превращает сообщение в Repairs issue: показ выполняет только
`persistent_notification`. Это глобальное системное уведомление и поэтому
использует язык экземпляра HA, а не язык конкретной открытой вкладки.

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
| `first_reload_notice` | `created` / `already_created` / `pending_frontend` |

Ключи `system_health.info.*` добавляются в `strings.json` и EN/RU/DE/FR
translations по контракту HA. Значения остаются короткими и пригодными для
копирования в support report. System Health не обещает, что конкретная вкладка
браузера уже перезагружена: одноразовый флаг подтверждает только создание
инструкции, а фактическое состояние показывает runtime-сравнение.

## 11. Frontend version controller

### 11.1 Источник истины

Контроллер находится в initial graph full card, использует только
`CARD_VERSION` и последний корректный `integration_version` из успешного
`config/get`. Lazy editor runtime не загружается ради проверки.

Каждый успешный `config/get` авторитетен. Версия считается известной только если
поле имеет тип string и после `trim()` не пусто; сравнивается нормализованная
trimmed string без предположений о SemVer. Любой другой тип, пустая/whitespace
строка или отсутствующее поле очищает ранее принятое значение до `unknown`, а
не оставляет stale mismatch от предыдущего ответа/reconnect.

Матрица:

| Frontend | Backend | Обычный режим | Kiosk |
|---|---|---|---|
| unknown | любой | ничего | ничего |
| `A` | `A` | ничего | ничего |
| `A` | `B`, target `B` не пытался | плашка, только ручной reload | без плашки; при safe state одна auto-попытка |
| `A` | `B`, target `B` уже пытался | плашка | плашка, auto запрещён |

Mismatch симметричен. Текст не утверждает, какая сторона новее, и предлагает
завершить restart HA, затем reload страницы.

### 11.2 Плашка

- Компактная overlay-плашка располагается в card-level overlay над сценой и не
  изменяет высоту editor/header или fit viewport. Она остаётся доступна и в
  ранних full-card состояниях без готовой сцены (fixed-floor pending/invalid,
  пустая модель), если успешный `config/get` уже подтвердил mismatch; отдельные
  копии разметки в render-ветках не становятся независимыми состояниями.
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
- Известный mismatch не блокирует вход в редактор. Существующий recovery #353
  для lazy editor/onboarding runtime остаётся независимой проверкой fingerprint,
  но его terminal-тост с тем же советом о reload подавляется, пока уже видна
  version-mismatch плашка. Network/non-terminal toast с советом повторить
  действие сохраняется; terminal toast также сохраняется, если mismatch
  неизвестен и плашки нет. Одновременно два сообщения с одной просьбой о reload
  не показываются.
- В kiosk плашка до первой разрешённой auto-попытки не показывается: это
  осознанное исключение из обычного mismatch UX ради тихого обновления настенной
  панели. Если safe state долго не наступает, карточка сохраняет текущий кадр;
  после первой попытки и сохранившегося mismatch появляется обычная плашка.
- Motion — короткое opacity-появление/исчезновение; при
  `prefers-reduced-motion: reduce` без анимации.

### 11.3 Ровно одна тихая kiosk-перезагрузка

Attempt хранится в `sessionStorage` под namespaced key и содержит целевую
`integration_version`. Один module-level helper разделяет его между всеми full
card на странице.

1. Перед `location.reload()` target синхронно записывается в `sessionStorage`.
2. Та же target после reload, при другом `CARD_VERSION` или в другом card
   instance не получает вторую auto-попытку.
3. Новая backend target может получить одну новую попытку.
4. Manual button не очищает guard и не обещает auto retry.
5. Если `sessionStorage` читать или писать нельзя, fail-safe — banner и никакой
   автоматической перезагрузки.
6. Совпадение версий не очищает сохранённую target: иначе reverse proxy,
   чередующий старый и новый frontend при том же backend, снова разрешит reload.
   Хранится одна небольшая строка без плана, entity ID и других данных.

Auto-reload разрешён только при одновременном выполнении:

- `config.kiosk === true` и компонент connected;
- initial server load завершён, есть полный settled frame, нет recovery/loading;
- режим `view`, `_editing === false`;
- ни один принадлежащий карточке first-class dialog/confirm/menu overlay не
  открыт; единый predicate обязан включать как минимум editor-secondary dialogs,
  room/partition delete, import, backdrop guard, danger confirm и незавершённый
  `_vacFit`. Нативный HA more-info не включается по ненадёжному stale-полю: его
  открытие уже ставит общую interaction pause, а отдельного достоверного сигнала
  закрытия у карточки нет;
- `_pendingPhysicalWrites.size === 0`, `_writesPending === 0` и нет
  незавершённой config write chain;
- нет pending layout debounce/отправки и грязных несохранённых позиций устройств;
- нет активного pointer/pinch/swipe/drag gesture или mode transition;
- `Date.now() >= _cyclePausedUntil`;
- `_zoom <= 1.001`.

Проверка идёт независимым bounded controller/timer: `cycle: 0` не отключает
механизм. Одновременно существует не более одного timer на card; disconnect,
совпадение версий и смена target его отменяют. Проверка не чаще одного раза за
animation frame/разумный timer и не добавляется в HA state render hot path.

## 12. Документация установки

`README.md`, `README.ru.md`, `docs/USER-GUIDE.md` и
`docs/USER-GUIDE.ru.md` содержат одну и ту же развилку:

### Storage mode (HA default)

Обычно ручная запись не нужна. Если автоматическое подключение не сработало:
Settings → Dashboards → меню ⋮ → Resources → Add resource; URL
`/houseplan_files/houseplan-card.js`, type JavaScript module. После установки или
изменения ресурса полностью reload страницы; hard reload shortcuts названы.

### YAML resources mode в HA 2026.2+

Современный канонический snippet управляет только источником ресурсов и
оставляет сами dashboards в выбранном пользователем storage/YAML режиме. Его
синтаксис подтверждён Home Assistant Core
[#161816](https://github.com/home-assistant/core/pull/161816), исходником
[HA 2026.2.0](https://github.com/home-assistant/core/blob/2026.2.0/homeassistant/components/lovelace/__init__.py)
и [официальной документацией dashboards](https://www.home-assistant.io/dashboards/dashboards/):

```yaml
lovelace:
  resource_mode: yaml
  resources:
    - url: /houseplan_files/houseplan-card.js
      type: module
```

### Legacy HA 2024.6–2026.1

Для уже YAML-managed dashboard показан отдельно помеченный legacy snippet:

```yaml
lovelace:
  mode: yaml
  resources:
    - url: /houseplan_files/houseplan-card.js
      type: module
```

Документация явно предупреждает, что `mode: yaml` меняет режим самого dashboard.
Пользователь старого HA со storage dashboard должен применять UI Resources из
предыдущего раздела, а не переключать dashboard ради карточки. Нельзя утверждать,
что `lovelace.resources` всегда игнорируется storage-managed dashboard: в HA
2026.2+ именно `resource_mode: yaml` поддерживает YAML-ресурсы независимо от
режима dashboard. UI Resources, в свою очередь, не заменяет YAML declaration,
когда выбран YAML resource mode. Путь `/custom_components/...` остаётся явно
запрещён.

## 13. Модель данных, compatibility и миграция

- Формат плана, layout, storage schema и card config не меняются.
- Websocket-протокол не меняется: `integration_version` остаётся существующим
  ответным compatibility-полем, новых request/response полей нет.
- Служебный boolean-флаг показа первого уведомления в config entry читается как
  optional; отсутствие/невалидное значение означает «ещё не создавалось».
  Schema migration и перепись планов не нужны.
- `sessionStorage` — transient browser-tab metadata, не экспортируется и не
  синхронизируется.
- Downgrade безопасен: старый backend без `integration_version` даёт `unknown`,
  backend с иной валидной версией даёт symmetric mismatch. Запрос остаётся тем
  же и не требует compatibility retry.

## 14. i18n

Новые строки добавляются одновременно:

- frontend EN/RU/DE/FR: заголовок/текст version mismatch, подписи обеих версий,
  кнопка reload;
- backend `strings.json` + EN/RU/DE/FR: текст одноразового notification и ключи
  `system_health.info.*`;
- документация EN/RU синхронна по смыслу.

Тексты не говорят «backend новее» и не обещают, что один reload всегда исправит
незавершённое обновление. Значения status enum в System Health не требуют
перевода для машинной диагностики, но их названия полей локализованы.

## 15. Критерии приёмки

### AC1 — документация режима (`unit`/docs contract)

Оба README и оба User Guide содержат отдельную storage UI-инструкцию, современный
HA 2026.2+ snippet с `lovelace.resource_mode: yaml`, явно помеченный legacy
2024.6–2026.1 snippet с `lovelace.mode: yaml` только для full-YAML dashboard и
hard reload shortcuts. Возврат плоского top-level `resources:`, современного
`mode: yaml` вместо `resource_mode: yaml` или совет переключить storage dashboard
в legacy YAML ради карточки делает docs contract красным.

### AC2 — честный outcome регистрации (`backend`)

Backend различает `created`, `updated`, `existing`, `registry_pending`,
`transient_error`, `yaml_fallback`, `error_fallback`; существующая запись
обновляется без дубля, а отсутствующий файл не сообщает успешный loader.

### AC3 — lifecycle retry без двойного loader (`backend` + mutation)

Registry отсутствует на первой попытке и появляется после HA started: один retry
через фиксированный секундный lifecycle delay регистрирует канонический resource
и снимает fallback либо честно маркирует его остаток. Уже running HA также не
делает retry в том же tick. Unload до event, во время delay и во время task
отменяет callback/side effects; повторный setup не накапливает listeners.
Мутанты «удалить retry», «убрать delay при already-running» и «не привязать
callback/task к unload» краснеют.

### AC4 — одноразовое notification (`backend` + mutation)

Первая доступная регистрация frontend создаёт локализованное persistent
notification и сохраняет boolean-флаг. Повторный setup, retry completion и новая
версия его не создают; missing file/static failure не расходуют право на показ;
uninstall dismiss-ит его. Мутант «не сохранять флаг» краснеет повторным setup.

### AC5 — System Health (`backend`)

Матрица missing file / registry success / pending→success / YAML fallback /
exception возвращает правдивые поля §10, точный versioned URL и безопасную
ошибку. Существующая статистика плана не исчезает.

### AC6 — точное frontend-сравнение (`unit` + mutation)

Pure controller покрывает equal, symmetric mismatch, unknown и смену target.
Успешный ответ без корректной `integration_version` очищает stale значение.
В обычном режиме banner существует iff известен mismatch; kiosk-исключение до
первой auto-попытки соответствует матрице §11.1. Отключение сравнения или
принятие unknown за mismatch ловится unit/mutation gate.

### AC7 — обычный режим никогда не reload сам (`unit` + browser + mutation)

При mismatch full card показывает плашку, но любое ожидание без click оставляет
`location.reload` невызванным. Trusted button вызывает один reload. Мутант,
разрешающий timer reload при `kiosk !== true`, краснеет.

### AC8 — kiosk safety (`unit` + browser + mutation)

Каждый отдельный unsafe guard из §11.3 блокирует auto-reload; после перехода в
полностью safe state target записывается до ровно одного reload. Минимум мутанты
«игнорировать pause», «игнорировать dialog/editor», «игнорировать pending write»
и «помечать attempt после reload» детерминированно краснеют.

### AC9 — защита от reload-loop (`unit` + browser + mutation)

После simulated reload тот же backend target показывает banner и не вызывает
reload повторно; это сохраняется при чередовании разных frontend-версий и во
втором card instance той же вкладки. Новая backend target получает одну попытку.
Исключение storage переводит в manual-only. Мутант «игнорировать сохранённую
target» краснеет.

### AC10 — граница full/space UX (`unit`/browser)

Runtime banner/auto-reload рендерит только full card. Space card продолжает
штатно загружать тот же bundle и config, но не получает скрытого timer или
нового UI этой задачи.

### AC11 — downgrade и lifecycle compatibility (`unit` + backend)

Старый backend без `integration_version` даёт `unknown`; валидная отличающаяся
версия не скрывается. Setup/unload/remove, старый websocket request и
существующие `test_ha_setup.py` остаются зелёными.

### AC12 — View/touch/a11y и визуальная стабильность (`browser` + golden)

Плашка не меняет stage bounds/fit, доступна клавиатурой и touch, не блокирует
жесты сцены вне себя, не двигает focus. Desktop, узкий touch viewport и kiosk
after-failed-attempt имеют принятый screenshot/golden; reduced-motion вариант
не анимируется. При видимой version-mismatch плашке terminal fingerprint failure
lazy runtime не добавляет второй toast с просьбой reload; non-terminal failure и
terminal failure без плашки продолжают показывать соответствующий toast.

### AC13 — сборка и синхронные артефакты (`build` + ревью кода)

Typecheck/unit/backend/build/bundle parity/no-new-any/check-docs и целевые smoke
зелёные; EN/RU/DE/FR ключи полны; оба changelog и пользовательская документация
обновлены. Три runtime-копии bundle синхронны; две committed trees (`dist` и
integration frontend) побайтно совпадают.

## 16. План тестов и отрицательные доказательства

### Backend

- расширить `tests_backend/test_ha_setup.py` матрицей outcomes, delayed registry,
  listener cleanup, idempotent reload, missing bundle и uninstall cleanup;
- отдельные тесты `system_health_info` для §10;
- one-time notification: first available setup, repeated setup/version, missing
  file/static failure и uninstall;
- mutation witnesses для retry, unload-bound callback и persisted notice flag.

### Frontend unit

- pure mismatch/session guard controller без DOM;
- exact backend target, чередование frontend versions, storage exception,
  multiple instances и mark-before-reload;
- каждый safe predicate независимо false/true;
- authoritative очистка stale `integration_version` до unknown.

### Browser smoke/golden

- full card mismatch в обычном View: banner, стабильный stage bbox, no auto,
  click reload spy;
- попытка открыть editor при известном mismatch: terminal fingerprint failure
  не дублирует видимую плашку toast-ом; non-terminal failure остаётся видимым;
  без version banner terminal toast #353 сохраняется;
- kiosk mismatch: unsafe→safe без предварительной плашки, one auto;
  remount/reload с той же backend target — banner и zero auto;
- editor/dialog/pending-write/zoom/recent interaction отдельными probes;
- narrow touch + keyboard focus + reduced motion;
- space card загружается без runtime banner/timer.

### Docs/mutation

- статический parser проверяет вложенность `resources`, современный
  `resource_mode: yaml`, отдельно версионированный legacy `mode: yaml`, запрет
  рекомендовать legacy mode для storage dashboard и отдельную UI-инструкцию;
- `scripts/mutation-gate.mjs` хранит дорогие backend/browser mutants из AC3,
  AC4, AC7–AC9 с точными target test commands;
- в документе code review каждый защитный AC получает строку «чем краснеет» по
  §2.7 `PROCESS.md`.

## 17. Затронутые файлы и модули

Ожидаемый минимум:

- `custom_components/houseplan/__init__.py`, `manifest.json`,
  `system_health.py` и runtime/store typing;
- `custom_components/houseplan/strings.json` и translations EN/RU/DE/FR;
- `src/houseplan-card.ts`, небольшой pure version controller, frontend i18n
  EN/RU/DE/FR и CSS;
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
- В System Health не попадают traceback, секреты, внешние filesystem paths или
  пользовательская конфигурация.
- Одноразовый notice-флаг не меняет план или permission boundary;
  resource registration/removal остаётся серверной операцией.

## 19. Риски

1. **Двойное исполнение bundle:** fallback и resource могут сосуществовать после
   retry. Закрывается единым exact URL, удалением fallback и AC3.
2. **Повторяющееся notification:** закрывается persisted boolean и AC4.
3. **Потерянное первое notification:** флаг пишется только после доступного
   frontend/static path и успешного создания.
4. **Reload-loop kiosk:** sessionStorage backend target до reload и AC8/AC9.
5. **Потеря правки:** полный safe predicate, обычный режим manual-only.
6. **Frontend новее backend:** direction-neutral copy и symmetric matrix.
7. **Old backend не отдаёт version:** authoritative `unknown`, без ложного
   banner/reload.
8. **Несколько cards/tabs:** attempt общий в пределах вкладки, но не между
   вкладками; это намеренная граница `sessionStorage`.
9. **HA startup race/uninstall:** after dependency, one-shot lifecycle callback,
   unload cancellation и removal tests.
10. **Заблуждающий System Health:** отдельные file/static/loader/outcome/error
    поля, без обещания browser state.
11. **Дублирующиеся просьбы reload:** terminal toast #353 подавляется только при
    уже видимой version-mismatch плашке; остальные ошибки lazy runtime не
    скрываются, что проверяет AC12.

## 20. Rollback

Откат — один revert продуктового коммита и синхронных тестов/документации/
bundles. План и layout не мигрируют. Старый backend игнорирует служебный boolean
в config entry; он не требует ручного вмешательства.

После отката вернутся невидимый fallback и необходимость ручного reload;
зарегистрированный Lovelace resource с прежним корректным URL останется
работоспособным. Удаление интеграции продолжает убирать ресурс.

## 21. Release-артефакты

Поскольку исправление пользовательски видимо:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` получают короткий пункт со ссылкой
  на #462;
- README и User Guide EN/RU меняются по §12; `docs/TESTING.md` больше не
  утверждает старый reload-контракт;
- `docs/ARCHITECTURE.md` фиксирует authority resource loader, notification и
  full-card version controller;
- `docs/DEVELOPMENT.md` фиксирует backend/frontend version test seam и
  lifecycle retry;
- принимаются три новых product golden из AC12. Отдельно изменение `src/**`
  требует актуального Linux `Docs screenshots` artifact для всех десяти
  документационных кадров и fingerprint acceptance; неизменившиеся пиксели не
  переснимаются вручную;
- release performance/security отдельных отчётов не требует; штатные gates и
  pre-beta runbook остаются обязательными;
- generated bundle trees обновляются только через штатный build.

## 22. Принятые технические предположения — можно менять на ревью

1. Выбран `persistent_notification`, потому что контракт владельца — одна
   информационная подсказка после первой регистрации, а не сохраняемая
   неисправность Repairs.
2. Boolean «notification уже создавалось» хранится в `entry.data`, а не в плане
   или layout; точное имя поля внутреннее.
3. One-shot retry использует `homeassistant.helpers.start.async_at_started`, а
   после running-state — cancellable delay через штатный event/loop helper;
   listener, timer, task и поздние side effects привязаны к unload.
4. Loader outcome может быть dataclass/enum/typed dict; публичны только значения
   System Health.
5. Banner в kiosk появляется только после уже предпринятой auto-попытки для этой
   backend target; до неё сохраняется тихий текущий кадр, как решил владелец.
6. Одна сохранённая backend target достаточна: новая target заменяет старую, а
   смена frontend при неизменной target не сбрасывает guard.
7. Проверка всех dialog/gesture состояний может быть выделена в общий pure
   snapshot helper; перечисление §11.3 является обязательным контрактом.
8. Минимальный touch-target 44×44 CSS px выбран как локальный
   accessibility-порог для этой плашки; общего числового порога в канонических
   UX-документах проекта пока нет.
