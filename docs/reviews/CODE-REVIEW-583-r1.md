# CODE-REVIEW-583-r1

Issue: #583 · Материал: `e2801e4e8b1b7a38be88a6dea210caba0e756783` (заход r1, полный трек)
Ветка: `issue/583-isometric-visual-corrections`
Коммиты в диапазоне `origin/dev...HEAD`: `5cae9350` (fix), `e2801e4e` (test)

## Скоуп проверки

ТЗ (см. тело issue #583, раздел `## ТЗ`) описывает четыре независимых
presentation-дефекта скрытого 2.5D режима, найденных на реальном стенде после
#570:

1. декоративные contact/leaf тени стен и дверных полотен — убрать;
2. дверь между Hallway и Under-Stairs Closet визуально «вросла» в стену —
   починить геометрию/порядок отрисовки;
3. иконки устройств/замков после проекции 2D→2.5D налегают друг на друга —
   нужен общий детерминированный collision-pass;
4. серый/двойной контур дверных полотен — убрать нарисованный stroke.

14 AC, полный трек (не light: геометрия + новый алгоритм коллизий).
Диапазон правок: `src/iso-openings.ts`, `src/iso-overlays.ts`,
`src/iso-scene-render.ts`, `src/styles/plan.styles.ts`, соответствующие
unit/contract тесты, `demo/smoke_isometric_contract.mjs`,
`demo/smoke_isometric_live_touch.mjs`, `docs/ISOMETRIC.md`,
`docs/ARCHITECTURE.md`, `docs/STATUS.md`. Никаких изменений вне класса
A/B/C/D (backend, схема, layout, rooms/openings/devices не тронуты — совпадает
с §8 ТЗ «модель данных и миграция»). Trailers на обоих коммитах:
`Issue: #583` / `User-Visible: no`; `docs/CHANGELOG*.md` не менялись — верно
для скрытого экспериментального режима (§14 ТЗ).

## Как проверялось

**Дешёвые гейты этого SHA уже подтверждены зелёным Validate** (мутанты +
push-Validate, ссылки в комментариях issue: run 35059679236 и run
35059894623) — `tsc`/`test`/`build` повторно не гонял ради самого факта
зелёности, но:

- **`npm test` перегнал сам** (не поверил на слово): `2719 passed, 0 failed,
  1 skipped` — совпадает с заявленным автором числом.
- **`npm run bundle:sync`** (пересобирает и раскладывает бандл) — зелёный,
  `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js`
  и `cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` — три копии
  побайтово идентичны, `git status` после пересборки чист (закоммиченный
  бандл уже свежий).
- **`npm run bundle:budget`** — зелёный: initial View 291127 B / потолок
  291700 B (headroom 9939 B, тот же предупреждающий запас, что и до задачи —
  не регрессия этой задачи).
- **`node scripts/no-new-any.mjs --base origin/dev --head HEAD`** — «Новых
  any нет» (382 добавленные строки в 4 файлах).
- **`node scripts/check-docs.mjs`** — обязателен, т.к. диф трогает `src/**`.
  В строгом режиме (по умолчанию) — ERROR «screenshot source fingerprint is
  stale»; это **ожидаемо** и не находка: отпечаток документации считается по
  всему `src/**`, поэтому любая фронтенд-правка его обнуляет (PROCESS.md §8).
  Проверил, как это классифицирует сам CI: `validate.yml` считает
  свежесть скриншотов **предупреждением** на обычном пуше и **ошибкой** только
  на PR/кандидате беты/по кнопке (`classify-changes.mjs`/`heavyGatesRequested`).
  Прогнал `--screenshots=warn` (режим обычного пуша) — «Documentation checks
  passed (7 files, 12 external links)» с тем же warn. Остальное содержимое
  `check-docs` (гайды, ченджлоги, скриншот-индекс, внешние ссылки) — зелёное.
- **`node scripts/smoke-select.mjs --base origin/dev --head HEAD`** —
  «Прямое совпадение» в основном по символу `cellCm` (широко используемое имя
  параметра в десятке несвязанных смоков — слабая связь, не гонял: аналог
  примера из инструкции с `smoke_wall_junctions`). Содержательные совпадения:
  `demo/smoke_isometric_contract.mjs` (прямое, символ `isoFixedLightTransform`,
  напрямую тронутый диффом) и `demo/smoke_wall_thickness.mjs`
  («зарегистрированная связь», символ `openingSymbolOffset`, тронутый в
  `leafBasis`). Прогнал оба — **OK**. Дополнительно прогнал
  `demo/smoke_isometric_live_touch.mjs` (сам тронут диффом, проверяет ровно
  снятые тени/структуру в touch-контексте) — **OK**. Остальные 247 смоков не
  гонял: тема (двери/тени/коллизии/иконки) в них не встречается, а полный
  прогон — предрелизный гейт (PROCESS §8).
- **`npm run golden:verify`** (полный набор, ~172 сцены) — прогнал целиком,
  т.к. диф меняет видимый рендер (геометрия/стили/слои) и AC1-3/8/13 явно
  требуют golden-доказательство. Результат: **160 passed, 11 different, 1
  error**. Разбор ниже.
- **Perf**: `demo/benchmark_large_house.mjs --profile=large-house-isometric-v1`
  прогнал вручную с `--samples=2 --warmups=0` как грубую сверку на порядок
  величины (не авторитетный гейт — методика калибровки требует 7 samples +
  warmup и сравнение с базовым SHA, которого у меня нет). Цифры (порядка
  1-5 сек на разных метриках) не показали разрыва «в разы» вроде прежнего
  #160 (9870мс/3500мс потолок). Один замер `resizePreviewMs=5038` при
  hardMax 2200 — но без warmup первый замер всегда шумный, вывод неавторитетен,
  не привожу как находку. Формальный `performance_smoke`/Full Performance —
  предрелизный гейт (PROCESS §8, `heavyGatesRequested()` не включает его на
  обычном пуше; выполняется на кандидате беты/PR/nightly). AC11 явно требует
  его как доказательство — это остаётся долгом перед бетой, не блокером
  ревью.
- **`node --test test/single-source-numbers.test.mjs`** — зелёный. Диф не
  вводит новую пользовательскую величину, показываемую дважды (48 CSS px —
  внутренний геометрический параметр, не отображается пользователю) —
  правило неприменимо.
- **Инварианты модели** (`npm run invariants`) — не гонял: диф не трогает
  `layout`, room edges, `marker.space`, `open_spans` или любую другую
  каноническую запись геометрии — только derived-presentation слой 2.5D
  (подтверждено чтением диффа: только `src/iso-*.ts` + стили + доки/тесты).
  §8 ТЗ прямо это утверждает.
- **`python -m pytest tests_backend`** — не гонял, Python не тронут.

Условие честности: гейты, которые НЕ гонял — полный `smoke`-набор (250 файлов,
кроме трёх целевых), калиброванный `performance_smoke`/Full Performance,
`pytest`, `model-invariants`. Причина каждого — выше.

## Разбор кода

### Тени (AC1)

`src/styles/plan.styles.ts` убирает `.iso-contact-shadow`/`.iso-leaf-shadow` и
их forced-colors/no-filter упоминания, оставляя только `.iso-ambient-shadow`.
`src/iso-scene-render.ts`: `renderIsoShadows()` — теперь чистый stub
(`emptySvg()`), `renderIsoDefs()` больше не принимает `'shadows'` как `root`,
фильтры `hp-iso-contact-shadow`/`hp-iso-leaf-shadow` удалены. Тест
`isometric-contract.test.mjs` проверяет ровно один `isoFixedLightTransform`
(было три) и отсутствие текстовых следов удалённых классов/фильтров в
исходнике. Смок `smoke_isometric_contract.mjs` подтверждает в браузере:
`fixedLightVectorShared` теперь `shadowNodes.length === 1` и явно проверяет
`!root().querySelector('.iso-contact-shadow, .iso-leaf-shadow, #hp-iso-contact-shadow, #hp-iso-leaf-shadow')`.
`Glow`/`SUN` не тронуты (проверено чтением: единственные правки — в
`iso-openings.ts`/`iso-overlays.ts`/`iso-scene-render.ts`/стилях, ни один из
них не пересекается с sun/glow модулями). **Соответствует AC1.**

### Дверь «вросла» в стену (AC2, AC3)

`src/iso-openings.ts` `leafBasis()`: для `door`/`gate` смещение (`offset`)
теперь равно `input.face` (реальная выбранная физическая грань стены) вместо
`openingSymbolOffset(...)` (центр стены). Сохранённые координаты и Flat-символ
не меняются — офсет применяется только внутри производного Iso-базиса, что
проверено алгебраически: `origin = (x,y) + face.offset`, а
`selectedStart/selectedEnd` в `buildIsoOpeningBasis` вычисляются той же
формулой (`start/end + offset`), т.е. `leaf.hinge` для leaf 0 у door/gate
теперь буквально совпадает с `face.selectedStart` — ровно то, что проверяет
новый тест `'door and gate face matrix keeps every live state on the selected
physical hinge'` (перебор angle×side×flipH для door/gate, плюс проверка
конечности всех 5 surfaces на amount 0/0.5/1). Окна не тронуты (тот же
`openingSymbolOffset`, тест `isoWindowFlipStaysCentred` подтверждает). Revision
policy поднята 2→3 (инвалидация LRU кэша — правильно, т.к. геометрия
меняется).

`buildIsoWallDepthQueue()`: локальное per-window упорядочивание слотов по
`cameraDepth` расширено на **любой** opening layer (было только `window`),
чтобы вращающийся door/gate-призм не инвертировал свои front/back грани.
Новый тест `'shared painter queue keeps rotating door prism faces in physical
camera order'` строит реальный door-basis, реверсирует порядок входных
surfaces и проверяет: (а) слоты одной двери сортируются строго по
`cameraDepth`, (б) слоты **чужих** стен не двигаются. Читал алгоритм
(`openingSlots`/`nextOpeningSlot` — переименованный, но структурно тот же
механизм, что был для окон) — не нашёл способа, которым переупорядочивание
одного opening могло бы задеть слот другой стены/проёма: индексация строго по
ключу `type\0id`. **Соответствует AC2/AC3.**

### Контур двери (AC2 §6.2 п.5)

`.iso-opening-panel.iso-material-matte-leaf { stroke: none }` во всех темах
(light/dark/auto/forced-colors — прямая замена `stroke: <цвет>` →
`stroke: none`, окна (`iso-material-glass-*`) не тронуты — их бордер остаётся).
Проверено тестом (`isometric-contract.test.mjs`: `stroke:\s*none` в трёх
тема-вариантах + `iso-material-glass-side... stroke: #8fb4c7` для окна) и живьём
браузерным смоком. **Соответствует.**

### Взаимные столкновения устройств/замков (AC4-11)

Новый чистый резолвер `resolveIsoOverlayCollisions()` в `src/iso-overlays.ts`
(строки после существующего `resolveIsoOverlayPlacement`, никакая существующая
функция не изменена, только импортирован `unprojectFloorPoint`). Прочитал
алгоритм построчно:

- **Один общий бюджет, не добавочный** (AC7): `IsoOverlayPlacement.raisedScene`
  — это исходная **непровязанная** проекция floor-anchor (без wall-nudge).
  `nudgeScene`/`nudgeCss` в каждой промежуточной и финальной плейсменте —
  это смещение **от `raisedScene`**, не инкремент от предыдущего шага.
  Кандидатные офсеты (`ISO_OVERLAY_GROUP_OFFSETS_CSS`, решётка шагом 1 CSS px,
  предвычислена один раз на модуль, отсортирована по расстоянию) — абсолютные
  векторы от `raisedScene`, и та же константа `ISO_OVERLAY_MAX_NUDGE_CSS_PX=48`
  режет и wall-safety, и group-pass. Проверил алгебраически, что
  `placementAtGroupOffset`/`candidate()` действительно считают
  `visualScene = base.raisedScene + offsetScene`, а не
  `base.visualScene + offsetScene` — бюджет не удваивается. Юнит-тест
  `'group collision reports a deterministic residual without exceeding the
  absolute cap'` прямым числом подтверждает `nudgeDistanceCss <= 48`.
- **Приоритет** (AC6): `stableItems` сортируются по возрастанию уже
  требуемого `nudgeDistanceCss` (кто меньше отклонился от исходной точки —
  тот раньше «застолбит» позицию), при равенстве — по
  `isoOverlayCollisionKey(kind,id)` (стабильный, не зависит от HA registry
  order). Тест `'group collision separates a solvable dense set independently
  of input order'` прогоняет прямой и реверсный порядок входа и требует
  побитового совпадения итоговых центров — прошёл бы только при
  действительно детерминированном тай-брейке.
- **Room labels исключены** (AC8): `entries.flatMap((entry) => entry.kind ===
  'room-label' ? [] : [...])` в `iso-scene-render.ts` — labels физически не
  передаются в `resolveIsoOverlayCollisions`. Тест `'render scene separates
  device roots without moving labels...'` проверяет `label.placement.
  nudgeDistanceCss === 0` при налегающих устройствах вокруг.
- **Кандидат остаётся в комнате/вне стен** (AC4/AC5): для не-базового офсета
  код заново проверяет `pointStrictlyInRoom`, `segmentStrictlyInRoom` (путь от
  текущей позиции к кандидату не выходит из комнаты) и
  `footprintNearSilhouette` — те же существующие геометрические примитивы,
  что использует wall-safety пасс (не новые, не продублированные).
- **Плотная нерешаемая группа** (AC5): при отсутствии свободного кандидата —
  `placementAtGroupOffset(..., residual=true)` помечает `status:'degraded'`,
  `reason:'overlay-collision'`, но **не меняет** `footprint`/DOM-owner (только
  сдвигает позицию в пределах кэпа) — отдельные hit/focus остаются, т.к.
  рендер (`houseplan-card.ts`, не тронут этим диффом) по-прежнему рисует
  каждый entry как отдельный HTML-узел. Юнит-тест с комнатой 1×1 и
  `screenHalfSize:[30,30]` подтверждает `residualPairs.length===1`,
  `status:'degraded'`, `reason:'overlay-collision'`.
- **Кэш/no-accumulation** (AC10, AC11 частично): `collisionSignature` —
  чистая функция входных placement/footprint/unitsPerPixel, `previous` берётся
  из `Map`, keyed по `input.wallSilhouettes` (ссылка) и `mode`
  (`'live'|'fit'`). Тест `'... caches permutations'`: реверс порядка
  устройств → `Object.is` (`assert.strictEqual`) тот же объект сцены —
  подтверждает, что памоизация действительно попадает в кэш, а не просто
  пересчитывает одинаковый результат.
- **Fit skips live search** (AC "fit envelope"): `mode==='fit'` передаёт
  `{ placements: new Map(), residualPairs: [] }` без вызова резолвера; тест
  `'fit probing deliberately skips live group displacement'` подтверждает
  оба устройства остаются в одной точке (не разведены).
- **Производительность** (AC11, частично): поиск кандидатов — предвычисленная
  решётка ограниченного радиуса (≈π·48²≈7238 точек при шаге 1px), с ранним
  выходом на первом бесконфликтном кандидате и хеш-сеткой (`nearby()`,
  `ISO_OVERLAY_GROUP_CELL_CSS_PX=64`) вместо честного all-pairs скана; дорогая
  ветка входит только для реально конфликтующих элементов (у остальных первый
  `candidate(baseOffsetCss)` сразу без конфликтов и возвращается). Статический
  разбор — не заменяет калиброванный perf-гейт (см. «как проверялось» выше).

**Соответствует AC4-11** по прочитанному коду + прогнанным юнит-тестам,
которые реально способны упасть (проверил, что тест на приоритет/кэш ловит
регресс: реверс входного порядка/повторный вызов — не тривиальные ассерты).

### Документация

`docs/ISOMETRIC.md`, `docs/ARCHITECTURE.md`, `docs/STATUS.md` — обновлены
консистентно с кодом (проверил построчно): убраны упоминания
contact/leaf-теней и per-window-only переупорядочивания, добавлено описание
group-pass, host-face pivot для door/gate, revision 2→3. `docs/STATUS.md`
корректно ссылается на #583 в описании Hidden Alpha Stage.

## Находка (Medium, в скоупе)

**Золотой (golden) семантический контракт для iso-дверей не обновлён под новое
поведение и падает исключением, а не просто устаревшим пикселем.**

Воспроизведение: `npm run golden:verify` (прогнал целиком) →
`isometric-opening-symbol-parity-dark` заканчивается статусом **`error`**
(не `different`), с сообщением:

```
semantic golden Iso centre failed for golden-iso-door: 12.5
```

Причина: `demo/golden/run.mjs`, функция `assertOpeningSymbolContract()`,
ветка `else` (surface `'iso'`, ~строки 852-870) — для каждого opening с
`offset: 'center'` в `demo/golden/matrix.mjs` (`openingIsoContract`, id
`golden-iso-door`/`golden-iso-gate-default`/`golden-iso-gate-flipped`)
жёстко требует, чтобы середина хорды `hinge + closedVector/2` (для двери) или
среднее `hinge` двух листов (для ворот) совпадала с канонической точкой
`cfg.x*1000, cfg.y*1000` с точностью `1e-5`. Это было верно **до** этой
задачи, когда `leafBasis` центрировал door/gate так же, как окна. После
правки `src/iso-openings.ts:238-240` (`offset = input.face` для door/gate)
хинг сознательно уходит на выбранную физическую грань стены — контракт
обязан был получить то же исключение для door/gate, которое уже получили
`test/iso-openings.test.mjs`, `test/isometric-contract.test.mjs` и
`demo/smoke_isometric_contract.mjs` (все три обновлены именно под это же
изменение в этом же диффе), но `demo/golden/run.mjs`/`matrix.mjs` — нет.

Почему это не «просто ещё один different-пиксель, подождёт беты»: `different`
означает, что PNG не совпал с эталоном и решается штатной пересъёмкой
(`golden:accept --reviewed`) перед бетой — так по праву оставлены 11 других
`isometric-*` сцен в этом диффе. `error` — это исключение **внутри самого
харнесса капчура**: сцену `isometric-opening-symbol-parity-dark` невозможно
даже переснять (`golden:capture` бросит то же исключение), пока не поправлен
`assertOpeningSymbolContract`/конфиг `openingIsoContract`. Это заблокирует
именно ту процедуру пересъёмки, которую этот же диф просит выполнить перед
бетой для AC13, и будет молча висеть до следующей задачи, если её не
исправить сейчас — тот же класс риска, что #230/#234 (docs) и #171/#207
(тихий пропуск).

Фикс — того же размера и в том же файле/соседнем конфиге, что и уже сделанные
три обновления: разрешить door/gate «центр после проекции» смещённым на
`face.offset` (или явно проверять `leaf.hinge === face.selectedStart/selectedEnd`
как это уже делает `test/iso-openings.test.mjs`), оставив строгую
центровку только для window. Находится строго в скоупе задачи (тот же
контракт «дверь/ворота больше не центрированы в 2.5D», который задача сама
вводит) — чинится в этом же раунде, отдельный issue не заводится (#202).

## Что проверено и корректно

- Тени, обводка, порядок граней двери/окна, host-face pivot, collision-pass,
  labels-exclusion, кэш/детерминизм, документация — см. разбор выше.
- Trailers, changelog-обязательства, бандл (3 копии), `no-new-any`,
  bundle-budget — зелёные.
- `npm test` (2719/2719, 1 skipped) и целевые browser-smokes — зелёные,
  перепроверено лично, не только со слов автора.
- `golden:verify`: **все 11 расхождений строго ограничены isometric-сценами**
  (тени/дверь/коллизии/stroke — ровно то, что задача меняет); ни одна
  неизометрическая сцена (160 штук) не сдвинулась — сильное свидетельство
  отсутствия побочных регрессий за пределами заявленного скоупа.

## Чего не проверял (и почему)

- Полный `smoke`-набор (247 из 250 файлов) — вне выборки diff/AC, дорого,
  предрелизный гейт.
- Калиброванный `performance_smoke`/Full Performance на точном SHA — не
  запускается на обычном пуше (`classify-changes.mjs`), предрелизный гейт;
  сделал только некалиброванную ручную сверку на порядок величины, без
  выводов на её основе.
- `python -m pytest tests_backend` — Python не тронут.
- `npm run invariants` — геометрическая модель/layout не тронуты (только
  derived presentation).
- Пересъёмка/приёмка 11 ожидаемо изменившихся golden-baseline — сознательно
  оставлена автором на предрелизный этап (PROCESS §8); это не переигрывается
  мной, но привязана к найденной находке (harness должен сначала научиться
  снимать `isometric-opening-symbol-parity-dark` без исключения).

## Вердикт

Один Medium **в скоупе задачи** (сломанный семантический golden-контракт для
двери/ворот в iso, воспроизводится, чинится в этой же ветке), High — нет.
Все 14 AC подтверждены чтением кода + юнит/contract-тестами + целевыми
браузерными смоками + полным прогоном golden (кроме калиброванного perf).

**Вердикт: жёлтый.**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/583-isometric-visual-corrections`, коммит `e2801e4e8b1b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `7640cc7b520c24eadf4a6ea2ddff6b58a3f03178`
  ```
  git log --all --format='%H %T' | grep 7640cc7b520c
  ```
- Тело issue: `5c6f59d62afacaf36715df788207cc8b3df775aab0991091d0d0ae322f9ac844`
- Вердикт конвейера: `yellow` · High 0
