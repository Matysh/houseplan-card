# Code review — issue #138, cycle r1

Вердикт: **зелёный** · цикл r1/4 · High: 0 · Medium: 0

Ветка: `issue/138-adjacent-room-autoclose` · implementation-коммит
[`ca7dbed`](https://github.com/Matysh/houseplan-card/commit/ca7dbeda9280b9b0a424702676db8d6dfebb12d1)
· ТЗ: [`docs/specs/138-adjacent-room-autoclose.md`](../specs/138-adjacent-room-autoclose.md)
(редакция r2, зелёный `SPEC-REVIEW-138-r2.md`).

## Скоуп проверки

Диапазон `git diff origin/dev...HEAD` — 17 файлов. Продуктовый код:
`src/plan-snap-overlay.ts` (новый чистый helper `findSharedRoomSnapSegment` +
изменённый tie-break дедупликации сегментов по оси) и `src/houseplan-card.ts`
(рефакторинг `_closeRoomContour` в `_validateRoomContour`/
`_openRoomContourDialog`, новые `_canAppendRoomDraftPoint` и
`_tryAutoCloseRoomContour`, подключение в `_markupClick`). Тесты:
`test/plan-snap-overlay.test.mjs` (+46 строк, 3 новых теста), новый
production-bundle smoke `demo/smoke_room_autoclose.mjs`. Документация:
`ARCHITECTURE.md`, `CANVAS.md`, `USER-GUIDE.ru.md`, `TESTING.md`, оба
changelog, запись в `docs/specs/README.md`. Три копии бандла идентичны между
собой и совпадают со свежей локальной сборкой.

Единственный implementation-коммит `ca7dbed` несёт `Issue: #138` ·
`User-Visible: yes`; оба changelog обновлены в этом же коммите — требование
выполнено. Предшествующие коммиты (`611c5a7`, `3a84c7f`, `6704cfc`, `db7cf9d`)
— это ТЗ и его ревью-документы, `User-Visible: no`, класс C; в код не входят.
Merge-коммит `1dbded5` синхронизировал ветку с `dev` (в т.ч. #141) без
конфликтов, что подтверждено зелёным `npm test`/`npm run build` на итоговом
дереве.

## Как проверялось

Дешёвые гейты (всегда):

- `npx tsc --noEmit` → **зелёный**, без вывода.
- `npm test` → **796/796 green**.
- `npm run build` → зелёный; `cmp dist/houseplan-card.js
  custom_components/houseplan/frontend/houseplan-card.js` и `cmp
  dist/houseplan-card.js demo/srv/assets/houseplan-card.js` — обе команды
  молча завершились успехом. SHA-256 свежей сборки
  (`83a64bc2c54dfbf00680a2a9bd1949f2beea917d2c27cc90f064697b5ea7cb8a`)
  побайтно совпал с хэшем, заявленным автором в хендофф-комментарии —
  бандл не редактировался руками после передачи на ревью.

Гейт по необходимости (diff трогает единственную затронутую поверхность —
инструмент «Контур комнаты» редактора Плана, назван в ТЗ и AC1–AC10):

- `node demo/smoke_room_autoclose.mjs` → **зелёный, 9/9**
  (`secondCommonWallPointStaysOpen`, `endpointAutoCloseOpensDialog`,
  `terminalSegmentPersistsBeforeDialog`, `roomIsNotCommittedBeforeSave`,
  `cancelKeepsTerminalOpenDraft`, `savePromotesDraftWithoutPartition`,
  `sharedWallKeepsNeighbourThickness`, `openingCutPreventsAutoClose`,
  `invalidCloseHasNoPartialWrite`).

**Дисциплина «тест умеет падать»** — применена к обоим прогнанным наборам,
намеренной порчей кода с последующим откатом (дерево осталось чистым, `git
status --short` пуст, сборка и `npm test`/smoke зелёные после отката):

1. В `plan-snap-overlay.ts` откатил tie-break дедупликации до чистого
   `localeCompare` (убрал `sourceRank`) → `npm test` **упал** ровно на новом
   тесте `a completed room remains the authority for a coincident
   deduplicated axis` (1 fail из 796). Тест не тавтологичен.
2. В `houseplan-card.ts` убрал guard `if (this._path.length < 2) return
   false;` в `_tryAutoCloseRoomContour` (это в точности r1-High regression,
   исправленный в ТЗ r2) → пересобранный бандл **проваливает**
   `secondCommonWallPointStaysOpen` в smoke. Подтверждает, что
   AC3/минимально-вершинный гейт реально протестирован, а не совпадение.
3. Полностью отключил eligibility (`_tryAutoCloseRoomContour` всегда `false`)
   → smoke **проваливает** 5 из 9 проверок
   (`endpointAutoCloseOpensDialog`, `cancelKeepsTerminalOpenDraft`,
   `savePromotesDraftWithoutPartition`, `sharedWallKeepsNeighbourThickness`,
   `invalidCloseHasNoPartialWrite`).

Не прогонялось, с обоснованием (соразмерность гейтов, PROCESS.md §8):

- **`npm run golden:verify`** — diff не меняет ни один `render()`/lit-шаблон
  (проверено: `git diff ... -- src/houseplan-card.ts | grep 'html\`\|render('`
  — пусто), только приватную логику клика и чистый геометрический helper; ТЗ
  §14.3 прямо утверждает отсутствие новых pixels/состояний. Полный набор (67+
  сценариев) — предрелизный гейт, непропорциональный правке без визуальных
  изменений.
- **Полный browser smoke-suite (127 файлов)** — diff касается ровно одной
  поверхности (Room outline / draw), прогнан только целевой
  `smoke_room_autoclose.mjs`, который и есть единственный новый/изменённый
  smoke в этом диффе.
- **`python -m pytest tests_backend`** — `custom_components/**/*.py` не
  тронут (подтверждено `git diff --stat`), ТЗ §11 и AC13 это же утверждают.
- **Performance-профили / Full Performance** — AC11 не заявляет изменение
  бюджета, только «не должно расти»; новый код вызывается исключительно из
  `_markupClick` (клик), не из pointermove/hover — проверено чтением (`grep
  findSharedRoomSnapSegment|_tryAutoCloseRoomContour src/houseplan-card.ts`
  даёт единственный вызывающий сайт на клик), геометрический snapshot
  переиспользует существующий кеш `_planSnapGeometrySnapshot()`. Отдельного
  повода подозревать регресс перфоманса нет.

## Разбор AC

- **AC1, AC3–AC9** — доказаны smoke (`demo/smoke_room_autoclose.mjs`, все
  сценарии выше) и/или unit (`test/plan-snap-overlay.test.mjs`); падение
  проверено намеренной порчей (см. «Как проверялось», пп. 1–3).
- **AC2 (line-snap точки на общем интервале)** — geometric часть доказана
  unit-тестом `shared-room interval contains endpoints and interior
  wall-bound points only on one edge` (`[20,0]-[80,0]`, `[0,0]-[40,0]`).
  Полный browser-сценарий с mid-line точкой в `smoke_room_autoclose.mjs`
  отсутствует (там только endpoint-to-endpoint). **Проверено чтением, не
  исполнением:** `resolvePlanSnap`/`quantizedPoint`
  (`plan-snap-overlay.ts:248-283`) проецируют указатель строго на ось
  сегмента и возвращают точку `segment.a + u·distance`, то есть коллинеарную
  этому же сегменту с той же epsilon, что использует
  `findSharedRoomSnapSegment`; отдельного резолвера или допуска для
  line-snap точек в `_tryAutoCloseRoomContour` нет — используется тот же
  `pt`, что и для endpoint-случая. Риск несовпадения точности признан
  низким. **Low, не блокирует** — не заведено отдельным issue: geometric
  ядро уже protected unit-тестом, а интеграционная часть — прямое повторное
  использование уже покрытого пути без специального кода для этого случая.
- **AC10 (touch: tap без hover, gesture-safety)** — заявленный в ТЗ метод
  «smoke» не выполнен: ни один tap/pan/pinch/pointercancel сценарий не
  добавлен ни в `demo/smoke_room_autoclose.mjs`, ни в существующий
  `demo/smoke_editor_gestures.mjs` (второй файл в этом диффе не менялся).
  **Проверено чтением, не исполнением:** `_markupClick`
  (`houseplan-card.ts:6508-6619`) отклоняет клик до вызова
  `_tryAutoCloseRoomContour`, если `this._suppressClick` (строка 6512) —
  это уже существующий, не тронутый этим диффом guard, которым
  управляют pan/pinch/pointercancel/synthetic-click пути в другом месте
  файла. `_tryAutoCloseRoomContour` не читает hover-состояние: единственные
  входы — `this._path[0]`, только что резолвнутый `pt` (тем же
  `_resolvePlanDrawPoint`, что и обычный клик) и кешированный snapshot.
  Отдельного hover-зависимого кода нет, поэтому tap-без-hover эквивалентен
  click по построению, а не по совпадению. **Low, не блокирует** — записано,
  не заводится отдельным issue: риск регресса архитектурно исключён тем, что
  новая логика не создаёт нового обработчика событий и не вводит
  hover-зависимости.
- **AC11 (perf)** — проверено чтением (см. «Как проверялось»): единственный
  вызывающий сайт — клик, `O(S)`-скан по кешированному snapshot, кеш не
  растёт (тот же `_planSnapGeometryCache`, ключ не расширён новыми полями).
- **AC12** — гейты зелёные, три копии бандла побайтно идентичны, оба
  changelog и `USER-GUIDE.ru.md`/`ARCHITECTURE.md`/`CANVAS.md` обновлены в
  том же коммите `ca7dbed`.
- **AC13** — подтверждено `git diff --stat`: ни `custom_components/**/*.py`,
  ни `src/i18n/*.json`, ни `custom_components/**/translations/**`, ни
  `src/types.ts` (схема) не затронуты.

## Что проверено и корректно

- **Порядок разрешения клика (§7.1)** — прочитан `_markupClick`
  (`houseplan-card.ts:6508-6619`): `pt` берётся из актуального
  `_resolvePlanDrawPoint` **до** любой ветки; порядок веток — ctrl/cmd-close
  → close-by-first-point → `_tryAutoCloseRoomContour(pt)` →
  `_draftEndAt`/resume-join → обычное добавление. Это ровно порядок,
  который требует ТЗ (автозамыкание после explicit-веток, до
  `_draftEndAt()`).
- **Минимально-вершинный гейт (r1-High из SPEC-REVIEW-138-r1, симметрия с
  ручным замыканием)** — `_tryAutoCloseRoomContour` отказывает при
  `this._path.length < 2`, что вместе с добавляемым `pt` даёт минимум 3
  вершины — то же требование, что и explicit-закрытие
  (`this._path.length >= 3`). Регресс-тест существует и умеет падать
  (проверено намеренной порчей, см. выше).
- **Проёмы/open span (§7.3)** — `findSharedRoomSnapSegment` фильтрует только
  `sourceKind === 'room'`, а сами сегменты уже разрезаны `cutSegments` по
  `roomCuts` до вызова; второй resolver не появился (`grep` подтверждает
  единственный источник cuts — существующий `_planSnapOpeningCuts`/
  `_openCuts`). Smoke `openingCutPreventsAutoClose` зелёный.
- **Дедупликация оси room/draft/partition (новый `sourceRank`)** — без этого
  изменения `findSharedRoomSnapSegment` мог бы не найти `sourceKind: 'room'`
  сегмент для оси, которая после `canonicalPair` совпадает с осью partition
  или draft (алфавитный tie-break предпочитал `'partition...' <
  'room...'`). Изменение не расширяет скоуп: это внутренний, не наблюдаемый
  пользователем инвариант того же модуля, необходимый именно для контракта
  AC4/AC9 («drafts/partitions не запускают автозамыкание, но не должны и
  вытеснять room-сегмент с той же осью»). Покрыт unit-тестом, который умеет
  падать (проверено выше).
- **Валидация без mutation (§8.1–8.2)** — `_validateRoomContour` вызывается с
  явным `path`-параметром (без побочных эффектов на `this._path`) и в
  `_closeRoomContour`, и в `_tryAutoCloseRoomContour`; запись в `this._path`/
  `_persistActiveDraftSegment()` происходит только после успешной валидации.
  Smoke `invalidCloseHasNoPartialWrite` подтверждает отсутствие частичной
  записи и правильный toast.
- **Cancel/Save/толщина (§9, AC7-AC8)** — smoke подтверждает: Cancel
  возвращает открытый draft с точкой `B` и тем же состоянием, что до диалога;
  Save создаёт комнату без независимой partition, `B—A` наследует толщину
  соседней стены (40), новые внешние сегменты сохраняют свою (15).
  «Оставить замкнутыми стенами» и сам диалог не менялись этим диффом — новая
  замыкающая грань становится обычной частью закрытого `this._path` до
  открытия диалога, поэтому существующий save/keep-walls контракт применяется
  к ней без специального кода (проверено чтением: `_openRoomContourDialog`
  не отличает автозамкнутый путь от вручную замкнутого).
- **i18n/backend/схема (AC13)** — новых ключей, файлов Python, полей схемы
  нет; подтверждено diff'ом.
- **Терминология документации** — `docs/USER-GUIDE.ru.md`,
  `docs/CHANGELOG.md`/`.ru.md` переиспользуют термины «T-соединение» / точка
  на линии, уже введённые предыдущим (#141) разделом того же Unreleased
  changelog, а не изобретают новые.

## Чего не проверял

- **`npm run golden:verify` (полный набор)** — не прогонялся; diff не трогает
  шаблоны/рендер, ТЗ явно не ожидает новых pixels. Обоснование см. выше.
- **Полный browser smoke-suite (127 файлов)** — не прогонялся, вне
  относящейся к задаче поверхности.
- **`python -m pytest tests_backend`** — не прогонялся, Python не тронут.
- **Performance smoke / Full Performance** — не прогонялись; предрелизный
  гейт, повода подозревать регресс нет.
- **AC2 line-snap и AC10 touch/gesture — end-to-end browser-сценарий** — не
  выполнялся (в диффе нет такого smoke); закрыто чтением кода, см. раздел
  «Разбор AC» — оба Low, записаны, не блокируют и не заводятся отдельными
  issue.
- **Ручное визуальное тестирование в браузере** (не headless) — не
  выполнялось; выводы основаны на smoke/unit и прямом чтении/воспроизведении
  через намеренную порчу кода.

## Итог

High: 0. Medium: 0. Low: 2 (AC2 line-snap и AC10 touch/gesture — интеграционный
smoke не добавлен, риск закрыт чтением кода и не блокирует; записаны выше,
отдельные issue не заводятся).

Вердикт зелёный: AC1–AC13 доказаны автотестом (с подтверждённой способностью
падать) либо разобраны по коду с явной записью «проверено чтением, не
исполнением». Задача готова к очереди на пре-релиз.
