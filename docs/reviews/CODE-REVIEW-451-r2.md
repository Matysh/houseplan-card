# CODE-REVIEW-451-r2

- **Issue:** #451 «План подтормаживает: диагностика на каждый кадр, реактивная камера, отсутствие фильтра HA-тиков»
- **Этап:** код-ревью, заход r2
- **Материал:** `git log --oneline origin/dev..HEAD` / `git diff origin/dev...HEAD`, точный SHA `cb68492c990b27e91c35130fa3a77806bd157c5e` (ветка `issue/451-render-performance`)
- **Предыдущий раунд:** `CODE-REVIEW-451-r1`, SHA `1850eb18b5e8f0813f9d2efb50694dc4ca1fff26`, вердикт красный, High 1 / Medium 2 (SHA назван в самом документе r1, `Материал:`; в комментарии-вердикте issue SHA не упомянут — это несоответствие оформления, не находка по существу)
- **ТЗ:** `docs/specs/451-render-performance.md` (полный трек, `SPEC-REVIEW-451-r2` зелёный)
- **Вердикт:** см. итог в конце документа

## Дельта раунда

`git diff 1850eb18..cb68492c` — 8 источников кода/скриптов вне `dist/**`/`custom_components/.../frontend/**`
(класс D, бинарные копии бандла синхронизированы автоматически и не разбираются построчно):

| Файл | Изменение |
|---|---|
| `src/junction-limits.ts` | новая экспортируемая `junctionLimitViolations()` — общая реализация full/affected-room проверки, вынесенная из `houseplan-editor-runtime.ts`; добавлен `lightweight`-режим (переиспользует переданный `multiWallNodes`, не пересобирает `wallBodiesGeometry`) |
| `src/houseplan-editor-runtime.ts` | `_junctionLimitViolations` делегирует в новую функцию с `roomIds`; `_rszProjectPreview` больше не вызывает `_rszSpaceCandidateGeometry`/`_checkSpacePhysicalGeometry` на каждый move — использует lightweight junction-check, ограниченную `changedRoomIds`; полная проверка (`_rszCandidateRenderable`) осталась только в `finish()`; `_rszAcceptPreview`/`_rszCancelDrag` управляют `_cfgEpoch`/`_physicalBodiesCache.key` точнее; `_renderResizeLayer`/`_renderOpenings`/`_renderDecorLayer` получили фильтры `roomIds`/`onlyIds`/`onlyId` |
| `src/live-editor.ts` | resize-preview теперь рисует только затронутые стены (`resizePreviewWalls`, читает `room.poly`/`wall.a|b|cm|key`, строит `WallEdgeBody` сама), а не полный `_renderWallBodies`; decor-preview делает прозрачным только перетаскиваемый шейп, а не весь `.decorlayer` |
| `src/houseplan-card.ts` | `_terminalFrame` (0/1/2): `_renderBody()` возвращает `noChange` на кадре отмены resize/decor, если состояние байт-в-байт совпадает с исходным; `requestUpdate` сбрасывает флаг при любом именованном свойстве |
| `src/resize-controller.ts` + `test/resize-controller.test.mjs` | `cancel()` возвращает `restoreEpoch`, чтобы `_rszCancelDrag` мог откатить `_cfgEpoch`, а не только `_wallUnionCache` |
| `demo/benchmark_large_house.mjs` | измерение `longTask.editorSeries` разбито на три отдельных окна (по одному на resize/resize/decor-часть), вместо одного окна на весь editor-сценарий |
| `scripts/bundle-budget.mjs` | `INITIAL_VIEW_GZIP_CEILING` 297 000 → 298 000, с обоснованием |
| `scripts/mutation-gate.mjs` + `demo/smoke_render_invalidation.mjs` (новый) | закрывают M1/M2 r1 |

Геометрия и ссылки на неё прямо затронуты (`junction-limits.ts`, чтение `wall.a/b/cm/key`,
`room.poly`, `multiWallNodesForGeometry`, `wallBodiesGeometry`, `innerContourForRoom`) — разбор
не сокращается до «только заявленных находок», гейты по геометрии прогнаны (см. ниже).

## Как проверялось

| Гейт | Команда | Результат |
|---|---|---|
| typecheck | `npx tsc --noEmit` | зелёный |
| unit | `npm test` | 1956 tests, 1955 pass, 1 skip, 0 fail |
| build + бандл | `npm run build && node scripts/bundle-sync.mjs` + `cmp`/`diff -rq` трёх копий | совпадают байт-в-байт |
| docs fingerprint | `node scripts/check-docs.mjs --external` (обязателен — diff трогает `src/**`) | **красный**, см. H1 |
| any-гейт | `node scripts/no-new-any.mjs --base f8b3445d --head cb68492c` (та же пара, что использует CI-джоба этого пуша) | **красный**, см. H2 |
| invariants | `npm run invariants -- --config <экспорт large-house фикстуры>` (diff трогает геометрию/wall-thickness) | «Инварианты выполнены: ссылки разрешимы, записи толщины находятся» |
| smoke-select (по дельте) | `node scripts/smoke-select.mjs --base 1850eb18 --head cb68492c` | 58 прямых, 27 слабых, 1 зарегистрированная связь (`smoke_real_plan_masonry.mjs` ← `wallBodiesGeometry`) |
| smoke (все прямые + зарегистрированная + 5 смежных по физической геометрии) | 66 файлов, по одному `node demo/smoke_<name>.mjs` (список — в приложении к комментарию) | 64 OK, 1 красный воспроизводимо (`smoke_room_resize.mjs`, см. H3), 1 красный только под конкуренцией за CPU при последовательном прогоне всех 66 (`smoke_edit_walk.mjs`; повторный изолированный прогон — 6/6 OK, тот же класс флакиности, что и `smoke_smooth_zoom` в r1, не регрессия) |
| golden | `npm run golden:verify` | 153/153, 0 diff |
| performance (структурные assert'ы) | `npm run benchmark:large-house-interaction -- --samples=7 --warmups=1` (×3 независимых прогона) | завершается без throw каждый раз |
| performance (абсолютные потолки) | `npm run benchmark:compare -- --absolute-only --budgets=demo/performance/budgets-large-house-interaction.json` на всех 3 прогонах | `cache.entries.cleanFloor` = 100/100 во всех трёх (совпадает с заявленным автором числом, H1 r1 в этой части закрыт); но в каждом из 3 прогонов минимум один тайминговый чек красный (`longTask.editorSeries.maxSingleMs` 231–324 vs 150 во всех трёх; изредка также `timing.interactionSeriesMs.median` и `longTask.editorSeries.totalP95Ms`) — см. «Под вопросом» ниже |
| backend | не запускал — диф не трогает `custom_components/**/*.py` (проверено чтением: `git diff 1850eb18..cb68492c --name-only` не содержит `.py`) | проверено чтением |
| мутация | `node scripts/mutation-gate.mjs --id=render-invalidation-renders-irrelevant-ha` | «поймано 1 из 1» — M2 r1 подтверждён рабочим |

CI на этом же SHA (`cb68492c`, run `33918076536`) независимо подтверждает H1 и H2: джоба
«Предполётные проверки» красная на `DOCS: failure`, джоба «Фронтенд: типы, юниты, мутанты,
синхрон бандла» красная на «Новый код не добавляет any: 11» — обе с теми же файлами/строками,
что и локальный прогон ниже. Всё, что стоит за этими двумя джобами по конвейеру (браузерные
смоки, перф-смок, golden), было **skipped**, то есть CI не подтверждает и не опровергает
performance-часть отдельно от того, что нашёл я локально.

## Находки

### H1 (High, блокирует) — отпечаток скриншотов документации устарел, `docs`-джоба красная

`node scripts/check-docs.mjs --external` (та же команда, что в `validate.yml:59`) завершается:

```
ERROR screenshot source fingerprint is stale; run npm run build && node demo/docs/capture.mjs
```

`visualFingerprint()` считается по всему `src/**` (#245: версия не в счёт, но код — да), а
раунд r2 меняет `src/houseplan-card.ts`, `src/houseplan-editor-runtime.ts`,
`src/junction-limits.ts`, `src/live-editor.ts`, `src/resize-controller.ts` без сопутствующего
`npm run build && node demo/docs/capture.mjs`. Автор прогонял этот гейт в r1 (документ
`CODE-REVIEW-451-r1` фиксирует «Documentation checks passed»), но в комментарии о фиксе r1
(`Исправления по CODE-REVIEW r1`, 2026-09-04T20:48:54Z) `check-docs` не упомянут вовсе — гейт
пропущен именно там, где diff тронул `src/**` заново. Ровно этот класс пропуска уже дважды
оставлял `dev` с красной `docs`-джобой до следующей задачи (#230, #234 → #237); здесь он пойман
до слияния. Фикс не меняет ни одного пикселя (перерисовка внутренняя), поэтому обновление —
чисто отпечаток, `npm run build && node demo/docs/capture.mjs`.

Подтверждено независимо: CI-прогон `33918076536` на этом же SHA, джоба «Предполётные проверки»,
`DOCS: failure`.

### H2 (High, блокирует) — новый код добавляет 11 непрокомментированных `any`, гейт красный

`node scripts/no-new-any.mjs --base f8b3445d --head cb68492c` (пара база/head, которую
использовала CI-джоба этого пуша) находит 11 новых явных `any` на добавленных строках без
обоснования `// any-ok: …`:

```
src/houseplan-card.ts:7792, src/junction-limits.ts:51,54,57,73,
src/live-editor.ts:61,62,65,157,163,164
```

Все — в коде, который непосредственно реализует ТЗ этого раунда (сигнатуры
`junctionLimitViolations`/`LiveEditorHost`, читающие `config`/`space`/`room` как `any`). Часть
можно типизировать через уже существующие интерфейсы (`ServerConfig`, `SpaceModel`), часть —
обосновать комментарием на той же строке; гейт не требует нулевого `any` в принципе (в `src/**`
их 1034 в 49 файлах), а требует явного решения по каждой НОВОЙ строке.

Подтверждено независимо: тот же CI-прогон, джоба «Фронтенд: типы, юниты, мутанты, синхрон
бандла», шаг «Новый код не добавляет any», идентичный список строк.

### H3 (High, блокирует) — resize потерял видимую fail-closed реакцию на невозможную геометрию посреди жеста

`node demo/smoke_room_resize.mjs` падает воспроизводимо (проверено дважды подряд, изолированно
и в общем прогоне — одинаково):

```
FAILED (2):
  - safe_resize.preflight_visible_reason: expected true, got false
  - safe_resize.preflight_reason_once: expected 1, got 0
```

Смок (существовал до #451, не новый) подставляет `card._checkSpacePhysicalGeometry = () => ({
ok: false })` и ожидает, что **во время** протяжки (`pointermove`, до `pointerup`) карточка
покажет тост «last safe position/последн…» ровно один раз. До этого раунда `_rszProjectPreview`
на каждый move вызывал `_rszSpaceCandidateGeometry()` → `_checkSpacePhysicalGeometry()` и
отклонял проекцию с `reason: 'physical-geometry'`, если проверка проваливалась — именно так
жест «останавливался на последней безопасной позиции» с видимой причиной. Правка H1-r1 убрала
этот вызов из `_rszProjectPreview` целиком (осталась только lightweight junction-limit проверка,
ограниченная `changedRoomIds`, — другой класс проверки: буквенные лимиты узлов/клиренса, а не
собираемость геометрии стен). Полная проверка (`_checkSpacePhysicalGeometry`) осталась только в
`_rszCandidateRenderable`, вызываемой из `_rszUp()` → `finish()` — то есть **только по
pointerup**, с общим `resize.commit_failed` тостом вместо специфичного отказа посреди жеста.

Строка `// #329 AC7a: a step that would ADD a junction-limit violation is never projected, so
the drag stops at the last allowed position…` (houseplan-editor-runtime.ts:3657) осталась в коде
рядом с местом, где ссылалась на удалённую проверку — комментарий теперь описывает только
junction-limit ветку, а не physical-geometry, но текст не обновлён и вводит в заблуждение.

Ни один юнит-тест не покрывает новую `junctionLimitViolations()`/lightweight-режим отдельно —
единственная проверка всей цепочки жила в этом смоке, и правка её не заметила именно потому, что
`npm test` эту ветку не касается (только браузерный смок её и держал). Это тот же структурный
разрыв, который M2 r1 уже называл для другой части того же диффа: дорогой гейт — единственный
свидетель контракта.

**Почему High.** Регресс в контракте, существовавшем до #451 (не новая функциональность этого
issue), ловится существующим (не добавленным этим PR) тестом, воспроизводится детерминированно.
`User-Visible: no` в трейлере коммита `cb68492c` в этом свете неточен: сценарий редкий
(конкурентное структурное изменение во время жеста), но при его наступлении пользователь раньше
видел объяснение и жест останавливался, а теперь видит только общий отказ после отпускания
курсора — то есть разное поведение, а не «незаметная» оптимизация.

## Под вопросом, не поднимаю до находки

`longTask.editorSeries.maxSingleMs` (потолок 150 мс) красный во всех 3 независимых прогонах
`--samples=7 --warmups=1` на этом SHA (231, 324, 231 мс), при этом `cache.entries.cleanFloor`
(машинно-независимый счётчик, из-за которого r1 был красным) держит ровно 100/100 во всех трёх —
то есть структурная часть H1-r1 закрыта чисто, а тайминговая часть держится у самой границы с
переменным исходом (в одном из трёх прогонов краснели ещё `timing.interactionSeriesMs.median` и
`longTask.editorSeries.totalP95Ms`, в двух других — нет). Отличие от r1: там margin был ~6×
(878 мс против потолка 150) и детерминирован; здесь ~1.5–2× и не детерминирован — характернее
для шумной/разделяемой машины ревьюера, чем для структурного регресса (`demo/performance/README.md`
прямо называет локальный прогон диагностическим). CI не добрался до перф-джобы на этом SHA
(skipped из-за H1/H2), так что канонического парного Linux-сравнения по этому раунду ещё нет ни
у кого. Не поднимаю до отдельной находки, но и не закрываю: автору нужен чистый прогон
`performance.yml` (или локальный на менее нагруженной машине) после того, как H1/H2/H3 будут
исправлены, прежде чем считать AC10 доказанным на этом SHA.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где видно |
|---|---|---|
| H1 (перф-бюджет `large-house-interaction-v1` красный, включая машинно-независимый `cache.entries.cleanFloor` 140≠100) | Resize-preview больше не строит канонический union/full-room clearance на каждый move — только lightweight junction-check по `changedRoomIds` | `cache.entries.cleanFloor` = 100/100 в трёх независимых прогонах этого раунда (см. таблицу выше); тайминговая часть бюджета — см. «Под вопросом» |
| M1 (нет production-smoke на full-render/diagnostics-scan счётчики) | Добавлен `demo/smoke_render_invalidation.mjs` | файл существует, `node demo/smoke_render_invalidation.mjs` → OK |
| M2 (нет мутанта в `scripts/mutation-gate.mjs` для интеграционной проводки) | Добавлен мутант `render-invalidation-renders-irrelevant-ha` | `node scripts/mutation-gate.mjs --id=render-invalidation-renders-irrelevant-ha` → «поймано 1 из 1» |

## Унаследовано из r1 (не перепроверялось в этом раунде)

Со ссылкой на `CODE-REVIEW-451-r1` на SHA `1850eb18`, за пределами того, чего касается дельта
`1850eb18..cb68492c`:

- AC1 (HA intake ≠ visual invalidation), AC2 (dependency classifier), AC3 (terminal
  reconciliation вне resize/decor cancel-ветки), AC4 (RAF-coalesced hover/camera paths вне
  editor-preview), AC9 (pixel-equivalence) — код этих путей дельтой не тронут; повторно
  перечитан не был. AC9 переподтверждён косвенно свежим прогоном `golden:verify` (153/153) в
  этом раунде, остальное — по r1.
- Скоуп диффа (75 файлов на SHA r1) вне восьми файлов, изменённых в этом раунде — не
  перечитывался повторно.
- Backend/invariants-обоснование «диф не трогает `custom_components/**/*.py`» — верно и для
  дельты этого раунда (см. таблицу выше), проверено заново, не только унаследовано.
- Трейлеры `Issue:`/`User-Visible:` коммита r1 (`f8b3445d`, `1850eb18` и предыдущие) — не
  перепроверялись; трейлеры коммита `cb68492c` проверены заново (см. H3 про неточность
  `User-Visible: no`).

## Что проверено и корректно

- `_rszCandidateRenderable`/`_checkSpacePhysicalGeometry` остаются полной, дорогой проверкой на
  `finish()` (пойнтерап) — итоговый коммит геометрии по-прежнему фейлится закрыто; регресс H3
  касается только видимой обратной связи ПОСРЕДИ жеста, не итоговой записи (доказано: `roomPoly`
  до/после в смоке не меняется — `preflight_no_commit` в том же смоке зелёный).
- `resize-controller.ts`: `epochBefore`/`restoreEpoch` для cancel корректно откатывают
  `_cfgEpoch` только при совпадении `snapshotIdentity`, иначе `null` — соответствующие тесты
  `test/resize-controller.test.mjs` (оба сценария) проходят.
- `_terminalFrame` в `houseplan-card.ts`: сбрасывается на любую именованную реактивную запись
  (`requestUpdate(name, …)` с `name !== undefined`) до того, как `_renderBody()` может вернуть
  `noChange` — то есть «проглотить» кадр может только сам вызывающий cancel-путь, а не случайное
  внешнее свойство; `npm test` (1955/1955) и `demo/smoke_render_invalidation.mjs` не показали
  расхождений DOM.
- Единственный источник числа: диф не вводит новых пользовательски видимых величин (внутренний
  перф-рефакторинг), `npm test` включает `test/single-source-numbers.test.mjs` — зелёный.
- `INITIAL_VIEW_GZIP_CEILING` 297 000 → 298 000 обоснован в комментарии тем же коммитом, общий
  бюджет 300 000 и долг #367 не изменены — проверено чтением `scripts/bundle-budget.mjs`.
- Инварианты модели (`npm run invariants`) на конфиге из `demo/fixtures/large-house.mjs`:
  «ссылки разрешимы, записи толщины находятся» — новая `junctionLimitViolations()` не потеряла
  соответствие ключей записей толщины решёточным рёбрам на этой фикстуре.

## Чего не проверял и почему

- Полный набор `demo/smoke_*.mjs` (222 файла) — избыточно: 58 прямых + 1 зарегистрированная
  связь смок-селектора плюс 5 смежных по физической геометрии (`smoke_wall_junctions`,
  `smoke_wall_union_isolation`, `smoke_near_orthogonal_junction`,
  `smoke_multiwall_strip_containment`, `smoke_glow_geometry_resilience`) дают 64/66 живых
  прогонов по затронутым модулям — уже нашли реальный регресс (H3). Оставшиеся 27 «слабых»
  совпадений (общее имя `_mode`/`_baseVb`/`_physicalBodiesCache`/`cellCm`/`NORM_W`) не гонял:
  все пять физически-геометрических смоков из этого же семейства прошли, дополнительный сигнал
  от оставшихся маловероятен, а полный набор — предрелизный гейт (PROCESS.md §8), не гейт
  ревью.
- Полный `performance.yml` (`Full Performance`, парный base/candidate на двух чекаутах) — CI это
  не запускала на этом SHA (skipped из-за H1/H2), у меня нет второго чекаута под парное
  сравнение; заменено тройным `--absolute-only` прогоном на кандидате (см. «Под вопросом»).
- `python -m pytest tests_backend` — диф не трогает `custom_components/**/*.py` (проверено
  чтением `git diff --name-only`).
- Мутация для новой `junctionLimitViolations()`/lightweight-режима отдельно — не потребовалась:
  H3 уже показывает красный тест по этому пути; добавлять мутант к сломанному коду
  преждевременно, стоит сделать после фикса H3, иначе он зафиксирует текущее (неверное)
  поведение.
- Повторный запуск `smoke_edit_walk.mjs` больше двух раз для статистики флакиности — не
  требовалось: тот же класс поведения (падает только под конкуренцией за CPU при плотном
  последовательном прогоне 66 браузерных смоков подряд, чисто 6/6 в изоляции), что уже описан и
  принят как некритичный в r1 для `smoke_smooth_zoom`.

## Итог

**Вердикт: красный.** Три High-находки, все в скоупе задачи и чинятся в ней же (без отдельных
issue): H1 — обновить отпечаток документации (`npm run build && node demo/docs/capture.mjs`),
H2 — типизировать или обосновать 11 новых `any`, H3 — вернуть full physical-geometry preflight
(или эквивалентную защиту) в путь `_rszProjectPreview`, чтобы посреди resize-жеста
невозможная геометрия снова отклонялась видимо, а не только по `pointerup`. После фикса —
чистый повторный прогон `npm run benchmark:large-house-interaction`/`compare` для снятия вопроса
из раздела «Под вопросом».

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/451-render-performance`, коммит `cb68492c990b` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `aaa8519cee54bf2a81f9e922e583d42d7f594ab4`
  ```
  git log --all --format='%H %T' | grep aaa8519cee54
  ```
- ТЗ `docs/specs/451-render-performance.md`, блоб `7c323a29110974aae369077214b9e2a74d9387c1`
  ```
  git log --all --find-object=7c323a29110974aae369077214b9e2a74d9387c1 -- docs/specs/451-render-performance.md
  ```
