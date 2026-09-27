# CODE-REVIEW-238-r3

- Issue: [#238](https://github.com/Matysh/houseplan-card/issues/238) — «Превью проёма: показывать расстояния до внутренних граней комнаты и стен»
- Этап: code (PROCESS.md §2.7)
- Заход: r3 · блокирующих циклов израсходовано 1 из 4
- Диапазон материала: `origin/dev...HEAD`, `origin/dev` = `636d0a5`
- HEAD ревью: `18cd0c8` (ветка `issue/238-opening-inner-distances`)
- Вердикт: **зелёный**

## Почему round r3 и почему разбор ПОЛНЫЙ, а не по дельте

r2 (документ `docs/reviews/CODE-REVIEW-238-r2.md`, вынесен зелёным) закрыл единственный
High из r1 (несинхронизированный бандл, коммит `2b48b16`). После r2 автор попытался
слить ветку и обнаружил конфликт с ушедшим вперёд `dev`; по правилу владельца
(комментарий в issue) это не открывает новый цикл на правки, а требует ребейза и
повторного код-ревью, потому что после ребейза это другой код (PROCESS.md §7.2).
Старые SHA (`e553875`, `2b48b16`) объектно недостижимы после
`push --force-with-lease` — сравнить дерево напрямую по ним нельзя, что само по себе
подтверждает: это перезапись истории, а не локальная правка поверх известного
основания.

По инструкции такой случай прямо выведен из-под сокращённого разбора по дельте:
«ребейз на ушедший вперёд dev — это другой код». Поэтому весь код-ревью в этом
заходе проведён заново и независимо, как будто это первый заход, но с сохранением
обязательных разделов «Закрытие r2» / «Унаследовано из r2» ниже.

Фактическая находка при этом разборе: `dev` за время между базой ветки (`3aba493`)
и её новой базой (`636d0a5`) продвинулся четырьмя коммитами
(`1391aea`, `142f7ec`, `9e71334`, `636d0a5`) — все они правят только
`demo/smoke_card_tool_conflict.mjs`, `demo/smoke_free_walls.mjs`,
`PROCESS.md`+скриншот `04-room-contour-close.png` и
`.github/workflows/process.yml`. Ни один не касается `src/**`,
`wall-thickness.ts`, `opening-placement.ts`, `physical-geometry.ts` или `types.ts` —
модулей, от которых зависит код #238. Единственный реальный конфликт при ребейзе
был в устаревшем коммите screenshot provenance (ожидаемо: `check-docs`
пересчитывает отпечаток по всему `src/**`, а #238 меняет `src/**`), и он
пересобран заново коммитом `18cd0c8`. Это не отменяет необходимость полного
разбора, но объясняет, почему его результат по существу совпал с r1/r2.

## Материал раунда

```
5582e9a docs(spec): define opening inner-distance guides
06c7934 docs: review document for #238
cb19b7d feat: measure opening preview to inner faces        [User-Visible: yes]
7c6e631 docs: review document for #238
2652bb3 fix: sync #238 bundle and lock shared order
ace6e62 docs: review document for #238
18cd0c8 docs: refresh rebased screenshot provenance
```

Все 7 коммитов несут `Issue: #238`; `User-Visible: yes` стоит ровно на одном
продуктовом коммите (`cb19b7d`), остальные — `no`. Это корректно: `cb19b7d`
единственный меняет рендер/поведение.

## Как проверялось

Читал в указанном порядке `docs/SCOPE.md` (J4/J6), `AGENTS.md`/`PROCESS.md`,
тело и все комментарии issue #238, `docs/USER-GUIDE.ru.md` (терминология «внутренняя
грань», «косяк», «размерная линия» соответствует уже принятой в #233), канонические
`docs/WALL-THICKNESS.md` и `docs/CANVAS.md`, затем ТЗ
`docs/specs/238-opening-inner-distances.md` целиком и весь диапазон diff.

Прочитан построчно новый файл `src/opening-dimensions.ts` (474 строки: контекст,
`activeProfileEdge`, `roomPair`, `independentDimensions`, `resolveOpeningDimensions`)
и полный diff `src/houseplan-card.ts` (интеграция кеша/рендера) и `src/styles.ts`.
Прочитан `test/opening-dimensions.test.mjs` целиком и вручную сверена геометрия
AC1/AC2/AC3 (числа 150/150, общая стена 100/80/100/90, диагональ `400 - 10·√2`).

### Прогнанные гейты и их результат

Дешёвые, всегда:

- `npx tsc --noEmit` — чисто.
- `npm test` — 1049 passed, 0 failed (число совпадает с заявленным автором).
- `npm run build` — OK; после сборки все три копии бандла
  (`dist/houseplan-card.js`, `demo/srv/assets/houseplan-card.js`,
  `custom_components/houseplan/frontend/houseplan-card.js`) дают одинаковый
  SHA-256 `de9576d3cf6b078eead36a472c20ab7f87284aeb18c34239383d4a31d4a3a707`,
  и он совпадает с тем, что уже закоммичено (`git status --short` после сборки
  пуст). Этот хеш идентичен тому, что фигурировал в r1 (после фикса H1) и в r2 —
  независимое доказательство, что рендер-код байт-в-байт не менялся с r2, несмотря
  на переписанную историю.
- `node scripts/check-docs.mjs` (diff трогает `src/**`) — «Documentation checks
  passed (7 files, 10 external links)».

По необходимости (diff трогает `houseplan-card.ts`/`opening-dimensions.ts`/
`styles.ts`, рендер-влияющий код):

- Отбор browser-smoke сделан grep'ом по изменённым символам/классам
  (`opening-dimension`, `resolveOpeningDimensions`, `buildOpeningDimensionContext`,
  `opdimension`, `OpMeasure`, `opshoulder`, `_openingDimensionContextCache`) по
  `demo/smoke_*.mjs`, а не по названию. Совпало три файла:
  `smoke_opening_inner_distances.mjs`, `smoke_opening_measure.mjs`,
  `smoke_opening_preview.mjs`. Отдельно добавлен `smoke_partition_openings.mjs` —
  он не содержит изменённых символов, но проверяет click/save/jamb/undo для
  проёмов на независимой перегородке, то есть регресс ровно того пути, в который
  теперь вклинился новый resolver перед рендером меток. Все четыре прогнаны лично
  против закоммиченного (не гипотетического) бандла — все `OK`, включая новый чек
  `existing_drag_has_no_new_dimension_lines: 0` в `smoke_opening_measure.mjs` и
  полный набор флагов `sharedFourLines/sharedRoomOrder/sharedIndependentValues/
  sharedOppositeFaces/partitionNearFace/...: true` в
  `smoke_opening_inner_distances.mjs`.
- Все 4 mutation guard'а из ТЗ §16 прогнаны индивидуально
  (`node scripts/mutation-gate.mjs --id=<id>`), а не по заявлению автора:
  `opening-dimensions-use-axis-ends`, `opening-dimensions-collapse-shared-side`,
  `opening-dimensions-use-crossing-axis` — «тест покраснел, как обязан», `поймано
  1 из 1» каждый; `opening-dimension-overlay-hidden` (browser-smoke-based, ушёл в
  таймаут на 2 минуты по умолчанию, повторно прогнан с `timeout 280s`) —
  аналогично красный на мутанте. После прогона `git status --short` пуст —
  патчи откатились.

Не прогонялись и почему:

- `npm run golden:verify` / визуальный golden-захват — не переснимал: рендер-код
  (`src/houseplan-card.ts`/`src/styles.ts`/`src/opening-dimensions.ts`) в этом
  раунде байт-в-байт идентичен тому, что уже прошло golden-проверку в r1 (тот же
  SHA-256 бандла, воспроизведённый мной независимо, см. выше), а сам golden
  baseline по правилу разработчика не принимается вне отдельного шага
  `golden:accept -- --reviewed`. Re-run без изменения входа дал бы тот же
  результат, что уже зафиксирован в r1 как «AC13 подтверждён визуально»; повторная
  генерация только тратила бы время на предрелизный гейт.
- `python -m pytest tests_backend` — diff не касается `custom_components/**/*.py`
  (только фронтенд-ассет `custom_components/houseplan/frontend/houseplan-card.js`).
- Полный набор 163 browser-smoke и performance-профили — не названы в AC13/AC14
  напрямую (AC14 доказывается кодовым ревью кеша + unit, что сделано), диапазон
  диффа локален к opening placement/dimensions, полный прогон не пропорционален
  задаче.

## Разбор AC1–AC15 (полный, не только по дельте)

| AC | Проверено | Как |
|---|---|---|
| AC1 | ✅ | unit `room dimensions stop at inner faces...`: 150/150, вручную сверено с геометрией 400/80/20 |
| AC2 | ✅ | unit `an angled adjacent wall ends the room dimension at the real mitre`; формула ожидаемого X проверена вручную |
| AC3 | ✅ | unit (2 теста, включая перестановку `rooms`) + smoke `sharedFourLines/sharedRoomOrder/sharedIndependentValues/sharedOppositeFaces: true` |
| AC4 | ✅ | unit `a concave room uses only the connected inner-face run`: 25/25, `activeProfileEdge`/`roomPair` прочитаны построчно — `run` действительно ищется как содержащий проекцию центра, не любой коллинеарный |
| AC5 | ✅ | unit `independent T junction...`: source `host-end`/`connected-face`, `to: [330,0]` — грань, не ось |
| AC6/AC7 | ✅ | unit `independent fallback is per direction...`; отдельный unit на opening-cut в пересекающей стене (не становится границей) |
| AC8 | ✅ | код `_renderOpeningDimensionGuides` рисует `line`+2 `tick` на каждый `OpeningDimension`, `aria-hidden="true" pointer-events="none"` на группе, CSS дублирует `pointer-events: none` на классах; smoke подтверждает количество и `existing_drag_has_no_new_dimension_lines: 0` |
| AC9 | ✅ | resolver вызывается один раз с уже разрешённым `core`, ни pointer, ни snap повторно не трогает; smoke `smoke_opening_preview.mjs` (`saveMatchesResolver`, `existingOpeningHitBoxIsBounded`, `cancelKeepsPreset` и др.) и `smoke_partition_openings.mjs` (click/save/jamb/undo/redo) — все OK |
| AC10 | ✅ (код) | diff `houseplan-card.ts` не трогает ни одной строки snap/shift/magnet — центр-магнет остаётся осевым по построению; smoke `centerMagnet: true` |
| AC11 | ✅ | `_renderOpeningDimensionGuides` строится только из `label.dimension`, которого нет у drag-измерений (`core.measure.labels` для drag не проходит через `resolveOpeningDimensions`); smoke новый чек `existing_drag_has_no_new_dimension_lines: 0` |
| AC12 | ✅ | `formatLength` вызывается тем же способом, что и раньше (см. diff); i18n-файлы и schema в diff отсутствуют |
| AC13 | ✅ (унаследовано, см. ниже) | рендер-код байт-идентичен r1/r2 (совпадающий SHA-256 бандла); визуальная golden-проверка не переснималась |
| AC14 | ✅ | `_openingDimensionContextCache` использует тот же `placementKey` (`wallIndex.key` + `_cfgEpoch`), что уже эксплуатируемый `_openingPlacementIntervalsCache` — установленный контракт инвалидации, не новый; `buildOpeningDimensionContext` не вызывает polyclip/union, только `roomWallProfile`/`insetContour`/`wallEdgeBodies`, что уже используется в существующих путях |
| AC15 | ✅ | `cb19b7d` одним коммитом меняет `src/**`, оба `docs/CHANGELOG*.md` и оба `docs/USER-GUIDE*.md` |

Скоуп (§5.2 ТЗ) соблюдён: drag существующего проёма не тронут (см. AC11),
`opening-placement.ts` не менялся (типы candidate там не потребовались — код
берёт нужные поля через `Pick<OpeningPlacementCore, ...>` в самом
`opening-dimensions.ts`, что не противоречит ТЗ §14 «допустимо другое узкое
имя»), i18n/persisted fields/backend не затронуты.

## Находки

Нет находок уровня High или Medium. Ниже — не находки, а зафиксированные
наблюдения без действия:

- Технически ТЗ §14 ожидал правку типов в `src/opening-placement.ts`; вместо
  этого новый модуль сам сузил нужный тип через `Pick<...>`. Это не нарушение
  контракта (ТЗ прямо разрешает «другое узкое имя», а не требует правки именно
  этого файла) и не всплывает как несовместимость типов — `tsc` чист.
- `2652bb3` помечен `User-Visible: no`, хотя правит порядок resolve на shared
  wall (детерминированность). Итоговый видимый порядок меток и раньше был
  специфицирован в ТЗ §9 («canonical left/right, затем стабильный roomId»); фикс
  устраняет расхождение с уже заявленным контрактом, а не меняет то, что видит
  пользователь в штатном случае (порядок `rooms` в реальных конфигах не
  переставляется вручную). Ниже Low, не требует действия.

## Закрытие раунда r2

r2 сам по себе был зелёным без собственных находок — он лишь подтвердил закрытие
единственного H1 из r1. Этот раунд (r3) не открыт находкой code-review, а
инициирован процессным событием (ребейз после конфликта при мерже), поэтому
таблицы «находка → чем закрыта» из r2 в r3 нет предмета для повторного закрытия.
Для полноты: H1 r1 (несинхронизированный бандл) остаётся закрытым — в этом
раунде бандл пересобран и сверен заново с нуля (см. «Как проверялось»), результат
идентичен.

## Унаследовано из r2 (и транзитивно из r1)

Раздел обязателен по формату, но по факту раунд проведён полным разбором, а не
сокращением по дельте (см. «Почему round r3» выше). Единственное, что
принимается без повторного самостоятельного построения, а не воспроизводится:

- **AC13 (визуальная различимость light/dark, golden-снимок).** Источник:
  `docs/reviews/CODE-REVIEW-238-r1.md` (SHA `e553875` пост-фикс, недостижим
  напрямую после force-push, но контекст сохранён в тексте документа,
  закоммиченного в этой же ветке коммитом `7c6e631`). Основание доверия: три
  копии бандла в HEAD дают тот же SHA-256, что и на момент r1/r2 golden-захвата,
  и это воспроизведено мной независимой пересборкой в этом раунде, а не
  переписано со слов автора — то есть рендер-код, от которого зависит golden,
  доказуемо не менялся ни байтом. Полный `golden:verify`/новый скриншот в этом
  раунде не переснимался.
- Ручная арифметика геометрии диагональных/T-стыков (AC2/AC5, формулы вида
  `400 - 10·√2`) — выведена и проверена в r1; в этом раунде тесты с той же
  арифметикой перепрогнаны и дали тот же результат (`npm test` зелёный), но
  сама формула повторно с нуля не выводилась.

## Что не проверено (сверх раздела «не прогонялись» выше)

- HA-интеграция вживую (ручной клик в браузере) не выполнялась — весь вывод
  «оно работает» получен из pure unit + browser-smoke (реальный Chromium через
  `demo/smoke_*.mjs`) и чтения кода, как предписано процессом для этапа
  код-ревью.
- Performance-профиль (`performance_smoke`) не прогонялся — не назван в AC и не
  является предрелизным гейтом этого раунда; кеш-инвалидация проверена
  чтением кода и unit/smoke на повторное использование контекста
  (`contextReused: true`).
