# CODE-REVIEW-228-r3

- Issue: [#228](https://github.com/Matysh/houseplan-card/issues/228) — надёжное рисование стен и операции с готовым контуром
- ТЗ: `docs/specs/228-plan-drawing-problems.md` (ревью ТЗ зелёное, r1, #228)
- Ветка: `issue/228-plan-drawing-problems`
- Коммит на момент этого захода: `55d5a56` (HEAD; продуктовые коммиты в диапазоне — `2f96899` "fix: make plan drawing fail closed", `691cea0` "fix: close plan repair review findings")
- Заход ревью: r3 · блокирующих циклов израсходовано 1 из 4 (r1 был жёлтым и списал единицу; r2 был зелёным и бюджет не потратил, #227)
- Ревьюер: Claude (код-ревью), сессия без контекста реализации и без контекста r1/r2-ревью

## 0. Предыдущий раунд, SHA и причина полного разбора

Вердикт r2 найден в комментарии issue
([issuecomment-5379111358](https://github.com/Matysh/houseplan-card/issues/228#issuecomment-5379111358)):
зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0, на SHA `172d5d7`
(явно назван в шапке `docs/reviews/CODE-REVIEW-228-r2.md`). Готово к очереди на
пре-релиз.

Сразу после зелёного r2 слияние в `dev` не удалось: ветка `issue/228-plan-drawing-problems`
конфликтовала с `dev`, куда параллельно вошла работа по #233 («measure resize
labels between wall faces», коммиты `abfaae3`/`bff47f5`/…/`66ffd6f`). Задача ушла
в `S6-in-progress` не на правку кода, а на ребейз (комментарий
[issuecomment-5379112319](https://github.com/Matysh/houseplan-card/issues/228#issuecomment-5379112319)).
Автор перебазировал ветку на актуальный `origin/dev` (`66ffd6f`), вручную
объединив RU/EN changelog и пересобрав три копии бандла; продуктовый TypeScript
слился автоматически без конфликтов (комментарий
[issuecomment-5379127615](https://github.com/Matysh/houseplan-card/issues/228#issuecomment-5379127615)).
Автоматический прогон ревью после этого не отработал ([упавший workflow run](https://github.com/Matysh/houseplan-card/actions/runs/32561004646));
метка осталась на месте, что по §10.4 AGENTS.md означает сбой самого прогона, а
не вердикт — правки в задаче нет, ревью просто не состоялось. Этот заход и есть
тот прогон.

`git rev-parse HEAD` = `55d5a560adfc1da92f774b4073cbd37065de4f66`,
`git merge-base HEAD origin/dev` = `66ffd6fdda347a005993a8d396ee61c14ccc3adc` = `origin/dev` —
то есть ветка полностью содержит текущий `dev`. Старые SHA `2aaef12`/`172d5d7`
после ребейза недостижимы (переписаны, как и ожидается от `git rebase`).

**Это ребейз на ушедший вперёд `dev` — по прямому указанию задачи разбор в этом
заходе полный (`git diff origin/dev...HEAD`), а не по дельте r2→r3**: после
ребейза это, формально, другой код (§7.2 AGENTS.md), и есть конкретный риск —
и #228, и #233 правят один и тот же файл `src/houseplan-card.ts` (#233
затрагивает секцию «room resize tool» вокруг `_rszInnerSpanCms`, #228 — секции
Walls/room-markup/room-deletion/wall-thickness), поэтому нужно было убедиться,
что автослияние не потеряло и не задвоило код ни одной из задач.

## 1. Скоуп проверки — полный диапазон

`git log --oneline origin/dev..HEAD`: 6 коммитов — `e44b3c9` (ТЗ), `9a131cc`
(SPEC-REVIEW r1), `2f96899` (реализация r1, бывший `2aaef12`), `8fc3ec7`
(CODE-REVIEW r1), `691cea0` (фикс r2, бывший `172d5d7`), `55d5a56`
(CODE-REVIEW r2). Трейлеры на обоих продуктовых коммитах корректны: `Issue: #228`,
`User-Visible: yes`, оба меняют `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в том
же коммите.

`git diff origin/dev...HEAD --stat`: 33 файла, +3190/−356. Продуктовый код —
`src/houseplan-card.ts` (+396/−54 фактически, часть строк — импорты/поля),
`src/plan-snap-overlay.ts` (+178/−26 с учётом рефакторинга `resolvePlanSnap` в
`resolvePlanSnapResult`), новые `src/wall-face-repair.ts` (+165),
`src/room-deletion.ts` (+122), расширение `src/wall-face-graph.ts` (+36),
`src/logic.ts` (+12, `isExact45Vector`), `src/styles.ts` (+27). Тесты — четыре
файла (+166 суммарно), новый smoke `demo/smoke_plan_drawing_repairs.mjs`
(172 строки) плюс точечная правка `demo/smoke_unified_wall_tool.mjs`. Семь
файлов документации, RU/EN i18n, три синхронные копии бандла, `tsconfig.test.json`.

Прочитаны перед разбором: `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md`, тело issue
#228 и все 13 комментариев (аналитика → продуктовые вопросы → решения
владельца → «ТЗ готово» → зелёное ревью ТЗ → «Взял» → хендофф r1 → жёлтый r1 →
хендофф фикса → зелёный r2 → неудавшееся слияние/ребейз → хендофф ребейза →
сбой автопрогона), полный текст `docs/specs/228-plan-drawing-problems.md` (все
17 AC), оба предыдущих документа код-ревью (`CODE-REVIEW-228-r1.md`,
`CODE-REVIEW-228-r2.md`), затронутые канонические документы (`CANVAS.md`,
`ARCHITECTURE.md`, `WALL-THICKNESS.md`, `TOUCH-SUPPORT.md`, `USER-GUIDE.ru.md`),
а также коммиты #233 (`abfaae3` и соседние) — чтобы понять зону пересечения
файлов при автослиянии.

## 2. Как проверялось — гейты

Объём гейтов соразмерен задаче (§8 PROCESS.md): дешёвые прогнаны полностью, из
тяжёлых прогнаны именно те, что закрывают риск ребейза (пересечение с #233) и
названы в АС; остальные — предрелизный гейт.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | `# tests 1036 / # pass 1036 / # fail 0` (совпадает с `npm run inventory`: Node unit 1036) |
| Build | `npm run build` | зелёный, `dist/houseplan-card.js` собран за ~12s |
| Синхронность бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp … demo/srv/assets/houseplan-card.js` | обе копии побайтно идентичны; `git status` после сборки чист (рабочее дерево не отличается от коммита — ребейзный бандл собран верно, не просто скопирован вручную) |
| Named smoke (АС #228) | `node demo/smoke_plan_snap_overlay.mjs` | 34/34 `true`, `OK` |
| Named smoke (АС #228) | `node demo/smoke_unified_wall_tool.mjs` | 19/19 `true`, `OK` |
| Named smoke (АС #228) | `node demo/smoke_plan_drawing_repairs.mjs` | 16/16 `true`, `OK` (включая `hostedOpeningBlocksRepair` и `ambiguousLargeGapUsesWallsFlow` — оба фикса r1/r2 продолжают проходить после ребейза) |
| Smoke пересекающейся задачи (риск ребейза) | `node demo/smoke_resize_inner_dimensions.mjs` | `OK` — #233 использует тот же `src/houseplan-card.ts`; зелёный прогон подтверждает, что автослияние не задело код измерения resize-подписей |

**Чего не прогонял и почему:**

- `npm run golden:verify` — diff не меняет ни один *существующий* видимый кадр:
  новые визуальные элементы (`.active-axis`, `.active-vertex`,
  `.wall-repair-preview`, `.plan-snap-node.conflict`, `hp-dialog` удаления
  комнаты) рендерятся только при активном инструменте/диалоге, что подтверждает
  `viewHasNoEditorRepairChrome` в смоке. Полная golden-матрица (включая
  forced-colors для нового `.conflict`-состояния, см. §6) — предрелизный гейт
  (§14.3 ТЗ, §8 PROCESS.md), не гейт код-ревью; это же решение принято в r1/r2
  и дельта его не меняет.
- `python -m pytest tests_backend` — ни один `.py`-файл не тронут ни в диапазоне
  #228, ни в объединяющем ребейзе; ТЗ §16 прямо фиксирует отсутствие
  backend/schema изменений, подтверждено `git diff --name-only`.
- Полный smoke-набор (163 файла по `npm run inventory`) и performance-профили —
  задача не задевает все поверхности; названные в АС и связанные с диапазоном
  ребейза (`smoke_resize_inner_dimensions`) прогнаны выше. Предрелизный гейт по
  действующему решению владельца (§8, §11.4 AGENTS.md).

## 3. Ребейз: что именно проверено дополнительно к r1/r2

Поскольку разбор полный, ниже — не пересказ r1/r2, а свежая проверка того, что
могло сломаться именно ребейзом (автослияние `.ts`, ручное слияние changelog,
пересборка бандла), плюс сквозное чтение всего diff'а заново.

1. **Пересечение файлов с #233.** `git diff` #233 (`abfaae3`) правит
   `src/houseplan-card.ts` только вокруг `_rszInnerSpanCms`/`_rszScaleLabels`
   (секция «room resize tool», строки ~8248–8340 до ребейза) и новый
   `src/wall-thickness.ts`. Диапазоны, которые правит #228 в `houseplan-card.ts`
   (импорты, `_deleteRoomClick`/`_confirmRoomDelete` в районе строки 11053,
   `_validateWallRepair`/`_applyWallRepair` в районе 12704–12780, рендер в
   районе 16780/18840/19078) не пересекаются со строками #233. Это подтверждает,
   почему TypeScript-слияние прошло автоматически без конфликта, а не просто
   «повезло»: зоны правок дизъюнктны.
2. **Отсутствие маркеров незакрытого конфликта.** `grep -n "<<<<<<<\|=======\|>>>>>>>"` по
   всем изменённым `.ts`-файлам (`houseplan-card.ts`, `wall-thickness.ts`,
   `wall-face-graph.ts`, `wall-face-repair.ts`, `room-deletion.ts`,
   `plan-snap-overlay.ts`, `logic.ts`, `styles.ts`) — 0 совпадений (найденные
   строки `=================` — это секционные комментарии-разделители кода, не
   следы конфликта).
3. **M1/M2 из r1, закрытые в r2, физически присутствуют после ребейза.**
   `grep`: `repairMovesHostedPartition` определена в
   `src/wall-face-repair.ts:34-42`, используется в `_validateWallRepair`
   (`src/houseplan-card.ts:12717-12719`), покрыта в
   `test/wall-face-repair.test.mjs`. Условие M2
   (`diagnostic.kind === 'repair'`, а не `!== 'none'`) стоит на
   `src/houseplan-card.ts:7685` внутри `_offerExistingWallFace`
   (:7656–7695) — единственная ветка широкой (>2 см) диагностики, `ambiguous`
   больше не перехватывает клик.
4. **Ручное слияние changelog не задвоило и не потеряло записи.**
   `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` содержат отдельными абзацами и
   #228, и #233 (плюс #234, #230 из более раннего `dev`), без дублирования
   текста и без обрыва предложений — прочитаны оба файла целиком.
5. **Бандл собран, а не просто перенесён.** Свежий `npm run build` после
   ребейза даёт файл, побайтно совпадающий с уже закоммиченными тремя копиями
   (§2), и `git status` после сборки чист — то есть коммит `691cea0` содержит
   именно результат сборки текущего исходника, а не бандл, оставшийся от
   до-ребейзного состояния.

Все пять пунктов подтверждают: ребейз чисто механический, продуктовое поведение
#228 не изменилось относительно уже дважды проверенного r1→r2 кода, и он не
повредил параллельно вошедшую работу #233.

## 4. Разбор по AC (полный, не только дельта ребейза)

- **AC1** (активная ось/узел) — `.active-axis`/`.active-vertex`
  (`src/houseplan-card.ts:19012-19024`) рендерятся из `this._cursorPt` поверх
  толстого preview, узел скрывается, когда есть активный snap-candidate или
  конфликт (`!this._activePlanSnapCandidate && !this._activePlanSnapConflicts.length`) —
  не дублирует существующий маркер. `smoke: activeSegmentShowsAxisAndNode`
  зелёный. Проверено автотестом и чтением.
- **AC2** (неоднозначные endpoints) — `endpointResolution()`
  (`src/plan-snap-overlay.ts:296-321`) даёt `ambiguous`, когда ≥2 разных ключа
  оказались внутри `distinguishTolerance`; click-путь
  (`_markupClick`, `houseplan-card.ts:7286-7295`) на `resolved.ambiguous`
  показывает toast и `return` без записи точки/истории/конфига.
  `test/plan-snap-overlay.test.mjs` и `smoke: closeEndpointsFailClosed`
  зелёные. Проверено автотестом.
- **AC3** (strict Shift) — `resolveStrictPlanSnap`
  (`src/plan-snap-overlay.ts:324-378`) проецирует на луч, кратный 45° от
  `anchor`, для endpoint и line/segment intersection через параметрическое
  уравнение; non-Shift путь (`resolvePlanSnapResult`) не меняет прежнее
  поведение кроме ambiguity guard. Unit + `smoke:
  strictShiftUsesExactRayIntersection` зелёные.
- **AC4** (угловая подпись) — `isExact45Vector`
  (`src/logic.ts:1937-1946`) заменил `is45(deg, 0.5)`
  (`houseplan-card.ts:18127`), сравнивает `dx`/`dy` с эпсилон, а не округлённые
  градусы. `smoke: angleColourMatchesActualVector` явно проверяет 90,1° как
  красный.
- **AC5/AC8** (комната из готовой области) — `findWallFaceAtPoint`
  (`src/wall-face-graph.ts:571-591`) — point-in-polygon с исключением границы и
  выбором наименьшей площади при равенстве по `key`; вызывается из
  `_offerExistingWallFace` (`houseplan-card.ts:7656`) только при пустом `_path`,
  без Shift и без snap-candidate (условие на `houseplan-card.ts:7316`). Decline
  (Keep/Cancel) для одного `existing`/`repair`-кандидата — явный no-op
  (`houseplan-card.ts:12624-12631`, ничего не пишет в `sp`). Smoke:
  `existingFaceOffersRoom`, `keepExistingFaceIsNoop`,
  `shiftBypassesExistingFaceOffer`, `createExistingFaceKeepsPartitions` —
  зелёные.
- **AC6/AC7** (repair ≤2 см, атомарность, негативная матрица) —
  `planWallFaceRepair` (`src/wall-face-repair.ts:101-165`) — чистая функция,
  двигает только independent endpoint (`movable()` исключает
  `static:room|`), выбирает детерминированный mover по `stableEndpointMover`
  (grid-canonicality, затем геометрический tie-break, не record order).
  `_validateWallRepair` (`houseplan-card.ts:12704-12720`) ревалидирует
  source/target по актуальному графу и отклоняет repair, двигающий partition с
  hosted opening, через `repairMovesHostedPartition`. Негативная матрица (>2 см,
  two-gap→ambiguous, room-vertex immovable, hosted opening) покрыта unit-тестами
  в `test/wall-face-repair.test.mjs` и smoke-сценариями
  `hostedOpeningBlocksRepair`/`ambiguousLargeGapUsesWallsFlow`/
  `smallGapOffersRepair`. Обе находки r1 (M1/M2) остаются закрыты — см. §3.4.
- **AC9** (диалог удаления) — `_renderRoomDeleteDialog`
  (`houseplan-card.ts:19078-19100`) использует `<hp-dialog>` (не `confirm()`),
  primary «Delete room, keep walls», danger «Delete room and walls»,
  `@hp-close` на Cancel/X/Escape. `smoke: deleteUsesAccessibleChoiceDialog`
  подтверждает отсутствие `confirm` и наличие `hp-dialog`. `hp-dialog` — уже
  принятый переиспользуемый компонент (тот же, что и
  `_renderPartitionDeleteDialog`), его focus-trap/Escape-контракт вне diff'а —
  проверено чтением, не переисполнено отдельно (как и в r1).
- **AC10/AC11** (Keep/Delete walls) — `planRoomDeletion`
  (`src/room-deletion.ts:73-112`) — чистая функция: `exclusive` фильтрует
  `kind === 'outer' && !open && cm > 0` (позитивная толщина, не shared, не
  open span); `containsInterval` переиспользует совпадающую partition по
  углу+толщине+покрытию, не создавая дубликат. Openings с
  `host.kind === 'partition'` исключены из переассоциации заранее — уже
  привязанный проём никогда не становится «комнатным». Caller
  (`_confirmRoomDelete`, `houseplan-card.ts:11065-11123`) считает
  capacity (`MAX_PARTITIONS`) по **новым** (не reused) партициям **до**
  `_geometrySnapshot()`/мутации (`houseplan-card.ts:11089`) — fail-before-mutation
  соблюдён. Smoke `keepWallsMaterializesAndRehosts` /
  `deleteWallsCascadesExclusiveOpening` зелёные.
- **AC12** (один Undo/атомарность) — `_recordGeometry(...)` вызывается один раз
  в конце `_confirmRoomDelete` (после `_commitOpenSpans()`/нормализации стен) и
  один раз в конце `_applyWallFaceBatch`; в обоих путях `_validateWallRepair`/
  capacity-проверка выполняются до захвата `before`-снапшота. Проверено чтением
  (нет отдельного Undo/Redo unit-теста на этот путь, структура идентична уже
  принятому `_applyWallFaceBatch` из #173).
- **AC13** (существующие рендер-потребители) — `git diff --name-only` не
  содержит ни одного изо/sun/light-файла; новые SVG-элементы гейтятся текущим
  инструментом. `viewHasNoEditorRepairChrome` подтверждает отсутствие лишнего
  DOM в View.
- **AC14** (touch/gesture safety) — новых touch-путей нет;
  `_offerExistingWallFace` вызывается из того же `_markupClick`, что уже
  проходит через непереписанный suppressed-click/pointercancel guard.
  Проверено чтением, не исполнением (как и в r1 — отдельного targeted-смока на
  жест именно для existing-face/repair нет).
- **AC15** (perf) — `grep` подтверждает: `findWallFaceAtPoint`/
  `planWallFaceRepair` вызываются только из `_offerExistingWallFace` (idle
  click, `:7316`) и `_offerWallFaces` (после принятого сегмента, `:7588`); ни
  одного вызова из `_svgPointerMove`/hover-пути. Проверено чтением;
  performance-профиль — предрелизный гейт по ТЗ §14.3.
- **AC16** (backend/schema) — `custom_components/**/*.py` не тронут ни в
  диапазоне #228, ни объединяющим ребейзом; новых persisted-полей нет.
- **AC17** (гейты/i18n/changelog/документация) — таблица §2; en/ru ключи
  парные (`btn.delete_room_*`, `history.delete_room_*`,
  `confirm.delete_room_*`, `toast.plan_snap_ambiguous`,
  `toast.wall_repair_*`) — сверено `git diff` обоих `i18n/*.json` целиком, для
  каждого нового en-ключа найдена ru-пара и наоборот; оба changelog правлены в
  `User-Visible: yes` коммитах `2f96899`/`691cea0`; `docs/CANVAS.md`,
  `docs/ARCHITECTURE.md`, `docs/WALL-THICKNESS.md`, `docs/TOUCH-SUPPORT.md`,
  `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`, `docs/STATUS.md` обновлены и не
  противоречат коду ни в одном прочитанном месте.

## 5. Что проверено и корректно (сверх раздела 4)

- Ключи `static:*`/`active:*`/`static:draft|<id>:<index>` строятся в одном
  месте и корректно парсятся обратно в `_applyWallRepair`
  (`houseplan-card.ts:12724-12772`) для всех трёх веток (`active:`,
  `static:partition|`, `static:draft|`), включая сдвиг индекса `+1` для
  `endpoint === 'b'`. Не нашёл рассинхронизации.
- `stableEndpointMover`/`movable()` (`wall-face-repair.ts:44,68-81`) исключает
  пары, где обе стороны — room-vertex, и не даёт room-полигону становиться
  «двигателем» даже когда он геометрически удобнее.
- `repairMovesHostedPartition` вызывается на обоих путях подтверждения repair —
  `_applyWallRepair` (одиночный) и через `_validateWallRepair` внутри
  `_applyWallFaceBatch` (`houseplan-card.ts:12820-12823`, `repairs[0]`) — guard
  не обходится ни одним из них.
- Три копии бандла после чистой пересборки побайтно идентичны, рабочее дерево
  чисто после сборки — обязательное условие §8 AGENTS.md выполнено этим
  прогоном заново, на текущем (пост-ребейзном) SHA, а не унаследовано с r1/r2.
- `docs/reviews/CODE-REVIEW-228-r1.md` и `-r2.md` в дереве соответствуют
  описанным в них SHA (`2aaef12`→`2f96899`, `172d5d7`→`691cea0` после ребейза);
  их аналитика по неизменным файлам (snap-overlay, strict-Shift, delete-room
  dialog, room-deletion) остаётся применимой, что и подтверждено сквозным
  чтением в §4 этого документа заново, а не голой ссылкой.

## 6. Чего не проверял

- Golden/визуальную матрицу (active axis, conflict-узел, red repair preview,
  delete-dialog, включая forced-colors-контраст нового
  `.plan-snap-node.conflict`, который не входит в текущий forced-colors smoke
  `demo/smoke_plan_snap_overlay.mjs:242-254` — тот проверяет только базовый
  `.plan-snap-node`/`.plan-snap-line`) — предрелизный гейт, не гейт код-ревью;
  это то же самое решение, что и в r1/r2 (там же явно зафиксировано «просмотрено
  только по исходнику styles.ts, не по скриншоту»), дельта ребейза его не
  меняет и новых визуальных классов не добавляет.
- Полный HA backend harness — не тронут ни один `.py`-файл.
- Performance-профиль 60-room/60-partition (AC15) — не запускал профилировщик;
  вывод сделан чтением вызовов (§4, AC15). Предрелизный гейт по ТЗ §14.3.
- Touch-специфичные жесты (pinch/pan/pointercancel) именно для
  existing-face/repair путей — не находил отдельного targeted smoke под палец;
  полагался на то, что путь проходит через общий `_markupClick` gesture-guard,
  не тронутый диапазоном #228 (то же основание, что в r1).
- Многопользовательский конкурентный сценарий на delete/repair — не
  воспроизводил вручную; по чтению кода план строится заново из текущего
  `space` в момент подтверждения, а не из снимка на момент открытия диалога.
- Полный smoke-набор (163 файла) сверх пяти прогнанных выше (три названных в
  АС #228, один общий forced-colors и один — `smoke_resize_inner_dimensions` —
  специально ради риска ребейза с #233); остальные 158 не запускал, диапазон
  их не задевает.

## 7. Вердикт

Ребейз на ушедший вперёд `dev` потребовал полного разбора вместо разбора по
дельте (§2.10/§7.2). Полный разбор не нашёл новых находок: обе Medium-находки
r1 остаются закрыты тем же кодом и тестами, что подтвердил r2, автослияние с
параллельной задачей #233 не пересекается по строкам и не повредило ни одну из
двух задач (подтверждено гейтами, целевыми и кросс-задачными smoke-прогонами и
сквозным чтением всего diff'а). High — 0, Medium — 0.

Вердикт: зелёный · заход r3 · блокирующих циклов 1/4 · High: 0 · Medium: 0

Готово к очереди на пре-релиз (`S8-merged`).
