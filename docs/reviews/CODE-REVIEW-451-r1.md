# CODE-REVIEW-451-r1

- **Issue:** #451 «План подтормаживает: диагностика на каждый кадр, реактивная камера, отсутствие фильтра HA-тиков»
- **Этап:** код-ревью, заход r1 (первый действительно проведённый — предыдущая попытка не читала код: ветка не ребейзилась на `dev` без конфликта, цикл не израсходован)
- **Материал:** `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`, SHA `1850eb18b5e8f0813f9d2efb50694dc4ca1fff26`
- **ТЗ:** `docs/specs/451-render-performance.md` (полный трек, `SPEC-REVIEW-451-r2` зелёный)
- **Вердикт:** см. итог в конце документа

## Скоуп диффа

75 файлов, +3947/‑1166 (без учёта `dist/**`/`custom_components/.../frontend/**`, класс D). Новые модули:
`src/render-invalidation.ts`, `src/houseplan-render-lifecycle.ts`, `src/live-viewport.ts`,
`src/live-hover.ts`, `src/live-editor.ts`, `src/live-interaction-runtime.ts`,
`src/pointer-move-queue.ts`, `src/interaction-types.ts`. Изменены `src/houseplan-card.ts`
(overridden `requestUpdate`, diagnostics, terminal reconciliation), `src/houseplan-editor-runtime.ts`
(pointer-move очереди для plan/decor/backdrop/opening/resize), `src/render-device-snapshot.ts`
(`entityIds`), `src/zigbee-topology-overlay-bridge.ts` (live-layer маркер). Плюс performance harness
(`demo/benchmark_large_house.mjs`, `budgets-large-house-interaction.json`, `card-contract.mjs`,
`evaluate.mjs`, `performance.yml`) и точечные правки существующих `demo/smoke_*.mjs` под новую разметку
`data-hp-live-*`. Геометрия/модель стен, `layout`, `marker.space`, `open_spans` не тронуты — гейт
`npm run invariants` не требуется, что подтверждается и явным «Non-scope» ТЗ.

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный |
| unit | `npm test` | 1956 tests, 1955 pass, 1 skip, 0 fail |
| build + бандл | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` + `diff -rq` на `houseplan-assets` | совпадают байт-в-байт |
| docs fingerprint | `node scripts/check-docs.mjs` (обязателен — diff трогает `src/**`) | «Documentation checks passed (7 files, 12 external links)» |
| any-гейт | не запускал отдельно — новые файлы не содержат `any` (проверено чтением), `npm test`/`typecheck` зелёные | проверено чтением |
| smoke-select | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 98 прямых совпадений + 36 слабых из 221 (см. `smoke-select.txt`) |
| smoke (почти полный набор) | все 134 файла из прямых+слабых совпадений, `node demo/smoke_<name>.mjs` по одному | 133 OK, 1 нестабильный (см. ниже, не регрессия) |
| golden | `npm run golden:verify` | 153/153 сценариев `passed`, 0 diff — доказывает AC9 (pixel-equivalence) |
| performance (структурные assert'ы) | `npm run benchmark:large-house-interaction -- --samples=7 --warmups=1` | завершился без throw — структурный контракт (0 full render на hover/pan/editor move, 1 terminal, 0 diagnostics scans) подтверждён на этом SHA |
| performance (абсолютные потолки) | `npm run benchmark:compare -- --absolute-only --budgets=demo/performance/budgets-large-house-interaction.json --candidate=<report>` | **6 проверок красные** — см. находку H1 |
| backend | не запускал — диф не трогает `custom_components/**/*.py` (проверено чтением: `git diff --name-only` не содержит `.py`) | проверено чтением |
| invariants | не запускал — диф не трогает геометрию/`layout`/`marker.space`/`open_spans` (проверено чтением) | проверено чтением |

Не прогонял полный `demo/smoke_*.mjs` (все ~221) и полный `performance.yml` (`Full Performance`,
парный base/candidate на двух чекаутах) — первое избыточно (134 из 221 уже покрывают все «прямые» и
«слабые» совпадения smoke-select, второе требует парного окружения, которое не гейт код-ревью
(PROCESS.md §8: «полные наборы — предрелizный гейт»). Раздельный прогон `--absolute-only` (см. выше)
компенсирует это для абсолютных потолков нового профиля — и именно он нашёл H1.

## Находки

### H1 (High, блокирует) — новый performance-профиль `large-house-interaction-v1` не проходит собственный бюджет

**AC10** требует: «новый interaction profile проходит все structural, absolute и base-relative checks
§11». Структурные проверки (0 full render на hover/pan/camera/editor move, ровно 1 terminal, 0
diagnostics scans, стабильный heavy DOM, ошибка совмещения SVG/HTML ≤1px) — подтверждены, профиль не
бросает исключение. Но абсолютные потолки, которые сам же диф вводит в
`demo/performance/budgets-large-house-interaction.json`, не выполняются при фактическом прогоне.

**Воспроизведение** (детерминировано, не связано со скоростью машины — см. ниже):

```
npm run benchmark:large-house-interaction -- --samples=7 --warmups=1 --output=/tmp/interaction-review7.json
npm run benchmark:compare -- --absolute-only \
  --budgets=demo/performance/budgets-large-house-interaction.json \
  --candidate=/tmp/interaction-review7.json --output=/tmp/interaction-compare7.json
```

Результат — 6 красных строк:

```
❌ timing.interactionSeriesMs.median | 3501.5 | 3000
❌ timing.editorSeriesMs.median      | 1841.9 |  750
❌ longTask.editorSeries.maxSingleMs |    878 |  150
❌ longTask.editorSeries.countP95    |      4 |    3
❌ longTask.editorSeries.totalP95Ms  |   1633 |  300
❌ cache.entries.cleanFloor          |    140 |  100
```

`cache.entries.cleanFloor` — счётчик записей `Map`, не таймінг, машинно-независим. Проверено на **двух**
независимых прогонах (`--samples=3` и `--samples=7`), значение **140 во всех 10 сэмплах без единого
отклонения**. Для контроля прогнан немодифицированный `large-house-v1` (существует и на `dev`, диф его
не трогает):

```
npm run benchmark:large-house -- --samples=3 --warmups=1 --output=/tmp/base-profile-review.json
# cleanFloor: 100, 100, 100 — ровно документированный потолок (demo/performance/README.md:
# «the reviewed fixture warms exactly 100 deterministic room/physical-body entries»)
```

Значит переполнение специфично именно для новой `editor series` части `large-house-interaction-v1`
(последовательность `_setMode('plan')` → `_tool='resize'` → cancel → `_setMode('decor')` →
`_setMode('view')`), которую этот же диф добавил в `demo/benchmark_large_house.mjs`. Разница ровно
+40 записей (два «лишних» полных прохода флор-кэша сверх документированного одного) коррелирует с тем,
что тайминговые метрики именно `editorSeriesMs`/`longTask.editorSeries.*` превышены в 2,4× и более —
похоже на одну и ту же причину (лишний(е) пересчёт(ы) `_cleanFloor`/`floorMinusBodies` при переключении
режима редактора), а не на независимый шум.

Попытка воспроизвести на упрощённой ручной фикстуре (`page.evaluate` с прямым вызовом `_setMode` без
полного цикла реального pointer-move, который использует бенчмарк) рост `_cleanFloorCache.size` не
показала — то есть причина не в самом факте смены режима, а где-то в фактической
resize/decor-транзакции бенчмарка (drag-preview → cancel) или в стечении с реальными pointer-событиями.
Дальнейшая локализация — задача автора; здесь важен сам факт: **AC10 не выполнен по написанному самим
автором для этой задачи бюджету**, а не только гипотеза о причине.

Тайминговые превышения (`interactionSeriesMs`, `editorSeriesMs`, `longTask.editorSeries.*`) в отличие
от `cleanFloor` теоретически могут быть частично усилены более медленной/разделяемой машиной ревьюера
против выделенной машины владельца (`demo/performance/README.md`: «Local Windows checkout is the
day-to-day environment... local report is diagnostic only»), но margin (1842 мс против потолка 750 мс,
878 мс одна long task против потолка 150 мс) для чистого шума великоват, и коррелирует с детерминированным
`cleanFloor`-превышением. Автору стоит перепроверить оба числа на каноническом Linux CI парном прогоне
(`performance.yml`), но независимо от результата **cache-count уже доказан красным и машинно не
объясним** — это не «непрогнанный дорогой гейт», это прогнанный и красный.

**Почему High, а не Medium.** Задача, ценность 10/10 и P1, явно посвящена именно тому, чтобы новый
перф-контракт «краснел сам по себе, а не только на фоне предыдущего коммита» (issue, раздел «Почему это
не поймал перф-гейт»). Проверка, которую AC10 называет своим доказательством, при фактическом запуске
красная. Это не вопрос «недостаточно полно проверили», а обнаруженный красный автотест по собственному,
введённому этим же диффом контракту — ровно то, что код-ревью обязано поймать (PROCESS.md §2.7:
«ревьюер отвечает за AC… либо доказан автотестом… либо разобран по коду»). Фикс — в скоупе (тот же
`demo/benchmark_large_house.mjs`/бюджет), отдельный issue не заводится.

### M1 (Medium, в скоупе) — обещанный в самом ТЗ «targeted production-bundle smoke» не создан

ТЗ §13.2 и §14 (план реализации, п. 5) явно называют отдельный артефакт: «Targeted `demo/smoke_*.mjs` —
production-bundle render-count и interaction matrix», инструментирующий full-render count, lightweight
paints, diagnostics scans, heavy node identity, writes на PRODUCTION-бандле (не на perf-фикстуре) — и
именно это заявлено как доказательство AC5/AC6/AC7/AC8 (`smoke` в их графе доказательства).

`git diff origin/dev...HEAD --diff-filter=A` показывает: новых файлов `demo/smoke_*.mjs` нет вовсе.
Изменения в существующих смоках (`smoke_decor.mjs`, `smoke_furniture.mjs`, `smoke_decor_text.mjs`,
`smoke_resize_pointer_real_plan.mjs`, `smoke_pan_any_zoom.mjs`, `smoke_room_fit.mjs`,
`smoke_infinite_canvas.mjs`, `smoke_opening_measure.mjs`, `smoke_partition_openings.mjs`,
`smoke_drag_bounds.mjs`, `smoke_room_tooltip_toggle.mjs`, `smoke_ux_fixes.mjs`) — точечная подгонка под
новую разметку `data-hp-live-*`/тайминг RAF, ни один не считает full-render/diagnostics-scan счётчики.

Единственное место, где эти структурные гарантии вообще проверяются — `demo/benchmark_large_house.mjs
--profile=large-house-interaction-v1`, которое подключено только к job'е `performance.yml` → «Full
Performance», запускаемой (см. `demo/performance/README.md`, «CI contracts») **на промоушен в `main`,
раз в неделю и по ручному диспатчу** — не на каждый push в `dev`. Блокирующий `performance_smoke` в
`validate.yml` меряет только `large-house-glow-overlay-v1`, этого профиля не касается. При принятой в
проекте модели прямых коммитов в `dev` без PR (AGENTS.md) это означает: следующий обычный коммит,
который случайно вернёт diagnostics-scan на каждый рендер или полный render на hover, **не будет
пойман никаким гейтом до следующего еженедельного/promotion-прогона** — то есть тем самым классом
слепого пятна, ради которого заведён #451 (issue, раздел «Почему это не поймал перф-гейт»: «гейт
исправно подтверждал, что "не стало хуже", пока пользователь смотрел на 451-миллисекундные фризы»).

Фикс в скоупе: добавить обещанный `demo/smoke_*.mjs` (инструментирование `_renderBody`/
`_bindingStatus` аналогично тому, что уже сделано внутри `benchmark_large_house.mjs`, но на
production-бандле через `demo/serve.mjs`, в постоянно запускаемом наборе).

### M2 (Medium, в скоупе) — нет мутанта в `scripts/mutation-gate.mjs` для новых защитных механизмов

PROCESS.md §2.7: «Мутант в `scripts/mutation-gate.mjs` обязателен, когда защита живёт в продуктовом
коде и проверяется дорогим гейтом (смок, бэкенд, golden): там ревьюер не воспроизведёт отрицательный
прогон второй раз». `git diff origin/dev...HEAD -- scripts/mutation-gate.mjs` — пусто, ни одной новой
записи.

Часть новых защит — чистые юниты, и для них я сам прогнал мутацию и увидел красный тест (см. «Таблица
доказательств» ниже: `classifyHassRenderChange`, `RenderLifecycle.diagnostics`) — этого достаточно,
отдельный мутант не нужен. Но интеграционная проводка в `houseplan-card.ts` (переопределённый
`requestUpdate`, `_flushHa`/terminal reconciliation, RAF-coalesced camera/hover/editor paints) —
юнитами не покрыта и проверяется только дорогим Playwright-бенчмарком (тем же, что в M1/H1). Без
постоянного мутанта в следующем раунде (после того, как H1 будет исправлен и профиль перестанет
краснеть) ревьюер снова не сможет дёшево доказать «тест умеет падать» — придётся заново гонять
браузерный бенчмарк вручную, как это делал я.

### Low — известная нестабильность `smoke_smooth_zoom.mjs` под нагрузкой (не регрессия, к сведению)

При параллельном прогоне 134 смоков (4 конкурентных пакета) `demo/smoke_smooth_zoom.mjs` дал один
красный результат (`wheelRetargetsRunningTween`/`wheelHasIntermediateFrames`/`wheelStreamPersistsOnce`
= false). Проверил отдельно: последовательно (без конкуренции за CPU) — 11/11 прогонов зелёные, как на
этой ветке, так и на чистом `origin/dev`. Затем воспроизвёл красный результат **на обеих** ветках
одинаково при явной конкуренции (4 параллельных `smoke_smooth_zoom.mjs` + 3 тяжёлых смока рядом: 2-3 из
4 падали и на `dev`, и на PR). Вывод: это существующая до #451 чувствительность теста к CPU-контеншну
(reliance на реальные `requestAnimationFrame` тайминги), не регрессия этой задачи. Не блокирует, в
скоуп #451 не входит, отдельный issue не заводится (не находка, а объяснённая флакиность).

## Что проверено и корректно

- **AC1** (HA intake ≠ visual invalidation): `requestUpdate('hass', …)` в `houseplan-card.ts`
  делегирует решение `LiveRuntime.hass()` → `classifyHassRenderChange()`; при `'none'`/deferred-`'state'`
  intake (`intakeHass`) всё равно выполняется синхронно через `RenderLifecycle.observe`. Доказано
  юнитом `test/houseplan-render-lifecycle.test.mjs` («HA intake runs once even when an unrelated visual
  update is skipped») + мутацией (см. ниже).
- **AC2** (dependency classifier): `src/render-invalidation.ts`. Структурные top-level поля (`entities`,
  `devices`, `themes`, `locale.*`, неизвестный новый ключ) — fail-open на `'structural'`; только `states`
  сравнивается по dependency-scoped `entityIds`. Доказано `test/render-invalidation.test.mjs` (4/4) +
  мутацией: убрал ранний `return 'none'`→заменил на безусловный `return 'state'` в скомпилированном
  `test-build/render-invalidation.js` (не в `src/**`, генерируемый файл) — тест
  «an unrelated HA state row does not invalidate the plan frame» покраснел (`expected 'none', actual
  'state'`), затем восстановил файл, тест снова зелёный.
- **AC3** (intake переживает пропущенный рендер): dependency projection в `_captureRenderDeviceSnapshot`
  (houseplan-card.ts:4563+) собирает entity/device/area из bindings, room temp/hum source, opening
  entity refs, live-text, `sun.sun`, vacuum source — доказано чтением и подтверждено проходом смоков
  `smoke_linked_virtual_light`, `smoke_static_icon`, `smoke_cover_no_plate`,
  `smoke_cover_plate_precedence`, `smoke_entity_parent_dedup`, `smoke_yellow_principle` (все зелёные).
- **AC4** (diagnostics cache): `RenderLifecycle.diagnostics()`/`invalidate()` в
  `houseplan-render-lifecycle.ts`. Единственный вызов `houseplanDiagnostics()`-подобной логики теперь и
  в `_renderBody` (через `this._renderLife.diagnostics(...)`), и в публичном `houseplanDiagnostics()` —
  один источник (см. «Одно число — один источник» ниже). Доказано юнитом («diagnostics scan is cached
  and invalidated by tracked state presence») + мутацией: заменил guard `if (this.diagnosticsCache)` на
  `if (false && this.diagnosticsCache)` в `test-build/houseplan-render-lifecycle.js` — тест покраснел
  (`2 !== 1`, ожидался один скан вместо двух), восстановил, снова зелёный.
- **AC5/AC6/AC7** (0 full render на hover/pan/pinch/camera/editor move, 1 terminal, deferred-relevant-tick
  last-wins): структурные assert'ы внутри `demo/benchmark_large_house.mjs` (throw при нарушении)
  подтверждены самостоятельным прогоном на этом SHA — все условия выполнены (`irrelevantFullRenders:0`,
  `hoverFullRenders:0`, `panMoveFullRenders:[0,0,0,0]`/`terminalFullRenders:[1,1,1,1]`,
  `cameraMoveFullRenders:0`/`cameraTerminalFullRenders:1`, `editorMoveFullRenders:[0,0,0]`,
  `relevantDuringGestureFullRenders:0` при `relevantDuringGestureIntakes:3`, `diagnosticsScans:0`,
  `heavyNodeStable:true`, `overlayErrorPx:0.01`). Тайминги того же прогона см. H1.
- **AC8** (coalescing сохраняет конечную координату/commit/cancel): `pointer-move-queue.ts`
  (`queueMicrotask`, гарантированно опустошается до следующего браузерного события) + подключение во
  всех точках (`_pointerMove`/device, `_physicalMove`, `_rszMove`, `_bdMove`, `_opPointerMove`, `_dtMove`,
  `_decorMoveUpdate`, `_markupMove`) с явным `flush` на terminal (`up`) и `cancel` на отмене. Доказано
  юнитом `test/live-editor.test.mjs` («pointer move queue is event-turn coalesced, last-wins and
  flushable») + прогоном затронутых production-bundle смоков (`smoke_furniture`, `smoke_decor`,
  `smoke_decor_text`, `smoke_drag_bounds`, `smoke_partition_openings`, `smoke_opening_measure`,
  `smoke_resize_pointer_real_plan` — все зелёные, включая ровно те сценарии shift-snap/magnet/rotate,
  которые чувствительны к потере промежуточного состояния).
- **AC9** (pixel-equivalence): `npm run golden:verify` — 153/153 `passed`, 0 diff, включая
  `large-house-zoom-040/250-dark`, `large-house-warm-remount-dark`, junction-серию, hover-серию,
  dark/light/RU/EN варианты. Прямое доказательство отсутствия непреднамеренных визуальных изменений.
- **AC11** (implementation-loop gates): typecheck/test/build зелёные (таблица выше).
- **AC12** (schema/backend/i18n/dependencies не изменены): `git diff --name-only` не содержит
  `.py`/`i18n`/`translations`/`manifest.json`/`hacs.json` — проверено чтением. Новые кэши
  (`RenderLifecycle.diagnosticsCache`, `LiveRuntime`/`live-viewport`/`live-hover`/`live-editor` state) —
  все `WeakMap<object,…>`, ключ — сам инстанс карточки; `disconnectedCallback` вызывает
  `_liveRt?.dispose()` и `_editorRuntime?._disposeLiveEditor()` (cancel RAF, restore hidden/transparent
  DOM, `cancelHouseplanPointerMove`) — bounded per card, очищаются при disconnect, независимы между
  несколькими карточками на дашборде (WeakMap не даёт общий каталог).
- **AC13** (документация): `demo/performance/README.md` описывает новый профиль, сценарии, структурные
  assertions, абсолютные потолки, local diagnostics-команду; `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md`
  обновлены в том же коммите `c0d61ca3` (`User-Visible: yes`), формулировка «внешний вид и результат
  действий не меняются» соответствует AC9/non-scope.
- **Одно число — один источник**: `houseplanDiagnostics()` (публичный support-report) и внутренний
  render-path теперь читают один и тот же `RenderLifecycle.diagnostics()` — раньше было два независимых
  прохода по маркерам с одинаковой логикой (потенциальное расхождение при будущей правке одного из них),
  теперь физически один вызов на одну инвалидацию (доказано юнитом «scans === 1» выше). Другой видимый
  дважды параметр — zoom badge (`Math.round(zoom*100)%`) и `_zoom`/`_view`: и DOM-бейдж
  (`live-viewport.ts:paintLiveViewport`), и canonical-поле читают один и тот же `frameOf(host)` —
  `host._zoom`, без второго независимого округления.
- **Трейлеры**: все 10 коммитов несут `Issue: #451`; ровно один `User-Visible: yes`
  (`c0d61ca3`, «fix: keep large-plan interactions off the full render path») с обоими changelog в том
  же коммите; остальные `User-Visible: no` (документация/фикс-ап/ребилд бандла) — корректно.
- **Touch/pen/kiosk/fixed-floor контракт** (§9 ТЗ): не даёт отдельной ветки поведения — подтверждено
  прохождением `smoke_isometric_live_touch`, `smoke_kiosk`, `smoke_kiosk_pan_lock`, `smoke_fixed_floor`,
  `smoke_touch_tips`, `smoke_grid_scale_invariance` (все зелёные) плюс golden dark/light/RU/EN сценарии.

## Чего не проверял

- Полный `demo/smoke_*.mjs` (все ~221) — прогнал 134 (все «прямые» и «слабые» совпадения
  smoke-select.mjs), сознательно не прогонял оставшиеся ~87 без связи с диффом (полный набор —
  предрелизный гейт, PROCESS.md §8).
- Парный `performance.yml` («Full Performance», base vs candidate на двух чекаутах, реальный Chromium
  CI-раннер владельца) — недоступен в этом окружении; вместо него прогнал `--absolute-only` (см. H1,
  нашёл реальную красноту) и структурные assert'ы бенчмарка напрямую. Относительное (base-vs-candidate)
  сравнение не проверено — вероятно, тоже покраснеет из-за той же причины, что и абсолютное, но это не
  проверено напрямую.
- Backend (`python -m pytest tests_backend`) — не запускал, диф не касается `custom_components/**/*.py`
  (проверено чтением diff, не исполнением).
- `npm run invariants` — не запускал, диф не касается геометрии/`layout`/`marker.space`/`open_spans`
  (проверено чтением diff и Non-scope раздела ТЗ).
- Точная локализация причины лишних 40 записей `cleanFloor` (H1) — воспроизвёл и доказал факт, не нашёл
  точную строку кода; это оставлено автору при исправлении H1.
- Ручная проверка в реальном браузере (вне headless Playwright) и на настоящей Home Assistant — вне
  доступного окружения; полагался на golden/smoke/unit/performance гейты.

## Материал раунда

- Ветка: `issue/451-render-performance`
- SHA материала: `1850eb18b5e8f0813f9d2efb50694dc4ca1fff26`
- Диапазон: `origin/dev...HEAD` (10 коммитов, `029aba6b`..`1850eb18`)
- ТЗ: `docs/specs/451-render-performance.md`, ревью — `docs/reviews/SPEC-REVIEW-451-r2.md` (зелёное)

## Итог

**Вердикт: красный.** Одна High-находка (H1 — заявленный самим диффом перф-контракт `AC10` красный при
фактическом прогоне `compare.mjs --absolute-only` по собственному новому бюджету, доказано
детерминированным счётчиком `cache.entries.cleanFloor: 140 vs 100` плюс коррелирующими превышениями
таймингов `editorSeriesMs`/`longTask.editorSeries.*`) блокирует переход. Плюс две Medium-находки в
скоупе (M1 — не создан обещанный ТЗ `demo/smoke_*.mjs` для render-count на production-бандле, M2 — нет
мутанта в `scripts/mutation-gate.mjs` для интеграционной проводки, проверяемой только дорогим
бенчмарком). Сама архитектура решения (разделение intake/visual invalidation, dependency classifier,
diagnostics cache, RAF-coalesced live-слои камеры/hover/редакторов, pointer-move очереди) сделана
аккуратно и проверяемо: юнит-защиты действительно ловят мутацию, structural assertions бенчмарка
действительно бросают исключение при нарушении контракта, golden/smoke/typecheck/build/docs — все
зелёные. Возврат автору — на исправление конкретно H1 (и желательно M1/M2 в том же цикле, раз без
High они и так были бы Medium-в-скоупе), без расширения скоупа задачи.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/451-render-performance`, коммит `1850eb18b5e8` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `30dcff478a0287b209be4c3066972158d6e6b539`
  ```
  git log --all --format='%H %T' | grep 30dcff478a02
  ```
- ТЗ `docs/specs/451-render-performance.md`, блоб `7c323a29110974aae369077214b9e2a74d9387c1`
  ```
  git log --all --find-object=7c323a29110974aae369077214b9e2a74d9387c1 -- docs/specs/451-render-performance.md
  ```
