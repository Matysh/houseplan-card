# CODE-REVIEW-291-r2

- **Issue:** #291 «Барьер записи координат: убрать шум как явление»
- **Этап:** код-ревью (PROCESS.md §2.7), **заход r2**
- **Диапазон:** `52c74301..3c754729` (merge-base с `origin/dev` .. HEAD ветки
  `issue/291-lattice-coordinate-barrier`), 12 коммитов, 38 файлов, +2696/-327
- **ТЗ:** `docs/specs/291-lattice-coordinate-write-barrier.md`, зелёное ревью
  `SPEC-REVIEW-291-r3.md`
- **Ревьюер:** свежая сессия, без контекста реализации; артефакты читаны из
  ветки и через `gh`, не со слов автора

## Почему это ПОЛНЫЙ разбор, а не разбор по дельте

Вердикт r1 (`CODE-REVIEW-291-r1.md`) получен на диапазоне
`10fa0dc7..81d2a801`. Между r1 и этим заходом ветка была **ребейзнута на
ушедший вперёд `dev`** после слияния #290 (комментарий автора 14:17:38 UTC:
«Ребейз на актуальный `dev` после слияния #290 завершён»). Проверено прямо:

```
$ git cat-file -e 81d2a801^{commit}
fatal: Not a valid object name 81d2a801^{commit}
$ git cat-file -e 7de1f44^{commit}   # коммит с фиксами M1/M2 из r1
fatal: Not a valid object name 7de1f44^{commit}
```

Оба SHA, на которые ссылался r1 (диапазон ревью и коммит с фиксами),
переписаны и не существуют в дереве. Это буквально случай PROCESS.md §2.10 /
AGENTS.md §7.2: «после ребейза на ушедший вперёд `dev` это другой код» —
разбор по дельте здесь неприменим, весь диф пройден заново.

## Скоуп

Единый барьер записи, приводящий координаты, лежащие ближе `1e-4` шага сетки
к узлу `k/240`, к точному double этого узла — во frontend и backend, в layout
и config, с отдельным отчётом Optimize и защитой от обхода. Не входит: смена
схемы хранения, #288/#289/#290, union-алгоритм #278, снап авторской off-grid
геометрии.

## Как проверялось

Гейты по PROCESS.md §8, соразмерно задаче (диапазон трогает `src/**`,
`custom_components/**/*.py`, геометрию и ссылки на неё):

| Гейт | Команда | Результат |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | зелёный |
| Unit | `npm test` | 1242 passed, 1 skipped, 0 failed (было 1232 на r1 — рост за счёт `test/coordinate-write-barrier-guard.test.mjs` и правок M1/M2) |
| Build + bundle parity | `npm run build && npm run bundle:sync` + `cmp` трёх копий | `dist/`, `custom_components/houseplan/frontend/`, `demo/srv/assets/` побайтово идентичны |
| Docs fingerprint | `node scripts/check-docs.mjs` | «Documentation checks passed (7 files, 10 external links)» — обязателен, diff трогает `src/**` |
| Model invariants | `node scripts/model-invariants.mjs --config test/fixtures/real-plan-first-floor.json --lattice` (raw fixture) | 66.15% шума (127/192), худший `8.00e-8` шага — воспроизводит измеренную причину issue буквально; после барьера (через `npm test`, см. ниже) — 0 |
| Model invariants (после барьера) | `npm test` → `test('барьер очищает клоны реальных планов, не переписывая source fixtures (#291)')` | зелёный: `profile.noise===0` на клонах обоих реальных планов, `checkWallKeys`/`checkMixedRoleRecords`=0, raw-файл байт-в-байт неизменен |
| Mutation gate (структурная проверка) | `node scripts/mutation-gate.mjs --check` | все патчи, включая 6 lattice-мутантов, применяются к текущему коду ровно один раз |
| Mutation gate (полный прогон, все 6 lattice-мутантов) | `--id=lattice-round-truncates`, `--id=frontend-writes-raw-coords`, `--id=lattice-noise-threshold-too-small`, `--id=lattice-noise-threshold-too-large`, `--id=lattice-layout-allowlist-omitted`, `--id=lattice-unknown-fields-recursive` | все 6: мутант применён → именованный тест **покраснел**, гейт зафиксировал ловлю (`python-lattice-round-truncates` не прогнан — backend, см. «Не проверял») |
| Performance (AC11) | `node demo/benchmark_coordinate_write_barrier.mjs` | ratio 0.608 (лимит 1.2), независимый прогон |
| Smoke — выбор | `node scripts/smoke-select.mjs --base origin/dev --head HEAD` | 3 «прямых совпадения» (`cellCm`) + 1 «зарегистрированная связь» (`repairSpaceReferences`) — те же, что на r1 |
| Smoke — по AC4/AC7 | `smoke_lattice_write_barrier`, `smoke_optimize_coordinate_canonicalization` | оба **OK**, все под-проверки true |
| Smoke — композиционное доказательство AC4 (M1) | `smoke_wall_chain_thickness`, `smoke_room_resize`, `smoke_opening_preview`, `smoke_free_walls`, `smoke_decor`, `smoke_drag_bounds` | все 6 **OK** — реальные production controller paths (wall chain, resize, opening/partition/column, decor, marker/label drag) |
| Smoke — по smoke-select | `smoke_grid_scale_invariance`, `smoke_space_scale_defaults`, `smoke_orphan_space_references` | все **OK** |
| Backend | `python -m pytest tests_backend -q` | **не выполнено** — среда без `pytest`/`homeassistant` (см. «Не проверял»); backend-`.py` не менялся ни одним коммитом после `4ccf4a3c` (см. ниже), значит это тот же код, что был зелёным в CI |
| Golden | не прогонялся | сознательное решение, см. «Не проверял» |
| Process gate | `node scripts/process-gate.mjs --github-range --issues` локально на HEAD | «гейт пройден, предупреждений 0» |
| Process gate (CI, точный SHA) | `gh run view` на run `32737681761` (HEAD `3c754729`) | `success`; `docs`/`process-gate`/`provenance` реально выполнены и зелёные |

Вывод `smoke-select.mjs` (идентичен r1 — диф по `src/**` не расширился сверх
трёх изменённых файлов):

```
Изменено файлов src/**: 3 · символов проекта на изменённых строках: 26
Прямое совпадение (3): smoke_decor.mjs ← cellCm; smoke_grid_scale_invariance.mjs ← cellCm;
  smoke_space_scale_defaults.mjs ← cellCm
Зарегистрированная связь (1): smoke_orphan_space_references.mjs ← repairSpaceReferences
```

Итого прогнано лично 11 браузерных смоков (2 по AC + 6 по композиции AC4 + 3
по smoke-select), все зелёные.

### CI на финальном SHA — что реально проверено автоматикой, а что нет

Проверил независимо от слов автора, через `gh run view --json jobs`:

- `3c754729` (текущий HEAD): Validate `success`, но `changes`-job отфильтровал
  диапазон последнего пуша (только `docs/images/screenshots.json`) —
  `frontend`/`backend`/`smoke`/`golden`/`performance_smoke` **skipped**, не
  «зелёные», а не запускались вовсе;
- `81d2a801` (пуш со скриншотами, SHA которого больше не существует после
  ребейза): та же картина — все браузерные/backend job'ы skipped;
- `9a42c85` (SHA пре-ребейз реализации, тоже переписан): здесь
  `frontend`/`hacs`/`hassfest`/`backend` реально **success** до отмены
  прогона следующим пушем; `golden`/`smoke`/`performance_smoke` — `cancelled`
  (штатное поведение `concurrency.cancel-in-progress`), а не «зелёные».

Вывод: ни один CI-прогон в истории этой задачи (ни до, ни после ребейза) не
довёл `golden`/`smoke`/`performance_smoke` до завершения. Это не искажение со
стороны автора (в хендоффах формулировка точная — «Linux backend … зелёный»,
без утверждений про golden/smoke), но практическая проверка ложится на
код-ревью, что и сделано выше (11 смоков лично, бенчмарк лично, invariants
лично). Backend — единственный пробел, не покрытый ни CI на актуальном коде,
ни локальным исполнением (см. «Не проверял»), закрыт чтением и тем, что файл
не менялся с последнего зелёного `backend`-прогона.

## Закрытие раунда r1

| Находка r1 | Чем закрыта | Где это видно |
|---|---|---|
| **M1** (Medium) — AC4 не доказан ни автотестом, ни явной записью: `smoke_lattice_write_barrier` инъецировал шум напрямую в `_serverCfg`/`_layout`, минуя контроллеры | ТЗ переписан (AC4, коммит `3f633888`): явно зафиксирована **композиционная** схема доказательства — 6 production-bundle смоков реальных контроллеров + executable writer-inventory guard + `smoke_lattice_write_barrier` на уровне общей границы. `docs/TESTING.md` получил два новых пункта с той же формулировкой и списком `[auto: …]`. Комментарий в самом смоке (`smoke_lattice_write_barrier.mjs:96-99`) прямо называет разделение ответственности | `docs/specs/291-lattice-coordinate-write-barrier.md` §AC4 (текст «Поведение доказывается композицией, а не вторым mega-smoke»); `docs/TESTING.md` два новых пункта `[auto: ...]`; прогнал лично все 6 controller-смоков + writer-inventory тест — все зелёные (таблица выше) |
| **M2** (Medium) — `docs/USER-GUIDE.ru.md` не обновлён при `User-Visible: yes`, хотя `docs/USER-GUIDE.md` (EN) получил абзац | RU-раздел 19 получил абзац с тем же контрактом: общий счётчик, максимум с тремя значащими цифрами, scientific notation ниже 0.001 см, только затронутые пространства, неизменность off-grid значений | `git diff origin/dev...HEAD -- docs/USER-GUIDE.ru.md` — непустой, абзац на месте (см. «Что проверено» ниже за точный текст) |
| **L1** (Low) — хендофф цитировал `cancelled` прогон как «зелёный» для backend-job без упоминания отмены | Не требовал правки (наблюдение о точности цитирования, не о коде); не блокирует, статус не менялся | — |

Обе Medium-находки закрыты по существу и проверены построчно (диффы выше,
не заявление автора), не сняты игнорированием. Third `M2`-related risk —
не перепутана ли RU-формулировка с устаревшей — проверена: абзац называет
`3.30e-5 cm`-подобную scientific-notation политику и «только затронутые
пространства», то есть терминологию именно #291, а не старый общий текст
раздела 19 (написанный до ветки задачи).

## Унаследовано из r1

Поскольку разбор в этом заходе полный (см. «Почему это полный разбор»
выше), формально «наследовать без проверки» нечего — весь диф пройден заново
этим документом. Единственное, что взято как факт без повторной проверки:
**зелёный вердикт ревью ТЗ** (`SPEC-REVIEW-291-r3.md`, SHA `4ec43ffd`+ и
`23fb41d4`+, три захода, зелёное на r3) — ревью кода не пересматривает
продуктовые решения владельца, зафиксированные на этапе ТЗ (Q1 про
детализацию Optimize-отчёта, threshold `1e-4`, allow-list полей).

## AC — построчно (повторная проверка, полный разбор)

| AC | Доказательство | Вердикт |
|---|---|---|
| AC1 Идемпотентность/точные биты | `test/coordinate-canonicalization.test.mjs`: 4801 узел, идемпотентность, `-0`→`+0`, `0.06`/`0.2875` не снапятся, граница `1e-4` — в `npm test` (зелёный) | ✅ доказано автотестом, выполнено |
| AC2 Shared allow-list parity | Общая fixture, deep-equal TS/Python; TS-часть выполнена (`npm test`); backend-часть проверена чтением (файл не менялся с последнего зелёного backend CI) | ✅ доказано автотестом (TS) + чтением (backend) |
| AC3 Живой профиль после migration = 0 | `test/model-invariants.test.mjs`: real-plan clone → noise=0, `checkWallKeys`/`checkMixedRoleRecords`=0, raw byte-equal — зелёный в `npm test`; плюс мой независимый CLI-прогон на сыром real-plan-first-floor.json (66.15% шума, воспроизводит измерение issue) | ✅ доказано автотестом + исполнением |
| AC4 Произвольная editing session не возвращает noise | Композиционное доказательство теперь явно задокументировано (закрытие M1 выше) и лично прогнано целиком: 6 production controller smokes + writer-inventory guard test + `smoke_lattice_write_barrier` (граница) — все зелёные | ✅ доказано композицией автотестов, все компоненты лично исполнены |
| AC5 Write barrier нельзя обойти | `test/coordinate-write-barrier-guard.test.mjs` (инвентарь всех frontend-writer'ов + backend Store boundary); мутанты `lattice-round-truncates`/`frontend-writes-raw-coords` лично прогнаны — красятся | ✅ доказано автотестом, выполнено |
| AC6 Source fixtures остаются шумными | Тест в `npm test`: raw-файл байт-в-байт равен до/после, `profile.noise>=100` пин остаётся | ✅ доказано автотестом, выполнено |
| AC7 Optimize report и transaction | `smoke_optimize_coordinate_canonicalization` (лично, зелёный, 13/13); порядок операций в `plan-optimizer.ts` проверен чтением: `lattice`-отчёт измеряется один раз **до** мутаций (строка 427), финальный safety-pass канонизации (строки 649-650) явно прокомментирован как «internal work must not leak into the user-visible report» и гейтится тем же `changed`-флагом, что и остальные счётчики — не создаёт второго источника числа | ✅ доказано автотестом + smoke + чтением, отдельно проверено на предмет «одно число — один источник» после интеграции с #290 (near-axis repair/повторный align) |
| AC8 Compatibility paths | Существующие тесты не тронуты диффом сверх заявленного; no schema/version bump | ✅ проверено чтением + существующими тестами |
| AC9 Polyclip/#278 regression | `npm test` включает все 5 тестов `#278 …`, зелёные (видел в хвосте прогона: `#278 anonymized regression…`, `#278 component set is deterministic…`, `#278 Optimize and model-invariants use the same strict structural result`, `#278 physical fingerprint…`, `#278 production source routes physical writers…`) | ✅ доказано автотестом, выполнено |
| AC10 Мутанты | 6 lattice-мутантов — все лично прогнаны и красятся (таблица гейтов); backend-мутант не прогнан (среда, см. «Не проверял») | ✅ доказано исполнением (frontend), backend — чтением |
| AC11 Performance | `demo/benchmark_coordinate_write_barrier.mjs`, ratio 0.608 (я, независимый прогон), лимит 1.2 | ✅ доказано бенчмарком, выполнено |
| AC12 Локальные гейты | typecheck/test/build/bundle-parity/check-docs — выполнены и зелёные (таблица выше); backend — не выполнен (среда) | ✅/⚠️ частично, backend — см. «Не проверял» |

## Находки

Находок уровня High или Medium в этом заходе **нет**. Обе находки r1 закрыты
(таблица выше), нового Medium/High разбор не вскрыл.

### Low — не блокируют

- **L2** (унаследовано из r1/спек-ревью, не относится к коду): формулировка
  тела issue «Стадия 1 из ADR #282» технически неточна (по ADR #282 «Стадия
  1» — stable wall ids, явно вынесенные в «Не входит» этого же ТЗ). Не
  влияет на код-ревью, отмечен ещё на этапе ТЗ, не блокирует.
- **L4** (новое наблюдение этого захода) — ни один CI-прогон в истории ветки
  не довёл `golden`/`smoke`/`performance_smoke` до завершения (см. раздел про
  CI выше): либо `changes`-path-filter не включил их (докозаписи пуши),
  либо следующий пуш отменил незавершённый прогон. Не дефект процесса
  (штатное поведение `concurrency.cancel-in-progress` и путевого фильтра,
  задокументированное в r1), но фактическую нагрузку по этим трём категориям
  целиком несёт код-ревью — что и сделано (11 смоков + бенчмарк лично). Не
  блокирует, фиксирую как честное описание происхождения зелёных цифр.

## Что проверено и корректно

- **Ребейз не сломал заявленный порядок операций.** `plan-optimizer.ts:427-432`
  измеряет lattice-отчёт и применяет барьер **до** `alignAllToGrid`/
  `repairNearAxisRoomWalls` (новый шаг #290); финальный safety-pass в
  `canonicalizeConfigGeometryInPlace`/`canonicalizeLayoutGeometryInPlace`
  (строки 649-650) идёт **после** второго align-прохода для выпрямленных
  стен и явно прокомментирован как «internal work… must not leak into the
  user-visible report» — то есть отчёт lattice не задваивается и не
  занижается интеграцией с #290. Автор описал это словами в хендоффе
  («canonicalization до Align → near-axis repair → повторный Align →
  финальная canonicalization»); я проверил это построчно по коду, а не
  поверил формулировке.
- **«Одно число — один источник» для нового placeholder `{cm}`.**
  `formatLatticeShiftCm` (использован в диалоге Optimize) и
  `latticeReport()`/бенчмарк используют одну и ту же функцию форматирования
  с тремя значащими цифрами; не смешивается с обычной политикой округления
  `moved/maxShiftCm` grid-align (разные ключи i18n, разные поля отчёта).
- **Backend не менялся с последнего зелёного backend-CI.**
  `git log -- 'custom_components/houseplan/*.py'` в диапазоне задачи
  показывает единственный коммит `4ccf4a3c` — тот же контент, что был
  протестирован в run `32732620838` (`backend: success`, до отмены прогона
  следующим пушем). Ни один последующий коммит backend-файлы не трогал —
  чтение актуального кода эквивалентно чтению того, что уже прошло CI.
- **i18n.** `gs.optimize_lattice_summary`/`gs.optimize_lattice_space`
  присутствуют в `en.json`/`ru.json` буквально как в ТЗ §7.1; проверил
  оба файла напрямую.
- **Трейлеры.** Все 12 коммитов диапазона несут `Issue: #291` и
  `User-Visible: yes|no`; единственный `User-Visible: yes` (`4ccf4a3c`)
  правит оба `docs/CHANGELOG.md`/`docs/CHANGELOG.ru.md` в одном коммите
  (проверил дифф обоих файлов напрямую).
- **Process gate.** И локальный прогон, и CI на точном финальном SHA
  (`3c754729`, run `32737681761`) зелёные.
- Гвард `scripts/coordinate-write-barrier-guard.mjs` — структурная проверка
  количества writer call-site'ов (1 config/set, 2 layout/update, 1
  localStorage, 1 Optimize write во frontend; central Store writer'ы в
  backend) читана целиком: любой новый writer, обходящий единую границу,
  меняет счётчик occurrences и красит `checkCoordinateWriteBarriers`.

## Чего не проверял и почему

- **Backend pytest** (`tests_backend/test_coordinate_canonicalization.py`):
  среда ревью не имеет `pytest`/`homeassistant`
  (`.venv-backend` отсутствует, это известное ограничение не-облачного
  окружения, AGENTS.md). Заменил чтением плюс фактом, что backend-`.py` не
  менялся с последнего зелёного backend CI-прогона (`32732620838`, до
  отмены следующим пушем) — см. «Что проверено».
- **`npm run golden:verify`**: не прогонял. Тест
  `'модели проекта не несут шума решётки (#282)'` (зелёный в `npm test`)
  доказывает, что golden-фикстуры не содержат lattice-шума — значит новые
  условные строки Optimize-диалога (`${r.latticeCoordinatesCanonicalized ? …}`)
  не рендерятся в golden-сценариях и визуального расхождения не должно быть.
  Golden — предрелизный гейт (PROCESS.md §8), не гейт код-ревью.
- **Полный набор из 183 браузерных смоков**: не прогонял, кроме выбранных 11
  (2 AC + 6 композиция AC4 + 3 smoke-select) — по правилу §8 «полные наборы —
  гейт предрелиза».
- **Полный HA-харнесс / WSL**: недоступен в среде ревью.
- Не проверял отдельно совместимость с #288/#289/#290 сверх того, что их
  регрессионные тесты (в т.ч. `#278 …`, `#290 near-axis audit…`) прошли в
  `npm test` без изменений в диффе, не относящихся к #291.

## Итог

High-находок нет. Обе Medium-находки r1 (M1 — композиционное доказательство
AC4 не было названо явно; M2 — `docs/USER-GUIDE.ru.md` не обновлён) закрыты
по существу и проверены построчно, не заявлением автора. Разбор в этом
заходе полный, а не по дельте, потому что ребейз на ушедший вперёд `dev`
переписал оба SHA, на которые ссылался r1 (диапазон ревью и коммит с
фиксами) — код на ветке буквально другой. Ядро реализации — канонизация,
единый непроходимый write barrier, backend-зеркало, идемпотентность,
защита от обхода, производительность, интеграция с новым near-axis/align
пайплайном #290 — проверено заново и работает, включая независимое
исполнение 11 браузерных смоков, 6 мутантов, бенчмарка и invariants на
реальных данных.

**Вердикт: зелёный · заход r2 · блокирующих циклов 1/4 · High: 0 · Medium: 0**
