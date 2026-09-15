# CODE-REVIEW-582-r3

Issue: [#582](https://github.com/Matysh/houseplan-card/issues/582) — HA Companion:
на плане с масштабом 1 см/точку при pinch появляются фиксированные белые
области.

Материал: `54dc836deec3318e2eac2349f17945b0e6738adb` (рабочая копия была на нём).
Заход r3 · блокирующих циклов ревью 2 из 4 израсходовано.

## Скоуп разбора

Это третий заход, и красный вердикт r2 был получен предметно на материале
`226f3230073afd79a1eef9e2e5979684c9ae628f7` (docs: review document for #582 /
a0a108cf — публикация документа r2 — легла поверх него как чистый commit
класса C, дельту кода не меняла). Автор не ребейзился на ушедший вперёд `dev`
и не менял контракт поведения — правка адресует ровно две находки r2 в той же
архитектуре (`hp-safe-daycycle-outline`), поэтому разбор ведётся по дельте:

```
git diff 226f3230..54dc836d
```

54 файла, из них продуктовый код (класс A) — `src/houseplan-card.ts`,
`src/space-card.ts`, `src/space-render.ts`, `src/styles/plan.styles.ts`;
гейты/тесты (класс B) — `demo/smoke_bg_color.mjs`,
`demo/smoke_daycycle_layer_budget.mjs`, `demo/smoke_smooth_zoom.mjs`,
`scripts/mutation-registry.mjs`, `scripts/smoke-links.mjs`,
`test/paper-scene-contract.test.mjs`; документация (класс C) —
`docs/ARCHITECTURE.md`, `docs/SUN.md`, `docs/TESTING.md`,
`docs/images/screenshots.json` (только fingerprint); остальное — сгенерированный
бандл (класс D, `dist/**`, `custom_components/houseplan/frontend/**`).
Геометрия комнат/рёбер/толщины стен не затронута — `npm run invariants` не
требуется.

## Закрытие раунда r2

| Находка r2 | Чем закрыта | Где это видно |
|---|---|---|
| **High**: контракт п.6 не выполнен — `.hp-static-stage.daycycle .hp-paperg` не тронута дельтой r1→r2, статическая `houseplan-space-card` сохраняла координатно-большой `will-change: filter`, симметрии с полной карточкой не было. | `renderSpaceStatic` теперь с первого кадра рендерит отдельный `<svg class="hp-paper-outline-svg" ... pointer-events="none">` через общий `renderPaperShapes` (тот же helper, что и у `hp-static-plan-svg`); `.hp-static-stage.daycycle .hp-paperg` получила явные `filter: none; will-change: auto; transition: none`, а фильтр/`will-change: filter` переехал на `.hp-static-stage.daycycle .hp-paper-outline-svg`. | `src/space-render.ts:902-906`, `src/styles/plan.styles.ts:93-95,103-108`, `src/space-card.ts:960-963`. Лично прогнан `node demo/smoke_daycycle_layer_budget.mjs`: `staticCardUsesSeparateFilteredOutline`, `staticCardPaperStaysUnfiltered`, `staticCardHasOneOutlineLayer`, `staticCardOutlineLayerIsStageBounded`, `staticCardHasNo4096ContentLayer` — все `true`, `staticOversized: []`. Мутант `daycycle-static-outline-promoted-on-inner-paper` (возвращает `will-change: filter` на `.hp-static-stage.daycycle .hp-paperg`) лично прогнан через `node scripts/mutation-gate.mjs --id=daycycle-static-outline-promoted-on-inner-paper` — заявленный guard (`smoke_daycycle_layer_budget.mjs`) на чистом коде зелёный, на мутанте красный (1/1 поймано). |
| **Medium (в скоупе)**: программные переходы камеры без прямого pointer-жеста — double-tap-to-fit, «Вписать всё», клик по комнате, колесо/кнопки zoom — идут через `_startCameraTransition`, которая нигде не вызывала `_activateSafeDayCycleOutline()`; планшет-киоск на одних кнопках/double-tap весь сеанс оставался в исходной топологии риска. | `_startCameraTransition()` теперь вызывает `this._activateSafeDayCycleOutline()` первой строкой, до `this._cameraTransition.start(...)` — единственная точка входа для `room`, `wheel`, `button`, `fit`/`home`/`double-tap` (все они вызывают именно `_startCameraTransition`, прямой pinch/pan по-прежнему активирует тот же флаг из своих исходных точек на pointer-событиях). | `src/houseplan-card.ts:1273-1287` (сам вызов), вызовы `_startCameraTransition` на `houseplan-card.ts:6381` (room), `6739` (wheel), `6756` (button), `6769` (resetZoom: fit/home/double-tap). Мутант `daycycle-programmatic-camera-skips-safe-outline` (удаляет строку вызова) лично прогнан через `node scripts/mutation-gate.mjs --id=daycycle-programmatic-camera-skips-safe-outline` — guard `smoke_smooth_zoom.mjs` зелёный на чистом коде, красный на мутанте (1/1 поймано). Лично прогнан сам смок: `programmaticCameraActivatesSafeDayCycleOutline: true` (кейс — нажатие кнопки zoom, `_stepZoom`, идущее через `_startCameraTransition`). |

Оба High/Medium из r2 были в скоупе задачи и почищены в той же ветке без
нового issue — ровно так, как требует правило §12/решение 2026-08-19.

## Унаследовано из r2 (и раньше)

Без повторной проверки принято то, что дельта `226f3230..54dc836d` не задевает
и что уже было предметно закрыто в предыдущих раундах:

- **AC1–AC3** (экранно-ограниченный слой контура основной карточки, мутант
  на внутреннюю `.hp-paperg`) — закрыты в r1, документ
  `docs/reviews/CODE-REVIEW-582-r1.md`, подтверждены на SHA красного r1
  (`8e225582`→ дальше не переоткрывались); архитектура `hp-safe-daycycle-outline`
  как отдельный `<svg>`-сосед, устраняющая implicit-overlap слой `plan-svg`, —
  закрыта в r2, документ `docs/reviews/CODE-REVIEW-582-r2.md` на SHA `226f3230`.
  Дельта r2→r3 не трогает `.stage.daycycle` (основную интерактивную карточку) в
  части этого механизма, только добавляет вызов активации в новой точке входа.
- **Item 5 контракта** (один внешний контур без внутренних швов, L-формы не
  превращаются в прямоугольник) — логика объединения paper-силуэтов
  (`renderPaperShapes`, вычисление `paperShapes`) не изменена дельтой r2→r3.
- **AC9** (полевая приёмка на реальном HA Companion) — вне автоматических
  ворот по определению ТЗ, ответственность владельца в следующей бете.

Переподтверждено самостоятельно, а не просто унаследовано, хотя дельта их
прямо не трогает — потому что относятся к тому же визуальному контракту,
который теперь исполняется на объединённом (главная + статическая карточка)
коде:

- **AC4** (свидетель #532, `smoke_daycycle_raster.mjs`) — лично прогнан:
  `ratio: 1.55` при потолке `2` (`pairedRatios: [1.53, 1.59, 1.55]`),
  `staticMedianMs: 138.4`, `dayCycleMedianMs: 211.2`. Совпадает с числом,
  заявленным автором.
- **AC6** (4 golden-сцены day-cycle) — лично прогнан полный
  `npm run golden:verify` (политика `demo/golden/policy.mjs` запрещает
  частичный `--scenario` в режиме verify, только полная матрица): **172/172
  `passed`**, включая `day-cycle-dawn-dark`, `day-cycle-day-dark`,
  `day-cycle-dusk-dark`, `day-cycle-night-dark`. `git status` после прогона
  чист — новых/изменённых файлов в `demo/golden/baselines/**` нет.

## Что проверено и корректно

- **Дисциплина «тест умеет падать»** применена к обоим новым мутантам
  (`daycycle-static-outline-promoted-on-inner-paper`,
  `daycycle-programmatic-camera-skips-safe-outline`) лично, не на слово автора:
  оба поймали свой мутант 1/1 через `node scripts/mutation-gate.mjs --id=...`.
- **Структурный тест** `test/paper-scene-contract.test.mjs` обновлён
  содержательно, а не ослаблен: старое `assert.doesNotMatch(staticRender,
  /class="hp-paper-outline-svg"/)` (r1/r2-архитектура — статика без контура)
  заменено на `assert.match(...)` того же паттерна плюс новая проверка, что
  `_startCameraTransition` содержит вызов `_activateSafeDayCycleOutline()`
  перед `_cameraTransition.start`. Лично прогнан: `node --test
  test/paper-scene-contract.test.mjs` — 2/2 `ok`.
- **CSS не конфликтует**: `.hp-static-stage` не несёt класс `.stage`
  (`src/space-render.ts:898`), поэтому общий селектор `.stage.daycycle
  .hp-paperg` статическую карточку не затрагивает — правило `filter: none`
  для `.hp-static-stage.daycycle .hp-paperg` не соревнуется по специфичности
  с чужим правилом, оно просто в другом поддереве.
  `.hp-static-stage > .hp-paper-outline-svg { z-index: 0; overflow: visible; }`
  в `src/space-card.ts` дублирует (не переопределяет иначе) общее правило
  `.hp-paper-outline-svg` из `plan.styles.ts` теми же значениями.
- **Общий helper** (AC7): и полная карточка (`houseplan-card.ts:11598-11603,
  11626`), и статическая (`space-render.ts:902-906,915`) строят контур и
  видимую бумагу через один и тот же `renderPaperShapes(paperShapes, ...)` —
  не два похожих, а один код.
- **Целевые смоки по дельте** — выбраны `node scripts/smoke-select.mjs --base
  226f3230 --head 54dc836d` (категория «зарегистрированная связь», символ
  `renderPaperShapes`, 5 смоков). Все 5 лично прогнаны и зелёные:
  `smoke_daycycle_layer_budget.mjs`, `smoke_smooth_zoom.mjs`
  (`programmaticCameraActivatesSafeDayCycleOutline: true`),
  `smoke_bg_color.mjs` (`staticCardLayersStayOrdered: true`),
  `smoke_daycycle_raster.mjs`, `smoke_live_pan_coverage.mjs`.
- **Typecheck/build/bundle** — лично прогнаны (не только по ссылке на
  Validate): `npm run build` (`tsc --noEmit && rollup`) без ошибок,
  `node scripts/bundle-sync.mjs` разложил три копии бандла, `git status`
  после этого чист (собранное байт-в-байт совпадает с закоммиченным на этом
  SHA). `npm run bundle:budget`: `initial View: 291143 B gzip` при потолке
  `291700 ±2000` — в бюджете (совпадает с числом автора `291162`, разница —
  шум сборки). Предупреждение о низком запасе (`headroom 9923 Б < 15000`) —
  предсуществующий долг (#367/#474/#499), этой задачей не создан и не
  увеличен заметно.
- **`node scripts/check-docs.mjs`** — лично прогнан, `Documentation checks
  passed (7 files, 12 external links)`; отпечаток `docs/images/screenshots.json`
  в дельте обновлён (`sourceFingerprint` пересчитан), что и требуется при любой
  правке `src/**`.
- **Документация** (`ARCHITECTURE.md`, `SUN.md`, `TESTING.md`) в дельте
  описывает именно новую архитектуру — «static space card uses the same
  stage-sized day-cycle outline from its first frame», а не старое
  «has no camera gesture … keeps its historical inner outline», которое было
  источником находки r2. Текст согласован с кодом, а не переписан частично.
- **Трейлеры/changelog**: `54dc836d` несёт `Issue: #582`, `User-Visible: no` —
  корректно, т.к. запись в оба changelog уже сделана в `a68e4c6b` (первый
  user-visible фикс задачи) и описывает финальное видимое поведение
  («outline appearance and static backgrounds are unchanged»); эта дельта не
  добавляет нового видимого поведения, только достраивает механизм под
  капотом для двух путей, которые r2 поймал незакрытыми.

## Чего не проверял и почему

- **Полный `npm test`** (2714+ юнитов) отдельно не перегонялся — Validate на
  точном SHA `54dc836d` зелёный
  (https://github.com/Matysh/houseplan-card/actions/runs/34959723812), включает
  `npm test` целиком; из затронутого дельтой юнит-теста прогнан адресно
  (`test/paper-scene-contract.test.mjs`, 2/2).
- **`npx tsc --noEmit` отдельно** не гонялся — покрыт тем же Validate-прогоном
  и тем же `npm run build`, который выполнялся лично.
- **Полный `npm run golden:verify`** — вопреки общему правилу «дорогие гейты
  не перегонять, если уже зелёные на SHA», был лично прогнан целиком, т.к.
  политика верификации (`demo/golden/policy.mjs`) не допускает частичный
  прогон в режиме `verify`, а диф правки трогает рендер. 172/172 `passed`.
- **Полная матрица `demo/smoke_*.mjs`** (250 файлов) не прогонялась — вне
  скоупа делты, прогон всех уместен только когда задача трогает всё; выбор
  ограничен инструментом `smoke-select.mjs` (5 файлов, все прогнаны).
- **`npm run invariants`** — не запускался: геометрия комнат/рёбер/толщины
  стен/`layout`/`marker.space`/`open_spans` дельтой не затронута.
- **`python -m pytest tests_backend`** — не запускался: дельта не трогает
  `custom_components/**/*.py`.
- **Perf-профили вне #532-свидетеля** (`npm run benchmark:*`) — не названы в
  AC и не затронуты дельтой, не гонялись.
- **AC9 (полевая приёмка в HA Companion)** — по определению вне автоматических
  ворот код-ревью, остаётся владельцу в следующей бете.
- **«Одно число — один источник»** — задача не добавляет и не меняет ни одной
  видимой пользователю величины (числа, подписи, площади); проверка неприменима.

## Находки

Находок нет. Оба блокирующих High/Medium из r2 закрыты предметно в скоупе
задачи, подтверждены личным прогоном тестов и мутантов (не на слово автора),
делта не вносит новых регрессий в переподтверждённые AC4/AC6.

## Вердикт

Зелёный. High: 0. Medium: 0.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/582-webview-large-filter-layers`, коммит `54dc836deec3` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `767e57c30645bb92213f4cc67e4179bdca734646`
  ```
  git log --all --format='%H %T' | grep 767e57c30645
  ```
- Тело issue: `4c1e1ecfe8ce205f3cfb3c44eb6028a35d0bb4358323e05ba60c6fd85b3b40ba`
- Вердикт конвейера: `green` · High 0
