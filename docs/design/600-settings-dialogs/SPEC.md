# ТЗ: диалоги настроек House Plan, новая карточная компоновка

Issue: <номер после создания>. Референс: архив `houseplan-settings-design-2026-09-18.zip` (SHA-256 в первом комментарии).
Сверено с `Matysh/houseplan-card` dev `9683a59` (v1.76.0). Трек: полный. Изменения: **только UI**; состояние диалогов, конфиг, resolver'ы, сохранение, права и поведение продукта не меняются.

## Сценарий

Администратор дома (`docs/SCOPE.md`, persona 1) на desktop открывает четыре диалога настроек: Space (шестерёнка у вкладки этажа, а также создание пространства и шаг онбординга), General settings (шестерёнка карточки), Room settings (комната на плане, а также создание комнаты) и Device on the plan (маркер устройства, а также новое устройство). Домочадцы и гости диалогов не видят.

## Что человек увидит до и после

Вместо длинных одноколоночных списков полей человек увидит в каждом диалоге несколько карточек с понятными названиями, однотипные настройки в одну строку или в ряд плиток, пояснения по кнопке «?» рядом с заголовком, компактное поле цвета вместо всплывающей панели с ползунками, и всегда видимые внизу кнопки действий.

## 1. Ценность, скоуп и не-скоуп

Ценность для пользователя 8/10 (ориентация, меньше прокрутки, единая логика контролов во всех диалогах). Ценность для разработки 6/10 (одна библиотека примитивов формы вместо четырёх наборов правил). Сложность 6/10, риск 4/10 (риск только в регрессе разметки и селекторов тестов, данные не трогаются).

**В скоупе:** разметка и стили четырёх диалогов во всех их режимах (edit, create, шаг онбординга для Space, очередь «Room N of M» для Room, новое устройство для Device); общие примитивы формы; i18n en/ru/de/fr для новых и переименованных подписей; обновление smoke-селекторов; документация и changelog.

**Не в скоупе:** любые изменения `SpaceDialogState`, `_settingsDialog`, `_markerDialog`, полей комнаты и их семантики; конфиг и миграции; resolver'ы (север, фон, солнце, заливки, роль света, значение бейджа); сохранение и права; логика загрузки плана, топологии Zigbee, радара, пылесоса, бэкапа и оптимизации; другие диалоги (декор, summary, optimize, backup) и панели.

**Правило «только UI»:** меняется только разметка и стили четырёх форм; код продукта глобально не трогается. Если при реализации оказывается, что визуальное решение прототипа требует изменить логику (новое поле состояния, другой порядок вычислений, иная семантика значения), это не делается молча и не решается самостоятельно: реализующая сессия уточняет у JB в чате (уже найденные случаи с предлагаемыми вариантами перечислены в `OPEN-POINTS.md`). До ответа сохраняется текущее поведение продукта, а визуал адаптируется.

## 2. Референс и приоритеты

Прототип: `reference/` (открыть `node serve.mjs` → http://127.0.0.1:8135/, `file://` не работает). Переключатель «Form» в верхней панели показывает четыре формы; это часть демо, не продукта. Скриншоты каждой формы целиком: `screenshots/`. Разложить референс в `docs/design/<NN>-settings-dialogs/reference/` по образцу #505.

Приоритет: это ТЗ > действующие контракты House Plan (данные, безопасность, доступность, hp-dialog, touch) > визуал и взаимодействия прототипа > детали реализации прототипа. JS прототипа не продуктовый код: localStorage, демонстрационные пространства, устройства и списки в продукт не переносятся. Допустимые адаптации: переменные темы HA вместо фиксированных hex, семейство шрифтов HA, размеры текста не ниже 14 px, цели касания 44 px, переносы на узких экранах, действующие правила hp-dialog (закрытие, фокус, fullscreen в реальном HA). Без глобального перестиливания: селекторы под `hp-dialog[data-kind="space"|"settings"|"room"|"marker"]` и ключом онбординга.

## 3. Общая визуальная система

### 3.1 Карта визуальных целей (CSS px при обычном масштабе текста)

| Поверхность | Прототип | Цель в продукте / допустимая адаптация |
|---|---|---|
| Оболочка | Ширина 560, высота min(940, окно − 48), радиус 15, тень 0 12px 36px | `wide` + scoped `--hp-dialog-wide-width: 560px`; в реальном HA проверить `--ha-dialog-width-md`; fullscreen-политика HA на узких экранах сохраняется |
| Шапка | 70 высота, круглая кнопка X 44 (серый круг, заполненный знак), заголовок 20/600, справа бейдж с именем пространства | Существующая шапка hp-dialog; бейдж имени (`.space-badge`, 14 px, фон #f6f6f6, радиус 7, ellipsis 180 px) добавляется в слот заголовка |
| Тело | Фон #f6f6f6, padding 16, карточки белые, граница 1 px #ddd, радиус 11, gap 16, заголовок карточки 20/600 с padding 16 16 12, контент padding 0 16 16 | Те же карточки на переменных темы (`--card-background-color`, `--divider-color`); один общий вертикальный скролл тела, внутренних скроллов нет; шапка и футер закреплены |
| Подзаголовки | 16/600 (Floor plan, Room fill, Visible layers) + «?» | `h3` + существующий `_help()` (hp-help) |
| Поля | text/select 44 высоты, радиус 7, граница #ddd, hover #b3b3b3, focus акцент; select с собственной стрелкой (12×7, отступ 10 слева и справа) | Существующие `.namein` / `.areasel`, при необходимости scoped-правки высоты и радиуса |
| Сегментированный контрол | Контейнер #f6f6f6, граница #e5e5e5, padding 3, радиус 7; сегмент 14/500, padding 9 5, активный: фон #f3f9fc, граница #b7d5e4, текст #398fb8 | Новый scoped-компонент строки на `input[type=radio]` внутри `label` (как `.markerradios`), активный на `--primary-color` с осветлением |
| Полная строка настройки | Сетка 28 / 1fr / 44: иконка 19 px по центру строки названия, название 14/600 + «?», подпись 14 #777 ниже, тумблер справа; min 58, padding 11 0 | `ha-switch` в правой колонке; иконки mdi-эквиваленты (см. §5) |
| Компактная строка | То же без подписи и разделителей: min 40, padding 2 0, название 14/500, gap 2 между строками | Только для Visible layers |
| Плитки значений | Сетка 4 колонки, gap 8; плитка min 72, padding 10 6 9, радиус 8, иконка 22 сверху, подпись 14/500 снизу; активная как активный сегмент; disabled: opacity .45 | `label` + скрытый `input[type=checkbox]`; ≤ 480 px две колонки |
| Радио в строку | Подпись слева 14/600, справа три `input[type=radio]` 16 px с текстом 14, gap 18; ≤ 480 px переносятся под подпись | Sunlight through windows |
| Поле цвета | Плашка по ширине содержимого: фон #fafafa, граница 1 px #e5e5e5, радиус 9, padding 8 10, gap 10, min 44; свотч 38×38 (белая рамка 3 px, обводка #d8d8d8, радиус 6) с системным пикером, hex-код 14 px #888 tabular, «Opacity» + числовое поле 0–100 с «%» (42 высоты), текстовая ссылка Reset; на узком экране переносится | Новый компактный вариант поля цвета вместо текущего `hp-color-opacity` с всплывающей панелью HSB (см. §5 «Поле цвета»); только в диалоге Space |
| Компас | Кружок 44×44 справа от селекта North, «N» на уровне заголовка вне вращающейся стрелки, стрелка поворачивается на итоговый угол | Как в прототипе; угол из существующего resolver `northDegOf` |
| Футер | Слева Copy и Delete (danger-outline), справа Cancel и Save (primary); статус «Unsaved changes» между ними | Существующий `dialog-action-footer` с группами; порядок и состояния по §4 |

| Плитки цвета (General) | Сетка 3 колонки, gap 8; плитка: рамка #ddd, радиус 8, padding 6; свотч на всю ширину 48 высоты с названием цвета поверх (тёмный или белый текст по яркости), ниже hex 13 px и поле Opacity 32 высоты | `label` + `input[type=color]`; ≤ 480 px две колонки |
| Кнопка выбора источника (Room, Device) | Кнопка в стиле select: жирное имя + серый идентификатор + стрелка; под ней встроенная панель: поле поиска и список кандидатов (имя + идентификатор), выбранный подсвечен | Существующие `dropbtn` / `droppanel` / `candlist` в новом стиле, панель в потоке, а не поверх |
| Чипы (Device: Controls other light sources, Manuals) | Чип 36 высоты, фон #f3f9fc, граница #b7d5e4, иконка 16, текст 14/500, кнопка × 28 | Существующие `ctrlchips` / `pdftag` в новом стиле |
| Превью маркера (Device) | Блок на фоне #f3f9fc, радиус 9: заголовок Display preview + тег Now, слева сцена 150×150 с маркером, справа таблица фактов | Существующий `hp-device-preview` целиком внутри блока; прототип показывает упрощённый макет, состав фактов и переключатели Now / Example берутся из продукта |
| Поле иконки (Device) | Превью 44×44 + текстовое поле + кнопка очистки; под ним «Auto: … (by icon rules).» и ссылка Pin | Существующая логика авто-иконки и Pin |

### 3.2 Общие UX-детали

- Пояснения: существующий `hp-help` без изменений логики (кнопка «?» 32 px, тултип по наведению, клику и фокусу, закрытие по Escape и клику вне, позиционирование под или над кнопкой). Меняется только место: кнопка стоит справа от заголовка поля или подзаголовка группы; абзацы `rhint` и `*_tip` под тумблерами не показываются. Тексты десяти пояснений: `helpCopy` в `app.js` прототипа (scale, floorPlan, borders, walls, fill, layers, names, cardSize, north, light). Где ключ уже есть (`space.cell_cm.help`, `space.zero_wall_style.help`, `space.fill_mode.help`, `space.bg_mode.help`, `space.north.help`), текст можно заменить на версию прототипа или оставить текущий; новые ключи добавляются.
- Иконки строк: продукт использует `ha-icon` mdi; допустимые эквиваленты: borders → `mdi:border-none-variant`, type → `mdi:format-text`, sofa → `mdi:sofa-outline`, door → `mdi:door`, temperature → `mdi:thermometer`, humidity → `mdi:water-outline`, bulb → `mdi:lightbulb-outline`, copy → `mdi:content-copy`, trash → `mdi:delete-outline`, link → `mdi:link-variant`, eyeOff → `mdi:eye-off-outline`. Знак Zigbee обязателен из `assets/zigbee-glyph.svg` прототипа (inline SVG, currentColor), не заменять на Wi-Fi.
- Ведущие иконки центрируются относительно строки названия, подпись ниже; кнопка «?» по центру рядом с названием.
- Разделительных линий внутри карточек нет (исключение: линия под строкой Sunlight through windows в Space settings); группы разделяются отступом 22 px.
- Цвета прототипа: акцент `#4a9ec6`, активный фон `#f3f9fc`, активная граница `#b7d5e4`, активный текст `#398fb8`, danger `#db543d`, muted `#777`, линия `#ddd`, канва `#f6f6f6`. В продукте выражаются через переменные темы (`--primary-color`, `--card-background-color`, `--secondary-background-color`, `--divider-color`, `--secondary-text-color`, `--error-color`) с осветлением для активного фона; тёмная тема HA обязательна.
- **Поле цвета (новый пикер).** Сейчас цвет задаётся через `hp-color-opacity`: маленький свотч открывает собственную всплывающую панель с полем Hue/Saturation/Brightness, тремя слайдерами, hex-полем, слайдером Opacity и кнопкой OK. В новой форме это заменяется компактным inline-полем, как в прототипе (`colorField` в `app.js`, `.color-field` в `styles.css`):
  - плашка по ширине содержимого: свотч 38×38 в белой рамке (цель касания вместе с рамкой 44), справа hex-код текстом, затем подпись «Opacity» и числовое поле 0–100 с «%» (там, где прозрачность есть: Border & name color, Fill color), в конце текстовая ссылка Reset (там, где есть значение по умолчанию);
  - клик по свотчу открывает **системный пикер браузера** (`<input type="color">`: на desktop Chrome/Edge/Firefox это нативная панель с пипеткой, спектром, HSB/RGB/HEX; в компаньоне HA на iOS/Android нативный лист ОС). Собственная всплывающая HSB-панель и кнопка OK не используются: изменение применяется в черновик сразу, фиксируется общим Save;
  - opacity вводится числом; слайдер прозрачности убирается;
  - тёмная тема: плашка и свотч на переменных темы; свотч показывает итоговый цвет без шахматной подложки (прозрачность видна по числу);
  - fallback: если браузер не поддерживает `input[type=color]` (деградирует до текстового поля), показывается редактируемое hex-поле с валидацией `#rrggbb`;
  - во всех четырёх диалогах поле цвета новое; прочие потребители `hp-color-opacity` (редактор декора, summary, радар) не меняются, компонент остаётся; новое поле реализуется отдельным компактным компонентом или режимом `compact` без изменения поведения у других потребителей.
- Reduced motion: переходы отключаются по `prefers-reduced-motion`. Forced colors: селект возвращает системную стрелку.


### 3.3 Общее поведение всех диалогов

- Один Save на форму. Save неактивен без изменений, при ошибках валидации и при `busy`; действующие условия продукта (пустое имя, режим файла без изображения, невалидный диапазон температур, отсутствие привязки при выборе из HA) остаются ошибками.
- Статус в футере: без изменений пусто; при изменениях «Unsaved changes»; при ошибках «Review N fields» с прокруткой к первому ошибочному полю и фокусом.
- Cancel, X и Escape при несохранённых изменениях спрашивают Keep editing / Discard changes (существующий механизм подтверждения); без изменений закрывают сразу.
- Пояснения только через «?» (`hp-help`) у заголовка поля или группы; абзацы `rhint` / `*_tip` под контролами не показываются, их тексты переезжают в «?».
- Один вертикальный скролл тела, шапка и футер закреплены. Внутренних скроллов карточек нет.
- Ошибки в `aria-live`, `aria-invalid` на полях; все интерактивные цели ≥ 44 px; видимый фокус.

## 4. Диалог Space settings

### 4.1 Текущая панель → новая

| Область | Сейчас | Новая панель |
|---|---|---|
| Структура | один список полей, заголовки-подписи «Display», «Room card shows:» | четыре карточки: Basics, Appearance, Room cards, Sun & light |
| Оболочка | `wide` 500 px, скролл всего тела вместе с полями | 560 px, шапка и футер закреплены, скроллится только тело; в шапке бейдж с именем пространства |
| Title / Scale | два отдельных поля друг под другом | одна строка: Space name + Grid cell size, подсказки под полями |
| Floor plan | два радио-пункта, загрузка под первым | две choice-карточки в ряд; панель загрузки только для режима изображения |
| Always show room borders | тумблер + текст | строка с иконкой, подписью и «?» |
| Zero-thickness walls | селект | сегмент Dashed / Solid с образцами линии |
| Border & name color | свотч со всплывающей HSB-панелью, без сброса | inline-поле цвета (свотч с системным пикером, hex, Opacity %, Reset) |
| Room fill | четыре радио в столбик, Custom/Temp-детали внутри списка | сегмент Custom / Zigbee / Lights / Temperature; детали под сегментом |
| Hide the decorative layer, Hide openings | два тумблера «скрыть» с абзацами пояснений | группа Visible layers: компактные строки Decorative layer, Doors, windows & gates с логикой «включено = видно», пояснение в «?» группы |
| Show zigbee signal (LQI) next to devices | тумблер в общем списке | компактная строка «Zigbee signal next to devices» в Visible layers |
| Show room names (drag to move) | тумблер | строка с иконкой, подписью и «?» |
| Room card shows: 4 тумблера | четыре строки | ряд из четырёх иконочных плиток «Values on the card», disabled при выключенных названиях |
| Room-card font size | слайдер + процент + образец карточки | слайдер + числовое поле % + Reset to 100%, без образца карточки |
| Plan background | селект; при Static color свотч с кнопкой Inherit general или надписью «inherits general settings» | сегмент General settings / Static color / Follows the Sun; поле цвета с Reset только для Static color |
| North on the plan | числовое поле с placeholder «Inherit general» и текстом «inherited: N°» | селект Use general settings · N° / Custom direction + компас 44 px; поле градусов только для Custom |
| Sunlight through windows | селект | подпись + три радиокнопки в одну строку |
| Light-source glow | тумблер + текст | строка с иконкой, подписью и «?» |
| Пояснения | абзацы `rhint` под тумблерами и `?`-кнопки `hp-help` у части полей | только `?`-кнопки `hp-help` (тот же компонент и поведение: тултип по наведению или клику) у заголовка каждого поля или группы; абзацы `rhint` убраны |
| Разделители | линии между секциями списка | внутри карточек нет, кроме линии под Sunlight through windows; группы разделены отступом 22 px |
| Футер | Copy, Delete, Cancel, Save; Save активен всегда, закрытие без вопроса | Copy и Delete слева, Cancel и Save справа; Save только при изменениях и без ошибок; статус Unsaved changes / Review N fields; подтверждение при закрытии с изменениями |



### 4.2 Состав карточек

Все ключи состояния относятся к `SpaceDialogState` (`src/space-dialog.ts`) и не меняются. Подробная карта «поле прототипа → ключ состояния → ключ i18n → контрол» приложена в архиве (`docs/FIELD-MAP.md`).

**Карточка 1. Basics**

1. Сетка 2 колонки (1fr / 175 px): `Space name` (text, maxlength 80, подсказка «Shown in the space tabs.») и `Grid cell size` (number + единица `cm / cell` или `in per cell` при imperial, «?» = `space.cell_cm.help`, подсказка «Scale of the plan.»). При изменении масштаба относительно сохранённого под сеткой показывается предупреждающий callout: пересчёт размеров всего пространства при сохранении.
2. Подзаголовок `Floor plan` + «?». Две choice-карточки радиокнопок в ряд: `Draw it myself` («Outline rooms in the plan editor.») и `Use a floor-plan image` («Add an image to draw over.»). Панель загрузки появляется только для режима изображения: drop-зона с кнопками Choose file и Browse uploaded (существующий серверный пикер `pickSaved`), после выбора: превью, имя файла, Replace и ссылка Browse uploaded images. При переключении на Draw при сохранённом изображении показывается callout «Your uploaded image is kept. Switch back to use it again.».

**Карточка 2. Appearance**

1. Полная строка `Always show room borders` (иконка, подпись «Show patterned outlines around the walls.», «?», тумблер) → `showBorders`.
2. `Zero-thickness walls` + «?» → сегмент [`Dashed` | `Solid`] с образцами линии → `zeroWallStyle`.
3. `Border & name color` → новое поле цвета (§5) + `Reset` → `roomColor`, `roomOpacity`; Reset возвращает продуктовые defaults.
4. Подзаголовок `Room fill` + «?» → сегмент [`Custom` | `Zigbee` | `Lights` | `Temperature`] → `fillMode` (значения `custom | lqi | light | temp`, как `SPACE_FILL_UI_MODES`). Под сегментом: для Custom поле `Fill color` (цвет, opacity, Reset → `customFill = null`); для Temperature `Comfort range` (Minimum / Maximum °C, подпись Cold / Comfort / Hot, ошибка «The maximum must be higher than the minimum.»); для Zigbee и Lights одна строка пояснения.
5. Подзаголовок `Visible layers` + «?» → три компактные строки с тумблерами: `Decorative layer` (инверсия `hideDecor`), `Doors, windows & gates` (инверсия `hideOpenings`), `Zigbee signal next to devices` (`showLqi`).

**Карточка 3. Room cards**

1. Полная строка `Show room names` («Display room names and their selected values.», «?») → `showNames`.
2. Подпись `Values on the card` и ряд из четырёх плиток: `Temperature` (`labelTemp`), `Humidity` (`labelHum`), `Zigbee signal` (`labelLqi`, полное имя «Average Zigbee signal» в title и aria-label), `Lights on / off` (`labelLight`). При `showNames = false` плитки disabled, значения сохраняются, под плитками подсказка «Values are saved but hidden. Show room names to display them.» со ссылкой, включающей названия.
3. `Room-card font size` + «?», справа ссылка `Reset to 100%`; строка: слайдер 50–300 шаг 5 + числовое поле с `%`; подписи концов 50 % / 300 %; подсказка «Scales every room card in this space.» → `cardFontScale` (в состоянии хранится доля, в UI проценты). Образец карточки под слайдером (`_renderCardPreview`) в новой панели отсутствует.

**Карточка 4. Sun & light**

1. `Plan background` → сегмент [`General settings` | `Static color` | `Follows the Sun`] → `bgMode` (`null | static | daynight`). Для Static color под сегментом `Background color` (поле цвета §5 без Opacity) + Reset → `bgColor = null`. Строки «Currently: …» и подсказка под Follows the Sun не показываются.
2. Строка `Sunlight through windows`: подпись слева, справа три радиокнопки `Use general settings` / `On` / `Off` → `sunRays` (`null | true | false`). Под строкой единственный внутри карточек разделитель.
3. `North on the plan` + «?»: селект [`Use general settings · <наследуемый угол>°` | `Custom direction`] и справа компас 44×44. При Custom ниже поле `North direction` (integer 0–359, `°`) и ссылка `Use general settings` → `northDeg` (`null | int`). Ошибка: «Enter a whole number between 0° and 359°.».
4. Полная строка `Light-source glow` («Show a soft glow around lights that are on.», «?») → `glowEnabled`.

**Футер**: слева `Copy` и `Delete` (только в режиме edit; Delete в стиле danger-outline с подтверждением, блокировка `deleteBlockers` показывается как сейчас), справа `Cancel` и `Save`. В режиме create вместо Copy/Delete остаётся `Skip` при импорте.


### 4.3 Контракт поведения (только Space)

- Один Save на всю форму. Save неактивен, пока черновик равен сохранённому состоянию, при ошибках валидации и при `busy`. Условия из текущего кода (пустое имя, режим файла без изображения) остаются ошибками.
- Статус в футере: без изменений ничего не показывается; при изменениях текст `Unsaved changes`; при ошибках вместо него ссылка `Review N fields`, которая прокручивает к первому ошибочному полю и ставит в него фокус.
- Cancel, X и Escape при несохранённых изменениях показывают подтверждение `Keep editing` / `Discard changes` (через существующий `hp-confirm` / danger-confirm); без изменений закрывают сразу. Клик по скриму ведёт себя как Cancel.
- Инверсия слоёв: в UI «включено» значит «видно»; `hideDecor` и `hideOpenings` в состоянии и конфиге не меняются, инверсия только в контроле.
- `showNames = false` блокирует плитки значений, но не сбрасывает `labelTemp/Hum/Lqi/Light`.
- Изменение масштаба меняет только физические размеры плана; точки геометрии не двигаются (как сейчас, через `cellCm`).
- Reset у Border & name color возвращает значения по умолчанию продукта для `roomColor` / `roomOpacity` (те же, что применяются к пространству без переопределения). Reset у Fill color → `customFill = null` (DEFAULT_CUSTOM_FILL). Reset у Background color → `bgColor = null`.
- Наследуемые значения (север, солнце, фон) берутся из существующих resolver'ов `northDegOf`, `bgModeOf`, `stageBgOf`; значения-заглушки прототипа (165°, «enabled») в продукт не переносятся.
- Copy и Delete: существующие сценарии (`openSpaceCopyDialog`, `_deleteSpace`, блокировка по устройствам) без изменений.
- Валидация: имя не пустое; cellCm в пределах CELL_CM_MIN…MAX; tempMin < tempMax при `fillMode = temp`; northDeg целое 0–359; cardFontScale 50–300 %; opacity 0–100 %. Сообщения из прототипа (`app.js`, `errorFor`) как текст i18n.


## 5. Диалог General settings

### 5.1 Текущая панель → новая

| Область | Сейчас | Новая панель |
|---|---|---|
| Структура | одна колонка с заголовками-подписями (`dispsection`) | карточки: Display, Zigbee links, Room fill colors, Light-source glow, Plan, Sun, Data |
| Подсказка `gs.hint` | абзац вверху | «?» у карточки Room fill colors |
| Show the room information window on hover, Show live presence on the plan | тумблеры + абзац | карточка Display: две полные строки с иконкой и подписью |
| Zigbee links (`hp-zigbee-topology-settings`) | заголовок с «?», тумблер, подсказка, блок провайдеров | карточка с «?» у заголовка; тумблер строкой с подписью; при включении callout «Save this setting before loading topology data» (пока не сохранено), подразделы ZHA и Zigbee2MQTT: подсказка, поле Base topics, предупреждение о скане, кнопки Read ZHA data / Update map · topic со статусом |
| Fill: lights / temperature / zigbee signal | 8 строк «подпись + свотч» | карточка Room fill colors, подразделы Lights / Temperature / Zigbee signal, цвета плитками по три в ряд (название на свотче, hex, Opacity) |
| Light-source glow | 2 свотча + Glow radius | две плитки + поле Glow radius с «?» и единицей |
| Walls, Stage background | свотч; селект + свотч с Inherit | карточка Plan: Wall fill плашкой; Plan background сегментом [Static color \| Follows the Sun]; при Static поле Background around the plan с Reset и подсказкой «Using the theme background» / «Custom background color» |
| Sun | компас 150 px, поле градусов, Clear; тумблер; селект Sun rays | карточка Sun: North on the plan с «?», поле градусов (placeholder «not set»), ссылка Clear, компас 44 px справа; Sunlight through windows строкой с тумблером; Sun rays сегментом [From the inner window corners \| From the outer window corners]; `gs.sun_missing` при отсутствии sun.sun остаётся callout'ом |
| Backup and transfer, Plan maintenance | два заголовка с текстами и кнопками | карточка Data с двумя подразделами; кнопки Export / Import и Optimize plans; условные Undo last full import / Undo last optimization остаются в тех же подразделах |
| Футер | Reset to defaults, Cancel, Save | Reset to defaults слева, Cancel и Save справа, статус изменений |

### 5.2 Состав и правила

1. Display: `showRoomTooltip`, `radarShowLive` (подпись строки = `gs.radar_show_live_hint`).
2. Zigbee links: `zigbeeTopology` без изменений логики; `hp-zigbee-topology-settings` перестраивается в стиле карточки (или получает scoped-стили), тексты те же (`topology.*`), кнопки провайдеров неактивны, пока настройка не сохранена (`savedEnabled`), как сейчас.
3. Room fill colors: `colors.light_on|light_off|light_none|temp_cold|temp_ok|temp_hot|lqi_low|lqi_high` плитками; opacity в UI в процентах, в состоянии доля 0–1.
4. Light-source glow: `colors.glow_base`, `colors.glow_light` плитками; `glowRadius` число + `gs.unit_m` / `gs.unit_ft`.
5. Plan: `colors.wall_fill` плашкой; `bgMode` сегмент; `bgColor` поле с Reset → `null` (`gs.bg_default`).
6. Sun: `northDeg` (null = «not set», Clear → null), компас показывает угол; `sunRays` тумблер; `sunRayOrigin` сегмент.
7. Data: `_openBackupExport`, `_pickBackupImport`, `_openAlignDialog`, undo-кнопки без изменений; только для `_canEdit`, как сейчас.
8. Reset to defaults: та же логика, что у текущей кнопки `gs.reset`.

## 6. Диалог Room settings

### 6.1 Текущая панель → новая

| Область | Сейчас | Новая панель |
|---|---|---|
| Структура | одна колонка: имя, область, «Room settings (override the space)», источники, «Font sizes», образец карточки | карточки: Basics, Fill, Sensor sources, Font sizes |
| Display name, Home Assistant area (unassigned) | два поля друг под другом | одна строка из двух полей; у области «?» с пояснением, что в списке только свободные области |
| Fill in THIS room | 6 радио (As the space, None, Zigbee signal, Lights, Temperature, Custom color) | строка-тумблер «As the space»; при выключении сегмент [None \| Zigbee \| Lights \| Temperature \| Custom]; Custom → поле цвета (Space color / Room color, Reset); Temperature (эффективный режим, включая унаследованный) → Comfort range с плейсхолдерами границ пространства, легендой Cold / Comfort / Hot, ссылкой «As the space» и «?» (`room.temp_range.help`) |
| Temperature source, Humidity source | по два радио и кнопка выбора | карточка Sensor sources с «?»: для каждого сегмент [Average of the room’s sensors \| Specific device or entity]; при выборе конкретного кнопка выбора и встроенный список с поиском |
| Font sizes | два слайдера с процентом + образец карточки | карточка Font sizes с «?»: Room name size и Metrics size как в Space (слайдер, число %, Reset to 100%), подсказка про размер карточек пространства; образец карточки убран |
| Футер | Cancel, Save (create: Keep as walls, Save) | то же, плюс статус изменений; в create-режиме Keep as walls остаётся слева |

### 6.2 Состав и правила

1. Basics: `_nameSel`, `_areaSel`; логика подстановки имени из области при пустом имени без изменений.
2. Fill: `_roomFill` ('' = As the space), `_roomCustomFill` (null = цвет пространства до первого изменения, Reset → null), `_roomTempMin/_roomTempMax` (строки, пустое = граница пространства, `roomTempThresholdDraft` без изменений).
3. Sensor sources: `_roomTempSrc`, `_roomHumSrc` ('' = среднее); кандидаты из `_roomSrcCandidates()`; `_roomSrcOpen` / `_roomSrcFilter` как сейчас.
4. Font sizes: `_roomNameScale`, `_roomLabelScale` (доли; в UI проценты 50–300 шаг 5).
5. Create-режим (`_roomEditId` пуст): заголовок «New room» или «Room N of M», те же карточки, кнопки Keep as walls / Save по текущим условиям (`canSaveNew`).

## 7. Диалог Device on the plan

### 7.1 Текущая панель → новая

| Область | Сейчас | Новая панель |
|---|---|---|
| Структура | одна колонка с рамочными группами (`markerlightgroup`) | карточки: Basics, Tap action, Light and glow, Appearance, Details |
| Name, Bind to an HA device, Room | поле; рамка с двумя радио, тумблером Show entities и кнопкой выбора; селект | Basics: Name с подсказкой «Shown on the plan»; сегмент [Virtual device \| Pick from the HA list] с «?»; кнопка выбора со встроенным списком, поиском и чекбоксом Show entities внутри панели; Room селектом с подсказкой auto / override |
| Tap action, Ask for confirmation, Controls other light sources | селект, текст Target/Now, тумблер, поле поиска с чипами | карточка Tap action: селект, подсказка Target/Now, строка-тумблер Ask for confirmation (скрыта при Do nothing), Entity to toggle и What to run как сейчас по условиям, Controls other light sources с «?»: чипы выбранных и поле поиска со списком |
| Is this device a light source?, Glow colour and brightness, Glow radius | две рамочные группы радио, свотч + слайдер, поле | карточка Light and glow: сегмент [Auto \| Always \| Never] с подсказкой результата Auto (`marker.light_role_auto_yes/no`); Leading light entity как сейчас по условиям; сегмент [From source \| Set colour \| Colour and brightness] с полем цвета и слайдером яркости по режиму; Glow radius с «?» и подсказкой про общий радиус; при Never блок неактивен и показывается `marker.glow_disabled_never`; прочие сообщения (`glow_disabled_auto`, `glow_disabled_no_entity`, `glow_passive_hint`) остаются callout'ами |
| Icon, Display, Value badge, Display preview, Icon size / rotation | поле иконки с очисткой и Pin; селект с абзацем; рамочная группа; блок превью; два слайдера в строку | карточка Appearance: поле иконки с превью, очисткой и ссылкой Pin в подсказке; Display селектом с подсказкой режима (`marker.display_hint_*`), Activity pulse color / size по режиму; Value source по условиям режимов Value; подраздел Value badge с «?»: тумблер, Value (селект + технический идентификатор), Position сегментом [Above \| Right \| Below \| Left], предупреждения (`value_badge_static`, `_missing`, `_duplicate`) как сейчас; Display preview (`hp-device-preview`) в блоке на тинте; Icon size and rotation двумя слайдерами в ряд с числами |
| Model, Link, Description, Manuals, Additional actions | поля; Attach; раскрывающийся блок | карточка Details: Model и Link в ряд, Description, Manuals чипами + Attach…, подраздел Additional actions (This is a presence radar как строка-действие; секции радара и пылесоса по условиям в том же стиле) |
| Баннеры привязки (`habindingbanner`, Open in HA, `ha_registry_limited`) | над полями | callout'ы в карточке Basics |
| Футер | Hide/Show, Delete, Cancel, Save | Hide и Delete слева, Cancel и Save справа, статус изменений |

### 7.2 Состав и правила

Все ключи `_markerDialog` без изменений: `name`, `bindingMode`, `binding`, `showEntities`, `bindingOpen/bindingFilter`, `room`, `tapAction`, `toggleEntity`, `tapTarget`, `tapConfirm`, `controls`, `useClimateTemp`, `lightRole`, `lightEntity`, `glowMode`, `glowColor`, `glowBrightness`, `glowRadius`, `icon/autoIcon`, `display`, `rippleColor/rippleSize`, `valueSource`, `valueBadgeEnabled/Source/Position`, `size`, `angle`, `model`, `link`, `description`, `pdfs`, `radar*`, `hideFromPlan`. Флаги `*Touched` и `original*` продолжают работать как сейчас. Прототип показывает режим редактирования привязанного светильника; ветки, которых в прототипе нет (Entity to toggle, What to run, Leading light entity, Value source, Include the device temperature in the room, радар, пылесос, баннеры), реализуются теми же примитивами в соответствующих карточках.

## 8. Адаптивность, доступность, i18n

- ≥ 600 px: форма 560 px; ≤ 480 px: на всю ширину и высоту, сетки в одну колонку, плитки 2×2, радио и селекты под подписью. Проверяются 320, 390, 560+, малая высота, 200 % текста, длинные RU/DE/FR строки, светлая и тёмная темы HA.
- Все цели ≥ 44 px (компактные строки 40 px с тумблером 44 в зоне касания); `role="radiogroup"` / `role="group"` с `aria-label` у сегментов и плиток; label связаны с полями.
- i18n en + ru + de + fr в одном коммите. Переиспользуются существующие ключи везде, где текст тот же. Новые ключи (имена условные): заголовки карточек (`space.section_basics/appearance/cards/sun`, `gs.section_display/fills/plan/data`, `room.section_basics/fill/sources/sizes`, `marker.section_basics/tap/light/appearance/details`), подписи сегментов, где они короче текущих (`space.layer_decor`, `space.layer_openings`, `space.card_values`, `room.fill_inherit_toggle`, `marker.binding_virtual_short` и т.п.), статусы футера (`dialog.unsaved`, `dialog.review_fields`, `dialog.discard_*`), подсказки строк из прототипа и новые тексты «?» там, где сейчас был `rhint`. Переименованные тексты существующих ключей: `space.show_lqi` («Zigbee signal next to devices»), `space.show_names` (без «(drag to move)»), `room.area_label` (без «(unassigned)»), `marker.name_label` («Name», пояснение в подсказке). Placeholder'ы `{n}`, `{v}`, `{entity}` сохраняются.

## 9. Модель данных и миграция

Нет. Ни один ключ состояния, конфига или storage не добавляется и не меняется.

## 10. Границы реализации и тесты

- Новые примитивы формы (карточка, сегмент, полная и компактная строка, плитки значений, плитки цвета, поле цвета, чипы, кнопка выбора со списком, футер со статусом) как lit-шаблоны и scoped-стили в одном модуле (`src/settings-form-view.ts` + `src/styles/settings-form.styles.ts`, имена условные), подключаемом из editor runtime; без нового веб-компонента, кроме поля цвета (`hp-color-field` или режим `compact` у `hp-color-opacity`).
- Диалоги: `_renderSpaceDialog`, `_renderSettingsDialog`, `_renderRoomDialog`, `_renderMarkerDialog` в `src/houseplan-editor-runtime.ts`; секция Display в `src/houseplan-onboarding-runtime.ts`; `hp-zigbee-topology-settings`, `room-temperature-controls.ts`, `sun-settings-view.ts` получают новую разметку при той же логике; `src/styles/dialogs.styles.ts` только scoped-блоки; `hp-dialog.ts` только `:host([data-kind=…])` (ширина 560, бейдж в шапке).
- Тесты: unit на маппинг новых контролов к тем же значениям состояния (инверсия слоёв, As the space ↔ '', bgMode null, sunRays null/true/false, opacity %/доля); обновление селекторов в smokes, заходящих в диалоги (`smoke_hide_layers`, `smoke_hide_room_names`, `smoke_font_scales`, `smoke_bg_color`, `smoke_dialog_footer_width`, `smoke_esc_dialogs`, `smoke_help_affordance`, `smoke_plan_picker`, `smoke_color_picker_consumers`, `smoke_general_settings`, `smoke_grid_scale_invariance`, `smoke_danger_confirmation`, `smoke_gear_tabs`, `smoke_binding_ui`, `smoke_binding_picker`, `smoke_climate_temp`, `smoke_card_controls`, room/marker smokes по `grep`); новый фокусный smoke на геометрию карточек, один скролл, футер, сегменты и плитки для каждого диалога.
- Нет новых eager-чанков, внешних запросов и шрифтов; `gate:small`, typecheck, bundle budget, i18n parity, docs gate зелёные.

## 11. Критерии приёмки

| AC | Требуемый результат | Доказательство |
|---|---|---|
| AC1 | Каждый из четырёх диалогов во всех режимах состоит из карточек по §4–7; старые заголовки-подписи, абзацы `rhint`, рамочные группы и образец карточки отсутствуют | smoke DOM-порядок + парное визуальное сравнение с референсом |
| AC2 | Оболочка 560 px (native и реальный HA), один скролл тела, закреплённые шапка и футер, без горизонтальной прокрутки на 320/390/560, 200 % текста, RU/DE/FR, светлая и тёмная темы | smoke геометрии + захваты |
| AC3 | Каждый новый контрол пишет те же значения в те же ключи состояния, что и заменённый (таблицы §4–7 и IMPLEMENTATION-GUIDE.md); сохранённый конфиг до и после правки через новый UI байт-в-байт совпадает при одинаковых действиях | unit на маппинг + smoke сохранения с diff конфига |
| AC4 | Условные блоки (Custom / Temperature детали, Static color, Custom direction, провайдеры Zigbee, Entity to toggle, What to run, Leading light entity, Value source, бейдж, пульс, радар, пылесос, баннеры) появляются по тем же условиям, что сейчас | unit + существующие smokes |
| AC5 | Поле цвета: inline-плашка, системный пикер, hex, число Opacity, Reset; значения `{c,a}` те же; прочие потребители `hp-color-opacity` без изменений | unit на компонент + `smoke_color_picker_consumers` |
| AC6 | Save только при изменениях и без ошибок; статусы Unsaved changes / Review N fields; подтверждение при закрытии с изменениями; без изменений закрытие сразу | `smoke_esc_dialogs` + unit |
| AC7 | Все «?» открывают те же тексты через `hp-help`; ни один текст пояснений не потерян (абзацы переехали в «?») | сверка ключей i18n + smoke `help_affordance` |
| AC8 | Copy, Delete, Hide, Skip, Keep as walls, Export/Import, Optimize, Read ZHA / Update map, Attach, Pin, Open in HA работают как до задачи | существующие smokes |
| AC9 | Цели ≥ 44 px, фокус, aria, reduced motion, forced colors | a11y-проверка в smoke + ревью |
| AC10 | Changelog RU+EN, USER-GUIDE RU+EN, `docs/design/<NN>-settings-dialogs/` с референсом и отчётом сравнения, i18n-паритет, gate:small | docs gate + код-ревью |

Визуальное доказательство: парные захваты референс/продукт для каждого диалога на desktop light и dark, а также native и реальный HA на 390 px; диагностические кадры, не golden-базы.

## 12. Риски, откат, release-артефакты

Риски: ложный паритет (карточки снаружи, старая разметка внутри); регресс условных веток диалога устройства, которых нет в прототипе; потеря `displayTouched` / `*Touched` логики при перестройке разметки; забытый онбординг и create-режимы; неполные переводы de/fr. Откат: revert коммитов задачи и `npm run bundle:sync`, данные совместимы. Release: changelog RU+EN со ссылкой на issue, USER-GUIDE RU+EN (разделы про настройки), `docs/design/<NN>-settings-dialogs/README.md` и `ACCEPTANCE.md`; релиз и тег не делаются, остановка на S8.

## Принятые технические предположения

Принято предположительно, поменять свободно при сохранении продуктового контракта и AC:

- Имена новых ключей i18n, модулей и классов: план, не публичный API.
- Сегменты, плитки и компактные строки реализуются на нативных `input` внутри `label` в lit-шаблонах, без новых веб-компонентов; поле цвета единственное исключение.
- Ширина через `wide` и scoped-переменную оболочки; в реальном HA проверяется на настоящем `ha-dialog` по методике #505.
- Dirty-состояние считается сравнением нормализованного черновика с исходным снимком в памяти runtime; ничего не персистится; для диалога устройства используется существующая семантика `*Touched` / `original*`.
- Hex-код в поле цвета может быть редактируемым текстом с валидацией `#rrggbb` при том же внешнем виде.
- Компас рисуется inline SVG.
