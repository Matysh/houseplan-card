# Код-ревью #137 — узлы и линии привязки в редакторе Плана (r1/4)

- **Issue:** https://github.com/Matysh/houseplan-card/issues/137
- **ТЗ:** `docs/specs/137-plan-snap-overlay.md`, зелёное ревью
  `docs/reviews/SPEC-REVIEW-137-r1.md` (r1/4, High 0, Medium 0)
- **Диапазон:** `origin/dev..HEAD` = `0ce28b0` (ТЗ), `b6e46c9` (SPEC-REVIEW),
  `cde9bfa` (implementation)
- **Реализация:** коммит `cde9bfac0948e6f4e2a59e7a6cfb2085ff034b35`,
  трейлеры `Issue: #137` / `User-Visible: yes` на месте.

## Скоуп диффа

`src/plan-snap-overlay.ts` (новый чистый geometry/resolver helper),
интеграция в `src/houseplan-card.ts` (hover/click/gesture-safety, кэш,
рендер overlay), стили `src/styles.ts` (light/dark/forced-colours),
`docs/CANVAS.md` (контракт), `docs/USER-GUIDE.ru.md` + оба `CHANGELOG`,
unit `test/plan-snap-overlay.test.mjs`, smoke
`demo/smoke_plan_snap_overlay.mjs`, golden (`matrix.mjs`/`harness.mjs`,
matrix v19→v20, 2 новых сценария), performance (`demo/benchmark_large_house.mjs`,
`demo/performance/budgets-large-house-plan-snap.json`,
`.github/workflows/performance.yml`), `package.json` (новый npm-скрипт),
`tsconfig.test.json`, `demo/performance/card-contract.mjs` (новые
контрактные поля `_path`/`_serverCfg`/`_planSnapGeometryCache`). Файлов
класса A: `src/houseplan-card.ts`, `src/plan-snap-overlay.ts`, `src/styles.ts`.
i18n, backend, `manifest.json`, `hacs.json` не тронуты — соответствует
AC13/non-scope.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | green, без вывода |
| Unit | `npm test` | 789/789 green (на Linux падений process-gate теста, специфичного для Windows-путей, нет) |
| Build + bundle sync | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | green, три копии побайтно идентичны |
| Targeted smoke | `node demo/smoke_plan_snap_overlay.mjs` | green, 31/31 проверок |
| Дисциплина «тест умеет падать» | инвертировал приоритет endpoint>line в `resolvePlanSnap` (`if (bestEndpoint && false) return bestEndpoint;`), пересобрал бандл, перезапустил smoke | smoke упал предсказуемо (4 проверки: `endpointHoverIsActive`, `endpointOverridesGridAndShift`, `firstCurrentPointRemainsClosureTarget`, `secondPartitionClickSnapsEndpoint`); откатил патч, бандл и три копии восстановлены и сверены заново |
| Golden | `npm run golden:verify` (после свежей сборки) | 2 новых сценария `plan-snap-endpoint-light` / `plan-snap-line-gaps-dark` → `missing-baseline` (ожидаемо, эталоны не приняты в реализации); 4 существующих Plan-editor сценария (`geometry-plan-editor-dark`, `tray-wide-selection-en`, `tray-wide-tool-ru`, `tray-medium-group-en`) → `different`, разобрано ниже; остальные 46 сценариев `passed` |
| Performance (sanity) | `npm run benchmark:large-house-plan-snap -- --target-root=. --samples=1 --warmups=0 --output=…` | green, ни один внутренний контракт-assert раннера не упал (endpoint+line оба сработали за 120 pointermove, `cacheStable`/`domStable`/`configStable` true, `wsWrites=0`); `planSnapPointerMs≈2766ms` внутри `hardMaxMs:5000` бюджета. Не запускал сравнение с baseline и Full Performance — это предрелизный гейт (§8, §11.4), не гейт код-ревью |
| Backend | не прогонял | диапазон не касается `custom_components/**/*.py` (AC13 подтверждён чтением diffstat) |

**Гейты, которые сознательно не прогонялись:**
- полный `demo/smoke_*.mjs` (127 сценариев) — задача задевает только Plan editor
  draw/partition, остальные поверхности (View/kiosk/Devices/Decor editor,
  opening placement, split и т.д.) не тронуты диффом; целевой smoke плюс
  golden matrix покрывают пересечение с ними (AC1, AC11);
- `npm run golden:capture` / `golden:accept` — приём эталонов вне цикла
  ревью (§13, PROCESS.md §3.13), делается релиз-инженером на полном Linux CI
  артефакте;
- полный `Full Performance` workflow и сравнение с baseline — pre-beta gate
  (PROCESS.md §11.4), не гейт код-ревью;
- `python -m pytest tests_backend` — diff не касается `custom_components/`.

## Разбор AC (проверено чтением + автотестом, где не указано иное)

- **AC1** — доказано smoke (`otherPlanToolsHaveNoOverlay`, `viewHasNoOverlay`)
  и чтением: `_renderPlanSnapOverlay()` рендерится только когда `this._markup`
  (`_mode === 'plan'`, `houseplan-card.ts:1136`) и `_tool` ∈ {draw, partition}.
  Devices/Decor editor используют другой `_mode`, overlay для них не строится.
- **AC2** — доказано golden (2 новых кадра, актуальные PNG визуально
  сверены: точки на пересечениях стен, линия 1 CSS px, разрыв в проёме) плюс
  unit-тест дедупликации/радиусов через `wallCmToUnits`. Forced-colours —
  отдельным smoke-чеком `forcedColorsStayReadable`, что закрывает L4 из
  SPEC-REVIEW (golden-харнесс не эмулирует `forced-colors`, поэтому граница
  доказательства здесь именно smoke, не golden — обоснованно).
- **AC3, AC8** — smoke `endpointHoverIsActive` + `endpointOverridesGridAndShift`
  (клик с `shiftKey: true` всё равно берёт точную координату существующего
  endpoint). Тест умеет падать — проверено мутацией (см. таблицу выше).
- **AC4** — smoke `lineHoverShowsOneDynamicNode` / `lineNodeStaysWallBound` /
  `lineNodeQuantizesAlongWall` / `drawCommitUsesExactLineNode` /
  `existingPartitionWasNotSplit` / `originalSegmentStillUnchanged`.
- **AC5** — unit `resolvePlanSnap`: endpoint побеждает более близкую линию,
  tie разрешается одинаково для прямого и развёрнутого массива сегментов.
- **AC6** — unit `active draft and degenerate inputs are excluded` +
  `current anchor is excluded...` + smoke `activeDraftExcluded`,
  `intermediateCurrentPointDoesNotSelfSnap`, `firstCurrentPointRemainsClosureTarget`,
  `currentAnchorDoesNotCreateZeroSegment`.
- **AC7** — unit `room cuts leave solid intervals...` + smoke
  `openingGapHasNoLine`/`openSpanHasNoLine`/`cutBoundariesAreNotEndpoints`/
  `columnIsNotACandidate`. Проверено чтением: `_planSnapOpeningCuts()`
  переиспользует существующий кэшированный `_openingWallIndexFor` и
  `resolveOpeningWallAssociation` (`houseplan-card.ts:10192` и использования)
  — не заводит второй способ трактовать проёмы, как того требует §11.6 ТЗ.
  Openings в этой кодовой базе привязаны только к комнатным стенам
  (`openingWallIndex` итерирует `rooms`, не `partitions` — `wall-thickness.ts:1884`),
  поэтому исключение вырезов только для `sourceKind:'room'` полно, а не частично.
- **AC9** — smoke `hoverKeepsStaticGeometryCache`; performance-sanity run
  подтвердил `configStable`/`wsWrites=0` за 120 pointermove. Кэш ключуется
  `_cfgEpoch`, который инкрементируется при каждой замене `_serverCfg`
  (`houseplan-card.ts:3092`) — тот же паттерн, что у соседних кэшей
  (`_openingWallIndexFor`), не изобретён заново.
- **AC10** — smoke `tapWithoutHoverSnapsFirstPoint`,
  `secondPartitionClickSnapsEndpoint`, `suppressedClickDoesNotCommit`,
  `panPinchCancelDoNotCommit`.
- **AC11** — smoke `otherPlanToolsHaveNoOverlay`/`viewHasNoOverlay`; golden:
  все View/kiosk/Devices/Decor-сценарии (46 из 50) остались `passed`
  (pixel-identical). Плановые Plan-editor сценарии обсуждены отдельно ниже.
- **AC12** — проверено чтением (кэш ключуется структурным состоянием,
  не hover) плюс однократный локальный прогон
  `benchmark:large-house-plan-snap` (см. таблицу) — раннер сам бросает
  исключение при росте DOM/кэша, дублировании active-кандидата или
  ws/config записи; на одном прогоне ни одно из условий не сработало.
  Полное сравнение с baseline на exact-SHA — предрелизный гейт.
- **AC13** — проверено чтением diffstat: ни один файл `custom_components/**`,
  `src/i18n/*`, `manifest.json`, `hacs.json` не изменён.
- **AC14** — typecheck/test/build зелёные, три копии бандла идентичны
  (см. таблицу), `docs/CHANGELOG.md` + `docs/CHANGELOG.ru.md` +
  `docs/USER-GUIDE.ru.md` + `docs/CANVAS.md` обновлены в том же коммите
  `cde9bfa`, что и поведение.

## Находки

Нет находок уровня High или Medium.

**Low-1 (снято, с решением):** golden-эталоны для Plan editor меняются не
только у двух новых сценариев (`plan-snap-endpoint-light`,
`plan-snap-line-gaps-dark`), но и у четырёх уже существующих
(`geometry-plan-editor-dark`, `tray-wide-selection-en`, `tray-wide-tool-ru`,
`tray-medium-group-en`) — потому что инструмент по умолчанию при входе в Plan
editor это «Контур комнаты», и overlay теперь легитимно виден на этих кадрах.
Разница подтверждена diff-изображением (`artifacts/golden/diff/geometry-plan-editor-dark.png`):
подсвечены ровно новые линии/точки поверх существующей геометрии, ничего не
сломано. Хендофф-комментарий реализации называет только «golden matrix
подготовлена», не уточняя, что переприниматься перед бетой должны 6 кадров, а
не 2. Решение ревьюера: не блокирует — это ожидаемое следствие видимого
контракта фичи (overlay не за отдельным флагом), а не дефект кода; факт
зафиксирован здесь, чтобы релиз-менеджер не удивился при `golden:capture`
перед бетой.

## Что проверено и корректно

- Overlay строго ограничен Plan editor + draw/partition (AC1), pointer-events
  отключены на группе и потомках (`aria-hidden`, `pointer-events="none"`),
  подтверждено и чтением стилей, и `overlayIsPointerTransparent` в smoke.
- Приоритет endpoint > line, стабильность tie-break, дедупликация общих
  вершин, эксклюзия активного draft/self-snap — все доказаны unit-тестами,
  которые я убедился, что умеют падать (мутационная проверка приоритета
  endpoint/line — таблица гейтов).
- Вырезы дверей/окон/ворот и open-span корректно исключают линию и не создают
  постоянных endpoint на границе выреза; переиспользован существующий
  `_openingWallIndexFor`/`resolveOpeningWallAssociation`, второй трактовки
  проёмов не появилось.
- Кэш геометрии ключуется структурным состоянием (`_cfgEpoch` +
  счётчики rooms/drafts/partitions), не пересобирается на hover — тот же
  паттерн, что у соседних кэшей в файле.
- Light/dark/forced-colours читаемость подтверждена конкретным smoke-чеком
  (`forcedColorsStayReadable`), что закрывает открытый вопрос L4 из
  SPEC-REVIEW-137-r1 про отсутствие эмуляции `forced-colors` в golden-харнессе.
  Boundary «что доказывает unit/smoke, что golden» проведена явно.
- Три bundle-копии побайтно идентичны после сборки; трейлеры коммита и оба
  changelog в порядке; i18n/backend/schema не тронуты.
- Дисциплина «Medium становится issue» не нарушена: находок этого уровня нет.

## Чего не проверял

- Полный `smoke`-suite (127 сценариев) — вне периметра диффа, кроме
  целевого и golden-охваченных сценариев.
- Приём golden-эталонов (`golden:accept --reviewed`) и сравнение с полным
  Linux CI-артефактом — предрелизный гейт, не гейт этого ревью.
- Полный `Full Performance` workflow и сравнение `large-house-plan-snap-v1`
  candidate/baseline на exact-SHA — предрелизный гейт; выполнил только
  однократный локальный sanity-прогон без сравнения (см. таблицу).
- `pytest tests_backend` — diff не затрагивает `custom_components/`.
- Ручного тестирования в браузере не было (вне цикла); вместо него —
  чтение кода, unit/smoke с проверкой «умеет падать» и разбор golden-кадров
  (актуальные PNG просмотрены визуально).

## Вердикт

Зелёный. High: 0, Medium: 0. Единственная Low-находка снята решением
ревьюера с записью выше (ожидаемое поведение фичи, а не дефект); отдельного
issue не требуется.
