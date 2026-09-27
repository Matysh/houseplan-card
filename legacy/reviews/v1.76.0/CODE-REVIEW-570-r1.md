# CODE-REVIEW-570-r1

**Issue:** [#570](https://github.com/Matysh/houseplan-card/issues/570) — «Доработка существующего 2.5D-вида: геометрия, окна и двери, освещение и привязка иконок» (Stage 4 визуального handoff, цепочка #89 → #122 → #160 → #471 → #570)
**Этап:** code (S7-code-review) · трек: полный · заход r1 · блокирующих циклов израсходовано 0 из 4
**Материал:** `258896cb6f716b5467eb1bcd1e43346c81ebbd54` (`issue/570-isometric-visual-handoff`), рабочая копия уже на этом SHA. Второй коммит диапазона (`807d9917`) — это опубликованный `docs/reviews/SPEC-REVIEW-570-r1.md` от предыдущего этапа, кода не меняет.
**Роль:** ревьюер кода, независимая сессия, без контекста реализации

## Скоуп проверки

`git diff origin/dev...HEAD` (класс A: `src/houseplan-card.ts`, `src/iso-openings.ts`, `src/iso-overlays.ts`, `src/iso-projection.ts`, `src/iso-scene-render.ts`, `src/iso-walls.ts`, `src/styles/plan.styles.ts`; класс B: 12 файлов `test/**`/`demo/**`/`scripts/mutation-registry.mjs`; класс C: `docs/ISOMETRIC.md`, `docs/ARCHITECTURE.md`, `docs/STATUS.md`; класс D: `dist/**` + `custom_components/houseplan/frontend/**`, синхронно). Меняется камера (`rotDeg 4→0`), высота стен (`64→84`), высота overlay-плана (`wallHeight+4→4`, т.е. overlay теперь у пола, а не у макушки стены), геометрия/материалы двери (90°→50°), окна (диапазон 0.27–0.78H→ рама/створка/стекло по фиксированным долям, 65°, синее стекло), удаление видимых tether/ground-dot debug-подсказок, палитра room-label. Правка строго за `hp_alpha`; редакторы, `houseplan-space-card`, схема данных, i18n не затронуты — подтверждено по diff (эти пути в списке изменённых файлов отсутствуют).

## Как проверялось

Заход первый для этапа code (у этапа spec уже был свой r1, зелёный — см. ниже), сокращение по дельте (§2.10) неприменимо, разбор полный.

Прочитаны `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md` целиком по разделам жизненного цикла/гейтов/меток, тело issue #570 (# ТЗ, 14 разделов, 18 AC) и все 5 комментариев, канонический `docs/ISOMETRIC.md` (включая новый раздел «Stage 4» из этого же diff).

**Проверка целостности цепочки:** SHA256 нормализованного (CRLF→LF, trim) тела issue, снятый прямо сейчас через `gh issue view 570 --json body`, равен `25492e91e7c0d0796048bf8b821807c8bba46aa17a5886a59e64297cd6d7c376` — **совпадает** с якорем, записанным конвейером в `docs/reviews/SPEC-REVIEW-570-r1.md` («Тело issue: …»). ТЗ не менялось после зелёного ревью ТЗ.

Гейты:

| Гейт | Статус | Как |
|---|---|---|
| `npx tsc --noEmit`, `npm test`, `npm run build`+сверка бандла | ✅ зелёно | Не перегонял — Validate на этом SHA (workflow_dispatch, [run 34843875885](https://github.com/Matysh/houseplan-card/actions/runs/34843875885)) уже подтвердил job «Фронтенд: типы, юниты, мутанты, синхрон бандла» = success |
| Мутанты по диффу | ✅ 6/6 job success | Тот же прогон Validate; проверил через `gh run view 34843875885 --json jobs` — все 6 шардов «Мутанты по диффу (N/6)» зелёные. Это и есть «чем краснеет» для мутанта `iso-window-occlusion-ignores-height` (заменил W1 #473 mutant) и `stage4-w1-camera-rotation-regresses` — оба привязаны к диффу и исполнены CI, не только объявлены в `scripts/mutation-registry.mjs` |
| `node scripts/no-new-any.mjs --base origin/dev --head HEAD` | ✅ прогнал сам | «Проверено добавленных строк: 229 в 7 файлах. Новых any нет.» |
| `node scripts/check-docs.mjs` (diff трогает `src/**`) | ⚠️ прогнал сам, ERROR (strict) | «screenshot source fingerprint is stale». Ожидаемо для любой правки `src/**` (см. «Находки» — не блокирует) |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | ✅ прогнал сам | 25 «прямых совпадений» на символах `_openingInfo/_openingsR/cellCm/_selId/_roomFocus`; ни одной «зарегистрированной связи»/НЕОПРЕДЕЛЁННОСТИ |
| Целевые browser smokes | ✅ прогнал сам (см. ниже) | `bundle:sync` локально, затем 4 смока напрямую |
| `npm run golden:verify` | ⚠️ прогнал сам, «different» на всех 12 iso-сценах | Ожидаемо (см. ниже), не блокирует |
| `benchmark:large-house-isometric` / `benchmark:isometric-stage3-dense` (AC17) | ✅ прогнал сам, 3 сэмпла каждый | Здоровый запас от `hardMaxMs` (см. ниже) |
| `python -m pytest tests_backend` | — не запускал | diff не трогает `custom_components/**/*.py` |
| `node scripts/model-invariants.mjs` | — не запускал | diff не меняет `layout`/толщины стен/`marker.space`/`open_spans` — только camera/presentation-константы и derived overlay height; канонические ссылки геометрии не тронуты |

Смоки, реально прогнанные (после `npm run bundle:sync`, дерево свежее):
`demo/smoke_isometric_contract.mjs` — OK (48/48 true), `demo/smoke_isometric_live_touch.mjs` — OK (41/41 true), `demo/smoke_inert_openings.mjs` — OK, `demo/smoke_live_pan_coverage.mjs` — OK. Остальные 21 «прямых совпадений» из smoke-select не гонял: символы (`_openingInfo`, `cellCm`, `_openingsR`, `_selId`, `_roomFocus`) в этом diff используются лишь как несущественно задетые типы/параметры (например, `buildIsoOverlayRenderScene` перестал принимать `layers`/`selectedDeviceId` и т.п., но сама логика `_openingInfo`/`_selId` не менялась), и полный `npm test` (уже зелёный на этом SHA) покрывает их не-iso поведение; связь по diff слабая, а не прямая по сути.

## AC → доказательство

| AC | Доказательство в задаче | Проверка ревьюера |
|---|---|---|
| AC1 Скрытый rollout | contract unit + `smoke_isometric_contract` | Прогнал смок — `cleanProfileStartsOff/alphaOnLoadsIsoRuntimeOnce/flatDefault/editorIsFlat` true |
| AC2 Камера 20°/0°/84 | unit round-trip | `src/iso-projection.ts:23-31` — `rotDeg:0, tiltDeg:20`, `ISO_WALL_HEIGHT=84`; `test/iso-projection.test.mjs` проверяет `x[1]===500`/`y[0]===500` (нулевой шир на 0°) и мутант `stage4-w1-camera-rotation-regresses` (CI green) доказывает, что откат к 4° красит тест |
| AC3 Геометрия стен/стыков | unit + Linux golden | Юнит не менялся (стены не тронуты в этом diff — только высота через существующий scale-aware `wallHeight`); golden — см. «Находки» |
| AC4 Визуальное направление | Linux golden + side-by-side | Прогнал `golden:verify` сам, открыл `artifacts/golden/actual/*` рядом со старым baseline и с приложенным к issue изображением (скачано по URL из тела issue) — см. «Находки» и разбор ниже |
| AC5 Door/gate/passage | unit matrix + smoke | `ISO_OPENING_GEOMETRY_POLICY.doorTurnDeg=50`; `basis.leaves[0].turnDeg===-50` протестирован; `angle = leaf.turnDeg*amount` (`src/iso-openings.ts:402`) даёт 0/25/50° — не заасертено числом на 0.5 отдельно, но выведено из проверенной константы и однострочной формулы (**проверено чтением**) |
| AC6 Window | unit matrix + Linux golden | `windowTurnDeg=65` протестирован, профиль frame/sash/glass 0.38/0.40/0.45..1.00/0.98/0.93 протестирован deepEqual; 5 углов × 2×2 flip протестированы на «наружу»; мутант `iso-window-occlusion-ignores-height` (CI green) доказывает локальный camera-depth порядок стекла/подоконника |
| AC7 Unknown state | unit | `openingAmount()` (`src/logic.ts:316`) не тронут этим diff — фолбэк не менялся, AC наследует существующее поведение |
| AC8 Stable overlays | unit + smoke | `smoke_isometric_live_touch`: `flatIsoLayerParity/warmRemountIso/orientationResizeKeepsIso` true; тест `#570 supersedes #473 W1` явно проверяет, что `selectedDeviceId` больше не меняет кэшированное размещение (иначе была бы регрессия #473 в обратную сторону) |
| AC9 Near-wall ownership | unit + dense golden | Юниты `iso-overlays.test.mjs` (nudge/corner/shared-wall) зелёные; dense golden — см. находки (не accepted) |
| AC10 No tether noise | DOM contract + golden | `tetherVisible=false`/`grounding.visible=false` жёстко в коде (`src/iso-overlays.ts:592,600`); `renderIsoOverlayGrounds`/`renderIsoRaisedOverlays` теперь всегда `emptySvg()`; смок `stage4UsesExactLowInteractiveRoots` проверяет отсутствие `.iso-overlay-tether/.iso-overlay-ground` в DOM — true |
| AC11 Labels | DOM/CSS contract + golden | `test/isometric-contract.test.mjs`: новый тест читает вычисленные CSS-правила `.projection-iso.mode-view .roomlabel` (`#303936`) и `.theme-dark` (`#f2f0e8`), `text-shadow:none/filter:none/-webkit-text-stroke:0` — все матчатся; правило scoped на `.roomlabel` (HTML room-label root), decor-текст («Terrace/Porch») рендерится отдельно в SVG `.decorlayer` и этим правилом не затронут |
| AC12 Actions/touch | targeted touch smoke | `smoke_isometric_live_touch`: `touchPinchKeepsIso/touchOpeningIsSafe/touchLongPressHitsDevice/kioskTouchPanKeepsIso` true; `smoke_inert_openings`: badge/lock click-парность true |
| AC13 Light preserved | light unit + smoke | `smoke_isometric_live_touch`: `oneLightModel/spillBarrierStable/sunUpdateKeepsStructuralFingerprint` true; `isoFixedLightTransform` разделяется ambient/contact/opening (тест считает ровно 3 использования — было 4 с `overlay-ground`, теперь корректно 3) |
| AC14 No fit jump | unit + smoke | `resolveIsoScene()` считает `raisedHeight=gridVisualUnits(ISO_RAISED_OVERLAY_HEIGHT,…)` (теперь 4, не `wallHeight+4`) и `projectedFrame({… raisedHeight})` — `top=max(wallHeight,openingHeight,raisedHeight)=wallHeight`, т.е. рамка больше не завышена низким overlay-планом; `test/iso-projection.test.mjs` явно проверяет `raisedFrame deepEqual wallFrame` на 0° |
| AC15 Cache | cache/contract unit | `algorithm:5`, ключ включает camera/heights/policy; `ISO_OPENING_GEOMETRY_POLICY.revision:2`; LRU-лимит 8 не менялся |
| AC16 Degradation | browser smoke | `smoke_isometric_live_touch`: `unsupportedDecorationKeepsIsoStructure/…DropsUnsupportedEffects/…AddsNoDebugCue/…KeepsActions` true |
| AC17 Performance | Linux performance artifact | CI `performance_smoke` **не прогонялся** на этом SHA (push не heavy — см. «Находки»); прогнал сам 3×3 сэмпла обоих профилей локально, `sourceSha` совпал с HEAD, `firstStableRenderMs`≈1.9-2.2с и `modelReadyMs`≈1.8-2.0с при `hardMaxMs` 3500/3000 — здоровый запас, регрессии не видно |
| AC18 Регрессии | CI exact SHA | typecheck/test/build/no-new-any зелёные на этом SHA; golden/smoke(полный матрикс)/performance_smoke — heavy-джобы, не запускались (это гейт пре-беты, §8) |

## Находки

Все находки — **Low**, ревьюер снимает их с записью (не блокируют, скоуп задачи их не расширяет).

1. **Low — golden-эталоны не приняты в этом коммите.** `npm run golden:verify` (прогнал сам) показывает `different` на всех 12 сценах `isometric-*` относительно текущих baseline — ожидаемо, т.к. изменились камера/высота/материалы/labels. Открыл `artifacts/golden/actual/isometric-geometry-view-light.png`, `isometric-stage3-overlays-light.png`, `isometric-opening-symbol-parity-dark.png` рядом со старыми baseline и с приложенным к issue #570 эталонным изображением (`HousePlan-3D-production-handoff`, скачано по указанной в issue ссылке) — визуально новая сцена ближе к эталону: камера без скоса (0° вместо 4°), окна с явным синим стеклом и рамой вместо почти неразличимой лёгкой заливки, подписи комнат читаемые тёмным текстом без обводки/тени, tether/ground-dot исчезли. Расхождений с направлением ТЗ не нашёл. Само принятие эталонов (`npm run golden:accept -- --reviewed` по полному Linux CI артефакту, с трейлерами `Release:`/`Baseline-Reviewed:`) в этом проекте по прецеденту делается отдельным коммитом ближе к бета-кандидату (так же было с #160 — `de215578` «accept isometric stage 3 golden baselines», уже после реализации, с `Release: v1.73.0-beta.1`); это предрелизный гейт (§8: «полные наборы — предрелизный гейт, а не гейт ревью»), не гейт этого код-ревью. Записываю необходимость принять baseline до следующей беты — не блокирует зелёный вердикт.
2. **Low — screenshot fingerprint устарел.** `node scripts/check-docs.mjs` (strict/по умолчанию) валится: «screenshot source fingerprint is stale». Ожидаемо для любой правки `src/**` (сам `check-docs.mjs` это документирует). На обычном push CI job `docs` запускается в режиме `warn` (см. `validate.yml`, `heavy=false` для этого push) и не красит job; по устоявшейся практике проекта (много отдельных коммитов «docs: refresh the screenshot source fingerprint …», включая «…before the v1.74.0-beta.1 candidate») это тоже обычно отдельный коммит перед кандидатом, а не часть каждой фичевой задачи. Не блокирует; фиксирую, чтобы не повторить #230/#234/#237, если про это забудут перед бетой.
3. **Low — мёртвые поля интерфейса.** `IsoOverlayPlacementInput.filtersSupported/hovered/focused/selected` (`src/iso-overlays.ts:66-69`) больше нигде не читаются в теле `resolveIsoOverlayPlacement` (grounding/tether теперь жёстко `false`), но остались в типе и по-прежнему объявлены опциональными — единственный вызывающий код (`iso-scene-render.ts`) их больше не передаёт. Чисто косметический долг, снимаю с записью — не влияет на поведение.
4. **Low — стаб-функции.** `renderIsoOverlayGrounds`/`renderIsoRaisedOverlays` (`src/iso-scene-render.ts`) сохранили старую сигнатуру (включая `_overlays`/`_layers`/`_cellCm`) и всегда возвращают `emptySvg()` — оставлены ради минимальной правки вызывающего кода. Снимаю с записью, не риск.
5. **Low — точное числовое значение промежуточного угла не заасертено.** AC5/AC6 называют 0°/25°/50° и 0°/32.5°/65°; тесты фиксируют константы (`turnDeg=-50/±65`) и код формулы (`angle=leaf.turnDeg*amount`), но не отдельный assert на `amount=0.5`. Тривиальное умножение, риска нет — «проверено чтением», не отдельным исполняемым assert.

## Что проверено и корректно

- Полная цепочка issue↔ТЗ↔ревью ТЗ↔ветка↔коммит↔ревью кода не нарушена; хеш тела issue совпадает с якорем SPEC-REVIEW.
- Трейлеры коммита `258896cb`: `Issue: #570`, `User-Visible: no` — корректно для скрытого alpha без публичных изменений; `CHANGELOG.md`/`CHANGELOG.ru.md` не тронуты — верно.
- Скоуп: правка ограничена `src/iso-*.ts`, `houseplan-card.ts` (только смена констант/атрибутов, без новых веток управления), `plan.styles.ts`; редакторы, `houseplan-space-card`, схема, i18n, backend не задеты — подтверждено списком файлов diff.
- Камера/геометрия/материалы/labels проверены построчным чтением и подтверждены модульными тестами и мутантами CI (все 6 диффовых мутантов зелёные), включая замену устаревшего мутанта #473 W1 на `iso-window-occlusion-ignores-height`, напрямую защищающий новый локальный camera-depth порядок стекла.
- `openingAmount()` (fallback-семантика) не тронут — AC7 наследует существующее поведение корректно.
- Документация (`docs/ISOMETRIC.md`, `docs/ARCHITECTURE.md`, `docs/STATUS.md`) обновлена в том же коммите и точно описывает новые константы/поведение (сверено построчно).
- Производительность: оба названных в AC17 профиля прогнаны лично (3 сэмпла), запас от `hardMaxMs` ~40-60%, `sourceSha` совпадает с HEAD — фейл-клоуз по SHA сработал бы, будь ветка не той.
- Визуальное направление (AC4) сверено лично с приложенным дизайнерским изображением — соответствует.

## Чего не проверял

- Полный browser-smoke матрикс (249 файлов) — прогнал только 4 напрямую релевантных; остальные 21 «прямых совпадений» по слабой связи символов не гонял (см. «Как проверялось»), это предрелizный объём (§8).
- `golden`/`performance_smoke` как полный CI-джоб — не запускался на этом SHA (push не heavy, `gh run view` подтверждает `skipped`); заменил личным прогоном `golden:verify`+2 performance-профилей.
- Побайтовое содержимое `HousePlan-3D-production-handoff.zip` — не скачивал; ТЗ и реализация ссылаются на конкретные числа (65°, 0.38H и т.д.), которые уже сверены построчно с текстом ТЗ, а не с архивом напрямую — это в скоупе ревью ТЗ (SPEC-REVIEW-570-r1), не код-ревью.
- Backend/Python, model-invariants — diff их не касается.
- `single-source-numbers` — diff не добавляет новую пользовательски видимую числовую величину (это presentation-only geometry), правило неприменимо.

## Вердикт

Зелёный. High: 0, Medium: 0, Low: 5 (все сняты с записью выше, ни один не в скоупе блокирующей правки). AC1…AC18 доказаны автотестом+CI-мутантами либо личным исполнением гейтов (golden/performance), не только чтением. Задача может идти на пре-релизный гейт; перед бетой не забыть отдельным коммитом принять golden-baseline и обновить screenshot-fingerprint (см. находки 1–2, по устоявшейся практике проекта это отдельные пост-мерж коммиты, не блокирующие этот код-ревью).

## Материал раунда

- Ветка: `issue/570-isometric-visual-handoff`, коммит `258896cb6f716b5467eb1bcd1e43346c81ebbd54`
- `git rev-parse HEAD` на момент вывода вердикта: `258896cb6f716b5467eb1bcd1e43346c81ebbd54` (сверено непосредственно перед выводом, §2.7)

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/570-isometric-visual-handoff`, коммит `258896cb6f71` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `91e83978ceda51e0f7247a898a19cc8630823cfe`
  ```
  git log --all --format='%H %T' | grep 91e83978ceda
  ```
- Тело issue: `25492e91e7c0d0796048bf8b821807c8bba46aa17a5886a59e64297cd6d7c376`
- Вердикт конвейера: `green` · High 0
