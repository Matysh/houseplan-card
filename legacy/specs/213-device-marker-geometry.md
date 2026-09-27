# Issue #213 — геометрия, размеры, LQI и hover маркеров устройств

- **Issue:** https://github.com/Matysh/houseplan-card/issues/213
- **Связанные завершённые задачи:** #179, #211, #212
- **Нормативный дизайн-пакет:** архив #179, версия 1.1.1
- **Тип:** bug / polish, обычный трек
- **Пользовательское изменение:** да
- **Touch editor:** best effort / intentionally degraded

## 1. Сценарий и персона

**Персона:** домочадец или гость, который читает состояние дома в View/kiosk,
и администратор, который проверяет те же маркеры в редакторе устройств.

**Сценарий:** пользователь меняет масштаб плана либо открывает House Plan на
экране с другим DPR и ожидает, что круг, внешний shell и MDI-глиф останутся
визуально соосными. Маркер со значением должен реагировать на мышь по всей
видимой капсуле, LQI — снова менять цвет плавно, а замок рядом с дверью —
выглядеть как Lock/Unlock из принятого пакета #179.

## 2. Что человек увидит до и после

До изменения на отдельных масштабах внутренний элемент выглядит сдвинутым на
один пиксель относительно кольца, MDI-глиф маловат, дверной замок живёт в старой
визуальной системе, LQI перескакивает между тремя цветами, а часть видимой
капсулы не включает hover. После изменения все концентрические слои остаются
визуально по центру, фактический размер маркера не меняется, глиф становится на
10% крупнее, LQI снова использует плавную шкалу, дверной замок соответствует
#179, а вся капсула является общей областью hover и действия.

## 3. Проблема и подтверждённые причины

Текущий renderer после #212 вычисляет core так:

```text
resolved card size × per-marker scale × --device-visual-factor(0.9)
```

Затем shell, border и padding рассчитываются отдельными дробными выражениями.
Flex layout позиционирует core через независимо округлённые shell/padding/border.
На проверенной матрице браузерных размеров геометрические центры отличаются на
layout quantum; на отдельных scale/DPR антиалиасинг превращает его в заметную
асимметрию на один физический пиксель. Постоянный `translate(1px)` исправил бы
только один случай и сломал соседние размеры.

Дополнительно подтверждено:

1. общий `--device-visual-factor: 0.9` остаётся отдельным поздним множителем;
2. MDI viewport равен `0.5 × core`;
3. opening lock использует старый компактный круг, зелёный locked и не использует
   shell/core Lock/Unlock пакета #179;
4. `.device-shell` не владеет pointer hit testing, а круглая `dev::before`
   область не покрывает вытянутую часть `with-values`;
5. `markerLqiColor()` после #179 возвращает три фиксированных цвета, хотя общий
   `lqiColor()` уже содержит прежний непрерывный red→green HSL-gradient.

Текущий smoke проверяет отношения размеров на 32/56/96 px, но не прогоняет
дробную матрицу, несколько DPR и pixel-centroid симметрию.

## 4. Нормативные источники и приоритет

При расхождении применяются:

1. решения владельца в теле #213 и последующих комментариях;
2. это ТЗ после зелёного SPEC-REVIEW;
3. дизайн-пакет #179 версии 1.1.1 и принятые уточнения #211;
4. контракты #212 для фактического размера, 44×44 hit area и pointer modality;
5. `docs/SCOPE.md`, `docs/TOUCH-SUPPORT.md`, `docs/UX-MODES.md` и пользовательское
   руководство;
6. текущая реализация как compatibility baseline там, где источники выше ничего
   не меняют.

SVG Lock/Unlock из #179 нормативны по форме, отношению shell/core, глифу, цветам,
stroke и shadows. Как и в #179/#211, production использует динамический DOM/MDI,
а не включает reference SVG в runtime bundle. Для Dark применяется принятый
No-Blur fallback; owner override Dark Unlock остаётся amber.

## 5. Цели

1. Убрать scale-зависимое визуальное расхождение центров shell/core/glyph.
2. Удалить отдельный поздний коэффициент `0.9`, сохранив текущие фактические
   размеры всех существующих настроек и поверхностей.
3. Увеличить базовый MDI viewport на 10% без отдельного glyph multiplier.
4. Перевести opening Lock/Unlock на принятую визуальную систему #179 без
   изменения security/action contract.
5. Сделать всю видимую value/legacy capsule общей областью hover и действия.
6. Вернуть marker LQI прежнюю плавную цветовую шкалу, меняя только цвет.

## 6. Scope

В задачу входят:

- общий device face в full View/kiosk, Device editor/preview и
  `houseplan-space-card`;
- base-size resolution и fallback/default bases, включая vacuum puck;
- круглый Icon, основной Text и Double/value/legacy sections;
- MDI glyph viewport для динамических и пользовательских MDI-иконок;
- opening lock badge в View и его light/dark/locked/unlocked/unknown projection;
- marker-only LQI color;
- instance-local mouse hover для полной внешней капсулы;
- unit/source-contract, browser smoke, visual/golden и performance evidence;
- пользовательская, архитектурная и testing-документация.

## 7. Не входит в задачу

- изменение сохранённых координат, `icon_size`, per-marker `size`, angle,
  display/value/action либо backend schema;
- изменение фактического внешнего размера marker относительно v1.65.0-beta.8;
- изменение размера core/shell из-за увеличения MDI-глифа;
- новые пользовательские scale, LQI или hover настройки;
- изменение источника, агрегации, форматирования, доступности либо числового
  значения LQI;
- изменение low/mid/high категорий в aria-label/data attributes;
- изменение непрерывной комнатной LQI-заливки;
- новый hover на touch/pen, sticky hover или новая touch-editor parity;
- изменение lock service calls, подтверждения Unlock либо secure invariant;
- backdrop-filter на marker/opening lock;
- принятие golden baseline на Windows или выпуск без команды владельца.

## 8. Контракт размеров

### 8.1. Удаление позднего `0.9`

После изменения `.dev` и vacuum puck не содержат
`--device-visual-factor`, эквивалентного post-resolution multiplier либо цепочки
`resolved × 0.9` внутри face geometry.

Размер, переданный общему face как base, уже является текущим effective base.
Для v1.65.0-beta.8 reference:

```text
new effective core = current effective core
new effective shell = current effective shell
new effective puck = current effective puck
```

Это выполняется для default card, явного `icon_size`, kiosk multiplier,
per-marker `size`, preview и static card. Числовые пользовательские значения и
их относительные отношения не меняются. Нормализация legacy public size units,
если она нужна для совместимости, принадлежит единой границе base resolution;
внутри face нет второго коэффициента.

Base constants меняются на текущие effective values: fallback full/static,
preview и vacuum используют уже уменьшенные значения. Запрещено сохранять
старые bases и маскировать их новым переименованным `0.9` в CSS.

### 8.2. MDI-глиф

Базовый viewport MDI меняется с `0.50 × core` на `0.55 × core`. Это изменение
самого base ratio, без `--glyph-factor`, вложенного `scale(1.1)` либо второй
трансформации.

Правило одинаково для default, custom MDI и state-swapped glyph; marker angle
по-прежнему вращает глиф вокруг центра. Core, shell, anchor, pulse и hit area от
увеличения glyph не меняются. Reference/runtime matrix должна подтверждать, что
глиф не клиппится на минимальном размере.

### 8.3. Совместимость

- storage/card config не переписывается;
- Open → Save не материализует новые поля или bases;
- default и явно настроенные marker sizes сохраняют текущий pixel result с
  допуском layout quantum;
- relative ratio между двумя разными per-marker size остаётся прежним;
- координата остаётся центром icon core;
- минимальная интерактивная область остаётся не меньше 44×44 CSS px.

## 9. Контракт соосности и растеризации

### 9.1. Геометрия

Shell и core круглого marker строятся от одной координаты центра. Позиция core
не выводится из независимо округлённой суммы left/top padding и border.

Для Text/Double/value/legacy shell:

- сохранённая точка остаётся центром icon core;
- прямые стороны и полукруглый торец сохраняют inset пакета;
- core и соответствующий ему круглый конец внешней capsule имеют общий центр;
- расширение секций идёт только в выбранную сторону;
- смена стороны не меняет anchor.

Допустимы CSS grid, явные tracks, общий concentric pseudo-layer либо другой
layout без per-size special cases. Запрещены hardcoded `translateX/Y(1px)`,
таблица исключений по viewport и UA/DPR sniffing.

### 9.2. Проверяемая симметрия

На матрице base core от 24 до 112 CSS px, включая дробные значения с шагом не
крупнее 0.25 px, и DPR `1`, `1.25`, `1.5`, `2`:

- DOM-centres core и его shell-end отличаются не более чем на один browser
  layout quantum;
- на изолированных solid diagnostic слоях alpha/color-weighted centroid
  расходится не более чем на половину CSS-пикселя плюс один anti-alias quantum
  (`DPR / 2 + 0.1` физического пикселя), а центр дискретного painted support —
  не более чем на один физический raster pixel; это откалиброванные пределы
  смены чётности диаметров, а не допуск устойчивого смещения на один
  CSS-пиксель;
- противоположные видимые inset не дают устойчивой однопиксельной ступени;
- проверка умеет покраснеть на v1.65.0-beta.8 либо на документированном mutant,
  восстанавливающем прежний layout.

Golden остаётся визуальным доказательством на выбранных failing-before-fix
размерах; один DOM `getBoundingClientRect()` без pixel check недостаточен.

## 10. Opening Lock/Unlock

### 10.1. Известные состояния

Значок замка у двери/ворот использует визуальный контракт Lock/Unlock #179:

- package shell/core ratio и concentric geometry;
- Locked: black/`#252525` theme projection и белый locked glyph;
- Unlocked: amber `#F0A00C`, с theme-specific glyph из принятого reference;
- Light/Dark stroke, inner shadow и external shadows из #179/#211;
- Dark No-Blur production fallback;
- корректный closed/open lock MDI path, а не перекраска одного glyph.

Opening badge сохраняет нынешний компактный общий footprint, позицию возле
створки и способ вычисления offset. Package ratios применяются внутри этого
footprint; он не превращается в полноразмерный device marker и не участвует в
device layout/declump.

### 10.2. Unknown и действия

Unknown/unavailable сохраняет нейтральный `lock-question` смысл, но использует
тот же новый shell/core каркас без ложного locked/unlocked цвета.

Клик по opening badge только открывает карточку проёма. Lock выполняется лишь
явной кнопкой карточки, Unlock — после подтверждения. Pointer/keyboard paths
маркеров устройств не получают нового lock action. Скрытый/disabled/missing
exact opening reference ведёт себя по прежним #117 правилам.

## 11. Hover и действие всей внешней capsule

Для `.device-shell.with-values` видимая border-box capsule целиком является
mouse-hover областью, включая:

- core;
- промежуток между core и value section;
- value/legacy sections;
- внутренний padding до внешнего stroke;
- все четыре направления right/bottom/left/top.

Над любой точкой capsule активируются те же visual hover, z-index и tooltip,
что над core. Click/tap, long press и действие marker также работают по всей
видимой capsule, включая value/legacy sections и промежутки; используется тот
же action, confirmation и security contract, что у core. Hover остаётся
instance-local и разрешён только canonical
`data-pointer-hover` после настоящей fine mouse. Touch/pen и compatibility mouse
не включают и не оставляют hover; unavailable по-прежнему не получает visual
hover.

Минимальный core-centred target 44×44 сохраняется, но больше не является
единственной action-областью для вытянутого marker. Keyboard path остаётся на
самом marker и выполняет то же действие независимо от наличия sections.

Preview воспроизводит визуальный hover при переданном mouse gate, но остаётся
неинтерактивным. Static plan marker остаётся read-only; его footer button не
имеет отношения к этой capsule.

## 12. Плавный marker LQI

Цвет числа LQI снова использует прежнюю непрерывную функцию:

```text
<= 40  → hue 0 (red endpoint)
40..180 → linear hue 0..120
>= 180 → hue 120 (green endpoint)
```

Нормативный output совпадает с общим `lqiColor()`:
`hsl(round(hue), 85%, 55%)`. Внутри диапазона соседние значения меняют hue
плавно; на бывших границах `40/41` и `179/180` нет перехода между отдельными
palette colors.

Меняется только `presentation.lqiColor` marker. Сохраняются:

- resolved average/source и число;
- `show_signal`, отсутствие missing/unavailable подписи и LQI=`0`;
- low/mid/high `lqiBand` для понятного aria-label и data attributes;
- позиция строки под shell и Double-bottom offset;
- room fill gradient и room tooltip color.

Три package цвета #179 больше не являются нормативом для marker LQI, но
остаются semantic colors других состояний и pulse.

## 13. UX, accessibility и touch

- View и kiosk на desktop/touch остаются release-blocking;
- essential state/action не зависит от hover;
- focus-visible не зависит от mouse gate;
- aria-label продолжает содержать число LQI и категорию low/mid/high;
- увеличение glyph не меняет accessible name/role/tab order;
- opening lock сохраняет существующий понятный glyph и click-to-info;
- Device editor остаётся desktop-first, а его touch safety floor не меняется;
- pan/pinch/long press/pointercancel не создают hover или action.

## 14. Данные, migration и i18n

Новых config/layout/localStorage/backend полей нет. Schema и сериализация не
меняются, data migration не нужна. Existing card/marker size values должны
читаться с тем же фактическим результатом.

Новых пользовательских строк не ожидается. Существующие RU/EN LQI a11y bands
сохраняются; изменить нужно только описание цветовой шкалы в руководствах. Если
реализация потребует новый текст, обязательна RU/EN parity без расширения
пользовательских настроек.

## 15. Архитектурный контракт

```text
card config / marker scale / surface base
  → one resolved effective base size
  → resolveDevicePresentation
  → renderDeviceFace
  → one concentric face geometry on full / preview / static

resolved marker LQI
  → continuous marker color + unchanged semantic band
  → shared full / preview / static face

opening exact lock state
  → shared #179 lock visual tokens/geometry
  → opening badge → click opens info only

real mouse modality
  → full capsule hover owner
  → visual hover + tooltip

full capsule pointer target
  → existing marker action / confirmation / long press
```

Ожидаемые зоны изменений:

- `src/styles.ts` — base values, concentric layout, glyph base ratio, capsule
  hover и opening-lock tokens;
- `src/device-presentation.ts` — continuous marker LQI color при сохранённом band;
- `src/device-face.ts` — только если нужен явный hover/action layer;
- `src/houseplan-card.ts` — resolved full base, opening lock DOM и hover owner;
- `src/space-render.ts`, `src/hp-device-preview.ts` и vacuum styles — только для
  base/parity wiring, второй renderer запрещён;
- unit/source tests, targeted smokes, reference capture, docs и changelogs.

Нельзя вводить второй device face renderer, отдельную LQI-функцию с другой
формулой, global pointer latch, per-marker ResizeObserver или per-frame JS.

## 16. Edge cases

- default и explicit global `icon_size`, kiosk scale и per-marker 0.5…3;
- base 24…112 px, дробные quarter-pixel значения, DPR 1/1.25/1.5/2;
- Light/Dark hot switch и цветной план;
- Icon, Text, Double right/left/top/bottom и legacy third section;
- длинное значение, CJK/кириллица, `0`, `false` и unit;
- selected/focus/active/alarm/virtual/unavailable вместе с новой geometry;
- custom MDI, rotated glyph и state-swapped lock/cover/light icons;
- opening lock locked/unlocked/locking/unlocking/unknown/unavailable;
- opening у двери и ворот, hidden openings и registry-less exact lock;
- LQI `0`, `1`, `39`, `40`, `41`, `42`, `178`, `179`, `180`, `181`, `255`,
  missing и value badge, который сам показывает LQI;
- mouse впервые входит с capsule section, touch→mouse hybrid, pointerleave,
  space/mode/hidden/disconnect cleanup;
- two cards on one page and non-interactive preview/static surfaces;
- 200 markers without added layout loop/compositor layer.

## 17. Acceptance criteria

1. **AC1 — size contract.** Отдельный `--device-visual-factor`/эквивалентный
   late multiplier удалён; default, explicit global/per-marker, kiosk, preview,
   static и vacuum сохраняют effective v1.65.0-beta.8 size с допуском одного
   layout quantum. **Доказательство:** source/unit facts + computed-style browser
   matrix + reference capture.
2. **AC2 — glyph.** MDI viewport использует прямой base `0.55 × core`, без
   дополнительного multiplier/transform; core/shell/anchor не меняются и glyph
   не клиппится. **Доказательство:** source assertion + icon/custom/rotation
   browser smoke + 32/56/96 reference.
3. **AC3 — concentric geometry.** Icon/Text/Double shell-end и core выполняют
   §9 на дробной size/DPR matrix; нет hardcoded pixel compensation.
   **Доказательство:** DOM-centre assertions + pixel-centroid smoke, красный до
   фикса или на documented mutant + reviewed golden.
4. **AC4 — anchor/parity.** Saved coordinate, side anchor, relative scale,
   Text expansion и 44×44 minimum action area не меняются на full, preview и
   static surfaces. **Доказательство:** unit layout facts + preview/static/icon
   scale smokes.
5. **AC5 — opening locks.** Door/gate locked и unlocked совпадают с #179 по
   package layers/tokens в Light/Dark при сохранённом compact footprint;
   unknown нейтрален. **Доказательство:** reference/runtime visual matrix +
   opening browser smoke/golden.
6. **AC6 — lock security.** Opening badge только открывает info; lock/unlock
   service и confirmation invariant не меняются, disabled/missing references не
   рисуют ложный action. **Доказательство:** existing opening binding,
   registry-less, lock-action и lock-invariant smokes.
7. **AC7 — capsule hover.** На всех четырёх позициях любая точка внешней
   capsule включает один mouse visual hover/z-index/tooltip; unavailable,
   touch/pen и compatibility mouse не включают его. **Доказательство:** real
   PointerEvent desktop/hybrid browser smoke + computed styles.
8. **AC8 — action всей capsule.** Click/tap по value/legacy section и
   промежутку выполняет то же marker action, что core; confirmation, secure
   invariant и gesture safety сохраняются. Core-centred target остаётся не
   меньше 44×44. **Доказательство:** four-side pointer target/action-count smoke.
9. **AC9 — continuous marker LQI.** Marker color совпадает с `lqiColor()` на
   representative и boundary-adjacent values; 40/41 и 179/180 не используют
   дискретные palette jumps. **Доказательство:** pure boundary/dense-range tests
   + browser computed color.
10. **AC10 — only color changes.** LQI text/source/format/visibility/position,
    low-mid-high aria/data band и room fill/tooltip gradient не меняются.
    **Доказательство:** presentation/a11y unit + existing room fill regression.
11. **AC11 — data/i18n compatibility.** Schema, saved settings и RU/EN key set
    не меняются; Open → Save не материализует defaults. **Доказательство:**
    serialization/i18n unit + code review.
12. **AC12 — performance.** Нет per-frame JS, per-marker observer/media listener,
    backdrop-filter, UA/DPR sniffing либо роста постоянных animation layers;
    200-marker budget не ухудшен материально. **Доказательство:** source review
    + pre-beta performance smoke.
13. **AC13 — release artifacts.** Оба changelog, RU/EN guide, architecture,
    testing, targeted smoke/reference и visual fingerprints актуальны.
    **Доказательство:** docs diff + `check-docs` + release review.

## 18. План автотестов

### 18.1. Цикл реализации

```bash
npm run typecheck
npm test
npm run build
node scripts/check-docs.mjs --external
```

Unit/source coverage:

- отсутствие late 0.9 factor и наличие canonical effective bases;
- direct glyph base 0.55;
- shared concentric layout contract без fixed pixel nudge;
- dense continuous LQI color и неизменный band/a11y;
- opening-lock state/token projection;
- hover/action ownership inventory;
- config/i18n parity.

### 18.2. Targeted browser smoke перед S7

Обязательны:

- расширенный `demo/smoke_device_icon_design.mjs`;
- новый либо отдельный pixel-alignment smoke с fractional size/DPR matrix;
- `demo/smoke_device_preview_parity.mjs`;
- `demo/smoke_static_icon.mjs`;
- `demo/smoke_icon_scale.mjs`;
- `demo/smoke_state_value.mjs`;
- capsule hover/action smoke для четырёх badge positions;
- `demo/smoke_touch_tips.mjs` и hybrid pointer regression;
- `demo/smoke_opening_binding.mjs`;
- `demo/smoke_registryless_opening.mjs`;
- `demo/smoke_lock_action.mjs` и `demo/smoke_lock_invariant.mjs`.

До исправления требуется зафиксировать красное доказательство минимум для
alignment, late 0.9 source contract, glyph 0.50, opening-lock visual, capsule
hover и categorical marker LQI. Critical guards получают mutation proof либо
эквивалентное documented failing-before-fix сравнение.

### 18.3. Golden и pre-beta

Light/Dark golden/reference matrix включает:

- 32/56/96 и выбранные дробные failing sizes;
- Icon, Text, Double four-side/legacy;
- default/hover/focus/active/alarm/virtual/unavailable;
- custom/rotated glyph;
- opening Lock/Unlock/Unknown рядом с SVG #179;
- LQI low-end, несколько промежуточных оттенков и high-end;
- desktop hover и post-touch no-hover.

Windows capture диагностический. Baseline принимается только из reviewed полного
Linux CI artifact. Перед beta выполняются full smoke, golden и performance gates
по release runbook; backend не затронут.

## 19. Риски и меры

| Риск | Мера |
| --- | --- |
| Удаление 0.9 увеличит custom sizes | effective-size matrix для default/explicit/kiosk/per-marker до и после |
| Новый layout сдвинет anchor или side capsule | shared anchor facts и four-side smoke |
| Pixel тест окажется привязан к платформе | DOM invariant + alpha centroid; golden canon только Linux |
| Больший glyph клиппится у сложного MDI path | representative custom/state-swapped matrix на min size |
| Opening lock станет слишком крупным | сохраняется текущий compact footprint, меняются внутренние ratios |
| Capsule даст двойной action через bubbling | единый handler на marker и action-count smoke |
| Continuous marker LQI затронет room fill | reuse `lqiColor`, отдельный marker projection и room regression |
| Refactor добавит layout/compositor cost | CSS-only geometry, no observers/blur, pre-beta performance |

## 20. Откат

Откат одним implementation revert возвращает прежний layout, factor, glyph,
opening badge, hover и marker LQI colors. Миграции данных нет, поэтому storage
rollback не нужен. Golden baseline возвращается только через нормативный reviewed
Linux artifact, не ручным принятием Windows capture.

## 21. Release-артефакты

В user-visible implementation commit одновременно обновляются:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` со ссылкой на #213;
- `docs/USER-GUIDE.md` и `docs/USER-GUIDE.ru.md`: effective size без отдельного
  factor, glyph, smooth marker LQI, opening lock и capsule hover;
- `docs/ARCHITECTURE.md`: base-size boundary, shared concentric face и
  marker-LQI band/color separation;
- `docs/TESTING.md`: fractional/DPR pixel alignment, lock reference и
  hover/action/LQI regressions;
- reference/golden/source fingerprints и screenshots, если их источник изменён.

Release note: исправлено центрирование новых маркеров на разных масштабах,
увеличены внутренние глифы, дверные замки приведены к новому дизайну, hover
охватывает всю капсулу, а LQI снова использует плавную цветовую шкалу. Сначала
beta; stable — только после promotion rule.

## 22. План реализации

1. Добавить failing source/unit/browser guards для шести подтверждённых проблем.
2. Перенести current effective sizes на единую base-resolution boundary и
   удалить late factor из face/puck.
3. Перестроить concentric shell/core tracks и увеличить direct glyph base.
4. Подключить full-capsule hover и существующий marker action к единому target.
5. Вернуть continuous marker LQI color при неизменном band/a11y.
6. Перевести opening lock на #179 tokens/geometry, сохранив compact footprint и
   security path.
7. Обновить parity surfaces, docs/changelogs/reference fixtures.
8. Выполнить fast gates и все named smokes §18.2, затем передать в S7.
9. Перед beta выполнить полный Linux golden/smoke/performance gate.

## 23. Принятые технические предположения

Следующее принято предположительно и может быть изменено ревьюером без нового
продуктового решения, если все AC сохраняются:

1. Opening lock сохраняет нынешний компактный footprint и offset; #179 задаёт
   его внутренние proportions/tokens, а не новый абсолютный размер.
2. Unknown opening lock использует package shell/default theme и текущий
   `lock-question`, потому что архив не содержит отдельного Unknown asset.
3. По уточнению владельца во время реализации вся видимая capsule является и
   hover-, и action-target; отдельного hover-only слоя нет.
4. Low/mid/high band остаётся только semantic/a11y facet; цвет независимо
   разрешается общей continuous `lqiColor()`.
5. Base compatibility может нормализоваться один раз на границе surface size,
   но внутри `.dev`, puck и face запрещён любой поздний 0.9-equivalent factor.
6. Pixel-centroid smoke использует controlled solid background, изолированные
   solid shell/core слои и color/alpha segmentation. Совместный тонкий annulus
   не используется для centroid: вычитание большой core-площади усиливает
   обычный edge-AA. Предел weighted-centroid `DPR / 2 + 0.1` и предел painted
   support в один физический raster pixel получены на матрице DPR и дополняются
   нулевым DOM-center delta и mutant на 1 CSS px; это не browser whitelist.
7. Общий concentric layout предпочтительнее размера, округлённого через CSS
   `round()`: последний зависит от поддержки WebView и не решает shared-center
   invariant сам по себе.
