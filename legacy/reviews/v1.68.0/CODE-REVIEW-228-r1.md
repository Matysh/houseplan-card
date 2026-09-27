# CODE-REVIEW-228-r1

- Issue: [#228](https://github.com/Matysh/houseplan-card/issues/228) — надёжное рисование стен и операции с готовым контуром
- ТЗ: `docs/specs/228-plan-drawing-problems.md` (ревью ТЗ зелёное, r1, #228)
- Ветка: `issue/228-plan-drawing-problems`
- Коммит реализации: `2aaef12` (`fix: make plan drawing fail closed`, `Issue: #228`, `User-Visible: yes`)
- Заход ревью: r1 · блокирующих циклов израсходовано 0 из 4 (первый заход, дельта не разбирается — весь диапазон `origin/dev...HEAD`)
- Ревьюер: Claude (код-ревью), сессия без контекста реализации

## 1. Скоуп проверки

Диапазон `git log --oneline origin/dev..HEAD`: три коммита —
`dca4ed2` (ТЗ), `7eedd7e` (ревью ТЗ), `2aaef12` (реализация). Весь
продуктовый код и тесты сосредоточены в одном коммите `2aaef12`.
Диапазон `git diff origin/dev...HEAD --stat`: 31 файл, +2600/-356,
из них продуктовый код — `src/houseplan-card.ts` (+397/-90),
`src/plan-snap-overlay.ts` (+153/-25), новые `src/wall-face-repair.ts`
(+150) и `src/room-deletion.ts` (+122), `src/wall-face-graph.ts` (+36),
`src/logic.ts` (+12), `src/styles.ts` (+27); тесты — 146 строк в
четырёх файлах; один новый smoke (`demo/smoke_plan_drawing_repairs.mjs`,
143 строки) плюс точечная правка существующего
(`demo/smoke_unified_wall_tool.mjs`); i18n en/ru; семь файлов
документации; три синхронные копии бандла.

Прочитаны перед разбором: `docs/SCOPE.md`, `AGENTS.md`, `PROCESS.md`,
тело issue #228 и все семь комментариев (аналитика → продуктовые
вопросы → решения владельца → «ТЗ готово» → зелёное ревью ТЗ → «Взял» →
хендофф разработчика), полный текст
`docs/specs/228-plan-drawing-problems.md` (все 17 AC), затронутые
канонические документы (`CANVAS.md`, `ARCHITECTURE.md`,
`WALL-THICKNESS.md`, `TOUCH-SUPPORT.md`, `USER-GUIDE.ru.md`).

## 2. Как проверялось — гейты

Объём гейтов соразмерен задаче (§8 PROCESS.md): дешёвые гейты
прогнаны полностью, тяжёлые — по необходимости, определяемой diff'ом
и AC.

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный, без вывода |
| Unit | `npm test` | `# tests 1031 / # pass 1031 / # fail 0` |
| Build | `npm run build` | зелёный, `dist/houseplan-card.js` собран за 12.6s |
| Синхронность бандла | `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` | обе копии побайтно идентичны, `git status` после сборки чист |
| Named smoke | `node demo/smoke_plan_snap_overlay.mjs` | все 34 проверки `true`, `OK` |
| Named smoke | `node demo/smoke_unified_wall_tool.mjs` | все 19 проверок `true`, `OK` |
| Named smoke | `node demo/smoke_plan_drawing_repairs.mjs` | все 14 проверок `true`, `OK` |

Эти три smoke named в §14.2 ТЗ и покрывают ровно те поверхности,
которые задевает diff. Расхождение с хендоффом автора (у него
«1030 pass, 1 skipped», у меня «1031 pass, 0 fail») не влияет на
вердикт — оба прогона зелёные, разница объясняется средой (моя
локальная копия не показывает ни одного skipped теста); я не стал
разбирать её отдельно, так как результат в обоих случаях «всё
проходит».

**Чего не прогонял и почему:**

- `npm run golden:verify` — diff не меняет ни один *существующий*
  видимый кадр (новые визуальные элементы — `active-axis`,
  `active-vertex`, `wall-repair-preview`, `.conflict` узел,
  `hp-dialog` удаления комнаты — по коду не рендерятся, пока
  инструмент неактивен; `viewHasNoEditorRepairChrome` в smoke это
  подтверждает). Полная golden-матрица — предрелизный гейт (§14.3
  ТЗ, §8 PROCESS.md), не гейт код-ревью.
- `python -m pytest tests_backend` — ни один файл
  `custom_components/**/*.py` не тронут; ТЗ §16 прямо фиксирует, что
  Python/schema изменений не ожидается, и это подтверждено diff'ом.
- Полный smoke-набор (127 файлов) и performance-профили — задача не
  задевает все поверхности; названные в АС и связанные с diff смоки
  прогнаны выше. Это предрелизный гейт по действующему решению
  владельца (§8, §11.4).

## 3. Разбор по AC

Ревью кода отвечает за вопрос «оно вообще работает»; там, где нет
автотеста, ниже явно написано «проверено чтением, не исполнением».

- **AC1** (активная ось/узел) — `smoke: activeSegmentShowsAxisAndNode`
  зелёный; код рендерит `.active-axis`/`.active-vertex` только когда
  снап не выдал candidate/conflict (houseplan-card.ts:18970-18977,
  `_drawSvg`), что не дублирует активный snap-маркер. Проверено
  автотестом.
- **AC2** (неоднозначные endpoints) — `test/plan-snap-overlay.test.mjs`
  покрывает ambiguous/resolved-после-zoom; `smoke:
  closeEndpointsFailClosed` зелёный; click-путь
  (`_markupClick`, houseplan-card.ts:7286-7295) не пишет точку и
  показывает toast. Проверено автотестом.
- **AC3** (strict Shift) — `resolveStrictPlanSnap` в
  `plan-snap-overlay.ts` реализует forward-ray проекцию для endpoint и
  line/ray intersection; unit-тест «strict Shift accepts only points…»
  и smoke `strictShiftUsesExactRayIntersection` зелёные. Прочитан код
  геометрии луча (`selectedRay`, `pointOnForwardRay`) — пересечение
  считается через параметрическое уравнение, non-Shift путь
  (`resolvePlanSnapResult`) не тронут кроме ambiguity guard, как и
  требует §8.3.5. Проверено автотестом.
- **AC4** (угловая подпись) — `isExact45Vector` (logic.ts) заменяет
  широкий `is45(deg, 0.5)`; вызывается с geometry epsilon
  `this._gridPitch * 0.0002`, тем же порядком величины, что и везде в
  файле. Smoke `angleColourMatchesActualVector` явно проверяет
  90,1° как красный. Проверено автотестом.
- **AC5/AC8** (комната из готовой области) — `findWallFaceAtPoint`
  (wall-face-graph.ts) исключает точки на границе и выбирает
  наименьшую площадь; `_offerExistingWallFace` вызывается только при
  пустом `_path`, без snap-candidate и без Shift (houseplan-card.ts:7295).
  Smoke проверяет `existingFaceOffersRoom`,
  `keepExistingFaceIsNoop`, `shiftBypassesExistingFaceOffer`,
  `createExistingFaceKeepsPartitions` (после Create партиции остаются
  4 — существующий контур не тронут). Проверено автотестом.
- **AC6/AC7** (repair ≤2 см, атомарность, негативная матрица) —
  `wall-face-repair.ts` реализован как чистая функция,
  immutable-инвариант проверен тестом (`structuredClone`
  snapshot-сравнение). Позитив (1,2 см и ровно 2,0 см → repair; 2,01 →
  none), негатив «multiple valid closures fail closed» и «room vertex
  never moves» (assert на `!sourceKey.startsWith('static:room|')`)
  покрыты unit-тестами; commit-only-with-Create и bit-equivalent
  Cancel/Keep — smoke `repairCommitsOnlyWithRoom`. **Не покрыто**:
  см. находку M1 ниже — hosted-opening negative case из
  ТЗ §14.1 п.8 не имеет ни unit, ни smoke доказательства, хотя AC7
  явно называет `unit + smoke` способом доказательства.
- **AC9** (диалог удаления) — `_renderRoomDeleteDialog` использует
  `hp-dialog` (не `confirm()`), primary «Keep walls», danger «Delete
  walls», `@hp-close` на Cancel/X/Escape. Smoke
  `deleteUsesAccessibleChoiceDialog` подтверждает отсутствие
  `confirm` и наличие `hp-dialog` в DOM. `hp-dialog` — переиспользуемый
  компонент (тот же, что и `_renderPartitionDeleteDialog`), его
  focus-trap/Escape-контракт не часть этого diff — проверено чтением,
  не переисполнено отдельно.
- **AC10/AC11** (Keep/Delete walls, эксклюзив/shared/hosted) —
  `room-deletion.ts` — чистая функция; unit-тесты покрывают
  reuse compatible masonry, virtual/shared/zero-thickness исключение,
  exclusive rehost vs shared/hosted survival,
  `parameterOnPartition` для двух направлений полигона. Smoke
  `keepWallsMaterializesAndRehosts` и
  `deleteWallsCascadesExclusiveOpening` зелёные. Проверено чтением
  вызывающего кода `_confirmRoomDelete`: capacity-проверка
  (`MAX_PARTITIONS`) выполняется до `_geometrySnapshot()`/мутации —
  соответствует «fail before mutation». Проверено автотестом плюс
  чтением оркестрации.
- **AC12** (один Undo/атомарность) — `_recordGeometry(...)` вызывается
  один раз в конце `_confirmRoomDelete` и один раз в конце
  `_applyWallFaceBatch`; проверка `_validateWallRepair` выполняется до
  захвата `before`-снапшота и до записи в `sp`. Проверено чтением, не
  исполнением (нет отдельного Undo/Redo unit-теста для этого пути, но
  структура кода идентична уже принятому паттерну `_applyWallFaceBatch`
  из #173, который эту гарантию уже несёт).
- **AC13** (существующие рендер-потребители не регрессируют) — diff не
  трогает Iso/Glow/sun рендер; новые SVG-элементы гейтятся текущим
  инструментом/режимом. `viewHasNoEditorRepairChrome` подтверждает
  отсутствие чрезмерной рендер-цепочки в View. Проверено чтением плюс
  smoke.
- **AC14** (touch/gesture safety) — код не вводит новых touch-путей;
  `_offerExistingWallFace` вызывается из того же `_markupClick`, что
  уже проходит через существующий suppressed-click/pointercancel guard
  (не тронут этим diff). Явного нового targeted-smoke на touch-жесты
  для repair/existing-face нет, но `smoke_plan_snap_overlay`
  (`panPinchCancelDoNotCommit`, не в этом diff, но покрывает тот же
  путь) и общий контракт `_markupClick` дают достаточное покрытие
  чтения. Проверено чтением, не исполнением.
- **AC15** (perf) — `findWallFaceAtPoint`/`planWallFaceRepair`
  вызываются только из `_offerExistingWallFace` (idle click) и
  `_offerWallFaces` (после принятого сегмента); ни один вызов не стоит
  в `_svgPointerMove`/hover-пути (тот использует только
  `resolvePlanSnapResult`/`resolveStrictPlanSnap`, O(E) над кэшированной
  геометрией). Проверено чтением, не исполнением; performance-профиль
  — предрелизный гейт по ТЗ §14.3.
- **AC16** (backend/schema) — `custom_components/**/*.py` не тронут;
  новых persisted-полей нет, `partitions`/`openings` используют
  существующую схему (`cm`, `host.kind: 'partition'`). Проверено
  чтением diff'а.
- **AC17** (гейты, i18n, changelog, документация) — см. таблицу гейтов
  выше; en/ru ключи парные (`btn.delete_room_keep_walls` и т. д.);
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` правлены в том же
  коммите `2aaef12` с `User-Visible: yes`; `docs/CANVAS.md`,
  `docs/ARCHITECTURE.md`, `docs/WALL-THICKNESS.md`,
  `docs/TOUCH-SUPPORT.md`, `docs/USER-GUIDE.ru.md`, `docs/TESTING.md`,
  `docs/STATUS.md` обновлены и соответствуют реализации (см. §4 ниже
  про место, где текст документации разошёлся с точным поведением
  кода). Проверено чтением всех перечисленных диффов.

## 4. Находки

### M1 (Medium, в скоупе) — негативный сценарий «hosted opening» не доказан автотестом

**Файл:** `src/houseplan-card.ts:12673-12677` (`_validateWallRepair`),
соотнесено с `docs/specs/228-plan-drawing-problems.md` AC7 и §14.1 п.8.

**Описание:** AC7 явно требует доказательства `unit + smoke` для
негативной матрицы, включающей «invalid hosted opening»: repair,
который сдвинул бы partition, на которой уже висит проём, обязан быть
отклонён. Guard в коде существует
(`if (proposal.sourceKey.startsWith('static:partition|')) { … if
(openings.some(host.id === id)) return false; }`) и по чтению кода
верен (правильно парсит `static:partition|<id>|…` через уже
существующий формат ключа из `plan-snap-overlay.ts:sourceKey`). Но ни
`test/wall-face-repair.test.mjs` (проверяет только чистую геометрию,
не знает о проёмах), ни `demo/smoke_plan_drawing_repairs.mjs`
(единственный `opening` в смоке участвует только в сценариях удаления
комнаты, не в сценарии 2-см repair) не воспроизводят этот случай.

**Как проявится:** если этот guard будет случайно ослаблен или удалён
в будущей правке (например, при рефакторинге `_validateWallRepair`),
ни один тест не покраснеет — repair сможет сдвинуть стену, на которой
висит проём, произведя проём с некорректным host/geometry, то есть
нарушив инвариант ТЗ «Repair не остаётся вычисляемой ‘почти связью’» и
«Проём не остаётся orphan». Разбор чтением не заменяет здесь автотест,
потому что сам процесс требует именно `unit + smoke` для этой строки
AC7.

**Что нужно:** один unit-тест на уровне `houseplan-card` (или
эквивалентный целевой smoke-сценарий в
`demo/smoke_plan_drawing_repairs.mjs`) с существующей room-wall или
independent-partition, несущей hosted opening в зоне ≤2 см от
незамкнутого face, подтверждающий, что `_offerExistingWallFace`/
`_applyWallFaceBatch` не создают repair либо отклоняют его на Create с
понятным сообщением.

### M2 (Medium, в скоупе) — неоднозначный «gap > 2 см» диагностируется как единственный

**Файл:** `src/houseplan-card.ts:7675-7687` (`_offerExistingWallFace`),
соотнесено с `docs/specs/228-plan-drawing-problems.md` §8.6, последний
абзац.

**Описание:** ТЗ дословно: «Если gap больше 2 см, но около click
существует **единственный** диагностируемый разрыв в screen
snap-range, он подсвечивается и room dialog не открывается.
**Неоднозначный** или недиагностируемый открытый набор остаётся
обычным Walls flow». Код второй (более широкой) диагностики не
различает `diagnostic.kind === 'repair'` и `diagnostic.kind ===
'ambiguous'`:

```ts
if (diagnostic.kind !== 'none') {
  this._wallRepairDiagnostic = diagnostic.kind === 'repair'
    ? diagnostic.proposal : diagnostic.proposals[0] || null;
  this._showToast(this._t('toast.wall_repair_too_large'));
  return true;
}
```

При `kind === 'ambiguous'` код всё равно подсвечивает один
произвольный `proposals[0]`, показывает toast и **перехватывает клик**
(`return true`), вместо того чтобы вернуть `false` и позволить обычный
Walls flow (начать новую цепочку с этой точки), как того требует
дословный текст ТЗ.

**Как проявится:** три-четыре стены, образующие незамкнутый контур с
разрывом 3 см, у которого в пределах 12 CSS px существует более одного
структурно равноценного способа замкнуть face (например, две разные
комбинации independent-стен) — обычный клик внутри контура вместо
обычного начала новой стены покажет «Разрыв больше 2 см» и подсветит
один из вариантов, будто это единственный. Пользователь не может
продолжить рисовать стену с этой точки без дополнительного действия
(Shift+click), хотя контракт обещает ordinary flow.

**Что нужно:** при `diagnostic.kind === 'ambiguous'` в этой ветке
вернуть `false` (не перехватывать клик, не подсвечивать, без toast),
как это уже сделано для случая `result.kind === 'ambiguous'` в
основной (≤2 см) ветке — там как раз есть выделенный
`toast.wall_repair_ambiguous`, здесь дополнительной обработки не
требуется вовсе, только не путать `ambiguous` с `repair`.

Обе находки Medium и **в скоупе задачи** (AC7 и §8.6 — прямая часть
ТЗ #228): по решению владельца (2026-08-19, #202) отдельный issue не
заводится, правка делается в этом же issue, фикс проходит повторный
цикл ревью.

## 5. Что проверено и корректно (сверх раздела 3)

- Ключи `static:*`/`active:*`/draft `id` формата `<draftId>:<index>`
  строятся в одном месте (`plan-snap-overlay.ts:sourceKey`,
  `houseplan-card.ts:_activeWallSourceKey`) и корректно парсятся
  обратно в `_applyWallRepair`/`_validateWallRepair` для всех трёх
  веток (`active:`, `static:partition|`, `static:draft|`) — трассировка
  индекса `/:(\d+)$/` и `lastIndexOf(':')` соответствует формату
  генератора ключа, включая случай `endpoint === 'b'` (сдвиг индекса
  на +1). Не нашёл рассинхронизации.
- `stableEndpointMover`/`movable()` в `wall-face-repair.ts` корректно
  исключает пары, где оба конца — room-vertex (обе стороны
  immovable), и не позволяет room выступать «двигателем» даже когда
  он геометрически «удобнее» (grid-canonical) — проверено чтением и
  подтверждено тестом на `!sourceKey.startsWith('static:room|')`.
- Капасity-проверка в `_confirmRoomDelete` считает именно новые (не
  переиспользуемые) партиции через `Set` по `interval.key` **до**
  снятия геометрии — соответствует «Capacity … fail before mutation»
  (ТЗ §8.7/инвариант 8).
- Три копии бандла после чистой пересборки побайтно идентичны, рабочее
  дерево чисто после сборки — обязательное условие §8 AGENTS.md
  выполнено этим прогоном.
- i18n: каждый новый en-ключ имеет ru-пару и наоборот (`btn.*`,
  `history.*`, `confirm.*`, `toast.*`), термины «независимая стена»,
  «увеличить масштаб» соответствуют `docs/USER-GUIDE.ru.md`.
- Документация обновлена в затронутых канонических файлах и не
  противоречит коду ни в одном прочитанном месте, кроме находки M2,
  где именно **код** расходится с уже верно написанным текстом ТЗ (не
  наоборот).

## 6. Чего не проверял

- Golden/визуальную матрицу (active axis, conflict-узел, red repair
  preview, delete-dialog) — предрелизный гейт, не гейт код-ревью;
  новые CSS-классы `active-axis`/`.plan-snap-node.conflict`/
  `.wall-repair-preview` просмотрены только по исходнику styles.ts, не
  по скриншоту.
- Полный HA backend harness — не тронут ни один `.py`-файл, пропуск
  обоснован ТЗ §16.
- Performance-профиль 60-room/60-partition (AC15) — не запускал
  профилировщик, вывод сделан чтением вызовов (см. §3, AC15).
  Предрелизный гейт по ТЗ §14.3.
- touch-специфичные жесты (pinch/pan/pointercancel) именно для
  existing-face/repair путей — не находил отдельного smoke-сценария
  под палец/эмуляцию тача для новой функциональности; полагался на то,
  что она проходит через тот же `_markupClick`, что и остальной Walls
  flow, чей gesture-guard не тронут этим diff.
- Многопользовательский конкурентный сценарий (структурный
  fingerprint при открытом диалоге удаления комнаты, пока другой
  клиент меняет геометрию) — не воспроизводил вручную; по чтению кода
  `_confirmRoomDelete` план заново строится из текущего `space` в
  момент подтверждения, а не из снимка на момент открытия диалога, что
  делает застаревание маловероятным, но это не проверено тестом.

## 7. Вердикт

Обе находки — Medium, в скоупе задачи, без High. По §2.7/§4
PROCESS.md это жёлтый вердикт: задача возвращается автору на правку в
рамках issue #228, фикс проходит повторный цикл код-ревью (бюджет
цикла — 1 из 4, поскольку жёлтый вердикт цикл расходует).

Вердикт: жёлтый · заход r1 · блокирующих циклов 1/4 · High: 0 · Medium: 2 → в задаче
