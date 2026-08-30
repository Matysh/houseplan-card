# Issue #381 — действие по нажатию «Ничего не делать»

- **Issue:** https://github.com/Matysh/houseplan-card/issues/381
- **Статус документа:** вторая редакция, замечание r1 устранено, готова к ревью
- **Приоритет / тип:** P2 · feature / polish
- **Область:** marker config, Редактор устройств, View/киоск, frontend action
  projection, backend validation, i18n, документация и QA
- **Связи:** #94 (универсальный Toggle), #178 (точная Toggle-сущность)
- **Ревизия:** 2 (2026-08-30)

## Сценарий

Администратор дома размещает на плане датчик или виртуальный маркер, который
должен только показывать место и состояние. В Редакторе устройств он выбирает
для маркера действие **«Ничего не делать»** и сохраняет настройки. После этого
член семьи, гость или киоск может коротко нажать маркер, не открывая карточку и
не отправляя команду устройству. Долгое нажатие и правый клик сохраняют свои
отдельные информационные действия.

## Что человек увидит до и после

**До:** короткое нажатие всегда открывает информационную поверхность либо
пытается выполнить команду. **После:** в селекторе появляется явный вариант
«Ничего не делать», и короткое нажатие выбранного маркера не даёт никакого
результата, пока сам маркер продолжает показывать состояние на плане.

## Проблема

`TAP_ACTIONS` предлагает только `info`, `more-info`, `toggle` и `run`.
`projectedTapAction()` проецирует неизвестный сохранённый токен в `info`, а
`_clickDevice()` после известных команд открывает локальную карточку. Backend
`MARKER_SCHEMA` также принимает только эти четыре значения, legacy `cover` и
`null`. Поэтому строка в селекторе без сквозного контракта либо будет отклонена
сервером, либо после reload превратится в открытие карточки.

Использовать неработоспособный `toggle` как замену нельзя: это зависимый от
текущей привязки safe no-op с диагностикой, который может начать отправлять
команду после восстановления цели. Здесь требуется явное и стабильное намерение
пользователя.

## Скоуп

- Новая строка «Ничего не делать» в селекторе «Действие по нажатию» для
  существующих и новых реальных/виртуальных маркеров.
- Канонический persisted literal `marker.tap_action: "none"`.
- Одинаковый no-op для короткого mouse click, touch tap и keyboard activation
  `Enter`/`Space` в View и киоске.
- Сквозное чтение, preview, запись, backend validation, full/space
  export/import и downgrade-описание нового literal.
- Паритет переводов EN/RU/DE/FR и обновление пользовательской документации.
- Регресс-проверки остальных действий и default-проекции.

## Не-скоуп

- Изменение долгого нажатия, правого клика или жестов редактора.
- Отдельная настройка hold/right-click action.
- Изменение hit area, hover/focus, внешнего вида, состояния, pulse, Glow, LQI,
  value badge, room aggregates или доступности маркера.
- Изменение defaults: свет без явного значения по-прежнему получает Toggle,
  остальные устройства — карточку House Plan.
- Изменение семантики `info`, `more-info`, `toggle`, `run` и legacy `cover`.
- Новая HA service/WebSocket-команда, подтверждение или toast для `none`.
- Интерактивность `houseplan-space-card`, которая остаётся отдельной статической
  поверхностью по своему существующему контракту.

## Контракт поведения

### 1. Выбор и сохранение

1. `TAP_ACTIONS` содержит канонический `none`; селектор показывает его строкой
   **«Ничего не делать»** после существующих четырёх действий.
2. Выбор `none` немедленно меняет draft/effective action диалога. Toggle- и
   Run-зависимые поля скрываются по тем же правилам, что для `info` и
   `more-info`; блок `controls` остаётся доступен, поскольку он участвует также
   в light/presentation graph.
3. Save записывает точный literal `tap_action: "none"`. Повторное открытие
   диалога и reload сохраняют выбранную строку.
4. Cancel не меняет конфиг. Простое Open → Save маркера с отсутствующим,
   legacy либо неизвестным `tap_action` сохраняет прежний lossless-контракт и
   не материализует `none`.
5. `none` не равен `null`, отсутствию или пустой строке. Только явный literal
   отключает короткое действие; прежняя light/non-light default-проекция не
   меняется.

### 2. Короткое нажатие

1. `projectedTapAction("none", domain)` возвращает `none` для любого domain и
   binding kind. Неизвестные токены по-прежнему fail closed в `info`.
2. В View/киоске `_clickDevice()` после разрешения актуального marker по id и
   до binding/service веток завершает `none` как quiet no-op.
3. No-op означает одновременно: не открывать карточку House Plan или HA
   more-info, не создавать confirmation, не показывать toast, не вызывать HA
   service/WebSocket, не запускать press feedback/activity и не менять
   локальное/серверное состояние.
4. Click/tap по маркеру остаётся поглощённым маркером и не превращается в клик
   по комнате, pan либо другому объекту под ним.
5. `Enter` и `Space` идут тем же `_clickDevice()`-путём, предотвращают
   браузерный default как сейчас и также завершаются без побочного действия.

### 3. Независимые жесты и presentation

- Long press 600 ms по-прежнему открывает внутреннюю карточку House Plan.
- Правый клик по-прежнему открывает HA more-info основной сущности либо
  существующий fallback для marker без primary.
- В Редакторе устройств короткий клик по маркеру по-прежнему открывает его
  настройки; `tap_action` относится только к View/киоску.
- Marker остаётся видимым, focusable и получает прежние hover/focus стили,
  tooltip, state, pulse, badge, Glow и LQI. Отдельного disabled-вида нет.
- Preview диалога меняет только effective action; рисунок маркера не меняется.

## UX и i18n

Добавить одинаковый ключ `tap.none` в четыре словаря:

- RU: `Ничего не делать`;
- EN: `Do nothing`;
- DE: `Nichts tun`;
- FR: `Ne rien faire`.

Новая строка находится в существующем native select после `Run`; новая
подсказка, иконка либо секция диалога не нужны. Toggle-hint, target chooser и
confirmation checkbox при `none` не показываются. Live region Toggle не
анонсирует цель.

## Модель данных, миграция и совместимость

### Frontend

- Возвращаемый тип `projectedTapAction()` и все effective-action consumers
  расширяются literal `none`.
- `Marker.tap_action` остаётся forward-compatible `string | null`; отдельная
  миграция типа или model/store version не требуется.
- `devices` fingerprint уже включает исходный `tap_action`, поэтому смена на
  `none` инвалидирует presentation/action snapshot без нового cache key.

### Backend

`MARKER_SCHEMA` принимает `none` рядом с текущими canonical literals. Значение
не несёт target/ref и не требует semantic validator. Cross-language parity
test обязан доказать, что backend принимает каждый literal из frontend
`TAP_ACTIONS`, включая `none`, и продолжает отдельно принимать legacy `cover`.

### Import/export и downgrade

- Full и space export/import сохраняют `none` штатным копированием marker;
  remap ссылок не требуется.
- Виртуализация duplicate marker при space import продолжает удалять
  `tap_action` вместе с HA-dependent marker fields по существующему правилу.
- Старый frontend прочитает неизвестный ему `none` как `info`; старый backend
  отклонит попытку записать изменённый marker с новым literal. Это известная
  граница downgrade для нового enum value, а не основание маскировать `none`
  под отсутствующее значение.
- Новый frontend/backend не переписывают старые `cover`, absent, `null` или
  неизвестные untouched значения при редактировании другого поля.

## Затронутые файлы и модули

- `src/logic.ts`, `src/device-toggle.ts`, `src/houseplan-card.ts`.
- `src/houseplan-editor-runtime.ts`; `src/types.ts` только если потребуется
  уточнить локальный effective-action type без сужения forward compatibility.
- `src/i18n/{en,ru,de,fr}.json`.
- `custom_components/houseplan/validation.py`.
- `test/device-toggle.test.mjs`, action/click contract tests,
  `tests_backend/test_validation.py` и целевой browser smoke диалога/маркера.
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `docs/ARCHITECTURE.md`, при необходимости
  `docs/TESTING.md`, оба changelog.

## Критерии приёмки

- **AC1 — selector и persisted value (unit + smoke).** Селектор содержит пять
  canonical options с `none` последним; выбор сохраняет
  `tap_action: "none"`, reopen/reload восстанавливает его, Cancel не пишет.
- **AC2 — quiet no-op (unit + smoke).** Mouse click, touch tap, `Enter` и
  `Space` по marker с `none` не открывают поверхности, не вызывают service/WS,
  toast, confirmation, press animation или activity stamp.
- **AC3 — независимые жесты (smoke).** Long press всё ещё открывает карточку
  House Plan, right click — HA more-info, а клик по тому же marker в Редакторе
  устройств — настройки marker.
- **AC4 — presentation parity (unit, DOM assertion).** До и после выбора
  совпадают DOM/classes/face/state/pulse/badge/LQI/Glow/tooltip/hit area и
  hover/focus; новый disabled-стиль не появляется.
- **AC5 — defaults и legacy (unit).** Absent/`null`/`""` оставляют Toggle для
  primary light и Info для остальных; `cover` проецируется в Toggle; неизвестный
  token проецируется в Info; untouched Open → Save сохраняет исходный literal.
- **AC6 — соседние действия (unit + smoke).** `info`, `more-info`, `toggle` и
  `run` выполняют прежние ветки, а Toggle/Run fields и confirmation видны только
  при соответствующих effective actions.
- **AC7 — backend и transfer (backend).** Backend принимает `none` и все
  `TAP_ACTIONS`, отклоняет произвольный новый изменённый token; full/space
  transfer сохраняет `none`, duplicate virtualization удаляет его как раньше.
- **AC8 — i18n и docs (unit + docs gate).** Четыре словаря имеют паритет,
  обе версии руководства описывают `none` и неизменные long/right gestures,
  compatibility/architecture фиксируют literal и downgrade.
- **AC9 — гейты и бюджет (commands).** В цикле реализации зелёные
  `npx tsc --noEmit`, `npm test`, `npm run build` и целевой backend pytest;
  `no-new-any`, i18n/docs checks и browser smoke проходят на обязательном
  предрелизном прогоне. Существенного роста initial/editor bundle нет.

## План автотестов

- Расширить таблицу `projectedTapAction`: explicit `none` для light/switch и
  неизменные absent/legacy/unknown варианты.
- Добавить целевой тест click dispatcher с шпионами на `_infoCard`,
  `_openMoreInfo`, `callService`, `callWS`, `_tapConfirm`, toast,
  `_startDevicePressFeedback` и `_stampActivity`.
- Проверить keyboard reuse того же dispatcher и сохранение `stopPropagation` /
  `preventDefault` на соответствующих путях.
- Проверить editor draft/save/reopen/Cancel и отсутствие Toggle/Run dependent
  controls для `none`; отдельно — lossless untouched legacy/unknown action.
- Расширить cross-language backend test `TAP_ACTIONS` и marker validation.
- Добавить import/export fixtures для full, space и duplicate virtualization.
- Целевой Playwright smoke: выбрать `none`, Save, reopen, reload, выполнить
  click/tap/keyboard no-op, long press и contextmenu; убедиться, что marker
  presentation не изменился.

Мутанты: не добавить `none` в backend → AC7; спроецировать `none` в `info` →
AC1/AC2; поставить no-op после fallback-карточки → AC2; сделать ранний return до
`stopPropagation` → AC2; связать `none` с unavailable Toggle → AC2/AC5; скрыть
marker или изменить face → AC4.

## Риски

- **Смешение `none` с отсутствием значения.** Truthy/falsy-проверка либо
  нестрогий fallback может вернуть light-маркеру Toggle или открыть Info вместо
  no-op. Снимается явной веткой `none`, расширенным возвращаемым union и
  таблицей absent/`null`/пустого/unknown/legacy/`none` в AC2 и AC5.
- **Неполный охват потребителей `tap_action`.** Помимо selector и click path
  поле участвует в `devices` fingerprint, virtual-light и cover presentation.
  Перед реализацией выполняется полный поиск consumers; код меняется только в
  action projection/dispatch, а AC4/AC6 фиксируют неизменность presentation и
  специальных Toggle-потребителей.
- **Ранний return в неверной точке.** Если выйти до `stopPropagation`, нажатие
  протечёт в комнату/план; если выйти после fallback, откроется карточка.
  Dispatcher-тест и соответствующие мутанты фиксируют точное окно между
  разрешением актуального marker и capability/info ветками.
- **Mixed-version/downgrade.** Новый frontend с прежним backend не сможет
  сохранить `none`; полный откат backend после уже записанных значений сделает
  последующую запись такого конфига невалидной. Интеграция поставляет frontend
  и backend одним релизом, а безопасный порядок аварийного отката описан ниже и
  сохраняет backend read/write allowlist до очистки данных.
- **Пассивное нажатие могут принять за поломку.** Выбор называется буквально
  «Ничего не делать», отдельного disabled-вида нет, а long press/right click
  остаются документированными. Smoke проверяет, что исчезло только выбранное
  короткое действие, а не сам marker или информационные жесты.

## Откат

Feature flag и миграция отсутствуют. Безопасный аварийный откат выполняется в
два этапа:

1. revert-нуть selector/runtime/i18n/docs-часть пользовательского изменения,
   но временно **оставить** `"none"` в backend `MARKER_SCHEMA`; reverted
   frontend уже проецирует этот неизвестный literal в безопасный `info`, а
   существующие конфиги продолжают загружаться и сохраняться;
2. если требуется убрать literal полностью, отдельной проверяемой data-fix
   заменить сохранённые `tap_action: "none"` на `"info"`, и только после этого
   удалить его из backend allowlist.

Полный слепой `git revert` frontend и backend одним шагом запрещён после выхода
релиза: уже записанный `none` останется в store, старый frontend покажет Info,
но старый backend отклонит следующую запись всего конфига. Потеря данных при
безопасном откате ограничена осознанным пользовательским намерением no-op,
которое становится `info`; геометрия, marker binding, presentation и остальные
поля не меняются. После любого отката повторяются backend validation, config
Open → Save и click smoke на конфиге, содержащем `none`.

## Производительность и безопасность

No-op — одна константная ветка до capability resolution и сетевых операций.
Новых подписок, таймеров, cache entries, DOM-узлов и данных HA нет. Вызовов
service/WS для `none` быть не может; backend принимает только точный allowlisted
literal. Full performance/golden harness не требуется из-за отсутствия
геометрической/визуальной дельты, но штатные предрелизные проверки проекта не
отменяются.

## Release-артефакты

- Пользовательская запись в `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том
  же `User-Visible: yes` коммите, что реализация.
- Обновлённые EN/RU user guides, compatibility и architecture.
- Новый plan golden не требуется: marker pixels и геометрия не меняются.
  Открытое native select не является стабильной кроссплатформенной golden-
  поверхностью; наличие/текст option доказывают DOM unit и Playwright smoke.
- Docs screenshot не требуется: существующие изображения не утверждают полный
  список tap actions; текстовые разделы являются каноническими.
- Release/performance/security waiver не требуется; перед beta выполняется
  общий golden/smoke/performance набор по runbook.

## Принятые предположения

- `none` расположен последним в текущем порядке selector; порядок можно свободно
  поменять до реализации без изменения контракта.
- Controls остаются редактируемыми, потому что используются presentation/light
  graph независимо от короткого действия.
- Существующая политика соседних полей сохраняется: смена с `run` на любое
  другое действие очищает `tap_target` при записи, а общие настройки marker не
  сбрасываются только из-за выбора `none`.
- Marker остаётся focusable и визуально интерактивным ради доступных hover,
  tooltip, long-press и context-menu путей; отдельный disabled appearance не
  вводится.
