# Issue #101 — плавный переход View ↔ редакторы

- **Issue:** https://github.com/Matysh/houseplan-card/issues/101
- **Статус ТЗ:** реализовано локально; ожидает prerelease/CI gate
- **Приоритет:** P2 / polish
- **Оценка:** сложность 8/10, пользовательская ценность 6/10, ценность для
  разработки 6/10, score `(2×6+6)/8 = 2,25`
- **Риск:** высокий — один transition пересекает viewport math, responsive
  layout, day/night, lifecycle #73 и разнородные SVG/HTML layers
- **Область:** mode navigation, editor chrome, stage geometry, camera/viewBox,
  background/paper presentation, mode-specific layers, accessibility и QA
- **Модель данных:** без изменений
- **Связано:** #73 (visual continuity), #82 (animated user zoom), #93
  (при возврате всегда View), editor context tray, `docs/UX-MODES.md`,
  `docs/CANVAS.md`, `docs/ARCHITECTURE.md`
- **Touch:** переход в поддерживаемый View обязан быть корректным и безопасным;
  визуальный polish редакторов на coarse pointer — best effort, но misclick,
  stuck editor и повреждение данных запрещены `docs/TOUCH-SUPPORT.md`

## 1. Резюме

Вход из View в Plan/Devices/Backdrop editor, выход обратно и переключение
между редакторами должны выглядеть как один короткий переход, а не как серия
layout jumps.

За **220 мс** один controller согласованно меняет:

- высоту и содержимое editor toolbar;
- top/height рабочей области;
- camera zoom + center и итоговый SVG `viewBox`;
- stage background и цвет plan paper;
- opacity mode-specific overlays/controls.

Переход заканчивается точным штатным состоянием. View zoom и center
восстанавливаются без промежуточного default-fit кадра. Glow, device states,
room fills и геометрия не пересчитываются ради анимации.

При `prefers-reduced-motion: reduce` tween отсутствует, но переход остаётся
атомарным: первый видимый кадр уже имеет правильные toolbar, stage, camera и
background.

## 2. Пользовательская проблема

Текущий переход функционально корректен, но визуально распадается:

1. mode меняется сразу;
2. toolbar начинает отдельно раскрываться/схлопываться;
3. stage меняет доступную высоту через `_hdrH`/ResizeObserver;
4. plan получает другой fit/zoom;
5. View background/day-night мгновенно сменяется белым editor canvas;
6. mode-specific элементы исчезают/появляются;
7. поверх уже нового кадра проигрывается opacity/scale animation.

Пользователь видит изменение масштаба, белую/тёмную вспышку и резкую смену
controls, хотя CSS формально содержит transition.

Особенно заметны:

- узкие экраны и многострочные панели;
- пользовательский zoom/pan View;
- переход в editor без backdrop (`baseChanges`);
- day/night или custom background;
- Backdrop editor с de-emphasis архитектуры;
- быстрый Plan → Devices → Backdrop → View.

## 3. Проверенные причины в текущем коде

### 3.1. Mode commit опережает визуал

`_setMode()` сразу меняет `_mode`. Один render одновременно меняет stage class,
слои, editor tools, background rules и interaction semantics. Анимация
`.zoomwrap.nav-*` применяется уже к входящему DOM и не хранит outgoing visual
state.

### 3.2. Camera не входит в общий timeline

При `baseChanges` код устанавливает `_zoom = 1` и `_view = null`, после чего
следующий update строит fit. При выходе snapshot восстанавливается отдельным
`requestAnimationFrame`. Поэтому между исходным и целевым viewport может
появиться один default-fit кадр.

### 3.3. Несколько владельцев времени

- `_navMotionTimer` — 190 мс;
- CSS animation `.zoomwrap.nav-*` — 160/180 мс;
- CSS grid transition `.editorchrome` — 180 мс;
- WAAPI `_animateEditorSwap()` — 190 мс;
- header/stage ResizeObserver публикуют размеры независимо.

Они не имеют общего generation token и не умеют retarget от фактически
показанного промежуточного состояния.

### 3.4. Фон и paper меняются разными механизмами

View использует custom/static/day-night stage background. Editors принудительно
используют белый `.stage.mode-*` и белый `.hp-paper`. `background-color` имеет
короткий transition, но day-night class, inline background и paper `fill`
переключаются отдельно. Результат не является согласованным crossfade.

## 4. Цели

1. Ни одного одно-кадрового jump масштаба, center, фона или paper fill.
2. Один timeline для toolbar, stage geometry, camera и presentation layers.
3. Точное восстановление View viewport и чистое разделение View/editor zoom.
4. Плавная смена всех трёх редакторов с реальной responsive высотой.
5. Безопасный retarget при быстрой навигации.
6. Отсутствие stale animation state после hide/resume/reconnect/disconnect.
7. Сохранение performance и визуальной семантики Glow.
8. Доступный reduced-motion atomic path.

## 5. Не входит в задачу

- анимация пользовательского wheel/button/fit zoom — #82;
- новая формула fit, zoom limits, pan slack или inertia;
- анимация смены пространства;
- reconnect/recovery overlay — #73;
- изменение editor tools, context tray и их команд;
- изменение модели данных/backend/config;
- пользовательская настройка длительности/easing;
- полноценная поддержка editors на touch;
- screenshot/canvas-copy сцены;
- двойной полный renderer плана;
- анимация открытия dialog.

## 6. Нормативная UX-матрица

Общая длительность обычного перехода: **220 мс**.

Easing: `cubic-bezier(0.2, 0.7, 0.2, 1)` либо математически эквивалентная
pure-функция. Допустимый диапазон после performance review: 180–240 мс.

| Переход | Toolbar | Camera/stage | Background/layers |
| --- | --- | --- | --- |
| View → Plan | panel раскрывается; Plan tools fade/translate 5 px | сохраняет visual anchor, плавно приходит к editor viewport | View bg/paper → white; View controls out, grid/plan overlays in |
| View → Devices | то же | без default fit; icons остаются пространственно связаны | device interaction/handles/ghosts входят crossfade |
| View → Backdrop | то же | без jump | white canvas; architecture плавно приходит к 35% editor opacity, decor controls in |
| Editor → View | panel схлопывается | приходит к exact saved View zoom + center | white → актуальный static/day-night/custom bg; View controls in |
| Editor A → B | old content out, target responsive height интерполируется, new content in | компенсирует изменение stage rect | background white остаётся; только mode-specific layers crossfade |
| Повторный выбор active mode | no-op | no-op | state/timers не создаются |

Переход не должен выглядеть как «план уменьшили, затем подвинули». Текущий
участок плана является visual anchor; все изменения происходят непрерывно.
Основной header, tabs и нажатая кнопка editor/close не сдвигаются из-за
анимации нижнего chrome. Если локализация сама меняет wrapping основного header,
это внешний responsive resize, а не часть декоративного transition.

## 7. Логическое и представленное состояние

Во время transition различаются:

- **target mode** — результат последнего пользовательского действия;
- **from presentation** — состояние реально показанного стартового кадра;
- **presented frame** — интерполированное состояние текущего кадра;
- **settled mode** — mode, для которого DOM/layout/camera окончательно
  нормализованы.

Нормативные типы:

```ts
type HouseplanMode = 'view' | 'plan' | 'devices' | 'decor';
type ModeTransitionPhase = 'idle' | 'preparing' | 'running' | 'settling';

interface ViewportPresentation {
  centerX: number;
  centerY: number;
  pixelsPerUnit: number;
  viewBox: { x: number; y: number; w: number; h: number };
}

interface ModeVisualState {
  /** Mode whose visual layers this endpoint represents. */
  presentedMode: HouseplanMode;
  editorChromeHeight: number;
  stageWidth: number;
  stageHeight: number;
  viewport: ViewportPresentation;
  stageColor: string;
  paperColor: string;
  sceneBrightness: number;
  layerWeights: Record<string, number>;
}

interface ModeTransitionState {
  token: number;
  phase: ModeTransitionPhase;
  from: ModeVisualState;
  to: ModeVisualState;
  startedAt: number;
  duration: number;
  targetMode: HouseplanMode;
}
```

Конкретные имена могут отличаться. Обязательны один owner, generation token и
возможность получить current presented state для retarget.

`targetMode` отвечает за active tab, разрешения и конечную семантику.
`presentedMode/layerWeights` отвечают за то, что сейчас видно. Во время
transition запрещено использовать один уже изменённый `_mode` как
единственный источник одновременно для tab, background, условного DOM и
interaction: именно это создаёт нынешний резкий первый кадр.

`stageTop` не является отдельным анимируемым authority: в текущей flow-layout
архитектуре он выводится из высоты chrome. Controller хранит и интерполирует
`editorChromeHeight`; stage top используется только как измеряемое
доказательство, что layout следует тому же progress.

## 8. State machine

### 8.1. `idle → preparing`

По действительному mode change:

1. отменить/завершить gesture transaction по текущим правилам;
2. закрыть context tray, tooltip, hover и mode-owned ephemeral overlays;
3. зафиксировать `from` из **computed/presented** state, а не старого target;
4. сохранить View snapshot, если исходный settled mode = View;
5. установить новый target mode для header semantics, но не переключать одним
   флагом все stage classes/conditional layers;
6. отрендерить target toolbar в измерительном состоянии без видимого layout
   jump;
7. вычислить `to`.

Все активные pointer/gesture transactions перед подготовкой завершаются через
их существующие владельцы: pan/pinch прерываются, decor transform откатывается
по текущему cancel-контракту, device drag и незавершённое plan interaction не
могут получить поздний `pointerup` уже в другом mode. Незавершённый контур
комнаты сохраняется по действующему resume-контракту и не коммитится из-за
навигации.

### 8.2. Измерение target toolbar

Target height нельзя предполагать константой. Она зависит от:

- editor mode;
- локали;
- card width и breakpoint;
- wrapping;
- доступных tools;
- browser font metrics.

Разрешён один hidden measurement pass:

- target toolbar находится в том же shadow root и получает те же styles;
- `visibility:hidden`, `position:absolute` либо эквивалентный layout-isolated
  measurement;
- он не участвует в accessibility tree и не принимает input;
- полный plan DOM не клонируется;
- измерение не должно изменить stage rect до старта visible transition.

Для visual crossfade разрешено кратковременно держать outgoing и incoming
toolbar content в одном chrome, но только target tab имеет `aria-current`, а
оба content subtree inert до settle. Screen reader не должен прочитать две
одновременные панели. После settle outgoing subtree удаляется.

Если target height уже закэширован для exact width/locale/tool signature,
можно использовать cache с проверкой после settle.

### 8.3. `preparing → running`

Controller получает:

- точный start stage rect;
- target stage rect из target header height;
- start camera из реально показанного viewBox;
- target camera по штатному fit/restore/clamp контракту;
- start/target colors и layer weights.

Stage становится временно inert. Header tabs остаются интерактивными.

### 8.4. `running`

Один clock рассчитывает normalized progress `0…1` и обновляет все части
одного frame. Запрещены параллельные независимые nav CSS timer и WAAPI height
animation.

Допустимы CSS/WAAPI как исполнитель, только если controller запускает их на
одном timeline, владеет cancel/retarget и может получить текущие presented
values.

### 8.5. `running → settling → idle`

В последнем кадре:

1. установить exact target mode/camera/background;
2. снять temporary inline styles/classes;
3. отпустить layout обратно natural CSS;
4. сверить natural rect с target; расхождение >0,5 CSS px исправить без
   видимого кадра;
5. обновить View persistence, если target = View;
6. снять inert;
7. выполнить focus handoff;
8. очистить RAF/WAAPI/timer и transition state.

`finished` promise предыдущего token не может менять новый state.

## 9. Camera contract

### 9.1. Представление camera

Хранимый `_zoom` нельзя использовать как прямую animation coordinate. Он
относителен к content frame, а `docs/CANVAS.md` разрешает editor-session frame
только расти. Один и тот же `zoom: 1` до и после mode switch поэтому может
означать разные мировые размеры и дать jump.

До старта controller вычисляет **точные endpoint viewBox** штатными helpers и
преобразует их в:

- мировой `centerX/centerY`;
- экранный масштаб `pixelsPerUnit = stageWidth / viewBox.w`;
- endpoint content frame только для final clamp/пересчёта `_zoom`.

На каждом кадре:

1. `centerX/centerY` интерполируются линейно;
2. `pixelsPerUnit` интерполируется в logarithmic space;
3. stage width/height берутся из того же geometry progress;
4. `viewBox.w = stageWidth / pixelsPerUnit`;
5. `viewBox.h = stageHeight / pixelsPerUnit`;
6. `x/y` строятся от interpolated center.

Так viewBox всегда имеет aspect текущего stage, SVG не получает временный
letterbox, а визуальная скорость zoom симметрична. Content frame и clamp **не
пересчитываются на каждом RAF**: source/target frame фиксируются при
prepare/retarget, editor grow-frame заморожен до settle. В последнем кадре
canonical helper ещё раз устанавливает точный target и производный штатный
`_zoom`.

Все SVG и HTML overlays используют один resulting viewport. Запрещено
анимировать SVG viewBox и отдельно накладывать другой transform только на HTML
markers.

### 9.2. View → editor

- snapshot содержит space, zoom и center;
- editor target вычисляется один раз для target stage rect;
- `_view = null` не публикуется как видимый промежуточный state;
- если editor target требует clamp, clamp входит в tween;
- editor zoom остаётся самостоятельным после settle.

### 9.3. Editor → View

- если space не менялся, target = сохранённый snapshot;
- если space менялся в editor, target берётся из per-space View store текущего
  пространства;
- отсутствие snapshot использует штатный fit target, но сразу как `to`, без
  промежуточного render;
- localStorage записывается один раз после settle только по существующему
  контракту `_saveZoom()`;
- editor working zoom никогда не записывается как View intent.

Issue #101 не вводит persistent center и не меняет формат `LS_ZOOM`: точный center
хранится только в session snapshot для обычного same-space View → editor →
View. Если пространство сменилось внутри editor либо карточка была создана
заново, используется существующий per-space zoom и штатный центр/fit. Это
изменение анимации, а не новая модель persistence.

### 9.4. Editor → editor

Текущий editor camera является start. Target camera учитывает target stage
height и зафиксированный editor grow-frame. Сам mode switch не сбрасывает user
editor zoom без существующего на то продуктового правила. Если смена mode
влияет на состав frame items, target frame вычисляется один раз до tween, а не
прыгает вслед за условным DOM во время него.

## 10. Stage/header geometry

Панель и stage используют один progress. Нормативная координата — высота
собственного editor chrome внутри карточки, а не абсолютный document top:

```text
editorHeight(p) = lerp(fromEditorHeight, toEditorHeight, ease(p))
stageHeight(p)  = viewportHeight - externalInset - baseHeaderHeight - editorHeight(p)
stageTop(p)     = flow layout result; measurement only
```

`externalInset` — существующий ограниченный budget HA chrome/safe area. Он
фиксируется на start и не анимируется как часть mode switch. Scroll страницы,
изменение положения карточки в dashboard и абсолютный `getBoundingClientRect().top`
не должны ошибочно попадать в editor animation. Фактическая формула может
учитывать borders/gaps/safe area и обязана clamp-ить stage к безопасной
неотрицательной высоте, но все mode-зависимые промежуточные значения выводятся
из одного geometry snapshot.

Во время running ResizeObserver:

- не запускает самостоятельный refit;
- может обновить/retarget `to`, если width/breakpoint реально изменился;
- игнорирует собственные ожидаемые промежуточные height notifications;
- помечает final natural measurement для settle verification.

Изменение только высоты stage, совпадающее с ожидаемым значением текущего
progress в пределах 1 CSS px, считается внутренним. Изменение width,
`100dvh`, external inset, font metrics или toolbar signature — внешнее и
создаёт один coalesced retarget на следующий RAF, но не новый observer/loop.

Context tray остаётся absolute overlay над stage и не участвует в формулах.

## 11. Background и paper

### 11.1. Resolved colors

До старта получить непрозрачные computed colors:

- View stage: current static/custom/day-night color;
- editor stage: computed target editor canvas color (сейчас `#ffffff`);
- View paper: текущий computed theme/pre-bg canvas color либо уже белый
  `.stage.noplan`;
- editor paper: computed target paper color (сейчас `#ffffff`);
- `sceneBrightness`: текущий day/night filter → target `1` в editor.

Controller не хардкодит белый повторно: CSS/design tokens остаются authority,
а endpoints читаются после target measurement как нормализованные opaque RGBA.
Colors интерполируются в sRGB либо через доказанно одинаковый CSS color
transition. В каждый момент stage, paper и brightness используют один
navigation token. Если endpoint colors одинаковы, лишняя animation property не
создаётся.

### 11.2. Day/night

На start короткая navigation transaction фиксирует текущий вычисленный sky
color. 45-секундный solar transition временно не конкурирует с ней.

На settle:

- при target View day/night получает актуальный цвет на текущий момент;
- длинная transition продолжает штатный lifecycle;
- не допускается возврат на pre-navigation color или `skysnap` flash;
- mode transition не пересчитывает sun geometry/rays на каждом кадре.

Sun rays являются View-only presentation layer: при входе в editor готовая
геометрия плавно уходит по layer weight, затем размонтируется; при выходе
геометрия вычисляется один раз для target View и плавно появляется. Смена
elevation во время 220 мс не запускает второй navigation transition; final
settle принимает самый свежий штатный sun snapshot.

### 11.3. Backdrop

Backdrop image не дублируется и не загружается заново. Меняются только
mode-specific opacity/handles. External image load/error не должен блокировать
navigation settle.

## 12. Layer transition contract

### 12.1. Core layers

Один DOM сохраняют:

- paper/backdrop;
- rooms/fills;
- walls/openings/partitions/columns;
- decor;
- Glow;
- devices и labels.

Они не перемонтируются только ради animation.

Это требование относится к тяжёлой общей сцене, а не запрещает временно
смонтировать лёгкую incoming presentation group. Условные ветки, которые
сейчас завязаны напрямую на `_editing/_mode` (grid, hover, rulers, handles,
sun rays), во время transition могут кратко сосуществовать как outgoing и
incoming группы. Обе получают opacity из `layerWeights`; outgoing немедленно
inert/`aria-hidden`, incoming становится интерактивной только после settle.
После settle остаётся ровно штатная target-ветка.

### 12.2. Mode-specific presentation

Crossfade применяется к presentation-группам/variables:

- View room hover/tooltips/links;
- Plan grid, selection, drawing preview, rulers;
- Devices ghosts, drag/selection affordances;
- Backdrop handles и 35% de-emphasis non-decor;
- editor-only hints/cursors.

Рекомендуемое распределение:

- outgoing alpha: `1 → 0` на progress `0…0.65`;
- incoming alpha: `0 → 1` на progress `0.25…1`;
- core scene всегда остаётся непрозрачной.

Это не жёсткая motion-дизайн константа; обязательны отсутствие blank frame и
понятный переход без длительного двойного UI.

### 12.3. Glow

Navigation не меняет:

- resolved source graph;
- source count;
- собственную center alpha/brightness источника;
- blend mode;
- 500-мс source fade generation;
- mask/occlusion geometry.

Glow движется только вместе с общей camera. Нельзя скрывать/recreate Glow для
ускорения transition без отдельного продуктового решения.

Исключение — уже существующий Backdrop-editor de-emphasis: wrapper
`.glow-base-layer/.glow-pools-frame` вместе с остальной архитектурой плавно
переходит `opacity 1 ↔ 0.35`. Это presentation opacity, а не изменение
source alpha, additive blending или Glow resolver. Для View ↔ Plan/Devices
wrapper opacity остаётся 1. Тесты сравнивают source graph/own alpha отдельно от
ожидаемого mode wrapper weight.

## 13. Retarget и прерывания

### 13.1. Быстрое переключение

Новый mode click во время running:

1. читает current presented state;
2. отменяет старый token;
3. измеряет новый target;
4. стартует новый tween без snap и очереди.

Retarget duration: максимум 220 мс, минимум 120 мс для очень малого остаточного
расстояния. Он не должен ощущаться медленнее обычного прямого перехода.

### 13.2. Смена пространства

Space navigation имеет приоритет:

- mode transition commit/cancel в безопасный target;
- старые nav classes/WAAPI/RAF очищаются;
- direction slide запускается один раз;
- editor/view viewport semantics нового пространства остаются действующими.

Поскольку смена пространства уже имеет собственный directional transition,
два движения не смешиваются. Если пользователь нажал space tab во время mode
tween, mode controller сначала atomically приводит current card к последнему
target mode и очищается; затем space transition стартует ровно один раз.
Обратный порядок запрещён.

### 13.3. Visibility и lifecycle

- `visibilitychange -> hidden`: commit в target без ожидания будущих frames;
- возврат не доигрывает старый tween;
- #73 recovery отменяет decorative navigation и становится единственным
  владельцем визуальной непрерывности;
- `disconnectedCallback()` очищает controller;
- warm remount не восстанавливает transition phase/classes;
- zero-size/unmeasured stage использует immediate safe commit.

Обычная mode navigation не вызывает recovery overlay и не объявляет каждый
intermediate frame новым complete continuity frame. Если recovery начинается
во время tween, controller делает safe target commit, после которого #73 может
удерживать этот цельный кадр. Промежуточный смешанный toolbar/background frame
не сохраняется как warm/complete snapshot.

Structural config/layout revision во время running либо передаётся #73, либо
делает immediate target commit до adoption. Старые geometry endpoints нельзя
интерполировать поверх новой модели.

### 13.4. Resize/breakpoint

Width resize или toolbar wrap retarget-ит geometry/camera от current frame.
Height notifications, порождённые самой transition, не считаются внешним
resize.

## 14. Интерактивность и фокус

Во время running:

- `.stage` inert и не принимает pointer/click/wheel/tool actions;
- header space/editor tabs остаются доступны;
- кнопки target toolbar могут стать интерактивными только после settle;
- tooltip/hover/context tray закрыты;
- нет click-through по старой позиции device/room/opening;
- touch gesture guard не интерпретирует завершающий tap как canvas click.

`inert` и `pointer-events` применяются к реальному stage owner, а не только к
одному `.zoomwrap`: context tray, HTML marker overlays и SVG hit geometry не
должны оставлять обходной интерактивный слой. Pointer capture активного gesture
освобождается до старта. `aria-busy="true"` на stage допустим, но live-region с
сообщением для каждого 220-мс перехода не нужен.

Обычный пользователь не может начать mode navigation из-под открытого
`hp-dialog`, потому что modal trap делает header inert. Если внутренний код
всё же запрашивает смену mode, он сначала завершает существующий dialog
lifecycle; controller не анимирует сцену невидимо под modal и не вмешивается в
restore-focus `hp-dialog`.

Focus:

- mouse click сохраняет focus на нажатой editor tab;
- keyboard activation также сохраняет focus на tab, пока toolbar не готов;
- после settle существующий focus contract применяется без принудительного
  прыжка, если focus всё ещё валиден;
- закрытие editor из toolbar возвращает focus к соответствующей header tab;
- уход в другой mode не оставляет focus в inert outgoing controls;
- screen reader получает одну смену active/aria-current состояния, а не два
  параллельных toolbar.

На coarse pointer сама декоративная плавность editor chrome является best
effort, но гарантируются: отсутствие synthetic click после pinch/cancel,
возможность одним действием вернуться в View, отсутствие случайного commit и
правильный конечный View frame. Эти четыре пункта release-blocking по
`docs/TOUCH-SUPPORT.md`.

## 15. Reduced motion

При `prefers-reduced-motion: reduce`:

- duration = 0;
- target toolbar измеряется скрыто;
- mode, geometry, camera, background и layers публикуются атомарно;
- отсутствуют scale/translate/fade;
- запрещён промежуточный `_view = null`/default fit кадр;
- focus/inert lifecycle выполняется в том же порядке;
- space/recovery contracts не меняются.

Если preference меняется во время running, controller немедленно commit target
и очищает animation state.

## 16. Ошибки и fallback

Если target measurement/animation API недоступны:

- применить immediate atomic commit;
- не оставлять stage hidden/transparent/inert;
- не показывать boot/recovery overlay;
- записать только dev diagnostic при включённом debug, без пользовательского
  toast;
- final viewport обязан соответствовать старому функциональному результату.

Ошибка transition никогда не отменяет mode change и не меняет config.

## 17. Производительность

На каждом animation frame разрешены:

- interpolation небольшого ModeVisualState;
- применение stage/editor geometry;
- построение одного camera viewBox;
- изменение CSS variables/opacity.

Запрещены:

- `buildDevices`/registry rebuild;
- geometry normalization/boolean operations;
- `resolvedLightSources` и Glow topology rebuild;
- config/layout save;
- DOM clone полного plan;
- повторная загрузка backdrop;
- создание новых ResizeObserver/listeners;
- несколько RAF loops.

Budget:

- один controller/clock;
- в видимой измеренной карточке завершение не позже target duration + двух
  реально доступных frames;
- отсутствие blank/black frame любой длительности;
- тяжёлый deterministic Glow fixture не меняет source count и frame
  fingerprint как structural reload.

## 18. Эдж-кейсы

- View zoom 1/3 и 8, сильный off-center pan;
- plan полностью вне visible viewport и home arrow;
- отсутствие rooms/content, fallback view_box;
- пространство с/без backdrop;
- hand-drawn `.noplan`, где View/editor colors уже одинаковы;
- day/night high/low sun и custom background;
- light/dark HA theme;
- Plan/Devices/Backdrop toolbar в RU/EN;
- ширины 420/559/560/719/720/721/899/900/1200 px;
- toolbar меняет число строк ровно во время transition;
- dashboard scroll/external HA toolbar меняет absolute card top, но не
  превращается в mode-dependent editor height;
- rapid View → Plan → Devices → Decor → View;
- editor switch во время предыдущего collapse;
- смена пространства внутри editor и немедленный exit;
- pointerdown/wheel/pinch на старте transition;
- dialog был открыт либо открывается из target toolbar;
- context tray/group submenu открыт;
- Escape/close-editor во время enter или editor swap retarget-ит переход в
  View от current presented frame;
- HA tab hidden через один frame после click;
- reconnect/config/layout revision во время running;
- reduced-motion preference изменился во время running;
- card disconnect/reconnect;
- kiosk;
- touch misclick regression;
- external backdrop image загружается или ошибается во время transition.

## 19. Тестирование

### 19.1. Unit

- state machine start/prepare/run/settle;
- token/generation guard и cleanup;
- current-frame retarget;
- easing start/mid/end и exact final values;
- endpoint viewBox → center/pixelsPerUnit и обратное преобразование;
- logarithmic screen scale при меняющемся stage aspect без letterbox;
- exact final `_zoom` пересчитывается только при settle относительно target
  content frame;
- same-space snapshot и cross-space View restore;
- stage/header geometry interpolation;
- reduced-motion atomic path;
- visibility/recovery/disconnect priority;
- `LS_ZOOM` schema остаётся прежней; editor не пишет её, View пишет только
  после target settle;
- measurement failure fallback.

Pure tests используют injected clock; wall-clock ожидания не нужны.

### 19.2. Browser smoke

Для View → Plan/Devices/Backdrop → View:

- start, минимум один intermediate frame и final;
- panel height и stage rect меняются монотонно;
- viewBox не проходит через default fit;
- каждый intermediate viewBox соответствует текущему stage aspect;
- final camera совпадает с old exact contract;
- background/paper имеют intermediate color и exact final;
- outgoing/incoming overlays не дают blank frame;
- stage inert, header tabs доступны.

Дополнительно:

- editor A → B с искусственно различной multi-row height;
- rapid four-way retarget;
- user View zoom+center round-trip;
- space changed inside editor;
- day/night handoff без flash;
- Glow source count/own source alpha стабильны; wrapper opacity остаётся 1 для
  Plan/Devices и монотонно приходит к/из 0.35 для Backdrop;
- pointer/device click не срабатывает по stale geometry;
- outgoing/incoming toolbar не дублируются в accessibility tree;
- coarse-pointer exit даёт корректный View и не создаёт synthetic click;
- reduced motion имеет zero animation, correct first visible frame;
- visibility/recovery/disconnect cleanup;
- responsive breakpoint change mid-transition.

Тесты не проверяют точный pixel в случайную wall-clock миллисекунду. Controller
должен предоставлять deterministic progress hook либо тестируемый clock.

### 19.3. Golden/screencast

Static golden недостаточен для движения. Нужны:

- deterministic screencast/trace start-mid-end для View ↔ каждого editor;
- light/dark и day/night/custom background;
- desktop + узкий multi-row layout;
- Backdrop de-emphasis;
- reduced-motion final frame;
- heavy Glow fixture.

Final frames продолжают проверяться golden-image инфраструктурой HP-QA-01.
Motion artifacts прикладываются из Linux CI, а не принимаются локально как
канонические.

## 20. Документация и release-артефакты

В реализации обновить:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой #101;
- `docs/UX-MODES.md` — пользовательский transition contract;
- `docs/CANVAS.md` — View/editor camera separation;
- `docs/ARCHITECTURE.md` — ModeTransitionController ownership;
- `docs/STYLING-HOOKS.md` — новые stable hooks и удалённые transient classes;
- `docs/TESTING.md` — browser/performance matrix;
- `docs/TOUCH-SUPPORT.md` — подтвердить safety-floor навигации без обещания
  parity редакторов;
- при необходимости developer note рядом с #82 о shared interpolation helper.

Release body: коротко как user-visible polish. Поставка сначала в beta.
Performance/screencast/full golden gate обязателен перед stable release.

## 21. План реализации

1. Вынести pure endpoint-viewBox/geometry interpolation primitives.
2. Реализовать ModeTransitionController с injected clock/token cleanup.
3. Разделить target mode и presented mode/layer weights; добавить hidden
   target-toolbar measurement.
4. Перевести View ↔ editor viewport restore на center + pixelsPerUnit без
   промежуточного `_view = null`.
5. Подключить panel/stage geometry к общему progress.
6. Ввести navigation variables для stage/paper/brightness/day-night handoff.
7. Сгруппировать mode-specific presentation и crossfade.
8. Удалить старые независимые nav CSS/WAAPI/timer paths.
9. Добавить inert/focus/retarget/lifecycle contracts.
10. Unit + browser + screencast + docs.
11. Beta rollout и проверка на тяжёлом реальном плане.

Шаги 4–8 не должны поставляться частично в stable: смешение старого и нового
owners снова создаст несогласованные timelines.

## 22. Критерии приёмки

- [ ] Один controller владеет View/editor transition и всеми его callbacks.
- [ ] View → Plan/Devices/Backdrop и обратно не содержит scale/center jump.
- [ ] Нет промежуточного default-fit кадра.
- [ ] Camera интерполируется в world center + screen pixels-per-unit; изменение
      editor content frame не меняет смысл промежуточного scale.
- [ ] Каждый промежуточный viewBox соответствует текущему aspect stage, а
      последний кадр равен exact canonical target.
- [ ] Toolbar, stage top/height и camera идут по одному timeline.
- [ ] Выход восстанавливает exact View zoom + center текущего пространства.
- [ ] Editor zoom не попадает в View persistence.
- [ ] Editor ↔ editor учитывает реальную responsive/multi-row height.
- [ ] Stage/paper плавно переходят между View background и editor white.
- [ ] Day/night продолжает работу после settle без flash/rollback.
- [ ] Mode-specific layers crossfade без blank/double-interactive frame.
- [ ] Glow source graph/own alpha и device state presentation не
      пересчитываются/не мигают; Backdrop de-emphasis меняет только wrapper
      opacity по контракту.
- [ ] Rapid navigation retarget-ится от current presented frame без очереди.
- [ ] Stage не принимает click по устаревшей геометрии; header остаётся
      доступным.
- [ ] Outgoing/incoming toolbar и layers не существуют одновременно в
      accessibility tree и не принимают input.
- [ ] Touch safety floor соблюдён: без synthetic click, случайного commit и
      stuck editor; возврат в View корректен.
- [ ] Reduced motion даёт atomic correct first frame без tween.
- [ ] Space switch, resize, hidden, recovery и disconnect полностью очищают
      старый transition.
- [ ] После settle нет RAF, WAAPI, timers, stale classes или temporary styles.
- [ ] Ошибка animation/measurement безопасно даёт функциональный immediate
      result.
- [ ] `LS_ZOOM` и config schema не изменены; center остаётся session-only.
- [ ] Unit, browser, screencast/golden и performance gates зелёные.
