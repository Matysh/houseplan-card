# CODE-REVIEW-302-r4

- Issue: [#302](https://github.com/Matysh/houseplan-card/issues/302) — материал узла стен: переработка на аддитивную логику
- Этап: код-ревью (PROCESS.md §2.7)
- Заход: r4 · блокирующих циклов израсходовано на входе 2/4 (r1 жёлтый, r2 жёлтый, r3 зелёный — бюджет не тратит)
- Ревьюемый SHA: `96318fb94f6d64e96054b8ba4d34f615e3088477`
- Ветка: `issue/302-junction-node-material`
- Вердикт: **зелёный** · High: 0 · Medium: 0

## Почему это ПОЛНЫЙ разбор, а не разбор по дельте

r3 (SHA `560c5b81`, вердикт зелёный) не смержился: конфликт при ребейзе на
`dev` (комментарий владельца от 14:33). Автор перевёл задачу в
`S6-in-progress`, выполнил `git rebase origin/dev`, разрешил конфликт и
запушил заново — старые SHA (`fa1112e7`, `42e02396`, `560c5b81`) при этом
переизданы force-push'ем и физически не существуют в текущей истории
(`git cat-file -t <sha>` → `Not a valid object name`; `git fetch origin <sha>`
→ `couldn't find remote ref`). Разбор по дельте против объекта, которого нет,
невозможен буквально.

Существеннее: сам ребейз — не техническая формальность. `git merge-base HEAD
origin/dev` равен текущему тику `origin/dev` (`1575b1e8`), и в диапазон между
прежней базой ветки и этим тиком входит `a2b4d32b fix(plan): keep wall axes
across tools` (#304) — реальная фича, физически задевающая `src/houseplan-card.ts`
и рендер осевых линий, которая столкнулась с этой веткой ровно в одной паре
golden-сцен (`safe-resize-handles-clamp-*`, где стыкуются осевые линии из #304
и сомкнутая вершина ромба из decision №5 этой задачи). Это тот samый случай,
который правило §7.2 требует разбирать полностью: «после ребейза это другой
код». Разбор ниже поэтому охватывает весь диапазон `origin/dev...HEAD`
(49 файлов, 2257/-356), а не только три коммита ребейза.

Раздел «Унаследовано» — не для сокращения объёма проверки, а для
трассируемости: почти весь контроль ниже я выполнил заново и независимо в
этом раунде (перечень гейтов — раздел «Что проверено» и «Гейты»), а не
переписал из r1–r3 на слово. Пересечение с прежними выводами является
следствием того, что `git diff <SHA r3>..HEAD -- src/ test/ demo/ scripts/`
пуст (см. ниже) — код фичи не менялся с r2, а не потому что я решил доверять.

## Дельта ребейза (три коммита после r3)

| коммит | что делает |
|---|---|
| `b2b26407` | принимает объединённые эталоны `safe-resize-handles-clamp-{dark,light}` (осевые линии #304 + сомкнутая вершина ромба decision №5); `baselines-index.json` починен по фактическим PNG после конфликта слияния |
| `d3927f2e` | rebundle обеих копий (`dist/`, `custom_components/.../houseplan-card.js`) на объединённом дереве |
| `96318fb9` | обновляет `docs/images/screenshots.json` (отпечаток скриншотов документации, обязателен при любой правке `src/**`) |

Подтверждено чтением: `git diff <SHA r3>..HEAD -- src/ test/ demo/ scripts/`
не выполним напрямую (SHA отсутствует), но три коммита ребейза сами по себе
трогают только `demo/golden/baselines/**`, `baselines-index.json`, обе копии
бандла и `docs/images/screenshots.json` — ни строки `src/**`/`test/**`
/`demo/**` (кроме бинарных PNG) эти три коммита не меняют (см. `git show
--stat` на каждом, приведено в комментарии issue тем же перечнем файлов).
Отсюда: узловая геометрия (`junctionNodeGeometry`, `junctionContractHoles`,
`junctionNodeBound`, точки вызова в `wallBodiesGeometry`) идентична r2/r3
байт-в-байт; я перечитал её самостоятельно (раздел ниже), а не принял этот
факт на слово.

## Скоуп проверки

Материал: `git log --oneline origin/dev..HEAD` (25 коммитов) и
`git diff origin/dev...HEAD` (49 файлов). Прочитаны: тело issue #302 и все
комментарии, `docs/specs/302-junction-node-material.md` (текущая редакция,
после правки AC6/§4.5/§8.2 в r2→r3), `docs/WALL-THICKNESS.md` (секции
«Junction nodes» и «Junction tooling»), `docs/SCOPE.md`, `docs/reviews
/CODE-REVIEW-302-r1.md` и `-r2.md` для контекста прежних находок.

## Продуктовая рамка

Задача закрывает белые клинья на стыках стен — прямой отчёт владельца,
регресс из релиза в релиз (docs/SCOPE.md, job «нарисовать и увидеть точный
план» — геометрия стен без визуальных дефектов является базовым требованием
самого продукта, не отдельной фичей). Решение №5 (владелец, тем же днём)
сузило исходную идею «сохранить фаску #249» до «полный mitre везде» по
результатам визуального осмотра собственных эталонов — это законная
итерация внутри одной задачи, а не расширение скоупа.

## Что проверено чтением кода

- `junctionNodeGeometry` (`src/wall-thickness.ts:2032-2158`): один угловой
  обход по лучам, отсортированным по азимуту; для каждой пары соседних лучей
  — mitre при условии «В СЕКТОРЕ» (`directionOk`, разная проверка для
  обычной и рефлексной пары), лимит `MITRE_LIMIT × max(half)` и ограничение
  концом толстого саппорта (`thickLength`, #271); иначе — плоская хорда
  (рефлекс) либо локальный bevel, у которого `reach()` ограничен саппортом,
  лимитом и удвоенной глубиной пары. Ни одного вызова `difference()`/`subtract`
  в этой функции — подтверждено grep по телу функции. Соответствует §8.2
  буквально.
- `junctionContractHoles` (`:2178-2226`) и живая проверка в
  `demo/smoke_junction_holes.mjs`: проба — дыра, если она в полосе луча ИЛИ
  в веере узла (контрактное покрытие §8.4), но не в самой геометрии; отдельно
  клиппуется `bound` (фасадная граница). Самопроверка «детектор не слеп»
  — юнит-тест `test/wall-thickness.test.mjs:213` — гоняет детектор на заведомо
  дырявой фикстуре.
- `junctionNodeBound` (`:3197-3226`): та же `exteriorEnvelopeGeometry`, но с
  пустой узловой картой — то есть «гладкий» контур без узловых вырезов;
  используется, чтобы куски узла не отращивали фасад на вогнутой вершине
  (concave-Split контракт).
- Единственное вычитание узловой механики — адресный трим #271
  (`src/wall-thickness.ts:3538-3556`): `needsTrim()` фильтрует узлы с
  вырожденно коротким толстым саппортом (`support.length < support.halfDepth
  * 2`) и вызывает `bevelMultiWallBody` ТОЛЬКО на этом подмножестве — не на
  всех узлах. AC6 подтверждён по коду, не по комментарию.
- Бумага (`floorFootprintGeometry`, `paperRoomShapesWithWalls`): вызовы
  `bevelMultiWallPaper` убраны полностью (функция удалена — `grep
  bevelMultiWallPaper src/wall-thickness.ts` даёт 0 совпадений); паперная
  геометрия — просто `rawPaperGeom`, с комментарием, что footprint∪shell уже
  покрывает каждый узел (измерено в r2 на #197 и репро, байт-в-байт).
- `dropDegenerateRings` (`:3159-3176`): убирает вырожденные (площадь ≤ eps)
  кольца, которые boolean union оставляет там, где хорда веера совпадает с
  хордой старой фаски — иначе они топологические дыры для потребителей,
  считающих кольца.
- Оба рендерера получают тело из одного и того же
  `wallBodiesUnionPath` — точка входа не менялась, только тело функции.

## Находка

### Low — стек-документация `JunctionNodeGeometry` описывает не тот контракт

`src/wall-thickness.ts:2012-2025`, докстринг перед
`export interface JunctionNodeGeometry`:

> «One angular walk produces both halves of the corner rule: a FAN per pair
> of adjacent rays…; **a CUT per over-limit pair — the wedge beyond that same
> chord, which is how the approved #249 chamfer looks**. Fan and cut of one
> pair meet exactly at the chord and never overlap…»

Комментарий описывает механизм с ДВУМЯ артефактами — аддитивным веером и
вычитающим «cut» (то есть фаску #249 как вычитание). Фактический интерфейс,
объявленный прямо под этим текстом, содержит только `fans` и `supports` —
поля `cuts` не существует, и сама функция `junctionNodeGeometry` не вызывает
`difference()` ни разу (подтверждено чтением всего тела функции). Это ровно
тот контракт, который decision №5 и AC6 фиксируют как обязательный: «единственное
вычитание узловой механики — адресный трим #271», а не «per over-limit pair».

Проверено `git log -L2012,2030:src/wall-thickness.ts`: комментарий написан в
самом первом WIP-коммите (`a1361974`, «junction node gets back what a chamfer
must never eat» — до decision №5, когда фаска #249 ещё сохранялась как
вычитающий слой) и ни разу не тронут дальнейшими коммитами decision №5
(`aac50151`) и «fans are the whole additive node» (`d3ed299d`), которые
убрали cut-половину механизма из кода, но не из докстринга.

**Почему Low, а не Medium.** Правило 11 PROCESS.md («документация в том же
коммите, что поведение») касается продуктовой документации
(`docs/**`, changelog, USER-GUIDE) — она вся актуальна и уже дважды сверена
построчно (r1 M1 закрыл `docs/WALL-THICKNESS.md`, r2/r3 M3 закрыл текст
спеки). Здесь — внутренний докстринг исходника, не читаемый пользователем и
не являющийся доказательством ни одного AC (AC6 доказан кодом точки вызова
`bevelMultiWallBody` и мутантом `junction-fan-limit-back-to-249`, не
комментарием). Поведение корректно, тесты и мутанты это подтверждают
исполнением. Риск — исключительно в том, что следующий разработчик,
читающий именно этот файл, ошибётся насчёт контракта «нет вычитаний».

**Решение.** Снято с записью, без правки: находка не в скоупе обязательной
правки этого раунда (Low), но дёшева — 6 строк докстринга, переписывающих
«a CUT per over-limit pair… #249 chamfer looks» на «no cut — the fan always
closes either the mitre or the bounded bevel chord, additively». Рекомендую
поправить при следующем touch этого файла.

## Инвариант модели (#254)

Диапазон меняет геометрию (стыки, `wallIntervals`, узловые записи толщины).
`npm test` уже гоняет инварианты на всех фикстурах проекта — 1304/1304 pass.
Отдельно прогнан `npm run invariants -- --config
test/fixtures/302-junction-artifacts.json` (фикстура-репро владельца, 5
узлов, острые углы 15–70 см): «Инварианты выполнены: ссылки разрешимы,
записи толщины находятся» — ключ записи толщины проверен на точное
совпадение со строкой решёточного ребра, не на допуск.

## Гейты — что прогнал сам

| гейт | результат |
|---|---|
| `npx tsc --noEmit` | чисто |
| `npm test` | 1304 pass / 1 skip / 0 fail |
| `npm run build` + сверка бандла | `git status` после пересборки чист — обе копии (`dist/`, `custom_components/houseplan/frontend/`) байт-в-байт совпадают с закоммиченными |
| `node scripts/check-docs.mjs` | passed (7 файлов, 10 внешних ссылок) — обязателен, diff трогает `src/**` |
| `npm run invariants -- --config test/fixtures/302-junction-artifacts.json` | passed |
| `node scripts/process-gate.mjs` (диапазон `origin/dev..HEAD`, 25 коммитов) | «гейт пройден, предупреждений 0» |
| 8 junction/partition-мутантов (`junction-fans-disabled`, `junction-fan-ignores-thick-length`, `junction-reflex-outer-mitre-missing`, `junction-fan-limit-back-to-249`, `junction-detector-blind`, `junction-pieces-unbounded`, `partition-merge-ignores-junction`, `junction-checks-room-vertices-only`) | каждый лично прогнан `node scripts/mutation-gate.mjs --id=<id>` → «поймано 1 из 1» |
| трейлеры (`Issue:`, `User-Visible:`, `Release:`, `Baseline-Reviewed:`) | проверены на всех 25 коммитах; оба `User-Visible: yes` (`76d60b3e`, `aac50151`) правят `docs/CHANGELOG.md`+`docs/CHANGELOG.ru.md` в том же коммите |

## Гейты — не прогнал сам, компенсировано CI

`npm run golden:verify` и браузерные смоки (`demo/smoke_*.mjs`) в этой
песочнице не запускаются физически: `page.waitForFunction: Timeout 30000ms
exceeded` / `Failed to fetch dynamically imported module`. Это не следствие
изменений задачи — воспроизвёл ту же ошибку на чистом `origin/dev`
(отдельный клон, `npm ci`, `node demo/smoke_decor.mjs`) — сетевое/браузерное
ограничение самой ревью-песочницы, то же самое, что документировал r2.

Компенсация — CI-прогон на `d3927f2e` (третий коммит ребейза; тот же код,
что на HEAD `96318fb9` — разница только `docs/images/screenshots.json`,
подтверждено чтением diff):

- job `golden` (`97846497668`): 126/126 «passed», включая все 16
  junction-сцен и обе `safe-resize-handles-clamp-{dark,light}` — прочитан
  полный лог, посчитано `grep -c passed` = 126, ни одного «failed»/«diff».
- три шарда `smoke` (`97846497632/522/569`): `smoke_junction_holes`,
  `smoke_near_orthogonal_junction`, `smoke_wall_junctions`,
  `smoke_junction_patch_resilience`, `smoke_multiwall_junction` — все `ok`;
  189 смоков суммарно по трём шардам, единственные строки с «FAIL»/«not ok»
  в логе — это исходный текст скрипта (`echo "FAIL $name"`) и смок с
  говорящим именем `smoke_glow_fail_dark`, который сам зелёный.
- `performance_smoke` (`97846497544`): success — AC8 (перф-бюджет) закрыт
  исполнением, не только «механизм существует».
- `frontend` (`97846156731`): success.

Финальный коммит `96318fb9` легитимно получил «skipped» на этих job'ах через
`reuse` (кэш по хэшу контента) — проверено по `changes`/`reuse` job'ам того
же прогона (`32862032767`), содержимое между `d3927f2e` и `96318fb9`
отличается только некодовым `screenshots.json`.

`node scripts/smoke-select.mjs --base <merge-base> --head HEAD`: прямое
совпадение — `smoke_junction_holes`, `smoke_decor`,
`smoke_grid_scale_invariance`, `smoke_real_plan_masonry`,
`smoke_space_scale_defaults`; зарегистрированная связь —
`smoke_junction_patch_resilience`, `smoke_multiwall_junction`,
`smoke_multiwall_strip_containment`, `smoke_resize_pointer_real_plan`,
`smoke_resize_wall_thickness`. Все перечисленные, кроме
`smoke_real_plan_masonry`/`smoke_space_scale_defaults`/`smoke_decor`
(тематически про `cellCm`, не про узлы), покрыты либо AC9, либо CI-прогоном
выше; отдельно `smoke_real_plan_masonry` тоже был в CI как «прямое
совпадение» по `MITRE_LIMIT» и зелёный там же.

## AC — построчно

| AC | статус | как доказано |
|---|---|---|
| AC1 (0 дыр на всём сете §13) | ✅ | `junctionContractHoles` читан построчно; CI golden 126/126 включает все 16 сцен + репро; юнит «the owner repro is hole-free end to end» зелёный локально |
| AC2 (репро владельца, 5 узлов) | ✅ | `smoke_junction_holes` (живой рендер, CI ok) + юнит-тест на той же фикстуре, локально зелёный |
| AC3 (несвязанные сцены — побайтно; junction — легально) | ✅ | `baselines-index.json`: изменения ограничены junction-сценами и двумя `safe-resize-handles-clamp-*` (объяснено выше — легитимное слияние с #304); подтверждено CI golden 126/126 |
| AC4 (57°, 50/70 — сплошная кладка) | ✅ | юнит `issue 302 the 57° mixed-thickness pair takes the full mitre (decision #5)` зелёный; репро-фикстура включает именно эту пару |
| AC5 (виртуальный участок не порождает кладку) | ✅ (чтением) | фильтр `ray.halfDepth > 0` в начале `junctionNodeGeometry` исключает нулевые лучи из веерного обхода; сцены `junction-t-virtual-arm`/`junction-x-virtual-through` в CI golden зелёные |
| AC6 (единственное вычитание — трим #271) | ✅ | `needsTrim()` фильтр по коду (см. выше); мутант `junction-fan-limit-back-to-249` лично прогнан — «поймано 1 из 1»; текст спеки §4.5/§8.2 приведён в соответствие в r3 |
| AC7 (оба рендерера — один путь) | ✅ (чтением, архитектура не менялась) | `wallBodiesUnionPath` — одна точка входа |
| AC8 (перф в бюджете) | ✅ | `performance_smoke` CI job success на коде, идентичном HEAD |
| AC9 (существующие смоки стыков) | ✅ | `wall_junctions`, `junction_patch_resilience`, `multiwall_junction` — CI ok; `split_corner_wall`, `zero_divider_taper`, `wall_thickness*` — часть `npm test` 1304/1304 |

## Не проверял отдельно (не требуется этой дельтой)

- Визуальную приёмку 16 junction-сцен глазами (какой именно pixel-diff у
  каждой) — доверился golden-порогам CI и текстовому описанию решения №5 в
  issue; геометрический контракт проверен чтением кода и детектором, а не
  «на глаз».
- Полный browser-smoke матрицу (189 смоков) целиком — не запрашивает ни один
  AC; ограничился прямыми совпадениями/AC9/зарегистрированными связями,
  все они зелёные в CI на коде, идентичном HEAD.
- `python -m pytest tests_backend` — diff не трогает `custom_components/**/*.py`.

## Итог

Один Low, снятый с записью без правки (стек-докстринг `JunctionNodeGeometry`
описывает вычитающий «cut», которого в коде нет — см. находку выше). High: 0,
Medium: 0. Вердикт — зелёный.
