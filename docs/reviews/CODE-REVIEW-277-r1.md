# CODE-REVIEW-277-r1

- **Issue:** #277 — безопасный Resize без изменения топологии
- **Заход:** r1 (первый код-ревью-заход; спецификация прошла отдельные заходы
  SPEC-REVIEW-277-r1 → r2, зелёный, зафиксирован SHA не называется в issue —
  восстановлен по коммитам: `9e356504` → правки `1bbd53ee` → зелёный r2)
- **Ветка:** `issue/277-safe-resize`
- **SHA ревью:** `241821c40e9b2f43b79945af3377fc3b3f4ac084` (`origin/dev` на момент
  ревью: без новых коммитов после ветвления — полный разбор, не по дельте)
- **Диапазон:** `origin/dev...HEAD`, 11 коммитов (4 — спецификация/ревью ТЗ,
  класс C; 7 — реализация)

## Скоуп

Полный разбор (первый код-ревью-заход по этой задаче). Диапазон коммитов
реализации:

| Коммит | Тема | Класс | User-Visible |
|---|---|---|---|
| `6335b0e5` | fix: make room resize topology-safe | A | yes (оба changelog) |
| `cd0a682a` | test: align legacy resize smokes with safe mode | B | no |
| `2e22ed79` | fix: stop resize before lossy metadata rekey | A | yes (оба changelog) |
| `a5a0f6da` | docs: accept safe resize screenshots | C/D | no |
| `03b45f2e` | build: synchronize safe resize release bundle | D | no |
| `b02a3712` | test: align mixed-thickness smoke with safe resize | B | no |
| `241821c4` | test: accept beta.8 safe resize baselines | D | no (`Release:`/`Baseline-Reviewed:` присутствуют) |

Затронутые продуктовые файлы: `src/resize.ts` (+372 строки чистой геометрии),
`src/houseplan-card.ts` (контроллер, рендер, i18n-проводка), `src/styles.ts`
(удаление `.rszcorner/.rszframe/.rszknob`, добавление `.disabled`),
`src/i18n/{en,ru}.json`. Плюс тесты, смоки, mutation-gate, benchmark, golden,
9 файлов документации, оба changelog.

Все коммиты несут `Issue: #277` и корректный `User-Visible`; оба
`User-Visible: yes` коммита правят `docs/CHANGELOG.md` и `.ru.md` в том же
коммите. Коммит с `demo/golden/baselines/**` несёт `Release: v1.67.0-beta.8` и
`Baseline-Reviewed: <ссылка>` — проверено не только по формату (см. «Гейты»).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 1194/1194 passed, 0 fail |
| Build + 3 копии бандла | `npm run build && npm run bundle:sync` + `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | зелёный, байт-в-байт; демо-копия (несомитаемая, #255) синхронизирована тем же скриптом |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| Выбор смоков по дельте | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 37 «прямых совпадений» (0 «зарегистрированных связей», 0 «неопределённостей») — полный вывод приложен ниже |
| Смоки (37 прямых совпадений) | `node demo/smoke_<name>.mjs` × 37 | все 37 зелёные (список — ниже) |
| Golden | `npm run golden:verify` | 80/80 passed, включая новые `safe-resize-handles-clamp-{light,dark}` |
| Mutation gate (реестр) | `node scripts/mutation-gate.mjs --check` | все ~60 мутантов «ok» (патчи применимы), включая 5 новых `safe-resize-*` |
| Mutation gate (дорогой прогон, только 5 новых мутантов AC14) | `node scripts/mutation-gate.mjs --id=<id>` × 5 | все 5 «поймано 1 из 1» |
| Performance | `npm run benchmark:safe-resize` | `"pass": true`; pointer p95 0.0128 ms (бюджет 16 ms, ≤20% над baseline — candidate на два порядка быстрее historical baseline 3.93 ms); commit-preflight p95 0.002 ms (бюджет 75 ms) |
| Model invariants (общий) | часть `npm test` (`test/model-invariants.test.mjs`) | зелёный |
| Model invariants (конкретная конфигурация) | `node scripts/model-invariants.mjs --config <after-resize export>` — конфигурация собрана вручную через реальный pointer-жест в demo-стенде (комната + стена 20 см + hosted-незав. partition + ordinary opening), после успешного commit | «Инварианты выполнены: ссылки разрешимы, записи толщины находятся» — ключ стены корректно перекодирован на новую позицию, opening и partition не задеты |
| Backend | — | не запускался: diff не трогает `custom_components/**/*.py` |
| CI-провенанс `Baseline-Reviewed` | `gh run view 32689229827` / `--log` для job `golden` | run красный **целиком ожидаемо**: единственная причина — `missing-baseline` для двух новых сцен `safe-resize-handles-clamp-{light,dark}`; остальные 104 сцены и job `frontend` прошли на этом самом SHA. Соответствует описанию коммита `241821c4` и правилу «полный Linux-артефакт», а не «зелёный CI» |
| CI-провенанс `Reviewed artifact` (docs screenshots) | `gh run view 32689026469` | run зелёный, `workflow_dispatch`, соответствует коммиту `a5a0f6da` |

Полный вывод `smoke-select.mjs`:

```
Изменено файлов src/**: 3 · символов проекта на изменённых строках: 104
Матрица: 177 смоков · порог «широкого» символа: больше 35 смоков

Прямое совпадение (37): smoke_junction_patch_resilience, smoke_resize_audit_1550,
smoke_room_resize, smoke_glow, smoke_multiwall_junction, smoke_resize_inner_dimensions,
smoke_wall_key_roundtrip, smoke_multiwall_strip_containment, smoke_partition_openings,
smoke_zero_divider_taper, smoke_bg_color, smoke_grid_snap, smoke_merge_split,
smoke_open_passage, smoke_opening_preview, smoke_pan_any_zoom, smoke_registryless_opening,
smoke_resize_virtual_thick, smoke_resize_wall_thickness, smoke_split_corner_wall,
smoke_wall_junctions, smoke_wall_thickness_transition, smoke_card_tool_conflict,
smoke_device_preview_parity, smoke_drag_bounds, smoke_draw_wall_thickness,
smoke_help_affordance, smoke_hide_layers, smoke_infinite_canvas, smoke_opening_binding,
smoke_optimize_coordinate_canonicalization, smoke_optimize_geometry_preflight,
smoke_plan_drawing_repairs, smoke_plan_snap_overlay, smoke_render_perf,
smoke_space_tab_reorder, smoke_sun_soft.

Зарегистрированная связь: 0. НЕОПРЕДЕЛЁННОСТЬ: 0.
```

Решение по строке: прогнать все 37 — диапазон прямых совпадений умеренный, а
`src/houseplan-card.ts` правился широко (импорт-лист, `_rszApplyPreview`,
`_wallUnionGeometry` reuse), так что «слабые» смоки (`smoke_sun_soft` ←
`axisOf` — общее имя функции) тоже стоило проверить не по названию, а по
факту. Полная матрица (177) не прогонялась — она предрелизный гейт (§8);
данный диапазон полностью покрывает найденные прямые совпадения.

## Находки

### Medium (в скоупе задачи — правится в этой же issue)

**M1. Кэш допустимости (eligibility) на самом деле не memo­изирует дорогую
часть — рендер ручек Resize пересчитывает полный geometry fingerprint для
КАЖДОЙ ручки на КАЖДЫЙ рендер, а не один раз на изменение геометрии.**

`src/houseplan-card.ts:8330-8351` (`_rszResolution`):

```ts
const snap = this._rszDrag?.snap || this._rszSnapshot();
const key = `${this._space}|${this._cellCm}|${this._gridPitch}|${snap}`;
if (!this._rszEligibilityCache || this._rszEligibilityCache.key !== key) {
  this._rszEligibilityCache = { key, values: new Map() };
}
```

`_rszSnapshot()` (`:8353-8356`) вызывает `JSON.stringify(this._geometrySnapshot())`,
а `_geometrySnapshot()` (`:7078-7104`) делает `JSON.parse(JSON.stringify(...))`
над rooms/openings/walls/open_spans/room_drafts/partitions/wall_columns/decor
всего пространства. `_renderResizeLayer()` (`:8691` и далее) вызывает
`_rszResolution(r.id, i)` для КАЖДОЙ стены КАЖДОЙ комнаты на каждый вызов
`render()`, то есть указанный fingerprint пересчитывается N раз за один
рендер (N = число ручек), а не один раз. Ключ кэша обязан быть вычислен
ПЕРЕД тем, как узнать, есть ли попадание в кэш — поэтому «дорогая часть»
(fingerprint) выполняется независимо от того, попадает запрос в кэш или нет.
Это напрямую противоречит §13 ТЗ («Eligibility всех handles мемоизируется по
exact geometry fingerprint и не пересчитывает boolean geometry на каждый
render») и `docs/ARCHITECTURE.md`, который повторяет то же утверждение.

Само ТЗ (§13) отдельно называет естественный сигнал инвалидации — «Cache
ограничен активным пространством и очищается при cfg epoch/tool exit» — то
есть уже существующий дешёвый счётчик `this._cfgEpoch` (44 места инкремента,
только на реальных изменениях геометрии) годился бы как ключ кэша практически
бесплатно. Вместо этого ключ строится из полного `JSON.stringify` сцены.

**Воспроизведение** (команды выполнены мной, не автором):

Однопользовательский этаж из штатной фикстуры `demo/fixtures/large-house.mjs`
(`makeLargeHouseFixture().config.spaces[0]`: 20 комнат, 80 ручек, 20
partitions, 14 columns, 167 decor, 49 walls) — это та же «large-house» шкала,
которой пользуется собственный `benchmark:large-house` проекта, то есть не
надуманный крайний случай, а верхняя граница целевого масштаба SCOPE.md
(«house/large flat, 20–200 devices, several floors»).

```
инструмент resize, requestUpdate() без изменения геометрии (эмулирует
посторонний реактивный ререндер — тик устройства, sun-ray и т.п. — при
открытом инструменте Resize), кэш ТЁПЛЫЙ (ничего не инвалидировано):
  6 замеров: 148, 137, 134, 130, 131, 129 ms

тот же рендер инструментом 'boundary' (те же 20 комнат/20 partitions/14
columns/167 decor, БЕЗ слоя ручек Resize):
  5 замеров: 112, 103, 103, 102, 102 ms

инструмент resize, кэш ХОЛОДНЫЙ на каждом замере (эмулирует изменение
cfgEpoch на каждый тик):
  8 замеров: ~200-224 ms
```

Разница «resize минус boundary» (≈ +30-100 мс на рендер) целиком относится к
циклу `_rszResolution`/`_rszSnapshot`, и «тёплый» кэш почти не дешевле
«холодного» (130 мс против 205 мс) — то есть кэш ловит повторный вызов
`resolveSafeResize`, но не ловит повторный fingerprint, который и есть
доминирующая стоимость. Это ключевое отличие от `benchmark_safe_resize.mjs`
(AC13, зелёный): бенчмарк меряет только чистые функции `clampSafeResize`/
`applySafeResize`, минуя именно этот путь — поэтому AC13 numerically проходит,
а реальный путь рендера ручек остаётся непроверенным этим бенчмарком.

**Почему это Medium, не High.** Не искажает геометрию, не создаёт запись,
не блокирует основной safety-контракт задачи (AC1–AC12, AC14–AC17
подтверждены отдельно). Влияет на отзывчивость: при открытом инструменте
Resize на доме такого масштаба каждый посторонний реактивный тик (живое
состояние устройства, sun-ray, час/минута) стоит лишние ~30-100 мс сверх
базовой стоимости рендера — заметный, повторяющийся джанк, а не разовая
проблема. В скоупе задачи: сам кэш и его контракт производительности —
предмет #277, не соседняя подсистема.

**Как чинить (не мой мандат — только для контекста автору):** вычислять
`key`/`snap` один раз на вызов `_renderResizeLayer()` (или на `_cfgEpoch`,
как и предполагает сам текст ТЗ), а не один раз на каждую пару
`(roomId, edge)`.

### Low (снимаю с записью, не блокирует)

**L1. Мёртвый код и устаревший комментарий: `_rszSel` теперь ничего не
рендерит, хотя всё ещё выставляется кликом с комментарием про удалённую
угловую рамку.**

`src/houseplan-card.ts:7386-7389`:

```ts
if (this._tool === 'resize') {
  // a click picks the room for the scale frame; handle drags never get here
  ...
  this._rszSel = room?.id || null;
```

Угловая scale-рамка (AC11) удалена из `_renderResizeLayer()` полностью — блок
`const sel = this._rszSel ? ... ; if (sel) { ... }` вычищен вместе с
`.rszcorner/.rszframe/.rszknob`. `_rszSel` продолжает выставляться на клик по
комнате в инструменте Resize и путешествует в view-state (`rszSel` при
сохранении/восстановлении вида), но не имеет ни одного потребителя в рендере.
Комментарий буквально описывает удалённую фичу. Не влияет на поведение —
клик просто ничего не делает визуально, как и раньше при клике по
неинтерактивной точке. Снимаю с записью: чисто косметическая уборка,
безопасно оставить автору на будущее мелкое polish-изменение, блокировать
задачу из-за одной мёртвой строки состояния и комментария нецелесообразно.

## Проверка AC — таблица

| AC | Как доказано | Вердикт |
|---|---|---|
| AC1 | `test/resize.test.mjs` («diagonal and non-perpendicular…»); i18n-тест `resize-production-path.test.mjs`; смок `safe_resize.*` | доказано (тест умеет падать — проверено мутантом `safe-resize-axis-eligibility-bypassed`, 1/1) |
| AC2 | `test/resize.test.mjs` («exactly two existing vertices…», топология вручную сломана в тесте и корректно отклонена); model-invariants на реальном post-commit конфиге (см. выше) | доказано |
| AC3 | `test/resize.test.mjs` («exact shared: two rooms move…»); смок `safe_resize.commit_left/right/third_static` | доказано |
| AC4 | `test/resize.test.mjs` («partial shared and third-owner…», включая фикстуру AC17); мутант `safe-resize-third-room-cascade-enabled` 1/1 | доказано |
| AC5 | `test/resize.test.mjs` («irregular exact pair clamps at the first corner…»); смок `safe_resize.corner_clamped/corner_topology`; мутант `safe-resize-topology-signature-bypassed` 1/1 | доказано |
| AC6 | `test/resize.test.mjs` («side opening stops at the physical jamb…»); мутант `safe-resize-opening-jamb-bypassed` 1/1; golden `safe-resize-handles-clamp-{light,dark}` (просмотрено — обе сцены «passed» в `golden:verify`) | доказано |
| AC7 | `test/resize.test.mjs` («moving opening travels once; hosted moving opening is disabled»); смок `safe_resize.opening_once` | доказано |
| AC8 | смок `safe_resize.preview_moved/preview_not_persisted/commit_left/one_undo`; `test/resize-production-path.test.mjs` (lossy-rekey guard); мутант `safe-resize-commit-preflight-bypassed` 1/1 | доказано |
| AC9 | `_rszCandidateRenderable`/`validateSafeResize` разобраны чтением (проверено чтением, не исполнением — сама структура try/catch + fail-closed на исключении); смок `safe_resize.preflight_no_commit/preflight_zero_write` инжектирует отказ `_checkOptimizeGeometry` и проверяет zero-write | доказано |
| AC10 | смок `safe_resize.undo_exact`; `test/resize.test.mjs` round-trip проверки | доказано |
| AC11 | `test/resize-production-path.test.mjs` (grep-проверка отсутствия старых символов в бандле-исходнике и в стилях); ручной grep `applyRoomScale`/`clampRoomScale`/`shiftSharedSpans`/`simplifyPoly(` в `houseplan-card.ts` — отсутствуют; golden `safe-resize-handles-clamp-*` (визуально нет рамки) | доказано |
| AC12 | `test/resize-production-path.test.mjs` (aria-disabled/tabindex/_rszDisabledKey/cursor); смок `safe_resize.disabled_visible/disabled_reason/disabled_focusable/disabled_no_drag/disabled_zero_write` | доказано |
| AC13 | `npm run benchmark:safe-resize` — `"pass": true`, числа приведены выше | доказано для чистого pointer/preflight-пути geометрии; **НЕ покрывает** путь рендера ручек — см. M1 |
| AC14 | `node scripts/mutation-gate.mjs --id=<5 новых id>` — все 5 «поймано 1 из 1» (прогнано мной, не только `--check`) | доказано |
| AC15 | typecheck/unit/build — зелёные (таблица «Как проверялось»); байт-идентичность бандлов подтверждена `cmp` | доказано |
| AC16 | `docs/RESIZE.md`, `ARCHITECTURE.md`, `CANVAS.md`, `WALL-THICKNESS.md`, `TESTING.md`, `USER-GUIDE.{md,ru.md}`, оба changelog — прочитаны построчно, согласованы с реализацией и друг с другом; `check-docs` зелёный | доказано |
| AC17 | `test/fixtures/resize-safe-regression.json` + unit-тест ссылается на неё (`resize.test.mjs`); `demo/smoke_room_resize.mjs` воспроизводит ту же топологию (совпадающие координаты) реальными pointer-событиями через production-бандл и проверяет disabled/zero-write; `model-invariants` пройден на аналогичном (не буквально том же файле) post-resize экспорте | доказано с оговоркой (Low, не заводится отдельно): смок дублирует геометрию фикстуры инлайн вместо чтения `resize-safe-regression.json` напрямую — при рассинхронизации фикстуры и смока рассинхронизация не будет замечена автоматически. Не блокирует: обе стороны сейчас идентичны и это видно построчным сравнением координат, а объём — одна строка ТЗ, не критерий приёмки. |

## Что проверено и корректно

- Полный geometry pipeline (`resolveSafeResize`/`applySafeResize`/
  `validateSafeResize`/`clampSafeResize`) прочитан целиком; порядок причин
  disabled соответствует §4 ТЗ ровно (диагональ → side-angle →
  duplicate-physical-wall → partial-shared → unequal-shared →
  multiple-rooms → thickness-conflict → opening-conflict →
  invalid-geometry).
- Старые механизмы (`planEdgeDrag`/`applyEdgeDrag`/`clampEdgeDrag`/
  `applyRoomScale`/`clampRoomScale`/`shiftSharedSpans`/`simplifyPoly`)
  остаются в `src/resize.ts` только для регрессионной истории тестов
  (`test/resize.test.mjs` их использует), но не импортируются в
  `houseplan-card.ts` — подтверждено grep’ом и отдельным тестом.
  Угловая scale-рамка удалена из рендера и стилей (см. AC11).
- `_rszUp` откатывает превью и не создаёт запись/Undo при провале
  `snapshotStillCurrent`/`topologyValid`/`candidateValid` — включает защиту от
  гонки с внешним изменением конфига между `pointerdown` и `pointerup`
  (`_rszSnapshot() === g.snap`), что закрывает многоклиентский сценарий J6.
  `_rszApplyPreview` дополнительно останавливает превью до потери толщины/
  virtual-span при перекодировании (коммит `2e22ed79`, добавлен автором до
  хендоффа на ревью — не отдельная находка ревью).
  Live-исполнение подтверждено вручную: собран реальный `_serverCfg`
  (комната + стена 20 см + independent-partition + ordinary opening),
  выполнен настоящий pointer-жест через demo-стенд, коммит создал ровно одну
  запись Undo (`_geometryHistory.size === 1`), стена корректно перекодирована
  на новую позицию с сохранённым `cm`, partition не тронута — и это же
  проверено `model-invariants.mjs` (см. таблицу гейтов).
- «Одно число — один источник»: `_rszEdgeLabels()` берёт длины/площадь из
  того же кандидата `res.polys`, что коммитится, и через канонические
  форматтеры (`formatLength`/`formatArea`/`innerContourForRoom`/`areaM2`,
  та же конвенция внутренних граней, что и у карточки комнаты, #233) — не
  через отдельный приближённый расчёт для превью.
  `test/single-source-numbers.test.mjs` входит в зелёный `npm test`.
- i18n: все 9 disabled-причин плюс `resize.commit_failed` присутствуют и
  непусты в en/ru (проверено тестом и вручную); тексты причин не содержат
  room id/координат/исключений (§4 ТЗ) — прочитаны все 9×2 строки.
  Формулировка `title.markup_resize`/`markup.hint_resize` использует
  «ручку» по-русски (не непереведённый «handle»), согласованно с
  `USER-GUIDE.ru.md` — учтено замечание L1 из SPEC-REVIEW-277-r2 (это
  замечание было по тексту спеки, не по реализации, но реализация ему не
  противоречит).
- Риск-таблица §12.1 спеки подтверждена по факту: #276 действительно
  `S8-merged` (влился раньше #277, как и предписано порядком merge), #264
  действительно остаётся `S1-new` (не начат параллельно, как и предписывал
  риск-митигейт), #278 — `S5-ready`, не начат. Порядок #276→#277→#278
  соблюдён.
- `Baseline-Reviewed`/`Reviewed artifact` в коммитах `241821c4`/`a5a0f6da`
  проверены по факту через `gh run view --log`, не только по формату строки:
  оба указывают на реальные прогоны на точном SHA/ветке этой задачи;
  «красный» golden-run `32689229827` красен исключительно из-за ожидаемого
  `missing-baseline` двух новых сцен — не сокрытая находка.
- Производительность (кроме M1): бенчмарк численно на два порядка лучше
  бюджета, budgets/cache-bound соблюдены, кэш `clampSafeResize` ограничен
  (`WeakMap`, 4096 записей на план, проверено тестом
  `safeResizeCachedDeltaCount`).
- Документация (`RESIZE.md`, `ARCHITECTURE.md`, `CANVAS.md`,
  `WALL-THICKNESS.md`, `TESTING.md`, `USER-GUIDE.{md,ru}`, `DEVELOPMENT.md`,
  `STATUS.md`) прочитана целиком; описывает именно то поведение, которое
  реализовано — включая честные технические формулировки (rekey/preflight/
  clamp), а не только пользовательский пересказ.

## Чего не проверял

- Полный набор `demo/smoke_*.mjs` (177 файлов) — предрелизный гейт (§8),
  запущены только 37 «прямых совпадений» дельты.
- `python -m pytest tests_backend` — не запускался: diff не касается
  `custom_components/**/*.py`.
- Полный `npm run golden:capture`/визуальный человеческий пересмотр всех 80
  сцен построчно — доверился «passed/failed» отчёту `golden:verify` и
  предметно посмотрел только на факт прохождения двух новых
  `safe-resize-handles-clamp-*`; попиксельное сравнение не делал (это работа
  `golden:verify`, а не ревьюера).
- WSL/полный HA-харнесс — не касается этой задачи (нет правок Python).
- Реальный приватный экспорт пользователя, вызвавший #277 — не публикуется
  по условиям issue; проверена только анонимизированная `resize-safe-
  regression.json` и её топология.
- Мутанты вне пятёрки `safe-resize-*` (остальные ~55 в реестре) — не
  перепрогонялись полностью (дорогой прогон), только `--check`
  (применимость патчей); они не относятся к дельте этой задачи.

## Унаследовано из ревью ТЗ

Код-ревью не наследует находки предыдущего ревью ТЗ автоматически (разные
стадии, разные бюджеты циклов, §10.4 PROCESS.md: «цикл считается по этапу»).
Тем не менее использовано как контекст: `SPEC-REVIEW-277-r2.md` (зелёный,
SHA `4ed94a52`) — все три M1-M3 находки r1 спеки закрыты (риски, «что человек
увидит», AC17-фикстура), обе Low-находки r2 (нейминг «handle»/«ручка»,
непоказанный SHA r1) сняты автором ревью ТЗ с записью, без обязательных
правок. Проверено, что реализация не противоречит финальному тексту ТЗ
(`docs/specs/277-safe-resize.md`, HEAD) — сверено построчно по всем 18
разделам.

## Вердикт

Жёлтый: одна Medium-находка в скоупе задачи (M1), 0 High. AC1–AC12 и
AC14–AC17 доказаны автотестами, которые умеют падать (мутанты 1/1) или живым
воспроизведением через production-бандл; AC13 доказан для чистой геометрии,
но не для пути рендера ручек, где M1 и обнаружена. L1 снимается с записью
(мёртвый код, не блокирует).
