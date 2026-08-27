# Issue #264 — отдельный контроллер Resize и commit-инвариант кладки

- **Issue:** https://github.com/Matysh/houseplan-card/issues/264
- **Статус:** первая редакция для независимого ревью; канонический статус задаётся
  метками issue
- **Тип / приоритет:** tech-debt / P1
- **Оценка:** пользовательская ценность 2/10; ценность для разработки 9/10;
  сложность 7/10; риск 8/10
- **Класс изменения:** A + B + C, полный процесс
- **User-Visible:** no — DOM, пиксели, тексты, жесты и persisted config не меняются
- **Связано:** #34, #253, #254, #277; `docs/RESIZE.md`,
  `docs/specs/034-frontend-decomposition.md`

## 1. Сценарий, персона и проблема

Домашний администратор на desktop открывает редактор плана существующего этажа,
выбирает Resize и перетаскивает обычную либо общую стену. Для него этот слайс
обязан быть полностью незаметен: допустимость ручки, движение, измерения,
сохранение, отмена и повтор остаются теми же, что в выпущенном контракте #277.
Задача нужна не ради нового пользовательского шага, а чтобы следующие изменения
этого критичного пути можно было делать и проверять изолированно.

После #277 Resize имеет безопасный fixed-topology контракт, но его конечный
автомат по-прежнему встроен в `HouseplanCard`: там одновременно живут pointer
session, immutable snapshot, eligibility cache, live preview, измерения,
fail-closed commit, Undo и восстановление wall-union cache. Любая следующая
правка этого инструмента снова меняет крупнейший компонент проекта и должна
доказывать корректность переходов по разрозненным полям `_rsz*`.

#264 — refactor-only слайс канонической декомпозиции #34. Он выносит состояние
и переходы одного инструмента в отдельный typed controller. Геометрические
формулы остаются в `src/resize.ts`, а Lit/DOM, перевод, toast, config/history,
серверная запись и рендер остаются у корневого компонента.

Одновременно transaction boundary получает production-инвариант сохранения
wall records. Именно нарушение этого свойства вызвало #253. Сейчас похожая
проверка существует как отдельная реализация в CLI-инвариантах и как inline
сравнение внутри Resize; после #264 алгоритм находится в одном production-
модуле и используется обоими путями.

### Что человек увидит

Ничего нового. До и после изменения:

- те же handles, disabled reasons, preview, подписи длины/площади и cursor;
- те же границы safe drag, snap и clamp;
- те же commit, Cancel/Escape, pointercancel/lostpointercapture и Undo/Redo;
- те же пиксели View, Plan и остальных редакторов;
- тот же JSON успешного Resize byte-for-byte.

Если внутренний инвариант нарушен, сохраняется уже принятое в #277 поведение:
preview останавливается либо commit отменяется с существующим безопасным
сообщением; config write и Undo-команда не создаются.

## 2. Зафиксированные решения и исходный контракт

1. #277 уже реализован и выпущен. Его ТЗ и `docs/RESIZE.md` являются
   функциональным каноном; #264 не пересматривает eligibility, geometry,
   disabled reasons, preview или commit semantics.
2. Старый продуктовый вопрос из тела #264 закрыт решением #277: при любом
   нарушении инварианта жест **fail closed** — без частичного применения,
   диагностики с пользовательскими данными, write или Undo.
3. Владелец явно выбрал #264 следующим слайсом, поэтому прежнее сомнение
   «сначала небольшой диалог или Resize» закрыто.
4. Schema/model version, compatibility fields и миграции не меняются.
5. `allowClear` для Resize всегда `false`. Очистка толщины относится к другому
   явному инструменту и не может быть побочным эффектом перемещения стены.
6. Opened/disabled handles и мышь/клавиатура/touch сохраняют поведение #277.
   Осознанная desktop-first деградация редакторов из `docs/TOUCH-SUPPORT.md`
   не расширяется.
7. `_rszSel` не имеет renderer-потребителя после #277, но не является полностью
   мёртвым: клик по площади комнаты запоминает latent selection, после чего
   первый Escape очищает её и оставляет Resize активным, а второй возвращает
   neutral Draw. Это наблюдаемое keyboard-поведение сохраняется. Само поле
   уезжает из root в controller как `selectedRoomId`; warm viewport продолжает
   переносить это session-only значение через typed getter/restore, не меняя
   сериализуемый config.

Открытых продуктовых вопросов нет.

## 3. Термины

- **Root / host** — `HouseplanCard`, composition shell, владелец браузерных и
  инфраструктурных side effects.
- **Controller** — новый `ResizeController`, единственный владелец состояния
  жеста и допустимых переходов.
- **Adapter / port** — typed callback, которым root предоставляет controller
  текущие данные или выполняет host-specific операцию без обратной записи в
  controller internals.
- **Geometry snapshot** — immutable JSON-снимок `SpaceGeometryState` перед
  pointerdown плюс identity/fingerprint, с которым сверяется pointerup.
- **Preview candidate** — полный exact space candidate, построенный только из
  pre-drag snapshot; он никогда не является частью `_serverCfg`.
- **Commit outcome** — typed значение controller, разрешающее root применить
  ровно этот preview candidate одной geometry-командой.
- **Wall record profile** — мультимножество конечных числовых `cm` у записей
  `walls`; в exact-режиме включает `0`, потому что после #306 это значимое
  состояние стены.

## 4. Архитектурная граница

### 4.1 Controller владеет

Новый `src/resize-controller.ts` владеет только Resize orchestration:

1. состояниями `idle` и `dragging`; наличие принятого preview — часть
   `dragging`, не параллельный флаг; idle дополнительно хранит необязательный
   `selectedRoomId`, который сохраняет существующую двухшаговую Escape-ветку;
2. pointer id, start point, `SafeResizePlan`, immutable rooms/openings/options,
   snapshot identity, current accepted delta, moved flag, changed room ids и
   однократным preview-rejection notification flag;
3. eligibility cache, ограниченным одним space/snapshot/grid context;
4. ссылкой на exact accepted preview, live measurement model и retained
   pre-drag wall-union token как opaque generic value;
5. переходами `select/clearSelection`, `resolve → begin → move* → finish` и
   `begin/move → cancel`; wrong pointer id даёт no-op;
6. вызовом существующих pure `safeResizePointerDisplacement`, snap adapter,
   `clampSafeResize`, `applySafeResize` и `validateSafeResize` в прежнем порядке;
7. правилом «failed projection сохраняет последний полный accepted preview,
   delta и labels»;
8. формированием typed `commit | no-op | rejected | cancelled` outcome.

Controller не экспортирует изменяемые поля. Root читает immutable getters/
snapshots (`dragging`, `preview`, `liveLabels`) и меняет состояние только
публичными командами controller.

### 4.2 Root сохраняет

`src/houseplan-card.ts` остаётся владельцем:

- DOM/PointerEvent: `preventDefault`, `stopPropagation`, pointer capture,
  перевод координат через `_svgPoint` и маршрутизация событий;
- Lit reactivity и `requestUpdate`;
- `_t`, disabled-reason copy и toast;
- получение current rooms/openings/obstacles/thickness/options из модели;
- построение preview space, rekey wall metadata и wall-segment endpoints;
- common physical geometry preflight и retained wall geometry/cache;
- построение локализованных live labels и их DOM/SVG render;
- `_serverCfg`, `_cfgEpoch`, geometry command stack, suppression synthetic
  click, `_commitPhysicalGeometry` и serialized write queue;
- tool/mode/space lifecycle и сброс других инструментов.

Root handlers после выноса являются тонкими adapters: переводят Event в
primitive input, вызывают controller, исполняют outcome и запрашивают render.
Они не держат зеркальных `_rszDrag/_rszPreview/_rszLive` полей и не дублируют
проверки state transition.

### 4.3 Что остаётся pure geometry

`src/resize.ts` остаётся единственным источником topology/eligibility/range/
candidate math. Controller импортирует его функции, но не копирует алгоритмы.
`src/resize-labels.ts` остаётся единственным источником placement math.

Не создаются второй room model, второй wall model, новый render tree или общий
framework контроллеров для остальных инструментов.

## 5. Typed ports и outcomes

Конкретные имена типов могут уточняться при реализации, но граница обязательна:

```ts
type ResizeControllerOutcome<TSpace, TSnapshot, TWallUnion> =
  | { kind: 'commit'; preview: Readonly<ResizePreview<TSpace>>;
      before: TSnapshot }
  | { kind: 'rejected'; reason: 'stale-snapshot' | 'invalid-topology'
      | 'invalid-candidate' | 'wall-records' }
  | { kind: 'no-op' }
  | { kind: 'cancelled'; restoreWallUnion: TWallUnion | null };
```

Controller получает через typed inputs/ports:

- current context identity и immutable snapshot;
- `snap(point)`;
- `resolve(roomId, edge)` либо данные для вызова pure resolver;
- `project(snapshot, candidate)` → success с exact preview/retained geometry
  либо bounded failure reason;
- `validatePreview(exactPreview)` — common physical preflight на pointerup;
- `measure(candidate, plan)` — presentation model без DOM measurement.

Ports не получают controller instance и не могут менять его поля. Exceptions
adapter'ов перехватываются на границе и превращаются в bounded fail-closed
failure; exception text, ids и координаты не попадают в UI.

Root исполняет только `kind: 'commit'` и только один раз. Любой другой outcome
сначала удаляет overlay/controller session, затем приводит render к committed
модели и не вызывает `_commitPhysicalGeometry`.

## 6. Конечный автомат

| Текущее состояние | Команда | Условие | Результат |
|---|---|---|---|
| `idle` | `resolve` | тот же context identity | cache hit либо один pure resolver call |
| `idle` | `selectRoom` | клик по площади комнаты | сохранить latent `selectedRoomId`, без visual/config effect |
| `idle` | `escape` | `selectedRoomId` существует | очистить selection, остаться в Resize |
| `idle` | `escape` | selection отсутствует | typed outcome `exit-tool`; root включает Draw |
| `idle` | `begin` | tool Resize, enabled plan | `dragging`, immutable session captured |
| `idle` | `begin` | disabled | `idle`, no capture/preview/write; root показывает reason |
| `dragging` | `move` | wrong pointer id | no-op |
| `dragging` | `move` | delta прежний | no-op |
| `dragging` | `move` | projection valid | replace exact preview/delta/labels atomically |
| `dragging` | `move` | projection invalid/throws | retain last accepted triple; notification only once |
| `dragging` | `finish` | no movement/zero delta/no preview | clear session, `no-op` |
| `dragging` | `finish` | stale snapshot, invalid topology/candidate/invariant | clear session, `rejected`, zero write/Undo |
| `dragging` | `finish` | all guards pass | clear session, one `commit` with exact preview |
| `dragging` | `cancel`/pointer cancel/lost capture/Escape/Ctrl+Z/tool/space/mode exit | matching active session | clear session, `cancelled`, zero write/Undo; eligible cache invalidated as today |
| `idle` | cancel/finish | — | no-op |

Every transition is synchronous and deterministic for the same inputs. A late
lostpointercapture after successful pointerup sees `idle` and cannot cancel or
commit twice.

## 7. Preview и transaction boundary

1. `begin` captures exact snapshot once. Every move projects from a fresh deep
   copy of that snapshot, never from previous preview or mutable `_serverCfg`.
2. Projected rooms, openings, `walls` and `wall_segments` are the same objects
   subsequently shown by render and offered for commit.
3. Preview success is atomic: preview, accepted delta and live labels replace
   the previous accepted triple together. Failure replaces none of them.
4. Candidate projection keeps the existing fixed-topology
   `rekeyWallsAfterMoveChecked(..., 'fixed-topology')`, changed-record carrier
   check and common physical preflight.
5. Immediately after rekey, exact wall-record preservation is checked against
   the immutable before snapshot. Failure returns bounded `wall-metadata` and
   cannot publish the preview.
6. `finish` proves current snapshot identity, `validateSafeResize`, identity of
   the accepted preview, common physical preflight and exact wall-record
   preservation **again** immediately before returning `commit`.
7. Root copies exactly `rooms`, `openings`, `walls` and `wall_segments` from
   commit outcome and calls one named history command. No simplify/rebuild or
   second candidate computation is allowed between outcome and write.

## 8. Один инвариант wall records

Новый `src/wall-record-preservation.ts` является единственным алгоритмом:

```ts
checkWallRecordsPreserved(before, after, {
  allowClear?: boolean,
  exactMultiplicity?: boolean,
}): WallRecordViolation[]
```

Контракт:

- `allowClear: true` явно отключает проверку; Resize его не передаёт;
- default/CLI mode сохраняет текущую семантику #254: каждое положительное
  конечное значение `cm`, существовавшее before, должно присутствовать after
  хотя бы один раз; законная merge одинаковых записей не считается потерей;
- `exactMultiplicity: true` сравнивает полное мультимножество всех конечных
  числовых `cm`, включая `0`; это режим fixed-topology Resize;
- порядок records, key и endpoints не участвуют в профиле: их корректность
  отдельно доказывают rekey/carrier/physical checks;
- `NaN`, infinity и non-number не превращаются неявно в `0`; такие записи не
  маскируют потерю валидной записи и проверяются существующими model gates;
- violation — bounded structured data без room ids/coordinates.

`scripts/model-invariants.mjs` удаляет собственную реализацию и re-export/import
production helper из `test-build`, который команда `npm run invariants` уже
собирает до запуска CLI. Это тот же действующий паттерн, что production
preflight и near-axis в этом script. Unit tests проверяют обе семантики через
один импорт и отдельно доказывают, что Resize вызывает exact mode на preview и
finish.

## 9. Lifecycle, cache и восстановление

- Eligibility cache key сохраняет семантику #277: space, cell/grid scale и
  exact geometry snapshot. Snapshot вычисляется root один раз на layer render,
  а controller cache хранит results по `(roomId, edge)`.
- Cache очищается при successful commit, tool/mode/space lifecycle reset и при
  смене context identity. Он bounded одной Map текущего context.
- Cancel восстанавливает retained pre-drag wall-union alias только если root
  подтверждает прежнюю snapshot identity, как сейчас; иначе cache silently
  отбрасывается.
- Preview по-прежнему увеличивает structural epoch и запрещает reuse clean-floor
  cache. После cancel/no-op/reject root возвращается к committed model.
- Warm remount не переносит active gesture/preview. `WarmViewport.rszSel`
  продолжает сохранять latent selection, но читает/восстанавливает его только
  через controller API; это module/session state, не сериализуемый config.
- `dispose`/disconnect, tool switch, space switch and mode exit must leave
  controller idle and release opaque retained references.

## 10. В скоупе

- новый controller и перенос в него Resize state/transitions/cache;
- typed root adapters и commit outcome;
- extraction единого production wall-record invariant;
- удаление controller-owned `_rsz*` mirrors из root и перенос latent
  `_rszSel`-семантики в controller;
- unit tests state machine/invariant, source-boundary guard и действующие
  production pointer smokes;
- актуализация architecture/Resize/testing/status docs;
- синхронизация tracked bundle как обычный результат build.

## 11. Не входит

- изменение geometry, UI, CSS, i18n, disabled reasons или hotkeys;
- изменение schema/model version/migrations/compatibility JSON;
- перенос `_wallThick*`, `_opening*`, drawing, labels renderer или общего
  geometry command stack;
- новый общий controller framework/base class/dependency injection container;
- переработка `src/resize.ts` и оптимизация boolean geometry;
- новое логирование, telemetry или пользовательский recovery dialog;
- cleanup иных мёртвых полей монолита.

Найденные вне этой границы дефекты получают отдельные issue и не исправляются
попутно.

## 12. Ошибки и edge cases

Обязательная матрица:

1. disabled handle mouse/keyboard/touch — controller не входит в dragging;
2. synthetic pointer, на котором capture throws, не ломает session;
3. wrong pointer id на move/up/cancel — no-op;
4. repeated identical move — не перестраивает preview/labels;
5. first failed projection — preview отсутствует, pointer визуально остаётся на
   committed model, toast один;
6. failed projection after success — остаётся последний полный safe preview;
7. failure adapter exception — то же bounded поведение;
8. zero-delta pointerup — no write/Undo;
9. stale config/space snapshot на pointerup — reject, zero write/Undo;
10. topology validation failure — reject, zero write/Undo;
11. wall record count/value loss, включая `cm:0` — preview/commit reject;
12. reordered records с тем же exact profile — разрешено;
13. carrier/physical preflight failure — reject;
14. Escape, Ctrl/Cmd+Z, pointercancel, lost capture, tool/mode/space exit — один
    cancel, exact committed geometry, zero write/Undo;
15. late cancel after up — no second outcome;
16. success — one outcome, one history command, one scheduled write;
17. room-area click в idle Resize + Escape + Escape сохраняет текущую
    последовательность «очистить latent selection → выйти в Draw»;
18. Undo/Redo/reload — exact parity с поведением #277;
19. disconnected root не оставляет controller references/timers/listeners.

## 13. Performance

Изменение не должно ухудшить действующие бюджеты #277:

- handle layer computes geometry snapshot once per render, not per edge;
- warm eligibility cache не вызывает повторный resolver для того же key;
- pointermove p95 на large-house fixture ≤16 ms и ≤20% хуже same-run baseline;
- pointerup preflight p95 ≤75 ms;
- commit invariant O(number of wall records), без polygon work и без JSON
  stringify каждого record сверх уже необходимого snapshot;
- controller создаёт не более одного accepted preview на успешный distinct
  delta и не сохраняет историю preview после завершения session.

Отдельной новой performance feature нет; доказательство — существующий
`benchmark:safe-resize`, render benchmark/call-count и review профиля diff.

## 14. Touch и accessibility

View/kiosk не затронуты. Plan editor остаётся desktop-first, но safety floor
обязателен на touch: finger-sized handles, disabled reason on tap, pointer id
guard, pointercancel/lost capture and pinch cancellation remain exactly as in
#277. Controller receives primitives after DOM event handling and therefore не
может отменить `preventDefault`, aria attributes, focusability или hit area.

## 15. Файлы и модули

Планируемый diff:

- `src/resize-controller.ts` — новый controller и typed outcomes;
- `src/wall-record-preservation.ts` — единый invariant;
- `src/houseplan-card.ts` — composition/adapters/render wiring, удаление mirrors;
- `scripts/model-invariants.mjs` — import/re-export production invariant;
- `tsconfig.test.json` — test-build новых production modules;
- `test/resize-controller.test.mjs` — state transition matrix;
- `test/wall-record-preservation.test.mjs` и/или
  `test/model-invariants.test.mjs` — shared semantics;
- `test/resize-production-path.test.mjs` — source boundary/exact guard;
- существующие `demo/smoke_room_resize.mjs`,
  `demo/smoke_resize_pointer_real_plan.mjs`,
  `demo/smoke_resize_wall_thickness.mjs`,
  `demo/smoke_resize_inner_dimensions.mjs` — behavioral parity;
- `docs/ARCHITECTURE.md`, `docs/RESIZE.md`, `docs/TESTING.md`,
  `docs/STATUS.md` — фактическая граница и проверка.

Иные файлы добавляются только если `smoke-select`/build sync механически этого
требуют. RU/EN i18n и changelog не меняются, потому что `User-Visible: no`.

## 16. Критерии приёмки

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | В root нет mutable `_rszDrag`, `_rszPreview`, `_rszLive`, `_rszEligibilityCache` и `_rszSel`; состояние и cache принадлежат одному `ResizeController`. | Source guard + code review. |
| AC2 | Controller реализует таблицу §6: wrong pid/duplicate events/no-op/cancel/reject/success дают ровно один детерминированный outcome. | Unit. |
| AC3 | Preview строится из immutable pre-drag snapshot, никогда не пишет `_serverCfg`; failed projection сохраняет последний полный accepted preview/delta/labels и уведомляется один раз. | Unit + production pointer smoke. |
| AC4 | Pointerup возвращает commit только для exact displayed preview после snapshot/topology/common-preflight checks; root выполняет ровно одну geometry command/write, остальные outcomes — 0. | Unit + production pointer smoke. |
| AC5 | Cancel/Escape/Ctrl+Z/pointercancel/lost capture/tool/mode/space exit возвращают committed model, 0 Undo/write и не допускают late double outcome. | Unit + browser smoke. |
| AC6 | Один production helper сохраняет старую CLI presence-семантику и exact Resize-семантику, включая `cm:0`; script не содержит копии counting/comparison algorithm. | Unit + source guard + `npm run invariants`. |
| AC7 | Exact invariant вызывается при projection и повторно в final controller guard; искусственная потеря/изменение multiplicity даёт fail-closed до commit. | Injectable unit + production-path test. |
| AC8 | Safe Resize #277 остаётся функционально идентичным: eligibility, clamp, opening stops, preview, measurements, Undo/Redo/reload и disabled a11y проходят существующие тесты. | Existing units + selected smokes. |
| AC9 | Handle render вычисляет snapshot один раз, warm cache bounded текущим context и не повторяет resolver; бюджеты §13 зелёные. | Call-count unit + benchmark. |
| AC10 | DOM/CSS/i18n/config schema и tracked visual baselines не меняются; targeted golden verify не показывает diff. | Source/diff review + golden verify. |
| AC11 | Typecheck, unit, build, docs and model-invariant gates зелёные; tracked bundle синхронизирован. | Local gates + CI. |
| AC12 | Architecture/Resize/testing/status docs описывают controller boundary, single-source invariant и refactor-only status; changelog не изменён. | Docs gate + review. |

## 17. План тестирования

### Unit

- fake typed ports без DOM для каждой строки автомата §6 и edge cases §12;
- prove a failed state transition by mutation/negative input, not only happy
  snapshots;
- presence/exact/allowClear profiles: duplicates, count decrease, count
  increase, reordered values, zero, invalid numeric values;
- controller exact-guard call count at preview and finish;
- eligibility cache hit/miss/invalidation and one snapshot per rendered layer.

### Production path / browser

- update source contract so tests forbid state mirrors and inline wall-cm
  comparison in root;
- execute real pointerdown/move/up and cancel paths through bundled card;
- selected existing smokes from `node scripts/smoke-select.mjs --base origin/dev
  --head HEAD`, at minimum safe Resize, wall thickness and inner dimensions;
- verify one write/Undo on success and zero on every fail/cancel path.

### Visual / performance

- targeted existing Resize golden scenes in light/dark must match committed
  baselines; new baselines are forbidden unless review proves unrelated drift;
- existing safe-resize and safe-resize-render benchmarks stay inside §13.

Full prerelease smoke/golden/performance matrix remains a release-stage gate,
not a substitute for targeted implementation checks.

## 18. Документация, compatibility и release artifacts

- **Schema/migration:** none; successful persisted payload byte-equivalent.
- **i18n:** no keys added/changed/removed.
- **Changelog RU/EN:** no entries; refactor-only, `User-Visible: no`.
- **User guide:** no change.
- **Architecture/engineering docs:** update files from §15 in implementation
  commit.
- **Golden/screenshots:** verify only; no accepted visual delta expected.
- **Security/backend:** no impact.

## 19. Риски и меры

| Риск | Мера |
|---|---|
| Shallow extraction leaves two owners of state | AC1 forbids mirrors; root gets immutable getters and outcomes only. |
| Controller absorbs renderer/HA and becomes a second monolith | Explicit ownership matrix §4; no Lit/DOM/i18n/config write imports. |
| Preview and commit diverge during refactor | Exact preview object identity + final guards + AC3/AC4. |
| Common invariant weakens #277 exact contract to coarse CLI presence | Two modes in one helper; Resize always exact, AC6/AC7 include multiplicity and zero walls. |
| Zero-thickness walls from #306 disappear silently | Exact profile includes finite numeric `cm:0`. |
| Adapter exception leaks partial state | Boundary catches and maps to bounded reject, state cleared atomically. |
| Cancel loses expensive pre-drag wall union reuse | Opaque retained token and snapshot-identity restore test. |
| Перенос `_rszSel` меняет warm/Escape behavior | Controller сохраняет latent selection, warm getter/restore и двухшаговый Escape; dedicated unit/browser assertion. |
| Large mechanical diff hides behavior change | Separate spec and implementation commits, targeted source guard, selected smokes, golden no-diff and independent review. |

## 20. Rollback

Rollback is a normal revert of the implementation commit(s), including generated
bundle and documentation. There is no data migration, feature flag or persisted
new field to undo. Because successful payloads remain byte-identical, a plan
edited by the refactored controller opens unchanged after rollback.
