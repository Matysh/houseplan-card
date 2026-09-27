# CODE-REVIEW-89-r2 — #89, этап 1: объёмный вид за флагом Labs

- Issue: [#89](https://github.com/Matysh/houseplan-card/issues/89)
- Этап: `code` (PROCESS.md §2.7)
- Диапазон: `origin/dev...HEAD`, `origin/dev` = `22e98c5`, `HEAD` = `6ea3ebf`
  (ветка `issue/89-isometric-stage1`, детач `HEAD`)
- ТЗ: [`docs/specs/089-isometric-view-stage1.md`](../specs/089-isometric-view-stage1.md),
  ревизия 3, ревью ТЗ зелёное — [`SPEC-REVIEW-89-r1.md`](SPEC-REVIEW-89-r1.md)
- Цикл: **r2/4**
- Вердикт: **красный**

## Скоуп ревью

35 файлов, +3079/−825 (генерируемые бандлы `dist/**`, `custom_components/houseplan/frontend/**`,
`demo/srv/assets/houseplan-card.js` — класс D, сверены байт-в-байт с `npm run build`).
Продуктовый код: `src/labs.ts` (новый), `src/iso-projection.ts` (новый),
`src/iso-walls.ts` (новый), `src/houseplan-card.ts` (+286/−18), `src/styles.ts`
(+27), `src/i18n/{en,ru}.json` (+2 ключа каждый). Тесты/гейты (класс B):
`test/iso-projection.test.mjs`, `test/iso-walls.test.mjs`, `test/labs.test.mjs`,
`test/isometric-contract.test.mjs`, `test/golden-matrix.test.mjs` (diff),
`demo/smoke_isometric_contract.mjs`, `demo/smoke_isometric_live_touch.mjs`,
`demo/golden/{harness,matrix}.mjs`, `demo/benchmark_large_house.mjs`,
`demo/performance/{card-contract.mjs,budgets-large-house-isometric.json,README.md}`,
`.github/workflows/performance.yml`, `tsconfig.test.json`, `package.json`.
Документация (класс C): `docs/SCOPE.md`, `docs/ISOMETRIC.md` (новый),
`docs/adr/089-isometric-stage1-renderer.md` (новый), `docs/DEVELOPMENT.md`,
`docs/STATUS.md`, `AGENTS.md`, `docs/specs/README.md`.
Backend (`custom_components/houseplan/**/*.py`), `manifest.json`, `hacs.json`,
README/User Guide/оба changelog — **не тронуты** (проверено `git diff --stat`),
что соответствует D1/D7/AC12/AC15 ТЗ.

Прочитано до вердикта: `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md`, тело issue
#89 и все 15 комментариев (включая `PSEUDO_3D_SPECIFICATION.md` и решения
владельца Q1–Q6/O1–O6), `docs/specs/089-isometric-view-stage1.md` (ревизия 3),
`SPEC-REVIEW-89-r1.md`, `docs/ISOMETRIC.md`, ADR, `docs/CANVAS.md`,
`docs/WALL-THICKNESS.md`, `docs/LIGHT.md`, `docs/UX-MODES.md`,
`docs/TOUCH-SUPPORT.md`, весь новый и изменённый продуктовый код.

## Как проверялось

`npm ci` выполнен перед гейтами (чистая рабочая копия, зависимостей не было).

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | green |
| Unit | `npm test` | **724/724** green |
| Сборка | `npm run build` | green |
| Синхронность бандлов | `cmp dist/… custom_components/…` и `cmp dist/… demo/srv/…` | обе пары идентичны байт-в-байт |
| Whitespace | `git diff --check origin/dev...HEAD` | 3 предупреждения — см. Low L1 |
| Backend (чистый, без HA) | `python -m pytest tests_backend -q` | pytest не установлен в среде; неприменимо — диапазон не трогает `custom_components/**/*.py` (`git diff --stat` пуст), гейт пуст по построению |
| Браузерные смоки (все 127) | `for f in demo/smoke_*.mjs; do node "$f"; done` (тот же цикл, что job `smoke` в `validate.yml`) | **126/127 green, 1 red** — см. находку H1 |
| Golden capture (весь матрикс v17) | `npm run golden:capture` | все существующие плоские сцены — `passed` (0 diff); 6 новых `isometric-*` сцен — `missing-baseline` (ожидаемо: новые эталоны не принимаются в этом коммите, см. AC/§11.3 ТЗ и PROCESS.md §12) |
| Perf-профиль (сквозной прогон, не CI-гейт) | `node demo/benchmark_large_house.mjs --profile=large-house-isometric-v1 --samples=1 --warmups=1` | выполняется целиком, `viewToggleMs` и `isoGeometry` cache size присутствуют в отчёте |

Установка headless Chromium (`npx playwright install --with-deps chromium`)
потребовалась и прошла успешно — без неё браузерные смоки/golden в CI-стиле
были бы недоступны локально, а именно они отвечают на вопрос «оно вообще
работает» для AC1–AC2, AC4, AC7–AC9, AC13–AC14.

### Мутанты (§11.4 ТЗ) — выборочно исполнены

- Мутант 1 («iso без флага») — покрыт `demo/smoke_isometric_contract.mjs`
  (`flatDefault`, `removalIsImmediateFlat`) — прошёл.
- Мутант 4 («`expires` игнорируется») — `test/labs.test.mjs`
  `'registry metadata and numeric-core lifetime fail closed'` — прошёл;
  проверено также вручную (`liveLabsFlags('1.65.0-beta.1')` → флаг мёртв).
- Мутант 5 («боковые грани слоями») — `test/iso-walls.test.mjs`
  `'one top and only O(E) visible sides...'` (`sides.length <= edgeCount`) —
  прошёл; инъекция «удвоить `sides` без увеличения `edgeCount`» вручную в
  Node REPL красит именно этот assert.
- Мутант про инъекцию рендер-исключения (`_isoSource` throws) —
  `demo/smoke_isometric_contract.mjs` (`fallbackLatched`,
  `explicitRetryRestoresIso`) — исполнен реальным браузером, прошёл; убедился,
  что смок умеет падать: временно заменил `shouldFail = false` на `true` без
  сброса — `explicitRetryRestoresIso` покраснел, как и ожидалось.

### Целевая проверка «работает ли AC7 на самом деле» (H1)

`demo/smoke_isometric_live_touch.mjs` красит `liveLayersPresent` и
`floorToOverlayOrderPreserved`. Изолировал причину отдельным скриптом:
`.sunlayer` не монтируется ни в flat, ни в iso при заданных в фикстуре
параметрах (`sun.sun.attributes.azimuth=180`, окно `angle:0, y:0.14` —
северная стена). Прогнал `computeSunRays`-путь через реальную карточку при
азимутах 0/45/…/315°: `.sunlayer` появляется только на 0°/45°/315°, никогда на
180°. Это математически корректное поведение `computeSunRays`
(`windowLit()` не пропускает свет через окно, когда солнце светит с
противоположной стороны дома) — то есть не регрессия рендерера, а ошибка в
геометрии самой фикстуры смока. Подробности — в находке H1.

## Находки

### H1 — обязательный по ТЗ смок `demo/smoke_isometric_live_touch.mjs` красный на сданном коммите

**Файл:** `demo/smoke_isometric_live_touch.mjs`
**Серьёзность:** High — блокирует.

**Воспроизведение:**
```
npm run build && cp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js \
  && cp dist/houseplan-card.js demo/srv/assets/houseplan-card.js
node demo/smoke_isometric_live_touch.mjs
```
Результат (детерминированный, не флейк — параметры фикстуры захардкожены):
```
FAILED (2):
  - liveLayersPresent: expected true, got false
  - floorToOverlayOrderPreserved: expected true, got false
```

**Причина.** Фикстура (строки 24–29 файла) ставит `sun.sun` в
`{azimuth: 180, elevation: 24}` и единственное окно в
`{type:'window', x:0.28, y:0.14, angle:0}` — окно на северной стене комнаты
(`y=0.14`, `angle=0`). При азимуте 180° (юг) `computeSunRays()` →
`windowLit()` корректно не пропускает луч через окно, обращённое на север:
`.sunlayer` не появляется в DOM ни в flat, ни в iso. Проверил перебором
азимутов 0/45/90/135/180/225/270/315° на реальной карточке — луч есть только
при 0°/45°/315° (солнце с севера), при 180° луча нет никогда. Это ожидаемое,
корректное поведение существующего `computeSunRays()` (`src/sun.ts`), не
регрессия из этого диапазона.

**Следствие.** `before.sun` (строка 88 смока) остаётся `0`, поэтому
`liveLayersPresent` красный сам по себе; `.sunlayer` не существует в DOM,
поэтому `ordered.every(Boolean)` (строка 142) тоже красный —
`floorToOverlayOrderPreserved` падает не потому, что порядок слоёв нарушен, а
потому, что один из проверяемых узлов никогда не создаётся. Обе половины
теста, отвечающие за солнечные лучи (сохранение состояния и DOM-порядок
`.sunlayer` между flat/iso), **никогда фактически не исполняются** — ни на
этом коммите, ни, скорее всего, ни разу с момента написания файла, поскольку
per policy (`AGENTS.md` «During the implementation cycle only the fast gates
run») браузерные смоки не запускались до этого ревью.

**Почему это блокирует, а не Medium.** ТЗ (`089-isometric-view-stage1.md`
§11.6) называет именно «live-layer smoke» обязательным доказательством AC7
(«room fills/hover, Glow/spill, солнце… сохраняют state… между flat/iso») и
явно требует от код-ревью «выполнить HA-only update и проверить cache/
source/action parity» — то есть исполнением, не чтением. PROCESS.md §2.7:
«ревьюер убедился, что тест умеет падать» — здесь тест не просто способен
упасть, он **уже красный** на сданном коде. Раз ручного тестирования в цикле
нет, красный обязательный гейт — прямое основание не принимать этап: заявленный
в передаче «test: complete isometric stage 1 gates» набор гейтов не проходит
целиком при реальном исполнении.

**Смежная, не блокирующая часть той же находки.** Чтением кода (`_renderSunRays`
вызывается внутри того же главного `<svg>`, что и остальные floor-слои;
геометрия луча строится в план-координатах и не зависит от `_renderProjection`)
я убедился, что механизм солнечных лучей *устройственно* не привязан к
проекции — при исправленной фикстуре параллель flat/iso почти наверняка
подтвердится. Но это «проверено чтением», а не то же самое, что зелёный смок,
и ТЗ явно требует именно исполнения для этого AC — поэтому не снижаю
находку до Low/Medium на основании своего прочтения.

**Рекомендация автору (не мандат, техническое решение остаётся за ним):**
подобрать в фикстуре либо угол/положение окна, либо азимут солнца так, чтобы
`computeSunRays()` реально вернул луч (например, `azimuth: 0` или окно на
южной стене), и заново прогнать смок перед следующим циклом.

**Вердикт по находке:** блокирует, возврат в `S6-в-разработке`.

### L1 — три файла с лишней пустой строкой в конце (`git diff --check`)

**Файлы:** `docs/adr/089-isometric-stage1-renderer.md:106`,
`src/iso-projection.ts:113`, `test/iso-projection.test.mjs:61`.
**Серьёзность:** Low.

`git diff --check origin/dev...HEAD` печатает «new blank line at EOF» для
всех трёх. Чисто косметическая находка: не влияет на typecheck/test/build (все
три гейта зелёные), не меняет поведение.

**Вердикт по находке:** снимается с записью — правится по желанию автора в
следующем коммите этой же задачи, отдельного issue не требует.

## Что проверено и корректно

- **Гейты.** `tsc --noEmit`, `npm test` (724/724), `npm run build`, три копии
  бандла синхронны байт-в-байт. Commit trailers всех 6 коммитов диапазона —
  `Issue: #89` / `User-Visible: no`, что верно (Labs-скрытая фича, публичного
  поведения нет).
- **AC1** (флаг выключен → без изменений). Подтверждено исполнением:
  `demo/smoke_isometric_contract.mjs` (`flatDefault`) и полный golden-прогон —
  **все** существующие плоские сцены дали `passed` (0 diff) против текущих
  эталонов; отдельный unit (`isoEffectiveView`) и shy-построение геометрии
  (`_isoSceneKey()` возвращает `null` при `!this._labsIso`) проверены чтением.
- **AC2–AC3** (грамматика Labs, версии, fail-closed). `test/labs.test.mjs`
  прогнан — все случаи из §2.2.1/§2.4 ТЗ (`off,iso`, `iso,-iso`, приоритет хэша,
  повтор параметра, malformed registry/version, недоступный storage) покрыты и
  зелёные. Прочитан `src/labs.ts` целиком — реализация буквально соответствует
  описанному в ТЗ алгоритму (порядок query→hash, `off` только «в этой позиции»,
  `window.__hpLabs` — замороженный отсортированный массив).
- **AC4** (камера). `ISO_CAMERA` = `{rotDeg:0, tiltDeg:20, xyScale:1, zScale:1,
  origin:[500,500]}` — внутри диапазона 18–22°, совпадает с pivot
  `NORM_W/2` из ТЗ (§4.4.3). `test/iso-projection.test.mjs` проверяет это
  утверждением на самой камере плюс round-trip на диапазоне `±5000`
  (`docs/CANVAS.md`) — прошёл. Golden-скриншот
  `isometric-geometry-view-dark` открыт и просмотрен визуально: стены не
  повёрнуты по диагонали, углы прямые, парные стены/колонны и дверной проём
  считываются корректно.
- **Математика проекции (проверено чтением + вручную).** `isoFloorMatrix()`
  алгебраически выведена как афинная форма `projectPlanPoint(p,0)` — совпадает
  (тест `'floor matrix is identical to point projection'` подтверждает).
  Важный design-факт, который делает две раздельные SVG-подсистемы (плоскость
  пола через `preserveAspectRatio="none"` на `floorView`, стены/маркеры через
  `preserveAspectRatio="xMidYMid meet"` на `view`) согласованными пиксель-в-
  пиксель: `_applyView()` всегда строит `fit = fitView(vb, this._stageAspect())`,
  то есть аспект `view` **всегда** равен аспекту контейнера, поэтому у
  «meet»-слоя letterbox нулевой и обе техники дают одну и ту же афинную карту.
  Без этого инварианта расхождение floor/walls было бы реальным дефектом —
  инвариант существовал до этого диапазона и не менялся.
- **AC5–AC6** (топология граней, O(E), проёмы). `test/iso-walls.test.mjs`
  прогнан (top/hole rings, full-height gap без «мостика», jamb-грани). Golden
  `isometric-geometry-view-dark/light` визуально показывают: физические стены
  с верх/бок гранями, virtual boundary как пунктир на полу без объёма,
  квадратную повёрнутую и круглую колонну с экструзией, дверной разрыв с
  сохранённой дугой открывания. Источник геометрии — `wallBodiesGeometry(...)`
  (тот же каноничный вызов, что использует свет, `docs/LIGHT.md`); `physicalBodies(...)`
  в `_isoSource()` даёт тот же набор тел (partitions+drafts+columns), что
  кэширующая обёртка `_physicalBodiesR()` во флэт-рендере — порядок элементов
  отличается, для булевого объединения это не имеет значения (сверено чтением
  обеих реализаций в `src/physical-geometry.ts` и `src/houseplan-card.ts`).
- **AC7 — частично.** Golden `isometric-live-layers-dark` и
  `isometric-no-borders-dark` просмотрены: room fill/hover, Glow/spill (видимый
  spill через проём в соседнюю комнату), декор/мебель, устройства с бэйджами
  визуально присутствуют и выглядят корректно в iso; `show_borders:false`
  корректно убирает грани стен, не убирая заливку/Glow. `demo/smoke_
  isometric_live_touch.mjs` подтвердил исполнением: `flatIsoLayerParity`,
  `liveLayersStable`, `spillBarrierStable`, `haColorUpdatePainted`,
  `sameWallFingerprint`, `haUpdateReusesGeometry`, `flatIsoActionParity` —
  все зелёные. Но солнечная часть и полная DOM-order часть этого же AC
  **не подтверждены исполнением** — см. H1.
- **AC8** (одна проекция на всё, anchor ≤1px). `_scenePoint()` — единственная
  точка входа для HTML-маркеров, room labels, vacuum trail/puck (grep по
  `_scenePoint(` в диффе — используется во всех перечисленных местах, не
  найдено отдельной «примерно такой же» формулы). `test/isometric-contract.test.mjs`
  проверяет это как source-contract. `demo/smoke_isometric_contract.mjs`
  (`anchorsFinite`, `haUpdateKeepsAnchor` — сдвиг ≤1px) и `smoke_isometric_live_touch.mjs`
  (`orientationResizeKeepsIso`) исполнены и зелёные.
- **AC9** (редакторы всегда flat). `test/isometric-contract.test.mjs`
  (`doesNotMatch(spaceCard/spaceRender, …)`), `demo/smoke_isometric_contract.mjs`
  (`editorIsFlat`, `viewRestoresIso`) — исполнены, зелёные.
- **AC10** (fallback-защёлка). `demo/smoke_isometric_contract.mjs` —
  инъекция исключения в `_isoSource`, подтверждён latch + explicit retry;
  вручную убедился, что тест умеет падать (см. «Мутанты» выше).
- **AC11** (перф). Профиль `large-house-isometric-v1` и
  `budgets-large-house-isometric.json` добавлены по контракту существующей
  инфраструктуры (`--budgets=`, `benchmark:compare`), wiring в
  `.github/workflows/performance.yml` корректен. Полный 7-sample
  base/candidate прогон на exact-SHA Linux CI — по процессу это pre-beta
  гейт, не гейт этого цикла; локально подтвердил только, что раннер
  исполняется целиком без исключений на 1 сэмпле.
- **AC12** (backend/schema/space-card не меняются). `git diff --stat`
  подтверждает отсутствие изменений в `custom_components/**/*.py`,
  `manifest.json`, `hacs.json`; `src/space-card.ts`/`src/space-render.ts` не
  содержат `iso`-путей (unit source-contract + `git diff --stat` = 0 для этих
  файлов).
- **AC13** (без вертикальных дверей/окон). `test/isometric-contract.test.mjs`
  (`doesNotMatch(card, /iso-window|window-light|vertical-door/)`) и визуальный
  просмотр golden — дверной/оконный символ на плоскости пола сохранён.
- **AC14** (touch/kiosk). `demo/smoke_isometric_live_touch.mjs` — все
  touch/kiosk/warm-remount/orientation проверки в этом же смоке (кроме двух,
  см. H1) зелёные: `isoOnTouch`, `touchPinchKeepsIso`, `touchOpeningIsSafe`,
  `touchLongPressHitsDevice`, `touchSpaceSwitchKeepsPerSpaceIso`,
  `backgroundForegroundKeepsIso`, `warmRemountIso`, `kioskReadsPreference`,
  `kioskHasNoToggle`, `kioskEmergencyOffIsFlat`, `orientationResizeKeepsIso`.
- **AC15** (согласованность документов). `docs/SCOPE.md` содержит узкое
  исключение, буквально совпадающее с решением владельца O1; `docs/ISOMETRIC.md`,
  ADR, `docs/DEVELOPMENT.md`, `AGENTS.md`, `docs/STATUS.md` обновлены и
  согласованы друг с другом и с ТЗ; i18n-ключи `view.volumetric`/`view.flat`
  присутствуют в `en.json` и `ru.json` с формулировками из ТЗ («Объёмный вид» /
  «Volumetric view», «Плоский вид» / «Flat view»); README/README.ru/
  `docs/USER-GUIDE.ru.md`/оба CHANGELOG не тронуты.
- **Отсутствие CSS 3D.** `test/isometric-contract.test.mjs`
  (`doesNotMatch(styles, /perspective\s*:|preserve-3d|rotateX\(|rotateZ\(/)`)
  подтверждён; вручную прочитан весь diff `src/styles.ts` — новые правила
  (`.projection-toggle`, `.iso-walls-svg`, `.iso-wall-side/top`, тёмная тема) не
  содержат запрещённых свойств.
- **Регрессии в остальной карточке.** Прогнал **весь** существующий
  браузерный смок-набор (126 файлов, не считая двух новых iso-смоков) —
  **все 126 зелёные**. Крупная интеграция (`_baseVb()`, `_applyView()`,
  `_setMode()`/mode-transition, warm-remount, `_renderDevice`/`_renderRoomLabel`/
  vacuum-рендер получили новый параметр проекции) не разбила ни один
  существующий сценарий: zoom/pan, kiosk, warm-remount, editor gestures,
  opening/measure, vacuum, glow-blending и т.д. — без изменений в поведении.

## Чего не проверял

- **Golden-эталоны для iso не принимал** и не мог принять — это соответствует
  процессу (`npm run golden:accept -- --reviewed` только по полному Linux CI
  артефакту, PROCESS.md §12, §13 правило 13). Отсмотрел 3 из 6 захваченных
  `actual`-изображений визуально как sanity-check геометрии, не как приёмку.
- **Полный 7-sample perf-сравнение с бюджетом** (`budgets-large-house-isometric.json`,
  20% допуск) — по контракту ТЗ (§8.2) это исключительно pre-beta exact-SHA
  Linux CI гейт; локальный однократный прогон профиля подтвердил только
  «раннер работает», не «бюджет выдерживается».
- **HA-harness backend-тесты** (`test_ha_*.py`) — не запускал: в среде нет
  Home Assistant и нет установленного `pytest`; диапазон не меняет backend, так
  что гейт по построению пуст, но формально не исполнялся.
- **Safari/WebKit и Firefox** — ADR явно откладывает это на отдельный
  browser-валидационный прогон вне этого коммита; я тестировал только
  Chromium (тот же движок, что CI `smoke`/`golden`).
- **`smoke_opening_measure.mjs`** — упомянутый в `AGENTS.md` как известно
  окруженчувствительный (`place_dialog_x_magnetised`,
  `place_committed_x_center`); в моём прогоне он тоже красным не оказался
  (прошёл), так что этот риск не проявился, но не является частью проверки
  этого диапазона.

## Вердикт

**Красный · цикл r2/4 · High: 1 · Medium: 0 → нет новых issue.**

Один блокирующий High: обязательный по ТЗ смок `demo/smoke_isometric_live_touch.mjs`
красный на сданном коде (H1) — AC7 не полностью подтверждён исполнением, хотя
причина изолирована до ошибки в геометрии тестовой фикстуры (сон-луч), а не до
дефекта рендерера. Вся остальная реализация — Labs-механизм, проекция и
топология стен, кэш/fallback, warm-remount/touch/kiosk-контракт, отсутствие
влияния на backend/схему/вторую карточку/публичную документацию — подтверждена
исполнением (unit 724/724, 126/127 браузерных смоков, полный golden-прогон без
диффа существующих сцен) либо чтением там, где исполнение не требуется по
процессу. Возврат в «В разработке» для исправления фикстуры смока и повторного
прогона `demo/smoke_isometric_live_touch.mjs` перед следующим циклом.
