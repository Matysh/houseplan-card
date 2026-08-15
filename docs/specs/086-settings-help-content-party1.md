# Issue #86 — подсказки к настройкам, партия 1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/86
- **Статус документа:** готово к будущей реализации; issue остаётся на `S3-spec`
- **Приоритет:** P2
- **Тип:** polish/docs/tech-debt, обычный трек
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
2. общий радиус Glow; существующий персональный радиус устройства проверяется;
3. режим заливки пространства в его актуальной post-#56 модели;
4. роль источника света Auto/Always/Never — существующий пилот уточняется;
5. «Управляет другими источниками света»;
6. общий и локальный север;
7. общий и локальный режим фона;
8. инструмент «Граница»/виртуальная граница;
9. «Показать все устройства» в Device editor.

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

## 6. Канонические тексты RU/EN

Тексты ниже являются acceptance contract. Допустима только редакторская правка,
не меняющая смысл, длину более двух предложений или терминологию User Guide.

| Ключ | RU `.help` | EN `.help` |
| --- | --- | --- |
| `space.cell_cm.help` | Связывает сетку с реальными размерами: от значения зависят длины и площади, толщина стен, размеры проёмов и радиус свечения; изменение после разметки меняет масштаб всего пространства. | Links the grid to real dimensions: lengths, areas, wall thickness, opening sizes and glow radius depend on it; changing it after drawing rescales the whole space. |
| `gs.glow_radius.help` | Задаёт общий радиус светового пятна в метрах или футах; персональный радиус устройства заменяет это значение. | Sets the default glow radius in metres or feet; a device-specific radius overrides it. |
| `space.fill_mode.help` | «Свой цвет» задаёт оформление, а «Свет», «Температура» и «LQI» используют текущие данные Home Assistant; Glow включается отдельно. | “Custom colour” is styling, while “Light”, “Temperature” and “LQI” use current Home Assistant data; Glow is enabled separately. |
| `marker.light_role.help` | «Авто» использует фактическую роль привязанного устройства, «Всегда» принудительно создаёт собственный источник, а «Никогда» исключает его; связанные лампы выше остаются независимыми. | “Auto” uses the bound device's resolved role, “Always” forces its own source and “Never” excludes it; linked lights above remain independent. |
| `marker.controls.help` | Перечисленные источники переключаются вместе с этим маркером, но световые пятна остаются у их собственных маркеров — этот маркер сам светиться не начинает. | The listed sources toggle with this marker, but their glow stays at their own markers; this marker does not become a light source. |
| `gs.north.help` | Угол отсчитывается по часовой стрелке от верхней вертикали плана; север нужен для оконных лучей, а не для фона «Следует за Солнцем». | The angle is measured clockwise from the plan's upward vertical; north is required for window rays, not for the “Follows the Sun” background. |
| `space.north.help` | Переопределяет общий север для этого пространства; угол отсчитывается по часовой стрелке от верхней вертикали плана и используется оконными лучами. | Overrides general north for this space; the angle is measured clockwise from the plan's upward vertical and is used by window rays. |
| `gs.bg_mode.help` | «Следует за Солнцем» использует `sun.sun`, а при недоступности — локальные часы браузера; статичный режим всегда показывает выбранный цвет. | “Follows the Sun” uses `sun.sun`, falling back to the browser's local clock; Static always shows the selected colour. |
| `space.bg_mode.help` | Выберите наследование общего фона либо переопределите это пространство статичным цветом или режимом «Следует за Солнцем». | Inherit the general background or override this space with a static colour or “Follows the Sun”. |
| `plan.boundary.help` | Виртуальная граница означает отсутствие стены: свет и заливка проходят между комнатами, а отдельные контуры комнат сохраняются. | A virtual boundary means there is no wall: light and fill pass between the rooms while their separate room outlines remain. |
| `devbar.show_all.help` | Временно показывает скрытые и деактивированные устройства только в редакторе устройств; фильтры и сохранённая видимость не меняются. | Temporarily shows hidden and disabled devices only in the Device editor; filters and saved visibility are unchanged. |

Для каждого ключа добавляется цельная локализованная `.help.aria` в форме
«Подсказка: …» / `Help: …`, называющая настройку, а не повторяющая весь tooltip.

## 7. Уже поставленные пилоты #68

`marker.glow_radius.help` и `marker.light_role.help` уже существуют. В этой задаче:

- device radius не получает второй trigger; проверяется его единица и inheritance;
- текст light role заменяется каноническим из §6, потому что он обязан объяснять
  динамический Auto/Always/Never contract;
- их `.aria` keys сохраняют текущие имена и остаются непустыми в обеих локалях;
- smoke #68 продолжает проходить без второго tooltip на том же control.

## 8. Размещение triggers

- Dialog field: trigger стоит рядом с label/legend, но не внутри `<label>`.
- Disabled fieldset: trigger находится в первом `<legend>` либо вне fieldset.
- Boundary tool: trigger находится в активной tool context panel рядом с именем
  инструмента, а не внутри canvas и не перекрывает pointer target toolbar button.
- Show-all: отдельный help-trigger рядом с action label; он не вложен в основную
  кнопку и не переключает режим при открытии подсказки.
- General/space north and background получают отдельные keys, потому что
  inheritance/override semantics различаются.

Help-trigger не должен менять ширину canvas, stage zoom или доступность основного
action. При 200% zoom label и trigger могут переноситься вместе.

## 9. Удаление старых подсказок

После добавления `hp-help` на том же control удаляются:

- `marker.controls_hint` и соответствующий `.rhint`;
- `gs.bg_daynight_hint` как постоянный `.rhint`;
- `gs.north_hint` как постоянный `.rhint`;
- `title.show_all` с show-all action;
- `title.markup_boundary`, если он объясняет тот же Boundary contract.

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

- все keys §6 и `.aria` добавляются/обновляются одновременно в `en.json` и
  `ru.json`;
- `_help()` вызывается только строковым литералом;
- отсутствующая/пустая строка в любой локали валит parity/source test;
- термины совпадают с `docs/USER-GUIDE.ru.md`: «Общие настройки»,
  «Пространство», «Граница», «Показать все устройства», Glow;
- backticks в таблице спецификации не означают rich formatting в tooltip:
  UI получает plain text.

## 13. Acceptance criteria

1. **AC1 — полный Party 1 inventory.** Все 11 placements §6 имеют один
   работоспособный `hp-help`; два pilot placement не дублируются.
   **Доказательство:** source inventory unit + code review.
2. **AC2 — канонический content.** RU/EN передают смысл таблицы §6, максимум два
   предложения и отвечают «что изменится». **Доказательство:** exact i18n unit.
3. **AC3 — parity.** Для каждого literal `.help` есть непустые `.help` и `.aria`
   в обеих локалях. **Доказательство:** i18n parity test.
4. **AC4 — no duplicates.** На migrated control нет параллельного `title=` или
   объясняющего `.rhint`; dynamic status notes сохранены. **Доказательство:**
   source scanner + DOM smoke.
5. **AC5 — all surfaces.** General, space, marker dialog, Plan Boundary context и
   Device show-all открывают/закрывают help без запуска основного action.
   **Доказательство:** targeted browser smoke.
6. **AC6 — input/a11y.** Mouse, touch и keyboard работают по #68; disabled state,
   Escape, focus trap и `.aria` корректны. **Доказательство:** accessibility smoke.
7. **AC7 — layout.** 390px viewport и 200% zoom не обрезают tooltip/trigger и не
   меняют stage geometry. **Доказательство:** smoke + reviewed golden.
8. **AC8 — no behavior/model change.** Save/result каждой настройки и config
   serialization идентичны до/после. **Доказательство:** existing units + code review.
9. **AC9 — parties 2/3 absent.** В diff нет новых help placements вне §6, кроме
   необходимых shared tests/docs. **Доказательство:** diff review.

## 14. План автотестов

### Unit/source contract

- exact Party 1 key set and no computed `_help()` keys;
- pair/parity/non-empty checks en+ru;
- no duplicate `title`/`.rhint` at migrated hosts;
- existing #68 overlay/controller tests unchanged;
- config serialization snapshots unchanged.

### Browser smoke

- по одному placement на general, space, marker, Plan tool и Device header;
- mouse hover, keyboard focus/Enter/Escape и touch toggle/outside close;
- open help does not change setting/tool/show-all action;
- disabled group, native Popover and forced fallback;
- two cards with different languages;
- dynamic sun/Glow status note remains next to help.

### Golden

- general settings and space dialog with help open;
- Boundary context and Device show-all at desktop/mobile widths;
- light/dark and 200% zoom; full Linux artifact review required.

### Mutant

Remove one Party 1 key or re-add an old `title=`. The parity/inventory scanner
must fail; без этого source contract не доказан.

## 15. Затронутые поверхности

- relevant templates in `src/houseplan-card.ts`;
- `src/i18n/en.json`, `src/i18n/ru.json`;
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
| Контент расходится между RU/EN | pair/parity test |
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
- актуальная space fill модель post-#56 важнее устаревшего счёта «пять режимов»;
- dynamic status notes не считаются дублирующей документацией;
- точное DOM placement может меняться без изменения adjacency/action ownership.
