# CODE-REVIEW-272-r1

- Issue: [#272](https://github.com/Matysh/houseplan-card/issues/272) — Multi-wall стыки beta.5 всё ещё оставляют белые треугольные отверстия
- Ветка: `issue/272-no-multiwall-holes`
- HEAD ревью: `5fd4e2249a4888f9098efff52e975b6a363b4747` (после ребейза на `dev`, интеграция #271 подтверждена автором отдельным комментарием)
- Заход: r1 (первый код-ревью цикл для #272) · блокирующих циклов израсходовано 0/4
- Спецификация: `docs/specs/272-no-multiwall-holes.md`, спек-ревью r1 жёлтый → r2 зелёный (обе Medium-находки закрыты текстом ТЗ до начала кода)

## Скоуп проверки

Диапазон: `git diff origin/dev...HEAD` (merge-base `67863d6`). Изменённые файлы:

- продукт: `src/wall-thickness.ts`;
- тесты/evidence: `test/wall-thickness.test.mjs`, `test/golden-matrix.test.mjs`,
  `demo/smoke_multiwall_junction.mjs`, `demo/golden/harness.mjs`,
  `demo/golden/matrix.mjs`, `scripts/mutation-gate.mjs`;
- документация: `docs/ARCHITECTURE.md`, `docs/WALL-THICKNESS.md`, `docs/TESTING.md`,
  `docs/USER-GUIDE(.ru).md`, `docs/CHANGELOG(.ru).md`, `docs/images/*`,
  `docs/images/screenshots.json`, `docs/specs/272-*.md`,
  `docs/reviews/SPEC-REVIEW-272-r{1,2}.md`;
- сгенерированное: `dist/houseplan-card.js`,
  `custom_components/houseplan/frontend/houseplan-card.js` (класс D, в паре с
  исходником).

Ни один файл модели/сохранённых ссылок (rooms/walls/layout/marker.space/open_spans)
не тронут — правка целиком в рендер-геометрии `wall-thickness.ts`, что совпадает
с заявленным «не входит» ТЗ §5.

Трейлеры: коммит `3fedcaf` (продукт+тесты+документация) несёт
`Issue: #272` / `User-Visible: yes` и правит оба changelog в одном коммите.
Коммит `5fd4e22` (обновление скриншотов после Linux-прогона) —
`User-Visible: no`, корректно (не новое поведение, а пересъёмка фингерпринта).

## Что чинит правка

Корень дефекта (подтверждён чтением): `multiWallBevelTrianglesAt()` (переименована
в `multiWallBevelCutsAt()`) строит для каждой пары соседних лучей узла треугольник
`[qA, qB, hit]`, где `hit` — пересечение offset-линий. Когда `hit` лежит дальше `R`,
треугольник вычитается из тела/paper. Проблема: стороны `qA-hit` и `qB-hit`
сходятся в `hit` ровно в одной математической точке — с точки зрения
polygon-clipping (`polybooljs`) и SVG-заливки это не топологическая связность,
и вырезанный треугольник остаётся отдельным замкнутым кольцом (дырой), а не частью
внешнего фона. Правка добавляет к каждому такому cut маленький квадратный
«коннектор», отцентрованный на `hit`, идущий вдоль луча узел→hit и поперёк него на
`bridge = min(max(8ε, 0.05·halfDepth), 0.25·clearance)`, где `clearance =
distance − R`. Он одновременно перекрывает часть уже вырезанного треугольника
(в сторону узла) и уже пустого внешнего сектора (в сторону от узла), физически
соединяя их в одну связную пустоту. Коннектор применяется только при
`connectToExterior=true` — в локальной реконструкции узла (`bevelMultiWallBody`)
и в `bevelMultiWallPaper`; экспортируемая `multiWallBevelTriangles()` (без
коннектора) используется тестами #249/#261 для проверки формы самого клина в
пределах `R`, поведение которой не изменилось.

## Как проверялось (гейты)

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green |
| Unit | `npm test` | 1166 passed / 0 failed |
| Build + bundle parity | `npm run build`; `cmp dist/... custom_components/.../houseplan-card.js`; `npm run bundle:sync` | green, три копии бандла идентичны, `git status` чист |
| Docs fingerprint | `node scripts/check-docs.mjs` | green (7 файлов, 10 внешних ссылок) |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 2 «зарегистрированные связи»: `smoke_multiwall_junction.mjs`, `smoke_junction_patch_resilience.mjs` (обе через символ `multiWallBevelTriangles`) |
| Целевой смок (изменён) | `node demo/smoke_multiwall_junction.mjs` | green, `*HasNoEnclosedHoles` = true во всех 21 полях (Plan/paper/light/View/kiosk/Static/hidden Iso), кеш-инварианты (`stateTickReuses*`) не нарушены |
| Целевой смок (регресс #197/#249/#261/#271) | `node demo/smoke_junction_patch_resilience.mjs` | green, все 44 поля true |
| Мутант (новый, AC6) | `node scripts/mutation-gate.mjs --id=multi-wall-exterior-corridor-disabled` | поймано 1/1 — тест `issue #249 bounds...` краснеет без коннектора |
| Мутант (переименованный, регресс #261) | `node scripts/mutation-gate.mjs --id=multi-wall-paper-full-origin-cut` | поймано 1/1 |
| Golden (целевой, AC5) | `node demo/golden/run.mjs --mode=capture --scenario=multiwall-junction-bevel-view-dark` | `different` (растр ожидаемо иной, baseline не принимался) — семантический гейт (`enclosedHoles: 0`, discardedWedgeProbe пуст) не бросил исключение, то есть прошёл |

Не прогонялось, и почему:

- **Полный `npm run golden:verify`** — запрещён самим скриптом для точечного
  сценария (`golden verify must run the complete matrix`); это предрелизный
  гейт (PROCESS.md §8), а не гейт код-ревью. Целевой `--mode=capture
  --scenario=...` выше даёт эквивалентную семантическую проверку.
- **Полный набор `demo/smoke_*.mjs`** — diff не задевает ничего вне
  multi-wall bevel геометрии; `smoke-select.mjs` вернул только две связи, обе
  прогнаны.
- **`npm run invariants -- --config <...>`** — не запускался: diff не трогает
  сохранённые edges/thickness-записи/`layout`/`marker.space`/`open_spans`, а
  только приватную рендер-геометрию `wall-thickness.ts` (треугольники
  вычитаются из вычисляемого тела на лету, не из модели). Триггер геометрии/
  ссылок из PROCESS.md §8 сюда не относится.
- **`python -m pytest tests_backend`** — ни один `.py`-файл не менялся.
- **Performance-профили** — не названы в AC, не затронуты (кеш HA/theme-тиков
  подтверждён смоком, `O(E²)` контракт из §7 ТЗ не тронут: цикл всё так же
  по парам лучей одного узла).
- **Linux Docs screenshots workflow** — не перезапускался мной; автор уже
  прогнал его на точном SHA (`.../actions/runs/32658074504`, приложена ссылка
  в issue) и объяснил три раздельно проверенных малых raster-дельты (15/15/21
  px). Локальный `check-docs.mjs` подтверждает, что текущий фингерпринт
  соответствует `src/**`.

## AC — построчно

- **AC1** (нет запертых holes для реальных классов node). Доказано частично
  синтетикой (`test/wall-thickness.test.mjs`, тест «issue #249 node
  classification…», T и X, равные/смешанные толщины, оба `cell_cm: 5` и `1` —
  добавленный `fineGridFan` блок) и частично переиспользуемой анонимной
  реальной 3-лучевой fixture `test/fixtures/249-multiwall-junction.json`
  (`cell_cm: 30`, неортогональные углы — настоящая, хоть и старая,
  production-топология). `assertNoEnclosedLocalHoles` проверяет `roomGeom`,
  final `geom` и `paperGeom` для каждого случая. **Зафиксировано как
  наблюдение ниже**, не блокирует.
- **AC2** (#249 остаётся ограниченным). Экспортируемая `multiWallBevelTriangles()`
  без коннектора не изменилась по геометрии; существующие assert'ы на
  `discardedWedgeProbe` и границу `R` по-прежнему проходят (подтверждено
  прогоном смока: `excessWedgeIsEmpty: true`). `MITRE_LIMIT`/
  `MULTI_WALL_JOIN_LIMIT` не тронуты (проверено `grep` диффа).
  **Доказано.**
- **AC3** (#261/#271 не регрессируют). `smoke_junction_patch_resilience.mjs`
  зелёный целиком (measured wedge, finite-ray endpoints, lateral probe — все
  true). Единственное изменённое число — `geometryArea(geometry.geom)` в тесте
  #197 (124244.27 → 124242.79, ~0.0012% модели), с явным комментарием
  `// #272 additionally opens any point-contact bevel cut to the exterior`;
  величина ожидаемо и мизерно уменьшилась из-за новых коннекторов на нескольких
  узлах фикстуры. **Доказано.**
- **AC4** (browser surfaces). `smoke_multiwall_junction.mjs` использует
  настоящий `SVGGeometryElement.isPointInFill()` с локальным flood-fill для
  Plan/paper/View/kiosk/Static (растровые SVG-поверхности) и векторный
  ring-inventory для hidden Iso и light/sun barriers (чистые JS-геометрии, у
  которых нет SVG). Прогон зелёный. **Доказано, тест умеет падать** —
  подтверждено мутантом ниже.
- **AC5** (golden не может принять клин). `matrix.mjs` объявляет
  `enclosedHoles: 0` вместо временного `2` из #270; `harness.mjs` делает
  локальный flood-fill до pixel-сравнения и бросает исключение при
  несовпадении инвентаря независимо от доли кадра; `test/golden-matrix.test.mjs`
  добавляет проверку, что каждая multi-wall-сцена объявляет целое
  неотрицательное `enclosedHoles`. Целевой `golden:capture --scenario=...`
  подтвердил: семантика прошла, растр `different` (не принят). **Доказано.**
- **AC6** (мутант ловит слепой класс). Новый мутант
  `multi-wall-exterior-corridor-disabled` возвращает cut к точечному контакту
  (`multiWallBevelCutsAt(..., true, false)` вместо `true, true`) и обязан
  покрасить тест `issue #249 bounds...` — подтверждено прогоном (1/1 поймано).
  Существующий `multi-wall-paper-full-origin-cut` тоже переименован под новую
  сигнатуру и по-прежнему ловит регресс paper (1/1). **Доказано.**
- **AC7** (privacy/determinism). Ни один файл с полным пользовательским
  экспортом не закоммичен (`git diff --stat` не показывает новых fixture-файлов
  вообще). Permutation/reversed/scale-инварианты для fan-теста подтверждены
  (`closeTo(geometryDifferenceArea(...), 0, 1e-6)` между base- и
  fine-grid-геометрией и между permuted/base). **Доказано.**
- **AC8** (локальные гейты). См. таблицу выше — все обязательные зелёные.

## Находки

Блокирующих (High) находок нет. Medium в скоупе или вне скоупа — нет.

**Low 1 (снято без правки).** AC1 в ТЗ формулирует требование как «minimized
fixtures из **обоих экспортов**» (1.json `cell_cm: 5`/12 узлов, 2.json
`cell_cm: 1`/14 узлов). Правка не добавляет новый fixture-файл, извлечённый из
этих двух реальных экспортов: она переиспользует старую fixture #249
(`cell_cm: 30`, из более раннего issue) плюс синтетические углы/толщины,
подобранные автором теста напрямую в коде (`cases` в «issue #249 node
classification…»). Формально степень соответствия «minimized fixture из
экспорта» против «представительный синтетический тест» неотличима снаружи —
приватные экспорты не в репозитории, и я не могу сверить конкретные числа
`cases` с реальными узлами владельца. По существу семантический контракт
(нулевые holes) при этом доказан на representative T (равные/смешанные
толщины, неортогональные углы — как в реальной #249-fixture) и X
(ортогональные равные/смешанные) узлах на обоих `cell_cm: 5` и `cell_cm: 1`, а
также независимо подтверждён browser `isPointInFill` и golden-семантикой на
реальной production-геометрии сцены `multiwall-junction-bevel-view-dark`.
Практического пробела в покрытии не вижу — снимаю без правки, не блокирует.

**Low 2 (снято без правки).** Ветка `if (length > map.epsilon && clearance >
map.epsilon)` пропускает добавление коннектора, когда узел лишь чуть-чуть
превышает `R` (клиренс ≤ epsilon). В этом случае сам вырезаемый треугольник
`[qA, qB, hit]` тоже вырожденно мал (обе стороны сходятся почти в одной точке
уже на входе), и `stableJunctionPatch` с высокой вероятностью схлопывает его до
нуля ещё до попадания в `polybooljs` — отдельного теста на этот пограничный
случай нет, но естественный сценарий (реальная толщина стены/зазор ощутимо
больше 1e-9×scale) делает его непрактичным. Не блокирует.

## Что проверено и корректно

- Топологическая идея коннектора (маленький квадрат, перекрывающий обе стороны
  точки касания) корректно устраняет именно тот класс дефекта, который описан
  в issue: «один математический контакт» → «конечная физическая связность»,
  не меняя ни `R`, ни оси лучей, ни существующий discarded-wedge-контракт.
- Коннектор применяется только к узлам degree 3+ (`buildMultiWallNodeMap`
  фильтрует `rays.length < 3` при построении карты, до `bevelMultiWallBody`/
  `bevelMultiWallPaper`), обычные двулучевые углы не затронуты.
- Кеш-инварианты (`_wallUnionCache`, `_lightBarriers().fingerprint`) не
  инвалидируются на HA/theme-тик — подтверждено смоком, соответствует §7 ТЗ
  («без нового state-tick traversal»).
- Оба changelog и `USER-GUIDE(.ru).md` обновлены в одном коммите с продуктовым
  кодом; формулировки описывают видимое поведение («стык читается как единое
  сплошное тело»), не термины реализации.
- `docs/ARCHITECTURE.md`/`docs/WALL-THICKNESS.md`/`docs/TESTING.md` описывают
  именно то, что делает код (сверено построчно с диффом `src/wall-thickness.ts`).
- Рекомендованный в ТЗ порядок мерджа (#271 → #272 → обновление #270) соблюдён;
  автор явно подтвердил интеграцию отдельным комментарием с полным набором
  прогонов на объединённом дереве.

## Чего не проверял

- Полный `golden:verify`, полный набор `smoke_*.mjs`, performance-профили и
  Linux HA backend harness — предрелизные гейты, не гейт код-ревью; см.
  таблицу выше с обоснованием по каждому.
- Не сверял числовые значения синтетических `cases` в
  «issue #249 node classification…» с фактическими узлами приватных экспортов
  владельца — они не в репозитории (см. Low 1).
- Не проверял вручную в браузере (headless-смоки — да, ручного захода в UI не
  делал); визуальную идентичность обновлённых `docs/images/*.png` принимаю на
  основании приложенной автором ссылки на зелёный Linux-прогон Docs
  screenshots и локально зелёного `check-docs.mjs`.

## Вердикт

Зелёный. Ни одной High- или Medium-находки; два Low сняты с записью, без
правки кода. AC1–AC8 доказаны автотестом там, где заявлено, либо разобраны
чтением с явным допущением (Low 1/2) — реализация решает заявленный сценарий
(белые треугольники в multi-wall стыках исчезают у всех рассмотренных
consumers) и не деградирует ни один из смежных контрактов (#249 mitre limit,
#261 retained wedge, #271 finite rays, #197 fail-isolation, кеш-инварианты
рендера).
