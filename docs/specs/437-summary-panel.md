# #437 — Конфигурируемая сводная панель поверх плана

Issue: [#437](https://github.com/Matysh/houseplan-card/issues/437).
Ветка: `issue/437-summary-panel`; база аналитики: `dev@ed9ee026`.
Редакция: 2026-09-08. Полный трек, P2/feature.
Канонический статус — метка issue, не заголовок этого документа.
**Команда владельца: пройти ревью ТЗ до S5-ready и остановиться. Реализацию не начинать.**

## 1. Сценарий и результат для человека

Администратор дома настраивает общую сводку один раз. Домочадцы читают её
поверх плана в обычной карточке, полноэкранной панели, на телефоне или настенном
планшете; могут скрыть её на своём экране, не меняя чужие экраны.

**До:** показатели собирают псевдотаблицами из декора на плане.
**После:** нужные показатели находятся в компактной панели справа или снизу,
настраиваются одним окном и не меняют размер самого плана.

Это ограниченное исключение из запрета general dashboard framework в
[SCOPE](../SCOPE.md), одобренное владельцем 2026-09-03: контекстная read-only
сводка при пространственном View, не новый конструктор dashboard.
Поглощённые сценарии: [#83](https://github.com/Matysh/houseplan-card/issues/83)
и [#149](https://github.com/Matysh/houseplan-card/issues/149).

Оценка: пользовательская ценность 8/10, разработческая 6/10,
сложность 7/10, риск 7/10. `small` не подходит: новый UX-контракт,
несколько поверхностей, persistent shared/local state, touch и performance.

## 2. Источники решений и границы

Приоритет: позднейшее решение владельца → этот согласованный контракт →
Dashboard 5. Старые предложения о выделенной колонке и сворачивании отменены.

- [Dashboard 5, сообщение дизайнера](https://github.com/Matysh/houseplan-card/issues/437#issuecomment-5585797767).
- [Принятые Q1–Q5 и компоновка](https://github.com/Matysh/houseplan-card/issues/437#issuecomment-5586002352).
- [Скрытие при недостатке места](https://github.com/Matysh/houseplan-card/issues/437#issuecomment-5586088350).
- [Начало номерного ТЗ и ограничение S5](https://github.com/Matysh/houseplan-card/issues/437#issuecomment-5586184163).

Архив `Dashboard-5-Issue-437-handoff-2026-09-08.zip`, SHA256
`fca6d0c7aa45cf16f4350c4f8790ed8fa475bd88d3809d9536ad8f8f9a016597`:
`Dashboard 5/index.html`, CSS/JS, SVG, README/DEVELOPER-HANDOFF/
IMPLEMENTATION-NOTES/ISSUE-HANDOFF и документ финальных изменений Dashboard 4.
На этапе аналитики прочитаны документы и исходники; работающий продукт и
браузерные скриншоты **этим не проверены**. Прототип не импортировать как код.

В scope: overlay, составной контрол, одна форма настроек, блоки/строки,
источники HA и три встроенных показателя, shared/local persistence,
мобильность, киоск, явный доступ к локальным размерам и их применение в View.

Не в scope: графики/история, формулы и атрибуты как самостоятельные источники,
Lovelace-карточки внутри панели, HTML/CSS/JS пользователя, сервисные действия
по строке, автоматические агрегаты тревог/климата, вложенные блоки,
сворачивание, ручное перемещение панели, профили состава по карточкам,
изменение геометрии/редакторов, интерактивность `houseplan-space-card`.
Статичная карточка пространства не получает эту панель.

## 3. Текущее устройство кода и точки изменения

Ориентиры на базе выше; это план изменений, не уже выполненная реализация:

- `src/houseplan-card.ts`: `.stage`, `_stageEl`, ResizeObserver,
  `_canManageConfiguration`, `_sendConfigCandidate`, `_roomArea`, `_cleanFloor`,
  `_renderKioskDialog`; `src/styles/chrome.styles.ts` — шапка/киоск.
- `src/houseplan-panel.ts`: full-card wrapper уже получает `narrow`, но не
  передаёт его карточке. `src/types.ts`: `ServerConfig`, `CardConfig`.
- `src/devices.ts`: `buildDevices` — **не готовый общий счётчик**:
  фильтрует marker visibility, registry и активное пространство.
  `src/ha-binding-status.ts` — полнота registry и разрешение привязок.
- `src/wall-thickness.ts`: `innerContourForRoom`;
  `src/physical-geometry.ts`: `floorMinusBodies`, `geometryArea`.
- Backend: `websocket_api.py` (`config/get`, `config/set`), `validation.py`,
  `store.py`, `auth.py`, `import_export.py`, `support_package.py` в
  `custom_components/houseplan/`.

Выделить небольшие pure модули model/validation, source resolution,
visibility/layout и local preferences; отдельное представление панели и
лениво загружаемую форму. Не добавлять второй монолит в `houseplan-card.ts`,
не копировать существующую геометрическую или placement-семантику.
Shared конфигурация идёт через существующий optimistic-locking путь.

## 4. Пользовательский контракт

### 4.1 Показ и управление

В шапке House Plan — составной контрол без видимого текста:
слева шестерёнка настроек, справа значок панели показать/скрыть.
Раздельные hit targets, Tab-фокус, доступные имена и подсказки.
Правая часть имеет `aria-pressed`, отражающий **сохранённое локальное желание
показа**, а не временное скрытие mobile/fits. В таком случае подсказка поясняет
причину скрытия. Внутри сводки только её пользовательский заголовок; без
дублирующей шестерёнки и крестика.

Панель имеет только «показана / скрыта», не collapsed/expanded. При скрытии
конфигурация сохраняется. Переключение правой кнопкой применяется немедленно
локально, без серверной записи. Состояние переживает reload.
При отсутствии локального предпочтения панель выключена; обновление установки
не навязывает новый overlay. Первое явное включение показывает defaults §6.

В View блоки всегда развёрнуты, показываются только включённые и подходящие
текущему пространству. Порядок как в настройках. Если подходящих блоков нет,
сохраняются заголовок и нейтральная строка «Нет показателей для этого пространства»;
новые блоки автоматически не добавляются. Строки не открывают more-info и
не вызывают сервисов HA.

В редакторах плана, устройств и подложки overlay и его View-контролы скрыты;
при возврате в View восстанавливаются по тем же условиям. Нет структурного
редактирования в самом overlay и нет перетаскивания строк в View.

### 4.2 Одна форма настроек

Поля в порядке Dashboard 5: «Название панели», «Показывать панель» (локальное),
«Отображать на мобильных устройствах» (общее), блоки, «Добавить блок»,
«Отмена» и «Сохранить». Весь диалог — один draft; panel preview вне диалога
продолжает показывать сохранённые данные до успешного Save.

Открытие доступно и при скрытой панели в пределах прав §8.
На узком экране форма использует доступную ширину с отступами; скролл внутри
тела, footer с действиями доступен при экранной клавиатуре. Dropdown не выходит
за границы диалога/visual viewport, переносится вверх при нехватке места снизу.

«Сохранить» активно только после реального валидного изменения; trim для
проверки пустоты/лимитов, пользовательские тексты хранятся без наружных пробелов.
Отмена/X/Escape отбрасывают весь draft, включая локальный показ.
Не добавлять подтверждение несохранённых правок.
Ошибки у конкретных полей, фокус на первой при попытке Save.

### 4.3 Блоки и строки

Блок: заголовок, видимость, область «Все пространства» либо
«Определённое пространство» с выбором одного stable id, упорядоченные строки.
Новый блок: видимый, все пространства, пустой список с «Добавить значение»;
заголовок обязателен. Пустой список разрешён, пустая созданная строка — нет.
Перестановка блоков/строк: drag handle и кнопки «Выше»/«Ниже» с disabled
на границах. Удаление непустого блока подтверждается существующим confirmation
controller; удаление остаётся draft и отменяется общим Cancel.
Удаление строки/пустого блока не требует дополнительного подтверждения.

Строка: обязательное название + один источник. Picker содержит группы
«Системные показатели» и «Сущности Home Assistant». Полный доступный пользователю
`hass.states`, не плановый `_renderPlanHass`, без фильтра по размещению/домену.
Поиск по friendly name и entity_id, идентификатор виден при одинаковых именах.
Новые Template-сущности HA появляются после обновления states; формулы
создаются только в HA. Структура и значения выводятся как текст, не HTML.

Ограничения включают выключенные блоки: 10 блоков; 20 строк в блоке;
48 Unicode code points для заголовка панели/блока, 64 для названия строки.
На лимите Add disabled с объяснением. Все заголовки/названия непустые.

### 4.4 Удалённые ссылки — принятый Q5

Сравнение с последней подтверждённой сервером конфигурацией **по stable id**,
а не по позиции, тексту или равенству всего объекта:

| Ситуация | Что сохраняется и показывается |
|---|---|
| Старая entity пропала/стала недоступна/не видна пользователю | Точный entity_id сохраняется, warning в форме, нейтральное отсутствие данных в View; другие поля редактируются. |
| Старое пространство удалено | Его id сохраняется с warning, блок не показывается на другом пространстве; не подменять `all` или первым этажом. |
| Переименование/перестановка строки или блока со старой сломанной ссылкой | Разрешено; ссылка считается прежней, даже если текст/индекс изменён. |
| Новая строка без источника или новый scope без id | Ошибка, Save запрещён. |
| Новый/заменённый entity_id или space_id | Проверить корректность и существование/доступность выбора на момент Save; исчезнувший новый выбор — ошибка, не старый warning. |
| Существующая readable entity имеет `unavailable`/`unknown` | Допустимый конкретный выбор; состояние отображается честно, не нулём. |

Старый невалидный объект целиком не служит разрешением на произвольную новую
ссылку. Перенос строки между блоками (если реализован как delete/add) не обещан;
reorder внутри списка сохраняет id. Возможная потеря доступа не раскрывает
значение через backend и не заставляет автоматически удалять ссылку.

## 5. Layout, narrow, малые карточки и ввод

### 5.1 Геометрия overlay

Измерять **саму `.stage` House Plan** в CSS px, не window/экран и не HA narrow.
Внешние header/sidebar HA уже вне контейнера и второй раз не вычитаются.
При W ≥ H панель справа, при H > W снизу. Равенство — справа.
На resize положение меняется без собственного fit/refit; штатное поведение
камеры на реальное изменение stage не менять.

Overlay — DOM sibling трансформируемого слоя, не SVG/zoomwrap и не участник
layout flow. В 2D/изометрии одинаковый экранный UI. Он не входит в content bbox,
fit, размеры stage, экспорт геометрии, occlusion, room hits и sun/shadow model.

Габариты по Dashboard 5: минимум читаемой ширины **280 CSS px**;
справа ширина по содержимому в диапазоне 280…420 px, ограниченная доступным
местом; снизу компактно по содержимому с min-width `min(360, availableWidth)`,
max-width `availableWidth` и центрированием. 360 — **не жёсткий минимум**:
на телефоне шириной 360 px остаётся 336 px после отступов и панель обязана
помещаться, если проходит общий читаемый минимум 280 и ограничение высоты.
На более широкой области длинное содержимое может сделать bottom-панель шире
360 px, но не растягивать пустую/короткую панель на всю ширину.
Длинные подписи переносятся; строка значения не вытесняет название за границы,
длинный неразрывный текст переносится; единицы не скрываются молча.
Прокручивается область данных, заголовок остаётся доступен.

### 5.2 Контракт достаточности места

Базовые внешние отступы 12 px + реально применимые safe-area inset внутри HP.
Сверху/снизу резервируются пересекающие полосу панели контролы по измеренным
border boxes + 12 px; в киоске это плавающая панель управления, не жёсткая
поправка «высота телефона». Вкладки/инструменты вне stage повторно не вычитать.

После вычитания insets и control reserve получаем `availableWidth`,
`availableHeight`. Ограничение высоты: справа `availableHeight`,
снизу `min(0.60 * H, availableHeight)` — по макету.
`fits = availableWidth >= 280 && heightCap >= minimumReadableHeight`.
Нулевые/неизвестные начальные размеры считаются ещё не готовыми, не persist.

`minimumReadableHeight` измеряется на невидимом, inert/aria-hidden образце
минимального содержимого: заголовок панели, заголовок блока, одна строка
состояния с отступами/границами при выбранной ширине и текущем шрифте.
Текстовые входы образца: сохранённый заголовок панели, локализованный
образцовый заголовок блока и одна фиксированная локализованная строка статуса
«Источник недоступен». Не подставлять текущее HA-значение, все labels или число
реальных строк. Длинное live-значение меняет высоту прокручиваемой строки,
но не gate. Образец не подписывается на HA, не фокусируется и не участвует
в layout stage.
Берётся natural border-box без max-height/scroll. Увеличенный шрифт/zoom,
перенос заголовков и тема переизмеряют минимум. Не брать scrollHeight всех
реальных 200 строк: их переполнение должно включать scroll, а не скрывать панель.
Пустой состав использует такой же резерв одной читаемой строки.

Базовый минимум по CSS архива — 162 px (2 border + 48 header + 20 padding +
2 block border + 43 block header + 11 values padding + 36 row).
Это baseline проверки, не hardcode вместо измерения. При неизменной стороне и
типографике увеличение доступного размера монотонно разрешает показ.
Смена стороны заново проверяет свой height cap (right→bottom может скрыть
панель из-за ограничения 60%). Измерение не зависит от предыдущего hidden
и не чередует hidden/visible при постоянных размерах.

Примеры без дополнительных safe area/контролов и с baseline 162:
360×640 → снизу, ширина 336, fits; 303×640 → не fits, 304×640 → fits;
800×185 → высота 161, не fits; 800×186 → fits.
Для киоска с измеренным верхним пределом 72: 800×245 → не fits,
800×246 → fits. Проверки также используют реальную, а не заданную заранее
высоту контролов. 1 и 200 строк имеют одинаковый gate, но разный scroll.

### 5.3 Независимая мобильность

Общая настройка `show_on_mobile` проверяет **native HA narrow**.
Она не выбирает сторону и не является CSS breakpoint 768/600/etc.

`houseplan-panel` передаёт reactive `narrow` во full card при создании и
обновлении. В Lovelace изолированный adapter получает native narrow context
на HA, где он доступен; для поддерживаемых старых HA — boolean narrow
ближайшего штатного Lovelace host. Не monkeypatch приватные setter-ы,
не выводить narrow из W/H stage и не превращать Lovelace в custom panel.
HA minimum 2024.6 остаётся поддержанным.
Неопределённость имеет отдельное runtime `unknown`: при mobile=true не
мешает показу; при mobile=false скрывает до получения достоверного narrow.
Ни user-agent, ни новый пользовательский breakpoint не добавляются.

`viewAllowed` — full card находится в режиме View (обычном или kiosk),
не в редакторе плана, устройств или подложки (§4.1).
`effectiveVisible = viewAllowed && localShow && mobileAllowed && fits`;
mobileAllowed = sharedMobile || nativeNarrow === false.
Отсутствующая конфигурация использует defaults; неподдерживаемая версия
не исполняется (§9). Никакого дополнительного общего `enabled` флага.
Auto-hide не меняет localShow и не запускает WS save. Resize возвращает
панель, только если остальные guards разрешают.

### 5.4 Ввод и доступность

**Touch View: supported. Touch editor: supported только для новой простой
формы сводки.** Гарантии остальных редакторов остаются по
[TOUCH-SUPPORT](../TOUCH-SUPPORT.md); task не расширяет их.

Размер tappable зоны каждого контрола ≥44×44 CSS px; иконка может быть меньше
по макету. Кнопки не накладываются зонами. Составной контрол остаётся
обнаруживаемым, когда панель скрыта mobile/fits. На слишком узком экране
контролы не вынуждают stage становиться шире; использовать существующий
overflow шапки, а в киоске перенос компактных контролов.

Pointer down/click/double click/wheel/drag на overlay/его контролах не
попадают в pan/zoom/fit/действия устройств снизу. Скролл панели не масштабирует
план; `overscroll-behavior: contain`, без глобального запрета touch.
Начатый на плане pan/pinch остаётся плановым до завершения, не превращается
в click на панели; pointercancel снимает transient state, не сохраняет draft.
Keyboard focus виден, modal focus trap/возврат в opener через общий `hp-dialog`.
Клавиатурная альтернатива reorder обязательна; live values не озвучиваются
все одновременно через постоянно активный aria-live.
Появление короткое (190 ms по Dashboard 5), без изменения размеров плана;
`prefers-reduced-motion` отключает перемещение.

## 6. Модель конфигурации и defaults

Общая конфигурация: `ServerConfig.settings.summary_panel`, версия 1.
Wire naming — snake_case как остальная серверная конфигурация; camelCase
прототипа не копируется вслепую. Минимальный пример (значения label локализованы
при первом явном сохранении, пользовательский текст затем не переводится):

```json
{
  "version": 1,
  "title": "Сводная информация",
  "show_on_mobile": true,
  "blocks": [{
    "id": "b-default",
    "title": "Общее",
    "visible": true,
    "scope": {"type": "all"},
    "values": [
      {"id": "v-devices", "label": "Количество устройств", "source": {"type": "system", "key": "device_count"}},
      {"id": "v-area", "label": "Общая площадь комнат", "source": {"type": "system", "key": "total_area"}},
      {"id": "v-time", "label": "Текущие дата и время", "source": {"type": "system", "key": "datetime"}}
    ]
  }]
}
```

Другой scope: `{"type":"space","space_id":"stable-id"}`.
Другой source: `{"type":"entity","entity_id":"sensor.example"}`.
Для новых объектов id генерируются один раз (UUID), не из текста/индекса;
непустые ≤64 chars, уникальны среди блоков и среди всех строк панели.
Defaults ids детерминированы до первого сохранения; произвольные новые id
при каждом render запрещены. `collapsed` и независимых вложенных таблиц нет.

Отсутствие namespace даёт read-only derived default model: первое включение
даже у read-only не пишет сервер. При первом явном Save авторизованным
пользователем сохраняется версия 1. Это один начальный набор, не автоматический
создатель после каждого reload: присутствующее `blocks: []` и пустые values
никогда не reseed. Настоящий ноль площади/устройств допустим.

Локальная запись отдельна: `{version:1, show:false, icon_scale:1, font_scale:1}`.
Она не уходит в server config/export и не входит в ревизию общего конфига.
Нет сохранённых текущих HA states, вычисленных totals, времени и координат
панели. Системные значения вычисляются на чтение.

## 7. Источники и вычисления

### 7.1 HA states

Использовать текущий пользовательский `hass`, штатное formatEntityState/
эквивалент существующего HA formatter: локаль, единицы, локализованные enum,
precision. При недоступном helper — существующий безопасный текстовый fallback,
не кастомный список переводов state. Не извлекать произвольные attributes.
`unknown`, `unavailable`, отсутствующий id, отсутствие доступа/связи дают
различимое нейтральное состояние (где источник позволяет отличить причину),
не выдуманный 0/green; не показывать прежнее значение как свежее после потери
соединения. Значение появляется вновь при восстановлении.
Не обещать различить удаление и запрет доступа, если HA их не различает.

### 7.2 Уникальные устройства — Q2

Общий set реальных HA device_id, представленных на ≥1 действительном плане
по полному актуальному config/layout и registry, **до visual фильтров**.
Учитывать автоматическое размещение через HA area, привязанную к комнате,
и явные device/entity placement. Entity сопоставляется parent device_id.
Дубликаты сущностей/этажей дают один id; скрытый marker, HA disabled entity
или временно unavailable device не уменьшают число. Виртуальный marker,
самостоятельная entity без parent, удалённое из HA устройство, снятая с планов
привязка и orphan к удалённому пространству не добавляют id.
`removedPlanBindings` и существующее исключение явного возвращения child entity
обрабатываются тем же placement resolver, что продукт; не вводить счётчик
просто `Object.keys(registry).length`, visible roster или layout entries only.

Использовать общий для HA connection полный snapshot из `ha-binding-status.ts`:
успешные `config/device_registry/list` и `config/entity_registry/list`,
не `list_for_display`/`hass.entities`/сохранённый binding-status cache.
Эти штатные list API доступны также read-only пользователям; сам read-only
не причина отказа. При загрузке/ошибке одной команды/reconnect —
loading/unavailable, а не уверенный частичный total, прежний snapshot или 0.
Новый endpoint счётчика не нужен. Не обходить HA permissions и не переносить
snapshot между connections/пользователями. Backend `import_registry_snapshot`
для editor import не публиковать в View: это другой, неполный для этой цели
контракт. Источники: официальные
[device registry API](https://github.com/home-assistant/core/blob/2026.9.0/homeassistant/components/config/device_registry.py),
[entity registry API](https://github.com/home-assistant/core/blob/2026.9.0/homeassistant/components/config/entity_registry.py).

### 7.3 Чистая площадь — Q3

Для каждого существующего пространства получить канонический clean floor
каждой валидной комнаты: innerContourForRoom и floorMinusBodies с теми же
стенами/перегородками/колоннами, что `_cleanFloor` и значение площади комнаты.
Объединить **полные MultiPolygon с holes** внутри пространства и только затем
вычислить geometryArea; нельзя суммировать пересекающиеся комнаты или
превращать holes в наружные кольца. Для render-coordinate geometry использовать
`cmPerUnit = cell_cm / gridPitch` этого пространства, площадь в m² =
`geometryArea * cmPerUnit² / 10000`; не смешивать cm и render units.
Суммировать физическую площадь всех пространств. Копии этажей
независимы. Этаж без комнат даёт 0. Сломанная геометрия/сбой union не подменяются
нулём, суммой с double count или исчезновением остальных элементов плана:
показатель unavailable, диагностический код без пользовательской геометрии.

Округлять только итог через принятую систему единиц HA (m²/ft²) и существующий
room-area формат, не каждый полигон. Активное пространство и scope блока
влияют только на видимость строки, не на total. Вынести shared pure clean-floor
calculation, если существующая `_cleanFloor` привязана к активному пространству.

### 7.4 Время и обновления

Дата и время по locale/timezone HA, без секунд, обновление на границе минуты.
Немедленное обновление после resume/смены timezone. Один minute timer на
смонтированную видимую панель, только если datetime есть в видимых блоках;
при hidden/disconnect/page hidden остановлен. Не создавать timer на строку.

Area cache зависит от физической геометрии и cell_cm, device cache — от
placement/config/layout и registry revision. Обычный HA state update не
пересчитывает union или device roster. Entity rows обновляются адресно;
dropdown search index пересобирается по составу/именам, не по каждому значению.
Все observers/listeners/timers снимаются на disconnect.

## 8. Права, локальная идентичность и размеры

### 8.1 Режимы

| Пользователь/режим | Шестерёнка | Правая кнопка и размеры |
|---|---|---|
| Обычный View, `_canManageConfiguration` | Полная форма §4.2, явный вход «Размеры на этом экране» | Локально доступны |
| Обычный View, read-only | Только локальная часть: показать панель и размеры, без shared-полей | Локально доступны |
| Kiosk, в том числе HA admin | Та же локальная часть, без редакторов | Доступны из компактных контролов вне скрытой шапки |
| Редакторы плана/устройств/подложки | Новый View-контрол отсутствует | Существующие редакторские инструменты без изменений |

Локальная часть — адаптация общего shell настроек к правам, не второй
редактор структуры и не обход скрытой административной кнопки.
Shared-форма и runtime Save guard: `!kiosk && _canManageConfiguration`.
Сервер по-прежнему проверяет `may_write`/`admin_only`; не заменять контракт
безусловным `hass.user.is_admin`. До получения прав fail closed, локальные
настройки не открывают server writes. Kiosk не даёт редактор даже admin,
согласно [UX-MODES](../UX-MODES.md). Текущий `_canEdit` сам по себе этого
не гарантирует — нужен явный kiosk guard в новом handler.

### 8.2 Как различать карточки

Local preference key: версия namespace + HA user id + канонический route
dashboard/view + host kind + стабильный **логический путь экземпляра**.
Не один global key и не только hash card config: две одинаковые карточки
должны оставаться независимыми. Не runtime UUID, иначе reload теряет выбор.

Изолированный resolver связывает enclosing `hui-card` с логическим индексом
в native view: Sections — `[viewIndex, sectionIndex, cardIndex]`, Masonry —
индекс в исходном упорядоченном `cards`, не номер визуальной колонки.
Для stack/conditional дописывается путь вложенного card slot. Для собственного
`houseplan-panel` фиксированный primary slot. Для неизвестного custom wrapper
fallback — детерминированный composed slot path + ordinal совпадающей
конфигурации; не писать local preference до разрешения user/host identity.
Если идентичность нельзя достоверно получить, использовать session-only
настройку с честным пояснением, не чужой global preference.

Гарантия: reload/технический remount/обычный resize без изменения структуры
dashboard сохраняют выбор; два одинаковых instance не сливаются.
Редактирование/перестройка dashboard может изменить logical identity —
перенос по новому расположению не входит в эту версию. Preview/editor HA
не пишет preference рабочей карточки. Никакой автоматической записи YAML
dashboard или нового обязательного `card_id` пользователю.

### 8.3 Размеры на этом экране (#149)

Явный click/tap вход, не только long hold: «Размер значков устройств» и
«Размер текста карточек комнат». Сохранить диапазон 50…300%, шаг 5%, Reset 100%.
Локальное немедленное применение как в существующем size dialog;
закрытие завершает настройку, отдельный Cancel для размеров не вводится.
Это отличается от draft локального show в полной форме; названия действий
не должны обещать откат уже применённых размеров.

Сейчас `_kioskScale` применяется только при `_kiosk`. Расширить на обычный
**View** в 2D и изометрии: значки/room-card text следуют этим двум значениям;
редакторские узлы, физическая геометрия, room labels на плане, шрифт самой
сводной панели и остальные колор-пикеры/настройки не затрагиваются.
Масштабы не умножаются дважды в дочернем слое и iso. Размеры доступны при
любом hidden-поводе панели и без прав редактирования установки.

При отсутствии новой local записи один раз прочитать валидные legacy
`houseplan_card_kiosk_v1` icon/font как начальные значения, иначе 100%.
Старый ключ не удалять и не переписывать. Дальнейшие записи per-instance;
повреждённый/вне диапазона input нормализовать без NaN/exception.
localStorage disabled/quota не ломают UI; значение действует в текущей
сессии, показать нейтральное сообщение о невозможности сохранить на экране.

## 9. Сохранение, совместимость, импорт и безопасность

### 9.1 Общая запись и concurrency

Использовать `config/set` с текущим `expected_rev` и существующим write lock.
Передавать полный базовый config с заменой только `settings.summary_panel`,
без побочного изменения settings/layout/space geometry. Серверная форма
валидируется structural + change-aware semantic проверкой §4.4.
Не опираться только на frontend: raw WS с duplicate id/лишними строками/
пустыми названиями/невалидным discriminator должен отклоняться.

Draft хранит base revision, base panel и localShow snapshot. Shared Save:
запрос → подтверждённая сервером ревизия → применение localShow → закрытие.
Отказ/конфликт не применяет localShow и не уничтожает draft. Если изменён
только localShow, серверная запись не нужна. Header show, пока открыта modal,
недоступен из-за modal; не создавать два конкурентных локальных редактора.

При внешней конфигурации во время dirty draft показывать conflict и явную
возможность загрузить актуальную конфигурацию/начать заново, без silent merge
и overwrite чужих правок. `expected_rev` защищает и неизменённые разделы
полного config. Network timeout с неизвестным исходом: прочитать config/rev,
подтвердить применённое содержимое, не слать повторную blind запись.
При отказе localStorage уже успешно записанный shared config не откатывать
чужой серверной записью: apply local в памяти, сообщить об ограничении
переживания reload. «Атомарно» здесь значит отсутствие частичного draft при
отказе общего Save, не распределённая транзакция browser-storage/HA.

### 9.2 Версии и старые ссылки

`config/get` сообщает runtime capability `summary_panel_api: 1` (не поле
пользовательского config). Новая frontend + старый backend: View/local
настройки работают с читаемой схемой, shared-редактор disabled с подсказкой
об обновлении интеграции; не записывать config в обход неизвестной проверки.
Это дополнение существующего config/get, не новый metrics/state endpoint.

Сервер не требует существования каждой старой entity/space при каждом
постороннем config save. Structural schema ограничивает namespace/типы/размер;
references проверяются как diff к текущему серверному объекту по id.
Новый entity выбор проверять на наличие и разрешённое чтение текущим
пользователем, а не произвольным service/admin запросом. Старую ссылку можно
сохранить неизменённой при редактировании label/title/порядка.

| Вход | Политика |
|---|---|
| Старый config без namespace | Derived defaults; никаких обязательных записей при открытии. |
| Настроенная version 1 | Round-trip всех известных и неизвестных расширяющих полей; mutate только выбранные поля, не rebuild объекта с потерями. |
| Старый клиент не прислал существующий namespace в обычном config/set | Сервер сохраняет прежний namespace. Удаление всех блоков выражается `blocks: []`, не omission. |
| Незнакомая будущая version | Сохранить lossless при посторонних операциях, не исполнять и не редактировать как version 1; нейтральная недоступность панели, не сброс defaults. |
| Установка новой версии/rollback frontend | Не выполнять destructive миграцию store; старое поле остаётся расширением settings. |

Не менять глобальную версию геометрии/хранилища ради UI namespace.
Обновить registry полей/документы совместимости; allowlist нового namespace
не должна автоматически разрешить пользовательские исполняемые данные.
Сохранённые строки всегда проходят text rendering, id/source enumerations
не могут исполнять URL/HTML/JS. Unknown fields сохраняются, но не исполняются.

### 9.3 Export/import и privacy

Полный export/restore установки включает общую конфигурацию панели;
local preference/текущие значения/кеш registry не включает.
Полный restore — явная замена конфигурации (в том числе отсутствие панели
в старом полном архиве); это исключение из preserve-on-omission обычного Save.
Single-space export/import, plan-only, copy/new space не меняют глобальную
панель назначения. Если существующий full-import явно remap-ит space ids,
переписать scope по **той же** mapping; не угадывать по имени/первому этажу.
На перенос в другой HA корректные сохранённые refs, отсутствующие там,
разрешены как broken refs с warning. Это не пользовательский новый выбор;
структурно некорректный импорт отклоняется атомарно.

User-facing заголовки/entity_id и тем более текущие state values не добавлять
в support package, telemetry/logs. Существующая allowlist support exporter
остаётся fail closed; при необходимости допустимы только validated counts
блоков/строк/version. Данные HA state не запрашиваются через новый backend
proxy, не кэшируются между пользователями и не выводятся через небезопасный
HTML. House Plan read/write policy и secure-device invariant не ослабляются.

## 10. i18n и визуальное соответствие

Все новые runtime строки в **RU, EN, DE и FR** — всех четырёх существующих
поддерживаемых локалях. Ошибки frontend/backend — через текущий
локализационный путь. Паритет ключей, непустые значения и неизменные
placeholders проверяются штатными parity-тестами `npm test` по всем локалям
из `src/i18n/registry.ts`, согласно `CONTRIBUTING.md`.
Ключи и формулировки общих Save/Cancel/Close/Up/Down брать из существующего UI,
не дублировать. Пользовательские label/title не переводить после сохранения.

| RU | EN | DE | FR |
|---|---|---|---|
| Сводная информация | Summary | Übersicht | Synthèse |
| Настройки панели | Panel settings | Panel-Einstellungen | Paramètres du panneau |
| Показывать панель | Show panel | Panel anzeigen | Afficher le panneau |
| Название панели | Panel title | Panel-Titel | Titre du panneau |
| Отображать на мобильных устройствах | Show on mobile devices | Auf Mobilgeräten anzeigen | Afficher sur les appareils mobiles |
| Общее | General | Allgemein | Général |
| Все пространства | All spaces | Alle Bereiche | Tous les espaces |
| Определённое пространство | Specific space | Bestimmter Bereich | Espace spécifique |
| Добавить блок / Добавить значение | Add block / Add value | Block hinzufügen / Wert hinzufügen | Ajouter un bloc / Ajouter une valeur |
| Количество устройств | Device count | Anzahl der Geräte | Nombre d’appareils |
| Общая площадь комнат | Total room area | Gesamte Raumfläche | Surface totale des pièces |
| Текущие дата и время | Current date and time | Aktuelles Datum und Uhrzeit | Date et heure actuelles |
| Размеры на этом экране | Sizes on this screen | Größen auf diesem Bildschirm | Tailles pour cet écran |
| Нет показателей для этого пространства | No values for this space | Keine Werte für diesen Bereich | Aucune valeur pour cet espace |
| Недостаточно места для панели | Not enough space for the panel | Nicht genügend Platz für das Panel | Espace insuffisant pour le panneau |
| Источник недоступен | Source unavailable | Quelle nicht verfügbar | Source indisponible |

Также локализовать загрузку, no search results, удалённое пространство,
пустое обязательное поле, каждый лимит, conflict/reload, mobile-hidden,
storage-unavailable, unsupported-backend/schema, delete confirmation.
HA state names/units/date/time — HA locale, не переводы этой таблицы.

Матрица макетов: light/dark × right/bottom; ordinary/kiosk; панель hidden;
форма normal/narrow; пустой состав/старые broken refs/максимум строк;
длинные RU/DE/FR подписи, safe-area, крупный шрифт и 200% browser zoom.
Минимум ширины/высоты адаптируется без уменьшения шрифта.
Dashboard 5 определяет отступы, заголовки, порядок controls, палитру и иконки;
его `orientation: portrait`, `100vw/100vh`, demo states 50/156 m² и whole-config
localStorage заменяются соответствующими контрактами выше. Hit areas 27 px
прототипа не копируются: min 44 является продуктовым touch-контрактом.

## 11. Критерии приёмки и доказательства

AC1…AC20 соответствуют общей постановке issue; следующие уточняют инженерные
граничные случаи. **Все доказательства ниже планируются для реализации;
на стадии ТЗ ни unit, ни browser-pass по новому поведению не заявлены.**

| AC | Проверяемый контракт | Доказательство и отрицательный свидетель |
|---|---|---|
| AC1 | Раздельные settings/show, только shown/hidden, local per-card после reload. | Two-card identical-config smoke + reload; общий ключ или runtime UUID ломает независимость/сохранение. |
| AC2 | Overlay, W≥H справа/H>W снизу, bottom centered, без collapse/CRUD в View. | Unit W/H/equality и smoke высокой карточки в широком окне; заменить stage на window → тест красный. |
| AC3 | Одна адаптивная форма, доступ при hidden, все поля и Save/Cancel, dropdown не обрезан. | Mouse/keyboard/touch smoke narrow/keyboard viewport; bounds assert для list/footer. |
| AC4 | Draft Save/Cancel/X/Escape включает localShow, failure не применяет часть. | Unit save state machine + mocked WS failure/conflict/timeout; premature local write ломает assert. |
| AC5 | Block CRUD/reorder/visibility, confirm непустого delete, Cancel восстанавливает. | Unit и browser через реальные controls, не вызовом private handler. |
| AC6 | All/one exact space и visible фильтруют блоки, defaults all. | Табличный unit + смена этажей, same-title distinct ids. |
| AC7 | Новая пустая scope ошибка; старая deleted scope warning, сохраняется при rename/reorder. | Backend + frontend tests по stable id; сравнение всего объекта или fallback-first ломают тест. |
| AC8 | Row CRUD/reorder только в форме, pointer и кнопки дают один порядок. | Unit + мышь/клавиатура/touch; drag в View не меняет config. |
| AC9 | Пустой label/source запрещён, system source полноценен. | Negative tests raw WS и UI, trim/Unicode boundaries. |
| AC10 | Полный readable hass.states picker, friendly name/entity_id, новая Template entity. | Fixture entity вне плана, дубли friendly name и hot-add; plan-filter mutation → красный. |
| AC11 | Broken entity сохраняется при других правках; unknown/unavailable не 0; HA форматирование. | UI+server change-aware cases, потеря/восстановление связи, RU/EN/DE/FR/units. |
| AC12 | Первое включение даёт три defaults, реальные 0, intentional-empty не reseed. | Unit absent vs empty; read-only first show без WS, second reload/toggle. |
| AC13 | Лимиты 10/20/48/64 с hidden blocks, disabled Add и ошибки. | Both sides N−1/N/N+1, Unicode code points; прямой WS не обходит. |
| AC14 | Native narrow, localShow и fits независимы; W/H выбирает сторону. | Полная boolean/unknown unit matrix + custom panel/Lovelace native narrow smoke; fake 768 px mutation красный. |
| AC15 | View/kiosk controls и local sizes доступны, нет editor/service/pan leakage. | Touch pointercancel/pan/pinch/scroll/doubletap и admin-kiosk/read-only route guards; service spy 0. |
| AC16 | Общая persistence/export не меняет geometry/layout. | Backend round-trip/full/space/plan-only/copy + hashes geometry до/после. |
| AC17 | Макеты/темы/overflow/safe area без скачков камеры или перекрытия controls. | Fresh named screenshots + bounding boxes, zoom/pan matrix до/после show/hide; layout-column mutation красный. |
| AC18 | Q2 unique HA ids и Q3 union clean floor всех пространств. | Exact numeric fixtures §12, scope/activefloor не меняют total; visible-roster/sum-room-areas mutations красные. |
| AC19 | Общие правки приходят другому клиенту, local нет; права/конфликты сохранены. | Two-client revision test, read-only direct write refusal, admin_only=false writer и kiosk guard. |
| AC20 | Малый контейнер auto-hide, enlargement условно restore; длинный список scroll. | Границы 303/304 и 185/186, control-reserve/safe-area/largefonts, wide dashboard tiny card; remove-gate/reset-local/unconditional-show mutations красные. |
| AC21 | Identity стабильна без смешения identical cards/resize/HA users. | Native Sections/Masonry/nested fixtures, reload/remount/reflow, preview isolation, unknown-wrapper safe fallback. |
| AC22 | Новая/старая frontend/backend, unknown-version, omission сохраняют данные согласно §9. | Backend compatibility matrix, full restore exception; unrelated-save не уничтожает namespace/extension fields. |
| AC23 | В View 2D/iso local scales 50/100/300%, редакторы неизменны, old key не удалён. | Scale geometry/hit bounds и UI smoke; двойное умножение/только-kiosk mutation красные. |
| AC24 | Partial registry не total 0; read-only с полным snapshot получает правильный total. | Одна list-команда failed/reconnect, полный disabled-inclusive snapshot; no privileged API assertion. |
| AC25 | Без постоянного RAF/дублирующих timers/area recalculation от states. | Counters/timers/connection cleanup и performance fixture §12; unrelated state → 0 unions. |
| AC26 | User strings inert, выбранные states только из user hass, support без raw data. | XSS payload text-only, ACL/reconnect/user-switch, support allowlist test; never service calls. |

## 12. План реализации и автотестов (после отдельной команды)

1. Pure model/defaults/diff validation/local identity/layout; backend additive
   namespace и capability/compatibility. Тесты before UI integration.
2. Extract shared represented-device/clean-floor totals, states resolver/caches.
3. Overlay + header/kiosk controls + lazy form + narrow bridge + local sizes.
4. i18n/docs, интеграционные assertions, визуальные артефакты, performance.

Frontend unit: `test/summary-panel-model.test.ts`, `summary-panel-layout.test.ts`,
`summary-panel-sources.test.ts`, `summary-panel-preferences.test.ts` (названия
технически заменяемы). Реальные reducers/geometry helpers, не копия алгоритма
в тесте. Backend: `tests_backend/test_summary_panel.py` для config/get/set,
write guards, conflicts, change-aware semantics и import/export/support.
Полный HA harness — Linux CI, не фиктивный Windows-pass (`fcntl`).

Численные fixtures: один HA device с 2 children на 2 этажах → 1; другой hidden
и disabled → ещё1; virtual и no-parent → 0 дополнительных; removed binding
исключён, explicit restored child возвращает ровно 1. Ошибка registry отлична
от valid empty registry. Площадь: два перекрывающихся clean floor 4 m² и 4 m²
с overlap 1 m² → 7 m²; копия пространства → 14 m². Hole 1 m² сохраняется вычитанием,
не заполняется union. Разные cell_cm с одинаковой физической геометрией,
ft², колонны/partition bodies и failure union обязательны. Использовать
реальную canonical pipeline с отдельно известной ожидаемой площадью.

Browser smoke `demo/smoke_summary_panel.mjs`: реальные pointer/keyboard
действия и async WS/hass updates, fixture нескольких карточек/клиентов,
View/kiosk/2D/iso, narrow/native hosts, live mutable containers. Проверять
config/layout до/после, service calls, stage bounding rect, camera transform,
pointer hit boxes. Не ограничиваться DOM class/screenshot-only assertion.

Visual evidence: полный scene и close-up right/bottom в light/dark,
360×640 и 640×360, маленькая карточка в широком dashboard, fits boundaries,
kiosk safe area, длинный текст/empty/unavailable, форма и 200 строк. Сопоставить
Dashboard 5 и фактические скриншоты с отмеченными согласованными отличиями;
не объявлять визуальное соответствие по одному успешному screenshot capture.

Performance witness: до/после на одном baseline hardware, 200 rows/10 blocks,
10k HA states, 3 cards. После прогрева один unrelated state update → 0 geometry
unions,0 roster rebuild,0 picker index rebuild; matching state изменяет
нужные строки. Idle panel не запускает RAF, minute timers≤visible panels
с datetime; hidden 0. Cached metric overhead p95≤2 ms/update в demo runner;
threshold failure расследуется, не удаляется. Новая закрытая форма не
подгружает весь editor graph; initial View bundle≤256000 B gzip по repo budget.
Снять median/p95/render counters до/после через действующий perf harness;
state burst не добавляет long task>50 ms из-за summary.

Негативные свидетели из AC фиксировать в будущем code handoff конкретно:
какой assert падает при временном отключении guard/подмене resolver; не
коммитить мутации. Не менять fixtures/бюджеты ради зелёного результата.

## 13. Риски, откат и release-артефакты

Основные риски: зависимость host identity/narrow от HA frontend, false total
из visual roster, дырки lost при union, data loss из старого config writer,
UI leakage в kiosk, scrolling через overlay и импорт из другого HA.
Для каждого есть отдельный boundary/negative witness выше.
HA compatibility прогнать на minimum 2024.6 и актуальном поддерживаемом HA;
адаптеры изолированы, не делают публичные assumptions из частных методов.

Rollback: пользователю доступно local hide без удаления состава. Кодовый
откат не удаляет namespace/локальные ключи, не мигрирует геометрию назад,
не переписывает общий конфиг при открытии старого frontend. Любой destructive
repair — отдельное решение. Публикация только по команде владельца.

Обязательные артефакты будущей реализации:

- `docs/CHANGELOG.md` + `docs/CHANGELOG.ru.md`: включение сводки, local show,
  native mobile/малый контейнер, доступные локальные размеры; ссылка#437.
- `docs/USER-GUIDE.ru.md` и `docs/USER-GUIDE.md`: настройка,
  defaults, общие/локальные изменения, units/totals, причины hidden, права.
- `docs/UX-MODES.md`, `docs/TOUCH-SUPPORT.md`, `docs/ARCHITECTURE.md`,
  `docs/CONFIG-COMPATIBILITY.md`, `scripts/config-field-registry.mjs` и
  `scripts/config-schema.json`:
  narrow/overlay/per-card storage и compatibility-матрица.
- Fresh screenshots для guides и перечисленных выше golden сцен; принимать
  baseline только по полному Linux CI artefact через штатный reviewed путь.
- Implementation gates по текущему PROCESS: `npm run typecheck`, `npm test`,
  `npm run build`/`npm run bundle:sync`, budget, необходимые diff-selected
  smoke и backend tests. Перед бетой golden/smoke/performance/Linux HA,
  strict documentation screenshots. Команды/результаты на точном SHA, не
  ручные счётчики тестов (`npm run inventory` — источник числа тестов).

Сейчас этот commit — только ТЗ/SCOPE/index, `User-Visible: no`;
новые changelog/tests/product code до команды на реализацию не добавляются.
Ревью ТЗ выполняет независимый Claude по PROCESS, не автор/исследовательские
подагенты. После green и S5 остановка; issue не закрывается.

## 14. Принято предположительно — техническое, менять свободно на ревью

1. Namespace/version 1, snake_case, UUID/id limits, capability и diff-validation
   — способ реализации утверждённого shared/local поведения, не новый продукт.
2. Per-card key по logical host path с сохранением на reload; dashboard
   restructuring не получает миграцию identity. Fallback не использует общий
   preference. Legacy sizes seed новой записи без удаления старой.
3. Exact fit baseline 280×162, 12 px insets, side max 420/bottom preferred 360,
   height cap 60%, probe/ResizeObserver — вывод из Dashboard 5. Можно изменить
   механику, сохранив читаемость, small-card hide и все граничные AC.
4. Native narrow bridge для старых HA/unknown, caches/timer, lazy modules и
   perf fixtures — инженерная адаптация, не новые настройки пользователю.
5. Отсутствующий namespace читается как derived defaults без server write;
   deliberate empty остаётся empty. Это сохраняет первый запуск read-only.
6. Кодировки ошибок/id naming, расположение pure модулей и названия тестов
   допускают уточнение. Не допускают произвольного изменения Q1–Q5,
   прав/киоска, метрик, разделения shared/local или команды остановиться на S5.
