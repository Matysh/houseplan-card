# CODE-REVIEW-642-r1

Материал: `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD` на
`bcb5af80baef9d9d0c09693e969429e8ad98621b` (дерево `67ec4b0e2704bc6355c54dee105d7dd1c0f248ec`,
идентично `e37e33b9`, на котором писался хендофф — вершина была только
переподписана после зеркалирования `main`, дерево не менялось).
Один коммит поверх `origin/dev` `c8f9b5d3`. `Issue: #642`, `User-Visible: no`.

## Скоуп

Первый вынос подсистемы из монолита по образцу `live-*`/`RadarSetupController`
(#624 — измерительная база). Диалог «Оптимизировать планы» (373 строки в
`HouseplanEditorRuntime`) переезжает в новый модуль `src/optimize-plans-dialog.ts`
за узкий порт `OptimizePlansDialogPort` (18 членов). Пять делегатов-заглушек и
две стрелки-заглушки в карточке удалены, вызовы идут напрямую к
`this._editorRuntime.optimizePlans`. Харнесс (13 смоков, `wall-draw-click-harness`,
`golden/harness.mjs`) переведён на новый адрес. 11 текстовых утверждений
`i18n.test.mjs` о разметке/тосте диалога и 8 мутантов реестра переведены на
исполнение через новый юнит `test/optimize-plans-dialog.test.mjs` (test-build).
Продукт не меняется: контракт заявлен байт-в-байт, персоны из `docs/SCOPE.md`
изменения не видят — работа обслуживает J6 («keep the plan true as the home
evolves», через связность и тестируемость, а не пользовательскую функцию).

Ревью ТЗ (r1) уже прошло зелёным с одной снятой Low-находкой (число мест
чтения `_alignDialog`), скоуп не менялся с тех пор — файл ТЗ не редактировался
после хендоффа.

## Как проверялось

Дешёвые гейты подтверждены зелёным Validate на этом точном SHA (run
`35957718518`, `workflow_dispatch`, `S7-code-review`): фронтенд (типы, юниты,
бандл-синхрон) и все 6 шардов «Мутанты по диффу» — success. Я перепрогнал их
локально самостоятельно (дёшево, подтверждаю числа, а не просто доверяю
галочке), плюс всё, что этот прогон **не** покрывает (Validate без
`full=true` не запускает смоки/golden):

| Гейт | Команда | Результат |
|---|---|---|
| Типы | `npx tsc --noEmit` | зелёный |
| Юниты | `npm test` | 2940 pass / 0 fail / 1 skip (2941 всего) |
| Сборка + синхрон | `npm run bundle:sync` | собрано; `git status` после — чисто, три копии бандла совпадают побайтово |
| Бюджет бандла | `npm run bundle:budget` | зелёный: lazy editor 244976 Б ≤ потолка 246000±2000; предупреждение о низком запасе initial View — доконтекстный долг #367/#474, не от этой задачи |
| Связность монолита (AC1) | `node scripts/unused-locals-gate.mjs` | `delegates=154 portMembers=348 hostRefs=4869 portPrivates=94 harnessPrivates=101 bundleBytes=2499182`, «все числа равны базе» — точное совпадение с заявленным в хендоффе |
| `no-new-any` | `node scripts/no-new-any.mjs` | «Новых any нет» (523 добавленных строки в 4 файлах, 143 — дословный перенос) |
| `check-docs` | `node scripts/check-docs.mjs --screenshots=warn` | зелёный (7 файлов, 12 внешних ссылок); строгий режим даёт ERROR по устаревшим скриншотам — это тот же прогон, что видел конвейер в предполёте (`rc 0` на `warn`), не регрессия этой задачи и не блокер вне release-кандидата |
| Смоки, названные в AC | `node demo/smoke_<name>.mjs` × 13 (см. ниже) | все 13 зелёные, все под-проверки `true` |
| Golden (4 кадра диалога) | `npm run golden:verify` (полный прогон демо-набора, Linux-песочница) | все сценарии `passed`, включая `optimize-preflight-dialog-{dark-en,light-ru}` и `optimize-orphan-references-{dark-en,light-ru}` — контракт «байт-в-байт» подтверждён локально в дополнение к обязательному предрелизному Linux CI `full=true` |
| Мутанты AC2/AC4 (защитные) | `node scripts/mutation-gate.mjs --id=<id>` × 9 (см. таблицу AC ниже) | у каждого — «поймано 1 из 1» |
| `space-copy-runtime.test.mjs` (заявлено «без изменений») | `node --test test/space-copy-runtime.test.mjs` | без диффа, 8/8 pass |
| `monolith-text-anchors.test.mjs` (AC5, «список не растёт») | `node --test test/monolith-text-anchors.test.mjs` | без диффа, 2/2 pass |

13 смоков из «Плана автотестов» (прогнаны по одному, все под-проверки `true`):
`smoke_optimize_geometry_preflight`, `smoke_preflight_diagnostics`,
`smoke_near_axis_optimize`, `smoke_orphan_space_references`,
`smoke_optimize_coordinate_canonicalization`, `smoke_optimize_coincident_partition`,
`smoke_optimize_micro_interval`, `smoke_grid_snap`, `smoke_resize_outer_reconciliation`,
`smoke_unified_wall_tool`, `smoke_warm_dialogs`, `smoke_writer_fixed_point`,
`smoke_wall_draw_click`.

`node scripts/smoke-select.mjs --base origin/dev --head HEAD` подтверждает
покрытие: 36 прямых совпадений, из них 12 — те самые смоки диалога (плюс
`smoke_edit_walk` — прямое совпадение по символу `optimizePlans`, не в
исходном списке АС, но не защитный путь: смок не задевает диалог напрямую,
решение — не гонять отдельно, риск низкий). Остальные прямые совпадения
(`_reloadConfigOnly`, `_showToast`, `_haIntegrationVersion` и т. п.) —
следствие того, что диапазон диффа включает импорт/дельту всего файла
`houseplan-editor-runtime.ts`; они не относятся к перенесённому коду
диалога, и я не гонял их все — 17 «слабых» совпадений (общий `_editorRuntime`)
и 1 «зарегистрированная связь» (`smoke_wall_union_isolation` через
`spacePhysicalGeometryFingerprint`, используется и в geometry preflight
блоке, но не в этой задаче тронут) также не прогонялись: это разумное
сужение выборки, а не защитный путь этой задачи.

### AC — чем доказан — независимо перепроверено

| AC | Заявлено | Перепроверено |
|---|---|---|
| AC1 числа падают, бандл не растёт | таблица чисел | `unused-locals-gate.mjs` — точное совпадение всех 6 чисел |
| AC2 порт узкий (≤20), модуль не знает host | юнит + мутант `optimize-dialog-imports-host-port` | юнит зелёный (`AC2: the dialog port is narrow…`); мутант — **лично прогнан** `node scripts/mutation-gate.mjs --id=optimize-dialog-imports-host-port` → «поймано 1 из 1» |
| AC3 разметка исполнением (11 утверждений) | 5 юнитов render + мутанты `preflight-reason-lost-in-dialog`, `optimize-preflight-renders-apply-on-failure` | юниты зелёные; оба мутанта лично прогнаны → «поймано 1 из 1» каждый |
| AC4 защиты сохранены (8 мутантов) | юниты + 8 переведённых мутантов | все 8 (`optimize-preflight-bypassed`, `optimize-preflight-renders-apply-on-failure`, `near-axis-optimize-confirmation-bypassed`, `preflight-reason-lost-in-dialog`, `preflight-fingerprint-from-saved-config`, `preflight-fallback-survives-dialog-close`, `preflight-diagnostics-without-reason`, `preflight-dev-log-disabled`) лично прогнаны через `mutation-gate.mjs` → «поймано 1 из 1» у каждого |
| AC5 текстовые якоря не растут | `monolith-text-anchors.test.mjs` зелёный | перепрогнан, без диффа, 2/2 pass |
| AC6 продукт не изменился | tsc/test/build/bundle-sync/budget/no-new-any + смоки + golden без пересъёмки | все перепрогнаны выше; golden — все сценарии `passed` в этой песочнице (плюс обязательный CI `full=true` на кандидата остаётся предрелизным гейтом — не подменяю) |

## Разобрано чтением

- **Эквивалентность WeakMap-фолбэка.** Автор доказывает разбором путей
  (в теле issue), что фолбэк никогда не переживает смену объекта диалога.
  Проверил отдельно: единственное место, где `run()` создаёт новый объект
  диалога через `{ ...d, preflight }` (перепроверка протухшего отпечатка) или
  `{ ...d, busy: true }`, достижимо только когда исходный `d.preflight.ok ===
  true` — а фолбэк создаётся только при красном preflight в `copyDiagnostics()`.
  Значит на момент этих спредов фолбэка для текущего `d` быть не может, и
  потеря идентичности объекта тут не теряет ничего, чего не терял бы явный
  сброс в прежнем коде на карточке. Проверено чтением, не исполнением —
  подтверждено косвенно мутантом `preflight-fallback-survives-dialog-close`
  (лично прогнан, поймано) и юнитом «belongs to one dialog showing».
- **Рендер-ветка карточки.** `${this._alignDialog ? this._editorRuntime ? X : nothing
  : nothing}` → `${this._alignDialog && this._editorRuntime ? X : nothing}` —
  логически эквивалентно (рендерит только когда оба truthy), не разбор
  добавляет риска. Проверено чтением.
- **Порт `checkGeometry`** идёт через `host._checkOptimizeGeometry` (делегат
  остался на карточке), а не напрямую в `_checkOptimizeGeometryImpl` —
  как и было явно принято предположительно в ТЗ, ради `space-copy-runtime.ts`,
  который этот член порта тоже использует. Подтверждено — обе точки
  (`houseplan-card.ts:10184`, `houseplan-editor-runtime.ts:776,852`) на месте.
- Никаких оставшихся ссылок на удалённые имена (`_reportPreflightFailure`,
  `_copyPreflightDiagnostics`, `_previewAlignDialog`, `_openAlignDialog`,
  `_toggleOptimizeLivePositions`, `_runAlignToGrid`, `_renderAlignDialog`,
  `_preflightClipboardFallback`, `_reportedPreflightFingerprint`,
  `_preflightVersionsDiffer`) — grep по трём затронутым файлам чист.
- Диффы всех 15 харнесс-файлов (13 смоков + `wall-draw-click-harness.mjs` +
  `golden/harness.mjs`) построчно сверены: правило ревью из ТЗ («в diff
  смоков допустима только замена адреса вызова, условия `checkAll`/`result.*`
  не трогаются») выполнено без исключений.
- Трейлеры: `Issue: #642`, `User-Visible: no` — корректно, changelog не
  тронут, и это ожидаемо для чисто внутреннего рефакторинга.
- Одно число, один источник: числа связности живут только в
  `scripts/monolith-baseline.json` (единственный источник, гейт читает
  оттуда); `LAZY_EDITOR_GZIP_CEILING` в `bundle-budget.mjs` — отдельная
  метрика (gzip-потолок ленивого чанка, не то же число, что сырые байты
  монолита), задвоения нет. Пользовательских чисел изменение не показывает
  (`User-Visible: no`).

## Что проверено и корректно

- Полный `src/optimize-plans-dialog.ts` прочитан целиком: методы, порт,
  типы, WeakMap-фолбэк, дедуп dev-лога — соответствуют описанию в ТЗ и
  хендоффе один в один.
- Диффы `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`,
  `src/editors/general-settings-dialog.ts` прочитаны целиком.
- `scripts/mutation-registry.mjs`: все 8 перенесённых записей и новая
  запись `optimize-dialog-imports-host-port` — гварды и патчи соответствуют
  новому расположению кода.
- `test/optimize-plans-dialog.test.mjs` (21 тест) прочитан целиком:
  фейковый порт бьётся 1-в-1 с интерфейсом (AC2 юнит), фикстуры покрывают
  все пять состояний рендера, названные в АС3, и защитные пути АС4.

## Чего не проверял

- Полный `npm run golden:capture`/пересъёмку — не требовалась и запрещена
  контрактом «байт-в-байт»; `golden:verify` (совет, а не приёмка) прогнан
  вместо неё и прошёл.
- Полный `python -m pytest tests_backend -q` — диф не касается
  `custom_components/**/*.py`.
- `npm run invariants` — диф не меняет геометрию, только адресацию/связность.
- Performance-профиль — не назван в AC.
- Широкий и «слабый» хвосты `smoke-select.mjs` (17+1+часть 36 прямых
  совпадений, не относящихся к диалогу) — сочтены не задевающими
  перенесённый код; решение обосновано выше.
- Полный предрелизный набор (смоки всех 263 сценариев, `performance_smoke`,
  HA-бэкенд) — по правилу «полные наборы — предрелизный гейт», не гейт
  ревью.

## Вердикт

High: 0. Medium: 0 (ни в скоупе, ни вне его). Low: 0 новых (Low из ревью ТЗ
уже снят на этапе spec, к коду не относится).

Зелёный. AC1–AC6 доказаны исполнением и перепроверены мной лично, включая
все защитные мутанты (не просто «verified» автора — каждый мутант
перезапущен и подтверждён «поймано 1 из 1»). Харнесс не ослаблен. Продукт
байт-в-байт не изменился (13 смоков + 4 golden-кадра зелёные). Числа
связности снижены по всем четырём метрикам АС1, бандл не вырос (сырые байты
даже упали).

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/642-optimize-plans-dialog`, коммит `bcb5af80baef` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `67ec4b0e2704bc6355c54dee105d7dd1c0f248ec`
  ```
  git log --all --format='%H %T' | grep 67ec4b0e2704
  ```
- Тело issue: `11d5073fbd1128d0f49f8b082936f26d677bd425b78e516d070b9a8d992d8651`
- Вердикт конвейера: `green` · High 0
