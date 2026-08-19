# Код-ревью issue #198 — очистка изолированного микро-интервала толщины через Optimize

- Цикл: r1/4
- Вердикт: **жёлтый** · High: 0 · Medium: 2 (обе — в скоупе задачи)
- Диапазон: `git log --oneline origin/dev..HEAD` = `0df8051` (реализация),
  `8c9241b` (ревью ТЗ r1), `9d6cd8b` (ТЗ)
- Диапазон диффа: `git diff origin/dev...HEAD`
- ТЗ: [`docs/specs/198-optimize-micro-interval.md`](../specs/198-optimize-micro-interval.md)
  (ревью ТЗ зелёное, r1)

## Скоуп

Issue #198: явное действие «Общие настройки → Оптимизировать планы» получает
новый, строго ограниченный lossy-шаг — схлопывание одиночного изолированного
интервала толщины стены короче половины шага сетки между двумя одинаковыми
коллинеарными соседями, при отсутствии room-vertex/opening-узла на его концах.
Runtime и редактор остаются lossless (не трогаются).

Файлы диапазона: `src/plan-optimizer.ts` (новый helper
`collapseIsolatedWallThicknessIslands` + его вызов в `optimizePlans()`),
`test/plan-optimizer.test.mjs` (unit-матрица), `demo/smoke_optimize_micro_interval.mjs`
(новый targeted browser smoke), `scripts/mutation-gate.mjs` (новый mutant
`optimizer-micro-interval-cleanup-disabled`), три синхронные копии бандла,
`docs/CHANGELOG.md` + `.ru.md`, `docs/USER-GUIDE.ru.md`, `docs/WALL-THICKNESS.md`,
`docs/TESTING.md`, `docs/STATUS.md`, `docs/specs/README.md`.

`custom_components/houseplan/**/*.py` не затронут — корректно, конфиг уже
приходит с фронтенда готовым (подтверждено чтением: диапазон не содержит правок
в `websocket_api.py`/`validation.py`).

## Как проверялось

| Гейт | Результат | Команда |
|---|---|---|
| typecheck | green | `npx tsc --noEmit` |
| unit | green, 915/915 | `npm test` |
| build + 3 копии бандла | green, побайтово идентичны | `npm run build && cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js && cmp dist/houseplan-card.js demo/srv/assets/houseplan-card.js` |
| targeted smoke (AC7) | green | `node demo/smoke_optimize_micro_interval.mjs` |
| смежный Optimize-smoke (surface `_openAlignDialog`/`_runAlignToGrid`, задет вставкой шага в пайплайн) | green | `node demo/smoke_grid_snap.mjs` |
| смежный align/guides smoke | green | `node demo/smoke_align_guides.mjs` |
| mutation-gate, полный self-check | green, включая новый мутант | `node scripts/mutation-gate.mjs --check` |
| mutation-gate, целевой мутант (AC9) | мутант пойман 1/1 | `node scripts/mutation-gate.mjs --id=optimizer-micro-interval-cleanup-disabled` |
| whitespace | чисто | `git diff --check origin/dev...HEAD` |
| **прямая проверка AC5 и AC8 чтением + исполнением** (см. находки ниже) | функционально корректно, но не покрыто автотестом задачи | одноразовый node-скрипт против `test-build/plan-optimizer.js` и `test-build/wall-thickness.js` (см. ниже) |

**Не прогонялось и почему:**
- `npm run golden:verify` — диапазон не трогает рендер/геометрию/стили/слои,
  только данные `walls` внутри explicit maintenance-действия; ТЗ §10 явно
  освобождает от golden, визуальный итог доказывается persisted profile.
  Пропуск обоснован diff'ом, не автоматический.
- `python -m pytest tests_backend -q` — ни один файл `custom_components/**/*.py`
  не входит в диапазон.
- performance-профили — не названы в AC; ТЗ §11 явно фиксирует «без работы в
  render/state tick», проход выполняется только по явному admin-действию на
  малых wall lists.
- Полный набор из 127 browser-смоков — диапазон касается только поверхности
  Optimize; прогнаны все три smoke, реально трогающие эту поверхность
  (`smoke_optimize_micro_interval`, `smoke_grid_snap`, `smoke_align_guides`).
  Остальные 124 не относятся к затронутым файлам.

## AC — построчно

| AC | Статус | Доказательство |
|---|---|---|
| AC1 (`22→15→22` → один 22-см entry) | ✅ | `test/plan-optimizer.test.mjs` — тест «Optimize collapses one isolated thickness micro-interval…», прогнан, зелёный |
| AC2 (строгий порог `0.5×pitch`, обе координатные шкалы) | ✅ | «micro-interval cleanup has a strict half-step boundary…», прогнан для `S/3`, `S/2`, `S/2+S/100`, обе шкалы |
| AC3 (торец/разные соседи/цепочка/offset/неоднозначное перекрытие сохраняются) | ✅ | «micro-interval cleanup preserves ambiguous and topological boundaries», 5 под-сценариев, прогнан |
| AC4 (room vertex / opening endpoint на границе центра запрещает очистку) | ✅ | тот же тест, под-сценарии `atVertex`/`atOpening`, прогнан. Вершина проверена только на левом конце центра — по коду проверка `isTopologyNode(a) \|\| isTopologyNode(b)` симметрична, поэтому это репрезентативно, а не дыра |
| AC5 (реверс endpoints / перестановка записей не меняют результат; входы не мутируют) | ⚠️ **не покрыто выделенным автотестом** | см. Medium-1 ниже — проверено вручную чтением + исполнением, автотеста в диффе нет |
| AC6 (preview `changed`/`canonicalized`/`wallsMerged`, идемпотентность) | ✅ | тот же первый тест, `second.changed === false` |
| AC7 (UI Preview/Apply/Undo/Cancel) | ✅ | `node demo/smoke_optimize_micro_interval.mjs`, прогнан против production-бандла, все 10 подпроверок green |
| AC8 (lossless-helpers вне Optimize сохраняют тот же микро-интервал) | ⚠️ **обещанный «focused regression unit» отсутствует** | см. Medium-2 ниже — проверено вручную вызовом `normalizeWallIntervals`/`degradeWalls` напрямую, `test/wall-thickness.test.mjs` не тронут этим диффом |
| AC9 (mutation guard) | ✅ | `node scripts/mutation-gate.mjs --id=optimizer-micro-interval-cleanup-disabled` → «мутант поймано 1 из 1» |
| AC10 (рабочие гейты зелёные) | ✅ | см. таблицу гейтов выше |

## Находки

### Medium-1 (в скоупе) — AC5 не доказан заявленным способом

**Файл:** `test/plan-optimizer.test.mjs`

**Суть:** ТЗ §9/§10 явно обещает для `collapseIsolatedWallThicknessIslands`
«Reversal/permutation/immutability units» как доказательство AC5. В диффе
такого теста нет: единственная проверка неизменности входа (`preview must not
mutate its input`, строка ~44) относится к `optimizePlans()` целиком и ничего
не доказывает о новом helper'е — `optimizePlans` клонирует `configIn` в самом
начале (`const config = clone(configIn)`), поэтому даже гипотетическая мутация
внутри `collapseIsolatedWallThicknessIslands` на этом уровне невидима.

**Сценарий отказа, который мог бы проскочить незамеченным:** если бы будущая
правка `collapseIsolatedWallThicknessIslands` начала мутировать переданный
`walls`-массив на месте (`walls[i].cm = target` вместо иммутабельного `.map`),
или если бы порядок `walls`/`rooms` на входе стал влиять на результат —
ни один существующий тест не покраснел бы.

**Проверено чтением, не только исполнением, для этого цикла ревью:** я
исполнил вручную три пробы против собранного `test-build/plan-optimizer.js`
(реверс `a`/`b` центрального интервала, перестановка порядка массива `walls`,
реверс winding комнаты) — во всех случаях результат идентичен по толщине,
а входной массив остаётся байт-в-байт неизменным (`JSON.stringify` до/после
совпадает). Функционально AC5 выполняется: `out = walls.slice()` +
неизменяющий `.map`, `exactMatches()` явно проверяет обе ориентации
endpoints, а порядок кандидатов принудительно стабилизирован
`.sort(...localeCompare)` перед применением. Дефекта в коде нет.

**Почему это Medium, а не Low:** это не стилистическая придирка — ТЗ прошло
ревью и легло в DoR с явно названным способом доказательства именно для этого
AC; отсутствие теста означает, что будущая регрессия (см. сценарий выше) не
будет поймана автоматически, а полагаться на то, что каждый ревьюер повторит
этот ручной прогон, недопустимо для строгого продуктового инварианта
`docs/WALL-THICKNESS.md` (lossless по умолчанию).

**Что нужно:** добавить в `test/plan-optimizer.test.mjs` unit, прогоняющий
`collapseIsolatedWallThicknessIslands` на fixture из AC1 с (а) реверсированными
`a`/`b` одного из трёх wall entries, (б) переставленным порядком массива
`walls`, (в) явной проверкой, что входной `walls`-массив и его объекты не
меняются (`deepEqual` копии до/после), и по возможности — переставленным
порядком `rooms`.

### Medium-2 (в скоупе) — AC8 не доказан заявленным способом

**Файл:** `test/wall-thickness.test.mjs` (не тронут этим диффом)

**Суть:** ТЗ §10 обещает для AC8 «Existing + focused regression unit» — то
есть новый целевой unit, доказывающий, что `normalizeWallIntervals()` и
`degradeWalls()`, вызванные напрямую (без `collapseIsolatedWallThicknessIslands`,
то есть вне Optimize), сохраняют именно этот `22→15→22` fixture нетронутым.
Диапазон не содержит ни одной правки в `test/wall-thickness.test.mjs`.
Существующие тесты рядом («different solid thicknesses remain separate atomic
keys», «closing the sole geometric split preserves different thicknesses»)
доказывают лишь общий принцип «разные толщины не сливаются» на двухсегментных
fixture, а не именно на трёхсегментном sub-half-step острове из #198/#197 —
то есть не тот сценарий, который является предметом этой задачи.

**Проверено чтением и исполнением для этого цикла:** `src/wall-thickness.ts`
в диапазоне вообще не изменён — правка целиком локализована в
`src/plan-optimizer.ts`. Я вызвал `normalizeWallIntervals()` и `degradeWalls()`
напрямую (без `collapseIsolatedWallThicknessIslands`) на fixture из AC1 через
собранный `test-build/wall-thickness.js`: результат — 3 записи без изменений
(`22`, `15`, `22`), в точности как до задачи. AC8 функционально выполняется,
но обещанного нового регрессионного теста для него нет.

**Что нужно:** добавить в `test/wall-thickness.test.mjs` фокусированный unit,
вызывающий `normalizeWallIntervals`/`degradeWalls` напрямую на fixture из #198
(либо переиспользовать `microIntervalFixture` из `plan-optimizer.test.mjs`) и
доказывающий, что без прохода через `collapseIsolatedWallThicknessIslands`
три записи остаются как есть.

### Low — нет

Находок уровня Low не выявлено.

## Что проверено и корректно

- **Контракт §6 ТЗ (шесть условий безопасного схлопывания)** реализован
  предметно, а не приблизительно: строгий порог `< 0.5×GRID_PITCH` с
  ulp-допуском (`gridPitch * 1e-9`, комментарий в коде честно объясняет
  зачем), проверка коллинеарности через принадлежность одному `parent`-ребру
  `roomWallProfile`, узловая защита через объединённый список вершин комнат +
  концов `openCuts`, запрет каскада через сбор кандидатов на одном
  pre-change snapshot до применения любых замен.
- **Неоднозначность.** `candidates.get(key).targets` как `Set` корректно
  улавливает случай, когда два разных room-profile или два конфликтующих
  exact-owner’а той же физической стороны называют разную целевую толщину —
  такой кандидат отбрасывается фильтром `targets.size === 1`, дополнительно
  подстрахован проверкой `new Set(owners.map(w => w.cm)).size > 1` на втором
  проходе. Подтверждено и тестом «conflicting exact owners…», и чтением.
  Не забыл проверить именно то, о чём предупреждает ТЗ («если один interval
  участвует в нескольких неоднозначных кандидатах — сохраняется»): единая
  идентичность кандидата по `optimizerSpanKey(a,b)` гарантирует, что один и
  тот же физический интервал не может одновременно быть двумя разными
  candidate-записями.
- **Порядок вставки helper'а** — между `rekeyWallsAfterMove()` и
  `normalizeWallIntervals()` (строки 475–487 `plan-optimizer.ts`), как и
  описано в ревью ТЗ; подтверждено чтением диффа `optimizePlans()`.
  `normalizeWallIntervals()` сразу после схлопывания реально собирает
  22+22 в единый maximal run — воспроизведено вручную (см. пробу к Medium-1),
  результат `normalizeWallIntervals` над выводом `collapseIsolatedWallThicknessIslands`
  даёт один 22-см entry, что и утверждает AC1.
- **Preview/Apply/Cancel/Undo (AC7).** Прогнан целевой browser-smoke против
  production-бандла: preview не пишет на сервер, Cancel не пишет, Apply
  делает ровно один атомарный `houseplan/plan/optimize`, Undo — ровно один
  `houseplan/plan/optimize_undo` и восстанавливает три исходных exact entries
  байт-в-байт. Смежные `smoke_grid_snap` и `smoke_align_guides` (тот же UI
  путь `_openAlignDialog`/`_runAlignToGrid`, задетый вставкой нового шага в
  пайплайн) остаются зелёными — регрессии в остальном поведении Optimize нет.
- **Mutation guard (AC9).** Новый мутант `optimizer-micro-interval-cleanup-disabled`
  корректно бьёт именно в целевую ветку (обходит вызов `collapseIsolatedWallThicknessIslands`,
  оставляя старые lossless-строки), guard-команда сужена
  `--test-name-pattern="isolated thickness micro-interval"` — не общий прогон,
  а именно целевой AC1-тест. Проверено запуском `--id=…`: чистая ветка зелёная,
  мутант красный, «поймано 1 из 1».
- **Идемпотентность и model_version.** Второй `optimizePlans()` на
  результате первого возвращает `changed: false`, `canonicalized: 0`,
  `wallsMerged: 0`, конфиг побитово идентичен — воспроизводит ключевой факт из
  тела issue #198 («Повторный optimizePlans() считает такую конфигурацию
  канонической») ровно наоборот: после первого прохода дальше сходиться
  нечему. `PLAN_MODEL_VERSION` не менялся этим issue (версия и её
  bump-условие не тронуты).
- **Non-scope соблюдён.** Ни `normalizeWallIntervals()`, ни `degradeWalls()`,
  ни `wallIntervals()`, ни persisted schema не изменены — подтверждено:
  `git diff` в `src/wall-thickness.ts` пуст. Backend, i18n, миграция схемы
  не затронуты — соответствует ТЗ §5/§12.
- **Документация и трейлеры.** `docs/CHANGELOG.md` + `.ru.md` в одном
  коммите с кодом, `Issue: #198` / `User-Visible: yes` на месте;
  `docs/USER-GUIDE.ru.md` формулирует правило в терминах, согласованных с
  `docs/WALL-THICKNESS.md` (изолированный участок / одна толщина с обеих
  сторон / нет вершины комнаты или границы проёма — совпадает дословно);
  `docs/WALL-THICKNESS.md` §3 отдельно фиксирует lossless-инвариант рантайма
  против lossy-исключения Optimize, не ослабляя первое.
- **Три копии бандла синхронны.** `cmp` дал совпадение бит-в-бит для
  `dist/`, `custom_components/houseplan/frontend/` и `demo/srv/assets/`.

## Чего не проверял

- Полный HA backend harness (`tests_backend` под настоящим Home Assistant) —
  диапазон не содержит правок в `custom_components/**/*.py`.
- `npm run golden:verify` и полный browser-smoke набор (127 файлов) — не
  оправданы объёмом диффа; см. таблицу «Не прогонялось и почему» выше.
- Производительность/бенчмарки — не названы в AC, изменение — O(rooms×edges)
  проверка соседства на действующих малых `wall list`, вне render/state tick.
- Поведение на реальном сохранённом плане пользователя из #197/#199/#201 (вне
  синтетических fixture) — не воспроизводилось; unit и smoke используют
  минимальные искусственные fixture, что соответствует ТЗ (полноразмерный
  25-wall/#197 fixture назван в ТЗ как желательный для unit-матрицы, но не
  является отдельным обязательным AC).

## Вывод

High-находок нет, обе Medium-находки — в скоупе этой же задачи (собственные
AC198, не постороннее поведение), поэтому решение не заводит отдельный issue
(#202), а возвращает задачу автору. Обе находки — не баг в коде (поведение
проверено вручную и корректно), а недостача именно обещанных ТЗ автотестов
для AC5 и AC8. Требуется: добавить unit из «Что нужно» в обеих находках и
повторно прогнать `npm test` + целевой mutation-guard.
