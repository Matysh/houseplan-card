# Issue #239 — масштаб сетки не меняет внешний вид плана

- Дата: 2026-08-22
- Тип: bug · приоритет P1 · пользовательская ценность 9/10
- Сложность 8/10 · риск 8/10 · обычный трек
- Issue: [#239](https://github.com/Matysh/houseplan-card/issues/239)
- Ветка: `issue/239-grid-scale-invariance`

Канонические документы: `docs/SCOPE.md`, `docs/CANVAS.md`,
`docs/WALL-THICKNESS.md`, `docs/TOUCH-SUPPORT.md`,
`docs/CONFIG-COMPATIBILITY.md`, `docs/USER-GUIDE.ru.md`.

Связанная реализованная задача: [#230](https://github.com/Matysh/houseplan-card/issues/230)
зафиксировала физический шаг штриховки стен и является подмножеством этого
контракта.

## 1. Сценарий и персона

Администратор дома создаёт новый этаж в desktop-редакторе и выбирает точность
сетки. Для подробного плана квартиры ему нужен шаг 1 см, а для старого плана
может оставаться 5 см. В имперской системе тот же новый этаж начинается с шага
1 дюйм.

При одинаковых физических размерах комнат, стен, проёмов и объектов человек
должен видеть один и тот же план. Выбор более мелкой сетки даёт больше доступных
координат для точного редактирования, но не превращает створки дверей, контуры,
подсказки или изометрические стены в более тонкие и мелкие элементы.

Задача поддерживает J4 и J6 из `docs/SCOPE.md`: точный план без внешнего CAD и
предсказуемое обслуживание существующей схемы.

## 2. Что человек увидит до и после

**До:** на физически одинаковом плане при `cell_cm: 1` часть элементов выглядит
в несколько раз тоньше или меньше, чем при `cell_cm: 5`. Особенно заметны
створки и дуги проёмов, контуры комнат и часть линий/узлов редактора. Новое
пространство всегда предлагает 5 см на клетку, а в имперском интерфейсе поле
масштаба всё равно выражено в сантиметрах.

**После:** физически одинаковые планы при 1 и 5 см на клетку выглядят одинаково
во View, Plan, Devices, Background, static/embedded card и скрытой изометрии.
Различаются только плотность сетки и точность snap. Новое пространство начинает
с 1 см на клетку в metric HA и с 1 дюйма на клетку в imperial HA. Старые
пространства и сохранённые значения не переписываются.

## 3. Подтверждённый диагноз

### 3.1 Что уже масштабируется правильно

- Толщина стен, перегородок и колонн переводится из cm через
  `wallCmToUnits()`.
- Размеры decor и мебели проходят через cm↔units helpers.
- Glow хранит радиус в физических единицах.
- #230 сделал шаг и толщину штриховки физическими.
- Узлы привязки #137 имеют физический радиус 5/10 см.
- Device markers и room labels получают размер через `iconUnit()` / `iconCqw()`;
  screen-space trail/chrome использует `vector-effect` или расчёт из текущего
  `view.w / clientWidth`.

Эти пути нельзя домножать повторно.

### 3.2 Где инвариант нарушен

В старом масштабе `cell_cm: 5` в рендере накопились константы в SVG user units.
На физически эквивалентном плане с `cell_cm: 1` координаты и frame в пять раз
больше, а константы остаются прежними и после одинакового fit становятся в пять
раз мельче на экране.

Подтверждённые группы:

1. `src/render/opening-symbol.ts`: толщина створок 3/3.5 units, jamb/glass
   strokes 1.5/2.5, fallback depth и padding outline/hit 4–12 units.
2. `src/houseplan-card.ts`: outline/hit rect проёма, offset lock badge,
   preview/orphan dots, Plan vertices, alignment dots и отдельные SVG strokes.
3. `src/styles.ts`: room/open-boundary/wall outlines, opening arc/outline,
   hover halo, draft/preview/repair lines, dash patterns и часть editor chrome.
4. `src/space-render.ts` / `src/space-card.ts`: статические room/wall/opening
   counterparts с теми же сырыми units.
5. Скрытая изометрия: `ISO_WALL_HEIGHT`, `ISO_FLOOR_EDGE_HEIGHT`, shadow offset
   и SVG blur заданы в user units. При увеличившемся физически эквивалентном
   плане высота и тени относительно фасада уменьшаются.

### 3.3 Default и compatibility

- Ручной create и floors-import draft отдельно задают `cellCm: 5`.
- Поле всегда показывает canonical cm и строку `cm per cell`, даже когда
  `hass.config.unit_system.length === 'mi'`.
- Fallback `5` при чтении отсутствующего/некорректного `cell_cm` встречается в
  frontend, static renderer, optimizer и backend validation. Это legacy
  compatibility, а не default создания, и меняться не должно.

## 4. Термины и эталонная эквивалентность

- **Эталонный масштаб** — `REFERENCE_CELL_CM = 5`; его внешний вид сохраняется.
- **Физически эквивалентные пространства** — все координаты и размеры в plan
  units второго пространства умножены на `k = 5 / cell_cm`, а физические поля в
  cm не изменены. Layout-позиции, backdrop/decor geometry и camera centre/extent
  преобразованы тем же `k`.
- **Одинаковый camera state** — одинаковый viewport и одинаковый относительный
  zoom/pan; world-space view второго пространства преобразован через `k`.
- **Разрешённое различие** — число видимых/доступных узлов сетки на физический
  метр и вызванная этим точность snap.
- **Visual unit** — legacy SVG-константа, чей нынешний размер при
  `cell_cm: 5` является эталоном и должен следовать `k`.

## 5. Границы задачи

### 5.1 Входит

- единый pure helper масштаба visual units;
- полный аудит SVG-примитивов full/static/embedded renderers;
- проёмы вместе с hover/hit geometry и door/gate lock badge position;
- Plan editor: saved outlines, previews, snap/repair/alignment/dimension chrome;
- Devices и Background editor chrome как регрессионные поверхности;
- скрытая изометрия, включая wall/floor height, openings и shadows;
- metric/imperial default и единицы поля при создании/редактировании;
- manual create и floors-import;
- светлая/тёмная тема, desktop и touch safety floor;
- документация, EN/RU i18n, оба changelog и целевые тесты.

### 5.2 Не входит

- изменение `GRID_N`, `GRID_PITCH`, координатной модели или snap algorithm;
- миграция/перезапись существующих `cell_cm`;
- изменение legacy fallback `5` для отсутствующего значения;
- изменение физических размеров стен, decor, мебели, Glow или пользовательских
  icon/label multipliers;
- изменение зум-контракта: visual units продолжают масштабироваться вместе с
  планом так же, как при `cell_cm: 5`, а не становятся screen-fixed;
- новый UI включения изометрии;
- постоянные размерные подписи из #52;
- расширение поддерживаемого диапазона `cell_cm` 0.1…1000.

## 6. Классификация размеров

Каждый затронутый размер относится ровно к одному классу.

| Класс | Примеры | Правило |
|---|---|---|
| Physical | wall/partition/column cm, decor width/text, furniture, Glow radius, hatch #230, snap-node 5/10 cm | Уже переводится через `cell_cm`; не домножать |
| Screen | HTML labels/icons, `vector-effect: non-scaling-stroke`, px-derived hit/handles, vacuum trail | Оставить screen-fixed |
| Plan-relative | device/room-label size через `iconUnit`, content padding как доля frame, room corner radius как доля geometry | Масштабируется своей геометрией; не домножать |
| Visual unit | legacy raw SVG constants, эталонные при `cell_cm: 5` | Домножить на `visualScale(cell_cm)` |
| Grid | pitch, adaptive density, snap quantum | Не домножать; это единственное ожидаемое различие |

Слепой множитель на весь SVG запрещён: он повторно увеличит physical и
plan-relative размеры.

## 7. Контракт visual units

Новый pure module, рекомендуемое имя `src/grid-scale.ts`:

```ts
export const GRID_VISUAL_REFERENCE_CELL_CM = 5;

export function gridVisualScale(cellCm: unknown): number;
export function gridVisualUnits(baseUnits: number, cellCm: unknown): number;
export function newSpaceCellCm(imperial: boolean): number;
```

### 7.1 `gridVisualScale`

- валидное положительное `cellCm`: `5 / cellCm`;
- `5` возвращает ровно `1` без накопления погрешности;
- `NaN`, infinity, `0`, отрицательное и нечисловое значение дают `1`, то есть
  legacy fallback 5;
- отдельного clamp нет: поддерживаемый диапазон уже ограничен 0.1…1000, а clamp
  нарушил бы эквивалентность на законных значениях.

### 7.2 Применение в CSS и SVG

Full card и static card выставляют на корне соответствующего пространства
unitless custom property `--hp-cell-visual-scale`. Scale-sensitive CSS lengths
используют её; геометрические attributes и TypeScript-расчёты вызывают
`gridVisualUnits()`.

Fallback custom property равен `1`, чтобы отдельный renderer или старый тестовый
host без переменной сохранял исторический `cell_cm: 5` вид.

Фактор вычисляется один раз на пространство/рендер. Запрещено заново обходить
геометрию или делать plan-wide polyclip ради визуального масштаба.

### 7.3 Инвариант `cell_cm: 5`

При `cell_cm: 5` итоговые численные geometry attributes и computed styles
должны совпасть с состоянием до #239. Замена `2.5` на выражение, которое в
Chromium вычисляется не в те units, считается регрессией даже при близком
внешнем виде.

## 8. Контракт поверхностей

### 8.1 Flat View

- room borders, wall-body outline, open boundaries и room hover сохраняют
  эталонную толщину/halo;
- door/window/gate leaf, arc, glass, jamb и passage boundaries сохраняют
  геометрию и толщину;
- opening lock badge остаётся на том же относительном отступе от стены;
- sun/Glow/device/value badge/room label/vacuum сохраняют текущий контракт без
  повторного scale.

### 8.2 Opening interaction

- `openingVisibleMetrics()` масштабирует только fallback/padding visual units;
  физический `jambHalf` от толщины стены остаётся physical;
- outline и hit rectangle масштабируются тем же factor, включая corner radius;
- hover появляется и click/double-click/drag срабатывают во всей той же видимой
  области на экране, что при эквивалентном `cell_cm: 5`;
- preview и committed symbol читают один helper и не расходятся.

### 8.3 Plan editor

- контуры, active/draft/preview/repair/alignment lines, vertices и orphan/
  opening-preview markers сохраняют эталонный экранный footprint при одинаковом
  относительном zoom;
- физические 5/10-см snap nodes остаются физическими; их screen-fixed strokes
  остаются screen-fixed;
- dimension lines/ticks с `vector-effect` и HTML labels не получают второй
  scale;
- grid pitch не меняется. При одинаковой физической длине метрический 1-см план
  содержит в пять раз больше snap intervals, чем 5-см план.

### 8.4 Devices и Background

- marker, room label, LQI/value/lock satellites и capsules сохраняют размер и
  pointer/action area;
- decor/furniture physical geometry не домножается;
- backdrop/decor/resize/physical selection frames и handles сохраняют текущий
  screen-space либо px-derived контракт;
- ни один editor gesture, pointer capture, pan/pinch/cancel path не меняется.

### 8.5 Static/embedded card

`renderSpaceStatic()` выставляет тот же factor и использует те же opening
metrics/styles. Одинаковая fixture не может быть правильной в full card и иной
в `houseplan-space-card`.

### 8.6 Скрытая изометрия

- wall height, floor-edge depth, opening height/basis и geometry-dependent
  shadow offsets умножаются на factor;
- SVG blur/translate в user units масштабируется так же; screen-fixed strokes
  с `vector-effect` остаются без дополнительного множителя;
- factor входит в geometry fingerprint/cache key через фактически переданные
  высоты; warm remount не может вернуть geometry другого `cell_cm`;
- icon/label projection и actions остаются прежними;
- Labs-функция остаётся скрытой и публичного переключателя не получает.

## 9. Новый default и imperial projection

### 9.1 Хранение

`cell_cm` остаётся canonical числом сантиметров на клетку.

- новый metric draft: `1`;
- новый imperial draft: `2.54` (ровно 1 inch);
- manual create и каждый элемент floors import используют один
  `newSpaceCellCm(this._imperial)`;
- save продолжает записывать canonical cm.

### 9.2 Поле диалога

- metric: значение в cm, подпись «см на клетку» / `cm per cell`;
- imperial: значение в inches, подпись «дюйм на клетку» / `in per cell`;
- ввод inches переводится в canonical cm до validation/save;
- min/max в поле также проецируются в текущую систему единиц.

### 9.3 Lossless edit

Открытие и сохранение существующего пространства без изменения поля не меняет
его canonical `cell_cm`, в том числе в imperial HA. Округлённая строка UI не
становится новым значением сама по себе: draft хранит исходное canonical число
и отдельный признак/текст пользовательского редактирования либо эквивалентный
lossless механизм.

Отсутствующий `cell_cm` продолжает читаться и при save materialize как 5 см.
Новый default нельзя использовать как read fallback.

## 10. Данные, migration, i18n, a11y, privacy и security

- Schema и формат данных не меняются; миграции нет.
- Существующий `space.scale_unit` остаётся metric-текстом: RU «см на клетку»,
  EN `cm per cell`. Новый `space.scale_unit_imperial`: RU «дюйм на клетку»,
  EN `in per cell`. Label поля остаётся существующим `space.scale_label`.
- Поле остаётся обычным label+number input; доступное имя и порядок фокуса не
  меняются.
- Никаких новых данных HA, service calls, URL или файловых операций.
- Privacy/security без изменений.

## 11. Touch contract

View и kiosk остаются полностью поддержанными. Editors остаются desktop-first,
но safety floor из `docs/TOUCH-SUPPORT.md` обязателен:

- opening hit/hover/action area не уменьшается из-за `cell_cm`;
- pan, pinch, second pointer, `pointercancel` и suppressed click ничего не
  сохраняют и не запускают;
- screen-derived handles не переводятся ошибочно в physical/visual units;
- никаких новых hover-only действий.

## 12. Performance

- допустим один scalar factor на пространство и дешёвые умножения при render;
- новые plan-wide обходы, boolean geometry, layout reads и HA state dependencies
  запрещены;
- существующие structural caches сохраняются; iso fingerprint различает
  фактические scaled heights;
- large-house benchmark и hidden-iso benchmark проверяются перед бетой по
  общему release-процессу, не в цикле реализации.

## 13. Acceptance criteria

**AC1.** `gridVisualScale(5) === 1`; для 1, 2.54, 10 и 25 результат равен
`5 / cell_cm`; invalid input даёт 1. `gridVisualUnits(base, cell)` применяет
ровно тот же factor.

**AC2.** Физически эквивалентная flat View fixture при `cell_cm: 5` и
`cell_cm: 1` в одном viewport и camera state имеет одинаковые browser pixels
для комнат, masonry, partition/column, door/window/gate/passage, decor,
devices/labels, Glow и sun. Grid во View отсутствует.

**AC3.** Opening leaf/arc/glass/jamb, outline и hit rectangle дают одинаковые
screen bounding boxes/stroke widths на эквивалентных планах. Hover, click,
double-click и drag срабатывают в одинаковой внешней области; preview и
committed symbol совпадают.

**AC4.** Plan editor после маскирования grid paint даёт одинаковый raster/DOM
footprint для saved outlines, active/draft/thick preview, vertices,
snap/repair/alignment guides, opening preview и dimensions. При этом raw grid
содержит 100 intervals на метр при 1 см и 20 при 5 см.

**AC5.** Physical snap nodes остаются диаметром 10/20 см, decor/furniture stroke
и size остаются заданными cm, hatch остаётся 9.6 см по #230, Glow radius не
меняется, а device/room-label size продолжает вычисляться через `iconCqw`.
Тест обязан падать при повторном применении visual factor к любому из этих
контрольных путей.

**AC6.** Devices и Background editor selection frames, visible knobs и
screen-derived hit handles имеют одинаковый screen footprint на эквивалентных
планах; pointer sequence не меняет сохранённую geometry без положенного commit.

**AC7.** `houseplan-space-card` на тех же двух fixtures совпадает по pixels и
critical DOM metrics, включая rooms, wall body и opening symbols.

**AC8.** Скрытая изометрия при 1 и 5 см совпадает по wall/floor/opening height,
shadow extent и raster; projected icons/labels остаются над теми же объектами.
Light/dark проверяются отдельно. Isometric toggle остаётся Labs-only.

**AC9.** Ручное создание нового пространства показывает и сохраняет:
metric — `1 cm/cell`, imperial — `1 in/cell` и canonical `cell_cm: 2.54`.

**AC10.** Floors import использует те же defaults для каждого создаваемого
пространства и не возвращается к hardcoded 5.

**AC11.** Existing `cell_cm: 5`, произвольное дробное значение и legacy space
без поля при open→save без редактирования не получают новый default и не
дрейфуют при imperial projection. Legacy missing value материализуется как 5.

**AC12.** Metric/imperial label, input value, min/max и conversion соответствуют
системе единиц; переключение языка не меняет canonical draft.

**AC13.** На `cell_cm: 5` все scale-sensitive geometry attributes и computed
styles совпадают с pre-#239 contract; current golden не требует принятия
необъяснённых изменений. Изменение screenshot диалога создания из 5 в 1 —
ожидаемый отдельный user-visible diff.

**AC14.** Ни View/kiosk tap, ни editor pan/pinch/pointercancel не получают новых
действий; opening action area не меньше эталонной.

**AC15.** Новых plan-wide geometry passes и state-dependent cache invalidations
нет; factor вычисляется O(1) на пространство.

**AC16.** EN/RU user guide и оба changelog объясняют: внешний вид не зависит от
шага сетки, default новых пространств 1 см/1 дюйм, существующие значения не
мигрируют.

### 13.1 Матрица доказательств

| AC | Обязательное доказательство |
|---|---|
| AC1 | `test/grid-scale.test.mjs`: точные значения helper и invalid fallback |
| AC2 | `demo/smoke_grid_scale_invariance.mjs`: pair pixel comparison flat View light/dark |
| AC3 | opening unit tests + тот же smoke: DOM metrics и реальные pointer-точки на внешней границе hitbox |
| AC4 | тот же smoke: Plan pair pixels с замаскированным grid; отдельный DOM count/spacing grid intervals |
| AC5 | unit negative controls для physical helpers + pair smoke для hatch/Glow/decor/device/snap nodes; mutation `grid-scale-physical-double-scaled` обязан покраснеть |
| AC6 | pair smoke в Devices/Background: `getBoundingClientRect()` frame/knob/hit handles и mutation-free pointer sequence |
| AC7 | pair pixel/DOM comparison двух `houseplan-space-card` в `demo/smoke_grid_scale_invariance.mjs` |
| AC8 | iso unit tests для height/depth/fingerprint + pair pixel/DOM comparison hidden iso light/dark и отсутствие публичного toggle без Labs |
| AC9 | `test/grid-scale.test.mjs` для pure default + `demo/smoke_space_scale_defaults.mjs` для dialog/save metric и imperial |
| AC10 | `demo/smoke_space_scale_defaults.mjs`: два floors-import drafts и сохранённые canonical значения в обеих unit systems |
| AC11 | unit compatibility cases + smoke open→save без input event для 5, дробного и missing `cell_cm` в imperial |
| AC12 | default smoke: input value/min/max/unit text для EN/RU metric/imperial и неизменный canonical draft при language rerender |
| AC13 | code review сверяет exact scale-1 attributes/computed styles; текущий `golden:verify` выполняется перед бетой и не принимается разработчиком; public docs provenance показывает единственный ожидаемый create-default diff |
| AC14 | targeted opening/touch browser smoke: tap остаётся действием, pan/pinch/second-pointer/`pointercancel`/suppressed click не выполняют action и не мутируют config; edge hit-points из AC3 подтверждают неуменьшение области |
| AC15 | code review по diff: factor O(1), без новых geometry traversal/state reads; performance benchmarks — предрелизный gate |
| AC16 | `node scripts/check-docs.mjs` + code review полного diff обоих changelog и обоих user guide; public screenshot provenance проверяет create-dialog |

## 14. План автотестов

### 14.1 Unit

- новый `test/grid-scale.test.mjs`: AC1, AC9–AC12;
- opening-symbol tests: scaled leaf/jamb/padding/hit metrics и отсутствие
  double-scale physical jamb;
- iso projection/geometry tests: scaled height/depth/cache fingerprint;
- policy assertions на physical/screen control paths из AC5.

### 14.2 Browser smoke

Новый `demo/smoke_grid_scale_invariance.mjs` строит пару из одной rich fixture:

- `cell_cm: 5`, reference coordinates;
- `cell_cm: 1`, все plan/layout/camera coordinates ×5, physical cm без изменений.

Один прогон проверяет flat View light/dark, Plan states с grid mask,
Devices/Background selection, static card и hidden iso. Он сравнивает реальные
browser pixels через canvas и critical DOM metrics, а не только наличие классов.
Разрешённая tolerance должна быть нулевой либо обоснованной только
subpixel-antialiasing; она не может скрывать систематическую разницу толщины.

Отдельный `demo/smoke_space_scale_defaults.mjs` проверяет manual create,
floors-import, metric/imperial labels, canonical save и lossless existing edit.

Существующие целевые smokes запускаются по изменённым символам: opening preview/
measure, plan snap, physical editor, decor, static card и isometric Stage 2/3.

### 14.3 Golden и performance

В цикле реализации — только typecheck, unit, build и named smokes. Полный golden,
smoke suite и performance — перед бетой по каноническому процессу. Golden
baseline разработчик не принимает. Public docs capture переснимается в задаче,
потому что create-dialog законно меняет default.

## 15. Mutation gate

| id | Что ломает | Гвард |
|---|---|---|
| `grid-scale-visual-factor-constant` | factor всегда 1 | unit + pixel smoke |
| `grid-scale-visual-factor-inverted` | `cell/5` вместо `5/cell` | unit + pixel smoke |
| `grid-scale-opening-symbol-unscaled` | leaf/jamb visual constants остаются raw | opening unit/smoke |
| `grid-scale-opening-hit-unscaled` | outline/hit padding остаётся raw | interaction smoke |
| `grid-scale-plan-chrome-unscaled` | Plan line/node visual unit не следует factor | Plan pixel smoke |
| `grid-scale-static-factor-missing` | static root не получает factor | static comparison |
| `grid-scale-iso-height-unscaled` | iso height/depth остаются constants | iso unit/pixel smoke |
| `grid-scale-metric-default-five` | metric create снова 5 | default smoke |
| `grid-scale-imperial-default-wrong` | imperial create хранит 1 cm либо 5 cm | unit/default smoke |
| `grid-scale-legacy-fallback-one` | read fallback меняется с 5 на новый default | compatibility unit |
| `grid-scale-imperial-roundtrip-drift` | rounded UI string перезаписывает canonical value | default smoke |
| `grid-scale-physical-double-scaled` | wall/decor/Glow/snap physical path получает второй factor | AC5 unit/smoke |

## 16. Риски и защита

| Риск | Вероятность / ущерб | Защита |
|---|---|---|
| Общий CSS factor повторно масштабирует physical элементы | средняя / высокий | классификация §6, negative controls AC5 |
| `px`/unitless `calc()` в SVG вычислится не в user units | средняя / высокий | exact `cell_cm:5` DOM + raster и pair pixel smoke |
| Hover визуально совпадёт, а hitbox останется маленьким | высокая / высокий | AC3 проверяет реальные pointer points по краю capsule |
| Imperial open/save округлит 5 см в 5.0038 см | высокая / средний | untouched canonical draft + AC11/mutant |
| Default поменяется только в одном create path | высокая / средний | manual + floors-import AC9/AC10 |
| Изометрический cache вернёт старую высоту | средняя / высокий | scaled input в fingerprint + warm-remount test |
| Dynamic grid затруднит pixel comparison Plan | высокая / низкий | grid paint маскируется, density проверяется отдельно |
| Широкий CSS audit изменит `cell_cm:5` pixels | средняя / высокий | reference exactness AC13, без baseline acceptance |
| Touch target станет physical вместо screen-equivalent | средняя / высокий | edge pointer smoke + TOUCH-SUPPORT safety floor |

## 17. Release-артефакты

`User-Visible: yes`:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в одном продуктовом коммите;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: scale field/default и
  визуальный инвариант;
- `docs/CANVAS.md`: taxonomy размеров и новый default; убрать утверждения
  «default 5» там, где речь именно о новых пространствах, сохранив legacy
  fallback;
- `docs/ARCHITECTURE.md`: актуализировать описание `cell_cm` default;
- `docs/TESTING.md`: named smoke и ручная матрица 1/5 cm + imperial;
- public docs screenshot create-space переснять через `demo/docs/capture.mjs`;
- `docs/images/screenshots.json` обновить тем же capture;
- golden/performance artifacts — только в предрелизном прогоне.

Три поставляемых `houseplan-card.js` собираются и коммитятся вместе с
реализацией, должны быть побайтно одинаковы.

## 18. Откат

Один revert продуктового коммита возвращает прежние visual constants и default
5. Миграции данных и обратной миграции нет: пространства, созданные во время
действия версии с `cell_cm: 1`/`2.54`, остаются валидными обычными пространствами
и после отката.

## 19. Принятые предположения — технические, менять свободно

1. Pure helper и CSS property названы `gridVisualScale` и
   `--hp-cell-visual-scale`; reviewer может предложить другое имя без изменения
   продукта.
2. Lossless imperial edit реализуется через canonical value + touched/display
   draft. Эквивалентный механизм допустим, если AC11 доказан.
3. Pair screenshot smoke использует динамическую вторую fixture вместо новых
   постоянных golden baselines: это проверяет именно инвариант и не требует
   принятия эталонов разработчиком.
4. Scale-sensitive CSS меняется адресно по таблице §6. Общий transform всего
   renderer запрещён независимо от удобства реализации.
