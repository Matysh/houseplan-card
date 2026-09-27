# Код-ревью #122 — Isometric Stage 2: hidden visual polish (r1)

- Issue: https://github.com/Matysh/houseplan-card/issues/122
- Спецификация: `docs/specs/122-isometric-stage2.md` (SPEC-REVIEW-122-r1: green)
- Диапазон: `git diff origin/dev...HEAD` на коммите `42b3f44` (`feat: add hidden
  isometric stage 2`), плюс сопутствующие `76ce755` (ТЗ), `4c73e2c` (ревью ТЗ)
- Роль: ревьюер кода (свежая сессия, без контекста реализации)
- Вердикт: **красный · цикл r1/4 · High: 2 · Medium: 1 → #134**

## Скоуп

Класс файлов коммита `42b3f44`: A (`src/houseplan-card.ts`, `src/iso-openings.ts`
(новый), `src/iso-projection.ts`, `src/iso-walls.ts`, `src/wall-thickness.ts`,
`src/styles.ts`) + B (`test/**`, `demo/smoke_isometric_contract.mjs`,
`demo/smoke_isometric_live_touch.mjs`, `demo/golden/matrix.mjs`,
`tsconfig.test.json`) + C (`docs/ISOMETRIC.md`, `docs/ARCHITECTURE.md`,
`docs/STATUS.md`, `docs/adr/122-isometric-stage2-composition.md`). Класс D
(`dist/**`, `custom_components/houseplan/frontend/houseplan-card.js`,
`demo/srv/assets/houseplan-card.js`, `demo/golden/baselines/**`) **не
изменён вовсе** — см. High-1.

Трейлеры на всех трёх коммитах диапазона корректны: `Issue: #122`,
`User-Visible: no` (фича скрытая, публичного changelog не требует — верно).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, без вывода |
| Unit | `npm test` | green, 766/766 |
| Build | `npm run build` | green, `dist/houseplan-card.js` собран |
| Синхронизация 3 копий бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и то же для `demo/srv/assets/houseplan-card.js` | **FAIL** — расходятся, byte 45, `git diff --stat` 327 insertions / 209 deletions на файл; см. High-1 |
| Целевые браузерные смоки (названы в AC1/AC5/AC6/AC9/AC10/AC11 и напрямую тронуты диффом) | `node demo/smoke_isometric_contract.mjs`, `node demo/smoke_isometric_live_touch.mjs` — **после** `npm run build && cp dist/houseplan-card.js demo/srv/assets/houseplan-card.js`, т.к. коммит не обновил эту копию | оба green, все проверки в JSON-выводе `true` |
| `npm run golden:verify` (диф меняет рендер/геометрию/слои — попадает в критерий «по необходимости») | `npm run golden:verify` (после того же build+copy) | 46/53 сценариев `passed`; 7 `different`: 5 ожидаемо-разных iso-сценариев без принятых эталонов (не блокер сам по себе, эталоны Stage 2 умышленно не принимаются на этом этапе — §12.3 ТЗ), но **2 сценария обязаны были остаться пиксель-идентичными и не остались** — см. High-2, Medium-1 |
| Дифференциальная проверка причинности (A/B) | те же две команды (`npm run build`, `npm run golden:verify`) в `git worktree add /tmp/dev-check origin/dev` | `isometric-no-borders-dark` и `large-house-zoom-250-dark` оба `passed` на `origin/dev` — регрессия строго локализована в этом диффе, не окружение |
| Backend | не прогонялся | правок в `custom_components/**/*.py` нет — не применимо |
| Performance (`large-house-isometric-v1`) | не прогонялся | по ТЗ §10/§12.4 и решению владельца это pre-beta гейт, заблокированный отдельно #124; в этом ревью не требуется |

**Чего не проверял и почему:** полный набор из 127 браузерных смоков (диф не
задевает весь продукт — только iso-поверхность и косвенно `wall-thickness.ts`);
`python -m pytest tests_backend` (без py-правок); performance-профиль (вне
гейта код-ревью, зависит от #124); принятие golden-эталонов (не роль
ревьюера и не требуется до pre-beta).

## Находки

### High-1 — три копии бандла не пересобраны; CI уже красный на этом SHA

Коммит `42b3f44` не трогает `dist/houseplan-card.js`,
`custom_components/houseplan/frontend/houseplan-card.js` ни
`demo/srv/assets/houseplan-card.js` — все три остаются побитово равны
промоушен-коммиту `a282f85` (`build: promote v1.63.0`), то есть Stage-1-коду
без единой строки Stage 2.

Воспроизведение:

```
$ npm run build
$ cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js
dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js differ: byte 45, line 1
$ git diff --stat dist/houseplan-card.js
 dist/houseplan-card.js | 536 ++++++++++++++++++++++++++++++-------------------
 1 file changed, 327 insertions(+), 209 deletions(-)
$ grep -c "invalid isometric opening input" dist/houseplan-card.js   # fresh build
1
$ git show HEAD:custom_components/houseplan/frontend/houseplan-card.js | grep -c "invalid isometric opening input"
0
$ git show HEAD:demo/srv/assets/houseplan-card.js | grep -c "invalid isometric opening input"
0
```

Независимое подтверждение — CI Validate уже прогонялся на этом самом SHA и
уже красный ровно на этом шаге:

```
$ gh run view 31746904479 --repo Matysh/houseplan-card
X frontend in 36s
  ✓ Build
  X Card bundle snapshots in sync
```

Хендофф-комментарий исполнителя утверждает «три отслеживаемые bundle-копии
byte-identical» — это не так; либо команда не выполнялась, либо результат
интерпретирован неверно. Смысл дефекта не формальный: реальный
`custom_components/houseplan/frontend/houseplan-card.js` (то, что грузит HA) и
`demo/srv/assets/houseplan-card.js` (то, что видит демо-стенд и что реально
тестируют браузерные смоки/golden в CI до пересборки) сейчас **не содержат
Stage 2 вовсе**. `smoke`/`golden`/`performance_smoke` в CI зависят от
`frontend` (`needs: frontend`) и поэтому на этом SHA не запускались вообще —
ни один из пре-релизных гейтов не имеет зелёного прогона против настоящего
кода задачи.

Блокирует. AC16 не выполнен.

### High-2 — `show_borders:false` в Iso не сохраняет пиксель-идентичный Stage-1 «no-volume» сценарий

ТЗ §6.6 и ADR «Consequences» требуют: при `show_borders:false` в Iso
Stage-2-геометрия отсутствует целиком, и AC7/AC15 требуют, чтобы
`isometric-no-borders-dark` остался неизменным. Golden показывает
значительную регрессию:

```
$ npm run build && cp dist/houseplan-card.js demo/srv/assets/houseplan-card.js
$ npm run golden:verify
different  isometric-no-borders-dark
```

Из `artifacts/golden/golden-report.json`:
`differingPixels: 169919, diffRatio: 0.2194 (≈22%), maxObservedDelta: 206`.
Повторный прогон — идентичные числа (детерминированно, не флейк). На
`origin/dev` (та же команда, тот же `git worktree add /tmp/dev-check
origin/dev`, тот же Chromium 151.0.7922.34) сценарий `passed` чисто.

Причина по коду (`src/houseplan-card.ts:4503-4522`, `_isoScene()`):
рамка проекции теперь всегда строится с
`floorDepth: ISO_FLOOR_EDGE_HEIGHT` и объединяется с `isoOpeningBounds()` через
`unionRect(flat, openingFrame)` **независимо** от `disp.showBorders` /
`resolveIsoDecoration().structural`. В Stage 1 рамка включала только
`wallHeight`; Stage 2 добавляет глубину пола и границы проёмов всегда, даже
когда сама геометрия стен/проёмов/края пола не рисуется (`structural=false`).
Это меняет коэффициент "сжатия" `floorView`, и весь план визуально сдвигается/
масштабируется иначе, чем в принятом Stage-1 baseline — то есть нарушение не
косметическое, это другой кадр.

Похоже на конфликт двух требований ТЗ: AC12 хочет единую рамку, не зависящую
от переключения `show_borders` (чтобы zoom не менялся), а AC7/AC15 хотят
байт-в-байт то же изображение, что и Stage 1, где такой рамки не было. Решить
это — работа автора (например, включать `floorDepth`/`openingFrame` в рамку
только когда `structural===true`, и объяснить в ADR, почему AC12 всё равно
держится). Ревьюер такие продуктовые компромиссы не решает.

Блокирует. AC7 и AC15 не выполнены буквально.

### Medium-1 — регрессия пикселей во Flat-сценарии при выключенном Labs → #134

`large-house-zoom-250-dark` (без `labs`/`projection` в `demo/golden/matrix.mjs`
— чистый Flat, Labs неактивен) на `origin/dev` проходит чисто (`passed`), на
этой ветке — нет:

```
different  large-house-zoom-250-dark
```

`differingPixels: 920, diffRatio: 0.00105, maxObservedDelta: 201` —
воспроизведено дважды подряд с идентичными числами (не флейк, не дрейф
Chromium: версия в обоих прогонах `151.0.7922.34`).

Это прямое нарушение AC2 («with Labs inactive... Flat... retain their
existing state/action/pixel contract») и инварианта из `docs/ISOMETRIC.md`
(«existing Flat DOM and pixels remain the reference»). В рамках бюджета этого
ревью не удалось локализовать точный узел DOM/CSS, отвечающий за эту
конкретную (небольшую по площади, но не нулевую и стабильную) разницу;
кандидат — новая безусловная обёртка `<g class=${iso ? 'iso-floor-scene' :
nothing} transform=${iso ? isoFloorMatrixCss() : nothing}>` вокруг содержимого
плана в `src/houseplan-card.ts` (добавляется в разметку независимо от того,
активен ли `iso`), но это не доказано построчно — отметка «предположение,
требует дальнейшего разбора автором», а не факт.

Площадь и видимое воздействие малы (0.1% пикселей одного сценария на большом
зуме), поэтому находка не расширяет цикл #122 сверх уже блокирующих High-1/
High-2, но контракт заявлен как безусловный и находка воспроизводима —
заведён отдельный issue #134 со ссылкой на #122, а не оставлена как TODO
в этом документе.

## Что проверено и корректно

- **AC1** (`unit`+`smoke`+код): `iso` остаётся единственным Labs id;
  `demo/smoke_isometric_contract.mjs` подтверждает Flat как дефолт,
  `isometric-contract.test.mjs` подтверждает отсутствие второго флага/ключа —
  прочитано и прогнано, зелёно.
- **AC5/AC6** (открывающиеся элементы): `src/iso-openings.ts` —
  `buildIsoOpeningBasis`/`projectIsoOpening` алгебраически повторяют
  существующий floor-symbol (поворот на 0–10° для gate, симметричные leaves
  для window, один leaf с шарниром для door); `test/iso-openings.test.mjs`
  проверяет неподвижность базиса при live-изменениях, `flip`-инверсию базиса,
  совпадение `unavailable`≡no-contact через `openingAmount()`, границы через
  `isoOpeningBounds`. Панели помечены `aria-hidden="true" pointer-events="none"`
  (`src/houseplan-card.ts`, рендер `_renderIsoWalls`) — проверено чтением и
  подтверждено смоком `live_touch` (`touchOpeningIsSafe`, `flatIsoActionParity`).
  Тесты умеют падать: `assert.deepEqual(gateBasis.leaves.map(l =>
  Math.abs(l.turnDeg)), [10, 10])` красится при любой правке угла;
  аналогично для высот leaf.
- **AC4** (floor edge): `buildIsoFloorGeometry`/`floorFootprintGeometry` —
  внутренние/общие границы и вложенные дырки не создают ступень (тест
  «canonical adjacent room union has no edge on its shared boundary», «floor
  edge follows outer components without internal or nested steps»),
  независимые partition/column не расширяют footprint (тест «Stage floor
  footprint excludes detached independent physical bodies»), стабильность к
  порядку/winding подтверждена отдельным тестом. Прочитано и прогнано зелёно;
  тесты специфичны настолько, что удаление одной внешней грани красит их.
- **AC8/AC14** (отсутствие второго свето-слоя, отсутствие новых сетевых/
  конфигурационных путей): `isometric-contract.test.mjs`
  («Stage 2 adds no schema, dependency, storage, network or HA action
  surface») грепает исходники на `localStorage|fetch|XMLHttpRequest|
  WebSocket|callService|config|schema` и `three|babylon|webgl` — прогнано,
  зелёно. `src/styles.ts` не содержит нового источника света, только матовые
  градиенты/тени — прочитано.
- **AC9** (структурный кэш не растёт от HA/темы/hover): фингерпринт в
  `_isoSource()` включает `rooms, walls, openCuts, openings (только
  геометрия/флипы), partitions, roomDrafts, columns, cellCm, gridPitch,
  wallKeyPitch, camera, wallHeight, floorEdgeHeight, algorithm: 3` и не
  включает HA-состояние/тему/hover — подтверждено и тестом
  `isometric-contract.test.mjs` («structural cache includes opening flips and
  excludes live HA amount», прямая проверка исходного текста `_isoSource`
  на отсутствие `_openingAmt|openingAmount|.hass|matchMedia|CSS.supports|
  theme|hover`) и смоком `live_touch` (`sameWallFingerprint`,
  `haUpdateReusesGeometry`, `contactUpdateMovesOnlyLivePanel`).
- **AC11** (деградация): `resolveIsoDecoration` — чистая функция, тест
  «decoration degradation never removes structure or creates floating
  panels» покрывает все 4 комбинации `filtersSupported`/`forcedColors`/
  `hideOpenings`/`showBorders`; `src/styles.ts` содержит
  `@media (forced-colors: active)` и `@supports not (filter: blur(1px))`,
  оба убирают только тени/нюанс материала, не геометрию. Прочитано, логика
  соответствует ТЗ.
- **AC13** — намеренно не проверялось: и по ТЗ (§10/§12.4), и по решению
  владельца это остаётся pre-beta гейтом, заблокированным #124; хендофф
  честно пишет «не запускались».
- Трейлеры коммитов, `User-Visible: no`, отсутствие изменений в
  `custom_components/**/*.py`, i18n и schema — проверено чтением диффа,
  корректно.

## Чего не проверял

- Полные 127 браузерных смоков — диф касается только iso-поверхности и
  `wall-thickness.ts`; прогнаны только два целевых, названных в AC и прямо
  изменённых в этом диффе.
- `python -m pytest tests_backend` — нет изменений в Python.
- `large-house-isometric-v1` performance — вне гейта код-ревью при открытом
  #124 (см. ТЗ §10, решение владельца).
- Принятие golden-эталонов — не роль ревьюера; данные из
  `artifacts/golden/golden-report.json` использованы только как
  диагностика причинности регрессии, не как повод принять/отклонить
  baseline.
- Точная DOM/CSS-причина Medium-1 не изолирована построчно — честно оставлено
  как открытый вопрос автору в #134.

## Итог

Две High-находки блокируют цикл r1: код не собран в те артефакты, которые
реально исполняются (High-1, CI уже подтверждает это независимо), и Stage 2
в текущем виде ломает пиксельный контракт, который ТЗ объявляет безусловным —
`show_borders:false` в Iso (High-2). Третья находка (регрессия чистого Flat)
воспроизводима, но мала по воздействию — заведена как Medium #134, а не
оставлена как TODO. Работа предметно сильная — покрытие юнит-тестами
геометрии открытий и floor edge выдерживает мутации, изоляция
структурного/live кэша сделана аккуратно и подтверждена и тестами, и
смоками — но AC16, AC7 и AC15 не могут считаться выполненными до
пересборки бандла и разбора причины пиксельной регрессии `show_borders:false`.
