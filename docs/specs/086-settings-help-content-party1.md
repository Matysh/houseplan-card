# Issue #86 — подсказки к настройкам, партия 1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/86
- **Статус документа:** актуализировано 2026-08-30 по `origin/dev`; кандидат на ревью ТЗ
- **Приоритет:** P2
- **Тип:** polish/docs/tech-debt, полный трек: нарушен критерий light-track
  «одна поверхность» — затронуты общие настройки, пространство, маркер и каталог
  устройств
- **Пользовательское изменение:** да
- **Зависимость:** механизм `hp-help` из #68 уже выпущен

## 1. Сценарий

Администратор настраивает план в общих настройках, диалоге пространства,
устройстве или Plan/Device editor и встречает параметр, ошибка в котором заметно
исказит геометрию, свет либо видимость объектов. Он открывает короткую подсказку
рядом с названием, не покидая текущий dialog/tool.

## 2. Что человек увидит до и после

До изменения критичные параметры объясняются неодинаковыми `title`/`.rhint` либо
не объясняются; после изменения первая партия получает единый `hp-help` с коротким
ответом «что изменится», а старое дублирующее объяснение исчезает.

## 3. Проблема и граница партии

#68 поставил presentation/lifecycle/a11y-механизм и пилотные подсказки. #86
поставляет контент. Решение владельца: в этом issue реализуется **только партия
1** — настройки, ошибка в которых может повредить или заметно исказить план.

Партии 2 и 3 из тела issue не входят сюда и до реализации оформляются отдельными
issue после проверки механики и текстов первой партии.

## 4. Scope партии 1

Обязательные settings/affordances:

1. масштаб пространства (`cell_cm`);
2. общий радиус Glow; существующий персональный радиус устройства только
   проверяется на отсутствие дублирования;
3. режим заливки пространства в его актуальной post-#56 модели;
4. роль источника света Auto/Always/Never — существующий пилот уточняется;
5. «Управляет другими источниками света»;
6. общий и локальный север;
7. общий и локальный режим фона;
8. стиль стен нулевой толщины — актуальная замена удалённых виртуальных границ;
9. «Показывать скрытые на плане» в каталоге редактора устройств.

Каждая новая подсказка использует существующую `_help('literal.help')`, пару
`.help` + `.help.aria`, floating/overlay lifecycle и accessibility contract #68.

## 5. Не входит в задачу

- партия 2: проёмы, толщины, колонны/перегородки, decor, размеры room labels;
- партия 3: binding/display/size/tap action/hide/climate/vacuum source;
- rich text, Markdown, картинки и ссылки в tooltip;
- новый help component, второй floating controller либо иной icon;
- массовая миграция всех оставшихся `title=`;
- изменение поведения самих настроек;
- редакторский onboarding tour или постоянно открытая справка.

## 6. Канонический смысл RU/EN

Тексты ниже являются acceptance contract. Допустима только редакторская правка,
не меняющая смысл, длину более двух предложений или терминологию User Guide.

| Ключ | RU `.help` | EN `.help` |
| --- | --- | --- |
| `space.cell_cm.help` | Связывает сетку с реальными размерами: от значения зависят длины и площади, толщина стен, размеры проёмов и радиус свечения. Изменение после разметки меняет расчётные размеры всего пространства, но не двигает его точки на плане. | Links the grid to real dimensions: lengths, areas, wall thickness, opening sizes and glow radius depend on it. Changing it after drawing changes the calculated dimensions of the whole space without moving its points on the plan. |
| `gs.glow_radius.help` | Задаёт общий радиус светового пятна в метрах или футах; персональный радиус устройства заменяет это значение. | Sets the default glow radius in metres or feet; a device-specific radius overrides it. |
| `space.fill_mode.help` | «Свой цвет» задаёт оформление, а «Свет», «Температура» и «LQI» используют текущие данные Home Assistant; Glow включается отдельно. | “Custom colour” is styling, while “Light”, “Temperature” and “LQI” use current Home Assistant data; Glow is enabled separately. |
| `marker.light_role.help` | «Авто» использует фактическую роль привязанного устройства, «Всегда» принудительно создаёт собственный источник, а «Никогда» исключает его; связанные лампы выше остаются независимыми. | “Auto” uses the bound device's resolved role, “Always” forces its own source and “Never” excludes it; linked lights above remain independent. |
| `marker.controls.help` | При действии «Переключить состояние» перечисленные источники переключаются вместе с этим маркером. Их световые пятна остаются у собственных маркеров, а эта связь сама по себе не делает управляющий маркер источником света. | With the “Toggle state” action, the listed sources toggle together with this marker. Their glow stays at their own markers, and the link alone does not turn the controlling marker into a light source. |
| `gs.north.help` | Угол отсчитывается по часовой стрелке от верхней вертикали плана; север нужен для оконных лучей, а не для фона «Следует за Солнцем». | The angle is measured clockwise from the plan's upward vertical; north is required for window rays, not for the “Follows the Sun” background. |
| `space.north.help` | Переопределяет общий север для этого пространства; угол отсчитывается по часовой стрелке от верхней вертикали плана и используется оконными лучами. | Overrides general north for this space; the angle is measured clockwise from the plan's upward vertical and is used by window rays. |
| `gs.bg_mode.help` | «Следует за Солнцем» использует `sun.sun`, а при недоступности — локальные часы браузера; статичный режим всегда показывает выбранный цвет. | “Follows the Sun” uses `sun.sun`, falling back to the browser's local clock; Static always shows the selected colour. |
| `space.bg_mode.help` | Выберите наследование общего фона либо переопределите это пространство статичным цветом или режимом «Следует за Солнцем». | Inherit the general background or override this space with a static colour or “Follows the Sun”. |
| `space.zero_wall_style.help` | Пунктирные стены нулевой толщины пропускают Glow и солнечные лучи, сплошные блокируют их как барьер нулевой площади. Выбор меняет все такие стены пространства, даже когда их линии скрыты в просмотре. | Dashed zero-thickness walls pass Glow and sun rays, while solid ones block them as zero-area barriers. The choice affects every such wall in the space even when its line is hidden in View. |
| `device_inbox.show_hidden.help` | Временно показывает на плане скрытые и деактивированные маркеры служебными призраками только в редакторе устройств. Сохранённая видимость устройств не меняется. | Temporarily shows hidden and disabled markers as editor-only ghosts on the plan. Saved device visibility does not change. |

Для каждого ключа добавляется цельная локализованная `.help.aria`, называющая
настройку, а не повторяющая весь tooltip. Таблица фиксирует смысл RU/EN; DE/FR
передают тот же смысл естественным языком и проходят тот же parity-контракт.

## 7. Уже поставленные пилоты #68

`marker.glow_radius.help` и `marker.light_role.help` уже существуют. В этой задаче:

- device radius не получает второй trigger; проверяется его единица и inheritance;
- текст light role заменяется каноническим из §6, потому что он обязан объяснять
  динамический Auto/Always/Never contract;
- их `.aria` keys сохраняют текущие имена и остаются непустыми во всех четырёх
  локалях;
- smoke #68 продолжает проходить без второго tooltip на том же control.

## 8. Размещение triggers

- Dialog field: trigger стоит рядом с label/legend, но не внутри `<label>`.
- Disabled fieldset: trigger находится в первом `<legend>` либо вне fieldset.
- Zero-wall style: trigger находится рядом с label селектора в диалоге
  пространства; прежний постоянный `space.zero_wall_help` удаляется.
- Show-hidden: trigger — сосед checkbox label в фильтрах каталога устройств; он
  не вложен в `<label>` и не переключает checkbox при открытии подсказки.
- General/space north and background получают отдельные keys, потому что
  inheritance/override semantics различаются.

Help-trigger не должен менять ширину canvas, stage zoom или доступность основного
action. При 200% zoom label и trigger могут переноситься вместе.

## 9. Удаление старых подсказок

После добавления `hp-help` на том же control удаляются:

- `marker.controls_hint` и соответствующий `.rhint`;
- `gs.bg_daynight_hint` как постоянный `.rhint`;
- `gs.north_hint` как постоянный `.rhint`;
- `space.zero_wall_help` и соответствующий `.rhint`;
- любой legacy `title` у «Показывать скрытые на плане», если он появится в
  результате ребейза до реализации.

Динамические status notes не мигрируют: например `gs.sun_missing`, причина
disabled Glow и текущий inherited north остаются видимыми, потому что описывают
состояние конкретной конфигурации, а не назначение option.

Source contract запрещает одному host/control одновременно иметь `title=` или
объясняющий `.rhint` и `_help()` с тем же смыслом.

## 10. UX и lifecycle

Все правила #68 обязательны без расширений:

- hover только для настоящей мыши, focus-visible для keyboard, click toggle для
  mouse/touch/Enter/Space;
- exclusive transient surface внутри одного dialog/card;
- Escape закрывает tooltip раньше dialog;
- outside click, scroll собственного dialog, toast, mode/disconnect закрывают;
- Popover API и portal fallback не обрезаются;
- tooltip текстовый, `role=tooltip`, focus не принимает;
- пустая одна из пары строк означает отсутствие trigger, а parity test падает.

## 11. Модель данных и migration

Config, backend, layout и storage не меняются. Значения, defaults, inheritance и
save paths всех настроек остаются прежними. Миграции и compatibility fields нет.

Единственное product change — доступность объяснений и удаление дублирующего
постоянного текста/title.

## 12. i18n

- все keys §6 и `.aria` добавляются/обновляются одновременно в `en.json`,
  `ru.json`, `de.json` и `fr.json`;
- `_help()` вызывается только строковым литералом;
- отсутствующая/пустая строка в любой локали валит parity/source test;
- термины совпадают с `docs/USER-GUIDE.ru.md`: «Общие настройки»,
  «Пространство», «Стены нулевой толщины», «Показывать скрытые на плане», Glow;
- backticks в таблице спецификации не означают rich formatting в tooltip:
  UI получает plain text.

## 13. Acceptance criteria

1. **AC1 — полный Party 1 inventory.** Все 11 placements §6 имеют один
   работоспособный `hp-help`; два pilot placement не дублируются.
   **Доказательство:** source inventory unit + code review.
2. **AC2 — канонический content.** RU/EN передают смысл таблицы §6, максимум два
   предложения и отвечают «что изменится»; DE/FR передают тот же смысл без
   пропусков. **Доказательство:** exact RU/EN i18n unit + review четырёх локалей.
3. **AC3 — parity.** Для каждого literal `.help` есть непустые `.help` и `.aria`
   во всех четырёх локалях. **Доказательство:** i18n parity test.
4. **AC4 — no duplicates.** На migrated control нет параллельного `title=` или
   объясняющего `.rhint`; dynamic status notes сохранены. **Доказательство:**
   source scanner + DOM smoke.
5. **AC5 — all surfaces.** General, space, marker dialog и Device catalog
   открывают/закрывают help без изменения настройки или запуска основного action.
   **Доказательство:** targeted browser smoke.
6. **AC6 — input/a11y.** Mouse, touch и keyboard работают по #68; disabled state,
   Escape, focus trap и `.aria` корректны. **Доказательство:** accessibility smoke.
7. **AC7 — layout.** Узкий viewport 390 px и browser zoom 200% не обрезают
   tooltip/trigger и не меняют stage geometry. **Доказательство:** smoke +
   representative reviewed golden.
8. **AC8 — no behavior/model change.** Save/result каждой настройки и config
   serialization идентичны до/после. **Доказательство:** existing units + code review.
9. **AC9 — parties 2/3 absent.** В diff нет новых help placements вне §6, кроме
   необходимых shared tests/docs. **Доказательство:** diff review.

## 14. План автотестов

### Unit/source contract

- exact Party 1 key set and no computed `_help()` keys;
- pair/parity/non-empty checks en+ru+de+fr;
- no duplicate `title`/`.rhint` at migrated hosts;
- existing #68 overlay/controller tests unchanged;
- config serialization snapshots unchanged.

### Browser smoke

- по одному placement на general, space, marker и Device catalog;
- mouse hover, keyboard focus/Enter/Escape и touch toggle/outside close;
- open help does not change setting/show-hidden action;
- disabled group, native Popover and forced fallback;
- карточки с RU/EN и source parity для DE/FR;
- dynamic sun/Glow status note remains next to help.

### Golden

- general settings and space dialog with help open;
- space zero-wall style and Device show-hidden at desktop/narrow widths;
- light/dark and 200% zoom; full Linux artifact review required.

### Mutant

Remove one Party 1 key or re-add an old `title=`. The parity/inventory scanner
must fail; без этого source contract не доказан.

## 15. Затронутые поверхности

- relevant templates in `src/houseplan-editor-runtime.ts`;
- `src/i18n/en.json`, `src/i18n/ru.json`, `src/i18n/de.json`, `src/i18n/fr.json`;
- existing #68 i18n/source tests and targeted browser/golden fixtures;
- `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`.

Механизм `hp-help`, floating controller и `hp-dialog` не меняются, кроме
доказанного минимального исправления, без которого конкретный placement #86 не
может выполнить уже принятый #68 contract.

## 16. Риски и откат

| Риск | Мера |
| --- | --- |
| Подсказка повторяет label | exact content contract §6 |
| Старый hint остаётся рядом | source scanner no-duplicate |
| Trigger запускает основной action | sibling placement + browser smoke |
| Контент расходится между локалями | four-locale pair/parity test + review |
| Scope незаметно растёт до всех настроек | exact Party 1 inventory |

Откат возвращает старые `title`/`.rhint` и удаляет новые keys/placements одним
изменением. Model/data rollback не требуется.

## 17. Release-артефакты

Implementation commit имеет `User-Visible: yes` и одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/USER-GUIDE.ru.md` — Party 1 help affordances и актуальные screenshots;
- `docs/TESTING.md` — inventory/parity/input coverage.

Нужны reviewed screenshots/golden по §14 и targeted smoke report. Партии 2/3
получают отдельные issue, но не создаются автоматически в рамках этого ТЗ без
начала их фактической работы.

## 18. Принятые технические предположения

- help component/API и floating lifecycle #68 переиспользуются без fork;
- существующие device-radius и light-role pilots входят в inventory как audit;
- актуальная space fill модель — `custom/lqi/light/temp`; legacy `none` не
  возвращается в UI;
- отдельной сущности/инструмента виртуальной границы больше нет; её место в
  Party 1 занимает уже выпущенная настройка вида и световой семантики стен
  нулевой толщины (#306);
- «Показывать скрытые на плане» — session-only filter каталога устройств, а не
  сохраняемая общая настройка;
- dynamic status notes не считаются дублирующей документацией;
- точное DOM placement может меняться без изменения adjacency/action ownership.
