# CODE-REVIEW-82-r2

- **Issue:** #82 «Плавное масштабирование плана: анимация zoom/fit/reset»
- **Этап:** code (PROCESS.md §2.7)
- **Заход:** r2 · блокирующих циклов израсходовано 0 из 4 (r1 был зелёным, бюджет не тратил, #227)
- **Материал:** `origin/dev...HEAD`, HEAD = `cc73252aa73007db3bd636b02eec3dd8ece871b2`
- **origin/dev на момент ревью:** `e39cd3dfa1453be140ab809cd4344f9474bd0b2c`
- **Диапазон:** 13 коммитов, `8a18e812`…`cc73252a`
- **Вердикт:** зелёный · High: 0 · Medium: 0

## Почему разбор полный, а не по дельте

После зелёного r1 (вердикт на SHA `779382af`, комментарий 2026-08-30T15:51:14Z)
ветка была ребейзнута на ушедший вперёд `dev` (`e39cd3df`), а после этого
довешено ещё 6 коммитов, которых r1 не видел (`a945ca47`…`b5324ce4`, см. ниже).
Ребейз на ушедший вперёд dev — один из явных случаев, для которых инструкция
требует полный разбор, а не разбор по дельте (§7.2: после ребейза это другой
код). Поэтому весь диапазон `origin/dev...HEAD` перечитан и перепроверен
заново, включая часть, которую r1 уже одобрил, а не только новые 6 коммитов.

Отдельное наблюдение по процессу (не находка к коду, Low): комментарий
владельца «Финальный rebase… Единственный конфликт был в
docs/images/screenshots.json… исходный код и поведение камеры не
конфликтовали» описывает состояние ДО того, как в ветку попали ещё 6 коммитов
(`a945ca47`…`b5324ce4`), один из которых (`64f54fd4`) меняет реальное поведение
`src/houseplan-card.ts` (см. AC1/AC5 ниже), а не только тесты и скриншоты.
Ни один из этих 6 коммитов не описан в отдельном комментарии issue. Это не
блокирует ревью — полный разбор ниже покрывает эти коммиты по существу — но
статус-комментарии в этом раунде не отражали фактический diff на момент
возврата задачи в S7.

## Что проверено и как

### Дешёвые гейты

Validate на точном HEAD `cc73252a` зелёный
(https://github.com/Matysh/houseplan-card/actions/runs/33320914612), поэтому
`tsc --noEmit`, `npm test` (1642, см. предыдущий зелёный прогон) и
`npm run build` со сверкой копий бандла не перегонялись как отдельная
проверка. Тем не менее `npm run bundle:sync` (= `tsc --noEmit && rollup -c` +
раскладка) выполнен локально по ходу подготовки к golden — прошёл чисто,
`dist`/`custom_components/.../frontend`/`demo/srv/assets` идентичны после
сборки, `git status` остался чистым (значит закоммиченные бандлы уже
соответствуют исходникам этого HEAD).

`node scripts/check-docs.mjs` — выполнен (diff трогает `src/**`):
`Documentation checks passed (7 files, 10 external links)`.

### Golden (не покрывается перечнем «дешёвых» гейтов из шапки этого раунда)

Diff меняет рендер (camera-контроллер, 8 «унаследованных из dev» golden-baseline
и 4 doc-скриншота, включая правку `screenshots.json`). Запущен
`npm run golden:verify` — **147/147 passed**, включая все 8 файлов из коммита
«test: accept inherited dev golden updates» (`device-dialog-desktop-de`,
`device-dialog-mobile-ru`, `toggle-entity-dialog-mobile-ru`,
`device-ripple-color-popover-mobile-ru`, `tray-medium-group-en` и т.д. — все
`passed` в выводе). Это подтверждает утверждение коммита не как заявление
автора, а как воспроизведённый прогон: текущий код рендерит ровно то, что
принято в качестве эталона, независимо от того, что сами PNG побайтово
отличаются от версии в `origin/dev` (шумовая перекодировка/иной прогон
захвата — не дефект).

### Browser smoke — выбор по диффу

`node scripts/smoke-select.mjs --base origin/dev --head HEAD`: 49 прямых
совпадений, 33 слабые связи (общий символ вроде `_modeTransitionBusy`,
`stopPropagation`). Прогнаны:

- все смок-файлы, которые сам diff **редактирует** (значит, r1 их в этом виде
  не видел): `smoke_canvas_frame`, `smoke_infinite_canvas`, `smoke_kiosk`,
  `smoke_kiosk_pan_lock` — все правки только добавляют `await` на
  устаканивание камеры перед проверкой существующих инвариантов, поведение не
  меняют;
- главный доказатель AC — `smoke_smooth_zoom` (250 строк, покрывает
  AC1–AC12, AC14 согласно ТЗ §18);
- обязательный минимум регрессий из ТЗ §18 и уже проверенный r1 набор:
  `smoke_zoom_out`, `smoke_editor_gestures`, `smoke_furniture`,
  `smoke_opening_preview`, `smoke_visual_continuity` (#73),
  `smoke_warm_remount`, `smoke_mode_transition` (#101),
  `smoke_isometric_contract`, `smoke_glow`, `smoke_glow_geometry_resilience`.

Все 15 — **зелёные** (полный вывод каждого — все ключи `true`/`OK`).

Остальные 34 «прямых» совпадения из смок-select не прогнаны: они привязаны к
`_baseVb`/`_viewOr`/`_cursorPt`/`_modeTransitionBusy` — символам, которые
внутри строки почти не меняли поведение (только сигнатуры точек входа и
уборка opening-курсора при старте команды камеры, без изменения самой логики
черчения/декора/wall-thickness). Слабые связи (33) не прогонялись — общее имя
без прямого попадания в изменённый символ.

### Что не прогонялось и почему

- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`
  (только сгенерированный JS-бандл внутри `custom_components/.../frontend`).
- `npm run invariants` — diff не трогает геометрию (нет правок рёбер комнат,
  записей толщины, `layout`, `marker.space`, `open_spans`); камера работает
  только с `viewBox`/`zoom`.
- Performance-профиль/screencast для AC13 — не прогонялся. ТЗ §21 и матрица
  AC13 сами относят это к предрелизному Full Performance гейту, не к
  автотесту в цикле ревью; то же решение уже дважды принято (r1 spec-review и
  r1 code-review). Косвенно AC13-риск (Glow/geometry rebuild на кадре)
  проверен `glowAndStructuralFrameStayStable` в `smoke_smooth_zoom` и
  `smoke_glow_geometry_resilience` — оба зелёные.
- `test/single-source-numbers.test.mjs` — механически входит в `npm test`
  (уже зелёный по Validate). Смысловая проверка сделана вручную: zoom badge
  (`src/houseplan-card.ts:11517`, `Math.round(this._zoom * 100)}%`) — единственное
  место, где процент зума выводится пользователю; он читает `this._zoom`
  напрямую, то же поле, которое `_applyCameraTransitionFrame` обновляет на
  каждом кадре. Второго источника числа не найдено.

## AC1–AC14: доказательства

| AC | Статус | Доказательство |
| --- | --- | --- |
| AC1 | Выполнен | `smoke_smooth_zoom`: `buttonHasIntermediateFrame`, `fitHomeAndDoubleTapAnimate`, `farFitUsesTheSameTransition` — все `true`; код `_stepZoom`/`_resetZoom`/`_fitAll`/`_fitFar` в `src/houseplan-card.ts:6270-6345` строят target существующей `fitView`/`_clampView` и передают его в `CameraTransitionController` |
| AC2 | Выполнен | `smoke_smooth_zoom.pinchIsDirectWithoutPostAnimation`, `smoke_editor_gestures` (pinch/pan в редакторе) — зелёные; `_zoomAt()` (immediate-путь) не создаёт transition |
| AC3 | Выполнен | Прочитано кодом: единственные reactive `_zoom`/`_view` пишутся только в `_applyCameraTransitionFrame`/`_settleCameraTransition`/`_zoomAt`, все SVG/HTML/hit-слои читают их через общий рендер-путь; `smoke_smooth_zoom.pointerdownFreezesPresentedFrame` подтверждает, что pointerdown видит реально представленный кадр, а не устаревший target |
| AC4 | Выполнен | `smoke_smooth_zoom.wheelRetargetsRunningTween` (разные token, `reverseFrom≈presentedBeforeReverse`), `wheelReversalKeepsAnchor` (≤0.5px) |
| AC5 | Выполнен | `smoke_smooth_zoom.exactLimitsAndFitAreNoops` (`active=false`, `saves=0` на fit/max/min); код `_startCameraTransition` (houseplan-card.ts:1207-1223) возвращает `false` без RAF/`_saveZoom`, если target совпадает с текущим или с уже бегущим target |
| AC6 | Выполнен | `pointerdownFreezesPresentedFrame`, `projectionCancelsAndIsoSettlesExactly`, `hiddenCommitsTargetOnce` — все `true`; код: `_cancelCameraTransition` вызван в `_stagePointerDown`, `_commitSpace`, `_setProjection`-пути (через `_cancelModeTransition`/adoption), `_refitView`, `_pageVisibility('hidden')`, config/layout adoption (`b3abfc67`) |
| AC7 | Выполнен | `smoke_warm_remount`, `smoke_visual_continuity` (#73) — зелёные без изменений поведения |
| AC8 | Выполнен | `reducedMotionIsImmediate` (`true`); `_onMotionChange` вызывает `_cancelCameraTransition(true)` при включении reduced motion, `_startCameraTransition` передаёт `duration=0` при `_reducedMotion` |
| AC9 | Выполнен | `buttonPersistsOnce`/`wheelStreamPersistsOnce` (`saves===1`); `_saveZoom()` вызывается только из `_settleCameraTransition`, один раз на settle |
| AC10 | Выполнен | `projectionCancelsAndIsoSettlesExactly` — итоговый `viewBox`/`zoom` точно совпадает с независимо вычисленным `_cameraTargetAt` |
| AC11 | Выполнен | `glowAndStructuralFrameStayStable` (`JSON.stringify` до/после равны); `smoke_glow`, `smoke_glow_geometry_resilience` зелёные |
| AC12 | Выполнен | `disconnectedCallback` вызывает `this._cameraTransition.dispose()` (houseplan-card.ts:2745); unit `viewport-transition.test.mjs` — `dispose()`→`cancel(false)` не оставляет RAF (`fake.callbacks.size===0` в тесте «cancel policies») |
| AC13 | Deferred (не автотест здесь) | То же решение, что в r1 spec- и code-review: закрывается предрелизным Full Performance/screencast гейтом, не циклом ревью. Косвенно риск закрыт `glowAndStructuralFrameStayStable` |
| AC14 | Выполнен | `coldViewDoesNotLoadEditorRuntime` (`true`, проверка через `performance.getEntriesByType('resource')`); `src/houseplan-editor-runtime.ts` не тронут диапазоном |

## Дельта сверх того, что видел r1

Сверх `c465eae8`/`54403704`/`b3abfc67` (уже одобрены r1 под именами
`895b120e…779382af`) в диапазон добавлено:

- `a945ca47` — `demo/docs/capture.mjs`: ждёт `card._cameraTransition?.active`
  перед снимком, иначе бросает. Тестовая инфраструктура, поведение продукта
  не меняет.
- `64f54fd4` — **единственный коммит с правкой продуктового кода** сверх
  того, что видел r1: `_fitFar()`/`_fitAll()` получили безусловный
  `this.requestUpdate()` перед `_resetZoom(...)` (houseplan-card.ts:5975,
  5985). Причина: `_showFar` — обычное приватное поле, не Lit `@state()`
  (houseplan-card.ts:5755), поэтому раньше рендер после клика по far-hint
  зависел от того, что `_resetZoom()` синхронно меняла `_zoom`/`_view` и тем
  самым просила update. С #82 `_startCameraTransition` может вернуть `false`
  без единого вызова хуков (когда camera-target уже совпадает с текущим) —
  и тогда без явного `requestUpdate()` смена `_showFar` не попала бы в
  рендер. Остальные правки того же коммита — `await` на устаканивание камеры
  в `demo/golden/harness.mjs`, `smoke_canvas_frame`, `smoke_infinite_canvas`,
  `smoke_kiosk` — тестовая инфраструктура.
  **Low, не блокирует:** конкретно этот no-op-путь (far-hint нажат, когда
  camera-target уже равен текущему — например повторный клик до истечения
  предыдущего fit-far) не покрыт отдельной smoke-проверкой; существующие
  тесты far-hint (`smoke_infinite_canvas.hintGoneAfterShow`) всегда бьют по
  сценарию с реальным движением камеры. Правка защитная и дешёвая
  (лишний `requestUpdate()` не создаёт видимых артефактов), риск регрессии
  низкий, поэтому не блокирует зелёный вердикт.
- `4c4399a7`, `4e24e266`, `9171644f` — три последовательных пересъёма
  doc-скриншотов (`08-room-card.png`, `09-device-info.png`,
  `06-device-editor.png`) с обновлением `screenshots.json`; `check-docs.mjs`
  зелёный на финальном состоянии.
- `b5324ce4` — 8 golden-baseline из `origin/dev`, подтверждены прогоном
  golden:verify выше (не только заявлением коммита).

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
| --- | --- | --- |
| `55cf36d6`/`b3abfc67 fix: preserve structural adoption guard` — по факту перестановка двух независимых операторов без наблюдаемой разницы поведения, замечание только к формулировке сообщения коммита | Не блокировала r1, не блокирует и сейчас; независимо перечитан diff коммита `b3abfc67` в этом раунде — подтверждаю: переставлен только порядок `this._cancelCameraTransition(false)` относительно очистки `_geometryHistory`/`_devicePositionHistory`/`_pendingPhysicalWrites`, эти операции не пересекаются по состоянию | `git show b3abfc67 -- src/houseplan-card.ts` |
| AC13 закрыт только предрелizным Full Performance гейтом, не автотестом в цикле | Тот же прецедент подтверждён и на этом SHA — решение не изменилось | Раздел AC13 выше |

## Унаследовано из r1

Поскольку ребейз на ушедший вперёд `dev` требует полного разбора (§7.2), из
r1 ничего не принято «на слово» без собственной перепроверки в этом
раунде — весь диапазон, включая уже одобренные r1 коммиты, перечитан заново
и его гейты (golden, smoke, check-docs, build) перезапущены в этом раунде.
Без повторной проверки принято только решение уровня продукта/процесса,
которое не является предметом код-ревью:

- продуктовая корректность ТЗ (структура §7.1, формулировки AC, отсутствие
  недекларированных догадок) — из `SPEC-REVIEW-82-r1.md`
  (`docs/reviews/SPEC-REVIEW-82-r1.md`, ТЗ на SHA `141d79a9`); код-ревью не
  переоценивает качество ТЗ, только соответствие ему;
- прецедент «AC13 закрывается предрелизным Full Performance гейтом» — принят
  ещё в `SPEC-REVIEW-82-r1.md` и переподтверждён `CODE-REVIEW-82-r1.md`; в
  этом раунде не пересматривается заново, только сверено, что новых
  Glow/geometry-путей в дельте нет (см. выше).

## Итог

High: 0. Medium: 0. Low: 3 (2 унаследованы и переподтверждены, 1 новая —
непокрытый smoke-тестом no-op-путь `_fitFar()`/`_fitAll()`, не блокирует).
Все AC1–AC12, AC14 подтверждены исполненным автотестом или разобраны по коду
с указанием строк; AC13 корректно отложен на предрелизный гейт по уже
принятому прецеденту. Вердикт: зелёный.
