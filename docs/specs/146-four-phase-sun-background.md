# Issue #146 — четырёхфазный фон «Следует за Солнцем»

Статус: **ТЗ на ревью**  
Дата: 2026-08-14  
Тип: `feature` · приоритет: `P1` · пользовательская ценность: 7/10 · сложность/риск: 8/10

Issue: [#146](https://github.com/Matysh/houseplan-card/issues/146)  
Ветка: `issue/146-four-phase-sun-background`  
Канонические документы: [SCOPE](../SCOPE.md), [SUN](../SUN.md),
[UX-MODES](../UX-MODES.md), [TOUCH-SUPPORT](../TOUCH-SUPPORT.md),
[ARCHITECTURE](../ARCHITECTURE.md),
[CONFIG-COMPATIBILITY](../CONFIG-COMPATIBILITY.md).

Текст issue имеет приоритет над приложенными к нему `SPECIFICATION.md`,
`README.md` и интерактивным прототипом. Решения владельца Q1–Q3 и все defaults
приняты 2026-08-14 в issue #146.

## 1. Сценарий и продуктовый контекст

Основная персона — человек, который ежедневно смотрит на дом в View либо на
настенной kiosk-панели и должен одним взглядом узнавать сам план и текущее
состояние дома. Фон вокруг плана даёт спокойный временной контекст, но не имеет
права искажать цвета пола, стен, Glow, устройств или других данных.

Это часть J1 из `docs/SCOPE.md`: House Plan существует прежде всего как
правдивый пространственный обзор дома. Новая функция декоративна, поэтому она
не становится единственным носителем состояния и не меняет доступность
управления. View и kiosk остаются полностью поддержанными touch-поверхностями.

## 2. Что человек увидит до и после

**До:** режим `daynight` непрерывно интерполирует один сплошной цвет по высоте
Солнца, требует настроенный север, а ночью уменьшает яркость всего плана до
10 %. У новых установок и пространств режим не включён автоматически.

**После:** вокруг неизменного плана отображается одно из четырёх узнаваемых
окружений — рассвет, день, сумерки или ночь. Между фазами за 1100 ms плавно
меняются только градиент окружения, декоративный солнечный свет, внешняя
виньетка и alpha-aware контур плана. При доступном `sun.sun` состояние и свет
следуют реальному Солнцу; иначе работают по локальным часам браузера. Новые
установки и новые пространства начинают с режима «Следует за Солнцем», старые
неявные настройки сохраняют прежний статический вид.

## 3. Проблема и подтверждённая техническая база

1. `src/sun.ts::dayPhase()` возвращает непрерывный solid background,
   `planDim` и warmth. Это не четырёхфазная модель из issue.
2. Full card применяет ночной `brightness()` к `.zoomwrap`, поэтому вместе с
   окружением меняются сам план и все его live-слои.
3. `bg_mode: daynight` сейчас зависит от `north_deg` и валидного `sun.sun`;
   без компаса либо сущности молча возвращается статический фон.
4. `sunStateOf()` читает только azimuth/elevation. Направление движения
   (`attributes.rising`) ещё не участвует в выборе dawn/dusk.
5. Full card и `houseplan-space-card` рассчитывают фон разными render-путями,
   а editor canvases намеренно остаются статическими.
6. Текущий fallback отсутствующего `bg_mode` — `static`. Простая смена fallback
   на `daynight` изменила бы уже существующие планы без согласия пользователя.
7. Уже существуют независимые солнечные лучи из окон, Glow/spill, room fills,
   hover, decor/backdrop, vacuum и mode-transition #101. Новый фон должен
   интегрироваться с ними, а не заменить или перекрасить их.

## 4. Решения владельца

1. В диапазоне высоты между −6° и +6° признак
   `sun.sun.attributes.rising` различает рассвет и сумерки: rising — `dawn`,
   falling — `dusk`. Выше +6° — `day`, ниже −6° — `night`.
2. Если elevation или rising отсутствуют/некорректны, используется полный
   fallback по локальному времени браузера: dawn 05:00–07:59, day
   08:00–17:59, dusk 18:00–20:59, night 21:00–04:59.
3. При валидном `sun.sun` и фаза, и положение декоративного фонового света
   следуют реальным elevation/azimuth. Часовая дуга прототипа используется
   только при полном fallback. Ночью отдельный световой круг скрыт.
4. Существующие пространства без явного выбора сохраняют прежний статический
   вид через совместимую миграцию. Явный `daynight` получает новую
   четырёхфазную семантику. Новые установки и каждое новое пространство
   начинают с `daynight`; явный `static` автоматически не меняется.
5. Сам план не затемняется и не тонируется. Существующие Glow/spill, солнечные
   лучи из окон, room fills/hover, decor/backdrop, vacuum и остальные live-слои
   сохраняют действующее поведение.

## 5. Scope

В задачу входят:

1. дискретная модель `dawn | day | dusk | night` для `bg_mode: daynight`;
2. реальный sun-source с полным локальным clock-fallback;
3. четырёхфазный градиент окружения, декоративный солнечный свет, виньетка и
   alpha-aware контур по утверждённым visual tokens;
4. переход фаз за 1100 ms и `prefers-reduced-motion`;
5. одинаковая фаза и визуальные tokens в full View, kiosk и статической
   `houseplan-space-card`;
6. совместимость с mode-transition View ↔ editor из #101;
7. новый default для новой установки, ручного создания пространства и
   Floors/Areas onboarding;
8. однократная совместимая миграция старого неявного global default;
9. совместимость полного и per-space export/import;
10. обновление существующих RU/EN строк режима и подсказок;
11. unit, backend, production-bundle smoke, golden и performance coverage;
12. пользовательская/архитектурная документация, оба changelog и три
    поставляемые bundle-копии.

## 6. Non-scope

В задачу не входят:

- новый публичный mode token вместо `static | daynight`;
- ручной phase selector, видимый QA-control или пользовательское расписание;
- геолокация, внешний weather API, сетевой астрономический расчёт либо новые HA
  service calls/entities;
- изменение существующей геометрии/порогов/цвета солнечных лучей из окон;
- настройка visual palette, длительности перехода или порогов −6/+6 в UI;
- окрашивание, затемнение, насыщенность, opacity либо blend самого плана;
- day/night окружение внутри Plan/Devices/Decor editors;
- пересмотр бумажного слоя, room fill, Glow, hover, decor, vacuum,
  isometric/Labs или View ↔ editor UX;
- сохранение текущей вычисленной фазы в config/storage;
- canvas/WebGL только ради фонового градиента;
- production-обработка URL-параметра `?time=HH:MM`;
- изменение touch-контракта desktop-first редакторов.

## 7. Контракт источника и выбора фазы

### 7.1. Валидный real-sun sample

Для **окружения** real-sun sample валиден, только если одновременно:

- существует live-state `sun.sun`;
- `attributes.elevation` — конечное число;
- `attributes.azimuth` — конечное число, нормализуемое в `[0, 360)`;
- `attributes.rising` — настоящий boolean.

Если любое условие нарушено, весь day-cycle — и фаза, и положение фонового
света — атомарно переходит на clock-fallback. Нельзя смешивать фазу от часов с
позицией из частично валидного `sun.sun`.

Это отдельная проверка только для окружения. Действующий `sunStateOf()` и
существующие оконные лучи продолжают использовать azimuth/elevation по
`docs/SUN.md`: отсутствие `rising` не должно выключить уже работающие лучи.

### 7.2. Фаза по реальному Солнцу

Границы детерминированы так:

| Условие | Фаза |
|---|---|
| `elevation <= -6` | `night` |
| `-6 < elevation < 6` и `rising === true` | `dawn` |
| `elevation >= 6` | `day` |
| `-6 < elevation < 6` и `rising === false` | `dusk` |

На точной верхней границе состояние уже `day`, на точной нижней — уже `night`.
Azimuth wrap 359°→0° не меняет фазу.

### 7.3. Полный clock-fallback

Используются часы и часовой пояс браузера через локальный `Date`, без серверного
времени:

| Локальные минуты | Фаза |
|---|---|
| `300 <= m < 480` (05:00–07:59) | `dawn` |
| `480 <= m < 1080` (08:00–17:59) | `day` |
| `1080 <= m < 1260` (18:00–20:59) | `dusk` |
| иначе (21:00–04:59) | `night` |

DST и смену часового пояса даёт платформа `Date`. Интервал проверяет часы
каждые 30 s только пока используется fallback и вкладка видима. Дополнительно
состояние пересчитывается до первого видимого кадра, при `pageshow` и при
`visibilitychange` обратно в `visible`. Если фаза и позиционные tokens не
изменились, Lit/DOM update не запрашивается.

### 7.4. Переключение источника

Появление, исчезновение либо восстановление валидности `sun.sun` пересчитывает
весь day-cycle из одного snapshot. Текущая фаза не хранится как истина и не
может остаться от прежнего источника. Обычная смена источника получает тот же
1100 ms environment transition; fresh mount сразу начинает с правильного
состояния без вспышки default-day.

## 8. Контракт декоративного фонового света

Декоративный свет — pointer-inert слой окружения под планом. Он не является
оконным солнечным лучом и не использует `north_deg`: фон существует независимо
от ориентации дома.

### 8.1. Real-sun position

При валидном real-sun sample позиция вычисляется из реальных атрибутов:

```text
x = 50 - sin(azimuth * pi / 180) * 42       // percent
y = 78 - clamp(elevation, 0, 90) / 90 * 64 // percent
opacityFactor = clamp((elevation + 6) / 12, 0, 1)
```

Так восток (около 90°) оказывается у левого горизонта, запад (около 270°) — у
правого, а северный и южный полдень проходят через центр без зависимости от
полушария. Отрицательная высота держит свет у горизонта; в `night` opacity
принудительно равна нулю.

### 8.2. Clock-fallback arc

Fallback повторяет дугу прототипа:

```text
progress = (minutes - 300) / (1260 - 300)
x = 8 + progress * 84
y = 78 - sin(progress * pi) * 64
opacityFactor = max(.18, min((minutes - 300) / 120,
                             (1260 - minutes) / 120, 1))
```

Формулы применяются только в диапазоне 05:00 ≤ time < 21:00; вне его opacity
равна нулю. Позиция обновляется той же 30-секундной fallback-проверкой, не
пересчитывая план, стены, room geometry или устройства.

### 8.3. Вид и слой

Свет — мягкий radial gradient без жёсткой окружности, размером 250 CSS px в
эталонном desktop layout; на меньшей поверхности он ограничивается размером
окружения и не создаёт overflow/scroll. Цвет задаётся фазой, позиция и opacity —
источником выше. В `night` элемент может оставаться в DOM, но его вычисленная
opacity обязана быть 0 и ни один видимый световой круг не допускается.

## 9. Визуальный контракт четырёх фаз

Окружение строится из вертикального linear gradient и мягкого radial horizon у
нижней части сцены. Значения ниже — канонические tokens прототипа; отклонение
требует нового решения владельца, а не локального «подбора на глаз».

| Фаза | top | bottom | horizon | sun | vignette |
|---|---|---|---|---|---|
| `dawn` | `#aabdd1` | `#e8c8b7` | `rgba(255,201,156,.56)` | `rgba(255,188,125,.78)` | `rgba(65,72,99,.21)` |
| `day` | `#dce9ef` | `#cbdce3` | `rgba(255,245,220,.45)` | `rgba(255,239,190,.72)` | `rgba(65,91,105,.16)` |
| `dusk` | `#48536c` | `#9a7380` | `rgba(242,156,114,.34)` | `rgba(255,167,113,.55)` | `rgba(20,26,44,.39)` |
| `night` | `#111a27` | `#1f2f3e` | `rgba(79,120,151,.16)` | transparent | `rgba(3,8,14,.58)` |

Alpha-aware контур применяет три zero-offset `drop-shadow` либо визуально
эквивалентный эффект к **одному каноническому plan-paper composite**, не к
каждой комнате/стене отдельно:

| Фаза | near `0 0 1px` | mid `0 0 5px` | far `0 0 10px` |
|---|---|---|---|
| `dawn` | `rgba(74,57,61,.25)` | `rgba(255,238,224,.40)` | `rgba(255,224,202,.18)` |
| `day` | `rgba(45,62,71,.28)` | `rgba(255,255,255,.42)` | `rgba(255,255,255,.20)` |
| `dusk` | `rgba(238,219,225,.40)` | `rgba(229,207,218,.26)` | `rgba(215,190,205,.12)` |
| `night` | `rgba(218,238,249,.56)` | `rgba(174,215,238,.30)` | `rgba(136,194,226,.14)` |

Контур повторяет внешний alpha-контур общего бумажного footprint, не имеет
смещения, не создаёт внутренних швов между комнатами и не обводит устройства,
labels, hover или live-эффекты. Для image-plan канонический footprint — его
действующий opaque paper rect; для drawn-plan — объединённая по одному group
совокупность room paper polygons. Пустой drawn space без комнат не получает
ложный прямоугольный контур.

## 10. Инвариант неизменного плана

Во всех четырёх фазах к plan/content tree запрещено добавлять:

- `brightness`, `contrast`, `saturate`, `sepia`, `hue-rotate` или иной
  color filter;
- opacity родителя, `mix-blend-mode` или цветной overlay поверх плана;
- смену paper/floor/room fill цвета из-за фазы;
- изменение яркости/цвета devices, labels, decor/backdrop, vacuum, Glow/spill,
  hover или оконных солнечных лучей.

Действующий `dayPhase().planDim` удаляется из day-cycle render и из target
brightness mode-transition #101. Plan pixels внутри plan-paper alpha footprint
до и после смены фазы должны совпадать; разрешено меняться только внешнему
zero-offset outline за границей footprint.

## 11. Переходы и surfaces

### 11.1. Phase transition

При смене фазы ровно 1100 ms с easing
`cubic-bezier(.22, .61, .36, 1)` анимируются только:

- environment top/bottom/horizon;
- цвет/позиция/opacity декоративного света;
- внешняя vignette;
- три цвета alpha-aware outline.

Нельзя fade всего экрана или самого плана. Реализация обязана использовать
действительно интерполируемые CSS primitives либо environment-layer crossfade;
простая декларация `transition` на неанимируемом gradient не считается
выполнением. При `prefers-reduced-motion: reduce` длительность практически
нулевая (`<= 0.01 ms` либо `transition: none`).

### 11.2. Full View, kiosk и static card

Full View и kiosk используют один environment model. Статическая
`houseplan-space-card` получает ту же effective phase, palette, свет, outline и
fallback lifecycle; оконные wedges в static card не добавляются — действующее
ограничение `docs/SUN.md` сохраняется.

### 11.3. Editors и #101

Plan/Devices/Decor editors сохраняют действующий editor background и не
получают четырёхфазное окружение. При View ↔ editor переходе #101:

1. исходный и целевой кадр используют один атомарный phase/source snapshot;
2. сам plan composite не меняет brightness/color;
3. environment transition не перехватывает pointer/focus и не оставляет
   скрытый слой после commit/cancel;
4. при возвращении в View актуальная фаза пересчитывается до целевого кадра,
   включая возврат после долгой паузы.

### 11.4. Существующие live-эффекты

Glow/spill, room fills/hover, decor/backdrop, vacuum, labels/devices и оконные
лучи сохраняют порядок слоёв, opacity, blend и lifecycle. `north_deg` продолжает
управлять только ориентационно зависимыми оконными лучами; `daynight` background
больше не выключается из-за отсутствия компаса.

## 12. Модель данных, defaults, migration и import/export

### 12.1. Persisted schema

Публичная schema не расширяется: global и per-space
`settings.bg_mode: 'static' | 'daynight'`, per-space null/absence = inherit.
Вычисленная фаза, источник и позиция света не сохраняются. Backend продолжает
принимать отсутствие `bg_mode` ради legacy compatibility.

Runtime fallback отсутствующего effective token остаётся `static`; новая
семантика достигается материализованными defaults, а не переопределением
отсутствующего поля.

### 12.2. Новая установка и новые пространства

- Новый `DEFAULT_CONFIG` материализует global `settings.bg_mode: 'daynight'`.
- Ручное Create space материализует per-space `bg_mode: 'daynight'`.
- Каждое пространство, созданное Floors/Areas onboarding, материализует
  per-space `bg_mode: 'daynight'`.
- Открытие и сохранение существующего space dialog не меняет его mode без
  действия пользователя.
- Явный `static` на любом уровне никогда не переписывается автоматически.

Per-space materialization нужна даже при новом global default: добавленное
позднее пространство начинает с `daynight`, в том числе внутри старой
установки, чей global default мигрирован в `static`.

### 12.3. Однократная миграция существующего store

Backward-compatible storage migration выполняется один раз и идемпотентно:

1. если в существующем config global `settings.bg_mode` отсутствует либо
   невалиден, он материализуется как `static`;
2. валидный global `static` или `daynight` сохраняется;
3. все валидные per-space overrides сохраняются без переписывания;
4. spaces без override продолжают наследовать уже материализованный global;
5. migration сохраняет неизвестные поля, не меняет layout и не создаёт
   config-update storm;
6. повторный старт не создаёт новую запись/revision.

### 12.4. Export/import

- Full export после миграции содержит явный global mode; legacy full import без
  него материализуется как `static` до preview/apply.
- Per-space export материализует в экспортируемом space его **effective** mode,
  чтобы перенос не зависел от отсутствующего global settings блока.
- Legacy per-space import без mode материализуется как `static` до merge.
- Явные `static`/`daynight` сохраняются при same-instance и foreign import.
- Import preview показывает тот же итоговый mode, который будет применён;
  preview не пишет storage.
- Никакой импорт не превращается в «новое пространство по default»:
  импортированная семантика имеет приоритет над default ручного Create.

## 13. UX, i18n, accessibility и touch

Видимых новых controls нет. Действующий selector остаётся двухпозиционным:
`static` и `daynight`; color picker виден только для `static`.

Обновляются существующие RU/EN keys без добавления третьего режима:

- `gs.bg_daynight`: «Следует за Солнцем» / “Follows the Sun”;
- `gs.bg_daynight_hint`: четыре фазы, real sun и локальный fallback, без
  требования компаса;
- `gs.sun_missing` и `gs.north_hint`: отсутствие sun/севера отключает оконные
  лучи, но не clock-driven background.

Фаза декоративна: она не добавляет announcement, focus target, toast или
semantic state; не меняет размеры сцены и не служит единственным носителем
информации. `forced-colors` сохраняет функциональную читаемость plan/devices;
декоративные environment layers могут быть упрощены либо отключены.

View, kiosk и static card полностью поддерживаются мышью, touch и без pointer:
новые слои имеют `pointer-events: none`, не перехватывают tap/swipe/pinch и не
меняют hit targets. Editor остаётся desktop-first и не получает новых действий.

## 14. Архитектурный и performance-контракт

1. Один pure resolver возвращает phase, source (`sun | clock`) и декоративные
   position/opacity tokens. Full/static surfaces не копируют пороги и формулы.
2. Palette хранится одной typed таблицей. CSS и тесты не получают расходящиеся
   hard-coded варианты.
3. Real-sun resolver запускается только на релевантном изменении sun snapshot,
   config/space или lifecycle catch-up; прочие `hass` ticks не меняют DOM.
4. Clock timer существует только в fallback, не чаще 30 s, не выполняет
   необязательную работу в hidden document и очищается в `disconnectedCallback`.
5. Не создаётся `requestAnimationFrame` loop, canvas/WebGL, geometry/layout
   polling, новая сеть, service call или storage write.
6. Phase/source/position update меняет только bounded environment state/style.
   Rooms, walls, openings, Glow barriers, devices и backdrop geometry не
   пересчитываются.
7. Alpha-aware outline применяется к одному plan-paper composite; per-room
   filter multiplication запрещён.
8. Environment DOM count постоянен относительно rooms/devices и не растёт при
   каждой фазе или visibility cycle.
9. #101 и cold-start #131 сохраняют первый полный кадр: не допускается второй
   пустой render ради вычисления локального времени.
10. Таргетированный performance smoke доказывает отсутствие geometry/device
    rebuild на clock tick и обычном нерелевантном hass tick. Перед бетой на
    exact SHA обязательны существующие performance smoke и Full Performance без
    ослабления budgets.

## 15. Acceptance criteria

- **AC1 (`unit`; разработчик):** real-sun resolver детерминированно выдаёт
  `night/dawn/day/dusk` на обеих сторонах −6/+6, точных границах, при rising и
  falling; azimuth wrap не меняет фазу.
- **AC2 (`unit` + production-bundle smoke; разработчик):** отсутствие/garbage
  любого из elevation/azimuth/rising атомарно включает clock-fallback с точными
  границами 05:00/08:00/18:00/21:00; валидность real sample восстанавливает весь
  sun-source без смешивания данных.
- **AC3 (`unit` + targeted smoke; разработчик):** real-sun позиция следует
  elevation/azimuth, fallback — утверждённой дуге 05:00→13:00→21:00, а night
  имеет opacity 0. Ни один update не пересчитывает plan geometry.
- **AC4 (`golden` + computed-style smoke; владелец/ревьюер):** dawn/day/dusk/
  night используют точные palette и outline tokens раздела 9; ночью нет
  видимого светового круга, а светлый дневной и тёмный ночной план отделены от
  окружения.
- **AC5 (`pixel regression` + code review; разработчик/ревьюер):** внутри
  plan-paper footprint пиксели plan, floors, room fills, Glow/spill,
  devices/labels, decor/backdrop, vacuum, hover и оконных лучей совпадают между
  четырьмя фазами; никакой phase-dependent plan filter/opacity/blend не остаётся.
- **AC6 (`targeted smoke`; разработчик):** смена фазы анимирует только environment
  и outer outline за 1100 ms с заданным easing; plan не мигает. Reduced motion
  завершает переход практически мгновенно.
- **AC7 (`production-bundle smoke` + golden; разработчик/владелец):** full View,
  kiosk и static card получают одну effective phase/palette; editors остаются
  прежними, а #101 transition не оставляет stale/interactive environment layer.
- **AC8 (`unit` + smoke; разработчик):** `daynight` работает без `north_deg` и
  без `sun.sun` через clock fallback; оконные лучи по-прежнему требуют свои
  действующие sun/north gates и не меняют геометрию/пороги.
- **AC9 (`backend migration tests`; разработчик):** существующий отсутствующий
  global mode мигрирует в `static` ровно один раз; валидные global/per-space
  modes и неизвестные поля сохраняются; повторный старт не пишет store/rev.
- **AC10 (`frontend unit` + `backend/import tests` + smoke; разработчик):** новая
  установка, manual Create и Floors/Areas create материализуют `daynight`;
  существующий Edit не меняет mode сам; явный `static` остаётся static.
- **AC11 (`backend/import-export tests`; разработчик):** full/space export и
  legacy/current import выполняют контракт §12.4, preview совпадает с apply, а
  preview не пишет storage.
- **AC12 (`i18n test` + accessibility/touch smoke; разработчик):** RU/EN тексты
  описывают четыре фазы и fallback; environment pointer-inert, не двигает focus,
  не меняет размеры/hit targets и не ломает tap/swipe/pinch в View/kiosk.
- **AC13 (`lifecycle smoke`; разработчик):** fallback пересчитывается сразу,
  каждые 30 s только в visible state, на `pageshow` и visible-return; timer и
  listeners очищаются при disconnect, повторное подключение не дублирует их.
- **AC14 (`performance smoke` + code review; разработчик/ревьюер):** sun/clock
  update меняет bounded environment state без room/device/geometry rebuild,
  RAF-loop, canvas, сети, HA calls или storage writes; DOM/timer count bounded.
- **AC15 (`typecheck` + `unit` + `build` + docs review; разработчик):** локальные
  implementation gates зелёные, обе пользовательские документации/changelog и
  три bundle-копии обновлены в одном `User-Visible: yes` коммите.
- **AC16 (`exact-SHA Linux gates`; Claude/релиз-инженер):** перед бетой зелёны
  Validate, полный smoke, reviewed golden и Full Performance на одном SHA без
  ослабления budgets; security/network/schema verdict явно записан в code review.

## 16. План автотестов и визуального review

### 16.1. Unit/frontend

Добавить pure-helper coverage:

1. elevation `-6.1/-6/-5.9/5.9/6/6.1` при обоих rising values;
2. NaN/infinity/string/missing для elevation, azimuth и rising;
3. fallback минуты `299/300/479/480/1079/1080/1259/1260`;
4. real position east/south/west/north и elevation below horizon/0/45/90;
5. fallback position/opacity в 05:00, 07:00, 13:00, 19:00, 21:00;
6. palette completeness и night opacity 0;
7. mode inheritance с compatibility fallback `static`;
8. отсутствие влияния нового rising requirement на sun-ray helpers.

### 16.2. Backend и compatibility

Покрыть storage migration: missing, static, daynight, mixed per-space,
malformed legacy, unknown fields, idempotent second load и rev/event count.

Расширить import/export matrix: legacy full/space без mode, current full/space с
обоими modes, inherited export materialization, same/foreign source, preview
versus apply и import into target с противоположным global mode.

### 16.3. Targeted production-bundle smoke

Обновить sun/background smoke либо добавить отдельный four-phase smoke на
собранном bundle:

1. full View, kiosk и `houseplan-space-card` проходят четыре deterministic
   real-sun phase;
2. отдельная matrix проходит clock fallback и source recovery;
3. computed styles проверяют palette, outline, light visibility и transition;
4. pixel probes/masked screenshots доказывают неизменность plan interior;
5. existing window rays работают с north, а background — без north;
6. editor и View↔editor transition не получают stale layer;
7. visibility/pageshow/timer cleanup и reduced motion проверяются под fake clock;
8. manual/Floors create и existing Edit проверяют persisted modes;
9. counters доказывают отсутствие geometry/device rebuild и storage/network
   activity на fallback tick.

Targeted smoke пишется вместе с кодом; полный smoke-suite запускается перед
бетой, не в implementation loop.

### 16.4. Golden

Нужны новые deterministic Linux golden-сцены full View для `dawn`, `day`,
`dusk`, `night` и static-card сцены для двух контрастных крайних состояний
`day/night`. Одинаковые fixture plan/live state/camera исключают посторонний
diff; reduced motion включён.

Golden artifact ревьюится владельцем/Claude как единый набор: соответствие
прототипу, отсутствие plan tint/dim, световой круг не виден ночью, outline не
создаёт per-room seams. Baseline принимается только штатной командой
`golden:accept -- --reviewed` из полного Linux-артефакта и отдельным коммитом с
обязательными release/baseline trailers по runbook; принять baseline ради
зелёного CI нельзя.

## 17. План реализации

1. Ввести typed day-cycle resolver/palette рядом с sun pure logic, не меняя
   оконную ray geometry.
2. Подключить единый environment model и lifecycle к full/static surfaces;
   убрать phase-dependent plan dim и compass gate background.
3. Реализовать environment layers, decorative light, vignette, composite
   outline, 1100 ms/reduced-motion и интеграцию #101.
4. Материализовать новые defaults, storage migration и import/export
   compatibility.
5. Обновить selectors/hints i18n, документацию и changelog.
6. Добавить unit/backend/targeted production-bundle smoke и deterministic
   golden scenes.
7. Выполнить implementation-loop `typecheck`, `unit`, `build`; остальные гейты
   — на пре-релизе по команде владельца.

Точные имена helper-функций, CSS classes и private fields не являются
продуктовым контрактом.

## 18. Release-артефакты

Изменение пользовательское: implementation-коммит имеет `User-Visible: yes` и
в том же коммите обновляет:

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`;
- `docs/SUN.md` — новый источник истины по фазам, fallback, визуалу и
  независимости от компаса;
- `docs/USER-GUIDE.ru.md` — выбор режима, четыре фазы, defaults и fallback;
- `docs/ARCHITECTURE.md` — resolver/lifecycle/layers и full/static parity;
- `docs/CONFIG-COMPATIBILITY.md` — storage/default/import migration;
- `docs/TESTING.md` — targeted smoke/golden matrix;
- RU/EN i18n и три поставляемые bundle-копии.

Перед бетой на exact SHA обязательны:

- Linux Validate;
- полный smoke-suite;
- reviewed/accepted golden artifact без необъяснённого diff;
- performance smoke и Full Performance без ослабления budgets;
- code review с явным negative security/network/HA-call verdict.

Новый отдельный security report не требуется: feature не принимает HTML/URL,
не добавляет network/storage input или HA action. Публикация проходит через
обычную бету до stable; issue закрывает владелец пачкой после опубликованной беты.

## 19. Риски и меры

| Риск | Вероятность / влияние | Мера |
|---|---|---|
| План незаметно остаётся dim/tinted старым filter | средняя / высокая | AC5 pixel mask, удаление planDim consumers, four-phase golden |
| Старый план без mode внезапно включит daynight | средняя / высокая | materialized storage migration в static, idempotence/backend tests |
| Новое пространство в старой установке наследует static | высокая / средняя | explicit per-space daynight в manual и Floors create, AC10 |
| Partial sun sample смешивается с clock position | средняя / средняя | атомарный resolver/source, garbage matrix AC2 |
| CSS gradient прыгает вместо перехода | средняя / средняя | проверяемые intermediate styles/pixels, animatable primitive/crossfade |
| Outline создаёт швы по комнатам или обводит devices | средняя / высокая | один plan-paper group, full/static golden и DOM assertion |
| 30 s timer течёт/дублируется | средняя / средняя | fallback-only lifecycle, disconnect/reconnect smoke |
| Background начинает зависеть от north и молчит | средняя / высокая | отдельные gates background/rays, no-north smoke |
| #101 оставляет stale слой либо pointer blocker | средняя / высокая | mode-transition targeted smoke, pointer-events none |
| Import наследует target mode вместо исходного | средняя / высокая | effective space export + legacy import materialization matrix |
| Visual layers ухудшают слабое устройство | низкая / высокая | bounded layers, один outline filter, performance exact-SHA gates |

## 20. Откат

Пользовательский немедленный откат — выбрать `static` глобально либо для
пространства; environment timer/layers становятся инертны без потери данных.

Технический откат — revert implementation-коммита вместе с тестами,
документацией, changelog и bundle-копиями. Миграция только материализует ранее
эффективный `static`, поэтому старая версия полностью читает результат; новые
явные `daynight` также являются старым валидным token. Обратная миграция и
удаление полей не нужны. Если default новой установки требуется временно
отключить без полного revert, вернуть creation defaults в `static`; сохранённые
пользовательские choices не переписывать.

## 21. Принятые технические предположения — можно менять без продуктового ревью

1. Точная граница считается `<= -6 => night`, `>= 6 => day`; только открытый
   интервал различает rising/falling.
2. Environment использует отдельный strict real-sun validator; ray API не
   расширяется обязательным `rising`.
3. Real decorative position использует формулы §8.1: horizontal проекция через
   `sin(azimuth)`, vertical — линейно по положительной elevation. Это
   декоративное отображение, не плановая координата и не зависит от north.
4. Размер light можно выразить через bounded `clamp()` вместо ровно 250 px на
   маленьких карточках, сохранив desktop reference и visual intent.
5. Конкретный способ плавной смены gradient — registered custom properties или
   два bounded environment layers; AC важнее механизма.
6. QA не читает production `?time`: fake clock/sun внедряется только в unit,
   demo и smoke harness. Пользовательского QA-control нет.
7. Storage migration рекомендуется реализовать bump minor version с проверкой
   формы config-store document; точный helper свободен при соблюдении AC9.
8. Per-space export может материализовать effective mode в копии export payload,
   не меняя live config.
9. Один shared fallback ticker допустим вместо timer на карточку, если lifecycle,
   isolation нескольких карточек и bounded listener count доказаны тестами.
10. DOM может хранить фазу как `data-day-cycle` либо typed class; публичной
    schema/DOM API это не становится.
11. Контур строится вокруг действующего канонического opaque paper composite:
    image rect либо общего group room papers; новый анализ alpha пикселей
    загруженного raster-файла не требуется.
12. Открытых продуктовых вопросов нет; все Q1–Q3 и defaults приняты владельцем
    2026-08-14.
