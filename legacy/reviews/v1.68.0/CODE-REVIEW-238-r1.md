# CODE-REVIEW-238-r1

- Issue: [#238](https://github.com/Matysh/houseplan-card/issues/238) — «Превью проёма: показывать расстояния до внутренних граней комнаты и стен»
- Этап: код-ревью (PROCESS.md §2.7), заход **r1**, блокирующих циклов израсходовано **0/4** до этого разбора
- Ветка: `issue/238-opening-inner-distances`
- Проверяемый диапазон: `origin/dev...HEAD`
- Коммиты в диапазоне:
  - `0498dda` docs(spec): define opening inner-distance guides — `User-Visible: no`
  - `cc056a7` docs: review document for #238 (артефакт ревью ТЗ, зелёный) — `User-Visible: no`
  - `553fb27` feat: measure opening preview to inner faces — `User-Visible: yes`
  - `e553875` docs: refresh screenshot provenance for #238 — `User-Visible: no`
- Спецификация: `docs/specs/238-opening-inner-distances.md`, ТЗ-ревью зелёное (r1), SHA `0498dda`.
- r1 — полный разбор, раздел «объём по дельте» (§2.10) неприменим.

## Скоуп

Задача заменяет две legacy-подписи превью размещения нового проёма (расстояния
до концов выбранного осевого отрезка) на 2/4 физические размерные линии до
ближайших внутренних граней комнаты(-ат) либо примыкающих
стен/перегородок независимой стены, с fallback к прежнему поведению. Перенос
уже сохранённого проёма, snap/jamb/click/save, i18n и persisted fields — вне
скоупа и не должны меняться.

## Как проверялось

Дешёвые гейты (гоняются всегда):

| Гейт | Результат |
|---|---|
| `npx tsc --noEmit` | OK, чисто |
| `npm test` | 1048 passed, 0 failed (инвентарь `npm run inventory`: Node unit 1048) |
| `npm run build` | OK |
| сверка `dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/` после **своей** пересборки | **совпадают друг с другом** (`de9576d3…`), но **не совпадают с тем, что закоммичено в HEAD** — см. находку H1 |
| `node scripts/check-docs.mjs` (diff трогает `src/**`) | `Documentation checks passed (7 files, 10 external links)` |

По необходимости (diff меняет геометрию/стили/слои превью → задет рендер):

| Гейт | Результат |
|---|---|
| `node demo/smoke_opening_inner_distances.mjs` | OK **после того, как я вручную пересобрал и синхронизировал бандл**; против бандла, закоммиченного в HEAD, падает с `Error: ... is stale` (см. H1) |
| `node demo/smoke_opening_measure.mjs` | OK (после синхронизации бандла); включает новую регрессионную проверку `existing_drag_has_no_new_dimension_lines` |
| `node demo/smoke_opening_preview.mjs` | OK (после синхронизации бандла) |
| `node demo/smoke_partition_openings.mjs` | OK (после синхронизации бандла) |
| 4 новых mutation guard (`opening-dimensions-use-axis-ends`, `opening-dimensions-collapse-shared-side`, `opening-dimensions-use-crossing-axis`, `opening-dimension-overlay-hidden`) | применил каждый патч вручную и прогнал именно ту guard-команду, что прописана в `scripts/mutation-gate.mjs` — все 4 корректно **красные** на мутанте (тест умеет падать), затем откатил патчи |
| `node demo/golden/run.mjs --mode=capture --scenario=opening-placement-door-thick-wall-dark` / `...-passage-thick-wall-dark` / `...-passage-thick-wall-light` | все три «different» от текущего baseline — ожидаемо: новые линии/засечки/четыре независимых числа видны и в dark, и в light theme (AC13), никакой регрессии в остальной сцене не видно. Baseline не принимал — принятие эталонов не моя роль и не роль автора в этом цикле |
| полный `npm run golden:verify`, `performance_smoke`, HA backend harness | не гонял — это пре-релизный гейт (PROCESS.md/AGENTS.md), задача его не касается напрямую (backend/perf пути не тронуты) |

Полный список гейтов, что не гонялись и почему — раздел «Чего не проверял».

## Находки

### H1 — Продуктовый коммит не обновил скомпилированный бандл; закоммиченный артефакт не содержит фичи #238, заявленные прогоны против него не воспроизводятся

**Файлы:** `dist/houseplan-card.js`, `custom_components/houseplan/frontend/houseplan-card.js`, `demo/srv/assets/houseplan-card.js` (не изменены коммитом `553fb27`, который правит `src/houseplan-card.ts`, `src/opening-dimensions.ts`, `src/styles.ts` и несёт `User-Visible: yes`).

**Воспроизведение:**

```
$ git show 553fb27 --stat
 ... src/houseplan-card.ts | 101 +++++--
 ... src/opening-dimensions.ts | 474 ++++++++++++
 ... src/styles.ts | 22 ++
 # ни dist/**, ни custom_components/houseplan/frontend/houseplan-card.js,
 # ни demo/srv/assets/houseplan-card.js в диффе НЕТ

$ git show HEAD:dist/houseplan-card.js | sha256sum
1d2c76828560e1a3cb26e2361b1efd5b082ace1fc31cbc553ac64e19793ee2e4  -
$ git show HEAD:custom_components/houseplan/frontend/houseplan-card.js | sha256sum
1d2c76828560e1a3cb26e2361b1efd5b082ace1fc31cbc553ac64e19793ee2e4  -   # тот же — три копии внутри самих себя синхронны
$ git show 3aba493:dist/houseplan-card.js | sha256sum   # точка ветвления, до всех коммитов #238
1d2c76828560e1a3cb26e2361b1efd5b082ace1fc31cbc553ac64e19793ee2e4  -  # идентичен HEAD — бандл не менялся вообще за все 4 коммита

$ npm run build && sha256sum dist/houseplan-card.js
de9576d3cf6b078eead36a472c20ab7f87284aeb18c34239383d4a31d4a3a707  dist/houseplan-card.js
# это ТОЧНО тот хеш, который автор указал в комментарии к issue как результат
# "три bundle после сборки — byte-for-byte одинаковы" — но этот хеш НЕ совпадает
# с тем, что лежит в закоммиченных dist/custom_components/demo копиях.

$ cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js
dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js differ: char 1, line 1
# именно эту команду выполняет CI job `frontend` на шаге "Card bundle snapshots
# in sync" — он покраснеет на этой ветке.

$ node demo/smoke_opening_inner_distances.mjs   # против бандла как закоммичен в HEAD
Error: demo/srv/assets/houseplan-card.js is stale. Run npm run build and copy
dist/houseplan-card.js to demo/srv/assets/houseplan-card.js first. ...
```

После того как я сам пересобрал (`npm run build`) и скопировал `dist/houseplan-card.js`
в обе остальные локации, все 4 связанных с задачей smoke ушли в OK, а 4 mutation
guard корректно красные на мутантах — то есть **сама логика и покрытие корректны**,
дефект строго в том, что коммит `553fb27` не донёс пересборку до трёх
отслеживаемых копий.

**Почему это High, а не Low/Medium:**

1. **Не работает как заявлено.** `custom_components/houseplan/frontend/houseplan-card.js` — это файл, который реально грузит Home Assistant; в закоммиченном виде он не содержит код #238 вообще. Задача с `User-Visible: yes` в текущем состоянии не видна пользователю.
2. **Ломает CI.** `frontend` job из `.github/workflows/validate.yml` (шаг «Card bundle snapshots in sync», строки 248–251) выполняет именно `cmp dist/houseplan-card.js custom_components/houseplan/frontend/houseplan-card.js` — воспроизведено выше как красное.
3. **Заявления в комментарии к issue не подтверждаются при проверке.** Комментарий разработчика прямо называет SHA-256 `DE9576D3…` как результат сверки трёх бандлов и рапортует зелёные прогоны 4 smoke-тестов — оба утверждения не воспроизводятся на закоммиченном дереве: хеш совпадает с тем, что получается при пересборке из исходников, а не с тем, что реально лежит в репозитории, а smoke падает на проверке свежести бандла, а не проходит. И того «Verified без названной команды и её результата — не доказательство» здесь ровно наоборот: команда названа, но её результат при точном повторении иной.
4. Разрыв не локальный/косметический: это тот самый контракт из `AGENTS.md` («After building, keep all three bundle snapshots in sync — CI compares them byte-for-byte»), и во всех предыдущих feature-коммитах этого репозитория (например `abfaae3`, `691cea0`) три копии обновлялись в том же коммите.

**Фикс** (не мой — только автору): пересобрать (`npm run build`), скопировать `dist/houseplan-card.js` в обе остальные локации и закоммитить это вместе с (или сразу после) `553fb27`, затем убедиться, что `cmp` проходит и именованные smoke идут OK против дерева как закоммичено — а не только локально до коммита.

Других High/Medium находок нет.

## Что проверено и корректно

- **AC1/AC2 (rectangle + mitre, unit).** `test/opening-dimensions.test.mjs` кейсы «room dimensions stop at inner faces…» и «an angled adjacent wall ends the room dimension at the real mitre…» проходят; прогнал мутант `opening-dimensions-use-axis-ends` (правит `roomPair`, подставляя `basis.targetLo/Hi` вместо реального `run`) — тест падает как ожидается.
- **AC3 (shared wall, 4 значения, unit+smoke).** Unit-кейс «shared wall keeps two independently resolved room sides» проходит с 4 разными числами `[100, 80, 100, 90]`; браузерный smoke `sharedFourLines/sharedRoomOrder/sharedIndependentValues/sharedOppositeFaces` — все true после синхронизации бандла; мутант `opening-dimensions-collapse-shared-side` (порог `owners.length > 1` вместо `> 2`) корректно роняет unit-тест.
- **AC4 (вогнутая комната, unit).** «a concave room uses only the connected inner-face run» проходит: несвязный коллинеарный участок не подхватывается.
- **AC5–AC7 (независимая перегородка: T/косой стык, one-sided fallback, непримыкающая стена/торец, unit).** Все соответствующие unit-кейсы проходят, включая диагональ через полигон-пересечение (не вычитание half-width). Мутант `opening-dimensions-use-crossing-axis` (заменяет `halfDepth` тела на `epsilon`, схлопывая тело к оси) корректно роняет unit-тест на конкретном числовом значении (`109.999999` вместо `90`).
- **AC8 (2 линии/4 засечки на комнату, 4 линии/8 засечек на shared wall, overlay pointer-inert + aria-hidden, smoke).** Проверено чтением `_renderOpeningDimensionGuides` (aria-hidden="true", pointer-events="none" на группе, CSS `pointer-events: none` на классах `.opening-dimensions/.opening-dimension/.opening-dimension-line/.opening-dimension-tick`) и исполнением: smoke `singleTwoLines`/`sharedFourLines` считают ровно нужное число `<line>`/`<g class="opening-dimension">`; мутант `opening-dimension-overlay-hidden` (убирает вызов рендера линий) корректно проваливает 4 проверки smoke (`singleTwoLines`, `singleGeometry`, `sharedFourLines`, `partitionTwoLines`).
- **AC9 (pointermove двигает числа/from-to вместе с preview; click/save/x-y-angle-length/jamb/serial-preset не меняются).** `resolveOpeningPlacementResult`, валидация jamb, `_openingClick`/сохранение и serial-preset код не тронуты диффом (grep подтверждает: правки локализованы в построении `labels`/новом рендер-методе). Smoke `liveUpdate` подтверждает синхронное обновление чисел и `from/to` при движении указателя; `clickKeepsCandidate` подтверждает, что клик резолвит тот же candidate и снимает все размерные guide.
- **AC10 (центр-магнит/тик остаются осевыми; Shift не выключает магнит; физические размеры не участвуют в snap, smoke + ревью кода).** Проверено чтением: `core.measure.guide` передаётся без изменений (`{ ...core, face, measure: { labels, guide: core.measure.guide } }`), центр-тик рендерится тем же путём, что раньше; физические размеры строятся из уже разрешённого `candidate` и не влияют на pointer/snap. Smoke `centerMagnet` подтверждает исполнением.
- **AC11 (drag существующего проёма сохраняет 2 legacy-подписи, без новых линий, smoke).** `_opRuler`/`openingShoulders` (строки ~12200–12262) не изменены и не участвуют в новом резолвере; лейблы из drag-пути не несут поля `dimension`, поэтому `_renderOpeningDimensionGuides` для них ничего не рисует. Подтверждено smoke: `demo/smoke_opening_measure.mjs` → новая проверка `existing_drag_has_no_new_dimension_lines` = 0 совпадений `.opening-dimension`.
- **AC12 (metric/imperial через существующий `formatLength`; без новых i18n-ключей и persisted fields, unit + ревью кода).** `labels = dimensions.map(... formatLength(...))` — тот же вызов, что был; diff не трогает `src/i18n/*.json`, `types.ts`-персистентные поля не добавлены.
- **AC13 (тема light/dark, различимость, отсутствие перекрытия, golden + ревью артефакта).** Захватил (не приняв) 3 golden-сцены, которые матрица уже использует для placement-preview (`opening-placement-door-thick-wall-dark`, `opening-placement-passage-thick-wall-{dark,light}`); во всех трёх новые оранжевые линии/засечки видны и в тёмной, и в светлой теме, 4 подписи на общей стене визуально разнесены и не перекрываются — соответствует спеке §9.4. Baseline закономерно не принят ни автором, ни мной (это пре-релизный шаг с `--reviewed`).
- **AC14 (не вызывать plan-wide polyclip/boolean на pointermove; статический контекст переиспользуется, unit со счётчиком/ревью кода).** Прочитано: дорогие вызовы (`roomWallProfile`, `insetContour`, `wallEdgeBodies`) находятся только внутри `buildOpeningDimensionContext`, которая кешируется по тому же `placementKey`, что и существующий `_openingPlacementIntervalsCache` (тот же паттерн, что уже был до #238). `resolveOpeningDimensions` на каждый pointermove делает только проекции/пересечения луча по уже готовым структурам. Smoke `contextReused` подтверждает, что объект контекста не пересобирается между двумя `pointermove` без изменения geometry epoch.
- **AC15 (оба changelog и оба USER-GUIDE в одном user-visible коммите, provenance + ревью кода).** `553fb27` — единственный коммит с `User-Visible: yes` — правит `docs/CHANGELOG.md`, `docs/CHANGELOG.ru.md`, `docs/USER-GUIDE.md`, `docs/USER-GUIDE.ru.md` одновременно с продуктовым кодом. Трейлеры `Issue: #238` на месте на всех 4 коммитах диапазона.
- **Скоуп.** `src/opening-placement.ts` и `src/resize.ts` не тронуты; drag существующего проёма, snap/jamb/валидация/сохранение геометрически не изменены (подтверждено grep + чтением).
- **Docs-гейт.** `node scripts/check-docs.mjs` зелёный после того, как diff обновил все 10 скриншотов и `screenshots.json` в том же коммите, что и правки `src/**` (коммит `e553875` идёт следом за `553fb27`, оба несут `Issue: #238`; фингерпринт считается по всему дереву на момент коммита, так что порядок двух коммитов подряд в одном PR не создаёт разрыва).

## Чего не проверял

- **Полный `npm run golden:verify` / `golden:accept`** — инструмент сам запрещает частичный `--mode=verify` («golden verify must run the complete matrix»); гонял точечный `--mode=capture --scenario=...` только для трёх сцен, которые матрица уже использует для placement-preview. Остальные ~150 golden-сцен не пересобирал — задача не трогает other-rendering пути, а полный прогон — предрелизный гейт.
- **`performance_smoke`** — не назван в AC, диф не тронул чувствительные к перфу пути помимо кеша, разобранного по коду (AC14); не гонял.
- **`python -m pytest tests_backend -q`** — diff не трогает `custom_components/**/*.py`; не гонял.
- **Остальные ~160 browser smoke, не относящиеся к теме** — не прогонял; выбрал по grep изменённых сущностей (`openingShoulders`, `OpMeasure`, `.opening-dimension`, `opening-dimensions.ts`) и по AC: `smoke_opening_inner_distances`, `smoke_opening_measure`, `smoke_opening_preview`, `smoke_partition_openings`.
- **Полная HA-harness backend-сборка** (`.venv-backend`) — не запускал, задача не задевает backend.
- **Полный прогон `scripts/mutation-gate.mjs` без фильтра** — попытался, инструмент не поддерживает выборочный запуск (проходит по всем мутантам последовательно) и упёрся в несвязанную backend-зависимость (`No module named pytest` на непричастном к задаче python-мутанте); вместо этого применил каждый из 4 новых патчей вручную и выполнил именно ту guard-команду, что записана в `MUTANTS[]` для каждого — все 4 воспроизводимо красные на мутанте.

## Вердикт

Логика, покрытие тестами и mutation guards, документация и границы скоупа —
корректны и полностью проверены (по коду и исполнением). Но задача в текущем
виде **не деплоится**: закоммиченный бандл не содержит фичи, заявленные в PR
прогоны против него не воспроизводятся, а `frontend` CI job закономерно
покраснеет на шаге сверки трёх копий бандла. High-находка блокирует.

**Вердикт: красный · заход r1 · блокирующих циклов 1/4 · High: 1 · Medium: 0 → в задаче**
