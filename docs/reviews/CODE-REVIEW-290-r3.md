# CODE-REVIEW-290-r3

- **Issue:** #290 — «Уступ в один шаг на общей стене создаётся молча и невидим при обычном зуме»
- **Этап:** код-ревью (PROCESS.md §2.7)
- **Заход:** r3 · блокирующих циклов израсходовано на входе 1 из 4
- **Ветка:** `issue/290-near-axis-authoring-repair`
- **HEAD на момент ревью:** `d33ae88da4049bdbdfd02c57f935199007157cf3`
- **Диапазон:** `origin/dev..HEAD` (10 коммитов, `git diff --stat origin/dev...HEAD`: 35 файлов, +2611/-335)

## Почему разбор полный, а не по дельте

Формально предыдущий раунд (r2, комментарий issue #290 от 2026-08-24 13:21) —
зелёный, и по правилу §2.10 третий заход мог бы разобрать только дельту после
него. Но между r2 и этим заходом ветку **перебазировали на ушедший вперёд
`dev`** (комментарий владельца 2026-08-24 13:34: домержены #288/#290 changelog,
`WALL-THICKNESS.md`, пересобраны бандлы). Это прямо попадает под исключение
§2.10: «ребейз на ушедший вперёд `dev` — после ребейза это другой код». Сам r2
уже один раз проходил через это же исключение относительно r1 (домёржен #289).

Отдельно: **SHA, на котором получен вердикт r2, в самом вердикте не назван**
(комментарий #8 в issue называет только промежуточные коммиты `615c0744` и
`6ded0f01`, но не финальный HEAD ветки на момент зелёного вердикта). Это
находка процесса, а не кода: проверил — оба этих SHA сейчас нерезолвируемы
(`git cat-file -t` — «Not a valid object name»), что и является следствием
силового ребейза, а не пропуском автора. Дальше это не имеет практического
значения, потому что рабочий пункт §2.10 всё равно предписывает полный разбор
для этого случая, и я его сделал: прочитан и перепроверен весь diff
`origin/dev...HEAD`, а не только «правки со времени r2».

## Скоуп

Продукт: единый near-axis classifier (`src/near-axis.ts`, новый), authoring-
привязка при рисовании стен (`src/houseplan-card.ts`), exact-axis
постусловие Safe Resize (`src/resize.ts`), явный lossy-проход Optimize
(`src/plan-optimizer.ts`) с отчётом/Undo, единый источник допуска
`0.25°` для renderer (`src/wall-thickness.ts`), near-axis профиль в CLI
инвариантов (`scripts/model-invariants.mjs`), 6 mutation-gate записей, RU/EN
i18n, production-смоки, docs (ARCHITECTURE/CANVAS/RESIZE/WALL-THICKNESS/
CONFIG-COMPATIBILITY/USER-GUIDE×2/TESTING), оба changelog.

## Как проверялось — гейты

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без ошибок |
| Unit | `npm test` | 1234 тестов: 1233 passed, 1 skipped, 0 failed |
| Build + bundle parity | `npm run build`; `diff dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js`; `git diff --stat -- dist/houseplan-card.js` | пересобранный `dist` идентичен закоммиченному и копии в `custom_components` — три копии совпадают |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» |
| Инварианты (геометрия задета) | `npm run invariants -- --config test/fixtures/real-plan-first-floor.json`; то же для `real-plan-second-floor.json` | код 0 на обоих; на первом плане 2 наблюдения (не нарушения, записи толщины на exact endpoints) |
| Near-axis профиль на реальных планах | `node scripts/model-invariants.mjs --config <fixture> --near-axis` | first-floor: 0 почти-осевых стен; second-floor: 1 (это и есть исходный дефект issue, воспроизводимый и до правки) |
| Mutation-gate — все 6 обязательных AC9 ID индивидуально | `node scripts/mutation-gate.mjs --id=near-axis-*` ×6 | все шесть: «тест покраснел, как обязан» / «поймано 1 из 1»; после каждого прогона `git status --short` пуст — патчи откатываются |
| Smoke — прямое совпадение (`smoke-select.mjs --base origin/dev --head HEAD`) | `node demo/smoke_decor_layer_order.mjs`, `smoke_room_resize.mjs`, `smoke_zero_divider_taper.mjs` | все три OK |
| Smoke — зарегистрированная связь | `node demo/smoke_near_axis_optimize.mjs` | OK, все 12 ключей true |
| Smoke — файл прямо изменён диффом | `node demo/smoke_plan_drawing_repairs.mjs` | OK, все 19 ключей true, включая 3 новых near-axis ключа |
| Golden (полный, т.к. диф трогает Optimize-диалог и authoring-геометрию) | `npm run golden:verify` | код выхода 0, все 161 сценарий `passed`, включая `optimize-preflight-dialog-{dark-en,light-ru}` |
| Backend pytest | — | не прогонялся: `git diff --stat origin/dev...HEAD -- 'custom_components/**/*.py'` пуст |
| Дисциплина «тест умеет падать» — H1 регрессия (r1) | откат `src/resize.ts` к широкой проверке по всем рёбрам полигона, `node --test --test-name-pattern="#290 a remote near-axis" test/resize.test.mjs` | тест краснеет (`reason: 'invalid-geometry'` вместо ожидаемого `'partial-shared'`); после отката файла — снова зелёный, `git status` чист |
| Дисциплина «тест умеет падать» — AC1 source guard | откат `src/wall-thickness.ts:85` к инлайн-литералу `= 0.25` вместо импорта, полный `npm test` + `tsc --noEmit` | **не падает ничего** — см. находку M1 ниже |

## Находки

### M1 (Medium, в скоупе задачи)

**ТЗ AC1** (`docs/specs/290-near-axis-authoring-and-repair.md:173-174`) прямо
обещает: «Authoring, Optimize и renderer #279 импортируют один threshold
source; **source guard запрещает отдельные литералы `0.25` в этих
classifiers**». Такого guard'а в коде нет.

`src/wall-thickness.ts:85` действительно ссылается на источник:
`export const MULTI_WALL_NEAR_ORTHOGONAL_MAX_DEGREES = NEAR_AXIS_MAX_DEGREES;`
— но единственная проверка этого факта, `test/near-axis.test.mjs:23`
(`assert.equal(MULTI_WALL_NEAR_ORTHOGONAL_MAX_DEGREES, NEAR_AXIS_MAX_DEGREES)`),
сравнивает **числа**, а не происхождение значения.

Воспроизведено: заменил в `src/wall-thickness.ts:85` импортированную ссылку на
инлайн-литерал (`export const MULTI_WALL_NEAR_ORTHOGONAL_MAX_DEGREES = 0.25;`,
удалив зависимость от `NEAR_AXIS_MAX_DEGREES`) и прогнал `npx tsc -p
tsconfig.test.json`, `node scripts/fix-test-build.mjs`,
`node --test test/near-axis.test.mjs test/wall-thickness.test.mjs` (115
тестов) и отдельно `npx tsc --noEmit` — всё зелёное, ни один тест, ни
typecheck не заметили расхождения. Значение продублировано, а не
переиспользовано, ровно так, как AC1 запрещает, и ни один существующий гейт
этого не ловит.

**Почему это не придирка, а реальный риск именно для этой задачи:** issue #290
существует потому, что renderer (#279) и остальная система однажды разошлись в
допуске `0.25°`/`sin(0.25°)`. AC1 — это явно сформулированная защита от
повторения того же класса дефекта на трёх новых потребителях порога (authoring,
Optimize, renderer). Сейчас, если будущий рефакторинг/мёрдж случайно вернёт
renderer к собственному литералу (или к чуть другому числу), ни `npm test`, ни
`tsc`, ни один из зарегистрированных 6 mutation-gate ID для #290 этого не
поймают — именно тот тихий дрейф, который эта задача призвана исключить.

**Как чинится в скоупе:** нужен один из двух вариантов — (а) статический guard
по образцу `test/single-source-numbers.test.mjs` (regex/AST-скан `src/**/*.ts`
на литерал `0.25` вне `src/near-axis.ts`), либо (б) mutation-gate запись,
аналогичная уже существующим шести, которая инлайнит литерал в
`wall-thickness.ts` и требует, чтобы это красило конкретный тест/typecheck.
Оба варианта дёшевы и не меняют продуктовое поведение.

Находка в скоупе задачи, High отсутствует → **жёлтый вердикт**, исправляется в
этой же ветке, отдельный issue не заводится (решение владельца 2026-08-19,
#202).

## Что проверено и корректно

- **AC1 (кроме source guard)** — `test/near-axis.test.mjs:21-29` покрывает
  exact axis, `316×1`/`316×2`, зеркальные/обратные концы, ровно `0.25°`
  (`NEAR_AXIS_MAX_SLOPE`) и чуть выше, 30°-диагональ; boundary включительна
  (`minor / major > NEAR_AXIS_MAX_SLOPE`, `src/near-axis.ts:28`).
- **AC2** — `demo/smoke_plan_drawing_repairs.mjs`: preview (`.active-axis`)
  и committed draft персистят `316×0`; `snapNearAxisEndpoint` двигает только
  свободный конец (`src/near-axis.ts:36-44`, `src/houseplan-card.ts:6917-6931`);
  существующий узел, конфликтующий с near-axis правилом, корректно теряет
  snap-owner (`effectiveCandidate`, тест `nearAxisRuleDoesNotClaimWrongEndpoint`).
- **AC3** — `src/resize.ts:1015-1021`: постусловие проверяет три инцидентных
  сдвигаемым вершинам ребра (`involvedEdges = [prev, edge, edge+1]`), не весь
  полигон. Регрессия r1 (H1: широкая проверка валила несвязанные ручки) закрыта
  и подтверждена прямым откатом (см. таблицу гейтов); `test/resize.test.mjs`
  фиксирует и «south-west,1 → enabled:true», и «north-west,3 → partial-shared
  по независимой причине #289», не near-axis.
- **AC4/AC10** — `test/near-axis.test.mjs` тест «reduces the tracked real-plan
  near-axis profile»: на `real-plan-second-floor.json` до repair — 1 почти-
  осевая стена (совпадает с `--near-axis` CLI, см. таблицу гейтов), после
  Confirm — 0, повторный Optimize — `changed:false`/`wallsStraightened:0`.
- **AC5** — `test/near-axis.test.mjs` «repairs a duplicated 316x1» проверяет,
  что обе room-copies получают идентичные endpoints (`north.poly[1] ===
  south.poly[0]`), `demo/smoke_near_axis_optimize.mjs.applyRekeysWall`
  подтверждает rekey записи толщины стены (`wall.key.endsWith('@0.0000')`).
  Repair встроен в существующий pipeline `alignAllToGrid` → `normalizeWallIntervals`
  → `degradeWalls` (`src/plan-optimizer.ts` вокруг строки 440), а не
  специальным обходом, поэтому thickness/open-span rekey получается бесплатно
  из уже проверенной инфраструктуры.
- **AC6** — тест «preserves true diagonals»: `316×2` и партиция `diagonal`
  byte-equivalent после repair; отдельный юнит на openings, которые перестали
  бы помещаться после repair (`skips a repair that would no longer fit a hosted
  opening`) — кандидат корректно пропускается, `partitions` не тронуты.
- **AC7** — `maxStraightenShiftCm` в UI (`src/houseplan-card.ts`) округляется
  вверх (`Math.ceil(x*10)/10`), то есть заведомо не меньше фактического сдвига
  — соответствует требованию «верхняя граница».
- **AC8** — `demo/smoke_near_axis_optimize.mjs`: preview не пишет
  (`previewDoesNotWrite`), Cancel не пишет (`cancelDoesNotWrite`), Confirm — один
  атомарный `houseplan/plan/optimize` (`applyUsesOneAtomicWrite`), reload —
  идемпотентно (`reloadIsIdempotent`), Undo восстанавливает исходную геометрию
  байт-в-байт и глубина Undo равна одному шагу (`undoIsOneDeep`). Revision-guard
  самого транспорта не менялся этим диффом — это существующая инфраструктура
  Optimize, разбор чтением, не исполнением.
- **AC9** — все 6 обязательных mutation ID зарегистрированы
  (`scripts/mutation-gate.mjs:945-1011`) и убиты индивидуально (см. таблицу
  гейтов); это сильнее, чем просто `--check` реестра.
- **Single source of numbers** — `wallsStraightened`/`maxStraightenShiftCm`
  считаются один раз в `plan-optimizer.ts` и не пересчитываются отдельно для
  превью/после-Confirm/reload; единственное преобразование в UI — округление
  вверх для отображения, не второй источник величины.
- **Changelog/трейлеры** — `edf8b068` (`fix: straighten near-axis wall
  geometry`) несёт `Issue: #290`, `User-Visible: yes` и правки в оба
  `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` тем же коммитом.
- **Bundle parity** — пересобранный `dist/houseplan-card.js` побайтово
  идентичен закоммиченному и копии в `custom_components/houseplan/frontend/`.
- **Golden** — полный прогон (161 сценарий) зелёный, включая два сценария
  Optimize-диалога, которые непосредственно рендерят новые UI-строки.
- **Совместимость** — `docs/CONFIG-COMPATIBILITY.md` описывает repair как
  подтверждаемый lossy-пас без миграции схемы; `PLAN_MODEL_VERSION` не поднят
  (в диффе `plan-optimizer.ts` версия не менялась) — согласуется с «schema не
  меняется» из ТЗ §9.
- **Производительность (прочитано, не исполнялось)** — `classifyNearAxisSegment`
  O(1) на сегмент; `repairNearAxisRoomWalls` линеен по рёбрам/drafts/partitions
  входного пространства, кандидаты не каскадируют (строятся из immutable
  входа); добавка в `validateSafeResize` — фиксированные 3 проверки на вызов.
  Отдельный performance-прогон не запускал, т.к. не назван в AC и алгоритмическая
  сложность не изменилась по классу (было O(edges), осталось O(edges)).

## Чего не проверял

- **Полный набор mutation-gate** (все ID, не только 6 near-axis) — не требовался
  диффом; случайно запустил фоном по невнимательности (`--help` без
  распознанного флага не показал справку, а прогнал весь registry), прогон
  завершился без ошибок, но я не использую его как доказательство — целевые 6
  ID проверены индивидуально и осознанно, этого достаточно для AC9.
- **Touch-специфичные смоки (pinch/pan/pointercancel)** — код диспетчеризации
  жестов диффом не тронут, near-axis-правило встроено в уже общий для
  touch/mouse путь `_resolvePlanDrawPoint`/commit; отдельного риска не вижу,
  не гонял `smoke_editor_gestures`/`smoke_pan_any_zoom` и им подобные (в выдаче
  `smoke-select.mjs` они пришли только как «слабая связь» по общему `_path`).
- **`python -m pytest tests_backend`** — не запускал, диф не трогает
  `custom_components/**/*.py` (проверено `git diff --stat`).
- **Linux HA harness / полный CI Validate на этом SHA** — не мой гейт;
  автор уже сообщил зелёный `Validate 32733382537` на текущем HEAD
  (комментарий issue от 2026-08-24 13:34); не перепроверял внешний CI прогон
  напрямую, доверяю ссылке как внешнему источнику, а не самопроверке автора.

## Закрытие раунда r2

r2 (комментарий issue от 2026-08-24 13:21:36, зелёный, High:0/Medium:0) сам
закрыл H1/M1/M2 из r1 и не оставил открытых находок. Между r2 и этим заходом
код не менялся (ребейз перенёс тот же коммит `edf8b068`/`f6cf2c93` на новый
`dev` без изменения содержимого — конфликты владелец разрешил только в
changelog/`WALL-THICKNESS.md`/бандлах, что подтверждено комментарием "Разрешённые
конфликты" от 2026-08-24 13:34). Поэтому таблицы «находка → чем закрыта» для r2
не требуется: закрывать нечего, r2 ничего не оставил. Настоящая находка этого
раунда (M1, source guard) — новая, не заявлена и не пропущена в r2: r2 прямо
пишет «дельта касается только `docs/specs/...`» на этапе ТЗ (SPEC-REVIEW-290-r2)
и не переразбирала AC1 на уровне кода за пределами заявленного автором
диффа между r1 и r2, а сам код AC1 (near-axis.ts/wall-thickness.ts) не менялся
между r1 и r2 — H1-фикс трогал только `resize.ts`.

## Унаследовано из r2

Полный разбор в этом раунде проведён самостоятельно и заново по всему диффу
`origin/dev...HEAD`, а не по дельте — так как рёбейз делает предыдущий SHA
нерезолвируемым (см. «Почему разбор полный» выше). Поэтому код целиком
перепроверен мной лично, а не унаследован. Единственное, что действительно не
перепроверялось заново и взято как решённое на уровне продукта, а не кода —
**продуктовые решения владельца** (выравнивать без modifier, lossy-пас Optimize
с отчётом и подтверждением, единый допуск `0.25°`), зафиксированные и принятые
на этапе ТЗ в SPEC-REVIEW-290-r2 (`docs/reviews/SPEC-REVIEW-290-r2.md`,
зелёный, коммит `dc9f9a6c` по данным того документа) — эти решения не относятся
к коду и не могли быть затронуты ребейзом.
