# Код-ревью #482 — Доводка экспорта пространства в PDF

- Заход: r1 (первый заход код-ревью; спек-ревью прошло 2 захода и здесь не пересчитывается)
- Диапазон: `origin/dev...HEAD`, финальный SHA `9130c4fc59682e148698b2abed60dc06d6960ab5`
- ТЗ: `docs/specs/482-pdf-export-polish.md` (зелёное спек-ревью r2, `docs/reviews/SPEC-REVIEW-482-r2.md`)

## Скоуп

Задача переписывает четыре подсистемы PDF-экспорта: нормализацию контуров
перед построением размеров (устраняет ложные диагонали из #482), локальную
дедупликацию противоположных размеров, точное позиционирование размеров с
коллизиями, штриховку физических стен/перегородок/колонн, полную компоновку
листа по фактической аннотированной сцене, векторный компас и удаление
легенды, плюс адаптивный диалог экспорта. Diff: 85 файлов, ядро — 6 файлов в
`src/pdf/` (~2450 строк), остальное — тесты, golden, документация,
сгенерированный бандл (класс D).

## Как проверялось

Дешёвые гейты (`tsc`, `npm test`, `npm run build`) подтверждены зелёным
Validate на точном SHA `9130c4fc`
([run 34102355549](https://github.com/Matysh/houseplan-card/actions/runs/34102355549),
`conclusion: success`), это же покрывает `check-docs`, provenance-гейт,
process-гейт, бандл-синхронизацию и бюджет (`bundle:budget` внутри шага
«Card bundle trees in sync»), и все три шарда mutation-gate по диффу
(`Мутанты по диффу (1-3/3)` — success). Отдельно проверил job-список этого
прогона: `golden` — success на этом же SHA; `smoke` и `performance_smoke` в
этом Validate были **skipped** (heavy-гейтинг не активировался для этого
пуша), поэтому их я прогнал сам:

- `node scripts/smoke-select.mjs --base origin/dev --head HEAD` → 11 прямых
  совпадений + 2 зарегистрированные связи (`smoke_pdf_export`,
  `smoke_plan_drawing_repairs`) = 13 смоков, совпадает с перечнем автора в S6.
- `npm run bundle:sync` (свежий бандл для demo-стенда), затем все 13
  выбранных смоков вручную: `smoke_decor_layer_order`, `smoke_decor`,
  `smoke_draw_wall_thickness`, `smoke_grid_snap`, `smoke_near_axis_optimize`,
  `smoke_optional_space_model`, `smoke_room_resize`, `smoke_sun_soft`,
  `smoke_wall_thickness`, `smoke_wallthick_standalone`,
  `smoke_zero_divider_taper`, `smoke_pdf_export`, `smoke_plan_drawing_repairs`
  — **13/13 OK** (все exit 0, все `checkAll` печатают `OK`).
- Performance-бюджет AC11 (`<200 ms`) — коммит `test: isolate PDF performance
  budget` (63d519e3) переносит этот бюджет в юнит-тест
  `test/pdf-scene.test.mjs`, то есть он уже прогнан в рамках зелёного
  `npm test` на этом SHA; отдельный browser-perf прогон не требуется.
- Golden: уже прогнан и принят на этом SHA в CI (`golden` job success), а
  сам accept сделан `--reviewed` с явным `--expect-change`/`--expect-new` по
  полному Linux-артефакту (S6-комментарий, `run 34101566145`), трейлеры
  `Release:`/`Baseline-Reviewed:` на коммите `9130c4fc` подтверждены
  process/provenance-гейтом. Дополнительный ручной `golden:verify` не
  требовался.
- Model invariants (`npm run invariants`) — **не прогонял и не считаю
  обязательным**: diff не трогает модель пространства/рёбра/записи
  толщины/`layout`/`marker.space`/`open_spans` (все изменения — только в
  `src/pdf/**`, печатная геометрия строится поверх уже существующих
  `geometryOuterRings`/`innerContourForRoom`/`wallBodiesGeometry` и не
  модифицирует их; §15 ТЗ прямо фиксирует «модель… не меняются»). Проверил
  это чтением: список файлов diff в `src/` ограничен `src/pdf/*.ts` и
  `src/i18n/*.json`.
- `test/single-source-numbers.test.mjs` не изменён и не упоминает `pdf` —
  проверил, что в новом коде нет второго источника для одной и той же
  видимой величины (PDF-диалог показывает только чекбоксы, не числа; сам PDF
  — единственный источник напечатанных размеров).

## Разбор по AC (чтением кода — не догадка, построчно против diff)

Читал полностью diff `src/pdf/pdf-dimensions.ts` (649 строк),
`pdf-collision.ts` (190, новый), `pdf-writer.ts` (215),
`pdf-compass.ts` (64, новый), `hp-pdf-dialog.ts` (74) и `pdf-scene.ts`
(736, самый крупный файл) лично; плюс тесты
`test/pdf-dimensions.test.mjs`, `test/pdf-writer.test.mjs`,
`test/pdf-compass.test.mjs`, `test/pdf-collision.test.mjs`,
`test/pdf-scene.test.mjs`, `demo/smoke_pdf_export.mjs`,
`scripts/mutation-gate.mjs`.

- **AC1 (диалог 320px, 4 локали)** — `hp-pdf-dialog.ts`: `.body`/`.row`
  получили `min-width:0`/`box-sizing:border-box`; `@media(max-width:360px)`
  переводит `.row` в `grid-template-columns:minmax(0,1fr)`, кнопки
  `width:100%`. DOM-порядок — Cancel первым, Save вторым (строки 160/162),
  что при grid-стекинге даёт «Отмена сверху, Сохранить снизу» как требует
  §7. `demo/smoke_pdf_export.mjs` добавил `narrowLocales`-проверку на
  320×760 по всем четырём локалям: `document/surface/body/footer` scroll
  fits, кнопки ≥44×44 внутри footer, `tabIndex`/DOM-порядок сохранены,
  Cancel закрывает диалог. Прогнал сам — зелёный. **Доказано.**
- **AC2 (схлопывание дублей перед коллинеарностью)** —
  `pdf-dimensions.ts`: `normalizeRing()` вызывает
  `collapseAdjacentDuplicates` (включая шов «последняя→первая» первым)
  **до** `removeForwardCollinearPoint`, повторяет до fixed point
  (строки 216–222). Юнит `test/pdf-dimensions.test.mjs` воспроизводит
  ровно кейс issue (почти совпадающая вершина у угла) и проверяет
  результат по значению, не по количеству точек; мутант
  `pdf-duplicate-normalization-too-late` (глушит
  `collapseAdjacentDuplicates`) прогнан в CI (Мутанты 1-3/3 — success).
  **Доказано.**
- **AC3 (только H/V и near-axis ≤0.25°)** —
  `projectDimensionEdge()` возвращает `null`, если
  `minor/major > NEAR_AXIS_MAX_SLOPE`, без хорды к соседям (edge просто
  выпадает из `dimensionEdgesFromNormalized`, соседние точки не
  соединяются). Юнит проверяет включительную границу и её нарушение на
  `*1.000001`, плюс кейс «диагональный угол не создаёт хорду соседям»
  (`diagonalEdges.length === 3`). **Доказано.**
- **AC4 (локальная дедупликация пары, не глобальная по тексту)** —
  `areOppositeDimensionEdges`/`dedupeOppositeDimensionEdges`: требует
  общий `ringIndex`, противоположные нормали, совпадение
  tangent-интервала и длины, midpoint внутри ring; текст в предикате не
  участвует. Юнит `opposite dedupe preserves equal non-opposite L/C
  contour spans and separate rings` и сценарий `dimension dedupe is local`
  в `pdf-scene.test.mjs` (равные `8.25 m`/`4.65 m` в разных комнатах
  сохраняются по 2 экземпляра) закрывают это по счётчикам, не только по
  наличию функции. **Доказано.**
- **AC5 (центрирование, целая полоса, вогнутая нормаль)** —
  `pdf-scene.ts`: внутренние/внешние лейауты используют точные
  `pdfBoxTouchesGeometry`/`pdfSegmentTouchesGeometry`/`pdfSegmentTouchesBox`
  (не сэмплированные точки), сдвиг полосы целиком — внутренние группы по
  `normalKey` (ось+знак нормали) шагами 3мм, внешние — по
  `groupCollinearDimensionEdges` (ось+знак+координата) шагами 4мм; при
  неудаче на всех шагах подпись **опускается**, а не рисуется поверх стены
  (комментарий «omit the unsafe label rather than knowingly printing it
  through a wall»). Внутренняя группировка по одному только
  axis+normalSign (не по точной коллинеарности) — на первый взгляд похоже
  на потенциальную избыточную связку двух разных стен одного знака нормали
  в ступенчатой комнате, но это **осознанное и протестированное** поведение:
  `test/pdf-scene.test.mjs` → `'whole dimension lane keeps grouped labels
  centered with 1 mm clearance and no tangent jitter'` — L-образная комната,
  два горизонтальных ребра на разных Y с одинаковым знаком нормали,
  утверждение «one collision moves every label in the normal group by the
  same whole-lane amount» именно такое поведение и фиксирует, попутно
  проверяя отсутствие коллизий с меткой комнаты/площадью. Не нахожу это
  находкой — только уточнение для протокола. `inwardNormalForEdge` (probe
  по обе стороны ребра) заменил старый `ringCentroid`-эвристику;
  `ringCentroid`/`edgeNormal`/`outsideNormal` больше не импортируются в
  `pdf-scene.ts` (проверил grep). **Доказано.**
- **AC6 (`#7f7f7f`, page-anchored hatch, even-odd, zero wall без
  штриховки)** — `pdf-scene.ts`: `WALL = [127/255,127/255,127/255]`;
  `pageHatchLines()` строит диагонали в **абсолютных координатах страницы**
  (`intercept` от `-pageHeight` до `pageWidth+step`, шаг `3mm·√2`), один и
  тот же массив передаётся во все стены/перегородки/колонны → фаза общая,
  швов между соседними телами нет. `hatch` есть только у
  `built.geometry.components` (физические тела ненулевой толщины);
  нулевые стены (`built.zero.lines`) рисуются отдельным путём без `hatch`.
  `pdf-writer.ts`: `hatch`-ветка эмитит `W* n` (even-odd clip) после
  заливки, потом обводку сверху — порядок «fill → hatch clipped → stroke»
  ровно как в §11. Цвет — отдельный `fmtColor` с точностью до 6 знаков
  (`127/255` → `0.498039`, юнит проверяет и что координатный `fmt`
  не изменился — `10.12`, не `10.1234`). Мутанты
  `pdf-wall-material-not-grey`, `pdf-wall-hatch-removed`,
  `pdf-hatch-loses-evenodd-hole` целятся ровно в эти три инварианта и
  прогнаны в CI. **Доказано.**
- **AC7 (обе ориентации по полной сцене, максимальный масштаб,
  центрирование ≤0.5мм)** — `buildPdfPage()`: `preparePdfScene()` считает
  модель **один раз**, затем `PDF_SCALE_SERIES` перебирается по
  возрастанию (значит по убыванию печатного масштаба — первый подошедший
  деноминатор и есть «максимальный масштаб» в терминах ТЗ), для каждого
  масштаба строится полная аннотированная сцена (`buildPdfCandidate`)
  через дешёвый прематч `rawArchitectureCanFit` (консервативный, так как
  добавление аннотаций может только увеличить bbox, никогда не уменьшить —
  корректно как отсекающий фильтр), проверяется `pdfSceneFits(...,
  0.5*MM)`, из подошедших выбирается `betterPdfCandidate` (по доле
  заполнения поля, потом portrait). Старый безусловный резерв 30/48мм
  удалён (grep по `dimensionReserveMm`/`calloutWidthMm` в этом файле —
  не встречается, использованы только реальные bbox через
  `pdfCommandBounds`). Для нефитующихся раскладок — bracket/refine до
  шага 50 и `throw new Error('pdf.failed')`, никакого best-effort
  обрезанного PDF. Мутант `pdf-layout-uses-raw-aspect` и
  `pdf-scale-*`-семейство целятся в эту логику. **Доказано.**
- **AC8 (компас, вращение 0/90/180/270°, лицензия)** —
  `pdf-compass.ts`: `PDF_COMPASS_PATHS` — оба `d`-пути побайтово совпадают
  с каноническим SVG из тела issue (сверил построчно). Юнит
  `test/pdf-compass.test.mjs` геометрически проверяет направление стрелки
  для всех четырёх кардинальных углов через реальную трансформацию
  (`(18,18)→(17,17)` — диагональ иглы), не полагаясь на код писателя;
  подтверждает `0°→[0,-1]` (вверх страницы в top-down координатах),
  `90°→[1,0]`, `180°→[0,1]`, `270°→[-1,0]` — совпадает с §13 буквально.
  `pdf-scene.ts` вызывает `pdfCompassOps` только когда `north !== null`;
  старый код рисования стрелки-треугольника полностью удалён (не оставлен
  под флагом). `THIRD_PARTY_NOTICES.md` (корень и
  `custom_components/houseplan/`) — идентичны побайтово (`diff` пусто),
  содержат точный upstream commit, MIT, copyright VMware 2018; отдельный
  юнит сверяет обе копии нотиса. Upstream-blob я не фетчил (WebFetch не
  доступен в этой сессии — то же ограничение, что и в спек-ревью r1/r2);
  полагаюсь на совпадение путей с телом issue, что автор спек-ревью уже
  явно пометил как не до конца независимо подтверждённое (см. «Унаследовано»
  ниже — не совсем то же самое, это код-ревью r1, но фиксирую тот же
  остаточный пробел). **AC доказан для всего, что проверяемо без сетевого
  доступа.**
- **AC9 (легенда удалена)** — `pdf-scene.ts`: блок построения `legend`
  полностью вырезан (не спрятан за условием), footer оставляет дату/версию
  и scale bar. `pdf.legend.*` удалены из всех 4 локалей (en/ru/de/fr —
  сверил построчно, симметрично). Юнит
  `'PDF scene integrates the vector compass and never restores the
  architectural legend'` проверяет отсутствие текста легенды **и**
  отсутствие обращений к `pdf.legend.*` в `t()`. **Доказано.**
- **AC10 (существующие гарантии #53)** — покрыт существующим/актуализированным
  unit/smoke набором `#53`, входящим в зелёный `npm test`; отдельно не
  перепроверял построчно, полагаюсь на факт отсутствия regressions в
  golden/mutation прогонах на этом SHA.
- **AC11 (perf, lazy bundle)** — `preparePdfScene` вызывает
  `physicalGeometry(input)` один раз и передаёт `prepared` во все
  `buildPdfCandidate`-попытки (до 18+ штук при переборе масштаба/ориентации)
  — модель не перепарсится и растр не передекодируется на каждой попытке.
  Бюджет `<200мс` — юнит-тест (см. «Как проверялось»). Бандл: `manifest`/
  `lazyPdfFiles` не расширился новым top-level импортом (compass — тоже
  файл внутри `src/pdf/`, тянется тем же ленивым модулем), бюджет
  `bundle:budget` зелёный на этом SHA. **Доказано.**
- **AC12 (документация)** — `docs/PDF-EXPORT.md`, `docs/USER-GUIDE(.ru).md`,
  `docs/ARCHITECTURE.md`, `docs/STATUS.md`, `docs/TESTING.md`,
  `docs/specs/053-pdf-export.md` (явная пометка «частично переопределено
  #482»), `docs/specs/README.md` — все обновлены и терминологически
  согласованы (штриховка/компас/легенда/адаптивный диалог описаны
  одинаково в EN и RU). `check-docs` зелёный на этом SHA (screenshot
  fingerprint покрывает весь `src/**`). **Доказано.**

## Трейлеры и changelog

Все 6 коммитов диапазона несут `Issue: #482`. `User-Visible: yes` —
`15b060ac` (fix: polish PDF export) и `7e7c9f3b` (fix: harden PDF dimension
placement) — оба правят `docs/CHANGELOG.md` и `docs/CHANGELOG.ru.md` в том
же коммите; тексты синхронны по содержанию (штриховка/компас/дедупликация/
диалог). `9130c4fc` (test: accept PDF export baselines) несёт
`Release: v1.73.0-beta.4` и `Baseline-Reviewed:` на реальный прогон —
формат и наличие подтверждены зелёным provenance-гейтом в Validate.
Остальные три коммита — `User-Visible: no`, класс B/C (тесты, скриншот,
mutation-gate), трейлеры корректны.

## Мутационное покрытие (выборочно, не полный листинг)

Прочитал diff `scripts/mutation-gate.mjs` целиком и сверил именованные в
S6-хендоффе автора мутанты (`pdf-opposite-dedupe-ignores-safe-side`,
`pdf-rectangle-restores-unsafe-label`, `pdf-duplicate-normalization-too-late`)
и ещё шесть новых (`pdf-diagonal-dimension-restored`,
`pdf-equal-text-deduped`, `pdf-zero-wall-gets-solid-fallback`,
`pdf-wall-material-not-grey`, `pdf-wall-hatch-removed`,
`pdf-hatch-loses-evenodd-hole`, `pdf-layout-uses-raw-aspect`) построчно
против production-кода — каждый патч попадает ровно в ту строку, что
реализует соответствующий инвариант (не decorative-мутант, бьющий мимо).
Все три шарда `Мутанты по диффу` зелёные на этом SHA.

## Что не проверял и почему

- **Байты upstream SVG-коммита VMware** — не фетчил (`WebFetch` недоступен
  в этой сессии); совпадение `d`-путей с телом issue сверил вручную
  посимвольно, этого достаточно для AC8 в объёме, доступном инструментам
  этой сессии.
- **Полный browser-smoke матрикс (229 файлов)** — не входит в объём этого
  раунда; выбор по диффу (`smoke-select.mjs`) дал 13 файлов, все прогнаны.
  Полный прогон — обязанность пред-релизного гейта (PROCESS.md §8), не
  ревью.
- **`python -m pytest tests_backend`** — не прогонял: diff не трогает
  `custom_components/**/*.py`.
- **`npm run invariants`** — не прогонял: diff не трогает модель
  пространства/геометрии, только печатное представление поверх неё (см.
  «Как проверялось»).
- **Полный `npm run golden:verify` локально** — не прогонял: golden уже
  зелёный и явно принят `--reviewed` на этом же SHA в CI, включая новый
  сценарий `pdf-export-polish-light`.

## Находки

Нет High. Нет Medium — ни в скоупе, ни вне скоупа. Единственное
наблюдение (см. AC5 выше про группировку внутренних лейнов по
axis+normalSign без учёта коллинеарности) — не находка: поведение
осознанно и закрыто отдельным юнит-тестом с явной формулировкой
инварианта.

## Вердикт

Зелёный. Реализация построчно соответствует ТЗ, каждый AC либо доказан
целевым автотестом с проверенной способностью падать (мутационный гейт),
либо разобран мной чтением кода с указанием конкретных строк. Трейлеры,
changelog, документация и лицензионный нотис в порядке.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/482-pdf-export-polish`, коммит `9130c4fc5968` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `9f961b813958a7c359d561ba8eea7ee4521aa5d0`
  ```
  git log --all --format='%H %T' | grep 9f961b813958
  ```
- ТЗ `docs/specs/482-pdf-export-polish.md`, блоб `952f595fe2f61d375d317b929b0323bb2441262b`
  ```
  git log --all --find-object=952f595fe2f61d375d317b929b0323bb2441262b -- docs/specs/482-pdf-export-polish.md
  ```
