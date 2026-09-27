# CODE-REVIEW #82 · r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/82 «Плавное масштабирование zoom/fit/reset»
- **ТЗ:** `docs/specs/082-smooth-zoom.md` (зелёное ревью `SPEC-REVIEW-82-r1`, 2026-08-30)
- **Заход:** r1 (это первый код-ревью этой задачи; предыдущих циклов нет)
- **SHA материала:** `779382afec951ce8f84a4d62a8eb700cf4c1bc4a` (`git rev-parse HEAD` перед подведением итогов)
- **Диапазон:** `origin/dev...HEAD`, 12 коммитов (`895b120e`…`779382af`)
- **Причина полного разбора (не по дельте):** это первый код-ревью цикл этой задачи — §2.10 применяется со второго раунда. Отдельно ветка была ребейзнута конвейером до ревью (2 коммита dev: `9653ba17 → 779382af`), что по §7.2 само по себе требует полного разбора, а не только разбора добавленных commit'ов.

## Скоуп диффа

`git diff origin/dev...HEAD --stat`: 55 файлов, из них по классам:

- **A (продукт):** `src/houseplan-card.ts` (+178/-99), `src/mode-transition.ts` (переименование `ease` → экспортируемый `easeTransitionProgress`), новый `src/viewport-transition.ts` (212 строк, чистый camera-only контроллер).
- **B (гейты/тесты):** новый `test/viewport-transition.test.mjs`, новый `demo/smoke_smooth_zoom.mjs`, правки в `demo/smoke_infinite_canvas.mjs`, `demo/smoke_canvas_frame.mjs`, `demo/smoke_kiosk.mjs`, `demo/smoke_kiosk_pan_lock.mjs` (ожидание settle камеры), `demo/golden/harness.mjs`, `demo/docs/capture.mjs` (то же самое для golden/docs-захвата), `tsconfig.test.json`.
- **C (документация):** `docs/ARCHITECTURE.md`, `docs/CANVAS.md`, `docs/CHANGELOG.md`/`.ru.md`, `docs/STATUS.md`, `docs/TESTING.md`, `docs/USER-GUIDE.md`/`.ru.md`, `docs/specs/README.md`, `docs/specs/082-smooth-zoom.md`, `docs/reviews/SPEC-REVIEW-82-r1.md`.
- **D (генерируемое):** `dist/**`, `custom_components/houseplan/frontend/**`, `demo/golden/baselines/**` (8 файлов + `baselines-index.json`), `docs/images/*.png` + `screenshots.json`.

Продуктовый код сосредоточен в одном новом модуле плюс точечных правках `houseplan-card.ts` — контракт §8 «Единый camera-only controller» выдержан буквально: `CameraTransitionController` не знает о Lit/localStorage/режимах; `houseplan-card.ts` остаётся единственным писателем `_zoom`/`_view`.

## Как проверялось

Зелёного Validate на `779382af` на момент начала ревью не было — прогнал гейты сам.

| Гейт | Команда | Результат |
| --- | --- | --- |
| Typecheck | `npx tsc --noEmit` | чисто, без ошибок |
| Unit-тесты | `npm test` | 1642 всего: 1641 pass, 1 skip, 0 fail |
| Build + сверка бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны (третья копия `demo/srv/assets/**` не коммитится, #255 — синхронизирована `npm run bundle:sync` для локального прогона смоков) |
| `no-new-any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | 368 добавленных строк в 3 файлах, новых `any` нет |
| `check-docs` | `node scripts/check-docs.mjs` | пройден (7 файлов, 10 внешних ссылок); `sourceFingerprint`/`captureScriptSha256` в `docs/images/screenshots.json` пересчитаны, `imageSha256` изменился только там, где реально поменялась картинка |
| `smoke-select` | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 49 прямых совпадений, 33 слабых связи (полный вывод приложен ниже) |
| Browser smoke (по необходимости, см. ниже) | `node demo/smoke_*.mjs` (15 файлов) | все зелёные |
| `single-source-numbers` | `node --test test/single-source-numbers.test.mjs` | 3/3 pass |
| `golden:verify` | `npm run golden:verify` | все сценарии `passed`, 0 расхождений, exit 0 |
| `pytest tests_backend` | — | не прогонял: диф не касается `custom_components/**/*.py` |
| `model-invariants` | — | не прогонял: диф не трогает геометрию комнат/стен/`layout`/`marker.space`/`open_spans` — только камеру (viewport presentation) |
| Performance-профиль / screencast (AC13) | — | не прогонял: §21 ТЗ и §18 план тестов прямо относят этот гейт к предрелизному Full Performance/screencast прогону, не к код-ревью; тот же прецедент уже принят для #73 и зафиксирован как Low в `SPEC-REVIEW-82-r1` |

### Разбор вывода `smoke-select.mjs`

Изменено 3 файла в `src/**`, 57 символов проекта на изменённых строках → порог «широкого» символа 41, матрица 208 смоков.

**Прогнал (15 из 49 прямых совпадений + релевантные регрессии из плана автотестов ТЗ §18):**

- `demo/smoke_smooth_zoom.mjs` — новый, основной для AC1–AC12, AC14.
- `demo/smoke_zoom_out.mjs`, `demo/smoke_infinite_canvas.mjs`, `demo/smoke_canvas_frame.mjs` — прямое совпадение **и** правлены в этом же диффе (ожидание settle камеры) → обязательны.
- `demo/smoke_kiosk.mjs`, `demo/smoke_kiosk_pan_lock.mjs` — прямое совпадение, правлены в диффе, и это «kiosk pan-lock», прямо названный в плане тестов ТЗ §18.
- `demo/smoke_visual_continuity.mjs`, `demo/smoke_warm_remount.mjs` — «#73 visual continuity / warm remount» из плана §18 (в выводе инструмента отсутствуют — связь не по имени символа, а по контракту; прогнал по требованию ТЗ, а не по подсказке инструмента).
- `demo/smoke_mode_transition.mjs` — «#101 View/editor mode transition» из плана §18 (слабая связь по инструменту, обязательна по ТЗ).
- `demo/smoke_isometric_contract.mjs` — «flat/isometric projection switch» из плана §18 (слабая связь по инструменту).
- `demo/smoke_glow.mjs`, `demo/smoke_glow_geometry_resilience.mjs` — «heavy Glow camera path» из плана §18 (отсутствуют в обоих списках инструмента — НЕОПРЕДЕЛЁННОСТЬ по символам, связь по контракту AC11).
- `demo/smoke_furniture.mjs`, `demo/smoke_opening_preview.mjs` — «opening/furniture preview interruption» из плана §18 (прямые совпадения).
- `demo/smoke_editor_gestures.mjs` — прямое совпадение (`_zoomAt`), проверяет pinch/pan в editor-контексте (AC2).

**Не прогонял** оставшиеся ~36 прямых совпадений и все 33 слабые связи: это преимущественно смоки геометрии стен/проёмов/decor, где единственная точка касания — общий `_baseVb`/`_viewOr`/`_modeTransitionBusy`, не задетые этим диффом по существу (диф не меняет их логику, только оборачивает существующий `_zoomAt`/`_resetZoom` в контроллер). Полный список — предрелизная обязанность (§8), не гейт ревью при таком объёме диффа.

## Находки

Блокирующих находок нет.

### Low (не блокируют, зафиксированы с решением ревьюера)

1. **Коммит `55cf36d6 fix: preserve structural adoption guard` — не функциональный фикс.** Диф этого коммита в `src/houseplan-card.ts` — чистая перестановка порядка двух независимых операторов внутри одного и того же `if (configChanged)` (`_cancelCameraTransition(false)` вызывается после `_geometryHistory.clear()`/`_pendingPhysicalWrites.clear()` вместо «до»). `_cancelCameraTransition` не читает и не пишет geometry history, поэтому порядок не влияет на наблюдаемое поведение — обе версии эквивалентны семантически. Коммит промаркирован `fix:`, хотя по факту ничего не чинит; наблюдение чисто по формулировке сообщения коммита, к продукту претензий нет. Решение: не возвращать, отметить и снять.
2. **AC13 (performance/screencast для тяжёлых Glow/flat/isometric fixtures) закрыт только предрелizным гейтом**, не автотестом в этом диффе — уже принято как Low в `SPEC-REVIEW-82-r1` (прецедент #73), подтверждаю то же решение на уровне кода: `src/viewport-transition.ts` не делает ничего, что могло бы задеть Glow/geometry rebuild (чистая интерполяция `{zoom, viewBox}`, никаких side-effects на кадр), и `glowAndStructuralFrameStayStable` в `smoke_smooth_zoom.mjs` подтверждает отсутствие rebuild на обычном фикстуре. Решение: не блокирует, предрелизный Full Performance гейт остаётся обязательным перед бетой.

## Проверено и корректно (по каждому AC)

| AC | Доказательство | Как проверено |
| --- | --- | --- |
| AC1 | Unit (`interpolateCameraState` start/mid/end) + `smoke_smooth_zoom`: `buttonHasIntermediateFrame`, `buttonSettlesAtExactTarget`, `wheelHasIntermediateFrames`, `fitHomeAndDoubleTapAnimate`, `farFitUsesTheSameTransition` | исполнено, все true |
| AC2 | `smoke_smooth_zoom`: `pinchIsDirectWithoutPostAnimation`; `smoke_editor_gestures`: `panWorksAndDoesNotDraw`, `pinchZoomsInPlanEditor` | исполнено |
| AC3 | Единая точка записи `_zoom`/`_view` в `_applyCameraTransitionFrame`/`_settleCameraTransition`, которую читают все слои рендера (нет отдельного copy камеры для SVG/HTML) | проверено чтением: нет второго источника координат в диффе |
| AC4 | Unit (`retarget starts from presented state and cancels the obsolete RAF`) + `smoke_smooth_zoom`: `wheelRetargetsRunningTween`, `wheelReversalKeepsAnchor` (≤0.5 px), `wheelStreamPersistsOnce` | исполнено |
| AC5 | Unit (`cancel policies...`) + `smoke_smooth_zoom`: `exactLimitsAndFitAreNoops` (RAF=0, saves=0 на fit/min/max) | исполнено |
| AC6 | pointerdown/hidden/projection — `smoke_smooth_zoom`: `pointerdownFreezesPresentedFrame`, `hiddenCommitsTargetOnce`, `projectionCancelsAndIsoSettlesExactly`. Mode/space/resize/adoption — код читает `_cancelCameraTransition(false)` в `_cancelModeTransition`, `_commitSpace`, `_refitView`, `_adoptStructuralResponses` (оба `configChanged`/`layoutChanged` пути) | смешанно: исполнено (pointer/hidden/projection) + проверено чтением (mode/space/resize/adoption) |
| AC7 | `smoke_warm_remount`, `smoke_visual_continuity` — все проверки зелёные без затрагивания камеры-контроллера (atomic paths используют `_applyView`/прямые пути, не `CameraTransitionController`) | исполнено |
| AC8 | Unit (duration=0 → `canAnimate=false` → немедленный settle) + `smoke_smooth_zoom`: `reducedMotionIsImmediate` (до и во время команды) | исполнено |
| AC9 | `_saveZoom()` вызывается ровно один раз на settle (не на кадр); ранний `if (this._mode !== 'view') return` в `_saveZoom` — не тронут, продолжает не писать editor zoom. `smoke_smooth_zoom`: `buttonPersistsOnce`, `wheelStreamPersistsOnce` (оба `=== 1`) | исполнено + проверено чтением для editor-ветки |
| AC10 | `smoke_isometric_contract` зелёный без изменений; `smoke_smooth_zoom`: `isoFinal` сравнивается с `_cameraTargetAt(...).target` — точное совпадение | исполнено |
| AC11 | `smoke_smooth_zoom`: `glowAndStructuralFrameStayStable` (глубокое сравнение JSON до/после zoom-команды); `smoke_glow`, `smoke_glow_geometry_resilience` зелёные | исполнено |
| AC12 | Unit `cancel policies...` (RAF=0 после `cancel(false)`, идентично `dispose()`); `disconnectedCallback` вызывает `_cameraTransition.dispose()` | проверено чтением + эквивалентный unit-путь |
| AC13 | См. Low-находку №2 — предрелизный гейт, не код-ревью | не прогонялось (осознанно, см. находки) |
| AC14 | `smoke_smooth_zoom`: `coldViewDoesNotLoadEditorRuntime` (проверка `performance.getEntriesByType('resource')` на отсутствие `houseplan-editor-runtime-*`) | исполнено |

Дополнительно по §8 ревью-инструкции: **«одно число — один источник»** — zoom badge (`Math.round(this._zoom * 100)}%`) остаётся единственным местом чтения `_zoom`; других мест, где масштаб пересчитывается отдельно для отображения, диф не добавил. `test/single-source-numbers.test.mjs` зелёный.

Терминология сверена с `docs/USER-GUIDE.md`/`.ru.md` и `src/i18n/en.json`/`ru.json`: «Fit all» / «Вписать всё» (`title.zoom_fit`), нет расхождений.

Release-артефакты (§21 ТЗ) на месте и в одном коммите с поведением: `CHANGELOG.md`/`.ru.md` (в `c4b8022c`, том же, что и `User-Visible: yes`), `USER-GUIDE.md`/`.ru.md`, `CANVAS.md`, `ARCHITECTURE.md`, `TESTING.md`, `STATUS.md`. Golden-коммит `779382af` несёт обязательные `Release:`/`Baseline-Reviewed:` трейлеры и внятную причину (8 изменений унаследованы от `dev`, не связаны с фичей, 139 сценариев не тронуты).

## Чего не проверял

- Полный набор из 208 browser-смоков — не по теме, не по AC; прогнал только «прямые совпадения + названные в ТЗ» (см. таблицу smoke-select выше). Оставшиеся ~36 прямых совпадений — geometry/decor-смоки, не проверял.
- `pytest tests_backend` — диф не касается Python.
- `model-invariants` — диф не касается геометрии/ссылок/`layout`.
- Performance-профиль / screencast для AC13 — сознательно оставлено предрелизному гейту (см. Low №2).
- Реальный ручной прогон в браузере (Home Assistant инстанс) — не выполнялся, ревью проходит без ручного тестирования по процессу; вопрос «работает ли» закрыт автотестами + browser-smoke выше.
- Не проверял содержимое `Baseline-Reviewed` CI-прогона (`33319326145`) построчно — доверился описанию коммита и совпадению `139 сценариев не изменились` с локальным `golden:verify` (все `passed`).

## Итог

Реализация точно следует контракту ТЗ §8–§13: отдельный camera-only controller, один RAF/token owner, retarget от представленного кадра с накоплением от pending target, явные границы отмены/владения, persistence только на settle с сохранением существующего editor-guard. Все AC либо доказаны исполненным автотестом, либо разобраны по коду с точным указанием строк. Единственные находки — Low, не входящие в скоуп блокировки. Вердикт: зелёный.
