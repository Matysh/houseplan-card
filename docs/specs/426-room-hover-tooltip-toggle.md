# Issue #426 — отключение информационного окна комнаты при наведении

- **Issue:** https://github.com/Matysh/houseplan-card/issues/426
- **Приоритет / тип:** P2 · feature / polish
- **Область:** Общие настройки, View/киоск, room hover, global config,
  backend validation/privacy projection, i18n, документация и QA
- **Связи:** #79 (room hover), #154 (pointer modality), #196 (содержимое
  тултипа)
- **Ревизия:** 2 (2026-09-03; размещение editor-only строк уточнено по
  результату bundle-budget без изменения поведения)

## Сценарий

Администратор использует насыщенный план, на котором информационное окно
комнаты при движении мыши перекрывает полезную часть сцены или просто не нужно.
В **Общих настройках** он выключает опцию **«Показывать окно с информацией при
наведении на комнату»**. После сохранения комнаты по-прежнему подсвечиваются
при наведении, но окно с названием, площадью, температурой, влажностью и LQI не
появляется. Настройка действует на все пространства этой конфигурации и на
других экранах после загрузки конфигурации.

## Что человек увидит до и после

**До:** mouse-hover комнаты всегда показывает информационное окно; отключить
его отдельно от hover-подсветки нельзя.

**После:** в начале диалога «Общие настройки» есть включённый по умолчанию
переключатель. В выключенном состоянии исчезает только информационное окно
комнаты. Подсветка комнаты, тултипы устройств и все действия остаются прежними.

## Проблема и подтверждение по коду

Комната создаёт локальный обработчик `tip` в `src/houseplan-card.ts`; каждое из
пяти представлений геометрии комнаты (`path`/`polygon`/`rect`) передаёт его в
`@pointermove`. Обработчик в View безусловно вычисляет clean-floor area и
вызывает общий `_showTip()`. Сам `_showTip()` правильно проверяет mouse-hover,
pointer modality и drag, но не различает пользовательское намерение показать
или скрыть room-tooltip.

Hover-подсветка уже имеет независимое состояние `_hoverRoom` и отдельные SVG
слои `_renderRoomHoverFill()` / `_renderRoomHoverOutline()`. Поэтому требование
можно выполнить без отключения подсветки и без изменения геометрии комнаты.
Диалог общих настроек и его сохранение принадлежат lazy
`src/houseplan-editor-runtime.ts`; соответствующего draft/config-поля сейчас
нет.

## Скоуп

- Один глобальный переключатель с заданной владельцем русской строкой в
  «Общих настройках» и эквивалентами EN/DE/FR.
- Optional boolean `settings.show_room_tooltip` с default `true` при отсутствии
  или невалидном legacy/future значении.
- Отключение только room-tooltip во всех пространствах полного
  `houseplan-card`, включая View в kiosk-конфигурации на hover-capable экране.
- Сохранение прежней hover-подсветки комнаты и всех некомнатных тултипов.
- Backend validation, безопасная support-package проекция, compatibility docs,
  пользовательские руководства, changelog и тестовый контракт.
- Немедленное исчезновение уже показанного room-tooltip после успешного
  сохранения выключенного значения.

## Не-скоуп

- Отключение или изменение hover-подсветки комнаты.
- Отключение тултипов устройств, проёмов, кнопок, Help affordance или иных
  поверхностей.
- Изменение состава, порядка строк, позиции или оформления информационного
  окна комнаты.
- Перенос настройки на уровень пространства/комнаты, локальное значение на
  экран или отдельная настройка для kiosk.
- Изменение touch/pen-контракта: на этих указателях transient hover и сейчас не
  появляется.
- Интерактивность `houseplan-space-card`: эта карточка остаётся статической и
  уже не имеет hover/tooltips.
- Миграция store/model version или переписывание существующих конфигураций при
  чтении.

## Контракт поведения

### 1. Общие настройки

1. Сразу после существующей вводной строки диалога находится обычная строка с
   переключателем **«Показывать окно с информацией при наведении на комнату»**.
   Новая секция, help-иконка и дополнительное предупреждение не нужны.
2. При открытии диалога значение draft равно `true`, если
   `settings.show_room_tooltip` не является точным boolean `false`; точный
   `false` открывается выключенным.
3. Переключение меняет только draft. Cancel, Escape и закрытие по правилам
   диалога не меняют серверную конфигурацию и текущее поведение.
4. Save с выключенной опцией записывает точный
   `settings.show_room_tooltip: false`. Save с включённой опцией удаляет ключ,
   материализуя default отсутствием, а не `true`.
5. После успешного Save результат действует сразу, без reload. Ошибка записи
   оставляет диалог открытым и не выдаёт несохранённый draft за применённое
   значение по существующему контракту общих настроек.

### 2. Room hover в View

1. Единственный resolver читает настройку так: только точный `false` означает
   «не показывать»; отсутствие, `null`, строка, число и будущая повреждённая
   форма fail-safe проецируются в нынешнее `true`.
2. При effective `true` mouse-hover комнаты побайтово/семантически сохраняет
   текущий путь: title, clean-floor area, temperature, humidity, LQI, позиция и
   обновление вслед за указателем не меняются.
3. При effective `false` pointer enter/move по комнате не создаёт и не рисует
   `.tip`, а также не выполняет отложенное вычисление `_roomArea()` только ради
   скрытого окна.
4. Независимый `_hoverRoom` продолжает устанавливаться на pointer enter;
   `room-hover-fill-layer` и `room-hover-outline-layer` остаются видимыми по
   прежним правилам. Pointer leave и все lifecycle/mode/space очистки transient
   hover не меняются.
5. Device tooltip продолжает использовать общий `_showTip()` в View и
   Редакторе устройств независимо от `show_room_tooltip`. Настройка не может
   стать глобальным запретом `.tip`.
6. Успешное сохранение `false` очищает возможное текущее room-tooltip. Повторное
   включение не создаёт окно само: оно появляется при следующем настоящем
   mouse move над комнатой.

### 3. Режимы и указатели

- Контракт применяется только к комнате в View. Plan, Devices и Background не
  получают нового hover-поведения.
- На hover-capable desktop и в kiosk с мышью используется одно global значение.
- Touch/pen и compatibility mouse events продолжают подавляться
  `PointerModalityController` независимо от настройки.
- Pan, pinch, drag, click/tap, room-card link, device actions и keyboard paths
  не меняются.

## UX и i18n

Добавить ключ `gs.show_room_tooltip` во все четыре синхронизированных lazy
editor-словаря `src/i18n/support/{en,ru,de,fr}.json`. Существующую editor-only
строку `gs.hint` перенести туда же, чтобы новый control не увеличивал initial
View graph:

- RU: `Показывать окно с информацией при наведении на комнату`;
- EN: `Show the room information window on hover`;
- DE: `Rauminformationen beim Darüberfahren anzeigen`;
- FR: `Afficher les informations de la pièce au survol`.

Используется существующий `_boolInput()` и класс строки общих настроек. Control
имеет доступное имя из видимой строки; отдельные tooltip/help и aria-only ключи
не добавляются. Порядок остальных контролов не меняется.

## Модель данных, миграция и совместимость

### Frontend

- `ServerConfig.settings` получает optional
  `show_room_tooltip?: boolean`.
- Pure resolver (рабочее имя `showRoomTooltipOf`) является единственным
  источником default для runtime и draft диалога.
- `_settingsDialog` получает boolean `showRoomTooltip`; draft не читается
  напрямую из UI DOM при Save.
- Model/store version не меняется. Загрузка не материализует default и не
  создаёт запись.

### Backend и support package

- `CONFIG_SCHEMA.settings` явно принимает только boolean для нового известного
  ключа. `extra=ALLOW_EXTRA` сохраняется для forward compatibility остальных
  полей.
- Privacy projection support package переносит только нормализованный boolean
  `show_room_tooltip`, без новых пользовательских данных.
- Полный backup/export/import уже переносит global settings как часть config;
  отдельный remap или envelope field не нужен.

### Mixed version и downgrade

| Frontend | Backend | Поведение |
|---|---|---|
| old | new | Новый известный boolean игнорируется старой карточкой; room-tooltip показывается, конфиг не повреждается |
| new | old | Старый backend сохраняет поле через существующий `ALLOW_EXTRA`; новая карточка применяет `false` |
| new | new | Выключенное значение сохраняется и подавляет только room-tooltip |

При downgrade пользователь временно снова увидит room-tooltip, но значение
`false` остаётся в конфиге и восстановит поведение после возврата новой версии.
Это мягкая деградация; data migration и блокировка смешанных версий не нужны.

## Затронутые файлы и модули

- `src/types.ts`, `src/logic.ts`, `src/houseplan-card.ts`,
  `src/houseplan-editor-runtime.ts`.
- `src/i18n/support/{en,ru,de,fr}.json`, `src/i18n/support.ts`.
- `custom_components/houseplan/validation.py`,
  `custom_components/houseplan/support_package.py`.
- `test/logic.test.mjs`, settings/source contract tests,
  `tests_backend/test_validation.py`, support-package tests и целевой browser
  smoke для room-tooltip/general settings.
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`, `docs/UX-MODES.md`,
  `docs/TOUCH-SUPPORT.md`, `docs/CONFIG-COMPATIBILITY.md`, при необходимости
  `docs/TESTING.md`, оба changelog.
- Собранные `dist/**` и `custom_components/houseplan/frontend/**` по обычному
  bundle-контракту.

## Критерии приёмки

- **AC1 — UI и default (unit + smoke).** В общих настройках есть ровно один
  переключатель с локализованным именем; новый и legacy config без поля
  открывает его включённым, точный `false` — выключенным.
- **AC2 — persistence (unit + smoke + backend).** Save выключенного draft
  записывает boolean `false`; reopen/reload сохраняют его. Save включённого
  draft удаляет ключ. Cancel/Escape не пишут, backend принимает оба canonical
  состояния и отклоняет не-boolean новое значение.
- **AC3 — tooltip off (unit + smoke).** При `false` настоящий mouse move над
  комнатой не создаёт `.tip`, не вызывает `_roomArea()`, и уже видимое окно
  исчезает после успешного Save.
- **AC4 — default parity (smoke).** При absent/`true` room-tooltip сохраняет
  нынешние title, area, temperature, humidity, LQI, positioning и движение за
  указателем.
- **AC5 — hover/device independence (smoke).** В обоих состояниях остаются
  room fill/outline hover layers; при `false` device tooltip в View/Devices
  по-прежнему появляется и содержит прежние данные.
- **AC6 — pointer/mode parity (unit + smoke).** Touch/pen и synthetic
  compatibility mouse не создают room-tooltip; View/kiosk с настоящей мышью
  следуют опции; editor modes, pan/pinch/click и room-card действия не меняются.
- **AC7 — compatibility/privacy (backend + unit).** Full config round-trip и
  support projection сохраняют нормализованный boolean; отсутствие ключа не
  материализуется; mixed-version/downgrade ведут себя по таблице без изменения
  model/store version.
- **AC8 — i18n/docs/release (unit + docs gate).** EN/RU/DE/FR имеют parity,
  оба руководства и UX/touch/compatibility docs описывают границу опции, а оба
  changelog получают пользовательскую запись в том же коммите.
- **AC9 — гейты и бюджет (commands).** В цикле реализации проходят
  `npx tsc --noEmit`, `npm test`, `npm run build`, целевой backend pytest,
  `no-new-any`, docs check и выбранный browser smoke. Default-кадры golden не
  меняются; initial/editor gzip остаются в текущих бюджетах.

## План автотестов

- Табличный unit для resolver: missing/`undefined`/`null`/invalid/`true` →
  `true`, только boolean `false` → `false`.
- Source/dialog contract: draft инициализируется resolver-ом; `false` пишется,
  `true` удаляется; ключ UI присутствует во всех локалях.
- Backend pytest: `false`/`true` проходят, строка/число отклоняются; support
  projection содержит boolean и не копирует невалидную форму.
- Новый/расширенный Playwright smoke: открыть общие настройки, проверить
  default, Cancel, сохранить `false`, reopen/reload, подвигать реальную мышь над
  комнатой и устройством, проверить room hover layers и `.tip`, вернуть `true`
  и проверить восстановление текущего содержимого room-tooltip.
- Мутационные доказательства: заменить resolver на `Boolean(value)` — падает
  AC1/AC4; поставить guard внутри общего `_showTip()` — падает device-часть
  AC5; скрыть `_hoverRoom` вместе с tooltip — падает AC5; хранить `true` —
  падает AC2/AC7; не очищать текущее окно при Save — падает AC3.

## Release-артефакты

- Пользовательская запись в `docs/CHANGELOG.md` и
  `docs/CHANGELOG.ru.md` в product-коммите.
- Обновлённые EN/RU User Guide, `docs/UX-MODES.md`,
  `docs/TOUCH-SUPPORT.md` и `docs/CONFIG-COMPATIBILITY.md`.
- Изменение нового control доказывает целевой browser smoke; отдельный новый
  golden не нужен, потому что default View визуально не меняется и диалог
  общих настроек не является принятым golden-сценарием.
- Любая правка `src/**` обновляет source fingerprint документационных
  скриншотов через каноническую приёмку; неожиданный raster diff блокирует
  завершение задачи.
- Performance/security artifacts не добавляются: один boolean resolver на
  room pointermove не создаёт frame-loop или сетевого пути; штатные bundle
  budget и prerelease performance gates остаются обязательными.

## Производительность и безопасность

Resolver выполняет одну строгую boolean-проверку до вычисления площади; при
выключенной опции работа на pointermove уменьшается. Он не входит в render loop
и не меняет геометрию, кэши или сетевые запросы. Новый boolean не содержит
персональных данных; support package переносит его только как allowlisted
presentation preference.

## Риски

- **Случайно выключить device tooltip.** `_tip` общий для комнат и устройств;
  guard в `_showTip()` был бы слишком широким. Снимается room-specific guard и
  независимой проверкой device tooltip в AC5.
- **Сломать default старых конфигов.** `Boolean(undefined)` дал бы `false`.
  Снимается pure resolver-ом «только точный false выключает» и таблицей AC1.
- **Показать несохранённый draft как live-настройку.** Диалог редактирует копию,
  поэтому runtime читает только server config, а не `_settingsDialog`; Cancel и
  failure проверяются AC2.
- **Оставить уже видимый tooltip после выключения.** Пассивный pointer может не
  дать нового события. Успешный Save явно очищает transient tip, AC3 фиксирует
  это поведение.
- **Потерять `false` в mixed-version цикле.** Старый backend сохраняет unknown
  settings, а old frontend не должен реконструировать весь settings-объект без
  spread. Compatibility-таблица и round-trip AC7 делают границу явной.
- **Добавить скрытую стоимость pointermove.** Guard ставится до `_roomArea()` и
  climate/LQI чтений; bundle/performance gates подтверждают отсутствие роста
  горячего пути.

## Откат

Feature flag не нужен: persisted boolean уже сам является выключателем. Для
аварийного продуктового отката удаляются строка UI и room-specific runtime
guard, но backend acceptance/type и support projection временно сохраняются.
Старый runtime безопасно вернёт прежний всегда-включённый tooltip, а сохранённые
`false` не повредятся и не заблокируют config writes.

Если поле требуется убрать окончательно, отдельная проверяемая data-fix удаляет
`settings.show_room_tooltip` из сохранённых конфигураций; только после этого
можно убрать явный schema/support contract. Повышать model/store version или
переписывать все конфиги для обычного rollback нельзя.

## Принятые предположения

- «Общие настройки» означает одно server-persisted значение для всей
  конфигурации, а не per-space/per-room/localStorage.
- Отключается только информационное окно комнаты; hover wash/outline остаются.
- Опция действует и в kiosk при наличии настоящей мыши; touch-only kiosk уже не
  показывает hover по текущему контракту.
- Переключатель расположен сразу после вводного текста диалога, без новой
  секции, help и предупреждения.
- Канонический ключ — `settings.show_room_tooltip`; default хранится отсутствием,
  а явное значение требуется только для `false`.
- `houseplan-space-card` не меняется, потому что уже не имеет интерактивности.
