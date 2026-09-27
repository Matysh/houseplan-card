# Issue #212 — размер, форма, нажатие и touch-hover маркеров устройств

- **Issue:** https://github.com/Matysh/houseplan-card/issues/212
- **Связанные issue, реализуемые целиком здесь:** #22, #154, #181
- **Приоритет:** P1
- **Тип:** bug/feature/polish, обычный трек
- **Пользовательское изменение:** да
- **Touch editor:** best effort / intentionally degraded

## 1. Сценарий

Домочадец смотрит план с телефона, настенной панели либо компьютера и нажимает
на устройство. Маркер должен занимать меньше места, точно показывать длинное
значение, сразу подтверждать принятую команду и не оставаться визуально
«наведённым» после tap. Администратор видит ту же геометрию в редакторе
устройств и его preview, не теряя сохранённую позицию или настроенный размер.

## 2. Что человек увидит до и после

До изменения новые маркеры выглядят крупнее требуемого, длинное значение имеет
эллиптическую внутреннюю плашку, команда может не дать немедленного ответа, а
touch иногда оставляет hover. После изменения маркер на 10% компактнее,
внутренняя и внешняя капсулы эквидистантны, выполненное действие даёт короткий
мягкий отклик, а hover существует только у настоящей мыши.

## 3. Проблема и подтверждённая причина

Аудит текущего `dev` подтвердил четыре независимых дефекта/пробела, которые по
решению владельца выпускаются одной задачей:

1. Общий renderer использует `--dev-size` как диаметр icon core и строит shell
   размером `1.26875 × core`. После перехода на пакет #179 итоговый marker
   footprint стал визуально слишком крупным; отдельной общей коррекции 0,9 нет.
2. `display: value` расширяет `.device-core` по тексту, но оставляет
   `border-radius: 50%`. Для широкого прямоугольника это эллипс. Внешний shell
   использует постоянный радиус, равный половине своей высоты, поэтому зазор
   между двумя формами меняется по дуге; это видно на скриншоте #212.
3. `_clickDevice()` выполняет action либо открывает surface, но не создаёт
   отдельного transient feedback между принятием input и новым HA state.
4. `_notePointer()` только навсегда защёлкивает статический `_touchSeen` и
   закрывает `_tip`. `_hoverRoom` продолжает устанавливаться из mouse events,
   View/shared CSS содержит негейтированные `:hover`, а настоящий mouse после
   touch не может вернуть hover без reload. Это подтверждает #154.

#181 также подтверждён: каноническое описание View hover находится в
`docs/UX-MODES.md`, а не в `docs/CANVAS.md`.

## 4. Нормативные источники и приоритет

При расхождении требования применяются в таком порядке:

1. тело #212 и прямое решение владельца выполнить здесь весь scope #22/#154/#181;
2. это ТЗ после зелёного SPEC-REVIEW;
3. дизайн-пакет #179 версии 1.1.1 и принятые уточнения #211;
4. `docs/SCOPE.md`, `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md` и
   `docs/USER-GUIDE.ru.md`;
5. текущая реализация как compatibility baseline.

Числа #212 новее старого ТЗ #22 и имеют приоритет: минимальный scale равен
`0.95`, а полный цикл длится `200 ms`. Остальной принятый продуктовый контракт
#22 перенесён в §§9–11 и не требует чтения незамерженной ветки той задачи.

## 5. Scope

В задачу входят:

- уменьшение полной визуальной геометрии каждого device marker на 10% поверх
  действующих global/per-device размеров;
- общий renderer full View/kiosk, Device preview и `houseplan-space-card`;
- исправление формы основного `display: value`;
- click/tap/keyboard feedback только реально исполняемых marker actions;
- confirmation, rapid repeat, reduced-motion и lifecycle feedback;
- единый instance-local pointer-modality contract для full card и эквивалентный
  локальный contract для интерактивной кнопки static card;
- room/device/opening/vacuum/header/dialog/shared-control hover в View;
- touch, pen, desktop mouse и hybrid touch → mouse;
- обновление канонических пользовательских/UX/testing документов;
- unit, source-contract, browser smoke, golden и performance evidence.

## 6. Не входит в задачу

- изменение дизайн-пакета, цветов, state priority, glyph viewport, pulse
  geometry, LQI thresholds или lock security;
- изменение сохранённых `icon_size`, marker `size`, `angle`, layout coordinates
  либо автоматическая migration конфигурации;
- optimistic смена HA state, icon, semantic color или `aria-pressed`;
- feedback для info/more-info, открытия редактора, ссылки, no-op, secure,
  unavailable/missing target либо отменённого жеста;
- новый пользовательский toggle интенсивности/длительности feedback;
- новая поддержка touch-редакторов сверх действующего safety floor;
- реализация room click-to-fit #152;
- закрытие #22, #154, #181 или #212 исполнителем;
- принятие golden baseline на Windows либо выпуск beta без команды владельца.

## 7. Уменьшение визуального размера на 10%

### 7.1. Формула

Пусть действующий размер до #212 равен:

```text
current = resolved card icon_size × resolved per-marker size
```

Новый визуальный base size:

```text
visual = current × 0.90
```

Коэффициент применяется после разрешения сохранённых настроек. Поэтому default,
явно заданный global `icon_size` и per-marker `size` уменьшаются одинаково на
10%, а их относительные различия сохраняются.

### 7.2. Что масштабируется

От нового visual base зависят:

- icon/value core, shell, glyph и text;
- Double/value/legacy sections;
- state/focus/selection rings, border widths и shadows;
- marker-owned LQI, disabled/new badges и activity geometry;
- vacuum puck, поскольку он использует уменьшенный package base icon;
- preview/static projection того же face.

Glow radius, room geometry, sun, decor, label font, plan camera и координаты не
масштабируются. Сохранённая точка остаётся центром icon core. Минимальная
интерактивная область остаётся не меньше 44×44 CSS px и не уменьшается вместе с
painted face.

### 7.3. Совместимость настроек

Значения в storage и UI не переписываются и не материализуются. Открытие и
сохранение старой настройки не добавляет множитель. House Plan применяет
визуальную коррекцию одинаково к старому и новому плану. Пользователь по-прежнему
может компенсировать размер существующими global/per-marker controls.

## 8. Геометрия `display: value`

Основной value marker остаётся Text shell из пакета #179:

- высота внутреннего core равна visual base size;
- ширина растёт по полному тексту и padding, без ellipsis;
- радиус внутреннего core равен половине его **высоты**, а не половине ширины;
- внешний shell повторяет ту же stadium/capsule форму с радиусом половины своей
  высоты;
- расстояние между core и shell равно package inset на прямых сторонах и на
  полукруглых торцах с допустимой растровой погрешностью не более 0,5 CSS px на
  QA-размерах 32, 56 и 96 px до коэффициента 0,9;
- сохранённый anchor остаётся в центре исходного icon core, а расширение идёт
  симметрично влево/вправо.

Исправление относится к основному `display: value`. Double value section уже
имеет нормативный фиксированный pill radius `0.39375 × core`; её форма не
переопределяется, кроме общего уменьшения 10%.

## 9. Кому показывается feedback

Источник истины — финальный outcome существующего action resolver/path, а не
icon, domain или одно наличие `tap_action`.

Feedback получает activation, который после всех guards:

- переключает хотя бы одну доступную HA target либо virtual light;
- выполняет допустимую cover operation;
- запускает разрешённый script/scene/automation action;
- отправляет другую уже поддерживаемую безопасную service command.

Feedback отсутствует, если activation:

- открывает House Plan info, HA more-info, Device editor, link или settings;
- только открывает confirmation и ещё не подтверждён;
- является secure/no-target/unavailable/missing/unsupported no-op;
- отменён pan, pinch, drag, long press, context click, вторым pointer,
  `pointercancel` либо потерей capture.

Для partial group достаточно одной реально dispatch-нутой target. При
confirmation feedback начинается только после положительного подтверждения и
повторной валидации target, одновременно с фактическим dispatch.

## 10. Визуальный contract нажатия

Один accepted action создаёт один цикл:

```text
scale 1.00 → 0.95 → 1.00; total duration 200 ms
```

- движение плавное, с minimum scale около середины цикла и без паузы;
- масштабируется только painted device body/shell относительно собственного
  центра; hit target, saved anchor, LQI, badges, activity waves и Glow не
  сжимаются и не сдвигаются;
- feedback композируется с общей коррекцией 0,9, per-marker size, angle,
  Text/Double layout и semantic state, не перезаписывая их transform;
- fill, glyph, semantic color, state ring, opacity и z-index не используются
  для имитации успешного HA state;
- цикл начинается в том же interaction turn, что dispatch, и не ждёт HA state;
- повторный отдельный action перезапускает один текущий цикл с реально видимого
  значения, не создавая очередь и не блокируя второй допустимый service call;
- state update не повторяет и не продлевает цикл.

Pointerdown потенциально actionable marker может сохранять обычный browser
pressed/active cue, но канонический цикл выше принадлежит только accepted
dispatch. Touch compatibility click и keyboard activation создают не более
одного цикла.

## 11. Keyboard, reduced motion и lifecycle feedback

- Enter/Space на интерактивном marker идут через тот же `_clickDevice()` и дают
  тот же цикл ровно один раз при dispatch.
- Focus и `:focus-visible` остаются видимыми во время/после feedback.
- При `prefers-reduced-motion: reduce` scale tween отсутствует. Accepted action
  получает краткий theme-safe outline/brightness accent минимум на один painted
  frame без смены semantic цвета или unavailable opacity.
- Быстрый mode/space change, visibility hidden, disconnect/remount и удаление
  marker отменяют незавершённую animation без остаточного class/style.
- Feedback не меняет action debounce, confirmation или service payload.

## 12. Pointer modality и sticky-hover

### 12.1. Authority

Каждый экземпляр интерактивной карточки имеет локальное состояние:

```text
unknown | mouse | touch | pen
```

- начальное `unknown` не включает pointer-only hover;
- настоящий `PointerEvent(pointerType='mouse')` включает `mouse`;
- `touch` и `pen` немедленно выключают CSS/JS hover и очищают transient state;
- следующий настоящий mouse/trackpad pointer event возвращает `mouse` без
  reload и без произвольного timeout;
- compatibility `MouseEvent` после touch не меняет authority;
- media query не является authority, но CSS hover разрешён только когда
  фактическая modality — `mouse` **и** среда сообщает hover/fine capability;
- modality не хранится, не синхронизируется между карточками и не живёт в
  global mutable singleton.

`houseplan-space-card` применяет тот же pure resolver в своём экземпляре для
footer button. Статический план остаётся pointer-inert.

### 12.2. Cleanup

Один idempotent helper очищает только transient hover:

- `_hoverRoom` и hover-owned `_tip`;
- DOM gate, разрешающий CSS hover;
- transient hover ownership вложенных shared components.

Он вызывается на touch/pen `pointerdown`, terminal `pointerup`/`pointercancel`,
`lostpointercapture`, начале/окончании multi-touch/pinch, terminal tap/click,
mode/space change, `visibilitychange` в hidden и disconnect. Cleanup не снимает
DOM focus, не закрывает dialog/help popover, не отменяет action, pointer capture
другого owner либо semantic/selected/pressed state.

### 12.3. JS room/device tooltip

- room hover использует pointer events либо delegated pointer path и записывает
  `_hoverRoom` только при разрешённой mouse modality;
- device/room tooltip не создаётся из touch/pen либо synthetic mouse;
- mouse leave очищает только state своего текущего target;
- следующий настоящий mouse move/enter заново hit-test-ит target, а не
  восстанавливает stale room/device id;
- будущий #152 обязан использовать canonical room hit resolver, а не
  `_hoverRoom`; #212 сам room click-to-fit не реализует.

## 13. CSS hover inventory

Все пользовательски заметные `:hover` в full card получают один явный
modality gate. Это включает:

- View rooms, device markers, openings, room labels/links/gears и vacuum;
- header tabs, zoom/settings buttons и kiosk/shared controls;
- shared menus/options/candidates/actions, close controls и links;
- `hp-dialog`, `hp-help` trigger и `hp-color-opacity` trigger, когда они
  используются внутри full card;
- footer action `houseplan-space-card`.

Rules, объединяющие `:hover` и `:focus-visible`, разделяются: hover требует
mouse gate, keyboard focus — нет. Alarm/working/open/lock/unavailable/selected
state не зависят от modality. Unavailable по-прежнему не получает visual hover.

Чисто editor-only handles могут оставаться best effort, но naked selector
допустим только если source-contract test документирует, что target никогда не
появляется в View/shared component. Предпочтительный безопасный вариант —
гейтить весь общий `cardStyles` единообразно, не меняя editor actions.

Открытый по click/tap `hp-help` popover остаётся намеренно toggled surface; его
жизненный цикл не считается hover. Гейт касается только визуального hover его
trigger.

## 14. UX, accessibility и touch policy

- View и kiosk на desktop/touch остаются блокирующими поверхностями.
- Device/Plan/Background editors остаются desktop-first; общие controls получают
  no-sticky-hover автоматически, но новая touch parity не обещается.
- Touch target marker не меньше 44×44 CSS px после уменьшения face.
- Accessible name, role, tabindex, focus order и secure confirmation не меняются.
- Screen reader announcement о feedback не добавляется: input принят, но HA
  ещё не подтвердил изменение состояния.
- Touch → dialog → close не возвращает hover marker из старого кадра.
- Pan, pinch, long press и pointer cancellation не запускают action/feedback и
  не оставляют hover.
- В Flat/hidden Isometric, light/dark и kiosk действует одна политика.

## 15. Данные, migration и i18n

Новых config/layout/localStorage/backend полей нет. Существующие размеры,
координаты, display, value, pulse, LQI и action settings round-trip без записи.
Migration не нужна.

Новых пользовательских строк не ожидается. Если реализация потребует строку,
это расширение scope: обязательны RU/EN parity и отдельное решение владельца.

## 16. Архитектурный contract и затронутые файлы

Обязательная цепочка сохраняется:

```text
HA/config state
  → resolveDevicePresentation
  → renderDeviceFace
  → one shared face geometry on full / preview / static surfaces

PointerEvent
  → one instance-local modality resolver
  → JS transient-hover owner + explicit CSS/child-component gate

accepted _clickDevice dispatch
  → one retargetable visual feedback owner
```

Ожидаемые файлы/модули:

- `src/device-face.ts` — общий face DOM только при необходимости отдельного
  press body;
- `src/styles.ts` — коэффициент 0,9, Text pill, press и gated shared hover;
- `src/houseplan-card.ts` — modality/cleanup, room tooltip, action feedback и
  lifecycle;
- новый малый pure helper `src/pointer-modality.ts` либо эквивалентный модуль;
- `src/hp-dialog.ts`, `src/hp-help.ts`, `src/hp-color-opacity.ts` — явный nested
  hover gate без собственного global detector;
- `src/space-card.ts` — локальный gate footer button и shared face parity;
- `src/hp-device-preview.ts`/`src/space-render.ts` — только если parity требует
  явной передачи, второй renderer запрещён;
- unit tests, targeted browser smokes, golden matrix и документация из §19.

Конкретное имя helper/class и выбор CSS attribute являются техническими
деталями. Нельзя создавать второй action resolver, второй device face renderer
или global session latch наподобие текущего `_touchSeen`.

## 17. Edge cases

- marker sizes 32/56/96 px до коэффициента 0,9, per-marker scale 0.5…3;
- короткое, длинное, кириллическое и CJK value, `0`, `false`, unit symbol;
- Text, Double right/left/top/bottom, legacy third section и LQI;
- active/alarm/lock/unlock/selected/focus/virtual/unavailable во время feedback;
- explicit pulse color/size, reduced motion и continuous pulse;
- click/tap с медленным HA, rejected Promise после dispatch и state update
  раньше окончания 200 ms;
- confirmation accept/cancel и target, изменившийся пока dialog открыт;
- rapid double action, touch compatibility click и Enter/Space;
- tap → dialog → close, long press, pan, pinch, second pointer,
  `pointercancel`, lost capture;
- touch-only browser, браузер с ложным `(hover: hover)`, hybrid touch → mouse;
- mouse pointer впервые входит без предварительного click;
- mode/space/visibility/remount во время hover либо press;
- два full card и static card на одной странице: modality одного экземпляра не
  изменяет другой;
- Light/Dark, Flat/hidden Isometric, View/kiosk/Device editor/static card.

## 18. Acceptance criteria

1. **AC1 — 10% geometry.** Painted core/shell/glyph/value/sections/rings/badges,
   marker LQI/activity geometry и vacuum puck имеют линейный размер `0.90 ± 0.005`
   от pre-#212 reference при одинаковых settings на full, preview и static
   surfaces. **Доказательство:** unit/source facts + computed-style browser
   smoke + reviewed 32/56/96 golden/reference matrix.
2. **AC2 — anchor и hit area.** Saved coordinates, Text/Double anchor и
   relative per-marker scale не меняются; интерактивный target остаётся минимум
   44×44 CSS px. **Доказательство:** unit geometry + full View browser smoke.
3. **AC3 — value capsule.** Широкий `display: value` имеет внутренний и внешний
   stadium radius по половине соответствующей высоты и равномерный inset с
   погрешностью ≤0,5 CSS px; полный текст не обрезан. **Доказательство:** exact
   style/layout assertions + long-value Light/Dark golden.
4. **AC4 — accepted feedback.** Реально dispatch-нутый click/tap/Enter/Space
   даёт один цикл `1 → .95 → 1` общей длительностью `200 ± 20 ms`, не ожидая HA
   state. **Доказательство:** fake-clock unit + desktop/touch/keyboard smoke.
5. **AC5 — точный gate действия.** Info/more-info/editor/link, secure/no-target/
   unavailable no-op, cancel confirmation и отменённый gesture не получают
   канонический цикл; accepted confirmation получает его при dispatch.
   **Доказательство:** resolver/outcome matrix + browser smoke.
6. **AC6 — composition и bounded lifecycle.** Feedback не меняет state colors,
   pulse, Glow, badges, LQI, angle, hit area или service payload; repeat
   retargets один effect без очереди, lifecycle cleanup не оставляет residue.
   **Доказательство:** unit lifecycle/composition + semantic-state smoke.
7. **AC7 — reduced motion и focus.** В reduce нет scale tween, accepted action
   виден минимум один frame через несемантический accent; focus-visible и DOM
   focus сохраняются. **Доказательство:** media-query/keyboard smoke + golden.
8. **AC8 — modality authority.** `unknown/mouse/touch/pen` переходы instance-local;
   touch/pen выключают hover, настоящий mouse возвращает его без reload,
   compatibility mouse не возвращает. **Доказательство:** pure unit matrix +
   real-touch/hybrid browser smoke.
9. **AC9 — JS hover cleanup.** После touch terminal event, cancel, lost capture,
   pinch, mode/space/hidden/disconnect `_hoverRoom` и hover-owned `_tip` очищены
   не позднее следующего painted frame. **Доказательство:** unit/source contract
   + browser state assertions.
10. **AC10 — CSS/nested hover.** В View/shared surfaces нет naked visual
    `:hover`; device/room/opening/vacuum/header/dialog/help/color/static-button
    styles требуют mouse gate, а focus/semantic state не требуют его.
    **Доказательство:** CSS inventory test + touch computed-style smoke.
11. **AC11 — desktop/hybrid parity.** Desktop mouse hover впервые включается на
    pointer entry и выглядит как до #212; hybrid touch → mouse восстанавливает
    текущий hit, не stale state. **Доказательство:** mouse/hybrid smoke + reviewed
    hover golden.
12. **AC12 — gesture и action safety.** Pan/pinch/long press/second pointer/
    pointercancel не вызывают ложный click, feedback или hover; secure lock и
    confirmation invariants не меняются. **Доказательство:** existing gesture
    and secure-action smokes + targeted regression.
13. **AC13 — surface parity.** Full View, kiosk, Device preview и static card
    используют один face contract; static plan остаётся non-interactive, Device
    editor остаётся desktop-first. **Доказательство:** renderer unit + named
    preview/static/kiosk smokes.
14. **AC14 — no data/i18n change.** Open → Save и serialization не меняют
    size/display/action data; backend и RU/EN key set неизменны.
    **Доказательство:** serialization/i18n unit + code review.
15. **AC15 — documentation address.** Hover/pressed/semantic ownership обновлён
    в `docs/UX-MODES.md`; `docs/CANVAS.md` не получает несвойственный раздел.
    **Доказательство:** docs diff + `check-docs`.
16. **AC16 — performance.** 200 markers не получают per-frame JS, per-marker
    media listener, layout loop либо рост постоянных animation layers; pointer
    move не вызывает full Lit render на каждый пиксель.
    **Доказательство:** source review + pre-beta performance profile.

## 19. План тестирования и release-артефакты

### 19.1. Цикл реализации до S7

Обязательны:

```bash
npm run typecheck
npm test
npm run build
node scripts/check-docs.mjs --external
```

Targeted browser smokes:

- расширенный `demo/smoke_device_icon_design.mjs` — 0,9 и value capsule;
- `demo/smoke_device_preview_parity.mjs`;
- `demo/smoke_static_icon.mjs`;
- `demo/smoke_state_value.mjs`;
- `demo/smoke_icon_scale.mjs`;
- новый/расширенный device action feedback smoke;
- расширенный `demo/smoke_touch_tips.mjs` либо отдельный real-touch hover reset;
- `demo/smoke_long_press_gesture.mjs`;
- secure confirmation/lock and opening/vacuum hover regressions.

Перед S7 нужны failing-before-fix доказательства как минимум для коэффициента
размера, value radius, accepted feedback и touch sticky-hover. Для критичных
guards добавляются mutation checks либо эквивалентное документированное
mutation proof.

### 19.2. Golden и visual QA

Проверить Light/Dark:

- state-table 32/56/96 с новым размером;
- длинный основной Value рядом с reference capsule;
- normal press midpoint и reduced-motion accent;
- desktop hover, post-touch no-hover и focus-visible;
- semantic active/alarm/selected во время feedback.

Локальный Windows capture диагностический. Baseline принимается только из
reviewed полного Linux CI artefact перед beta по release runbook.

### 19.3. Перед beta

Выполняются полный browser smoke, Linux golden и performance gates из
`HOUSEPLAN-CODEX-SESSION-RUNBOOK.md`. Полный HA harness каноничен в Linux CI
из-за `fcntl`.

### 19.4. Документация и changelog

User-visible implementation commit с `User-Visible: yes` одновременно обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #212;
- `docs/USER-GUIDE.ru.md` — меньший marker face, accepted-action feedback и
  отсутствие sticky hover;
- `docs/TOUCH-SUPPORT.md` — event-derived modality и hybrid contract;
- `docs/UX-MODES.md` — hover/pressed/semantic ownership, закрывая #181;
- `docs/TESTING.md` — named size/value/feedback/real-touch/hybrid evidence;
- документационные screenshots, если их source fingerprint/вид изменился.

`docs/CANVAS.md` не обновляется ради hover ownership. #22/#154/#181 не
закрываются и не получают `S8-merged` автоматически: владелец обработает их
после merge #212.

## 20. Риски и откат

| Риск | Мера |
| --- | --- |
| Пользовательские tuned sizes уменьшаются дважды | ровно один общий factor после resolver; computed parity tests |
| Press обещает успех вместо принятого input | неизменный semantic state; start только при dispatch |
| Scale ломает translate/angle/Text shell | независимый visual layer/individual transform + composition test |
| Touch compatibility event возвращает hover | PointerEvent authority + CSS gate, без timeout |
| Gate убирает keyboard focus | hover/focus selectors разделены |
| Cleanup снимает selection/action | helper владеет только `_tip`/`_hoverRoom`/gate |
| Две карточки влияют друг на друга | instance-local controller, без static singleton |
| Pointer move вызывает render storm | imperative host attribute/state transition only on modality change |
| Общий CSS пропускает nested shadow component | явный child property/attribute + source inventory |

Откат одним implementation revert возвращает прежний visual factor, value
radius, feedback и hover path. Данных, backend migration и rollback storage нет.
Возврат к sticky touch hover либо неверной value geometry не является
допустимым визуальным fallback.

## 21. План реализации

1. Добавить failing tests/fixtures для 0,9, value capsule, feedback и modality.
2. Вынести instance-local pointer modality/cleanup contract и подключить full
   card, nested shared components и static footer.
3. Перевести room tooltip/hover на gated pointer path и закрыть CSS inventory.
4. Применить один visual factor к shared face, сохранив 44×44 hit/anchor.
5. Исправить радиус основного Value core.
6. Подключить один retargetable 200 ms feedback в фактические dispatch points.
7. Обновить docs/changelogs/screenshots и выполнить цикл §19.1.
8. Передать один полный диапазон #212 в S7; linked issue не закрывать.

## 22. Принятые технические предположения

Следующее принято предположительно и может быть свободно изменено ревьюером без
нового продуктового решения, если сохраняются AC:

1. Factor 0,9 реализуется одной CSS custom property в общем face, а не
   переписыванием config defaults.
2. Value capsule исправляется постоянным радиусом `visual core / 2`.
3. Pointer modality живёт в малом pure resolver; DOM hover gate меняется
   императивно только при смене состояния, без requestUpdate на каждый move.
4. Nested shadow components получают boolean/attribute от owning full card и не
   создают собственный global listener.
5. Press feedback может использовать Web Animations API либо отдельную inner
   shell property, если поддерживает restart/cancel и не меняет hit geometry.
6. Smooth 200 ms curve может использовать package easing
   `cubic-bezier(.22,.61,.36,1)`; exact easing не является config surface.
7. Reduced-motion accent использует существующий theme/focus token и один
   painted-frame owner, не новую пользовательскую строку.
8. Формулировка #22 `plan-wide setting` означает одну общую политику feedback
   для всех actionable markers плана, а не новую пользовательскую настройку
   либо per-marker override.
