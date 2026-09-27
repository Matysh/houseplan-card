# CODE-REVIEW-290-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/290
- **Ветка:** `issue/290-near-axis-authoring-repair`
- **Диапазон:** `origin/dev` (`523190d8`) → HEAD (`5aae905a`)
- **ТЗ:** `docs/specs/290-near-axis-authoring-and-repair.md`, ревью ТЗ зелёное на r2 (`docs/reviews/SPEC-REVIEW-290-r2.md`)
- **Заход:** r1 (первый код-ревью раунд, дельта-раздел не нужен)
- **Вердикт:** красный · High: 1 · Medium: 2

## 1. Скоуп диффа

41 файл, +1966/−340. Продукт: `src/near-axis.ts` (новый общий классификатор/repair),
`src/houseplan-card.ts` (authoring hover/click/closure, Optimize dialog/report),
`src/resize.ts` (exact-axis postcondition safe Resize), `src/plan-optimizer.ts`
(lossy Optimize pass, report, идемпотентность), `src/wall-thickness.ts` (алиас
на общий порог). Тесты: `test/near-axis.test.mjs` (новый),
`test/model-invariants.test.mjs`, `test/plan-optimizer.test.mjs`,
`demo/smoke_near_axis_optimize.mjs` (новый), `demo/smoke_plan_drawing_repairs.mjs`,
`scripts/mutation-gate.mjs`, `scripts/model-invariants.mjs`, `scripts/smoke-links.mjs`.
Документация: CANVAS/RESIZE/WALL-THICKNESS/ARCHITECTURE/CONFIG-COMPATIBILITY/
USER-GUIDE(.ru)/TESTING/CHANGELOG(.ru) — все ссылаются на #290 и соответствуют
принятым в ТЗ формулировкам. `dist`/`custom_components/.../frontend` — класс D,
байт-в-байт совпадают с пересборкой (проверено).

## 2. Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный |
| unit | `npm test` | 1226 passed, 1 skipped, 0 failed (совпадает с хендоффом автора) |
| build + bundle parity | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` | идентичны |
| docs fingerprint | `node scripts/check-docs.mjs` (обязателен: диф трогает `src/**`) | «Documentation checks passed (7 files, 10 external links)» |
| smoke-выборка | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | см. §2.1 |
| invariants (обязателен: диф трогает геометрию) | `npm run invariants -- --config <wrapped fixture> --near-axis` | см. §2.2; литерально `--config test/fixtures/real-plan-*.json` **не работает** без обёртки — фикстура хранит `{note, space}`, а не `{spaces:[...]}`, инвариант читается только через тест/скрипт, который её оборачивает |
| golden | не запускал | диф не добавляет и не меняет ни один golden-сценарий (`demo/golden/baselines/**` не тронут); автор утверждает, что полный Linux Validate с golden прошёл на точном SHA `5aae905` — не перепроверял CI-прогон отдельно, см. §5 |
| performance | не запускал | не назван в AC как влияющий количественно; спецификация ограничивается «Optimize pass линейный», что подтверждается чтением (`repairNearAxisRoomWalls` — один проход по кандидатам без вложенных полных пересчётов) |
| backend pytest | не запускал | диф не трогает `custom_components/**/*.py` |

### 2.1 Смок-выборка

`node scripts/smoke-select.mjs --base origin/dev --head HEAD`:

- **Прямое совпадение:** `smoke_decor_layer_order.mjs`, `smoke_room_resize.mjs`,
  `smoke_zero_divider_taper.mjs` (символы `roomPoly`/`samePoint`, попавшие на
  изменённые строки нового `near-axis.ts`, — общие имена, но прогнал все три:
  зелёные, без регрессий.
- **Зарегистрированная связь:** `smoke_near_axis_optimize.mjs` (новый,
  `scripts/smoke-links.mjs`) — прогнан, зелёный (см. вывод в §3).
- **Слабая связь (19, общий символ `_path`):** `smoke_plan_drawing_repairs.mjs`
  прогнан (он и есть целевой AC2-смок, изменён в диффе) — зелёный. Остальные 18
  — общий геометрический путь рисования, не про near-axis; прогнал дополнительно
  `smoke_wall_junctions.mjs`, поскольку `wall-thickness.ts` меняет источник
  константы `MULTI_WALL_NEAR_ORTHOGONAL_MAX_DEGREES` (ровно тот класс регресса,
  что #234 поймал на «непрямом» имени) — зелёный. Остальные 17 не прогонял:
  тема (табы, esc-диалоги, drag жесты) не пересекается с near-axis классификатором
  ни по AC, ни по изменённым символам за пределами общего `_path`.

### 2.2 Инварианты и AC10 — реальные планы

`npm run invariants -- --config <файл> --near-axis` ожидает форму `{spaces:[...]}`;
обе `test/fixtures/real-plan-*.json` хранят `{note, space}` (как их использует
`test/model-invariants.test.mjs` и `demo/smoke_real_plan_masonry.mjs`). Обернул
вручную и прогнал программно (не через `npm run invariants` CLI буквально,
поскольку буквальный вызов из AC10 не аппликабелен к формату этой фикстуры):

```
real-plan-first-floor.json:  near-axis before=0 after=0, wallsStraightened=0, changed(align)=true(шум координат), 2-й проход wallsStraightened=0
real-plan-second-floor.json: near-axis before=1 after=0, wallsStraightened=1, maxStraightenShiftCm≈1, maxStraightenSpace='floor', 2-й проход wallsStraightened=0
```

Подтверждает главный продуктовый факт: `real-plan-second-floor.json` — тот
самый план с дефектом из тела issue — после Confirm получает `near-axis=0`,
не задваивает счётчик, идемпотентен. Это ровно то, что AC10 требует по
существу. Но это моя ручная проверка, **не** автотест — см. Medium M2.

## 3. Находки

### High H1 — Resize отключается на всей комнате из-за чужой, нетронутой near-axis стены (AC3 нарушен шире заявленного)

**Файл:** `src/resize.ts:809-811`

```ts
for (let index = 0; index < next.length; index++) {
  if (classifyNearAxisSegment(next[index], next[(index + 1) % next.length])) return false;
}
```

Цикл проверяет **все** рёбра результирующего полигона `next`, а не только
moving/side edges, как формулирует ТЗ §5.2 и AC3 («Outer и exact-shared safe
drags сохраняют **moving/side edges** exact-axis»). `next` совпадает с исходным
polygon везде, кроме двух передвигаемых вершин — значит любое чужое,
нетронутое near-axis ребро где-либо ещё в том же полигоне комнаты валит всю
проверку, и `resolveSafeResize` возвращает `invalid-geometry` для **любого**
handle этой комнаты, не только для handle, связанного с дефектом.

**Воспроизведение** (пул `test-build`, без правок продукта):

```js
import { resolveSafeResize } from './test-build/resize.js';
const rooms = [/* north-west, south-west, east из test/fixtures/279-near-orthogonal-junction.json */];
resolveSafeResize(rooms, [], 'north-west', 3, opts);
// → { enabled: false, reason: 'invalid-geometry' }
```

Ребро 3 — верхняя, точно осевая, никак не связанная с общей near-axis стеной
(она — ребро 1) сторона комнаты `north-west`. До #290 (без нового цикла) она
резалась бы штатно: остальные проверки `validateSafeResize` (topology, area
sign, clearance, `sideAxis`) её не касаются, потому что `prev`/`next` для
ребра 3 — рёбра 2 и 0, а не дефектное ребро 1. После #290 она заблокирована.

Это точная геометрия из тела issue #290, подтверждённая ревью ТЗ r2 как
буквально присутствующая в tracked `test/fixtures/real-plan-second-floor.json`.
Значит на **реальном плане владельца** — том самом, что стал причиной задачи —
Resize окажется отключён на каждом ребре комнат `north-west`/`south-west`, а
не только на дефектной стене, до первого запуска Optimize. Ни ТЗ, ни AC не
формулируют и не согласовывали такое расширение блокировки, владелец не
принимал этого решения.

**Почему не пойман тестами:** ни один файл в `test/resize*.test.mjs` не
импортирует `classifyNearAxisSegment`/`NEAR_AXIS_*`; ни один
`demo/smoke_*resize*.mjs` не использует near-axis геометрию (проверено grep по
всем трём). Новый путь в `validateSafeResize` не покрыт вообще ни одним тестом
— ни AC3, ни любой другой.

**Серьёзность:** High. Реальный регресс на данных, которые сама задача
называет мотивирующим кейсом; не согласован с владельцем; не покрыт тестом;
масштаб — вся комната, а не заявленная в AC3 пара «moving/side edges».

### Medium M1 — AC9: 3 из 6 обязательных мутантов отсутствуют

**Файл:** `scripts/mutation-gate.mjs:918-951`

ТЗ AC9 требует шесть категорий мутантов: порог ниже `0.181315°`, строгое `<`
вместо inclusive, bypass authoring snap, «чинить только одного владельца общей
стены», «считать копии комнат за две стены», «применять Optimize без
подтверждения». Зарегистрированы только первые три
(`near-axis-threshold-weakened`, `near-axis-inclusive-boundary-disabled`,
`near-axis-authoring-snap-bypassed`); `docs/TESTING.md:2828+` честно
перечисляет ровно эти три, то есть сокращение осознанное, но не согласованное
с принятым ТЗ.

Проверил по существу (не только по названию): обычные unit-тесты
(`test/near-axis.test.mjs`, тест «repairs a duplicated 316x1 physical wall
once») фактически ловят обе оставшиеся геометрические мутации — `wallsStraightened`
жёстко равен `1` (не `2`), и `north.poly[1]`/`south.poly[0]` сравниваются
явно, так что «один владелец» и «две стены вместо одной» сломали бы
существующую assertion. Функциональность цела, но формального `mutation-gate`
доказательства, которого требует принятое AC9, нет. Мутант «Optimize без
подтверждения» аналогично не зарегистрирован как патч в `mutation-gate.mjs`,
хотя `previewDoesNotWrite`/`cancelDoesNotWrite` в `smoke_near_axis_optimize.mjs`
проверяют именно это поведение.

**В скоупе задачи** — чинится добавлением трёх отсутствующих записей в
`scripts/mutation-gate.mjs` (или явным пересмотром AC9 с владельцем, если три
достаточны).

### Medium M2 — AC10: нет автотеста на двух реальных фикстурах

**Файлы:** `test/near-axis.test.mjs`, `test/model-invariants.test.mjs`,
`test/plan-optimizer.test.mjs`

AC10 (введён в ТЗ r2 специально для закрытия M2 предыдущего ревью ТЗ) требует
доказательства на `real-plan-first-floor.json` и `real-plan-second-floor.json`:
`npm run invariants` до/после подтверждённого Optimize, строгое уменьшение
near-axis count, идемпотентность повторного прогона. В диффе нет ни одного
теста, вызывающего `repairNearAxisRoomWalls`/`optimizePlans`/`nearAxisProfile`
на этих двух фикстурах — только на минимизированной
`test/fixtures/279-near-orthogonal-junction.json`
(`test/near-axis.test.mjs`, `test/model-invariants.test.mjs`) и на синтетическом
inline-конфиге (`test/plan-optimizer.test.mjs`).

Я проверил утверждение AC10 вручную выполнением (§2.2): на текущем коде оно
верно (`real-plan-second-floor.json`: near-axis 1→0, `wallsStraightened=1`,
`maxStraightenShiftCm≈1`, идемпотентно). Дефекта в поведении нет — дефект в
покрытии: без автотеста регресс на этой конкретной реальной геометрии не
поймает `npm test`, а именно ради этого доказательства AC10 и был добавлен в
ТЗ r2. Хендофф-комментарий автора («инварианты и near-axis профиль обоих
реальных планов») не называет ни точной команды, ни файла результата — то же
самое несоответствие, что и отсутствие теста.

**В скоупе задачи** — чинится тестом вида `#287`-теста
(`checkMixedRoleRecords({ spaces: [space] })`) с оборачиванием фикстуры и
прогоном `optimizePlans`/`nearAxisProfile` до/после.

### Low L1 — AC1 «source guard» не механизирован

`AC1` требует «source guard запрещает отдельные литералы `0.25` в этих
classifiers». Проверил `grep -rn "0\.25" src/*.ts` — сейчас нарушений нет
(единственные источники — `near-axis.ts` и `wall-thickness.ts`, который
импортирует константу), и `test/near-axis.test.mjs` проверяет равенство
`MULTI_WALL_NEAR_ORTHOGONAL_MAX_DEGREES === NEAR_AXIS_MAX_DEGREES`. Но
формального грep-гейта (по образцу `test/single-source-numbers.test.mjs`),
который бы упал при появлении нового хардкода `0.25` в будущем, нет. Снимаю с
записью: сегодня нарушения нет, риск регресса невелик и не блокирует эту
задачу.

## 4. Проверено и корректно

- **AC1** (боundary matrix) — `test/near-axis.test.mjs`, тест «near-axis
  boundary is shared, inclusive and bounded»: exact axis, `316×1`, `316×2`,
  ровно на границе (`NEAR_AXIS_MAX_SLOPE`), чуть выше границы, 30°-диагональ,
  mirrored/reversed. Тест умеет падать — прогнал мутанты
  `near-axis-threshold-weakened` и `near-axis-inclusive-boundary-disabled`
  вручную (guard-команды в `mutation-gate.mjs` их и запускают) и убедился, что
  именно этот тест их убивает.
- **AC2** (Walls не сохраняет `316×1`) — `demo/smoke_plan_drawing_repairs.mjs`:
  hover preview и committed click дают `316×0`, existing-node snap conflict не
  ворует чужой anchor (`nearAxisRuleDoesNotClaimWrongEndpoint`). Прогнал —
  зелёный. Мутант `near-axis-authoring-snap-bypassed` проверен по коду
  (`_resolvePlanDrawPoint` вызывает `snapNearAxisEndpoint` только когда есть
  `anchor`, `effectiveCandidate` корректно гасится при переносе точки) —
  проверено чтением, не исполнением отдельно от guard-команды.
- **AC4/AC5/AC6/AC7 (кроме multi-space cell_cm)** — `test/near-axis.test.mjs` +
  `test/plan-optimizer.test.mjs`: `wallsStraightened=1` на трекнутой фикстуре
  #279, `maxStraightenShift` точно `1/240`, обе комнаты получают идентичный
  endpoint, hosted-opening конфликт корректно уходит в `skipped`, true
  diagonal (`316×2`, 30°) не входит ни в `wallsStraightened`, ни в
  `wallsStraightenSkipped`. Multi-space/разный `cell_cm` (AC7, вторая часть) —
  в тестах нет, но проверил вручную выполнением (§2.2, конструкция с
  `cell_cm=1` и `cell_cm=100` на двух копиях фикстуры): `maxStraightenShiftCm`
  и `maxStraightenSpace` корректно выбирают пространство с большим физическим
  сдвигом, а не с большим сырым grid-сдвигом — код в
  `src/plan-optimizer.ts:448-455` масштабирует каждое пространство своим
  `cell_cm` до сравнения, ошибок не нашёл.
- **AC8** (UI/Undo/revision) — `demo/smoke_near_axis_optimize.mjs`:
  `previewDoesNotWrite`, `cancelDoesNotWrite`, `applyUsesOneAtomicWrite`,
  `reloadIsIdempotent`, `undoRestoresExactGeometry`,
  `undoServerSnapshotIsByteExact`, `undoIsOneDeep` — все зелёные. Отдельного
  golden-скрина light/dark для новой строки диалога нет (ни один
  golden-сценарий не использует near-axis геометрию), но текст строки —
  тема-независим (одна и та же Lit-разметка, разница только в CSS), поэтому
  функциональной проверки `previewNamesLossyRepair` достаточно — проверено
  чтением шаблона диалога (`src/houseplan-card.ts:16436-16441`).
- **«Одно число, один источник»** — `maxStraightenShiftCm` считается один раз
  в `plan-optimizer.ts` (масштабирование через `cell_cm` конкретного
  пространства) и передаётся в отчёт; UI (`straightenCm =
  Math.ceil(r.maxStraightenShiftCm * 10) / 10`) только форматирует, не
  пересчитывает. `wallsStraightened`, показанный в отдельной строке диалога, и
  тот же счётчик, свёрнутый в агрегат `m` тоста `gs.align_done`, — это одна и
  та же исходная величина, просуммированная с другими подобными счётчиками
  (тот же паттерн, что у `openingsRehosted` и остальных), а не два независимых
  вычисления одной и той же вещи — не является нарушением правила.
  `test/single-source-numbers.test.mjs` прошёл (это механическая часть
  правила; смысловую разобрал вручную выше).
- **`changed` не даёт ложных `wallsStraightened`** — `plan-optimizer.ts:645-646`
  сравнивает итоговый JSON конфига/layout с исходным; `wallsStraightened`,
  `wallsStraightenSkipped` и `maxStraightenShiftCm` зависят от `changed`
  (строки 690-693), так что «исправлено N стен» не может появиться без
  реального изменения записи.
- **Idempotency** — второй `optimizePlans` на уже выпрямленной геометрии даёт
  `wallsStraightened=0`, `changed=false` — проверено и в unit-тесте, и вручную
  на обоих реальных планах (§2.2).
- **Документация** — CANVAS/RESIZE/WALL-THICKNESS/ARCHITECTURE/CONFIG-
  COMPATIBILITY/USER-GUIDE(.ru)/TESTING/CHANGELOG(.ru) читал полностью;
  терминология («выпрямлено стен», «максимальное перемещение») совпадает
  между кодом, i18n и `USER-GUIDE.ru.md`; трейлеры коммитов не проверял
  отдельно (см. §5), но `User-Visible: yes` подтверждён правками в обоих
  changelog в дифф-стате.
- **typecheck/build/bundle parity/check-docs** — зелёные (§2).

## 5. Чего не проверял

- **Полный Linux CI Validate на SHA `5aae905`** (golden, `docs`, `hacs`,
  `hassfest`, `smoke`, `performance_smoke`, `backend`) — не переоткрывал сам
  прогон через `gh`, доверился ссылке на зелёный run в хендоффе автора и
  собственному локальному повтору дешёвых гейтов + целевых смоков. Если нужна
  дополнительная гарантия — попросить точную ссылку на run id.
- **Полный набор `demo/smoke_*.mjs`** (182 файла) — прогнал только выбранные
  скриптом `smoke-select.mjs` плюс `smoke_wall_junctions.mjs` по прецеденту
  #234; полный прогон — предрелизный гейт (PROCESS.md §8), не гейт ревью.
- **`npm run golden:verify` и performance-профили** — не запускал; диф не
  добавляет golden-сценариев и не называет performance-бюджет в AC явно.
- **`python -m pytest tests_backend`** — не запускал; диф не трогает Python.
- **Touch/pinch/pointercancel** — не гонял вручную в браузере; проверено
  чтением: `_resolvePlanDrawPoint`/`snapNearAxisEndpoint` не завязаны на тип
  указателя, а pinch/pan обрабатываются раньше и не доходят до этого пути
  (ES5-уровня рефакторинг не менял pointer-разбор).
- **Коммит-трейлеры и провенанс** (`Issue:`/`User-Visible:` на каждом коммите
  диапазона) — не проверял поштучно через `git log`; `pre-push`/`provenance`
  CI job должны были бы поймать нарушение раньше ревью.

## 6. Итог

High H1 — реальный, воспроизведённый регресс Resize на геометрии, ради
которой заведена задача, вне заявленного в AC3 объёма и без покрытия тестом.
Medium M1/M2 — согласованные в ТЗ доказательства (AC9, AC10) реализованы не
полностью; функционально то, что можно проверить вручную, работает верно, но
автоматическое доказательство отсутствует. Возврат автору: сузить проверку в
`validateSafeResize` до moving/side edges (или явно вынести решение
«вся комната блокируется» на согласование с владельцем, если это осознанный
выбор), добавить три недостающих мутанта AC9 и тест AC10 на обеих реальных
фикстурах.
