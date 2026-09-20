# Карта полей: прототип → houseplan-card

Сверено с `Matysh/houseplan-card` dev `9683a59` (v1.76.0): `src/space-dialog.ts` (`SpaceDialogState`), `src/houseplan-editor-runtime.ts` (`_renderSpaceDialog`, ~13614), `src/houseplan-onboarding-runtime.ts` (~700), `src/i18n/en.json`, `src/logic.ts` (`SPACE_FILL_UI_MODES`, `DEFAULT_CUSTOM_FILL`), `src/styles/dialogs.styles.ts`.

Ключи состояния совпадают с ключами `draft` в `app.js` прототипа, кроме отмеченных строк.

## Basics

| Прототип (`app.js`) | Контрол в прототипе | `SpaceDialogState` | Текущий i18n | Текущий контрол в продукте | Примечание |
|---|---|---|---|---|---|
| `title` | text, maxlength 80, hint «Shown in the space tabs.» | `title` | `space.title_label`, `space.title_ph` | `input.namein` | Валидация: не пусто |
| `cellCm` | number + «cm / cell», «?» | `cellCm`, `cellCmInput`, `cellCmTouched` | `space.scale_label`, `space.cell_cm.help`, `space.scale_unit(_imperial)` | `#space-cell-cm` + `strictNumber`, `gridCellFieldValue` | Imperial сохраняется; callout о пересчёте при `cellCm !== saved` |
| `source` | choice-cards `draw` / `file` | `source` | `space.source_draw`, `space.source_file` | `input[type=radio][name=plansrc]` + `switchSpacePlanSource` | Тексты карточек новые: «Draw it myself», «Use a floor-plan image» + подписи |
| `planData`, `planName` | drop-зона, Choose file, Browse uploaded, Replace | `planFile`, `planUrl`, `pickSaved`, `saved*` | `btn.upload`, `btn.replace`, `space.pick_saved*`, `space.no_plan` | `_pickPlanFile`, `_toggleServerPlans`, `_renderServerPlans` | Лимит 2 MB только в прототипе |

## Appearance

| Прототип | Контрол | `SpaceDialogState` | Текущий i18n | Текущий контрол | Примечание |
|---|---|---|---|---|---|
| `showBorders` | полная строка + тумблер, «?» | `showBorders` | `space.show_borders` | `_boolInput` + `touchSpaceDisplay` | В create-режиме сохранить `displayTouched` |
| `zeroWallStyle` | сегмент Dashed / Solid с образцами линии | `zeroWallStyle` (`'dashed' \| 'solid'`) | `space.zero_wall_style(.help)`, `space.zero_wall_dashed/solid` | `select#space-zero-wall-style.areasel` | Селект → сегмент |
| `roomColor`, `roomOpacity` | inline-поле цвета: свотч (системный пикер) + hex + Opacity число + Reset | `roomColor`, `roomOpacity` | `space.room_color`, `space.opacity`, `btn.reset` | `hp-color-opacity` (свотч → всплывающая HSB-панель с OK) | Новый пикер, см. ISSUE §5 «Поле цвета»; Reset новый: продуктовые defaults для пространства |
| `fillMode` | сегмент Custom / Zigbee / Lights / Temperature | `fillMode` (`custom \| lqi \| light \| temp`; `none` в UI не показывается, как сейчас) | `space.fill_label`, `space.fill_mode.help`, `fill.custom/lqi/light/temp` | radio `name=fillmode` | Радио-список → сегмент. Подписи сегментов: короткие «Custom», «Zigbee», «Lights», «Temperature» |
| `fillColor`, `fillOpacity`, `customFillSet` | Fill color + opacity + Reset | `customFill` (`{c,a} \| null`) | `space.custom_fill`, `btn.reset` | `hp-color-opacity` + Reset → `null` | Новое inline-поле цвета вместо всплывающей панели; в прототипе opacity 0–100, в продукте `a` 0–1 |
| `tempMin`, `tempMax` | Comfort range Minimum / Maximum °C, легенда Cold / Comfort / Hot | `tempMin`, `tempMax` | нет текстов «Minimum/Maximum/Comfort range» | два `input.tempin` через `strictNumber` | Новые ключи + ошибка «maximum must be higher» |
| `hideDecor` (инверсия) | компактная строка «Decorative layer» | `hideDecor` | `space.hide_decor`, `space.hide_decor_tip` | `_boolInput(d.hideDecor)` | UI-инверсия; tip уходит в «?» группы Visible layers |
| `hideOpenings` (инверсия) | компактная строка «Doors, windows & gates» | `hideOpenings` | `space.hide_openings`, `space.hide_openings_tip` | `_boolInput(d.hideOpenings)` | То же |
| `showLqi` | компактная строка «Zigbee signal next to devices» | `showLqi` | `space.show_lqi` | `_boolInput(d.showLqi)` | Текст ключа меняется; иконка Zigbee из `assets/zigbee-glyph.svg` |

## Room cards

| Прототип | Контрол | `SpaceDialogState` | Текущий i18n | Текущий контрол | Примечание |
|---|---|---|---|---|---|
| `showNames` | полная строка + тумблер, «?» | `showNames` | `space.show_names` | `_boolInput` + `touchSpaceDisplay` | Текст без «(drag to move)»; drag описывается в «?» |
| `labelTemp` | плитка Temperature | `labelTemp` | `space.label_temp` | `_boolInput` | disabled при `!showNames` |
| `labelHum` | плитка Humidity | `labelHum` | `space.label_hum` | `_boolInput` | |
| `labelLqi` | плитка «Zigbee signal» (title «Average Zigbee signal») | `labelLqi` | `space.label_lqi` | `_boolInput` | Короткая подпись новая, полное имя в aria/title |
| `labelLight` | плитка Lights on / off | `labelLight` | `space.label_light` | `_boolInput` | |
| `cardFontScale` (проценты 50–300) | слайдер + число + «Reset to 100%» | `cardFontScale` (доля 0.5–3) | `space.card_font` | `_rangeInput(50,300,5, …*100)` + `.opv` | Числовое поле новое; `_renderCardPreview` убирается |

## Sun & light

| Прототип | Контрол | `SpaceDialogState` | Текущий i18n | Текущий контрол | Примечание |
|---|---|---|---|---|---|
| `bgMode` (`inherit \| static \| daynight`) | сегмент General settings / Static color / Follows the Sun | `bgMode` (`null \| 'static' \| 'daynight'`) | `space.bg_mode(.help)`, `space.sun_inherit`, `gs.bg_static`, `gs.bg_daynight` | `select#space-bg-mode` | `inherit` ↔ `null` |
| `bgColor`, `bgColorSet` | Background color + Reset (только при static) | `bgColor` (`string \| null`) | `space.bg_color`, `space.bg_inherit`, `space.bg_inherited` | `hp-color-opacity` без opacity + кнопка Inherit | Новое inline-поле цвета без Opacity; кнопка «Inherit general» → Reset; надпись «inherits general settings» убирается |
| `sunRays` (`inherit \| on \| off`) | подпись + 3 радио в строку | `sunRays` (`null \| true \| false`) | `space.sun_rays`, `space.sun_inherit`, `space.sun_on`, `space.sun_off` | `select.areasel` | Селект → радио; текст inherit «Use general settings» |
| `northDeg` (`null \| 0–359`) | селект Use general settings · N° / Custom direction + компас; поле North direction при Custom | `northDeg` | `space.north(.help)`, `space.north_inherited` | `input#space-north` number с placeholder | Наследуемый угол из `northDegOf(settings, {})`; целое 0–359 |
| `glowEnabled` | полная строка + тумблер, «?» | `glowEnabled` | `space.glow_enabled` | `_boolInput` | «?»: свечение и солнце независимы |

## Футер и общее

| Прототип | Продукт | Примечание |
|---|---|---|
| Copy (слева) | `openSpaceCopyDialog` (edit) | Без изменений |
| Delete danger-outline + подтверждение | `_deleteSpace`, `deleteBlockers` | Без изменений логики |
| Cancel / Save primary, Save disabled без изменений и при ошибках | `btn ghost` / `btn on`, disabled только по title/plan/busy | Новое: dirty-состояние |
| «Unsaved changes» / «Review N fields» | нет | Новое |
| Keep editing / Discard changes при закрытии с изменениями | нет (`hp-close` закрывает сразу) | Новое, через `hp-confirm` |
| Бейдж имени пространства в шапке | нет | Новое, в слот заголовка hp-dialog |
| Skip при импорте (create) | `_skipImport` | Без изменений |

## Пояснения «?» (hp-help) (`helpCopy` в `app.js`)

| Ключ прототипа | Где | Существующий ключ продукта |
|---|---|---|
| `scale` | Grid cell size | `space.cell_cm.help` |
| `floorPlan` | Floor plan | новый |
| `borders` | Always show room borders | новый |
| `walls` | Zero-thickness walls | `space.zero_wall_style.help` |
| `fill` | Room fill | `space.fill_mode.help` |
| `layers` | Visible layers | новый (заменяет `space.hide_decor_tip` и `space.hide_openings_tip`) |
| `names` | Show room names | новый |
| `cardSize` | Room-card font size | новый |
| `north` | North on the plan | `space.north.help` |
| `light` | Light-source glow | новый |

## Поле цвета: было и стало

| | Сейчас (`hp-color-opacity`) | Новое (прототип `colorField`) |
|---|---|---|
| Внешний вид в форме | подпись + маленький свотч | плашка: свотч 38 (рамка) + hex + «Opacity» число % + Reset |
| Выбор цвета | собственная всплывающая панель: поле HSB, слайдеры Hue / Saturation / Brightness, hex-поле, слайдер и число Opacity, кнопка OK | системный пикер браузера по клику на свотч (`input[type=color]`), без OK, применяется сразу в черновик |
| Прозрачность | слайдер + число в панели | число в строке |
| Сброс | кнопка Reset / Inherit general рядом (не везде) | ссылка Reset в плашке у всех трёх полей |
| Область применения | все диалоги | только диалог Space в этой задаче |

## Что в прототипе есть, а в продукт не переносится

- `demo-shell.js`, галерея «Form previews», переключатель Form, выбор Sample space.
- `localStorage` (`houseplan-space-settings-design-v1`), демонстрационные пространства Ground Floor / First Floor и 50 устройств.
- `room-fill.js` и `room-fill.test.mjs`: только доказательство сверки семантики заливок с `src/logic.ts`.
- Лимит загрузки 2 MB и `readFile` в base64: продуктовый жизненный цикл файлов HA остаётся.
- Демонстрационные наследуемые значения 165° и «enabled».
