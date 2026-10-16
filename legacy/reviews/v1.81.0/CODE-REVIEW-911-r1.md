# CODE-REVIEW-911-r1

Issue: [#911](https://github.com/Matysh/houseplan-card/issues/911) — «Толщина стены: сохранять выделение редактируемой стены при открытом диалоге».
Трек: `ask`. Этап: code. Заход: r1 (первый код-ревью раунд; разбор по дельте
«Повторный раунд» не применяется — предыдущий зелёный раунд относится к этапу
spec, `SPEC-REVIEW-911-r1.md`).

Материал: `6a53ba44b86043a734cb5bc91158f35aacc2e54f` (рабочая копия на нём,
`git rev-parse HEAD` сверен). Диапазон `origin/dev..HEAD` — три коммита:

- `432145d9` `fix(editor): retain the wall selected by thickness dialog` — продукт, `Issue: #911` / `User-Visible: yes`, оба changelog в этом же коммите.
- `a691bd56` `docs: record issue 911 frozen dependency checkpoint` — docs-only (class C), `Issue: #911` / `User-Visible: no`.
- `6a53ba44` `docs(editor): record resumed wall-selection proof` — docs-only (class C, подтверждено `change-classes.mjs` → `C`), трейлеры не обязательны для чисто C; см. «Находки» Low-1.

## Скоуп

ТЗ (issue body, раздел `## ТЗ`) принято зелёным на этапе spec (`SPEC-REVIEW-911-r1.md`,
High 0 / Medium 0). Код-ревью проверяет: делает ли реализация ровно заявленное
(AC1–AC4), не расширяет ли hit testing/геометрию/Apply/Undo/камеру/#900, не
трогает ли View/kiosk и touch-контракт, корректны ли трейлеры, changelog,
release-ledger и объём гейтов.

Классы риска из промпта (`wallThicknessSelection`/`WallThicknessTarget`,
geometry) — все в границах нового файла `src/wall-thickness-selection.ts` и
расширения `_renderWallThickUi`/`_wallThickClick` в
`src/houseplan-editor-runtime.ts`; все AC ТЗ (AC1–AC4) их покрывают — см.
разбор по AC ниже.

## Как проверялось

Дешёвые гейты на этом SHA подтверждены Validate (success,
https://github.com/Matysh/houseplan-card/actions/runs/38795853011). Тот же
workflow-run на проверку содержал задания `Golden-кадры против принятых
эталонов` → success и все три шарда `Смоки в браузере` → success — визуальный
и полный browser-smoke гейт на этом SHA тоже зелёные, не только
typecheck/test/build. Несмотря на это, я переисполнил typecheck/build/unit и
точечные AC-смоки лично (ниже), чтобы не полагаться только на чужую ссылку.

| Гейт | Статус | Примечание |
| --- | --- | --- |
| `npx tsc --noEmit` / `npm run build` | PASS (повторно, локально) | `npm run build` → `created dist in 23.4s`; дерево после возвращено `npm run bundle:clean` (подтверждено `git status --porcelain`, пусто) |
| `npm test` (полный, 5029 тестов) | PASS 5028/5028 — см. примечание | Прогнал дважды. С заранее восстановленным закоммиченным (`bundle:clean`) бандлом один тест красный: `#627 AC3 словари пространств…` (`test/bundle-assets.test.mjs:1370`) — закоммиченный `dist/` отстаёт от текущего `src/i18n/topology/en.json` (другая формулировка той же строки про скан). Это артефакт моей методики (CI-job `Фронтенд…` сначала пересобирает `dist/` шагом `Build`, затем гоняет `Unit tests`; я сначала откатил бандл к закоммиченному), а не дефект диффа #911 — он i18n/topology не трогает. Повторный `npm run build` без `bundle:clean` перед тестом → 0 fail. CI-прогон на этом же SHA (job 116632056179) также показывает `# pass 5028 / # fail 0`. После проверки дерево снова возвращено `bundle:clean` в закоммиченное состояние |
| `node --test test/wall-thickness-selection.test.mjs` | PASS 5/5 | новый unit-файл, разобран построчно (см. «AC3») |
| `demo/smoke_wallthick_standalone.mjs` (AC1/AC2/AC4, прогнан лично) | PASS, 49/49 (включая 39 новых `911 AC*`) | единственный смок, названный в самом ТЗ |
| Смоки прямого совпадения, тронутые тем же диалогом/инструментом (`smoke_wall_thickness`, `smoke_wall_thickness_transition`, `smoke_zero_walls`, `smoke_resize_inner_dimensions`, `smoke_opening_measure`, `smoke_junction_limits`, `smoke_optimize_coincident_partition`, `smoke_hide_layers`) | PASS (8/8) | точечная выборка по риску из `smoke-select` (56 прямых совпадений всего — полный прогон непропорционален объёму задачи, см. «Чего не проверял») |
| `node scripts/mutation-gate.mjs --check` | PASS, статически | 377/200 (было 374/200, +3 новых browser-guard — учтены в `docs/testing-notes/mutation-browser-guards.md`); все 6 новых `wall-selection-*` объявлений видны и `ok`; `execution=0, caught=unknown` — это ожидаемо (мутанты не исполняются вне ночи, #709/#905) |
| `node scripts/process-gate.mjs --range origin/dev..HEAD --issues --report` | PASS, 0 предупреждений | трейлеры/классы/статус issue (`S7-code-review`) сошлись |
| Release-ledger / changelog | Корректны | см. «Что проверено и корректно» |

Мутанты не исполнялись (ни точечно, ни временным патчем) — политика
«Отрицательные проверки и мутанты» запрещает это вне ночного workflow даже
ревьюеру; для каждого защитного AC ниже назван id зарегистрированного
свидетеля с честным «не исполнялся», либо обычный негативный случай
исполненного unit/native теста с результатом.

## Разбор по AC

**AC1** (native smoke, ordinary). `demo/wallthick-selection-scenario.mjs`
открывает диалог Thickness публичным кликом (toolbar + `page.mouse.click`,
не приватным `_wallDialog=`) для room и partition, проверяет `dialog: true`,
ровно одну полосу (`bands===1`) и что она покрывает цель (`targetFilled`) —
выполнено и зафиксировано локально (`selection public opening room {...}`,
`partition {...}`, `OK`). Защитный узел — `wall-selection-hidden-with-dialog`
(патчит `const hover = d ? selected : ...` → `d ? null : ...`): не исполнялся
в этом раунде (политика), но логически ловится ровно тем же `bandAt`/`bands
=== 1` assertion, прочитано построчно.

**AC2** (тот же native smoke). Держит одна полоса при held/terminal drag
диалога, held/terminal pan, zoom, resize — сценарий проверяет экранный
прямоугольник полосы через `getScreenCTM()`-трансформацию и реальное
перемещение диалога/камеры (`moved`, `panBefore`/`zoomBefore` диффы), плюс
`complete config layout history and wire unchanged` (`same(before, state)`).
Всё выполнено, PASS. Защитный узел — `wall-selection-not-live-owned`
(убирает класс `hp-editor-only-layer`, который отдаёт owner-ship отрисовки
`live-editor.ts` → `makeTransparent('.hp-editor-only-layer:not(...)')`, тот
же механизм double-paint guard, что уже используют resize/backdrop/opening
слои). Не исполнялся в этом раунде; авторская заметка
(`docs/analysis/911-wall-selection-evidence-2026-10-15.md`, «An intermediate
red caught precisely that missing ownership class…») фиксирует, что этот же
контроль ловил реальный баг во время разработки — не только теоретическая
связь.

**AC3** (unit + ревью кода). `src/wall-thickness-selection.ts` переиспользует
существующие `roomWallProfile`/`wallThickHoverHalfUnits`/`drawWallPreviewD`
(сверено по сигнатурам и единицам измерения — `coordScale=1000` совпадает с
`NORM_W`, используемым в `_wallThickHit`). Прочитан построчно:
`space.id !== spaceId` — отказ на чужом этаже; `indices.length !== 1` — отказ
без устаревшего fallback; диапазон `cm∈[0,100]` и конечность
координат/ненулевая длина сегмента — явный fail-closed. `test/wall-thickness-selection.test.mjs`
исполнен — 5/5 PASS, включая нулевую ширину на трёх `cell_cm`, реверс
обхода, смещённую после правки стену, NaN/-1/101. Три защитных узла —
`wall-selection-foreign-floor-accepted`, `wall-selection-stale-room-fallback`,
`wall-selection-disregards-current-width` — прочитаны: все три патча меняют
именно то условие, которое уже покрыто существующим `assert.equal(...,
null)`/`assert.deepEqual` в этом же тесте (проверено построчно, не
исполнялось).

**AC4** (тот же native lifecycle-сценарий). Проверены: Escape, смена
инструмента (`select`), смена этажа (`other`→`selection`), закрытие через
`editor-close` (переход в View), Apply (room/partition, ровно одна
save/history транзакция и точные см на проводе), Undo (полный откат
конфига), remount под kiosk=true/false — все PASS в локальном прогоне.
Прочитан путь, почему переключение инструмента не закрывает сам
`_wallDialog` (`_activateMarkupTool` чистит диалог только **при входе** в
`wallthick`, не при выходе) — это добавленное до #911 поведение, не
регрессия этой задачи: индикация корректно гаснет через условие
`this.host._tool === 'wallthick'` в `_renderWallThickUi`, не через закрытие
диалога. Защитный узел — `wall-selection-ignores-tool-boundary` (снимает это
самое условие) — не исполнялся, логика патча и assertion сверены построчно.

| AC | Чем доказан | Чем краснеет |
| --- | --- | --- |
| AC1 | `demo/smoke_wallthick_standalone.mjs`, исполнен лично, PASS (room+partition) | `wall-selection-hidden-with-dialog` — не исполнялся (политика), прочитан |
| AC2 | тот же смок, исполнен лично, PASS (drag/pan/zoom/resize + no-write) | `wall-selection-not-live-owned` — не исполнялся, авторски пойман вживую при разработке (см. текст) |
| AC3 | `test/wall-thickness-selection.test.mjs`, исполнен лично, 5/5 PASS | `wall-selection-foreign-floor-accepted`, `wall-selection-stale-room-fallback`, `wall-selection-disregards-current-width` — не исполнялись, прочитаны |
| AC4 | тот же смок, исполнен лично, PASS (tool/floor/View/kiosk/Apply/Undo) | `wall-selection-ignores-tool-boundary` — не исполнялся, прочитан |

## Находки

Нет High. Нет Medium.

- **Low-1** (стиль, самостоятельно снято). Коммит `6a53ba44` несёт нестандартный
  трейлер `UV: no` вместо `User-Visible: no`. Функционально безвреден: коммит
  правит только `docs/analysis/911-wall-selection-evidence-2026-10-15.md`,
  `change-classes.mjs` классифицирует его как чистый класс C (docs-only), а
  AGENTS.md прямо освобождает docs-only коммит от трейлеров вообще
  («docs-only commit needs none»). `process-gate.mjs --issues --report`
  подтверждает 0 предупреждений на этом диапазоне. Находка не возвращается
  автору и не создаёт цикл — это наблюдение для будущих коммитов, не дефект
  текущего.

## Что проверено и корректно

- Трейлеры `Issue:`/`User-Visible:` на коммите класса A (`432145d9`) и оба
  changelog (RU/EN) в том же коммите — п.10 §3 соблюдён.
- Release-ledger `docs/release-ledger/v1.80.1/911.json`: классификация
  `stable-fix` обоснована и перепроверена лично — `git show v1.80.1:src/houseplan-card.ts`
  содержит тот же отключающий guard (`!this._markup || this._tool !== 'wallthick'
  || !this._cursorPt || this._wallDialog`, строка 8934), т.е. отсутствие
  подсветки уже было в вышедшем stable, а не введено в бете. RU/EN summary
  присутствуют.
- Одно число — один источник: этот дифф не трогает бюджетные числа
  (`scripts/monolith-baseline.json` на `bundleBytes: 2940437` этой веткой не
  меняется) — двойного источника не возникает.
- `docs/ARCHITECTURE.md`, `docs/STATUS.md`, `docs/WALL-THICKNESS.md`,
  `docs/USER-GUIDE(.ru).md` описывают ровно реализованное поведение, без
  заявлений сверх кода; терминология («Толщина», «подсвеченной», «следует за
  стеной») согласована с существующим USER-GUIDE.ru.md.
- Кэш `wallThickSelectionCache` (один элемент, ключ — identity `d.a` + ссылка
  на модель + `_cfgEpoch`) корректно инвалидируется по вводу поля (ссылка
  `d.a` не меняется при правке `value`) и по правке геометрии/смене модели
  (ссылка модели берётся из мемоизированного `_model`, ключ которого —
  `_cfgEpoch` + fingerprint, т.е. стабилен в пределах эпохи) — перф-требование
  ТЗ («без полного поиска на каждый pointermove») выполняется архитектурно,
  не только по заявлению.
- Существующий курсорный `_wallThickHover`-геттер и его использование
  (`wallhot`) не изменены; `d ? selected : this.host._wallThickHover` гарантирует,
  что без открытого диалога путь рендера идентичен коду до #911.
- Никаких новых persisted-полей/schema/writer; `_wallThickApply`/`_wallThickHit`
  не тронуты за исключением двух строк инициализации кэша в `_wallThickClick`.
- Новые i18n-строки не добавлены (соответствует «Не-скоуп»).

## Чего не проверял

- Из 56 смоков с «прямым совпадением» (`smoke-select`) исполнено 9 (названный
  в AC `smoke_wallthick_standalone` + 8 точечных по общему инструменту/диалогу);
  остальные 47 не прогонялись — токены совпадения (`_spaceModel`, `_tool`,
  `spaceId`, `cellCm`) у них общие с половиной редактора, не признак
  изменённого пути записи/геометрии. Полная матрица — предрелизная
  обязанность, не гейт этого ревью; к тому же все три шарда `Смоки в
  браузере` CI уже зелёные на этом точном SHA.
- `golden:verify` не гонял отдельно сам — тот же workflow-run, на который
  ссылается Validate, уже содержит задание «Golden-кадры против принятых
  эталонов» → success на этом точном SHA — независимое повторение не
  требовалось.
- Мутанты (`wall-selection-*`, 6 штук) не исполнялись — общая политика
  запрещает это ревьюеру вне ночного workflow; статическая регистрация и
  `--check` подтверждены, разбор каждого — построчным чтением (таблица выше).
- `npm run invariants` (инварианты геометрии) не гонял: новый файл —
  read-only presentation resolver поверх уже проверяемой геометрии
  (`roomWallProfile`, `wallIntervals`), не писатель и не отдельная модель;
  `requiredProfiles` (`scripts/candidate-readiness.mjs`) классифицирует дифф
  как `editor`, не добавляет `geometry` (сам новый файл не матчит
  `wall[-_]|geometry|resize|opening` regex) — сочтено оправданным чтением, а
  не пропуском.
- Реальное touch/pen/HA-полевое/owner-GPU приёмочное тестирование не
  проводилось — вне контракта задачи (editors desktop-first, best effort на
  touch, TOUCH-SUPPORT.md).

## Вердикт

Зелёный. Реализация делает ровно заявленное в AC1–AC4, не расширяет
hit-testing/Apply/Undo/камеру/#900, не меняет View/kiosk, трейлеры и
changelog/ledger корректны, гейты по объёму задачи (typecheck/build/unit/
AC-named native smoke/golden/полный smoke-matrix — все зелёные на этом SHA,
часть перепроверена лично) подтверждены. Единственное замечание (Low-1) не
функционально и не возвращает задачу автору.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/911-wall-dialog-selection`, коммит `6a53ba44b860` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `39d02e7d53d45d4d0569d93b8020443c4334afa0`
  ```
  git log --all --format='%H %T' | grep 39d02e7d53d4
  ```
- Тело issue: `2f014da48c75534c8413406bbc346cd2f1b2d2ae016e3d0cdff4b809d33c63c9`
- Вердикт конвейера: `green` · High 0 · маршрут `fix`
<!-- hp:model-usage-v1 eyJzY2hlbWEiOjEsInJlYXNvbiI6bnVsbCwibW9kZWxzIjpbeyJpZCI6ImNsYXVkZS1oYWlrdS00LTUtMjAyNTEwMDEiLCJpbnB1dF90b2tlbnMiOjQ3NTYsIm91dHB1dF90b2tlbnMiOjIwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjAsImNhY2hlX3JlYWRfaW5wdXRfdG9rZW5zIjowLCJjb3N0VXNkRXN0aW1hdGUiOjAuMDA0ODU2fSx7ImlkIjoiY2xhdWRlLXNvbm5ldC01IiwiaW5wdXRfdG9rZW5zIjoyNTgsIm91dHB1dF90b2tlbnMiOjY4MDAwLCJjYWNoZV9jcmVhdGlvbl9pbnB1dF90b2tlbnMiOjIxMjI2MSwiY2FjaGVfcmVhZF9pbnB1dF90b2tlbnMiOjE5MjUwNDY4LCJjb3N0VXNkRXN0aW1hdGUiOjUuMzc5NjUzNTk5OTk5OTk4fV0sInR1cm5zIjoxMzksImR1cmF0aW9uTXMiOjEzMjYwNDYsImZpbmlzaFJlYXNvbiI6InN1Y2Nlc3MiLCJvdXRjb21lIjoic3VjY2VzcyIsInByb3ZpZGVyQ29zdFVzZEVzdGltYXRlIjo1LjM4NDUwOTU5OTk5OTk5OSwiYmlsbGluZyI6InByb3ZpZGVyLWVzdGltYXRlLW5vdC1vYXV0aC1jaGFyZ2Utb3ItcXVvdGEifQ -->
<!-- hp:usage input_tokens=5014 output_tokens=68020 cache_creation_input_tokens=212261 cache_read_input_tokens=19250468 num_turns=139 -->
