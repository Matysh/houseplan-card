# CODE-REVIEW-273-r1

- Issue: [#273](https://github.com/Matysh/houseplan-card/issues/273) — Optimize сохраняет sub-grid островок толщины у T-узла: 22→15→22
- Этап: код-ревью, заход r1, блокирующих циклов израсходовано 0 из 4
- Диапазон: `origin/dev...HEAD`, коммиты
  `e2de0db` (spec r1→r2 правка), `3e8733a`/`6e2247a` (ревью-документы ТЗ),
  `105a8f7` (`fix: collapse thickness island beside one T-node`),
  `3ab3cdc` (`docs: record optimizer topology evidence`)
- ТЗ: `docs/specs/273-optimize-topology-island.md`, ревью ТЗ зелёное на r2
  (`docs/reviews/SPEC-REVIEW-273-r2.md`)

## Скоуп проверки

Продуктовое изменение — один файл: `src/plan-optimizer.ts`
(`collapseIsolatedWallThicknessIslands`). Остальное — тесты/фикстуры
(`test/plan-optimizer.test.mjs`, `demo/smoke_optimize_micro_interval.mjs`,
`scripts/mutation-gate.mjs`) и документация/changelog. Бэкенд
(`custom_components/**/*.py`) не тронут, i18n-ключи не добавлены, миграций и
compatibility-полей нет — соответствует §5 ТЗ («Не входит»).

Коммит `105a8f7` несёт `Issue: #273` и `User-Visible: yes` с правками в обоих
changelog в том же коммите; `3ab3cdc` — `User-Visible: no`, только скриншот и
его манифест. Ветка `issue/273-optimize-topology-island`, трейлеры
корректны.

## Как проверялось

### Разбор кода (диф `src/plan-optimizer.ts`)

Старое условие `#198`:

```ts
if (isTopologyNode(a) || isTopologyNode(b)) continue;
```

где `nodes` был единым списком room-vertices + opening-endpoints. Новое:

```ts
if (isNode(a, openingNodes) || isNode(b, openingNodes)) continue;
if (isNode(a, roomNodes) && isNode(b, roomNodes)) continue;
```

Разбор по истине/лжи:
- любой конец на opening/open-span endpoint → блок, как и раньше (условие не
  ослаблено для проёмов);
- **оба** конца — room/T-topology vertex → блок (сохраняет AC3, «два topology
  endpoints»);
- **ровно один** конец — room-vertex, второй не room-vertex и не opening → **не
  блокируется** — это и есть узкое расширение, заявленное ТЗ §6.2;
- **ни один** конец не room-vertex и не opening → не блокируется, как и в
  исходном коде #198 (случай, к этой задаче не относящийся, поведение не
  изменилось).

`roomNodes`/`openingNodes` строятся из **всех** комнат/`openCuts` конфигурации
(не только текущей комнаты профиля), поэтому «T-узел» ловится, даже если он
только вершина другой (перпендикулярной) комнаты — ровно репродукция из
issue, где island соседствует с T-узлом чужого профиля.

Кандидат по-прежнему требует, чтобы все три куска (`left`/`centre`/`right`)
были детьми одного `profile.parent` — то есть лежали на одном исходном прямом
polygon-edge. Я проверил отдельно тест `atVertex` (унаследованный из #198,
не переписанный этим диффом): там вершина комнаты вставлена **внутрь** того
же ребра, что физически расщепляет `parent`-группу на два разных индекса —
кандидат поэтому даже не собирается, независимо от новой классификации узла.
Это значит, что тест продолжает проходить не потому, что «одна вершина всё
ещё блокирует», а потому что расщеплённый parent — другая причина блокировки;
семантического противоречия с новым правилом нет, но стоит иметь в виду при
следующем изменении этой логики: вставка вершины в середину ребра и «настоящий»
T-узел от другой комнаты — разные code path, и оба сейчас блокируют/пропускают
корректно, но по разным причинам. Не заводил как находку — это наблюдение о
устройстве кода, не дефект.

`collapseIsolatedWallThicknessIslands` не мутирует входные `rooms`/`walls`
(проверено чтением: `out = walls.slice()`, `[...a, ...b]` копии в
`exactMatches`) и вызывается ровно из одного места —
`plan-optimizer.ts:501`, внутри цикла `optimizePlans()`, до
`normalizeWallIntervals()`/`degradeWalls()`. Runtime/Save/render helpers его
не вызывают (AC7 подтверждён чтением, не исполнением).

### Гейты — что прогнано и с каким результатом

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | чисто, без ошибок |
| Unit | `npm test` | `# tests 1163 / pass 1163 / fail 0 / skipped 0` |
| Build + bundle parity | `npm run build`, затем `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` и `npm run bundle:sync` + `cmp` с `demo/srv/assets/houseplan-card.js` | все три копии побайтово совпадают |
| Docs fingerprint | `node scripts/check-docs.mjs` | `Documentation checks passed (7 files, 10 external links)` — подтверждает, что принятые скриншоты (`3ab3cdc`) соответствуют текущему `src/**` |
| Целевой mutation | `node scripts/mutation-gate.mjs --id=optimizer-single-topology-island-blocked` | `поймано 1 из 1`; чистый прогон (`--test-name-pattern="issue 273 Optimize"`) зелёный, мутант (замена `&&` на `\|\|` в новом условии, т.е. откат к «любой конец — room-node» блокирует) красит тест — дисциплина «тест умеет падать» подтверждена лично, а не со слов автора |
| Выбор смоков | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | «Прямое совпадение» только `demo/smoke_decor_layer_order.mjs` (символ `roomPoly`); порог «широкого» символа — 34, здесь 1 |
| Смок из выбора | `node demo/smoke_decor_layer_order.mjs` | `OK`, все 25 проверок `true` |
| Целевой смок из AC6 | `node demo/smoke_optimize_micro_interval.mjs` | `OK`, все 11 проверок `true`, включая новую `reloadKeepsCanonicalRun: true` |
| Инварианты модели | входят в `npm test` (`test/model-invariants.test.mjs` подпадает под `test/*.test.mjs`) | зелёные в общем прогоне |

### Гейты, которые не прогонял, и почему

- **`npm run golden:verify`** — не прогонял. Diff меняет геометрию только в
  узко описанном граничном случае (island у ровно одного T-узла на прямом
  ребре); проверил `demo/golden/matrix.mjs` — единственные Optimize-сценарии
  в golden это `optimize-preflight-dialog-*` и
  `optimize-orphan-references-*`, оба про диалоги на фиксированном пространстве
  `golden-geometry`, не про эту конкретную топологию стен. Полный набор —
  предрелизный гейт (§8 PROCESS.md), совпадений с этим фиксом не нашёл, поэтому
  сознательно пропущен на этом раунде.
- **`python -m pytest tests_backend`** — не прогонял, диф не касается
  `custom_components/**/*.py` (подтверждено `git diff --stat`).
- **Полный smoke-набор** (`ls demo/smoke_*.mjs`) — не прогонял целиком, задача
  локальна к одному optimizer-хелперу; прогнаны названный в AC6 смок и
  единственный смок, на который указал `smoke-select`.
- **Performance-профили** — не названы в AC, изменение не на чувствительном к
  перфу пути (единичный, admin-only Optimize pass, не render/state-tick).
- Screenshot-приёмку (`docs/images/09-device-info.png`, `screenshots.json`)
  не переснимал и не сверял попиксельно вручную — доверился тому, что
  `check-docs.mjs` подтверждает согласованность зафиксированного
  `sourceFingerprint` с текущим деревом, и записи автора о Linux Chromium
  `151.0.7922.34`, 10/10, единственная разница 17 px/1 канал в
  anti-aliasing зоне, не связанной с этой задачей.

## AC — доказательства

| AC | Как доказан | Проверено |
|---|---|---|
| AC1 (реальный 22→15→22 у T-node схлопывается) | `test('issue 273 Optimize collapses the beta.5 island beside one T-node')`: minimised fixture с T-узлом от отдельной `branch`-комнаты; проверяет `walls.length===1`, `cm===22`, точные `a`/`b`, `wallsMerged===2` | Тест умеет падать: без фикса `atVertex`-класса блокировки candidate не собрался бы (`walls.length` осталось бы 3) — подтверждено мутационным гейтом |
| AC2 (визуальная толщина ровная) | Тот же тест: `wallBodiesGeometry()` + `pointInPhysicalGeometry` пробы в 3 точках вдоль бывшей ступени, подтверждают непрерывную внешнюю грань | Пробы стоят только **после** Optimize; отдельного «до»-пробника, различающего 15/22 см half-depth, в диффе нет — тесту это не обязательно (перед Optimize `wallIntervals` явно содержит `cm===15`, что доказывает наличие ступени иначе), но расположение доказательства не совпадает с ТЗ, которое ожидало его в `test/wall-thickness.test.mjs`. Файл не критичен, доказательство по существу есть — фиксирую как Low, не блокирует |
| AC3 (два topology endpoints защищены) | Новый тест `betweenTwoNodes` в `'micro-interval cleanup preserves ambiguous and topological boundaries'`: island между двумя настоящими T-узлами (`branch` + `branch-2`) остаётся `deepEqual` исходным walls | Проверено исполнением |
| AC4 (остальная negative-матрица #198 зелёная) | Существующие тесты (`unequal`, `overlapping`, `atVertex`, `atOpening`, `chain`) не переписаны, прогнаны в том же файле | `npm test` зелёный |
| AC5 (детерминизм/immutability) | Существующий тест `'micro-interval cleanup is endpoint, input-order and room-order invariant without mutation'` не тронут этим диффом; код классификации узла не участвует в порядке применения кандидатов | Унаследовано: логика сортировки/применения кандидатов (`[...candidates.values()].filter(...).sort(...)`) этим диффом не менялась — только предикат допуска |
| AC6 (Preview/Apply/Undo/idempotence) | `demo/smoke_optimize_micro_interval.mjs`, прогнан лично | `OK`, 11/11 true, включая добавленный `reloadKeepsCanonicalRun` |
| AC7 (runtime lossless) | Единственный call site `collapseIsolatedWallThicknessIslands` — `plan-optimizer.ts:501` внутри `optimizePlans()` | Проверено чтением, не исполнением |
| AC8 (мутант ловит широкий guard) | `scripts/mutation-gate.mjs`, id `optimizer-single-topology-island-blocked`, патч `&&`→`\|\|` на новой строке | Прогнан лично: `поймано 1 из 1` |
| AC9 (локальные гейты) | См. таблицу выше | Все, что применимо к диффу, прогнаны |

## Находки

Блокирующих (High) и находок в скоупе (Medium) нет.

**Low** (не блокирует, оставляю на усмотрение — по правилам §2.7 Low либо
правится, либо снимается решением ревьюера с записью; снимаю без правки):

1. **AC2 доказательство лежит не в заявленном файле.** ТЗ (§9 AC2) ожидало
   focused geometry unit в `test/wall-thickness.test.mjs`; по факту гео-пробы
   добавлены прямо в `test/plan-optimizer.test.mjs` (импортирует
   `wallBodiesGeometry`/`pointInPhysicalGeometry` оттуда). Доказательство по
   существу присутствует и я его исполнил — файл иной, но эквивалентен по
   покрытию. Снимаю без правки: место теста — техническое решение автора
   (§7.1 PROCESS.md — «где хранится тест» не наблюдаемо пользователем).
2. **Одно число — один источник**: новый код не вводит ни одного нового
   видимого пользователю числа (спецификация прямо фиксирует «Нового
   счётчика/строки нет», и это так — `wallsMerged` считается там же, где и
   раньше, единственным местом в `optimizePlans()`, и отображается в preview
   из того же `report`). Проверка выполнена, риска дублирования источника не
   нашёл — фиксирую факт проверки, а не находку.

## Что проверено и корректно

- Контракт §6.2 ТЗ (ровно один T-endpoint, второй синтетический, не opening и
  не второй topology node) реализован именно так, как описан, включая случай,
  когда T-узел приходит от вершины **другой** комнаты, а не от вставки в тот
  же profile-edge.
- §6.3 («всегда блокирующие случаи») сохранены: opening endpoint блокирует
  безусловно (проверка идёт первой), два topology endpoints блокируют, разные
  соседние `cm` не создают кандидата (`leftCm !== rightCm` уже до вызова
  `isNode`), конфликтующие exact owners отклоняются (`new Set(...).size > 1`
  → `continue`) — покрыто существующим тестом `overlapping`.
- T-node координата и инцидентная перпендикулярная комната действительно не
  меняются (AC1-тест сверяет `rooms` побайтово через
  `canonicalizeConfigGeometry`).
- Документация (`WALL-THICKNESS.md`, `CONFIG-COMPATIBILITY.md`, `TESTING.md`,
  `USER-GUIDE(.ru).md`) точно описывает новый контракт и не содержит
  устаревшего/чрезмерного обещания про partition/draft (то, что было Medium
  на ревью ТЗ r1, закрыто в §14 п.4 предположением — код действительно не
  принимает `partitions`/`drafts` на вход этого хелпера, что подтверждает
  сигнатура функции).
- Changelog RU+EN обновлены в том же коммите, что и поведение
  (`User-Visible: yes`).
- Три копии бандла синхронны, typecheck и полный unit-набор зелёные.

## Чего не проверял

См. раздел «Гейты, которые не прогонял, и почему» выше: `golden:verify`
(полный набор, предрелизный гейт, ни один golden-сценарий не задевает эту
топологию), `pytest tests_backend` (бэкенд не тронут), полный smoke-набор
(прогнаны только AC6-смок и смок из `smoke-select`), performance-профили (не
названы в AC), попиксельная сверка PNG-скриншота вручную (доверился
`check-docs.mjs` + записи автора).

## Вердикт

Зелёный. AC1–AC9 доказаны — либо исполняемым тестом, который я прогнал лично
и для AC1/AC8 подтвердил его способность падать через mutation-gate, либо
(AC5, AC7) чтением кода с явной пометкой «проверено чтением, не исполнением».
High и Medium-в-скоупе находок нет; два Low сняты без правки с записью выше.
