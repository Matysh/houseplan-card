# #471 — Убрать видимые raised plates вокруг элементов изометрического View

- **Issue:** https://github.com/Matysh/houseplan-card/issues/471
- **Тип / приоритет:** bug + polish / P1
- **Трек:** полный; задача отменяет явно принятый UX-контракт Stage 3 из #160,
  поэтому не проходит критерий лёгкого трека «нет нового или изменённого
  UX-контракта»
- **Оценка:** пользовательская ценность 8/10; ценность для архитектуры 7/10;
  сложность 4/10; риск 4/10
- **Связано:** #89, #122, #160; `docs/ISOMETRIC.md`,
  `docs/adr/160-isometric-stage3-overlays.md`

## 1. Сценарий

Персона — Home admin из `docs/SCOPE.md`, который тестирует скрытый
изометрический режим в полном House Plan View на desktop, wall tablet либо
телефоне. Момент — план со множеством устройств и подписей комнат целиком
вписан в доступную область, поэтому белые подложки поднятых элементов занимают
заметную долю изображения и перекрывают архитектуру.

## 2. Что человек увидит до и после

**До:** вокруг маркеров видны дополнительные белые квадраты, а под длинными
названиями комнат — широкие белые полосы, пересекающие пол и стены.

**После:** остаются сами маркеры с их штатными компактными подложками и обычный
текст комнаты; дополнительного прямоугольного фона вокруг полного габарита
элемента нет.

## 3. Подтверждённая причина и заменяемый контракт

Артефакт является намеренной частью Stage 3, а не браузерной ошибкой:

- `ISO_RAISED_FOOTPRINT` и `isoRaisedOverlayHalfSize()` в
  `src/iso-scene-render.ts` вычисляют консервативный габарит для device,
  room-label и opening-lock;
- `resolveIsoOverlayPlacement()` в `src/iso-overlays.ts` проецирует этот габарит
  и использует его для wall collision, nudge и tether policy;
- `renderIsoRaisedOverlays()` рисует тот же габарит как SVG polygon;
- `.iso-overlay-plate` в `src/styles/plan.styles.ts` имеет почти непрозрачную
  светлую заливку `rgba(248, 249, 247, 0.9)`;
- room footprint резервирует worst-case ширину всех включённых метрик, а device
  footprint — auxiliary extent, даже если фактическое содержимое короче;
- golden `demo/golden/baselines/isometric-stage3-overlays-light.png` и
  contract/smoke тесты сейчас закрепляют наличие видимого polygon.

Первый коммит с поведением — `ee7d4869` из #160. D3 и AC4 исходного ТЗ #160,
ADR и текущий `docs/ISOMETRIC.md` называют эту поверхность raised plate.

#471 заменяет только визуальную часть этого решения: консервативная геометрия
остаётся невидимым collision/fit footprint, но больше не является декоративной
поверхностью. Сам raised plane, координаты и интерактивность не отменяются.

## 4. Решение владельца

В изометрическом View ни у одного поднятого overlay нет отдельной видимой
floor-parallel подложки по его общему прямоугольному габариту.

Единое правило применяется к:

1. device marker целиком;
2. room name и room metrics card;
3. opening lock marker.

Штатные собственные поверхности содержимого не относятся к удаляемой plate:

- shell/core маркера устройства;
- value badge, LQI и прочие satellite badges;
- компактная поверхность lock marker;
- focus/selection/hover affordance, определённые самим интерактивным root.

Grounding shadow и tether остаются. Консервативный footprint остаётся
невидимой расчётной геометрией для collision, nudge, fit/home и room fit.

## 5. Скоуп

1. Прекратить вывод видимых SVG plate и plate texture для всех трёх raised
   overlay kinds.
2. Сохранить footprint и все потребляющие его placement/bounds алгоритмы без
   числового изменения результата.
3. Развести в именовании и документации невидимый footprint и удалённую
   декоративную plate, чтобы safety envelope нельзя было снова принять за
   пользовательскую поверхность.
4. Удалить ставшие неиспользуемыми plate styles и overlay texture definition;
   grounding shadow definition сохранить.
5. Переписать contract/unit/browser доказательства, которые сейчас требуют
   видимый polygon.
6. Переснять затронутые изометрические golden только через независимое Linux
   acceptance по общему процессу.
7. Актуализировать текущие внутренние документы Stage 3.

## 6. Не входит

- изменение высоты raised plane, камеры `4°/20°`, wall height или visual offset;
- изменение размеров консервативного footprint;
- новое измерение фактического DOM, `ResizeObserver` либо layout read-loop;
- изменение wall collision, owner selection, nudge direction/cap или tether
  visibility rules;
- удаление grounding shadow либо tether;
- новый фон, text shadow, blur, outline или другая замена белой plate;
- редизайн shell/core, badge, room typography либо opening lock;
- изменение z-order, Zigbee topology, Glow, sunlight, vacuum и opening volume;
- новые настройки, schema/config/layout/storage поля, миграция либо i18n;
- публичное включение изометрического режима;
- изменение Flat, редакторов или `houseplan-space-card`.

Если читаемость конкретного текста без общей подложки окажется недостаточной,
альтернативный локальный text treatment требует отдельного продуктового
решения и не добавляется в #471 попутно.

## 7. Контракт невидимого footprint

Для каждого raised overlay по-прежнему вычисляются:

1. неизменная логическая floor-точка;
2. projected floor point;
3. raised point до nudge;
4. консервативный screen-facing footprint на raised plane;
5. конечный visual point и тот же footprint после nudge;
6. grounding и tether geometry.

Footprint не попадает в SVG/HTML как закрашенная или обведённая поверхность и
не создаёт собственный stacking/paint artifact. Он остаётся входом для:

- пересечения с canonical wall silhouettes и safety gap;
- bounded inward nudge;
- `nearWallBefore` / `nearWallAfter` и tether visibility;
- `isoOverlaySceneBounds()`;
- стабильного `resolveIsoOverlayFitEnvelope()` для fit/home и room fit.

Удаление декора не должно менять ни одну координату либо boolean/status
placement result на одинаковом входе. Переименование внутренних полей
`plate*` в `footprint*` предпочтительно и не является изменением модели данных.

## 8. Контракт рендера и композиции

`iso-overlays-svg` сохраняется как inert слой для grounding и tether. В нём не
должно быть `.iso-overlay-plate`, `.iso-overlay-plate-texture` либо эквивалентной
залитой/обведённой геометрии footprint.

Порядок остаётся прежним:

1. floor/live content;
2. structural walls/openings;
3. grounding/tether cues;
4. screen-facing HTML markers/labels/locks;
5. системные tooltip/dialog/chrome.

HTML roots продолжают получать один и тот же `visualScene`. Их role, tabindex,
accessible name, pointer/keyboard handlers, hit target и CSS собственных
элементов не меняются.

`layers.materialNuance` больше не создаёт overlay texture pattern, потому что
допустимой поверхности для него нет. `layers.shadows` продолжает управлять
только grounding shadow. Ошибка decorative capability не должна переводить
сцену в Flat.

## 9. Режимы, состояния и graceful degradation

- Light/dark theme используют одно правило «без plate».
- Forced colors не возвращает `fill: Canvas` вокруг overlay; собственные
  нативные поверхности marker/lock продолжают существующий forced-colors
  контракт.
- No-filter скрывает grounding nuance как раньше, но не меняет наличие
  содержимого.
- Reduced motion ничего не меняет в конечном кадре; новой анимации нет.
- Kiosk и coarse pointer показывают тот же результат, сохраняя минимум 44×44 px
  у интерактивного HTML root.
- `show_borders:false` по-прежнему полностью отключает raised placement,
  grounding и tether и возвращает overlays к floor anchor.
- Flat, Plan/Devices/Background editors и static card не получают изменений DOM
  либо CSS.

## 10. UX и доступность

Новых контролов, жестов, подсказок и текстов нет. Изменение только убирает
визуальный шум. Room fit/Area link, device click/context action и opening-lock
semantics остаются действующими.

Invisible footprint, grounding и tether не получают role, accessible name,
tab stop или pointer events. Focus ring принадлежит исходному HTML root и не
зависит от удалённой plate.

## 11. Модель данных, совместимость и i18n

Config, layout, backend stores, schema version, export/import и localStorage не
меняются. Миграции и downgrade converter отсутствуют.

Внутреннее переименование поля placement не сериализуется и не является
compatibility surface. Старый frontend после downgrade прочитает те же данные
и снова покажет прежнюю plate.

Новых или изменённых строк нет; словари EN/RU/DE/FR не меняются.

## 12. Производительность и lifecycle

- Structural fingerprint, LRU cap 8 и cache invalidation остаются прежними.
- HA state, hover/focus, pan/zoom и opening update не начинают перестраивать
  structural scene либо читать layout.
- Удаляются до двух SVG polygon на raised overlay и один неиспользуемый shared
  texture pattern; DOM/paint объём может только уменьшиться.
- Footprint/nudge computation сохраняет прежнюю сложность и кэширование.
- Initial Flat graph и alpha lazy boundary не меняются.
- Новый performance profile не нужен; существующие Stage 3 counts,
  `bundle:budget` и точечный isometric smoke не должны регрессировать.

## 13. Security и privacy

Новых API, URL, persistence, HA service call или пользовательского HTML нет.
Удаляемая геометрия уже pointer/ARIA-inert; после исправления существующие
interactive roots остаются единственными владельцами действий.

## 14. Критерии приёмки

### AC1 — видимый результат (browser raster + reviewed golden)

В light и dark изометрическом View отсутствует дополнительный прямоугольный
или квадратный фон вокруг device, room label/card и opening lock. Длинное имя
комнаты при fit/home и минимальном масштабе не создаёт белую полосу через стены.
Штатные shell/core/badges/lock surfaces остаются.

### AC2 — отсутствие скрытых визуальных fallback (contract + smoke)

Raised SVG не содержит `.iso-overlay-plate`, plate texture либо эквивалентной
painted footprint geometry при material nuance on/off, forced colors и
unsupported filter. Возврат одного непрозрачного polygon делает защитный тест
красным.

### AC3 — placement parity (unit exact matrix)

На одинаковых fixtures до/после исправления совпадают floor/raised/visual
anchors, footprint points, nudge vector/distance, near-wall flags, status,
reason, tether и grounding для device, room-label и opening-lock.

### AC4 — fit и границы (unit + browser smoke)

`isoOverlaySceneBounds`, fit/home и room fit продолжают учитывать невидимый
footprint и полный screen-facing root. Конечный viewBox и позиция элементов не
меняются только из-за удаления декора; длинные/короткие имена и 0/часть/все
room metrics не клипуются.

### AC5 — interaction и touch (browser smoke)

Device hover/focus/click/context action, room click/Area link, lock action и
44×44 px target работают по прежним roots. Ground/tether/footprint не
перехватывают pointer. Kiosk/coarse pointer сохраняют View safety floor.

### AC6 — режимы и соседние слои (contract + browser smoke)

`show_borders:false` возвращает floor placement без raised subtree; Flat,
редакторы и static card не меняются. Zigbee topology endpoints продолжают
совпадать с фактическими поднятыми marker positions.

### AC7 — data/performance contract (unit + source contract)

Нет новых config/layout/storage/i18n/network/service полей. Structural
fingerprint/build count и LRU не меняются; overlay material definition count и
polygon count уменьшаются, а bundle остаётся в действующем бюджете.

### AC8 — документация и артефакты (review)

`docs/ISOMETRIC.md`, ADR #160 и исходное ТЗ #160 явно отмечают superseding
решение #471: plate как видимая поверхность удалена, footprint как расчётная
геометрия сохранён. Затронутые golden приняты независимым reviewer из полного
Linux artifact.

## 15. План автотестов и red witnesses

### Unit/contract

1. Обновить `test/iso-overlays.test.mjs`: footprint остаётся четырёхугольником,
   а все placement outputs для free/near-wall/nudged/degraded/no-borders
   fixtures сохраняются.
2. Обновить `test/iso-scene-render.test.mjs`: footprint по-прежнему учитывает
   device auxiliaries и room metrics; scene/fit bounds используют его без
   видимого renderer.
3. Обновить `test/isometric-contract.test.mjs`: запретить plate selectors,
   polygons и overlay texture definition; сохранить raised root, grounding,
   tether, forced-colors и 44 px contracts.
4. Проверить material definition count без orphan `hp-iso-overlay-texture`.

### Browser smoke

Расширить `demo/smoke_isometric_contract.mjs` и при необходимости
`demo/smoke_isometric_live_touch.mjs`:

- dense device set и room label с 0/частью/всеми метриками;
- отсутствие painted footprint в обычном, dark, forced-colors и no-filter;
- неизменные centres/nudge/tether/bounds;
- fit/home и room fit без клиппинга;
- pointer/keyboard/coarse-pointer actions и 44 px target;
- topology endpoint следует фактическому marker root.

### Golden

Переснять только действительно изменённые Iso Stage 3 кадры. Flat baselines
должны остаться byte/pixel unchanged. Обязателен плотный общий кадр с длинными
названиями и несколькими типами marker; возвращённая непрозрачная plate должна
создавать заметный diff.

Golden acceptance выполняет только независимый reviewer через
`npm run golden:accept -- --reviewed` на полном Linux CI artifact с provenance.

### Red witnesses

| Witness | Искусственная поломка | Обязательный красный тест |
|---|---|---|
| W1 | Вернуть один painted footprint polygon | DOM/raster smoke и Iso golden |
| W2 | Удалить footprint из wall collision | near-wall/nudge unit |
| W3 | Удалить footprint из fit bounds | long-room-label fit smoke |
| W4 | Удалить 44 px target вместе с plate | coarse-pointer smoke |
| W5 | Вернуть `fill: Canvas` plate в forced colors | forced-colors contract/smoke |
| W6 | Оставить orphan overlay texture pattern | definition-count contract |

Каждый witness запускается на минимальном тесте и полностью откатывается до
финального зелёного состояния.

## 16. Ожидаемые файлы реализации

Продукт и тесты:

- `src/iso-overlays.ts`;
- `src/iso-scene-render.ts`;
- `src/styles/plan.styles.ts`;
- `test/iso-overlays.test.mjs`;
- `test/iso-scene-render.test.mjs`;
- `test/isometric-contract.test.mjs`;
- `demo/smoke_isometric_contract.mjs`;
- при необходимости `demo/smoke_isometric_live_touch.mjs`;
- затронутые Iso golden после независимого принятия.

Документация:

- `docs/ISOMETRIC.md`;
- `docs/ARCHITECTURE.md`;
- `docs/adr/160-isometric-stage3-overlays.md`;
- `docs/specs/160-isometric-stage3.md`;
- `docs/TESTING.md` и `docs/STATUS.md` только в части действующего Stage 3
  контракта/доказательств;
- этот документ и индекс `docs/specs/README.md`.

Backend, schema, translations и `src/space-card.ts` не меняются.

## 17. Release-артефакты

Изометрический Stage 3 остаётся скрытым за `hp_alpha`, поэтому по действующему
решению #160 реализация имеет `User-Visible: no` и не получает публичную запись
в `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, README, User Guide, HACS или
release body.

Обязательны:

- синхронные manifest-driven bundles через `npm run bundle:sync`;
- адресные unit/contract/browser tests;
- `golden:verify` с ожидаемым Iso diff и отсутствием Flat diff;
- independently reviewed Linux golden acceptance;
- `check-docs` и штатные exact-SHA beta gates;
- обновление внутренних Stage 3 документов в том же product commit.

## 18. Риски и меры

| Риск | Мера |
|---|---|
| Вместе с декором удаляется collision geometry | Отдельное имя footprint и exact placement unit matrix |
| Fit начинает клиповать длинные подписи | Footprint остаётся в scene/fit bounds; browser fit smoke |
| Исчезает штатная shell маркера | AC1 отдельно различает native surface и raised plate |
| Forced colors возвращает белые квадраты | Negative selector + forced-colors smoke |
| Tether/grounding исчезают из-за удаления всего subtree | Отдельные DOM assertions и golden |
| Golden снова закрепляет случайный фон | W1 и обязательный dense reviewed frame |
| Переименование внутреннего поля задевает cache | Structural fingerprint/build-count assertions |
| Улучшение скрытой alpha попадает в публичные notes | Явный `User-Visible: no` и отрицательный список артефактов |

## 19. Откат

Кодовый откат одного product commit возвращает декоративные polygons и styles.
Config/layout/store не меняются, поэтому миграция, восстановление данных и
действия пользователя не нужны. Немедленный пользовательский workaround —
переключиться в Flat либо отключить `hp_alpha`.

## 20. Принятые технические предположения — можно менять на ревью

1. Внутренние `plate`, `plateHalfSize`, `buildIsoPlatePolygon` и
   `plateNearSilhouette` переименовываются в `footprint*`; это снижает риск снова
   отрисовать safety envelope. Допустимо сохранить старые имена, если tests/docs
   столь же однозначно запрещают видимую поверхность.
2. `renderIsoRaisedOverlays()` может сохранить имя и выводить только tethers;
   DOM topology функции не является публичным контрактом.
3. Fit/home намеренно сохраняет прежний envelope, даже если после удаления
   plate визуально можно было бы вписать план плотнее. Изменение framing — другая
   UX-задача.
4. Opening-lock включён в единое правило, потому использует тот же общий
   renderer; оставшийся квадрат был бы тем же артефактом.
5. Grounding shadow остаётся допустимой непрямоугольной подсказкой связи с
   floor anchor и не считается заменой plate.
