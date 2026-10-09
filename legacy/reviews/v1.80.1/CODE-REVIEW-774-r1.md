# CODE-REVIEW-774-r1

Материал ревью: `e4b4b0e6cda3eed899fa3cb2d1e285cd4ae67024` (рабочая копия на нём,
`git log --oneline origin/dev..HEAD` — ровно один коммит). Трек `ask`, заход r1,
блокирующих циклов 0/4.

## Скоуп

ТЗ (r2, зелёное ревью `docs/reviews/SPEC-REVIEW-774-r2.md`) требовало: показать
настоящий контур выбранной комнаты в мастере «Настроить на плане» радара
присутствия, свести все слои мастера (контур, точка монтажа, направление,
опорные точки, диагностический след) к одной проекции, рамку мастера брать из
**вычисленного по содержимому кадра** (`contentFrame`/`spaceFrame`,
`docs/CANVAS.md` §4), а не из статичного `space.vb`, и не ломать Apply/Save,
сохранённую калибровку и соседние поверхности (View радара, calibration solve,
схему).

Изменённые файлы: `src/radar-setup.ts` (две чистые функции `radarSetupFrame` и
`radarSetupProjection`, переработан `render()`/`choosePoint()`),
`src/editors/radar-section.ts` и `src/houseplan-editor-runtime.ts` (прокладка
`contentItems`/`_contentItems` от главной карточки к мастеру),
`demo/smoke_radar_setup.mjs` (+350 строк регрессии), `test/radar-setup.test.mjs`
(+221 строка unit), `scripts/mutation-registry.mjs` (5 новых мутантов),
`docs/CANVAS.md`, `docs/CHANGELOG(.ru).md`. `src/space-geometry.ts` не
изменён — используются уже существующие экспорты.

## Как проверялось

Зелёный Validate на этом SHA уже подтверждён
(https://github.com/Matysh/houseplan-card/actions/runs/37545685321), поэтому
`npx tsc --noEmit`, `npm test`, `npm run build` + сверку бандла из этого
прогона не перегонял. Прогнал сам, т.к. объём гейтов для диффа шире дешёвого
набора (правка editor wizard + browser-smoke):

| Гейт | Команда | Результат |
|---|---|---|
| Полный `npm run gate:small` | `npm run gate:small` | **ok**, 142 с: build+typecheck, no-new-any, render-layout-read, no-new-private-writes, smoke-select, `npm test` (юниты), `bundle-policy --verify`, `bundle:budget`, `unused-locals-gate` — упало 0 |
| Named AC-смок (AC1–AC5) | `node demo/smoke_radar_setup.mjs` | **OK**, все 48 именованных проверок `true`, включая новые #774 |
| AC6-соседний смок (View радара) | `node demo/smoke_radar_live.mjs` | **OK**, 5/5 |
| Отрицательный свидетель AC1 | вручную накатил мутант `radar-setup-contour-scaled-twice` (`point[0]*1000`), пересобрал `test-build`, `node --test --test-name-pattern="#774" test/radar-setup.test.mjs` | **красный**: `#774 every layer goes through the one projection; the frame stays put` падает именно на контуре (`-550000,...` вместо `-550,...`); откатил правку, пересобрал, снова зелёный 6/6 |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | — | 19 прямых совпадений (общие токены `NORM_W`/`cellCm`/`SpaceModel`); решение ниже |
| Реестр мутантов, синтаксис | `node --check scripts/mutation-registry.mjs` | ok; мутанты не гонял (политика #709 — не на разработке) |

Рабочее дерево после прогонов возвращено `npm run bundle:clean` (бандл и
`demo/srv/assets` — генерируемые, в git не было диффа ни до, ни после).

## AC — чем доказано, чем краснеет

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 контур виден, не масштабирован дважды, outlier-комната → `all` | `demo/smoke_radar_setup.mjs`: `outsideContourScaledOnce`, `outsideContourFitsViewBox`, `ordinaryContourScaledOnce`, `outlierRoomOpensOnAll`; unit `#774 frame: ...outlier vote (core → all)` | мутант `radar-setup-contour-scaled-twice` (проверено запуском, красный); мутант `radar-setup-room-left-to-outlier-vote` (прочитан, логика инвертирована на `? core : core`) |
| AC2 рамка и pointer — одна обратимая проекция, letterbox, без clamp | unit `#774 projection: screen → absolute render units → plan units, letterbox honoured` (таблица из 8 точек + вырожденный rect); смок `mountInPlanUnits`, `letterboxPressIgnored`, `storedViewBoxIgnoredWithContent` | мутант `radar-setup-pointer-clamped-to-unit-square`, мутант `radar-setup-frame-from-stored-view-box` (прочитаны: find-строки совпадают с текущим кодом дословно, логика мутации подтверждена разбором — замена ветки на `space.vb` ломает оба теста «offset vb» и «far room») |
| AC3 все слои согласованы, рамка стабильна при кликах/live/resize | смок `frameStableAfterClicksAndLive`, `resizeKeepsFrameAndScene`, `resizeMovesMarksWithMatrix`, `frameStableThroughSession`, `trailInSameProjection`; unit проверяет `x1/y1/x2/y2`, `transform="translate("`, `scale(` и polyline одной функцией `scene()` | мутант `radar-setup-trail-in-plan-units` (проверено логикой: unit ожидает render-unit координаты следа, краснеет на сырых plan units) |
| AC4 Apply ≠ Save, lifecycle | смок `applyReturnsPlanUnits`, `applyReleasesSubscription`, `applyDoesNotPersist`, `closeWithoutSaveDiscards`, `reopenShowsSavedCalibration`, `escapeWithDirtySetupDiscards`; перехват каждого `houseplan/config/set` сравнивается с `saved0` | существующий способ смока (без нового мутанта — поведение Apply/Save не менялось этой задачей) |
| AC5 комната без контура / неизвестный room_id | смок `noContourWarns`, `noContourNoInventedOutline`, `unknownRoomIsAnError`; unit `#774 a room without a contour draws no invented outline` | логика `configureOnPlan` не изменена (проверка `!Array.isArray(room.poly)` и `!room` стоят до вызова `begin`) — негативные случаи прежние, регрессии не внесено |
| AC6 соседние поверхности не изменены | `demo/smoke_radar_live.mjs` зелёный; `src/radar-geometry.ts`, backend, схема — вне диффа (`git diff --stat` подтверждает отсутствие изменений) | — (нет нового кода в этих поверхностях, нечему краснеть) |

## Что проверено и корректно

- `radarSetupFrame` (`src/radar-setup.ts:84-103`) буквально реализует контракт
  п.2/п.5 ТЗ r2, закрывающий H1 ревью ТЗ r1: источник — `contentFrame(items)`,
  `space.vb`/`spaceFrame` — только когда `core`/`all` оба `null` (пустое
  содержимое). Сверено построчно с `contentFrame`/`spaceFrame` в
  `src/space-geometry.ts:422-496` — поведение `core`→`all` при невключении
  контура выбранной комнаты и fallback на `spaceFrame` идентичны тому, что уже
  использует `_frameOf()` главной карточки (`src/houseplan-card.ts:5958-6000`),
  что и проверяет смок `frameMatchesMainCard`.
- `items` в `radarSetupFrame` приходят из **того же** `_contentItems()` главной
  карточки (`src/houseplan-card.ts:5898-5937`) через новый член порта
  `_contentItems`, а не из урезанного набора «только комнаты» — ровно то, что
  требовал контракт («Входы рамки те же, что у основной карточки»).
- `radarSetupProjection` (`:113-132`) — корректная инверсия `xMidYMid meet`:
  `k = min(rect.w/frame.w, rect.h/frame.h)`, letterbox вычисляется и
  отбрасывается (возврат `null`), после чего обратное преобразование **не**
  клэмпится к `[0,1]` — числовой разбор таблицы из unit-теста (включая
  отрицательные и `>1` значения) подтверждён исполнением.
- Рамка вычисляется один раз в `configureOnPlan()` (`radar-section.ts:191`) и
  передаётся в `begin()`, а не пересчитывается в `render()`/`choosePoint()` —
  соответствует разделу «Производительность» ТЗ (нет обхода плана на каждый
  pointer/render/live snapshot).
- `glyph`-масштаб (`Math.max(frame.w, frame.h) / NORM_W`) математически
  компенсирует новую переменную рамку так, что экранный размер значков не
  зависит от размера кадра (проверено алгебраически для квадратного и
  прямоугольного случая и подтверждено смоком — размеры/положения значков до и
  после resize совпадают).
- Трейлеры: `Issue: #774`, `User-Visible: yes`, оба `CHANGELOG` правлены в том
  же коммите, формулировка «Настроить на плане» совпадает с
  `docs/USER-GUIDE.ru.md:1328`.
- Единственное видимое пользователю число в диффе — размер SVG `viewBox`
  мастера; у него один источник (`radarSetupFrame`), совпадающий с рамкой
  главной карточки (смок `frameMatchesMainCard`) — дублирования числа нет.
- Бюджеты бандла (`bundle:budget`) и сборка бандла (`bundle-policy --verify`)
  зелёные локально; авторские дельты (+11 Б initial, +347 Б lazy editor) — в
  потолке.
- Риск по изменённым участкам из промпта:
  - touch (:77, `PointerEvent`) — замена `pointFromEvent` на
    `projection.plan(clientX, clientY, rect)` сохраняет семантику
    `event.clientX/clientY`+`currentTarget.getBoundingClientRect()`, которая для
    Pointer Events одинакова для мыши и тача; `event.isPrimary` проверка не
    тронута. Регрессии touch-ввода нет (а она и не гарантирована контрактом
    `TOUCH-SUPPORT.md` для редакторов).
  - perf (:78→:208, `getBoundingClientRect`) — вызов остался ровно там же (один
    раз на `pointerdown`), просто внутри `projection.plan`; ТЗ прямо требовало
    не делать этого чаще, что и имеет место.
  - visual/render (:114, :461, `viewBox`) — см. «Чего не проверял»: изменение
    видимое, но вне golden-покрытия.

## Чего не проверял

- **Golden**: ни одна сцена `demo/golden/` не захватывает мастер «Настроить на
  плане» (`grep -rl radar demo/golden` — пусто), поэтому `ci:golden` для этой
  задачи физически нечего сверять; ТЗ r2 отдельно зафиксировало выбор
  DOM/геометрического oracle вместо golden, и это было принято зелёным ревью
  ТЗ. Внешний вид в светлой/тёмной теме визуально (скриншотом) не сверял.
- Остальные 17 из 19 прямых совпадений `smoke-select` (`smoke_active_chain_ink`,
  `smoke_backdrop_guard`, `smoke_danger_confirmation`, `smoke_decor`,
  `smoke_drag_bounds`, `smoke_grid_scale_invariance`, `smoke_grid_snap`,
  `smoke_help_affordance`, `smoke_infinite_canvas`, `smoke_junction_holes`,
  `smoke_junction_limits`, `smoke_optional_space_model`,
  `smoke_post_write_adoption`, `smoke_space_scale_defaults`,
  `smoke_space_settings_form`, `smoke_stairs`, `smoke_wallthick_standalone`) —
  не прогонял. Совпадение по общим токенам (`NORM_W`, `cellCm`, `SpaceModel`),
  ни один из них не упомянут в AC и не трогает `radar-setup.ts`/
  `radar-section.ts`; `src/space-geometry.ts`, откуда эти токены происходят, в
  диффе не изменён — это чтение уже существующих экспортов новым потребителем,
  а не правка их поведения. Слабая связь, не прогонял.
- `npm run invariants` — не прогонял: дифф не меняет геометрическую модель
  (`src/space-geometry.ts`, `src/types.ts` не тронуты), только потребляет её в
  новом месте.
- `pytest tests_backend` — не прогонял: Python/backend не затронут (диапазон
  диффа подтверждён `git diff --stat`).
- Мутанты реестра не гонял (политика #709 — не на разработке); для AC1
  (`radar-setup-contour-scaled-twice`) красноту проверил вручную отдельно от
  реестрового раннера — см. таблицу гейтов выше. Остальные четыре мутанта
  проверены построчным сопоставлением `find`-строки с текущим кодом (совпадают
  дословно) и разбором логики, не фактическим прогоном через
  `mutation-execution.mjs`.
- Полная матрица golden/perf/mutants — предрелизный гейт, не гейт ревью
  (`docs/process/REVIEWER.md` «Объём гейтов»).

## Находки

Нет ни High, ни Medium, ни Low.

## Вердикт

Зелёный. AC1–AC6 доказаны автотестами с проверенной (для AC1 — исполнением,
для остальных — построчным разбором с совпадающими `find`-строками мутантов)
способностью падать. H1/M1 предыдущего ревью ТЗ закрыты в коде так, как
описано в r2. Риск по touch/perf/visual из промпта разобран и не подтвердился.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/774-radar-wizard-room-contour`, коммит `e4b4b0e6cda3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `b6c56b7df0e7dbec22cc020fe9f40f72f1134b25`
  ```
  git log --all --format='%H %T' | grep b6c56b7df0e7
  ```
- Тело issue: `41f6931e1362dedafe81a40fba8b00c1bd3d844b6d58479b66eb42a198774feb`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:usage input_tokens=4345 output_tokens=32620 cache_creation_input_tokens=141627 cache_read_input_tokens=7057490 num_turns=64 -->
