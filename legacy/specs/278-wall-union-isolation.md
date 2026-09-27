# Issue #278 — локальный сбой extra-body union не гасит всю кладку

- **Issue:** https://github.com/Matysh/houseplan-card/issues/278
- **Статус:** первая редакция для ревью; канонический статус задаётся метками issue
- **Тип / приоритет:** bug / P1
- **Оценка:** пользовательская ценность 10/10; ценность для разработки 9/10;
  сложность 7/10; риск 9/10
- **Область:** canonical wall geometry, independent physical bodies, strict
  geometry commit barrier, model invariants, Plan/View/static/hidden Iso/Glow
- **Модель данных:** без schema/migration и без записи во время render
- **Связано:** #141, #197, #199, #218, #264, #276, #277,
  `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`

## 1. Сценарий и персона

После Resize пользователь открывает пространство и видит комнаты, проёмы,
подписи и осевые линии, но не видит кладку ни одной стены. Persisted `walls`
при этом содержит 25 записей. Один конфликт physical geometry превращает
полноценный этаж в визуально пустой.

После исправления core room masonry остаётся видимой и физически канонической,
даже если отдельный independent extra нельзя объединить с ней одной boolean
операцией. Локальный extra сохраняется отдельным structural component либо
локально деградирует; он не обнуляет уже построенные стены. Ни один новый
geometry commit не может записать такой degraded candidate.

## 2. Доказательная база

На приложенном `33.json` из `1.67.0-beta.7`:

- 8 rooms, 25 wall records, 8 partitions и 14 openings;
- `wallBodiesUnionPath()` возвращает `null`;
- `_renderWallBodies()` вследствие этого возвращает пустой wall layer;
- production bundle детерминированно показывает кладку на состоянии до Resize
  и полностью теряет её после;
- `scripts/model-invariants.mjs` считает состояние валидным;
- shared preflight #199 на точном `payload.config` корректно возвращает
  `failed / wall-null` и блокирует Optimize Apply.

Последний пункт уточняет границу: #199 не сломан. Чистый `optimizePlans()` сам
не ремонтирует input, но UI не записывает его повторно. Проблема в том, что
Resize сохранил candidate без такого барьера, renderer применяет общий catch к
последовательному extra union, а CLI invariants не повторяют production pass.

Текущая причинная точка — цикл `extraBodies` в `wallBodiesGeometry()`: room
rings, atomic edges и junction patches имеют локальную изоляцию, а exception
при `union(body, extra)` попадает в внешний catch и возвращает `null` для всего
результата.

## 3. Зафиксированный продуктовый контракт

1. Один local independent body не может удалить валидную кладку комнат и
   остальные успешно построенные physical bodies.
2. Existing saved config читается без фоновой записи, удаления объектов или
   автоматического Optimize.
3. Render может использовать локализованный component fallback, но exact
   candidate любой geometry-changing операции обязан пройти strict preflight;
   degraded результат нельзя сохранить как success.
4. Основной structural failure room masonry остаётся fail-closed. Задача не
   воскрешает старые raw room rings, создававшие facade teeth до #141/#197.
5. Optimize preflight #199 остаётся strict и по-прежнему блокирует `wall-null`
   либо degraded candidate. Восстановление конкретной redundant partition
   выполняет #276.
6. Все canonical consumers получают одно множество физических components;
   SVG-only обход, отличный от floor/light/static, запрещён.

Открытых продуктовых вопросов нет.

## 4. Два результата: strict и render-safe

Pure production preparation возвращает типизированный structural result:

- `ok` — core и все extras успешно объединены;
- `degraded-extra` — core room masonry успешно, но один или несколько extras
  нельзя слить с общей geometry; сохранены primary geometry и локальные
  isolated components;
- `failed-core` — обязательная room/exterior/opening geometry не построена;
- `not-applicable` — пространство не содержит физических стен.

**Strict mode** принимает только `ok`/`not-applicable`. Его используют
Optimize и commit barrier редакторов.

**Render-safe mode** принимает `ok` и `degraded-extra`. `failed-core` остаётся
`null`/fail-dark. Режимы используют один computation/result, а не две реализации
boolean geometry.

## 5. Изоляция independent extras

1. Core room result завершается до extra pass и сохраняется транзакционно:
   masonry после room openings, `roomGeom`, paper geometry, depth и opening
   index.
2. Extra bodies уже представлены после собственных hosted cuts. Каждый body
   нормализуется/проверяется независимо и получает стабильный порядковый
   component id, не persisted id.
3. Для каждого extra попытка union выполняется независимо. Присваивание общей
   geometry происходит только после успешной операции.
4. Если union выбрасывает либо возвращает structurally invalid result, последняя
   успешная primary geometry сохраняется, а валидный исходный extra добавляется
   как isolated component. Следующие extras продолжают обрабатываться.
5. Если сам extra non-finite/zero-area/non-simple и не может быть безопасно
   представлен даже отдельно, пропускается только этот body и результат всё
   равно `degraded-extra`; core/остальные extras не исчезают.
6. Isolated component остаётся физическим препятствием для render, hit/source
   guard, Glow/sun и clean-floor там, где соответствующий consumer ранее
   учитывал independent bodies. Он не добавляется в `roomGeom` и room area.
7. Coincident component не вычитается по `evenodd` из primary body. Renderer
   получает отдельные path fragments/groups либо эквивалентный non-cancelling
   representation; простая конкатенация противоположно ориентированных rings
   в один evenodd path запрещена.
8. Component order и итоговое множество не зависят от порядка partitions,
   drafts, columns или room records.

## 6. Canonical consumers

Один structural result определяет:

- full card Plan и View/киоск;
- `houseplan-space-card` static render;
- hidden Iso footprint/wall faces;
- room inner contour, paper/floor footprint и displayed clean area;
- Glow barriers, source-inside-body guard и spill;
- солнечные препятствия;
- geometry preflight и model invariants.

Presentation может рисовать primary/isolated components разными `<path>`, но
ни один consumer не может молча отбросить isolated physical component, если
он способен принять component set. `roomGeom` намеренно остаётся только room
masonry, чтобы independent partitions/columns не меняли площадь комнаты.

## 7. Strict commit barrier

Pure `checkSpacePhysicalGeometry()` (имя не API) проверяет exact candidate одной
операции через ту же preparation и structural result, что renderer/#199.

В этой задаче аудитом покрываются все frontend операции, способные изменить:

- `rooms`, `walls`, `open_spans`;
- ordinary/hosted `openings` geometry/host;
- `partitions`, `room_drafts`, `wall_columns`.

Каждая такая операция должна пройти общую transaction boundary до записи.
Существующие config edits, не меняющие geometry (marker, colors, names), не
перепроверяют весь план и не блокируются из-за legacy degraded space.

Контракт boundary:

1. получает immutable before и exact after;
2. no-op не запускает WS/history;
3. `ok/not-applicable` разрешает существующий один atomic save;
4. `degraded-extra/failed-core/exception` откатывает in-memory candidate к
   before, делает 0 WS calls и 0 Undo entries;
5. показывает bounded RU/EN toast:
   `Изменение отменено: геометрию стен нельзя безопасно построить.` /
   `Change canceled: wall geometry could not be built safely.`;
6. stale fingerprint перед фактическим save требует повторной проверки exact
   current candidate; успешный результат другой ревизии не переиспользуется.

#277 использует этот barrier для Resize. Если последовательность реализации
временно требует локального adapter, перед merge #278 остаётся один exported
source of truth, а дублирующий adapter удаляется.

## 8. Optimize и recovery

- `checkOptimizeGeometry()` переиспользует общий strict result и не принимает
  `degraded-extra` как green.
- Действующий failure dialog #199 и zero-write behavior сохраняются.
- #276 может превратить exact redundant partition в valid candidate до
  preflight; после этого Optimize становится green и ремонтирует конкретный
  fixture.
- #278 не удаляет/перемещает пользовательские extras и не предлагает новый
  Repair UI.

## 9. Model invariants

`scripts/model-invariants.mjs` получает production structural check для каждого
пространства экспорта:

- `failed-core` и `degraded-extra` являются ошибкой с bounded reason/count;
- никакие title, ids, координаты или полное exception message не печатаются в
  публичный CI artifact без явного debug-флага;
- script возвращает non-zero на `33.json`-классе fixture;
- валидные empty/image-only/virtual-only spaces не становятся false positive;
- source preparation импортируется из общего pure module либо проверяется
  строгим parity guard; копия production условий в script запрещена.

## 10. В скоупе

- per-extra transactional union и isolated component representation;
- strict/render-safe typed structural result;
- parity full/static/iso/floor/Glow/sun consumers;
- reusable strict geometry transaction barrier и audit geometry writers;
- integration с #199 без ослабления preflight;
- production structural model invariant;
- анонимизированный minimized fixture из `33.json`;
- unit, production-bundle smoke, mutation, performance и targeted golden;
- RU/EN failure toast, docs/changelogs.

## 11. Не входит

- автоматическое удаление/rehost partition (#276);
- safe Resize eligibility/range (#277);
- замена `polyclip-ts`;
- оптимистичный raw-room-ring fallback при core failure;
- новая пользовательская recovery/repair панель;
- background write/migration при load/render;
- исправление произвольного invalid source polygon;
- публикация hidden Iso.

## 12. Архитектурный контракт

1. Общий typed result и per-extra isolation живут в canonical geometry modules,
   не в Lit render methods.
2. Existing `wallBodiesGeometry()` может получить совместимый richer result;
   callers мигрируют атомарно, без периода, когда часть видит isolated bodies,
   а часть нет.
3. Structural components immutable; caches keyed точным geometry fingerprint и
   не удерживают config/history.
4. `wallBodiesUnionPath()` больше не кодирует global success только наличием
   одной строки `d`; successful component set и successful-empty различаются.
5. Static и full render используют одну component-to-path projection.
6. Commit barrier вызывается до mutation visibility/save. Если старый handler
   мутирует config in place, adapter обязан восстановить before до toast и
   requestUpdate; предпочтителен candidate-first путь.

## 12.1. Риски и меры

| Риск | Мера |
|---|---|
| #276/#277 ещё проходят ревью, хотя §18 задаёт их раньше #278 | Параллельны только независимые ТЗ/review. Код строго последователен: #278 не переходит в S6, пока #276 и #277 не merged; перед началом ветка пересоздаётся/rebase от актуального `dev`. |
| Legacy plan навсегда остаётся `degraded-extra`, если не подходит под безопасный repair #276 | Render сохраняет стены, но strict geometry edits остаются заблокированы; user guide предлагает Optimize, затем export/bug report, без скрытого удаления данных. |
| Временный strict adapter #277 переживает merge и создаёт две расходящиеся проверки | #278 удаляет adapter в том же implementation commit; source guard/call-site inventory и mutant writer-bypass требуют один exported barrier. |
| Отдельный isolated path визуально вычитает coincident masonry из-за evenodd | Отдельные non-cancelling path fragments/groups, AC4 golden и permutation tests. |
| Renderer показывает extra, а Glow/sun/static его теряют | Typed component set является общим входом; consumer parity AC5 и code-review call table. |
| Полностью malformed extra нельзя даже представить отдельно и возникает локальная утечка света/стены | Только этот body получает bounded degraded reason; strict write запрещён, остальные стены сохраняются; invalid-extra negative fixture фиксирует известную локальную деградацию. |
| Generic barrier блокирует marker/color edit на старом degraded плане | Проверяются только geometry writers; AC8 call-count и non-geometry browser smoke. |
| In-place handler оставляет candidate после отказа | Immutable before + mandatory rollback before toast/requestUpdate, AC7/AC9 mutation. |
| Component-aware union замедляет каждый render | Existing structural cache, §13 valid/degraded budgets и bounded cache test. |
| Per-piece catch скрывает core structural failure и возвращает старый опасный raw-ring fallback | Typed `failed-core` остаётся fail-dark; #197/core regressions AC11 и global-catch mutant. |

## 13. Производительность

На валидном large-house fixture новый component-aware pass не более чем на 10%
и 20 ms p95 медленнее текущего wall geometry same-run baseline. Degraded fixture
завершается не более чем за 100 ms p95. Render cache сохраняет прежний bounded
lifecycle; strict commit check вызывается только при geometry commit, не на
pointermove/state tick. Model-invariants допускает линейный per-space pass.

## 14. Touch и accessibility

View/киоск touch release-blocking: fallback wall components pointer-transparent
и визуально совпадают с desktop. Rejected geometry gesture показывает toast,
не требует hover и не оставляет captured pointer. Plan editor остаётся
desktop-first; safety behavior обязательно для mouse/touch/pen.

## 15. Критерии приёмки

| AC | Критерий | Доказательство |
|---|---|---|
| AC1 | Анонимизированный fixture исходно даёт extra union failure при валидном core; новый result — `degraded-extra`, не global null. | Regression unit with failure proof. |
| AC2 | Exception/invalid result одного extra сохраняет primary и следующие extras; permutations дают то же component set. | Unit + property/permutation matrix. |
| AC3 | Invalid raw extra локально пропускается, count/reason bounded; core room failure остаётся `failed-core`. | Negative unit matrix. |
| AC4 | Coincident isolated component не вырезает primary path по evenodd и wall layer остаётся видимым в Plan/View. | Production-bundle smoke + golden. |
| AC5 | Full/static/hidden Iso/floor/paper/Glow/source guard/sun используют один component set; room area не включает extras. | Consumer parity tests + code review. |
| AC6 | Strict preflight принимает только `ok/not-applicable`; #199 остаётся red на degraded candidate и green после valid #276 reconciliation. | Unit + Optimize smoke. |
| AC7 | Каждая geometry writer surface из §7 проходит common barrier; forced degraded result даёт rollback, toast, 0 WS/Undo. | Call-site table + browser mutation smoke. |
| AC8 | Non-geometry config edit не запускает strict pass и не блокируется legacy degraded space. | Call-count unit/browser smoke. |
| AC9 | Stale candidate fingerprint rechecks; exception не оставляет in-memory partial state. | Controlled async unit + smoke. |
| AC10 | `model-invariants` красный на fixture и зелёный на valid/empty/image-only/virtual-only matrix. | CLI tests. |
| AC11 | Existing #197 junction isolation и core fail-dark regressions остаются зелёными; raw room fallback не возвращён. | Existing + focused unit. |
| AC12 | Mutation guards ловят global-catch regression, discarded isolated body, strict-accepts-degraded, writer-bypass и invariants-bypass. | Mutation gate, 1/1 each. |
| AC13 | Performance/cache budgets §13 выполняются. | Targeted benchmark + cache test. |
| AC14 | Typecheck, unit, build, targeted smokes зелёные; tracked bundles byte-identical. | Fast gates. |
| AC15 | RU/EN changelog и user/wall/architecture/testing/status docs актуальны. | Docs gate + review. |

## 16. План тестов

- минимизировать `33.json` до synthetic fixture без пользовательских строк;
- `test/wall-thickness.test.mjs`: core/extra isolation, invalid/permutations;
- новый pure transaction-barrier test и source/call-site inventory guard;
- `test/plan-geometry-preflight.test.mjs`: strict degraded classification;
- CLI fixture tests для `model-invariants`;
- `demo/smoke_wall_union_isolation.mjs`: production bundle Plan/View/static,
  failed geometry write, toast/zero-write и valid retry;
- targeted light/dark golden до/после local failure;
- mutation ids из AC12;
- valid/degraded large-house benchmark.

Полные golden/smoke/performance и Linux HA harness запускаются перед бетой.

## 17. Release-артефакты и rollback

Изменение пользовательское. Implementation commit имеет `User-Visible: yes` и
обновляет:

- `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md` со ссылкой #278;
- `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md` — safe rejection/recovery;
- `docs/WALL-THICKNESS.md`, `docs/ARCHITECTURE.md`, `docs/CANVAS.md`;
- `docs/TESTING.md`, `docs/STATUS.md` и model-invariants documentation;
- RU/EN i18n, tests/smoke/mutations/benchmark, reviewed golden candidates;
- tracked bundles и docs screenshot fingerprint при source diff.

Rollback — revert implementation commit. Persisted schema не меняется, поэтому
обратной миграции нет. После rollback affected legacy plans снова могут терять
весь wall layer, а geometry writers — сохранить unchecked candidate; release
rollback должен рекомендовать не редактировать геометрию до обновления.

## 18. Принятые технические предположения

1. Exact class/reason names не API; strict/render-safe semantics являются API
   внутри продукта.
2. Bounded toast §7 — минимальная обратная связь для редкого race/boolean
   failure; отдельный dialog и список объектов не нужны.
3. Internal diagnostic может считать failed extras, но production console не
   печатает пользовательские ids/coordinates и не спамит каждый render.
4. #276, затем #277, затем #278 — порядок merge. При интеграции #278 удаляет
   временный strict adapter #277, сохраняя его AC.
5. `degraded-extra` допустим только для чтения существующего config; ни Optimize,
   ни editor commit не считает его успешной моделью.
