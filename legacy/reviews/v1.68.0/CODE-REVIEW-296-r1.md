# CODE-REVIEW-296-r1

- **Issue:** #296 «Оптимизировать» не убирает невидимую геометрию, которая блокирует ресайз
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r1 · блокирующих циклов израсходовано 0/4 до этого ревью
- **SHA ревью:** `89ac96a8` (ветка `issue/296-optimize-hidden-obstacles`, приведена к `dev` до ревью — 1 коммит dev поверх, разбор полный по правилу §7.2/§2.9)
- **Вердикт: красный**

## Скоуп

Диапазон: `f7a19a35` (docs(spec)) → `033ad11b` (docs: review document r1) → `89ac96a8`
(fix, User-Visible: yes). Продуктовый код и тесты лежат в одном коммите `89ac96a8`.

Проверялись: piecewise-согласование составных `partitions` (§6), удаление доказанно
избыточных `room_drafts` (§7), backend fail-closed доказательство (§8), диагностический
слой скрытой геометрии в редакторе Плана (§9), отчёт/Undo/идемпотентность (§10),
i18n/документация (§11, §16), AC1–AC9 (§13).

## Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 1267 pass / 1 skip / 0 fail |
| Build + сверка бандлов | `npm run build`; `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js`; `npm run bundle:sync` + `cmp` с `demo/srv/assets/houseplan-card.js` | все три копии идентичны |
| Docs fingerprint | `node scripts/check-docs.mjs` | **красный** — `ERROR screenshot source fingerprint is stale`. Проверено: на коммите-родителе `4feeebc3` (до этой задачи) тот же скрипт зелёный (`Documentation checks passed`) — регрессия внесена именно этим диффом |
| Смок-выбор | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 27 «прямое совпадение» + 3 «зарегистрированная связь» = 30 из 185 |
| Named smokes (30, список ниже) | `node demo/smoke_<name>.mjs` | **29 OK, 1 FAIL** (`smoke_edit_walk.mjs`) |
| Model invariants на новой фикстуре | `node scripts/model-invariants.mjs --config test/fixtures/real-plan-second-floor.json --json` | 3 нарушения `hidden_obstacles`, как и заявлено в issue/ТЗ (до Optimize) |
| Golden capture двух новых сценариев | `node demo/golden/run.mjs --mode=capture --scenario=hidden-wall-diagnostics-plan-{light,dark}` | захват прошёл (`missing-baseline`, ожидаемо), но **визуально сценарий не показывает диагностический слой** — см. High-2 |
| Backend unit | `python -m pytest tests_backend/test_validation.py -q` (агентом, после `pip install --user pytest voluptuous`) | 136 passed, 1 skipped (приватная фикстура владельца) |

Смоки, прогнанные из 30 (все «прямое совпадение» + все «зарегистрированная связь»):
`smoke_merge_split, smoke_zero_divider_taper, smoke_decor_layer_order, smoke_decor,
smoke_edit_walk, smoke_editor_gestures, smoke_free_walls, smoke_glow,
smoke_grid_scale_invariance, smoke_open_passage, smoke_opening_measure,
smoke_opening_tunnel_fill, smoke_optimize_coincident_partition,
smoke_optimize_micro_interval, smoke_optional_space_model, smoke_plan_drawing_repairs,
smoke_plan_snap_overlay, smoke_resize_audit_1550, smoke_room_autoclose, smoke_room_resize,
smoke_space_scale_defaults, smoke_split_corner_wall, smoke_split_nonsnap,
smoke_unified_wall_tool, smoke_wall_chain_thickness, smoke_wall_face_overlap,
smoke_wall_junctions, smoke_resize_pointer_real_plan, smoke_resize_wall_thickness,
smoke_wall_key_roundtrip`. Все зелёные, кроме `smoke_edit_walk` (см. High-3).

**Не прогонялось и почему:** полный набор `demo/smoke_*.mjs` (185 файлов) — предрелизный
гейт, задача не задевает всё; `npm run golden:verify` (нет принятых baseline для новых
сценариев — принятие вне ревью, канон CI; для существующих сценариев дрейф не
проверялся отдельно, см. «Не проверено»); performance-бенчмарки
(`demo/benchmark_coincident_partitions.mjs`, `demo/benchmark_safe_resize*.mjs`) — не
названы явно упавшими, а спецификация делает обновление бюджетов условным
(«только при обоснованной необходимости»); полный HA/Linux-харнесс backend — недоступен
в этой среде, каноном остаётся CI на точном SHA.

## Находки

### High-1 — backend не доказывает удаление partition без hosted opening (§8, AC6)

`custom_components/houseplan/validation.py`, `_safe_optimize_partition_rehost`
(строки ~173–274). Функция вызывается **на каждый opening**, и восстанавливает
`target_a/target_b` только как footprint конкретного opening
(`expected_x/y ± opening_length/2`), а не ось всей старой partition. Диапазоны старой
partition, на которых нет opening, вообще не проверяются backend'ом — ни на покрытие
solid room-стеной, ни на неуменьшение толщины.

Это ровно основной сценарий issue: `partition-mt2on9ou-0` и `partition-room-mt7ijuyq-0`
в приложенном плане владельца **не несут ни одного opening** (`"openings": []` в этом
пространстве). Подтверждено исполняемым репро (см. отчёт субагента): (1) partition без
единого opening молча удаляется без единой проверки; (2) partition с opening,
покрывающим лишь часть длины (0.4–0.6 из 0–1), после Optimize теряет реальный
непокрытый остаток (0.6–1.0) — валидатор не возражает.

Спецификация §8 п.1–2 требует ровно обратного: backend обязан «восстановить ось и
атомарное покрытие старой partition стенами комнат в новой конфигурации» и «доказать,
что удалённые диапазоны полностью покрыты solid room walls не уже старой partition»
— для **всей** partition, а не только для той её части, где есть opening. Сейчас
`allow_optimize_rehost=true` доверяет frontend-delta без проверки именно там, где
проверка нужнее всего.

**Воспроизведение:** `tests_backend/test_validation.py` не содержит теста с partition
без openings; при добавлении такого случая (partition без openings, "удалённая" в
candidate без замещающей стены нужной толщины) `validate_partition_opening_hosts(...,
allow_optimize_rehost=True)` не поднимает `PartitionOpeningHostError` — вызов молча
проходит.

### High-2 — AC7 нарушен: диагностический слой не виден в инструменте Draw (§9.2)

`src/houseplan-card.ts:19582-19583` (`_renderHiddenWallDiagnosticOverlay`) и вызывающая
точка `src/houseplan-card.ts:17391-17394` явно гасят слой при `this._tool === 'draw'`:

```ts
private _renderHiddenWallDiagnosticOverlay(): TemplateResult {
    if (!this._markup || this._tool === 'draw') return svg`` as unknown as TemplateResult;
    ...
${this._tool === 'draw'
  ? this._renderPlanSnapOverlay()
  : this._renderHiddenWallDiagnosticOverlay()}
```

`this._tool` по умолчанию равен `'draw'` (`src/houseplan-card.ts:1270`) — то есть при
входе в редактор Плана диагностика не видна вовсе, до явного переключения инструмента.
AC7 (§13): «**Во всех инструментах** редактора Плана перекрытая partition и сохранённый
draft показывают полную ось и исходные endpoints...» — «во всех» не имеет исключения
для Draw ни в АС, ни в §9.2 («Слой существует во всём редакторе Плана **при любом
активном инструменте**»).

Это не только текстовое несоответствие: именно в инструменте Draw активен
`buildPlanSnapGeometry()`, который **дедуплицирует** совпадающую ось в пользу комнаты
(подтверждено существующим тестом «a completed room remains the authority for a
coincident deduplicated axis»). То есть ровно там, где пользователь мог бы начать
рисовать рядом со скрытым объектом, скрытый объект не показан вовсе, а показанная
«архитектура» — дедуплицированная, без отдельных исходных endpoints, которые и есть
единственный смысл диагностики (§9.1, последний пункт).

**Воспроизведение исполнением:** golden-сценарии `hidden-wall-diagnostics-plan-light`
/`-dark` (добавлены этим же диффом для AC7) не задают `_tool`, поэтому остаются на
дефолте `'draw'`. Захват (`node demo/golden/run.mjs --mode=capture
--scenario=hidden-wall-diagnostics-plan-light`) даёт скриншот с чекбоксом «Thickness» и
подсказкой «click a grid dot to start a wall chain» — интерфейс инструмента Draw, а не
диагностический слой. AC7-евиденс «editor golden light/dark for скрытая
partition/draft» фактически не демонстрирует заявленную функциональность.

`demo/smoke_plan_snap_overlay.mjs` эту ветку не проверяет (переключается на
`_activateMarkupTool('select')`, не на `draw`), поэтому регрессия не поймана смоком.

### High-3 — `smoke_edit_walk.mjs` красный на новой фикстуре (AC6, §253-класс дефекта)

```
node demo/smoke_edit_walk.mjs --seed 2 --plan real-plan-second-floor.json
```
падает детерминированно:
```
real-plan-second-floor.json, семя 2, шаг 0: ресайз room-a#2 на -3
    wall_carrier · real-second-floor:1.020833,1.266667@0.0000 · 20 см
    ...
    off_lattice_coordinate · config · вне сетки 0 → 1
FAILED: walk_second_floor_seed2: expected true, got false
```

`demo/smoke_edit_walk.mjs` — обход-фаззер из issue #297, уже существующий на `dev` со
своей таблицей известного долга (`KNOWN`, `PLANS[...].debt`). Этот же коммит трогает
файл ровно одной строкой — поднимает `debt` для `real-plan-second-floor.json` с `1` до
`3`, но комментарий в самом файле (строки 50-58, не изменён) прямо требует обратного:
«Когда #296 закроется, число здесь станет нулём, и тест это потребует». `KNOWN`-таблица
для seed 2 (строка 77) заявляет только `off_lattice_coordinate` на шаге 0; фактически
шаг 0 после ресайза даёт **дополнительно** `wall_carrier` — запись толщины, отвязавшуюся
от какого-либо ребра/перегородки (класс #253, «не исчезла ли запись толщины», один из
трёх инвариантов, прямо названных в задании на это ревью).

**Изолировано:** тот же результат воспроизводится на чистом `dev` (`4feeebc3`) с
одной лишь новой фикстурой (без единой строки продуктового кода этой задачи) —
`git worktree add origin/dev`, скопирован `test/fixtures/real-plan-second-floor.json` и
debt-строка из смока, `npm run bundle:sync`, тот же вызов даёт тот же `wall_carrier`.
Значит, баг живёт в `resize.ts` (не тронут этим диффом) и не является регрессией
координат-присвоения этой задачи — но именно эта задача **выбрала** внести три
проблемных записи прямо в `test/fixtures/real-plan-second-floor.json`, разделяемый с
уже существующим смоком #297, вместо предложенной самой спецификацией альтернативы
(«либо заводится третья фикстура», §13 AC6) — и не привела разделяемый смок в
соответствие. Сейчас гейт красный на коде, уходящем в `dev`.

### Medium-1 (в скоупе) — `check-docs` красный, скриншоты не пересняты

См. таблицу гейтов. `docs/**` изменения этой задачи вводят новый видимый слой
(диагностическая проекция) и правят множество канонических документов, но
`docs/images/screenshots.json`/фингерпринт не обновлён. PROCESS.md §8 называет ровно
эту ошибку («скриншоты не пересняли в #230 и #234, и `dev` стоял с красным job `docs`»)
и требует пересъёмки «тем же коммитом». Чинится: `Docs screenshots`
(`workflow_dispatch`) → `npm run docs:accept -- --reviewed --from=<артефакт>` тем же
issue.

### Medium-2 (в скоупе) — счётчик удаления drafts делит сообщение с «мусором сетки» (одно число, два разных источника смысла)

`src/plan-optimizer.ts:634-637`:
```ts
if (reconciled.removedDrafts) {
  alignReport.removedDrafts += reconciled.removedDrafts;
  ...
```
`reconciled.removedDrafts` (новая причина: draft доказанно полностью совпадает с
solid-стенами, §7) прибавляется к тому же `alignReport.removedDrafts`, который питает
существующее сообщение `gs.align_removed_drafts` — «Invalid outlines collapsed by the
grid and removed: {n}.» / «Схлопнувшиеся на сетке некорректные контуры удалены: {n}.»
(`src/houseplan-card.ts:16510-16513`). Единственная i18n-правка этого диффа —
`gs.optimize_coincident_partitions` (теперь верно говорит про «hidden independent wall
sections»); для удаления drafts новой строки нет вовсе.

Пользователь, у которого Optimize удалит `draft-mt7igts5` (доказанно избыточный, лежит
на стене — причина №2 из этого самого issue), увидит текст «схлопнувшийся на сетке
некорректный контур удалён» — неверное объяснение причины. Это ровно тот класс
дефекта, который правило «одно число — один источник» просит проверять: одна и та же
цифра в отчёте теперь означает два разных, несвязанных события без разделения в тексте.
Не механический тест `test/single-source-numbers.test.mjs` (он про форматирование
единиц) — смысловая часть правила, ответственность ревью.

### Medium-3 (в скоупе) — порядок слоёв: диагностика рисуется НАД transient-превью инструмента «Проём»

`src/houseplan-card.ts:17381-17394`: `_renderOpeningPlacementPreview()` и
`_renderOpeningDimensionGuides()` (призрак двери/окна и размерные направляющие)
находятся в шаблоне **раньше** нового комбинированного слоя (`planSnap`/
`hiddenWallDiagnostic`) — то есть рисуются раньше = ниже по z-order, а диагностика
поверх них. §9.2 требует обратного: слой должен быть painted «до... transient
previews», то есть **под** ними. Ниже по документу диагностика по-прежнему корректно
остаётся под реальными openings и resize-chrome — нарушение касается только этих двух
превью инструмента «Проём». Подтверждено чтением (агент-ревьюер диагностического
слоя); не воспроизведено визуально из экономии времени, но расположение в шаблоне
однозначно.

### Medium-4 (в скоупе) — backend §8: неизвестные поля partition и rehost на другой residual не доказаны

Из отчёта агента-ревьюера backend (полные репро в его выводе, здесь — суть):

- Неизвестные поля **исходной partition** не проверяются вовсе:
  `_safe_optimize_partition_rehost` читает у `old_partition` только `a`, `b`, `cm`; в
  отличие от opening (`old_stable == new_stable`, полное сравнение ключей), партиция не
  сверяется на неизвестные поля. §6.1/§8 явно требуют fail-closed на этот случай.
- Когда hosted opening по правилам §6.3 переезжает на **другой** id остатка (второй/
  третий residual), проверку берёт на себя не `_safe_optimize_partition_rehost`, а
  старый (до-#296) «строгий» путь «rigid host translation», который проверяет только
  jamb-margin в новой конфигурации и не сверяет абсолютную геометрию (center/angle/
  length) со старым opening. Существующий тест
  `test_partition_opening_jamb_delta_preserves_legacy_and_checks_direct_geometry`
  показывает, что перенос partition разрешён без такой сверки.

### Medium-5 (в скоупе) — тестовый план §14.7 (mutation gate) выполнен частично

`scripts/mutation-gate.mjs` в этом диффе только переименовывает/адаптирует два
**уже существовавших** мутанта #276 (`optimizer-coincident-opening-rehost-disabled`,
переименованный `optimizer-coincident-residual-dropped`) к новой структуре кода. Ни
одного нового мутанта нет для явно перечисленных в §14 п.7 сценариев: «заменить max
толщины», «доверить frontend delta», «поместить overlay под стенами». Проверено
`grep` по всему файлу — других #296-специфичных мутантов для `coincident-partitions.ts`
или `validation.py` нет.

### Medium-6 (в скоупе) — пробелы и регрессия тестового покрытия ядра алгоритма

Подтверждено субагентом чтением и точечными запусками против `test-build`:

- **AC9 явно требует «limit unit»** — ни один тест не упоминает `MAX_PARTITIONS`/
  `MAX_WALLS` (2000/500). Логика по чтению верна и по чтению fail-closed (лимит
  проверяется до мутации `walls/partitions`), но не защищена регрессией, как того
  прямо требует акцептанс-критерий.
- Нет теста на opening, целиком лежащий на **остатке** (§6.4, средний из трёх
  случаев) — только ручная проверка агентом (`host.id` меняется на `p~r-...`,
  геометрия и `openingsRehosted` не трогаются, верно, но без автотеста).
- Нет теста на разную итоговую толщину **между несколькими безопасными кусками
  одного** partition — фикстура AC1 даёт «все стали 30», что не демонстрирует
  раздельный `max()` по кускам (агент подтвердил раздельность вручную: 10/25 см на
  соседних кусках остаются раздельными).
- Нет теста на per-piece column-blocking (колонна блокирует один кусок многокускового
  partition, другие реконсилируются).
- **Регрессия покрытия:** удалён тест-вариант «overlapping draft» из «issue 276 fails
  closed for an orphan host, overlap, draft, column and unknown partition data»
  (переименован без слова draft) и заменён только тестом на удаление **полностью**
  избыточного draft. Случай «активный, не полностью избыточный draft блокирует
  partition-piece, но сам не удаляется» — из логики жив (агент подтвердил запуском),
  но теперь не защищён ни одним тестом ни в старом, ни в новом файле.

## Проверено и корректно

- **AC1/AC5 (реальный план).** `test/optimize-hidden-obstacles.test.mjs` (`issue 296 real
  second floor removes all three hidden blockers in one Optimize`) — реальные три
  объекта пропадают, `partitionsReconciled>=2`, `removedDrafts==1`, профиль
  `30/30/30`, идемпотентность на повторном Optimize. Плюс
  `test/resize-availability-audit.test.mjs`: на `real-plan-second-floor.json`
  `duplicate-physical-wall: 7→0`, `enabled: 5→9`, `real-plan-first-floor.json` не
  изменился — реальный сквозной путь через продуктовый аудит, не мок.
- **Направление входа, owner-kind, per-piece толщина, per-piece columnBlocks,
  MAX_PARTITIONS/MAX_WALLS fail-closed, «open» ≠ «есть проём» в WallInterval** —
  проверено чтением и точечными исполняемыми экспериментами (агент), контрпримеры не
  найдены.
- **Гейт видимости диагностического слоя** (`_markup` = `_mode==='plan'`) и его
  отсутствие в View/kiosk — тот же гейт, что у #137, подтверждено смоком
  (`viewHasNoOverlay`).
- **pointer-events/aria-hidden**, изоляция от `buildPlanSnapGeometry()`/snap-resolver —
  подтверждено чтением и юнит-тестом (`findSharedRoomSnapSegment(...)?.sourceKind ===
  'room'` не меняется).
- **Кэширование диагностики по `_cfgEpoch`**, не по pointermove — подтверждено чтением,
  паттерн идентичен существующему `_planSnapGeometrySnapshot()`.
- Backend: `allow_optimize_rehost=true` не просачивается в обычный `config/set` и
  импорт (проверено чтением вызовов в `websocket_api.py`/`import_export.py`); там, где
  проверка **есть** (opening с footprint внутри одного или нескольких room-edge),
  `_segments_cover_target` — честный геометрический пересчёт (коллинеарность +
  слияние интервалов), не сверка id-списков; при любом исключении парсинга —
  `False`.
- Документация (`CHANGELOG.md/.ru.md`, `USER-GUIDE.md/.ru.md`, `CANVAS.md`,
  `RESIZE.md`, `WALL-THICKNESS.md`, `ARCHITECTURE.md`) согласована с реализацией и
  друг с другом по формулировкам piecewise-поведения и диагностики.
- Трейлеры коммита: `Issue: #296`, `User-Visible: yes`, оба changelog правлены в том
  же коммите.

## Не проверялось (и почему)

- Полный набор `demo/smoke_*.mjs` (185 файлов) и `npm run golden:verify` по всем
  существующим сценариям — предрелизный гейт (§8); дрейф пикселей у ранее принятых
  golden-сценариев (не только двух новых) не проверялся построчно из бюджета времени.
  Учитывая находку High-2 (изменился порядок отрисовки `_renderPlanSnapOverlay`
  относительно `_renderOpeningPlacementPreview`/`_renderRoomHoverOutline`/editing
  `_renderOpenWalls` — раньше слой стоял сразу после `_renderWallBodies`, теперь
  значительно позже), нельзя исключить визуальный дрейф существующих сценариев с
  активным #137-overlay; отдельно от AC7 не воспроизведено — оставляю как открытый
  риск для `golden:verify` на предрелизе.
- Performance-бенчмарки (`demo/benchmark_coincident_partitions.mjs` и др.) — не
  запускались; спецификация делает обновление бюджетов условным, а свежих мутантов на
  производительность в этой задаче не добавлено.
- Полный HA/Linux backend harness — недоступен в текущей среде; прогнан только
  «чистый» `pytest tests_backend/test_validation.py` без Home Assistant (не требует
  импорта `homeassistant`/`fcntl`, тест грузит `validation.py` напрямую).
- Приватная фикстура владельца `C:\Temp\44.json` (backend/frontend оба) — недоступна,
  пропускается тестами штатно (`t.skip`).

## Закрытие раунда r0 (спецификация)

Спек-ревью (`SPEC-REVIEW-296-r1`, зелёное) не образует цикл (§4, #227) и не входит в
бюджет код-ревью. Три Low-наблюдения того ревью (терминология §2, канонический
порядок id остатков §6.3/§12.3, несуществующий бенчмарк AC9/§14.7) сняты автором
ревью с явной пометкой «решить на код-ревью» — они здесь и разобраны: порядок id
остатков реализован (первый в каноническом порядке = исходный id, подтверждено
тестом с детерминированными id), бенчмарк не создан и не назван явно — учтено в
Medium-6/«не проверялось».

## Итог

Вердикт: **красный**. Три High-находки блокируют: backend не доказывает удаление
partition без openings (ровно основной сценарий issue), диагностический слой не
показывается в инструменте Draw (AC7 буквально не выполнен, и собственный golden-
евиденс это не ловит), и разделяемый смок-фаззер `smoke_edit_walk.mjs` красный на
фикстуре, добавленной этой же задачей. Шесть Medium-находок в скоупе (docs-фингерпринт,
смешение счётчиков, порядок слоёв, два backend-пробела, недоделанный mutation-gate,
пробелы/регрессия тестового покрытия ядра) чинятся в этом же issue при возврате.
