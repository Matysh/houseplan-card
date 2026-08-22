# CODE-REVIEW-239-r1

- Issue: [#239](https://github.com/Matysh/houseplan-card/issues/239) — масштаб сетки не должен менять внешний вид плана
- Этап: код-ревью, заход **r1** (первый заход код-ревью; ТЗ уже прошло свои r1/r2 отдельно и здесь не пересматривается)
- Ветка/SHA: `issue/239-grid-scale-invariance` @ `0d91c1e18e60bf2fa3adafd6a57bbfb4df3751ba`
- ТЗ: `docs/specs/239-grid-scale-invariance.md`, ревью ТЗ зелёное (`SPEC-REVIEW-239-r2.md`)
- Вердикт: **жёлтый** · High: 0 · Medium: 1 (в скоупе)

## Скоуп

Диапазон `origin/dev...HEAD`, один продуктовый коммит `0d91c1e` (`Issue: #239`,
`User-Visible: yes`). 35 файлов, из них по классам:

- **A** (продукт): `src/grid-scale.ts` (новый), `src/render/opening-symbol.ts`,
  `src/houseplan-card.ts`, `src/styles.ts`, `src/space-card.ts`,
  `src/space-render.ts`, `src/space-geometry.ts`, `src/types.ts`,
  `src/i18n/{en,ru}.json`;
- **B** (гейты/инструменты): `demo/smoke_grid_scale_invariance.mjs` (новый),
  `demo/smoke_space_scale_defaults.mjs` (новый), `scripts/mutation-gate.mjs`
  (+12 мутантов), `test/grid-scale.test.mjs` (новый), правки
  `test/canvas.test.mjs`, `test/opening-symbol.test.mjs`,
  `test/isometric-contract.test.mjs`, `test/open-passage-contract.test.mjs`,
  `tsconfig.test.json`;
- **C** (документация): `docs/CHANGELOG.md`/`.ru.md`, `docs/USER-GUIDE.md`/`.ru.md`,
  `docs/CANVAS.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`,
  `docs/specs/README.md`, `docs/specs/239-*.md`, `docs/reviews/SPEC-REVIEW-239-r{1,2}.md`;
- **D** (сгенерированное): три копии `houseplan-card.js`, `docs/images/03-space-create.png`,
  `docs/images/screenshots.json`.

Никаких файлов `custom_components/**/*.py` — backend вне скоупа, как и заявлено
в ТЗ (§5.2, «миграция не нужна»).

## Как проверялось

### Гейты

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | green |
| unit | `npm test` | 1056/1056 pass, 0 fail, 0 skip (см. примечание ниже) |
| build + сверка бандлов | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | green, три копии побайтно идентичны; `git status` после сборки чист |
| docs fingerprint | `node scripts/check-docs.mjs` | green («7 files, 10 external links») — обязателен, diff трогает `src/**` |
| mutation gate | `node scripts/mutation-gate.mjs --check` | все 12 новых `grid-scale-*` мутантов и вся существующая таблица — `ok` |
| целевой smoke (AC2/3/4/6/7/8/13/14/15) | `node demo/smoke_grid_scale_invariance.mjs` | **нестабилен**, см. находку M1 ниже — 6 красных из 14 прогонов, всегда на одной и той же проверке |
| целевой smoke (AC9/10/11/12) | `node demo/smoke_space_scale_defaults.mjs` | green, 3/3 прогона подряд |
| именованные regression smokes (по grep изменённых символов `gridVisualScale`/`gridVisualUnits`/`op-outline`/`op-hit`/`ISO_WALL_HEIGHT`) | `smoke_opening_preview`, `smoke_opening_measure`, `smoke_inert_openings`, `smoke_open_passage`, `smoke_registryless_opening`, `smoke_styling_hooks`, `smoke_pan_any_zoom`, `smoke_plan_snap_overlay`, `smoke_free_walls`, `smoke_decor`, `smoke_space_card`, `smoke_isometric_contract`, `smoke_isometric_live_touch` | все green, по одному прогону каждый |

**Не прогонялось и почему:** `npm run golden:verify`, полный набор из 163
браузерных smoke и `performance_smoke` — по §8/§11.4 это предрелизный гейт, не
гейт код-ревью; `python -m pytest tests_backend` — diff не затрагивает
`custom_components/**/*.py`, гейту нет предмета.

Примечание по unit-тестам: хендофф автора заявляет «1055 pass, 1 штатный
skip», в этом прогоне — 1056 pass, 0 skip. Расхождение не влияет на вердикт
(итог зелёный в обоих случаях), но фиксирую как замеченное, а не подтверждённое
слово в слово.

### AC — чем доказан каждый

Сверено с матрицей §13.1 ТЗ; ниже — что именно я проверил (тест либо чтение).

| AC | Доказательство | Проверено |
|---|---|---|
| AC1 | `test/grid-scale.test.mjs` | unit зелёный, значения проверены вручную (5/1/2.54/10/25, invalid→1) |
| AC2 | `smoke_grid_scale_invariance.mjs` (flat View) | метрики и pixel diff совпадают **кроме** случайного провала на dark theme, см. M1 |
| AC3 | opening unit tests + тот же smoke | `test/opening-symbol.test.mjs` новый тест `jambHalf/outlineHalf/hitHalf ×5`; смок кликает реальную внешнюю точку hitbox — `openingEdgeHitAndActionMatch: true` во всех 14 прогонах |
| AC4 | тот же smoke, Plan с маской grid | `planPixelsMatchWithEquivalentGridHidden`, `snapPrecisionIsFiveTimesFiner`, `screenFixedPlanSnapStrokeIsNotDoubleScaled` — все true во всех прогонах |
| AC5 | unit negative controls + pair smoke + мутант `grid-scale-physical-double-scaled` | мутант ловится (`ok`), `iconUnit`-тест в `canvas.test.mjs` подтверждает `5× NORM_W` при `cell_cm:1` |
| AC6 | pair smoke Devices/Background | `devicesCriticalMetricsMatch/PixelsMatch`, `backgroundPointerCancelIsMutationFree` — true во всех прогонах |
| AC7 | pair pixel/DOM `houseplan-space-card` | `staticPixelsMatch: true` во всех прогонах; `space-render.ts`/`space-card.ts` читают тот же `gridVisualScale`/`gridVisualUnits` — прочитано в коде |
| AC8 | iso unit (переиспользуемые `iso-projection.test.mjs`/`iso-walls.test.mjs`, не менялись — уже параметризованы по высоте) + pair pixel light/dark + `isoRemainsLabsOnly` | все true во всех прогонах; source-regex в `isometric-contract.test.mjs` подтверждает, что `wallHeight`/`floorEdgeHeight` идут через `gridVisualUnits` |
| AC9 | `grid-scale.test.mjs` + `smoke_space_scale_defaults.mjs` | `metricManualCreateStoresOneCm`, `imperialManualCreateStoresOneInch` — green |
| AC10 | тот же smoke, floors import | `metricFloorImportUsesOneCm`, `imperialFloorImportUsesOneInch` — green; прочитано в `_openNextImport()` — использует тот же `newSpaceCellCm()` |
| AC11 | unit + smoke open→save без правки поля | `existingFiveUntouchedIsLossless`, `existingFractionUntouchedIsLossless`, `missingCellUsesLegacyFiveAndMaterializesFive` — green; прочитано: save-путь берёт `d.cellCm` (canonical), не `d.cellCmInput` |
| AC12 | smoke, EN/RU × metric/imperial, language rerender | `metricRussianField`, `metricLanguageRerenderKeepsCanonical` — green |
| AC13 | **проверено чтением, не исполнением** + мутант `grid-scale-visual-factor-constant`/`-inverted` | `gridVisualScale(5) === 1` — явная ранняя ветка в коде без деления с плавающей точкой; смок подтверждает `referenceFactorIsOne: true` во всех 14 прогонах |
| AC14 | targeted touch/opening smoke | `openingEdgeHitAndActionMatch`, `backgroundPointerCancelIsMutationFree` — true во всех прогонах (реальный `pointerdown`/`pointercancel` с `pointerType: 'touch'`, сверка `_serverCfg` до/после) |
| AC15 | **проверено чтением, не исполнением** | diff не добавляет обходов геометрии по всему плану; каждый `gridVisualUnits()`/`gridVisualScale()` — O(1) арифметика на уже вычисленных величинах; CSS-переменная считается один раз на stage/style-строку |
| AC16 | `check-docs` + чтение обоих changelog/guide | зелёный гейт; тексты RU/EN проверены построчно, согласованы с §9–10 ТЗ |

## Находки

### Medium (в скоупе задачи, чинится в этом issue)

**M1. `demo/smoke_grid_scale_invariance.mjs` нестабилен на проверке `darkViewPixelsMatch` — ~43% прогонов красные без изменений в коде.**

Воспроизведение: 14 последовательных запусков `node demo/smoke_grid_scale_invariance.mjs`
на неизменном коммите `0d91c1e`, без каких-либо правок. Красные — 6 из 14
(#1, #6, #8, #11, #12, #13), все остальные проверки во всех 14 запусках
неизменно `true`. Красная проверка всегда одна и та же —
`darkViewPixelsMatch`, и диагностика идентична между падениями:

```
"darkViewDiff": { "sameSize": true, "changed": 114, "maxDelta": 41,
                   "meanDelta": 0.016858721655042284, "pixels": 593580 }
```

Порог в смоке — `maxDelta <= 40` (`pixelEquivalent()`, строка ~375); падение
идёт ровно на 1 единицу дельты сверх порога, всегда с одинаковым числом
изменившихся пикселей (114 из 593580) и одинаковым `meanDelta`. Это не
похоже на случайный antialiasing-шум (тогда числа плавали бы), а похоже на
двух-модовую гонку — какое-то состояние либо успевает осесть в окне
`settle()` (150 мс после 3 `requestAnimationFrame`), либо нет, и в
неосевшем состоянии рендер стабильно отличается на 114 пикселей именно в
паре View/dark theme. Ни одна другая пара (light View+static, Plan, Devices,
Background, iso light/dark) не дала ни одного красного прогона за то же
число попыток — нестабильность локализована именно в переключении темы в
режиме View.

Я не свёл её к одной строке кода (проверил явные candidate-транзишны:
`.op-leaf`/`.op-arc` — накрыты `@media (prefers-reduced-motion: reduce)` в
`src/styles.ts:875-877`, day-cycle слои — тоже накрыты `:255-261`,
`.glow-spot` — тоже `:691-694`; смок уже включает `reducedMotion: 'reduce'`
через `launch()` и переустанавливает его в каждом `setTheme()`). Причина
может быть глубже в тайминге асинхронного пересчёта устройств
(`_maybeRebuildDevices()`) относительно окна `settle()`, но я не берусь
называть точную строку без дальнейшей отладки автором — это его код и его
конвейер таймингов.

**Почему это находка, а не просто «иногда так бывает».** AC2 и AC13 в матрице
доказательств ТЗ (§13.1) называют именно этот смок единственным
автоматическим доказательством попиксельной инвариантности View. Хендофф
автора заявляет «`demo/smoke_grid_scale_invariance.mjs` — green» без
указания числа прогонов; при вероятности ~43% реальный прогон вполне мог
быть тем самым единственным зелёным, а не свидетельством стабильности.
Нестабильный гейт на `S8-merged`/пре-релизе — ровно тот сценарий, который
`AGENTS.md` описывает как причину лишнего цикла ревью (там же зафиксирована
цена: пропуск гейта на #230/#234 стоил `dev` красным `docs`-job до
следующей задачи). Здесь тот же класс риска, но для `smoke` job.

Это Medium, не High: сама физика инварианта доказана — 13/14 проверок,
включая ту же пару в режиме light (со static-card), совпадают стабильно на
всех 14 прогонах; проблема в допуске/таймінге смока, а не в
продукте. Чинится в этом же issue (владелец 2026-08-19, #202): например,
увеличить `settle()` перед `capture()` при смене темы, либо обосновать и
слегка ослабить `maxDelta`, либо явно дождаться состояния, гонка с которым
и даёт эти 114 пикселей.

## Что проверено и корректно

- Классификация размеров (Physical/Screen/Plan-relative/Visual
  unit/Grid, §6 ТЗ) выдержана в коде: `wallCmToUnits`-путь, decor/furniture,
  Glow, штриховка #230, snap-узлы 5/10 см — не проходят через
  `gridVisualScale`/`gridVisualUnits` (подтверждено grep + мутант
  `grid-scale-physical-double-scaled`, ловится).
- `gridVisualScale(5) === 1` — точное совпадение без накопления погрешности
  плавающей точки (явная ветка `if (value === GRID_VISUAL_REFERENCE_CELL_CM) return 1`).
- Общий CSS-transform на весь SVG отсутствует; масштабирование — точечное,
  через `calc(<const>px * var(--hp-cell-visual-scale, 1))` в `styles.ts` и
  через `gridVisualUnits()` в TS-геометрии — соответствует запрету §6/§7.2 ТЗ.
- `--hp-cell-visual-scale` выставляется и в full card (`houseplan-card.ts`), и
  в static card (`space-render.ts`), с тем же helper'ом; `space-card.ts`
  дублирует только ту одну CSS-правку (wallbody stroke), которая не приходит
  через общий `cardStyles`.
- Скрытая изометрия: `wallHeight`/`floorEdgeHeight` вычисляются один раз на
  сцену и передаются как параметры в уже существовавшие (не изменённые в этом
  диффе) `buildIsoWallGeometry`/`buildIsoOpeningBasis`/`buildIsoFloorGeometry`/
  `projectedFrame`; попадают в `isoGeometryFingerprint` — тёплый remount не
  вернёт геометрию другого `cell_cm` (проверено чтением сигнатур и
  `isometric-contract.test.mjs`).
- Default/compat: manual create и floors-import используют один
  `newSpaceCellCm(this._imperial)`; legacy fallback для отсутствующего/
  некорректного `cell_cm` остаётся 5 и во frontend (`houseplan-card.ts`,
  `space-geometry.ts`), и не тронут в backend/optimizer (вне диапазона диффа).
- Lossless imperial edit: сохранение читает канонический `d.cellCm`, а не
  проекцию `d.cellCmInput` — round-trip через дюймы невозможен без реального
  `input`-события (мутант `grid-scale-imperial-roundtrip-drift` ловится).
- i18n: новый ключ `space.scale_unit_imperial` заведён в EN и RU, подпись поля
  переключается по `this._imperial`; оба changelog и оба user-guide правлены
  в том же коммите, трейлеры (`Issue: #239`, `User-Visible: yes`) на месте.
- Три поставляемых бандла побайтно идентичны после локальной пересборки;
  `check-docs` зелёный, значит скриншот-отпечаток учтён.
- Mutation gate: все 12 новых мутантов `grid-scale-*` пойманы существующими
  guard'ами (unit-тест либо целевой smoke) — правило «тест умеет падать»
  выполнено для покрытых ими путей.

## Чего не проверял

- `npm run golden:verify`, полный набор 163 browser-smoke, `performance_smoke`
  — по процессу это предрелизный гейт, не гейт код-ревью, и в диффе нет
  сигналов, требующих его досрочного запуска.
- Backend (`python -m pytest tests_backend`) — diff не касается
  `custom_components/**/*.py`.
- Не устанавливал точную причину гонки в M1 (не отследил конкретную строку/
  промис, ответственные за таймінг) — это для автора, у которого есть
  контекст реализации `_maybeRebuildDevices()`/`settle()`.
- Не проверял ручное поведение в реальном браузере вне demo-харнесса
  (Home Assistant, реальные темы) — вне доступного окружения ревью.
