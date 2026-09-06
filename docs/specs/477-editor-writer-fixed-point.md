# ТЗ #477 — fixed point оптимизатора после штатного редактирования

- **Issue:** https://github.com/Matysh/houseplan-card/issues/477
- **Тип / приоритет:** tech debt / P2
- **Трек:** полный — затрагиваются геометрические транзакции, Undo/Redo,
  ссылки на комнаты и performance-critical путь рисования стен
- **Оценка:** пользовательская ценность 6/10; ценность для разработки 9/10;
  сложность 7/10; риск 7/10
- **Связано:** #229, #248, #276, #282, #291, #296, #383, #461 и #478

## 1. Сценарий

Персона — администратор дома. Поверхности — desktop Plan editor и Background
editor. Администратор один раз приводит существующий план в порядок через
«Оптимизировать планы», а затем продолжает обычную работу: рисует и завершает
цепочки стен, удаляет или объединяет комнаты, меняет мебель и изображения.

После таких штатных операций повторный запуск Optimize не должен находить
работу, которую только что мог и должен был выполнить сам writer. Явная
maintenance остаётся нужна для старых/imported документов и для намеренных
repair-операций, которые меняют авторскую геометрию.

Touch-редакторы остаются best effort по `docs/TOUCH-SUPPORT.md`. View и kiosk не
получают новых жестов или визуальных состояний.

## 2. Что человек увидит до и после

**До:** завершённая прямая цепочка может оставлять несколько отдельных стен;
стена поверх границы комнаты может дожить до Optimize; после удаления или
объединения комнаты Optimize снимает устаревшую привязку устройства; Optimize
также слегка меняет размер и положение мебели после штатного плавного resize.

**После:** завершение цепочки сразу оставляет канонические стены, ссылки на
удалённую комнату обслуживаются той же командой, а разрешённый плавный transform
мебели и изображений Optimize не огрубляет. Кнопки, диалоги, подписи, внешний
вид и обычный порядок действий не меняются.

## 3. Проблема и уточнение после #478

`optimizePlans()` совмещает четыре разных класса работы:

1. миграции старых моделей и импортов;
2. lossless-нормализацию current model;
3. исправление осиротевших ссылок;
4. явные геометрические repairs вроде выпрямления почти-осевой старой стены.

Owner invariant для #477 относится ко второму и третьему классам, но только к
долгу, созданному current writers. В актуальном `dev` подтверждены три дыры:

- две коллинеарные части законченной wall-chain дают
  `partitionsMerged > 0`;
- положительная partition поверх masonry комнаты даёт
  `partitionsReconciled > 0`, а её проём может дать `openingsRehosted > 0`;
- Delete/Merge room оставляют `marker.room_id` удалённой комнаты, и следующий
  Optimize меняет config, снимая эту ссылку.

#478 уже удалил persisted `room_drafts`, перевёл каждый принятый отрезок в
обычную partition и поглощает совпадающие carriers при принятии комнаты. В #477
не входят `room_drafts`, их migration, `redundantDraftsRemoved` и повторная
реализация room-acceptance transaction.

Отдельно #383 установил намеренно непрерывный resize мебели и custom images.
Текущий `alignAllToGrid()` ошибочно считает полученный transform старым
off-grid долгом и двигает его. Возвращать ступенчатый resize нельзя: надо
уточнить, какие поля вообще принадлежат grid contract.

## 4. Нормативный инвариант

Пусть `P` — current-model документ, для которого `optimizePlans(P).changed ===
false`, а `W` — одна завершённая штатная редакторская операция текущей версии.
Тогда:

```text
optimizePlans(W(P)).changed === false
```

Инвариант проверяется на canonical config и layout после общей storage
canonicalization, с тем же owner roster/reference context, который production
передаёт Optimize.

### 4.1 Что считается завершённой операцией

- принятый обычный commit Plan/Background editor;
- явное завершение wall-chain через `Esc`, Reset текущей цепочки, смену
  инструмента, режима или пространства, уход с route карточки;
- подтверждённое «оставить стенами» после отказа от всех предложенных rooms;
- Undo или Redo уже завершённой команды.

Один сохранённый terminal segment при ещё активной wall-chain — промежуточное
состояние одной session transaction. Оно сохраняется crash-safe по #478, но до
явного завершения цепочки не обязано быть fixed point. Same-route warm remount
может продолжить эту session. Hard crash/принудительное убийство страницы
считается аварийным прерыванием: данные не теряются, но lossless-швы могут ждать
следующего завершения цепочки или явного Optimize.

### 4.2 Что не входит в инвариант

- input старой модели, import/restore и документы, отредактированные старым
  frontend;
- `wallsStraightened` и `wallsStraightenSkipped`: почти-осевая legacy-стена не
  меняется молча;
- осознанно сохранённые ambiguity/fail-closed случаи, которые Optimize также
  не имеет права чинить;
- временный preview, pointermove, незавершённый drag/dialog и отклонённый write;
- layout room-label `rl_<roomId>`: Optimize текущей версии не удаляет такую
  запись при живом пространстве, а её отдельная config+layout transaction не
  нужна для доказательства #477.

## 5. Scope

### 5.1 Входит

1. Pure lossless finalizer partitions для одного пространства и набора seed
   IDs завершённой цепочки.
2. Fixed-point merge коллинеарных частей одинаковой толщины без удаления
   значимых junctions, с rehost проёмов и сохранением legacy projection.
3. Safe reconciliation положительных частей законченной цепочки, полностью или
   частично совпадающих с room masonry, с сохранением residuals, толщины и
   проёмов.
4. Один finish barrier для всех штатных выходов из wall-chain, включая ветку
   «не создавать ни одну предложенную комнату».
5. History-aware применение той же нормализации при Undo/Redo законченных
   wall-chain commands без отдельного невидимого шага Undo.
6. Детерминированный rewrite room references при Delete/Merge room:
   `marker.room_id` и значения `marker.vacuum.segment_map`.
7. Включение изменённых room references в rollback и Undo/Redo соответствующей
   room-команды.
8. Исключение полного transform `furniture` и `image` из grid alignment при
   сохранении числовой storage canonicalization и всех других align-правил.
9. Исполняемая матрица current writers → Optimize result, regression/mutation
   witnesses и performance witness для terminal-click пути #461.
10. Обновление архитектурной и пользовательской документации.

### 5.2 Не входит

- новая кнопка Finish, новые настройки, toast или тексты;
- изменение рендера, толщины, света, площади либо hit testing;
- изменение face detection и выбора/порядка предложенных комнат;
- автоматическое создание/разделение HA Area;
- изменение миграции v9→v10 или возврат `room_drafts`;
- merge partitions всего пространства на каждом клике;
- автоматическое выпрямление почти-осевых стен;
- удаление room-label layout, remap произвольных future fields или общий redesign
  reference model;
- исправление старого/imported долга молча при открытии View;
- изменение непрерывного resize/rotation мебели и custom images.

## 6. Контракт завершения wall-chain

### 6.1 Seed-bounded merge

Finalizer получает current config, `spaceId` и IDs сохранённых partitions
активной цепочки. Он работает на clone и сначала вызывает действующие правила
`mergeCollinearPartitions` с seed scope:

- рассматривается только связный merge-компонент, к которому относится хотя бы
  один seed;
- одинаковая `cm`, collinearity/join epsilons, room side, третья partition и
  column junction сохраняют контракт #229;
- survivor ID выбирается детерминированно действующим алгоритмом;
- все opening hosts и `x/y/angle` legacy projection обновляются через общий
  helper;
- merge выполняется до fixed point, а не одним проходом.

Unrelated partitions нельзя переписывать «заодно»: на исходно оптимизированном
плане у них нет долга, а bounded scope нужен для предсказуемой цены.

### 6.2 Seed-bounded reconciliation

После merge finalizer определяет surviving partitions, происходящие от seed,
и применяет к ним доказательство #276:

- только положительная `cm > 0`, как в обычном Optimize; нулевая стена поверх
  room wall в этом issue не поглощается;
- только точное безопасное совпадение с `outer`/`shared` masonry interval;
- частичное совпадение оставляет детерминированные residual partitions;
- неизвестные поля, неоднозначная геометрия, column conflict, orphan host и
  overlap проёмов остаются fail-closed без частичной записи;
- проёмы rehost-ятся на канонический wall/residual с сохранением абсолютного
  центра, длины, типа, binding/flip/future fields и legacy projection;
- room wall получает итоговую толщину по уже принятому контракту #276.

API reconciliation получает необязательный фильтр IDs; отсутствие фильтра
сохраняет full-space семантику Optimize и room acceptance #478.

### 6.3 Atomic adoption

Finalizer не мутирует live config до полного успеха. Candidate проходит:

1. current wall model commit/identity barrier #282;
2. strict physical geometry check;
3. сравнение junction limits с состоянием до lossless-нормализации;
4. off-grid non-growth guard;
5. canonical storage boundary.

Только затем candidate принимается целиком, обновляются caches и fingerprint
pending physical write, и ставится один save. При отказе исходный config,
session chain и уже видимый план остаются byte-equivalent; переход, который
требовал finish, не продолжается, а используется существующее сообщение
безопасного отказа. Частично merged/rehosted состояние недопустимо.

Finish не создаёт отдельной history command: пользователь рисовал стены, а не
запускал скрытую команду «склеить записи».

### 6.4 Все владельцы завершения

Один общий finish вызывается при:

- `Esc`;
- Reset в context tray;
- смене plan tool;
- переходе Plan → View/Devices/Background;
- смене space через вкладку, swipe или hash/deep-link;
- route departure;
- завершении wall-face batch без принятой комнаты.

Pointer cancel, pinch и второй touch сами по себе не заканчивают и не коммитят
цепочку. Room dialog Cancel возвращает active chain и нормализует её только при
последующем явном finish.

## 7. Undo/Redo и write rollback

Каждый terminal segment сохраняет прежнюю отдельную history command, чтобы
`Ctrl/Cmd+Z` во время активной цепочки удалял ровно последнюю точку. Session
state хранит IDs и остаётся ненормализованным до finish.

History snapshots wall-chain получают session-only metadata с seed IDs. Пока
та же chain активна, `_applyGeometryState` применяет snapshot буквально. После
finish обычный Undo/Redo перед adoption прогоняет lossless finalizer на snapshot:

- Undo последнего segment возвращает канонический результат предыдущего числа
  сегментов;
- Redo возвращает канонический результат следующего числа сегментов;
- промежуточные швы и совпадающие carriers не возвращаются в durable config;
- IDs surviving wall/opening hosts детерминированы;
- history не получает дополнительный шаг и не очищается при успешном finish.

Отказ backend write восстанавливает общий pre-chain `before`, очищает
несовместимую history и перечитывает authoritative config по существующему
контракту #314. Finish, успевший пройти локально, не должен мешать этому
rollback.

## 8. Room reference transaction

### 8.1 Delete room

До геометрической мутации writer получает snapshot только тех marker records,
которые ссылаются на удаляемый room ID. В том же config candidate:

- у любого `marker.room_id === deletedId` поле удаляется; `marker.space`,
  binding, position, hidden/removed и остальные поля сохраняются;
- из `marker.vacuum.segment_map` удаляются только пары, значение которых равно
  `deletedId`; пустой map канонически удаляется вместе с пустым vacuum wrapper
  только если в wrapper нет других полей;
- ссылки сканируются во всех markers: room IDs глобально уникальны, а vacuum с
  dock на другом этаже может ссылаться на карту/комнату этого пространства.

### 8.2 Merge rooms

Если `dropId` поглощается `keepId`:

- `marker.room_id === dropId` становится `keepId`;
- каждое значение `dropId` в `vacuum.segment_map` становится `keepId`;
- уже существующие ссылки на `keepId` не меняются;
- выбор сохраняемой комнаты в существующем диалоге остаётся единственным
  источником `keepId`.

### 8.3 History and rollback

`SpaceGeometryState` не начинает безусловно копировать все markers для каждой
команды. Только Delete/Merge room прикрепляет optional reference snapshot с
точными marker IDs и прежними room-related полями. `_recordGeometry` делает
симметричный `after` snapshot, `_restoreGeometryState*` восстанавливает его
вместе с геометрией.

Поэтому Undo/Redo и synchronous/async rollback возвращают геометрию и ссылки
одной логической операцией. Не связанные marker mutations не переписываются.
Layout `rl_<roomId>` остаётся как сейчас и не входит в snapshot.

## 9. Grid contract для свободных transforms

`alignAllToGrid()` продолжает обрабатывать:

- комнаты и независимые стены;
- columns;
- обычный decor `line`, `rect`, `ellipse`, `text`;
- openings;
- device positions и room-label positions.

Для decor `kind: furniture` и `kind: image` функция:

- сохраняет `x`, `y`, `w`, `h`, `angle`, flip flags и unknown fields
  byte-equivalent;
- не увеличивает `moved`, `coordsCanonicalized`, `total`, `maxShift*` из-за их
  transform;
- не мешает общей storage canonicalization округлить бинарный числовой шум по
  общему формату записи.

Это соответствует #383: placement/move остаются grid/magnet-bound writers, но
плавный resize законно меняет и размер, и top-left относительно фиксированного
угла. Источник этих координат после сохранения неразличим, поэтому exemption
касается всего transform двух типов, включая legacy экземпляры.

## 10. Writer inventory и фиксированная матрица

В репозитории появляется machine-readable/исполняемая таблица. Каждый ряд
начинается с уже оптимизированной current-v10 fixture, применяет production
helper либо browser smoke action и затем вызывает настоящий `optimizePlans()`.

Минимальная матрица:

| Writer / lifecycle | Ожидаемый Optimize |
|---|---|
| terminal append при активной chain | промежуточное исключение; data сохранены |
| finish 2–3 collinear segments | `changed:false`, merge уже выполнен |
| finish chain, продолженной из существующей partition | `changed:false`, survivor/host стабильны |
| finish positive partition поверх outer/shared room wall | `changed:false`, reconcile/rehost уже выполнены |
| ambiguous/unsafe coincidence | `changed:false`, оба writer и Optimize одинаково fail-closed |
| room-face acceptance | `changed:false` — защита результата #478 |
| Delete room с direct/vacuum refs | `changed:false`, refs сняты; Undo/Redo также false |
| Merge rooms с direct/vacuum refs | `changed:false`, refs указывают на keep; Undo/Redo также false |
| Resize, wall thickness, opening add/move/delete, partition/column edit/move/delete/rotate | `changed:false` |
| ordinary decor add/move/edit/delete | `changed:false` |
| continuous furniture/image resize и rotation | `changed:false`, transform не изменён |
| layout marker/room-label move | `changed:false` после writer snapping/canonicalization |

Для строк, где реальный UI writer нельзя вызвать без browser runtime, smoke
обязан вызывать тот же production entry point, а не пересказывать его логику в
test-only surrogate. Матрица может быть разбита на unit и smoke, но один список
case IDs служит coverage manifest; неизвестный новый structural writer должен
требовать явного добавления/исключения.

## 11. Производительность

Terminal click остаётся latency-critical:

- `commitWallChainSegmentGeometry()` не вызывает merge/reconcile/full-space
  Optimize;
- существующий `benchmark:wall-draw-click` сохраняет structural contract:
  один local physical check, один junction pass, одна config write и одна
  history command на клик, без full-space physical checks и generic fallback;
- budgets #461 не ослабляются: median ≤150 ms, max ≤250 ms, remote median ≤
  `base × 1.5 + 20 ms` на действующей fixture;
- finish измеряется отдельно после семи segments: ровно один bounded
  merge/reconcile barrier и не более одной дополнительной config write;
- удвоение unrelated rooms/partitions не должно более чем в 1.5 раза увеличивать
  median finish seeded-chain на общей benchmark fixture плюс 20 ms noise;
- существующие Optimize/coincident/wall-model budgets остаются зелёными.

Если seeded reconciliation невозможно доказать без full-space sweep, задача
возвращается в `S3-spec`; нельзя тихо платить эту цену на каждом клике.

## 12. Совместимость, миграция и безопасность

- persisted schema и `model_version` не меняются;
- новых config/layout полей нет; history metadata session-only;
- неизвестные поля partitions, openings, rooms, markers и vacuum wrapper
  сохраняются;
- старые планы не переписываются при View/load; explicit Optimize остаётся
  единственным общим maintenance действием;
- current writer не расширяет права: всё остаётся за `_canCommitSpace`, admin
  guard и revisioned config write;
- никакие HA service calls не добавляются;
- reference rewrite меняет только exact room IDs выбранной Delete/Merge;
- fail-closed geometry и rollback #282/#314 не ослабляются.

## 13. UX и i18n

Новых элементов UI и новых строк нет. Действующие history labels, toasts и
confirmation dialogs сохраняются. Optimize может реже показывать подтверждение,
потому что current writers больше не оставляют перечисленный долг.

i18n: новых ключей нет; словари `en`, `ru`, `de` не меняются.

## 14. Критерии приёмки

- **AC1 — finished chain fixed point (unit + smoke).** Две/три коллинеарные
  части и продолжение существующей partition после каждого способа finish дают
  одну каноническую стену; `optimizePlans(...).changed === false`.
- **AC2 — coincident chain fixed point (unit + smoke).** Safe positive overlap
  с outer/shared masonry поглощён, residuals/толщина сохранены, opening rehost
  сохраняет абсолютную геометрию; следующий Optimize — no-op.
- **AC3 — fail-closed atomicity (unit + mutation).** Ambiguous overlap, unknown
  partition field, column conflict, invalid/orphan/overlapping openings и
  physical/junction rejection не дают частичной mutation/save/navigation.
- **AC4 — history continuity (unit + smoke + mutation).** Active-chain one-point
  Undo остаётся прежним; после finish Undo/Redo проходит канонические snapshots,
  не добавляет скрытого history шага и не возвращает optimizer debt.
- **AC5 — all finish owners (source contract + smoke).** Esc, Reset, tool/mode/
  space/route transition и rejected room batch проходят один общий finalizer;
  pointer cancel/pinch/second touch его не вызывают.
- **AC6 — room reference transaction (unit + smoke + mutation).** Delete снимает,
  Merge remap-ит direct и vacuum refs; unknown fields/space/layout сохраняются;
  Undo/Redo и rejected write возвращают exact before/after вместе с геометрией.
- **AC7 — continuous transforms stay canonical (unit + smoke + mutation).**
  Furniture/image после свободного resize/rotation byte-equivalent до/после
  Optimize и не учитываются align report; остальные align categories по-прежнему
  притягиваются к сетке.
- **AC8 — writer coverage manifest (unit + source contract).** Все current
  structural/layout writer entry points перечислены, каждый имеет fixed-point
  witness либо документированное промежуточное/legacy исключение; добавление
  writer без строки краснит тест.
- **AC9 — performance (browser benchmark).** Terminal-click structural counters
  и бюджеты #461 не ухудшены; finish выполняет одну bounded transaction и
  проходит отдельный seeded-scaling budget из §11.
- **AC10 — compatibility/docs (unit + docs gate + review).** Schema/model version,
  View/kiosk/touch contract и UI/i18n не изменены; USER-GUIDE, CANVAS,
  ARCHITECTURE и STATUS описывают новый writer invariant и furniture exemption.

## 15. План тестов и обязательные негативные свидетели

1. `test/writer-fixed-point.test.mjs`: pure finalizer, room refs и Optimize
   oracle для AC1/2/3/6/7.
2. `test/align-grid.test.mjs`: furniture/image exemption и контрольный ordinary
   decor, который обязан продолжать двигаться.
3. `test/command-stack.test.mjs` либо runtime-focused test: tagged snapshots,
   active vs finished chain, no extra command.
4. `test/draft-live-commit.test.mjs`: terminal click не вызывает finalizer.
5. `demo/smoke_edit_walk.mjs` или отдельный deterministic browser smoke:
   production finish owners, Delete/Merge + Undo/Redo, Optimize no-op.
6. `demo/benchmark_wall_draw_click.mjs`: прежние budgets и новые terminal
   structural counters; отдельный finish/scaling measurement.
7. `scripts/mutation-gate.mjs`:
   - отключить вызов finalizer у одного finish owner → AC5 красный;
   - снять candidate-before-adopt guard → AC3 красный;
   - не normalise tagged history restore → AC4 красный;
   - не rewrite `room_id`/`segment_map` → AC6 красный;
   - вернуть furniture/image в align loop → AC7 красный;
   - вызвать reconcile из terminal click → AC9 structural witness красный.

На S7 ревьюер заполняет таблицу «AC · чем доказан · чем краснеет» по §2.7
`PROCESS.md`. Положительный прогон без названной отрицательной мутации не
закрывает защитный AC.

## 16. Риски

1. **History IDs расходятся после merge.** Снижается tagged snapshots и
   нормализацией только после окончания session chain.
2. **Rehost сдвигает проём или legacy projection.** Снижается общим helper #229/
   #276 и абсолютными geometry assertions.
3. **Finish тормозит большой план.** Снижается seed scope, отдельным benchmark и
   запретом работы на terminal click.
4. **Reference Undo перезаписывает чужую правку marker.** Снижается точечным
   optional snapshot и действующим очищением history после внешнего config
   revision.
5. **Furniture exemption сохраняет старый off-grid transform.** Это намеренная
   цена совместимости #383: без provenance нельзя отличить legacy transform от
   легального continuous resize; пользовательская геометрия важнее скрытого
   выравнивания.
6. **Fail-closed finish блокирует навигацию.** Это действующая safety semantics;
   тест обязан доказать отсутствие частичной записи и понятный existing toast.

## 17. Откат

Feature flag не нужен: поведение восстанавливает инвариант без нового режима.
Откат — revert продуктового коммита целиком:

- schema/data version не требуют downgrade;
- сохранённые merged/reconciled partitions совместимы с предыдущей current
  версией;
- remapped/cleared room refs совместимы и восстанавливаются из обычного backup;
- furniture/image transforms не переписываются при внедрении, поэтому revert
  только вернёт старое поведение следующего Optimize.

## 18. Release-артефакты

Поведение заметно пользователю, поэтому в том же продуктовом коммите нужны:

- короткие RU/EN changelog bullets со ссылкой на #477: законченные стены больше
  не требуют повторной Optimize; Optimize не двигает плавно изменённую мебель;
- `docs/USER-GUIDE.md`: завершение wall-chain и Optimize;
- `docs/CANVAS.md`: grid contract и furniture/image exemption;
- `docs/ARCHITECTURE.md`: writer fixed-point barrier, history/reference scope;
- `docs/STATUS.md`: текущее состояние;
- обновление `docs/specs/README.md`.

Golden/screenshots не требуются: визуальный результат должен остаться тем же,
кроме отсутствия нежелательного сдвига после Optimize. Security report не
требуется. Performance artifact обязателен только для изменённого wall-chain
finish/terminal-click профиля и перечислен в §11/§15.

## 19. Принято предположительно, поменять свободно на ревью ТЗ

1. Seed-filter добавляется в общий reconciliation helper как optional параметр;
   вызовы Optimize и #478 без фильтра остаются byte-equivalent.
2. History tagging — session-only поле snapshot, а не новая persisted модель.
3. Room reference rewrite вынесен в pure helper; layout room labels намеренно
   остаются вне этой транзакции.
4. Exact набор файлов может измениться после декомпозиции, но предполагается:
   `src/houseplan-editor-runtime.ts`, `src/wall-merge.ts`,
   `src/coincident-partitions.ts`, новый pure helper fixed-point/reference,
   `src/align-grid.ts`, соответствующие tests/demo scripts и документы §18.
