# CODE-REVIEW-160-r1 — Isometric Stage 3

- Issue: https://github.com/Matysh/houseplan-card/issues/160
- Этап: код-ревью (PROCESS.md §2.7)
- Заход: r1 · блокирующих циклов израсходовано 0 из 4 (предыдущая попытка
  остановилась до чтения кода из-за конфликта ребейза — цикл не потрачен)
- Ветка: `issue/160-isometric-stage3`
- **SHA материала ревью: `ee7d486924d5b1641a56f671bbf94e965fb76493`** (проверено
  `git rev-parse HEAD` непосредственно перед подведением итогов, PROCESS.md §2.7)
- ТЗ: `docs/specs/160-isometric-stage3.md` (commit `d82be48d`), спек-ревью —
  зелёное, `docs/reviews/SPEC-REVIEW-160-r1.md`

## Скоуп

Изометрический Stage 3: фиксированный поворот камеры `rotDeg 0→4`, разделение
floor/raised плоскостей для device marker / room name-card / opening lock badge
(grounding shadow + tether + ограниченный inward nudge), более читаемая глубина
проёмов (jamb/reveal/leaf/frame/sill), общая система теней с одним light vector,
детерминированная theme-aware текстура, согласованный depth order, кэш/fingerprint
с cap 8, degradation для forced-colors/no-filter, полный AC1–AC15, 12 red witnesses
W1–W12. Diff: 90 файлов, +8759/−1374 строк одним продуктовым коммитом
`feat: implement isometric stage 3` (+3 doc/process коммита), трейлеры
`Issue: #160` / `User-Visible: no` на всех — сверено `git log origin/dev..HEAD`.

Материал: `git log --oneline origin/dev..HEAD`, `git diff origin/dev...HEAD`.
Диапазон полный, не по дельте — это первый содержательный проход по коду
(предыдущая передача на ревью не читала код из-за конфликта ветки).

## Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | **2071 passed, 1 skipped, 0 failed** (совпадает с заявленным авторским прогоном) |
| Build | `npm run build` | зелёный, `dist` пересобран |
| Bundle sync | `npm run bundle:sync` | зелёный |
| Bundle budget | `npm run bundle:budget` | зелёный: initial View 299464 B gzip (потолок 300000±2000), lazy isometric 12083 B gzip; известное предупреждение о малом запасе (#367), не относится к #160 |
| `git diff --check` | — | чисто, конфликт-маркеров/trailing whitespace нет |
| **`node scripts/check-docs.mjs`** | обязателен диффом по `src/**` (PROCESS.md §2.7/§2.9) | **КРАСНЫЙ** — см. Находка H1 |
| `npm run golden:verify` (эта среда — Linux) | диагностика, не приёмка | все 137 незатронутых сценариев `passed`, 8 `isometric-*` — `different` (камера/Stage 3, ожидаемо), 5 новых `isometric-stage3-*` — `missing-baseline` (ожидаемо, не принимались) |
| `scripts/mutation-gate.mjs --id=stage3-w1…w12` | все 12 witnesses по отдельности | **12/12 подтверждены лично** (см. таблицу AC ниже) — не поверено на слово |
| `node demo/smoke_entry_stale.mjs` | по указанию `smoke-select.mjs` («зарегистрированная связь» через общий `EditorRuntimeLoader`) | зелёный |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | выбор целевых смоков | см. «Чего не проверял» |
| `demo/benchmark_large_house.mjs --profile=isometric-stage3-dense-v1 --samples=1` | однократный sanity-прогон нового профиля | зелёный, см. «Производительность» |

Пояснение к `git diff --check`, unit-числу и bundle-budget: числа сошлись с тем,
что автор указал в хендоффе issue — независимая проверка, не копирование отчёта.

## Таблица «AC · чем доказан · чем краснеет» (PROCESS.md §2.7, #435)

Только защитные AC (валидация/guard/лимит/invariant). Расположенческие/текстовые
AC — отдельно ниже без третьего столбца.

| AC | Доказано | Чем краснеет (лично прогнано) |
|---|---|---|
| AC2 камера +4°/20° | `test/iso-projection.test.mjs` («exact fixed») | `stage3-w1-camera-rotation-reset` (rotDeg 4→0) — **поймано 1 из 1** |
| AC3 raised/floor матрица (room label не должен остаться на floor) | `test/iso-overlays.test.mjs` («exact D2 overlay matrix») | `stage3-w2-room-label-left-on-floor` — **поймано 1 из 1** |
| AC3 vacuum остаётся floor-bound | `test/isometric-contract.test.mjs` («raises only device») | `stage3-w3-vacuum-raised-with-devices` — **поймано 1 из 1** |
| AC4 44×44 hit target | `demo/smoke_isometric_contract.mjs` | `stage3-w4-device-target-loses-44px-floor` — **поймано 1 из 1** |
| AC5/AC13 nudge никогда не пишет config/layout/storage | `demo/smoke_isometric_live_touch.mjs` | `stage3-w5-runtime-nudge-writes-storage` — **поймано 1 из 1** |
| AC7 `show_borders:false` не даёт raised-слоёв | `demo/smoke_isometric_live_touch.mjs` | `stage3-w6-no-borders-keeps-raised-plates` — **поймано 1 из 1** |
| AC8/AC12 HA Sun не входит в structural fingerprint/light vector | `demo/smoke_isometric_live_touch.mjs` | `stage3-w7-sun-state-enters-structural-key` — **поймано 1 из 1** |
| AC8 material defs O(1), не per-face | `demo/smoke_isometric_contract.mjs` | `stage3-w8-material-defs-created-per-face` — **поймано 1 из 1** |
| AC6 door/gate hinge·face·flip (заявленный контракт W9 — face turn direction) | `test/iso-scene-render.test.mjs` («gate flips move unhosted structural face») | `stage3-w9-gate-face-flip-reversed` — **поймано 1 из 1** |
| AC9/AC12 Flat-fallback не засчитывается как успешный Iso-сэмпл | `test/performance-workflow.test.mjs` («runner fails closed») | `stage3-w10-flat-fallback-counted-as-success` — **поймано 1 из 1** |
| AC5 tether обязателен после ненулевого nudge | `test/iso-overlays.test.mjs` («wall-aware nudge») | `stage3-w11-nudged-overlay-loses-tether` — **поймано 1 из 1** |
| AC1/AC13 нет отдельного Stage 3 expiry/URL-ключа | `test/isometric-contract.test.mjs` («Labs iso is presentation-only») | `stage3-w12-separate-alpha-url-key-restored` — **поймано 1 из 1** |

Все 12 команд запущены мной лично (не по описанию автора), каждая дала
`поймано 1 из 1` — «тест умеет падать» подтверждено, а не принято на слово.

**Пустых третьих столбцов нет**, кроме одного отдельно обсуждаемого случая:
AC6-hinge/flip покрыт для заявленного W9-пути (face turn direction в
`iso-scene-render.ts`), но у смежной функции `leafBasis` (`src/iso-openings.ts`)
есть непокрытая ветка того же семейства дефектов — см. Находку M3.

AC10 (live layers), AC11 (lifecycle/touch/kiosk), AC14 (гейты), AC15
(golden/docs) не заявляют отдельной защиты сверх вышеперечисленного — доказаны
combined-смоками/golden/гейтами таблицы выше и разобраны ниже по коду с пометкой
«проверено чтением».

## Находки

### H1 — `node scripts/check-docs.mjs` красный: скриншоты документации не пересняты (High, блокирует)

**Воспроизведение** (без изменения рабочего дерева — через изолированные
`git worktree`, затем удалены):

```
git worktree add --detach /tmp/head-check ee7d486924d5b1641a56f671bbf94e965fb76493
cd /tmp/head-check && node scripts/check-docs.mjs
→ ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs
→ exit 1

git worktree add --detach /tmp/dev-check origin/dev   # afba49a3, ровно родитель ветки
cd /tmp/dev-check && node scripts/check-docs.mjs
→ Documentation checks passed (7 files, 12 external links)
→ exit 0
```

Отпечаток в `docs/images/screenshots.json` (`manifest.sourceFingerprint`)
считается по всему `src/**` (`scripts/source-fingerprint.mjs`). Диапазон этой
задачи меняет `src/iso-projection.ts`, `src/iso-overlays.ts` (новый),
`src/iso-openings.ts`, `src/iso-scene-render.ts` (новый),
`src/houseplan-card.ts`, `src/styles/plan.styles.ts`,
`src/editor-runtime-loader.ts` — отпечаток обязан был устареть, и он устарел, а
`docs/images/*` не тронуты ни одним коммитом диапазона
(`git diff origin/dev...HEAD --stat -- docs/images` — пусто).

Это ровно инцидент, названный в PROCESS.md §2.9 и AGENTS.md как прецедент:
«скриншоты не пересняли в #230 и #234, и `dev` стоял с красным job `docs`, пока
это не нашли при следующей задаче (#237)». `check-docs` — обязательная часть
гейта код-ревью «при любом diff'е по `src/**`» (PROCESS.md §2.7), не
предрелизная опция.

**Почему не исправляю сам:** пересъёмка выполняется только джобой
`Docs screenshots` (`workflow_dispatch`) и принимается локально `npm run
docs:accept -- --reviewed --from=<артефакт>` — ревьюер не редактирует продукт и
не является тем, кто локально снимает кадры (байтовое расхождение
Chromium/окружения аннулировало бы весь набор). Автору нужно: запустить job →
`npm run docs:accept -- --reviewed --from=<распакованный артефакт>` → закоммитить
вместе с задачей.

**Серьёзность:** High — сливание в этом виде оставляет `dev` с красным job
`docs`, то есть ровно то, что PROCESS.md прямо называет ценой пропуска.

### M1 — floor anchor opening lock badge вычисляется двумя независимыми формулами (Medium, в скоупе)

- `src/houseplan-card.ts:6170` — `_openingLockAnchor()`, используется Flat/`show_borders:false`-путём (`houseplan-card.ts:13097`);
- `src/iso-scene-render.ts:853` — `isoOpeningLockPlacement()`, используется raised/Iso-путём.

Обе функции побайтово повторяют одну и ту же математику: `rad =
(angle+90)·π/180`, `gateFace` через `partitionOpeningFace`/
`openingInnerFaceOffsetFromIndex` (в `houseplan-card.ts` это скрыто за приватным
хелпером `_openingFace`, `houseplan-card.ts:8377`, который делает ровно то же
ветвление), `lockOffset = gridVisualUnits(16, cellCm)`,
`offset = gateFace ? -lockOffset·side : lockOffset·(flip_v?-1:1)`,
`floorAnchor = [rx+cos(rad)·offset, ry+sin(rad)·offset]`.

Показательная деталь: `iso-scene-render.ts` уже экспортирует
`isoOpeningLockAnchor()` (`iso-scene-render.ts:845`) — тонкую обёртку именно для
этого случая, а комментарий над `_openingLockAnchor` в `houseplan-card.ts`
буквально называет её «Shared Flat/Iso host-face semantics for raised opening
locks». Но экспорт нигде не импортируется (`grep -rn isoOpeningLockAnchor src
test demo` находит только само определение и сборочный chunk) — общая функция
задумана, но не подключена; `_openingLockAnchor` — независимая копия, а не
вызов.

Это не архитектурная неизбежность лени-чанка: сама формула не использует ничего
специфичного для ленивого `iso-scene-render.ts` (только
`gridVisualUnits`/`Math.cos`/`Math.sin`/примитивы `iso-openings.ts`, который уже
загружается eagerly и из `houseplan-card.ts`, и из `iso-scene-render.ts`) — её
можно перенести в `iso-openings.ts` и импортировать из обоих мест без изменения
lazy/eager границы бандла.

Сейчас числовое расхождение отсутствует — обе копии дают одинаковый результат
для всех типов проёма, я сверил формулы построчно. Риск ровно тот, о котором
предупреждает «одно число — один источник» (PROCESS.md, #234/#233): правка
одной копии (например знака `gateFace.side` для нового кейса) без парного теста
незаметно разведёт Flat/`show_borders:false` и Iso-положение lock badge.
Парного теста нет — `test/iso-scene-render.test.mjs` проверяет только
модульную версию.

**Фикс в скоупе:** перенести формулу в `iso-openings.ts` (или в уже
существующий экспорт `isoOpeningLockAnchor`, но из eager-модуля) и заменить обе
копии на вызов; либо, как минимум, добавить parity-тест, вычисляющий обе
функции на одном наборе openings и сравнивающий floor anchor.

### M2 — реальный алгоритм `isoRoomSafePoint` (grid-search fallback) не покрыт ни одним тестом (Medium, в скоупе)

`src/iso-overlays.ts:178-222` — `isoRoomSafePoint()`. Функция сначала проверяет
дешёвый путь (`room.safePoint`, если он уже валиден), иначе строит кандидатов
(центр bbox, центроид, средние по тройкам соседних вершин контура) и в конце
перебирает выпуклую 15×15 сетку внутри bbox, выбирая точку с максимальным
clearance от границы/дыр — единственный способ получить «доказанную внутреннюю
точку» для вогнутых комнат и комнат с дырами (ссылка на §19.3 ТЗ: «иначе
используется ближайшая доказанная внутренняя точка»).

Продакшен-вызов — `src/iso-scene-render.ts:723`:
```
return { room, overlayRoom: { ...base, safePoint: isoRoomSafePoint(base) || undefined } };
```
`base` строится без поля `safePoint` (`iso-scene-render.ts:715-722`), поэтому
дешёвый путь не срабатывает НИКОГДА — каждый вызов в реальном рендере проходит
полный candidate+grid-search алгоритм.

При этом все фикстуры `test/iso-overlays.test.mjs` (`square(...)`, строки
20-198) передают `safePoint` явно готовым (`[50,50]`, `[25,50]` и т.д.) —
значит каждый юнит-тест резолвера попадает исключительно в дешёвый путь и ни
разу не исполняет сам grid-search/candidate-перебор, включая тест на «room with
hole»/donut (строка 184), где как раз и важна корректность вычисления
внутренней точки для вогнутой/дырчатой геометрии. Я перечитал файл целиком и
подтверждаю: другого вызова `isoRoomSafePoint` с «пустым» room нет ни в одном
тесте.

Это прямое нарушение дисциплины «тест умеет падать» именно там, где ТЗ (§19.3)
явно требует «pure tests подтверждают» этот алгоритм для использования в
качестве inward-направления nudge (AC5). Не найдено доказательств, что
алгоритм ошибается — но и доказательств обратного тоже нет: если он вернёт
точку в дыре или за пределами вогнутой комнаты, ни один тест этого не заметит,
а `pointStrictlyInRoom`-проверки в самой функции его подстрахуют лишь частично
(candidate просто не будет учтён `consider()`, но `best` может остаться `null`
для патологической геометрии, и последствия этого в резолвере nudge не
проверены).

**Фикс в скоупе:** добавить unit-тесты, вызывающие `isoRoomSafePoint`
напрямую на комнатах БЕЗ предзаданного `safePoint`, включая вогнутую и
donut/с дырой геометрию, и проверяющие: (а) результат строго внутри комнаты,
(б) детерминированность при повторном вызове, (в) `null` для вырожденной
комнаты не ломает вызывающий резолвер.

### M3 — `leafBasis` (`src/iso-openings.ts:187-209`): flipH не тестируется независимо от flipV (Medium, в скоупе)

```js
const sx = input.flipH ? -1 : 1;
const sy = input.type === 'gate' ? 1 : input.flipV ? -1 : 1;
```

Единственное место во всём `test/iso-openings.test.mjs`, где `flipH: true`
вообще встречается — строка 211:
```js
const flipped = buildIsoOpeningBasis(opening({ flipH: true, flipV: true }));
```
всегда вместе с `flipV: true`, и проверка — только
`assert.notDeepEqual(flipped.leaves.map(l=>l.hinge), normal.leaves.map(l=>l.hinge))`,
без точных ожидаемых координат. Если в `leafBasis` перепутать роли (например,
`sx` начать читать из `input.flipV`, а `sy` — из `input.flipH`), для двери
(`type !== 'gate'`) при `flipH=true, flipV=true` подстановка даёт `sx=-1,
sy=-1` что до, что после путаницы — тест остаётся зелёным. Изолированного
кейса `flipH:true, flipV:false` (или наоборот) с точным ожидаемым hinge нет.

Важное уточнение: заявленный в §13 ТЗ witness **W9 покрывает другой код** (face
turn direction в `iso-scene-render.ts`, я лично подтвердил
`stage3-w9-gate-face-flip-reversed` — красит тест `test/iso-scene-render.test.mjs`)
и там всё корректно. Это отдельная, более узкая находка про смежную функцию
того же семейства (visual leaf hinge/vector в `iso-openings.ts`), не про
отсутствие защиты AC6 в целом.

**Фикс в скоупе:** добавить `opening({ flipH: true, flipV: false })` (и
обратный кейс) с точными ожидаемыми `hinge`/`closedVector` для door и gate.

### Low — не блокируют, оставлены с записью

- **`IsoDecorationLayers.shadows` не зависит от `hideOpenings`**
  (`src/iso-openings.ts:557`), хотя D5/AC7 формулируют «`hide_openings` скрывает
  panels/reveal и их directional shadows». Фактическое поведение верное —
  тени пропадают косвенно, потому что `layers.panels` (который зависит от
  `hideOpenings`) обнуляет массив `openingSurfaces`
  (`src/iso-scene-render.ts:1119`), из которого тени строятся; сам флаг
  `shadows` в `resolveIsoDecoration` — общий, не opening-специфичный. Реальной
  регрессии нет, но название вводит в заблуждение и не защищено собственным
  тестом: будущий рефакторинг, который возьмёт тени из другого источника
  геометрии, тихо вернёт directional shadow при `hide_openings:true`, и ни один
  существующий тест этого не поймает. Оставляю с запиской, не как блокер.
- **`renderIsoRaisedOverlays`/`renderIsoOverlayGrounds` не проверяют
  `layers.structural` сами** (`src/iso-scene-render.ts:1032,1049`) — W6
  фактически ловится caller-гейтом (`houseplan-card.ts:6195`,
  `!layers?.structural`) и golden/contract-тестами, но defense-in-depth на
  уровне самого модуля отсутствует. Рекомендация на будущее, не находка этого
  ревью.
- **Дублирование вычисления fallback-ключа** между `_effectiveProjection()`
  (`houseplan-card.ts:~6134-6160`) и catch-веткой в теле рендера
  (`~11360-11382`) — оба независимо собирают
  `disp.showBorders ? key : \`${space}|no-borders\``. Сейчас оба пути дают
  одинаковый ключ (я сверил вручную), но это тот же паттерн риска, что M1, в
  меньшем масштабе — не поднимаю до Medium, так как последствие расхождения
  (неверный fallback-latch) менее вероятно и не про пользователем видимую
  величину напрямую.
- **`hovered: true` захардкожен** для всех raised-overlay
  (`iso-scene-render.ts:765`) — ветка D4 «tether может быть скрыт в свободной
  области» никогда не срабатывает в проде. Это разрешённый (не обязательный)
  выбор по ТЗ («может быть скрыт»), и в коде есть явный комментарий,
  объясняющий это как осознанное решение («persistent tether… without a second
  hover-only render pipeline»). Не нахожу нарушения, фиксирую как наблюдение.
- **`EPS = 1e-9`** в геометрических хелперах `iso-overlays.ts` — абсолютный, не
  масштабируется от величины координат плана; теоретический риск на очень
  больших планах, не воспроизведён.

## Что проверено и корректно

- **Камера (AC2, D1):** `ISO_CAMERA.rotDeg` ровно `4`, `tiltDeg` ровно `20`,
  единая матрица `isoPlaneMatrix`/`applyIsoMatrix` для точки/floor-matrix/CSS —
  никакой второй приближённой формулы (`src/iso-projection.ts`). Round-trip,
  diag-frame и raised-height тесты в `test/iso-projection.test.mjs` содержательны
  (точные числа, не только типы). W1 лично прогнан.
- **Raised/floor split (AC3, D2):** одна матрица для floor anchor, raised
  anchor, plate-углов (`src/iso-overlays.ts`), никакой параллельной формулы.
  Vacuum/Glow/room fill/sunlight/decor остаются floor-bound — подтверждено
  W3 и отдельно кодом `_scenePoint`/`this._pos` путей в `houseplan-card.ts`.
- **Owning room и nudge (AC5, D4):** правило владения (явная привязка → строго
  содержащая минимальная по площади комната → tie-break по id → fail-safe
  `null`, без «угадывания») реализовано и покрыто тестами free/shared-wall/
  corner/room-with-hole/outside/no-owner (не считая пробела M2 в подчинённом
  `isoRoomSafePoint`). Nudge детерминирован (бинарный поиск по CSS-px, без
  `Math.random`), ограничен фиксированным cap, не двигает floor anchor/tether,
  не пишет данные — grep не находит присваиваний в `input.*`/`store`/`save`/
  `dispatch`. W5, W11 лично прогнаны.
- **Плейт и content (AC4):** подложка floor-parallel, glyph/text screen-facing,
  hit target реально не уменьшается (только новые правила `min-width/height:
  44px` добавлены в `plan.styles.ts:609-619,752-757`, старые не тронуты). W4
  лично прогнан.
- **Проёмы (AC6, D5):** ручек нет (grep по `handle|knob|lever` не находит
  ничего в геометрии, только в редакторских resize-инструментах); passage
  явно исключён из leaf/frame/sill (`iso-openings.ts:252,267,414`); окно —
  светлая рама/sill, без тёмного стекла (цвета в `plan.styles.ts`
  подтверждены); update `openingAmount()` не трогает structural cache/scene
  (basis неизменен после проекции, `test/iso-openings.test.mjs:214-221`
  `assert.deepEqual(normal, basisSnapshot)`); hinge/face turn direction (W9)
  лично прогнан и корректен. Ограничение — M3 выше.
- **Materials/shadows/fingerprint (AC8, AC12, D6/D7, §7.2/§7.3):** layer order
  `underlay → shadows → walls → grounds → raised` совпадает с §7.3 и
  подтверждён z-index тестом (`test/isometric-contract.test.mjs:112-124`).
  Structural fingerprint включает ровно нормативный список (geometry, camera
  `+4°/20°`, heights, algorithm revision) и явно исключает HA state/theme/
  hover/tooltip — подтверждено кодом и W7. LRU cap 8 подтверждён кодом и
  тестом на eviction/recency. Material defs — фиксированный набор ~9 id, не
  растущий по face/marker — подтверждено кодом и W8, а также реальным прогоном
  бенчмарка (`materialDefinitionCount: 9`, см. «Производительность» ниже).
  Grounding/plate SVG-корни помечены `aria-hidden="true" pointer-events="none"`.
- **Degradation (AC9, §7.5):** forced-colors/no-filter снимают только
  texture/shadows, geometry/openings/anchors/tether/actions остаются; только
  structural exception латчит Flat fallback (W10 подтверждает, что Flat-сэмпл
  не засчитывается успешным Iso-сэмплом в перф-раннере) — проверено чтением
  `resolveIsoDecoration`/`resolveIsoDecorationLayers` и smoke-тестами автора.
- **Zigbee-топология и live layers (AC10):** `hp-zigbee-topology-overlay.ts` не
  менялся и по-прежнему читает `marker.getBoundingClientRect()` — так как
  `_renderDevice`/`_renderRoomLabel`/`_renderOpeningLocks` теперь пишут
  `left/top` из `isoPlacement?.visualScene` (поднятая точка), топология
  автоматически идёт к новой позиции без второй геометрической модели —
  подтверждено чтением и новым тестовым блоком в
  `demo/smoke_zigbee_topology_hover.mjs` (+78 строк:
  `isoTopologyUsesRaisedDomCentres`,
  `isoTopologyTracksRaisedDomCentresAfterPanZoom`).
- **`show_borders:false` (AC7, §7.4):** `isoOverlayPlane()` возвращает
  `'floor'` при `!showBorders`; `_isoOverlayScene()` дополнительно гейтится на
  `layers?.structural`; при отсутствии isoPlacement device/room-label/lock
  откатываются на каноническую матрицу с `z=0` (не на старую two-corner
  viewBox-аппроксимацию) — подтверждено кодом и smoke-тестом
  `noBordersUsesTrueAffineFloor`, проверяющим реальные недиагональные элементы
  матрицы. Замечена и попутная корректная правка бага: `_baseVb()` для
  no-borders раньше передавал `wallHeight` стены в `projectedFrame`, теперь —
  `0` (убирает невидимые Stage 3 bounds, ровно требование §7.4).
- **`hide_openings` vs lock badge:** lock badge не зависит от `hideOpenings`
  (только от `!orphanReason && (door|gate) && lock && entityAvailable`) —
  соответствует «lock badge остаётся raised, пока стена видима».
- **Одно число — один источник (кроме M1):** value/LQI-текст на raised-плейте
  использует тот же `_devicePresentation`, что и обычный HTML-рендер (общий
  форматтер, не пересчитан заново); `test/single-source-numbers.test.mjs` не
  тронут диффом, что ожидаемо — задача не добавляет новый видимый формат
  числа, только позицию (см. M1).
- **Негативный контракт (AC13):** нет новых зависимостей
  (`package-lock.json` не менялся), новых i18n/storage/config/network путей —
  подтверждено grep и чтением; legacy `hp-labs`/expiry не возвращены (W12).
  Трейлеры всех 4 коммитов диапазона — `Issue: #160` / `User-Visible: no`,
  сверено `git log`.
- **Golden (AC15), диагностика на этой Linux-машине:** `npm run golden:verify`
  после свежего `bundle:sync` — 137 незатронутых сценариев `passed` (Flat не
  сдвинулся ни на пиксель), 8 существующих `isometric-*` — `different`
  (ожидаемо, камера/Stage 3), 5 новых `isometric-stage3-*` —
  `missing-baseline` (ожидаемо, не принимались автором — правильно, приёмка
  требует `--reviewed` и полного Linux CI артефакта, не решается на этом
  этапе). Ни одного неожиданного отличия вне `isometric-*`.
- **Документация (AC15, §15):** `docs/ISOMETRIC.md`, `docs/ARCHITECTURE.md`,
  новый `docs/adr/160-isometric-stage3-overlays.md`, `docs/STATUS.md`,
  `docs/specs/README.md` обновлены и не содержат устаревших упоминаний
  «expiring iso»; публичные `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`,
  `docs/RELEASE-NOTES.md`, README, user guide не тронуты — соответствует
  «Stage 3 остаётся скрытой».
- **Бюджеты производительности (AC12, §10):** `demo/performance/budgets-isometric-stage3-dense.json`
  не мягче `demo/performance/budgets-large-house-isometric.json` (идентичные
  regression ratio/noise/ceiling, идентичный `isoGeometry: 8`/growth 0) —
  сверено построчно. `demo/performance/evaluate.mjs` отклоняет
  `effectiveProjection !== 'iso'` и полный boolean rebuild на HA-only update.
  `.github/workflows/performance.yml` добавляет отдельный matrix-профиль для
  нового бюджета.

## Производительность — локальный sanity-прогон

`node demo/benchmark_large_house.mjs --profile=isometric-stage3-dense-v1 --samples=1`
запущен лично на этом SHA (Linux) как разовая проверка, что новый профиль и
плотная фикстура реально исполняются и дают осмысленные числа — не как замена
канонического 7-sample exact-SHA Linux CI прогона (тот остаётся pre-beta
гейтом §8/§10, вне объёма код-ревью). Результат зелёный и содержательный:

- `effectiveProjection: "iso"` — сэмпл не попал в Flat fallback;
- `renderedOverlayCount: 82` и `raisedOverlayCount: 82` — все overlay
  реально подняты, ни один не остался «недоподнятым»;
- `raisedVacuumCount: 0` — vacuum не поднят, как того требует AC3/W3;
- `materialDefinitionCount: 9` (`patterns: 3, filters: 4` + фон) — совпадает с
  оценкой из чтения кода (см. AC8 выше), O(1) для плотной сцены с 82
  overlay и 261 opening-поверхностью (`door: 182, window: 55, gate: 24`);
- `isoStructuralBuilds.haUpdateDelta: 0` и
  `stage3Diagnostics.steadyUpdateStructuralBuildDelta: 0` — HA-only update не
  вызывает structural rebuild;
- `cacheGrowth.isoGeometry: 0` при `cacheEntries.isoGeometry: 3` (в пределах
  cap 8).

Одного сэмпла недостаточно для приёмки exact-SHA бюджета (нужны семь и
Linux CI) — это прямо и не заявлено; но сам факт, что профиль и фикстура
работают и дают именно те инварианты, которые требует AC12, — установленный
факт, а не «verified» без команды.

## Чего не проверял и почему

- **`npm run invariants`** — диапазон не меняет геометрическую модель
  (комнаты/стены/толщины/`layout`/`marker.space`/`open_spans` в
  `custom_components/**`/config schema); это исключительно рендер-слой поверх
  уже провалидированной канонической геометрии (подтверждено AC13 и diff-статом
  — ни одного изменения в `custom_components/**/*.py` или схеме конфига).
  Инварианты неприменимы к чисто презентационному diff'у.
- **`python -m pytest tests_backend`** — ноль изменений в
  `custom_components/houseplan/**/*.py` (diff stat подтверждает).
- **Полный `ls demo/smoke_*.mjs` набор (226 файлов)** — не прогонял. Ран
  `scripts/smoke-select.mjs --base origin/dev --head HEAD` показал 104 «прямых
  совпадения» и 35 «слабых связей» почти исключительно из-за общих приватных
  полей `houseplan-card.ts` (`_baseVb`, `_viewOr`, `_mode` и т.п.), не
  специфичных для Stage 3 логики — полный прогон здесь был бы предрелизным
  объёмом, не гейтом ревью.
  Прогнал лично: `demo/smoke_isometric_contract.mjs` и
  `demo/smoke_isometric_live_touch.mjs` — по многу раз каждый, как чистый
  baseline-прогон перед каждой из 6 smoke-guarded witness-мутаций W4–W8 (все
  чистые прогоны зелёные, все мутации красные), и `demo/smoke_entry_stale.mjs`
  («зарегистрированная связь» через общий `EditorRuntimeLoader`/
  `safeRuntimeDiagnostic` — зелёный).
  Не прогонял отдельно: `demo/smoke_zigbee_topology_hover.mjs` и 11
  «legacy iso»-смоков, заявленных автором зелёными на точном SHA — полагаюсь
  на их хендофф-отчёт и на то, что пересекающийся по контракту
  `smoke_isometric_contract.mjs`/`smoke_isometric_live_touch.mjs` я исполнил
  сам многократно и чисто; при необходимости могу прогнать по запросу.
- **Полный 7-sample exact-SHA `large-house-isometric-v1` и
  `isometric-stage3-dense-v1`** — канонический гейт вынесен в Linux CI Full
  Performance перед бетой (§8/§10), не в код-ревью; локально прогнан только
  `--samples=1` sanity-чек нового профиля (см. «Производительность» выше).
- **Приёмка golden baseline** — не моя роль на этом этапе; выполнил только
  диагностический `golden:verify` (см. выше), не `golden:accept`.

## Итог

**High: 1** (check-docs красный — блокирует), **Medium: 3**, все в скоупе
задачи (правятся в этой же ветке, отдельный issue не заводится). Все 15 AC по
существу выполнены и по большей части доказаны автотестами, которые я лично
проверил на способность падать (12/12 red witnesses), плюс независимый
canonical-Linux `golden:verify` и содержательный sanity-прогон нового
performance-профиля. Задача возвращается автору не из-за архитектурных
проблем, а из-за одного пропущенного, механического, но обязательного шага
(пересъёмка скриншотов документации) и трёх фиксируемых в скоупе усилений
тестового покрытия/устранения дублирования формулы.

**Вердикт: красный · заход r1 · блокирующих циклов 0/4 · High: 1 · Medium: 3 → в задаче**

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/160-isometric-stage3`, коммит `ee7d486924d5` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `41472b7a410b83d6fa8a667df63d680b819d01f6`
  ```
  git log --all --format='%H %T' | grep 41472b7a410b
  ```
- ТЗ `docs/specs/160-isometric-stage3.md`, блоб `20ed447b8f58bdfe9e48695584ff616c36b79b4d`
  ```
  git log --all --find-object=20ed447b8f58bdfe9e48695584ff616c36b79b4d -- docs/specs/160-isometric-stage3.md
  ```
