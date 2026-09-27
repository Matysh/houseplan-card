# CODE-REVIEW-461-r1

- **Issue:** https://github.com/Matysh/houseplan-card/issues/461
- **ТЗ:** `docs/specs/461-wall-draw-click-performance.md` (SPEC-REVIEW-461-r1, зелёный)
- **Материал:** SHA `34d53bf2d1b9252e37b356c1a295b1bcab7865f9`, ветка
  `issue/461-wall-draw-click-performance`, диапазон `origin/dev..HEAD` = 4 коммита
  (`1ef21037` ТЗ, `9bdf531c` spec-review doc, `04a1de09` реализация
  `User-Visible: yes`, `34d53bf2` рефреш screenshot-фингерпринта `User-Visible: no`).
- **Заход:** r1 · блокирующих циклов израсходовано 0 из 4
- **Вердикт: жёлтый**

## Скоуп ревью

Этап code (PROCESS.md §2.7). Диапазон `git diff origin/dev...HEAD`: 50 файлов,
+2388/−491, из них продуктовый исходник — `src/draft-live-commit.ts` (новый,
152 строки), `src/draft-live-preflight.ts` (новый, 406 строк),
`src/houseplan-editor-runtime.ts` (+2/−1: подмена вызова в
`_persistActiveDraftSegment`). Остальное — тесты (`test/draft-live-preflight.test.mjs`
новый, `test/wall-union-isolation.test.mjs` +6/−1), гейты
(`scripts/mutation-gate.mjs` +5 мутантов, `scripts/smoke-links.mjs`,
`.github/workflows/validate.yml`, `package.json`), демо/perf
(`demo/wall-draw-click-harness.mjs`, `demo/benchmark_wall_draw_click.mjs`,
`demo/smoke_wall_draw_click.mjs`, `demo/fixtures/wall-draw-click.mjs`,
`demo/performance/README.md`), документация (ARCHITECTURE/CONFIG-COMPATIBILITY/
оба CHANGELOG/specs README) и сгенерированные бандлы + `docs/images/screenshots.json`
(только `sourceFingerprint`, все 10 `imageSha256` не изменились — сверено построчно).

## Как проверялось

Дешёвые гейты подтверждены на этом же SHA прогоном Validate
(https://github.com/Matysh/houseplan-card/actions/runs/33962804004, success) —
не перегонял `npx tsc --noEmit`, `npm test`, `npm run build`+сверку бандлов,
`no-new-any`, `check-docs`, канонические screenshots и полный browser smoke:
все они уже зелёные на точном `34d53bf2`, диапазон между этим SHA и текущим
HEAD пуст (я разбираю тот же коммит).

| Гейт | Прогнал сам | Результат / источник |
|---|---|---|
| `npx tsc --noEmit` | нет | Validate на `34d53bf2` — success |
| `npm test` | нет | Validate на `34d53bf2` — success (1995 pass, заявлено автором, подтверждено тем же прогоном CI) |
| `npm run build` + сверка 3 копий бандла | нет | Validate на `34d53bf2` — success; вручную свёл, что единственная содержательная правка бандла — переименованный чанк `houseplan-editor-runtime-*` (см. `git diff --stat`), схоже с добавлением нового модуля |
| `node scripts/no-new-any.mjs` | нет | Validate на `34d53bf2` — success; заявлено автором «560 добавленных строк, новых `any` нет» |
| `node scripts/check-docs.mjs` | нет | Validate на `34d53bf2` — success; diff трогает `src/**`, отпечаток обновлён коммитом `34d53bf2` |
| Канонические screenshots | нет | отдельный прогон job `docs`, ссылка в хендоффе: 10/10 `imageSha256` без изменений, принят только `sourceFingerprint`; сверил сам `docs/images/screenshots.json` — все `imageSha256` идентичны `dev` |
| `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | да | 38 прямых совпадений, 20 зарегистрированных/слабых связей, 1 «зарегистрированная связь» — вывод приложен ниже |
| Targeted browser smoke (`smoke_wall_draw_click.mjs` + связанные `_markupClick`-смоки) | нет | Validate на `34d53bf2` прогнал полный smoke тремя шардами — success; целевой смок новый, заявлен автором зелёным |
| `npm run benchmark:wall-draw-click` | нет (не воспроизводил числа) | зарегистрирован в CI (`validate.yml` шаг «Быстрый commit точки стены (#461)»), заявленные числа (median 10.9 мс, max 13.8 мс, remote 16.7 мс) укладываются в бюджеты 150/250/~36.3 мс с большим запасом; структуру ассертов проверил чтением `demo/benchmark_wall_draw_click.mjs` — соответствует §9.2 |
| `python -m pytest tests_backend` | нет | diff не трогает `custom_components/**/*.py` |
| `node scripts/model-invariants.mjs` | нет | diff не меняет способ ЗАПИСИ геометрии (`commitWallSegmentModel`/`adoptWallSegmentModelCandidateInPlace` не изменены — `git diff` по `src/wall-segment-model.ts` пуст), новый код только читает существующие структуры для построения runtime-only local proof; ссылки/толщины остаются под тем же самым write-барьером, что и раньше |
| Мутанты `scripts/mutation-gate.mjs` | да (чтением + прослеживание сигналов) | все 5 новых мутантов трассированы до guard-команды и до конкретного счётчика/поля, которое красит патч (таблица ниже) |

Дальше — построчное чтение продуктового кода: `src/draft-live-preflight.ts`
целиком (406 строк), `src/draft-live-commit.ts` целиком (152 строки), diff
`src/houseplan-editor-runtime.ts` (call site), `test/draft-live-preflight.test.mjs`
целиком, `demo/wall-draw-click-harness.mjs`, `demo/benchmark_wall_draw_click.mjs`,
`demo/fixtures/wall-draw-click.mjs`, `demo/smoke_wall_draw_click.mjs`,
diff `scripts/mutation-gate.mjs`, все правки документации.

## Находки

### Medium (в скоупе задачи — чинится в этой же issue)

**M1. AC4 заявляет метод доказательства «`unit` + mutation witness» для
«verdict fast/full совпадает на матрице §8», но матрица не проверена ни одним
тестом через новый путь.**

§8 перечисляет десять конкретных сценариев: свободное продолжение цепочки,
14°/15° junction, valence 6/7, стена 19/20 см и короткий атом в более длинном
run, node distance 4/5 см, пересечение комнаты/partition/чужого draft/column,
физический `wall-degraded-extra` (фикстура #278), hosted opening, нулевая
стена, malformed local carrier. AC4 в самом ТЗ отдельно называет ещё три
обязательные мутации: «выбросить соседнюю комнату», «не включать чужой
draft/column», «не замыкать junction rays».

Что реально доказано:

- «выбросить соседнюю комнату» — есть, `wall-draw-local-neighbour-dropped`
  в `scripts/mutation-gate.mjs`, guard
  `node --test --test-name-pattern="local draft projection" test/draft-live-preflight.test.mjs`.
- «не включать чужой draft/column» и «не замыкать junction rays» — не
  зарегистрированы как мутанты (что легально для чистых юнитов, PROCESS.md
  §2.7), но подтверждены прогоном самих unit-тестов: `deepEqual` на
  `remote-draft`/`remote-column` в тесте «retains interacting geometry and
  drops remote work» и на `beyond-one-layer`/`remote` в тесте «closes a
  collinear run and keeps every ray at its junctions» — оба списка исчерпывающие
  (`deepEqual`, не `some`), значит лишний или недостающий элемент красит их.
- Сама матрица §8 (10 пунктов) — **не проверена ни разу через новый путь.**
  `git diff --stat -- 'test/*.mjs'` за весь диапазон называет только
  `test/draft-live-preflight.test.mjs` (новый) и `test/wall-union-isolation.test.mjs`
  (+6/−1, только источник строки вызова). Ни один из этих файлов не строит ни
  14°, ни valence 6/7, ни 19/20 см, ни 4/5 см, ни `wall-degraded-extra`.
  Единственный близкий случай — `demo/smoke_wall_draw_click.mjs:27`,
  один клик на 10 см, отклонённый «существующим правилом 20 см» — это одно
  представление правила минимальной длины, и оно не на границе (19 vs 20), а
  далеко от неё.

  Я проверил все восемь существующих смоков с «junction»/«wall_chain» в имени
  (`smoke_junction_limits.mjs`, `smoke_wall_junctions.mjs`,
  `smoke_multiwall_junction.mjs`, `smoke_near_orthogonal_junction.mjs`,
  `smoke_wall_chain_merge.mjs`, `smoke_wall_chain_thickness.mjs`,
  `smoke_junction_holes.mjs`, `smoke_junction_patch_resilience.mjs`) на предмет
  случайного покрытия: ни один не вызывает `_markupClick` (`grep -c
  "_markupClick"` — везде 0). `smoke_junction_limits.mjs` строит свои 14°/19 см
  кейсы через `card._commitRoom()` — путь создания комнаты, явно вне скоупа
  задачи (§3.2) и не задевающий `commitDraftSegmentGeometry` вовсе. Это
  подтверждено и инструментом `smoke-select.mjs`: он относит
  `smoke_junction_limits.mjs` к «прямому совпадению» по общим символам
  (`_activeDraftId`, `_path`, `_showToast`), но общий символ — не то же самое,
  что общий код-путь, и здесь это ложное срабатывание эвристики.

  Я проверил и обратное — что механизм спроектирован разумно (общие
  production-функции `checkSpacePhysicalGeometry`/`_junctionLimitsIntroduced`
  вызываются без изменений, локальный проектор собирает контекст
  дистанционно + итеративным закрытием), и структурно это должно давать
  parity. Но это рассуждение, а не свидетель, а именно свидетель заявлен как
  метод доказательства AC4.

  **Почему это Medium, а не Low.** Правило #435 (PROCESS.md §2.7): «Пустой
  третий столбец — находка Medium, а не примечание». Именно это здесь и
  происходит — заявленный метод доказательства («unit + mutation witness» на
  конкретно перечисленной матрице) не подкреплён ни одним тестом, который
  реально строит эту матрицу через новый код-путь.

  **Фикс в скоупе задачи** (Medium в скоупе чинится в текущем issue, PROCESS.md
  §2.7/#202): добавить unit-тест(ы), которые прогоняют реальные
  `checkSpacePhysicalGeometry`/`_junctionLimitsIntroduced` на локальном
  candidate/previous из `draftLiveCandidateSpace` для хотя бы репрезентативного
  подмножества строк §8 (в первую очередь — границы 14°/15°, 19/20 см, 4/5 см
  и valence 6/7, поскольку это единственные пункты, зависящие именно от
  completeness локального проектора у существующей границы, а не только от
  наличия/отсутствия объекта), сравнивая verdict с той же проверкой на полном
  `space`. Не обязательно заводить новый мутант в `scripts/mutation-gate.mjs`
  для каждого пункта — для чистых юнитов достаточно демонстрации в документе,
  но сами тесты обязаны существовать.

### Low (не блокирует, оставляю с записью)

**L1. §6.4 против фактической обработки `!safe` в `commitDraftSegmentGeometry`.**

ТЗ: «Исключение, `null`, `degraded-extra`, `failed-core`, floor failure либо
невозможность построить local candidate отклоняют fast path и приводят к
generic full barrier; они не дают fail-open принятия» (`docs/specs/461-*.md:205-207`).

Код (`src/draft-live-commit.ts:108-121`): если `checkSpacePhysicalGeometry`
бросает исключение, возвращает `{ok:false}` (в т.ч. `degraded-extra`/
`failed-core`) или проваливает off-grid проверку — вызывается `rejectUnsafe`
(тост `geometry_unsafe`, откат `before`, `return false`), а НЕ
`runtime._commitPhysicalGeometry(...)` (fallback на generic barrier).
Буквально это расходится с «приводят к generic full barrier».

**Снимаю без правки.** Тот же паттерн (`try { ok } catch { false }` →
restore + `toast('geometry_unsafe')` без повторной попытки на полном барьере)
уже существует в этом же файле для аналогичного случая —
`houseplan-editor-runtime.ts:1846-1854` (реконсиляция pending physical write).
Значит выбор реализации соответствует установившейся в этом же рантайме
конвенции для «локальный физический чек нашёл проблему», а не является
недосмотром. Разница с fallback-веткой (`return fallback()`) содержательна:
`fallback()` используется, когда **невозможно доказать форму diff'а**
(legacy/mixed/неизвестная модель, `!candidateProjection` — не удалось
ПОСТРОИТЬ candidate), тогда как `rejectUnsafe` используется, когда candidate
построен, но производственная проверка **нашла в нём нарушение** — в этом
случае повторный прогон того же самого plan-geometry-preflight на полном
пространстве почти никогда не отменит локально найденное нарушение (локальный
набор — строгое подмножество полного), а на редкой доказуемой развилке (когда
`degraded-extra` мог бы разрешиться более широким контекстом) поведение
безопаснее: fail-closed вместо потенциальной второй попытки. Ни один AC не
формулирует эту развилку как отдельный проверяемый критерий, так что это не
нарушение AC — расхождение только с прозой §6.4.

## Таблица «AC · чем доказан · чем краснеет» (PROCESS.md §2.7 #435)

| AC | Чем доказан | Чем краснеет |
|---|---|---|
| AC1 | `demo/benchmark_wall_draw_click.mjs`: `base.result.first.*` (первый клик 0 checks/write/history), `clickShape` на каждый из 7 кликов | мутант `wall-draw-full-preflight-again` — ломает `clickShape` (localPhysicalChecks/junctionArtifactPasses уходят от 1), `report.pass=false`, exit 1 |
| AC2 | `test/draft-live-preflight.test.mjs` («route guard accepts exactly one active-draft append») — мутированный/mixed/legacy diff → `false`; код-ревью `commitDraftSegmentGeometry:77-80` (model_version, draftId, `isSingleDraftAppend`) | сам unit-тест: `isSingleDraftAppend` на mixed/чужой draftId ожидает `false`, снятие любой из проверок красит соответствующий `assert.equal` |
| AC3 | `test/draft-live-preflight.test.mjs` («retains interacting geometry and drops remote work», «closes a collinear run…», «malformed local geometry fails closed») | `deepEqual`/`assert.equal` на списках near/remote id — лишний/недостающий элемент красит тест напрямую; malformed-тест краснеет, если malformed запись выпадает из proof |
| **AC4** | частично: см. M1 — «drop room»/«foreign draft-column»/«junction rays» покрыты, **матрица §8 (10 пунктов) не покрыта** | `wall-draw-local-neighbour-dropped` (комната); остальное — пусто, находка M1 |
| AC5 | `demo/benchmark_wall_draw_click.mjs`: `clickShape.junctionArtifactPasses === 1` | мутант `wall-draw-wall-artifact-discarded` (передаёт `null` вместо geometry) — `junctionArtifactPasses` не инкрементируется, `clickShape`→false, exit 1 |
| AC6 | `demo/smoke_wall_draw_click.mjs`: `rejected.restored/noGesture/noHistory/noWrite/existingDraftsIntact/namesRule` | мутант `wall-draw-rejection-rollback-skipped` (убирает `_restoreGeometryStateLocal` в ветке `introduced.length`) — `_serverCfg` не совпадёт с `beforeReject` (черновик уже мутирован in-place до вызова `commitDraftSegmentGeometry`, см. `_persistActiveDraftSegment:2793-2798`), `rejected.restored=false` |
| AC7 | `demo/benchmark_wall_draw_click.mjs`: `structural` требует `terminal.fullSpacePhysicalChecks >= 1` | мутант `wall-draw-terminal-full-check-skipped` (заменяет `_commitPhysicalGeometry` на `_recordGeometry` при `wall_chain_finish`) — счётчик остаётся 0, `structural=false` |
| AC8 | регрессия существующих `_markupClick`-смоков (v8_draft_write, free_walls, wall_chain_merge, room_autoclose, editor_gestures, card_tool_conflict, grid_snap, plan_snap_overlay, island_rooms, plan_drawing_repairs, merge_split) — все автоматически идут через новый fast path, т.к. это единственный call site `_persistActiveDraftSegment` | Validate на `34d53bf2` — success по всем трём шардам smoke; не проверял по отдельности через снятую защиту (полагаюсь на факт «эти смоки — прямые совпадения diff» из `smoke-select.mjs` + зелёный CI) |
| AC9 | `demo/benchmark_wall_draw_click.mjs` целиком: fixture shape, structural, timing (median/max/remote vs budgets) | `wall-draw-full-preflight-again` и `wall-draw-terminal-full-check-skipped` оба ломают `structural`; сам timing проверяется реальными числами (10.9/13.8/16.7 мс против 150/250/~36.3), заявлено автором, не перепроверял вычисления |
| AC10 | Validate на `34d53bf2` (tsc/test/build/no-new-any) | не воспроизводил |
| AC11 | `docs/images/screenshots.json` — все 10 `imageSha256` идентичны `dev`, изменился только `sourceFingerprint`; регрессионные smoke/golden — Validate green | не воспроизводил golden:verify локально |
| AC12 | `docs/ARCHITECTURE.md` (+14, новый абзац о границе), `docs/CONFIG-COMPATIBILITY.md` (+9), оба `docs/CHANGELOG*.md` в одном `User-Visible: yes` коммите (`04a1de09`), `docs/specs/README.md` +1 строка, `demo/performance/README.md` +21 | чтением: все обязательные файлы присутствуют, ссылка на #461 в обоих changelog проверена текстом |

## Что проверено и корректно

- **Единственная точка изменения** — `_persistActiveDraftSegment` в
  `houseplan-editor-runtime.ts:2795`, подмена `_commitPhysicalGeometry` на
  `commitDraftSegmentGeometry`; diff файла — ровно 2 добавленные и 1 удалённая
  строка. Все остальные ~15 вызовов `_commitPhysicalGeometry` не тронуты
  (сверено `test/wall-union-isolation.test.mjs` — список history-ключей
  сохранён без `draft_segment`, добавлена отдельная проверка нового call site).
- **Route guard `isSingleDraftAppend`** корректно требует byte-identical
  прочие массивы (`rooms/openings/walls/wall_segments/open_spans/partitions/
  wall_columns/decor`) и plan_transform, ровно +1 точку/+1 сегмент к ровно
  одному активному draft; первый персистентный клик (2 точки из «ниоткуда»)
  обработан отдельной веткой. Легаси/будущая модель отсекается сравнением
  `model_version` до вызова route guard.
- **Локальный проектор `draftLiveCandidateSpace`**: не мутирует исходный
  `space` (проверено тестом на `JSON.stringify` равенство до/после), сохраняет
  неизвестные поля (`future_field: 'kept'` в тесте), корректно учитывает
  реальную толщину при отборе комнат (`thick-envelope`-кейс: партиция вне 5 см
  по оси, но внутри реального 40-сантиметрового тела — включена), закрывает
  коллинеарный run итеративно до неподвижной точки (`while(grew)`), закрывает
  все rays на достигнутых junction одним проходом (сознательно не
  рекурсирует дальше — подтверждено тестом «keeps every ray at its junctions»,
  явно исключающим `beyond-one-layer`), fail-closed на malformed/unlocatable
  записях (не удаляет их из proof, а сохраняет как есть).
- **Переиспользование wall-артефакта**: `checkSpacePhysicalGeometry` вызывается
  один раз на local candidate, его `roomGeom`/`multiWallNodes` передаются в
  `_junctionLimitsIntroduced` вместо повторного union — подтверждено чтением
  `draft-live-commit.ts:110-125` и мутантом `wall-draw-wall-artifact-discarded`.
- **Rollback**: `sp.room_drafts[i] = saved` в `_persistActiveDraftSegment`
  мутирует `_serverCfg` **до** вызова `commitDraftSegmentGeometry` — значит
  `_restoreGeometryStateLocal(before)` в `rejectUnsafe`/junction-reject ветке
  не косметика, а обязательное условие отсутствия «зависшей» точки; смок и
  мутант это подтверждают.
- **Identity re-sync после принятия** (`draft-live-commit.ts:133-143`):
  `_path`/`_draftSegmentCms` перезаписываются точными координатами из
  принятого canonical config, а не оставляют локальные IEEE-хвосты — комментарий
  в коде верно называет причину (следующий клик иначе не докажет draft-only diff).
- **Perf-бюджет**: структура ассертов `demo/benchmark_wall_draw_click.mjs`
  соответствует §9.2/§9.3 буквально (structural отдельно от timing,
  `localProofMaxObjects < positiveSegments` доказывает нелокальность роста,
  remote-вариант удваивает удалённые сегменты и проверяет, что
  `localProofMaxObjects` не меняется).
- **Changelog/архитектура/compatibility** — все три документа обновлены в
  одном коммите с поведением (`04a1de09`, `User-Visible: yes`), содержат
  пользовательский эффект и ссылку на #461; новых i18n-ключей нет (grep по
  diff `src/i18n/*.json` — файлы не тронуты).
- **Golden/screenshots** — `docs/images/screenshots.json`: все 10
  `imageSha256` идентичны версии на `dev`, изменился только
  `sourceFingerprint` (ожидаемо для любой правки `src/**` по механике
  `check-docs`, не является визуальной регрессией).

## Чего не проверял

- Не перегонял `npx tsc --noEmit` / `npm test` / `npm run build`+сверку бандлов /
  `no-new-any` / `check-docs` / канонические screenshots / полный browser
  smoke — все зелёные на точном материале ревью (`34d53bf2`), прогон
  https://github.com/Matysh/houseplan-card/actions/runs/33962804004.
- Не воспроизводил числа `npm run benchmark:wall-draw-click` локально (нет
  Chromium-профиля под рукой в контексте ревью) — доверился структуре
  ассертов (прочитаны построчно) и заявленным автором числам с большим
  запасом от бюджета (10.9 мс против 150 мс).
- Не гонял `node scripts/model-invariants.mjs` — diff не меняет функции
  записи геометрии (`commitWallSegmentModel`/
  `adoptWallSegmentModelCandidateInPlace` не изменены), только читает
  существующие структуры для построения runtime-only proof; риск
  рассинхронизации ключей толщины/решётки не создаётся этой задачей.
- Не гонял `pytest tests_backend` — diff не касается `custom_components/**/*.py`.
- Не строил вручную ни один из десяти пунктов матрицы §8, чтобы лично
  убедиться в parity fast/full — это и есть предмет находки M1: без теста
  такую проверку пришлось бы делать вручную в браузере, а «проверено вручную»
  не является допустимым доказательством AC (PROCESS.md §2.7/№18). Прочитал
  код и рассуждением (не исполнением) убедился, что механизм (общие
  production-функции + дистанционный отбор + итеративное закрытие) СТРУКТУРНО
  должен давать parity, но это не заменяет требуемого юнит-свидетеля.

---

<!-- material-anchors: сгенерировано конвейером (#414) -->

## Материал раунда

- Ветка: `issue/461-wall-draw-click-performance`, коммит `34d53bf2d1b9` — ребейз его осиротит, и это нормально: ниже якоря, которые ребейз не меняет.
- Дерево материала: `35ad6e67e45fd6b74f0f345c1a9d4d6c30d6bd54`
  ```
  git log --all --format='%H %T' | grep 35ad6e67e45f
  ```
- ТЗ `docs/specs/461-wall-draw-click-performance.md`, блоб `ccf374b1c0797ace0156b7cfb366007f1271fd35`
  ```
  git log --all --find-object=ccf374b1c0797ace0156b7cfb366007f1271fd35 -- docs/specs/461-wall-draw-click-performance.md
  ```
