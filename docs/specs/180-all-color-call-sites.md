# #180 — Единый picker во всех местах выбора цвета

Статус: готово к ревью ТЗ  
Issue: [#180](https://github.com/Matysh/houseplan-card/issues/180)  
Связано: [#57](https://github.com/Matysh/houseplan-card/issues/57)

## 1. Сценарий пользователя

Администратор настраивает цвета плана в общих настройках, свойствах пространства
или диалоге устройства. В любом из этих мест он нажимает образец и получает один
и тот же House Plan picker, уже знакомый по decor, custom fill и Glow.

## 2. Что человек увидит до и после

**До:** часть цветов открывается единым picker из #57, а оставшиеся поля вызывают
системный color dialog; там, где есть прозрачность, она по-прежнему вынесена в
отдельный slider рядом.

**После:** каждый образец цвета открывает одну и ту же поверхность House Plan.
Если значение уже имеет прозрачность, цвет и opacity находятся внутри неё; если
поле color-only, строка opacity отсутствует.

## 3. Проблема

#57 заменила вложенный native picker внутри `hp-color-opacity`, но не перевела
параллельные native call sites. В результате одинаковое действие зависит от
конкретного диалога, а общий компонент не является настоящей единственной точкой
выбора цвета.

На текущем `dev` осталось пять source-шаблонов `<input type="color">`, которые
представляют 15 пользовательских полей. Такое расхождение усложняет touch,
keyboard, темы, локализацию и дальнейшее сопровождение.

## 4. Инвентаризация и scope

В задачу входят все оставшиеся native call sites:

| Поверхность | Поля | Новый режим |
|---|---:|---|
| Общие настройки, `_renderColorRow()` | 11: light on/off/none; temp cold/ok/hot; LQI low/high; Glow base/light; wall fill | color + existing opacity |
| Общие настройки → статичный фон | 1 | color-only + прежний Default/theme |
| Устройство → activity/ripple color | 1 | color-only |
| Пространство → цвет комнат | 1 | color + existing room opacity |
| Пространство → статичный фон | 1 | color-only + прежний Inherit |

Дополнительно входят:

- переиспользование существующего `hp-color-opacity` API и labels #57;
- сохранение live draft, Save/Cancel, default/inherit и nullable semantics;
- запрет native `input[type=color]` во всём продуктовом TypeScript;
- keyboard/touch/theme/accessibility regression coverage;
- smoke и golden для затронутых dialog families;
- актуализация пользовательской и тестовой документации.

## 5. Не в scope

- redesign самого picker, HSV/RGB panels, presets, history или eyedropper;
- новое значение opacity для color-only полей;
- изменение палитр, default-цветов либо визуальных правил light/temp/LQI/Glow;
- изменение marker ripple animation, размера либо alarm semantics;
- изменение day/night background, наследования space или room fill algorithms;
- новый формат конфига, backend schema либо migration;
- массовая перестройка layout диалогов вне необходимой замены controls;
- полная touch parity родительских редакторов.

## 6. Общий interaction contract

Каждый из 15 controls использует существующий `hp-color-opacity`:

- click/tap/Enter/Space по swatch открывает единственную picker surface;
- внутри нет native `input[type=color]` и второго системного dialog;
- изменения сразу обновляют только draft текущего родительского диалога;
- Save сохраняет draft прежним путём, Cancel/close его отбрасывает;
- Escape сначала закрывает picker и возвращает focus на trigger, второй Escape
  принадлежит родительскому dialog;
- открытие другого transient overlay либо picker закрывает предыдущий;
- одновременно в одном dialog видима не более чем одна picker surface;
- disabled/busy parent не получает обходного write через picker.

Все interaction, floating surface, focus, viewport и pointer semantics остаются
контрактом #57. #180 добавляет consumers, а не второй вариант компонента.

## 7. Контракт значений

### 7.1 Поля с opacity

`_renderColorRow()` и room color передают текущую пару `{color, opacity}` в
`hp-color-opacity` с `showOpacity=true`. Событие
`hp-color-opacity-change: {color, opacity}` атомарно обновляет оба draft-поля.

Существующие отдельные alpha slider и процент рядом удаляются: opacity доступна
внутри picker при первом открытии. Значение `[0,1]`, шаг/округление и сохранение
остаются контрактом #57; открытие/закрытие без изменения ничего не округляет.

### 7.2 Color-only поля

Общий фон, space background и ripple используют `showOpacity=false`. Они не
получают alpha в UI, config или event handling; передаваемая техническая opacity
не сохраняется.

### 7.3 Default и inheritance

Nullable background сохраняет прежнюю модель:

- общий `bgColor=null` показывает эффективный theme/stage color и прежний текст
  `Theme`; выбор цвета создаёт explicit draft;
- кнопка `Default` снова ставит `null`;
- space `bgColor=null` показывает эффективный inherited/global color и прежний
  текст `Inherited`; выбор создаёт explicit draft;
- кнопка `Inherit` снова ставит `null`.

Picker не получает собственную reset/inherit команду. Действующие кнопки рядом
с ним сохраняются и закрывают открытую surface через обычный parent update.

Пустой `rippleColor` означает действующий accent/default. Открытие picker без
изменения не материализует fallback; первое валидное изменение создаёт explicit
hex draft. Сброс ripple color в #180 не добавляется, потому что его не было в
текущем UI и владелец запросил унификацию picker, а не новый default-action.

## 8. Layout, theme и accessibility

- На каждой строке пользовательское название отображается ровно один раз; можно
  убрать внешний label либо внутренний label component, но trigger получает
  непустой локализованный accessible name.
- У 11 строк общих настроек не остаётся пустого места от удалённого alpha slider;
  swatch выравнивается с labels и соседними controls без горизонтального overflow.
- Смешанная marker-строка сохраняет ripple-size slider и его значение; picker
  trigger не уменьшает touch target и не перекрывает соседний control.
- Общий/space default-inherit button остаётся keyboard-доступным и не попадает
  внутрь floating surface.
- Light/dark theme, forced colors, 390 CSS px и 200% zoom используют уже
  проверенный visual contract #57.
- Picker остаётся локализован через `.pickerLabels=${this._colorPickerLabels}` и
  `.opacityLabel`; hardcoded English в новых call sites запрещён.

## 9. Модель данных и совместимость

Новых полей нет. Без изменений сохраняются:

- `FillColors[key] = { c: #RRGGBB, a: number }`;
- global `settings.bg_color?: #RRGGBB`;
- `marker.ripple_color?: #RRGGBB`;
- `space.settings.room_color` и `room_opacity`;
- `space.settings.bg_color?: #RRGGBB`.

Backend, export/import, config compatibility registry и migration не меняются.
Старые значения открываются и сохраняются в прежнем формате. `safeStoredColor`
и normalizer #57 остаются единственной границей допустимого hex; #180 не вводит
новый parser.

## 10. i18n

Новых ключей не требуется. Переиспользуются существующие:

- `color_picker.*` и `space.opacity` для общей picker surface;
- текущие labels `gs.*`, `marker.activity_color`, `space.room_color` и
  `space.bg_color` для конкретного trigger;
- текущие Default/Theme/Inherit/Inherited strings.

EN/RU parity scanner должен остаться зелёным.

## 11. Touch

**Touch editor: supported для самого picker;** родительские редакторы остаются
best effort / intentionally degraded по `docs/TOUCH-SUPPORT.md`.

Tap по любому новому trigger открывает ту же surface #57; pointer capture,
multi-touch, `pointercancel`, viewport rotation и outside tap не создают
дополнительного parent write. Родительский Save/Cancel остаётся safety boundary.

## 12. Критерии приёмки

### AC1 — полное source-покрытие

Все 15 полей из §4 используют `hp-color-opacity`; в `src/**/*.ts` отсутствует
`input[type=color]` в любой допустимой Lit-форме. Уже мигрированные consumers #57
продолжают использовать тот же component.

**Доказательство:** source-contract unit со scan всего `src/**/*.ts`, точным
перечнем пяти новых template instances и regression count/allowlist всех
component call sites.

### AC2 — opacity перенесена внутрь единой surface

Каждая из 11 FillColors и room color открывает picker с текущим color/opacity;
изменение любого из них обновляет правильный draft. Отдельные alpha slider и
процент этих строк отсутствуют, но сохранённое значение совпадает с picker.

**Доказательство:** unit/source contracts + browser smoke общего dialog и space
dialog, включая две разные FillColors keys и room opacity 0/37/100%.

### AC3 — color-only не получает alpha

Ripple, global background и space background скрывают opacity row, меняют только
hex color и не добавляют alpha в config/event projection.

**Доказательство:** DOM smoke `showOpacity=false`, save round-trip и negative
schema/source assertions.

### AC4 — nullable/default/inherit остаются прежними

При `bgColor=null` trigger показывает effective color, но одно открытие/закрытие
не материализует его. Первое изменение создаёт explicit value; Default/Inherit
возвращает `null`. Parent Cancel не сохраняет ни один draft.

**Доказательство:** browser smoke global + space dialog с config snapshot до/
после open, change, reset и Cancel/Save.

### AC5 — ripple и соседний size control независимы

Ripple picker меняет только `rippleColor`; ripple size slider остаётся видимым,
keyboard/touch-доступным и сохраняет прежнее значение. Пустой fallback не
материализуется без изменения.

**Доказательство:** marker-dialog browser smoke и config projection unit.

### AC6 — один overlay, keyboard и touch

В dialog с 11 swatches открытие второго picker закрывает первый; Escape/focus,
outside tap, pointercancel, 390px/200% zoom и fallback portal соответствуют #57.
Ни один trigger не вызывает системный picker.

**Доказательство:** расширенный `smoke_color_picker.mjs`, включая general
settings multi-picker и representative mobile marker/space cases.

### AC7 — visual/theme contract

Общие настройки, marker activity и space appearance не имеют layout overflow
или двойных labels в light/dark themes; default/inherit и ripple-size controls
остаются читаемыми.

**Доказательство:** reviewed Linux golden минимум для general settings desktop,
marker activity mobile и space appearance в противоположных темах.

### AC8 — совместимость и производительность

Persisted schema/values не меняются; новых dependencies/fetch нет. Открытие
general settings с 11 component instances не создаёт long task и закрытый dialog
не оставляет document listeners/overlays.

**Доказательство:** round-trip units, dependency diff, целевой smoke после
close/reopen; existing performance smoke без нового regression threshold.

## 13. План автотестов

### Unit/source

1. Рекурсивный scan `src/**/*.ts` запрещает native `input[type=color]`.
2. Все новые `hp-color-opacity` передают localized `pickerLabels`.
3. Matrix фиксирует `showOpacity=true` только для FillColors/roomColor и `false`
   для ripple/global-bg/space-bg.
4. Event handlers обновляют только ожидаемые draft keys и сохраняют alpha.
5. Nullable effective color не материализуется без change event.
6. Existing `color-picker.test.mjs` conversions/API остаются зелёными.

### Browser smoke

Расширить `demo/smoke_color_picker.mjs` либо добавить узкий companion, который
проверяет:

- две строки general FillColors, alpha внутри picker и переключение overlays;
- global background effective/default lifecycle;
- marker ripple color-only + неизменный size;
- space room color+opacity;
- space background inherited/explicit/inherit;
- Save/Cancel snapshots, keyboard/Escape, touch/pointercancel;
- native/fallback floating surface и отсутствие системного input.

### Golden

- general settings с открытым picker, desktop light;
- marker activity picker, mobile dark;
- space appearance с room/background controls, desktop dark либо mobile light;
- все расхождения принимаются только по полному reviewed Linux artifact перед
  бетой; существующие baselines #57 не обновляются автоматически.

### Реализационные гейты

В цикле: `npm run typecheck`, `npm test`, `npm run build`.

Перед `S7-code-review`: затронутый color-picker smoke и целевые golden capture/
verify. Полные golden, smoke и performance остаются pre-beta gate. Backend tests
не нужны, если diff действительно не затронет Python/schema.

## 14. Риски и меры

| Риск | Мера |
|---|---|
| Alpha теряется при замене двух controls одним | атомарный `{color, opacity}` handler + boundary tests |
| Inherited fallback случайно сохраняется explicit | отсутствие change при open/close + snapshot smoke |
| 11 pickers открываются одновременно | общий exclusive overlay controller #57 |
| Label дублируется или trigger остаётся без имени | ровно один visible label + accessible-name assertion |
| Marker row ломается из-за более крупного trigger | mobile golden + независимый size smoke |
| Native picker возвращается новым call site | recursive source scan, не count одного файла |
| Много component listeners остаётся после dialog | disconnect/reopen smoke и existing cleanup contract |

Производительность: одновременно существует максимум содержимое открытого
родительского dialog; floating surface создаётся только у активного picker.
Новых observers, subscriptions, animation loops и network requests нет.

## 15. Откат

Откат возвращает пять native templates и отдельные alpha slider. Поскольку
модель данных и API сохранения не меняются, migration/downgrade действий нет.
Сам picker #57 и уже существующие consumers остаются работоспособными.

## 16. Release-артефакты

User-visible implementation commit одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #180;
- `docs/USER-GUIDE.ru.md` — единый picker во всех общих, space и marker color
  settings, включая opacity/default/inherit;
- `docs/TESTING.md` — source invariant, smoke matrix и golden scenarios;
- синхронные `dist`, integration frontend и demo bundle.

Перед бетой нужны reviewed golden artifacts для трёх новых dialog families и
зелёный targeted smoke. Новых screenshots вне golden, security artifact,
backend artifact или отдельный performance profile не требуется.

## 17. Принятые технические предположения

1. Пять новых source instances `hp-color-opacity` — один в
   `_renderColorRow()` и четыре прямых — являются предпочтительной структурой;
   helper можно выделить, если source-invariant и AC сохраняются.
2. `opacity=1` у color-only consumer является presentation input и не должен
   попадать в parent draft/config.
3. Layout-классы можно уточнить локально; публичными считаются поведение,
   accessible names и отсутствие overflow, а не DOM nesting.
4. Existing `hp-color-opacity` не расширяется reset callback: default/inherit
   остаются parent-owned actions.
5. Точные golden scenario names и pixel thresholds выбираются по Linux artifact,
   но обязаны отдельно доказать general settings, marker и space surfaces.
