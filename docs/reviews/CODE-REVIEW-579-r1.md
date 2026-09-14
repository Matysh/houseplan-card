# CODE-REVIEW-579-r1

Issue: [#579](https://github.com/Matysh/houseplan-card/issues/579) — «WebView pinch compositor churn»
Материал: `216990e469f2d123a81c03e99cdcb315ed756be0` (диапазон `origin/dev..HEAD`, один продуктовый коммит `216990e4` + служебный `0cbc7aff` документ ревью ТЗ)
Заход: r1 (первый код-ревью; ТЗ ревьюилось отдельно и получило зелёный вердикт, см. `docs/reviews/SPEC-REVIEW-579-r1.md`)
Блокирующих циклов израсходовано: 0 из 4

## Скоуп

Задача убирает churn промотирования/демотирования сцены (`[data-hp-live-viewbox="camera"|"floor"]`)
во время активного pinch/pan: раньше каждый budget-refresh (100 мс / 15% сдвига) и любой
полный Lit-кадр во время активного жеста переписывали `viewBox` и одновременно снимали
`transform`/`transform-origin`/`will-change`/temporary `overflow`, а следующий промежуточный
кадр создавал слой заново. Это совпадает с полевым дефектом HA Companion WebView (мигание/
белые кадры стен и пола при pinch).

Изменённые файлы класса A: `src/live-viewport.ts`, `src/live-interaction-runtime.ts`.
Классы B/C/D — тесты, документация и синхронизированный бандл, все в том же коммите.
Геометрия, жесты, i18n, конфигурация не затронуты (совпадает с заявленным не-скоупом ТЗ).

## Как проверялось

Полный разбор (не по дельте): это первый код-ревью, отдельного r0 не было.

Дешёвые гейты подтверждены зелёным Validate на этом SHA (run 34887568637 /
34887188635 — оба на `216990e4`, `typecheck+unit+build+bundle-sync+no-new-any` и
diff-мутанты все success); heavy-джобы (`smoke`, `golden`, `backend`, `hacs`,
`hassfest`, `geometry_parity`, `performance_smoke`) там ожидаемо `skipped` — обычный push,
не relaese-кандидат. Дополнительно к зачёту CI я лично прогнал на этом дереве:

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck+unit+build+bundle-sync | подтверждено Validate (см. выше) | зелёный, не перегонял |
| `no-new-any` | `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | новых `any` нет (31 строка в 2 файлах) |
| `check-docs` | `node scripts/check-docs.mjs` | 7 файлов, 12 внешних ссылок — зелёный |
| unit `npm test` | `npm test` | 2707 pass / 0 fail / 1 skip (сошлось с хендоффом) |
| unit `#579` | `node --test --test-name-pattern="#579" test/live-viewport.test.mjs` | 1/1 зелёный |
| смок, выбранный `smoke-select` | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` → 1 «зарегистрированная связь»: `demo/smoke_live_pan_coverage.mjs` | см. ниже |
| `demo/smoke_live_pan_coverage.mjs` | прогнал напрямую | `OK`, все именованные проверки `true`, включая новые `stablePromotion*` |
| `demo/smoke_editor_gestures.mjs` | AC8 | `OK`, все проверки `true` |
| `demo/smoke_smooth_zoom.mjs` | AC8 | `OK` |
| `demo/smoke_tap_ctx.mjs` | AC8 | `OK` |
| `demo/smoke_long_press_gesture.mjs` | AC8 | `ok:true` |
| `demo/smoke_isometric_live_touch.mjs` | второй consumer live-viewport | `OK`, все проверки `true` |
| `npm run continuity:screencast` | AC3, единственный оракул на представленные (не screenshot) кадры | `OK` — `capturedPinchPresentedFrames: true`, `noEmptyOrBlackPresentedFrame: true` |
| `npm run golden:verify` | диф трогает live-viewport рендер-путь | все сценарии `passed`, осевших кадров byte-diff нет |
| Мутант `live-pinch-compositor-demoted-on-budget-refresh` | `node scripts/mutation-gate.mjs --id=live-pinch-compositor-demoted-on-budget-refresh` | «заявленный тест покраснел на мутанте», поймано 1/1 |
| Мутант `live-pinch-compositor-demoted-on-active-lit-commit` | `node scripts/mutation-gate.mjs --id=live-pinch-compositor-demoted-on-active-lit-commit` | «заявленный тест покраснел на мутанте», поймано 1/1 |

**Не прогонял:**
- Полный набор `demo/smoke_*.mjs` (249 штук) — задача не задевает всё дерево, `smoke-select`
  вернул одну зарегистрированную связь плюс явно названные в AC8 смоки; этого требует диф.
- `python -m pytest tests_backend` — диф не касается `custom_components/**/*.py`.
- `npm run model-invariants` — геометрия и ссылки на неё не менялись.
- Performance-профиль как гейт (пороговое сравнение с базовым SHA) — по ТЗ и PROCESS §8 это
  предрелizный, а не ревью-гейт (AC9 сам требует «профиль перед бетой», не перед ревью); я
  прогнал `npm run benchmark:large-house-interaction` вручную как дымовую проверку (скрипт
  отработал, разумные числа, без падений), но это не заменяет сравнение с бюджетом —
  честно фиксирую как непройденный гейт, а не как «проверено».
- Физический прогон на HA Companion Android (AC10) — недоступен в этом окружении; по ТЗ и
  по прежнему прецеденту (`CODE-REVIEW-544-r1`) это полевая приёмка перед бетой, не перед
  код-ревью, и автор честно отметил её как «НЕ сделано» в хендоффе.

## AC → доказательство · чем краснеет

| AC | Доказано | Чем краснеет |
|---|---|---|
| AC1 стабильная promotion-сессия | unit `test/live-viewport.test.mjs` (`#579 a live session keeps one promoted scene layer...`), я прогнал | мутант `live-pinch-compositor-demoted-on-budget-refresh` — красный, поймано 1/1 (я прогнал) |
| AC2 бюджет сохранён | тот же unit-тест: `root.camera.writes === viewBoxWritesBeforeRefresh + 1` через порог/15%; browser smoke `stablePromotionKeepsViewBoxBudget` (я прогнал, true) | naive возврат к записи `viewBox` на каждый кадр красит этот assert — проверено чтением теста, отдельного именованного мутанта на этот AC нет (Low, см. ниже) |
| AC3 сцена не пропадает в представленных кадрах | `npm run continuity:screencast`, я прогнал: `noEmptyOrBlackPresentedFrame:true`, `capturedPinchPresentedFrames:true` | заложенный в скрипт `forbidden`-фильтр по всей серии кадров, включая pinch-участок; отдельного мутанта нет — оракул сам по себе экспериментальный (пиксельный) |
| AC4 эффекты не отключаются (day cycle/Glow/room fills/hatching/фон) | **не доказано отдельным тестом** — см. находку M1 | — |
| AC5 слои синхронны ≤1px | `demo/smoke_live_pan_coverage.mjs` (`isoMouseRightEdgeMarkerParity` и др., pre-existing, не тронуто #579), я прогнал — зелёный | — |
| AC6 terminal cleanup | unit-тест (settled removes all styles) + smoke `stablePromotionCleansAtTerminal`, я прогнал | мутант `live-pinch-compositor-demoted-on-active-lit-commit` — красный, поймано 1/1 (я прогнал) |
| AC7 существующее покрытие края не потеряно | `demo/smoke_live_pan_coverage.mjs` coverage-проверки, я прогнал — зелёный | существующий (до #579) mutant этого смока входит в diff-мутанты CI (6/6 success) — не прогонял лично, доверяю CI |
| AC8 нет регрессии управления | `smoke_editor_gestures`, `smoke_smooth_zoom`, `smoke_tap_ctx`, `smoke_long_press_gesture`, я прогнал все — зелёные | — (не защитный AC в терминах §2.7, обычное сравнение) |
| AC9 производительность | не прогнан как гейт (см. «Не прогонял») | предрелизный, по ТЗ и PROCESS §8 |
| AC10 полевой Companion-контроль | явно не сделано, задокументировано в хендоффе | приёмка перед бетой, не перед код-ревью |

## Находки

### Medium (в скоупе задачи — жёлтый вердикт, чинится в этом issue)

**M1 — AC4 (матрица day cycle/Glow/room fills/hatching/фон) не имеет тестового доказательства.**

ТЗ (раздел «Критерии приёмки», AC4) прямо требует: «Матрица day cycle off/on, Glow off/on,
room fills, штриховка и пользовательский фон остаётся видимой во всех sampled кадрах.
Доказательство: браузерный smoke на контрастной fixture». Диф трогает три тестовых файла:
`test/live-viewport.test.mjs`, `demo/smoke_live_pan_coverage.mjs`, `demo/screencast_visual_continuity.mjs`.
Ни один не включает Glow (`glow_enabled`/`glow_radius_cm`) или day cycle в используемой fixture —
проверено чтением: дефолтный fixture `demo/srv/demo.html` (`const CFG = {... settings: {} ...}`)
не задаёт ни то, ни другое, а обе смоки не трогают `card._serverCfg.settings` вообще (`grep` по
обоим файлам на `glow`/`day_cycle` — пусто). Единственная fixture-правка — уже существовавшая
до #579 «coverage-room» с `fill_color`, не новая для этой задачи.

Воспроизведение находки (не дефект продукта — пробел evidence): `grep -n "day_cycle\|glow"
demo/smoke_live_pan_coverage.mjs demo/screencast_visual_continuity.mjs` — 0 совпадений.

Смягчающее обстоятельство, найденное чтением `src/houseplan-card.ts`: room fills, Glow
(`_renderGlowBaseRooms`/`_renderGlowLayer`, строки ~11769–11777) и hatching рендерятся внутри
того же корневого `<svg data-hp-live-viewbox="floor">` (открывается на `:11593`), что и стены/пол —
то есть тот же самый механизм compositor-стабильности, который AC1 доказывает для стен,
структурно распространяется и на них: нет отдельного код-пути, который мог бы демотировать
Glow независимо от пола. `renderDayCycleEnvironment` (`:11583`), напротив, рендерится ДО этого
SVG как отдельный элемент без `data-hp-live-viewbox` — он вообще не участвует в
исправляемом lifecycle, поэтому риск для дневного цикла из этого бага структурно ниже, чем
для Glow. Это разобрано чтением, а не исполнением, и не заменяет обещанный в ТЗ смок.

Остаточный риск нельзя закрыть только чтением: Glow использует SVG-фильтры/blur-пулы, а
именно комбинации GPU-фильтров с компоновкой слоёв — типичный источник WebView-специфичных
артефактов (сам issue ссылается на это как на общий класс проблем). Обещанный оракул
(«sampled кадры» во время удержанного pinch с Glow/day-cycle включённым) технически
достижим тем же приёмом, что уже применён в `runStablePromotion`/`screencast_visual_continuity` —
включить `glow_enabled`/day-cycle в используемую fixture и подтвердить отсутствие потери
пикселей в held-кадрах, как уже делается для `coverage-room`.

Без блокирующих (High) находок это жёлтый вердикт: правка (добавить Glow/day-cycle в
существующую fixture смоков и подтвердить сохранение видимости в held-кадрах, либо
явно и обоснованно снять эту часть AC4 через ревью) остаётся в этом же issue, отдельный
issue не заводится (#202).

### Low

**L1 — AC2 не имеет именованного мутанта.** У AC2 («бюджет сохранён») нет специального
`MUTANT_DEFINITIONS`-контрпримера — доказательство ограничено прямым assert'ом в unit-тесте
(`root.camera.writes === viewBoxWritesBeforeRefresh + 1`), которого я прочитал и прогнал; он
действительно упал бы при регрессии к побюджетной записи, но без явной мутации это не
формализовано как «чем краснеет» по правилам §2.7. AC2 не новый в этой задаче (природа budget
refresh — из #531), находка образовательная, не блокирует: снимаю с записью, отдельной правки
не требую.

## Что проверено и корректно

- Единственная точка входа `commitHouseplanViewport(host, keepSceneLayer)` имеет ровно один
  вызывающий (`LiveRuntime.commit()` → `this.active()`), никаких других колл-сайтов с
  устаревшей сигнатурой не осталось (`grep` подтверждает).
- `this.active()` покрывает оба независимых источника continuous-режима: реальные pointer-
  контакты (`_pointers.size`, drag-состояния) и анимированные камера-переходы
  (`_cameraTransition.active`, которым идут wheel-zoom через `_startCameraTransition` и
  toolbar-zoom) — прочитано `_onWheel`/`_stepZoom`, оба используют camera-transition, а не
  прямую мутацию `_zoom`/`_view` в обход контроллера, поэтому «session properties, не user-
  agent» (контракт п.9) выполняется единообразно для мыши, touch и программной камеры.
- `_stagePointerUp`/`_stagePointerCancel` (не тронуты диффом, но задействованы контрактом
  п.4) гарантированно вызывают `requestUpdate()` при обнулении `_pointers`, что даёт
  терминальный Lit-кадр и, следовательно, `commit(..., false)` после отпускания.
- HTML-маркеры (`[data-hp-live-layer="camera"]`) не получили `keepSceneLayer`-исключения —
  их путь (через `painted`/`current`, а не через якорь сцены) не изменился, что и объясняет,
  почему AC5 (парity ≤1px) остался зелёным без единой правки в этой части.
- Дедупликация записи стилей (сравнение по свойству, а не строкой transform целиком) строго
  сильнее старой версии: старый код мог оставить `transform` без `transformOrigin`/`will-change`
  в вырожденном случае (ранний `return`), новый — нет; это не регрессия, а попутное усиление.
- Изометрия использует общий `sceneCamera`/`sceneFloor` на все `data-hp-live-viewbox="camera"`
  элементы, но все они делят один и тот же `view` (проверено чтением шаблона `:11588-11843`) —
  риск «одна матрица на разные проекции», названный в ТЗ, не реализуется, и это поведение не
  менялось диффом.
- `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/TOUCH-SUPPORT.md` обновлены точно и
  согласованно с кодом; `docs/images/screenshots.json` — только новый `sourceFingerprint`,
  байты PNG (`imageSha256`) не изменились (путь `docs:accept --identical`).
  Оба changelog (`docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`) в том же коммите, трейлеры
  `Issue: #579` / `User-Visible: yes` на месте, ветка и коммит — один продуктовый коммит.
- «Одно число — один источник»: диф не добавляет и не меняет ни одной пользовательски видимой
  величины (zoom-бейдж не тронут) — неприменимо.

## Вердикт

Единственная находка — Medium в скоупе задачи (AC4 без прямого теста), блокирующих (High)
находок нет. Это жёлтый вердикт: возврат автору на добавление evidence для AC4 (или
обоснованное сужение этой части AC ревьюером/владельцем), остальное подтверждено чтением и
исполнением перечисленных гейтов.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/579-webview-pinch-compositor`, коммит `216990e469f2` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `09aab067582821f39940f59986820362cf079666`
  ```
  git log --all --format='%H %T' | grep 09aab0675828
  ```
- Тело issue: `4545e4010a0a0d13588d41c73912f543b83f5091653de15127390b77630498a0`
- Вердикт конвейера: `yellow` · High 0
