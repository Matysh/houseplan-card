# CODE-REVIEW-173-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/173
- **Диапазон:** `origin/dev..HEAD` (`d096a02` ТЗ, `4f67bac` ревью ТЗ, `f931159`
  `feat: unify Plan wall drawing` — единственный коммит класса A/B)
- **Роль:** ревьюер кода (не автор), этап `S7-code-review`, сессия без
  контекста реализации
- **Цикл:** r1/4
- **ТЗ:** `docs/specs/173-unified-wall-tool.md`, ревью ТЗ —
  `docs/reviews/SPEC-REVIEW-173-r1.md` (зелёный, r1/4, High:0 Medium:0, три Low)

## Скоуп ревью

Основной диф (`f931159`, 28 файлов, +3304/-1926):

- `src/wall-face-graph.ts` — новый чистый модуль planar-graph (atomization,
  half-edge face traversal, before/after delta);
- `src/houseplan-card.ts` — интеграция: единый tool «Стены», finish открытой
  цепочки, `_wallFaceBatch` (очередь faces), atomic batch commit, provenance
  толщины, compatibility со старым `partition` warm-tool;
- `test/wall-face-graph.test.mjs` — unit на чистый модуль;
- `demo/smoke_unified_wall_tool.mjs` (новый), `demo/smoke_room_autoclose.mjs`,
  `demo/smoke_draw_wall_thickness.mjs` — целевые/регрессионные smoke;
- `demo/benchmark_large_house.mjs`, `demo/performance/*` — accepted-click
  измерение и bounded-cache бюджет для `large-house-plan-snap-v1`;
- i18n `en.json`/`ru.json`, `docs/{ARCHITECTURE,CANVAS,WALL-THICKNESS,UX-MODES,
  USER-GUIDE.ru,USER-GUIDE,TESTING,TOUCH-SUPPORT,STATUS}.md`,
  `docs/CHANGELOG{.ru,}.md`;
- `dist/houseplan-card.js`, две другие копии бандла (класс D).

Не в скоупе изменений (проверено по `git diff --stat`, класс не задет):
`custom_components/houseplan/**/*.py`, backend schema, `demo/golden/**`.

## Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | pass, без ошибок |
| unit | `npm test` | **843/843 pass** (`npm run inventory`: Node unit 843) |
| build + sync бандла | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | pass, три копии побайтно идентичны |
| целевой smoke (AC1–AC13) | `node demo/smoke_unified_wall_tool.mjs` | **19/19 pass** |
| регрессия #138/AC7 | `node demo/smoke_room_autoclose.mjs` | 9/9 pass, включая `xIntersectionOffersFacesWithoutPartialRooms`, `openingCutPreventsAutoClose` |
| регрессия толщины (AC1/AC12) | `node demo/smoke_draw_wall_thickness.mjs` | 11/11 pass, `drawButtonNamedWalls: true` |
| touch safety floor (AC3/AC16) | `node demo/smoke_editor_gestures.mjs` | 5/5 pass — pinch/pan не рисуют, tap рисует |
| overlap/island примитив (косвенно к AC8) | `node demo/smoke_island_rooms.mjs` | 7/7 pass — но см. Medium-2, этот smoke не тронут #173 и не проходит через новую интеграцию |
| performance (AC15) | `npm run benchmark:large-house-plan-snap --profile=large-house-plan-snap-v1` | pass, без брошенных `structural contract failed`/`accepted-click contract failed`; `wallFaceAcceptedClickMs` ≈ 2.4–4.1 мс (порог в самом бенчмарке — 1000 мс); `wallFaceGraph` cache entries = 2 (бюджет: max 4, growth 0) |
| process-gate (локально) | `node scripts/process-gate.mjs` | «гейт пройден, предупреждений 0» (диапазон `origin/dev..HEAD`, 3 коммита) |
| мутационная проверка «тест умеет падать» | вручную: 1) снял фильтр `sourceKeys.includes(addedSourceKey)` в `findNewWallFacesInGraphs` — ни один тест не покраснел (см. «Что проверено», пункт про математическую избыточность); 2) снял `consumed.has(atom.key)` в `_applyWallFaceBatch` — **2/19** проверок `smoke_unified_wall_tool` покраснели (`acceptCreatesRoomAtomically`, `mixedQueueAppliesOnce`); оба раза откат, бандл пересобран и сверен | подтверждает дисциплину §18 для проверенных тестов |

**Не прогонялось и почему:**

- `npm run golden:verify` — diff не содержит изменений `demo/golden/**`,
  никакой baseline не принимался; по процессу (§8/§11.4) golden — предрелизный
  гейт, а не гейт код-ревью. AC12 (визуальная неизменность Plan/View/Iso)
  проверено чтением кода (см. ниже), не исполнением golden.
- `python -m pytest tests_backend -q` — ни один файл
  `custom_components/houseplan/**/*.py` не тронут (подтверждено `git diff
  --stat`), AC14 не требует прогона backend.
- Полный набор из 138 browser-smoke — диспропорционально задаче: тронута
  ровно одна поверхность (Plan editor, единый инструмент стен), прогнаны все
  smoke, прямо названные в AC/§15.2 плюс два соседних (толщина, gestures,
  island-overlap) по diff-риску. Остальные 132 не имеют пересечения с
  изменённым кодом.
- `npm run benchmark:compare` против baseline SHA — нет сохранённого отчёта
  предыдущего SHA в этой сессии; сырые цифры бенчмарка (см. выше) сверены с
  `demo/performance/budgets-large-house-plan-snap.json` вручную — ни один
  существующий бюджет (`cacheEntries`, `cacheGrowth`, timings) не ослаблен,
  только добавлены новые ключи `wallFaceGraph: 4 / growth 0`.

## Проверка AC1–AC17

| AC | Вердикт | Как доказано |
|---|---|---|
| AC1 | ✅ | unit (`legacy Partition token becomes Walls…`) + smoke (`oneWallsButton`, `partitionButtonRemoved`, `splitRemains`). Golden не прогонялся — предрелизный гейт |
| AC2 | ✅ | код-чтение `_persistActiveDraftSegment`/`_markupClick` (первая точка не пишет config) + smoke (`openChainIsCrashSafeDraft`, `toolChangeFinishesPartitions`, `finishedChainDoesNotResume`) |
| AC3 | ✅ | код-чтение `_onKey`/`_finishWallChain`/`_cancelPath` (pan/pinch/pointercancel не вызывают finish — подтверждено отсутствием изменений в их обработчиках) + smoke (`escapeUndoContractStillRemovesLastSegment`, `ctrlZInQueueRemovesTerminalPoint`, `cancelKeepsWholeTerminalDraft`) + `smoke_editor_gestures` (pinch/pan не рисуют). Reload/remount — только чтением, отдельного smoke на это нет |
| AC4 | ✅ | unit `wall-face-graph.test.mjs` (endpoint/T/X/collinear, near-miss, malformed, permutation invariance, 2000-сегментный sparse plan) |
| AC5 | ✅ | unit + прочитан алгоритм: canonical half-edge/DCEL walk с `identityCycle`, area-фильтром > 0 корректно исключает compound/exterior циклы структурно, не эвристически |
| AC6 | ✅ | unit (`delta only returns faces introduced by…`) + smoke (`closedFaceOpensDialog`, `terminalSegmentPersistedBeforeDecision`) + `smoke_room_autoclose` |
| AC7 | ✅ | smoke (`multiFaceTClosureOrdered`, T/X-сценарии `smoke_unified_wall_tool` и `smoke_room_autoclose`); gap через opening — `openingCutPreventsAutoClose: true` |
| AC8 | ⚠️ проверено чтением, не исполнением | `_overlapRoom`/`roomsOverlap` не изменены этим issue; wiring в `_offerWallFaces`/`_applyWallFaceBatch` прочитан и выглядит корректным (двойная проверка: на предложении face и повторно при commit). **Но** ни unit (в `wall-face-graph.test.mjs`, где такой тест структурно невозможен), ни smoke не проверяют duplicate/partial-overlap/nesting именно через новую интеграцию — см. Medium-2, заведён #177 |
| AC9 | ✅ | smoke (`cleanSplitUsesOneCandidate`, `cleanSplitRetainsParentMetadata`, `cleanSplitConsumesDivider`); `splitRoomPath`/`roomsOverlap` не изменены, регрессия Split подтверждена тем, что связанные unit-тесты (не тронуты) в общем прогоне 843/843 зелёные |
| AC10 | ✅ | smoke (`multiFaceTClosureOrdered` — area order; `firstQueueDecisionIsBuffered`; `mixedQueueAppliesOnce` — одна транзакция); Cancel/error — `cancelKeepsWholeTerminalDraft` |
| AC11 | ✅ | smoke + мутационная проверка (снятие `consumed.has(atom.key)` ломает `acceptCreatesRoomAtomically`/`mixedQueueAppliesOnce`) |
| AC12 | ⚠️ проверено чтением, не исполнением | `_applyWallFaceBatch` переиспользует немодифицированные `materializeWallIntervals`, `applyWallThicknessToNewRoom`, `wallIntervals`, `setWallThickness`, `_normalizeWalls` — те же хелперы, что и старый `_commitRoom`/Split; второй renderer не введён. Golden (визуальная неизменность Plan/View/Iso) не прогонялся — предрелизный гейт |
| AC13 | ✅ | код-чтение (`MAX_PARTITIONS`/`MAX_ROOMS` проверяются до mutation в `_finishWallChain` и `_applyWallFaceBatch`) + `history.wall_chain_finish`/`history.wall_face_batch` как именованные команды. Save-conflict path не эмулировался отдельно — проверено чтением, что batch не трогает существующий reload/conflict механизм |
| AC14 | ✅ | `git diff --stat` подтверждает: ни один файл `custom_components/houseplan/**/*.py` не тронут; новых persisted полей нет (модель диффа `src/houseplan-card.ts` не добавляет новых ключей конфига, только новые runtime-поля класса) |
| AC15 | ✅ | `npm run benchmark:large-house-plan-snap` выполнен: budgets не ослаблены, accepted-click ~2.4–4.1 мс, cache bounded (2 из максимум 4), traversal не запускается на pointermove (assert `wallFaceCacheStableOnPointer` в самом бенчмарке) |
| AC16 | ✅ | `smoke_editor_gestures` (pinch/pan не рисуют) + код-чтение: в диффе нет ни одного изменения в обработчиках `pointercancel`/pinch/pan — новые finish-точки триггерятся только явной сменой tool/mode/space, что подтверждено grep по всему диффу (0 совпадений на `pointercancel|pinch|suppress`) |
| AC17 | ✅ | typecheck/unit/build зелёные, три копии бандла идентичны (см. таблицу гейтов), RU/EN i18n и все перечисленные в §17 ТЗ документы обновлены тем же коммитом `f931159`; `User-Visible: yes`, оба changelog правлены |

## Находки

Находок уровня **High** нет.

### Medium-1 — мёртвый код старого инструмента `partition` не удалён

**Файлы:** `src/houseplan-card.ts:502,533,2187,2216,2269,5216,5283,5304,5341,6178,
6415,6643-6644,6943,9221,9259-9260,9278,11388,16587,17243,17358,17360,17410`;
`src/i18n/en.json`/`ru.json` (`title.markup_partition`, `markup.hint_partition`)

Кнопка `Partition` убрана из toolbar (AC1 подтверждён), но сам инструмент
внутри модели — нет. `MarkupTool` по-прежнему содержит значение `'partition'`,
`MARKUP_TOOLS` его тоже содержит, приватный метод `_partitionClick(...)`
полностью реализует старую логику «два клика → одна перегородка», и порядка
15 условных веток (`this._tool === 'draw' || this._tool === 'partition'`) по
всему файлу продолжают его учитывать — в лимитах, snap, hints, Undo/Escape,
рендере превью.

**Воспроизведение недостижимости:** единственное место, присваивающее
`this._tool` из внешнего/сохранённого значения —
`this._tool = normalizeMarkupTool(vp.tool)` (warm viewport). Внутри
`normalizeMarkupTool` любое значение сначала проходит через
`normalizeUnifiedWallTool(value)`, которое безусловно маппит
`'partition' → 'draw'` **до** проверки `MARKUP_TOOLS.has(...)`. Ни один
обработчик клика тулбара не вызывает `_activateMarkupTool('partition')`
(`grep -n "_activateMarkupTool("` — 10 вызовов, ни одного с `'partition'`).
Значит, `this._tool === 'partition'` не может стать истинным при обычном
пользовательском взаимодействии — код действительно недостижим, а не просто
редко используем.

Функционального дефекта это не создаёт (проверено чтением и грепом
исчерпывающе), но:
1. противоречит собственной идее #173 — «единый инструмент» — на уровне
   внутренней модели, а не только UI;
2. `title.markup_partition`/`markup.hint_partition` стали осиротевшими i18n
   ключами (использовались только удалённой кнопкой);
3. риск: будущий контрибьютор может по аналогии вернуть кнопку/ветку,
   реанимировав нетестируемое, не соответствующее новому crash-safe/finish/
   limit контракту поведение.

**Решение ревьюера:** Medium, не блокирует — заведён
[#176](https://github.com/Matysh/houseplan-card/issues/176)
(`tech-debt`, `P3`, `S1-new`).

### Medium-2 — AC8 не имеет unit/smoke-доказательства именно для новой интеграции

**Файлы:** `test/wall-face-graph.test.mjs` (нет теста overlap/duplicate/
nesting), `demo/smoke_unified_wall_tool.mjs`, `demo/smoke_room_autoclose.mjs`
(ни один не проверяет exact-duplicate/partial-overlap отказ или
nested-room через `_offerWallFaces`/`_applyWallFaceBatch`)

ТЗ §15.1 п.6 относил проверку «exact duplicate, partial overlap, inner/outer
nesting» к unit-суите `wall-face-graph.test.mjs`. Структурно это невозможно:
overlap-семантика (`_overlapRoom`, `roomsOverlap`) живёт в
`src/houseplan-card.ts` и не тронута этим issue, а `wall-face-graph.ts` —
чистый модуль без знания о комнатах. Ни там, ни в добавленном/изменённом
smoke нет сценария, который замыкает новую площадь поверх существующей
комнаты (duplicate), частично поверх неё (partial) или полностью внутри неё
(nesting) через новый unified-инструмент. Существующий
`demo/smoke_island_rooms.mjs` (не тронут #173) проверяет тот же примитив
`_overlapRoom` напрямую и через легаси `_commitRoom()`, минуя
`_markupClick`/`_offerWallFaces` — то есть не покрывает именно новую
интеграцию.

Код-чтение подтверждает, что wiring корректен: `_offerWallFaces` фильтрует
`eligible` через `!this._overlapRoom(face.ring)` при предложении, а
`_applyWallFaceBatch` независимо повторяет проверку через `roomsOverlap`
против `existingRooms` перед commit (defense-in-depth по §10.3 ТЗ) — но
заявленный в AC8 способ доказательства (`unit + smoke`) для этой конкретной
поверхности фактически не выполнен.

**Решение ревьюера:** Medium, не блокирует — заведён
[#177](https://github.com/Matysh/houseplan-card/issues/177)
(`tests`, `tech-debt`, `P3`, `S1-new`).

### Low-1 — `_activateMarkupTool` использует if/else без скобок на одной значимой ветке

**Файл:** `src/houseplan-card.ts:6057-6060`

```ts
if (this._tool === 'draw' && !this._finishWallChain()) return;
else this._cancelPath();
this._tool = tool;
```

Работает корректно (проверено чтением и трассировкой всех вызовов
`_activateMarkupTool`): при активном tool `draw` и успешном
`_finishWallChain()` код всё равно доходит до `_cancelPath()`, что и нужно
для сброса `_pendingSplit`/`_splitSel`/т.п. при смене инструмента. Но форма
`if (...) return; else ...;` без фигурных скобок на пустой видимой границе
читается медленнее, чем заслуживает; в проекте, разделяющем ревью на «что
проверено чтением», лишняя секунда на разбор управляющей структуры — не
абстрактная придирка.

**Решение ревьюера:** Low, не блокирует. Можно поправить форматированием при
следующей правке этого метода либо оставить как есть.

### Low-2 — accepted-click измерение не оформлено как отдельный отслеживаемый бюджет

**Файл:** `demo/performance/budgets-large-house-plan-snap.json`,
`demo/benchmark_large_house.mjs`

`wallFaceAcceptedClickMs` проверяется инлайновым порогом прямо в скрипте
бенчмарка (`> 1000` → throw), а не как отслеживаемая метрика в
`timings` схемы бюджета (в отличие от `planSnapPointerMs`,
`spaceSwitchMs` и т.д., которые сравниваются с историческим SHA через
`benchmark:compare`). Фактический результат (2.4–4.1 мс) настолько далёк
от порога, что регрессии первого порядка это не пропустит, но постепенный
дрейф (например, до 300–500 мс) не будет замечен `compare.mjs` между
релизами, как замечаются остальные тайминги.

**Решение ревьюера:** Low, не блокирует. На усмотрение автора — добавить
`wallFaceAcceptedClickMs` в отслеживаемые `timings` бюджета в будущей
правке производительности, либо оставить как есть, раз запас по порогу
на два с лишним порядка.

## Что проверено и корректно

- **Алгоритм planar-graph (`wall-face-graph.ts`)** — canonical half-edge/DCEL
  traversal с `identityCycle` (убирает derived collinear-вершины из identity,
  чтобы безобидная T-подсадка на прямой стене не выглядела «новой» faces) и
  положительной/отрицательной ориентацией для отсечения exterior/compound
  циклов **структурно**, не эвристическим pairwise-поиском, который прямо
  запрещён §9.3 ТЗ. Sweep-broadphase на interval treap даёт заявленную
  сложность без деградации на разреженных планах (unit: 2000 сегментов,
  `faces.length === 0`, детерминированный порядок атомов при реверсе ввода).
- **Дисциплина «тест должен уметь падать» подтверждена мутационно.** Снятие
  проверки `consumed.has(atom.key)` в `_applyWallFaceBatch` (AC11) ломает
  2/19 проверок `smoke_unified_wall_tool.mjs`
  (`acceptCreatesRoomAtomically`, `mixedQueueAppliesOnce`); откат и повторная
  сборка подтвердили возврат к 19/19. Отдельно проверено (не для отчёта, а
  для собственной уверенности), что снятие фильтра
  `sourceKeys.includes(addedSourceKey)` в `findNewWallFacesInGraphs` не ломает
  ни одного теста — это математически корректно: в планарном графе
  добавление ровно одного ребра не может создать face, не содержащую это
  ребро на границе, поэтому фильтр — защитный дубль поверх уже достаточного
  `beforeKeys`-diff, а не непротестированная дыра.
- **Finish-контракт (AC2/AC3) на всех трёх точках выхода.** `_slideTo`,
  `_onHashChange` и переключение mode (`_setMode`-путь) единообразно вызывают
  `if (this._wallFaceBatch) this._roomDialogCancel(); if (this._mode ===
  'plan' && this._tool === 'draw' && !this._finishWallChain()) return;` —
  проверено построчно по всем трём местам диффа, поведение идентично.
- **Cancel/Escape корректно восстанавливает terminal draft.** `_roomDialogCancel()`
  при активном `_wallFaceBatch` восстанавливает `_path`/`_draftSegmentCms`/
  `_activeDraftId` из снимка `batch.activePath`/`activeCms`/`activeDraftId`,
  сделанного в момент `_beginWallFaceBatch`; плейн Escape достаёт
  `_roomDialogCancel()` через уже существующую ветку `if (this._roomDialog)`.
- **Лимиты проверяются до mutation.** И `_canAppendRoomDraftPoint` (на каждый
  клик — резервирует место под будущий finish), и `_finishWallChain`
  (`MAX_PARTITIONS`), и `_applyWallFaceBatch` (`MAX_ROOMS`, повторно
  `MAX_PARTITIONS`) — везде проверка предшествует записи в `sp`, что закрывает
  риск ТЗ «Finish превысит partition limit при смене tool».
- **Clean split переиспользует немодифицированные `splitRoomPath`/`roomsOverlap`.**
  `_offerWallFaces` вызывает существующий `splitRoomPath` на полном `this._path`
  для каждой существующей комнаты; поскольку `splitRoomPath` требует, чтобы
  все промежуточные точки пути лежали строго внутри полигона комнаты и ни
  один сегмент не пересекал её стену, геометрически невозможно, чтобы тот же
  клик одновременно давал net clean split одной комнаты И независимую
  постороннюю face за её пределами — ветка `return` сразу после первого
  найденного split-совпадения безопасна, не теряет параллельные кандидаты.
- **Provenance и толщина (AC10.4/AC11).** `_wallSourceCmAt` ищет существующий
  сегмент (`sourceKind === 'partition'`/room-draft) по расстоянию до точки
  раньше активной цепочки, обеспечивая приоритет существующей authoritative
  толщины над `DRAW_WALL_DEFAULT_CM`; consumed/unconsumed atoms разделяются
  через `atomizeWallSegments(...).sourceKeys` пересечение с `activeSourceCms`.
- **Совместимость (AC14).** Ни один файл `custom_components/houseplan/**/*.py`
  не тронут; `git diff --stat origin/dev...HEAD` подтверждает отсутствие
  изменений backend/schema. Legacy `room_drafts`/`partitions` не мигрируются
  автоматически (не тронуты нормализацией при чтении, только на explicit
  finish/batch) — соответствует §11 ТЗ.
- **Документация консистентна и полна (AC17, §17 ТЗ).** Все перечисленные в
  §17 документы обновлены тем же коммитом; все три Low-находки предыдущего
  SPEC-REVIEW-173-r1 (отсутствие заголовка «Проблема», дрейф терминологии
  «Walls» в `UX-MODES.md`, опечатка в AC17) исправлены автором в этом же
  диффе (`git diff d096a02..HEAD -- docs/specs/173-unified-wall-tool.md`,
  `docs/UX-MODES.md`).
- **i18n RU/EN синхронны** — каждый новый/изменённый ключ (`markup.add`,
  `title.markup_add`, `markup.hint_points`, `markup.hint_start`,
  `btn.keep_as_walls`, `room.queue_progress`, `toast.wall_rooms_saved`,
  `toast.wall_chain_saved`, `history.wall_chain_finish`,
  `history.wall_face_batch`) присутствует в обоих файлах.
- **Трейлеры и changelog.** Единственный коммит класса A/B, `f931159`, несёт
  `Issue: #173` и `User-Visible: yes`; оба changelog (`docs/CHANGELOG.md`,
  `docs/CHANGELOG.ru.md`) правлены тем же коммитом. `process-gate.mjs`
  подтверждает 0 предупреждений на диапазоне `origin/dev..HEAD`.

## Чего не проверял

- Не прогонял `golden:verify` — diff не трогает `demo/golden/**`, ни один
  baseline не принимался; AC12 (визуальная неизменность рендера) проверено
  только чтением кода (переиспользование немодифицированных canonical
  хелперов), не исполнением golden. Это предрелизный гейт по процессу.
- Не прогонял `pytest tests_backend` — ни один Python-файл не тронут, AC14 не
  требует backend-исполнения.
- Не прогонял полный набор из 138 browser-smoke — прогнаны все явно названные
  в AC/§15.2 плюс три соседних по diff-риску (толщина, gestures, island-
  overlap primitve); оставшиеся 132 не пересекаются с изменённой
  поверхностью.
- Не воспроизводил multi-client optimistic-lock conflict во время открытого
  `_wallFaceBatch` вживую (WS reconnect с параллельной правкой) — только
  чтением кода, что batch не вводит новый conflict-путь помимо уже
  существующего `_saveConfig`/reload механизма (AC13 «save conflict»).
- Не проверял reload/remount во время активной цепочки исполнением (нет
  выделенного smoke на это в диффе) — только чтением: ни один код-путь
  `_finishWallChain`/`_wallFaceBatch` не вызывается из reload-обработчика,
  только из явных tool/mode/space переходов.
- Не запускал `npm run benchmark:compare` против сохранённого отчёта базового
  SHA (такого отчёта нет в этой сессии) — сверил сырые цифры одного прогона
  бенчмарка вручную с `budgets-large-house-plan-snap.json`.
- Не проверял алгоритмическую сложность `O((E + I) log E)` формальным
  профилированием на больших E — доверился unit-тесту на 2000 сегментов
  (не показал деградации) и общей архитектуре sweep+interval-treap, которая
  структурно даёт эту сложность.

## Вердикт

Зелёный. High: 0, Medium: 2 (оба вынесены отдельными issue —
[#176](https://github.com/Matysh/houseplan-card/issues/176) мёртвый код
инструмента `partition`, [#177](https://github.com/Matysh/houseplan-card/issues/177)
недостающее unit/smoke-покрытие overlap/duplicate/nesting для новой
интеграции), Low: 2 (не блокируют, оставлены на усмотрение автора). Все 17 AC
подтверждены — большинство тестами с проверенной дисциплиной «тест умеет
падать» (мутационная проверка), часть чтением кода с явной пометкой; ни одна
находка не свидетельствует о том, что изменение не решает заявленный сценарий
или ухудшает смежное поведение.
