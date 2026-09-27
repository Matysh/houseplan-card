# #374 — Полный Glow в `houseplan-space-card` по явному включению

Issue: [#374](https://github.com/Matysh/houseplan-card/issues/374)

## Сценарий

Персона **домочадец** или **гость/киоск** смотрит на отдельную
`custom:houseplan-space-card`, размещённую как основной визуальный элемент
Home Assistant dashboard. Администратор дома заранее включил для этого
экземпляра полный Glow.

Когда лампа включается, человек должен сразу увидеть не только жёлтый маркер или
ровную заливку комнаты, но и пространственный свет: радиальный pool начинается
в реальном положении источника, проходит через открытые внутренние проёмы и
оставляет тени за стенами, перегородками и колоннами.

## Что человек увидит до и после

Сейчас отдельная карточка показывает живые маркеры и ровную Glow-подложку
комнат, но никогда не рисует радиальный свет и тени. После изменения новый
переключатель **Light pools and wall shadows / Световые пулы и тени от стен**
позволит получить в ней тот же полноценный Glow, что на полном плане; без
включения переключателя карточка останется визуально и вычислительно прежней.

## Проблема

Закрытый документационный issue
[#370](https://github.com/Matysh/houseplan-card/issues/370) подтвердил, что
отсутствие теней в static card не было поломкой: `renderSpaceStatic()` намеренно
не выполняет самый тяжёлый этап светового рендера. Но для dashboard, где
отдельная карточка является основным представлением дома, это удаляет одну из
ключевых пространственных возможностей House Plan.

Канонический путь полной карточки сейчас делает гораздо больше, чем рисует
градиент:

1. строит реальные тела стен, перегородок и колонн;
2. вырезает только проходимую часть открытых **внутренних** дверей/ворот и
   учитывает сохранённые passages и zero-thickness walls;
3. блокирует свет окнами, наружными проёмами и телом, внутрь которого ошибочно
   попал источник;
4. вычисляет visibility polygon и пересекает его с полом всех комнат;
5. применяет один радиальный field на источник, additive/screen composition,
   экранное feathering и bounded fade переходы;
6. кеширует тяжёлую геометрию по конфигурации и квантованным состояниям проёмов.

`houseplan-space-card` уже имеет тот же House Plan snapshot, HA states,
виртуальные источники, позиции маркеров, room Glow/base fills и каноническую
геометрию стен. Отсутствует именно общая световая сцена. Копирование приватной
`_renderGlowLayer()` в static renderer недопустимо: две поверхности начнут
по-разному трактовать проёмы, толщины и последующие исправления света.

## Скоуп

- новый boolean `light_pools` только у `custom:houseplan-space-card`;
- настройка в YAML и visual editor, default `false`;
- при `true` — визуальная и семантическая parity с Glow полной
  `custom:houseplan-card` для выбранного пространства;
- общий framework-light расчёт transport/clip/source appearance и общий SVG
  contract для обеих поверхностей вместо новой копии алгоритма;
- реальные и manual/virtual источники, marker-owned radius/color/brightness;
- стены, независимые перегородки, колонны, room drafts, zero-thickness walls,
  внутренние двери/ворота/passages и наружные проёмы по канону `docs/LIGHT.md`;
- текущие room-level/global Glow gates, data fills и Glow base/tunnels;
- включение/выключение источника, смена цвета/яркости, перемещение маркера,
  изменение конфигурации и состояния проёма без перезагрузки карточки;
- те же bounded fade, reduced-motion и source-failure semantics;
- bounded caches и отдельный performance-профиль opt-in static card;
- regression-тесты default-off, parity, окклюзии, lifecycle и inert surface;
- UI/i18n, RU/EN guide, `docs/LIGHT.md`, testing contract и оба changelog.

## Не-скоуп

- включение `light_pools` по умолчанию или миграция существующих Lovelace cards;
- изменение визуального результата Glow полной карточки;
- новая упрощённая/low-quality модель света, лимит количества источников,
  адаптивное отключение теней или скрытая деградация на слабых устройствах;
- sunlight/window wedges: это независимая система `docs/SUN.md`;
- hover/click/more-info/toggle на самой схеме static card;
- изменение footer, deep link, title/crop, room/device presentation или
  `show_button`;
- новый глобальный House Plan setting, per-space setting или сохранение флага в
  backend config: флаг принадлежит конкретному Lovelace card instance;
- изменение редакторов геометрии и скрытой изометрии;
- изменение алгоритмов стен, проёмов, clean floor или Optimize Plans;
- повышение существующих performance/bundle budgets без отдельного решения по
  измеренному Linux artifact.

## Контракт поведения

### 1. Конфигурация

```yaml
type: custom:houseplan-space-card
space: ground_floor
light_pools: true
```

1. Поле отсутствует или равно `false`: static card не строит barrier/visibility
   scene, не создаёт SVG pool layer и сохраняет текущий результат.
2. Поле равно `true`: карточка строит полноценный Glow выбранного пространства.
3. Visual editor показывает один boolean с локализованным названием. Изменение
   применяется стандартным Lovelace config update без backend write.
4. Неизвестные значения не получают новой truthy-семантики: включением является
   только нормализованное boolean `true`, как у остальных boolean полей editor.

### 2. Источники и видимость

1. Источники разрешаются через тот же `resolvedLightSources()` и
   `selectSpatialGlowSource()`, что в полной карточке. Один marker владеет не
   более чем одним spatial pool даже при смене resolved HA entity.
2. Реальный, manual virtual и связанный virtual light дают тот же pool при тех
   же state, marker settings и позиции. Hidden/removed/non-spatial devices не
   начинают светить из-за новой поверхности.
3. `resolveGlowAppearance()` и `glowAlpha()` остаются единственным контрактом
   цвета, яркости и центральной alpha. Per-marker `glow_color` и
   `glow_radius_cm` имеют тот же приоритет над palette/global radius.
4. Off/unknown/unavailable источник pool не рисует; on источник рисует. Переход
   on↔off и смена resolved source сохраняют marker-stable identity и тот же
   bounded fade, что полный план.
5. `live_states:false` продолжает подавлять обычное state/activity оформление
   маркеров, но не выключает Glow. Это существующая независимость Glow от
   device display полной карточки.

### 3. Геометрия и тени

1. Для одинакового snapshot, HA states, пространства, позиции и радиуса обе
   карточки получают одинаковые barrier fingerprint, floor и lit clip paths с
   точностью существующего geometry tolerance.
2. Стена блокирует свет своим реальным телом и толщиной, а не центральной осью.
   Перегородка, колонна, draft и solid zero wall непрозрачны; dashed zero wall
   прозрачен.
3. Внутренняя door/gate пропускает только квантованную открытую часть; passage
   прозрачен полностью. Window и opening без пола с обеих сторон остаются
   непрозрачными.
4. Источник внутри opaque plan body fail-dark: ни половинчатого pool, ни
   засвеченного tunnel не появляется.
5. Visibility region пересекается со всем floor пространства до visual clip по
   Glow-enabled rooms. Поэтому свет может пройти через отключённую для покраски
   комнату, но пиксели pool/base появляются только в комнатах, где effective
   room Glow включён.
6. Вырожденная или повреждённая геометрия сохраняет существующий bounded
   fail-dark/fallback и один диагностический warning на revision/room, а не
   падает и не освещает сквозь препятствие.

### 4. Слои и визуальная parity

1. Порядок static scene становится: paper/backdrop → data room/tunnel fills →
   Glow base/tunnels → radial pools → стены/openings → labels/devices.
   Pool не перекрывает стену, маркер или подпись.
2. Один источник создаёт один painted radial field и один clip; второго spill,
   sector, tunnel-light или shadow-mask слоя нет.
3. `GLOW_FALLOFF`, gradient units, blend mode, isolation, edge feather и
   fallback composition совпадают с полной карточкой и читаются из общего
   контракта, а не из двух наборов констант.
4. Data fill с валидным цветом/alpha остаётся видимым по действующим правилам;
   Glow base добавляется только там, где его добавляет полный renderer.
5. Light/dark theme не меняет физическую область света; цвет и alpha приходят
   из существующей palette/marker state. Day-cycle background продолжает жить
   под тем же pool.

### 5. Lifecycle и кеши

1. Каждый `houseplan-space-card` владеет своим bounded Glow runtime: transition
   state, timers, last appearance и per-source clips не протекают между card
   instances и освобождаются при disconnect.
2. Barrier cache зависит от полного geometry fingerprint и отсортированной
   сигнатуры квантованных interior opening amounts. Обычный HA tick не
   перестраивает geometry; смена состояния проёма перестраивает ровно нужную
   сцену.
3. Clip cache дополнительно зависит от space, barrier fingerprint, source
   position и radius. Перемещение marker/config revision не показывает stale
   shadow.
4. Continuity snapshot/recovery не очищает уже видимый корректный кадр раньше
   действующего контракта. После нового authoritative snapshot pool и marker
   соответствуют одной device/config revision.
5. При `light_pools:false` runtime не ставит transition timers и не выполняет
   visibility/boolean work. Выключение флага очищает оставшиеся timers/caches и
   удаляет layer на следующем render.

## UX и доступность

- Visual editor: boolean рядом с live-state visual settings; название явно
  предупреждает, что это одновременно pools и wall shadows.
- Помогающий текст в guide сообщает, что режим тяжелее default static path;
  отдельный warning dialog/toast не добавляется.
- `.hp-static-stage` остаётся `pointer-events:none`; Glow layer имеет
  `aria-hidden="true"` и не участвует в tab order/accessible name.
- Footer остаётся единственной интерактивной частью card.
- На desktop, wall tablet и phone визуальная модель одинакова; touch не включает
  новое действие. `prefers-reduced-motion` использует существующий reduced
  transition contract без потери финального светового состояния.

## Модель данных, миграция и совместимость

Публичный Lovelace config расширяется одним полем:

```ts
interface SpaceCardConfig {
  light_pools?: boolean;
}
```

- default в `setConfig()` и stub config — `false`/отсутствие;
- schema House Plan, backend store, model version и config migration не
  меняются;
- существующие YAML и GUI cards без поля визуально и по runtime cost не
  меняются;
- visual editor round-trip сохраняет явное значение стандартным механизмом HA;
- откат безопасен простым удалением поля или `light_pools: false`;
- deprecated alias `show_light_shadows` не принимается и не записывается: у
  функции один канонический ключ.

## i18n

Добавить один editor key во все поставляемые словари
`src/i18n/{en,ru,de,fr}.json`:

- EN: `Light pools and wall shadows`;
- RU: `Световые пулы и тени от стен`;
- DE/FR — эквивалентный перевод без английского fallback.

Новых runtime errors, toast, dialogs или ARIA-фраз нет.

## Архитектурный контракт

1. Канонические transport и pool primitives выносятся из приватного монолита в
   framework-light shared module(s). Допустимое разбиение:
   - pure barrier/clip scene builder с явными geometry inputs;
   - shared source-to-spot resolver;
   - shared SVG pool template/константы;
   - caller-owned bounded runtime/cache adapter.
2. `houseplan-card` и `space-render` могут по-разному собирать входы, но не
   содержат две реализации aperture classification, visibility intersection,
   source guard, falloff или SVG field.
3. Shared module не читает DOM, глобальный `hass`, приватные поля карточки и не
   владеет неограниченным module-level cache. Side effects — только переданные
   callbacks диагностики/transition scheduling.
4. Существующая full-card output должна быть regression-equivalent. Extraction
   не является поводом менять её geometry, identifiers, blend/fade или budgets.
5. Static renderer получает marker positions в plan coordinates до процентного
   преобразования devlayer и использует тот же frame/viewBox, что его SVG.

Точные имена shared files/functions — техническая деталь реализации, но
ревьюер должен видеть один алгоритмический источник истины по пяти пунктам выше.

## Производительность и bundle

- Default-off static card не вызывает `visibilityPolygon`, boolean
  intersection и barrier build. Измеренный cold/warm default сценарий не должен
  регрессировать сверх действующего шума/бюджета.
- Opt-in использует fingerprinted barrier cache один раз на geometry/opening
  revision и bounded per-source clip cache; обычные state ticks переиспользуют
  геометрию.
- Добавить кандидатный профиль `large-space-card-glow-overlay-v1` либо
  эквивалентное расширение канонического Glow profile: cold first render, warm
  HA tick, opening-state invalidation и teardown для одной large static card.
- Порог утверждается только из полного Linux performance artifact по
  `demo/performance/README.md`; локальное число не становится budget.
- Скрытый source cap, sampling и повышение существующего
  `large-house-glow-overlay-v1` запрещены.
- Shared extraction не добавляет runtime dependency. Bundle budget может
  измениться только в пределах действующего gate; повышение требует отдельного
  решения и не входит в #374.

## Touch, темы и размеры

- static stage остаётся inert на touch и mouse;
- pool использует plan coordinates и сохраняет геометрию при любом CSS width,
  DPR и `title: ""` compact frame;
- screen-space edge feather пересчитывается из фактической ширины stage, чтобы
  не становиться толще/тоньше на phone и desktop;
- light/dark, reduced motion и continuity overlay входят в blocking browser
  matrix;
- никакого horizontal overflow, нового scroll/gesture listener или захвата
  pointer нет.

## Затронутые файлы и модули

Ожидаемый минимум (точное разбиение может уточнить реализация):

- `src/houseplan-card.ts` — перейти на shared Glow scene/render contract без
  изменения полного плана;
- новый `src/light-scene.ts` и/или `src/glow-render.ts` — общий transport,
  spots, SVG и bounded runtime primitives;
- `src/space-render.ts` — opt-in layer и передача static geometry/positions;
- `src/space-card.ts` — `light_pools`, per-instance runtime/lifecycle и stage
  measurement;
- `src/space-editor.ts` — visual boolean;
- `src/types.ts` при необходимости общего config/runtime type;
- `src/i18n/{en,ru,de,fr}.json`;
- unit-тесты light scene/cache/source parity;
- `demo/smoke_space_card.mjs` и/или отдельный targeted static Glow smoke;
- `demo/performance/**` — opt-in static profile;
- `docs/LIGHT.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md`;
- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`;
- canonical Docs screenshots manifest/artifact по правилу репозитория.

## Критерии приёмки

- **AC1 — opt-in и обратная совместимость:** omitted/`false` не создаёт pool
  layer и не выполняет тяжёлую light geometry; `true` создаёт layer, visual
  editor и YAML дают один результат, неизвестный `space` сохраняет текущую
  error card. **Доказательство:** unit config contract + browser smoke с тремя
  static cards (`omitted`, `false`, `true`).
- **AC2 — визуальная parity источника:** одинаковая full/static fixture с одним
  real light и одним manual/linked virtual light даёт одинаковые center,
  radius, color, alpha, falloff stops, clip geometry и один painted field на
  marker. **Доказательство:** shared-module unit + browser DOM/SVG assertions +
  semantic pixel witness light/dark.
- **AC3 — окклюзия parity:** pool проходит через открытые interior door/gate,
  passage и dashed zero wall; закрывается закрытым проёмом, window, exterior
  door, solid zero wall, partition и column; source inside masonry fail-dark.
  Full и static расходятся не более существующего raster tolerance.
  **Доказательство:** shared geometry unit + targeted browser smoke на
  канонической lighting fixture.
- **AC4 — rooms/fills/layering:** global/per-room Glow gate, data fill,
  Glow base и opening tunnels совпадают с full card; transport проходит через
  disabled room, но там не красит; стены, symbols, labels и devices остаются
  поверх pool. **Доказательство:** browser smoke + reviewed light/dark visual
  artifact.
- **AC5 — live lifecycle:** on/off, brightness/RGB, resolved source swap,
  marker move, config revision и door amount обновляют ожидаемую часть сцены;
  fade bounded, reduced motion корректен, stale clip не остаётся и timers
  исчезают после disconnect/flag-off. **Доказательство:** fake-timer/cache unit
  + browser smoke.
- **AC6 — static surface остаётся static:** при включённом pool hover/click/tap
  по pool, стене, комнате и marker не вызывают action/more-info; footer deep
  link работает; phone/desktop и `title: ""` не меняют plan-coordinate
  геометрию. **Доказательство:** browser pointer/touch smoke на двух widths.
- **AC7 — производительность и bounded memory:** default-off не регрессирует;
  opt-in cold/warm/opening invalidation соответствует утверждённому Linux
  профилю; barrier не перестраивается на обычном HA tick, caches bounded и
  teardown очищает instance state. **Доказательство:** instrumentation unit +
  полный performance artifact без повышения действующих budgets.
- **AC8 — full card без регрессии:** существующие light visibility, opening,
  zero-wall, Glow smoke/golden и `large-house-glow-overlay-v1` проходят после
  shared extraction без принятых визуальных дельт полной карточки.
  **Доказательство:** unit + полный Linux smoke/golden/performance artifact.
- **AC9 — документация, i18n и релиз:** visual editor локализован во всех
  поставляемых языках; RU/EN guide описывает default, YAML и performance cost;
  `docs/LIGHT.md` больше не утверждает, что static card всегда без pools; оба
  changelog содержат #374. **Доказательство:** i18n/config tests,
  `check-docs`, docs screenshot artifact и ревью кода.
- **AC10 — сборка и budgets:** typecheck, unit, build, bundle sync/budget,
  process/docs gates и Validate на точном SHA зелёные; новых зависимостей и
  повышения budget нет. **Доказательство:** CI checks ветки.

## План автотестов

1. Pure unit для shared barrier builder: wall body, interior open/closed
   aperture, passage, window/exterior opening, partition, column, dashed/solid
   zero wall, malformed fallback и deterministic fingerprint.
2. Pure unit source-to-spot: real/manual/linked virtual, hidden, off,
   unavailable, RGB/brightness, marker radius/color, fail-dark и stable key при
   source swap.
3. Instrumented cache/runtime unit: geometry build count на first render,
   ordinary HA tick, door quantization change, marker move, config revision,
   `light_pools:false` и disconnect; fake timers не остаются.
4. Расширить static browser harness двумя одинаковыми экземплярами пространства:
   default-off control и opt-in. Проверить отсутствие/наличие layer и inert DOM.
5. На той же canonical lighting fixture рядом снять full card и static card;
   сравнить source centers/radii/gradient stops/clip topology и pixels в точках
   «у источника», «через проём», «за колонной», «за окном/наружной дверью».
6. Повторить для light/dark, 390/900 px, DPR 1/2, `title` omitted/empty и
   reduced motion; CSS scaling не меняет plan-coordinate clip.
7. Mutation witnesses: вернуть unconditional no-pool static path; пропустить
   wall occluder; разрешить exterior door; не очистить runtime при flag-off —
   соответствующие targeted checks должны падать.
8. В цикле реализации: `npm run typecheck`, `npm test`, `npm run build`; перед
   S7 — targeted browser smoke. Полные golden/smoke/performance и принятие Docs
   screenshots выполняются только по каноническому Linux artifact процесса.

## Риски

- **Расхождение двух моделей света.** Снижается shared pure scene/render
  contract и cross-surface AC2/AC3; копия `_renderGlowLayer()` запрещена.
- **Регрессия полной карточки при extraction.** Снижается output-equivalence,
  полными существующими light goldens/smokes и запретом попутной смены
  констант.
- **Default static card становится тяжёлой.** Снижается точным boolean gate до
  barrier/visibility work, instrumentation и default-off performance case.
- **Неправильный слой закрывает стены/маркеры.** Снижается явным render order и
  semantic pixel witness.
- **Stale тень после проёма/позиции.** Снижается полным fingerprint/cache key и
  lifecycle test.
- **Несколько static cards делят timers/caches.** Снижается per-instance owner,
  bounded LRU и teardown test.
- **Feather зависит от CSS size.** Снижается stage measurement и DPR/width
  matrix.
- **Docs screenshots fingerprint устаревает после `src/**`.** Снижается только
  полным canonical workflow и запретом частичного принятия artifact.

## Откат

Пользовательский откат — удалить `light_pools` или установить `false`; данные и
House Plan config не меняются. Кодовый откат удаляет static adapter/editor key,
но сохраняет shared extraction, если она regression-equivalent и продолжает
обслуживать full card. Если shared extraction сама является причиной регрессии,
она откатывается целиком вместе с static layer. Обратной миграции нет.

## Release-артефакты

- `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md`: opt-in полный Glow static card со
  ссылкой на #374;
- `docs/USER-GUIDE.md` и `.ru.md`: YAML, default `false`, visual setting,
  `live_states` independence и performance warning;
- `docs/LIGHT.md`/`ARCHITECTURE.md`: две поверхности одного канонического
  transport/runtime contract;
- `docs/TESTING.md`: static-card Glow parity matrix;
- reviewed browser artifact: full/static рядом, light/dark и narrow/wide с
  открытым проёмом и тенью за колонной;
- полный Linux golden/smoke artifact; визуальная дельта full card не принимается;
- полный Linux performance artifact с default-off и opt-in static profiles,
  без повышения существующих budgets;
- canonical **Docs screenshots** workflow после `src/**`; принять только полный
  reviewed artifact через `npm run docs:accept -- --reviewed --from=<artifact>`
  и закоммитить актуальный `docs/images/screenshots.json`;
- backend, migration и security artifacts не требуются; bundle/process gates
  обязательны.

## Принято предположительно, поменять свободно

- точные имена и границы shared `light-scene`/`glow-render` модулей;
- форма caller-owned runtime API и конкретные размеры LRU, если они не меньше
  действующих возможностей и остаются bounded;
- способ передать static wall-union/opening inputs без повторного boolean pass;
- имя targeted smoke и конкретные synthetic fixtures;
- точные raster tolerances берутся из действующих Glow tests, а не вводятся
  шире ради прохождения новой проверки;
- настройка стоит рядом с `live_states` в visual editor; отдельная секция формы
  не создаётся;
- documentation warning остаётся текстовым: dialog/toast при включении не нужен.
